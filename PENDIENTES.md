# Pendientes — Control Remoto Clientes

Estado de referencia: autenticación individual y configuración inicial de PIN probadas correctamente en localhost contra el Apps Script desplegado.

## Obligatorio antes de producción

- [ ] **Completar el alta de PIN de todos los usuarios.**
  - Cada celda de `Usuarios!C` debe contener un hash que comience con `v1:`.
  - Nunca escribir ni conservar PIN en texto claro dentro de la hoja.

- [ ] **Cerrar la autoactivación cuando todos tengan PIN.**
  - Ejecutar en Apps Script: `desactivarAccesoSinPin`.
  - Verificar en Script Properties:
    - `ALLOW_SELF_PIN_SETUP=false`
    - `ALLOW_PINLESS_LOGIN=false`

- [ ] **Rotar el token global que sigue vigente durante testing.**
  1. Generar un token nuevo fuera del repositorio.
  2. Actualizar `API_TOKEN` en Script Properties.
  3. Actualizar `VITE_API_TOKEN` en el `.env` local.
  4. Recompilar frontend y APK.
  5. Retirar las compilaciones que contienen el token anterior.

- [ ] **Validar la política de sesión completa.**
  - Cinco PIN incorrectos bloquean durante 15 minutos.
  - Sesión inactiva durante 60 minutos.
  - Duración máxima de sesión de 4 horas.
  - Sesión revocada vuelve a la pantalla de acceso y limpia las filas en memoria.
  - Cambio de usuario limpia sesión, navegación y datos privados.

- [ ] **Probar permisos con cuentas reales de cada rol.**
  - `USUARIO`: edita datos permitidos, Presentado y Archivado; no cambia Encargado.
  - `ADMINISTRADOR` y `SUPERUSUARIO`: pueden asignar y cambiar Encargado.
  - Confirmar que el backend rechaza una asignación no autorizada, aunque se intente fuera de la interfaz.

## Aplicación Android

- [ ] Incrementar `versionCode` y `versionName` antes de distribuir una actualización.
- [ ] Ejecutar `npm run build` con el `.env` correcto.
- [ ] Ejecutar `npx cap sync android`.
- [ ] Compilar, firmar e instalar un APK actualizado desde Android Studio.
- [ ] Probar alta inicial, login, cambio de usuario, expiración y permisos desde el teléfono.
- [ ] No seguir utilizando el APK antiguo: no entiende el contrato de sesiones individuales.

## Recuperación y gestión de usuarios

- [x] Agregar una opción autenticada **Cambiar mi PIN**.
  - Implementada en `AppsScript-Code-auth-PROPUESTA.gs` (acción `changePin`),
    `src/api.js`, `src/components/PinChangeDialog.jsx` y `src/App.jsx`.
  - Falta desplegar el backend actualizado y probar contra el Web App real.
- [ ] Evaluar un panel exclusivo para `SUPERUSUARIO` que restablezca un PIN temporal y fuerce su cambio.
- [ ] Implementar baja/reactivación de usuarios y revocación inmediata de todas sus sesiones.
- [ ] Evaluar validación al recuperar el foco y bloqueo `fail closed` cuando no se pueda renovar autorización.

### Recuperación manual disponible actualmente

1. Crear temporalmente `PIN_SETUP_USER` y `PIN_SETUP_VALUE` en Script Properties.
2. Ejecutar `aplicarPinPendienteDesdeProperties`.
3. La función reemplaza el hash, revoca las sesiones y elimina ambas propiedades temporales.
4. Se establece un PIN nuevo; el PIN anterior no se recupera ni se muestra.

## Funciones pendientes fuera de autenticación

- [ ] Implementar `action: "create"` en el backend antes de habilitar definitivamente el alta de nuevos clientes.
- [ ] Configurar el ID definitivo de la extensión donde corresponda.
- [ ] Definir, si se necesita una aplicación de PC, el puerto/origen y protocolo del puente local.
- [ ] Revisar los warnings heredados del lint y el estado de dependencias con `npm audit` en una tarea separada.
- [ ] Actualizar la documentación general del `README.md`, que todavía describe el flujo inicial del proyecto.

## Operación y respaldo

- [ ] Conservar el backup privado del `Code.gs` anterior mientras dure la migración.
- [ ] Conservar una versión anterior del Web App para rollback hasta terminar las pruebas.
- [ ] Mantener fuera de Git y del chat:
  - `API_TOKEN`;
  - `PIN_PEPPER`;
  - PIN reales;
  - IDs reales de planillas;
  - URLs privadas de despliegue.
- [ ] Al copiar `AppsScript-Code-auth-PROPUESTA.gs` a Apps Script, reemplazar localmente `REEMPLAZAR_POR_TU_ID_ACTUAL` y verificar el mapeo real de la pestaña `Planillas`.

## Estado de los hallazgos originales

- [ ] **Punto 1:** transporte POST y `doGet` bloqueado; falta rotar el token global antes de producción.
- [ ] **Punto 2:** autenticación y autorización implementadas; falta cerrar autoactivación, terminar pruebas y agregar gestión de bajas si se requiere.
- [x] **Punto 3:** extensión Marangatu convertida en puente sin persistencia independiente.
- [x] **Punto 4:** orígenes de la extensión restringidos a localhost.
- [x] **Punto 5:** backup Android desactivado.
- [x] **Punto 6:** archivo vacío eliminado.
