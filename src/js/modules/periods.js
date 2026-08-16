/**
 * modules/periods.js
 * Lógica de periodos financieros y cierre mensual.
 */

import { getState, setState } from "../state.js";
import { formatMoneda, generarId } from "../utils.js";
import {
  guardarPeriodoStorage,
  obtenerPeriodoStorage,
} from "../storage.js";
import { PERIOD_CONFIG } from "../constants.js";
import { mostrarToast } from "../ui.js";
import { recalcularYRenderizar } from "./dashboard.js";
import { renderizarPeriodoEnDOM } from "./periods-render.js";


/* ==========================================================================
   UTILIDADES INTERNAS
   ========================================================================== */

/**
 * Convierte una fecha Date a YYYY-MM-DD usando la zona horaria local.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatearFechaISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/**
 * Convierte una fecha YYYY-MM-DD a Date local.
 *
 * Evita utilizar new Date("YYYY-MM-DD"), ya que ese formato puede
 * interpretarse como UTC y ocasionar cambios de día según la zona horaria.
 *
 * @param {string} dateString
 * @returns {Date | null}
 */
function crearFechaLocal(dateString) {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return null;
  }

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


/**
 * Normaliza el día de cierre.
 *
 * @param {number|string} value
 * @returns {number}
 */
function normalizarDiaCierre(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return PERIOD_CONFIG.defaultCloseDay;
  }

  return Math.max(1, Math.min(28, parsed));
}


/**
 * Devuelve un arreglo seguro de transacciones.
 *
 * @param {*} transactions
 * @returns {Array}
 */
function normalizarTransacciones(transactions) {
  return Array.isArray(transactions)
    ? transactions
    : [];
}


/* ==========================================================================
   ESTADO DEL PERIODO
   ========================================================================== */

function crearEstadoPeriodoBase(
  closeDay = PERIOD_CONFIG.defaultCloseDay
) {
  const day = normalizarDiaCierre(closeDay);

  const {
    periodStart,
    periodEnd,
  } = calcularFechasPeriodo(day);

  return {
    periodDay: day,
    savings: 0,
    debt: 0,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    periodHistory: [],
  };
}


function guardarEstadoPeriodo(stateOverrides = {}) {
  const state = {
    ...getState(),
    ...stateOverrides,
  };

  guardarPeriodoStorage({
    periodDay: state.periodDay,
    savings: state.savings,
    debt: state.debt,
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    periodHistory: state.periodHistory,
  });
}


/* ==========================================================================
   CÁLCULOS
   ========================================================================== */

/**
 * Calcula los totales de las transacciones pertenecientes a un periodo.
 *
 * @param {Array} transactions
 * @param {string} periodStart
 * @param {string} periodEnd
 * @returns {{
 *   totalIngresos: number,
 *   totalEgresos: number,
 *   transactionCount: number,
 *   balance: number
 * }}
 */
function calcularTotalesPeriodo(
  transactions,
  periodStart,
  periodEnd
) {
  const lista = normalizarTransacciones(transactions);

  if (!periodStart || !periodEnd) {
    return {
      totalIngresos: 0,
      totalEgresos: 0,
      transactionCount: 0,
      balance: 0,
    };
  }

  const transaccionesPeriodo = lista.filter((transaction) => {
    if (!transaction?.fecha) {
      return false;
    }

    return (
      transaction.fecha >= periodStart &&
      transaction.fecha <= periodEnd
    );
  });

  const totales = transaccionesPeriodo.reduce(
    (acc, transaction) => {
      const monto = Number.parseFloat(transaction.monto);

      if (!Number.isFinite(monto)) {
        return acc;
      }

      if (transaction.tipo === "ingreso") {
        acc.totalIngresos += monto;
      } else if (transaction.tipo === "egreso") {
        acc.totalEgresos += monto;
      }

      return acc;
    },
    {
      totalIngresos: 0,
      totalEgresos: 0,
    }
  );

  return {
    totalIngresos: totales.totalIngresos,
    totalEgresos: totales.totalEgresos,
    transactionCount: transaccionesPeriodo.length,
    balance:
      totales.totalIngresos -
      totales.totalEgresos,
  };
}


/**
 * Calcula el periodo inmediatamente posterior a uno ya cerrado.
 *
 * Ejemplo:
 * periodo cerrado: 2026-07-06 → 2026-08-05
 * siguiente:        2026-08-06 → 2026-09-05
 *
 * @param {string} currentPeriodEnd
 * @param {number} closeDay
 * @returns {{ periodStart: string, periodEnd: string }}
 */
