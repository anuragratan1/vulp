import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { Cron } from 'croner';
import {
  createDefaultNodeRegistry,
  GraphValidator,
  WorkflowGraph,
  Json,
  GmailSendEmailOperation,
  TelegramSendMessageOperation,
  redactBotToken,
} from '@workflow/engine';
import * as schema from './schema.js';
import { getMasterKeyBuffer } from './crypto.js';
import { WorkerCredentialVault } from './CredentialVault.js';
import { WorkerRunManager } from './RunManager.js';
import { WORKFLOW_TEMPLATES } from './templates.js';
import { googleApp } from './google.js';
import { authApp, verifySession, checkRateLimit } from './auth.js';

export interface Bindings {
  DB: D1Database;
  STORAGE?: R2Bucket;
  ASSETS?: Fetcher;
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  WF_MASTER_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  WEBHOOK_BASE_URL?: string;
}

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    user?: schema.User;
    workspace?: schema.Workspace;
  };
}>();

// Enable CORS across all API and webhook routes (supporting credentials with Vercel frontend)
app.use('*', async (c, next) => {
  const origin = c.env.CORS_ORIGIN || '*';
  return cors({
    origin: (requestOrigin) => {
      if (!requestOrigin) return '*';
      if (origin === '*') return requestOrigin;
      const allowed = origin.split(',').map((s) => s.trim());
      return allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Workspace-Id'],
    credentials: true,
  })(c, next);
});

// Helper to get Drizzle DB and Vault
function getServices(env: Bindings, workspaceId?: string) {
  const db = drizzle(env.DB, { schema });
  const masterKey = getMasterKeyBuffer(env.WF_MASTER_KEY);
  const vault = new WorkerCredentialVault(db, masterKey, workspaceId);
  const runManager = new WorkerRunManager(db, vault);
  return { db, vault, runManager, masterKey };
}

function getActiveWorkspace(c: any): schema.Workspace {
  const ws = c.get('workspace');
  if (ws) return ws;
  return {
    id: 'ws_init_default',
    name: 'Primary Workspace',
    ownerId: 'usr_init_admin',
    createdAt: 0,
    updatedAt: 0,
  };
}

// Mount Authentication & OAuth sub-apps
app.route('/', authApp);
app.route('/', googleApp);

// -----------------------------------------------------------------------------
// Rate Limiting & Multi-Tenant Context Middleware
// -----------------------------------------------------------------------------
app.use('/api/*', async (c, next) => {
  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'anon';
  if (!checkRateLimit(clientIp, 120, 60000)) {
    return c.json({ error: 'Too many requests', message: 'Rate limit exceeded. Please wait a moment.' }, 429);
  }

  const path = new URL(c.req.url).pathname;
  const isPublic =
    path === '/api/node-types' ||
    path.startsWith('/api/templates') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/signup') ||
    path.startsWith('/api/auth/forgot-password') ||
    path.startsWith('/api/auth/reset-password') ||
    path.startsWith('/api/auth/google') ||
    path.startsWith('/api/auth/callback/google');

  if (isPublic) {
    return next();
  }

  const authHeader = c.req.header('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const { db } = getServices(c.env);

  if (token) {
    const sessionData = await verifySession(db, token);
    if (sessionData) {
      c.set('user', sessionData.user);
      c.set('workspace', sessionData.workspace);
      return next();
    }
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired session. Please log in again.' }, 401);
  }

  // Fallback for initial workspace migration safety
  const defaultWs = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, 'ws_init_default'))
    .get();

  if (defaultWs) {
    c.set('workspace', defaultWs);
    return next();
  }

  return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
});

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------
app.get('/health', async (c) => {
  try {
    const { db } = getServices(c.env);
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({
      status: 'ok',
      timestamp: Date.now(),
      database: 'connected',
      version: '0.1.0',
      runtime: 'Cloudflare Workers (Edge)',
      multiTenant: true,
    });
  } catch (err: any) {
    return c.json(
      {
        status: 'unhealthy',
        error: err?.message || 'Database unavailable',
        timestamp: Date.now(),
      },
      503
    );
  }
});

// -----------------------------------------------------------------------------
// Node Types
// -----------------------------------------------------------------------------
app.get('/api/node-types', async (c) => {
  const registry = createDefaultNodeRegistry();
  return c.json({ nodeTypes: registry.getMetadataList() });
});

