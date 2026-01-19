import { getEnv } from "../config/env.js";
import { getTracingContext } from "../context/tracing.js";
import { logger } from "../logger.js";

const env = getEnv();

export interface BudgetMetrics {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number;
  model: string;
  prompt_hash?: string;
  spec_hash?: string;
}

/**
 * Checks budget limits and logs alerts if exceeded
 */
export function checkBudgetAlerts(metrics: BudgetMetrics): void {
  const context = getTracingContext();
  if (!context) {
    return; // No context, skip alerts
  }

  const { traceId, spanId, projectId, userId } = context;

  // Check token budget
  if (metrics.total_tokens > env.BUDGET_MAX_TOKENS) {
    logger.warn(
      {
        traceId,
        spanId,
        projectId,
        userId,
        event: "budget.alert.tokens",
        model: metrics.model,
        total_tokens: metrics.total_tokens,
        prompt_tokens: metrics.prompt_tokens,
        completion_tokens: metrics.completion_tokens,
        budget_max_tokens: env.BUDGET_MAX_TOKENS,
        prompt_hash: metrics.prompt_hash,
        spec_hash: metrics.spec_hash,
      },
      "Budget alert: token limit exceeded",
    );
  }

  // Check duration budget
  if (metrics.duration_ms > env.BUDGET_MAX_DURATION_MS) {
    logger.warn(
      {
        traceId,
        spanId,
        projectId,
        userId,
        event: "budget.alert.duration",
        model: metrics.model,
        duration_ms: metrics.duration_ms,
        budget_max_duration_ms: env.BUDGET_MAX_DURATION_MS,
        prompt_hash: metrics.prompt_hash,
        spec_hash: metrics.spec_hash,
      },
      "Budget alert: duration limit exceeded",
    );
  }

  // Check completion ratio budget
  if (metrics.prompt_tokens > 0) {
    const completionRatio = metrics.completion_tokens / metrics.prompt_tokens;
    if (completionRatio > env.BUDGET_MAX_COMPLETION_RATIO) {
      logger.warn(
        {
          traceId,
          spanId,
          projectId,
          userId,
          event: "budget.alert.ratio",
          model: metrics.model,
          completion_ratio: completionRatio,
          prompt_tokens: metrics.prompt_tokens,
          completion_tokens: metrics.completion_tokens,
          budget_max_completion_ratio: env.BUDGET_MAX_COMPLETION_RATIO,
          prompt_hash: metrics.prompt_hash,
          spec_hash: metrics.spec_hash,
        },
        "Budget alert: completion ratio limit exceeded",
      );
    }
  }
}
