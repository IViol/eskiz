import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTracingContext } from "../../context/tracing.js";
import * as userModule from "../../context/user.js";
import { tracingMiddleware } from "../tracing.js";

vi.mock("../../context/user.js", () => ({
  extractUserContext: vi.fn(),
  setSessionIdHeader: vi.fn(),
}));

describe("tracingMiddleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      id: "test-request-id",
      headers: {},
    };
    mockRes = {
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();

    vi.mocked(userModule.extractUserContext).mockReturnValue({
      projectId: "test-project",
      sessionId: "test-session-id",
      userId: "test-user-id",
    });
  });

  it("sets up tracing context with requestId as traceId", () => {
    let capturedContext: ReturnType<typeof getTracingContext>;
    const nextWithContextCheck = vi.fn(() => {
      capturedContext = getTracingContext();
    });

    tracingMiddleware(mockReq as Request, mockRes as Response, nextWithContextCheck);

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.traceId).toBe("test-request-id");
    expect(capturedContext?.projectId).toBe("test-project");
    expect(capturedContext?.userId).toBe("test-user-id");
    expect(nextWithContextCheck).toHaveBeenCalled();
  });

  it("generates new traceId if requestId is not present", () => {
    mockReq.id = undefined;
    let capturedContext: ReturnType<typeof getTracingContext>;
    const nextWithContextCheck = vi.fn(() => {
      capturedContext = getTracingContext();
    });

    tracingMiddleware(mockReq as Request, mockRes as Response, nextWithContextCheck);

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.traceId).toBeDefined();
    expect(typeof capturedContext?.traceId).toBe("string");
    expect(capturedContext?.traceId.length).toBeGreaterThan(0);
  });

  it("sets traceId and requestId on request object", () => {
    tracingMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as Request & { traceId?: string }).traceId).toBeDefined();
    expect((mockReq as Request & { requestId?: string }).requestId).toBeDefined();
  });
});
