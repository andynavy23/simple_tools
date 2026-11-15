// go9：單機（預覽確認落子、電腦回應、悔棋、存檔繼續、認輸與統計）、同機雙人（禁著提示、虛手進入數子與死子標記、SGF）、390px 版面、連線（假 PeerJS：走子、偽造非法手、悔棋 / 求和、數子確認、認輸、再來一局）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const REL = 'mini-games/go9.html';
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const waitFor = (page, fn, ...a) => page.waitForFunction(fn, { timeout: 15000, polling: 100 }, ...a);
const prep = (page) => ev(page, () => { window.confirm = () => true; window.alert = () => { }; });
const status = (page) => ev(page, () => document.querySelector('#status').textContent);
const pt = (r, c) => r * 9 + c;
// 用真正的 click 事件點棋盤上的交叉點（驗證座標換算）
const tap = (page, i) => ev(page, (i) => {
    const s = document.querySelector('#board'), b = s.getBoundingClientRect();
    s.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + (10 + 10 * (i % 9)) / 100 * b.width, clientY: b.top + (10 + 10 * Math.floor(i / 9)) / 100 * b.height }));
}, i);
const move = async (page, i) => { await tap(page, i); await click(page, '#ok'); };
const nMoves = (page) => ev(page, () => G.moves.length);

// ---------- 單機對電腦 ----------
{
    const { page, errors } = await openPage(browser, REL);
    await prep(page);
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '選單橫向溢出');
    await ev(page, () => { document.querySelector('#level').value = 'easy'; document.querySelector('#level').onchange(); });
    await click(page, '#cpu');
    await waitFor(page, () => !document.querySelector('#game').hidden);
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '棋局橫向溢出');
    assert.ok(await ev(page, () => document.querySelector('#board').getBoundingClientRect().width) > 340);
    assert.ok((await status(page)).includes('輪到你了'));
    // 點一下只是預覽，不落子；改選；再按確認才下
    await tap(page, pt(4, 4));
    assert.strictEqual(await nMoves(page), 0);
    assert.ok(await ev(page, () => pend === 40 && !document.querySelector('#ok').disabled));
    await tap(page, pt(2, 2));
    assert.strictEqual(await ev(page, () => pend), pt(2, 2));
    await click(page, '#ok');
    await waitFor(page, () => G.moves.length >= 2 && !thinking);              // 電腦回應
    assert.strictEqual(await ev(page, () => G.moves[0]), pt(2, 2));
    // 存檔
    const saved = await ev(page, () => JSON.parse(localStorage.getItem('go9_game')));
    assert.ok(saved && saved.v === 1 && saved.moves.length >= 2);
    // 提示
    await click(page, '#hint');
    assert.ok(await ev(page, () => hintI >= 0 || document.querySelector('#gameMsg').textContent.includes('虛手')));
    // 悔棋：連電腦的回應一起收回
    await click(page, '#undo');
    assert.strictEqual(await nMoves(page), 0);
    // 再下一步後重新整理 → 繼續上一局
    await move(page, pt(6, 6));
    await waitFor(page, () => G.moves.length >= 2 && !thinking);
    await page.reload();
    await ev(page, () => { window.confirm = () => true; });
    assert.ok(await ev(page, () => !document.querySelector('#resume').hidden), '應出現繼續上一局');
    await click(page, '#resume');
    await waitFor(page, () => !document.querySelector('#game').hidden && G.moves.length >= 2);
    assert.strictEqual(await ev(page, () => G.moves[0]), pt(6, 6));
    // 認輸 → 統計 +1 負、存檔清除
    await waitFor(page, () => !thinking);
    await click(page, '#resign');
    assert.ok((await status(page)).includes('獲勝'));
    assert.deepStrictEqual(await ev(page, () => JSON.parse(localStorage.getItem('go9_stats')).easy), [0, 1, 0]);
    assert.strictEqual(await ev(page, () => localStorage.getItem('go9_game')), null);
    assert.ok(await ev(page, () => !document.querySelector('#again').hidden));
    // 壞資料不會讓頁面壞
    await ev(page, () => { localStorage.setItem('go9_game', '{"v":1,"mode":"cpu","ko":"super","moves":[40,40]}'); localStorage.setItem('go9_opts', '[1]'); localStorage.setItem('go9_stats', '"x"'); });
    await page.reload();
    assert.ok(await ev(page, () => document.querySelector('#resume').hidden));
    assert.strictEqual(await ev(page, () => localStorage.getItem('go9_game')), null);
    assert.deepStrictEqual(errors, []);
    await page.close();
}

