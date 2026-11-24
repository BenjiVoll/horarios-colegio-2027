/* ==========================================================================
   PERSISTENCIA DINÁMICA EN LA NUBE (FIREBASE) Y POR AÑO ESCOLAR
   ========================================================================== */
function updateCloudStatusUI(status, customMessage = '') {
  const dot = document.getElementById('cloudStatusDot');
  const text = document.getElementById('cloudStatusText');
  const banner = document.getElementById('cloudModalStatusDetail');
  if (!dot || !text) return;

  dot.className = 'cloud-dot';
  if (status === 'connected') {
    dot.classList.add('connected');
    text.textContent = customMessage || '🔒 Nube Protegida';
    if (banner) {
      banner.textContent = `Conectado con autenticación segura (${authSession ? authSession.email : 'Token activo'}) en ${getActiveFirebaseUrl()}`;
    }
  } else if (status === 'syncing') {
    dot.classList.add('syncing');
    text.textContent = customMessage || '☁️ Guardando...';
  } else if (status === 'error') {
    dot.classList.add('error');
    text.textContent = customMessage || '☁️ Error de Nube';
    if (banner) {
      banner.textContent = 'No se pudo sincronizar. Verifica tu sesión activa y las Reglas de Seguridad en Firebase.';
    }
  } else {
    dot.classList.add('disconnected');
    text.textContent = '☁️ Configurar Base de Datos';
    if (banner) banner.textContent = 'Sin conexión a la nube — Configura la URL y API Key de Firebase.';
  }
}

async function pushStateToCloud(year = currentSchoolYear) {
  if (!isAuthenticated()) {
    lockApplicationUI('Debes iniciar sesión para guardar cambios en la base de datos.');
    return false;
  }

  const endpoint = getCloudEndpoint(year);
  if (!endpoint) {
    updateCloudStatusUI('disconnected');
    return false;
  }

  try {
    isPushingToCloud = true;
    updateCloudStatusUI('syncing', '☁️ Guardando...');
    const payload = {
      ...state,
      updatedAt: state.updatedAt || Date.now(),
      updatedBy: authSession ? authSession.email : 'authenticated_user',
      clientId: CLIENT_SESSION_ID
    };

    const res = await authenticatedDatabaseFetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    lastSyncedUpdatedAt = Number(payload.updatedAt || Date.now());
    updateCloudStatusUI('connected', '🔒 Nube Sincronizada');
    return true;
  } catch (err) {
    console.error('Error al guardar en Firebase:', err);
    updateCloudStatusUI('error', '☁️ Error al guardar');
    return false;
  } finally {
    isPushingToCloud = false;
  }
}

function updateSaveButtonUI() {
  const btn = document.getElementById('btnSaveChanges');
  if (!btn) return;
  if (hasUnsavedChanges) {
    btn.className = 'btn btn-save-db btn-sm unsaved';
    btn.innerHTML = '💾 Guardar Cambios <small>(Sin guardar)</small>';
  } else {
    btn.className = 'btn btn-save-db btn-sm saved';
    btn.innerHTML = '✅ Guardado';
  }
}

