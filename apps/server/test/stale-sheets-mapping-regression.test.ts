import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';
import { db } from '../src/db/index.js';
import { credentials } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Stale Google Sheets Mapping Regression Tests', () => {
  let app: FastifyInstance;
  let testCredId: string;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initDatabase();
    app = await createServer();
    await app.ready();

    // Create test Google OAuth credential via API
    const credRes = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      payload: {
        name: 'Google Sheets Stale Test Account',
        type: 'oauth2',
        service: 'google',
        data: {
          accessToken: 'ya29.test_stale_sheets_token_123',
          refreshToken: 'test_refresh_token',
          email: 'user@test.com',
        },
      },
    });

    const credBody = JSON.parse(credRes.payload);
    testCredId = credBody.credential.id;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (testCredId) {
      db.delete(credentials).where(eq(credentials.id, testCredId)).run();
    }
    await app.close();
  });

  it('successfully executes a workflow even if stored values contains stale createdAt when _mappingMeta has active columns', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/values/') && url.includes(':append')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_stale_test_123',
            updates: {
              updatedRange: 'Sheet1!A2:F2',
              updatedRows: 1,
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          values: [['leadId', 'name', 'email', 'phone', 'score', 'source']],
        }),
      };
    });
    globalThis.fetch = mockFetch;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Stale Mapping Workflow Test',
        graph: {
          nodes: [
            {
              key: 'manual_trigger_1',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 100, y: 100 },
              params: {
                payload: {
                  leadId: 'LEAD-101',
                  name: 'Alice Johnson',
                  email: 'alice@example.com',
                  phone: '+1-555-0199',
                  score: 95,
                  source: 'Inbound Web',
                },
              },
            },
            {
              key: 'sheets_append_1',
              type: 'sheets.appendRow',
              name: 'Google Sheets: Append Row',
              credentialId: testCredId,
              position: { x: 400, y: 100 },
              params: {
                spreadsheetId: 'sheet_stale_test_123',
                sheetName: 'Sheet1',
                // Simulating stale values previously saved in DB containing old defaults
                values: {
                  Name: '{{ $node.trigger.output.name }}',
                  Email: '{{ $node.trigger.output.email }}',
                  Timestamp: '{{ $node.trigger.output.createdAt }}',
                  leadId: '{{ manual_trigger_1.leadId }}',
                  name: '{{ manual_trigger_1.name }}',
                  email: '{{ manual_trigger_1.email }}',
                  phone: '{{ manual_trigger_1.phone }}',
                  score: '{{ manual_trigger_1.score }}',
                  source: '{{ manual_trigger_1.source }}',
                },
                _mappingMeta: {
                  leadId: { origin: 'auto', value: '{{ manual_trigger_1.leadId }}' },
                  name: { origin: 'auto', value: '{{ manual_trigger_1.name }}' },
                  email: { origin: 'auto', value: '{{ manual_trigger_1.email }}' },
                  phone: { origin: 'auto', value: '{{ manual_trigger_1.phone }}' },
                  score: { origin: 'auto', value: '{{ manual_trigger_1.score }}' },
                  source: { origin: 'auto', value: '{{ manual_trigger_1.source }}' },
                },
              },
            },
          ],
          edges: [
            {
              id: 'edge_1',
              source: 'manual_trigger_1',
              sourcePort: 'default',
              target: 'sheets_append_1',
            },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const workflow = JSON.parse(createRes.payload).workflow;

    // Trigger workflow run via API
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {},
    });

    expect(runRes.statusCode).toBe(202);
    const runData = JSON.parse(runRes.payload);
    expect(runData.runId).toBeDefined();

    // Poll run status until finished
    let runStatus = runData.status;
    let finalRun: any = null;
    for (let i = 0; i < 20; i++) {
      const getRunRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runData.runId}`,
      });
      finalRun = JSON.parse(getRunRes.payload).run;
      runStatus = finalRun.status;
      if (runStatus === 'succeeded' || runStatus === 'failed') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    if (runStatus === 'failed') {
      console.error('Run failed with error:', finalRun?.error);
    }
    expect(runStatus).toBe('succeeded');

    // Verify append was called with the 6 active columns and not the stale Timestamp
    const appendCall = mockFetch.mock.calls.find((c: any[]) => c[0].includes(':append'));
    expect(appendCall).toBeDefined();
    const sentBody = JSON.parse(appendCall![1].body);
    expect(sentBody.values[0]).toEqual([
      'LEAD-101',
      'Alice Johnson',
      'alice@example.com',
      '+1-555-0199',
      95,
      'Inbound Web',
    ]);
  });

  it('includes column name when an actual mapped field fails expression resolution', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Invalid Expression Workflow Test',
        graph: {
          nodes: [
            {
              key: 'manual_trigger_2',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 100, y: 100 },
              params: {
                payload: {
                  leadId: 'LEAD-202',
                },
              },
            },
            {
              key: 'sheets_append_2',
              type: 'sheets.appendRow',
              name: 'Google Sheets: Append Row',
              credentialId: testCredId,
              position: { x: 400, y: 100 },
              params: {
                spreadsheetId: 'sheet_stale_test_123',
                sheetName: 'Sheet1',
                values: {
                  score: '{{ manual_trigger_2.nonExistentField }}',
                },
                _mappingMeta: {
                  score: { origin: 'manual', value: '{{ manual_trigger_2.nonExistentField }}' },
                },
              },
            },
          ],
          edges: [
            {
              id: 'edge_2',
              source: 'manual_trigger_2',
              sourcePort: 'default',
              target: 'sheets_append_2',
            },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const workflow = JSON.parse(createRes.payload).workflow;

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {},
    });

    expect(runRes.statusCode).toBe(202);
    const runData = JSON.parse(runRes.payload);

    let finalRun: any = null;
    for (let i = 0; i < 20; i++) {
      const getRunRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runData.runId}`,
      });
      finalRun = JSON.parse(getRunRes.payload).run;
      if (finalRun.status === 'succeeded' || finalRun.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(finalRun.status).toBe('failed');
    expect(finalRun.error).toContain("in column 'score' of step 'Google Sheets: Append Row'");
  });

  it('verifies workflow edit, replacing mapping, removing mapped field, and save/reopen removes stale keys from serialized graph', async () => {
    // 1. Create a workflow with stale values
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Workflow Edit & Serialization Test',
        graph: {
          nodes: [
            {
              key: 'manual_trigger_3',
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 100, y: 100 },
              params: {
                payload: {
                  leadId: 'LEAD-303',
                  name: 'Bob Smith',
                  email: 'bob@example.com',
                },
              },
            },
            {
              key: 'sheets_append_3',
              type: 'sheets.appendRow',
              name: 'Google Sheets: Append Row',
              credentialId: testCredId,
              position: { x: 400, y: 100 },
              params: {
                spreadsheetId: 'sheet_edit_test',
                sheetName: 'Sheet1',
                values: {
                  Timestamp: '{{ $node.trigger.output.createdAt }}',
                  oldField: '{{ manual_trigger_3.old }}',
                  name: '{{ manual_trigger_3.name }}',
                  email: '{{ manual_trigger_3.email }}',
                },
                _mappingMeta: {
                  name: { origin: 'auto', value: '{{ manual_trigger_3.name }}' },
                  email: { origin: 'auto', value: '{{ manual_trigger_3.email }}' },
                },
              },
            },
          ],
          edges: [
            {
              id: 'edge_3',
              source: 'manual_trigger_3',
              sourcePort: 'default',
              target: 'sheets_append_3',
            },
          ],
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const workflow = JSON.parse(createRes.payload).workflow;

    // 2. Fetch the saved workflow (reopen)
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${workflow.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const fetchedWf = JSON.parse(getRes.payload).workflow;

    // 3. User edits mappings: replaces 'name', adds 'leadId', and removes 'email'
    const updatedNodes = fetchedWf.graph.nodes.map((n: any) => {
      if (n.key === 'sheets_append_3') {
        return {
          ...n,
          params: {
            ...n.params,
            values: {
              leadId: '{{ manual_trigger_3.leadId }}',
              name: '{{ manual_trigger_3.name }} - Edited',
            },
            _mappingMeta: {
              leadId: { origin: 'manual', value: '{{ manual_trigger_3.leadId }}' },
              name: { origin: 'manual', value: '{{ manual_trigger_3.name }} - Edited' },
            },
          },
        };
      }
      return n;
    });

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/workflows/${workflow.id}`,
      payload: {
        graph: {
          nodes: updatedNodes,
          edges: fetchedWf.graph.edges,
        },
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // 4. Reopen and verify persisted state
    const reopenRes = await app.inject({
      method: 'GET',
      url: `/api/workflows/${workflow.id}`,
    });
    expect(reopenRes.statusCode).toBe(200);
    const reopenedWf = JSON.parse(reopenRes.payload).workflow;
    const reopenedSheetsNode = reopenedWf.graph.nodes.find((n: any) => n.key === 'sheets_append_3');

    // Must only have the 2 active columns in values and _mappingMeta
    expect(reopenedSheetsNode.params.values).toEqual({
      leadId: '{{ manual_trigger_3.leadId }}',
      name: '{{ manual_trigger_3.name }} - Edited',
    });
    expect(Object.keys(reopenedSheetsNode.params.values)).not.toContain('Timestamp');
    expect(Object.keys(reopenedSheetsNode.params.values)).not.toContain('oldField');
    expect(Object.keys(reopenedSheetsNode.params.values)).not.toContain('email');

    expect(reopenedSheetsNode.params._mappingMeta).toEqual({
      leadId: { origin: 'manual', value: '{{ manual_trigger_3.leadId }}' },
      name: { origin: 'manual', value: '{{ manual_trigger_3.name }} - Edited' },
    });
  });
});
