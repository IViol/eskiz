import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // Logging and security
  LOG_HASH_SECRET: z.string().min(1, "LOG_HASH_SECRET is required").default("change-me-in-production"),
  LOG_DEBUG_PAYLOADS: z.coerce.boolean().default(false),
  // OpenAI configuration
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  OPENAI_RETRY_MAX: z.coerce.number().int().nonnegative().default(2),
  OPENAI_RETRY_BASE_MS: z.coerce.number().int().positive().default(1000),
  // Budget alerts
  BUDGET_MAX_TOKENS: z.coerce.number().int().positive().default(8000),
  BUDGET_MAX_DURATION_MS: z.coerce.number().int().positive().default(8000),
  BUDGET_MAX_COMPLETION_RATIO: z.coerce.number().positive().default(3.0),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (env === null) {
    env = envSchema.parse(process.env);
  }
  return env;
}
