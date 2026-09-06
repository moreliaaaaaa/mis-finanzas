/**
 * modules/periods-render.js
 * Plantillas y pintado de la vista de periodos financieros.
 */

import { formatMoneda, escapeHTML } from "../utils.js";
import { CATEGORIAS } from "../constants.js";
import { initializarIconos } from "../ui.js";

const PERIOD_CONTAINER_SELECTOR = "#period-section, #period-section-view";

function formatearFecha(fechaStr) {
  if (!fechaStr) return "&mdash;";

  const partes = fechaStr.split("-");

  return escapeHTML(`${partes[2]}/${partes[1]}/${partes[0]}`);
}

function obtenerEstadoPeriodo(balance) {
  if (balance > 0) {
    return {
      className: "period-badge-positive",
      label: `Balance: ${formatMoneda(balance)}`,
    };
  }

  if (balance < 0) {
    return {
      className: "period-badge-negative",
      label: `Balance: ${formatMoneda(balance)}`,
    };
  }

  return {
    className: "period-badge-neutral",
    label: `Balance: ${formatMoneda(0)}`,
  };
}

function crearShellPeriodo() {
  return `
    <div data-period-current></div>
    <div data-period-cards></div>
    <div data-period-history></div>
  `;
}

function asegurarShell(container) {
  const tieneShell =
    container.querySelector("[data-period-current]") &&
    container.querySelector("[data-period-cards]") &&
    container.querySelector("[data-period-history]");

  if (!tieneShell) {
    container.innerHTML = crearShellPeriodo();
  }
}

