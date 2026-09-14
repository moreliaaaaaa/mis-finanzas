import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Lógica real de gráficos; el adaptador detecta si dos instancias usan el mismo canvas.
const bundle = await build({
  stdin: { contents: `export * from './src/js/modules/charts.js'; export * from './src/js/state.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "browser",
  plugins: [{ name: "chart-adapter", setup(builder) {
    builder.onResolve({ filter: /^chart\.js\/auto$/ }, ({ path }) => ({ path, namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
      export default class Chart {
        constructor(canvas, config) {
          if (globalThis.__activeCharts.has(canvas.id)) throw new Error('Canvas is already in use');
          this.canvas = canvas; this.config = config;
          globalThis.__activeCharts.set(canvas.id, this);
        }
        destroy() { globalThis.__activeCharts.delete(this.canvas.id); }
      }`, loader: "js" }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const renderAll = () => Promise.all([
  api.actualizarGraficoEgresos(), api.renderizarGraficoTendencia(), api.renderizarGraficoComparativa(),
]);

beforeEach(() => {
  api.destruirGraficos();
  globalThis.__activeCharts = new Map();
  const elements = new Map();
  globalThis.document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { id, style: {}, classList: { add() {}, remove() {} } });
    return elements.get(id);
  } };
  api.setState({ transactions: [
    { tipo: "egreso", categoria: "agua", monto: 20, fecha: "2026-08-01" },
    { tipo: "ingreso", categoria: "ingreso_general", monto: 100, fecha: "2026-09-01" },
  ], customCategories: [] });
});

test("cambios rápidos de pestaña crean una sola instancia por canvas", async () => {
  await Promise.all([renderAll(), renderAll(), renderAll()]);
  assert.equal(globalThis.__activeCharts.size, 3);
  api.setState({ transactions: [{ tipo: "egreso", categoria: "agua", monto: 45, fecha: "2026-09-01" }] });
  await Promise.all([renderAll(), renderAll()]);
  assert.equal(globalThis.__activeCharts.size, 2);
  assert.deepEqual(globalThis.__activeCharts.get("chart-egresos-container").config.data.datasets[0].data, [45]);
});

test("vaciar datos mientras carga Chart.js cancela el render anterior", async () => {
  const pending = renderAll();
  api.setState({ transactions: [] });
  await renderAll();
  await pending;
  assert.equal(globalThis.__activeCharts.size, 0);
});

test("destruir gráficos cancela también los renderizados pendientes", async () => {
  const pending = renderAll();
  api.destruirGraficos();
  await pending;
  assert.equal(globalThis.__activeCharts.size, 0);
});
