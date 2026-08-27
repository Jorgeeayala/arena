import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import NamePicker from './screens/NamePicker';
import YearPicker from './screens/YearPicker';
import MonthPicker from './screens/MonthPicker';
import ClientList from './screens/ClientList';
import ClientDetail from './screens/ClientDetail';
import NewClient from './screens/NewClient';
import AssignClients from './screens/AssignClients';
import AppSplashLoader from './components/AppSplashLoader';
import { ClientsProvider, useClients } from './context/ClientsContext';
import { STORAGE_KEY_USER } from './config';
import { formatPeriodLabel } from './utils';
import { api } from './api';
import { Calendar, User, Sun, Moon, Menu, X, UserCog } from 'lucide-react';
import './styles.css';

const pageVariants = {
  initial: { opacity: 0, y: 22, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 28 },
  },
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.97,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem(STORAGE_KEY_USER));
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creatingWithHeaders, setCreatingWithHeaders] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assignClientsOpen, setAssignClientsOpen] = useState(false);

  // Rol del usuario actual (SUPERUSUARIO / ADMINISTRADOR / USUARIO), para
  // saber si mostrar la sección "Asignar clientes" del menú. Por ahora
  // Super y Admin tienen los mismos permisos -- el día que se quieran
  // diferenciar, es un solo chequeo acá abajo.
  const [userRole, setUserRole] = useState(null);
  const canAssignClients = userRole === 'SUPERUSUARIO' || userRole === 'ADMINISTRADOR';

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    let cancelled = false;
    api.listUsersWithRoles()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((u) => u.name === user);
        setUserRole(match ? match.role : 'USUARIO');
      })
      .catch(() => {
        if (!cancelled) setUserRole('USUARIO');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);

    // Mantiene los íconos de la barra de estado (hora, batería, señal)
    // legibles según el tema: claros sobre el fondo oscuro de la app,
    // oscuros sobre el fondo claro. Solo aplica en la app nativa (no
    // hace nada en el navegador/PWA web).
    // Mantiene los íconos de las barras del sistema (hora/batería arriba,
    // gestos abajo) legibles según el tema. Desde Capacitor 8.3+ esto se
    // hace con el SystemBars nativo (no el plugin @capacitor/status-bar
    // viejo, que en Android 16 quedó sin efecto porque el sistema fuerza
    // el modo "edge-to-edge" y ya no deja pintar un color de fondo fijo).
    if (Capacitor.isNativePlatform()) {
      SystemBars.setStyle({
        style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      }).catch(() => {});
    }
  }, [theme]);

  // Botón / gesto "atrás" del sistema en Android: en vez de cerrar la app
  // de una, navega hacia atrás DENTRO de la app, con la misma prioridad
  // que ya usan los botones "volver" de cada pantalla. Si no hay nada más
  // atrás (estamos en la pantalla de elegir año, la primera pantalla real
  // después de elegir usuario), ahí sí cierra la app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (assignClientsOpen) {
        setAssignClientsOpen(false);
      } else if (creatingWithHeaders) {
        setCreatingWithHeaders(null);
      } else if (selectedClient) {
        setSelectedClient(null);
      } else if (month) {
        setMonth(null);
      } else if (year) {
        setYear(null);
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [assignClientsOpen, creatingWithHeaders, selectedClient, month, year]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Cierra el menú hamburguesa (mobile) cada vez que cambia de pantalla,
  // para que no quede abierto tapando la siguiente vista.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [year, month, selectedClient, creatingWithHeaders, assignClientsOpen]);

  function handlePickUser(chosenUser) {
    setUser(chosenUser);
  }

  // Navbar for authenticated screens
  const renderNavbar = () => {
    return (
      <>
      <header className="app-navbar">
        <div className="navbar-content">
          <motion.div
            className="brand-badge hide-mobile"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="brand-icon-wrapper">
              <img src="/logo-mj.png" alt="" className="brand-logo-img" />
            </div>
            <span>Control Clientes</span>
          </motion.div>

          <div className="nav-pills">
            {/* Menú hamburguesa: solo visible en mobile (ver CSS), va
                primero para quedar pegado a la izquierda del todo. Por
                ahora solo tiene el toggle de tema; a futuro va a sumar
                configuración y otras funciones. */}
            {user && (
              <div className="mobile-nav-left">
                <img src="/logo-mj.png" alt="MJ Estudio Contable" className="mobile-nav-logo" />
                <motion.button
                  className="mobile-menu-btn"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setMobileMenuOpen(true)}
                  title="Menú"
                  aria-label="Abrir menú"
                >
                  <Menu size={18} />
                </motion.button>
              </div>
            )}

            {user && year && month && (
              <motion.button
                className="pill-btn active period-pill"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedClient(null);
                  setCreatingWithHeaders(null);
                  setAssignClientsOpen(false);
                  setMonth(null);
                }}
                title="Cambiar mes o año"
              >
                <Calendar size={14} />
                <span>{formatPeriodLabel(month, year)}</span>
              </motion.button>
            )}

            {/* Toggle de tema: en mobile se oculta (.hide-mobile) porque
                vive adentro del menú hamburguesa de la izquierda. */}
            <motion.button
              className="theme-toggle-btn hide-mobile"
              whileHover={{ scale: 1.08, rotate: 12 }}
              whileTap={{ scale: 0.9, rotate: -20 }}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={theme}
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>

            {/* Acceso directo en desktop (ahí no hay drawer -- el
                hamburguesa es mobile-only). En mobile esta misma función
                vive adentro del drawer, así que acá se oculta con
                .hide-mobile para no duplicarla. */}
            {canAssignClients && year && month && (
              <motion.button
                className="pill-btn hide-mobile"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedClient(null);
                  setCreatingWithHeaders(null);
                  setAssignClientsOpen(true);
                }}
                title="Asignar clientes"
              >
                <UserCog size={14} />
                <span>Asignar</span>
              </motion.button>
            )}

            {/* Píldora de usuario: visible siempre, en desktop y mobile,
                pegada a la derecha del todo. */}
            {user && (
              <motion.button
                className="pill-btn"
                title={`Usuario actual: ${user} (Haz clic para cambiar de usuario)`}
                onClick={() => {
                  setUser(null);
                  localStorage.removeItem(STORAGE_KEY_USER);
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                style={{ cursor: 'pointer', gap: '6px' }}
              >
                <div className="avatar-badge" style={{ display: 'flex', alignItems: 'center' }}>
                  <User size={14} />
                </div>
                <span className="nav-user-name" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {user}
                </span>
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Drawer del menú hamburguesa (solo mobile): se desliza desde la
          izquierda hacia la derecha. Por ahora solo trae el toggle de
          tema; queda con lugar para sumar "Configuración" y otras
          opciones más adelante sin tener que rehacer la estructura.
          IMPORTANTE: esto va A PROPÓSITO fuera del <header>, como
          hermano y no como hijo. El navbar tiene backdrop-filter (efecto
          vidrio esmerilado), y backdrop-filter/filter/transform en un
          ancestro hace que los descendientes con position:fixed dejen de
          posicionarse respecto a toda la pantalla y pasen a posicionarse
          respecto a ese ancestro -- por eso antes el drawer y el fondo
          oscuro quedaban atrapados en la franja del navbar en vez de
          cubrir la pantalla completa. */}
      <AnimatePresence>
        {mobileMenuOpen && user && (
          <>
            <motion.div
              className="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="mobile-drawer-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="mobile-drawer-header">
                <span className="mobile-drawer-title">
                  <img src="/logo-mj.png" alt="" className="mobile-drawer-logo" />
                  Menú
                </span>
                <button
                  type="button"
                  className="mobile-drawer-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                type="button"
                className="mobile-menu-item"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>

              {canAssignClients && year && month && (
                <button
                  type="button"
                  className="mobile-menu-item"
                  onClick={() => {
                    setSelectedClient(null);
                    setCreatingWithHeaders(null);
                    setAssignClientsOpen(true);
                  }}
                >
                  <UserCog size={17} />
                  <span>Asignar clientes</span>
                </button>
              )}

              {/* Próximamente: Configuración, Equipo, etc. */}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
    );
  };

  // Las pantallas del período (lista, asignar, detalle, nuevo cliente)
  // viven DENTRO del <ClientsProvider>: comparten un único estado de la
  // planilla, así lo que se cambia en una se refleja en las otras sin
  // recargar. Ese estado se lee con un hook, por eso el render se delega
  // al componente <PeriodScreens> de más abajo.
  return (
    <div className="app-container">
      <AppSplashLoader logoSrc="/logo-mj.png" minDurationMs={2400} />
      {renderNavbar()}
      <ClientsProvider user={user} year={year} month={month}>
        <PeriodScreens
          user={user}
          year={year}
          month={month}
          onPickUser={handlePickUser}
          onPickYear={setYear}
          onPickMonth={setMonth}
          onChangeYear={() => setYear(null)}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onBackFromDetail={() => setSelectedClient(null)}
          creatingWithHeaders={creatingWithHeaders}
          onNewClient={setCreatingWithHeaders}
          onCancelNewClient={() => setCreatingWithHeaders(null)}
          assignClientsOpen={assignClientsOpen}
          onBackFromAssign={() => setAssignClientsOpen(false)}
        />
      </ClientsProvider>
    </div>
  );
}

// Pantallas del período elegido. Vive dentro del <ClientsProvider> para
// poder usar el contexto compartido: los datos de la planilla, el equipo
// y los filtros son los mismos para la lista y para "Asignar clientes".
function PeriodScreens({
  user,
  year,
  month,
  onPickUser,
  onPickYear,
  onPickMonth,
  onChangeYear,
  selectedClient,
  onSelectClient,
  onBackFromDetail,
  creatingWithHeaders,
  onNewClient,
  onCancelNewClient,
  assignClientsOpen,
  onBackFromAssign,
}) {
  const { reload } = useClients();

  const getScreenContent = () => {
    if (!user) {
      return (
        <motion.div key="name-picker" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <NamePicker onPick={onPickUser} />
        </motion.div>
      );
    }

    if (!year) {
      return (
        <motion.div key="year-picker" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <YearPicker onPick={onPickYear} user={user} />
        </motion.div>
      );
    }

    if (!month) {
      return (
        <motion.div key={`month-picker-${year}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <MonthPicker year={year} onPick={onPickMonth} onChangeYear={onChangeYear} />
        </motion.div>
      );
    }

    if (assignClientsOpen) {
      return (
        <motion.div key={`assign-clients-${year}-${month}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <AssignClients onBack={onBackFromAssign} />
        </motion.div>
      );
    }

    if (creatingWithHeaders) {
      return (
        <motion.div key={`new-client-${year}-${month}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <NewClient
            user={user}
            year={year}
            month={month}
            headers={creatingWithHeaders}
            onCancel={onCancelNewClient}
            onCreated={() => {
              onCancelNewClient();
              // El cliente nuevo entra al estado compartido: la lista y
              // "Asignar clientes" lo ven sin necesidad de recargar a mano.
              reload(true);
            }}
          />
        </motion.div>
      );
    }

    if (selectedClient) {
      return (
        <motion.div
          key={`client-detail-${selectedClient._row}-${year}-${month}`}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <ClientDetail
            user={user}
            year={year}
            month={month}
            client={selectedClient}
            onBack={onBackFromDetail}
          />
        </motion.div>
      );
    }

    return (
      <motion.div key={`client-list-${year}-${month}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <ClientList onSelect={onSelectClient} onNewClient={onNewClient} />
      </motion.div>
    );
  };

  // mode="popLayout" en vez de "wait": con "wait", la pantalla que
  // salía tenía que desmontarse del todo (y ClientDetail terminar su
  // carga inicial) ANTES de que la nueva empezara a aparecer -- ese
  // hueco se sentía como un microcorte al entrar/salir de un
  // cliente. Con "popLayout" ambas se animan superpuestas (la que
  // sale se saca del flujo normal así no empuja el layout), sin
  // instante en blanco en el medio.
  return <AnimatePresence mode="popLayout">{getScreenContent()}</AnimatePresence>;
}
