// Project Vacuum leaderboard Worker.
// Ranking = SURVIVAL TIME (longest first). Score and the other stats are stored for display only.
//   GET  /board        -> top 10 [{name, time, score, lured, webs, pulses, empties, ver, at[, rid]}] sorted by time desc (rid = replay id, Top 5 only)
//   POST /score        -> body JSON {name, time, score, lured, webs, ver[, pulses, empties, replay]} -> {ok, rank, improved, replaySaved, top}
//   GET  /replay/<rid> -> the stored replay JSON (v0.20: kept only while that entry is in the Top 5)
// Storage: KV key "board" holding up to 50 entries (longest time per name), one "replay:<rid>" key per Top-5 entry that sent a replay,
// plus short-lived "rl:<ip>" rate-limit keys. Replays of entries pushed to rank 6+ (or replaced by a longer run under that name) are deleted.
// Free-tier friendly: GET /board = 1 KV read; POST = 1-2 reads + 1-2 writes (+1 replay write, + a delete per replay that drops out of the Top 5).

const KEEP = 50, TOP = 10, REPLAY_TOP = 5;
const MAX_BODY = 100 * 1024, REPLAY_MAX_D = 90000;   // base64 replay log cap (~66 KB binary; the game stops logging at 60 KB)
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/, RID_RE = /^[a-z0-9]{6,32}$/;
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

// Returns a clean entry or an error string. `time` (seconds survived) is the ranking key and is the only required stat.
// `score` is optional display data: a malformed or implausible score is a SOFT failure (stored as null), never a rejection.
export function validate(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'bad body';
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  if (!NAME_RE.test(name)) return 'name must be 1-16 letters, digits, space, _ or -';
  if (!num(b.time, 0.1, 36000)) return 'bad time';
  const lured = b.lured === undefined ? 0 : b.lured, webs = b.webs === undefined ? 0 : b.webs, pulses = b.pulses === undefined ? null : b.pulses;
  const empties = b.empties === undefined ? 0 : b.empties;
  if (!num(lured, 0, 1e5) || !Number.isInteger(lured)) return 'bad lured';
  if (!num(webs, 0, 1e6) || !Number.isInteger(webs)) return 'bad webs';
  if (pulses !== null && (!num(pulses, 0, 1e4) || !Number.isInteger(pulses))) return 'bad pulses';
  if (!num(empties, 0, 1e3) || !Number.isInteger(empties)) return 'bad empties';
  const ver = typeof b.ver === 'string' && VER_RE.test(b.ver) ? b.ver : '?';
  if (lured > b.time * 5 + 10 || webs > b.time * 20 + 50 || empties > b.time / 40 + 2) return 'implausible stats';
  // soft score check vs the game's formula: time*10 + lured*50 + webs(you)*5 + webs(bugs)*2 + pulses*60 + empties*150
  let score = null;
  if (num(b.score, 1, 1e7) && Number.isInteger(b.score)) {
    const maxPulses = pulses !== null ? pulses : Math.ceil(b.time / 18) + 1;
    const maxEmpties = empties || Math.ceil(b.time / 50) + 1;
    const lo = Math.floor(b.time * 10) - 2, hi = Math.ceil(b.time * 10) + lured * 50 + webs * 5 + maxPulses * 60 + maxEmpties * 150 + 2;
    if (b.score >= lo && b.score <= hi) score = b.score;
  }
  return { name, time: Math.round(b.time * 10) / 10, score, lured, webs, pulses, empties, ver, at: Date.now() };
}

// Optional replay blob from the game (see prototype/game.js 'replay recording'). Returns a clean object or null (a bad replay never rejects the score).
export function validateReplay(r, time) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.v !== 1) return null;
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(r.seed, 0, 4294967295) || !int(r.hz, 30, 240) || !int(r.w, 80, 10000) || !int(r.h, 80, 10000) || !int(r.tm, 0, 1) || !int(r.full, 0, 1)) return null;
  if (!int(r.n, 1, 36000 * r.hz) || typeof r.d !== 'string' || !r.d.length || r.d.length > REPLAY_MAX_D || r.d.length % 4 || !B64_RE.test(r.d)) return null;
  if (Math.abs(r.n / r.hz - time) > 1) return null;                   // the log must cover the submitted survival time
  return { v: 1, ver: typeof r.ver === 'string' && VER_RE.test(r.ver) ? r.ver : '?', hz: r.hz, seed: r.seed, w: r.w, h: r.h, tm: r.tm, n: r.n, t: num(r.t, 0, 36001) ? r.t : +(r.n / r.hz).toFixed(2), full: r.full, d: r.d };
}
const newRid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8).padEnd(6, '0');

