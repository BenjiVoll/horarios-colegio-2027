/**
 * Módulo Central de Validaciones y Sanitización — Sistema de Gestión de Horarios
 * Valida formularios, datos numéricos, integridad referencial, URLs y respaldos JSON.
 */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

function isValidHttpsUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    return u.protocol === 'https:' && Boolean(u.hostname);
  } catch {
    return false;
  }
}

function isValidHexColor(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || '').trim());
}

function isValidTimeHHMM(val) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(val || '').trim());
}

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calcula el total de bloques semanales de clases disponibles según la estructura de la jornada.
 */
function getTotalWeeklyClassSlots(periodsList) {
  const list = Array.isArray(periodsList) ? periodsList : [];
  if (list.length === 0) return 38;
  const monThuCount = list.filter((p) => p.type !== 'break').length;
  const friCount = list.filter((p) => p.type === 'class').length;
  return monThuCount * 4 + friCount;
}

/**
 * Parsea un entero acotado sin caer en la trampa de `Number(0) || default`.
 */
function parseBoundedInt(raw, min, max, fieldLabel) {
  const str = String(raw ?? '').trim();
  if (str === '') {
    return { ok: false, error: `El campo "${fieldLabel}" es obligatorio.` };
  }
  const num = Number(str);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { ok: false, error: `"${fieldLabel}" debe ser un número entero válido.` };
  }
  if (num < min || num > max) {
    return { ok: false, error: `"${fieldLabel}" debe estar entre ${min} y ${max}.` };
  }
  return { ok: true, value: num };
}

function markFieldInvalid(inputId) {
  if (!inputId) return;
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.add('input-invalid');
  el.focus();
  const clear = () => {
    el.classList.remove('input-invalid');
    el.removeEventListener('input', clear);
    el.removeEventListener('change', clear);
  };
  el.addEventListener('input', clear);
  el.addEventListener('change', clear);
}

/**
 * Valida la creación/edición de un docente.
 */
function validateTeacherPayload(raw, teachersList, editingId = '') {
  const initials = String(raw.initials || '').trim().toUpperCase();
  const name = String(raw.name || '').trim();
  const specialty = String(raw.specialty || '').trim();
  const pieInfo = String(raw.pieInfo || '').trim();
  const sepDetail = String(raw.sepDetail || '').trim();
  const nonTeachingDetail = String(raw.nonTeachingDetail || '').trim();
  const color = isValidHexColor(raw.color) ? raw.color : '#2563eb';

  if (!initials || !/^[A-Z0-9ÑÁÉÍÓÚ]{1,5}$/.test(initials)) {
    return {
      ok: false,
      fieldId: 'teacherInitialsInput',
      error: 'La sigla debe tener entre 1 y 5 letras o números (sin espacios ni símbolos).'
    };
  }

  const dupInitials = (teachersList || []).find(
    (t) => t.id !== editingId && String(t.initials || '').trim().toUpperCase() === initials
  );
  if (dupInitials) {
    return {
      ok: false,
      fieldId: 'teacherInitialsInput',
      error: `La sigla "${initials}" ya pertenece a ${dupInitials.name}. Usa una sigla distinta.`
    };
  }

  if (name.length < 3 || name.length > 80) {
    return {
      ok: false,
      fieldId: 'teacherNameInput',
      error: 'El nombre completo del profesor debe tener entre 3 y 80 caracteres.'
    };
  }

  if (specialty.length < 2 || specialty.length > 100) {
    return {
      ok: false,
      fieldId: 'teacherSpecialtyInput',
      error: 'La especialidad / jefatura debe tener entre 2 y 100 caracteres.'
    };
  }

  const maxH = parseBoundedInt(raw.maxHours, 0, 44, 'Hrs Máx. Cursos (1º-8º)');
  if (!maxH.ok) return { ok: false, fieldId: 'teacherMaxHoursInput', error: maxH.error };

  const otherH = parseBoundedInt(raw.otherLectivasHours === '' ? 0 : raw.otherLectivasHours, 0, 44, 'Otras Lectivas (Kº/CRA)');
  if (!otherH.ok) return { ok: false, fieldId: 'teacherOtherLectivasInput', error: otherH.error };

  const sepH = parseBoundedInt(raw.sepHours === '' ? 0 : raw.sepHours, 0, 30, 'Horas SEP');
  if (!sepH.ok) return { ok: false, fieldId: 'teacherSepHoursInput', error: sepH.error };

  const contractH = parseBoundedInt(raw.contractChrono, 1, 44, 'Contrato (Hrs Cronológicas)');
  if (!contractH.ok) return { ok: false, fieldId: 'teacherContractChronoInput', error: contractH.error };

  if (pieInfo.length > 60) {
    return { ok: false, fieldId: 'teacherPieHoursInput', error: 'El campo PIE / Observación no puede superar 60 caracteres.' };
  }
  if (sepDetail.length > 350) {
    return { ok: false, fieldId: 'teacherSepDetailInput', error: 'El detalle SEP no puede superar 350 caracteres.' };
  }
  if (nonTeachingDetail.length > 350) {
    return { ok: false, fieldId: 'teacherNonTeachingInput', error: 'El detalle de actividades no lectivas no puede superar 350 caracteres.' };
  }

  return {
    ok: true,
    data: {
      initials,
      name,
      specialty,
      maxHours: maxH.value,
      otherLectivasHours: otherH.value,
      sepHours: sepH.value,
      contractChrono: contractH.value,
      pieInfo,
      sepDetail,
      nonTeachingDetail,
      color
    }
  };
}

