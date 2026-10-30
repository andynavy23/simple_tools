// fun/party-hub.html：同機傳遞一輪、連線三分頁（兩種遊戲）、非法提交、隱藏資訊、重連、房主離開、390px 無橫向溢出
// 連線用「假 PeerJS」：頁面內的 window.Peer 經 node 轉送訊息，不需要網路。
import assert from 'assert';
import { launchEdge, repo } from './lib.mjs';

const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 假網路 ----------
const owner = new Map();      // peerId -> page
const links = new Set();      // "a|b"
const queues = new Map();
const deliver = (page, m) => { if (!page) return; const q = (queues.get(page) || Promise.resolve()).then(() => page.evaluate(x => window.__deliver(x), m)).catch(() => { }); queues.set(page, q); };
const FAKE = () => {
    window.__peers = {};
    class Conn { constructor(p, remote) { this.p = p; this.peer = remote; this.open = false; this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); }
        send(d) { if (this.open) window.__net('send', this.p.id, this.peer, JSON.parse(JSON.stringify(d))); } close() { if (!this.open) return; this.open = false; window.__net('close', this.p.id, this.peer); this.emit('close'); } }
    window.Peer = class { constructor() { this.id = 'p' + Math.random().toString(36).slice(2, 9); this.h = {}; this.conns = {}; window.__peers[this.id] = this; window.__net('open', this.id); setTimeout(() => this.emit('open', this.id), 0); }
        on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); }
        connect(id) { const c = new Conn(this, id); this.conns[id] = c; window.__net('connect', this.id, id).then(ok => { if (!ok) this.emit('error', { type: 'peer-unavailable' }); else { c.open = true; c.emit('open'); } }); return c; }
        destroy() { Object.values(this.conns).forEach(c => c.close()); } };
    window.__deliver = (m) => {
        const p = window.__peers[m.to]; if (!p) return;
        if (m.op === 'incoming') { const c = new Conn(p, m.from); p.conns[m.from] = c; c.open = true; p.emit('connection', c); c.emit('open'); }
        else if (m.op === 'data') { const c = p.conns[m.from]; if (c) c.emit('data', m.d); }
        else if (m.op === 'close') { const c = p.conns[m.from]; if (c && c.open) { c.open = false; c.emit('close'); } }
    };
};
async function net(page, op, a, b, d) {
    if (op === 'open') { owner.set(a, page); return; }
    if (op === 'connect') { const t = owner.get(b); if (!t) return false; links.add(a + '|' + b); deliver(t, { op: 'incoming', to: b, from: a }); return true; }
    if (op === 'send') { deliver(owner.get(b), { op: 'data', to: b, from: a, d }); return; }
    if (op === 'close') { links.delete(a + '|' + b); links.delete(b + '|' + a); deliver(owner.get(b), { op: 'close', to: b, from: a }); }
}
async function makePage() {
    // openPage 直接 goto，來不及注入；先開空白頁、注入後再導覽
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push('例外：' + String(e.message).slice(0, 120)));
    page.on('dialog', d => d.dismiss().catch(() => { }));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(FAKE);
    await page.exposeFunction('__net', (op, a, b, d) => net(page, op, a, b, d));
    page.on('close', () => { for (const [id, p] of owner) if (p === page) { for (const l of [...links]) { const [x, y] = l.split('|'); if (x === id || y === id) { const other = x === id ? y : x; deliver(owner.get(other), { op: 'close', to: other, from: id }); links.delete(l); } } owner.delete(id); } });
    await page.goto('file:///' + repo.replace(/\\/g, '/') + '/fun/party-hub.html#a', { waitUntil: 'load' });
    return { page, errors };
}
const click = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.textContent.includes(t)); if (!b) throw new Error('找不到按鈕：' + t); b.click(); }, text);
const has = (page, text) => page.evaluate((t) => [...document.querySelectorAll('button')].some(x => !x.disabled && x.offsetParent && x.textContent.includes(t)), text);
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const until = (page, fn, arg, t = 8000) => page.waitForFunction(fn, { timeout: t, polling: 50 }, arg);
const overflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
const setVal = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);

