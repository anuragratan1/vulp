import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { WorkflowGraph } from '@workflow/engine';
import { db } from '../db/index.js';
import { webhooks, workflows, Workflow } from '../db/schema.js';

export interface WebhookInfo {
  token: string;
  workflowId: string;
  nodeKey: string;
  url?: string;
}

export class WebhookService {
  /**
   * Get or generate a unique, unguessable webhook token for a specific node in a workflow.
   */
  public getOrCreateToken(workflowId: string, nodeKey: string): string {
    const existing = db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.workflowId, workflowId), eq(webhooks.nodeKey, nodeKey)))
      .get();

    if (existing) {
      return existing.token;
    }

    // 24-character unguessable URL-safe token
    const token = nanoid(24);

    db.insert(webhooks)
      .values({
        token,
        workflowId,
        nodeKey,
      })
      .run();

    return token;
  }

  /**
   * Synchronize webhooks table for all webhook.trigger nodes in a workflow graph.
   * Creates tokens for new nodes and cleans up removed nodes.
   */
  public syncWorkflowWebhooks(workflow: Workflow): WebhookInfo[] {
    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    const webhookNodes = (graph?.nodes || []).filter((n) => n.type === 'webhook.trigger');
    const activeNodeKeys = new Set(webhookNodes.map((n) => n.key));

    // Get current records in database
    const currentRecords = db
      .select()
      .from(webhooks)
      .where(eq(webhooks.workflowId, workflow.id))
      .all();

    // Remove obsolete webhook tokens for nodes that no longer exist
    for (const rec of currentRecords) {
      if (!activeNodeKeys.has(rec.nodeKey)) {
        db.delete(webhooks).where(eq(webhooks.token, rec.token)).run();
      }
    }

    // Ensure all current webhook nodes have tokens
    const result: WebhookInfo[] = [];
    for (const node of webhookNodes) {
      const token = this.getOrCreateToken(workflow.id, node.key);
      result.push({
        token,
        workflowId: workflow.id,
        nodeKey: node.key,
      });
    }

    return result;
  }

  /**
   * Find webhook registration and associated workflow by token.
   */
  public findByToken(token: string): {
    webhook: { token: string; workflowId: string; nodeKey: string };
    workflow: Workflow;
  } | null {
    const webhook = db.select().from(webhooks).where(eq(webhooks.token, token)).get();
    if (!webhook) {
      return null;
    }

    const workflow = db.select().from(workflows).where(eq(workflows.id, webhook.workflowId)).get();
    if (!workflow) {
      return null;
    }

    return { webhook, workflow };
  }

  /**
   * Get all webhooks for a specific workflow.
   */
  public getWebhooksForWorkflow(workflowId: string): WebhookInfo[] {
    return db
      .select({
        token: webhooks.token,
        workflowId: webhooks.workflowId,
        nodeKey: webhooks.nodeKey,
      })
      .from(webhooks)
      .where(eq(webhooks.workflowId, workflowId))
      .all();
  }
}

export const webhookService = new WebhookService();

