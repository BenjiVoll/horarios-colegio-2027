/* ==========================================================================
   MOTOR DE VALIDACIÓN DE TOPONES Y LÍMITES DE HORAS
   ========================================================================== */
function findTeacherConflict(teacherId, dayIndex, periodId, ignoreCourseId = null) {
  const teacher = state.teachers.find((t) => t.id === teacherId);
  if (teacher && teacher.isMultiCourseWorkshop) {
    return null;
  }

  for (const key in state.assignments) {
    const a = state.assignments[key];
    if (
      a.teacherId === teacherId &&
      Number(a.dayIndex) === Number(dayIndex) &&
      a.periodId === periodId &&
      a.courseId !== ignoreCourseId
    ) {
      return a;
    }
  }
  return null;
}

function findTeacherAssignmentsAtSlot(teacherId, dayIndex, periodId) {
  const list = [];
  for (const key in state.assignments) {
    const a = state.assignments[key];
    if (
      a.teacherId === teacherId &&
      Number(a.dayIndex) === Number(dayIndex) &&
      a.periodId === periodId
    ) {
      list.push(a);
    }
  }
  return list;
}

function isTeacherUnavailable(teacherId, dayIndex, periodId) {
  return Boolean(state.teacherUnavailable[unavailableKey(teacherId, dayIndex, periodId)]);
}

function getAssignedHoursForRequirement(reqId, ignoreSlotKey = null) {
  let count = 0;
  for (const key in state.assignments) {
    if (key === ignoreSlotKey) continue;
    if (state.assignments[key].reqId === reqId) {
      count++;
    }
  }
  return count;
}

function getAssignedHoursForTeacher(teacherId, ignoreSlotKey = null) {
  let count = 0;
  for (const key in state.assignments) {
    if (key === ignoreSlotKey) continue;
    if (state.assignments[key].teacherId === teacherId) {
      count++;
    }
  }
  return count;
}

function getPlannedHoursForTeacher(teacherId) {
  return state.requirements
    .filter((r) => r.teacherId === teacherId)
    .reduce((acc, r) => acc + Number(r.hoursPerWeek || 0), 0);
}

function scanAllConflicts() {
  const conflicts = [];
  const seen = {};
  for (const key in state.assignments) {
    const a = state.assignments[key];
    const teacher = state.teachers.find((t) => t.id === a.teacherId);
    if (teacher && teacher.isMultiCourseWorkshop) continue;

    const k = `${a.teacherId}__${a.dayIndex}__${a.periodId}`;
    if (seen[k]) {
      conflicts.push({ first: seen[k], second: a });
    } else {
      seen[k] = a;
    }
  }
  return conflicts;
}

/**
 * Calcula las "ventanas" (bloques libres intermedios entre la primera y última clase de un día) para un docente.
 */
function calculateTeacherGaps(teacherId) {
  const classPeriods = state.periods.filter((p) => p.type !== 'break');
  const gapSlotKeys = new Set();
  const gapsByDay = {};
  let totalGaps = 0;

  DAYS.forEach((day) => {
    const activePeriods = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index));
    const busyIndices = [];
    activePeriods.forEach((p, idx) => {
      const slots = findTeacherAssignmentsAtSlot(teacherId, day.index, p.id);
      if (slots.length > 0) busyIndices.push(idx);
    });

    let dayGaps = 0;
    if (busyIndices.length >= 2) {
      const firstIdx = busyIndices[0];
      const lastIdx = busyIndices[busyIndices.length - 1];
      for (let i = firstIdx + 1; i < lastIdx; i++) {
        if (!busyIndices.includes(i)) {
          dayGaps++;
          totalGaps++;
          gapSlotKeys.add(`${day.index}__${activePeriods[i].id}`);
        }
      }
    }
    gapsByDay[day.index] = dayGaps;
  });

  return { totalGaps, gapsByDay, gapSlotKeys };
}

/**
 * Detecta alertas pedagógicas no bloqueantes en un curso (ej. 3 o más bloques seguidos de la misma asignatura en un día).
 */
