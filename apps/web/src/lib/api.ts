import type { DesignSpec, GenerationContext, PromptRequest } from "@eskiz/spec";

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

export async function generateSpec(
  prompt: string,
  generationContext: GenerationContext,
  dryRun = false,
): Promise<DesignSpec> {
  const url = new URL("/api/spec", window.location.origin);
  if (dryRun) {
    url.searchParams.set("dryRun", "true");
  }

  const requestBody: PromptRequest = {
    prompt,
    generationContext,
  };

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: "Unknown error",
      message: `HTTP ${response.status}`,
    }));
    throw new Error(errorData.message || errorData.error || "Failed to generate spec");
  }

  return response.json() as Promise<DesignSpec>;
}
