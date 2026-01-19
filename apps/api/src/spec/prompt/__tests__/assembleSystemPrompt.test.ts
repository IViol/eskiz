import { beforeEach, describe, expect, it, vi } from "vitest";
import { assembleSystemPrompt } from "../assembleSystemPrompt.js";
import * as loadRulesModule from "../loadRules.js";

vi.mock("../loadRules.js");

describe("assembleSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles prompt with base rules and device rules", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base rules",
        rules: ["Base rule 1", "Base rule 2"],
      },
      layout: {
        name: "layout",
        description: "Layout rules",
        rules: ["Layout rule 1"],
      },
      device: {
        width: "~375–400px",
        height: "800px",
        rules: ["Mobile rule 1"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("DesignSpecs for real application UIs");
    expect(prompt).toContain("=== GLOBAL RULES ===");
    expect(prompt).toContain("- Base rule 1");
    expect(prompt).toContain("- Base rule 2");
    expect(prompt).toContain("=== DEVICE RULES (MOBILE) ===");
    expect(prompt).toContain("- Mobile rule 1");
    expect(prompt).toContain("=== UX PATTERNS ===");
    expect(prompt).toContain("- Follow standard UX practices");
  });

  it("includes visual baseline rules when enabled", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      visualBaseline: {
        name: "visual-baseline",
        description: "Visual baseline",
        rules: ["Visual rule 1", "Visual rule 2"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: true,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("=== VISUAL BASELINE RULES ===");
    expect(prompt).toContain("- Visual rule 1");
    expect(prompt).toContain("- Visual rule 2");
  });

  it("excludes visual baseline rules when disabled", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).not.toContain("=== VISUAL BASELINE RULES ===");
  });

  it("includes pattern rules when detected", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [
        {
          name: "auth-form",
          description: "Auth form",
          rules: ["Auth rule 1", "Auth rule 2"],
        },
      ],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a login form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("=== PATTERN RULES: AUTH-FORM ===");
    expect(prompt).toContain("- Auth rule 1");
    expect(prompt).toContain("- Auth rule 2");
  });

  it("uses strict layout rules when uiStrictness is strict", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Default layout rule"],
        strictRules: ["Strict layout rule"],
        balancedRules: ["Balanced layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("- Strict layout rule");
    expect(prompt).not.toContain("- Balanced layout rule");
    expect(prompt).not.toContain("- Default layout rule");
  });

  it("uses balanced layout rules when uiStrictness is balanced", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Default layout rule"],
        strictRules: ["Strict layout rule"],
        balancedRules: ["Balanced layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "balanced",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("- Balanced layout rule");
    expect(prompt).not.toContain("- Strict layout rule");
    expect(prompt).not.toContain("- Default layout rule");
  });

  it("marks layout rules as mandatory when strictLayout is true", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
        strictRules: ["Strict rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: true,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("⚠️ STRICT LAYOUT MODE: These rules are MANDATORY:");
  });

  it("includes UX pattern rules when enabled", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: true,
        formContainer: true,
        helperText: true,
      },
    });

    expect(prompt).toContain("- Group related elements in containers");
    expect(prompt).toContain("- Wrap all form elements in a dedicated form container");
    expect(prompt).toContain("- Include helper or hint text where appropriate");
  });

  it("includes output format reminder", () => {
    vi.mocked(loadRulesModule.loadRules).mockReturnValue({
      base: {
        name: "base",
        description: "Base",
        rules: ["Base rule"],
      },
      layout: {
        name: "layout",
        description: "Layout",
        rules: ["Layout rule"],
      },
      device: {
        width: "400px",
        height: "800px",
        rules: ["Device rule"],
      },
      patterns: [],
    });

    const prompt = assembleSystemPrompt({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
      strictLayout: false,
      uxPatterns: {
        groupElements: false,
        formContainer: false,
        helperText: false,
      },
    });

    expect(prompt).toContain("=== OUTPUT FORMAT ===");
    expect(prompt).toContain("Your output must be a valid DesignSpec JSON only.");
    expect(prompt).toContain("No explanations.");
    expect(prompt).toContain("No markdown.");
  });
});
