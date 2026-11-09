import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { GmailSendEmailOperation } from '@workflow/engine';
import { Bindings } from './index.js';
import * as schema from './schema.js';
import { WorkerCredentialVault } from './CredentialVault.js';

export const googleApp = new Hono<{
  Bindings: Bindings;
  Variables: {
    user: schema.User;
    workspace: schema.Workspace;
  };
}>();

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
  const ws = (c.get('workspace') as any) || {};
  let workspaceId = c.req.query('workspaceId') || ws?.id || '';

  // Fallback to checking active session if workspaceId was not in query/context
  if (!workspaceId) {
    const authHeader = c.req.header('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      try {
        const { drizzle } = await import('drizzle-orm/d1');
        const db = drizzle(c.env.DB, { schema });
        const sess = await db.select().from(schema.sessions).where(eq(schema.sessions.id, token)).get();
        if (sess?.workspaceId) {
          workspaceId = sess.workspaceId;
        }
      } catch {}
    }
  }

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
    'https://www.googleapis.com/auth/drive.readonly',
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
    let id = nanoid();
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
    let targetWorkspaceId = rawState.split(':')[1] || '';

    const { drizzle } = await import('drizzle-orm/d1');
    const { getMasterKeyBuffer } = await import('./crypto.js');
    const db = drizzle(c.env.DB, { schema });

    // Smart tenant resolution: if workspaceId was missing from state or defaulted,
    // match the user's active workspace by their verified Google email
    if (!targetWorkspaceId || targetWorkspaceId === 'ws_init_default') {
      try {
        const matchedUser = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email.trim().toLowerCase()))
          .get();

        if (matchedUser) {
          const memberWs = await db
            .select({ workspaceId: schema.workspaceMembers.workspaceId })
            .from(schema.workspaceMembers)
            .where(eq(schema.workspaceMembers.userId, matchedUser.id))
            .get();
          if (memberWs?.workspaceId) {
            targetWorkspaceId = memberWs.workspaceId;
          }
        }
      } catch (wsLookupErr) {
        console.warn('[google callback] Failed to resolve workspace by user email:', wsLookupErr);
      }
    }

    if (!targetWorkspaceId) {
      targetWorkspaceId = 'ws_init_default';
    }

    const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY), undefined, {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    });
    const dataEnc = vault.encryptSecrets(secretPayload);

    // Check if an existing Google credential exists in target workspace to refresh or update
    const existingCred = await db
      .select()
      .from(schema.credentials)
      .where(
        and(
          eq(schema.credentials.workspaceId, targetWorkspaceId),
          eq(schema.credentials.type, 'google')
        )
      )
      .get();

    if (existingCred) {
      await db
        .update(schema.credentials)
        .set({
          name,
          dataEnc,
          createdAt: now,
        })
        .where(eq(schema.credentials.id, existingCred.id));
      id = existingCred.id;
    } else {
      await db.insert(schema.credentials).values({
        id,
        workspaceId: targetWorkspaceId,
        name,
        type: 'google',
        dataEnc,
        createdAt: now,
      });
    }

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
              localStorage.setItem('vulp_oauth_event', JSON.stringify({ ...payload, ts: Date.now() }));
            } catch (e) {}
            try {
              const bc = new BroadcastChannel('vulp_oauth');
              bc.postMessage(payload);
            } catch (e) {}
            if (window.opener) {
              try {
                window.opener.postMessage(payload, '*');
              } catch (e) {}
            }
            setTimeout(() => {
              try { window.close(); } catch(e) {}
            }, 300);
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
  const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY), undefined, {
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
  });
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
  const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY), undefined, {
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
  });
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
    const files = Array.isArray(data.files)
      ? data.files.map((f: any) => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
        }))
      : [];
    return c.json({ success: true, spreadsheets: files });
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
  let formId = c.req.param('id');
  const match = formId.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (match && match[1]) formId = match[1];

  try {
    const token = await getGoogleToken(c, credId);
    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      let errorMsg = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {}
      return c.json({ success: false, error: errorMsg }, res.status as any);
    }
    const data: any = await res.json();
    const questions: any[] = [];
    for (const item of data.items || []) {
      if (item.questionItem?.question) {
        const q = item.questionItem.question;
        let qType = 'TEXT';
        if (q.textQuestion?.paragraph) qType = 'PARAGRAPH';
        else if (q.choiceQuestion?.type) qType = q.choiceQuestion.type;
        else if (q.scaleQuestion) qType = 'SCALE';
        else if (q.dateQuestion) qType = 'DATE';

        questions.push({
          id: q.questionId || item.itemId,
          itemId: item.itemId,
          title: item.title || 'Untitled Question',
          type: qType,
          required: Boolean(q.required),
        });
      }
    }

    return c.json({
      success: true,
      form: {
        id: data.formId,
        title: data.info?.title || 'Google Form',
        description: data.info?.description || '',
        responderUri: data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
        webViewLink: `https://docs.google.com/forms/d/${formId}/edit`,
        questions,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// Create Google Form Natively
googleApp.post('/api/integrations/google/forms', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { credentialId, title, questions } = body;
  if (!credentialId) {
    return c.json({ success: false, error: 'credentialId is required' }, 400);
  }

  try {
    const token = await getGoogleToken(c, credentialId);

    // 1. Create form
    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        info: {
          title: title || 'Customer Lead Form',
          documentTitle: title || 'Customer Lead Form',
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch {}
      return c.json({ success: false, error: msg }, createRes.status as any);
    }

    const created: any = await createRes.json();
    const formId = created.formId;

    // 2. Add question items if provided
    const targetQuestions =
      questions && questions.length > 0
        ? questions
        : [
            { title: 'Lead ID', required: true, type: 'TEXT' },
            { title: 'Name', required: true, type: 'TEXT' },
            { title: 'Email', required: true, type: 'TEXT' },
            { title: 'Phone', required: false, type: 'TEXT' },
            { title: 'Score', required: false, type: 'TEXT' },
            { title: 'Source', required: false, type: 'TEXT' },
          ];

    const requests = targetQuestions.map((q: any, idx: number) => ({
      createItem: {
        item: {
          title: q.title.trim(),
          questionItem: {
            question: {
              required: Boolean(q.required),
              textQuestion: {
                paragraph: q.type === 'PARAGRAPH',
              },
            },
          },
        },
        location: {
          index: idx,
        },
      },
    }));

    if (requests.length > 0) {
      const batchUrl = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}:batchUpdate`;
      await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
    }

    // 3. Fetch full form details and return
    const getRes = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getData: any = await getRes.json();
    const parsedQuestions: any[] = [];
    for (const item of getData.items || []) {
      if (item.questionItem?.question) {
        parsedQuestions.push({
          id: item.questionItem.question.questionId || item.itemId,
          itemId: item.itemId,
          title: item.title || 'Untitled Question',
          required: Boolean(item.questionItem.question.required),
          type: item.questionItem.question.textQuestion?.paragraph ? 'PARAGRAPH' : 'TEXT',
        });
      }
    }

    return c.json({
      success: true,
      form: {
        id: getData.formId,
        title: getData.info?.title || title || 'Google Form',
        description: getData.info?.description || '',
        responderUri: getData.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
        webViewLink: `https://docs.google.com/forms/d/${formId}/edit`,
        questions: parsedQuestions,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// Test Google Form Trigger (fetch live response or synthesize sample schema)
googleApp.post('/api/integrations/google/forms/:id/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { credentialId } = body;
  let formId = c.req.param('id');
  const match = formId.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  if (match && match[1]) formId = match[1];

  if (!credentialId) {
    return c.json({ success: false, error: 'credentialId is required' }, 400);
  }

  try {
    const token = await getGoogleToken(c, credentialId);

    // 1. Get form details
    const formUrl = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`;
    const formRes = await fetch(formUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!formRes.ok) {
      const errText = await formRes.text();
      let msg = errText;
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || errText;
      } catch {}
      return c.json({ success: false, error: msg }, formRes.status as any);
    }
    const formData: any = await formRes.json();
    const questions: any[] = [];
    for (const item of formData.items || []) {
      if (item.questionItem?.question) {
        questions.push({
          id: item.questionItem.question.questionId || item.itemId,
          itemId: item.itemId,
          title: item.title || 'Untitled Question',
          required: Boolean(item.questionItem.question.required),
          type: item.questionItem.question.textQuestion?.paragraph ? 'PARAGRAPH' : 'TEXT',
        });
      }
    }

    const formDetails = {
      id: formData.formId,
      title: formData.info?.title || 'Google Form',
      description: formData.info?.description || '',
      responderUri: formData.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
      webViewLink: `https://docs.google.com/forms/d/${formId}/edit`,
      questions,
    };

    // 2. Fetch live responses if any
    const respUrl = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`;
    const respRes = await fetch(respUrl, { headers: { Authorization: `Bearer ${token}` } });
    let liveResponses: any[] = [];
    if (respRes.ok) {
      const rData: any = await respRes.json();
      if (Array.isArray(rData.responses)) {
        liveResponses = rData.responses;
      }
    }

    let isLive = false;
    let sample: Record<string, any> = {};

    if (liveResponses.length > 0) {
      isLive = true;
      const latest = liveResponses[liveResponses.length - 1];
      const answersMap: Record<string, any> = {};
      const topLevelProps: Record<string, any> = {};
      const rawAnswers = latest.answers || {};

      for (const q of questions) {
        const ansObj = rawAnswers[q.id];
        let val: any = '';
        if (ansObj?.textAnswers?.answers && Array.isArray(ansObj.textAnswers.answers)) {
          const textVals = ansObj.textAnswers.answers.map((a: any) => a.value);
          val = textVals.length > 1 ? textVals : textVals[0] ?? '';
        }
        answersMap[q.title] = val;
        const normKey = q.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        topLevelProps[normKey || 'field'] = val;
        topLevelProps[q.title] = val;
      }

      sample = {
        responseId: latest.responseId || `resp_${Date.now()}`,
        formId: formDetails.id,
        formTitle: formDetails.title,
        submittedAt: latest.lastSubmittedTime || latest.createTime || new Date().toISOString(),
        respondentEmail: latest.respondentEmail || '',
        ...topLevelProps,
        answers: answersMap,
      };
    } else {
      // Synthesize sample response using the form questions
      const answersMap: Record<string, any> = {};
      const topLevelProps: Record<string, any> = {};

      for (const q of questions) {
        const titleLower = q.title.toLowerCase();
        let val: any = 'Sample Response';
        if (titleLower.includes('name')) val = 'Sarah Connor';
        else if (titleLower.includes('email')) val = 'sarah.c@sky.net';
        else if (titleLower.includes('phone') || titleLower.includes('mobile')) val = '+1-555-0199';
        else if (titleLower.includes('id')) val = 'LEAD-101';
        else if (titleLower.includes('score')) val = 95;
        else if (titleLower.includes('source')) val = 'Website Intake';

        answersMap[q.title] = val;
        const normKey = q.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        topLevelProps[normKey || 'field'] = val;
        topLevelProps[q.title] = val;
      }

      if (!topLevelProps.name) topLevelProps.name = 'Sarah Connor';
      if (!topLevelProps.email) topLevelProps.email = 'sarah.c@sky.net';
      if (!topLevelProps.leadId) topLevelProps.leadId = 'LEAD-101';

      sample = {
        responseId: `sample_resp_${Date.now()}`,
        formId: formDetails.id,
        formTitle: formDetails.title,
        submittedAt: new Date().toISOString(),
        respondentEmail: 'sarah.c@sky.net',
        ...topLevelProps,
        answers: answersMap,
      };
    }

    return c.json({
      success: true,
      isLive,
      sample,
      form: formDetails,
      message: isLive ? 'Loaded latest submitted response from Google Form' : 'Generated sample schema from questions',
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
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
    const vault = new WorkerCredentialVault(db, getMasterKeyBuffer(c.env.WF_MASTER_KEY), undefined, {
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
  });
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

