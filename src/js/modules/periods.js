/**
 * modules/periods.js
 * Gestión de periodos financieros - Cierre mensual
 *
 * Funcionalidad:
 * - Define periodos desde el día 6 de un mes hasta el día 5 del siguiente
 * - Al cerrar el periodo, el balance sobrante → Ahorro acumulado
 * - Si hay déficit → Deuda acumulada
 * - Historial de periodos cerrados
 */

import { getState, setState } from "../state.js";
import { formatMoneda, generarId } from "../utils.js";
import { guardarPeriodoStorage, obtenerPeriodoStorage } from "../storage.js";
import { PERIOD_CONFIG } from "../constants.js";
import { mostrarToast } from "../ui.js";
import { recalcularYRenderizar } from "./dashboard.js";

/**
 * Inicializa los datos del periodo desde el almacenamiento
 */
export function inicializarPeriodo() {
  const savedPeriod = obtenerPeriodoStorage();

  if (savedPeriod) {
    setState({
      periodDay: savedPeriod.periodDay || PERIOD_CONFIG.defaultCloseDay,
      savings: savedPeriod.savings || 0,
      debt: savedPeriod.debt || 0,
      currentPeriodStart: savedPeriod.currentPeriodStart,
      currentPeriodEnd: savedPeriod.currentPeriodEnd,
      periodHistory: savedPeriod.periodHistory || [],
    });
  } else {
    // Calcular periodo actual basado en la fecha de hoy
    const { periodStart, periodEnd } = calcularFechasPeriodo(
      PERIOD_CONFIG.defaultCloseDay
    );
    setState({
      periodDay: PERIOD_CONFIG.defaultCloseDay,
      savings: 0,
      debt: 0,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      periodHistory: [],
    });
  }

  // Si no hay periodo configurado o las fechas están vacías, recalcular
  const state = getState();
  if (!state.currentPeriodStart || !state.currentPeriodEnd) {
    recalcularFechasPeriodo();
  }
}

/**
 * Calcula las fechas de inicio y fin del periodo actual
 * basado en el día de cierre configurado
 * @param {number} closeDay - Día de cierre del mes (ej: 5)
 * @returns {{ periodStart: string, periodEnd: string }}
 */
export function calcularFechasPeriodo(closeDay = 5) {
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  let periodStart, periodEnd;

  if (todayDay > closeDay) {
    // Estamos en la primera mitad del periodo
    // Inicio: día (closeDay+1) del mes actual
    // Fin: día closeDay del mes siguiente
    periodStart = new Date(todayYear, todayMonth, closeDay + 1);
    periodEnd = new Date(todayYear, todayMonth + 1, closeDay);
  } else {
    // Estamos en la segunda mitad del periodo
    // Inicio: día (closeDay+1) del mes anterior
    // Fin: día closeDay del mes actual
    periodStart = new Date(todayYear, todayMonth - 1, closeDay + 1);
    periodEnd = new Date(todayYear, todayMonth, closeDay);
  }

  // Formatear a YYYY-MM-DD
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return {
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  };
}

/**
 * Recalcula las fechas del periodo actual basado en el día configurado
 */
