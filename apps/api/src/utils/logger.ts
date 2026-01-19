import type pino from "pino";
import { getTracingContext } from "../context/tracing.js";
import { logger } from "../logger.js";

/**
 * Gets a logger instance with tracing context automatically included
 */
export function getContextLogger(): pino.Logger {
  const context = getTracingContext();
  if (!context) {
    return logger;
  }

  return logger.child({
    traceId: context.traceId,
    spanId: context.spanId,
    projectId: context.projectId,
    userId: context.userId,
  });
}
