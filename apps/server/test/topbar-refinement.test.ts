import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('Workflow Topbar Refinement & Autosave Contract Tests', () => {
  let app: FastifyInstance;
  let testWorkflowId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initDatabase();
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an initial workflow with default title and graph', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Lead Qualification Pipeline',
        graph: {
          nodes: [
            {
              key: 'wh_1',
              type: 'webhook.trigger',
              name: 'Inbound Webhook',
              position: { x: 100, y: 100 },
              params: { method: 'POST' },
            },
            {
              key: 'http_1',
              type: 'http.request',
              name: 'Enrich Contact',
              position: { x: 300, y: 100 },
              params: { method: 'POST', url: 'https://httpbin.org/post' },
            },
          ],
          edges: [
            { id: 'e1', source: 'wh_1', sourcePort: 'default', target: 'http_1' },
          ],
        },
        active: false,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.workflow).toBeDefined();
    expect(body.workflow.name).toBe('Lead Qualification Pipeline');
    expect(body.workflow.active).toBe(false);
    testWorkflowId = body.workflow.id;
  });

  it('supports inline workflow title renaming with normal and long names', async () => {
    // 1. Rename to short title
    const res1 = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${testWorkflowId}`,
      payload: { name: 'Quick Sync' },
    });
    expect(res1.statusCode).toBe(200);
    const b1 = JSON.parse(res1.payload);
    expect(b1.workflow.name).toBe('Quick Sync');

    // 2. Rename to very long title without breaking
    const veryLongTitle = 'Enterprise Multi-Region Customer Lifecycle & Telemetry Enrichment with Slack, Sheets and BigQuery Sync';
    const res2 = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${testWorkflowId}`,
      payload: { name: veryLongTitle },
    });
    expect(res2.statusCode).toBe(200);
    const b2 = JSON.parse(res2.payload);
    expect(b2.workflow.name).toBe(veryLongTitle);
  });

  it('persists updates across reload (fetches single workflow by id)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.workflow.id).toBe(testWorkflowId);
    expect(body.workflow.name).toContain('Enterprise Multi-Region');
    expect(body.workflow.graph.nodes.length).toBe(2);
  });

  it('publishes workflow and updates activation state independently of save', async () => {
    // Activate workflow
    const activateRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/activate`,
    });
    expect(activateRes.statusCode).toBe(200);
    const actBody = JSON.parse(activateRes.payload);
    expect(actBody.workflow.active).toBe(true);

    // Verify it is active on fetch
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}`,
    });
    expect(JSON.parse(getRes.payload).workflow.active).toBe(true);
  });

  it('allows published workflows to save unsaved edits while remaining published', async () => {
    // Save updated graph while active=true
    const updatedGraph = {
      nodes: [
        {
          key: 'wh_1',
          type: 'webhook.trigger',
          name: 'Inbound Webhook',
          position: { x: 120, y: 150 },
          params: { method: 'POST' },
        },
        {
          key: 'http_1',
          type: 'http.request',
          name: 'Enrich Contact (V2)',
          position: { x: 340, y: 150 },
          params: { method: 'POST', url: 'https://httpbin.org/post' },
        },
      ],
      edges: [
        { id: 'e1', source: 'wh_1', sourcePort: 'default', target: 'http_1' },
      ],
    };

    const saveRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${testWorkflowId}`,
      payload: { graph: updatedGraph },
    });

    expect(saveRes.statusCode).toBe(200);
    const body = JSON.parse(saveRes.payload);
    expect(body.workflow.active).toBe(true); // Must retain published state!
    expect(body.workflow.graph.nodes[1].name).toBe('Enrich Contact (V2)');
  });

  it('handles rapid successive edits cleanly (simulating autosave debounce and concurrency)', async () => {
    const promises = [1, 2, 3, 4, 5].map((i) =>
      app.inject({
        method: 'PUT',
        url: `/api/workflows/${testWorkflowId}`,
        payload: {
          name: `Rapid Edit Title #${i}`,
          graph: {
            nodes: [
              {
                key: 'wh_1',
                type: 'webhook.trigger',
                name: `Webhook ${i}`,
                position: { x: 100 + i * 10, y: 100 },
                params: { method: 'POST' },
              },
            ],
            edges: [],
          },
        },
      })
    );

    const results = await Promise.all(promises);
    for (const r of results) {
      expect(r.statusCode).toBe(200);
    }

    // Verify final state is valid
    const finalRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}`,
    });
    const finalBody = JSON.parse(finalRes.payload);
    expect(finalBody.workflow.name).toMatch(/^Rapid Edit Title #\d$/);
    expect(finalBody.workflow.active).toBe(true);
  });

  it('returns validation error on invalid payload for failed save handling and allows retry', async () => {
    // Missing required field or malformed graph
    const failRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${testWorkflowId}`,
      payload: {
        graph: {
          nodes: 'not-an-array', // Invalid schema
        },
      },
    });

    // Server rejects with error status (e.g. 400 or 500)
    expect(failRes.statusCode).toBeGreaterThanOrEqual(400);

    // Retry with valid payload succeeds
    const retryRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${testWorkflowId}`,
      payload: {
        name: 'Recovered Workflow Title',
      },
    });
    expect(retryRes.statusCode).toBe(200);
    expect(JSON.parse(retryRes.payload).workflow.name).toBe('Recovered Workflow Title');
  });

  it('unpublishes / deactivates workflow correctly', async () => {
    const deactRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/deactivate`,
    });
    expect(deactRes.statusCode).toBe(200);
    const body = JSON.parse(deactRes.payload);
    expect(body.workflow.active).toBe(false);
  });
});
