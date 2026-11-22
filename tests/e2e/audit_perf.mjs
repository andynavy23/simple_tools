// 全站效能 / 重量 / 程式重複稽核（手動執行，不在 --all 內）：node tests/e2e/audit_perf.mjs [--skip-load] [片段]
// A 靜態重量  B 載入量測（390×844、4× CPU、3 次中位數）  C 動畫頁幀率與隱藏時活動  D 重複函式 / CSS  E Service Worker
// 完整結果寫到系統暫存資料夾的 st-audit-perf.json；本腳本只印彙總。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, repo, pageUrl } from './lib.mjs';

const args = process.argv.slice(2);
const skipLoad = args.includes('--skip-load');
const filter = args.find(a => !a.startsWith('--'));
const DIRS = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'];
const kb = n => Math.round(n / 102.4) / 10;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const rd = f => fs.readFileSync(path.join(repo, f), 'utf8');
const walk = d => fs.readdirSync(path.join(repo, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
const pages = ['index.html', ...DIRS.flatMap(d => fs.readdirSync(path.join(repo, d)).filter(f => f.endsWith('.html')).map(f => d + '/' + f))];
const table = (title, rows, cols) => {
    console.log('\n## ' + title);
    if (!rows.length) return console.log('(無)');
    const w = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c]).length)));
    console.log(cols.map((c, i) => c.padEnd(w[i])).join('  '));
    rows.forEach(r => console.log(cols.map((c, i) => String(r[c]).padEnd(w[i])).join('  ')));
};
const out = {};

