import fs from 'node:fs';
import path from 'node:path';

let envLoaded = false;

/**
 * Searches upward for a `.env` file and loads it via Node.js built-in `process.loadEnvFile`.
 */
export function loadEnvFiles(): boolean {
  if (envLoaded) return true;

  let curr = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(curr, '.env');
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        envLoaded = true;
        return true;
      } catch (err) {
        console.warn(`[Env] Failed to load env file from ${envPath}:`, err);
      }
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  return false;
}

// Auto-run on first import
loadEnvFiles();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  dbDir: string;
  isProduction: boolean;
  googleConfigured: boolean;
}

export function getServerConfig(): ServerConfig {
  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbDir = process.env.DB_DIR || path.resolve(process.cwd(), 'data');
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return {
    port,
    host,
    nodeEnv,
    dbDir,
    isProduction: nodeEnv === 'production',
    googleConfigured,
  };
}

