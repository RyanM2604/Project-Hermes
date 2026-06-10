import { createHash } from "node:crypto";

export function createSourceFingerprint(
  source: string,
  sourceId: string,
): string {
  return createHash("sha256")
    .update(`${source}:${sourceId.trim()}`)
    .digest("hex");
}

export function parseRequiredDate(value: string): string | null {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
