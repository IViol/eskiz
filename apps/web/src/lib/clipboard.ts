import type { DesignSpec } from "@eskiz/spec";

export async function copySpecToClipboard(spec: DesignSpec): Promise<void> {
  const text = JSON.stringify(spec, null, 2);
  await navigator.clipboard.writeText(text);
}
