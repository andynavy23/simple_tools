// 1A2B E2E：單機（出題 / 最少步數 / 清除）、電腦來猜、連線（假 PeerJS，用 BroadcastChannel 在分頁間傳訊）：
// 雙方設定密碼、承諾與核對、非法猜測被房主擋下、結束揭露、斷線後同暱稱重連
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/guess-ab.html';
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
const mode = (page, m) => click(page, `#modes [data-m=${m}]`);
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };

const browser = await launchEdge();
try {
    // ---------- 我來猜 ----------
    {
        const { page, errors } = await newPage(browser);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(...[...document.querySelectorAll('.wrap button:not(.sm)')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)), fs: getComputedStyle(document.querySelector('#gMe')).fontSize }));
        assert.ok(m.sw <= m.iw && m.minH >= 44 && parseFloat(m.fs) >= 16, JSON.stringify(m));
        await page.evaluate(() => { me.secret = '1234'; });
        await fill(page, '#gMe', '1123'); await click(page, '#goMe');
        assert.ok((await text(page, '#stMe')).includes('不能重複')); assert.strictEqual(await page.evaluate(() => me.hist.length), 0);
        await fill(page, '#gMe', '1243'); await click(page, '#goMe');
        assert.ok((await text(page, '#hMe')).includes('2A2B'));
        await fill(page, '#gMe', '1234'); await click(page, '#goMe');
        assert.ok((await text(page, '#stMe')).includes('共 2 步'));
        assert.strictEqual(await page.evaluate(() => localStorage.getItem('ab_best_4d')), '2');
        // 較差的成績不覆蓋；壞資料被忽略
        await page.evaluate(() => { newMe(); me.secret = '1234'; }); await fill(page, '#gMe', '5678'); await click(page, '#goMe'); await fill(page, '#gMe', '1234'); await click(page, '#goMe');
        assert.strictEqual(await page.evaluate(() => localStorage.getItem('ab_best_4d')), '2');
        await page.evaluate(() => { localStorage.setItem('ab_best_4d', '"x"'); showBest(); });
        assert.ok((await text(page, '#bestMe')).includes('還沒有'));
        // 3 位、可重複
        await page.evaluate(() => { const l = document.querySelector('#len'); l.value = '3'; l.dispatchEvent(new Event('change')); const d = document.querySelector('#dup'); d.value = '1'; d.dispatchEvent(new Event('change')); me.secret = '112'; });
        await fill(page, '#gMe', '111'); await click(page, '#goMe'); assert.ok((await text(page, '#hMe')).includes('2A0B'));
        // 清除最佳紀錄（只清 ab_best_*）
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await page.evaluate(() => { localStorage.setItem('ab_best_5u', '9'); localStorage.setItem('other_key', '1'); });
        await Promise.all([page.waitForNavigation(), click(page, '#clearBest')]);
        assert.strictEqual(await page.evaluate(() => [localStorage.getItem('ab_best_5u'), localStorage.getItem('other_key')].join()), ',1');
        await page.evaluate(() => localStorage.removeItem('other_key'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 電腦來猜：4 位不重複 7 步內猜中 ----------
    {
        const { page, errors } = await newPage(browser);
        await mode(page, 'ai'); await fill(page, '#sAi', '9876'); await click(page, '#goAi');
        await until(() => page.evaluate(() => ai && ai.over), 20000, '電腦猜中');
        const n = await page.evaluate(() => ai.hist.length); assert.ok(n <= 7 && (await text(page, '#stAi')).includes('猜中'), '步數 ' + n);
        await fill(page, '#sAi', '1123'); await click(page, '#goAi'); assert.ok((await text(page, '#stAi')).includes('不能重複'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線 ----------
    const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
    await mode(H, 'net'); await fill(H, '#nick', '房主'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    await mode(G, 'net'); await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
    await until(() => G.evaluate(() => V && V.names.length === 2), 5000, '加入');
    await until(() => H.evaluate(() => !document.querySelector('#startBtn').disabled), 3000, '可開始');
    assert.ok(await G.evaluate(() => document.querySelector('#startBtn').hidden), '成員看不到開始鈕');
    await click(H, '#startBtn');
    await until(() => G.evaluate(() => V.phase === 'set' && !document.querySelector('#rowSet').hidden), 3000, '設定密碼階段');
    await G.evaluate(() => room.send({ t: 'SECRET', s: '1123' })); await sleep(200);          // 不合法密碼被房主擋下
    assert.strictEqual(await H.evaluate(() => H.secrets[1]), null);
    await fill(H, '#sNet', '1234'); await click(H, '#setBtn');
    await fill(G, '#sNet', '5678'); await click(G, '#setBtn');
    await until(() => G.evaluate(() => V.phase === 'play'), 3000, '開始猜');
    const gs = await G.evaluate(() => JSON.stringify(V)); assert.ok(!gs.includes('1234') && !gs.includes('5678'), '狀態不外洩密碼');
    assert.ok(await G.evaluate(() => V.commits.length === 2 && V.commits.every(c => /^[0-9a-f]{64}$/.test(c))));
    const turn = await H.evaluate(() => H.turn), other = turn === 0 ? G : H, cur = turn === 0 ? H : G;
    await other.evaluate(() => { if (isHost) doGuess(0, '1234'); else room.send({ t: 'GUESS', g: '1234' }); }); await sleep(200);
    assert.strictEqual(await H.evaluate(() => H.hist.length), 0, '非輪到的人猜不算');
    await cur.evaluate(() => { if (isHost) doGuess(0, '1123'); else room.send({ t: 'GUESS', g: '1123' }); }); await sleep(200);
    assert.strictEqual(await H.evaluate(() => H.hist.length), 0, '非法格式不算');
    if (turn === 0) { await fill(H, '#gNet', '0123'); await click(H, '#goNet'); await until(() => G.evaluate(() => V.turn === 1), 2000, '換小明'); }
    await fill(G, '#gNet', '1234'); await click(G, '#goNet');
    await until(() => G.evaluate(() => V.phase === 'over'), 3000, '結束');
    assert.strictEqual(await G.evaluate(() => V.winner), 1);
    await until(() => G.evaluate(() => document.querySelector('#hNet').textContent.includes('核對通過')), 3000, '成員核對');
    await until(() => H.evaluate(() => document.querySelector('#hNet').textContent.includes('核對通過')), 3000, '房主核對');
    assert.ok((await text(G, '#hNet')).includes('1234') && (await text(G, '#hNet')).includes('5678'));
    // 再來一局 → 小明斷線 → 同暱稱重連回到原對局
    await click(H, '#again'); await until(() => G.evaluate(() => V.phase === 'lobby'), 3000, '回大廳');
    await click(H, '#startBtn'); await until(() => G.evaluate(() => V.phase === 'set'), 3000, '第二局');
    await fill(H, '#sNet', '1234'); await click(H, '#setBtn'); await fill(G, '#sNet', '5678'); await click(G, '#setBtn');
    await until(() => H.evaluate(() => H.phase === 'play'), 3000, '第二局開始');
    await G.close();
    await until(() => H.evaluate(() => V.active[1] === false), 5000, '偵測斷線');
    assert.ok((await text(H, '#stNet')).includes('離線'));
    const g2 = await newPage(browser); await mode(g2.page, 'net'); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#joinBtn');
    await until(() => g2.page.evaluate(() => V && V.phase === 'play' && V.active[1]), 5000, '重連回到對局');
    assert.ok(await H.evaluate(() => V.active[1]));
    for (const o of [host, g2]) assert.deepStrictEqual(o.errors, []);
    await H.close(); await g2.page.close();
} finally { await browser.close(); }
console.log('ok  guess-ab e2e');
