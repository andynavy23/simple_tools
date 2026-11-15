// 跳棋 E2E：單機（點選 / 連跳 / 電腦回應 / 戰績清除）、同機輪流、連線（假 PeerJS）：開局、非法步被房主擋下、成員走棋、斷線電腦代打、同暱稱重連
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/chinese-checkers.html';
const FAKE = () => {
    const bc = new BroadcastChannel('fakepeer-ck'), peers = new Map();
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
const until = async (fn, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return; await sleep(40); } throw new Error('逾時：' + what); };
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const fill = (page, sel, v) => page.evaluate((s, v) => { document.querySelector(s).value = v; }, sel, v);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const cell = (page, i) => page.evaluate((i) => { const e = document.querySelector(`#board [data-i="${i}"]:not(.dest)`) || document.querySelector(`#board .dest[data-i="${i}"]`); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, i);
const destCell = (page, i) => page.evaluate((i) => document.querySelector(`#board .dest[data-i="${i}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };

const browser = await launchEdge();
try {
    // ---------- 單機 ----------
    {
        const { page, errors } = await newPage(browser);
        const lay = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
        assert.ok(lay.sw <= lay.iw, JSON.stringify(lay));
        await fill(page, '#n', '3'); await page.evaluate(() => document.querySelector('#n').dispatchEvent(new Event('change')));
        assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chkr_opts')).n), 3);
        await click(page, '#solo');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#board .pc').length), 30);
        // 點對手的棋子不會選取；點自己的棋子會亮出落點
        const foe = await page.evaluate(() => G.board.findIndex(v => v === 1));
        await cell(page, foe); assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#board .dest').length), 0);
        const mv = await page.evaluate(() => { const a = ckAllMoves(G.board, 0)[0]; return a; });
        await cell(page, mv.from);
        assert.ok(await page.evaluate(() => document.querySelectorAll('#board .dest').length) > 0);
        await destCell(page, mv.to);
        assert.strictEqual(await page.evaluate((t) => G.board[t], mv.to), 0);
        // 電腦回應：兩家電腦依序走完，輪回自己
        await until(() => page.evaluate(() => G.turn === 0 && G.mv[1] === 1 && G.mv[2] === 1), 6000, '電腦回應');
        // 落點確認：第一次點只預覽
        await click(page, '#cfBtn');
        const m2 = await page.evaluate(() => ckAllMoves(G.board, 0)[0]);
        await cell(page, m2.from); await destCell(page, m2.to);
        assert.strictEqual(await page.evaluate((t) => G.board[t], m2.to), -1); assert.ok(await page.evaluate(() => !!document.querySelector('#board .pv')));
        await destCell(page, m2.to); assert.strictEqual(await page.evaluate((t) => G.board[t], m2.to), 0);
        // 房主之外的非法步（直接餵）被拒
        assert.strictEqual(await page.evaluate(() => submit(0, [1]) === undefined && gameMsg('') === undefined), true);
        // 勝利計入戰績、清除
        await page.evaluate(() => { G.winner = 0; G.why = 'win'; G.mv[0] = 42; onOver(); });
        assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chkr_stats')).s3), [1, 0, 42]);
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await Promise.all([page.waitForNavigation(), click(page, '#clrAll')]);
        assert.strictEqual(await page.evaluate(() => '' + localStorage.getItem('chkr_stats') + localStorage.getItem('chkr_opts')), 'nullnull');
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 同機輪流（4 人）----------
    {
        const { page, errors } = await newPage(browser);
        await fill(page, '#n', '4'); await page.evaluate(() => document.querySelector('#n').dispatchEvent(new Event('change')));
        await click(page, '#local');
        for (let k = 0; k < 4; k++) {
            const t = await page.evaluate(() => G.turn); assert.strictEqual(t, k);
            const mv = await page.evaluate(() => ckAllMoves(G.board, G.turn)[0]);
            await cell(page, mv.from); await destCell(page, mv.to);
        }
        assert.strictEqual(await page.evaluate(() => G.turn), 0);
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線（3 人房：房主 + 1 成員 + 1 電腦）----------
    const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
    await fill(H, '#n', '3'); await H.evaluate(() => document.querySelector('#n').dispatchEvent(new Event('change')));
    await fill(H, '#nick', '房主'); await click(H, '#host');
    await until(() => H.evaluate(() => mode === 'host' && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#join');
    await until(() => G.evaluate(() => mode === 'guest' && gSeats.length === 3 && gSeats[1].human), 5000, '加入');
    assert.ok(await G.evaluate(() => document.querySelector('#start').hidden), '成員沒有開始鈕');
    await click(H, '#start');
    await until(() => G.evaluate(() => !!G && G.n === 3), 3000, '成員收到棋局');
    // 房主先走，座位 1 的小明接著走；座位 2 是電腦自動走
    const hm = await H.evaluate(() => ckAllMoves(G.board, 0)[0]);
    await cell(H, hm.from); await destCell(H, hm.to);
    await until(() => G.evaluate(() => G.turn === 1), 3000, '輪到小明');
    // 非法：不是自己的棋子 / 亂編路徑，被房主拒絕且盤面不變
    const before = await H.evaluate(() => ckEnc(G.board));
    await G.evaluate(() => { room.send({ type: 'MOVE', from: 0, path: [1] }); room.send({ type: 'MOVE', from: G.board.findIndex(v => v === 1), path: [120, 5, 7] }); room.send({ type: 'MOVE', from: 'x', path: null }); });
    await sleep(300);
    assert.strictEqual(await H.evaluate(() => ckEnc(G.board)), before);
    const gm = await G.evaluate(() => ckAllMoves(G.board, 1)[0]);
    await cell(G, gm.from); await destCell(G, gm.to);
    await until(() => H.evaluate((t) => G.board[t] === 1, gm.to), 3000, '房主收到成員的步');
    await until(() => H.evaluate(() => G.turn === 0 && G.mv[2] === 1), 6000, '電腦補位走完');
    // 非輪到時送步會被拒
    const b2 = await H.evaluate(() => ckEnc(G.board));
    await G.evaluate(() => { const a = ckAllMoves(G.board, 1)[0]; room.send({ type: 'MOVE', from: a.from, path: a.path }); });
    await sleep(300); assert.strictEqual(await H.evaluate(() => ckEnc(G.board)), b2);
    // 成員斷線：輪到該座位時由電腦代打；同暱稱重連接回
    const hm2 = await H.evaluate(() => ckAllMoves(G.board, 0)[0]);
    await G.close();
    await until(() => H.evaluate(() => room.players[1] && !room.players[1].connected), 5000, '偵測斷線');
    await cell(H, hm2.from); await destCell(H, hm2.to);
    await until(() => H.evaluate(() => G.mv[1] === 2), 6000, '電腦代打離線座位');
    const g2 = await newPage(browser); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#join');
    await until(() => g2.page.evaluate(() => mode === 'guest' && !!G && room.myIndex === 1), 5000, '重連');
    assert.strictEqual(await g2.page.evaluate(() => ckEnc(G.board)), await H.evaluate(() => ckEnc(G.board)));
    // 遊戲進行中，陌生暱稱不能插入
    const g3 = await newPage(browser); await fill(g3.page, '#nick', '路人'); await fill(g3.page, '#joinId', id); await click(g3.page, '#join');
    await until(() => g3.page.evaluate(() => document.querySelector('#netMsg').textContent.includes('進行中')), 5000, '陌生人被拒');
    for (const o of [host, g2, g3]) assert.deepStrictEqual(o.errors, []);
    await H.close(); await g2.page.close(); await g3.page.close();
} finally { await browser.close(); }
console.log('ok  chinese-checkers e2e');
