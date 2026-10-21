// iPhone 17 / Safari（真正的 WebKit 引擎，Playwright）版面稽核：多種視窗狀態 + 捲動 + iOS 專屬陷阱
//   node tests/e2e/ios_audit.mjs [--all] [頁面路徑片段…]   預設只稽核「檔案內容或共用檔有變動」的頁面（快取在 .audit-cache.json）
// 視窗狀態：Safari 工具列展開（402×681）、收合（402×874）、鍵盤叫出（402×420）、橫向（756×352）、iPhone SE（375×667）、最小（320×568）
// 只印有問題的頁面與一行總結（通過時幾乎不輸出）
import fs from 'fs'; import crypto from 'crypto'; import path from 'path';
import { webkit, devices } from 'playwright-core';
import { repo } from './lib.mjs';
const root = repo.replace(/\\/g, '/') + '/';
const args = process.argv.slice(2), ALL = args.includes('--all'), only = args.filter(a => !a.startsWith('--'));
const VERSION = 'v3';
const shared = ['shared/css/theme.css', 'shared/css/maple.css', 'shared/js/chrome.js', 'shared/js/util.js'].map(f => fs.readFileSync(root + f, 'utf8')).join('');
const pages = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'].flatMap(d => fs.readdirSync(root + d).filter(f => f.endsWith('.html')).map(f => `${d}/${f}`)).concat(['index.html']).filter(p => !only.length || only.some(o => p.includes(o)));
const cacheFile = path.join(import.meta.dirname, '.audit-cache.json'); const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const hashOf = (p) => crypto.createHash('sha1').update(VERSION + shared + fs.readFileSync(root + p, 'utf8')).digest('hex');
const todo = pages.filter(p => ALL || only.length || !cache[p] || cache[p].hash !== hashOf(p));
const base = devices['iPhone 17'];
const STATES = [['Safari 工具列展開 402×681', 402, 681], ['工具列收合 402×874', 402, 874], ['鍵盤叫出 402×420', 402, 420], ['橫向 756×352', 756, 352], ['iPhone SE 375×667', 375, 667], ['最小 320×568', 320, 568]];

