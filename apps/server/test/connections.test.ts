import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer } from '../src/index.js';
import { db } from '../src/db/index.js';
import { credentials, workflows } from '../src/db/schema.js';
import { encrypt } from '../src/security/crypto.js';
import { FastifyInstance } from 'fastify';

describe('Connections Management & Credential Validation APIs', () => {
  let server: FastifyInstance;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    vi.restoreAllMocks();
    server = await createServer();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await server.close();
  });

  describe('POST /api/connections/validate', () => {
    it('validates Telegram bot token using Telegram getMe endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            id: 123456,
            is_bot: true,
            first_name: 'Vulp Bot',
            username: 'VulpAutomateBot',
          },
        }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/connections/validate',
        payload: {
          type: 'telegram',
          secrets: { botToken: '123456:ABC-DEF-GHI' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.valid).toBe(true);
      expect(body.identifier).toBe('@VulpAutomateBot');
    });

    it('returns error when Telegram bot token is rejected by provider', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: false,
          error_code: 401,
          description: 'Unauthorized: invalid token',
        }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/connections/validate',
        payload: {
          type: 'telegram',
          secrets: { botToken: 'invalid_token' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.valid).toBe(false);
      expect(body.error).toContain('Unauthorized');
    });

    it('validates GitHub Personal Access Token via /user API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          login: 'octocat',
          name: 'The Octocat',
        }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/connections/validate',
        payload: {
          type: 'github',
          secrets: { token: 'ghp_validToken12345' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.valid).toBe(true);
      expect(body.identifier).toBe('@octocat');
    });

    it('validates Slack incoming webhook URL format', async () => {
      const validRes = await server.inject({
        method: 'POST',
        url: '/api/connections/validate',
        payload: {
          type: 'slack',
          secrets: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/X00' },
        },
      });
      expect(JSON.parse(validRes.body).valid).toBe(true);

      const invalidRes = await server.inject({
        method: 'POST',
        url: '/api/connections/validate',
        payload: {
          type: 'slack',
          secrets: { webhookUrl: 'https://evil.com/webhook' },
        },
      });
      expect(JSON.parse(invalidRes.body).valid).toBe(false);
    });
  });

  describe('GET /api/connections & DELETE /api/connections/:id', () => {
    it('returns enriched connections with workflow usage counts', async () => {
      const credId = 'test_conn_' + Date.now();
      db.insert(credentials)
        .values({
          id: credId,
          name: 'Google (test@vulp.io)',
          type: 'google',
          dataEnc: encrypt(JSON.stringify({ email: 'test@vulp.io', accessToken: 'secret' })),
          createdAt: Date.now(),
        })
        .run();

      // Create workflow that uses this credential
      const wfId = 'wf_conn_test_' + Date.now();
      db.insert(workflows)
        .values({
          id: wfId,
          name: 'Lead Routing',
          graph: {
            nodes: [
              {
                key: 'trig',
                type: 'manual.trigger',
                name: 'Start',
                position: { x: 0, y: 0 },
                params: {},
              },
              {
                key: 'send',
                type: 'gmail.sendEmail',
                name: 'Send',
                credentialId: credId,
                position: { x: 100, y: 0 },
                params: { to: 'a@b.com', subject: 'hi', body: 'msg' },
              },
            ],
            edges: [],
          },
          active: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();

      const res = await server.inject({
        method: 'GET',
        url: '/api/connections',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const found = body.connections.find((c: any) => c.id === credId);
      expect(found).toBeDefined();
      expect(found.accountIdentifier).toBe('test@vulp.io');
      expect(found.workflowCount).toBe(1);
      expect(found.workflows[0].name).toBe('Lead Routing');

      // Test delete / disconnect
      const delRes = await server.inject({
        method: 'DELETE',
        url: `/api/connections/${credId}`,
      });
      expect(delRes.statusCode).toBe(200);
    });

    it('fetches Google Sheet column headers dynamically', async () => {
      const credId = `test_conn_headers_${Date.now()}`;
      db.insert(credentials)
        .values({
          id: credId,
          type: 'google',
          name: 'Google (sheets@vulp.io)',
          dataEnc: encrypt(
            JSON.stringify({ accessToken: 'ya29.test_token', email: 'sheets@vulp.io' })
          ),
          createdAt: Date.now(),
        })
        .run();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          values: [['Name', 'Email', 'Company', 'Status', 'Date']],
        }),
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/spreadsheets/sheet_xyz_123/headers?credentialId=${credId}&sheetName=Leads`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.headers).toEqual(['Name', 'Email', 'Company', 'Status', 'Date']);
    });

    it('tests sending a Gmail email directly through POST /api/integrations/google/gmail/test', async () => {
      const credId = `test_gmail_${Date.now()}`;
      db.insert(credentials)
        .values({
          id: credId,
          type: 'google',
          name: 'Google Workspace (alex@vulp.io)',
          dataEnc: encrypt(
            JSON.stringify({ accessToken: 'ya29.test_gmail_token', email: 'alex@vulp.io' })
          ),
          createdAt: Date.now(),
        })
        .run();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'test_msg_id_999',
          threadId: 'test_th_id_999',
        }),
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/gmail/test',
        payload: {
          credentialId: credId,
          to: 'customer@sky.net',
          subject: 'Live test email',
          body: '<p>Hello from Vulp test suite!</p>',
          isHtml: true,
          attachments: [
            {
              name: 'hello.txt',
              content: 'Hello World Attachment',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.result.id).toBe('test_msg_id_999');
      expect(body.result.to).toBe('customer@sky.net');
      expect(body.result.attachmentsCount).toBe(1);
    });

    it('lists files from Google Drive through GET /api/integrations/google/drive/files', async () => {
      const credId = `test_drive_${Date.now()}`;
      db.insert(credentials)
        .values({
          id: credId,
          type: 'google',
          name: 'Google Drive (alex@vulp.io)',
          dataEnc: encrypt(
            JSON.stringify({ accessToken: 'ya29.test_drive_token', email: 'alex@vulp.io' })
          ),
          createdAt: Date.now(),
        })
        .run();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          files: [
            { id: 'f1', name: 'Annual Report 2026.pdf', mimeType: 'application/pdf', size: 1048576 },
            { id: 'f2', name: 'Lead Contacts.csv', mimeType: 'text/csv', size: 4096 },
          ],
        }),
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/drive/files?credentialId=${credId}&query=Report`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.files).toHaveLength(2);
      expect(body.files[0].name).toBe('Annual Report 2026.pdf');
    });
  });
});

