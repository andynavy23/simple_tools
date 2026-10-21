// 全站煙霧測試（Edge，手機視窗）：每一頁載入後不得有未捕捉的例外、本機資源 404、橫向溢出。
//   node tests/e2e/smoke.mjs [頁面路徑片段…]      通過時只印一行總結
import fs from 'fs';
import { launchEdge, openPage, repo } from './lib.mjs';
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const pages = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'].flatMap(d => fs.readdirSync(`${repo}/${d}`).filter(f => f.endsWith('.html')).map(f => `${d}/${f}`)).concat(['index.html']).filter(p => !only.length || only.some(o => p.includes(o)));
const browser = await launchEdge();
const bad = []; let next = 0;
async function worker() {
    while (next < pages.length) {
        const rel = pages[next++];
        try {
            const { page, errors } = await openPage(browser, rel);
            await new Promise(r => setTimeout(r, 300));
            const over = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
            if (over > 1) errors.push(`橫向溢出 ${over}px`);
            if (errors.length) bad.push(rel + '\n  - ' + [...new Set(errors)].join('\n  - '));
            await page.close();
        } catch (e) { bad.push(rel + '\n  - 載入失敗：' + e.message.slice(0, 80)); }
    }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
console.log(bad.join('\n') + `${bad.length ? '\n' : ''}smoke：${pages.length} 頁，${bad.length} 頁有問題`);
process.exit(bad.length ? 1 : 0);
