import { ActionNode } from './ActionNode.js';
import { Json, RunContext } from '../../contracts.js';

export interface IIntegrationOperation {
  execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json>;
}

/**
 * Base class for third-party integration nodes using composition.
 * Composes an IIntegrationOperation to execute external API interactions.
 */
export abstract class IntegrationActionNode extends ActionNode {
  abstract readonly integration: string;
  abstract readonly operation: string;

  protected abstract getOperation(): IIntegrationOperation;

  protected async perform(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const op = this.getOperation();
    return await op.execute(params, secrets, ctx);
  }
}

