import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

// Auth, estado y storage reales; solo se sustituyen UI y transporte de red.
const bundle = await build({
  stdin: { contents: `export * from './src/js/modules/auth.js';
    export * from './src/js/state.js'; export * from './src/js/storage.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "browser",
  plugins: [{ name: "account-adapters", setup(builder) {
    builder.onResolve({ filter: /(?:ui|supabase|dashboard|utils)\.js$/ }, ({ path }) => ({ path, namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents:
      path.endsWith("supabase.js") ? `export const getSupabaseClient = () => globalThis.__client;` :
      path.endsWith("dashboard.js") ? `export const recalcularYRenderizar = () => {};` :
      path.endsWith("utils.js") ? `export const escapeHTML = x => x;` :
      `export const mostrarToast = () => {}; export const initializarIconos = () => {};`, loader: "js" }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const movimiento = { id: "privado-A", monto: 100, tipo: "ingreso", fecha: "2026-09-14" };
beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.__client = null;
  api.definirAlcanceStorage(null);
  api.setState({ ...api.estadoFinancieroVacio(), userId: null });
});

for (const cloud of [false, true]) {
  test(`salir de A conserva su respaldo y B queda vacío (${cloud ? "nube" : "local offline"})`, () => {
    globalThis.__client = cloud ? { auth: { signOut: async () => ({ error: null }) } } : null;
    api.definirAlcanceStorage("cuenta-A");
    api.setState({ userId: "cuenta-A", transactions: [movimiento], savings: 500,
      debt: 20, periodHistory: [{ balance: 500 }], customCategories: [{ id: "privada" }],
      presupuestos: { septiembre: { limite: 100 } }, savingsTransfers: [{ monto: 10 }] });
    api.guardarEnStorage("transactions", [movimiento]);
    api.guardarEnStorage("pendientes", [{ id: movimiento.id, accion: "insert" }]);
    // Incluso un suscriptor sin guardia no puede escribir durante el cierre.
    const stop = api.subscribe(s => {
      api.guardarEnStorage("transactions", s.transactions);
      api.guardarPeriodoStorage({ savings: s.savings });
    });
    try {
      api.cerrarSesion();
      assert.equal(api.getState().userId, null);
      for (const [key, value] of Object.entries(api.estadoFinancieroVacio())) {
        assert.deepEqual(api.getState()[key], value, key);
      }
      assert.equal(localStorage.getItem("misfinanzas_data_transactions"), null);
      assert.equal(localStorage.getItem("misfinanzas_period"), null);
      api.guardarEnStorage("misfinanzas_session", { userId: "cuenta-B" });
      api.inicializarAuth();
      assert.deepEqual(api.getState().transactions, []);
      assert.equal(api.obtenerDelStorage("pendientes"), null);
      assert.deepEqual(api.obtenerPeriodoStorage(), { savings: 0 });
      api.definirAlcanceStorage("cuenta-A");
      assert.deepEqual(api.obtenerDelStorage("transactions"), [movimiento]);
      assert.equal(api.obtenerDelStorage("pendientes").length, 1);
    } finally { stop(); }
  });
}

test("sin cuenta no se leen ni escriben datos financieros globales", () => {
  localStorage.setItem("misfinanzas_data_transactions", JSON.stringify([movimiento]));
  localStorage.setItem("misfinanzas_period", JSON.stringify({ savings: 500 }));
  assert.equal(api.obtenerDelStorage("transactions"), null);
  assert.equal(api.obtenerPeriodoStorage(), null);
  assert.equal(api.guardarEnStorage("pendientes", []), false);
  assert.equal(api.guardarEnStorage("transactions", []), false);
  assert.equal(api.guardarPeriodoStorage({ savings: 0 }), false);
  assert.equal(api.eliminarDelStorage("transactions"), false);
  assert.equal(api.eliminarPeriodoStorage(), false);
  assert.equal(api.guardarEnStorage("misfinanzas_session", { userId: "B" }), true);
  assert.deepEqual(JSON.parse(localStorage.getItem("misfinanzas_data_transactions")), [movimiento]);
});

test("el arranque no contiene el fallback de movimientos sin propietario", async () => {
  const source = await readFile(new URL("../src/js/app.js", import.meta.url), "utf8");
  assert.ok(!source.includes('localStorage.getItem("misfinanzas_data_transactions")'));
  localStorage.setItem("misfinanzas_data_transactions", JSON.stringify([movimiento]));
  api.definirAlcanceStorage("cuenta-B");
  assert.equal(api.obtenerDelStorage("transactions"), null);
});

test("recuperar el respaldo antiguo requiere confirmación y se permite una sola vez", () => {
  localStorage.setItem("misfinanzas_data_transactions", JSON.stringify([movimiento]));
  api.definirAlcanceStorage("cuenta-A");
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-A" }), false);
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-B", confirmarPropiedad: true }), false);
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-A", confirmarPropiedad: true }), true);
  assert.deepEqual(api.obtenerDelStorage("transactions"), [movimiento]);
  api.eliminarDelStorage("transactions");
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-A", confirmarPropiedad: true }), false);
  api.definirAlcanceStorage("cuenta-B");
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-B", confirmarPropiedad: true }), false);
  assert.equal(api.obtenerDelStorage("transactions"), null);
});

test("la recuperación manual no sobrescribe movimientos existentes", () => {
  localStorage.setItem("misfinanzas_data_transactions", JSON.stringify([movimiento]));
  api.definirAlcanceStorage("cuenta-B");
  const propios = [{ ...movimiento, id: "privado-B" }];
  api.guardarEnStorage("transactions", propios);
  assert.equal(api.migrarMovimientosAntiguos({ userId: "cuenta-B", confirmarPropiedad: true }), false);
  assert.deepEqual(api.obtenerDelStorage("transactions"), propios);
});
