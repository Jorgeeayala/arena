// Configuración de conexión al backend (Apps Script).
// Esto NO lo pone el usuario final -- va fijo en la app, es la misma
// URL y token que ya probaste con el test-client.html.
//
// TODO Jorge: pegá acá tu URL y token reales antes de correr la app.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'https://script.google.com/macros/s/AKfycbzT6yAQTQa_bEww3UZMAPsdO9tvjbB5LqWpUuspC7tBNwLuNsiezoYtfvE3VQtTZye5/exec';
export const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'Jorgemanuel22';

// Nombre de la clave que usamos en localStorage para guardar el nombre
// de usuario elegido la primera vez (queda "fijo" desde ese momento).
export const STORAGE_KEY_USER = 'sheets-remote:user';

// --- Marangatu (login de la SET) ---------------------------------------
// Página que abre el botón de la tarjeta de cliente. Si la extensión
// "Ekuatia Login" está instalada y configurada, autocompleta el formulario;
// si no, igual abre el login para cargarlo a mano.
export const MARANGATU_LOGIN_URL =
  import.meta.env.VITE_MARANGATU_LOGIN_URL || 'https://marangatu.set.gov.py/eset/login';

// ID de la extensión (se ve en chrome://extensions con "Modo de
// desarrollador" activado). Si queda vacío, el botón sólo abre la página y
// avisa que instales la extensión. El ID de una extensión "descomprimida"
// cambia según la máquina: pegalo acá (o en VITE_MARANGATU_EXT_ID) tras
// cargarla en tu Chrome.
export const MARANGATU_EXT_ID = import.meta.env.VITE_MARANGATU_EXT_ID || '';
