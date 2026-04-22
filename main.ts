// htmx-based alternative to the SvelteKit KV editor.
// Run: deno run -A main.ts

type KvKeyPart = string | number | boolean | bigint;
type EntryType = "string" | "number" | "object" | "array";

interface KvEntry {
    key: KvKeyPart[];
    value: unknown;
    type: EntryType;
}

let _kv: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
    if (!_kv) {
        const uuid = Deno.env.get("DENO_KV_UUID");
        _kv = uuid
            ? await Deno.openKv(`https://api.deno.com/databases/${uuid}/connect`)
            : await Deno.openKv();
    }
    return _kv;
}

function detectType(value: unknown): EntryType {
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") return "number";
    if (typeof value === "object" && value !== null) return "object";
    return "string";
}

function displayKey(key: KvKeyPart[]): string {
    return key.map(String).join(":");
}

function parseKeyInput(raw: string): KvKeyPart[] | null {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (!Array.isArray(parsed) || parsed.length === 0) return null;
            const ok = parsed.every((v) =>
                typeof v === "string" || typeof v === "number" ||
                typeof v === "boolean" || typeof v === "bigint"
            );
            return ok ? parsed : null;
        } catch {
            return null;
        }
    }
    if (trimmed === "true") return [true];
    if (trimmed === "false") return [false];
    if (!isNaN(Number(trimmed))) return [Number(trimmed)];
    return [trimmed];
}

// Parse a value entered by the user: try JSON, fall back to string.
function parseValueInput(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === "") return "";
    try {
        const parsed = JSON.parse(trimmed);
        // Only treat structured / numeric JSON as non-string. A bare string like
        // `"hello"` parses to "hello" but we want quoted JSON-looking values
        // handled that way too — so just return the parse result.
        return parsed;
    } catch {
        return raw;
    }
}

function displayValue(value: unknown, type: EntryType): string {
    if (type === "string") return value as string;
    if (type === "number") return String(value);
    return JSON.stringify(value);
}

function editValue(value: unknown, type: EntryType): string {
    if (type === "string") return value as string;
    if (type === "number") return String(value);
    return JSON.stringify(value, null, 2);
}

// Encode a key as a URL-safe token so it can be passed in query strings.
function encodeKey(key: KvKeyPart[]): string {
    return encodeURIComponent(JSON.stringify(key));
}

function decodeKey(token: string | null): KvKeyPart[] | null {
    if (!token) return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(token));
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        return parsed as KvKeyPart[];
    } catch {
        return null;
    }
}

const ESC_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
function esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

async function listEntries(): Promise<KvEntry[]> {
    const kv = await getKv();
    const entries: KvEntry[] = [];
    for await (const entry of kv.list({ prefix: [] })) {
        const key = entry.key as KvKeyPart[];
        entries.push({ key, value: entry.value, type: detectType(entry.value) });
    }
    return entries;
}

function filterEntries(entries: KvEntry[], query: string): KvEntry[] {
    const q = query.trim().toLowerCase();
    if (q === "") return entries;
    return entries.filter((e) => {
        const keyStr = displayKey(e.key).toLowerCase();
        const valStr = JSON.stringify(e.value).toLowerCase();
        return keyStr.includes(q) || valStr.includes(q);
    });
}

// --- HTML rendering ------------------------------------------------------

function loadTmpl(name: string): string {
    return Deno.readTextFileSync(
        new URL(`./templates/${name}.html`, import.meta.url),
    );
}

const TMPL = {
    page: loadTmpl("page"),
    row: loadTmpl("row"),
    editRow: loadTmpl("edit-row"),
    editInput: loadTmpl("edit-input"),
    editTextarea: loadTmpl("edit-textarea"),
    tbody: loadTmpl("tbody"),
    tbodyEmpty: loadTmpl("tbody-empty"),
    createForm: loadTmpl("create-form"),
    createButton: loadTmpl("create-button"),
};

