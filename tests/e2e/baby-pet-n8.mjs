// baby-log 成長 / 副食品、pet-log 健檢 / 貓砂 / 協尋海報 的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const ls = (page, k) => page.evaluate((x) => JSON.parse(localStorage.getItem(x) || 'null'), k);
const noOverflow = async (page, tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + tag);

{ // ----- baby-log -----
    const { page, errors } = await openPage(browser, 'fun/baby-log.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    await set(page, '#gDate', '2026-09-01'); await set(page, '#gH', '60'); await set(page, '#gW', '6.2'); await click(page, '#gSave');
    await set(page, '#gDate', '2026-10-01'); await set(page, '#gH', '64'); await set(page, '#gW', ''); await click(page, '#gSave');
    assert.equal((await ls(page, 'baby_extra')).g.length, 2); assert.ok((await text(page, '#gNoteOut')).includes('共 2 筆'));
    await set(page, '#gH', '999'); await click(page, '#gSave'); assert.ok((await text(page, '#gMsg')).includes('至少填一項'));
    await click(page, '[data-gm=w]'); assert.ok((await text(page, '#gNoteOut')).includes('體重'));
    await page.evaluate(() => document.querySelector('#gList .ent button').click()); assert.equal((await ls(page, 'baby_extra')).g.length, 1);
    await set(page, '#sDate', '2026-10-01'); await set(page, '#sName', '米糊'); await click(page, '#sSave');
    await set(page, '#sDate', '2026-10-20'); await set(page, '#sName', '米糊'); assert.ok((await text(page, '#sHint')).includes('19 天前'));
    await set(page, '#sReact', 'mild'); await click(page, '#sSave'); assert.equal((await ls(page, 'baby_extra')).f.length, 2); assert.ok((await text(page, '#sList')).includes('輕微不適'));
    await noOverflow(page, 'baby');
    await click(page, '#gClear'); await click(page, '#sClear'); const ex = await ls(page, 'baby_extra'); assert.deepEqual([ex.g.length, ex.f.length], [0, 0]);
    assert.equal(await ls(page, 'baby_log'), null);              // 作息紀錄不受影響
    assert.deepEqual(errors, []); await page.close();
}

{ // ----- pet-log -----
    const { page, errors } = await openPage(browser, 'fun/pet-log.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    assert.ok(await page.evaluate(() => document.querySelector('#litCard') && document.querySelector('#main').hidden));
    await click(page, '#addPetBtn'); await set(page, '#p_name', '小花'); await set(page, '#p_sp', '貓'); await click(page, '#savePet');
    assert.ok(await page.evaluate(() => !document.querySelector('#litCard').hidden));
    // 年度健檢預設 12 個月
    await set(page, '#e_type', '年度健檢'); assert.equal(await page.evaluate(() => document.querySelector('#e_cyc').value), '12');
    await set(page, '#e_date', '2026-10-01'); await click(page, '#saveEv'); assert.ok((await text(page, '#dues')).includes('年度健檢')); assert.ok((await text(page, '#dues')).includes('2027-10-01'));
    // 貓砂
    await set(page, '#l_kind', '豆腐砂'); await set(page, '#l_cats', '2'); await set(page, '#l_bag', '6'); await set(page, '#l_box', '4'); await set(page, '#l_g', '120'); await set(page, '#l_cycle', '14');
    await click(page, '#litBuyToday'); assert.ok((await text(page, '#litOut')).includes('預計用完'));
    const pet = (await ls(page, 'pet_log')).pets[0]; assert.equal(pet.lit.cats, 2); assert.equal(pet.lit.kind, '豆腐砂');
    await set(page, '#l_bag', '0'); await click(page, '#litSave'); assert.ok((await text(page, '#litMsg')).includes('超出範圍'));
    await noOverflow(page, 'pet-lit');
    // 海報
    await click(page, '#xMake'); assert.ok((await text(page, '#xMsg')).includes('電話'));
    await set(page, '#x_tel', '0912-345-678'); await set(page, '#x_feat', '橘白相間、藍色項圈');
    await page.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#fc9'; g.fillRect(0, 0, 300, 400);
        const b = await new Promise(r => c.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([b], 'a.png', { type: 'image/png' })); document.querySelector('#x_photo').files = dt.files;
    });
    await click(page, '#xMake'); await page.waitForFunction(() => !document.querySelector('#xDl').disabled, { timeout: 5000 });
    assert.ok(await page.evaluate(() => !document.querySelector('#poster').hidden)); await noOverflow(page, 'pet-poster');
    // 舊資料相容：重新載入仍在；清除貓砂設定
    await page.reload({ waitUntil: 'load' }); assert.equal(await page.evaluate(() => document.querySelector('#l_cats').value), '2');
    await click(page, '#litClear'); assert.equal((await ls(page, 'pet_log')).pets[0].lit, null);
    assert.deepEqual(errors, []); await page.close();
}
await browser.close();
console.log('baby-pet-n8 OK');
