import { Json, ParamField, PortName } from '../../contracts.js';
import { TriggerNode } from '../base/TriggerNode.js';

export class ManualTriggerNode extends TriggerNode {
  readonly type = 'manual.trigger';
  readonly label = 'Manual Trigger';
  readonly outputs: PortName[] = ['default'];
  readonly params: ParamField[] = [
    {
      name: 'payload',
      label: 'Initial Payload',
      kind: 'json',
      required: false,
      default: {},
    },
  ];

  protected getTriggerOutput(payload: Json, params: Record<string, Json>): Json {
    // If runtime trigger payload was provided, use it; otherwise use default param
    if (payload !== null && payload !== undefined) {
      return payload;
    }
    return params.payload ?? {};
  }
}

