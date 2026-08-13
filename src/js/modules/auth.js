/**
 * modules/auth.js
 * Sistema de autenticacion con Supabase y respaldo local.
 */

import { getState, setState } from "../state.js";
import { guardarEnStorage, obtenerDelStorage, eliminarDelStorage } from "../storage.js";
import { mostrarToast } from "../ui.js";
import { getSupabaseClient } from "../supabase.js";

const STORAGE_USERS = "misfinanzas_users";
const STORAGE_SESSION = "misfinanzas_session";

let ultimoErrorAuth = null;

const ERRORES_TRADUCIDOS = [
  { regex: /invalid login credentials|invalid_grant|invalid_credentials/i, msg: "Correo o contraseña incorrectos." },
  { regex: /email not confirmed|email_not_confirmed/i, msg: "Debes confirmar tu correo con el enlace que te enviamos antes de iniciar sesión." },
  { regex: /rate limit|too many requests/i, msg: "Demasiados intentos. Espera un momento y vuelve a intentar." },
  { regex: /failed to fetch|network|connection/i, msg: "No se pudo conectar con el servidor. Revisa tu internet e inténtalo de nuevo." },
];

function traducirErrorAuth(error) {
  const mensajeOriginal =
    error?.message || error?.msg || error?.error_description || "Credenciales incorrectas";
  const coincidencia = ERRORES_TRADUCIDOS.find(({ regex }) => regex.test(mensajeOriginal));
  return coincidencia ? coincidencia.msg : mensajeOriginal;
}
const COUNTRY_OPTIONS = [
  { code: "AR", label: "Argentina", currency: "ARS", language: "es", locale: "es-AR" },
  { code: "BO", label: "Bolivia", currency: "BOB", language: "es", locale: "es-BO" },
  { code: "BR", label: "Brasil", currency: "BRL", language: "pt", locale: "pt-BR" },
  { code: "CL", label: "Chile", currency: "CLP", language: "es", locale: "es-CL" },
  { code: "CO", label: "Colombia", currency: "COP", language: "es", locale: "es-CO" },
  { code: "CR", label: "Costa Rica", currency: "CRC", language: "es", locale: "es-CR" },
  { code: "EC", label: "Ecuador", currency: "USD", language: "es", locale: "es-EC" },
  { code: "SV", label: "El Salvador", currency: "USD", language: "es", locale: "es-SV" },
  { code: "GT", label: "Guatemala", currency: "GTQ", language: "es", locale: "es-GT" },
  { code: "MX", label: "Mexico", currency: "MXN", language: "es", locale: "es-MX" },
  { code: "PA", label: "Panama", currency: "USD", language: "es", locale: "es-PA" },
  { code: "PY", label: "Paraguay", currency: "PYG", language: "es", locale: "es-PY" },
  { code: "PE", label: "Peru", currency: "PEN", language: "es", locale: "es-PE" },
  { code: "DO", label: "Republica Dominicana", currency: "DOP", language: "es", locale: "es-DO" },
  { code: "UY", label: "Uruguay", currency: "UYU", language: "es", locale: "es-UY" },
  { code: "VE", label: "Venezuela", currency: "VES", language: "es", locale: "es-VE" },
];

function getCountryConfig(countryCode = "CL") {
  const normalized = countryCode.trim().toUpperCase();
  return COUNTRY_OPTIONS.find((option) => option.code === normalized) || COUNTRY_OPTIONS[3];
}

function aplicarIdPrefixAuth(container, idPrefix) {
  const idMap = {
    "auth-login-form": `${idPrefix}-form`,
    "auth-name": `${idPrefix}-nombre`,
    "auth-email": `${idPrefix}-email`,
    "auth-country": `${idPrefix}-country`,
    "auth-password": `${idPrefix}-password`,
  };

  Object.entries(idMap).forEach(([originalId, prefixedId]) => {
    container.querySelectorAll(`[for="${originalId}"]`).forEach((label) => {
      label.setAttribute("for", prefixedId);
    });

    const element = container.querySelector(`#${originalId}`);
    if (element) {
      element.id = prefixedId;
    }
  });
}