function findCourseConsecutiveWarnings(courseId) {
  const classPeriods = state.periods.filter((p) => p.type !== 'break');
  const warnings = [];

  DAYS.forEach((day) => {
    const activePeriods = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index));
    let streakReqId = null;
    let streakSubject = '';
    let streakCount = 0;

    const flushStreak = () => {
      if (streakCount >= 3 && streakReqId) {
        warnings.push({
          dayIndex: day.index,
          dayName: day.name,
          subject: streakSubject,
          count: streakCount
        });
      }
    };

    activePeriods.forEach((p) => {
      const a = state.assignments[slotKey(courseId, day.index, p.id)];
      if (a && a.reqId === streakReqId) {
        streakCount++;
      } else {
        flushStreak();
        if (a) {
          streakReqId = a.reqId;
          streakSubject = a.subject;
          streakCount = 1;
        } else {
          streakReqId = null;
          streakSubject = '';
          streakCount = 0;
        }
      }
    });
    flushStreak();
  });

  return warnings;
}

/**
 * Intercambia (hace enroque) o mueve un bloque ya asignado hacia otro bloque del mismo curso.
 */
function swapOrMoveSlotsInCourse(courseId, fromDay, fromPeriodId, toDay, toPeriodId) {
  if (Number(fromDay) === Number(toDay) && fromPeriodId === toPeriodId) return false;

  const targetPeriod = state.periods.find((p) => p.id === toPeriodId);
  if (isPeriodDisabledOnDay(targetPeriod, toDay)) {
    showToast('No se puede mover a un bloque inhabilitado.', 'warn');
    return false;
  }

  const fromKey = slotKey(courseId, fromDay, fromPeriodId);
  const toKey = slotKey(courseId, toDay, toPeriodId);
  const fromAssign = state.assignments[fromKey];
  const toAssign = state.assignments[toKey];

  if (!fromAssign) return false;

  const teacherA = state.teachers.find((t) => t.id === fromAssign.teacherId);

  // Validar si teacherA puede ir a (toDay, toPeriodId)
  if (isTeacherUnavailable(fromAssign.teacherId, toDay, toPeriodId)) {
    showToast(`🚫 ${teacherA ? teacherA.name : 'El profesor'} no está disponible en el bloque de destino.`, 'error');
    return false;
  }
  const conflictA = findTeacherConflict(fromAssign.teacherId, toDay, toPeriodId, courseId);
  if (conflictA) {
    const otherCourse = state.courses.find((c) => c.id === conflictA.courseId);
    showToast(
      `⚠️ No se puede mover: ${teacherA ? teacherA.name : ''} (${teacherA ? teacherA.initials : ''}) ya está en ${
        otherCourse ? otherCourse.name : 'otro curso'
      } en esa hora.`,
      'error'
    );
    return false;
  }

  // Si la celda destino tiene una clase (Enroque / Swap), validar que teacherB pueda ir a (fromDay, fromPeriodId)
  if (toAssign) {
    const teacherB = state.teachers.find((t) => t.id === toAssign.teacherId);
    if (isTeacherUnavailable(toAssign.teacherId, fromDay, fromPeriodId)) {
      showToast(`🚫 No se puede intercambiar: ${teacherB ? teacherB.name : ''} no está disponible en el bloque original.`, 'error');
      return false;
    }
    const conflictB = findTeacherConflict(toAssign.teacherId, fromDay, fromPeriodId, courseId);
    if (conflictB) {
      const otherCourse = state.courses.find((c) => c.id === conflictB.courseId);
      showToast(
        `⚠️ No se puede intercambiar: ${teacherB ? teacherB.name : ''} (${teacherB ? teacherB.initials : ''}) ya está en ${
          otherCourse ? otherCourse.name : 'otro curso'
        } en el bloque original.`,
        'error'
      );
      return false;
    }
  }

  pushUndoSnapshot();

  // Realizar el movimiento o intercambio
  state.assignments[toKey] = {
    ...fromAssign,
    dayIndex: Number(toDay),
    periodId: toPeriodId
  };

  if (toAssign) {
    state.assignments[fromKey] = {
      ...toAssign,
      dayIndex: Number(fromDay),
      periodId: fromPeriodId
    };
    showToast('🔄 Bloques intercambiados correctamente (sin topones).', 'success');
  } else {
    delete state.assignments[fromKey];
    showToast('➡️ Bloque movido correctamente.', 'info');
  }

  saveState();
  return true;
}