function renderPeriodoActual(resumen) {
  const estado = obtenerEstadoPeriodo(resumen.balance);

  return `
    <div class="period-info-bar">
      <div class="period-info-content">

        <div class="period-dates">
          <span class="period-label">
            Periodo actual
          </span>

          <strong>
            ${formatearFecha(resumen.periodStart)}
            &rarr;
            ${formatearFecha(resumen.periodEnd)}
          </strong>

          <span class="period-badge ${estado.className}">
            ${estado.label}
          </span>
        </div>

        <div class="period-actions">
          <div class="period-day-config">

            <label
              for="period-day-input"
              class="period-day-label"
            >
              Día de cierre
            </label>

            <input
              type="number"
              id="period-day-input"
              class="period-day-input"
              min="1"
              max="28"
              value="${resumen.periodDay}"
              inputmode="numeric"
              onchange="window.cambiarDiaCierre(this.value)"
            >

          </div>

          <button
            type="button"
            id="btn-cerrar-periodo"
            class="btn-period-close"
            onclick="window.cerrarPeriodo()"
          >
            <i
              data-lucide="calendar-check"
              aria-hidden="true"
            ></i>

            <span>Cerrar periodo</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderTarjetasPeriodo(resumen) {
  return `
    <div class="period-cards-row">

      <div class="card period-card ahorro-card">

        <div class="card-content">
          <p class="card-label">
            Ahorros acumulados
          </p>

          <h3 class="card-amount">
            ${formatMoneda(resumen.savings)}
          </h3>
        </div>

        <div
          class="card-icon ahorro-icon"
          aria-hidden="true"
        >
          <i data-lucide="piggy-bank"></i>
        </div>

      </div>


      <div class="card period-card deuda-card">

        <div class="card-content">
          <p class="card-label">
            Deuda acumulada
          </p>

          <h3 class="card-amount">
            ${formatMoneda(resumen.debt)}
          </h3>
        </div>

        <div
          class="card-icon deuda-icon"
          aria-hidden="true"
        >
          <i data-lucide="credit-card"></i>
        </div>

      </div>

    </div>
  `;
}

function renderDetalleCierre(entry) {
  const categorias = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];
  const movimientos = [...(entry.transactions || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const dinero = (value) => Number.isFinite(Number(value)) ? formatMoneda(Number(value)) : "&mdash;";
  return `
    <div class="closed-period-detail">
      <dl class="closed-period-totals">
        <div><dt>Ingresos</dt><dd class="text-ingreso">${dinero(entry.totalIngresos)}</dd></div>
        <div><dt>Gastos</dt><dd class="text-egreso">${dinero(entry.totalEgresos)}</dd></div>
        <div><dt>Balance del cierre</dt><dd>${dinero(entry.balance)}</dd></div>
      </dl>
      ${Number(entry.balance) > 0 ? `<p class="closed-period-saving">Añadido al ahorro: <strong>${dinero(entry.savingsAdded ?? entry.balance)}</strong>${entry.savingsAfter != null ? ` · Ahorro acumulado al cierre: <strong>${dinero(entry.savingsAfter)}</strong>` : ""}</p>` : ""}
      <h3 class="closed-period-heading">Movimientos del periodo (${movimientos.length})</h3>
      ${!entry.hasSnapshot ? '<p class="closed-period-note">Este cierre antiguo muestra los movimientos que siguen disponibles.</p>' : ""}
      ${movimientos.length ? `<ul class="closed-period-movements">${movimientos.map((tx) => {
        const ingreso = tx.tipo === "ingreso";
        const categoria = tx.categoryLabel || categorias.find((cat) => cat.id === tx.categoria)?.label || tx.categoria || "Sin categoría";
        return `<li class="closed-period-movement">
          <div class="closed-period-movement-copy">
            <span class="closed-period-movement-meta">${formatearFecha(tx.fecha)} · ${ingreso ? "Ingreso" : "Gasto"} · ${escapeHTML(categoria)}</span>
            <span>${escapeHTML(tx.detalle || "Sin detalle")}</span>
          </div>
          <strong class="${ingreso ? "text-ingreso" : "text-egreso"}">${ingreso ? "+" : "−"}${dinero(tx.monto)}</strong>
        </li>`;
      }).join("")}</ul>` : '<p class="closed-period-note">No hay movimientos registrados para este periodo.</p>'}
    </div>
  `;
}

function renderItemHistorial(entry) {
  const balanceClass =
    entry.balance > 0
      ? "text-ingreso"
      : entry.balance < 0
      ? "text-egreso"
      : "";

  let resultado;

  if (entry.result === "ahorro") {
    resultado = {
      icon: "trending-up",
      label: "Ahorro",
      className: "period-result-positive",
    };
  } else if (entry.result === "deficit") {
    resultado = {
      icon: "trending-down",
      label: "Déficit",
      className: "period-result-negative",
    };
  } else {
    resultado = {
      icon: "minus",
      label: "Equilibrio",
      className: "period-result-neutral",
    };
  }

  return `
    <details class="period-history-entry" data-period-key="${escapeHTML(`${entry.start}_${entry.end}`)}">
    <summary class="period-history-item">

      <div class="period-history-info">

        <span
          class="period-history-icon ${resultado.className}"
          aria-hidden="true"
        >
          <i data-lucide="${resultado.icon}"></i>
        </span>

        <div class="period-history-copy">

          <span class="period-history-dates">
            ${formatearFecha(entry.start)}
            -
            ${formatearFecha(entry.end)}
          </span>

          <span class="period-history-label">
            ${resultado.label} · Ver detalle
          </span>

        </div>

      </div>

      <span class="period-history-amount ${balanceClass}">
        ${formatMoneda(Math.abs(entry.balance))}
      </span>

    </summary>
    ${renderDetalleCierre(entry)}
    </details>
  `;
}

function renderHistorialPeriodo(resumen) {
  const historialHTML = resumen.periodHistory.length
    ? resumen.periodHistory
        .map(renderItemHistorial)
        .join("")
    : `
      <div class="empty-state period-empty">
        <div
          class="period-empty-icon"
          aria-hidden="true"
        >
          <i data-lucide="calendar-clock"></i>
        </div>

        <div class="empty-state-text">
          Aún no hay periodos cerrados.
        </div>
      </div>
    `;

  return `
    <details
      class="period-history-details"
      ${resumen.periodHistory.length > 0 ? "open" : ""}
    >
      <summary class="period-history-summary">

        <span class="period-history-summary-title">
          Historial de periodos
        </span>

        <span class="period-history-count">
          ${resumen.periodHistory.length}
        </span>

      </summary>

      <div class="period-history-list">
        ${historialHTML}
      </div>

    </details>
  `;
}

export function renderizarPeriodoEnDOM(resumen) {
  const containers = document.querySelectorAll(
    PERIOD_CONTAINER_SELECTOR
  );

  if (!containers.length) return;

  containers.forEach((container) => {
    asegurarShell(container);

    const periodoActual = container.querySelector(
      "[data-period-current]"
    );

    const tarjetas = container.querySelector(
      "[data-period-cards]"
    );

    const historial = container.querySelector(
      "[data-period-history]"
    );

    if (periodoActual) {
      periodoActual.innerHTML =
        renderPeriodoActual(resumen);
    }

    if (tarjetas) {
      tarjetas.innerHTML =
        renderTarjetasPeriodo(resumen);
    }

    if (historial) {
      const abiertos = new Set([...historial.querySelectorAll("[data-period-key][open]")].map((item) => item.dataset.periodKey));
      historial.innerHTML =
        renderHistorialPeriodo(resumen);
      historial.querySelectorAll("[data-period-key]").forEach((item) => {
        item.open = abiertos.has(item.dataset.periodKey);
      });
    }
  });

  /*
   * El HTML se genera dinámicamente,
   * por lo que Lucide debe ejecutarse
   * después del render.
   */
  initializarIconos();
}

export default {
  renderizarPeriodoEnDOM,
};
