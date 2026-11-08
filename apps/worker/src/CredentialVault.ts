import { ICredentialStore } from '@workflow/engine';
import { eq } from 'drizzle-orm';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema.js';
import { decrypt, encrypt, getMasterKeyBuffer } from './crypto.js';

export class WorkerCredentialVault implements ICredentialStore {
  constructor(
    private readonly db: DrizzleD1Database<typeof schema>,
    private readonly masterKey: Buffer,
    private readonly defaultWorkspaceId?: string
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
      return JSON.parse(decrypted);
    } catch (err: any) {
      throw new Error(`Failed to decrypt credential '${id}': ${err?.message}`);
    }
  }

  public forWorkspace(workspaceId: string): WorkerCredentialVault {
    return new WorkerCredentialVault(this.db, this.masterKey, workspaceId);
  }

  public encryptSecrets(secrets: Record<string, string>): string {
    return encrypt(JSON.stringify(secrets), this.masterKey);
  }

  public decryptSecrets(ciphertext: string): Record<string, string> {
    return JSON.parse(decrypt(ciphertext, this.masterKey));
  }
}

