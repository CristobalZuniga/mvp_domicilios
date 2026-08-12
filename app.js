// --- Configuración ---
// TODO: El desarrollador debe reemplazar esta URL con la URL de su Web App de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbxZeBybZaiGqirVesIYaH67CdV5lExf_hZpT7bI7ph_Fx83cXSWUG1yX8GSZYLEPN0G/exec";

// --- Estado Global ---
let state = {
    kineId: null,
    kineName: null,
    patients: [],
    selectedPatientId: null
};

// --- Elementos del DOM ---
const views = {
    login: document.getElementById('login-view'),
    dashboard: document.getElementById('dashboard-view'),
    adminDashboard: document.getElementById('admin-dashboard-view')
};

const loginForm = document.getElementById('login-form');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');

const greeting = document.getElementById('greeting');
const patientSelector = document.getElementById('patient-selector');
const patientInfoPanel = document.getElementById('patient-info-panel');
const sessionsCount = document.getElementById('sessions-count');
const paymentStatus = document.getElementById('payment-status');
const notesInput = document.getElementById('notes-input');
const btnMarkAttendance = document.getElementById('btn-mark-attendance');
const historyList = document.getElementById('history-list');

// Elementos Admin
const tabKine = document.getElementById('tab-kine');
const tabAdmin = document.getElementById('tab-admin');
const kineSelectorGroup = document.getElementById('kine-selector-group');
const btnAdminLogout = document.getElementById('btn-admin-logout');
const formAddPlan = document.getElementById('form-add-plan');
const formAddPayment = document.getElementById('form-add-payment');
const adminPatientSelectorPlan = document.getElementById('admin-patient-selector-plan');
const adminPatientSelectorPayment = document.getElementById('admin-patient-selector-payment');
let currentLoginMode = 'kine'; // 'kine' | 'admin'

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay sesión activa (almacenada en localStorage para el MVP)
    const storedSession = localStorage.getItem('kine_session');
    if (storedSession) {
        const session = JSON.parse(storedSession);
        if (session.role === 'admin') {
            showAdminDashboard();
        } else {
            state.kineId = session.id;
            state.kineName = session.nombre;
            showDashboard();
        }
    } else {
        showLogin();
    }

    setupEventListeners();
});

// --- Event Listeners ---
function setupEventListeners() {
    // Login Tabs
    tabKine.addEventListener('click', () => {
        currentLoginMode = 'kine';
        tabKine.classList.add('active');
        tabAdmin.classList.remove('active');
        kineSelectorGroup.style.display = 'block';
    });
    
    tabAdmin.addEventListener('click', () => {
        currentLoginMode = 'admin';
        tabAdmin.classList.add('active');
        tabKine.classList.remove('active');
        kineSelectorGroup.style.display = 'none';
    });

    // Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('pin-input').value;
        
        if (currentLoginMode === 'kine') {
            const kineId = document.getElementById('kine-selector').value;
            if (!kineId || !pin) return;
            await handleLogin(kineId, pin);
        } else {
            if (!pin) return;
            await handleAdminLogin(pin);
        }
    });

    // Logout
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('kine_session');
        state = { kineId: null, kineName: null, patients: [], selectedPatientId: null };
        document.getElementById('pin-input').value = '';
        showLogin();
    });

    // Selección de paciente
    patientSelector.addEventListener('change', async (e) => {
        const patientId = e.target.value;
        if (patientId) {
            state.selectedPatientId = patientId;
            btnMarkAttendance.disabled = false;
            await loadPatientStatus(patientId);
        } else {
            state.selectedPatientId = null;
            btnMarkAttendance.disabled = true;
            patientInfoPanel.classList.add('hidden');
        }
    });

    // Marcar asistencia
    btnMarkAttendance.addEventListener('click', async () => {
        if (!state.selectedPatientId) return;

        // Confirmación
        const result = await Swal.fire({
            title: '¿Confirmar asistencia?',
            text: "Se registrará una sesión para este paciente.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0F62FE',
            cancelButtonColor: '#da1e28',
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            await handleMarkAttendance();
        }
    });

    // --- Listeners de Admin ---
    btnAdminLogout.addEventListener('click', () => {
        localStorage.removeItem('kine_session');
        document.getElementById('pin-input').value = '';
        showLogin();
    });

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
            
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.remove('hidden');
        });
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

