/**
 * modules/categories.js
 * Gestión de categorías personalizadas
 */

import { getState, setState } from "../state.js";
import { guardarEnStorage, obtenerDelStorage } from "../storage.js";
import { mostrarToast } from "../ui.js";
import { CATEGORIAS } from "../constants.js";

const STORAGE_CUSTOM_CATEGORIES = "customCategories";

/**
 * Inicializa las categorías personalizadas desde storage
 */
export function inicializarCategoriasPersonalizadas() {
  const guardadas = obtenerDelStorage(STORAGE_CUSTOM_CATEGORIES);
  if (guardadas) {
    setState({ customCategories: guardadas });
  }
}

/**
 * Obtiene todas las categorías (incluyendo personalizadas)
 * @param {string} tipo - 'ingreso' o 'egreso'
 * @returns {array}
 */
export function obtenerCategorias(tipo) {
  const state = getState();
  const base = CATEGORIAS[tipo] || [];
  const personalizadas = (state.customCategories || []).filter(
    (c) => c.tipo === tipo
  );
  return [...base, ...personalizadas];
}

/**
 * Agrega una categoría personalizada
 * @param {object} categoria - { id, label, grupo, tipo, color }
 * @returns {boolean}
 */
export function agregarCategoria(categoria) {
  if (!categoria.label || !categoria.tipo || !categoria.grupo) {
    mostrarToast("error", "Complete todos los campos de la categoría");
    return false;
  }

  const state = getState();
  const custom = state.customCategories || [];

  // Verificar que no exista una con el mismo nombre
  const existe = custom.some(
    (c) => c.label.toLowerCase() === categoria.label.toLowerCase() && c.tipo === categoria.tipo
  );
  if (existe) {
    mostrarToast("error", "Ya existe una categoría con ese nombre");
    return false;
  }

  const nuevaCategoria = {
    id: `custom_${Date.now()}`,
    label: categoria.label,
    grupo: categoria.grupo,
    tipo: categoria.tipo,
    color: categoria.color || "#64748b",
    esPersonalizada: true,
  };

  const newCustom = [...custom, nuevaCategoria];
  setState({ customCategories: newCustom });
  guardarEnStorage(STORAGE_CUSTOM_CATEGORIES, newCustom);

  mostrarToast("success", `Categoría "${nuevaCategoria.label}" creada`);
  return true;
}

/**
 * Elimina una categoría personalizada
 * @param {string} id
 * @returns {boolean}
 */
export function eliminarCategoria(id) {
  const state = getState();
  const custom = state.customCategories || [];

  const nuevaLista = custom.filter((c) => c.id !== id);
  setState({ customCategories: nuevaLista });
  guardarEnStorage(STORAGE_CUSTOM_CATEGORIES, nuevaLista);

  mostrarToast("success", "Categoría eliminada");
  return true;
}

/**
 * Renderiza el panel de gestión de categorías
 */
export function renderizarPanelCategorias() {
  const container = document.getElementById("categorias-container");
  if (!container) return;

  const state = getState();
  const custom = state.customCategories || [];

  let html = `
    <div class="categories-panel">
      <div class="categories-header">
        <h3>Categorías Personalizadas</h3>
        <button type="button" id="btn-agregar-categoria" class="btn-primary btn-sm">
          + Nueva Categoría
        </button>
      </div>

      <!-- Formulario nueva categoría -->
      <div id="form-categoria" class="category-form hidden">
        <div class="form-row">
          <div class="form-group">
            <label for="cat-nombre">Nombre</label>
            <input type="text" id="cat-nombre" placeholder="Ej: Transporte">
          </div>
          <div class="form-group">
            <label for="cat-tipo">Tipo</label>
            <select id="cat-tipo">
              <option value="egreso">Egreso</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cat-grupo">Grupo</label>
            <select id="cat-grupo">
              <option value="hogar">Hogar</option>
              <option value="taller">Taller</option>
              <option value="familia">Familia</option>
              <option value="ingresos">Ingresos</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label for="cat-color">Color</label>
            <input type="color" id="cat-color" value="#64748b">
          </div>
        </div>
        <div class="form-buttons">
          <button type="button" id="btn-guardar-categoria" class="btn-primary">Guardar</button>
          <button type="button" id="btn-cancelar-categoria" class="btn-secondary">Cancelar</button>
        </div>
      </div>

      <!-- Lista de categorías personalizadas -->
      <div class="categories-list">
  `;

  if (custom.length === 0) {
    html += `
      <div class="empty-state-small">
        <p>No hay categorías personalizadas aún.</p>
      </div>
    `;
  } else {
    custom.forEach((cat) => {
      html += `
        <div class="category-item">
          <div class="category-item-info">
            <span class="category-color-dot" style="background-color: ${cat.color}"></span>
            <span class="category-item-name">${cat.label}</span>
            <span class="category-item-type">${cat.tipo === "ingreso" ? "Ingreso" : "Egreso"}</span>
            <span class="category-item-group">${cat.grupo}</span>
          </div>
          <button type="button" class="btn-icon delete" data-delete-cat="${cat.id}" title="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
    });
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Event listeners
  const btnAgregar = document.getElementById("btn-agregar-categoria");
  const formCat = document.getElementById("form-categoria");
  const btnGuardar = document.getElementById("btn-guardar-categoria");
  const btnCancelar = document.getElementById("btn-cancelar-categoria");

  if (btnAgregar) {
    btnAgregar.addEventListener("click", () => {
      formCat?.classList.toggle("hidden");
    });
  }

  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      formCat?.classList.add("hidden");
      document.getElementById("cat-nombre").value = "";
    });
  }

  if (btnGuardar) {
    btnGuardar.addEventListener("click", () => {
      const nombre = document.getElementById("cat-nombre").value.trim();
      const tipo = document.getElementById("cat-tipo").value;
      const grupo = document.getElementById("cat-grupo").value;
      const color = document.getElementById("cat-color").value;

      if (!nombre) {
        mostrarToast("error", "Ingrese un nombre para la categoría");
        return;
      }

      const exito = agregarCategoria({ label: nombre, tipo, grupo, color });
      if (exito) {
        formCat?.classList.add("hidden");
        document.getElementById("cat-nombre").value = "";
        renderizarPanelCategorias();
      }
    });
  }

  // Botones de eliminar
  container.querySelectorAll("[data-delete-cat]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.deleteCat;
      eliminarCategoria(id);
      renderizarPanelCategorias();
    });
  });
}

export default {
  inicializarCategoriasPersonalizadas,
  obtenerCategorias,
  agregarCategoria,
  eliminarCategoria,
  renderizarPanelCategorias,
};
