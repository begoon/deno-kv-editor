<script lang="ts">
    import { type EntryType, type KvEntry, type KvKeyPart, displayKey, parseKeyInput } from "$lib/kv";

    let { entries, onChange }: { entries: KvEntry[]; onChange: () => Promise<void> } = $props();

    let editingKey = $state<KvKeyPart[] | null>(null);
    let editValue = $state("");
    let editValid = $state(true);
    let editType = $state<EntryType>("string");

    let search = $state("");
    let filteredEntries = $derived(
        search.trim() === ""
            ? entries
            : entries.filter((e) => {
                  const q = search.trim().toLowerCase();
                  const keyStr = displayKey(e.key).toLowerCase();
                  const valStr = JSON.stringify(e.value).toLowerCase();
                  return keyStr.includes(q) || valStr.includes(q);
              }),
    );

    let creating = $state(false);
    let newKey = $state("");
    let newKeyValid = $state(true);
    let newValue = $state("");

    function displayValue(value: unknown, type: EntryType): string {
        if (type === "string") return value as string;
        if (type === "number") return String(value);
        return JSON.stringify(value, null, 1).replace(/\n\s*/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]").replace(/\{ /g, "{").replace(/ \}/g, "}");
    }

    function startEdit(key: KvKeyPart[], value: unknown, type: EntryType) {
        editingKey = key;
        editType = type;
        if (type === "string") {
            editValue = value as string;
        } else if (type === "number") {
            editValue = String(value);
        } else {
            editValue = JSON.stringify(value, null, 2);
        }
        editValid = true;
    }

    function validateEdit(raw: string, type: EntryType): boolean {
        if (type === "number") {
            return raw.trim() !== "" && !isNaN(Number(raw));
        }
        if (type === "object" || type === "array") {
            try {
                const parsed = JSON.parse(raw);
                if (type === "array") return Array.isArray(parsed);
                return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
            } catch {
                return false;
            }
        }
        return true;
    }

    function onEditInput(raw: string) {
        editValue = raw;
        editValid = validateEdit(raw, editType);
    }

    function parseValue(raw: string, type: EntryType): unknown {
        if (type === "number") return Number(raw);
        if (type === "object" || type === "array") return JSON.parse(raw);
        return raw;
    }

    function keysEqual(a: KvKeyPart[], b: KvKeyPart[]): boolean {
        return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    async function handleSave() {
        if (!editingKey || !editValid) return;
        const value = parseValue(editValue, editType);
        await fetch("/api/kv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: editingKey, value }),
        });
        editingKey = null;
        await onChange();
    }

    function cancelEdit() {
        editingKey = null;
    }

    async function handleDelete(key: KvKeyPart[]) {
        if (!confirm(`Delete "${displayKey(key)}"?`)) return;
        await fetch("/api/kv", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
        });
        await onChange();
    }

    function onNewKeyInput(raw: string) {
        newKey = raw;
        newKeyValid = raw.trim() === "" || parseKeyInput(raw) !== null;
    }

    function detectNewType(raw: string): { value: unknown; type: EntryType } {
        const trimmed = raw.trim();
        if (trimmed !== "" && !isNaN(Number(trimmed))) {
            return { value: Number(trimmed), type: "number" };
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return { value: parsed, type: "array" };
            if (typeof parsed === "object" && parsed !== null) return { value: parsed, type: "object" };
        } catch {
            // not JSON
        }
        return { value: trimmed, type: "string" };
    }

    async function handleCreate() {
        const parsedKey = parseKeyInput(newKey);
        if (!parsedKey || !newValue.trim()) return;
        const { value } = detectNewType(newValue);
        await fetch("/api/kv", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: parsedKey, value }),
        });
        newKey = "";
        newValue = "";
        newKeyValid = true;
        creating = false;
        await onChange();
    }

    function cancelCreate() {
        creating = false;
        newKey = "";
        newValue = "";
        newKeyValid = true;
    }

    function handleExport() {
        const obj: Record<string, unknown> = {};
        for (const e of entries) {
            obj[displayKey(e.key)] = e.value;
        }
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kv-export.json";
        a.click();
        URL.revokeObjectURL(url);
    }
</script>

