/**
 * supabase.js
 * Cliente e integración con Supabase
 */

import { ENV, isSupabaseConfigured } from "./config.js";
import { setState, getState } from "./state.js";
import { mostrarToast } from "./ui.js";
import { guardarEnStorage, obtenerDelStorage } from "./storage.js";

let supabaseClient = null;
let isConnected = false;
let lastConnectionError = null;
let supabaseSdkLoader = null;
const STORAGE_PENDIENTES = "pendientes";

async function cargarSupabaseSdk() {
  if (!supabaseSdkLoader) {
    supabaseSdkLoader = import("@supabase/supabase-js");
  }

  return supabaseSdkLoader;
}

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

let pendingSync = null;

export function listarPendientes() { return obtenerPendientes(); }

async function guardarOperacionPendiente(accion, id, data) {
  if (!isSupabaseConfigured() || !getState().userId) return false;
  const token = crypto.randomUUID();
  const previous = obtenerPendientes().find((item) => item.id === id);
  // Una edición de una inserción aún pendiente sigue siendo una inserción.
  if (accion === "update" && previous?.accion === "insert") accion = "insert";
  guardarPendientes([
    ...obtenerPendientes().filter((item) => item.id !== id),
    { accion, id, data, token },
  ]);
  await sincronizarPendientes();
  const saved = !obtenerPendientes().some((item) => item.token === token);
  if (!saved) mostrarToast("warning", "Guardado en este dispositivo. Pendiente de sincronizar con la nube.");
  return saved;
}

async function subirPendientes() {
  if (!supabaseClient) return false;
  let userId;
  try { userId = await requerirSesionSupabase(); }
  catch { return false; }
  if (getState().userId !== userId) return false;
  for (const item of [...obtenerPendientes()]) {
    if (getState().userId !== userId) return false;
    try {
      const data = item.data || getState().transactions.find((tx) => tx.id === item.id);
      let result;
      if (item.accion === "delete") {
        result = await supabaseClient.from("transacciones").delete()
          .eq("id", item.id).eq("user_id", userId);
      } else if (data) {
        const payload = Object.fromEntries(["id", "tipo", "categoria", "monto", "fecha", "detalle", "timestamp"]
          .filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
        if (item.accion === "insert") {
          result = await supabaseClient.from("transacciones")
            .upsert({ ...payload, user_id: userId }, { onConflict: "id" });
        } else {
          result = await supabaseClient.from("transacciones").update(payload)
            .eq("id", item.id).eq("user_id", userId).select("id");
          if (!result.error && result.data.length === 0) throw new Error("El movimiento ya no existe en la nube.");
        }
      } else {
        throw new Error("Falta el contenido del movimiento pendiente.");
      }
      if (result.error) throw result.error;
      if (getState().userId !== userId) return false;
      guardarPendientes(obtenerPendientes().filter((pending) =>
        !(pending.id === item.id && pending.accion === item.accion && pending.token === item.token)));
    } catch (error) {
      console.warn("Movimiento pendiente de sincronizar:", error.message);
    }
  }
  return obtenerPendientes().length === 0;
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

async function requerirSesionSupabase() {
  const userId = await asegurarSesionSupabase();
  if (!userId) {
    throw new Error("Se requiere una sesión real de Supabase para sincronizar transacciones.");
  }
  return userId;
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
    const { createClient } = await cargarSupabaseSdk();

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
    if (session?.user?.is_anonymous) {
      await supabaseClient.auth.signOut();
    } else if (session?.user?.id) {
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
  return guardarOperacionPendiente("insert", transaction.id, transaction);
}

/**
 * Actualiza una transacción en Supabase
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<boolean>}
 */
export async function actualizarTransaccionSupabase(id, updates) {
  const transaction = getState().transactions.find((tx) => tx.id === id);
  return guardarOperacionPendiente("update", id, { ...transaction, ...updates });
}

/**
 * Elimina una transacción de Supabase
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function eliminarTransaccionSupabase(id) {
  return guardarOperacionPendiente("delete", id);
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

  try {
    const activeUserId = await requerirSesionSupabase();
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { error } = await supabaseClient
        .from("transacciones")
        .delete()
        .in("id", lote)
        .eq("user_id", activeUserId);

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
  if (pendingSync) return pendingSync;
  pendingSync = subirPendientes().finally(() => { pendingSync = null; });
  return pendingSync;
}

/**
 * Obtiene todas las transacciones de Supabase
 * @returns {Promise<array>}
 */
export async function obtenerTransaccionesSupabase() {
  const userId = await requerirSesionSupabase();
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseClient.from("transacciones")
      .select("*").eq("user_id", userId)
      .order("fecha", { ascending: false }).order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
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
  desuscribirse,
  obtenerEstadoConexion,
  desconectarSupabase,
};
