/**
 * constants.js
 * Categorías, colores y constantes del negocio
 */

export const CATEGORIAS = {
  ingreso: [
    {
      id: "ingreso_general",
      label: "Ventas / Ingresos Generales",
      grupo: "ingresos",
    },
    {
      id: "servicio_confeccion",
      label: "Servicio de confección",
      grupo: "ingresos",
    },
  ],
  egreso: [
    // Hogar y Servicios Básicos
    { id: "arriendo", label: "Arriendo", grupo: "hogar" },
    { id: "agua", label: "Agua", grupo: "hogar" },
    { id: "luz", label: "Luz", grupo: "hogar" },
    { id: "comida_domicilio", label: "Comida a domicilio", grupo: "hogar" },
    { id: "provisiones", label: "Compra de provisiones", grupo: "hogar" },
    // Taller de Costura
    { id: "hilos_taller", label: "Compra de hilos (Taller)", grupo: "taller" },
    
    {
      id: "repuestos_maquinas",
      label: "Repuestos de máquinas",
      grupo: "taller",
    },
    { id: "pago_personal", label: "Pago de personal", grupo: "taller" },
    // Familia y Niños
    { id: "gastos_ninos", label: "Gastos de los niños", grupo: "familia" },
    { id: "salidas_familia", label: "Salidas en familia", grupo: "familia" },
    // Cierre de Periodo (categorías internas)
    { id: "ahorro_periodo", label: "Ahorro (Cierre de Periodo)", grupo: "ahorro" },
    { id: "deficit_periodo", label: "Déficit (Cierre de Periodo)", grupo: "deficit" },
  ],
};

export const COLORES_CATEGORIAS = {
  arriendo: "#3b82f6", // azul
  agua: "#0ea5e9",
  luz: "#eab308",
  comida_domicilio: "#ec4899",
  provisiones: "#14b8a6",
  hilos_taller: "#8b5cf6", // violeta
  repuestos_maquinas: "#a78bfa",
  pago_personal: "#6366f1",
  gastos_ninos: "#f97316", // naranja
  salidas_familia: "#f97316",
};

export const GRUPOS_CATEGORIAS = {
  ingresos: {
    id: "ingresos",
    label: "Ingresos",
    icon: "dollar-sign",
    color: "#10b981",
  },
  hogar: {
    id: "hogar",
    label: "Hogar y Servicios Básicos",
    icon: "home",
    color: "#3b82f6",
  },
  taller: {
    id: "taller",
    label: "Taller de Costura",
    icon: "scissors",
    color: "#8b5cf6",
  },
  familia: {
    id: "familia",
    label: "Familia y Niños",
    icon: "users",
    color: "#f97316",
  },
};

export const TIPOS_MOVIMIENTO = {
  ingreso: "ingreso",
  egreso: "egreso",
};

export const FILTROS = {
  todos: "todos",
  ingreso: "ingreso",
  egreso: "egreso",
};

// Configuración de periodos financieros
export const PERIOD_CONFIG = {
  defaultCloseDay: 5, // Día del mes en que se cierra el periodo (por defecto día 5)
  periodStartDay: 6,  // Día del mes en que inicia el nuevo periodo
};

// Categorías internas usadas para el cierre de periodo
export const PERIOD_CATEGORIES = {
  ahorro: "ahorro_periodo",
  deficit: "deficit_periodo",
  grupoAhorro: "ahorro",
  grupoDeficit: "deficit",
};

export const MENSAJES = {
  success: {
    guardar: "Registro guardado exitosamente",
    actualizar: "Registro actualizado correctamente",
    eliminar: "Registro eliminado de la memoria",
    descargar: "Archivo CSV descargado con éxito",
  },
  error: {
    camposRequeridos: "Por favor complete todos los campos",
    noHayDatos: "No hay datos para exportar",
    errorGuardar: "Error al guardar en la base de datos",
    errorEliminar: "Error al borrar el registro",
  },
  info: {
    modoLocal: "Iniciado en modo local con datos de muestra",
    sincronizado: "Sincronizado",
    modoOffline: "Modo Local",
  },
};

export default {
  CATEGORIAS,
  COLORES_CATEGORIAS,
  GRUPOS_CATEGORIAS,
  TIPOS_MOVIMIENTO,
  FILTROS,
  MENSAJES,
};