// ---------- 同機傳遞：兩真一假 ----------
{
    const { page, errors } = await makePage();
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#kind option').length), 6);
    assert.ok(await overflow(page) <= 0, '選單橫向溢出');
    await setVal(page, '#soloNames', 'A\nB\nC'); await setVal(page, '#kind', 'truths');
    await click(page, '同機傳遞開始');
    await until(page, () => document.querySelector('#coverBtn'));
    assert.ok((await bodyText(page)).includes('請把裝置交給'));
    assert.ok(!(await bodyText(page)).includes('第 1 句'), '換人畫面不該顯示私密內容');
    await click(page, '開始');
    await page.type('input[aria-label="第 1 句"]', '我會游泳'); await page.type('input[aria-label="第 2 句"]', '我去過月球'); await page.type('input[aria-label="第 3 句"]', '我有養貓');
    await page.evaluate(() => document.querySelector('button[aria-label="第 2 句是假的"]').click());
    await click(page, '送出');
    for (let i = 0; i < 2; i++) {
        await until(page, () => document.querySelector('#coverBtn'));
        assert.ok(!(await bodyText(page)).includes('我去過月球'), '換人畫面洩漏');
        await click(page, '開始');
        await page.evaluate(() => document.querySelectorAll('.choices button')[1].click());
        await click(page, '確定');
    }
    await until(page, () => document.querySelector('#status').textContent.includes('揭曉'));
    assert.ok((await bodyText(page)).includes('我去過月球'));
    assert.ok(await overflow(page) <= 0, '揭曉畫面橫向溢出');
    await click(page, '下一輪');
    await until(page, () => document.querySelector('#coverBtn'));
    assert.ok(errors.length === 0, errors.join());
    await page.close();
}
// ---------- 同機傳遞：間諜 ----------
{
    const { page, errors } = await makePage();
    await setVal(page, '#soloNames', 'A\nB\nC\nD'); await setVal(page, '#kind', 'spy');
    await click(page, '同機傳遞開始');
    let roles = [];
    for (let i = 0; i < 4; i++) {
        await until(page, () => document.querySelector('#coverBtn'));
        await click(page, '開始');
        roles.push((await bodyText(page)).includes('你是間諜'));
        assert.ok(await overflow(page) <= 0);
        await click(page, '記住了');
    }
    assert.strictEqual(roles.filter(Boolean).length, 1, '恰好一位間諜');
    await until(page, () => document.querySelector('[data-tm]'));
    await click(page, '提前結束計時');
    for (let i = 0; i < 4; i++) { await until(page, () => document.querySelector('#coverBtn')); await click(page, '開始'); await page.evaluate(() => { const e = document.querySelectorAll('.choices button'); e[0].click(); }); }
    await until(page, () => document.querySelector('#status').textContent.includes('揭曉'));
    assert.ok(/間諜獲勝|平民獲勝/.test(await bodyText(page)));
    assert.ok(errors.length === 0, errors.join());
    await page.close();
}

// ---------- 連線 ----------
const H = await makePage(), B = await makePage(), C = await makePage();
await setVal(H.page, '#nick', '房主'); await setVal(H.page, '#kind', 'truths');
await click(H.page, '建立房間');
await until(H.page, () => room && room.id);
const rid = await H.page.evaluate(() => room.id);
for (const [p, n] of [[B.page, '小乙'], [C.page, '小丙']]) {
    await setVal(p, '#nick', n); await setVal(p, '#joinId', rid); await click(p, '加入');
    await until(p, () => document.querySelector('#lobby') && !document.querySelector('#lobby').hidden);
}
await until(H.page, () => room.players.length === 3);
assert.ok(await H.page.evaluate(() => document.querySelector('#startBtn').disabled), '成員沒準備好不能開始');
for (const p of [B.page, C.page]) await click(p, '我準備好了');
await until(H.page, () => !document.querySelector('#startBtn').disabled);
await click(H.page, '開始遊戲');
const pages = [H.page, B.page, C.page];
for (const p of pages) await until(p, () => cur && cur.v.kind === 'truths');
const seatPages = {}; for (const p of pages) seatPages[await p.evaluate(() => cur.v.me)] = p;
const actorSeat = await H.page.evaluate(() => cur.v.g.actor), AP = seatPages[actorSeat];
const others = Object.entries(seatPages).filter(([s]) => +s !== actorSeat).map(([, p]) => p);
// 非法：非出題者寫、非房主 next / force / end
await others[0].evaluate(() => room.send({ t: 'A', a: { t: 'write', s: ['a', 'b', 'c'], lie: 0, seat: 0 } }));
await until(others[0], () => document.querySelector('#msg').textContent.includes('現在不能'));
for (const [a, txt] of [[{ t: 'next' }, '只有房主'], [{ t: 'force' }, '只有房主'], [{ t: 'end' }, '只有房主']]) {
    await others[1].evaluate((x) => room.send({ t: 'A', a: x }), a);
    await until(others[1], (t) => document.querySelector('#msg').textContent.includes(t), txt);
}
// 房主端狀態不受影響
assert.strictEqual(await H.page.evaluate(() => G.phase), 'write');
await AP.evaluate(() => { D.s = ['我會游泳', '我去過月球', '我有養貓']; D.lie = 1; redraw(); });
await click(AP, '送出');
for (const p of others) await until(p, () => cur.v.phase === 'vote');
// 隱藏資訊：非出題者的 view 不含假句標記
for (const p of others) { assert.strictEqual(await p.evaluate(() => cur.v.g.lie), -1); assert.ok(!(await p.evaluate(() => JSON.stringify(cur.v))).includes('"lie":1')); }
// 偽造：用別人名義投票無效（動作不帶座位，由房主以連線身分決定）
await others[0].evaluate(() => room.send({ t: 'A', a: { t: 'vote', v: 1, seat: 1 } }));
await until(H.page, () => Object.keys(G.votes).length === 1);
await others[0].evaluate(() => room.send({ t: 'A', a: { t: 'vote', v: 0 } }));
await until(others[0], () => document.querySelector('#msg').textContent.includes('已經投過'));
assert.deepStrictEqual(await H.page.evaluate(() => Object.keys(G.votes).length), 1);
await others[1].evaluate(() => go({ t: 'vote', v: 0 }));
for (const p of pages) await until(p, () => cur.v.phase === 'reveal');
assert.ok((await bodyText(others[0])).includes('我去過月球'));
assert.ok(await overflow(others[0]) <= 0, '連線揭曉畫面橫向溢出');
await click(H.page, '下一輪');
for (const p of pages) await until(p, () => cur.v.round === 2);
await H.page.evaluate(() => goCtl({ t: 'end' }));
for (const p of pages) await until(p, () => cur.v.phase === 'over');
assert.ok((await bodyText(B.page)).includes('🏆'));
await click(H.page, '回大廳');
for (const p of [B.page, C.page]) await until(p, () => !document.querySelector('#lobby').hidden && !document.querySelector('#readyBtn').hidden);

