/**
 * notifications.js
 * Gestión de notificaciones push del navegador
 */

let swRegistration = null;

/**
 * Inicializa el sistema de notificaciones
 * @returns {Promise<boolean>}
 */
export async function inicializarNotificaciones() {
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones");
    return false;
  }

  if (!("serviceWorker" in navigator)) {
    console.warn("Este navegador no soporta Service Workers");
    return false;
  }

  try {
    // Reutilizar el registro de la PWA (pwa.js); si aún no existe, esperar
    swRegistration = await navigator.serviceWorker.ready;
    return true;
  } catch (error) {
    try {
      swRegistration = await navigator.serviceWorker.register("/sw.js");
      return true;
    } catch (registerError) {
      console.error("Error registrando Service Worker:", registerError);
      return false;
    }
  }
}

/**
 * Solicita permiso para notificaciones
 * @returns {Promise<string>} 'granted', 'denied', o 'default'
 */
export async function solicitarPermiso() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  // Timeout de seguridad: nunca bloquear la app si el prompt no responde
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve("default"), 3000);
  });

  const result = await Promise.race([Notification.requestPermission(), timeout]);
  return result;
}

/**
 * Muestra una notificación local
 * @param {string} titulo
 * @param {object} opciones - { body, icon, tag, data }
 */
export function mostrarNotificacion(titulo, opciones = {}) {
  if (Notification.permission !== "granted") return;

  const opcionesDefault = {
    icon: "/src/assets/marca/logo-morelia.svg",
    badge: "/src/assets/marca/logo-morelia.svg",
    vibrate: [100, 50, 100],
    tag: "misfinanzas-" + Date.now(),
    ...opciones,
  };

  if (swRegistration) {
    swRegistration.showNotification(titulo, opcionesDefault);
  } else {
    new Notification(titulo, opcionesDefault);
  }
}

/**
 * Programa una notificación de cierre de periodo
 * @param {number} diaCierre - Día del mes en que se cierra
 */
export function programarNotificacionCierrePeriodo(diaCierre) {
  const ahora = new Date();
  const diaActual = ahora.getDate();

  // Si estamos 2 días antes del cierre, recordar
  if (diaCierre - diaActual === 2 || diaCierre - diaActual === 1) {
    const mensaje =
      diaCierre - diaActual === 2
        ? "Faltan 2 días para el cierre del periodo financiero"
        : "Mañana es el cierre del periodo financiero";

    mostrarNotificacion("Cierre de Periodo Próximo", {
      body: mensaje,
      tag: "cierre-periodo-recordatorio",
    });
  }
}

/**
 * Muestra notificación de bienvenida
 */
export function mostrarNotificacionBienvenida() {
  if (Notification.permission === "granted") {
    mostrarNotificacion("Morelia Finanzas", {
      body: "¡Bienvenida! Tus finanzas están seguras.",
      tag: "bienvenida",
    });
  }
}

/**
 * Verifica si las notificaciones están habilitadas
 * @returns {boolean}
 */
export function estanNotificacionesHabilitadas() {
  return "Notification" in window && Notification.permission === "granted";
}

export default {
  inicializarNotificaciones,
  solicitarPermiso,
  mostrarNotificacion,
  programarNotificacionCierrePeriodo,
  mostrarNotificacionBienvenida,
  estanNotificacionesHabilitadas,
};
