import test from "node:test";
import assert from "node:assert/strict";
import { prepararTransferencia, sumarTransferencias } from "../src/js/modules/savings-core.js";
const state = { savings: 405000, savingsTransfers: [], currentPeriodStart: "2026-09-05", currentPeriodEnd: "2026-10-04" };
const input = { monto: 150000, fecha: "2026-09-06", today: "2026-09-06", id: "one", detalle: "Cubrir gastos" };

test("un retiro resta el mismo importe al ahorro que suma al balance", () => {
  const next = prepararTransferencia(state, input);
  assert.equal(next.savings, 255000);
  assert.equal(next.savings + sumarTransferencias(next.savingsTransfers), 405000);
  assert.deepEqual(state.savingsTransfers, []);
});
test("validar fondos, importes negativos, cero, decimales y fechas", () => {
  for (const monto of [0, -1, 405001, NaN, Infinity, "abc", 1.001]) {
    assert.throws(() => prepararTransferencia(state, { ...input, monto }));
  }
  for (const fecha of ["2026-09-04", "2026-09-07", "2026-02-30", "2026-13-01", "invalid"]) {
    assert.throws(() => prepararTransferencia(state, { ...input, fecha }));
  }
});
test("los centavos se conservan y se permite retirar todo el ahorro", () => {
  const next = prepararTransferencia({ ...state, savings: 0.3 }, { ...input, monto: 0.1 });
  assert.equal(next.savings, 0.2);
  const emptied = prepararTransferencia({ ...state, ...next }, { ...input, monto: 0.2, id: "two" });
  assert.equal(emptied.savings, 0);
  assert.equal(sumarTransferencias(emptied.savingsTransfers), 0.3);
});
test("un retiro del mes anterior no vuelve a sumarse al balance actual", () => {
  assert.equal(sumarTransferencias([
    { fecha: "2026-09-04", monto: 100000 }, { fecha: "2026-09-05", monto: 150000 },
  ], "2026-09-05", "2026-10-04"), 150000);
});
