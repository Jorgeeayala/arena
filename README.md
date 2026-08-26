# Control Remoto Clientes - Frontend (PWA)

Primera versión funcional: elegir usuario, ver lista de clientes con
buscador, y editar campos de la ficha de un cliente. Sin diseño visual
todavía (eso viene después).

## Cómo correrlo

1. Instalá dependencias:
   ```
   npm install
   ```

2. Configurá la conexión: abrí `src/config.js` y pegá tu URL del Web
   App de Apps Script y tu API_TOKEN (los mismos que usaste en el
   test-client.html).

3. Corré en modo desarrollo:
   ```
   npm run dev
   ```
   Te va a dar una URL tipo http://localhost:5173 para abrir en el navegador.

4. Para probarlo en el celular, conectado a la misma red WiFi que tu PC:
   ```
   npm run dev -- --host
   ```
   Te va a dar una URL con tu IP local (ej: http://192.168.x.x:5173) que
   podés abrir desde el navegador del celular.

## Cómo instalarlo como app (PWA)

Una vez que corras `npm run build` y subas la carpeta `dist/` a algún
hosting (lo vemos en el próximo paso), vas a poder abrir esa URL desde
el celular o la PC y usar la opción "Instalar app" / "Agregar a
pantalla de inicio" del navegador.

## Qué falta (a propósito, para versiones siguientes)

- Diseño visual (colores, tipografía, ícono real de la app)
- Restricción de columnas sensibles según el usuario
- Dashboard extra para admins
- Alta de clientes nuevos (por ahora solo lee y edita los que ya existen)
