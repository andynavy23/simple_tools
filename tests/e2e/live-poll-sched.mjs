// 約時間投票（live-poll）E2E：單機傳遞、連線（假 PeerJS）房主驗證 / 彙整 / 結束；台灣連假頁面與自訂資料
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'fun/live-poll.html';
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
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };
const slot = async (page, d, s, e) => { await fill(page, '#sDate', d); await fill(page, '#sStart', s); await fill(page, '#sEnd', e); await click(page, '#sAdd'); };

const browser = await launchEdge();
try {
    // ---------- 單機傳遞 ----------
    {
        const { page, errors } = await newPage(browser);
        await page.evaluate(() => { window.confirm = () => true; }); await click(page, '#schedSoloBtn');
        await slot(page, '2030-03-01', '19:00', '21:00'); await slot(page, '2030-03-02', '14:00', '16:00');
        await slot(page, '2030-03-02', '14:00', '16:00'); await slot(page, '2030-03-03', '10:00', '09:00');   // 重複 / 結束早於開始：被擋
        assert.strictEqual(await text(page, '#sN'), '2');
        await click(page, '#sOpen');
        await fill(page, '#sName', '小明'); await page.evaluate(() => document.querySelector('#sSlots .sv button:nth-child(1)').click());   // 第 1 個時段「可以」
        await page.evaluate(() => document.querySelectorAll('#sSlots .sv')[1].children[2].click());                                       // 第 2 個「不行」
        await click(page, '#sNext'); await fill(page, '#sName', '小華'); await page.evaluate(() => document.querySelector('#sSlots .sv button:nth-child(1)').click());
        const r = await text(page, '#sRank');
        assert.ok(r.includes('★ 最佳') && r.includes('不能：小明') && r.includes('可以 2'), r);
        await click(page, '#sClose');
        assert.ok((await text(page, '#sStatus')).includes('已結束'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線 ----------
    const host = await newPage(browser), g1 = await newPage(browser), H = host.page, G = g1.page;
    await fill(H, '#nick', '房主'); await click(H, '#schedHostBtn');
    await until(() => H.evaluate(() => !document.querySelector('#sched').hidden), 4000, '房主進房');
    await slot(H, '2030-03-01', '19:00', '21:00'); await slot(H, '2030-03-02', '14:00', '16:00'); await click(H, '#sOpen');
    const id = await H.evaluate(() => hostId);
    await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
    await until(() => G.evaluate(() => !document.querySelector('#sched').hidden && document.querySelectorAll('#sSlots .sv').length === 2), 4000, '成員看到時段');
    await G.evaluate(() => document.querySelectorAll('#sSlots .sv')[0].children[0].click());          // 可以
    await G.evaluate(() => document.querySelectorAll('#sSlots .sv')[1].children[2].click());          // 不行
    await until(() => H.evaluate(() => SH.ballots.get('小明') && SH.ballots.get('小明').join() === '2,0'), 4000, '房主收到票');
    // 房主驗證：不存在的時段、非法值、同暱稱重投覆蓋
    await G.evaluate(() => { room.send({ t: 'SVOTE', slot: 9, v: 2 }); room.send({ t: 'SVOTE', slot: 0, v: 7 }); room.send({ t: 'SVOTE', slot: 0, v: 1 }); });
    await until(() => H.evaluate(() => SH.ballots.get('小明')[0] === 1), 4000, '覆蓋');
    assert.strictEqual(await H.evaluate(() => SH.ballots.size), 1);
    // 房主自己也能投
    await H.evaluate(() => document.querySelectorAll('#sSlots .sv')[0].children[0].click());
    const rank = await text(H, '#sRank'); assert.ok(rank.includes('不能：小明'), rank);
    await until(() => G.evaluate(() => document.querySelector('#sRank').textContent.includes('2 人') || document.querySelector('#sCount').textContent.includes('2 人已回覆')), 4000, '成員看到彙整');
    // 暱稱重複被拒
    const g2 = await newPage(browser); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#joinBtn');
    await until(() => g2.page.evaluate(() => document.querySelector('#netMsg').textContent.includes('暱稱')), 4000, '暱稱重複');
    await H.evaluate(() => { window.confirm = () => true; }); await click(H, '#sClose');
    await until(() => G.evaluate(() => document.querySelector('#sStatus').textContent.includes('已結束')), 4000, '成員看到結束');
    await G.evaluate(() => { room.send({ t: 'SVOTE', slot: 0, v: 2 }); }); await sleep(300);
    assert.strictEqual(await H.evaluate(() => SH.ballots.get('小明')[0]), 1);   // 結束後不再接受
    for (const o of [host, g1, g2]) assert.deepStrictEqual(o.errors, []);

    // ---------- 台灣連假 ----------
    const { page: T, errors: te } = await openPage(browser, 'utils/tw-holidays.html');
    assert.ok((await text(T, '#next')).length > 0);
    await T.evaluate(() => document.querySelector('[data-t=opt]').click());
    await click(T, '#oGo'); assert.ok((await text(T, '#oRes')).includes('連休'));
    await T.evaluate(() => document.querySelector('[data-t=data]').click());
    await T.evaluate(()=>{window.confirm=()=>true;}); await fill(T, '#cDate', '2026-06-01'); await fill(T, '#cName', '測試'); await click(T, '#cAdd');
    assert.strictEqual(await text(T, '#cN'), '1');
    await T.evaluate(() => { localStorage.setItem('twhol_custom', '"壞"'); location.reload(); }); await sleep(500);
    assert.strictEqual(await text(T, '#cN'), '0');
    assert.deepStrictEqual(te, []);
} finally { await browser.close(); }
console.log('ok  live-poll sched + tw-holidays e2e');
