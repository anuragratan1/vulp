import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { encrypt, decrypt } from '../security/crypto.js';
import '../config/env.js';

export interface OAuthStateRecord {
  state: string;
  createdAt: number;
  origin?: string;
  redirectUri?: string;
}

export interface GoogleUserInfo {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
}

export class OAuthService {
  private static states = new Map<string, OAuthStateRecord>();

  // Clean expired states (older than 10 minutes)
  private static cleanExpiredStates() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of this.states.entries()) {
      if (val.createdAt < cutoff) {
        this.states.delete(key);
      }
    }
  }

  public static getGoogleConfig() {
    return {
      clientId:
        process.env.GOOGLE_CLIENT_ID ||
        'vulp-demo-client-id.apps.googleusercontent.com',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'vulp-demo-client-secret',
      redirectUri:
        process.env.GOOGLE_REDIRECT_URI ||
        'http://localhost:3000/api/auth/callback/google',
      isConfigured: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    };
  }

  /**
   * Generates a CSRF-protected state nonce and returns the Google OAuth authorization URL.
   */
  public static generateGoogleAuthUrl(origin?: string): { url: string; state: string } {
    this.cleanExpiredStates();

    const config = this.getGoogleConfig();
    const state = crypto.randomBytes(24).toString('hex');
    this.states.set(state, {
      state,
      createdAt: Date.now(),
      origin,
      redirectUri: config.redirectUri,
    });

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
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { url, state };
  }

  /**
   * Retrieves and consumes state nonce to prevent CSRF attacks.
   */
  public static consumeState(state: string): OAuthStateRecord | null {
    this.cleanExpiredStates();
    if (!state || !this.states.has(state)) {
      return null;
    }
    const record = this.states.get(state) || null;
    this.states.delete(state);
    return record;
  }

  /**
   * Validates state nonce to prevent CSRF attacks (backwards compatibility).
   */
  public static validateState(state: string): boolean {
    return Boolean(this.consumeState(state));
  }

  /**
   * Exchanges authorization code for tokens and persists encrypted credential.
   */
  public static async handleGoogleCodeExchange(
    code: string,
    redirectUri?: string
  ): Promise<{ id: string; name: string; email: string }> {
    const config = this.getGoogleConfig();
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri || config.redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      let errMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error_description || parsed.error || errText;
      } catch {}
      throw new Error(`Google token exchange failed (${tokenRes.status}): ${errMsg}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      id_token?: string;
    };

    // Retrieve user profile email and name
    let userInfo: GoogleUserInfo = {};
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        userInfo = (await userRes.json()) as GoogleUserInfo;
      }
    } catch {
      // Non-critical, fallback to default naming
    }

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
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    };

    const dataEnc = encrypt(JSON.stringify(secretPayload));

    // Check if an existing Google credential exists with the same email, update it or insert new
    const existingList = db.select().from(credentials).where(eq(credentials.type, 'google')).all();
    let matchedExistingId: string | null = null;

    for (const c of existingList) {
      try {
        const decrypted = JSON.parse(decrypt(c.dataEnc));
        if (decrypted.email === email) {
          matchedExistingId = c.id;
          break;
        }
      } catch {}
    }

    if (matchedExistingId) {
      db.update(credentials)
        .set({
          name,
          dataEnc,
        })
        .where(eq(credentials.id, matchedExistingId))
        .run();
      return { id: matchedExistingId, name, email };
    }

    db.insert(credentials)
      .values({
        id,
        name,
        type: 'google',
        dataEnc,
        createdAt: now,
      })
      .run();

    return { id, name, email };
  }

  /**
   * Refreshes an expired Google access token using the stored refresh_token.
   */
  public static async refreshGoogleToken(
    credentialId: string,
    storedSecrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const refreshToken = storedSecrets.refreshToken;
    if (!refreshToken) {
      return storedSecrets;
    }

    const config = this.getGoogleConfig();
    const clientId = storedSecrets.clientId || config.clientId;
    const clientSecret = storedSecrets.clientSecret || config.clientSecret;

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn(`Failed to refresh Google token for ${credentialId}:`, errText);
      return storedSecrets;
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
    };

    const updatedSecrets = {
      ...storedSecrets,
      accessToken: tokenData.access_token,
      expiresAt: String(Date.now() + (tokenData.expires_in || 3600) * 1000),
    };

    // Save refreshed token encrypted back to database
    try {
      const dataEnc = encrypt(JSON.stringify(updatedSecrets));
      db.update(credentials)
        .set({ dataEnc })
        .where(eq(credentials.id, credentialId))
        .run();
    } catch (dbErr) {
      console.warn('Failed to persist refreshed token to db:', dbErr);
    }

    return updatedSecrets;
  }
}

