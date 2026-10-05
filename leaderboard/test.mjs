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
const e0 = j.top[0]; ok(['name', 'time', 'score', 'lured', 'webs', 'pulses', 'empties', 'ver', 'at'].every(k => k in e0), 'entry has name/time/score/lured/webs/pulses/empties/ver/at');
ok(e0.time === 120 && e0.score === 1300, 'score kept for display alongside time');
for (let i = 0; i < 60; i++) await call('POST', '/score', good('P' + i, 20 + i * 3));
({ r, j } = await call('GET', '/board'));
ok(j.length === 10 && j.every((x, i) => i === 0 || j[i - 1].time >= x.time), 'GET /board: top 10, sorted by time desc (' + j.map(x => x.time).slice(0, 4).join(',') + '...)');
ok(JSON.parse(store.get('board')).length === 50, 'KV keeps at most 50 entries');
({ j } = await call('POST', '/score', good('Low', 1)));
ok(j.ok && j.rank === null && j.top.length === 10, 'non-top-worthy time: ok, rank null, top 10 returned');
ok(!JSON.parse(store.get('board')).some(x => x.name === 'Low'), 'non-top-worthy time not stored');
({ j } = await call('POST', '/score', good('ben', 100)));
ok(j.ok && j.improved === false && JSON.parse(store.get('board')).filter(x => x.name.toLowerCase() === 'ben').length === 1, 'shorter time for an existing name (case-insensitive) keeps the longest one');
({ j } = await call('POST', '/score', good('ben', 110, { score: 9000, lured: 100 })));
ok(j.ok && j.improved === false && JSON.parse(store.get('board')).find(x => x.name.toLowerCase() === 'ben').time === 120, 'higher SCORE but shorter time does NOT replace (ranking is time)');
({ j } = await call('POST', '/score', good('Ben', 400)));
ok(j.ok && j.rank === 1 && j.top.filter(x => x.name.toLowerCase() === 'ben').length === 1 && j.top[0].time === 400, 'longer time replaces the old one for that name (rank ' + j.rank + ')');
// time beats score: a long, low-score run outranks a short, high-score run
({ j } = await call('POST', '/score', good('Tank', 500, { score: 5000, lured: 0, webs: 0, pulses: 0 })));
({ j } = await call('POST', '/score', good('Flash', 450, { score: 30000, lured: 300, webs: 500, pulses: 25 })));
const iT = j.top.findIndex(x => x.name === 'Tank'), iF = j.top.findIndex(x => x.name === 'Flash');
ok(iT === 0 && iF === 1 && j.rank === 2, 'longer survival ranks above a higher score (Tank #' + (iT + 1) + ', Flash #' + (iF + 1) + ')');
// score plausibility is soft: implausible / missing / malformed score is accepted, ranked by time, score stored as null
for (const [n, b] of [['implausible score', good('Soft1', 300, { score: 9999999 })], ['score below time*10', good('Soft2', 301, { score: 100 })],
  ['missing score', good('Soft3', 302, { score: undefined })], ['string score', good('Soft4', 303, { score: '900' })], ['float score', good('Soft5', 304, { score: 600.5 })]]) {
  ({ r, j } = await call('POST', '/score', b)); const me = j && j.top && j.top.find(x => x.name === b.name);
  ok(r.status === 200 && j.ok && j.rank !== null && me && me.score === null && me.time === b.time, 'soft-accepts ' + n + ' (rank ' + (j && j.rank) + ', score null)');
}

const bad = [['empty name', good('', 50)], ['long name', good('x'.repeat(17), 50)], ['emoji/html name', good('<b>hi</b>', 50)], ['zero time', good('A', 50, { time: 0 })], ['NaN-ish time', good('A', 50, { time: 'x' })], ['missing time', good('A', 50, { time: undefined })],
  ['huge time', good('A', 50, { time: 99999 })], ['negative lured', good('A', 50, { lured: -1 })], ['implausible stats', good('A', 5, { webs: 99999 })]];
for (const [n, b] of bad) { ({ r, j } = await call('POST', '/score', b)); ok(r.status === 400 && j && j.ok === false, 'rejects ' + n + ' (' + (j && j.error) + ')'); }
({ r } = await call('POST', '/score', '{not json')); ok(r.status === 400, 'rejects bad JSON');
({ r } = await call('POST', '/score', JSON.stringify(good('A', 50)) + ' '.repeat(2000))); ok(r.status === 413, 'rejects oversized body');
({ r } = await call('POST', '/score', [1, 2])); ok(r.status === 400, 'rejects arrays');
({ r } = await call('GET', '/nope')); ok(r.status === 404, '404 for unknown paths');
// rate limit: same IP
let codes = []; for (let i = 0; i < 8; i++) { const rr = await worker.fetch(new Request('https://x/score', { method: 'POST', body: JSON.stringify(good('Spam' + i, 30)), headers: { Origin: O, 'CF-Connecting-IP': '9.9.9.9' } }), env); codes.push(rr.status); }
ok(codes.slice(0, 6).every(c => c === 200) && codes[6] === 429 && codes[7] === 429, 'rate limit: 6 per IP per minute, then 429 (' + codes.join(',') + ')');
ok(typeof validate({ name: 'Ok Name_1-2', score: 600, time: 50, lured: 0, webs: 0, ver: '0.18.0' }) === 'object', 'validate accepts a normal run without pulses');
ok(validate({ name: 'NoScore', time: 42.36 }).time === 42.4 && validate({ name: 'NoScore', time: 42.36 }).score === null, 'validate: time-only run OK (time rounded to 0.1 s, score null)');
console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
