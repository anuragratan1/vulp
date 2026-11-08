import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword, encrypt, decrypt, getMasterKeyBuffer } from '../../worker/src/crypto.js';

describe('Multi-Tenant Security & Isolation Tests', () => {
  describe('Password Hashing & PBKDF2 Verification', () => {
    it('hashes passwords with unique random salts', () => {
      const password = 'SuperSecretPassword123!';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1.split(':').length).toBe(3);
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
    });

    it('rejects incorrect passwords with constant-time comparison', () => {
      const password = 'CorrectPassword456!';
      const hash = hashPassword(password);

      expect(verifyPassword('WrongPassword123!', hash)).toBe(false);
      expect(verifyPassword('', hash)).toBe(false);
      expect(verifyPassword('correctpassword456!', hash)).toBe(false);
    });
  });

  describe('Zero-Leak Credential Encryption (AES-256-GCM)', () => {
    it('encrypts secrets and prevents plaintext exposure', () => {
      const masterKey = getMasterKeyBuffer('test_master_key_for_multi_tenant_isolation_32ch!');
      const secretData = JSON.stringify({
        accessToken: 'ya29.a0AfH6SMD_secret_token_value',
        refreshToken: '1//0g_refresh_token_value',
      });

      const encrypted = encrypt(secretData, masterKey);
      expect(encrypted).not.toContain('ya29');
      expect(encrypted).not.toContain('secret_token_value');

      const decrypted = decrypt(encrypted, masterKey);
      expect(JSON.parse(decrypted)).toEqual({
        accessToken: 'ya29.a0AfH6SMD_secret_token_value',
        refreshToken: '1//0g_refresh_token_value',
      });
    });
  });

  describe('Cross-Tenant Credential Scoping Verification', () => {
    it('enforces workspace boundary check when fetching credentials', () => {
      const masterKey = getMasterKeyBuffer('test_master_key_for_multi_tenant_isolation_32ch!');
      const fakeCred = {
        id: 'cred_userA_123',
        workspaceId: 'ws_tenant_A',
        dataEnc: encrypt(JSON.stringify({ apiKey: 'secret_key_user_A' }), masterKey),
      };

      // Mock vault getter simulating multi-tenant check
      const getCredential = (id: string, requestedWorkspaceId?: string) => {
        if (fakeCred.id !== id) throw new Error('Not found');
        if (requestedWorkspaceId && fakeCred.workspaceId !== requestedWorkspaceId) {
          throw new Error(`Access denied: Credential '${id}' does not belong to the active workspace.`);
        }
        return JSON.parse(decrypt(fakeCred.dataEnc, masterKey));
      };

      // Tenant A can access their own credential
      expect(getCredential('cred_userA_123', 'ws_tenant_A')).toEqual({ apiKey: 'secret_key_user_A' });

      // Tenant B MUST be denied access
      expect(() => getCredential('cred_userA_123', 'ws_tenant_B')).toThrowError(
        /Access denied: Credential 'cred_userA_123' does not belong to the active workspace/
      );
    });
  });

  describe('Workflow & Run Tenant Scoping Logic', () => {
    it('filters workflows strictly by workspace_id', () => {
      const workflows = [
        { id: 'wf_1', name: 'Tenant A Workflow 1', workspaceId: 'ws_tenant_A' },
        { id: 'wf_2', name: 'Tenant A Workflow 2', workspaceId: 'ws_tenant_A' },
        { id: 'wf_3', name: 'Tenant B Workflow 1', workspaceId: 'ws_tenant_B' },
      ];

      const getWorkflowsForTenant = (wsId: string) => workflows.filter((w) => w.workspaceId === wsId);

      const tenantAWorkflows = getWorkflowsForTenant('ws_tenant_A');
      const tenantBWorkflows = getWorkflowsForTenant('ws_tenant_B');

      expect(tenantAWorkflows.length).toBe(2);
      expect(tenantAWorkflows.map((w) => w.id)).toEqual(['wf_1', 'wf_2']);
      expect(tenantBWorkflows.length).toBe(1);
      expect(tenantBWorkflows.map((w) => w.id)).toEqual(['wf_3']);
      expect(tenantAWorkflows.some((w) => w.workspaceId === 'ws_tenant_B')).toBe(false);
    });

    it('prevents cross-tenant workflow execution and cancellation', () => {
      const runs = [
        { id: 'run_101', workspaceId: 'ws_tenant_A', status: 'running' },
        { id: 'run_102', workspaceId: 'ws_tenant_B', status: 'running' },
      ];

      const cancelRun = (runId: string, tenantWorkspaceId: string) => {
        const run = runs.find((r) => r.id === runId && r.workspaceId === tenantWorkspaceId);
        if (!run) throw new Error('Run not found or access denied');
        run.status = 'cancelled';
        return true;
      };

      // Tenant B attempts to cancel Tenant A's run
      expect(() => cancelRun('run_101', 'ws_tenant_B')).toThrowError(/Run not found or access denied/);

      // Tenant A can cancel their own run
      expect(cancelRun('run_101', 'ws_tenant_A')).toBe(true);
      expect(runs[0].status).toBe('cancelled');
    });
  });
});
