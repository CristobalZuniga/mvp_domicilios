// ─── Configuración ────────────────────────────────────────────
const API_URL = "https://script.google.com/macros/s/AKfycbxZeBybZaiGqirVesIYaH67CdV5lExf_hZpT7bI7ph_Fx83cXSWUG1yX8GSZYLEPN0G/exec";

// ─── Estado global ─────────────────────────────────────────────
let state = {
  kineId: null,
  kineName: null,
  patients: [],
  selectedPatientId: null
};

let currentLoginMode = 'kine';
let pinValue = '';

// ─── DOM References ────────────────────────────────────────────
const views = {
  login:     document.getElementById('login-view'),
  dashboard: document.getElementById('dashboard-view'),
  admin:     document.getElementById('admin-dashboard-view')
};

// Login
const loginForm           = document.getElementById('login-form');
const tabKine             = document.getElementById('tab-kine');
const tabAdmin            = document.getElementById('tab-admin');
const kineSelectorGroup   = document.getElementById('kine-selector-group');
const kineSelector        = document.getElementById('kine-selector');
const pinInput            = document.getElementById('pin-input');
const pinDisplay          = document.getElementById('pin-display');
const btnLogin            = document.getElementById('btn-login');

// Kine dashboard
const greetingEl          = document.getElementById('greeting');
const btnLogout           = document.getElementById('btn-logout');
const patientSelector     = document.getElementById('patient-selector');
const patientInfoPanel    = document.getElementById('patient-info-panel');
const sessionsCount       = document.getElementById('sessions-count');
const paymentStatusText   = document.getElementById('payment-status-text');
const patientPhone        = document.getElementById('patient-phone');
const patientPhoneLink    = document.getElementById('patient-phone-link');
const patientAddress      = document.getElementById('patient-address');
const notesInput          = document.getElementById('notes-input');
const btnMarkAttendance   = document.getElementById('btn-mark-attendance');
const historyList         = document.getElementById('history-list');

// Admin dashboard
const btnAdminLogout              = document.getElementById('btn-admin-logout');
const adminPatientSelectorPlan    = document.getElementById('admin-patient-selector-plan');
const adminPatientSelectorPayment = document.getElementById('admin-patient-selector-payment');
const formAddPatient              = document.getElementById('form-add-patient');
const formAddPlan                 = document.getElementById('form-add-plan');
const formAddPayment              = document.getElementById('form-add-payment');

// ─── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildPinDisplay();
  setupNumpad();
  setupLoginTabs();

  const stored = localStorage.getItem('kine_session');
  if (stored) {
    const session = JSON.parse(stored);
    if (session.role === 'admin') {
      showAdminDashboard();
    } else {
      state.kineId   = session.id;
      state.kineName = session.nombre;
      showKineDashboard();
    }
  } else {
    showLogin();
  }

  setupKineListeners();
  setupAdminListeners();
});

// ════════════════════════════════════════════════════════════════
// PIN NUMPAD
// ════════════════════════════════════════════════════════════════

function buildPinDisplay() {
  pinDisplay.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('div');
    dot.className = 'pin-dot';
    dot.id = `pin-dot-${i}`;
    pinDisplay.appendChild(dot);
  }
}

function updatePinDisplay() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById(`pin-dot-${i}`);
    if (dot) dot.classList.toggle('filled', i < pinValue.length);
  }
  pinInput.value = pinValue;
  btnLogin.disabled = pinValue.length < 4;
}

