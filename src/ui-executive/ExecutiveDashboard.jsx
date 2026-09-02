import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useClients } from '../context/ClientsContext';
import { formatPeriodLabel, isAffirmativeValue } from '../utils';

const QUICK_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'mine', label: 'Mis clientes' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'early', label: 'Días 1–15' },
  { id: 'unassigned', label: 'Sin asignar' },
];

function isArchived(row, archivedColumn, archivedByColumn) {
  const hasArchivedValue = archivedColumn && isAffirmativeValue(row[archivedColumn]);
  const hasArchivedStamp =
    archivedByColumn && Boolean(String(row[archivedByColumn] || '').trim());
  return Boolean(hasArchivedValue || hasArchivedStamp);
}

function getDueNumber(row, dueColumn) {
  if (!dueColumn) return Number.POSITIVE_INFINITY;
  const match = String(row[dueColumn] || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.POSITIVE_INFINITY;
}

function StatusIcon({ type, active }) {
  const archived = type === 'archived';
  const label = archived
    ? (active ? 'Archivado' : 'Sin archivar')
    : (active ? 'Presentado' : 'Pendiente');

  return (
    <span
      className={`real-exec-status-chip ${active ? 'is-active' : 'is-inactive'} ${archived ? 'is-archived' : 'is-presented'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {archived ? <Archive size={12} /> : <ClipboardCheck size={12} />}
      <span>{label}</span>
    </span>
  );
}

function Metric({ icon: Icon, value, label, tone }) {
  return (
    <article className={`real-exec-metric tone-${tone}`}>
      <span className="real-exec-metric-icon"><Icon size={18} /></span>
      <span><strong>{value}</strong><small>{label}</small></span>
    </article>
  );
}

const ExecutiveDashboard = forwardRef(function ExecutiveDashboard({ onSelect }, ref) {
  const {
    user,
    year,
    month,
    assignedRows,
    loading,
    error,
    reload,
    syncTeamUsers,
    nameKey,
    rucKey,
    vencimientoKey,
    encargadoCol,
    archivadoCol,
    archivadoPorCol,
    query,
    setQuery,
    applySharedFilters,
    isRowPresentado,
  } = useClients();

  const [quickFilter, setQuickFilter] = useState('all');
  const clientSectionRef = useRef(null);

  const refresh = useCallback(
    () => Promise.allSettled([reload(true), syncTeamUsers(true)]),
    [reload, syncTeamUsers]
  );

  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  const metrics = useMemo(() => {
    let presented = 0;
    let archived = 0;
    assignedRows.forEach((row) => {
      if (isRowPresentado(row)) presented += 1;
      if (isArchived(row, archivadoCol, archivadoPorCol)) archived += 1;
    });
    return {
      total: assignedRows.length,
      presented,
      pending: assignedRows.length - presented,
      archived,
    };
  }, [assignedRows, archivadoCol, archivadoPorCol, isRowPresentado]);

  const completion = metrics.total
    ? Math.round((metrics.presented / metrics.total) * 100)
    : 0;

  const priorityRows = useMemo(
    () =>
      assignedRows
        .filter((row) => !isRowPresentado(row))
        .sort((left, right) => getDueNumber(left, vencimientoKey) - getDueNumber(right, vencimientoKey))
        .slice(0, 3),
    [assignedRows, isRowPresentado, vencimientoKey]
  );

  const workload = useMemo(() => {
    const totals = new Map();
    assignedRows.forEach((row) => {
      const assignee = String(row._assignedUser || '').trim() || 'Sin asignar';
      totals.set(assignee, (totals.get(assignee) || 0) + 1);
    });
    return [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [assignedRows]);

  const filteredRows = useMemo(() => {
    const rows = applySharedFilters(assignedRows).filter((row) => {
      const assignee = encargadoCol ? String(row[encargadoCol] || '').trim() : '';
      if (quickFilter === 'mine') return assignee === user;
      if (quickFilter === 'pending') return !isRowPresentado(row);
      if (quickFilter === 'early') return getDueNumber(row, vencimientoKey) <= 15;
      if (quickFilter === 'unassigned') return !assignee;
      return true;
    });

    return rows.sort((left, right) => {
      const dueDifference = getDueNumber(left, vencimientoKey) - getDueNumber(right, vencimientoKey);
      if (dueDifference !== 0) return dueDifference;
      return String(left[nameKey] || '').localeCompare(String(right[nameKey] || ''), 'es', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [
    applySharedFilters,
    assignedRows,
    encargadoCol,
    isRowPresentado,
    nameKey,
    quickFilter,
    user,
    vencimientoKey,
  ]);

  const showPendingClients = () => {
    setQuickFilter('pending');
    window.requestAnimationFrame(() => {
      clientSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (loading) {
    return (
      <main className="real-exec-screen real-exec-centered">
        <RefreshCw className="real-exec-spin" size={28} />
        <strong>Cargando panel ejecutivo…</strong>
        <span>Preparando los datos del período.</span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="real-exec-screen real-exec-centered">
        <AlertCircle size={30} />
        <strong>No se pudo cargar el panel</strong>
        <span>{error}</span>
        <button type="button" onClick={() => reload(true)}><RefreshCw size={15} /> Reintentar</button>
      </main>
    );
  }

  return (
    <main className="real-exec-screen">
      <section className="real-exec-hero">
        <div className="real-exec-hero-copy">
          <span className="real-exec-eyebrow"><BarChart3 size={13} /> Panel del período</span>
          <h1>Tu operación,<br />bajo control.</h1>
          <p>
            {metrics.presented} de {metrics.total} clientes ya fueron presentados en{' '}
            {formatPeriodLabel(month, year)}.
          </p>
          <button type="button" onClick={showPendingClients}>
            <Clock3 size={16} /> Revisar {metrics.pending} pendientes
          </button>
        </div>

        <div className="real-exec-progress-card">
          <span>AVANCE REAL</span>
          <div className="real-exec-progress-ring" style={{ '--real-progress': `${completion * 3.6}deg` }}>
            <strong>{completion}<small>%</small></strong>
          </div>
          <small>{metrics.presented} presentados · {metrics.pending} pendientes</small>
        </div>
      </section>

      <section className="real-exec-metrics" aria-label="Resumen del período">
        <Metric icon={Users} value={metrics.total} label="Clientes" tone="blue" />
        <Metric icon={Clock3} value={metrics.pending} label="Pendientes" tone="amber" />
        <Metric icon={CheckCircle2} value={metrics.presented} label="Presentados" tone="green" />
        <Metric icon={Archive} value={metrics.archived} label="Archivados" tone="navy" />
      </section>

      <section className="real-exec-insights">
        <article className="real-exec-priority-card">
          <div className="real-exec-section-heading">
            <div><span>PRIORIDAD</span><h2>Requieren atención</h2></div>
            <small>{priorityRows.length}</small>
          </div>
          {priorityRows.length ? priorityRows.map((row) => {
            const due = getDueNumber(row, vencimientoKey);
            return (
              <button type="button" key={row._row} onClick={() => onSelect(row)}>
                <i className={due <= 10 ? 'is-urgent' : ''} />
                <span><strong>{row[nameKey] || 'Sin nombre'}</strong><small>{rucKey ? row[rucKey] : `Fila ${row._row}`}</small></span>
                <em>{Number.isFinite(due) ? `Día ${due}` : 'Sin fecha'}</em>
                <ChevronRight size={15} />
              </button>
            );
          }) : (
            <div className="real-exec-positive-empty"><CheckCircle2 size={18} /> No hay presentaciones pendientes.</div>
          )}
        </article>

        <article className="real-exec-workload-card">
          <div className="real-exec-section-heading">
            <div><span>EQUIPO</span><h2>Carga asignada</h2></div>
          </div>
          {workload.length ? workload.map(([name, count]) => (
            <div className="real-exec-workload-row" key={name}>
              <span>{name}</span>
              <div><i style={{ width: `${metrics.total ? (count / metrics.total) * 100 : 0}%` }} /></div>
              <strong>{count}</strong>
            </div>
          )) : <span className="real-exec-no-data">Sin asignaciones para mostrar.</span>}
        </article>
      </section>

      <section className="real-exec-clients" ref={clientSectionRef}>
        <div className="real-exec-section-heading real-exec-clients-heading">
          <div>
            <span>CARTERA ACTIVA</span>
            <h2>Todos los clientes</h2>
            <p>Consulta de estados, responsables y vencimientos.</p>
          </div>
          <small><strong>{filteredRows.length}</strong> de {metrics.total}</small>
        </div>

        <div className="real-exec-search-row">
          <label className="real-exec-search">
            <Search size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente o RUC…"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
          </label>
          <div className="real-exec-filters">
            <Filter size={14} />
            {QUICK_FILTERS.map((filter) => (
              <button
                type="button"
                className={quickFilter === filter.id ? 'is-active' : ''}
                key={filter.id}
                onClick={() => setQuickFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRows.length ? (
          <div className="real-exec-table">
            <div className="real-exec-table-head">
              <span>N.º</span><span>Cliente</span><span>Encargado</span><span>Vence</span><span>Estados</span><span />
            </div>
            {filteredRows.map((row, index) => {
              const clientName = row[nameKey] || 'Sin nombre';
              const assignee = String(row._assignedUser || '').trim();
              const due = getDueNumber(row, vencimientoKey);
              return (
                <button type="button" className="real-exec-client-row" key={row._row} onClick={() => onSelect(row)}>
                  <span className="real-exec-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="real-exec-client-identity">
                    <span>{String(clientName).charAt(0).toUpperCase()}</span>
                    <span><strong>{clientName}</strong><small>{rucKey && row[rucKey] ? `RUC ${row[rucKey]}` : `Fila ${row._row}`}</small></span>
                  </span>
                  <span className={`real-exec-assignee ${assignee ? '' : 'is-empty'}`}>
                    <UserRound size={13} /> {assignee || 'Sin asignar'}
                  </span>
                  <span className="real-exec-due"><CalendarDays size={13} />{Number.isFinite(due) ? `Día ${due}` : '—'}</span>
                  <span className="real-exec-statuses">
                    <StatusIcon type="presented" active={isRowPresentado(row)} />
                    <StatusIcon type="archived" active={isArchived(row, archivadoCol, archivadoPorCol)} />
                  </span>
                  <ChevronRight className="real-exec-chevron" size={16} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="real-exec-empty">
            <Building2 size={24} />
            <strong>No encontramos clientes</strong>
            <span>Probá cambiando la búsqueda o el filtro seleccionado.</span>
          </div>
        )}
      </section>
    </main>
  );
});

export default ExecutiveDashboard;
