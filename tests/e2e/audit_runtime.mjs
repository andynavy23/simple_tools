// 全站執行期稽核：載入每個工具頁（手機視窗），收集未捕捉例外 / unhandledrejection / console.error / 本機資源 404，
// 並掃 body.innerText 有沒有 NaN / undefined / null / [object Object] / Infinity。手動執行：node tests/e2e/audit_runtime.mjs [頁名片段]
// 找線索用，不在 --all 內；完整結果寫到系統暫存資料夾的 st-audit-runtime.json。
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, pageUrl, repo } from './lib.mjs';

const frag = process.argv[2];
const pages = [];
for (const d of ['fun', 'game-assist', 'mini-games', 'utils', 'reading'])
    for (const f of fs.readdirSync(path.join(repo, d))) if (f.endsWith('.html') && (!frag || (d + '/' + f).includes(frag))) pages.push(d + '/' + f);

const browser = await launchEdge();
const BAD = /\bNaN\b|\bundefined\b|\bnull\b|\[object Object\]|-?Infinity\b/g;
const results = [];
const NET = /net::ERR|Failed to load resource|peerjs|unpkg|open\.er-api|ERR_INTERNET|favicon/i;

async function audit(rel) {
    const page = await browser.newPage();
    const r = { page: rel, errors: [], consoleErrors: [], rejections: [], failed: [], badText: [] };
    page.on('pageerror', e => r.errors.push(String(e.message).slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error' && !NET.test(m.text())) r.consoleErrors.push(m.text().slice(0, 140)); });
    page.on('requestfailed', q => { if (q.url().startsWith('file:') && !q.url().endsWith('.webmanifest')) r.failed.push(q.url().split('/').pop()); });
    page.on('dialog', d => d.dismiss().catch(() => { }));
    await page.evaluateOnNewDocument(() => {
        window.__rej = [];
        addEventListener('unhandledrejection', e => window.__rej.push(String(e.reason && e.reason.message || e.reason).slice(0, 140)));
    });
    try {
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load', timeout: 20000 });
        await new Promise(res => setTimeout(res, 700));
        r.rejections = (await page.evaluate(() => window.__rej)).filter(x => !NET.test(x));
        r.badText = await page.evaluate((src) => {
            const re = new RegExp(src, 'g'), t = document.body.innerText, out = [];
            let m;
            while ((m = re.exec(t)) && out.length < 5) out.push(t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).replace(/\s+/g, ' '));
            return out;
        }, BAD.source);
    } catch (e) { r.errors.push('載入失敗：' + String(e.message).slice(0, 100)); }
    await page.close().catch(() => { });
    return r;
}

const queue = [...pages];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) results.push(await audit(queue.shift())); }));
await browser.close();

const out = path.join(os.tmpdir(), 'st-audit-runtime.json');
fs.writeFileSync(out, JSON.stringify(results, null, 1));
const groups = [['errors', '未捕捉例外'], ['rejections', 'unhandledrejection'], ['consoleErrors', 'console.error'], ['failed', '本機資源載入失敗'], ['badText', '畫面出現 NaN/undefined/null/[object Object]/Infinity']];
console.log(`載入 ${results.length} 頁`);
for (const [k, label] of groups) {
    const hit = results.filter(r => r[k].length);
    console.log(`\n## ${label}：${hit.length} 頁`);
    hit.slice(0, 15).forEach(r => console.log(`  ${r.page}  ${r[k].slice(0, 2).join(' | ').slice(0, 170)}`));
}
console.log('\n完整結果：' + out);
