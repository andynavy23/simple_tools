// 飛行棋 E2E：版面（手機不溢出、按鈕 ≥ 44px）、單機（點棋子走位）、戰績與清除、
// 連線（假 PeerJS）：電腦補位、非法動作被房主擋下、斷線由電腦代打、同暱稱重連
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/ludo.html';
const FAKE = () => {
    const bc = new BroadcastChannel('fakepeer-ludo'), peers = new Map();
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
const newPage = async (browser) => { const o = await openPage(browser, PAGE); await o.page.evaluate(FAKE); return o; };

const browser = await launchEdge();
try {
    // ---------- 單機 ----------
    {
        const { page, errors } = await newPage(browser);
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await fill(page, '#total', '2'); await page.evaluate(() => document.querySelector('#total').dispatchEvent(new Event('change')));
        await click(page, '#soloBtn');
        await until(() => page.evaluate(() => V && V.phase === 'play'), 3000, '開局');
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(...[...document.querySelectorAll('.wrap button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height)), pcs: document.querySelectorAll('.pc').length, bw: document.querySelector('#board').getBoundingClientRect().width, opts: localStorage.getItem('ludo_opts') }));
        assert.ok(m.sw <= m.iw && m.minH >= 44 && m.pcs === 8 && m.bw > 300, JSON.stringify(m));
        assert.ok(JSON.parse(m.opts).total === 2);
        // 非法：先擲 3（起飛要 6）→ 沒有合法步，換電腦；再用腳本把局面擺好，點棋子走位
        await page.evaluate(() => { rollDice(G, 0, 6); push(); });
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.pc.can').length), 4, '起飛時 4 架都能點');
        await page.evaluate(() => document.querySelector('#pc0_1').dispatchEvent(new MouseEvent('click', { bubbles: true })));
        assert.strictEqual(await page.evaluate(() => G.pos[0].join()), '-1,0,-1,-1');
        await page.evaluate(() => { act({ t: 'MOVE', i: 0 }); });   // 已經走過、還沒擲：非法
        assert.ok((await page.evaluate(() => document.querySelector('#status').textContent)).includes('這步不行'));
        // 電腦會自己走，輪回玩家
        await page.evaluate(() => { G.turn = 0; G.roll = null; G.sixes = 0; push(); });
        await page.evaluate(() => { rollDice(G, 0, 2); push(); });
        assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll('#pcBtns button')].length), 1);
        await click(page, '#pcBtns button');
        assert.strictEqual(await page.evaluate(() => G.pos[0].join()), '-1,2,-1,-1');
        await until(() => page.evaluate(() => G.turn === 0 && G.roll === null && !document.querySelector('#die').disabled), 15000, '輪回玩家');
        // 勝利計入戰績，清除戰績只清 ludo_stats
        await page.evaluate(() => { G.pos[0] = [56, 56, 56, 55]; G.turn = 0; G.roll = null; rollDice(G, 0, 1); push(); });
        await click(page, '#pcBtns button');
        await until(() => page.evaluate(() => V.phase === 'over' && (JSON.parse(localStorage.getItem('ludo_stats') || '{}').wins === 1)), 3000, '記錄勝場');
        assert.ok((await page.evaluate(() => document.querySelector('#status').textContent)).includes('獲勝'));
        await page.evaluate(() => { localStorage.setItem('other_key', '1'); });
        await page.evaluate(() => document.querySelector('#leave').click());
        await page.waitForNavigation();
        assert.ok((await page.evaluate(() => document.querySelector('#statsBox').textContent)).includes('共 1 場'));
        await click(page, '#clearStats');
        assert.strictEqual(await page.evaluate(() => [localStorage.getItem('ludo_stats'), localStorage.getItem('other_key')].join()), ',1');
        // 壞資料：不丟例外
        await page.evaluate(() => { localStorage.setItem('ludo_stats', '{"recent":5,"games":"x"}'); localStorage.setItem('ludo_opts', '[1]'); });
        await page.reload({ waitUntil: 'load' });
        assert.ok((await page.evaluate(() => document.querySelector('#statsBox').textContent)).includes('還沒有'));
        await page.evaluate(() => localStorage.removeItem('other_key'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 連線 ----------
    const host = await newPage(browser), guest = await newPage(browser), H = host.page, G = guest.page;
    await fill(H, '#nick', '房主'); await fill(H, '#total', '3'); await click(H, '#hostBtn');
    await until(() => H.evaluate(() => isHost && V && hostId), 5000, '建房');
    const id = await H.evaluate(() => hostId);
    await fill(G, '#nick', '小明'); await fill(G, '#joinId', id); await click(G, '#joinBtn');
    await until(() => G.evaluate(() => V && V.names.length === 2), 5000, '加入');
    await click(H, '#startBtn');
    await until(() => G.evaluate(() => V.phase === 'play' && V.names.length === 3), 3000, '開局（電腦補位）');
    assert.deepStrictEqual(await G.evaluate(() => V.names), ['房主', '小明', '電腦1']);
    assert.ok(await G.evaluate(() => document.querySelector('#die').disabled), '輪到房主時成員不能擲');
    // 成員在不是自己回合時作弊：被房主擋下
    await G.evaluate(() => { room.send({ t: 'ROLL' }); room.send({ t: 'MOVE', i: 0 }); }); await sleep(300);
    assert.strictEqual(await H.evaluate(() => G.turn + ':' + G.roll + ':' + G.pos[1].join()), '0:null:-1,-1,-1,-1');
    // 房主擲 → 換成員；成員擲、點棋子走位（用腳本把局面擺成成員能起飛）
    await H.evaluate(() => { G.turn = 1; G.roll = null; G.sixes = 0; push(); });
    await until(() => G.evaluate(() => V.turn === 1 && !document.querySelector('#die').disabled), 3000, '輪到成員');
    await H.evaluate(() => { rollDice(G, 1, 6); push(); });
    await until(() => G.evaluate(() => document.querySelectorAll('.pc.can').length === 4), 3000, '成員看到可走的飛機');
    await G.evaluate(() => room.send({ t: 'MOVE', i: 9 })); await sleep(200);                    // 非法索引被擋
    assert.strictEqual(await H.evaluate(() => G.pos[1].join()), '-1,-1,-1,-1');
    await G.evaluate(() => document.querySelector('#pc1_2').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await until(() => H.evaluate(() => G.pos[1].join() === '-1,-1,0,-1'), 3000, '成員起飛');
    // 斷線 → 輪到他時由電腦代打；同暱稱重連
    await G.close();
    await until(() => H.evaluate(() => V.bots[1] === true), 5000, '偵測斷線');
    await until(() => H.evaluate(() => G.turn !== 1 || G.roll === null), 5000, '代打');
    const g2 = await newPage(browser); await fill(g2.page, '#nick', '小明'); await fill(g2.page, '#joinId', id); await click(g2.page, '#joinBtn');
    await until(() => g2.page.evaluate(() => V && V.phase === 'play' && V.bots[1] === false), 5000, '重連回到對局');
    assert.strictEqual(await g2.page.evaluate(() => document.querySelectorAll('.pc').length), 12);
    // 別人用新暱稱不能中途加入
    const g3 = await newPage(browser); await fill(g3.page, '#nick', '路人'); await fill(g3.page, '#joinId', id); await click(g3.page, '#joinBtn');
    await until(() => g3.page.evaluate(() => document.querySelector('#netMsg').textContent.includes('遊戲已經開始')), 5000, '拒絕中途加入');
    for (const o of [host, g2, g3]) assert.deepStrictEqual(o.errors, []);
    await H.close(); await g2.page.close(); await g3.page.close();
} finally { await browser.close(); }
console.log('ok  ludo e2e');
