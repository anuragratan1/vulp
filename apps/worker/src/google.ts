import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { GmailSendEmailOperation } from '@workflow/engine';
import { Bindings } from './index.js';
import * as schema from './schema.js';
import { WorkerCredentialVault } from './CredentialVault.js';

export const googleApp = new Hono<{ Bindings: Bindings }>();

export function getGoogleIntegrationRedirectUri(c: any): string {
  if (c.env?.GOOGLE_REDIRECT_URI && !c.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
    return c.env.GOOGLE_REDIRECT_URI.replace(/\/+$/, '');
  }
  const clientOrigin = c.req.query('origin') || c.req.header('origin') || '';
  if (clientOrigin.includes('localhost') || clientOrigin.includes('127.0.0.1')) {
    try {
      return `${new URL(clientOrigin).origin}/api/auth/callback/google`;
    } catch {}
  }
  return 'https://vulp-psi.vercel.app/api/auth/callback/google';
}

// -----------------------------------------------------------------------------
// Google OAuth Flow
// -----------------------------------------------------------------------------
googleApp.get('/api/auth/google', async (c) => {
  const origin = c.req.query('origin') || new URL(c.req.url).origin;
  const workspaceId = c.req.query('workspaceId') || '';
  const clientId = c.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = getGoogleIntegrationRedirectUri(c);
  const isConfigured = Boolean(clientId && c.env.GOOGLE_CLIENT_SECRET);

  const state = `${nanoid(24)}:${workspaceId}`;
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/forms.body',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return c.json({
    url,
    state,
    configured: isConfigured,
    clientId: isConfigured ? clientId : null,
    redirectUri,
  });
});

