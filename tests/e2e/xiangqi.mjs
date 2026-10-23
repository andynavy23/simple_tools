// 中國象棋 E2E：單機（對電腦 / 悔棋 / 提示 / 存檔 / 動畫）+ 連線（兩個分頁；用假 PeerJS 經由本程序轉送）+ 390px 版面
import assert from 'assert';
import { launchEdge, pageUrl } from './lib.mjs';

const PAGE = 'mini-games/xiangqi.html';
const sq = (r, c) => r * 9 + c, mv = (a, b) => a * 90 + b;
const browser = await launchEdge();
const pages = [], errors = [];

// 假 PeerJS：每個頁面各有一份，訊息透過 exposeFunction 由本程序轉給其他頁面
const FAKE = () => {
    const peers = {}; let seq = 0;
    class Em { constructor() { this.h = {}; } on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); } }
    class Conn extends Em {
        constructor(peer, remote, cid) { super(); this.peer = remote; this.open = false; this.me = peer; this.cid = cid; }
        send(d) { if (!this.open) throw new Error('closed'); window.__net({ k: 'data', to: this.peer, from: this.me.id, cid: this.cid, d: JSON.parse(JSON.stringify(d)) }); }
        close() { if (!this.open) return; this.open = false; window.__net({ k: 'close', to: this.peer, from: this.me.id, cid: this.cid }); setTimeout(() => this.emit('close'), 0); }
    }
    class Peer extends Em {
        constructor() { super(); this.id = 'px' + Math.random().toString(36).slice(2, 8); this.conns = {}; peers[this.id] = this; setTimeout(() => this.emit('open', this.id), 0); }
        connect(id) { const cid = this.id + '>' + id + '#' + (++seq), c = new Conn(this, id, cid); this.conns[cid] = c; window.__net({ k: 'conn', to: id, from: this.id, cid }); return c; }
        destroy() { Object.values(this.conns).forEach(c => c.close()); delete peers[this.id]; }
    }
    window.Peer = Peer;
    window.__dropAll = () => Object.values(peers).forEach(p => Object.values(p.conns).forEach(c => c.close()));
    window.__recv = (m) => {
        const t = peers[m.to]; if (!t) return;
        if (m.k === 'conn') { const c = new Conn(t, m.from, m.cid); t.conns[m.cid] = c; c.open = true; t.emit('connection', c); window.__net({ k: 'acc', to: m.from, from: t.id, cid: m.cid }); }
        else { const c = t.conns[m.cid]; if (!c) return; if (m.k === 'acc') { c.open = true; c.emit('open'); } else if (m.k === 'data') { if (c.open) c.emit('data', m.d); } else if (m.k === 'close') { if (c.open) { c.open = false; c.emit('close'); } } }
    };
};

async function open(fake = false, extra = '') {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('例外：' + String(e.message).slice(0, 150)));
    page.on('dialog', d => d.accept().catch(() => { }));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (fake) {
        await page.exposeFunction('__net', (msg) => { for (const p of pages) if (p !== page) p.evaluate((m) => window.__recv && window.__recv(m), msg).catch(() => { }); });
        await page.evaluateOnNewDocument(FAKE);
    }
    pages.push(page);
    await page.goto(pageUrl(PAGE) + '#a' + extra, { waitUntil: 'load' });
    return page;
}
const tap = (page, r, c) => page.evaluate((r, c) => { const bd = document.querySelector('#bd'), rc = bd.getBoundingClientRect(), [vr, vc] = flip ? [9 - r, 8 - c] : [r, c]; bd.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rc.left + (vc + .5) / 9 * rc.width, clientY: rc.top + (vr + .5) / 10 * rc.height })); }, r, c);
const play = async (page, a, b) => { await tap(page, (a / 9) | 0, a % 9); await tap(page, (b / 9) | 0, b % 9); };
const until = (page, expr, ms = 6000) => page.waitForFunction(expr, { timeout: ms, polling: 100 });
const ev = (page, f, ...a) => page.evaluate(f, ...a);

