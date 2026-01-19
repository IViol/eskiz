import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server.js";
import * as generatorModule from "../../spec/generator.js";

vi.mock("../../spec/generator.js");
vi.mock("../../config/env.js", () => ({
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
vi.mock("../../logger.js", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  return {
    logger: mockLogger,
  };
});
vi.mock("pino-http", () => ({
  default: vi.fn(() => {
    return (_req: unknown, _res: unknown, next: () => void) => {
      next();
    };
  }),
}));

vi.mock("../../context/tracing.js", async () => {
  const actual = await vi.importActual<typeof import("../../context/tracing.js")>(
    "../../context/tracing.js",
  );
  return {
    ...actual,
  };
});

vi.mock("../../middleware/tracing.js", async () => {
  const tracing = await import("../../context/tracing.js");
  return {
    tracingMiddleware: (_req: unknown, _res: unknown, next: () => void) => {
      // Set up a test tracing context
      const context = tracing.createTracingContext(
        undefined,
        "test-project",
        "test-user-id",
        "test-session-id",
      );
      tracing.runWithTracingContext(context, () => {
        next();
      });
    },
  };
});

vi.mock("../../context/user.js", () => ({
  extractUserContext: vi.fn(() => ({
    projectId: "test-project",
    sessionId: "test-session-id",
    userId: "test-user-id",
  })),
  setSessionIdHeader: vi.fn(),
}));

vi.mock("../../utils/logger.js", () => ({
  getContextLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

const mockGenerateDesignSpec = vi.mocked(generatorModule.generateDesignSpec);

describe("POST /spec", () => {
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createServer();
  });

  it("returns 200 with valid DesignSpec for valid prompt", async () => {
    const mockSpec = {
      page: "Test Page",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test content" }],
    };

    mockGenerateDesignSpec.mockResolvedValue(mockSpec);

    const response = await request(app)
      .post("/spec")
      .send({ prompt: "Create a login form" })
      .expect(200);

    expect(response.body).toEqual(mockSpec);
    expect(mockGenerateDesignSpec).toHaveBeenCalledWith({ prompt: "Create a login form" }, false);
  });

  it("returns 400 for missing prompt", async () => {
    const response = await request(app).post("/spec").send({}).expect(400);

    expect(response.body).toHaveProperty("error", "Invalid request");
    expect(response.body).toHaveProperty("details");
    expect(mockGenerateDesignSpec).not.toHaveBeenCalled();
  });

  it("returns 400 for empty prompt", async () => {
    const response = await request(app).post("/spec").send({ prompt: "" }).expect(400);

    expect(response.body).toHaveProperty("error", "Invalid request");
    expect(response.body).toHaveProperty("details");
    expect(mockGenerateDesignSpec).not.toHaveBeenCalled();
  });

  it("supports ?dryRun=true", async () => {
    const mockSpec = {
      page: "Mock Page",
      frame: {
        name: "Mock Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Mock content" }],
    };

    mockGenerateDesignSpec.mockResolvedValue(mockSpec);

    const response = await request(app)
      .post("/spec?dryRun=true")
      .send({ prompt: "Test prompt" })
      .expect(200);

    expect(response.body).toEqual(mockSpec);
    expect(mockGenerateDesignSpec).toHaveBeenCalledWith({ prompt: "Test prompt" }, true);
  });

  it("returns 500 when generator throws error", async () => {
    mockGenerateDesignSpec.mockRejectedValue(new Error("OpenAI API error"));

    const response = await request(app).post("/spec").send({ prompt: "Test prompt" }).expect(500);

    expect(response.body).toHaveProperty("error", "Internal server error");
    expect(response.body).toHaveProperty("message", "OpenAI API error");
  });

  it("handles non-Error exceptions", async () => {
    mockGenerateDesignSpec.mockRejectedValue("String error");

    const response = await request(app).post("/spec").send({ prompt: "Test prompt" }).expect(500);

    expect(response.body).toHaveProperty("error", "Internal server error");
    expect(response.body).toHaveProperty("message", "Unknown error");
  });

  it("accepts generationContext with visualBaseline and strictLayout", async () => {
    const mockSpec = {
      page: "Test Page",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test content" }],
    };

    mockGenerateDesignSpec.mockResolvedValue(mockSpec);

    const response = await request(app)
      .post("/spec")
      .send({
        prompt: "Create a form",
        generationContext: {
          targetLayout: "mobile",
          uiStrictness: "strict",
          uxPatterns: {
            groupElements: true,
            formContainer: true,
            helperText: false,
          },
          visualBaseline: true,
          strictLayout: false,
        },
      })
      .expect(200);

    expect(response.body).toEqual(mockSpec);
    expect(mockGenerateDesignSpec).toHaveBeenCalledWith(
      {
        prompt: "Create a form",
        generationContext: {
          targetLayout: "mobile",
          uiStrictness: "strict",
          uxPatterns: {
            groupElements: true,
            formContainer: true,
            helperText: false,
          },
          visualBaseline: true,
          strictLayout: false,
        },
      },
      false,
    );
  });

  it("rejects invalid visualBaseline type", async () => {
    const response = await request(app)
      .post("/spec")
      .send({
        prompt: "Create a form",
        generationContext: {
          targetLayout: "mobile",
          uiStrictness: "strict",
          uxPatterns: {
            groupElements: true,
            formContainer: true,
            helperText: false,
          },
          visualBaseline: "yes", // invalid: should be boolean
        },
      })
      .expect(400);

    expect(response.body).toHaveProperty("error", "Invalid request");
    expect(mockGenerateDesignSpec).not.toHaveBeenCalled();
  });

  it("rejects invalid strictLayout type", async () => {
    const response = await request(app)
      .post("/spec")
      .send({
        prompt: "Create a form",
        generationContext: {
          targetLayout: "mobile",
          uiStrictness: "strict",
          uxPatterns: {
            groupElements: true,
            formContainer: true,
            helperText: false,
          },
          strictLayout: 1, // invalid: should be boolean
        },
      })
      .expect(400);

    expect(response.body).toHaveProperty("error", "Invalid request");
    expect(mockGenerateDesignSpec).not.toHaveBeenCalled();
  });
});
