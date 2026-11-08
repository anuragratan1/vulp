import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthService } from '../src/services/OAuthService.js';
import { createServer } from '../src/index.js';
import { db } from '../src/db/index.js';
import { credentials } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { credentialVault } from '../src/security/CredentialVault.js';
import { encrypt, decrypt } from '../src/security/crypto.js';

describe('OAuth 2.0 & Token Refresh Architecture', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('generates secure CSRF state and Google OAuth URL with proper scopes', () => {
    const { url, state } = OAuthService.generateGoogleAuthUrl();

    expect(state).toBeDefined();
    expect(state.length).toBeGreaterThan(16);
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain(`state=${state}`);
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.send'));
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/spreadsheets'));

    // Verify state validation
    const validFirstTime = OAuthService.validateState(state);
    expect(validFirstTime).toBe(true);

    // State must be single-use (CSRF replay prevention)
    const validSecondTime = OAuthService.validateState(state);
    expect(validSecondTime).toBe(false);

    // Invalid state rejected
    expect(OAuthService.validateState('fake_state_12345')).toBe(false);
  });

  it('exchanges authorization code, fetches user info, and encrypts credential in CredentialVault', async () => {
    const mockToken = 'mock_oauth_access_token_123';
    const mockRefresh = 'mock_oauth_refresh_token_456';
    const mockEmail = 'dev.lead@vulp.io';

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: mockToken,
            refresh_token: mockRefresh,
            expires_in: 3600,
            token_type: 'Bearer',
          }),
        };
      }
      if (url.includes('googleapis.com/oauth2/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'google_user_123',
            email: mockEmail,
            name: 'Dev Lead',
          }),
        };
      }
      return { ok: false, status: 404 };
    });
    globalThis.fetch = mockFetch;

    const result = await OAuthService.handleGoogleCodeExchange('mock_auth_code_xyz');
    expect(result.id).toBeDefined();
    expect(result.email).toBe(mockEmail);
    expect(result.name).toBe(`Google (${mockEmail})`);

    // Verify stored in DB encrypted
    const row = db.select().from(credentials).where(eq(credentials.id, result.id)).get();
    expect(row).toBeDefined();
    expect(row?.type).toBe('google');
    expect(row?.dataEnc).not.toContain(mockToken); // Must be encrypted!

    // Verify CredentialVault can decrypt it
    const decrypted = await credentialVault.get(result.id);
    expect(decrypted.accessToken).toBe(mockToken);
    expect(decrypted.refreshToken).toBe(mockRefresh);
    expect(decrypted.email).toBe(mockEmail);
  });

  it('automatically refreshes expiring Google OAuth token when accessed via CredentialVault', async () => {
    const originalToken = 'initial_expired_token';
    const refreshToken = 'valid_refresh_token_999';
    const newToken = 'fresh_refreshed_access_token_2026';

    const testCredId = 'test_refresh_cred_' + Date.now();
    const expiredTime = Date.now() - 5000; // Expired 5 seconds ago

    const secretsPayload = {
      accessToken: originalToken,
      refreshToken: refreshToken,
      expiresAt: String(expiredTime),
      email: 'auto.refresh@vulp.io',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    };

    db.insert(credentials)
      .values({
        id: testCredId,
        name: 'Google Auto Refresh Test',
        type: 'google',
        dataEnc: encrypt(JSON.stringify(secretsPayload)),
        createdAt: Date.now(),
      })
      .run();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: newToken,
        expires_in: 3600,
      }),
    });
    globalThis.fetch = mockFetch;

    // Call credentialVault.get - it should detect expiration and refresh automatically
    const retrieved = await credentialVault.get(testCredId);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(retrieved.accessToken).toBe(newToken);
    expect(Number(retrieved.expiresAt)).toBeGreaterThan(Date.now() + 3000 * 1000);

    // Verify database was updated with new encrypted token
    const updatedRow = db.select().from(credentials).where(eq(credentials.id, testCredId)).get();
    const parsedDecrypted = JSON.parse(decrypt(updatedRow!.dataEnc));
    expect(parsedDecrypted.accessToken).toBe(newToken);
  });
});
