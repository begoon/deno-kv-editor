<script lang="ts">
    import { onMount } from "svelte";

    let entryCount = $state<number | null>(null);

    onMount(async () => {
        const res = await fetch("/api/entries");
        const entries = await res.json();
        entryCount = entries.length;
    });
</script>

<div class="mx-auto max-w-4xl p-6">
    <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">About</h1>
        <a href="/svelte" class="text-sm text-blue-600 hover:underline">← back to editor</a>
    </div>

    <div class="prose prose-sm">
        <p>
            A Deno KV browser / editor. Two front-ends share the same JSON API:
        </p>
        <ul>
            <li><a href="/">htmx version</a> — server-rendered HTML fragments</li>
            <li><a href="/svelte">Svelte version</a> — single-file SPA</li>
        </ul>

        <h2>Stack</h2>
        <ul>
            <li>Deno runtime + <code>Deno.openKv()</code></li>
            <li>Vite + Svelte 5 (runes) + <code>vite-plugin-singlefile</code></li>
            <li>Tailwind CSS v4</li>
        </ul>

        <h2>Live stats</h2>
        <p>
            {#if entryCount === null}
                Loading&hellip;
            {:else}
                Database currently has <strong>{entryCount}</strong> {entryCount === 1 ? "entry" : "entries"}.
            {/if}
        </p>
    </div>
</div>