// --- API Helpers ---
async function fetchAPI(action, params = {}) {
    // Para peticiones GET a Apps Script (recomendado para CORS básico)
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) throw new Error('Error en la red');

        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);

        return data;
    } catch (error) {
        console.error('Error API:', error);
        throw error;
    }
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// --- Lógica de Negocio ---
async function handleLogin(id, pin) {
    setButtonLoading(btnLogin, true);

    try {
        const res = await fetchAPI('login', { id_kine: id, pin: pin });

        if (res.status === 'success') {
            state.kineId = res.data.id;
            state.kineName = res.data.nombre;

            // Guardar sesión simple
            localStorage.setItem('kine_session', JSON.stringify({
                id: state.kineId,
                nombre: state.kineName
            }));

            showDashboard();
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de acceso',
            text: error.message || 'Credenciales inválidas. Intente nuevamente.',
            confirmButtonColor: '#0F62FE'
        });
    } finally {
        setButtonLoading(btnLogin, false);
    }
}

async function showDashboard() {
    views.login.classList.remove('active');
    views.dashboard.classList.add('active');

    greeting.textContent = `Hola, ${state.kineName}`;

    // Resetear form
    patientSelector.innerHTML = '<option value="" disabled selected>Cargando pacientes...</option>';
    patientInfoPanel.classList.add('hidden');
    notesInput.value = '';
    btnMarkAttendance.disabled = true;
    historyList.innerHTML = `
        <div class="empty-state">
            <div class="spinner-small"></div>
            <p>Cargando historial...</p>
        </div>
    `;

    try {
        const res = await fetchAPI('getDashboard', { id_kine: state.kineId });

        if (res.status === 'success') {
            state.patients = res.data.pacientes;
            renderPatientSelector();
            renderHistory(res.data.historial);
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del panel.',
            confirmButtonColor: '#0F62FE'
        });
    }
}

function renderPatientSelector() {
    if (state.patients.length === 0) {
        patientSelector.innerHTML = '<option value="" disabled selected>No hay pacientes activos</option>';
        return;
    }

    let html = '<option value="" disabled selected>Seleccione un paciente</option>';
    state.patients.forEach(p => {
        html += `<option value="${p.id}">${p.nombre}</option>`;
    });
    patientSelector.innerHTML = html;
}

