// 史地小百科：年表搜尋與展開、國旗首都對照表與測驗（含錯題加強）、台灣地理、歷史卡片、統計存取與壞資料、清除統計、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/history-geo.html');
const $ev = (fn, ...a) => page.evaluate(fn, ...a);
const click = (sel) => $ev((s) => document.querySelector(s).click(), sel);
const vis = (sel) => $ev((s) => !document.querySelector(s).hidden, sel);
const noOverflow = async (tag) => { const w = await $ev(() => [document.scrollingElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1], `${tag} 橫向捲動 ${w}`); };
const tab = (t) => click(`#tabs button[data-tab="${t}"]`);
const store = () => $ev(() => JSON.parse(localStorage.getItem('histgeo_stats')));

// ---- 朝代年表 ----
assert.equal(await $ev(() => document.querySelectorAll('#tlist details.t').length), 24, '朝代 24 筆');
await noOverflow('年表');
await $ev(() => document.querySelectorAll('#tlist details.t').forEach(d => d.open = true)); await noOverflow('年表全展開');
for (const [g, min] of [['cn', 20], ['tw', 25], ['wd', 25]]) { await click(`#tgroups button[data-g="${g}"]`); assert.ok(await $ev(() => document.querySelectorAll('#tlist details.t').length) >= min, g); }
await $ev(() => { const q = document.querySelector('#tq'); q.value = '1895'; q.dispatchEvent(new Event('input')); });
assert.ok((await $ev(() => document.querySelector('#tlist').textContent)).includes('日本統治時期'));
assert.ok((await $ev(() => document.querySelector('#tnote').textContent)).includes('搜尋全部分組'));
await $ev(() => { const q = document.querySelector('#tq'); q.value = '臺灣'; q.dispatchEvent(new Event('input')); });
const nTw = await $ev(() => document.querySelectorAll('#tlist details.t').length);
await $ev(() => { const q = document.querySelector('#tq'); q.value = '台灣'; q.dispatchEvent(new Event('input')); }); assert.equal(await $ev(() => document.querySelectorAll('#tlist details.t').length), nTw, '臺 / 台 等同');
await $ev(() => { const q = document.querySelector('#tq'); q.value = 'zzzqqq'; q.dispatchEvent(new Event('input')); }); assert.ok((await $ev(() => document.querySelector('#tlist').textContent)).includes('沒有符合'));
await $ev(() => { const q = document.querySelector('#tq'); q.value = ''; q.dispatchEvent(new Event('input')); });
// 點開摘要看到說明
await click('#tgroups button[data-g="dyn"]');
await $ev(() => document.querySelector('#tlist details.t summary').click()); assert.equal(await $ev(() => document.querySelector('#tlist details.t').open), true);

// ---- 國旗首都：對照表 ----
await tab('world');
assert.equal(await $ev(() => document.querySelectorAll('#clist .li').length), 194);
await click('#conts button[data-c="大洋洲"]'); assert.equal(await $ev(() => document.querySelectorAll('#clist .li').length), 14);
await click('#conts button[data-c=""]');
await $ev(() => { const q = document.querySelector('#cq'); q.value = '巴黎'; q.dispatchEvent(new Event('input')); });
assert.equal(await $ev(() => document.querySelectorAll('#clist .li').length), 1); assert.ok((await $ev(() => document.querySelector('#clist').textContent)).includes('法國'));
await $ev(() => { const q = document.querySelector('#cq'); q.value = ''; q.dispatchEvent(new Event('input')); });
await noOverflow('國家對照表');
// 國旗不支援時：測驗的國旗題型停用並說明；支援時可用（兩種情況都驗證）
await $ev(() => { FLAG_OK = false; drawWorld(); });
assert.equal(await $ev(() => document.querySelector('#wsub button[data-s="table"]').click() || document.querySelector('#clist .fl') === null), true, '不支援時不顯示國旗欄');
await click('#wsub button[data-s="quiz"]');
assert.equal(await $ev(() => document.querySelector('#qmodes button[data-m="flag"]').disabled), true); assert.equal(await vis('#flagWarn'), true);
await $ev(() => { FLAG_OK = true; drawWorld(); });
assert.equal(await $ev(() => document.querySelector('#qmodes button[data-m="flag"]').disabled), false); assert.equal(await vis('#flagWarn'), false);

