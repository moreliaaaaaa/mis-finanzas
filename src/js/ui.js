/**
 * ui.js
 * Orquestación de renderizado del DOM
 */

import { getState } from "./state.js";
import { APP_CONFIG } from "./config.js";
import { escapeHTML } from "./utils.js";
import {
  createIcons,
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  Eye,
  EyeOff,
  Home,
  Inbox,
  LayoutDashboard,
  List,
  Menu,
  Minus,
  Pencil,
  PieChart,
  PiggyBank,
  PlusCircle,
  Scissors,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide";

// Iconos usados en la aplicación (importados localmente, sin CDN)
const icons = {
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CreditCard,
  DollarSign,
  Download,
  Edit,
  Eye,
  EyeOff,
  Home,
  Inbox,
  LayoutDashboard,
  List,
  Menu,
  Minus,
  Pencil,
  PieChart,
  PiggyBank,
  PlusCircle,
  Scissors,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
};

/**
 * Muestra un toast (notificación flotante)
 * @param {string} tipo - 'success', 'error', 'warning', 'info'
 * @param {string} mensaje
 * @param {object} opciones - { duracion, accion, textoAccion }
 */
export function mostrarToast(tipo, mensaje, opciones = {}) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast " + tipo;

  const iconoMap = {
    success:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    warning:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  };

  const mensajeSeguro = escapeHTML(mensaje);
  const textoAccionSeguro = escapeHTML(opciones.textoAccion || "Deshacer");
  const accionHTML = opciones.accion
    ? `<button class="toast-action" data-toast-action="true">${textoAccionSeguro}</button>`
    : "";

  toast.innerHTML = `
    <div class="toast-icon">${iconoMap[tipo] || iconoMap.info}</div>
    <div class="toast-message">${mensajeSeguro}</div>
    ${accionHTML}
  `;

  container.appendChild(toast);

  // Animar entrada
  setTimeout(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity = "1";
  }, 10);

  // Acción del botón
  if (opciones.accion) {
    const actionBtn = toast.querySelector("[data-toast-action]");
    if (actionBtn) {
      actionBtn.addEventListener("click", () => {
        opciones.accion();
        toast.style.animation = "slideOut 0.3s ease";
        setTimeout(() => {
          if (container.contains(toast)) {
            container.removeChild(toast);
          }
        }, 300);
      });
    }
  }

  // Remover automáticamente
  const duracion = opciones.duracion || APP_CONFIG.toastDuration;
  setTimeout(() => {
    if (container.contains(toast)) {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }
  }, duracion);
}

/**
 * Alterna el tema oscuro/claro
 */
export function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.classList.contains("dark") ? "light" : "dark";

  if (newTheme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }

  localStorage.setItem("theme", newTheme);
}

/**
 * Carga el tema guardado
 */
export function cargarTema() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme || (prefersDark ? "dark" : "light");

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/**
 * Inicializa iconos Lucide
 */
export async function initializarIconos() {
  try {
    // Procesar todos los [data-lucide="..."] del DOM con el mapa de iconos
    createIcons({ icons });
  } catch (error) {
    console.warn("Lucide no disponible:", error);
  }
}

/**
 * Abre un modal
 * @param {string} id
 */
export function abrirModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.animation = "fadeIn 0.3s ease";
  }
}

/**
 * Cierra un modal
 * @param {string} id
 */
export function cerrarModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("hidden");
  }
}

/**
 * Cambia de vista
 * @param {string} vistaId
 */
