# Ekuatia Login (extensión Chrome/Edge)

Autocompleta el login de Marangatu. Tiene dos vías:

1. **Popup (manual):** buscador de clientes + "Login automático" sobre la pestaña activa.
2. **Puente desde la app (recomendado):** el botón Marangatu de cada tarjeta de
   "Control Clientes" le manda `R.U.C.` + `Clave MH` por mensajería externa y la
   extensión abre el login e inyecta. Las credenciales viajan en memoria: nunca
   quedan en la URL, el historial ni el portapapeles.

## Instalar

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá **"Modo de desarrollador"** (arriba a la derecha).
3. **"Cargar descomprimida"** → elegí esta carpeta `Extension/`.
4. Copiá el **ID** que aparece bajo el nombre de la extensión.

## Conectar con la app

1. En la raíz del proyecto creá un archivo `.env` (copiá `.env.example`).
2. Poné `VITE_MARANGATU_EXT_ID=<el ID que copiaste>`.
3. Reiniciá `npm run dev` (o rebuild de la PWA).
4. Si tu app corre en un dominio propio, agregalo a
   `externally_connectable.matches` en `manifest.json`.

> El autologin por mensajería funciona en Chrome/Edge/Chromium. En **Firefox**
> esa vía no existe: el botón simplemente abre la página de login.

## ¿Dónde va el CSV?

**No va al repo.** `clientes.csv` contenía contraseñas en claro y se quitó del
control de versiones (está en `.gitignore`).

- Para el **botón de la app** no hace falta el CSV: las credenciales salen de las
  columnas `R.U.C.` y `Clave MH` de tu planilla.
- Para el **buscador del popup**, guardá el CSV como un archivo LOCAL en tu PC
  (por ejemplo en Documentos) y cargalo con el selector de archivo del popup.
  Qeda en `localStorage` de la extensión, no en el repo.

## Seguridad

- No commitees `clientes.csv` ni ningún volcado de contraseñas.
- Si ese archivo llegó a estar en el historial de un repo compartido, rotá las
  contraseñas y purgalo (`git filter-repo`).
