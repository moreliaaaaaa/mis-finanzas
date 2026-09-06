import { getState, setState } from "../state.js";
import { guardarEnStorage, obtenerDelStorage } from "../storage.js";
import { getSupabaseClient, obtenerTransaccionesSupabase, sincronizarPendientes, listarPendientes } from "../supabase.js";
import { mostrarToast } from "../ui.js";
import { sincronizarPeriodoCuenta } from "./period-sync.js";
import { fusionarMovimientos } from "./sync-core.js";

let running = null;
let lastError = "";
let stop = null;
const snapshot = () => JSON.stringify([getState().transactions, listarPendientes()]);

export function sincronizarCuenta(onRefresh = () => {}) {
  if (running) return running;
  running = (async () => {
    const client = getSupabaseClient();
    const userId = getState().userId;
    if (!client || !userId || navigator.onLine === false) return;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user?.id !== userId || data.session.user.is_anonymous) return;
      // Guardar primero la cola local; consultar después evita perderla al iniciar.
      await sincronizarPendientes();
      const before = snapshot();
      const remote = await obtenerTransaccionesSupabase();
      if (getState().userId !== userId) return;
      if (before === snapshot()) {
        const local = getState().transactions;
        // Conservar una copia anterior a la primera adopción del estado de la nube.
        if (!obtenerDelStorage("transactions_before_cloud_sync")) {
          guardarEnStorage("transactions_before_cloud_sync", { savedAt: new Date().toISOString(), transactions: local });
        }
        const transactions = fusionarMovimientos(remote, local, listarPendientes());
        if (JSON.stringify(transactions) !== JSON.stringify(local)) {
          setState({ transactions });
          onRefresh();
        }
      }
      const period = await sincronizarPeriodoCuenta(client, userId);
      if (getState().userId !== userId) return;
      if (period?.conflict) mostrarToast("warning", "El período cambió en otro dispositivo. Se cargó el compartido y se guardó una copia local del anterior.");
      if (period?.changed) onRefresh();
      lastError = "";
    } catch (error) {
      const message = error?.message || "Error de conexión";
      console.warn("No se completó la sincronización:", message);
      if (message !== lastError) {
        mostrarToast("warning", "No se pudo completar la sincronización. Los datos mostrados pueden estar desactualizados.");
        lastError = message;
      }
    }
  })().finally(() => { running = null; });
  return running;
}

export function iniciarSincronizacionCuenta(onRefresh) {
  stop?.();
  const refresh = () => {
    if (document.visibilityState !== "hidden") void sincronizarCuenta(onRefresh);
  };
  const timer = window.setInterval(refresh, 15000);
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  window.addEventListener("financial-period-change", refresh);
  document.addEventListener("visibilitychange", refresh);
  stop = () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("online", refresh);
    window.removeEventListener("financial-period-change", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
  return sincronizarCuenta(onRefresh);
}
