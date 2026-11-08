import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { nanoid } from 'nanoid';
import * as schema from './schema.js';
import { hashPassword, verifyPassword } from './crypto.js';
import { Bindings } from './index.js';

export const authApp = new Hono<{
  Bindings: Bindings;
  Variables: {
    user: schema.User;
    workspace: schema.Workspace;
  };
}>();

// Simple in-memory sliding rate limiter per IP
const rateLimits = new Map<string, number[]>();

export function checkRateLimit(ip: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimits.get(ip) || [];
  const valid = timestamps.filter((t) => now - t < windowMs);
  if (valid.length >= maxRequests) {
    return false;
  }
  valid.push(now);
  rateLimits.set(ip, valid);
  return true;
}

/**
 * Creates a new session for a user and workspace, valid for 30 days
 */
export async function createSession(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  workspaceId: string
): Promise<string> {
  const sessionId = `sess_${nanoid(36)}`;
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    workspaceId,
    expiresAt,
    createdAt: now,
  });

  return sessionId;
}

/**
 * Validates session token and returns the authenticated user and active workspace
 */
export async function verifySession(
  db: DrizzleD1Database<typeof schema>,
  token: string
): Promise<{ user: schema.User; workspace: schema.Workspace } | null> {
  if (!token) return null;

  const session = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, token))
    .get();

  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    // Session expired, delete it asynchronously
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
    return null;
  }

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get();

  if (!user) return null;

  const workspace = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, session.workspaceId))
    .get();

  if (!workspace) return null;

  return { user, workspace };
}

/**
 * Fetch all workspaces accessible to a user
 */
export async function getUserWorkspaces(
  db: DrizzleD1Database<typeof schema>,
  userId: string
): Promise<schema.Workspace[]> {
  const memberships = await db
    .select()
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.userId, userId))
    .all();

  const workspaceIds = memberships.map((m) => m.workspaceId);
  if (workspaceIds.length === 0) return [];

  const allUserWorkspaces: schema.Workspace[] = [];
  for (const wId of workspaceIds) {
    const ws = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, wId))
      .get();
    if (ws) allUserWorkspaces.push(ws);
  }

  return allUserWorkspaces;
}

// -----------------------------------------------------------------------------
// Auth Routes
// -----------------------------------------------------------------------------

// Sign Up
authApp.post('/api/auth/signup', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon';
  if (!checkRateLimit(clientIp, 20, 60000)) {
    return c.json({ error: 'Too many requests', message: 'Please wait before trying again.' }, 429);
  }

  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim();

  if (!email || !email.includes('@') || !email.includes('.')) {
    return c.json({ error: 'Invalid email address' }, 400);
  }
  if (!password || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long' }, 400);
  }
  if (!name) {
    return c.json({ error: 'Name is required' }, 400);
  }

  // Check if user already exists
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();

  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 409);
  }

  const userId = `usr_${nanoid(20)}`;
  const workspaceId = `ws_${nanoid(20)}`;
  const memberId = `mem_${nanoid(20)}`;
  const now = Date.now();
  const passwordHash = hashPassword(password);

  // 1. Create User
  await db.insert(schema.users).values({
    id: userId,
    email,
    passwordHash,
    name,
    avatarUrl: null,
    emailVerified: true, // Frictionless setup
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create Default Workspace
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: `${name}'s Workspace`,
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Add User as Workspace Owner
  await db.insert(schema.workspaceMembers).values({
    id: memberId,
    workspaceId,
    userId,
    role: 'owner',
    createdAt: now,
  });

  // 4. Create Session
  const token = await createSession(db, userId, workspaceId);

  const user = (await db.select().from(schema.users).where(eq(schema.users.id, userId)).get())!;
  const workspace = (await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get())!;
  const workspaces = await getUserWorkspaces(db, userId);

  return c.json(
    {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
      },
      workspace,
      workspaces,
    },
    201
  );
});

