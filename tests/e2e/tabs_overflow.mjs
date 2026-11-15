// 逐分頁橫向溢出稽核（手動跑，不在 --all 內）：iOS 稽核與煙霧測試只看每頁的預設畫面，多分頁工具的其他分頁沒人看過。
// 這支對每個頁面找出分頁鈕列（.tabs / .chips / #tabs / [role=tablist]，≥ 3 顆按鈕），逐顆點過、等一下，檢查 390px 寬沒有橫向溢出、沒有未捕捉例外。
//   node tests/e2e/tabs_overflow.mjs [頁名片段]
import fs from 'fs';
import path from 'path';
import { launchEdge, pageUrl, repo } from './lib.mjs';

const frags = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DIRS = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'];
let pages = DIRS.flatMap(d => fs.existsSync(path.join(repo, d)) ? fs.readdirSync(path.join(repo, d)).filter(f => f.endsWith('.html')).map(f => d + '/' + f) : []);
if (frags.length) pages = pages.filter(p => frags.some(f => p.includes(f)));

const browser = await launchEdge();
const problems = [];
let idx = 0, swept = 0;
async function worker() {
    for (let rel; (rel = pages[idx++]);) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e.message).split('\n')[0].slice(0, 100)));
        page.on('dialog', d => d.dismiss().catch(() => { }));
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        try {
            await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load', timeout: 20000 });
            await new Promise(r => setTimeout(r, 300));
            const n = await page.evaluate(() => {
                const sel = '.tabs,.chips,#tabs,[role=tablist]';
                window.__tabBtns = [];
                document.querySelectorAll(sel).forEach((c, ci) => { const bs = [...c.querySelectorAll(':scope>button')]; if (bs.length >= 3 && bs.length <= 30) bs.forEach((b, bi) => window.__tabBtns.push([ci, bi])); });
                return window.__tabBtns.length;
            });
            if (n) swept++;
            for (let i = 0; i < n; i++) {
                const r = await page.evaluate((i) => {
                    const [ci, bi] = window.__tabBtns[i];
                    const c = document.querySelectorAll('.tabs,.chips,#tabs,[role=tablist]')[ci];
                    const b = c && [...c.querySelectorAll(':scope>button')][bi];
                    if (!b || b.disabled || !b.offsetParent) return null;
                    const label = b.textContent.trim().slice(0, 14);
                    b.click();
                    return label;
                }, i);
                if (r === null) continue;
                await new Promise(r => setTimeout(r, 120));
                const over = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
                if (over > 1) problems.push(`${rel}｜分頁「${r}」橫向溢出 ${over}px`);
            }
        } catch (e) { errs.push('載入失敗：' + String(e.message).slice(0, 60)); }
        if (errs.length) problems.push(`${rel}｜${[...new Set(errs)].slice(0, 2).join('；')}`);
        await page.close();
    }
}
await Promise.all(Array.from({ length: 4 }, worker));
await browser.close();
console.log(problems.length ? problems.sort().join('\n') : '沒有發現問題');
console.log(`檢查 ${pages.length} 頁，其中 ${swept} 頁有分頁鈕列，${problems.length} 個問題`);
