// n3 批次畫面行為：utils/pantry.html（採買與冰箱）與 utils/recipe-scaler.html 食譜本（標籤 / 成本）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const ls = (page, k) => page.evaluate((x) => JSON.parse(localStorage.getItem(x)), k);
const noHScroll = async (page, errors, name) => { assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), name + ' 橫向溢出'); assert.deepStrictEqual(errors, [], name + ' 有錯誤'); };
const dayOff = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

// ---- pantry ----
{
    const { page, errors } = await openPage(browser, 'utils/pantry.html');
    await page.evaluateOnNewDocument(() => { window.confirm = () => true; }); await page.evaluate(() => { localStorage.setItem('recipe_saved', JSON.stringify([{ id: 'r1', name: '咖哩', text: '馬鈴薯 2 顆\n洋蔥 1 顆' }, { id: 'bad' }, null])); });
    await page.reload({ waitUntil: 'load' });
    // 購物清單
    await set(page, '#sName', '高麗菜'); await set(page, '#sQty', '1 顆'); await click(page, '#sAdd');
    await set(page, '#sName', '高麗菜'); await set(page, '#sQty', '2 顆'); await click(page, '#sAdd');
    assert.equal((await ls(page, 'pantry_shop')).length, 1); assert.equal((await ls(page, 'pantry_shop'))[0].qty, '1 顆+2 顆');
    await click(page, '#sQuick button'); assert.equal((await ls(page, 'pantry_shop')).length, 2);
    await click(page, '#sList input[type=checkbox]'); assert.ok((await ls(page, 'pantry_shop')).some(x => x.done));
    await click(page, '#sClearDone'); assert.equal((await ls(page, 'pantry_shop')).length, 1);
    // 冰箱：過期的出現在今日優先食用
    await page.evaluate(() => document.querySelector('[data-tab=fridge]').click());
    await set(page, '#fName', '雞胸肉'); await set(page, '#fBuy', dayOff(-5)); await set(page, '#fExp', dayOff(-1)); await click(page, '#fAdd');
    await set(page, '#fName', '米'); await set(page, '#fLoc', '常溫'); await set(page, '#fExp', dayOff(30)); await click(page, '#fAdd');
    assert.ok((await text(page, '#fEatList')).includes('雞胸肉') && (await text(page, '#fEatList')).includes('已過期'));
    assert.ok(!(await text(page, '#fEatList')).includes('米'));
    assert.equal((await text(page, '#fList')).indexOf('雞胸肉') < (await text(page, '#fList')).indexOf('米'), true);
    await set(page, '#fPre', '0'); assert.equal(await page.evaluate(() => document.querySelector('#fExp').value), dayOff(-2));   // 購買日（5 天前）+ 3 天
    await click(page, '#fEatList [data-use]'); assert.equal((await ls(page, 'pantry_fridge')).length, 1);
    // 菜單 → 購物清單
    await page.evaluate(() => document.querySelector('[data-tab=menu]').click());
    assert.equal(await page.evaluate(() => document.querySelectorAll('#dishes option').length), 1);   // 壞食譜被略過
    await set(page, '[data-d="0"][data-m="0"]', '咖哩'); await set(page, '[data-d="1"][data-m="1"]', '神秘料理');
    assert.equal((await ls(page, 'pantry_menu'))[0][0], '咖哩'); assert.equal((await ls(page, 'pantry_menu')).length, 7);
    await click(page, '#mToShop');
    const names = (await ls(page, 'pantry_shop')).map(x => x.name); assert.ok(names.includes('馬鈴薯 2 顆') && names.includes('洋蔥 1 顆') && names.includes('備料：神秘料理'));
    assert.deepStrictEqual(await ls(page, 'recipe_saved'), [{ id: 'r1', name: '咖哩', text: '馬鈴薯 2 顆\n洋蔥 1 顆' }, { id: 'bad' }, null]);   // 唯讀：不改動
    await click(page, '#mClear'); assert.ok((await ls(page, 'pantry_menu')).flat().every(x => x === ''));
    // 發酵
    await page.evaluate(() => document.querySelector('[data-tab=ferment]').click());
    await set(page, '#gName', '酸種'); await set(page, '#gKind', '酸種'); await set(page, '#gStart', dayOff(-3)); await click(page, '#gAdd');
    assert.ok((await text(page, '#gList')).includes('逾期'));   // 每天餵、3 天前開始
    await click(page, '#gList [data-fed]'); assert.equal((await ls(page, 'pantry_ferment'))[0].last, dayOff(0)); assert.ok(!(await text(page, '#gList')).includes('逾期'));
    await click(page, '#gList [data-del]'); assert.equal((await ls(page, 'pantry_ferment')).length, 0);
    // 壞資料載入不當機
    await page.evaluate(() => { localStorage.setItem('pantry_shop', '{"a":1}'); localStorage.setItem('pantry_fridge', 'null'); localStorage.setItem('pantry_menu', '"x"'); localStorage.setItem('pantry_ferment', '[1,null,{"id":"a"}]'); });
    await page.reload({ waitUntil: 'load' });
    assert.ok((await text(page, '#sList')).includes('空的'));
    // 全部清除
    await set(page, '#sName', 'x'); await click(page, '#sAdd'); await click(page, '#allClear');
    assert.deepStrictEqual(await ls(page, 'pantry_shop'), []); assert.deepStrictEqual(await ls(page, 'pantry_fridge'), []);
    assert.ok(await page.evaluate(() => localStorage.getItem('recipe_saved') !== null));   // 不清到別的工具
    // 各分頁手機版不橫向溢出（填入大量資料）
    await page.evaluate(() => {
        const L = (n, f) => JSON.stringify(Array.from({ length: n }, (_, i) => f(i)));
        localStorage.setItem('pantry_shop', L(40, i => ({ id: 's' + i, name: '很長很長的品項名稱'.repeat(5), qty: '12345678901234567890', cat: '蔬果' })));
        localStorage.setItem('pantry_fridge', L(40, i => ({ id: 'f' + i, name: '很長很長的食材名稱'.repeat(5), qty: '12345678901234567890', loc: '冷藏', buy: '2026-10-01', exp: '2026-10-' + String(i % 28 + 1).padStart(2, '0') })));
        localStorage.setItem('pantry_ferment', L(5, i => ({ id: 'g' + i, name: '很長'.repeat(15), kind: '酸種', start: '2026-10-01', ratio: '12345678901234567890', note: '備註'.repeat(30), every: 1 })));
        localStorage.setItem('pantry_menu', JSON.stringify(Array.from({ length: 7 }, () => ['三十個字的菜名'.repeat(4), '三十個字的菜名'.repeat(4)])));
    });
    await page.reload({ waitUntil: 'load' });
    for (const t of ['shop', 'fridge', 'menu', 'ferment']) { await page.evaluate((x) => document.querySelector(`[data-tab=${x}]`).click(), t); await noHScroll(page, errors, 'pantry ' + t); }
    await page.close();
}

