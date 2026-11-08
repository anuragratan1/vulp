import { ICredentialStore, NodeError } from '@workflow/engine';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { encrypt, decrypt } from './crypto.js';
import { OAuthService } from '../services/OAuthService.js';

export interface CredentialMetadata {
  id: string;
  name: string;
  type: string;
  createdAt: number;
}

export class CredentialVault implements ICredentialStore {
  /**
   * ICredentialStore implementation for the workflow engine.
   * Decrypts and returns the key-value secrets dictionary.
   * Automatically refreshes expired OAuth tokens for supported providers (Google).
   */
  async get(id: string): Promise<Record<string, string>> {
    const cred = db.select().from(credentials).where(eq(credentials.id, id)).get();
    if (!cred) {
      throw new NodeError(`Credential '${id}' was not found.`, false);
    }

    try {
      const decryptedJson = decrypt(cred.dataEnc);
      const parsed = JSON.parse(decryptedJson);
      if (typeof parsed !== 'object' || parsed === null) {
        return {};
      }

      let secrets = parsed as Record<string, string>;

      // Auto-refresh Google OAuth token if close to expiry
      if (cred.type === 'google' && secrets.refreshToken) {
        const expiresAtNum = secrets.expiresAt ? Number(secrets.expiresAt) : 0;
        const isExpiring = expiresAtNum > 0 && Date.now() > expiresAtNum - 60 * 1000;
        if (isExpiring) {
          try {
            secrets = await OAuthService.refreshGoogleToken(id, secrets);
          } catch (refreshErr) {
            console.warn(`[CredentialVault] Error refreshing token for ${id}:`, refreshErr);
          }
        }
      }

      return secrets;
    } catch (err: any) {
      if (err instanceof NodeError) throw err;
      throw new NodeError(`Failed to decrypt credential '${id}': verification failed`, false);
    }
  }

  /**
   * Helper to encrypt secret payload.
   */
  encryptSecrets(data: Record<string, string>): string {
    return encrypt(JSON.stringify(data));
  }
}

export const credentialVault = new CredentialVault();
