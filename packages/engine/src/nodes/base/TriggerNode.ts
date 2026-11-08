import { BaseNode } from './BaseNode.js';
import { GraphNode, Json, NodeResult, RunContext } from '../../contracts.js';

export abstract class TriggerNode extends BaseNode {
  readonly category = 'trigger' as const;

  protected async doExecute(
    _node: GraphNode,
    params: Record<string, Json>,
    _secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<NodeResult> {
    const output = await this.getTriggerOutput(ctx.triggerPayload, params);
    return {
      output,
      ports: [...this.outputs],
    };
  }

  /**
   * Derive node output from the trigger payload and resolved parameters.
   */
  protected abstract getTriggerOutput(
    payload: Json,
    params: Record<string, Json>
  ): Promise<Json> | Json;
}

