import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkBudgetAlerts } from "../budgetAlerts.js";
import { runWithTracingContext, createTracingContext } from "../../context/tracing.js";
import { logger } from "../../logger.js";
import { getEnv } from "../../config/env.js";

vi.mock("../../logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../../config/env.js", () => ({
  getEnv: vi.fn(),
}));

describe("checkBudgetAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnv).mockReturnValue({
      BUDGET_MAX_TOKENS: 8000,
      BUDGET_MAX_DURATION_MS: 8000,
      BUDGET_MAX_COMPLETION_RATIO: 3.0,
    } as ReturnType<typeof getEnv>);
  });

  it("does not log alerts when metrics are within budget", () => {
    const context = createTracingContext();
    runWithTracingContext(context, () => {
      checkBudgetAlerts({
        total_tokens: 1000,
        prompt_tokens: 500,
        completion_tokens: 500,
        duration_ms: 1000,
        model: "gpt-4",
      });
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs token budget alert when total_tokens exceeds limit", () => {
    const context = createTracingContext();
    runWithTracingContext(context, () => {
      checkBudgetAlerts({
        total_tokens: 10000,
        prompt_tokens: 5000,
        completion_tokens: 5000,
        duration_ms: 1000,
        model: "gpt-4",
        prompt_hash: "test-hash",
        spec_hash: "spec-hash",
      });
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "budget.alert.tokens",
        total_tokens: 10000,
        budget_max_tokens: 8000,
      }),
      "Budget alert: token limit exceeded",
    );
  });

  it("logs duration budget alert when duration exceeds limit", () => {
    const context = createTracingContext();
    runWithTracingContext(context, () => {
      checkBudgetAlerts({
        total_tokens: 1000,
        prompt_tokens: 500,
        completion_tokens: 500,
        duration_ms: 10000,
        model: "gpt-4",
      });
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "budget.alert.duration",
        duration_ms: 10000,
        budget_max_duration_ms: 8000,
      }),
      "Budget alert: duration limit exceeded",
    );
  });

  it("logs ratio budget alert when completion ratio exceeds limit", () => {
    const context = createTracingContext();
    runWithTracingContext(context, () => {
      checkBudgetAlerts({
        total_tokens: 1000,
        prompt_tokens: 100,
        completion_tokens: 400, // ratio = 4.0 > 3.0
        duration_ms: 1000,
        model: "gpt-4",
      });
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "budget.alert.ratio",
        completion_ratio: 4.0,
        budget_max_completion_ratio: 3.0,
      }),
      "Budget alert: completion ratio limit exceeded",
    );
  });

  it("does not log alerts when context is missing", () => {
    // No context set
    checkBudgetAlerts({
      total_tokens: 10000,
      prompt_tokens: 5000,
      completion_tokens: 5000,
      duration_ms: 10000,
      model: "gpt-4",
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
