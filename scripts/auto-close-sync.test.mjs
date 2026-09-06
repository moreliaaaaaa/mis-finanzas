import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  stdin: { contents: `export * from './src/js/modules/cloud-sync.js'; export * from './src/js/state.js'; export * from './src/js/storage.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "esm", loader: { ".svg": "dataurl" },
  plugins: [{ name: "sync-fixture", setup(builder) {
    builder.onResolve({ filter: /\/(ui|supabase|config|period-sync)\.js$/ }, ({ path }) => ({ path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents:
      path.endsWith("ui.js") ? `export const mostrarToast = () => {}; export const actualizarContenido = () => {}; export const initializarIconos = () => {};` :
      path.endsWith("config.js") ? `export const APP_CONFIG = {}; export const isSupabaseConfigured = () => globalThis.fixture.configured;` :
      path.endsWith("period-sync.js") ? `export const sincronizarPeriodoCuenta = (...args) => globalThis.fixture.syncPeriod(...args);` :
      `export const getSupabaseClient = () => globalThis.fixture.client;
       export const obtenerTransaccionesSupabase = () => globalThis.fixture.readTransactions();
       export const sincronizarPendientes = async () => {};
       export const listarPendientes = () => globalThis.fixture.pending;` }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
const userId = "auto-test";
let fixture;
beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  globalThis.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
  globalThis.window = { dispatchEvent: () => {} };
  fixture = globalThis.fixture = {
    configured: true,
    client: { auth: { getSession: async () => ({ data: { session: { user: { id: userId } } } }) } },
    pending: [], calls: 0, sequence: [],
    readTransactions: async () => {
      fixture.sequence.push("transactions");
      return [{ id: "remote", fecha: "2020-08-06", tipo: "ingreso", monto: 300000 }];
    },
    syncPeriod: async () => {
      fixture.sequence.push("period");
      fixture.calls++;
      api.guardarEnStorage("period_sync", { revision: fixture.calls, pending: false });
      return { changed: false };
    },
  };
  api.definirAlcanceStorage(userId);
  const saved = { periodDay: 4, currentPeriodStart: "2020-08-05", currentPeriodEnd: "2020-09-04", savings: 100000, debt: 0, periodHistory: [] };
  api.setState({ userId, ...saved, transactions: [{ id: "local-old", fecha: "2020-08-06", tipo: "ingreso", monto: 1 }], customCategories: [] });
  api.guardarPeriodoStorage(saved, { revision: 1, pending: false });
});

test("abrir con nube carga movimientos antes de cerrar y guarda el cierre compartido", async () => {
  await api.sincronizarCuenta();
  assert.equal(api.getState().savings, 400000);
  assert.equal(api.getState().periodHistory.at(-1).balance, 300000);
  assert.deepEqual(fixture.sequence, ["transactions", "period", "period"]);
  const count = api.getState().periodHistory.length;
  await api.sincronizarCuenta();
  assert.equal(api.getState().periodHistory.length, count);
  assert.equal(api.getState().savings, 400000);
});

test("un fallo de nube no archiva con el respaldo incompleto", async () => {
  fixture.readTransactions = async () => { throw new Error("offline"); };
  await api.sincronizarCuenta();
  assert.equal(api.getState().savings, 100000);
  assert.deepEqual(api.getState().periodHistory, []);
});

test("si hay movimientos pendientes, el cierre espera", async () => {
  fixture.pending = [{ accion: "insert", id: "local-old" }];
  await api.sincronizarCuenta();
  assert.deepEqual(api.getState().periodHistory, []);
  assert.equal(fixture.calls, 1);
});

test("sin conexión no se consolida el cierre de una cuenta en la nube", async () => {
  navigator.onLine = false;
  await api.sincronizarCuenta();
  assert.deepEqual(api.getState().periodHistory, []);
  assert.deepEqual(fixture.sequence, []);
});

test("en modo local el arranque avanza automáticamente con sus propios movimientos", async () => {
  fixture.configured = false;
  fixture.client = null;
  await api.sincronizarCuenta();
  assert.equal(api.getState().savings, 100001);
  assert.ok(api.getState().periodHistory.length > 0);
  assert.deepEqual(fixture.sequence, []);
});