/**
 * Valida nombre de curso (creación o edición).
 */
function validateCourseName(rawName, coursesList, editingId = '', fieldId = 'courseNameInput') {
  const name = String(rawName || '').trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, fieldId, error: 'El nombre del curso debe tener entre 2 y 60 caracteres.' };
  }
  const dup = (coursesList || []).find(
    (c) => c.id !== editingId && String(c.name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (dup) {
    return { ok: false, fieldId, error: `Ya existe un curso llamado "${dup.name}".` };
  }
  return { ok: true, value: name };
}

/**
 * Valida una asignatura del Plan de Estudio (creación o edición).
 */
function validateRequirementPayload(raw, stateRef, courseId, editingId = '') {
  const subject = String(raw.subject || '').trim();
  const shortCode = String(raw.shortCode || '').trim().toUpperCase();
  const teacherId = String(raw.teacherId || '').trim();
  const room = String(raw.room || '').trim();

  if (subject.length < 2 || subject.length > 80) {
    return { ok: false, fieldId: 'reqSubjectInput', error: 'El nombre de la asignatura debe tener entre 2 y 80 caracteres.' };
  }
  if (!shortCode || !/^[A-Z0-9ÑÁÉÍÓÚ._-]{1,6}$/.test(shortCode)) {
    return { ok: false, fieldId: 'reqShortCodeInput', error: 'La sigla del ramo debe tener entre 1 y 6 caracteres (sin espacios).' };
  }
  if (!teacherId || !(stateRef.teachers || []).some((t) => t.id === teacherId)) {
    return { ok: false, fieldId: 'reqTeacherSelect', error: 'Debes seleccionar un profesor encargado válido.' };
  }

  const hrs = parseBoundedInt(raw.hoursPerWeek, 1, 20, 'Hrs Semanales');
  if (!hrs.ok) return { ok: false, fieldId: 'reqHoursInput', error: hrs.error };

  if (room.length > 50) {
    return { ok: false, fieldId: 'reqRoomInput', error: 'El nombre de la sala / espacio no puede superar 50 caracteres.' };
  }

  const dupSubject = (stateRef.requirements || []).find(
    (r) =>
      r.courseId === courseId &&
      r.id !== editingId &&
      String(r.subject || '').trim().toLowerCase() === subject.toLowerCase()
  );
  if (dupSubject) {
    return {
      ok: false,
      fieldId: 'reqSubjectInput',
      error: `La asignatura "${dupSubject.subject}" ya existe en el plan de este curso. Edítala en lugar de duplicarla.`
    };
  }

  // Validar que la suma total de horas del plan del curso no supere los bloques semanales de la jornada
  const maxWeeklySlots = getTotalWeeklyClassSlots(stateRef.periods);
  const otherReqsHours = (stateRef.requirements || [])
    .filter((r) => r.courseId === courseId && r.id !== editingId)
    .reduce((acc, r) => acc + Number(r.hoursPerWeek || 0), 0);
  if (otherReqsHours + hrs.value > maxWeeklySlots) {
    const remaining = Math.max(0, maxWeeklySlots - otherReqsHours);
    return {
      ok: false,
      fieldId: 'reqHoursInput',
      error: `El plan de este curso sumaría ${otherReqsHours + hrs.value} hrs y supera el tope semanal de ${maxWeeklySlots} bloques (disponibles: ${remaining}h).`
    };
  }

  // Si se edita una asignatura existente, validar que no queden más horas asignadas en calendario que el nuevo plan
  if (editingId) {
    const alreadyAssigned = getAssignedHoursForRequirement(editingId);
    if (hrs.value < alreadyAssigned) {
      return {
        ok: false,
        fieldId: 'reqHoursInput',
        error: `No puedes bajar las horas a ${hrs.value}h porque ya hay ${alreadyAssigned} bloques asignados en el horario. Quita bloques primero.`
      };
    }
  }

  return {
    ok: true,
    data: {
      subject,
      shortCode,
      teacherId,
      hoursPerWeek: hrs.value,
      room
    }
  };
}

/**
 * Valida la creación de un bloque horario o recreo.
 */
function validatePeriodPayload(raw, periodsList) {
  const label = String(raw.label || '').trim();
  const start = String(raw.start || '').trim();
  const end = String(raw.end || '').trim();
  const type = String(raw.type || '').trim();
  const allowedTypes = ['class', 'class_mon_thu', 'break'];

  if (label.length < 2 || label.length > 60) {
    return { ok: false, fieldId: 'periodLabelInput', error: 'El nombre del bloque debe tener entre 2 y 60 caracteres.' };
  }
  if (!isValidTimeHHMM(start)) {
    return { ok: false, fieldId: 'periodStartInput', error: 'La hora de inicio debe tener formato válido HH:MM.' };
  }
  if (!isValidTimeHHMM(end)) {
    return { ok: false, fieldId: 'periodEndInput', error: 'La hora de término debe tener formato válido HH:MM.' };
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    return {
      ok: false,
      fieldId: 'periodEndInput',
      error: `La hora de término (${end}) debe ser posterior a la hora de inicio (${start}).`
    };
  }
  if (!allowedTypes.includes(type)) {
    return { ok: false, fieldId: 'periodTypeSelect', error: 'Tipo de bloque no válido.' };
  }

  const dupLabel = (periodsList || []).find(
    (p) => String(p.label || '').trim().toLowerCase() === label.toLowerCase()
  );
  if (dupLabel) {
    return { ok: false, fieldId: 'periodLabelInput', error: `Ya existe un bloque llamado "${dupLabel.label}".` };
  }

  return { ok: true, data: { label, start, end, type } };
}

/**
 * Valida un año escolar (4 dígitos entre 2020 y 2099).
 */
function validateSchoolYearInput(rawYear) {
  const str = String(rawYear ?? '').trim();
  if (!/^[0-9]{4}$/.test(str)) {
    return { ok: false, fieldId: 'inputNewSchoolYear', error: 'El año escolar debe tener exactamente 4 dígitos (ej. 2028).' };
  }
  const y = Number(str);
  if (y < 2020 || y > 2099) {
    return { ok: false, fieldId: 'inputNewSchoolYear', error: 'El año escolar debe estar entre 2020 y 2099.' };
  }
  return { ok: true, value: str };
}

/**
 * Valida profundamente un archivo de respaldo JSON antes de reemplazar el estado global.
 */
function validateImportedBackupData(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'El archivo JSON no contiene un objeto de respaldo válido.' };
  }
  if (!Array.isArray(parsed.teachers) || !Array.isArray(parsed.courses) || !Array.isArray(parsed.periods) || !Array.isArray(parsed.requirements)) {
    return { ok: false, error: 'El respaldo está incompleto (faltan listas de teachers, courses, periods o requirements).' };
  }
  if (parsed.assignments !== undefined && (typeof parsed.assignments !== 'object' || parsed.assignments === null || Array.isArray(parsed.assignments))) {
    return { ok: false, error: 'El campo "assignments" del respaldo tiene un formato inválido.' };
  }
  if (parsed.teacherUnavailable !== undefined && (typeof parsed.teacherUnavailable !== 'object' || parsed.teacherUnavailable === null || Array.isArray(parsed.teacherUnavailable))) {
    return { ok: false, error: 'El campo "teacherUnavailable" del respaldo tiene un formato inválido.' };
  }

  const invalidTeacher = parsed.teachers.find((t) => !t || !t.id || !t.name);
  if (invalidTeacher) {
    return { ok: false, error: 'El respaldo contiene un registro de profesor sin id o nombre.' };
  }
  const invalidCourse = parsed.courses.find((c) => !c || !c.id || !c.name);
  if (invalidCourse) {
    return { ok: false, error: 'El respaldo contiene un registro de curso sin id o nombre.' };
  }
  const invalidPeriod = parsed.periods.find((p) => !p || !p.id || !p.label);
  if (invalidPeriod) {
    return { ok: false, error: 'El respaldo contiene un bloque horario inválido.' };
  }

  return { ok: true };
}
