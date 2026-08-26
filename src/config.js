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
