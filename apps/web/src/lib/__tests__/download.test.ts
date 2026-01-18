import type { DesignSpec } from "@eskiz/spec";
import { type SpyInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadSpec } from "../download.js";

describe("downloadSpec", () => {
  let createElementSpy: SpyInstance;
  let appendChildSpy: SpyInstance;
  let removeChildSpy: SpyInstance;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement;

    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    global.URL.revokeObjectURL = vi.fn();

    createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
    appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => mockAnchor as Node);
    removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => mockAnchor as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and triggers download", () => {
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

    downloadSpec(spec);

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it("uses custom filename when provided", () => {
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

    downloadSpec(spec, "custom-spec.json");

    const anchor = createElementSpy.mock.results[0].value as HTMLAnchorElement;
    expect(anchor.download).toBe("custom-spec.json");
  });

  it("creates blob with correct JSON content", () => {
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

    const originalBlob = global.Blob;
    const blobCalls: Array<{ parts: unknown[]; options: BlobPropertyBag }> = [];
    global.Blob = class extends originalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        super(parts, options);
        blobCalls.push({ parts: parts || [], options: options || {} });
      }
    } as typeof Blob;

    downloadSpec(spec);

    expect(blobCalls).toHaveLength(1);
    expect(blobCalls[0].parts).toEqual([JSON.stringify(spec, null, 2)]);
    expect(blobCalls[0].options).toEqual({ type: "application/json" });

    global.Blob = originalBlob;
  });
});
