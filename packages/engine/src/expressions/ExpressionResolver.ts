import { Json } from '../contracts.js';

export interface ExpressionContext {
  nodeOutputs: Record<string, Json>;
  triggerKey?: string;
  triggerPayload?: Json;
  currentNodeKey?: string;
  currentNodeName?: string;
  currentField?: string;
  strict?: boolean;
  onWarning?: (msg: string) => void;
}

export interface DetailedPathResult {
  resolved: boolean;
  value: Json;
  reason?: string;
}

export class UnresolvedExpressionError extends Error {
  readonly expression: string;
  readonly nodeKey?: string;
  readonly nodeName?: string;
  readonly fieldName?: string;
  readonly availableContext: Record<string, string[]>;

  constructor(
    expression: string,
    options?: {
      nodeKey?: string;
      nodeName?: string;
      fieldName?: string;
      availableContext?: Record<string, string[]>;
      reason?: string;
    }
  ) {
    const rawExpr = expression.trim();
    const formattedExpr = rawExpr.startsWith('{{') ? rawExpr : `{{ ${rawExpr} }}`;

    const cleanField = options?.fieldName
      ? options.fieldName.startsWith('values.')
        ? options.fieldName.slice(7)
        : options.fieldName
      : null;

    let stepIdentifier = '';
    if (cleanField && options?.nodeName) {
      stepIdentifier = `in column '${cleanField}' of step '${options.nodeName}'${options.nodeKey ? ` (${options.nodeKey})` : ''}`;
    } else if (cleanField) {
      stepIdentifier = `in column '${cleanField}'${options?.nodeKey ? ` of node '${options.nodeKey}'` : ''}`;
    } else if (options?.nodeName) {
      stepIdentifier = `in step '${options.nodeName}'${options.nodeKey ? ` (${options.nodeKey})` : ''}`;
    } else if (options?.nodeKey) {
      stepIdentifier = `in node '${options.nodeKey}'`;
    }

    let contextSummary = '';
    if (options?.availableContext && Object.keys(options.availableContext).length > 0) {
      const parts = Object.entries(options.availableContext).map(
        ([node, keys]) => `${node}: [${keys.slice(0, 15).join(', ')}${keys.length > 15 ? '...' : ''}]`
      );
      contextSummary = ` Available context at this step: ${parts.join('; ')}.`;
    }

    const reasonPart = options?.reason ? ` (${options.reason})` : '';
    const message = `Unresolved variable expression ${formattedExpr}${stepIdentifier ? ` ${stepIdentifier}` : ''}${reasonPart}.${contextSummary}`.trim();
    super(message);
    this.name = 'UnresolvedExpressionError';
    this.expression = rawExpr;
    this.nodeKey = options?.nodeKey;
    this.nodeName = options?.nodeName;
    this.fieldName = options?.fieldName;
    this.availableContext = options?.availableContext || {};
  }
}

const EXACT_EXPRESSION_REGEX = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
const EMBEDDED_EXPRESSION_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;
const PATH_TOKEN_REGEX = /\[(?:'([^']*)'|"([^"]*)"|(\d+)|([^\]]+))\]|([^.[\]]+)/g;

