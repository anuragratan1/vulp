import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('Direct Automation Run & Execution Flow (No JSON Modal)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initDatabase();
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes automation immediately using the payload configured in the manual trigger node', async () => {
    const configuredPayload = {
      leadId: 'LEAD-8841',
      customerName: 'Sarah Connor',
      email: 'sarah.c@sky.net',
      score: 98,
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Direct Run Workflow',
        graph: {
          nodes: [
            {
              key: 'trig',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 0, y: 0 },
              params: { payload: configuredPayload },
            },
            {
              key: 'send_email',
              type: 'gmail.sendEmail',
              name: 'Send Customer Email',
              position: { x: 260, y: 0 },
              params: {
                to: '{{ trig.email }}',
                subject: 'Welcome {{ trig.customerName }}',
                body: '<p>Lead score: {{ trig.score }}</p>',
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'trig', sourcePort: 'default', target: 'send_email' },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    // Simulate clicking global "Run" in VULP: passes configured triggerKey and payload directly
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey: 'trig',
        triggerPayload: configuredPayload,
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);
    expect(runId).toBeDefined();

    // Poll until run completes
    let details: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run).toBeDefined();
    // Verify trigger node executed with configured payload
    const triggerRun = details.nodeRuns.find((nr: any) => nr.nodeKey === 'trig');
    expect(triggerRun).toBeDefined();
    expect(triggerRun.status).toBe('succeeded');
    expect(triggerRun.output).toEqual(configuredPayload);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('automatically falls back to node params payload when triggerPayload is omitted in run request', async () => {
    const configuredPayload = {
      orderId: 'ORD-7711',
      customer: 'Alex Murphy',
      amount: 199.95,
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Auto Fallback Payload Run',
        graph: {
          nodes: [
            {
              key: 'trig',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 0, y: 0 },
              params: { payload: configuredPayload },
            },
          ],
          edges: [],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    // Trigger run without passing triggerPayload in request body
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey: 'trig',
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    let details: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run.status).toBe('succeeded');
    const triggerRun = details.nodeRuns.find((nr: any) => nr.nodeKey === 'trig');
    expect(triggerRun.output).toEqual(configuredPayload);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('uses sensible default empty object when manual trigger has no configured payload', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Empty Payload Run',
        graph: {
          nodes: [
            {
              key: 'trig',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 0, y: 0 },
              params: {},
            },
          ],
          edges: [],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey: 'trig',
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    let details: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run.status).toBe('succeeded');
    const triggerRun = details.nodeRuns.find((nr: any) => nr.nodeKey === 'trig');
    expect(triggerRun.output).toEqual({});

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('executes webhook and schedule trigger automations without requiring manual JSON modal input', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Schedule Trigger Workflow',
        graph: {
          nodes: [
            {
              key: 'sched',
              type: 'schedule.trigger',
              name: 'Hourly Schedule',
              position: { x: 0, y: 0 },
              params: { cron: '0 * * * *' },
            },
          ],
          edges: [],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey: 'sched',
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    let details: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run.status).toBe('succeeded');
    const schedRun = details.nodeRuns.find((nr: any) => nr.nodeKey === 'sched');
    expect(schedRun.status).toBe('succeeded');

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('successfully cancels an active workflow execution via POST /api/runs/:runId/cancel', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Cancellable Workflow',
        graph: {
          nodes: [
            {
              key: 'trig',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 0, y: 0 },
              params: { payload: { test: true } },
            },
            {
              key: 'long_delay',
              type: 'logic.delay',
              name: 'Long Delay',
              position: { x: 200, y: 0 },
              params: { durationMs: 5000 },
            },
          ],
          edges: [
            { id: 'e1', source: 'trig', sourcePort: 'default', target: 'long_delay' },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: { triggerKey: 'trig' },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    // Give it 100ms to begin running the delay node
    await new Promise((r) => setTimeout(r, 100));

    // Cancel the run
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/runs/${runId}/cancel`,
    });

    expect(cancelRes.statusCode).toBe(200);
    const cancelBody = JSON.parse(cancelRes.payload);
    expect(cancelBody.success).toBe(true);

    // Verify run snapshot reflects cancellation
    const getRes = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
    const details = JSON.parse(getRes.payload);
    expect(details.run.status).toBe('failed');
    expect(details.run.error).toContain('cancelled by user');

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });
});