async function obtenerPasswordHash(password) {
  if (!window.crypto?.subtle) return password;

  const data = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function guardarSesionAuth(sessionData = {}) {
  const session = {
    userId: sessionData.userId || null,
    userName: sessionData.userName || null,
    userEmail: sessionData.userEmail || null,
  };

  guardarEnStorage(STORAGE_SESSION, session);

  if (session.userId) {
    const users = obtenerDelStorage(STORAGE_USERS) || {};
    const existente = users[session.userId];
    users[session.userId] = {
      id: session.userId,
      nombre: session.userName || existente?.nombre || "Usuario",
      email: session.userEmail || existente?.email || "",
      foto: existente?.foto || null,
      local: existente?.local ?? false,
      ...(existente?.passwordHash ? { passwordHash: existente.passwordHash } : {}),
      ...(existente?.country ? { country: existente.country } : {}),
      ...(existente?.countryName ? { countryName: existente.countryName } : {}),
      ...(existente?.currency ? { currency: existente.currency } : {}),
      ...(existente?.locale ? { locale: existente.locale } : {}),
      ...(existente?.createdAt ? { createdAt: existente.createdAt } : {}),
    };
    guardarEnStorage(STORAGE_USERS, users);
  }

  setState({
    userId: session.userId,
    userName: session.userName,
    userEmail: session.userEmail,
  });

  return session;
}

function redimensionarImagen(archivo, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo seleccionado no es una imagen valida"));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (error) {
          reject(new Error("No se pudo procesar la imagen"));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(archivo);
  });
}

function limpiarSesionAuth() {
  eliminarDelStorage(STORAGE_SESSION);
  setState({ userId: null, userName: null, userEmail: null });
}

export function inicializarAuth() {
  const session = obtenerDelStorage(STORAGE_SESSION);
  if (session && session.userId) {
    setState({
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
    });
    return true;
  }
  return false;
}

export async function registrarUsuario(nombre, email, password, country = "CL") {
  if (!nombre || !email || !password) {
    mostrarToast("error", "Complete todos los campos");
    return false;
  }

  if (nombre.trim().length < 2) {
    mostrarToast("error", "El nombre debe tener al menos 2 caracteres");
    return false;
  }

  if (password.length < 6) {
    mostrarToast("error", "La contrasena debe tener al menos 6 caracteres");
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return registrarUsuarioLocal(nombre, email, password, country);
  }

  try {
    const countryConfig = getCountryConfig(country);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.is_anonymous) {
      await supabase.auth.signOut();
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          nombre: nombre.trim(),
          name: nombre.trim(),
          full_name: nombre.trim(),
          country: countryConfig.code,
          country_name: countryConfig.label,
          currency: countryConfig.currency,
          language: countryConfig.language,
          locale: countryConfig.locale,
        },
      },
    });

    if (error) throw error;

    const user = data?.user;
    if (!user) {
      mostrarToast("error", "No se pudo crear la cuenta");
      return false;
    }

    if (!data?.session && (user.identities?.length ?? 1) === 0) {
      ultimoErrorAuth = "Este correo ya está registrado. Inicia sesión o usa ¿Olvidaste tu contraseña?";
      mostrarToast("error", ultimoErrorAuth);
      return false;
    }

    if (!data?.session) {
      ultimoErrorAuth = "Revisa tu correo para confirmar la cuenta y luego inicia sesión.";
      mostrarToast("success", ultimoErrorAuth);
      return false;
    }

    guardarSesionAuth({
      userId: user.id,
      userName: nombre.trim() || user.email,
      userEmail: user.email || email,
    });

    mostrarToast("success", `Cuenta creada para ${nombre.trim() || email}`);
    return true;
  } catch (error) {
    console.error("Error registrando usuario:", error);
    mostrarToast("error", error?.message || "No se pudo crear la cuenta");
    return false;
  }
}

