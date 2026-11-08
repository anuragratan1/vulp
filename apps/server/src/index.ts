import './config/env.js';
import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { initDatabase, sqlite } from './db/index.js';
import { runManager } from './execution/RunManager.js';
import { nodeTypesRoutes } from './routes/nodeTypes.js';
import { workflowRoutes } from './routes/workflows.js';
import { runRoutes } from './routes/runs.js';
import { credentialRoutes } from './routes/credentials.js';
import { webhookRoutes } from './routes/webhooks.js';
import { templateRoutes } from './routes/templates.js';
import { authRoutes } from './routes/auth.js';
import { connectionRoutes } from './routes/connections.js';
import { integrationRoutes } from './routes/integrations.js';
import { getMasterKey } from './security/crypto.js';
import { schedulerService } from './services/SchedulerService.js';
import { googleFormsService } from './services/GoogleFormsService.js';

export async function createServer() {
  // Ensure master encryption key is generated and initialized
  getMasterKey();

  const server = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // Production Security Headers
  await server.register(helmet, {
    contentSecurityPolicy: false, // Allows OAuth callbacks and embedded visual workflows
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Rate Limiting
  await server.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === 'test' ? 10000 : 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please wait ${Math.ceil(context.ttl / 1000)} seconds before retrying.`,
    }),
  });

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Comprehensive Health check endpoint
  server.get('/health', async (_req, reply) => {
    try {
      sqlite.prepare('SELECT 1').get();
      return {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
        database: 'connected',
        version: '0.1.0',
      };
    } catch (err: any) {
      reply.status(503);
      return {
        status: 'unhealthy',
        error: err?.message || 'Database unavailable',
        timestamp: Date.now(),
      };
    }
  });

  // Register API routes
  await server.register(nodeTypesRoutes);
  await server.register(workflowRoutes);
  await server.register(runRoutes);
  await server.register(credentialRoutes);
  await server.register(webhookRoutes);
  await server.register(templateRoutes);
  await server.register(authRoutes);
  await server.register(connectionRoutes);
  await server.register(integrationRoutes);

  // Serve compiled production web assets if available
  const webDistCandidates = [
    path.resolve(process.cwd(), 'apps', 'web', 'dist'),
    path.resolve(process.cwd(), '..', 'web', 'dist'),
    path.resolve(process.cwd(), 'public'),
  ];
  const webDistPath = webDistCandidates.find((p) => fs.existsSync(p));

  if (webDistPath) {
    await server.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // SPA fallback: redirect unmatched frontend routes to index.html
    server.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (url.startsWith('/api') || url.startsWith('/hook') || url === '/health') {
        return reply.status(404).send({ error: 'Endpoint Not Found', path: url });
      }
      return reply.sendFile('index.html');
    });
  }

  return server;
}

const start = async () => {
  try {
    initDatabase();
    runManager.cleanupOrphanedRuns();

    const server = await createServer();

    // Start in-memory scheduler and Google Forms polling for all active workflows
    schedulerService.resyncAllActive();
    googleFormsService.initialize();

    const port = Number(process.env.PORT) || 4000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Vulp Workflow server running on http://localhost:${port}`);

    // If GOOGLE_REDIRECT_URI specifies a different port (e.g. 3000) than the main server port (e.g. 4000),
    // launch an auxiliary listener on that port so that OAuth callbacks are automatically forwarded to Fastify.
    const redirectUriStr = process.env.GOOGLE_REDIRECT_URI || '';
    const match = redirectUriStr.match(/:(\d+)\//);
    const redirectPort = match ? Number(match[1]) : null;
    if (redirectPort && redirectPort !== port) {
      try {
        const http = await import('node:http');
        const forwarder = http.createServer((req, res) => {
          const proxyReq = http.request(
            {
              hostname: '127.0.0.1',
              port: port,
              path: req.url,
              method: req.method,
              headers: req.headers,
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
              proxyRes.pipe(res);
            }
          );
          proxyReq.on('error', (err) => {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Bad Gateway: ${err.message}`);
          });
          req.pipe(proxyReq);
        });
        forwarder.listen(redirectPort, '0.0.0.0', () => {
          console.log(`OAuth auxiliary callback listener running on http://localhost:${redirectPort} (forwarding to :${port})`);
        });
      } catch (fwdErr) {
        console.warn(`Could not bind auxiliary OAuth listener on port ${redirectPort}:`, fwdErr);
      }
    }

    // Graceful Shutdown on termination signals
    const gracefulShutdown = async (signalName: string) => {
      console.log(`\nReceived ${signalName}. Initiating graceful shutdown...`);
      try {
        schedulerService.stopAll();
        googleFormsService.stopAll();
        await server.close();
        sqlite.close();
        console.log('VULP server and database connection closed cleanly.');
        process.exit(0);
      } catch (shutdownErr) {
        console.error('Error during graceful shutdown:', shutdownErr);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default createServer;
