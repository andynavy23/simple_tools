// csv-tool：進階處理（資料清理 + 復原、JOIN、樞紐、HTML 表格擷取）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/csv-tool.html');
    const val = (s) => page.evaluate((s) => document.querySelector(s).value, s);
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const tab = (t) => click(`[data-t="${t}"]`);
    const check = (idx) => page.evaluate((idx) => { for (const c of document.querySelectorAll('#ccols input')) c.checked = idx.includes(+c.value); }, idx);

    await set('#src', ' 姓名 ,部門,金額,日期\n小明,工程,"1,000",2024/1/2\n小明,工程,"1,000",2024/1/2\n小華,,x,113/5/2');
    assert.equal((await page.$$('#ccols input')).length, 4);
    // 預覽不改資料；套用才改；復原一步
    const before = await val('#src');
    await page.select('#cop', 'dedupe'); await click('#cprev'); assert.match(await txt('#amsg'), /預覽，移除 1 列/); assert.equal(await val('#src'), before);
    await click('#capply'); assert.match(await txt('#amsg'), /已套用，移除 1 列/); assert.match(await txt('#info'), /2 \/ 2 列/);
    assert.equal(await page.evaluate(() => document.querySelector('#undo').disabled), false);
    await click('#undo'); assert.match(await txt('#info'), /3 \/ 3 列/); assert.equal(await val('#src'), before); assert.equal(await page.evaluate(() => document.querySelector('#undo').disabled), true);
    // 數字 / 日期統一（要勾欄位）
    await page.select('#cop', 'number'); await click('#capply'); assert.match(await txt('#amsg'), /請先勾選/);
    await check([2]); await page.select('#cB', '2'); await click('#capply'); assert.match(await val('#src'), /1000\.00/);
    await page.select('#cop', 'date'); await check([3]); await click('#capply'); assert.match(await val('#src'), /2024-01-02/); assert.match(await val('#src'), /2024-05-02/);
    // 補空值 + 去空白（欄位名稱的空白也被處理）
    await page.select('#cop', 'fill'); await check([1]); await page.select('#cB', 'fixed'); await set('#cA', '未填'); await click('#capply'); assert.match(await val('#src'), /小華,未填/);
    await page.select('#cop', 'trim'); await check([]); await click('#cprev'); assert.match(await txt('#amsg'), /變更 0 格/);   // 標題列不在資料列內，欄位名稱不動
    // 拆分 / 合併
    await set('#src', '名稱,標籤\na,x;y\nb,z'); await page.select('#cop', 'split'); await check([1]); await set('#cA', ';'); await click('#capply');
    assert.equal(await val('#src'), '名稱,標籤_1,標籤_2\na,x,y\nb,z,');
    await page.select('#cop', 'merge'); await check([1, 2]); await set('#cA', '-'); await click('#capply'); assert.match(await val('#src'), /標籤_1_標籤_2/);

    // JOIN
    await set('#src', 'id,name\n1,A\n2,B\n3,C'); await tab('pj');
    assert.equal(await page.evaluate(() => document.querySelector('#pj').hidden), false);
    await set('#j2', 'id,name,city\n1,X,TPE\n3,Y,KHH'); assert.equal((await page.$$('#jk2 option')).length, 3);
    await click('#jgo'); assert.equal(await val('#src'), 'id,name,name_2,city\n1,A,X,TPE\n3,C,Y,KHH'); assert.match(await txt('#amsg'), /2 列有配對、1 列沒有配對/);
    await click('#undo'); await page.select('#jt', 'left'); await page.select('#jc', 'drop'); await click('#jgo'); assert.equal(await val('#src'), 'id,name,city\n1,A,TPE\n2,B,\n3,C,KHH');
    await click('#jgo'); await click('#undo');   // 再合併一次也沒問題（右表欄位已進入左表）

    // 樞紐
    await set('#src', '部門,季,金額\nA,Q1,10\nA,Q1,20\nA,Q2,5\nB,Q1,7\nB,Q2,n/a'); await tab('pp');
    await page.select('#pvr', '0'); await page.select('#pvc', '1'); await page.select('#pvv', '2'); await page.select('#pva', 'sum'); await click('#pgo');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#ptbl tr')].map(r => [...r.children].map(c => c.textContent).join(',')));
    assert.deepEqual(rows, ['部門,Q1,Q2,總計', 'A,30,5,35', 'B,7,0,7', '總計,37,5,42']); assert.match(await txt('#amsg'), /1 格不是數字/);
    await click('#puse'); assert.match(await val('#src'), /^部門,Q1,Q2,總計/); await click('#undo'); assert.match(await val('#src'), /^部門,季,金額/);
    await page.select('#pva', 'avg'); await page.select('#pvv', '-1'); await click('#pgo'); assert.match(await txt('#amsg'), /需要選擇值欄位/);

    // HTML 表格擷取：不執行腳本；多個表格要選；colspan 補空
    await tab('ph');
    const html = '<script>window.__ran=1</script><table><tr><th>名稱</th><th>數量</th></tr><tr><td>蘋果 &amp; 梨</td><td>12</td></tr></table><table><tr><td colspan="2">標題</td></tr><tr><td>a</td><td>b</td></tr></table>';
    await set('#h1', html); await click('#hgo'); assert.equal((await page.$$('#hlist button')).length, 2);
    await page.evaluate(() => document.querySelectorAll('#hlist button')[0].click()); assert.equal(await val('#src'), '名稱,數量\n蘋果 & 梨,12');
    await set('#h1', '<table><tr><td>x</td><td>y</td></tr><tr><td>1</td><td>2</td></tr></table>'); await click('#hgo'); assert.equal(await val('#src'), 'x,y\n1,2');
    await set('#h1', '<p>沒有表格</p>'); await click('#hgo'); assert.match(await txt('#amsg'), /找不到/);
    assert.equal(await page.evaluate(() => window.__ran), undefined);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('csv-tool-adv OK');
