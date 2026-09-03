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
    `src/api.js`, `src/components/SettingsDialog.jsx` y `src/App.jsx`.
  - Vive dentro del modal **Configuración**, junto con el tema claro/oscuro.
  - El cambio de usuario queda donde estaba (píldora de usuario en la barra),
    sin exponerlo para usuarios normales en el panel de Configuración.
  - Falta desplegar el backend actualizado y probar contra el Web App real.
- [ ] Evaluar un panel exclusivo para `SUPERUSUARIO` que restablezca un PIN temporal y fuerce su cambio.
- [ ] Implementar baja/reactivación de usuarios y revocación inmediata de todas sus sesiones.
- [ ] Evaluar validación al recuperar el foco y bloqueo `fail closed` cuando no se pueda renovar autorización.

### Recuperación manual disponible actualmente

1. Crear temporalmente `PIN_SETUP_USER` y `PIN_SETUP_VALUE` en Script Properties.
2. Ejecutar `aplicarPinPendienteDesdeProperties`.
3. La función reemplaza el hash, revoca las sesiones y elimina ambas propiedades temporales.
4. Se establece un PIN nuevo; el PIN anterior no se recupera ni se muestra.

## Migración a la nueva interfaz (UI ejecutiva)

Estado: la UI ejecutiva es la que se monta en `src/main.jsx`
(`uiMode="executive"`). La lista anterior (`ClientList`) ya no existe como
archivo, así que lo que no se haya reimplementado en `ExecutiveDashboard`
quedó fuera de la aplicación aunque su CSS siga en `styles.css`.

### Migrado

- [x] **Legibilidad del texto.** El tema ejecutivo fijaba tamaños de 7, 8, 9
  y 10px en 39 reglas. Ahora hay una escala tipográfica con tokens
  (`--rx-fs-*` en `preview.css`), con **12px como mínimo**, y todos los
  contenedores que tenían alto/ancho fijo pasaron a medirse en `em` o
  `minmax()` para que nada se corte al agrandar.
- [x] **Tamaño de texto configurable.** Configuración → Preferencias →
  *Tamaño de texto* (Compacto / Normal / Grande / Extra). Se guarda por
  dispositivo (`src/uiPreferences.js`) y multiplica toda la escala vía
  `--ui-font-scale`.
- [x] **Zoom del sistema habilitado.** `index.html` ya no usa
  `maximum-scale=1, user-scalable=no`, que impedía agrandar con el pellizco.
- [x] **Rendimiento de la lista.** La tabla renderizaba todas las filas de
  una vez (~3.600 nodos con 300 clientes). Ahora usa virtualización con
  `@tanstack/react-virtual` —la dependencia ya estaba instalada y sin
  usar—, la fila es un componente memoizado y el estado derivado de cada
  fila se calcula una sola vez en un `Map` en lugar de recalcularse dentro
  del `sort` y del render.
- [x] **Búsqueda sin trabas.** El input tiene estado propio y la lista se
  actualiza con `useDeferredValue`, así escribir no espera al filtrado.
- [x] **Acciones rápidas en la lista.** Presentado y Archivado se marcan
  desde la fila, con sello de usuario y reversión automática si el guardado
  falla (equivalente al swipe de la versión anterior).
- [x] **Filtros avanzados.** Vencimiento, estado y encargado volvieron en el
  panel *Más filtros*; usan el contexto compartido, así que lo que se elige
  también aplica en "Asignar clientes".
- [x] **Resumen por vencimiento.** Panel con presentados/pendientes por día;
  cada día filtra la cartera.
- [x] **Botón de Marangatu.** `openMarangatuLogin()` y
  `findClaveMarangatuColumn()` habían quedado como código muerto: ningún
  componente los llamaba, pese a que el README lo listaba como función
  vigente. Vuelve a estar en la cabecera del detalle del cliente.

### Pendiente de esta migración

- [ ] **Probar las acciones rápidas contra el backend real.** Se validaron
  contra un mock local; falta confirmar el guardado y el sello de usuario
  contra el Apps Script desplegado.
- [ ] **Definir qué pasa con el orden manual (`sortBy`).** El contexto sigue
  exponiendo `sortBy`/`setSortBy` y nadie los usa: la lista ordena por
  vencimiento y después por nombre. Hay que decidir si se expone un
  selector de orden o si se quita del contexto.
- [ ] **Limpiar el CSS huérfano de la interfaz anterior.** Quedan ~57 clases
  en `styles.css` sin ningún uso en JSX (`client-card*`, `swipe-*`,
  `summary-*`, `filters-sheet-*`, `status-badge-*`, `toggle-switch-*`,
  entre otras). Conviene borrarlas recién cuando la nueva UI esté aprobada
  en producción, para no perder referencias durante la transición.
- [ ] **Revisar el resto de pantallas con la escala nueva.** `ClientDetail`,
  `AssignClients` y los pickers siguen con tamaños en px propios de
  `styles.css`; se ven bien, pero todavía no acompañan la preferencia de
  *Tamaño de texto*.

## Funciones pendientes fuera de autenticación

- [ ] Implementar `action: "create"` en el backend antes de habilitar definitivamente el alta de nuevos clientes.
- [ ] Configurar el ID definitivo de la extensión donde corresponda.
- [ ] Definir, si se necesita una aplicación de PC, el puerto/origen y protocolo del puente local.
- [x] Revisar los warnings heredados del lint y el estado de dependencias con `npm audit` en una tarea separada.
  - `npm run lint` pasó de 8 warnings a **0 warnings / 0 errores**: los `set-state-in-effect`
    de los pickers (Year/Name/Month), del contexto (`ClientsContext`) y del menú mobile en
    `App.jsx`, más un falso positivo de `react/only-export-components` (deshabilitado puntualmente
    con su justificación). Los pickers cargan una sola vez al montar y reintentan solo con su botón.
  - `npm audit`: 3 vulnerabilidades **moderate** (dev-only, cadena `@capacitor/cli` → `xcode` →
    `uuid` <11.1.1). Sin fix disponible en la versión publicada de Capacitor; no aplica a la app
    compilada ni al APK. Re-evaluar al actualizar Capacitor.
- [x] Actualizar la documentación general del `README.md`, que todavía describe el flujo inicial del proyecto.
  - Describe autenticación por PIN, sesión, roles, lista, detalle,
    asignación, panel ejecutivo, Configuración y notas de seguridad.

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
