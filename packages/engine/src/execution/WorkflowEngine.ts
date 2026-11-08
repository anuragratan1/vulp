import {
  GraphNode,
  ICredentialStore,
  IRunObserver,
  Json,
  NodeError,
  RunContext,
  RunEvent,
  WorkflowGraph,
} from '../contracts.js';
import { GraphValidator, INodeTypeProvider, ValidationError } from '../core/GraphValidator.js';
import { ExpressionResolver } from '../expressions/ExpressionResolver.js';
import { abortableSleep, createRetryPolicy, isRetryableError } from './RetryPolicy.js';

export interface WorkflowEngineOptions {
  credentials?: ICredentialStore;
  observers?: IRunObserver[];
}

export interface RunOptions {
  runId: string;
  triggerKey: string;
  triggerPayload?: Json;
  signal?: AbortSignal;
}

export interface RunResult {
  status: 'succeeded' | 'failed';
  error?: string;
}

export class WorkflowEngine {
  private readonly registry: INodeTypeProvider;
  private readonly credentialStore?: ICredentialStore;
  private readonly observers: IRunObserver[];

  constructor(registry: INodeTypeProvider, options?: WorkflowEngineOptions) {
    this.registry = registry;
    this.credentialStore = options?.credentials;
    this.observers = options?.observers ?? [];
  }

  private emit(event: RunEvent): void {
    for (const observer of this.observers) {
      try {
        observer.onEvent(event);
      } catch (e) {
        console.error('Error in RunObserver:', e);
      }
    }
  }

  /**
   * Execute a workflow graph from a specific trigger node.
   */
  public async run(graph: WorkflowGraph, options: RunOptions): Promise<RunResult> {
    const { runId, triggerKey, triggerPayload = null, signal } = options;

    // Check early abort
    if (signal?.aborted) {
      const err = 'Execution aborted before start';
      this.emit({ type: 'run.started', runId, at: Date.now() });
      this.emit({ type: 'run.finished', runId, status: 'failed', error: err, at: Date.now() });
      return { status: 'failed', error: err };
    }

    // 1. Validate graph before execution (Hard-fail on invalid graph)
    GraphValidator.validate(graph, this.registry);

    // 2. Validate trigger node existence
    const nodeMap = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      nodeMap.set(n.key, n);
    }

    const triggerNode = nodeMap.get(triggerKey);
    if (!triggerNode) {
      throw new ValidationError(`Selected trigger node '${triggerKey}' not found in workflow.`);
    }

    const triggerTypeDef = this.registry.get(triggerNode.type);
    if (!triggerTypeDef || triggerTypeDef.category !== 'trigger') {
      throw new ValidationError(
        `Selected node '${triggerKey}' (${triggerNode.type}) is not a trigger node.`
      );
    }

    // 3. Compute reachable subgraph from the selected trigger
    const reachableNodes = new Set<string>();
    reachableNodes.add(triggerKey);
    const queue = [triggerKey];

    const outgoingEdgesMap = new Map<string, typeof graph.edges>();
    const incomingEdgesMap = new Map<string, typeof graph.edges>();

    for (const n of graph.nodes) {
      outgoingEdgesMap.set(n.key, []);
      incomingEdgesMap.set(n.key, []);
    }

    for (const edge of graph.edges || []) {
      outgoingEdgesMap.get(edge.source)?.push(edge);
      incomingEdgesMap.get(edge.target)?.push(edge);
    }

