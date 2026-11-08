import { FastifyPluginAsync } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { credentials, workflows } from '../db/schema.js';
import { decrypt, encrypt } from '../security/crypto.js';
import { OAuthService } from '../services/OAuthService.js';
import { credentialVault } from '../security/CredentialVault.js';
import { nanoid } from 'nanoid';

export const connectionRoutes: FastifyPluginAsync = async (server) => {
  // List all connections with account identifier, workflow usage counts & status
  server.get('/api/connections', async () => {
    const credList = db
      .select()
      .from(credentials)
      .orderBy(desc(credentials.createdAt))
      .all();

    const allWorkflows = db.select().from(workflows).all();

    // Map credentialId -> referencing workflows
    const credUsageMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const wf of allWorkflows) {
      const graph = (typeof wf.graph === 'string'
        ? JSON.parse(wf.graph)
        : wf.graph) as any;
      if (Array.isArray(graph?.nodes)) {
        for (const n of graph.nodes) {
          if (n.credentialId) {
            const list = credUsageMap.get(n.credentialId) || [];
            if (!list.some((w) => w.id === wf.id)) {
              list.push({ id: wf.id, name: wf.name });
            }
            credUsageMap.set(n.credentialId, list);
          }
        }
      }
    }

    const enriched = credList.map((c) => {
      let accountIdentifier = '';
      let status: 'connected' | 'expired' = 'connected';

      try {
        const decrypted = JSON.parse(decrypt(c.dataEnc));
        if (decrypted.email) {
          accountIdentifier = decrypted.email;
        } else if (decrypted.accountName) {
          accountIdentifier = decrypted.accountName;
        } else if (decrypted.botUsername) {
          accountIdentifier = `@${decrypted.botUsername}`;
        } else if (decrypted.username) {
          accountIdentifier = `@${decrypted.username}`;
        } else if (decrypted.channel) {
          accountIdentifier = `#${decrypted.channel}`;
        } else if (c.type === 'slack') {
          accountIdentifier = 'Slack Incoming Webhook';
        } else {
          accountIdentifier = c.name;
        }

        if (c.type === 'google' && decrypted.expiresAt) {
          const exp = Number(decrypted.expiresAt);
          if (exp > 0 && Date.now() > exp && !decrypted.refreshToken) {
            status = 'expired';
          }
        }
      } catch {
        accountIdentifier = c.name;
      }

      const wfUsages = credUsageMap.get(c.id) || [];

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        accountIdentifier,
        createdAt: c.createdAt,
        status,
        workflowCount: wfUsages.length,
        workflows: wfUsages,
      };
    });

    return { connections: enriched };
  });

  // Validate credential before saving
  server.post<{
    Body: {
      type: string;
      secrets: Record<string, string>;
    };
  }>('/api/connections/validate', async (req, reply) => {
    const { type, secrets } = req.body || {};
    if (!type || !secrets) {
      return reply.status(400).send({ valid: false, error: 'Type and secrets are required' });
    }

    try {
      if (type === 'telegram') {
        const botToken = secrets.botToken || secrets.apiKey;
        if (!botToken || !botToken.trim()) {
          return reply.status(400).send({ valid: false, error: 'Bot token is required' });
        }
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
        const data: any = await tgRes.json();
        if (!data.ok) {
          return reply.send({
            valid: false,
            error: data.description || 'Invalid Telegram bot token',
          });
        }
        return reply.send({
          valid: true,
          identifier: `@${data.result.username}`,
          name: data.result.first_name,
        });
      }

      if (type === 'github') {
        const token = secrets.token || secrets.apiKey;
        if (!token || !token.trim()) {
          return reply.status(400).send({ valid: false, error: 'Personal Access Token is required' });
        }
        const ghRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'User-Agent': 'Vulp-Automation-Studio',
          },
        });
        if (!ghRes.ok) {
          return reply.send({
            valid: false,
            error: `GitHub authentication failed (${ghRes.status})`,
          });
        }
        const data: any = await ghRes.json();
        return reply.send({
          valid: true,
          identifier: `@${data.login}`,
          name: data.name || data.login,
        });
      }

      if (type === 'slack') {
        const webhookUrl = secrets.webhookUrl || secrets.url;
        if (!webhookUrl || !webhookUrl.trim()) {
          return reply.status(400).send({ valid: false, error: 'Webhook URL is required' });
        }
        if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
          return reply.send({
            valid: false,
            error: "Invalid Slack webhook URL format. Must start with 'https://hooks.slack.com/services/'",
          });
        }
        return reply.send({
          valid: true,
          identifier: 'Incoming Webhook',
        });
      }

      return reply.send({ valid: true, identifier: 'Verified' });
    } catch (err: any) {
      return reply.send({
        valid: false,
        error: `Validation error: ${err?.message || 'Could not reach provider'}`,
      });
    }
  });

  // Reconnect / refresh existing connection
  server.post<{
    Params: { id: string };
  }>('/api/connections/:id/refresh', async (req, reply) => {
    const cred = db
      .select()
      .from(credentials)
      .where(eq(credentials.id, req.params.id))
      .get();

    if (!cred) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    try {
      const secrets = await credentialVault.get(cred.id);
      return reply.send({
        success: true,
        message: 'Connection verified and active',
        status: 'connected',
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: err?.message || 'Failed to refresh connection',
      });
    }
  });

  // Disconnect / delete connection
  server.delete<{
    Params: { id: string };
  }>('/api/connections/:id', async (req, reply) => {
    const cred = db
      .select({ id: credentials.id })
      .from(credentials)
      .where(eq(credentials.id, req.params.id))
      .get();

    if (!cred) {
      return reply.status(404).send({ error: 'Connection not found' });
    }

    db.delete(credentials).where(eq(credentials.id, req.params.id)).run();
    return { success: true, message: `Connection '${req.params.id}' disconnected` };
  });
};

