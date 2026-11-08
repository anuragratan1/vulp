import { BaseNode } from './BaseNode.js';
import { GraphNode, Json, NodeResult, RunContext } from '../../contracts.js';

export abstract class LogicNode extends BaseNode {
  readonly category = 'logic' as const;

  protected async doExecute(
    _node: GraphNode,
    params: Record<string, Json>,
    _secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<NodeResult> {
    return this.decide(params, ctx);
  }

  /**
   * Evaluate conditions or merge logic and return the NodeResult
   * with output and activated ports.
   */
  protected abstract decide(
    params: Record<string, Json>,
    ctx: RunContext
  ): Promise<NodeResult> | NodeResult;
}