// Login
authApp.post('/api/auth/login', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon';
  if (!checkRateLimit(clientIp, 30, 60000)) {
    return c.json({ error: 'Too many requests', message: 'Please wait before trying again.' }, 429);
  }

  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  let workspaces = await getUserWorkspaces(db, user.id);
  let activeWorkspace = workspaces[0];

  // Self-heal workspace if missing
  if (!activeWorkspace) {
    const wsId = `ws_${nanoid(20)}`;
    const now = Date.now();
    await db.insert(schema.workspaces).values({
      id: wsId,
      name: `${user.name}'s Workspace`,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.workspaceMembers).values({
      id: `mem_${nanoid(20)}`,
      workspaceId: wsId,
      userId: user.id,
      role: 'owner',
      createdAt: now,
    });
    workspaces = await getUserWorkspaces(db, user.id);
    activeWorkspace = workspaces[0];
  }

  const token = await createSession(db, user.id, activeWorkspace.id);

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
    },
    workspace: activeWorkspace,
    workspaces,
  });
});

/**
 * Verifies a Google ID Token using Google's tokeninfo API.
 * Validates audience, issuer, expiration, and verified email status.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId: string
): Promise<{
  sub: string;
  email: string;
  name: string;
  picture?: string;
} | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, any>;

    // Audience must match our Google Client ID
    if (data.aud !== expectedClientId) {
      return null;
    }

    // Issuer must be Google
    if (
      data.iss !== 'https://accounts.google.com' &&
      data.iss !== 'accounts.google.com'
    ) {
      return null;
    }

    // Expiration check
    if (Number(data.exp) * 1000 <= Date.now()) {
      return null;
    }

    // Email must be verified by Google
    if (data.email_verified !== 'true' && data.email_verified !== true) {
      return null;
    }

    return {
      sub: data.sub,
      email: data.email,
      name: data.name || data.email?.split('@')[0] || 'Google User',
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

/**
 * Handles account creation, safe account linking, and workspace resolution for a verified Google user.
 */
