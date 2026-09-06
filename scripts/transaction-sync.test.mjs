import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

// Ejecutar el módulo real con transporte y toasts controlados, sin credenciales.
const bundle = await build({
  stdin: { contents: `export * from './src/js/supabase.js'; export * from './src/js/state.js';
    export * from './src/js/storage.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "browser",
  plugins: [{ name: "test-adapters", setup(builder) {
    builder.onResolve({ filter: /^(\.\/config\.js|\.\/ui\.js|@supabase\/supabase-js)$/ },
      ({ path }) => ({ path, namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents:
      path.includes("config") ? `export const ENV = {supabaseUrl:'https://example.test',supabaseKey:'test'}; export const isSupabaseConfigured = () => true;` :
      path.includes("ui") ? `export const mostrarToast = (...args) => globalThis.__toasts.push(args);` :
      `export const createClient = () => globalThis.__syncClient;`, loader: "js" }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const userId = "11111111-1111-4111-8111-111111111111";
let db;

function makeClient() {
  const client = {
    rows: new Map(), failRead: false, failWrite: false, beforeWrite: null, pages: 0,
    auth: { getSession: async () => ({ data: { session: { user: { id: userId, is_anonymous: false } } }, error: null }) },
    from(table) {
      assert.equal(table, "transacciones");
      let mode = "select", payload, range, head;
      const filters = {};
      const query = {
        select(columns, options) { head = options?.head; return query; },
        order() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        range(start, end) { range = [start, end]; return query; },
        upsert(data) { mode = "upsert"; payload = data; return query; },
        update(data) { mode = "update"; payload = data; return query; },
        delete() { mode = "delete"; return query; },
        async then(resolve, reject) {
          try {
            if (mode === "select") {
              if (client.failRead) return resolve({ error: new Error("network unavailable"), data: null });
              if (head) return resolve({ error: null, data: null });
              assert.equal(filters.user_id, userId);
              client.pages++;
              return resolve({ error: null, data: [...client.rows.values()].slice(range[0], range[1] + 1) });
            }
            if (client.failWrite) return resolve({ error: new Error("offline"), data: null });
            await client.beforeWrite?.();
            if (mode === "upsert") {
              assert.equal(payload.user_id, userId);
              client.rows.set(payload.id, structuredClone(payload));
            } else {
              assert.equal(filters.user_id, userId);
              if (mode === "delete") client.rows.delete(filters.id);
              if (mode === "update" && client.rows.has(filters.id)) {
                client.rows.set(filters.id, { ...client.rows.get(filters.id), ...payload });
              }
            }
            resolve({ error: null, data: client.rows.has(filters.id) ? [{ id: filters.id }] : [] });
          } catch (error) { reject(error); }
        },
      };
      return query;
    },
  };
  return client;
}
beforeEach(async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.__toasts = [];
  globalThis.__syncClient = db = makeClient();
  api.definirAlcanceStorage(userId);
  api.setState({ userId, transactions: [] });
  await api.inicializarSupabase();
});

test("un movimiento sin conexión conserva su contenido y se sube al reconectar", async () => {
  const tx = { id: "one", monto: 300000, tipo: "ingreso", fecha: "2026-09-05" };
  api.setState({ transactions: [tx] });
  db.failWrite = true;
  assert.equal(await api.guardarTransaccionSupabase(tx), false);
  assert.deepEqual(api.listarPendientes()[0].data, tx);
  db.failWrite = false;
  assert.equal(await api.sincronizarPendientes(), true);
  assert.equal(db.rows.get(tx.id).monto, 300000);
  assert.deepEqual(api.listarPendientes(), []);
});

test("una edición durante el envío no se elimina de la cola por la respuesta anterior", async () => {
  let release, started;
  const entered = new Promise((resolve) => { started = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  db.beforeWrite = async () => { started(); await gate; };
  const tx = { id: "one", monto: 1 };
  api.setState({ transactions: [tx] });
  const first = api.guardarTransaccionSupabase(tx);
  await entered;
  api.setState({ transactions: [{ ...tx, monto: 2 }] });
  const second = api.actualizarTransaccionSupabase(tx.id, { monto: 2 });
  release();
  await Promise.all([first, second]);
  assert.equal(api.listarPendientes()[0].data.monto, 2);
  await api.sincronizarPendientes();
  assert.equal(db.rows.get(tx.id).monto, 2);
  assert.deepEqual(api.listarPendientes(), []);
});

test("una consulta fallida lanza error y una cuenta vacía devuelve un arreglo vacío", async () => {
  db.failRead = true;
  await assert.rejects(api.obtenerTransaccionesSupabase(), /network unavailable/);
  db.failRead = false;
  assert.deepEqual(await api.obtenerTransaccionesSupabase(), []);
});

test("la consulta pagina todos los movimientos y filtra por cuenta", async () => {
  for (let i = 0; i < 1001; i++) db.rows.set(String(i), { id: String(i), user_id: userId });
  assert.equal((await api.obtenerTransaccionesSupabase()).length, 1001);
  assert.equal(db.pages, 3);
});

test("eliminar y deshacer restauran también la copia compartida", async () => {
  const tx = { id: "one", monto: 100000 };
  db.rows.set(tx.id, tx);
  await api.eliminarTransaccionSupabase(tx.id);
  assert.equal(db.rows.has(tx.id), false);
  await api.guardarTransaccionSupabase(tx);
  assert.equal(db.rows.get(tx.id).monto, 100000);
});
