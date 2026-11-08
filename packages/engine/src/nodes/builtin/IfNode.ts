import { ConfigError, Json, NodeResult, ParamField, PortName, RunContext } from '../../contracts.js';
import { LogicNode } from '../base/LogicNode.js';

export class IfNode extends LogicNode {
  readonly type = 'logic.if';
  readonly label = 'IF / ELSE';
  readonly outputs: PortName[] = ['true', 'false'];
  readonly params: ParamField[] = [
    {
      name: 'left',
      label: 'Left Operand',
      kind: 'string',
      required: true,
    },
    {
      name: 'operator',
      label: 'Operator',
      kind: 'select',
      required: true,
      default: 'equals',
      options: [
        'equals',
        'not_equals',
        'contains',
        'greater_than',
        'less_than',
        'is_empty',
        'is_not_empty',
      ],
    },
    {
      name: 'right',
      label: 'Right Operand',
      kind: 'string',
      required: false,
    },
  ];

  private parseFiniteNumber(val: unknown): number | null {
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private isEmpty(val: unknown): boolean {
    if (val === null || val === undefined || val === '') {
      return true;
    }
    if (Array.isArray(val)) {
      return val.length === 0;
    }
    if (typeof val === 'object') {
      return Object.keys(val as object).length === 0;
    }
    return false;
  }

  protected decide(params: Record<string, Json>, ctx: RunContext): NodeResult {
    const left = params.left;
    const operator = String(params.operator || 'equals');
    const right = params.right;

    let conditionMet = false;

    if (operator === 'is_empty') {
      conditionMet = this.isEmpty(left);
    } else if (operator === 'is_not_empty') {
      conditionMet = !this.isEmpty(left);
    } else {
      const numLeft = this.parseFiniteNumber(left);
      const numRight = this.parseFiniteNumber(right);
      const isNumeric = numLeft !== null && numRight !== null;

      switch (operator) {
        case 'equals':
          conditionMet = isNumeric ? numLeft === numRight : String(left ?? '') === String(right ?? '');
          break;
        case 'not_equals':
          conditionMet = isNumeric ? numLeft !== numRight : String(left ?? '') !== String(right ?? '');
          break;
        case 'contains':
          if (Array.isArray(left)) {
            conditionMet = left.some((item) => String(item) === String(right));
          } else {
            conditionMet = String(left ?? '').includes(String(right ?? ''));
          }
          break;
        case 'greater_than':
          conditionMet = isNumeric ? numLeft! > numRight! : String(left ?? '') > String(right ?? '');
          break;
        case 'less_than':
          conditionMet = isNumeric ? numLeft! < numRight! : String(left ?? '') < String(right ?? '');
          break;
        default:
          throw new ConfigError(`Unsupported operator '${operator}' in IF node.`);
      }
    }

    const port: PortName = conditionMet ? 'true' : 'false';
    ctx.log('info', `IF evaluated: [${operator}] result=${conditionMet} -> port [${port}]`);

    return {
      output: {
        left: left ?? null,
        operator,
        right: right ?? null,
        result: conditionMet,
      },
      ports: [port],
    };
  }
}

