import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = process.env.DB_DIR || path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  return path.join(DB_DIR, isTest ? 'workflow.test.db' : 'workflow.db');
}

export const DB_PATH = getDbPath();

export function createDatabaseConnection(dbPath: string = getDbPath()) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export function initDatabase(dbPath: string = getDbPath()) {
  const { sqlite, db } = createDatabaseConnection(dbPath);

  // Ensure tables exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      graph TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data_enc TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      token TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      node_key TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      workflow_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_payload TEXT,
      graph_snapshot TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      queued_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS node_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      node_key TEXT NOT NULL,
      node_name TEXT NOT NULL,
      node_type TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      params_resolved TEXT,
      output TEXT,
      error TEXT,
      logs TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    );
  `);

  return { sqlite, db };
}

export const { sqlite, db } = initDatabase();

