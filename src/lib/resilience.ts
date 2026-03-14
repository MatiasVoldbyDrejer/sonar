import { NextResponse } from 'next/server';

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms)),
  ]);
}

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  timeout?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 2, baseDelay = 1000, timeout = 10_000, onRetry } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), timeout);
    } catch (error: unknown) {
      const isLast = attempt === retries;
      if (isLast) throw error;

      // Don't retry on 4xx errors (except 429)
      if (error instanceof Error && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status >= 400 && status < 500 && status !== 429) throw error;
      }

      onRetry?.(error instanceof Error ? error : new Error(String(error)), attempt);

      // Respect Retry-After header on 429
      let delay = baseDelay * Math.pow(2, attempt);
      if (error instanceof Error && 'headers' in error) {
        const headers = (error as { headers?: { get?: (k: string) => string | null } }).headers;
        const retryAfter = headers?.get?.('retry-after');
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) delay = parsed * 1000;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error('withRetry: exhausted retries');
}

export class LRUCache<K, V> {
  private map = new Map<K, { value: V; expires: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) return undefined;

    // Promote to MRU
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  getStale(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    // Promote to MRU
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Delete first to reset insertion order
    this.map.delete(key);

    // Evict LRU if at capacity
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }

    this.map.set(key, { value, expires: Date.now() + this.ttl });
  }

  get size(): number {
    return this.map.size;
  }
}

export function apiError(message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}
