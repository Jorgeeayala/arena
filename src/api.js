import { BACKEND_URL, API_TOKEN } from './config';
import { normalizeUserRole } from './utils';
import {
  enqueueUpdate,
  configureSaveQueue,
  onQueueStatusChange,
  flushNow,
  getPendingUpdates,
} from './saveQueue';

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

// Vuelve a aplicar sobre los datos recién leídos del servidor las ediciones
// que todavía están en la cola de guardado (sin salir). Sin esto, una
// revalidación en segundo plano puede devolver la foto vieja de la hoja y
// "desasignar" visualmente un cliente que acabás de asignar.
function withPendingWrites(data, year, sheet) {
  const pendings = getPendingUpdates().filter(
    (u) => String(u.year) === String(year) && String(u.sheet) === String(sheet)
  );
  if (!pendings.length) return data;

  const rows = (data.rows || []).map((r) => ({ ...r }));
  pendings.forEach((u) => {
    const target = rows.find((r) => r._row === u.row);
    if (target) target[u.column] = u.value;
  });
  return { ...data, rows };
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

// Una única vía para lecturas y escrituras. `text/plain` mantiene la petición
// dentro de las solicitudes CORS simples que acepta Apps Script, mientras que
// el token viaja en el JSON y deja de formar parte de la URL.
async function request(body) {
  assertBackendConfig();
  return fetchWithRetry(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...body, token: API_TOKEN }),
  });
}

// La cola de guardado usa la misma función (con retries y token) para mandar
// los batches de actualizaciones en segundo plano.
configureSaveQueue({ post: request });

function getUserName(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(
    item.name ?? item.user ?? item.USUARIO ?? item.Usuario ?? item.usuario ?? ''
  ).trim();
}

function getUserRole(item) {
  if (!item || typeof item !== 'object') return 'USUARIO';
  return normalizeUserRole(item.role ?? item.ROLE ?? item.ROL ?? item.Rol ?? item.rol);
}

export const api = {
  ping: () => request({ action: 'ping' }),

  listUsers: async (force = false) => {
    if (!force && cache.users) {
      return cache.users.map(getUserName).filter(Boolean);
    }
    const d = await request({ action: 'users' });
    cache.users = d.users || [];
    saveCache();
    return (d.users || []).map(getUserName).filter(Boolean);
  },

  listUsersWithRoles: async (force = false) => {
    let rawUsers = cache.users;
    if (force || !rawUsers) {
      const d = await request({ action: 'users' });
      rawUsers = d.users || [];
      cache.users = rawUsers;
      saveCache();
    }
    return (rawUsers || [])
      .map((item) => ({ name: getUserName(item), role: getUserRole(item) }))
      .filter((u) => u.name);
  },

  listYears: async (force = false) => {
    if (!force && cache.years) {
      // Revalidar en segundo plano para captar nuevos años si se crean
      request({ action: 'years' }).then((d) => {
        if (d.years) {
          cache.years = d.years;
          saveCache();
        }
      }).catch(() => {});
      return cache.years;
    }
    const d = await request({ action: 'years' });
    cache.years = d.years;
    saveCache();
    return d.years;
  },

  listMonths: async (year, force = false) => {
    if (!force && cache.months[year]) {
      // Revalidar en segundo plano para descubrir nuevas hojas creadas en Google Sheets
      request({ action: 'months', year }).then((d) => {
        if (d.months) {
          cache.months[year] = d.months;
          saveCache();
        }
      }).catch(() => {});
      return cache.months[year];
    }
    const d = await request({ action: 'months', year });
    cache.months[year] = d.months;
    saveCache();
    return d.months;
  },

  readClients: async (year, sheet, force = false) => {
    const key = `${year}_${sheet}`;
    if (!force && cache.read[key]) {
      // Revalidar en segundo plano para incorporar columnas nuevas o filas creadas en la planilla
      request({ action: 'read', year, sheet }).then((data) => {
        if (data && data.headers) {
          cache.read[key] = withPendingWrites(
            { headers: data.headers || [], rows: data.rows || [] },
            year,
            sheet
          );
          saveCache();
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
    const res = await request({ action: 'create', year, sheet, user, values });
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

