function renderAll() {
  ensureValidSelections();
  updateGlobalCounters();
  renderSchedulerTab();
  renderPanoramaGeneralTab();
  renderTeacherViewTab();
  renderTeachersManagementTab();
  renderCoursesManagementTab();
  renderPeriodsTab();
}

function ensureValidSelections() {
  if (!ui.activeCourseId || !state.courses.some((c) => c.id === ui.activeCourseId)) {
    ui.activeCourseId = state.courses[0]?.id || null;
  }
  if (!ui.selectedPlanCourseId || !state.courses.some((c) => c.id === ui.selectedPlanCourseId)) {
    ui.selectedPlanCourseId = state.courses[0]?.id || null;
  }
  if (!ui.activeViewTeacherId || !state.teachers.some((t) => t.id === ui.activeViewTeacherId)) {
    ui.activeViewTeacherId = state.teachers[0]?.id || null;
  }
  if (
    ui.selectedPaletteReqId &&
    ui.selectedPaletteReqId !== 'ERASER' &&
    ui.selectedPaletteReqId !== 'SWAP' &&
    !state.requirements.some((r) => r.id === ui.selectedPaletteReqId && r.courseId === ui.activeCourseId)
  ) {
    ui.selectedPaletteReqId = null;
  }
  if (ui.swapSourceSlot && ui.swapSourceSlot.courseId !== ui.activeCourseId) {
    ui.swapSourceSlot = null;
  }
}

/* --------------------------------------------------------------------------
   TAB 1: HORARIO POR CURSO (1º a 8º)
   -------------------------------------------------------------------------- */
function renderSchedulerTab() {
  const selectCourse = document.getElementById('selectActiveCourse');
  const quickPills = document.getElementById('courseQuickPills');
  selectCourse.innerHTML = '';
  quickPills.innerHTML = '';

  if (state.courses.length === 0) {
    selectCourse.innerHTML = '<option value="">Sin cursos creados</option>';
    document.getElementById('courseSubjectsPalette').innerHTML = '';
    document.getElementById('courseScheduleBody').innerHTML = '';
    return;
  }

  state.courses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === ui.activeCourseId) opt.selected = true;
    selectCourse.appendChild(opt);

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `course-pill-btn ${c.id === ui.activeCourseId ? 'active' : ''}`;
    pill.textContent = c.short || c.name.slice(0, 4);
    pill.addEventListener('click', () => {
      ui.activeCourseId = c.id;
      ui.selectedPaletteReqId = null;
      ui.swapSourceSlot = null;
      renderSchedulerTab();
    });
    quickPills.appendChild(pill);
  });

  const activeCourse = state.courses.find((c) => c.id === ui.activeCourseId);
  document.getElementById('calendarCourseTitle').textContent = activeCourse
    ? `Horario Semanal ${currentSchoolYear} — ${activeCourse.name}`
    : `Horario del Curso (${currentSchoolYear})`;

  const courseReqs = state.requirements.filter((r) => r.courseId === ui.activeCourseId);
  const totalReqHours = courseReqs.reduce((acc, r) => acc + Number(r.hoursPerWeek), 0);
  const totalAssignedHours = courseReqs.reduce((acc, r) => acc + getAssignedHoursForRequirement(r.id), 0);
  const pct = totalReqHours > 0 ? Math.min(100, Math.round((totalAssignedHours / totalReqHours) * 100)) : 0;

  document.getElementById('courseProgressSummary').innerHTML = `
    <div style="display:flex; justify-content:space-between; font-weight:700;">
      <span>Horas del Curso (${currentSchoolYear}):</span>
      <span>${totalAssignedHours} / ${totalReqHours} hrs (${pct}%)</span>
    </div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill ${pct === 100 && totalReqHours > 0 ? 'complete' : ''}" style="width:${pct}%"></div>
    </div>
  `;

  const paletteEl = document.getElementById('courseSubjectsPalette');
  paletteEl.innerHTML = '';

  courseReqs.forEach((req) => {
    const teacher = state.teachers.find((t) => t.id === req.teacherId);
    const assigned = getAssignedHoursForRequirement(req.id);
    const isDone = assigned >= req.hoursPerWeek;
    const isSelected = ui.selectedPaletteReqId === req.id;
    const color = teacher ? teacher.color : '#64748b';
    const initials = teacher ? teacher.initials : '—';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `palette-item ${isSelected ? 'selected' : ''} ${isDone ? 'completed' : ''}`;
    btn.draggable = true;
    btn.innerHTML = `
      <div class="palette-item-left">
        <span class="color-swatch" style="background:${color}">${escapeHtml(req.shortCode || initials)}</span>
        <div class="palette-info">
          <div class="palette-subject">${escapeHtml(req.subject)}</div>
          <div class="palette-teacher">👨‍🏫 ${teacher ? `${escapeHtml(teacher.name)} (${escapeHtml(initials)})` : 'Sin prof.'}</div>
        </div>
      </div>
      <span class="palette-hours ${isDone ? 'done' : ''}">
        ${assigned} / ${req.hoursPerWeek}h
      </span>
    `;

    btn.addEventListener('click', () => {
      ui.selectedPaletteReqId = ui.selectedPaletteReqId === req.id ? null : req.id;
      ui.swapSourceSlot = null;
      renderSchedulerTab();
    });

    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'PALETTE_REQ', reqId: req.id }));
      ui.selectedPaletteReqId = req.id;
      setTimeout(() => renderCourseCalendarGrid(), 10);
    });

    paletteEl.appendChild(btn);
  });

  document.getElementById('btnSelectEraser').classList.toggle('selected', ui.selectedPaletteReqId === 'ERASER');
  const btnSwapMode = document.getElementById('btnSelectSwapMode');
  if (btnSwapMode) {
    btnSwapMode.classList.toggle('selected', ui.selectedPaletteReqId === 'SWAP');
  }

  const hintEl = document.getElementById('calendarActiveSelectionHint');
  const mobileBar = document.getElementById('mobileActiveSelectionBar');
  const mobileBarText = document.getElementById('mobileActiveSelectionText');

  if (ui.selectedPaletteReqId === 'ERASER') {
    hintEl.textContent = '🧹 Modo Borrador activo: haz clic sobre cualquier bloque asignado para vaciarlo.';
    if (mobileBar && mobileBarText) {
      mobileBarText.textContent = '🧹 Modo Borrador activo — toca un bloque para vaciarlo';
      mobileBar.classList.remove('hidden');
    }
  } else if (ui.selectedPaletteReqId === 'SWAP') {
    if (ui.swapSourceSlot) {
      const srcAssign = state.assignments[slotKey(ui.swapSourceSlot.courseId, ui.swapSourceSlot.dayIndex, ui.swapSourceSlot.periodId)];
      const srcDayName = DAYS[ui.swapSourceSlot.dayIndex]?.name || '';
      const srcLabel = srcAssign ? `${srcAssign.shortCode || srcAssign.subject} (${srcDayName})` : 'Bloque seleccionado';
      hintEl.textContent = `🔄 Moviendo ${srcLabel}: ahora toca el bloque de destino (libre para mover, u ocupado para intercambiar).`;
      if (mobileBar && mobileBarText) {
        mobileBarText.textContent = `🔄 Moviendo ${srcLabel} → toca destino`;
        mobileBar.classList.remove('hidden');
      }
    } else {
      hintEl.textContent = '🔄 Modo Mover / Intercambiar activo: toca primero el bloque asignado que deseas mover o cambiar de hora.';
      if (mobileBar && mobileBarText) {
        mobileBarText.textContent = '🔄 Modo Mover: toca el 1º bloque a mover';
        mobileBar.classList.remove('hidden');
      }
    }
  } else if (ui.selectedPaletteReqId) {
    const selReq = state.requirements.find((r) => r.id === ui.selectedPaletteReqId);
    const selTeacher = selReq ? state.teachers.find((t) => t.id === selReq.teacherId) : null;
    hintEl.textContent = selReq
      ? `📌 Asignando: ${selReq.subject} — ${selTeacher ? `${selTeacher.name} (${selTeacher.initials})` : ''} (Los bloques donde ya hace clases en otro curso aparecen bloqueados en rojo).`
      : '';
    if (mobileBar && mobileBarText && selReq) {
      mobileBarText.textContent = `📌 Asignando: ${selReq.shortCode || selReq.subject} (${selTeacher ? selTeacher.initials : ''})`;
      mobileBar.classList.remove('hidden');
    }
  } else {
    hintEl.textContent = '💡 Haz clic en una asignatura a la izquierda, haz clic en una celda o usa 🔄 Mover / Intercambiar para hacer enroques.';
    if (mobileBar) mobileBar.classList.add('hidden');
  }

  // Alertas pedagógicas no bloqueantes (3+ bloques consecutivos de la misma asignatura)
  const pedAlertEl = document.getElementById('coursePedagogicalAlert');
  if (pedAlertEl && ui.activeCourseId) {
    const warnings = findCourseConsecutiveWarnings(ui.activeCourseId);
    if (warnings.length > 0) {
      const summary = warnings
        .slice(0, 3)
        .map((w) => `<strong>${escapeHtml(w.subject)}</strong> (${w.count} seguidos el ${escapeHtml(w.dayName)})`)
        .join(' · ');
      const extra = warnings.length > 3 ? ` (+${warnings.length - 3} más)` : '';
      pedAlertEl.innerHTML = `⚠️ <span><strong>Aviso pedagógico:</strong> ${summary}${extra}.</span>`;
      pedAlertEl.classList.remove('hidden');
    } else {
      pedAlertEl.classList.add('hidden');
    }
  }

  // Sincronizar selector de día móvil del horario de curso
  const courseTableEl = document.getElementById('courseScheduleTable');
  if (courseTableEl) {
    courseTableEl.dataset.mobileDay = String(ui.courseMobileDay || '0');
  }
  document.querySelectorAll('#courseMobileDayBar .mobile-day-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.day === String(ui.courseMobileDay || '0'));
  });

  renderCourseCalendarGrid();
}

