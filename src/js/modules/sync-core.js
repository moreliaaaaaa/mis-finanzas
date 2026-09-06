// Funciones independientes de la UI para comprobar conflictos entre dispositivos.
export function fusionarMovimientos(remote, local, pending) {
  const result = new Map(remote.map((tx) => [tx.id, tx]));
  for (const item of pending) {
    if (item.accion === "delete") result.delete(item.id);
    else {
      const tx = item.data || local.find((row) => row.id === item.id);
      if (tx) result.set(item.id, tx);
    }
  }
  return [...result.values()];
}

export function decidirPeriodo(local, meta, remote) {
  if (!remote) return "create";
  if (meta.pending && meta.revision === remote.revision) return "update";
  if (JSON.stringify(local) !== JSON.stringify(remote.datos)) return "adopt";
  return "equal";
}

export function periodoValido(period) {
  const date = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + "T12:00:00Z");
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  };
  return !!period && Number.isInteger(period.periodDay) && period.periodDay >= 1 &&
    period.periodDay <= 28 && date(period.currentPeriodStart) && date(period.currentPeriodEnd) &&
    period.currentPeriodStart <= period.currentPeriodEnd &&
    Number.isFinite(period.savings) && Number.isFinite(period.debt) && Array.isArray(period.periodHistory);
}
