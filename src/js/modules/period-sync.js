import { getState, setState } from "../state.js";
import { obtenerPeriodoStorage, guardarPeriodoStorage, obtenerDelStorage, guardarEnStorage } from "../storage.js";
import { decidirPeriodo, periodoValido } from "./sync-core.js";

export async function sincronizarPeriodoCuenta(client, userId) {
  const local = obtenerPeriodoStorage();
  if (!periodoValido(local)) throw new Error("El período local no tiene fechas válidas.");
  const meta = obtenerDelStorage("period_sync") || {};
  const snapshot = JSON.stringify(local);
  const read = async () => {
    const { data, error } = await client.from("periodos_financieros")
      .select("datos, revision").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data;
  };
  let remote = await read();
  if (getState().userId !== userId) return;
  let action = decidirPeriodo(local, meta, remote);
  let wrote = false;

  if (action === "create") {
    // DO NOTHING ante una creación simultánea: la segunda copia lee la ganadora.
    const { error } = await client.from("periodos_financieros").upsert(
      { user_id: userId, datos: local, revision: 1 },
      { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw error;
    remote = await read();
  } else if (action === "update") {
    const { data, error } = await client.from("periodos_financieros")
      .update({ datos: local, revision: remote.revision + 1 })
      .eq("user_id", userId).eq("revision", remote.revision)
      .select("datos, revision").maybeSingle();
    if (error) throw error;
    wrote = !!data;
    remote = data || await read();
  }

  if (getState().userId !== userId) return;
  if (!periodoValido(remote?.datos)) throw new Error("El período recibido de la nube no es válido.");
  // Si el usuario editó durante la petición, no pisar esa edición.
  if (JSON.stringify(obtenerPeriodoStorage()) !== snapshot) {
    if (wrote) guardarEnStorage("period_sync", { revision: remote.revision, pending: true });
    return;
  }
  const different = JSON.stringify(remote.datos) !== snapshot;
  if (different) {
    const backups = obtenerDelStorage("period_backups") || [];
    guardarEnStorage("period_backups", [...backups, {
      savedAt: new Date().toISOString(), datos: local, revision: meta.revision ?? null,
    }]);
  }
  guardarPeriodoStorage(remote.datos, { revision: remote.revision, pending: false });
  if (different) {
    const { periodDay, savings, debt, currentPeriodStart, currentPeriodEnd, periodHistory } = remote.datos;
    setState({ periodDay, savings, debt, currentPeriodStart, currentPeriodEnd, periodHistory });
  }
  return { changed: different, conflict: different && meta.pending && meta.revision != null };
}
