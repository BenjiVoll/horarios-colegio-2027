async function signInWithEmailPassword(email, password, remember = true) {
  const apiKey = getActiveFirebaseApiKey();
  if (!apiKey) {
    const details = document.getElementById('authApiConfigDetails');
    if (details) details.open = true;
    throw new Error('Primero ingresa la Firebase Web API Key (AIzaSy...) de tu proyecto en la sección inferior "⚙️ Configuración de Credenciales Firebase".');
  }

  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      returnSecureToken: true
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const errCode = data && data.error && data.error.message ? data.error.message : `HTTP_${res.status}`;
    throw new Error(translateFirebaseAuthError(errCode));
  }

  const expiresInSec = Number(data.expiresIn || 3600);
  const sessionObj = {
    email: data.email,
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + expiresInSec * 1000
  };
  saveAuthSession(sessionObj, remember);
  return sessionObj;
}

let refreshingTokenPromise = null;

async function refreshIdToken() {
  if (!authSession || !authSession.refreshToken) {
    throw new Error('SESSION_MISSING');
  }
  const apiKey = getActiveFirebaseApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  if (refreshingTokenPromise) {
    return refreshingTokenPromise;
  }

  refreshingTokenPromise = (async () => {
    try {
      const endpoint = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(authSession.refreshToken)}`
      });

      const data = await res.json();
      if (!res.ok || !data.id_token) {
        const errCode = data && data.error && (data.error.message || data.error) ? (data.error.message || data.error) : 'TOKEN_REFRESH_FAILED';
        throw new Error(errCode);
      }

      const expiresInSec = Number(data.expires_in || 3600);
      saveAuthSession(
        {
          ...authSession,
          idToken: data.id_token,
          refreshToken: data.refresh_token || authSession.refreshToken,
          localId: data.user_id || authSession.localId,
          expiresAt: Date.now() + expiresInSec * 1000
        },
        authSession.remember !== false
      );
      return authSession.idToken;
    } finally {
      refreshingTokenPromise = null;
    }
  })();

  return refreshingTokenPromise;
}

async function sendPasswordResetEmail(email) {
  const apiKey = getActiveFirebaseApiKey();
  if (!apiKey) {
    const details = document.getElementById('authApiConfigDetails');
    if (details) details.open = true;
    throw new Error('Primero configura la Firebase Web API Key en la sección inferior.');
  }
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: email.trim()
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const errCode = data && data.error && data.error.message ? data.error.message : `HTTP_${res.status}`;
    throw new Error(translateFirebaseAuthError(errCode));
  }
  return true;
}

