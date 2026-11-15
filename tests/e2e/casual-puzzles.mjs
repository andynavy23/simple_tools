// 休閒益智 E2E：版面、消消樂整局（步數 / 計時 / 每日同盤面 / 最佳紀錄 / 清除）、七巧板（標準解完成、拖曳、點選移動、提示、進度與清除）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/casual-puzzles.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const layout = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, fs: Math.min(99, ...[...document.querySelectorAll('.wrap select')].filter(b => b.offsetParent).map(b => parseFloat(getComputedStyle(b).fontSize))) }));

const browser = await launchEdge();
try {
    // ---------- 消消樂 ----------
    {
        const { page, errors } = await openPage(browser, PAGE);
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        let m = await layout(page); assert.ok(m.sw <= m.iw && m.fs >= 16, JSON.stringify(m));
        await page.evaluate(() => { SPEED = 0; });
        await click(page, '#mStart');
        m = await layout(page); assert.ok(m.sw <= m.iw, '盤面橫向溢出');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#grid .g').length), 64);
        // 無效交換：彈回、不扣步數
        const bad = await page.evaluate(() => { for (let i = 0; i < 63; i++) if (adj(8, i, i + 1) && !tryMove(M.board, 8, i, i + 1)) return i; return -1; });
        await page.evaluate((i) => { document.querySelector(`#grid .g[data-i="${i}"]`).click(); document.querySelector(`#grid .g[data-i="${i + 1}"]`).click(); }, bad);
        await sleep(100);
        assert.strictEqual(await page.evaluate(() => M.moves), 30); assert.ok((await page.$eval('#mMsg', e => e.textContent)).includes('彈回'));
        // 用真的點擊走完 30 步（每步走 findMove）
        for (let s = 0; s < 30; s++) {
            const mv = await page.evaluate(() => findMove(M.board, M.n));
            await page.evaluate(([a, b]) => { document.querySelector(`#grid .g[data-i="${a}"]`).click(); document.querySelector(`#grid .g[data-i="${b}"]`).click(); }, mv);
            await page.waitForFunction(() => !M.busy, { timeout: 5000, polling: 20 });
        }
        const st = await page.evaluate(() => ({ over: M.over, score: M.score, best: JSON.parse(localStorage.getItem('casualp_best')) }));
        assert.ok(st.over && st.score > 300 && st.best.m8 === st.score, JSON.stringify(st));
        assert.ok((await page.$eval('#mMsg', e => e.textContent)).includes('新紀錄'));
        // 結束後點盤面無效
        await page.evaluate(() => document.querySelector('#grid .g').click()); assert.strictEqual(await page.evaluate(() => M.sel), null);
        // 7×7 + 計時模式
        await page.evaluate(() => { document.querySelector('#mMode').value = 'time'; document.querySelector('#mMode').onchange(); document.querySelector('#mSize').value = '7'; });
        await click(page, '#mStart');
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#grid .g').length), 49);
        await page.evaluate(() => { M.t0 -= 59500; });
        await page.waitForFunction(() => M.over, { timeout: 4000, polling: 100 });
        // 每日挑戰：同種子同初始盤面
        await page.evaluate(() => { document.querySelector('#mMode').value = 'daily'; document.querySelector('#mMode').onchange(); });
        await click(page, '#mStart'); const d1 = await page.evaluate(() => JSON.stringify(M.board));
        assert.strictEqual(await page.evaluate(() => M.n), 8);
        await click(page, '#mStart'); assert.strictEqual(await page.evaluate(() => JSON.stringify(M.board)), d1);
        // 提示
        await click(page, '#mHint'); assert.ok(await page.evaluate(() => document.querySelectorAll('#grid .g.hint').length === 2));
        // 清除最佳紀錄
        await page.evaluate(() => localStorage.setItem('other_key', '1'));
        await click(page, '#clearBest');
        assert.strictEqual(await page.evaluate(() => [localStorage.getItem('casualp_best'), localStorage.getItem('other_key')].join('|')), '|1');
        // 壞資料載入
        await page.evaluate(() => { localStorage.setItem('casualp_best', '"壞"'); localStorage.setItem('casualp_progress', '[1,2]'); location.reload(); });
        await page.waitForNavigation();
        assert.ok((await page.$eval('#mBest', e => e.textContent)).includes('還沒有'));
        await page.evaluate(() => { localStorage.removeItem('other_key'); localStorage.removeItem('casualp_best'); localStorage.removeItem('casualp_progress'); });
        assert.deepStrictEqual(errors, []); await page.close();
    }
    // ---------- 七巧板 ----------
    {
        const { page, errors } = await openPage(browser, PAGE);
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
        await click(page, '#tabs [data-t=tg]');
        const m = await layout(page); assert.ok(m.sw <= m.iw, JSON.stringify(m));
        assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#tsvg polygon.pc').length), 7);
        assert.ok((await page.evaluate(() => PUZ.length)) >= 20);
        // 手機預設為點選模式：盤面不能是 touch-action:none
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#tsvg')).touchAction), 'auto');
        // 點選一塊板，再點空白處 → 移動
        const before = await page.evaluate(() => ({ x: T.pcs[0].x, y: T.pcs[0].y }));
        const tapAt = async (x, y) => { const r = await page.evaluate(() => { const b = document.querySelector('#tsvg').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }); await page.mouse.click(r[0] + x / 12 * r[2], r[1] + y / 14 * r[3]); };
        const center = await page.evaluate(() => { const el = document.querySelector('#tsvg polygon.pc'), b = el.getBoundingClientRect(); return [b.left + b.width * 0.3, b.top + b.height * 0.7]; });
        await page.mouse.click(center[0], center[1]);
        assert.strictEqual(await page.evaluate(() => T.sel !== null), true);
        await tapAt(10.5, 5.5); await sleep(80);
        const moved = await page.evaluate(() => { const p = T.pcs[T.sel]; return Math.hypot(p.x - 10.5, p.y - 5.5); });
        assert.ok(moved < 1, '點空白處移動（含吸附）' + moved);
        // 切到拖曳模式後拖曳
        await click(page, '#tMode'); assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#tsvg')).touchAction), 'none');
        const c2 = await page.evaluate(() => { const k = T.sel, el = document.querySelectorAll('#tsvg polygon.pc')[k], b = el.getBoundingClientRect(); return { k, x: T.pcs[k].x, p: [b.left + b.width / 2, b.top + b.height / 2] }; });
        await page.mouse.move(c2.p[0], c2.p[1]); await page.mouse.down(); await page.mouse.move(c2.p[0] - 80, c2.p[1] + 20, { steps: 4 }); await page.mouse.up();
        assert.ok(await page.evaluate((x) => Math.abs(T.pcs[T.sel].x - x) > 1, c2.x), '拖曳後位置改變');
        // 旋轉 / 翻面 / 提示
        const r0 = await page.evaluate(() => T.pcs[T.sel].rot); await click(page, '#tR'); assert.strictEqual(await page.evaluate(() => T.pcs[T.sel].rot), (r0 + 1) % 8);
        await click(page, '#tF'); // 非平行四邊形 → 提示文字
        await click(page, '#tHint'); assert.ok(await page.evaluate(() => T.hint >= 0 && !!document.querySelector('#tsvg polygon[stroke-dasharray]')));
        // 把七塊板擺到標準解 → 完成、存進度
        await page.evaluate(() => {
            const cen = (f) => { let x = 0, y = 0; for (let i = 0; i < f.length; i += 2) { x += f[i] / (f.length / 2); y += f[i + 1] / (f.length / 2); } return [x, y]; };
            T.pcs.sort((a, b) => a.i - b.i);
            T.pcs.forEach((p, j) => {
                const sol = T.sil[j], [cx, cy] = cen(sol); const key = (f) => { const a = []; for (let i = 0; i < f.length; i += 2) a.push(f[i].toFixed(2) + ',' + f[i + 1].toFixed(2)); return a.sort().join('|'); };
                for (let rot = 0; rot < 8; rot++) for (const fl of [false, true]) if (key(pose(p.t, rot, fl, cx, cy, K)) === key(sol)) { p.rot = rot; p.flip = fl; p.x = cx; p.y = cy; }
            });
            T.sel = null; tgDraw(); tgCheck();
        });
        assert.ok(await page.evaluate(() => T.done), '標準解應完成');
        assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('casualp_progress'))['1'] >= 1));
        assert.ok((await page.$eval('#tInfo', e => e.textContent)).includes('完成'));
        await click(page, '#tNext'); assert.strictEqual(await page.evaluate(() => T.id), 2);
        assert.ok((await page.$eval('#tSel', e => e.options[0].textContent)).includes('✓'));
        await click(page, '#clearProg');
        assert.strictEqual(await page.evaluate(() => localStorage.getItem('casualp_progress')), null);
        await page.evaluate(() => localStorage.removeItem('casualp_progress'));
        assert.deepStrictEqual(errors, []); await page.close();
    }
} finally { await browser.close(); }
console.log('ok  casual-puzzles e2e');
