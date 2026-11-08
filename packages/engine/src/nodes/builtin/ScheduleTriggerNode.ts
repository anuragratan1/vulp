import { Json, ParamField, PortName } from '../../contracts.js';
import { TriggerNode } from '../base/TriggerNode.js';

export class ScheduleTriggerNode extends TriggerNode {
  readonly type = 'schedule.trigger';
  readonly label = 'Schedule Trigger';
  readonly outputs: PortName[] = ['default'];
  readonly params: ParamField[] = [
    {
      name: 'cron',
      label: 'Cron Expression',
      kind: 'string',
      required: true,
      default: '0 * * * *',
    },
    {
      name: 'timezone',
      label: 'Timezone',
      kind: 'string',
      required: false,
      default: 'UTC',
    },
  ];

  protected getTriggerOutput(payload: Json, params: Record<string, Json>): Json {
    if (payload !== null && payload !== undefined && Object.keys(payload).length > 0) {
      return payload;
    }
    return {
      scheduledTime: new Date().toISOString(),
      cron: params.cron || '0 * * * *',
      timezone: params.timezone || 'UTC',
    };
  }
}

