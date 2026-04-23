<script lang="ts">
    import { onMount } from "svelte";
    import type { KvEntry } from "$lib/kv";
    import KvEditor from "$lib/kv-editor.svelte";

    let entries = $state<KvEntry[]>([]);
    let loaded = $state(false);
    let lastLatency = $state<{ method: string; path: string; ms: number } | null>(null);

    async function trackedFetch(input: string, init?: RequestInit): Promise<Response> {
        const method = (init?.method ?? "GET").toUpperCase();
        const start = performance.now();
        try {
            return await fetch(input, init);
        } finally {
            const ms = performance.now() - start;
            const path = input.startsWith("http") ? new URL(input).pathname : input.split("?")[0];
            lastLatency = { method, path, ms };
        }
    }

    async function loadEntries() {
        const res = await trackedFetch("/api/entries");
        entries = await res.json();
        loaded = true;
    }

    onMount(loadEntries);
</script>

<div class="mx-auto max-w-4xl p-6">
    <div class="mb-2 flex items-center justify-between">
        <span class="font-mono text-xs text-gray-500">
            {#if lastLatency}
                {lastLatency.method} {lastLatency.path} &middot; {lastLatency.ms.toFixed(1)} ms
            {:else}
                &nbsp;
            {/if}
        </span>
        <a href="/svelte/about" class="text-sm text-blue-600 hover:underline">About →</a>
    </div>
    {#if loaded}
        <KvEditor {entries} onChange={loadEntries} fetcher={trackedFetch} />
    {:else}
        <p class="text-sm text-gray-400">Loading&hellip;</p>
    {/if}
</div>
