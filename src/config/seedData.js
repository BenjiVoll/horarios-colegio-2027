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

