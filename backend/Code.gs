// backend/Code.gs

function doGet(e) {
  return handleResponse(e);
}

function doPost(e) {
  return handleResponse(e);
}

// Configurar Cabeceras CORS
function setCorsHeaders(output) {
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

// Manejo de peticiones
function handleResponse(e) {
  // Manejo de peticiones OPTIONS (CORS preflight)
  if (typeof e === 'undefined' || !e.parameter) {
    return setCorsHeaders({ status: 'error', message: 'No parameters provided' });
  }

  const action = e.parameter.action;
  
  try {
    switch (action) {
      case 'getKines':
        return setCorsHeaders(getKines());
      case 'login':
        return setCorsHeaders(login(e.parameter.id_kine, e.parameter.pin));
      case 'getDashboard':
        return setCorsHeaders(getDashboard(e.parameter.id_kine));
      case 'getPatientStatus':
        return setCorsHeaders(getPatientStatus(e.parameter.id_paciente));
      case 'markAttendance':
        return setCorsHeaders(markAttendance(
          e.parameter.id_kine, 
          e.parameter.id_paciente, 
          e.parameter.notas
        ));
      case 'adminLogin':
        return setCorsHeaders(adminLogin(e.parameter.pin));
      case 'getAdminData':
        return setCorsHeaders(getAdminData());
      case 'getPatientOverview':
        return setCorsHeaders(getPatientOverview());
      case 'addPlan':
        return setCorsHeaders(addPlan(
          e.parameter.id_paciente,
          e.parameter.tipo_plan,
          e.parameter.cantidad_sesiones,
          e.parameter.valor_total
        ));
      case 'addPayment':
        return setCorsHeaders(addPayment(
          e.parameter.id_paciente,
          e.parameter.monto_pagado
        ));
      case 'addPatient':
        return setCorsHeaders(addPatient(
          e.parameter.nombre,
          e.parameter.telefono,
          e.parameter.domicilio
        ));
      default:
        return setCorsHeaders({ status: 'error', message: 'Action not found' });
    }
  } catch (error) {
    return setCorsHeaders({ status: 'error', message: error.toString() });
  }
}

// Helper para obtener datos de una hoja
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Hoja ${sheetName} no encontrada`);
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

// 1. Endpoint Login
function login(idKine, pin) {
  const kines = getSheetData('Kinesiologos');
  
  // Buscar kinesiólogo que coincida
  const kine = kines.find(k => k.ID_Kine.toString() === idKine.toString() && k.PIN_Acceso.toString() === pin.toString());
  
  if (kine) {
    return { 
      status: 'success', 
      data: { 
        id: kine.ID_Kine, 
        nombre: kine.Nombre 
      } 
    };
  } else {
    return { status: 'error', message: 'Credenciales inválidas' };
  }
}

// 1.5. Endpoint Obtener Kinesiólogos
function getKines() {
  try {
    const kines = getSheetData('Kinesiologos');
    const kinesList = kines.map(k => ({
      id: k.ID_Kine,
      nombre: k.Nombre
    }));
    return { status: 'success', data: kinesList };
  } catch (error) {
    return { status: 'error', message: 'No se pudieron cargar los kinesiólogos' };
  }
}

// 2. Endpoint Dashboard
function getDashboard(idKine) {
  const pacientes = getSheetData('Pacientes');
  const asistencias = getSheetData('Asistencias');
  
  // Filtrar pacientes activos
  const pacientesActivos = pacientes
    .filter(p => p.Estado_Activo === true || p.Estado_Activo === 'TRUE' || p.Estado_Activo === 1)
    .map(p => ({
      id: p.ID_Paciente,
      nombre: p.Nombre,
      telefono: p.Telefono,
      domicilio: p.Domicilio
    }));
    
  // Últimas 5 asistencias del kinesiólogo
  const ultimasAsistencias = asistencias
    .filter(a => a.ID_Kine.toString() === idKine.toString())
    .sort((a, b) => new Date(b.Fecha_Hora_Marca) - new Date(a.Fecha_Hora_Marca))
    .slice(0, 5)
    .map(a => {
      const paciente = pacientes.find(p => p.ID_Paciente.toString() === a.ID_Paciente.toString());
      return {
        id_sesion: a.ID_Sesion,
        fecha: a.Fecha_Hora_Marca,
        paciente: paciente ? paciente.Nombre : 'Desconocido',
        notas: a.Notas
      };
    });
    
  return {
    status: 'success',
    data: {
      pacientes: pacientesActivos,
      historial: ultimasAsistencias
    }
  };
}

// 3. Endpoint Estado Paciente (Cálculo de Cuenta Corriente)
function getPatientStatus(idPaciente) {
  const compras = getSheetData('Compras_Planes');
  const asistencias = getSheetData('Asistencias');
  const pagos = getSheetData('Pagos');
  
  // Calcular sesiones restantes
  const comprasPaciente = compras.filter(c => c.ID_Paciente.toString() === idPaciente.toString());
  const totalSesionesCompradas = comprasPaciente.reduce((sum, c) => sum + Number(c.Cantidad_Sesiones || 0), 0);
  
  const asistenciasPaciente = asistencias.filter(a => a.ID_Paciente.toString() === idPaciente.toString());
  const totalSesionesRealizadas = asistenciasPaciente.length;
  
  const sesionesRestantes = totalSesionesCompradas - totalSesionesRealizadas;
  
  // Calcular Semáforo de Pagos
  const totalValorCompras = comprasPaciente.reduce((sum, c) => sum + Number(c.Valor_Total || 0), 0);
  
  const pagosPaciente = pagos.filter(p => p.ID_Paciente.toString() === idPaciente.toString());
  const totalPagado = pagosPaciente.reduce((sum, p) => sum + Number(p.Monto_Pagado || 0), 0);
  
  const saldoPendiente = totalValorCompras - totalPagado;
  
  const pagoAlDia = saldoPendiente <= 0;
  
  return {
    status: 'success',
    data: {
      sesionesRestantes: sesionesRestantes,
      pagoAlDia: pagoAlDia // Solo boolean, sin datos financieros
    }
  };
}

// 4. Endpoint Marcar Asistencia
function markAttendance(idKine, idPaciente, notas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Asistencias');
  if (!sheet) throw new Error('Hoja Asistencias no encontrada');
  
  const idSesion = 'SES-' + new Date().getTime();
  const fechaHoraServidor = new Date(); // Estampa de hora segura generada en el servidor
  
  // Insertar fila
  // ID_Sesion | Fecha_Hora_Marca | ID_Kine | ID_Paciente | Notas
  sheet.appendRow([
    idSesion,
    fechaHoraServidor,
    idKine,
    idPaciente,
    notas || ''
  ]);
  
  return {
    status: 'success',
    message: 'Asistencia registrada correctamente',
    data: {
      id_sesion: idSesion,
      fecha: fechaHoraServidor
    }
  };
}

// --- FUNCIONES DE ADMINISTRADOR ---

function adminLogin(pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Administradores');
  
  if (sheet) {
    const data = getSheetData('Administradores');
    const admin = data.find(a => a.PIN_Acceso && a.PIN_Acceso.toString() === pin.toString());
    if (admin) {
      return { status: 'success', data: { role: 'admin' } };
    }
  } else {
    if (pin === '9999') { // Hardcoded fallback for MVP if sheet doesn't exist
      return { status: 'success', data: { role: 'admin' } };
    }
  }
  return { status: 'error', message: 'Credenciales de administrador inválidas' };
}

function getAdminData() {
  const pacientes = getSheetData('Pacientes');
  const pacientesList = pacientes.map(p => ({
    id: p.ID_Paciente,
    nombre: p.Nombre
  }));
  return { status: 'success', data: { pacientes: pacientesList } };
}

function addPlan(idPaciente, tipoPlan, cantidadSesiones, valorTotal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Compras_Planes');
  if (!sheet) throw new Error('Hoja Compras_Planes no encontrada');
  
  const idCompra = 'CMP-' + new Date().getTime();
  
  sheet.appendRow([
    idCompra,
    new Date(),
    idPaciente,
    tipoPlan,
    cantidadSesiones,
    valorTotal
  ]);
  
  return { status: 'success', message: 'Plan registrado correctamente' };
}

function addPayment(idPaciente, montoPagado) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pagos');
  if (!sheet) throw new Error('Hoja Pagos no encontrada');
  
  const idPago = 'PAG-' + new Date().getTime();
  
  sheet.appendRow([
    idPago,
    new Date(),
    idPaciente,
    montoPagado
  ]);
  
  return { status: 'success', message: 'Pago registrado correctamente' };
}

function addPatient(nombre, telefono, domicilio) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pacientes');
  if (!sheet) throw new Error('Hoja Pacientes no encontrada');
  
  const idPaciente = 'PAC-' + new Date().getTime();
  
  sheet.appendRow([
    idPaciente,
    nombre,
    telefono,
    domicilio,
    true
  ]);
  
  return { 
    status: 'success', 
    message: 'Paciente registrado correctamente',
    data: { id: idPaciente, nombre: nombre } 
  };
}

// --- RESUMEN DE PACIENTES (Admin Overview) ---
function getPatientOverview() {
  const pacientes   = getSheetData('Pacientes');
  const compras     = getSheetData('Compras_Planes');
  const asistencias = getSheetData('Asistencias');
  const pagos       = getSheetData('Pagos');

  const activePacientes = pacientes.filter(p =>
    p.Estado_Activo === true || p.Estado_Activo === 'TRUE' || p.Estado_Activo === 1
  );

  const overview = activePacientes.map(p => {
    const id = p.ID_Paciente ? p.ID_Paciente.toString() : '';

    const comprasPac = compras.filter(c => c.ID_Paciente && c.ID_Paciente.toString() === id);
    const totalSesionesCompradas = comprasPac.reduce((s, c) => s + Number(c.Cantidad_Sesiones || 0), 0);
    const totalValorCompras      = comprasPac.reduce((s, c) => s + Number(c.Valor_Total || 0), 0);

    const asistPac = asistencias.filter(a => a.ID_Paciente && a.ID_Paciente.toString() === id);
    const totalSesionesRealizadas = asistPac.length;

    const pagosPac   = pagos.filter(pg => pg.ID_Paciente && pg.ID_Paciente.toString() === id);
    const totalPagado = pagosPac.reduce((s, pg) => s + Number(pg.Monto_Pagado || 0), 0);

    const sesionesRestantes = totalSesionesCompradas - totalSesionesRealizadas;
    const saldoPendiente    = totalValorCompras - totalPagado;
    const tienePlan         = comprasPac.length > 0;

    return {
      id:                   id,
      nombre:               p.Nombre || '(Sin nombre)',
      telefono:             p.Telefono || '',
      sesionesRestantes:    sesionesRestantes,
      totalSesiones:        totalSesionesCompradas,
      realizadas:           totalSesionesRealizadas,
      saldoPendiente:       saldoPendiente,
      totalPagado:          totalPagado,
      totalDeuda:           totalValorCompras,
      tienePlan:            tienePlan,
      pagoAlDia:            saldoPendiente <= 0
    };
  });

  // Ordenar: primero los con problemas (deuda o sin sesiones)
  overview.sort((a, b) => {
    const scoreA = (a.saldoPendiente > 0 ? 2 : 0) + (a.sesionesRestantes <= 2 ? 1 : 0);
    const scoreB = (b.saldoPendiente > 0 ? 2 : 0) + (b.sesionesRestantes <= 2 ? 1 : 0);
    return scoreB - scoreA;
  });

  return { status: 'success', data: overview };
}
