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

function renderRow(entry: KvEntry): string {
    const k = encodeKey(entry.key);
    const keyText = esc(displayKey(entry.key));
    const valText = esc(displayValue(entry.value, entry.type));
    return `<tr class="border-b border-gray-100">
  <td class="w-1/3 py-2 pr-4 align-top">
    <button
      hx-delete="/entry?k=${k}"
      hx-target="closest tr"
      hx-swap="outerHTML"
      hx-confirm="Delete &quot;${keyText}&quot;?"
      class="w-full cursor-pointer text-left font-mono text-sm text-red-700 hover:text-red-900 hover:underline"
      title="Click to delete"
    >${keyText}</button>
  </td>
  <td class="py-2 align-top">
    <button
      hx-get="/edit?k=${k}"
      hx-target="closest tr"
      hx-swap="outerHTML"
      class="w-full cursor-pointer text-left font-mono text-sm whitespace-pre-wrap hover:bg-gray-50"
      title="Click to edit"
    >${valText}</button>
  </td>
</tr>`;
}

function renderEditRow(entry: KvEntry): string {
    const k = encodeKey(entry.key);
    const keyText = esc(displayKey(entry.key));
    const raw = editValue(entry.value, entry.type);
    const isMultiline = entry.type === "object" || entry.type === "array";
    const input = isMultiline
        ? `<textarea name="value" rows="6" class="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm">${esc(raw)}</textarea>`
        : `<input type="text" name="value" value="${esc(raw)}" class="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"/>`;
    return `<tr class="border-b border-gray-100">
  <td class="w-1/3 py-2 pr-4 align-top font-mono text-sm text-red-700">${keyText}</td>
  <td class="py-2 align-top">
    <form hx-post="/entry" hx-target="closest tr" hx-swap="outerHTML">
      <input type="hidden" name="key" value="${esc(JSON.stringify(entry.key))}"/>
      ${input}
      <div class="mt-1.5 flex gap-2">
        <button type="submit" class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700">Save</button>
        <button type="button"
          hx-get="/row?k=${k}"
          hx-target="closest tr"
          hx-swap="outerHTML"
          class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  </td>
</tr>`;
}

function renderTbody(entries: KvEntry[]): string {
    if (entries.length === 0) {
        return `<tbody id="rows"><tr><td colspan="2" class="py-8 text-center text-sm text-gray-400">No entries. Use "Create…" to add one.</td></tr></tbody>`;
    }
    return `<tbody id="rows">${entries.map(renderRow).join("")}</tbody>`;
}

function renderCreateForm(error?: string, keyVal = "", valueVal = ""): string {
    const errLine = error
        ? `<p class="mb-2 text-sm text-red-700">${esc(error)}</p>`
        : "";
    return `<div id="create" class="mb-4 rounded border border-blue-300 bg-blue-50 p-4">
  ${errLine}
  <form hx-post="/new" hx-target="#create" hx-swap="outerHTML">
    <div class="mb-3 flex gap-3">
      <input type="text" name="key" required value="${esc(keyVal)}"
        placeholder='Key (e.g. mykey or [&quot;users&quot;, 42])'
        class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"/>
      <input type="text" name="value" required value="${esc(valueVal)}"
        placeholder="Value (string, number, or JSON)"
        class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"/>
    </div>
    <div class="flex items-center gap-2">
      <button type="submit" class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
      <button type="button"
        hx-get="/create/cancel" hx-target="#create" hx-swap="outerHTML"
        class="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
    </div>
  </form>
</div>`;
}

function renderCreateSlot(open: boolean): string {
    if (open) return renderCreateForm();
    return `<div id="create" class="mb-4">
  <button
    hx-get="/create"
    hx-target="#create"
    hx-swap="outerHTML"
    class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
  >Create…</button>
</div>`;
}

function renderPage(entries: KvEntry[]): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>KV Editor (htmx)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script src="https://unpkg.com/htmx.org@2.0.3"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-gray-900">
  <div class="mx-auto max-w-4xl p-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">KV Editor <span class="text-sm font-normal text-gray-400">htmx</span></h1>
      <a href="/svelte" class="text-sm text-blue-600 hover:underline">Svelte version →</a>
      <input type="text" name="q" placeholder="Filter..."
        hx-get="/rows" hx-target="#rows" hx-swap="outerHTML"
        hx-trigger="input changed delay:200ms, search"
        class="rounded border border-gray-300 px-3 py-2 text-sm"/>
    </div>
    ${renderCreateSlot(false)}
    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b border-gray-300 text-left text-sm text-gray-500">
          <th class="w-1/3 py-2 pr-4 font-medium">Key</th>
          <th class="py-2 font-medium">Value</th>
        </tr>
      </thead>
      ${renderTbody(entries)}
    </table>
  </div>
</body>
</html>`;
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

// The Svelte single-file bundle — loaded lazily on first /svelte request.
let _svelteHtml: string | null = null;
async function loadSvelteHtml(): Promise<string> {
    if (_svelteHtml) return _svelteHtml;
    try {
        _svelteHtml = await Deno.readTextFile(
            new URL("./dist/index.html", import.meta.url),
        );
    } catch {
        _svelteHtml =
            `<!doctype html><meta charset="utf-8"><title>Not built</title>
<p style="font-family:sans-serif;padding:2rem">
The Svelte bundle has not been built yet. Run <code>npm install &amp;&amp; npm run build</code>
and then reload this page.</p>`;
    }
    return _svelteHtml;
}

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
        const tbody = renderTbody(entries).replace(
            '<tbody id="rows">',
            '<tbody id="rows" hx-swap-oob="outerHTML">',
        );
        return html(renderCreateSlot(false) + tbody);
    }

    if (method === "DELETE" && pathname === "/entry") {
        const key = decodeKey(url.searchParams.get("k"));
        if (!key) return html("bad key", 400);
        const kv = await getKv();
        await kv.delete(key);
        return html(""); // row is replaced with nothing (hx-swap="outerHTML")
    }

    // --- Svelte editor + JSON API ---------------------------------------

    if (method === "GET" && (pathname === "/svelte" || pathname === "/svelte/")) {
        return html(await loadSvelteHtml());
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