export function recalcularFechasPeriodo() {
  const state = getState();
  const { periodStart, periodEnd } = calcularFechasPeriodo(state.periodDay);

  setState({
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  guardarPeriodoStorage({
    periodDay: state.periodDay,
    savings: state.savings,
    debt: state.debt,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    periodHistory: state.periodHistory,
  });
}

/**
 * Cambia el día de cierre del periodo
 * @param {number} newDay - Nuevo día de cierre (1-28)
 */
export function configurarDiaCierre(newDay) {
  const day = Math.max(1, Math.min(28, parseInt(newDay) || 5));

  setState({ periodDay: day });

  recalcularFechasPeriodo();

  mostrarToast("success", `Día de cierre cambiado al ${day} de cada mes`);
}

/**
 * Ejecuta el cierre del periodo actual
 * Calcula el balance, lo mueve a ahorro o deuda,
 * y genera un registro en el historial
 */
export function cerrarPeriodo() {
  const state = getState();
  const { transactions, currentPeriodStart, currentPeriodEnd, periodDay, periodHistory, savings, debt } = state;

  if (!currentPeriodStart || !currentPeriodEnd) {
    mostrarToast("error", "No hay un periodo activo para cerrar");
    return;
  }

  // Calcular transacciones dentro del periodo
  const transaccionesPeriodo = transactions.filter((t) => {
    return t.fecha >= currentPeriodStart && t.fecha <= currentPeriodEnd;
  });

  // Calcular ingresos y egresos del periodo
  let totalIngresos = 0;
  let totalEgresos = 0;

  transaccionesPeriodo.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }
  });

  const balance = totalIngresos - totalEgresos;

  // Actualizar ahorro/deuda acumulada
  let newSavings = savings || 0;
  let newDebt = debt || 0;
  let tipoResultado = "";

  if (balance > 0) {
    newSavings += balance;
    tipoResultado = "ahorro";
  } else if (balance < 0) {
    newDebt += Math.abs(balance);
    tipoResultado = "deficit";
  } else {
    tipoResultado = "equilibrio";
  }

  // Agregar al historial
  const nuevaEntrada = {
    id: generarId(),
    start: currentPeriodStart,
    end: currentPeriodEnd,
    totalIngresos,
    totalEgresos,
    balance,
    result: tipoResultado,
    closedAt: new Date().toISOString(),
  };

  const newHistory = [nuevaEntrada, ...(periodHistory || [])];

  // Calcular nuevas fechas para el siguiente periodo
  const { periodStart: newStart, periodEnd: newEnd } = calcularFechasPeriodo(periodDay);

  // Actualizar estado
  setState({
    savings: newSavings,
    debt: newDebt,
    currentPeriodStart: newStart,
    currentPeriodEnd: newEnd,
    periodHistory: newHistory,
  });

  // Guardar en storage
  guardarPeriodoStorage({
    periodDay,
    savings: newSavings,
    debt: newDebt,
    currentPeriodStart: newStart,
    currentPeriodEnd: newEnd,
    periodHistory: newHistory,
  });

  // Mostrar resultado
  const balanceFormateado = formatMoneda(Math.abs(balance));
  if (balance > 0) {
    mostrarToast(
      "success",
      `✅ Periodo cerrado. Ahorro acumulado: +${balanceFormateado}`
    );
  } else if (balance < 0) {
    mostrarToast(
      "warning",
      `⚠️ Periodo cerrado con déficit de ${balanceFormateado}`
    );
  } else {
    mostrarToast("info", "📊 Periodo cerrado en equilibrio (balance cero)");
  }

  // Actualizar dashboard
  recalcularYRenderizar();
  renderizarSeccionPeriodo();
}

/**
 * Obtiene un resumen del estado actual del periodo
 * @returns {object}
 */
export function obtenerResumenPeriodo() {
  const state = getState();
  const { transactions, currentPeriodStart, currentPeriodEnd, savings, debt, periodDay, periodHistory } = state;

  const transaccionesPeriodo = transactions.filter((t) => {
    return t.fecha >= currentPeriodStart && t.fecha <= currentPeriodEnd;
  });

  let totalIngresos = 0;
  let totalEgresos = 0;

  transaccionesPeriodo.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }
  });

  const balance = totalIngresos - totalEgresos;

  return {
    periodStart: currentPeriodStart,
    periodEnd: currentPeriodEnd,
    periodDay,
    totalIngresos,
    totalEgresos,
    balance,
    savings,
    debt,
    transactionCount: transaccionesPeriodo.length,
    totalTransactions: transactions.length,
    periodHistory: periodHistory || [],
  };
}

/**
 * Renderiza la sección de periodo en el dashboard
 */
