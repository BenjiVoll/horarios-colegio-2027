/**
 * Servicio de Generación y Exportación de Documentos PDF Vectoriales Oficiales
 * Utiliza jsPDF + jsPDF-AutoTable para exportar horarios y reportes institucionales
 * con dimensiones exactas (A4, Carta, Oficio), membrete oficial, colores y firmas.
 */

let cachedLogoDataUrl = null;

/**
 * Carga el logotipo institucional y lo convierte a DataURL Base64 para incrustarlo en el PDF
 */
async function getInstitutionalLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          cachedLogoDataUrl = canvas.toDataURL('image/png');
          resolve(cachedLogoDataUrl);
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = 'assets/img/logo-colegio.png';
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Convierte un color hexadecimal (#RRGGBB) a arreglo RGB [r, g, b] mezclándolo con blanco (tint)
 */
function hexToRgbArray(hex, tintFactor = 1) {
  const clean = String(hex || '#2563eb').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [241, 245, 249];
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  if (tintFactor >= 1) return [r, g, b];
  return [
    Math.round(255 - (255 - r) * tintFactor),
    Math.round(255 - (255 - g) * tintFactor),
    Math.round(255 - (255 - b) * tintFactor)
  ];
}

/**
 * Abre el modal de configuración avanzada de exportación PDF y preselecciona la vista activa
 */
function openPdfExportModal() {
  const modal = document.getElementById('pdfExportModal');
  if (!modal) return;

  const docTypeSelect = document.getElementById('pdfDocTypeSelect');
  const courseSelect = document.getElementById('pdfTargetCourseSelect');
  const teacherSelect = document.getElementById('pdfTargetTeacherSelect');
  const daySelect = document.getElementById('pdfTargetDaySelect');

  // Poblar selector de cursos
  if (courseSelect) {
    courseSelect.innerHTML = '';
    state.courses.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === ui.activeCourseId) opt.selected = true;
      courseSelect.appendChild(opt);
    });
  }

  // Poblar selector de profesores
  if (teacherSelect) {
    teacherSelect.innerHTML = '';
    state.teachers.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `[${t.initials}] ${t.name} — ${t.specialty}`;
      if (t.id === ui.activeViewTeacherId) opt.selected = true;
      teacherSelect.appendChild(opt);
    });
  }

  // Preseleccionar día activo si está en panorama
  if (daySelect && ui.panoramaActiveDay !== 'WEEK') {
    daySelect.value = String(ui.panoramaActiveDay || '0');
  }

  // Detectar pestaña activa para sugerir el tipo de documento ideal
  const activeTabBtn = document.querySelector('.nav-tab.active');
  const activeTabId = activeTabBtn ? activeTabBtn.dataset.tab : 'tab-calendario';

  if (docTypeSelect) {
    if (activeTabId === 'tab-calendario') {
      docTypeSelect.value = 'course_single';
    } else if (activeTabId === 'tab-resumen') {
      docTypeSelect.value = ui.panoramaActiveDay === 'WEEK' ? 'panorama_week' : 'panorama_day';
    } else if (activeTabId === 'tab-profesor-vista') {
      docTypeSelect.value = 'teacher_single';
    } else if (activeTabId === 'tab-profesores') {
      docTypeSelect.value = 'workload_65_35';
    } else if (activeTabId === 'tab-cursos') {
      docTypeSelect.value = 'course_all';
    }
  }

  updatePdfModalSubOptions();
  modal.classList.remove('hidden');
}

