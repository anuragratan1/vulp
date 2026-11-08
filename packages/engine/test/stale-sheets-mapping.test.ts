import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  WorkflowGraph,
  ICredentialStore,
  ExpressionResolver,
  UnresolvedExpressionError,
} from '../src/index.js';

describe('Stale Google Sheets Mapping & Expression Validation Regressions', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockGoogleSecret = 'ya29.test_google_access_token_12345';
  const credentialStore: ICredentialStore = {
    get: async () => ({
      accessToken: mockGoogleSecret,
      email: 'test@vulp.io',
    }),
  };

  const registry = createDefaultNodeRegistry();

  it('ensures sheets.appendRow node definition default has empty values and no stale expressions', () => {
    const nodeDef = registry.get('sheets.appendRow');
    expect(nodeDef).toBeDefined();
    const valuesField = nodeDef!.params.find((p) => p.name === 'values');
    expect(valuesField).toBeDefined();
    expect(valuesField!.default).toEqual({});
  });

  it('executes successfully when values contains stale createdAt if _mappingMeta defines the 6 active columns', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/values/') && url.includes(':append')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_sample_123',
            updates: {
              updatedRange: 'Sheet1!A2:F2',
              updatedRows: 1,
            },
          }),
        };
      }
      // Sheet header retrieval
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

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'manual_trigger_1',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          params: {
            payload: {
              leadId: 'LEAD-MANUAL-001',
              name: 'Anurag Manual Test',
              email: 'anuragratan2590@gmail.com',
              phone: '+91-9000000000',
              score: 99,
              source: 'VULP Manual Integration Test',
            },
          },
        },
        {
          key: 'sheets_append_1',
          type: 'sheets.appendRow',
          name: 'Google Sheets: Append Row',
          credentialId: 'cred_google',
          params: {
            spreadsheetId: 'sheet_sample_123',
            sheetName: 'Sheet1',
            // Stale values containing old defaults (Name, Email, Timestamp with createdAt)
            // along with the 6 active columns
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
            // _mappingMeta defines the 6 active user-configured columns
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
          id: 'e1',
          source: 'manual_trigger_1',
          sourcePort: 'default',
          target: 'sheets_append_1',
        },
      ],
    };

    const engine = new WorkflowEngine(registry, {
      credentials: credentialStore,
    });

    const result = await engine.run(graph, {
      runId: 'test_run_stale_1',
      triggerKey: 'manual_trigger_1',
      triggerPayload: graph.nodes[0].params.payload,
    });

    if (result.status !== 'succeeded') {
      console.log('Test 1 failed with error:', result.error);
    }

    expect(result.status).toBe('succeeded');

    // Verify what was sent to Google Sheets
    const appendCall = mockFetch.mock.calls.find((c: any[]) => c[0].includes(':append'));
    expect(appendCall).toBeDefined();
    const body = JSON.parse(appendCall![1].body);
    // Exactly 6 values mapped to the 6 columns
    expect(body.values[0]).toEqual([
      'LEAD-MANUAL-001',
      'Anurag Manual Test',
      'anuragratan2590@gmail.com',
      '+91-9000000000',
      99,
      'VULP Manual Integration Test',
    ]);
  });

  it('reports the exact column name when expression resolution fails on a mapped column', () => {
    expect(() => {
      ExpressionResolver.resolve(
        {
          values: {
            score: '{{ trigger.nonExistentScore }}',
          },
        },
        {
          nodeOutputs: {
            trigger: { leadId: 'L-1', name: 'Alex' },
          },
          triggerKey: 'trigger',
          currentNodeKey: 'sheets_append',
          currentNodeName: 'Google Sheets: Append Row',
          strict: true,
        }
      );
    }).toThrowError(/Unresolved variable expression.*nonExistentScore.*in column 'score' of step 'Google Sheets: Append Row'/i);
  });

  it('supports backward-compatible expression formats ({{ trigger.name }} and {{ $node.trigger.output.name }})', () => {
    const ctx = {
      nodeOutputs: {
        trigger: { name: 'Sarah Connor', leadId: 'L-101' },
      },
      triggerKey: 'trigger',
      strict: true,
    };

    expect(ExpressionResolver.resolve('{{ trigger.name }}', ctx)).toBe('Sarah Connor');
    expect(ExpressionResolver.resolve('{{ $node.trigger.output.name }}', ctx)).toBe('Sarah Connor');
    expect(ExpressionResolver.resolve('{{ $node.trigger.data.name }}', ctx)).toBe('Sarah Connor');
  });
});
