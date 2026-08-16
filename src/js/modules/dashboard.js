/**
 * modules/dashboard.js
 * Lógica del dashboard principal
 */

import { getState, setState } from "../state.js";
import { formatMoneda, ordenarPorFecha, filtrarPorFechas } from "../utils.js";
import { CATEGORIAS, GRUPOS_CATEGORIAS, COLORES_CATEGORIAS } from "../constants.js";
import { mostrarToast, actualizarContenido, initializarIconos } from "../ui.js";
import noteAddIcon from "../../assets/icons/note_add.svg";

/**
 * Recalcula y renderiza el dashboard
 */
export function recalcularYRenderizar() {
  // Las tarjetas del inicio resumen el periodo financiero actual
  const resumen = calcularSaldosPeriodo();
  actualizarTarjetas(resumen.ingresos, resumen.egresos, resumen.balance);

  // Renderizar historial
  renderizarHistorialDashboard();

  // Renderizar secciones personalizadas del inicio
  renderizarHomeComplementos();
}

/**
 * Calcula los saldos del periodo financiero actual.
 * Si no hay periodo configurado, considera todas las transacciones.
 * @returns {{ingresos: number, egresos: number, balance: number}}
 */
function calcularSaldosPeriodo() {
  const state = getState();
  const tienePeriodo = !!(state.currentPeriodStart && state.currentPeriodEnd);
  let ingresos = 0;
  let egresos = 0;

  state.transactions.forEach((t) => {
    if (tienePeriodo) {
      const enPeriodo = t.fecha >= state.currentPeriodStart && t.fecha <= state.currentPeriodEnd;
      if (!enPeriodo) return;
    }
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") ingresos += monto;
    else egresos += monto;
  });

  return { ingresos, egresos, balance: ingresos - egresos };
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
  const balNetoEl = document.getElementById("resumen-balance-neto");
  const cardBalanceNeto = document.getElementById("card-balance-neto");

  if (ingresoEl) ingresoEl.textContent = formatMoneda(ingresos);
  if (egresoEl) egresoEl.textContent = formatMoneda(egresos);
  if (balEl) balEl.textContent = formatMoneda(balance);
  if (balNetoEl) balNetoEl.textContent = formatMoneda(balance);

  if (cardBalance) {
    cardBalance.classList.remove("positivo", "negativo");
    if (balance > 0) cardBalance.classList.add("positivo");
    else if (balance < 0) cardBalance.classList.add("negativo");
  }

  if (cardBalanceNeto) {
    cardBalanceNeto.classList.remove("positivo", "negativo");
    if (balance > 0) cardBalanceNeto.classList.add("positivo");
    else if (balance < 0) cardBalanceNeto.classList.add("negativo");
  }

  // Badge del hero: proporción de gastos frente a ingresos
  const badge = document.getElementById("balance-hero-badge");
  const badgeText = document.getElementById("balance-badge-text");
  if (badge && badgeText) {
    if (ingresos > 0) {
      const porcentaje = Math.min(100, Math.round((egresos / ingresos) * 100));
      badgeText.textContent = `Gastos: ${porcentaje}% de tus ingresos`;
      badge.hidden = false;
    } else if (egresos > 0) {
      badgeText.textContent = "Aún sin ingresos en el periodo";
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
}

/**
 * Renderiza las secciones personalizadas del inicio:
 * saludo, fecha, chip del periodo, últimos movimientos y estado vacío.
 */
function renderizarHomeComplementos() {
  const state = getState();

  // Saludo con el primer nombre
  const primerNombre = (state.userName || "").split(" ")[0] || "Usuario";
  const nombreEl = document.getElementById("home-user-name");
  if (nombreEl) {
    nombreEl.textContent = primerNombre;
  }

  const nombreHeaderEl = document.getElementById("header-user-name");
  if (nombreHeaderEl) {
    nombreHeaderEl.textContent = primerNombre;
  }

  // Fecha de hoy
  const fechaEl = document.getElementById("home-date-line");
  if (fechaEl) {
    const str = new Date().toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    fechaEl.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Chip y subtítulo del periodo
  const chip = document.getElementById("home-period-chip");
  const chipText = document.getElementById("home-period-text");
  const eyebrow = document.getElementById("home-period-range");
  const formatearCorta = (fechaStr) => {
    if (!fechaStr) return "—";
    const partes = fechaStr.split("-");
    return `${partes[2]}/${partes[1]}`;
  };

  if (chip && chipText && eyebrow) {
    if (state.currentPeriodStart && state.currentPeriodEnd) {
      const diasRestantes = Math.max(
        0,
        Math.ceil(
          (new Date(state.currentPeriodEnd + "T23:59:59") - new Date()) / 86400000
        )
      );
      const rango = `${formatearCorta(state.currentPeriodStart)} – ${formatearCorta(state.currentPeriodEnd)}`;
      chipText.textContent = `Periodo ${rango} · ${diasRestantes === 0 ? "último día" : `quedan ${diasRestantes} días`}`;
      eyebrow.textContent = `Balance del periodo · ${rango}`;
      chip.hidden = false;
    } else {
      chip.hidden = true;
      eyebrow.textContent = "Balance del periodo";
    }
  }

  // Últimos movimientos (la sección se oculta si no hay datos)
  const contenedorUltimos = document.getElementById("ultimos-movimientos-home");
  const seccionUltimos = document.getElementById("home-ultimos");
  if (!contenedorUltimos || !seccionUltimos) return;

  const ultimos = ordenarPorFecha(state.transactions, "desc").slice(0, 5);

  if (ultimos.length === 0) {
    seccionUltimos.hidden = true;
    return;
  }

  seccionUltimos.hidden = false;
  contenedorUltimos.innerHTML = ultimos.map(htmlMovimientoResumen).join("");
  initializarIconos();
}

/**
 * Genera el HTML de un movimiento en el resumen del inicio
 * @param {object} t
 * @returns {string}
 */
function htmlMovimientoResumen(t) {
  const esIngreso = t.tipo === "ingreso";
  const signo = esIngreso ? "+" : "-";
  const colorClase = esIngreso ? "text-ingreso" : "text-egreso";
  const detalle = t.detalle || "";
  const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];
  const catObj = todasLas.find((c) => c.id === t.categoria);
  const nombreCat = catObj ? catObj.label : t.categoria;

  return `
    <div class="home-mov-item">
      <div class="home-mov-icon ${esIngreso ? "home-mov-icon--ingreso" : "home-mov-icon--egreso"}">
        <i data-lucide="${esIngreso ? "trending-up" : "trending-down"}"></i>
      </div>
      <div class="home-mov-info">
        <span class="home-mov-category">${nombreCat}</span>
        ${detalle ? `<span class="home-mov-detail" title="${detalle}">${detalle}</span>` : ""}
        <span class="home-mov-date">${new Date(t.fecha).toLocaleDateString()}</span>
      </div>
      <span class="home-mov-amount ${colorClase}">${signo}${formatMoneda(t.monto)}</span>
    </div>
  `;
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
 * Resumen contextual (ingresos, gastos y balance) de los movimientos filtrados
 * @param {array} transacciones
 * @returns {string}
 */
function htmlResumenFiltrados(transacciones) {
  let ingresos = 0;
  let egresos = 0;

  transacciones.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") ingresos += monto;
    else egresos += monto;
  });

  const balance = ingresos - egresos;
  const claseBalance =
    balance > 0 ? " positivo" : balance < 0 ? " negativo" : "";

  return `
    <div class="history-summary">
      <div class="history-summary-stat">
        <span class="history-summary-label">Ingresos</span>
        <span class="history-summary-value is-ingreso">${formatMoneda(ingresos)}</span>
      </div>
      <div class="history-summary-stat">
        <span class="history-summary-label">Gastos</span>
        <span class="history-summary-value is-egreso">${formatMoneda(egresos)}</span>
      </div>
      <div class="history-summary-stat">
        <span class="history-summary-label">Balance</span>
        <span class="history-summary-value${claseBalance}">${formatMoneda(balance)}</span>
      </div>
    </div>
  `;
}

/**
 * Icono y color visual de una transacción según su categoría o grupo
 * @param {object} t
 * @returns {{icon: string, color: string}}
 */
function infoVisualTransaccion(t) {
  if (t.tipo === "ingreso") {
    const grupo = GRUPOS_CATEGORIAS.ingresos;
    return { icon: grupo.icon, color: grupo.color };
  }

  const cat = CATEGORIAS.egreso.find((c) => c.id === t.categoria);
  const grupo = cat ? GRUPOS_CATEGORIAS[cat.grupo] : null;

  return {
    icon: grupo ? grupo.icon : "wallet",
    color: COLORES_CATEGORIAS[t.categoria] || (grupo && grupo.color) || "#64748b",
  };
}

/**
 * Fecha legible en formato relativo (Hoy, Ayer, hace N días, o dd MMM)
 * @param {string} fecha - YYYY-MM-DD
 * @returns {string}
 */
function fechaRelativa(fecha) {
  if (!fecha) return "—";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((hoy - f) / 86400000);

  if (dias === 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias > 1 && dias < 7) return `Hace ${dias} días`;
  if (dias < 0) return "Programado";

  return f.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
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

  let html = htmlResumenFiltrados(filtradas);

  html += '<div class="history-list">';

  itemsPagina.forEach((t) => {
    const esIngreso = t.tipo === "ingreso";
    const signo = esIngreso ? "+" : "-";
    const detalle = t.detalle || "Sin detalle";

    // Obtener nombre de categoría
    const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];
    const catObj = todasLas.find((c) => c.id === t.categoria);
    const nombreCat = catObj ? catObj.label : t.categoria;

    const { icon, color } = infoVisualTransaccion(t);
    const fechaCompleta = new Date(`${t.fecha}T00:00:00`).toLocaleDateString(
      "es-CL",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );

    html += `
      <div class="history-item ${esIngreso ? "tipo-ingreso" : "tipo-egreso"}">
        <div class="history-item-icon" style="--cat-color: ${color}">
          <i data-lucide="${icon}"></i>
        </div>
        <div class="history-item-info">
          <div class="history-item-title">
            <span class="history-item-category">${nombreCat}</span>
            <span class="history-item-date" title="${fechaCompleta}">${fechaRelativa(t.fecha)}</span>
          </div>
          <span class="history-item-description" title="${detalle}">${detalle}</span>
        </div>
        <span class="history-item-amount ${esIngreso ? "ingreso" : "egreso"}">${signo}${formatMoneda(t.monto)}</span>
        <div class="history-item-actions">
          <button type="button" onclick="window.editarRegistro('${t.id}')" title="Editar" aria-label="Editar movimiento" class="history-item-action">
            <i data-lucide="pencil"></i>
          </button>
          <button type="button" onclick="window.eliminarRegistro('${t.id}')" title="Eliminar" aria-label="Eliminar movimiento" class="history-item-action history-item-action--delete">
            <i data-lucide="trash-2"></i>
          </button>
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
  initializarIconos();
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
