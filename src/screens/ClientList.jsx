import { useEffect, useMemo, useState, useRef, useCallback, memo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'motion/react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useClients } from '../context/ClientsContext';
import {
  findPresentadoColumn,
  findArchivadoColumn,
  isAffirmativeValue,
  getDisplayHeader,
  formatPeriodLabel,
  findRucColumn,
  findClaveMarangatuColumn,
  getClientSearchScore,
} from '../utils';
import { openMarangatuLogin } from '../marangatu';
import {
  Search,
  Plus,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  X,
  Users,
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  Filter,
  ArrowUpDown,
  UserCheck,
  UserRound,
  UserCog,
  BarChart3,
  Archive,
} from 'lucide-react';

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
};

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
  });

  useEffect(() => {
    const checkTouch = () => {
      const touch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      setIsTouch(touch);
    };
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouch;
}

const SwipeableClientCard = memo(forwardRef(function SwipeableClientCard({
  row,
  nameKey,
  vencimientoKey,
  presUser,
  archUser,
  presHeader,
  archHeader,
  presentadoPorCol,
  archivadoPorCol,
  isPresSi: initialIsPresSi,
  isArchSi: initialIsArchSi,
  statusHeaders,
  user: _user,
  onSelect,
  handleQuickToggle,
  getDisplayHeader,
  itemVariants,
  isTouchDevice,
  headers,
  hasEncargadoCol,
  canAssignClients,
  dataIndex,
  virtualStyle,
  teamUsers,
  repartoUsers,
  onSetEncargado,
  savingEncargado,
  readOnlyPreview,
}, ref) {
  const [localOverrides, setLocalOverrides] = useState({});
  // dragX era useState antes: eso disparaba un re-render de React en
  // CADA frame del gesto de swipe (hasta 60 veces por segundo), compitiendo
  // con la propia animación nativa de framer-motion que ya mueve la
  // tarjeta por su cuenta -- ese doble trabajo por frame es lo que se
  // sentía como "microcortes" al arrastrar. useMotionValue actualiza el
  // valor sin pasar por el ciclo de render de React; los indicadores de
  // fondo (color/opacidad/escala) se derivan con useTransform, que
  // también actualiza el DOM directo, sin re-render.
  const dragX = useMotionValue(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const isDraggingRef = useRef(false);

  const bgIndicatorColor = useTransform(dragX, (v) => {
    if (v > 15) return '#dcfce7';
    if (v < -15) return '#f3e8ff';
    return 'var(--bg-card-hover)';
  });
  const rightIndicatorOpacity = useTransform(dragX, (v) => (v > 10 ? Math.min(v / 50, 1) : 0));
  const rightIndicatorScale = useTransform(dragX, (v) => (v > 10 ? Math.min(0.85 + v / 250, 1.1) : 0.85));
  const leftIndicatorOpacity = useTransform(dragX, (v) => (v < -10 ? Math.min(-v / 50, 1) : 0));
  const leftIndicatorScale = useTransform(dragX, (v) => (v < -10 ? Math.min(0.85 + -v / 250, 1.1) : 0.85));

  // Sync / reset local overrides when row data updates from parent
  useEffect(() => {
    setLocalOverrides({});
  }, [row]);

  // Lock vertical page scroll while swiping a card on mobile
  useEffect(() => {
    if (!isSwiping) return;
    const preventScroll = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [isSwiping]);

  const clientName = row[nameKey] || 'Sin Nombre';
  const vtoValue = vencimientoKey ? String(row[vencimientoKey] || '').trim() : '';
  const assignedUser = row._assignedUser;

  // Los que están en el equipo pero NO entran al reparto automático. Igual
  // se les puede asignar a mano desde la tarjeta: la lista de participantes
  // acota sólo la distribución automática.
  const nonParticipants = useMemo(
    () => (teamUsers || []).filter((u) => !(repartoUsers || []).includes(u)),
    [teamUsers, repartoUsers]
  );

  // Credenciales de Marangatu de este cliente (botón de la tarjeta). Si la
  // hoja no tiene la columna, el botón no se muestra para ese cliente.
  const rucCol = useMemo(() => findRucColumn(headers), [headers]);
  const claveCol = useMemo(() => findClaveMarangatuColumn(headers), [headers]);
  const marangatuRuc = rucCol ? String(row[rucCol] || '').trim() : '';
  const marangatuClave = claveCol ? String(row[claveCol] || '').trim() : '';

  const presColName = presHeader || presentadoPorCol || findPresentadoColumn(headers) || null;
  const archColName = archHeader || archivadoPorCol || findArchivadoColumn(headers) || null;

  // ¿La columna que se usa para Presentado/Archivado es EXCLUSIVAMENTE la
  // de "...Por" (ej. "Archivado por:"), sin una columna SI/NO separada?
  const presIsStampOnly = Boolean(presColName) && presColName === presentadoPorCol;
  const archIsStampOnly = Boolean(archColName) && archColName === archivadoPorCol;

  // Resolve values considering instant local optimistic state
  const getColValue = (col) => {
    if (!col) return '';
    if (localOverrides[col] !== undefined) return localOverrides[col];
    return row[col] !== undefined && row[col] !== null ? String(row[col]).trim() : '';
  };

  const isPresSi = presColName
    ? presIsStampOnly
      ? getColValue(presColName) !== ''
      : isAffirmativeValue(getColValue(presColName))
    : initialIsPresSi;

  const isArchSi = archColName
    ? archIsStampOnly
      ? getColValue(archColName) !== ''
      : isAffirmativeValue(getColValue(archColName))
    : initialIsArchSi;

  // Valor a escribir al marcar/desmarcar: si la columna es "solo sello",
  // marcar = poner el nombre del usuario logueado; desmarcar = vaciarla.
  // Si hay una columna SI/NO real, se sigue usando 'SI'/'NO' como siempre.
  const nextPresValue = (marking) => (presIsStampOnly ? (marking ? _user : '') : (marking ? 'SI' : 'NO'));
  const nextArchValue = (marking) => (archIsStampOnly ? (marking ? _user : '') : (marking ? 'SI' : 'NO'));

  const onToggleClick = (e, colName, targetVal) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (readOnlyPreview) return;
    // 0ms instant visual toggle locally
    setLocalOverrides((prev) => ({ ...prev, [colName]: targetVal }));
    // Asynchronous backend update
    handleQuickToggle(e, row, colName, targetVal);
  };

  const handleDragStart = () => {
    if (!isTouchDevice) return;
    isDraggingRef.current = true;
    setIsSwiping(true);
  };

  const handleDrag = (_e, info) => {
    if (!isTouchDevice) return;
    dragX.set(info.offset.x);
  };

  const handleDragEnd = (e, info) => {
    if (!isTouchDevice) return;
    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;
    const threshold = 70;

    if (offsetX > threshold || velocityX > 350) {
      // Swiped Right -> Toggle Presentado
      if (presColName) {
        onToggleClick(e, presColName, nextPresValue(!isPresSi));
      }
    } else if (offsetX < -threshold || velocityX < -350) {
      // Swiped Left -> Toggle Archivado
      if (archColName) {
        onToggleClick(e, archColName, nextArchValue(!isArchSi));
      }
    }

    dragX.set(0);
    setIsSwiping(false);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleCardClick = () => {
    if (isDraggingRef.current || Math.abs(dragX.get()) > 10) return;
    onSelect(row);
  };

  // Determine if Presentado / Archivado are in statusHeaders or need standalone quick toggles
  const hasPresInStatusHeaders = statusHeaders.some((sh) => /presentad/i.test(sh));
  const hasArchInStatusHeaders = statusHeaders.some((sh) => /archiv/i.test(sh));

  return (
    <motion.li
      ref={ref}
      data-index={dataIndex}
      className="swipe-card-wrapper"
      variants={itemVariants}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        listStyle: 'none',
        userSelect: 'none',
        touchAction: isTouchDevice ? 'pan-y' : 'auto',
        ...virtualStyle,
      }}
    >
      {/* Background action indicators (ONLY on touch devices when dragging) */}
      {isTouchDevice && !readOnlyPreview && (
        <motion.div
          className="swipe-action-bg"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            fontWeight: 600,
            fontSize: '13px',
            backgroundColor: bgIndicatorColor,
            transition: isSwiping ? 'none' : 'background-color 0.2s ease',
          }}
        >
          {/* Right swipe indicator (Left side) -> Presentado */}
          <motion.div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#15803d',
              opacity: rightIndicatorOpacity,
              scale: rightIndicatorScale,
              transition: isSwiping ? 'none' : 'opacity 0.2s ease',
            }}
          >
            <CheckCircle2 size={20} />
            <span>{isPresSi ? 'Quitar Presentado' : 'Marcar Presentado'}</span>
          </motion.div>

          {/* Left swipe indicator (Right side) -> Archivado */}
          <motion.div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6b21a8',
              opacity: leftIndicatorOpacity,
              scale: leftIndicatorScale,
              transition: isSwiping ? 'none' : 'opacity 0.2s ease',
            }}
          >
            <span>{isArchSi ? 'Quitar Archivado' : 'Marcar Archivado'}</span>
            <Archive size={20} />
          </motion.div>
        </motion.div>
      )}

      {/* Main Card (Draggable on mobile touch, static click target on PC) */}
      <motion.div
        className="client-card"
        drag={isTouchDevice && !readOnlyPreview ? 'x' : false}
        dragConstraints={isTouchDevice && !readOnlyPreview ? { left: 0, right: 0 } : undefined}
        dragElastic={isTouchDevice && !readOnlyPreview ? 0.6 : undefined}
        onDragStart={isTouchDevice && !readOnlyPreview ? handleDragStart : undefined}
        onDrag={isTouchDevice && !readOnlyPreview ? handleDrag : undefined}
        onDragEnd={isTouchDevice && !readOnlyPreview ? handleDragEnd : undefined}
        onClick={handleCardClick}
        whileHover={{ y: -1, transition: { duration: 0.15 } }}
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '10px',
          backgroundColor: 'var(--bg-card)',
          touchAction: isTouchDevice ? 'pan-y' : 'auto',
          cursor: isTouchDevice ? (isSwiping ? 'grabbing' : 'grab') : 'pointer',
        }}
      >
        <div className="client-card-main">
          <div className="client-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="client-avatar-default">
              <Building2 size={20} />
            </div>
            <div className="client-card-identity">
              <div className="client-name">{clientName}</div>
              <div className="client-card-assignee">
                {/* El encargado es SIEMPRE el valor real de la columna
                    "Encargado" de la hoja, y ahora se puede cambiar acá
                    mismo. La asignación manual acepta a CUALQUIERA del
                    equipo: la lista de participantes acota sólo el reparto
                    automático, no a quién se le puede dar un cliente. */}
                {hasEncargadoCol ? (
                  canAssignClients ? (
                    // stopPropagation: el click no debe abrir el detalle del
                    // cliente, y el pointerdown no debe iniciar el swipe.
                    <span
                      className="card-encargado-wrap"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <UserRound size={11} />
                      <select
                        className={`card-encargado-select ${assignedUser ? '' : 'is-empty'}`}
                        value={assignedUser || ''}
                        disabled={savingEncargado}
                        title={
                          assignedUser
                            ? `Encargado: ${assignedUser} · cambialo por quien quieras del equipo`
                            : 'Sin asignar · elegí un encargado'
                        }
                        onChange={(e) => onSetEncargado(row._row, e.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {/* Un nombre que ya no está en el equipo sincronizado se
                            muestra igual, en vez de blanquearlo. */}
                        {assignedUser && !(teamUsers || []).includes(assignedUser) && (
                          <option value={assignedUser}>{assignedUser} (fuera del equipo)</option>
                        )}
                        {(repartoUsers || []).length > 0 && (
                          <optgroup label="Participan del reparto">
                            {(repartoUsers || []).map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {nonParticipants.length > 0 && (
                          <optgroup label="No participan (asignación manual)">
                            {nonParticipants.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </span>
                  ) : (
                    <span
                      className={`assigned-user-badge ${assignedUser ? '' : 'assigned-user-badge-empty'}`}
                      title={assignedUser ? `Encargado: ${assignedUser}` : 'Sin asignar'}
                    >
                      <UserRound size={11} />
                      {assignedUser || 'Sin asignar'}
                    </span>
                  )
                ) : null}
              </div>
            </div>
          </div>

          <ChevronRight size={20} className="client-card-chevron" />
        </div>

        <div className="client-card-footer">
          {vtoValue && (
            <span className="client-card-due-date">
              <Calendar size={12} />
              Vencimiento: <strong>{vtoValue}</strong>
            </span>
          )}

          <div className="client-card-statuses">
            {presColName && (
              <span
                className={`status-badge ${isPresSi ? 'status-badge-presentado' : 'status-badge-pendiente'}`}
                title={`Presentado: ${isPresSi ? 'Sí' : 'No'}`}
              >
                <CheckCircle2 size={12} />
                <span>{isPresSi ? 'Presentado' : 'Pendiente'}</span>
              </span>
            )}
            {archColName && (
              <span
                className={`status-badge ${isArchSi ? 'status-badge-archivado' : 'status-badge-pendiente'}`}
                title={`Archivado: ${isArchSi ? 'Sí' : 'No'}`}
              >
                <Archive size={12} />
                <span>{isArchSi ? 'Archivado' : 'Pendiente'}</span>
              </span>
            )}
          </div>
        </div>

        {/* En el preview de sólo lectura se conservan únicamente los indicadores. */}
        {!readOnlyPreview && (
          <div className="card-quick-actions" onClick={(e) => e.stopPropagation()}>
          {/* Botón Marangatu (solo PC): abre el login de la SET con las
              credenciales de este cliente. Con la extensión instalada y
              configurada, autocompleta; si no, abre la página igual. */}
          {!isTouchDevice && marangatuRuc && (
            <button
              type="button"
              className="marangatu-btn"
              title={`Abrir Marangatu y autocompletar con RUC ${marangatuRuc}`}
              onClick={(e) => {
                e.stopPropagation();
                openMarangatuLogin({ user: marangatuRuc, pass: marangatuClave });
              }}
            >
              <img src="/marangatu.svg" alt="Marangatu" className="marangatu-logo" />
            </button>
          )}

          {/* Dedicated Presentado toggle if not in statusHeaders and column exists (ONLY on PC, mobile uses Swipe) */}
          {!hasPresInStatusHeaders && !isTouchDevice && presColName && (
            <button
              type="button"
              className={`card-quick-toggle ${isPresSi ? 'is-active-si' : 'is-inactive-no'}`}
              onClick={(e) => onToggleClick(e, presColName, nextPresValue(!isPresSi))}
              title={`Alternar Presentado (${isPresSi ? 'SÍ' : 'NO'}${presUser ? ` por ${presUser}` : ''})`}
            >
              <span className="card-quick-label">Presentado</span>
              <span className="toggle-switch-track">
                <span className="toggle-switch-thumb" />
              </span>
              <span className="toggle-status-text">{isPresSi ? 'SÍ' : 'NO'}</span>
            </button>
          )}

          {/* Dedicated Archivado toggle if not in statusHeaders and column exists (ONLY on PC, mobile uses Swipe) */}
          {!hasArchInStatusHeaders && !isTouchDevice && archColName && (
            <button
              type="button"
              className={`card-quick-toggle ${isArchSi ? 'is-active-si' : 'is-inactive-no'}`}
              onClick={(e) => onToggleClick(e, archColName, nextArchValue(!isArchSi))}
              title={`Alternar Archivado (${isArchSi ? 'SÍ' : 'NO'}${archUser ? ` por ${archUser}` : ''})`}
            >
              <span className="card-quick-label">Archivado</span>
              <span className="toggle-switch-track">
                <span className="toggle-switch-thumb" />
              </span>
              <span className="toggle-status-text">{isArchSi ? 'SÍ' : 'NO'}</span>
            </button>
          )}

          {/* Other status headers */}
          {statusHeaders.map((sh) => {
            // If on touch device and sh is Presentado/Archivado, skip because mobile uses swipe
            if (isTouchDevice && (/presentad/i.test(sh) || /archiv/i.test(sh))) {
              return null;
            }

            const val = getColValue(sh);
            const isYes = val === 'SI' || val === 'SÍ';

            let cleanLabel = getDisplayHeader(sh);
            if (/presentad/i.test(sh)) cleanLabel = 'Presentado';
            else if (/archiv/i.test(sh)) cleanLabel = 'Archivado';
            else cleanLabel = cleanLabel.replace(/\s+por$/i, '');

            const shUserCol = headers.find((h) => new RegExp(`^${sh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*por$`, 'i').test(h));
            const shUser = shUserCol ? String(row[shUserCol] || '').trim() : '';

            return (
              <button
                key={sh}
                type="button"
                className={`card-quick-toggle ${isYes ? 'is-active-si' : 'is-inactive-no'}`}
                onClick={(e) => onToggleClick(e, sh, isYes ? 'NO' : 'SI')}
                title={`Alternar ${cleanLabel} (${isYes ? 'SÍ' : 'NO'}${shUser ? ` por ${shUser}` : ''})`}
              >
                <span className="card-quick-label">{cleanLabel}</span>
                <span className="toggle-switch-track">
                  <span className="toggle-switch-thumb" />
                </span>
                <span className="toggle-status-text">{isYes ? 'SÍ' : 'NO'}</span>
              </button>
            );
          })}
          </div>
        )}
      </motion.div>
    </motion.li>
  );
}));
SwipeableClientCard.displayName = 'SwipeableClientCard';

export default function ClientList({ onSelect, onNewClient, readOnlyPreview = false }) {
  const isTouchDevice = useIsTouchDevice();

  // Datos, equipo, filtros y escritura vienen del CONTEXTO COMPARTIDO con
  // la pantalla "Asignar clientes" (ClientsProvider). No es una copia: es
  // el mismo estado. Lo que se asigna o edita en una pantalla aparece al
  // instante en la otra, y los filtros son exactamente los mismos.
  const {
    user,
    canAssignClients,
    year,
    month,
    headers,
    rows,
    assignedRows,
    loading,
    error,
    reload,
    teamUsers,
    repartoUsers,
    setEncargado,
    syncingUsers,
    syncTeamUsers,
    nameKey,
    vencimientoKey,
    rucKey,
    encargadoCol,
    presentadoPorCol,
    archivadoPorCol,
    presentadoCol,
    archivadoCol,
    statusHeaders,
    primaryStatusHeader,
    availableVencimientos,
    unassignedCount,
    query,
    setQuery,
    selectedVencimiento,
    setSelectedVencimiento,
    selectedStatus,
    setSelectedStatus,
    selectedAssignee,
    setSelectedAssignee,
    sortBy,
    setSortBy,
    applySharedFilters,
    activeFilterCount,
    hasActiveFilters,
    clearFilters,
    saveRowUpdates,
    savingRows,
  } = useClients();

  // Controla el panel de filtros como bottom-sheet en mobile. En desktop
  // este estado se ignora vía CSS: los filtros quedan siempre visibles
  // como hasta ahora.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Controla qué elemento puede iniciar el arrastre para cerrar el
  // bottom-sheet de filtros: solo la barrita/header de arriba, no toda la
  // tarjeta (si no, arrastrar para hacer scroll entre los pills de
  // filtro se confundiría con el gesto de cerrar).
  const filtersDragControls = useDragControls();

  // Detecta el mismo breakpoint que usa el CSS (640px) para decidir si el
  // panel de filtros se renderiza inline (desktop, como siempre) o vía
  // portal directo a document.body (mobile). El portal es necesario
  // porque esta pantalla vive adentro de un <motion.div> (la animación
  // de transición de página en App.jsx), y ese motion.div deja un
  // "transform" aplicado incluso en reposo -- lo cual, por spec de CSS,
  // convierte a ese motion.div en el contenedor de referencia de
  // cualquier hijo con position:fixed, en vez de la pantalla completa.
  // Sin el portal, el bottom-sheet de filtros queda "atrapado" adentro
  // de esa caja (que puede ser más alta que el viewport visible), y ni
  // se ve bien ni el fondo oscuro reacciona a los clics para cerrarlo.
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handleChange = (e) => setIsMobileLayout(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'resumen'
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Botón "Recargar datos": fuerza la planilla Y el equipo, que es lo que
  // hacía el viejo loadData() local. Ahora ambos viven en el contexto.
  const refreshAll = useCallback(() => {
    reload(true);
    syncTeamUsers(true);
  }, [reload, syncTeamUsers]);

  // Lista filtrada y ordenada. El filtrado NO se define acá: viene de
  // applySharedFilters (contexto compartido), así que la lista y la
  // pantalla "Asignar clientes" muestran exactamente el mismo conjunto de
  // clientes con los mismos filtros. Acá sólo se aplica el orden.
  const filteredAndSorted = useMemo(() => {
    const list = applySharedFilters(assignedRows);

    // Mientras se escribe, la coincidencia más relevante manda: primero
    // Nombre/Razón social, luego RUC y finalmente el resto de columnas.
    // El orden elegido por el usuario queda como desempate y vuelve a ser el
    // criterio principal apenas se limpia la búsqueda.
    list.sort((a, b) => {
      if (query.trim()) {
        const relevance =
          getClientSearchScore(b, query, nameKey, rucKey) -
          getClientSearchScore(a, query, nameKey, rucKey);
        if (relevance !== 0) return relevance;
      }

      if (sortBy === 'vencimiento' && vencimientoKey) {
        const rawA = String(a[vencimientoKey] || '').trim();
        const rawB = String(b[vencimientoKey] || '').trim();
        const numA = parseInt((rawA.match(/\d+/) || [])[0] || '999', 10);
        const numB = parseInt((rawB.match(/\d+/) || [])[0] || '999', 10);
        if (numA !== numB) return numA - numB;
      }

      const nameA = String(a[nameKey] || '').trim();
      const nameB = String(b[nameKey] || '').trim();
      return nameA.localeCompare(nameB, 'es', { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [applySharedFilters, assignedRows, sortBy, vencimientoKey, nameKey, query, rucKey]);

  // --- Virtualización de la lista ---
  // Antes se renderizaba un <SwipeableClientCard> real por cada cliente
  // filtrado (podían ser cientos), cada uno con animaciones y gestos de
  // arrastre activos todo el tiempo aunque estuviera fuera de pantalla.
  // Con esto, sólo se montan en el DOM las tarjetas realmente visibles
  // (+ un margen de `overscan`), y el resto se representa como espacio
  // vacío calculado. La lista scrollea con la página normal (no hay un
  // contenedor con su propio scroll), por eso se usa el virtualizador de
  // "ventana" en vez del de contenedor.
  const listRef = useRef(null);
  const [listOffsetTop, setListOffsetTop] = useState(0);

  useEffect(() => {
    const measure = () => setListOffsetTop(listRef.current?.offsetTop ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const rowVirtualizer = useWindowVirtualizer({
    count: filteredAndSorted.length,
    estimateSize: () => 108, // alto aproximado de una tarjeta; se ajusta solo por fila via measureElement
    overscan: 6,
    gap: 10, // mismo valor que .client-list { gap: 10px } en styles.css
    scrollMargin: listOffsetTop,
  });

  // Compute Summary Statistics (Table Resumen)
  const summaryData = useMemo(() => {
    if (!assignedRows.length) return [];

    const groupMap = {};

    assignedRows.forEach((row) => {
      const raw = vencimientoKey ? String(row[vencimientoKey] || '').trim() : 'General';
      const digits = raw.match(/\d+/);
      const dayKey = digits ? `Día ${parseInt(digits[0], 10)}` : raw || 'General';

      if (!groupMap[dayKey]) {
        groupMap[dayKey] = {
          dayKey,
          total: 0,
          presentados: 0,
          pendientes: 0,
          userBreakdown: {}, // { "Juan": { total: 0, presentados: 0 } }
        };
      }

      const g = groupMap[dayKey];
      g.total += 1;

      const presUser =
        presentadoPorCol && row[presentadoPorCol] ? String(row[presentadoPorCol]).trim() : '';
      const isPresentado =
        (primaryStatusHeader &&
          ['SI', 'SÍ'].includes(String(row[primaryStatusHeader] || '').trim().toUpperCase())) ||
        Boolean(presUser);

      if (isPresentado) {
        g.presentados += 1;
      } else {
        g.pendientes += 1;
      }

      const assignedUser = row._assignedUser || 'Sin Asignar';
      if (!g.userBreakdown[assignedUser]) {
        g.userBreakdown[assignedUser] = { total: 0, presentados: 0 };
      }
      g.userBreakdown[assignedUser].total += 1;
      if (isPresentado) {
        g.userBreakdown[assignedUser].presentados += 1;
      }
    });

    // Sort groupKeys logically (Día 7, Día 9, etc.)
    const sortedKeys = Object.keys(groupMap).sort((a, b) => {
      const na = parseInt((a.match(/\d+/) || [])[0] || '999', 10);
      const nb = parseInt((b.match(/\d+/) || [])[0] || '999', 10);
      return na - nb;
    });

    return sortedKeys.map((k) => groupMap[k]);
  }, [assignedRows, vencimientoKey, primaryStatusHeader, presentadoPorCol]);

  // Summary Totals
  const summaryTotals = useMemo(() => {
    let total = 0;
    let presentados = 0;
    let pendientes = 0;

    summaryData.forEach((item) => {
      total += item.total;
      presentados += item.presentados;
      pendientes += item.pendientes;
    });

    return { total, presentados, pendientes };
  }, [summaryData]);

  // Quick cell update right from card without opening client detail
  const handleQuickToggle = useCallback(
    async (e, row, column, newValue) => {
      if (e && e.stopPropagation) e.stopPropagation();
      if (!column) return;

      // Resolve exact matching header from headers array
      const exactCol =
        headers.find((h) => h === column) ||
        headers.find((h) => h.trim().toLowerCase() === String(column).trim().toLowerCase());

      if (!exactCol) {
        console.warn(`Columna "${column}" no existe en la planilla actual (${month} ${year}).`);
        return;
      }

      const isPresentadoCol = /presentad/i.test(exactCol);
      const isArchivadoCol = /archiv/i.test(exactCol);

      // ¿La columna que se está tocando (exactCol) ES ELLA MISMA la
      // columna de sello (ej. "Presentado por:", "Archivado por:")? En ese
      // caso `newValue` YA es el valor final completo (el nombre de
      // usuario o '' vacío para desmarcar) -- no hay una columna SI/NO
      // separada que además haya que completar en paralelo. Si hiciéramos
      // el auto-fill de todas formas, se pisaría a sí misma (mismo key en
      // `updates`) y el marcado nunca se guardaría bien.
      const isStampColumnItself =
        exactCol === presentadoPorCol || exactCol === archivadoPorCol;

      let updates = { [exactCol]: newValue };

      if (!isStampColumnItself) {
        // Hay una columna SI/NO real (exactCol) y, aparte, una columna de
        // sello que hay que completar o vaciar en paralelo.
        const marking = newValue === 'SI' || newValue === 'SÍ';
        if (isPresentadoCol && presentadoPorCol && headers.includes(presentadoPorCol)) {
          updates[presentadoPorCol] = marking ? user : '';
        } else if (isArchivadoCol && archivadoPorCol && headers.includes(archivadoPorCol)) {
          updates[archivadoPorCol] = marking ? user : '';
        } else if (isPresentadoCol) {
          const genericStamp = headers.find((h) => /presentad.*por/i.test(h));
          if (genericStamp) updates[genericStamp] = marking ? user : '';
        } else if (isArchivadoCol) {
          const genericStamp = headers.find((h) => /archiv.*por/i.test(h));
          if (genericStamp) updates[genericStamp] = marking ? user : '';
        }
      }

      // Guardado compartido: saveRowUpdates (del contexto) pinta el cambio
      // al instante en el estado que usan TODAS las pantallas -- lista,
      // asignación y detalle -- y lo revierte si el backend falla.
      try {
        await saveRowUpdates(row._row, updates);
      } catch (err) {
        console.error('Error actualizando estado:', err);
      }
    },
    [headers, presentadoPorCol, archivadoPorCol, user, month, year, saveRowUpdates]
  );

  return (
    <div className="screen wide">
      <div className="screen-header">
        <div className="screen-title-group">
          <h2 className="screen-title">Clientes</h2>
          {/* En mobile este dato ya está en la píldora de período del
              navbar, así que se oculta para no repetirlo (ver .hide-mobile) */}
          <span className="screen-subtitle hide-mobile">
            Hoja: <strong>{formatPeriodLabel(month, year)}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <motion.button
            className="back-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTeamModal(true)}
            title="Gestionar Equipo y Asignación"
          >
            <UserCheck size={15} />
            <span>Equipo ({teamUsers.length})</span>
          </motion.button>

          <motion.button
            className="back-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={refreshAll}
            title="Recargar datos"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </div>

      {/* Navegación por Apartados (Tabs) dentro del Mes */}
      <div className="screen-nav-tabs">
        <button
          type="button"
          className={`screen-nav-tab ${activeTab === 'lista' ? 'active' : ''}`}
          onClick={() => setActiveTab('lista')}
        >
          <Users size={16} />
          <span>Lista de Clientes ({filteredAndSorted.length})</span>
        </button>

        <button
          type="button"
          className={`screen-nav-tab ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          <BarChart3 size={16} />
          <span>Tabla Resumen por Vencimiento</span>
        </button>
      </div>

      {/* APARTADO 1: TABLA RESUMEN GENERAL DE VENCIMIENTOS */}
      {activeTab === 'resumen' && (
        <AnimatePresence mode="wait">
          {!loading && !error && summaryData.length > 0 ? (
            <motion.div
              className="summary-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: 0 }}
            >
              <div className="summary-header">
                <div className="summary-title">
                  <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
                  <span>Resumen General de Vencimientos - {formatPeriodLabel(month, year)}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Total: {summaryTotals.total} clientes
                </span>
              </div>

              {/* Tarjetas de Métricas del Resumen */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Clientes</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{summaryTotals.total}</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Presentados</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>{summaryTotals.presentados}</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Pendientes</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>{summaryTotals.pendientes}</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Avance General</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                    {summaryTotals.total > 0 ? Math.round((summaryTotals.presentados / summaryTotals.total) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="summary-table-wrapper">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>Vencimiento</th>
                      <th>Total Clientes</th>
                      <th>Presentados</th>
                      <th>Pendientes</th>
                      <th>Progreso</th>
                      <th>Encargado por Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row) => {
                      const pct = row.total > 0 ? Math.round((row.presentados / row.total) * 100) : 0;
                      return (
                        <tr key={row.dayKey}>
                          <td>
                            <strong>{row.dayKey}</strong>
                          </td>
                          <td>{row.total}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            {row.presentados}
                          </td>
                          <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            {row.pendientes}
                          </td>
                          <td>
                            <div className="progress-bar-bg">
                              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{pct}%</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {Object.entries(row.userBreakdown).map(([usr, stats]) => (
                                <span key={usr} className="assigned-user-badge">
                                  {usr}: {stats.presentados}/{stats.total}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="total-row">
                      <td>TOTAL GENERAL</td>
                      <td>{summaryTotals.total}</td>
                      <td style={{ color: 'var(--success)' }}>{summaryTotals.presentados}</td>
                      <td style={{ color: 'var(--danger)' }}>{summaryTotals.pendientes}</td>
                      <td>
                        {summaryTotals.total > 0 ? Math.round((summaryTotals.presentados / summaryTotals.total) * 100) : 0}%
                      </td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <div className="empty-state">
              <BarChart3 className="empty-icon" />
              <h3>Cargando resumen de vencimientos...</h3>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* APARTADO 2: LISTA DE CLIENTES */}
      {activeTab === 'lista' && (
        <>
          <div className="list-actions">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por cliente, RUC..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <motion.button
              className="clear-search-btn"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setQuery('')}
            >
              <X size={16} />
            </motion.button>
          )}
        </div>

        {!readOnlyPreview && (
          <motion.button
            className="btn-primary"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onNewClient(headers)}
          >
            <Plus size={18} />
            <span>Nuevo Cliente</span>
          </motion.button>
        )}

        {/* Disparador del panel de filtros: solo visible en mobile (CSS).
            En desktop los filtros ya están siempre a la vista debajo. */}
        {!loading && !error && rows.length > 0 && (
          <button
            type="button"
            className="mobile-filters-trigger"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter size={16} />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="mobile-filters-badge">{activeFilterCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Filter and Sorting Panel.
          En desktop: se ve tal cual, siempre visible, como antes.
          En mobile: se convierte en un bottom-sheet controlado por
          `filtersOpen`, para no ocupar toda la pantalla de entrada. */}
      {!loading && !error && rows.length > 0 && (() => {
        const filtersPanel = (
        <div className={`filters-panel-wrapper ${filtersOpen ? 'is-open' : ''}`}>
          <div
            className="filters-backdrop"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            className="filter-controls-card"
            drag={isMobileLayout ? 'y' : false}
            dragListener={false}
            dragControls={filtersDragControls}
            dragConstraints={{ top: 0, bottom: 600 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_e, info) => {
              // Se cierra si arrastraste bastante hacia abajo, o con un
              // gesto rápido aunque no haya recorrido mucha distancia
              // (como cualquier bottom-sheet nativo).
              if (info.offset.y > 90 || info.velocity.y > 500) {
                setFiltersOpen(false);
              }
            }}
            initial={false}
            animate={isMobileLayout ? { y: filtersOpen ? 0 : '100%' } : { y: 0 }}
            transition={{ type: 'spring', damping: 34, stiffness: 320 }}
          >
            {/* Barrita de agarre: acá arranca el gesto de arrastre (no en
                toda la tarjeta), para no pisar el scroll de los filtros
                de abajo cuando hay muchos. */}
            <div
              className="filter-drag-handle"
              onPointerDown={(e) => {
                if (isMobileLayout) filtersDragControls.start(e);
              }}
            >
              <span className="filter-drag-handle-bar" />
            </div>
            <div
              className="filters-sheet-header"
              onPointerDown={(e) => {
                if (isMobileLayout) filtersDragControls.start(e);
              }}
            >
              <span className="filters-sheet-title">
                <Filter size={15} /> Filtros
              </span>
              <button
                type="button"
                className="filters-sheet-close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setFiltersOpen(false)}
                title="Cerrar filtros"
              >
                <X size={18} />
              </button>
            </div>

            {/* Vencimientos Filter Pills */}
          {vencimientoKey && availableVencimientos.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">
                <Calendar size={14} /> Vencimiento:
              </span>
              <div className="filter-pills">
                <button
                  className={`filter-pill ${selectedVencimiento === 'todos' ? 'active' : ''}`}
                  onClick={() => setSelectedVencimiento('todos')}
                >
                  Todos
                </button>
                {availableVencimientos.map((day, idx) => (
                  <button
                    key={day}
                    className={`filter-pill filter-pill-vencimiento ${selectedVencimiento === day ? 'active' : ''}`}
                    onClick={() => setSelectedVencimiento(day)}
                    title={`Día ${day} • Terminación ${idx}`}
                    aria-label={`Vencimiento Día ${day}, terminación ${idx}`}
                  >
                    {/* Decorativos: el nombre accesible del botón ya está en
                        aria-label. La terminación queda opacity:0 (no
                        display:none) para que el pill no cambie de tamaño. */}
                    <span className="pill-day-label" aria-hidden="true">Día {day}</span>
                    <span className="pill-digit-label" aria-hidden="true">{idx}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Encargado Filter Pills -- estado compartido con "Asignar
              clientes": si elegís una persona acá, esa pantalla también
              queda filtrada por esa persona (y viceversa). */}
          {encargadoCol && (
            <div className="filter-row">
              <span className="filter-label">
                <UserCog size={14} /> Encargado:
              </span>
              <div className="filter-pills">
                <button
                  className={`filter-pill ${selectedAssignee === 'todos' ? 'active' : ''}`}
                  onClick={() => setSelectedAssignee('todos')}
                >
                  Todos
                </button>
                <button
                  className={`filter-pill ${selectedAssignee === 'sin_asignar' ? 'active' : ''}`}
                  onClick={() => setSelectedAssignee('sin_asignar')}
                >
                  Sin asignar ({unassignedCount})
                </button>
                <button
                  className={`filter-pill ${selectedAssignee === 'mis' ? 'active' : ''}`}
                  onClick={() => setSelectedAssignee('mis')}
                  title="Solo los clientes que te tocan a vos"
                >
                  <UserCheck size={12} /> Mis clientes
                </button>
                {/* El usuario logueado NO se repite acá: ya tiene el pill
                    "Mis clientes", que filtra exactamente por lo mismo (la
                    columna Encargado === user). Tener los dos era redundante. */}
                {teamUsers
                  .filter((u) => u !== user)
                  .map((u) => (
                    <button
                      key={u}
                      className={`filter-pill ${selectedAssignee === u ? 'active' : ''}`}
                      onClick={() => setSelectedAssignee(u)}
                    >
                      {u}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Status Filter Pills */}
          {primaryStatusHeader && (
            <div className="filter-row">
              <span className="filter-label">
                <Filter size={14} /> Estado ({getDisplayHeader(primaryStatusHeader)}):
              </span>
              <div className="filter-pills">
                <button
                  className={`filter-pill ${selectedStatus === 'todos' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('todos')}
                >
                  Todos
                </button>
                <button
                  className={`filter-pill ${selectedStatus === 'presentado' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('presentado')}
                >
                  <CheckCircle2 size={12} /> Presentados
                </button>
                <button
                  className={`filter-pill ${selectedStatus === 'pendiente' ? 'active' : ''}`}
                  onClick={() => setSelectedStatus('pendiente')}
                >
                  <XCircle size={12} /> Pendientes
                </button>
              </div>
            </div>
          )}

          {/* Integrated Footer: Count & Sorting */}
          <div className="filter-footer-row">
            <div className="filter-footer-left">
              <div className="stats-bar-count">
                <Users size={14} />
                <span>Mostrando</span>
                <span className="count-badge">
                  {filteredAndSorted.length} de {rows.length}
                </span>
              </div>
            </div>

            <div className="filter-footer-right">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="filter-label" style={{ minWidth: 'auto' }}>
                  <ArrowUpDown size={14} /> Ordenar por:
                </span>
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="alpha">A - Z (Alfabético)</option>
                  {vencimientoKey && <option value="vencimiento">Por Vencimiento (Día 7, 9, 11...)</option>}
                </select>
              </div>

              {hasActiveFilters && (
                <motion.button
                  className="back-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={clearFilters}
                  title="Limpiar los filtros (compartidos con Asignar clientes)"
                >
                  <X size={13} /> Limpiar filtros
                </motion.button>
              )}
            </div>
          </div>
          </motion.div>
        </div>
        );

        // En mobile, portal directo a document.body para escapar del
        // <motion.div> con transform que envuelve esta pantalla (ver
        // comentario en isMobileLayout más arriba). En desktop, se
        // renderiza inline como siempre, en su lugar natural del layout.
        return isMobileLayout ? createPortal(filtersPanel, document.body) : filtersPanel;
      })()}

      {/* Mobile-only compact stats bar: en desktop está unificado dentro del panel de filtros */}
      {isMobileLayout && (
        <div className="stats-bar">
          <div className="stats-bar-count">
            <Users size={14} />
            <span>Mostrando</span>
            <span className="count-badge">
              {filteredAndSorted.length} de {rows.length}
            </span>
          </div>
        </div>
      )}

      {loading && (
        <div className="skeleton-container" style={{ maxWidth: '100%' }}>
          <div className="skeleton-item" style={{ height: '64px' }} />
          <div className="skeleton-item" style={{ height: '64px' }} />
          <div className="skeleton-item" style={{ height: '64px' }} />
          <div className="skeleton-item" style={{ height: '64px' }} />
        </div>
      )}

      {error && !loading && (
        <motion.div
          className="error-banner"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Error al cargar clientes</strong>
            <div style={{ fontSize: '13px', marginTop: '2px' }}>{error}</div>
            <motion.button
              className="btn-secondary"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              style={{ marginTop: '10px', padding: '6px 12px', fontSize: '13px' }}
              onClick={refreshAll}
            >
              <RefreshCw size={14} /> Reintentar
            </motion.button>
          </div>
        </motion.div>
      )}

      {!loading && !error && (
        <>
          {isTouchDevice && !readOnlyPreview && filteredAndSorted.length > 0 && (
            <div className="swipe-hint-bar">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                👉 Desliza a la derecha: <strong style={{ color: '#15803d' }}>Presentado</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                👈 Desliza a la izquierda: <strong style={{ color: '#6b21a8' }}>Archivado</strong>
              </span>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.ul
              key={`${query}_${selectedVencimiento}_${selectedStatus}_${selectedAssignee}_${sortBy}`}
              ref={listRef}
              className="client-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              style={{ position: 'relative', height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const row = filteredAndSorted[virtualItem.index];
                if (!row) return null;

                // Extract Presentado por / Archivado por from row if available
                const presUser =
                  presentadoPorCol && row[presentadoPorCol] ? String(row[presentadoPorCol]) : null;
                const archUser =
                  archivadoPorCol && row[archivadoPorCol] ? String(row[archivadoPorCol]) : null;

                // Check if Presentado / Archivado primary status columns or stamps are SÍ
                const presHeader = statusHeaders.find((h) => findPresentadoColumn([h])) || presentadoCol;
                const archHeader = statusHeaders.find((h) => findArchivadoColumn([h])) || archivadoCol;

                const isPresSi = presHeader
                  ? isAffirmativeValue(row[presHeader]) || (presHeader === presentadoPorCol && Boolean(row[presHeader]))
                  : Boolean(presUser);

                const isArchSi = archHeader
                  ? isAffirmativeValue(row[archHeader]) || (archHeader === archivadoPorCol && Boolean(row[archHeader]))
                  : Boolean(archUser);

                return (
                  <SwipeableClientCard
                    key={row._row}
                    ref={rowVirtualizer.measureElement}
                    dataIndex={virtualItem.index}
                    virtualStyle={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start - rowVirtualizer.options.scrollMargin}px)`,
                    }}
                    row={row}
                    nameKey={nameKey}
                    vencimientoKey={vencimientoKey}
                    presUser={presUser}
                    archUser={archUser}
                    presHeader={presHeader}
                    archHeader={archHeader}
                    presentadoPorCol={presentadoPorCol}
                    archivadoPorCol={archivadoPorCol}
                    isPresSi={isPresSi}
                    isArchSi={isArchSi}
                    statusHeaders={statusHeaders}
                    user={user}
                    onSelect={onSelect}
                    handleQuickToggle={handleQuickToggle}
                    getDisplayHeader={getDisplayHeader}
                    itemVariants={itemVariants}
                    isTouchDevice={isTouchDevice}
                    headers={headers}
                    hasEncargadoCol={Boolean(encargadoCol)}
                    canAssignClients={canAssignClients}
                    teamUsers={teamUsers}
                    repartoUsers={repartoUsers}
                    onSetEncargado={setEncargado}
                    savingEncargado={savingRows.includes(row._row)}
                    readOnlyPreview={readOnlyPreview}
                  />
                );
              })}

            {filteredAndSorted.length === 0 && (
              <motion.div
                className="empty-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Users className="empty-icon" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                  No se encontraron clientes
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {hasActiveFilters
                    ? 'Pruebe ajustar la búsqueda o los filtros de asignación, vencimiento y estado.'
                    : 'No hay clientes cargados en esta planilla.'}
                </p>
                {hasActiveFilters ? (
                  <motion.button
                    className="btn-secondary"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={clearFilters}
                  >
                    Limpiar todos los filtros
                  </motion.button>
                ) : !readOnlyPreview ? (
                  <motion.button
                    className="btn-primary"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onNewClient(headers)}
                  >
                    <Plus size={16} /> Crear primer cliente
                  </motion.button>
                ) : null}
              </motion.div>
            )}
            </motion.ul>
          </AnimatePresence>
        </>
      )}
    </>
  )}

  {/* Team Management Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="team-modal-overlay" onClick={() => setShowTeamModal(false)}>
            <motion.div
              className="team-modal"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="team-modal-header">
                <div className="team-modal-title">
                  <UserCheck size={20} style={{ color: 'var(--primary)' }} />
                  <span>Equipo ({teamUsers.length} Usuarios Sincronizados)</span>
                </div>
                <button
                  type="button"
                  className="team-modal-close"
                  onClick={() => setShowTeamModal(false)}
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px', border: '1px solid var(--primary-border)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: 0, lineHeight: '1.4' }}>
                  <strong>Gestión desde Google Sheets:</strong> Para agregar o quitar usuarios del equipo, edita directamente la lista de usuarios en tu planilla de Google Sheets. Luego presiona el botón para actualizar.
                </p>
              </div>

              <div style={{ marginBottom: '16px', maxHeight: '220px', overflowY: 'auto' }}>
                {teamUsers.map((member, idx) => (
                  <div key={member} className="team-member-chip">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          fontSize: '11px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 600 }}>{member}</span>
                    </span>
                    {member === user && (
                      <span style={{ fontSize: '11px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        Tú
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <motion.button
                type="button"
                className="btn-primary btn-sync-users"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => syncTeamUsers(true)}
                disabled={syncingUsers}
                style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
              >
                <RefreshCw size={16} className={syncingUsers ? 'spin' : ''} />
                <span>{syncingUsers ? 'Sincronizando...' : 'Sincronizar usuarios desde Sheets'}</span>
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
