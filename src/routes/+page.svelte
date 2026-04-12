<script lang="ts">
    import type { KvEntry } from "$lib/kv";
    import KvEditor from "$lib/kv-editor.svelte";

    let { data }: { data: { entries: KvEntry[] } } = $props();
</script>

<div class="mx-auto max-w-4xl p-6">
    <KvEditor entries={data.entries} />
</div>