// ================= 單機 =================
{
    const p = await open();
    const o = await ev(p, () => ({ sw: document.scrollingElement.scrollWidth, vw: innerWidth }));
    assert.ok(o.sw <= o.vw, '選單無橫向溢出');
    await ev(p, () => { document.querySelector('#level').value = 'easy'; document.querySelector('#cpu').click(); });
    await until(p, "mode==='cpu' && pos.mv.length===0");
    const g = await ev(p, () => { const r = document.querySelector('#bd').getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right, sw: document.scrollingElement.scrollWidth, vw: innerWidth }; });
    assert.ok(g.sw <= g.vw && g.right <= g.vw, '棋盤無橫向溢出');
    assert.ok(g.w / 9 >= 38 && Math.abs(g.h / g.w - 10 / 9) < 0.01, `格寬 ${g.w / 9}`);
    assert.strictEqual(await ev(p, () => document.querySelectorAll('.pc').length), 32);
    // 選子顯示落點
    await tap(p, 7, 7);
    assert.ok(await ev(p, () => document.querySelectorAll('.mk.dest').length) >= 10, '炮有落點');
    await tap(p, 3, 3);                                         // 點空處取消
    assert.strictEqual(await ev(p, () => document.querySelectorAll('.mk.dest').length), 0);
    // 非法落點：點馬（9,1）再點 (5,1) 不動
    await play(p, sq(9, 1), sq(5, 1));
    assert.strictEqual(await ev(p, () => pos.mv.length), 0);
    // 走一步（有動畫）→ 電腦回應
    await play(p, sq(6, 4), sq(5, 4));
    assert.ok(await ev(p, () => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest('#layer')).length) > 0, '走子動畫（transform）');
    await until(p, 'pos.mv.length===2');
    assert.ok((await ev(p, () => document.querySelector('#log').textContent)).includes('兵五進一'));
    assert.ok(await ev(p, () => JSON.parse(localStorage.getItem('xiangqi_game')).moves.length) === 2, '進行中棋局自動存');
    // 提示（不改變局面）
    await ev(p, () => document.querySelector('#hint').click());
    await until(p, 'hintM >= 0');
    assert.ok(await ev(p, () => document.querySelectorAll('.mk.hint').length) === 2);
    assert.strictEqual(await ev(p, () => pos.mv.length), 2);
    // 悔棋：對電腦退兩步
    await ev(p, () => document.querySelector('#undo').click());
    assert.strictEqual(await ev(p, () => pos.mv.length), 0);
    assert.ok(await ev(p, () => document.querySelector('#undo').disabled));
    // 再走兩步後重新載入 → 繼續上一局
    await play(p, sq(6, 4), sq(5, 4)); await until(p, 'pos.mv.length===2');
    await play(p, sq(7, 1), sq(7, 4).valueOf() === 0 ? 0 : sq(7, 1) + 0 === 0 ? 0 : sq(7, 1));   // 無效點擊（原地）不影響
    const n = await ev(p, () => pos.mv.length);
    await p.reload({ waitUntil: 'load' });
    assert.ok(await ev(p, () => !document.querySelector('#resumeBox').hidden), '有存檔棋局');
    await ev(p, () => document.querySelector('#resume').click());
    await until(p, `mode==='cpu' && pos.mv.length>=${n}`);
    // 認輸 → 統計 + 存檔移除
    await ev(p, () => { const t = document.querySelector('#resign'); t.click(); });
    await until(p, 'RES && RES.why==="resign"');
    const s = await ev(p, () => ({ st: JSON.parse(localStorage.getItem('xiangqi_stats')), g: localStorage.getItem('xiangqi_game') }));
    assert.deepStrictEqual(s.st.easy, [0, 1, 0]); assert.strictEqual(s.g, null);
    // 壞資料容錯
    await ev(p, () => { localStorage.setItem('xiangqi_game', '{"mode":"cpu","moves":[1,2,3]}'); localStorage.setItem('xiangqi_stats', '[1]'); localStorage.setItem('xiangqi_opts', 'zzz'); });
    await p.reload({ waitUntil: 'load' });
    assert.ok(await ev(p, () => document.querySelector('#resumeBox').hidden), '壞存檔被丟棄');
    assert.ok((await ev(p, () => document.querySelector('#stats').textContent)).includes('0 勝'));
    // 清除統計
    await ev(p, () => { stats.hard[0] = 3; Util.store.set('xiangqi_stats', stats); document.querySelector('#clearStats').click(); });
    assert.deepStrictEqual(await ev(p, () => JSON.parse(localStorage.getItem('xiangqi_stats')).hard), [0, 0, 0]);
    // 電腦執紅先走（我執黑 → 翻轉），困難 ≤ 約 2.5 秒
    await ev(p, () => { document.querySelector('#level').value = 'hard'; document.querySelector('#side').value = 'black'; });
    const t0 = Date.now();
    await ev(p, () => document.querySelector('#cpu').click());
    await until(p, 'pos.mv.length===1', 5000);
    assert.ok(Date.now() - t0 < 2800, '困難思考時間 ' + (Date.now() - t0));
    assert.ok(await ev(p, () => flip === true && !document.querySelector('#undo').disabled === false));
    await play(p, sq(0, 1), sq(2, 2));                               // 黑馬 2 進 3（翻轉視角點擊）
    await until(p, 'pos.mv.length===3');
    assert.ok((await ev(p, () => pos.nm[1])).startsWith('馬'));
    // 同機雙人 + 翻轉
    await p.reload({ waitUntil: 'load' });
    await ev(p, () => document.querySelector('#local').click());
    await play(p, sq(7, 7), sq(7, 4)); await play(p, sq(0, 1), sq(2, 2));
    assert.strictEqual(await ev(p, () => pos.mv.length), 2);
    await ev(p, () => document.querySelector('#flip').click());
    assert.strictEqual(await ev(p, () => flip), true);
    await ev(p, () => document.querySelector('#undo').click());
    assert.strictEqual(await ev(p, () => pos.mv.length), 1);
    // 將軍提示：自擺局面
    await ev(p, () => { pos = replay([]); pos.b.fill(0); const set = (r, c, v) => { pos.b[r * 9 + c] = v; }; set(0, 4, -1); set(9, 3, 1); set(5, 4, 5); pos.turn = -1; update(); });
    assert.ok(await ev(p, () => document.querySelector('#status').textContent.includes('將軍')));
    assert.ok(await ev(p, () => document.querySelectorAll('.pc.chk').length) === 1);
    await p.close(); pages.length = 0;
}

