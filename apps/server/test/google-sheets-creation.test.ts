import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createServer } from '../src/index.js';
import { db, initDatabase } from '../src/db/index.js';
import { credentials } from '../src/db/schema.js';
import { encrypt } from '../src/security/crypto.js';

describe('Google Sheets Native Spreadsheet Creation & Management APIs', () => {
  let server: FastifyInstance;
  const originalFetch = globalThis.fetch;
  const testCredId = 'test_google_cred_123';

  beforeEach(async () => {
    vi.restoreAllMocks();
    initDatabase();

    // Insert or update mock Google credential specifically
    try {
      db.delete(credentials).where(eq(credentials.id, testCredId)).run();
    } catch {}

    db.insert(credentials).values({
      id: testCredId,
      name: 'Google (test@vulp.io)',
      type: 'google',
      dataEnc: encrypt(JSON.stringify({
        accessToken: 'mock_google_access_token',
        refreshToken: 'mock_google_refresh_token',
        expiresAt: Date.now() + 3600000,
        email: 'test@vulp.io',
      })),
      createdAt: Date.now(),
    }).run();

    server = await createServer();
    await server.ready();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await server.close();
  });

  describe('GET /api/integrations/google/spreadsheets', () => {
    it('returns 400 when credentialId is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/integrations/google/spreadsheets',
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('credentialId');
    });

    it('returns 404 when credentialId is not found', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/integrations/google/spreadsheets?credentialId=non_existent_id',
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('Credential not found');
    });

    it('successfully queries and returns spreadsheet files', async () => {
      const mockResult = {
        files: [
          { id: 'sheet_1', name: 'Q4 Financial Model', modifiedTime: '2026-11-01T10:00:00Z', webViewLink: 'https://docs.google.com/spreadsheets/d/sheet_1' },
          { id: 'sheet_2', name: 'Customer Signups', modifiedTime: '2026-11-02T12:00:00Z', webViewLink: 'https://docs.google.com/spreadsheets/d/sheet_2' },
        ],
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResult),
        json: async () => mockResult,
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/spreadsheets?credentialId=${testCredId}&query=Customer`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
      expect(data.spreadsheets).toHaveLength(2);
      expect(data.spreadsheets[0].name).toBe('Q4 Financial Model');
      expect(data.spreadsheets[1].name).toBe('Customer Signups');
    });
  });

  describe('POST /api/integrations/google/spreadsheets (Native Creation)', () => {
    it('returns 400 when title is missing', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets',
        payload: {
          credentialId: testCredId,
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('Spreadsheet title is required');
    });

    it('returns 400 when credentialId is missing', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets',
        payload: {
          title: 'My Leads 2026',
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('credentialId');
    });

    it('creates spreadsheet and writes column headers', async () => {
      const fetchMock = vi.fn();
      const mockCreated = {
        spreadsheetId: 'new_sheet_xyz_789',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new_sheet_xyz_789/edit',
        properties: { title: 'Q4 Enterprise Inquiries' },
        sheets: [
          { properties: { sheetId: 0, title: 'Inquiries' } },
        ],
      };
      const mockValues = {
        updatedRange: 'Inquiries!A1:D1',
        updatedRows: 1,
        updatedColumns: 4,
        updatedCells: 4,
      };

      // First call: spreadsheets.create
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCreated),
        json: async () => mockCreated,
      });

      // Second call: PUT values for headers
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockValues),
        json: async () => mockValues,
      });

      globalThis.fetch = fetchMock;

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets',
        payload: {
          credentialId: testCredId,
          title: 'Q4 Enterprise Inquiries',
          sheetTitle: 'Inquiries',
          headers: ['Lead ID', 'Company', 'Email', 'Status'],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
      expect(data.spreadsheetId).toBe('new_sheet_xyz_789');
      expect(data.title).toBe('Q4 Enterprise Inquiries');
      expect(data.sheetName).toBe('Inquiries');
      expect(data.headers).toEqual(['Lead ID', 'Company', 'Email', 'Status']);

      // Check create API call format
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [createUrl, createOpts] = fetchMock.mock.calls[0];
      expect(createUrl).toBe('https://sheets.googleapis.com/v4/spreadsheets');
      expect(createOpts.method).toBe('POST');
      const createBody = JSON.parse(createOpts.body);
      expect(createBody.properties.title).toBe('Q4 Enterprise Inquiries');
      expect(createBody.sheets[0].properties.title).toBe('Inquiries');

      // Check header values PUT call format
      const [headersUrl, headersOpts] = fetchMock.mock.calls[1];
      expect(decodeURIComponent(headersUrl)).toContain('/values/Inquiries!1:1?valueInputOption=USER_ENTERED');
      expect(headersOpts.method).toBe('PUT');
      const headersBody = JSON.parse(headersOpts.body);
      expect(headersBody.values[0]).toEqual(['Lead ID', 'Company', 'Email', 'Status']);
    });

    it('reports clear scope error when Google API returns 403 insufficient scope', async () => {
      const scopeErrObj = {
        error: {
          code: 403,
          message: 'Request had insufficient authentication scopes.',
          status: 'PERMISSION_DENIED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify(scopeErrObj),
        json: async () => scopeErrObj,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets',
        payload: {
          credentialId: testCredId,
          title: 'Failing Scope Sheet',
        },
      });

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('permission');
      expect(data.error).toContain('Google Sheets scope');
    });
  });

  describe('POST /api/integrations/google/spreadsheets/:id/columns', () => {
    it('appends or writes column headers in row 1', async () => {
      const mockPutRes = {
        updatedRange: 'Sheet1!A1:D1',
        updatedColumns: 4,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockPutRes),
        json: async () => mockPutRes,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets/sheet_123/columns',
        payload: {
          credentialId: testCredId,
          sheetName: 'Sheet1',
          columns: ['Name', 'Email', 'Phone', 'Created_At'],
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.success).toBe(true);
      expect(data.columns).toEqual(['Name', 'Email', 'Phone', 'Created_At']);
      expect(data.headers).toEqual(['Name', 'Email', 'Phone', 'Created_At']);
    });

    it('returns 400 when columns array is empty', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/spreadsheets/sheet_123/columns',
        payload: {
          credentialId: testCredId,
          sheetName: 'Sheet1',
          columns: [],
        },
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.payload);
      expect(data.error).toContain('not be empty');
    });
  });

  describe('GET /api/integrations/google/spreadsheets/:id (Spreadsheet Verification)', () => {
    it('returns 400 when credentialId is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/integrations/google/spreadsheets/some_sheet_id',
      });

      expect(res.statusCode).toBe(400);
      const data = JSON.parse(res.payload);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('credentialId');
    });

    it('returns 200 with sheet metadata when valid and accessible', async () => {
      const mockMeta = {
        spreadsheetId: 'sheet_valid_123',
        properties: { title: 'Live Customer Inquiries' },
        sheets: [
          { properties: { title: 'Sheet1' } },
          { properties: { title: 'Leads' } },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockMeta),
        json: async () => mockMeta,
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/spreadsheets/sheet_valid_123?credentialId=${testCredId}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.valid).toBe(true);
      expect(data.spreadsheetId).toBe('sheet_valid_123');
      expect(data.title).toBe('Live Customer Inquiries');
      expect(data.sheets).toEqual(['Sheet1', 'Leads']);
      expect(data.spreadsheetUrl).toBe('https://docs.google.com/spreadsheets/d/sheet_valid_123/edit');
    });

    it('returns 404 with clear message when spreadsheet does not exist or is deleted', async () => {
      const notFoundErr = {
        error: {
          code: 404,
          message: 'Requested entity was not found.',
          status: 'NOT_FOUND',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify(notFoundErr),
        json: async () => notFoundErr,
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/spreadsheets/fake_deleted_sheet_999?credentialId=${testCredId}`,
      });

      expect(res.statusCode).toBe(404);
      const data = JSON.parse(res.payload);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('Spreadsheet not found or deleted');
    });

    it('returns 403 with clear message when user has no permission', async () => {
      const forbiddenErr = {
        error: {
          code: 403,
          message: 'The caller does not have permission',
          status: 'PERMISSION_DENIED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify(forbiddenErr),
        json: async () => forbiddenErr,
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/spreadsheets/restricted_sheet_000?credentialId=${testCredId}`,
      });

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.payload);
      expect(data.valid).toBe(false);
      expect(data.error).toContain('Access denied');
    });
  });
});
