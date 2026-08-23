/**
 * modules/charts.js
 * Gestión de gráficos con Chart.js
 */

import { getState } from "../state.js";
import { CATEGORIAS, COLORES_CATEGORIAS } from "../constants.js";
import { escapeHTML, formatMoneda, obtenerNombreMes, sanitizeCssColor } from "../utils.js";

let chartInstance = null;
let chartTendenciaInstance = null;
let chartComparativaInstance = null;
let chartLoader = null;

async function cargarChart() {
  if (!chartLoader) {
    chartLoader = import("chart.js/auto").then((module) => module.default);
  }

  return chartLoader;
}

/**
 * Obtiene los totales de egresos por categoría (incluye categorías personalizadas),
 * ordenados de mayor a menor.
 * @returns {Array<{id: string, label: string, color: string, total: number, count: number}>}
 */
function obtenerEgresosPorCategoria() {
  const state = getState();

  const mapa = {};
  CATEGORIAS.egreso.forEach((cat) => {
    mapa[cat.id] = {
      id: cat.id,
      label: cat.label,
      color: sanitizeCssColor(COLORES_CATEGORIAS[cat.id], "#94a3b8"),
      total: 0,
      count: 0,
    };
  });

  (state.customCategories || [])
    .filter((c) => c.tipo === "egreso")
    .forEach((cat) => {
      if (!mapa[cat.id]) {
        mapa[cat.id] = {
          id: cat.id,
          label: cat.label,
          color: sanitizeCssColor(cat.color, "#94a3b8"),
          total: 0,
          count: 0,
        };
      }
    });

  state.transactions.forEach((t) => {
    if (t.tipo !== "egreso") return;
    const item = mapa[t.categoria];
    if (!item) return;
    item.total += parseFloat(t.monto) || 0;
    item.count += 1;
  });

  return Object.values(mapa)
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Actualiza el gráfico de egresos
 */
export async function actualizarGraficoEgresos() {
  const state = getState();
  const ctx = document.getElementById("chart-egresos-container");
  const fallback = document.getElementById("chart-fallback");

  if (!ctx) return;

  const totales = obtenerEgresosPorCategoria();

  if (totales.length === 0) {
    ctx.style.display = "none";
    fallback?.classList.remove("hidden");
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  ctx.style.display = "block";
  fallback?.classList.add("hidden");

  const labels = totales.map((item) => item.label);
  const dataValues = totales.map((item) => item.total);
  const backgroundColors = totales.map((item) => item.color);

  // Destruir instancia anterior
  if (chartInstance) {
    chartInstance.destroy();
  }

  const isDark = state.currentTheme === "dark";
  const Chart = await cargarChart();

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? "#1e293b" : "#ffffff",
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              return ` ${context.label}: $${value.toLocaleString("es-ES", { minimumFractionDigits: 0 })}`;
            },
          },
        },
      },
      cutout: "70%",
    },
  });
}

/**
 * Renderiza el panel de egresos: total central, leyenda, tarjetas de resumen
 * y desglose por categoría.
 */
