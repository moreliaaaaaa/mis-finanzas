import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const swPath = path.join(distDir, "sw.js");

const PRECACHE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".png",
  ".svg",
  ".webmanifest",
]);

async function listarArchivos(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listarArchivos(fullPath);
      if (!entry.isFile()) return [];
      return [fullPath];
    })
  );

  return files.flat();
}

function toPublicUrl(filePath) {
  const relativePath = path.relative(distDir, filePath).split(path.sep).join("/");
  return `/${relativePath}`;
}

function debePrecachear(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  return fileName !== "sw.js" && PRECACHE_EXTENSIONS.has(ext);
}

const sw = await readFile(swPath, "utf8");
const files = (await listarArchivos(distDir))
  .filter(debePrecachear)
  .map(toPublicUrl)
  .sort();

const buildId = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
const manifest = files.map((url) => `  ${JSON.stringify(url)},`).join("\n");

const nextSw = sw
  .replace("__BUILD_ID__", `v6-${buildId}`)
  .replace("  // __BUILD_PRECACHE_URLS__", manifest);

await writeFile(swPath, nextSw);

console.log(`SW precache actualizado: ${files.length} recursos, build ${buildId}`);
