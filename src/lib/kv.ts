export type KvKeyPart = string | number | boolean | bigint;

export type EntryType = "string" | "number" | "object" | "array";

export interface KvEntry {
    key: KvKeyPart[];
    value: unknown;
    type: EntryType;
}

export function detectType(value: unknown): EntryType {
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") return "number";
    if (typeof value === "object" && value !== null) return "object";
    return "string";
}

export function displayKey(key: KvKeyPart[]): string {
    return key.map(String).join(":");
}

function isValidKeyPart(v: unknown): v is KvKeyPart {
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint";
}

/** Parse a key input string into a KvKeyPart[], or null if invalid. */
export function parseKeyInput(raw: string): KvKeyPart[] | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;

    // Try parsing as JSON array first
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (!Array.isArray(parsed) || parsed.length === 0) return null;
            if (parsed.every(isValidKeyPart)) return parsed;
            return null;
        } catch {
            return null;
        }
    }

    // Single value: try number, boolean, then fall back to string
    if (trimmed === "true") return [true];
    if (trimmed === "false") return [false];
    if (trimmed !== "" && !isNaN(Number(trimmed))) return [Number(trimmed)];
    return [trimmed];
}
