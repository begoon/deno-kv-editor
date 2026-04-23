import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = fileURLToPath(new URL(".", import.meta.url));

// Each --mode selects a single entry. Running multiple entries in one build
// would create a shared chunk that vite-plugin-singlefile can't inline,
// leaving an external <script src> that nothing serves.
const entries: Record<string, string> = {
    main: "index.html",
    about: "about.html",
};

export default defineConfig(({ mode }) => {
    const entry = entries[mode];
    if (!entry) {
        throw new Error(
            `vite build needs --mode <${Object.keys(entries).join("|")}>`,
        );
    }
    return {
        plugins: [tailwindcss(), svelte(), viteSingleFile()],
        build: {
            outDir: "templates/svelte",
            emptyOutDir: false,
            rollupOptions: {
                input: resolve(root, entry),
            },
        },
        resolve: {
            alias: {
                $lib: resolve(root, "src/lib"),
            },
        },
    };
});
