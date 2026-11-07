import { describe, expect, it } from 'vitest';
import { isTransientNetworkError, retryTransientNetwork } from '@/lib/query-retry';

describe('page-gating query retry', () => {
  it('retries a dropped connection ("Failed to fetch")', () => {
    expect(retryTransientNetwork(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(retryTransientNetwork(1, new TypeError('Failed to fetch'))).toBe(true);
  });

  it('stops after two retries', () => {
    expect(retryTransientNetwork(2, new TypeError('Failed to fetch'))).toBe(false);
  });

  it('recognises Firefox and Safari network failures', () => {
    expect(isTransientNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isTransientNetworkError(new TypeError('Load failed'))).toBe(true);
  });

  it('never retries authorization or server errors', () => {
    expect(retryTransientNetwork(0, new Error('Unauthorized'))).toBe(false);
    expect(retryTransientNetwork(0, new Error('Forbidden'))).toBe(false);
    expect(retryTransientNetwork(0, new TypeError('Cannot read properties of undefined'))).toBe(false);
  });
});
