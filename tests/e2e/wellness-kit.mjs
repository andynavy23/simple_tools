// wellness-kit：斷食開始 / 進食寫歷史與刪除、伸展倒數換動作、呼吸開始停止、運動計次存紀錄與上限、壞資料載入、390px 不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/wellness-kit.html');
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
await ev(() => { window.confirm = () => true; });
const tab = (t) => click(`#tabs [data-t=${t}]`);
const noOverflow = async (m) => assert.ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');

// 斷食：開始 → 把開始時間往前撥 17 小時 → 進食 → 歷史 1 筆達標
await click('#fStart');
assert.ok(await ev(() => !!JSON.parse(localStorage.getItem('wellness_fast')).cur));
await ev(() => { F.cur.s -= 17 * 3600e3; });
await click('#fEat');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('wellness_fast')).hist.length), 1);
assert.ok(await ev(() => F.hist[0].ok));
assert.ok((await ev(() => document.querySelector('#fStreak').textContent)).startsWith('1'));
await click('#fHist .sm'); assert.strictEqual(await ev(() => F.hist.length), 0);
// 上限：滿了拒絕開始
await ev(() => { for (let i = 0; i < 365; i++) F.hist.push({ id: 'z' + i, s: 1000, e: 2000, g: 16, ok: false }); });
await click('#fStart'); assert.ok(await ev(() => !F.cur && !document.querySelector('#fWarn').hidden), '滿了要拒絕');
await click('#fClear'); assert.strictEqual(await ev(() => F.hist.length), 0);
await noOverflow('斷食');

// 伸展：全套開始，倒數到期自動換下一個，跳過，結束
await tab('str');
await click('#sParts [data-p=all]');
assert.strictEqual(await ev(() => st.i), 0);
await ev(() => { st.end = Date.now() - 1; });
await new Promise(r => setTimeout(r, 500));
assert.strictEqual(await ev(() => st.i), 1);
await click('#sPause'); assert.ok(await ev(() => st.paused != null));
await click('#sPause'); await click('#sSkip'); assert.strictEqual(await ev(() => st.i), 2);
await click('#sStop'); assert.strictEqual(await ev(() => st), null);
await noOverflow('伸展');

// 呼吸：開始 / 停止、選項只存 wellness_opts
await tab('br');
await ev(() => { const s = document.querySelector('#bP'); s.value = 'box'; s.onchange(); });
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('wellness_opts')).bp), 'box');
await click('#bGo'); await new Promise(r => setTimeout(r, 400));
assert.ok(await ev(() => !!br && document.querySelector('#bTxt').textContent === '吸氣'));
await click('#bGo'); assert.strictEqual(await ev(() => br), null);
await noOverflow('呼吸');

// 運動：計次、完成一組、休息倒數、刪除、上限、清除
await tab('wo');
await click('#wPlus'); await click('#wPlus'); await click('#wMinus'); await click('#wPlus');
assert.strictEqual(await ev(() => cnt), 2);
await click('#wDone');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('wellness_log')).length), 1);
assert.ok(await ev(() => !document.querySelector('#wRestBig').hidden), '組間休息倒數');
await click('#wList .sm'); assert.strictEqual(await ev(() => LOG.length), 0);
await ev(() => { for (let i = 0; i < 1000; i++) LOG.push({ id: 'z' + i, d: today(), it: '深蹲', n: 1 }); cnt = 5; });
await click('#wDone'); assert.ok(await ev(() => LOG.length === 1000 && !document.querySelector('#wWarn').hidden), '滿了要拒絕');
await click('#wClear'); assert.strictEqual(await ev(() => LOG.length), 0);
await noOverflow('運動');

// 壞資料載入不出錯
for (const bad of ['null', '"x"', '[1,2]', '{"hist":[null,{"id":3}],"cur":{"s":"a"}}']) {
    await ev((b) => { localStorage.setItem('wellness_fast', b); localStorage.setItem('wellness_log', b); localStorage.setItem('wellness_opts', b); }, bad);
    await page.reload({ waitUntil: 'load' });
    assert.ok(await ev(() => document.querySelector('#fBtns button')), '壞資料 ' + bad);
}
assert.deepStrictEqual(errors.filter(e => !/favicon/.test(String(e))), []);
await browser.close();
console.log('ok  wellness-kit e2e');
