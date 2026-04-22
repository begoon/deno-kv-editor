import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    plugins: [
        tailwindcss(),
        svelte(),
        // MPA: disable the plugin's recommended (single-input-only) config
        // and apply inlining settings manually in build below.
        viteSingleFile({ useRecommendedBuildConfig: false, removeViteModuleLoader: true }),
    ],
    build: {
        outDir: "templates/svelte",
        assetsInlineLimit: 100_000_000,
        chunkSizeWarningLimit: 100_000_000,
        cssCodeSplit: false,
        rollupOptions: {
            input: {
                main: resolve(root, "index.html"),
                about: resolve(root, "about.html"),
            },
            output: {
                inlineDynamicImports: false,
            },
        },
    },
    resolve: {
        alias: {
            $lib: resolve(root, "src/lib"),
        },
    },
});
