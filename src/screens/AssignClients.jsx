import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import {
  pickNameColumn,
  findEncargadoColumn,
  findVencimientoColumn,
  assignClientsSequentially,
  formatPeriodLabel,
} from '../utils';
import {
  ArrowLeft,
  Search,
  Loader2,
  AlertCircle,
  UserCog,
  Check,
  CheckCircle2,
  Calendar,
  Shuffle,
  X,
  Undo2,
  UserX,
} from 'lucide-react';

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.015 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15 } },
};

export default function AssignClients({ user, year, month, onBack }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [savingRow, setSavingRow] = useState(null);
  const [savedRow, setSavedRow] = useState(null);

  const [selectedVencimiento, setSelectedVencimiento] = useState('todos');
  const [selectedStatus, setSelectedStatus] = useState('todos'); // 'todos' | 'sin_asignar' | nombre de usuario

  // Modo asignación rápida / toque: elegís un usuario activo o "desasignar"
  // y vas tocando clientes para asignar o desasignar al instante sin selectores
  const [activeAssignee, setActiveAssignee] = useState(null); // string (user) | '__unassign__' | null

  // Historial de cambios para permitir revertir
  const [history, setHistory] = useState([]); // Array<{ rowNum, prevUser, newUser, clientName }>
  const [undoing, setUndoing] = useState(false);

  // Confirmación del reparto automático (round-robin)
  const [confirmingRoundRobin, setConfirmingRoundRobin] = useState(false);
  const [roundRobinScope, setRoundRobinScope] = useState('sin_asignar'); // 'sin_asignar' | 'todos'
  const [runningRoundRobin, setRunningRoundRobin] = useState(false);
  const [roundRobinProgress, setRoundRobinProgress] = useState(null); // { done, total }

  // El reparto automático siempre usa a todo el equipo (teamUsers), en
  // el orden que venga del backend -- sin checkbox de exclusión ni
  // reordenamiento manual, para que cada pill haga una sola cosa: tocarla
  // selecciona a esa persona para asignarle clientes.
  const roundRobinParticipants = teamUsers;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([api.readClients(year, month), api.listUsers()])
      .then(([data, users]) => {
        if (cancelled) return;
        setHeaders(data.headers || []);
        setRows(data.rows || []);
        setTeamUsers(users || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar la planilla');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const nameKey = useMemo(() => pickNameColumn(headers), [headers]);
  const encargadoCol = useMemo(() => findEncargadoColumn(headers), [headers]);
  const vencimientoKey = useMemo(() => findVencimientoColumn(headers), [headers]);

  const availableVencimientos = useMemo(() => {
    if (!vencimientoKey || !rows.length) return [];
    const set = new Set();
    rows.forEach((r) => {
      const raw = String(r[vencimientoKey] || '').trim();
      if (!raw) return;
      const digits = raw.match(/\d+/);
      set.add(digits ? String(parseInt(digits[0], 10)) : raw);
    });
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [vencimientoKey, rows]);

  function getVencimientoDay(row) {
    if (!vencimientoKey) return 'Sin vencimiento';
    const raw = String(row[vencimientoKey] || '').trim();
    if (!raw) return 'Sin vencimiento';
    const digits = raw.match(/\d+/);
    return digits ? String(parseInt(digits[0], 10)) : raw;
  }

  const filteredRows = useMemo(() => {
    let list = [...rows].sort((a, b) =>
      String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), 'es', { sensitivity: 'base' })
    );

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => String(r[nameKey] || '').toLowerCase().includes(q));
    }

    if (selectedVencimiento !== 'todos' && vencimientoKey) {
      list = list.filter((r) => getVencimientoDay(r) === selectedVencimiento);
    }

    if (selectedStatus === 'sin_asignar') {
      list = list.filter((r) => !r[encargadoCol]);
    } else if (selectedStatus !== 'todos') {
      list = list.filter((r) => r[encargadoCol] === selectedStatus);
    }

    return list;
  }, [rows, nameKey, query, selectedVencimiento, vencimientoKey, selectedStatus, encargadoCol]);

  // Vista agrupada por vencimiento: se arma solo cuando tiene sentido
  // verla (viendo "Todos los vencimientos", sin buscar nada puntual) y
  // hay más de un grupo -- así se puede ver el ciclo del round-robin tal
  // cual lo aplica el algoritmo (ordenado por fila de la hoja, NO
  // alfabético, porque el reparto cíclico se basa en ese orden).
  const groupedByVencimiento = useMemo(() => {
    if (!vencimientoKey || selectedVencimiento !== 'todos' || query.trim()) return null;

    const groups = new Map();
    filteredRows.forEach((row) => {
      const day = getVencimientoDay(row);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(row);
    });

    if (groups.size <= 1) return null;

    const dayOrder = [...availableVencimientos, 'Sin vencimiento'];
    return dayOrder
      .filter((day) => groups.has(day))
      .map((day) => ({
        day,
        // Orden por fila de la hoja (no alfabético): es el mismo criterio
        // que usa assignClientsSequentially para el ciclo, así lo que se
        // ve acá coincide con cómo se reparte de verdad.
        rows: [...groups.get(day)].sort((a, b) => (a._row || 0) - (b._row || 0)),
      }));
  }, [filteredRows, vencimientoKey, selectedVencimiento, query, availableVencimientos]);

  const unassignedCount = useMemo(
    () => rows.filter((r) => !r[encargadoCol]).length,
    [rows, encargadoCol]
  );

  // Mismo conteo pero solo dentro de lo que está filtrado ahora (ej: si
  // filtraste "Día 7", cuenta sin asignar de ese día nomás) -- así el
  // número que se ve en el botón de reparto coincide con lo que en
  // realidad se va a repartir.
  const filteredUnassignedCount = useMemo(
    () => filteredRows.filter((r) => !r[encargadoCol]).length,
    [filteredRows, encargadoCol]
  );

  async function assignRow(row, targetUser) {
    if (!encargadoCol) return;
    const valueToSave = targetUser === '__unassign__' ? '' : targetUser;
    const prevValue = row[encargadoCol] || '';
    if (prevValue === valueToSave) return; // ya tiene ese valor

    // Optimista: se pinta/despinta al toque, sin esperar la red. Antes
    // esto esperaba el await de api.updateCell (que además tiene ~300ms
    // de debounce interno en la cola de guardado) antes de tocar el
    // estado -- cada tap en modo rápido se sentía con demora. Ahora la
    // UI reacciona al instante y, si el guardado falla, se revierte.
    setRows((prev) =>
      prev.map((r) => (r._row === row._row ? { ...r, [encargadoCol]: valueToSave } : r))
    );
    setHistory((prev) => [
      {
        rowNum: row._row,
        prevUser: prevValue,
        newUser: valueToSave,
        clientName: row[nameKey] || 'Cliente',
      },
      ...prev.slice(0, 30), // guardar hasta 30 acciones en historial
    ]);
    setSavedRow(row._row);
    setTimeout(() => setSavedRow((r) => (r === row._row ? null : r)), 1000);

    setSavingRow(row._row);
    try {
      await api.updateCell({
        year,
        sheet: month,
        user,
        row: row._row,
        column: encargadoCol,
        value: valueToSave,
      });
    } catch (err) {
      // Revertir: el guardado no se pudo confirmar en el servidor
      setRows((prev) =>
        prev.map((r) => (r._row === row._row ? { ...r, [encargadoCol]: prevValue } : r))
      );
      setHistory((prev) => prev.filter((h) => h.rowNum !== row._row || h.newUser !== valueToSave));
      setError(err.message || 'No se pudo guardar la asignación');
    } finally {
      setSavingRow(null);
    }
  }

  function handleRowClick(row) {
    if (!activeAssignee || !encargadoCol) return;
    const currentVal = row[encargadoCol] || '';
    if (activeAssignee === '__unassign__') {
      if (currentVal) {
        assignRow(row, '__unassign__');
      }
    } else {
      // Toggle: si ya estaba asignado a este usuario, al volver a tocarlo se despinta y desasigna
      if (currentVal === activeAssignee) {
        assignRow(row, '__unassign__');
      } else {
        assignRow(row, activeAssignee);
      }
    }
  }

  async function undoLastAction() {
    if (!history.length || undoing || !encargadoCol) return;
    const lastAction = history[0];
    setUndoing(true);
    setSavingRow(lastAction.rowNum);
    try {
      await api.updateCell({
        year,
        sheet: month,
        user,
        row: lastAction.rowNum,
        column: encargadoCol,
        value: lastAction.prevUser,
      });
      setRows((prev) =>
        prev.map((r) => (r._row === lastAction.rowNum ? { ...r, [encargadoCol]: lastAction.prevUser } : r))
      );
      setHistory((prev) => prev.slice(1));
      setSavedRow(lastAction.rowNum);
      setTimeout(() => setSavedRow((r) => (r === lastAction.rowNum ? null : r)), 1000);
    } catch (err) {
      setError(err.message || 'No se pudo revertir el cambio');
    } finally {
      setUndoing(false);
      setSavingRow(null);
    }
  }

  async function runRoundRobin() {
    if (!encargadoCol || !roundRobinParticipants.length) return;
    setRunningRoundRobin(true);
    setError('');
    try {
      // El scope parte de lo que ya está filtrado en pantalla (respeta el
      // filtro de Vencimiento activo: si estás viendo "Día 7", el reparto
      // es solo para Día 7, no para toda la planilla) y encima se aplica
      // "solo sin asignar" o "todos" según lo elegido.
      const baseScope = filteredRows;
      const targets =
        roundRobinScope === 'todos' ? baseScope : baseScope.filter((r) => !r[encargadoCol]);
      const suggestions = assignClientsSequentially(targets, vencimientoKey, roundRobinParticipants);
      const total = suggestions.length;
      setRoundRobinProgress({ done: 0, total });

      // Se manda en lotes chicos y SECUENCIALES (no todos de una) por dos
      // motivos: 1) un solo request gigante contra Apps Script puede
      // tardar muchísimo y se sentía "colgado" aunque en realidad seguía
      // trabajando; 2) así se puede mostrar progreso real ("120/395") en
      // vez de un spinner opaco sin información.
      const CHUNK_SIZE = 25;
      for (let i = 0; i < suggestions.length; i += CHUNK_SIZE) {
        const chunk = suggestions.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map((row) =>
            api.updateCell({
              year,
              sheet: month,
              user,
              row: row._row,
              column: encargadoCol,
              value: row._assignedUser,
            })
          )
        );
        // Fuerza a que ESTE lote salga ya (no espera a mezclarse con el
        // siguiente), así el progreso que se muestra es real, no
        // optimista solamente.
        await api.flushPendingSaves();

        const chunkMap = new Map(chunk.map((r) => [r._row, r._assignedUser]));
        setRows((prev) =>
          prev.map((r) => (chunkMap.has(r._row) ? { ...r, [encargadoCol]: chunkMap.get(r._row) } : r))
        );
        setRoundRobinProgress({ done: Math.min(i + CHUNK_SIZE, total), total });
      }

      setConfirmingRoundRobin(false);
    } catch (err) {
      setError(err.message || 'No se pudo repartir automáticamente');
    } finally {
      setRunningRoundRobin(false);
      setRoundRobinProgress(null);
    }
  }

  return (
    <div className="screen wide">
      <div className="screen-header">
        <motion.button
          className="back-btn"
          whileHover={{ scale: 1.04, x: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          <span>Volver</span>
        </motion.button>

        <div className="save-all-notice">
          <UserCog size={14} />
          <span>Asignar clientes · {formatPeriodLabel(month, year)}</span>
        </div>
      </div>

      {loading && (
        <div className="empty-state">
          <Loader2 size={28} className="animate-spin" />
          <p>Cargando clientes...</p>
        </div>
      )}

      {!loading && error && (
        <div className="empty-state">
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && !encargadoCol && (
        <div className="empty-state">
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
          <p>
            Esta planilla todavía no tiene una columna <strong>"Encargado"</strong>.
            <br />
            Agregala en la hoja de {formatPeriodLabel(month, year)} para poder asignar clientes acá.
          </p>
        </div>
      )}

      {!loading && !error && encargadoCol && (
        <>
          <div className="assign-controls">
          {/* Toolbar: búsqueda + acciones masivas */}
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="assign-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <motion.button
                className="filter-pill"
                whileTap={{ scale: 0.96 }}
                onClick={() => setConfirmingRoundRobin(true)}
                disabled={!teamUsers.length}
              >
                <Shuffle size={13} /> Repartir automático
              </motion.button>

              {history.length > 0 && (
                <motion.button
                  className="filter-pill"
                  whileTap={{ scale: 0.96 }}
                  onClick={undoLastAction}
                  disabled={undoing}
                  style={{ color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
                  title="Revertir la última asignación"
                >
                  <Undo2 size={13} /> Revertir ({history.length})
                </motion.button>
              )}
            </div>
          </div>

          {/* Panel único: la misma lista de gente sirve para elegir a
              quién le tocás clientes a mano Y para marcar quién participa
              del reparto automático (checkbox en cada pill). Antes eran
              dos cajas separadas con la lista de gente repetida -- se
              sentía redundante porque literalmente lo era. */}
          <div className="assign-confirm-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                  {activeAssignee === '__unassign__' ? (
                    <>Tocá cualquier cliente para <span style={{ color: 'var(--danger)' }}>desasignarlo</span></>
                  ) : activeAssignee ? (
                    <>Asignando a: <strong style={{ color: 'var(--primary)' }}>{activeAssignee}</strong> (tocá para asignar; si ya está pintado, tocalo para despintar)</>
                  ) : (
                    'Tocá un nombre para asignar clientes tocándolos, o el check ✓ para incluirlo/sacarlo del reparto automático.'
                  )}
                </p>
              </div>
              {activeAssignee && (
                <button
                  type="button"
                  onClick={() => setActiveAssignee(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-subtle)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Modo solo lectura
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {teamUsers.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`filter-pill ${activeAssignee === u ? 'active' : ''}`}
                  onClick={() => setActiveAssignee((curr) => (curr === u ? null : u))}
                  title={`Tocar clientes para asignarlos a ${u}`}
                >
                  {u}
                </button>
              ))}

              <button
                className={`filter-pill ${activeAssignee === '__unassign__' ? 'active' : ''}`}
                onClick={() => setActiveAssignee((curr) => (curr === '__unassign__' ? null : '__unassign__'))}
                style={activeAssignee === '__unassign__' ? { backgroundColor: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' } : {}}
                title="Tocar clientes para desasignar directamente"
              >
                <UserX size={13} /> Desasignar
              </button>
            </div>

            {/* Confirmación del reparto automático: se expande DENTRO del
                mismo panel, sin repetir la lista de gente de arriba. */}
            <AnimatePresence>
              {confirmingRoundRobin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '12px', paddingTop: '12px' }}>
                    <p>
                      Repartir <strong>{filteredRows.length} clientes</strong>
                      {selectedVencimiento !== 'todos' ? <> del Día {selectedVencimiento}</> : null}
                      {' '}entre los <strong>{roundRobinParticipants.length}</strong> usuarios del equipo,
                      agrupando por vencimiento.
                    </p>

                    <div className="filter-pills" style={{ margin: '10px 0' }}>
                      <button
                        className={`filter-pill ${roundRobinScope === 'sin_asignar' ? 'active' : ''}`}
                        onClick={() => setRoundRobinScope('sin_asignar')}
                      >
                        Solo sin asignar ({filteredUnassignedCount})
                      </button>
                      <button
                        className={`filter-pill ${roundRobinScope === 'todos' ? 'active' : ''}`}
                        onClick={() => setRoundRobinScope('todos')}
                      >
                        Reasignar todos ({filteredRows.length})
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button
                        type="button"
                        className="btn-primary"
                        whileTap={{ scale: 0.97 }}
                        onClick={runRoundRobin}
                        disabled={runningRoundRobin || !roundRobinParticipants.length}
                        style={{ padding: '8px 16px' }}
                      >
                        {runningRoundRobin ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        <span>
                          {runningRoundRobin
                            ? roundRobinProgress
                              ? `Asignando ${roundRobinProgress.done}/${roundRobinProgress.total}...`
                              : 'Preparando...'
                            : !roundRobinParticipants.length
                            ? 'Marcá al menos un usuario con ✓'
                            : 'Confirmar reparto'}
                        </span>
                      </motion.button>
                      <button
                        type="button"
                        className="pill-btn"
                        onClick={() => setConfirmingRoundRobin(false)}
                        disabled={runningRoundRobin}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filtros: Vencimiento + Encargado, mismo patrón que la lista principal */}
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
                    <span className="pill-day-label">Día {day}</span>
                    <span className="pill-digit-label">{idx}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-row">
            <span className="filter-label">
              <UserCog size={14} /> Estado:
            </span>
            <div className="filter-pills">
              <button
                className={`filter-pill ${selectedStatus === 'todos' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('todos')}
              >
                Todos
              </button>
              <button
                className={`filter-pill ${selectedStatus === 'sin_asignar' ? 'active' : ''}`}
                onClick={() => setSelectedStatus('sin_asignar')}
              >
                Sin asignar ({unassignedCount})
              </button>
              {teamUsers.map((u) => (
                <button
                  key={u}
                  className={`filter-pill ${selectedStatus === u ? 'active' : ''}`}
                  onClick={() => setSelectedStatus(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Integrated Footer: Results Count */}
          <div className="filter-footer-row">
            <div className="filter-footer-left">
              <div className="stats-bar-count">
                <UserCog size={14} />
                <span>Mostrando</span>
                <span className="count-badge">{filteredRows.length} de {rows.length}</span>
              </div>
            </div>

            {groupedByVencimiento && (
              <div className="stats-bar-tags">
                <span>Agrupado por vencimiento, en orden de reparto</span>
              </div>
            )}
          </div>
          </div>

          {(() => {
            const renderRow = (row) => {
              const currentEncargado = row[encargadoCol] || '';
              const isAssignedToActive =
                activeAssignee &&
                activeAssignee !== '__unassign__' &&
                currentEncargado === activeAssignee;
              const isUnassigned = !currentEncargado;

              let rowTitle = undefined;
              if (activeAssignee === '__unassign__') {
                rowTitle = currentEncargado ? 'Tocá para desasignar' : 'Sin asignar';
              } else if (activeAssignee) {
                rowTitle = isAssignedToActive
                  ? `Asignado a ${activeAssignee} (tocá para despintar / desasignar)`
                  : `Tocá para asignar a ${activeAssignee}`;
              }

              return (
                <motion.div
                  key={row._row}
                  className={`assign-row ${activeAssignee ? 'assign-row-quick' : ''} ${
                    isAssignedToActive ? 'assign-row-matched' : ''
                  }`}
                  variants={rowVariants}
                  onClick={() => handleRowClick(row)}
                  whileTap={activeAssignee ? { scale: 0.98 } : undefined}
                  title={rowTitle}
                >
                  <span className="assign-row-name">{row[nameKey] || 'Sin nombre'}</span>

                  <div className="assign-row-control">
                    {savingRow === row._row && <Loader2 size={15} className="animate-spin" />}
                    {savedRow === row._row && <Check size={15} style={{ color: 'var(--success)' }} />}
                    {isAssignedToActive && savingRow !== row._row && savedRow !== row._row && (
                      <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                    )}
                    <span
                      className="assign-row-current"
                      style={
                        isUnassigned
                          ? { color: 'var(--text-subtle)', fontStyle: 'italic' }
                          : { fontWeight: 600, color: 'var(--text-main)' }
                      }
                    >
                      {currentEncargado || 'Sin asignar'}
                    </span>
                  </div>
                </motion.div>
              );
            };

            if (groupedByVencimiento) {
              return groupedByVencimiento.map((group) => (
                <div key={group.day} className="assign-group">
                  <div className="assign-group-header">
                    <Calendar size={13} />
                    <span>
                      {group.day === 'Sin vencimiento' ? 'Sin vencimiento' : `Día ${group.day}`}
                    </span>
                    <span className="assign-group-count">{group.rows.length}</span>
                  </div>
                  <motion.div
                    className="assign-list"
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {group.rows.map(renderRow)}
                  </motion.div>
                </div>
              ));
            }

            return (
              <motion.div className="assign-list" variants={listVariants} initial="hidden" animate="visible">
                {filteredRows.map(renderRow)}
              </motion.div>
            );
          })()}
        </>
      )}
    </div>
  );
}
