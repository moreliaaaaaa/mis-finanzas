/**
 * supabase.js
 * Cliente e integración con Supabase
 */

import { ENV, isSupabaseConfigured } from "./config.js";
import { setState, getState } from "./state.js";
import { mostrarToast } from "./ui.js";
import { guardarEnStorage, obtenerDelStorage } from "./storage.js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient = null;
let isConnected = false;
let lastConnectionError = null;
const USER_ID_FALLBACK = "00000000-0000-0000-0000-000000000000";
const STORAGE_PENDIENTES = "pendientes";

// ---------------------------------------------------------------------------
// Cola de sincronización: los movimientos sin conexión quedan pendientes
// y se suben cuando la app detecta conexión con la nube.
// ---------------------------------------------------------------------------

function obtenerPendientes() {
  const pendientes = obtenerDelStorage(STORAGE_PENDIENTES);
  return Array.isArray(pendientes) ? pendientes : [];
}

function guardarPendientes(pendientes) {
  guardarEnStorage(STORAGE_PENDIENTES, pendientes);
}

function encolarPendiente(accion, id) {
  const pendientes = obtenerPendientes();
  if (pendientes.some((item) => item.accion === accion && item.id === id)) return;

  pendientes.push({ accion, id });
  guardarPendientes(pendientes);
  mostrarToast(
    "warning",
    "Guardado en este dispositivo. Se sincronizará con la nube cuando haya conexión."
  );
}

function quitarPendiente(accion, id) {
  const pendientes = obtenerPendientes().filter(
    (item) => !(item.accion === accion && item.id === id)
  );
  guardarPendientes(pendientes);
}

function esErrorDeSesion(error) {
  const mensaje = String(error?.message || "");
  const status = Number(error?.status || error?.code || 0);
  return (
    status === 401 ||
    status === 403 ||
    status === 42501 ||
    /jwt|rls|row.?level|policy|session|anon/i.test(mensaje)
  );
}

async function existeEnNube(id) {
  if (!supabaseClient) return false;
  const { data } = await supabaseClient
    .from("transacciones")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return !!data;
}

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
    let userId = await obtenerUserIdParaTransaccion(transaction);
    let { error } = await supabaseClient
      .from("transacciones")
      .insert([{ ...transaction, user_id: userId }]);

    if (error && esErrorDeSesion(error)) {
      // Reintentar con sesión anónima fresca (si el proyecto lo permite)
      const anonUserId = await asegurarSesionAnonimaSupabase();
      if (anonUserId && anonUserId !== userId) {
        const reintento = await supabaseClient
          .from("transacciones")
          .insert([{ ...transaction, user_id: anonUserId }]);
        error = reintento.error;
        userId = anonUserId;
      }
    }

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error guardando transacción:", error);
    encolarPendiente("insert", transaction.id);
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
    let { error } = await supabaseClient
      .from("transacciones")
      .update(updates)
      .eq("id", id);

    if (error && esErrorDeSesion(error)) {
      const anonUserId = await asegurarSesionAnonimaSupabase();
      if (anonUserId) {
        const reintento = await supabaseClient
          .from("transacciones")
          .update(updates)
          .eq("id", id);
        error = reintento.error;
      }
    }

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error actualizando transacción:", error);
    encolarPendiente("update", id);
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
    let { error } = await supabaseClient
      .from("transacciones")
      .delete()
      .eq("id", id);

    if (error && esErrorDeSesion(error)) {
      const anonUserId = await asegurarSesionAnonimaSupabase();
      if (anonUserId) {
        const reintento = await supabaseClient
          .from("transacciones")
          .delete()
          .eq("id", id);
        error = reintento.error;
      }
    }

    if (error) throw error;

    return true;
  } catch (error) {
    console.error("Error eliminando transacción:", error);
    encolarPendiente("delete", id);
    return false;
  }
}

/**
 * Elimina en Supabase los movimientos financieros cargados del usuario actual.
 * No toca perfiles, autenticación ni otros datos de cuenta.
 * @param {array} transactions
 * @returns {Promise<boolean>}
 */
export async function borrarTransaccionesSupabase(transactions = getState().transactions) {
  if (!esSupabaseConectado()) return true;

  const ids = [...new Set((transactions || []).map((t) => t?.id).filter(Boolean))];
  if (ids.length === 0) return true;
  const activeUserId = getState().userId;
  const shouldScopeByUser = activeUserId && !String(activeUserId).startsWith("local_");

  try {
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      let query = supabaseClient
        .from("transacciones")
        .delete()
        .in("id", lote);

      if (shouldScopeByUser) {
        query = query.eq("user_id", activeUserId);
      }

      const { error } = await query;

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error("Error borrando transacciones en Supabase:", error);
    mostrarToast(
      "warning",
      "Se limpiaron los datos de este dispositivo, pero no se pudo borrar todo en la nube."
    );
    return false;
  }
}

/**
 * Reintenta subir los movimientos pendientes que no pudieron sincronizarse.
 * Se usa al iniciar la app y cuando vuelve la conexión.
 * @returns {Promise<boolean>}
 */
export async function sincronizarPendientes() {
  if (!esSupabaseConectado()) return false;

  const pendientes = [...obtenerPendientes()];
  if (pendientes.length === 0) return true;

  let sincronizados = 0;

  for (const pendiente of pendientes) {
    const transaccion = getState().transactions.find(
      (tx) => tx.id === pendiente.id
    );

    try {
      if (pendiente.accion === "insert" && transaccion) {
        const yaExiste = await existeEnNube(transaccion.id);
        if (yaExiste) {
          quitarPendiente("insert", pendiente.id);
          sincronizados++;
          continue;
        }
        const userId = await obtenerUserIdParaTransaccion(transaccion);
        const { error } = await supabaseClient
          .from("transacciones")
          .insert([{ ...transaccion, user_id: userId }]);
        if (error) throw error;
        quitarPendiente("insert", pendiente.id);
        sincronizados++;
      } else if (pendiente.accion === "update" && transaccion) {
        const { error } = await supabaseClient
          .from("transacciones")
          .update(transaccion)
          .eq("id", transaccion.id);
        if (error) throw error;
        quitarPendiente("update", pendiente.id);
        sincronizados++;
      } else if (pendiente.accion === "delete") {
        const { error } = await supabaseClient
          .from("transacciones")
          .delete()
          .eq("id", pendiente.id);
        if (error) throw error;
        quitarPendiente("delete", pendiente.id);
        sincronizados++;
      }
    } catch (error) {
      console.warn("Pendiente aun no sincronizado:", pendiente, error);
    }
  }

  if (sincronizados > 0) {
    mostrarToast("success", `Sincronizado con la nube (${sincronizados} movimiento(s))`);
  }

  return sincronizados > 0;
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
  sincronizarPendientes,
  suscribirATransacciones,
  desuscribirse,
  obtenerEstadoConexion,
  desconectarSupabase,
};
