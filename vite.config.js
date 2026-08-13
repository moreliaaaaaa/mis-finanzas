import { defineConfig } from "vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Los templates de public/ referencian /src/assets/*.svg con URL absolutas.
// Vite no copia src/assets al build, así que se copian manualmente a dist.
function copySrcAssets() {
  return {
    name: "copy-src-assets",
    apply: "build",
    closeBundle() {
      const outDir = resolve(__dirname, "dist/src/assets");
      mkdirSync(outDir, { recursive: true });
      cpSync(resolve(__dirname, "src/assets"), outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  root: ".",
  base: "/",
  plugins: [copySrcAssets()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        // Mantener estructura de rutas para assets
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith(".css")) {
            return "assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
