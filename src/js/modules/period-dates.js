export function fechaLocalISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// El inicio siempre muestra el período de hoy, aunque el cierre guardado
// esté esperando conexión para consolidarse con todos los movimientos.
export function periodoVisible(state, now = new Date()) {
  const { currentPeriodStart: start, currentPeriodEnd: end } = state;
  if (!start || !end || end >= fechaLocalISO(now)) return { start, end };
  const day = Math.max(1, Math.min(28, Number.parseInt(state.periodDay, 10) || 5));
  const month = now.getMonth() - (now.getDate() <= day ? 1 : 0);
  return {
    start: fechaLocalISO(new Date(now.getFullYear(), month, day + 1)),
    end: fechaLocalISO(new Date(now.getFullYear(), month + 1, day)),
  };
}
