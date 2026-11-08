import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  WorkflowGraph,
  ICredentialStore,
  NodeError,
  ConfigError,
} from '../src/index.js';

describe('M6 Everyday Integrations: Google Ecosystem', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockGoogleSecret = 'ya29.a0ARedaCtEdGoogleOAuthSecretAccessToken_XYZ987';

  const mockCredentials: Record<string, Record<string, string>> = {
    cred_google_main: {
      accessToken: mockGoogleSecret,
      refreshToken: '1//refresh_token_secret_abcdef',
      email: 'alex@company.com',
    },
  };

  const credentialStore: ICredentialStore = {
    get: async (id: string) => {
      if (mockCredentials[id]) {
        return mockCredentials[id];
      }
      throw new Error(`Credential '${id}' not found`);
    },
  };

  const registry = createDefaultNodeRegistry();

  // ----------------------------------------------------
  // Gmail Send Email Node
  // ----------------------------------------------------
  describe('Gmail Send Email Node', () => {
    it('successfully sends email using OAuth bearer token and returns structured status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'msg_gm_101',
          threadId: 'th_gm_101',
          labelIds: ['SENT'],
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {
              payload: {
                recipient: 'sarah@sky.net',
                leadName: 'Sarah Connor',
              },
            },
          },
          {
            key: 'gmail_send',
            type: 'gmail.sendEmail',
            name: 'Send Welcome Email',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              to: '{{ trigger.recipient }}',
              subject: 'Welcome, {{ trigger.leadName }}!',
              body: 'Thank you for contacting Vulp studio.',
              cc: 'team@company.com',
              isHtml: false,
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_send' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_gm_1', triggerKey: 'trig', triggerPayload: { recipient: 'sarah@sky.net', leadName: 'Sarah Connor' } });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [callUrl, callOptions] = mockFetch.mock.calls[0];
      expect(callUrl).toContain('gmail.googleapis.com/gmail/v1/users/me/messages/send');
      expect(callOptions.headers.get('Authorization')).toBe(`Bearer ${mockGoogleSecret}`);

      const bodyObj = JSON.parse(callOptions.body);
      expect(bodyObj.raw).toBeDefined();

      const decodedRaw = Buffer.from(bodyObj.raw, 'base64').toString('utf-8');
      expect(decodedRaw).toContain('To: sarah@sky.net');
      expect(decodedRaw).toContain('Cc: team@company.com');
      expect(decodedRaw).toContain('Subject: =?utf-8?B?');
    });

    it('successfully sends email with multipart attachments, replyTo and custom senderName', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('gmail.googleapis.com')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              id: 'msg_gm_multipart_202',
              threadId: 'th_gm_multipart_202',
            }),
          };
        }
        if (url.includes('example.com/invoice.pdf')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/pdf' }),
            arrayBuffer: async () => Buffer.from('%PDF-1.4 mock pdf data'),
          };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gmail_multipart',
            type: 'gmail.sendEmail',
            name: 'Send Attached Invoice',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              to: 'john.doe@company.com',
              subject: 'Your Invoice #INV-9021',
              body: '<h1>Invoice Ready</h1><p>Please find attached invoice.</p>',
              isHtml: true,
              senderName: 'Vulp Billing',
              replyTo: 'billing@vulp.io',
              attachments: [
                {
                  name: 'terms.txt',
                  content: 'Payment terms: net 30 days.',
                  mimeType: 'text/plain',
                },
                {
                  name: 'invoice.pdf',
                  url: 'https://example.com/invoice.pdf',
                },
              ],
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_multipart' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_gm_multipart', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      const gmailCall = mockFetch.mock.calls.find(([u]) => String(u).includes('gmail.googleapis.com'));
      expect(gmailCall).toBeDefined();

      const bodyObj = JSON.parse(gmailCall[1].body);
      const decodedRaw = Buffer.from(bodyObj.raw, 'base64').toString('utf-8');

      expect(decodedRaw).toContain('To: john.doe@company.com');
      expect(decodedRaw).toContain('Reply-To: billing@vulp.io');
      expect(decodedRaw).toContain('From: =?utf-8?B?');
      expect(decodedRaw).toContain('Content-Type: multipart/mixed; boundary=');
      expect(decodedRaw).toContain('Content-Disposition: attachment; filename="=?utf-8?B?');
      expect(decodedRaw).toContain(Buffer.from('Payment terms: net 30 days.').toString('base64'));
      expect(decodedRaw).toContain(Buffer.from('%PDF-1.4 mock pdf data').toString('base64'));
    });

    it('rejects attachments when total size exceeds 25MB limit', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const largeBase64 = Buffer.alloc(26 * 1024 * 1024, 'a').toString('base64');

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gmail_huge',
            type: 'gmail.sendEmail',
            name: 'Send Huge Attachment',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              to: 'john.doe@company.com',
              subject: 'Huge file',
              body: 'See attachment',
              attachments: [
                {
                  name: 'huge.bin',
                  content: largeBase64,
                  encoding: 'base64',
                },
              ],
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_huge' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_gm_huge', triggerKey: 'trig' });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Attachments exceed Gmail\'s 25MB total limit');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles 401 unauthorized session expiry as non-retryable error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 401,
            message: 'Invalid Credentials',
            status: 'UNAUTHENTICATED',
          },
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gmail_fail',
            type: 'gmail.sendEmail',
            name: 'Send Email',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              to: 'test@example.com',
              subject: 'Test',
              body: 'Test body',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_fail' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_gm_fail', triggerKey: 'trig' });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('authorization expired or invalid (401)');
      expect(mockFetch).toHaveBeenCalledTimes(1); // non-retryable
    });
  });

  // ----------------------------------------------------
  // Google Sheets Read & Append Nodes
  // ----------------------------------------------------
  describe('Google Sheets Nodes', () => {
    it('reads rows with header mapping into structured objects', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          range: 'Sheet1!A1:C3',
          majorDimension: 'ROWS',
          values: [
            ['Name', 'Email', 'Status'],
            ['Alice Smith', 'alice@sky.net', 'Qualified'],
            ['Bob Vance', 'bob@vance.com', 'Pending'],
          ],
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'sheets_read',
            type: 'sheets.readRows',
            name: 'Read Leads',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              spreadsheetId: 'sheet_id_abc123',
              sheetName: 'Sheet1',
              hasHeaders: true,
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'sheets_read' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_sh_read', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('spreadsheets/sheet_id_abc123/values/Sheet1');
    });

    it('appends row with dynamic column header matching', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (opts.method === 'GET') {
          // Header read
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              values: [['Full Name', 'Email Address', 'Source']],
            }),
          };
        }
        // Append POST
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_id_abc123',
            updates: {
              updatedRange: 'Sheet1!A4:C4',
              updatedRows: 1,
            },
          }),
        };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'sheets_append',
            type: 'sheets.appendRow',
            name: 'Append Lead',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              spreadsheetId: 'sheet_id_abc123',
              sheetName: 'Sheet1',
              values: {
                'Email Address': 'clark@kent.com',
                'Full Name': 'Clark Kent',
                Source: 'Website Form',
              },
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'sheets_append' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_sh_append', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      // Checked headers and then appended
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const appendCall = mockFetch.mock.calls[1];
      const appendPayload = JSON.parse(appendCall[1].body);
      // Verify column order matched headers: Full Name, Email Address, Source
      expect(appendPayload.values[0]).toEqual(['Clark Kent', 'clark@kent.com', 'Website Form']);
    });

    it('appends row with direct array values correctly', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_array_123',
            updates: { updatedRange: 'Sheet1!A2:C2', updatedRows: 1 },
          }),
        };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          { key: 'trig', type: 'manual.trigger', name: 'Start', position: { x: 0, y: 0 }, params: {} },
          {
            key: 'sheets_append',
            type: 'sheets.appendRow',
            name: 'Append Array',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              spreadsheetId: 'sheet_array_123',
              sheetName: 'Sheet1',
              values: ['John Doe', 'john@example.com', 42, true],
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'sheets_append' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_sh_array', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const appendCall = mockFetch.mock.calls[0];
      const appendPayload = JSON.parse(appendCall[1].body);
      expect(appendPayload).toEqual({
        values: [['John Doe', 'john@example.com', 42, true]],
      });
    });

    it('handles case-insensitive header matching, expression resolution, and missing values', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (opts?.method === 'GET' || url.includes('%211%3A1') || url.includes('!1:1')) {
          // Headers row
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              values: [['Name', 'Email Address', 'Company', 'MissingField', 'Score']],
            }),
          };
        }
        // Append POST
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_expr_123',
            updates: { updatedRange: 'Sheet1!A5:E5', updatedRows: 1 },
          }),
        };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Webhook Trigger',
            position: { x: 0, y: 0 },
            params: {
              payload: {
                name: 'Bruce Wayne',
                email: 'bruce@wayne.corp',
                company: 'Wayne Enterprises',
                score: 100,
              },
            },
          },
          {
            key: 'sheets_append',
            type: 'sheets.appendRow',
            name: 'Append Lead',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              spreadsheetId: 'sheet_expr_123',
              sheetName: 'Sheet1',
              values: {
                // 'Name' matches 'Name'
                Name: '{{ trigger.name }}',
                // 'email_address' matches 'Email Address' normalized
                email_address: '{{ trigger.email }}',
                // 'company' matches 'Company' case-insensitively
                company: '{{ trigger.company }}',
                // 'MissingField' is omitted in values -> should resolve to ""
                // 'score' matches 'Score'
                score: '{{ trigger.score }}',
              },
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'sheets_append' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run_sh_expr',
        triggerKey: 'trig',
        triggerPayload: {
          name: 'Bruce Wayne',
          email: 'bruce@wayne.corp',
          company: 'Wayne Enterprises',
          score: 100,
        },
      });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const appendCall = mockFetch.mock.calls[1];
      const appendPayload = JSON.parse(appendCall[1].body);

      // Verify exact structure: exactly 1 row, cleanly mapped cells, missing field is ""
      expect(appendPayload.values).toHaveLength(1);
      expect(appendPayload.values[0]).toEqual([
        'Bruce Wayne',
        'bruce@wayne.corp',
        'Wayne Enterprises',
        '', // MissingField resolved to empty string
        100,
      ]);
    });

    it('handles stringified JSON values without creating JSON fragments', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (opts?.method === 'GET' || url.includes('%211%3A1') || url.includes('!1:1')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              values: [['First', 'Last', 'Age']],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            spreadsheetId: 'sheet_json_str',
            updates: { updatedRange: 'Sheet1!A3:C3', updatedRows: 1 },
          }),
        };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          { key: 'trig', type: 'manual.trigger', name: 'Start', position: { x: 0, y: 0 }, params: {} },
          {
            key: 'sheets_append',
            type: 'sheets.appendRow',
            name: 'Append JSON String',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              spreadsheetId: 'sheet_json_str',
              sheetName: 'Sheet1',
              // Stringified JSON object
              values: JSON.stringify({ First: 'Tony', Last: 'Stark', Age: 48 }),
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'sheets_append' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_sh_str', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      const appendCall = mockFetch.mock.calls[1];
      const appendPayload = JSON.parse(appendCall[1].body);

      // Verify mapped by column header without dumping JSON fragments into cells
      expect(appendPayload.values[0]).toEqual(['Tony', 'Stark', 48]);
    });
  });

  // ----------------------------------------------------
  // Google Drive & Calendar Nodes
  // ----------------------------------------------------
  describe('Google Drive & Calendar Nodes', () => {
    it('uploads file to Drive and returns metadata', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'drive_file_999',
          name: 'report.txt',
          mimeType: 'text/plain',
          webViewLink: 'https://drive.google.com/file/d/drive_file_999/view',
          size: '128',
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'drive_upload',
            type: 'drive.uploadFile',
            name: 'Upload Report',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              fileName: 'summary_report.txt',
              content: 'Execution completed without errors.',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'drive_upload' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_dr_upload', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('upload/drive/v3/files?uploadType=multipart');
      expect(opts.headers.get('Content-Type')).toContain('multipart/related');
    });

    it('creates Google Calendar event with attendees and timezone', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'cal_event_888',
          summary: 'Client Review Meeting',
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com/event?eid=888',
          start: { dateTime: '2026-11-06T14:00:00Z', timeZone: 'America/New_York' },
          end: { dateTime: '2026-11-06T15:00:00Z', timeZone: 'America/New_York' },
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'cal_create',
            type: 'calendar.createEvent',
            name: 'Schedule Sync',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              summary: 'Client Review Meeting',
              startTime: '2026-11-06T14:00:00Z',
              endTime: '2026-11-06T15:00:00Z',
              timeZone: 'America/New_York',
              attendees: 'alex@company.com, client@partner.org',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'cal_create' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, { runId: 'run_cal_create', triggerKey: 'trig' });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('calendar/v3/calendars/primary/events');

      const parsedBody = JSON.parse(opts.body);
      expect(parsedBody.summary).toBe('Client Review Meeting');
      expect(parsedBody.attendees).toEqual([
        { email: 'alex@company.com' },
        { email: 'client@partner.org' },
      ]);
    });
  });

  // ----------------------------------------------------
  // Secret Redaction
  // ----------------------------------------------------
  describe('Secret Redaction on Google Integrations', () => {
    it('redacts Google OAuth access token from output and execution logs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'msg_redact_1',
          threadId: 'th_redact_1',
          leakToken: mockGoogleSecret, // Simulate API echoing token back
        }),
      });
      globalThis.fetch = mockFetch;

      let capturedOutput: any = null;
      let capturedLogs: string[] = [];

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gmail_redact',
            type: 'gmail.sendEmail',
            name: 'Send Email',
            position: { x: 200, y: 0 },
            credentialId: 'cred_google_main',
            params: {
              to: 'safe@example.com',
              subject: 'Safety Test',
              body: `Logging with secret: ${mockGoogleSecret}`,
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gmail_redact' }],
      };

      const engine = new WorkflowEngine(registry, {
        credentials: credentialStore,
        observers: [
          {
            onEvent: (event) => {
              if (event.type === 'node.finished' && event.nodeKey === 'gmail_redact') {
                capturedOutput = event.output;
                capturedLogs = event.logs || [];
              }
            },
          },
        ],
      });

      const result = await engine.run(graph, { runId: 'run_gm_redact', triggerKey: 'trig' });
      expect(result.status).toBe('succeeded');

      const outputStr = JSON.stringify(capturedOutput);
      expect(outputStr).not.toContain(mockGoogleSecret);

      const logsStr = JSON.stringify(capturedLogs);
      expect(logsStr).not.toContain(mockGoogleSecret);
    });
  });
});
