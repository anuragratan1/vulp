import {
  GraphNode,
  INodeType,
  Json,
  NodeResult,
  ParamField,
  PortName,
  RunContext,
  ConfigError,
} from '../../contracts.js';

const MAX_OUTPUT_SIZE_BYTES = 256 * 1024; // 256 KB

export abstract class BaseNode implements INodeType {
  abstract readonly type: string;
  abstract readonly label: string;
  abstract readonly category: 'trigger' | 'action' | 'logic';
  abstract readonly outputs: PortName[];
  abstract readonly params: ParamField[];
  readonly credentialType?: string;

  /**
   * Template Method pattern for executing a node.
   */
  public async run(node: GraphNode, ctx: RunContext): Promise<NodeResult> {
    // 1. Resolve all parameters
    const rawResolved = ctx.resolve(node.params ?? {});
    const resolvedParams = (
      rawResolved !== null && typeof rawResolved === 'object' && !Array.isArray(rawResolved)
        ? rawResolved
        : {}
    ) as Record<string, Json>;

    // 2. Validate resolved parameters and apply defaults
    const validatedParams = this.validateAndNormalizeParams(node.key, resolvedParams);

    // 3. Load credentials if required
    let secrets: Record<string, string> = {};
    if (node.credentialId) {
      secrets = await ctx.getSecrets(node.credentialId);
    }

    const secretValues = Object.values(secrets).filter(
      (s): s is string => typeof s === 'string' && s.length > 0
    );

    // Redact secrets from log calls
    const loggingCtx: RunContext = {
      ...ctx,
      log: (level, msg) => {
        ctx.log(level, this.redactString(msg, secretValues));
      },
    };

    // 4. Call doExecute
    const rawResult = await this.doExecute(node, validatedParams, secrets, loggingCtx);

    // 5. Redact secrets from output
    const redactedOutput = this.redactSecrets(rawResult.output, secretValues);

    // 6. Truncate oversized outputs
    const truncatedOutput = this.truncateOutput(redactedOutput);

    // 7. Return the final NodeResult
    return {
      output: truncatedOutput,
      ports: rawResult.ports,
    };
  }

  protected abstract doExecute(
    node: GraphNode,
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<NodeResult>;

  /**
   * Validate parameters against declared field schemas and apply defaults.
   */
  protected validateAndNormalizeParams(
    nodeKey: string,
    params: Record<string, Json>
  ): Record<string, Json> {
    const normalized: Record<string, Json> = { ...params };

    for (const field of this.params) {
      let val = normalized[field.name];

      if (val === undefined || val === null) {
        if (field.default !== undefined) {
          val = field.default;
          normalized[field.name] = val;
        } else if (field.required) {
          throw new ConfigError(
            `Node '${nodeKey}' (${this.type}): required parameter '${field.name}' is missing.`
          );
        }
      }

      if (val !== undefined && val !== null) {
        if (field.kind === 'number') {
          if (typeof val !== 'number') {
            const parsed = Number(val);
            if (Number.isNaN(parsed)) {
              throw new ConfigError(
                `Node '${nodeKey}' (${this.type}): parameter '${field.name}' must be a number, received '${String(val)}'.`
              );
            }
            normalized[field.name] = parsed;
          }
        } else if (field.kind === 'boolean') {
          if (typeof val !== 'boolean') {
            if (val === 'true' || val === 1) normalized[field.name] = true;
            else if (val === 'false' || val === 0) normalized[field.name] = false;
            else {
              throw new ConfigError(
                `Node '${nodeKey}' (${this.type}): parameter '${field.name}' must be a boolean.`
              );
            }
          }
        }

        if (field.options && field.options.length > 0) {
          const strVal = String(normalized[field.name]);
          if (!field.options.includes(strVal)) {
            throw new ConfigError(
              `Node '${nodeKey}' (${this.type}): parameter '${field.name}' has invalid value '${strVal}'. Allowed options: [${field.options.join(', ')}].`
            );
          }
        }
      }
    }

    return normalized;
  }

  /**
   * Redacts secret values from a string.
   */
  protected redactString(str: string, secrets: string[]): string {
    let res = str;
    for (const secret of secrets) {
      if (secret.length > 0) {
        res = res.split(secret).join('[REDACTED]');
      }
    }
    return res;
  }

  /**
   * Recursively redacts secret values from any JSON data.
   */
  protected redactSecrets(data: Json, secrets: string[]): Json {
    if (secrets.length === 0 || data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.redactString(data, secrets);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSecrets(item, secrets));
    }

    if (typeof data === 'object') {
      const copy: Record<string, Json> = {};
      for (const [k, v] of Object.entries(data)) {
        copy[this.redactString(k, secrets)] = this.redactSecrets(v, secrets);
      }
      return copy;
    }

    return data;
  }

  /**
   * Truncates outputs over 256 KB.
   */
  protected truncateOutput(data: Json): Json {
    if (data === null || data === undefined) return data;
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length > MAX_OUTPUT_SIZE_BYTES) {
      return {
        _truncated: true,
        preview: jsonStr.slice(0, 1000) + '... [TRUNCATED]',
      };
    }
    return data;
  }
}

