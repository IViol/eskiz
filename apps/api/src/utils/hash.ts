import { createHash } from "node:crypto";

/**
 * Computes SHA-256 hash of a string
 */
export function computeHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Computes hash of a JSON-serializable object
 */
export function computeObjectHash(obj: unknown): string {
  const jsonString = JSON.stringify(obj);
  return computeHash(jsonString);
}
