/**
 * modules/charts.js
 * Gestión de gráficos con Chart.js
 */

import Chart from "chart.js/auto";
import { getState } from "../state.js";
import { CATEGORIAS, COLORES_CATEGORIAS } from "../constants.js";
import { obtenerNombreMes } from "../utils.js";

let chartInstance = null;
let chartTendenciaInstance = null;
let chartComparativaInstance = null;

/**
 * Actualiza el gráfico de egresos
 */
export function actualizarGraficoEgresos() {
  const state = getState();
  const ctx = document.getElementById("chart-egresos-container");
  const fallback = document.getElementById("chart-fallback");

  if (!ctx) return;

  // Calcular totales por categoría
  const totalesPorCategoria = {};
  CATEGORIAS.egreso.forEach((cat) => {
    totalesPorCategoria[cat.id] = 0;
  });

  let hayEgresos = false;
  state.transactions.forEach((t) => {
    if (t.tipo === "egreso" && t.categoria in totalesPorCategoria) {
      totalesPorCategoria[t.categoria] += parseFloat(t.monto) || 0;
      hayEgresos = true;
    }
  });

  if (!hayEgresos) {
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

  const labels = [];
  const dataValues = [];
  const backgroundColors = [];

  CATEGORIAS.egreso.forEach((cat) => {
    const total = totalesPorCategoria[cat.id];
    if (total > 0) {
      labels.push(cat.label);
      dataValues.push(total);
      backgroundColors.push(COLORES_CATEGORIAS[cat.id] || "#cbd5e1");
    }
  });

  // Destruir instancia anterior
  if (chartInstance) {
    chartInstance.destroy();
  }

  const isDark = state.currentTheme === "dark";

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
export function renderizarGraficoTendencia() {
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
export function renderizarGraficoComparativa() {
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
export function crearGraficoBarras(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

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
export function crearGraficoLineas(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

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
  renderizarGraficoTendencia,
  renderizarGraficoComparativa,
  crearGraficoBarras,
  crearGraficoLineas,
  destruirGraficos,
};
