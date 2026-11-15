// electronics-calc 畫面；順便驗 home-calc 磁磚油漆分頁與 unit-converter 紙張尺寸
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const mk = async (rel) => {
    const { page, errors } = await openPage(browser, rel);
    return {
        page, errors,
        txt: (sel) => page.$eval(sel, e => e.textContent),
        type: (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v),
        sel: (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v),
        tab: (i) => page.evaluate((n) => document.querySelector(`#tabs button[data-i="${n}"]`).click(), i),
        noScroll: async (tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動'),
    };
};
{   // electronics-calc
    const t = await mk('utils/electronics-calc.html');
    await t.page.evaluate(() => localStorage.clear()); await t.page.reload({ waitUntil: 'load' });
    assert.ok((await t.txt('#o_cb')).includes('4.7 kΩ'), await t.txt('#o_cb'));
    assert.strictEqual(await t.page.$$eval('#res1 i', l => l.length), 5);
    await t.sel('#cb_n', '5'); assert.ok(await t.page.$eval('#cb_4', e => !e.parentElement.hidden) && await t.page.$eval('#cb_5', e => e.parentElement.hidden));
    await t.sel('#cb_n', '4');
    await t.type('#cr_v', '4k7'); assert.ok((await t.txt('#o_cr')).includes('黃 紫 紅 金'), await t.txt('#o_cr'));
    await t.type('#cr_v', '4730'); assert.ok((await t.txt('#o_cr')).includes('四捨五入'));
    await t.noScroll('色碼');
    await t.tab(1); assert.ok((await t.txt('#o_g_ohm')).includes('2 A') && (await t.txt('#o_g_ohm')).includes('24 W'), await t.txt('#o_g_ohm'));
    await t.type('#oh_i', '1'); assert.ok((await t.txt('#o_g_ohm')).includes('請只填'));
    await t.tab(2); assert.ok((await t.txt('#o_g_net')).includes('650 Ω'), await t.txt('#o_g_net'));
    await t.tab(3); assert.ok((await t.txt('#o_g_led')).includes('150 Ω'), await t.txt('#o_g_led'));
    await t.tab(4); assert.ok((await t.txt('#o_g_div')).includes('2.5 V'), await t.txt('#o_g_div'));
    await t.tab(5); assert.ok((await t.txt('#o_g_rc')).includes('1 ms') && (await t.txt('#o_g_rc')).includes('159'), await t.txt('#o_g_rc'));
    await t.tab(6); assert.ok((await t.txt('#o_g_e')).includes('4.7 kΩ'), await t.txt('#o_g_e'));
    for (let i = 0; i < 7; i++) { await t.tab(i); await t.noScroll('分頁' + i); }
    // 記住輸入、壞資料
    await t.tab(5); await t.type('#rc_r', '1k'); await t.page.reload({ waitUntil: 'load' });
    assert.strictEqual(await t.page.$eval('#rc_r', e => e.value), '1k'); assert.ok(await t.page.$eval('#p5', e => !e.hidden));
    await t.page.evaluate(() => localStorage.setItem('electronicsc_opts', JSON.stringify({ tab: 'x', v: { cb_n: '9', cb_0: 'zzz', rc_r: 5 } }))); await t.page.reload({ waitUntil: 'load' });
    assert.ok((await t.txt('#o_cb')).includes('4.7 kΩ'));
    await t.page.evaluate(() => localStorage.setItem('electronicsc_opts', '[[[')); await t.page.reload({ waitUntil: 'load' });
    assert.deepStrictEqual(t.errors, []);
}
{   // home-calc 磁磚與油漆
    const t = await mk('utils/home-calc.html');
    await t.page.evaluate(() => localStorage.clear()); await t.page.reload({ waitUntil: 'load' });
    await t.tab(7); assert.ok(await t.page.$eval('#p7', e => !e.hidden));
    assert.ok((await t.txt('#o_g_room')).includes('35.5'), await t.txt('#o_g_room'));
    assert.ok((await t.txt('#o_g_tile')).includes('43 片') && (await t.txt('#o_g_tile')).includes('11 箱'), 'TILE:' + await t.txt('#o_g_tile'));
    assert.ok((await t.txt('#o_g_paint')).includes('7.1 L') && (await t.txt('#o_g_paint')).includes('2 桶'), await t.txt('#o_g_paint'));
    await t.type('#ti_pr', '100'); assert.ok((await t.txt('#o_g_tile')).includes('4,400'));
    await t.noScroll('磁磚油漆'); assert.deepStrictEqual(t.errors, []);
}
{   // unit-converter 紙張尺寸
    const t = await mk('utils/unit-converter.html');
    await t.page.evaluate(() => [...document.querySelectorAll('#cats button')].find(b => b.textContent === '紙張尺寸').click());
    assert.ok(await t.page.$eval('#paper', e => !e.hidden) && await t.page.$eval('#out', e => e.hidden));
    assert.ok((await t.txt('#ppout')).includes('210 × 297 mm') && (await t.txt('#ppout')).includes('2,480 × 3,508 px'), await t.txt('#ppout'));
    await t.sel('#pp', String(await t.page.$$eval('#pp option', o => o.findIndex(x => x.textContent === 'JIS B0'))));
    assert.ok((await t.txt('#ppout')).includes('1,030 × 1,456 mm'));
    await t.page.evaluate(() => [...document.querySelectorAll('#cats button')].find(b => b.textContent === '長度').click());
    assert.ok(await t.page.$eval('#paper', e => e.hidden) && await t.page.$eval('#out', e => !e.hidden) && (await t.txt('#out')).includes('公分'));
    await t.noScroll('紙張'); assert.deepStrictEqual(t.errors, []);
}
await browser.close();
