// fun/party-hub.html 狼人殺 / 阿瓦隆：同機傳遞各走完一局、連線 6 分頁各走完一局（含隱藏資訊、非法動作、承諾核對）
// 機器人只看自己的 view（cur.v）決定動作，與座位 / 角色無關，沒有隨機分支。連線用假 PeerJS（同 party-hub.mjs）。
import assert from 'assert';
import { launchEdge, repo } from './lib.mjs';

const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const owner = new Map(), links = new Set(), queues = new Map();
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
// 頁內機器人：只看 cur.v；有動作回傳 true
const BOT = () => {
    window.__bot = () => {
        const v = cur && cur.v, o = cur && cur.o; if (!v || !o) return false;
        const g = v.g, me = v.me, ph = v.phase, first = (f) => v.names.map((_, i) => i).find(f);
        if (o.look) { S.look.shift(); S.shown = false; soloDraw(); return true; }
        const gate = (ph === 'day' || ph === 'vres' || ph === 'tres' || ph === 'mres');
        if (gate) { if (me === 0 || o.solo) { goCtl({ t: 'go' }); return true; } return false; }
        if (me < 0) return false;
        if (v.kind === 'wolf') {
            const al = (i) => g.alive[i];
            if (ph === 'hunter') { if (me !== g.hunter) return false; go({ t: 'shoot', target: first(i => al(i) && i !== me) }); return true; }
            if (!al(me)) return false;
            if (ph === 'night') {
                if (g.role === 'wolf') { if (me in g.nv) return false; go({ t: 'kill', target: first(i => al(i) && !g.mates.includes(i)) }); return true; }
                if (g.role === 'seer') { if (g.sk) { if (g.sk.ack) return false; go({ t: 'ack' }); return true; } go({ t: 'check', target: first(i => al(i) && i !== me) }); return true; }
                if (o.solo) { go({ t: 'sleep' }); return true; } return false;
            }
            if (ph === 'witch') {
                if (g.w) { go({ t: 'witch', save: g.w.victim >= 0 && g.w.heal > 0, poison: -1 }); return true; }
                if (o.solo) { go({ t: 'sleep' }); return true; } return false;
            }
            if (ph === 'vote') { if (g.mine !== -2) return false; go({ t: 'vote', target: first(i => al(i) && i !== me) }); return true; }
            return false;
        }
        if (ph === 'team') { if (me !== g.leader) return false; go({ t: 'team', seats: [...Array(g.tsize).keys()] }); return true; }
        if (ph === 'tvote') { if (g.mine !== null) return false; go({ t: 'tvote', y: true }); return true; }
        if (ph === 'mission') { if (!g.team.includes(me) || g.played) return false; go({ t: 'card', fail: false }); return true; }
        if (ph === 'assassin') { if (g.role !== 'assassin') return false; go({ t: 'stab', target: first(i => i !== me) }); return true; }
        return false;
    };
};
async function makePage() {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push('例外：' + String(e.message).slice(0, 120)));
    page.on('dialog', d => d.dismiss().catch(() => { }));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(FAKE);
    await page.exposeFunction('__net', (op, a, b, d) => net(page, op, a, b, d));
    page.on('close', () => { for (const [id, p] of owner) if (p === page) { for (const l of [...links]) { const [x, y] = l.split('|'); if (x === id || y === id) { const other = x === id ? y : x; deliver(owner.get(other), { op: 'close', to: other, from: id }); links.delete(l); } } owner.delete(id); } });
    await page.goto('file:///' + repo.replace(/\\/g, '/') + '/fun/party-hub.html#a', { waitUntil: 'load' });
    await page.evaluate(BOT);
    return { page, errors };
}
const click = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent && x.textContent.includes(t)); if (!b) throw new Error('找不到按鈕：' + t); b.click(); }, text);
const until = (page, fn, arg, t = 10000) => page.waitForFunction(fn, { timeout: t, polling: 50 }, arg);
const overflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
const setVal = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const phaseOf = (p) => p.evaluate(() => (cur ? cur.v.phase : ''));

