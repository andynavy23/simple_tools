// mahjong：(1) 單機時別人打出可吃 / 碰 / 槓 / 胡的牌，畫面一定出現對應按鈕，點了結果正確、「過」會繼續
//          (2) 連線（假 PeerJS，多開分頁）：手牌只私送、房主拒絕非法動作 / 垃圾訊息、牌牆承諾局末核對 ✓、倒數行、斷線託管與同暱稱重連、完成一局結算
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/mahjong.html';
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
        if (m.k === 'conn') { const c = new Conn(p, m.from, m.cid); c.open = true; p.conns.set(m.cid, c); bc.postMessage({ k: 'ack', to: m.from, from: p.id, cid: m.cid }); p.emit('connection', c); }
        else if (m.k === 'ack') { const c = p.conns.get(m.cid); if (c) { c.open = true; c.emit('open'); } }
        else if (m.k === 'd') { const c = p.conns.get(m.cid); if (c) { (window.__rx = window.__rx || []).push(m.d); c.emit('data', m.d); } }
        else if (m.k === 'c') { const c = p.conns.get(m.cid); if (c && c.open) { c.open = false; c.emit('close'); } }
    };
    window.Peer = Peer;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(30); } throw new Error('逾時：' + what); };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const fill = (page, sel, v) => page.evaluate((s, v) => { document.querySelector(s).value = v; }, sel, v);
