import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  graph: text('graph', { mode: 'json' }).notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const credentials = sqliteTable('credentials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  dataEnc: text('data_enc').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const webhooks = sqliteTable('webhooks', {
  token: text('token').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  nodeKey: text('node_key').notNull(),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  workflowName: text('workflow_name').notNull(),
  triggerType: text('trigger_type').notNull(),
  triggerPayload: text('trigger_payload', { mode: 'json' }),
  graphSnapshot: text('graph_snapshot', { mode: 'json' }).notNull(),
  status: text('status').notNull(),
  error: text('error'),
  queuedAt: integer('queued_at').notNull(),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
});

export const nodeRuns = sqliteTable('node_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  nodeKey: text('node_key').notNull(),
  nodeName: text('node_name').notNull(),
  nodeType: text('node_type').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(1),
  paramsResolved: text('params_resolved', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  error: text('error'),
  logs: text('logs', { mode: 'json' }),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type NodeRun = typeof nodeRuns.$inferSelect;

