// timers 烹飪分頁：水煮蛋 / 義大利麵算時並加入倒數、多鍋依結束時間排序、單獨靜音並記住、手機不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'fun/timers.html');
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await click('[data-tab=ck]');
    assert.ok(await page.$eval('#ck', e => !e.hidden));
    assert.ok(/\d+ 分 \d\d 秒/.test(await txt('#egOut')), await txt('#egOut'));
    assert.ok((await txt('#paOut')).includes('9 分 00 秒') && (await txt('#paOut')).includes('2 L / 20 g'), await txt('#paOut'));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), '烹飪橫向捲動');
    // 麵先開始（9 分），蛋再開始（約 7 分，比麵早結束）→ 蛋排前面
    await page.evaluate(() => { document.querySelector('#paGo').click(); document.querySelector('[data-tab=ck]').click(); });
    await page.select('#egDone', 'soft'); await click('#egGo');
    assert.ok(await page.$eval('#cd', e => !e.hidden), '加入後切到倒數');
    const names = await page.$$eval('#cdList .name', els => els.map(e => e.textContent));
    assert.strictEqual(names.length, 2); assert.ok(names[0].startsWith('溏心蛋') && names[1].startsWith('直麵'), names.join('|'));
    await page.waitForFunction(() => document.querySelector('#cdNext').textContent.includes('最先結束：溏心蛋'));
    // 靜音並記住
    await page.evaluate(() => document.querySelector('#cdList .card button[aria-label^="提示音"]').click());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('timers_defs')));
    assert.strictEqual(saved.length, 2); assert.strictEqual(saved.filter(x => x.mute).length, 1);
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(await page.$$eval('#cdList .card', e => e.length), 2);
    assert.strictEqual(await page.$$eval('#cdList button[aria-label="提示音已關，按下開啟"]', e => e.length), 1);
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
