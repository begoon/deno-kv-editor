import { detectType, getKv, type KvEntry } from "$lib/kv";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const kv = await getKv();
    const entries: KvEntry[] = [];
    for await (const entry of kv.list({ prefix: [] })) {
        const key = entry.key[0] as string;
        entries.push({ key, value: entry.value, type: detectType(entry.value) });
    }
    return { entries };
};
