/**
 * utils.js
 * Funciones utilitarias reutilizables
 */

import { APP_CONFIG } from "./config.js";

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
 * Genera un ID único
 * @returns {string}
 */
export function generarId() {
  // Usar crypto.randomUUID si está disponible (evita colisiones)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
