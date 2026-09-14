import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";

// Contrato independiente del código del cliente: columnas del SQL versionado.
const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
const tableDefinition = schema.match(/create table if not exists public\.transacciones \(([\s\S]*?)\n\);/i)?.[1];
assert.ok(tableDefinition, "No se encontró la tabla transacciones en schema.sql");
const schemaColumns = new Set([...tableDefinition.matchAll(/^\s*(\w+)\s+(?:uuid|text|numeric|date|timestamptz)\b/gm)].map(match => match[1]));
assert.ok(schemaColumns.has("created_at"));

// Ejecutar el módulo real con transporte y toasts controlados, sin credenciales.
const bundle = await build({
  stdin: { contents: `export * from './src/js/supabase.js'; export * from './src/js/state.js';
    export * from './src/js/storage.js'; export * from './src/js/modules/transactions.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: "esm", platform: "browser",
  plugins: [{ name: "test-adapters", setup(builder) {
    builder.onResolve({ filter: /(?:\/(?:config|ui|dashboard)\.js$|^@supabase\/supabase-js$)/ },
      ({ path }) => ({ path, namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents:
      path.includes("config") ? `export const ENV = {supabaseUrl:'https://example.test',supabaseKey:'test'}; export const APP_CONFIG = {}; export const isSupabaseConfigured = () => true;` :
      path.includes("dashboard") ? `export const recalcularYRenderizar = () => {};` :
      path.includes("ui") ? `export const mostrarToast = (...args) => globalThis.__toasts.push(args);
        export const obtenerValorInput = key => globalThis.__form[key] || '';
        export const establecerValorInput = (key, value) => { globalThis.__form[key] = value; };
        export const limpiarFormulario = () => {};
        export const mostrarCargandoBoton = () => {};
        export const ocultarCargandoBoton = () => {};
        export const cambiarVista = view => { globalThis.__view = view; };` :
      `export const createClient = () => globalThis.__syncClient;`, loader: "js" }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const userId = "11111111-1111-4111-8111-111111111111";
let db;

function makeClient() {
  const client = {
    rows: new Map(), writes: [], failRead: false, failWrite: false, beforeWrite: null, pages: 0,
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
            if (payload) {
              const unknown = Object.keys(payload).filter(key => !schemaColumns.has(key));
              if (unknown.length) return resolve({ error: new Error(`Columnas fuera del esquema: ${unknown.join(", ")}`), data: null });
              client.writes.push({ mode, payload: structuredClone(payload) });
            }
            await client.beforeWrite?.();
            if (mode === "upsert") {
              assert.equal(payload.user_id, userId);
              client.rows.set(payload.id, {
                created_at: "2026-09-14T12:00:00.000Z", ...client.rows.get(payload.id), ...structuredClone(payload),
              });
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
  globalThis.__form = {};
  globalThis.__view = null;
  globalThis.document = { getElementById: () => null };
  globalThis.__syncClient = db = makeClient();
  api.definirAlcanceStorage(userId);
  api.setState({ userId, transactions: [], tipoActivoForm: "egreso", customCategories: [] });
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

test("crear y editar desde el formulario respeta schema.sql y conserva created_at", async () => {
  globalThis.__form = { "#categoria": "agua", "#monto": "125.50", "#fecha": "2026-09-14", "#detalle": "Pago de agua" };
  await api.guardarRegistro();
  const tx = api.getState().transactions[0];
  assert.ok(tx?.id, "El formulario debe crear el movimiento");
  assert.equal(Object.hasOwn(tx, "timestamp"), false);
  assert.equal(api.listarPendientes().length, 0);
  assert.equal(db.rows.get(tx.id)?.monto, 125.5);
  const createdAt = db.rows.get(tx.id).created_at;

  // Simular la lectura remota antes de editar: ni created_at ni metadatos
  // antiguos deben convertirse en campos editables enviados por el formulario.
  api.setState({ transactions: [{ ...db.rows.get(tx.id), timestamp: "2020-01-01T00:00:00Z" }] });
  api.editarRegistro(tx.id);
  assert.equal(globalThis.__view, "registro");
  assert.equal(globalThis.__form["#edit-id"], tx.id);
  globalThis.__form = { "#edit-id": tx.id, "#categoria": "agua", "#monto": "150.75", "#fecha": "2026-09-15", "#detalle": "Pago corregido" };
  await api.guardarRegistro();
  assert.equal(db.rows.get(tx.id).monto, 150.75);
  assert.equal(db.rows.get(tx.id).fecha, "2026-09-15");
  assert.equal(db.rows.get(tx.id).created_at, createdAt);
  assert.deepEqual(db.writes.map(write => write.mode), ["upsert", "update"]);
  for (const { payload } of db.writes) {
    assert.equal(Object.hasOwn(payload, "timestamp"), false);
    assert.equal(Object.hasOwn(payload, "created_at"), false);
  }
  assert.deepEqual(api.listarPendientes(), []);
});

test("los pendientes antiguos con timestamp se reenvían sin modificar sus datos locales", async () => {
  const timestamp = "2026-09-01T10:00:00Z";
  const insert = { id: "legacy-insert", tipo: "egreso", categoria: "agua", monto: 10, fecha: "2026-09-01", detalle: "Sin conexión", timestamp };
  const update = { ...insert, id: "legacy-update", monto: 20, created_at: "2026-08-01T00:00:00Z" };
  db.rows.set(update.id, { ...update, monto: 5 });
  api.setState({ transactions: [insert, update] });
  api.guardarEnStorage("pendientes", [
    { accion: "insert", id: insert.id, data: insert, token: "old-insert" },
    { accion: "update", id: update.id, data: update, token: "old-update" },
  ]);
  assert.equal(await api.sincronizarPendientes(), true);
  assert.equal(db.rows.get(insert.id).monto, 10);
  assert.equal(db.rows.get(update.id).monto, 20);
  assert.equal(db.rows.get(update.id).created_at, update.created_at);
  assert.deepEqual(api.getState().transactions, [insert, update]);
  assert.deepEqual(api.listarPendientes(), []);
});