// ---------- A 靜態重量 ----------
const src = {}, A = [];
for (const p of pages) {
    const t = src[p] = rd(p), bytes = Buffer.byteLength(t);
    const styles = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
    const scripts = [...t.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const big = [];
    for (const s of scripts) for (const m of s.matchAll(/"[^"\n]{20000,}"|'[^'\n]{20000,}'|`[^`]{20000,}`/g)) big.push(m[0].length);
    for (const s of scripts) for (const l of s.split('\n')) if (l.length > 20000 && !big.length) big.push(l.length);
    const tpl = [...t.matchAll(/<template[^>]*>([\s\S]*?)<\/template>/g)].reduce((a, m) => a + m[1].length, 0);
    A.push({ page: p, kb: kb(bytes), styleKB: kb(styles.join('').length), scriptKB: kb(scripts.join('').length), helpKB: kb(tpl), bigLiterals: big.map(kb) });
}
const sharedFiles = walk('shared'), assetFiles = walk('assets'), rootFiles = ['sw.js', 'manifest.webmanifest', 'favicon.ico'];
const sz = f => fs.statSync(path.join(repo, f)).size;
const pagesTotal = pages.reduce((a, p) => a + sz(p), 0), sharedTotal = sharedFiles.reduce((a, f) => a + sz(f), 0), assetsTotal = assetFiles.reduce((a, f) => a + sz(f), 0);
out.A = { pages: A, pagesKB: kb(pagesTotal), sharedKB: kb(sharedTotal), assetsKB: kb(assetsTotal), offlineTotalKB: kb(pagesTotal + sharedTotal + assetsTotal + rootFiles.reduce((a, f) => a + sz(f), 0)), sharedFiles: sharedFiles.map(f => [f, kb(sz(f))]) };
console.log(`## A 靜態重量：${pages.length} 頁；頁面 ${out.A.pagesKB} KB + shared ${out.A.sharedKB} KB + assets ${out.A.assetsKB} KB = 首次離線約 ${out.A.offlineTotalKB} KB`);
table('A 最大 15 頁（KB）', [...A].sort((a, b) => b.kb - a.kb).slice(0, 15).map(r => ({ page: r.page, kb: r.kb, styleKB: r.styleKB, scriptKB: r.scriptKB, helpKB: r.helpKB, big: r.bigLiterals.join('/') })), ['page', 'kb', 'styleKB', 'scriptKB', 'helpKB', 'big']);
table('A 含 >20KB 單一字串的頁面', A.filter(r => r.bigLiterals.length).map(r => ({ page: r.page, big: r.bigLiterals.join('/') })), ['page', 'big']);
const med = a => median(a).toFixed(1);
console.log(`中位數：頁面 ${med(A.map(r => r.kb))} KB、style ${med(A.map(r => r.styleKB))} KB、script ${med(A.map(r => r.scriptKB))} KB、說明 ${med(A.map(r => r.helpKB))} KB`);

// ---------- D 程式重複 ----------
{
    const utilKeys = new Set((rd('shared/js/util.js').match(/const Util = \{([^}]*)\}/) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean));
    const norm = s => s.replace(/\s+/g, ' ').trim();
    const matchEnd = (s, i) => {                                   // 粗略找函式結尾（略過字串）；失敗時給 600 字
        let d = 0, q = '', started = false;
        for (let j = i; j < Math.min(s.length, i + 4000); j++) {
            const c = s[j];
            if (q) { if (c === '\\') j++; else if (c === q) q = ''; continue; }
            if (c === '"' || c === "'" || c === '`') q = c;
            else if (c === '{') { d++; started = true; }
            else if (c === '}') { d--; if (started && d === 0) return j + 1; }
            else if (!started && c === '\n' && /=>\s*[^{\s]/.test(s.slice(i, j))) return j;   // 單行箭頭函式
        }
        return i + 600;
    };
    const fns = new Map();                                         // key -> {name, pages:Set, size}
    const names = new Map();                                       // name -> {pages:Set, keys:Set}
    for (const p of pages) {
        const scripts = [...src[p].matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type="application)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
        for (const s of scripts) for (const m of s.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g)) {
            const name = m[1] || m[2], text = norm(s.slice(m.index, matchEnd(s, m.index)));
            const key = text.slice(0, 200);
            const g = fns.get(key) || fns.set(key, { name, pages: new Set(), size: 0 }).get(key);
            g.pages.add(p); g.size = Math.max(g.size, text.length);
            const n = names.get(name) || names.set(name, { pages: new Set(), keys: new Set() }).get(name);
            n.pages.add(p); n.keys.add(key);
        }
    }
    const groups = [...fns.values()].filter(g => g.pages.size >= 5 && g.size > 40).map(g => ({ name: g.name, pages: g.pages.size, bytes: g.size, saveKB: kb(g.size * g.pages.size), inUtil: utilKeys.has(g.name) })).sort((a, b) => b.saveKB - a.saveKB);
    const nameVariants = [...names.entries()].filter(([, v]) => v.pages.size >= 5).map(([name, v]) => ({ name, pages: v.pages.size, variants: v.keys.size, inUtil: utilKeys.has(name) })).sort((a, b) => b.pages - a.pages);
    // CSS
    const rules = new Map(), sels = new Map();
    for (const p of pages) {
        const css = [...src[p].matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
        const seenP = new Set();
        for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            const sel = norm(m[1]), body = norm(m[2]);
            if (!sel || sel.startsWith('@') || !body) continue;
            const key = sel + '{' + body + '}';
            if (!seenP.has(key)) { seenP.add(key); const g = rules.get(key) || rules.set(key, { pages: 0, size: key.length }).get(key); g.pages++; }
            const sg = sels.get(sel) || sels.set(sel, { pages: new Set(), bodies: new Set() }).get(sel);
            sg.pages.add(p); sg.bodies.add(body);
        }
    }
    const cssGroups = [...rules.entries()].filter(([, g]) => g.pages >= 10).map(([k, g]) => ({ rule: k.slice(0, 90), pages: g.pages, bytes: g.size, saveKB: kb(g.size * g.pages) })).sort((a, b) => b.saveKB - a.saveKB);
    const selVariants = [...sels.entries()].filter(([, g]) => g.pages.size >= 10).map(([sel, g]) => ({ sel: sel.slice(0, 50), pages: g.pages.size, variants: g.bodies.size })).sort((a, b) => b.pages - a.pages);
    out.D = { fnGroups: groups, nameVariants, cssGroups, selVariants, cssTotalSaveKB: kb(cssGroups.reduce((a, g) => a + g.bytes * g.pages, 0)), fnTotalSaveKB: kb(groups.reduce((a, g) => a + g.bytes * g.pages, 0)) };
    table(`D 近似相同函式群（≥5 頁、前 200 字相同）前 20；全部 ${groups.length} 群、重複總量約 ${out.D.fnTotalSaveKB} KB`, groups.slice(0, 20), ['name', 'pages', 'bytes', 'saveKB', 'inUtil']);
    table('D 同名函式（≥5 頁）前 20：variants=不同寫法數', nameVariants.slice(0, 20), ['name', 'pages', 'variants', 'inUtil']);
    table(`D 完全相同的 CSS 規則群（≥10 頁）前 10；全部 ${cssGroups.length} 群、重複總量約 ${out.D.cssTotalSaveKB} KB`, cssGroups.slice(0, 10), ['rule', 'pages', 'bytes', 'saveKB']);
    table('D 同選擇器（≥10 頁）寫法數前 10', selVariants.slice(0, 10), ['sel', 'pages', 'variants']);
}

// ---------- E Service Worker ----------
{
    const sw = rd('sw.js'), home = src['index.html'], man = JSON.parse(rd('manifest.webmanifest'));
    const core = [...(sw.match(/const CORE = \[([^\]]*)\]/) || [, ''])[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    const ver = (sw.match(/CACHE_VERSION = '([^']+)'/) || [])[1], homeVer = (home.match(/SW_CACHE = '([^']+)'/) || [])[1];
    const icons = [...man.icons.map(i => i.src), ...[...home.matchAll(/<link[^>]+rel="[^"]*icon[^"]*"[^>]*href="([^"]+)"/g)].map(m => m[1])];
    const cards = new Set([...home.matchAll(/<a class="card"[^>]*href="([^"#?]+)/g)].map(m => m[1]));
    const missingIcons = [...new Set(icons)].filter(i => !core.includes(i));
    const unlinked = pages.filter(p => p !== 'index.html' && !cards.has(p)), deadCards = [...cards].filter(c => !pages.includes(c));
    const coreMissing = core.filter(c => c !== './' && !fs.existsSync(path.join(repo, c)));
    const coreKB = kb(core.filter(c => c !== './').reduce((a, c) => a + (fs.existsSync(path.join(repo, c)) ? sz(c) : 0), 0));
    out.E = { cacheVersionSynced: 'st-' + ver === homeVer, ver, homeVer, coreKB, missingIcons, unlinked, deadCards, coreMissing, noCacheRevalidate: /cache:\s*'no-cache'/.test(sw), swr: /swr/.test(sw) };
    console.log(`\n## E Service Worker：版本 sw=${'st-' + ver} index=${homeVer} ${out.E.cacheVersionSynced ? '同步' : '【不同步】'}；CORE ${core.length} 項 ${coreKB} KB（預快取）；首次離線全載 ${out.A.offlineTotalKB} KB（${(out.A.offlineTotalKB / coreKB).toFixed(0)}× CORE）`);
    console.log(`  icons 不在 CORE：${missingIcons.join(', ') || '無'}；CORE 檔案不存在：${coreMissing.join(', ') || '無'}`);
    console.log(`  每次請求 fetch(no-cache) 條件式重驗：${out.E.noCacheRevalidate}；首頁卡片未連到的頁面：${unlinked.length}（${unlinked.slice(0, 5).join(', ')}）；卡片指向不存在頁：${deadCards.join(', ') || '無'}`);
}

// ---------- B / C 瀏覽器量測 ----------
const HOOK = () => {
    window.__m = { paint: {}, lcp: 0, lt: [], cls: 0 };
    const ob = (type, fn) => { try { new PerformanceObserver(l => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch { } };
    ob('paint', e => { window.__m.paint[e.name] = e.startTime; });
    ob('largest-contentful-paint', e => { window.__m.lcp = e.startTime; });
    ob('longtask', e => window.__m.lt.push(e.duration));
    ob('layout-shift', e => { if (!e.hadRecentInput) window.__m.cls += e.value; });
};
const HOOK_C = () => {
    const c = window.__c = { hidden: false, raf: 0, tick: 0, to: 0, rafH: 0, tickH: 0, toH: 0, frames: [] };
    const raf = window.requestAnimationFrame.bind(window), si = window.setInterval.bind(window), st = window.setTimeout.bind(window);
    window.requestAnimationFrame = f => { c.hidden ? c.rafH++ : c.raf++; return raf(t => { if (c.hidden) c.rafH++; return f(t); }); };
    window.setInterval = (f, ms, ...a) => si((...x) => { c.hidden ? c.tickH++ : c.tick++; return typeof f === 'function' ? f(...x) : 0; }, ms, ...a);
    window.setTimeout = (f, ms, ...a) => { c.hidden ? c.toH++ : c.to++; return st(f, ms, ...a); };
};

async function withPage(browser, fn) {
    const page = await browser.newPage();
    page.on('dialog', d => d.dismiss().catch(() => { }));
    page.on('pageerror', () => { });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    try { return await fn(page); } finally { await page.close().catch(() => { }); }
}
async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }));
}

if (!skipLoad) {
    const browser = await launchEdge();
    try {
        const list = filter ? pages.filter(p => p.includes(filter)) : pages;
        const B = [];
        await pool(list, 3, async (p) => {
            const runs = [];
            for (let k = 0; k < 3; k++) {
                try {
                    runs.push(await withPage(browser, async (page) => {
                        await page.evaluateOnNewDocument(HOOK);
                        await page.goto(pageUrl(p) + '#a', { waitUntil: 'load', timeout: 60000 });
                        await new Promise(r => setTimeout(r, 1500));
                        return page.evaluate(() => {
                            const n = performance.getEntriesByType('navigation')[0], m = window.__m, lt = m.lt;
                            return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: m.paint['first-contentful-paint'] || 0, lcp: m.lcp, ltTotal: lt.reduce((a, b) => a + b, 0), ltMax: Math.max(0, ...lt), heapMB: (performance.memory?.usedJSHeapSize || 0) / 1048576, dom: document.getElementsByTagName('*').length, cls: m.cls };
                        });
                    }));
                } catch (e) { runs.push(null); }
            }
            const ok = runs.filter(Boolean);
            if (!ok.length) return B.push({ page: p, error: true });
            const r = { page: p };
            for (const key of Object.keys(ok[0])) r[key] = Math.round(median(ok.map(x => x[key])) * 1000) / 1000;
            B.push(r);
        });
        out.B = B;
        const R = x => Math.round(x);
        const row = r => ({ page: r.page, dcl: R(r.dcl), load: R(r.load), fcp: R(r.fcp), lcp: R(r.lcp), ltTotal: R(r.ltTotal), ltMax: R(r.ltMax), heapMB: r.heapMB.toFixed(1), dom: r.dom, cls: r.cls.toFixed(3) });
        const good = B.filter(r => !r.error);
        table('B 載入最慢 15 頁（4× CPU，中位數 ms；以 lcp 與 load 較大者排序）', [...good].sort((a, b) => Math.max(b.lcp, b.load) - Math.max(a.lcp, a.load)).slice(0, 15).map(row), ['page', 'dcl', 'load', 'fcp', 'lcp', 'ltTotal', 'ltMax', 'heapMB', 'dom', 'cls']);
        table('B Long Task 總時間最高 10 頁', [...good].sort((a, b) => b.ltTotal - a.ltTotal).slice(0, 10).map(row), ['page', 'dcl', 'load', 'fcp', 'lcp', 'ltTotal', 'ltMax', 'heapMB', 'dom', 'cls']);
        table('B DOM 節點最多 / 記憶體最高 各 5 頁', [...good].sort((a, b) => b.dom - a.dom).slice(0, 5).concat([...good].sort((a, b) => b.heapMB - a.heapMB).slice(0, 5)).map(row), ['page', 'load', 'lcp', 'heapMB', 'dom']);
        table('B CLS > 0.1', good.filter(r => r.cls > 0.1).map(row), ['page', 'cls', 'lcp']);
        console.log(`B 全站中位數：fcp ${R(median(good.map(r => r.fcp)))}ms、lcp ${R(median(good.map(r => r.lcp)))}ms、load ${R(median(good.map(r => r.load)))}ms；失敗頁 ${B.length - good.length}`);

        // 首頁搜尋重新渲染
        if (!filter || 'index.html'.includes(filter)) {
            const res = await withPage(browser, async (page) => {
                await page.goto(pageUrl('index.html') + '#a', { waitUntil: 'load' });
                await new Promise(r => setTimeout(r, 800));
                return page.evaluate(async () => {
                    const q = document.getElementById('q'), times = [];
                    for (const s of ['計', '計時', '計時器', '記', '記帳']) {
                        const t0 = performance.now(); q.value = s; q.oninput();
                        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                        times.push(performance.now() - t0);
                    }
                    q.value = ''; return times;
                });
            });
            out.homeSearchMs = res.map(Math.round);
            console.log(`\n## B 首頁搜尋（4× CPU，含兩幀繪製）各次 ${out.homeSearchMs.join(' / ')} ms，平均 ${Math.round(res.reduce((a, b) => a + b, 0) / res.length)} ms`);
        }

        // C 動畫頁
        const reps = ['arcade', 'tetris', 'snake', 'game-2048', 'minesweeper', 'art-studio', 'mind-map', 'algo-lab', 'mahjong', 'go9'];
        const C = [];
        await pool(reps.filter(n => !filter || n.includes(filter)), 2, async (n) => {
            const p = pages.find(x => x.endsWith('/' + n + '.html'));
            if (!p) return C.push({ page: n, error: 'not found' });
            try {
                const r = await withPage(browser, async (page) => {
                    await page.evaluateOnNewDocument(HOOK_C);
                    await page.goto(pageUrl(p) + '#a', { waitUntil: 'load', timeout: 60000 });
                    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /開始|start|play|新遊戲|新局/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
                    const fr = await page.evaluate(() => new Promise(res => {
                        const f = []; let last = performance.now(), end = last + 3000;
                        const loop = t => { f.push(t - last); last = t; t < end ? requestAnimationFrame(loop) : res(f); };
                        window.__c.hidden = true; window.__c.hidden = false;      // 量測自己的 rAF 不算進去：先照常註冊
                        requestAnimationFrame(loop);
                    }));
                    const d = fr.slice(1), avg = d.reduce((a, b) => a + b, 0) / (d.length || 1);
                    // 模擬隱藏
                    await page.evaluate(() => {
                        const c = window.__c; c.hidden = true;
                        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
                        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
                        document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));
                    });
                    await new Promise(r => setTimeout(r, 2000));
                    const h = await page.evaluate(() => { const c = window.__c; return { raf: c.rafH, interval: c.tickH, timeout: c.toH }; });
                    return { page: p, frames: d.length, avgMs: Math.round(avg * 10) / 10, over20: Math.round(d.filter(x => x > 20).length / (d.length || 1) * 100), hiddenRaf: h.raf, hiddenInterval: h.interval, hiddenTimeout: h.timeout };
                });
                C.push(r);
            } catch (e) { C.push({ page: n, error: String(e.message).slice(0, 60) }); }
        });
        out.C = C;
        table('C 動畫頁（4× CPU，載入 + 嘗試按開始後 3 秒；hidden* = 模擬隱藏後 2 秒內仍執行 / 註冊的次數）', C.map(r => r.error ? { page: r.page, frames: r.error, avgMs: '', over20: '', hiddenRaf: '', hiddenInterval: '', hiddenTimeout: '' } : r), ['page', 'frames', 'avgMs', 'over20', 'hiddenRaf', 'hiddenInterval', 'hiddenTimeout']);
        console.log('（over20 = 幀間隔 > 20ms 的百分比；frames 很少代表該頁靜止、不是不順）');
    } finally { await browser.close(); }
}

const file = path.join(os.tmpdir(), 'st-audit-perf.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('\n完整結果：' + file);
