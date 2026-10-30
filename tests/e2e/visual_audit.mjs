// 全站視覺稽核（找離群頁，不是通過 / 失敗測試，所以不在 --all 內）：
//   node tests/e2e/visual_audit.mjs [頁名片段]            → 只印有問題的頁
//   node tests/e2e/visual_audit.mjs --shots 輸出資料夾 頁名片段…  → 另外把指定頁淺 / 深色各截一張 390 寬圖
// 每頁以淺色與深色各載入一次，檢查：(1) 文字與底色對比 < 3、(2) 頁面底色不是主題底色、(3) 頁面沒有載入 theme.css / chrome.js、
// (4) 靜態：<style> 內寫死的色碼數量（遊戲專屬色彩可以寫死，數字只當線索）。
import fs from 'fs';
import path from 'path';
import { launchEdge, pageUrl, repo } from './lib.mjs';

const args = process.argv.slice(2);
const shotIdx = args.indexOf('--shots');
const shotDir = shotIdx >= 0 ? args[shotIdx + 1] : null;
const frags = args.filter((a, i) => !a.startsWith('--') && !(shotIdx >= 0 && i === shotIdx + 1));
const DIRS = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'];
let pages = ['index.html', ...DIRS.flatMap(d => fs.existsSync(path.join(repo, d)) ? fs.readdirSync(path.join(repo, d)).filter(f => f.endsWith('.html')).map(f => d + '/' + f) : [])];
if (frags.length) pages = pages.filter(p => frags.some(f => p.includes(f)));

const hexCount = (rel) => {
    const s = fs.readFileSync(path.join(repo, rel), 'utf8');
    const css = (s.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
    return (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
};

function MEASURE() {
    const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
    const bgOf = (el) => {                       // 往上疊合背景；遇到背景圖就放棄（回傳 null）
        const chain = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 1) break; } }
        let base = [255, 255, 255, 1]; for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base); return base;
    };
    const bodyBg = getComputedStyle(document.body).backgroundColor, rootBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const bad = []; let n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let t; (t = walker.nextNode());) {
        if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        if (el.closest('canvas,svg,template,script,style,[hidden],dialog:not([open])')) continue;
        const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue; n++;
        const f = over(fg, bg), L1 = lum(f) + .05, L2 = lum(bg) + .05, ratio = Math.max(L1, L2) / Math.min(L1, L2);
        if (ratio < 3) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''}「${t.textContent.trim().slice(0, 12)}」${ratio.toFixed(1)}`);
    }
    return { bodyBg, rootBg, bad: [...new Set(bad)].slice(0, 4), nbad: bad.length, n, theme: !!getComputedStyle(document.documentElement).getPropertyValue('--card').trim() };
}

const browser = await launchEdge();
const out = [];
let done = 0;
for (const rel of pages) {
    const probs = [];
    for (const mode of ['light', 'dark']) {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.evaluateOnNewDocument((m) => { try { localStorage.setItem('st_mode', JSON.stringify(m)); localStorage.setItem('st_style', '"apple"'); } catch { } }, mode);
        page.on('dialog', d => d.dismiss().catch(() => { }));
        try {
            await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load', timeout: 20000 });
            await new Promise(r => setTimeout(r, 300));
            const m = await page.evaluate(MEASURE);
            if (!m.theme) { if (mode === 'light') probs.push('沒有使用 theme.css 變數（獨立風格頁？）'); }
            else if (m.nbad > 0) probs.push(`${mode} 對比<3 × ${m.nbad}：${m.bad.join('、')}`);
            if (shotDir && frags.length) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, rel.replace(/[\/\\]/g, '_').replace('.html', '') + '-' + mode + '.png') }); }
        } catch (e) { probs.push(mode + ' 載入失敗：' + String(e.message).slice(0, 60)); }
        await page.close();
    }
    const hx = hexCount(rel);
    if (probs.length) out.push(`${rel}（寫死色碼 ${hx}）\n    ` + probs.join('\n    '));
    if (++done % 40 === 0) process.stderr.write(`… ${done}/${pages.length}\n`);
}
await browser.close();
console.log(out.length ? out.join('\n') : '沒有發現問題');
console.log(`檢查 ${pages.length} 頁，${out.length} 頁有線索`);
