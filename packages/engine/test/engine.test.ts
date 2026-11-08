import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  NodeRegistry,
  WorkflowGraph,
  RunEvent,
  IRunObserver,
  ICredentialStore,
  NodeError,
  ConfigError,
  ActionNode,
  Json,
  RunContext,
  ValidationError,
  GraphValidator,
} from '../src/index.js';

describe('WorkflowEngine M1 Mandatory Test Cases', () => {
  let server: http.Server;
  let serverUrl: string;
  let requestCounts: Record<string, number> = {};

  beforeAll(async () => {
    // Local HTTP server for testing real HTTP requests, retries, 4xx/5xx responses
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const path = url.pathname;
      requestCounts[path] = (requestCounts[path] || 0) + 1;

      if (path === '/echo') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              method: req.method,
              received: body ? JSON.parse(body) : null,
              headers: req.headers,
            })
          );
        });
      } else if (path === '/flaky-success-3') {
        const count = requestCounts[path];
        if (count < 3) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Service Unavailable (attempt ' + count + ')' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, attemptsRequired: count }));
        }
      } else if (path === '/bad-request-400') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request' }));
      } else if (path === '/not-found-404') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Helper observer to record events
  class TestObserver implements IRunObserver {
    public events: RunEvent[] = [];
    onEvent(e: RunEvent): void {
      this.events.push(e);
    }
  }

  // 1. Linear chain with expression-based data passing
  it('1. Linear chain with expression-based data passing', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'http_post',
          type: 'http.request',
          name: 'HTTP Post',
          position: { x: 100, y: 0 },
          params: {
            method: 'POST',
            url: `${serverUrl}/echo`,
            body: {
              orderId: '{{ trigger.orderId }}',
              item: '{{ trigger.item }}',
              amount: '{{ trigger.amount }}',
            },
          },
        },
        {
          key: 'http_second',
          type: 'http.request',
          name: 'HTTP Second',
          position: { x: 200, y: 0 },
          params: {
            method: 'POST',
            url: `${serverUrl}/echo`,
            body: {
              receivedOrderId: '{{ http_post.data.received.orderId }}',
              confirmedAmount: '{{ http_post.data.received.amount }}',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'http_post' },
        { id: 'e2', source: 'http_post', sourcePort: 'default', target: 'http_second' },
      ],
    };

    const result = await engine.run(graph, {
      runId: 'run-1',
      triggerKey: 'trig',
      triggerPayload: { orderId: 'ORD-987', item: 'Laptop', amount: 1200 },
    });

    expect(result.status).toBe('succeeded');

    const finishedEvents = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    expect(finishedEvents).toHaveLength(3);
    expect(finishedEvents.every((e) => e.status === 'succeeded')).toBe(true);

    const secondNodeEvent = finishedEvents.find((e) => e.nodeKey === 'http_second');
    expect(secondNodeEvent?.output).toBeDefined();
    const outputData = (secondNodeEvent?.output as any)?.data?.received;
    expect(outputData.receivedOrderId).toBe('ORD-987');
    expect(outputData.confirmedAmount).toBe(1200);
  });

  // 2. IF true branch executes and false branch is skipped
  it('2. IF true branch executes and false branch is skipped', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'if_node',
          type: 'logic.if',
          name: 'Check Amount',
          position: { x: 100, y: 0 },
          params: {
            left: '{{ trigger.amount }}',
            operator: 'greater_than',
            right: 100,
          },
        },
        {
          key: 'action_true',
          type: 'http.request',
          name: 'True Branch Action',
          position: { x: 200, y: -50 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
        {
          key: 'action_false',
          type: 'http.request',
          name: 'False Branch Action',
          position: { x: 200, y: 50 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'if_node' },
        { id: 'e_true', source: 'if_node', sourcePort: 'true', target: 'action_true' },
        { id: 'e_false', source: 'if_node', sourcePort: 'false', target: 'action_false' },
      ],
    };

    // Amount 150 > 100 -> true branch
    const result = await engine.run(graph, {
      runId: 'run-2',
      triggerKey: 'trig',
      triggerPayload: { amount: 150 },
    });

    expect(result.status).toBe('succeeded');

    const nodeFinished = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    const trueNode = nodeFinished.find((e) => e.nodeKey === 'action_true');
    const falseNode = nodeFinished.find((e) => e.nodeKey === 'action_false');

    expect(trueNode?.status).toBe('succeeded');
    expect(falseNode?.status).toBe('skipped');
    expect(falseNode?.attempts).toBe(0);
  });

  // 3. IF false branch executes and true branch is skipped
  it('3. IF false branch executes and true branch is skipped', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'if_node',
          type: 'logic.if',
          name: 'Check Amount',
          position: { x: 100, y: 0 },
          params: {
            left: '{{ trigger.amount }}',
            operator: 'greater_than',
            right: 100,
          },
        },
        {
          key: 'action_true',
          type: 'http.request',
          name: 'True Branch Action',
          position: { x: 200, y: -50 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
        {
          key: 'action_false',
          type: 'http.request',
          name: 'False Branch Action',
          position: { x: 200, y: 50 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'if_node' },
        { id: 'e_true', source: 'if_node', sourcePort: 'true', target: 'action_true' },
        { id: 'e_false', source: 'if_node', sourcePort: 'false', target: 'action_false' },
      ],
    };

    // Amount 50 <= 100 -> false branch
    const result = await engine.run(graph, {
      runId: 'run-3',
      triggerKey: 'trig',
      triggerPayload: { amount: 50 },
    });

    expect(result.status).toBe('succeeded');

    const nodeFinished = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    const trueNode = nodeFinished.find((e) => e.nodeKey === 'action_true');
    const falseNode = nodeFinished.find((e) => e.nodeKey === 'action_false');

    expect(trueNode?.status).toBe('skipped');
    expect(trueNode?.attempts).toBe(0);
    expect(falseNode?.status).toBe('succeeded');
  });

  // 4. IF → Merge diamond: Merge executes with one fired source
  it('4. IF → Merge diamond: Merge executes with one fired source', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'if_node',
          type: 'logic.if',
          name: 'IF',
          position: { x: 100, y: 0 },
          params: {
            left: '{{ trigger.status }}',
            operator: 'equals',
            right: 'vip',
          },
        },
        {
          key: 'vip_action',
          type: 'http.request',
          name: 'VIP Action',
          position: { x: 200, y: -50 },
          params: {
            method: 'POST',
            url: `${serverUrl}/echo`,
            body: { discount: 20 },
          },
        },
        {
          key: 'std_action',
          type: 'http.request',
          name: 'Standard Action',
          position: { x: 200, y: 50 },
          params: {
            method: 'POST',
            url: `${serverUrl}/echo`,
            body: { discount: 0 },
          },
        },
        {
          key: 'merge_node',
          type: 'logic.merge',
          name: 'Merge Diamond',
          position: { x: 300, y: 0 },
          params: {},
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'if_node' },
        { id: 'e_vip', source: 'if_node', sourcePort: 'true', target: 'vip_action' },
        { id: 'e_std', source: 'if_node', sourcePort: 'false', target: 'std_action' },
        { id: 'e_m1', source: 'vip_action', sourcePort: 'default', target: 'merge_node' },
        { id: 'e_m2', source: 'std_action', sourcePort: 'default', target: 'merge_node' },
      ],
    };

    const result = await engine.run(graph, {
      runId: 'run-4',
      triggerKey: 'trig',
      triggerPayload: { status: 'vip' },
    });

    expect(result.status).toBe('succeeded');

    const nodeFinished = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    const vipAction = nodeFinished.find((e) => e.nodeKey === 'vip_action');
    const stdAction = nodeFinished.find((e) => e.nodeKey === 'std_action');
    const mergeNode = nodeFinished.find((e) => e.nodeKey === 'merge_node');

    expect(vipAction?.status).toBe('succeeded');
    expect(stdAction?.status).toBe('skipped');
    expect(mergeNode?.status).toBe('succeeded');

    // Blueprint Section 5: Merge output includes ONLY sources whose incoming edges fired
    const mergeOutput = mergeNode?.output as any;
    expect(mergeOutput?.inputs).toBeDefined();
    expect(mergeOutput.inputs['vip_action']).toBeDefined();
    expect(mergeOutput.inputs['std_action']).toBeUndefined();
  });

  // 5. Retry succeeds on attempt 3
  it('5. Retry succeeds on attempt 3', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    requestCounts['/flaky-success-3'] = 0;

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'flaky_http',
          type: 'http.request',
          name: 'Flaky HTTP Request',
          position: { x: 100, y: 0 },
          params: {
            method: 'GET',
            url: `${serverUrl}/flaky-success-3`,
          },
          retry: {
            maxAttempts: 3,
            backoff: 'fixed',
            delayMs: 20,
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'flaky_http' }],
    };

    const result = await engine.run(graph, {
      runId: 'run-5',
      triggerKey: 'trig',
      triggerPayload: {},
    });

    expect(result.status).toBe('succeeded');

    const retryEvents = observer.events.filter((e) => e.type === 'node.retrying');
    expect(retryEvents).toHaveLength(2); // Attempt 1 retried, Attempt 2 retried

    const finishedNode = observer.events.find(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> =>
        e.type === 'node.finished' && e.nodeKey === 'flaky_http'
    );
    expect(finishedNode?.status).toBe('succeeded');
    expect(finishedNode?.attempts).toBe(3);
  });

  // 6. Non-retryable HTTP 4xx fails immediately
  it('6. Non-retryable HTTP 4xx fails immediately', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'http_404',
          type: 'http.request',
          name: 'HTTP 404 Request',
          position: { x: 100, y: 0 },
          params: {
            method: 'GET',
            url: `${serverUrl}/not-found-404`,
          },
          retry: {
            maxAttempts: 5,
            backoff: 'fixed',
            delayMs: 20,
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'http_404' }],
    };

    const result = await engine.run(graph, {
      runId: 'run-6',
      triggerKey: 'trig',
      triggerPayload: {},
    });

    expect(result.status).toBe('failed');

    const retryEvents = observer.events.filter((e) => e.type === 'node.retrying');
    expect(retryEvents).toHaveLength(0); // Never retried

    const finishedNode = observer.events.find(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> =>
        e.type === 'node.finished' && e.nodeKey === 'http_404'
    );
    expect(finishedNode?.status).toBe('failed');
    expect(finishedNode?.attempts).toBe(1); // Immediate failure on attempt 1
  });

  // 7. onError: continue allows downstream execution
  it('7. onError: continue allows downstream execution', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'failing_node',
          type: 'http.request',
          name: 'Failing Node',
          position: { x: 100, y: 0 },
          onError: 'continue',
          params: {
            method: 'GET',
            url: `${serverUrl}/not-found-404`,
          },
        },
        {
          key: 'downstream_node',
          type: 'http.request',
          name: 'Downstream Node',
          position: { x: 200, y: 0 },
          params: {
            method: 'POST',
            url: `${serverUrl}/echo`,
            body: {
              caughtError: '{{ failing_node.error.message }}',
            },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'failing_node' },
        { id: 'e2', source: 'failing_node', sourcePort: 'default', target: 'downstream_node' },
      ],
    };

    const result = await engine.run(graph, {
      runId: 'run-7',
      triggerKey: 'trig',
      triggerPayload: {},
    });

    // Run finishes as 'succeeded', while individual node remains 'failed'
    expect(result.status).toBe('succeeded');

    const nodeFinished = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    const failingEvent = nodeFinished.find((e) => e.nodeKey === 'failing_node');
    const downstreamEvent = nodeFinished.find((e) => e.nodeKey === 'downstream_node');

    expect(failingEvent?.status).toBe('failed');
    expect(failingEvent?.output).toEqual({
      error: { message: expect.stringContaining('HTTP 404') },
    });

    expect(downstreamEvent?.status).toBe('succeeded');
    const downstreamReceived = (downstreamEvent?.output as any)?.data?.received;
    expect(downstreamReceived.caughtError).toContain('HTTP 404');
  });

  // 8. onError: stop stops the run and skips remaining nodes
  it('8. onError: stop stops the run and skips remaining nodes', async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'failing_node',
          type: 'http.request',
          name: 'Failing Node',
          position: { x: 100, y: 0 },
          onError: 'stop',
          params: {
            method: 'GET',
            url: `${serverUrl}/not-found-404`,
          },
        },
        {
          key: 'node_step2',
          type: 'http.request',
          name: 'Step 2',
          position: { x: 200, y: 0 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
        {
          key: 'node_step3',
          type: 'http.request',
          name: 'Step 3',
          position: { x: 300, y: 0 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'failing_node' },
        { id: 'e2', source: 'failing_node', sourcePort: 'default', target: 'node_step2' },
        { id: 'e3', source: 'node_step2', sourcePort: 'default', target: 'node_step3' },
      ],
    };

    const result = await engine.run(graph, {
      runId: 'run-8',
      triggerKey: 'trig',
      triggerPayload: {},
    });

    expect(result.status).toBe('failed');

    const nodeFinished = observer.events.filter(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished'
    );

    const failingNode = nodeFinished.find((e) => e.nodeKey === 'failing_node');
    const step2Node = nodeFinished.find((e) => e.nodeKey === 'node_step2');
    const step3Node = nodeFinished.find((e) => e.nodeKey === 'node_step3');

    expect(failingNode?.status).toBe('failed');
    expect(step2Node?.status).toBe('skipped');
    expect(step3Node?.status).toBe('skipped');

    const runFinished = observer.events.find(
      (e): e is Extract<RunEvent, { type: 'run.finished' }> => e.type === 'run.finished'
    );
    expect(runFinished?.status).toBe('failed');
  });

  // 9. GraphValidator rejects a cycle
  it('9. GraphValidator rejects a cycle', () => {
    const registry = createDefaultNodeRegistry();

    const cyclicGraph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'node_a',
          type: 'http.request',
          name: 'Node A',
          position: { x: 100, y: 0 },
          params: { method: 'GET', url: 'http://example.com' },
        },
        {
          key: 'node_b',
          type: 'http.request',
          name: 'Node B',
          position: { x: 200, y: 0 },
          params: { method: 'GET', url: 'http://example.com' },
        },
        {
          key: 'node_c',
          type: 'http.request',
          name: 'Node C',
          position: { x: 300, y: 0 },
          params: { method: 'GET', url: 'http://example.com' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trig', sourcePort: 'default', target: 'node_a' },
        { id: 'e2', source: 'node_a', sourcePort: 'default', target: 'node_b' },
        { id: 'e3', source: 'node_b', sourcePort: 'default', target: 'node_c' },
        { id: 'e_cycle', source: 'node_c', sourcePort: 'default', target: 'node_a' }, // Cycle back to A!
      ],
    };

    expect(() => {
      GraphValidator.validate(cyclicGraph, registry);
    }).toThrow(ValidationError);

    expect(() => {
      GraphValidator.validate(cyclicGraph, registry);
    }).toThrow(/cycle detected/i);
  });

  // 10. Two-trigger graph executes only the selected trigger's reachable subgraph
  it("10. Two-trigger graph executes only the selected trigger's reachable subgraph", async () => {
    const registry = createDefaultNodeRegistry();
    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trigger_alpha',
          type: 'manual.trigger',
          name: 'Trigger Alpha',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'action_alpha_1',
          type: 'http.request',
          name: 'Action Alpha 1',
          position: { x: 100, y: 0 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
        {
          key: 'action_alpha_2',
          type: 'http.request',
          name: 'Action Alpha 2',
          position: { x: 200, y: 0 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
        // Unselected trigger and its subgraph
        {
          key: 'trigger_beta',
          type: 'manual.trigger',
          name: 'Trigger Beta',
          position: { x: 0, y: 200 },
          params: {},
        },
        {
          key: 'action_beta_1',
          type: 'http.request',
          name: 'Action Beta 1',
          position: { x: 100, y: 200 },
          params: { method: 'GET', url: `${serverUrl}/echo` },
        },
      ],
      edges: [
        { id: 'e_a1', source: 'trigger_alpha', sourcePort: 'default', target: 'action_alpha_1' },
        { id: 'e_a2', source: 'action_alpha_1', sourcePort: 'default', target: 'action_alpha_2' },
        { id: 'e_b1', source: 'trigger_beta', sourcePort: 'default', target: 'action_beta_1' },
      ],
    };

    const result = await engine.run(graph, {
      runId: 'run-10',
      triggerKey: 'trigger_alpha',
      triggerPayload: { source: 'alpha' },
    });

    expect(result.status).toBe('succeeded');

    const finishedNodeKeys = observer.events
      .filter((e): e is Extract<RunEvent, { type: 'node.finished' }> => e.type === 'node.finished')
      .map((e) => e.nodeKey);

    // Alpha branch nodes must execute
    expect(finishedNodeKeys).toContain('trigger_alpha');
    expect(finishedNodeKeys).toContain('action_alpha_1');
    expect(finishedNodeKeys).toContain('action_alpha_2');

    // Beta branch nodes must NOT be executed or emitted
    expect(finishedNodeKeys).not.toContain('trigger_beta');
    expect(finishedNodeKeys).not.toContain('action_beta_1');
  });

  // 11. A secret never appears in stored/emitted output or logs
  it('11. A secret never appears in stored/emitted output or logs', async () => {
    const SECRET_KEY = 'SUPER_SECRET_TOKEN_XYZ_987';

    // Mock credential store
    const credentials: ICredentialStore = {
      get: async (id: string) => {
        if (id === 'cred_secret_1') {
          return { apiKey: SECRET_KEY };
        }
        return {};
      },
    };

    // Custom action node that tries to leak secret into logs and output
    class SecretTestingNode extends ActionNode {
      readonly type = 'test.secret_leaker';
      readonly label = 'Secret Leaker';
      readonly credentialType = 'test';
      readonly params = [];

      protected async perform(
        _params: Record<string, Json>,
        secrets: Record<string, string>,
        ctx: RunContext
      ): Promise<Json> {
        ctx.log('info', `Attempting login with token: ${secrets.apiKey}`);
        ctx.log('error', `Failure with token: ${secrets.apiKey}`);
        return {
          status: 'authenticated',
          authHeader: `Bearer ${secrets.apiKey}`,
          rawToken: secrets.apiKey,
          nested: {
            details: `Credentials used: ${secrets.apiKey}`,
          },
        };
      }
    }

    const registry = createDefaultNodeRegistry();
    registry.register(new SecretTestingNode());

    const observer = new TestObserver();
    const engine = new WorkflowEngine(registry, { credentials, observers: [observer] });

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'leaker',
          type: 'test.secret_leaker',
          name: 'Secret Leaker',
          position: { x: 100, y: 0 },
          credentialId: 'cred_secret_1',
          params: {},
        },
      ],
      edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'leaker' }],
    };

    const result = await engine.run(graph, {
      runId: 'run-11',
      triggerKey: 'trig',
      triggerPayload: {},
    });

    expect(result.status).toBe('succeeded');

    // Stringify all emitted events to inspect the entire event stream
    const allEventsJson = JSON.stringify(observer.events);

    // Verify SECRET_KEY is nowhere in any emitted events
    expect(allEventsJson.includes(SECRET_KEY)).toBe(false);

    // Verify that [REDACTED] appears in logs and output
    const leakerFinished = observer.events.find(
      (e): e is Extract<RunEvent, { type: 'node.finished' }> =>
        e.type === 'node.finished' && e.nodeKey === 'leaker'
    );

    expect(leakerFinished).toBeDefined();
    expect(JSON.stringify(leakerFinished?.output)).toContain('[REDACTED]');
    expect(leakerFinished?.logs.some((l) => l.includes('[REDACTED]'))).toBe(true);
  });

  // Additional test: Delay node abortable sleep
  it('DelayNode executes and respects AbortSignal', async () => {
    const registry = createDefaultNodeRegistry();
    const engine = new WorkflowEngine(registry);

    const controller = new AbortController();

    const graph: WorkflowGraph = {
      nodes: [
        {
          key: 'trig',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          params: {},
        },
        {
          key: 'delay_node',
          type: 'logic.delay',
          name: 'Delay 1000ms',
          position: { x: 100, y: 0 },
          params: { durationMs: 1000 },
        },
      ],
      edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'delay_node' }],
    };

    // Abort after 50ms
    setTimeout(() => controller.abort(new Error('User aborted run')), 50);

    const result = await engine.run(graph, {
      runId: 'run-delay',
      triggerKey: 'trig',
      signal: controller.signal,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/abort/i);
  });
});
