import { Cron } from 'croner';
import { WorkflowGraph } from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows, Workflow } from '../db/schema.js';
import { runManager } from '../execution/RunManager.js';
import { eq } from 'drizzle-orm';

export interface ScheduleJobInfo {
  jobKey: string;
  workflowId: string;
  nodeKey: string;
  cronExpression: string;
  timezone: string;
  nextRun?: string | null;
}

export class SchedulerService {
  private jobs = new Map<string, { cron: Cron; info: ScheduleJobInfo }>();

  /**
   * Validate a cron expression and optional timezone.
   */
  public static validateCron(
    expression: string,
    timezone = 'UTC'
  ): { valid: boolean; error?: string } {
    if (!expression || !expression.trim()) {
      return { valid: false, error: 'Cron expression cannot be empty' };
    }

    try {
      new Cron(expression.trim(), { timezone });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Invalid cron expression' };
    }
  }

  /**
   * Register scheduled triggers for an active workflow.
   */
  public registerWorkflow(workflow: Workflow): void {
    // If workflow is not active, unregister any existing jobs and exit
    if (!workflow.active) {
      this.unregisterWorkflow(workflow.id);
      return;
    }

    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    const scheduleNodes = (graph?.nodes || []).filter((n) => n.type === 'schedule.trigger');

    // First, unregister any removed schedule nodes for this workflow
    const currentKeys = new Set(scheduleNodes.map((n) => `${workflow.id}:${n.key}`));
    for (const [key, job] of this.jobs.entries()) {
      if (job.info.workflowId === workflow.id && !currentKeys.has(key)) {
        job.cron.stop();
        this.jobs.delete(key);
      }
    }

    // Register or update each schedule node
    for (const node of scheduleNodes) {
      const jobKey = `${workflow.id}:${node.key}`;
      const cronExpr = String(node.params?.cron || '0 * * * *').trim();
      const timezone = String(node.params?.timezone || 'UTC').trim();

      const validation = SchedulerService.validateCron(cronExpr, timezone);
      if (!validation.valid) {
        console.warn(
          `[Scheduler] Skipping invalid cron expression '${cronExpr}' for node '${node.key}' in workflow '${workflow.id}': ${validation.error}`
        );
        continue;
      }

      // If job already exists with same schedule, skip re-registering to avoid resets
      const existing = this.jobs.get(jobKey);
      if (
        existing &&
        existing.info.cronExpression === cronExpr &&
        existing.info.timezone === timezone
      ) {
        continue;
      }

      // Stop previous instance if exists
      if (existing) {
        existing.cron.stop();
        this.jobs.delete(jobKey);
      }

      try {
        const cron = new Cron(
          cronExpr,
          {
            timezone,
            protect: true, // Prevents duplicate concurrent executions if execution is still running
          },
          async () => {
            const scheduledTime = new Date().toISOString();
            console.log(
              `[Scheduler] Firing scheduled job '${jobKey}' for workflow '${workflow.name}' at ${scheduledTime}`
            );

            // Fetch the freshest workflow version from DB to ensure it is still active
            const freshWf = db.select().from(workflows).where(eq(workflows.id, workflow.id)).get();
            if (!freshWf || !freshWf.active) {
              console.log(`[Scheduler] Workflow '${workflow.id}' is no longer active; stopping job.`);
              this.unregisterWorkflow(workflow.id);
              return;
            }

            try {
              await runManager.startRun(freshWf, {
                triggerKey: node.key,
                triggerPayload: {
                  scheduledTime,
                  cron: cronExpr,
                  timezone,
                },
              });
            } catch (runErr) {
              console.error(`[Scheduler] Execution trigger failed for job '${jobKey}':`, runErr);
            }
          }
        );

        const nextRun = cron.nextRun()?.toISOString() ?? null;

        this.jobs.set(jobKey, {
          cron,
          info: {
            jobKey,
            workflowId: workflow.id,
            nodeKey: node.key,
            cronExpression: cronExpr,
            timezone,
            nextRun,
          },
        });

        console.log(
          `[Scheduler] Registered job '${jobKey}' (${cronExpr}, ${timezone}). Next run: ${nextRun}`
        );
      } catch (cronErr) {
        console.error(`[Scheduler] Failed to initialize cron for job '${jobKey}':`, cronErr);
      }
    }
  }

  /**
   * Stop and unregister all scheduled triggers across all workflows.
   */
  public stopAll(): void {
    for (const job of this.jobs.values()) {
      job.cron.stop();
    }
    this.jobs.clear();
    console.log('[Scheduler] All scheduled jobs stopped.');
  }

  /**
   * Stop and unregister all scheduled triggers for a workflow.
   */
  public unregisterWorkflow(workflowId: string): void {
    for (const [key, job] of this.jobs.entries()) {
      if (job.info.workflowId === workflowId) {
        job.cron.stop();
        this.jobs.delete(key);
        console.log(`[Scheduler] Stopped and unregistered job '${key}'`);
      }
    }
  }

  /**
   * Resynchronize all active workflows from database.
   * Called on server startup.
   */
  public resyncAllActive(): void {
    // Clear all existing jobs
    for (const job of this.jobs.values()) {
      job.cron.stop();
    }
    this.jobs.clear();

    const activeWorkflows = db.select().from(workflows).where(eq(workflows.active, true)).all();

    for (const wf of activeWorkflows) {
      this.registerWorkflow(wf);
    }

    console.log(
      `[Scheduler] Resynced active workflows on boot. Total active schedule jobs: ${this.jobs.size}`
    );
  }

  /**
   * Get active schedule jobs list (useful for monitoring/testing).
   */
  public getActiveJobs(): ScheduleJobInfo[] {
    return Array.from(this.jobs.values()).map((j) => ({
      ...j.info,
      nextRun: j.cron.nextRun()?.toISOString() ?? null,
    }));
  }
}

export const schedulerService = new SchedulerService();