export class ExpressionResolver {
  /**
   * Parse a property path like "node_2.items[0].title" into segments:
   * ["node_2", "items", "0", "title"]
   */
  public static parsePath(pathStr: string): string[] {
    const segments: string[] = [];
    PATH_TOKEN_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PATH_TOKEN_REGEX.exec(pathStr)) !== null) {
      const segment = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5];
      if (segment !== undefined) {
        segments.push(segment);
      }
    }
    return segments;
  }

  /**
   * Summarize the keys available in the context for descriptive error messages.
   */
  public static getAvailableContextSummary(ctx: ExpressionContext): Record<string, string[]> {
    const summary: Record<string, string[]> = {};

    const summarizeObj = (obj: any): string[] => {
      if (!obj || typeof obj !== 'object') return [typeof obj];
      const keys = Object.keys(obj);
      if (obj.body && typeof obj.body === 'object' && !Array.isArray(obj.body)) {
        for (const bk of Object.keys(obj.body)) {
          if (!keys.includes(bk)) keys.push(bk);
        }
      }
      return keys;
    };

    if (ctx.triggerKey && ctx.triggerKey in ctx.nodeOutputs) {
      summary['trigger'] = summarizeObj(ctx.nodeOutputs[ctx.triggerKey]);
    } else if (ctx.triggerPayload !== undefined) {
      summary['trigger'] = summarizeObj(ctx.triggerPayload);
    }

    for (const [key, val] of Object.entries(ctx.nodeOutputs)) {
      summary[key] = summarizeObj(val);
    }

    return summary;
  }

  /**
   * Resolve a single path expression with detailed resolution status.
   */
  public static resolvePathDetailed(rawPath: string, ctx: ExpressionContext): DetailedPathResult {
    const pathStr = rawPath.trim();

    if (!pathStr) {
      return { resolved: false, value: null, reason: 'Empty expression path' };
    }

    if (pathStr === '$now') {
      return { resolved: true, value: new Date().toISOString() };
    }

    if (pathStr === '$uuid') {
      const uuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'uuid-' + Math.random().toString(36).substring(2, 10);
      return { resolved: true, value: uuid };
    }

    let segments = this.parsePath(pathStr);
    if (segments.length === 0) {
      return { resolved: false, value: null, reason: 'Empty expression path' };
    }

    // System variables with path segments
    if (segments[0] === '$now') {
      return { resolved: true, value: new Date().toISOString() };
    }
    if (segments[0] === '$uuid') {
      const uuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'uuid-' + Math.random().toString(36).substring(2, 10);
      return { resolved: true, value: uuid };
    }

    // Handle $node prefix (e.g. $node.trigger.output.name or $node["trigger"].name)
    if (segments[0] === '$node' && segments.length > 1) {
      segments = segments.slice(1);
      if (segments.length > 1 && (segments[1] === 'output' || segments[1] === 'data')) {
        segments.splice(1, 1);
      }
    }

    const rootKey = segments[0];

    // Find trigger object if available
    let triggerObj: any = undefined;
    if (ctx.triggerKey && ctx.triggerKey in ctx.nodeOutputs) {
      triggerObj = ctx.nodeOutputs[ctx.triggerKey];
    } else if ('trigger' in ctx.nodeOutputs) {
      triggerObj = ctx.nodeOutputs['trigger'];
    } else if (ctx.triggerPayload !== undefined) {
      triggerObj = ctx.triggerPayload;
    } else {
      const foundTriggerKey = Object.keys(ctx.nodeOutputs).find(
        (k) => k.includes('trigger') || k.startsWith('trigger_')
      );
      if (foundTriggerKey) {
        triggerObj = ctx.nodeOutputs[foundTriggerKey];
      }
    }

    let current: any;
    let segmentsToTraverse: string[] = [];

    if (rootKey === 'trigger') {
      if (triggerObj === undefined) {
        return {
          resolved: false,
          value: null,
          reason: `Trigger output is not available for path '{{ ${pathStr} }}'`,
        };
      }
      current = triggerObj;
      segmentsToTraverse = segments.slice(1);

      // If accessing {{ trigger.field }} but field is inside body/payload/data
      if (segmentsToTraverse.length > 0 && current && typeof current === 'object' && !Array.isArray(current)) {
        const firstSeg = segmentsToTraverse[0];
        if (!(firstSeg in current)) {
          if (current.body && typeof current.body === 'object' && firstSeg in current.body) {
            current = current.body;
          } else if (current.payload && typeof current.payload === 'object' && firstSeg in current.payload) {
            current = current.payload;
          } else if (current.data && typeof current.data === 'object' && firstSeg in current.data) {
            current = current.data;
          }
        } else if (firstSeg === 'body' && segmentsToTraverse.length > 1 && !('body' in current)) {
          // If accessing {{ trigger.body.field }} but trigger object is flat
          segmentsToTraverse = segmentsToTraverse.slice(1);
        }
      }
    } else if (rootKey in ctx.nodeOutputs) {
      // Direct exact node output match
      current = ctx.nodeOutputs[rootKey];
      segmentsToTraverse = segments.slice(1);

      if (segmentsToTraverse.length > 0 && current && typeof current === 'object' && !Array.isArray(current)) {
        const firstSeg = segmentsToTraverse[0];
        if (!(firstSeg in current)) {
          if (current.body && typeof current.body === 'object' && firstSeg in current.body) {
            current = current.body;
          } else if (current.payload && typeof current.payload === 'object' && firstSeg in current.payload) {
            current = current.payload;
          } else if (current.data && typeof current.data === 'object' && firstSeg in current.data) {
            current = current.data;
          }
        } else if (firstSeg === 'body' && segmentsToTraverse.length > 1 && !('body' in current)) {
          segmentsToTraverse = segmentsToTraverse.slice(1);
        }
      }
    } else {
      // Check for node alias or prefix match (e.g. `webhook_trigger.name` matching `webhook_trigger_vvrf`)
      const matchedNodeKey = Object.keys(ctx.nodeOutputs).find((k) => {
        const normalizedK = k.replace(/_[a-z0-9]{4,}$/i, '');
        const normalizedRoot = rootKey.replace(/_[a-z0-9]{4,}$/i, '');
        return normalizedK === normalizedRoot || k.startsWith(rootKey);
      });

      if (matchedNodeKey) {
        current = ctx.nodeOutputs[matchedNodeKey];
        segmentsToTraverse = segments.slice(1);

        if (segmentsToTraverse.length > 0 && current && typeof current === 'object' && !Array.isArray(current)) {
          const firstSeg = segmentsToTraverse[0];
          if (!(firstSeg in current)) {
            if (current.body && typeof current.body === 'object' && firstSeg in current.body) {
              current = current.body;
            } else if (current.payload && typeof current.payload === 'object' && firstSeg in current.payload) {
              current = current.payload;
            }
          }
        }
      } else {
        // Fallback: Check if rootKey is a bare field name directly in trigger or an upstream node
        let foundBareSource = false;

        if (triggerObj && typeof triggerObj === 'object') {
          if (rootKey in triggerObj) {
            current = triggerObj;
            segmentsToTraverse = segments;
            foundBareSource = true;
          } else if (triggerObj.body && typeof triggerObj.body === 'object' && rootKey in triggerObj.body) {
            current = triggerObj.body;
            segmentsToTraverse = segments;
            foundBareSource = true;
          } else if (triggerObj.payload && typeof triggerObj.payload === 'object' && rootKey in triggerObj.payload) {
            current = triggerObj.payload;
            segmentsToTraverse = segments;
            foundBareSource = true;
          }
        }

        if (!foundBareSource) {
          // Check upstream node outputs for the bare field
          for (const rawNodeVal of Object.values(ctx.nodeOutputs)) {
            if (rawNodeVal && typeof rawNodeVal === 'object' && !Array.isArray(rawNodeVal)) {
              const nodeVal = rawNodeVal as Record<string, any>;
              if (rootKey in nodeVal) {
                current = nodeVal;
                segmentsToTraverse = segments;
                foundBareSource = true;
                break;
              } else if (nodeVal.body && typeof nodeVal.body === 'object' && rootKey in nodeVal.body) {
                current = nodeVal.body;
                segmentsToTraverse = segments;
                foundBareSource = true;
                break;
              }
            }
          }
        }

        if (!foundBareSource) {
          return {
            resolved: false,
            value: null,
            reason: `Node or property '${rootKey}' not found in execution context`,
          };
        }
      }
    }

    // Traverse the remaining path segments
    for (let i = 0; i < segmentsToTraverse.length; i++) {
      const segment = segmentsToTraverse[i];

      if (current === null || current === undefined) {
        return {
          resolved: false,
          value: null,
          reason: `Cannot read property '${segment}' of ${current} in path '{{ ${pathStr} }}'`,
        };
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        if (Number.isInteger(index) && index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return {
            resolved: false,
            value: null,
            reason: `Array index '${segment}' out of bounds (length: ${current.length}) in path '{{ ${pathStr} }}'`,
          };
        }
      } else if (typeof current === 'object') {
        if (segment in current) {
          current = current[segment];
        } else if (current.body && typeof current.body === 'object' && segment in current.body) {
          current = current.body[segment];
        } else if (current.payload && typeof current.payload === 'object' && segment in current.payload) {
          current = current.payload[segment];
        } else if (current.data && typeof current.data === 'object' && segment in current.data) {
          current = current.data[segment];
        } else {
          return {
            resolved: false,
            value: null,
            reason: `Property '${segment}' not found in path '{{ ${pathStr} }}'`,
          };
        }
      } else {
        return {
          resolved: false,
          value: null,
          reason: `Cannot access property '${segment}' on primitive (${typeof current}) in path '{{ ${pathStr} }}'`,
        };
      }
    }

    return {
      resolved: true,
      value: current === undefined ? null : (current as Json),
    };
  }

  /**
   * Resolve a single path expression against context.
   */
  public static resolvePath(rawPath: string, ctx: ExpressionContext): Json {
    const result = this.resolvePathDetailed(rawPath, ctx);
    if (!result.resolved) {
      if (ctx.strict) {
        throw new UnresolvedExpressionError(rawPath, {
          nodeKey: ctx.currentNodeKey,
          nodeName: ctx.currentNodeName,
          fieldName: ctx.currentField,
          availableContext: this.getAvailableContextSummary(ctx),
          reason: result.reason,
        });
      }
      ctx.onWarning?.(result.reason || `Unresolved expression path: {{ ${rawPath} }}`);
      return null;
    }
    return result.value;
  }

  /**
   * Resolve an arbitrary Json template (string, object, array, or primitive).
   */
  public static resolve(template: Json, ctx: ExpressionContext): Json {
    if (typeof template === 'string') {
      // 1. Check for exact expression: preserving raw type
      const exactMatch = template.match(EXACT_EXPRESSION_REGEX);
      if (exactMatch) {
        const expr = exactMatch[1];
        return this.resolvePath(expr, ctx);
      }

      // 2. Embedded expressions in a string
      if (template.includes('{{')) {
        EMBEDDED_EXPRESSION_REGEX.lastIndex = 0;
        return template.replace(EMBEDDED_EXPRESSION_REGEX, (_fullMatch, expr) => {
          const result = this.resolvePathDetailed(expr, ctx);
          if (!result.resolved) {
            if (ctx.strict) {
              throw new UnresolvedExpressionError(expr, {
                nodeKey: ctx.currentNodeKey,
                nodeName: ctx.currentNodeName,
                fieldName: ctx.currentField,
                availableContext: this.getAvailableContextSummary(ctx),
                reason: result.reason,
              });
            }
            ctx.onWarning?.(result.reason || `Unresolved expression path: {{ ${expr} }}`);
            return 'null';
          }
          const val = result.value;
          if (val === null || val === undefined) {
            return 'null';
          }
          if (typeof val === 'object') {
            return JSON.stringify(val);
          }
          return String(val);
        });
      }

      return template;
    }

    if (Array.isArray(template)) {
      return template.map((item, index) => {
        const childField = ctx.currentField ? `${ctx.currentField}[${index}]` : `[${index}]`;
        return this.resolve(item, { ...ctx, currentField: childField });
      });
    }

    if (template !== null && typeof template === 'object') {
      const result: Record<string, Json> = {};
      for (const [key, val] of Object.entries(template)) {
        const childField = ctx.currentField ? `${ctx.currentField}.${key}` : key;
        result[key] = this.resolve(val, { ...ctx, currentField: childField });
      }
      return result;
    }

    // Primitives: number, boolean, null
    return template;
  }
}
