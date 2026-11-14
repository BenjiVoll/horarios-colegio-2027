function initEventListeners() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      renderAll();
    });
  });

  // Botón Deshacer
  document.getElementById('btnUndo').addEventListener('click', performUndo);

  // Inspector rápido al hacer clic en el indicador global de Topones
  const conflictBadge = document.getElementById('globalConflictBadge');
  if (conflictBadge) {
    conflictBadge.style.cursor = 'pointer';
    conflictBadge.addEventListener('click', () => {
      const conflicts = scanAllConflicts();
      if (conflicts.length === 0) {
        showToast('✅ Validado: No existe ningún topón de profesores en todo el colegio.', 'success');
        return;
      }
      const first = conflicts[0];
      const t = state.teachers.find((x) => x.id === first.first.teacherId);
      const c1 = state.courses.find((x) => x.id === first.first.courseId);
      const c2 = state.courses.find((x) => x.id === first.second.courseId);
      const p = state.periods.find((x) => x.id === first.first.periodId);
      const d = DAYS[first.first.dayIndex];
      ui.panoramaActiveDay = String(first.first.dayIndex);
      switchTab('tab-resumen');
      renderAll();
      showToast(
        `⚠️ Topón detectado: ${t ? t.name : ''} el ${d ? d.name : ''} (${p ? p.label : ''}) entre ${
          c1 ? c1.name : ''
        } y ${c2 ? c2.name : ''}.`,
        'error'
      );
    });
  }

  // Selector de Año Escolar (2026 / 2027) con protección de cambios sin guardar
  document.getElementById('selectSchoolYear').addEventListener('change', (e) => {
    const selectedYear = e.target.value;
    if (hasUnsavedChanges) {
      const proceed = confirm(
        `Tienes cambios sin guardar en el año ${currentSchoolYear}. ¿Deseas cambiar al año ${selectedYear} sin guardar?`
      );
      if (!proceed) {
        e.target.value = currentSchoolYear;
        return;
      }
    }
    ui.selectedPaletteReqId = null;
    ui.selectedTeacherViewReqId = null;
    loadState(selectedYear);
    renderAll();
    showToast(`📅 Cambiado al Año Escolar ${selectedYear}.`, 'info');
  });

  document.getElementById('selectActiveCourse').addEventListener('change', (e) => {
    ui.activeCourseId = e.target.value;
    ui.selectedPaletteReqId = null;
    renderSchedulerTab();
  });

  document.getElementById('btnGoToCoursePlan').addEventListener('click', () => {
    ui.selectedPlanCourseId = ui.activeCourseId;
    switchTab('tab-cursos');
    renderAll();
  });

  document.getElementById('btnSelectEraser').addEventListener('click', () => {
    ui.selectedPaletteReqId = ui.selectedPaletteReqId === 'ERASER' ? null : 'ERASER';
    renderSchedulerTab();
  });

  document.getElementById('btnAutoFillCourse').addEventListener('click', () => {
    if (!ui.activeCourseId) return;
    autoScheduleForCourse(ui.activeCourseId, true);
  });

  document.getElementById('btnAutoFillAll').addEventListener('click', () => {
    autoScheduleAllCourses();
  });

  document.getElementById('btnClearCourseSchedule').addEventListener('click', () => {
    if (!ui.activeCourseId) return;
    const course = state.courses.find((c) => c.id === ui.activeCourseId);
    if (!confirm(`¿Vaciar todos los bloques de ${course ? course.name : 'este curso'}?`)) return;
    pushUndoSnapshot();
    for (const k in state.assignments) {
      if (state.assignments[k].courseId === ui.activeCourseId) {
        delete state.assignments[k];
      }
    }
    saveState();
    renderAll();
    showToast('Horario del curso vaciado.', 'info');
  });

  document.getElementById('btnClearAllSchedules').addEventListener('click', () => {
    if (!confirm(`¿Vaciar los horarios de TODOS los cursos (1º a 8º) del año ${currentSchoolYear} para armarlos desde cero? (Se mantendrán los profesores y planes de estudio).`)) return;
    pushUndoSnapshot();
    state.assignments = {};
    saveState();
    renderAll();
    showToast(`Horarios ${currentSchoolYear} vaciados. Puedes asignar manual o automáticamente.`, 'info');
  });

  // Controles del Panorama General
  document.querySelectorAll('#panoramaDayButtons .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.panoramaActiveDay = btn.dataset.day;
      renderPanoramaGeneralTab();
    });
  });

  document.getElementById('selectHighlightTeacher').addEventListener('change', (e) => {
    ui.panoramaHighlightTeacherId = e.target.value;
    renderPanoramaGeneralTab();
  });

  document.getElementById('selectViewTeacher').addEventListener('change', (e) => {
    ui.activeViewTeacherId = e.target.value;
    ui.selectedTeacherViewReqId = null;
    renderTeacherViewTab();
  });

  const btnFichaFromView = document.getElementById('btnOpenTeacherFichaFromView');
  if (btnFichaFromView) {
    btnFichaFromView.addEventListener('click', () => {
      if (ui.activeViewTeacherId) {
        openTeacherDetailModal(ui.activeViewTeacherId);
      }
    });
  }

  document.getElementById('btnToggleAvailabilityMode').addEventListener('click', () => {
    ui.availabilityEditMode = !ui.availabilityEditMode;
    if (ui.availabilityEditMode) ui.selectedTeacherViewReqId = null;
    renderTeacherViewTab();
  });

  document.getElementById('btnExitAvailabilityMode').addEventListener('click', () => {
    ui.availabilityEditMode = false;
    renderTeacherViewTab();
  });

  document.getElementById('teacherForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('teacherIdInput').value;
    const initials = document.getElementById('teacherInitialsInput').value.trim().toUpperCase();
    const name = document.getElementById('teacherNameInput').value.trim();
    const specialty = document.getElementById('teacherSpecialtyInput').value.trim();
    const maxHours = Number(document.getElementById('teacherMaxHoursInput').value) || 30;
    const otherLectivasEl = document.getElementById('teacherOtherLectivasInput');
    const otherLectivasHours = otherLectivasEl ? Number(otherLectivasEl.value) || 0 : 0;
    const sepHours = Number(document.getElementById('teacherSepHoursInput').value) || 0;
    const contractChrono = Number(document.getElementById('teacherContractChronoInput').value) || 38;
    const pieInfo = document.getElementById('teacherPieHoursInput').value.trim();
    const sepDetail = document.getElementById('teacherSepDetailInput').value.trim();
    const nonTeachingEl = document.getElementById('teacherNonTeachingInput');
    const nonTeachingDetail = nonTeachingEl ? nonTeachingEl.value.trim() : '';
    const color = document.getElementById('teacherColorInput').value || '#2563eb';

    if (!name || !initials) return;

    pushUndoSnapshot();

    if (id) {
      const idx = state.teachers.findIndex((t) => t.id === id);
      if (idx !== -1) {
        state.teachers[idx] = {
          ...state.teachers[idx],
          initials,
          name,
          specialty,
          maxHours,
          otherLectivasHours,
          sepHours,
          contractChrono,
          pieInfo,
          sepDetail,
          nonTeachingDetail: nonTeachingDetail || state.teachers[idx].nonTeachingDetail || '',
          color
        };
        showToast('Profesor(a) actualizado(a).', 'success');
      }
    } else {
      state.teachers.push({
        id: uid('t'),
        initials,
        name,
        specialty,
        maxHours,
        otherLectivasHours,
        sepHours,
        contractChrono,
        pieInfo,
        sepDetail,
        nonTeachingDetail:
          nonTeachingDetail ||
          'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
        color
      });
      showToast('Profesor(a) agregado(a).', 'success');
    }

    resetTeacherForm();
    saveState();
    renderAll();
  });

  document.getElementById('btnCancelTeacherEdit').addEventListener('click', resetTeacherForm);
  document.getElementById('searchTeacherInput').addEventListener('input', renderTeachersManagementTab);

  document.getElementById('courseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('courseNameInput');
    const name = nameInput.value.trim();
    if (!name) return;
    pushUndoSnapshot();
    const newCourse = { id: uid('c'), short: name.slice(0, 3), name };
    state.courses.push(newCourse);
    ui.selectedPlanCourseId = newCourse.id;
    ui.activeCourseId = newCourse.id;
    nameInput.value = '';
    saveState();
    renderAll();
    showToast(`Curso "${name}" creado.`, 'success');
  });

  document.getElementById('requirementForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!ui.selectedPlanCourseId) return;
    const reqId = document.getElementById('reqIdInput').value;
    const subject = document.getElementById('reqSubjectInput').value.trim();
    const shortCode = document.getElementById('reqShortCodeInput').value.trim().toUpperCase();
    const teacherId = document.getElementById('reqTeacherSelect').value;
    const hoursPerWeek = Number(document.getElementById('reqHoursInput').value) || 2;

    if (!subject || !teacherId) return;

    pushUndoSnapshot();

    if (reqId) {
      const idx = state.requirements.findIndex((r) => r.id === reqId);
      if (idx !== -1) {
        state.requirements[idx] = {
          ...state.requirements[idx],
          subject,
          shortCode,
          teacherId,
          hoursPerWeek
        };
        for (const k in state.assignments) {
          if (state.assignments[k].reqId === reqId) {
            state.assignments[k].subject = subject;
            state.assignments[k].shortCode = shortCode;
            state.assignments[k].teacherId = teacherId;
          }
        }
        showToast('Asignatura del curso actualizada.', 'success');
      }
    } else {
      state.requirements.push({
        id: uid('req'),
        courseId: ui.selectedPlanCourseId,
        subject,
        shortCode,
        teacherId,
        hoursPerWeek
      });
      showToast('Asignatura agregada al plan del curso.', 'success');
    }

    resetRequirementForm();
    saveState();
    renderAll();
  });

  document.getElementById('btnCancelReqEdit').addEventListener('click', resetRequirementForm);

  document.getElementById('periodForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('periodLabelInput').value.trim();
    const start = document.getElementById('periodStartInput').value;
    const end = document.getElementById('periodEndInput').value;
    const type = document.getElementById('periodTypeSelect').value;
    if (!label || !start || !end) return;

    pushUndoSnapshot();
    state.periods.push({
      id: uid('p'),
      label,
      start,
      end,
      friStart: type === 'class_mon_thu' ? '—' : start,
      friEnd: type === 'class_mon_thu' ? '—' : end,
      type
    });
    document.getElementById('periodLabelInput').value = '';
    saveState();
    renderAll();
    showToast('Bloque horario agregado.', 'success');
  });

  document.getElementById('btnCloseModal').addEventListener('click', closeQuickAssignModal);
  document.getElementById('btnModalCancel').addEventListener('click', closeQuickAssignModal);
  document.getElementById('btnModalClearCell').addEventListener('click', () => {
    if (ui.modalTargetSlot) {
      removeSlotAssignment(
        ui.modalTargetSlot.courseId,
        ui.modalTargetSlot.dayIndex,
        ui.modalTargetSlot.periodId
      );
      closeQuickAssignModal();
      renderAll();
    }
  });

  document.getElementById('btnCloseTeacherDetail').addEventListener('click', () => {
    document.getElementById('teacherDetailModal').classList.add('hidden');
  });
  document.getElementById('btnCloseTeacherDetailFooter').addEventListener('click', () => {
    document.getElementById('teacherDetailModal').classList.add('hidden');
  });

  const btnLoadBase = document.getElementById('btnLoadBaseSchedule');
  if (btnLoadBase) {
    btnLoadBase.addEventListener('click', () => {
      const msg = `¿Cargar la propuesta de Horario Base Institucional completo (38/38 bloques sin topones) en el año ${currentSchoolYear}?`;
      if (!confirm(msg)) return;
      pushUndoSnapshot();
      state = getInstitutionalBaseData(true);
      saveState();
      renderAll();
      showToast(
        `📋 Horario Base completo (38/38 bloques) cargado en pantalla. Presiona "💾 Guardar Cambios" para publicarlo en la nube.`,
        'success'
      );
    });
  }

  document.getElementById('btnResetYearData').addEventListener('click', () => {
    const msg = `¿Reiniciar el tablero del año ${currentSchoolYear} en blanco (0/38 bloques) conservando los cursos (1º a 8º), asignaturas y profesores?`;
    if (!confirm(msg)) return;
    pushUndoSnapshot();
    state = getInstitutionalBaseData(false);
    saveState();
    renderAll();
    showToast(`🧹 Horario (${currentSchoolYear}) reiniciado en pantalla. Presiona "💾 Guardar Cambios" para confirmar en la Base de Datos.`, 'info');
  });

  const btnSaveChanges = document.getElementById('btnSaveChanges');
  if (btnSaveChanges) {
    btnSaveChanges.addEventListener('click', () => {
      commitSaveToDatabase();
    });
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      commitSaveToDatabase();
    }
  });

  // Eventos de Base de Datos en la Nube y Seguridad (Firebase Auth + Realtime Database)
  const cloudModal = document.getElementById('cloudConfigModal');
  const inputFirebaseUrl = document.getElementById('inputFirebaseDbUrl');
  const inputFirebaseApiKey = document.getElementById('inputFirebaseApiKey');

  const openCloudModal = () => {
    if (!cloudModal) return;
    if (inputFirebaseUrl) {
      inputFirebaseUrl.value = getActiveFirebaseUrl();
    }
    if (inputFirebaseApiKey) {
      inputFirebaseApiKey.value = getActiveFirebaseApiKey();
    }
    updateCloudStatusUI(getActiveFirebaseUrl() ? 'connected' : 'disconnected');
    cloudModal.classList.remove('hidden');
  };

  const closeCloudModal = () => {
    if (cloudModal) cloudModal.classList.add('hidden');
  };

  const btnOpenCloud = document.getElementById('btnOpenCloudModal');
  if (btnOpenCloud) btnOpenCloud.addEventListener('click', openCloudModal);

  const btnCloseCloud = document.getElementById('btnCloseCloudModal');
  if (btnCloseCloud) btnCloseCloud.addEventListener('click', closeCloudModal);

  const btnCancelCloud = document.getElementById('btnCancelCloudModal');
  if (btnCancelCloud) btnCancelCloud.addEventListener('click', closeCloudModal);

  const btnCopyRules = document.getElementById('btnCopySecurityRules');
  if (btnCopyRules) {
    btnCopyRules.addEventListener('click', async () => {
      const codeEl = document.getElementById('firebaseSecureRulesCode');
      if (!codeEl) return;
      try {
        await navigator.clipboard.writeText(codeEl.textContent);
        showToast('📋 Reglas seguras copiadas al portapapeles. Pégalas en Firebase Console ➔ Reglas.', 'success');
      } catch (err) {
        showToast('Selecciona el texto del recuadro negro y cópialo con Ctrl+C.', 'info');
      }
    });
  }

  const btnSaveCloud = document.getElementById('btnSaveCloudUrl');
  if (btnSaveCloud) {
    btnSaveCloud.addEventListener('click', async () => {
      const rawUrl = (inputFirebaseUrl ? inputFirebaseUrl.value : '').trim();
      const rawApiKey = (inputFirebaseApiKey ? inputFirebaseApiKey.value : '').trim();
      if (!rawUrl) {
        showToast('Ingresa la URL de tu Firebase Realtime Database.', 'warn');
        return;
      }
      const cleaned = rawUrl.replace(/\/+$/, '').replace(/\.json$/i, '');
      localStorage.setItem(FIREBASE_URL_STORAGE_KEY, cleaned);
      if (rawApiKey) {
        localStorage.setItem(FIREBASE_API_KEY_STORAGE_KEY, rawApiKey);
        const loginApiKeyInput = document.getElementById('authLoginApiKeyInput');
        if (loginApiKeyInput) loginApiKeyInput.value = rawApiKey;
      }
      const ok = await pullStateFromCloud(currentSchoolYear, { force: true, silent: false });
      if (ok) {
        showToast('🔒 Base de datos en la nube conectada y sincronizada de forma segura.', 'success');
        closeCloudModal();
      } else {
        showToast('⚠️ No se pudo sincronizar. Verifica tu sesión y las Reglas de Seguridad.', 'error');
      }
    });
  }

  const btnForcePull = document.getElementById('btnForcePullCloud');
  if (btnForcePull) {
    btnForcePull.addEventListener('click', async () => {
      if (!getActiveFirebaseUrl()) {
        showToast('Primero ingresa y guarda la URL de la base de datos.', 'warn');
        return;
      }
      await pullStateFromCloud(currentSchoolYear, { force: true, silent: false });
    });
  }

  const btnDisconnectCloud = document.getElementById('btnDisconnectCloud');
  if (btnDisconnectCloud) {
    btnDisconnectCloud.addEventListener('click', () => {
      localStorage.removeItem(FIREBASE_URL_STORAGE_KEY);
      if (inputFirebaseUrl) inputFirebaseUrl.value = getActiveFirebaseUrl();
      showToast('URL restablecida al valor institucional por defecto.', 'info');
    });
  }

  // ==================== EVENTOS DE LOGIN, SESIÓN Y PROTECCIÓN ====================
  const authForm = document.getElementById('authLoginForm');
  const emailInput = document.getElementById('authEmailInput');
  const pwdInput = document.getElementById('authPasswordInput');
  const rememberCheck = document.getElementById('authRememberSession');
  const btnSubmitLogin = document.getElementById('btnSubmitLogin');
  const btnTogglePwd = document.getElementById('btnTogglePasswordView');
  const btnForgotPwd = document.getElementById('btnForgotPassword');
  const btnSaveLoginApiKey = document.getElementById('btnSaveLoginApiKey');
  const authLoginApiKeyInput = document.getElementById('authLoginApiKeyInput');
  const btnLogout = document.getElementById('btnLogout');

  if (authLoginApiKeyInput) {
    authLoginApiKeyInput.value = getActiveFirebaseApiKey();
  }

  if (btnSaveLoginApiKey) {
    btnSaveLoginApiKey.addEventListener('click', () => {
      const val = (authLoginApiKeyInput ? authLoginApiKeyInput.value : '').trim();
      if (!val) {
        showAuthAlert('Ingresa una Web API Key válida (comienza con AIzaSy...).', 'error');
        return;
      }
      localStorage.setItem(FIREBASE_API_KEY_STORAGE_KEY, val);
      showAuthAlert('✅ Firebase Web API Key guardada en este navegador. Ahora puedes iniciar sesión.', 'info');
      const details = document.getElementById('authApiConfigDetails');
      if (details) details.open = false;
    });
  }

  if (btnTogglePwd && pwdInput) {
    btnTogglePwd.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      btnTogglePwd.textContent = isPwd ? '🙈 Ocultar' : '👁️ Mostrar';
    });
  }

  if (btnForgotPwd) {
    btnForgotPwd.addEventListener('click', async () => {
      const email = (emailInput ? emailInput.value : '').trim();
      if (!email) {
        showAuthAlert('Escribe primero tu correo institucional arriba para enviarte el enlace de recuperación.', 'error');
        if (emailInput) emailInput.focus();
        return;
      }
      try {
        showAuthAlert('Enviando correo de recuperación...', 'info');
        await sendPasswordResetEmail(email);
        showAuthAlert(`📧 Se envió un enlace de restablecimiento de contraseña a ${email}. Revisa tu bandeja de entrada.`, 'info');
      } catch (err) {
        showAuthAlert(err.message || 'No se pudo enviar el correo de recuperación.', 'error');
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAuthAlert('');

      // Si el usuario escribió la API Key en el campo desplegable sin presionar "Guardar API Key", la guardamos automáticamente
      if (authLoginApiKeyInput && authLoginApiKeyInput.value.trim()) {
        localStorage.setItem(FIREBASE_API_KEY_STORAGE_KEY, authLoginApiKeyInput.value.trim());
      }

      const email = (emailInput ? emailInput.value : '').trim();
      const password = pwdInput ? pwdInput.value : '';
      const remember = rememberCheck ? rememberCheck.checked : true;

      if (!email || !password) {
        showAuthAlert('Completa tu correo institucional y contraseña.', 'error');
        return;
      }

      try {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = true;
          btnSubmitLogin.textContent = '⏳ Verificando credenciales...';
        }
        await signInWithEmailPassword(email, password, remember);
        unlockApplicationUI();
        showToast(`🔓 Bienvenido(a), ${email}`, 'success');
      } catch (err) {
        showAuthAlert(err.message || 'Error al iniciar sesión.', 'error');
      } finally {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = '🔐 Iniciar Sesión Segura';
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (hasUnsavedChanges) {
        const confirmExit = confirm('Tienes cambios sin guardar en la Base de Datos. ¿Deseas cerrar sesión de todas formas?');
        if (!confirmExit) return;
      }
      lockApplicationUI('Has cerrado tu sesión de forma segura.');
    });
  }

  // Monitoreo de actividad para cierre automático de sesión por inactividad (60 min) y sincronización al volver a la pestaña
  ['mousemove', 'keydown', 'click', 'touchstart'].forEach((evtName) => {
    window.addEventListener(evtName, () => {
      if (isAuthenticated()) {
        resetInactivityWatchdog();
      }
    }, { passive: true });
  });

  window.addEventListener('focus', () => {
    if (isAuthenticated() && getActiveFirebaseUrl() && !isPushingToCloud && !hasUnsavedChanges) {
      pullStateFromCloud(currentSchoolYear, { force: false, silent: true });
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);
  document.getElementById('btnExportJSON').addEventListener('click', exportToJSON);
  document.getElementById('inputImportJSON').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importFromJSON(e.target.files[0]);
      e.target.value = '';
    }
  });

  // ==================== EVENTOS DEL CENTRO DE EXPORTACIÓN PDF OFICIAL ====================
  const btnPrint = document.getElementById('btnPrint');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => openPdfExportModal());
  }

  const pdfModal = document.getElementById('pdfExportModal');
  const btnClosePdfModal = document.getElementById('btnClosePdfModal');
  const btnCancelPdfModal = document.getElementById('btnCancelPdfModal');
  const pdfDocTypeSelect = document.getElementById('pdfDocTypeSelect');
  const btnExecutePdfDownload = document.getElementById('btnExecutePdfDownload');
  const btnPreviewPdf = document.getElementById('btnPreviewPdf');

  if (btnClosePdfModal) btnClosePdfModal.addEventListener('click', closePdfExportModal);
  if (btnCancelPdfModal) btnCancelPdfModal.addEventListener('click', closePdfExportModal);
  if (pdfModal) {
    pdfModal.addEventListener('click', (e) => {
      if (e.target === pdfModal) closePdfExportModal();
    });
  }
  if (pdfDocTypeSelect) {
    pdfDocTypeSelect.addEventListener('change', updatePdfModalSubOptions);
  }
  if (btnExecutePdfDownload) {
    btnExecutePdfDownload.addEventListener('click', () => generateInstitutionalPdf('download'));
  }
  if (btnPreviewPdf) {
    btnPreviewPdf.addEventListener('click', () => generateInstitutionalPdf('preview'));
  }
}

async function bootstrapAuthAndApp() {
  initEventListeners();

  const stored = loadStoredAuthSession();
  if (stored && stored.idToken && stored.refreshToken) {
    authSession = stored;
    // Desbloquear de inmediato la interfaz para evitar cualquier parpadeo de la pantalla de login
    unlockApplicationUI();

    // Validar o renovar el token en segundo plano sin interrumpir la experiencia de usuario
    ensureValidIdToken().catch((err) => {
      console.warn('La sesión guardada expiró o fue revocada:', err);
      const isNetworkError = err && (err.name === 'TypeError' || String(err.message).toLowerCase().includes('fetch'));
      if (!isNetworkError) {
        lockApplicationUI('🔒 Tu sesión ha expirado o fue revocada. Por favor, ingresa tus credenciales nuevamente.');
      }
    });
    return;
  }

  lockApplicationUI();
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrapAuthAndApp();
});

