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
const AVAILABLE_YEARS_KEY = 'eduhorario_available_years_v1';
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
let availableSchoolYears = ['2026', '2027'];
let lastSyncedUpdatedAt = 0;
let undoStack = [];
let redoStack = [];
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
  selectedTeacherViewReqId: null,
  availabilityEditMode: false,
  modalTargetSlot: null,
  swapSourceSlot: null,
  panoramaActiveDay: '0', // '0'..'4' o 'WEEK'
  panoramaHighlightTeacherId: '',
  teacherWorkloadFilter: 'ALL', // 'ALL' | 'ALERT_65' | 'PENDING' | 'SEP'
  courseMobileDay: '0', // '0'..'4' o 'ALL' (solo afecta vista móvil <= 768px)
  teacherMobileDay: '0' // '0'..'4' o 'ALL' (solo afecta vista móvil <= 768px)
};

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

function getCloudUpdatedAtEndpoint(year) {
  const baseUrl = getActiveFirebaseUrl();
  if (!baseUrl) return '';
  return `${baseUrl}/sistema_horarios_${year}/updatedAt.json`;
}

function getCloudYearsEndpoint() {
  const baseUrl = getActiveFirebaseUrl();
  if (!baseUrl) return '';
  return `${baseUrl}/sistema_horarios_years.json`;
}

function loadAvailableSchoolYears() {
  try {
    const raw = localStorage.getItem(AVAILABLE_YEARS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = [...new Set(parsed.map((y) => String(y).trim()).filter((y) => /^[0-9]{4}$/.test(y)))].sort();
        if (cleaned.length > 0) {
          availableSchoolYears = cleaned;
          return availableSchoolYears;
        }
      }
    }
  } catch (e) {
    console.error('Error al cargar lista de años escolares:', e);
  }
  availableSchoolYears = ['2026', '2027'];
  return availableSchoolYears;
}

function saveAvailableSchoolYears() {
  availableSchoolYears = [...new Set(availableSchoolYears.map(String).filter((y) => /^[0-9]{4}$/.test(y)))].sort();
  try {
    localStorage.setItem(AVAILABLE_YEARS_KEY, JSON.stringify(availableSchoolYears));
  } catch (e) {
    console.error('Error al guardar lista de años escolares:', e);
  }
}

function ensureYearInList(year) {
  const y = String(year).trim();
  if (!/^[0-9]{4}$/.test(y)) return;
  if (!availableSchoolYears.includes(y)) {
    availableSchoolYears.push(y);
    saveAvailableSchoolYears();
  }
}

function renderSchoolYearSelector() {
  const selectYearEl = document.getElementById('selectSchoolYear');
  if (!selectYearEl) return;
  ensureYearInList(currentSchoolYear);
  selectYearEl.innerHTML = availableSchoolYears
    .map((y) => `<option value="${y}" ${y === String(currentSchoolYear) ? 'selected' : ''}>${y}</option>`)
    .join('');
}

