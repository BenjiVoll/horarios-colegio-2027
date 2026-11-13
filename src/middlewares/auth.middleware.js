/* ==========================================================================
   MIDDLEWARE DE AUTENTICACIÓN, SESIONES Y SEGURIDAD (FIREBASE AUTH + JWT)
   ========================================================================== */
function isAuthenticated() {
  return Boolean(authSession && authSession.idToken && authSession.email);
}

function loadStoredAuthSession() {
  try {
    const rawSession = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) || localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!rawSession) return null;
    const parsed = JSON.parse(rawSession);
    if (parsed && parsed.idToken && parsed.refreshToken && parsed.email) {
      return parsed;
    }
  } catch (err) {
    console.error('Error al leer sesión almacenada:', err);
  }
  return null;
}

function saveAuthSession(sessionObj, remember = true) {
  authSession = {
    ...sessionObj,
    remember: Boolean(remember),
    lastActivityAt: Date.now()
  };
  try {
    const serialized = JSON.stringify(authSession);
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
    if (remember) {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
    } else {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Error al guardar sesión:', err);
  }
}

function clearAuthSession() {
  document.documentElement.classList.remove('has-stored-session');
  authSession = null;
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (cloudSyncTimer) {
    clearInterval(cloudSyncTimer);
    cloudSyncTimer = null;
  }
  try {
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (err) {
    console.error(err);
  }
}

function showAuthAlert(message, type = 'error') {
  const errEl = document.getElementById('authErrorAlert');
  const infoEl = document.getElementById('authInfoAlert');
  if (errEl) errEl.classList.add('hidden');
  if (infoEl) infoEl.classList.add('hidden');
  if (!message) return;

  const target = type === 'info' ? infoEl : errEl;
  if (target) {
    target.textContent = message;
    target.classList.remove('hidden');
  }
}

function translateFirebaseAuthError(code) {
  const msg = String(code || '').toUpperCase();
  if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD') || msg.includes('EMAIL_NOT_FOUND')) {
    return 'Correo o contraseña incorrectos. Verifica tus credenciales institucionales.';
  }
  if (msg.includes('INVALID_EMAIL')) {
    return 'El formato del correo electrónico no es válido.';
  }
  if (msg.includes('USER_DISABLED')) {
    return 'Esta cuenta de usuario ha sido deshabilitada por el administrador.';
  }
  if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return 'Demasiados intentos fallidos. Por seguridad, espera unos minutos antes de reintentar.';
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('PROJECT_NOT_FOUND')) {
    return 'La Firebase Web API Key configurada no es válida. Verifica la clave en Configuración.';
  }
  if (msg.includes('CONFIGURATION_NOT_FOUND') || msg.includes('OPERATION_NOT_ALLOWED')) {
    return 'Debes habilitar el proveedor "Correo electrónico/contraseña" en Firebase Console ➔ Authentication ➔ Sign-in method.';
  }
  return `Error de autenticación (${code || 'Desconocido'}).`;
}

async function ensureValidIdToken() {
  if (!isAuthenticated()) {
    throw new Error('AUTH_REQUIRED');
  }
  // Renovar automáticamente si faltan menos de 3 minutos para que expire el JWT
  if (Date.now() >= Number(authSession.expiresAt || 0) - 180000) {
    return await refreshIdToken();
  }
  return authSession.idToken;
}

/**
 * Middleware central para llamadas autenticadas a Firebase Realtime Database.
 * Adjunta el token JWT (?auth=idToken) y reintenta si el token acaba de expirar.
 */
async function authenticatedDatabaseFetch(endpointUrl, options = {}, extraQuery = '') {
  const idToken = await ensureValidIdToken();
  const separator = endpointUrl.includes('?') ? '&' : '?';
  const queryParts = [`auth=${encodeURIComponent(idToken)}`];
  if (extraQuery) queryParts.push(extraQuery);
  const finalUrl = `${endpointUrl}${separator}${queryParts.join('&')}`;

  let res = await fetch(finalUrl, options);

  // Si Firebase devuelve 401 por expiración del token, refrescamos una vez y reintentamos
  if (res.status === 401) {
    try {
      const freshToken = await refreshIdToken();
      const retryParts = [`auth=${encodeURIComponent(freshToken)}`];
      if (extraQuery) retryParts.push(extraQuery);
      res = await fetch(`${endpointUrl}${separator}${retryParts.join('&')}`, options);
    } catch (refreshErr) {
      lockApplicationUI('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
      throw new Error('SESSION_EXPIRED');
    }
  }

  return res;
}

function resetInactivityWatchdog() {
  if (!isAuthenticated()) return;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (isAuthenticated()) {
      lockApplicationUI('🔒 Sesión cerrada automáticamente por 60 minutos de inactividad.');
    }
  }, SESSION_INACTIVITY_LIMIT_MS);
}

function unlockApplicationUI() {
  document.documentElement.classList.add('has-stored-session');
  document.body.classList.remove('auth-locked');
  const overlay = document.getElementById('authLoginOverlay');
  if (overlay) overlay.classList.add('hidden');

  const emailEl = document.getElementById('authUserEmailText');
  if (emailEl && authSession && authSession.email) {
    emailEl.textContent = authSession.email;
    emailEl.title = `Sesión activa: ${authSession.email}`;
  }

  showAuthAlert('');
  resetInactivityWatchdog();

  // Renovación preventiva del token cada 45 minutos mientras la app esté abierta
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);
  tokenRefreshTimer = setInterval(() => {
    if (isAuthenticated()) {
      refreshIdToken().catch((err) => console.warn('Renovación preventiva de token:', err));
    }
  }, 45 * 60 * 1000);

  loadState();
  renderAll();
  startCloudSyncLoop();
}

function lockApplicationUI(reasonMessage = '') {
  document.documentElement.classList.remove('has-stored-session');
  clearAuthSession();
  document.body.classList.add('auth-locked');
  const overlay = document.getElementById('authLoginOverlay');
  if (overlay) overlay.classList.remove('hidden');

  const pwdInput = document.getElementById('authPasswordInput');
  if (pwdInput) pwdInput.value = '';

  const apiKeyInput = document.getElementById('authLoginApiKeyInput');
  if (apiKeyInput) apiKeyInput.value = getActiveFirebaseApiKey();

  const details = document.getElementById('authApiConfigDetails');
  if (details && !getActiveFirebaseApiKey()) {
    details.open = true;
  }

  if (reasonMessage) {
    showAuthAlert(reasonMessage, 'info');
  }
}