// -----------------------------------------------------------------------------
// Workflows CRUD (Scoped strictly by active workspace)
// -----------------------------------------------------------------------------
app.get('/api/workflows', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const list = await db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.workspaceId, ws.id))
    .orderBy(desc(schema.workflows.updatedAt))
    .all();
  return c.json({ workflows: list });
});

app.post('/api/workflows', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, runManager } = getServices(c.env, ws.id);
  const body = await c.req.json().catch(() => ({}));
  const id = nanoid();
  const now = Date.now();
  const name = body.name?.trim() || 'Untitled Automation';

  const initialGraph: WorkflowGraph = body.graph || {
    nodes: [
      {
        key: `trigger_${Date.now().toString(36)}`,
        type: 'manual.trigger',
        name: 'Manual Trigger',
        position: { x: 100, y: 150 },
        params: { payload: {} },
      },
    ],
    edges: [],
  };

  try {
    GraphValidator.validate(initialGraph, runManager.getRegistry());
  } catch (valErr: any) {
    return c.json({ error: 'Invalid workflow graph', details: valErr.message }, 400);
  }

  await db.insert(schema.workflows).values({
    id,
    workspaceId: ws.id,
    name,
    graph: initialGraph,
    active: false,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  return c.json({ workflow: created }, 201);
});

app.get('/api/workflows/:id', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const wf = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!wf) return c.json({ error: 'Workflow not found' }, 404);
  return c.json({ workflow: wf });
});

app.put('/api/workflows/:id', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, runManager } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const existing = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!existing) return c.json({ error: 'Workflow not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const graph = body.graph !== undefined ? body.graph : existing.graph;
  const active = body.active !== undefined ? Boolean(body.active) : existing.active;

  if (body.graph) {
    try {
      GraphValidator.validate(graph as WorkflowGraph, runManager.getRegistry());
    } catch (valErr: any) {
      return c.json({ error: 'Invalid workflow graph', details: valErr.message }, 400);
    }
  }

  await db
    .update(schema.workflows)
    .set({
      name,
      graph,
      active,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)));

  // Sync webhooks table for any webhook.trigger nodes
  const g = (typeof graph === 'string' ? JSON.parse(graph) : graph) as WorkflowGraph;
  for (const node of g.nodes || []) {
    if (node.type === 'webhook.trigger') {
      const token = String(node.params?.token || nanoid(24));
      await db
        .insert(schema.webhooks)
        .values({ token, workflowId: id, nodeKey: node.key })
        .onConflictDoNothing();
    }
  }

  const updated = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  return c.json({ workflow: updated });
});

app.delete('/api/workflows/:id', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const existing = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!existing) return c.json({ error: 'Workflow not found' }, 404);

  await db
    .delete(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)));
  return c.json({ success: true, message: `Workflow '${id}' deleted` });
});

async function syncWorkflowWebhooks(db: DrizzleD1Database<typeof schema>, workflow: schema.Workflow) {
  const graph = (typeof workflow.graph === 'string' ? JSON.parse(workflow.graph) : workflow.graph) as WorkflowGraph;
  const webhookNodes = (graph?.nodes || []).filter((n) => n.type === 'webhook.trigger');
  const activeNodeKeys = new Set(webhookNodes.map((n) => n.key));

  const currentRecords = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.workflowId, workflow.id))
    .all();

  for (const rec of currentRecords) {
    if (!activeNodeKeys.has(rec.nodeKey)) {
      await db.delete(schema.webhooks).where(eq(schema.webhooks.token, rec.token));
    }
  }

  const result: { token: string; workflowId: string; nodeKey: string }[] = [];
  for (const node of webhookNodes) {
    let existing = currentRecords.find((r) => r.nodeKey === node.key);
    if (!existing) {
      const token = String(node.params?.token || nanoid(24));
      await db.insert(schema.webhooks).values({ token, workflowId: workflow.id, nodeKey: node.key }).onConflictDoNothing();
      existing = { token, workflowId: workflow.id, nodeKey: node.key };
    }
    result.push(existing);
  }
  return result;
}

