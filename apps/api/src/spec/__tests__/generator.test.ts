import type { DesignSpec } from "@eskiz/spec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTracingContext, runWithTracingContext } from "../../context/tracing.js";
import { generateDesignSpec } from "../generator.js";

vi.mock("../../context/tracing.js", async () => {
  const actual = await vi.importActual<typeof import("../../context/tracing.js")>(
    "../../context/tracing.js",
  );
  return {
    ...actual,
  };
});

vi.mock("openai", () => {
  const createFn = vi.fn();
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: createFn,
        },
      };
    },
    __getCreateFn: () => createFn,
  };
});

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

vi.mock("../../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../utils/logger.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils/logger.js")>(
    "../../utils/logger.js",
  );
  return {
    ...actual,
  };
});

vi.mock("../../utils/openaiRetry.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils/openaiRetry.js")>(
    "../../utils/openaiRetry.js",
  );
  return {
    ...actual,
  };
});

vi.mock("../../utils/budgetAlerts.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils/budgetAlerts.js")>(
    "../../utils/budgetAlerts.js",
  );
  return {
    ...actual,
  };
});

describe("generateDesignSpec", () => {
  let mockChatCompletionsCreate: ReturnType<typeof vi.fn>;
  let tracingContext: ReturnType<typeof createTracingContext>;

  beforeEach(async () => {
    vi.clearAllMocks();
    tracingContext = createTracingContext();
    const openaiModule = await import("openai");
    const createFnGetter = (
      openaiModule as unknown as { __getCreateFn: () => ReturnType<typeof vi.fn> }
    ).__getCreateFn;
    mockChatCompletionsCreate = createFnGetter();
  });

  it("returns mock spec when dryRun is true", async () => {
    const result = await runWithTracingContext(tracingContext, async () => {
      return generateDesignSpec({ prompt: "Test" }, true);
    });

    // applyVisualDefaults adds visual properties, so we need to expect them
    expect(result).toMatchObject({
      page: "Mock Page",
      frame: {
        name: "Mock Frame",
        width: 400,
        height: 800, // Added by applyVisualDefaults
        layout: "vertical",
        gap: 16,
        padding: 24,
        background: "#FFFFFF", // Added by applyVisualDefaults
        borderRadius: 12, // Added by applyVisualDefaults
      },
      nodes: [
        {
          type: "text",
          content: "Mock content",
          fontSize: 16,
          color: "#111111", // Added by applyVisualDefaults
        },
        {
          type: "container",
          layout: "vertical",
          gap: 12,
          padding: 16,
          background: "#FFFFFF", // Added by applyVisualDefaults
          borderRadius: 12, // Added by applyVisualDefaults
          children: [
            {
              type: "text",
              content: "Nested text",
              fontSize: 14,
              color: "#111111", // Added by applyVisualDefaults
            },
          ],
        },
        {
          type: "button",
          label: "Mock Button",
          background: "#2563EB", // Added by applyVisualDefaults
          textColor: "#FFFFFF", // Added by applyVisualDefaults
          borderRadius: 8, // Added by applyVisualDefaults
        },
      ],
    });
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("returns valid DesignSpec from OpenAI response", async () => {
    const validSpec: DesignSpec = {
      page: "Home",
      frame: {
        name: "Main Content",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        { type: "text", content: "Welcome" },
        { type: "button", label: "Get Started" },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(validSpec),
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });

    const result = await runWithTracingContext(tracingContext, async () => {
      return generateDesignSpec({ prompt: "Create a welcome page" }, false);
    });

    // applyVisualDefaults adds visual properties, so we need to check that the spec structure matches
    // but allow for added visual defaults
    expect(result.page).toBe(validSpec.page);
    expect(result.frame.name).toBe(validSpec.frame.name);
    expect(result.frame.width).toBe(validSpec.frame.width);
    expect(result.frame.layout).toBe(validSpec.frame.layout);
    expect(result.frame.gap).toBe(validSpec.frame.gap);
    expect(result.frame.padding).toBe(validSpec.frame.padding);
    // Visual defaults may be added
    expect(result.nodes).toHaveLength(validSpec.nodes.length);
    // Verify OpenAI was called (through makeOpenAIRequestWithRetry)
    expect(mockChatCompletionsCreate).toHaveBeenCalled();
    const callArgs = mockChatCompletionsCreate.mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: expect.stringContaining("DesignSpecs for real application UIs"),
        },
        { role: "assistant", content: expect.stringContaining("DesignSpec JSON structure") },
        { role: "user", content: "Create a welcome page" },
      ],
      response_format: { type: "json_object" },
    } as unknown);
    expect(callArgs).not.toHaveProperty("temperature");
  });

  it("throws error when OpenAI returns empty content", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: {} }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 0,
        total_tokens: 100,
      },
    });

    await expect(
      runWithTracingContext(tracingContext, async () => {
        return generateDesignSpec({ prompt: "Test prompt" }, false);
      }),
    ).rejects.toThrow("Empty response from OpenAI");
  });

  it("throws error when OpenAI returns invalid JSON", async () => {
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: "not valid json {",
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 10,
        total_tokens: 110,
      },
    });

    await expect(
      runWithTracingContext(tracingContext, async () => {
        return generateDesignSpec({ prompt: "Test prompt" }, false);
      }),
    ).rejects.toThrow("Invalid JSON response from OpenAI");
  });

  it("throws error when OpenAI response does not match schema", async () => {
    const invalidSpec = {
      page: "Test",
      frame: {
        name: "Test",
        width: -100,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [],
    };

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(invalidSpec),
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });

    await expect(
      runWithTracingContext(tracingContext, async () => {
        return generateDesignSpec({ prompt: "Test prompt" }, false);
      }),
    ).rejects.toThrow("Invalid DesignSpec");
  });

  it("throws error when OpenAI API call fails", async () => {
    mockChatCompletionsCreate.mockRejectedValue(new Error("API rate limit exceeded"));

    await expect(
      runWithTracingContext(tracingContext, async () => {
        return generateDesignSpec({ prompt: "Test prompt" }, false);
      }),
    ).rejects.toThrow();
  });
});