googleApp.get('/api/auth/callback/google', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const error_description = c.req.query('error_description');

  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
          <div>
            <h2>Google Authorization Cancelled</h2>
            <p style="color:#A3A3A3; font-size:14px;">${error_description || error || 'Access was denied.'}</p>
            <button onclick="window.close()" style="margin-top:16px; padding:8px 16px; background:#222; color:#fff; border:1px solid #333; border-radius:8px; cursor:pointer;">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'vulp_oauth_error', service: 'google', error: ${JSON.stringify(error)} }, '*');
            }
          </script>
        </body>
      </html>
    `);
  }

  if (!code) {
    return c.text('Missing code parameter', 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = getGoogleIntegrationRedirectUri(c);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData: any = await tokenRes.json();
    let userInfo: any = {};
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (uRes.ok) userInfo = await uRes.json();
    } catch {}

    const email = userInfo.email || 'workspace-account@google.com';
    const name = `Google (${email})`;
    const id = nanoid();
    const now = Date.now();
    const expiresAt = now + (tokenData.expires_in || 3600) * 1000;

    const secretPayload = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresAt: String(expiresAt),
      email,
      accountName: userInfo.name || '',
      clientId,
      clientSecret,
    };

    const rawState = c.req.query('state') || '';
    const targetWorkspaceId = rawState.split(':')[1] || 'ws_init_default';

    const { drizzle } = await import('drizzle-orm/d1');
    const { getMasterKeyBuffer } = await import('./crypto.js');
    const db = drizzle(c.env.DB, { schema });
    const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY));
    const dataEnc = vault.encryptSecrets(secretPayload);

    await db.insert(schema.credentials).values({
      id,
      workspaceId: targetWorkspaceId,
      name,
      type: 'google',
      dataEnc,
      createdAt: now,
    });

    return c.html(`
      <!DOCTYPE html>
      <html>
        <body style="background:#0F0F0F; color:#F5F5F5; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
          <div>
            <div style="width:48px; height:48px; margin:0 auto 16px; background:#1A2E1A; border:1px solid #22C55E; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#22C55E; font-size:24px;">✓</div>
            <h2 style="margin:0 0 8px 0; font-size:18px;">Google Account Connected!</h2>
            <p style="color:#A3A3A3; font-size:13px; margin:0 0 16px 0;">Signed in as <strong>${email}</strong></p>
            <p style="color:#737373; font-size:12px; margin-bottom: 12px;">This window will close automatically...</p>
            <button onclick="window.close()" style="padding:6px 16px; background:#222; color:#fff; border:1px solid #333; border-radius:8px; font-size:12px; cursor:pointer;">Close Window</button>
          </div>
          <script>
            const payload = {
              type: 'vulp_oauth_success',
              service: 'google',
              credentialId: ${JSON.stringify(id)},
              email: ${JSON.stringify(email)},
              name: ${JSON.stringify(name)}
            };
            try {
              const bc = new BroadcastChannel('vulp_oauth');
              bc.postMessage(payload);
            } catch (e) {}
            if (window.opener) {
              window.opener.postMessage(payload, '*');
            }
            setTimeout(() => window.close(), 1200);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
          <div>
            <h2>Authorization Code Exchange Failed</h2>
            <p style="color:#A3A3A3; font-size:13px; max-width:400px;">${err?.message || 'Could not exchange code with Google'}</p>
            <button onclick="window.close()" style="margin-top:16px; padding:8px 16px; background:#222; color:#fff; border:1px solid #333; border-radius:8px; cursor:pointer;">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'vulp_oauth_error', service: 'google', error: ${JSON.stringify(err?.message)} }, '*');
            }
          </script>
        </body>
      </html>
    `, 400);
  }
});

// Direct token saving
googleApp.post('/api/auth/direct-token', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { type, accessToken, refreshToken, email, name: rawName, workspaceId } = body || {};
  if (!accessToken) {
    return c.json({ error: "Field 'accessToken' is required" }, 400);
  }

  const providerType = type || 'google';
  const userEmail = email || 'user@example.com';
  const name = rawName || `${providerType === 'google' ? 'Google' : providerType} (${userEmail})`;
  const targetWorkspaceId = workspaceId || 'ws_init_default';
  const id = nanoid();
  const now = Date.now();

  const { drizzle } = await import('drizzle-orm/d1');
  const { getMasterKeyBuffer } = await import('./crypto.js');
  const db = drizzle(c.env.DB, { schema });
  const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY));
  const dataEnc = vault.encryptSecrets({
    accessToken,
    refreshToken: refreshToken || '',
    expiresAt: String(now + 3600 * 1000),
    email: userEmail,
  });

  await db.insert(schema.credentials).values({
    id,
    workspaceId: targetWorkspaceId,
    name,
    type: providerType,
    dataEnc,
    createdAt: now,
  });

  return c.json(
    {
      credential: {
        id,
        name,
        type: providerType,
        createdAt: now,
      },
    },
    201
  );
});

// -----------------------------------------------------------------------------
// Google Drive / Sheets / Calendars / Forms API Proxies
// -----------------------------------------------------------------------------
async function getGoogleToken(c: any, credId?: string): Promise<string> {
  if (!credId) throw new Error('credentialId is required');
  const { drizzle } = await import('drizzle-orm/d1');
  const { getMasterKeyBuffer } = await import('./crypto.js');
  const db = drizzle(c.env.DB, { schema });
  const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY));
  const secrets = await vault.get(credId);
  const token = secrets.accessToken || secrets.token;
  if (!token) throw new Error('No access token available for this credential');
  return token;
}

// List Spreadsheets
googleApp.get('/api/integrations/google/spreadsheets', async (c) => {
  const credId = c.req.query('credentialId');
  try {
    const token = await getGoogleToken(c, credId);
    let q = "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'";
    const query = c.req.query('query');
    if (query) {
      const sanitized = query.replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: `Google Drive API error: ${text}` }, res.status as any);
    }
    const data: any = await res.json();
    return c.json({ spreadsheets: data.files || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Single Spreadsheet metadata
googleApp.get('/api/integrations/google/spreadsheets/:id', async (c) => {
  const credId = c.req.query('credentialId');
  const spreadsheetId = c.req.param('id');
  try {
    const token = await getGoogleToken(c, credId);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties.title`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ valid: false, error: text }, res.status as any);
    }
    const data: any = await res.json();
    const sheets = Array.isArray(data.sheets)
      ? data.sheets.map((s: any) => s.properties?.title).filter(Boolean)
      : ['Sheet1'];
    return c.json({
      valid: true,
      spreadsheet: {
        id: data.spreadsheetId,
        title: data.properties?.title,
        sheets,
      },
    });
  } catch (err: any) {
    return c.json({ valid: false, error: err.message }, 400);
  }
});

