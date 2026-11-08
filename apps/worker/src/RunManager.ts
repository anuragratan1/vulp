import { nanoid } from 'nanoid';
import { eq, or } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  WorkflowGraph,
  RunEvent,
  IRunObserver,
  GraphValidator,
  Json,
} from '@workflow/engine';
import * as schema from './schema.js';
import { WorkerCredentialVault } from './CredentialVault.js';

export interface StartRunOptions {
  triggerKey?: string;
  triggerPayload?: Json;
  signal?: AbortSignal;
}

export class WorkerRunManager {
  private readonly registry = createDefaultNodeRegistry();

  constructor(
    private readonly db: DrizzleD1Database<typeof schema>,
    private readonly vault: WorkerCredentialVault
  ) {}

  public getRegistry() {
    return this.registry;
  }

  /**
   * Start executing a saved workflow.
   */
  public async startRun(
    workflow: schema.Workflow,
    options: StartRunOptions = {}
  ): Promise<{ runId: string; executionPromise: Promise<void> }> {
    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    // Validate graph using engine validator
    GraphValidator.validate(graph, this.registry);

    // Identify trigger
    let triggerKey = options.triggerKey;
    if (!triggerKey) {
      const triggerNode = graph.nodes.find((n) => {
        const typeDef = this.registry.get(n.type);
        return typeDef?.category === 'trigger';
      });

      if (!triggerNode) {
        throw new Error('Workflow graph has no trigger node.');
      }
      triggerKey = triggerNode.key;
    }

    const selectedTriggerNode = graph.nodes.find((n) => n.key === triggerKey);
    if (!selectedTriggerNode) {
      throw new Error(`Trigger node '${triggerKey}' not found in workflow.`);
    }

    const runId = nanoid();
    const now = Date.now();

    // Persist run record with graph snapshot
    await this.db
      .insert(schema.runs)
      .values({
        id: runId,
        workspaceId: workflow.workspaceId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        triggerType: selectedTriggerNode.type,
        triggerPayload: options.triggerPayload ?? selectedTriggerNode.params?.payload ?? {},
        graphSnapshot: graph,
        status: 'running',
        queuedAt: now,
        startedAt: now,
      });

    const nodeRunStarts = new Map<string, number>();
    let seq = 0;
    const pendingWrites: Promise<any>[] = [];

    const observer: IRunObserver = {
      onEvent: (event: RunEvent) => {
        try {
          if (event.type === 'node.started') {
            nodeRunStarts.set(event.nodeKey, event.at);
          } else if (event.type === 'node.finished') {
            seq++;
            const nodeDef = graph.nodes.find((n) => n.key === event.nodeKey);
            const startedAt = nodeRunStarts.get(event.nodeKey) || event.at;

            const p = this.db
              .insert(schema.nodeRuns)
              .values({
                id: nanoid(),
                runId,
                seq,
                nodeKey: event.nodeKey,
                nodeName: nodeDef?.name || event.nodeKey,
                nodeType: nodeDef?.type || 'unknown',
                status: event.status,
                attempts: event.attempts,
                paramsResolved: event.paramsResolved ?? null,
                output: event.output ?? null,
                error: event.error ?? null,
                logs: event.logs ?? [],
                startedAt,
                finishedAt: event.at,
              })
              .execute()
              .catch((err) => console.error(`[RunManager] Error saving node_run ${event.nodeKey}:`, err));
            pendingWrites.push(p);
          } else if (event.type === 'run.finished') {
            const p = this.db
              .update(schema.runs)
              .set({
                status: event.status,
                error: event.error ?? null,
                finishedAt: event.at,
              })
              .where(eq(schema.runs.id, runId))
              .execute()
              .catch((err) => console.error(`[RunManager] Error updating run ${runId}:`, err));
            pendingWrites.push(p);
          }
        } catch (dbErr) {
          console.error(`[RunManager] Failed to persist event for run ${runId}:`, dbErr);
        }
      },
    };

    const engine = new WorkflowEngine(this.registry, {
      observers: [observer],
      credentials: this.vault,
    });

    const executionPromise = (async () => {
      console.log(`[RunManager] Starting execution for run ${runId} (workflow: ${workflow.id})`);
      try {
        await engine.run(graph, {
          runId,
          triggerKey,
          triggerPayload: options.triggerPayload ?? selectedTriggerNode.params?.payload ?? {},
          signal: options.signal,
        });
        console.log(`[RunManager] Engine execution completed for run ${runId}`);
      } catch (err: any) {
        console.error(`[RunManager] Execution error for run ${runId}:`, err);
        try {
          const failP = this.db
            .update(schema.runs)
            .set({
              status: 'failed',
              error: err?.message || String(err),
              finishedAt: Date.now(),
            })
            .where(eq(schema.runs.id, runId))
            .execute();
          pendingWrites.push(failP);
        } catch (e) {
          console.error('[RunManager] Failed to update run status after engine exception:', e);
        }
      } finally {
        await Promise.allSettled(pendingWrites);
        console.log(`[RunManager] All DB writes successfully settled for run ${runId}`);
      }
    })();

    return { runId, executionPromise };
  }

  public async cancelRun(runId: string): Promise<boolean> {
    const existing = await this.db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .get();

    if (existing && (existing.status === 'running' || existing.status === 'queued')) {
      await this.db
        .update(schema.runs)
        .set({
          status: 'failed',
          error: 'Execution aborted / cancelled by user',
          finishedAt: Date.now(),
        })
        .where(eq(schema.runs.id, runId));

      return true;
    }

    return false;
  }
}