// ---------- 同機傳遞 ----------
async function solo(kind, names, win) {
    const { page, errors } = await makePage();
    await setVal(page, '#soloNames', names.join('\n')); await setVal(page, '#kind', kind);
    await click(page, '同機傳遞開始');
    let covers = 0;
    for (let i = 0; i < 900; i++) {
        if (await page.evaluate(() => /獲勝/.test(document.body.innerText) && cur && cur.v.phase === 'reveal')) break;
        if (await page.evaluate(() => !!document.querySelector('#coverBtn'))) {
            const t = await page.evaluate(() => document.body.innerText);
            assert.ok(!/狼人|預言家|女巫|獵人|梅林|刺客|派西維爾/.test(t.replace(/狼人殺/g, '')), '換人畫面洩漏身分');
            await click(page, '開始'); covers++; continue;
        }
        await page.evaluate(() => window.__bot());
    }
    assert.ok(await page.evaluate(() => cur && cur.v.phase === 'reveal'), kind + ' 單機沒有走完');
    assert.ok(win.test(await page.evaluate(() => document.body.innerText)));
    assert.ok(covers >= names.length * 2, '每人至少看一次身分與行動：' + covers);
    assert.ok(await overflow(page) <= 0, kind + ' 單機結果橫向溢出');
    await click(page, '看最終結果');
    await until(page, () => cur && cur.v.phase === 'over');
    assert.ok(errors.length === 0, errors.join());
    await page.close();
}
await solo('wolf', ['A', 'B', 'C', 'D', 'E', 'F', 'G'], /狼人獲勝|好人獲勝/);
await solo('avalon', ['A', 'B', 'C', 'D', 'E', 'F'], /壞人獲勝|好人獲勝/);

// ---------- 連線：6 分頁，先狼人殺再阿瓦隆 ----------
const NAMES = ['房主', '小乙', '小丙', '小丁', '小戊', '小己'];
const P = []; for (let i = 0; i < 6; i++) P.push(await makePage());
const pages = P.map(x => x.page), H = pages[0];
await setVal(H, '#nick', NAMES[0]); await setVal(H, '#kind', 'wolf');
await click(H, '建立房間');
await until(H, () => room && room.id);
const rid = await H.evaluate(() => room.id);
for (let i = 1; i < 6; i++) { await setVal(pages[i], '#nick', NAMES[i]); await setVal(pages[i], '#joinId', rid); await click(pages[i], '加入'); await until(pages[i], () => document.querySelector('#lobby') && !document.querySelector('#lobby').hidden); }
await until(H, () => room.players.length === 6);
const readyAll = async () => { for (const p of pages.slice(1)) { await until(p, () => !document.querySelector('#readyBtn').hidden); if (await p.evaluate(() => document.querySelector('#readyBtn').textContent.includes('我準備好了'))) await click(p, '我準備好了'); } await until(H, () => !document.querySelector('#startBtn').disabled); };
const drive = async (kind) => {
    for (let i = 0; i < 700; i++) {
        const ph = await Promise.all(pages.map(phaseOf));
        if (ph.every(x => x === 'reveal')) return;
        for (const p of pages) await p.evaluate(() => window.__bot());
        await sleep(40);
    }
    throw new Error(kind + ' 連線沒有走完：' + (await Promise.all(pages.map(phaseOf))).join());
};
const finish = async () => {
    await until(pages[1], () => document.querySelector('.okmark') && document.querySelector('.okmark').textContent.includes('✓'));
    assert.ok(await overflow(pages[1]) <= 0, '連線結果橫向溢出');
    await click(H, '看最終結果');
    for (const p of pages) await until(p, () => cur.v.phase === 'over');
    await click(H, '回大廳');
    for (const p of pages.slice(1)) await until(p, () => !document.querySelector('#lobby').hidden && !document.querySelector('#readyBtn').hidden);
};