async function readBoard(env) {
  try { const v = await env.LEADERBOARD.get('board', 'json'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
const tOf = x => (x && typeof x.time === 'number' && Number.isFinite(x.time) ? x.time : 0);
const sortBoard = list => list.sort((a, b) => tOf(b) - tOf(a) || (a.at || 0) - (b.at || 0)); // longest survival first; ties: earliest run

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = allowedOrigin(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/board' && request.method === 'GET') {
      return json(sortBoard(await readBoard(env)).slice(0, TOP), 200, origin, { 'Cache-Control': 'public, max-age=5' });
    }
    if (url.pathname.startsWith('/replay/') && request.method === 'GET') {
      const rid = url.pathname.slice(8);
      if (!RID_RE.test(rid)) return json({ ok: false, error: 'bad id' }, 400, origin);
      const txt = await env.LEADERBOARD.get('replay:' + rid);
      if (!txt) return json({ ok: false, error: 'no replay' }, 404, origin);
      return new Response(txt, { status: 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }, cors(origin)) });
    }
    if (url.pathname === '/score' && request.method === 'POST') {
      if (request.headers.get('Origin') && !origin) return json({ ok: false, error: 'origin not allowed' }, 403, null);
      const len = +(request.headers.get('Content-Length') || 0);
      if (len > MAX_BODY) return json({ ok: false, error: 'too large' }, 413, origin);
      let body; try { const txt = await request.text(); if (txt.length > MAX_BODY) return json({ ok: false, error: 'too large' }, 413, origin); body = JSON.parse(txt); }
      catch (e) { return json({ ok: false, error: 'bad json' }, 400, origin); }
      const e = validate(body);
      if (typeof e === 'string') return json({ ok: false, error: e }, 400, origin);
      // loose per-IP rate limit
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown', rk = 'rl:' + ip;
      const n = parseInt((await env.LEADERBOARD.get(rk)) || '0', 10) || 0;
      if (n >= RL_MAX) return json({ ok: false, error: 'slow down' }, 429, origin, { 'Retry-After': String(RL_WINDOW) });
      await env.LEADERBOARD.put(rk, String(n + 1), { expirationTtl: RL_WINDOW });
      // longest time per name (case-insensitive); keep the top 50
      let board = await readBoard(env);
      const oldRids = board.map(x => x.rid).filter(Boolean);
      const key = e.name.toLowerCase(), prev = board.find(x => String(x.name).toLowerCase() === key);
      let changed = false;
      if (!prev) { board.push(e); changed = true; }
      else if (e.time > tOf(prev)) { board = board.filter(x => x !== prev); board.push(e); changed = true; }
      sortBoard(board);
      if (board.length > KEEP) board = board.slice(0, KEEP);
      const stored = board.includes(e);
      let replaySaved = false;
      if (changed && stored) {
        // replays: only the Top 5 keep one (stored under its own key so GET /board stays light); ranks 6+ lose theirs
        const rp = body.replay !== undefined && board.indexOf(e) < REPLAY_TOP ? validateReplay(body.replay, e.time) : null;
        if (rp) { e.rid = newRid(); await env.LEADERBOARD.put('replay:' + e.rid, JSON.stringify(rp)); replaySaved = true; }
        board.forEach((x, i) => { if (i >= REPLAY_TOP && x.rid) delete x.rid; });
        await env.LEADERBOARD.put('board', JSON.stringify(board));
        const keep = new Set(board.map(x => x.rid).filter(Boolean));
        for (const rid of oldRids) if (!keep.has(rid)) { try { await env.LEADERBOARD.delete('replay:' + rid); } catch (err) {} }
      }
      const top = board.slice(0, TOP), idx = top.indexOf(e);
      return json({ ok: true, rank: idx >= 0 ? idx + 1 : null, improved: changed && stored, replaySaved, top }, 200, origin);
    }
    return json({ ok: false, error: 'not found' }, 404, origin);
  },
};