// ---- 測驗：全對一輪、再故意答錯 ----
assert.equal(await $ev(() => document.querySelector('#qwrong').disabled), true, '沒有錯題時錯題加強不可選');
for (const m of ['flag', 'cap', 'rcap']) {
    await click(`#qmodes button[data-m="${m}"]`); await click('#qstart');
    assert.equal(await vis('#qplay'), true);
    for (let i = 0; i < 10; i++) {
        const info = await $ev(() => ({ n: document.querySelectorAll('#qopts button').length, flag: document.querySelector('#qprompt').classList.contains('flag'), p: document.querySelector('#qprompt').textContent }));
        assert.equal(info.n, 4); assert.equal(info.flag, m === 'flag'); assert.ok(info.p.length > 0);
        await noOverflow(m + ' 作答');
        await $ev(() => document.querySelector(`#qopts button[data-i="${round[qi].correct}"]`).click());
        assert.ok((await $ev(() => document.querySelector('#qfb').textContent)).includes('答對')); assert.equal(await vis('#qnext'), true);
        await click('#qnext');
    }
    assert.equal(await vis('#qresult'), true); assert.equal(await $ev(() => document.querySelector('#qres').textContent), '10 / 10');
    await click('#qback');
}
let s = await store(); assert.deepEqual([s.quiz.flag.n, s.quiz.flag.ok, s.quiz.cap.n, s.quiz.rcap.ok], [10, 10, 10, 10]); assert.equal(s.quiz.cap.best, 10);
// 故意答錯 3 題 → 結果列出、錯題數出現、可用錯題加強
await click('#qmodes button[data-m="cap"]'); await click('#qstart');
for (let i = 0; i < 3; i++) { await $ev(() => { const w = [...document.querySelectorAll('#qopts button')].findIndex((_, k) => k !== round[qi].correct); document.querySelector(`#qopts button[data-i="${w}"]`).click(); }); assert.ok((await $ev(() => document.querySelector('#qfb').textContent)).includes('正確答案')); await click('#qnext'); }
await click('#qquit'); assert.equal(await vis('#qresult'), true); assert.ok((await $ev(() => document.querySelector('#qwrongList').textContent)).includes('答錯的（3）'));
s = await store(); assert.equal(Object.keys(s.wrong).length, 3); assert.equal(s.quiz.cap.run, 0);
await noOverflow('測驗結果'); await click('#qback');
assert.equal(await $ev(() => document.querySelector('#wrongN').textContent), '3'); assert.equal(await $ev(() => document.querySelector('#qwrong').disabled), false);
await click('#qwrong'); await click('#qstart');
assert.equal(await $ev(() => round.length), 3, '錯題加強只出答錯的國家');
for (let i = 0; i < 3; i++) { await $ev(() => document.querySelector(`#qopts button[data-i="${round[qi].correct}"]`).click()); await click('#qnext'); }
s = await store(); assert.deepEqual(s.wrong, {}, '答對後從錯題移除'); await click('#qback');
// 範圍太小（< 4）會提示而不是壞掉
let alerted = ''; page.removeAllListeners('dialog'); page.on('dialog', d => { alerted = d.message(); d.accept(); });
await $ev(() => { const o = document.querySelector('#qcont'); o.innerHTML += '<option value="火星">火星</option>'; o.value = '火星'; }); await click('#qstart'); assert.ok(alerted.includes('太少'), alerted); assert.equal(await vis('#qsetup'), true);
await $ev(() => { document.querySelector('#qcont').value = ''; });

// ---- 台灣地理 ----
await tab('geo'); assert.ok(await $ev(() => document.querySelectorAll('#glist .li').length) >= 40); await noOverflow('台灣地理');
await $ev(() => { const q = document.querySelector('#gq'); q.value = '玉山'; q.dispatchEvent(new Event('input')); });
const g1 = await $ev(() => document.querySelectorAll('#glist .li').length); assert.ok(g1 >= 2 && g1 < 10);
await $ev(() => { const q = document.querySelector('#gq'); q.value = 'zzzqq'; q.dispatchEvent(new Event('input')); }); assert.ok((await $ev(() => document.querySelector('#glist').textContent)).includes('沒有符合'));

// ---- 歷史卡片 ----
await tab('cards');
assert.ok((await $ev(() => document.querySelector('#cinfo').textContent)).includes('新卡 118'));
await noOverflow('卡片');
assert.equal(await vis('#cans'), false); await click('#cflip'); assert.equal(await vis('#cans'), true); assert.equal(await $ev(() => !document.querySelector('#cback').hidden), true);
await noOverflow('卡片翻面');
await click('#cok'); s = await store(); assert.equal(s.card.ok, 1); assert.equal(Object.keys(s.cards).length, 1);
const id1 = Object.keys(s.cards)[0]; assert.equal(s.cards[id1].b, 1);
await click('#cflip'); await click('#cng'); s = await store(); assert.equal(s.card.ng, 1); assert.equal(Object.keys(s.cards).length, 2);
assert.ok((await $ev(() => document.querySelector('#cinfo').textContent)).includes('到期 1'), '忘記的卡片立刻到期');
// 全部翻完（每張都記得）後出現「今天都複習完了」或持續出新卡；跑 30 張不出錯
for (let i = 0; i < 30; i++) { await click('#cflip'); await click('#cok'); }
s = await store(); assert.ok(s.card.ok >= 31);
assert.ok(Object.keys(s.cards).length <= 118);

// ---- 統計顯示與清除 ----
await $ev(() => drawStats()); assert.ok((await $ev(() => document.querySelector('#statsBox').textContent)).includes('歷史卡片'));
await $ev(() => { window.__c = 0; window.confirm = () => (window.__c++, false); }); await click('#clearStats'); assert.equal(await $ev(() => __c), 1); assert.ok((await store()).card.ok >= 31, '取消不清除');
await $ev(() => { window.confirm = () => true; }); await click('#clearStats');
s = await store(); assert.deepEqual([s.quiz.cap.n, s.card.ok, Object.keys(s.cards).length, Object.keys(s.wrong).length], [0, 0, 0, 0]);
assert.ok((await $ev(() => document.querySelector('#cinfo').textContent)).includes('新卡 118'));

// ---- 壞資料容錯 ----
for (const bad of ['null', '"x"', '[1,2]', '{"quiz":5,"wrong":[],"cards":"a"}', '{"wrong":{"JP":"a","ZZ":3,"FR":-2},"cards":{"bogus":{"b":1,"t":1}},"quiz":{"flag":{"n":"x","ok":9}}}', '{壞掉']) {
    await $ev((b) => localStorage.setItem('histgeo_stats', b), bad); await page.reload({ waitUntil: 'load' });
    await tab('cards'); await tab('world'); await click('#wsub button[data-s="quiz"]'); await $ev(() => drawStats());
    assert.ok((await $ev(() => document.querySelector('#statsBox').textContent)).includes('歷史卡片'), bad);
}
assert.equal(await $ev(() => Object.keys(st.wrong).length), 0, '壞資料被清成預設');
await $ev(() => { localStorage.removeItem('histgeo_stats'); });
assert.deepEqual(errors, []);
await browser.close();
console.log('history-geo OK');
