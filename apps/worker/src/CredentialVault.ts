import { ICredentialStore } from '@workflow/engine';
import { eq } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.js';
import { decrypt, encrypt } from './crypto.js';

export interface GoogleOAuthClientConfig {
  clientId?: string;
  clientSecret?: string;
}

export class WorkerCredentialVault implements ICredentialStore {
  constructor(
    private readonly db: DrizzleD1Database<typeof schema>,
    private readonly masterKey: Buffer,
    private readonly defaultWorkspaceId?: string,
    private readonly googleConfig?: GoogleOAuthClientConfig
  ) {}

  public async get(id: string, workspaceId?: string): Promise<Record<string, string>> {
    const cred = await this.db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.id, id))
      .get();

    if (!cred) {
      throw new Error(`Credential '${id}' was not found.`);
    }

    const targetWs = workspaceId || this.defaultWorkspaceId;
    if (targetWs && cred.workspaceId && cred.workspaceId !== targetWs) {
      throw new Error(`Access denied: Credential '${id}' does not belong to the active workspace.`);
    }

    try {
      const decrypted = decrypt(cred.dataEnc, this.masterKey);
      let secrets: Record<string, string> = JSON.parse(decrypted);

      // Auto-refresh Google OAuth access token if expired or about to expire (< 5 mins remaining)
      if (cred.type === 'google' && secrets.refreshToken) {
        const expiresAtNum = secrets.expiresAt ? Number(secrets.expiresAt) : 0;
        const isExpiring = !expiresAtNum || Date.now() > expiresAtNum - 5 * 60 * 1000;
        if (isExpiring) {
          try {
            secrets = await this.refreshGoogleToken(id, secrets);
          } catch (refreshErr) {
            console.warn(`[WorkerCredentialVault] Error auto-refreshing Google token for ${id}:`, refreshErr);
          }
        }
      }

      return secrets;
    } catch (err: any) {
      throw new Error(`Failed to decrypt credential '${id}': ${err?.message}`);
    }
  }

  public async refreshGoogleToken(
    credentialId: string,
    storedSecrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const refreshToken = storedSecrets.refreshToken;
    if (!refreshToken) {
      return storedSecrets;
    }

    const clientId = storedSecrets.clientId || this.googleConfig?.clientId || '';
    const clientSecret = storedSecrets.clientSecret || this.googleConfig?.clientSecret || '';

    if (!clientId || !clientSecret) {
      console.warn(`[WorkerCredentialVault] Cannot refresh Google token: missing clientId/clientSecret`);
      return storedSecrets;
    }

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
      console.warn(`[WorkerCredentialVault] Google token refresh failed for ${credentialId}: ${errText}`);
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

    // Save refreshed token encrypted back to D1 database
    try {
      const dataEnc = this.encryptSecrets(updatedSecrets);
      await this.db
        .update(schema.credentials)
        .set({ dataEnc })
        .where(eq(schema.credentials.id, credentialId));
      console.log(`[WorkerCredentialVault] Successfully refreshed and persisted Google token for ${credentialId}`);
    } catch (dbErr) {
      console.warn('[WorkerCredentialVault] Failed to persist refreshed token to D1:', dbErr);
    }

    return updatedSecrets;
  }

  public forWorkspace(workspaceId: string): WorkerCredentialVault {
    return new WorkerCredentialVault(this.db, this.masterKey, workspaceId, this.googleConfig);
  }

  public encryptSecrets(secrets: Record<string, string>): string {
    return encrypt(JSON.stringify(secrets), this.masterKey);
  }

  public decryptSecrets(ciphertext: string): Record<string, string> {
    return JSON.parse(decrypt(ciphertext, this.masterKey));
  }
}

