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
  setState({
    userId: session.userId,
    userName: session.userName,
    userEmail: session.userEmail,
  });

  return session;
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
    mostrarToast("error", "Ingrese email y contrasena");
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return iniciarSesionLocal(email, password);
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;

    const user = data?.user;
    const nombre =
      user?.user_metadata?.nombre ||
      user?.user_metadata?.name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "Usuario";

    guardarSesionAuth({ userId: user.id, userName: nombre, userEmail: user.email });

    mostrarToast("success", `Bienvenido/a ${nombre}`);
    return true;
  } catch (error) {
    console.error("Error iniciando sesion:", error);
    mostrarToast("error", error?.message || "Credenciales incorrectas");
    return false;
  }
}

async function iniciarSesionLocal(email, password) {
  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const emailNormalizado = email.trim().toLowerCase();
  const passwordHash = await obtenerPasswordHash(password);
  const user = Object.values(users).find(
    (item) => item.email === emailNormalizado && item.passwordHash === passwordHash
  );

  if (!user) {
    mostrarToast("error", "Credenciales incorrectas");
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
    };
  }

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
  };
}

export function actualizarPerfil(datos) {
  const state = getState();
  if (!state.userId) return false;

  const users = obtenerDelStorage(STORAGE_USERS) || {};
  const user = users[state.userId];

  if (!user) return false;

  if (datos.nombre) user.nombre = datos.nombre;
  if (datos.email) {
    const emailEnUso = Object.values(users).some(
      (u) => u.email === datos.email && u.id !== state.userId
    );
    if (emailEnUso) {
      mostrarToast("error", "Este email ya esta en uso");
      return false;
    }
    user.email = datos.email;
  }

  users[state.userId] = user;
  guardarEnStorage(STORAGE_USERS, users);

  guardarSesionAuth({
    userId: state.userId,
    userName: user.nombre,
    userEmail: user.email,
  });

  mostrarToast("success", "Perfil actualizado");
  return true;
}

export async function renderizarPanelAuth(containerId = "auth-panel") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = getState();
  const idPrefix = `auth-${containerId.replace(/[^a-z0-9_-]/gi, "-")}`;

  if (state.userId) {
    const user = obtenerUsuarioActual();
    container.innerHTML = `
      <div class="auth-panel user-panel">
        <div class="user-info">
          <div class="user-avatar">${user?.nombre?.charAt(0) || "U"}</div>
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
    window.ocultarLoginScreen?.();
  };

  const runAuthAction = async (action) => {
    const email = emailInput?.value || "";
    const password = passwordInput?.value || "";
    const nombre = nameInput?.value || "";
    const country = countryInput?.value || "CL";

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
        setMessage("Revisa los datos e intentalo nuevamente.", "error");
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
  renderizarPanelAuth,

};