async function registrarUsuarioLocal(nombre, email, password, country = "CL") {
  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const emailNormalizado = email.trim().toLowerCase();
  const emailEnUso = Object.values(users).some((user) => user.email === emailNormalizado);
  const countryConfig = getCountryConfig(country);

  if (emailEnUso) {
    mostrarToast("error", "Este email ya esta registrado");
    return false;
  }

  const userId =
    window.crypto?.randomUUID?.() ||
    `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = {
    id: userId,
    nombre: nombre.trim(),
    email: emailNormalizado,
    country: countryConfig.code,
    countryName: countryConfig.label,
    currency: countryConfig.currency,
    locale: countryConfig.locale,
    passwordHash: await obtenerPasswordHash(password),
    createdAt: new Date().toISOString(),
    local: true,
  };

  users[userId] = user;
  guardarEnStorage(STORAGE_USERS, users);
  guardarSesionAuth({ userId, userName: user.nombre, userEmail: user.email });
  mostrarToast("success", `Cuenta creada para ${user.nombre || user.email}`);
  return true;
}

export async function iniciarSesion(email, password) {
  if (!email || !password) {
    ultimoErrorAuth = "Ingresa tu correo y contraseña.";
    mostrarToast("error", "Ingrese email y contrasena");
    return false;
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    let errorSupabase = null;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (!error && data?.user) {
        const user = data.user;
        const nombre =
          user?.user_metadata?.nombre ||
          user?.user_metadata?.name ||
          user?.user_metadata?.full_name ||
          user?.email ||
          "Usuario";

        guardarSesionAuth({ userId: user.id, userName: nombre, userEmail: user.email });
        mostrarToast("success", `Bienvenido/a ${nombre}`);
        return true;
      }

      errorSupabase = error;
    } catch (error) {
      console.error("Error iniciando sesion:", error);
      errorSupabase = error;
    }

    // Respaldo: si la cuenta se creó en modo local (antes de conectar Supabase),
    // el usuario vive en este navegador y no existe en la nube.
    const emailNormalizado = email.trim().toLowerCase();
    const userLocal = Object.values(obtenerDelStorage(STORAGE_USERS) || {}).find(
      (item) => item.email === emailNormalizado
    );

    if (userLocal && userLocal.passwordHash === (await obtenerPasswordHash(password))) {
      guardarSesionAuth({
        userId: userLocal.id,
        userName: userLocal.nombre,
        userEmail: userLocal.email,
      });
      mostrarToast("success", `Bienvenido/a ${userLocal.nombre || userLocal.email}`);
      ultimoErrorAuth = null;
      return true;
    }

    const mensaje = traducirErrorAuth(errorSupabase);
    ultimoErrorAuth = mensaje;
    mostrarToast("error", mensaje);
    return false;
  }

  return iniciarSesionLocal(email, password);
}

async function iniciarSesionLocal(email, password) {
  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const emailNormalizado = email.trim().toLowerCase();
  const passwordHash = await obtenerPasswordHash(password);
  const user = Object.values(users).find(
    (item) => item.email === emailNormalizado && item.passwordHash === passwordHash
  );

  if (!user) {
    ultimoErrorAuth = "Correo o contraseña incorrectos.";
    mostrarToast("error", ultimoErrorAuth);
    return false;
  }

  guardarSesionAuth({ userId: user.id, userName: user.nombre, userEmail: user.email });
  mostrarToast("success", `Bienvenido/a ${user.nombre || user.email}`);
  return true;
}

export async function recuperarPassword(email) {
  const emailNormalizado = email.trim().toLowerCase();

  if (!emailNormalizado) {
    mostrarToast("error", "Escribe tu correo electronico para enviarte el enlace");
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
    mostrarToast("error", "Ingresa un correo electronico valido");
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    mostrarToast("info", "La recuperacion por correo solo esta disponible con Supabase");
    return false;
  }

  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset-password=true`;
    const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
      redirectTo,
    });

    if (error) throw error;

    mostrarToast("success", "Te enviamos un correo para recuperar tu contrasena");
    return true;
  } catch (error) {
    console.error("Error recuperando contrasena:", error);
    mostrarToast("error", error?.message || "No se pudo enviar el correo");
    return false;
  }
}

export function cerrarSesion() {
  getSupabaseClient()?.auth?.signOut?.();
  limpiarSesionAuth();
  mostrarToast("info", "Sesion cerrada");
}

export function haySesionActiva() {
  const state = getState();
  return !!state.userId;
}

