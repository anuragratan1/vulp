import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('First-Time Blank Canvas Experience Contract Tests', () => {
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

  it('creates a fresh scratch workflow with exactly one Manual Trigger node and 0 edges', async () => {
    const triggerKey = `trigger_${Date.now().toString(36)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Untitled Automation 1',
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

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const created = body.workflow;
    expect(created.name).toBe('Untitled Automation 1');
    expect(created.graph.nodes).toHaveLength(1);
    expect(created.graph.edges).toHaveLength(0);
    expect(created.graph.nodes[0].type).toBe('manual.trigger');
    expect(created.graph.nodes[0].name).toBe('Manual Trigger');
  });

  it('connects downstream action step from Manual Trigger and successfully executes', async () => {
    const triggerKey = 'trigger_root';
    const actionKey = 'action_delay';

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Manual Trigger with Action',
        graph: {
          nodes: [
            {
              key: triggerKey,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 140, y: 200 },
              params: { payload: { testMsg: 'Hello VULP' } },
            },
            {
              key: actionKey,
              type: 'logic.delay',
              name: 'Delay Step',
              position: { x: 460, y: 200 },
              params: { durationMs: 10 },
            },
          ],
          edges: [
            {
              id: `e_${triggerKey}_default_to_${actionKey}_input`,
              source: triggerKey,
              sourcePort: 'default',
              target: actionKey,
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const workflow = body.workflow;
    expect(workflow.graph.nodes).toHaveLength(2);
    expect(workflow.graph.edges).toHaveLength(1);
    expect(workflow.graph.edges[0].source).toBe(triggerKey);
    expect(workflow.graph.edges[0].target).toBe(actionKey);

    // Verify execution runs through the manual trigger into the connected action
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {
        triggerPayload: { testMsg: 'Verified Blank Canvas Flow' },
      },
    });

    expect(runRes.statusCode).toBe(202);
    const runBody = JSON.parse(runRes.payload);
    expect(runBody.runId).toBeDefined();

    // Wait briefly for execution to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    const getRunRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${runBody.runId}`,
    });

    expect(getRunRes.statusCode).toBe(200);
    const fetchedRun = JSON.parse(getRunRes.payload);
    expect(fetchedRun.run.workflowId).toBe(workflow.id);
    expect(fetchedRun.run.status).toBe('succeeded');
    expect(fetchedRun.nodeRuns).toHaveLength(2);

    const triggerRun = fetchedRun.nodeRuns.find((nr: any) => nr.nodeKey === triggerKey);
    const actionRun = fetchedRun.nodeRuns.find((nr: any) => nr.nodeKey === actionKey);
    expect(triggerRun?.status).toBe('succeeded');
    expect(triggerRun?.output).toEqual({ testMsg: 'Verified Blank Canvas Flow' });
    expect(actionRun?.status).toBe('succeeded');
  });
});
