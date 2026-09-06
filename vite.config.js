import { defineConfig } from "vite";
import { templatesPlugin } from "./scripts/templates-plugin.mjs";

export default defineConfig({
  plugins: [templatesPlugin()],
  root: ".",
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/chart.js")) return "vendor-chart";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("src/js/modules/charts.js")) return "charts-view";
        },
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
