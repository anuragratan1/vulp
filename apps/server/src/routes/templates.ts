import { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { WORKFLOW_TEMPLATES } from '../templates/templates.js';
import { webhookService } from '../services/WebhookService.js';

export const templateRoutes: FastifyPluginAsync = async (server) => {
  // List all available workflow templates
  server.get('/api/templates', async () => {
    return { templates: WORKFLOW_TEMPLATES };
  });

  // Get a single template by ID
  server.get<{
    Params: { id: string };
  }>('/api/templates/:id', async (req, reply) => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === req.params.id);
    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }
    return { template };
  });

  // Instantiate a template as an editable workflow
  server.post<{
    Params: { id: string };
    Body: { name?: string };
  }>('/api/templates/:id/instantiate', async (req, reply) => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === req.params.id);
    if (!template) {
      return reply.status(404).send({ error: 'Template not found' });
    }

    const workflowName = req.body?.name?.trim() || template.name;
    const id = nanoid();
    const now = Date.now();

    // Deep copy graph from template
    const graph = JSON.parse(JSON.stringify(template.graph));

    const created = db
      .insert(workflows)
      .values({
        id,
        name: workflowName,
        graph,
        active: false, // Created as draft/editable before activation
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    // Generate webhooks for any webhook triggers in the template
    webhookService.syncWorkflowWebhooks(created);

    return reply.status(201).send({
      workflow: created,
      template,
      message: `Created editable workflow from '${template.name}'. Configure credentials before activation.`,
    });
  });
};

