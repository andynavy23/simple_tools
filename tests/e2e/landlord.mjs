// 鬥地主 E2E：單機（叫分 → 出牌 → 結算 → 戰績存取 / 清除）、版面（手機不橫向溢出）、連線（假 PeerJS：叫分、牌堆承諾核對、非法出牌被房主擋下）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';


const PAGE = 'mini-games/landlord.html';
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
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const FAST = () => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms >= 600 && ms < 1200 ? 5 : ms, ...a); };    // 電腦思考時間縮短
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); await o.page.evaluate(FAST); return o; };
// 輪到自己就動作：叫分取最低可叫的分數、出牌用提示（無法壓時不出）
const drive = (page) => page.evaluate(() => {
    if (!V) return;
    if (V.phase === 'bid' && V.turn === my) { const b = [...document.querySelectorAll('#bidBox button')].find(x => !x.disabled && x.dataset.v === '1'); (b || document.querySelector('#bidBox button')).click(); }
    else if (V.phase === 'play' && V.turn === my) { hint(); const p = document.querySelector('#playBtn'); if (!p.disabled) p.click(); else document.querySelector('#passBtn').click(); }
});

const browser = await launchEdge();
try {
    // ---------- 單機 ----------
    {
        const { page, errors } = await newPage(browser);
        await click(page, '#soloBtn');
        await until(() => page.evaluate(() => V && V.phase !== 'lobby'), 3000, '開局');
        let layout = null;
        for (let i = 0; i < 400; i++) {
            if (await page.evaluate(() => V.phase === 'over')) break;
            if (!layout && await page.evaluate(() => V.phase === 'play' && V.turn === my)) layout = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, hand: myHand.length, minH: Math.min(...[...document.querySelectorAll('#game button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)) }));
            await drive(page); await sleep(25);
        }
        assert.strictEqual(await page.evaluate(() => V.phase), 'over');
        if (layout) assert.ok(layout.sw <= layout.iw && layout.minH >= 44, JSON.stringify(layout));
        const r = await page.evaluate(() => ({ st: JSON.parse(localStorage.getItem('ldlord_stats')), d: V.delta, t: document.querySelector('#status').textContent }));
        assert.strictEqual(r.st.g, 1); assert.strictEqual(r.d[0] + r.d[1] + r.d[2], 0); assert.ok(/獲勝/.test(r.t), r.t);
        // 壞資料載入不壞頁面；清除戰績
        await page.evaluate(() => { localStorage.setItem('ldlord_stats', '"壞"'); localStorage.setItem('ldlord_opts', '[1]'); });
        await page.reload({ waitUntil: 'load' });
        assert.ok((await text(page, '#statLine')).includes('還沒有'));
        await page.evaluate(() => { localStorage.setItem('ldlord_stats', JSON.stringify({ g: 4, w: 2, lg: 2, lw: 1, pts: 6 })); localStorage.setItem('other_key', '1'); window.confirm = () => true; stats = cleanStats(JSON.parse(localStorage.getItem('ldlord_stats'))); renderStats(); });
        assert.ok((await text(page, '#statLine')).includes('4 場'));
        await click(page, '#clrStats');
        assert.deepStrictEqual(await page.evaluate(() => [JSON.parse(localStorage.getItem('ldlord_stats')).g, localStorage.getItem('other_key')]), [0, '1']);
        assert.deepStrictEqual(errors, []);
    }
    // ---------- 連線 ----------
    {
        const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
        await fill(H, '#nick', '房主'); await click(H, '#hostBtn');
        await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
        const id = await H.evaluate(() => hostId);
        await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
        await until(() => G.evaluate(() => V && V.names[1] === '小明'), 5000, '加入');
        await click(H, '#startBtn');
        await until(() => G.evaluate(() => V && V.phase === 'bid' && V.commit && myHand.length === 17), 5000, '發牌');
        assert.strictEqual(await G.evaluate(() => myHand.length), 17);
        assert.ok(!(await G.evaluate(() => JSON.stringify(V)).then(s => /"hands"/.test(s))), '公開狀態不含別人的手牌');
        let probed = false;
        for (let i = 0; i < 500; i++) {
            if (await H.evaluate(() => V.phase === 'over') && await G.evaluate(() => V.phase === 'over')) break;
            if (!probed && await G.evaluate(() => V.phase === 'play')) {      // 成員送非法動作：別人的牌、領出不出、亂序
                probed = true;
                const before = await H.evaluate(() => G.moves);
                await G.evaluate(() => { room.send({ t: 'PLAY', cards: [0, 1, 2, 3, 4] }); room.send({ t: 'PLAY', cards: 'x' }); room.send({ t: 'BID', v: 3 }); room.send({ t: 'PASS' }); room.send({ t: 'HAX' }); room.send(null); });
                await sleep(300);
                const same = await H.evaluate((b) => G.moves === b || G.turn !== 1, before);
                assert.ok(same, '非法動作不應被接受');
            }
            await drive(H); await drive(G); await sleep(30);
        }
        await until(() => G.evaluate(() => V.phase === 'over' && V.reveal), 5000, '結算');
        await until(() => G.evaluate(() => /核對：✓/.test(document.querySelector('#reveal').textContent)), 5000, '牌堆核對');
        assert.ok(/核對：✓/.test(await text(H, '#reveal')));
        const st = await G.evaluate(() => JSON.parse(localStorage.getItem('ldlord_stats')).g); assert.strictEqual(st, 1);
        assert.strictEqual(await G.evaluate(() => V.delta.reduce((a, b) => a + b, 0)), 0);
        for (const o of [host, guest]) assert.deepStrictEqual(o.errors, []);
    }
} finally { await browser.close(); }
console.log('ok  landlord e2e');
