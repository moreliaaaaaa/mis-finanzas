/**
 * modules/export.js
 * Exportación a CSV, JSON y PDF
 */

import { getState } from "../state.js";
import { mostrarToast } from "../ui.js";
import { CATEGORIAS, MENSAJES } from "../constants.js";
import { escapeHTML, formatMoneda, formatearFechaTexto, obtenerFechaHoy } from "../utils.js";
import { periodoVisible } from "./period-dates.js";

function neutralizarFormulaCSV(value) {
  const text = String(value ?? "");
  return /^[\s]*[=+\-@]|\t|\r/.test(text) ? `'${text}` : text;
}

function celdaCSV(value) {
  const segura = neutralizarFormulaCSV(value).replace(/"/g, '""');
  return `"${segura}"`;
}

function etiquetaCategoria(categoriaId) {
  const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];
  const catObj = todasLas.find((c) => c.id === categoriaId);
  return catObj ? catObj.label : categoriaId;
}

export function obtenerDatosPeriodoActual(state = getState(), now = new Date()) {
  const { start, end } = periodoVisible(state, now);
  const transactions = (state.transactions || []).filter(
    (transaction) => transaction.fecha >= start && transaction.fecha <= end
  );
  const savingsTransfers = (state.savingsTransfers || []).filter(
    (transfer) => transfer.fecha >= start && transfer.fecha <= end
  );

  return { start, end, transactions, savingsTransfers };
}

export function obtenerDatosPeriodoHistorico(entry, state = getState()) {
  if (!entry?.start || !entry?.end) return null;

  return {
    start: entry.start,
    end: entry.end,
    transactions: Array.isArray(entry.transactions)
      ? entry.transactions
      : (state.transactions || []).filter(
          (transaction) => transaction.fecha >= entry.start && transaction.fecha <= entry.end
        ),
    savingsTransfers: Array.isArray(entry.savingsTransfers)
      ? entry.savingsTransfers
      : (state.savingsTransfers || []).filter(
          (transfer) => transfer.fecha >= entry.start && transfer.fecha <= entry.end
        ),
  };
}

/**
 * Exporta transacciones a CSV
 */
export function exportarCSV(datos = null) {
  const exportData = datos || obtenerDatosPeriodoActual(getState());
  const { start, end, transactions, savingsTransfers } = exportData;

  if (transactions.length === 0) {
    mostrarToast("error", MENSAJES.error.noHayDatos);
    return;
  }

  const rows = [["ID", "Fecha", "Tipo", "Categoría", "Monto", "Detalle"]];

  transactions.forEach((t) => {
    rows.push([
      t.id,
      t.fecha,
      t.tipo,
      etiquetaCategoria(t.categoria),
      t.monto,
      t.detalle || "Sin detalle",
    ]);
  });
  savingsTransfers.forEach((item) => {
    rows.push([item.id, item.fecha, "transferencia_ahorro", "Ahorro al balance", item.monto, item.detalle || "Uso de ahorro"]);
  });

  const csvContent = `\uFEFF${rows.map((row) => row.map(celdaCSV).join(",")).join("\n")}\n`;

  descargarArchivo(
    csvContent,
    `Finanzas_Periodo_${start}_${end}.csv`,
    "text/csv",
  );
  mostrarToast("success", MENSAJES.success.descargar);
}

/**
 * Exporta transacciones a JSON
 */
export function exportarJSON() {
  const state = getState();

  if (state.transactions.length === 0) {
    mostrarToast("error", MENSAJES.error.noHayDatos);
    return;
  }

  const data = {
    exportDate: new Date().toISOString(),
    transactionCount: state.transactions.length,
    transactions: state.transactions,
    savings: state.savings,
    savingsTransfers: state.savingsTransfers || [],
    periodHistory: state.periodHistory,
  };

  const jsonContent = JSON.stringify(data, null, 2);
  descargarArchivo(
    jsonContent,
    `Finanzas_Export_${obtenerFechaHoy()}.json`,
    "application/json",
  );
  mostrarToast("success", MENSAJES.success.descargar);
}

/**
 * Descarga un archivo
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function descargarArchivo(content, filename, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera reporte de resumen
 */
export function generarReporte() {
  const state = getState();

  if (state.transactions.length === 0) {
    mostrarToast("error", "No hay datos para generar reporte");
    return;
  }

  let totalIngresos = 0;
  let totalEgresos = 0;
  const porCategoria = {};

  state.transactions.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;

    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }

    const nombreCat = etiquetaCategoria(t.categoria);

    if (!porCategoria[nombreCat]) {
      porCategoria[nombreCat] = { monto: 0, cantidad: 0 };
    }

    porCategoria[nombreCat].monto += monto;
    porCategoria[nombreCat].cantidad += 1;
  });

  const reporte = {
    generado: new Date().toISOString(),
    resumen: {
      totalIngresos,
      totalEgresos,
      balance: totalIngresos - totalEgresos,
      transacciones: state.transactions.length,
    },
    porCategoria,
  };

  // Descargarlo
  const content = JSON.stringify(reporte, null, 2);
  descargarArchivo(
    content,
    `Reporte_${obtenerFechaHoy()}.json`,
    "application/json",
  );
  mostrarToast("success", "Reporte generado y descargado");
}

/**
 * Exporta reporte como PDF (abre ventana de impresión)
 */
