// 全站靜態稽核（安全 / 穩健性 / 文件與連結一致性）。手動執行：node tests/audit_static.mjs
// 純啟發式，是找線索不是通過 / 失敗；完整結果寫到系統暫存資料夾的 st-audit-static.json。
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (d, out = []) => {
    for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        if (['node_modules', '.git', 'tests'].includes(e.name) || e.name.startsWith('temp_')) continue;
        const p = d ? d + '/' + e.name : e.name;
        e.isDirectory() ? walk(p, out) : out.push(p);
    }
    return out;
};
const all = walk('');
const pages = all.filter(f => f.endsWith('.html') && /^(fun|game-assist|mini-games|utils|reading)\//.test(f));
const htmlFiles = all.filter(f => f.endsWith('.html'));
const lineOf = (s, i) => s.slice(0, i).split('\n').length;
const R = {};                       // 結果
const add = (k, o) => (R[k] ||= []).push(o);

// 取出頁面內所有 inline <script>（含起始行號）；沒有 src 且不是 template / json
function inlineScripts(src) {
    const out = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(src))) {
        if (/\bsrc=/.test(m[1]) || /type="(application\/ld\+json|text\/template)"/.test(m[1])) continue;
        const start = lineOf(src, m.index + m[0].indexOf('>') + 1) - 1;   // 腳本第 1 行的行號偏移
        out.push({ code: m[2], off: start });
    }
    return out;
}
const units = [];   // {file, code, off}
for (const f of htmlFiles) for (const s of inlineScripts(rd(f))) units.push({ file: f, ...s });
for (const f of all.filter(f => /^shared\/js\/.*\.js$/.test(f) || f === 'sw.js')) units.push({ file: f, code: rd(f), off: 0 });

