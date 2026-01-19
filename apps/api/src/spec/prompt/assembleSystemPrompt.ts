import type { PromptAssemblyOptions } from "./types.js";
import { loadRules } from "./loadRules.js";

/**
 * Assembles the final system prompt from loaded rules and options
 */
export function assembleSystemPrompt(options: PromptAssemblyOptions): string {
  const loadedRules = loadRules({
    userPrompt: options.userPrompt,
    targetLayout: options.targetLayout,
    uiStrictness: options.uiStrictness,
    visualBaseline: options.visualBaseline,
  });

  const sections: string[] = [];

  // Header
  sections.push(
    "You are generating DesignSpecs for real application UIs, not raw layout primitives.",
    "",
    "Your goal is to produce layouts that resemble production-ready application screens at a wireframe+ level.",
    "",
    "Generated designs must look like real apps, not like ungrouped containers with text.",
    "",
    "ALWAYS apply the following rules:",
    "",
  );

  // Global rules (from base.json)
  sections.push("=== GLOBAL RULES ===");
  sections.push(...loadedRules.base.rules.map((rule) => `- ${rule}`));
  sections.push("");

  // Layout intent rules
  sections.push("=== LAYOUT INTENT RULES ===");
  const layoutRulesToUse =
    options.uiStrictness === "strict" && loadedRules.layout.strictRules
      ? loadedRules.layout.strictRules
      : options.uiStrictness === "balanced" && loadedRules.layout.balancedRules
        ? loadedRules.layout.balancedRules
        : loadedRules.layout.rules;

  if (options.strictLayout) {
    sections.push("⚠️ STRICT LAYOUT MODE: These rules are MANDATORY:");
  }
  sections.push(...layoutRulesToUse.map((rule) => `- ${rule}`));
  sections.push("");

  // Device-specific rules
  sections.push(`=== DEVICE RULES (${options.targetLayout.toUpperCase()}) ===`);
  sections.push(...loadedRules.device.rules.map((rule) => `- ${rule}`));
  sections.push("");

  // Visual baseline rules (if enabled)
  if (loadedRules.visualBaseline) {
    sections.push("=== VISUAL BASELINE RULES ===");
    sections.push(...loadedRules.visualBaseline.rules.map((rule) => `- ${rule}`));
    sections.push("");
  }

  // Pattern-specific rules
  if (loadedRules.patterns.length > 0) {
    for (const pattern of loadedRules.patterns) {
      sections.push(`=== PATTERN RULES: ${pattern.name.toUpperCase()} ===`);
      sections.push(...pattern.rules.map((rule) => `- ${rule}`));
      sections.push("");
    }
  }

  // UX Patterns from options
  sections.push("=== UX PATTERNS ===");
  const uxPatternRules: string[] = [];
  if (options.uxPatterns.groupElements) {
    uxPatternRules.push("- Group related elements in containers");
    uxPatternRules.push("- Use logical grouping (e.g. form fields together)");
  }
  if (options.uxPatterns.formContainer) {
    uxPatternRules.push("- Wrap all form elements in a dedicated form container");
    uxPatternRules.push("- Form containers must have clear padding and spacing");
    uxPatternRules.push("- Form card container (the main form wrapper) should have visual styling (background, borderRadius)");
    uxPatternRules.push("- Inner layout containers (field groups, actions containers) should NOT have visual styling");
  }
  if (options.uxPatterns.helperText) {
    uxPatternRules.push("- Include helper or hint text where appropriate");
    uxPatternRules.push("- Helper text should be smaller and placed near relevant elements");
  }
  if (uxPatternRules.length > 0) {
    sections.push(...uxPatternRules);
  } else {
    sections.push("- Follow standard UX practices");
  }
  sections.push("");

  // Output format reminder
  sections.push("=== OUTPUT FORMAT ===");
  sections.push("Your output must be a valid DesignSpec JSON only.");
  sections.push("No explanations.");
  sections.push("No markdown.");

  return sections.join("\n");
}
