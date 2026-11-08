import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createServer } from '../src/index.js';
import { db, initDatabase } from '../src/db/index.js';
import { credentials, workflows, runs, nodeRuns, webhooks } from '../src/db/schema.js';
import { encrypt } from '../src/security/crypto.js';
import { redactBotToken } from '@workflow/engine';

describe('Webhook Variable Resolution & Telegram Delivery E2E Suite', () => {
  let server: FastifyInstance;
  const originalFetch = globalThis.fetch;

  const testGoogleCredId = 'test_google_cred_e2e';
  const testTelegramCredId = 'test_telegram_cred_e2e';
  const testBotToken = '7123456789:AAFlMNOpqrsTUVwxyz123456789abcdefghij';
  const testChatId = '6229697442';

  const createdWorkflowIds: string[] = [];

  beforeEach(async () => {
    vi.restoreAllMocks();
    initDatabase();

    // Insert Google Credential
    try {
      db.delete(credentials).where(eq(credentials.id, testGoogleCredId)).run();
    } catch {}
    db.insert(credentials).values({
      id: testGoogleCredId,
      name: 'Google (test.e2e@vulp.io)',
      type: 'google',
      dataEnc: encrypt(
        JSON.stringify({
          accessToken: 'ya29.mock_google_token_e2e',
          refreshToken: 'mock_google_refresh_token',
          expiresAt: Date.now() + 3600 * 1000,
          email: 'test.e2e@vulp.io',
        })
      ),
      createdAt: Date.now(),
    }).run();

    // Insert Telegram Credential
    try {
      db.delete(credentials).where(eq(credentials.id, testTelegramCredId)).run();
    } catch {}
    db.insert(credentials).values({
      id: testTelegramCredId,
      name: 'Vulp Test Bot',
      type: 'telegram',
      dataEnc: encrypt(
        JSON.stringify({
          botToken: testBotToken,
        })
      ),
      createdAt: Date.now(),
    }).run();

    server = await createServer();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    for (const wId of createdWorkflowIds) {
      try {
        db.delete(workflows).where(eq(workflows.id, wId)).run();
      } catch {}
    }
    try {
      db.delete(credentials).where(eq(credentials.id, testGoogleCredId)).run();
      db.delete(credentials).where(eq(credentials.id, testTelegramCredId)).run();
    } catch {}
    await server.close();
  });

  it('executes full 4-node workflow and correctly interpolates all 6 variables across Sheets, Gmail, and Telegram', async () => {
    // Intercept Google APIs & Telegram Bot API calls
    const outgoingGmailCalls: any[] = [];
    const outgoingSheetsCalls: any[] = [];
    const outgoingTelegramCalls: any[] = [];

    globalThis.fetch = vi.fn(async (url: any, init?: any) => {
      const urlStr = String(url);

      if (urlStr.includes('/gmail/v1/users/me/messages/send')) {
        const bodyObj = init?.body ? JSON.parse(init.body) : {};
        // Decode base64url RFC 2822 raw message
        const rawDecoded = bodyObj.raw
          ? Buffer.from(bodyObj.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
          : '';
        outgoingGmailCalls.push({ url: urlStr, rawDecoded, bodyObj });
        return new Response(
          JSON.stringify({
            id: 'mock_msg_101',
            threadId: 'mock_thread_101',
            labelIds: ['SENT'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/values/') && urlStr.includes(':append')) {
        const bodyObj = init?.body ? JSON.parse(init.body) : {};
        outgoingSheetsCalls.push({ url: urlStr, body: bodyObj });
        return new Response(
          JSON.stringify({
            spreadsheetId: '13yXFkZSICDY9blVTFt6iPfX4g9eMD8KSa9PELpLGCHk',
            updates: {
              updatedRange: 'Sheet1!A2:F2',
              updatedRows: 1,
              updatedColumns: 6,
              updatedCells: 6,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('api.telegram.org') && urlStr.includes('/sendMessage')) {
        const bodyObj = init?.body ? JSON.parse(init.body) : {};
        outgoingTelegramCalls.push({ url: urlStr, body: bodyObj });
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              message_id: 8820,
              chat: { id: 6229697442, first_name: 'Anurag' },
              date: Math.floor(Date.now() / 1000),
              text: bodyObj.text,
              from: { username: 'VulpTestBot', first_name: 'Vulp Bot' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    // Create the workflow: Webhook Trigger -> Google Sheets -> Gmail -> Telegram
    const wfRes = await server.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Lead Intake to Sheets, Gmail & Telegram',
        active: true,
        graph: {
          nodes: [
            {
              key: 'webhook_trigger_vvrf',
              type: 'webhook.trigger',
              name: 'Webhook Trigger',
              position: { x: 0, y: 0 },
              params: { method: 'POST' },
            },
            {
              key: 'sheets_appendRow_w1xy',
              type: 'sheets.appendRow',
              name: 'Google Sheets: Append Row',
              position: { x: 200, y: 0 },
              credentialId: testGoogleCredId,
              params: {
                spreadsheetId: '13yXFkZSICDY9blVTFt6iPfX4g9eMD8KSa9PELpLGCHk',
                sheetName: 'Sheet1',
                values: {
                  leadId: '{{ webhook_trigger_vvrf.body.leadId }}',
                  name: '{{ webhook_trigger_vvrf.body.name }}',
                  email: '{{ webhook_trigger_vvrf.body.email }}',
                  phone: '{{ webhook_trigger_vvrf.body.phone }}',
                  score: '{{ webhook_trigger_vvrf.body.score }}',
                  source: '{{ webhook_trigger_vvrf.body.source }}',
                },
              },
            },
            {
              key: 'gmail_sendEmail_w6y5',
              type: 'gmail.sendEmail',
              name: 'Gmail: Send Email',
              position: { x: 400, y: 0 },
              credentialId: testGoogleCredId,
              params: {
                to: 'anuragratan2590@gmail.com',
                subject: 'New Lead Received — {{name}}',
                body: '<p>Hello {{name}}, Lead ID: {{leadId}}, Email: {{email}}, Phone: {{phone}}, Score: {{score}}, Source: {{source}}</p>',
                isHtml: true,
              },
            },
            {
              key: 'telegram_sendMessage_w96p',
              type: 'telegram.sendMessage',
              name: 'Telegram Send Message',
              position: { x: 600, y: 0 },
              credentialId: testTelegramCredId,
              params: {
                chatId: testChatId,
                parseMode: 'Markdown',
                text: '🚀 *New Lead Received*\n👤 Customer: {{ trigger.name }}\n🆔 Lead ID: {{ trigger.leadId }}\n📧 Email: {{ trigger.email }}\n📱 Phone: {{ trigger.phone }}\n⭐ Score: {{ trigger.score }}\n📍 Source: {{ trigger.source }}',
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'webhook_trigger_vvrf',
              sourcePort: 'default',
              target: 'sheets_appendRow_w1xy',
            },
            {
              id: 'e2',
              source: 'sheets_appendRow_w1xy',
              sourcePort: 'default',
              target: 'gmail_sendEmail_w6y5',
            },
            {
              id: 'e3',
              source: 'gmail_sendEmail_w6y5',
              sourcePort: 'default',
              target: 'telegram_sendMessage_w96p',
            },
          ],
        },
      },
    });

    expect(wfRes.statusCode).toBe(201);
    const { workflow } = wfRes.json();
    createdWorkflowIds.push(workflow.id);

    const storedHook = db
      .select()
      .from(webhooks)
      .where(eq(webhooks.workflowId, workflow.id))
      .get();
    expect(storedHook).toBeDefined();
    const token = storedHook!.token;

    // Send the real webhook request with the payload from the user's issue
    const incomingLeadPayload = {
      leadId: 'LEAD-TEST-003',
      name: 'Anurag Integration Test',
      email: 'anuragratan2590@gmail.com',
      phone: '+91-9000000000',
      score: 98,
      source: 'VULP End-to-End Test',
    };

    const hookRes = await server.inject({
      method: 'POST',
      url: `/hook/${token}`,
      payload: incomingLeadPayload,
    });

    expect(hookRes.statusCode).toBe(202);
    const hookData = hookRes.json();
    expect(hookData.status).toBe('accepted');
    const runId = hookData.runId;
    expect(runId).toBeTruthy();

    // Wait for the workflow run to finish processing
    let runRecord: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      runRecord = db.select().from(runs).where(eq(runs.id, runId)).get();
      if (runRecord && runRecord.status !== 'running') {
        break;
      }
    }

    expect(runRecord).toBeTruthy();
    expect(runRecord.status).toBe('succeeded');
    expect(runRecord.error).toBeNull();

    // 1. Verify Sheets received the 6 values without null
    expect(outgoingSheetsCalls.length).toBe(1);
    const sheetValues = outgoingSheetsCalls[0].body.values[0];
    expect(sheetValues).toEqual([
      'LEAD-TEST-003',
      'Anurag Integration Test',
      'anuragratan2590@gmail.com',
      '+91-9000000000',
      98,
      'VULP End-to-End Test',
    ]);

    // 2. Verify Gmail was called and NO variables were null!
    expect(outgoingGmailCalls.length).toBe(1);
    const rawEmail = outgoingGmailCalls[0].rawDecoded;
    expect(rawEmail).not.toContain('null');

    // Decode RFC 2047 subject header or verify resolved params
    const gmailSubjectMatch = rawEmail.match(/Subject: =\?utf-8\?B\?([^?]+)\?=/i);
    if (gmailSubjectMatch) {
      const decodedSubject = Buffer.from(gmailSubjectMatch[1], 'base64').toString('utf8');
      expect(decodedSubject).toBe('New Lead Received — Anurag Integration Test');
    }
    // Decode base64 body
    const bodyBase64 = rawEmail.split('\r\n\r\n')[1] || rawEmail.split('\n\n')[1] || '';
    const decodedBody = Buffer.from(bodyBase64.trim(), 'base64').toString('utf8');
    expect(decodedBody).toContain('Hello Anurag Integration Test');
    expect(decodedBody).toContain('Lead ID: LEAD-TEST-003');
    expect(decodedBody).toContain('Email: anuragratan2590@gmail.com');
    expect(decodedBody).toContain('Phone: +91-9000000000');
    expect(decodedBody).toContain('Score: 98');
    expect(decodedBody).toContain('Source: VULP End-to-End Test');

    // 3. Verify Telegram was called with real parameters and NO null!
    expect(outgoingTelegramCalls.length).toBe(1);
    const tgBody = outgoingTelegramCalls[0].body;
    expect(tgBody.chat_id).toBe(testChatId);
    expect(tgBody.text).toContain('Customer: Anurag Integration Test');
    expect(tgBody.text).toContain('Lead ID: LEAD-TEST-003');
    expect(tgBody.text).toContain('Email: anuragratan2590@gmail.com');
    expect(tgBody.text).toContain('Phone: +91-9000000000');
    expect(tgBody.text).toContain('Score: 98');
    expect(tgBody.text).toContain('Source: VULP End-to-End Test');
    expect(tgBody.text).not.toContain('null');

    // 4. Verify all 4 node_runs in DB are marked succeeded
    const recordedNodeRuns = db.select().from(nodeRuns).where(eq(nodeRuns.runId, runId)).all();
    expect(recordedNodeRuns.length).toBe(4);
    for (const nr of recordedNodeRuns) {
      expect(nr.status).toBe('succeeded');
      expect(nr.error).toBeNull();
    }
  });

  it('POST /api/integrations/telegram/test executes real API call and returns confirmation, not simulated_success', async () => {
    let telegramApiCalled = false;

    globalThis.fetch = vi.fn(async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.telegram.org') && urlStr.includes('/sendMessage')) {
        telegramApiCalled = true;
        const bodyObj = init?.body ? JSON.parse(init.body) : {};
        return new Response(
          JSON.stringify({
            ok: true,
            result: {
              message_id: 12345,
              chat: { id: 6229697442, title: 'Test Chat' },
              date: 1710000000,
              text: bodyObj.text,
              from: { username: 'VulpTestBot' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await server.inject({
      method: 'POST',
      url: '/api/integrations/telegram/test',
      payload: {
        credentialId: testTelegramCredId,
        chatId: '6229697442',
        text: 'Test step live verification message from VULP',
        parseMode: 'Markdown',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(telegramApiCalled).toBe(true);
    const data = res.json();
    expect(data.success).toBe(true);
    expect(data.result.messageId).toBe(12345);
    expect(data.result.chatId).toBe('6229697442');
    expect(data.result.sender).toBe('VulpTestBot');
    // Ensure simulated_success is nowhere in the result
    expect(JSON.stringify(data)).not.toContain('simulated_success');
  });

  it('POST /api/integrations/telegram/test maps Telegram API rejection (chat not found) to an actionable error', async () => {
    globalThis.fetch = vi.fn(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('api.telegram.org')) {
        return new Response(
          JSON.stringify({
            ok: false,
            error_code: 400,
            description: 'Bad Request: chat not found',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const res = await server.inject({
      method: 'POST',
      url: '/api/integrations/telegram/test',
      payload: {
        credentialId: testTelegramCredId,
        chatId: '9999999999',
        text: 'Hello Telegram',
      },
    });

    expect(res.statusCode).toBe(400);
    const data = res.json();
    expect(data.error).toContain('Chat not found');
    expect(data.error).toContain('/start');
    // Never expose bot token in error response
    expect(data.error).not.toContain(testBotToken);
  });

  it('redacts bot tokens from error messages, URLs, and logs', () => {
    const rawError = `Failed to fetch https://api.telegram.org/bot${testBotToken}/sendMessage: 401 Unauthorized`;
    const redacted = redactBotToken(rawError, testBotToken);
    expect(redacted).not.toContain(testBotToken);
    expect(redacted).toContain('[REDACTED_BOT_TOKEN]');
  });

  it('workflow execution fails with clear actionable error when expression is unresolvable', async () => {
    const wfRes = await server.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Workflow with Missing Variable',
        active: true,
        graph: {
          nodes: [
            {
              key: 'hook_broken',
              type: 'webhook.trigger',
              name: 'Inbound Hook',
              position: { x: 0, y: 0 },
              params: { method: 'POST' },
            },
            {
              key: 'gmail_broken',
              type: 'gmail.sendEmail',
              name: 'Send Customer Email',
              position: { x: 200, y: 0 },
              credentialId: testGoogleCredId,
              params: {
                to: 'recipient@example.com',
                subject: 'Notification',
                body: 'Hello {{ trigger.nonExistentFieldXYZ }}, welcome!',
                isHtml: false,
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'hook_broken',
              sourcePort: 'default',
              target: 'gmail_broken',
            },
          ],
        },
      },
    });

    const { workflow } = wfRes.json();
    createdWorkflowIds.push(workflow.id);

    const storedHook = db
      .select()
      .from(webhooks)
      .where(eq(webhooks.workflowId, workflow.id))
      .get();
    expect(storedHook).toBeDefined();
    const token = storedHook!.token;

    const hookRes = await server.inject({
      method: 'POST',
      url: `/hook/${token}`,
      payload: { validField: 'hello' },
    });

    const runId = hookRes.json().runId;

    // Poll until run finishes
    let runRecord: any;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      runRecord = db.select().from(runs).where(eq(runs.id, runId)).get();
      if (runRecord && runRecord.status !== 'running') {
        break;
      }
    }

    expect(runRecord).toBeTruthy();
    expect(runRecord.status).toBe('failed');
    expect(runRecord.error).toContain('Unresolved variable expression');
    expect(runRecord.error).toContain('nonExistentFieldXYZ');
    expect(runRecord.error).toContain("Send Customer Email");
    expect(runRecord.error).toContain('Available context at this step');
  });
});
