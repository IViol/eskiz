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
});
