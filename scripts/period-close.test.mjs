import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  stdin: { contents: `export * from './src/js/modules/periods.js'; export * from './src/js/modules/dashboard.js';
    export * from './src/js/state.js'; export * from './src/js/storage.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "browser", format: "esm", loader: { ".svg": "dataurl" },
  plugins: [{ name: "test-ui", setup(builder) {
    builder.onResolve({ filter: /\/ui\.js$/ }, ({ path }) => ({ path, namespace: "test-ui" }));
    builder.onLoad({ filter: /.*/, namespace: "test-ui" }, () => ({ contents:
      `export const mostrarToast = () => {}; export const actualizarContenido = () => {}; export const initializarIconos = () => {};` }));
  } }],
});
const api = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
const transactions = [
  { id: "income", fecha: "2026-08-06", tipo: "ingreso", categoria: "sueldo", monto: 1364000, detalle: "Ingreso del mes" },
  { id: "expense", fecha: "2026-09-05", tipo: "egreso", categoria: "compras", monto: 759000, detalle: "Gastos del mes" },
  { id: "older", fecha: "2026-08-05", tipo: "ingreso", categoria: "sueldo", monto: 900000, detalle: "Otro periodo" },
];
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  globalThis.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
  globalThis.window = { dispatchEvent: () => {} };
  api.definirAlcanceStorage("period-test");
  api.setState({ transactions: structuredClone(transactions), currentPeriodStart: "2026-08-06", currentPeriodEnd: "2026-09-05",
    periodDay: 5, periodHistory: [], savings: 100000, debt: 0, customCategories: [],
    filtroHistorial: "egreso", filtroFechaInicio: "2026-08-06", filtroFechaFin: "2026-09-05", busquedaTexto: "mes", paginaActual: 3 });
});

test("cerrar deja ingresos, gastos y balance en cero y suma el sobrante al ahorro", () => {
  api.cerrarPeriodo();
  assert.deepEqual(api.calcularSaldosPeriodo(), { ingresos: 0, egresos: 0, balance: 0 });
  assert.equal(api.obtenerResumenPeriodo().balance, 0);
  assert.equal(api.getState().savings, 705000);
  assert.equal(api.getState().currentPeriodStart, "2026-09-06");
  assert.equal(api.getState().currentPeriodEnd, "2026-10-05");
  assert.equal(api.getState().transactions.length, 3);
  assert.equal(api.getState().filtroFechaInicio, null);
  assert.equal(api.getState().filtroFechaFin, null);
  assert.equal(api.getState().busquedaTexto, "");
  assert.equal(api.getState().paginaActual, 1);
});

test("el historial guarda todos los movimientos del mes, sus totales y el ahorro", () => {
  api.cerrarPeriodo();
  const [entry] = api.getState().periodHistory;
  assert.deepEqual(entry.transactions.map((tx) => tx.id), ["income", "expense"]);
  assert.equal(entry.totalIngresos, 1364000);
  assert.equal(entry.totalEgresos, 759000);
  assert.equal(entry.balance, 605000);
  assert.equal(entry.savingsAdded, 605000);
  assert.equal(entry.savingsAfter, 705000);
  assert.equal(entry.transactionCount, 2);
  assert.deepEqual(api.obtenerPeriodoStorage().periodHistory, [entry]);
});

test("editar o eliminar el registro original no cambia la copia del cierre", () => {
  api.cerrarPeriodo();
  api.updateTransaction("income", { monto: 1, detalle: "Editado" });
  api.deleteTransaction("expense");
  const [entry] = api.obtenerResumenPeriodo().periodHistory;
  assert.equal(entry.transactions[0].monto, 1364000);
  assert.equal(entry.transactions[0].detalle, "Ingreso del mes");
  assert.equal(entry.transactions.length, 2);
  assert.equal(entry.hasSnapshot, true);
});

test("el ahorro se acumula entre meses y no se cuenta como ingreso del siguiente", () => {
  api.cerrarPeriodo();
  api.addTransaction({ id: "next", fecha: "2026-09-06", tipo: "ingreso", categoria: "sueldo", monto: 50000 });
  assert.deepEqual(api.calcularSaldosPeriodo(), { ingresos: 50000, egresos: 0, balance: 50000 });
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 755000);
  assert.equal(api.getState().periodHistory.length, 2);
  assert.deepEqual(api.calcularSaldosPeriodo(), { ingresos: 0, egresos: 0, balance: 0 });
});

test("un déficit no aumenta el ahorro y el nuevo periodo empieza en cero", () => {
  api.setState({ transactions: [transactions[1]] });
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 100000);
  assert.equal(api.getState().debt, 759000);
  assert.equal(api.getState().periodHistory[0].savingsAdded, 0);
  assert.deepEqual(api.calcularSaldosPeriodo(), { ingresos: 0, egresos: 0, balance: 0 });
});

test("restaurar un periodo ya cerrado no permite acumular el ahorro dos veces", () => {
  api.cerrarPeriodo();
  api.setState({ currentPeriodStart: "2026-08-06", currentPeriodEnd: "2026-09-05" });
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 705000);
  assert.equal(api.getState().periodHistory.length, 1);
});

test("un cierre antiguo muestra sus movimientos disponibles sin inventar una copia", () => {
  api.setState({ periodHistory: [{ start: "2026-08-06", end: "2026-09-05", balance: 605000 }] });
  const [entry] = api.obtenerResumenPeriodo().periodHistory;
  assert.equal(entry.hasSnapshot, false);
  assert.equal(entry.transactions.length, 2);
});

test("el cambio de año conserva los límites del periodo y el historial al recargar", () => {
  api.setState({ currentPeriodStart: "2026-12-06", currentPeriodEnd: "2027-01-05", transactions: [] });
  api.cerrarPeriodo();
  api.inicializarPeriodo();
  assert.equal(api.getState().currentPeriodStart, "2027-01-06");
  assert.equal(api.getState().currentPeriodEnd, "2027-02-05");
  assert.equal(api.getState().periodHistory.length, 1);
  assert.equal(api.getState().savings, 100000);
});
