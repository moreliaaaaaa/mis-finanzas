/**
 * state.js
 * Gestión del estado global de la aplicación
 */

// Estado reactivo centralizado
const appState = {
  transactions: [],
  tipoActivoForm: "egreso", // 'ingreso' o 'egreso'
  filtroHistorial: "todos", // 'todos', 'ingreso', 'egreso'
  currentTheme: "light", // 'light' o 'dark'
  vistaActual: "home", // 'home' | 'registro' | 'ultimos' | 'egresos'
  isLoading: false,
  error: null,
  userId: null,
  isOnline: true,
  firebaseActive: false,

  // Búsqueda y filtros
  busquedaTexto: "", // Texto de búsqueda en movimientos
  filtroFechaInicio: null, // Fecha inicio filtro (YYYY-MM-DD)
  filtroFechaFin: null, // Fecha fin filtro (YYYY-MM-DD)

  // Paginación
  paginaActual: 1, // Página actual del historial
  elementosPorPagina: 10, // Elementos por página

  // Categorías personalizadas
  customCategories: [], // [{ id, label, grupo, tipo, color, esPersonalizada }]

  // Presupuestos
  presupuestos: {}, // { "2026-01": { limite, alertas } }

  // Periodo financiero
  periodDay: 5, // Día de cierre del periodo
  savings: 0, // Ahorro acumulado
  savingsTransfers: [], // Transferencias del ahorro al balance del período
  debt: 0, // Deuda acumulada
  currentPeriodStart: null, // Fecha inicio del periodo actual (YYYY-MM-DD)
  currentPeriodEnd: null, // Fecha fin del periodo actual (YYYY-MM-DD)
  periodHistory: [], // Historial de periodos cerrados [{start, end, balance, result, date}]
};

// Listeners para cambios de estado
const listeners = [];

/**
 * Obtiene el estado actual
 * @returns {object}
 */
export function getState() {
  return { ...appState };
}

/**
 * Actualiza el estado
 * @param {object} updates - Propiedades a actualizar
 */
export function setState(updates) {
  Object.assign(appState, updates);
  notifyListeners();
}

/**
 * Obtiene una propiedad específica del estado
 * @param {string} key
 * @returns {any}
 */
export function getStateValue(key) {
  return appState[key];
}

/**
 * Estableceuna propiedad específica
 * @param {string} key
 * @param {any} value
 */
export function setStateValue(key, value) {
  appState[key] = value;
  notifyListeners();
}

/**
 * Agrega transacciones
 * @param {array} transactions
 */
export function addTransactions(transactions) {
  appState.transactions = [...transactions];
  notifyListeners();
}

/**
 * Agrega una transacción
 * @param {object} transaction
 */
export function addTransaction(transaction) {
  appState.transactions.unshift(transaction);
  notifyListeners();
}

/**
 * Actualiza una transacción
 * @param {string} id
 * @param {object} updates
 */
export function updateTransaction(id, updates) {
  const index = appState.transactions.findIndex((t) => t.id === id);
  if (index !== -1) {
    appState.transactions[index] = {
      ...appState.transactions[index],
      ...updates,
    };
    notifyListeners();
  }
}

/**
 * Elimina una transacción
 * @param {string} id
 */
export function deleteTransaction(id) {
  appState.transactions = appState.transactions.filter((t) => t.id !== id);
  notifyListeners();
}

/**
 * Obtiene transacciones filtradas
 * @param {string} filtro - 'todos', 'ingreso', 'egreso'
 * @returns {array}
 */
export function getFilteredTransactions(filtro = "todos") {
  if (filtro === "todos") return appState.transactions;
  return appState.transactions.filter((t) => t.tipo === filtro);
}

/**
 * Suscribe a cambios del estado
 * @param {function} callback
 * @returns {function} Función para desuscribirse
 */
export function subscribe(callback) {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

/**
 * Notifica a todos los listeners
 */
function notifyListeners() {
  listeners.forEach((callback) => {
    try {
      callback(appState);
    } catch (error) {
      console.error("Error en listener del estado:", error);
    }
  });
}

/**
 * Reinicia el estado
 */
export function resetState() {
  appState.transactions = [];
  appState.tipoActivoForm = "egreso";
  appState.filtroHistorial = "todos";
  appState.error = null;
  appState.isLoading = false;
  notifyListeners();
}

export default {
  getState,
  setState,
  getStateValue,
  setStateValue,
  addTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getFilteredTransactions,
  subscribe,
  resetState,
};
