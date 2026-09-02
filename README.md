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
- **Lista de clientes** con búsqueda, filtros, orden, resumen por día,
  swipe para marcar Presentado/Archivado y edición de encargado.
- **Detalle de cliente** con edición de campos y vista de solo lectura
  en el preview ejecutivo.
- **Asignar clientes** (roles con permiso).
- **Panel ejecutivo** con métricas, prioridades, carga por equipo y
  tabla de clientes con filtros rápidos.
- **Configuración** con tema claro/oscuro y cambio de PIN.
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

### 4. Vista ejecutiva y laboratorio UI

- Vista ejecutiva: `http://localhost:3000/executive-preview.html`
- Laboratorio UI: `http://localhost:3000/ui-preview.html`

### 5. Build de producción

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
  context/ClientsContext  estado compartido de planilla/equipo/filtros
  screens/                pickers, lista, detalle, asignación, nuevo cliente
  ui-executive/           vista ejecutiva
  ui-preview/             laboratorio de UI
  components/             modales / utilidades de UI
AppsScript-Code-auth-PROPUESTA.gs   backend de referencia (Apps Script)
```

## Notas de seguridad

- El backend debe estar con `ALLOW_SELF_PIN_SETUP=false` y
  `ALLOW_PINLESS_LOGIN=false` en producción.
- No subir al repo: `.env`, `API_TOKEN`, `PIN_PEPPER`, PIN reales,
  IDs de planillas ni URLs privadas de despliegue.
- La extensión de Marangatu solo debe permitir orígenes locales
  autorizados.

Para el detalle de pendientes, ver `PENDIENTES.md`.
