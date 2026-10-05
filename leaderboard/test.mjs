// Offline unit test for the Worker with an in-memory KV mock (no Cloudflare account needed): node test.mjs
import worker, { validate, validateReplay } from './src/index.js';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const store = new Map();
const env = { EXTRA_ORIGINS: '', LEADERBOARD: {
  async get(k, t) { const v = store.has(k) ? store.get(k) : null; return v !== null && t === 'json' ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); } } };
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
({ r } = await call('POST', '/score', JSON.stringify(good('A', 50)) + ' '.repeat(110 * 1024))); ok(r.status === 413, 'rejects oversized body (> 100 KB)');
({ r } = await call('POST', '/score', [1, 2])); ok(r.status === 400, 'rejects arrays');
({ r } = await call('GET', '/nope')); ok(r.status === 404, '404 for unknown paths');
// rate limit: same IP
let codes = []; for (let i = 0; i < 8; i++) { const rr = await worker.fetch(new Request('https://x/score', { method: 'POST', body: JSON.stringify(good('Spam' + i, 30)), headers: { Origin: O, 'CF-Connecting-IP': '9.9.9.9' } }), env); codes.push(rr.status); }
ok(codes.slice(0, 6).every(c => c === 200) && codes[6] === 429 && codes[7] === 429, 'rate limit: 6 per IP per minute, then 429 (' + codes.join(',') + ')');
ok(typeof validate({ name: 'Ok Name_1-2', score: 600, time: 50, lured: 0, webs: 0, ver: '0.18.0' }) === 'object', 'validate accepts a normal run without pulses');
ok(validate({ name: 'NoScore', time: 42.36 }).time === 42.4 && validate({ name: 'NoScore', time: 42.36 }).score === null, 'validate: time-only run OK (time rounded to 0.1 s, score null)');

// ---- v0.20 replays: kept only for the Top 5 (separate KV key per entry), GET /board carries ids only ----
store.clear();
const rp = (time, extra = {}) => Object.assign({ v: 1, ver: '0.20.0', hz: 60, seed: 123456789, w: 760, h: 540, tm: 0, n: Math.round(time * 60), t: time, full: 1, d: Buffer.from('replay-log-' + time).toString('base64') }, extra);
const withR = (name, time, extra = {}) => good(name, time, { ver: '0.20.0', replay: rp(time, extra) });
const rKeys = () => [...store.keys()].filter(k => k.startsWith('replay:'));
({ r, j } = await call('POST', '/score', withR('R1', 100)));
const rid1 = j.top[0].rid;
ok(j.ok && j.rank === 1 && j.replaySaved === true && typeof rid1 === 'string' && store.has('replay:' + rid1), 'replay saved for a Top-5 run (rid ' + rid1 + ')');
ok(!('replay' in j.top[0]) && !JSON.parse(store.get('board'))[0].replay && !store.get('board').includes('replay-log'), 'board stores only the rid, not the replay body');
({ r, j } = await call('GET', '/replay/' + rid1));
ok(r.status === 200 && j.seed === 123456789 && j.n === 6000 && j.d === rp(100).d && j.v === 1, 'GET /replay/<rid> returns the stored replay');
({ r, j } = await call('GET', '/board')); ok(j[0].rid === rid1 && !('d' in j[0]), 'GET /board lists the rid (no replay body)');
({ r } = await call('GET', '/replay/zzzzzzzzzz')); ok(r.status === 404, 'unknown replay id -> 404');
({ r } = await call('GET', '/replay/..%2Fboard')); ok(r.status === 400, 'malformed replay id -> 400');
for (let i = 2; i <= 5; i++) await call('POST', '/score', withR('R' + i, 100 + i * 10));
ok(rKeys().length === 5 && JSON.parse(store.get('board')).filter(x => x.rid).length === 5, '5 Top-5 runs -> 5 replay keys');
({ j } = await call('POST', '/score', withR('R6', 500)));
let bd = JSON.parse(store.get('board')); const r1 = bd.find(x => x.name === 'R1');
ok(j.rank === 1 && j.replaySaved && bd.indexOf(r1) === 5 && !r1.rid && !store.has('replay:' + rid1) && rKeys().length === 5, 'run pushed to rank 6 loses its replay (key deleted, rid removed)');
({ j } = await call('POST', '/score', withR('R7', 50)));
ok(j.ok && j.rank === 7 && j.replaySaved === false && !j.top[6].rid && rKeys().length === 5, 'a run that lands at rank 7 is stored without a replay');
const oldRid = JSON.parse(store.get('board')).find(x => x.name === 'R3').rid;
({ j } = await call('POST', '/score', withR('r3', 600)));
bd = JSON.parse(store.get('board'));
ok(j.rank === 1 && j.replaySaved && bd[0].rid && bd[0].rid !== oldRid && !store.has('replay:' + oldRid) && rKeys().length === 5, 'longer run under the same name replaces its replay (old key deleted)');
({ j } = await call('POST', '/score', withR('R3', 590)));
ok(j.ok && j.improved === false && j.replaySaved === false && rKeys().length === 5, 'shorter run under an existing name: replay ignored');
({ j } = await call('POST', '/score', good('NoRp', 700)));
ok(j.ok && j.rank === 1 && j.replaySaved === false && !j.top[0].rid && rKeys().length === 4, 'Top-1 run without a replay is fine (and pushes one replay out)');
for (const [n, x, idx] of [['bad base64', { d: 'not base64!!' }], ['n vs time mismatch', { n: 60 }], ['wrong version', { v: 2 }], ['oversized log', { d: 'A'.repeat(90004) }], ['bad seed', { seed: -1 }]].map((v, i) => [v[0], v[1], i])) {
  ({ r, j } = await call('POST', '/score', withR('Bad' + idx, 800 + idx * 5, x)));
  ok(r.status === 200 && j.ok && j.rank === 1 && j.replaySaved === false && !j.top[0].rid, 'invalid replay (' + n + ') dropped, score still accepted');
}
ok(rKeys().length === JSON.parse(store.get('board')).slice(0, 5).filter(x => x.rid).length && JSON.parse(store.get('board')).slice(5).every(x => !x.rid), 'invariant: replay keys == rids in the Top 5, none below');
({ r, j } = await call('POST', '/score', withR('Big', 900, { d: 'A'.repeat(88000), n: 54000 })));
ok(r.status === 200 && j.replaySaved === true, 'an ~88 KB replay body is accepted');
ok(validateReplay(rp(10), 10) && validateReplay(rp(10), 12) === null && validateReplay(null, 1) === null, 'validateReplay basics');

console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