// ---------- 同機雙人：禁著、虛手、數子 ----------
{
    const { page, errors } = await openPage(browser, REL);
    await prep(page);
    await click(page, '#local');
    await move(page, pt(0, 1)); await move(page, pt(4, 4)); await move(page, pt(1, 0));
    await tap(page, pt(0, 0));                                                   // 白下角：自殺
    assert.ok(await ev(page, () => document.querySelector('#gameMsg').textContent.includes('禁著')));
    assert.strictEqual(await ev(page, () => pend), -1);
    await tap(page, pt(0, 1));                                                   // 已有子
    assert.ok(await ev(page, () => document.querySelector('#gameMsg').textContent.includes('已有棋子')));
    // 白 (2,2)，黑 (0,0) 與 (0,1)(1,0) 連成一塊，有氣，合法
    await move(page, pt(2, 2)); await move(page, pt(0, 0));
    assert.strictEqual(await ev(page, () => G.caps[1]), 0);
    // 雙方虛手 → 進入數子
    await click(page, '#pass'); await click(page, '#pass');
    assert.ok((await status(page)).includes('標記死子'));
    assert.ok(await ev(page, () => !document.querySelector('#scoreBox').hidden));
    assert.ok(await ev(page, () => document.querySelector('#ok').hidden));
    // 點白子 (4,4) 標為死子，再點取消
    await tap(page, pt(4, 4));
    assert.deepStrictEqual(await ev(page, () => dead), [pt(4, 4)]);
    await tap(page, pt(4, 4));
    assert.deepStrictEqual(await ev(page, () => dead), []);
    // 繼續對局：回到下棋狀態，輪替到白
    await click(page, '#resumeGame');
    assert.strictEqual(await ev(page, () => G.over), false);
    assert.ok((await status(page)).includes('輪到'));
    await click(page, '#pass'); await click(page, '#pass');
    await click(page, '#confirm');
    assert.ok((await status(page)).includes('獲勝'));                           // 黑 3 子 + 地 vs 白 2 子 + 貼目：結果會是某一方勝
    const sgf = await ev(page, () => sgfText());
    assert.ok(sgf.startsWith('(;GM[1]') && sgf.includes(';B[ba]') && sgf.includes('RE['));
    assert.deepStrictEqual(errors, []);
    await page.close();
}

