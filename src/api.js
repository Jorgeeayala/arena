import { BACKEND_URL, API_TOKEN } from './config';
import { enqueueUpdate, configureSaveQueue, onQueueStatusChange, flushNow } from './saveQueue';

// Persistent & in-memory cache for instant navigation & zero latency
const LOCAL_STORAGE_CACHE_KEY = 'sheets_remote_persistent_cache_v2';

function loadPersistentCache() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error al cargar cache persistente:', e);
  }
  return null;
}

const cache = loadPersistentCache() || {
  users: null,
  years: null,
  months: {}, // year -> months array
  read: {},   // `${year}_${sheet}` -> { headers, rows, timestamp }
};

function saveCache() {
  try {
    localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Error al guardar cache persistente:', e);
  }
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 400) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Leemos como texto primero (no directo .json()) para poder mostrar
      // la respuesta cruda en el mensaje de error si no es JSON válido --
      // así se puede diagnosticar sin necesitar cable USB ni DevTools.
      const rawText = await res.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        const preview = rawText.slice(0, 300).replace(/\s+/g, ' ').trim();
        throw new Error(
          `Respuesta no es JSON válido (HTTP ${res.status}) desde ${url}. ` +
          `Primeros caracteres de la respuesta: "${preview}"`
        );
      }

      if (!data.ok) {
        throw new Error(data.error || 'Error desconocido del servidor');
      }
      return data;
    } catch (err) {
      lastError = err;
      const isNetworkError =
        err.name === 'TypeError' ||
        !err.message ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Load failed');

      if (isNetworkError && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function get(action, extraParams = {}) {
  const params = new URLSearchParams({ action, token: API_TOKEN, ...extraParams });
  return fetchWithRetry(`${BACKEND_URL}?${params.toString()}`, { method: 'GET' });
}

async function post(body) {
  return fetchWithRetry(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // evita preflight CORS con Apps Script
    body: JSON.stringify({ token: API_TOKEN, ...body }),
  });
}

// La cola de guardado usa el mismo `post` (con sus retries y su token) para
// mandar los batches de updates en segundo plano.
configureSaveQueue({ post });

export const api = {
  ping: () => get('ping'),

  listUsers: async (force = false) => {
    if (!force && cache.users) {
      return cache.users.map((u) => (typeof u === 'string' ? u : u.name || u.user || u.USUARIO || u.Usuario)).filter(Boolean);
    }
    const d = await get('users');
    cache.users = d.users || [];
    saveCache();
    return (d.users || []).map((u) => (typeof u === 'string' ? u : u.name || u.user || u.USUARIO || u.Usuario)).filter(Boolean);
  },

  listUsersWithRoles: async (force = false) => {
    let rawUsers = cache.users;
    if (force || !rawUsers) {
      const d = await get('users');
      rawUsers = d.users || [];
      cache.users = rawUsers;
      saveCache();
    }
    return (rawUsers || []).map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        const upper = name.toUpperCase();
        const role = upper.includes('JORGE') ? 'SUPERUSUARIO' : 'USUARIO';
        return { name, role };
      }
      const name = item.name || item.user || item.USUARIO || item.Usuario || '';
      const role = (item.role || item.ROL || item.Rol || 'USUARIO').toUpperCase();
      return { name, role };
    }).filter((u) => u.name);
  },

  listYears: async (force = false) => {
    if (!force && cache.years) {
      // Revalidar en segundo plano para captar nuevos años si se crean
      get('years').then((d) => {
        if (d.years) {
          cache.years = d.years;
          saveCache();
        }
      }).catch(() => {});
      return cache.years;
    }
    const d = await get('years');
    cache.years = d.years;
    saveCache();
    return d.years;
  },

  listMonths: async (year, force = false) => {
    if (!force && cache.months[year]) {
      // Revalidar en segundo plano para descubrir nuevas hojas creadas en Google Sheets
      get('months', { year }).then((d) => {
        if (d.months) {
          cache.months[year] = d.months;
          saveCache();
        }
      }).catch(() => {});
      return cache.months[year];
    }
    const d = await get('months', { year });
    cache.months[year] = d.months;
    saveCache();
    return d.months;
  },

  readClients: async (year, sheet, force = false) => {
    const key = `${year}_${sheet}`;
    if (!force && cache.read[key]) {
      // Revalidar en segundo plano para incorporar columnas nuevas o filas creadas en la planilla
      get('read', { year, sheet }).then((data) => {
        if (data && data.headers) {
          cache.read[key] = { headers: data.headers || [], rows: data.rows || [] };
          saveCache();
        }
      }).catch(() => {});
      return cache.read[key];
    }
    const data = await get('read', { year, sheet });
    cache.read[key] = { headers: data.headers || [], rows: data.rows || [] };
    saveCache();
    return cache.read[key];
  },

  updateCell: async ({ year, sheet, user, row, column, value }) => {
    // Actualización optimista inmediata en la memoria local (esto es lo que
    // hace que la UI se sienta instantánea, no depende de la red)
    const key = `${year}_${sheet}`;
    if (cache.read[key]) {
      const targetRow = cache.read[key].rows.find((r) => r._row === row);
      if (targetRow) {
        targetRow[column] = value;
      }
      saveCache();
    }

    // La petición real NO se manda al toque: se encola. Si llegan varias
    // ediciones juntas (varios campos, varias tarjetas con swipe rápido),
    // se agrupan en una sola petición al backend en vez de disparar N
    // peticiones en paralelo que compiten por el lock de la hoja en Apps
    // Script (esa competencia es la causa principal de la lentitud actual).
    return enqueueUpdate({ year, sheet, user, row, column, value });
  },

  // Estado de la cola en segundo plano ('idle' | 'syncing'), útil para un
  // indicador sutil de sincronización en vez de un loader bloqueante.
  onSyncStatusChange: onQueueStatusChange,

  // Fuerza el guardado inmediato de lo que esté pendiente en la cola (por
  // ejemplo, antes de salir de la pantalla de detalle).
  flushPendingSaves: flushNow,

  createClient: async ({ year, sheet, user, values }) => {
    const res = await post({ action: 'create', year, sheet, user, values });
    const key = `${year}_${sheet}`;
    
    if (res.row && cache.read[key]) {
      // Inserción optimista del nuevo cliente en el cache de la lista
      cache.read[key].rows.unshift({ ...values, _row: res.row });
    } else {
      delete cache.read[key]; // Forzar recarga completa en la siguiente lectura
    }
    saveCache();

    return res;
  },

  clearCache: () => {
    cache.users = null;
    cache.years = null;
    cache.months = {};
    cache.read = {};
    try {
      localStorage.removeItem(LOCAL_STORAGE_CACHE_KEY);
    } catch (e) {
      console.warn('Error al borrar cache persistente:', e);
    }
  }
};

