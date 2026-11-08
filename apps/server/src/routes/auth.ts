import { FastifyPluginAsync } from 'fastify';
import { OAuthService } from '../services/OAuthService.js';
import { credentialVault } from '../security/CredentialVault.js';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../security/crypto.js';

export const authRoutes: FastifyPluginAsync = async (server) => {
  // Generate Google OAuth URL
  server.get<{
    Querystring: { origin?: string };
  }>('/api/auth/google', async (req, reply) => {
    const origin = req.query?.origin;
    const { url, state } = OAuthService.generateGoogleAuthUrl(origin);
    const config = OAuthService.getGoogleConfig();

    return {
      url,
      state,
      configured: config.isConfigured,
      clientId: config.isConfigured ? config.clientId : null,
      redirectUri: config.redirectUri,
    };
  });

  // Google OAuth Callback Handler
  server.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>('/api/auth/callback/google', async (req, reply) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      reply.type('text/html');
      return reply.send(`
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
                window.opener.postMessage({ type: 'vulp_oauth_error', service: 'google', error: '${error}' }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state parameter' });
    }

    const stateRecord = OAuthService.consumeState(state);
    if (!stateRecord) {
      return reply.status(400).send({
        error: 'Invalid or expired OAuth state nonce (CSRF validation failed)',
      });
    }

    try {
      const result = await OAuthService.handleGoogleCodeExchange(
        code,
        stateRecord.redirectUri
      );

      reply.type('text/html');
      return reply.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#0F0F0F; color:#F5F5F5; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center;">
            <div>
              <div style="width:48px; height:48px; margin:0 auto 16px; background:#1A2E1A; border:1px solid #22C55E; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#22C55E; font-size:24px;">✓</div>
              <h2 style="margin:0 0 8px 0; font-size:18px;">Google Account Connected!</h2>
              <p style="color:#A3A3A3; font-size:13px; margin:0 0 16px 0;">Signed in as <strong>${result.email}</strong></p>
              <p style="color:#737373; font-size:12px; margin-bottom: 12px;">This window will close automatically...</p>
              <button onclick="window.close()" style="padding:6px 16px; background:#222; color:#fff; border:1px solid #333; border-radius:8px; font-size:12px; cursor:pointer;">Close Window</button>
            </div>
            <script>
              const payload = {
                type: 'vulp_oauth_success',
                service: 'google',
                credentialId: '${result.id}',
                email: '${result.email}',
                name: '${result.name}'
              };

              // 1. BroadcastChannel: works across tabs/popups on the same origin even if window.opener was severed
              try {
                const bc = new BroadcastChannel('vulp_oauth');
                bc.postMessage(payload);
                bc.close();
              } catch (e) {}

              // 2. LocalStorage storage event fallback
              try {
                localStorage.setItem('vulp_oauth_event', JSON.stringify({ ...payload, _t: Date.now() }));
              } catch (e) {}

              // 3. Window.opener postMessage if available
              if (window.opener) {
                try {
                  window.opener.postMessage(payload, '*');
                } catch (e) {}
              }

              // Close window automatically after brief confirmation
              setTimeout(() => {
                window.close();
              }, 1200);
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      reply.type('text/html');
      return reply.send(`
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
      `);
    }
  });

  // Direct credential saving (e.g. for testing or when using manual OAuth credentials)
  server.post<{
    Body: {
      type: string;
      accessToken: string;
      refreshToken?: string;
      email?: string;
      name?: string;
    };
  }>('/api/auth/direct-token', async (req, reply) => {
    const { type, accessToken, refreshToken, email, name: rawName } = req.body || {};
    if (!accessToken) {
      return reply.status(400).send({ error: "Field 'accessToken' is required" });
    }

    const providerType = type || 'google';
    const userEmail = email || 'user@example.com';
    const name = rawName || `${providerType === 'google' ? 'Google' : providerType} (${userEmail})`;
    const id = nanoid();
    const now = Date.now();

    const dataEnc = encrypt(
      JSON.stringify({
        accessToken,
        refreshToken: refreshToken || '',
        expiresAt: String(now + 3600 * 1000),
        email: userEmail,
      })
    );

    db.insert(credentials)
      .values({
        id,
        name,
        type: providerType,
        dataEnc,
        createdAt: now,
      })
      .run();

    return reply.status(201).send({
      credential: {
        id,
        name,
        type: providerType,
        createdAt: now,
      },
    });
  });
};