// {{name}} substitution. Values are NOT escaped by render — callers must
// pre-escape any untrusted strings with esc() before passing them in.
function render(tmpl: string, vars: Record<string, string> = {}): string {
    return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function renderRow(entry: KvEntry): string {
    return render(TMPL.row, {
        keyToken: encodeKey(entry.key),
        keyText: esc(displayKey(entry.key)),
        valText: esc(displayValue(entry.value, entry.type)),
    });
}

function renderEditRow(entry: KvEntry): string {
    const raw = editValue(entry.value, entry.type);
    const isMultiline = entry.type === "object" || entry.type === "array";
    const input = render(
        isMultiline ? TMPL.editTextarea : TMPL.editInput,
        { value: esc(raw) },
    );
    return render(TMPL.editRow, {
        keyToken: encodeKey(entry.key),
        keyText: esc(displayKey(entry.key)),
        keyJson: esc(JSON.stringify(entry.key)),
        input,
    });
}

function renderTbody(entries: KvEntry[], oob = false): string {
    const oobAttr = oob ? ' hx-swap-oob="outerHTML"' : "";
    const body = entries.length === 0
        ? render(TMPL.tbodyEmpty, { oobAttr })
        : render(TMPL.tbody, { oobAttr, rows: entries.map(renderRow).join("") });
    // `<tbody>` is stripped by the HTML parser when it appears at the root of
    // an OOB response fragment, so wrap it in <template> to keep it intact.
    return oob ? `<template>${body}</template>` : body;
}

function renderCreateForm(error?: string, keyVal = "", valueVal = ""): string {
    const errorLine = error
        ? `<p class="mb-2 text-sm text-red-700">${esc(error)}</p>`
        : "";
    return render(TMPL.createForm, {
        errorLine,
        keyVal: esc(keyVal),
        valueVal: esc(valueVal),
    });
}

function renderCreateSlot(open: boolean): string {
    return open ? renderCreateForm() : TMPL.createButton;
}

function renderPage(entries: KvEntry[]): string {
    return render(TMPL.page, {
        createSlot: renderCreateSlot(false),
        tbody: renderTbody(entries),
    });
}

// --- HTTP ---------------------------------------------------------------

function html(body: string, status = 200): Response {
    return new Response(body, {
        status,
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}

// JSON body shape accepted by /api/kv for both POST and DELETE.
interface ApiKvBody {
    key?: unknown;
    value?: unknown;
}

function validKeyArray(k: unknown): KvKeyPart[] | null {
    if (!Array.isArray(k) || k.length === 0) return null;
    const ok = k.every((v) =>
        typeof v === "string" || typeof v === "number" ||
        typeof v === "boolean" || typeof v === "bigint"
    );
    return ok ? (k as KvKeyPart[]) : null;
}

// Built Svelte single-file pages — loaded lazily and cached per page name.
const _svelteCache = new Map<string, string>();
async function loadSveltePage(name: string): Promise<string | null> {
    if (_svelteCache.has(name)) return _svelteCache.get(name)!;
    // Guard against path traversal — only word chars allowed.
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;
    try {
        const body = await Deno.readTextFile(
            new URL(`./templates/svelte/${name}.html`, import.meta.url),
        );
        _svelteCache.set(name, body);
        return body;
    } catch {
        return null;
    }
}

const NOT_BUILT_HTML =
    `<!doctype html><meta charset="utf-8"><title>Not built</title>
<p style="font-family:sans-serif;padding:2rem">
The Svelte bundle has not been built yet. Run <code>npm install &amp;&amp; npm run build</code>
and then reload this page.</p>`;

async function findEntry(key: KvKeyPart[]): Promise<KvEntry | null> {
    const kv = await getKv();
    const res = await kv.get(key);
    if (res.value === null) return null;
    return { key, value: res.value, type: detectType(res.value) };
}

async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    if (method === "GET" && pathname === "/") {
        const entries = await listEntries();
        return html(renderPage(entries));
    }

    if (method === "GET" && pathname === "/rows") {
        const q = url.searchParams.get("q") ?? "";
        const entries = filterEntries(await listEntries(), q);
        return html(renderTbody(entries));
    }

    if (method === "GET" && pathname === "/create") {
        return html(renderCreateSlot(true));
    }

    if (method === "GET" && pathname === "/create/cancel") {
        return html(renderCreateSlot(false));
    }

    if (method === "GET" && pathname === "/edit") {
        const key = decodeKey(url.searchParams.get("k"));
        if (!key) return html("bad key", 400);
        const entry = await findEntry(key);
        if (!entry) return html("not found", 404);
        return html(renderEditRow(entry));
    }

    if (method === "GET" && pathname === "/row") {
        const key = decodeKey(url.searchParams.get("k"));
        if (!key) return html("bad key", 400);
        const entry = await findEntry(key);
        if (!entry) return html("", 200); // row gone — let htmx replace with empty
        return html(renderRow(entry));
    }

    if (method === "POST" && pathname === "/entry") {
        const form = await req.formData();
        const keyRaw = String(form.get("key") ?? "");
        const valRaw = String(form.get("value") ?? "");
        let key: KvKeyPart[] | null;
        try {
            const parsed = JSON.parse(keyRaw);
            key = Array.isArray(parsed) ? (parsed as KvKeyPart[]) : null;
        } catch {
            key = null;
        }
        if (!key || key.length === 0) return html("bad key", 400);
        const value = parseValueInput(valRaw);
        const kv = await getKv();
        await kv.set(key, value);
        const entry: KvEntry = { key, value, type: detectType(value) };
        return html(renderRow(entry));
    }

    if (method === "POST" && pathname === "/new") {
        const form = await req.formData();
        const keyRaw = String(form.get("key") ?? "");
        const valRaw = String(form.get("value") ?? "");
        const key = parseKeyInput(keyRaw);
        if (!key) {
            return html(renderCreateForm(
                "Invalid key. Use a bare value or a JSON array of strings/numbers/booleans.",
                keyRaw,
                valRaw,
            ));
        }
        const value = parseValueInput(valRaw);
        const kv = await getKv();
        await kv.set(key, value);
        // Replace the create form (target=#create) with a closed slot, and
        // use an OOB swap to refresh the rows tbody.
        const entries = await listEntries();
        return html(renderCreateSlot(false) + renderTbody(entries, true));
    }

    if (method === "DELETE" && pathname === "/entry") {
        const key = decodeKey(url.searchParams.get("k"));
        if (!key) return html("bad key", 400);
        const kv = await getKv();
        await kv.delete(key);
        return html(""); // row is replaced with nothing (hx-swap="outerHTML")
    }

    // --- Svelte editor + JSON API ---------------------------------------

    if (method === "GET" && pathname.startsWith("/svelte")) {
        // /svelte, /svelte/ → index ; /svelte/about → about
        const rest = pathname.slice("/svelte".length).replace(/^\//, "");
        const name = rest === "" ? "index" : rest;
        const body = await loadSveltePage(name);
        if (body === null) {
            return name === "index" ? html(NOT_BUILT_HTML) : html("not found", 404);
        }
        return html(body);
    }

    if (method === "GET" && pathname === "/api/entries") {
        return json(await listEntries());
    }

    if (pathname === "/api/kv" && (method === "POST" || method === "DELETE")) {
        const body = (await req.json().catch(() => null)) as ApiKvBody | null;
        if (!body) return json({ error: "Invalid JSON body" }, 400);
        const key = validKeyArray(body.key);
        if (!key) return json({ error: "Key must be a non-empty array" }, 400);
        const kv = await getKv();
        if (method === "POST") {
            await kv.set(key, body.value);
        } else {
            await kv.delete(key);
        }
        return json({ ok: true });
    }

    return html("not found", 404);
}

const port = Number(Deno.env.get("PORT") ?? 8000);
Deno.serve({ port }, handle);
