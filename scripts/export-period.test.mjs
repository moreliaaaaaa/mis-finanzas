import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export { obtenerDatosPeriodoActual, obtenerDatosPeriodoHistorico } from './src/js/modules/export.js';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  plugins: [{
    name: "export-period-adapters",
    setup(builder) {
      builder.onResolve({ filter: /(?:ui|constants|utils)\.js$/ }, ({ path }) => ({ path, namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
        contents: path.endsWith("constants.js")
          ? "export const CATEGORIAS = { ingreso: [], egreso: [] }; export const MENSAJES = { error: { noHayDatos: '' }, success: { descargar: '' } };"
          : path.endsWith("utils.js")
            ? "export const escapeHTML = value => String(value ?? ''); export const formatMoneda = value => String(value); export const formatearFechaTexto = value => value; export const obtenerFechaHoy = () => '2026-09-14';"
            : "export const mostrarToast = () => {};",
        loader: "js",
      }));
    },
  }],
});

const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));

test("las exportaciones seleccionan solo el periodo actual", () => {
  const state = {
    periodDay: 5,
    currentPeriodStart: "2026-09-06",
    currentPeriodEnd: "2026-10-05",
    transactions: [
      { id: "actual", fecha: "2026-09-14" },
      { id: "anterior", fecha: "2026-09-05" },
      { id: "siguiente", fecha: "2026-10-06" },
    ],
    savingsTransfers: [
      { id: "transferencia-actual", fecha: "2026-09-20" },
      { id: "transferencia-anterior", fecha: "2026-09-05" },
    ],
  };

  const result = api.obtenerDatosPeriodoActual(state, new Date(2026, 8, 14));

  assert.deepEqual(result.transactions.map(({ id }) => id), ["actual"]);
  assert.deepEqual(result.savingsTransfers.map(({ id }) => id), ["transferencia-actual"]);
});

test("la exportacion historica usa la instantanea del cierre", () => {
  const entry = {
    start: "2026-08-06",
    end: "2026-09-05",
    transactions: [{ id: "cerrado", fecha: "2026-09-01" }],
    savingsTransfers: [{ id: "transferencia-cerrada", fecha: "2026-09-05" }],
  };
  const state = {
    transactions: [{ id: "actual", fecha: "2026-09-14" }],
    savingsTransfers: [],
  };

  const result = api.obtenerDatosPeriodoHistorico(entry, state);

  assert.deepEqual(result.transactions.map(({ id }) => id), ["cerrado"]);
  assert.deepEqual(result.savingsTransfers.map(({ id }) => id), ["transferencia-cerrada"]);
});
