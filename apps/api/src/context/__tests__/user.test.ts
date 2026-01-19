import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { extractUserContext } from "../user.js";
import { getEnv } from "../../config/env.js";

vi.mock("../../config/env.js", () => ({
  getEnv: vi.fn(),
}));

describe("extractUserContext", () => {
  let mockReq: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      headers: {},
    };

    vi.mocked(getEnv).mockReturnValue({
      LOG_HASH_SECRET: "test-secret",
    } as ReturnType<typeof getEnv>);
  });

  it("extracts projectId from x-project-id header", () => {
    mockReq.headers = {
      "x-project-id": "my-project",
    };

    const context = extractUserContext(mockReq as Request);
    expect(context.projectId).toBe("my-project");
  });

  it("defaults projectId to 'default' if header is missing", () => {
    const context = extractUserContext(mockReq as Request);
    expect(context.projectId).toBe("default");
  });

  it("extracts sessionId from eskiz_sid cookie", () => {
    mockReq.headers = {
      cookie: "eskiz_sid=test-session-123; other=value",
    };

    const context = extractUserContext(mockReq as Request);
    expect(context.sessionId).toBe("test-session-123");
  });

  it("extracts sessionId from x-session-id header if cookie is missing", () => {
    mockReq.headers = {
      "x-session-id": "header-session-456",
    };

    const context = extractUserContext(mockReq as Request);
    expect(context.sessionId).toBe("header-session-456");
  });

  it("generates new sessionId if neither cookie nor header present", () => {
    const context = extractUserContext(mockReq as Request);
    expect(context.sessionId).toBeDefined();
    expect(typeof context.sessionId).toBe("string");
    expect(context.sessionId.length).toBeGreaterThan(0);
  });

  it("uses x-user-id header if present", () => {
    mockReq.headers = {
      "x-user-id": "custom-user-id",
    };

    const context = extractUserContext(mockReq as Request);
    expect(context.userId).toBe("custom-user-id");
  });

  it("computes userId from sessionId using HMAC if x-user-id is missing", () => {
    mockReq.headers = {
      cookie: "eskiz_sid=test-session",
    };

    const context = extractUserContext(mockReq as Request);
    expect(context.userId).toBeDefined();
    expect(context.userId).not.toBe("test-session"); // Should be hashed
    expect(typeof context.userId).toBe("string");
    expect(context.userId.length).toBe(64); // SHA-256 hex is 64 chars
  });

  it("produces consistent userId for same sessionId", () => {
    mockReq.headers = {
      cookie: "eskiz_sid=test-session",
    };

    const context1 = extractUserContext(mockReq as Request);
    const context2 = extractUserContext(mockReq as Request);

    expect(context1.userId).toBe(context2.userId);
  });
});
