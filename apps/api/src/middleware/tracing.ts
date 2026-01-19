import type { NextFunction, Request, Response } from "express";
import { createTracingContext, runWithTracingContext } from "../context/tracing.js";
import { extractUserContext, setSessionIdHeader } from "../context/user.js";

/**
 * Middleware to set up tracing context for each request
 */
export function tracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract user context
  const userContext = extractUserContext(req);

  // Set sessionId header if needed
  setSessionIdHeader(req, res, userContext);

  // Get requestId from pino-http (if available) or generate new traceId
  const requestId = (req as Request & { id?: string }).id;
  const traceId = requestId ?? undefined;

  // Create tracing context
  const tracingContext = createTracingContext(
    traceId,
    userContext.projectId,
    userContext.userId,
    userContext.sessionId,
  );

  // Store traceId in request for compatibility
  (req as Request & { traceId?: string; requestId?: string }).traceId = tracingContext.traceId;
  (req as Request & { traceId?: string; requestId?: string }).requestId = tracingContext.traceId;

  // Run request handler within tracing context
  runWithTracingContext(tracingContext, () => {
    next();
  });
}
