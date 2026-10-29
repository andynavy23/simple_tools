// 把新工具 / 擴充頁登錄到 index.html、README.md、TOOLS.md，並從 IDEAS.md 刪掉已完成的點子。
//   node tests/register.mjs temp_reg_*.json      （規格檔由各批次代理寫在 repo 根目錄的 temp_reg_<代號>.json，temp_* 已 gitignore）
// 規格：{ tools: [{href, cat, topic, icons[], c1, c2, title, desc, tags, kw, feature, keys, conn}],
//        updates: [{href, feature, desc, keys[]}],      // 擴充既有頁：追加到卡片說明 / README / TOOLS 功能欄，keys 補進 TOOLS 的資料鍵欄
//        ideas: [編號…] }                                // 已完成的 IDEAS.md 編號
import fs from 'fs';
import path from 'path';
import { repo } from './e2e/lib.mjs';

const files = process.argv.slice(2).filter(f => !f.startsWith('--'));
if (!files.length) { console.log('用法：node tests/register.mjs temp_reg_*.json'); process.exit(1); }
const specs = files.map(f => JSON.parse(fs.readFileSync(path.resolve(repo, f), 'utf8')));
const tools = specs.flatMap(s => s.tools || []), updates = specs.flatMap(s => s.updates || []), ideas = new Set(specs.flatMap(s => s.ideas || []));
const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

const ANCHOR = { 工具: 'reading/stealth-reader.html', 小遊戲: 'mini-games/memory-match.html', 趣味: 'fun/sleep-log.html' };
const SECTION = { 工具: '## 工具\n', 小遊戲: '## 小遊戲\n', 趣味: '## 趣味\n' };
const rd = (p) => { const s = fs.readFileSync(path.join(repo, p), 'utf8'); return [s.replace(/\r\n/g, '\n'), s.includes('\r\n')]; };
const wr = (p, s, crlf) => fs.writeFileSync(path.join(repo, p), crlf ? s.replace(/\n/g, '\r\n') : s);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fail = (m) => { console.log('FAIL ' + m); process.exit(1); };

let [idx, ci] = rd('index.html');
const used = {};
for (const t of tools) {
    if (idx.includes(`href="${t.href}"`)) fail('首頁已有卡片 ' + t.href);
    if (!fs.existsSync(path.join(repo, t.href))) fail('找不到頁面 ' + t.href);
    const n = String(t.kw).trim().split(/\s+/).length;
    if (n < 4 || n > 10) fail(`${t.href} 的 kw 要 4–10 個詞（現在 ${n}）`);
    const ic = (t.icons || []).find(i => !idx.includes(`>${i}</div>`) && !Object.values(used).includes(i));
    if (!ic) fail('圖示都重複：' + t.href);
    used[t.href] = ic;
}
for (const cat of Object.keys(ANCHOR)) {
    let cards = '';
    for (const t of tools.filter(x => x.cat === cat)) {
        const store = t.keys && t.keys !== '—' ? ' data-store="1"' : '';
        cards += `            <a class="card" href="${t.href}" data-cat="${t.cat}" data-topic="${t.topic}" data-kw="${t.kw}" data-added="${today}"${store}>\n                <div class="icon" style="--c1:${t.c1};--c2:${t.c2}">${used[t.href]}</div>\n                <div>\n                    <h2>${t.title}</h2>\n                    <p>${t.desc}</p>\n                    <div class="tags">${t.tags}</div>\n                </div>\n            </a>\n\n`;
    }
    if (!cards) continue;
    const a = `            <a class="card" href="${ANCHOR[cat]}"`;
    if (idx.split(a).length !== 2) fail('找不到首頁錨點 ' + ANCHOR[cat]);
    idx = idx.replace(a, () => cards + a);
}
for (const u of updates) {
    const m = new RegExp(`(<a class="card" href="${esc(u.href)}"[^>]*>[\\s\\S]*?<p>)([\\s\\S]*?)(</p>)`).exec(idx);
    if (!m) fail('首頁找不到卡片 ' + u.href);
    idx = idx.slice(0, m.index) + m[1] + m[2].replace(/。$/, '') + (u.desc || '') + '。' + m[3] + idx.slice(m.index + m[0].length);
}
wr('index.html', idx, ci);

let [readme, cr] = rd('README.md');
const anchor = '| [摸魚閱讀器]';
if (readme.split(anchor).length !== 2) fail('README 錨點');
readme = readme.replace(anchor, () => tools.map(t => `| [${t.title}](${t.href}) | ${t.cat} | ${t.feature} |\n`).join('') + anchor);
for (const u of updates) {
    const m = new RegExp(`^(\\| \\[[^\\]]+\\]\\(${esc(u.href)}\\) \\| [^|]+ \\| )(.*?)( \\|)$`, 'm').exec(readme);
    if (!m) fail('README 找不到 ' + u.href);
    readme = readme.slice(0, m.index) + m[1] + m[2] + u.feature + m[3] + readme.slice(m.index + m[0].length);
}
wr('README.md', readme, cr);

let [tl, ct] = rd('TOOLS.md');
for (const [cat, hdr] of Object.entries(SECTION)) {
    const rows = tools.filter(t => t.cat === cat);
    if (!rows.length) continue;
    const i = tl.indexOf(hdr), j = tl.indexOf('\n## ', i + 1);
    const sec = tl.slice(i, j).replace(/\n+$/, '') + '\n' + rows.map(t => `| [${t.title}](${t.href}) | ${t.feature} | ${t.keys || '—'} | ${t.conn || ''} |\n`).join('');
    tl = tl.slice(0, i) + sec + tl.slice(j);
}
for (const u of updates) {
    const m = new RegExp(`^\\| \\[[^\\]]+\\]\\(${esc(u.href)}\\) \\| .*$`, 'm').exec(tl);
    if (!m) fail('TOOLS 找不到 ' + u.href);
    const body = m[0].replace(/^\| /, '').replace(/ \|$/, '');
    const parts = body.split(' | ');
    const conn = parts.pop(), keys0 = parts.pop(), head = parts.join(' | ');
    let keys = keys0;
    const add = (u.keys || []).map(k => '`' + k + '`').filter(k => !keys.includes(k));
    if (add.length) keys = /^(—|\s*)$/.test(keys) ? add.join('、') : keys + '、' + add.join('、');
    tl = tl.slice(0, m.index) + '| ' + head + (u.feature || '') + ' | ' + keys + ' | ' + conn + ' |' + tl.slice(m.index + m[0].length);
}
wr('TOOLS.md', tl, ct);

let removed = 0, left = 0;
if (ideas.size) {
    let [id, cd] = rd('IDEAS.md');
    const out = [];
    for (const l of id.split('\n')) { const m = /^(\d+)\. /.exec(l); if (m && ideas.has(+m[1])) { removed++; continue; } out.push(l); }
    let t = out.join('\n');
    for (let k = 0; k < 3; k++) t = t.replace(/## [^\n]+\n\n(?=## )/g, '');
    t = t.replace(/\n{3,}/g, '\n\n');
    left = (t.match(/^\d+\. /gm) || []).length;
    t = t.replace(/目前還有 \d+ 個點子/, `目前還有 ${left} 個點子`);
    wr('IDEAS.md', t, cd);
}
console.log(`register OK：新工具 ${tools.length}、擴充 ${updates.length}、IDEAS 刪 ${removed}（剩 ${left || '—'}）`);
