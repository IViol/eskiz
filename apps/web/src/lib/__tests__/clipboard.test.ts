import type { DesignSpec } from "@eskiz/spec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copySpecToClipboard } from "../clipboard.js";

describe("copySpecToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("copies formatted JSON to clipboard", async () => {
    const spec: DesignSpec = {
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

    await copySpecToClipboard(spec);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(spec, null, 2));
  });

  it("handles clipboard errors", async () => {
    const spec: DesignSpec = {
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

    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("Clipboard permission denied"),
    );

    await expect(copySpecToClipboard(spec)).rejects.toThrow("Clipboard permission denied");
  });
});
