import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { schedulerService, SchedulerService } from '../src/services/SchedulerService.js';
import { db } from '../src/db/index.js';
import { workflows } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Scheduled Automation & Scheduler Service', () => {
  let app: FastifyInstance;
  let testWorkflowId: string;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    if (testWorkflowId) {
      schedulerService.unregisterWorkflow(testWorkflowId);
      db.delete(workflows).where(eq(workflows.id, testWorkflowId)).run();
    }
    await app.close();
  });

  it('validates cron expressions correctly', () => {
    expect(SchedulerService.validateCron('* * * * *').valid).toBe(true);
    expect(SchedulerService.validateCron('0 * * * *').valid).toBe(true);
    expect(SchedulerService.validateCron('*/5 * * * *').valid).toBe(true);
    expect(SchedulerService.validateCron('0 9 * * 1-5', 'America/New_York').valid).toBe(true);

    expect(SchedulerService.validateCron('').valid).toBe(false);
    expect(SchedulerService.validateCron('invalid-cron').valid).toBe(false);
    expect(SchedulerService.validateCron('99 99 99 99 99').valid).toBe(false);
  });

  it('rejects activation of a workflow with an invalid cron expression', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Bad Schedule Automation',
        active: false,
        graph: {
          nodes: [
            {
              key: 'sched_bad',
              type: 'schedule.trigger',
              name: 'Bad Cron',
              position: { x: 0, y: 0 },
              params: {
                cron: 'totally-invalid-cron-expr',
              },
            },
          ],
          edges: [],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const badWfId = body.workflow.id;

    const activateRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${badWfId}/activate`,
    });

    expect(activateRes.statusCode).toBe(400);
    const actBody = JSON.parse(activateRes.payload);
    expect(actBody.details).toContain('Invalid cron expression');

    // Clean up
    db.delete(workflows).where(eq(workflows.id, badWfId)).run();
  });

  it('registers in-memory cron job when workflow is activated and cleans up when deactivated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Hourly Cleanup Flow',
        active: false,
        graph: {
          nodes: [
            {
              key: 'sched_1',
              type: 'schedule.trigger',
              name: 'Hourly Trigger',
              position: { x: 0, y: 0 },
              params: {
                cron: '0 * * * *',
                timezone: 'UTC',
              },
            },
            {
              key: 'echo',
              type: 'http.request',
              name: 'Log Schedule',
              position: { x: 200, y: 0 },
              params: {
                method: 'POST',
                url: 'https://httpbin.org/post',
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'sched_1',
              sourcePort: 'default',
              target: 'echo',
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    testWorkflowId = body.workflow.id;

    // Initially inactive: 0 jobs for this workflow
    let jobs = schedulerService.getActiveJobs().filter((j) => j.workflowId === testWorkflowId);
    expect(jobs).toHaveLength(0);

    // Activate workflow
    const actRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/activate`,
    });
    expect(actRes.statusCode).toBe(200);

    // Job should now be registered
    jobs = schedulerService.getActiveJobs().filter((j) => j.workflowId === testWorkflowId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].cronExpression).toBe('0 * * * *');
    expect(jobs[0].timezone).toBe('UTC');
    expect(jobs[0].nextRun).toBeDefined();

    // Deactivate workflow
    const deactRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/deactivate`,
    });
    expect(deactRes.statusCode).toBe(200);

    // Job should be unregistered
    jobs = schedulerService.getActiveJobs().filter((j) => j.workflowId === testWorkflowId);
    expect(jobs).toHaveLength(0);
  });
});