function calcularSiguientePeriodo(
  currentPeriodEnd,
  closeDay
) {
  const endDate = crearFechaLocal(currentPeriodEnd);

  if (!endDate) {
    return calcularFechasPeriodo(closeDay);
  }

  const day = normalizarDiaCierre(closeDay);

  const nextStart = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() + 1
  );

  const nextEnd = new Date(
    nextStart.getFullYear(),
    nextStart.getMonth() + 1,
    day
  );

  return {
    periodStart: formatearFechaISO(nextStart),
    periodEnd: formatearFechaISO(nextEnd),
  };
}


/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */

/**
 * Inicializa los datos del periodo desde el almacenamiento.
 */
export function inicializarPeriodo() {
  const savedPeriod = obtenerPeriodoStorage();

  if (!savedPeriod) {
    const initialState = crearEstadoPeriodoBase();

    setState(initialState);
    guardarEstadoPeriodo(initialState);

    return;
  }

  const periodDay = normalizarDiaCierre(
    savedPeriod.periodDay
  );

  const restoredState = {
    periodDay,

    savings: Number.isFinite(Number(savedPeriod.savings))
      ? Number(savedPeriod.savings)
      : 0,

    debt: Number.isFinite(Number(savedPeriod.debt))
      ? Number(savedPeriod.debt)
      : 0,

    currentPeriodStart:
      savedPeriod.currentPeriodStart ?? null,

    currentPeriodEnd:
      savedPeriod.currentPeriodEnd ?? null,

    periodHistory: Array.isArray(
      savedPeriod.periodHistory
    )
      ? savedPeriod.periodHistory
      : [],
  };

  setState(restoredState);

  if (
    !restoredState.currentPeriodStart ||
    !restoredState.currentPeriodEnd
  ) {
    recalcularFechasPeriodo();
  }
}


/* ==========================================================================
   FECHAS DEL PERIODO
   ========================================================================== */

/**
 * Calcula las fechas de inicio y fin del periodo correspondiente
 * a la fecha actual.
 *
 * @param {number} closeDay Día de cierre mensual.
 * @returns {{ periodStart: string, periodEnd: string }}
 */
export function calcularFechasPeriodo(
  closeDay = PERIOD_CONFIG.defaultCloseDay
) {
  const day = normalizarDiaCierre(closeDay);

  const today = new Date();

  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  let periodStart;
  let periodEnd;

  if (todayDay > day) {
    periodStart = new Date(
      todayYear,
      todayMonth,
      day + 1
    );

    periodEnd = new Date(
      todayYear,
      todayMonth + 1,
      day
    );
  } else {
    periodStart = new Date(
      todayYear,
      todayMonth - 1,
      day + 1
    );

    periodEnd = new Date(
      todayYear,
      todayMonth,
      day
    );
  }

  return {
    periodStart: formatearFechaISO(periodStart),
    periodEnd: formatearFechaISO(periodEnd),
  };
}


/**
 * Recalcula las fechas del periodo actual según el día configurado.
 */
export function recalcularFechasPeriodo() {
  const state = getState();

  const periodDay = normalizarDiaCierre(
    state.periodDay
  );

  const {
    periodStart,
    periodEnd,
  } = calcularFechasPeriodo(periodDay);

  const updates = {
    periodDay,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };

  setState(updates);
  guardarEstadoPeriodo(updates);
}


/* ==========================================================================
   CONFIGURACIÓN
   ========================================================================== */

/**
 * Cambia el día de cierre del periodo.
 *
 * @param {number|string} newDay Nuevo día de cierre.
 */
export function configurarDiaCierre(newDay) {
  const day = normalizarDiaCierre(newDay);

  const {
    periodStart,
    periodEnd,
  } = calcularFechasPeriodo(day);

  const updates = {
    periodDay: day,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };

  setState(updates);
  guardarEstadoPeriodo(updates);

  renderizarSeccionPeriodo();

  mostrarToast(
    "success",
    `Día de cierre actualizado al ${day} de cada mes`
  );
}


/* ==========================================================================
   CIERRE DEL PERIODO
   ========================================================================== */

/**
 * Ejecuta el cierre del periodo actual.
 */