function closePdfExportModal() {
  const modal = document.getElementById('pdfExportModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Actualiza qué controles secundarios se muestran según el tipo de documento PDF elegido
 */
function updatePdfModalSubOptions() {
  const docType = document.getElementById('pdfDocTypeSelect')?.value || 'course_single';
  const courseGroup = document.getElementById('pdfCourseSelectGroup');
  const teacherGroup = document.getElementById('pdfTeacherSelectGroup');
  const dayGroup = document.getElementById('pdfDaySelectGroup');
  const paperSelect = document.getElementById('pdfPaperSizeSelect');
  const orientSelect = document.getElementById('pdfOrientationSelect');
  const helperBadge = document.getElementById('pdfRecommendationHint');

  if (courseGroup) courseGroup.classList.toggle('hidden', docType !== 'course_single');
  if (teacherGroup) teacherGroup.classList.toggle('hidden', docType !== 'teacher_single');
  if (dayGroup) dayGroup.classList.toggle('hidden', docType !== 'panorama_day');

  if (orientSelect) {
    orientSelect.value = 'landscape';
  }

  if (docType === 'panorama_week' && paperSelect) {
    paperSelect.value = 'legal';
  }

  if (helperBadge) {
    const hints = {
      course_single: '📐 Formato optimizado: 1 página exacta con horario completo, recreos, resumen de asignaturas y firmas.',
      course_all: `📚 Se generará un documento de ${state.courses.length} páginas (1 página exacta por cada curso de 1º a 8º Básico).`,
      teacher_single: '👨‍🏫 Incluye horario semanal del docente, desglose de horas lectivas/SEP/no lectivas (65/35) y firmas.',
      teacher_all: `🗂️ Carpeta Docente: Se generarán ${state.teachers.length} páginas (1 ficha y horario completo por cada profesor).`,
      panorama_day: '🏫 Comparativa paralela de los 8 cursos en una sola hoja horizontal con estado de control de topones.',
      panorama_week: '📊 Sábana General de 38 bloques × 8 cursos. Se recomienda tamaño Oficio (Legal) o A4 Horizontal.',
      workload_65_35: '📑 Reporte oficial de carga horaria docente (Horas Contrato, Lectivas, SEP, PIE y proporción legal 65/35).'
    };
    helperBadge.textContent = hints[docType] || '';
  }
}

/**
 * Dibuja el encabezado institucional oficial en la página actual del documento jsPDF
 */
function drawInstitutionalHeader(doc, logoDataUrl, options) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;

  // Franja superior institucional azul marino y dorado
  doc.setFillColor(26, 54, 93); // #1a365d
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(214, 158, 46); // #d69e2e
  doc.rect(0, 4, pageWidth, 1.2, 'F');

  let textStartX = marginX;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, 7, 14, 14);
      textStartX = marginX + 16.5;
    } catch (e) {
      textStartX = marginX;
    }
  }

  // Nombre del Colegio y Subtítulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 54, 93);
  doc.text('CHRISTIAN COLLEGE — HUALQUI', textStartX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Dirección y Jefatura de Unidad Técnico Pedagógica (UTP) · Freire 689, Hualqui', textStartX, 16.2);

  // Título principal del reporte
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(String(options.title || 'HORARIO OFICIAL'), textStartX, 21);

  // Cuadro derecho de metadatos (Año Escolar y Subtítulo derecho)
  const rightX = pageWidth - marginX;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(rightX - 68, 7.2, 68, 14.5, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(26, 54, 93);
  doc.text(String(options.rightBadge || `AÑO ESCOLAR ${currentSchoolYear}`), rightX - 34, 12.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(String(options.rightSub || `Emitido: ${new Date().toLocaleDateString('es-CL')}`), rightX - 34, 18.2, { align: 'center' });

  // Línea divisoria inferior del encabezado
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, 23.5, pageWidth - marginX, 23.5);

  return 25.5; // Y inicial disponible para contenido
}

/**
 * Dibuja el pie de página con líneas de firma (Dirección y UTP) y numeración de páginas
 */
function drawInstitutionalFooter(doc, pageNumber, totalPages, includeSignatures = true, customLeftSignature = null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;

  if (includeSignatures) {
    const sigY = pageHeight - 13.5;
    const center1 = pageWidth * 0.28;
    const center2 = pageWidth * 0.72;

    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.35);

    if (customLeftSignature) {
      const c1 = pageWidth * 0.2;
      const c2 = pageWidth * 0.5;
      const c3 = pageWidth * 0.8;
      doc.line(c1 - 26, sigY, c1 + 26, sigY);
      doc.line(c2 - 26, sigY, c2 + 26, sigY);
      doc.line(c3 - 26, sigY, c3 + 26, sigY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(customLeftSignature, c1, sigY + 3.6, { align: 'center' });
      doc.text('Jefatura de UTP', c2, sigY + 3.6, { align: 'center' });
      doc.text('Dirección — Christian College', c3, sigY + 3.6, { align: 'center' });
    } else {
      doc.line(center1 - 32, sigY, center1 + 32, sigY);
      doc.line(center2 - 32, sigY, center2 + 32, sigY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Jefatura de Unidad Técnico Pedagógica (UTP)', center1, sigY + 3.8, { align: 'center' });
      doc.text('Dirección — Christian College Hualqui', center2, sigY + 3.8, { align: 'center' });
    }
  }

  // Barra inferior de metadatos y folio
  const footerLineY = pageHeight - 6.2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(marginX, footerLineY, pageWidth - marginX, footerLineY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Christian College · Sistema Oficial de Planificación Académica y Horarios Escolares (${currentSchoolYear})`,
    marginX,
    pageHeight - 2.6
  );
  doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - marginX, pageHeight - 2.6, { align: 'right' });
}

/**
 * Renderiza el horario completo de un Curso en la página actual del PDF
 */
function renderCourseSchedulePageInPdf(doc, course, logoDataUrl, config) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;

  const headTeacher = course.headTeacherId ? state.teachers.find((t) => t.id === course.headTeacherId) : null;
  const reqs = state.requirements.filter((r) => r.courseId === course.id);
  const totalPlanned = reqs.reduce((acc, r) => acc + Number(r.hoursPerWeek || 0), 0);
  const totalAssigned = reqs.reduce((acc, r) => acc + getAssignedHoursForRequirement(r.id), 0);

  const startY = drawInstitutionalHeader(doc, logoDataUrl, {
    title: `HORARIO DE CLASES — ${course.name.toUpperCase()}`,
    rightBadge: `${course.name.toUpperCase()} · AÑO ${currentSchoolYear}`,
    rightSub: headTeacher
      ? `Prof. Jefe: ${headTeacher.name} (${totalAssigned}/${totalPlanned} hrs)`
      : `Carga asignada: ${totalAssigned} / ${totalPlanned} bloques`
  });

  // Construir filas de la tabla de horario (Bloques + Recreos)
  const bodyRows = [];
  const cellMetaMap = {}; // clave "rowIdx_colIdx" -> { color, isBreak, isDisabled }

  state.periods.forEach((period, rowIdx) => {
    const timeLabel = `${period.label}\n${period.start} - ${period.end}`;
    const friNote = period.friStart && (period.friStart !== period.start || period.friEnd !== period.end)
      ? `\n(Vie: ${period.friStart}-${period.friEnd})`
      : '';

    if (period.type === 'break') {
      const breakText = `RECREO / DESCANSO (${period.start} a ${period.end}${
        period.friStart ? ` · Viernes: ${period.friStart} a ${period.friEnd}` : ''
      })`;
      bodyRows.push([
        `${period.start} - ${period.end}`,
        {
          content: breakText,
          colSpan: 5,
          styles: {
            halign: 'center',
            valign: 'middle',
            fillColor: [254, 243, 199],
            textColor: [146, 64, 14],
            fontStyle: 'bold',
            fontSize: 7.5
          }
        }
      ]);
      cellMetaMap[`${rowIdx}_break`] = true;
      return;
    }

    const row = [`${timeLabel}${friNote}`];

    DAYS.forEach((day, dayIdx) => {
      const colIdx = dayIdx + 1;
      if (isPeriodDisabledOnDay(period, day.index)) {
        row.push('Salida Viernes\n14:00 hrs');
        cellMetaMap[`${rowIdx}_${colIdx}`] = { isDisabled: true };
        return;
      }

      const a = state.assignments[slotKey(course.id, day.index, period.id)];
      if (a) {
        const teacher = state.teachers.find((t) => t.id === a.teacherId);
        const req = state.requirements.find((r) => r.id === a.reqId);
        const cellColor = (req && req.color) || (teacher && teacher.color) || '#2563eb';
        const teacherLabel = teacher ? `${teacher.name} (${teacher.initials})` : 'Sin profesor';
        row.push(`${a.subject}\n${teacherLabel}`);
        cellMetaMap[`${rowIdx}_${colIdx}`] = { color: cellColor };
      } else {
        row.push('—');
      }
    });

    bodyRows.push(row);
  });

  // Calcular espacio disponible para que siempre quepa en 1 sola página
  const footerReserve = config.includeSignatures ? 21 : 10;
  const summaryReserve = config.includeSummary && reqs.length > 0 ? 27 : 0;
  const availableTableHeight = pageHeight - startY - footerReserve - summaryReserve;
  const isCompact = availableTableHeight < 130;

  const timeColWidth = 32;
  const dayColWidth = (pageWidth - marginX * 2 - timeColWidth) / 5;

  doc.autoTable({
    startY,
    margin: { left: marginX, right: marginX },
    head: [['BLOQUE / HORARIO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']],
    body: bodyRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: isCompact ? 7.2 : 8,
      cellPadding: isCompact ? 1.4 : 2.1,
      valign: 'middle',
      halign: 'center',
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      textColor: [15, 23, 42],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isCompact ? 7.8 : 8.5,
      cellPadding: isCompact ? 1.8 : 2.4
    },
    columnStyles: {
      0: {
        cellWidth: timeColWidth,
        fillColor: [248, 250, 252],
        fontStyle: 'bold',
        fontSize: isCompact ? 6.8 : 7.3,
        textColor: [51, 65, 85]
      },
      1: { cellWidth: dayColWidth },
      2: { cellWidth: dayColWidth },
      3: { cellWidth: dayColWidth },
      4: { cellWidth: dayColWidth },
      5: { cellWidth: dayColWidth }
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const meta = cellMetaMap[`${data.row.index}_${data.column.index}`];
      if (!meta) return;

      if (meta.isDisabled) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [148, 163, 184];
        data.cell.styles.fontStyle = 'italic';
        data.cell.styles.fontSize = 6.8;
      } else if (meta.color) {
        if (config.includeColors) {
          data.cell.styles.fillColor = hexToRgbArray(meta.color, 0.16);
        }
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index >= 1) {
        const meta = cellMetaMap[`${data.row.index}_${data.column.index}`];
        if (meta && meta.color && config.includeColors) {
          const [r, g, b] = hexToRgbArray(meta.color, 1);
          doc.setFillColor(r, g, b);
          doc.rect(data.cell.x, data.cell.y, 1.6, data.cell.height, 'F');
        }
      }
    }
  });

  // Cuadro resumen de asignaturas y profesores del curso en la parte inferior
  if (config.includeSummary && reqs.length > 0) {
    const finalY = doc.lastAutoTable.finalY + 3.5;
    if (finalY + 15 < pageHeight - footerReserve) {
      const summaryCols = 4;
      const summaryRows = [];
      for (let i = 0; i < reqs.length; i += summaryCols) {
        const chunk = reqs.slice(i, i + summaryCols);
        const rowCells = [];
        for (let c = 0; c < summaryCols; c++) {
          const item = chunk[c];
          if (item) {
            const t = state.teachers.find((x) => x.id === item.teacherId);
            const asg = getAssignedHoursForRequirement(item.id);
            rowCells.push(
              `[${item.shortCode || item.subject.slice(0, 3)}] ${item.subject}: ${t ? t.name : 'S/P'} (${asg}/${item.hoursPerWeek}h)`
            );
          } else {
            rowCells.push('');
          }
        }
        summaryRows.push(rowCells);
      }

      doc.autoTable({
        startY: finalY,
        margin: { left: marginX, right: marginX },
        head: [['RESUMEN DEL PLAN DE ESTUDIO Y DOCENTES ASIGNADOS AL CURSO', '', '', '']],
        body: summaryRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 6.5,
          cellPadding: 1.1,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [26, 54, 93],
          fontStyle: 'bold',
          fontSize: 6.8,
          cellPadding: 1.2,
          halign: 'left'
        }
      });
    }
  }
}

/**
 * Renderiza la Ficha y Horario Individual de un Profesor en la página actual del PDF
 */
function renderTeacherSchedulePageInPdf(doc, teacher, logoDataUrl, config) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 10;

  const plannedCourses = getPlannedHoursForTeacher(teacher.id);
  const scheduledCourses = getAssignedHoursForTeacher(teacher.id);
  const otherLectivas = Number(teacher.otherLectivasHours || 0);
  const sepHours = Number(teacher.sepHours || 0);
  const totalLectivas = scheduledCourses + otherLectivas;
  const totalAulaPedag = totalLectivas + sepHours;
  const totalAulaChrono = (totalAulaPedag * 45) / 60;
  const contractChrono = Number(teacher.contractChrono || 38);
  const nonTeachingChrono = Math.max(0, contractChrono - totalAulaChrono);
  const pctLectivo = contractChrono > 0 ? Math.round((totalAulaChrono / contractChrono) * 100) : 0;
  const pctNoLectivo = Math.max(0, 100 - pctLectivo);

  const startY = drawInstitutionalHeader(doc, logoDataUrl, {
    title: `HORARIO Y CARGA DOCENTE — ${teacher.name.toUpperCase()} [${teacher.initials || ''}]`,
    rightBadge: `CONTRATO: ${contractChrono} HRS CRON.${teacher.pieInfo ? ` (${teacher.pieInfo})` : ''}`,
    rightSub: `Especialidad: ${teacher.specialty || 'Docente'}`
  });

  // Cinta ejecutiva de indicadores 65/35 del docente
  doc.autoTable({
    startY,
    margin: { left: marginX, right: marginX },
    head: [[
      'HRS EN CURSOS (1º-8º)',
      'OTRAS LECTIVAS / SEP',
      'TOTAL AULA (PEDAG. / CRON.)',
      'HRS NO LECTIVAS (CRON.)',
      'PROPORCIÓN LEGAL 65/35',
      'DETALLE SEP / NO LECTIVAS'
    ]],
    body: [[
      `${scheduledCourses} / ${plannedCourses} hrs pedag.`,
      `+${otherLectivas}h Otras · +${sepHours}h SEP`,
      `${totalAulaPedag} hrs pedag. (${totalAulaChrono.toFixed(2)}h cron.)`,
      `${nonTeachingChrono.toFixed(2)} hrs cronológicas`,
      `${pctLectivo}% Aula / ${pctNoLectivo}% No Lect.`,
      `${[teacher.sepDetail, teacher.nonTeachingActivities].filter(Boolean).join(' · ') || 'Según planificación UTP'}`
    ]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 6.7,
      fontStyle: 'bold',
      cellPadding: 1.4
    },
    columnStyles: {
      5: { halign: 'left', cellWidth: (pageWidth - marginX * 2) * 0.28 }
    }
  });

  const scheduleStartY = doc.lastAutoTable.finalY + 3;
  const bodyRows = [];
  const cellMetaMap = {};

  state.periods.forEach((period, rowIdx) => {
    if (period.type === 'break') {
      bodyRows.push([
        `${period.start} - ${period.end}`,
        {
          content: `RECREO (${period.start} - ${period.end})`,
          colSpan: 5,
          styles: {
            halign: 'center',
            fillColor: [254, 243, 199],
            textColor: [146, 64, 14],
            fontStyle: 'bold',
            fontSize: 7.2
          }
        }
      ]);
      return;
    }

    const row = [`${period.label}\n${period.start} - ${period.end}`];

    DAYS.forEach((day, dayIdx) => {
      const colIdx = dayIdx + 1;
      if (isPeriodDisabledOnDay(period, day.index)) {
        row.push('Salida Viernes\n14:00 hrs');
        cellMetaMap[`${rowIdx}_${colIdx}`] = { isDisabled: true };
        return;
      }

      const slots = findTeacherAssignmentsAtSlot(teacher.id, day.index, period.id);
      const isUnavail = isTeacherUnavailable(teacher.id, day.index, period.id);

      if (slots.length > 0) {
        const lines = slots.map((s) => {
          const c = state.courses.find((x) => x.id === s.courseId);
          return `${c ? c.name : ''}: ${s.subject}`;
        });
        row.push(lines.join('\n'));
        cellMetaMap[`${rowIdx}_${colIdx}`] = { color: teacher.color || '#2563eb' };
      } else if (isUnavail) {
        row.push('BLOQUEADO /\nNO DISPONIBLE');
        cellMetaMap[`${rowIdx}_${colIdx}`] = { isUnavailable: true };
      } else {
        row.push('—');
      }
    });

    bodyRows.push(row);
  });

  const footerReserve = config.includeSignatures ? 21 : 10;
  const availHeight = pageHeight - scheduleStartY - footerReserve;
  const isCompact = availHeight < 120;
  const timeColWidth = 30;
  const dayColWidth = (pageWidth - marginX * 2 - timeColWidth) / 5;

  doc.autoTable({
    startY: scheduleStartY,
    margin: { left: marginX, right: marginX },
    head: [['BLOQUE / HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']],
    body: bodyRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: isCompact ? 7.1 : 7.8,
      cellPadding: isCompact ? 1.3 : 1.9,
      valign: 'middle',
      halign: 'center',
      lineColor: [203, 213, 225],
      lineWidth: 0.25,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isCompact ? 7.6 : 8.2,
      cellPadding: isCompact ? 1.6 : 2.1
    },
    columnStyles: {
      0: {
        cellWidth: timeColWidth,
        fillColor: [248, 250, 252],
        fontStyle: 'bold',
        fontSize: 6.9
      },
      1: { cellWidth: dayColWidth },
      2: { cellWidth: dayColWidth },
      3: { cellWidth: dayColWidth },
      4: { cellWidth: dayColWidth },
      5: { cellWidth: dayColWidth }
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const meta = cellMetaMap[`${data.row.index}_${data.column.index}`];
      if (!meta) return;
      if (meta.isDisabled) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [148, 163, 184];
        data.cell.styles.fontSize = 6.5;
      } else if (meta.isUnavailable) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontSize = 6.5;
      } else if (meta.color) {
        if (config.includeColors) {
          data.cell.styles.fillColor = hexToRgbArray(meta.color, 0.16);
        }
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell(data) {
      if (data.section === 'body' && data.column.index >= 1) {
        const meta = cellMetaMap[`${data.row.index}_${data.column.index}`];
        if (meta && meta.color && config.includeColors) {
          const [r, g, b] = hexToRgbArray(meta.color, 1);
          doc.setFillColor(r, g, b);
          doc.rect(data.cell.x, data.cell.y, 1.6, data.cell.height, 'F');
        }
      }
    }
  });
}

/**
 * Renderiza el Panorama Diario (todos los cursos de 1º a 8º en paralelo para un día específico)
 */
function renderPanoramaDayPageInPdf(doc, dayIndex, logoDataUrl, config) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const dayObj = DAYS[dayIndex] || DAYS[0];

  const startY = drawInstitutionalHeader(doc, logoDataUrl, {
    title: `PANORAMA GENERAL DEL DÍA ${dayObj.name.toUpperCase()} (1º A 8º BÁSICO)`,
    rightBadge: `DÍA ${dayObj.name.toUpperCase()} · ${currentSchoolYear}`,
    rightSub: `Comparativa paralela de ${state.courses.length} cursos`
  });

  const headRow = ['BLOQUE / HORA', ...state.courses.map((c) => c.name.toUpperCase()), 'TOPONES'];
  const bodyRows = [];
  const cellColorMap = {};

  state.periods.forEach((period, rowIdx) => {
    if (period.type === 'break') {
      bodyRows.push([
        `${period.start} - ${period.end}`,
        {
          content: `RECREO (${period.start} - ${period.end})`,
          colSpan: state.courses.length + 1,
          styles: {
            halign: 'center',
            fillColor: [254, 243, 199],
            textColor: [146, 64, 14],
            fontStyle: 'bold',
            fontSize: 7.2
          }
        }
      ]);
      return;
    }

    if (isPeriodDisabledOnDay(period, dayIndex)) {
      bodyRows.push([
        `${period.start} - ${period.end}`,
        {
          content: 'Salida Viernes 14:00 hrs',
          colSpan: state.courses.length + 1,
          styles: {
            halign: 'center',
            fillColor: [241, 245, 249],
            textColor: [100, 116, 139],
            fontStyle: 'italic',
            fontSize: 7
          }
        }
      ]);
      return;
    }

    const teacherCountsInRow = {};
    state.courses.forEach((course) => {
      const a = state.assignments[slotKey(course.id, dayIndex, period.id)];
      if (!a) return;
      const t = state.teachers.find((x) => x.id === a.teacherId);
      if (t && t.isMultiCourseWorkshop) return;
      teacherCountsInRow[a.teacherId] = (teacherCountsInRow[a.teacherId] || 0) + 1;
    });
    const hasConflict = Object.values(teacherCountsInRow).some((cnt) => cnt > 1);

    const row = [`${period.label}\n${period.start} - ${period.end}`];
    state.courses.forEach((course, cIdx) => {
      const a = state.assignments[slotKey(course.id, dayIndex, period.id)];
      if (a) {
        const t = state.teachers.find((x) => x.id === a.teacherId);
        row.push(`${a.subject}\n${t ? `${t.initials} (${t.name.split(' ')[0]})` : ''}`);
        cellColorMap[`${rowIdx}_${cIdx + 1}`] = t ? t.color : '#2563eb';
      } else {
        row.push('—');
      }
    });
    row.push(hasConflict ? 'TOPÓN' : 'OK');
    bodyRows.push(row);
  });

  const timeColW = 24;
  const statusColW = 16;
  const courseColW = (pageWidth - marginX * 2 - timeColW - statusColW) / Math.max(1, state.courses.length);

  const columnStyles = {
    0: { cellWidth: timeColW, fontStyle: 'bold', fillColor: [248, 250, 252], fontSize: 6.6 },
    [state.courses.length + 1]: { cellWidth: statusColW, fontStyle: 'bold', fontSize: 6.6 }
  };
  state.courses.forEach((_, idx) => {
    columnStyles[idx + 1] = { cellWidth: courseColW };
  });

  doc.autoTable({
    startY,
    margin: { left: marginX, right: marginX },
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.22,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: 1.8
    },
    columnStyles,
    didParseCell(data) {
      if (data.section !== 'body') return;
      const color = cellColorMap[`${data.row.index}_${data.column.index}`];
      if (color && config.includeColors) {
        data.cell.styles.fillColor = hexToRgbArray(color, 0.16);
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
}

/**
 * Renderiza la Sábana Semanal Completa (38 bloques × 8 cursos) en una sola página apaisada
 */
function renderWeeklySabanaPageInPdf(doc, logoDataUrl, config) {
  const marginX = 8;

  const startY = drawInstitutionalHeader(doc, logoDataUrl, {
    title: 'SÁBANA GENERAL SEMANAL DE HORARIOS (38 BLOQUES · 1º A 8º BÁSICO)',
    rightBadge: `MATRIZ GENERAL ${currentSchoolYear}`,
    rightSub: 'Sigla Asignatura + Iniciales Profesor'
  });

  const classPeriods = state.periods.filter((p) => p.type !== 'break');
  const columns = [];
  DAYS.forEach((day) => {
    const dayPeriods = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index));
    dayPeriods.forEach((p, idx) => {
      columns.push({
        dayIndex: day.index,
        dayName: day.name.toUpperCase(),
        periodId: p.id,
        blockNum: idx + 1
      });
    });
  });

  const headRow1 = [{ content: 'CURSO', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } }];
  DAYS.forEach((day) => {
    const count = classPeriods.filter((p) => !isPeriodDisabledOnDay(p, day.index)).length;
    headRow1.push({
      content: day.name.toUpperCase(),
      colSpan: count,
      styles: { halign: 'center', fillColor: [26, 54, 93] }
    });
  });
  headRow1.push({ content: 'HRS', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } });

  const headRow2 = columns.map((col) => ({
    content: String(col.blockNum),
    styles: { halign: 'center', fillColor: [51, 65, 85], fontSize: 5.8 }
  }));

  const cellColorMap = {};
  const bodyRows = state.courses.map((course, rIdx) => {
    let assignedCount = 0;
    const row = [course.short || course.name];
    columns.forEach((col, cIdx) => {
      const a = state.assignments[slotKey(course.id, col.dayIndex, col.periodId)];
      const teacher = a ? state.teachers.find((t) => t.id === a.teacherId) : null;
      if (a) {
        assignedCount++;
        const subjCode = a.shortCode || a.subject.slice(0, 3).toUpperCase();
        const profCode = teacher ? teacher.initials : '';
        row.push(`${subjCode}\n${profCode}`);
        if (teacher && teacher.color) {
          cellColorMap[`${rIdx}_${cIdx + 1}`] = teacher.color;
        }
      } else {
        row.push('—');
      }
    });
    row.push(`${assignedCount}/38`);
    return row;
  });

  doc.autoTable({
    startY,
    margin: { left: marginX, right: marginX },
    head: [headRow1, headRow2],
    body: bodyRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 5.5,
      cellPadding: 0.8,
      halign: 'center',
      valign: 'middle',
      lineColor: [203, 213, 225],
      lineWidth: 0.18,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.4,
      cellPadding: 1.1
    },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: 'bold', fillColor: [248, 250, 252], fontSize: 6.4 },
      [columns.length + 1]: { cellWidth: 11, fontStyle: 'bold', fillColor: [248, 250, 252], fontSize: 6 }
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const color = cellColorMap[`${data.row.index}_${data.column.index}`];
      if (color && config.includeColors) {
        data.cell.styles.fillColor = hexToRgbArray(color, 0.2);
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // Leyenda rápida de docentes al pie de la Sábana General
  const finalY = doc.lastAutoTable.finalY + 3;
  const teacherItems = state.teachers.map((t) => `[${t.initials}] ${t.name} (${t.specialty})`);
  const cols = 4;
  const legendRows = [];
  for (let i = 0; i < teacherItems.length; i += cols) {
    const r = [];
    for (let j = 0; j < cols; j++) {
      r.push(teacherItems[i + j] || '');
    }
    legendRows.push(r);
  }

  if (legendRows.length > 0) {
    doc.autoTable({
      startY: finalY,
      margin: { left: marginX, right: marginX },
      head: [['NÓMINA DE SIGLAS DOCENTES — CHRISTIAN COLLEGE', '', '', '']],
      body: legendRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.2,
        cellPadding: 0.9,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
        lineWidth: 0.18
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [26, 54, 93],
        fontStyle: 'bold',
        fontSize: 6.5,
        halign: 'left'
      }
    });
  }
}

/**
 * Renderiza el Cuadro Oficial de Carga Horaria Docente (Ley 65/35, SEP y PIE)
 */
function renderWorkloadReportInPdf(doc, logoDataUrl, config) {
  const marginX = 10;

  const startY = drawInstitutionalHeader(doc, logoDataUrl, {
    title: 'CUADRO OFICIAL DE CARGA HORARIA DOCENTE (PROPORCIÓN LEGAL 65/35, SEP Y PIE)',
    rightBadge: `DOTACIÓN DOCENTE ${currentSchoolYear}`,
    rightSub: `${state.teachers.length} Profesores registrados`
  });

  const rows = state.teachers.map((t) => {
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

    const details = [
      t.sepDetail ? `SEP: ${t.sepDetail}` : '',
      t.nonTeachingActivities ? `No Lect.: ${t.nonTeachingActivities}` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    return [
      t.initials || '',
      t.name,
      t.specialty,
      `${scheduledCourses}/${plannedCourses}h`,
      otherLectivas > 0 || sepHours > 0 ? `+${otherLectivas}h / +${sepHours}h SEP` : '0h',
      `${totalAulaPedag}h ped.\n(${totalAulaChrono.toFixed(2)}h cron.)`,
      `${nonTeachingChrono.toFixed(2)}h cron.`,
      `${pctLectivo}% / ${pctNoLectivo}%`,
      `${contractChrono}h${t.pieInfo ? `\n(${t.pieInfo})` : ''}`,
      details || '—'
    ];
  });

  doc.autoTable({
    startY,
    margin: { left: marginX, right: marginX },
    head: [[
      'SIGLA',
      'DOCENTE',
      'ESPECIALIDAD',
      'CURSOS (1º-8º)',
      'OTRAS / SEP',
      'TOTAL AULA',
      'NO LECTIVAS',
      '65% / 35%',
      'CONTRATO',
      'DETALLE SEP Y ACTIVIDADES NO LECTIVAS'
    ]],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.7,
      cellPadding: 1.4,
      valign: 'middle',
      halign: 'center',
      lineColor: [203, 213, 225],
      lineWidth: 0.22,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [26, 54, 93],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      cellPadding: 1.6
    },
    columnStyles: {
      0: { cellWidth: 13, fontStyle: 'bold' },
      1: { cellWidth: 34, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 32, halign: 'left' },
      9: { halign: 'left', fontSize: 6.2 }
    }
  });
}

/**
 * Función principal que construye el documento PDF vectorial y lo descarga o previsualiza
 */
async function generateInstitutionalPdf(mode = 'download') {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('⚠️ La librería PDF aún se está cargando. Intenta de nuevo en un segundo.', 'warn');
    return;
  }

  const docType = document.getElementById('pdfDocTypeSelect')?.value || 'course_single';
  const format = document.getElementById('pdfPaperSizeSelect')?.value || 'a4';
  const orientation = document.getElementById('pdfOrientationSelect')?.value || 'landscape';
  const includeColors = document.getElementById('pdfIncludeColors')?.checked !== false;
  const includeSignatures = document.getElementById('pdfIncludeSignatures')?.checked !== false;
  const includeSummary = document.getElementById('pdfIncludeSummary')?.checked !== false;

  const config = {
    docType,
    format,
    orientation,
    includeColors,
    includeSignatures,
    includeSummary
  };

  const btnDownload = document.getElementById('btnExecutePdfDownload');
  const originalBtnText = btnDownload ? btnDownload.innerHTML : '';
  if (btnDownload) {
    btnDownload.disabled = true;
    btnDownload.innerHTML = '⏳ Generando PDF Oficial...';
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format,
      compress: true
    });

    const logoDataUrl = await getInstitutionalLogoDataUrl();
    let fileName = `Horarios_Christian_College_${currentSchoolYear}.pdf`;
    let customLeftSig = null;

    if (docType === 'course_single') {
      const courseId = document.getElementById('pdfTargetCourseSelect')?.value || ui.activeCourseId || state.courses[0]?.id;
      const course = state.courses.find((c) => c.id === courseId) || state.courses[0];
      if (!course) throw new Error('No hay cursos disponibles para exportar.');
      renderCourseSchedulePageInPdf(doc, course, logoDataUrl, config);
      const safeName = course.name.replace(/[^a-zA-Z0-9]/g, '_');
      fileName = `Horario_${safeName}_${currentSchoolYear}_Christian_College.pdf`;
    } else if (docType === 'course_all') {
      state.courses.forEach((course, idx) => {
        if (idx > 0) doc.addPage(format, orientation);
        renderCourseSchedulePageInPdf(doc, course, logoDataUrl, config);
      });
      fileName = `Horarios_Todos_Los_Cursos_1_a_8_Basico_${currentSchoolYear}.pdf`;
    } else if (docType === 'teacher_single') {
      const teacherId = document.getElementById('pdfTargetTeacherSelect')?.value || ui.activeViewTeacherId || state.teachers[0]?.id;
      const teacher = state.teachers.find((t) => t.id === teacherId) || state.teachers[0];
      if (!teacher) throw new Error('No hay profesores disponibles para exportar.');
      renderTeacherSchedulePageInPdf(doc, teacher, logoDataUrl, config);
      customLeftSig = `Firma Docente: ${teacher.name}`;
      const safeName = teacher.name.replace(/[^a-zA-Z0-9]/g, '_');
      fileName = `Horario_Docente_${teacher.initials || ''}_${safeName}_${currentSchoolYear}.pdf`;
    } else if (docType === 'teacher_all') {
      state.teachers.forEach((teacher, idx) => {
        if (idx > 0) doc.addPage(format, orientation);
        renderTeacherSchedulePageInPdf(doc, teacher, logoDataUrl, config);
      });
      customLeftSig = 'Firma Conformidad Docente';
      fileName = `Carpeta_Horarios_Docentes_Completa_${currentSchoolYear}.pdf`;
    } else if (docType === 'panorama_day') {
      const dayVal = document.getElementById('pdfTargetDaySelect')?.value || '0';
      if (dayVal === 'ALL_DAYS') {
        DAYS.forEach((d, idx) => {
          if (idx > 0) doc.addPage(format, orientation);
          renderPanoramaDayPageInPdf(doc, d.index, logoDataUrl, config);
        });
        fileName = `Panorama_Diario_Lunes_a_Viernes_${currentSchoolYear}.pdf`;
      } else {
        const dayIndex = Number(dayVal);
        const dayObj = DAYS[dayIndex] || DAYS[0];
        renderPanoramaDayPageInPdf(doc, dayIndex, logoDataUrl, config);
        fileName = `Panorama_Dia_${dayObj.name}_${currentSchoolYear}.pdf`;
      }
    } else if (docType === 'panorama_week') {
      renderWeeklySabanaPageInPdf(doc, logoDataUrl, config);
      fileName = `Sabana_General_Horarios_${currentSchoolYear}_Christian_College.pdf`;
    } else if (docType === 'workload_65_35') {
      renderWorkloadReportInPdf(doc, logoDataUrl, config);
      fileName = `Carga_Horaria_Docente_65_35_SEP_${currentSchoolYear}.pdf`;
    }

    // Numerar todas las páginas y estampar el pie de firmas institucional
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawInstitutionalFooter(doc, p, totalPages, includeSignatures, customLeftSig);
    }

    if (mode === 'preview') {
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
      showToast('👁️ Vista previa del PDF abierta en una nueva pestaña.', 'info');
    } else {
      doc.save(fileName);
      closePdfExportModal();
      showToast(`📄 PDF exportado correctamente: ${fileName}`, 'success');
    }
  } catch (err) {
    console.error('Error al generar el PDF:', err);
    showToast(`Error al generar el PDF: ${err.message || err}`, 'error');
  } finally {
    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = originalBtnText;
    }
  }
}

/**
 * Exportación directa de la ficha y horario de un profesor desde su modal individual
 */
async function exportSingleTeacherPdfDirect(teacherId) {
  openPdfExportModal();
  const docTypeSelect = document.getElementById('pdfDocTypeSelect');
  const teacherSelect = document.getElementById('pdfTargetTeacherSelect');
  if (docTypeSelect) docTypeSelect.value = 'teacher_single';
  if (teacherSelect && teacherId) teacherSelect.value = teacherId;
  updatePdfModalSubOptions();
  await generateInstitutionalPdf('download');
}
