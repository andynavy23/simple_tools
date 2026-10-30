// 壞資料載入稽核（手動跑，不在 --all 內）：還原備份、手動改壞、舊版資料都可能讓 localStorage 內容缺欄位或型別不對，
// 規則是「載入一律驗證並容錯，壞資料不能讓整頁壞掉」。這支對每個宣告 <meta name="st-keys"> 的頁面，
// 把它宣告的每個鍵都塞進同一種壞值（null / 字串 / 數字 / 空陣列 / 空物件 / 非 JSON / 含 null 的陣列 / 型別錯的物件）後載入，
// 檢查沒有未捕捉的例外（pageerror）。只印有問題的頁。
//   node tests/e2e/storage_fuzz.mjs [頁名片段]
import fs from 'fs';
import path from 'path';
import { launchEdge, pageUrl, repo } from './lib.mjs';

const frags = process.argv.slice(2).filter(a => !a.startsWith('--'));
const DIRS = ['game-assist', 'mini-games', 'fun', 'utils', 'reading'];
const PAYLOADS = [['null', 'null'], ['字串', '"x"'], ['數字', '123'], ['空陣列', '[]'], ['空物件', '{}'], ['非 JSON', 'not json{'], ['陣列含 null', '[null,1,"a",{}]'], ['物件型別錯', '{"a":[],"b":"x","items":"nope","list":5}']];

let pages = DIRS.flatMap(d => fs.existsSync(path.join(repo, d)) ? fs.readdirSync(path.join(repo, d)).filter(f => f.endsWith('.html')).map(f => d + '/' + f) : []);
if (frags.length) pages = pages.filter(p => frags.some(f => p.includes(f)));
const keysOf = (rel) => {
    const m = /<meta name="st-keys" content="([^"]*)"/.exec(fs.readFileSync(path.join(repo, rel), 'utf8'));
    return m ? m[1].split(',').map(s => s.trim()).filter(Boolean).map(k => k.endsWith('*') ? k.slice(0, -1) + 'fuzz' : k) : [];
};
const targets = pages.map(p => [p, keysOf(p)]).filter(([, k]) => k.length);

const browser = await launchEdge();
const problems = [];
let idx = 0;
async function worker() {
    for (let t; (t = targets[idx++]);) {
        const [rel, keys] = t;
        for (const [label, val] of PAYLOADS) {
            const page = await browser.newPage();
            const errs = [];
            page.on('pageerror', e => errs.push(String(e.message).split('\n')[0].slice(0, 110)));
            page.on('dialog', d => d.dismiss().catch(() => { }));
            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
            await page.evaluateOnNewDocument((ks, v) => { try { for (const k of ks) localStorage.setItem(k, v); } catch { } }, keys, val);
            try {
                await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load', timeout: 20000 });
                await new Promise(r => setTimeout(r, 350));
                const alive = await page.evaluate(() => document.body && document.body.children.length > 0);
                if (!alive) errs.push('頁面空白');
            } catch (e) { errs.push('載入失敗：' + String(e.message).slice(0, 60)); }
            if (errs.length) problems.push(`${rel}｜${label}：${[...new Set(errs)].slice(0, 2).join('；')}`);
            await page.close();
        }
    }
}
await Promise.all(Array.from({ length: 5 }, worker));
await browser.close();
console.log(problems.length ? problems.sort().join('\n') : '沒有發現問題');
console.log(`檢查 ${targets.length} 頁（有 st-keys）× ${PAYLOADS.length} 種壞值，${problems.length} 個問題`);
