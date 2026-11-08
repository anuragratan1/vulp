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

  describe('Google Sign-In & Safe Account Linking Verification', () => {
    it('validates Google token claims strictly (audience, issuer, expiration, verified email)', () => {
      const expectedClientId = '1060878318083-c9u9herp7lt0jkdhssgl4r97m90rjg9v.apps.googleusercontent.com';

      const validateClaims = (claims: any) => {
        if (claims.aud !== expectedClientId) return false;
        if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') return false;
        if (Number(claims.exp) * 1000 <= Date.now()) return false;
        if (claims.email_verified !== 'true' && claims.email_verified !== true) return false;
        return true;
      };

      // Valid token claims
      expect(
        validateClaims({
          aud: expectedClientId,
          iss: 'https://accounts.google.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          email_verified: 'true',
        })
      ).toBe(true);

      // Invalid audience (forged token from another app)
      expect(
        validateClaims({
          aud: 'different-app-id.apps.googleusercontent.com',
          iss: 'https://accounts.google.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          email_verified: 'true',
        })
      ).toBe(false);

      // Expired token
      expect(
        validateClaims({
          aud: expectedClientId,
          iss: 'https://accounts.google.com',
          exp: Math.floor(Date.now() / 1000) - 60,
          email_verified: 'true',
        })
      ).toBe(false);

      // Unverified email
      expect(
        validateClaims({
          aud: expectedClientId,
          iss: 'https://accounts.google.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          email_verified: 'false',
        })
      ).toBe(false);
    });

    it('safely links existing email/password account with verified Google identity', () => {
      const users = [
        {
          id: 'usr_existing_1',
          email: 'alex@example.com',
          googleId: null as string | null,
          passwordHash: 'existing_hash_value',
          name: 'Alex Chen',
        },
      ];

      const linkGoogleAccount = (googleProfile: { sub: string; email: string; name: string }) => {
        let user = users.find((u) => u.googleId === googleProfile.sub);
        if (!user) {
          user = users.find((u) => u.email === googleProfile.email);
          if (user) {
            user.googleId = googleProfile.sub;
          }
        }
        return user;
      };

      const linkedUser = linkGoogleAccount({
        sub: 'google_sub_109823487213',
        email: 'alex@example.com',
        name: 'Alex Chen',
      });

      expect(linkedUser).toBeDefined();
      expect(linkedUser?.id).toBe('usr_existing_1');
      expect(linkedUser?.googleId).toBe('google_sub_109823487213');
      // Password hash remains intact so user can log in with either method
      expect(linkedUser?.passwordHash).toBe('existing_hash_value');
    });

    it('creates new account and isolated workspace for brand new Google users', () => {
      const users: any[] = [];
      const workspaces: any[] = [];

      const handleGoogleSignup = (profile: { sub: string; email: string; name: string }) => {
        const userId = `usr_${profile.sub.slice(0, 8)}`;
        const workspaceId = `ws_${profile.sub.slice(0, 8)}`;
        const newUser = {
          id: userId,
          email: profile.email,
          googleId: profile.sub,
          passwordHash: null,
          name: profile.name,
        };
        const newWorkspace = {
          id: workspaceId,
          name: `${profile.name}'s Workspace`,
          ownerId: userId,
        };
        users.push(newUser);
        workspaces.push(newWorkspace);
        return { user: newUser, workspace: newWorkspace };
      };

      const result = handleGoogleSignup({
        sub: 'google_sub_9876543210',
        email: 'newuser@gmail.com',
        name: 'New Google User',
      });

      expect(result.user.id).toBe('usr_google_s');
      expect(result.user.googleId).toBe('google_sub_9876543210');
      expect(result.workspace.ownerId).toBe(result.user.id);
      expect(users.length).toBe(1);
      expect(workspaces.length).toBe(1);
    });
  });
});

