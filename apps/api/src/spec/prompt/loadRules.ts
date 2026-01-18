import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BaseRule,
  DeviceRule,
  DevicesRule,
  LayoutRule,
  LoadedRules,
  PatternRule,
} from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * Determines the path to the spec-rules directory.
 * 
 * Strategy:
 * 1. Try to find spec-rules by going up from current location
 * 2. In Docker: /app/apps/api/dist/spec/prompt/ -> /app/spec-rules
 * 3. In dev: apps/api/src/spec/prompt/ -> spec-rules/
 * 
 * We search upward until we find a directory containing spec-rules/base.json
 * 
 * This is computed lazily to work with test mocks.
 */
let cachedSpecRulesDir: string | null = null;

/**
 * Resets the cached spec-rules directory (useful for testing)
 */
export function resetSpecRulesDirCache(): void {
  cachedSpecRulesDir = null;
}

function getSpecRulesDir(): string {
  if (cachedSpecRulesDir !== null) {
    return cachedSpecRulesDir;
  }
  
  // Allow override via environment variable (useful for testing)
  if (process.env.SPEC_RULES_DIR) {
    cachedSpecRulesDir = process.env.SPEC_RULES_DIR;
    return cachedSpecRulesDir;
  }
  
  let currentDir = __dirname;
  const maxDepth = 10;
  
  for (let depth = 0; depth < maxDepth; depth++) {
    const specRulesPath = join(currentDir, "spec-rules");
    const baseJsonPath = join(specRulesPath, "base.json");
    
    try {
      // Check if spec-rules/base.json exists
      readFileSync(baseJsonPath, "utf-8");
      cachedSpecRulesDir = specRulesPath;
      return cachedSpecRulesDir;
    } catch {
      // Not found, go up one level
      const parentDir = resolve(currentDir, "..");
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
    }
  }
  
  // Fallback: use relative path from compiled location
  // This should work if spec-rules is copied to the right place
  cachedSpecRulesDir = resolve(__dirname, "../../../../spec-rules");
  return cachedSpecRulesDir;
}

/**
 * Loads a JSON rule file from the spec-rules directory
 */
function loadRuleFile<T>(filename: string): T {
  const specRulesDir = getSpecRulesDir();
  const filePath = join(specRulesDir, filename);
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Detects if a prompt matches a pattern based on keywords
 */
function matchesPattern(prompt: string, pattern: PatternRule): boolean {
  if (!pattern.detectionKeywords || pattern.detectionKeywords.length === 0) {
    return false;
  }
  const lowerPrompt = prompt.toLowerCase();
  return pattern.detectionKeywords.some((keyword) => lowerPrompt.includes(keyword.toLowerCase()));
}

/**
 * Loads all applicable rules based on options
 */
export function loadRules(options: {
  userPrompt: string;
  targetLayout: "mobile" | "tablet" | "desktop";
  uiStrictness: "strict" | "balanced";
  visualBaseline: boolean;
}): LoadedRules {
  // Always load base rules
  const base = loadRuleFile<BaseRule>("base.json");

  // Load layout rules
  const layout = loadRuleFile<LayoutRule>("layout.json");

  // Load device rules and select the appropriate device
  const devices = loadRuleFile<DevicesRule>("devices.json");
  const device: DeviceRule = devices[options.targetLayout];

  // Load visual baseline if enabled
  let visualBaseline: BaseRule | undefined;
  if (options.visualBaseline) {
    visualBaseline = loadRuleFile<BaseRule>("visual-baseline.json");
  }

  // Load pattern rules and detect which ones apply
  const patterns: PatternRule[] = [];
  try {
    const authFormPattern = loadRuleFile<PatternRule>("patterns/auth-form.json");
    if (matchesPattern(options.userPrompt, authFormPattern)) {
      patterns.push(authFormPattern);
    }
  } catch (error) {
    // Pattern file doesn't exist or can't be loaded - continue without it
    // This allows the system to work even if patterns are missing
  }

  return {
    base,
    layout,
    visualBaseline,
    device,
    patterns,
  };
}
