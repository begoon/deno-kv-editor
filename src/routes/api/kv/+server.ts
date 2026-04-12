import { getKv } from "$lib/kv";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
    const { key, value } = await request.json();
    if (!Array.isArray(key) || key.length === 0) {
        return json({ error: "Key must be a non-empty array" }, { status: 400 });
    }
    const kv = await getKv();
    await kv.set(key, value);
    return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
    const { key } = await request.json();
    if (!Array.isArray(key) || key.length === 0) {
        return json({ error: "Key must be a non-empty array" }, { status: 400 });
    }
    const kv = await getKv();
    await kv.delete(key);
    return json({ ok: true });
};
