/**
 * Sistema de Gestión de Horarios Escolares
 * Dirección y UTP — Planificación Académica, Cursos (1º a 8º Básico), Panorama General y Carga Docente (65/35)
 */

// URL de Firebase Realtime Database y Credenciales de Autenticación (Firebase Auth)
const DEFAULT_FIREBASE_DB_URL = 'https://horarios-colegio-bc2db-default-rtdb.firebaseio.com';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyCNclZbblM7WV-TgYvcE9hAgsO2puyMybw';
const FIREBASE_URL_STORAGE_KEY = 'eduhorario_firebase_db_url_v1';
const FIREBASE_API_KEY_STORAGE_KEY = 'eduhorario_firebase_api_key_v1';
const AUTH_SESSION_STORAGE_KEY = 'eduhorario_auth_session_v1';
const SESSION_INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 minutos de inactividad máxima

const ACTIVE_YEAR_KEY = 'eduhorario_active_school_year_v4';
const STORAGE_PREFIX = 'eduhorario_school_data_v4_';
const CLIENT_SESSION_ID = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

let authSession = null;
let inactivityTimer = null;
let tokenRefreshTimer = null;

const DAYS = [
  { index: 0, name: 'Lunes', short: 'LUN', maxClassBlocks: 8 },
  { index: 1, name: 'Martes', short: 'MAR', maxClassBlocks: 8 },
  { index: 2, name: 'Miércoles', short: 'MIÉ', maxClassBlocks: 8 },
  { index: 3, name: 'Jueves', short: 'JUE', maxClassBlocks: 8 },
  { index: 4, name: 'Viernes', short: 'VIE', maxClassBlocks: 6 }
];

let currentSchoolYear = '2026';
let undoStack = [];
let cloudSyncTimer = null;
let isPushingToCloud = false;
let hasUnsavedChanges = false;

// Estado global
let state = {
  teachers: [],
  courses: [],
  periods: [],
  requirements: [],
  assignments: {},
  teacherUnavailable: {},
  updatedAt: 0,
  clientId: CLIENT_SESSION_ID
};

// Estado de interfaz (UI)
let ui = {
  activeCourseId: null,
  selectedPlanCourseId: null,
  selectedPaletteReqId: null,
  activeViewTeacherId: null,
  availabilityEditMode: false,
  modalTargetSlot: null,
  panoramaActiveDay: '0', // '0'..'4' o 'WEEK'
  panoramaHighlightTeacherId: ''
};

/* ==========================================================================
   HISTORIAL PARA DESHACER (UNDO)
   ========================================================================== */
function pushUndoSnapshot() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 25) {
    undoStack.shift();
  }
  updateUndoButton();
}

function performUndo() {
  if (undoStack.length === 0) return;
  const previousJson = undoStack.pop();
  try {
    state = JSON.parse(previousJson);
    saveState();
    renderAll();
    showToast('↩️ Se deshizo el último cambio.', 'info');
  } catch (err) {
    console.error('Error al deshacer:', err);
  }
  updateUndoButton();
}

function updateUndoButton() {
  const btn = document.getElementById('btnUndo');
  if (btn) {
    btn.disabled = undoStack.length === 0;
  }
}

/* ==========================================================================
   DATOS INSTITUCIONALES BASE (2026 COMPLETO / 2027 PLANTILLA DESDE CERO)
   ========================================================================== */
