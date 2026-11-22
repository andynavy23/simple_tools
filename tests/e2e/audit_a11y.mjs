// 全站無障礙 + 觸控 + 對比稽核（手動執行，找線索，不在 --all 內）：node tests/e2e/audit_a11y.mjs [頁名片段…]
// 390×844 手機視窗，每頁載入 4 次：淺色（名稱 / id / 標題 / 觸控 / onclick / 對比）、深色（對比）、字級特大（溢出 / 固定元素）、高對比（對比 7:1 + 溢出）。
// 首頁與 12 個代表頁另做 Tab 焦點檢查。完整結果寫到系統暫存資料夾的 st-a11y-audit.json。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, pageUrl, repo } from './lib.mjs';

const frags = process.argv.slice(2);
const DIRS = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'];
let pages = ['index.html', ...DIRS.flatMap(d => fs.readdirSync(path.join(repo, d)).filter(f => f.endsWith('.html')).map(f => d + '/' + f))];
if (frags.length) pages = pages.filter(p => frags.some(f => p.includes(f)));
const TAB_PAGES = new Set(['index.html', 'utils/calculator.html', 'utils/todo.html', 'fun/todo.html', 'utils/json-formatter.html', 'utils/unit-converter.html', 'mini-games/sudoku.html', 'mini-games/chess.html', 'mini-games/minesweeper.html', 'fun/pomodoro.html', 'utils/expense-tracker.html', 'utils/password-gen.html', 'reading/rsvp-reader.html', 'game-assist/party.html']);

