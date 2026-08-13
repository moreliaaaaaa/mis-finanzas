/**
 * modules/dashboard.js
 * Lógica del dashboard principal
 */

import { getState, setState } from "../state.js";
import { formatMoneda, ordenarPorFecha, filtrarPorFechas } from "../utils.js";
import { CATEGORIAS } from "../constants.js";
import { mostrarToast, actualizarContenido } from "../ui.js";
import noteAddIcon from "../../assets/icons/note_add.svg";
import trendingUpIcon from "../../assets/icons/trending_up.svg";
import trendingDownIcon from "../../assets/icons/trending_down.svg";
import pencilIcon from "../../assets/icons/pencil.svg";
import trashIcon from "../../assets/icons/contenedor-de-basura.svg";

/**
 * Recalcula y renderiza el dashboard
 */
export function recalcularYRenderizar() {
  const state = getState();
  let totalIngresos = 0;
  let totalEgresos = 0;

  const transaccionesVisibles = obtenerTransaccionesFiltradas();

  transaccionesVisibles.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }
  });

  const balance = totalIngresos - totalEgresos;

  // Actualizar tarjetas
  actualizarTarjetas(totalIngresos, totalEgresos, balance);

  // Renderizar historial
  renderizarHistorialDashboard();
}

/**
 * Aplica el filtro de periodo actual cuando no hay rango de fechas explícito
 * @param {array} transacciones
 * @param {object} state
 * @returns {array}
 */
function filtrarPorPeriodoActual(transacciones, state) {
  if (state.filtroFechaInicio || state.filtroFechaFin) {
    return transacciones;
  }

  if (!state.currentPeriodStart || !state.currentPeriodEnd) {
    return transacciones;
  }

  return transacciones.filter((t) => {
    return t.fecha >= state.currentPeriodStart && t.fecha <= state.currentPeriodEnd;
  });
}

/**
 * Actualiza las tarjetas de resumen
 */
function actualizarTarjetas(ingresos, egresos, balance) {
  const ingresoEl = document.getElementById("resumen-ingresos");
  const egresoEl = document.getElementById("resumen-egresos");
  const balEl = document.getElementById("resumen-balance");
  const cardBalance = document.getElementById("card-balance");

  if (ingresoEl) ingresoEl.textContent = formatMoneda(ingresos);
  if (egresoEl) egresoEl.textContent = formatMoneda(egresos);
  if (balEl) balEl.textContent = formatMoneda(balance);

  if (cardBalance) {
    cardBalance.classList.remove("positivo", "negativo");
    if (balance > 0) cardBalance.classList.add("positivo");
    else if (balance < 0) cardBalance.classList.add("negativo");
  }
}

/**
 * Aplica todos los filtros y retorna transacciones filtradas
 * @returns {array}
 */
function obtenerTransaccionesFiltradas() {
  const state = getState();
  let filtradas = [...state.transactions];

  // Filtro por tipo
  if (state.filtroHistorial !== "todos") {
    filtradas = filtradas.filter((t) => t.tipo === state.filtroHistorial);
  }

  // Filtro por texto de búsqueda
  if (state.busquedaTexto && state.busquedaTexto.trim() !== "") {
    const texto = state.busquedaTexto.toLowerCase().trim();
    filtradas = filtradas.filter((t) => {
      const detalle = (t.detalle || "").toLowerCase();
      const categoria = t.categoria.toLowerCase();
      const fecha = t.fecha || "";
      return (
        detalle.includes(texto) ||
        categoria.includes(texto) ||
        fecha.includes(texto)
      );
    });
  }

  // Filtro por rango de fechas
  if (state.filtroFechaInicio && state.filtroFechaFin) {
    filtradas = filtrarPorFechas(filtradas, state.filtroFechaInicio, state.filtroFechaFin);
  } else if (state.filtroFechaInicio) {
    filtradas = filtradas.filter((t) => t.fecha >= state.filtroFechaInicio);
  } else if (state.filtroFechaFin) {
    filtradas = filtradas.filter((t) => t.fecha <= state.filtroFechaFin);
  } else {
    // Si no hay filtro de fechas, mostrar solo el periodo actual para la vista de movimientos
    filtradas = filtrarPorPeriodoActual(filtradas, state);
  }

  return filtradas;
}

/**
 * Renderiza el historial del dashboard con paginación
 */
