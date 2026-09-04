// Backend SIMULADO del Apps Script, para probar la app sin planilla real.
// Responde las acciones que usa src/api.js (login, session, users, years,
// months, read, update/updateBatch y create) con datos inventados.
//
//   node tools/smoke/server.mjs            # escucha en :8787
//   VITE_BACKEND_URL=http://localhost:8787 npm run dev
//
// Variables: PORT (8787), ROWS (300), LATENCY_MS (250).
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const ROWS = Number(process.env.ROWS || 300);
const LATENCY_MS = Number(process.env.LATENCY_MS || 250);

const USERS = ['Jorge', 'María', 'Lucía', 'Carlos', 'Ana'];
const HEADERS = [
  'Razón Social', 'R.U.C.', 'Clave MH', 'Vencimiento', 'Encargado',
  'Presentado', 'Presentado por:', 'Archivado', 'Archivado por:', 'Observaciones',
];
const NAMES = ['Comercial', 'Ferretería', 'Distribuidora', 'Estudio', 'Panadería', 'Transportes', 'Farmacia', 'Consultora'];
const SURNAMES = ['Sur', 'del Este', 'Ñandutí', 'Guaraní', 'Central', 'Paraná', 'Chaco', 'Ypacaraí'];

function makeRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const presentado = i % 3 === 0;
    rows.push({
      _row: i + 2,
      'Razón Social': `${NAMES[i % NAMES.length]} ${SURNAMES[(i * 7) % SURNAMES.length]} ${i + 1} S.A.`,
      'R.U.C.': `${80000000 + i * 37}-${i % 10}`,
      'Clave MH': i % 4 === 0 ? '' : `clave${i}`,
      'Vencimiento': `Día ${((i * 3) % 25) + 1}`,
      'Encargado': i % 5 === 4 ? '' : USERS[i % USERS.length],
      'Presentado': presentado ? 'SI' : 'NO',
      'Presentado por:': presentado ? USERS[i % USERS.length] : '',
      'Archivado': i % 11 === 0 ? 'SI' : 'NO',
      'Archivado por:': i % 11 === 0 ? 'Jorge' : '',
      'Observaciones': i % 6 === 0 ? 'Cliente con IVA mensual' : '',
    });
  }
  return rows;
}

export const sheets = new Map(); // `${year}_${month}` -> rows
function getRows(year, month) {
  const key = `${year}_${month}`;
  if (!sheets.has(key)) sheets.set(key, makeRows(ROWS));
  return sheets.get(key);
}

const sessions = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sessionResponse(user) {
  const token = `tok-${Math.random().toString(36).slice(2)}`;
  sessions.set(token, { user, role: 'ADMINISTRADOR' });
  return {
    ok: true,
    sessionToken: token,
    user: { name: user, role: 'ADMINISTRADOR' },
    pinless: true,
    expiresAt: Date.now() + 8 * 3600_000,
    idleTimeoutMs: 30 * 60_000,
  };
}

export async function handle(body) {
  await sleep(LATENCY_MS);
  const { action } = body || {};
  if (action === 'ping') return { ok: true };
  if (action === 'login') return sessionResponse(String(body.user || 'Jorge'));
  const session = sessions.get(body.sessionToken);
  if (!session) return { ok: false, code: 'SESSION_REQUIRED', error: 'Sesión requerida' };
  switch (action) {
    case 'session':
      return { ...sessionResponse(session.user), sessionToken: body.sessionToken };
    case 'logout':
      sessions.delete(body.sessionToken);
      return { ok: true };
    case 'users':
      return { ok: true, users: USERS.map((name) => ({ name })) };
    case 'years':
      return { ok: true, years: ['2025', '2026'] };
    case 'months':
      return { ok: true, months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre'] };
    case 'read':
      return { ok: true, headers: HEADERS, rows: getRows(body.year, body.sheet) };
    case 'update': {
      const row = getRows(body.year, body.sheet).find((r) => r._row === Number(body.row));
      if (!row) return { ok: false, code: 'ROW_NOT_FOUND', error: 'Fila inexistente' };
      row[body.column] = body.value;
      return { ok: true };
    }
    case 'updateBatch': {
      const results = (body.updates || []).map((update) => {
        const row = getRows(update.year, update.sheet).find((item) => item._row === Number(update.row));
        if (!row) return { row: update.row, column: update.column, ok: false, error: 'Fila inexistente' };
        row[update.column] = update.value;
        return { row: update.row, column: update.column, ok: true };
      });
      return { ok: true, results };
    }
    case 'create': {
      const rows = getRows(body.year, body.sheet);
      const nextRow = rows.reduce((maximum, row) => Math.max(maximum, row._row), 1) + 1;
      rows.push({ ...Object.fromEntries(HEADERS.map((header) => [header, ''])), ...body.values, _row: nextRow });
      return { ok: true, row: nextRow };
    }
    default:
      return { ok: false, code: 'UNKNOWN_ACTION', error: `Acción desconocida: ${action}` };
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  http
    .createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.end();
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch { /* vacío */ }
      const out = await handle(body);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
    })
    .listen(PORT, '0.0.0.0', () => console.log(`Backend simulado en http://0.0.0.0:${PORT} (${ROWS} filas)`));
}
