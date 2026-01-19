import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface TracingContext {
  traceId: string;
  spanId: string;
  projectId: string;
  userId: string;
  sessionId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TracingContext>();

/**
 * Gets the current tracing context from AsyncLocalStorage
 */
export function getTracingContext(): TracingContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Runs a function within a tracing context
 */
export function runWithTracingContext<T>(
  context: TracingContext,
  fn: () => T,
): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Generates a new span ID
 */
export function generateSpanId(): string {
  return randomUUID();
}

/**
 * Creates a new tracing context with a new traceId
 */
export function createTracingContext(
  traceId?: string | undefined,
  projectId = "default",
  userId = "anonymous",
  sessionId: string = randomUUID(),
): TracingContext {
  return {
    traceId: traceId ?? randomUUID(),
    spanId: generateSpanId(),
    projectId,
    userId,
    sessionId,
  };
}

/**
 * Creates a child span context (same traceId, new spanId)
 */
export function createChildSpan(context: TracingContext): TracingContext {
  return {
    ...context,
    spanId: generateSpanId(),
  };
}

/**
 * Runs a function with a new child span
 */
export function runWithSpan<T>(
  context: TracingContext,
  spanId: string,
  fn: () => T,
): T {
  return asyncLocalStorage.run({ ...context, spanId }, fn);
}

export { asyncLocalStorage };
