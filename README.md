# KineControl - MVP de Gestión a Domicilio

Este proyecto es un Producto Mínimo Viable (MVP) diseñado para gestionar las asistencias y los estados de pago de pacientes de kinesiología a domicilio, separando estrictamente la administración financiera (en manos del administrador) de la operación clínica (realizada por el profesional en terreno).

## Arquitectura

- **Base de Datos / Backend**: Google Sheets.
- **API**: Google Apps Script (actúa como intermediario).
- **Frontend**: HTML5, CSS3, JavaScript Vanilla (diseñado Mobile-First para uso en terreno).

---

## 🛠️ Guía de Despliegue para el Administrador

Sigue estos pasos cuidadosamente para poner en marcha el sistema.

### Paso 1: Configurar la Base de Datos (Google Sheets)

1. Crea un nuevo archivo de Google Sheets. **Mantenlo privado**.
2. Crea exactamente **5 pestañas** con los siguientes nombres exactos (respetando mayúsculas y minúsculas):
   - `Kinesiologos`
   - `Pacientes`
   - `Compras_Planes`
   - `Pagos`
   - `Asistencias`

3. Agrega las siguientes columnas en la fila 1 de cada pestaña:

   **Pestaña: `Kinesiologos`**
   - A1: `ID_Kine`
   - B1: `Nombre`
   - C1: `PIN_Acceso`
   *(Ejemplo: ID_Kine: 1, Nombre: Juan Perez, PIN_Acceso: 1234)*

   **Pestaña: `Pacientes`**
   - A1: `ID_Paciente`
   - B1: `Nombre`
   - C1: `Telefono`
   - D1: `Domicilio`
   - E1: `Estado_Activo`
   *(Nota: Estado_Activo debe ser TRUE o FALSE)*

   **Pestaña: `Compras_Planes`**
   - A1: `ID_Compra`
   - B1: `Fecha`
   - C1: `ID_Paciente`
   - D1: `Tipo_Plan`
   - E1: `Cantidad_Sesiones`
   - F1: `Valor_Total`

   **Pestaña: `Pagos`**
   - A1: `ID_Pago`
   - B1: `Fecha`
   - C1: `ID_Paciente`
   - D1: `Monto_Pagado`

   **Pestaña: `Asistencias`**
   - A1: `ID_Sesion`
   - B1: `Fecha_Hora_Marca`
   - C1: `ID_Kine`
   - D1: `ID_Paciente`
   - E1: `Notas`

### Paso 2: Desplegar la API (Google Apps Script)

1. En tu Google Sheets recién creado, ve al menú superior: **Extensiones > Apps Script**.
2. Se abrirá una nueva pestaña. Borra el código que aparece por defecto (`function myFunction() {...}`).
3. Abre el archivo `backend/Code.gs` de este repositorio. Copia todo su contenido y pégalo en el editor de Apps Script.
4. Haz clic en el icono del disquete 💾 o presiona `Ctrl + S` para guardar el proyecto (ponle un nombre como "Backend KineControl").
5. Haz clic en el botón azul **Implementar** (arriba a la derecha) > **Nueva implementación**.
6. En "Seleccionar tipo", elige **Aplicación web** (el ícono del engranaje ⚙️).
7. Completa la configuración exactamente así:
   - **Descripción**: v1
   - **Ejecutar como**: `Yo (tu_correo@gmail.com)`
   - **Quién tiene acceso**: `Cualquier persona` (¡Muy importante para que funcione!)
8. Haz clic en **Implementar**.
9. Google te pedirá autorizar accesos. Haz clic en "Autorizar accesos", elige tu cuenta. Si aparece una advertencia de seguridad, haz clic en "Avanzado" (abajo) y luego en "Ir a Backend KineControl (inseguro)". Otorga los permisos.
10. Copia la **URL de la aplicación web** que te generará al final. Comienza con `https://script.google.com/macros/s/.../exec`.

### Paso 3: Conectar Frontend con Backend

1. Ve al archivo `frontend/app.js` de este proyecto.
2. En la línea 3, reemplaza la URL de prueba por la que copiaste en el paso anterior:
   ```javascript
   const API_URL = "TU_URL_AQUI";
   ```

### Paso 4: Publicar el Frontend

Sube los archivos (`index.html`, `style.css` y `app.js`) a un servicio de hosting estático como GitHub Pages, Netlify o Vercel. En GitHub Pages, ve a Settings > Pages y selecciona la rama `main` en la ruta `/ (root)` para desplegar.

---

## 🔒 Consideraciones de Seguridad

- **No compartas el Google Sheets con los kinesiólogos.** El frontend actúa como una capa que solo les muestra lo que necesitan ver.
- El código backend nunca envía información sobre montos de dinero al frontend (solo envía un estado `true`/`false` de si el pago está al día).
- Todo registro de asistencia se graba con la hora del servidor de Google para evitar manipulaciones de hora desde el celular del profesional.
