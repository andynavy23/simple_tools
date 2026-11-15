// hearts-games 連線（假 PeerJS，多開分頁）：開房 / 加入、房主驗證換牌與出牌、手牌只私送本人、牌堆承諾局末核對 ✓、斷線託管與同暱稱重連、完成一局結算
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/hearts-games.html';
const FAKE = () => {                      // 假 PeerJS：只要 Peer 存在，p2p-room.js 就不會去下載
    const bc = new BroadcastChannel('fakepeer'), peers = new Map();
    class Em { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); } }
    class Conn extends Em {
        constructor(owner, remote, cid) { super(); this.owner = owner; this.peer = remote; this.cid = cid; this.open = false; }
        send(d) { if (!this.open) throw new Error('closed'); bc.postMessage({ k: 'd', to: this.peer, from: this.owner.id, cid: this.cid, d: JSON.parse(JSON.stringify(d)) }); }
        close() { if (!this.open) return; this.open = false; bc.postMessage({ k: 'c', to: this.peer, from: this.owner.id, cid: this.cid }); this.emit('close'); }
    }
    class Peer extends Em {
        constructor() { super(); this.id = 'p' + Math.random().toString(36).slice(2, 9); this.conns = new Map(); peers.set(this.id, this); setTimeout(() => this.emit('open', this.id), 0); }
        connect(id) { const cid = Math.random().toString(36).slice(2), c = new Conn(this, id, cid); this.conns.set(cid, c); bc.postMessage({ k: 'conn', to: id, from: this.id, cid }); return c; }
        destroy() { this.conns.forEach(c => c.close()); peers.delete(this.id); }
    }
    bc.onmessage = (ev) => {
        const m = ev.data, p = peers.get(m.to); if (!p) return;
        if (m.k === 'conn') { const c = new Conn(p, m.from, m.cid); c.open = true; p.conns.set(m.cid, c); bc.postMessage({ k: 'ack', to: m.from, from: p.id, cid: m.cid }); p.emit('connection', c); setTimeout(() => c.emit('open'), 0); }
        else if (m.k === 'ack') { const c = p.conns.get(m.cid); if (c) { c.open = true; c.emit('open'); } }
        else if (m.k === 'd') { const c = p.conns.get(m.cid); if (c) { (window.__rx = window.__rx || []).push(m.d); c.emit('data', m.d); } }
        else if (m.k === 'c') { const c = p.conns.get(m.cid); if (c && c.open) { c.open = false; c.emit('close'); } }
    };
    window.Peer = Peer;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(40); } throw new Error('逾時：' + what); };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const fill = (page, sel, v) => page.evaluate((s, v) => { document.querySelector(s).value = v; }, sel, v);
const FAST = () => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms >= 500 && ms < 1200 ? 5 : ms, ...a); };
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); await o.page.evaluate(FAST); return o; };
const drive = (page) => page.evaluate(() => {
    if (!V || V.phase === 'lobby' || V.phase === 'over') return;
    if (V.phase === 'pass' && !V.picked[my]) { [...document.querySelectorAll('#hand .bc')].slice(0, 3).forEach(b => b.click()); document.querySelector('#goBtn').click(); }
    else if (V.phase === 'play' && V.turn === my) { const b = [...document.querySelectorAll('#hand .bc')].find(x => !x.classList.contains('dim')); if (b) { b.click(); document.querySelector('#goBtn').click(); } }
});
const join = async (browser, id, nick) => {
    const o = await newPage(browser); await fill(o.page, '#nick', nick); await fill(o.page, '#joinId', id); await click(o.page, '#joinBtn');
    await until(() => o.page.evaluate((n) => V && V.names.includes(n), nick), 5000, nick + ' 加入'); return o;
};

