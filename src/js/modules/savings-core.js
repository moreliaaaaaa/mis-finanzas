export function transferenciasDelPeriodo(transfers = [], start, end) {
  return transfers.filter((item) => (!start || item.fecha >= start) && (!end || item.fecha <= end));
}

export function sumarTransferencias(transfers = [], start, end) {
  return transferenciasDelPeriodo(transfers, start, end)
    .reduce((sum, item) => sum + Math.round(Number(item.monto || 0) * 100), 0) / 100;
}

export function prepararTransferencia(state, { monto, fecha, detalle, id, today }) {
  const amount = Number(monto);
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents <= 0 || Math.abs(amount * 100 - cents) > 0.00001) {
    throw new Error("Ingresa un monto mayor que cero, con hasta dos decimales.");
  }
  if (cents > Math.round(Number(state.savings || 0) * 100)) {
    throw new Error("El monto supera tus ahorros disponibles.");
  }
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      Number.isNaN(Date.parse(fecha + "T12:00:00Z")) ||
      new Date(fecha + "T12:00:00Z").toISOString().slice(0, 10) !== fecha ||
      !state.currentPeriodStart || !state.currentPeriodEnd ||
      fecha < state.currentPeriodStart || fecha > state.currentPeriodEnd || fecha > today) {
    throw new Error("Elige una fecha válida dentro del período actual, hasta hoy.");
  }
  if (state.currentPeriodEnd < today) {
    throw new Error("Espera a que se sincronice el cierre del período antes de usar el ahorro.");
  }
  const transfer = { id, fecha, monto: cents / 100, detalle: String(detalle || "Uso de ahorro").trim().slice(0, 250) || "Uso de ahorro" };
  return {
    savings: (Math.round(Number(state.savings || 0) * 100) - cents) / 100,
    savingsTransfers: [...(state.savingsTransfers || []), transfer],
  };
}
