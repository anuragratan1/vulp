import { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { Json } from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows } from '../db/schema.js';
import { runManager } from '../execution/RunManager.js';

export const runRoutes: FastifyPluginAsync = async (server) => {
  // Execute workflow
  server.post<{
    Params: { id: string };
    Body: {
      triggerKey?: string;
      triggerPayload?: Json;
    };
  }>('/api/workflows/:id/run', async (req, reply) => {
    const workflow = db
      .select()
      .from(workflows)
      .where(eq(workflows.id, req.params.id))
      .get();

    if (!workflow) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }

    try {
      const result = await runManager.startRun(workflow, {
        triggerKey: req.body?.triggerKey,
        triggerPayload: req.body?.triggerPayload,
      });

      return reply.status(202).send({
        runId: result.runId,
        message: 'Workflow execution queued',
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Execution failed to start',
        details: err?.message || String(err),
      });
    }
  });

  // List runs
  server.get('/api/runs', async () => {
    const list = runManager.listRuns(50);
    return { runs: list };
  });

  // Get single run details and its node runs
  server.get<{
    Params: { runId: string };
  }>('/api/runs/:runId', async (req, reply) => {
    const snapshot = runManager.getRunSnapshot(req.params.runId);

    if (!snapshot.run) {
      return reply.status(404).send({ error: 'Run not found' });
    }

    return {
      run: snapshot.run,
      nodeRuns: snapshot.nodeRuns,
    };
  });

  // Cancel an active or queued execution
  server.post<{
    Params: { runId: string };
  }>('/api/runs/:runId/cancel', async (req, reply) => {
    const success = runManager.cancelRun(req.params.runId);
    if (!success) {
      return reply.status(400).send({
        error: 'Run cannot be cancelled',
        message: 'The execution is either not found or has already finished.',
      });
    }

    return reply.send({
      success: true,
      message: 'Run execution cancelled successfully',
      runId: req.params.runId,
    });
  });

  // SSE: Live execution event streaming
  server.get<{
    Params: { runId: string };
  }>('/api/runs/:runId/events', (req, reply) => {
    const { runId } = req.params;

    // Fastify hijacked raw response for Server-Sent Events
    reply.hijack();
    const res = reply.raw;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
    });

    res.flushHeaders?.();

    // 1. Send initial catch-up snapshot from database
    const initialSnapshot = runManager.getRunSnapshot(runId);
    res.write(`event: snapshot\ndata: ${JSON.stringify(initialSnapshot)}\n\n`);

    // 2. Subscribe to live events
    const unsubscribe = runManager.subscribe(runId, (event) => {
      try {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        console.error(`Error sending SSE event to client for run ${runId}:`, err);
      }
    });

    // Heartbeat every 15s to keep connection open through proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    // Cleanup when client disconnects
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};

