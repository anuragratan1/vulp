import { Node, Edge } from '@xyflow/react';
import { WorkflowGraph, GraphNode, GraphEdge, Json } from '@workflow/engine';
import { NodeTypeMetadata } from '../api/client.js';

export interface WorkflowNodeData extends Record<string, unknown> {
  key: string;
  type: string;
  name: string;
  params: Record<string, Json>;
  credentialId?: string;
  retry?: {
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delayMs: number;
  };
  onError?: 'stop' | 'continue';
  category?: 'trigger' | 'action' | 'logic';
  outputs?: string[];
  executionStatus?: 'idle' | 'running' | 'succeeded' | 'failed' | 'skipped';
  [key: string]: unknown;
}

export type CanvasNode = Node<WorkflowNodeData>;
export type CanvasEdge = Edge;

export function workflowGraphToReactFlow(
  graph: WorkflowGraph,
  metaMap: Map<string, NodeTypeMetadata> = new Map()
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = (graph.nodes || []).map((node) => {
    const meta = metaMap.get(node.type);
    let params = { ...(node.params || {}) };

    // Prune stale or orphaned mappings for sheets.appendRow if _mappingMeta defines the active columns
    if (node.type === 'sheets.appendRow') {
      if (
        params._mappingMeta &&
        typeof params._mappingMeta === 'object' &&
        !Array.isArray(params._mappingMeta) &&
        Object.keys(params._mappingMeta).length > 0 &&
        params.values &&
        typeof params.values === 'object' &&
        !Array.isArray(params.values)
      ) {
        const allowedHeaders = new Set(Object.keys(params._mappingMeta));
        const cleanValues: Record<string, any> = {};
        for (const [k, v] of Object.entries(params.values)) {
          if (allowedHeaders.has(k)) {
            cleanValues[k] = v;
          }
        }
        params = {
          ...params,
          values: cleanValues,
        };
      }
    }

    return {
      id: node.key,
      type: 'workflowNode',
      position: node.position || { x: 100, y: 100 },
      data: {
        key: node.key,
        type: node.type,
        name: node.name || meta?.label || node.type,
        params,
        credentialId: node.credentialId,
        retry: node.retry ? { ...node.retry } : undefined,
        onError: node.onError,
        category: meta?.category || (node.type.startsWith('manual.') ? 'trigger' : node.type.startsWith('http.') ? 'action' : 'logic'),
        outputs: meta?.outputs || ['default'],
        executionStatus: 'idle',
      },
    };
  });

  const nodeMap = new Map((graph.nodes || []).map((n) => [n.key, n]));

  const edges: CanvasEdge[] = (graph.edges || []).map((edge: any) => {
    const rawSource = edge.sourceHandle || edge.sourcePort || 'default';
    const rawTarget = edge.targetHandle || 'input';
    const isTrue = String(rawSource).startsWith('true') || edge.sourcePort === 'true';
    const isFalse = String(rawSource).startsWith('false') || edge.sourcePort === 'false';
    const branch = isTrue ? 'true' : isFalse ? 'false' : 'default';

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // Normalize source handle to valid handle IDs on the node
    let normalizedSourceHandle = 'default';
    if (sourceNode?.type === 'logic.if') {
      if (rawSource === 'true-top') normalizedSourceHandle = 'true-top';
      else if (rawSource === 'false-bottom') normalizedSourceHandle = 'false-bottom';
      else normalizedSourceHandle = isTrue ? 'true' : 'false';
    } else {
      if (['default', 'default-top', 'default-bottom', 'default-right', 'default-left'].includes(rawSource)) {
        normalizedSourceHandle = rawSource;
      } else {
        normalizedSourceHandle = 'default';
      }
    }

    // Normalize target handle to valid handle IDs on the node
    let normalizedTargetHandle = 'input';
    if (targetNode?.type === 'logic.merge') {
      if (['input', 'input-bottom', 'input-top', 'input-bottom-face'].includes(rawTarget)) {
        normalizedTargetHandle = rawTarget;
      } else {
        normalizedTargetHandle = 'input';
      }
    } else {
      if (['input', 'input-top', 'input-bottom', 'input-right', 'input-left'].includes(rawTarget)) {
        normalizedTargetHandle = rawTarget;
      } else {
        normalizedTargetHandle = 'input';
      }
    }

    return {
      id: edge.id,
      type: 'workflowEdge',
      source: edge.source,
      sourceHandle: normalizedSourceHandle,
      target: edge.target,
      targetHandle: normalizedTargetHandle,
      animated: false,
      data: { branch },
      style: { stroke: 'var(--color-edge)', strokeWidth: 1.75 },
    };
  });

  return { nodes, edges };
}

export function reactFlowToWorkflowGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): WorkflowGraph {
  const graphNodes: GraphNode[] = nodes.map((node) => {
    let params = { ...(node.data.params || {}) };

    // Prune stale or orphaned mappings for sheets.appendRow if _mappingMeta defines the active columns
    if (node.data.type === 'sheets.appendRow') {
      if (
        params._mappingMeta &&
        typeof params._mappingMeta === 'object' &&
        !Array.isArray(params._mappingMeta) &&
        Object.keys(params._mappingMeta).length > 0 &&
        params.values &&
        typeof params.values === 'object' &&
        !Array.isArray(params.values)
      ) {
        const allowedHeaders = new Set(Object.keys(params._mappingMeta));
        const cleanValues: Record<string, any> = {};
        for (const [k, v] of Object.entries(params.values)) {
          if (allowedHeaders.has(k)) {
            cleanValues[k] = v;
          }
        }
        params = {
          ...params,
          values: cleanValues,
        };
      }
    }

    return {
      key: node.data.key || node.id,
      type: node.data.type,
      name: node.data.name,
      position: {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      },
      params,
      credentialId: node.data.credentialId,
      retry: node.data.retry ? { ...node.data.retry } : undefined,
      onError: node.data.onError,
    };
  });

  const graphEdges: GraphEdge[] = edges.map((edge) => {
    let semanticPort = 'default';
    const rawSource = edge.sourceHandle || (edge.data?.branch as string) || 'default';
    if (String(rawSource).startsWith('true')) {
      semanticPort = 'true';
    } else if (String(rawSource).startsWith('false')) {
      semanticPort = 'false';
    }

    const item: any = {
      id: edge.id,
      source: edge.source,
      sourcePort: semanticPort,
      target: edge.target,
    };
    if (edge.sourceHandle && edge.sourceHandle !== semanticPort) {
      item.sourceHandle = edge.sourceHandle;
    }
    if (edge.targetHandle && edge.targetHandle !== 'input') {
      item.targetHandle = edge.targetHandle;
    }
    return item as GraphEdge;
  });

  return {
    nodes: graphNodes,
    edges: graphEdges,
  };
}
