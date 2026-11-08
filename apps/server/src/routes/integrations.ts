import { FastifyPluginAsync } from 'fastify';
import { credentialVault } from '../security/CredentialVault.js';
import { GmailSendEmailOperation, TelegramSendMessageOperation, redactBotToken } from '@workflow/engine';
import { googleFormsService } from '../services/GoogleFormsService.js';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: string;
  brandColor: string;
  description: string;
  authType: 'oauth2' | 'botToken' | 'webhookUrl' | 'apiKey';
  credentialType: string;
  setupUrl: string;
  requiredScopes?: string[];
  instructions: string[];
  operations: Array<{
    type: string;
    label: string;
    description: string;
  }>;
}

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    id: 'google',
    name: 'Google Workspace',
    category: 'Productivity & Communication',
    brandColor: '#4285F4',
    description:
      'Connect Gmail, Google Sheets, Google Drive, and Google Calendar with a single authorization.',
    authType: 'oauth2',
    credentialType: 'google',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    requiredScopes: [
      'Gmail: Send messages on your behalf',
      'Sheets: Read, append, and update spreadsheets',
      'Drive: Upload and search workspace files',
      'Calendar: Create and manage events',
      'Forms: Access form structure and read submitted responses',
    ],
    instructions: [
      'Click Connect to open the official Google authentication consent page.',
      'Select your Google account and grant the requested permissions.',
      'Upon authorization, your account will be immediately connected.',
    ],
    operations: [
      {
        type: 'google_forms.trigger',
        label: 'Google Forms: New Response Trigger',
        description: 'Trigger automations automatically whenever someone submits a Google Form.',
      },
      {
        type: 'gmail.sendEmail',
        label: 'Gmail: Send Email',
        description: 'Send plain text or HTML emails via your connected Gmail account.',
      },
      {
        type: 'sheets.readRows',
        label: 'Google Sheets: Read Rows',
        description: 'Read spreadsheet rows into structured JSON with header mapping.',
      },
      {
        type: 'sheets.appendRow',
        label: 'Google Sheets: Append Row',
        description: 'Append new rows to any worksheet with dynamic column alignment.',
      },
      {
        type: 'sheets.updateRow',
        label: 'Google Sheets: Update Row',
        description: 'Update specific cells or existing rows in a worksheet.',
      },
      {
        type: 'drive.uploadFile',
        label: 'Google Drive: Upload File',
        description: 'Upload files and reports directly into Google Drive folders.',
      },
      {
        type: 'drive.searchFiles',
        label: 'Google Drive: Find Files',
        description: 'Search for files in Google Drive by filename or query.',
      },
      {
        type: 'calendar.createEvent',
        label: 'Google Calendar: Create Event',
        description: 'Create scheduled events with attendees, description, and timezones.',
      },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Messaging',
    brandColor: '#24A1DE',
    description:
      'Send direct messages, alerts, and channel announcements using a Telegram Bot Token.',
    authType: 'botToken',
    credentialType: 'telegram',
    setupUrl: 'https://t.me/BotFather',
    instructions: [
      'Open Telegram and start a chat with @BotFather.',
      'Send the command /newbot and follow instructions to name your bot.',
      'Copy the HTTP API Bot Token provided by BotFather and paste it below.',
      'Add the bot as an administrator to your target channel or group.',
    ],
    operations: [
      {
        type: 'telegram.sendMessage',
        label: 'Telegram: Send Message',
        description: 'Send formatted Markdown or HTML messages to chats and channels.',
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Team Collaboration',
    brandColor: '#E01E5A',
    description:
      'Post notifications, status updates, and alerts into Slack channels via Incoming Webhooks.',
    authType: 'webhookUrl',
    credentialType: 'slack',
    setupUrl: 'https://api.slack.com/apps',
    instructions: [
      'Navigate to api.slack.com/apps and create or choose an existing Slack App.',
      'Enable Incoming Webhooks and click "Add New Webhook to Workspace".',
      'Select the target channel and authorize the integration.',
      'Copy the Webhook URL (starts with https://hooks.slack.com/services/...) and paste it below.',
    ],
    operations: [
      {
        type: 'slack.postMessage',
        label: 'Slack: Post Message',
        description: 'Post structured text or alert blocks into your Slack workspace.',
      },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Developer Tools',
    brandColor: '#F0F6FC',
    description:
      'Create issues, track bugs, and trigger developer workflows with a Personal Access Token.',
    authType: 'apiKey',
    credentialType: 'github',
    setupUrl: 'https://github.com/settings/tokens',
    instructions: [
      'Go to GitHub Settings → Developer settings → Personal access tokens.',
      'Generate a new token (classic or fine-grained) with "repo" access permissions.',
      'Copy the token (starts with ghp_ or github_pat_) and paste it below.',
    ],
    operations: [
      {
        type: 'github.createIssue',
        label: 'GitHub: Create Issue',
        description: 'Create issues with labels, title, and markdown body in any repo.',
      },
    ],
  },
];

export const integrationRoutes: FastifyPluginAsync = async (server) => {
  // List all integration definitions
  server.get('/api/integrations', async () => {
    return { integrations: INTEGRATION_REGISTRY };
  });

  // Get specific integration definition
  server.get<{ Params: { id: string } }>('/api/integrations/:id', async (req, reply) => {
    const item = INTEGRATION_REGISTRY.find((i) => i.id === req.params.id);
    if (!item) {
      return reply.status(404).send({ error: 'Integration not found' });
    }
    return { integration: item };
  });

  // Helper: List Google Spreadsheets from Google Drive
  server.get<{
    Querystring: { credentialId?: string; query?: string };
  }>('/api/integrations/google/spreadsheets', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      let q = "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'";
      if (req.query.query) {
        const sanitized = req.query.query.replace(/'/g, "\\'");
        q += ` and name contains '${sanitized}'`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(
        q
      )}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `Google Drive API error: ${text}` });
      }

      const data: any = await res.json();
      const files = Array.isArray(data.files)
        ? data.files.map((f: any) => ({
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
          }))
        : [];

      return { success: true, spreadsheets: files };
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ error: 'Credential not found' });
      }
      return reply.status(500).send({ error: err?.message || 'Failed to list Google Spreadsheets' });
    }
  });

  // Helper: Create a new Google Spreadsheet natively via spreadsheets.create
  server.post<{
    Body: {
      credentialId: string;
      title: string;
      sheetName?: string;
      sheetTitle?: string;
      headers?: string[];
    };
  }>('/api/integrations/google/spreadsheets', async (req, reply) => {
    const { credentialId, title, sheetName, sheetTitle, headers } = req.body || {};
    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }
    if (!title || !title.trim()) {
      return reply.status(400).send({ error: 'Spreadsheet title is required' });
    }

    try {
      const secrets = await credentialVault.get(credentialId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      const cleanTitle = title.trim();
      const cleanSheetName = (sheetName || sheetTitle || 'Sheet1').trim() || 'Sheet1';

      // 1. Call Google Sheets API spreadsheets.create directly
      const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: cleanTitle,
          },
          sheets: [
            {
              properties: {
                title: cleanSheetName,
              },
            },
          ],
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        let errMsg = `Google Sheets API error (${createRes.status}): ${text}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch {}

        if (
          createRes.status === 403 &&
          (errMsg.toLowerCase().includes('scope') ||
            errMsg.toLowerCase().includes('permission') ||
            errMsg.toLowerCase().includes('access'))
        ) {
          return reply.status(403).send({
            error:
              'Google account lacks permission to create spreadsheets. Please reconnect your Google account with the Google Sheets scope.',
            details: errMsg,
          });
        }
        return reply.status(createRes.status).send({ error: errMsg });
      }

      const created: any = await createRes.json();
      const spreadsheetId = created.spreadsheetId;
      const spreadsheetUrl =
        created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      // 2. If initial column headers are provided, write them into row 1 (sheetName!1:1)
      let savedHeaders: string[] = [];
      if (Array.isArray(headers) && headers.length > 0) {
        const cleanHeaders = headers.map((h) => String(h).trim()).filter(Boolean);
        if (cleanHeaders.length > 0) {
          try {
            const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
              spreadsheetId
            )}/values/${encodeURIComponent(`${cleanSheetName}!1:1`)}?valueInputOption=USER_ENTERED`;

            const valuesRes = await fetch(valuesUrl, {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                range: `${cleanSheetName}!1:1`,
                majorDimension: 'ROWS',
                values: [cleanHeaders],
              }),
            });

            if (valuesRes.ok) {
              savedHeaders = cleanHeaders;
            }
          } catch (writeErr) {
            req.log.warn(writeErr, 'Failed to populate initial sheet headers');
          }
        }
      }

      return reply.status(201).send({
        success: true,
        spreadsheetId,
        spreadsheetUrl,
        title: created.properties?.title || cleanTitle,
        sheetName: cleanSheetName,
        sheets: [cleanSheetName],
        headers: savedHeaders,
      });
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ error: 'Credential not found' });
      }
      return reply.status(500).send({ error: err?.message || 'Failed to create Google Spreadsheet' });
    }
  });

  // Helper: Create/Append Column Headers in Google Sheet
  server.post<{
    Params: { id: string };
    Body: {
      credentialId: string;
      sheetName?: string;
      columns: string[];
    };
  }>('/api/integrations/google/spreadsheets/:id/columns', async (req, reply) => {
    const spreadsheetId = req.params.id;
    const { credentialId, sheetName, columns } = req.body || {};
    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      return reply.status(400).send({ error: 'columns array is required and must not be empty' });
    }

    try {
      const secrets = await credentialVault.get(credentialId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      const cleanSheet = (sheetName || 'Sheet1').trim() || 'Sheet1';
      const cleanColumns = columns.map((c) => String(c).trim()).filter(Boolean);

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`${cleanSheet}!1:1`)}?valueInputOption=USER_ENTERED`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${cleanSheet}!1:1`,
          majorDimension: 'ROWS',
          values: [cleanColumns],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `Google API error: ${text}` });
      }

      return reply.send({ success: true, headers: cleanColumns, columns: cleanColumns });
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ error: 'Credential not found' });
      }
      return reply.status(500).send({ error: err?.message || 'Failed to write sheet columns' });
    }
  });

  // Helper: List Google Sheets in a Spreadsheet
  server.get<{
    Params: { id: string };
    Querystring: { credentialId?: string };
  }>('/api/integrations/google/spreadsheets/:id/sheets', async (req, reply) => {
    const credId = req.query.credentialId;
    const spreadsheetId = req.params.id;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}?fields=sheets.properties.title`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `Google API error: ${text}` });
      }

      const data: any = await res.json();
      const sheetTitles = Array.isArray(data.sheets)
        ? data.sheets.map((s: any) => s.properties?.title).filter(Boolean)
        : ['Sheet1'];

      return { sheets: sheetTitles };
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ error: 'Credential not found' });
      }
      return reply.status(500).send({ error: err?.message || 'Failed to list sheets' });
    }
  });

  // Helper: Verify and retrieve single Google Spreadsheet metadata
  server.get<{
    Params: { id: string };
    Querystring: { credentialId?: string };
  }>('/api/integrations/google/spreadsheets/:id', async (req, reply) => {
    const credId = req.query.credentialId;
    const spreadsheetId = req.params.id;
    if (!credId) {
      return reply.status(400).send({ valid: false, error: 'credentialId is required' });
    }
    if (!spreadsheetId || !spreadsheetId.trim()) {
      return reply.status(400).send({ valid: false, error: 'spreadsheetId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ valid: false, error: 'No access token available for this credential' });
      }

      const cleanId = spreadsheetId.trim();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        cleanId
      )}?fields=spreadsheetId,properties.title,sheets.properties.title`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Google Sheets API error (${res.status})`;
        try {
          const parsed = JSON.parse(text);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
          }
        } catch {}

        if (res.status === 404) {
          return reply.status(404).send({
            valid: false,
            error: 'Spreadsheet not found or deleted in Google Sheets.',
            details: errMsg,
          });
        }
        if (res.status === 403) {
          return reply.status(403).send({
            valid: false,
            error: 'Access denied. The connected Google account does not have permission to access this spreadsheet.',
            details: errMsg,
          });
        }
        return reply.status(res.status).send({ valid: false, error: errMsg });
      }

      const data: any = await res.json();
      const title = data.properties?.title || 'Untitled Spreadsheet';
      const sheetTitles = Array.isArray(data.sheets)
        ? data.sheets.map((s: any) => s.properties?.title).filter(Boolean)
        : ['Sheet1'];

      return reply.send({
        valid: true,
        spreadsheetId: data.spreadsheetId || cleanId,
        title,
        sheets: sheetTitles,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
      });
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ valid: false, error: 'Credential not found' });
      }
      return reply.status(500).send({ valid: false, error: err?.message || 'Failed to verify spreadsheet' });
    }
  });

  // Helper: Get Google Sheet Headers (Row 1 column names)
  server.get<{
    Params: { id: string };
    Querystring: { credentialId?: string; sheetName?: string };
  }>('/api/integrations/google/spreadsheets/:id/headers', async (req, reply) => {
    const credId = req.query.credentialId;
    const spreadsheetId = req.params.id;
    const sheetName = req.query.sheetName ? req.query.sheetName.trim() : 'Sheet1';
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`${sheetName}!1:1`)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `Google API error: ${text}` });
      }

      const data: any = await res.json();
      const headers = Array.isArray(data.values?.[0])
        ? data.values[0].map((h: any) => String(h).trim()).filter(Boolean)
        : [];

      return { headers };
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('not found')) {
        return reply.status(404).send({ error: 'Credential not found' });
      }
      return reply.status(500).send({ error: err?.message || 'Failed to fetch sheet headers' });
    }
  });

  // Helper: List Google Calendars
  server.get<{
    Querystring: { credentialId?: string };
  }>('/api/integrations/google/calendars', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return reply.send({ calendars: [{ id: 'primary', summary: 'Primary Calendar' }] });
      }

      const data: any = await res.json();
      const items = Array.isArray(data.items)
        ? data.items.map((c: any) => ({ id: c.id, summary: c.summary }))
        : [{ id: 'primary', summary: 'Primary Calendar' }];

      return { calendars: items };
    } catch {
      return { calendars: [{ id: 'primary', summary: 'Primary Calendar' }] };
    }
  });

  // Helper: List Google Drive files
  server.get<{
    Querystring: { credentialId?: string; query?: string; type?: string };
  }>('/api/integrations/google/drive/files', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const secrets = await credentialVault.get(credId);
      const token = secrets.accessToken || secrets.token;
      if (!token) {
        return reply.status(400).send({ error: 'No access token available for this credential' });
      }

      let q = 'trashed = false';
      const fileType = req.query.type;
      if (fileType === 'folders') {
        q += " and mimeType = 'application/vnd.google-apps.folder'";
      } else if (fileType === 'spreadsheets') {
        q += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
      } else if (fileType !== 'all') {
        q += " and mimeType != 'application/vnd.google-apps.folder'";
      }

      if (req.query.query) {
        const sanitized = req.query.query.replace(/'/g, "\\'");
        q += ` and name contains '${sanitized}'`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?pageSize=30&fields=files(id,name,mimeType,size,iconLink)&q=${encodeURIComponent(
        q
      )}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        return reply.status(res.status).send({ error: `Google Drive API error: ${text}` });
      }

      const data: any = await res.json();
      return { files: data.files || [] };
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || 'Failed to list Google Drive files' });
    }
  });

  // Helper: Test Gmail Send Email directly
  server.post<{
    Body: {
      credentialId: string;
      to: string;
      subject: string;
      body: string;
      cc?: string;
      bcc?: string;
      replyTo?: string;
      senderName?: string;
      isHtml?: boolean;
      attachments?: any[];
    };
  }>('/api/integrations/google/gmail/test', async (req, reply) => {
    const { credentialId, to, subject, body, cc, bcc, replyTo, senderName, isHtml, attachments } =
      req.body || {};

    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }
    if (!to || !to.trim()) {
      return reply.status(400).send({ error: 'Recipient email (To) is required' });
    }

    try {
      const secrets = await credentialVault.get(credentialId);
      const op = new GmailSendEmailOperation();
      const abortController = new AbortController();

      const execParams: Record<string, any> = {
        to,
        subject: subject || 'Test email from VULP',
        body: body || 'This is a test email sent from Vulp.',
        isHtml: isHtml ?? true,
      };
      if (cc) execParams.cc = cc;
      if (bcc) execParams.bcc = bcc;
      if (replyTo) execParams.replyTo = replyTo;
      if (senderName) execParams.senderName = senderName;
      if (attachments && attachments.length > 0) execParams.attachments = attachments;

      const result = await op.execute(
        execParams,
        secrets,
        {
          runId: `test_${Date.now()}`,
          triggerPayload: {},
          signal: abortController.signal,
          resolve: (t: any) => t,
          getSecrets: async () => secrets,
          log: () => {},
        }
      );

      return { success: true, result };
    } catch (err: any) {
      return reply.status(400).send({
        error: err?.message || 'Failed to send test email via Gmail',
      });
    }
  });

  // Specialized Direct Telegram Test Execution
  server.post<{
    Body: {
      credentialId: string;
      chatId: string;
      text: string;
      parseMode?: string;
    };
  }>('/api/integrations/telegram/test', async (req, reply) => {
    const { credentialId, chatId, text, parseMode } = req.body || {};

    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }
    if (!chatId || !String(chatId).trim()) {
      return reply.status(400).send({ error: "Parameter 'chatId' is required for Telegram test" });
    }
    if (!text || !String(text).trim()) {
      return reply.status(400).send({ error: "Parameter 'text' is required for Telegram test" });
    }

    try {
      const secrets = await credentialVault.get(credentialId);
      const op = new TelegramSendMessageOperation();
      const abortController = new AbortController();

      const result = await op.execute(
        {
          chatId: String(chatId).trim(),
          text: String(text),
          parseMode: parseMode || 'Markdown',
        },
        secrets,
        {
          runId: `test_${Date.now()}`,
          triggerPayload: {},
          signal: abortController.signal,
          resolve: (t: any) => t,
          getSecrets: async () => secrets,
          log: () => {},
        }
      );

      return { success: true, result };
    } catch (err: any) {
      return reply.status(400).send({
        error: redactBotToken(err?.message || 'Failed to send test message via Telegram'),
      });
    }
  });

  // ==========================================================================
  // Google Forms Integration Endpoints
  // ==========================================================================

  // List Forms from Drive
  server.get<{
    Querystring: { credentialId?: string; query?: string };
  }>('/api/integrations/google/forms', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const forms = await googleFormsService.listForms(credId, req.query.query);
      return { success: true, forms };
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || 'Failed to list Google Forms',
      });
    }
  });

  // Get Form Details & Questions
  server.get<{
    Params: { id: string };
    Querystring: { credentialId?: string };
  }>('/api/integrations/google/forms/:id', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const form = await googleFormsService.getForm(credId, req.params.id);
      return { success: true, form };
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || `Failed to fetch Google Form '${req.params.id}'`,
      });
    }
  });

  // Create Form natively with questions
  server.post<{
    Body: {
      credentialId: string;
      title: string;
      questions?: Array<{ title: string; required?: boolean; type?: string }>;
    };
  }>('/api/integrations/google/forms', async (req, reply) => {
    const { credentialId, title, questions } = req.body || {};
    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }
    if (!title || !title.trim()) {
      return reply.status(400).send({ error: 'Form title is required' });
    }

    try {
      const form = await googleFormsService.createForm(credentialId, title, questions);
      return { success: true, form };
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || 'Failed to create Google Form',
      });
    }
  });

  // Fetch Form Responses
  server.get<{
    Params: { id: string };
    Querystring: { credentialId?: string; afterTimestamp?: string };
  }>('/api/integrations/google/forms/:id/responses', async (req, reply) => {
    const credId = req.query.credentialId;
    if (!credId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const responses = await googleFormsService.getFormResponses(
        credId,
        req.params.id,
        req.query.afterTimestamp
      );
      return { success: true, responses };
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || `Failed to fetch responses for form '${req.params.id}'`,
      });
    }
  });

  // Test Trigger: Fetch latest response or synthesize sample schema
  server.post<{
    Params: { id: string };
    Body: {
      credentialId: string;
      workflowId?: string;
      nodeKey?: string;
    };
  }>('/api/integrations/google/forms/:id/test', async (req, reply) => {
    const { credentialId, workflowId, nodeKey } = req.body || {};
    if (!credentialId) {
      return reply.status(400).send({ error: 'credentialId is required' });
    }

    try {
      const testResult = await googleFormsService.testTrigger(credentialId, req.params.id);

      // Persist samplePayload to node params if workflowId & nodeKey provided
      if (workflowId && nodeKey) {
        try {
          const wf = db.select().from(workflows).where(eq(workflows.id, workflowId)).get();
          if (wf && wf.graph) {
            const graph = (typeof wf.graph === 'string'
              ? JSON.parse(wf.graph)
              : wf.graph) as any;
            let updated = false;

            for (const n of graph.nodes || []) {
              if (n.key === nodeKey || n.id === nodeKey) {
                n.params = {
                  ...(n.params || {}),
                  formId: testResult.form.id,
                  formTitle: testResult.form.title,
                  responderUri: testResult.form.responderUri,
                  samplePayload: testResult.sample,
                };
                updated = true;
              }
            }

            if (updated) {
              db.update(workflows)
                .set({ graph, updatedAt: Date.now() })
                .where(eq(workflows.id, workflowId))
                .run();
            }
          }
        } catch (dbErr) {
          console.warn('[GoogleForms] Failed to save test sample payload to DB:', dbErr);
        }
      }

      return testResult;
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || `Failed to test trigger for form '${req.params.id}'`,
      });
    }
  });

  // Push notification endpoint (for webhooks or Pub/Sub)
  server.post<{
    Params: { workflowId: string; nodeKey: string };
    Body: any;
  }>('/api/integrations/google/forms/webhook/:workflowId/:nodeKey', async (req, reply) => {
    try {
      const res = await googleFormsService.handlePushNotification(
        req.params.workflowId,
        req.params.nodeKey,
        req.body
      );
      return { success: true, result: res };
    } catch (err: any) {
      return reply.status(400).send({
        error: err?.message || 'Failed to process Google Forms push notification',
      });
    }
  });
};
