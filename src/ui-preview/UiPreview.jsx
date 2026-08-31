import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Filter,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Monitor,
  Moon,
  MoreHorizontal,
  Search,
  Smartphone,
  Sparkles,
  Sun,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';

const VARIANTS = [
  { id: 'compact', short: 'A', name: 'Consola operativa', icon: ListFilter },
  { id: 'dashboard', short: 'B', name: 'Panel ejecutivo', icon: BarChart3 },
  { id: 'balanced', short: 'C', name: 'Flujo móvil', icon: LayoutDashboard },
];

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'mine', label: 'Mis clientes' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'due', label: 'Vencen pronto' },
  { id: 'unassigned', label: 'Sin asignar' },
];

const CLIENTS = [
  {
    id: 1,
    name: 'Comercial Horizonte S.A.',
    ruc: '80012345-6',
    assignee: 'Ana',
    due: 12,
    presented: true,
    archived: false,
    urgency: 'soon',
    phone: '+595 981 000 101',
  },
  {
    id: 2,
    name: 'Servicios del Sur S.R.L.',
    ruc: '80143567-2',
    assignee: 'Miguel',
    due: 15,
    presented: false,
    archived: false,
    urgency: 'soon',
    phone: '+595 982 000 202',
  },
  {
    id: 3,
    name: 'Inversiones Arami E.A.S.',
    ruc: '80098765-1',
    assignee: 'Ana',
    due: 20,
    presented: true,
    archived: true,
    urgency: 'normal',
    phone: '+595 983 000 303',
  },
  {
    id: 4,
    name: 'Logística Central S.A.',
    ruc: '80111222-3',
    assignee: '',
    due: 18,
    presented: false,
    archived: false,
    urgency: 'normal',
    phone: '+595 984 000 404',
  },
  {
    id: 5,
    name: 'Estación Yvoty',
    ruc: '4556677-8',
    assignee: 'Lucía',
    due: 9,
    presented: false,
    archived: true,
    urgency: 'late',
    phone: '+595 985 000 505',
  },
  {
    id: 6,
    name: 'Tecnología Guaraní S.A.',
    ruc: '80055667-9',
    assignee: 'Ana',
    due: 25,
    presented: true,
    archived: false,
    urgency: 'normal',
    phone: '+595 986 000 606',
  },
];

const METRICS = {
  total: CLIENTS.length,
  pending: CLIENTS.filter((client) => !client.presented).length,
  presented: CLIENTS.filter((client) => client.presented).length,
  archived: CLIENTS.filter((client) => client.archived).length,
};