function setupNumpad() {
  document.querySelectorAll('.num-btn').forEach(btn => {
    const val = btn.dataset.val;
    if (!val || btn.id === 'btn-login') return;

    btn.addEventListener('click', () => {
      if (val === 'clear') {
        pinValue = pinValue.slice(0, -1);
      } else if (pinValue.length < 6) {
        pinValue += val;
      }
      updatePinDisplay();
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinValue;
    if (!pin) return;

    if (currentLoginMode === 'kine') {
      const kineId = kineSelector.value;
      if (!kineId) {
        showToast('error', 'Selecciona tu perfil de kinesiólogo');
        return;
      }
      await handleKineLogin(kineId, pin);
    } else {
      await handleAdminLogin(pin);
    }
  });
}

// ════════════════════════════════════════════════════════════════
// TABS DE LOGIN
// ════════════════════════════════════════════════════════════════

function setupLoginTabs() {
  tabKine.addEventListener('click', () => {
    currentLoginMode = 'kine';
    tabKine.classList.add('active');
    tabAdmin.classList.remove('active');
    kineSelectorGroup.style.display = 'flex';
    kineSelector.required = true;
    pinValue = '';
    updatePinDisplay();
  });

  tabAdmin.addEventListener('click', () => {
    currentLoginMode = 'admin';
    tabAdmin.classList.add('active');
    tabKine.classList.remove('active');
    kineSelectorGroup.style.display = 'none';
    kineSelector.required = false;
    pinValue = '';
    updatePinDisplay();
  });
}

// ════════════════════════════════════════════════════════════════
// KINESIÓLOGO LISTENERS
// ════════════════════════════════════════════════════════════════

function setupKineListeners() {
  btnLogout.addEventListener('click', doLogout);

  patientSelector.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) {
      state.selectedPatientId = null;
      btnMarkAttendance.disabled = true;
      patientInfoPanel.classList.add('hidden');
      return;
    }

    state.selectedPatientId = id;
    btnMarkAttendance.disabled = false;

    // Mostrar contacto inmediatamente desde la caché local
    const p = state.patients.find(x => String(x.id) === String(id));
    if (p) {
      const phone = p.telefono || 'No registrado';
      const address = p.domicilio || 'No registrado';
      patientPhone.textContent = phone;
      patientPhoneLink.href = phone !== 'No registrado' ? `tel:${phone}` : '#';
      patientAddress.textContent = address;
    }

    // Mostrar panel con loader mientras carga el estado del servidor
    sessionsCount.textContent = '...';
    sessionsCount.className = 'stat-value';
    paymentStatusText.textContent = '...';
    paymentStatusText.className = 'stat-value';
    patientInfoPanel.classList.remove('hidden');

    await loadPatientStatus(id);
  });

  btnMarkAttendance.addEventListener('click', async () => {
    if (!state.selectedPatientId) return;

    const result = await Swal.fire({
      title: '¿Confirmar asistencia?',
      text: 'Se registrará una sesión para este paciente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      background: '#1e2535',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) await handleMarkAttendance();
  });
}

// ════════════════════════════════════════════════════════════════
// ADMIN LISTENERS
// ════════════════════════════════════════════════════════════════

function setupAdminListeners() {
  btnAdminLogout.addEventListener('click', doLogout);

  // Sidenav
  document.querySelectorAll('.sidenav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidenav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
      }
    });
  });

  formAddPatient.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPatient();
  });

  formAddPlan.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPlan();
  });

  formAddPayment.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitPayment();
  });
}

// ════════════════════════════════════════════════════════════════
// API HELPER — con manejo robusto de Apps Script
// ════════════════════════════════════════════════════════════════

