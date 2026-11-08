import { ConfigError, IRetryPolicy, NodeError } from '../contracts.js';

export class FixedRetryPolicy implements IRetryPolicy {
  constructor(
    public readonly maxAttempts: number = 1,
    public readonly delayMs: number = 1000
  ) {}

  public nextDelay(attempt: number): number | null {
    if (attempt >= this.maxAttempts) {
      return null;
    }
    return Math.max(0, this.delayMs);
  }
}

export class ExponentialRetryPolicy implements IRetryPolicy {
  constructor(
    public readonly maxAttempts: number = 1,
    public readonly delayMs: number = 1000,
    public readonly maxDelayMs: number = 30000
  ) {}

  public nextDelay(attempt: number): number | null {
    if (attempt >= this.maxAttempts) {
      return null;
    }
    const delay = this.delayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, this.maxDelayMs);
  }
}

export function createRetryPolicy(config?: {
  maxAttempts?: number;
  backoff?: 'fixed' | 'exponential';
  delayMs?: number;
}): IRetryPolicy {
  const maxAttempts = config?.maxAttempts ?? 1;
  const delayMs = config?.delayMs ?? 1000;
  const backoff = config?.backoff ?? 'fixed';

  if (backoff === 'exponential') {
    return new ExponentialRetryPolicy(maxAttempts, delayMs);
  }
  return new FixedRetryPolicy(maxAttempts, delayMs);
}

/**
 * Checks whether an error thrown by a node is retryable.
 * ConfigError: non-retryable.
 * NodeError: respects error.retryable.
 * HTTP 4xx except 429: non-retryable.
 * HTTP 429, HTTP 5xx, Network errors: retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ConfigError) {
    return false;
  }

  if (error instanceof NodeError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const errObj = error as any;
    const status = errObj.status ?? errObj.statusCode;
    if (typeof status === 'number') {
      if (status === 429) return true;
      if (status >= 400 && status < 500) return false;
      if (status >= 500) return true;
    }

    const code = errObj.code;
    const msg = error.message.toLowerCase();
    if (
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Abortable sleep utility supporting AbortSignal.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error('Aborted'));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

