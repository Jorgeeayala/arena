# Mejoras de rendimiento y percepción de velocidad

Estado: implementado y verificado con un backend simulado (ver
`tools/smoke/README.md`). **No está probado contra el Apps Script real** ni en
el teléfono: antes de darlo por bueno conviene compilar y usarlo un rato.

Prioridad que guio el trabajo: **rapidez y conexión visual al instante**. Se
aceptó explícitamente que los cambios se guarden en una cola y vayan llegando
a la planilla, así que nada de acá modifica cómo se escribe en la hoja.

---

## 1. Lag y microcortes

| Dónde | Qué pasaba | Qué se hizo |
|---|---|---|
| `src/screens/AssignClients.jsx` | La lista **no estaba virtualizada**: dibujaba todas las filas, cada una como `motion.div` con animación propia y escalonada de a 15 ms, y con un `<select>` completo con todo el equipo adentro. | La fila pasó a ser un `div` memoizado (`AssignRow`) sin animación, con callbacks estables, y el `<select>` se crea **sólo** para la fila que se está editando; el resto muestra el nombre como texto y un botón que abre el desplegable al tocarlo. |
| `src/screens/AssignClients.jsx` | Ordenar por relevancia llamaba a `getClientSearchScore` **dentro del comparador** (2 veces por comparación ≈ 5.000 normalizaciones por tecla con 300 clientes). | Usa `getSearchScore`, que sale del índice que ya armó el contexto. |
| `src/utils.js` | `getClientSearchScore` normalizaba la consulta **y todas las columnas** por fila, en cada tecla. | Búsqueda en dos etapas: `buildRowSearchIndex` (una vez por fila, cuando cambian los datos) + `prepareSearchQuery` (una vez por tecla) + `scoreSearchIndex` (sólo compara strings listos). `getClientSearchScore` sigue existiendo como atajo. |
| `src/context/ClientsContext.jsx` | `savingRows.includes(...)` y `savedRows.includes(...)` por fila: O(filas × guardando) en cada render. | Se exponen `savingRowSet` / `savedRowSet` memoizados para consultar en O(1). |
| `src/context/ClientsContext.jsx` | `rosterUsers.push(user)` **mutaba el estado durante el render**, y el `useMemo` de `teamUsers` no se enteraba. | Se deriva con `useMemo` (`rosterWithUser`); ya no se muta nada. |
| `src/ui-executive/ExecutiveDashboard.jsx` | Cada tecla volvía a reconciliar todo el panel (hero, métricas, prioridad, equipo, calendario). | Esas secciones se extrajeron a componentes `memo` (`HeroSection`, `MetricsSection`, `InsightsSection`, `SummarySection`) con props memoizadas: escribir sólo re-renderiza el input y la tabla. |
| `src/ui-executive/ExecutiveDashboard.jsx` | La fila era un `<button>` con botones adentro (HTML inválido: React lo avisaba en consola y el navegador puede reestructurar el DOM). | La fila es un `div role="button"` con soporte de teclado (Enter / espacio). |
| `src/context/ClientsContext.jsx` | El `value` del contexto tiene ~50 dependencias: cualquier cambio re-renderiza **todas** las pantallas que lo consumen. | Queda anotado como trabajo pendiente (ver "Lo que falta"); por ahora se mitigó memoizando los subárboles caros. |

## 2. Conexión visual al instante