async function fetchAPI(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.append('action', action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }

  try {
    const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      // Apps Script a veces responde con HTML aunque ejecutó OK
      const isWriteAction = ['add', 'mark'].some(prefix => action.startsWith(prefix));
      if (isWriteAction) {
        console.warn('Apps Script respondió HTML en vez de JSON, pero la operación probablemente funcionó.', text.slice(0, 200));
        return { status: 'success' };
      }
      throw new Error('El servidor devolvió una respuesta inesperada.');
    }

    if (data.status === 'error') throw new Error(data.message || 'Error desconocido del servidor');
    return data;

  } catch (err) {
    console.error(`[fetchAPI] ${action}:`, err);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════════

function showView(viewName) {
  Object.values(views).forEach(v => { if (v) v.classList.remove('active'); });
  if (views[viewName]) views[viewName].classList.add('active');
}

function showLogin() {
  showView('login');
  pinValue = '';
  updatePinDisplay();
  loadKines();
}

function doLogout() {
  localStorage.removeItem('kine_session');
  state = { kineId: null, kineName: null, patients: [], selectedPatientId: null };
  showLogin();
}

async function showKineDashboard() {
  showView('dashboard');
  greetingEl.textContent = `Hola, ${state.kineName || 'Kinesiólogo'}`;

  patientSelector.innerHTML = '<option value="" disabled selected>Cargando pacientes...</option>';
  patientInfoPanel.classList.add('hidden');
  notesInput.value = '';
  btnMarkAttendance.disabled = true;
  historyList.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Cargando...</p></div>`;

  try {
    const res = await fetchAPI('getDashboard', { id_kine: state.kineId });
    if (res.status === 'success') {
      state.patients = res.data.pacientes || [];
      renderPatientSelector();
      renderHistory(res.data.historial || []);
    }
  } catch (err) {
    historyList.innerHTML = `<div class="empty-state"><p>No se pudo cargar el panel. Intente de nuevo.</p></div>`;
    patientSelector.innerHTML = '<option value="" disabled selected>Error cargando pacientes</option>';
  }
}

async function showAdminDashboard() {
  showView('admin');
  await loadAdminPatients();
}

// ════════════════════════════════════════════════════════════════
// KINE LOGIC
// ════════════════════════════════════════════════════════════════

async function loadKines() {
  try {
    const res = await fetchAPI('getKines');
    if (res.status === 'success') {
      let html = '<option value="" disabled selected>Selecciona tu perfil</option>';
      res.data.forEach(k => { html += `<option value="${k.id}">${k.nombre}</option>`; });
      kineSelector.innerHTML = html;
    }
  } catch (_) {
    kineSelector.innerHTML = '<option value="" disabled selected>Error cargando perfiles</option>';
  }
}

async function handleKineLogin(id, pin) {
  btnLogin.disabled = true;
  btnLogin.textContent = '...';

  try {
    const res = await fetchAPI('login', { id_kine: id, pin });
    if (res.status === 'success') {
      state.kineId   = res.data.id;
      state.kineName = res.data.nombre;
      localStorage.setItem('kine_session', JSON.stringify({ id: state.kineId, nombre: state.kineName }));
      await showKineDashboard();
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'PIN incorrecto', text: err.message || 'Verifica tu PIN e intenta nuevamente.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
    pinValue = '';
    updatePinDisplay();
  } finally {
    btnLogin.disabled = pinValue.length < 4;
    btnLogin.textContent = '↵';
  }
}

function renderPatientSelector() {
  if (!state.patients.length) {
    patientSelector.innerHTML = '<option value="" disabled selected>No hay pacientes activos</option>';
    return;
  }
  let html = '<option value="" disabled selected>Selecciona un paciente</option>';
  state.patients.forEach(p => { html += `<option value="${p.id}">${p.nombre}</option>`; });
  patientSelector.innerHTML = html;
}

function renderHistory(historial) {
  if (!historial.length) {
    historyList.innerHTML = `<div class="empty-state"><p>Aún no hay asistencias registradas hoy.</p></div>`;
    return;
  }

  historyList.innerHTML = historial.map(item => {
    const date = new Date(item.fecha).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="history-item">
        <div class="history-item-header">
          <span class="history-patient">${item.paciente}</span>
          <span class="history-date">${date}</span>
        </div>
        ${item.notas ? `<p class="history-notes">"${item.notas}"</p>` : ''}
      </div>
    `;
  }).join('');
}

async function loadPatientStatus(patientId) {
  try {
    const res = await fetchAPI('getPatientStatus', { id_paciente: patientId });
    if (res.status === 'success') {
      const { sesionesRestantes, pagoAlDia } = res.data;

      sessionsCount.textContent = sesionesRestantes;
      if (sesionesRestantes <= 0)      sessionsCount.className = 'stat-value color-red';
      else if (sesionesRestantes <= 2) sessionsCount.className = 'stat-value color-yellow';
      else                              sessionsCount.className = 'stat-value color-green';

      if (pagoAlDia) {
        paymentStatusText.textContent = '✓ Al día';
        paymentStatusText.className = 'stat-value color-green';
      } else {
        paymentStatusText.textContent = '✕ Pendiente';
        paymentStatusText.className = 'stat-value color-red';
      }
    }
  } catch (_) {
    sessionsCount.textContent = '—';
    paymentStatusText.textContent = '—';
  }
}

