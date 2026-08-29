import { BACKEND_URL, API_TOKEN, STORAGE_KEY_SESSION } from './config';
import { normalizeUserRole, normalizeSearchText } from './utils';
import {
  enqueueUpdate,
  configureSaveQueue,
  onQueueStatusChange,
  flushNow,
  getPendingUpdates,
} from './saveQueue';

// Desde v3 sólo se persisten metadatos no sensibles. Las filas completas se
// conservan exclusivamente en memoria porque pueden contener "Clave MH" y
// otros datos de clientes.
const LEGACY_STORAGE_CACHE_KEY = 'sheets_remote_persistent_cache_v2';
const LOCAL_STORAGE_CACHE_KEY = 'sheets_remote_metadata_cache_v3';
const SESSION_ERROR_CODES = new Set([
  'SESSION_REQUIRED',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'PIN_SETUP_REQUIRED',
]);

const authFailureListeners = new Set();

class ApiError extends Error {
  constructor(message, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = data.code || 'API_ERROR';
    this.details = data;
    this.attemptsRemaining = data.attemptsRemaining;
    this.lockedUntil = data.lockedUntil;
  }
}

function removeLegacySensitiveCache() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_CACHE_KEY);
  } catch {
    // Si localStorage no está disponible, el caché tampoco puede persistir.
  }
}

function loadPersistentMetadata() {
  removeLegacySensitiveCache();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    console.warn('Error al cargar metadatos persistentes:', error);
  }
  return null;
}

const persistentMetadata = loadPersistentMetadata();
const cache = {
  users: persistentMetadata?.users || null,
  years: persistentMetadata?.years || null,
  months: persistentMetadata?.months || {},
  read: {},
};

function saveMetadataCache() {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_CACHE_KEY,
      JSON.stringify({
        users: cache.users,
        years: cache.years,
        months: cache.months,
      })
    );
  } catch (error) {
    console.warn('Error al guardar metadatos persistentes:', error);
  }
}

function clearPrivateDataCache() {
  cache.read = {};
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.name) return null;
    return {
      token: String(parsed.token),
      user: {
        name: String(parsed.user.name),
        role: normalizeUserRole(parsed.user.role),
      },
      pinless: Boolean(parsed.pinless),
      expiresAt: Number(parsed.expiresAt || 0),
      idleTimeoutMs: Number(parsed.idleTimeoutMs || 0),
    };
  } catch {
    return null;
  }
}

let currentSession = readStoredSession();

function normalizeSession(data, fallbackToken = '') {
  const token = String(data.sessionToken || fallbackToken || '');
  if (!token || !data.user?.name) {
    throw new ApiError('Respuesta de sesión incompleta', {
      code: 'INVALID_SESSION_RESPONSE',
    });
  }

  return {
    token,
    user: {
      name: String(data.user.name),
      role: normalizeUserRole(data.user.role),
    },
    pinless: Boolean(data.pinless),
    expiresAt: Number(data.expiresAt || 0),
    idleTimeoutMs: Number(data.idleTimeoutMs || 0),
  };
}

function storeSession(session) {
  currentSession = session;
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch (error) {
    console.warn('No se pudo guardar la sesión local:', error);
  }
  return session;
}

function clearStoredSession() {
  currentSession = null;
  clearPrivateDataCache();
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION);
  } catch {
    // La sesión en memoria queda eliminada aunque localStorage no responda.
  }
}

function notifyAuthFailure(error) {
  authFailureListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (listenerError) {
      console.warn('Error en listener de autenticación:', listenerError);
    }
  });
}

