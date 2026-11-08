import { FastifyPluginAsync } from 'fastify';
import { runManager } from '../execution/RunManager.js';

export const nodeTypesRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/node-types', async () => {
    const list = runManager.getRegistry().getMetadataList();
    return { nodeTypes: list };
  });
};

