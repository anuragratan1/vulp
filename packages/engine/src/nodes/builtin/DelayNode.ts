import { ConfigError, Json, NodeResult, ParamField, PortName, RunContext } from '../../contracts.js';
import { abortableSleep } from '../../execution/RetryPolicy.js';
import { LogicNode } from '../base/LogicNode.js';

export class DelayNode extends LogicNode {
  readonly type = 'logic.delay';
  readonly label = 'Delay';
  readonly outputs: PortName[] = ['default'];
  readonly params: ParamField[] = [
    {
      name: 'durationMs',
      label: 'Duration (ms)',
      kind: 'number',
      required: true,
      default: 1000,
    },
  ];

  protected async decide(params: Record<string, Json>, ctx: RunContext): Promise<NodeResult> {
    const rawDuration = Number(params.durationMs ?? 1000);
    if (Number.isNaN(rawDuration) || rawDuration < 0) {
      throw new ConfigError(`Invalid durationMs value '${params.durationMs}'. Must be a non-negative number.`);
    }

    const maxDuration = 300000; // 300,000 ms (5 minutes)
    if (rawDuration > maxDuration) {
      throw new ConfigError(
        `Delay duration ${rawDuration}ms exceeds maximum allowed limit of ${maxDuration}ms (300 seconds).`
      );
    }

    ctx.log('info', `Waiting for ${rawDuration}ms...`);
    await abortableSleep(rawDuration, ctx.signal);
    ctx.log('info', `Completed waiting for ${rawDuration}ms.`);

    return {
      output: {
        waitedMs: rawDuration,
      },
      ports: ['default'],
    };
  }
}

