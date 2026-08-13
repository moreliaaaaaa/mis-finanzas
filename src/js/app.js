/**
 * app.js
 * Punto de entrada y orquestación de la aplicación
 */

import {
  cargarTema,
  toggleTheme,
  initializarIconos,
  mostrarToast,
  cambiarVista,
  irARegistro,
  irAUltimos,
  irAEgresos,
  irAHome,
  irAHistorialPeriodos,
  irAPresupuesto,
  irAPerfil,
  toggleNavMenu,
  setNavMenuState,
} from "./ui.js";
import { setState, getState, subscribe, resetState } from "./state.js";
import { limpiarStorage, obtenerDelStorage, guardarEnStorage } from "./storage.js";
import {
  inicializarSupabase,
  obtenerTransaccionesSupabase,
  sincronizarPendientes,
  esSupabaseConectado,
} from "./supabase.js";
import { MENSAJES } from "./constants.js";
import { recalcularYRenderizar } from "./modules/dashboard.js";
import {
  guardarRegistro,
  setTipoMovimiento,
  editarRegistro,
  eliminarRegistro,
  cancelarEdicion,
} from "./modules/transactions.js";
import { exportarCSV, exportarPDF } from "./modules/export.js";
import {
  filtrarHistorial,
  buscarTransacciones,
  filtrarPorRangoFechas,
  limpiarFiltros,
  cambiarPagina,
} from "./modules/dashboard.js";
import {
  inicializarPeriodo,
  renderizarSeccionPeriodo,
  cerrarPeriodo,
  configurarDiaCierre,
} from "./modules/periods.js";
import {
  inicializarNotificaciones,
  solicitarPermiso,
  programarNotificacionCierrePeriodo,
} from "./notifications.js";
import {
  actualizarGraficoEgresos,
  renderizarGraficoTendencia,
  renderizarGraficoComparativa,
} from "./modules/charts.js";
import { inicializarCategoriasPersonalizadas } from "./modules/categories.js";
import {
  inicializarPresupuestos,
  renderizarPresupuesto,
  verificarAlertasPresupuesto,
} from "./modules/budgets.js";
import { inicializarAuth, renderizarPanelAuth, renderizarPerfil, haySesionActiva, cerrarSesion } from "./modules/auth.js";
import { registrarServiceWorker, configurarInstalacion } from "./pwa.js";