async function commitSaveToDatabase() {
  if (!isAuthenticated()) {
    lockApplicationUI('Debes iniciar sesión para guardar cambios.');
    return;
  }

  state.updatedAt = Date.now();
  state.clientId = CLIENT_SESSION_ID;
  try {
    localStorage.setItem(getStorageKeyForYear(currentSchoolYear), JSON.stringify(state));
  } catch (err) {
    console.error('Error al guardar en almacenamiento local:', err);
  }
  updateGlobalCounters();

  if (getActiveFirebaseUrl()) {
    // Protección contra sobrescritura: verificar si otro usuario guardó cambios más recientes en la nube
    try {
      const endpoint = getCloudEndpoint(currentSchoolYear);
      const checkRes = await authenticatedDatabaseFetch(endpoint, { cache: 'no-store' }, `t=${Date.now()}`);
      if (checkRes.ok) {
        const remote = await checkRes.json();
        const remoteUpdatedAt = Number(remote?.updatedAt || 0);
        if (
          remote &&
          remoteUpdatedAt > lastSyncedUpdatedAt &&
          remote.clientId &&
          remote.clientId !== CLIENT_SESSION_ID
        ) {
          const who = remote.updatedBy || 'otro usuario';
          const when = new Date(remoteUpdatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
          const proceed = confirm(
            `⚠️ Atención: ${who} guardó cambios más recientes en la nube (${when}) mientras editabas.\n\n` +
              `¿Deseas SOBRESCRIBIR la nube con tus cambios actuales?\n` +
              `• Aceptar: guarda tu versión en la nube.\n` +
              `• Cancelar: mantiene tus cambios locales para que revises o descargues la nube primero.`
          );
          if (!proceed) {
            showToast('Guardado en la nube cancelado para evitar sobrescritura.', 'warn');
            return;
          }
        }
      }
    } catch (checkErr) {
      console.warn('No se pudo verificar versión remota antes de guardar:', checkErr);
    }

    const ok = await pushStateToCloud(currentSchoolYear);
    if (ok) {
      hasUnsavedChanges = false;
      updateSaveButtonUI();
      showToast('💾 ¡Cambios guardados de forma segura en la Base de Datos!', 'success');
    } else {
      showToast('⚠️ Se guardó localmente, pero hubo un problema al subir a la nube.', 'warn');
    }
  } else {
    hasUnsavedChanges = false;
    updateSaveButtonUI();
    showToast('💾 Cambios guardados.', 'success');
  }
}

async function pullStateFromCloud(year = currentSchoolYear, options = { force: false, silent: false }) {
  if (!isAuthenticated()) return false;

  const endpoint = getCloudEndpoint(year);
  if (!endpoint) {
    updateCloudStatusUI('disconnected');
    return false;
  }

  // No sobrescribir cambios en pantalla que el usuario aún no ha guardado (a menos que sea forzado al iniciar)
  if ((isPushingToCloud || hasUnsavedChanges) && !options.force) return false;

  try {
    if (!options.silent) {
      updateCloudStatusUI('syncing', '☁️ Sincronizando...');
    }
    const res = await authenticatedDatabaseFetch(
      endpoint,
      { cache: 'no-store' },
      `t=${Date.now()}`
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const cloudData = await res.json();

    // Si la base de datos en la nube aún está vacía (primera vez), subimos nuestro estado inicial (0/38)
    if (!cloudData || !Array.isArray(cloudData.courses)) {
      await pushStateToCloud(year);
      return true;
    }

    const cloudUpdatedAt = Number(cloudData.updatedAt || 0);
    const localUpdatedAt = Number(state.updatedAt || 0);

    if (options.force || cloudUpdatedAt > localUpdatedAt || (cloudUpdatedAt !== localUpdatedAt && cloudData.clientId !== CLIENT_SESSION_ID)) {
      state = {
        teachers: cloudData.teachers || [],
        courses: cloudData.courses || [],
        periods: cloudData.periods || [],
        requirements: cloudData.requirements || [],
        assignments: cloudData.assignments || {},
        teacherUnavailable: cloudData.teacherUnavailable || {},
        updatedAt: cloudUpdatedAt || Date.now(),
        clientId: cloudData.clientId || ''
      };
      lastSyncedUpdatedAt = Number(state.updatedAt || 0);
      hasUnsavedChanges = false;
      updateSaveButtonUI();
      try {
        localStorage.setItem(getStorageKeyForYear(year), JSON.stringify(state));
      } catch (e) {
        console.error(e);
      }
      renderAll();
      if (!options.silent && !options.isInitial) {
        showToast('☁️ Horario sincronizado desde la nube.', 'info');
      }
    }

    updateCloudStatusUI('connected', '🔒 Nube Protegida');
    return true;
  } catch (err) {
    console.error('Error al descargar desde Firebase:', err);
    updateCloudStatusUI('error', '☁️ Error de conexión');
    return false;
  }
}

function startCloudSyncLoop() {
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(() => {
    if (isAuthenticated() && getActiveFirebaseUrl() && !isPushingToCloud && !hasUnsavedChanges) {
      pullStateFromCloud(currentSchoolYear, { force: false, silent: true });
    }
  }, 4000);
}

function loadState(year = null) {
  loadAvailableSchoolYears();
  try {
    if (year) {
      currentSchoolYear = String(year);
      localStorage.setItem(ACTIVE_YEAR_KEY, currentSchoolYear);
    } else {
      currentSchoolYear = localStorage.getItem(ACTIVE_YEAR_KEY) || '2026';
    }

    ensureYearInList(currentSchoolYear);
    renderSchoolYearSelector();

    undoStack = [];
    hasUnsavedChanges = false;
    lastSyncedUpdatedAt = 0;
    updateUndoButton();
    updateSaveButtonUI();

    const raw = localStorage.getItem(getStorageKeyForYear(currentSchoolYear));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.teachers) && Array.isArray(parsed.courses)) {
        state = {
          teachers: parsed.teachers || [],
          courses: parsed.courses || [],
          periods: parsed.periods || [],
          requirements: parsed.requirements || [],
          assignments: parsed.assignments || {},
          teacherUnavailable: parsed.teacherUnavailable || {},
          updatedAt: Number(parsed.updatedAt || 0),
          clientId: parsed.clientId || CLIENT_SESSION_ID
        };
        if (isAuthenticated() && getActiveFirebaseUrl()) {
          pullStateFromCloud(currentSchoolYear, { force: true, silent: true, isInitial: true });
        } else {
          updateCloudStatusUI('disconnected');
        }
        return;
      }
    }
  } catch (err) {
    console.error('Error al cargar almacenamiento local:', err);
  }

  // Por defecto inicia en blanco desde cero (0/38 bloques asignados), manteniendo cursos, asignaturas y profesores listos
  state = getInstitutionalBaseData(false);
  state.updatedAt = Date.now();
  state.clientId = CLIENT_SESSION_ID;
  try {
    localStorage.setItem(getStorageKeyForYear(currentSchoolYear), JSON.stringify(state));
  } catch (e) {
    console.error(e);
  }
  updateGlobalCounters();

  if (isAuthenticated() && getActiveFirebaseUrl()) {
    pullStateFromCloud(currentSchoolYear, { force: true, silent: true, isInitial: true });
  } else {
    updateCloudStatusUI('disconnected');
  }
}

