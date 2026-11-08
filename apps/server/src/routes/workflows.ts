import { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { GraphValidator, WorkflowGraph } from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { runManager } from '../execution/RunManager.js';
import { webhookService } from '../services/WebhookService.js';
import { schedulerService, SchedulerService } from '../services/SchedulerService.js';
import { googleFormsService } from '../services/GoogleFormsService.js';

function validateWorkflowForActivation(graph: WorkflowGraph) {
  // Validate basic graph consistency
  GraphValidator.validate(graph, runManager.getRegistry());

  // Check that at least one trigger node exists
  const triggerNodes = (graph.nodes || []).filter((n) => {
    const typeDef = runManager.getRegistry().get(n.type);
    return typeDef?.category === 'trigger';
  });

  if (triggerNodes.length === 0) {
    throw new Error('Cannot activate workflow: No trigger step found in graph.');
  }

  // Validate cron expressions on all schedule trigger steps
  for (const node of graph.nodes || []) {
    if (node.type === 'schedule.trigger') {
      const cronExpr = String(node.params?.cron || '0 * * * *');
      const tz = String(node.params?.timezone || 'UTC');
      const check = SchedulerService.validateCron(cronExpr, tz);
      if (!check.valid) {
        throw new Error(
          `Invalid cron expression '${cronExpr}' in step '${node.name || node.key}': ${check.error}`
        );
      }
    }

    // Check integration credentials before activation
    if (node.type === 'telegram.sendMessage' && !node.credentialId) {
      throw new Error(
        `Step '${node.name || node.key}' (Telegram) requires a configured Bot Token credential. Please select or add a Telegram credential in the step settings before activating.`
      );
    }
    if (
      node.type === 'slack.postMessage' &&
      !node.credentialId &&
      !node.params?.webhookUrl
    ) {
      throw new Error(
        `Step '${node.name || node.key}' (Slack) requires an Incoming Webhook credential. Please select or add a Slack credential in the step settings before activating.`
      );
    }
    if (node.type === 'github.createIssue' && !node.credentialId) {
      throw new Error(
        `Step '${node.name || node.key}' (GitHub) requires a Personal Access Token credential. Please select or add a GitHub credential in the step settings before activating.`
      );
    }
    const googleNodeTypes = [
      'gmail.sendEmail',
      'sheets.readRows',
      'sheets.appendRow',
      'sheets.updateRow',
      'drive.uploadFile',
      'drive.searchFiles',
      'calendar.createEvent',
    ];
    if (googleNodeTypes.includes(node.type) && !node.credentialId) {
      throw new Error(
        `Step '${node.name || node.key}' requires a connected Google account. Please connect or select your Google account in step settings before activating.`
      );
    }
    if (node.type === 'google_forms.trigger' || node.type === 'forms.trigger') {
      const credId = node.credentialId || node.params?.credentialId;
      if (!credId) {
        throw new Error(
          `Step '${node.name || node.key}' (Google Forms) requires a connected Google account. Please connect or select your Google account in step settings before activating.`
        );
      }
      if (!node.params?.formId) {
        throw new Error(
          `Step '${node.name || node.key}' (Google Forms) requires a selected Google Form. Please select or create a form in step settings before activating.`
        );
      }
    }
  }
}

export const workflowRoutes: FastifyPluginAsync = async (server) => {
  // List all workflows
  server.get('/api/workflows', async () => {
    const list = db.select().from(workflows).orderBy(desc(workflows.updatedAt)).all();
    return { workflows: list };
  });

  // Create workflow
  server.post<{
    Body: {
      name?: string;
      graph?: WorkflowGraph;
      active?: boolean;
    };
  }>('/api/workflows', async (req, reply) => {
    const name = req.body?.name?.trim() || 'Untitled Workflow';
    const graph = req.body?.graph || { nodes: [], edges: [] };
    const active = Boolean(req.body?.active);

    // Validate graph if nodes are present
    if (graph.nodes && graph.nodes.length > 0) {
      try {
        if (active) {
          validateWorkflowForActivation(graph);
        } else {
          GraphValidator.validate(graph, runManager.getRegistry(), { allowDraft: true });
        }
      } catch (valErr: any) {
        return reply.status(400).send({
          error: 'Invalid workflow graph',
          details: valErr?.message || String(valErr),
        });
      }
    }

    const id = nanoid();
    const now = Date.now();

    const created = db
      .insert(workflows)
      .values({
        id,
        name,
        graph,
        active,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // Synchronize webhooks, scheduler, and Google Forms triggers
    webhookService.syncWorkflowWebhooks(created);
    if (created.active) {
      schedulerService.registerWorkflow(created);
      googleFormsService.syncWorkflow(created);
    }

    return reply.status(201).send({ workflow: created });
  });

  // Get single workflow
  server.get<{
    Params: { id: string };
  }>('/api/workflows/:id', async (req, reply) => {
    const workflow = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    return { workflow };
  });

  // Update workflow
  server.put<{
    Params: { id: string };
    Body: {
      name?: string;
      graph?: WorkflowGraph;
      active?: boolean;
    };
  }>('/api/workflows/:id', async (req, reply) => {
    const existing = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const name = req.body.name !== undefined ? req.body.name.trim() : existing.name;
    const graph = req.body.graph !== undefined ? req.body.graph : (existing.graph as WorkflowGraph);
    let active = req.body.active !== undefined ? Boolean(req.body.active) : existing.active;

    if (graph && graph.nodes && graph.nodes.length > 0) {
      try {
        if (active) {
          if (req.body.active === true) {
            validateWorkflowForActivation(graph);
          } else {
            try {
              validateWorkflowForActivation(graph);
            } catch {
              active = false;
              GraphValidator.validate(graph, runManager.getRegistry(), { allowDraft: true });
            }
          }
        } else {
          GraphValidator.validate(graph, runManager.getRegistry(), { allowDraft: true });
        }
      } catch (valErr: any) {
        return reply.status(400).send({
          error: 'Invalid workflow configuration',
          details: valErr?.message || String(valErr),
        });
      }
    }

    const now = Date.now();

    const updated = db
      .update(workflows)
      .set({
        name,
        graph,
        active,
        updatedAt: now,
      })
      .where(eq(workflows.id, req.params.id))
      .returning()
      .get();

    // Synchronize webhooks, scheduler & Google Forms
    webhookService.syncWorkflowWebhooks(updated);
    if (updated.active) {
      schedulerService.registerWorkflow(updated);
      googleFormsService.syncWorkflow(updated);
    } else {
      schedulerService.unregisterWorkflow(updated.id);
      googleFormsService.unregisterWorkflow(updated.id);
    }

    return { workflow: updated };
  });

  // Activate workflow endpoint
  server.post<{
    Params: { id: string };
  }>('/api/workflows/:id/activate', async (req, reply) => {
    const existing = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const graph = (typeof existing.graph === 'string'
      ? JSON.parse(existing.graph)
      : existing.graph) as WorkflowGraph;

    try {
      validateWorkflowForActivation(graph);
    } catch (valErr: any) {
      return reply.status(400).send({
        error: 'Cannot activate workflow',
        details: valErr?.message || String(valErr),
      });
    }

    const now = Date.now();
    const updated = db
      .update(workflows)
      .set({
        active: true,
        updatedAt: now,
      })
      .where(eq(workflows.id, req.params.id))
      .returning()
      .get();

    const webhookInfos = webhookService.syncWorkflowWebhooks(updated);
    schedulerService.registerWorkflow(updated);
    googleFormsService.syncWorkflow(updated);

    return {
      workflow: updated,
      webhooks: webhookInfos,
      active: true,
    };
  });

  // Deactivate workflow endpoint
  server.post<{
    Params: { id: string };
  }>('/api/workflows/:id/deactivate', async (req, reply) => {
    const existing = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    const now = Date.now();
    const updated = db
      .update(workflows)
      .set({
        active: false,
        updatedAt: now,
      })
      .where(eq(workflows.id, req.params.id))
      .returning()
      .get();

    schedulerService.unregisterWorkflow(updated.id);
    googleFormsService.unregisterWorkflow(updated.id);

    return {
      workflow: updated,
      active: false,
    };
  });

  // Delete workflow
  server.delete<{
    Params: { id: string };
  }>('/api/workflows/:id', async (req, reply) => {
    const existing = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!existing) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    schedulerService.unregisterWorkflow(req.params.id);
    googleFormsService.unregisterWorkflow(req.params.id);
    db.delete(workflows).where(eq(workflows.id, req.params.id)).run();

    return { success: true, message: `Workflow '${req.params.id}' deleted` };
  });
};
