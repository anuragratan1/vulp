import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('Server Backend APIs (M2/M3)', () => {
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

  it('GET /health responds with 200 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
  });

  it('GET /api/node-types returns all built-in node types including integrations', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/node-types' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.nodeTypes).toBeDefined();
    const types = body.nodeTypes.map((n: any) => n.type);
    expect(types).toContain('manual.trigger');
    expect(types).toContain('webhook.trigger');
    expect(types).toContain('schedule.trigger');
    expect(types).toContain('http.request');
    expect(types).toContain('logic.if');
    expect(types).toContain('logic.merge');
    expect(types).toContain('logic.delay');
    expect(types).toContain('telegram.sendMessage');
    expect(types).toContain('slack.postMessage');
    expect(types).toContain('github.createIssue');
    expect(types).toContain('gmail.sendEmail');
    expect(types).toContain('sheets.readRows');
    expect(types).toContain('sheets.appendRow');
    expect(types).toContain('drive.uploadFile');
    expect(types).toContain('calendar.createEvent');
  });

  let createdWorkflowId: string;

  it('POST /api/workflows creates a new workflow', async () => {
    const payload = {
      name: 'Customer Onboarding Flow',
      graph: {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Manual Trigger',
            position: { x: 100, y: 100 },
            params: { payload: { userId: 'u_123', plan: 'pro' } },
          },
          {
            key: 'delay_1',
            type: 'logic.delay',
            name: 'Short Delay',
            position: { x: 300, y: 100 },
            params: { durationMs: 20 },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'trig',
            sourcePort: 'default',
            target: 'delay_1',
          },
        ],
      },
      active: true,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.workflow).toBeDefined();
    expect(body.workflow.name).toBe('Customer Onboarding Flow');
    expect(body.workflow.id).toBeDefined();
    createdWorkflowId = body.workflow.id;
  });

  it('GET /api/workflows lists created workflows', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workflows' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.workflows)).toBe(true);
    expect(body.workflows.some((w: any) => w.id === createdWorkflowId)).toBe(true);
  });

  it('GET /api/workflows/:id retrieves single workflow', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workflows/${createdWorkflowId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.workflow.id).toBe(createdWorkflowId);
    expect(body.workflow.name).toBe('Customer Onboarding Flow');
  });

  it('PUT /api/workflows/:id updates workflow name', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${createdWorkflowId}`,
      payload: { name: 'Customer Onboarding Flow (Updated)' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.workflow.name).toBe('Customer Onboarding Flow (Updated)');
  });

  let runId: string;

  it('POST /api/workflows/:id/run triggers execution', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/workflows/${createdWorkflowId}/run`,
      payload: { triggerPayload: { testUser: 'Ada Lovelace' } },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.runId).toBeDefined();
    runId = body.runId;
  });

  it('GET /api/runs/:runId retrieves execution details and node runs', async () => {
    // Wait briefly for execution to finish
    await new Promise((resolve) => setTimeout(resolve, 150));

    const res = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.run).toBeDefined();
    expect(body.run.id).toBe(runId);
    expect(body.run.status).toBe('succeeded');
    expect(Array.isArray(body.nodeRuns)).toBe(true);
    expect(body.nodeRuns.length).toBe(2);
    expect(body.nodeRuns.map((n: any) => n.nodeKey)).toContain('trig');
    expect(body.nodeRuns.map((n: any) => n.nodeKey)).toContain('delay_1');
  });

  it('DELETE /api/workflows/:id deletes workflow and cascades', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/workflows/${createdWorkflowId}`,
    });

    expect(res.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${createdWorkflowId}`,
    });
    expect(getRes.statusCode).toBe(404);
  });
});

