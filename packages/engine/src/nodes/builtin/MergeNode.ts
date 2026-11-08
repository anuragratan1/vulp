import { Json, NodeResult, ParamField, PortName, RunContext } from '../../contracts.js';
import { LogicNode } from '../base/LogicNode.js';

export class MergeNode extends LogicNode {
  readonly type = 'logic.merge';
  readonly label = 'Merge';
  readonly outputs: PortName[] = ['default'];
  readonly params: ParamField[] = [];

  protected decide(params: Record<string, Json>, ctx: RunContext): NodeResult {
    const firedInputs = (params._inputs as Record<string, Json>) ?? {};
    ctx.log('info', `Merge executed with sources: [${Object.keys(firedInputs).join(', ')}]`);

    return {
      output: {
        inputs: firedInputs,
      },
      ports: ['default'],
    };
  }
}

