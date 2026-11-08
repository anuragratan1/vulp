import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { credentialVault } from '../src/security/CredentialVault.js';
import { db } from '../src/db/index.js';
import { credentials } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Credential Management & Vault APIs', () => {
  let app: FastifyInstance;
  let createdCredId: string;

  beforeAll(async () => {
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    if (createdCredId) {
      db.delete(credentials).where(eq(credentials.id, createdCredId)).run();
    }
    await app.close();
  });

  it('POST /api/credentials creates a credential and encrypts secret payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/credentials',
      payload: {
        name: 'Production Stripe Key',
        type: 'apiKey',
        data: {
          apiKey: 'sk_live_very_secret_key_12345',
          headerName: 'x-api-key',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.credential).toBeDefined();
    expect(body.credential.id).toBeDefined();
    expect(body.credential.name).toBe('Production Stripe Key');
    expect(body.credential.type).toBe('apiKey');

    // CRITICAL SECURITY CHECK: secret values must NEVER appear in API response
    expect(res.payload).not.toContain('sk_live_very_secret_key_12345');
    expect(body.credential.dataEnc).toBeUndefined();
    expect(body.credential.data).toBeUndefined();

    createdCredId = body.credential.id;

    // Verify stored in DB as ciphertext
    const stored = db.select().from(credentials).where(eq(credentials.id, createdCredId)).get();
    expect(stored).toBeDefined();
    expect(stored!.dataEnc).toBeDefined();
    expect(stored!.dataEnc).not.toContain('sk_live_very_secret_key_12345');
    expect(stored!.dataEnc).toContain(':'); // iv:tag:cipher format
  });

  it('GET /api/credentials returns list of credentials without secret data', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/credentials',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.credentials)).toBe(true);

    const found = body.credentials.find((c: any) => c.id === createdCredId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Production Stripe Key');
    expect(found.type).toBe('apiKey');
    expect(found.dataEnc).toBeUndefined();
    expect(found.data).toBeUndefined();
    expect(res.payload).not.toContain('sk_live_very_secret_key_12345');
  });

  it('GET /api/credentials/:id retrieves metadata only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/credentials/${createdCredId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.credential.id).toBe(createdCredId);
    expect(body.credential.name).toBe('Production Stripe Key');
    expect(res.payload).not.toContain('sk_live_very_secret_key_12345');
  });

  it('CredentialVault.get() resolves and decrypts secrets for the engine', async () => {
    const secrets = await credentialVault.get(createdCredId);
    expect(secrets).toEqual({
      apiKey: 'sk_live_very_secret_key_12345',
      headerName: 'x-api-key',
    });
  });

  it('PUT /api/credentials/:id updates credential name and re-encrypts updated secrets', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/credentials/${createdCredId}`,
      payload: {
        name: 'Updated Stripe Key',
        data: {
          apiKey: 'sk_live_updated_secret_99999',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.credential.name).toBe('Updated Stripe Key');
    expect(res.payload).not.toContain('sk_live_updated_secret_99999');

    // Decrypt updated secret via vault
    const updatedSecrets = await credentialVault.get(createdCredId);
    expect(updatedSecrets).toEqual({
      apiKey: 'sk_live_updated_secret_99999',
    });
  });

  it('workflow execution redacts credentials and secrets from logs and outputs', async () => {
    // Create workflow with a node referencing this credential
    const wfRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: {
        name: 'Workflow with Secrets',
        graph: {
          nodes: [
            {
              key: 'trig',
              type: 'manual.trigger',
              name: 'Trigger',
              position: { x: 0, y: 0 },
              params: {},
            },
            {
              key: 'http_step',
              type: 'http.request',
              name: 'Secure API Call',
              position: { x: 200, y: 0 },
              credentialId: createdCredId,
              params: {
                method: 'POST',
                url: 'https://httpbin.org/post',
                body: {
                  note: 'testing redaction',
                },
              },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'trig',
              sourcePort: 'default',
              target: 'http_step',
            },
          ],
        },
      },
    });

    const wf = JSON.parse(wfRes.payload).workflow;

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${wf.id}/run`,
      payload: {},
    });
    const runId = JSON.parse(runRes.payload).runId;

    // Wait for run completion
    let attempts = 0;
    let runDetails: any = null;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 100));
      const detRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runId}`,
      });
      runDetails = JSON.parse(detRes.payload);
      if (runDetails.run.status === 'succeeded' || runDetails.run.status === 'failed') {
        break;
      }
      attempts++;
    }

    expect(runDetails).toBeDefined();
    const detailsJson = JSON.stringify(runDetails);

    // CRITICAL: The secret must NEVER appear anywhere in the stored run details, logs, or outputs
    expect(detailsJson).not.toContain('sk_live_updated_secret_99999');

    // Clean up test workflow
    await app.inject({
      method: 'DELETE',
      url: `/api/workflows/${wf.id}`,
    });
  });

  it('DELETE /api/credentials/:id deletes credential', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/credentials/${createdCredId}`,
    });

    expect(res.statusCode).toBe(200);

    const check = await app.inject({
      method: 'GET',
      url: `/api/credentials/${createdCredId}`,
    });
    expect(check.statusCode).toBe(404);
  });
});
