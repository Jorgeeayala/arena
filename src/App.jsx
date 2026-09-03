import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import NamePicker from './screens/NamePicker';
import PinLogin from './screens/PinLogin';
import PinSetup from './screens/PinSetup';
import YearPicker from './screens/YearPicker';
import MonthPicker from './screens/MonthPicker';
import ClientDetail from './screens/ClientDetail';
import NewClient from './screens/NewClient';
import AssignClients from './screens/AssignClients';
import AppSplashLoader from './components/AppSplashLoader';
import ScreenErrorBoundary from './components/ScreenErrorBoundary';
import SettingsDialog from './components/SettingsDialog';
import { ClientsProvider, useClients } from './context/ClientsContext';
import { STORAGE_KEY_USER } from './config';
import { formatPeriodLabel } from './utils';
import { api } from './api';
import { Calendar, User, Menu, X, UserCog, RefreshCw, Settings } from 'lucide-react';
import './styles.css';

const INITIAL_AUTH_STATE = {
  status: 'anonymous',
  session: null,
  error: '',
  errorCode: '',
  attemptsRemaining: undefined,
  lockedUntil: 0,
};

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

function authStateFromError(error, defaultMessage = 'No se pudo validar el acceso') {
  const code = error?.code || 'AUTH_ERROR';
  const requiresInitialPin = code === 'PIN_SETUP_REQUIRED';
  return {
    status: requiresInitialPin ? 'setup-pin' : 'needs-pin',
    session: null,
    error: code === 'PIN_REQUIRED' || requiresInitialPin
      ? ''
      : (error?.message || defaultMessage),
    errorCode: code,
    attemptsRemaining: Number.isInteger(error?.attemptsRemaining)
      ? error.attemptsRemaining
      : undefined,
    lockedUntil: Number(error?.lockedUntil || 0),
  };
}

function pinSetupStateFromError(error) {
  const code = error?.code || 'PIN_SETUP_ERROR';
  return {
    status: code === 'PIN_ALREADY_CONFIGURED' ? 'needs-pin' : 'setup-pin',
    session: null,
    error: error?.message || 'No se pudo configurar el PIN',
    errorCode: code,
    attemptsRemaining: undefined,
    lockedUntil: 0,
  };
}

