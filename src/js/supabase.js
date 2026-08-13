/**
 * supabase.js
 * Cliente e integración con Supabase
 */

import { ENV, isSupabaseConfigured } from "./config.js";
import { setState, getState } from "./state.js";
import { mostrarToast } from "./ui.js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient = null;
let isConnected = false;
let lastConnectionError = null;
const USER_ID_FALLBACK = "00000000-0000-0000-0000-000000000000";

async function asegurarSesionSupabase() {
  if (!supabaseClient) return null;

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;
    if (session?.user?.id && !session.user.is_anonymous) {
      return session.user.id;
    }

    return null;
  } catch (error) {
    console.warn("No se pudo leer la sesión de Supabase:", error);
    return null;
  }
}

async function asegurarSesionAnonimaSupabase() {
  if (!supabaseClient) return null;

  try {
    const userId = await asegurarSesionSupabase();
    if (userId) return userId;

    const {
      data: { user },
      error: signInError,
    } = await supabaseClient.auth.signInAnonymously();

    if (signInError) throw signInError;
    return user?.id || null;
  } catch (error) {
    console.warn("No se pudo iniciar sesión anónima en Supabase:", error);
    return null;
  }
}

async function obtenerUserIdParaTransaccion(transaction) {
  const placeholderValue = transaction?.user_id;
  const isPlaceholder = placeholderValue === USER_ID_FALLBACK || placeholderValue === null || placeholderValue === undefined;

  if (placeholderValue && !isPlaceholder) {
    return placeholderValue;
  }

  const stateUserId = getState().userId;
  if (stateUserId && !stateUserId.startsWith?.("local_")) {
    return stateUserId;
  }

  const sessionUserId = await asegurarSesionSupabase();
  if (sessionUserId) {
    return sessionUserId;
  }

  const userId = await asegurarSesionAnonimaSupabase();
  if (userId) {
    return userId;
  }

  return USER_ID_FALLBACK;
}

/**
 * Inicializa el cliente de Supabase
 * @returns {Promise<boolean>}
 */
export async function inicializarSupabase() {
  if (!isSupabaseConfigured()) {
    lastConnectionError = "Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY";
    console.warn("Supabase no está configurado");
    mostrarToast("info", "Agrega tus credenciales de Supabase en el archivo .env para usar la nube");
    isConnected = false;
    return false;
  }

  try {
    supabaseClient = createClient(ENV.supabaseUrl, ENV.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;
    if (session?.user?.id && !session.user.is_anonymous) {
      const user = session.user;
      setState({
        userId: user.id,
        userName: user.user_metadata?.nombre || user.email || "Usuario",
        userEmail: user.email || "",
      });
    }

    const { error } = await supabaseClient
      .from("transacciones")
      .select("id", { head: true });

    if (error) {
      throw error;
    }

    isConnected = true;
    lastConnectionError = null;
    return true;
  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    isConnected = false;
    lastConnectionError = error?.message || "No se pudo conectar a Supabase";
    mostrarToast(
      "warning",
      "No se pudo conectar a Supabase. Revisa la URL, la key y las políticas RLS de la tabla transacciones"
    );
    return false;
  }
}

/**
 * Obtiene el cliente de Supabase
 * @returns {any}
 */
export function getSupabaseClient() {
  return supabaseClient;
}

/**
 * Verifica si Supabase está conectado
 * @returns {boolean}
 */
export function esSupabaseConectado() {
  return isConnected && supabaseClient !== null;
}

/**
 * Guarda una transacción en Supabase
 * @param {object} transaction
 * @returns {Promise<boolean>}
 */
export async function guardarTransaccionSupabase(transaction) {
  if (!esSupabaseConectado()) return false;

  try {
    const userId = await obtenerUserIdParaTransaccion(transaction);
    const payload = {
      ...transaction,
      user_id: userId,
    };

    const { data, error } = await supabaseClient
      .from("transacciones")
      .insert([payload]);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error guardando transacción:", error);
    mostrarToast("error", "Error al guardar en la nube");
    return false;
  }
}

/**
 * Actualiza una transacción en Supabase
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<boolean>}
 */
export async function actualizarTransaccionSupabase(id, updates) {
  if (!esSupabaseConectado()) return false;

  try {
    const { data, error } = await supabaseClient
      .from("transacciones")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error actualizando transacción:", error);
    mostrarToast("error", "Error al actualizar en la nube");
    return false;
  }
}

/**
 * Elimina una transacción de Supabase
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function eliminarTransaccionSupabase(id) {
  if (!esSupabaseConectado()) return false;

  try {
    const { error } = await supabaseClient
      .from("transacciones")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error eliminando transacción:", error);
    mostrarToast("error", "Error al eliminar de la nube");
    return false;
  }
}

/**
 * Obtiene todas las transacciones de Supabase
 * @returns {Promise<array>}
 */
export async function obtenerTransaccionesSupabase() {
  if (!esSupabaseConectado()) return [];

  try {
    const { data, error } = await supabaseClient
      .from("transacciones")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error obteniendo transacciones:", error);
    return [];
  }
}

/**
 * Suscribe a cambios en transacciones (realtime)
 * @param {function} callback
 */
export function suscribirATransacciones(callback) {
  if (!esSupabaseConectado()) return null;

  try {
    const subscription = supabaseClient
      .from("transacciones")
      .on("*", (payload) => {
        callback(payload);
      })
      .subscribe();

    return subscription;
  } catch (error) {
    console.error("Error suscribiendo a transacciones:", error);
    return null;
  }
}

/**
 * Desuscribe de cambios en transacciones
 * @param {any} subscription
 */
export async function desuscribirse(subscription) {
  if (!subscription) return;
  try {
    await subscription.unsubscribe();
  } catch (error) {
    console.error("Error desuscribiendo:", error);
  }
}

/**
 * Obtiene el estado de conexión
 * @returns {object}
 */
export function obtenerEstadoConexion() {
  return {
    conectado: isConnected,
    tieneConfig: isSupabaseConfigured(),
    tieneCliente: supabaseClient !== null,
    error: lastConnectionError,
  };
}

/**
 * Desconecta de Supabase
 */
export function desconectarSupabase() {
  isConnected = false;
  supabaseClient = null;
  lastConnectionError = null;
}

export default {
  inicializarSupabase,
  getSupabaseClient,
  esSupabaseConectado,
  guardarTransaccionSupabase,
  actualizarTransaccionSupabase,
  eliminarTransaccionSupabase,
  obtenerTransaccionesSupabase,
  suscribirATransacciones,
  desuscribirse,
  obtenerEstadoConexion,
  desconectarSupabase,
};
