let kv: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

export type EntryType = "string" | "number" | "object" | "array";

export interface KvEntry {
  key: string;
  value: unknown;
  type: EntryType;
}

export function detectType(value: unknown): EntryType {
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return "number";
  if (typeof value === "object" && value !== null) return "object";
  return "string";
}