function saveState(markUnsaved = true) {
  if (!isAuthenticated()) {
    lockApplicationUI('Debes iniciar sesión para realizar modificaciones.');
    return;
  }
  updateGlobalCounters();
  if (markUnsaved) {
    hasUnsavedChanges = true;
    updateSaveButtonUI();
  }
}

/* ==========================================================================
   EXPORTACIÓN A PLANILLA (CSV) Y RESPALDO JSON
   ========================================================================== */
function exportToCSV() {
  const rows = [
    ['Año Escolar', 'Curso', 'Día', 'Bloque', 'Horario', 'Sigla Ramo', 'Asignatura', 'Sigla Prof.', 'Profesor']
  ];

  state.courses.forEach((course) => {
    DAYS.forEach((day) => {
      state.periods.forEach((period) => {
        if (period.type === 'break') return;
        if (isPeriodDisabledOnDay(period, day.index)) return;

        const a = state.assignments[slotKey(course.id, day.index, period.id)];
        const teacher = a ? state.teachers.find((t) => t.id === a.teacherId) : null;
        rows.push([
          currentSchoolYear,
          course.name,
          day.name,
          period.label,
          `${period.start} - ${period.end}`,
          a ? a.shortCode || '' : 'LIBRE',
          a ? a.subject : 'LIBRE',
          teacher ? teacher.initials : '',
          teacher ? teacher.name : ''
        ]);
      });
    });
  });

  const csvContent =
    '\uFEFF' +
    rows
      .map((row) => row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Planilla_Horarios_Christian_College_${currentSchoolYear}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`📊 Planilla CSV (${currentSchoolYear}) descargada.`, 'success');
}

function exportToJSON() {
  const dataStr = JSON.stringify({ institution: 'Christian College', schoolYear: currentSchoolYear, ...state }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Respaldo_Horarios_Christian_College_${currentSchoolYear}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`💾 Respaldo (${currentSchoolYear}) descargado.`, 'success');
}

function importFromJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.teachers) || !Array.isArray(parsed.courses)) {
        showToast('El archivo de respaldo no tiene un formato válido.', 'error');
        return;
      }
      pushUndoSnapshot();
      state = {
        teachers: parsed.teachers || [],
        courses: parsed.courses || [],
        periods: parsed.periods || [],
        requirements: parsed.requirements || [],
        assignments: parsed.assignments || {},
        teacherUnavailable: parsed.teacherUnavailable || {}
      };
      saveState();
      renderAll();
      showToast('📂 Respaldo cargado correctamente.', 'success');
    } catch (err) {
      showToast('Error al leer el archivo de respaldo.', 'error');
    }
  };
  reader.readAsText(file);
}

