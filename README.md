# Hegemonía

Juego de conquista mundial por turnos para jugar con amigos desde el navegador (ordenador o móvil). Se entra con un enlace y solo se escribe un nombre.

## Cómo está hecho

- `public/index.html`: el juego completo (mapa, reglas, bots).
- `src/worker.js`: el Worker de Cloudflare. Sirve la web y el servidor de partidas en `/api/`.
- `wrangler.jsonc`: configuración del Worker y de la base de datos **D1** `hegemonia-db` (enlazada como `DB`). La tabla se crea sola.

Cada vez que se sube algo a la rama `main`, Cloudflare vuelve a publicar el Worker automáticamente.