| Dónde | Qué pasaba | Qué se hizo |
|---|---|---|
| `ExecutiveDashboard.jsx` + `ClientsContext.jsx` | Refrescar o cambiar de mes **desmontaba el panel entero** y lo reemplazaba por un spinner a pantalla completa (`if (loading) return ...`). | `loading` es sólo la primera carga de un período (ahí va un **esqueleto** con la estructura real); las recargas usan `refreshing` y mantienen la lista en pantalla con un aviso de "Actualizando la planilla…". Si una recarga falla con datos ya en pantalla, el error se muestra como aviso arriba sin vaciar la lista. |
| `src/api.js` + `ClientsContext.jsx` | La recarga en segundo plano actualizaba el caché de `api.js` pero **no avisaba a React**: lo que se veía quedaba viejo hasta apretar "Actualizar". | `api.js` expone `onSheetData` y el contexto se suscribe: cuando el fondo trae datos nuevos, se repintan solos. Las respuestas de un período que ya no está en pantalla se descartan. |
| `src/App.jsx`, `src/main.jsx` | Un único bundle de 470 KB: para mostrar el selector de usuario se descargaban Asignar, Detalle, Nuevo cliente, Configuración y todo el panel. | `React.lazy` + `Suspense` para esas cuatro pantallas y para el panel ejecutivo. El arranque bajó a 378 KB (119 KB gzip). |
| `public/logo-mj.png` | PNG de 500×500 y **150 KB** usado en el splash, el navbar y el drawer. | Convertido a `logo-mj.webp` de 320×320 y **15 KB**. El PNG original se borró (sigue en el historial por si se lo quiere recuperar). |
| `AppSplashLoader.jsx`, `App.jsx` | El splash esperaba datos hasta 3 s. | Máximo 1,6 s: si la primera pantalla no terminó, el splash se retira igual y se ve el esqueleto o el error de esa pantalla. |

## 3. CSS

| Dónde | Qué se hizo |
|---|---|
| `src/ui-executive/preview.css` | El navbar fijo tenía `backdrop-filter: blur(16px)` sobre un fondo al **97 % de opacidad**: el desenfoque casi no se veía y se recalculaba en cada frame del scroll (primera causa de tirones en Android). Se cambió por un color sólido; mismo aspecto, sin costo por frame. El blur de la tarjeta de avance bajó de 12px a 6px. |
| `src/ui-executive/preview.css` | Se agregaron los estilos del esqueleto, del aviso de actualización y del botón de Marangatu por fila. El esqueleto anima **opacidad** (lo único que compone sin repintar) y respeta `prefers-reduced-motion`. |
| `src/styles.css` | 11 `transition: all` reemplazados por la lista de propiedades que realmente cambian (color, fondo, borde, sombra, transform, opacidad). Con `all`, cualquier cambio disparaba transiciones de layout. |
| `src/styles.css` | **56 clases huérfanas** de la interfaz anterior (98 reglas, incluyendo sus variantes en media queries) eliminadas: `card-quick-*`, `swipe-*`, `summary-*`, `filters-sheet-*`, `status-badge-*`, `toggle-switch-*`, `screen-nav-tab*`, … El archivo pasó de 72 KB a 55 KB y el CSS compilado de 72,8 KB a 61,6 KB. |

## 4. Función recuperada: inyección de login (Marangatu)

La tarjeta de la interfaz anterior tenía un acceso directo a Marangatu que
inyecta el RUC y la Clave MH en el login de la SET; tras la migración quedó
sólo en la cabecera del detalle del cliente.

Se repuso en la fila de la lista (`ExecutiveDashboard.jsx`), cuando la fila
tiene RUC y Clave MH (se calcula una vez por fila en `rowMeta`). Aparece
**sólo en equipos con mouse** (`@media (hover: hover) and (pointer: fine)`),
como en la versión anterior: la extensión que hace la inyección no existe en
el teléfono, y ahí el acceso sigue estando en el detalle.

---

## Medido

Con 300 clientes simulados y el backend falso (`tools/smoke`, medido con
`dom-smoke.mjs` y `bench.mjs` sobre este mismo árbol, antes y después):