export function obtenerUsuarioActual() {
  const state = getState();
  if (!state.userId) return null;

  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const user = users[state.userId];
  if (!user) {
    return {
      id: state.userId,
      nombre: state.userName || "Usuario",
      email: state.userEmail || "",
      foto: null,
    };
  }

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    foto: user.foto || null,
  };
}

export function actualizarPerfil(datos) {
  const state = getState();
  if (!state.userId) return false;

  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const user =
    users[state.userId] || {
      id: state.userId,
      nombre: state.userName || "Usuario",
      email: state.userEmail || "",
      foto: null,
    };

  if (datos.nombre && datos.nombre.trim().length >= 2) {
    user.nombre = datos.nombre.trim();
  }
  if (typeof datos.foto === "string") {
    user.foto = datos.foto;
  }

  users[state.userId] = user;
  guardarEnStorage(STORAGE_USERS, users);

  guardarSesionAuth({
    userId: state.userId,
    userName: user.nombre,
    userEmail: user.email,
  });

  // Sincronizar el nombre con Supabase (si el usuario es de la nube)
  const supabase = getSupabaseClient();
  if (supabase && !user.local) {
    supabase.auth
      .updateUser({
        data: { nombre: user.nombre, name: user.nombre, full_name: user.nombre },
      })
      .catch((error) => console.warn("No se pudo sincronizar el perfil con la nube:", error));
  }

  mostrarToast("success", "Perfil actualizado");
  return true;
}

let perfilEditInicializado = false;

export function renderizarPerfil() {
  const vista = document.getElementById("vista-perfil");
  if (!vista) return;

  const user = obtenerUsuarioActual();

  const setAvatar = (containerId, foto, nombre) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    if (foto) {
      const img = document.createElement("img");
      img.src = foto;
      img.alt = "Foto de perfil";
      img.classList.add("profile-avatar-img");
      container.appendChild(img);
    } else {
      container.textContent = (nombre || "U").charAt(0).toUpperCase();
    }
  };

  setAvatar("profile-avatar-badge", user?.foto, user?.nombre);

  const nameEl = document.getElementById("profile-user-name");
  const emailEl = document.getElementById("profile-user-email");
  if (nameEl) nameEl.textContent = user?.nombre || "Mi perfil";
  if (emailEl) emailEl.textContent = user?.email || "Usuario de Morelia Finanzas";

  if (perfilEditInicializado) return;
  perfilEditInicializado = true;

  const editBtn = document.getElementById("profile-edit-info-btn");
  const editPanel = document.getElementById("profile-edit-panel");
  const editForm = document.getElementById("profile-edit-form");
  const nameInput = document.getElementById("profile-edit-name");
  const emailInput = document.getElementById("profile-edit-email");
  const photoInput = document.getElementById("profile-photo-input");
  const photoRemoveBtn = document.getElementById("profile-photo-remove");
  const cancelBtn = document.getElementById("profile-edit-cancel");

  let fotoPendiente = null;

  const abrirEdicion = () => {
    if (!editPanel || !nameInput) return;
    const usuario = obtenerUsuarioActual();
    nameInput.value = usuario?.nombre || "";
    if (emailInput) emailInput.value = usuario?.email || "";
    fotoPendiente = null;
    setAvatar("profile-edit-avatar", usuario?.foto, usuario?.nombre);
    editPanel.hidden = false;
    editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  editBtn?.addEventListener("click", abrirEdicion);

  cancelBtn?.addEventListener("click", () => {
    if (editPanel) editPanel.hidden = true;
    if (photoInput) photoInput.value = "";
  });

  photoInput?.addEventListener("change", async () => {
    const archivo = photoInput.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      mostrarToast("error", "Selecciona un archivo de imagen");
      return;
    }
    try {
      fotoPendiente = await redimensionarImagen(archivo);
      setAvatar("profile-edit-avatar", fotoPendiente, user?.nombre);
    } catch (error) {
      mostrarToast("error", error?.message || "No se pudo procesar la imagen");
    }
  });

  photoRemoveBtn?.addEventListener("click", () => {
    fotoPendiente = "";
    setAvatar("profile-edit-avatar", null, user?.nombre);
    if (photoInput) photoInput.value = "";
  });

  editForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const nombre = nameInput?.value?.trim() || "";
    if (nombre.length < 2) {
      mostrarToast("error", "El nombre debe tener al menos 2 caracteres");
      return;
    }

    const datos = { nombre };
    if (fotoPendiente !== null) {
      datos.foto = fotoPendiente;
    }

    const ok = actualizarPerfil(datos);
    if (!ok) return;

    if (editPanel) editPanel.hidden = true;
    if (photoInput) photoInput.value = "";
    renderizarPerfil();
    renderizarPanelAuth("auth-panel");
  });
}