const actsText = (page) => page.evaluate(() => [...document.querySelectorAll('#acts button')].map(b => b.textContent));
const clickAct = (page, re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#acts button')].find(x => new RegExp(src).test(x.textContent)); if (!b) throw new Error('沒有按鈕 ' + src); b.click(); }, re);

// 固定牌（種類編號）
const FILL = [0, 0, 8, 9, 9, 17, 18, 18, 26, 27, 28, 29, 30, 31, 32, 33];                 // 不會有任何吃碰胡
const P0 = [4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];             // 17 張，含 5 萬（4）
const CHI = [0, 3, 5, 7, 9, 12, 15, 17, 18, 21, 24, 26, 27, 29, 31, 33];                  // 有 4、6 萬 → 能吃 5 萬
const PON = [4, 4, 7, 8, 9, 12, 15, 17, 18, 21, 24, 26, 27, 29, 31, 33];                  // 有 5 萬 ×2
const KAN = [4, 4, 4, 7, 9, 12, 15, 17, 18, 21, 24, 26, 27, 29, 31, 33];                  // 有 5 萬 ×3
const WAIT = [0, 1, 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];                // 單吊 5 萬
const scen = (page, hands, t, k) => page.evaluate((hands, t, k) => {
    G.phase = 'discard'; G.turn = t; G.drawn = -1; G.claims = null; G.qiang = null; G.result = null; G.last = null; G.counted = false; G.noCall = true; G.afterKan = false;
    G.hands = hands.map(h => h.slice()); G.melds = [[], [], [], []]; G.rivers = [[], [], [], []]; G.flowers = [[], [], [], []];
    if (!act(G, t, { t: 'discard', k })) throw new Error('構造局面失敗'); push();
}, hands, t, k);

const browser = await launchEdge();
try {
    // ================= (1) 單機：claim 按鈕 =================
    {
        const { page, errors } = await openPage(browser, PAGE);
        await page.evaluate(() => { window.mjDelay = [1e6, 0]; });                       // 電腦不自己動，局面由測試構造
        await click(page, '#soloBtn'); await page.waitForSelector('#game:not([hidden])');
        // 上家（3 號）打出 5 萬 → 我能吃
        await scen(page, [CHI, FILL, FILL, P0], 3, 4);
        let a = await actsText(page); assert.deepStrictEqual(a.sort(), ['吃 四萬五萬六萬', '過'].sort(), a.join());
        assert.ok((await page.$eval('#status', e => e.textContent)).includes('你要吃碰槓胡嗎'));
        await clickAct(page, '^過$');                                                      // 過 → 繼續：輪到我摸牌打牌
        await until(() => page.evaluate(() => V.gphase === 'discard' && V.turn === 0 && ME.drawn >= 0), 3000, '過牌後繼續');
        assert.ok((await actsText(page)).includes('打出') && !(await actsText(page)).some(x => /吃|碰|胡/.test(x)));
        await scen(page, [CHI, FILL, FILL, P0], 3, 4); await clickAct(page, '^吃 ');
        await until(() => page.evaluate(() => G.melds[0].length === 1 && G.melds[0][0].t === 'chi' && G.turn === 0 && G.hands[0].length === 14), 3000, '吃');
        // 任一家（2 號）打出 5 萬 → 我能碰
        await scen(page, [PON, FILL, P0, FILL], 2, 4);
        a = await actsText(page); assert.deepStrictEqual(a.sort(), ['碰', '過'].sort(), a.join());
        await clickAct(page, '^碰$'); await until(() => page.evaluate(() => G.melds[0][0] && G.melds[0][0].t === 'pon' && G.turn === 0), 3000, '碰');
        // 有三張 → 槓 + 碰
        await scen(page, [KAN, FILL, P0, FILL], 2, 4);
        a = await actsText(page); assert.deepStrictEqual(a.sort(), ['槓', '碰', '過'].sort(), a.join());
        await clickAct(page, '^槓$'); await until(() => page.evaluate(() => G.melds[0][0] && G.melds[0][0].t === 'kan' && G.turn === 0 && G.drawn >= 0), 3000, '槓');
        // 1 號打出 5 萬 → 我能胡
        await scen(page, [WAIT, P0, FILL, FILL], 1, 4);
        a = await actsText(page); assert.deepStrictEqual(a.sort(), ['胡', '過'].sort(), a.join());
        await clickAct(page, '^胡$'); await until(() => page.evaluate(() => G.phase === 'over' && G.result.w === 0 && G.result.from === 1), 3000, '胡');
        assert.ok(await page.$eval('#result', e => !e.hidden)); assert.ok((await page.$eval('#status', e => e.textContent)).includes('胡'));
        assert.deepStrictEqual(errors, []); await page.close();
    }

    // ================= (2) 連線 =================
    const newPage = async () => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };
    const join = async (id, nick) => {
        const o = await newPage(); await fill(o.page, '#nick', nick); await fill(o.page, '#joinId', id); await click(o.page, '#joinBtn');
        await until(() => o.page.evaluate((n) => V && V.names.includes(n), nick), 5000, nick + ' 加入'); return o;
    };
    const drive = (page) => page.evaluate(() => {
        if (!V || V.phase !== 'play') return;
        const all = [...document.querySelectorAll('#acts button')], bs = all.filter(b => !b.disabled);
        const b = bs.find(x => /胡/.test(x.textContent)) || bs.find(x => /^過$/.test(x.textContent));
        if (b) { b.click(); return; }
        const d = document.querySelector('#hand .mt.dr') || document.querySelector('#hand .mt:last-child');
        if (all.some(x => x.textContent === '打出') && d) { d.click(); d.click(); }
    });
    const host = await newPage(), H = host.page;
    await H.evaluate(() => { window.mjDelay = [0, 0]; });
    await fill(H, '#nick', '房主'); await fill(H, '#rTimer', '30'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    let g1 = await join(id, '小明'); const g2 = await join(id, '小華');
    let G1 = g1.page; const G2 = g2.page;
    assert.deepStrictEqual(await H.evaluate(() => V.names.slice(0, 3)), ['房主', '小明', '小華']);
    await click(H, '#startBtn');
    await until(() => G1.evaluate(() => V.phase === 'play' && V.commit && ME.hand.length >= 16), 5000, '發牌與承諾');
    await until(() => G2.evaluate(() => V.phase === 'play' && ME.hand.length >= 16), 5000, '成員 2 發牌');

    // 手牌只私送：公開狀態沒有任何手牌 / 牌牆；成員的手牌 = 房主那份；別的成員收到的訊息沒有我的牌
    for (const p of [G1, G2]) assert.ok(!/"hands"|"wall":\[|"salt"/.test(await p.evaluate(() => JSON.stringify(V))), '公開狀態不含暗牌');
    const h1 = await G1.evaluate(() => ME.hand.slice());
    assert.deepStrictEqual(h1, await H.evaluate(() => G.hands[1].slice()));
    const rx2 = await G2.evaluate(() => (window.__rx || []).map(m => m.d));
    assert.ok(rx2.filter(d => d && d.t === 'ME').length >= 1);
    assert.ok(rx2.every(d => !d || d.t !== 'ME' || d.m.hand.join() !== h1.join()), '成員 2 不該收到成員 1 的手牌');
    assert.ok(rx2.every(d => !d || d.t !== 'V' || !JSON.stringify(d.s).match(/"hands"|"wall":\[/)), '廣播不含暗牌');
    assert.ok(rx2.every(d => !d || d.t !== 'V' || !d.s.commit || d.s.commit.length === 64));

    // 成員送非法動作 / 垃圾訊息：全部被拒，房主狀態不變
    const snap = () => H.evaluate(() => JSON.stringify([G.hands, G.melds, G.rivers, G.phase, G.turn, G.drawn, G.discards, G.claims]));
    const s0 = await snap();
    await G1.evaluate((h) => {
        const miss = [...Array(34).keys()].find(k => !h.includes(k)), have = h[0], S = (a) => room.send({ t: 'ACT', a });
        S({ t: 'discard', k: miss }); S({ t: 'discard', k: have });                      // 不在手上 / 還沒輪到
        S({ t: 'zimo' }); S({ t: 'ankan', k: have }); S({ t: 'jia', k: have });
        S({ t: 'claim', r: { t: 'hu' } }); S({ t: 'claim', r: { t: 'chi', k: 2 } }); S({ t: 'claim', r: { t: 'pass' } });
        S({ t: 'discard', k: 'x' }); S({ t: 'discard', k: 1.5 }); S({ t: 'discard', k: -1 }); S({ t: 'discard', k: 999 }); S({ t: 'hax' }); S(null); S(5); S('discard');
        room.send(null); room.send(7); room.send('x'); room.send({ t: 'ZZ' }); room.send({ t: 'V', s: {} }); room.send({ t: 'ACT' }); room.send([1, 2]);
    }, h1);
    await sleep(300);
    assert.strictEqual(await snap(), s0, '非法動作不應改變牌局');
    assert.strictEqual(await H.evaluate(() => G.hands[0].length), 17);

    // 構造：房主打出 5 萬，成員 1（下家）能吃；倒數行出現；非法回應被拒；合法吃成功
    await H.evaluate((P0, CHI, FILL) => {
        G.hands = [P0, CHI, FILL, FILL].map(h => h.slice()); G.melds = [[], [], [], []]; G.rivers = [[], [], [], []]; G.flowers = [[], [], [], []];
        G.phase = 'discard'; G.turn = 0; G.drawn = -1; G.claims = null; G.noCall = true;
        if (!act(G, 0, { t: 'discard', k: 4 })) throw new Error('構造失敗'); push();
    }, P0, CHI, FILL);
    await until(() => G1.evaluate(() => V.gphase === 'claim' && V.pending.includes(my) && ME.opts.chi && ME.opts.chi[0] === 3), 4000, '成員 1 收到可吃');
    const acts1 = await actsText(G1); assert.deepStrictEqual(acts1.sort(), ['吃 四萬五萬六萬', '過'].sort(), acts1.join());
    assert.ok(/⏱/.test(await G1.$eval('#timer', e => e.textContent)), '有倒數時要顯示倒數行');
    assert.deepStrictEqual(await actsText(G2), [], '成員 2 沒有可做的事');
    const before = await H.evaluate(() => JSON.stringify(G.claims));
    await G1.evaluate(() => { for (const r of [{ t: 'chi', k: 2 }, { t: 'pon' }, { t: 'hu' }, { t: 'kan' }, { t: 'chi', k: 'a' }]) room.send({ t: 'ACT', a: { t: 'claim', r } }); });
    await G2.evaluate(() => { room.send({ t: 'ACT', a: { t: 'claim', r: { t: 'hu' } } }); room.send({ t: 'ACT', a: { t: 'claim', r: { t: 'pass' } } }); });
    await sleep(300);
    assert.strictEqual(await H.evaluate(() => JSON.stringify(G.claims)), before, '非法回應被拒');
    await clickAct(G1, '^吃 ');
    await until(() => H.evaluate(() => G.melds[1].length === 1 && G.turn === 1 && G.hands[1].length === 14), 4000, '成員 1 吃成功');
    await until(() => G1.evaluate(() => ME.hand.length === 14 && V.melds[my].length === 1), 3000, '成員 1 畫面更新');

    // 成員斷線 → 電腦託管；同暱稱重連拿回手牌
    await G1.evaluate(() => room.destroy());
    await until(() => H.evaluate(() => V.auto[1] === true), 5000, '託管');
    const left = await H.evaluate(() => G.hands[1].length + G.rivers[1].length);
    await until(async () => { await drive(H); await drive(G2); return H.evaluate((l) => G.rivers[1].length > 0 || G.phase === 'over', left); }, 8000, '電腦代打');
    await g1.page.close();
    g1 = await join(id, '小明'); G1 = g1.page;
    await until(() => G1.evaluate(() => ME.hand.length > 0 || V.phase === 'over'), 5000, '重連拿回手牌');
    if (await H.evaluate(() => G.phase !== 'over')) assert.deepStrictEqual(await G1.evaluate(() => ME.hand.slice()), await H.evaluate(() => G.hands[1].slice()));
    assert.strictEqual(await H.evaluate(() => V.auto[1]), false);

    // 打完一手：結算、牌牆承諾核對 ✓
    for (const t0 = Date.now(); Date.now() - t0 < 30000;) {
        if (await H.evaluate(() => V.phase === 'over')) break;
        await drive(H); await drive(G1); await drive(G2); await sleep(6);
    }
    await until(() => G2.evaluate(() => V.phase === 'over' && V.reveal && V.result), 8000, '結算');
    for (const p of [H, G1, G2]) await until(() => p.evaluate(() => /牌牆核對：✓/.test(document.querySelector('#verify') ? document.querySelector('#verify').textContent : '')), 5000, '牌牆核對 ✓');
    assert.strictEqual(await G2.evaluate(() => V.result.deltas.reduce((a, b) => a + b, 0)), 0);
    assert.ok(await G2.evaluate(() => V.result.hands.every(h => h.every(k => k >= 0 && k < 34))));
    for (const o of [host, g1, g2]) assert.deepStrictEqual(o.errors, []);
} finally { await browser.close(); }
console.log('ok  mahjong net e2e');