export function cerrarPeriodo() {
  const state = getState();

  const transactions = normalizarTransacciones(
    state.transactions
  );

  const currentPeriodStart =
    state.currentPeriodStart;

  const currentPeriodEnd =
    state.currentPeriodEnd;

  const periodDay = normalizarDiaCierre(
    state.periodDay
  );

  const periodHistory = Array.isArray(
    state.periodHistory
  )
    ? state.periodHistory
    : [];

  const savings = Number(state.savings) || 0;
  const debt = Number(state.debt) || 0;


  /* Validar periodo activo */

  if (
    !currentPeriodStart ||
    !currentPeriodEnd
  ) {
    mostrarToast(
      "error",
      "No hay un periodo activo para cerrar"
    );

    return;
  }


  /* Evitar cerrar dos veces el mismo periodo */

  const periodoYaCerrado = periodHistory.some(
    (period) =>
      period.start === currentPeriodStart &&
      period.end === currentPeriodEnd
  );

  if (periodoYaCerrado) {
    mostrarToast(
      "warning",
      "Este periodo ya fue cerrado"
    );

    return;
  }


  /* Calcular resultado */

  const {
    totalIngresos,
    totalEgresos,
    transactionCount,
    balance,
  } = calcularTotalesPeriodo(
    transactions,
    currentPeriodStart,
    currentPeriodEnd
  );


  let newSavings = savings;
  let newDebt = debt;
  let tipoResultado = "equilibrio";

  if (balance > 0) {
    newSavings += balance;
    tipoResultado = "ahorro";
  } else if (balance < 0) {
    newDebt += Math.abs(balance);
    tipoResultado = "deficit";
  }


  /* Crear registro histórico */

  const nuevaEntrada = {
    id: generarId(),

    start: currentPeriodStart,
    end: currentPeriodEnd,

    totalIngresos,
    totalEgresos,

    transactionCount,

    balance,
    result: tipoResultado,

    closedAt: new Date().toISOString(),
  };


  const newHistory = [
    nuevaEntrada,
    ...periodHistory,
  ];


  /* Avanzar al periodo siguiente */

  const {
    periodStart: newStart,
    periodEnd: newEnd,
  } = calcularSiguientePeriodo(
    currentPeriodEnd,
    periodDay
  );


  const updates = {
    savings: newSavings,
    debt: newDebt,

    currentPeriodStart: newStart,
    currentPeriodEnd: newEnd,

    periodHistory: newHistory,
  };


  /* Actualizar estado */

  setState(updates);

  guardarEstadoPeriodo({
    periodDay,
    ...updates,
  });


  /* Notificación */

  const balanceFormateado = formatMoneda(
    Math.abs(balance)
  );

  if (balance > 0) {
    mostrarToast(
      "success",
      `Periodo cerrado. Balance positivo: +${balanceFormateado}`
    );
  } else if (balance < 0) {
    mostrarToast(
      "warning",
      `Periodo cerrado con déficit de ${balanceFormateado}`
    );
  } else {
    mostrarToast(
      "info",
      "Periodo cerrado en equilibrio"
    );
  }


  /* Refrescar interfaz */

  recalcularYRenderizar();
  renderizarSeccionPeriodo();
}


/* ==========================================================================
   RESUMEN
   ========================================================================== */

/**
 * Obtiene el resumen del periodo actual.
 *
 * @returns {object}
 */
export function obtenerResumenPeriodo() {
  const state = getState();

  const transactions = normalizarTransacciones(
    state.transactions
  );

  const periodHistory = Array.isArray(
    state.periodHistory
  )
    ? state.periodHistory
    : [];

  const totales = calcularTotalesPeriodo(
    transactions,
    state.currentPeriodStart,
    state.currentPeriodEnd
  );

  return {
    periodStart: state.currentPeriodStart,
    periodEnd: state.currentPeriodEnd,

    periodDay: normalizarDiaCierre(
      state.periodDay
    ),

    totalIngresos: totales.totalIngresos,
    totalEgresos: totales.totalEgresos,
    balance: totales.balance,

    savings: Number(state.savings) || 0,
    debt: Number(state.debt) || 0,

    transactionCount:
      totales.transactionCount,

    totalTransactions:
      transactions.length,

    periodHistory,
  };
}


/* ==========================================================================
   RENDER
   ========================================================================== */

/**
 * Orquesta el pintado de la sección de periodos.
 *
 * Este módulo no contiene HTML.
 */
export function renderizarSeccionPeriodo() {
  const resumen = obtenerResumenPeriodo();

  renderizarPeriodoEnDOM(resumen);
}


/* ==========================================================================
   EXPORTACIÓN
   ========================================================================== */

export default {
  inicializarPeriodo,
  calcularFechasPeriodo,
  recalcularFechasPeriodo,
  configurarDiaCierre,
  cerrarPeriodo,
  obtenerResumenPeriodo,
  renderizarSeccionPeriodo,
};
