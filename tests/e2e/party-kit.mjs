// party-kit：按住看（放開隱藏）、國王 / 發牌 / 交換禮物流程、自訂題目上限與刪除、腦筋急轉彎看過標記、比手畫腳倒數、390px 不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const { page, errors } = await openPage(browser, 'fun/party-kit.html');
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
await ev(() => { window.confirm = () => true; window.alert = () => { window.__alert = 1; }; });
const tab = (t) => click(`#tabs [data-t=${t}]`);
const setNames = (s) => ev((s) => { const n = document.querySelector('#names'); n.value = s; n.oninput(); }, s);
const holdText = (on) => ev((on) => { const s = document.querySelector('section:not([hidden])'), h = s.querySelector('.hold'); h.dispatchEvent(new Event(on ? 'pointerdown' : 'pointerup')); return s.querySelector('.secret').textContent; }, on);
const noOverflow = async (m) => assert.ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');

// 真心話
await click('#todGo'); assert.ok((await ev(() => document.querySelector('#todOut').textContent)).length > 3);
await ev(() => { document.querySelector('#todLv').value = 'mine'; });
await click('#todGo'); assert.ok((await ev(() => document.querySelector('#todOut').textContent)).includes('自訂'));
await ev(() => { document.querySelector('#todNew').value = '我的題目'; }); await click('#todAdd');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('partykit_custom')).tod.length), 1);
await click('#todGo'); assert.ok((await ev(() => document.querySelector('#todOut').textContent)).includes('我的題目'));
await click('#todList .sm'); assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('partykit_custom')).tod.length), 0);
// 上限
await ev(() => { for (let i = 0; i < 200; i++) S.tod.push({ id: 'z' + i, t: 'T', q: 'q' }); });
await ev(() => { document.querySelector('#todNew').value = '第201題'; }); await click('#todAdd');
assert.ok(await ev(() => window.__alert === 1 && S.tod.length === 200), '滿了要拒絕');
await click('#todClear'); assert.strictEqual(await ev(() => S.tod.length), 0);
await noOverflow('真心話');

// 腦筋急轉彎
await tab('brain'); await click('#brGo'); await click('#brShow');
assert.ok((await ev(() => document.querySelector('#brA').textContent)).startsWith('答案'));
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('partykit_custom')).seen.length), 1);
await click('#brClear'); assert.strictEqual(await ev(() => S.seen.length), 0);

// 比手畫腳
await tab('cha'); await click('#chaGo'); assert.ok((await ev(() => document.querySelector('#chaWord').textContent)).length >= 2);
await ev(() => { document.querySelector('#chaSec').value = 10; document.querySelector('#chaSec').onchange(); });
await click('#chaTimer'); await sleep(300); assert.ok(+(await ev(() => document.querySelector('#chaTime').textContent)) >= 9);
await click('#chaTimer'); // 停止
await click('#chaScore .sm:last-of-type'); assert.ok((await ev(() => document.querySelector('#chaScore').textContent)).includes('1'));
await ev(() => { chaEnd = Date.now() - 1; tickCha(); }); // 時間戳到期不依賴累加
await ev(() => { chaEnd = Date.now() + 100000; });
await noOverflow('比手畫腳');

// 國王
await tab('king'); await setNames('甲\n乙\n丙\n丁');
await click('#kgDeal');
assert.strictEqual(await holdText(false), '？？？');
const seenCards = [];
for (let i = 0; i < 4; i++) {
    assert.ok((await ev(() => document.querySelector('.pass b').textContent)) === '甲乙丙丁'[i]);
    assert.ok(await ev(() => document.querySelector('.pass button:last-child').disabled), '沒看過不能傳');
    seenCards.push(await holdText(true)); assert.strictEqual(await holdText(false), '？？？');
    await click('#kgPass button:last-child');
}
assert.strictEqual(seenCards.filter(t => t.includes('國王')).length, 1);
assert.deepStrictEqual(seenCards.filter(t => !t.includes('國王')).map(t => t.match(/\d/)[0]).sort(), ['1', '2', '3']);
assert.ok(await ev(() => !document.querySelector('#kgAfter').hidden));
await click('#kgCmd'); assert.ok(!/[{}]/.test(await ev(() => document.querySelector('#kgOut').textContent)));
await noOverflow('國王');

// 發牌
await tab('deal'); await setNames('甲\n乙\n丙');
await ev(() => { document.querySelector('#dlSeed').value = 'abc'; document.querySelector('#dlJk').value = '2'; });
await click('#dlGo');
const h1 = await holdText(true); await holdText(false);
await click('#dlGo'); assert.strictEqual(await holdText(true), h1, '同種子要同一手牌'); await holdText(false);
assert.ok((await ev(() => document.querySelector('#dlInfo').textContent)).includes('剩 39 張'));
await ev(() => { document.querySelector('#dlPer').value = 30; }); await click('#dlGo');
assert.ok((await ev(() => document.querySelector('#dlInfo').textContent)).includes('牌不夠'));

// 交換禮物
await tab('gift'); await setNames('A\nB\nC\nD');
await ev(() => { document.querySelector('#gbad').value = 'A,B\nC,D'; });
const to = {};
await click('#gGo');
for (const who of 'ABCD') { const t = await holdText(true); to[who] = t.replace('你要送禮物給：', ''); await holdText(false); await click('#gPass button:last-child'); }
assert.strictEqual(new Set(Object.values(to)).size, 4);
for (const [k, v] of Object.entries(to)) { assert.notStrictEqual(k, v); assert.ok(!(('AB'.includes(k) && 'AB'.includes(v)) || ('CD'.includes(k) && 'CD'.includes(v)))); }
assert.ok(await ev(() => !document.querySelector('#gAfter').hidden));
assert.strictEqual(await ev(() => document.querySelector('#gTable').children.length), 0, '預設不顯示配對表');
await click('#gAll'); assert.strictEqual(await ev(() => document.querySelector('#gTable').children.length), 4);
await ev(() => { document.querySelector('#gbad').value = 'A,B\nA,C\nA,D'; }); await click('#gGo');
assert.ok((await ev(() => document.querySelector('#gErr').textContent)).includes('無解'));
await noOverflow('交換禮物');

assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok  party-kit e2e');