app.post('/api/workflows/:id/activate', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const existing = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!existing) return c.json({ error: 'Workflow not found' }, 404);

  const now = Date.now();
  await db
    .update(schema.workflows)
    .set({ active: true, updatedAt: now })
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)));

  const updated = (await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get())!;
  const webhooks = await syncWorkflowWebhooks(db, updated);

  return c.json({ workflow: updated, webhooks, active: true });
});

app.post('/api/workflows/:id/deactivate', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const existing = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!existing) return c.json({ error: 'Workflow not found' }, 404);

  const now = Date.now();
  await db
    .update(schema.workflows)
    .set({ active: false, updatedAt: now })
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)));

  const updated = (await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get())!;
  return c.json({ workflow: updated, active: false });
});

app.get('/api/workflows/:id/webhooks', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const workflow = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);

  const list = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.workflowId, id))
    .all();
  return c.json({ webhooks: list });
});

app.get('/api/workflows/:id/webhooks/:nodeKey/sample', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const nodeKey = c.req.param('nodeKey');
  const workflow = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);

  const graph = (typeof workflow.graph === 'string' ? JSON.parse(workflow.graph) : workflow.graph) as WorkflowGraph;
  const targetNode = graph.nodes?.find((n) => n.key === nodeKey);
  return c.json({
    nodeKey,
    samplePayload: targetNode?.params?.samplePayload || null,
  });
});

app.put('/api/workflows/:id/webhooks/:nodeKey/sample', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const nodeKey = c.req.param('nodeKey');
  const body = await c.req.json().catch(() => ({}));
  const samplePayload = body.samplePayload ?? {};

  const workflow = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);

  const graph = (typeof workflow.graph === 'string' ? JSON.parse(workflow.graph) : workflow.graph) as WorkflowGraph;
  const updatedNodes = (graph.nodes || []).map((node) => {
    if (node.key === nodeKey) {
      return {
        ...node,
        params: {
          ...node.params,
          samplePayload,
        },
      };
    }
    return node;
  });

  const updatedGraph = { ...graph, nodes: updatedNodes };
  await db
    .update(schema.workflows)
    .set({
      graph: updatedGraph,
      updatedAt: Date.now(),
    })
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)));

  return c.json({ success: true, nodeKey, samplePayload });
});

// -----------------------------------------------------------------------------
// Execution & Runs (Strict workspace isolation)
// -----------------------------------------------------------------------------
app.post('/api/workflows/:id/run', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, runManager } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const workflow = await db
    .select()
    .from(schema.workflows)
    .where(and(eq(schema.workflows.id, id), eq(schema.workflows.workspaceId, ws.id)))
    .get();
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);

  const body = await c.req.json().catch(() => ({}));

  try {
    const { runId, executionPromise } = await runManager.startRun(workflow, {
      triggerKey: body.triggerKey,
      triggerPayload: body.triggerPayload,
    });

    // Execute in the background using Cloudflare Workers execution context
    c.executionCtx.waitUntil(executionPromise);

    // Quick race so short workflows finish before response is sent
    await Promise.race([
      executionPromise,
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);

    return c.json(
      {
        runId,
        status: 'running',
        message: 'Workflow execution queued and started',
      },
      202
    );
  } catch (err: any) {
    return c.json({ error: 'Execution failed to start', details: err?.message || String(err) }, 400);
  }
});

app.get('/api/runs', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const list = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.workspaceId, ws.id))
    .orderBy(desc(schema.runs.queuedAt))
    .limit(50)
    .all();
  return c.json({ runs: list });
});

app.get('/api/runs/:runId', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const runId = c.req.param('runId');
  const run = await db
    .select()
    .from(schema.runs)
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.workspaceId, ws.id)))
    .get();
  if (!run) return c.json({ error: 'Run not found' }, 404);

  const nodeRuns = await db
    .select()
    .from(schema.nodeRuns)
    .where(eq(schema.nodeRuns.runId, runId))
    .orderBy(asc(schema.nodeRuns.seq))
    .all();

  return c.json({ run, nodeRuns });
});

