import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';
import {
  autoMapFields,
  matchTargetField,
  scoreFieldMatch,
  SourceFieldDefinition,
  TargetFieldDefinition,
} from '@workflow/engine';

describe('Intelligent Field Mapping & Execution Integration', () => {
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

  it('correctly derives high-confidence automatic mappings for common spreadsheet columns', () => {
    const upstreamSources: SourceFieldDefinition[] = [
      {
        id: 'manual_trig.name',
        rawExpression: '{{ manual_trig.name }}',
        nodeKey: 'manual_trig',
        stepName: 'Customer Ingestion',
        path: 'name',
        label: 'Customer Name',
        type: 'string',
        sampleValue: 'John Connor',
      },
      {
        id: 'manual_trig.email',
        rawExpression: '{{ manual_trig.email }}',
        nodeKey: 'manual_trig',
        stepName: 'Customer Ingestion',
        path: 'email',
        label: 'Email Address',
        type: 'string',
        sampleValue: 'john@res.org',
      },
      {
        id: 'manual_trig.company',
        rawExpression: '{{ manual_trig.company }}',
        nodeKey: 'manual_trig',
        stepName: 'Customer Ingestion',
        path: 'company',
        label: 'Company / Organization',
        type: 'string',
        sampleValue: 'Resistance HQ',
      },
    ];

    const targetColumns = ['Full Name', 'Contact Email', 'Organization'];

    const result = autoMapFields({
      targets: targetColumns,
      sources: upstreamSources,
    });

    expect(result.mappings['Full Name']).toBe('{{ manual_trig.name }}');
    expect(result.mappings['Contact Email']).toBe('{{ manual_trig.email }}');
    expect(result.mappings['Organization']).toBe('{{ manual_trig.company }}');

    expect(result.summary.total).toBe(3);
    expect(result.summary.mapped).toBe(3);
    expect(result.summary.autoMapped).toBe(3);
    expect(result.summary.unmapped).toBe(0);
    expect(result.validation.valid).toBe(true);
  });

  it('detects ambiguity between first_name and last_name and suggests without silent auto-assignment', () => {
    const competingSources: SourceFieldDefinition[] = [
      {
        id: 'webhook.first_name',
        rawExpression: '{{ webhook.first_name }}',
        nodeKey: 'webhook',
        path: 'first_name',
        label: 'First Name',
      },
      {
        id: 'webhook.last_name',
        rawExpression: '{{ webhook.last_name }}',
        nodeKey: 'webhook',
        path: 'last_name',
        label: 'Last Name',
      },
    ];

    const result = autoMapFields({
      targets: ['Client Name'],
      sources: competingSources,
    });

    // Should NOT be silently assigned
    expect(result.mappings['Client Name']).toBeUndefined();
    const entry = result.entries.find((e) => e.targetKey === 'Client Name');
    expect(entry).toBeDefined();
    expect(entry?.origin).toBe('suggested');
    expect(entry?.confidence).toBe('medium');
    expect(entry?.isAmbiguous).toBe(true);
    expect(entry?.suggestedSource).toBeDefined();
  });

  it('preserves manual overrides across workflow updates and refreshes', async () => {
    // 1. Create a workflow with manual trigger -> sheets appendRow
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Auto-Map Persistence Test',
        graph: {
          nodes: [
            {
              key: 'lead_in',
              type: 'manual.trigger',
              name: 'Lead Trigger',
              params: {
                payload: {
                  customer_name: 'Miles Dyson',
                  work_email: 'mdyson@cyberdyne.com',
                  score: 88,
                },
              },
            },
            {
              key: 'sheets_out',
              type: 'sheets.appendRow',
              name: 'Append Record',
              params: {
                spreadsheetId: 'test_sheet_id_123',
                sheetName: 'Sheet1',
                // User has manually overridden the Email column to a fixed company distribution list
                values: {
                  'Customer Name': '{{ lead_in.customer_name }}',
                  'Email Address': 'leads-archive@cyberdyne.com',
                },
                _mappingMeta: {
                  'Customer Name': { origin: 'auto', value: '{{ lead_in.customer_name }}' },
                  'Email Address': { origin: 'manual', value: 'leads-archive@cyberdyne.com', userEdited: true },
                },
              },
            },
          ],
          edges: [
            { id: 'e1', source: 'lead_in', sourcePort: 'default', target: 'sheets_out' },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdWf = createRes.json().workflow;

    // 2. Fetch the workflow and verify preserved mappings and meta
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${createdWf.id}`,
    });

    expect(fetchRes.statusCode).toBe(200);
    const fetchedWf = fetchRes.json().workflow;
    const sheetsNode = fetchedWf.graph.nodes.find((n: any) => n.key === 'sheets_out');

    expect(sheetsNode.params.values['Customer Name']).toBe('{{ lead_in.customer_name }}');
    expect(sheetsNode.params.values['Email Address']).toBe('leads-archive@cyberdyne.com');
    expect(sheetsNode.params._mappingMeta['Email Address'].origin).toBe('manual');
  });
});
