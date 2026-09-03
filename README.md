# Control Remoto Clientes

PWA para gestionar la cartera de clientes de un estudio contable.
Frontend React/Vite con autenticación individual por PIN, acceso por
períodos, edición optimista de la planilla y una vista ejecutiva de
solo lectura.

## Qué incluye la versión actual

- **Inicio de sesión por PIN** por usuario, con sesión individual y
  expiración por inactividad/máxima duración.
- **Alta inicial de PIN** durante la configuración (sujeta a las
  propiedades del backend).
- Selección de **año y mes** según las planillas disponibles.
- **Panel del período** con métricas, prioridades, carga por equipo,
  resumen por vencimiento y la cartera completa de clientes.
  - Búsqueda por nombre o RUC y filtros rápidos.
  - **Más filtros**: vencimiento, estado y encargado (compartidos con
    "Asignar clientes").
  - **Acciones rápidas**: marcar Presentado y Archivado desde la fila,
    sin abrir el cliente.
  - Lista **virtualizada**: sólo se dibujan las filas visibles, así el
    período se mantiene fluido aunque tenga cientos de clientes.
- **Detalle de cliente** con edición de campos, acceso a **Marangatu** y
  vista de solo lectura en el preview ejecutivo.
- **Asignar clientes** (roles con permiso).
- **Configuración** con tema claro/oscuro, **tamaño de texto**
  (Compacto / Normal / Grande / Extra) y cambio de PIN.
- **Marangatu** con apertura del login de la SET y autocompletado
  cuando la extensión está instalada.

## Cómo correrlo

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar la conexión

Copiá `.env.example` a `.env` y completá:

```ini
VITE_BACKEND_URL=https://script.google.com/.../exec
VITE_API_TOKEN=tu_token
VITE_MARANGATU_LOGIN_URL=https://marangatu.set.gov.py/eset/login
VITE_MARANGATU_EXT_ID=id_de_tu_extension
```

> `VITE_API_TOKEN` no es un secreto real frente al bundle: se
> incorpora al frontend. La validación fuerte la hace el backend.

### 3. Correr en desarrollo

```bash
npm run dev
```

Abrí `http://localhost:3000/`.

### 4. Build de producción

```bash
npm run build
```

La carpeta `dist/` es la que se sube al hosting / se sincroniza con
Capacitor.

## Roles

- `USUARIO`: lee/edita datos permitidos y puede marcar Presentado /
  Archivado. No cambia Encargado.
- `ADMINISTRADOR` y `SUPERUSUARIO`: además pueden asignar y cambiar
  Encargado.

## Estructura relevante

```text
src/
  App.jsx                 estructura de pantallas y sesión
  api.js                  llamadas al backend (POST)
  uiPreferences.js        preferencias locales (tamaño de texto)
  context/ClientsContext  estado compartido de planilla/equipo/filtros
  screens/                pickers, detalle, asignación, nuevo cliente
  ui-executive/           panel del período (interfaz actual)
  components/             modales / utilidades de UI
AppsScript-Code-auth-PROPUESTA.gs   backend de referencia (Apps Script)
```

La interfaz que se monta es la ejecutiva: `src/main.jsx` renderiza
`<App uiMode="executive" periodOverviewComponent={ExecutiveDashboard} />`.

## Notas de seguridad

- El backend debe estar con `ALLOW_SELF_PIN_SETUP=false` y
  `ALLOW_PINLESS_LOGIN=false` en producción.
- No subir al repo: `.env`, `API_TOKEN`, `PIN_PEPPER`, PIN reales,
  IDs de planillas ni URLs privadas de despliegue.
- La extensión de Marangatu solo debe permitir orígenes locales
  autorizados.

Para el detalle de pendientes, ver `PENDIENTES.md`.