// 減少動態效果：不產生動畫
{
    const p = await open();
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await ev(p, () => document.querySelector('#local').click());
    await play(p, sq(6, 4), sq(5, 4));
    assert.strictEqual(await ev(p, () => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest('#layer')).length), 0);
    assert.strictEqual(await ev(p, () => pos.mv.length), 1);
    await p.close(); pages.length = 0;
}

// ================= 連線 =================
{
    const host = await open(true), guest = await open(true);
    await ev(host, () => { document.querySelector('#nick').value = 'Host'; document.querySelector('#clock').value = '5'; document.querySelector('#host').click(); });
    await until(host, "mode==='host' && hostId");
    const id = await ev(host, () => hostId);
    assert.ok((await ev(host, () => document.querySelector('#status').textContent)).includes('等待對手'));
    await play(host, sq(6, 4), sq(5, 4));
    assert.strictEqual(await ev(host, () => pos.mv.length), 0, '沒有對手時不能走');
    await ev(guest, (id) => { document.querySelector('#nick').value = 'Guest'; document.querySelector('#joinId').value = id; document.querySelector('#join').click(); }, id);
    await until(guest, "mode==='guest' && hostSide===1 && names[1]==='Guest'");
    await until(host, 'guestOnline');
    assert.strictEqual(await ev(guest, () => flip), true, '黑方自動翻轉');
    assert.ok(await ev(host, () => !document.querySelector('#topClk').hidden), '計時顯示');
    // 走棋（房主紅先）
    await play(guest, sq(0, 1), sq(2, 2));
    assert.strictEqual(await ev(host, () => pos.mv.length), 0, '輪到房主時成員不能走');
    await play(host, sq(7, 7), sq(7, 4));
    await until(guest, 'pos.mv.length===1');
    await play(guest, sq(0, 1), sq(2, 2));
    await until(host, 'pos.mv.length===2');
    await play(host, sq(9, 1), sq(7, 2));
    await until(guest, 'pos.mv.length===3');
    // 偽造封包：非法步、型別錯誤、無請求的 ANS 一律不改變局面
    const before = await ev(host, () => JSON.stringify(pos.mv));
    for (const bad of [{ t: 'MOVE', m: mv(sq(0, 0), sq(5, 0)) }, { t: 'MOVE', m: 'abc' }, { t: 'MOVE', m: -5 }, { t: 'MOVE', m: 1e9 }, { t: 'MOVE', m: mv(sq(9, 0), sq(8, 0)) }, { t: 'ANS', ok: true }, { t: 'REQ', kind: 'bogus' }, { t: 'RESIGN2' }, null, 'x'])
        await ev(guest, (b) => room.send(b), bad);
    await new Promise(r => setTimeout(r, 400));
    assert.strictEqual(await ev(host, () => JSON.stringify(pos.mv)), before, '房主拒絕非法步，局面不變');
    assert.strictEqual(await ev(host, () => RES), null);
    assert.strictEqual(await ev(guest, () => JSON.stringify(pos.mv)), before);
    // 悔棋請求：成員請求 → 房主同意（最後一步是房主走的，退 2 步）
    await ev(guest, () => document.querySelector('#undo').click());
    await until(host, "!document.querySelector('#askBar').hidden");
    await ev(host, () => document.querySelector('#askYes').click());
    await until(guest, 'pos.mv.length===1'); await until(host, 'pos.mv.length===1');
    // 求和被拒
    await ev(host, () => document.querySelector('#draw').click());
    await until(guest, "!document.querySelector('#askBar').hidden");
    await ev(guest, () => document.querySelector('#askNo').click());
    await until(host, "document.querySelector('#noteLine').textContent.includes('拒絕')");
    // 斷線 → 重連（同暱稱恢復局面）
    await ev(guest, () => __dropAll());
    await until(host, '!guestOnline');
    assert.ok((await ev(host, () => document.querySelector('#status').textContent)).includes('斷線'));
    await until(guest, "!document.querySelector('#reconnect').hidden");
    await play(host, sq(9, 1), sq(7, 2)).catch(() => { });
    assert.strictEqual(await ev(host, () => pos.mv.length), 1, '對方離線時房主不能走');
    // 陌生人不能在對局中途頂替離線的玩家
    const stranger = await open(true);
    await ev(stranger, (id) => { document.querySelector('#nick').value = 'Other'; document.querySelector('#joinId').value = id; document.querySelector('#join').click(); }, id);
    await until(stranger, "document.querySelector('#netMsg').textContent.includes('原本')");
    await stranger.close(); pages.splice(pages.indexOf(stranger), 1);
    await ev(guest, () => document.querySelector('#reconnect').click());
    await until(host, 'guestOnline');
    await until(guest, '!connLost && pos.mv.length===1');
    // 認輸
    await ev(guest, () => document.querySelector('#resign').click());
    await until(host, 'RES && RES.why==="resign" && RES.w===1');
    await until(guest, 'RES && RES.w===1');
    // 再來一局（換色）→ 超時判負
    await ev(host, () => document.querySelector('#again').click());
    await until(guest, 'hostSide===-1 && pos.mv.length===0 && !RES');
    await ev(host, () => { CLK.ms[0] = 300; });                    // 紅方（現在是成員）剩 0.3 秒
    await until(host, 'RES && RES.why==="time" && RES.w===-1', 4000);
    await until(guest, 'RES && RES.why==="time"');
    for (const pg of [host, guest]) { const o = await ev(pg, () => ({ sw: document.scrollingElement.scrollWidth, vw: innerWidth })); assert.ok(o.sw <= o.vw, '連線畫面無橫向溢出'); }
}

assert.deepStrictEqual(errors, []);
await browser.close();