// List Sheet tabs
googleApp.get('/api/integrations/google/spreadsheets/:id/sheets', async (c) => {
  const credId = c.req.query('credentialId');
  const spreadsheetId = c.req.param('id');
  try {
    const token = await getGoogleToken(c, credId);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    const sheets = Array.isArray(data.sheets)
      ? data.sheets.map((s: any) => s.properties?.title).filter(Boolean)
      : ['Sheet1'];
    return c.json({ sheets });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Get Sheet Headers
googleApp.get('/api/integrations/google/spreadsheets/:id/headers', async (c) => {
  const credId = c.req.query('credentialId');
  const spreadsheetId = c.req.param('id');
  const sheetName = c.req.query('sheetName') || 'Sheet1';
  try {
    const token = await getGoogleToken(c, credId);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetName}!1:1`)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    const headers = Array.isArray(data.values?.[0])
      ? data.values[0].map((h: any) => String(h).trim()).filter(Boolean)
      : [];
    return c.json({ headers });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Add Columns / Headers to Sheet
googleApp.post('/api/integrations/google/spreadsheets/:id/columns', async (c) => {
  const spreadsheetId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { credentialId, sheetName = 'Sheet1', columns = [] } = body;
  try {
    const token = await getGoogleToken(c, credentialId);
    // Get existing headers
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetName}!1:1`)}`;
    const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    let existingHeaders: string[] = [];
    if (getRes.ok) {
      const getData: any = await getRes.json();
      existingHeaders = Array.isArray(getData.values?.[0])
        ? getData.values[0].map((h: any) => String(h).trim()).filter(Boolean)
        : [];
    }

    const mergedHeaders = [...existingHeaders];
    for (const col of columns) {
      if (!mergedHeaders.includes(col)) mergedHeaders.push(col);
    }

    const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetName}!1:1`)}?valueInputOption=USER_ENTERED`;
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [mergedHeaders] }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      return c.json({ success: false, error: text }, putRes.status as any);
    }

    return c.json({ success: true, headers: mergedHeaders });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// List Calendars
googleApp.get('/api/integrations/google/calendars', async (c) => {
  const credId = c.req.query('credentialId');
  try {
    const token = await getGoogleToken(c, credId);
    const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    const calendars = (data.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      primary: Boolean(cal.primary),
    }));
    return c.json({ calendars });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// List Drive Files
googleApp.get('/api/integrations/google/drive/files', async (c) => {
  const credId = c.req.query('credentialId');
  try {
    const token = await getGoogleToken(c, credId);
    let q = 'trashed = false';
    const query = c.req.query('query');
    if (query) {
      const sanitized = query.replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    return c.json({ files: data.files || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// List Google Forms
googleApp.get('/api/integrations/google/forms', async (c) => {
  const credId = c.req.query('credentialId');
  try {
    const token = await getGoogleToken(c, credId);
    let q = "trashed = false and mimeType = 'application/vnd.google-apps.form'";
    const query = c.req.query('query');
    if (query) {
      const sanitized = query.replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    return c.json({ success: true, forms: data.files || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Get Google Form Details & Questions
googleApp.get('/api/integrations/google/forms/:id', async (c) => {
  const credId = c.req.query('credentialId');
  const formId = c.req.param('id');
  try {
    const token = await getGoogleToken(c, credId);
    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: text }, res.status as any);
    }
    const data: any = await res.json();
    const questions: any[] = [];
    for (const item of data.items || []) {
      if (item.questionItem?.question) {
        questions.push({
          id: item.questionItem.question.questionId || item.itemId,
          itemId: item.itemId,
          title: item.title || 'Untitled Question',
          type: Object.keys(item.questionItem.question).find((k) => k.endsWith('Question')) || 'text',
          required: Boolean(item.questionItem.question.required),
        });
      }
    }

    return c.json({
      success: true,
      form: {
        id: data.formId,
        title: data.info?.title || 'Google Form',
        description: data.info?.description || '',
        responderUri: data.responderUri || '',
        questions,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

// Test Gmail Send Email
googleApp.post('/api/integrations/google/gmail/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { credentialId, to, subject, body: emailBody, cc, bcc, replyTo, senderName, isHtml, attachments } = body;
  try {
    const { drizzle } = await import('drizzle-orm/d1');
    const { getMasterKeyBuffer } = await import('./crypto.js');
    const db = drizzle(c.env.DB, { schema });
    const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY));
    const secrets = await vault.get(credentialId);

    const op = new GmailSendEmailOperation();
    const result = await op.execute(
      {
        to,
        subject: subject || 'Test email from VULP',
        body: emailBody || 'This is a test email sent from VULP.',
        isHtml: isHtml ?? true,
        cc,
        bcc,
        replyTo,
        senderName,
        attachments,
      },
      secrets,
      {
        runId: `test_${Date.now()}`,
        triggerPayload: {},
        signal: new AbortController().signal,
        resolve: (t: any) => t,
        getSecrets: async () => secrets,
        log: () => {},
      }
    );

    return c.json({ success: true, result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

