/**
 * modules/budgets.js
 * Sistema de presupuestos mensuales
 */

import { getState, setState } from "../state.js";
import { guardarEnStorage, obtenerDelStorage } from "../storage.js";
import { mostrarToast } from "../ui.js";
import { formatMoneda, obtenerFechaHoy, obtenerNombreMes } from "../utils.js";

const STORAGE_BUDGETS = "presupuestos";

/**
 * Inicializa los presupuestos desde storage
 */
export function inicializarPresupuestos() {
  const guardados = obtenerDelStorage(STORAGE_BUDGETS);
  if (guardados) {
    setState({ presupuestos: guardados });
  }
}

/**
 * Obtiene el presupuesto de un mes específico
 * @param {string} mesKey - YYYY-MM
 * @returns {object|null}
 */
export function obtenerPresupuesto(mesKey) {
  const state = getState();
  return state.presupuestos[mesKey] || null;
}

/**
 * Guarda el presupuesto para un mes
 * @param {string} mesKey - YYYY-MM
 * @param {number} limite - Límite mensual de egresos
 */
export function guardarPresupuesto(mesKey, limite) {
  const state = getState();
  const nuevos = { ...state.presupuestos };

  nuevos[mesKey] = {
    limite: parseFloat(limite) || 0,
    fechaCreacion: new Date().toISOString(),
  };

  setState({ presupuestos: nuevos });
  guardarEnStorage(STORAGE_BUDGETS, nuevos);

  mostrarToast("success", `Presupuesto de ${formatMoneda(limite)} configurado`);
}

/**
 * Calcula el estado del presupuesto para un mes
 * @param {string} mesKey - YYYY-MM
 * @returns {object} { limite, gastado, restante, porcentaje, estado }
 */
export function calcularEstadoPresupuesto(mesKey) {
  const state = getState();
  const presupuesto = state.presupuestos[mesKey];

  if (!presupuesto) {
    return null;
  }

  // Sumar egresos del mes
  let totalEgresos = 0;
  state.transactions.forEach((t) => {
    if (t.tipo === "egreso" && t.fecha.startsWith(mesKey)) {
      totalEgresos += parseFloat(t.monto) || 0;
    }
  });

  const limite = presupuesto.limite;
  const restante = limite - totalEgresos;
  const porcentaje = limite > 0 ? (totalEgresos / limite) * 100 : 0;

  let estado = "normal";
  if (porcentaje >= 100) {
    estado = "excedido";
  } else if (porcentaje >= 80) {
    estado = "alerta";
  } else if (porcentaje >= 50) {
    estado = "cuidado";
  }

  return {
    limite,
    gastado: totalEgresos,
    restante,
    porcentaje: Math.min(porcentaje, 100),
    estado,
  };
}

/**
 * Verifica y muestra alertas de presupuesto
 * @param {string} mesKey - YYYY-MM
 */
export function verificarAlertasPresupuesto(mesKey) {
  const estado = calcularEstadoPresupuesto(mesKey);
  if (!estado) return;

  if (estado.estado === "excedido") {
    mostrarToast("warning", `Presupuesto excedido por ${formatMoneda(Math.abs(estado.restante))}`);
  } else if (estado.estado === "alerta") {
    mostrarToast("info", `Cuidado: has usado el ${Math.round(estado.porcentaje)}% de tu presupuesto`);
  }
}

/**
 * Renderiza el widget de presupuesto
 * @param {string} containerId - ID del contenedor
 */
export function renderizarPresupuesto(containerId = "budget-widget") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const nombreMes = obtenerNombreMes(hoy.getMonth() + 1);

  const estado = calcularEstadoPresupuesto(mesActual);
  const presupuesto = obtenerPresupuesto(mesActual);

  let html = `
    <div class="budget-widget">
      <div class="budget-header">
        <h3>Presupuesto ${nombreMes}</h3>
        <button type="button" id="btn-config-presupuesto" class="btn-icon" title="Configurar presupuesto" aria-controls="presupuesto-config" aria-expanded="${!presupuesto}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
  `;

  if (!presupuesto) {
    html += `
      <div class="budget-empty">
        <p>Sin presupuesto configurado</p>
      </div>
    `;
  } else if (estado) {
    const estadoClase = estado.estado;
    const barraColor =
      estado.estado === "excedido"
        ? "#ef4444"
        : estado.estado === "alerta"
        ? "#f59e0b"
        : estado.estado === "cuidado"
        ? "#f97316"
        : "#10b981";

    html += `
      <div class="budget-body">
        <div class="budget-stats">
          <div class="budget-stat">
            <span class="budget-stat-label">Límite</span>
            <span class="budget-stat-value">${formatMoneda(estado.limite)}</span>
          </div>
          <div class="budget-stat">
            <span class="budget-stat-label">Gastado</span>
            <span class="budget-stat-value ${estadoClase}">${formatMoneda(estado.gastado)}</span>
          </div>
          <div class="budget-stat">
            <span class="budget-stat-label">Restante</span>
            <span class="budget-stat-value ${estado.restante >= 0 ? "text-ingreso" : "text-egreso"}">${formatMoneda(estado.restante)}</span>
          </div>
        </div>
        <div class="budget-progress">
          <div class="budget-progress-bar">
            <div class="budget-progress-fill ${estadoClase}" style="width: ${estado.porcentaje}%; background-color: ${barraColor}"></div>
          </div>
          <span class="budget-progress-text">${Math.round(estado.porcentaje)}% usado</span>
        </div>
      </div>
    `;
  }

  // El formulario también debe existir cuando ya hay un presupuesto guardado.
  html += `
    <form id="presupuesto-config" class="budget-config-form" ${presupuesto ? "hidden" : ""}>
      <input type="number" id="presupuesto-input" aria-label="Límite mensual" placeholder="Ej: 50000"
        min="0.01" step="0.01" required value="${Number(presupuesto?.limite) || ""}">
      <button type="submit" id="btn-guardar-presupuesto" class="btn-primary btn-sm">Guardar</button>
    </form>
  </div>`;
  container.innerHTML = html;

  // Event listeners
  const btnConfig = container.querySelector("#btn-config-presupuesto");
  const form = container.querySelector(".budget-config-form");

  if (btnConfig) {
    btnConfig.addEventListener("click", () => {
      if (form) {
        form.hidden = !form.hidden;
        btnConfig.setAttribute("aria-expanded", String(!form.hidden));
        if (!form.hidden) form.querySelector("input")?.focus();
      }
    });
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("#presupuesto-input");
      const valor = parseFloat(input?.value) || 0;
      if (Number.isFinite(valor) && valor > 0) {
        guardarPresupuesto(mesActual, valor);
        renderizarPresupuesto(containerId);
      } else {
        mostrarToast("error", "Ingrese un monto válido");
      }
    });
  }
}

export default {
  inicializarPresupuestos,
  obtenerPresupuesto,
  guardarPresupuesto,
  calcularEstadoPresupuesto,
  verificarAlertasPresupuesto,
  renderizarPresupuesto,
};
