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

test("cierre el 4: el día 5 el inicio solo suma 300000 de ingreso y 100000 de gasto", () => {
  api.setState({ periodDay: 4, currentPeriodStart: "2026-08-05", currentPeriodEnd: "2026-09-04", transactions: [
    { id: "old-income", fecha: "2026-09-03", tipo: "ingreso", monto: 1064000 },
    { id: "old-expense", fecha: "2026-09-04", tipo: "egreso", monto: 659000 },
    { id: "new-income", fecha: "2026-09-05", tipo: "ingreso", monto: 300000 },
    { id: "new-expense", fecha: "2026-09-05", tipo: "egreso", monto: 100000 },
  ] });
  const now = new Date(2026, 8, 5, 0, 0, 0);
  assert.deepEqual(api.calcularSaldosPeriodo(now), { ingresos: 300000, egresos: 100000, balance: 200000 });
  assert.equal(api.cerrarPeriodosVencidos(now), 1);
  assert.equal(api.getState().currentPeriodStart, "2026-09-05");
  assert.equal(api.getState().currentPeriodEnd, "2026-10-04");
  assert.equal(api.getState().savings, 505000);
  assert.equal(api.getState().periodHistory[0].balance, 405000);
  assert.equal(api.getState().periodHistory[0].transactions.length, 2);
  assert.equal(api.getState().periodHistory[0].automatic, true);
  assert.deepEqual(api.calcularSaldosPeriodo(now), { ingresos: 300000, egresos: 100000, balance: 200000 });
  assert.equal(api.cerrarPeriodosVencidos(now), 0);
  assert.equal(api.getState().savings, 505000);
});

test("el día de cierre sigue incluido hasta medianoche local", () => {
  api.setState({ periodDay: 4, currentPeriodStart: "2026-08-05", currentPeriodEnd: "2026-09-04" });
  const now = new Date(2026, 8, 4, 23, 59, 59);
  assert.equal(api.cerrarPeriodosVencidos(now), 0);
  assert.deepEqual(api.calcularSaldosPeriodo(now), { ingresos: 2264000, egresos: 0, balance: 2264000 });
});

test("varios meses vencidos se archivan una vez cada uno sin saltar movimientos", () => {
  api.setState({ periodDay: 4, currentPeriodStart: "2026-06-05", currentPeriodEnd: "2026-07-04", transactions: [
    { id: "june", fecha: "2026-06-06", tipo: "ingreso", monto: 100 },
    { id: "july", fecha: "2026-07-05", tipo: "ingreso", monto: 200 },
    { id: "august", fecha: "2026-08-05", tipo: "ingreso", monto: 300 },
    { id: "september", fecha: "2026-09-05", tipo: "ingreso", monto: 400 },
  ] });
  assert.equal(api.cerrarPeriodosVencidos(new Date(2026, 8, 6)), 3);
  assert.equal(api.getState().savings, 100600);
  assert.deepEqual(api.getState().periodHistory.map((entry) => entry.balance), [300, 200, 100]);
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 400, egresos: 0, balance: 400 });
});
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  globalThis.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
  globalThis.window = { dispatchEvent: () => {} };
  api.definirAlcanceStorage("period-test");
  api.setState({ transactions: structuredClone(transactions), currentPeriodStart: "2026-08-06", currentPeriodEnd: "2026-09-05",
    periodDay: 5, periodHistory: [], savings: 100000, savingsTransfers: [], debt: 0, customCategories: [],
    filtroHistorial: "egreso", filtroFechaInicio: "2026-08-06", filtroFechaFin: "2026-09-05", busquedaTexto: "mes", paginaActual: 3 });
});

test("cerrar deja ingresos, gastos y balance en cero y suma el sobrante al ahorro", () => {
  api.cerrarPeriodo();
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 0, egresos: 0, balance: 0 });
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
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 50000, egresos: 0, balance: 50000 });
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 755000);
  assert.equal(api.getState().periodHistory.length, 2);
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 0, egresos: 0, balance: 0 });
});

test("un déficit no aumenta el ahorro y el nuevo periodo empieza en cero", () => {
  api.setState({ transactions: [transactions[1]] });
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 100000);
  assert.equal(api.getState().debt, 759000);
  assert.equal(api.getState().periodHistory[0].savingsAdded, 0);
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 0, egresos: 0, balance: 0 });
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

test("transferir ahorro cubre un gasto ya registrado sin cambiar ingresos ni gastos", () => {
  api.setState({ currentPeriodStart: "2026-09-05", currentPeriodEnd: "2099-10-04", savings: 405000, transactions: [
    { id: "income", fecha: "2026-09-05", tipo: "ingreso", monto: 300000 },
    { id: "previous-expense", fecha: "2026-09-05", tipo: "egreso", monto: 100000 },
    { id: "expense", fecha: "2026-09-06", tipo: "egreso", monto: 350000 },
  ] });
  assert.equal(api.transferirAhorro({ monto: 150000, fecha: "2026-09-06", detalle: "Cubrir gasto" }), true);
  assert.equal(api.getState().savings, 255000);
  assert.deepEqual(api.calcularSaldosPeriodo(new Date(2026, 8, 6)), { ingresos: 300000, egresos: 450000, balance: 0 });
  assert.equal(api.getState().transactions.length, 3);
  assert.equal(api.getState().savingsTransfers.length, 1);
  assert.equal(api.obtenerPeriodoStorage().savingsTransfers[0].monto, 150000);
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 255000);
  assert.equal(api.getState().debt, 0);
  assert.equal(api.getState().periodHistory[0].fromSavings, 150000);
  assert.equal(api.getState().periodHistory[0].savingsTransfers.length, 1);
});

test("el ahorro transferido sin gastar vuelve al ahorro al cerrar, sin crear dinero", () => {
  api.setState({ currentPeriodStart: "2026-09-05", currentPeriodEnd: "2099-10-04", savings: 405000, transactions: [] });
  assert.equal(api.transferirAhorro({ monto: 150000, fecha: "2026-09-06" }), true);
  assert.equal(api.getState().savings, 255000);
  assert.equal(api.calcularSaldosPeriodo(new Date(2026, 8, 6)).balance, 150000);
  api.cerrarPeriodo();
  assert.equal(api.getState().savings, 405000);
  assert.equal(api.getState().periodHistory[0].savingsAdded, 150000);
  assert.equal(api.calcularSaldosPeriodo(new Date(2026, 8, 6)).balance, 0);
});

test("un retiro inválido no altera ni el ahorro ni el balance", () => {
  api.setState({ currentPeriodStart: "2026-09-05", currentPeriodEnd: "2099-10-04" });
  assert.equal(api.transferirAhorro({ monto: 100001, fecha: "2026-09-06" }), false);
  assert.equal(api.getState().savings, 100000);
  assert.deepEqual(api.getState().savingsTransfers, []);
});