export function renderizarDesgloseEgresos() {
  const state = getState();
  const totales = obtenerEgresosPorCategoria();
  const totalGeneral = totales.reduce((acc, item) => acc + item.total, 0);
  const totalMovimientos = totales.reduce((acc, item) => acc + item.count, 0);

  // Total central del doughnut
  const centro = document.getElementById("chart-egresos-total");
  const centroValor = centro?.querySelector(".chart-doughnut-center-value");
  if (centro && centroValor) {
    if (totalGeneral > 0) {
      centroValor.textContent = formatMoneda(totalGeneral);
      centro.hidden = false;
    } else {
      centro.hidden = true;
    }
  }

  // Leyenda del gráfico
  const leyenda = document.getElementById("chart-egresos-legend");
  if (leyenda) {
    if (totalGeneral > 0) {
      leyenda.innerHTML = totales
        .map((item) => {
          const pct = Math.round((item.total / totalGeneral) * 100);
          const colorSeguro = sanitizeCssColor(item.color);
          const labelSeguro = escapeHTML(item.label);
          return `
            <div class="chart-legend-item">
              <span class="chart-legend-color" style="background-color: ${colorSeguro}"></span>
              <span class="chart-legend-label">${labelSeguro}</span>
              <span class="chart-legend-pct">${pct}%</span>
            </div>
          `;
        })
        .join("");
      leyenda.hidden = false;
    } else {
      leyenda.hidden = true;
      leyenda.innerHTML = "";
    }
  }

  // Tarjetas de resumen
  const setTexto = (id, texto) => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  };

  setTexto("expense-total", formatMoneda(totalGeneral));
  setTexto("expense-total-sub", `${totalMovimientos} movimiento${totalMovimientos === 1 ? "" : "s"}`);
  setTexto("expense-categorias", String(totales.length));
  setTexto(
    "expense-categorias-sub",
    `de ${CATEGORIAS.egreso.length + (state.customCategories || []).filter((c) => c.tipo === "egreso").length} posibles`
  );

  const mayor = totales[0];
  if (mayor) {
    const pctMayor = Math.round((mayor.total / totalGeneral) * 100);
    setTexto("expense-mayor", mayor.label);
    setTexto("expense-mayor-sub", `${formatMoneda(mayor.total)} · ${pctMayor}% del total`);
  } else {
    setTexto("expense-mayor", "—");
    setTexto("expense-mayor-sub", "—");
  }

  // Desglose por categoría
  const lista = document.getElementById("lista-detalle-egresos");
  const vacio = document.getElementById("expense-breakdown-empty");
  if (!lista || !vacio) return;

  if (totalGeneral === 0) {
    lista.innerHTML = "";
    vacio.classList.remove("hidden");
    return;
  }

  vacio.classList.add("hidden");
  lista.innerHTML = totales
    .map((item, index) => {
      const pct = Math.round((item.total / totalGeneral) * 100);
      const colorSeguro = sanitizeCssColor(item.color);
      const labelSeguro = escapeHTML(item.label);
      return `
        <div class="expense-breakdown-item">
          <span class="expense-breakdown-rank">${index + 1}</span>
          <div class="expense-breakdown-main">
            <div class="expense-breakdown-top">
              <div class="expense-breakdown-name-wrap">
                <span class="expense-breakdown-dot" style="background-color: ${colorSeguro}"></span>
                <span class="expense-breakdown-name">${labelSeguro}</span>
                <span class="expense-breakdown-count">${item.count} mov.</span>
              </div>
              <div class="expense-breakdown-values">
                <span class="expense-breakdown-amount">${formatMoneda(item.total)}</span>
                <span class="expense-breakdown-percent">${pct}%</span>
              </div>
            </div>
            <div class="expense-breakdown-bar">
              <div class="expense-breakdown-fill" style="width: ${pct}%; background-color: ${colorSeguro}"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * Agrupa transacciones por mes
 * @param {array} transactions
 * @returns {object} { "2026-01": { ingresos, egresos }, ... }
 */
function agruparPorMes(transactions) {
  const meses = {};

  transactions.forEach((t) => {
    const fecha = t.fecha; // YYYY-MM-DD
    const mesKey = fecha.substring(0, 7); // YYYY-MM

    if (!meses[mesKey]) {
      meses[mesKey] = { ingresos: 0, egresos: 0 };
    }

    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      meses[mesKey].ingresos += monto;
    } else {
      meses[mesKey].egresos += monto;
    }
  });

  return meses;
}

/**
 * Renderiza gráfico de tendencia mensual (ingresos vs egresos)
 */
export async function renderizarGraficoTendencia() {
  const state = getState();
  const canvas = document.getElementById("chart-tendencia");
  if (!canvas) return;

  // Destruir instancia anterior
  if (chartTendenciaInstance) {
    chartTendenciaInstance.destroy();
    chartTendenciaInstance = null;
  }

  const datosPorMes = agruparPorMes(state.transactions);
  const mesesOrdenados = Object.keys(datosPorMes).sort();

  if (mesesOrdenados.length === 0) {
    canvas.style.display = "none";
    const fallback = document.getElementById("chart-tendencia-fallback");
    if (fallback) fallback.classList.remove("hidden");
    return;
  }

  canvas.style.display = "block";
  const fallback = document.getElementById("chart-tendencia-fallback");
  if (fallback) fallback.classList.add("hidden");

  const labels = mesesOrdenados.map((m) => {
    const [year, month] = m.split("-");
    return `${obtenerNombreMes(parseInt(month))} ${year}`;
  });

  const ingresos = mesesOrdenados.map((m) => datosPorMes[m].ingresos);
  const egresos = mesesOrdenados.map((m) => datosPorMes[m].egresos);

  const isDark = state.currentTheme === "dark";
  const Chart = await cargarChart();

  chartTendenciaInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Ingresos",
          data: ingresos,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
        },
        {
          label: "Egresos",
          data: egresos,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#ef4444",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: isDark ? "#94a3b8" : "#475569",
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.dataset.label}: $${context.raw.toLocaleString("es-ES")}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
            callback: (v) => `$${v.toLocaleString("es-ES")}`,
          },
          grid: {
            color: isDark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.2)",
          },
        },
        x: {
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

/**
 * Renderiza gráfico comparativo mes a mes
 */
export async function renderizarGraficoComparativa() {
  const state = getState();
  const canvas = document.getElementById("chart-comparativa");
  if (!canvas) return;

  // Destruir instancia anterior
  if (chartComparativaInstance) {
    chartComparativaInstance.destroy();
    chartComparativaInstance = null;
  }

  const datosPorMes = agruparPorMes(state.transactions);
  const mesesOrdenados = Object.keys(datosPorMes).sort();

  if (mesesOrdenados.length < 2) {
    canvas.style.display = "none";
    const fallback = document.getElementById("chart-comparativa-fallback");
    if (fallback) fallback.classList.remove("hidden");
    return;
  }

  canvas.style.display = "block";
  const fallback = document.getElementById("chart-comparativa-fallback");
  if (fallback) fallback.classList.add("hidden");

  const labels = mesesOrdenados.map((m) => {
    const [year, month] = m.split("-");
    return obtenerNombreMes(parseInt(month)).substring(0, 3);
  });

  const balances = mesesOrdenados.map(
    (m) => datosPorMes[m].ingresos - datosPorMes[m].egresos
  );

  const colores = balances.map((b) =>
    b >= 0 ? "rgba(16, 185, 129, 0.8)" : "rgba(239, 68, 68, 0.8)"
  );

  const isDark = state.currentTheme === "dark";
  const Chart = await cargarChart();

  chartComparativaInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Balance",
          data: balances,
          backgroundColor: colores,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = context.raw;
              return ` Balance: $${value.toLocaleString("es-ES")}`;
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
            callback: (v) => `$${v.toLocaleString("es-ES")}`,
          },
          grid: {
            color: isDark ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.2)",
          },
        },
        x: {
          ticks: {
            color: isDark ? "#94a3b8" : "#475569",
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

/**
 * Crea un gráfico de barras comparativas
 * @param {string} canvasId
 * @param {array} labels
 * @param {array} data
 */
export async function crearGraficoBarras(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const Chart = await cargarChart();

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Monto",
          data,
          backgroundColor: "#0284c7",
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
        },
      },
    },
  });
}

/**
 * Crea un gráfico de líneas
 * @param {string} canvasId
 * @param {array} labels
 * @param {array} data
 */
export async function crearGraficoLineas(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const Chart = await cargarChart();

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Tendencia",
          data,
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#0284c7",
          pointBorderColor: "#ffffff",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

/**
 * Destruye todos los gráficos
 */
export function destruirGraficos() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (chartTendenciaInstance) {
    chartTendenciaInstance.destroy();
    chartTendenciaInstance = null;
  }
  if (chartComparativaInstance) {
    chartComparativaInstance.destroy();
    chartComparativaInstance = null;
  }
}

export default {
  actualizarGraficoEgresos,
  renderizarDesgloseEgresos,
  renderizarGraficoTendencia,
  renderizarGraficoComparativa,
  crearGraficoBarras,
  crearGraficoLineas,
  destruirGraficos,
};
