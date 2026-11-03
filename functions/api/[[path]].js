// Hegemonía — servidor de partidas (Cloudflare Pages Functions + D1).
// Rutas:
//   GET    /api/games                 → lista de partidas recientes
//   GET    /api/games/:code[?since=N] → estado de una partida (204 si no ha cambiado desde la versión N)
//   PUT    /api/games/:code           → guarda { state, baseRev } solo si nadie la cambió antes (409 si hubo choque)
//   DELETE /api/games/:code           → borra la partida
// Necesita una base de datos D1 enlazada con el nombre DB. La tabla se crea sola.

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

let ready = false;
async function init(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS games (
    code TEXT PRIMARY KEY,
    rev INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    summary TEXT NOT NULL,
    data TEXT NOT NULL
  )`).run();
  ready = true;
}

function summarize(s) {
  return {
    code: s.code, status: s.status, round: s.round || 1, winner: s.winner ?? null,
    practice: !!s.practice, updatedAt: Date.now(),
    players: (s.players || []).map(p => ({ id: p.id, alias: p.alias, color: p.color, bot: !!p.bot })),
  };
}

export async function onRequest({ request, env, params }) {
  const db = env.DB;
  if (!db) return json({ error: 'Falta enlazar la base de datos D1 con el nombre DB.' }, 500);
  await init(db);

  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (parts[0] !== 'games') return json({ error: 'No encontrado' }, 404);
  const code = parts[1];
  const method = request.method;

  if (!code) {
    if (method !== 'GET') return json({ error: 'Método no permitido' }, 405);
    // De vez en cuando, limpia partidas sin movimiento en 30 días
    if (Math.random() < 0.02) await db.prepare('DELETE FROM games WHERE updated < ?').bind(Date.now() - 30 * 864e5).run();
    const r = await db.prepare('SELECT summary FROM games ORDER BY updated DESC LIMIT 30').all();
    return json({ games: r.results.map(x => JSON.parse(x.summary)) });
  }
  if (!/^[a-z0-9]{3,12}$/.test(code)) return json({ error: 'Código de partida no válido' }, 400);

  if (method === 'GET') {
    const since = new URL(request.url).searchParams.get('since');
    if (since !== null) {
      const r = await db.prepare('SELECT rev FROM games WHERE code = ?').bind(code).first();
      if (!r) return json({ exists: false });
      if (String(r.rev) === since) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    }
    const r = await db.prepare('SELECT data FROM games WHERE code = ?').bind(code).first();
    return r ? json({ exists: true, state: JSON.parse(r.data) }) : json({ exists: false });
  }

  if (method === 'PUT') {
    const raw = await request.text();
    if (raw.length > 250000) return json({ error: 'Partida demasiado grande' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'JSON no válido' }, 400); }
    const s = body && body.state;
    const baseRev = Number(body && body.baseRev);
    if (!s || s.code !== code || !Number.isInteger(s.rev) || s.rev !== baseRev + 1) return json({ error: 'Datos no válidos' }, 400);
    const summary = JSON.stringify(summarize(s)), data = JSON.stringify(s), now = Date.now();
    if (baseRev === 0) {
      try {
        await db.prepare('INSERT INTO games (code, rev, updated, summary, data) VALUES (?, ?, ?, ?, ?)').bind(code, s.rev, now, summary, data).run();
        return json({ ok: true });
      } catch { return json({ error: 'conflict' }, 409); }
    }
    const r = await db.prepare('UPDATE games SET rev = ?, updated = ?, summary = ?, data = ? WHERE code = ? AND rev = ?')
      .bind(s.rev, now, summary, data, code, baseRev).run();
    if (!r.meta || !r.meta.changes) return json({ error: 'conflict' }, 409);
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    await db.prepare('DELETE FROM games WHERE code = ?').bind(code).run();
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido' }, 405);
}