function getInstitutionalBaseData(includeScheduleAssignments = true) {
  const periods = [
    { id: 'p1', num: 1, label: 'Bloque 1', start: '08:15', end: '09:00', friStart: '08:15', friEnd: '09:00', type: 'class' },
    { id: 'p2', num: 2, label: 'Bloque 2', start: '09:00', end: '09:45', friStart: '09:00', friEnd: '09:45', type: 'class' },
    { id: 'b1', num: null, label: 'RECREO 1', start: '09:45', end: '10:05', friStart: '09:45', friEnd: '10:15', type: 'break' },
    { id: 'p3', num: 3, label: 'Bloque 3', start: '10:05', end: '10:50', friStart: '10:15', friEnd: '11:00', type: 'class' },
    { id: 'p4', num: 4, label: 'Bloque 4', start: '10:50', end: '11:35', friStart: '11:00', friEnd: '11:45', type: 'class' },
    { id: 'b2', num: null, label: 'RECREO 2 (Vie: Almuerzo)', start: '11:35', end: '11:55', friStart: '11:45', friEnd: '12:30', type: 'break' },
    { id: 'p5', num: 5, label: 'Bloque 5', start: '11:55', end: '12:40', friStart: '12:30', friEnd: '13:15', type: 'class' },
    { id: 'p6', num: 6, label: 'Bloque 6', start: '12:40', end: '13:25', friStart: '13:15', friEnd: '14:00', type: 'class' },
    { id: 'b3', num: null, label: 'ALMUERZO (Lun a Jue)', start: '13:25', end: '14:10', friStart: '14:00', friEnd: 'Salida', type: 'break' },
    { id: 'p7', num: 7, label: 'Bloque 7', start: '14:10', end: '14:55', friStart: '—', friEnd: '—', type: 'class_mon_thu' },
    { id: 'p8', num: 8, label: 'Bloque 8', start: '14:55', end: '15:40', friStart: '—', friEnd: '—', type: 'class_mon_thu' }
  ];

  const teachers = [
    {
      id: 't_ml',
      initials: 'ML',
      name: 'MELISSA LUENGO',
      specialty: 'JEFATURA 1º AÑO — Ed. Básica',
      maxHours: 29,
      otherLectivasHours: 0,
      sepHours: 0,
      contractChrono: 37,
      pieInfo: '3 PIE',
      sepDetail: 'Lenguaje 1º (8h), Matemática 1º (6h), Historia 1º (3h), Cs. Naturales 1º (3h), Artes 1º (2h), Orientación 1º (1h), Tecnología 1º, 2º, 3º, 4º, 5º y 8º (6h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Plan Local | DPD Evaluación Docente | Atención Apoderados',
      color: '#2563eb'
    },
    {
      id: 't_dj',
      initials: 'DJ',
      name: 'DANIELA JEREZ',
      specialty: 'JEFATURA 2º AÑO — Ed. Básica',
      maxHours: 22,
      otherLectivasHours: 0,
      sepHours: 8,
      contractChrono: 38,
      pieInfo: '3 PIE',
      sepDetail: 'SEP: Co-docencia Lenguaje 4º Básico (8 hrs pedagógicas).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#0891b2'
    },
    {
      id: 't_ac',
      initials: 'AC',
      name: 'ARIEL CÁRDENAS',
      specialty: 'JEFATURA 3º AÑO — Ed. Básica / Artes',
      maxHours: 27,
      otherLectivasHours: 0,
      sepHours: 6,
      contractChrono: 41,
      pieInfo: '3 PIE',
      sepDetail: 'SEP: Taller Manualidades 1º Ciclo (4h) + Taller Electivo Artístico Visual 2º Ciclo (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#16a34a'
    },
    {
      id: 't_kh',
      initials: 'KH',
      name: 'KATHERINE HENRÍQUEZ',
      specialty: 'Ed. Básica / Coordinación CRA',
      maxHours: 22,
      otherLectivasHours: 10,
      sepHours: 0,
      contractChrono: 26,
      pieInfo: '3 PIE',
      sepDetail: 'Otras Lectivas: Coordinación CRA (10 hrs pedagógicas) + Lenguaje 8º (6h), Orientación 8º (1h), Cs. Naturales 4º (3h), Artes 4º (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#9333ea'
    },
    {
      id: 't_mp',
      initials: 'MP',
      name: 'MANUEL PARRA',
      specialty: 'JEFATURA 5º AÑO — Matemática / Cs. Naturales',
      maxHours: 29,
      otherLectivasHours: 0,
      sepHours: 6,
      contractChrono: 44,
      pieInfo: '3 PIE',
      sepDetail: 'SEP: Co-docencia Matemática 4º (4h) + Taller Electivo Fútbol 5º y 6º Martes (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#0284c7'
    },
    {
      id: 't_ff',
      initials: 'FF',
      name: 'FABIÁN FIGUEROA',
      specialty: 'JEFATURA 6º AÑO — Lenguaje / Historia',
      maxHours: 34,
      otherLectivasHours: 0,
      sepHours: 0,
      contractChrono: 42,
      pieInfo: '3 PIE',
      sepDetail: 'Lenguaje 4º (8h), Lenguaje 5º (6h), Lenguaje 6º (6h), Historia 6º (4h), Historia 7º (4h), Historia 8º (4h), Tecnología 6º (1h), Orientación 6º (1h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#dc2626'
    },
    {
      id: 't_tc',
      initials: 'TC',
      name: 'TAMARA CAMUS',
      specialty: 'JEFATURA 7º AÑO — Lenguaje / Ciencias / Historia',
      maxHours: 22,
      otherLectivasHours: 0,
      sepHours: 8,
      contractChrono: 38,
      pieInfo: '3 PIE',
      sepDetail: 'SEP: Taller Música en Colores 1º Ciclo (4h) + Co-docencia Lenguaje 3º (2h) + Co-docencia Matemática 4º (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#ea580c'
    },
    {
      id: 't_ps',
      initials: 'PS',
      name: 'PEDRO SILVA',
      specialty: 'RELIGIÓN / MATEMÁTICA',
      maxHours: 28,
      otherLectivasHours: 0,
      sepHours: 6,
      contractChrono: 42,
      pieInfo: '3 PIE',
      sepDetail: 'SEP: Taller Rotativo Bíblico 2º Ciclo Jueves (2h) + Co-docencia Matemática 3º Año (4h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#ca8a04'
    },
    {
      id: 't_fa',
      initials: 'FA',
      name: 'FRANCISCO AGUILERA',
      specialty: 'EDUCACIÓN FÍSICA (Kº a 8º)',
      maxHours: 26,
      otherLectivasHours: 2,
      sepHours: 4,
      contractChrono: 35,
      pieInfo: '',
      sepDetail: 'Otras Lectivas: Ed. Física Kº (2h). SEP: Taller Electivo Act. Física y Motricidad 1º Ciclo Martes (2h) y Jueves (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#0d9488'
    },
    {
      id: 't_ap',
      initials: 'AP',
      name: 'ANGELA PETERS',
      specialty: 'INGLÉS (Kº a 8º)',
      maxHours: 26,
      otherLectivasHours: 2,
      sepHours: 2,
      contractChrono: 32,
      pieInfo: '',
      sepDetail: 'Otras Lectivas: Inglés Kº (2h). SEP: Taller Rotativo Inglés 2º Ciclo Jueves (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#7c3aed'
    },
    {
      id: 't_vm',
      initials: 'VM',
      name: 'VALESKA MARTÍNEZ',
      specialty: 'MÚSICA (1º a 8º)',
      maxHours: 16,
      otherLectivasHours: 0,
      sepHours: 6,
      contractChrono: 26,
      pieInfo: '',
      sepDetail: 'SEP: Taller Electivo Coro 1º Ciclo Martes (2h) y Jueves (2h) + Taller Electivo Coro 2º Ciclo (2h).',
      nonTeachingDetail: 'Planificación 40% | Consejo Profesores | DPD Depto/ABP | DPD Evaluación Docente | Atención Apoderados',
      color: '#db2777'
    },
    {
      id: 't_bt',
      initials: 'BT',
      name: 'PROF. HISTORIA 5º (BT)',
      specialty: 'HISTORIA 5º BÁSICO',
      maxHours: 10,
      otherLectivasHours: 0,
      sepHours: 0,
      contractChrono: 10,
      pieInfo: '',
      sepDetail: 'Historia, Geografía y Cs. Sociales 5º Básico (4h).',
      nonTeachingDetail: '',
      color: '#6366f1'
    },
    {
      id: 't_rc',
      initials: 'RC',
      name: 'ORIENTACIÓN / CONVIVENCIA (RC)',
      specialty: 'ORIENTACIÓN 4º BÁSICO',
      maxHours: 10,
      otherLectivasHours: 0,
      sepHours: 0,
      contractChrono: 10,
      pieInfo: '',
      sepDetail: 'Orientación 4º Básico (1h) y apoyo convivencia/orientación.',
      nonTeachingDetail: '',
      color: '#475569'
    },
    {
      id: 't_taller',
      initials: 'T',
      name: 'EQUIPO TALLERES SEP (1º y 2º CICLO)',
      specialty: 'TALLERES ELECTIVOS Y ROTATIVOS (Bloque Simultáneo)',
      maxHours: 32,
      otherLectivasHours: 0,
      sepHours: 0,
      contractChrono: 32,
      pieInfo: 'Simultáneo por Ciclo',
      isMultiCourseWorkshop: true,
      sepDetail: '1º Ciclo (1º a 4º): Martes y Jueves Bloques 5-6 | 2º Ciclo (5º a 8º): Martes y Jueves Bloques 7-8.',
      nonTeachingDetail: '',
      color: '#64748b'
    }
  ];

  const courses = [
    { id: 'c1', short: '1º', name: '1º Año Básico' },
    { id: 'c2', short: '2º', name: '2º Año Básico' },
    { id: 'c3', short: '3º', name: '3º Año Básico' },
    { id: 'c4', short: '4º', name: '4º Año Básico' },
    { id: 'c5', short: '5º', name: '5º Año Básico' },
    { id: 'c6', short: '6º', name: '6º Año Básico' },
    { id: 'c7', short: '7º', name: '7º Año Básico' },
    { id: 'c8', short: '8º', name: '8º Año Básico' }
  ];

  const coursePlans = {
    c1: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_ml', hoursPerWeek: 8 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_ml', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_ml', hoursPerWeek: 3 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_ml', hoursPerWeek: 3 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ml', hoursPerWeek: 2 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c2: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_dj', hoursPerWeek: 8 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_dj', hoursPerWeek: 6 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_dj', hoursPerWeek: 3 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_dj', hoursPerWeek: 1 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_tc', hoursPerWeek: 3 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c3: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_ac', hoursPerWeek: 8 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_mp', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_ac', hoursPerWeek: 3 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_ac', hoursPerWeek: 3 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_ac', hoursPerWeek: 1 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c4: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_ff', hoursPerWeek: 8 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_ps', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_tc', hoursPerWeek: 3 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_kh', hoursPerWeek: 3 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_kh', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_rc', hoursPerWeek: 1 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c5: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_ff', hoursPerWeek: 6 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_mp', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_bt', hoursPerWeek: 4 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_mp', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 4 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_mp', hoursPerWeek: 1 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS / ROTATIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c6: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_ff', hoursPerWeek: 6 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_ps', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_ff', hoursPerWeek: 4 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_tc', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 4 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ff', hoursPerWeek: 1 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_ff', hoursPerWeek: 1 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS / ROTATIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c7: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_tc', hoursPerWeek: 6 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_mp', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_ff', hoursPerWeek: 4 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_tc', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 4 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_tc', hoursPerWeek: 1 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_tc', hoursPerWeek: 1 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS / ROTATIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ],
    c8: [
      { shortCode: 'LENG', subject: 'LENGUAJE Y COMUNICACIÓN', teacherId: 't_kh', hoursPerWeek: 6 },
      { shortCode: 'MAT', subject: 'MATEMÁTICA', teacherId: 't_mp', hoursPerWeek: 6 },
      { shortCode: 'HIST', subject: 'HISTORIA, GEO. Y CS. SOCIALES', teacherId: 't_ff', hoursPerWeek: 4 },
      { shortCode: 'CN', subject: 'CIENCIAS NATURALES', teacherId: 't_dj', hoursPerWeek: 4 },
      { shortCode: 'ING', subject: 'INGLÉS', teacherId: 't_ap', hoursPerWeek: 4 },
      { shortCode: 'ART', subject: 'ARTES VISUALES', teacherId: 't_ac', hoursPerWeek: 2 },
      { shortCode: 'MUS', subject: 'MÚSICA', teacherId: 't_vm', hoursPerWeek: 2 },
      { shortCode: 'EF', subject: 'EDUCACIÓN FÍSICA', teacherId: 't_fa', hoursPerWeek: 2 },
      { shortCode: 'REL', subject: 'RELIGIÓN', teacherId: 't_ps', hoursPerWeek: 2 },
      { shortCode: 'TEC', subject: 'TECNOLOGÍA', teacherId: 't_ml', hoursPerWeek: 1 },
      { shortCode: 'ORI', subject: 'ORIENTACIÓN', teacherId: 't_kh', hoursPerWeek: 1 },
      { shortCode: 'T', subject: 'TALLERES ELECTIVOS / ROTATIVOS', teacherId: 't_taller', hoursPerWeek: 4 }
    ]
  };

  const requirements = [];
  const reqByCourseAndCode = {};

  Object.keys(coursePlans).forEach((courseId) => {
    coursePlans[courseId].forEach((item) => {
      const id = `req_${courseId}_${item.shortCode}`;
      const reqObj = {
        id,
        courseId,
        shortCode: item.shortCode,
        subject: item.subject,
        teacherId: item.teacherId,
        hoursPerWeek: item.hoursPerWeek
      };
      requirements.push(reqObj);
      reqByCourseAndCode[`${courseId}__${item.shortCode}`] = reqObj;
    });
  });

  const assignments = {};

  if (includeScheduleAssignments) {
    const initialSchedules = {
      c1: [
        ['MAT', 'MAT', 'LENG', 'LENG', 'EF', 'EF', 'CN', 'CN'],
        ['LENG', 'LENG', 'MAT', 'MAT', 'T', 'T', 'ORI', 'CN'],
        ['LENG', 'LENG', 'ING', 'ING', 'EF', 'EF', 'REL', 'REL'],
        ['MAT', 'MAT', 'HIST', 'HIST', 'T', 'T', 'ART', 'ART'],
        ['LENG', 'LENG', 'MUS', 'MUS', 'HIST', 'TEC']
      ],
      c2: [
        ['ING', 'ING', 'LENG', 'LENG', 'CN', 'CN', 'ART', 'ART'],
        ['MUS', 'MUS', 'MAT', 'MAT', 'T', 'T', 'CN', 'ORI'],
        ['LENG', 'LENG', 'EF', 'EF', 'HIST', 'TEC', 'MAT', 'MAT'],
        ['MAT', 'MAT', 'LENG', 'LENG', 'T', 'T', 'EF', 'EF'],
        ['HIST', 'HIST', 'LENG', 'LENG', 'REL', 'REL']
      ],
      c3: [
        ['MAT', 'MAT', 'EF', 'EF', 'LENG', 'LENG', 'ING', 'ING'],
        ['LENG', 'LENG', 'MAT', 'MAT', 'T', 'T', 'REL', 'REL'],
        ['LENG', 'LENG', 'MAT', 'MAT', 'CN', 'HIST', 'ART', 'ART'],
        ['LENG', 'LENG', 'EF', 'EF', 'T', 'T', 'CN', 'CN'],
        ['HIST', 'HIST', 'ORI', 'TEC', 'MUS', 'MUS']
      ],
      c4: [
        ['LENG', 'LENG', 'MAT', 'MAT', 'ING', 'ING', 'CN', 'CN'],
        ['LENG', 'LENG', 'EF', 'EF', 'T', 'T', 'HIST', 'HIST'],
        ['MAT', 'MAT', 'ART', 'ART', 'TEC', 'HIST', 'EF', 'EF'],
        ['MUS', 'MUS', 'MAT', 'MAT', 'T', 'T', 'LENG', 'LENG'],
        ['LENG', 'LENG', 'REL', 'REL', 'CN', 'ORI']
      ],
      c5: [
        ['ART', 'ART', 'LENG', 'LENG', 'MUS', 'MUS', 'MAT', 'MAT'],
        ['MAT', 'MAT', 'LENG', 'LENG', 'REL', 'REL', 'T', 'T'],
        ['EF', 'EF', 'HIST', 'HIST', 'ING', 'ING', 'TEC', 'ORI'],
        ['ING', 'ING', 'CN', 'CN', 'LENG', 'LENG', 'T', 'T'],
        ['MAT', 'MAT', 'HIST', 'HIST', 'CN', 'CN']
      ],
      c6: [
        ['MAT', 'MAT', 'ART', 'ART', 'HIST', 'HIST', 'MUS', 'MUS'],
        ['CN', 'CN', 'ING', 'ING', 'LENG', 'LENG', 'T', 'T'],
        ['ING', 'ING', 'LENG', 'LENG', 'HIST', 'HIST', 'CN', 'CN'],
        ['MAT', 'MAT', 'LENG', 'LENG', 'REL', 'REL', 'T', 'T'],
        ['MAT', 'MAT', 'EF', 'EF', 'TEC', 'ORI']
      ],
      c7: [
        ['ORI', 'TEC', 'LENG', 'LENG', 'REL', 'REL', 'EF', 'EF'],
        ['ING', 'ING', 'CN', 'CN', 'MAT', 'MAT', 'T', 'T'],
        ['HIST', 'HIST', 'LENG', 'LENG', 'MAT', 'MAT', 'ING', 'ING'],
        ['HIST', 'HIST', 'ART', 'ART', 'MAT', 'MAT', 'T', 'T'],
        ['MUS', 'MUS', 'LENG', 'LENG', 'CN', 'CN']
      ],
      c8: [
        ['LENG', 'LENG', 'ING', 'ING', 'MAT', 'MAT', 'HIST', 'HIST'],
        ['LENG', 'LENG', 'ART', 'ART', 'ORI', 'TEC', 'T', 'T'],
        ['LENG', 'LENG', 'CN', 'CN', 'REL', 'REL', 'HIST', 'HIST'],
        ['MAT', 'MAT', 'MUS', 'MUS', 'CN', 'CN', 'T', 'T'],
        ['ING', 'ING', 'MAT', 'MAT', 'EF', 'EF']
      ]
    };

    const classPeriodIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

    Object.keys(initialSchedules).forEach((courseId) => {
      const daysMatrix = initialSchedules[courseId];
      daysMatrix.forEach((dayBlocks, dayIndex) => {
        dayBlocks.forEach((shortCode, blockIdx) => {
          const periodId = classPeriodIds[blockIdx];
          const req = reqByCourseAndCode[`${courseId}__${shortCode}`];
          if (req && periodId) {
            assignments[`${courseId}__${dayIndex}__${periodId}`] = {
              courseId,
              dayIndex,
              periodId,
              reqId: req.id,
              teacherId: req.teacherId,
              subject: req.subject,
              shortCode: req.shortCode
            };
          }
        });
      });
    });
  }

  return {
    teachers,
    courses,
    periods,
    requirements,
    assignments,
    teacherUnavailable: {}
  };
}