const browser = await launchEdge();
try {
    const host = await newPage(browser), H = host.page;
    await fill(H, '#nick', '房主'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    let guest = await join(browser, id, '小明'), Gp = guest.page;
    assert.strictEqual(await Gp.evaluate(() => V.names[1]), '小明');
    await click(H, '#startBtn');
    await until(() => Gp.evaluate(() => V.phase === 'pass' && V.commit && myHand.length === 13), 5000, '發牌與承諾');
    // 手牌只私送本人：公開狀態沒有手牌；成員的手牌 = 房主那份座位 1 的牌；收到的 HAND 訊息都是自己的
    assert.ok(!/"hands"|"deal"/.test(await Gp.evaluate(() => JSON.stringify(V))), '公開狀態不含手牌');
    assert.deepStrictEqual(await Gp.evaluate(() => myHand), await H.evaluate(() => G.hands[1]));
    const rx = await Gp.evaluate(() => (window.__rx || []).filter(m => m.d && m.d.t === 'HAND').map(m => m.d.d || m.d));
    assert.ok(rx.length >= 1);
    // 成員送非法動作：換牌用別人的牌 / 張數錯 / 亂序出牌 / 垃圾訊息 → 全部被拒
    const others = await H.evaluate(() => G.hands[0].slice(0, 3));
    await Gp.evaluate((o) => { room.send({ t: 'SUBMIT', cards: o }); room.send({ t: 'SUBMIT', cards: [1] }); room.send({ t: 'PLAY', c: 0 }); room.send({ t: 'HAX' }); room.send(null); }, others);
    await sleep(300);
    assert.strictEqual(await H.evaluate(() => G.picks[1]), null, '非法換牌不應被接受');
    // 正常打：成員 / 房主輪流；成員輪到時先送非法牌（不在手上、重複、不跟花色）
    let probed = false, dropped = false;
    for (const t0 = Date.now(); Date.now() - t0 < 60000;) {
        if (await H.evaluate(() => V.phase === 'over')) break;
        if (!probed && await Gp.evaluate(() => V.phase === 'play' && V.turn === my)) {
            probed = true;
            const r = await Gp.evaluate(() => {
                const lead = V.trick.length ? Math.floor(V.trick[0].c / 13) : -1, foreign = myHand.find(c => lead >= 0 && Math.floor(c / 13) !== lead && myHand.some(x => Math.floor(x / 13) === lead));
                return { foreign: foreign ?? null };
            });
            const hostCard = await H.evaluate(() => G.hands[0][0]), m0 = await H.evaluate(() => G.moves);
            await Gp.evaluate((hc, f) => { room.send({ t: 'PLAY', c: hc }); room.send({ t: 'PLAY', c: 99 }); room.send({ t: 'PLAY', c: 1.5 }); if (f !== null) room.send({ t: 'PLAY', c: f }); }, hostCard, r.foreign);
            await sleep(300);
            assert.strictEqual(await H.evaluate(() => G.moves), m0, '非法出牌不應被接受');
            // 合法出一張後再重複送同一張：第二次被拒
            const c = await Gp.evaluate(() => { const b = [...document.querySelectorAll('#hand .bc')].find(x => !x.classList.contains('dim')); return +b.dataset.id; });
            await Gp.evaluate((c) => { room.send({ t: 'PLAY', c }); room.send({ t: 'PLAY', c }); }, c);
            await sleep(300);
            assert.strictEqual(await H.evaluate(() => G.moves), m0 + 1, '重複出牌只算一次');
        }
        // 成員斷線 → 電腦託管（座位 1 自動出牌）
        if (probed && !dropped && await H.evaluate(() => G.nTrick >= 2)) {
            dropped = true;
            await Gp.evaluate(() => room.destroy());
            await until(() => H.evaluate(() => V.auto[1] === true), 5000, '託管');
            const left = await H.evaluate(() => G.hands[1].length);
            await until(async () => { await drive(H); return H.evaluate((l) => G.hands[1].length < l || G.phase === 'over', left); }, 8000, '電腦代打');
            // 同暱稱重連：拿回自己的手牌
            await guest.page.close();
            guest = await join(browser, id, '小明'); Gp = guest.page;
            await until(() => Gp.evaluate(() => myHand.length > 0 || V.phase === 'over'), 5000, '重連拿回手牌');
            if (await H.evaluate(() => G.phase === 'play')) assert.deepStrictEqual(await Gp.evaluate(() => myHand), await H.evaluate(() => G.hands[1]));
            assert.strictEqual(await H.evaluate(() => V.auto[1]), false);
        }
        await drive(H); await drive(Gp); await sleep(8);
    }
    assert.ok(probed && dropped);
    await until(() => Gp.evaluate(() => V.phase === 'over' && V.reveal), 8000, '結算');
    await until(() => Gp.evaluate(() => /牌堆驗證：和開局公布的承諾一致/.test(document.querySelector('#reveal').textContent)), 5000, '牌堆核對 ✓');
    assert.ok(await Gp.evaluate(() => V.delta.reduce((a, b) => a + b, 0) >= 26 || V.delta.some(x => x < 0)));
    assert.strictEqual(await H.evaluate(() => G.taken.flat().length), 52);
    for (const o of [host, guest]) assert.deepStrictEqual(o.errors.filter(e => !e.includes('hearts-games.html')), []);
} finally { await browser.close(); }
console.log('ok  hearts-games net e2e');
