/**
 * config.js
 * Configuración centralizada y variables de entorno
 */

// Variables de entorno de Vite
const viteEnv = import.meta.env || {};

const leerValorEnv = (valor) => {
  if (typeof valor !== "string") return "";
  return valor.trim();
};

const normalizarSupabaseUrl = (valor) => {
  const limpio = leerValorEnv(valor);
  if (!limpio) return "";

  if (/^https?:\/\//i.test(limpio)) {
    return limpio;
  }

  if (limpio.includes("supabase.co")) {
    return `https://${limpio.replace(/^https?:\/\//i, "")}`;
  }

  if (limpio.startsWith("sb_publishable_")) {
    return `https://${limpio}.supabase.co`;
  }

  return `https://${limpio}.supabase.co`;
};

export const ENV = {
  supabaseUrl: normalizarSupabaseUrl(viteEnv.VITE_SUPABASE_URL),
  supabaseKey: leerValorEnv(viteEnv.VITE_SUPABASE_ANON_KEY),
  appName: leerValorEnv(viteEnv.VITE_APP_NAME) || "Finanzas",
  appVersion: leerValorEnv(viteEnv.VITE_APP_VERSION) || "1.0.0",
};

// Configuración de la aplicación
export const APP_CONFIG = {
  debugMode: true,
  defaultTheme: "light", // 'light' o 'dark'
  toastDuration: 3500, // milisegundos
  animationDuration: 300, // milisegundos
  dateFormat: "YYYY-MM-DD",
  currencySymbol: "$",
  locale: "es-ES",
};

// URLs y rutas
export const ROUTES = {
  dashboard: "dashboard",
  egresos: "egresos",
  statistics: "statistics",
  settings: "settings",
};

// Verificar si Supabase está configurado
export const isSupabaseConfigured = () => {
  return ENV.supabaseUrl && ENV.supabaseKey;
};

export default {
  ENV,
  APP_CONFIG,
  ROUTES,
  isSupabaseConfigured,
};
