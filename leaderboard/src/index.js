// Project Vacuum leaderboard Worker.
//   GET  /board  -> top 10 [{name, score, time, lured, webs, ver, at}] sorted by score desc
//   POST /score  -> body JSON {name, score, time, lured, webs, ver[, pulses]} -> {ok, rank, top}
// Storage: ONE KV key "board" holding up to 50 entries (best score per name), plus short-lived "rl:<ip>" rate-limit keys.
// Free-tier friendly: GET = 1 KV read; POST = 1-2 reads + 1 write (+1 write only if the score makes the stored 50).

const KEEP = 50, TOP = 10;
const RL_WINDOW = 60, RL_MAX = 6;           // loose: at most 6 submissions per IP per ~minute (KV TTL minimum is 60 s)
const NAME_RE = /^[A-Za-z0-9 _-]{1,16}$/;
const VER_RE = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;

function allowedOrigin(origin, env) {
  if (!origin) return null;
  if (origin === 'https://silvertibby.github.io' || origin === 'null') return origin;           // the game on Pages, or a file:// copy
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(origin)) return origin;   // local testing
  const extra = String((env && env.EXTRA_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(origin) ? origin : null;
}
function cors(origin) {
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(data, status, origin, extra) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors(origin), extra || {}) });
}
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

// Returns a clean entry or an error string.
export function validate(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'bad body';
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  if (!NAME_RE.test(name)) return 'name must be 1-16 letters, digits, space, _ or -';
  if (!num(b.score, 1, 1e7) || !Number.isInteger(b.score)) return 'bad score';
  if (!num(b.time, 0.1, 36000)) return 'bad time';
  const lured = b.lured === undefined ? 0 : b.lured, webs = b.webs === undefined ? 0 : b.webs, pulses = b.pulses === undefined ? null : b.pulses;
  const empties = b.empties === undefined ? 0 : b.empties;
  if (!num(lured, 0, 1e5) || !Number.isInteger(lured)) return 'bad lured';
  if (!num(webs, 0, 1e6) || !Number.isInteger(webs)) return 'bad webs';
  if (pulses !== null && (!num(pulses, 0, 1e4) || !Number.isInteger(pulses))) return 'bad pulses';
  if (!num(empties, 0, 1e3) || !Number.isInteger(empties)) return 'bad empties';
  const ver = typeof b.ver === 'string' && VER_RE.test(b.ver) ? b.ver : '?';
  // plausibility vs the game's score formula: time*10 + lured*50 + webs(you)*5 + webs(bugs)*2 + pulses*60 + empties*150
  const maxPulses = pulses !== null ? pulses : Math.ceil(b.time / 18) + 1;
  const maxEmpties = empties || Math.ceil(b.time / 50) + 1;
  const lo = Math.floor(b.time * 10) - 2, hi = Math.ceil(b.time * 10) + lured * 50 + webs * 5 + maxPulses * 60 + maxEmpties * 150 + 2;
  if (b.score < lo || b.score > hi) return 'implausible score';
  if (lured > b.time * 5 + 10 || webs > b.time * 20 + 50 || empties > b.time / 40 + 2) return 'implausible stats';
  return { name, score: b.score, time: Math.round(b.time * 10) / 10, lured, webs, ver, at: Date.now() };
}

async function readBoard(env) {
  try { const v = await env.LEADERBOARD.get('board', 'json'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
const sortBoard = list => list.sort((a, b) => b.score - a.score || a.at - b.at);

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = allowedOrigin(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/board' && request.method === 'GET') {
      return json(sortBoard(await readBoard(env)).slice(0, TOP), 200, origin, { 'Cache-Control': 'public, max-age=5' });
    }
    if (url.pathname === '/score' && request.method === 'POST') {
      if (request.headers.get('Origin') && !origin) return json({ ok: false, error: 'origin not allowed' }, 403, null);
      const len = +(request.headers.get('Content-Length') || 0);
      if (len > 1024) return json({ ok: false, error: 'too large' }, 413, origin);
      let body; try { const txt = await request.text(); if (txt.length > 1024) return json({ ok: false, error: 'too large' }, 413, origin); body = JSON.parse(txt); }
      catch (e) { return json({ ok: false, error: 'bad json' }, 400, origin); }
      const e = validate(body);
      if (typeof e === 'string') return json({ ok: false, error: e }, 400, origin);
      // loose per-IP rate limit
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown', rk = 'rl:' + ip;
      const n = parseInt((await env.LEADERBOARD.get(rk)) || '0', 10) || 0;
      if (n >= RL_MAX) return json({ ok: false, error: 'slow down' }, 429, origin, { 'Retry-After': String(RL_WINDOW) });
      await env.LEADERBOARD.put(rk, String(n + 1), { expirationTtl: RL_WINDOW });
      // best score per name (case-insensitive); keep the top 50
      let board = await readBoard(env);
      const key = e.name.toLowerCase(), prev = board.find(x => String(x.name).toLowerCase() === key);
      let changed = false;
      if (!prev) { board.push(e); changed = true; }
      else if (e.score > prev.score) { board = board.filter(x => x !== prev); board.push(e); changed = true; }
      sortBoard(board);
      if (board.length > KEEP) board = board.slice(0, KEEP);
      const stored = board.includes(e);
      if (changed && stored) await env.LEADERBOARD.put('board', JSON.stringify(board));
      const top = board.slice(0, TOP), idx = top.indexOf(e);
      return json({ ok: true, rank: idx >= 0 ? idx + 1 : null, improved: changed && stored, top }, 200, origin);
    }
    return json({ ok: false, error: 'not found' }, 404, origin);
  },
};