function renderHistory(historial) {
    if (!historial || historial.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <p>Aún no hay asistencias registradas.</p>
            </div>
        `;
        return;
    }

    let html = '';
    historial.forEach(item => {
        const date = new Date(item.fecha).toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        html += `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-patient">${item.paciente}</span>
                    <span class="history-date">${date}</span>
                </div>
                ${item.notas ? `<p class="history-notes">"${item.notas}"</p>` : ''}
            </div>
        `;
    });

    historyList.innerHTML = html;
}

async function loadPatientStatus(patientId) {
    // Mostrar loader interno
    patientInfoPanel.classList.remove('hidden');
    sessionsCount.textContent = '...';
    sessionsCount.className = 'info-value'; // Reset color

    const statusText = paymentStatus.querySelector('.status-text');
    paymentStatus.className = 'status-badge';
    statusText.textContent = 'Cargando...';

    try {
        const res = await fetchAPI('getPatientStatus', { id_paciente: patientId });

        if (res.status === 'success') {
            const { sesionesRestantes, pagoAlDia } = res.data;

            // Actualizar Sesiones
            sessionsCount.textContent = sesionesRestantes;
            if (sesionesRestantes <= 0) {
                sessionsCount.classList.add('error');
            } else if (sesionesRestantes <= 2) {
                sessionsCount.style.color = 'var(--warning)';
            } else {
                sessionsCount.classList.add('highlight-blue');
            }

            // Actualizar Semáforo
            if (pagoAlDia) {
                paymentStatus.className = 'status-badge success';
                statusText.textContent = 'Al día';
            } else {
                paymentStatus.className = 'status-badge error';
                statusText.textContent = 'Pago pendiente';
            }
        }
    } catch (error) {
        patientInfoPanel.classList.add('hidden');
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo obtener el estado del paciente.',
            confirmButtonColor: '#0F62FE'
        });
    }
}

async function handleMarkAttendance() {
    setButtonLoading(btnMarkAttendance, true);
    const notas = notesInput.value.trim();

    try {
        const res = await fetchAPI('markAttendance', {
            id_kine: state.kineId,
            id_paciente: state.selectedPatientId,
            notas: notas
        });

        if (res.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: '¡Asistencia registrada!',
                text: 'La sesión se ha guardado correctamente.',
                confirmButtonColor: '#0F62FE',
                timer: 2000,
                showConfirmButton: false
            });

            // Recargar dashboard para actualizar historial y estado
            showDashboard();
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo registrar la asistencia. Intente nuevamente.',
            confirmButtonColor: '#0F62FE'
        });
    } finally {
        setButtonLoading(btnMarkAttendance, false);
    }
}

// --- Navegación simple ---
function showLogin() {
    views.dashboard.classList.remove('active');
    if (views.adminDashboard) views.adminDashboard.classList.remove('active');
    views.login.classList.add('active');
    loadKines();
}

async function loadKines() {
    const kineSelector = document.getElementById('kine-selector');
    try {
        const res = await fetchAPI('getKines');
        if (res.status === 'success') {
            let html = '<option value="" disabled selected>Seleccione su perfil</option>';
            res.data.forEach(k => {
                html += `<option value="${k.id}">${k.nombre} (ID: ${k.id})</option>`;
            });
            kineSelector.innerHTML = html;
        }
    } catch (error) {
        kineSelector.innerHTML = '<option value="" disabled selected>Error cargando perfiles</option>';
    }
}

// --- Funciones de Administrador ---

async function handleAdminLogin(pin) {
    setButtonLoading(btnLogin, true);
    try {
        const res = await fetchAPI('adminLogin', { pin: pin });
        if (res.status === 'success') {
            localStorage.setItem('kine_session', JSON.stringify({ role: 'admin' }));
            showAdminDashboard();
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de acceso',
            text: 'PIN de administrador incorrecto.',
            confirmButtonColor: '#0F62FE'
        });
    } finally {
        setButtonLoading(btnLogin, false);
    }
}

async function showAdminDashboard() {
    views.login.classList.remove('active');
    views.dashboard.classList.remove('active');
    views.adminDashboard.classList.add('active');
    
    // Cargar lista de pacientes
    try {
        const res = await fetchAPI('getAdminData');
        if (res.status === 'success') {
            let html = '<option value="" disabled selected>Seleccione un paciente</option>';
            res.data.pacientes.forEach(p => {
                html += `<option value="${p.id}">${p.nombre}</option>`;
            });
            adminPatientSelectorPlan.innerHTML = html;
            adminPatientSelectorPayment.innerHTML = html;
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la base de datos.',
            confirmButtonColor: '#0F62FE'
        });
    }
}

async function submitPlan() {
    const btnSubmit = document.getElementById('btn-submit-plan');
    setButtonLoading(btnSubmit, true);
    
    try {
        const res = await fetchAPI('addPlan', {
            id_paciente: adminPatientSelectorPlan.value,
            tipo_plan: document.getElementById('input-tipo-plan').value,
            cantidad_sesiones: document.getElementById('input-cantidad-sesiones').value,
            valor_total: document.getElementById('input-valor-plan').value
        });
        
        if (res.status === 'success') {
            Swal.fire('Éxito', 'Plan registrado en Google Sheets', 'success');
            formAddPlan.reset();
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo guardar el plan', 'error');
    } finally {
        setButtonLoading(btnSubmit, false);
    }
}

async function submitPayment() {
    const btnSubmit = document.getElementById('btn-submit-payment');
    setButtonLoading(btnSubmit, true);
    
    try {
        const res = await fetchAPI('addPayment', {
            id_paciente: adminPatientSelectorPayment.value,
            monto_pagado: document.getElementById('input-monto-pago').value
        });
        
        if (res.status === 'success') {
            Swal.fire('Éxito', 'Pago registrado en Google Sheets', 'success');
            formAddPayment.reset();
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo guardar el pago', 'error');
    } finally {
        setButtonLoading(btnSubmit, false);
    }
}