export function exportarPDF(datos = null) {
  const state = getState();
  const exportData = datos || obtenerDatosPeriodoActual(state);
  const { start, end, transactions, savingsTransfers } = exportData;

  if (transactions.length === 0) {
    mostrarToast("error", MENSAJES.error.noHayDatos);
    return;
  }

  let totalIngresos = 0;
  let totalEgresos = 0;

  transactions.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }
  });

  const balance = totalIngresos - totalEgresos;

  const transferenciasHTML = savingsTransfers.length ? `
    <section style="margin-top:2rem">
      <h2 style="font-size:1.1rem;margin-bottom:0.5rem">Transferencias desde ahorro</h2>
      <p style="font-size:0.8rem;margin-bottom:1rem">Movimientos internos: no aumentan los ingresos totales del reporte.</p>
      <table><thead><tr><th>Fecha</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${savingsTransfers.map((item) => `<tr><td>${escapeHTML(formatearFechaTexto(item.fecha))}</td><td>${escapeHTML(item.detalle || "Uso de ahorro")}</td><td style="text-align:right">${escapeHTML(formatMoneda(item.monto))}</td></tr>`).join("")}</tbody></table>
    </section>` : "";

  // Generar HTML del reporte
  let tablaHTML = "";
  transactions.forEach((t) => {
    const nombreCat = escapeHTML(etiquetaCategoria(t.categoria));
    const tipoLabel = t.tipo === "ingreso" ? "Ingreso" : "Egreso";
    const color = t.tipo === "ingreso" ? "#059669" : "#dc2626";
    const fecha = escapeHTML(formatearFechaTexto(t.fecha));
    const monto = escapeHTML(formatMoneda(t.monto));
    const detalle = escapeHTML(t.detalle || "-");

    tablaHTML += `
      <tr>
        <td>${fecha}</td>
        <td><span style="color:${color};font-weight:600">${tipoLabel}</span></td>
        <td>${nombreCat}</td>
        <td style="text-align:right;font-weight:600">${monto}</td>
        <td>${detalle}</td>
      </tr>
    `;
  });

  const htmlPDF = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte Financiero - Morelia Finanzas</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 2rem; color: #1e293b; }
        .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #0284c7; }
        .header h1 { font-size: 1.8rem; color: #0284c7; margin-bottom: 0.25rem; }
        .header p { color: #64748b; font-size: 0.9rem; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .summary-card { padding: 1rem; border-radius: 0.5rem; text-align: center; }
        .summary-card.ingreso { background: #ecfdf5; border: 1px solid #a7f3d0; }
        .summary-card.egreso { background: #fef2f2; border: 1px solid #fecaca; }
        .summary-card.balance { background: #f0f9ff; border: 1px solid #bae6fd; }
        .summary-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.25rem; }
        .summary-value { font-size: 1.25rem; font-weight: 700; }
        .summary-card.ingreso .summary-value { color: #059669; }
        .summary-card.egreso .summary-value { color: #dc2626; }
        .summary-card.balance .summary-value { color: #0284c7; }
        table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        th { background: #f1f5f9; padding: 0.6rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 0.5rem 0.6rem; border-bottom: 1px solid #f1f5f9; }
        tr:hover { background: #f8fafc; }
        .footer { margin-top: 2rem; text-align: center; font-size: 0.75rem; color: #94a3b8; }
        @media print { body { padding: 1rem; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Morelia Finanzas</h1>
        <p>Reporte financiero generado el ${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <div class="summary">
        <div class="summary-card ingreso">
          <div class="summary-label">Ingresos Totales</div>
          <div class="summary-value">${formatMoneda(totalIngresos)}</div>
        </div>
        <div class="summary-card egreso">
          <div class="summary-label">Egresos Totales</div>
          <div class="summary-value">${formatMoneda(totalEgresos)}</div>
        </div>
        <div class="summary-card balance">
          <div class="summary-label">Balance Neto</div>
          <div class="summary-value">${formatMoneda(balance)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th style="text-align:right">Monto</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          ${tablaHTML}
        </tbody>
      </table>
      ${transferenciasHTML}
      <div class="footer">
        <p>MisFinanzas - Reporte del periodo ${formatearFechaTexto(start)} - ${formatearFechaTexto(end)} | ${transactions.length} transacciones</p>
      </div>
      <script>
        window.addEventListener("load", () => {
          setTimeout(() => window.print(), 300);
        });
      </script>
    </body>
    </html>
  `;

  // Abrir ventana de impresión
  const reporteBlob = new Blob([htmlPDF], { type: "text/html;charset=utf-8" });
  const reporteUrl = URL.createObjectURL(reporteBlob);
  const printWindow = window.open(reporteUrl, "_blank");
  if (printWindow) {
    setTimeout(() => URL.revokeObjectURL(reporteUrl), 60000);
    mostrarToast("success", "Reporte PDF listo para imprimir/guardar");
  } else {
    URL.revokeObjectURL(reporteUrl);
    mostrarToast("error", "El navegador bloqueó la ventana emergente. Permite ventanas emergentes para exportar PDF.");
  }
}

export function exportarPeriodoHistoricoCSV(entry) {
  const datos = obtenerDatosPeriodoHistorico(entry);
  if (datos) exportarCSV(datos);
}

export function exportarPeriodoHistoricoPDF(entry) {
  const datos = obtenerDatosPeriodoHistorico(entry);
  if (datos) exportarPDF(datos);
}

export default {
  exportarCSV,
  exportarJSON,
  generarReporte,
  exportarPDF,
  obtenerDatosPeriodoActual,
  obtenerDatosPeriodoHistorico,
  exportarPeriodoHistoricoCSV,
  exportarPeriodoHistoricoPDF,
};
