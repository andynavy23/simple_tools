// sql-query「DDL 工具」畫面：解析、關聯圖（canvas 縮放 / PNG）、轉型別、解析不了的列出；原本的產生器與 localStorage 不受影響；手機不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/db-query.html');
const set = (sel, v) => page.evaluate((s, x) => { document.querySelector(s).value = x; }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const hidden = (sel) => page.evaluate((s) => document.querySelector(s).hidden, sel);
const before = await page.evaluate(() => localStorage.getItem('sqlq_opts'));

await click('#modeTabs [data-m=ddl]');
assert.ok(await hidden('#genPane') && await hidden('#fmtPane') && !(await hidden('#ddlPane')));
await click('#dGo'); assert.ok(/請先貼上/.test(await text('#dStatus')));
await set('#dIn', 'select 1'); await click('#dGo'); assert.ok(/沒有解析到任何 CREATE TABLE/.test(await text('#dStatus')) && !(await hidden('#dSkip')));
await set('#dIn', "CREATE TABLE a (x text default 'oops"); await click('#dGo'); assert.ok(/✗ 無法切分/.test(await text('#dStatus')));

// 範例 → 關聯圖
await click('#dEg');
const st = await text('#dStatus');
assert.ok(/✓ 解析到 3 張資料表、14 個欄位、3 條外鍵；方言：PostgreSQL（自動偵測）/.test(st), st);
assert.ok(!(await hidden('#dDiag')) && await hidden('#dCode'));
const px = () => page.evaluate(() => { const c = document.querySelector('#dCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return { w: c.width, h: c.height, cssW: c.getBoundingClientRect().width, colors: seen.size }; });
const cv = await px();
assert.ok(cv.w > 100 && cv.h > 100 && cv.colors >= 3, JSON.stringify(cv));            // 有畫東西（不是一片空白）
assert.ok(cv.w >= cv.cssW * 1.9, `沒有依 devicePixelRatio 放大：${cv.w} vs ${cv.cssW}`);   // dpr = 2
await page.select('#dZoom', '2'); const big = await px(); assert.ok(big.cssW > cv.cssW * 2, JSON.stringify([cv, big]));
assert.ok(await page.evaluate(() => { const s = document.querySelector('#dScroll'); return s.scrollWidth > s.clientWidth; }), '放大後在圖框內捲動');
const w2 = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth })); assert.ok(w2.s <= w2.c, '放大不應讓頁面橫向捲動');
await page.select('#dZoom', 'fit');
// 匯出 PNG：攔截下載，檢查是有效的 PNG
await page.evaluate(() => { window.__dl = null; const o = URL.createObjectURL; URL.createObjectURL = (b) => { window.__dl = b; return o.call(URL, b); }; });
await click('#dPng');
await page.waitForFunction(() => window.__dl, { timeout: 5000 });
const png = await page.evaluate(async () => { const b = window.__dl, u = new Uint8Array(await b.arrayBuffer()); return { type: b.type, size: b.size, sig: [...u.slice(0, 4)] }; });
assert.deepEqual([png.type, png.sig], ['image/png', [137, 80, 78, 71]]); assert.ok(png.size > 1000);
// 換明暗後會重畫（像素改變）
const snap = () => page.evaluate(() => document.querySelector('#dCv').toDataURL().slice(-80));
const s1 = await snap();
await page.evaluate(() => document.documentElement.setAttribute('data-ui-mode', document.documentElement.getAttribute('data-ui-mode') === 'dark' ? 'light' : 'dark'));
await page.waitForFunction((s) => document.querySelector('#dCv').toDataURL().slice(-80) !== s, { timeout: 3000 }, s1);

// 轉型別
await click('#dTabs [data-v=code]');
assert.ok(!(await hidden('#dCode')) && await hidden('#dDiag'));
let code = await text('#dCodeOut');
assert.ok(code.startsWith('export interface Users {') && code.includes('createdAt: Date;') && code.includes('interface Comments'), code);
await page.select('#dLang', 'go'); code = await text('#dCodeOut');
assert.ok(code.startsWith('package model') && /Tags\s+\*?\[\]string/.test(code) && code.includes('`json:"user_id" db:"user_id"`') && code.includes('type Posts struct'), code);
await page.select('#dLang', 'python'); await page.select('#dNull', 'optional'); code = await text('#dCodeOut');
assert.ok(code.includes('@dataclass\nclass Users:') && code.includes('nickname: Optional[str] = None'), code);
await page.select('#dLang', 'java'); await page.select('#dNull', 'type'); await page.select('#dName', 'snake'); code = await text('#dCodeOut');
assert.ok(code.includes('public record Users(') && code.includes('String nickname') && code.includes('OffsetDateTime created_at'), code);
// 換成 MySQL：tinyint(1) 是布林；改選方言會用新方言重新對應
await set('#dIn', 'CREATE TABLE `t` (`a` tinyint(1) NOT NULL, `id` int unsigned NOT NULL AUTO_INCREMENT, PRIMARY KEY (`id`)) ENGINE=InnoDB;');
await page.select('#dLang', 'ts'); await page.select('#dName', ''); await click('#dGo');
assert.ok(/方言：MySQL（自動偵測）/.test(await text('#dStatus')) && (await text('#dCodeOut')).includes('a: boolean;'), await text('#dCodeOut'));
assert.ok(!(await hidden('#dSkip')) && /資料表選項/.test(await text('#dSkipList')));
await page.select('#dDia', 'pg'); assert.ok(/方言：PostgreSQL/.test(await text('#dStatus')) && !/自動偵測/.test(await text('#dStatus')) && (await text('#dCodeOut')).includes('a: number;'));

// 外鍵參照的表不存在 / 解析不了的語句都列出
await set('#dIn', 'CREATE TABLE a (id int primary key, b int REFERENCES nowhere(id)); DROP TABLE z; ALTER TABLE a OWNER TO me;'); await page.select('#dDia', 'auto'); await click('#dGo');
const sk = await text('#dSkipList'); assert.ok(/nowhere/.test(sk) && /DROP TABLE z/.test(sk) && /OWNER/.test(sk), sk);

// 其他分頁與儲存
await click('#modeTabs [data-m=gen]'); assert.ok(!(await hidden('#genPane')) && await hidden('#ddlPane'));
assert.equal(await page.evaluate(() => localStorage.getItem('sqlq_opts')), before, 'DDL 工具不該寫 localStorage');
const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('sql-query-ddl OK');