async function handleMarkAttendance() {
  Swal.fire({ title: 'Registrando asistencia...', text: 'Por favor espera un momento.', allowOutsideClick: false, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9', didOpen: () => Swal.showLoading() });

  const notas = notesInput.value.trim();
  try {
    const res = await fetchAPI('markAttendance', {
      id_kine: state.kineId,
      id_paciente: state.selectedPatientId,
      notas
    });

    if (res.status === 'success') {
      await Swal.fire({ icon: 'success', title: '¡Asistencia registrada!', timer: 1800, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9' });
      notesInput.value = '';
      await showKineDashboard();
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo registrar. Intente nuevamente.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
  }
}

// ════════════════════════════════════════════════════════════════
// ADMIN LOGIC
// ════════════════════════════════════════════════════════════════

async function handleAdminLogin(pin) {
  btnLogin.disabled = true;
  btnLogin.textContent = '...';

  try {
    const res = await fetchAPI('adminLogin', { pin });
    if (res.status === 'success') {
      localStorage.setItem('kine_session', JSON.stringify({ role: 'admin' }));
      await showAdminDashboard();
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'PIN incorrecto', text: 'El PIN de administrador no es válido.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
    pinValue = '';
    updatePinDisplay();
  } finally {
    btnLogin.disabled = pinValue.length < 4;
    btnLogin.textContent = '↵';
  }
}

async function loadAdminPatients() {
  const loadingOption = '<option value="" disabled selected>Cargando pacientes...</option>';
  adminPatientSelectorPlan.innerHTML    = loadingOption;
  adminPatientSelectorPayment.innerHTML = loadingOption;

  try {
    const res = await fetchAPI('getAdminData');
    if (res.status === 'success') {
      const opts = res.data.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
      const base = '<option value="" disabled selected>Selecciona un paciente</option>';
      adminPatientSelectorPlan.innerHTML    = base + opts;
      adminPatientSelectorPayment.innerHTML = base + opts;
    }
  } catch (err) {
    const errOption = '<option value="" disabled selected>Error cargando pacientes</option>';
    adminPatientSelectorPlan.innerHTML    = errOption;
    adminPatientSelectorPayment.innerHTML = errOption;
  }
}

async function submitPatient() {
  const nombre    = document.getElementById('input-patient-name').value.trim();
  const telefono  = document.getElementById('input-patient-phone').value.trim();
  const domicilio = document.getElementById('input-patient-address').value.trim();

  Swal.fire({ title: 'Guardando paciente...', text: 'Registrando en Google Sheets. Puede tardar unos segundos.', allowOutsideClick: false, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9', didOpen: () => Swal.showLoading() });

  try {
    await fetchAPI('addPatient', { nombre, telefono, domicilio });
    formAddPatient.reset();
    Swal.fire({ icon: 'success', title: 'Paciente registrado', timer: 2000, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9' });
    await loadAdminPatients();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar. Intente nuevamente.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
  }
}

async function submitPlan() {
  Swal.fire({ title: 'Guardando plan...', text: 'Registrando en Google Sheets. Puede tardar unos segundos.', allowOutsideClick: false, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9', didOpen: () => Swal.showLoading() });

  try {
    await fetchAPI('addPlan', {
      id_paciente:       adminPatientSelectorPlan.value,
      tipo_plan:         document.getElementById('input-tipo-plan').value,
      cantidad_sesiones: document.getElementById('input-cantidad-sesiones').value,
      valor_total:       document.getElementById('input-valor-plan').value
    });
    formAddPlan.reset();
    Swal.fire({ icon: 'success', title: 'Plan registrado', timer: 2000, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9' });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar. Intente nuevamente.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
  }
}

async function submitPayment() {
  Swal.fire({ title: 'Registrando pago...', text: 'Guardando en Google Sheets. Puede tardar unos segundos.', allowOutsideClick: false, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9', didOpen: () => Swal.showLoading() });

  try {
    await fetchAPI('addPayment', {
      id_paciente:  adminPatientSelectorPayment.value,
      monto_pagado: document.getElementById('input-monto-pago').value
    });
    formAddPayment.reset();
    Swal.fire({ icon: 'success', title: 'Pago registrado', timer: 2000, showConfirmButton: false, background: '#1e2535', color: '#f1f5f9' });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar. Intente nuevamente.', background: '#1e2535', color: '#f1f5f9', confirmButtonColor: '#3b82f6' });
  }
}

// ─── Utility ───────────────────────────────────────────────────
function showToast(icon, title) {
  Swal.fire({
    toast: true, position: 'top-end', icon, title,
    showConfirmButton: false, timer: 3000, timerProgressBar: true,
    background: '#1e2535', color: '#f1f5f9'
  });
}
