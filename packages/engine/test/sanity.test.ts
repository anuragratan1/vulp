import { describe, it, expect } from 'vitest';
import { NodeError, ConfigError } from '../src/contracts.js';

describe('Contracts Sanity', () => {
  it('instantiates NodeError with retryable flag', () => {
    const err = new NodeError('network error', true);
    expect(err.message).toBe('network error');
    expect(err.retryable).toBe(true);
  });

  it('instantiates ConfigError as non-retryable', () => {
    const err = new ConfigError('bad config');
    expect(err.message).toBe('bad config');
    expect(err.retryable).toBe(false);
  });
});
