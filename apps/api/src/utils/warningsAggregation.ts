import type { VisualUsageWarning } from "../spec/validation/validateVisualUsage.js";

export interface AggregatedWarnings {
  warnings_count: number;
  warnings_types: string[];
  warnings_paths_sample: string[];
}

/**
 * Aggregates warnings into summary metrics
 */
export function aggregateWarnings(
  warnings: VisualUsageWarning[],
  pathsSampleSize = 3,
): AggregatedWarnings {
  const warningsCount = warnings.length;

  // Extract unique warning types
  const typeSet = new Set<string>();
  for (const warning of warnings) {
    // Use reason as type identifier (normalized)
    const type = warning.reason.includes("layout-only")
      ? "visual_styling_on_layout_container"
      : "unknown_warning";
    typeSet.add(type);
  }

  const warningsTypes = Array.from(typeSet);

  // Sample paths (first N)
  const warningsPathsSample = warnings.slice(0, pathsSampleSize).map((warning) => warning.path);

  return {
    warnings_count: warningsCount,
    warnings_types: warningsTypes,
    warnings_paths_sample: warningsPathsSample,
  };
}