| | Antes | Ahora |
|---|---|---|
| Nodos en el DOM en "Asignar clientes" | 3.809 | **1.700** (−55 %) |
| `<select>` montados en esa pantalla | 300 | **0** (1 sólo al editar una fila) |
| "Actualizar" desmonta la lista | **sí** | **no** |
| Filtrar 300 filas por tecla (`"fer"`) | 2,45 ms | **0,29 ms** (8×) |
| Ordenar 300 filas por relevancia (`"fer"`) | 17,8 ms | **0,70 ms** (25×) |
| Bundle inicial | 470 KB (143 KB gz) | **378 KB (119 KB gz)** |
| CSS compilado | 72,8 KB (13,1 KB gz) | **61,6 KB (11,4 KB gz)** |
| Logo del splash y navbar | 150 KB | **15 KB** |

Los tiempos son de Node en una PC de escritorio: en un teléfono de gama media
hay que multiplicarlos por 5 o 10, que es donde se sienten como lag.

`npm run lint` → 0 warnings / 0 errores. `npm run build` → sin errores.

---

## Lo que falta (para el próximo agente)

Ordenado por lo que el usuario señaló como funciones que no terminaron de
migrar de la interfaz anterior:

1. **Acciones masivas.** Existía `components/BulkActionToolbar.jsx`: selección
   múltiple con casillas, "seleccionar todos", asignar un lote a un encargado
   y aviso de progreso. La UI ejecutiva no tiene nada equivalente. Es la
   función perdida más grande y la más pedida en el uso diario.
2. **Orden manual.** El contexto sigue exponiendo `sortBy` / `setSortBy` y
   nadie los usa: la lista ordena siempre por vencimiento y después por
   nombre. La interfaz anterior tenía un selector de orden.
3. **Toggles rápidos para el resto de las columnas SI/NO.** El panel sólo
   ofrece Presentado y Archivado; la tarjeta anterior alternaba **todas** las
   columnas `pure_yesno`/`hybrid` (el contexto ya expone `statusHeaders`).
4. **Alta de clientes.** `action: 'create'` sigue sin implementarse en el
   backend; hoy devuelve `UNKNOWN_ACTION`. El botón "Nuevo cliente" existe en
   el frente pero no persiste nada.
5. **Dividir el contexto.** Sigue siendo un único `value` con ~50
   dependencias, así que un guardado re-renderiza todas las pantallas. La salida
   limpia es separar datos / filtros / escritura en tres contextos, o usar un
   selector tipo `useSyncExternalStore`.
6. **Cola de guardado persistente.** Si se cierra la app o vence la sesión con
   escrituras pendientes, se pierden en silencio. Dado que se aceptó el modelo
   de cola, merece sobrevivir al cierre.

### Fuera de este frente

- Revisar en Apps Script → Administrar implementaciones que "Quién tiene
  acceso" esté en **Cualquier persona**. Si quedó en "Solo yo", Google
  intercepta con una página de login HTML y eso aparece como un error claro y
  repetido (antes era un cuelgue silencioso).
- El popup de la extensión (`popup.html` / `popup.js`) se eliminó a propósito
  en la revisión de seguridad (PENDIENTES.md, Puntos 3 y 4): la inyección
  sigue funcionando desde `background.js`, pero la extensión ya no tiene
  interfaz propia ni buscador ni importador de CSV. Si se la extraña, es una
  decisión a tomar, no un olvido.

## Riesgos a revisar antes de mergear

- Se borró `public/logo-mj.png` (reemplazado por WebP). Está en el historial
  si se lo quiere volver.
- Se podaron 56 clases de CSS que no referenciaba ningún archivo. Si alguna
  clase se arma dinámicamente de una forma que el script no detectó, el síntoma
  sería un elemento sin estilo, no un error. Conviene una mirada en el
  teléfono a: detalle de cliente, Asignar clientes, Configuración y los
  pickers.
- El navbar ya no es translúcido (fondo sólido). Visualmente es casi idéntico
  porque el fondo ya era opaco al 97 %.
- La fila del panel pasó de `<button>` a `div role="button"`: mismo click y
  teclado, pero si algún estilo o test dependía de la etiqueta, revisarlo.
- `vite.config.js` suma un proxy `/__api` → `localhost:8787` sólo para el dev
  server (no afecta al build).
