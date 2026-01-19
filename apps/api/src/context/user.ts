import { createHmac, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getEnv } from "../config/env.js";

/**
 * Extracts user identification from request headers and cookies
 */
export interface UserContext {
  projectId: string;
  sessionId: string;
  userId: string;
}

/**
 * Computes HMAC hash of sessionId for user identification
 */
function computeUserId(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

/**
 * Extracts user context from request
 */
export function extractUserContext(req: Request): UserContext {
  const env = getEnv();

  // Extract projectId from header (default: "default")
  const projectId = req.headers["x-project-id"]?.toString() ?? "default";

  // Extract sessionId from cookie or header
  let sessionId: string;
  const cookieSessionId = req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("eskiz_sid="))
    ?.split("=")[1]
    ?.trim();

  const headerSessionId = req.headers["x-session-id"]?.toString();

  if (cookieSessionId) {
    sessionId = cookieSessionId;
  } else if (headerSessionId) {
    sessionId = headerSessionId;
  } else {
    // Generate new sessionId if not present
    sessionId = randomUUID();
  }

  // Extract userId from header or compute from sessionId
  let userId: string;
  const headerUserId = req.headers["x-user-id"]?.toString();
  if (headerUserId) {
    userId = headerUserId;
  } else {
    // Compute userId as HMAC of sessionId
    const hashSecret = env.LOG_HASH_SECRET;
    userId = computeUserId(sessionId, hashSecret);
  }

  return {
    projectId,
    sessionId,
    userId,
  };
}

/**
 * Sets sessionId in response header if it was generated
 */
export function setSessionIdHeader(req: Request, res: Response, userContext: UserContext): void {
  // If sessionId was generated (not from cookie/header), set it in response
  const cookieSessionId = req.headers.cookie
    ?.split(";")
    .find((c) => c.trim().startsWith("eskiz_sid="))
    ?.split("=")[1]
    ?.trim();

  const headerSessionId = req.headers["x-session-id"]?.toString();

  if (!cookieSessionId && !headerSessionId) {
    res.setHeader("x-session-id", userContext.sessionId);
  }
}