function assignRequirementToSlot(courseId, dayIndex, periodId, reqId, silent = false) {
  const period = state.periods.find((p) => p.id === periodId);
  if (!period || period.type === 'break') {
    if (!silent) showToast('No se pueden asignar clases en un bloque de recreo o almuerzo.', 'warn');
    return false;
  }

  if (isPeriodDisabledOnDay(period, dayIndex)) {
    if (!silent) showToast('El día Viernes la jornada de cursos es de 6 bloques (08:15 a 14:00).', 'warn');
    return false;
  }

  const req = state.requirements.find((r) => r.id === reqId);
  if (!req) return false;

  const teacher = state.teachers.find((t) => t.id === req.teacherId);
  if (!teacher) {
    if (!silent) showToast('El profesor asociado a esta asignatura no existe.', 'error');
    return false;
  }

  const targetKey = slotKey(courseId, dayIndex, periodId);
  const existingInSlot = state.assignments[targetKey];

  if (existingInSlot && existingInSlot.reqId === req.id) {
    return true;
  }

  if (isTeacherUnavailable(teacher.id, dayIndex, periodId)) {
    if (!silent) {
      const dayName = DAYS[dayIndex]?.name || '';
      showToast(
        `🚫 Bloque no disponible: ${teacher.name} (${teacher.initials}) tiene bloqueado el ${dayName} en ${period.label}.`,
        'error'
      );
    }
    return false;
  }

  const conflict = findTeacherConflict(teacher.id, dayIndex, periodId, courseId);
  if (conflict) {
    if (!silent) {
      const otherCourse = state.courses.find((c) => c.id === conflict.courseId);
      const dayName = DAYS[dayIndex]?.name || '';
      showToast(
        `⚠️ TOPÓN DE HORARIO: ${teacher.name} (${teacher.initials}) ya hace clases en ${otherCourse ? otherCourse.name : 'otro curso'} (${conflict.subject}) el ${dayName} en ${period.label}.`,
        'error'
      );
    }
    return false;
  }

  const currentReqHours = getAssignedHoursForRequirement(req.id, targetKey);
  if (currentReqHours >= req.hoursPerWeek) {
    if (!silent) {
      showToast(
        `ℹ️ "${req.subject}" ya completó sus ${req.hoursPerWeek} horas del Plan de Estudio en este curso.`,
        'warn'
      );
    }
    return false;
  }

  if (!teacher.isMultiCourseWorkshop) {
    const currentTeacherHours = getAssignedHoursForTeacher(teacher.id, targetKey);
    const effectiveMaxHours = Math.max(Number(teacher.maxHours || 0), getPlannedHoursForTeacher(teacher.id));
    if (currentTeacherHours >= effectiveMaxHours) {
      if (!silent) {
        showToast(
          `⚠️ Límite de horas lectivas: ${teacher.name} (${teacher.initials}) ya tiene ${currentTeacherHours}/${effectiveMaxHours} hrs en cursos.`,
          'error'
        );
      }
      return false;
    }
  }

  if (!silent) pushUndoSnapshot();

  state.assignments[targetKey] = {
    courseId,
    dayIndex: Number(dayIndex),
    periodId,
    reqId: req.id,
    teacherId: teacher.id,
    subject: req.subject,
    shortCode: req.shortCode || req.subject.slice(0, 4).toUpperCase()
  };

  saveState();
  return true;
}

function removeSlotAssignment(courseId, dayIndex, periodId) {
  const key = slotKey(courseId, dayIndex, periodId);
  if (state.assignments[key]) {
    pushUndoSnapshot();
    delete state.assignments[key];
    saveState();
    return true;
  }
  return false;
}

/* ==========================================================================
   AUTOCOMPLETADO INTELIGENTE DE HORARIOS (SIN TOPONES)
   ========================================================================== */
