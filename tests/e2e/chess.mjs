// chess：單機（走子 / 悔棋 / 提示 / 升變 / 電腦回應 / 存檔 / 統計）、減少動態效果、390px 版面、連線（假 PeerJS 由測試端轉送：走子、偽造非法步、悔棋與和棋請求、重連、逾時、認輸、再來一局）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const REL = 'mini-games/chess.html';

const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const sq = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);
const clickSq = (page, n) => ev(page, (s) => document.querySelector(`#board [data-sq="${s}"]`).click(), sq(n));
const play = async (page, a, b) => { await clickSq(page, a); await clickSq(page, b); };
const movesText = (page) => ev(page, () => [...document.querySelectorAll('#moves span')].map(s => s.textContent).join(' '));
const status = (page) => ev(page, () => document.querySelector('#status').textContent);
const waitFor = (page, fn, ...a) => page.waitForFunction(fn, { timeout: 15000, polling: 150 }, ...a);
const prep = (page) => ev(page, () => { window.confirm = () => true; window.alert = () => { }; });

// ---------- 單機 ----------
{
    const { page, errors } = await openPage(browser, REL);
    await prep(page);
    // 390px 無橫向溢出（選單與棋局）
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '選單橫向溢出');
    await ev(page, () => { document.querySelector('#level').value = 'easy'; document.querySelector('#side').value = 'w'; });
    await click(page, '#cpu');
    await waitFor(page, () => document.querySelectorAll('#board .sq').length === 64);
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '棋局橫向溢出');
    const w = await ev(page, () => document.querySelector('#board .sq').getBoundingClientRect().width);
    assert.ok(w >= 44, '格子寬 ' + w);
    // 點選顯示合法落點
    await clickSq(page, 'e2');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('#board .sq.tg').length), 2);
    // 走子動畫（預設有）
    const anims = await ev(page, (s) => { document.querySelector(`#board [data-sq="${s}"]`).click(); return document.getAnimations().length; }, sq('e4'));
    assert.ok(anims > 0, '應有走子動畫');
    await waitFor(page, () => document.querySelectorAll('#moves span').length >= 2);   // 電腦回應
    assert.ok((await movesText(page)).startsWith('e4 '));
    // 提示
    await waitFor(page, () => !document.querySelector('#hint').disabled);
    await click(page, '#hint');
    await waitFor(page, () => document.querySelectorAll('#board .sq.hint').length === 2);
    // 悔棋：連電腦的回應一起收回
    await click(page, '#undo');
    await waitFor(page, () => document.querySelectorAll('#moves span').length === 0);
    // 再走一步並存檔 → 重新整理後可繼續
    await play(page, 'd2', 'd4');
    await waitFor(page, () => document.querySelectorAll('#moves span').length >= 2);
    const saved = await ev(page, () => JSON.parse(localStorage.getItem('chess_game')));
    assert.ok(saved && saved.v === 1 && saved.moves.length >= 2);
    await page.reload();
    await prep(page);
    await waitFor(page, () => !document.querySelector('#resume').hidden);
    await click(page, '#resume');
    await waitFor(page, () => document.querySelectorAll('#moves span').length >= 2);
    // 壞資料：重新開局（不壞頁面）
    await ev(page, () => localStorage.setItem('chess_game', '{"v":1,"mode":"cpu","fen":"x","moves":[1]}'));
    await page.reload(); await prep(page);
    assert.ok(await ev(page, () => document.querySelector('#resume').hidden), '壞存檔不應顯示繼續');
    // 認輸 → 統計 → 清除
    await ev(page, () => { localStorage.removeItem('chess_stats'); });
    await page.reload(); await prep(page);
    await click(page, '#cpu'); await waitFor(page, () => document.querySelectorAll('#board .sq').length === 64);
    await click(page, '#resign');
    assert.ok((await status(page)).includes('你輸了'));
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.getItem('chess_stats')).normal[1] + JSON.parse(localStorage.getItem('chess_stats')).easy[1]), 1);
    assert.ok(await ev(page, () => !localStorage.getItem('chess_game')), '終局後應清掉存檔');
    await click(page, '#again'); await click(page, '#leave');
    await page.waitForFunction(() => !document.querySelector('#menu').hidden);
    await prep(page);
    await ev(page, () => { localStorage.setItem('chess_stats', '"壞"'); });
    await page.reload(); await prep(page);
    assert.ok((await ev(page, () => document.querySelector('#stats').textContent)).includes('0 勝'));      // 壞統計：用預設
    await ev(page, () => { localStorage.setItem('chess_stats', JSON.stringify({ easy: [3, 2, 1] })); });
    await page.reload(); await prep(page);
    await click(page, '#clrStats');
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.getItem('chess_stats')).easy.join()), '0,0,0');

    // 同機雙人 + 升變 + FEN
    await ev(page, () => { document.querySelector('#fen').value = '8/P6k/8/8/8/8/8/K7 w - - 0 1'; });
    await click(page, '#local');
    await clickSq(page, 'a7'); await clickSq(page, 'a8');
    assert.ok(await ev(page, () => !document.querySelector('#promo').hidden), '應出現升變選單');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('#promo button').length), 4);
    await click(page, '#promo button[data-pr="2"]');
    assert.strictEqual(await movesText(page), 'a8=N');
    assert.strictEqual(await ev(page, () => document.querySelector('#board [data-sq="0"] .pc').textContent.replace('︎', '')), '♞');
    // 壞 FEN 不開局
    await click(page, '#leave'); await page.waitForFunction(() => !document.querySelector('#menu').hidden); await prep(page);
    await ev(page, () => { document.querySelector('#fen').value = '亂寫'; });
    await click(page, '#local');
    assert.ok(await ev(page, () => !document.querySelector('#menu').hidden && document.querySelector('#netMsg').textContent.includes('FEN')));
    await ev(page, () => { document.querySelector('#fen').value = ''; });
    await click(page, '#local');
    // 愚人將死 → 狀態、PGN
    for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await play(page, a, b);
    assert.ok((await status(page)).includes('黑方獲勝（將死）'));
    assert.strictEqual(await movesText(page), 'f3 e5 g4 Qh4#');
    // 拖放（滑鼠）：新局 e2 -> e4
    await click(page, '#again');
    const box = async (n) => ev(page, (s) => { const r = document.querySelector(`#board [data-sq="${s}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sq(n));
    const a = await box('e2'), b = await box('e4');
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    assert.strictEqual(await movesText(page), 'e4');
    // 手指拖放開關 → 棋盤 touch-action:none；關閉還原
    await click(page, '#dragBtn');
    assert.strictEqual(await ev(page, () => getComputedStyle(document.querySelector('#board')).touchAction), 'none');
    await click(page, '#dragBtn');
    assert.notStrictEqual(await ev(page, () => getComputedStyle(document.querySelector('#board')).touchAction), 'none');
    // 翻轉
    await click(page, '#flip');
    assert.strictEqual(await ev(page, () => document.querySelector('#board .sq').dataset.sq), '63');
    assert.deepStrictEqual(errors, []);
    await page.close();
}

// ---------- 減少動態效果 ----------
{
    const { page, errors } = await openPage(browser, REL);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await prep(page);
    await click(page, '#local');
    await clickSq(page, 'e2');
    const anims = await ev(page, (s) => { document.querySelector(`#board [data-sq="${s}"]`).click(); return document.getAnimations().length; }, sq('e4'));
    assert.strictEqual(anims, 0, '減少動態效果時不應有動畫');
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
    // 房主：執白、每方 5 分鐘 + 3 秒
    await ev(hp, () => { document.querySelector('#nick').value = '房主'; document.querySelector('#side').value = 'w'; document.querySelector('#tmin').value = '5'; document.querySelector('#tinc').value = '3'; });
    await click(hp, '#host');
    await waitFor(hp, () => typeof hostId === 'string' && hostId && !document.querySelector('#game').hidden);
    const hostId = await ev(hp, () => hostId);
    assert.ok((await status(hp)).includes('等待對手'));
    await ev(gp, (id) => { document.querySelector('#nick').value = '客人'; document.querySelector('#joinId').value = id; }, hostId);
    await click(gp, '#join');
    await waitFor(gp, () => !document.querySelector('#game').hidden && document.querySelector('#status').textContent.includes('輪到對手'));
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('輪到你了'));
    // 客人視角翻轉、有計時
    assert.strictEqual(await ev(gp, () => document.querySelector('#board .sq').dataset.sq), '63');
    assert.ok((await ev(hp, () => document.querySelector('#botBar .clock').textContent)).match(/^[45]:\d\d$/));
    // 房主走 e4，客人走 e5
    await play(hp, 'e2', 'e4');
    await waitFor(gp, () => document.querySelectorAll('#moves span').length === 1);
    assert.ok(await ev(gp, () => document.querySelector('#status').textContent.includes('輪到你了')));
    // 不是自己的回合時點選無效
    await clickSq(hp, 'd2');
    assert.strictEqual(await ev(hp, () => document.querySelectorAll('#board .sq.tg').length), 0);
    // 偽造：客人直接送非法步 / 錯誤型別 / 不輪到的步
    await ev(gp, () => { room.send({ type: 'MOVE', m: 12 | (60 << 6) }); });        // e7 -> e1：非法
    await waitFor(gp, () => document.querySelector('#gameMsg').textContent.includes('非法'));
    await ev(gp, () => { room.send({ type: 'MOVE', m: 'x' }); room.send({ type: 'MOVE', m: 1e9 }); room.send({ type: 'BOGUS' }); room.send('hi'); room.send(null); });
    await sleep(500);
    assert.strictEqual(await movesText(hp), 'e4');
    await ev(gp, () => { room.send({ type: 'RESIGN', side: 1 }); });           // 認輸只算送訊息者自己；這裡驗證不會變成房主認輸
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('你贏了'));
    await click(gp, '#again');                                                  // 重開（房主與客人換色）
    await waitFor(hp, () => document.querySelectorAll('#moves span').length === 0 && !document.querySelector('#status').textContent.includes('贏'));
    // 現在房主執黑、客人執白
    await waitFor(gp, () => document.querySelector('#status').textContent.includes('輪到你了'));
    assert.strictEqual(await ev(hp, () => document.querySelector('#board .sq').dataset.sq), '63');
    // 客人（白）偽造：走黑棋的子
    await ev(gp, () => { room.send({ type: 'MOVE', m: 12 | (28 << 6) }); });     // 黑兵 e7-e5，但輪到白
    await sleep(400); assert.strictEqual(await movesText(hp), '');
    await play(gp, 'd2', 'd4');
    await waitFor(hp, () => document.querySelectorAll('#moves span').length === 1);
    await play(hp, 'd7', 'd5');
    await waitFor(gp, () => document.querySelectorAll('#moves span').length === 2);
    // 和棋請求被拒、悔棋請求被同意
    await click(gp, '#draw');
    await waitFor(hp, () => !document.querySelector('#req').hidden && document.querySelector('#reqText').textContent.includes('和棋'));
    await click(hp, '#reqNo');
    await waitFor(hp, () => document.querySelector('#req').hidden);
    assert.strictEqual(await ev(hp, () => !!G.res), false);
    await click(hp, '#undo');                                                   // 房主請求悔自己的 d5
    await waitFor(gp, () => !document.querySelector('#req').hidden && document.querySelector('#reqText').textContent.includes('悔棋'));
    await click(gp, '#reqYes');
    await waitFor(hp, () => document.querySelectorAll('#moves span').length === 1);
    await waitFor(gp, () => document.querySelectorAll('#moves span').length === 1);
    // 重連：客人重新整理（同一頁、帶房號）→ 回到原棋局
    await ev(gp, (id) => history.replaceState('', '', location.pathname + '#' + id), hostId);
    await ev(gp, () => room.destroy());                                         // 無頭瀏覽器關頁時 pagehide 的訊息不一定送得出去：明確斷線
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('斷線'));
    await gp.reload(); await prep(gp);
    await waitFor(gp, () => !document.querySelector('#game').hidden && document.querySelectorAll('#moves span').length === 1);
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('輪到你了'));
    assert.strictEqual(await movesText(gp), 'd4');
    await play(hp, 'd7', 'd5');
    await waitFor(gp, () => document.querySelectorAll('#moves span').length === 2);
    // 對手斷線時（客人離開頁面）：房主顯示等待重連，計時暫停
    await ev(gp, () => room.destroy());
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('斷線'));
    // 逾時：把白方（客人）時間壓到 0.3 秒 → 重連後輪到客人的計時跑完，判負
    await gp.reload(); await prep(gp);
    await waitFor(gp, () => !document.querySelector('#game').hidden && document.querySelectorAll('#moves span').length === 2);
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('輪到對手'));
    await ev(hp, () => { clk.left[1] = 300; });
    await waitFor(hp, () => document.querySelector('#status').textContent.includes('逾時'));
    await waitFor(gp, () => document.querySelector('#status').textContent.includes('你輸了（逾時）'));
    assert.deepStrictEqual(A.errors, []); assert.deepStrictEqual(B.errors, []);
    await hp.close(); await gp.close();
}
await browser.close();
