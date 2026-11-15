// t6：待辦四象限、世界時鐘分頁、番茄鐘護眼橫幅 / 週報、睡眠週期計算
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const noScroll = async (page, label) => assert.ok(await ev(page, () => document.scrollingElement.scrollWidth <= innerWidth + 1), label + ' 橫向捲動');

{   // 待辦四象限
    const { page, errors } = await openPage(browser, 'fun/todo.html');
    await ev(page, () => { localStorage.setItem('todo_items', JSON.stringify([{ id: 'a', t: '舊項目', due: '', done: false }, { id: 'b', t: '重要', due: '', done: false, important: true, urgent: false }])); location.reload(); });
    await page.waitForFunction(() => document.querySelector('.it'));
    await ev(page, () => document.querySelector('#vQ').click());
    assert.equal(await ev(page, () => document.querySelectorAll('#q_drop .it').length), 1, '舊資料在不重要不緊急');
    assert.equal(await ev(page, () => document.querySelectorAll('#q_plan .it').length), 1);
    await ev(page, () => document.querySelector('#q_drop .qm[data-to=do]').click());
    assert.equal(await ev(page, () => document.querySelectorAll('#q_do .it').length), 1);
    const saved = await ev(page, () => JSON.parse(localStorage.getItem('todo_items')).find(x => x.id === 'a'));
    assert.ok(saved.important === true && saved.urgent === true);
    await ev(page, () => document.querySelector('#q_do input[type=checkbox]').click());
    assert.equal(await ev(page, () => document.querySelectorAll('#qView .it').length), 1, '完成後從四象限消失');
    await noScroll(page, '四象限');
    assert.deepEqual(errors, []);
}
{   // 世界時鐘
    const { page, errors } = await openPage(browser, 'utils/timezone.html');
    await ev(page, () => document.querySelector('#tabWorld').click());
    assert.ok(await ev(page, () => document.querySelectorAll('#wgrid .wc').length) >= 8);
    await ev(page, () => { document.querySelector('#wadd').value = 'Asia/Seoul'; document.querySelector('#waddbtn').click(); });
    assert.ok(await ev(page, () => JSON.parse(localStorage.getItem('timezone_clocks')).zones.includes('Asia/Seoul')));
    await ev(page, () => { document.querySelector('#wh12').click(); });
    assert.ok(await ev(page, () => /上午|下午/.test(document.querySelector('#wgrid .wt').textContent)));
    await ev(page, () => document.querySelector('#wgrid .del').click());
    await noScroll(page, '世界時鐘');
    assert.deepEqual(errors, []);
}
{   // 番茄鐘
    const { page, errors } = await openPage(browser, 'fun/pomodoro.html');
    assert.ok(await ev(page, () => document.querySelector('#wkStats').children.length >= 4), '週報');
    await ev(page, () => { document.querySelector('#eyeOn').click(); });
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('pomo_eye')).on), true);
    await ev(page, () => { eyeNext = Date.now() - 1; eyeTick(); });
    assert.equal(await ev(page, () => document.querySelector('#eyeBar').hidden), false, '橫幅出現');
    await ev(page, () => document.querySelector('#eyeClose').click());
    assert.equal(await ev(page, () => document.querySelector('#eyeBar').hidden), true);
    await noScroll(page, '番茄鐘');
    assert.deepEqual(errors, []);
}
{   // 睡眠週期
    const { page, errors } = await openPage(browser, 'fun/sleep-log.html');
    await ev(page, () => { document.querySelector('#cwake').value = '07:00'; document.querySelector('#cWake').click(); });
    assert.ok((await ev(page, () => document.querySelector('#cout').textContent)).includes('21:45'));
    await ev(page, () => document.querySelector('#cNow').click());
    assert.ok(await ev(page, () => document.querySelectorAll('#cout .stat, #cout > *').length) >= 3);
    assert.deepEqual(errors, []);
}
await browser.close();
console.log('t6-extensions OK');
