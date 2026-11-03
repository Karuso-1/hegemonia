# Hegemonía

Juego de conquista mundial por turnos para jugar con amigos desde el navegador (ordenador o móvil). Se entra con un enlace y solo se escribe un nombre.

## Cómo está hecho

- `public/index.html`: el juego completo (mapa, reglas, bots).
- `functions/api/[[path]].js`: el servidor de partidas (Cloudflare Pages Functions).
- Las partidas se guardan en una base de datos **Cloudflare D1** enlazada con el nombre `DB`. La tabla se crea sola la primera vez.

## Publicarlo en Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git → este repositorio.
2. Build command: *(vacío)* · Build output directory: `public`.
3. Storage & Databases → D1 → Create database (por ejemplo `hegemonia-db`).
4. En el proyecto de Pages: Settings → Bindings → Add → D1 database → Variable name `DB` → elige `hegemonia-db`.
5. Deployments → Retry deployment (para que el enlace de la base de datos se aplique).
