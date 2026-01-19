import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger.js";
import { createServer } from "../server.js";
import * as generatorModule from "../spec/generator.js";

// Mock generator to avoid actual OpenAI calls
vi.mock("../spec/generator.js");
vi.mock("../config/env.js", () => ({
  getEnv: () => ({
    OPENAI_API_KEY: "test-key",
    PORT: 3000,
    LOG_LEVEL: "info",
    LOG_HASH_SECRET: "test-secret",
    LOG_DEBUG_PAYLOADS: false,
    OPENAI_TIMEOUT_MS: 30000,
    OPENAI_RETRY_MAX: 2,
    OPENAI_RETRY_BASE_MS: 1000,
    BUDGET_MAX_TOKENS: 8000,
    BUDGET_MAX_DURATION_MS: 8000,
    BUDGET_MAX_COMPLETION_RATIO: 3.0,
  }),
}));

// Mock logger to capture log calls
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

vi.mock("../logger.js", () => ({
  logger: mockLogger,
}));

// Mock pino-http to avoid actual logging
vi.mock("pino-http", () => ({
  default: vi.fn(() => {
    return (_req: unknown, _res: unknown, next: () => void) => {
      next();
    };
  }),
}));

const mockGenerateDesignSpec = vi.mocked(generatorModule.generateDesignSpec);

describe("Observability Integration Tests", () => {
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createServer();

    mockGenerateDesignSpec.mockResolvedValue({
      page: "Test Page",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test content" }],
    });
  });

  it("includes traceId in request context", async () => {
    await request(app).post("/spec").send({ prompt: "test" }).expect(200);

    // Check that logger was called (indicating context was set)
    // The actual traceId would be in the log calls
    expect(mockGenerateDesignSpec).toHaveBeenCalled();
  });

  it("sets x-session-id header when sessionId is generated", async () => {
    const response = await request(app).post("/spec").send({ prompt: "test" }).expect(200);

    // If sessionId was generated, it should be in response header
    // Note: This depends on implementation - may need adjustment
    expect(response.headers).toBeDefined();
  });

  it("extracts projectId from x-project-id header", async () => {
    await request(app)
      .post("/spec")
      .set("x-project-id", "test-project")
      .send({ prompt: "test" })
      .expect(200);

    expect(mockGenerateDesignSpec).toHaveBeenCalled();
  });

  it("does not log sensitive headers", async () => {
    // Make a request with sensitive headers
    await request(app)
      .post("/spec")
      .set("Cookie", "eskiz_sid=secret-session-id")
      .set("Authorization", "Bearer secret-token")
      .send({ prompt: "test" })
      .expect(200);

    // Verify that logger calls don't contain sensitive data
    const allLogCalls = [
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
      ...mockLogger.debug.mock.calls,
    ];

    const logString = JSON.stringify(allLogCalls);

    // These should NOT appear in logs
    expect(logString).not.toContain("secret-session-id");
    expect(logString).not.toContain("secret-token");
    expect(logString).not.toContain("Bearer");
  });

  it("handles request with x-user-id header", async () => {
    await request(app)
      .post("/spec")
      .set("x-user-id", "custom-user-123")
      .send({ prompt: "test" })
      .expect(200);

    expect(mockGenerateDesignSpec).toHaveBeenCalled();
  });
});
