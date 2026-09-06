/**
 * storage.js
 * Gestión de almacenamiento local para la aplicación Mis Finanzas
 */

const STORAGE_KEY = "misfinanzas_data";
const STORAGE_THEME_KEY = "misfinanzas_theme";
const STORAGE_PERIOD_KEY = "misfinanzas_period";

// Alcance por usuario: los datos se guardan con un sufijo por usuario para que
// cada cuenta tenga su propio respaldo local en el mismo navegador.
let alcanceStorage = null;

// Estas claves son globales (no dependen del usuario)
const CLAVES_GLOBALES = new Set(["misfinanzas_users", "misfinanzas_session"]);

/**
 * Define el alcance (usuario) para las claves de datos locales.
 * @param {string|null} userId
 */
export function definirAlcanceStorage(userId) {
  if (!userId) {
    alcanceStorage = null;
    return;
  }
  alcanceStorage = String(userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12);
}

function sufijoAlcance(key) {
  if (!alcanceStorage || CLAVES_GLOBALES.has(key)) return "";
  return `_${alcanceStorage}`;
}

/**
 * Guarda datos en LocalStorage
 * @param {string} key
 * @param {any} data
 */
export function guardarEnStorage(key, data) {
  try {
    const fullKey = `${STORAGE_KEY}_${key}${sufijoAlcance(key)}`;
    localStorage.setItem(fullKey, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Error guardando en storage:", error);
    return false;
  }
}

/**
 * Obtiene datos del LocalStorage
 * @param {string} key
 * @returns {any}
 */
export function obtenerDelStorage(key) {
  try {
    const fullKey = `${STORAGE_KEY}_${key}${sufijoAlcance(key)}`;
    const data = localStorage.getItem(fullKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error leyendo del storage:", error);
    return null;
  }
}

/**
 * Elimina datos del LocalStorage
 * @param {string} key
 */
export function eliminarDelStorage(key) {
  try {
    const fullKey = `${STORAGE_KEY}_${key}${sufijoAlcance(key)}`;
    localStorage.removeItem(fullKey);
    return true;
  } catch (error) {
    console.error("Error eliminando del storage:", error);
    return false;
  }
}

/**
 * Limpia todo el storage
 */
export function limpiarStorage() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY)) {
        localStorage.removeItem(key);
      }
    });
    return true;
  } catch (error) {
    console.error("Error limpiando storage:", error);
    return false;
  }
}

/**
 * Limpia solo datos financieros del usuario actual.
 * Mantiene cuenta, sesión, perfil, foto, nombre, correo y categorías.
 */
export function limpiarDatosFinancierosStorage() {
  try {
    ["transactions", "tipoActivoForm", "filtroHistorial", "pendientes", "presupuestos"].forEach(
      (key) => eliminarDelStorage(key)
    );
    eliminarPeriodoStorage();
    localStorage.removeItem("misfinanzas_clean_start");
    return true;
  } catch (error) {
    console.error("Error limpiando datos financieros:", error);
    return false;
  }
}

/**
 * Exporta toda la información para backup
 * @returns {object}
 */
export function exportarBackup() {
  try {
    const backup = {};
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY)) {
        const newKey = key.replace(STORAGE_KEY + "_", "");
        backup[newKey] = localStorage.getItem(key);
      }
    });

    return backup;
  } catch (error) {
    console.error("Error exportando backup:", error);
    return null;
  }
}

/**
 * Importa datos de backup
 * @param {object} backup
 */
export function importarBackup(backup) {
  try {
    Object.entries(backup).forEach(([key, value]) => {
      const fullKey = `${STORAGE_KEY}_${key}`;
      localStorage.setItem(fullKey, value);
    });
    return true;
  } catch (error) {
    console.error("Error importando backup:", error);
    return false;
  }
}

/**
 * Obtiene el tamaño del storage en KB
 * @returns {number}
 */
export function obtenerTamañoStorage() {
  try {
    let size = 0;
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY)) {
        size += localStorage.getItem(key).length;
      }
    });

    return Math.round(size / 1024);
  } catch (error) {
    console.error("Error calculando tamaño:", error);
    return 0;
  }
}

/**
 * Guarda el tema
 * @param {string} theme
 */
export function guardarTema(theme) {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  } catch (error) {
    console.error("Error guardando tema:", error);
  }
}

/**
 * Obtiene el tema guardado
 * @returns {string}
 */
export function obtenerTema() {
  try {
    return localStorage.getItem(STORAGE_THEME_KEY) || "light";
  } catch (error) {
    console.error("Error obteniendo tema:", error);
    return "light";
  }
}

/**
 * Guarda los datos del periodo en LocalStorage
 * @param {object} periodData - { periodDay, savings, debt, currentPeriodStart, currentPeriodEnd, periodHistory }
 */
export function guardarPeriodoStorage(periodData, sync = null) {
  try {
    const fullKey = `${STORAGE_PERIOD_KEY}${sufijoAlcance("misfinanzas_period")}`;
    localStorage.setItem(fullKey, JSON.stringify(periodData));
    const previous = obtenerDelStorage("period_sync") || {};
    guardarEnStorage("period_sync", sync || { ...previous, pending: true });
    if (!sync && typeof window !== "undefined") {
      window.dispatchEvent(new Event("financial-period-change"));
    }
    return true;
  } catch (error) {
    console.error("Error guardando periodo:", error);
    return false;
  }
}

/**
 * Obtiene los datos del periodo desde LocalStorage
 * @returns {object|null}
 */
export function obtenerPeriodoStorage() {
  try {
    const fullKey = `${STORAGE_PERIOD_KEY}${sufijoAlcance("misfinanzas_period")}`;
    const data = localStorage.getItem(fullKey);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error leyendo periodo:", error);
    return null;
  }
}

/**
 * Elimina los datos del periodo financiero del usuario actual.
 */
export function eliminarPeriodoStorage() {
  try {
    const fullKey = `${STORAGE_PERIOD_KEY}${sufijoAlcance("misfinanzas_period")}`;
    localStorage.removeItem(fullKey);
    return true;
  } catch (error) {
    console.error("Error eliminando periodo:", error);
    return false;
  }
}

/**
 * Descarga un archivo de backup JSON
 * @param {object} data
 * @param {string} filename
 */
export function descargarBackup(data, filename = "misfinanzas_backup.json") {
  try {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Error descargando backup:", error);
    return false;
  }
}

export default {
  definirAlcanceStorage,
  guardarEnStorage,
  obtenerDelStorage,
  eliminarDelStorage,
  limpiarStorage,
  limpiarDatosFinancierosStorage,
  exportarBackup,
  importarBackup,
  obtenerTamañoStorage,
  guardarTema,
  obtenerTema,
  guardarPeriodoStorage,
  obtenerPeriodoStorage,
  eliminarPeriodoStorage,
  descargarBackup,
};
