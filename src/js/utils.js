/**
 * utils.js
 * Funciones utilitarias reutilizables
 */

import { APP_CONFIG } from "./config.js";

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapa texto antes de interpolarlo en HTML dinamico.
 * @param {any} value
 * @returns {string}
 */
export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Permite solo colores CSS esperados antes de usarlos en atributos style.
 * @param {any} value
 * @param {string} fallback
 * @returns {string}
 */
export function sanitizeCssColor(value, fallback = "#64748b") {
  const color = String(value ?? "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
    return color;
  }
  return fallback;
}

/**
 * Formatea un número como moneda
 * @param {number} valor - Valor a formatear
 * @returns {string} Valor formateado con símbolo de moneda
 */
export function formatMoneda(valor) {
  return (
    APP_CONFIG.currencySymbol +
    parseFloat(valor).toLocaleString(APP_CONFIG.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Formatea una fecha en formato texto legible
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @returns {string} Fecha formateada como dd/mm/aaaa
 */
export function formatearFechaTexto(fechaStr) {
  if (!fechaStr) return "";
  const partes = fechaStr.split("-");
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD
 * @returns {string} Fecha actual
 */
export function obtenerFechaHoy() {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const día = String(hoy.getDate()).padStart(2, "0");
  return `${año}-${mes}-${día}`;
}

/**
 * Calcula la diferencia entre dos números en porcentaje
 * @param {number} actual - Valor actual
 * @param {number} anterior - Valor anterior
 * @returns {number} Diferencia porcentual
 */
export function calcularDiferenciaPorcentaje(actual, anterior) {
  if (anterior === 0) return actual > 0 ? 100 : 0;
  return ((actual - anterior) / anterior) * 100;
}

/**
 * Valida si un email es válido
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
export function esEmailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Genera un ID único en formato UUID v4
 * (Supabase guarda el id como tipo uuid; los fallbacks deben cumplir ese formato)
 * @returns {string}
 */
export function generarId() {
  // Usar crypto.randomUUID si está disponible (evita colisiones)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 con criptografía real (contextos no seguros)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Último recurso: UUID v4 formateado manualmente
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const random = (Math.random() * 16) | 0;
    const value = c === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Copia texto al portapapeles
 * @param {string} texto - Texto a copiar
 * @returns {Promise<void>}
 */
export async function copiarAlPortapapeles(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (err) {
    console.error("Error al copiar:", err);
    return false;
  }
}

/**
 * Ordena un array de transacciones por fecha
 * @param {array} transacciones - Array a ordenar
 * @param {string} orden - 'asc' o 'desc' (por defecto 'desc')
 * @returns {array} Array ordenado
 */
export function ordenarPorFecha(transacciones, orden = "desc") {
  const copia = [...transacciones];
  return copia.sort((a, b) => {
    const fechaA = new Date(a.fecha);
    const fechaB = new Date(b.fecha);
    return orden === "desc" ? fechaB - fechaA : fechaA - fechaB;
  });
}

/**
 * Agrupa transacciones por categoría
 * @param {array} transacciones
 * @returns {object}
 */
export function agruparPorCategoria(transacciones) {
  return transacciones.reduce((acc, t) => {
    if (!acc[t.categoria]) {
      acc[t.categoria] = [];
    }
    acc[t.categoria].push(t);
    return acc;
  }, {});
}

/**
 * Calcula suma de transacciones
 * @param {array} transacciones
 * @returns {number}
 */
export function calcularTotal(transacciones) {
  return transacciones.reduce((sum, t) => sum + (parseFloat(t.monto) || 0), 0);
}

/**
 * Filtra transacciones por rango de fechas
 * @param {array} transacciones
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 * @returns {array}
 */
export function filtrarPorFechas(transacciones, fechaInicio, fechaFin) {
  return transacciones.filter((t) => {
    const fecha = new Date(t.fecha);
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    return fecha >= inicio && fecha <= fin;
  });
}

/**
 * Pausa la ejecución
 * @param {number} ms - Milisegundos
 * @returns {Promise}
 */
export function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Obtiene el nombre del mes
 * @param {number} numeroMes - 1-12
 * @returns {string}
 */
export function obtenerNombreMes(numeroMes) {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return meses[numeroMes - 1] || "";
}

/**
 * Detecta el tema del sistema
 * @returns {string} 'light' o 'dark'
 */
export function detectarTemaSistema() {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

export default {
  escapeHTML,
  sanitizeCssColor,
  formatMoneda,
  formatearFechaTexto,
  obtenerFechaHoy,
  calcularDiferenciaPorcentaje,
  esEmailValido,
  generarId,
  copiarAlPortapapeles,
  ordenarPorFecha,
  agruparPorCategoria,
  calcularTotal,
  filtrarPorFechas,
  esperar,
  obtenerNombreMes,
  detectarTemaSistema,
};
