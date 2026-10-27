// math-sci-calc：七個分頁各算一個範例、函數圖形繪製 / 平移 / 縮放、壞輸入、390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/math-sci-calc.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const tab = (t) => click(`.tabs button[data-t=${t}]`);
const noOverflow = async (what) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出：' + what);
const mode = (t, v) => set(`.pane[data-t=${t}] .mode`, v);
const touchAction = () => page.evaluate(() => getComputedStyle(document.querySelector('#cv')).touchAction);

// 數論
assert.ok((await text('#nout')).includes('720'), 'gcd/lcm 範例');
await noOverflow('nt');
await set('#nmode', 'factor'); assert.ok((await text('#nout')).includes('2^3 × 3^2 × 5'));
await set('#nin', '600851475143'); assert.ok((await text('#nout')).includes('6857'));
await set('#nmode', 'prime'); await set('#nin', '2305843009213693951'); assert.ok((await text('#nout')).includes('是質數'));
await set('#nmode', 'modinv'); assert.ok((await text('#nout')).includes('4'));
await set('#nmode', 'egcd'); assert.ok((await text('#nout')).includes('gcd'));
await set('#nin', '1 2 x'); assert.ok((await text('#nerr')).length > 0, '壞輸入要有錯誤訊息'); assert.strictEqual(await text('#nout'), '');
await set('#nmode', 'phi'); await set('#nin', '36'); assert.ok((await text('#nout')).includes('12'));
await set('#nin', '99999999999999999999999'); assert.ok((await text('#nerr')).length > 0, '超過分解上限');

// 統計
await tab('st'); assert.ok((await text('#sout')).includes('母體標準差'));
assert.ok((await text('#sout')).includes('4.5'));
await set('#sin', '1 a'); assert.ok((await text('#serr')).includes('不是數字'));
await set('#sin', '2 4 4 4 5 5 7 9');
await mode('st', 'norm'); assert.ok((await text('#zout')).includes('0.975'));
await set('#zsd', '0'); assert.ok((await text('#zerr')).length > 0);
await noOverflow('st');

// 排列組合
await tab('cb'); assert.ok((await text('#cout')).includes('2598960')); assert.ok((await text('#cout')).includes('34650'));
await set('#cn', '99999'); assert.ok((await text('#cerr')).length > 0);
await set('#cn', '52');
await mode('cb', 'binom'); assert.ok((await text('#bout')).includes('0.24609375'));
await mode('cb', 'expect'); assert.ok((await text('#eout')).includes('3.5'));
await set('#ein', '1 0.5'); assert.ok((await text('#eerr')).includes('總和'));
await noOverflow('cb');

// 幾何
await tab('geo'); assert.ok((await text('#gout')).includes('28.27433388'));
await mode('geo', 'solid'); assert.ok((await text('#gout')).includes('113.0973355'));
await mode('geo', 'pyth'); assert.ok((await text('#pout')).includes('5'));
await mode('geo', 'tri'); assert.ok((await text('#tout')).includes('90'));
await set('#tc', ''); await set('#tC', '90'); assert.ok((await text('#tout')).includes('SAS'), 'SAS');
await set('#tb', '10'); await set('#ta', '6'); await set('#tC', ''); await set('#tA', '30'); assert.ok((await text('#tout')).includes('解 2'), 'SSA 兩組解');
await set('#ta', '1'); await set('#tb', '2'); await set('#tc', '10'); await set('#tA', ''); assert.ok((await text('#terr')).includes('三角形'), '不成立的三邊');
await mode('geo', 'coord'); assert.ok((await text('#kout')).includes('5'));
await mode('geo', 'plane'); await set('#gshape', 'poly'); assert.ok((await text('#gout')).includes('面積'));
await noOverflow('geo');

