/**
 * modules/export.js
 * Exportación a CSV, JSON y PDF
 */

import { getState } from "../state.js";
import { mostrarToast } from "../ui.js";
import { CATEGORIAS, MENSAJES } from "../constants.js";
import { formatMoneda, formatearFechaTexto, obtenerFechaHoy } from "../utils.js";

/**
 * Exporta transacciones a CSV
 */
export function exportarCSV() {
  const state = getState();

  if (state.transactions.length === 0) {
    mostrarToast("error", MENSAJES.error.noHayDatos);
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "ID,Fecha,Tipo,Categoría,Monto,Detalle\n";

  const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];

  state.transactions.forEach((t) => {
    const catObj = todasLas.find((c) => c.id === t.categoria);
    const nombreCat = catObj ? catObj.label : t.categoria;
    const detalleEscapado = `"${(t.detalle || "Sin detalle").replace(/"/g, '""')}"`;

    csvContent += `${t.id},${t.fecha},${t.tipo},${nombreCat},${t.monto},${detalleEscapado}\n`;
  });

  descargarArchivo(
    csvContent,
    `Finanzas_Export_${obtenerFechaHoy()}.csv`,
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
  };

  const jsonContent =
    "data:application/json;charset=utf-8," + JSON.stringify(data, null, 2);
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
  const encodedUri = encodeURI(content);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

  const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];

  state.transactions.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;

    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }

    const catObj = todasLas.find((c) => c.id === t.categoria);
    const nombreCat = catObj ? catObj.label : t.categoria;

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
  const content =
    "data:application/json;charset=utf-8," + JSON.stringify(reporte, null, 2);
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
export function exportarPDF() {
  const state = getState();

  if (state.transactions.length === 0) {
    mostrarToast("error", MENSAJES.error.noHayDatos);
    return;
  }

  let totalIngresos = 0;
  let totalEgresos = 0;

  const todasLas = [...CATEGORIAS.ingreso, ...CATEGORIAS.egreso];

  state.transactions.forEach((t) => {
    const monto = parseFloat(t.monto) || 0;
    if (t.tipo === "ingreso") {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
    }
  });

  const balance = totalIngresos - totalEgresos;

  // Generar HTML del reporte
  let tablaHTML = "";
  state.transactions.forEach((t) => {
    const catObj = todasLas.find((c) => c.id === t.categoria);
    const nombreCat = catObj ? catObj.label : t.categoria;
    const tipoLabel = t.tipo === "ingreso" ? "Ingreso" : "Egreso";
    const color = t.tipo === "ingreso" ? "#059669" : "#dc2626";

    tablaHTML += `
      <tr>
        <td>${formatearFechaTexto(t.fecha)}</td>
        <td><span style="color:${color};font-weight:600">${tipoLabel}</span></td>
        <td>${nombreCat}</td>
        <td style="text-align:right;font-weight:600">${formatMoneda(t.monto)}</td>
        <td>${t.detalle || "-"}</td>
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
      <div class="footer">
        <p>MisFinanzas - Control inteligente de finanzas | ${state.transactions.length} transacciones</p>
      </div>
    </body>
    </html>
  `;

  // Abrir ventana de impresión
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlPDF);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    mostrarToast("success", "Reporte PDF listo para imprimir/guardar");
  } else {
    mostrarToast("error", "El navegador bloqueó la ventana emergente. Permite ventanas emergentes para exportar PDF.");
  }
}

export default {
  exportarCSV,
  exportarJSON,
  generarReporte,
  exportarPDF,
};