// 第二種遊戲：間諜（含承諾驗證）
await setVal(H.page, '#kind', 'spy');
for (const p of [B.page, C.page]) await click(p, '我準備好了');
await until(H.page, () => !document.querySelector('#startBtn').disabled);
await click(H.page, '開始遊戲');
for (const p of pages) await until(p, () => cur && cur.v.kind === 'spy' && cur.v.phase === 'play');
const S2 = {}; for (const p of pages) S2[await p.evaluate(() => cur.v.me)] = p;
const spySeat = await H.page.evaluate(() => G.spy);
for (const [s, p] of Object.entries(S2)) {
    const v = await p.evaluate(() => JSON.stringify(cur.v));
    if (+s === spySeat) assert.ok(JSON.parse(v).g.isSpy && JSON.parse(v).g.li === -1, '間諜不該看到地點');
    else assert.ok(!v.includes('"spy":') && !JSON.parse(v).g.isSpy && JSON.parse(v).g.li >= 0, '平民 view 不該含間諜身分');
}
assert.ok(await overflow(B.page) <= 0, '間諜畫面橫向溢出');
// 重連：小丙離線後以同暱稱回來
await C.page.close();
await until(H.page, () => room.players[2] && !room.players[2].connected);
const C2 = await makePage();
await setVal(C2.page, '#nick', '小丙'); await setVal(C2.page, '#joinId', rid); await click(C2.page, '加入');
await until(C2.page, () => cur && cur.v.kind === 'spy' && cur.v.me === 2);
const hostSpy = spySeat === 0;
const live2 = { 0: H.page, 1: B.page, 2: C2.page };
if (spySeat === 2) {
    // 離線的小丙剛好是間諜：依設計「間諜離線，這局作廢」直接揭曉，不會進入全員投票（原本固定假設小丙不是間諜，所以約 1/3 機率失敗）
    for (const p of Object.values(live2)) await until(p, () => cur.v.phase === 'reveal');
    assert.ok(await B.page.evaluate(() => JSON.stringify(cur.v).includes('作廢')), '間諜離線要標示這局作廢');
} else {
    // 時間到 → 全員投票
    await H.page.evaluate(() => goCtl({ t: 'timeup', force: true }));
    for (const p of Object.values(live2)) await until(p, () => cur.v.phase === 'final');
    for (const [s, p] of Object.entries(live2)) await p.evaluate((t) => go({ t: 'fvote', target: t }), (+s + 1) % 3);
    for (const p of Object.values(live2)) await until(p, () => cur.v.phase === 'reveal');
    await until(B.page, () => document.querySelector('.okmark') && document.querySelector('.okmark').textContent.includes('✓'));
}
// 房主離開
await H.page.close();
await until(B.page, () => !document.querySelector('#closed').hidden);
const errs = [...H.errors, ...B.errors, ...C.errors, ...C2.errors];
assert.ok(errs.length === 0, errs.join());
await browser.close();
