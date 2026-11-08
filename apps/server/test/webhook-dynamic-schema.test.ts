import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase, db } from '../src/db/index.js';
import { workflows } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  autoMapFields,
  SourceFieldDefinition,
  ExpressionResolver,
} from '@workflow/engine';

describe('Webhook Dynamic Schema Discovery and Google Sheets Auto-Mapping', () => {
  let app: FastifyInstance;
  let testWorkflowId: string;
  let webhookToken: string;
  const webhookNodeKey = 'wh_trigger_1';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initDatabase();
    app = await createServer();
    await app.ready();

    // 1. Create a workflow with Webhook Trigger -> Echo Action
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Webhook to Google Sheets Pipeline',
        active: false,
        graph: {
          nodes: [
            {
              key: webhookNodeKey,
              type: 'webhook.trigger',
              name: 'Incoming Lead Webhook',
              position: { x: 0, y: 0 },
              params: {
                method: 'POST',
              },
            },
            {
              key: 'sheets_action_1',
              type: 'http.request',
              name: 'Append to Leads Sheet',
              position: { x: 250, y: 0 },
              params: {
                method: 'POST',
                url: 'https://httpbin.org/post',
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: webhookNodeKey,
              sourcePort: 'default',
              target: 'sheets_action_1',
              targetPort: 'input',
            },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const body = JSON.parse(createRes.payload);
    testWorkflowId = body.workflow.id;

    // Retrieve registered webhook token
    const whRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}/webhooks`,
    });
    expect(whRes.statusCode).toBe(200);
    const whBody = JSON.parse(whRes.payload);
    expect(whBody.webhooks.length).toBeGreaterThan(0);
    webhookToken = whBody.webhooks[0].token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('captures sample payload on incoming webhook call even in draft mode', async () => {
    const intendedPayload = {
      leadId: 'LEAD-TEST-002',
      name: 'Alex Morgan',
      email: 'anuragratan2590@gmail.com',
      phone: '+1-555-010-2020',
      score: 96,
      source: 'VULP Integration Test',
    };

    const res = await app.inject({
      method: 'POST',
      url: `/hook/${webhookToken}`,
      payload: intendedPayload,
    });

    // In draft mode, returns 403 with payload captured
    expect(res.statusCode).toBe(403);
    const resBody = JSON.parse(res.payload);
    expect(resBody.error).toBe('Workflow is not active');
    expect(resBody.samplePayload).toEqual(intendedPayload);

    // Verify it was persisted to SQLite workflow graph node params
    const wf = db.select().from(workflows).where(eq(workflows.id, testWorkflowId)).get();
    expect(wf).toBeDefined();
    const graph = typeof wf!.graph === 'string' ? JSON.parse(wf!.graph) : wf!.graph;
    const node = graph.nodes.find((n: any) => n.key === webhookNodeKey);
    expect(node).toBeDefined();
    expect(node.params.samplePayload).toEqual(intendedPayload);
  });

  it('provides dedicated GET and POST endpoints for sample schema inspection and updates', async () => {
    // GET sample
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${testWorkflowId}/webhooks/${webhookNodeKey}/sample`,
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.samplePayload.leadId).toBe('LEAD-TEST-002');
    expect(getBody.samplePayload.score).toBe(96);

    // POST sample update with nested structures
    const customNestedPayload = {
      leadId: 'LEAD-NESTED-999',
      name: 'Sarah Connor',
      email: 'sarah@sky.net',
      phone: '+1-555-444-3322',
      score: 99,
      source: 'Cyberdyne Infiltration',
      customer: {
        company: 'Resistance Ops',
        tier: 'Platinum',
      },
      tags: ['priority', 'hot'],
    };

    const postRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${testWorkflowId}/webhooks/${webhookNodeKey}/sample`,
      payload: {
        samplePayload: customNestedPayload,
      },
    });
    expect(postRes.statusCode).toBe(200);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.samplePayload.customer.tier).toBe('Platinum');
  });

  it('automatically maps all target spreadsheet columns to dynamically discovered webhook fields', () => {
    const targetHeaders = ['Lead ID', 'Name', 'Email', 'Phone', 'Score', 'Source'];

    // Discovered fields from the actual incoming webhook payload
    const dynamicSources: SourceFieldDefinition[] = [
      {
        id: 'wh.body.leadId',
        rawExpression: '{{ trigger.body.leadId }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.leadId',
        label: 'Webhook → Lead Id',
        type: 'string',
        sampleValue: 'LEAD-TEST-002',
      },
      {
        id: 'wh.body.name',
        rawExpression: '{{ trigger.body.name }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.name',
        label: 'Webhook → Name',
        type: 'string',
        sampleValue: 'Alex Morgan',
      },
      {
        id: 'wh.body.email',
        rawExpression: '{{ trigger.body.email }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.email',
        label: 'Webhook → Email',
        type: 'string',
        sampleValue: 'anuragratan2590@gmail.com',
      },
      {
        id: 'wh.body.phone',
        rawExpression: '{{ trigger.body.phone }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.phone',
        label: 'Webhook → Phone',
        type: 'string',
        sampleValue: '+1-555-010-2020',
      },
      {
        id: 'wh.body.score',
        rawExpression: '{{ trigger.body.score }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.score',
        label: 'Webhook → Score',
        type: 'number',
        sampleValue: 96,
      },
      {
        id: 'wh.body.source',
        rawExpression: '{{ trigger.body.source }}',
        nodeKey: 'wh',
        stepName: 'Incoming Lead Webhook',
        path: 'body.source',
        label: 'Webhook → Source',
        type: 'string',
        sampleValue: 'VULP Integration Test',
      },
    ];

    const result = autoMapFields({
      targets: targetHeaders,
      sources: dynamicSources,
      existingValues: {},
      existingMeta: {},
    });

    expect(result.summary.total).toBe(6);
    expect(result.summary.mapped).toBe(6);
    expect(result.summary.autoMapped).toBe(6);
    expect(result.summary.unmapped).toBe(0);
    expect(result.summary.percentageMapped).toBe(100);

    // Verify individual field expressions
    expect(result.mappings['Lead ID']).toBe('{{ trigger.body.leadId }}');
    expect(result.mappings['Name']).toBe('{{ trigger.body.name }}');
    expect(result.mappings['Email']).toBe('{{ trigger.body.email }}');
    expect(result.mappings['Phone']).toBe('{{ trigger.body.phone }}');
    expect(result.mappings['Score']).toBe('{{ trigger.body.score }}');
    expect(result.mappings['Source']).toBe('{{ trigger.body.source }}');
  });

  it('correctly matches arbitrary nested objects and array elements', () => {
    const targets = ['Company', 'Tier', 'Tag'];
    const sources: SourceFieldDefinition[] = [
      {
        id: 'wh.body.customer.company',
        rawExpression: '{{ trigger.body.customer.company }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.customer.company',
        label: 'Customer → Company',
        type: 'string',
        sampleValue: 'Resistance HQ',
      },
      {
        id: 'wh.body.customer.tier',
        rawExpression: '{{ trigger.body.customer.tier }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.customer.tier',
        label: 'Customer → Tier',
        type: 'string',
        sampleValue: 'Platinum',
      },
      {
        id: 'wh.body.tags[0]',
        rawExpression: '{{ trigger.body.tags[0] }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.tags[0]',
        label: 'Tag',
        type: 'string',
        sampleValue: 'priority',
      },
    ];

    const result = autoMapFields({
      targets,
      sources,
      existingValues: {},
      existingMeta: {},
    });

    expect(result.mappings['Company']).toBe('{{ trigger.body.customer.company }}');
    expect(result.mappings['Tier']).toBe('{{ trigger.body.customer.tier }}');
    expect(result.mappings['Tag']).toBe('{{ trigger.body.tags[0] }}');
  });

  it('preserves user manual mappings across schema refresh and re-mapping', () => {
    const targetHeaders = ['Lead ID', 'Name', 'Score', 'Source'];
    const dynamicSources: SourceFieldDefinition[] = [
      {
        id: 'wh.body.leadId',
        rawExpression: '{{ trigger.body.leadId }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.leadId',
        label: 'Lead ID',
        type: 'string',
      },
      {
        id: 'wh.body.name',
        rawExpression: '{{ trigger.body.name }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.name',
        label: 'Name',
        type: 'string',
      },
      {
        id: 'wh.body.score',
        rawExpression: '{{ trigger.body.score }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.score',
        label: 'Score',
        type: 'number',
      },
      {
        id: 'wh.body.source',
        rawExpression: '{{ trigger.body.source }}',
        nodeKey: 'wh',
        stepName: 'Webhook Trigger',
        path: 'body.source',
        label: 'Source',
        type: 'string',
      },
    ];

    // User previously manually wrote custom static text for Source
    const existingValues = {
      Source: 'Custom Inbound Campaign 2026',
    };
    const existingMeta = {
      Source: {
        origin: 'manual' as const,
        value: 'Custom Inbound Campaign 2026',
        userEdited: true,
      },
    };

    // AutoMap should map Lead ID, Name, Score, but preserve Source
    const result = autoMapFields({
      targets: targetHeaders,
      sources: dynamicSources,
      existingValues,
      existingMeta,
      forceRemap: true,
    });

    expect(result.mappings['Lead ID']).toBe('{{ trigger.body.leadId }}');
    expect(result.mappings['Name']).toBe('{{ trigger.body.name }}');
    expect(result.mappings['Score']).toBe('{{ trigger.body.score }}');
    expect(result.mappings['Source']).toBe('Custom Inbound Campaign 2026');
  });

  it('allows advanced arbitrary raw path evaluation during runtime', () => {
    const context = {
      triggerKey: 'wh_1',
      nodeOutputs: {
        wh_1: {
          body: {
            deeply: {
              nested: {
                customField: 'SECRET-TOKEN-XYZ',
              },
            },
          },
        },
      },
    };

    const extracted = ExpressionResolver.resolve(
      '{{ trigger.body.deeply.nested.customField }}',
      context
    );
    expect(extracted).toBe('SECRET-TOKEN-XYZ');
  });
});
