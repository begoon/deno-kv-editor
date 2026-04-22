<script lang="ts">
    import { onMount } from "svelte";
    import type { KvEntry } from "$lib/kv";
    import KvEditor from "$lib/kv-editor.svelte";

    let entries = $state<KvEntry[]>([]);
    let loaded = $state(false);

    async function loadEntries() {
        const res = await fetch("/api/entries");
        entries = await res.json();
        loaded = true;
    }

    onMount(loadEntries);
</script>

<div class="mx-auto max-w-4xl p-6">
    <div class="mb-2 text-right">
        <a href="/svelte/about" class="text-sm text-blue-600 hover:underline">About →</a>
    </div>
    {#if loaded}
        <KvEditor {entries} onChange={loadEntries} />
    {:else}
        <p class="text-sm text-gray-400">Loading&hellip;</p>
    {/if}
</div>
