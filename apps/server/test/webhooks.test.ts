import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { db } from '../src/db/index.js';
import { workflows, webhooks } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Webhook Trigger & Endpoints', () => {
  let app: FastifyInstance;
  let testWorkflowId: string;
  let webhookToken: string;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    if (testWorkflowId) {
      db.delete(workflows).where(eq(workflows.id, testWorkflowId)).run();
    }
    await app.close();
  });

  it('generates a webhook token on workflow creation with webhook.trigger node', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Inbound Customer Lead Webhook',
        active: false,
        graph: {
          nodes: [
            {
              key: 'hook_1',
              type: 'webhook.trigger',
              name: 'Customer Webhook',
              position: { x: 0, y: 0 },
              params: {
                method: 'POST',
              },
            },
            {
              key: 'http_echo',
              type: 'http.request',
              name: 'Echo Service',
              position: { x: 200, y: 0 },
              params: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                body: '{{trigger.body}}',
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'hook_1',
              sourcePort: 'default',
              target: 'http_echo',
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    testWorkflowId = body.workflow.id;

    // Check that webhooks table has an entry for this workflow
    const storedWebhook = db
      .select()
      .from(webhooks)
      .where(eq(webhooks.workflowId, testWorkflowId))
      .get();

    expect(storedWebhook).toBeDefined();
    expect(storedWebhook!.nodeKey).toBe('hook_1');
    expect(storedWebhook!.token.length).toBeGreaterThan(10);
    webhookToken = storedWebhook!.token;
  });

  it('GET /api/workflows/:id/webhooks returns registered webhook URLs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}/webhooks`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.webhooks).toHaveLength(1);
    expect(body.webhooks[0].token).toBe(webhookToken);
    expect(body.webhooks[0].url).toContain(`/hook/${webhookToken}`);
  });

  it('rejects execution with 403 when workflow is inactive', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/hook/${webhookToken}`,
      payload: {
        leadId: 'LEAD-99',
        score: 85,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Workflow is not active');
  });

  it('enforces HTTP method when configured (e.g. 405 on GET if POST is required)', async () => {
    // First activate workflow
    await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/activate`,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/hook/${webhookToken}`,
    });

    expect(res.statusCode).toBe(405);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Method Not Allowed');
  });

  it('accepts incoming webhook payload with 202 and starts run when active', async () => {
    const testPayload = {
      leadId: 'LEAD-101',
      company: 'Acme Corp',
      tier: 'Enterprise',
    };

    const res = await app.inject({
      method: 'POST',
      url: `/hook/${webhookToken}`,
      payload: testPayload,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.runId).toBeDefined();
    expect(body.status).toBe('accepted');

    // Wait briefly for execution initiation and verify run record
    await new Promise((r) => setTimeout(r, 150));

    const runRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${body.runId}`,
    });

    expect(runRes.statusCode).toBe(200);
    const runBody = JSON.parse(runRes.payload);
    expect(runBody.run.triggerType).toBe('webhook.trigger');
    expect(runBody.run.triggerPayload.body).toEqual(testPayload);
  });

  it('returns 404 for unknown webhook token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/hook/non_existent_token_123',
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });
});