// ---- recipe-scaler 食譜本 ----
{
    const { page, errors } = await openPage(browser, 'utils/recipe-scaler.html');
    await page.evaluateOnNewDocument(() => { window.confirm = () => true; }); await page.evaluate(() => { localStorage.setItem('recipe_saved', JSON.stringify([{ id: 'old', name: '舊食譜', text: '麵粉 250g\n蛋 2 顆' }, { id: 'x' }])); });
    await page.reload({ waitUntil: 'load' });
    assert.ok((await text(page, '#list')).includes('舊食譜'));   // 舊資料可載入
    await set(page, '#src', '番茄 2 顆\n蛋 3 顆'); await set(page, '#rName', '番茄炒蛋'); await set(page, '#rTags', '家常, 快速'); await click(page, '#save');
    assert.deepStrictEqual((await ls(page, 'recipe_saved')).find(r => r.name === '番茄炒蛋').tags, ['家常', '快速']);
    assert.ok((await text(page, '#tagBar')).includes('家常'));
    await click(page, '#tagBar [data-tag="家常"]'); assert.ok(!(await text(page, '#list')).includes('舊食譜'));
    await click(page, '#tagBar [data-tag=""]'); await set(page, '#rSearch', '麵粉'); assert.ok(!(await text(page, '#list')).includes('番茄炒蛋')); await set(page, '#rSearch', '');
    // 成本
    await page.evaluate(() => [...document.querySelectorAll('#list .li')].find(d => d.innerText.includes('番茄炒蛋')).querySelector('[data-act=cost]').click());
    await click(page, '#cFill'); assert.equal(await page.evaluate(() => document.querySelectorAll('#costItems .cst').length), 2);
    await set(page, '#costItems .cst:nth-child(1) [data-k=p]', '5'); await set(page, '#costItems .cst:nth-child(2) [data-k=p]', '6'); await set(page, '#cServ', '2'); await set(page, '#cSell', '50');
    // 番茄 5×2 + 蛋 6×3 = 28；每份 14；毛利 36（72%）
    const out = await text(page, '#costOut'); assert.ok(out.includes('總成本 28') && out.includes('每份成本 14') && out.includes('毛利 36') && out.includes('72%'), out);
    await click(page, '#cSave'); const r = (await ls(page, 'recipe_saved')).find(x => x.name === '番茄炒蛋'); assert.equal(r.cost.items.length, 2); assert.equal(r.cost.servings, 2);
    assert.ok((await text(page, '#list')).includes('每份成本 14'));
    await noHScroll(page, errors, 'recipe-scaler');
    // 刪除食譜一併清掉成本編輯區
    await page.evaluate(() => [...document.querySelectorAll('#list .li')].find(d => d.innerText.includes('番茄炒蛋')).querySelector('[data-act=del]').click());
    assert.ok(await page.evaluate(() => document.querySelector('#costBox').hidden)); assert.ok(!(await ls(page, 'recipe_saved')).some(x => x.name === '番茄炒蛋'));
    await page.close();
}
await browser.close();
console.log('ok  pantry e2e');
