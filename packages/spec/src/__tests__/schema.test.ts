import { describe, expect, it } from "vitest";
import { designSpecSchema, promptRequestSchema } from "../schema.js";

describe("promptRequestSchema", () => {
  it("should validate a valid prompt request", () => {
    const valid = { prompt: "Create a login form" };
    const result = promptRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it("should reject empty prompt", () => {
    const invalid = { prompt: "" };
    const result = promptRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject missing prompt", () => {
    const invalid = {};
    const result = promptRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should validate prompt request with full generationContext", () => {
    const valid = {
      prompt: "Create a login form",
      generationContext: {
        targetLayout: "mobile" as const,
        uiStrictness: "strict" as const,
        uxPatterns: {
          groupElements: true,
          formContainer: true,
          helperText: false,
        },
        visualBaseline: true,
        strictLayout: false,
      },
    };
    const result = promptRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generationContext?.visualBaseline).toBe(true);
      expect(result.data.generationContext?.strictLayout).toBe(false);
    }
  });

  it("should validate prompt request with optional visualBaseline and strictLayout", () => {
    const valid = {
      prompt: "Create a form",
      generationContext: {
        targetLayout: "tablet" as const,
        uiStrictness: "balanced" as const,
        uxPatterns: {
          groupElements: false,
          formContainer: false,
          helperText: true,
        },
        visualBaseline: false,
        strictLayout: true,
      },
    };
    const result = promptRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generationContext?.visualBaseline).toBe(false);
      expect(result.data.generationContext?.strictLayout).toBe(true);
    }
  });

  it("should accept prompt request without visualBaseline and strictLayout", () => {
    const valid = {
      prompt: "Create a form",
      generationContext: {
        targetLayout: "desktop" as const,
        uiStrictness: "strict" as const,
        uxPatterns: {
          groupElements: true,
          formContainer: true,
          helperText: false,
        },
      },
    };
    const result = promptRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generationContext?.visualBaseline).toBeUndefined();
      expect(result.data.generationContext?.strictLayout).toBeUndefined();
    }
  });

  it("should reject invalid visualBaseline type", () => {
    const invalid = {
      prompt: "Create a form",
      generationContext: {
        targetLayout: "mobile" as const,
        uiStrictness: "strict" as const,
        uxPatterns: {
          groupElements: true,
          formContainer: true,
          helperText: false,
        },
        visualBaseline: "yes", // should be boolean
      },
    };
    const result = promptRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid strictLayout type", () => {
    const invalid = {
      prompt: "Create a form",
      generationContext: {
        targetLayout: "mobile" as const,
        uiStrictness: "strict" as const,
        uxPatterns: {
          groupElements: true,
          formContainer: true,
          helperText: false,
        },
        strictLayout: 1, // should be boolean
      },
    };
    const result = promptRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("designSpecSchema", () => {
  it("should validate a valid DesignSpec with text and button nodes", () => {
    const valid = {
      page: "Home",
      frame: {
        name: "Main Content",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [
        { type: "text" as const, content: "Welcome" },
        { type: "button" as const, label: "Get Started" },
      ],
    };
    const result = designSpecSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it("should validate a DesignSpec with horizontal layout", () => {
    const valid = {
      page: "Dashboard",
      frame: {
        name: "Toolbar",
        width: 600,
        layout: "horizontal" as const,
        gap: 8,
        padding: 16,
      },
      nodes: [{ type: "button" as const, label: "Save" }],
    };
    const result = designSpecSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject empty nodes array", () => {
    const invalid = {
      page: "Home",
      frame: {
        name: "Main",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [],
    };
    const result = designSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid frame width", () => {
    const invalid = {
      page: "Home",
      frame: {
        name: "Main",
        width: -100,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };
    const result = designSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid layout", () => {
    const invalid = {
      page: "Home",
      frame: {
        name: "Main",
        width: 400,
        layout: "diagonal",
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };
    const result = designSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject negative gap", () => {
    const invalid = {
      page: "Home",
      frame: {
        name: "Main",
        width: 400,
        layout: "vertical" as const,
        gap: -10,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };
    const result = designSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject button node without label", () => {
    const invalid = {
      page: "Home",
      frame: {
        name: "Main",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "button" as const }],
    };
    const result = designSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
