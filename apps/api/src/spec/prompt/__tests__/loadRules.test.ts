import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadRules, resetSpecRulesDirCache } from "../loadRules.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("node:path", async () => {
  const actual = await vi.importActual("node:path");
  return {
    ...actual,
    join: (...paths: string[]) => paths.join("/"),
    resolve: (...paths: string[]) => paths.join("/"),
  };
});

describe("loadRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache and set environment variable to bypass directory search in tests
    resetSpecRulesDirCache();
    process.env.SPEC_RULES_DIR = "/mock/spec-rules";
  });

  afterEach(() => {
    process.env.SPEC_RULES_DIR = undefined;
    resetSpecRulesDirCache();
  });

  it("loads base rules and layout rules", () => {
    const mockBase = {
      name: "base",
      description: "Base rules",
      rules: ["Rule 1", "Rule 2"],
    };
    const mockLayout = {
      name: "layout",
      description: "Layout rules",
      rules: ["Layout rule 1"],
      strictRules: ["Strict rule 1"],
      balancedRules: ["Balanced rule 1"],
    };
    const mockDevices = {
      name: "devices",
      description: "Device rules",
      mobile: {
        width: "~375–400px",
        height: "800px",
        rules: ["Mobile rule 1"],
      },
      tablet: {
        width: "~768px",
        height: "900px",
        rules: ["Tablet rule 1"],
      },
      desktop: {
        width: "~1200px",
        height: "900px",
        rules: ["Desktop rule 1"],
      },
    };

    // When SPEC_RULES_DIR is set, getSpecRulesDir() doesn't call readFileSync for directory search
    // loadRuleFile calls readFileSync for each file: base.json, layout.json, devices.json
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)); // Loading devices.json

    const result = loadRules({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
    });

    expect(result.base).toEqual(mockBase);
    expect(result.layout).toEqual(mockLayout);
    expect(result.device).toEqual(mockDevices.mobile);
    expect(result.visualBaseline).toBeUndefined();
    expect(result.patterns).toEqual([]);
  });

  it("loads visual baseline when enabled", () => {
    const mockBase = { name: "base", description: "Base", rules: [] };
    const mockLayout = { name: "layout", description: "Layout", rules: [] };
    const mockDevices = {
      name: "devices",
      description: "Devices",
      mobile: { width: "400px", height: "800px", rules: [] },
      tablet: { width: "768px", height: "900px", rules: [] },
      desktop: { width: "1200px", height: "900px", rules: [] },
    };
    const mockVisualBaseline = {
      name: "visual-baseline",
      description: "Visual baseline",
      rules: ["Visual rule 1"],
    };

    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)) // Loading devices.json
      .mockReturnValueOnce(JSON.stringify(mockVisualBaseline)); // Loading visual-baseline.json

    const result = loadRules({
      userPrompt: "Create a form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: true,
    });

    expect(result.visualBaseline).toEqual(mockVisualBaseline);
  });

  it("loads pattern rules when prompt matches keywords", () => {
    const mockBase = { name: "base", description: "Base", rules: [] };
    const mockLayout = { name: "layout", description: "Layout", rules: [] };
    const mockDevices = {
      name: "devices",
      description: "Devices",
      mobile: { width: "400px", height: "800px", rules: [] },
      tablet: { width: "768px", height: "900px", rules: [] },
      desktop: { width: "1200px", height: "900px", rules: [] },
    };
    const mockAuthForm = {
      name: "auth-form",
      description: "Auth form",
      detectionKeywords: ["login", "signup", "auth"],
      rules: ["Auth rule 1"],
    };

    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)) // Loading devices.json
      .mockReturnValueOnce(JSON.stringify(mockAuthForm)); // Loading patterns/auth-form.json

    const result = loadRules({
      userPrompt: "Create a login form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
    });

    expect(result.patterns).toHaveLength(1);
    expect(result.patterns[0]).toEqual(mockAuthForm);
  });

  it("does not load pattern rules when prompt does not match", () => {
    const mockBase = { name: "base", description: "Base", rules: [] };
    const mockLayout = { name: "layout", description: "Layout", rules: [] };
    const mockDevices = {
      name: "devices",
      description: "Devices",
      mobile: { width: "400px", height: "800px", rules: [] },
      tablet: { width: "768px", height: "900px", rules: [] },
      desktop: { width: "1200px", height: "900px", rules: [] },
    };

    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)); // Loading devices.json
    // Note: patterns/auth-form.json is not loaded because prompt doesn't match

    const result = loadRules({
      userPrompt: "Create a dashboard",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
    });

    expect(result.patterns).toEqual([]);
  });

  it("handles missing pattern file gracefully", () => {
    const mockBase = { name: "base", description: "Base", rules: [] };
    const mockLayout = { name: "layout", description: "Layout", rules: [] };
    const mockDevices = {
      name: "devices",
      description: "Devices",
      mobile: { width: "400px", height: "800px", rules: [] },
      tablet: { width: "768px", height: "900px", rules: [] },
      desktop: { width: "1200px", height: "900px", rules: [] },
    };

    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)) // Loading devices.json
      .mockImplementationOnce(() => {
        // Loading patterns/auth-form.json fails
        throw new Error("File not found");
      });

    const result = loadRules({
      userPrompt: "Create a login form",
      targetLayout: "mobile",
      uiStrictness: "strict",
      visualBaseline: false,
    });

    expect(result.patterns).toEqual([]);
  });

  it("selects correct device rules for tablet", () => {
    const mockBase = { name: "base", description: "Base", rules: [] };
    const mockLayout = { name: "layout", description: "Layout", rules: [] };
    const mockDevices = {
      name: "devices",
      description: "Devices",
      mobile: { width: "400px", height: "800px", rules: ["Mobile"] },
      tablet: { width: "768px", height: "900px", rules: ["Tablet"] },
      desktop: { width: "1200px", height: "900px", rules: ["Desktop"] },
    };

    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(mockBase)) // Loading base.json
      .mockReturnValueOnce(JSON.stringify(mockLayout)) // Loading layout.json
      .mockReturnValueOnce(JSON.stringify(mockDevices)); // Loading devices.json

    const result = loadRules({
      userPrompt: "Create a form",
      targetLayout: "tablet",
      uiStrictness: "strict",
      visualBaseline: false,
    });

    expect(result.device.rules).toEqual(["Tablet"]);
  });
});