export async function renderizarPanelAuth(containerId = "auth-panel") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = getState();
  const idPrefix = `auth-${containerId.replace(/[^a-z0-9_-]/gi, "-")}`;

  if (state.userId) {
    const user = obtenerUsuarioActual();
    const avatarHtml = user?.foto
      ? `<img src="${user.foto}" alt="Foto de perfil" class="user-avatar">`
      : `<div class="user-avatar">${user?.nombre?.charAt(0) || "U"}</div>`;
    container.innerHTML = `
      <div class="auth-panel user-panel">
        <div class="user-info">
          ${avatarHtml}
          <div class="user-details">
            <span class="user-name">${user?.nombre || "Usuario"}</span>
            <span class="user-email">${user?.email || ""}</span>
          </div>
        </div>

        <div class="profile-card">
          <div class="profile-card-content">
            <h4>Perfil</h4>
            <p><strong>Nombre:</strong> ${user?.nombre || "Usuario"}</p>
            <p><strong>Email:</strong> ${user?.email || ""}</p>
            <p>Tu cuenta esta activa y este panel permanece visible.</p>
          </div>
        </div>

        <div class="user-actions">
          <button type="button" class="btn-primary btn-sm" data-auth-action="logout">
            Cerrar sesion
          </button>
        </div>
      </div>
    `;

    container.querySelector("[data-auth-action='logout']")?.addEventListener("click", async () => {
      cerrarSesion();
      await renderizarPanelAuth(containerId);
      if (containerId !== "auth-panel") {
        await renderizarPanelAuth("auth-panel");
      }
      window.mostrarLoginScreen?.();
    });
    return;
  }

  const countryOptions = COUNTRY_OPTIONS.map(
    (option) => `<option value="${option.code}" ${option.code === "CL" ? "selected" : ""}>${option.label}</option>`
  ).join("");

  const authTemplatePath = "/templates/auth-view.html";
  try {
    const respuesta = await fetch(authTemplatePath);
    if (!respuesta.ok) throw new Error(`No se pudo cargar ${authTemplatePath}`);
    container.innerHTML = await respuesta.text();
    aplicarIdPrefixAuth(container, idPrefix);
  } catch (error) {
    console.error("Error cargando plantilla de auth:", error);
    container.innerHTML = `
      <div class="auth-panel">
        <div class="auth-panel-brand">
          <img class="auth-panel-logo" src="/src/assets/marca/logo-morelia.svg" alt="Morelia">
        </div>
        <p class="auth-copy auth-copy--brand">Crea tu cuenta o inicia sesión.</p>
        <form id="${idPrefix}-form" class="auth-form" novalidate>
          <label class="auth-field" for="${idPrefix}-nombre">
            <span>Nombre</span>
            <input type="text" id="${idPrefix}-nombre" name="name" placeholder="Tu nombre" autocomplete="name" maxlength="100">
          </label>
          <label class="auth-field" for="${idPrefix}-email">
            <span>Correo electrónico</span>
            <input type="email" id="${idPrefix}-email" name="email" placeholder="tu@email.com" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required>
          </label>
          <label class="auth-field" for="${idPrefix}-country">
            <span>País</span>
            <select id="${idPrefix}-country" name="country">${countryOptions}</select>
          </label>
          <label class="auth-field" for="${idPrefix}-password">
            <span>Contraseña</span>
            <div class="password-wrapper">
              <input type="password" id="${idPrefix}-password" name="password" placeholder="••••" autocomplete="current-password" minlength="6" maxlength="128" spellcheck="false" required>
              <button type="button" class="toggle-password-btn" data-auth-action="toggle-password" aria-label="Mostrar contraseña" aria-pressed="false">
                <img src="/src/assets/icons/eye_close.svg" alt="" width="24" height="24">
              </button>
            </div>
          </label>
          <p class="auth-message" role="status" aria-live="polite"></p>
          <div class="auth-actions">
            <button type="submit" class="auth-btn auth-btn-primary btn-primary" data-auth-action="login">Iniciar sesión</button>
            <button type="button" class="auth-btn auth-btn-secondary btn-secondary" data-auth-action="signup">Registrarse</button>
          </div>
          <button type="button" class="auth-recover-btn" data-auth-action="recover">¿Olvidaste tu contraseña?</button>
        </form>
      </div>
    `;
  }

  const countrySelect = container.querySelector(`#${idPrefix}-country`);
  if (countrySelect) {
    countrySelect.innerHTML = countryOptions;
  }

  const loginBtn = container.querySelector("[data-auth-action='login']");
  const signupBtn = container.querySelector("[data-auth-action='signup']");
  const recoverBtn = container.querySelector("[data-auth-action='recover']");
  const togglePasswordBtn = container.querySelector("[data-auth-action='toggle-password']");
  const message = container.querySelector(".auth-message");
  const nameInput = container.querySelector(`#${idPrefix}-nombre`);
  const emailInput = container.querySelector(`#${idPrefix}-email`);
  const countryInput = container.querySelector(`#${idPrefix}-country`);
  const passwordInput = container.querySelector(`#${idPrefix}-password`);

  const setLoading = (isLoading) => {
    [loginBtn, signupBtn, recoverBtn].forEach((button) => {
      if (!button) return;
      button.disabled = isLoading;
      button.toggleAttribute("data-loading", isLoading);
    });
  };

  const setMessage = (text, type = "") => {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle("is-error", type === "error");
    message.classList.toggle("is-success", type === "success");
  };

  const refreshAuthPanels = () => {
    renderizarPerfil();
    window.ocultarLoginScreen?.();
  };

  const runAuthAction = async (action) => {
    const email = emailInput?.value || "";
    const password = passwordInput?.value || "";
    const nombre = nameInput?.value || "";
    const country = countryInput?.value || "CL";

    ultimoErrorAuth = null;
    setLoading(true);
    setMessage(
      action === "signup"
        ? "Creando cuenta..."
        : action === "recover"
          ? "Enviando correo de recuperacion..."
          : "Iniciando sesion..."
    );

    try {
      const ok =
        action === "signup"
          ? await registrarUsuario(nombre, email, password, country)
          : action === "recover"
            ? await recuperarPassword(email)
            : await iniciarSesion(email, password);

      if (ok && action !== "recover") {
        refreshAuthPanels();
      } else if (ok) {
        setMessage("Te enviamos un correo para recuperar tu contrasena.", "success");
      } else {
        setMessage(ultimoErrorAuth || "Revisa los datos e intentalo nuevamente.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  togglePasswordBtn?.addEventListener("click", () => {
    if (!passwordInput || !togglePasswordBtn) return;
    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    togglePasswordBtn.setAttribute("aria-pressed", String(!isVisible));
    togglePasswordBtn.setAttribute(
      "aria-label",
      isVisible ? "Mostrar contrasena" : "Ocultar contrasena"
    );
    const icon = togglePasswordBtn.querySelector("img");
    if (icon) {
      icon.src = isVisible ? "/src/assets/icons/eye_close.svg" : "/src/assets/icons/visibility.svg";
    }
  });

  container.querySelector(`#${idPrefix}-form`)?.addEventListener("submit", (event) => {
    event.preventDefault();
    runAuthAction("login");
  });

  signupBtn?.addEventListener("click", () => runAuthAction("signup"));
  recoverBtn?.addEventListener("click", () => runAuthAction("recover"));
}

export default {
  inicializarAuth,
  registrarUsuario,
  iniciarSesion,
  recuperarPassword,
  cerrarSesion,
  haySesionActiva,
  obtenerUsuarioActual,
  actualizarPerfil,
  renderizarPerfil,
  renderizarPanelAuth,

};
