import { detectType, getKv, type KvEntry, type KvKeyPart } from "$lib/kv";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const kv = await getKv();
    const entries: KvEntry[] = [];
    for await (const entry of kv.list({ prefix: [] })) {
        const key = entry.key as KvKeyPart[];
        console.log("loaded entry with key:", key);
        entries.push({ key, value: entry.value, type: detectType(entry.value) });
    }
    return { entries };
};