<div class="mb-4 flex items-center justify-between">
    <h1 class="text-2xl font-bold">KV Editor</h1>
    <div class="flex items-center gap-3">
        <input
            type="text"
            bind:value={search}
            placeholder="Filter..."
            class="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
            onclick={handleExport}
            class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
            Export
        </button>
        {#if !creating}
            <button
                onclick={() => (creating = true)}
                class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
                Create&hellip;
            </button>
        {/if}
    </div>
</div>

{#if creating}
    <div class="mb-4 rounded border border-blue-300 bg-blue-50 p-4">
        <div class="mb-3 flex gap-3">
            <input
                type="text"
                value={newKey}
                oninput={(e) => onNewKeyInput(e.currentTarget.value)}
                onkeydown={(e) => e.key === "Escape" && cancelCreate()}
                placeholder={'Key (e.g. mykey or ["users", 42])'}
                class="flex-1 rounded border px-3 py-2 text-sm {newKeyValid
                    ? 'border-gray-300'
                    : 'border-red-500 bg-red-50'}"
            />
            <input
                type="text"
                bind:value={newValue}
                onkeydown={(e) => e.key === "Escape" && cancelCreate()}
                placeholder="Value (string, number, or JSON)"
                class="flex-2 rounded border border-gray-300 px-3 py-2 text-sm"
            />
        </div>
        <div class="flex items-center gap-2">
            <button
                onclick={handleCreate}
                disabled={!newKeyValid || !newKey.trim() || !newValue.trim()}
                class="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
                Save
            </button>
            <button
                onclick={cancelCreate}
                class="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
                Cancel
            </button>
            {#if !newKeyValid}
                <span class="text-xs text-red-600">
                    Invalid key. Use a value or JSON array of strings/numbers/booleans.
                </span>
            {/if}
        </div>
    </div>
{/if}

<table class="w-full border-collapse">
    <thead>
        <tr class="border-b border-gray-300 text-left text-sm text-gray-500">
            <th class="w-1/3 py-2 pr-4 font-medium">Key</th>
            <th class="py-2 font-medium">Value</th>
        </tr>
    </thead>
    <tbody>
        {#each filteredEntries as { key, value, type } (displayKey(key))}
            <tr class="group border-b border-gray-100">
                <td class="w-1/3 py-2 pr-4 align-top">
                    <button
                        onclick={() => handleDelete(key)}
                        class="w-full cursor-pointer text-left font-mono text-sm text-red-700 hover:text-red-900 hover:underline"
                        title="Click to delete"
                    >
                        {displayKey(key)}
                    </button>
                </td>
                <td class="py-2 align-top">
                    {#if editingKey && keysEqual(editingKey, key)}
                        <div>
                            {#if editType === "string" || editType === "number"}
                                <input
                                    type="text"
                                    value={editValue}
                                    oninput={(e) => onEditInput(e.currentTarget.value)}
                                    onkeydown={(e) => e.key === "Escape" && cancelEdit()}
                                    class="w-full rounded border px-2 py-1 font-mono text-sm {editValid
                                        ? 'border-gray-300'
                                        : 'border-red-500 bg-red-50'}"
                                />
                            {:else}
                                <textarea
                                    value={editValue}
                                    oninput={(e) => onEditInput(e.currentTarget.value)}
                                    onkeydown={(e) => e.key === "Escape" && cancelEdit()}
                                    rows="6"
                                    class="w-full rounded border px-2 py-1 font-mono text-sm {editValid
                                        ? 'border-gray-300'
                                        : 'border-red-500 bg-red-50'}"
                                ></textarea>
                            {/if}
                            <div class="mt-1.5 flex gap-2">
                                <button
                                    onclick={handleSave}
                                    disabled={!editValid}
                                    class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                    Save
                                </button>
                                <button
                                    onclick={cancelEdit}
                                    class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    {:else}
                        <button
                            onclick={() => startEdit(key, value, type)}
                            class="w-full cursor-pointer text-left font-mono text-sm whitespace-pre-wrap hover:bg-gray-50"
                            title="Click to edit"
                        >
                            {displayValue(value, type)}
                        </button>
                    {/if}
                </td>
            </tr>
        {/each}
        {#if filteredEntries.length === 0}
            <tr>
                <td colspan="2" class="py-8 text-center text-sm text-gray-400">
                    No entries yet. Click "Create&hellip;" to add one.
                </td>
            </tr>
        {/if}
    </tbody>
</table>