async function cargarTemplate(ruta, destinoId) {
  const destino = document.getElementById(destinoId);
  if (!destino) return;

  try {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta}`);
    destino.innerHTML = await respuesta.text();
  } catch (error) {
    console.error(error);
    destino.innerHTML = '<p class="error">No se pudo cargar la sección.</p>';
  }
}

function mostrarLoginScreen() {
  const header = document.getElementById("header-placeholder");
  const main = document.querySelector("main");
  const authPanel = document.getElementById("auth-panel");

  if (header) header.classList.add("hidden");
  if (main) main.classList.add("hidden");
  if (authPanel) authPanel.classList.remove("hidden");
}

function ocultarLoginScreen() {
  const header = document.getElementById("header-placeholder");
  const main = document.querySelector("main");
  const authPanel = document.getElementById("auth-panel");

  if (header) header.classList.remove("hidden");
  if (main) main.classList.remove("hidden");
  if (authPanel) authPanel.classList.add("hidden");
}

export async function initApp() {
  try {
    // 1. Cargar tema
    cargarTema();

    await Promise.all([
      cargarTemplate("/templates/header.html", "header-placeholder"),
      cargarTemplate("/templates/home-view.html", "home-view-placeholder"),
      cargarTemplate("/templates/historial-view.html", "historial-view-placeholder"),
      cargarTemplate("/templates/presupuesto-view.html", "presupuesto-view-placeholder"),
      cargarTemplate("/templates/registro-view.html", "registro-view-placeholder"),
      cargarTemplate("/templates/ultimos-view.html", "ultimos-view-placeholder"),
      cargarTemplate("/templates/egresos-view.html", "egresos-view-placeholder"),
      cargarTemplate("/templates/perfil-view.html", "perfil-view-placeholder"),
      cargarTemplate("/templates/footer.html", "footer-placeholder"),
    ]);

    // 1.1 Inicializar autenticación
    inicializarAuth();
    const supabaseInit = await inicializarSupabase();

    window.ocultarLoginScreen = ocultarLoginScreen;
    window.mostrarLoginScreen = mostrarLoginScreen;

    // Renderizar panel normal de autenticación
    await renderizarPanelAuth("auth-panel");
    renderizarPerfil();

    // 1.2 Mostrar login/registro como pantalla inicial
    if (!haySesionActiva()) {
      mostrarLoginScreen();
    } else {
      ocultarLoginScreen();
    }

    // 2. Establecer fecha por defecto
    const fechaInput = document.getElementById("fecha");
    if (fechaInput) {
      fechaInput.valueAsDate = new Date();
    }

    // 3. Configurar listeners y suscriptores ANTES de operaciones async
    //    para que botones (menú, tema, etc.) funcionen de inmediato
    setupEventListeners();
    setupStateSubscribers();

    // 4. Inicializar UI (iconos)
    await initializarIconos();

    // Exponer funciones de navegación para los botones inline del HTML
    window.irARegistro = irARegistro;
    window.irAUltimos = irAUltimos;
    window.irAEgresos = irAEgresos;
    window.irAHome = irAHome;
    window.irAHistorialPeriodos = irAHistorialPeriodos;
    window.irAPresupuesto = irAPresupuesto;
    window.irAPerfil = irAPerfil;
    window.toggleNavMenu = toggleNavMenu;

    // 5. Configurar tipos y categorías
    setTipoMovimiento("ingreso");

    // 5.1 Inicializar categorías personalizadas
    inicializarCategoriasPersonalizadas();

    // 5.2 Inicializar presupuestos
    inicializarPresupuestos();

    // 6. Inicializar Periodo Financiero
    inicializarPeriodo();

    // 7. Renderizar dashboard
    recalcularYRenderizar();

    // 7.1 Renderizar widget de presupuesto en la vista interna del menú
    renderizarPresupuesto("budget-section-view");
    verificarAlertasPresupuesto(new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0"));

    // 8. Renderizar sección de periodo
    renderizarSeccionPeriodo();

    // 8.1 Registrar Service Worker (PWA) - no bloquea la app
    registrarServiceWorker();
    configurarInstalacion();

    // 9. Inicializar notificaciones (no bloquea la app)
    inicializarNotificaciones().then((ok) => {
      if (ok) {
        solicitarPermiso().then((permisoNotif) => {
          if (permisoNotif === "granted") {
            const state = getState();
            programarNotificacionCierrePeriodo(state.periodDay);
          }
        });
      }
    });

    // 10. Cargar datos (Supabase si está configurado, si no modo local)
    if (supabaseInit) {
      mostrarToast("info", "Conectado a la nube ☁️");
      const transaccionesNube = await obtenerTransaccionesSupabase();
      const cleanStart = localStorage.getItem("misfinanzas_clean_start") === "true";

      if (cleanStart) {
        localStorage.removeItem("misfinanzas_clean_start");
        setState({ transactions: [] });
      } else if (transaccionesNube.length > 0) {
        setState({ transactions: transaccionesNube });
      } else {
        cargarMovimientosDePrueba();
      }

      // Subir movimientos que quedaron sin sincronizar
      sincronizarPendientes();
    } else {
      mostrarToast("info", MENSAJES.info.modoLocal);
      cargarMovimientosDePrueba();
    }

    // 11. Re-renderizar tras cargar datos
    recalcularYRenderizar();
    renderizarSeccionPeriodo();
    renderizarPresupuesto("budget-section-view");

    // Manejo de hash en URL para abrir vistas desde nuevas pestañas
    const hash = (window.location.hash || "").replace("#", "");
    if (hash === "registro") {
      setTimeout(() => irARegistro(), 300);
    } else if (hash === "ultimos") {
      setTimeout(() => irAUltimos(), 300);
    } else if (hash === "egresos") {
      setTimeout(() => irAEgresos(), 300);
    }
  } catch (error) {
    console.error("❌ Error inicializando app:", error);
    mostrarToast("error", "Error al inicializar la aplicación");
  }
}

/**
 * Configura listeners de eventos del DOM
 */
function setupEventListeners() {
  // Formulario de transacciones
  const form = document.getElementById("form-movimiento");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      guardarRegistro();
    });
  }

  const cancelBtn = document.getElementById("btn-cancelar");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", cancelarEdicion);
  }

  // Botones de tipo
  const btnIngresoBtn = document.getElementById("btn-tipo-ingreso");
  const btnEgresoBtn = document.getElementById("btn-tipo-egreso");

  if (btnIngresoBtn) {
    btnIngresoBtn.addEventListener("click", () => setTipoMovimiento("ingreso"));
  }
  if (btnEgresoBtn) {
    btnEgresoBtn.addEventListener("click", () => setTipoMovimiento("egreso"));
  }

  const tipoGroup = document.querySelector(".btn-toggle-group");
  if (tipoGroup) {
    tipoGroup.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const siguienteTipo =
        btnIngresoBtn?.getAttribute("aria-checked") === "true"
          ? "egreso"
          : "ingreso";
      setTipoMovimiento(siguienteTipo);
      document.getElementById(`btn-tipo-${siguienteTipo}`)?.focus();
    });
  }

  // Botón exportar
  const exportBtn = document.querySelector('[onclick*="exportarCSV"]');

  if (exportBtn) {
    exportBtn.removeAttribute("onclick");
    exportBtn.addEventListener("click", exportarCSV);
  }

  // Menú nav
  const navBtn = document.getElementById("nav-menu-btn");
  const navMenu = document.getElementById("nav-menu");
  const navBackdrop = document.getElementById("nav-backdrop");
  if (navBtn) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleNavMenu();
    });
  }

  const closeNavMenu = () => {
    setNavMenuState(false);
  };

  const isNavMenuOpen = () => navMenu?.classList.contains("open") === true;

  const isInsideNavControls = (target) => {
    if (!(target instanceof Node)) return false;
    return navMenu?.contains(target) || navBtn?.contains(target);
  };

  if (navBackdrop) {
    navBackdrop.addEventListener("click", closeNavMenu);
  }

  const closeNavBtn = document.querySelector("#nav-menu .dropdown-close");
  if (closeNavBtn) {
    closeNavBtn.addEventListener("click", closeNavMenu);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavMenu();
  });

  // Cerrar menú si clic fuera
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!isNavMenuOpen() || isInsideNavControls(event.target)) return;
      closeNavMenu();
    },
    true
  );

  document.addEventListener("click", (event) => {
    if (!isNavMenuOpen() || isInsideNavControls(event.target)) return;
    closeNavMenu();
  });

  // Detectar conexión/desconexión
  window.addEventListener("online", () => {
    mostrarToast("success", "Conectado a internet 🌐");
    if (esSupabaseConectado()) {
      sincronizarPendientes();
    }
  });

  window.addEventListener("offline", () => {
    mostrarToast("warning", "Desconectado de internet ⚠️");
  });

  // Búsqueda de movimientos
  const busquedaInput = document.getElementById("busqueda-movimientos");
  if (busquedaInput) {
    let debounceTimer;
    busquedaInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        buscarTransacciones(e.target.value);
      }, 300);
    });
  }

  // Filtros de fecha
  const fechaInicio = document.getElementById("filtro-fecha-inicio");
  const fechaFin = document.getElementById("filtro-fecha-fin");

  if (fechaInicio) {
    fechaInicio.addEventListener("change", () => {
      filtrarPorRangoFechas(fechaInicio.value, fechaFin?.value || null);
    });
  }

  if (fechaFin) {
    fechaFin.addEventListener("change", () => {
      filtrarPorRangoFechas(fechaInicio?.value || null, fechaFin.value);
    });
  }

  // Botón limpiar filtros
  const limpiarBtn = document.getElementById("btn-limpiar-filtros");
  if (limpiarBtn) {
    limpiarBtn.addEventListener("click", limpiarFiltros);
  }

  // Programar notificaciones de cierre de periodo
  const periodDayInput = document.getElementById("period-day-input");
  if (periodDayInput) {
    periodDayInput.addEventListener("change", (e) => {
      const nuevoDia = parseInt(e.target.value) || 5;
      programarNotificacionCierrePeriodo(nuevoDia);
    });
  }

  setupProfileOptions();
}

function setupProfileOptions() {
    const themeBtn = document.getElementById("profile-theme-toggle");
    const logoutBtn = document.getElementById("profile-logout-btn");

    if (!themeBtn && !logoutBtn) {
        return;
    }

    const actualizarEstado = () => {
        if (!themeBtn) return;

        const isDark = document.documentElement.classList.contains("dark");
        themeBtn.textContent = isDark ? "Desactivar" : "Activar";
        themeBtn.setAttribute("aria-pressed", String(isDark));
    };

    themeBtn?.addEventListener("click", () => {
        toggleTheme();
        actualizarEstado();
    });

    const resetDataBtn = document.getElementById("profile-reset-data-btn");

    resetDataBtn?.addEventListener("click", () => {
      const confirmed = window.confirm(
        "¿Borrar todos los datos financieros y comenzar desde cero? Esta acción no se puede deshacer."
      );
      if (!confirmed) return;

      localStorage.setItem("misfinanzas_clean_start", "true");
      limpiarStorage();
      resetState();
      mostrarToast("success", "Datos financieros borrados. La aplicación se reiniciará desde cero.");
      window.location.reload();
    });

    logoutBtn?.addEventListener("click", async () => {
        cerrarSesion();
        renderizarPerfil();
        await renderizarPanelAuth("auth-panel");
        mostrarLoginScreen();
    });

    actualizarEstado();
}

/**
 * Configura suscriptores de cambios de estado
 */
function setupStateSubscribers() {
  subscribe((newState) => {
    // Guardar estado en storage
    guardarEnStorage("transactions", newState.transactions);
    guardarEnStorage("tipoActivoForm", newState.tipoActivoForm);
    guardarEnStorage("filtroHistorial", newState.filtroHistorial);
  });
}

/**
 * Carga datos de prueba (modo offline)
 */
function cargarMovimientosDePrueba() {
  const datosGuardados = obtenerDelStorage("transactions");

  if (datosGuardados && datosGuardados.length > 0) {
    setState({ transactions: datosGuardados });
  } else {
    // Datos de demostración
    const transaccionesPrueba = [
      {
        id: "1",
        tipo: "ingreso",
        categoria: "ingreso_general",
        monto: 120000,
        fecha: "2026-06-25",
        detalle: "Venta de vestidos de fiesta",
        timestamp: new Date().toISOString(),
      },
      {
        id: "2",
        tipo: "egreso",
        categoria: "hilos_taller",
        monto: 15000,
        fecha: "2026-06-26",
        detalle: "Hilos Overlock de colores",
        timestamp: new Date().toISOString(),
      },
      {
        id: "3",
        tipo: "egreso",
        categoria: "arriendo",
        monto: 50000,
        fecha: "2026-06-15",
        detalle: "Pago Arriendo Taller",
        timestamp: new Date().toISOString(),
      },
      {
        id: "4",
        tipo: "egreso",
        categoria: "salidas_familia",
        monto: 22000,
        fecha: "2026-06-27",
        detalle: "Almuerzo familiar fin de semana",
        timestamp: new Date().toISOString(),
      },
      {
        id: "5",
        tipo: "egreso",
        categoria: "gastos_ninos",
        monto: 12000,
        fecha: "2026-06-28",
        detalle: "Materiales escolares para los niños",
        timestamp: new Date().toISOString(),
      },
    ];

    setState({ transactions: transaccionesPrueba });
    guardarEnStorage("transactions", transaccionesPrueba);
    mostrarToast("info", "Datos de demostración cargados");
  }
}

// Exponer funciones globales para HTML
window.guardarRegistro = guardarRegistro;
window.setTipoMovimiento = setTipoMovimiento;
window.exportarCSV = exportarCSV;
window.cambiarVista = cambiarVista;
window.filtrarHistorial = filtrarHistorial;
window.editarRegistro = editarRegistro;
window.eliminarRegistro = eliminarRegistro;
window.buscarTransacciones = buscarTransacciones;
window.filtrarPorRangoFechas = filtrarPorRangoFechas;
window.limpiarFiltros = limpiarFiltros;
window.cambiarPagina = cambiarPagina;
window.exportarPDF = exportarPDF;
// Función para renderizar gráficos de egresos
window.renderizarGraficosEgresos = () => {
  actualizarGraficoEgresos();
  renderizarGraficoTendencia();
  renderizarGraficoComparativa();
};

// Exponer funciones de periodo
window.cerrarPeriodo = cerrarPeriodo;
window.cambiarDiaCierre = configurarDiaCierre;

// Iniciar app cuando DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

export default { initApp };