export function renderizarSeccionPeriodo() {
  const containers = document.querySelectorAll("#period-section, #period-section-view");
  if (!containers.length) return;

  const resumen = obtenerResumenPeriodo();

  // Formatear fechas para mostrar
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return "—";
    const partes = fechaStr.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  // Generar historial HTML
  let historialHTML = "";
  if (resumen.periodHistory.length > 0) {
    historialHTML = resumen.periodHistory
      .map((entry) => {
        const balanceClass =
          entry.balance > 0
            ? "text-ingreso"
            : entry.balance < 0
            ? "text-egreso"
            : "";
        const icono =
          entry.result === "ahorro"
            ? "💰"
            : entry.result === "deficit"
            ? "🔴"
            : "⚖️";
        const label =
          entry.result === "ahorro"
            ? "→ Ahorro"
            : entry.result === "deficit"
            ? "→ Déficit"
            : "Equilibrio";

        return `
          <div class="period-history-item">
            <div class="period-history-info">
              <span class="period-history-icon">${icono}</span>
              <span class="period-history-dates">${formatearFecha(entry.start)} - ${formatearFecha(entry.end)}</span>
              <span class="period-history-label">${label}</span>
            </div>
            <span class="period-history-amount ${balanceClass}">${formatMoneda(Math.abs(entry.balance))}</span>
          </div>
        `;
      })
      .join("");
  } else {
    historialHTML = `
      <div class="empty-state period-empty">
        <div class="empty-state-text">Aún no hay periodos cerrados.</div>
      </div>
    `;
  }

  containers.forEach((container) => {
    container.innerHTML = `
      <!-- Period Info Bar -->
      <div class="period-info-bar">
        <div class="period-info-content">
          <div class="period-dates">
            <span class="period-label">Periodo actual:</span>
            <strong>${formatearFecha(resumen.periodStart)} → ${formatearFecha(resumen.periodEnd)}</strong>
            <span class="period-badge ${resumen.balance >= 0 ? "period-badge-positive" : "period-badge-negative"}">
              ${resumen.balance >= 0 ? "🟢" : "🔴"} Balance: ${formatMoneda(resumen.balance)}
            </span>
          </div>
          <div class="period-actions">
            <div class="period-day-config">
              <label for="period-day-input" class="period-day-label">Día de cierre:</label>
              <input
                type="number"
                id="period-day-input"
                class="period-day-input"
                min="1"
                max="28"
                value="${resumen.periodDay}"
                onchange="window.cambiarDiaCierre(this.value)"
              >
            </div>
            <button id="btn-cerrar-periodo" class="btn-period-close" onclick="window.cerrarPeriodo()">
              🔄 Cerrar Periodo
            </button>
          </div>
        </div>
      </div>

      <!-- Savings & Debt Cards Row -->
      <div class="period-cards-row">
        <div class="card period-card ahorro-card">
          <div class="card-content">
            <p class="card-label">Ahorros Acumulados</p>
            <h3 class="card-amount text-ingreso">${formatMoneda(resumen.savings)}</h3>
          </div>
          <div class="card-icon ahorro-icon">
            💰
          </div>
        </div>
        <div class="card period-card deuda-card">
          <div class="card-content">
            <p class="card-label">Deuda Acumulada</p>
            <h3 class="card-amount text-egreso">${formatMoneda(resumen.debt)}</h3>
          </div>
          <div class="card-icon deuda-icon">
            🔴
          </div>
        </div>
      </div>

      <!-- Period History -->
      <div class="period-history-section">
        <details class="period-history-details" ${resumen.periodHistory.length > 0 ? "open" : ""}>
          <summary class="period-history-summary">
            <span>📋 Historial de Periodos</span>
            <span class="period-history-count">${resumen.periodHistory.length} periodo(s)</span>
          </summary>
          <div class="period-history-list">
            ${historialHTML}
          </div>
        </details>
      </div>
    `;
  });
}

export default {
  inicializarPeriodo,
  calcularFechasPeriodo,
  recalcularFechasPeriodo,
  configurarDiaCierre,
  cerrarPeriodo,
  obtenerResumenPeriodo,
  renderizarSeccionPeriodo,
};

