import test from "node:test";
import assert from "node:assert/strict";
import { periodoVisible } from "../src/js/modules/period-dates.js";

test("el rango visible avanza aunque el cierre esté esperando conexión", () => {
  const state = { periodDay: 4, currentPeriodStart: "2026-08-05", currentPeriodEnd: "2026-09-04" };
  assert.deepEqual(periodoVisible(state, new Date(2026, 8, 4, 23, 59)), { start: "2026-08-05", end: "2026-09-04" });
  assert.deepEqual(periodoVisible(state, new Date(2026, 8, 5)), { start: "2026-09-05", end: "2026-10-04" });
  assert.equal(state.currentPeriodEnd, "2026-09-04");
});

test("el período visible respeta el año nuevo y febrero", () => {
  const state = { periodDay: 4, currentPeriodStart: "2025-12-05", currentPeriodEnd: "2026-01-04" };
  assert.deepEqual(periodoVisible(state, new Date(2026, 0, 5)), { start: "2026-01-05", end: "2026-02-04" });
  assert.deepEqual(periodoVisible(state, new Date(2026, 2, 1)), { start: "2026-02-05", end: "2026-03-04" });
});

test("un período abierto manualmente por adelantado conserva sus fechas", () => {
  assert.deepEqual(periodoVisible({ periodDay: 4, currentPeriodStart: "2026-10-05", currentPeriodEnd: "2026-11-04" }, new Date(2026, 8, 6)),
    { start: "2026-10-05", end: "2026-11-04" });
});