// ---------- 1. innerHTML 注入 ----------
const SINK = /(\.(?:innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\()/g;
const TAINT = /nick|name|msg|chat|text|title|label|note|desc|input|value|\bval\b|place|topic|answer|word|\bd\.|\bm\.|data|item|entry|saved|stored|json|parsed|q\b|query|content|memo|tag|comment|author|who/i;
const SAFE_EXPR = /esc\(|Util\.esc|\.toFixed|Math\.|\.length|Number\(|parseInt|parseFloat|\bi\b|\bidx\b|\.join\(''\)|fmt|pad\(|\.toLocaleString|\+\+|^\s*[\d.]+\s*$/;
function extractStatement(lines, i, col) {
    let txt = lines[i].slice(col), n = 0, ticks = (txt.match(/`/g) || []).length;
    let j = i;
    while (j < lines.length - 1 && n < 40) {
        const done = ticks % 2 === 0 && /;\s*(\/\/.*)?$/.test(lines[j]) || (ticks % 2 === 0 && j > i && /[;)]\s*$/.test(lines[j]));
        if (done) break;
        j++; n++; txt += '\n' + lines[j]; ticks += (lines[j].match(/`/g) || []).length;
    }
    return txt;
}
function interpolations(stmt) {
    const out = [];
    for (let i = 0; i < stmt.length; i++) {
        if (stmt[i] === '$' && stmt[i + 1] === '{') {
            let d = 1, j = i + 2;
            for (; j < stmt.length && d; j++) { if (stmt[j] === '{') d++; else if (stmt[j] === '}') d--; }
            out.push(stmt.slice(i + 2, j - 1)); i = j;
        }
    }
    return out;
}
for (const u of units) {
    const lines = u.code.split('\n');
    lines.forEach((ln, i) => {
        SINK.lastIndex = 0;
        let m;
        while ((m = SINK.exec(ln))) {
            if (/^\s*\/\//.test(ln)) break;
            const stmt = extractStatement(lines, i, m.index);
            const rhs = stmt.slice(m[0].length);
            if (/^\s*(['"`])\1\s*;?\s*$/.test(rhs)) continue;                       // = ''
            let unsafe = interpolations(stmt).filter(e => !SAFE_EXPR.test(e));
            // 字串相加：去掉字串常值後仍有識別字
            const noStr = rhs.replace(/`[\s\S]*?`/g, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '');
            if (/\+/.test(noStr)) {
                const ids = (noStr.match(/[A-Za-z_$][\w$.\[\]]*(?:\([^()]*\))?/g) || []).filter(x => !/^(esc|Util\.esc|String|Number)\b/.test(x));
                for (const id of ids) if (!SAFE_EXPR.test(id) && !/^(function|return|true|false|null)$/.test(id)) unsafe.push(id);
            }
            if (!unsafe.length) continue;
            const around = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
            const hasEsc = /\besc\(|Util\.esc|textContent|escapeHtml/.test(around);
            const tainted = unsafe.filter(e => TAINT.test(e));
            const score = tainted.length * 3 + unsafe.length + (hasEsc ? -2 : 2) + (/localStorage|store\.get|JSON\.parse|onMessage|\.on\('data'|files\[|FileReader|\.value/.test(stmt + around) ? 3 : 0) + (/nick|chat|msg|name\b/i.test(tainted.join(' ')) ? 3 : 0);
            add('innerHTML', { at: `${u.file}:${u.off + i + 1}`, score, hasEscNearby: hasEsc, exprs: unsafe.slice(0, 4).map(s => s.trim().slice(0, 50)), snippet: ln.trim().slice(0, 110) });
        }
    });
}
R.innerHTML?.sort((a, b) => b.score - a.score);

// ---------- 2. 危險 API / 連結 ----------
const checks2 = [
    ['eval', /(?<![.\w])eval\s*\(/],
    ['newFunction', /new\s+Function\s*\(/],
    ['timerString', /set(?:Timeout|Interval)\s*\(\s*(['"`])/],
    ['windowOpen', /window\.open\s*\(/],
    ['javascriptUrl', /javascript:/i],
    ['dataUrlInput', /(?:href|src)\s*=\s*['"`]?data:/i],
    ['hrefSrcAssign', /\.(?:href|src)\s*=\s*(?!['"`][^'"`$]*['"`]\s*;)[^;\n]*[A-Za-z_]/],
];
for (const u of units) {
    const lines = u.code.split('\n');
    lines.forEach((ln, i) => {
        if (/^\s*\/\//.test(ln)) return;
        for (const [k, re] of checks2) {
            if (!re.test(ln)) continue;
            if (k === 'windowOpen' && /noopener/.test(ln)) continue;
            if (k === 'javascriptUrl' && /startsWith|test\(|replace|\^/.test(ln)) continue;
            if (k === 'hrefSrcAssign') {
                if (/URL\.createObjectURL|createObjectURL|blob|canvas|toDataURL|location\.href\s*=\s*location|\.src\s*=\s*(url|u|URL)\b|cdn|PEERJS_URL|s\.src/.test(ln) === false && !/https?:\/\/|location\.|window\.location|encodeURI|\.\/|\.\.\//.test(ln)) {
                    const near = lines.slice(Math.max(0, i - 6), i + 1).join('\n');
                    add('urlAssignNoWhitelist', { at: `${u.file}:${u.off + i + 1}`, whitelisted: /https?:|\^https|protocol/.test(near), snippet: ln.trim().slice(0, 110) });
                }
                continue;
            }
            add(k, { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 110) });
        }
        // JS 字串裡拼的 <a target=_blank>
        if (/target=\\?["']_blank/.test(ln) && !/noopener/.test(ln)) add('blankNoRelJs', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 110) });
    });
}
for (const f of htmlFiles) {
    const s = rd(f);
    for (const m of s.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) if (!/noopener/.test(m[0])) add('blankNoRel', { at: `${f}:${lineOf(s, m.index)}`, snippet: m[0].slice(0, 110) });
    for (const m of s.matchAll(/\b(?:href|src)=["']\s*(?:javascript|data):[^"']{0,30}/gi)) add('javascriptUrl', { at: `${f}:${lineOf(s, m.index)}`, snippet: m[0] });
}

// ---------- 3. postMessage / BroadcastChannel / P2P ----------
for (const u of units) {
    const lines = u.code.split('\n');
    lines.forEach((ln, i) => {
        if (/addEventListener\(\s*['"]message['"]/.test(ln) || /\.onmessage\s*=/.test(ln)) {
            const body = lines.slice(i, i + 12).join('\n');
            add('messageListener', { at: `${u.file}:${u.off + i + 1}`, checksOrigin: /\.origin|\.source/.test(body), snippet: ln.trim().slice(0, 100) });
        }
        if (/postMessage\(.*['"]\*['"]/.test(ln)) add('postMessageStar', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 100) });
        if (/new BroadcastChannel/.test(ln)) add('broadcast', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 100) });
        // P2P 收到訊息後直接當索引 / 迴圈次數 / 長度
        if (/\bonMessage\b|\.on\(\s*['"]data['"]/.test(ln)) {
            const m = ln.match(/onMessage\s*[:(]\s*(?:function\s*)?\(?\s*([\w, ]+?)\s*\)?\s*(?:=>|\{)/) || ln.match(/\(\s*(\w+)\s*\)\s*=>/);
            const body = lines.slice(i, i + 60).join('\n');
            if (!u.file.startsWith('shared') && !/\bonMessage\b/.test(ln)) return;
            const params = m ? m[1].split(',').map(s => s.trim()) : ['d', 'data', 'msg'];
            const v = params[params.length - 1];
            const hasTry = /\btry\s*\{/.test(lines.slice(i, i + 15).join('\n'));
            const uses = [];
            const idx = new RegExp(`\\[\\s*${v}\\.\\w+\\s*\\]`), loop = new RegExp(`<\\s*=?\\s*${v}\\.\\w+|repeat\\(\\s*${v}\\.|new Array\\(\\s*${v}\\.|\\.length\\s*=\\s*${v}\\.|slice\\(\\s*${v}\\.|substr\\(\\s*${v}\\.`);
            lines.slice(i, i + 60).forEach((l2, k) => { if (idx.test(l2)) uses.push(`索引 ${u.off + i + k + 1}`); if (loop.test(l2)) uses.push(`迴圈/長度 ${u.off + i + k + 1}`); });
            const typeCheck = new RegExp(`typeof\\s+${v}|Number\\.isInteger|Number\\.isFinite|Array\\.isArray|isInteger|\\b${v}\\s*&&\\s*typeof`).test(body);
            add('p2pHandler', { at: `${u.file}:${u.off + i + 1}`, hasTry, typeCheck, risky: uses.slice(0, 5), snippet: ln.trim().slice(0, 100) });
        }
    });
}
// 頁面層級：連線頁沒有任何 typeof / isInteger 驗證
for (const f of pages) {
    const s = rd(f);
    if (!/P2PRoom/.test(s)) continue;
    const code = inlineScripts(s).map(x => x.code).join('\n');
    const nTypeof = (code.match(/typeof\s+\w+(\.\w+)?\s*[!=]==/g) || []).length + (code.match(/Number\.isInteger|Number\.isFinite|Array\.isArray/g) || []).length;
    const nMsgUse = (code.match(/\b(?:d|data|msg|m)\.(?:x|y|r|c|i|idx|index|n|count|pos|cell|row|col|r|id)\b/g) || []).length;
    add('p2pPageValidation', { at: f, validators: nTypeof, rawFieldUses: nMsgUse });
}
R.p2pHandler?.sort((a, b) => (b.risky.length - a.risky.length) || (a.hasTry - b.hasTry));
R.p2pPageValidation?.sort((a, b) => (b.rawFieldUses - b.validators) - (a.rawFieldUses - a.validators));

// ---------- 4. 外部資源 ----------
for (const f of htmlFiles.concat(all.filter(x => /\.(js|css)$/.test(x) && !x.startsWith('tests')))) {
    const s = rd(f);
    const tagRe = /<(script|link|img|iframe|source|video|audio)\b[^>]*>/gi;
    for (const m of s.matchAll(tagRe)) {
        const u = m[0].match(/\b(?:src|href)=["'](https?:)?\/\/([^"']+)/i);
        if (u) add('externalTag', { at: `${f}:${lineOf(s, m.index)}`, url: u[0].slice(0, 90), sri: /integrity=/.test(m[0]), crossorigin: /crossorigin/.test(m[0]), kind: m[1] });
    }
    for (const m of s.matchAll(/(?:@import|url\()\s*['"]?(https?:\/\/[^'")\s]+)/g)) add('externalTag', { at: `${f}:${lineOf(s, m.index)}`, url: m[1].slice(0, 90), sri: false, kind: 'css' });
    for (const m of s.matchAll(/(?:import\(|fetch\(|importScripts\(|\.src\s*=\s*|new Worker\()\s*['"`](https?:\/\/[^'"`]+)/g)) add('externalJs', { at: `${f}:${lineOf(s, m.index)}`, url: m[1].slice(0, 90), sri: /integrity/.test(s.slice(m.index, m.index + 300)) });
    for (const m of s.matchAll(/const\s+\w*URL\w*\s*=\s*['"`](https?:\/\/[^'"`]+)/g)) add('externalJs', { at: `${f}:${lineOf(s, m.index)}`, url: m[1].slice(0, 90), sri: /integrity/.test(s) });
}
{ // PeerJS 離線退化
    const p = rd('shared/js/p2p-room.js');
    R.p2pShared = { callWrapsTryCatch: /const call = [^\n]*try/.test(p), msgSizeLimit: /byteLength|maxMsg|\.length\s*>\s*\d{4,}/.test(p), rateLimit: /rate|throttle/i.test(p), nickWhitelist: /NICK_RE/.test(p) };
    R.peerjsOffline = { sri: /integrity/.test(p), onerrorHandling: /onerror|catch/.test(p), loadsLazily: /createElement\(['"]script/.test(p) };
}

// ---------- 5. localStorage 穩健性 ----------
for (const u of units) {
    if (u.file === 'sw.js') continue;
    const lines = u.code.split('\n');
    lines.forEach((ln, i) => {
        if (/^\s*\/\//.test(ln)) return;
        if (/JSON\.parse\(\s*(?:window\.)?(?:localStorage\.getItem|sessionStorage\.getItem)/.test(ln) || /JSON\.parse\(\s*\w+\s*\)/.test(ln) && /localStorage|getItem/.test(lines.slice(Math.max(0, i - 2), i + 1).join('\n'))) {
            const near = lines.slice(Math.max(0, i - 8), i + 2).join('\n');
            if (!/\btry\b/.test(near) && !/\.catch\(/.test(ln)) add('jsonParseNoTry', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 110) });
        }
        const m = ln.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:JSON\.parse\(\s*localStorage\.getItem|(?:Util\.)?store\.get|JSON\.parse\(\s*(?:raw|s|str|txt|text)\s*\))/);
        if (m) {
            const v = m[1], win = lines.slice(i, i + 15).join('\n');
            if (!new RegExp(`Array\\.isArray\\(\\s*${v}\\b|isArray`).test(lines.slice(Math.max(0, i - 2), i + 12).join('\n')) && new RegExp(`\\b${v}\\.(?:map|forEach|filter|push|find|some|slice|sort|reduce)\\(`).test(win) && !/\|\|\s*\[\]|\?\?\s*\[\]/.test(ln) === true)
                add('storeNotArray', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 110) });
        }
        if (/localStorage\.setItem/.test(ln)) {
            const near = lines.slice(i, i + 6).join('\n');
            if (!/storageFailed|Util\.store|catch\s*\([^)]*\)\s*\{[^}]*Chrome/.test(near) && !u.file.startsWith('shared/')) add('setItemNoFailHandler', { at: `${u.file}:${u.off + i + 1}`, snippet: ln.trim().slice(0, 100) });
        }
    });
}

// ---------- 6. 工具清單一致性 ----------
const indexSrc = rd('index.html').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
const cards = [...indexSrc.matchAll(/<a class="card"([^>]*)>([\s\S]*?)<\/a>/g)].map(m => {
    const attr = (k) => (m[1].match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const title = (m[2].match(/<(?:h[1-6]|strong|b|span)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)</) || m[2].match(/<(?:h\d|strong)[^>]*>([\s\S]*?)</) || [])[1];
    return { href: attr('href'), store: attr('data-store') === '1', title: (title || '').replace(/<[^>]+>/g, '').trim(), line: lineOf(indexSrc, m.index) };
}).filter(c => c.href);
const readme = rd('README.md'), toolsMd = rd('TOOLS.md');
const rows = (s) => [...s.matchAll(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|(.*)$/gm)].map(m => ({ title: m[1], href: m[2], rest: m[3], cells: m[3].split('|').map(x => x.trim()), line: lineOf(s, m.index) }));
const rRows = rows(readme), tRows = rows(toolsMd);
const setOf = (a) => new Set(a.map(x => x.href));
const cSet = setOf(cards), rSet = setOf(rRows), tSet = setOf(tRows), pSet = new Set(pages);
for (const h of cSet) { if (!rSet.has(h)) add('consistency', { msg: `index 有、README 沒有：${h}` }); if (!tSet.has(h)) add('consistency', { msg: `index 有、TOOLS 沒有：${h}` }); }
for (const h of rSet) if (!cSet.has(h)) add('consistency', { msg: `README 有、index 沒有：${h}` });
for (const h of tSet) if (!cSet.has(h)) add('consistency', { msg: `TOOLS 有、index 沒有：${h}` });
for (const p of pages) if (!cSet.has(p)) add('orphanPage', { at: p });
for (const h of [...cSet, ...rSet, ...tSet]) if (!fs.existsSync(path.join(root, h))) add('consistency', { msg: `連到不存在的檔案：${h}` });
const titleMismatch = (a, b, na, nb) => { const mb = new Map(b.map(x => [x.href, x.title])); for (const x of a) if (mb.has(x.href) && mb.get(x.href) !== x.title) add('titleMismatch', { msg: `${x.href}：${na}「${x.title}」≠ ${nb}「${mb.get(x.href)}」` }); };
titleMismatch(rRows, tRows, 'README', 'TOOLS');
titleMismatch(cards.filter(c => c.title), rRows, 'index', 'README');
// 鍵
const keyRe = /(?:store\.(?:get|set|remove|del)|storage\.(?:get|set)|localStorage\.(?:getItem|setItem|removeItem))\s*\(\s*(`[^`]*`|'[^']*'|"[^"]*"|[A-Za-z_$][\w$.]*)/g;
const matchKey = (decl, k) => decl.some(d => d === '*' || d === k || (d.endsWith('*') && k.startsWith(d.slice(0, -1))));
const toolKeys = new Map();
for (const r of tRows) { const c = r.cells[1] || ''; toolKeys.set(r.href, [...c.matchAll(/`([^`]+)`/g)].map(m => m[1].replace(/<[^>]*>.*$/, '*'))); if (r.cells.length >= 3 && !(toolKeys.get(r.href).length) && c && !/^[—-]$/.test(c)) toolKeys.set(r.href, [...c.split(/[、,]/).map(x => x.trim()).filter(x => /^\w+\*?$/.test(x))]); }
for (const f of pages) {
    const s = rd(f);
    const code = inlineScripts(s).map(x => x.code).join('\n');
    const consts = {}; for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`\n]*)\2/g)) consts[m[1]] = m[3];
    const used = new Set(), dyn = new Set();
    for (const m of code.matchAll(keyRe)) {
        let a = m[1], k;
        if (/^['"]/.test(a)) k = a.slice(1, -1);
        else if (a[0] === '`') { const t = a.slice(1, -1); k = t.includes('${') ? t.slice(0, t.indexOf('${')) + '*' : t; }
        else if (consts[a] !== undefined) k = consts[a];
        else { dyn.add(a); continue; }
        used.add(k);
    }
    const meta = (s.match(/<meta\s+name="st-keys"\s+content="([^"]*)"/) || [])[1];
    const decl = meta ? meta.split(',').map(x => x.trim()).filter(Boolean) : [];
    const tk = toolKeys.get(f) || [];
    const usesStore = /localStorage|Util\.store|\bstore\.(get|set)/.test(code);
    if (usesStore && !meta) add('keys', { at: f, msg: '用到 localStorage 但沒有 st-keys 宣告', used: [...used].slice(0, 6) });
    for (const k of used) if (decl.length && !matchKey(decl, k)) add('keys', { at: f, msg: `使用但沒宣告：${k}` });
    for (const d of decl) if (d !== '*' && !(used.size === 0 && dyn.size) && ![...used].some(k => k === d || (d.endsWith('*') && k.startsWith(d.slice(0, -1))) || (k.endsWith('*') && d.startsWith(k.slice(0, -1))))) add('keys', { at: f, msg: `宣告但靜態找不到使用（可能是動態鍵）：${d}`, weak: dyn.size > 0 });
    const decS = new Set(decl), tkS = new Set(tk);
    for (const d of decl) if (!tkS.has(d) && tRows.some(r => r.href === f)) add('keysDocs', { at: f, msg: `st-keys 有、TOOLS 第 3 欄沒有：${d}` });
    for (const k of tk) if (!decS.has(k)) add('keysDocs', { at: f, msg: `TOOLS 第 3 欄有、st-keys 沒有：${k}` });
}

// ---------- 7. 站內連結 / 孤兒檔 ----------
const textFiles = all.filter(f => /\.(html|js|css|json|md|webmanifest)$/.test(f));
const allText = textFiles.map(f => rd(f)).join('\n');
for (const f of htmlFiles.concat(all.filter(x => x.endsWith('.css') || x.endsWith('.js')))) {
    const s = rd(f), dir = path.posix.dirname(f);
    const refs = [];
    if (f.endsWith('.html')) {
        for (const m of s.matchAll(/\b(?:href|src|poster|data-src)=["']([^"']+)["']/g)) refs.push([m[1], m.index]);
        for (const m of s.matchAll(/fetch\(\s*['"`]([^'"`$]+)['"`]/g)) refs.push([m[1], m.index]);
    } else if (f.endsWith('.css')) for (const m of s.matchAll(/url\(\s*['"]?([^'")]+)/g)) refs.push([m[1], m.index]);
    else for (const m of s.matchAll(/fetch\(\s*['"`]([^'"`$]+)['"`]/g)) refs.push([m[1], m.index]);
    for (let [r, idx] of refs) {
        if (/^(https?:|\/\/|#|mailto:|tel:|data:|blob:|javascript:|about:)/i.test(r) || /[${}]/.test(r) || !r.trim()) continue;
        const clean = r.split('#')[0].split('?')[0]; if (!clean) continue;
        const target = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(dir, clean));
        const t = target.endsWith('/') ? target + 'index.html' : target;
        if (!fs.existsSync(path.join(root, t))) add('brokenLink', { at: `${f}:${lineOf(s, idx)}`, ref: r });
    }
}
// 孤兒：只看根目錄與 assets/
for (const f of all.filter(f => !f.includes('/') || f.startsWith('assets/'))) {
    if (['CLAUDE.md', 'LICENSE', 'favicon.ico', 'index.html', 'IDEAS.md', 'README.md', 'TOOLS.md'].includes(f)) continue;
    const base = path.posix.basename(f);
    if (!allText.includes(base)) add('orphanFile', { at: f });
}

// ---------- 8. help / meta ----------
const SECTIONS = ['這是什麼', '什麼時候用', '怎麼', '範例', '小提醒'];
const titles = new Map();
for (const f of pages) {
    const s = rd(f);
    const help = (s.match(/<template id="help">([\s\S]*?)<\/template>/) || [])[1];
    const hasKeys = /name="st-keys"/.test(s);
    if (!help) add('helpMissing', { at: f });
    else {
        const miss = SECTIONS.filter(x => !new RegExp(`<h3[^>]*>[^<]*${x}`).test(help));
        if (miss.length) add('helpSections', { at: f, missing: miss });
        if (hasKeys) {
            const tip = (help.match(/<h3[^>]*>[^<]*小提醒[\s\S]*$/) || [''])[0];
            const cl = /清除|刪除|重置|清空|移除/.test(tip), lim = /上限|最多|最近\s*\d|≤|筆|超過/.test(tip);
            if (!cl || !lim) add('helpTipNoLimitClear', { at: f, hasClear: cl, hasLimit: lim });
        }
    }
    const t = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim();
    if (!t) add('titleMissing', { at: f }); else { if (!titles.has(t)) titles.set(t, []); titles.get(t).push(f); }
    const d = (s.match(/<meta\s+name="description"\s+content="([^"]*)"/) || [])[1];
    if (!d) add('descMissing', { at: f }); else if (d.length < 20) add('descShort', { at: f, len: d.length });
    const miss = ['og:title', 'og:description', 'og:image'].filter(p => !new RegExp(`property="${p}"`).test(s));
    if (miss.length) add('ogMissing', { at: f, missing: miss });
}
for (const [t, fs_] of titles) if (fs_.length > 1) add('titleDup', { title: t, files: fs_ });

// ---------- 輸出 ----------
const out = path.join(os.tmpdir(), 'st-audit-static.json');
fs.writeFileSync(out, JSON.stringify(R, null, 1));
const brief = (o) => o.at && (o.msg || o.snippet || o.missing) ? `${o.at} ${o.msg || o.snippet || '缺 ' + o.missing.join(',')}` : JSON.stringify(o).slice(0, 160);
const sections = {
    innerHTML: '1 innerHTML 插值未轉義（依可疑度）', eval: '2 eval', newFunction: '2 new Function', timerString: '2 setTimeout(字串)', windowOpen: '2 window.open 無 noopener',
    blankNoRel: '2 target=_blank 無 rel=noopener（HTML）', blankNoRelJs: '2 target=_blank 無 noopener（JS 字串）', javascriptUrl: '2 javascript: URL', dataUrlInput: '2 data: URL', urlAssignNoWhitelist: '2 href/src 賦值（無協定白名單）',
    messageListener: '3 message 監聽', postMessageStar: '3 postMessage("*")', broadcast: '3 BroadcastChannel', p2pHandler: '3 P2P 處理函式', p2pPageValidation: '3 連線頁驗證密度',
    externalTag: '4 外部資源（標籤）', externalJs: '4 外部資源（JS）', jsonParseNoTry: '5 JSON.parse(localStorage) 無 try', storeNotArray: '5 讀出直接當陣列', setItemNoFailHandler: '5 setItem 無失敗提示',
    consistency: '6 index/README/TOOLS 不一致', titleMismatch: '6 標題不一致', keys: '6 st-keys vs 實際使用', keysDocs: '6 st-keys vs TOOLS 第 3 欄',
    brokenLink: '7 壞連結', orphanPage: '7 孤兒頁面', orphanFile: '7 未被引用的根目錄 / assets 檔',
    helpMissing: '8 缺 help', helpSections: '8 help 缺段落', helpTipNoLimitClear: '8 小提醒缺上限 / 清除說明', titleMissing: '8 缺 title', titleDup: '8 title 重複', descMissing: '8 缺 description', descShort: '8 description < 20 字', ogMissing: '8 缺 og 標籤',
};
console.log(`頁面 ${pages.length}、卡片 ${cards.length}、README 列 ${rRows.length}、TOOLS 列 ${tRows.length}`);
for (const [k, label] of Object.entries(sections)) {
    const a = R[k] || [];
    console.log(`\n## ${label}：${a.length}`);
    a.slice(0, 15).forEach(o => console.log('  ' + brief(o).slice(0, 170)));
}
console.log('\nP2P 共用層：', JSON.stringify(R.p2pShared));
console.log('PeerJS：', JSON.stringify(R.peerjsOffline));
console.log('完整結果：' + out);
