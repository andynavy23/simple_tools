// 骰子遊戲 E2E：版面、大話骰單機整局（電腦對手 + 承諾核對）、Yahtzee 單機整局 / 統計 / 清除、連線大話骰（骰面不外洩、非法叫點被擋、斷線託管）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/dice-games.html';
const FAKE = () => {                      // 假 PeerJS（BroadcastChannel）
    const bc = new BroadcastChannel('fakepeer-dice'), peers = new Map();
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
        else if (m.k === 'd') { const c = p.conns.get(m.cid); if (c) c.emit('data', m.d); }
        else if (m.k === 'c') { const c = p.conns.get(m.cid); if (c && c.open) { c.open = false; c.emit('close'); } }
    };
    window.Peer = Peer;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(30); } throw new Error('逾時：' + what); };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const fill = (page, sel, v) => page.evaluate((s, v) => { document.querySelector(s).value = v; }, sel, v);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };
const layout = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(99, ...[...document.querySelectorAll('.wrap button:not(.sm)')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)), fs: Math.min(99, ...[...document.querySelectorAll('.wrap input:not([type=checkbox]),.wrap select')].filter(b => b.offsetParent).map(b => parseFloat(getComputedStyle(b).fontSize))) }));

const browser = await launchEdge();
try {
    // ---------- 單機大話骰 ----------
    {
        const { page, errors } = await newPage(browser);
        let m = await layout(page); assert.ok(m.sw <= m.iw && m.minH >= 44 && m.fs >= 16, JSON.stringify(m));
        await page.evaluate(() => { AI_MS = 0; });
        await fill(page, '#ncomp', '1'); await click(page, '#soloGo');
        await until(() => page.evaluate(() => V && V.game === 'ld'), 3000, '開局');
        let guard = 0, sawVerify = false;
        while (guard++ < 400) {
            const s = await page.evaluate(() => ({ ph: V.phase, mine: V.phase === 'bid' && V.turn === V.my, bid: !!V.bid, vf: (document.querySelector('#vf') || {}).textContent || '' }));
            if (s.ph === 'over') break;
            if (s.ph === 'reveal') { if (s.vf.includes('核對通過')) sawVerify = true; assert.ok(!s.vf.includes('失敗')); if (!sawVerify) { await sleep(60); continue; } await click(page, '#next'); await sleep(30); continue; }
            if (s.mine) { await click(page, s.bid ? '#callBtn' : '#bidBtn'); await sleep(30); } else await sleep(20);
            if (guard === 3) { m = await layout(page); assert.ok(m.sw <= m.iw && m.minH >= 44 && m.fs >= 16, JSON.stringify(m)); }
        }
        await until(() => page.evaluate(() => V.phase === 'over'), 5000, '整局結束');
        assert.ok(sawVerify, '看過承諾核對');
        assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dice_stats')).ld.p), 1);
        // 清除統計：只清 dice_stats，保留選項
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await page.evaluate(() => { localStorage.setItem('dice_opts', '{"wild":true}'); localStorage.setItem('other_key', '1'); });
        await Promise.all([page.waitForNavigation(), click(page, '#clearStats')]);
        assert.strictEqual(await page.evaluate(() => [localStorage.getItem('dice_stats'), localStorage.getItem('dice_opts'), localStorage.getItem('other_key')].join('|')), '|{"wild":true}|1');
        await page.evaluate(() => { localStorage.setItem('dice_stats', '"壞"'); location.reload(); }); await page.waitForNavigation();
        assert.ok((await text(page, '#sLd')).includes('還沒玩過'));
        await page.evaluate(() => { localStorage.removeItem('other_key'); localStorage.removeItem('dice_opts'); localStorage.removeItem('dice_stats'); });
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 單機 Yahtzee（對 1 個電腦） ----------
    {
        const { page, errors } = await newPage(browser);
        await page.evaluate(() => { AI_MS = 0; });
        await click(page, '#games [data-g=yz]'); await fill(page, '#ncomp', '1'); await click(page, '#soloGo');
        await until(() => page.evaluate(() => V && V.game === 'yz'), 3000, '開局');
        const m = await layout(page); assert.ok(m.sw <= m.iw && m.minH >= 44 && m.fs >= 16, JSON.stringify(m));
        let guard = 0;
        while (guard++ < 300) {
            const s = await page.evaluate(() => ({ ph: V.phase, mine: V.phase === 'play' && V.turn === V.my, rolls: V.rolls }));
            if (s.ph === 'over') break;
            if (!s.mine) { await sleep(20); continue; }
            if (s.rolls === 0) { await click(page, '#rollBtn'); await sleep(20); continue; }
            if (s.rolls === 1) { await click(page, '#dice [data-k="0"]'); assert.strictEqual(await page.evaluate(() => heldUi[0]), true); await click(page, '#rollBtn'); await sleep(20); continue; }
            await click(page, '.yz td button'); await sleep(20);
        }
        await until(() => page.evaluate(() => V.phase === 'over'), 8000, '結束');
        assert.ok((await text(page, '#st')).includes('結束'));
        assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('dice_stats')).yz.p), 1);
        await click(page, '#again'); assert.ok(await page.evaluate(() => !document.querySelector('#setup').hidden));
        // 單人刷分 → 最高分
        await fill(page, '#ncomp', '0'); await click(page, '#soloGo');
        await until(() => page.evaluate(() => V && V.seats.length === 1), 3000, '單人');
        await page.evaluate(() => { for (let i = 0; i < 13; i++) { apply(0, { k: 'roll', held: null }); apply(0, { k: 'score', c: V.seats[0].card.s.findIndex(x => x === null) }); } });
        await until(() => page.evaluate(() => V.phase === 'over'), 5000, '單人結束');
        assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('dice_stats')).yz.best) >= 0);
        await page.evaluate(() => localStorage.removeItem('dice_stats'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線大話骰 ----------
    const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
    await click(H, '#modes [data-m=net]'); await fill(H, '#nick', '房主'); await fill(H, '#ncomp', '0'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    await click(G, '#modes [data-m=net]'); await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
    await until(() => G.evaluate(() => V && V.lobby && V.names.length === 2), 5000, '加入');
    assert.ok(await G.evaluate(() => document.querySelector('#startBtn').hidden), '成員看不到開始鈕');
    await click(H, '#startBtn');
    await until(() => G.evaluate(() => V.game === 'ld' && !V.lobby && V.hand.length === 5), 5000, '開局');
    const gs = await G.evaluate(() => JSON.stringify(V)), hh = await H.evaluate(() => JSON.stringify(GS.st.hands));
    assert.ok(!gs.includes('"hands"'), '成員狀態不含全部骰子'); assert.ok(G && JSON.parse(hh).length === 2);
    assert.ok(await G.evaluate(() => V.commits.every(c => /^[0-9a-f]{64}$/.test(c))));
    const turn = await H.evaluate(() => GS.st.turn), cur = turn === 0 ? H : G, other = turn === 0 ? G : H;
    const sendA = (p, a) => p.evaluate((a) => send(a), a);
    await sendA(other, { k: 'bid', n: 1, f: 2 }); await sleep(250);
    assert.strictEqual(await H.evaluate(() => GS.st.bid), null, '非輪到的人叫點無效');
    await sendA(cur, { k: 'bid', n: 99, f: 2 }); await sleep(250);
    assert.strictEqual(await H.evaluate(() => GS.st.bid), null, '非法叫點被房主擋下');
    await sendA(cur, { k: 'call' }); await sleep(250);
    assert.strictEqual(await H.evaluate(() => GS.st.phase), 'bid', '第一手不能開');
    await sendA(cur, { k: 'bid', n: 2, f: 3 });
    await until(() => G.evaluate(() => V.bid && V.bid.n === 2), 3000, '叫點同步');
    await sendA(other, { k: 'call' });
    await until(() => G.evaluate(() => V.phase === 'reveal' && V.reveal), 3000, '開盅');
    await until(() => G.evaluate(() => document.querySelector('#vf').textContent.includes('核對通過')), 3000, '成員核對');
    await until(() => H.evaluate(() => document.querySelector('#vf').textContent.includes('核對通過')), 3000, '房主核對');
    assert.ok(await G.evaluate(() => document.querySelector('#next').hidden), '成員不能按下一輪');
    await click(H, '#next'); await until(() => G.evaluate(() => V.phase === 'bid' && V.round === 2), 3000, '下一輪');
    // 小明斷線 → 電腦託管；同暱稱重連接回
    await H.evaluate(() => { AI_MS = 50; });
    await G.close();
    await until(() => H.evaluate(() => GS.st.seats[1].ai === true), 5000, '託管');
    await until(() => H.evaluate(() => GS.st.seats[1].dice < 5 || GS.st.round > 2 || GS.st.phase !== 'bid' || GS.st.turn === 0), 5000, '託管者行動');
    const g2 = await newPage(browser); await click(g2.page, '#modes [data-m=net]'); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#joinBtn');
    await until(() => g2.page.evaluate(() => V && !V.lobby && V.my === 1), 5000, '重連');
    assert.ok(await H.evaluate(() => GS.st.seats[1].ai === false));
    for (const o of [host, g2]) assert.deepStrictEqual(o.errors, []);
    await H.close(); await g2.page.close();
} finally { await browser.close(); }
console.log('ok  dice-games e2e');