// ---------- 連線（假 PeerJS：測試端轉送訊息）----------
const installFake = () => {
    if (window.__fake) return; window.__fake = true;
    const peers = {};
    class Emitter { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); } }
    class Conn extends Emitter {
        constructor(owner, remote, cid) { super(); this.owner = owner; this.peer = remote; this.cid = cid; this.open = false; }
        send(d) { if (!this.open) throw new Error('closed'); window.__hub({ k: 'data', cid: this.cid, to: this.peer, d: JSON.parse(JSON.stringify(d)) }); }
        close() { if (!this.open) return; this.open = false; window.__hub({ k: 'close', cid: this.cid, to: this.peer }); setTimeout(() => this.emit('close'), 0); }
    }
    class Peer extends Emitter {
        constructor() { super(); this.conns = {}; window.__hub({ k: 'id' }).then(id => { this.id = id; peers[id] = this; this.emit('open', id); }); }
        connect(id) { const cid = Math.random().toString(36).slice(2), c = new Conn(this, id, cid); this.conns[cid] = c; window.__hub({ k: 'connect', from: this.id, to: id, cid }); return c; }
        destroy() { Object.values(this.conns).forEach(c => c.close()); window.__hub({ k: 'gone', id: this.id }); delete peers[this.id]; }
    }
    window.Peer = Peer;
    window.__deliver = (e) => {
        const p = peers[e.to]; if (!p) return;
        if (e.k === 'conn') { const c = new Conn(p, e.from, e.cid); p.conns[e.cid] = c; c.open = true; p.emit('connection', c); c.emit('open'); }
        else if (e.k === 'open') { const c = p.conns[e.cid]; if (c) { c.open = true; c.emit('open'); } }
        else if (e.k === 'data') { const c = p.conns[e.cid]; if (c && c.open) c.emit('data', e.d); }
        else if (e.k === 'close') { const c = p.conns[e.cid]; if (c && c.open) { c.open = false; c.emit('close'); } }
        else if (e.k === 'err') p.emit('error', { type: e.type });
    };
};
{
    const where = new Map(); let n = 0, chain = Promise.resolve();
    const hubFor = (page) => (m) => {
        if (m.k === 'id') { const id = 'fp' + (++n); where.set(id, page); return id; }
        chain = chain.then(async () => {
            const send = (id, e) => { const pg = where.get(id); return pg ? pg.evaluate((x) => window.__deliver && window.__deliver(x), { ...e, to: id }).catch(() => { }) : null; };
            if (m.k === 'connect') { if (!where.has(m.to)) await send(m.from, { k: 'err', type: 'peer-unavailable' }); else { await send(m.to, { k: 'conn', from: m.from, cid: m.cid }); await send(m.from, { k: 'open', cid: m.cid }); } }
            else if (m.k === 'data' || m.k === 'close') await send(m.to, { k: m.k, from: m.from, cid: m.cid, d: m.d });
            else if (m.k === 'gone') where.delete(m.id);
        });
    };
    const mk = async () => {
        const { page, errors } = await openPage(browser, REL);
        await page.exposeFunction('__hub', hubFor(page));
        await page.evaluateOnNewDocument(`(${installFake.toString()})()`);
        await ev(page, installFake); await prep(page);
        return { page, errors };
    };
    const A = await mk(), B = await mk(), hp = A.page, gp = B.page;
    await ev(hp, () => { document.querySelector('#nick').value = '房主'; document.querySelector('#tmin').value = '5'; });
    await click(hp, '#host');
    await waitFor(hp, () => typeof hostId === 'string' && hostId && !document.querySelector('#game').hidden);
    const hostId = await ev(hp, () => hostId);
    assert.ok((await status(hp)).includes('等待對手'));
    await ev(gp, (id) => { document.querySelector('#nick').value = '客人'; document.querySelector('#joinId').value = id; }, hostId);
    await click(gp, '#join');
    await waitFor(gp, () => !document.querySelector('#game').hidden && document.querySelector('#status').textContent.includes('輪到'));
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('輪到你了'));
    assert.ok((await ev(hp, () => document.querySelector('#botBar .clock').textContent)).match(/^[45]:\d\d$/));
    // 房主（黑）下天元，客人（白）收到
    await move(hp, pt(4, 4));
    await waitFor(gp, () => G && G.moves.length === 1 && document.querySelector('#status').textContent.includes('輪到你了'));
    // 客人偽造：下已有子的點、越界、錯誤型別、不是自己的回合（房主回合時）
    await ev(gp, () => { room.send({ type: 'MOVE', i: 40 }); });
    await waitFor(gp, () => document.querySelector('#gameMsg').textContent.includes('已有棋子'));
    await ev(gp, () => { room.send({ type: 'MOVE', i: 81 }); room.send({ type: 'MOVE', i: 'x' }); room.send({ type: 'MOVE', i: 1.5 }); room.send({ type: 'BOGUS' }); room.send('hi'); room.send(null); room.send({ type: 'RESIGN', side: 1 }); });
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('獲勝'));     // 認輸只算送訊息者自己 → 房主贏
    assert.ok((await status(hp)).includes('你 獲勝'));
    assert.deepStrictEqual(await ev(hp, () => stats.net), [1, 0, 0]);
    await click(gp, '#again');                                                  // 換色：房主執白、客人執黑
    await waitFor(hp, () => G.moves.length === 0 && !res && hostSide === 2);
    await waitFor(gp, () => G.moves.length === 0 && !res && document.querySelector('#status').textContent.includes('輪到你了'));
    // 房主（白）偽造：黑的回合下棋 → 被拒
    await ev(hp, () => hostAct(2, { type: 'MOVE', i: 3 }));
    assert.strictEqual(await nMoves(hp), 0);
    await move(gp, pt(2, 2));
    await waitFor(hp, () => G.moves.length === 1);
    // 悔棋請求：客人（黑）請求 → 房主同意
    await click(gp, '#undo');
    await waitFor(hp, () => !document.querySelector('#req').hidden && document.querySelector('#reqText').textContent.includes('悔棋'));
    await click(hp, '#reqYes');
    await waitFor(gp, () => G.moves.length === 0);
    // 虛手 x2 → 數子；雙方確認
    await click(gp, '#pass'); await waitFor(hp, () => G.moves.length === 1);
    await click(hp, '#pass');
    await waitFor(gp, () => G.over);
    await waitFor(hp, () => !document.querySelector('#scoreBox').hidden);
    await click(hp, '#confirm');
    await waitFor(gp, () => conf[1] === true);
    assert.ok(await ev(gp, () => !res));
    await click(gp, '#confirm');
    await waitFor(hp, () => res && res.why === 'score');
    await waitFor(gp, () => res && res.why === 'score');                          // 空盤：白贏（貼目）
    assert.strictEqual(await ev(gp, () => res.w), 2);
    // 求和（新局）
    await click(gp, '#again');
    await waitFor(hp, () => !res && G.moves.length === 0);
    await click(hp, '#draw');
    await waitFor(gp, () => !document.querySelector('#req').hidden && document.querySelector('#reqText').textContent.includes('和棋'));
    await click(gp, '#reqYes');
    await waitFor(hp, () => res && res.why === 'draw');
    assert.deepStrictEqual(await ev(hp, () => stats.net), [2, 0, 1]);
    assert.deepStrictEqual(A.errors, []); assert.deepStrictEqual(B.errors, []);
    await A.page.close(); await B.page.close();
}
console.log('go9 e2e ok');
await browser.close();
