import type { DesignSpec } from "@eskiz/spec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDesignSpec } from "../generator.js";

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
  }),
}));

vi.mock("../../logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("generateDesignSpec", () => {
  let mockChatCompletionsCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const openaiModule = await import("openai");
    const createFnGetter = (
      openaiModule as unknown as { __getCreateFn: () => ReturnType<typeof vi.fn> }
    ).__getCreateFn;
    mockChatCompletionsCreate = createFnGetter();
  });

  it("returns mock spec when dryRun is true", async () => {
    const result = await generateDesignSpec({ prompt: "Test" }, true);

    expect(result).toEqual({
      page: "Mock Page",
      frame: {
        name: "Mock Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        { type: "text", content: "Mock content", fontSize: 16 },
        {
          type: "container",
          layout: "vertical",
          gap: 12,
          padding: 16,
          children: [{ type: "text", content: "Nested text", fontSize: 14 }],
        },
        { type: "button", label: "Mock Button" },
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
    });

    const result = await generateDesignSpec({ prompt: "Create a welcome page" }, false);

    expect(result).toEqual(validSpec);
    // gpt-5-nano doesn't support temperature parameter
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
    });

    await expect(generateDesignSpec({ prompt: "Test prompt" }, false)).rejects.toThrow(
      "Empty response from OpenAI",
    );
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
    });

    await expect(generateDesignSpec({ prompt: "Test prompt" }, false)).rejects.toThrow(
      "Invalid JSON response from OpenAI",
    );
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
    });

    await expect(generateDesignSpec({ prompt: "Test prompt" }, false)).rejects.toThrow(
      "Invalid DesignSpec",
    );
  });

  it("throws error when OpenAI API call fails", async () => {
    mockChatCompletionsCreate.mockRejectedValue(new Error("API rate limit exceeded"));

    await expect(generateDesignSpec({ prompt: "Test prompt" }, false)).rejects.toThrow(
      "API rate limit exceeded",
    );
  });
});