function autoScheduleForCourse(courseId, notify = true) {
  if (notify) pushUndoSnapshot();

  const classPeriods = state.periods.filter((p) => p.type !== 'break');
  const courseReqs = state.requirements.filter((r) => r.courseId === courseId);

  if (courseReqs.length === 0) {
    if (notify) showToast('Este curso no tiene asignaturas configuradas.', 'warn');
    return { added: 0, pending: 0 };
  }

  let addedCount = 0;
  const sortedReqs = [...courseReqs].sort((a, b) => b.hoursPerWeek - a.hoursPerWeek);

  for (const req of sortedReqs) {
    let assigned = getAssignedHoursForRequirement(req.id);
    let needed = req.hoursPerWeek - assigned;

    while (needed > 0) {
      let bestSlot = null;
      let bestScore = Infinity;

      for (const day of DAYS) {
        let sameSubjectOnDay = 0;
        let totalClassesOnDay = 0;

        classPeriods.forEach((p) => {
          const existing = state.assignments[slotKey(courseId, day.index, p.id)];
          if (existing) {
            totalClassesOnDay++;
            if (existing.reqId === req.id) sameSubjectOnDay++;
          }
        });

        for (let pIdx = 0; pIdx < classPeriods.length; pIdx++) {
          const period = classPeriods[pIdx];
          if (isPeriodDisabledOnDay(period, day.index)) continue;

          const key = slotKey(courseId, day.index, period.id);
          if (state.assignments[key]) continue;

          if (isTeacherUnavailable(req.teacherId, day.index, period.id)) continue;
          if (findTeacherConflict(req.teacherId, day.index, period.id, courseId)) continue;

          const teacher = state.teachers.find((t) => t.id === req.teacherId);
          if (!teacher) continue;
          const effectiveMaxHours = Math.max(Number(teacher.maxHours || 0), getPlannedHoursForTeacher(teacher.id));
          if (!teacher.isMultiCourseWorkshop && getAssignedHoursForTeacher(teacher.id) >= effectiveMaxHours) {
            continue;
          }

          let adjacentBonus = 0;
          const prevPeriod = classPeriods[pIdx - 1];
          if (prevPeriod) {
            const prevAssign = state.assignments[slotKey(courseId, day.index, prevPeriod.id)];
            if (prevAssign && prevAssign.reqId === req.id && sameSubjectOnDay === 1) {
              adjacentBonus = -40;
            }
          }

          const score = (sameSubjectOnDay >= 2 ? 500 : 0) + sameSubjectOnDay * 80 + totalClassesOnDay * 3 + pIdx + adjacentBonus;
          if (score < bestScore) {
            bestScore = score;
            bestSlot = { dayIndex: day.index, periodId: period.id };
          }
        }
      }

      if (bestSlot) {
        const ok = assignRequirementToSlot(courseId, bestSlot.dayIndex, bestSlot.periodId, req.id, true);
        if (ok) {
          addedCount++;
          needed--;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  const totalRequired = courseReqs.reduce((acc, r) => acc + Number(r.hoursPerWeek), 0);
  const totalAssigned = courseReqs.reduce((acc, r) => acc + getAssignedHoursForRequirement(r.id), 0);
  const pending = Math.max(0, totalRequired - totalAssigned);

  if (notify) {
    if (pending === 0) {
      showToast(`✅ Horario completado (${addedCount} bloques nuevos asignados, 0 topones).`, 'success');
    } else {
      showToast(
        `ℹ️ Se asignaron ${addedCount} bloques sin topones. Quedan ${pending} bloques por asignar.`,
        'warn'
      );
    }
  }

  renderAll();
  return { added: addedCount, pending };
}

function autoScheduleAllCourses() {
  pushUndoSnapshot();
  let totalAdded = 0;
  let totalPending = 0;
  state.courses.forEach((course) => {
    const res = autoScheduleForCourse(course.id, false);
    totalAdded += res.added;
    totalPending += res.pending;
  });
  renderAll();
  if (totalPending === 0) {
    showToast(`🚀 Todos los cursos (1º a 8º) están al 100% con 0 topones.`, 'success');
  } else {
    showToast(
      `🚀 Se asignaron ${totalAdded} bloques nuevos. Quedan ${totalPending} bloques pendientes por disponibilidad.`,
      'warn'
    );
  }
}

/* ==========================================================================
   RENDERIZADO DE LA INTERFAZ
   ========================================================================== */
function updateGlobalCounters() {
  document.getElementById('navCountProfesores').textContent = state.teachers.length;
  document.getElementById('navCountCursos').textContent = state.courses.length;

  const conflicts = scanAllConflicts();
  const badge = document.getElementById('globalConflictBadge');
  const text = document.getElementById('globalConflictText');
  const dot = badge.querySelector('.dot');

  if (conflicts.length === 0) {
    dot.className = 'dot ok';
    text.textContent = '0 Topones detectados';
  } else {
    dot.className = 'dot error';
    text.textContent = `${conflicts.length} Topón(es) detectado(s)`;
  }
}