// 在頁面內執行：cfg = { basic, contrast:[n,l], overflow }
function AUDIT(cfg) {
    const out = {};
    const add = (cat, el, note) => { const o = out[cat] || (out[cat] = { n: 0, ex: [] }); o.n++; if (o.ex.length < 3) o.ex.push(typeof el === 'string' ? el : sel(el) + (note ? ' ' + note : '')); };
    const sel = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = [...el.classList].slice(0, 2); if (c.length) s += '.' + c.join('.'); const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 14); return t ? s + '「' + t + '」' : s; };
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inTpl = (el) => el.closest('template');
    const txt = (el) => (el.innerText || el.textContent || '').trim();
    const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
    const bgOf = (el) => {
        const chain = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 1) break; } }
        let base = [255, 255, 255, 1]; for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base); return base;
    };
    if (cfg.basic) {
        const name = (el) => {
            if (el.getAttribute('aria-label')?.trim() || el.getAttribute('title')?.trim()) return true;
            const lb = el.getAttribute('aria-labelledby'); if (lb && lb.split(/\s+/).some(i => document.getElementById(i)?.textContent.trim())) return true;
            if (el.labels && [...el.labels].some(l => l.textContent.trim())) return true;
            const tag = el.tagName, type = (el.type || '').toLowerCase();
            if (tag === 'INPUT' && ['button', 'submit', 'reset'].includes(type)) return !!el.value;
            if (tag === 'INPUT' && type === 'image') return !!el.alt;
            if (tag === 'BUTTON' || tag === 'A') return !!txt(el) || [...el.querySelectorAll('img[alt],svg title,[aria-label]')].some(x => (x.getAttribute('alt') || x.getAttribute('aria-label') || x.textContent || '').trim());
            return false;
        };
        for (const el of document.querySelectorAll('input,select,textarea,button,a[href]')) {
            if (inTpl(el) || el.type === 'hidden' || !vis(el)) continue;
            if (!name(el)) add('noName', el);
        }
        const ids = {}; for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
        for (const k in ids) if (ids[k] > 1) add('dupId', '#' + k + ' ×' + ids[k]);
        for (const el of document.querySelectorAll('img:not([alt])')) if (vis(el)) add('imgNoAlt', el);
        if (!document.documentElement.lang) add('noLang', 'html');
        for (const el of document.querySelectorAll('[tabindex]')) if (+el.getAttribute('tabindex') > 0) add('tabindexPos', el);
        const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => !inTpl(h) && vis(h));
        if (!hs.some(h => h.tagName === 'H1')) add('noH1', 'body');
        let prev = 0; for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) add('headingSkip', h, 'h' + prev + '→h' + l); prev = l; }
        // 觸控尺寸
        const NATIVE = 'button,a[href],input,select,textarea,summary,label';
        for (const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[onclick],summary')) {
            if (inTpl(el) || !vis(el) || el.disabled) continue;
            const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
            if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p,li,td,dd,span,div') && [...el.parentNode.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
            let w = r.width, h = r.height;
            if (['checkbox', 'radio'].includes(el.type) && el.labels?.length) for (const l of el.labels) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
            if (el.type === 'file' || el.type === 'range') continue;
            if (w < 44 || h < 44) add('touch<44', el, Math.round(w) + '×' + Math.round(h));
            if (w < 24 || h < 24) add('touch<24', el, Math.round(w) + '×' + Math.round(h));
        }
        // 只有滑鼠能用
        for (const el of document.querySelectorAll('[onclick]')) {
            if (inTpl(el) || !vis(el) || el.matches(NATIVE) || el.hasAttribute('role') || el.hasAttribute('tabindex')) continue;
            if (el.closest('button,a[href],label,[role=button],[tabindex]')) continue;
            if (el.hasAttribute('onkeydown') || el.hasAttribute('onkeyup') || el.hasAttribute('onkeypress')) continue;
            add('mouseOnly', el);
        }
    }
    if (cfg.contrast) {
        const [tn, tl] = cfg.contrast; const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let t; (t = walker.nextNode());) {
            if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
            if (el.closest('canvas,svg,template,script,style,[hidden],dialog:not([open]),:disabled,[aria-hidden=true]')) continue;
            const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < .05) continue;
            const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
            const fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
            const f = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
            const a = lum(f), b = lum(bg), cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
            const fs = parseFloat(cs.fontSize), large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
            if (cr < (large ? tl : tn)) add('contrast', el, cr.toFixed(2));
        }
    }
    if (cfg.overflow) {
        const d = document.documentElement; const ov = Math.max(d.scrollWidth, document.body.scrollWidth) - innerWidth;
        if (ov > 1) add('overflow', 'scrollWidth+' + ov);
        for (const el of document.body.querySelectorAll('*')) {
            if (getComputedStyle(el).position !== 'fixed' || !vis(el) || inTpl(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) add('fixedOut', el, Math.round(r.left) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom));
        }
    }
    return out;
}

const browser = await launchEdge();
const results = {};          // page -> { cat: {n, ex} }
const tabs = {};             // page -> { noFocusRing:[], trap:[], steps }
const errs = [];

async function load(page, rel, st) {
    await page.evaluateOnNewDocument((st) => { try { for (const k in st) localStorage.setItem(k, JSON.stringify(st[k])); } catch { } }, st);
    await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 400));
}
async function run(rel, st, cfg, suffix) {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        page.on('dialog', d => d.dismiss().catch(() => { }));
        await load(page, rel, st);
        const o = await page.evaluate(AUDIT, cfg);
        const R = results[rel] || (results[rel] = {});
        for (const k in o) R[k + suffix] = o[k];
    } catch (e) { errs.push(rel + ' ' + suffix + ' ' + String(e.message).slice(0, 80)); }
    finally { await page.close().catch(() => { }); }
}
async function tabTest(rel) {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        page.on('dialog', d => d.dismiss().catch(() => { }));
        await load(page, rel, { st_mode: 'light', st_style: 'apple' });
        const noRing = [], trap = []; let last = null, same = 0, steps = 0;
        for (let i = 0; i < 30; i++) {
            await page.keyboard.press('Tab'); steps++;
            const f = await page.evaluate(() => {
                const el = document.activeElement; if (!el || el === document.body) return null;
                const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
                const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
                const c = [...el.classList].slice(0, 2).join('.');
                return { s: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : '') + '「' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 10) + '」', ring: !!ring, off: r.width === 0 || r.height === 0 };
            });
            if (!f) continue;
            if (!f.ring) noRing.push(f.s);
            if (f.s === last) { same++; if (same === 2) trap.push(f.s); } else { same = 0; last = f.s; }
        }
        tabs[rel] = { noRing: [...new Set(noRing)], trap, steps };
    } catch (e) { errs.push(rel + ' tab ' + String(e.message).slice(0, 80)); }
    finally { await page.close().catch(() => { }); }
}

