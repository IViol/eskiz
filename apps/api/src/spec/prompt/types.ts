/**
 * Types for rule-based prompt assembly
 */

export interface BaseRule {
  name: string;
  description: string;
  rules: string[];
}

export interface LayoutRule extends BaseRule {
  strictRules?: string[];
  balancedRules?: string[];
}

export interface DeviceRule {
  width: string;
  height: string;
  rules: string[];
}

export interface DevicesRule {
  name: string;
  description: string;
  mobile: DeviceRule;
  tablet: DeviceRule;
  desktop: DeviceRule;
}

export interface PatternRule extends BaseRule {
  detectionKeywords?: string[];
}

export interface LoadedRules {
  base: BaseRule;
  layout: LayoutRule;
  visualBaseline?: BaseRule;
  device: DeviceRule;
  patterns: PatternRule[];
}

export interface PromptAssemblyOptions {
  userPrompt: string;
  targetLayout: "mobile" | "tablet" | "desktop";
  uiStrictness: "strict" | "balanced";
  visualBaseline: boolean;
  strictLayout: boolean;
  uxPatterns: {
    groupElements: boolean;
    formContainer: boolean;
    helperText: boolean;
  };
}