function renderCourseCalendarGrid() {
  const headerRow = document.getElementById('courseScheduleHeader');
  const tbody = document.getElementById('courseScheduleBody');

  headerRow.innerHTML =
    `<th class="time-col">Hora (Lun-Jue / Vie)</th>` +
    DAYS.map((d) => `<th data-day-col="${d.index}">${d.name}</th>`).join('');

  tbody.innerHTML = '';

  const selectedReq =
    ui.selectedPaletteReqId && ui.selectedPaletteReqId !== 'ERASER' && ui.selectedPaletteReqId !== 'SWAP'
      ? state.requirements.find((r) => r.id === ui.selectedPaletteReqId)
      : null;

  state.periods.forEach((period) => {
    const tr = document.createElement('tr');

    if (period.type === 'break') {
      tr.className = 'break-row';
      const friInfo = period.friStart && period.friStart !== period.start ? ` | Vie: ${period.friStart} - ${period.friEnd}` : '';
      tr.innerHTML = `
        <td>${escapeHtml(period.start)} - ${escapeHtml(period.end)}</td>
        <td colspan="${DAYS.length}">☕ ${escapeHtml(period.label)}${escapeHtml(friInfo)}</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    const diffFri =
      period.friStart && period.friStart !== '—' && period.friStart !== period.start
        ? `<div class="period-fri-note">Vie: ${escapeHtml(period.friStart)} - ${escapeHtml(period.friEnd)}</div>`
        : '';
    timeTd.innerHTML = `
      <div class="period-name">${escapeHtml(period.label)}</div>
      <div class="period-hours">${escapeHtml(period.start)} - ${escapeHtml(period.end)}</div>
      ${diffFri}
    `;
    tr.appendChild(timeTd);

    DAYS.forEach((day) => {
      const td = document.createElement('td');
      td.className = 'slot-cell';
      td.dataset.dayCol = String(day.index);

      if (isPeriodDisabledOnDay(period, day.index)) {
        td.classList.add('slot-disabled-friday');
        td.innerHTML = `<div class="unavailable-warning-chip">Salida Viernes 14:00 hrs</div>`;
        tr.appendChild(td);
        return;
      }

      const key = slotKey(ui.activeCourseId, day.index, period.id);
      const currentAssignment = state.assignments[key];

      if (
        ui.selectedPaletteReqId === 'SWAP' &&
        ui.swapSourceSlot &&
        ui.swapSourceSlot.courseId === ui.activeCourseId &&
        Number(ui.swapSourceSlot.dayIndex) === Number(day.index) &&
        ui.swapSourceSlot.periodId === period.id
      ) {
        td.classList.add('slot-swap-source');
      }

      let conflictOtherCourse = null;
      let teacherUnavailableHere = false;

      if (selectedReq) {
        conflictOtherCourse = findTeacherConflict(
          selectedReq.teacherId,
          day.index,
          period.id,
          ui.activeCourseId
        );
        teacherUnavailableHere = isTeacherUnavailable(selectedReq.teacherId, day.index, period.id);
      }

      if (currentAssignment) {
        const assignedTeacher = state.teachers.find((t) => t.id === currentAssignment.teacherId);
        const color = assignedTeacher ? assignedTeacher.color : '#2563eb';
        const initials = assignedTeacher ? assignedTeacher.initials : '';
        const bg = hexToRgba(color, 0.15);

        const conflictHint =
          conflictOtherCourse && selectedReq && selectedReq.id !== currentAssignment.reqId
            ? `<div style="font-size:0.65rem; color:#dc2626; font-weight:700;">⛔ ${escapeHtml(
                state.teachers.find((t) => t.id === selectedReq.teacherId)?.initials || ''
              )} ocupado en ${escapeHtml(
                state.courses.find((c) => c.id === conflictOtherCourse.courseId)?.short || ''
              )}</div>`
            : '';

        td.innerHTML = `
          <div class="assigned-block" draggable="true" title="Arrastra hacia otro bloque para mover o intercambiar" style="border-left-color:${color}; background:${bg}">
            <button type="button" class="block-remove-btn no-print" title="Quitar bloque">✕</button>
            <div class="block-subject">${escapeHtml(currentAssignment.subject)}</div>
            <div class="block-teacher">👨‍🏫 ${assignedTeacher ? `${escapeHtml(assignedTeacher.name)} (${escapeHtml(initials)})` : ''}</div>
            ${conflictHint}
          </div>
        `;

        const blockEl = td.querySelector('.assigned-block');
        blockEl.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              type: 'SWAP_SLOT',
              courseId: ui.activeCourseId,
              fromDay: day.index,
              fromPeriodId: period.id
            })
          );
        });

        td.querySelector('.block-remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          removeSlotAssignment(ui.activeCourseId, day.index, period.id);
          renderAll();
        });
      } else if (conflictOtherCourse) {
        td.classList.add('slot-conflict-preview');
        const otherCourse = state.courses.find((c) => c.id === conflictOtherCourse.courseId);
        const selTeacher = state.teachers.find((t) => t.id === selectedReq.teacherId);
        td.innerHTML = `
          <div class="conflict-warning-chip">
            <strong>⛔ Topón (${selTeacher ? escapeHtml(selTeacher.initials) : ''})</strong>
            <span>En ${otherCourse ? escapeHtml(otherCourse.name) : 'otro curso'}: ${escapeHtml(conflictOtherCourse.shortCode || conflictOtherCourse.subject)}</span>
          </div>
        `;
      } else if (teacherUnavailableHere) {
        td.classList.add('slot-unavailable-preview');
        td.innerHTML = `
          <div class="unavailable-warning-chip">
            🔒 Profesor No Disponible
          </div>
        `;
      } else {
        td.innerHTML = `<div class="empty-slot-placeholder">+ Asignar</div>`;
      }

      td.addEventListener('click', () => {
        handleCourseCellClick(ui.activeCourseId, day.index, period.id);
      });

      td.addEventListener('dragover', (e) => {
        e.preventDefault();
        td.classList.add('drag-over');
      });

      td.addEventListener('dragleave', () => {
        td.classList.remove('drag-over');
      });

      td.addEventListener('drop', (e) => {
        e.preventDefault();
        td.classList.remove('drag-over');
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;

        try {
          const payload = JSON.parse(rawData);
          if (payload.type === 'PALETTE_REQ' && payload.reqId) {
            assignRequirementToSlot(ui.activeCourseId, day.index, period.id, payload.reqId, false);
            renderAll();
          } else if (payload.type === 'SWAP_SLOT') {
            if (
              swapOrMoveSlotsInCourse(
                payload.courseId,
                payload.fromDay,
                payload.fromPeriodId,
                day.index,
                period.id
              )
            ) {
              renderAll();
            }
          }
        } catch {
          // Compatibilidad texto plano simple
          assignRequirementToSlot(ui.activeCourseId, day.index, period.id, rawData, false);
          renderAll();
        }
      });

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function handleCourseCellClick(courseId, dayIndex, periodId) {
  if (ui.selectedPaletteReqId === 'ERASER') {
    if (removeSlotAssignment(courseId, dayIndex, periodId)) {
      renderAll();
    }
    return;
  }

  if (ui.selectedPaletteReqId === 'SWAP') {
    const period = state.periods.find((p) => p.id === periodId);
    if (isPeriodDisabledOnDay(period, dayIndex)) {
      showToast('Este bloque no está habilitado para clases.', 'warn');
      return;
    }

    if (!ui.swapSourceSlot) {
      const existing = state.assignments[slotKey(courseId, dayIndex, periodId)];
      if (!existing) {
        showToast('Toca primero un bloque que ya tenga una clase asignada para moverlo o intercambiarlo.', 'info');
        return;
      }
      ui.swapSourceSlot = { courseId, dayIndex, periodId };
      renderSchedulerTab();
      return;
    }

    // Si vuelve a tocar la misma celda, deselecciona el origen
    if (
      ui.swapSourceSlot.courseId === courseId &&
      Number(ui.swapSourceSlot.dayIndex) === Number(dayIndex) &&
      ui.swapSourceSlot.periodId === periodId
    ) {
      ui.swapSourceSlot = null;
      renderSchedulerTab();
      return;
    }

    const ok = swapOrMoveSlotsInCourse(
      ui.swapSourceSlot.courseId,
      ui.swapSourceSlot.dayIndex,
      ui.swapSourceSlot.periodId,
      dayIndex,
      periodId
    );
    if (ok) {
      ui.swapSourceSlot = null;
      renderAll();
    }
    return;
  }

  if (ui.selectedPaletteReqId) {
    const ok = assignRequirementToSlot(courseId, dayIndex, periodId, ui.selectedPaletteReqId, false);
    if (ok) renderAll();
    return;
  }

  openQuickAssignModal(courseId, dayIndex, periodId);
}

/* --------------------------------------------------------------------------
   MODAL DE ASIGNACIÓN RÁPIDA EN CELDA
   -------------------------------------------------------------------------- */
function openQuickAssignModal(courseId, dayIndex, periodId) {
  const period = state.periods.find((p) => p.id === periodId);
  if (isPeriodDisabledOnDay(period, dayIndex)) return;

  ui.modalTargetSlot = { courseId, dayIndex, periodId };
  const modal = document.getElementById('cellAssignModal');
  const course = state.courses.find((c) => c.id === courseId);
  const dayName = DAYS[dayIndex]?.name || '';

  document.getElementById('modalCellTitle').textContent = `${course ? course.name : ''} — ${dayName} (${period ? period.label : ''})`;
  document.getElementById('modalCellSubtitle').textContent =
    'Elige la asignatura para este bloque. Si el profesor ya está haciendo clases en otro curso a esta misma hora, aparece bloqueado por topón.';

  const listEl = document.getElementById('modalOptionsList');
  listEl.innerHTML = '';

  const courseReqs = state.requirements.filter((r) => r.courseId === courseId);
  const currentKey = slotKey(courseId, dayIndex, periodId);
  const currentAssignment = state.assignments[currentKey];

  document.getElementById('btnModalClearCell').classList.toggle('hidden', !currentAssignment);

  courseReqs.forEach((req) => {
    const teacher = state.teachers.find((t) => t.id === req.teacherId);
    const assignedHrs = getAssignedHoursForRequirement(req.id, currentKey);
    const conflict = teacher ? findTeacherConflict(teacher.id, dayIndex, periodId, courseId) : null;
    const unavailable = teacher ? isTeacherUnavailable(teacher.id, dayIndex, periodId) : false;
    const hoursComplete = assignedHrs >= req.hoursPerWeek;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-option-btn';

    let statusLabel = `${assignedHrs}/${req.hoursPerWeek} hrs`;
    let disabled = false;

    if (conflict) {
      const otherCourse = state.courses.find((c) => c.id === conflict.courseId);
      statusLabel = `⛔ Topón en ${otherCourse ? otherCourse.short || otherCourse.name : 'otro curso'}`;
      disabled = true;
    } else if (unavailable) {
      statusLabel = `🔒 Profesor No Disponible`;
      disabled = true;
    } else if (hoursComplete) {
      statusLabel = `✅ Plan completo (${assignedHrs}/${req.hoursPerWeek}h)`;
      disabled = true;
    }

    btn.disabled = disabled;
    btn.innerHTML = `
      <div>
        <div style="font-weight:700; font-size:0.88rem;">[${escapeHtml(req.shortCode || '')}] ${escapeHtml(req.subject)}</div>
        <div style="font-size:0.77rem; color:#64748b;">👨‍🏫 ${teacher ? `${escapeHtml(teacher.name)} (${escapeHtml(teacher.initials)})` : ''}</div>
      </div>
      <span class="badge-pill ${disabled ? 'badge-danger' : 'badge-ok'}">${escapeHtml(statusLabel)}</span>
    `;

    btn.addEventListener('click', () => {
      if (assignRequirementToSlot(courseId, dayIndex, periodId, req.id, false)) {
        closeQuickAssignModal();
        renderAll();
      }
    });

    listEl.appendChild(btn);
  });

  modal.classList.remove('hidden');
}

function closeQuickAssignModal() {
  document.getElementById('cellAssignModal').classList.add('hidden');
  ui.modalTargetSlot = null;
}

/* --------------------------------------------------------------------------
   TAB 2: PANORAMA GENERAL REDISEÑADO (LIMPIO, EJECUTIVO Y ORDENADO)
   -------------------------------------------------------------------------- */
function renderPanoramaGeneralTab() {
  const kpiContainer = document.getElementById('overviewCourseCards');
  const contentContainer = document.getElementById('panoramaContentContainer');
  const highlightSelect = document.getElementById('selectHighlightTeacher');

  // 1. Poblar tarjetas ejecutivas de avance por curso (1º a 8º)
  kpiContainer.innerHTML = '';
  state.courses.forEach((course) => {
    const reqs = state.requirements.filter((r) => r.courseId === course.id);
    const reqHours = reqs.reduce((acc, r) => acc + Number(r.hoursPerWeek), 0);
    const asgHours = reqs.reduce((acc, r) => acc + getAssignedHoursForRequirement(r.id), 0);
    const pct = reqHours > 0 ? Math.min(100, Math.round((asgHours / reqHours) * 100)) : 0;

    const card = document.createElement('div');
    card.className = 'kpi-course-card';
    card.title = `Ir al horario de ${course.name}`;
    card.innerHTML = `
      <div class="kpi-course-top">
        <span>🏫 ${escapeHtml(course.short || course.name)}</span>
        <span style="color:${pct === 100 ? '#16a34a' : '#2563eb'}">${pct}%</span>
      </div>
      <div class="kpi-course-sub">${asgHours} / ${reqHours} hrs asignadas</div>
      <div class="progress-bar-track" style="height:6px; margin-top:0.35rem;">
        <div class="progress-bar-fill ${pct === 100 ? 'complete' : ''}" style="width:${pct}%"></div>
      </div>
    `;
    card.addEventListener('click', () => {
      ui.activeCourseId = course.id;
      switchTab('tab-calendario');
      renderAll();
    });
    kpiContainer.appendChild(card);
  });

  // 2. Poblar selector de "Destacar Profesor"
  const prevHighlight = ui.panoramaHighlightTeacherId;
  highlightSelect.innerHTML = `<option value="">Mostrar todos por igual</option>`;
  state.teachers.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `[${t.initials}] ${t.name}`;
    if (t.id === prevHighlight) opt.selected = true;
    highlightSelect.appendChild(opt);
  });

  // 3. Actualizar estado visual de los botones de Día
  document.querySelectorAll('#panoramaDayButtons .seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.day === String(ui.panoramaActiveDay));
  });

  if (ui.panoramaActiveDay === 'WEEK') {
    renderUnifiedWeeklySabana(contentContainer);
  } else {
    renderSingleDayPanoramaTable(contentContainer, Number(ui.panoramaActiveDay));
  }
}

/**
 * Vista por Día (Lunes a Viernes): 8 cursos en paralelo, celdas grandes con Asignatura + Profesor y columna de Control de Topones
 */
function renderSingleDayPanoramaTable(container, dayIndex) {
  const dayObj = DAYS[dayIndex] || DAYS[0];
  document.getElementById('panoramaMainTitle').textContent = `Panorama del Día ${dayObj.name} — Todos los Cursos (${currentSchoolYear})`;

  const highlightTeacherId = ui.panoramaHighlightTeacherId;

  let html = `
    <table class="panorama-day-table">
      <thead>
        <tr>
          <th style="width:135px;">Bloque / Hora</th>
          ${state.courses.map((c) => `<th>🏫 ${escapeHtml(c.name)}</th>`).join('')}
          <th style="width:120px;">Control Topones</th>
        </tr>
      </thead>
      <tbody>
  `;

  state.periods.forEach((period) => {
    if (period.type === 'break') {
      html += `
        <tr class="break-row">
          <td>${escapeHtml(period.start)} - ${escapeHtml(period.end)}</td>
          <td colspan="${state.courses.length + 1}">☕ ${escapeHtml(period.label)}</td>
        </tr>
      `;
      return;
    }

    if (isPeriodDisabledOnDay(period, dayIndex)) {
      html += `
        <tr class="break-row">
          <td>${escapeHtml(period.start)} - ${escapeHtml(period.end)}</td>
          <td colspan="${state.courses.length + 1}">Salida Viernes 14:00 hrs</td>
        </tr>
      `;
      return;
    }

    // Contar profesores en esta fila (mismo día y bloque) para detectar si alguno se repite
    const teacherCountsInRow = {};
    state.courses.forEach((course) => {
      const a = state.assignments[slotKey(course.id, dayIndex, period.id)];
      if (!a) return;
      const t = state.teachers.find((x) => x.id === a.teacherId);
      if (t && t.isMultiCourseWorkshop) return;
      teacherCountsInRow[a.teacherId] = (teacherCountsInRow[a.teacherId] || 0) + 1;
    });

    const hasConflictInRow = Object.values(teacherCountsInRow).some((cnt) => cnt > 1);

    html += `
      <tr>
        <td class="time-cell">
          <div class="period-name">${escapeHtml(period.label)}</div>
          <div class="period-hours">${escapeHtml(period.start)} - ${escapeHtml(period.end)}</div>
        </td>
    `;

    state.courses.forEach((course) => {
      const a = state.assignments[slotKey(course.id, dayIndex, period.id)];
      if (a) {
        const teacher = state.teachers.find((t) => t.id === a.teacherId);
        const color = teacher ? teacher.color : '#2563eb';
        const bg = hexToRgba(color, 0.15);
        const isDuplicated = teacherCountsInRow[a.teacherId] > 1;

        let highlightClass = '';
        if (highlightTeacherId) {
          highlightClass = a.teacherId === highlightTeacherId ? 'highlighted-slot' : 'dimmed-slot';
        }

        html += `
          <td>
            <div class="panorama-cell-card ${highlightClass} ${isDuplicated ? 'sabana-cell-conflict' : ''}"
                 data-course="${course.id}" data-day="${dayIndex}" data-period="${period.id}"
                 style="border-left-color:${color}; background:${bg}"
                 title="Haz clic para cambiar esta asignatura en ${escapeHtml(course.name)}">
              <div class="panorama-cell-subj">${escapeHtml(a.subject)}</div>
              <div class="panorama-cell-teacher">
                <span class="teacher-initials-badge" style="background:${color}; min-width:24px; height:18px; font-size:0.66rem;">
                  ${teacher ? escapeHtml(teacher.initials) : ''}
                </span>
                <span>${teacher ? escapeHtml(teacher.name) : ''}</span>
              </div>
            </div>
          </td>
        `;
      } else {
        const dimEmpty = highlightTeacherId ? 'dimmed-slot' : '';
        html += `
          <td>
            <div class="empty-slot-placeholder ${dimEmpty}"
                 data-course="${course.id}" data-day="${dayIndex}" data-period="${period.id}"
                 style="height:54px; border:1px dashed #cbd5e1; border-radius:6px; cursor:pointer;"
                 title="Haz clic para asignar bloque en ${escapeHtml(course.name)}">
              + Asignar
            </div>
          </td>
        `;
      }
    });

    html += `
        <td style="text-align:center;">
          <span class="badge-pill ${hasConflictInRow ? 'badge-danger' : 'badge-ok'}">
            ${hasConflictInRow ? '⛔ Topón' : '✅ Sin topón'}
          </span>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Hacer cada celda interactiva al hacer clic
  container.querySelectorAll('[data-course][data-day][data-period]').forEach((el) => {
    el.addEventListener('click', () => {
      openQuickAssignModal(el.dataset.course, Number(el.dataset.day), el.dataset.period);
    });
  });
}

/**
 * Vista Semana Compacta Unificada: Una sola matriz limpia donde cada celda muestra Asignatura + Sigla Profesor juntos
 */
function renderUnifiedWeeklySabana(container) {
  document.getElementById('panoramaMainTitle').textContent = `Matriz Semanal Compacta (38 Bloques) — Todos los Cursos (${currentSchoolYear})`;

  const highlightTeacherId = ui.panoramaHighlightTeacherId;
  const classPeriods = state.periods.filter((p) => p.type !== 'break');

  const columns = [];
  DAYS.forEach((day) => {
    const dayPeriods = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index));
    dayPeriods.forEach((p, idx) => {
      columns.push({
        dayIndex: day.index,
        dayName: day.name.toUpperCase(),
        periodId: p.id,
        blockNum: idx + 1,
        isLastOfDay: idx === dayPeriods.length - 1
      });
    });
  });

  const columnTeacherCounts = {};
  columns.forEach((col, colIdx) => {
    columnTeacherCounts[colIdx] = {};
    state.courses.forEach((course) => {
      const a = state.assignments[slotKey(course.id, col.dayIndex, col.periodId)];
      if (!a) return;
      const t = state.teachers.find((x) => x.id === a.teacherId);
      if (t && t.isMultiCourseWorkshop) return;
      columnTeacherCounts[colIdx][a.teacherId] = (columnTeacherCounts[colIdx][a.teacherId] || 0) + 1;
    });
  });

  let h1 = `<tr><th class="day-group-header">CURSO</th>`;
  DAYS.forEach((day) => {
    const count = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index)).length;
    h1 += `<th colspan="${count}" class="day-group-header">${day.name.toUpperCase()}</th>`;
  });
  h1 += `<th class="day-group-header">TOTAL</th></tr>`;

  let h2 = `<tr><th class="block-num-header">Bloque</th>`;
  columns.forEach((col) => {
    h2 += `<th class="block-num-header ${col.isLastOfDay ? 'day-end-border' : ''}">${col.blockNum}</th>`;
  });
  h2 += `<th class="block-num-header">HRS</th></tr>`;

  let body = `<tbody>`;
  state.courses.forEach((course) => {
    let countAssigned = 0;
    body += `<tr><td class="course-row-header">${escapeHtml(course.short || course.name)}</td>`;
    columns.forEach((col, colIdx) => {
      const a = state.assignments[slotKey(course.id, col.dayIndex, col.periodId)];
      const teacher = a ? state.teachers.find((t) => t.id === a.teacherId) : null;
      const bg = teacher ? hexToRgba(teacher.color, 0.18) : 'transparent';
      const isConflict = a && columnTeacherCounts[colIdx][a.teacherId] > 1;
      if (a) countAssigned++;

      let highlightClass = '';
      if (highlightTeacherId && a) {
        highlightClass = a.teacherId === highlightTeacherId ? 'highlighted-slot' : 'dimmed-slot';
      } else if (highlightTeacherId && !a) {
        highlightClass = 'dimmed-slot';
      }

      body += `
        <td class="${col.isLastOfDay ? 'day-end-border' : ''} ${isConflict ? 'sabana-cell-conflict' : ''}"
            style="background:${bg};"
            data-course="${course.id}" data-day="${col.dayIndex}" data-period="${col.periodId}"
            title="${a ? `${escapeHtml(course.name)} — ${escapeHtml(a.subject)} (${teacher ? escapeHtml(teacher.name) : ''})` : 'Libre (Clic para asignar)'}">
          ${
            a
              ? `<div class="sabana-unified-cell ${highlightClass}">
                   <span class="sabana-unified-subj">${escapeHtml(a.shortCode || a.subject.slice(0, 4))}</span>
                   <span class="sabana-unified-prof">${teacher ? escapeHtml(teacher.initials) : ''}</span>
                 </div>`
              : `<div class="sabana-unified-cell ${highlightClass}" style="color:#cbd5e1;">—</div>`
          }
        </td>
      `;
    });
    body += `<td><strong>${countAssigned}/38</strong></td></tr>`;
  });
  body += `</tbody>`;

  container.innerHTML = `<table class="sabana-table"><thead>${h1}${h2}</thead>${body}</table>`;

  container.querySelectorAll('[data-course][data-day][data-period]').forEach((el) => {
    el.addEventListener('click', () => {
      openQuickAssignModal(el.dataset.course, Number(el.dataset.day), el.dataset.period);
    });
  });
}