const MEASURE = () => {
    const vw = innerWidth, vh = innerHeight, se = document.scrollingElement, docH = se.scrollHeight;
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden],dialog:not([open]),.st-bar,.st-panel,.st-toast,template') && !(e.closest('details:not([open])') && !e.closest('summary') && e.tagName !== 'SUMMARY'); };
    const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '')) + (e.textContent && e.textContent.trim() ? `「${e.textContent.trim().slice(0, 10)}」` : '');
    const inHScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && p.getBoundingClientRect().right <= vw + 2) return true; } return false; };
    const inVScroller = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 2) return true; } return false; };
    const all = [...document.querySelectorAll('body *')].filter(vis);
    const off = all.filter(e => getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > vw + 2 && !inHScroller(e)).slice(0, 3).map(e => `${name(e)} 右緣 ${Math.round(e.getBoundingClientRect().right)}`);
    let maxBottom = 0, culprit = '';
    for (const e of all) { if (getComputedStyle(e).position === 'fixed' || inVScroller(e)) continue; const r = e.getBoundingClientRect(), bt = r.bottom + se.scrollTop; if (bt > maxBottom && r.height < vh * 3) { maxBottom = bt; culprit = name(e); } }
    const ov = [document.documentElement, document.body].map(e => getComputedStyle(e).overflowY).find(v => /hidden|clip/.test(v)) || '';
    // iOS 聚焦輸入框時字級 < 16px 會自動放大整個頁面
    const smallInputs = all.filter(e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !/(checkbox|radio|range|color|file|hidden|button|submit)/.test((e.getAttribute('type') || e.type || '')) && parseFloat(getComputedStyle(e).fontSize) < 16).slice(0, 3).map(e => `${name(e)} ${getComputedStyle(e).fontSize}`);
    // 會吃掉捲動手勢的大區塊（touch-action:none 且覆蓋視窗寬度 > 85% 且高度 > 35% 視窗）
    const blockers = all.filter(e => { const t = getComputedStyle(e).touchAction; if (!/^none$/.test(t)) return false; const r = e.getBoundingClientRect(); return r.width > vw * 0.85 && r.height > vh * 0.35; }).slice(0, 2).map(e => `${name(e)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
    // 固定定位的大區塊（可能遮住內容或造成鎖定）
    const fixedBig = all.filter(e => getComputedStyle(e).position === 'fixed' && !e.closest('.st-bar,.st-panel,.st-toast,dialog') && e.getBoundingClientRect().width > vw * 0.9 && e.getBoundingClientRect().height > vh * 0.5 && getComputedStyle(e).pointerEvents !== 'none').slice(0, 2).map(e => name(e));
    return { vw, vh, docH, sw: se.scrollWidth, off, clipped: maxBottom > docH + 8 ? `${culprit} 底部 ${Math.round(maxBottom)} > 可捲高度 ${docH}` : '', ov, smallInputs, blockers, fixedBig };
};

const br = await webkit.launch();
const results = {}; let next = 0;
async function worker() {
    const ctxs = [];
    for (const [label, w, h] of STATES) ctxs.push([label, w, h, await br.newContext({ ...base, viewport: { width: w, height: h }, screen: base.screen })]);
    const pgs = await Promise.all(ctxs.map(async ([label, w, h, c]) => { const p = await c.newPage(); p.on('dialog', d => d.accept().catch(() => { })); return p; }));
    while (next < todo.length) {
        const rel = todo[next++]; const issues = [];
        await Promise.all(ctxs.map(async ([label, w, h], i) => {
            const p = pgs[i];
            try {
                await p.goto('file:///' + root + rel + '#a', { waitUntil: 'load', timeout: 20000 }); await p.waitForTimeout(350);
                const m = await p.evaluate(MEASURE); const tag = `[${label}]`;
                if (m.sw > m.vw + 1) issues.push(`${tag} 橫向溢出 ${m.sw}px > ${m.vw}px`);
                if (m.off.length) issues.push(`${tag} 元素超出視窗：${m.off.join('；')}`);
                if (m.ov) issues.push(`${tag} html/body 設了 overflow:${m.ov}（頁面可能無法捲動）`);
                if (m.clipped) issues.push(`${tag} 內容被切掉、捲不到：${m.clipped}`);
                if (m.smallInputs.length && label.startsWith('Safari 工具列展開')) issues.push(`${tag} 輸入框字級 < 16px（iOS 聚焦時會自動放大頁面）：${m.smallInputs.join('；')}`);
                if (m.blockers.length && m.docH > m.vh + 120 && !/(game-2048|snake|sketchpad|nonogram|draw-guess|art-relay|minesweeper|maze)/.test(rel)) issues.push(`${tag} 大面積 touch-action:none（手指在上面無法捲動頁面）：${m.blockers.join('；')}`);
                if (m.fixedBig.length) issues.push(`${tag} 大面積固定定位元素：${m.fixedBig.join('；')}`);
                if (m.docH > m.vh + 12 && !m.ov) {      // 程式捲動只能驗證「文件確實可以捲」（行動版 WebKit 不支援滾輪與合成觸控）
                    await p.evaluate(() => scrollTo(0, 200)); const y = await p.evaluate(() => document.scrollingElement.scrollTop);
                    if (y <= 0) issues.push(`${tag} 頁面無法往下捲動（內容高 ${m.docH} > 視窗高 ${m.vh}）`);
                }
            } catch (e) { issues.push(`[${label}] 載入 / 量測失敗：${e.message.slice(0, 70)}`); }
        }));
        results[rel] = [...new Set(issues)];
    }
}
const t0 = Date.now();
await Promise.all([worker(), worker(), worker()]);
await br.close();
for (const p of todo) cache[p] = { hash: hashOf(p), issues: results[p] || [] };
fs.writeFileSync(cacheFile, JSON.stringify(cache));
let bad = 0;
for (const p of pages) { const iss = (cache[p] || {}).issues || []; if (iss.length) { bad++; console.log(p + (todo.includes(p) ? '' : '（快取）') + '\n  - ' + iss.join('\n  - ')); } }
console.log(`ios_audit：${pages.length} 頁（實際稽核 ${todo.length}，其餘快取），${bad} 頁有問題；${Math.round((Date.now() - t0) / 1000)} 秒`);
process.exit(bad ? 1 : 0);
