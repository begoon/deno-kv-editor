tunnel:
    deno run --tunnel -A main.ts

run:
    deno run -A main.ts

build:
    rm -rf templates/svelte
    npx vite build --mode main
    npx vite build --mode about
