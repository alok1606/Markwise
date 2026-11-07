/**
 * Retry policy for queries that gate whole pages. Only browser-level network
 * failures (the request never reached the server) are retried; authorization,
 * validation and server errors fail immediately so access denials are never masked.
 */
const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|network request failed/i;

export const MAX_NETWORK_RETRIES = 2;

export function isTransientNetworkError(error: unknown): boolean {
  return error instanceof TypeError && NETWORK_MESSAGE.test(error.message);
}

export function retryTransientNetwork(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_NETWORK_RETRIES && isTransientNetworkError(error);
}