function LabToolbar({ variant, onVariant, device, onDevice, theme, onTheme, role, onRole }) {
  return (
    <header className="lab-toolbar">
      <div className="lab-toolbar-brand">
        <span className="lab-dot" />
        <div>
          <strong>UI LAB</strong>
          <span>Datos ficticios · la app real no cambia</span>
        </div>
      </div>

      <div className="lab-variant-tabs" aria-label="Propuestas visuales">
        {VARIANTS.map(({ id, short, name, icon: Icon }) => (
          <button
            type="button"
            className={variant === id ? 'is-active' : ''}
            key={id}
            onClick={() => onVariant(id)}
            title={name}
          >
            <Icon size={15} />
            <span className="lab-tab-short">{short}</span>
            <span className="lab-tab-name">{name}</span>
          </button>
        ))}
      </div>

      <div className="lab-tools">
        <label className="lab-select-wrap">
          <UserRound size={14} />
          <select value={role} onChange={(event) => onRole(event.target.value)}>
            <option value="USUARIO">Usuario</option>
            <option value="ADMINISTRADOR">Administrador</option>
          </select>
        </label>
        <div className="lab-segmented" aria-label="Tamaño de pantalla">
          <button
            type="button"
            className={device === 'mobile' ? 'is-active' : ''}
            onClick={() => onDevice('mobile')}
            title="Vista móvil"
          >
            <Smartphone size={15} />
          </button>
          <button
            type="button"
            className={device === 'desktop' ? 'is-active' : ''}
            onClick={() => onDevice('desktop')}
            title="Vista escritorio"
          >
            <Monitor size={15} />
          </button>
        </div>
        <button type="button" className="lab-icon-button" onClick={onTheme} title="Cambiar tema">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

function AppHeader({ role, variant }) {
  if (variant === 'compact') {
    return (
      <header className="preview-app-header compact-header">
        <div className="compact-wordmark">
          <span>MJ</span>
          <div><strong>CONTROL</strong><small>OPERACIONES</small></div>
        </div>
        <div className="compact-period"><CalendarDays size={14} /><span>08 / 2026</span></div>
        <div className="preview-header-actions">
          <span className="sync-status"><span /> DATOS AL DÍA</span>
          <button type="button" className="compact-user"><strong>AN</strong><span>Ana · {role === 'USUARIO' ? 'Usuario' : 'Admin'}</span></button>
        </div>
      </header>
    );
  }

  if (variant === 'dashboard') {
    return (
      <header className="preview-app-header dashboard-header">
        <div className="preview-brand">
          <img src="/logo-mj.png" alt="MJ Estudio Contable" />
          <div><strong>MJ Control</strong><span>Inteligencia operativa</span></div>
        </div>
        <nav className="dashboard-nav" aria-label="Navegación del panel">
          <button type="button" className="is-active">Resumen</button>
          <button type="button">Clientes</button>
          <button type="button">Equipo</button>
        </nav>
        <div className="preview-header-actions">
          <span className="dashboard-live"><span /> EN VIVO</span>
          <button type="button" className="dashboard-avatar">AN</button>
        </div>
      </header>
    );
  }

  return (
    <header className="preview-app-header flow-header">
      <div className="flow-greeting">
        <span>Domingo, 30 de agosto</span>
        <strong>Hola, Ana <span aria-hidden="true">👋</span></strong>
      </div>
      <div className="preview-header-actions">
        <span className="flow-role">{role === 'USUARIO' ? 'Mi espacio' : 'Administración'}</span>
        <button type="button" className="flow-avatar">A</button>
      </div>
    </header>
  );
}

function CompactSidebar({ role }) {
  return (
    <aside className="compact-sidebar">
      <span className="sidebar-label">GESTIÓN</span>
      <button type="button" className="is-active"><Building2 size={15} /><span>Clientes</span><small>06</small></button>
      <button type="button"><ClipboardCheck size={15} /><span>Pendientes</span><small>03</small></button>
      {role !== 'USUARIO' && <button type="button"><UserCheck size={15} /><span>Asignaciones</span></button>}
      <span className="sidebar-label">REGISTROS</span>
      <button type="button"><Archive size={15} /><span>Archivados</span></button>
      <button type="button"><CalendarDays size={15} /><span>Períodos</span></button>
      <div className="sidebar-shortcut"><span>ATAJO</span><strong>⌘ K</strong><small>Búsqueda global</small></div>
    </aside>
  );
}

function SearchAndFilters({ query, onQuery, activeFilter, onFilter }) {
  return (
    <div className="search-filter-block">
      <div className="preview-search">
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar cliente o RUC…"
          aria-label="Buscar cliente"
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} aria-label="Limpiar búsqueda">
            <X size={15} />
          </button>
        )}
        <button type="button" className="advanced-filter" title="Filtros avanzados">
          <Filter size={17} />
        </button>
      </div>
      <div className="quick-filters">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={activeFilter === filter.id ? 'is-active' : ''}
            onClick={() => onFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ type, active }) {
  const labels = {
    presented: active ? 'Presentado' : 'Pendiente',
    archived: active ? 'Archivado' : 'Sin archivar',
  };
  return (
    <span className={`status-pill ${active ? 'is-done' : 'is-pending'}`}>
      {active ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
      {labels[type]}
    </span>
  );
}

function StateIcon({ type, active }) {
  const isArchive = type === 'archived';
  const label = isArchive
    ? (active ? 'Archivado' : 'Sin archivar')
    : (active ? 'Presentado' : 'Presentación pendiente');

  return (
    <span
      className={`executive-state-icon ${active ? 'is-active' : 'is-inactive'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {isArchive ? <Archive size={15} /> : <ClipboardCheck size={15} />}
    </span>
  );
}

function DueBadge({ client }) {
  return (
    <span className={`due-badge is-${client.urgency}`}>
      {client.urgency === 'late' ? <AlertTriangle size={13} /> : <CalendarDays size={13} />}
      Día {client.due}
    </span>
  );
}

function Assignee({ name, locked = false }) {
  return (
    <span className={`assignee ${name ? '' : 'is-empty'}`}>
      <span className="assignee-avatar">{name ? name.charAt(0) : '?'}</span>
      {name || 'Sin asignar'}
      {locked && <LockKeyhole size={12} />}
    </span>
  );
}

function EmptyResults() {
  return (
    <div className="preview-empty">
      <Search size={25} />
      <strong>No encontramos clientes</strong>
      <span>Probá cambiando la búsqueda o los filtros.</span>
    </div>
  );
}

function CompactView({ clients, query, onQuery, activeFilter, onFilter, onOpen }) {
  return (
    <main className="preview-content compact-view">
      <section className="compact-title-row">
        <div>
          <span className="eyebrow">REGISTRO MAESTRO / 08-2026</span>
          <h1>Cartera de clientes</h1>
        </div>
        <div className="compact-kpis">
          <span><strong>{METRICS.total}</strong> TOTAL</span>
          <span className="warn"><strong>{METRICS.pending}</strong> ABIERTOS</span>
          <span className="ok"><strong>{METRICS.presented}</strong> LISTOS</span>
        </div>
      </section>

      <SearchAndFilters
        query={query}
        onQuery={onQuery}
        activeFilter={activeFilter}
        onFilter={onFilter}
      />

      {clients.length ? (
        <section className="compact-client-list">
          <div className="compact-list-head">
            <span>Cliente</span><span>Estado</span><span>Encargado</span><span>Vence</span><span />
          </div>
          {clients.map((client) => (
            <button type="button" className="compact-client-row" key={client.id} onClick={() => onOpen(client)}>
              <span className="client-identity">
                <span className="client-monogram">{client.name.charAt(0)}</span>
                <span><strong>{client.name}</strong><small>RUC {client.ruc}</small></span>
              </span>
              <span className="compact-statuses">
                <StatusPill type="presented" active={client.presented} />
                <StatusPill type="archived" active={client.archived} />
              </span>
              <Assignee name={client.assignee} />
              <DueBadge client={client} />
              <ChevronRight className="row-chevron" size={17} />
            </button>
          ))}
        </section>
      ) : <EmptyResults />}
    </main>
  );
}

function MetricCard({ icon: Icon, value, label, tone }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span className="metric-icon"><Icon size={18} /></span>
      <span><strong>{value}</strong><small>{label}</small></span>
    </article>
  );
}

function DashboardView({ clients, query, onQuery, activeFilter, onFilter, onOpen }) {
  const completion = Math.round((METRICS.presented / METRICS.total) * 100);
  return (
    <main className="preview-content dashboard-view">
      <section className="dashboard-greeting">
        <div className="dashboard-hero-copy">
          <span className="eyebrow"><Sparkles size={13} /> Pulso del negocio</span>
          <h1>Tu operación,<br />bajo control.</h1>
          <p>Agosto avanza al ritmo esperado. Hay {METRICS.pending} acciones que requieren seguimiento.</p>
          <button type="button" className="primary-action"><ClipboardCheck size={17} /> Revisar prioridades</button>
        </div>
        <div className="dashboard-hero-signal">
          <span>RITMO MENSUAL</span>
          <strong>+18<small>%</small></strong>
          <div className="signal-bars" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <small>vs. período anterior</small>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="progress-card">
          <div className="progress-copy">
            <span>Progreso de agosto</span>
            <strong>{completion}%</strong>
            <small>{METRICS.presented} de {METRICS.total} presentados</small>
          </div>
          <div className="progress-ring" style={{ '--progress': `${completion * 3.6}deg` }}>
            <span>{completion}%</span>
          </div>
        </article>
        <div className="dashboard-metrics">
          <MetricCard icon={Users} value={METRICS.total} label="Clientes" tone="blue" />
          <MetricCard icon={Clock3} value={METRICS.pending} label="Pendientes" tone="amber" />
          <MetricCard icon={CheckCircle2} value={METRICS.presented} label="Presentados" tone="green" />
          <MetricCard icon={Archive} value={METRICS.archived} label="Archivados" tone="violet" />
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <article className="attention-card">
          <div className="section-heading">
            <div><span className="eyebrow">Prioridad</span><h2>Requieren atención</h2></div>
            <span className="count-badge">3</span>
          </div>
          {CLIENTS.filter((client) => !client.presented).slice(0, 3).map((client) => (
            <button type="button" className="attention-row" key={client.id} onClick={() => onOpen(client)}>
              <span className={`attention-indicator is-${client.urgency}`} />
              <span><strong>{client.name}</strong><small>RUC {client.ruc}</small></span>
              <DueBadge client={client} />
              <ChevronRight size={16} />
            </button>
          ))}
        </article>

        <article className="workload-card">
          <div className="section-heading"><div><span className="eyebrow">Equipo</span><h2>Carga asignada</h2></div></div>
          {[
            ['Ana', 3, 50],
            ['Miguel', 1, 17],
            ['Lucía', 1, 17],
            ['Sin asignar', 1, 17],
          ].map(([name, value, width]) => (
            <div className="workload-row" key={name}>
              <span>{name}</span><div><i style={{ width: `${width}%` }} /></div><strong>{value}</strong>
            </div>
          ))}
        </article>
      </section>

      <section className="executive-clients">
        <div className="executive-section-head">
          <div>
            <span className="eyebrow">Cartera activa</span>
            <h2>Todos los clientes</h2>
            <p>Consultá estados, responsables y vencimientos sin salir del panel.</p>
          </div>
          <span className="executive-result-count"><strong>{clients.length}</strong> de {METRICS.total}</span>
        </div>

        <SearchAndFilters
          query={query}
          onQuery={onQuery}
          activeFilter={activeFilter}
          onFilter={onFilter}
        />

        {clients.length ? (
          <div className="executive-client-table">
            <div className="executive-table-head">
              <span>N.º</span><span>Cliente</span><span>Encargado</span><span>Vence</span><span>Estados</span><span />
            </div>
            {clients.map((client, index) => (
              <button type="button" className="executive-client-row" key={client.id} onClick={() => onOpen(client)}>
                <span className="executive-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="client-identity">
                  <span className="client-monogram">{client.name.charAt(0)}</span>
                  <span><strong>{client.name}</strong><small>RUC {client.ruc}</small></span>
                </span>
                <Assignee name={client.assignee} />
                <DueBadge client={client} />
                <span className="executive-state-icons">
                  <StateIcon type="presented" active={client.presented} />
                  <StateIcon type="archived" active={client.archived} />
                </span>
                <ChevronRight className="row-chevron" size={16} />
              </button>
            ))}
          </div>
        ) : <EmptyResults />}
      </section>
    </main>
  );
}

function BalancedClientCard({ client, role, onOpen }) {
  return (
    <article className="balanced-client-card">
      <button type="button" className="card-main-action" onClick={() => onOpen(client)}>
        <div className="balanced-card-top">
          <span className="client-monogram">{client.name.charAt(0)}</span>
          <span className="balanced-identity"><strong>{client.name}</strong><small>RUC {client.ruc}</small></span>
          <DueBadge client={client} />
        </div>
        <div className="balanced-card-status">
          <StatusPill type="presented" active={client.presented} />
          <StatusPill type="archived" active={client.archived} />
        </div>
      </button>
      <div className="balanced-card-footer">
        <Assignee name={client.assignee} locked={role === 'USUARIO'} />
        <button type="button" onClick={() => onOpen(client)}>Ver ficha <ChevronRight size={14} /></button>
      </div>
    </article>
  );
}

function BalancedView({ clients, query, onQuery, activeFilter, onFilter, role, onOpen }) {
  return (
    <>
      <main className="preview-content balanced-view">
        <section className="balanced-heading">
          <div>
            <span className="eyebrow">Tu jornada</span>
            <h1>¿Qué hacemos hoy?</h1>
            <p>Primero, resolvamos los clientes que están más cerca del vencimiento.</p>
          </div>
          <button type="button" className="secondary-action"><CalendarDays size={16} /> Agosto</button>
        </section>

        <section className="flow-progress-card">
          <div className="flow-progress-copy">
            <span><Sparkles size={14} /> Progreso del mes</span>
            <strong>{METRICS.presented} de {METRICS.total} clientes listos</strong>
            <div><i style={{ width: `${(METRICS.presented / METRICS.total) * 100}%` }} /></div>
          </div>
          <span className="flow-progress-number">50<small>%</small></span>
        </section>

        <div className="flow-stat-chips">
          <span><i className="is-amber" />{METRICS.pending} para presentar</span>
          <span><i className="is-violet" />{METRICS.archived} archivados</span>
          <span><i className="is-green" />Todo sincronizado</span>
        </div>

        <SearchAndFilters
          query={query}
          onQuery={onQuery}
          activeFilter={activeFilter}
          onFilter={onFilter}
        />

        <div className="result-heading">
          <span><strong>{clients.length}</strong> clientes encontrados</span>
          <button type="button"><ListFilter size={15} /> Ordenar</button>
        </div>

        {clients.length ? (
          <section className="balanced-client-grid">
            {clients.map((client) => (
              <BalancedClientCard client={client} role={role} onOpen={onOpen} key={client.id} />
            ))}
          </section>
        ) : <EmptyResults />}
      </main>
      <nav className="mobile-bottom-nav">
        <button type="button" className="is-active"><Building2 size={19} /><span>Clientes</span></button>
        {role !== 'USUARIO' && <button type="button"><UserCheck size={19} /><span>Asignar</span></button>}
        <button type="button"><Search size={19} /><span>Buscar</span></button>
        <button type="button"><MoreHorizontal size={19} /><span>Más</span></button>
      </nav>
    </>
  );
}

function DetailView({ client, role, variant, onBack }) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyFakeSecret = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className={`preview-content detail-view detail-${variant}`}>
      <button type="button" className="detail-back" onClick={onBack}><ArrowLeft size={16} /> Volver a clientes</button>

      <section className="detail-hero">
        <div className="detail-title-block">
          <span className="detail-monogram">{client.name.charAt(0)}</span>
          <div><span className="eyebrow">Ficha del cliente</span><h1>{client.name}</h1><p>RUC {client.ruc}</p></div>
        </div>
        <div className="detail-hero-status"><DueBadge client={client} /><span className="sync-status"><span /> Sincronizado</span></div>
      </section>

      <section className="detail-quick-status">
        <button type="button" className={client.presented ? 'is-active' : ''}>
          <span><ClipboardCheck size={19} /></span><span><strong>Presentado</strong><small>{client.presented ? 'Completado' : 'Pendiente'}</small></span><Check size={16} />
        </button>
        <button type="button" className={client.archived ? 'is-active' : ''}>
          <span><Archive size={19} /></span><span><strong>Archivado</strong><small>{client.archived ? 'Completado' : 'Pendiente'}</small></span><Check size={16} />
        </button>
      </section>

      <section className="detail-section-grid">
        <article className="detail-section">
          <div className="section-heading"><div><span className="eyebrow">Datos generales</span><h2>Información principal</h2></div></div>
          <div className="detail-fields">
            <label><span>Razón social</span><input value={client.name} readOnly /></label>
            <label><span>RUC</span><input value={client.ruc} readOnly /></label>
            <label><span>Teléfono</span><input value={client.phone} readOnly /></label>
            <label><span>Vencimiento</span><input value={`Día ${client.due}`} readOnly /></label>
          </div>
        </article>

        <article className="detail-section">
          <div className="section-heading"><div><span className="eyebrow">Responsabilidad</span><h2>Asignación</h2></div>{role === 'USUARIO' && <LockKeyhole size={16} />}</div>
          {role === 'USUARIO' ? (
            <div className="readonly-assignment"><Assignee name={client.assignee} locked /><small>Solo administradores pueden modificarlo.</small></div>
          ) : (
            <label className="detail-select-label"><span>Encargado</span><select defaultValue={client.assignee}><option>Ana</option><option>Miguel</option><option>Lucía</option><option value="">Sin asignar</option></select></label>
          )}
        </article>

        <article className="detail-section sensitive-section">
          <div className="section-heading"><div><span className="eyebrow">Acceso sensible</span><h2>Credenciales</h2></div><LockKeyhole size={16} /></div>
          <div className="secret-field">
            <div><span>Clave MH</span><strong>{secretVisible ? 'DEMO-4826' : '••••••••••'}</strong></div>
            <button type="button" onClick={() => setSecretVisible((value) => !value)}>{secretVisible ? <EyeOff size={17} /> : <Eye size={17} />}<span>{secretVisible ? 'Ocultar' : 'Mostrar'}</span></button>
            <button type="button" onClick={copyFakeSecret}>{copied ? <Check size={17} /> : <Copy size={17} />}<span>{copied ? 'Copiada' : 'Copiar'}</span></button>
          </div>
          <p className="sensitive-note">Este valor es ficticio y se oculta por defecto en el prototipo.</p>
        </article>
      </section>
    </main>
  );
}

export default function UiPreview() {
  const [variant, setVariant] = useState('dashboard');
  const [device, setDevice] = useState('mobile');
  const [theme, setTheme] = useState('light');
  const [role, setRole] = useState('USUARIO');
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState(null);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return CLIENTS.filter((client) => {
      const matchesQuery = !normalized || `${client.name} ${client.ruc}`.toLocaleLowerCase('es').includes(normalized);
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'mine' && client.assignee === 'Ana') ||
        (activeFilter === 'pending' && !client.presented) ||
        (activeFilter === 'due' && (client.urgency === 'soon' || client.urgency === 'late')) ||
        (activeFilter === 'unassigned' && !client.assignee);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

  const openClient = (client) => setSelectedClient(client);
  const selectVariant = (nextVariant) => {
    setVariant(nextVariant);
    setSelectedClient(null);
  };

  return (
    <div className={`ui-lab-root theme-${theme}`}>
      <LabToolbar
        variant={variant}
        onVariant={selectVariant}
        device={device}
        onDevice={setDevice}
        theme={theme}
        onTheme={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}
        role={role}
        onRole={setRole}
      />

      <div className="lab-stage">
        <div className={`device-frame is-${device}`}>
          <div className={`preview-app visual-${variant}`}>
            <AppHeader role={role} variant={variant} />
            <div className={variant === 'compact' ? 'compact-shell' : undefined}>
              {variant === 'compact' && <CompactSidebar role={role} />}
              {selectedClient ? (
                <DetailView client={selectedClient} role={role} variant={variant} onBack={() => setSelectedClient(null)} />
              ) : variant === 'compact' ? (
                <CompactView
                  clients={filteredClients}
                  query={query}
                  onQuery={setQuery}
                  activeFilter={activeFilter}
                  onFilter={setActiveFilter}
                  onOpen={openClient}
                />
              ) : variant === 'dashboard' ? (
                <DashboardView
                  clients={filteredClients}
                  query={query}
                  onQuery={setQuery}
                  activeFilter={activeFilter}
                  onFilter={setActiveFilter}
                  onOpen={openClient}
                />
              ) : (
                <BalancedView
                  clients={filteredClients}
                  query={query}
                  onQuery={setQuery}
                  activeFilter={activeFilter}
                  onFilter={setActiveFilter}
                  role={role}
                  onOpen={openClient}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="lab-note">
        <Sparkles size={14} />
        <span>Elegí una propuesta y abrí cualquier cliente para comparar el detalle renovado.</span>
      </aside>
    </div>
  );
}
