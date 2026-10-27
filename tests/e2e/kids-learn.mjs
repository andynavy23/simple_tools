// kids-learn：每個單元開局答題、時鐘撥針（指標事件 + 捲動模式）、錢幣湊額、家長設定與清除、壞資料容錯、390px 版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const URL_ = 'mini-games/kids-learn.html';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, URL_);
    const ev = (f, ...a) => page.evaluate(f, ...a);
    const setLS = (k, v) => ev((k, v) => localStorage.setItem(k, v), k, typeof v === 'string' ? v : JSON.stringify(v));
    const reload = async () => { await page.reload({ waitUntil: 'load' }); };
    // 版面：不橫向溢出；可見按鈕高度 ≥ 56
    const layout = async (tag) => {
        const r = await ev(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, small: [...document.querySelectorAll('.wrap button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 55.5).map(b => b.textContent.trim().slice(0, 10) + ':' + Math.round(b.getBoundingClientRect().height)) }));
        assert.ok(r.sw <= r.iw, `${tag} 橫向溢出 ${r.sw}>${r.iw}`);
        assert.deepStrictEqual(r.small, [], `${tag} 按鈕太小`);
    };
    const solve = () => ev(async () => {
        const q = G.q;
        if (q.type === 'clock') { while (C.h !== q.target.h) document.querySelector('#hp').click(); while (C.m !== q.target.m) document.querySelector('#mp').click(); document.querySelector('#clkOk').click(); }
        else if (q.type === 'pay') { const bs = [...document.querySelectorAll('.den button')]; for (const [d, n] of breakdown(q.target, q.denoms)) for (let i = 0; i < n; i++) bs[q.denoms.indexOf(d)].click(); document.querySelector('#qextra .primary').click(); }
        else if (q.type === 'spell') { for (const l of q.word) [...document.querySelectorAll('.tile')].find(b => !b.disabled && b.textContent === l).click(); }
        else document.querySelectorAll('#choices button')[q.choices.findIndex(c => c.ok)].click();
    });

    // 1) 壞資料容錯
    await setLS('kidsl_stats', '"x"'); await setLS('kidsl_opts', '[1,2]'); await reload();
    assert.strictEqual(await ev(() => document.querySelectorAll('.ubtn').length), 13);
    await setLS('kidsl_stats', { count: [[9, 3], null, 'a'], add: 5, zzz: [[1, 1]] }); await setLS('kidsl_opts', { q: 5, lv: 1 }); await reload();
    assert.strictEqual(await ev(() => stats.count[0].join()), '3,3'); assert.strictEqual(await ev(() => opts.q), 5);
    await layout('主選單');

    // 2) 每個單元 × 初 / 高級：開局答完（第一題先故意點錯一次，看到溫和提示、之後第一次就答對的才算星星）
    for (const lv of [1, 3]) for (let u = 0; u < 13; u++) {
        await ev(() => renderHome());
        await ev((u) => document.querySelectorAll('.ubtn')[u].click(), u);
        await layout(`單元 ${u} 頁`);
        await ev((lv) => document.querySelectorAll('#lvBtns button')[lv - 1].click(), lv);
        await ev(() => document.querySelector('#startBtn').click());
        const before = await ev(() => stats[G.unit][G.lv - 1].join());
        for (let i = 0; i < 5; i++) {
            if (i === 0 && await ev(() => !!G.q.choices)) {
                const wrongIdx = await ev(() => G.q.choices.findIndex(c => !c.ok));
                await ev((w) => document.querySelectorAll('#choices button')[w].click(), wrongIdx);
                assert.strictEqual(await ev(() => document.querySelector('#fb').className), 'try', '答錯提示');
                assert.strictEqual(await ev(() => document.querySelector('#nextBtn').hidden), true);
            }
            if (i === 1 || i === 4) await layout(`單元 ${u} lv${lv} 第 ${i + 1} 題`);
            await solve();
            assert.ok((await ev(() => document.querySelector('#fb').textContent)).includes('答案'), '答對回饋');
            await ev(() => document.querySelector('#nextBtn').click());
        }
        assert.strictEqual(await ev(() => !document.querySelector('#result').hidden), true, `單元 ${u} 結束摘要`);
        const [r0, t0] = before.split(',').map(Number), after = (await ev(() => stats[lastStart[0]][lastStart[1] - 1].join())).split(',').map(Number);
        assert.strictEqual(after[1] - t0, 5);
        await layout(`單元 ${u} 結果`);
    }
    assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('kidsl_stats')).count[0][1] > 0), true);

    // 3) 時鐘撥針：指標事件（分針 → 6 點方向；時針 → 3 點方向）、捲動模式切換
    await ev(() => { startGame('clock', 3); G.q = { unit: 'clock', type: 'clock', text: '請把時鐘撥到 3 點半', target: { h: 3, m: 30 }, ans: '3:30' }; renderQ(); });
    await layout('撥針題');
    const box = await ev(() => { document.querySelector('#clk').scrollIntoView({ block: 'center' }); const r = document.querySelector('#clk').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const at = (rad, deg) => ({ x: box.x + box.w / 2 + rad / 200 * box.w * Math.sin(deg * Math.PI / 180), y: box.y + box.h / 2 - rad / 200 * box.h * Math.cos(deg * Math.PI / 180) });
    const dragTo = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 4 }); await page.mouse.up(); };
    await dragTo(at(74, 0), at(74, 180));
    assert.strictEqual(await ev(() => C.m), 30); assert.strictEqual(await ev(() => C.h), 12);
    await dragTo(at(40, 0), at(40, 90));
    assert.strictEqual(await ev(() => C.h), 3);
    assert.strictEqual(await ev(() => document.querySelector('.readout').textContent), '3:30');
    assert.strictEqual(await ev(() => getComputedStyle(document.querySelector('#clk')).touchAction), 'none');
    await ev(() => document.querySelector('#scrollMode').click());
    assert.strictEqual(await ev(() => getComputedStyle(document.querySelector('#clk')).touchAction), 'auto');
    await ev(() => document.querySelector('#hm').click()); await ev(() => document.querySelector('#clkOk').click());     // 2:30 不對
    assert.strictEqual(await ev(() => document.querySelector('#fb').className), 'try');
    await ev(() => document.querySelector('#hp').click()); await ev(() => document.querySelector('#clkOk').click());
    assert.ok((await ev(() => document.querySelector('#fb').className)) === 'ok');

    // 4) 錢幣湊額：錢不夠 / 太多會提示，湊對才過
    await ev(() => { startGame('money', 3); G.q = { unit: 'money', type: 'pay', text: '要付 63 元', target: 63, denoms: DEN, ans: '63' }; renderQ(); });
    await ev(() => document.querySelectorAll('.den button')[3].click()); await ev(() => document.querySelector('#qextra .primary').click());
    assert.ok((await ev(() => document.querySelector('#fb').textContent)).includes('不夠'));
    await ev(() => { document.querySelectorAll('.den button')[2].click(); for (let i = 0; i < 3; i++) document.querySelectorAll('.den button')[0].click(); document.querySelector('#qextra .primary').click(); });
    assert.strictEqual(await ev(() => G.done), true);
    await ev(() => { G = null; renderHome(); });

    // 5) 家長設定：答錯進不去、答對進入；改設定寫入；清除統計先取消再確認
    await ev(() => document.querySelector('#parentBtn').click());
    await ev(() => { document.querySelector('#gA').value = '1'; document.querySelector('#gGo').click(); });
    assert.strictEqual(await ev(() => document.querySelector('#pPanel').hidden), true);
    const ans = await ev(() => gate.a);
    await ev((a) => { document.querySelector('#gA').value = String(a); document.querySelector('#gGo').click(); }, ans);
    assert.strictEqual(await ev(() => document.querySelector('#pPanel').hidden), false);
    await layout('家長設定');
    await ev(() => { document.querySelectorAll('#pQ button')[2].click(); document.querySelectorAll('#pLv button')[1].click(); document.querySelector('#pBeep').click(); });
    assert.deepStrictEqual(await ev(() => JSON.parse(localStorage.getItem('kidsl_opts'))), { q: 20, lv: 2, speak: false, beep: true });
    await ev(() => document.querySelector('#pClear').click());                                  // 預設 dismiss = 取消
    assert.ok(await ev(() => JSON.parse(localStorage.getItem('kidsl_stats')).count[0][1] > 0), '取消不清除');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    await ev(() => document.querySelector('#pClear').click());
    assert.deepStrictEqual(await ev(() => JSON.parse(localStorage.getItem('kidsl_stats')).count), [[0, 0], [0, 0], [0, 0]]);
    assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('kidsl_opts')).q), 20);   // 設定保留

    // 6) 輔助頁（乘法表 / 注音表 / 日曆）版面
    for (const u of [2, 10, 6]) { await ev(() => renderHome()); await ev((u) => document.querySelectorAll('.ubtn')[u].click(), u); assert.ok(await ev(() => document.querySelector('#extras').children.length > 0)); await layout('輔助頁 ' + u); }
    await ev(() => { openUnit('mul'); }); await ev(() => document.querySelector('#extras .grid2, #extras .row button').click());

    assert.deepStrictEqual(errors, []);
    console.log('ok  kids-learn e2e');
} finally { await browser.close(); }
