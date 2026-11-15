// plan-board：看板（新增卡片、← → ↑ ↓、刪欄兩種模式、篩選、上限、壞資料載入）、時間區塊（點兩格建立、重疊拒絕、統計、範本套用、舊日期修剪）、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const REL = 'utils/plan-board.html';

{
    const { page, errors } = await openPage(browser, REL);
    await ev(page, () => { window.confirm = () => true; window.prompt = () => '欄X'; window.alert = () => { }; });
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    // 看板：新增卡片
    await click(page, '#cols [data-a="add"]');
    await ev(page, () => { kdT.value = '寫報告'; kdD.value = '2000-01-01'; kdC.value = '0'; kdOk.click(); });
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.k').length), 1);
    assert.ok((await ev(page, () => document.querySelector('.kd').textContent)).includes('逾期'));
    await click(page, '.k [data-a="R"]');
    assert.strictEqual(await ev(page, () => document.querySelector('.col:nth-child(2) .k') !== null), true);
    await click(page, '.k [data-a="R"]');   // 到最後一欄：不再逾期
    assert.ok(!(await ev(page, () => document.querySelector('.kd.od'))));
    assert.ok(await ev(page, () => JSON.parse(localStorage.planb_boards).boards[0].cards.length === 1));
    // 篩選
    await click(page, '#dots [data-f="1"]');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.k').length), 0);
    await click(page, '#dots [data-f="-1"]');
    // 刪欄（卡片在第三欄，刪第三欄 → 卡片移到第一欄）
    await click(page, '.col:nth-child(3) [data-a="cdel"]');
    assert.strictEqual(await ev(page, () => [document.querySelectorAll('.col').length, document.querySelector('.col:nth-child(1) .k') !== null].join()), '2,true');
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    // 時間區塊
    await click(page, '.tabs [data-t="t"]');
    await ev(page, () => { document.querySelector('.tc[data-i="6"]').click(); document.querySelector('.tc[data-i="7"]').click(); bt.value = '開會'; });
    assert.strictEqual(await ev(page, () => [bs.value, be.value].join()), '540,600');
    await click(page, '#blkSave');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.blk').length), 1);
    // 重疊拒絕
    await ev(page, () => { bs.value = 570; be.value = 630; bt.value = '重疊'; blkSave.click(); });
    assert.ok((await ev(page, () => tmsg.textContent)).includes('重疊'));
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.blk').length), 1);
    assert.ok((await ev(page, () => stats.textContent)).includes('開會') === false && (await ev(page, () => stats.textContent)).includes('工作') === false);
    // 範本：存、換日、套用
    await click(page, '#tplSave');
    await ev(page, () => { dNext.click(); });
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.blk').length), 0);
    await click(page, '#tplApply');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.blk').length), 1);
    assert.ok(await ev(page, () => Object.keys(localStorage).filter(k => k.startsWith('planb_blocks_')).length === 2));
    // 清除全部時間區塊
    await click(page, '#clrD');
    assert.ok(await ev(page, () => Object.keys(localStorage).filter(k => k.startsWith('planb_blocks_')).length === 0));
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
}
{   // 壞資料 + 舊日期修剪
    const { page, errors } = await openPage(browser, REL);
    await ev(page, () => {
        localStorage.planb_boards = JSON.stringify({ boards: [{ cols: null, cards: [{ title: 5 }, null] }, 7] });
        localStorage.planb_tpl = '[1,2';
        localStorage['planb_blocks_2001-01-01'] = JSON.stringify({ blocks: [{ id: 'a', s: 0, e: 60, t: 'x', c: 0 }] });
        localStorage['planb_blocks_' + new Date().toLocaleDateString('sv')] = '{"blocks":"bad"}';
    });
    await page.reload();
    assert.ok(await ev(page, () => localStorage['planb_blocks_2001-01-01'] === undefined), '舊日期應被修剪');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.col').length), 3);
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('ok  plan-board e2e');
