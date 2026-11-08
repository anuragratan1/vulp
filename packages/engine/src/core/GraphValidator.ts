import { WorkflowGraph, GraphNode, INodeType } from '../contracts.js';

export interface INodeTypeProvider {
  get(type: string): INodeType | undefined;
}

export interface ValidationOptions {
  /**
   * If true, permits incomplete draft workflows (e.g. missing trigger node, empty required parameters, empty node list).
   * Structural integrity (duplicate keys, unknown types, edge wiring, cycles) is still strictly verified.
   */
  allowDraft?: boolean;
}

export class ValidationError extends Error {
  constructor(message: string, public readonly nodeKey?: string, public readonly edgeId?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GraphValidator {
  /**
   * Validate a workflow graph against the node registry.
   * Throws ValidationError with actionable messages on failure.
   */
  public static validate(
    graph: WorkflowGraph,
    registry: INodeTypeProvider,
    options?: ValidationOptions
  ): void {
    const isDraft = Boolean(options?.allowDraft);

    if (!graph.nodes || graph.nodes.length === 0) {
      if (isDraft) return;
      throw new ValidationError('Graph validation failed: graph contains no nodes.');
    }

    const nodeMap = new Map<string, GraphNode>();
    let hasTrigger = false;

    // 1. Check duplicate keys, unknown node types, and presence of trigger nodes
    for (const node of graph.nodes) {
      if (!node.key || node.key.trim() === '') {
        throw new ValidationError(`Node has missing or empty key.`);
      }

      if (nodeMap.has(node.key)) {
        throw new ValidationError(
          `Graph validation failed: duplicate node key '${node.key}' detected.`,
          node.key
        );
      }
      nodeMap.set(node.key, node);

      const nodeType = registry.get(node.type);
      if (!nodeType) {
        throw new ValidationError(
          `Graph validation failed: node '${node.key}' uses unknown type '${node.type}'.`,
          node.key
        );
      }

      if (nodeType.category === 'trigger') {
        hasTrigger = true;
      }

      // Check required parameters (only enforced for non-draft graphs, e.g. on activation or execution)
      if (!isDraft) {
        for (const paramField of nodeType.params) {
          if (paramField.required) {
            const val = node.params?.[paramField.name];
            if (val === undefined || val === null || val === '') {
              throw new ValidationError(
                `Graph validation failed: node '${node.key}' (${node.name || node.type}) is missing required parameter '${paramField.name}'.`,
                node.key
              );
            }
          }
        }
      }
    }

    if (!hasTrigger && !isDraft) {
      throw new ValidationError(
        'Graph validation failed: workflow graph contains no trigger nodes.'
      );
    }

    // 2. Validate edges
    const edges = graph.edges || [];
    const adjacency = new Map<string, string[]>();
    for (const nodeKey of nodeMap.keys()) {
      adjacency.set(nodeKey, []);
    }

    for (const edge of edges) {
      if (!nodeMap.has(edge.source)) {
        throw new ValidationError(
          `Graph validation failed: edge '${edge.id}' references unknown source node '${edge.source}'.`,
          undefined,
          edge.id
        );
      }

      if (!nodeMap.has(edge.target)) {
        throw new ValidationError(
          `Graph validation failed: edge '${edge.id}' references unknown target node '${edge.target}'.`,
          undefined,
          edge.id
        );
      }

      const sourceNode = nodeMap.get(edge.source)!;
      const sourceNodeType = registry.get(sourceNode.type)!;

      if (!sourceNodeType.outputs.includes(edge.sourcePort)) {
        throw new ValidationError(
          `Graph validation failed: edge '${edge.id}' uses invalid source port '${edge.sourcePort}' on node '${edge.source}' (${sourceNode.type}). Valid ports: [${sourceNodeType.outputs.join(', ')}].`,
          edge.source,
          edge.id
        );
      }

      adjacency.get(edge.source)!.push(edge.target);
    }

    // 3. Cycle Detection using DFS (White = 0, Gray = 1, Black = 2)
    const state = new Map<string, number>();
    for (const nodeKey of nodeMap.keys()) {
      state.set(nodeKey, 0);
    }

    const cyclePath: string[] = [];

    const dfs = (current: string): boolean => {
      state.set(current, 1); // Gray: currently visiting
      cyclePath.push(current);

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        const neighborState = state.get(neighbor);
        if (neighborState === 1) {
          // Cycle found!
          cyclePath.push(neighbor);
          return true;
        }
        if (neighborState === 0) {
          if (dfs(neighbor)) {
            return true;
          }
        }
      }

      cyclePath.pop();
      state.set(current, 2); // Black: fully visited
      return false;
    };

    for (const nodeKey of nodeMap.keys()) {
      if (state.get(nodeKey) === 0) {
        if (dfs(nodeKey)) {
          const cycleStr = cyclePath.join(' -> ');
          throw new ValidationError(
            `Graph validation failed: cycle detected in workflow graph: ${cycleStr}.`
          );
        }
      }
    }
  }
}