// 函數圖形
await tab('fn');
const pixels = () => page.evaluate(() => { const c = document.querySelector('#cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++; return n; });
const snap = () => page.evaluate(() => document.querySelector('#cv').toDataURL());
assert.ok(await pixels() > 500, '應該畫出曲線');
const info0 = await text('#vinfo'), img0 = await snap();
await click('#zoomin'); assert.notStrictEqual(await text('#vinfo'), info0); const info1 = await text('#vinfo');
await click('#mright'); assert.notStrictEqual(await text('#vinfo'), info1);
await click('#mup'); await click('#zoomout'); await click('#mleft');
await click('#mreset'); assert.strictEqual(await text('#vinfo'), info0); assert.strictEqual(await snap(), img0, '重設後應回到原圖');
// 滑鼠拖曳平移
await page.evaluate(() => document.querySelector('#cv').scrollIntoView({ block: 'center' }));
const b = await page.evaluate(() => { const r = document.querySelector('#cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2); await page.mouse.down(); await page.mouse.move(b.x + b.w / 2 + 60, b.y + b.h / 2 + 20, { steps: 4 }); await page.mouse.up();
assert.notStrictEqual(await text('#vinfo'), info0, '滑鼠拖曳要平移');
await click('#mreset');
// 觸控拖曳預設不鎖捲動，勾選後才鎖
assert.strictEqual(await touchAction(), 'pan-y');
await click('#pdrag'); assert.strictEqual(await touchAction(), 'none'); await click('#pdrag');
assert.strictEqual(await touchAction(), 'pan-y');
// 分析零點與極值
await set('#f2', ''); await click('#panalyse'); const an = await text('#fout');
assert.ok(an.includes('零點') && an.includes('極大') && an.includes('極小'), an);
assert.strictEqual((an.match(/零點 \d/g) || []).length, 7, 'sin 在 [-10,10] 有 7 個零點');
// 壞輸入與注入
for (const s of ['alert(1)', 'constructor', 'x.constructor', 'sin(']) { await set('#f1', s); assert.ok((await text('#ferr')).length > 0, '應報錯：' + s); }
assert.strictEqual(await page.evaluate(() => typeof window.__pwn), 'undefined');
await set('#f1', '-2^2'); assert.strictEqual(await text('#ferr'), '');
await set('#f1', 'tan(x)'); assert.ok(await pixels() > 200);
await set('#f1', 'sin(x)'); await set('#f2', 'x^2/10');
await noOverflow('fn');

// 化學
await tab('chem'); assert.ok((await text('#mout')).includes('249.6'), '分子量'); assert.ok((await text('#mout')).includes('%'));
await set('#min', 'H2O'); assert.ok((await text('#mout')).includes('18.015'));
await set('#min', 'Xx2'); assert.ok((await text('#merr')).length > 0);
await mode('chem', 'bal'); assert.ok((await text('#bout2')).includes('C3H8 + 5 O2 → 3 CO2 + 4 H2O'));
await set('#bin', 'Fe + O2 -> Fe2O3'); assert.ok((await text('#bout2')).includes('4 Fe + 3 O2 → 2 Fe2O3'));
await set('#bin', 'H2 -> O2'); assert.ok((await text('#berrc')).length > 0);
await set('#bin', 'H2 + O2 -> H2O + H2O2'); assert.ok((await text('#berrc')).includes('2 組'));
await mode('chem', 'conc'); assert.ok((await text('#coutc')).includes('0.1'));
await mode('chem', 'dil'); assert.ok((await text('#dout')).includes('41.6666'));
await noOverflow('chem');

// 物理
await tab('phy'); assert.ok((await text('#cout3')).includes('299792458'));
await set('#qc', 'zzzz'); assert.ok((await text('#cout3')).includes('找不到')); await set('#qc', '普朗克'); assert.ok((await text('#cout3')).includes('6.62607015e-34'));
await set('#phmode', 'form'); assert.ok((await text('#fout3')).includes('V = IR')); await set('#qf', '折射'); assert.ok((await text('#fout3')).includes('sinθ'));
await set('#phmode', 'calc'); assert.ok((await text('#phout')).includes('時間')); await set('#pk', 'pj'); assert.ok((await text('#phout')).includes('水平射程')); await set('#pk', 'pd'); assert.ok((await text('#phout')).includes('2.0064'));
await set('#ph_L', 'abc'); assert.ok((await text('#pherr')).length > 0);
await noOverflow('phy');

// 記住分頁；壞資料容錯
await page.reload({ waitUntil: 'load' });
const cur = () => page.evaluate(() => document.querySelector('.tabs button[aria-pressed=true]').dataset.t);
assert.strictEqual(await cur(), 'phy');
for (const bad of ['{"tab":"zzz"}', 'null', '[1]', '"x"', '{bad']) { await page.evaluate((v) => localStorage.setItem('mathsci_opts', v), bad); await page.reload({ waitUntil: 'load' }); assert.strictEqual(await cur(), 'nt', bad); }
await page.evaluate(() => localStorage.removeItem('mathsci_opts'));

assert.deepEqual(errors, []);
await browser.close();
console.log('math-sci-calc OK');
