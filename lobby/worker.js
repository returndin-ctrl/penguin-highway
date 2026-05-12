// Penguin Highway lobby Worker.
//
// All rooms live inside a single KV key `rooms-index` (JSON map) so reads are
// strongly consistent — `KV.list()` lags up to 60s and is unsuitable for a
// lobby. Per-room TTL is enforced manually by filtering on read (10 min).
//
// Endpoints:
//   GET    /rooms        → JSON array of live rooms
//   POST   /rooms        → body: {code, total, humans, joined, difficulty, hostName?}
//   DELETE /rooms/:code  → host clears its room on cancel/start
//
// KV binding: `ROOMS` (set up in wrangler.toml).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const INDEX_KEY = 'rooms-index';
const ROOM_TTL_MS = 10 * 60 * 1000;  // drop on read after 10 min

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function readIndex(env) {
  const raw = await env.ROOMS.get(INDEX_KEY, 'json');
  return raw && typeof raw === 'object' ? raw : {};
}
async function writeIndex(env, idx) {
  // No KV TTL on the index itself — staleness handled on read.
  await env.ROOMS.put(INDEX_KEY, JSON.stringify(idx));
}
function pruneStale(idx) {
  const now = Date.now();
  for (const code of Object.keys(idx)) {
    if (!idx[code] || now - (idx[code].ts || 0) > ROOM_TTL_MS) {
      delete idx[code];
    }
  }
  return idx;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (url.pathname === '/rooms' && req.method === 'GET') {
      const idx = pruneStale(await readIndex(env));
      return json(Object.values(idx));
    }

    if (url.pathname === '/rooms' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const code = String(body.code || '').trim();
      if (!code || !/^[a-zA-Z0-9_\-]+$/.test(code)) {
        return json({ error: 'invalid code' }, 400);
      }
      const idx = pruneStale(await readIndex(env));
      idx[code] = {
        code,
        total: Number(body.total) || 2,
        humans: Number(body.humans) || 2,
        joined: Number(body.joined) || 1,
        difficulty: String(body.difficulty || 'normal'),
        hostName: String(body.hostName || '').slice(0, 32),
        ts: Date.now(),
      };
      await writeIndex(env, idx);
      return json({ ok: true });
    }

    if (url.pathname.startsWith('/rooms/') && req.method === 'DELETE') {
      const code = url.pathname.slice('/rooms/'.length);
      if (!code) return json({ error: 'missing code' }, 400);
      const idx = pruneStale(await readIndex(env));
      delete idx[code];
      await writeIndex(env, idx);
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};
