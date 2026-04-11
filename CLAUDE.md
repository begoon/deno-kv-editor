# Deno KV Editor

A SvelteKit web app for browsing and editing Deno KV databases.

## Stack

- SvelteKit (Svelte 5, runes mode) with `@deno/svelte-adapter`
- Tailwind CSS v4 with `@tailwindcss/forms` and `@tailwindcss/typography`
- Deno KV for storage (`Deno.openKv()`)
- Deployed to Deno Deploy (deno.net), org: `ea`, app: `deno-kv-editor`

## Development

```bash
# Generate SvelteKit types (needed after adding new routes)
npx svelte-kit sync

# Build and run locally (uses local SQLite-backed KV)
deno task build && deno run -A .deno-deploy/server.ts

# Deploy to Deno Deploy
deno deploy
```

The `--tunnel` flag for local KV access to Deploy databases is currently broken (server-side "closed by peer" error). Use local KV for development instead.

## Architecture

- `src/lib/kv.ts` - KV singleton + type helpers (`getKv`, `detectType`, `KvEntry`, `EntryType`)
- `src/routes/+page.server.ts` - SSR load function, lists all KV entries
- `src/routes/+page.svelte` - Editor UI (table with inline editing, create/delete)
- `src/routes/api/kv/+server.ts` - REST API: POST (create/update), DELETE
- `src/routes/+layout.svelte` - Root layout, imports Tailwind CSS

## KV data model

All entries use single-segment string keys: `kv.set(["mykey"], value)`. Values can be string, number, object, or array. The UI auto-detects the type for display and editing.

## Conventions

- Use `deno task build` (not `npm run build`) for building
- Formatting is handled by Prettier (configured with svelte + tailwind plugins)
- `deno.jsonc` has `"unstable": ["kv"]` so `--unstable-kv` flag is not needed
- `no-sloppy-imports` lint rule is disabled because SvelteKit aliases (`$lib`, `$types`) don't use file extensions