export default function App({
  readOnlyPreview = false,
  uiMode = 'classic',
  periodOverviewComponent: PeriodOverviewComponent = null,
}) {
  const [user, setUser] = useState(() => localStorage.getItem(STORAGE_KEY_USER));
  const [year, setYear] = useState(null);
  const [month, setMonth] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creatingWithHeaders, setCreatingWithHeaders] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assignClientsOpen, setAssignClientsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSubmitting, setPinChangeSubmitting] = useState(false);
  const [pinChangeNotice, setPinChangeNotice] = useState('');
  const [initialScreenReady, setInitialScreenReady] = useState(false);
  const markInitialScreenReady = useCallback(() => setInitialScreenReady(true), []);

  const [authState, setAuthState] = useState(() => ({
    status: user ? 'checking' : 'anonymous',
    session: null,
    error: '',
    errorCode: '',
    attemptsRemaining: undefined,
    lockedUntil: 0,
  }));
  const [authGeneration, setAuthGeneration] = useState(0);
  const authAttemptRef = useRef(0);
  const periodOverviewRef = useRef(null);
  const authenticated = authState.status === 'authenticated';
  const userRole = authenticated ? authState.session?.user?.role : null;
  const activeSessionToken = authState.session?.token || '';
  const activeSessionExpiresAt = Number(authState.session?.expiresAt || 0);
  const activeSessionIdleMs = Number(authState.session?.idleTimeoutMs || 0);
  const canAssignClients =
    !readOnlyPreview && (userRole === 'SUPERUSUARIO' || userRole === 'ADMINISTRADOR');
  const authReady = !user || authState.status !== 'checking';
  const initialContentReady = initialScreenReady && authReady;

  const resetPrivateNavigation = useCallback(() => {
    setYear(null);
    setMonth(null);
    setSelectedClient(null);
    setCreatingWithHeaders(null);
    setAssignClientsOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const restartAuthentication = useCallback(() => {
    api.clearSession();
    resetPrivateNavigation();
    setAuthState((previous) => ({
      ...previous,
      status: 'checking',
      session: null,
      error: '',
      errorCode: '',
      attemptsRemaining: undefined,
      lockedUntil: 0,
    }));
    setAuthGeneration((value) => value + 1);
  }, [resetPrivateNavigation]);

  // Primero intenta recuperar una sesión todavía válida. Si no existe, envía
  // un login sin PIN: el backend lo acepta únicamente para una cuenta sin hash
  // cuando ALLOW_PINLESS_LOGIN=true; una cuenta con PIN responde PIN_REQUIRED.
  useEffect(() => {
    if (!user) {
      api.clearSession();
      return;
    }

    const attemptId = ++authAttemptRef.current;
    let cancelled = false;

    const applySession = (session) => {
      if (cancelled || authAttemptRef.current !== attemptId) return;
      setAuthState({
        status: 'authenticated',
        session,
        error: '',
        errorCode: '',
        attemptsRemaining: undefined,
        lockedUntil: 0,
      });
    };

    async function authenticate() {
      setAuthState({
        status: 'checking',
        session: null,
        error: '',
        errorCode: '',
        attemptsRemaining: undefined,
        lockedUntil: 0,
      });

      const stored = api.getStoredSession();
      if (stored?.user?.name === user) {
        try {
          applySession(await api.validateSession({ notifyOnFailure: false }));
          return;
        } catch {
          // La sesión vencida se elimina en silencio y luego se intenta login.
        }
      } else if (stored) {
        api.clearSession();
      }

      try {
        applySession(await api.login(user, ''));
      } catch (error) {
        if (!cancelled && authAttemptRef.current === attemptId) {
          setAuthState(authStateFromError(error));
        }
      }
    }

    authenticate();
    return () => {
      cancelled = true;
    };
  }, [user, authGeneration]);

  // Cualquier rechazo de sesión durante una lectura o escritura vuelve a
  // ejecutar el flujo de acceso. Un usuario sin PIN en modo testing entra de
  // nuevo automáticamente; uno con PIN vuelve a la pantalla protegida.
  useEffect(() => api.onAuthFailure(restartAuthentication), [restartAuthentication]);

  // Mantiene sincronizada la inactividad visible con Apps Script. Mientras la
  // persona usa la app se valida la sesión periódicamente; al dejarla abierta
  // sin actividad se limpia inmediatamente el contenido privado en memoria.
  useEffect(() => {
    if (!authenticated || !activeSessionToken) return undefined;

    const idleTimeoutMs = Math.max(activeSessionIdleMs, 60_000);
    const heartbeatIntervalMs = Math.min(10 * 60_000, Math.max(60_000, idleTimeoutMs / 3));
    let lastActivityAt = Date.now();
    let lastServerCheckAt = Date.now();
    let idleTimer;
    let checkingServer = false;
    let stopped = false;

    const expireLocally = () => {
      if (stopped) return;
      restartAuthentication();
    };

    const scheduleIdleCheck = () => {
      clearTimeout(idleTimer);
      const remaining = idleTimeoutMs - (Date.now() - lastActivityAt);
      if (remaining <= 0) {
        expireLocally();
        return;
      }
      idleTimer = setTimeout(expireLocally, remaining);
    };

    const checkServerSession = async () => {
      if (checkingServer || stopped) return;
      checkingServer = true;
      lastServerCheckAt = Date.now();
      try {
        const refreshed = await api.validateSession();
        if (!stopped) {
          setAuthState((previous) =>
            previous.status === 'authenticated'
              ? { ...previous, session: refreshed }
              : previous
          );
        }
      } catch {
        // api.js notifica el rechazo y restartAuthentication hace la limpieza.
      } finally {
        checkingServer = false;
      }
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityAt >= idleTimeoutMs) {
        expireLocally();
        return;
      }
      lastActivityAt = now;
      scheduleIdleCheck();
      if (now - lastServerCheckAt >= heartbeatIntervalMs) checkServerSession();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') recordActivity();
    };

    ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleIdleCheck();

    const heartbeat = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastActivityAt < idleTimeoutMs
      ) {
        checkServerSession();
      }
    }, heartbeatIntervalMs);

    const maxRemaining = activeSessionExpiresAt - Date.now();
    const maximumTimer = maxRemaining > 0
      ? setTimeout(expireLocally, maxRemaining)
      : setTimeout(expireLocally, 0);

    return () => {
      stopped = true;
      clearTimeout(idleTimer);
      clearTimeout(maximumTimer);
      clearInterval(heartbeat);
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    authenticated,
    activeSessionToken,
    activeSessionExpiresAt,
    activeSessionIdleMs,
    restartAuthentication,
  ]);

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

  // Cierra el menú hamburguesa (mobile) cada vez que cambia de pantalla,
  // para que no quede abierto tapando la siguiente vista.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [year, month, selectedClient, creatingWithHeaders, assignClientsOpen]);

  // La confirmación de PIN actualizado desaparece sola para no acumular
  // avisos en pantalla.
  useEffect(() => {
    if (!pinChangeNotice) return undefined;
    const timer = setTimeout(() => setPinChangeNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [pinChangeNotice]);

  function handlePickUser(chosenUser) {
    localStorage.setItem(STORAGE_KEY_USER, chosenUser);
    setUser(chosenUser);
  }

  async function handlePinSubmit(pin) {
    const attemptId = ++authAttemptRef.current;
    setAuthState((previous) => ({
      ...previous,
      status: 'submitting',
      error: '',
      errorCode: '',
    }));

    try {
      const session = await api.login(user, pin);
      if (authAttemptRef.current !== attemptId) return;
      setAuthState({
        status: 'authenticated',
        session,
        error: '',
        errorCode: '',
        attemptsRemaining: undefined,
        lockedUntil: 0,
      });
    } catch (error) {
      if (authAttemptRef.current === attemptId) {
        setAuthState(authStateFromError(error));
      }
    }
  }

  async function handleInitialPinSetup(pin) {
    const attemptId = ++authAttemptRef.current;
    setAuthState((previous) => ({
      ...previous,
      status: 'setting-pin',
      error: '',
      errorCode: '',
    }));

    try {
      const session = await api.setupPin(user, pin);
      if (authAttemptRef.current !== attemptId) return;
      setAuthState({
        status: 'authenticated',
        session,
        error: '',
        errorCode: '',
        attemptsRemaining: undefined,
        lockedUntil: 0,
      });
    } catch (error) {
      if (authAttemptRef.current === attemptId) {
        setAuthState(pinSetupStateFromError(error));
      }
    }
  }

  async function handleChangeUser() {
    authAttemptRef.current += 1;
    setSettingsOpen(false);
    setPinChangeError('');
    try {
      await api.flushPendingSaves();
    } catch {
      // Si la sesión ya venció, la cola informa su propio error y se limpia.
    }
    try {
      await api.logout();
    } catch {
      api.clearSession();
    }

    resetPrivateNavigation();
    localStorage.removeItem(STORAGE_KEY_USER);
    setAuthState({ ...INITIAL_AUTH_STATE });
    setUser(null);
  }

  function openSettings() {
    setPinChangeError('');
    setSettingsOpen(true);
  }

  async function handleChangePin(currentPin, newPin) {
    if (pinChangeSubmitting) return;
    setPinChangeSubmitting(true);
    setPinChangeError('');

    try {
      const session = await api.changePin(currentPin, newPin);
      setAuthState((previous) => ({
        ...previous,
        status: 'authenticated',
        session,
        error: '',
        errorCode: '',
        attemptsRemaining: undefined,
        lockedUntil: 0,
      }));
      setSettingsOpen(false);
      setPinChangeNotice('PIN actualizado correctamente. Las sesiones anteriores de tu cuenta se cerraron.');
    } catch (error) {
      setPinChangeError(error?.message || 'No se pudo cambiar el PIN. Probá nuevamente.');
    } finally {
      setPinChangeSubmitting(false);
    }
  }

  // Navbar for authenticated screens
  const renderNavbar = () => {
    if (uiMode === 'executive') {
      return (
        <header className="real-exec-navbar">
          <div className="real-exec-navbar-brand">
            <img src="/logo-mj.png" alt="MJ Estudio Contable" />
            <div><strong>MJ Control</strong><span>Inteligencia operativa</span></div>
          </div>

          <div className="real-exec-navbar-actions">
            {year && month && !selectedClient && (
              <button
                type="button"
                className="real-exec-refresh-button"
                onClick={() => periodOverviewRef.current?.refresh()}
                title="Actualizar clientes y equipo"
              >
                <RefreshCw size={14} />
                <span>Actualizar</span>
              </button>
            )}
            {year && month && (
              <button
                type="button"
                className="real-exec-period-button"
                onClick={() => {
                  setSelectedClient(null);
                  setMonth(null);
                }}
                title="Cambiar período"
              >
                <Calendar size={14} />
                <span>{formatPeriodLabel(month, year)}</span>
              </button>
            )}
            {canAssignClients && year && month && !selectedClient && (
              <button type="button"
                className="real-exec-period-button real-exec-assign-button"
                onClick={() => { setSelectedClient(null);
                  setCreatingWithHeaders(null); setAssignClientsOpen(true); }}
                title="Asignar clientes">
                <UserCog size={14} />
                <span>Asignar</span>
              </button>
            )}
            <button
              type="button"
              className="real-exec-theme-button real-exec-settings-button"
              onClick={openSettings}
              title="Configuración"
              aria-label="Abrir configuración"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              className="real-exec-user-button"
              onClick={handleChangeUser}
              title="Cambiar de usuario"
            >
              <span>{String(user || '?').charAt(0).toUpperCase()}</span>
              <span><strong>{user}</strong><small>{userRole || 'Usuario'}</small></span>
            </button>
          </div>
        </header>
      );
    }

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

            {/* Configuración: acceso directo en desktop; en mobile vive
                dentro del drawer para no saturar la barra. */}
            {user && (
              <motion.button
                className="pill-btn settings-btn hide-mobile"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={openSettings}
                title="Configuración"
                aria-label="Abrir configuración"
              >
                <Settings size={14} />
              </motion.button>
            )}

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
                onClick={handleChangeUser}
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
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSettings();
                }}
              >
                <Settings size={17} />
                <span>Configuración</span>
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
    <div className={`app-container ${uiMode === 'executive' ? 'real-exec-app' : ''}`}>
      <AppSplashLoader
        logoSrc="/logo-mj.png"
        ready={initialContentReady}
        minDurationMs={600}
        maxDurationMs={3000}
      />
      {authenticated && renderNavbar()}
      {pinChangeNotice && (
        <div className="pin-change-notice" role="status">
          {pinChangeNotice}
        </div>
      )}
      {authenticated && authState.session?.pinless && (
        <div className="auth-test-banner" role="status">
          Modo de prueba: este usuario ingresó sin PIN
        </div>
      )}
      <ClientsProvider
        user={authenticated ? user : null}
        userRole={userRole}
        year={authenticated ? year : null}
        month={authenticated ? month : null}
      >
        <PeriodScreens
          user={user}
          authState={authState}
          readOnlyPreview={readOnlyPreview}
          PeriodOverviewComponent={PeriodOverviewComponent}
          periodOverviewRef={periodOverviewRef}
          canAssignClients={canAssignClients}
          onInitialContentReady={markInitialScreenReady}
          year={year}
          month={month}
          onPickUser={handlePickUser}
          onPinSubmit={handlePinSubmit}
          onPinSetup={handleInitialPinSetup}
          onChangeUser={handleChangeUser}
          onPickYear={setYear}
          onPickMonth={setMonth}
          onChangeYear={() => setYear(null)}
          onChangeMonth={() => setMonth(null)}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onBackFromDetail={() => setSelectedClient(null)}
          creatingWithHeaders={creatingWithHeaders}
          onNewClient={setCreatingWithHeaders}
          onCancelNewClient={() => setCreatingWithHeaders(null)}
          assignClientsOpen={canAssignClients && assignClientsOpen}
          onBackFromAssign={() => setAssignClientsOpen(false)}
        />
      </ClientsProvider>

      <SettingsDialog
        key={settingsOpen ? 'settings-open' : 'settings-closed'}
        open={settingsOpen}
        user={user}
        theme={theme}
        error={pinChangeError}
        submitting={pinChangeSubmitting}
        onClose={() => {
          if (!pinChangeSubmitting) setSettingsOpen(false);
        }}
        onChangePin={handleChangePin}
        onThemeChange={setTheme}
      />
    </div>
  );
}