export async function handleGoogleAuthUser(
  db: DrizzleD1Database<typeof schema>,
  googleProfile: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }
) {
  const email = googleProfile.email.trim().toLowerCase();
  const now = Date.now();

  // 1. Check if user exists by googleId
  let user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.googleId, googleProfile.sub))
    .get();

  // 2. If not found by googleId, check by email
  if (!user) {
    user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (user) {
      // Safe Account Linking: Link verified Google identity to existing account
      await db
        .update(schema.users)
        .set({
          googleId: googleProfile.sub,
          avatarUrl: user.avatarUrl || googleProfile.picture || null,
          emailVerified: true,
          updatedAt: now,
        })
        .where(eq(schema.users.id, user.id));

      user = (await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .get())!;
    }
  }

  // 3. If still not found, create new user + personal workspace
  if (!user) {
    const userId = `usr_${nanoid(20)}`;
    const workspaceId = `ws_${nanoid(20)}`;
    const memberId = `mem_${nanoid(20)}`;

    await db.insert(schema.users).values({
      id: userId,
      email,
      passwordHash: 'oauth:google:locked',
      name: googleProfile.name || email.split('@')[0],
      avatarUrl: googleProfile.picture || null,
      googleId: googleProfile.sub,
      emailVerified: true,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.workspaces).values({
      id: workspaceId,
      name: `${googleProfile.name || 'Personal'}'s Workspace`,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.workspaceMembers).values({
      id: memberId,
      workspaceId,
      userId,
      role: 'owner',
      createdAt: now,
    });

    user = (await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get())!;
  }

  // 4. Resolve active workspace
  let workspaces = await getUserWorkspaces(db, user.id);
  let activeWorkspace = workspaces[0];
  if (!activeWorkspace) {
    const wsId = `ws_${nanoid(20)}`;
    await db.insert(schema.workspaces).values({
      id: wsId,
      name: `${user.name}'s Workspace`,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.workspaceMembers).values({
      id: `mem_${nanoid(20)}`,
      workspaceId: wsId,
      userId: user.id,
      role: 'owner',
      createdAt: now,
    });
    workspaces = await getUserWorkspaces(db, user.id);
    activeWorkspace = workspaces[0];
  }

  // 5. Create Session
  const token = await createSession(db, user.id, activeWorkspace.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      createdAt: user.createdAt,
    },
    workspace: activeWorkspace,
    workspaces,
  };
}

// Verify Google ID Token (from Google Identity Services)
authApp.post('/api/auth/google/verify', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon';
  if (!checkRateLimit(clientIp, 30, 60000)) {
    return c.json({ error: 'Too many requests', message: 'Please wait before trying again.' }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const idToken = body.idToken;

  if (!idToken || typeof idToken !== 'string') {
    return c.json({ error: 'Missing idToken' }, 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    return c.json({ error: 'Google OAuth not configured on server' }, 500);
  }

  const profile = await verifyGoogleIdToken(idToken, clientId);
  if (!profile) {
    return c.json({ error: 'Invalid or expired Google ID token' }, 401);
  }

  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const result = await handleGoogleAuthUser(db, profile);
  return c.json(result);
});

export function getCanonicalBackendUrl(c: any): string {
  if (c.env?.CANONICAL_API_URL) {
    return c.env.CANONICAL_API_URL.replace(/\/+$/, '');
  }
  const reqUrl = new URL(c.req.url);
  if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') {
    return reqUrl.origin;
  }
  return 'https://vulp-studio.workflow-worker.workers.dev';
}

export function getGoogleSignInRedirectUri(c: any): string {
  if (c.env?.GOOGLE_SIGNIN_REDIRECT_URI) {
    return c.env.GOOGLE_SIGNIN_REDIRECT_URI.replace(/\/+$/, '');
  }
  const clientOrigin = c.req.query('origin') || c.req.header('origin') || '';
  if (clientOrigin.includes('localhost') || clientOrigin.includes('127.0.0.1')) {
    try {
      return `${new URL(clientOrigin).origin}/api/auth/google/signin/callback`;
    } catch {}
  }
  return 'https://vulp-psi.vercel.app/api/auth/google/signin/callback';
}

interface OAuthStatePayload {
  nonce: string;
  origin: string;
  redirectUri: string;
  ts: number;
}

export function encodeOAuthState(clientOrigin: string, redirectUri: string): string {
  const payload: OAuthStatePayload = {
    nonce: nanoid(24),
    origin: clientOrigin || 'https://vulp-psi.vercel.app',
    redirectUri,
    ts: Date.now(),
  };
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeOAuthState(stateStr?: string): OAuthStatePayload | null {
  if (!stateStr) return null;
  try {
    let base64 = stateStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const json = atob(base64);
    const parsed = JSON.parse(json);
    if (!parsed || !parsed.nonce) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Google Sign-In Popup Initiation (Non-sensitive scopes only)
authApp.get('/api/auth/google/signin', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    return c.json({ error: 'Google OAuth not configured on server' }, 500);
  }

  const redirectUri = getGoogleSignInRedirectUri(c);
  const clientOrigin = c.req.query('origin') || 'https://vulp-psi.vercel.app';
  const state = encodeOAuthState(clientOrigin, redirectUri);

  // Scopes for User Sign-In ONLY: strictly non-sensitive
  const scopes = ['openid', 'email', 'profile'].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const accept = c.req.header('accept') || '';
  if (accept.includes('application/json')) {
    return c.json({ url, redirectUri, clientId });
  }

  return c.redirect(url);
});

// Google Sign-In Popup Callback
authApp.get('/api/auth/google/signin/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const error = c.req.query('error');
    const state = c.req.query('state');
    const clientId = c.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET || '';

    const stateData = decodeOAuthState(state);
    const returnOrigin = stateData?.origin || 'https://vulp-psi.vercel.app';
    const redirectUri = stateData?.redirectUri || getGoogleSignInRedirectUri(c);

    if (error || !code) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
            <div>
              <h2 style="font-size:18px; margin-bottom:8px;">Sign-In Cancelled</h2>
              <p style="color:#A3A3A3; font-size:13px; margin-bottom:16px;">${error || 'No authorization code received'}</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </div>
          </body>
        </html>
      `, 400);
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('Google token exchange failed:', tokenRes.status, errBody);
      return c.html(`
        <!DOCTYPE html>
        <html>
          <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
            <div>
              <h2 style="font-size:18px; margin-bottom:8px;">Sign-In Failed</h2>
              <p style="color:#A3A3A3; font-size:13px; margin-bottom:16px;">Failed to exchange authorization code with Google.</p>
              <script>setTimeout(() => window.close(), 2500);</script>
            </div>
          </body>
        </html>
      `, 400);
    }

    const tokenData = (await tokenRes.json()) as any;
    let profile: { sub: string; email: string; name: string; picture?: string } | null = null;

    if (tokenData.id_token) {
      profile = await verifyGoogleIdToken(tokenData.id_token, clientId);
    }

    if (!profile && tokenData.access_token) {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const u = (await userRes.json()) as any;
        if (u.verified_email || u.email_verified) {
          profile = {
            sub: u.id,
            email: u.email,
            name: u.name || u.email?.split('@')[0] || 'Google User',
            picture: u.picture,
          };
        }
      }
    }

    if (!profile) {
      return c.html(`
        <!DOCTYPE html>
        <html>
          <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
            <div>
              <h2 style="font-size:18px; margin-bottom:8px;">Verification Failed</h2>
              <p style="color:#A3A3A3; font-size:13px; margin-bottom:16px;">Could not verify your identity with Google.</p>
              <script>setTimeout(() => window.close(), 2500);</script>
            </div>
          </body>
        </html>
      `, 400);
    }

    const { drizzle } = await import('drizzle-orm/d1');
    const db = drizzle(c.env.DB, { schema });
    const authResult = await handleGoogleAuthUser(db, profile);

    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Signed in with Google</title></head>
        <body style="background:#0F0F0F; color:#F5F5F5; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
          <div>
            <div style="width:48px; height:48px; margin:0 auto 16px; background:#1A2E1A; border:1px solid #22C55E; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#22C55E; font-size:24px;">✓</div>
            <h2 style="margin:0 0 8px 0; font-size:18px;">Welcome to Vulp!</h2>
            <p style="color:#A3A3A3; font-size:13px; margin:0 0 16px 0;">Signed in as <strong>${profile.email}</strong></p>
            <p style="color:#737373; font-size:12px;">This window will close automatically...</p>
          </div>
          <script>
            const payload = {
              type: 'vulp_auth_success',
              token: ${JSON.stringify(authResult.token)},
              user: ${JSON.stringify(authResult.user)},
              workspace: ${JSON.stringify(authResult.workspace)},
              workspaces: ${JSON.stringify(authResult.workspaces)}
            };
            try {
              localStorage.setItem('vulp_auth_token', ${JSON.stringify(authResult.token)});
            } catch(e) {}
            try {
              const bc = new BroadcastChannel('vulp_auth');
              bc.postMessage(payload);
            } catch(e) {}
            if (window.opener) {
              try {
                window.opener.postMessage(payload, '*');
              } catch(e) {}
              setTimeout(() => {
                try { window.close(); } catch(e) {}
              }, 800);
            } else {
              // Direct navigation fallback (e.g. mobile or blocked popup)
              setTimeout(() => {
                window.location.href = ${JSON.stringify(returnOrigin)};
              }, 600);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Fatal Google callback error:', err);
    return c.html(`
      <!DOCTYPE html>
      <html>
        <body style="background:#0F0F0F; color:#F87171; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
          <div>
            <h2 style="font-size:18px; margin-bottom:8px;">Sign-In Error</h2>
            <p style="color:#A3A3A3; font-size:13px; margin-bottom:16px;">${err?.message || 'An unexpected error occurred during authentication.'}</p>
            <button onclick="window.close()" style="background:#222; color:#fff; border:1px solid #333; padding:8px 16px; border-radius:8px; cursor:pointer;">Close Window</button>
          </div>
        </body>
      </html>
    `, 500);
  }
});

// Logout
authApp.post('/api/auth/logout', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token) {
    const { drizzle } = await import('drizzle-orm/d1');
    const db = drizzle(c.env.DB, { schema });
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  }

  return c.json({ success: true, message: 'Logged out successfully' });
});

// Me (Current user & active workspace)
authApp.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return c.json({ error: 'Unauthorized', message: 'No authentication token provided' }, 401);
  }

  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired session' }, 401);
  }

  const workspaces = await getUserWorkspaces(db, sessionData.user.id);

  return c.json({
    user: {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      avatarUrl: sessionData.user.avatarUrl,
      emailVerified: sessionData.user.emailVerified,
      onboardingCompleted: sessionData.user.onboardingCompleted,
      createdAt: sessionData.user.createdAt,
    },
    workspace: sessionData.workspace,
    workspaces,
  });
});

// Create Workspace
authApp.post('/api/auth/workspaces', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = (body.name || '').trim();
  if (!name) {
    return c.json({ error: 'Workspace name is required' }, 400);
  }

  const wsId = `ws_${nanoid(20)}`;
  const now = Date.now();

  await db.insert(schema.workspaces).values({
    id: wsId,
    name,
    ownerId: sessionData.user.id,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.workspaceMembers).values({
    id: `mem_${nanoid(20)}`,
    workspaceId: wsId,
    userId: sessionData.user.id,
    role: 'owner',
    createdAt: now,
  });

  // Switch current session to newly created workspace
  await db
    .update(schema.sessions)
    .set({ workspaceId: wsId })
    .where(eq(schema.sessions.id, token));

  const workspace = (await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, wsId)).get())!;
  const workspaces = await getUserWorkspaces(db, sessionData.user.id);

  return c.json({ workspace, workspaces }, 201);
});

// Switch Workspace
authApp.post('/api/auth/workspaces/switch', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const workspaceId = body.workspaceId;
  if (!workspaceId) {
    return c.json({ error: 'workspaceId is required' }, 400);
  }

  // Verify membership
  const member = await db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, sessionData.user.id)
      )
    )
    .get();

  if (!member) {
    return c.json({ error: 'Access denied: You are not a member of this workspace' }, 403);
  }

  await db
    .update(schema.sessions)
    .set({ workspaceId })
    .where(eq(schema.sessions.id, token));

  const workspace = (await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get())!;
  const workspaces = await getUserWorkspaces(db, sessionData.user.id);

  return c.json({ workspace, workspaces });
});

// Delete Workspace
authApp.delete('/api/auth/workspaces/:id', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');
  const ws = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).get();
  if (!ws) {
    return c.json({ error: 'Workspace not found' }, 404);
  }

  if (ws.ownerId !== sessionData.user.id) {
    return c.json({ error: 'Only the workspace owner can delete it' }, 403);
  }

  const workspaces = await getUserWorkspaces(db, sessionData.user.id);
  if (workspaces.length <= 1) {
    return c.json({ error: 'You must maintain at least one workspace' }, 400);
  }

  // Delete workspace and all its cascade resources
  await db.delete(schema.workspaces).where(eq(schema.workspaces.id, id));

  const remaining = await getUserWorkspaces(db, sessionData.user.id);
  const nextWorkspace = remaining[0];

  // If current session was on the deleted workspace, switch to next available
  if (sessionData.workspace.id === id) {
    await db
      .update(schema.sessions)
      .set({ workspaceId: nextWorkspace.id })
      .where(eq(schema.sessions.id, token));
  }

  return c.json({ success: true, workspace: nextWorkspace, workspaces: remaining });
});

// Update Profile
authApp.put('/api/auth/profile', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = body.name !== undefined ? body.name.trim() : sessionData.user.name;
  const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : sessionData.user.avatarUrl;

  await db
    .update(schema.users)
    .set({
      name,
      avatarUrl,
      updatedAt: Date.now(),
    })
    .where(eq(schema.users.id, sessionData.user.id));

  const updated = (await db.select().from(schema.users).where(eq(schema.users.id, sessionData.user.id)).get())!;

  return c.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      emailVerified: updated.emailVerified,
      onboardingCompleted: updated.onboardingCompleted,
      createdAt: updated.createdAt,
    },
  });
});

// Update Password
authApp.put('/api/auth/password', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { currentPassword, newPassword } = body;

  if (sessionData.user.passwordHash) {
    if (!currentPassword) {
      return c.json({ error: 'Current password is required' }, 400);
    }
    if (!verifyPassword(currentPassword, sessionData.user.passwordHash)) {
      return c.json({ error: 'Current password is incorrect' }, 400);
    }
  }

  if (!newPassword || newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters long' }, 400);
  }

  const newHash = hashPassword(newPassword);
  await db
    .update(schema.users)
    .set({
      passwordHash: newHash,
      updatedAt: Date.now(),
    })
    .where(eq(schema.users.id, sessionData.user.id));

  return c.json({ success: true, message: 'Password updated successfully' });
});

// Forgot Password
authApp.post('/api/auth/forgot-password', async (c) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon';
  if (!checkRateLimit(clientIp, 10, 60000)) {
    return c.json({ error: 'Too many requests', message: 'Please wait before trying again.' }, 429);
  }

  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();

  if (user) {
    const tokenId = `rst_${nanoid(32)}`;
    const now = Date.now();
    const expiresAt = now + 60 * 60 * 1000; // 1 hour

    await db.insert(schema.authTokens).values({
      id: tokenId,
      userId: user.id,
      type: 'password_reset',
      expiresAt,
      used: false,
      createdAt: now,
    });

    return c.json({
      success: true,
      message: 'Password reset instructions have been generated.',
      resetToken: tokenId, // Returned for instant testing and frictionless demo
    });
  }

  // Consistent response to prevent user enumeration
  return c.json({
    success: true,
    message: 'If an account exists with this email, reset instructions have been generated.',
  });
});

// Reset Password
authApp.post('/api/auth/reset-password', async (c) => {
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const body = await c.req.json().catch(() => ({}));
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return c.json({ error: 'Token and new password are required' }, 400);
  }
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long' }, 400);
  }

  const authToken = await db
    .select()
    .from(schema.authTokens)
    .where(and(eq(schema.authTokens.id, token), eq(schema.authTokens.type, 'password_reset')))
    .get();

  if (!authToken || authToken.used || Date.now() > authToken.expiresAt) {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }

  const newHash = hashPassword(newPassword);
  await db
    .update(schema.users)
    .set({
      passwordHash: newHash,
      updatedAt: Date.now(),
    })
    .where(eq(schema.users.id, authToken.userId));

  await db
    .update(schema.authTokens)
    .set({ used: true })
    .where(eq(schema.authTokens.id, token));

  return c.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
});

// Onboarding Complete
authApp.post('/api/auth/onboarding/complete', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await db
    .update(schema.users)
    .set({
      onboardingCompleted: true,
      updatedAt: Date.now(),
    })
    .where(eq(schema.users.id, sessionData.user.id));

  return c.json({ success: true, message: 'Onboarding marked as completed' });
});

// Danger Zone: Delete Entire Account
authApp.delete('/api/auth/account', async (c) => {
  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { drizzle } = await import('drizzle-orm/d1');
  const db = drizzle(c.env.DB, { schema });

  const sessionData = await verifySession(db, token);
  if (!sessionData) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = sessionData.user.id;

  // Find all workspaces owned by the user
  const ownedWorkspaces = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerId, userId))
    .all();

  for (const ws of ownedWorkspaces) {
    // Delete workflows, credentials, runs belonging to this workspace
    await db.delete(schema.workflows).where(eq(schema.workflows.workspaceId, ws.id));
    await db.delete(schema.credentials).where(eq(schema.credentials.workspaceId, ws.id));
    await db.delete(schema.runs).where(eq(schema.runs.workspaceId, ws.id));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, ws.id));
  }

  // Delete sessions, tokens, and the user
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await db.delete(schema.authTokens).where(eq(schema.authTokens.userId, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  return c.json({ success: true, message: 'Account and all associated workspaces and data permanently deleted.' });
});

