import { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { credentials } from '../db/schema.js';
import { credentialVault } from '../security/CredentialVault.js';

export const credentialRoutes: FastifyPluginAsync = async (server) => {
  // List all credentials (metadata only - never secrets)
  server.get('/api/credentials', async () => {
    const list = db
      .select({
        id: credentials.id,
        name: credentials.name,
        type: credentials.type,
        createdAt: credentials.createdAt,
      })
      .from(credentials)
      .orderBy(desc(credentials.createdAt))
      .all();

    return { credentials: list };
  });

  // Get single credential metadata (never secrets)
  server.get<{
    Params: { id: string };
  }>('/api/credentials/:id', async (req, reply) => {
    const cred = db
      .select({
        id: credentials.id,
        name: credentials.name,
        type: credentials.type,
        createdAt: credentials.createdAt,
      })
      .from(credentials)
      .where(eq(credentials.id, req.params.id))
      .get();

    if (!cred) {
      return reply.status(404).send({ error: 'Credential not found' });
    }

    return { credential: cred };
  });

  // Create credential
  server.post<{
    Body: {
      name: string;
      type: string;
      data: Record<string, string>;
    };
  }>('/api/credentials', async (req, reply) => {
    const name = req.body?.name?.trim();
    const type = req.body?.type?.trim() || 'generic';
    const data = req.body?.data;

    if (!name) {
      return reply.status(400).send({ error: "Field 'name' is required" });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return reply.status(400).send({ error: "Field 'data' must be an object of secret key-value pairs" });
    }

    const id = nanoid();
    const now = Date.now();
    const dataEnc = credentialVault.encryptSecrets(data);

    db.insert(credentials)
      .values({
        id,
        name,
        type,
        dataEnc,
        createdAt: now,
      })
      .run();

    return reply.status(201).send({
      credential: {
        id,
        name,
        type,
        createdAt: now,
      },
    });
  });

  // Update credential
  server.put<{
    Params: { id: string };
    Body: {
      name?: string;
      type?: string;
      data?: Record<string, string>;
    };
  }>('/api/credentials/:id', async (req, reply) => {
    const existing = db
      .select()
      .from(credentials)
      .where(eq(credentials.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Credential not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const type = req.body.type !== undefined ? req.body.type.trim() : existing.type;
    let dataEnc = existing.dataEnc;

    if (req.body.data !== undefined) {
      if (typeof req.body.data !== 'object' || Array.isArray(req.body.data)) {
        return reply.status(400).send({ error: "Field 'data' must be an object of secret key-value pairs" });
      }
      dataEnc = credentialVault.encryptSecrets(req.body.data);
    }

    db.update(credentials)
      .set({
        name,
        type,
        dataEnc,
      })
      .where(eq(credentials.id, req.params.id))
      .run();

    return {
      credential: {
        id: existing.id,
        name,
        type,
        createdAt: existing.createdAt,
      },
    };
  });

  // Delete credential
  server.delete<{
    Params: { id: string };
  }>('/api/credentials/:id', async (req, reply) => {
    const existing = db
      .select({ id: credentials.id })
      .from(credentials)
      .where(eq(credentials.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Credential not found' });
    }

    db.delete(credentials).where(eq(credentials.id, req.params.id)).run();

    return { success: true, message: `Credential '${req.params.id}' deleted` };
  });
};

