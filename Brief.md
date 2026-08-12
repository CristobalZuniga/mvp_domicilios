Brief Técnico: MVP Gestión de Kinesiología a Domicilio
1. Resumen del Proyecto

Desarrollo de un MVP serverless para gestionar asistencias, sesiones y estado de pagos de pacientes de kinesiología a domicilio.
El sistema separa estrictamente la administración financiera (gestionada exclusivamente por el administrador en Google Sheets) de la operación clínica (gestionada por los kinesiólogos a través de una interfaz web estática).
2. Stack Tecnológico

    Base de Datos / Backend: Google Sheets.

    API / Lógica de Negocio: Google Apps Script (Desplegado como Web App).

    Frontend: HTML5, CSS3, Vanilla JavaScript (Alojado en GitHub Pages).

3. Fase 1: Arquitectura de la Base de Datos (Google Sheets)

El administrador creará un archivo de Google Sheets que será totalmente privado. Solo él tendrá acceso directo al archivo para proteger la privacidad financiera de los pacientes. El archivo contendrá 5 pestañas:
Pestañas y Columnas requeridas:

    Kinesiologos: ID_Kine | Nombre | PIN_Acceso

    Pacientes: ID_Paciente | Nombre | Telefono | Domicilio | Estado_Activo (TRUE/FALSE)

    Compras_Planes: ID_Compra | Fecha | ID_Paciente | Tipo_Plan | Cantidad_Sesiones | Valor_Total

    Pagos: ID_Pago | Fecha | ID_Paciente | Monto_Pagado

    Asistencias: ID_Sesion | Fecha_Hora_Marca | ID_Kine | ID_Paciente | Notas | GpsLat | GpsLong

4. Fase 2: Desarrollo del Backend y API (Google Apps Script)

El script actuará como middleware. Se debe implementar utilizando los métodos doGet() y doPost() para recibir peticiones desde el frontend. Al desplegarse, debe configurarse como: Ejecutar como "Usuario que despliega la aplicación (Admin)" y Quién tiene acceso "Cualquier persona".
Reglas de Negocio a programar en el Script:

    Seguridad y CORS: Habilitar cabeceras CORS para permitir peticiones desde el dominio de GitHub Pages.

    Autenticación: Validar que el ID_Kine y el PIN_Acceso coincidan en la hoja Kinesiologos antes de devolver cualquier dato.

    Cálculo de "Cuenta Corriente" (Ocultamiento de datos financieros):

        Sesiones Restantes: Sumar Cantidad_Sesiones de Compras_Planes para un paciente, menos la cantidad de filas en Asistencias para ese mismo paciente.

        Semáforo de Pagos: Sumar Valor_Total de Compras_Planes y restarle la suma de Monto_Pagado en Pagos. Si el saldo es <= 0, devolver pago_al_dia: true. Si es > 0, devolver pago_al_dia: false. Por seguridad, el backend NO debe enviar los montos en dinero al frontend, solo el booleano.

Endpoints (Acciones) requeridos:

    action=login: Recibe ID y PIN. Devuelve Token/Éxito.

    action=getDashboard: Recibe ID_Kine validado. Devuelve lista de pacientes activos y las últimas 5 asistencias registradas por ese kine.

    action=getPatientStatus: Recibe ID_Paciente. Devuelve cantidad de sesiones restantes y estado de pago (booleano).

    action=markAttendance: Recibe ID_Kine, ID_Paciente, Notas. Estampa la fecha y hora actual generada por el servidor de Google (no confiar en la hora del cliente) e inserta la fila en Asistencias.

5. Fase 3: Desarrollo del Frontend (GitHub Pages)

Sitio web estático, mobile-first (optimizado para celulares, ya que se usará en terreno), sin frameworks complejos.
Vistas y UI:

    Pantalla de Login:

        Selector (Dropdown) con los nombres de los kinesiólogos.

        Input numérico (type="password") para el PIN de 4 dígitos.

        Botón "Ingresar".

    Pantalla Principal (Dashboard):

        Saludo: "Hola, [Nombre del Kine]".

        Sección A (Nueva Asistencia):

            Buscador/Selector de Pacientes.

            Al seleccionar paciente, se dispara la consulta al backend y se muestra un panel informativo:

                Indicador de Sesiones: "Quedan X sesiones de su plan".

                Semáforo de Pagos: 🟢 "Al día" o 🔴 "Pendiente de regularizar pago".

            Input de texto opcional para "Notas de la sesión".

            Botón de Acción: "Marcar Asistencia". Con alerta de confirmación (SweetAlert o nativa) y loader mientras procesa.

        Sección B (Historial):

            Lista de las últimas sesiones marcadas por el profesional conectado.

6. Fase 4: Integración y Despliegue

    Configuración del entorno: El desarrollador deberá proporcionar el código de Apps Script. El Administrador (Dueño) deberá pegarlo en su entorno de Google Workspace, desplegarlo como Web App y generar la URL pública.

    Conexión: El desarrollador insertará esa URL pública de Google en el código JavaScript del frontend (const API_URL = "[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)";).

    Subida a GitHub: Se suben los archivos estáticos (index.html, style.css, app.js) a un repositorio público o privado en GitHub y se activa GitHub Pages.