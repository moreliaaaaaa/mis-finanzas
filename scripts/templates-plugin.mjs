import { copyFileSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

// src/templates es la fuente; public/templates contiene copias generadas.
export function templatesPlugin() {
  let sourceDir;
  let outputDir;

  function syncTemplates() {
    const templates = readdirSync(sourceDir).filter((name) => name.endsWith(".html"));
    mkdirSync(outputDir, { recursive: true });
    for (const name of templates) {
      copyFileSync(path.join(sourceDir, name), path.join(outputDir, name));
    }
    for (const name of readdirSync(outputDir)) {
      if (name.endsWith(".html") && !templates.includes(name)) {
        unlinkSync(path.join(outputDir, name));
      }
    }
    writeFileSync(path.join(outputDir, "README.txt"),
      "CARPETA GENERADA AUTOMATICAMENTE.\nEdita las plantillas en src/templates/.\nLos cambios aqui se sobrescriben con npm run dev o npm run build.\n");
  }

  return {
    name: "sync-templates",
    configResolved(config) {
      sourceDir = path.resolve(config.root, "src/templates");
      outputDir = path.resolve(config.publicDir, "templates");
      syncTemplates();
    },
    configureServer(server) {
      server.watcher.add(sourceDir);
      const onChange = (event, file) => {
        if (!["add", "change", "unlink"].includes(event)) return;
        if (path.dirname(path.resolve(file)) !== sourceDir || !file.endsWith(".html")) return;
        syncTemplates();
        server.ws.send({ type: "full-reload", path: "*" });
      };
      server.watcher.on("all", onChange);
      server.httpServer?.once("close", () => server.watcher.off("all", onChange));
    },
  };
}