// Pantallas del período elegido. Vive dentro del <ClientsProvider> para
// poder usar el contexto compartido: los datos de la planilla, el equipo
// y los filtros son los mismos para la lista y para "Asignar clientes".
function PeriodScreens({
  user,
  authState,
  readOnlyPreview,
  PeriodOverviewComponent,
  periodOverviewRef,
  canAssignClients,
  onInitialContentReady,
  year,
  month,
  onPickUser,
  onPinSubmit,
  onPinSetup,
  onChangeUser,
  onPickYear,
  onPickMonth,
  onChangeYear,
  onChangeMonth,
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
          <NamePicker onPick={onPickUser} onReady={onInitialContentReady} />
        </motion.div>
      );
    }

    if (authState.status === 'setup-pin' || authState.status === 'setting-pin') {
      return (
        <motion.div key={`pin-setup-${user}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <PinSetup
            user={user}
            status={authState.status}
            error={authState.error}
            errorCode={authState.errorCode}
            onSubmit={onPinSetup}
            onChangeUser={onChangeUser}
            onReady={onInitialContentReady}
          />
        </motion.div>
      );
    }

    if (authState.status !== 'authenticated') {
      return (
        <motion.div key={`pin-login-${user}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <PinLogin
            user={user}
            status={authState.status}
            error={authState.error}
            errorCode={authState.errorCode}
            attemptsRemaining={authState.attemptsRemaining}
            lockedUntil={authState.lockedUntil}
            onSubmit={onPinSubmit}
            onChangeUser={onChangeUser}
            onReady={onInitialContentReady}
          />
        </motion.div>
      );
    }

    if (!year) {
      return (
        <motion.div key="year-picker" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <YearPicker onPick={onPickYear} user={user} onReady={onInitialContentReady} />
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

    if (assignClientsOpen && canAssignClients) {
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
            year={year}
            month={month}
            canAssignClients={canAssignClients}
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
            canAssignClients={canAssignClients}
            readOnlyPreview={readOnlyPreview}
          />
        </motion.div>
      );
    }

    return (
      <motion.div key={`executive-overview-${year}-${month}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <PeriodOverviewComponent ref={periodOverviewRef}
          onSelect={onSelectClient} onNewClient={onNewClient} />
      </motion.div>
    );
  };

  const screenBoundaryKey = !user
    ? 'name-picker'
    : authState.status !== 'authenticated'
      ? `auth-${user}-${authState.status}`
      : !year
        ? `year-picker-${user}`
        : !month
          ? `month-picker-${year}`
          : assignClientsOpen && canAssignClients
            ? `assign-${year}-${month}`
            : creatingWithHeaders
              ? `new-client-${year}-${month}`
              : selectedClient
                ? `client-detail-${selectedClient._row}-${year}-${month}`
                : `executive-overview-${year}-${month}`;

  // Cada pantalla vuelve a una ruta segura diferente. Cambiar la key desmonta
  // el boundary que falló para que el error no sobreviva a la navegación.
  const handleScreenErrorBack = () => {
    if (!user) {
      window.location.reload();
    } else if (authState.status !== 'authenticated' || !year) {
      onChangeUser();
    } else if (!month) {
      onChangeYear();
    } else if (assignClientsOpen && canAssignClients) {
      onBackFromAssign();
    } else if (creatingWithHeaders) {
      onCancelNewClient();
    } else if (selectedClient) {
      onBackFromDetail();
    } else {
      onChangeMonth();
    }
  };

  // mode="popLayout" en vez de "wait": con "wait", la pantalla que
  // salía tenía que desmontarse del todo (y ClientDetail terminar su
  // carga inicial) ANTES de que la nueva empezara a aparecer -- ese
  // hueco se sentía como un microcorte al entrar/salir de un
  // cliente. Con "popLayout" ambas se animan superpuestas (la que
  // sale se saca del flujo normal así no empuja el layout), sin
  // instante en blanco en el medio.
  return (
    <ScreenErrorBoundary key={screenBoundaryKey} onBack={handleScreenErrorBack}>
      <AnimatePresence mode="popLayout">{getScreenContent()}</AnimatePresence>
    </ScreenErrorBoundary>
  );
}