const jobs = [];
for (const p of pages) {
    jobs.push(() => run(p, { st_mode: 'light', st_style: 'apple' }, { basic: true, contrast: [4.5, 3] }, ''));
    jobs.push(() => run(p, { st_mode: 'dark', st_style: 'apple' }, { contrast: [4.5, 3] }, 'Dark'));
    jobs.push(() => run(p, { st_mode: 'light', st_style: 'apple', st_font: 'xl' }, { overflow: true }, 'Xl'));
    jobs.push(() => run(p, { st_mode: 'light', st_style: 'apple', st_contrast: 'high' }, { overflow: true, contrast: [7, 4.5] }, 'High'));
    if (TAB_PAGES.has(p)) jobs.push(() => tabTest(p));
}
let ji = 0;
await Promise.all(Array.from({ length: 5 }, async () => { while (ji < jobs.length) await jobs[ji++](); }));
await browser.close();

// 彙整
const W = { noName: 5, dupId: 3, imgNoAlt: 2, noLang: 1, tabindexPos: 2, noH1: 1, headingSkip: 1, 'touch<44': .3, 'touch<24': 2, mouseOnly: 3, contrast: .5, contrastDark: .5, overflowXl: 20, overflowHigh: 20, fixedOutXl: 10, fixedOutHigh: 5, contrastHigh: .2 };
const cats = {}, score = {};
for (const [p, R] of Object.entries(results)) for (const [k, v] of Object.entries(R)) {
    const c = cats[k] || (cats[k] = { total: 0, pages: 0, ex: [] }); c.total += v.n; c.pages++; if (c.ex.length < 3) c.ex.push(p + ' ' + v.ex[0]);
    score[p] = (score[p] || 0) + v.n * (W[k] ?? .3);
}
const file = path.join(os.tmpdir(), 'st-a11y-audit.json');
fs.writeFileSync(file, JSON.stringify({ pages: pages.length, cats, results, tabs, errs }, null, 1));
console.log(`稽核 ${pages.length} 頁（錯誤 ${errs.length}）`);
for (const [k, c] of Object.entries(cats).sort((a, b) => b[1].pages - a[1].pages)) console.log(`${k.padEnd(14)} 總數 ${String(c.total).padStart(6)}  頁數 ${String(c.pages).padStart(4)}  例：${c.ex[0]}`);
console.log('--- 最嚴重 10 頁 ---');
for (const [p, s] of Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    const top = Object.entries(results[p]).sort((a, b) => b[1].n * (W[b[0]] ?? .3) - a[1].n * (W[a[0]] ?? .3)).slice(0, 3).map(([k, v]) => `${k}×${v.n} ${v.ex[0]}`).join(' | ');
    console.log(`${p} (${s.toFixed(0)}) ${top}`);
}
const tabNo = Object.entries(tabs).filter(([, t]) => t.noRing.length), tabTrap = Object.entries(tabs).filter(([, t]) => t.trap.length);
console.log(`--- Tab（${Object.keys(tabs).length} 頁）無焦點框 ${tabNo.length} 頁，焦點陷阱 ${tabTrap.length} 頁 ---`);
for (const [p, t] of tabNo.slice(0, 5)) console.log(`${p} 無框 ${t.noRing.length}：${t.noRing.slice(0, 2).join(' ')}`);
for (const [p, t] of tabTrap) console.log(`${p} 陷阱：${t.trap.join(' ')}`);
if (errs.length) console.log('錯誤：' + errs.slice(0, 5).join('; '));
console.log('JSON：' + file);
