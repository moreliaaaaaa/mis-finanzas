import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getState, setState } from "../src/js/state.js";
import { definirAlcanceStorage, guardarPeriodoStorage, obtenerPeriodoStorage, obtenerDelStorage, guardarEnStorage } from "../src/js/storage.js";
import { sincronizarPeriodoCuenta } from "../src/js/modules/period-sync.js";
import { fusionarMovimientos, periodoValido } from "../src/js/modules/sync-core.js";

const userId = "11111111-1111-4111-8111-111111111111";
const period = (day = 5) => ({ periodDay: day, savings: 0, debt: 0,
  currentPeriodStart: `2026-08-${String(day + 1).padStart(2, "0")}`,
  currentPeriodEnd: `2026-09-${String(day).padStart(2, "0")}`, periodHistory: [] });
function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}
function database(initial = null, hooks = {}) {
  let row = structuredClone(initial);
  return {
    get row() { return row; },
    set row(value) { row = value; },
    from(name) {
      assert.equal(name, "periodos_financieros");
      let update;
      const filters = {};
      const query = {
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        update(value) { update = value; return query; },
        async maybeSingle() {
          assert.equal(filters.user_id, userId);
          if (hooks.readError && !update) return { data: null, error: new Error("offline") };
          if (update) {
            hooks.beforeUpdate?.();
            if (row.revision !== filters.revision) return { data: null, error: null };
            row = structuredClone(update);
            hooks.afterUpdate?.();
          }
          return { data: structuredClone(row), error: null };
        },
        async upsert(value, options) {
          assert.equal(options.ignoreDuplicates, true);
          hooks.beforeInsert?.();
          row ||= { datos: value.datos, revision: value.revision };
          return { error: null };
        },
      };
      return query;
    },
  };
}
beforeEach(() => {
  globalThis.localStorage = storage();
  definirAlcanceStorage(userId);
  setState({ userId, ...period(), transactions: [] });
});

test("dos dispositivos con fechas diferentes adoptan el mismo período y conservan respaldo", async () => {
  const db = database();
  guardarPeriodoStorage(period());
  await sincronizarPeriodoCuenta(db, userId);
  globalThis.localStorage = storage();
  guardarPeriodoStorage(period(4));
  setState(period(4));
  await sincronizarPeriodoCuenta(db, userId);
  assert.deepEqual(obtenerPeriodoStorage(), period());
  assert.equal(getState().currentPeriodEnd, "2026-09-05");
  assert.deepEqual(obtenerDelStorage("period_backups")[0].datos, period(4));
});

test("cambiar el cierre actualiza la revisión compartida", async () => {
  const db = database({ datos: period(), revision: 1 });
  guardarPeriodoStorage(period(), { revision: 1, pending: false });
  guardarPeriodoStorage(period(10));
  await sincronizarPeriodoCuenta(db, userId);
  assert.deepEqual(db.row, { datos: period(10), revision: 2 });
  assert.equal(obtenerDelStorage("period_sync").pending, false);
});

test("un cierre atrasado no sobrescribe un cierre realizado en otro dispositivo", async () => {
  const closed = { ...period(), savings: 605000, currentPeriodStart: "2026-09-06", currentPeriodEnd: "2026-10-05",
    periodHistory: [{ start: "2026-08-06", end: "2026-09-05", balance: 605000 }] };
  const db = database({ datos: closed, revision: 2 });
  guardarPeriodoStorage(period(), { revision: 1, pending: false });
  guardarPeriodoStorage(period(4));
  const result = await sincronizarPeriodoCuenta(db, userId);
  assert.equal(result.conflict, true);
  assert.deepEqual(obtenerPeriodoStorage(), closed);
  assert.equal(db.row.revision, 2);
  assert.deepEqual(obtenerDelStorage("period_backups")[0].datos, period(4));
});

test("la comparación de revisión resuelve una carrera durante la escritura", async () => {
  const db = database({ datos: period(), revision: 1 }, {
    beforeUpdate: () => { db.row = { datos: period(20), revision: 2 }; },
  });
  guardarPeriodoStorage(period(10), { revision: 1, pending: true });
  await sincronizarPeriodoCuenta(db, userId);
  assert.deepEqual(db.row.datos, period(20));
  assert.deepEqual(obtenerPeriodoStorage(), period(20));
});

test("una edición durante el envío conserva su contenido y se sube después", async () => {
  const db = database({ datos: period(), revision: 1 }, {
    afterUpdate: () => guardarPeriodoStorage(period(15)),
  });
  guardarPeriodoStorage(period(10), { revision: 1, pending: true });
  await sincronizarPeriodoCuenta(db, userId);
  assert.deepEqual(obtenerPeriodoStorage(), period(15));
  assert.deepEqual(obtenerDelStorage("period_sync"), { revision: 2, pending: true });
});

test("un fallo de consulta conserva el período y sus pendientes", async () => {
  guardarPeriodoStorage(period(4));
  const before = obtenerDelStorage("period_sync");
  await assert.rejects(sincronizarPeriodoCuenta(database(null, { readError: true }), userId), /offline/);
  assert.deepEqual(obtenerPeriodoStorage(), period(4));
  assert.deepEqual(obtenerDelStorage("period_sync"), before);
});

test("una creación simultánea no reemplaza al primer período compartido", async () => {
  const db = database(null, { beforeInsert: () => { db.row = { datos: period(7), revision: 1 }; } });
  guardarPeriodoStorage(period(4));
  await sincronizarPeriodoCuenta(db, userId);
  assert.deepEqual(db.row.datos, period(7));
  assert.deepEqual(obtenerPeriodoStorage(), period(7));
});

test("los datos inválidos de la nube no reemplazan el respaldo", async () => {
  guardarPeriodoStorage(period());
  const db = database({ datos: { ...period(), currentPeriodEnd: "2026-02-30" }, revision: 1 });
  await assert.rejects(sincronizarPeriodoCuenta(db, userId), /no es válido/);
  assert.deepEqual(obtenerPeriodoStorage(), period());
  assert.equal(periodoValido({ ...period(), periodDay: 30 }), false);
});

test("una nube vacía elimina copias obsoletas pero conserva inserciones pendientes", () => {
  const pending = { id: "new", monto: 300000 };
  assert.deepEqual(fusionarMovimientos([], [{ id: "old" }, pending], [{ accion: "insert", id: "new" }]), [pending]);
  assert.deepEqual(fusionarMovimientos([], [{ id: "old" }], []), []);
});

test("refrescar conserva ediciones locales y no resucita eliminaciones pendientes", () => {
  const remote = [{ id: "a", monto: 1 }, { id: "b", monto: 2 }, { id: "c", monto: 3 }];
  const edited = { id: "a", monto: 100 };
  assert.deepEqual(fusionarMovimientos(remote, [edited], [
    { accion: "update", id: "a", data: edited }, { accion: "delete", id: "b" },
  ]), [edited, remote[2]]);
});

test("los metadatos de sincronización se aíslan por cuenta", () => {
  guardarEnStorage("period_sync", { revision: 99 });
  definirAlcanceStorage("22222222-2222-4222-8222-222222222222");
  assert.equal(obtenerDelStorage("period_sync"), null);
});
