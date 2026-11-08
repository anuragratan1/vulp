export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type PortName = string;

export interface GraphNode {
  key: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  params: Record<string, Json>;
  credentialId?: string;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
  onError?: 'stop' | 'continue';
}

export interface GraphEdge {
  id: string;
  source: string;
  sourcePort: PortName;
  target: string;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeResult {
  output: Json;
  ports: PortName[];
}

export interface ParamField {
  name: string;
  label: string;
  required?: boolean;
  default?: Json;
  kind: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json';
  options?: string[];
}

export interface RunContext {
  runId: string;
  triggerPayload: Json;
  signal: AbortSignal;
  resolve(template: Json): Json;
  getSecrets(credentialId: string): Promise<Record<string, string>>;
  log(level: 'info' | 'warn' | 'error', msg: string): void;
}

export interface NodeContext {
  signal: AbortSignal;
  triggerPayload: Json;
  log: RunContext['log'];
}

export interface INodeType {
  readonly type: string;
  readonly label: string;
  readonly category: 'trigger' | 'action' | 'logic';
  readonly outputs: PortName[];
  readonly params: ParamField[];
  readonly credentialType?: string;
  run(node: GraphNode, ctx: RunContext): Promise<NodeResult>;
}

export class NodeError extends Error {
  constructor(msg: string, public retryable = false) {
    super(msg);
  }
}

export class ConfigError extends NodeError {
  constructor(msg: string) {
    super(msg, false);
  }
}

export type RunEvent =
  | { type: 'run.started'; runId: string; at: number }
  | { type: 'node.started'; runId: string; nodeKey: string; attempt: number; at: number }
  | {
      type: 'node.retrying';
      runId: string;
      nodeKey: string;
      attempt: number;
      error: string;
      nextDelayMs: number;
    }
  | {
      type: 'node.finished';
      runId: string;
      nodeKey: string;
      status: 'succeeded' | 'failed' | 'skipped';
      attempts: number;
      paramsResolved?: Json;
      output?: Json;
      error?: string;
      logs: string[];
      at: number;
    }
  | { type: 'run.finished'; runId: string; status: 'succeeded' | 'failed'; error?: string; at: number };

export interface IRunObserver {
  onEvent(e: RunEvent): void;
}

export interface IRetryPolicy {
  nextDelay(attempt: number): number | null;
}

// ICredentialStore
export interface ICredentialStore {
  get(id: string): Promise<Record<string, string>>;
}