// 狼人殺
await readyAll(); await click(H, '開始遊戲');
for (const p of pages) await until(p, () => cur && cur.v.kind === 'wolf' && cur.v.phase === 'night');
{
    const roles = await H.evaluate(() => G.role.slice());
    for (let s = 0; s < 6; s++) {
        const raw = await pages[s].evaluate(() => JSON.stringify(cur.v)), v = JSON.parse(raw), sees = v.me;
        assert.strictEqual(v.g.role, roles[v.me]);
        assert.ok(!raw.includes(roles.join(',')), '別人的角色分配洩漏');
        assert.deepStrictEqual(v.g.mates, roles[v.me] === 'wolf' ? roles.map((r, i) => (r === 'wolf' ? i : -1)).filter(i => i >= 0) : [], '狼同伴資訊');
        assert.deepStrictEqual(v.pend, [], '夜晚不該公開誰還沒行動');
    }
    // 非法：好人殺人
    const vs = await Promise.all(pages.map(p => p.evaluate(() => cur.v.me)));
    const villager = pages[vs.findIndex((s, i) => s > 0 && roles[s] !== 'wolf' && roles[s] !== 'seer')];
    await villager.evaluate(() => room.send({ t: 'A', a: { t: 'kill', target: 0 } }));
    await until(villager, () => document.querySelector('#msg').textContent.includes('現在不能'));
    assert.strictEqual(await H.evaluate(() => Object.keys(G.nv).length), 0);
}
await drive('狼人殺');
assert.ok(/狼人獲勝|好人獲勝/.test(await pages[2].evaluate(() => document.body.innerText)));
await finish();

// 阿瓦隆（同一批 6 人）
await setVal(H, '#kind', 'avalon'); await setVal(H, '#o_mordred', 'on');
await readyAll(); await click(H, '開始遊戲');
for (const p of pages) await until(p, () => cur && cur.v.kind === 'avalon' && cur.v.phase === 'team');
{
    const roles = await H.evaluate(() => G.role.slice());
    for (let s = 0; s < 6; s++) {
        const raw = await pages[s].evaluate(() => JSON.stringify(cur.v)), v = JSON.parse(raw);
        assert.ok(!raw.includes(roles.join(',')), '角色分配洩漏');
        const want = await H.evaluate((x) => avSees(G.role, x), v.me);
        assert.deepStrictEqual(v.g.sees, want, '可見資訊與規則不符');
        assert.strictEqual(v.g.role, roles[v.me]);
    }
    // 非法：好人出失敗牌（先讓隊伍成形）、非隊長組隊
    const vs = await Promise.all(pages.map(p => p.evaluate(() => cur.v.me)));
    const leader = await H.evaluate(() => G.leader), nonLeader = pages[vs.findIndex(s => s !== leader && s > 0)];
    await nonLeader.evaluate(() => room.send({ t: 'A', a: { t: 'team', seats: [0, 1] } }));
    await until(nonLeader, () => document.querySelector('#msg').textContent.includes('現在不能'));
    assert.strictEqual(await H.evaluate(() => G.phase), 'team');
    // 隊長組隊 → 全員贊成 → 房主繼續 → 好人出失敗牌被拒
    await pages[vs.indexOf(leader)].evaluate(() => window.__bot());
    for (const p of pages) await until(p, () => cur.v.phase === 'tvote');
    for (const p of pages) await p.evaluate(() => window.__bot());
    for (const p of pages) await until(p, () => cur.v.phase === 'tres');
    assert.ok(await overflow(pages[1]) <= 0, '阿瓦隆畫面橫向溢出');
    await H.evaluate(() => goCtl({ t: 'go' }));
    for (const p of pages) await until(p, () => cur.v.phase === 'mission');
    const goodMember = await H.evaluate(() => G.team.find(s => !isEvil(G.role[s])));
    if (goodMember != null) {
        const gp = pages[vs.indexOf(goodMember)];
        if (goodMember > 0) { await gp.evaluate(() => room.send({ t: 'A', a: { t: 'card', fail: true } })); await until(gp, () => document.querySelector('#msg').textContent.includes('好人只能出成功')); }
        else assert.ok(await H.evaluate(() => act(G, 0, { t: 'card', fail: true }, ctx())) === '好人只能出成功牌');
    }
}
await drive('阿瓦隆');
assert.ok(/壞人獲勝|好人獲勝/.test(await pages[2].evaluate(() => document.body.innerText)));
await finish();

const errs = P.flatMap(x => x.errors); assert.ok(errs.length === 0, errs.join());
await browser.close();
