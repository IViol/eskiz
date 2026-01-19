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
    tracingMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const context = getTracingContext();
    expect(context).toBeDefined();
    expect(context?.traceId).toBe("test-request-id");
    expect(context?.projectId).toBe("test-project");
    expect(context?.userId).toBe("test-user-id");
    expect(mockNext).toHaveBeenCalled();
  });

  it("generates new traceId if requestId is not present", () => {
    mockReq.id = undefined;
    tracingMiddleware(mockReq as Request, mockRes as Response, mockNext);

    const context = getTracingContext();
    expect(context).toBeDefined();
    expect(context?.traceId).toBeDefined();
    expect(typeof context?.traceId).toBe("string");
    expect(context?.traceId.length).toBeGreaterThan(0);
  });

  it("sets traceId and requestId on request object", () => {
    tracingMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as Request & { traceId?: string }).traceId).toBeDefined();
    expect((mockReq as Request & { requestId?: string }).requestId).toBeDefined();
  });
});
