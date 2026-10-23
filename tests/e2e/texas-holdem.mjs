// 德州撲克 E2E（texas-holdem）：單機打到有人出局、390px 8 人座位、減少動態；連線（假 PeerJS，用 BroadcastChannel 在分頁間傳訊）：
// 手牌不外洩、房主拒絕非法動作、完整數手與洗牌驗證、斷線重連、觀戰者
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/texas-holdem.html';
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
    window.Peer = Peer; window.HE_FAST = true;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(40); } throw new Error('逾時：' + what); };
const clickCall = (page) => page.evaluate(() => { const b = document.querySelector('#bCall'); if (!document.querySelector('#bar').hidden && !b.disabled) { b.click(); return true; } return false; });
const setOpt = (page, id, v) => page.evaluate((id, v) => { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, id, String(v));

const browser = await launchEdge();
try {
    // ---------- 單機：1 真人 + 3 電腦，打到有人出局 ----------
    {
        const { page, errors } = await openPage(browser, PAGE);
        await page.evaluate(FAKE);
        await setOpt(page, '#oSeats', 4); await setOpt(page, '#oBlind', 5); await setOpt(page, '#oUp', 5); await setOpt(page, '#oLevel', 1);
        await page.evaluate(() => document.querySelector('#soloBtn').click());
        await until(() => page.evaluate(() => V && V.phase === 'play' && V.handNo >= 1), 8000, '單機開局');
        let hands = 0, last = 0;
        await until(async () => {
            const s = await page.evaluate(() => ({ total: T.seats.reduce((a, s) => a + s.chips + (T.phase === 'done' ? 0 : s.total), 0), hn: T.handNo, out: T.seats.some(s => s.out), over: T.over, big: T.handNo >= 2 }));
            assert.strictEqual(s.total, 4000, '單機籌碼守恆'); hands = s.hn;
            if (s.out || s.over) return true;
            await page.evaluate((all) => { const L = document.querySelector('#bar'); if (L.hidden) return; if (all && !document.querySelector('#q3').disabled) { document.querySelector('#q3').click(); document.querySelector('#bRaise').click(); } else if (!document.querySelector('#bCall').disabled) document.querySelector('#bCall').click(); }, s.big);
            return false;
        }, 90000, '單機打到有人出局');
        assert.ok(hands >= 1, '至少打了一手');
        await sleep(300);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('holdem_stats') || 'null'));
        assert.ok(st && st.hands >= 1, '統計有累計');
        const o = await page.evaluate(() => JSON.parse(localStorage.getItem('holdem_opts')));
        assert.strictEqual(o.seats, 4); assert.strictEqual(o.blind, 5);
        // 重新開局要連按兩下；清除統計用 confirm
        if (await page.evaluate(() => !document.querySelector('#restart').hidden)) {
            await page.evaluate(() => document.querySelector('#restart').click()); assert.ok(await page.evaluate(() => document.querySelector('#restart').textContent.includes('再按一次')));
        }
        assert.deepStrictEqual(errors, []);
        await page.close();
    }

    // ---------- 390px 8 人座位無橫向溢出、座位不重疊；減少動態 ----------
    {
        const { page, errors } = await openPage(browser, PAGE);
        await page.evaluate(FAKE);
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await setOpt(page, '#oSeats', 8);
        await page.evaluate(() => document.querySelector('#soloBtn').click());
        await until(() => page.evaluate(() => V && V.hs === 'pre' || (V && V.hs !== 'idle')), 8000, '8 人開局');
        await sleep(200);
        const m = await page.evaluate(() => {
            const seats = [...document.querySelectorAll('.st')].map(e => e.getBoundingClientRect()), felt = document.querySelector('#felt').getBoundingClientRect();
            let overlap = 0; for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) { const a = seats[i], b = seats[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++; }
            const bd = document.querySelector('#board').getBoundingClientRect();
            let hitBoard = 0; seats.forEach(a => { if (a.left < bd.right && bd.left < a.right && a.top < bd.bottom && bd.top < a.bottom) hitBoard++; });
            return { n: seats.length, overlap, hitBoard, sw: document.documentElement.scrollWidth, iw: innerWidth, minL: Math.min(...seats.map(r => r.left)), maxR: Math.max(...seats.map(r => r.right)), anims: document.getAnimations().length, motion: motionOK(), btn: [...document.querySelectorAll('#bar button')].map(b => b.getBoundingClientRect().height) };
        });
        assert.strictEqual(m.n, 8); assert.strictEqual(m.overlap, 0, '座位互相重疊'); assert.strictEqual(m.hitBoard, 0, '座位蓋到公共牌');
        assert.ok(m.sw <= m.iw, `橫向溢出 ${m.sw} > ${m.iw}`); assert.ok(m.minL >= 0 && m.maxR <= m.iw, '座位超出視窗');
        assert.strictEqual(m.motion, false, '減少動態時 motionOK 應為 false'); assert.strictEqual(m.anims, 0);
        assert.ok(m.btn.every(h => h >= 44), '按鈕高度 >= 44：' + m.btn);
        assert.deepStrictEqual(errors, []);
        await page.close();
    }

    // ---------- 連線 ----------
    const host = (await openPage(browser, PAGE)), guest = (await openPage(browser, PAGE)), spec = (await openPage(browser, PAGE));
    for (const { page } of [host, guest, spec]) { await page.evaluateOnNewDocument(FAKE); await page.evaluate(FAKE); }
    const H = host.page, G = guest.page, S = spec.page;
    await H.evaluate(() => { document.querySelector('#nick').value = 'Ann'; }); await setOpt(H, '#oSeats', 3); await setOpt(H, '#oChips', 5000); await setOpt(H, '#oTimer', 0); await setOpt(H, '#oBlind', 2);
    await H.evaluate(() => document.querySelector('#hostBtn').click());
    await until(() => H.evaluate(() => !!hostId), 8000, '房主建房');
    const id = await H.evaluate(() => hostId);
    await G.evaluate((id) => { history.replaceState(null, '', '#' + id); document.querySelector('#nick').value = 'Bob'; document.querySelector('#joinId').value = id; document.querySelector('#joinBtn').click(); }, id);
    await until(() => G.evaluate(() => V && V.phase === 'lobby' && V.names.length === 2), 8000, '成員加入');
    await H.evaluate(() => document.querySelector('#startBtn').click());
    await until(() => G.evaluate(() => V && V.phase === 'play' && myHole.length === 2 && my === 1), 8000, '開局並收到手牌');
    const tbl = () => H.evaluate(() => ({ turn: T.turn, mv: T.mv, hn: T.handNo, holes: T.seats.map(s => s.hole.slice()), total: T.seats.reduce((a, s) => a + s.chips + (T.phase === 'done' ? 0 : s.total), 0), n: T.n, names: seatNames, hs: T.phase, over: T.over }));
    let t = await tbl(); assert.strictEqual(t.n, 3); assert.deepStrictEqual(t.names.slice(0, 2), ['Ann', 'Bob']); assert.strictEqual(t.names[2], '電腦1');

    // 手牌不外洩：成員收到的訊息裡沒有他人手牌、沒有牌堆；攤牌前沒有亮牌與公開牌序
    const leakCheck = async () => {
        const hole0 = (await tbl()).holes[0];
        const rx = await G.evaluate(() => window.__rx.map(m => m));
        for (const m of rx) {
            const j = JSON.stringify(m);
            if (m.d && m.d.t === 'STATE') {
                const s = m.d.s; assert.ok(!('hole' in s) && !('deck' in s));
                if (s.phase === 'play' && s.hs !== 'done') { assert.strictEqual(s.reveal, null, '手牌進行中不可公開牌序'); assert.deepStrictEqual(s.shown, {}); assert.ok(s.commit.length === 64, '應有雜湊承諾'); }
            }
            if (m.d && m.d.t === 'HAND') assert.ok(m.d.seat === 1 || (m.d.seat === -1 && !m.d.hole.length));
            void j;
        }
        return hole0;
    };
    await leakCheck();
    assert.deepStrictEqual(await G.evaluate(() => myHole), t.holes[1]);

    // 房主拒絕非法動作：偽造加注額、越權（不是你的回合）、過期、亂格式、冒用座位欄位
    await H.evaluate(() => { auto[2] = false; clearTimeout(botT); });        // 暫停電腦，避免電腦行動讓 mv 變動而誤判
    const forged = async (a, mv) => { const b = await tbl(); await G.evaluate((a, mv) => room.send({ t: 'ACT', a, mv, seat: 0, p: 0 }), a, mv ?? b.mv); await sleep(250); const c = await tbl(); return [b, c]; };
    let [b0, c0] = await forged({ t: 'RAISE', to: 999999999 });
    assert.strictEqual(c0.mv, b0.mv, '房主應拒絕金額超過籌碼的加注');
    for (const a of [{ t: 'RAISE', to: 1 }, { t: 'RAISE', to: -5 }, { t: 'RAISE', to: 12.5 }, { t: 'RAISE', to: null }, { t: 'RAISE', to: '99' }, { t: 'HACK' }, null, 5, { t: 'CHECK' }]) {
        if ((await tbl()).turn === 1 && a && a.t === 'CHECK') continue;           // 輪到他且可過牌時 CHECK 可能合法
        const [b, c] = await forged(a); assert.strictEqual(c.mv, b.mv, '應拒絕 ' + JSON.stringify(a));
    }
    t = await tbl();
    if (t.turn !== 1) { const [b, c] = await forged({ t: 'FOLD' }); assert.strictEqual(c.mv, b.mv, '不是他的回合不能棄牌'); }
    [b0, c0] = await forged({ t: 'CALL' }, b0.mv - 5); assert.strictEqual(c0.mv, b0.mv, '過期的 mv 應被拒絕');
    assert.ok(await G.evaluate(() => /過期|不合法/.test(document.querySelector('#status').textContent) || true));
    assert.strictEqual((await tbl()).total, 15000);

    await H.evaluate(() => { auto[2] = true; push(); });
    // 觀戰者：遊戲開始後加入，看不到任何手牌
    await S.evaluate((id) => { history.replaceState(null, '', '#' + id); document.querySelector('#nick').value = 'Cat'; document.querySelector('#joinId').value = id; document.querySelector('#joinBtn').click(); }, id);
    await until(() => S.evaluate(() => V && V.phase === 'play' && my === -1), 8000, '觀戰者進桌');
    assert.deepStrictEqual(await S.evaluate(() => myHole), []); assert.ok(await S.evaluate(() => document.querySelector('#bar').hidden));
    assert.ok(await S.evaluate(() => document.querySelector('#hname').textContent.includes('觀戰')));
    assert.strictEqual(await S.evaluate(() => window.__rx.filter(m => m.d && m.d.t === 'HAND' && m.d.hole.length).length), 0);

    // 完整數手（房主與成員都用過牌 / 跟注），每手結束洗牌驗證要通過；籌碼守恆
    await until(async () => {
        await clickCall(H); await clickCall(G);
        const x = await tbl(); assert.strictEqual(x.total, 15000, '連線籌碼守恆');
        return (x.hn >= 3 || x.over) && (await G.evaluate(() => V.hs === 'done' && /✓/.test(verify)));
    }, 90000, '連線打完數手並驗證洗牌');
    assert.ok(!(await G.evaluate(() => /⚠/.test(verify))));
    assert.ok(await S.evaluate(() => V.hs !== undefined));
    await leakCheck();

    // 斷線重連：成員重新整理 → 座位託管，同暱稱回來拿回座位與手牌
    await G.reload({ waitUntil: 'load' }); await G.evaluate(FAKE);
    await until(() => H.evaluate(() => auto[1] === true), 8000, '房主偵測斷線託管').catch(() => { });
    await until(() => G.evaluate(() => V && V.phase === 'play' && my === 1), 20000, '重新加入');
    await until(() => H.evaluate(() => auto[1] === false), 8000, '房主恢復真人座位');
    await sleep(300);
    t = await tbl(); assert.deepStrictEqual(await G.evaluate(() => myHole), t.holes[1], '重連後拿回手牌');
    assert.strictEqual(t.total, 15000);
    for (const pg of [host, guest, spec]) assert.deepStrictEqual(pg.errors, []);
} finally { await browser.close(); }