// Reaplica sobre una lectura fresca las escrituras que siguen en cola para no
// rebobinar visualmente una edición optimista aún no confirmada.
function withPendingWrites(data, year, sheet) {
  const pendings = getPendingUpdates().filter(
    (update) => String(update.year) === String(year) && String(update.sheet) === String(sheet)
  );
  if (!pendings.length) return data;

  const rows = (data.rows || []).map((row) => ({ ...row }));
  pendings.forEach((update) => {
    const target = rows.find((row) => row._row === update.row);
    if (target) target[update.column] = update.value;
  });
  return { ...data, rows };
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 400) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        const preview = rawText.slice(0, 300).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Respuesta no es JSON válido (HTTP ${response.status}) desde ${url}. ` +
          `Primeros caracteres de la respuesta: "${preview}"`
        );
      }

      if (!data.ok) {
        throw new ApiError(data.error || 'Error desconocido del servidor', data);
      }
      return data;
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.name === 'TypeError' ||
        !error.message ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Load failed');

      if (isNetworkError && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function assertBackendConfig() {
  const missing = [];
  if (!BACKEND_URL) missing.push('VITE_BACKEND_URL');
  if (!API_TOKEN) missing.push('VITE_API_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `Configuración incompleta: falta definir ${missing.join(' y ')} en el entorno de compilación.`
    );
  }
}

// Todas las operaciones usan POST simple para Apps Script. Cuando existe una
// sesión, su token se adjunta automáticamente y nunca se toma el rol desde la UI.
async function request(body, { handleSessionFailure = true } = {}) {
  assertBackendConfig();
  const payload = { ...body, token: API_TOKEN };
  if (!payload.sessionToken && currentSession?.token) {
    payload.sessionToken = currentSession.token;
  }

  try {
    return await fetchWithRetry(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (handleSessionFailure && SESSION_ERROR_CODES.has(error.code)) {
      clearStoredSession();
      notifyAuthFailure(error);
    }
    throw error;
  }
}

configureSaveQueue({ post: request });

function getUserName(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(
    item.name ?? item.user ?? item.USUARIO ?? item.Usuario ?? item.usuario ?? ''
  ).trim();
}

function isSameUser(left, right) {
  return normalizeSearchText(left) === normalizeSearchText(right);
}

export const api = {
  ping: () => request({ action: 'ping' }, { handleSessionFailure: false }),

  login: async (user, pin = '') => {
    const previousUser = currentSession?.user?.name || '';
    const data = await request(
      { action: 'login', user, pin },
      { handleSessionFailure: false }
    );
    const session = normalizeSession(data);
    if (previousUser && !isSameUser(previousUser, session.user.name)) {
      clearPrivateDataCache();
    }
    return storeSession(session);
  },

  setupPin: async (user, pin) => {
    clearStoredSession();
    const data = await request(
      { action: 'setupPin', user, pin },
      { handleSessionFailure: false }
    );
    return storeSession(normalizeSession(data));
  },

  validateSession: async ({ notifyOnFailure = true } = {}) => {
    if (!currentSession?.token) {
      throw new ApiError('Sesión requerida', { code: 'SESSION_REQUIRED' });
    }

    try {
      const data = await request(
        {
          action: 'session',
          sessionToken: currentSession.token,
        },
        { handleSessionFailure: notifyOnFailure }
      );
      return storeSession(normalizeSession(data, currentSession.token));
    } catch (error) {
      if (!notifyOnFailure && SESSION_ERROR_CODES.has(error.code)) {
        clearStoredSession();
      }
      throw error;
    }
  },

  logout: async () => {
    const token = currentSession?.token || '';
    try {
      if (token) {
        await request(
          { action: 'logout', sessionToken: token },
          { handleSessionFailure: false }
        );
      }
    } finally {
      clearStoredSession();
    }
  },

  clearSession: clearStoredSession,

  getStoredSession: () => {
    if (!currentSession) return null;
    return {
      ...currentSession,
      user: { ...currentSession.user },
    };
  },

  onAuthFailure: (listener) => {
    authFailureListeners.add(listener);
    return () => authFailureListeners.delete(listener);
  },

  listUsers: async (force = false) => {
    if (!force && cache.users) return cache.users.map(getUserName).filter(Boolean);

    const data = await request(
      { action: 'users' },
      { handleSessionFailure: false }
    );
    cache.users = data.users || [];
    saveMetadataCache();
    return cache.users.map(getUserName).filter(Boolean);
  },

  listYears: async (force = false) => {
    if (!force && cache.years) {
      request({ action: 'years' }).then((data) => {
        if (data.years) {
          cache.years = data.years;
          saveMetadataCache();
        }
      }).catch(() => {});
      return cache.years;
    }
    const data = await request({ action: 'years' });
    cache.years = data.years || [];
    saveMetadataCache();
    return cache.years;
  },

  listMonths: async (year, force = false) => {
    if (!force && cache.months[year]) {
      request({ action: 'months', year }).then((data) => {
        if (data.months) {
          cache.months[year] = data.months;
          saveMetadataCache();
        }
      }).catch(() => {});
      return cache.months[year];
    }
    const data = await request({ action: 'months', year });
    cache.months[year] = data.months || [];
    saveMetadataCache();
    return cache.months[year];
  },

  readClients: async (year, sheet, force = false) => {
    const key = `${year}_${sheet}`;
    if (!force && cache.read[key]) {
      request({ action: 'read', year, sheet }).then((data) => {
        if (data?.headers) {
          cache.read[key] = withPendingWrites(
            { headers: data.headers || [], rows: data.rows || [] },
            year,
            sheet
          );
        }
      }).catch(() => {});
      return cache.read[key];
    }

    const data = await request({ action: 'read', year, sheet });
    cache.read[key] = withPendingWrites(
      { headers: data.headers || [], rows: data.rows || [] },
      year,
      sheet
    );
    return cache.read[key];
  },

  updateCell: async ({ year, sheet, row, column, value }) => {
    const key = `${year}_${sheet}`;
    if (cache.read[key]) {
      const targetRow = cache.read[key].rows.find((rowItem) => rowItem._row === row);
      if (targetRow) targetRow[column] = value;
    }

    return enqueueUpdate({ year, sheet, row, column, value });
  },

  onSyncStatusChange: onQueueStatusChange,
  flushPendingSaves: flushNow,

  createClient: async ({ year, sheet, values }) => {
    const response = await request({ action: 'create', year, sheet, values });
    const key = `${year}_${sheet}`;

    if (response.row && cache.read[key]) {
      cache.read[key].rows.unshift({ ...values, _row: response.row });
    } else {
      delete cache.read[key];
    }
    return response;
  },

  clearCache: () => {
    cache.users = null;
    cache.years = null;
    cache.months = {};
    cache.read = {};
    try {
      localStorage.removeItem(LOCAL_STORAGE_CACHE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_CACHE_KEY);
    } catch (error) {
      console.warn('Error al borrar caché local:', error);
    }
  },
};
