// 點子批次 2 的畫面行為：Wake Lock（番茄鐘 / 節拍器）、待辦搜尋與重複、轉盤抽中後移除、閃卡反向、白噪音混音記憶、倒數日編輯
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const WL = () => { window.__wl = { req: 0, rel: 0 }; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wl.req++; return { release() { window.__wl.rel++; }, addEventListener() { } }; } } }); };
try {
    // --- Wake Lock：開始 request 一次、暫停 release；回前景重取 ---
    for (const [rel, btn] of [['fun/pomodoro.html', '#toggle'], ['fun/metronome.html', '#go']]) {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(String(e.message)));
        await page.evaluateOnNewDocument(WL);
        await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/' + rel + '#a', { waitUntil: 'load' });
        await page.evaluate((b) => document.querySelector(b).click(), btn); await wait(600);
        assert.deepEqual(await page.evaluate(() => window.__wl), { req: 1, rel: 0 }, rel + ' 開始後 request 一次');
        await page.evaluate((b) => document.querySelector(b).click(), btn); await wait(300);
        assert.deepEqual(await page.evaluate(() => window.__wl), { req: 1, rel: 1 }, rel + ' 暫停 / 停止後 release');
        assert.deepEqual(errors, [], rel);
        await page.close();
    }
    {   // 不支援 Wake Lock 也不例外
        const { page, errors } = await openPage(browser, 'fun/pomodoro.html');
        await page.evaluate(() => { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }); document.querySelector('#toggle').click(); document.querySelector('#toggle').click(); });
        await wait(300); assert.deepEqual(errors, []); await page.close();
    }
    // --- 待辦：搜尋 + 重複 ---
    {
        const { page, errors } = await openPage(browser, 'fun/todo.html');
        await page.evaluate(() => {
            localStorage.setItem('todo_items', JSON.stringify([
                { id: 'a1', t: '繳費：水', due: '2099-01-01', done: false }, { id: 'a2', t: '繳費：電', due: '', done: false }, { id: 'a3', t: '繳費：網路', due: '2000-01-01', done: true },
                { id: 'b1', t: '買菜', due: '', done: false },
                { id: 'r1', t: '繳房租', due: '2099-01-31', done: false, rep: 'm' }, { id: 'r2', t: '壞資料', due: '2099-01-31', done: false, rep: '<x>' }]));
            location.reload();
        });
        await page.waitForSelector('.it');
        const n = () => page.evaluate(() => document.querySelectorAll('#lists .it').length);
        assert.equal(await n(), 6);
        await page.type('#tq', '繳費');
        assert.equal(await n(), 3, '搜尋只顯示 3 項（含已完成）');
        assert.ok(await page.evaluate(() => [...document.querySelectorAll('#lists h2')].some(h => h.textContent.includes('已完成'))), '保留所在分組');
        await page.$eval('#tq', e => { e.value = ''; e.dispatchEvent(new Event('input')); });
        assert.equal(await n(), 6);
        await page.evaluate(() => { [...document.querySelectorAll('#lists .it')].find(r => r.textContent.includes('繳房租')).querySelector('input').click(); });
        const items = await page.evaluate(() => JSON.parse(localStorage.getItem('todo_items')));
        assert.equal(items.find(x => x.id === 'r1').done, true);
        const nx = items.find(x => x.t === '繳房租' && !x.done);
        assert.equal(nx && nx.due, '2099-02-28', '每月 1/31 → 2/28');
        assert.equal(items.find(x => x.id === 'r2').rep, '', '壞 rep 被清掉');
        await page.evaluate(() => { [...document.querySelectorAll('#lists .it')].find(r => r.textContent.includes('買菜')).querySelector('input').click(); });
        assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('todo_items')))).length, items.length, '沒有 rep 的不產生新項目');
        assert.deepEqual(errors, []); await page.close();
    }
    // --- 待辦：刪除後可復原（原位置）；再刪第二筆則第一筆不可復原 ---
    {
        const { page, errors } = await openPage(browser, 'fun/todo.html');
        await page.evaluate(() => { localStorage.setItem('todo_items', JSON.stringify([1, 2, 3].map(i => ({ id: 'u' + i, t: '項目' + i, due: '', done: false })))); location.reload(); });
        await page.waitForSelector('.it');
        const order = () => page.evaluate(() => JSON.parse(localStorage.getItem('todo_items')).map(x => x.id).join());
        const delRow = (t) => page.evaluate((t) => { [...document.querySelectorAll('#lists .it')].find(r => r.textContent.includes(t)).querySelector('button[aria-label="刪除"]').click(); }, t);
        const undo = () => page.evaluate(() => { const b = document.querySelector('.st-toast:not([hidden]) button'); if (b) b.click(); return !!b; });
        await delRow('項目2');
        assert.equal(await order(), 'u1,u3');
        assert.ok(await page.evaluate(() => document.querySelector('.st-toast').textContent.includes('已刪除『項目2』')));
        assert.ok(await undo()); assert.equal(await order(), 'u1,u2,u3', '復原回到原位置');
        assert.equal(await page.evaluate(() => document.querySelectorAll('#lists .it').length), 3);
        await delRow('項目1'); await delRow('項目3');
        assert.equal(await order(), 'u2');
        assert.ok(await undo()); assert.equal(await order(), 'u2,u3', '只能復原最後一筆（項目1 不可復原）');
        assert.equal(await undo(), false, '復原後按鈕消失');
        assert.deepEqual(errors, []); await page.close();
    }
    // --- 轉盤：抽中後移除 ---
    {
        const { page, errors } = await openPage(browser, 'fun/wheel.html');
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.evaluate(() => { localStorage.setItem('wheel_items', JSON.stringify('A\nB\nC\nD')); location.reload(); });
        await page.waitForSelector('#spin');
        await page.evaluate(() => { document.querySelector('#once').click(); });
        const got = [];
        for (let i = 0; i < 4; i++) { await page.evaluate(() => document.querySelector('#spin').click()); got.push(await page.evaluate(() => document.querySelector('#result').textContent.replace('🎉 ', '')[0])); }
        assert.deepEqual([...got].sort(), ['A', 'B', 'C', 'D'], '4 次各不重複：' + got);
        await page.evaluate(() => document.querySelector('#spin').click());
        assert.ok((await page.evaluate(() => document.querySelector('#result').textContent)).includes('重置本輪'));
        await page.evaluate(() => document.querySelector('#resetRound').click());
        await page.evaluate(() => document.querySelector('#spin').click());
        assert.ok((await page.evaluate(() => document.querySelector('#result').textContent)).includes('🎉'));
        assert.equal(await page.evaluate(() => document.querySelectorAll('#hist li').length), 5);
        assert.deepEqual(errors, []); await page.close();
    }
    // --- 閃卡：背→正 ---
    {
        const { page, errors } = await openPage(browser, 'fun/flashcards.html');
        await page.evaluate(() => {
            localStorage.setItem('flash_decks', JSON.stringify({ d: [{ f: 'apple', b: '蘋果', ease: 2.5, iv: 0, reps: 0, due: '', seen: false }] }));
            localStorage.setItem('flash_cur', JSON.stringify({ n: 'd', dir: 'b' })); location.reload();
        });
        await page.waitForSelector('#face span');
        assert.equal(await page.evaluate(() => document.querySelector('#face').firstChild.firstChild.textContent), '蘋果', '背→正先顯示背面');
        await page.evaluate(() => document.querySelector('#flip').click());
        assert.ok((await page.evaluate(() => document.querySelector('#face').textContent)).includes('apple'));
        await page.evaluate(() => { localStorage.setItem('flash_cur', 'd'); location.reload(); });   // 舊格式
        await page.waitForSelector('#face span');
        assert.equal(await page.evaluate(() => document.querySelector('#face').firstChild.firstChild.textContent), 'apple');
        await page.evaluate(() => { localStorage.setItem('flash_cur', JSON.stringify({ n: 'd', dir: 'zzz' })); location.reload(); });
        await page.waitForSelector('#face span');
        assert.equal(await page.evaluate(() => document.querySelector('#face').firstChild.firstChild.textContent), 'apple');
        assert.deepEqual(errors, []); await page.close();
    }
    // --- 白噪音：混音與記憶 ---
    {
        const { page, errors } = await openPage(browser, 'fun/white-noise.html');
        await page.evaluate(() => { document.querySelector('.sound[data-k=wind]').click(); const v = document.querySelector('#vol'); v.value = 70; v.dispatchEvent(new Event('input')); document.querySelector('#timer').value = '30'; document.querySelector('#timer').dispatchEvent(new Event('change')); document.querySelector('#play').click(); });
        await wait(300);
        assert.equal(await page.evaluate(() => document.querySelector('#play').textContent), '停止');
        await page.evaluate(() => { for (const k of ['pink', 'white']) document.querySelector(`.sound[data-k=${k}]`).click(); });
        assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('wn_opts'))).s.length, 3, '最多 3 種');
        await page.evaluate(() => document.querySelector('#play').click());
        await page.reload({ waitUntil: 'load' });
        assert.deepEqual(await page.evaluate(() => [[...document.querySelectorAll('.sound[aria-pressed=true]')].map(b => b.dataset.k), document.querySelector('#vol').value, document.querySelector('#timer').value]), [['pink', 'rain', 'wind'], '70', '30']);
        await page.evaluate(() => { localStorage.setItem('wn_opts', '{"s":5,"v":"x","t":9}'); location.reload(); });
        await page.waitForSelector('.sound');
        assert.deepEqual(await page.evaluate(() => [[...document.querySelectorAll('.sound[aria-pressed=true]')].map(b => b.dataset.k), document.querySelector('#vol').value]), [['rain'], '40']);
        assert.deepEqual(errors, []); await page.close();
    }
    // --- 倒數日：編輯保留清單 ---
    {
        const { page, errors } = await openPage(browser, 'utils/countdown.html');
        await page.evaluate(() => { localStorage.setItem('countdown_events', JSON.stringify([{ name: '旅行', date: '2099-05-01', yearly: false, items: [{ t: '護照', done: true }] }, { name: '考試', date: '2099-03-01', yearly: false, items: [] }])); location.reload(); });
        await page.waitForSelector('#list .ev');
        const first = () => page.evaluate(() => document.querySelector('#list .ev .name').textContent);
        assert.equal(await first(), '考試');
        await page.evaluate(() => { [...document.querySelectorAll('#list .ev')].find(r => r.querySelector('.name').textContent === '旅行').querySelector('button.sm[aria-label^="編輯"]').click(); });
        await page.$eval('#date', e => { e.value = '2099-01-01'; });
        await page.$eval('#name', e => { e.value = '旅行改'; });
        await page.evaluate(() => document.querySelector('#add').click());
        assert.equal(await first(), '旅行改', '排序更新');
        const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('countdown_events')));
        assert.equal(ev.length, 2);
        const t = ev.find(e => e.name === '旅行改');
        assert.deepEqual([t.date, t.items], ['2099-01-01', [{ t: '護照', done: true }]]);
        assert.deepEqual(errors, []); await page.close();
    }
} finally { await browser.close(); }
console.log('ideas-batch2 OK');