/* ==========================================================================
   MIDDLEWARE DE AUTENTICACIÓN, SESIONES Y SEGURIDAD (FIREBASE AUTH + JWT)
   ========================================================================== */
function getStorageKeyForYear(year) {
  return `${STORAGE_PREFIX}${year}`;
}

function getActiveFirebaseUrl() {
  const saved = (localStorage.getItem(FIREBASE_URL_STORAGE_KEY) || DEFAULT_FIREBASE_DB_URL || '').trim();
  if (!saved) return '';
  return saved.replace(/\/+$/, '').replace(/\.json$/i, '');
}

function getActiveFirebaseApiKey() {
  return (localStorage.getItem(FIREBASE_API_KEY_STORAGE_KEY) || DEFAULT_FIREBASE_API_KEY || '').trim();
}

function getCloudEndpoint(year) {
  const baseUrl = getActiveFirebaseUrl();
  if (!baseUrl) return '';
  return `${baseUrl}/sistema_horarios_${year}.json`;
}

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

async function refreshIdToken() {
  if (!authSession || !authSession.refreshToken) {
    throw new Error('SESSION_MISSING');
  }
  const apiKey = getActiveFirebaseApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const endpoint = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(authSession.refreshToken)}`
  });

  const data = await res.json();
  if (!res.ok || !data.id_token) {
    throw new Error('TOKEN_REFRESH_FAILED');
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
  try {
    if (year) {
      currentSchoolYear = String(year);
      localStorage.setItem(ACTIVE_YEAR_KEY, currentSchoolYear);
    } else {
      currentSchoolYear = localStorage.getItem(ACTIVE_YEAR_KEY) || '2026';
    }

    undoStack = [];
    hasUnsavedChanges = false;
    updateUndoButton();
    updateSaveButtonUI();

    const selectYearEl = document.getElementById('selectSchoolYear');
    if (selectYearEl) {
      selectYearEl.value = currentSchoolYear;
    }

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

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function slotKey(courseId, dayIndex, periodId) {
  return `${courseId}__${dayIndex}__${periodId}`;
}

function unavailableKey(teacherId, dayIndex, periodId) {
  return `${teacherId}__${dayIndex}__${periodId}`;
}

function hexToRgba(hex, alpha = 0.14) {
  const clean = (hex || '#2563eb').replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4400);
}

function isPeriodDisabledOnDay(period, dayIndex) {
  if (!period) return true;
  if (period.type === 'break') return true;
  if (Number(dayIndex) === 4 && period.type === 'class_mon_thu') return true;
  return false;
}

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
    if (currentTeacherHours >= teacher.maxHours) {
      if (!silent) {
        showToast(
          `⚠️ Límite de horas lectivas: ${teacher.name} (${teacher.initials}) ya tiene ${currentTeacherHours}/${teacher.maxHours} hrs en cursos.`,
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
          if (!teacher.isMultiCourseWorkshop && getAssignedHoursForTeacher(teacher.id) >= teacher.maxHours) {
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
    !state.requirements.some((r) => r.id === ui.selectedPaletteReqId && r.courseId === ui.activeCourseId)
  ) {
    ui.selectedPaletteReqId = null;
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

  const hintEl = document.getElementById('calendarActiveSelectionHint');
  if (ui.selectedPaletteReqId === 'ERASER') {
    hintEl.textContent = '🧹 Modo Borrador activo: haz clic sobre cualquier bloque asignado para vaciarlo.';
  } else if (ui.selectedPaletteReqId) {
    const selReq = state.requirements.find((r) => r.id === ui.selectedPaletteReqId);
    const selTeacher = selReq ? state.teachers.find((t) => t.id === selReq.teacherId) : null;
    hintEl.textContent = selReq
      ? `📌 Asignando: ${selReq.subject} — ${selTeacher ? `${selTeacher.name} (${selTeacher.initials})` : ''} (Los bloques donde ya hace clases en otro curso aparecen bloqueados en rojo).`
      : '';
  } else {
    hintEl.textContent = '💡 Haz clic en una asignatura a la izquierda, haz clic en una celda o arrastra un bloque sobre otro para intercambiarlos.';
  }

  renderCourseCalendarGrid();
}

function renderCourseCalendarGrid() {
  const headerRow = document.getElementById('courseScheduleHeader');
  const tbody = document.getElementById('courseScheduleBody');

  headerRow.innerHTML =
    `<th class="time-col">Hora (Lun-Jue / Vie)</th>` +
    DAYS.map((d) => `<th>${d.name}</th>`).join('');

  tbody.innerHTML = '';

  const selectedReq =
    ui.selectedPaletteReqId && ui.selectedPaletteReqId !== 'ERASER'
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

      if (isPeriodDisabledOnDay(period, day.index)) {
        td.classList.add('slot-disabled-friday');
        td.innerHTML = `<div class="unavailable-warning-chip">Salida Viernes 14:00 hrs</div>`;
        tr.appendChild(td);
        return;
      }

      const key = slotKey(ui.activeCourseId, day.index, period.id);
      const currentAssignment = state.assignments[key];

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
   TAB 3: HORARIO INDIVIDUAL POR PROFESOR
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

  const assignedInCourses = getAssignedHoursForTeacher(teacher.id);
  const plannedInCourses = getPlannedHoursForTeacher(teacher.id);
  const otherLectivas = Number(teacher.otherLectivasHours || 0);
  const sepHrs = Number(teacher.sepHours || 0);

  document.getElementById('teacherViewStats').innerHTML = `
    <span class="stat-pill">🏷️ Sigla: <strong>${escapeHtml(teacher.initials)}</strong></span>
    <span class="stat-pill">🏫 En Horario (1º-8º): <strong>${assignedInCourses} / ${plannedInCourses} hrs</strong></span>
    ${otherLectivas > 0 ? `<span class="stat-pill">📚 Otras Lectivas (Kº/CRA): <strong>+${otherLectivas} hrs</strong></span>` : ''}
    ${sepHrs > 0 ? `<span class="stat-pill">🎯 Horas SEP: <strong>+${sepHrs} hrs</strong></span>` : ''}
    <span class="stat-pill">⏱️ Jornada Semanal: <strong>${teacher.contractChrono || 38} hrs cron.</strong></span>
  `;

  document.getElementById('availabilityModeBanner').classList.toggle('hidden', !ui.availabilityEditMode);

  const headerRow = document.getElementById('teacherScheduleHeader');
  const tbody = document.getElementById('teacherScheduleBody');

  headerRow.innerHTML =
    `<th class="time-col">Bloque / Hora</th>` +
    DAYS.map((d) => `<th>${d.name}</th>`).join('');
  tbody.innerHTML = '';

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

      if (isPeriodDisabledOnDay(period, day.index)) {
        td.classList.add('slot-disabled-friday');
        td.innerHTML = `<div class="unavailable-warning-chip">Sin clases (Vie tarde)</div>`;
        tr.appendChild(td);
        return;
      }

      const slots = findTeacherAssignmentsAtSlot(teacher.id, day.index, period.id);
      const unavailable = isTeacherUnavailable(teacher.id, day.index, period.id);

      if (slots.length > 0) {
        const bg = hexToRgba(teacher.color, 0.16);
        const coursesNames = slots
          .map((s) => state.courses.find((c) => c.id === s.courseId)?.short || '')
          .join(', ');
        const firstSubj = slots[0].shortCode || slots[0].subject;
        td.innerHTML = `
          <div class="assigned-block" style="border-left-color:${teacher.color}; background:${bg}; cursor:default;">
            <div class="block-subject">${escapeHtml(firstSubj)} (${escapeHtml(coursesNames)})</div>
            <div class="block-teacher">🏫 Curso: ${escapeHtml(coursesNames)}</div>
          </div>
        `;
      } else if (unavailable) {
        td.classList.add('slot-unavailable-preview');
        td.innerHTML = `
          <div class="unavailable-warning-chip">
            🔒 No Disponible ${ui.availabilityEditMode ? '(Clic para liberar)' : ''}
          </div>
        `;
      } else {
        td.innerHTML = `
          <div class="empty-slot-placeholder">
            ${ui.availabilityEditMode ? 'Clic para bloquear' : 'Hora No Lectiva / Libre'}
          </div>
        `;
      }

      td.addEventListener('click', () => {
        if (!ui.availabilityEditMode) return;
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

    const isComplete = scheduledCourses === plannedCourses;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="teacher-initials-badge" style="background:${t.color}">${escapeHtml(t.initials || '')}</span>
      </td>
      <td><strong>${escapeHtml(t.name)}</strong></td>
      <td>${escapeHtml(t.specialty)}</td>
      <td><strong>${plannedCourses}</strong> hrs</td>
      <td>
        <span class="badge-pill ${isComplete ? 'badge-ok' : 'badge-warn'}">
          ${scheduledCourses} / ${plannedCourses} hrs
        </span>
      </td>
      <td>
        ${otherLectivas > 0 ? `<div>+${otherLectivas}h (Kº/CRA)</div>` : ''}
        ${sepHours > 0 ? `<div><strong>+${sepHours}h SEP</strong></div>` : ''}
        ${otherLectivas === 0 && sepHours === 0 ? '<span style="color:#94a3b8;">0 hrs</span>' : ''}
      </td>
      <td>
        <strong>${totalAulaPedag} hrs pedag.</strong>
        <div style="font-size:0.73rem; color:#64748b;">(${(totalAulaPedag * 0.75).toFixed(2)} hrs cron.)</div>
      </td>
      <td>
        <strong>${t.contractChrono || 38} hrs</strong>
        ${t.pieInfo ? `<span class="badge-pill" style="margin-left:4px;">${escapeHtml(t.pieInfo)}</span>` : ''}
      </td>
      <td class="no-print">
        <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
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
      document.getElementById('teacherSepHoursInput').value = t.sepHours || 0;
      document.getElementById('teacherContractChronoInput').value = t.contractChrono || 38;
      document.getElementById('teacherPieHoursInput').value = t.pieInfo || '';
      document.getElementById('teacherSepDetailInput').value = t.sepDetail || '';
      document.getElementById('teacherColorInput').value = t.color;
      document.getElementById('btnCancelTeacherEdit').classList.remove('hidden');
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
        <div><strong>Jornada Semanal:</strong> ${teacher.contractChrono || 38} hrs cronológicas ${
    teacher.pieInfo ? `(${escapeHtml(teacher.pieInfo)})` : ''
  }</div>
      </div>

      <div>
        <h4 style="margin-bottom:0.4rem;">I. Horas Lectivas en Cursos (1º a 8º Básico)</h4>
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

      <div style="background:#eff6ff; padding:0.75rem; border-radius:8px; border:1px solid #bfdbfe; font-size:0.84rem;">
        <strong>II. Horas SEP / Co-docencia / Otras Lectivas:</strong>
        <p style="margin-top:0.25rem;">${escapeHtml(teacher.sepDetail || 'Sin horas SEP adicionales.')}</p>
      </div>

      <div style="background:#f0fdf4; padding:0.75rem; border-radius:8px; border:1px solid #bbf7d0; font-size:0.84rem;">
        <strong>III. Horas No Lectivas (Proporción 65/35) y Resumen:</strong>
        <ul style="margin:0.35rem 0 0 1.2rem;">
          <li>Total Horas Pedagógicas (I + II): <strong>${totalPedag} hrs pedagógicas</strong> (${totalLectivasChrono.toFixed(2)} hrs cronológicas)</li>
          <li>Actividades No Lectivas: Planificación, preparación y evaluación (40%), Consejo de profesores (2h), DPD (1h), Evaluación docente (2h), Atención de apoderados y estudiantes (1.5h).</li>
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
      <td><strong>${escapeHtml(r.shortCode || '')}</strong></td>
      <td><strong>${escapeHtml(r.subject)}</strong></td>
      <td>
        <div class="teacher-Row-Name">
          <span class="teacher-initials-badge" style="background:${teacher ? teacher.color : '#64748b'}">${
      teacher ? escapeHtml(teacher.initials) : '?'
    }</span>
          <span>${teacher ? escapeHtml(teacher.name) : 'Sin profesor'}</span>
        </div>
      </td>
      <td><strong>${r.hoursPerWeek}</strong> hrs</td>
      <td>${assigned} hrs</td>
      <td>
        <span class="badge-pill ${complete ? 'badge-ok' : 'badge-warn'}">
          ${complete ? '✅ 100% en horario' : `Faltan ${Math.max(0, r.hoursPerWeek - assigned)} hrs`}
        </span>
      </td>
      <td class="no-print">
        <div style="display:flex; gap:0.35rem;">
          <button type="button" class="btn btn-outline btn-xs btn-edit-req">✏️</button>
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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initEventListeners() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      renderAll();
    });
  });

  // Botón Deshacer
  document.getElementById('btnUndo').addEventListener('click', performUndo);

  // Selector de Año Escolar (2026 / 2027)
  document.getElementById('selectSchoolYear').addEventListener('change', (e) => {
    const selectedYear = e.target.value;
    ui.selectedPaletteReqId = null;
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
    renderTeacherViewTab();
  });

  document.getElementById('btnToggleAvailabilityMode').addEventListener('click', () => {
    ui.availabilityEditMode = !ui.availabilityEditMode;
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
    const sepHours = Number(document.getElementById('teacherSepHoursInput').value) || 0;
    const contractChrono = Number(document.getElementById('teacherContractChronoInput').value) || 38;
    const pieInfo = document.getElementById('teacherPieHoursInput').value.trim();
    const sepDetail = document.getElementById('teacherSepDetailInput').value.trim();
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
          sepHours,
          contractChrono,
          pieInfo,
          sepDetail,
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
        otherLectivasHours: 0,
        sepHours,
        contractChrono,
        pieInfo,
        sepDetail,
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
  document.getElementById('btnPrint').addEventListener('click', () => window.print());
}

function resetTeacherForm() {
  document.getElementById('teacherFormTitle').textContent = 'Agregar / Editar Profesor(a)';
  document.getElementById('teacherIdInput').value = '';
  document.getElementById('teacherInitialsInput').value = '';
  document.getElementById('teacherNameInput').value = '';
  document.getElementById('teacherSpecialtyInput').value = '';
  document.getElementById('teacherMaxHoursInput').value = '30';
  document.getElementById('teacherSepHoursInput').value = '0';
  document.getElementById('teacherContractChronoInput').value = '38';
  document.getElementById('teacherPieHoursInput').value = '';
  document.getElementById('teacherSepDetailInput').value = '';
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

async function bootstrapAuthAndApp() {
  initEventListeners();

  const stored = loadStoredAuthSession();
  if (stored && stored.idToken && stored.refreshToken) {
    authSession = stored;
    try {
      await ensureValidIdToken();
      unlockApplicationUI();
      return;
    } catch (err) {
      console.warn('La sesión guardada expiró o fue revocada:', err);
    }
  }

  lockApplicationUI();
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrapAuthAndApp();
});
