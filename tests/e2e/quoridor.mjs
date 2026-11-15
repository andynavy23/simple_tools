// Quoridor E2E：版面、對電腦（點選移動 / 放牆預覽與確認 / 電腦回應）、同機、戰績與清除、連線（假 PeerJS）：房主驗證、輪替、斷線電腦代走與重連
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/quoridor.html';
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
const setm = (page, m) => click(page, `#modes [data-m=${m}]`);
const svgClick = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error('找不到 ' + s); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, sel);
const cell = (r, c) => `#bd .hit[data-r="${r}"][data-c="${c}"]`, slot = (r, c) => `#bd .hit[data-wr="${r}"][data-wc="${c}"]`;

const browser = await launchEdge();
try {
    // ---------- 對電腦（簡單 2 人） ----------
    {
        const { page, errors } = await newPage(browser);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(...[...document.querySelectorAll('.wrap button:not(.sm)')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)) }));
        assert.ok(m.sw <= m.iw && m.minH >= 44, JSON.stringify(m));
        await setm(page, 'ai'); await page.evaluate(() => { document.querySelector('#lv').value = 'easy'; });
        await click(page, '#newBtn');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#bd .qc').length), 81);
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#bd .qm').length), 3, '開局有 3 個可走格');
        await svgClick(page, cell(7, 4));
        await until(() => page.evaluate(() => G.st.n >= 2 && G.st.turn === 0), 3000, '電腦回應');
        assert.deepStrictEqual(await page.evaluate(() => G.st.pawns[0]), [7, 4]);
        // 放牆：點交叉點 → 預覽 → 再點切換豎 → 旋轉鈕切回橫 → 確認
        await click(page, '#tabs [data-t=w]');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#bd .hit').length), 64);
        await svgClick(page, slot(2, 3)); assert.strictEqual(await page.evaluate(() => wsel.o), 'h');
        assert.strictEqual(await page.evaluate(() => document.querySelector('#putW').disabled), false);
        await svgClick(page, slot(2, 3)); assert.strictEqual(await page.evaluate(() => wsel.o), 'v');
        await click(page, '#rot'); assert.strictEqual(await page.evaluate(() => wsel.o), 'h');
        const n0 = await page.evaluate(() => G.st.n);
        await click(page, '#putW');
        await until(() => page.evaluate((n) => G.st.n >= n + 2 && G.st.turn === 0, n0), 3000, '放牆後電腦回應');
        assert.ok(await page.evaluate(() => G.st.walls.some(w => w.o === 'h' && w.r === 2 && w.c === 3) && G.st.left[0] === 9));
        // 勝負與戰績
        await page.evaluate(() => { G.st = { ...G.st, pawns: [[1, 0], [0, 8]], walls: [], turn: 0 }; localView(); });
        await svgClick(page, cell(0, 0));
        assert.ok((await text(page, '#stat')).includes('獲勝'));
        const sv = await page.evaluate(() => JSON.parse(localStorage.getItem('quor_stats')));
        assert.deepStrictEqual(Object.keys(sv), ['2e']); assert.strictEqual(sv['2e'].w, 1);
        assert.ok((await text(page, '#stats')).includes('勝 1'));
        // 清除只清自己的鍵
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await page.evaluate(() => { localStorage.setItem('other_key', '1'); });
        await Promise.all([page.waitForNavigation(), click(page, '#clearAll')]);
        assert.strictEqual(await page.evaluate(() => [localStorage.getItem('quor_stats'), localStorage.getItem('quor_opts'), localStorage.getItem('other_key')].join()), ',,1');
        // 壞資料被忽略
        await page.evaluate(() => { localStorage.setItem('quor_stats', '"x"'); localStorage.setItem('quor_opts', '[1]'); localStorage.removeItem('other_key'); });
        await page.reload(); assert.ok((await text(page, '#stats')).includes('還沒有'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 同機 4 人 ----------
    {
        const { page, errors } = await newPage(browser);
        await setm(page, 'local'); await page.evaluate(() => { document.querySelector('#np').value = '4'; });
        await click(page, '#newBtn');
        assert.strictEqual(await page.evaluate(() => G.st.np + ',' + G.st.left.join('')), '4,5555');
        await svgClick(page, cell(7, 4)); await svgClick(page, cell(4, 1)); await svgClick(page, cell(1, 4)); await svgClick(page, cell(4, 7));
        assert.strictEqual(await page.evaluate(() => G.st.turn + ',' + G.st.n), '0,4');
        assert.ok(await page.evaluate(() => !document.querySelector('#tabs').hidden));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線 ----------
    const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
    await setm(H, 'net'); await H.evaluate(() => { document.querySelector('#np').value = '2'; document.querySelector('#tm').value = '0'; }); await fill(H, '#nick', '房主'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    await setm(G, 'net'); await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
    await until(() => G.evaluate(() => V && V.conn[1]), 5000, '加入');
    await until(() => H.evaluate(() => !document.querySelector('#startBtn').disabled), 3000, '可開始');
    await click(H, '#startBtn');
    await until(() => G.evaluate(() => V.phase === 'play' && V.st), 3000, '開始');
    // 非法：非輪到、跳格、越界牆、壞資料都被房主擋下
    const bad = (mv) => G.evaluate((mv) => room.send({ t: 'MV', mv }), mv);
    await bad({ t: 'm', r: 1, c: 4 }); await sleep(250);
    assert.strictEqual(await H.evaluate(() => H.st.n), 0, '非輪到的人不能走');
    await svgClick(H, cell(7, 4)); await until(() => G.evaluate(() => V.st.n === 1), 2000, '房主走一步');
    await bad({ t: 'm', r: 3, c: 4 }); await bad({ t: 'w', o: 'h', r: 9, c: 0 }); await bad({ t: 'w', o: 'h', r: 'x' }); await bad(null); await sleep(250);
    assert.strictEqual(await H.evaluate(() => H.st.n), 1, '非法步被擋');
    assert.ok((await text(G, '#stat')).includes('不合法'));
    // 小明放牆（點選 → 確認）
    await click(G, '#tabs [data-t=w]'); await svgClick(G, slot(5, 4)); await click(G, '#putW');
    await until(() => H.evaluate(() => H.st.walls.length === 1 && H.st.turn === 0), 3000, '成員放牆');
    // 壞狀態不會讓成員頁壞掉
    await H.evaluate(() => room.broadcast({ t: 'STATE', s: { phase: 'play', np: 2, st: { np: 2 } } })); await sleep(200);
    assert.ok(await G.evaluate(() => V.st.walls.length === 1));
    // 小明斷線 → 輪到他時電腦先代走；同暱稱重連
    await svgClick(H, cell(6, 4)); await until(() => G.evaluate(() => V.st.turn === 1), 2000, '換小明');
    const nBefore = await H.evaluate(() => H.st.n);
    await G.close();
    await until(() => H.evaluate((n) => H.st.n > n && H.st.turn === 0, nBefore), 12000, '離線代走');
    assert.ok(await H.evaluate(() => V.conn[1] === false));
    const g2 = await newPage(browser); await setm(g2.page, 'net'); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#joinBtn');
    await until(() => g2.page.evaluate(() => V && V.phase === 'play' && V.conn[1] && V.st.n > 0), 5000, '重連回到對局');
    // 計時：逾時由房主代走最短路一步
    await H.evaluate(() => { H.time = 30; H.st = { ...H.st, turn: 0 }; turnStart(); clearTimeout(H.turnT); H.turnT = setTimeout(() => autoMove(0, 'step'), 50); });
    const n2 = await H.evaluate(() => H.st.n); await until(() => H.evaluate((n) => H.st.n > n, n2), 2000, '逾時代走');
    // 勝利
    await H.evaluate(() => { H.st = { ...H.st, pawns: [[1, 0], [0, 8]], turn: 0 }; push(); });
    await svgClick(H, cell(0, 0));
    await until(() => g2.page.evaluate(() => V.phase === 'over' && V.winner === 0), 3000, '結束');
    assert.ok(await H.evaluate(() => !document.querySelector('#again').hidden));
    for (const o of [host, g2]) assert.deepStrictEqual(o.errors, []);
    await H.close(); await g2.page.close();
} finally { await browser.close(); }
console.log('ok  quoridor e2e');
