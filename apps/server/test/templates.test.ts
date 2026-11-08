import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { db } from '../src/db/index.js';
import { workflows, credentials } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { GraphValidator } from '@workflow/engine';
import { runManager } from '../src/execution/RunManager.js';

describe('Workflow Templates & Onboarding APIs', () => {
  let app: FastifyInstance;
  const createdWfIds: string[] = [];
  let testCredId: string;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();

    // Create a mock Telegram credential for testing template activation
    const credRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      payload: {
        name: 'Test Telegram Credential',
        type: 'telegram',
        data: {
          botToken: '123456:ABC-DEF-GHI',
        },
      },
    });
    testCredId = JSON.parse(credRes.payload).credential.id;
  });

  afterAll(async () => {
    for (const id of createdWfIds) {
      db.delete(workflows).where(eq(workflows.id, id)).run();
    }
    if (testCredId) {
      db.delete(credentials).where(eq(credentials.id, testCredId)).run();
    }
    await app.close();
  });

  it('GET /api/templates lists all 5 starter templates with valid graphs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/templates',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBe(5);

    const ids = body.templates.map((t: any) => t.id);
    expect(ids).toContain('template_lead_sheets_gmail');
    expect(ids).toContain('template_form_telegram');
    expect(ids).toContain('template_github_slack');
    expect(ids).toContain('template_scheduled_reminder_gmail');
    expect(ids).toContain('template_sheets_telegram_alert');

    // Verify all template graphs are strictly valid according to engine GraphValidator
    for (const t of body.templates) {
      expect(() => {
        GraphValidator.validate(t.graph, runManager.getRegistry());
      }).not.toThrow();
    }
  });

  it('POST /api/templates/:id/instantiate creates an editable draft workflow from template', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates/template_lead_sheets_gmail/instantiate',
      payload: {
        name: 'My CRM Ingestion Automation',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.workflow).toBeDefined();
    expect(body.workflow.name).toBe('My CRM Ingestion Automation');
    expect(body.workflow.active).toBe(false); // Created as draft/editable
    expect(body.workflow.graph.nodes).toHaveLength(3);

    createdWfIds.push(body.workflow.id);
  });

  it('activating template without configuring required credentials fails with actionable message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates/template_form_telegram/instantiate',
      payload: {},
    });

    const wf = JSON.parse(res.payload).workflow;
    createdWfIds.push(wf.id);

    // Try to activate without credential
    const activateRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${wf.id}`,
      payload: {
        active: true,
      },
    });

    expect(activateRes.statusCode).toBe(400);
    const errBody = JSON.parse(activateRes.payload);
    expect(errBody.error).toBe('Invalid workflow configuration');
    expect(errBody.details).toContain('Telegram');
  });

  it('activating template succeeds once required credentials are configured on integration steps', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates/template_form_telegram/instantiate',
      payload: {},
    });

    const wf = JSON.parse(res.payload).workflow;
    createdWfIds.push(wf.id);

    // Attach valid credential to tg_alert node
    const updatedGraph = { ...wf.graph };
    updatedGraph.nodes = updatedGraph.nodes.map((n: any) => {
      if (n.key === 'tg_alert') {
        return { ...n, credentialId: testCredId };
      }
      return n;
    });

    // Update workflow with credential attached and activate
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${wf.id}`,
      payload: {
        graph: updatedGraph,
        active: true,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = JSON.parse(updateRes.payload);
    expect(body.workflow.active).toBe(true);
  });
});
