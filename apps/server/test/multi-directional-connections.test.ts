import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/index.js';
import { initDatabase } from '../src/db/index.js';

describe('Multi-Directional Node Connections & Graph Execution Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    initDatabase();
    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('saves and executes workflow with all four cardinal directions (top, bottom, left, right)', async () => {
    // Pipeline structured with:
    // 1. Manual trigger at (200, 50) -> connects DOWN (bottom to top) to step 2 at (200, 200)
    // 2. Step 2 connects RIGHT to step 3 at (450, 200)
    // 3. Step 3 connects UP (top to bottom) to step 4 at (450, 50)
    const payload = {
      name: 'Four-Cardinal Direction Flow',
      graph: {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Top Trigger',
            position: { x: 200, y: 50 },
            params: { payload: { orderId: 'ORD-999', amount: 500 } },
          },
          {
            key: 'step_down',
            type: 'logic.delay',
            name: 'Process Downward',
            position: { x: 200, y: 200 },
            params: { durationMs: 2 },
          },
          {
            key: 'step_right',
            type: 'logic.delay',
            name: 'Process Rightward',
            position: { x: 450, y: 200 },
            params: { durationMs: 2 },
          },
          {
            key: 'step_up',
            type: 'logic.delay',
            name: 'Process Upward',
            position: { x: 450, y: 50 },
            params: { durationMs: 2 },
          },
        ],
        edges: [
          // 1. Downward connection: default-bottom -> input-top
          {
            id: 'e_down',
            source: 'trig',
            sourcePort: 'default',
            target: 'step_down',
            sourceHandle: 'default-bottom',
            targetHandle: 'input-top',
          },
          // 2. Rightward connection: default -> input
          {
            id: 'e_right',
            source: 'step_down',
            sourcePort: 'default',
            target: 'step_right',
            sourceHandle: 'default',
            targetHandle: 'input',
          },
          // 3. Upward connection: default-top -> input-bottom
          {
            id: 'e_up',
            source: 'step_right',
            sourcePort: 'default',
            target: 'step_up',
            sourceHandle: 'default-top',
            targetHandle: 'input-bottom',
          },
        ],
      },
      active: true,
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload,
    });
    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    // Verify all edges preserved directional handles
    expect(workflow.graph.edges.length).toBe(3);
    expect(workflow.graph.edges[0].sourceHandle).toBe('default-bottom');
    expect(workflow.graph.edges[0].targetHandle).toBe('input-top');
    expect(workflow.graph.edges[2].sourceHandle).toBe('default-top');
    expect(workflow.graph.edges[2].targetHandle).toBe('input-bottom');

    // Execute workflow to confirm runtime semantics are fully preserved
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: { triggerPayload: { test: true } },
    });
    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    // Wait briefly for execution
    await new Promise((r) => setTimeout(r, 60));

    const runDetails = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
    });
    const runBody = JSON.parse(runDetails.payload);
    expect(runBody.run.status).toBe('succeeded');
    expect(runBody.nodeRuns.length).toBe(4);
  });

  it('preserves IF/ELSE TRUE/FALSE semantics across multi-directional branch handles', async () => {
    // Condition node with:
    // - True branch connecting upward (true-top -> input-bottom)
    // - False branch connecting downward (false-bottom -> input-top)
    const payload = {
      name: 'Directional IF Branching Flow',
      graph: {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 100, y: 200 },
            params: { payload: { score: 95 } },
          },
          {
            key: 'if_score',
            type: 'logic.if',
            name: 'Score > 80?',
            position: { x: 300, y: 200 },
            params: { left: '{{ trigger.score }}', operator: 'greater_than', right: 80 },
          },
          {
            key: 'branch_true',
            type: 'logic.delay',
            name: 'High Score Action',
            position: { x: 500, y: 80 },
            params: { durationMs: 2 },
          },
          {
            key: 'branch_false',
            type: 'logic.delay',
            name: 'Low Score Action',
            position: { x: 500, y: 320 },
            params: { durationMs: 2 },
          },
        ],
        edges: [
          {
            id: 'e_trig_if',
            source: 'trig',
            sourcePort: 'default',
            target: 'if_score',
            sourceHandle: 'default',
            targetHandle: 'input',
          },
          // Multi-directional True output (true-top)
          {
            id: 'e_if_true',
            source: 'if_score',
            sourcePort: 'true',
            target: 'branch_true',
            sourceHandle: 'true-top',
            targetHandle: 'input-bottom',
          },
          // Multi-directional False output (false-bottom)
          {
            id: 'e_if_false',
            source: 'if_score',
            sourcePort: 'false',
            target: 'branch_false',
            sourceHandle: 'false-bottom',
            targetHandle: 'input-top',
          },
        ],
      },
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload,
    });
    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);

    // Test execution when score = 95 (evaluates true -> branch_true runs, branch_false skipped)
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: { triggerPayload: { score: 95 } },
    });
    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    await new Promise((r) => setTimeout(r, 60));

    const runDetails = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
    });
    const runBody = JSON.parse(runDetails.payload);
    expect(runBody.run.status).toBe('succeeded');
    const trueNodeRun = runBody.nodeRuns.find((nr: any) => nr.nodeKey === 'branch_true');
    const falseNodeRun = runBody.nodeRuns.find((nr: any) => nr.nodeKey === 'branch_false');
    expect(trueNodeRun?.status).toBe('succeeded');
    expect(falseNodeRun?.status).toBe('skipped');
  });

  it('supports multiple incoming and outgoing connections without handle conflicts', async () => {
    // 1 Trigger fanning out to 2 parallel nodes from different handles
    // Both converging into a final Merge/Action node from different handles
    const payload = {
      name: 'Fan-out and Fan-in Multi-Directional Graph',
      graph: {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Broadcast Trigger',
            position: { x: 100, y: 150 },
            params: { payload: { data: 'hello' } },
          },
          {
            key: 'worker_top',
            type: 'logic.delay',
            name: 'Top Worker',
            position: { x: 300, y: 50 },
            params: { durationMs: 2 },
          },
          {
            key: 'worker_bot',
            type: 'logic.delay',
            name: 'Bottom Worker',
            position: { x: 300, y: 250 },
            params: { durationMs: 2 },
          },
          {
            key: 'converge',
            type: 'logic.delay',
            name: 'Sink Step',
            position: { x: 500, y: 150 },
            params: { durationMs: 2 },
          },
        ],
        edges: [
          // Fan-out from trigger
          { id: 'e1', source: 'trig', sourcePort: 'default', target: 'worker_top', sourceHandle: 'default-top', targetHandle: 'input' },
          { id: 'e2', source: 'trig', sourcePort: 'default', target: 'worker_bot', sourceHandle: 'default-bottom', targetHandle: 'input' },
          // Fan-in to converge step
          { id: 'e3', source: 'worker_top', sourcePort: 'default', target: 'converge', sourceHandle: 'default', targetHandle: 'input-top' },
          { id: 'e4', source: 'worker_bot', sourcePort: 'default', target: 'converge', sourceHandle: 'default', targetHandle: 'input-bottom' },
        ],
      },
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload,
    });
    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);
    expect(workflow.graph.edges.length).toBe(4);

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: { triggerPayload: { test: true } },
    });
    expect(runRes.statusCode).toBe(202);
    const { runId } = JSON.parse(runRes.payload);

    await new Promise((r) => setTimeout(r, 60));

    const runDetails = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
    });
    const runBody = JSON.parse(runDetails.payload);
    expect(runBody.run.status).toBe('succeeded');
    expect(runBody.nodeRuns.length).toBe(4);
  });

  it('guarantees backward compatibility for existing saved workflows without directional handles', async () => {
    // Legacy workflow with only sourcePort='default' and no handle metadata
    const legacyPayload = {
      name: 'Legacy 2-Node Graph',
      graph: {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Manual Trigger',
            position: { x: 100, y: 100 },
            params: { payload: {} },
          },
          {
            key: 'act',
            type: 'logic.delay',
            name: 'Action Step',
            position: { x: 300, y: 100 },
            params: { durationMs: 2 },
          },
        ],
        edges: [
          { id: 'e_legacy', source: 'trig', sourcePort: 'default', target: 'act' },
        ],
      },
    };

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      payload: legacyPayload,
    });
    expect(createRes.statusCode).toBe(201);
    const { workflow } = JSON.parse(createRes.payload);
    expect(workflow.graph.edges[0].sourcePort).toBe('default');

    // Run legacy workflow
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/workflows/${workflow.id}/run`,
      payload: {},
    });
    expect(runRes.statusCode).toBe(202);
  });
});
