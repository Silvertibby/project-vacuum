// Offline unit test for the Worker with an in-memory KV mock (no Cloudflare account needed): node test.mjs
import worker, { validate } from './src/index.js';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const store = new Map();
const env = { EXTRA_ORIGINS: '', LEADERBOARD: {
  async get(k, t) { const v = store.has(k) ? store.get(k) : null; return v !== null && t === 'json' ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); } } };
const O = 'https://silvertibby.github.io';
let ipN = 0;
const req = (method, path, body, headers = {}) => new Request('https://lb.example.workers.dev' + path, { method, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  headers: Object.assign({ Origin: O, 'CF-Connecting-IP': '10.0.0.' + (ipN++ % 250), 'Content-Type': 'text/plain' }, headers) });
const call = async (...a) => { const r = await worker.fetch(req(...a), env); let j = null; try { j = await r.clone().json(); } catch (e) {} return { r, j }; };
const good = (name, time, extra = {}) => Object.assign({ name, score: Math.floor(time * 10) + 100, time, lured: 2, webs: 10, ver: '0.18.0', pulses: 2 }, extra);

let { r, j } = await call('GET', '/board');
ok(r.status === 200 && Array.isArray(j) && j.length === 0, 'empty board is []');
ok(r.headers.get('Access-Control-Allow-Origin') === O, 'CORS allows the Pages origin');
({ r } = await call('OPTIONS', '/score', undefined, { 'Access-Control-Request-Method': 'POST' }));
ok(r.status === 204 && r.headers.get('Access-Control-Allow-Methods').includes('POST'), 'preflight OK');
for (const o of ['null', 'http://localhost:8080', 'http://127.0.0.1:5500']) { ({ r } = await call('GET', '/board', undefined, { Origin: o })); ok(r.headers.get('Access-Control-Allow-Origin') === o, 'CORS allows ' + o); }
({ r } = await call('GET', '/board', undefined, { Origin: 'https://evil.example' })); ok(!r.headers.get('Access-Control-Allow-Origin'), 'no CORS header for other origins');
({ r } = await call('POST', '/score', good('Mallory', 50), { Origin: 'https://evil.example' })); ok(r.status === 403, 'POST from another origin rejected (403)');

({ r, j } = await call('POST', '/score', good('Ben', 120)));
ok(r.status === 200 && j.ok && j.rank === 1 && j.top.length === 1 && j.top[0].name === 'Ben', 'first score accepted, rank 1');
const e0 = j.top[0]; ok(['name', 'score', 'time', 'lured', 'webs', 'ver', 'at'].every(k => k in e0), 'entry has name/score/time/lured/webs/ver/at');
for (let i = 0; i < 60; i++) await call('POST', '/score', good('P' + i, 20 + i * 3));
({ r, j } = await call('GET', '/board'));
ok(j.length === 10 && j.every((x, i) => i === 0 || j[i - 1].score >= x.score), 'GET /board: top 10, sorted by score desc (' + j.map(x => x.score).slice(0, 4).join(',') + '...)');
ok(JSON.parse(store.get('board')).length === 50, 'KV keeps at most 50 entries');
({ j } = await call('POST', '/score', good('Low', 1)));
ok(j.ok && j.rank === null && j.top.length === 10, 'non-top-worthy score: ok, rank null, top 10 returned');
ok(!JSON.parse(store.get('board')).some(x => x.name === 'Low'), 'non-top-worthy score not stored');
({ j } = await call('POST', '/score', good('ben', 100)));
ok(j.ok && j.improved === false && JSON.parse(store.get('board')).filter(x => x.name.toLowerCase() === 'ben').length === 1, 'lower score for an existing name (case-insensitive) keeps the best one');
({ j } = await call('POST', '/score', good('Ben', 400)));
ok(j.ok && j.rank === 1 && j.top.filter(x => x.name.toLowerCase() === 'ben').length === 1, 'higher score replaces the old one for that name (rank ' + j.rank + ')');

const bad = [['empty name', good('', 50)], ['long name', good('x'.repeat(17), 50)], ['emoji/html name', good('<b>hi</b>', 50)], ['negative score', good('A', 50, { score: -5 })],
  ['string score', good('A', 50, { score: '900' })], ['float score', good('A', 50, { score: 600.5 })], ['zero time', good('A', 50, { time: 0 })], ['NaN-ish time', good('A', 50, { time: 'x' })],
  ['huge score', good('A', 50, { score: 9999999 })], ['score below time*10', good('A', 50, { score: 100 })], ['negative lured', good('A', 50, { lured: -1 })]];
for (const [n, b] of bad) { ({ r, j } = await call('POST', '/score', b)); ok(r.status === 400 && j && j.ok === false, 'rejects ' + n + ' (' + (j && j.error) + ')'); }
({ r } = await call('POST', '/score', '{not json')); ok(r.status === 400, 'rejects bad JSON');
({ r } = await call('POST', '/score', JSON.stringify(good('A', 50)) + ' '.repeat(2000))); ok(r.status === 413, 'rejects oversized body');
({ r } = await call('POST', '/score', [1, 2])); ok(r.status === 400, 'rejects arrays');
({ r } = await call('GET', '/nope')); ok(r.status === 404, '404 for unknown paths');
// rate limit: same IP
let codes = []; for (let i = 0; i < 8; i++) { const rr = await worker.fetch(new Request('https://x/score', { method: 'POST', body: JSON.stringify(good('Spam' + i, 30)), headers: { Origin: O, 'CF-Connecting-IP': '9.9.9.9' } }), env); codes.push(rr.status); }
ok(codes.slice(0, 6).every(c => c === 200) && codes[6] === 429 && codes[7] === 429, 'rate limit: 6 per IP per minute, then 429 (' + codes.join(',') + ')');
ok(typeof validate({ name: 'Ok Name_1-2', score: 600, time: 50, lured: 0, webs: 0, ver: '0.18.0' }) === 'object', 'validate accepts a normal run without pulses');
console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
