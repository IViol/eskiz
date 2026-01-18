import type { DesignSpec, GenerationContext } from "@eskiz/spec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSpec } from "../api.js";

const DEFAULT_CONTEXT: GenerationContext = {
  targetLayout: "mobile",
  uiStrictness: "strict",
  uxPatterns: {
    groupElements: true,
    formContainer: true,
    helperText: false,
  },
};

describe("generateSpec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("calls API with correct parameters", async () => {
    const mockSpec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text", content: "Test" }],
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    const result = await generateSpec("Test prompt", DEFAULT_CONTEXT);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/spec"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Test prompt",
          generationContext: DEFAULT_CONTEXT,
        }),
      }),
    );
    expect(result).toEqual(mockSpec);
  });

  it("adds dryRun query parameter when dryRun is true", async () => {
    const mockSpec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text", content: "Test" }],
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSpec,
    } as Response);

    await generateSpec("Test prompt", DEFAULT_CONTEXT, true);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("dryRun=true"),
      expect.any(Object),
    );
  });

  it("throws error when API returns error response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Invalid request",
        message: "Prompt is required",
      }),
    } as Response);

    await expect(generateSpec("", DEFAULT_CONTEXT)).rejects.toThrow("Prompt is required");
  });

  it("handles network errors", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    await expect(generateSpec("Test", DEFAULT_CONTEXT)).rejects.toThrow("Network error");
  });

  it("handles invalid JSON response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as unknown as Response);

    await expect(generateSpec("Test", DEFAULT_CONTEXT)).rejects.toThrow("HTTP 500");
  });
});
