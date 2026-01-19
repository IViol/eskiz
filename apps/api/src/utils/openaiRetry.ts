import type OpenAI from "openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { getEnv } from "../config/env.js";

const env = getEnv();

/**
 * Outcome of an OpenAI request
 */
export type RequestOutcome = "success" | "timeout" | "error";

import type { ChatCompletion } from "openai/resources/chat/completions";

/**
 * Result of an OpenAI request with retry information
 */
export interface RetryResult {
  completion: ChatCompletion;
  retryCount: number;
  outcome: RequestOutcome;
  openaiRequestId: string | null;
}

/**
 * Checks if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  // Check for OpenAI API error with status
  if ("status" in error && typeof error.status === "number") {
    const status = error.status;
    // 429 (rate limit), 500, 502, 503, 504 are retryable
    return [429, 500, 502, 503, 504].includes(status);
  }

  // Check for timeout errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") || message.includes("econnreset") || message.includes("etimedout")
    );
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Makes an OpenAI request with retry logic and timeout
 */
export async function makeOpenAIRequestWithRetry(
  client: OpenAI,
  params: ChatCompletionCreateParams,
): Promise<RetryResult> {
  const timeoutMs = env.OPENAI_TIMEOUT_MS;
  const maxRetries = env.OPENAI_RETRY_MAX;
  const baseRetryMs = env.OPENAI_RETRY_BASE_MS;

  let lastError: unknown;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Request timeout"));
        }, timeoutMs);
      });

      // Make request with timeout using Promise.race
      const completion = (await Promise.race([
        client.chat.completions.create(params),
        timeoutPromise,
      ])) as ChatCompletion;

      // Extract request_id from response
      let openaiRequestId: string | null = null;
      if (completion && typeof completion === "object") {
        // Try to get request_id from response headers or metadata
        // OpenAI SDK v4+ may expose this in different ways
        const response = (
          completion as unknown as {
            _response?: { headers?: Headers | Record<string, string> };
          }
        )._response;

        if (response?.headers) {
          if (response.headers instanceof Headers) {
            openaiRequestId = response.headers.get("openai-request-id") ?? null;
          } else if (typeof response.headers === "object") {
            openaiRequestId =
              (response.headers as Record<string, string>)["openai-request-id"] ?? null;
          }
        }

        // Also try to get from response object directly
        if (!openaiRequestId && "id" in completion) {
          openaiRequestId = String(completion.id) ?? null;
        }
      }

      return {
        completion,
        retryCount,
        outcome: "success",
        openaiRequestId,
      };
    } catch (error: unknown) {
      lastError = error;

      // Check if it's a timeout
      const isTimeout =
        error instanceof Error &&
        (error.message.includes("timeout") || error.message === "Request timeout");

      if (isTimeout) {
        return {
          completion: null as unknown as ChatCompletion,
          retryCount,
          outcome: "timeout",
          openaiRequestId: null,
        };
      }

      // If not retryable or last attempt, break
      if (!isRetryableError(error) || attempt === maxRetries) {
        break;
      }

      // Calculate exponential backoff delay
      const delayMs = baseRetryMs * 2 ** attempt;
      retryCount++;

      // Wait before retry
      await sleep(delayMs);
    }
  }

  // All retries exhausted or non-retryable error
  return {
    completion: null as unknown as ChatCompletion,
    retryCount,
    outcome:
      lastError instanceof Error && lastError.message.includes("timeout") ? "timeout" : "error",
    openaiRequestId: null,
  };
}