export function cambiarVista(vistaId) {
  const vistas = document.querySelectorAll("[data-vista]");
  vistas.forEach((vista) => {
    if (vista.dataset.vista === vistaId) {
      vista.classList.remove("hidden");
      vista.style.animation = "fadeIn 0.3s ease";
    } else {
      vista.classList.add("hidden");
    }
  });
  // Mostrar u ocultar footer: solo mostrar en vista 'perfil'
  const footer = document.querySelector("footer.footer");
  if (footer) {
    if (vistaId === "perfil") footer.classList.remove("hidden");
    else footer.classList.add("hidden");
  }

  document.querySelectorAll("[data-nav-view]").forEach((item) => {
    const isActive = item.dataset.navView === vistaId;
    item.classList.toggle("active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  setNavMenuState(false);
  document.dispatchEvent(new CustomEvent("view-change", { detail: vistaId }));
}

/**
 * Obtiene valor de un input
 * @param {string} selector
 * @returns {string|number}
 */
export function obtenerValorInput(selector) {
  const input = document.querySelector(selector);
  return input ? input.value : "";
}

/**
 * Establece valor de un input
 * @param {string} selector
 * @param {any} valor
 */
export function establecerValorInput(selector, valor) {
  const input = document.querySelector(selector);
  if (input) {
    input.value = valor;
  }
}

/**
 * Limpia un formulario
 * @param {string} [formId]
 */
export function limpiarFormulario(formId) {
  const form =
    formId ? document.getElementById(formId) : document.querySelector("form");
  if (form && form instanceof HTMLFormElement) {
    form.reset();
  }
}

/**
 * Deshabilita un botón
 * @param {string} selector
 */
export function deshabilitarBoton(selector) {
  const btn = document.querySelector(selector);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  }
}

/**
 * Habilita un botón
 * @param {string} selector
 */
export function habilitarBoton(selector) {
  const btn = document.querySelector(selector);
  if (btn) {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  }
}

/**
 * Muestra estado de cargando en un botón
 * @param {string} selector
 * @param {string} texto - Texto a mostrar mientras carga
 */
export function mostrarCargandoBoton(selector, texto = "Guardando...") {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.style.cursor = "not-allowed";
  const label = btn.querySelector(".submit-label");
  if (label) {
    label.dataset.originalText = label.textContent;
    label.textContent = texto;
  }
  btn.dataset.loading = "true";
}

/**
 * Oculta estado de cargando en un botón
 * @param {string} selector
 */
export function ocultarCargandoBoton(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = "1";
  btn.style.cursor = "pointer";
  const label = btn.querySelector(".submit-label");
  if (label && label.dataset.originalText) {
    label.textContent = label.dataset.originalText;
    delete label.dataset.originalText;
  }
  delete btn.dataset.loading;
}

/**
 * Actualiza el contenido de un elemento como texto por defecto.
 * @param {string} selector
 * @param {string} contenido
 * @param {{ trustedHTML?: boolean }} opciones
 */
export function actualizarContenido(selector, contenido, opciones = {}) {
  const el = document.querySelector(selector);
  if (el) {
    if (opciones.trustedHTML === true) {
      el.innerHTML = contenido;
      initializarIconos();
      return;
    }

    el.textContent = String(contenido ?? "");
  }
}

/**
 * Muestra un cargando
 * @param {string} selector
 */
export function mostrarCargando(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add("chart-loading");
    el.innerHTML = "<span>Cargando...</span>";
  }
}

/**
 * Oculta el cargando
 * @param {string} selector
 */
export function ocultarCargando(selector) {
  const el = document.querySelector(selector);
  if (el) {
    el.classList.remove("chart-loading");
  }
}

/**
 * Navegación: ir al formulario de registro
 */
export function irARegistro() {
  try {
    cambiarVista("registro");

    setTimeout(() => {
      const form = document.getElementById("form-movimiento");
      if (form) form.scrollIntoView({ behavior: "smooth" });
      const monto = document.getElementById("monto");
      if (monto) monto.focus();
      setNavMenuState(false);
    }, 200);
  } catch (e) {
    console.warn("irARegistro error:", e);
  }
}

/**
 * Navegación: ir a últimos movimientos
 */
export function irAUltimos() {
  try {
    cambiarVista("ultimos");
    setTimeout(() => {
      const list = document.getElementById("lista-movimientos-dashboard");
      if (list) list.scrollIntoView({ behavior: "smooth" });
      if (window.filtrarHistorial) window.filtrarHistorial("todos");
      setNavMenuState(false);
    }, 200);
  } catch (e) {
    console.warn("irAUltimos error:", e);
  }
}

/**
 * Navegación: ir a vista de egresos (distribución)
 */
/**
 * Cambia la seccion visible dentro de la vista de egresos.
 * @param {string} seccion
 * @param {{ rerender?: boolean }} opciones
 */
export function cambiarSeccionEgresos(seccion = "resumen", opciones = {}) {
  const secciones = ["resumen", "categorias", "tendencias"];
  const activa = secciones.includes(seccion) ? seccion : "resumen";

  document.querySelectorAll("[data-expense-panel]").forEach((panel) => {
    const esActivo = panel.dataset.expensePanel === activa;
    panel.hidden = !esActivo;
    panel.classList.toggle("active", esActivo);
  });

  document.querySelectorAll("[data-expense-section]").forEach((tab) => {
    const esActivo = tab.dataset.expenseSection === activa;
    tab.classList.toggle("active", esActivo);
    tab.setAttribute("aria-selected", String(esActivo));
    tab.tabIndex = esActivo ? 0 : -1;
  });

  const select = document.getElementById("expense-section-select");
  if (select) select.value = activa;

  if (opciones.rerender !== false && window.renderizarGraficosEgresos) {
    setTimeout(() => window.renderizarGraficosEgresos(), 80);
  }
}

export function irAEgresos() {
  try {
    cambiarVista("egresos");
    setTimeout(() => {
      cambiarSeccionEgresos("resumen", { rerender: false });
      const header = document.querySelector("#vista-egresos .expense-page-header");
      if (header) header.scrollIntoView({ behavior: "smooth", block: "start" });
      setNavMenuState(false);
      // Renderizar gráficos
      if (window.renderizarGraficosEgresos) {
        window.renderizarGraficosEgresos();
      }
    }, 200);
  } catch (e) {
    console.warn("irAEgresos error:", e);
  }
}

/**
 * Navegación: mostrar el historial de periodos dentro de la aplicación.
 */
export function irAHistorialPeriodos() {
  try {
    cambiarVista("historial-periodos");
    setTimeout(() => {
      const section = document.getElementById("period-section-view");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
  } catch (e) {
    console.warn("irAHistorialPeriodos error:", e);
  }
}

/**
 * Navegación: mostrar el presupuesto dentro de la aplicación.
 */
export function irAPresupuesto() {
  try {
    cambiarVista("presupuesto");
    setTimeout(() => {
      const section = document.getElementById("budget-section-view");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
  } catch (e) {
    console.warn("irAPresupuesto error:", e);
  }
}

/**
 * Navegación: abrir la pantalla de perfil dentro de la aplicación.
 */
export function irAPerfil() {
  try {
    cambiarVista("perfil");
    setTimeout(() => {
      const section = document.getElementById("vista-perfil");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setNavMenuState(false);
    }, 200);
  } catch (e) {
    console.warn("irAPerfil error:", e);
  }
}

/**
 * Sincroniza el estado visual y accesible del menú lateral.
 */
export function setNavMenuState(isOpen) {
  const menu = document.getElementById("nav-menu");
  const backdrop = document.getElementById("nav-backdrop");
  const button = document.getElementById("nav-menu-btn");

  if (!menu) return;

  menu.classList.toggle("open", isOpen);
  menu.setAttribute("aria-hidden", String(!isOpen));

  if (button) {
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  if (backdrop) {
    backdrop.classList.toggle("show", isOpen);
    backdrop.hidden = !isOpen;
  }

  document.body.classList.toggle("menu-open", isOpen);
}

/**
 * Navegación: volver a la vista Home (tarjetas)
 */
export function irAHome() {
  try {
    cambiarVista("home");
    setNavMenuState(false);
  } catch (e) {
    console.warn("irAHome error:", e);
  }
}

/**
 * Toggle simple para menú nav
 */
export function toggleNavMenu() {
  const menu = document.getElementById("nav-menu");
  if (!menu) return;

  setNavMenuState(!menu.classList.contains("open"));
}

export default {
  mostrarToast,
  toggleTheme,
  cargarTema,
  initializarIconos,
  abrirModal,
  cerrarModal,
  cambiarVista,
  obtenerValorInput,
  establecerValorInput,
  limpiarFormulario,
  deshabilitarBoton,
  habilitarBoton,
  actualizarContenido,
  mostrarCargando,
  ocultarCargando,
};