/* --------------------------------------------------------------------------
   TAB 3: HORARIO INDIVIDUAL POR PROFESOR (INTERACTIVO)
   -------------------------------------------------------------------------- */
function renderTeacherViewTab() {
  const select = document.getElementById('selectViewTeacher');
  select.innerHTML = '';

  state.teachers.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `[${t.initials}] ${t.name} — ${t.specialty}`;
    if (t.id === ui.activeViewTeacherId) opt.selected = true;
    select.appendChild(opt);
  });

  const teacher = state.teachers.find((t) => t.id === ui.activeViewTeacherId);
  if (!teacher) return;

  // Validar que la asignatura seleccionada en esta vista pertenezca al profesor activo
  if (
    ui.selectedTeacherViewReqId &&
    !state.requirements.some((r) => r.id === ui.selectedTeacherViewReqId && r.teacherId === teacher.id)
  ) {
    ui.selectedTeacherViewReqId = null;
  }

  const assignedInCourses = getAssignedHoursForTeacher(teacher.id);
  const plannedInCourses = getPlannedHoursForTeacher(teacher.id);
  const otherLectivas = Number(teacher.otherLectivasHours || 0);
  const sepHrs = Number(teacher.sepHours || 0);
  const totalAulaPedag = assignedInCourses + otherLectivas + sepHrs;
  const totalAulaChrono = (totalAulaPedag * 45) / 60;
  const contractChrono = Number(teacher.contractChrono || 38);
  const nonTeachingChrono = Math.max(0, contractChrono - totalAulaChrono);
  const gapInfo = calculateTeacherGaps(teacher.id);

  document.getElementById('teacherViewStats').innerHTML = `
    <span class="stat-pill">🏷️ Sigla: <strong>${escapeHtml(teacher.initials)}</strong></span>
    <span class="stat-pill">🏫 Cursos (1º-8º): <strong>${assignedInCourses} / ${plannedInCourses} hrs</strong></span>
    ${otherLectivas > 0 ? `<span class="stat-pill">📚 Kº/CRA: <strong>+${otherLectivas} hrs</strong></span>` : ''}
    ${sepHrs > 0 ? `<span class="stat-pill">🎯 SEP: <strong>+${sepHrs} hrs</strong></span>` : ''}
    <span class="stat-pill" title="Horas No Lectivas Cronológicas disponibles según contrato">📋 No Lectivas: <strong>${nonTeachingChrono.toFixed(1)}h cron.</strong></span>
    <span class="stat-pill">⏱️ Contrato: <strong>${contractChrono}h cron.</strong></span>
    <span class="stat-pill ${gapInfo.totalGaps > 0 ? 'stat-pill-warn' : 'stat-pill-ok'}" title="Bloques libres intermedios entre la primera y última clase de un mismo día">🪟 Ventanas: <strong>${gapInfo.totalGaps}</strong></span>
  `;

  // Barra interactiva con todas las asignaturas y cursos de este profesor
  const coursesBar = document.getElementById('teacherCoursesSummaryBar');
  if (coursesBar) {
    const teacherReqs = state.requirements.filter((r) => r.teacherId === teacher.id);
    if (teacherReqs.length === 0) {
      coursesBar.innerHTML = `<span class="helper-text" style="padding:0;">Este docente aún no tiene asignaturas asignadas en el Plan de Estudio (1º a 8º).</span>`;
    } else {
      const chipsHtml = teacherReqs
        .map((r) => {
          const c = state.courses.find((x) => x.id === r.courseId);
          const asg = getAssignedHoursForRequirement(r.id);
          const done = asg >= r.hoursPerWeek;
          const isSel = ui.selectedTeacherViewReqId === r.id;
          return `
            <button type="button"
                    class="teacher-req-chip ${isSel ? 'selected' : ''} ${done ? 'done' : 'pending'}"
                    data-req-id="${r.id}"
                    title="Haz clic aquí y luego en un bloque libre del calendario para asignar esta clase directamente">
              <strong>${c ? escapeHtml(c.short || c.name) : ''}</strong> · ${escapeHtml(r.shortCode || r.subject)}
              <span class="chip-hrs">${asg}/${r.hoursPerWeek}h</span>
            </button>
          `;
        })
        .join('');

      const activeReq = state.requirements.find((r) => r.id === ui.selectedTeacherViewReqId);
      const activeCourse = activeReq ? state.courses.find((c) => c.id === activeReq.courseId) : null;

      coursesBar.innerHTML = `
        <div class="teacher-courses-bar-top">
          <span><strong>📚 Cursos de ${escapeHtml(teacher.name)}:</strong> ${
            activeReq
              ? `<span style="color:#1e40af; font-weight:700;">📌 Asignando ${escapeHtml(activeReq.subject)} en ${
                  activeCourse ? escapeHtml(activeCourse.name) : ''
                } (Haz clic en un bloque libre abajo)</span>`
              : 'Haz clic en una asignatura pendiente abajo para ubicarla directo desde el horario del profesor:'
          }</span>
        </div>
        <div class="teacher-req-chips-wrap">${chipsHtml}</div>
      `;

      coursesBar.querySelectorAll('.teacher-req-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rId = btn.dataset.reqId;
          ui.availabilityEditMode = false;
          ui.selectedTeacherViewReqId = ui.selectedTeacherViewReqId === rId ? null : rId;
          renderTeacherViewTab();
        });
      });
    }
  }

  document.getElementById('availabilityModeBanner').classList.toggle('hidden', !ui.availabilityEditMode);

  // Sincronizar selector de día móvil del horario docente
  const teacherTableEl = document.getElementById('teacherScheduleTable');
  if (teacherTableEl) {
    teacherTableEl.dataset.mobileDay = String(ui.teacherMobileDay || '0');
  }
  document.querySelectorAll('#teacherMobileDayBar .mobile-day-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.day === String(ui.teacherMobileDay || '0'));
  });

  const headerRow = document.getElementById('teacherScheduleHeader');
  const tbody = document.getElementById('teacherScheduleBody');

  headerRow.innerHTML =
    `<th class="time-col">Bloque / Hora</th>` +
    DAYS.map((d) => `<th data-day-col="${d.index}">${d.name}</th>`).join('');
  tbody.innerHTML = '';

  const selectedReqForTeacher = ui.selectedTeacherViewReqId
    ? state.requirements.find((r) => r.id === ui.selectedTeacherViewReqId)
    : null;

  state.periods.forEach((period) => {
    const tr = document.createElement('tr');
    if (period.type === 'break') {
      tr.className = 'break-row';
      tr.innerHTML = `
        <td>${escapeHtml(period.start)} - ${escapeHtml(period.end)}</td>
        <td colspan="${DAYS.length}">☕ ${escapeHtml(period.label)}</td>
      `;
      tbody.appendChild(tr);
      return;
    }

    const timeTd = document.createElement('td');
    timeTd.className = 'time-cell';
    timeTd.innerHTML = `
      <div class="period-name">${escapeHtml(period.label)}</div>
      <div class="period-hours">${escapeHtml(period.start)} - ${escapeHtml(period.end)}</div>
    `;
    tr.appendChild(timeTd);

    DAYS.forEach((day) => {
      const td = document.createElement('td');
      td.className = 'slot-cell';
      td.dataset.dayCol = String(day.index);

      if (isPeriodDisabledOnDay(period, day.index)) {
        td.classList.add('slot-disabled-friday');
        td.innerHTML = `<div class="unavailable-warning-chip">Sin clases (Vie tarde)</div>`;
        tr.appendChild(td);
        return;
      }

      const slots = findTeacherAssignmentsAtSlot(teacher.id, day.index, period.id);
      const unavailable = isTeacherUnavailable(teacher.id, day.index, period.id);

      // Si hay una asignatura seleccionada de un curso, verificar si ese curso ya está ocupado con otro profesor a esta hora
      let targetCourseOccupiedByOther = null;
      if (selectedReqForTeacher && slots.length === 0) {
        const existingInCourse = state.assignments[slotKey(selectedReqForTeacher.courseId, day.index, period.id)];
        if (existingInCourse) {
          targetCourseOccupiedByOther = existingInCourse;
        }
      }

      if (slots.length > 0) {
        const bg = hexToRgba(teacher.color, 0.16);
        const coursesNames = slots
          .map((s) => state.courses.find((c) => c.id === s.courseId)?.short || '')
          .join(', ');
        const firstSubj = slots[0].subject || slots[0].shortCode;
        const firstSlot = slots[0];
        td.innerHTML = `
          <div class="assigned-block" style="border-left-color:${teacher.color}; background:${bg};" title="Haz clic para abrir el curso ${escapeHtml(coursesNames)}">
            ${
              slots.length === 1
                ? `<button type="button" class="block-remove-btn no-print" title="Quitar este bloque de ${escapeHtml(coursesNames)}">✕</button>`
                : ''
            }
            <div class="block-subject">${escapeHtml(firstSubj)}</div>
            <div class="block-teacher">🏫 Curso: <strong>${escapeHtml(coursesNames)}</strong></div>
          </div>
        `;

        const rmBtn = td.querySelector('.block-remove-btn');
        if (rmBtn && firstSlot) {
          rmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSlotAssignment(firstSlot.courseId, day.index, period.id);
            renderAll();
          });
        }
      } else if (unavailable) {
        td.classList.add('slot-unavailable-preview');
        td.innerHTML = `
          <div class="unavailable-warning-chip">
            🔒 No Disponible ${ui.availabilityEditMode ? '(Clic para liberar)' : ''}
          </div>
        `;
      } else if (targetCourseOccupiedByOther) {
        const targetCourse = state.courses.find((c) => c.id === selectedReqForTeacher.courseId);
        const otherTeacher = state.teachers.find((t) => t.id === targetCourseOccupiedByOther.teacherId);
        td.classList.add('slot-conflict-preview');
        td.innerHTML = `
          <div class="conflict-warning-chip">
            <strong>🏫 ${targetCourse ? escapeHtml(targetCourse.short) : ''} ocupado</strong>
            <span>Con ${escapeHtml(targetCourseOccupiedByOther.shortCode)} (${otherTeacher ? escapeHtml(otherTeacher.initials) : ''})</span>
          </div>
        `;
      } else {
        const isGapSlot = gapInfo.gapSlotKeys.has(`${day.index}__${period.id}`);
        if (isGapSlot && !ui.availabilityEditMode && !selectedReqForTeacher) {
          td.classList.add('slot-teacher-gap');
        }
        td.innerHTML = `
          <div class="empty-slot-placeholder">
            ${
              ui.availabilityEditMode
                ? '🔒 Clic para bloquear'
                : selectedReqForTeacher
                ? '+ Asignar aquí'
                : isGapSlot
                ? '🪟 Ventana (Libre intermedia)'
                : 'Hora No Lectiva / Libre'
            }
          </div>
        `;
      }

      td.addEventListener('click', () => {
        if (ui.availabilityEditMode) {
          if (slots.length > 0) {
            showToast('Este bloque tiene una clase asignada. Quita la clase primero si deseas bloquearlo.', 'warn');
            return;
          }
          pushUndoSnapshot();
          const uKey = unavailableKey(teacher.id, day.index, period.id);
          if (state.teacherUnavailable[uKey]) {
            delete state.teacherUnavailable[uKey];
          } else {
            state.teacherUnavailable[uKey] = true;
          }
          saveState();
          renderAll();
          return;
        }

        // Si el usuario seleccionó una asignatura pendiente del profesor y hace clic en un bloque libre
        if (selectedReqForTeacher && slots.length === 0) {
          if (targetCourseOccupiedByOther) {
            const targetCourse = state.courses.find((c) => c.id === selectedReqForTeacher.courseId);
            showToast(
              `⚠️ El curso ${targetCourse ? targetCourse.name : ''} ya tiene asignado ${targetCourseOccupiedByOther.subject} en ese bloque.`,
              'warn'
            );
            return;
          }
          if (assignRequirementToSlot(selectedReqForTeacher.courseId, day.index, period.id, selectedReqForTeacher.id, false)) {
            renderAll();
          }
          return;
        }

        // Si hace clic en un bloque ya asignado, ir al horario de ese curso
        if (slots.length > 0) {
          ui.activeCourseId = slots[0].courseId;
          switchTab('tab-calendario');
          renderAll();
        }
      });

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

/* --------------------------------------------------------------------------
   TAB 4: CUADRO DE HORAS LECTIVAS, SEP Y NO LECTIVAS (65/35)
   -------------------------------------------------------------------------- */
function renderTeachersManagementTab() {
  const tbody = document.getElementById('teachersTableBody');
  const query = (document.getElementById('searchTeacherInput')?.value || '').trim().toLowerCase();
  tbody.innerHTML = '';

  // Dashboard resumen de cumplimiento 65/35 y carga horaria global
  const kpiWrap = document.getElementById('workloadSummaryKpis');
  if (kpiWrap) {
    const regularTeachers = state.teachers.filter((t) => !t.isMultiCourseWorkshop);
    let ok65Count = 0;
    let over65Count = 0;
    let totalPlannedAll = 0;
    let totalScheduledAll = 0;
    let totalGapsAll = 0;

    regularTeachers.forEach((t) => {
      const planned = getPlannedHoursForTeacher(t.id);
      const scheduled = getAssignedHoursForTeacher(t.id);
      const otherL = Number(t.otherLectivasHours || 0);
      const sepH = Number(t.sepHours || 0);
      const aulaChrono = ((scheduled + otherL + sepH) * 45) / 60;
      const contract = Number(t.contractChrono || 38);
      const pct = contract > 0 ? Math.round((aulaChrono / contract) * 100) : 0;
      if (pct > 66) over65Count++;
      else ok65Count++;
      totalPlannedAll += planned;
      totalScheduledAll += scheduled;
      totalGapsAll += calculateTeacherGaps(t.id).totalGaps;
    });

    const pctGlobal = totalPlannedAll > 0 ? Math.min(100, Math.round((totalScheduledAll / totalPlannedAll) * 100)) : 0;

    kpiWrap.innerHTML = `
      <div class="workload-kpi-card">
        <div class="workload-kpi-label">👨‍🏫 Planta Docente</div>
        <div class="workload-kpi-value">${regularTeachers.length}</div>
        <div class="workload-kpi-sub">Docentes activos (${currentSchoolYear})</div>
      </div>
      <div class="workload-kpi-card ${over65Count > 0 ? 'kpi-danger' : 'kpi-ok'}">
        <div class="workload-kpi-label">⚖️ Cumplimiento Ley 65/35</div>
        <div class="workload-kpi-value">${ok65Count} / ${regularTeachers.length}</div>
        <div class="workload-kpi-sub">${over65Count > 0 ? `⚠️ ${over65Count} sobre 65% lectivo` : '✅ Todos dentro de norma'}</div>
      </div>
      <div class="workload-kpi-card">
        <div class="workload-kpi-label">🗓️ Horas en Horario (1º-8º)</div>
        <div class="workload-kpi-value">${totalScheduledAll} / ${totalPlannedAll}h</div>
        <div class="workload-kpi-sub">${pctGlobal}% del plan asignado</div>
      </div>
      <div class="workload-kpi-card ${totalGapsAll > 0 ? 'kpi-warn' : 'kpi-ok'}">
        <div class="workload-kpi-label">🪟 Ventanas Docentes</div>
        <div class="workload-kpi-value">${totalGapsAll}</div>
        <div class="workload-kpi-sub">Horas libres intermedias totales</div>
      </div>
    `;
  }

  const filtered = state.teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(query) ||
      (t.initials || '').toLowerCase().includes(query) ||
      t.specialty.toLowerCase().includes(query)
  );

  filtered.forEach((t) => {
    const plannedCourses = getPlannedHoursForTeacher(t.id);
    const scheduledCourses = getAssignedHoursForTeacher(t.id);
    const otherLectivas = Number(t.otherLectivasHours || 0);
    const sepHours = Number(t.sepHours || 0);
    const totalLectivas = scheduledCourses + otherLectivas;
    const totalAulaPedag = totalLectivas + sepHours;
    const totalAulaChrono = (totalAulaPedag * 45) / 60;
    const contractChrono = Number(t.contractChrono || 38);
    const nonTeachingChrono = Math.max(0, contractChrono - totalAulaChrono);
    const pctLectivo = contractChrono > 0 ? Math.round((totalAulaChrono / contractChrono) * 100) : 0;
    const pctNoLectivo = Math.max(0, 100 - pctLectivo);
    const exceeds65 = !t.isMultiCourseWorkshop && pctLectivo > 66;

    const isComplete = scheduledCourses === plannedCourses;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Sigla" class="mobile-card-sigla">
        <span class="teacher-initials-badge" style="background:${t.color}">${escapeHtml(t.initials || '')}</span>
      </td>
      <td data-label="Profesor(a)" class="mobile-card-title"><strong>${escapeHtml(t.name)}</strong></td>
      <td data-label="Especialidad">${escapeHtml(t.specialty)}</td>
      <td data-label="Hrs Plan (1º-8º)"><strong>${plannedCourses}</strong> hrs</td>
      <td data-label="En Horario (1º-8º)">
        <span class="badge-pill ${isComplete ? 'badge-ok' : 'badge-warn'}">
          ${scheduledCourses} / ${plannedCourses} hrs
        </span>
      </td>
      <td data-label="Kº/CRA y SEP">
        ${otherLectivas > 0 ? `<div>+${otherLectivas}h (Kº/CRA)</div>` : ''}
        ${sepHours > 0 ? `<div><strong>+${sepHours}h SEP</strong></div>` : ''}
        ${otherLectivas === 0 && sepHours === 0 ? '<span style="color:#94a3b8;">0 hrs</span>' : ''}
      </td>
      <td data-label="Total Aula">
        <div>
          <strong>${totalAulaPedag} hrs pedag.</strong>
          <div style="font-size:0.73rem; color:#64748b;">(${totalAulaChrono.toFixed(2)} hrs cron.)</div>
        </div>
      </td>
      <td data-label="No Lectivas (65/35)">
        <div>
          <div><strong>${nonTeachingChrono.toFixed(2)} hrs cron.</strong> no lectivas</div>
          <span class="badge-pill ${exceeds65 ? 'badge-danger' : 'badge-ok'}" style="margin-top:2px; font-size:0.7rem;" title="Proporción horas lectivas / no lectivas respecto al contrato">
            ${pctLectivo}% Aula / ${pctNoLectivo}% No Lect.
          </span>
        </div>
      </td>
      <td data-label="Contrato">
        <div>
          <strong>${contractChrono} hrs</strong>
          ${t.pieInfo ? `<span class="badge-pill" style="margin-left:4px;">${escapeHtml(t.pieInfo)}</span>` : ''}
        </div>
      </td>
      <td data-label="Acciones" class="no-print mobile-card-actions">
        <div style="display:flex; gap:0.35rem; flex-wrap:wrap; justify-content:flex-end;">
          <button type="button" class="btn btn-outline btn-xs btn-ficha-t" title="Ver Ficha de Horas Lectivas y No Lectivas">📋 Ficha</button>
          <button type="button" class="btn btn-outline btn-xs btn-view-t" title="Ver Horario">🗓️</button>
          <button type="button" class="btn btn-outline btn-xs btn-edit-t" title="Editar">✏️</button>
          <button type="button" class="btn btn-danger-outline btn-xs btn-del-t" title="Eliminar">🗑️</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-ficha-t').addEventListener('click', () => {
      openTeacherDetailModal(t.id);
    });

    tr.querySelector('.btn-view-t').addEventListener('click', () => {
      ui.activeViewTeacherId = t.id;
      switchTab('tab-profesor-vista');
      renderAll();
    });

    tr.querySelector('.btn-edit-t').addEventListener('click', () => {
      document.getElementById('teacherFormTitle').textContent = `Editar: ${t.name}`;
      document.getElementById('teacherIdInput').value = t.id;
      document.getElementById('teacherInitialsInput').value = t.initials || '';
      document.getElementById('teacherNameInput').value = t.name;
      document.getElementById('teacherSpecialtyInput').value = t.specialty;
      document.getElementById('teacherMaxHoursInput').value = t.maxHours;
      const otherInput = document.getElementById('teacherOtherLectivasInput');
      if (otherInput) otherInput.value = t.otherLectivasHours || 0;
      document.getElementById('teacherSepHoursInput').value = t.sepHours || 0;
      document.getElementById('teacherContractChronoInput').value = t.contractChrono || 38;
      document.getElementById('teacherPieHoursInput').value = t.pieInfo || '';
      document.getElementById('teacherSepDetailInput').value = t.sepDetail || '';
      const nonTeachInput = document.getElementById('teacherNonTeachingInput');
      if (nonTeachInput) nonTeachInput.value = t.nonTeachingDetail || '';
      document.getElementById('teacherColorInput').value = t.color;
      document.getElementById('btnCancelTeacherEdit').classList.remove('hidden');
      const teacherFormCard = document.getElementById('teacherFormCard');
      const teacherFormToggleBtn = document.getElementById('btnToggleTeacherFormMobile');
      if (teacherFormCard) {
        teacherFormCard.classList.remove('is-collapsed-mobile');
      }
      if (teacherFormToggleBtn) {
        teacherFormToggleBtn.setAttribute('aria-expanded', 'true');
        teacherFormToggleBtn.textContent = '▾ Ocultar';
      }
      document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    tr.querySelector('.btn-del-t').addEventListener('click', () => {
      if (!confirm(`¿Eliminar a ${t.name}?`)) return;
      pushUndoSnapshot();
      state.teachers = state.teachers.filter((x) => x.id !== t.id);
      state.requirements = state.requirements.filter((r) => r.teacherId !== t.id);
      for (const k in state.assignments) {
        if (state.assignments[k].teacherId === t.id) delete state.assignments[k];
      }
      saveState();
      renderAll();
    });

    tbody.appendChild(tr);
  });
}

function openTeacherDetailModal(teacherId) {
  const teacher = state.teachers.find((t) => t.id === teacherId);
  if (!teacher) return;

  const modal = document.getElementById('teacherDetailModal');
  document.getElementById('teacherDetailTitle').textContent = `Ficha Docente (${currentSchoolYear}): ${teacher.name} (${teacher.initials})`;

  const teacherReqs = state.requirements.filter((r) => r.teacherId === teacher.id);
  const scheduledCourses = getAssignedHoursForTeacher(teacher.id);
  const otherLectivas = Number(teacher.otherLectivasHours || 0);
  const sepHours = Number(teacher.sepHours || 0);
  const totalPedag = scheduledCourses + otherLectivas + sepHours;
  const totalLectivasChrono = (totalPedag * 45) / 60;
  const contractChrono = Number(teacher.contractChrono || 38);
  const nonTeachingChrono = Math.max(0, contractChrono - totalLectivasChrono);
  const pctLectivo = contractChrono > 0 ? Math.round((totalLectivasChrono / contractChrono) * 100) : 0;
  const pctNoLectivo = Math.max(0, 100 - pctLectivo);

  const reqRows = teacherReqs
    .map((r) => {
      const c = state.courses.find((x) => x.id === r.courseId);
      const asg = getAssignedHoursForRequirement(r.id);
      return `
        <tr>
          <td>${escapeHtml(r.subject)} — <strong>${c ? escapeHtml(c.name) : ''}</strong></td>
          <td>${r.hoursPerWeek} hrs pedag.</td>
          <td>${asg} hrs en horario</td>
          <td>${((r.hoursPerWeek * 45) / 60).toFixed(2)} hrs cron.</td>
        </tr>
      `;
    })
    .join('');

  document.getElementById('teacherDetailBody').innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.85rem;">
      <div style="background:#f8fafc; padding:0.75rem; border-radius:8px; border:1px solid #e2e8f0;">
        <div><strong>Profesor(a):</strong> ${escapeHtml(teacher.name)} (${escapeHtml(teacher.initials)})</div>
        <div><strong>Especialidad / Jefatura:</strong> ${escapeHtml(teacher.specialty)}</div>
        <div><strong>Jornada Semanal de Contrato:</strong> ${contractChrono} hrs cronológicas ${
    teacher.pieInfo ? `(${escapeHtml(teacher.pieInfo)})` : ''
  }</div>
      </div>

      <div>
        <h4 style="margin-bottom:0.4rem;">I. Horas Lectivas en Cursos (1º a 8º Básico)</h4>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Asignatura y Curso</th>
                <th>Plan</th>
                <th>En Horario</th>
                <th>Hrs Cronológicas</th>
              </tr>
            </thead>
            <tbody>
              ${reqRows || '<tr><td colspan="4">Sin asignaturas directas</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="background:#eff6ff; padding:0.75rem; border-radius:8px; border:1px solid #bfdbfe; font-size:0.84rem;">
        <strong>II. Horas SEP / Co-docencia / Otras Lectivas (${otherLectivas + sepHours} hrs pedag.):</strong>
        <p style="margin-top:0.25rem;">${escapeHtml(teacher.sepDetail || 'Sin horas SEP adicionales.')}</p>
      </div>

      <div style="background:#f0fdf4; padding:0.75rem; border-radius:8px; border:1px solid #bbf7d0; font-size:0.84rem;">
        <strong>III. Horas No Lectivas y Proporción Legal 65/35:</strong>
        <ul style="margin:0.35rem 0 0 1.2rem;">
          <li>Total Horas Aula (I + II): <strong>${totalPedag} hrs pedagógicas</strong> = <strong>${totalLectivasChrono.toFixed(2)} hrs cronológicas (${pctLectivo}%)</strong></li>
          <li>Total Horas No Lectivas Disponibles: <strong>${nonTeachingChrono.toFixed(2)} hrs cronológicas (${pctNoLectivo}%)</strong></li>
          <li>Distribución No Lectiva: ${escapeHtml(
            teacher.nonTeachingDetail ||
              'Planificación, preparación y evaluación (40%), Consejo de profesores, DPD, Evaluación docente, Atención de apoderados y estudiantes.'
          )}</li>
        </ul>
      </div>
    </div>
  `;

  document.getElementById('btnGoTeacherSchedule').onclick = () => {
    modal.classList.add('hidden');
    ui.activeViewTeacherId = teacher.id;
    switchTab('tab-profesor-vista');
    renderAll();
  };

  const btnExportFichaPdf = document.getElementById('btnExportTeacherFichaPdf');
  if (btnExportFichaPdf) {
    btnExportFichaPdf.onclick = () => {
      modal.classList.add('hidden');
      exportSingleTeacherPdfDirect(teacher.id);
    };
  }

  modal.classList.remove('hidden');
}

/* --------------------------------------------------------------------------
   TAB 5: CURSOS Y PLAN DE ESTUDIO POR CURSO
   -------------------------------------------------------------------------- */
function renderCoursesManagementTab() {
  const listContainer = document.getElementById('coursesListContainer');
  listContainer.innerHTML = '';

  state.courses.forEach((course) => {
    const reqs = state.requirements.filter((r) => r.courseId === course.id);
    const totalHours = reqs.reduce((acc, r) => acc + Number(r.hoursPerWeek), 0);

    const item = document.createElement('div');
    item.className = `course-list-item ${course.id === ui.selectedPlanCourseId ? 'active' : ''}`;
    item.innerHTML = `
      <div>
        <div class="course-list-item-title">🏫 ${escapeHtml(course.name)}</div>
        <div class="course-list-item-meta">${reqs.length} asignaturas • ${totalHours} / 38 hrs</div>
      </div>
      <div class="no-print" style="display:flex; gap:0.3rem;">
        <button type="button" class="btn btn-outline btn-xs btn-open-cal" title="Ir al horario de este curso">🗓️</button>
        <button type="button" class="btn btn-danger-outline btn-xs btn-del-course" title="Eliminar curso">🗑️</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      ui.selectedPlanCourseId = course.id;
      renderCoursesManagementTab();
    });

    item.querySelector('.btn-open-cal').addEventListener('click', (e) => {
      e.stopPropagation();
      ui.activeCourseId = course.id;
      switchTab('tab-calendario');
      renderAll();
    });

    item.querySelector('.btn-del-course').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar el curso "${course.name}" y su horario?`)) return;
      pushUndoSnapshot();
      state.courses = state.courses.filter((c) => c.id !== course.id);
      state.requirements = state.requirements.filter((r) => r.courseId !== course.id);
      for (const k in state.assignments) {
        if (state.assignments[k].courseId === course.id) delete state.assignments[k];
      }
      saveState();
      renderAll();
    });

    listContainer.appendChild(item);
  });

  const teacherSelect = document.getElementById('reqTeacherSelect');
  teacherSelect.innerHTML = state.teachers
    .map((t) => `<option value="${t.id}">[${escapeHtml(t.initials)}] ${escapeHtml(t.name)}</option>`)
    .join('');

  const suggestions = [
    'LENGUAJE Y COMUNICACIÓN',
    'MATEMÁTICA',
    'HISTORIA, GEO. Y CS. SOCIALES',
    'CIENCIAS NATURALES',
    'INGLÉS',
    'EDUCACIÓN FÍSICA',
    'ARTES VISUALES',
    'MÚSICA',
    'RELIGIÓN',
    'TECNOLOGÍA',
    'ORIENTACIÓN',
    'TALLERES ELECTIVOS'
  ];
  document.getElementById('subjectsSuggestions').innerHTML = suggestions
    .map((s) => `<option value="${escapeHtml(s)}"></option>`)
    .join('');

  const selectedCourse = state.courses.find((c) => c.id === ui.selectedPlanCourseId);
  document.getElementById('coursePlanTitle').textContent = selectedCourse
    ? `Plan de Estudio Oficial — ${selectedCourse.name}`
    : 'Plan de Estudio del Curso';

  const reqs = state.requirements.filter((r) => r.courseId === ui.selectedPlanCourseId);
  const sumHours = reqs.reduce((acc, r) => acc + Number(r.hoursPerWeek), 0);
  document.getElementById('coursePlanBadge').textContent = `${sumHours} / 38 bloques semanales`;

  const reqTbody = document.getElementById('requirementsTableBody');
  reqTbody.innerHTML = '';

  reqs.forEach((r) => {
    const teacher = state.teachers.find((t) => t.id === r.teacherId);
    const assigned = getAssignedHoursForRequirement(r.id);
    const complete = assigned === r.hoursPerWeek;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Sigla" class="mobile-card-sigla"><strong>${escapeHtml(r.shortCode || '')}</strong></td>
      <td data-label="Asignatura" class="mobile-card-title"><strong>${escapeHtml(r.subject)}</strong></td>
      <td data-label="Profesor">
        <div class="teacher-Row-Name">
          <span class="teacher-initials-badge" style="background:${teacher ? teacher.color : '#64748b'}">${
      teacher ? escapeHtml(teacher.initials) : '?'
    }</span>
          <span>${teacher ? escapeHtml(teacher.name) : 'Sin profesor'}</span>
        </div>
      </td>
      <td data-label="Hrs Plan"><strong>${r.hoursPerWeek}</strong> hrs</td>
      <td data-label="En Calendario">${assigned} hrs</td>
      <td data-label="Estado">
        <span class="badge-pill ${complete ? 'badge-ok' : 'badge-warn'}">
          ${complete ? '✅ 100% en horario' : `Faltan ${Math.max(0, r.hoursPerWeek - assigned)} hrs`}
        </span>
      </td>
      <td data-label="Acciones" class="no-print mobile-card-actions">
        <div style="display:flex; gap:0.35rem; justify-content:flex-end;">
          <button type="button" class="btn btn-outline btn-xs btn-edit-req">✏️ Editar</button>
          <button type="button" class="btn btn-danger-outline btn-xs btn-del-req">🗑️</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-edit-req').addEventListener('click', () => {
      document.getElementById('reqIdInput').value = r.id;
      document.getElementById('reqSubjectInput').value = r.subject;
      document.getElementById('reqShortCodeInput').value = r.shortCode || '';
      document.getElementById('reqTeacherSelect').value = r.teacherId;
      document.getElementById('reqHoursInput').value = r.hoursPerWeek;
      document.getElementById('btnSaveRequirement').textContent = 'Actualizar';
      document.getElementById('btnCancelReqEdit').classList.remove('hidden');
      document.getElementById('requirementForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    tr.querySelector('.btn-del-req').addEventListener('click', () => {
      pushUndoSnapshot();
      state.requirements = state.requirements.filter((x) => x.id !== r.id);
      for (const k in state.assignments) {
        if (state.assignments[k].reqId === r.id) delete state.assignments[k];
      }
      saveState();
      renderAll();
    });

    reqTbody.appendChild(tr);
  });
}

/* --------------------------------------------------------------------------
   TAB 6: CONFIGURACIÓN DE BLOQUES Y JORNADA (38 BLOQUES)
   -------------------------------------------------------------------------- */
function renderPeriodsTab() {
  const tbody = document.getElementById('periodsTableBody');
  tbody.innerHTML = '';

  const monThuCount = state.periods.filter((p) => p.type !== 'break').length;
  const friCount = state.periods.filter((p) => p.type === 'class').length;
  const totalWeekly = monThuCount * 4 + friCount;
  document.getElementById('totalWeeklySlotsBadge').textContent = `${totalWeekly} bloques semanales (${monThuCount} Lun-Jue + ${friCount} Vie)`;

  state.periods.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${idx + 1}</td>
      <td><strong>${escapeHtml(p.label)}</strong></td>
      <td>${escapeHtml(p.start)} - ${escapeHtml(p.end)}</td>
      <td>${escapeHtml(p.friStart || p.start)} - ${escapeHtml(p.friEnd || p.end)}</td>
      <td>
        <span class="badge-pill ${p.type === 'break' ? 'badge-warn' : 'badge-ok'}">
          ${
            p.type === 'break'
              ? '☕ Recreo / Almuerzo'
              : p.type === 'class_mon_thu'
              ? '📚 Clases Lun a Jue (Vie salida 14:00)'
              : '📚 Clases Lun a Vie'
          }
        </span>
      </td>
      <td class="no-print">
        <div style="display:flex; gap:0.3rem;">
          <button type="button" class="btn btn-outline btn-xs btn-up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-outline btn-xs btn-down" ${idx === state.periods.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn btn-danger-outline btn-xs btn-del-p">🗑️</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-up').addEventListener('click', () => {
      if (idx === 0) return;
      pushUndoSnapshot();
      const tmp = state.periods[idx - 1];
      state.periods[idx - 1] = state.periods[idx];
      state.periods[idx] = tmp;
      saveState();
      renderAll();
    });

    tr.querySelector('.btn-down').addEventListener('click', () => {
      if (idx === state.periods.length - 1) return;
      pushUndoSnapshot();
      const tmp = state.periods[idx + 1];
      state.periods[idx + 1] = state.periods[idx];
      state.periods[idx] = tmp;
      saveState();
      renderAll();
    });

    tr.querySelector('.btn-del-p').addEventListener('click', () => {
      if (!confirm(`¿Eliminar el bloque "${p.label}"?`)) return;
      pushUndoSnapshot();
      state.periods = state.periods.filter((x) => x.id !== p.id);
      for (const k in state.assignments) {
        if (state.assignments[k].periodId === p.id) delete state.assignments[k];
      }
      saveState();
      renderAll();
    });

    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   EVENTOS E INICIALIZACIÓN
   ========================================================================== */
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

function resetTeacherForm() {
  document.getElementById('teacherFormTitle').textContent = 'Agregar / Editar Profesor(a)';
  document.getElementById('teacherIdInput').value = '';
  document.getElementById('teacherInitialsInput').value = '';
  document.getElementById('teacherNameInput').value = '';
  document.getElementById('teacherSpecialtyInput').value = '';
  document.getElementById('teacherMaxHoursInput').value = '30';
  const otherEl = document.getElementById('teacherOtherLectivasInput');
  if (otherEl) otherEl.value = '0';
  document.getElementById('teacherSepHoursInput').value = '0';
  document.getElementById('teacherContractChronoInput').value = '38';
  document.getElementById('teacherPieHoursInput').value = '';
  document.getElementById('teacherSepDetailInput').value = '';
  const nonTeachEl = document.getElementById('teacherNonTeachingInput');
  if (nonTeachEl) nonTeachEl.value = '';
  document.getElementById('btnCancelTeacherEdit').classList.add('hidden');
}

function resetRequirementForm() {
  document.getElementById('reqIdInput').value = '';
  document.getElementById('reqSubjectInput').value = '';
  document.getElementById('reqShortCodeInput').value = '';
  document.getElementById('reqHoursInput').value = '4';
  document.getElementById('btnSaveRequirement').textContent = '+ Guardar';
  document.getElementById('btnCancelReqEdit').classList.add('hidden');
}

