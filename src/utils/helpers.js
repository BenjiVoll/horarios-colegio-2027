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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

