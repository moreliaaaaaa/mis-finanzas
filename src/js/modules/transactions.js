/**
 * modules/transactions.js
 * Gestión del CRUD de transacciones
 */

import {
  getState,
  setState,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from "../state.js";
import {
  guardarTransaccionSupabase,
  actualizarTransaccionSupabase,
  eliminarTransaccionSupabase,
  getSupabaseClient,
} from "../supabase.js";
import {
  mostrarToast,
  establecerValorInput,
  obtenerValorInput,
  limpiarFormulario,
  mostrarCargandoBoton,
  ocultarCargandoBoton,
  cambiarVista,
} from "../ui.js";
import { generarId, obtenerFechaHoy } from "../utils.js";
import { CATEGORIAS, GRUPOS_CATEGORIAS, MENSAJES } from "../constants.js";
import { recalcularYRenderizar } from "./dashboard.js";
import { obtenerCategorias } from "./categories.js";

/**
 * Guarda o actualiza una transacción
 */
export async function guardarRegistro() {
  const state = getState();
  const editId = obtenerValorInput("#edit-id");
  const categoria = obtenerValorInput("#categoria");
  const monto = parseFloat(obtenerValorInput("#monto"));
  const fecha = obtenerValorInput("#fecha");
  const detalle = obtenerValorInput("#detalle")?.trim() || "Sin detalle";

  const tipo = state.tipoActivoForm;
  const categoriasDisponibles = obtenerCategorias(tipo);
  const categoriaValida = categoriasDisponibles.some((item) => item.id === categoria);

  // Validar
  if (!categoriaValida || isNaN(monto) || monto <= 0 || !fecha) {
    mostrarToast("error", MENSAJES.error.camposRequeridos);
    return;
  }

  const transaccionData = {
    tipo,
    categoria,
    monto,
    fecha,
    detalle,
  };

  try {
    mostrarCargandoBoton("#btn-submit", editId ? "Actualizando..." : "Guardando...");

    if (editId) {
      // Modo edición
      updateTransaction(editId, transaccionData);

      if (getSupabaseClient()) {
        await actualizarTransaccionSupabase(editId, transaccionData);
      }

      mostrarToast("success", MENSAJES.success.actualizar);
    } else {
      // Modo nuevo
      const newId = generarId();
      const newTx = { id: newId, ...transaccionData };
      addTransaction(newTx);

      if (getSupabaseClient()) {
        await guardarTransaccionSupabase(newTx);
      }

      mostrarToast("success", MENSAJES.success.guardar);
    }

    limpiarFormulario("form-movimiento");
    establecerValorInput("#edit-id", "");
    establecerValorInput("#fecha", obtenerFechaHoy());
    setTipoMovimiento(tipo);
    recalcularYRenderizar();
  } catch (error) {
    console.error("Error guardando:", error);
    mostrarToast("error", MENSAJES.error.errorGuardar);
  } finally {
    ocultarCargandoBoton("#btn-submit");
  }
}

/**
 * Edita una transacción
 * @param {string} id
 */
export function editarRegistro(id) {
  const state = getState();
  const t = state.transactions.find((x) => x.id === id);

  if (!t) return;

  cambiarVista("registro");

  // Llenar formulario
  establecerValorInput("#edit-id", t.id);
  establecerValorInput("#monto", t.monto);
  establecerValorInput("#fecha", t.fecha);
  establecerValorInput("#detalle", t.detalle);

  // Configurar tipo y categoría
  setTipoMovimiento(t.tipo);
  establecerValorInput("#categoria", t.categoria);

  // Ajustar botones
  const submitBtn = document.getElementById("btn-submit");
  const cancelBtn = document.getElementById("btn-cancelar");

  const submitLabel = submitBtn?.querySelector(".submit-label");
  if (submitLabel) submitLabel.textContent = `Actualizar ${t.tipo}`;
  if (cancelBtn) cancelBtn.classList.remove("is-hidden");

  // Scroll al formulario
  document
    .getElementById("form-movimiento")
    ?.scrollIntoView({ behavior: "smooth" });
}

/**
 * Cancela la edición
 */
export function cancelarEdicion() {
  limpiarFormulario("form-movimiento");
  establecerValorInput("#edit-id", "");
  establecerValorInput("#fecha", obtenerFechaHoy());

  const submitBtn = document.getElementById("btn-submit");
  const cancelBtn = document.getElementById("btn-cancelar");

  const submitLabel = submitBtn?.querySelector(".submit-label");
  if (submitLabel) {
    submitLabel.textContent = `Guardar ${getState().tipoActivoForm}`;
  }
  if (cancelBtn) cancelBtn.classList.add("is-hidden");
}

/**
 * Elimina una transacción con opción de deshacer
 * @param {string} id
 */
export async function eliminarRegistro(id) {
  const state = getState();
  const transaction = state.transactions.find((t) => t.id === id);
  if (!transaction) return;

  // Eliminar inmediatamente del estado
  deleteTransaction(id);

  if (getSupabaseClient()) {
    await eliminarTransaccionSupabase(id);
  }

  recalcularYRenderizar();

  // Toast con opción de deshacer (8 segundos para decidir)
  mostrarToast("warning", "Registro eliminado", {
    duracion: 8000,
    textoAccion: "Deshacer",
    accion: async () => {
      // Restaurar la transacción
      addTransaction(transaction);
      if (getSupabaseClient()) await guardarTransaccionSupabase(transaction);
      recalcularYRenderizar();
      mostrarToast("success", "Registro restaurado");
    },
  });
}

/**
 * Establece el tipo de movimiento
 * @param {string} tipo
 */
export function setTipoMovimiento(tipo) {
  const tipoNormalizado = tipo === "ingreso" ? "ingreso" : "egreso";

  setState({ tipoActivoForm: tipoNormalizado });

  const btnIngreso = document.getElementById("btn-tipo-ingreso");
  const btnEgreso = document.getElementById("btn-tipo-egreso");
  const tipoInput = document.getElementById("tipo");
  const tipoAyuda = document.getElementById("tipo-ayuda");

  const configurarBoton = (button, buttonType) => {
    if (!button) return;
    const isActive = buttonType === tipoNormalizado;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  };

  configurarBoton(btnIngreso, "ingreso");
  configurarBoton(btnEgreso, "egreso");
  if (tipoInput) tipoInput.value = tipoNormalizado;
  if (tipoAyuda) {
    tipoAyuda.textContent =
      tipoNormalizado === "ingreso"
        ? "Registrarás dinero que entra a tu balance."
        : "Registrarás dinero que sale de tu balance.";
  }

  actualizarSelectCategorias();

  const submitBtn = document.getElementById("btn-submit");
  if (submitBtn) {
    submitBtn.classList.remove("btn-ingreso", "btn-egreso");
    const submitLabel = submitBtn.querySelector(".submit-label");
    const isEditing = Boolean(obtenerValorInput("#edit-id"));

    if (tipoNormalizado === "ingreso") {
      submitBtn.classList.add("btn-ingreso");
    } else {
      submitBtn.classList.add("btn-egreso");
    }

    if (submitLabel) {
      submitLabel.textContent = `${isEditing ? "Actualizar" : "Guardar"} ${tipoNormalizado}`;
    }
  }
}

/**
 * Actualiza opciones del selector de categorías
 */
export function actualizarSelectCategorias() {
  const state = getState();
  const select = document.getElementById("categoria");

  if (!select) return;

  select.innerHTML = "";
  const listaFiltrada = obtenerCategorias(state.tipoActivoForm);

  if (!CATEGORIAS[state.tipoActivoForm]) {
    console.warn(`Tipo de movimiento desconocido: ${state.tipoActivoForm}`);
  }

  // Placeholder
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seleccione categoría...";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  // Agrupar por 'grupo'
  const grupos = {};
  listaFiltrada.forEach((cat) => {
    const g = cat.grupo || "otros";
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(cat);
  });

  // Mantener orden conocido si existe (hogar, taller, familia), sino usar claves encontradas
  const preferOrder = ["hogar", "taller", "familia"];
  const keys = Object.keys(grupos);
  const orderedKeys = preferOrder
    .filter((k) => keys.includes(k))
    .concat(keys.filter((k) => !preferOrder.includes(k)));

  orderedKeys.forEach((grpKey) => {
    const opts = grupos[grpKey];
    if (!opts) return;

    const optgroup = document.createElement("optgroup");
    const grupoLabel =
      GRUPOS_CATEGORIAS && GRUPOS_CATEGORIAS[grpKey]
        ? GRUPOS_CATEGORIAS[grpKey].label
        : grpKey;
    optgroup.label = grupoLabel;

    opts.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.label;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });

  // Si no hay categorías, mostrar mensaje
  if (listaFiltrada.length === 0) {
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay categorías disponibles";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
  }

  select.disabled = listaFiltrada.length === 0;
}

export default {
  guardarRegistro,
  editarRegistro,
  cancelarEdicion,
  eliminarRegistro,
  setTipoMovimiento,
  actualizarSelectCategorias,
};