app.post('/api/runs/:runId/cancel', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, runManager } = getServices(c.env, ws.id);
  const runId = c.req.param('runId');
  const run = await db
    .select()
    .from(schema.runs)
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.workspaceId, ws.id)))
    .get();
  if (!run) return c.json({ error: 'Run not found' }, 404);

  const success = await runManager.cancelRun(runId);
  if (!success) {
    return c.json(
      { error: 'Run cannot be cancelled', message: 'Execution not found or already finished' },
      400
    );
  }
  return c.json({ success: true, message: 'Run cancelled successfully', runId });
});

// SSE Events stream
app.get('/api/runs/:runId/events', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const runId = c.req.param('runId');

  const run = await db
    .select()
    .from(schema.runs)
    .where(and(eq(schema.runs.id, runId), eq(schema.runs.workspaceId, ws.id)))
    .get();
  if (!run) return c.json({ error: 'Run not found' }, 404);

  const nodeRuns = await db
    .select()
    .from(schema.nodeRuns)
    .where(eq(schema.nodeRuns.runId, runId))
    .orderBy(asc(schema.nodeRuns.seq))
    .all();

  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('snapshot', { run, nodeRuns });
      send('run.finished', { runId, status: run?.status || 'succeeded', error: run?.error });
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

// -----------------------------------------------------------------------------
// Credentials CRUD (Workspace scoped)
// -----------------------------------------------------------------------------
app.get('/api/credentials', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const list = await db
    .select({
      id: schema.credentials.id,
      name: schema.credentials.name,
      type: schema.credentials.type,
      createdAt: schema.credentials.createdAt,
    })
    .from(schema.credentials)
    .where(eq(schema.credentials.workspaceId, ws.id))
    .orderBy(desc(schema.credentials.createdAt))
    .all();

  return c.json({ credentials: list });
});

app.post('/api/credentials', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, vault } = getServices(c.env, ws.id);
  const body = await c.req.json().catch(() => ({}));
  const name = body.name?.trim();
  const type = body.type?.trim() || 'generic';
  const data = body.data;

  if (!name) return c.json({ error: "Field 'name' is required" }, 400);
  if (!data || typeof data !== 'object') return c.json({ error: "Field 'data' must be an object" }, 400);

  const id = nanoid();
  const now = Date.now();
  const dataEnc = vault.encryptSecrets(data);

  await db.insert(schema.credentials).values({
    id,
    workspaceId: ws.id,
    name,
    type,
    dataEnc,
    createdAt: now,
  });

  return c.json({ credential: { id, name, type, createdAt: now } }, 201);
});

app.delete('/api/credentials/:id', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const existing = await db
    .select()
    .from(schema.credentials)
    .where(and(eq(schema.credentials.id, id), eq(schema.credentials.workspaceId, ws.id)))
    .get();
  if (!existing) return c.json({ error: 'Credential not found' }, 404);

  await db
    .delete(schema.credentials)
    .where(and(eq(schema.credentials.id, id), eq(schema.credentials.workspaceId, ws.id)));
  return c.json({ success: true, message: `Credential '${id}' deleted` });
});

// -----------------------------------------------------------------------------
// Connections View
// -----------------------------------------------------------------------------
app.get('/api/connections', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db, vault } = getServices(c.env, ws.id);
  const credList = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.workspaceId, ws.id))
    .all();
  const allWorkflows = await db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.workspaceId, ws.id))
    .all();

  const credUsageMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const wf of allWorkflows) {
    const graph = (typeof wf.graph === 'string' ? JSON.parse(wf.graph) : wf.graph) as any;
    if (Array.isArray(graph?.nodes)) {
      for (const n of graph.nodes) {
        if (n.credentialId) {
          const l = credUsageMap.get(n.credentialId) || [];
          if (!l.some((w) => w.id === wf.id)) l.push({ id: wf.id, name: wf.name });
          credUsageMap.set(n.credentialId, l);
        }
      }
    }
  }

  const enriched = credList.map((cred) => {
    let accountIdentifier = cred.name;
    let status: 'connected' | 'expired' = 'connected';

    try {
      const secrets = vault.decryptSecrets(cred.dataEnc);
      if (secrets.email) accountIdentifier = secrets.email;
      else if (secrets.accountName) accountIdentifier = secrets.accountName;
      else if (secrets.botUsername) accountIdentifier = `@${secrets.botUsername}`;

      if (cred.type === 'google' && secrets.expiresAt) {
        const exp = Number(secrets.expiresAt);
        if (exp > 0 && Date.now() > exp && !secrets.refreshToken) {
          status = 'expired';
        }
      }
    } catch {}

    const usages = credUsageMap.get(cred.id) || [];
    return {
      id: cred.id,
      name: cred.name,
      type: cred.type,
      accountIdentifier,
      createdAt: cred.createdAt,
      status,
      workflowCount: usages.length,
      workflows: usages,
    };
  });

  return c.json({ connections: enriched });
});

