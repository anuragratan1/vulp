import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('Manual Trigger Preset Synchronization and Execution Tests', () => {
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

  it('updates manual trigger node with preset data and verifies payload persistence', async () => {
    const triggerKey = 'manual_lead_trigger';
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Preset Sync Workflow',
        graph: {
          nodes: [
            {
              key: triggerKey,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 140, y: 200 },
              params: { payload: {} },
            },
          ],
          edges: [],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const workflow = JSON.parse(createRes.payload).workflow;

    // Apply "New Customer Lead" preset payload
    const leadPreset = {
      leadId: 'LEAD-501',
      email: 'sarah.c@sky.net',
      name: 'Sarah Connor',
      score: 92,
    };

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflow.id}`,
      payload: {
        graph: {
          nodes: [
            {
              key: triggerKey,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 140, y: 200 },
              params: { payload: leadPreset },
            },
          ],
          edges: [],
        },
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.payload).workflow;
    expect(updated.graph.nodes[0].params.payload).toEqual(leadPreset);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('executes manual trigger step test using persisted preset payload', async () => {
    const triggerKey = 'manual_order_trigger';
    const orderPreset = {
      orderId: 'ORD-9921',
      customer: 'Alex Murphy',
      amount: 249.99,
      status: 'paid',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Order Preset Test',
        graph: {
          nodes: [
            {
              key: triggerKey,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 100, y: 100 },
              params: { payload: orderPreset },
            },
          ],
          edges: [],
        },
      },
    });

    const workflow = JSON.parse(createRes.payload).workflow;

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey,
        triggerPayload: orderPreset,
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);
    expect(runId).toBeDefined();

    // Poll for run completion
    let details: any;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runId}`,
      });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run.status).toBe('succeeded');
    expect(details.nodeRuns).toHaveLength(1);
    expect(details.nodeRuns[0].nodeKey).toBe(triggerKey);
    expect(details.nodeRuns[0].status).toBe('succeeded');
    expect(details.nodeRuns[0].output).toEqual(orderPreset);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });

  it('runs manual trigger with dynamically updated runtime User Signup preset payload', async () => {
    const triggerKey = 'manual_signup_trigger';
    const initialPreset = {
      leadId: 'LEAD-100',
    };
    const signupPreset = {
      userId: 'usr_882',
      email: 'elena@example.com',
      plan: 'pro',
      team: 'Engineering',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Signup Preset Override Test',
        graph: {
          nodes: [
            {
              key: triggerKey,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 100, y: 100 },
              params: { payload: initialPreset },
            },
          ],
          edges: [],
        },
      },
    });

    const workflow = JSON.parse(createRes.payload).workflow;

    // Execute passing the updated User Signup preset in triggerPayload
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerKey,
        triggerPayload: signupPreset,
      },
    });

    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    let details: any;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runId}`,
      });
      details = JSON.parse(getRes.payload);
      if (details.run?.status !== 'running') break;
    }

    expect(details.run.status).toBe('succeeded');
    expect(details.nodeRuns[0].output).toEqual(signupPreset);

    // Clean up
    await app.inject({ method: 'DELETE', url: `/api/workflows/${workflow.id}` });
  });
});

