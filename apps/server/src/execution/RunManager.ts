import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { eq, or, desc, asc } from 'drizzle-orm';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  WorkflowGraph,
  RunEvent,
  IRunObserver,
  GraphValidator,
  Json,
} from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows, runs, nodeRuns, Workflow, Run, NodeRun } from '../db/schema.js';
import { credentialVault } from '../security/CredentialVault.js';

export interface RunEventPayload {
  runId: string;
  event: RunEvent;
}

export class RunManager {
  private readonly emitter = new EventEmitter();
  private readonly registry = createDefaultNodeRegistry();
  private readonly seqCounters = new Map<string, number>();
  private readonly activeControllers = new Map<string, AbortController>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  /**
   * Cleanup any orphaned executions from a previous server process.
   */
  public cleanupOrphanedRuns(): void {
    const now = Date.now();
    try {
      db.update(runs)
        .set({
          status: 'failed',
          error: 'Server restarted during execution',
          finishedAt: now,
        })
        .where(or(eq(runs.status, 'running'), eq(runs.status, 'queued')))
        .run();
    } catch (err) {
      console.error('Failed to cleanup orphaned runs:', err);
    }
  }

  /**
   * Start executing a saved workflow.
   */
  public async startRun(
    workflow: Workflow,
    options: {
      triggerKey?: string;
      triggerPayload?: Json;
    } = {}
  ): Promise<{ runId: string }> {
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
    this.seqCounters.set(runId, 0);

    const controller = new AbortController();
    this.activeControllers.set(runId, controller);

    // Persist run record with graph snapshot
    db.insert(runs)
      .values({
        id: runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        triggerType: selectedTriggerNode.type,
        triggerPayload: options.triggerPayload ?? selectedTriggerNode.params?.payload ?? {},
        graphSnapshot: graph,
        status: 'running',
        queuedAt: now,
        startedAt: now,
      })
      .run();

    // Node tracking map to correlate start/finish timestamps and metadata
    const nodeRunStarts = new Map<string, number>();

    const observer: IRunObserver = {
      onEvent: (event: RunEvent) => {
        // Broadcast to live SSE listeners immediately
        this.emitter.emit(`run:${runId}`, event);

        // Persist to database based on event type
        try {
          if (event.type === 'node.started') {
            nodeRunStarts.set(event.nodeKey, event.at);
          } else if (event.type === 'node.finished') {
            const seq = (this.seqCounters.get(runId) || 0) + 1;
            this.seqCounters.set(runId, seq);

            const nodeDef = graph.nodes.find((n) => n.key === event.nodeKey);
            const startedAt = nodeRunStarts.get(event.nodeKey) || event.at;

            db.insert(nodeRuns)
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
              .run();
          } else if (event.type === 'run.finished') {
            this.activeControllers.delete(runId);
            db.update(runs)
              .set({
                status: event.status,
                error: event.error ?? null,
                finishedAt: event.at,
              })
              .where(eq(runs.id, runId))
              .run();
            this.seqCounters.delete(runId);
          }
        } catch (dbErr) {
          console.error(`Failed to persist event for run ${runId}:`, dbErr);
        }
      },
    };

    const engine = new WorkflowEngine(this.registry, {
      observers: [observer],
      credentials: credentialVault,
    });

    // Execute asynchronously; client receives runId immediately
    setImmediate(async () => {
      try {
        await engine.run(graph, {
          runId,
          triggerKey,
          triggerPayload: options.triggerPayload ?? selectedTriggerNode.params?.payload ?? {},
          signal: controller.signal,
        });
      } catch (err: any) {
        this.activeControllers.delete(runId);
        console.error(`Execution error for run ${runId}:`, err);
        try {
          db.update(runs)
            .set({
              status: 'failed',
              error: err?.message || String(err),
              finishedAt: Date.now(),
            })
            .where(eq(runs.id, runId))
            .run();
        } catch (e) {
          console.error('Failed to update run status after engine exception:', e);
        }
      }
    });

    return { runId };
  }

  /**
   * Cancel an active or queued workflow run.
   */
  public cancelRun(runId: string): boolean {
    const controller = this.activeControllers.get(runId);
    const now = Date.now();

    if (controller) {
      controller.abort();
      this.activeControllers.delete(runId);
      this.seqCounters.delete(runId);

      try {
        db.update(runs)
          .set({
            status: 'failed',
            error: 'Execution aborted / cancelled by user',
            finishedAt: now,
          })
          .where(eq(runs.id, runId))
          .run();
      } catch (dbErr) {
        console.error(`Failed to persist cancel status for run ${runId}:`, dbErr);
      }

      this.emitter.emit(`run:${runId}`, {
        type: 'run.finished',
        runId,
        status: 'failed',
        error: 'Execution aborted / cancelled by user',
        at: now,
      } as RunEvent);

      return true;
    }

    // Fallback: check if DB record is still marked running/queued
    const existing = db.select().from(runs).where(eq(runs.id, runId)).get();
    if (existing && (existing.status === 'running' || existing.status === 'queued')) {
      try {
        db.update(runs)
          .set({
            status: 'failed',
            error: 'Execution aborted / cancelled by user',
            finishedAt: now,
          })
          .where(eq(runs.id, runId))
          .run();

        this.emitter.emit(`run:${runId}`, {
          type: 'run.finished',
          runId,
          status: 'failed',
          error: 'Execution aborted / cancelled by user',
          at: now,
        } as RunEvent);

        return true;
      } catch (dbErr) {
        console.error(`Failed to cancel orphaned run ${runId}:`, dbErr);
      }
    }

    return false;
  }

  /**
   * Subscribe to live events for a given runId.
   */
  public subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  /**
   * Get full execution snapshot from DB.
   */
  public getRunSnapshot(runId: string): { run: Run | undefined; nodeRuns: NodeRun[] } {
    const run = db.select().from(runs).where(eq(runs.id, runId)).get();
    const nodeRunList = db
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.runId, runId))
      .orderBy(asc(nodeRuns.seq))
      .all();

    return { run, nodeRuns: nodeRunList };
  }

  /**
   * List recent runs.
   */
  public listRuns(limit = 50): Run[] {
    return db.select().from(runs).orderBy(desc(runs.queuedAt)).limit(limit).all();
  }

  public getRegistry() {
    return this.registry;
  }
}

export const runManager = new RunManager();