// -----------------------------------------------------------------------------
// Webhooks Listener (Public trigger, executes in workflow's workspace)
// -----------------------------------------------------------------------------
app.all('/hook/:token', async (c) => {
  const { db } = getServices(c.env);
  const token = c.req.param('token');
  const webhookRecord = await db.select().from(schema.webhooks).where(eq(schema.webhooks.token, token)).get();

  if (!webhookRecord) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const workflow = await db
    .select()
    .from(schema.workflows)
    .where(eq(schema.workflows.id, webhookRecord.workflowId))
    .get();

  if (!workflow) {
    return c.json({ error: 'Associated workflow not found' }, 404);
  }

  const bodyData = await c.req.json().catch(() => ({}));
  const triggerPayload = {
    body: bodyData,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    method: c.req.method,
    timestamp: new Date().toISOString(),
  };

  if (!workflow.active) {
    return c.json(
      {
        error: 'Workflow is not active',
        message: 'Payload received, but execution is disabled because workflow is not activated.',
        samplePayload: bodyData,
      },
      403
    );
  }

  const { runManager } = getServices(c.env, workflow.workspaceId || undefined);
  const { runId, executionPromise } = await runManager.startRun(workflow, {
    triggerKey: webhookRecord.nodeKey,
    triggerPayload,
  });

  c.executionCtx.waitUntil(executionPromise);

  return c.json(
    {
      runId,
      status: 'accepted',
      message: 'Workflow execution queued and sample payload captured.',
      samplePayload: bodyData,
    },
    202
  );
});

// -----------------------------------------------------------------------------
// Integrations Metadata & Proxies
// -----------------------------------------------------------------------------
app.get('/api/integrations', async (c) => {
  return c.json({
    integrations: [
      {
        id: 'google',
        name: 'Google Workspace',
        category: 'Productivity & Communication',
        brandColor: '#4285F4',
        description: 'Connect Gmail, Google Sheets, Google Drive, and Google Calendar with a single authorization.',
        authType: 'oauth2',
        credentialType: 'google',
        setupUrl: 'https://console.cloud.google.com/apis/credentials',
        operations: [
          { type: 'gmail.sendEmail', label: 'Gmail: Send Email' },
          { type: 'sheets.appendRow', label: 'Google Sheets: Append Row' },
          { type: 'sheets.readRows', label: 'Google Sheets: Read Rows' },
          { type: 'drive.uploadFile', label: 'Google Drive: Upload File' },
          { type: 'calendar.createEvent', label: 'Google Calendar: Create Event' },
        ],
      },
      {
        id: 'telegram',
        name: 'Telegram',
        category: 'Messaging',
        brandColor: '#24A1DE',
        description: 'Send direct messages, alerts, and channel announcements using a Telegram Bot Token.',
        authType: 'botToken',
        credentialType: 'telegram',
        setupUrl: 'https://t.me/BotFather',
        operations: [{ type: 'telegram.sendMessage', label: 'Telegram: Send Message' }],
      },
      {
        id: 'slack',
        name: 'Slack',
        category: 'Team Collaboration',
        brandColor: '#E01E5A',
        description: 'Post notifications and alerts into Slack channels via Incoming Webhooks.',
        authType: 'webhookUrl',
        credentialType: 'slack',
        setupUrl: 'https://api.slack.com/apps',
        operations: [{ type: 'slack.postMessage', label: 'Slack: Post Message' }],
      },
      {
        id: 'github',
        name: 'GitHub',
        category: 'Developer Tools',
        brandColor: '#F0F6FC',
        description: 'Create issues and track developer bugs with a Personal Access Token.',
        authType: 'apiKey',
        credentialType: 'github',
        setupUrl: 'https://github.com/settings/tokens',
        operations: [{ type: 'github.createIssue', label: 'GitHub: Create Issue' }],
      },
    ],
  });
});

