import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { WorkflowGraph } from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { webhookService } from '../services/WebhookService.js';
import { runManager } from '../execution/RunManager.js';

export const webhookRoutes: FastifyPluginAsync = async (server) => {
  // Webhook listener for incoming HTTP requests
  server.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    url: '/hook/:token',
    bodyLimit: 1048576, // 1 MB strict body limit
    handler: async (req, reply) => {
      const { token } = req.params as { token: string };

      const found = webhookService.findByToken(token);
      if (!found) {
        return reply.status(404).send({ error: 'Webhook not found' });
      }

      const { webhook, workflow } = found;

      // Find the specific webhook.trigger node to check method settings
      const graph = (typeof workflow.graph === 'string'
        ? JSON.parse(workflow.graph)
        : workflow.graph) as WorkflowGraph;

      const triggerNode = graph.nodes?.find((n) => n.key === webhook.nodeKey);
      const configuredMethod = String(triggerNode?.params?.method || 'POST').toUpperCase();

      if (configuredMethod !== 'ANY' && req.method.toUpperCase() !== configuredMethod) {
        return reply.status(405).send({
          error: `Method Not Allowed. This webhook expects HTTP ${configuredMethod}`,
        });
      }

      const nowIso = new Date().toISOString();

      // Build trigger payload with body, headers, query, method, and params
      const triggerPayload = {
        body: req.body ?? {},
        headers: req.headers,
        query: req.query ?? {},
        method: req.method,
        params: req.params,
        timestamp: nowIso,
      } as any;

      // Always capture the incoming payload into the node's parameters so schema is immediately discovered
      const updatedNodes = (graph.nodes || []).map((n) => {
        if (n.key === webhook.nodeKey) {
          return {
            ...n,
            params: {
              ...(n.params || {}),
              samplePayload: req.body ?? {},
              lastPayload: triggerPayload,
              lastReceivedAt: nowIso,
            },
          };
        }
        return n;
      });

      const updatedGraph = { ...graph, nodes: updatedNodes };

      try {
        db.update(workflows)
          .set({
            graph: updatedGraph,
            updatedAt: Date.now(),
          })
          .where(eq(workflows.id, workflow.id))
          .run();
      } catch (err) {
        req.log.warn(err, `Could not persist sample payload for webhook node ${webhook.nodeKey}`);
      }

      // If workflow is not active (draft/design mode), the payload has already been captured
      // into node params above for dynamic schema discovery. Reject execution with 403.
      if (!workflow.active) {
        return reply.status(403).send({
          error: 'Workflow is not active',
          message: 'Webhook payload captured as sample schema, but execution is disabled because workflow is inactive.',
          workflowId: workflow.id,
          nodeKey: webhook.nodeKey,
          samplePayload: req.body ?? {},
          receivedAt: nowIso,
        });
      }

      // If active, execute the automation normally
      try {
        const { runId } = await runManager.startRun(
          { ...workflow, graph: updatedGraph },
          {
            triggerKey: webhook.nodeKey,
            triggerPayload,
          }
        );

        return reply.status(202).send({
          runId,
          status: 'accepted',
          message: 'Workflow execution queued and sample payload captured.',
          samplePayload: req.body ?? {},
        });
      } catch (err: any) {
        req.log.error(err, `Failed to start run from webhook ${token}`);
        return reply.status(500).send({
          error: 'Failed to initiate workflow execution',
          details: err?.message || String(err),
        });
      }
    },
  });

  // Helper route to get webhooks for a workflow
  server.get<{
    Params: { id: string };
  }>('/api/workflows/:id/webhooks', async (req, reply) => {
    const list = webhookService.getWebhooksForWorkflow(req.params.id);
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';

    const enriched = list.map((item) => ({
      ...item,
      url: `${protocol}://${host}/hook/${item.token}`,
    }));

    return { webhooks: enriched };
  });

  // Endpoint to get sample payload for a webhook node
  server.get<{
    Params: { id: string; nodeKey: string };
  }>('/api/workflows/:id/webhooks/:nodeKey/sample', async (req, reply) => {
    const { id, nodeKey } = req.params;
    const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();
    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    const targetNode = graph.nodes?.find((n) => n.key === nodeKey);
    if (!targetNode) {
      return reply.status(404).send({ error: `Node '${nodeKey}' not found in workflow` });
    }

    return {
      samplePayload: targetNode.params?.samplePayload || null,
      lastPayload: targetNode.params?.lastPayload || null,
      lastReceivedAt: targetNode.params?.lastReceivedAt || null,
    };
  });

  // Endpoint to set/update sample payload directly
  server.post<{
    Params: { id: string; nodeKey: string };
    Body: { samplePayload: any };
  }>('/api/workflows/:id/webhooks/:nodeKey/sample', async (req, reply) => {
    const { id, nodeKey } = req.params;
    const workflow = db.select().from(workflows).where(eq(workflows.id, id)).get();
    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    const targetNode = graph.nodes?.find((n) => n.key === nodeKey);
    if (!targetNode) {
      return reply.status(404).send({ error: `Node '${nodeKey}' not found in workflow` });
    }

    const samplePayload = req.body?.samplePayload ?? {};
    const nowIso = new Date().toISOString();

    const updatedNodes = (graph.nodes || []).map((n) => {
      if (n.key === nodeKey) {
        return {
          ...n,
          params: {
            ...(n.params || {}),
            samplePayload,
            lastReceivedAt: nowIso,
          },
        };
      }
      return n;
    });

    const updatedGraph = { ...graph, nodes: updatedNodes };
    db.update(workflows)
      .set({ graph: updatedGraph, updatedAt: Date.now() })
      .where(eq(workflows.id, id))
      .run();

    return {
      success: true,
      samplePayload,
      lastReceivedAt: nowIso,
    };
  });
};