    while (queue.length > 0) {
      const currentKey = queue.shift()!;
      const outgoing = outgoingEdgesMap.get(currentKey) || [];
      for (const edge of outgoing) {
        if (!reachableNodes.has(edge.target)) {
          reachableNodes.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    // Only edges between reachable nodes are considered
    const edgeStates = new Map<string, 'pending' | 'fired' | 'dead'>();
    for (const edge of graph.edges || []) {
      if (reachableNodes.has(edge.source) && reachableNodes.has(edge.target)) {
        edgeStates.set(edge.id, 'pending');
      }
    }

    // 4. Start Run
    this.emit({ type: 'run.started', runId, at: Date.now() });

    const nodeOutputs: Record<string, Json> = {};
    const unprocessed = new Set<string>(reachableNodes);
    const nodeStatuses = new Map<string, 'running' | 'succeeded' | 'failed' | 'skipped'>();

    try {
      while (unprocessed.size > 0) {
        if (signal?.aborted) {
          throw new Error('Execution aborted');
        }

        // Find a node whose incoming edges (from reachable subgraph) are all resolved
        let readyNodeKey: string | null = null;

        for (const candidateKey of unprocessed) {
          if (candidateKey === triggerKey) {
            readyNodeKey = candidateKey;
            break;
          }

          const incoming = (incomingEdgesMap.get(candidateKey) || []).filter((e) =>
            reachableNodes.has(e.source)
          );

          const allResolved = incoming.every((e) => {
            const st = edgeStates.get(e.id);
            return st === 'fired' || st === 'dead';
          });

          if (allResolved) {
            readyNodeKey = candidateKey;
            break;
          }
        }

        if (!readyNodeKey) {
          // No ready node found; cycle or unresolvable state
          throw new Error('Deadlock or unresolvable dependencies in workflow graph execution.');
        }

        const currentNode = nodeMap.get(readyNodeKey)!;
        const currentNodeType = this.registry.get(currentNode.type)!;

        // Determine if any incoming edge fired
        if (readyNodeKey !== triggerKey) {
          const incoming = (incomingEdgesMap.get(readyNodeKey) || []).filter((e) =>
            reachableNodes.has(e.source)
          );

          const firedIncoming = incoming.filter((e) => edgeStates.get(e.id) === 'fired');

          if (firedIncoming.length === 0) {
            // ZERO incoming edges fired: mark skipped and mark all outgoing edges dead
            unprocessed.delete(readyNodeKey);
            nodeStatuses.set(readyNodeKey, 'skipped');

            const outgoing = outgoingEdgesMap.get(readyNodeKey) || [];
            for (const outEdge of outgoing) {
              if (edgeStates.has(outEdge.id)) {
                edgeStates.set(outEdge.id, 'dead');
              }
            }

            this.emit({
              type: 'node.finished',
              runId,
              nodeKey: readyNodeKey,
              status: 'skipped',
              attempts: 0,
              logs: [],
              at: Date.now(),
            });

            continue;
          }
        }

        // Node is ready to execute
        unprocessed.delete(readyNodeKey);
        nodeStatuses.set(readyNodeKey, 'running');

        // Check if node is logic.merge and provide fired incoming sources
        let nodeToExecute = currentNode;
        if (currentNode.type === 'logic.merge') {
          const incoming = (incomingEdgesMap.get(readyNodeKey) || []).filter((e) =>
            reachableNodes.has(e.source)
          );
          const firedIncoming = incoming.filter((e) => edgeStates.get(e.id) === 'fired');
          const inputs: Record<string, Json> = {};
          for (const edge of firedIncoming) {
            inputs[edge.source] = nodeOutputs[edge.source] ?? null;
          }
          nodeToExecute = {
            ...currentNode,
            params: {
              ...currentNode.params,
              _inputs: inputs,
            },
          };
        }

        const retryPolicy = createRetryPolicy(currentNode.retry);
        let attempt = 1;
        let nodeSucceeded = false;
        let finalError: Error | null = null;
        const nodeLogs: string[] = [];
        let paramsResolvedForEvent: Json = null;

        while (!nodeSucceeded) {
          if (signal?.aborted) {
            throw new Error('Execution aborted');
          }

          this.emit({
            type: 'node.started',
            runId,
            nodeKey: readyNodeKey,
            attempt,
            at: Date.now(),
          });

          const runCtx: RunContext = {
            runId,
            triggerPayload,
            signal: signal ?? new AbortController().signal,
            resolve: (template: Json) => {
              const res = ExpressionResolver.resolve(template, {
                nodeOutputs,
                triggerKey,
                triggerPayload,
                currentNodeKey: readyNodeKey,
                currentNodeName: currentNode.name || readyNodeKey,
                strict: true,
                onWarning: (msg) => {
                  nodeLogs.push(`[WARN] ${msg}`);
                },
              });
              return res;
            },
            getSecrets: async (credentialId: string) => {
              if (!this.credentialStore) {
                throw new NodeError(
                  `No credential store available to resolve credential '${credentialId}'.`,
                  false
                );
              }
              return this.credentialStore.get(credentialId);
            },
            log: (level, msg) => {
              nodeLogs.push(`[${level.toUpperCase()}] ${msg}`);
            },
          };

          try {
            // Prune stale or orphaned mappings for sheets.appendRow if _mappingMeta defines the active columns
            if (nodeToExecute.type === 'sheets.appendRow') {
              const p = nodeToExecute.params as Record<string, any>;
              if (
                p._mappingMeta &&
                typeof p._mappingMeta === 'object' &&
                !Array.isArray(p._mappingMeta) &&
                Object.keys(p._mappingMeta).length > 0 &&
                p.values &&
                typeof p.values === 'object' &&
                !Array.isArray(p.values)
              ) {
                const allowedHeaders = new Set(Object.keys(p._mappingMeta));
                const cleanValues: Record<string, any> = {};
                for (const [k, v] of Object.entries(p.values)) {
                  if (allowedHeaders.has(k)) {
                    cleanValues[k] = v;
                  }
                }
                nodeToExecute.params = {
                  ...p,
                  values: cleanValues,
                };
              }
            }

            // Resolve params for tracking
            paramsResolvedForEvent = runCtx.resolve(nodeToExecute.params);

            const result = await currentNodeType.run(nodeToExecute, runCtx);
            nodeSucceeded = true;
            nodeOutputs[readyNodeKey] = result.output;
            nodeStatuses.set(readyNodeKey, 'succeeded');

            this.emit({
              type: 'node.finished',
              runId,
              nodeKey: readyNodeKey,
              status: 'succeeded',
              attempts: attempt,
              paramsResolved: paramsResolvedForEvent,
              output: result.output,
              logs: [...nodeLogs],
              at: Date.now(),
            });

            // Set outgoing edges state based on result.ports
            const outgoing = outgoingEdgesMap.get(readyNodeKey) || [];
            for (const outEdge of outgoing) {
              if (edgeStates.has(outEdge.id)) {
                if (result.ports.includes(outEdge.sourcePort)) {
                  edgeStates.set(outEdge.id, 'fired');
                } else {
                  edgeStates.set(outEdge.id, 'dead');
                }
              }
            }
          } catch (err: any) {
            finalError = err instanceof Error ? err : new Error(String(err));
            const retryable = isRetryableError(err);
            const nextDelay = retryable ? retryPolicy.nextDelay(attempt) : null;

            if (nextDelay !== null) {
              this.emit({
                type: 'node.retrying',
                runId,
                nodeKey: readyNodeKey,
                attempt,
                error: finalError.message,
                nextDelayMs: nextDelay,
              });

              await abortableSleep(nextDelay, signal);
              attempt++;
            } else {
              // Retry attempts exhausted or non-retryable
              break;
            }
          }
        }

        if (!nodeSucceeded) {
          if (signal?.aborted || finalError?.name === 'AbortError' || String(finalError?.message).includes('aborted')) {
            throw new Error('Execution aborted / cancelled by user');
          }

          const errorMessage = finalError?.message ?? 'Node execution failed';
          const onError = currentNode.onError ?? 'stop';

          if (onError === 'continue') {
            // Mark failed in node.finished, but treat as succeeded for scheduling purposes
            nodeStatuses.set(readyNodeKey, 'failed');
            nodeOutputs[readyNodeKey] = {
              error: {
                message: errorMessage,
              },
            };

            this.emit({
              type: 'node.finished',
              runId,
              nodeKey: readyNodeKey,
              status: 'failed',
              attempts: attempt,
              paramsResolved: paramsResolvedForEvent,
              output: nodeOutputs[readyNodeKey],
              error: errorMessage,
              logs: [...nodeLogs],
              at: Date.now(),
            });

            // Activate 'default' port only
            const outgoing = outgoingEdgesMap.get(readyNodeKey) || [];
            for (const outEdge of outgoing) {
              if (edgeStates.has(outEdge.id)) {
                if (outEdge.sourcePort === 'default') {
                  edgeStates.set(outEdge.id, 'fired');
                } else {
                  edgeStates.set(outEdge.id, 'dead');
                }
              }
            }
          } else {
            // onError: stop (default)
            nodeStatuses.set(readyNodeKey, 'failed');

            this.emit({
              type: 'node.finished',
              runId,
              nodeKey: readyNodeKey,
              status: 'failed',
              attempts: attempt,
              paramsResolved: paramsResolvedForEvent,
              error: errorMessage,
              logs: [...nodeLogs],
              at: Date.now(),
            });

            // Mark all remaining unprocessed nodes as skipped
            for (const remainingKey of unprocessed) {
              nodeStatuses.set(remainingKey, 'skipped');
              this.emit({
                type: 'node.finished',
                runId,
                nodeKey: remainingKey,
                status: 'skipped',
                attempts: 0,
                logs: [],
                at: Date.now(),
              });
            }
            unprocessed.clear();

            this.emit({
              type: 'run.finished',
              runId,
              status: 'failed',
              error: errorMessage,
              at: Date.now(),
            });

            return {
              status: 'failed',
              error: errorMessage,
            };
          }
        }
      }

      // All reachable nodes executed
      this.emit({
        type: 'run.finished',
        runId,
        status: 'succeeded',
        at: Date.now(),
      });

      return { status: 'succeeded' };
    } catch (runErr: any) {
      const isAborted =
        signal?.aborted ||
        runErr?.name === 'AbortError' ||
        String(runErr?.message).toLowerCase().includes('aborted');
      const msg = isAborted
        ? 'Execution aborted / cancelled by user'
        : (runErr instanceof Error ? runErr.message : String(runErr));

      // Mark all remaining unprocessed nodes as skipped
      for (const remainingKey of unprocessed) {
        nodeStatuses.set(remainingKey, 'skipped');
        this.emit({
          type: 'node.finished',
          runId,
          nodeKey: remainingKey,
          status: 'skipped',
          attempts: 0,
          logs: [],
          at: Date.now(),
        });
      }

      this.emit({
        type: 'run.finished',
        runId,
        status: 'failed',
        error: msg,
        at: Date.now(),
      });

      return {
        status: 'failed',
        error: msg,
      };
    }
  }
}