export function renderizarHistorialDashboard() {
  const state = getState();
  const container = document.getElementById("lista-movimientos-dashboard");

  if (!container) return;

  const filtradas = obtenerTransaccionesFiltradas();
  const ordenadas = ordenarPorFecha(filtradas, "desc");

  // Paginación
  const totalItems = ordenadas.length;
  const totalPaginas = Math.ceil(totalItems / state.elementosPorPagina);
  const paginaActual = Math.min(state.paginaActual, totalPaginas || 1);
  const inicio = (paginaActual - 1) * state.elementosPorPagina;
  const fin = inicio + state.elementosPorPagina;
  const itemsPagina = ordenadas.slice(inicio, fin);

  if (totalItems === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><img class="asset-icon" src="${noteAddIcon}" alt=""></div>
        <div class="empty-state-text">No hay registros para este filtro.</div>
      </div>
    `;
    return;
  }

  let html = '<div class="history-list">';

  itemsPagina.forEach((t) => {
    const esIngreso = t.tipo === "ingreso";
    const signo = esIngreso ? "+" : "-";
    const colorClase = esIngreso ? "text-ingreso" : "text-egreso";
    const detalle = t.detalle || "Sin detalle";

    // Obtener nombre de categoría
    const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];
    const catObj = todasLas.find((c) => c.id === t.categoria);
    const nombreCat = catObj ? catObj.label : t.categoria;

    html += `
      <div class="history-item">
        <div class="history-item-content">
          <div class="history-item-icon" style="background-color: ${esIngreso ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color: ${esIngreso ? "#10b981" : "#ef4444"};">
            <img class="asset-icon" src="${esIngreso ? trendingUpIcon : trendingDownIcon}" alt="">
          </div>
          <div class="history-item-info">
            <span class="history-item-category">${nombreCat}</span>
            <span class="history-item-description" title="${detalle}">${detalle}</span>
            <span class="history-item-date">${new Date(t.fecha).toLocaleDateString()}</span>
          </div>
        </div>
        <span class="history-item-amount ${colorClase}">${signo}${formatMoneda(t.monto)}</span>
        <div class="history-item-actions">
          <button onclick="window.editarRegistro('${t.id}')" title="Editar" aria-label="Editar movimiento" class="btn-icon"><img class="asset-icon" src="${pencilIcon}" alt=""></button>
          <button onclick="window.eliminarRegistro('${t.id}')" title="Eliminar" aria-label="Eliminar movimiento" class="btn-icon delete"><img class="asset-icon" src="${trashIcon}" alt=""></button>
        </div>
      </div>
    `;
  });

  html += "</div>";

  // Paginación
  if (totalPaginas > 1) {
    html += `
      <div class="pagination">
        <button class="pagination-btn" ${paginaActual === 1 ? "disabled" : ""} onclick="window.cambiarPagina(${paginaActual - 1})" aria-label="Página anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <span class="pagination-info">Página ${paginaActual} de ${totalPaginas}</span>
        <button class="pagination-btn" ${paginaActual === totalPaginas ? "disabled" : ""} onclick="window.cambiarPagina(${paginaActual + 1})" aria-label="Página siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    `;
  }

  // Contador de resultados
  html += `<div class="results-count">${totalItems} registro(s) encontrado(s)</div>`;

  container.innerHTML = html;
}

/**
 * Cambia la página del historial
 * @param {number} pagina
 */
export function cambiarPagina(pagina) {
  setState({ paginaActual: pagina });
  renderizarHistorialDashboard();
}

/**
 * Filtra el historial por tipo
 * @param {string} filtro
 */
export function filtrarHistorial(filtro) {
  setState({ filtroHistorial: filtro, paginaActual: 1 });

  // Actualizar botones
  const filtros = ["todos", "ingreso", "egreso"];
  filtros.forEach((f) => {
    const btn = document.getElementById(`filtro-${f}`);
    if (btn) {
      if (f === filtro) {
        btn.className = "filter-button active";
      } else {
        btn.className = "filter-button";
      }
    }
  });

  renderizarHistorialDashboard();
}

/**
 * Busca transacciones por texto
 * @param {string} texto
 */
export function buscarTransacciones(texto) {
  setState({ busquedaTexto: texto, paginaActual: 1 });
  renderizarHistorialDashboard();
}

/**
 * Filtra transacciones por rango de fechas
 * @param {string} fechaInicio - YYYY-MM-DD o null
 * @param {string} fechaFin - YYYY-MM-DD o null
 */
export function filtrarPorRangoFechas(fechaInicio, fechaFin) {
  setState({
    filtroFechaInicio: fechaInicio || null,
    filtroFechaFin: fechaFin || null,
    paginaActual: 1,
  });
  renderizarHistorialDashboard();
}

/**
 * Limpia todos los filtros
 */
export function limpiarFiltros() {
  setState({
    busquedaTexto: "",
    filtroFechaInicio: null,
    filtroFechaFin: null,
    filtroHistorial: "todos",
    paginaActual: 1,
  });

  // Resetear UI de filtros
  const searchInput = document.getElementById("busqueda-movimientos");
  if (searchInput) searchInput.value = "";

  const fechaInicio = document.getElementById("filtro-fecha-inicio");
  if (fechaInicio) fechaInicio.value = "";

  const fechaFin = document.getElementById("filtro-fecha-fin");
  if (fechaFin) fechaFin.value = "";

  // Resetear botones de tipo
  const filtros = ["todos", "ingreso", "egreso"];
  filtros.forEach((f) => {
    const btn = document.getElementById(`filtro-${f}`);
    if (btn) {
      btn.className = f === "todos" ? "filter-button active" : "filter-button";
    }
  });

  renderizarHistorialDashboard();
}

export default {
  recalcularYRenderizar,
  renderizarHistorialDashboard,
  filtrarHistorial,
  buscarTransacciones,
  filtrarPorRangoFechas,
  limpiarFiltros,
  cambiarPagina,
};
