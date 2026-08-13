/**
 * pwa.js
 * Registro del Service Worker y gestión de instalación PWA
 */

let deferredInstallPrompt = null;

/**
 * Registra el Service Worker de la PWA
 * @returns {Promise<boolean>}
 */
export async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Este navegador no soporta Service Workers");
    return false;
  }

  try {
    await navigator.serviceWorker.register("/sw.js");
    return true;
  } catch (error) {
    console.error("Error registrando Service Worker:", error);
    return false;
  }
}

/**
 * Detecta si la app se está ejecutando como PWA instalada
 * @returns {boolean}
 */
export function esPWAInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/**
 * Configura el botón de instalación de la PWA
 * @param {string} buttonId - id del botón (opcional)
 */
export function configurarInstalacion(buttonId = "btn-instalar-pwa") {
  const installBtn = document.getElementById(buttonId);
  if (!installBtn) return;

  const toggleButton = () => {
    const visible = !!deferredInstallPrompt && !esPWAInstalada();
    installBtn.classList.toggle("hidden", !visible);
    installBtn.classList.toggle("pwa-install-btn", true);
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    toggleButton();
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    toggleButton();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    toggleButton();
  });

  toggleButton();
}

export default {
  registrarServiceWorker,
  esPWAInstalada,
  configurarInstalacion,
};