// Telegram direct test execution
app.post('/api/integrations/telegram/test', async (c) => {
  const ws = getActiveWorkspace(c);
  const { vault } = getServices(c.env, ws.id);
  const body = await c.req.json().catch(() => ({}));
  const { credentialId, botToken: directBotToken, chatId, text } = body;

  if (!chatId || !text) {
    return c.json({ success: false, error: 'chatId and text are required' }, 400);
  }

  let token = directBotToken;
  if (!token && credentialId) {
    try {
      const creds = await vault.get(credentialId, ws.id);
      token = creds.botToken || creds.apiKey || creds.token;
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
  }

  if (!token) {
    return c.json({ success: false, error: 'Telegram Bot Token is required' }, 400);
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data: any = await res.json();
    if (!data.ok) throw new Error(data.description || 'Telegram API call failed');
    return c.json({ success: true, result: data.result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// Slack direct test execution
app.post('/api/integrations/slack/test', async (c) => {
  const ws = getActiveWorkspace(c);
  const { vault } = getServices(c.env, ws.id);
  const body = await c.req.json().catch(() => ({}));
  const { credentialId, webhookUrl, text } = body;

  let url = webhookUrl;
  if (!url && credentialId) {
    try {
      const creds = await vault.get(credentialId, ws.id);
      url = creds.webhookUrl || creds.url;
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
  }

  if (!url) {
    return c.json({ success: false, error: 'Slack Webhook URL is required' }, 400);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text || '🚀 Test alert from VULP automation platform!' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Slack API error: ${errText}`);
    }
    return c.json({ success: true, message: 'Slack message sent successfully' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// -----------------------------------------------------------------------------
// Workflow Templates
// -----------------------------------------------------------------------------
app.get('/api/templates', async (c) => {
  return c.json({ templates: WORKFLOW_TEMPLATES });
});

app.get('/api/templates/:id', async (c) => {
  const id = c.req.param('id');
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }
  return c.json({ template });
});

app.post('/api/templates/:id/instantiate', async (c) => {
  const ws = getActiveWorkspace(c);
  const { db } = getServices(c.env, ws.id);
  const id = c.req.param('id');
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === id);
  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const now = Date.now();
  const workflowId = nanoid();
  const newWf = {
    id: workflowId,
    workspaceId: ws.id,
    name: template.name,
    graph: template.graph,
    active: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(schema.workflows).values(newWf);
  return c.json({ workflow: newWf }, 201);
});

// SPA & Static Assets fallback
app.notFound(async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/hook')) {
    return c.json({ error: 'Endpoint not found', path: url.pathname }, 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not Found', 404);
});

// -----------------------------------------------------------------------------
// Scheduled Cron Trigger Handler
// -----------------------------------------------------------------------------
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    const { db } = getServices(env);
    console.log(`[Cron] Triggered at ${new Date(event.scheduledTime).toISOString()}`);

    const activeWorkflows = await db
      .select()
      .from(schema.workflows)
      .where(eq(schema.workflows.active, true))
      .all();

    for (const wf of activeWorkflows) {
      const graph = (typeof wf.graph === 'string' ? JSON.parse(wf.graph) : wf.graph) as WorkflowGraph;
      for (const node of graph.nodes || []) {
        if (node.type === 'schedule.trigger') {
          const cronExpr = String(node.params?.cron || '0 * * * *');
          const tz = String(node.params?.timezone || 'UTC');

          try {
            const cron = new Cron(cronExpr, { timezone: tz });
            const now = new Date();
            const prevRun = cron.previousRun();
            if (prevRun && now.getTime() - prevRun.getTime() < 60000) {
              console.log(`[Cron] Executing scheduled workflow '${wf.name}' (${wf.id})`);
              const { runManager } = getServices(env, wf.workspaceId || undefined);
              const { executionPromise } = await runManager.startRun(wf, {
                triggerKey: node.key,
                triggerPayload: { timestamp: now.toISOString(), scheduled: true },
              });
              ctx.waitUntil(executionPromise);
            }
          } catch (cronErr) {
            console.error(`[Cron] Error evaluating cron for workflow ${wf.id}:`, cronErr);
          }
        }
      }
    }
  },
};
