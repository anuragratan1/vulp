import { BaseNode } from './BaseNode.js';
import { GraphNode, Json, NodeResult, PortName, RunContext } from '../../contracts.js';

export abstract class ActionNode extends BaseNode {
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];

  protected async doExecute(
    _node: GraphNode,
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<NodeResult> {
    const output = await this.perform(params, secrets, ctx);
    return {
      output,
      ports: ['default'],
    };
  }

  /**
   * Perform the action with resolved parameters and loaded secrets.
   */
  protected abstract perform(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json>;
}

