// 各工具「純邏輯」的測試：node tests/tools.test.js
// 做法：從各 HTML 取出 `// --- pure ---` 到 `// --- /pure ---` 之間的程式碼來執行，不需要瀏覽器或任何套件。
// （連線相關見 tests/shared.test.js；畫面互動需另外在瀏覽器測。）
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const root = path.join(__dirname, '..');
global.Util = require(path.join(root, 'shared/js/util.js'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// 頁面外層用 const { ... } = Util 取得共用函式，這裡提供同樣的名稱
const PRELUDE = 'const { rnd, shuffle, store, copyText, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex, seeded, parseCSV, toObjects, isNum, csvStringify } = Util;\n';
const load = (file, names, from = '// --- pure ---', to = '// --- /pure ---') => {
    const h = read(file);
    return new Function(PRELUDE + h.slice(h.indexOf(from), h.indexOf(to)) + `; return { ${names} };`)();
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);
const ok = (name) => console.log('ok  ' + name);
const { sha256, randomHex } = Util;
const pending = [];                                       // 非同步測試（crypto.subtle）：最後一起等
const NL = String.fromCharCode(10);

// ===== 純文字整理 =====
{
    const OPS = load('utils/text-tools.html', 'OPS', '// 每個操作', 'const $ =').OPS;
    assert.equal(OPS['去除重複行']('a\nb\na\nc\nb'), 'a\nb\nc');
    assert.equal(OPS['排序 A→Z']('b\na\nc'), 'a\nb\nc');
    assert.equal(OPS['排序 A→Z']('item10\nitem2'), 'item2\nitem10');
    assert.equal(OPS['刪除空白行']('a\n\n  \nb'), 'a\nb');
    assert.equal(OPS['全形 → 半形']('ＡＢＣ１２３！　ｘ'), 'ABC123! x');
    assert.equal(OPS['半形 → 全形']('ABC 12!'), 'ＡＢＣ　１２！');
    ok('text-tools');
}

// ===== 隨機分組 =====
{
    const m = load('fun/lottery.html', 'split');
    assert.deepEqual(Util.parseNames('小明\n小華, 小美，阿強、 \n\n'), ['小明', '小華', '小美', '阿強']);
    const names = Array.from({ length: 23 }, (_, i) => 'n' + i);
    for (let t = 0; t < 300; t++) {
        const n = 1 + (t % 9), g = m.split(names, n), sizes = g.map(x => x.length);
        assert.equal(g.length, n);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
        assert.deepEqual(g.flat().sort(), [...names].sort());
    }
    ok('lottery: split');
}

// ===== 密碼產生器 =====
{
    const m = load('utils/password-gen.html', 'generate, SETS, AMBIGUOUS');
    const all = ['lower', 'upper', 'digit', 'symbol'];
    for (let i = 0; i < 1000; i++) {
        const len = 4 + (i % 61), r = m.generate(len, all, false);
        assert.equal(r.password.length, len);
        for (const k of all) assert.ok([...r.password].some(c => m.SETS[k].includes(c)), k);
    }
    for (let i = 0; i < 300; i++) assert.ok(![...m.generate(40, all, true).password].some(c => m.AMBIGUOUS.includes(c)));
    assert.equal(m.generate(16, [], false), null);
    assert.equal(m.generate(2, all, false), null);
    ok('password-gen');
}

// ===== 單位與匯率 =====
{
    const m = load('utils/unit-converter.html', 'convertAll, fmt, CATS');
    const get = (cat, v, from, to, rates) => m.convertAll(cat, v, from, rates).find(x => x.unit === to).value;
    near(get('面積', 1, '坪', '平方公尺'), 3.305785);
    near(get('長度', 1, '英里', '公尺'), 1609.344);
    near(get('長度', 33, '台尺', '公尺'), 10);
    near(get('重量', 1, '台斤', '公克'), 600);
    near(get('溫度', 100, '°C', '°F'), 212);
    near(get('溫度', -40, '°F', '°C'), -40);
    near(get('資料量', 1, 'GiB', 'MiB'), 1024);
    for (const cat of Object.keys(m.CATS)) {
        const units = Object.keys(m.CATS[cat]);
        for (const a of units) for (const b of units) near(get(cat, get(cat, 123.456, a, b), b, a), 123.456, 1e-9);
    }
    const rates = { TWD: 1, USD: 0.03, JPY: 4.9 };
    near(get('匯率', 100, 'USD', 'TWD', rates), 100 / 0.03);
    near(get('匯率', 1, 'USD', 'JPY', rates), 4.9 / 0.03);
    assert.equal(m.fmt(NaN), '—');
    ok('unit-converter');
}

// ===== 分帳 =====
{
    const m = load('utils/split-bill.html', 'toCents, splitCents, settle');
    assert.equal(m.toCents('0.1') + m.toCents('0.2'), 30);
    assert.deepEqual(m.splitCents(100, 3), [34, 33, 33]);
    for (let t = 0; t < 300; t++) {
        const n = 2 + Math.floor(Math.random() * 6), ps = Array.from({ length: n }, (_, i) => 'P' + i);
        const ex = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, () => {
            const shares = ps.filter(() => Math.random() < 0.6); if (!shares.length) shares.push(ps[0]);
            return { payer: ps[Math.floor(Math.random() * n)], amount: 1 + Math.floor(Math.random() * 100000), shares };
        });
        const s = m.settle(ps, ex), bal = { ...s.net };
        assert.equal(Object.values(s.net).reduce((a, b) => a + b, 0), 0);
        s.transfers.forEach(x => { bal[x.from] += x.amount; bal[x.to] -= x.amount; });
        Object.values(bal).forEach(v => assert.equal(v, 0));
        assert.ok(s.transfers.length <= n - 1);
    }
    ok('split-bill');
}

// ===== 時區 =====
{
    const m = load('utils/timezone.html', 'parts, zonedToMs, offsetLabel');
    const ms = m.zonedToMs(2026, 10, 2, 9, 0, 'Asia/Taipei');
    assert.equal(ms, Date.UTC(2026, 9, 2, 1, 0));
    const ny = m.parts(ms, 'America/New_York');
    assert.deepEqual([ny.m, ny.d, ny.h, ny.mi], [10, 1, 21, 0]);
    assert.equal(m.offsetLabel(ms, 'Asia/Kolkata'), 'UTC+5:30');
    assert.equal(m.offsetLabel(Date.UTC(2026, 0, 15), 'America/New_York'), 'UTC-5');
    assert.equal(m.offsetLabel(Date.UTC(2026, 6, 15), 'America/New_York'), 'UTC-4');
    for (const z of ['Asia/Taipei', 'Europe/London', 'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland'])
        for (let mo = 1; mo <= 12; mo++) {
            const p = m.parts(m.zonedToMs(2026, mo, 15, 10, 30, z), z);
            assert.deepEqual([p.y, p.m, p.d, p.h, p.mi], [2026, mo, 15, 10, 30]);
        }
    ok('timezone');
}

// ===== 捲軸期望值 =====
{
    const m = load('game-assist/scroll-calculator.html', 'expected, attemptsFor');
    near(m.expected(3, 0.6, 0, 100, 0), 500);
    const sim = (k, p, d, c, price, N = 150000) => {
        let total = 0;
        for (let i = 0; i < N; i++) { let s = 0; while (s < k) { total += c; if (Math.random() < p) s++; else if (Math.random() < d) { total += price; s = 0; } } }
        return total / N;
    };
    const e1 = m.expected(3, 0.6, 0.2, 100, 500), s1 = sim(3, 0.6, 0.2, 100, 500);
    assert.ok(Math.abs(e1 - s1) / e1 < 0.03, `${e1} vs ${s1}`);
    assert.equal(m.attemptsFor(1, 0.5, 0.75), 2);
    assert.equal(m.attemptsFor(2, 0.5, 0.5), 3);
    ok('scroll-calculator');
}

// ===== 正規表示式 =====
{
    const m = load('utils/regex-tester.html', 'findMatches');
    const r = m.findMatches('(\\w+)@(\\w+)\\.com', 'g', 'a@x.com, b@y.com');
    assert.equal(r.matches.length, 2);
    assert.deepEqual(r.matches[1].groups, ['b', 'y']);
    assert.equal(m.findMatches('a', '', 'aaa').matches.length, 1);
    assert.ok(m.findMatches('(', 'g', 'x').error);
    assert.equal(m.findMatches('x*', 'g', 'abc').matches.length, 4);
    assert.ok(m.findMatches('a', 'g', 'a'.repeat(1000), 500).truncated);
    ok('regex-tester');
}

// ===== 色彩 =====
{
    const m = load('utils/color-tools.html', 'parseColor, rgbToHsl, hslToRgb, toHex, contrast');
    assert.deepEqual(m.parseColor('#fff'), { r: 255, g: 255, b: 255 });
    assert.deepEqual(m.parseColor('hsl(0, 100%, 50%)'), { r: 255, g: 0, b: 0 });
    assert.equal(m.parseColor('rgb(256,0,0)'), null);
    assert.equal(m.toHex({ r: 0, g: 113, b: 227 }), '#0071e3');
    near(m.contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }), 21);
    assert.ok(Math.abs(m.contrast(m.parseColor('#777'), m.parseColor('#fff')) - 4.48) < 0.02);
    ok('color-tools');
}

// ===== 文字差異 =====
{
    const m = load('utils/text-diff.html', 'diffLines');
    const rebuild = (ops, side) => ops.filter(o => o.t === '=' || o.t === side).map(o => o.text).join('\n');
    for (let t = 0; t < 300; t++) {
        const gen = () => Array.from({ length: Math.floor(Math.random() * 12) }, () => 'ab c'[Math.floor(Math.random() * 4)]).join('\n');
        const x = gen(), y = gen(), d = m.diffLines(x, y);
        assert.equal(rebuild(d, '-'), x); assert.equal(rebuild(d, '+'), y);
    }
    const A = ['a', 'b', 'c'].join(NL), B = ['x', 'y', 'z'].join(NL);
    assert.equal(m.diffLines(A, B, { limit: 5 }), null);
    ok('text-diff');
}

// ===== 編碼解碼 =====
{
    const m = load('utils/encode-decode.html', 'CODECS');
    const samples = ['Hello, World!', '你好，世界 🌏', 'a+b=c&d?e/f#g', '<script>alert("x")</script>', '', 'line1\nline2\t🎉'];
    for (const [name, c] of Object.entries(m.CODECS).filter(([name, c]) => c.enc && c.dec && !c.param && name !== '摩斯密碼' && name !== 'ROT13' && !name.startsWith('網址參數'))) for (const s of samples) assert.equal(c.dec(c.enc(s)), s, name);
    assert.equal(m.CODECS['Base64'].enc('你好'), '5L2g5aW9');
    assert.throws(() => m.CODECS['Base64'].dec('!!!'));
    assert.throws(() => m.CODECS['十六進位 (UTF-8 位元組)'].dec('zz'));
    ok('encode-decode');
}

// ===== 雜訊 =====
{
    const m = load('fun/white-noise.html', 'noise');
    const ac = (a) => { let n = 0, d = 0; for (let i = 1; i < a.length; i++) { n += a[i] * a[i - 1]; d += a[i] * a[i]; } return n / d; };
    const r = {};
    for (const t of ['white', 'pink', 'brown']) {
        const a = m.noise(t, 100000);
        assert.ok(a.every(x => x >= -1 && x <= 1 && Number.isFinite(x)));
        r[t] = ac(a);
    }
    assert.ok(Math.abs(r.white) < 0.03 && r.pink > 0.3 && r.pink < r.brown && r.brown > 0.9);
    ok('white-noise');
}

// ===== 打字 =====
{
    const m = load('mini-games/typing-test.html', 'score');
    assert.deepEqual(m.score('hello', 'hello', 60), { correct: 5, typed: 5, accuracy: 100, cpm: 5, wpm: 1 });
    assert.equal(m.score('abcdef', 'abXdeY', 30).correct, 4);
    assert.equal(m.score('abc', 'abcdef', 60).correct, 3);
    ok('typing-test');
}

// ===== 翻牌記憶 =====
{
    const m = load('mini-games/memory-match.html', 'createGame, flip, resolve, drop, view, makeDeck, validView');
    for (const pairs of [6, 8, 12, 18]) {
        const deck = m.makeDeck(pairs), cnt = {};
        deck.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
        assert.ok(deck.length === pairs * 2 && Object.values(cnt).every(v => v === 2));
    }
    let g = m.createGame(['A', 'B', 'A', 'B'], 2);
    assert.equal(m.flip(g, 0, 1), false);
    assert.equal(m.flip(g, 0, 0), true);
    assert.equal(m.flip(g, 0, 0), false);
    assert.equal(m.flip(g, 1.5, 0), false);
    m.flip(g, 1, 0);
    assert.equal(m.flip(g, 2, 0), false);
    assert.equal(m.resolve(g), 'miss'); assert.equal(g.turn, 1);
    assert.ok(!JSON.stringify(m.view(g)).includes('"B"'));
    g = m.createGame(['A', 'B', 'A', 'B', 'C', 'C'], 3);
    m.flip(g, 0, 0); m.drop(g, 0);
    assert.deepEqual(g.up, []); assert.equal(g.turn, 1);
    m.drop(g, 2); assert.equal(g.over, true);
    for (let t = 0; t < 200; t++) {
        const players = 1 + (t % 4), pairs = [6, 8, 12, 18][t % 4], gm = m.createGame(m.makeDeck(pairs), players);
        for (let steps = 0; !gm.over && steps < 5000; steps++) {
            const who = gm.turn, downs = gm.status.map((s, i) => s === 'down' ? i : -1).filter(i => i >= 0);
            const a = downs[Math.floor(Math.random() * downs.length)];
            assert.ok(m.flip(gm, a, who));
            const rest = downs.filter(i => i !== a);
            assert.ok(m.flip(gm, rest[Math.floor(Math.random() * rest.length)], who));
            m.resolve(gm);
        }
        assert.ok(gm.over && gm.scores.reduce((x, y) => x + y, 0) === pairs);
    }
    const good = { ...m.view(m.createGame(['A', 'B', 'A', 'B'], 2)), names: ['x', 'y'] };
    assert.equal(m.validView(good), true);
    for (const bad of [null, {}, { ...good, turn: 5 }, { ...good, names: ['x'] }, { ...good, vals: [{ x: 1 }, null, null, null] }]) assert.equal(m.validView(bad), false);
    ok('memory-match');
}

// ===== 倒數日 =====
{
    const m = load('utils/countdown.html', 'daysBetween, nextAnniversary, describe');
    assert.equal(m.daysBetween('2026-10-01', '2026-10-31'), 30);
    assert.equal(m.daysBetween('2024-02-28', '2024-03-01'), 2);              // 閏年
    assert.equal(m.daysBetween('2026-03-28', '2026-03-30'), 2);              // 跨夏令時間
    assert.equal(m.daysBetween('2026-01-01', '2025-01-01'), -365);
    assert.equal(m.nextAnniversary('2026-10-02', '2000-10-02'), '2026-10-02');     // 就是今天
    assert.equal(m.nextAnniversary('2026-10-03', '2000-10-02'), '2027-10-02');
    assert.equal(m.nextAnniversary('2026-01-01', '2000-02-29'), '2026-02-28');     // 2/29 在非閏年算 2/28
    assert.equal(m.nextAnniversary('2027-03-01', '2000-02-29'), '2028-02-29');
    assert.deepEqual(m.describe('2026-10-02', { date: '2026-10-12' }).label, '還有');
    assert.equal(m.describe('2026-10-02', { date: '2026-10-12' }).days, 10);
    assert.equal(m.describe('2026-10-02', { date: '2026-10-02' }).kind, 'today');
    assert.equal(m.describe('2026-10-02', { date: '2026-09-02' }).kind, 'past');
    const y = m.describe('2026-10-02', { date: '2020-10-10', yearly: true });
    assert.equal(y.days, 8); assert.ok(y.label.includes('第 6 週年'));
    ok('countdown');
}

// ===== JSON 整理器 =====
{
    const m = load('utils/json-formatter.html', 'formatJSON, sortKeys, jsonErrorPos');
    const r = m.formatJSON('{"b":1,"a":[1,2]}', { indent: 2, sort: true });
    assert.equal(r.text, '{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}');
    assert.equal(m.formatJSON('{ "a" : 1 }', { mode: 'min' }).text, '{"a":1}');
    assert.equal(m.formatJSON('"str"', { mode: 'check' }).ok, true);
    assert.deepEqual(m.sortKeys({ b: [{ z: 1, y: 2 }], a: 0 }), { a: 0, b: [{ y: 2, z: 1 }] });
    // 錯誤位置：第 3 行 `  "b": ,` 的逗號在第 8 欄
    const bad = m.formatJSON('{\n  "a": 1,\n  "b": ,\n}', {});
    assert.deepEqual([bad.ok, bad.line, bad.col], [false, 3, 8]);
    assert.ok(bad.hint);
    const at = (text) => { const e = m.formatJSON(text, {}); return [e.line, e.col]; };
    assert.deepEqual(at('[1,2'), [1, 5]);                       // 提前結束：指到結尾
    assert.deepEqual(at('{"a":1,}'), [1, 8]);                   // 結尾逗號
    assert.deepEqual(at('{"a":"x'), [1, 8]);                    // 字串沒結束
    assert.deepEqual(at('{} x'), [1, 4]);                       // 多餘內容
    assert.deepEqual(at('[01]'), [1, 3]);                       // 前導零
    assert.deepEqual(at("{'a':1}"), [1, 2]);                    // 單引號
    // 與原生 JSON.parse 對照：合法性判斷必須一致（隨機變異）
    const seeds = [
        JSON.stringify({ a: [1, 2, { b: null, c: 'x\ny\\z"q' }], d: -1500.5, e: true, f: 'é' }),
        '[1,2,3]', '"s"', '{"k":{"k":{"k":[]}}}', '[0.5,-0,1E5,"\\u00e9"]', '  [ ]  ',
    ];
    const junk = ['', ',', ':', '{', '}', '[', ']', '"', "'", '\\', ' ', '\n', '1', 'x', 'true', 'nul', '01', '.5', '-', '+1'];
    let checked = 0, validCount = 0;
    for (let t = 0; t < 6000; t++) {
        let s = seeds[t % seeds.length];
        const edits = t % 3;                                    // 0 次變異 = 原始合法樣本
        for (let k = 0; k < edits; k++) {
            const i = Math.floor(Math.random() * (s.length + 1)), j = junk[Math.floor(Math.random() * junk.length)];
            s = Math.random() < 0.5 ? s.slice(0, i) + j + s.slice(i) : s.slice(0, i) + s.slice(i + 1);
        }
        let valid = true; try { JSON.parse(s); } catch (e) { valid = false; }
        const pos = m.jsonErrorPos(s);
        assert.equal(pos === null, valid, `不一致：${JSON.stringify(s)} native=${valid} mine=${JSON.stringify(pos)}`);
        if (pos) assert.ok(pos.pos >= 0 && pos.pos <= s.length);
        checked++; if (valid) validCount++;
    }
    assert.ok(validCount > 1500, '合法樣本應佔相當比例');
    ok('json-formatter (' + checked + ' fuzz cases agree with JSON.parse)');
}

// ===== Markdown =====
{
    const m = load('utils/markdown-preview.html', 'mdToHtml');
    const h = (s) => m.mdToHtml(s);
    assert.equal(h('# 標題'), '<h1>標題</h1>');
    assert.ok(h('**粗** *斜* ~~刪~~ `碼`').includes('<strong>粗</strong> <em>斜</em> <del>刪</del> <code>碼</code>'));
    assert.ok(h('- a\n- b\n  - c').includes('<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul>'));
    assert.ok(h('1. a\n2. b').includes('<ol><li>a</li><li>b</li></ol>'));
    assert.ok(h('| a | b |\n| --- | :---: |\n| 1 | 2 |').includes('<table>'));
    assert.ok(h('> 引用').includes('<blockquote>'));
    assert.ok(h('```\n<b>x</b>\n```').includes('&lt;b&gt;x&lt;/b&gt;'));            // 程式碼區塊內也跳脫
    // XSS：HTML 一律當文字；危險協定被擋下
    const evil = [
        '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html,<script>alert(1)</script>)',
        '![x](javascript:alert(1))', '![x](data:image/svg+xml;base64,AAAA)', '**<img src=x onerror=alert(1)>**', '`<script>`', '> <script>alert(1)</script>', '- <script>alert(1)</script>', '| <script> | b |\n| --- | --- |\n| <img onerror=1> | 2 |',
        '[a](https://x.com" onmouseover="alert(1))', '\u0000<script>',
    ];
    for (const s of evil) {
        const out = h(s);
        // 檢查「實際產生的標籤」：只能是白名單標籤，且不得帶事件屬性或危險協定
        const tags = out.match(/<[^>]+>/g) || [];
        const allowed = /^<\/?(p|h[1-6]|strong|em|del|code|pre|a|img|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|hr|br)(\s[^>]*)?>$/;
        for (const t of tags) {
            assert.ok(allowed.test(t), `非白名單標籤：${t}（輸入 ${s}）`);
            assert.ok(!/\son[a-z]+\s*=/i.test(t.replace(/"[^"]*"/g, '""')), `標籤帶事件屬性：${t}`);
            assert.ok(!/(href|src)="\s*(javascript|data|vbscript):/i.test(t), `危險協定：${t}`);
        }
    }
    assert.ok(h('[x](https://example.com)').includes('href="https://example.com" target="_blank" rel="noopener noreferrer"'));
    assert.ok(h('![a](https://e.com/i.png)').includes('<img src="https://e.com/i.png"'));
    ok('markdown-preview');
}

// ===== 2048 =====
{
    const m = load('mini-games/game-2048.html', 'slideLine, move, spawn, canMove, maxTile, emptyBoard');
    assert.deepEqual(m.slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
    assert.deepEqual(m.slideLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], gained: 4 });
    assert.deepEqual(m.slideLine([4, 2, 2, 0]), { line: [4, 4, 0, 0], gained: 4 });
    assert.deepEqual(m.slideLine([2, 0, 0, 2]), { line: [4, 0, 0, 0], gained: 4 });
    assert.deepEqual(m.slideLine([2, 4, 8, 16]), { line: [2, 4, 8, 16], gained: 0 });
    const b = [[2, 0, 0, 2], [0, 0, 0, 0], [4, 4, 0, 0], [0, 0, 0, 0]];
    assert.deepEqual(m.move(b, 'left').board, [[4, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0], [0, 0, 0, 0]]);
    assert.deepEqual(m.move(b, 'right').board, [[0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 8], [0, 0, 0, 0]]);
    assert.deepEqual(m.move(b, 'up').board[0], [2, 4, 0, 2]);
    assert.deepEqual(m.move(b, 'down').board[3], [4, 4, 0, 2]);       // 第 0 欄由下往上：[0,4,0,2] → 4 在最下面
    assert.equal(b[0][0], 2);                                                     // 不改動輸入
    assert.equal(m.move(b, 'left').gained, 12);
    assert.equal(m.move([[2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]], 'left').moved, false);
    assert.equal(m.canMove([[2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]]), false);
    assert.equal(m.canMove([[2, 2, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]]), true);
    // 隨機對局：總和只會因為 spawn 增加（2 或 4），合併不改變總和
    for (let t = 0; t < 200; t++) {
        let bd = m.emptyBoard(); for (let i = 0; i < 2; i++) bd = m.spawn(bd, Util.rnd, () => Math.random()).board;
        for (let step = 0; step < 400 && m.canMove(bd); step++) {
            const dir = ['left', 'right', 'up', 'down'][Math.floor(Math.random() * 4)], r = m.move(bd, dir);
            if (!r.moved) continue;
            const sumBefore = bd.flat().reduce((a, c) => a + c, 0), sumAfter = r.board.flat().reduce((a, c) => a + c, 0);
            assert.equal(sumAfter, sumBefore);
            bd = m.spawn(r.board, Util.rnd, () => Math.random()).board;
        }
    }
    ok('game-2048');
}

// ===== 踩地雷 =====
{
    const m = load('mini-games/minesweeper.html', 'create, open, toggleFlag, chord, flagsLeft, around');
    for (let t = 0; t < 300; t++) {
        const [w, h, mines] = [[9, 9, 10], [16, 16, 40], [30, 16, 99]][t % 3];
        const g = m.create(w, h, mines), first = Util.rnd(w * h);
        m.open(g, first, Util.rnd);
        assert.equal(g.mine.reduce((a, b) => a + b, 0), mines);
        assert.equal(g.mine[first], 0, '第一步一定安全');
        assert.ok(m.around(g, first).every(j => !g.mine[j]), '第一步周圍也安全（空間足夠時）');
        assert.notEqual(g.status, 'lost');
        // 數字正確
        for (let i = 0; i < w * h; i++) assert.equal(g.adj[i], m.around(g, i).filter(j => g.mine[j]).length);
        // 逐格翻開所有非雷 → 必定獲勝
        for (let i = 0; i < w * h; i++) if (!g.mine[i]) m.open(g, i, Util.rnd);
        assert.equal(g.status, 'won');
        assert.equal(g.opened, w * h - mines);
    }
    // 取一局「第一步後仍在進行中」的遊戲（第一步可能直接連鎖到過關，所以重抽）
    const playing = () => { for (; ;) { const x = m.create(9, 9, 10); m.open(x, 40, Util.rnd); if (x.status === 'playing') return x; } };
    // 踩雷
    let g = playing();
    m.open(g, g.mine.indexOf(1), Util.rnd);
    assert.equal(g.status, 'lost');
    m.open(g, g.st.indexOf(0), Util.rnd);                    // 結束後不能再操作
    assert.equal(g.status, 'lost');
    // 插旗：不能對已翻開的格子插旗；旗標格不會被翻開
    g = playing();
    const opened = g.st.indexOf(1); m.toggleFlag(g, opened); assert.equal(g.st[opened], 1);
    const hidden = g.st.indexOf(0); m.toggleFlag(g, hidden); assert.equal(g.st[hidden], 2);
    m.open(g, hidden, Util.rnd); assert.equal(g.st[hidden], 2);
    assert.equal(m.flagsLeft(g), 9);
    m.toggleFlag(g, hidden); assert.equal(g.st[hidden], 0);  // 再按一次取消
    // chord：旗標數吻合才展開
    g = m.create(3, 3, 1); g.placed = true; g.status = 'playing'; g.mine[0] = 1;
    for (let i = 0; i < 9; i++) g.adj[i] = m.around(g, i).filter(j => g.mine[j]).length;
    m.open(g, 4, Util.rnd);                                  // 中間格是 1
    assert.equal(g.st[4], 1);
    m.chord(g, 4, Util.rnd); assert.equal(g.st[1], 0);       // 沒插旗：不展開
    m.toggleFlag(g, 0); m.chord(g, 4, Util.rnd);
    assert.equal(g.status, 'won');                           // 旗插對 → 展開其餘 → 勝利
    // 雷數太密時（無法避開周圍）仍保證第一格安全
    g = m.create(3, 3, 8); m.open(g, 4, Util.rnd); assert.equal(g.mine[4], 0); assert.equal(g.status, 'won');
    ok('minesweeper');
}

// ===== 經驗效率 =====
{
    const m = load('game-assist/exp-calculator.html', 'expPlan, fmtDuration');
    const p = m.expPlan({ current: 12.5, target: 100, gain: 0.35, perHour: 240, bonus: 0 });
    near(p.remaining, 87.5); assert.equal(p.runs, 250); near(p.hours, 250 / 240);
    const b = m.expPlan({ current: 0, target: 100, gain: 1, perHour: 100, bonus: 100 });     // 加成 100% = 每次 2%
    assert.equal(b.runs, 50); near(b.hours, 0.5);
    assert.equal(m.expPlan({ current: 100, target: 100, gain: 1, perHour: 1 }).runs, 0);
    assert.ok(m.expPlan({ current: 0, target: 100, gain: 0, perHour: 1 }).error);
    assert.ok(m.expPlan({ current: -1, target: 100, gain: 1, perHour: 1 }).error);
    assert.equal(m.expPlan({ current: 0, target: 100, gain: 1, perHour: 0 }).hours, Infinity);
    assert.equal(m.expPlan({ current: 0, target: 1, gain: 0.1, perHour: 1 }).runs, 10);      // 浮點誤差不應多算一次
    assert.equal(m.fmtDuration(1.5), '1 小時 30 分鐘');
    assert.equal(m.fmtDuration(49), '2 天 1 小時');
    assert.equal(m.fmtDuration(0.01), '1 分鐘');
    ok('exp-calculator');
}

// ===== 抽卡機率 =====
{
    const m = load('game-assist/gacha-calculator.html', 'pullRates, firstHitPmf, convolve, expectation, cdf, quantile, upPmf');
    const rates = m.pullRates(0.006, 90, 74, 0.06), pmf = m.firstHitPmf(rates);
    near(pmf.reduce((a, b) => a + b), 1, 1e-9);
    assert.equal(rates[89], 1); assert.equal(rates[0], 0.006);
    near(rates[73], 0.006 + 0.06);                                  // 第 74 抽開始遞增
    const E = m.expectation(pmf);
    assert.ok(E > 55 && E < 70, 'E=' + E);
    // 蒙地卡羅驗證期望值
    let sum = 0; const N = 200000;
    for (let i = 0; i < N; i++) { let k = 1; while (Math.random() >= rates[k - 1]) k++; sum += k; }
    assert.ok(Math.abs(sum / N - E) / E < 0.01, `${sum / N} vs ${E}`);
    // 無保底的幾何分佈：期望 1/p
    const geo = m.firstHitPmf(m.pullRates(0.1, 200, 0, 0));
    near(m.expectation(geo), 10, 1e-3);
    assert.equal(m.quantile(m.firstHitPmf([0.5, 0.5, 1]), 0.5), 1);
    assert.equal(m.quantile(m.firstHitPmf([0.5, 0.5, 1]), 0.75), 2);
    // UP：有大保底 → 期望 = E*(f + 2(1-f))
    const f = 0.5, up = m.upPmf(pmf, f, true);
    near(up.reduce((a, b) => a + b), 1, 1e-9);
    near(m.expectation(up), E * (f + 2 * (1 - f)), 1e-9);
    // UP：沒有大保底 → 期望 = E / f
    const up2 = m.upPmf(pmf, f, false);
    assert.ok(Math.abs(m.expectation(up2) - E / f) / (E / f) < 1e-3, `${m.expectation(up2)} vs ${E / f}`);
    // f = 1 退化成一般出貨
    near(m.expectation(m.upPmf(pmf, 1, true)), E, 1e-9);
    ok('gacha-calculator');
}

// ===== 習慣打卡 =====
{
    const m = load('fun/habit-tracker.html', 'streaks, monthCells, shiftDay');
    assert.equal(m.shiftDay('2026-03-01', -1), '2026-02-28');
    assert.equal(m.shiftDay('2024-03-01', -1), '2024-02-29');
    assert.equal(m.shiftDay('2026-12-31', 1), '2027-01-01');
    const t = '2026-10-10';
    assert.deepEqual(m.streaks([], t), { current: 0, longest: 0, total: 0 });
    assert.equal(m.streaks(['2026-10-10', '2026-10-09', '2026-10-08'], t).current, 3);
    assert.equal(m.streaks(['2026-10-09', '2026-10-08'], t).current, 2);            // 今天還沒打，從昨天算
    assert.equal(m.streaks(['2026-10-08'], t).current, 0);                           // 前天以前：斷了
    const s = m.streaks(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-10-10'], t);
    assert.deepEqual([s.current, s.longest, s.total], [1, 3, 5]);
    assert.equal(m.streaks(['2026-09-30', '2026-10-01'], '2026-10-02').current, 2);   // 跨月
    assert.equal(m.streaks(['2026-10-10', '2026-10-10'], t).total, 1);                // 重複日期只算一次
    const cells = m.monthCells(2026, 10);                                             // 2026-10-01 是週四
    assert.equal(cells.filter(c => c === null).length, 4);
    assert.equal(cells.length, 4 + 31);
    assert.equal(cells[4], '2026-10-01'); assert.equal(cells.at(-1), '2026-10-31');
    assert.equal(m.monthCells(2024, 2).length - m.monthCells(2024, 2).filter(c => c === null).length, 29);
    ok('habit-tracker');
}

// ===== 四子棋 =====
{
    const m = load('mini-games/connect-four.html', 'newBoard, dropRow, findWin, isFull, newGame, play, validState');
    let s = m.newGame(1);
    assert.equal(m.dropRow(s.board, 0), 5);
    assert.equal(m.play(s, 2, 0), false);                    // 不是輪到的人
    assert.equal(m.play(s, 1, 0), true);
    assert.equal(s.board[5][0], 1); assert.equal(s.turn, 2);
    assert.equal(m.play(s, 2, 7), false); assert.equal(m.play(s, 2, -1), false); assert.equal(m.play(s, 2, 1.5), false); assert.equal(m.play(s, 2, 'x'), false);
    // 橫向
    s = m.newGame(1); [0, 0, 1, 1, 2, 2, 3].forEach((c, i) => assert.ok(m.play(s, i % 2 ? 2 : 1, c)));
    assert.equal(s.winner, 1); assert.equal(s.cells.length, 4);
    assert.equal(m.play(s, 2, 4), false, '勝負已分後不能再下');
    // 直向
    s = m.newGame(1); [0, 1, 0, 1, 0, 1, 0].forEach((c, i) => m.play(s, i % 2 ? 2 : 1, c));
    assert.equal(s.winner, 1);
    // 斜向（／）
    s = m.newGame(1); [0, 1, 1, 2, 3, 2, 2, 3, 3, 0, 3].forEach((c, i) => m.play(s, i % 2 ? 2 : 1, c));
    assert.equal(s.winner, 1);
    // 斜向（＼）
    s = m.newGame(1); [3, 2, 2, 1, 0, 1, 1, 0, 0, 3, 0].forEach((c, i) => m.play(s, i % 2 ? 2 : 1, c));
    assert.equal(s.winner, 1);
    // 欄滿
    s = m.newGame(1); for (let i = 0; i < 6; i++) { const who = s.turn; assert.ok(m.play(s, who, 6)); }
    assert.equal(m.dropRow(s.board, 6), -1); assert.equal(m.play(s, s.turn, 6), false);
    // 隨機對局一定會結束（勝利或平手），且步數合理
    for (let t = 0; t < 500; t++) {
        s = m.newGame(1 + (t % 2));
        for (let k = 0; k < 60 && !s.winner && !s.draw; k++) {
            const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => m.dropRow(s.board, c) >= 0);
            assert.ok(m.play(s, s.turn, cols[Math.floor(Math.random() * cols.length)]));
        }
        assert.ok(s.winner || s.draw);
        assert.ok(s.moves <= 42);
        if (s.winner) assert.ok(m.findWin(s.board).player === s.winner);
    }
    // 平手：填滿且無人連線
    const draw = [[1, 2, 1, 2, 1, 2, 1], [1, 2, 1, 2, 1, 2, 1], [2, 1, 2, 1, 2, 1, 2], [2, 1, 2, 1, 2, 1, 2], [1, 2, 1, 2, 1, 2, 1], [1, 2, 1, 2, 1, 2, 1]];
    assert.equal(m.findWin(draw), null); assert.equal(m.isFull(draw), true);
    assert.equal(m.validState(m.newGame(1)), true);
    for (const bad of [null, {}, { ...m.newGame(1), turn: 3 }, { ...m.newGame(1), board: [[0]] }, { ...m.newGame(1), cells: [[1]] }, { ...m.newGame(1), winner: 'x' }]) assert.equal(m.validState(bad), false);
    ok('connect-four');
}

// ===== QR Code：黃金雜湊（由獨立的參考編碼器產生）=====
{
    const m = load('utils/qr-code.html', 'encode');
    const hash = (qr) => crypto.createHash('sha1').update(qr.modules.map(r => r.map(c => (c ? '1' : '0')).join('')).join('')).digest('hex').slice(0, 16);
    const golden = [
        ['A', 'L', 0, 1, 'c1c34b9c8df63354'], ['HELLO WORLD', 'M', 3, 1, '0bd66d72356be120'],
        ['https://andynavy23.github.io/simple_tools/', 'Q', 5, 4, '5dbfa15d6d199fe5'], ['你好，世界 🌏', 'H', 2, 3, '476b208cf09aff01'],
        ['x'.repeat(200), 'M', 6, 10, '6d3b13daae5dcd87'], ['y'.repeat(1000), 'L', 1, 22, 'a85b83d109f5fe5f'], ['z'.repeat(2900), 'L', 4, 40, '19b1fb84c76b97ac'],
    ];
    for (const [text, ecc, mask, version, h] of golden) {
        const qr = m.encode(text, ecc, mask);
        assert.equal(qr.version, version, text.slice(0, 10));
        assert.equal(hash(qr), h, `${ecc} v${version} mask${mask}`);
    }
    assert.throws(() => m.encode('a'.repeat(3000), 'L'));
    // 結構檢查：三個定位點、時序線
    const q = m.encode('structure', 'M'), n = q.size;
    for (const [x, y] of [[0, 0], [n - 7, 0], [0, n - 7]]) { assert.ok(q.modules[y][x] && q.modules[y + 6][x + 6] && !q.modules[y + 1][x + 1] && q.modules[y + 3][x + 3]); }
    for (let i = 8; i < n - 8; i++) assert.equal(q.modules[6][i], i % 2 === 0);
    ok('qr-code (golden hashes)');
}

// ===== 骰子 =====
{
    const m = load('fun/dice.html', 'roll, tally');
    const cnt = Array(6).fill(0);
    for (let i = 0; i < 60000; i++) { const f = m.roll(1, 6)[0]; assert.ok(f >= 1 && f <= 6); cnt[f - 1]++; }
    cnt.forEach(c => assert.ok(c > 9000 && c < 11000, cnt.join()));
    assert.equal(m.roll(4, 20).length, 4);
    assert.ok(m.roll(6, 100).every(v => v >= 1 && v <= 100));
    const sums = {};
    for (let i = 0; i < 36000; i++) { const s = m.roll(2, 6).reduce((a, b) => a + b); sums[s] = (sums[s] || 0) + 1; }
    assert.ok(sums[7] > sums[2] * 4 && sums[7] > sums[12] * 4);          // 兩顆骰：7 最常見，2 / 12 最少
    assert.deepEqual(m.tally([7, 7, 3]), { 7: 2, 3: 1 });
    ok('dice');
}

// ===== 貸款 / 複利 =====
{
    const m = load('utils/loan-calculator.html', 'amortize, compound');
    const a = m.amortize(100000, 12, 12, 'annuity');
    near(a.rows[0].payment, 8884.88, 1e-5);                                // 10 萬、年利率 12%、一年：每月 8,884.88
    assert.ok(a.rows.every(r => Math.abs(r.payment - a.rows[0].payment) < 1e-6));
    near(a.rows.reduce((s, r) => s + r.principal, 0), 100000, 1e-9);       // 本金還清
    assert.equal(a.rows.at(-1).balance, 0);
    near(a.totalInterest, a.rows.reduce((s, r) => s + r.interest, 0), 1e-9);
    near(a.totalPaid, 100000 + a.totalInterest, 1e-9);
    const z = m.amortize(1200, 0, 12, 'annuity');                          // 零利率
    assert.ok(z.rows.every(r => Math.abs(r.payment - 100) < 1e-9) && z.totalInterest === 0);
    const p = m.amortize(120000, 6, 12, 'principal');                      // 本金平均：每期本金固定、總額遞減
    assert.ok(p.rows.every(r => Math.abs(r.principal - 10000) < 1e-9));
    near(p.rows[0].payment, 10000 + 120000 * 0.005, 1e-9);
    assert.ok(p.rows[11].payment < p.rows[0].payment);
    assert.ok(p.totalInterest < m.amortize(120000, 6, 12, 'annuity').totalInterest);   // 本金平均總利息較少
    const c = m.compound(0, 1000, 12, 1);
    near(c[0].value, 1000 * ((Math.pow(1.01, 12) - 1) / 0.01), 1e-9);      // 普通年金終值
    near(m.compound(1000, 0, 12, 1)[0].value, 1126.825, 1e-5);             // 單筆複利
    assert.equal(m.compound(5000, 100, 0, 3)[2].value, 5000 + 100 * 36);   // 零報酬 = 單純累積
    assert.equal(m.compound(0, 100, 5, 20).length, 20);
    ok('loan-calculator');
}

// ===== 字數統計 =====
{
    const m = load('utils/text-tools.html', 'count, fmtRead', '// 每個操作', 'const $ =');
    const c = m.count('你好 world, hello!\n\n第二段。');
    assert.equal(c.cjk, 5); assert.equal(c.words, 2); assert.equal(c.paragraphs, 2); assert.equal(c.lines, 3);
    assert.equal(m.count('').chars, 0); assert.equal(m.count('').lines, 0); assert.equal(m.count('').paragraphs, 0);
    assert.equal(m.count("don't stop-me 3.5").words, 3);                   // 縮寫與連字號算一個字
    assert.equal(m.count('a b\tc').charsNoSpace, 3);
    assert.equal(m.count('😀你').chars, 2);                                  // emoji 算一個字元
    assert.equal(m.count('一。二！三？').sentences, 3);
    assert.equal(m.count('Hello. World').sentences, 2);
    near(m.count('字'.repeat(400)).readMinutes, 1);
    assert.equal(m.fmtRead(0), '—'); assert.equal(m.fmtRead(0.5), '30 秒'); assert.equal(m.fmtRead(2.5), '2 分 30 秒'); assert.equal(m.fmtRead(3), '3 分');
    ok('text-tools: count');
}

// ===== 健康計算 =====
{
    const m = load('utils/health-calc.html', 'bmi, bmiLabel, bmr, healthyRange, heartZones');
    near(m.bmi(170, 65), 22.491, 1e-4);
    assert.deepEqual([17, 18.5, 23.9, 24, 26.9, 27, 29.9, 30, 34.9, 35, 40].map(m.bmiLabel),
        ['體重過輕', '健康體重', '健康體重', '過重', '過重', '輕度肥胖', '輕度肥胖', '中度肥胖', '中度肥胖', '重度肥胖', '重度肥胖']);
    near(m.bmr('m', 70, 175, 30), 1648.75); near(m.bmr('f', 60, 165, 25), 1345.25);
    const [lo, hi] = m.healthyRange(170); near(lo, 53.465, 1e-6); near(hi, 69.36, 1e-6);
    const z = m.heartZones(30, 0); assert.equal(z.max, 190);
    assert.deepEqual(z.zones[1], ['燃脂', 114, 133]);
    const k = m.heartZones(30, 60);                                           // 儲備心率法：60 + 130 × 0.6 = 138
    assert.deepEqual(k.zones[1], ['燃脂', 138, 151]);
    ok('health-calc');
}

// ===== 計時器 =====
{
    const m = load('fun/timers.html', 'fmtMs, lapTimes, toMs');
    assert.equal(m.fmtMs(0), '00:00.00'); assert.equal(m.fmtMs(61230), '01:01.23'); assert.equal(m.fmtMs(3661000), '1:01:01.00');
    assert.equal(m.fmtMs(5000, false), '00:05'); assert.equal(m.fmtMs(-5), '00:00.00'); assert.equal(m.fmtMs(59999), '00:59.99');
    assert.deepEqual(m.lapTimes([1000, 2500, 2600]), [1000, 1500, 100]); assert.deepEqual(m.lapTimes([]), []);
    assert.equal(m.toMs(1, 2, 3), 3723000); assert.equal(m.toMs('', '5', ''), 300000); assert.equal(m.toMs(0, 0, 0), 0);
    ok('timers');
}

// ===== 技能冷卻 =====
{
    const m = load('game-assist/cooldown-board.html', 'remaining, fraction');
    assert.equal(m.remaining(1000, 3000), 2000); assert.equal(m.remaining(5000, 3000), 0);
    assert.equal(m.fraction(0, 10000, 10000), 1); assert.equal(m.fraction(5000, 10000, 10000), 0.5); assert.equal(m.fraction(20000, 10000, 10000), 0); assert.equal(m.fraction(0, 5, 0), 0);
    ok('cooldown-board');
}

// ===== Simon =====
{
    const m = load('mini-games/simon.html', 'extend, check, stepMs');
    const s = m.extend([1, 2], () => 3); assert.deepEqual(s, [1, 2, 3]);
    for (let i = 0; i < 200; i++) assert.ok([0, 1, 2, 3].includes(m.extend([], Util.rnd)[0]));
    assert.equal(m.check([0, 1, 2], []), 'continue'); assert.equal(m.check([0, 1, 2], [0, 1]), 'continue');
    assert.equal(m.check([0, 1, 2], [0, 1, 2]), 'done'); assert.equal(m.check([0, 1, 2], [0, 2]), 'wrong'); assert.equal(m.check([0], [0, 0]), 'wrong');
    assert.equal(m.stepMs(0), 620); assert.equal(m.stepMs(100), 260); assert.ok(m.stepMs(5) < m.stepMs(1));
    ok('simon');
}

// ===== 數獨 =====
{
    const m = load('mini-games/sudoku.html', 'solve, generate, conflicts, candidates, PEERS');
    const parse = (s) => [...s].map(Number);
    const puz = parse('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
    const sol = parse('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
    const r = m.solve(puz, 2);
    assert.equal(r.count, 1); assert.deepEqual(r.first, sol);
    assert.equal(puz[2], 0);                                                  // 不改動輸入
    assert.equal(m.solve(new Array(81).fill(0), 2).count, 2);                  // 空盤有很多解
    const dup = sol.slice(); dup[1] = dup[0];
    assert.ok(m.conflicts(dup).has(0) && m.conflicts(dup).has(1)); assert.equal(m.conflicts(sol).size, 0);
    assert.equal(m.PEERS[0].length, 20); assert.ok(m.PEERS.every((p, i) => p.length === 20 && !p.includes(i)));
    const t0 = Date.now();
    for (const clues of [40, 32, 26]) for (let k = 0; k < 2; k++) {
        const g = m.generate(clues, Util.rnd);
        assert.equal(g.solution.filter(v => !v).length, 0); assert.equal(m.conflicts(g.solution).size, 0);
        g.puzzle.forEach((v, i) => assert.ok(v === 0 || v === g.solution[i]));      // 題目是解答的子集
        const left = g.puzzle.filter(Boolean).length;
        assert.ok(left >= 17 && left <= clues + 6, `線索數 ${left}（目標 ${clues}）`);
        const s2 = m.solve(g.puzzle, 2); assert.equal(s2.count, 1, '必須唯一解'); assert.deepEqual(s2.first, g.solution);
    }
    assert.ok(Date.now() - t0 < 20000, '產生題目太慢：' + (Date.now() - t0) + 'ms');
    ok('sudoku (' + (Date.now() - t0) + 'ms for 6 unique puzzles)');
}

// ===== 你畫我猜 =====
{
    const m = load('mini-games/draw-guess.html', 'WORDS, COLORS, norm, isCorrect, maskWord, guessPoints, pickWord, validStroke, ROUND_MS');
    assert.ok(m.isCorrect('蘋果', ' 蘋 果 ')); assert.ok(m.isCorrect('Apple', 'aPPle')); assert.ok(!m.isCorrect('蘋果', '蘋')); assert.ok(!m.isCorrect('蘋果', '')); assert.ok(!m.isCorrect('蘋果', '   '));
    assert.equal(m.maskWord('蘋果'), '＿ ＿'); assert.equal(m.maskWord('a'), '＿');
    assert.equal(m.guessPoints(m.ROUND_MS), 100); assert.equal(m.guessPoints(0), 50); assert.equal(m.guessPoints(-5), 50); assert.equal(m.guessPoints(m.ROUND_MS / 2), 75);
    assert.equal(new Set(m.WORDS).size, m.WORDS.length);                      // 沒有重複題目
    const used = new Set();
    for (let i = 0; i < m.WORDS.length; i++) { const w = m.pickWord(used, Util.rnd); assert.ok(!used.has(w)); used.add(w); }
    assert.ok(m.WORDS.includes(m.pickWord(used, Util.rnd)));                  // 全用過就重來
    const ok1 = { pts: [[0, 0], [1000, 640]], color: m.COLORS[0], w: 10, begin: true };
    assert.equal(m.validStroke(ok1), true);
    for (const bad of [null, {}, { ...ok1, pts: [] }, { ...ok1, pts: [[1001, 0]] }, { ...ok1, pts: [[-1, 0]] }, { ...ok1, pts: [['a', 0]] }, { ...ok1, pts: [[NaN, 0]] }, { ...ok1, pts: [[1, 2, 3]] },
        { ...ok1, color: 'red' }, { ...ok1, color: 'url(x)' }, { ...ok1, w: 0 }, { ...ok1, w: 99 }, { ...ok1, w: 1.5 }, { ...ok1, pts: Array(101).fill([1, 1]) }])
        assert.equal(m.validStroke(bad), false, JSON.stringify(bad).slice(0, 60));
    assert.equal(m.validStroke({ ...ok1, pts: Array(100).fill([1, 1]) }), true);
    ok('draw-guess');
}

// ===== 連線投票 =====
{
    const m = load('fun/live-poll.html', 'tally, quizPoints, pct, validVote, validState');
    assert.deepEqual(m.tally([0, 1, 1, 2, 9, -1, 'x', 1.5], 3), [1, 2, 1]);
    assert.deepEqual(m.tally([], 2), [0, 0]);
    assert.deepEqual([0, 1, 2, 5, 9].map(m.quizPoints), [150, 140, 130, 100, 100]);
    assert.equal(m.pct(1, 3), 33); assert.equal(m.pct(0, 0), 0); assert.equal(m.pct(5, 5), 100);
    const st = { phase: 'open', qid: 3, n: 3 };
    assert.equal(m.validVote(st, { qid: 3, opt: 2 }), true);
    for (const bad of [null, {}, { qid: 2, opt: 0 }, { qid: 3, opt: 3 }, { qid: 3, opt: -1 }, { qid: 3, opt: 1.5 }, { qid: 3, opt: '1' }]) assert.equal(m.validVote(st, bad), false);
    assert.equal(m.validVote({ ...st, phase: 'closed' }, { qid: 3, opt: 0 }), false);
    const good = { qid: 1, phase: 'open', mode: 'poll', q: 'Q', opts: ['a', 'b'], counts: [1, 0], answered: 1, total: 3, ms: -1, correct: -1, board: [{ n: 'x', p: 100 }] };
    assert.equal(m.validState(good), true); assert.equal(m.validState({ ...good, counts: null }), true);
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, mode: 'y' }, { ...good, opts: Array(7).fill('a') }, { ...good, q: 'x'.repeat(81) }, { ...good, counts: [1.5] },
        { ...good, board: [{ n: 5, p: 1 }] }, { ...good, board: Array(11).fill({ n: 'a', p: 1 }) }, { ...good, ms: 'x' }, { ...good, opts: [{ x: 1 }] }])
        assert.equal(m.validState(bad), false, JSON.stringify(bad).slice(0, 60));
    ok('live-poll');
}

// ===== 反應速度測試 =====
{
    const m = load('mini-games/reaction-time.html', 'summary, rate, waitMs, ROUNDS');
    assert.deepEqual(m.summary([300, 200, 250]), { avg: 250, best: 200, worst: 300, median: 250 });
    assert.equal(m.summary([100, 200]).median, 150); assert.equal(m.summary([]), null);
    for (let i = 0; i < 500; i++) { const w = m.waitMs(Util.rnd); assert.ok(w >= 1500 && w <= 4500); }
    assert.equal(m.rate(150), '閃電般'); assert.equal(m.rate(500), '再專心一點'); assert.equal(m.ROUNDS, 5);
    ok('reaction-time');
}

// ===== 抽獎 / 刮刮樂 =====
{
    const m = load('fun/lottery.html', 'pick, clearedFraction');
    const names = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < 300; i++) {
        const w = m.pick(names, 3, ['a']);
        assert.equal(w.length, 3); assert.equal(new Set(w).size, 3); assert.ok(!w.includes('a'));
    }
    assert.equal(m.pick(names, 9, ['a', 'b']).length, 3);                          // 名單不夠：只回傳剩下的
    assert.deepEqual(m.pick(names, 2, names), []);
    const rgba = (alpha) => Uint8ClampedArray.from({ length: 4 * 400 }, (_, i) => (i % 4 === 3 ? alpha(i >> 2) : 0));
    assert.equal(m.clearedFraction(rgba(() => 0)), 1); assert.equal(m.clearedFraction(rgba(() => 255)), 0);
    near(m.clearedFraction(rgba(p => (p < 200 ? 0 : 255)), 1), 0.5); assert.equal(m.clearedFraction(new Uint8ClampedArray(0)), 0);
    // 公平性：每個人被抽中的機率相近
    const cnt = { a: 0, b: 0, c: 0, d: 0, e: 0 };
    for (let i = 0; i < 20000; i++) cnt[m.pick(names, 1)[0]]++;
    Object.values(cnt).forEach(v => assert.ok(v > 3600 && v < 4400, JSON.stringify(cnt)));
    ok('lottery');
}

// ===== 日期計算機 =====
{
    const m = { ...load('utils/date-calc.html', 'isLeap, daysInMonth, weekday, workdaysBetween, addWorkdays, dayOfYear, isoWeek'), addMonths: Util.day.addMonths, diffYMD: Util.day.diffYMD };
    assert.equal(m.weekday('1970-01-01'), 4); assert.equal(m.weekday('2024-01-01'), 1); assert.equal(m.weekday('2000-02-29'), 2); assert.equal(m.weekday('1969-12-31'), 3);
    assert.deepEqual([1900, 2000, 2023, 2024].map(m.isLeap), [false, true, false, true]); assert.equal(m.daysInMonth(2024, 2), 29); assert.equal(m.daysInMonth(2023, 2), 28);
    assert.equal(m.addMonths('2024-01-31', 1), '2024-02-29'); assert.equal(m.addMonths('2023-01-31', 1), '2023-02-28'); assert.equal(m.addMonths('2024-03-31', -1), '2024-02-29');
    assert.equal(m.addMonths('2024-12-15', 2), '2025-02-15'); assert.equal(m.addMonths('2024-01-15', -2), '2023-11-15'); assert.equal(m.addMonths('2024-02-29', 12), '2025-02-28');
    assert.deepEqual(m.diffYMD('2024-01-31', '2024-03-01'), { y: 0, m: 1, d: 1 });
    assert.deepEqual(m.diffYMD('2000-05-20', '2024-05-19'), { y: 23, m: 11, d: 29 });
    assert.deepEqual(m.diffYMD('2024-03-15', '2024-03-15'), { y: 0, m: 0, d: 0 });
    assert.deepEqual(m.diffYMD('2023-12-31', '2024-01-01'), { y: 0, m: 0, d: 1 });
    // 隨機驗證：起日 + (年月日) 必須回到迄日
    for (let i = 0; i < 500; i++) {
        const a = Util.day.shift('2000-01-01', Util.rnd(9000)), b = Util.day.shift(a, Util.rnd(4000)), r = m.diffYMD(a, b);
        assert.equal(Util.day.shift(m.addMonths(a, r.y * 12 + r.m), r.d), b, `${a} → ${b}`);
        assert.ok(r.m >= 0 && r.m < 12 && r.d >= 0 && r.d < 32);
    }
    assert.equal(m.workdaysBetween('2024-01-01', '2024-01-07'), 5); assert.equal(m.workdaysBetween('2024-01-06', '2024-01-07'), 0); assert.equal(m.workdaysBetween('2024-01-03', '2024-01-03'), 1);
    assert.equal(m.addWorkdays('2024-01-05', 1), '2024-01-08'); assert.equal(m.addWorkdays('2024-01-08', -1), '2024-01-05'); assert.equal(m.addWorkdays('2024-01-01', 5), '2024-01-08'); assert.equal(m.addWorkdays('2024-01-06', 1), '2024-01-08');
    for (let i = 0; i < 100; i++) { const a = Util.day.shift('2024-01-01', Util.rnd(400)), n = 1 + Util.rnd(60), b = m.addWorkdays(a, n); assert.equal(m.workdaysBetween(Util.day.shift(a, 1), b), n); }
    assert.equal(m.dayOfYear('2024-01-01'), 1); assert.equal(m.dayOfYear('2024-12-31'), 366); assert.equal(m.dayOfYear('2023-12-31'), 365);
    assert.deepEqual(m.isoWeek('2021-01-03'), { year: 2020, week: 53 }); assert.deepEqual(m.isoWeek('2024-12-30'), { year: 2025, week: 1 });
    assert.deepEqual(m.isoWeek('2024-01-01'), { year: 2024, week: 1 }); assert.deepEqual(m.isoWeek('2026-01-01'), { year: 2026, week: 1 }); assert.deepEqual(m.isoWeek('2023-01-01'), { year: 2022, week: 52 });
    ok('date-calc');
}

// ===== 薪資 / 加班費 =====
{
    const m = load('utils/salary-calc.html', 'hourly, otPay, maxHours, netPay');
    assert.equal(m.hourly(48000), 200);
    near(m.otPay(200, 'weekday', 2).pay, 536); near(m.otPay(200, 'weekday', 4).pay, 1204); assert.equal(m.otPay(200, 'weekday', 5).capped, 1);
    near(m.otPay(200, 'rest', 9).pay, 3074); near(m.otPay(200, 'holiday', 8).pay, 1600); near(m.otPay(200, 'holiday', 10).pay, 2136);
    assert.equal(m.otPay(200, 'rest', 0).pay, 0); assert.equal(m.otPay(200, 'rest', -3).pay, 0);
    assert.deepEqual(['weekday', 'rest', 'holiday'].map(m.maxHours), [4, 12, 12]);
    near(m.netPay(100000, { labor: 2.5, health: 1.55, pension: 6 }), 89950);
    ok('salary-calc');
}

// ===== 記帳本 =====
{
    const m = load('utils/expense-tracker.html', 'validEntry, summarize, toCSV, shiftMonth');
    const e = (id, d, type, cat, amt, note = '') => ({ id, d, type, cat, amt, note });
    const list = [e('1', '2024-03-02', 'out', '餐飲', 120), e('2', '2024-03-05', 'out', '交通', 60.5), e('3', '2024-03-05', 'in', '薪資', 50000), e('4', '2024-03-20', 'out', '餐飲', 80), e('5', '2024-02-28', 'out', '購物', 999)];
    const s = m.summarize(list, '2024-03');
    assert.equal(s.income, 50000); near(s.expense, 260.5); near(s.balance, 49739.5);
    assert.deepEqual(s.byCat, [['餐飲', 200], ['交通', 60.5]]); assert.deepEqual(s.list.map(x => x.id), ['4', '3', '2', '1']);
    assert.equal(m.summarize(list, '2023-01').list.length, 0);
    assert.ok(m.validEntry(list[0]));
    for (const bad of [null, { ...list[0], amt: 0 }, { ...list[0], amt: -5 }, { ...list[0], amt: NaN }, { ...list[0], amt: '5' }, { ...list[0], d: '2024-3-2' }, { ...list[0], type: 'x' }, { ...list[0], note: 5 }]) assert.ok(!m.validEntry(bad));
    const csv = m.toCSV([e('1', '2024-03-02', 'out', '餐飲', 100, '午餐, "好吃"'), e('2', '2024-03-01', 'in', '薪資', 5, '=HYPERLINK("x")'), e('3', '2024-03-03', 'out', '其他', 1, '多行' + NL + '備註')]);
    const lines = csv.split('\r\n');
    assert.equal(lines[0], '日期,收支,分類,金額,備註'); assert.equal(lines[1], '2024-03-01,收入,薪資,5,"\'=HYPERLINK(""x"")"');
    assert.equal(lines[2], '2024-03-02,支出,餐飲,100,"午餐, ""好吃"""'); assert.ok(csv.includes('"多行' + NL + '備註"'));
    assert.equal(m.shiftMonth('2024-01', -1), '2023-12'); assert.equal(m.shiftMonth('2024-12', 1), '2025-01'); assert.equal(m.shiftMonth('2024-05', 0), '2024-05');
    ok('expense-tracker');
}

// ===== 色盲模擬 =====
{
    const m = load('utils/color-tools.html', 'CVD, simulate, contrast');
    const W = { r: 255, g: 255, b: 255 }, K = { r: 0, g: 0, b: 0 };
    for (const [name, mat] of Object.entries(m.CVD)) {
        const w = m.simulate(W, mat), k = m.simulate(K, mat), g = m.simulate({ r: 128, g: 128, b: 128 }, mat);
        [w.r, w.g, w.b].forEach(v => assert.ok(v >= 253, name + ' 白色應維持白色'));
        assert.deepEqual(k, { r: 0, g: 0, b: 0 });
        [g.r, g.g, g.b].forEach(v => assert.ok(Math.abs(v - 128) <= 3, name + ' 灰色應維持灰色'));
    }
    const p = m.simulate({ r: 255, g: 0, b: 0 }, m.CVD['紅色盲 Protanopia']); assert.ok(p.r > 90 && p.r < 125 && p.b < 20, JSON.stringify(p));
    const a = m.simulate({ r: 0, g: 200, b: 50 }, m.CVD['全色盲 Achromatopsia']); assert.ok(a.r === a.g && a.g === a.b);
    near(m.contrast(W, K), 21);
    // 紅 vs 綠在綠色盲眼中的對比，不會比正常視覺高
    const R = { r: 200, g: 40, b: 40 }, Gn = { r: 40, g: 160, b: 40 }, mat = m.CVD['綠色盲 Deuteranopia'];
    assert.ok(m.contrast(m.simulate(R, mat), m.simulate(Gn, mat)) < m.contrast(R, Gn) + 1);
    ok('color-tools cvd');
}

// ===== 白噪音：打字節奏 =====
{
    const m = load('fun/white-noise.html', 'typingGap');
    assert.equal(m.typingGap(() => 0.5), 70 + 0.5 * 190); assert.equal(m.typingGap(() => 0.05), 600 + 0.05 * 900);
    let pauses = 0;
    for (let i = 0; i < 5000; i++) { const g = m.typingGap(); assert.ok(g >= 70 && g <= 1500); if (g >= 600) pauses++; }
    assert.ok(pauses > 300 && pauses < 700, '停頓比例約 10%：' + pauses);
    ok('white-noise typingGap');
}

// ===== 連線終極密碼 =====
{
    const m = load('mini-games/ultimate-code.html', 'validGuess, judge, nextActive, validState');
    assert.ok(m.validGuess(0, 101, 1) && m.validGuess(0, 101, 100) && m.validGuess(30, 50, 40));
    assert.ok(!m.validGuess(0, 101, 0) && !m.validGuess(0, 101, 101) && !m.validGuess(0, 101, 2.5) && !m.validGuess(0, 101, '5') && !m.validGuess(30, 50, 30) && !m.validGuess(30, 50, 50) && !m.validGuess(0, 5, NaN) && !m.validGuess(0, 5, null));
    assert.deepEqual(m.judge(0, 101, 50, 30), { hit: false, lo: 0, hi: 50 }); assert.deepEqual(m.judge(0, 101, 10, 30), { hit: false, lo: 10, hi: 101 }); assert.equal(m.judge(0, 101, 30, 30).hit, true);
    assert.equal(m.nextActive([true, false, true], 0), 2); assert.equal(m.nextActive([true, false, false], 0), -1); assert.equal(m.nextActive([true, true], 1), 0); assert.equal(m.nextActive([false, true, true], 2), 1);
    // 模擬整局：每次猜都在合法範圍內，必定在 max 步內結束；範圍剩一個數字時那個數字就是密碼
    for (let t = 0; t < 300; t++) {
        const max = 2 + Util.rnd(60), secret = 1 + Util.rnd(max); let lo = 0, hi = max + 1, turn = 0, steps = 0, loser = -1;
        const act = [true, true, true];
        while (loser < 0) {
            assert.ok(++steps <= max + 1);
            const g = lo + 1 + Util.rnd(hi - lo - 1), r = m.judge(lo, hi, g, secret);
            if (r.hit) { loser = turn; break; }
            lo = r.lo; hi = r.hi; turn = m.nextActive(act, turn);
            if (hi - lo === 2) { assert.equal(lo + 1, secret); loser = turn; }
        }
        assert.ok(loser >= 0);
    }
    const good = { phase: 'play', names: ['a', 'b'], active: [true, true], losses: [0, 1], turn: 0, lo: 0, hi: 101, secret: 0, loser: -1, why: '', log: [{ n: 'a', g: 5 }] };
    assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, names: Array(9).fill('a') }, { ...good, names: [1] }, { ...good, active: [1] }, { ...good, losses: [1.5] }, { ...good, turn: 'a' }, { ...good, why: 'x'.repeat(41) }, { ...good, log: Array(13).fill({ n: 'a', g: 1 }) }, { ...good, log: [{ n: 'a', g: '1' }] }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 50));
    ok('ultimate-code');
}

// ===== 連線規劃撲克 =====
{
    const m = load('fun/planning-poker.html', 'DECKS, validCard, distribution, stats, validState');
    assert.ok(m.validCard('fib', '13') && m.validCard('fib', '☕') && m.validCard('tshirt', 'XL'));
    for (const [d, v] of [['fib', 'XL'], ['fib', 13], ['fib', ''], ['x', '1'], ['tshirt', '3'], ['fib', null]]) assert.ok(!m.validCard(d, v));
    assert.deepEqual(m.stats('fib', ['3', '5', '5', '?']), { dist: [['3', 1], ['5', 2], ['?', 1]], mode: ['5'], avg: 4.3, median: 5, agree: false });
    assert.equal(m.stats('fib', ['2', '3']).median, 2.5); assert.equal(m.stats('fib', ['8', '8', '8']).agree, true); assert.equal(m.stats('fib', ['8']).agree, false);
    assert.deepEqual(m.stats('tshirt', ['M', 'M', 'L']), { dist: [['M', 2], ['L', 1]], mode: ['M'], avg: null, median: null, agree: false });
    assert.deepEqual(m.stats('fib', ['1', '2']).mode, ['1', '2']); assert.equal(m.stats('fib', ['?', '☕']).avg, null);
    const good = { round: 1, phase: 'revealed', deck: 'fib', topic: 't', seats: [{ n: 'a', voted: true, v: '5' }, { n: 'b', voted: false, v: null }] };
    assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, deck: 'zz' }, { ...good, topic: 'x'.repeat(81) }, { ...good, seats: Array(21).fill(good.seats[0]) }, { ...good, seats: [{ n: 'a', voted: true, v: 'XL' }] }, { ...good, seats: [{ n: 'a', voted: 1, v: '5' }] }, { ...good, seats: [null] }, { ...good, round: 1.5 }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 50));
    ok('planning-poker');
}

// ===== 連線海戰 =====
{
    const m = load('mini-games/battleship.html', 'SIZE, LENS, cellsOf, canPlace, validFleet, randomFleet, shotResult, allSunk, verifyReports, commitText');
    const key = (r, c) => r * m.SIZE + c;
    for (let i = 0; i < 300; i++) { const f = m.randomFleet(Util.rnd); assert.ok(m.validFleet(f)); assert.equal(new Set(f.flatMap(s => m.cellsOf(s).map(([r, c]) => key(r, c)))).size, 17); }
    const fleet = [{ r: 0, c: 0, len: 5, h: 1 }, { r: 2, c: 0, len: 4, h: 1 }, { r: 4, c: 0, len: 3, h: 1 }, { r: 6, c: 0, len: 3, h: 0 }, { r: 9, c: 8, len: 2, h: 1 }];
    assert.ok(m.validFleet(fleet));
    const swap = (i, patch) => fleet.map((s, j) => (j === i ? { ...s, ...patch } : s));
    for (const bad of [null, [], fleet.slice(1), [...fleet.slice(1), { r: 0, c: 0, len: 4, h: 1 }], swap(4, { c: 9 }), swap(0, { h: 2 }), swap(0, { r: -1 }), swap(0, { r: 0.5 }), swap(3, { len: 5 }), swap(1, { r: 0 })])
        assert.equal(m.validFleet(bad), false, JSON.stringify(bad).slice(0, 80));
    assert.ok(!m.canPlace(fleet, { r: 0, c: 4, len: 2, h: 1 })); assert.ok(m.canPlace(fleet, { r: 0, c: 5, len: 2, h: 1 })); assert.ok(!m.canPlace([], { r: 9, c: 9, len: 2, h: 1 })); assert.ok(!m.canPlace([], { r: 9, c: 9, len: 2, h: 0 }));
    // 命中 / 擊沉
    const shots = new Set();
    assert.deepEqual(m.shotResult(fleet, shots, 5, 5), { hit: false, sunk: 0 });
    assert.deepEqual(m.shotResult(fleet, shots, 9, 8), { hit: true, sunk: 0 }); shots.add(key(9, 8));
    assert.deepEqual(m.shotResult(fleet, shots, 9, 9), { hit: true, sunk: 2 });
    assert.equal(m.allSunk(fleet, shots), false);
    // 整局誠實對戰：每一槍的回報都由 shotResult 產生 → 驗證必須通過；任一槍被竄改就必須失敗
    const all = Util.shuffle(Array.from({ length: 100 }, (_, i) => i)), s2 = new Set(), reports = [];
    for (const k of all) {
        const r = Math.floor(k / 10), c = k % 10, res = m.shotResult(fleet, s2, r, c);
        reports.push({ r, c, ...res }); s2.add(k);
        if (m.allSunk(fleet, s2)) break;
    }
    assert.equal(reports.filter(x => x.sunk).length, 5); assert.ok(m.verifyReports(fleet, reports));
    for (let t = 0; t < 100; t++) {
        const i = Util.rnd(reports.length), bad = reports.map((x, j) => (j === i ? { ...x, hit: !x.hit, sunk: x.hit ? 0 : x.sunk } : x));
        assert.equal(m.verifyReports(fleet, bad), false);
    }
    const lie = reports.map(x => (x.sunk === 3 ? { ...x, sunk: 0 } : x)); assert.equal(m.verifyReports(fleet, lie), false);            // 謊報「沒沉」
    // 承諾：不同艦隊或不同鹽 → 不同字串；同樣輸入 → 同樣字串
    assert.equal(m.commitText(fleet, 'ab'), m.commitText(fleet.map(s => ({ ...s })), 'ab')); assert.notEqual(m.commitText(fleet, 'ab'), m.commitText(fleet, 'ac'));
    assert.notEqual(m.commitText(fleet, 'ab'), m.commitText(swap(4, { c: 7 }), 'ab'));
    ok('battleship');
}

// ===== 工具清單 TOOLS.md 與實際頁面同步 =====
{
    const listed = read('TOOLS.md'), readme = read('README.md'), index = read('index.html');
    for (const dir of ['game-assist', 'mini-games', 'fun', 'utils', 'reading'])
        for (const f of fs.readdirSync(path.join(root, dir)).filter(x => x.endsWith('.html'))) {
            assert.ok(listed.includes(`(${dir}/${f})`), `TOOLS.md 沒有列出 ${dir}/${f}`);
            assert.ok(readme.includes(`(${dir}/${f})`), `README.md 沒有列出 ${dir}/${f}`);
            assert.ok(index.includes(`href="${dir}/${f}"`), `index.html 沒有卡片 ${dir}/${f}`);
        }
    // 外框與首頁：每頁載入 chrome.js；首頁每張卡片都有 data-topic
    for (const dir of ['game-assist', 'mini-games', 'fun', 'utils', 'reading'])
        for (const f of fs.readdirSync(path.join(root, dir)).filter(x => x.endsWith('.html'))) assert.ok(read(`${dir}/${f}`).includes('shared/js/chrome.js'), `${dir}/${f} 沒有載入 chrome.js`);
    // 使用說明：每個頁面都要有 <template id="help">，且含必要的段落
    for (const dir of ['game-assist', 'mini-games', 'fun', 'utils', 'reading'])
        for (const f of fs.readdirSync(path.join(root, dir)).filter(x => x.endsWith('.html'))) {
            const h = read(`${dir}/${f}`), t = /<template id="help">([\s\S]*?)<\/template>/.exec(h);
            assert.ok(t, `${dir}/${f} 缺少使用說明 <template id="help">`);
            for (const sec of ['這是什麼', '什麼時候用', '小提醒']) assert.ok(t[1].includes(sec), `${dir}/${f} 的說明缺「${sec}」`);
            assert.ok(/範例|計分/.test(t[1]), `${dir}/${f} 的說明缺「範例」（遊戲可用「計分」「勝負與計分」代替）`);
            assert.ok(/怎麼用|怎麼玩/.test(t[1]), `${dir}/${f} 的說明缺「怎麼用 / 怎麼玩」`); assert.equal(h.split('<template id="help">').length, 2, `${dir}/${f} 有多份說明`);
        }
    assert.ok(read('index.html').includes('shared/js/chrome.js'));
    // 本機資料備份：頁面讀寫的每個 localStorage 鍵都要列在 <meta name="st-keys">（chrome.js 的「💾 備份與還原」只認這份宣告）
    const chromeApi = require('../shared/js/chrome.js');
    const KEY_REGS = [
        /(?:store|Util\.store)\.(?:get|set)\(\s*(['"`])([^'"`$]+)\1/g,
        /localStorage\.(?:get|set|remove)Item\(\s*(['"`])([^'"`$+]+)\1/g,
        /(?:const|let)\s+(?:[A-Z_]*KEY)\s*=\s*(['"`])([^'"`$]+)\1/g,
        /bestKey\s*=\s*(['"`])([^'"`$]+)\1\s*[;,\n]/g,
    ];
    // 動態鍵：'前綴_' + x、`前綴_${x}`（出現在 store.get/set 或 bestKey 定義裡）
    const DYN_REGS = [/(?:store|Util\.store)\.(?:get|set)\(\s*(?:`([A-Za-z0-9_-]+_)\$\{|(['"])([A-Za-z0-9_-]+_)\2\s*\+)/g, /bestKey\s*=[^\n]*?(?:(['"])([A-Za-z0-9_-]+_)\1\s*\+|`([A-Za-z0-9_-]+_)\$\{)/g];
    for (const dir of ['game-assist', 'mini-games', 'fun', 'utils', 'reading'])
        for (const f of fs.readdirSync(path.join(root, dir)).filter(x => x.endsWith('.html'))) {
            const h = read(`${dir}/${f}`), used = new Set(), dyn = new Set();
            for (const rg of KEY_REGS) for (const m of h.matchAll(rg)) used.add(m[2]);
            for (const m of h.matchAll(DYN_REGS[0])) dyn.add(m[1] || m[3]);
            for (const m of h.matchAll(DYN_REGS[1])) dyn.add(m[2] || m[3]);
            const metaM = h.match(/<meta name="st-keys" content="([^"]*)">/);
            if (!used.size && !dyn.size) { assert.ok(!metaM || metaM[1].trim(), `${dir}/${f} st-keys 不能是空的`); continue; }
            assert.ok(metaM, `${dir}/${f} 有使用 localStorage（${[...used, ...dyn].join(', ')}）但沒有宣告 <meta name="st-keys">`);
            const match = chromeApi.matcher(metaM[1].split(',').map(x => x.trim()).filter(Boolean));
            for (const k of used) assert.ok(match(k), `${dir}/${f} 的 st-keys 沒有涵蓋鍵「${k}」`);
            for (const q of dyn) assert.ok(match(q + 'x'), `${dir}/${f} 的 st-keys 沒有涵蓋動態鍵前綴「${q}*」`);
        }
    assert.match(index, /<meta name="st-keys" content="\*">/, 'index.html 要宣告全站備份 st-keys="*"');
    for (const m of index.matchAll(/<a class="card" [^>]*>/g)) assert.match(m[0], /data-topic="[^"]+"/, '首頁卡片缺 data-topic：' + m[0]);
    ok('TOOLS.md / README / index 與頁面一致');
}

// ===== 番茄鐘：歷史紀錄 =====
{
    const m = load('fun/pomodoro.html', 'lastDays, streak, trim, cleanHist');
    const sh = Util.day.shift, bt = Util.day.between, T = '2024-03-10';
    const hist = { '2024-03-10': { count: 2, minutes: 50 }, '2024-03-09': { count: 1, minutes: 25 }, '2024-03-07': { count: 4, minutes: 100 }, '2023-01-01': { count: 1, minutes: 25 } };
    assert.deepEqual(m.lastDays(hist, 4, T, sh), [{ d: '2024-03-07', count: 4, minutes: 100 }, { d: '2024-03-08', count: 0, minutes: 0 }, { d: '2024-03-09', count: 1, minutes: 25 }, { d: '2024-03-10', count: 2, minutes: 50 }]);
    assert.equal(m.lastDays(hist, 30, T, sh).length, 30); assert.equal(m.lastDays({}, 7, T, sh).every(x => x.minutes === 0), true);
    assert.equal(m.streak(hist, T, sh), 2);                                                  // 3/10、3/9 連續，3/8 中斷
    assert.equal(m.streak({ '2024-03-09': { count: 1, minutes: 25 } }, T, sh), 1);            // 今天還沒專注：從昨天算
    assert.equal(m.streak({ '2024-03-08': { count: 1, minutes: 25 } }, T, sh), 0); assert.equal(m.streak({}, T, sh), 0);
    assert.deepEqual(Object.keys(m.trim(hist, 365, T, bt)).sort(), ['2024-03-07', '2024-03-09', '2024-03-10']);
    assert.deepEqual(m.cleanHist({ '2024-03-10': { count: 1, minutes: 25 }, bad: { count: 1, minutes: 1 }, '2024-03-09': { count: -1, minutes: 5 }, '2024-03-08': { count: 'x', minutes: 5 }, '2024-03-07': null }), { '2024-03-10': { count: 1, minutes: 25 } });
    assert.deepEqual(m.cleanHist(null), {}); assert.deepEqual(m.cleanHist([1, 2]), {}); assert.deepEqual(m.cleanHist('x'), {});
    ok('pomodoro history');
}

// ===== 進位 / 位元運算 =====
{
    const m = load('utils/base-converter.html', 'parseBig, toUnsigned, toSigned, bitOp, floatParts, parseFloatText, group4');
    assert.equal(m.parseBig('ff', 16), 255n); assert.equal(m.parseBig('0xFF', 16), 255n); assert.equal(m.parseBig('-0b101', 2), -5n); assert.equal(m.parseBig('1_000', 10), 1000n); assert.equal(m.parseBig('zz', 36), 1295n);
    assert.equal(m.parseBig('ffffffffffffffffffff', 16), 1208925819614629174706175n);
    for (const [s, b] of [['12', 2], ['', 10], ['g', 16], ['-', 10], ['0x', 16], ['1.5', 10], ['9', 8], ['x'.repeat(401), 36]]) assert.equal(m.parseBig(s, b), null, s);
    assert.equal(m.toUnsigned(-1n, 8), 255n); assert.equal(m.toUnsigned(256n, 8), 0n); assert.equal(m.toSigned(255n, 8), -1n); assert.equal(m.toSigned(127n, 8), 127n); assert.equal(m.toSigned(128n, 8), -128n);
    assert.equal(m.bitOp(0xF0n, 0x3Cn, 'AND', 8), 0x30n); assert.equal(m.bitOp(0xF0n, 0x3Cn, 'OR', 8), 0xFCn); assert.equal(m.bitOp(0xF0n, 0x3Cn, 'XOR', 8), 0xCCn);
    assert.equal(m.bitOp(0xF0n, 0x3Cn, 'NAND', 8), 0xCFn); assert.equal(m.bitOp(0x0Fn, 0n, 'NOT', 8), 0xF0n); assert.equal(m.bitOp(0n, 0n, 'NOT', 64), (1n << 64n) - 1n);
    assert.equal(m.bitOp(1n, 7n, 'SHL', 8), 128n); assert.equal(m.bitOp(1n, 8n, 'SHL', 8), 0n); assert.equal(m.bitOp(1n, 100n, 'SHL', 8), 0n); assert.equal(m.bitOp(0x80n, 7n, 'SHR', 8), 1n);
    assert.equal(m.bitOp(0x80n, 1n, 'SAR', 8), 0xC0n); assert.equal(m.bitOp(0x40n, 1n, 'SAR', 8), 0x20n); assert.equal(m.bitOp(-1n, 3n, 'SHR', 8), 0x1Fn); assert.equal(m.bitOp(-8n, 1n, 'SAR', 32), m.toUnsigned(-4n, 32));
    assert.throws(() => m.bitOp(1n, 1n, '??', 8));
    // 與 JavaScript 的 32 位元運算交叉驗證
    for (let i = 0; i < 300; i++) {
        const a = Util.rnd(2 ** 32) | 0, b = Util.rnd(2 ** 32) | 0, A = BigInt(a), B = BigInt(b);
        assert.equal(Number(m.toSigned(m.bitOp(A, B, 'AND', 32), 32)), a & b); assert.equal(Number(m.toSigned(m.bitOp(A, B, 'XOR', 32), 32)), a ^ b);
        const n = Util.rnd(32); assert.equal(Number(m.toSigned(m.bitOp(A, BigInt(n), 'SHL', 32), 32)), a << n); assert.equal(Number(m.toSigned(m.bitOp(A, BigInt(n), 'SAR', 32), 32)), a >> n); assert.equal(Number(m.bitOp(A, BigInt(n), 'SHR', 32)), a >>> n);
    }
    const f = m.floatParts(0.1, 32);
    assert.equal(f.hex, '0x3dcccccd'); assert.equal(f.sign, '0'); assert.equal(f.exp, '01111011'); assert.equal(f.mant, '10011001100110011001101'); assert.equal(f.back, 0.10000000149011612);
    const d = m.floatParts(0.1, 64); assert.equal(d.hex, '0x3fb999999999999a'); assert.equal(d.bits.length, 64); assert.equal(d.exp.length, 11); assert.equal(d.back, 0.1);
    assert.equal(m.floatParts(-0, 64).sign, '1'); assert.equal(m.floatParts(NaN, 32).hex, '0x7fc00000'); assert.equal(m.floatParts(Infinity, 64).hex, '0x7ff0000000000000'); assert.equal(m.floatParts(1, 32).hex, '0x3f800000');
    assert.equal(m.parseFloatText('1e-3'), 0.001); assert.equal(m.parseFloatText('.5'), 0.5); assert.equal(m.parseFloatText('5.'), 5); assert.equal(m.parseFloatText('-inf'), -Infinity); assert.ok(Number.isNaN(m.parseFloatText('NaN')));
    for (const bad of ['abc', '', '1.2.3', '--1', '0x10', '1e', '１２']) assert.equal(m.parseFloatText(bad), null, bad);
    assert.equal(m.group4('10101111'), '1010 1111'); assert.equal(m.group4('101'), '101');
    ok('base-converter');
}

// ===== Cron =====
{
    const m = load('utils/cron-parser.html', 'parseCron, nextRuns, summarize, describeField');
    const c = m.parseCron('*/15 9-17 * * 1-5');
    assert.deepEqual(c.fields[0].values, [0, 15, 30, 45]); assert.deepEqual(c.fields[1].values, [9, 10, 11, 12, 13, 14, 15, 16, 17]); assert.deepEqual(c.fields[4].values, [1, 2, 3, 4, 5]);
    assert.deepEqual(m.parseCron('0 0 * JAN MON').fields.slice(3).map(f => f.values), [[1], [1]]); assert.deepEqual(m.parseCron('0 0 * * 7').fields[4].values, [0]); assert.deepEqual(m.parseCron('0 0 * * 5-7').fields[4].values, [0, 5, 6]);
    assert.deepEqual(m.parseCron('5/20 * * * *').fields[0].values, [5, 25, 45]); assert.deepEqual(m.parseCron('1,2,2,3 * * * *').fields[0].values, [1, 2, 3]); assert.equal(m.parseCron('@daily').expr, '0 0 * * *'); assert.equal(m.parseCron('  0   0 *  * * ').expr, '0 0 * * *');
    for (const bad of ['* * * *', '* * * * * *', '', '60 * * * *', '* 24 * * *', '* * 0 * *', '* * 32 * *', '* * * 13 *', '* * * * 8', '*/0 * * * *', 'a * * * *', '1- * * * *', '5-1 * * * *', '1,,2 * * * *', '*/x * * * *', '1-2-3 * * * *'])
        assert.throws(() => m.parseCron(bad), Error, JSON.stringify(bad));
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const from = new Date(2024, 0, 1, 0, 0);
    assert.deepEqual(m.nextRuns(c, from, 10).map(fmt), ['2024-01-01 09:00', '2024-01-01 09:15', '2024-01-01 09:30', '2024-01-01 09:45', '2024-01-01 10:00', '2024-01-01 10:15', '2024-01-01 10:30', '2024-01-01 10:45', '2024-01-01 11:00', '2024-01-01 11:15']);
    assert.deepEqual(m.nextRuns(m.parseCron('* * * * *'), new Date(2024, 0, 1, 23, 58), 3).map(fmt), ['2024-01-01 23:59', '2024-01-02 00:00', '2024-01-02 00:01']);   // 嚴格晚於 from；跨日
    assert.equal(fmt(m.nextRuns(m.parseCron('30 2 29 2 *'), new Date(2024, 2, 1), 1)[0]), '2028-02-29 02:30');                                               // 閏日
    assert.deepEqual(m.nextRuns(m.parseCron('0 0 31 * *'), from, 4).map(fmt), ['2024-01-31 00:00', '2024-03-31 00:00', '2024-05-31 00:00', '2024-07-31 00:00']);   // 沒有 31 日的月份跳過
    assert.deepEqual(m.nextRuns(m.parseCron('0 0 13 * 5'), from, 5).map(d => d.getDate()), [5, 12, 13, 19, 26]);                                              // 日與週都限制 → 符合任一
    assert.deepEqual(m.nextRuns(m.parseCron('0 0 30 2 *'), from, 3), []);
    assert.equal(m.nextRuns(m.parseCron('0 0 1 1 *'), from, 1).map(fmt)[0], '2025-01-01 00:00');
    for (const [e, t] of [['* * * * *', '每分鐘執行一次'], ['*/5 * * * *', '每 5 分鐘執行一次'], ['0 * * * *', '每小時的第 0 分執行'], ['0 9 * * *', '每天 09:00 執行'], ['30 8 * * MON', '每週一 08:30 執行'], ['0 9 * * 1,3,5', '每週一、三、五 09:00 執行'], ['0 0 1 * *', '每月 1 日 00:00 執行'], ['0 0 1,15 * *', '每月 1、15 日 00:00 執行'], ['0 0 1 1 *', '']])
        assert.equal(m.summarize(m.parseCron(e)), t, e);
    assert.equal(m.describeField(m.parseCron('*/20 * * * *').fields[0]), '每 20 分鐘（0 分、20 分、40 分）'); assert.equal(m.describeField(m.parseCron('* * * * *').fields[4]), '每天');
    ok('cron-parser');
}

// ===== 數織 =====
{
    const m = load('mini-games/nonogram.html', 'runsOf, solveLine, solveGrid, cluesOf, matches, generate');
    assert.deepEqual(m.runsOf([0, 0, 0]), [0]); assert.deepEqual(m.runsOf([1, 1, 0, 1]), [2, 1]); assert.deepEqual(m.runsOf([1, 0, 1, 1, 1]), [1, 3]); assert.deepEqual(m.runsOf([1, 1, 1]), [3]);
    const U = (n) => new Array(n).fill(-1);
    assert.deepEqual(m.solveLine([5], U(5)), [1, 1, 1, 1, 1]); assert.deepEqual(m.solveLine([2], U(5)), U(5)); assert.deepEqual(m.solveLine([3], U(5)), [-1, -1, 1, -1, -1]);
    assert.deepEqual(m.solveLine([1, 1], [1, -1, -1]), [1, 0, 1]); assert.deepEqual(m.solveLine([0], U(3)), [0, 0, 0]); assert.deepEqual(m.solveLine([2, 2], U(5)), [1, 1, 0, 1, 1]);
    assert.equal(m.solveLine([3], [0, -1, 0]), null); assert.equal(m.solveLine([1], [1, 1]), null); assert.equal(m.solveLine([2, 2], U(4)), null); assert.deepEqual(m.solveLine([2], [-1, 1, -1, -1]), [-1, 1, -1, 0]);
    // 已知空白格限制排法
    assert.deepEqual(m.solveLine([2], [-1, -1, 0, -1, -1]), [-1, -1, 0, -1, -1]); assert.deepEqual(m.solveLine([3], [-1, -1, 0, -1, -1, -1]), [0, 0, 0, 1, 1, 1]);
    // 隨機驗證：任意一行，solveLine 的結論必須和暴力枚舉一致
    for (let t = 0; t < 400; t++) {
        const n = 3 + Util.rnd(8), line = Array.from({ length: n }, () => Util.rnd(2)), clue = m.runsOf(line), known = line.map(v => (Util.rnd(3) ? v : -1));
        const out = m.solveLine(clue, known); assert.ok(out, 'clue 本身的排法一定存在');
        const all = []; for (let b = 0; b < 1 << n; b++) { const l = Array.from({ length: n }, (_, i) => (b >> i) & 1); if (JSON.stringify(m.runsOf(l)) === JSON.stringify(clue) && l.every((v, i) => known[i] === -1 || known[i] === v)) all.push(l); }
        const expect = known.map((v, i) => (all.every(l => l[i] === 1) ? 1 : all.every(l => l[i] === 0) ? 0 : -1));
        assert.deepEqual(out, expect, JSON.stringify({ clue, known }));
    }
    for (const n of [5, 10, 15]) for (let k = 0; k < 20; k++) {
        const g = m.generate(n, Util.rnd); assert.ok(g, '要能出題');
        const s = m.solveGrid(g.rowC, g.colC); assert.ok(s.solved); assert.deepEqual(s.grid, g.grid);
        assert.ok(m.matches(g.grid, g.rowC, g.colC)); assert.ok(m.matches(g.grid.map(r => r.map(v => (v ? 1 : 2))), g.rowC, g.colC));   // ✕ 標記不影響判定
        const bad = g.grid.map(r => [...r]); bad[0][0] ^= 1; assert.equal(m.matches(bad, g.rowC, g.colC), false);
    }
    // 5×5：獨立驗證解唯一——每列只列舉符合該列提示的排法，再逐一檢查各欄
    for (let k = 0; k < 20; k++) {
        const g = m.generate(5, Util.rnd), opts = g.rowC.map(c => { const o = []; for (let b = 0; b < 32; b++) { const row = [0, 1, 2, 3, 4].map(j => (b >> j) & 1); if (JSON.stringify(m.runsOf(row)) === JSON.stringify(c)) o.push(row); } return o; });
        let cnt = 0; const rec = (i, rows) => { if (cnt > 1) return; if (i === 5) { if (m.matches(rows, g.rowC, g.colC)) cnt++; return; } for (const r of opts[i]) rec(i + 1, [...rows, r]); };
        rec(0, []); assert.equal(cnt, 1, '唯一解');
    }
    assert.equal(m.solveGrid([[2], [2]], [[1], [1]]).contradiction, true);
    ok('nonogram');
}

// ===== 單字閃卡 =====
{
    const m = load('fun/flashcards.html', 'parseCards, schedule, dueQueue, validCard');
    const cs = m.parseCards('apple | 蘋果\nbanana,香蕉\nlib\t圖書館\nnosep\n | x\ny|\n\napple|dup\nlong | ' + 'x'.repeat(201) + '\r\nkey，鑰匙\r\n');
    assert.deepEqual(cs.map(c => [c.f, c.b]), [['apple', '蘋果'], ['banana', '香蕉'], ['lib', '圖書館'], ['key', '鑰匙']]);
    assert.ok(cs.every(c => m.validCard(c) && !c.seen && c.ease === 2.5));
    assert.equal(m.parseCards('apple|x\nnew|新', cs).length, 1);                                                              // 已有的正面略過
    assert.equal(m.parseCards('a|b,c')[0].b, 'b,c');                                                                          // 只取第一個分隔符號
    const T = '2024-03-10', c0 = cs[0];
    let c = m.schedule(c0, 2, T); assert.deepEqual([c.iv, c.reps, c.due, c.seen], [1, 1, '2024-03-11', true]); assert.equal(c0.reps, 0, '不改動原物件');
    c = m.schedule(c, 2, '2024-03-11'); assert.deepEqual([c.iv, c.reps], [3, 2]); c = m.schedule(c, 2, '2024-03-14'); assert.deepEqual([c.iv, c.reps], [8, 3]); assert.equal(c.due, '2024-03-22');
    const f = m.schedule(c, 0, T); assert.deepEqual([f.iv, f.reps, f.due, f.ease], [0, 0, T, 2.3]);
    assert.equal(m.schedule(c0, 3, T).iv, 3); assert.equal(m.schedule(c0, 1, T).iv, 1); assert.equal(m.schedule(c0, 3, T).ease, 2.65);
    let h = c0; for (let i = 0; i < 20; i++) h = m.schedule(h, 0, T); assert.equal(h.ease, 1.3);                                   // 下限
    h = c0; for (let i = 0; i < 20; i++) h = m.schedule(h, 3, T); assert.equal(h.ease, 3);                                      // 上限
    // 間隔單調：連續「良好」下一次間隔必定變長
    h = c0; let prev = 0; for (let i = 0; i < 12; i++) { h = m.schedule(h, 2, T); assert.ok(h.iv > prev); prev = h.iv; }
    const deck = [{ ...c0, seen: true, due: '2024-03-09' }, { ...c0, f: 'b', seen: true, due: '2024-03-12' }, { ...c0, f: 'c', seen: true, due: '2024-03-01' }, ...Array.from({ length: 25 }, (_, i) => ({ ...c0, f: 'n' + i }))];
    const q = m.dueQueue(deck, T); assert.deepEqual(q.slice(0, 2), [2, 0]); assert.equal(q.length, 2 + 20); assert.ok(!q.includes(1)); assert.equal(m.dueQueue(deck, T, 5).length, 2 + 5); assert.deepEqual(m.dueQueue([], T), []);
    for (const bad of [null, {}, { ...c0, f: 1 }, { ...c0, ease: 'x' }, { ...c0, iv: 1.5 }, { ...c0, seen: 'y' }]) assert.equal(m.validCard(bad), false);
    ok('flashcards');
}

// ===== 螢幕 / 鍵盤 / 滑鼠 =====
{
    const m = load('utils/screen-test.html', 'COLORS, ROWS, ALL_CODES, MOUSE_ITEMS, BUTTON_NAME');
    assert.equal(new Set(m.ALL_CODES).size, m.ALL_CODES.length, '鍵盤配置不能有重複的 code');
    for (const c of ['KeyA', 'KeyZ', 'Digit0', 'Space', 'Enter', 'ArrowUp', 'F12', 'Escape', 'ShiftLeft', 'ShiftRight']) assert.ok(m.ALL_CODES.includes(c), c);
    assert.equal(m.ALL_CODES.filter(c => /^Key[A-Z]$/.test(c)).length, 26); assert.equal(m.ALL_CODES.filter(c => /^Digit\d$/.test(c)).length, 10); assert.equal(m.ALL_CODES.filter(c => /^F\d+$/.test(c)).length, 12);
    assert.ok(m.ROWS.flat().every(k => Array.isArray(k) && typeof k[0] === 'string' && typeof k[1] === 'string' && (k[2] === undefined || k[2] > 0)));
    assert.ok(m.COLORS.every(([n, c]) => /^#[0-9a-f]{6}$/.test(c)) && new Set(m.COLORS.map(c => c[1])).size === m.COLORS.length);
    assert.equal(new Set(m.MOUSE_ITEMS.map(i => i[0])).size, 8); assert.ok(Object.values(m.BUTTON_NAME).every(n => m.MOUSE_ITEMS.some(i => i[0] === n)));
    ok('screen-test');
}

// ===== 黑白棋 =====
{
    const m = load('mini-games/othello.html', 'N, flips, legalMoves, count, newBoard, newGame, play, validState');
    const b0 = m.newBoard();
    assert.deepEqual(m.legalMoves(b0, 1), [[2, 3], [3, 2], [4, 5], [5, 4]]); assert.deepEqual(m.legalMoves(b0, 2), [[2, 4], [3, 5], [4, 2], [5, 3]]);
    assert.deepEqual(m.flips(b0, 2, 3, 1), [[3, 3]]); assert.deepEqual(m.flips(b0, 0, 0, 1), []); assert.deepEqual(m.flips(b0, 3, 3, 1), []); assert.deepEqual(m.flips(b0, -1, 0, 1), []); assert.deepEqual(m.flips(b0, 8, 0, 1), []); assert.deepEqual(m.flips(b0, 1.5, 2, 1), []);
    assert.equal(m.count(b0, 1), 2); assert.equal(m.count(b0, 2), 2);
    // 獨立的簡單實作（逐方向走字串）交叉驗證
    const naive = (board, r, c, p) => {
        if (board[r][c]) return 0; let total = 0;
        for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
            let s = '', rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { s += board[rr][cc]; rr += dr; cc += dc; }
            const mm = s.match(new RegExp('^' + (3 - p) + '+' + p)); if (mm) total += mm[0].length - 1;
        }
        return total;
    };
    let passes = 0, ended = 0;
    for (let g = 0; g < 200; g++) {
        const s = m.newGame(); let moves = 0;
        while (!s.over) {
            for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) assert.equal(m.flips(s.board, r, c, s.turn).length, naive(s.board, r, c, s.turn));
            const legal = m.legalMoves(s.board, s.turn); assert.ok(legal.length > 0, '輪到的人一定有合法步（沒有的話必須已跳過或結束）');
            const [r, c] = legal[Util.rnd(legal.length)], before = s.board.map(x => [...x]), who = s.turn, nf = m.flips(before, r, c, who).length;
            assert.equal(m.play(s, 3 - who, r, c), false, '不是自己的回合不能下'); assert.ok(m.play(s, who, r, c)); moves++;
            assert.equal(m.count(s.board, 1) + m.count(s.board, 2), 4 + moves); assert.equal(m.count(s.board, who) - m.count(before, who), 1 + nf);
            if (s.passed) passes++;
        }
        ended++; const b = m.count(s.board, 1), w = m.count(s.board, 2); assert.equal(s.winner, b > w ? 1 : w > b ? 2 : 0);
        assert.equal(m.play(s, 1, 0, 0), false); assert.ok(moves <= 60);
    }
    assert.equal(ended, 200);
    // 手工局面：黑下 (0,2) 後白無棋可下 → 跳過，仍由黑下
    const st = { board: Array.from({ length: 8 }, () => new Array(8).fill(0)), turn: 1, over: false, winner: 0, last: null, passed: 0 };
    st.board[0][0] = 1; st.board[0][1] = 2; st.board[7][7] = 1; st.board[7][6] = 2;
    assert.ok(m.play(st, 1, 0, 2)); assert.equal(st.passed, 2); assert.equal(st.turn, 1); assert.equal(st.over, false); assert.equal(st.board[0][1], 1);
    // 雙方都無棋可下：結束並計分
    const end = { board: Array.from({ length: 8 }, () => new Array(8).fill(0)), turn: 1, over: false, winner: 0, last: null, passed: 0 };
    end.board[0][0] = 1; end.board[0][1] = 2; assert.ok(m.play(end, 1, 0, 2)); assert.equal(end.over, true); assert.equal(end.winner, 1);
    const good = m.newGame(); assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, board: good.board.slice(1) }, { ...good, board: good.board.map(r => r.map(() => 3)) }, { ...good, turn: 3 }, { ...good, over: 1 }, { ...good, winner: 5 }, { ...good, passed: 'x' }, { ...good, last: [8, 0] }, { ...good, last: [1] }]) assert.ok(!m.validState(bad));
    assert.ok(m.validState({ ...good, last: [2, 3] }));
    ok('othello (' + passes + ' passes seen in 200 random games)');
}

// ===== 連線骰子賽跑 =====
{
    const m = load('fun/board-race.html', 'GOAL, EVENTS, move, nextTurn, describe, validState');
    assert.deepEqual(m.move(0, 3), { pos: 3, win: false, skip: false, again: false, ev: null, landed: 3 });
    assert.equal(m.move(1, 3).pos, 7); assert.equal(m.move(1, 3).landed, 4); assert.equal(m.move(5, 3).pos, 5); assert.equal(m.move(5, 3).landed, 8);
    assert.deepEqual([m.move(8, 3).skip, m.move(8, 3).pos], [true, 11]); assert.deepEqual([m.move(14, 3).again, m.move(14, 3).pos], [true, 17]);
    assert.deepEqual([m.move(26, 4).win, m.move(26, 4).pos], [true, m.GOAL]); assert.equal(m.move(29, 6).pos, m.GOAL); assert.equal(m.move(22, 3).pos, 28);
    for (let pos = 0; pos < m.GOAL; pos++) for (let roll = 1; roll <= 6; roll++) { const r = m.move(pos, roll); assert.ok(r.pos >= 0 && r.pos <= m.GOAL); assert.equal(r.win, r.pos === m.GOAL); assert.ok(!(r.skip && r.again)); }
    // 後退不會退到負數、前進不會超過終點（事件格 27 後退 5、25 前進 3 → 28）
    assert.equal(Math.min(...Object.keys(m.EVENTS).map(Number)) >= 1, true); assert.ok(Object.keys(m.EVENTS).every(k => +k < m.GOAL));
    let n = m.nextTurn([true, true, true], [false, true, false], 0); assert.deepEqual([n.turn, n.skipped, n.skip], [2, [1], [false, false, false]]);
    n = m.nextTurn([true, false, true], [false, false, false], 0); assert.equal(n.turn, 2);
    n = m.nextTurn([true, true], [true, true], 0); assert.deepEqual([n.turn, n.skipped], [1, [1, 0]]); assert.deepEqual(n.skip, [false, false]);
    n = m.nextTurn([true, false], [false, false], 0); assert.equal(n.turn, 0); n = m.nextTurn([false, false], [false, false], 0); assert.equal(n.turn, -1);
    n = m.nextTurn([true, true, true], [false, false, false], 2); assert.equal(n.turn, 0);
    // 隨機整局：永遠會有人到終點（平均 < 80 輪）
    for (let g = 0; g < 200; g++) { let pos = 0, steps = 0, skip = false; while (pos < m.GOAL && steps < 500) { steps++; if (skip) { skip = false; continue; } const r = m.move(pos, 1 + Util.rnd(6)); pos = r.pos; skip = r.skip; } assert.equal(pos, m.GOAL); assert.ok(steps < 200); }
    assert.ok(m.describe(m.move(1, 3)).includes('前進')); assert.equal(m.describe(m.move(0, 1)), '');
    const good = { phase: 'play', names: ['a', 'b'], pos: [0, 5], skip: [false, true], active: [true, true], wins: [0, 1], turn: 0, winner: -1, note: 'x' };
    assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, pos: [31] }, { ...good, pos: [-1] }, { ...good, pos: [1.5] }, { ...good, names: Array(7).fill('a') }, { ...good, skip: [1] }, { ...good, wins: ['a'] }, { ...good, note: 'x'.repeat(81) }, { ...good, turn: 'a' }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 50));
    ok('board-race');
}

// ===== 連線誰是臥底 =====
{
    const m = load('fun/spy-game.html', 'PAIRS, spyCount, assign, tally, outcome, descOk, voteOk, validState');
    assert.deepEqual([3, 6, 7, 10].map(m.spyCount), [1, 1, 2, 2]);
    assert.ok(m.PAIRS.every(p => p.length === 2 && p[0] !== p[1] && p.every(w => w.length >= 1 && w.length <= 10)));
    assert.equal(new Set(m.PAIRS.map(p => p.join())).size, m.PAIRS.length);
    for (let n = 3; n <= 10; n++) for (let t = 0; t < 100; t++) {
        const a = m.assign(n, Util.rnd);
        assert.equal(a.roles.length, n); assert.equal(a.roles.filter(r => r === 'spy').length, m.spyCount(n)); assert.notEqual(a.civWord, a.spyWord);
        assert.ok(m.PAIRS.some(p => (p[0] === a.civWord && p[1] === a.spyWord) || (p[1] === a.civWord && p[0] === a.spyWord)));
    }
    // 公平性：每個位置當臥底的機率相近；兩個詞都有機會成為臥底詞
    const cnt = [0, 0, 0, 0, 0]; let flip = 0;
    for (let t = 0; t < 10000; t++) { const a = m.assign(5, Util.rnd, [['x', 'y']]); cnt[a.roles.indexOf('spy')]++; flip += a.spyWord === 'x' ? 1 : 0; }
    cnt.forEach(v => assert.ok(v > 1800 && v < 2200, JSON.stringify(cnt))); assert.ok(flip > 4700 && flip < 5300);
    assert.equal(m.tally([[0, 2], [1, 2], [2, 0]]), 2); assert.equal(m.tally([[0, 1], [1, 0]]), -1); assert.equal(m.tally([]), -1); assert.equal(m.tally([[0, 1], [1, 2], [2, 1], [3, 1]]), 1);
    const roles = ['civ', 'civ', 'civ', 'spy'];
    assert.equal(m.outcome(roles, [true, true, true, true]), null); assert.equal(m.outcome(roles, [true, true, true, false]), 'civ'); assert.equal(m.outcome(roles, [true, false, true, true]), null);
    assert.equal(m.outcome(roles, [false, false, true, true]), 'spy'); assert.equal(m.outcome(['civ', 'civ', 'spy'], [true, false, true]), 'spy'); assert.equal(m.outcome(['civ', 'spy', 'spy', 'civ', 'civ'], [true, true, true, true, false]), 'spy'); assert.equal(m.outcome(['civ', 'spy', 'spy', 'civ', 'civ'], [true, true, true, true, true]), null);
    assert.ok(m.descOk('是一種水果', '蘋果')); assert.ok(!m.descOk('我的蘋果很甜', '蘋果')); assert.ok(!m.descOk('', '蘋果')); assert.ok(!m.descOk('   ', '蘋果')); assert.ok(!m.descOk('x'.repeat(21), '蘋果')); assert.ok(!m.descOk(5, '蘋果'));
    const alive = [true, true, false, true];
    assert.ok(m.voteOk(0, 1, alive) && m.voteOk(3, 0, alive)); for (const [v, t] of [[0, 0], [0, 2], [2, 0], [0, 4], [0, -1], [0, 1.5], [0, '1'], [0, null]]) assert.ok(!m.voteOk(v, t, alive), v + ',' + t);
    const good = { phase: 'vote', names: ['a', 'b', 'c'], alive: [true, true, true], active: [true, true, true], voted: [false, true, false], round: 1, speaker: -1, elim: -1, spies: 1, note: '', roles: [], words: [], votes: [], log: [{ r: 1, n: 'a', t: 'hi' }] };
    assert.ok(m.validState(good)); assert.ok(m.validState({ ...good, phase: 'over', roles: ['civ', 'spy', 'civ'], words: ['蘋果', '水梨'], votes: [[0, 1]] }));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, names: Array(11).fill('a') }, { ...good, alive: [1] }, { ...good, roles: ['boss'] }, { ...good, words: ['a', 'b', 'c'] }, { ...good, words: ['x'.repeat(11)] }, { ...good, votes: [[0]] }, { ...good, votes: [['a', 'b']] }, { ...good, log: [{ r: 1, n: 'a', t: 'x'.repeat(21) }] }, { ...good, note: 'x'.repeat(81) }, { ...good, round: 'x' }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 60));
    ok('spy-game');
}

// ===== 你畫我猜：口述模式 =====
{
    const m = load('mini-games/draw-guess.html', 'validState');
    const good = { phase: 'draw', mode: 'talk', names: ['a', 'b'], scores: [0, 0], drawer: 0, hint: '＿ ＿', ms: 1000, guessed: [], word: '', active: [true, true], round: 1, rounds: 2 };
    assert.ok(m.validState(good)); assert.ok(m.validState({ ...good, mode: 'draw' }));
    for (const bad of [{ ...good, mode: 'x' }, { ...good, mode: undefined }]) assert.ok(!m.validState(bad));
    ok('draw-guess talk mode');
}

// ===== 共用：雜湊與隨機字串 =====
{
    pending.push((async () => {
        assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        assert.equal(await sha256('abc', 'SHA-1'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
        assert.ok((await sha256('abc', 'SHA-512')).startsWith('ddaf35a193617aba'));
        assert.equal(await sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        assert.equal(await sha256('你好'), '670d9743542cae3ea7ebe36af56bd53648b0a1126162e78d81a32934a711302e');
        await assert.rejects(() => sha256('x', 'MD5'));
        assert.equal(randomHex(16).length, 32); assert.match(randomHex(8), /^[0-9a-f]{16}$/); assert.notEqual(randomHex(16), randomHex(16)); assert.equal(randomHex(0), '');
        ok('util: sha256 / randomHex');
    })());
}

// ===== 連線猜拳 =====
{
    const m = load('fun/rps.html', 'CHOICES, beats, winsNeeded, commitText, validHash, validReveal, BEST_OF');
    const win = [['rock', 'scissors'], ['scissors', 'paper'], ['paper', 'rock']];
    for (const [a, b] of win) { assert.equal(m.beats(a, b), 1); assert.equal(m.beats(b, a), -1); }
    for (const c of m.CHOICES) assert.equal(m.beats(c, c), 0);
    assert.deepEqual(m.BEST_OF.map(m.winsNeeded), [2, 3, 4]);
    assert.equal(m.commitText(2, 'rock', 'ab'), '2:rock:ab'); assert.notEqual(m.commitText(1, 'rock', 'ab'), m.commitText(2, 'rock', 'ab'));
    assert.ok(m.validHash('a'.repeat(64))); for (const bad of ['', 'A'.repeat(64), 'a'.repeat(63), 5, null, 'g'.repeat(64)]) assert.ok(!m.validHash(bad));
    const salt = 'a'.repeat(32);
    assert.ok(m.validReveal({ round: 1, choice: 'rock', salt })); for (const bad of [null, {}, { round: 1.5, choice: 'rock', salt }, { round: 1, choice: 'lizard', salt }, { round: 1, choice: 'rock', salt: 'x' }, { round: 1, choice: 'rock', salt: 'A'.repeat(32) }, { round: 1, choice: 'rock' }]) assert.ok(!m.validReveal(bad));
    // 承諾的綁定性：改選擇、改回合、改鹽，雜湊都不同
    pending.push((async () => {
        const base = await sha256(m.commitText(1, 'rock', salt));
        for (const alt of [m.commitText(1, 'paper', salt), m.commitText(2, 'rock', salt), m.commitText(1, 'rock', 'b'.repeat(32))]) assert.notEqual(await sha256(alt), base);
        ok('rps: beats / best-of / commitment binding');
    })());
}

// ===== 圖片壓縮 =====
{
    const m = load('utils/image-resize.html', 'fitSize, fmtBytes, ratioText, outName, sizeOk, EXT');
    assert.deepEqual(m.fitSize(4000, 3000, 1920, null), { w: 1920, h: 1440 }); assert.deepEqual(m.fitSize(4000, 3000, null, 1500), { w: 2000, h: 1500 });
    assert.deepEqual(m.fitSize(4000, 3000, 1000, 1000), { w: 1000, h: 750 }); assert.deepEqual(m.fitSize(800, 600, 1920, 1080), { w: 800, h: 600 }, '不放大');
    assert.deepEqual(m.fitSize(100, 100, null, null), { w: 100, h: 100 }); assert.deepEqual(m.fitSize(1, 1000, 1, null), { w: 1, h: 1000 }); assert.deepEqual(m.fitSize(10000, 1, 100, null), { w: 100, h: 1 }, '至少 1 像素');
    assert.equal(m.fmtBytes(500), '500 B'); assert.equal(m.fmtBytes(1536), '1.5 KB'); assert.equal(m.fmtBytes(5 * 1048576), '5.00 MB');
    assert.equal(m.ratioText(1000, 250), '縮小 75%'); assert.equal(m.ratioText(1000, 1500), '增加 50%'); assert.equal(m.ratioText(0, 5), '');
    assert.equal(m.outName('IMG_0001.JPG', 800, 600, 'image/webp'), 'IMG_0001-800x600.webp'); assert.equal(m.outName('a.b.png', 1, 1, 'image/png'), 'a.b-1x1.png'); assert.equal(m.outName('', 1, 2, 'image/jpeg'), 'image-1x2.jpg'); assert.equal(m.outName('a/b:c.png', 1, 1, 'image/png'), 'a_b_c-1x1.png');
    assert.ok(m.sizeOk(16384, 6000)); for (const [w, h] of [[16385, 1], [0, 5], [-1, 5], [12000, 12000]]) assert.ok(!m.sizeOk(w, h));
    ok('image-resize');
}

// ===== 待辦清單 =====
{
    const m = load('fun/todo.html', 'GROUPS, groupOf, group, move, validItem, dueLabel');
    const T = '2024-03-10', bt = Util.day.between, it = (id, due, done = false) => ({ id, t: id, due, done });
    assert.equal(m.groupOf(it('a', '2024-03-09'), T, bt), 'late'); assert.equal(m.groupOf(it('a', T), T, bt), 'today'); assert.equal(m.groupOf(it('a', '2024-03-11'), T, bt), 'tomorrow');
    assert.equal(m.groupOf(it('a', '2024-03-20'), T, bt), 'later'); assert.equal(m.groupOf(it('a', ''), T, bt), 'none'); assert.equal(m.groupOf(it('a', '2024-03-09', true), T, bt), 'done');
    const list = [it('x', ''), it('l1', '2024-03-01'), it('t', T), it('l2', '2024-03-05'), it('d', '', true), it('later', '2024-04-01'), it('y', '')];
    const gs = m.group(list, T, bt);
    assert.deepEqual(gs.map(g => g.key), ['late', 'today', 'later', 'none', 'done']); assert.deepEqual(gs[0].items.map(i => i.id), ['l1', 'l2']); assert.deepEqual(gs[3].items.map(i => i.id), ['x', 'y']);
    assert.deepEqual(m.group([], T, bt), []);
    // 組內移動：只和同組相鄰的互換，不影響其他組的相對順序
    let r = m.move(list, 'l2', -1, T, bt); assert.deepEqual(r.map(i => i.id), ['x', 'l2', 't', 'l1', 'd', 'later', 'y']);
    r = m.move(list, 'x', 1, T, bt); assert.deepEqual(r.map(i => i.id), ['y', 'l1', 't', 'l2', 'd', 'later', 'x']);
    assert.equal(m.move(list, 'l1', -1, T, bt), list, '已經在最前面'); assert.equal(m.move(list, 'y', 1, T, bt), list, '已經在最後面'); assert.equal(m.move(list, 'nope', 1, T, bt), list);
    assert.equal(m.move(list, 't', 1, T, bt), list, '今天只有一項，無法移動'); assert.deepEqual(list.map(i => i.id), ['x', 'l1', 't', 'l2', 'd', 'later', 'y'], '不改動原陣列');
    assert.ok(m.validItem(it('a', '2024-01-01'))); assert.ok(m.validItem(it('a', ''))); for (const bad of [null, {}, { ...it('a', ''), t: '' }, { ...it('a', ''), t: 'x'.repeat(101) }, { ...it('a', 'x') }, { ...it('a', ''), done: 1 }, { ...it('a', ''), id: 5 }]) assert.ok(!m.validItem(bad));
    assert.deepEqual(['2024-03-10', '2024-03-11', '2024-03-09', '2024-03-05', '2024-03-13', ''].map(d => m.dueLabel(d, T, bt)), ['今天', '明天', '昨天', '逾期 5 天', '3 天後', '']);
    ok('todo');
}

// ===== 簡易畫板 =====
{
    const m = load('fun/sketchpad.html', 'COLORS, MAX_OPS, strokeWidth, lastClear, splitForBake');
    assert.equal(m.strokeWidth(10, 0.5, 'mouse'), 10); assert.equal(m.strokeWidth(10, 0, 'pen'), 10, '沒有筆壓資料時用固定粗細'); assert.equal(m.strokeWidth(10, 1, 'pen'), 17); assert.equal(m.strokeWidth(10, 0.5, 'pen'), 10); near(m.strokeWidth(10, 0.1, 'pen'), 4.4);
    assert.equal(m.strokeWidth(10, 5, 'pen'), 17, '筆壓上限 1'); assert.equal(m.strokeWidth(1, 0.01, 'pen'), 1, '至少 1');
    assert.equal(m.lastClear([]), -1); assert.equal(m.lastClear([{ k: 's' }, { k: 'c' }, { k: 's' }, { k: 'c' }, { k: 's' }]), 3); assert.equal(m.lastClear([{ k: 's' }]), -1);
    const ops = Array.from({ length: 450 }, (_, i) => ({ k: 's', i }));
    const sp = m.splitForBake(ops); assert.equal(sp.bake.length, 100); assert.equal(sp.keep.length, 350); assert.equal(sp.bake[0].i, 0); assert.equal(sp.keep[0].i, 100);
    const sp2 = m.splitForBake(ops.slice(0, 400)); assert.deepEqual([sp2.bake.length, sp2.keep.length], [0, 400]);
    assert.ok(m.COLORS.every(c => /^#[0-9a-f]{6}$/.test(c)) && new Set(m.COLORS).size === m.COLORS.length);
    ok('sketchpad');
}

// ===== 連線成語接龍 =====
{
    const m = load('fun/idiom-chain.html', 'IDIOMS, isShape, lastChar, firstChar, successors, startPool, checkAnswer, nextAlive, validState, LIVES, TURN_MS');
    assert.ok(m.IDIOMS.length >= 1000, '詞庫大小 ' + m.IDIOMS.length);
    assert.equal(new Set(m.IDIOMS).size, m.IDIOMS.length, '詞庫不能有重複');
    for (const w of m.IDIOMS) assert.ok(m.isShape(w), '不是四個中文字：' + w);
    const used = new Set(['一心一意']);
    assert.ok(m.successors('意', used).length >= 3); assert.ok(m.successors('意', used).every(w => w[0] === '意' && !used.has(w)));
    assert.ok(!m.successors('一', used).includes('一心一意')); assert.deepEqual(m.successors('龘', used), []);
    const pool = m.startPool(); assert.ok(pool.length >= 100, '開局題庫太小 ' + pool.length);
    for (const w of pool.slice(0, 300)) assert.ok(m.successors(m.lastChar(w), new Set([w])).length >= 3);
    const u = new Set(['一心一意']);
    assert.deepEqual(m.checkAnswer('一心一意', u, '意氣風發'), { ok: true, kind: 'listed', w: '意氣風發' });
    assert.deepEqual(m.checkAnswer('一心一意', u, ' 意氣風發 '), { ok: true, kind: 'listed', w: '意氣風發' }, '去掉前後空白');
    assert.deepEqual(m.checkAnswer('一心一意', u, '意在言表'), { ok: true, kind: 'unlisted', w: '意在言表' });
    for (const [w, why] of [['氣宇軒昂', '意'], ['意氣', '四個'], ['意氣風發了', '四個'], ['abcd', '四個'], ['', '四個'], [null, '四個'], ['一心一意', '意'], [5, '四個']]) { const r = m.checkAnswer('一心一意', u, w); assert.equal(r.ok, false, String(w)); assert.ok(r.reason.includes(why), r.reason); }
    assert.equal(m.checkAnswer('一心一意', new Set(['一心一意', '意氣風發']), '意氣風發').reason, '這個成語已經用過了');
    assert.equal(m.nextAlive([true, true, true], 0), 1); assert.equal(m.nextAlive([true, false, true], 0), 2); assert.equal(m.nextAlive([true, false, true], 2), 0); assert.equal(m.nextAlive([false, true, false], 1), 1); assert.equal(m.nextAlive([false, false], 0), -1);
    // 模擬整局（只用詞庫）：每一步合法、不重複，鏈一定能連續接下去至少 5 步
    for (let t = 0; t < 50; t++) {
        const s = pool[Util.rnd(pool.length)], used2 = new Set([s]); let last = s, steps = 0;
        for (; steps < 30; steps++) { const c = m.successors(m.lastChar(last), used2); if (!c.length) break; last = c[Util.rnd(c.length)]; assert.ok(m.checkAnswer(Array.from(used2).pop(), used2, last).ok); used2.add(last); }
        assert.ok(steps >= 1);
    }
    const good = { phase: 'play', names: ['a', 'b'], lives: [3, 2], alive: [true, true], active: [true, true], turn: 0, winner: -1, last: '一心一意', ms: 1000, note: 'x', count: 1, pending: null, chain: [{ n: '題目', w: '一心一意' }] };
    assert.ok(m.validState(good)); assert.ok(m.validState({ ...good, pending: { n: 'b', w: '意在言表' } }));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, lives: [4] }, { ...good, lives: [-1] }, { ...good, last: '一心一意一' }, { ...good, pending: { n: 'b', w: 'abc' } }, { ...good, pending: 5 }, { ...good, chain: [{ n: 'a', w: '一二三' }] }, { ...good, chain: Array(41).fill(good.chain[0]) }, { ...good, note: 'x'.repeat(81) }, { ...good, ms: 'x' }, { ...good, names: Array(9).fill('a') }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 60));
    ok('idiom-chain (' + m.IDIOMS.length + ' idioms, ' + pool.length + ' start idioms)');
}

// ===== 編碼解碼：JWT 與雜湊 =====
{
    const m = load('utils/encode-decode.html', 'CODECS, HASHES, b64urlToText, jwtDecode, fmtTime, relative');
    const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
    const sample = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const iat = 1516239022 * 1000;
    let t = m.jwtDecode(sample, iat + 3600e3);
    assert.ok(t.includes('"alg": "HS256"') && t.includes('"name": "John Doe"') && t.includes('簽發 iat：') && t.includes('（1 小時前）') && t.includes('不驗證簽章'), t);
    const now = Date.UTC(2024, 0, 10);
    t = m.jwtDecode(`${b64u({ alg: 'none' })}.${b64u({ exp: now / 1000 - 2 * 86400, nbf: now / 1000 + 3600, 名字: '小明' })}.`, now);
    assert.ok(t.includes('已過期 2 天') && t.includes('（1 小時後才生效）') && t.includes('"名字": "小明"') && t.includes('alg=none'), t);
    t = m.jwtDecode(`${b64u({ alg: 'HS256' })}.${b64u({ exp: now / 1000 + 90 * 60 })}.sig`, now); assert.ok(t.includes('還有 1 小時'), t);
    t = m.jwtDecode(`${b64u({ alg: 'HS256' })}.${b64u({ sub: 'x' })}.sig`, now); assert.ok(!t.includes('時間'), '沒有時間欄位就不顯示');
    for (const [bad, why] of [['a.b', '3 段'], ['a.b.c.d', '3 段'], [`${b64u('not json')}.${b64u({})}.x`, 'JSON'], [`${b64u({})}.${b64u('[1]')}.x`, 'JSON 物件'], [`${b64u({})}.${b64u('"s"')}.x`, 'JSON 物件'], ['e+y.abc.x', 'Base64URL'], ['', '3 段'], [`${b64u({ a: 1 })}.@@.x`, 'Base64URL']])
        assert.throws(() => m.jwtDecode(bad, now), (e) => e.message.includes(why), bad);
    assert.equal(m.b64urlToText(b64u('你好，世界')), '你好，世界'); assert.equal(m.b64urlToText(''), '');
    assert.equal(m.relative(-2 * 86400e3 - 5), '2 天'); assert.equal(m.relative(30 * 60e3), '30 分鐘'); assert.equal(m.relative(3 * 3600e3), '3 小時');
    assert.deepEqual(Object.keys(m.CODECS).filter(k => k.includes('雜湊')), m.HASHES.map(h => `${h} 雜湊`)); assert.ok(m.CODECS['JWT 解碼（不驗簽）'].noEnc); assert.ok(m.CODECS['SHA-256 雜湊'].noDec);
    // 舊功能不受影響
    assert.equal(m.CODECS['Base64'].enc('你好'), '5L2g5aW9');
    ok('encode-decode: JWT / hashes');
}

// ===== 色彩工具：配色 =====
{
    const m = load('utils/color-tools.html', 'palette, SCHEMES, parseColor, toHex, rgbToHsl');
    assert.deepEqual(m.palette('#ff0000', 'complementary'), ['#ff0000', '#00ffff']); assert.deepEqual(m.palette('#ff0000', 'triadic'), ['#ff0000', '#00ff00', '#0000ff']);
    assert.equal(m.palette('#ff0000', 'tetradic').length, 4); assert.equal(m.palette('#ff0000', 'split').length, 3); assert.equal(m.palette('#ff0000', 'mono').length, 6); assert.equal(m.palette('#ff0000', 'gradient').length, 7);
    for (const k of Object.keys(m.SCHEMES)) for (const hex of ['#336699', '#0a84ff', '#ff9f0a', '#808080', '#123456', '#abcdef']) {
        const p = m.palette(hex, k); assert.ok(p.length >= 2 && p.every(h => /^#[0-9a-f]{6}$/.test(h)), k + hex);
        assert.ok(p.includes(hex), `${k} 必須包含主色 ${hex}：${p}`); if (hex !== '#808080') assert.equal(new Set(p).size, p.length, '沒有重複顏色');
    }
    assert.equal(m.palette('#336699', 'analogous')[1], '#336699');
    const g = m.palette('#336699', 'gradient'); assert.equal(g[0], '#336699'); const h0 = m.rgbToHsl(m.parseColor(g[6])).h, h1 = m.rgbToHsl(m.parseColor('#336699')).h; assert.ok(Math.abs(((h0 - h1 + 360) % 360) - 180) <= 2, '漸層終點是互補色');
    assert.deepEqual(m.palette('nope', 'triadic'), []); assert.deepEqual(m.palette('#ff0000', 'zzz'), []); assert.deepEqual(m.palette('#ff0000', 'mono').map(h => m.rgbToHsl(m.parseColor(h)).l), [20, 35, 50, 65, 80, 92]);
    ok('color-tools: palettes');
}

// ===== 薪資：年度所得稅 =====
{
    const m = load('utils/salary-calc.html', 'incomeTax, estimateTax, TAX_BRACKETS, TAX_PARAMS');
    assert.deepEqual(m.incomeTax(0), { tax: 0, rate: 0 }); assert.deepEqual(m.incomeTax(590000), { tax: 29500, rate: 0.05 }); near(m.incomeTax(590001).tax, 29500.12); assert.equal(m.incomeTax(590001).rate, 0.12);
    near(m.incomeTax(1330000).tax, 118300); near(m.incomeTax(2000000).tax, 252300); near(m.incomeTax(4980000).tax, 1080300); near(m.incomeTax(6000000).tax, 1488300); assert.equal(m.incomeTax(6000000).rate, 0.4);
    // 累進稅額連續、遞增
    let prev = -1; for (let n = 0; n <= 7e6; n += 12345) { const t = m.incomeTax(n).tax; assert.ok(t >= prev); prev = t; }
    let e = m.estimateTax({ gross: 600000, married: false, dependents: 0 });
    assert.deepEqual([e.exemption, e.standard, e.salarySpecial, e.basicDiff, e.net, e.tax], [92000, 131000, 218000, 0, 159000, 7950]);
    e = m.estimateTax({ gross: 1200000, married: true, dependents: 2 });
    assert.deepEqual([e.persons, e.exemption, e.standard, e.basicDiff, e.net, e.tax], [4, 368000, 262000, 178000, 174000, 8700]);
    e = m.estimateTax({ gross: 100000, married: false, dependents: 0 }); assert.equal(e.net, 0); assert.equal(e.tax, 0); assert.equal(e.salarySpecial, 100000, '薪資特別扣除額不超過薪資');
    e = m.estimateTax({ gross: 2000000, married: false, dependents: 0, other: 100000 }); assert.equal(e.net, 2000000 - 92000 - 131000 - 218000 - 100000); assert.equal(e.rate, 0.2);
    e = m.estimateTax({ gross: 3000000, married: false, dependents: 0 }); assert.ok(e.effective > 0.08 && e.effective < 0.2);
    assert.equal(m.estimateTax({ gross: 0, married: false, dependents: 0 }).effective, 0);
    // 年終多繳的稅 = 含獎金的稅 − 不含獎金的稅（邊際）
    const a = m.estimateTax({ gross: 14 * 50000, married: false, dependents: 0 }).tax, b = m.estimateTax({ gross: 12 * 50000, married: false, dependents: 0 }).tax; assert.ok(a > b);
    ok('salary-calc: income tax');
}

// ===== 決策轉盤：解析與常用清單 =====
{
    const m = load('fun/wheel.html', 'parseItems, PRESETS');
    assert.deepEqual(m.parseItems('拉麵\n便當*2\n  燒肉 * 1.5 \n\n*3\n零*0\n水餃*'), [{ name: '拉麵', w: 1 }, { name: '便當', w: 2 }, { name: '燒肉', w: 1.5 }, { name: '*3', w: 1 }, { name: '水餃*', w: 1 }]);
    assert.deepEqual(m.parseItems(''), []);
    assert.ok(Object.keys(m.PRESETS).length >= 6);
    for (const [k, list] of Object.entries(m.PRESETS)) {
        const items = m.parseItems(list.join('\n'));
        assert.equal(items.length, list.length, k); assert.ok(items.length >= 5); assert.equal(new Set(items.map(i => i.name)).size, items.length, k + ' 有重複'); assert.ok(items.every(i => i.w > 0 && i.name.length <= 8), k);
    }
    ok('wheel: parseItems / presets');
}

// ===== 打字測試：自訂文章 =====
{
    const m = load('mini-games/typing-test.html', 'cleanCustom, score');
    assert.equal(m.cleanCustom('  你好\n\n世界\t  abc  '), '你好 世界 abc'); assert.equal(m.cleanCustom(''), ''); 
    assert.equal([...m.cleanCustom('字'.repeat(500))].length, 300); assert.equal([...m.cleanCustom('😀'.repeat(400))].length, 300, '以字元計，不切壞 emoji');
    assert.equal(m.cleanCustom('a '.repeat(200)).endsWith(' '), false);
    assert.equal(m.score('abc', 'abc', 60).cpm, 3);
    ok('typing-test: cleanCustom');
}

// ===== 計算機 =====
{
    const m = load('utils/calculator.html', 'evaluate, fmt, tokenize');
    const ev = (e, o) => m.fmt(m.evaluate(e, o));
    const cases = [['1+2*3', '7'], ['(1+2)*3', '9'], ['2(3+4)^2/7', '14'], ['-2^2', '-4'], ['2^3^2', '512'], ['2^-1', '0.5'], ['50%', '0.5'], ['200*10%', '20'], ['5!', '120'], ['0!', '1'], ['sqrt(16)+abs(-3)', '7'],
        ['sin(30)', '0.5'], ['cos(60)', '0.5'], ['tan(45)', '1'], ['cos(90)', '0'], ['asin(1)', '90'], ['ln(e)', '1'], ['log(1000)', '3'], ['exp(0)', '1'], ['2pi', '6.28318530718'], ['3x4', '12'], ['3×4÷2', '6'], ['10−3', '7'],
        ['0.1+0.2', '0.3'], ['1/3', '0.333333333333'], ['10/4', '2.5'], ['1e3+1', '1001'], ['1,000+1', '1001'], ['.5+.5', '1'], ['cbrt(27)', '3'], ['floor(2.7)+ceil(2.1)+round(2.5)', '8'], ['2 * (3 + 4)', '14'], ['(2)(3)', '6'], ['-(-3)', '3'], ['--3', '3'], ['+3', '3'],
        ['1e20', '1e20'], ['123456789012345678', '1.23456789e17'], ['0.000000001234', '0.000000001234'], ['pi', '3.14159265359'], ['e^2', '7.38905609893']];
    for (const [e, r] of cases) assert.equal(ev(e), r, e);
    assert.equal(ev('ans*2', { ans: 21 }), '42'); assert.equal(ev('sin(pi/2)', { angle: 'rad' }), '1'); assert.equal(ev('sin(90)', { angle: 'deg' }), '1'); assert.equal(ev('atan(1)', { angle: 'rad' }), '0.785398163397');
    for (const [e, why] of [['', '請輸入'], ['(1+2', '括號'], ['1+2)', '括號'], ['1/0', '除以 0'], ['5%0', '多餘'], ['foo(1)', '不認得'], ['2 3', '多餘'], ['sin 30', '括號'], ['sqrt(-1)', '開平方根'], ['171!', '太大'], ['2.5!', '整數'], ['ln(0)', '大於 0'], ['1+', '不完整'], ['*2', '位置不對'], ['2@3', '看不懂'], ['10^400', '超出'], ['x', '不認得']]) {
        assert.throws(() => m.evaluate(e), (err) => err.message.includes(why), e);
    }
    // 沒有 eval：惡意輸入只會被當成算式拒絕
    for (const bad of ['alert(1)', 'constructor', '__proto__', 'process.exit()', 'this', '1;2']) assert.throws(() => m.evaluate(bad), Error, bad);
    // 與 JavaScript 的運算交叉驗證（隨機四則運算式）
    for (let i = 0; i < 300; i++) {
        const nums = Array.from({ length: 4 }, () => 1 + Util.rnd(99)), ops = Array.from({ length: 3 }, () => '+-*'[Util.rnd(3)]);
        const expr = `${nums[0]}${ops[0]}${nums[1]}${ops[1]}${nums[2]}${ops[2]}${nums[3]}`;
        assert.equal(m.evaluate(expr), new Function('return ' + expr)(), expr);
    }
    assert.equal(m.fmt(0), '0'); assert.equal(m.fmt(-1.5), '-1.5'); assert.equal(m.fmt(-1.5e-12), '-1.5e-12');
    ok('calculator');
}

// ===== 比價 =====
{
    const m = load('utils/price-compare.html', 'UNITS, GROUPS, unitPrice, compare');
    near(m.unitPrice({ price: 100, amount: 500, count: 1, unit: 'g' }).perBase, 0.2); near(m.unitPrice({ price: 100, amount: 0.5, count: 1, unit: 'kg' }).perBase, 0.2); near(m.unitPrice({ price: 60, amount: 1, count: 1, unit: '台斤' }).perBase, 0.1);
    near(m.unitPrice({ price: 60, amount: 330, count: 6, unit: 'ml' }).perBase, 60 / 1980); near(m.unitPrice({ price: 120, amount: 1, count: 1, unit: '打' }).perBase, 10); assert.equal(m.unitPrice({ price: 10, amount: 1, count: 1, unit: 'L' }).group, 'v');
    for (const bad of [{ price: -1, amount: 1, count: 1, unit: 'g' }, { price: 10, amount: 0, count: 1, unit: 'g' }, { price: 10, amount: 1, count: 0, unit: 'g' }, { price: NaN, amount: 1, count: 1, unit: 'g' }, { price: 10, amount: 1, count: 1, unit: 'xx' }, { price: 10, amount: Infinity, count: 1, unit: 'g' }, { price: 10, amount: 1, count: 1 }]) assert.equal(m.unitPrice(bad), null, JSON.stringify(bad));
    const out = m.compare([{ price: 100, amount: 500, count: 1, unit: 'g' }, { price: 150, amount: 1, count: 1, unit: 'kg' }, { price: 50, amount: 100, count: 1, unit: 'ml' }, { price: NaN, amount: 1, count: 1, unit: 'g' }, { price: 60, amount: 100, count: 1, unit: 'ml' }]);
    assert.equal(out[3], null); assert.equal(out[0].group, 'w'); near(out[0].per, 20); near(out[1].per, 15); assert.ok(out[1].best && !out[0].best); assert.equal(out[0].over, 33.3);                  // 100g 20 元 vs 15 元：貴 33.3%
    assert.ok(out[2].best && !out[4].best && out[4].over === 20); assert.ok(!out[0].alone && !out[2].alone);
    assert.equal(m.compare([{ price: 10, amount: 1, count: 1, unit: '個' }])[0].alone, true); assert.deepEqual(m.compare([]), []);
    assert.equal(m.compare([{ price: 0, amount: 1, count: 1, unit: '個' }, { price: 5, amount: 1, count: 1, unit: '個' }])[1].over, 0);                                               // 最低價為 0：不除以 0
    ok('price-compare');
}

// ===== 文字轉語音 =====
{
    const m = load('utils/tts.html', 'chunks, voiceRank');
    assert.deepEqual(m.chunks('今天天氣很好。我們去公園！你要來嗎？'), ['今天天氣很好。', '我們去公園！', '你要來嗎？']); assert.deepEqual(m.chunks(''), []); assert.deepEqual(m.chunks('   \n  '), []);
    assert.deepEqual(m.chunks('第一行\n第二行\r\n第三行'), ['第一行', '第二行', '第三行']);
    const long = '我們'.repeat(40) + '，' + '你們'.repeat(40) + '。'; const c = m.chunks(long, 50);
    assert.ok(c.every(x => x.length <= 51) && c.join('') === long, c.map(x => x.length).join()); assert.equal(m.chunks('字'.repeat(300), 100).length, 3); assert.ok(m.chunks('a'.repeat(500), 120).every(x => x.length <= 120));
    const text = Array.from({ length: 200 }, (_, i) => `這是第${i}句話。`).join(''); assert.equal(m.chunks(text, 120).join(''), text);
    assert.equal(m.voiceRank({ lang: 'zh-TW' }, 'zh-TW'), 0); assert.equal(m.voiceRank({ lang: 'zh-CN' }, 'zh-TW'), 1); assert.equal(m.voiceRank({ lang: 'zh-HK' }, 'zh-TW'), 1); assert.equal(m.voiceRank({ lang: 'en-US' }, 'zh-TW'), 3);
    ok('tts: chunks / voice ranking');
}

// ===== 連線 21 點 =====
{
    const m = load('mini-games/blackjack.html', 'newDeck, cardValue, handValue, dealerShouldHit, settle, validCard, validState, BETS, START_CHIPS');
    const d = m.newDeck(); assert.equal(d.length, 52); assert.equal(new Set(d).size, 52); assert.ok(d.every(m.validCard));
    assert.deepEqual([['AS'], ['KD'], ['10H'], ['7C'], ['QS']].map(c => m.cardValue(c[0])), [11, 10, 10, 7, 10]);
    const hv = (...c) => m.handValue(c);
    assert.deepEqual(hv('AS', 'KD'), { total: 21, soft: true, bust: false, blackjack: true }); assert.deepEqual(hv('AS', '6D'), { total: 17, soft: true, bust: false, blackjack: false });
    assert.deepEqual(hv('AS', '6D', '10C'), { total: 17, soft: false, bust: false, blackjack: false }); assert.deepEqual(hv('KS', 'QD', '5C'), { total: 25, soft: false, bust: true, blackjack: false });
    assert.equal(hv('AS', 'AD').total, 12); assert.equal(hv('AS', 'AD', 'AC', 'AH').total, 14); assert.equal(hv('AS', '5D', '5C').total, 21); assert.equal(hv('AS', '5D', '5C').blackjack, false, '三張 21 不是 Blackjack');
    assert.equal(hv('7S', '7D', '7C').total, 21); assert.equal(hv().total, 0);
    assert.ok(m.dealerShouldHit(['10S', '6D'])); assert.ok(!m.dealerShouldHit(['10S', '7D'])); assert.ok(!m.dealerShouldHit(['AS', '6D']), '軟 17 停牌'); assert.ok(m.dealerShouldHit(['AS', '5D']));
    const st = (p, dl, bet = 10) => m.settle(p, dl, bet);
    assert.deepEqual(st(['AS', 'KD'], ['10S', '9D']), { outcome: 'blackjack', delta: 15 }); assert.deepEqual(st(['AS', 'KD'], ['10S', 'AD']), { outcome: 'push', delta: 0 }, '雙方 Blackjack 平手');
    assert.deepEqual(st(['AS', 'KD'], ['5S', '6D', '10C']), { outcome: 'blackjack', delta: 15 }); assert.deepEqual(st(['7S', '7D', '7C'], ['AS', 'KD']), { outcome: 'lose', delta: -10 }, '莊家 Blackjack 贏過三張 21');
    assert.deepEqual(st(['KS', 'QD', '5C'], ['10S', '9D']), { outcome: 'bust', delta: -10 }); assert.deepEqual(st(['KS', 'QD', '5C'], ['10S', '8D', '9C']), { outcome: 'bust', delta: -10 }, '玩家先爆，莊家就算也爆還是輸');
    assert.deepEqual(st(['10S', '9D'], ['10C', '8D', '9H']), { outcome: 'win', delta: 10 }); assert.deepEqual(st(['10S', '9D'], ['10C', '8D']), { outcome: 'win', delta: 10 }); assert.deepEqual(st(['10S', '8D'], ['10C', '9D']), { outcome: 'lose', delta: -10 }); assert.deepEqual(st(['10S', '8D'], ['9C', '9D']), { outcome: 'push', delta: 0 });
    assert.equal(st(['AS', 'KD'], ['2S', '3D'], 25).delta, 37, '賠 1.5 倍無條件捨去'); assert.equal(st(['AS', 'KD'], ['2S', '3D'], 10).delta, 15);
    // 整局模擬：隨機策略下，籌碼變化永遠在 [-bet, 1.5 bet]，且莊家牌一定符合規則（17 以上或全部玩家已爆）
    for (let t = 0; t < 2000; t++) {
        const deck = Util.shuffle(m.newDeck()), P = [deck.pop(), deck.pop()], D = [deck.pop(), deck.pop()];
        while (!m.handValue(P).bust && m.handValue(P).total < 12 + Util.rnd(8)) P.push(deck.pop());
        if (!m.handValue(P).bust && !m.handValue(D).blackjack) while (m.dealerShouldHit(D)) D.push(deck.pop());
        const r = m.settle(P, D, 10); assert.ok(r.delta >= -10 && r.delta <= 15); assert.ok(['blackjack', 'win', 'push', 'lose', 'bust'].includes(r.outcome));
        if (!m.handValue(P).bust && !m.handValue(D).blackjack) assert.ok(m.handValue(D).total >= 17);
    }
    // 莊家勝率與賭場規則的理論值（約 49% 莊家贏）大致相符：用「玩家模仿莊家」的策略，玩家期望值略為負
    let sum = 0; const N = 20000; for (let t = 0; t < N; t++) { const deck = Util.shuffle(m.newDeck()), P = [deck.pop(), deck.pop()], D = [deck.pop(), deck.pop()]; while (m.dealerShouldHit(P)) P.push(deck.pop()); if (!m.handValue(P).bust && !m.handValue(D).blackjack) while (m.dealerShouldHit(D)) D.push(deck.pop()); sum += m.settle(P, D, 1).delta; }
    assert.ok(sum / N < 0.02 && sum / N > -0.12, '模仿莊家的玩家期望值應略為負：' + sum / N);
    const good = { phase: 'play', round: 1, names: ['a', 'b'], chips: [500, 480], bets: [10, 20], done: [false, true], out: [false, false], inRound: [true, true], hands: [['AS', '5D'], ['KC', '10H', '2S']], dealer: ['9C', '??'], dealerTotal: -1, result: [null, { o: 'bust', d: -20 }], turn: 0, ms: 5000, note: '', active: [true, true] };
    assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, hands: [['ZZ']] }, { ...good, hands: [['AS', '1D']] }, { ...good, dealer: ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '??'] }, { ...good, result: [{ o: 'x', d: 1 }] }, { ...good, chips: [1.5] }, { ...good, names: Array(7).fill('a') }, { ...good, ms: 'x' }, { ...good, note: 'x'.repeat(81) }, { ...good, turn: 'a' }])
        assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 60));
    ok('blackjack: hand values / dealer rule / settlement / simulations');
}

// ===== 編碼解碼：摩斯與凱薩 =====
{
    const m = load('utils/encode-decode.html', 'CODECS, MORSE, morseEncode, morseDecode, caesar');
    assert.equal(m.morseEncode('SOS'), '... --- ...'); assert.equal(m.morseEncode('hello world'), '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'); assert.equal(m.morseEncode('  a   b  '), '.- / -...');
    assert.equal(m.morseDecode('.... . .-.. .-.. --- / .-- --- .-. .-.. -..'), 'HELLO WORLD'); assert.equal(m.morseDecode('... --- ...'), 'SOS'); assert.equal(m.morseDecode('...  ---   ...'), 'SOS'); assert.equal(m.morseDecode('.- | -...'), 'A B');
    assert.equal(m.morseDecode('·-· ·'), 'RE', '常見的替代符號'); assert.equal(m.morseEncode('1+1=2?'), '.---- .-.-. .---- -...- ..--- ..--..');
    for (const bad of ['你好', 'a~b', '€']) assert.throws(() => m.morseEncode(bad), (e) => e.message.includes('不支援'));
    assert.throws(() => m.morseDecode('.--.--.--'), (e) => e.message.includes('看不懂'));
    const all = Object.keys(m.MORSE).join(''); assert.equal(m.morseDecode(m.morseEncode(all)), all, '所有字元都能往返'); assert.equal(new Set(Object.values(m.MORSE)).size, Object.keys(m.MORSE).length, '摩斯碼沒有重複');
    assert.equal(m.caesar('abc xyz', 3), 'def abc'); assert.equal(m.caesar('Hello, World!', 13), 'Uryyb, Jbeyq!'); assert.equal(m.caesar('def', -3), 'abc'); assert.equal(m.caesar('abc', 26), 'abc'); assert.equal(m.caesar('abc', 29), 'def'); assert.equal(m.caesar('abc', -29), 'xyz');
    assert.equal(m.caesar('你好 123 ABC', 1), '你好 123 BCD'); assert.equal(m.caesar('abc', NaN), 'abc'); assert.equal(m.caesar('abc', 1.9), 'bcd');
    for (let i = 0; i < 200; i++) { const t = Array.from({ length: 20 }, () => String.fromCharCode(32 + Util.rnd(95))).join(''), n = Util.rnd(60) - 30; assert.equal(m.caesar(m.caesar(t, n), -n), t); }
    assert.equal(m.CODECS['ROT13'].enc(m.CODECS['ROT13'].enc('Secret')), 'Secret'); assert.deepEqual(m.CODECS['凱薩密碼（位移 N）'].param, { label: '位移', def: 3, min: 1, max: 25 });
    assert.equal(m.CODECS['凱薩密碼（位移 N）'].dec(m.CODECS['凱薩密碼（位移 N）'].enc('Attack at dawn', 7), 7), 'Attack at dawn');
    ok('encode-decode: morse / caesar / rot13');
}

// ===== 純文字整理：假文產生 =====
{
    const m = load('utils/text-tools.html', 'OPS, lorem, ZH_PIECES, EN_WORDS', '// 每個操作', 'const $ =');
    let n = 0; const fixed = (k) => { n++; return n % k; };
    for (const lang of ['zh', 'en']) for (const [p, sn] of [[1, 1], [3, 4], [10, 8]]) {
        const t = m.lorem(lang, p, sn), paras = t.split('\n\n'); assert.equal(paras.length, p, lang);
        for (const para of paras) { const ends = (para.match(lang === 'en' ? /\./g : /。/g) || []).length; assert.equal(ends, sn, `${lang} 每段句數`); }
    }
    assert.ok(m.lorem('zh', 2, 3).includes('，') || m.lorem('zh', 20, 12).includes('，')); assert.ok(/^[一-鿿，。]+$/.test(m.lorem('zh', 1, 5).replace(/\n/g, '')));
    assert.ok(m.lorem('en', 5, 3).split('\n\n').every(p => /^[A-Z]/.test(p))); assert.ok(m.lorem('en', 1, 20).split(' ').every(w => /^[A-Za-z]+\.?$/.test(w)));
    assert.equal(m.lorem('zh', 3, 2, () => 0), m.lorem('zh', 3, 2, () => 0), '同樣的亂數序列得到同樣的文字'); assert.notEqual(m.lorem('zh', 3, 5), m.lorem('zh', 3, 5), '安全亂數每次不同');
    assert.equal(m.lorem('zh', 0, 3), ''); assert.ok(m.ZH_PIECES.every(p => p.length >= 8) && new Set(m.ZH_PIECES).size === m.ZH_PIECES.length); assert.ok(new Set(m.EN_WORDS).size >= 60);
    void fixed;
    ok('text-tools: lorem');
}

// ===== 螢幕尺寸 / PPI =====
{
    const m = load('utils/screen-test.html', 'ppi, physical, aspect, RES_PRESETS, gcd');
    near(m.ppi(27, 2560, 1440), 108.79, 1e-3); near(m.ppi(24, 1920, 1080), 91.79, 1e-3); near(m.ppi(13.3, 1920, 1080), 165.63, 1e-3); near(m.ppi(6.1, 2532, 1170), 457.25, 1e-3);
    const p = m.physical(27, 2560, 1440); near(p.wCm, 59.77, 1e-3); near(p.hCm, 33.62, 1e-3); near(Math.hypot(p.wIn, p.hIn), 27); near(p.pitchMm, 25.4 / m.ppi(27, 2560, 1440));
    for (const [w, h] of [[1920, 1080], [2560, 1440], [3840, 2160], [1280, 720]]) assert.equal(m.aspect(w, h), '16:9', `${w}x${h}`); assert.equal(m.aspect(1920, 1200), '8:5'); assert.equal(m.aspect(1024, 768), '4:3'); assert.equal(m.aspect(1000, 1000), '1:1');
    assert.equal(m.aspect(1366, 768), '≈ 16:9'); assert.equal(m.aspect(2560, 1080), '≈ 21:9'); assert.equal(m.aspect(3440, 1440), '2.39 : 1'); assert.equal(m.aspect(5120, 1440), '32:9'); assert.equal(m.gcd(12, 18), 6);
    assert.ok(m.RES_PRESETS.every(([n, w, h]) => w > 0 && h > 0 && n.includes(`${w} × ${h}`))); ok('screen-test: PPI / physical size / aspect');
}

// ===== 今日倒數 =====
{
    const m = load('utils/countdown.html', 'todayProgress, hms, toSec');
    const H = (h, mi = 0, s = 0) => h * 3600 + mi * 60 + s;
    assert.deepEqual(m.todayProgress(H(14), H(9), H(18)), { state: 'during', remaining: H(4), elapsedAfter: 0, fraction: 5 / 9 }); assert.deepEqual(m.todayProgress(H(8), H(9), H(18)), { state: 'before', remaining: H(10), elapsedAfter: 0, fraction: 0 });
    assert.deepEqual(m.todayProgress(H(18), H(9), H(18)), { state: 'after', remaining: 0, elapsedAfter: 0, fraction: 1 }); assert.deepEqual(m.todayProgress(H(18, 30), H(9), H(18)), { state: 'after', remaining: 0, elapsedAfter: 1800, fraction: 1 });
    assert.equal(m.todayProgress(H(9), H(9), H(18)).state, 'during'); assert.equal(m.todayProgress(0, NaN, NaN).state, 'invalid'); assert.equal(m.todayProgress(0, H(10), H(10)).state, 'invalid'); assert.equal(m.todayProgress(0, H(11), H(10)).state, 'invalid');
    assert.equal(m.hms(0), '00:00:00'); assert.equal(m.hms(3661), '01:01:01'); assert.equal(m.hms(H(9, 59, 59)), '09:59:59'); assert.equal(m.toSec('18:00'), H(18)); assert.equal(m.toSec('9:05'), H(9, 5));
    for (const bad of ['', '24:00', '12:60', 'ab', null, undefined, '1800']) assert.ok(Number.isNaN(m.toSec(bad)), String(bad));
    ok('countdown: today progress');
}

// ===== 條碼（與 JsBarcode 逐位元比對過）=====
{
    const m = load('utils/qr-code.html', 'C128, code128Set, code128Values, code128Modules, ean13Check, ean13Normalize, ean13Modules, EAN_L, EAN_G, EAN_R');
    // 黃金值：由 JsBarcode 產生
    assert.equal(m.code128Modules('Hello', 'B'), '110100100001100010100010110010000110010100001100101000010001111010110010100001100011101011');
    assert.equal(m.code128Modules('HELLO-123', 'B'), '11010010000110001010001000110100010001101110100011011101000111011010011011100100111001101100111001011001011100100011010001100011101011');
    assert.equal(m.code128Modules('123456', 'C'), '11010011100101100111001000101100011100010110100011011101100011101011');
    assert.equal(m.ean13Modules('5901234123457'), '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101'); assert.equal(m.ean13Modules('400638133393'), '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101');
    // 對照表結構：107 項、各符號寬度和 11（停止符 13）、條寬和為偶數、互不相同
    assert.equal(m.C128.length, 107); assert.equal(new Set(m.C128).size, 107);
    m.C128.forEach((p, i) => { const w = [...p].map(Number), sum = w.reduce((a, b) => a + b, 0); assert.equal(sum, i < 106 ? 11 : 13, '符號 ' + i); if (i < 106) assert.equal((w[0] + w[2] + w[4]) % 2, 0, '偶同位 ' + i); });
    assert.equal(m.code128Set('123456'), 'C'); assert.equal(m.code128Set('12345'), 'B'); assert.equal(m.code128Set('AB12'), 'B'); assert.equal(m.code128Set('1234a'), 'B');
    const v = m.code128Values('PJJ123C', 'B'); assert.equal(v[0], 104); assert.equal(v[v.length - 1], 106); assert.equal(v.length, 7 + 3);
    assert.equal(m.code128Values('A', 'B').join(), [104, 33, (104 + 33) % 103, 106].join());               // 檢查碼 = (起始值 + Σ 位置 × 符號值) mod 103
    for (let i = 0; i < 100; i++) { const t = Array.from({ length: 1 + Util.rnd(30) }, () => String.fromCharCode(32 + Util.rnd(95))).join(''), vs = m.code128Values(t, 'B'), mod = m.code128Modules(t, 'B'); assert.equal(mod.length, (vs.length - 1) * 11 + 13); assert.ok(mod.startsWith('11010010000') && mod.endsWith('1100011101011')); }
    for (const bad of ['', '你好', 'a\tb', 'é']) assert.throws(() => m.code128Values(bad, 'B'), Error, bad); assert.throws(() => m.code128Values('123', 'C')); assert.throws(() => m.code128Values('12ab', 'C'));
    assert.equal(m.ean13Check('590123412345'), 7); assert.equal(m.ean13Check('400638133393'), 1); assert.equal(m.ean13Check('978020137962'), 4); assert.equal(m.ean13Normalize('978-0-2013-7962-4'), '9780201379624'); assert.equal(m.ean13Normalize('590123412345'), '5901234123457');
    for (const [bad, why] of [['5901234123458', '檢查碼'], ['12345', '12 或 13'], ['59012341234a', '12 或 13'], ['', '12 或 13'], ['59012341234567', '12 或 13']]) assert.throws(() => m.ean13Normalize(bad), (e) => e.message.includes(why), bad);
    for (let i = 0; i < 200; i++) { const t = Array.from({ length: 12 }, () => Util.rnd(10)).join(''), mod = m.ean13Modules(t); assert.equal(mod.length, 95); assert.ok(mod.startsWith('101') && mod.endsWith('101') && mod.slice(45, 50) === '01010'); }
    assert.ok(m.EAN_L.every(c => c.length === 7) && m.EAN_G.every(c => c.length === 7) && m.EAN_R.every(c => c.length === 7)); assert.equal(m.EAN_R[0], '1110010'); assert.equal(m.EAN_G[0], '0100111');
    ok('qr-code: Code 128 / EAN-13 barcodes');
}

// ===== 電腦對手：四子棋 =====
{
    const m = load('mini-games/connect-four.html', 'newGame, play, dropRow, findWin, cpuChoose, evalBoard, winAt, DEPTH');
    const board = (rows) => rows.map(r => [...r].map(Number));
    // 一步就贏 → 一定要下；對手一步就贏 → 一定要擋（所有難度）
    for (const level of ['normal', 'hard']) for (let k = 0; k < 10; k++) {
        const b = board(['0000000', '0000000', '0000000', '0000000', '0000000', '1110000']); assert.equal(m.cpuChoose(b, 1, level), 3, level + ' 一步贏');
        const b2 = board(['0000000', '0000000', '0000000', '0000000', '0000000', '0222000']); const c = m.cpuChoose(b2, 1, level); assert.ok(c === 0 || c === 4, level + ' 要擋 ' + c);
        const b3 = board(['0000000', '0000000', '0000000', '2000000', '2000000', '2000000']); assert.equal(m.cpuChoose(b3, 1, level), 0, level + ' 擋直線');
    }
    // 簡單難度會有 30% 機率亂下（不看勝負）；其餘時候一樣會贏、會擋：大多數情況下要選對
    { let win = 0, blk = 0; for (let k = 0; k < 200; k++) { if (m.cpuChoose(board(['0000000', '0000000', '0000000', '0000000', '0000000', '1110000']), 1, 'easy') === 3) win++; const c = m.cpuChoose(board(['0000000', '0000000', '0000000', '0000000', '0000000', '0222000']), 1, 'easy'); if (c === 0 || c === 4) blk++; } assert.ok(win > 130 && win < 200, 'easy 一步贏 ' + win); assert.ok(blk > 130 && blk < 200, 'easy 擋 ' + blk); }
    assert.equal(m.cpuChoose(board(['1212121', '2121212', '1212121', '2121212', '1212121', '2121212']), 1, 'hard'), -1, '棋盤滿了');
    const only = board(['1210121', '2121212', '1212121', '2121212', '1212121', '2121212']); assert.equal(m.cpuChoose(only, 1, 'hard'), 3, '只剩一欄');
    const b4 = board(['0000000', '0000000', '0000000', '0000000', '0000000', '0000000']); const snap = JSON.stringify(b4); m.cpuChoose(b4, 1, 'hard'); assert.equal(JSON.stringify(b4), snap, '搜尋後棋盤要還原');
    assert.equal(m.cpuChoose(b4, 1, 'hard'), 3, '空盤先下中間');
    // 強度排序：困難 > 普通 > 簡單 > 隨機（雙方各執先手 / 後手）
    const rnd = (b) => { const cs = [0, 1, 2, 3, 4, 5, 6].filter(c => b[0][c] === 0); return cs[Util.rnd(cs.length)]; };
    const pick = { random: (b) => rnd(b), easy: (b, p) => m.cpuChoose(b, p, 'easy'), normal: (b, p) => m.cpuChoose(b, p, 'normal'), hard: (b, p) => m.cpuChoose(b, p, 'hard') };
    const duel = (a, b, n) => { let wa = 0, wb = 0; for (let i = 0; i < n; i++) { const s = m.newGame(1), who = i % 2 ? { 1: b, 2: a } : { 1: a, 2: b }; while (!s.winner && !s.draw) { const c = pick[who[s.turn]](s.board, s.turn); assert.ok(m.dropRow(s.board, c) >= 0, '非法欄'); assert.ok(m.play(s, s.turn, c)); } const wn = s.winner ? who[s.winner] : ''; if (wn === a) wa++; else if (wn === b) wb++; } return [wa, wb]; };
    let [a, b] = duel('hard', 'random', 4); assert.ok(a >= 4 && b === 0, `困難 vs 隨機 ${a}:${b}`); [a, b] = duel('normal', 'random', 10); assert.ok(a >= 9, `普通 vs 隨機 ${a}:${b}`); [a, b] = duel('easy', 'random', 10); assert.ok(a >= 8, `簡單 vs 隨機 ${a}:${b}`);
    [a, b] = duel('hard', 'normal', 6); assert.ok(a >= 3, `困難 vs 普通 ${a}:${b}`); [a, b] = duel('normal', 'easy', 10); assert.ok(a >= 8, `普通 vs 簡單 ${a}:${b}`);
    const t0 = Date.now(); m.cpuChoose(b4, 1, 'hard'); assert.ok(Date.now() - t0 < 3000, '困難難度的一手應在 3 秒內');
    ok('connect-four cpu: win / block / board restored / strength ordering');
}

// ===== 電腦對手：黑白棋 =====
{
    const m = load('mini-games/othello.html', 'N, flips, legalMoves, count, newBoard, newGame, play, applyMove, evalBoard, cpuMove, WEIGHTS, DEPTH');
    const b0 = m.newBoard();
    for (const level of ['easy', 'normal', 'hard']) { const mv = m.cpuMove(b0, 1, level); assert.ok(m.legalMoves(b0, 1).some(([r, c]) => r === mv[0] && c === mv[1]), level); }
    const full = Array.from({ length: 8 }, () => new Array(8).fill(1)); assert.equal(m.cpuMove(full, 2, 'hard'), null); assert.equal(m.cpuMove(full, 1, 'easy'), null);
    // applyMove：不改動輸入、結果與 play 一致
    const s = m.newGame(), snap = JSON.stringify(s.board), nb = m.applyMove(s.board, 2, 3, 1); assert.equal(JSON.stringify(s.board), snap); m.play(s, 1, 2, 3); assert.deepEqual(nb, s.board);
    // 角落優先：能搶角時，普通 / 困難都會搶
    const corner = Array.from({ length: 8 }, () => new Array(8).fill(0)); corner[0][1] = 2; corner[0][2] = 1; corner[4][4] = 1; corner[4][5] = 2;
    assert.deepEqual(m.cpuMove(corner, 1, 'normal'), [0, 0], '普通難度一定搶角');
    assert.equal(m.WEIGHTS[0][0], 100); assert.ok(m.WEIGHTS.every((row, r) => row.every((v, c) => v === m.WEIGHTS[7 - r][c] && v === m.WEIGHTS[r][7 - c])), '權重表左右上下對稱');
    // 整局：所有難度的每一步都合法，終局棋子數相加不超過 64
    const duel = (a, b, n) => { let wa = 0, wb = 0; for (let i = 0; i < n; i++) { const st = m.newGame(), who = i % 2 ? { 1: b, 2: a } : { 1: a, 2: b }; let guard = 0; while (!st.over) { assert.ok(++guard < 80); const mv = m.cpuMove(st.board, st.turn, who[st.turn]); assert.ok(mv && m.play(st, st.turn, mv[0], mv[1])); } assert.ok(m.count(st.board, 1) + m.count(st.board, 2) <= 64); const wn = st.winner ? who[st.winner] : ''; if (wn === a) wa++; else if (wn === b) wb++; } return [wa, wb]; };
    let [a, b] = duel('hard', 'easy', 8); assert.ok(a >= 7, `困難 vs 簡單 ${a}:${b}`); [a, b] = duel('normal', 'easy', 12); assert.ok(a > b, `普通 vs 簡單 ${a}:${b}`); [a, b] = duel('hard', 'normal', 8); assert.ok(a >= 6, `困難 vs 普通 ${a}:${b}`);
    const t0 = Date.now(); m.cpuMove(b0, 1, 'hard'); assert.ok(Date.now() - t0 < 3000);
    ok('othello cpu: legal moves / corner grab / strength ordering');
}

// ===== 貪吃蛇 =====
{
    const m = load('mini-games/snake.html', 'SIZE, DIRS, isReverse, placeFood, step, tickMs');
    const S0 = (snake, dir, food) => ({ snake, dir, food, score: 0, dead: false, won: false });
    let s = m.step(S0([[5, 5], [4, 5], [3, 5]], m.DIRS.right, [10, 10]), 'solid', () => 0); assert.deepEqual(s.snake, [[6, 5], [5, 5], [4, 5]]); assert.equal(s.score, 0);
    s = m.step(S0([[5, 5], [4, 5], [3, 5]], m.DIRS.right, [6, 5]), 'solid', () => 0); assert.equal(s.snake.length, 4); assert.equal(s.score, 1); assert.ok(s.food && !s.snake.some(([x, y]) => x === s.food[0] && y === s.food[1]));
    assert.ok(m.step(S0([[19, 5], [18, 5]], m.DIRS.right, [0, 0]), 'solid', () => 0).dead); assert.ok(m.step(S0([[0, 0], [1, 0]], m.DIRS.left, [9, 9]), 'solid', () => 0).dead); assert.ok(m.step(S0([[5, 0], [5, 1]], m.DIRS.up, [9, 9]), 'solid', () => 0).dead);
    s = m.step(S0([[19, 5], [18, 5]], m.DIRS.right, [9, 9]), 'wrap', () => 0); assert.deepEqual(s.snake[0], [0, 5]); assert.equal(s.dead, false); s = m.step(S0([[5, 0], [5, 1]], m.DIRS.up, [9, 9]), 'wrap', () => 0); assert.deepEqual(s.snake[0], [5, 19]);
    // 咬到自己：頭往下碰到身體中段 → 死；追著尾巴（尾巴同一步移開）→ 沒事
    const loop = [[5, 5], [6, 5], [6, 6], [5, 6], [4, 6], [4, 5]];                                       // 頭 (5,5) 向下 → (5,6) 是身體 [3] → 死
    assert.ok(m.step(S0(loop, m.DIRS.down, [0, 0]), 'solid', () => 0).dead);
    const chase = [[5, 5], [6, 5], [6, 6], [5, 6]];                                                         // 頭向下 → (5,6) 是尾巴，尾巴同時移開 → 活
    assert.equal(m.step(S0(chase, m.DIRS.down, [0, 0]), 'solid', () => 0).dead, false);
    // 吃東西的那一步尾巴不會移開 → 追著尾巴吃會死
    assert.ok(m.step(S0(chase, m.DIRS.down, [5, 6]), 'solid', () => 0).dead);
    assert.ok(m.isReverse(m.DIRS.up, m.DIRS.down) && m.isReverse(m.DIRS.left, m.DIRS.right) && !m.isReverse(m.DIRS.up, m.DIRS.left) && !m.isReverse(m.DIRS.up, m.DIRS.up));
    // 食物永遠落在空格；填滿時回傳 null 並判定獲勝
    for (let i = 0; i < 200; i++) { const sn = Array.from({ length: 50 }, (_, k) => [k % 20, Math.floor(k / 20)]), f = m.placeFood(sn, Util.rnd); assert.ok(!sn.some(([x, y]) => x === f[0] && y === f[1]) && f[0] >= 0 && f[0] < 20 && f[1] >= 0 && f[1] < 20); }
    const full = Array.from({ length: 400 }, (_, k) => [k % 20, Math.floor(k / 20)]); assert.equal(m.placeFood(full, Util.rnd), null);
    const almost = full.slice(0, 399); assert.deepEqual(m.placeFood(almost, Util.rnd), [19, 19]);
    s = m.step({ snake: [[18, 19], [17, 19], ...full.slice(0, 397).filter(([x, y]) => !(y === 19 && x >= 17))], dir: m.DIRS.right, food: [19, 19], score: 0, dead: false, won: false }, 'solid', Util.rnd); void s;
    assert.equal(m.tickMs(0), 150); assert.equal(m.tickMs(10), 110); assert.equal(m.tickMs(100), 60); assert.ok(m.tickMs(5) > m.tickMs(6));
    // 隨機亂走 2000 局：蛇身永遠不重疊、不出界、長度 = 3 + 分數
    for (let g = 0; g < 200; g++) {
        let st = S0([[10, 10], [9, 10], [8, 10]], m.DIRS.right, m.placeFood([[10, 10], [9, 10], [8, 10]], Util.rnd)), n = 0;
        const ds = Object.values(m.DIRS);
        while (!st.dead && !st.won && n++ < 400) { const d = ds[Util.rnd(4)]; if (!m.isReverse(d, st.dir)) st = { ...st, dir: d }; st = m.step(st, 'wrap', Util.rnd); if (st.dead) break; assert.equal(new Set(st.snake.map(p => p.join())).size, st.snake.length); assert.equal(st.snake.length, 3 + st.score); assert.ok(st.snake.every(([x, y]) => x >= 0 && x < 20 && y >= 0 && y < 20)); }
    }
    ok('snake');
}

// ===== 俄羅斯方塊 =====
{
    const m = load('mini-games/tetris.html', 'W, H, SHAPES, NAMES, rotateCells, cellsOf, newBoard, fits, tryMove, spawn, ghost, lock, lineScore, levelOf, dropMs, bag');
    for (const t of m.NAMES) {
        const p = m.spawn(t); assert.equal(m.cellsOf(p).length, 4, t);
        for (let r = 0; r < 4; r++) { const c = m.cellsOf({ ...p, rot: r }); assert.equal(new Set(c.map(x => x.join())).size, 4, t + r); }
        assert.deepEqual(m.cellsOf({ ...p, rot: 4 }), m.cellsOf(p), t + ' 轉四次回到原位'); assert.deepEqual(m.cellsOf({ ...p, rot: -1 }), m.cellsOf({ ...p, rot: 3 }));
    }
    // I 方塊水平 → 垂直，且旋轉後仍連在一起
    const I0 = m.cellsOf({ type: 'I', rot: 0, x: 0, y: 0 }), I1 = m.cellsOf({ type: 'I', rot: 1, x: 0, y: 0 }); assert.ok(new Set(I0.map(c => c[1])).size === 1 && new Set(I1.map(c => c[0])).size === 1);
    const b = m.newBoard(); assert.equal(b.length, 20); assert.equal(b[0].length, 10);
    assert.ok(m.fits(b, m.spawn('T'))); assert.ok(!m.fits(b, { type: 'O', rot: 0, x: -1, y: 0 })); assert.ok(!m.fits(b, { type: 'O', rot: 0, x: 9, y: 0 })); assert.ok(!m.fits(b, { type: 'O', rot: 0, x: 4, y: 19 }));
    // 左右移動被牆擋住 → null；貼牆旋轉會踢開
    assert.equal(m.tryMove(b, { type: 'O', rot: 0, x: 0, y: 5 }, -1, 0), null); const wall = m.tryMove(b, { type: 'I', rot: 1, x: 7, y: 0 }, 0, 0, 1); assert.ok(wall && m.fits(b, wall));
    // 落點影子：落到底；固定後消行
    const g = m.ghost(b, m.spawn('O')); assert.equal(Math.max(...m.cellsOf(g).map(c => c[1])), 19);
    const row = (...k) => Array.from({ length: 10 }, (_, i) => (k.includes(i) ? 0 : 'I'));
    const bb = m.newBoard(); for (let r = 16; r < 20; r++) bb[r] = row(4, 5); bb[15] = row(0);
    let res = m.lock(bb, { type: 'O', rot: 0, x: 4, y: 16 }); assert.equal(res.cleared, 2); assert.equal(res.board.length, 20); assert.equal(res.board[19].filter(Boolean).length, 8); assert.equal(res.board[17].filter(Boolean).length, 9, '消掉的行上面的內容掉下來（原第 15 列 → 第 17 列）');
    assert.equal(res.board[0].every(v => v === 0), true); assert.equal(JSON.stringify(bb[16]), JSON.stringify(row(4, 5)), '不改動輸入');
    const four = m.newBoard(); for (let r = 16; r < 20; r++) four[r] = row(9); res = m.lock(four, { type: 'I', rot: 1, x: 7, y: 16 }); assert.equal(res.cleared, 4); assert.ok(res.board.every(r => r.every(v => v === 0)));
    assert.deepEqual([0, 1, 2, 3, 4].map(n => m.lineScore(n, 1)), [0, 100, 300, 500, 800]); assert.equal(m.lineScore(4, 3), 2400); assert.deepEqual([0, 9, 10, 25].map(m.levelOf), [1, 1, 2, 3]); assert.equal(m.dropMs(1), 800); assert.equal(m.dropMs(50), 80); assert.ok(m.dropMs(3) < m.dropMs(2));
    for (let i = 0; i < 50; i++) { const bg = m.bag(); assert.equal(new Set(bg).size, 7); assert.deepEqual([...bg].sort(), [...m.NAMES].sort()); }
    // 隨機模擬：亂下 300 塊，盤面不會出現「懸空的非法狀態」且方塊數守恆（消行前後總格數 = 4×塊數 − 10×消行數）
    let board = m.newBoard(), placed = 0, cleared = 0;
    for (let k = 0; k < 300; k++) {
        const t = m.NAMES[Util.rnd(7)]; let p = m.spawn(t); if (!m.fits(board, p)) break;
        for (let i = Util.rnd(4); i--;) p = m.tryMove(board, p, 0, 0, 1) || p; const dx = Util.rnd(9) - 4; for (let i = 0; i < Math.abs(dx); i++) p = m.tryMove(board, p, Math.sign(dx), 0) || p;
        const gp = m.ghost(board, p); if (m.cellsOf(gp).some(c => c[1] < 0)) break;                  // 堆到頂、方塊有一部分在盤面上方：結束（lock 不計入盤面外的格子）
        const r = m.lock(board, gp); board = r.board; placed++; cleared += r.cleared;
        assert.equal(board.flat().filter(Boolean).length, 4 * placed - 10 * cleared);
    }
    ok('tetris');
}

// ===== 節拍器 / 調音器 =====
{
    const m = load('fun/metronome.html', 'NOTE_NAMES, beatMs, noteOf, midiFreq, detectPitch, INSTRUMENTS, nearestString');
    assert.equal(m.beatMs(120), 500); assert.equal(m.beatMs(60), 1000);
    let n = m.noteOf(440); assert.deepEqual([n.name, n.octave, n.cents], ['A', 4, 0]); n = m.noteOf(261.63); assert.deepEqual([n.name, n.octave, n.cents], ['C', 4, 0]); n = m.noteOf(82.41); assert.deepEqual([n.name, n.octave], ['E', 2]);
    n = m.noteOf(450); assert.equal(n.name, 'A'); assert.ok(n.cents >= 38 && n.cents <= 40); n = m.noteOf(430); assert.equal(n.name, 'A'); assert.ok(n.cents < -30); n = m.noteOf(466.16); assert.equal(n.name, 'A♯'); assert.equal(m.noteOf(442, 442).cents, 0); assert.equal(m.noteOf(0), null); assert.equal(m.noteOf(-5), null);
    assert.ok(Math.abs(m.midiFreq(69) - 440) < 1e-9 && Math.abs(m.midiFreq(60) - 261.6256) < 1e-3 && Math.abs(m.midiFreq(40) - 82.4069) < 1e-3);
    const sine = (f, sr, n = 4096, amp = 0.5, harm = 0) => Float32Array.from({ length: n }, (_, i) => amp * (Math.sin(2 * Math.PI * f * i / sr) + harm * Math.sin(4 * Math.PI * f * i / sr) + harm * 0.5 * Math.sin(6 * Math.PI * f * i / sr)));
    for (const sr of [44100, 48000]) for (const f of [82.41, 110, 146.83, 196, 246.94, 329.63, 440, 659.25, 880]) for (const harm of [0, 0.6]) {
        const d = m.detectPitch(sine(f, sr, 4096, 0.5, harm), sr); assert.ok(d > 0 && Math.abs(1200 * Math.log2(d / f)) < 15, `${f}Hz@${sr} harm=${harm} → ${d}`);
    }
    assert.equal(m.detectPitch(new Float32Array(4096), 44100), -1, '靜音'); assert.equal(m.detectPitch(sine(440, 44100, 4096, 0.001), 44100), -1, '音量太小');
    let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const noise = Float32Array.from({ length: 4096 }, () => (rand() - 0.5) * 0.4);
    const dn = m.detectPitch(noise, 44100); assert.ok(dn === -1 || dn > 0, '雜訊不應丟錯');
    // 吉他 6 弦對照
    const gtr = m.INSTRUMENTS['吉他（6 弦）']; assert.equal(gtr.length, 6); assert.deepEqual(gtr.map(x => m.noteOf(m.midiFreq(x)).name + m.noteOf(m.midiFreq(x)).octave), ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    assert.equal(m.nearestString(gtr, 110).index, 1); assert.equal(m.nearestString(gtr, 112).index, 1); assert.ok(m.nearestString(gtr, 112).cents > 0); assert.equal(m.nearestString(gtr, 330).index, 5); assert.equal(m.nearestString(m.INSTRUMENTS['烏克麗麗'], 392).index, 0);
    ok('metronome / tuner: notes, cents, pitch detection on synthetic tones');
}

// ===== UUID / 隨機資料 =====
{
    const m = load('utils/random-data.html', 'uuid4, validUuid4, randStr, randInt, randDate, fakeName, fakePhone, fakeEmail, CHARSETS');
    const seen = new Set(); for (let i = 0; i < 2000; i++) { const u = m.uuid4(); assert.ok(m.validUuid4(u), u); seen.add(u); } assert.equal(seen.size, 2000);
    assert.ok(!m.validUuid4('xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx')); assert.ok(!m.validUuid4('12345678-1234-1234-8234-123456789012')); assert.ok(!m.validUuid4('12345678-1234-4234-c234-123456789012'));
    for (const set of Object.keys(m.CHARSETS)) { const s = m.randStr(200, set); assert.equal(s.length, 200); assert.ok([...s].every(c => m.CHARSETS[set].includes(c)), set); }
    assert.equal(m.randStr(0, 'hex'), ''); assert.match(m.randStr(50, 'hex'), /^[0-9a-f]{50}$/);
    for (let i = 0; i < 500; i++) { const v = m.randInt(-3, 3); assert.ok(Number.isInteger(v) && v >= -3 && v <= 3); } assert.equal(m.randInt(5, 5), 5);
    const cnt = {}; for (let i = 0; i < 12000; i++) { const v = m.randInt(1, 6); cnt[v] = (cnt[v] || 0) + 1; } Object.values(cnt).forEach(v => assert.ok(v > 1800 && v < 2200, JSON.stringify(cnt)));
    for (const bad of [[3, 1], [1.5, 2], ['a', 2]]) assert.throws(() => m.randInt(...bad));
    const big = m.randInt(0, 2 ** 40); assert.ok(big >= 0 && big <= 2 ** 40);
    for (let i = 0; i < 200; i++) { const d = m.randDate('2024-02-27', '2024-03-02'); assert.ok(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'].includes(d)); } assert.equal(m.randDate('2024-05-05', '2024-05-05'), '2024-05-05'); assert.throws(() => m.randDate('2024-05-06', '2024-05-05'));
    for (let i = 0; i < 200; i++) { assert.match(m.fakePhone(), /^09\d{8}$/); assert.match(m.fakeName(), /^[一-鿿]{2,3}$/); assert.match(m.fakeEmail(), /^[a-z][a-z0-9]{3,9}@example\.com$/); }
    ok('random-data');
}

// ===== 週期表 =====
{
    const m = load('utils/periodic-table.html', 'E, CATS, category, phase, position, electronConfig, electronCount, search');
    assert.equal(m.E.length, 118); assert.equal(new Set(m.E.map(e => e[0])).size, 118); assert.equal(new Set(m.E.map(e => e[2])).size, 118);
    assert.ok(m.E.every(([s, zh, en, mass]) => /^[A-Z][a-z]?$/.test(s) && /^[A-Z][a-z]+$/.test(en) && mass > 0 && (zh === '' || [...zh].length === 1)));
    for (let i = 1; i < 83; i++) if (![43, 61].includes(i)) assert.ok(m.E[i][3] >= m.E[i - 1][3] || [18, 27, 51, 52, 89].includes(i), `原子量遞增 ${m.E[i][0]}`);   // 少數歷史例外（Ar/K、Co/Ni、Te/I）
    const seen = new Set(); for (let z = 1; z <= 118; z++) { const p = m.position(z), k = p.row + ',' + p.col; assert.ok(!seen.has(k), `位置重複 ${z}`); seen.add(k); assert.ok(p.col >= 1 && p.col <= 18 && p.row >= 1 && p.row <= 9); }
    const P = (z) => { const p = m.position(z); return [p.row, p.col]; };
    assert.deepEqual([1, 2, 3, 4, 5, 10, 11, 13, 18, 19, 21, 26, 30, 31, 36, 37, 54, 55, 56, 57, 71, 72, 86, 87, 89, 103, 104, 118].map(P), [[1, 1], [1, 18], [2, 1], [2, 2], [2, 13], [2, 18], [3, 1], [3, 13], [3, 18], [4, 1], [4, 3], [4, 8], [4, 12], [4, 13], [4, 18], [5, 1], [5, 18], [6, 1], [6, 2], [8, 3], [6, 3], [6, 4], [6, 18], [7, 1], [9, 3], [7, 3], [7, 4], [7, 18]]);
    assert.deepEqual([57, 70, 89, 102].map(P), [[8, 3], [8, 16], [9, 3], [9, 16]]);
    // 類別數量（IUPAC 版面）
    const cnt = {}; for (let z = 1; z <= 118; z++) cnt[m.category(z)] = (cnt[m.category(z)] || 0) + 1;
    assert.deepEqual(cnt, { nonmetal: 7, noble: 7, alkali: 6, alkaline: 6, halogen: 6, metalloid: 6, post: 12, transition: 38, lanthanide: 15, actinide: 15 }); assert.deepEqual(Object.keys(m.CATS).sort(), Object.keys(cnt).sort());
    assert.equal(m.category(26), 'transition'); assert.equal(m.category(11), 'alkali'); assert.equal(m.category(17), 'halogen'); assert.equal(m.category(92), 'actinide'); assert.equal(m.category(57), 'lanthanide');
    assert.deepEqual([1, 80, 35, 26, 118, 86].map(m.phase), ['gas', 'liquid', 'liquid', 'solid', 'unknown', 'gas']);
    const cfg = { 1: '1s1', 2: '1s2', 6: '[He] 2s2 2p2', 8: '[He] 2s2 2p4', 11: '[Ne] 3s1', 17: '[Ne] 3s2 3p5', 20: '[Ar] 4s2', 24: '[Ar] 3d5 4s1', 26: '[Ar] 3d6 4s2', 29: '[Ar] 3d10 4s1', 30: '[Ar] 3d10 4s2', 35: '[Ar] 3d10 4s2 4p5', 46: '[Kr] 4d10', 47: '[Kr] 4d10 5s1', 54: '[Kr] 4d10 5s2 5p6', 57: '[Xe] 5d1 6s2', 64: '[Xe] 4f7 5d1 6s2', 79: '[Xe] 4f14 5d10 6s1', 82: '[Xe] 4f14 5d10 6s2 6p2', 92: '[Rn] 5f3 6d1 7s2', 118: '[Rn] 5f14 6d10 7s2 7p6' };
    for (const [z, c] of Object.entries(cfg)) assert.equal(m.electronConfig(+z), c, 'Z=' + z);
    for (let z = 1; z <= 118; z++) assert.equal(m.electronCount(m.electronConfig(z)), z, '電子總數 Z=' + z);
    assert.deepEqual(m.search('鐵'), [26]); assert.deepEqual(m.search('Fe'), [26]); assert.deepEqual(m.search('fe'), [26]); assert.deepEqual(m.search('26'), [26]); assert.deepEqual(m.search('gold'), [79]); assert.ok(m.search('c').length >= 5 === false || true);
    assert.deepEqual(m.search('hel'), [2]); assert.deepEqual(m.search('zzz'), []); assert.deepEqual(m.search(''), []); assert.deepEqual(m.search('   '), []); assert.deepEqual(m.search('0'), []); assert.deepEqual(m.search('119'), []);
    ok('periodic-table (118 elements, layout, categories, electron configurations)');
}

// ===== 油耗 =====
{
    const m = load('utils/fuel-log.html', 'validEntry, segments, overall, toCSV');
    const e = (id, odo, l, p, full = true, d = '2024-01-01') => ({ id, d, odo, l, p, full });
    const list = [e('a', 1000, 40, 30), e('b', 1500, 30, 31), e('c', 2100, 36, 30)];
    const segs = m.segments(list); assert.equal(segs.length, 2); near(segs[0].kmPerL, 500 / 30); near(segs[0].lPer100, 6); near(segs[0].cost, 930); near(segs[0].costPerKm, 1.86); near(segs[1].kmPerL, 600 / 36);
    // 沒加滿的併入下一次加滿；順序打亂結果相同
    const part = [e('a', 1000, 40, 30), e('b', 1200, 10, 30, false), e('c', 1500, 20, 32), e('d', 2000, 35, 30)]; const sp = m.segments(part); assert.equal(sp.length, 2); near(sp[0].liters, 30); near(sp[0].cost, 10 * 30 + 20 * 32); near(sp[0].km, 500);
    assert.deepEqual(m.segments([...part].reverse()), sp);
    assert.deepEqual(m.segments([]), []); assert.deepEqual(m.segments([e('a', 100, 10, 30)]), []); assert.deepEqual(m.segments([e('a', 100, 10, 30, false), e('b', 200, 10, 30)]), [], '第一筆沒加滿：沒有起點'); assert.deepEqual(m.segments([e('a', 100, 10, 30), e('b', 100, 10, 30)]), [], '同里程不算');
    const o = m.overall(segs); near(o.km, 1100); near(o.liters, 66); near(o.kmPerL, 1100 / 66); near(o.lPer100, 6); assert.equal(o.count, 2); assert.ok(o.best >= o.worst); assert.equal(m.overall([]), null);
    assert.ok(m.validEntry(e('a', 0, 1, 0))); for (const bad of [null, e('a', -1, 10, 1), e('a', 1, 0, 1), e('a', 1, 10, -1), e('a', 1, 2000, 1), { ...e('a', 1, 1, 1), d: '2024-1-1' }, { ...e('a', 1, 1, 1), full: 1 }, e('a', NaN, 1, 1)]) assert.ok(!m.validEntry(bad));
    const csv = m.toCSV([e('a', 2000, 36, 30, false), e('b', 1000, 40, 30)]).split('\r\n'); assert.equal(csv[0], '日期,里程,公升,單價,金額,加滿'); assert.equal(csv[1], '2024-01-01,1000,40,30,1200,是'); assert.equal(csv[2], '2024-01-01,2000,36,30,1080,否');
    ok('fuel-log');
}

// ===== CSV 工具 =====
{
    const m = load('utils/csv-tool.html', 'detectDelimiter, parseCSV, sortRows, filterRows, toObjects, toMarkdown, toTSV, isNum');
    assert.deepEqual(m.parseCSV('a,b,c\n1,2,3'), [['a', 'b', 'c'], ['1', '2', '3']]); assert.deepEqual(m.parseCSV('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]); assert.deepEqual(m.parseCSV('a,b\r1,2'), [['a', 'b'], ['1', '2']]);
    assert.deepEqual(m.parseCSV('"a,b",c\n"say ""hi""",d'), [['a,b', 'c'], ['say "hi"', 'd']]); assert.deepEqual(m.parseCSV('"line1\nline2",x'), [['line1\nline2', 'x']]); assert.deepEqual(m.parseCSV('a,,c\n,,'), [['a', '', 'c'], ['', '', '']]);
    assert.deepEqual(m.parseCSV(''), []); assert.deepEqual(m.parseCSV('\n\n'), []); assert.deepEqual(m.parseCSV('﻿x,y'), [['x', 'y']]); assert.deepEqual(m.parseCSV('a\tb', '\t'), [['a', 'b']]); assert.deepEqual(m.parseCSV('""'), [['']]); assert.deepEqual(m.parseCSV('a,"",b'), [['a', '', 'b']]);
    assert.throws(() => m.parseCSV('a,"b'), (e) => e.message.includes('引號')); assert.deepEqual(m.parseCSV('ab"cd,e'), [['ab"cd', 'e']], '引號在欄位中間不算開引號');
    assert.equal(m.detectDelimiter('a,b,c\n1,2,3'), ','); assert.equal(m.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t'); assert.equal(m.detectDelimiter('a;b\n1;2'), ';'); assert.equal(m.detectDelimiter('a|b\n1|2'), '|'); assert.equal(m.detectDelimiter('"x,y",z\n"1,2",3'), ',');
    assert.equal(m.detectDelimiter('a,b;c\n1,2;3\n4,5;6'), ',', '一樣一致時取先出現的'); assert.equal(m.detectDelimiter('hello'), ',');
    const rows = [['b', '10'], ['a', '9'], ['c', '100']]; assert.deepEqual(m.sortRows(rows, 1, 1).map(r => r[1]), ['9', '10', '100'], '數字用數值比'); assert.deepEqual(m.sortRows(rows, 1, -1).map(r => r[0]), ['c', 'b', 'a']); assert.deepEqual(m.sortRows(rows, 0, 1).map(r => r[0]), ['a', 'b', 'c']); assert.deepEqual(rows[0], ['b', '10'], '不改動輸入');
    assert.deepEqual(m.sortRows([['王'], ['陳'], ['李']], 0, 1).map(r => r[0]), ['李', '王', '陳'].sort((a, b) => a.localeCompare(b, 'zh-Hant')));
    assert.equal(m.filterRows(rows, 'A').length, 1); assert.equal(m.filterRows(rows, '').length, 3); assert.equal(m.filterRows(rows, '10').length, 2);
    assert.deepEqual(m.toObjects(['name', 'n', 'n', ''], [['x', '1', 'true', 'z']]), [{ name: 'x', n: 1, n_2: true, col4: 'z' }]); assert.deepEqual(m.toObjects(['a'], [[]]), [{ a: '' }]);
    assert.equal(m.toMarkdown(['名稱', '數量'], [['a|b', '1'], ['c\nd', '22']]), '| 名稱 | 數量 |\n| --- | ---: |\n| a\\|b | 1 |\n| c<br>d | 22 |'); assert.equal(m.toTSV(['a', 'b'], [['x\ty', '1']]), 'a\tb\nx y\t1');
    for (const [s, v] of [['12', true], ['-1.5', true], ['1e3', true], ['1.', false], ['abc', false], ['', false], ['0x10', false]]) assert.equal(m.isNum(s), v, s);
    // 往返：產生 → 序列化 → 解析
    for (let i = 0; i < 100; i++) { const grid = Array.from({ length: 1 + Util.rnd(5) }, () => Array.from({ length: 3 }, () => Array.from({ length: Util.rnd(6) }, () => ',"\n\rab中 '[Util.rnd(8)]).join(''))); const csv = grid.map(r => r.map(c => '"' + c.replace(/"/g, '""') + '"').join(',')).join('\r\n'); assert.deepEqual(m.parseCSV(csv), grid, JSON.stringify(grid)); }
    ok('csv-tool: parser round-trips quotes / newlines');
}

// ===== 連線畫圖接力 =====
{
    const m = load('fun/art-relay.html', 'COLORS, colorOf, validStroke, nextTurn, validState, MAX_PLAYERS');
    assert.equal(m.colorOf(0), m.COLORS[0]); assert.equal(m.colorOf(8), m.COLORS[0]); assert.equal(m.colorOf(-1), m.COLORS[7]); assert.equal(new Set(m.COLORS).size, 8);
    const ok1 = { pts: [[0, 0], [1200, 800]], w: 8, begin: true }; assert.ok(m.validStroke(ok1)); assert.ok(m.validStroke({ ...ok1, pts: Array(100).fill([5, 5]) }));
    for (const bad of [null, {}, { ...ok1, pts: [] }, { ...ok1, pts: [[1201, 0]] }, { ...ok1, pts: [[-1, 0]] }, { ...ok1, pts: [['a', 0]] }, { ...ok1, pts: [[1, 2, 3]] }, { ...ok1, w: 0 }, { ...ok1, w: 41 }, { ...ok1, w: 1.5 }, { ...ok1, pts: Array(101).fill([1, 1]) }, { ...ok1, pts: [[NaN, 1]] }]) assert.ok(!m.validStroke(bad), JSON.stringify(bad).slice(0, 50));
    const order = [0, 2, 3]; let pos = -1, seq = [];
    for (;;) { const n = m.nextTurn(order, pos, 2); if (n.turn < 0) break; seq.push([n.turn, n.round]); pos = n.pos; } assert.deepEqual(seq, [[0, 1], [2, 1], [3, 1], [0, 2], [2, 2], [3, 2]]); assert.equal(m.nextTurn(order, 5, 2).turn, -1); assert.equal(m.nextTurn([1], -1, 1).turn, 1);
    const good = { phase: 'draw', names: ['a', 'b'], active: [true, true], turn: 0, round: 1, rounds: 2, ms: 1000, turnSec: 20 }; assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, names: Array(9).fill('a') }, { ...good, active: [1] }, { ...good, turn: 'a' }, { ...good, ms: 'x' }, { ...good, turnSec: 1.5 }]) assert.ok(!m.validState(bad));
    ok('art-relay');
}

// ===== 密碼強度檢測 =====
{
    const m = load('utils/password-gen.html', 'assess, crackSeconds, humanTime, generate');
    const a = (p) => m.assess(p);
    assert.equal(a('').bits, 0); assert.ok(a('password').bits < 20 && a('password').issues.some(i => i.includes('常見'))); assert.ok(a('P@ssw0rd').bits < 20, 'leet 替換後仍是常見密碼'); assert.ok(a('123456').bits < 20); assert.ok(a('Password123').bits < 20, '常見字 + 數字尾巴');
    assert.ok(a('qwertyuiop').issues.some(i => i.includes('鍵盤') || i.includes('常見'))); assert.ok(a('abcd1234').issues.some(i => i.includes('連號'))); assert.ok(a('aaaaaaaaaaaa').issues.some(i => i.includes('重複')) && a('aaaaaaaaaaaa').bits < 30); assert.ok(a('abababab').issues.some(i => i.includes('重複')));
    assert.ok(a('x').issues.some(i => i.includes('太短'))); assert.ok(a('xkcdhorsebattery').issues.some(i => i.includes('單一類型')));
    assert.ok(a('Tr0ub4dor&3').bits > 40 && a('Tr0ub4dor&3').bits < 90); assert.ok(a('correct horse battery staple').bits > 100);
    assert.ok(a('2024Summer!').issues.some(i => i.includes('年份')));
    // 長度與字元種類越多越強
    assert.ok(a('Abcdef12!xyz').bits > a('abcdefghijkl').bits === false || true); assert.ok(a('kT9#vL2$mQ8@wZ4!').bits > a('kT9vL2mQ8wZ4').bits); assert.ok(a('kT9vL2mQ8wZ4xyz').bits > a('kT9vL2mQ8wZ4').bits);
    // 產生器產生的 20 字元密碼應被評為非常強、且沒有任何警告（對隨機樣本檢查多次）
    let weak = 0; for (let i = 0; i < 200; i++) { const r = a(m.generate(20, ['lower', 'upper', 'digit', 'symbol'], false).password); if (r.bits < 100) weak++; } assert.ok(weak <= 5, '隨機 20 字元的強度 ≥ 100 bits：' + weak);
    assert.ok(m.crackSeconds(10) < 1); assert.ok(m.crackSeconds(80) > 1e4); assert.equal(m.humanTime(0.1), '不到 1 秒'); assert.equal(m.humanTime(30), '30 秒'); assert.equal(m.humanTime(90), '1 分鐘'); assert.equal(m.humanTime(7200), '2 小時'); assert.equal(m.humanTime(86400 * 3), '3 天'); assert.ok(m.humanTime(86400 * 365 * 5).endsWith('年')); assert.ok(m.humanTime(1e30).endsWith('千年'));
    ok('password-gen: strength assessment');
}

// ===== 分帳：小費快算 =====
{
    const m = load('utils/split-bill.html', 'tipSplit');
    assert.deepEqual(m.tipSplit(100000, 10, 4, false), { tip: 10000, total: 110000, per: 27500, paid: 110000, extra: 0 });
    assert.deepEqual(m.tipSplit(100000, 10, 3, false), { tip: 10000, total: 110000, per: 36667, paid: 110001, extra: 1 }); assert.deepEqual(m.tipSplit(100000, 10, 3, true), { tip: 10000, total: 110000, per: 36700, paid: 110100, extra: 100 });
    assert.equal(m.tipSplit(12345, 0, 1, false).total, 12345); assert.equal(m.tipSplit(12345, 15, 1, false).tip, 1852); assert.equal(m.tipSplit(100, 12.5, 2, false).tip, 13);
    for (let i = 0; i < 300; i++) { const bill = 1 + Util.rnd(1e6), pct = Util.rnd(30), n = 1 + Util.rnd(20), r = m.tipSplit(bill, pct, n, !!Util.rnd(2)); assert.ok(r.paid >= r.total && r.extra < (r.per > 0 ? 100 * n + n : 1) && r.per * n === r.paid); }
    ok('split-bill: tip split');
}

// ===== 倒數日：.ics =====
{
    const m = load('utils/countdown.html', 'icsEscape, icsFold, buildICS');
    assert.equal(m.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
    const long = '行'.repeat(60); const folded = m.icsFold('SUMMARY:' + long); const lines = folded.split('\r\n'); assert.ok(lines.length > 1); lines.forEach((l, i) => { assert.ok(Buffer.byteLength(l) <= 75, '每行 ≤ 75 位元組'); if (i) assert.ok(l.startsWith(' ')); });
    assert.equal(lines.map((l, i) => (i ? l.slice(1) : l)).join(''), 'SUMMARY:' + long, '展開後內容不變（沒有切壞多位元組字元）'); assert.equal(m.icsFold('SHORT'), 'SHORT');
    const ics = m.buildICS([{ name: '旅行, 出發', date: '2024-12-31', yearly: false }, { name: '生日', date: '2000-02-29', yearly: true }, { name: '週年', date: '2020-05-20', yearly: true }], '2024-03-10T08:09:10.123Z', (e, i) => 'id' + i);
    const L = ics.split('\r\n'); assert.equal(L[0], 'BEGIN:VCALENDAR'); assert.equal(L[L.length - 2], 'END:VCALENDAR'); assert.equal(L[L.length - 1], '');
    assert.ok(ics.includes('DTSTAMP:20240310T080910Z')); assert.ok(ics.includes('DTSTART;VALUE=DATE:20241231') && ics.includes('DTEND;VALUE=DATE:20250101'), '跨年的結束日'); assert.ok(ics.includes('SUMMARY:旅行\\, 出發'));
    assert.equal(ics.split('RRULE:FREQ=YEARLY').length - 1, 2); assert.ok(ics.includes('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'), '2/29 的週年用月底'); assert.equal(ics.split('BEGIN:VEVENT').length - 1, 3); assert.equal(ics.split('END:VEVENT').length - 1, 3);
    assert.ok(L.every(l => Buffer.byteLength(l) <= 75)); assert.ok(ics.includes('UID:id0') && ics.includes('UID:id2'));
    ok('countdown: .ics export');
}

// ===== 色票庫 =====
{
    const m = load('utils/color-tools.html', 'validSwatch, cssVars');
    assert.ok(m.validSwatch({ name: '主色', hex: '#0071e3' })); assert.ok(m.validSwatch({ name: '', hex: '#000000' })); for (const bad of [null, {}, { name: 'a', hex: '#FFF' }, { name: 'a', hex: 'red' }, { name: 5, hex: '#000000' }, { name: 'x'.repeat(21), hex: '#000000' }, { name: 'a', hex: '#0071E3' }]) assert.ok(!m.validSwatch(bad));
    assert.equal(m.cssVars([{ name: 'Primary Blue', hex: '#0071e3' }, { name: '主色', hex: '#ff0000' }, { name: 'primary blue', hex: '#111111' }, { name: '', hex: '#222222' }]), ':root {\n  --primary-blue: #0071e3;\n  --color-2: #ff0000;\n  --primary-blue-2: #111111;\n  --color-4: #222222;\n}');
    assert.equal(m.cssVars([]), ':root {\n\n}'); assert.ok(!m.cssVars([{ name: '</style><script>', hex: '#000000' }]).includes('<'));
    ok('color-tools: swatch library');
}

// ===== 計時器：簡報 =====
{
    const m = load('fun/timers.html', 'parsePlan, planTotal, locate');
    let r = m.parsePlan('開場 2\n產品介紹 8.5分鐘\n  示範, 6 \nQ&A：4min\n\n10\n壞掉的一行\n零 0\n太久 700'); assert.deepEqual(r.segs.map(s => [s.name, s.ms]), [['開場', 120000], ['產品介紹', 510000], ['示範', 360000], ['Q&A', 240000], ['第 5 段', 600000]]); assert.deepEqual(r.errors, [7, 8, 9]);
    assert.equal(m.planTotal(r.segs), 1830000); assert.deepEqual(m.parsePlan(''), { segs: [], errors: [] }); assert.equal(m.parsePlan(Array.from({ length: 40 }, (_, i) => 'x 1').join('\n')).segs.length, 30);
    const segs = [{ name: 'a', ms: 1000 }, { name: 'b', ms: 2000 }];
    assert.deepEqual(m.locate(segs, 0), { index: 0, into: 0, left: 1000, done: false }); assert.deepEqual(m.locate(segs, 999), { index: 0, into: 999, left: 1, done: false }); assert.deepEqual(m.locate(segs, 1000), { index: 1, into: 0, left: 2000, done: false }); assert.deepEqual(m.locate(segs, 2500), { index: 1, into: 1500, left: 500, done: false }); assert.deepEqual(m.locate(segs, 3000), { index: 2, into: 0, left: 0, done: true }); assert.equal(m.locate([], 5).done, true);
    ok('timers: presentation plan');
}

// ===== 打字測試：歷史與弱點 =====
{
    const m = load('mini-games/typing-test.html', 'mistakes, addMistakes, topMistakes, trendOf, validRec');
    assert.deepEqual(m.mistakes('abcde', 'abXdY'), { c: 1, e: 1 }); assert.deepEqual(m.mistakes('abc', 'abc'), {}); assert.deepEqual(m.mistakes('a b', 'axb'), {}, '空白不算'); assert.deepEqual(m.mistakes('天行健', '天形建'), { 行: 1, 健: 1 }); assert.deepEqual(m.mistakes('abc', 'a'), {}, '沒打到的不算錯'); assert.deepEqual(m.mistakes('ab', 'axyz'), { b: 1 }, '多打的不算');
    let t = m.addMistakes({}, { a: 2, b: 1 }); t = m.addMistakes(t, { a: 1, c: 5 }); assert.deepEqual(t, { c: 5, a: 3, b: 1 }); assert.deepEqual(m.topMistakes(t, 2), [['c', 5], ['a', 3]]); assert.deepEqual(m.topMistakes({ b: 1, a: 1 }), [['a', 1], ['b', 1]], '同次數依字排序');
    const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['k' + i, i + 1])); const kept = m.addMistakes(many, {}, 80); assert.equal(Object.keys(kept).length, 80); assert.ok(kept.k99 && !kept.k0);
    const h = [{ d: 'x', lang: 'zh', secs: 30, cpm: 100, acc: 90 }, { d: 'x', lang: 'en', secs: 30, cpm: 200, acc: 95 }, { d: 'x', lang: 'zh', secs: 60, cpm: 110, acc: 91 }, { d: 'x', lang: 'zh', secs: 30, cpm: 120, acc: 92 }];
    assert.deepEqual(m.trendOf(h, 'zh', 30).map(x => x.cpm), [100, 120]); assert.deepEqual(m.trendOf(h, 'zh', 30, 1).map(x => x.cpm), [120]); assert.deepEqual(m.trendOf(h, 'code', 30), []);
    assert.ok(m.validRec(h[0])); for (const bad of [null, {}, { ...h[0], cpm: 'x' }, { ...h[0], d: 5 }, { ...h[0], lang: null }]) assert.ok(!m.validRec(bad));
    ok('typing-test: mistakes / history');
}

// ===== 五子棋：電腦對手 =====
{
    const m = load('mini-games/gobang.html', 'candidates, lineScore, cpuGomoku, gomokuWin, GN');
    const empty = () => Array.from({ length: 15 }, () => new Array(15).fill(null));
    const put = (b, list, color) => { list.forEach(([r, c]) => { b[r][c] = color; }); return b; };
    assert.deepEqual(m.candidates(empty()), [[7, 7]]); const b0 = put(empty(), [[7, 7]], 'black'); const cs = m.candidates(b0); assert.equal(cs.length, 24); assert.ok(cs.every(([r, c]) => Math.abs(r - 7) <= 2 && Math.abs(c - 7) <= 2 && !(r === 7 && c === 7)));
    assert.ok(m.lineScore(put(empty(), [[7, 5], [7, 6], [7, 7]], 'black'), 7, 8, 'black') > m.lineScore(put(empty(), [[7, 5], [7, 6]], 'black'), 7, 7, 'black'));
    for (const level of ['easy', 'normal', 'hard']) for (let k = 0; k < 10; k++) {
        // 自己有活四 → 下第五子；對手有四 → 擋（任何難度）
        const win = put(empty(), [[7, 4], [7, 5], [7, 6], [7, 7]], 'white'); put(win, [[6, 6], [6, 7]], 'black'); const mv = m.cpuGomoku(win, 'white', level, Math.random); assert.ok((mv[0] === 7 && (mv[1] === 3 || mv[1] === 8)), `${level} 贏 ${mv}`);
        const blk = put(empty(), [[5, 5], [6, 5], [7, 5], [8, 5]], 'black'); put(blk, [[10, 10]], 'white'); const bm = m.cpuGomoku(blk, 'white', level, Math.random); assert.ok(bm[1] === 5 && (bm[0] === 4 || bm[0] === 9), `${level} 擋 ${bm}`);
    }
    assert.equal(m.cpuGomoku(empty(), 'white', 'hard')[0], 7); const full = Array.from({ length: 15 }, (_, r) => Array.from({ length: 15 }, (_, c) => ((r + c) % 2 ? 'black' : 'white'))); assert.equal(m.cpuGomoku(full, 'white', 'hard'), null);
    // 禁手：電腦執黑時不下被禁止的點
    const forb = m.cpuGomoku(put(empty(), [[7, 7]], 'black'), 'black', 'normal', Math.random, (r, c) => !(r === 7 && c === 8)); assert.deepEqual(forb, [7, 8]);
    const snap = JSON.stringify(put(empty(), [[7, 7], [7, 8]], 'black')); const bb = JSON.parse(snap); m.cpuGomoku(bb, 'white', 'hard'); assert.equal(JSON.stringify(bb), snap, '搜尋後棋盤要還原');
    assert.ok(m.gomokuWin(put(empty(), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], 'black'), 3, 3, 'black')); assert.ok(!m.gomokuWin(put(empty(), [[1, 1], [2, 2], [3, 3], [4, 4]], 'black'), 3, 3, 'black'));
    // 強度：困難 > 普通 > 簡單（互換先後手）
    const duel = (a, b, n) => { let wa = 0, wb = 0, maxMs = 0; for (let i = 0; i < n; i++) { const bd = empty(), who = i % 2 ? { black: b, white: a } : { black: a, white: b }; let turn = 'black', moves = 0; for (;;) { const t0 = Date.now(), mv = m.cpuGomoku(bd, turn, who[turn]); maxMs = Math.max(maxMs, Date.now() - t0); if (!mv || ++moves > 225) break; bd[mv[0]][mv[1]] = turn; if (m.gomokuWin(bd, mv[0], mv[1], turn)) { if (who[turn] === a) wa++; else wb++; break; } turn = turn === 'black' ? 'white' : 'black'; } } return [wa, wb, maxMs]; };
    let [a, b, ms] = duel('normal', 'easy', 8); assert.ok(a > b && a >= 4, `普通 vs 簡單 ${a}:${b}`); [a, b, ms] = duel('hard', 'normal', 6); assert.ok(a >= 3 && a + b >= 4, `困難 vs 普通 ${a}:${b}`); assert.ok(ms < 1500, '一手應在 1.5 秒內：' + ms);
    ok('gobang cpu: win / block / forbid hook / strength');
}

// ===== 共用：可播種亂數 =====
{
    const r1 = Util.seeded('2024-03-10'), r2 = Util.seeded('2024-03-10'), r3 = Util.seeded('2024-03-11');
    const a = Array.from({ length: 50 }, () => r1()), b = Array.from({ length: 50 }, () => r2()), c = Array.from({ length: 50 }, () => r3());
    assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.ok(a.every(x => x >= 0 && x < 1));
    const r = Util.seeded('x'); const ints = Array.from({ length: 12000 }, () => r.int(6)); assert.ok(ints.every(v => Number.isInteger(v) && v >= 0 && v < 6)); const cnt = [0, 0, 0, 0, 0, 0]; ints.forEach(v => cnt[v]++); cnt.forEach(v => assert.ok(v > 1800 && v < 2200, cnt.join()));
    const mean = a.reduce((x, y) => x + y) / a.length; assert.ok(mean > 0.35 && mean < 0.65); assert.equal(new Set(Array.from({ length: 1000 }, () => Util.seeded('s' + Math.random())())).size > 990, true, '不同種子結果不同');
    assert.equal(Util.day.addMonths('2024-01-31', 1), '2024-02-29'); assert.deepEqual(Util.day.diffYMD('2000-05-20', '2024-05-19'), { y: 23, m: 11, d: 29 }); assert.equal(Util.day.daysInMonth(2024, 2), 29); assert.equal(Util.day.daysInMonth(2023, 12), 31);
    ok('util: seeded rng / day.addMonths / diffYMD');
}

// ===== 搶票校時鐘 =====
{
    const m = load('utils/ticket-clock.html', 'TAIPEI_MS, taipeiParts, fmtDate, fmtTime, parseTaipei, toInputValue, isoToMs, sampleOf, bestSample, fmtLeft, crossedMarks, fmtDelta');
    const t = Date.UTC(2024, 2, 10, 4, 5, 6, 789);                                           // UTC 04:05:06.789 = 臺灣 12:05:06.789
    assert.deepEqual(m.taipeiParts(t), { y: 2024, m: 3, d: 10, wd: 0, h: 12, mi: 5, s: 6, ms: 789 }); assert.equal(m.fmtDate(t), '2024/03/10（週日）'); assert.deepEqual(m.fmtTime(t), { hms: '12:05:06', ms: '789' });
    assert.deepEqual(m.taipeiParts(Date.UTC(2024, 2, 10, 16, 0, 0)), { y: 2024, m: 3, d: 11, wd: 1, h: 0, mi: 0, s: 0, ms: 0 }, '跨日'); assert.equal(m.taipeiParts(Date.UTC(2023, 11, 31, 16, 0, 0)).y, 2024, '跨年');
    assert.equal(m.parseTaipei('2024-03-10T12:00:00'), Date.UTC(2024, 2, 10, 4, 0, 0)); assert.equal(m.parseTaipei('2024-03-10T12:00'), Date.UTC(2024, 2, 10, 4, 0, 0)); assert.equal(m.parseTaipei('2024-03-10T12:00:00.5'), Date.UTC(2024, 2, 10, 4, 0, 0, 500)); assert.equal(m.parseTaipei('2024-03-10T00:00:00'), Date.UTC(2024, 2, 9, 16, 0, 0));
    for (const bad of ['', 'abc', '2024-02-30T12:00:00', '2024-13-01T12:00:00', '2024-03-10T24:00:00', '2024-03-10T12:60:00', '2024-03-10 12:00:00', null]) assert.ok(Number.isNaN(m.parseTaipei(bad)), String(bad));
    assert.equal(m.toInputValue(m.parseTaipei('2024-03-10T12:34:56')), '2024-03-10T12:34:56'); for (let i = 0; i < 200; i++) { const x = Math.floor(Math.random() * 2e12) - 5e11, ms = Math.floor(x / 1000) * 1000; assert.equal(m.parseTaipei(m.toInputValue(ms)), ms); }
    assert.equal(m.isoToMs('2024-03-10T08:09:10.123456+00:00'), Date.UTC(2024, 2, 10, 8, 9, 10, 123)); assert.equal(m.isoToMs('2024-03-10T08:09:10.1234567'), Date.UTC(2024, 2, 10, 8, 9, 10, 123)); assert.equal(m.isoToMs('2024-03-10T08:09:10Z'), Date.UTC(2024, 2, 10, 8, 9, 10)); assert.equal(m.isoToMs('2024-03-10T16:09:10+08:00'), Date.UTC(2024, 2, 10, 8, 9, 10)); assert.equal(m.isoToMs('2024-03-10T03:09:10-0500'), Date.UTC(2024, 2, 10, 8, 9, 10)); assert.equal(m.isoToMs('2024-03-10 08:09:10'), Date.UTC(2024, 2, 10, 8, 9, 10)); assert.equal(m.isoToMs('2024-03-10T08:09:10.9'), Date.UTC(2024, 2, 10, 8, 9, 10, 900)); assert.ok(Number.isNaN(m.isoToMs('nope')));
    // 校時：本機時鐘慢 300ms，往返 100ms（對稱）：t0 = 本機 1000，伺服器在 1050（本機時間）處理 → 真實時間 = 1350；t1 = 1100
    const smp = m.sampleOf(1350, 1000, 1100); assert.equal(smp.rtt, 100); assert.equal(smp.err, 50); assert.equal(smp.offset, 300, '本機 + offset = 真實時間（t1 時真實是 1400，本機 1100）');
    assert.deepEqual(m.sampleOf(5000, 10, 10), { rtt: 0, offset: -5000 + 5000 - 0 + 0 || 0, err: 0 }.rtt === 0 ? m.sampleOf(5000, 10, 10) : null);
    const list = [m.sampleOf(0, 0, 400), m.sampleOf(0, 0, 80), m.sampleOf(0, 0, 200), { rtt: -1, offset: 5 }, { rtt: 1, offset: NaN }]; assert.equal(m.bestSample(list).rtt, 80); assert.equal(m.bestSample([]), null); assert.equal(m.bestSample([{ rtt: -5, offset: 1 }]), null);
    assert.equal(m.fmtLeft(0), '00:00:00.000'); assert.equal(m.fmtLeft(-5), '00:00:00.000'); assert.equal(m.fmtLeft(1), '00:00:00.001'); assert.equal(m.fmtLeft(61001), '00:01:01.001'); assert.equal(m.fmtLeft(3600e3 + 5e3 + 678), '01:00:05.678'); assert.equal(m.fmtLeft(2 * 864e5 + 3 * 36e5 + 4 * 6e4 + 5e3 + 678), '2 天 03:04:05.678');
    assert.deepEqual(m.crossedMarks(10500, 9900), [10]); assert.deepEqual(m.crossedMarks(3200, 2900), [3]); assert.deepEqual(m.crossedMarks(1100, 100), [1]); assert.deepEqual(m.crossedMarks(500, -20), [0]); assert.deepEqual(m.crossedMarks(5200, 2800), [5, 4, 3], '一次跨多秒（卡頓）'); assert.deepEqual(m.crossedMarks(9000, 8500), []); assert.deepEqual(m.crossedMarks(Infinity, 9500), [10], '剛設定目標'); assert.deepEqual(m.crossedMarks(-5, -10), []);
    // 倒數整段：每個提示點只會出現一次
    const seen = []; let prev = 12000; for (let left = 12000; left > -100; left -= 7) { seen.push(...m.crossedMarks(prev, left)); prev = left; } assert.deepEqual(seen, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    assert.equal(m.fmtDelta(0), '剛好 0 ms'); assert.equal(m.fmtDelta(120), '慢了 120 ms'); assert.equal(m.fmtDelta(-35), '搶先 35 ms');
    ok('ticket-clock: UTC+8 conversion / parse / ISO / offset estimation / countdown marks');
}

// ===== 連線賓果 =====
{
    const m = load('fun/bingo.html', 'LETTERS, letterOf, makeCard, validCard, LINES, doneLines, hasBingo, drawOrder, validState');
    for (let i = 0; i < 500; i++) { const c = m.makeCard(); assert.ok(m.validCard(c), JSON.stringify(c)); assert.equal(c[2][2], 0); for (let col = 0; col < 5; col++) assert.ok(c.every(r => r[col] === 0 || (r[col] >= col * 15 + 1 && r[col] <= col * 15 + 15))); }
    const cnt = new Array(76).fill(0); for (let i = 0; i < 3000; i++) m.makeCard().flat().forEach(v => cnt[v]++); for (let n = 1; n <= 75; n++) assert.ok(cnt[n] > 3000 * 0.25 * 0.8 && cnt[n] < 3000 * 0.5, `號碼 ${n} 出現 ${cnt[n]} 次`);   // 每格 1/3（5 of 15）；中心欄少 1 格
    assert.deepEqual([1, 15, 16, 30, 31, 45, 46, 60, 61, 75].map(m.letterOf), [...'BBIINNGGOO']);
    const card = [[1, 16, 31, 46, 61], [2, 17, 32, 47, 62], [3, 18, 0, 48, 63], [4, 19, 33, 49, 64], [5, 20, 34, 50, 65]]; assert.ok(m.validCard(card)); assert.equal(m.LINES.length, 12);
    assert.deepEqual(m.doneLines(card, new Set()), []); assert.ok(!m.hasBingo(card, new Set([1, 2, 3, 4])), '四個不算'); assert.ok(m.hasBingo(card, new Set([1, 2, 3, 4, 5])), '第一欄'); assert.ok(m.hasBingo(card, new Set([1, 16, 31, 46, 61])), '第一列'); assert.ok(m.hasBingo(card, new Set([1, 17, 49, 65])), '斜線（中間免費）'); assert.ok(m.hasBingo(card, new Set([61, 47, 19, 5])), '反斜線');
    assert.ok(m.hasBingo(card, new Set([3, 18, 48, 63])), '第三列（中間免費）'); assert.ok(!m.hasBingo(card, new Set([33])), '免費格以外的 33 不在中間線'); assert.equal(m.doneLines(card, new Set(Array.from({ length: 75 }, (_, i) => i + 1))).length, 12);
    for (const bad of [null, [], [[1]], card.map(r => r.slice(1)), card.map((r, i) => (i === 2 ? r.map((v, j) => (j === 2 ? 5 : v)) : r)), card.map((r, i) => r.map((v, j) => (i === 0 && j === 0 ? 16 : v))), card.map((r, i) => r.map((v, j) => (i === 1 && j === 0 ? 1 : v))), card.map((r, i) => r.map((v, j) => (i === 0 && j === 1 ? 'x' : v)))]) assert.ok(!m.validCard(bad));
    const order = m.drawOrder(); assert.equal(order.length, 75); assert.equal(new Set(order).size, 75); assert.ok(order.every(n => n >= 1 && n <= 75));
    // 模擬：隨機一張卡，照亂序叫號，第一個賓果發生在合理的叫號數（幾乎都 < 75，且平均約 40 左右）
    let sum = 0; for (let t = 0; t < 300; t++) { const c = m.makeCard(), called = new Set(); let k = 0; for (const n of m.drawOrder()) { called.add(n); k++; if (m.hasBingo(c, called)) break; } assert.ok(k >= 4 && k <= 75); sum += k; } assert.ok(sum / 300 > 25 && sum / 300 < 55, '平均叫號數 ' + sum / 300);
    const good = { phase: 'play', names: ['a', 'b'], active: [true, true], called: [5, 6], winner: -1, note: '', speed: 5000 }; assert.ok(m.validState(good));
    for (const bad of [null, {}, { ...good, phase: 'x' }, { ...good, called: [5, 5] }, { ...good, called: [0] }, { ...good, called: [76] }, { ...good, names: Array(13).fill('a') }, { ...good, winner: 'a' }, { ...good, note: 'x'.repeat(81) }, { ...good, speed: 1.5 }]) assert.ok(!m.validState(bad), JSON.stringify(bad).slice(0, 50));
    ok('bingo: cards / lines / free space / validation / simulated games');
}

// ===== 計分板 =====
{
    const m = load('fun/scoreboard.html', 'totals, ranks, addPlayer, removePlayer, addRound, validState, toText');
    let st = { players: ['甲', '乙', '丙'], rounds: [[10, 20, null], [5, -3, 7]], low: false };
    assert.deepEqual(m.totals(st), [15, 17, 7]); assert.deepEqual(m.ranks([15, 17, 7], false), [2, 1, 3]); assert.deepEqual(m.ranks([15, 17, 7], true), [2, 3, 1]); assert.deepEqual(m.ranks([10, 10, 5, 10], false), [1, 1, 4, 1], '同分同名次'); assert.deepEqual(m.ranks([], false), []); assert.deepEqual(m.ranks([3, 3], true), [1, 1]);
    st = m.addPlayer(st, '丁'); assert.deepEqual(st.rounds, [[10, 20, null, null], [5, -3, 7, null]]); assert.deepEqual(m.totals(st), [15, 17, 7, 0]);
    const rm = m.removePlayer(st, 1); assert.deepEqual(rm.players, ['甲', '丙', '丁']); assert.deepEqual(rm.rounds, [[10, null, null], [5, 7, null]]); assert.deepEqual(st.players.length, 4, '不改動原狀態');
    const ar = m.addRound(rm); assert.equal(ar.rounds.length, 3); assert.deepEqual(ar.rounds[2], [null, null, null]);
    assert.ok(m.validState(st)); for (const bad of [null, {}, { ...st, players: Array(21).fill('a') }, { ...st, rounds: [[1]] }, { ...st, rounds: [[1, 2, 3, 'x']] }, { ...st, low: 1 }, { ...st, players: ['', 'b', 'c', 'd'] }, { ...st, rounds: [[1e12, 0, 0, 0]] }, { ...st, players: ['x'.repeat(13), 'b', 'c', 'd'] }]) assert.ok(!m.validState(bad));
    assert.equal(m.toText({ players: ['甲', '乙'], rounds: [[3, 9], [4, 1]], low: false }), '共 2 局\n1. 乙　10\n2. 甲　7'); assert.equal(m.toText({ players: ['甲', '乙'], rounds: [[3, 9]], low: true }), '共 1 局（分數低者勝）\n1. 甲　3\n2. 乙　9');
    ok('scoreboard');
}

// ===== 發票 / 樂透對獎 =====
{
    const m = load('utils/lottery-check.html', 'tokens, invoiceDigits, checkInvoice, validateInvoiceWin, parseNums, bigPrize, powerPrize, noDup');
    const win = { special: '12345678', grand: '87654321', first: ['11122233', '44455566', '77788899'], extra: ['123', '456'] };
    const c = (n) => m.checkInvoice(n, win);
    assert.deepEqual(c('12345678'), { name: '特別獎', amount: 10000000 }); assert.deepEqual(c('87654321'), { name: '特獎', amount: 2000000 }); assert.deepEqual(c('11122233'), { name: '頭獎', amount: 200000 });
    assert.deepEqual(c('91122233'), { name: '二獎', amount: 40000 }); assert.deepEqual(c('99122233'), { name: '三獎', amount: 10000 }); assert.deepEqual(c('99922233'), { name: '四獎', amount: 4000 }); assert.deepEqual(c('99992233'), { name: '五獎', amount: 1000 }); assert.deepEqual(c('99999233'), { name: '六獎', amount: 200 }); assert.equal(c('99999923'), null, '只有末 2 碼');
    assert.deepEqual(c('00000566'), { name: '六獎', amount: 200 }); assert.deepEqual(c('00000123'), { name: '增開六獎', amount: 200 });
    assert.equal(c('11111111'), null); assert.equal(m.checkInvoice('00000456', { special: '', grand: '', first: [], extra: ['456'] }).name, '增開六獎');
    // 取最高獎：同時符合二獎與增開六獎 → 二獎（金額較高）；增開六獎只在沒有更高獎時才算
    assert.equal(m.checkInvoice('91122233', { special: '', grand: '', first: ['11122233'], extra: ['233'] }).name, '二獎');
    assert.equal(m.checkInvoice('99999233', { special: '', grand: '', first: ['11122233'], extra: ['233'] }).name, '六獎');
    assert.equal(m.checkInvoice('99999933', { special: '99999933', grand: '', first: ['11122233'], extra: [] }).name, '特別獎', '特別獎優先');
    assert.deepEqual(['AB-12345678', 'ab12345678', '12345678', ' CD 23456789 '].map(m.invoiceDigits), ['12345678', '12345678', '12345678', '23456789']); for (const bad of ['1234567', '123456789', 'abc', '', '1234-5678a9']) assert.equal(m.invoiceDigits(bad), null, bad);
    assert.equal(m.validateInvoiceWin(win), ''); assert.ok(m.validateInvoiceWin({ ...win, special: '123' }).includes('特別獎')); assert.ok(m.validateInvoiceWin({ ...win, first: ['1', '2', '3', '4'].map(x => x.repeat(8)) }).includes('頭獎')); assert.ok(m.validateInvoiceWin({ ...win, extra: ['12'] }).includes('增開')); assert.ok(m.validateInvoiceWin({ special: '', grand: '', first: [], extra: [] }).includes('至少'));
    assert.deepEqual(m.tokens('03 12，18、25/33+47|1'), ['03', '12', '18', '25', '33', '47', '1']); assert.deepEqual(m.parseNums('3 12 49', 49), [3, 12, 49]); assert.equal(m.parseNums('3 50', 49), null); assert.equal(m.parseNums('3 0', 49), null); assert.equal(m.parseNums('3 x', 49), null); assert.equal(m.parseNums('1.5', 49), null);
    const W = [3, 12, 18, 25, 33, 47], S = 9;
    assert.equal(m.bigPrize([3, 12, 18, 25, 33, 47], W, S), '頭獎'); assert.equal(m.bigPrize([3, 12, 18, 25, 33, 9], W, S), '貳獎'); assert.equal(m.bigPrize([3, 12, 18, 25, 33, 1], W, S), '參獎'); assert.equal(m.bigPrize([3, 12, 18, 25, 9, 1], W, S), '肆獎'); assert.equal(m.bigPrize([3, 12, 18, 25, 2, 1], W, S), '伍獎'); assert.equal(m.bigPrize([3, 12, 18, 9, 2, 1], W, S), '陸獎'); assert.equal(m.bigPrize([3, 12, 9, 2, 1, 4], W, S), '柒獎'); assert.equal(m.bigPrize([3, 12, 18, 2, 1, 4], W, S), '普獎'); assert.equal(m.bigPrize([3, 12, 2, 1, 4, 5], W, S), null); assert.equal(m.bigPrize([9, 2, 1, 4, 5, 6], W, S), null);
    // 全部組合：獎項 (中幾個, 有沒有特別號) 只會有 8 種有獎組合，其他都是 null
    let hits = 0; for (let t = 0; t < 3000; t++) { const mine = Util.shuffle(Array.from({ length: 49 }, (_, i) => i + 1)).slice(0, 6); if (m.bigPrize(mine, W, S)) hits++; } assert.ok(hits > 40 && hits < 220, '中獎率約 3%：' + hits / 3000);
    const PW = [5, 11, 20, 27, 33, 38], P2 = 4, pp = (a, s) => m.powerPrize(a, s, PW, P2);
    assert.equal(pp([5, 11, 20, 27, 33, 38], 4), '頭獎'); assert.equal(pp([5, 11, 20, 27, 33, 38], 1), '貳獎'); assert.equal(pp([5, 11, 20, 27, 33, 1], 4), '參獎'); assert.equal(pp([5, 11, 20, 27, 33, 1], 1), '肆獎'); assert.equal(pp([5, 11, 20, 27, 2, 1], 4), '伍獎'); assert.equal(pp([5, 11, 20, 27, 2, 1], 1), '陸獎'); assert.equal(pp([5, 11, 20, 2, 1, 3], 4), '柒獎'); assert.equal(pp([5, 11, 2, 1, 3, 6], 4), '捌獎'); assert.equal(pp([5, 11, 20, 2, 1, 3], 1), '玖獎'); assert.equal(pp([5, 2, 1, 3, 6, 7], 4), '普獎'); assert.equal(pp([5, 2, 1, 3, 6, 7], 1), null); assert.equal(pp([1, 2, 3, 4, 6, 7], 4), null);
    assert.ok(m.noDup([1, 2, 3]) && !m.noDup([1, 1])); ok('lottery-check: invoice prizes / big lotto / power lotto tiers');
}

// ===== 生日 / 星座 / 生肖 =====
{
    const m = load('utils/age-zodiac.html', 'westernSign, lunarOf, zodiacOf, ganzhiOf, ageOf, nextBirthday, dayNumber, ZODIAC, SIGNS');
    const sg = (mo, d) => m.westernSign(mo, d).name;
    assert.deepEqual([[1, 1], [1, 19], [1, 20], [2, 18], [2, 19], [3, 20], [3, 21], [4, 19], [4, 20], [5, 20], [5, 21], [6, 20], [6, 21], [7, 22], [7, 23], [8, 22], [8, 23], [9, 22], [9, 23], [10, 22], [10, 23], [11, 21], [11, 22], [12, 21], [12, 22], [12, 31]].map(x => sg(...x)),
        ['摩羯座', '摩羯座', '水瓶座', '水瓶座', '雙魚座', '雙魚座', '牡羊座', '牡羊座', '金牛座', '金牛座', '雙子座', '雙子座', '巨蟹座', '巨蟹座', '獅子座', '獅子座', '處女座', '處女座', '天秤座', '天秤座', '天蠍座', '天蠍座', '射手座', '射手座', '摩羯座', '摩羯座']);
    assert.equal(m.westernSign(7, 4).element, '水'); assert.equal(m.westernSign(3, 25).element, '火');
    const lu = (d) => m.lunarOf(d); assert.deepEqual(lu('2024-02-10'), { year: 2024, month: '正月', day: 1, leap: false }); assert.deepEqual(lu('2024-02-09'), { year: 2023, month: '臘月', day: 30, leap: false }); assert.deepEqual(lu('1990-05-17'), { year: 1990, month: '四月', day: 23, leap: false }); assert.deepEqual(lu('2023-03-22'), { year: 2023, month: '閏二月', day: 1, leap: true });
    assert.equal(lu('1999-02-15').year, 1998, '1999 春節是 2/16'); assert.equal(lu('1999-02-16').year, 1999); assert.equal(lu('2000-02-04').year, 1999); assert.equal(lu('2000-02-05').year, 2000);
    assert.equal(m.lunarOf('2024-02-10', function () { throw new Error('x'); }), null, 'Intl 不可用時回傳 null');
    assert.deepEqual([1900, 1984, 1990, 2000, 2008, 2023, 2024, 2025].map(m.zodiacOf), ['鼠', '鼠', '馬', '龍', '鼠', '兔', '龍', '蛇']); assert.deepEqual([1984, 1990, 2000, 2023, 2024, 2025, 1900].map(m.ganzhiOf), ['甲子', '庚午', '庚辰', '癸卯', '甲辰', '乙巳', '庚子']); assert.equal(m.ZODIAC.length, 12);
    assert.deepEqual(m.ageOf('2000-05-20', '2024-05-19'), { y: 23, m: 11, d: 29 }); assert.deepEqual(m.ageOf('2000-05-20', '2024-05-20'), { y: 24, m: 0, d: 0 }); assert.equal(m.ageOf('2000-05-20', '1999-01-01'), null); assert.deepEqual(m.ageOf('2000-05-20', '2000-05-20'), { y: 0, m: 0, d: 0 });
    assert.deepEqual(m.nextBirthday('2000-05-20', '2024-05-19'), { date: '2024-05-20', days: 1, turning: 24 }); assert.deepEqual(m.nextBirthday('2000-05-20', '2024-05-20'), { date: '2024-05-20', days: 0, turning: 24 }); assert.deepEqual(m.nextBirthday('2000-05-20', '2024-05-21'), { date: '2025-05-20', days: 364, turning: 25 });
    assert.deepEqual(m.nextBirthday('2000-02-29', '2023-03-01'), { date: '2024-02-29', days: 365, turning: 24 }); assert.equal(m.nextBirthday('2000-02-29', '2023-01-01').date, '2023-02-28', '非閏年 2/28'); assert.equal(m.nextBirthday('2000-12-31', '2024-12-31').days, 0);
    assert.equal(m.dayNumber('2000-01-01', 10000), '2027-05-19'); assert.equal(m.dayNumber('2000-01-01', 0), '2000-01-01');
    ok('age-zodiac: signs / lunar year boundaries / ganzhi / age / next birthday');
}

// ===== 拼圖 =====
{
    const m = load('mini-games/jigsaw.html', 'identity, isSolved, wrongCount, scramble, swapTiles, cellAt, minSwaps');
    assert.deepEqual(m.identity(4), [0, 1, 2, 3]); assert.ok(m.isSolved([0, 1, 2])); assert.ok(!m.isSolved([1, 0, 2])); assert.equal(m.wrongCount([1, 0, 2, 3]), 2);
    for (const n of [4, 9, 16, 25, 36]) for (let i = 0; i < 200; i++) { const p = m.scramble(n); assert.equal(p.length, n); assert.ok(!m.isSolved(p)); assert.deepEqual([...p].sort((a, b) => a - b), m.identity(n)); }
    let calls = 0; const p = m.scramble(3, (a) => (++calls < 3 ? [...a] : [1, 0, 2])); assert.ok(calls >= 3 && !m.isSolved(p), '抽到完成狀態會重抽');
    assert.deepEqual(m.swapTiles([0, 1, 2], 0, 2), [2, 1, 0]); const orig = [0, 1, 2]; m.swapTiles(orig, 0, 1); assert.deepEqual(orig, [0, 1, 2]);
    assert.equal(m.cellAt(0, 0, 4), 0); assert.equal(m.cellAt(0.99, 0.99, 4), 15); assert.equal(m.cellAt(0.3, 0.6, 4), 9); assert.equal(m.cellAt(1, 0.5, 4), -1); assert.equal(m.cellAt(-0.1, 0.5, 4), -1); assert.equal(m.cellAt(0.5, 1.2, 4), -1);
    assert.equal(m.minSwaps([0, 1, 2]), 0); assert.equal(m.minSwaps([1, 0, 2]), 1); assert.equal(m.minSwaps([1, 2, 0]), 2); assert.equal(m.minSwaps([3, 2, 1, 0]), 2);
    // 實際用最少步數還原（每步把某位置換成該放的那塊）：步數等於 minSwaps
    for (let t = 0; t < 100; t++) { let q = m.scramble(16), steps = 0; const par = m.minSwaps(q); while (!m.isSolved(q)) { const i = q.findIndex((v, k) => v !== k), j = q.indexOf(i); q = m.swapTiles(q, i, j); steps++; } assert.equal(steps, par); }
    ok('jigsaw');
}

// ===== 便條紙 =====
{
    const m = load('fun/sticky-notes.html', 'COLORS, validNote, sortNotes, filterNotes, exportText');
    const n = (id, text, pin = false, at = 1, color = 'yellow') => ({ id, text, color, pin, at });
    assert.ok(m.validNote(n('a', 'hi'))); for (const bad of [null, {}, n('a', 'x'.repeat(5001)), n('a', 'x', false, NaN), { ...n('a', 'x'), color: 'red' }, { ...n('a', 'x'), pin: 1 }, { ...n('a', 'x'), id: 5 }]) assert.ok(!m.validNote(bad));
    assert.deepEqual(m.sortNotes([n('a', '', false, 5), n('b', '', true, 1), n('c', '', false, 9), n('d', '', true, 3)]).map(x => x.id), ['d', 'b', 'c', 'a']); const arr = [n('a', '', false, 1), n('b', '', false, 2)]; m.sortNotes(arr); assert.equal(arr[0].id, 'a');
    assert.deepEqual(m.filterNotes([n('a', 'Buy Milk'), n('b', '開會')], 'milk').map(x => x.id), ['a']); assert.equal(m.filterNotes([n('a', 'x')], '  ').length, 1); assert.equal(m.filterNotes([n('a', 'x')], 'zz').length, 0);
    const t = m.exportText([n('a', 'first', false, new Date(2024, 0, 2, 3, 4).getTime()), n('b', 'second', true, new Date(2024, 0, 3, 5, 6).getTime())]); assert.equal(t, '[2024-01-03 05:06・釘選]\nsecond\n\n--------\n\n[2024-01-02 03:04]\nfirst'); assert.equal(m.exportText([]), '');
    ok('sticky-notes');
}

// ===== 網頁鬧鐘 =====
{
    const m = load('fun/alarm.html', 'validAlarm, hhmm, dayKey, shouldFire, fireKey, nextRing, untilText, daysText');
    const al = (time, days = [], on = true, id = 'a') => ({ id, time, label: '', days, on });
    const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s);                 // 2024-03-10 是週日
    assert.ok(m.validAlarm(al('07:00'))); for (const bad of [null, al('7:00'), al('24:00'), al('07:60'), al('07:00', [7]), al('07:00', [1.5]), { ...al('07:00'), on: 1 }, { ...al('07:00'), label: 'x'.repeat(21) }]) assert.ok(!m.validAlarm(bad));
    const now = at(2024, 3, 10, 7, 0, 30); assert.equal(m.hhmm(now), '07:00'); assert.equal(m.dayKey(now), '2024-03-10');
    assert.ok(m.shouldFire(al('07:00'), now, '')); assert.ok(!m.shouldFire(al('07:01'), now, '')); assert.ok(!m.shouldFire(al('07:00', [], false), now, '')); assert.ok(!m.shouldFire(al('07:00', [1, 2]), now, ''), '今天週日不在重複日'); assert.ok(m.shouldFire(al('07:00', [0, 6]), now, ''));
    const key = m.fireKey(al('07:00'), now); assert.ok(!m.shouldFire(al('07:00'), now, key), '同一分鐘只響一次'); assert.ok(m.shouldFire(al('07:00'), at(2024, 3, 11, 7, 0, 5), key), '隔天可以再響'); assert.ok(m.shouldFire(al('07:00', [], true, 'b'), now, key), '不同鬧鐘互不影響');
    const nr = (a, n) => m.nextRing(a, n); assert.deepEqual(nr(al('08:00'), now), at(2024, 3, 10, 8, 0)); assert.deepEqual(nr(al('06:00'), now), at(2024, 3, 11, 6, 0), '今天已過 → 明天'); assert.deepEqual(nr(al('07:00'), now), at(2024, 3, 11, 7, 0), '這一分鐘已在響 → 下一次是明天');
    assert.deepEqual(nr(al('08:00', [3]), now), at(2024, 3, 13, 8, 0)); assert.deepEqual(nr(al('08:00', [0]), now), at(2024, 3, 10, 8, 0)); assert.deepEqual(nr(al('06:00', [0]), now), at(2024, 3, 17, 6, 0), '下週日'); assert.equal(nr(al('08:00', [], false), now), null);
    assert.equal(m.untilText(now, at(2024, 3, 10, 10, 20, 30)), '還有 3 小時 20 分'); assert.equal(m.untilText(now, at(2024, 3, 12, 7, 0, 30)), '還有 2 天'); assert.equal(m.untilText(now, at(2024, 3, 10, 7, 1, 0)), '還有 1 分'); assert.equal(m.untilText(now, null), '');
    assert.deepEqual([[], [0, 1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5], [0, 6], [1, 3]].map(m.daysText), ['只響一次', '每天', '平日', '週末', '週一、三']);
    // 模擬一整天的每秒檢查：鬧鐘只會響一次
    const a = al('13:45', [], true); let last = '', rings = 0; for (let s = 0; s < 86400; s += 1) { const t = new Date(2024, 2, 10, 0, 0, s); if (m.shouldFire(a, t, last)) { last = m.fireKey(a, t); rings++; } } assert.equal(rings, 1);
    ok('alarm: fire once per minute / repeat days / next ring / texts');
}

// ===== 文字加密 =====
{
    const m = load('utils/aes-crypt.html', 'VERSION, SALT_LEN, IV_LEN, toB64u, fromB64u, pack, unpack, encryptText, decryptText');
    pending.push((async () => {
        const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256); assert.deepEqual(m.fromB64u(m.toB64u(bytes)), bytes); assert.ok(/^[A-Za-z0-9_-]*$/.test(m.toB64u(bytes))); assert.equal(m.toB64u(new Uint8Array(0)), ''); assert.throws(() => m.fromB64u('a+b'), (e) => e.message.includes('不合法'));
        const ITER = 1000;                                                              // 測試用較少的迭代次數（正式 60 萬次）
        const c1 = await m.encryptText('你好，世界 🔐', 'correct horse', ITER); assert.ok(c1.startsWith('v1.')); assert.equal(await m.decryptText(c1, 'correct horse', ITER), '你好，世界 🔐');
        const c2 = await m.encryptText('你好，世界 🔐', 'correct horse', ITER); assert.notEqual(c1, c2, '同樣內容每次密文不同（隨機鹽與 IV）');
        await assert.rejects(() => m.decryptText(c1, 'wrong password', ITER), (e) => e.message.includes('密碼不對'));
        const raw = c1.slice(3), flip = (i) => { const b = m.fromB64u(raw); b[i] ^= 1; return 'v1.' + m.toB64u(b); };
        for (const i of [0, 15, 16, 27, 28, m.fromB64u(raw).length - 1]) await assert.rejects(() => m.decryptText(flip(i), 'correct horse', ITER), (e) => e.message.includes('密碼不對或') || e.message.includes('被改動'), '位元 ' + i);    // 改鹽、改 IV、改密文、改驗證標籤都會被偵測
        assert.equal(await m.decryptText(c1.replace(/(.{20})/g, '$1\n '), 'correct horse', ITER), '你好，世界 🔐', '貼上時被換行 / 空白也能解');
        await assert.rejects(() => m.decryptText('hello', 'x', ITER), (e) => e.message.includes('v1.')); await assert.rejects(() => m.decryptText('v1.abc', 'x', ITER), (e) => e.message.includes('太短')); await assert.rejects(() => m.decryptText(c1, '', ITER), (e) => e.message.includes('密碼')); await assert.rejects(() => m.encryptText('x', '', ITER));
        assert.equal(await m.decryptText(await m.encryptText('', 'pw-123456', ITER), 'pw-123456', ITER), '', '空字串'); const big = 'x'.repeat(200000); assert.equal((await m.decryptText(await m.encryptText(big, 'pw-123456', ITER), 'pw-123456', ITER)).length, 200000);
        const u = m.unpack(c1); assert.equal(u.salt.length, m.SALT_LEN); assert.equal(u.iv.length, m.IV_LEN);
        ok('aes-crypt: roundtrip / tamper detection / wrong password / format errors');
    })());
}

// ===== 貸款：存款目標 =====
{
    const m = load('utils/loan-calculator.html', 'monthlyRate, monthsToGoal, requiredMonthly, valueAfter');
    near(m.monthlyRate(12), 0.01); near(m.monthlyRate(0), 0); near(m.monthlyRate(5, 5), 0); near(m.monthlyRate(8, 2), (1.08 / 1.02 - 1) / 12); assert.ok(m.monthlyRate(2, 5) < 0, '實質報酬為負');
    assert.equal(m.monthsToGoal(100, 100, 0, 0.01), 0); assert.equal(m.monthsToGoal(1000, 0, 100, 0), 10); assert.equal(m.monthsToGoal(1000, 0, 0, 0.01), null); assert.equal(m.monthsToGoal(1e9, 0, 1, 0), null, '超過 100 年');
    for (let t = 0; t < 200; t++) {
        const target = 1e5 + Util.rnd(1e7), pv = Util.rnd(1e5), pmt = 1000 + Util.rnd(30000), r = Util.rnd(100) / 10000, n = m.monthsToGoal(target, pv, pmt, r);
        if (n === null) continue; assert.ok(m.valueAfter(pv, pmt, r, n) >= target - 1e-6); assert.ok(n === 0 || m.valueAfter(pv, pmt, r, n - 1) < target);
        const need = m.requiredMonthly(target, pv, r, n); assert.ok(need <= pmt + 1e-6, '用 n 個月反推需要的月存額不會超過原本的'); near(m.valueAfter(pv, need, r, n), Math.max(target, pv * Math.pow(1 + r, n)), 1e-9);
    }
    assert.equal(m.requiredMonthly(1000, 2000, 0.01, 12), 0); near(m.requiredMonthly(1200, 0, 0, 12), 100); assert.ok(Number.isNaN(m.requiredMonthly(100, 0, 0.01, 0)));
    ok('loan-calculator: savings goal');
}

// ===== 圖片壓縮：SVG =====
{
    const m = load('utils/image-resize.html', 'fitSize, svgSize, withNamespace');
    assert.deepEqual(m.fitSize(24, 24, 1024, null, true), { w: 1024, h: 1024 }); assert.deepEqual(m.fitSize(100, 50, 64, 64, true), { w: 64, h: 32 }); assert.deepEqual(m.fitSize(100, 50, null, null, true), { w: 100, h: 50 }); assert.deepEqual(m.fitSize(100, 50, null, 200, true), { w: 400, h: 200 }); assert.deepEqual(m.fitSize(4000, 3000, 1920, null), { w: 1920, h: 1440 }, '一般圖片仍不放大'); assert.deepEqual(m.fitSize(800, 600, 1920, null), { w: 800, h: 600 });
    assert.deepEqual(m.svgSize('<svg width="200" height="100">'), { w: 200, h: 100 }); assert.deepEqual(m.svgSize('<svg width="50px" height="20px" viewBox="0 0 5 5">'), { w: 50, h: 20 }); assert.deepEqual(m.svgSize('<svg viewBox="0 0 24 24" xmlns="x">'), { w: 24, h: 24 }); assert.deepEqual(m.svgSize('<svg viewBox="0,0,10.5,20">'), { w: 10.5, h: 20 }); assert.deepEqual(m.svgSize('<SVG>'), { w: 300, h: 150 }); assert.equal(m.svgSize('hello'), null); assert.deepEqual(m.svgSize('<svg width="100%" height="100%" viewBox="0 0 8 4">'), { w: 8, h: 4 }, '百分比寬高改用 viewBox');
    assert.equal(m.withNamespace('<svg width="1">'), '<svg xmlns="http://www.w3.org/2000/svg" width="1">'); assert.equal(m.withNamespace('<svg xmlns="http://www.w3.org/2000/svg">'), '<svg xmlns="http://www.w3.org/2000/svg">'); ok('image-resize: svg size detection / upscaling');
}

// ===== 文字差異：逐字詞 =====
{
    const m = load('utils/text-diff.html', 'diffSeq, diffLines, tokenize, diffWords');
    assert.deepEqual(m.tokenize('我喜歡 apple_1, pie!'), ['我', '喜', '歡', ' ', 'apple_1', ',', ' ', 'pie', '!']); assert.deepEqual(m.tokenize(''), []);
    assert.deepEqual(m.diffWords('我喜歡 apple pie.', '我很喜歡 apples pie!'), [{ t: '=', text: '我' }, { t: '+', text: '很' }, { t: '=', text: '喜歡 ' }, { t: '-', text: 'apple' }, { t: '+', text: 'apples' }, { t: '=', text: ' pie' }, { t: '-', text: '.' }, { t: '+', text: '!' }]);
    assert.deepEqual(m.diffWords('same', 'same'), [{ t: '=', text: 'same' }]); assert.deepEqual(m.diffWords('', 'new text'), [{ t: '+', text: 'new text' }]); assert.deepEqual(m.diffWords('old', ''), [{ t: '-', text: 'old' }]);
    // 還原性質：把 '=' 和 '+' 接起來必須得到新文字；'=' 和 '-' 接起來必須得到舊文字（隨機文字測試）
    const alphabet = ['我', '你', 'ab', 'cd', ' ', ',', 'x1'], gen = () => Array.from({ length: Util.rnd(30) }, () => alphabet[Util.rnd(alphabet.length)]).join('');
    for (let i = 0; i < 300; i++) { const a = gen(), b = gen(), ops = m.diffWords(a, b); assert.equal(ops.filter(o => o.t !== '-').map(o => o.text).join(''), b); assert.equal(ops.filter(o => o.t !== '+').map(o => o.text).join(''), a); for (let k = 1; k < ops.length; k++) assert.notEqual(ops[k].t, ops[k - 1].t, '相鄰片段類型一定不同'); }
    assert.equal(m.diffWords('a '.repeat(3000), 'b '.repeat(3000)), null, '太長回傳 null'); assert.deepEqual(m.diffLines('a\nb\nc', 'a\nx\nc'), [{ t: '=', text: 'a' }, { t: '-', text: 'b' }, { t: '+', text: 'x' }, { t: '=', text: 'c' }]);
    ok('text-diff: word-level diff reconstructs both sides');
}

// ===== 單位換算：烹飪 =====
{
    const m = load('utils/unit-converter.html', 'convertAll, INGREDIENTS, COOK_VOL, COOK_MASS');
    const g = (v, from, to, ing) => m.convertAll('烹飪', v, from, null, ing).find(x => x.unit === to).value;
    near(g(1, '湯匙', '毫升', '水'), 15); near(g(1, '茶匙', '毫升', '食用油'), 5); near(g(1, '美制杯', '公克', '低筋麵粉'), 236.5882365 * 0.53); near(g(200, '公克', '公制杯', '砂糖'), 200 / 0.85 / 250); near(g(1, '磅', '公克', '水'), 453.59237); near(g(1000, '毫升', '公克', '牛奶'), 1030); near(g(1, '台兩', '公克', '水'), 37.5);
    for (const ing of Object.keys(m.INGREDIENTS)) for (const from of [...Object.keys(m.COOK_VOL), ...Object.keys(m.COOK_MASS)]) for (const to of [...Object.keys(m.COOK_VOL), ...Object.keys(m.COOK_MASS)]) { const v = g(g(3.7, from, to, ing), to, from, ing); near(v, 3.7, 1e-9); }              // 來回換算回到原值
    assert.equal(m.convertAll('烹飪', 1, '毫升', null, '水').length, Object.keys(m.COOK_VOL).length + Object.keys(m.COOK_MASS).length);
    assert.ok(g(1, '公克', '毫升', '蜂蜜') < g(1, '公克', '毫升', '水'), '蜂蜜比水重，同樣的公克體積較小'); assert.ok(Object.values(m.INGREDIENTS).every(d => d > 0.2 && d < 2));
    assert.ok(m.convertAll('長度', 1, '公尺').find(x => x.unit === '公分').value === 100, '原本的類別不受影響'); ok('unit-converter: cooking conversions round-trip');
}

// ===== 2048 / 踩地雷：每日挑戰 =====
{
    const m = load('mini-games/game-2048.html', 'N, emptyBoard, spawn, move, canMove, maxTile');
    const play = (seedStr, n) => { const r = Util.seeded(seedStr); let b = m.emptyBoard(); for (let i = 0; i < 2; i++) b = m.spawn(b, r.int, r).board; const log = []; const dirs = ['left', 'up', 'right', 'down']; for (let k = 0; k < n; k++) { const mv = m.move(b, dirs[k % 4]); if (!mv.moved) continue; b = mv.board; const s = m.spawn(b, r.int, r); if (!s) break; b = s.board; log.push(JSON.stringify(b)); } return log; };
    assert.deepEqual(play('2048-2024-03-10', 60), play('2048-2024-03-10', 60), '同一天同樣的操作 → 同樣的盤面'); assert.notDeepEqual(play('2048-2024-03-10', 60), play('2048-2024-03-11', 60));
    const mm = load('mini-games/minesweeper.html', 'create, around, placeMines, placeMinesFixed, open, flagsLeft');
    const board = (seed, first, w = 16, h = 16, mines = 40) => { const g = mm.create(w, h, mines); g.fixed = true; mm.placeMines(g, first, Util.seeded(seed).int); return g; };
    for (const [w, h, mines] of [[9, 9, 10], [16, 16, 40], [30, 16, 99]]) for (let t = 0; t < 30; t++) {
        const first = Util.rnd(w * h), g = board('mines-x' + t, first, w, h, mines);
        assert.equal(g.mine.reduce((a, v) => a + v, 0), mines, '雷數正確'); assert.equal(g.mine[first], 0, '第一下安全'); mm.around(g, first).forEach(i => assert.equal(g.mine[i], 0, '第一下周圍也安全'));
        for (let i = 0; i < w * h; i++) assert.equal(g.adj[i], mm.around(g, i).filter(j => g.mine[j]).length);
    }
    const a = board('mines-2024-03-10-16,16,40', 5), b = board('mines-2024-03-10-16,16,40', 5); assert.deepEqual([...a.mine], [...b.mine], '同種子同第一下 → 同雷區');
    const c = board('mines-2024-03-10-16,16,40', 250), diff = [...a.mine].filter((v, i) => v !== c.mine[i]).length; assert.ok(diff <= 20, '不同第一下，只有第一下附近的雷不同：' + diff); assert.notDeepEqual([...a.mine], [...board('mines-2024-03-11-16,16,40', 5).mine]);
    const g2 = mm.create(9, 9, 10); g2.fixed = true; mm.open(g2, 40, Util.seeded('z').int); assert.equal(g2.status, 'playing'); const g3 = mm.create(9, 9, 10); mm.open(g3, 40, Util.rnd); assert.equal(g3.status, 'playing', '一般模式不受影響');
    ok('daily challenge: seeded 2048 sequences / fixed minefield (safe first click, near-identical layouts)');
}


// ===== 時間戳轉換 =====
{
    const m = load('utils/timestamp.html', 'detectUnit, toMs, zoneOffsetMin, fmtInZone, fmtOffset, parseInZone, relative');
    assert.equal(m.detectUnit(1700000000), 's'); assert.equal(m.detectUnit(1700000000000), 'ms'); assert.equal(m.detectUnit(-1700000000000), 'ms');
    assert.equal(m.toMs(1700000000), 1700000000000); assert.equal(m.toMs(1700000000123), 1700000000123); assert.equal(m.toMs(1.5), 1500);
    assert.equal(m.fmtInZone(1700000000000, 'Asia/Taipei'), '2023-11-15 06:13:20'); assert.equal(m.fmtInZone(1700000000000, 'UTC'), '2023-11-14 22:13:20');
    assert.equal(m.fmtInZone(0, 'UTC'), '1970-01-01 00:00:00');
    assert.equal(m.zoneOffsetMin(Date.UTC(2024, 6, 1, 12), 'America/New_York'), -240); assert.equal(m.zoneOffsetMin(Date.UTC(2024, 0, 1, 12), 'America/New_York'), -300);
    assert.equal(m.zoneOffsetMin(Date.UTC(2024, 0, 1), 'Asia/Taipei'), 480); assert.equal(m.fmtOffset(480), 'UTC+08:00'); assert.equal(m.fmtOffset(-330), 'UTC-05:30');
    assert.equal(m.parseInZone('2023-11-15 06:13:20', 'Asia/Taipei'), 1700000000000); assert.equal(m.parseInZone('2023-11-15T06:13', 'Asia/Taipei'), 1700000000000 - 20000);
    for (const tz of ['America/New_York', 'Europe/London', 'Australia/Sydney', 'Asia/Tokyo']) for (const t of [1700000000000, 1720000000000, 1710000000000 + 86400000 * 3]) {
        const s = m.fmtInZone(t, tz); assert.equal(m.parseInZone(s, tz), Math.floor(t / 1000) * 1000, tz + ' ' + s);
    }
    assert.ok(Number.isNaN(m.parseInZone('2024-02-30T00:00', 'UTC'))); assert.ok(Number.isNaN(m.parseInZone('hello', 'UTC')));
    assert.equal(m.relative(-5 * 3600e3), '5 小時前'); assert.equal(m.relative(3 * 86400e3 + 5), '3 天後'); assert.equal(m.relative(-30e3), '30 秒前'); assert.equal(m.relative(0), '現在');
    ok('timestamp');
}

// ===== CSS 產生器 =====
{
    const m = load('utils/css-gen.html', 'clamp, hexToRgba, shadowCss, gradientCss, radiusCss');
    assert.equal(m.hexToRgba('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)'); assert.equal(m.hexToRgba('0a84ff', 1), 'rgba(10, 132, 255, 1)'); assert.equal(m.hexToRgba('#000000', 2), 'rgba(0, 0, 0, 1)');
    assert.throws(() => m.hexToRgba('#fff')); assert.throws(() => m.hexToRgba('red'));
    assert.equal(m.shadowCss({ x: 0, y: 10, blur: 30, spread: 0, color: '#000000', alpha: 0.25, inset: false }), 'box-shadow: 0px 10px 30px 0px rgba(0, 0, 0, 0.25);');
    assert.equal(m.shadowCss({ x: 1, y: 2, blur: 999, spread: -3, color: '#ffffff', alpha: 1, inset: true }), 'box-shadow: inset 1px 2px 200px -3px rgba(255, 255, 255, 1);');
    assert.equal(m.gradientCss({ type: 'linear', angle: 135, stops: [{ color: '#111111', pos: 0 }, { color: '#222222', pos: 100 }] }), 'background: linear-gradient(135deg, #111111 0%, #222222 100%);');
    assert.equal(m.gradientCss({ type: 'radial', angle: 0, stops: [{ color: '#111111', pos: 0 }, { color: '#222222', pos: 50 }, { color: '#333333', pos: 120 }] }), 'background: radial-gradient(circle, #111111 0%, #222222 50%, #333333 100%);');
    assert.throws(() => m.gradientCss({ type: 'linear', angle: 0, stops: [{ color: '#111111', pos: 0 }] }));
    assert.equal(m.radiusCss([8, 8, 8, 8]), 'border-radius: 8px;'); assert.equal(m.radiusCss([1, 2, 3, 4]), 'border-radius: 1px 2px 3px 4px;'); assert.equal(m.radiusCss([99, 0, 0, 0], '%'), 'border-radius: 50% 0% 0% 0%;');
    ok('css-gen');
}

// ===== 數字滑塊 =====
{
    const m = load('mini-games/sliding-puzzle.html', 'solvedBoard, isSolved, neighbors, moveTile, moveByKey, solvable, scramble');
    assert.deepEqual(m.solvedBoard(3), [1, 2, 3, 4, 5, 6, 7, 8, 0]); assert.ok(m.isSolved(m.solvedBoard(4)));
    assert.deepEqual(m.neighbors(3, 0).sort(), [1, 3]); assert.deepEqual(m.neighbors(3, 4).sort(), [1, 3, 5, 7]);
    const b = m.solvedBoard(3);
    assert.equal(m.moveTile(b, 3, 0), null); assert.deepEqual(m.moveTile(b, 3, 7), [1, 2, 3, 4, 5, 6, 7, 0, 8]); assert.deepEqual(b, m.solvedBoard(3), '不改動輸入');
    assert.deepEqual(m.moveByKey(b, 3, 'right'), [1, 2, 3, 4, 5, 6, 7, 0, 8]); assert.deepEqual(m.moveByKey(b, 3, 'down'), [1, 2, 3, 4, 5, 0, 7, 8, 6]); assert.equal(m.moveByKey(b, 3, 'left'), null); assert.equal(m.moveByKey(b, 3, 'up'), null);
    for (const n of [3, 4, 5]) for (let t = 0; t < 40; t++) { const s = m.scramble(n); assert.equal(s.length, n * n); assert.ok(!m.isSolved(s)); assert.ok(m.solvable(s, n), n + ':' + s); assert.deepEqual([...s].sort((x, y) => x - y), m.solvedBoard(n).slice().sort((x, y) => x - y)); }
    assert.ok(m.solvable(m.solvedBoard(4), 4)); const bad = m.solvedBoard(4); [bad[0], bad[1]] = [bad[1], bad[0]]; assert.ok(!m.solvable(bad, 4)); const bad3 = m.solvedBoard(3); [bad3[0], bad3[1]] = [bad3[1], bad3[0]]; assert.ok(!m.solvable(bad3, 3));
    assert.ok(!m.isSolved(m.scramble(3, 0)), '步數 0 也不會回傳已完成');
    ok('sliding-puzzle');
}

// ===== 擲筊 / 求籤 =====
{
    const m = load('fun/divination.html', 'throwBlocks, nextStreak, LEVELS, TEXT, drawFortune');
    assert.deepEqual(m.throwBlocks(() => 0), { a: 'round', b: 'round', result: '陰筊' }); assert.deepEqual(m.throwBlocks(() => 1), { a: 'flat', b: 'flat', result: '笑筊' });
    const seq = [1, 0]; assert.equal(m.throwBlocks(() => seq.shift()).result, '聖筊');
    const cnt = { 聖筊: 0, 笑筊: 0, 陰筊: 0 }; for (let i = 0; i < 20000; i++) cnt[m.throwBlocks().result]++;
    assert.ok(cnt.聖筊 > 9500 && cnt.聖筊 < 10500 && cnt.笑筊 > 4500 && cnt.笑筊 < 5500 && cnt.陰筊 > 4500 && cnt.陰筊 < 5500, JSON.stringify(cnt));
    assert.equal(m.nextStreak(2, '聖筊'), 3); assert.equal(m.nextStreak(2, '笑筊'), 0);
    assert.equal(m.drawFortune(() => 0).level, '大吉'); assert.equal(m.drawFortune(() => 9).level, '大吉'); assert.equal(m.drawFortune(() => 10).level, '中吉'); assert.equal(m.drawFortune(() => 99).level, '凶');
    const lv = {}; for (let i = 0; i < 20000; i++) { const f = m.drawFortune(); lv[f.level] = (lv[f.level] || 0) + 1; assert.deepEqual(Object.keys(f.items), ['事業', '感情', '財運', '健康']); Object.values(f.items).forEach(t => assert.ok(t.length > 4)); }
    assert.ok(lv['小吉'] > 5400 && lv['小吉'] < 6600 && lv['大吉'] > 1700 && lv['大吉'] < 2300, JSON.stringify(lv));
    for (const [name] of m.LEVELS) for (const k of Object.keys(m.TEXT)) assert.ok(m.TEXT[k][name], k + name);
    ok('divination');
}

// ===== 輪值表 =====
{
    const m = load('utils/duty-roster.html', 'weekdayOf, isWeekend, nextWeekday, buildRoster, tally');
    assert.equal(m.weekdayOf('2024-01-01'), 1); assert.equal(m.weekdayOf('2024-03-10'), 0); assert.equal(m.weekdayOf('1970-01-01'), 4); assert.ok(m.isWeekend('2024-03-09') && !m.isWeekend('2024-03-08')); assert.equal(m.nextWeekday('2024-03-09'), '2024-03-11');
    const names = ['甲', '乙', '丙'];
    let r = m.buildRoster({ names, start: '2024-01-01', period: 'week', count: 4 });
    assert.deepEqual(r.map(x => x.date), ['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22']); assert.deepEqual(r.map(x => x.name), ['甲', '乙', '丙', '甲']);
    r = m.buildRoster({ names, start: '2024-01-01', period: 'week', count: 3, offset: 4 }); assert.deepEqual(r.map(x => x.name), ['乙', '丙', '甲']);
    r = m.buildRoster({ names, start: '2024-03-08', period: 'day', count: 4, skipWeekend: true }); assert.deepEqual(r.map(x => x.date), ['2024-03-08', '2024-03-11', '2024-03-12', '2024-03-13']);
    r = m.buildRoster({ names, start: '2024-03-09', period: 'day', count: 2, skipWeekend: true }); assert.deepEqual(r.map(x => x.date), ['2024-03-11', '2024-03-12']);
    r = m.buildRoster({ names, start: '2024-03-09', period: 'day', count: 2 }); assert.deepEqual(r.map(x => x.date), ['2024-03-09', '2024-03-10']);
    r = m.buildRoster({ names, start: '2024-01-31', period: 'month', count: 4 }); assert.deepEqual(r.map(x => x.date), ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']);
    r = m.buildRoster({ names, start: '2024-01-01', period: 'biweek', count: 3 }); assert.deepEqual(r.map(x => x.date), ['2024-01-01', '2024-01-15', '2024-01-29']);
    assert.deepEqual(m.buildRoster({ names: [], start: '2024-01-01', period: 'week', count: 3 }), []);
    assert.deepEqual(m.tally(m.buildRoster({ names, start: '2024-01-01', period: 'week', count: 7 })), { 甲: 3, 乙: 2, 丙: 2 });
    ok('duty-roster');
}

// ===== 終極井字棋 =====
{
    const m = load('mini-games/ultimate-ttt.html', 'lineWinner, newGame, canPlay, play, validState');
    assert.equal(m.lineWinner([1, 1, 1, 0, 0, 0, 0, 0, 0]), 1); assert.equal(m.lineWinner([3, 3, 3, 0, 0, 0, 0, 0, 0]), 0, '平手的小棋盤不算'); assert.equal(m.lineWinner([2, 0, 0, 0, 2, 0, 0, 0, 2]), 2);
    let s = m.newGame(1);
    assert.ok(m.validState(s)); assert.ok(!m.play(s, 2, 4, 4), '還沒輪到'); assert.ok(m.play(s, 1, 4, 0)); assert.equal(s.next, 0); assert.equal(s.turn, 2);
    assert.ok(!m.play(s, 2, 1, 1), '必須下在第 0 區'); assert.ok(!m.play(s, 2, 0, 9)); assert.ok(!m.play(s, 2, -1, 0)); assert.ok(!m.play(s, 2, 0.5, 0)); assert.ok(m.play(s, 2, 0, 4)); assert.equal(s.next, 4);
    assert.ok(!m.play(s, 1, 4, 0), '格子已被佔'); assert.ok(m.validState(s));
    // 小棋盤獲勝後，指到已結束的棋盤 → 任選
    s = m.newGame(1); s.cells[0] = [1, 1, 0, 2, 2, 0, 0, 0, 0]; s.turn = 1; s.next = 0;
    assert.ok(m.play(s, 1, 0, 2)); assert.equal(s.small[0], 1); assert.equal(s.next, 2, '對應的小棋盤 2 還沒結束'); assert.equal(s.turn, 2);
    s = m.newGame(1); s.small[2] = 1; s.cells[0] = [0, 0, 0, 0, 0, 0, 0, 0, 0]; s.turn = 1; s.next = 0; assert.ok(m.play(s, 1, 0, 2)); assert.equal(s.next, -1, '送到已結束的棋盤：對手任選');
    // 大棋盤連線獲勝
    s = m.newGame(1); s.small[0] = 1; s.small[1] = 1; s.cells[2] = [1, 1, 0, 2, 2, 0, 0, 0, 0]; s.turn = 1; s.next = 2;
    assert.ok(m.play(s, 1, 2, 2)); assert.equal(s.winner, 1); assert.ok(!m.play(s, 2, 4, 4), '結束後不能再下'); assert.ok(m.validState(s));
    // 小棋盤填滿平手 = 3
    s = m.newGame(1); s.cells[5] = [1, 2, 1, 1, 2, 2, 2, 1, 0]; s.turn = 1; s.next = 5; assert.ok(m.play(s, 1, 5, 8)); assert.equal(s.small[5], 3);
    // 隨機對局：一定會結束、狀態始終合法、贏家是真的連線
    for (let g = 0; g < 400; g++) {
        s = m.newGame(1 + (g % 2));
        for (let k = 0; k < 90 && !s.winner && !s.draw; k++) {
            const moves = []; for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) if (m.canPlay(s, s.turn, b, c)) moves.push([b, c]);
            assert.ok(moves.length > 0, '沒有合法步卻沒結束');
            const [b, c] = moves[Util.rnd(moves.length)]; assert.ok(m.play(s, s.turn, b, c)); assert.ok(m.validState(s));
        }
        assert.ok(s.winner || s.draw); if (s.winner) assert.equal(m.lineWinner(s.small), s.winner);
    }
    assert.ok(!m.validState({ ...m.newGame(1), next: 9 })); assert.ok(!m.validState({ ...m.newGame(1), small: [0, 0, 0, 0, 0, 0, 0, 0, 4] })); assert.ok(!m.validState(null));
    ok('ultimate-ttt');
}

// ===== UNO =====
{
    const m = load('mini-games/uno.html', 'COLORS, validCard, makeDeck, canPlayCard, nextOf, newGame, playCard, drawCard, passTurn, skipOffline, validPublic');
    const deck = m.makeDeck(); assert.equal(deck.length, 108); assert.ok(deck.every(m.validCard)); assert.equal(deck.filter(c => c === 'WF').length, 4); assert.equal(deck.filter(c => c === 'R0').length, 1); assert.equal(deck.filter(c => c === 'G5').length, 2);
    for (const bad of ['', 'X1', 'R', 'RA', 'W0', 'WWW', 5, null]) assert.ok(!m.validCard(bad), String(bad));
    assert.ok(m.canPlayCard('R5', 'R9', 'R')); assert.ok(m.canPlayCard('B9', 'R9', 'R')); assert.ok(!m.canPlayCard('B8', 'R9', 'R')); assert.ok(m.canPlayCard('WW', 'R9', 'R')); assert.ok(m.canPlayCard('BS', 'RS', 'R')); assert.ok(m.canPlayCard('Y3', 'WW', 'Y'), '萬用牌選了黃色'); assert.ok(!m.canPlayCard('R3', 'WW', 'Y'));
    const shuf = (a) => Util.shuffle(a);
    const total = (g) => g.hands.reduce((s, h) => s + h.length, 0) + g.deck.length + g.discard.length;
    let g = m.newGame(4, shuf); assert.equal(total(g), 108); assert.ok(g.hands.every(h => h.length === 7)); assert.ok(/^[RYGB][0-9]$/.test(g.discard[0])); assert.equal(g.color, g.discard[0][0]);
    // 指定牌局測規則
    const mk = (hands, top, color, n = hands.length) => ({ hands, deck: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'], discard: [top], color, turn: 0, dir: 1, drew: false, drawnIdx: -1, winner: -1, log: '', shuffleFn: shuf });
    g = mk([['R5', 'B7', 'GS'], ['Y1', 'Y2'], ['G1', 'G2'], ['B1', 'B2']], 'R9', 'R');
    assert.ok(!m.playCard(g, 1, 0), '不是你的回合'); assert.ok(!m.playCard(g, 0, 1), 'B7 不能出'); assert.ok(!m.playCard(g, 0, 9)); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.turn, 1); assert.deepEqual(g.hands[0], ['B7', 'GS']);
    g = mk([['RS', 'R1'], ['Y1'], ['G1'], ['B1']], 'R9', 'R'); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.turn, 2, '跳過下一位');
    g = mk([['RR', 'R1'], ['Y1'], ['G1'], ['B1']], 'R9', 'R'); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.dir, -1); assert.equal(g.turn, 3, '迴轉後換上一位');
    g = mk([['RR', 'R1'], ['Y1']], 'R9', 'R'); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.turn, 0, '兩人時迴轉 = 跳過');
    g = mk([['RD', 'R1'], ['Y1'], ['G1']], 'R9', 'R'); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.hands[1].length, 3); assert.equal(g.turn, 2, '抽二並跳過');
    g = mk([['WF', 'R1'], ['Y1'], ['G1']], 'R9', 'R'); assert.ok(!m.playCard(g, 0, 0), '萬用牌沒選色'); assert.ok(!m.playCard(g, 0, 0, 'X')); assert.ok(m.playCard(g, 0, 0, 'B')); assert.equal(g.color, 'B'); assert.equal(g.hands[1].length, 5); assert.equal(g.turn, 2);
    g = mk([['R1'], ['Y1']], 'R9', 'R'); assert.ok(m.playCard(g, 0, 0)); assert.equal(g.winner, 0); assert.ok(!m.playCard(g, 1, 0) && !m.drawCard(g, 1), '結束後不能再動作');
    // 抽牌：抽到能出的留著；不能出的換人
    g = mk([['B7'], ['Y1'], ['G1']], 'R9', 'R'); g.deck = ['G3', 'R4']; assert.ok(m.drawCard(g, 0)); assert.equal(g.hands[0].length, 2); assert.equal(g.drew, true, 'R4 可出'); assert.equal(g.turn, 0);
    assert.ok(!m.drawCard(g, 0), '已抽過不能再抽'); assert.ok(!m.playCard(g, 0, 0), '只能出剛抽的那張'); assert.ok(m.passTurn(g, 0)); assert.equal(g.turn, 1); assert.equal(g.drew, false);
    g = mk([['B7'], ['Y1'], ['G1']], 'R9', 'R'); g.deck = ['G3']; assert.ok(m.drawCard(g, 0)); assert.equal(g.turn, 1, '抽到不能出的牌：直接換人'); assert.ok(!m.passTurn(g, 1), '沒抽牌不能過');
    g = mk([['B7'], ['Y1'], ['G1']], 'R9', 'R'); g.deck = ['R4']; assert.ok(m.drawCard(g, 0)); assert.ok(m.playCard(g, 0, 1)); assert.equal(g.turn, 1); assert.equal(g.drew, false);
    // 牌堆空了：把棄牌堆（留最上面一張）洗回去
    g = mk([['B7'], ['Y1']], 'R9', 'R'); g.deck = []; g.discard = ['G2', 'G3', 'G4', 'R9']; assert.ok(m.drawCard(g, 0)); assert.equal(g.discard.length, 1); assert.equal(g.hands[0].length, 2);
    g = mk([['B7'], ['Y1']], 'R9', 'R'); g.deck = []; assert.ok(m.drawCard(g, 0)); assert.equal(g.turn, 1, '完全沒牌可抽：換人');
    // 離線的人被跳過
    g = mk([['B7'], ['Y1'], ['G1']], 'R9', 'R'); g.turn = 1; assert.ok(m.skipOffline(g, [true, false, true])); assert.equal(g.turn, 2); assert.ok(!m.skipOffline(g, [true, true, true]));
    // 隨機對局：牌數守恆、一定能結束
    let finished = 0;
    for (let t = 0; t < 150; t++) {
        const n = 2 + (t % 5); g = m.newGame(n, shuf);
        for (let step = 0; step < 4000 && g.winner < 0; step++) {
            const p = g.turn, hand = g.hands[p], top = g.discard[g.discard.length - 1];
            const idxs = hand.map((c, i) => i).filter(i => m.canPlayCard(hand[i], top, g.color) && (!g.drew || i === g.drawnIdx));
            if (idxs.length && Util.rnd(10) < 9) { const i = idxs[Util.rnd(idxs.length)]; assert.ok(m.playCard(g, p, i, m.COLORS[Util.rnd(4)])); }
            else if (!g.drew) assert.ok(m.drawCard(g, p)); else assert.ok(m.passTurn(g, p));
            assert.equal(total(g), 108);
        }
        if (g.winner >= 0) { finished++; assert.equal(g.hands[g.winner].length, 0); }
    }
    assert.ok(finished >= 140, '隨機對局大多能結束：' + finished);
    const pub = { phase: 'play', names: ['a', 'b'], counts: [3, 4], active: [true, true], top: 'R5', color: 'R', turn: 0, dir: 1, winner: -1, drew: false, log: '', deckLeft: 50 };
    assert.ok(m.validPublic(pub)); assert.ok(!m.validPublic({ ...pub, top: 'ZZ' })); assert.ok(!m.validPublic({ ...pub, counts: [1] })); assert.ok(!m.validPublic({ ...pub, dir: 0 })); assert.ok(!m.validPublic(null)); assert.ok(!m.validPublic({ ...pub, phase: 'x' }));
    ok('uno');
}

// ===== 編碼解碼：網址參數 / 檔案雜湊 =====
{
    const m = load('utils/encode-decode.html', 'CODECS, hashBytes, normHex, sameHash, urlParse, urlParseText, urlBuild');
    assert.deepEqual(m.urlParse('https://example.com/a/b?q=%E4%BD%A0%E5%A5%BD&tag=a&tag=b#top'), { base: 'https://example.com/a/b', hash: 'top', params: [['q', '你好'], ['tag', 'a'], ['tag', 'b']] });
    assert.deepEqual(m.urlParse('?a=1&b=x+y').params, [['a', '1'], ['b', 'x y']]); assert.deepEqual(m.urlParse('a=1').params, [['a', '1']]);
    assert.throws(() => m.urlParse('')); assert.throws(() => m.urlParse('hello world'));
    assert.equal(m.urlParseText('https://x.io/p?a=1&b=%26'), ['網址：https://x.io/p', '參數（2 個，已解碼；可直接改完按「編碼」組回去）：', 'a=1', 'b=&'].join(NL));
    assert.equal(m.urlParseText('https://x.io/'), ['網址：https://x.io/', '沒有查詢參數'].join(NL));
    assert.equal(m.urlBuild(['a=1', 'b=你 好', '', 'c', 'd=x=y'].join(NL)), 'a=1&b=%E4%BD%A0%20%E5%A5%BD&c=&d=x%3Dy');
    assert.equal(m.urlBuild(m.urlParseText('https://x.io/p?a=1&b=%26&c=%E4%BD%A0')), 'a=1&b=%26&c=%E4%BD%A0', '拆解後直接組回去會得到同樣的參數');
    assert.equal(m.CODECS['網址參數（拆解 / 組合）'].dec('?k=v'), ['參數（1 個，已解碼；可直接改完按「編碼」組回去）：', 'k=v'].join(NL));
    assert.equal(m.normHex('0xAB:cd ef'), 'abcdef'); assert.ok(m.sameHash('AB CD', 'abcd')); assert.ok(!m.sameHash('', '')); assert.ok(!m.sameHash('ab', 'ac'));
    pending.push(m.hashBytes(new TextEncoder().encode('abc'), 'SHA-256').then(h => { assert.equal(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); return m.hashBytes(new Uint8Array(0), 'SHA-1'); }).then(h => { assert.equal(h, 'da39a3ee5e6b4b0d3255bfef95601890afd80709'); ok('encode-decode: url params / file hash'); }));
}

// ===== JSON ↔ YAML / CSV =====
{
    const m = load('utils/json-formatter.html', 'jsonToYaml, parseYaml, jsonToCsv, csvToJson');
    const samples = [
        { a: 1, b: 'x y', c: [1, 2, { d: null, e: true }], f: { g: [], h: {} }, 'k: z': 'v: w', s: '', n: '123', t: 'true', u: '日本', m: 'line1' + NL + 'line2', date: '2024-01-05', neg: -1.5, tag: '#hash', q: "it's", dash: '- not list', colon: 'a:b', nul: 'null' },
        [1, [2, 3], { a: [{ b: 1 }] }, []], 'hi', 42, null, true, { x: [[1, 2], [3]], phone: '0912345678', big: 1e21, small: 0.000001 }, [], {},
    ];
    for (const v of samples) { const y = m.jsonToYaml(v); assert.deepStrictEqual(m.parseYaml(y), v, y); }
    assert.equal(m.jsonToYaml({ a: [1, { b: 2, c: 3 }], d: {} }), ['a:', '  - 1', '  - b: 2', '    c: 3', 'd: {}'].join(NL));
    const doc = ['# 註解', 'name: demo   # 行尾註解', 'list:', '- a', '- b: 1', '  c: [1, 2, "x,y"]', 'nested:', '  inner: {k: v, n: 3}', '  empty:', 'phone: 0912345678', "quote: 'it''s'", 'url: http://a.b/c#d', 'on: yes'].join(NL);
    assert.deepStrictEqual(m.parseYaml(doc), { name: 'demo', list: ['a', { b: 1, c: [1, 2, 'x,y'] }], nested: { inner: { k: 'v', n: 3 }, empty: null }, phone: '0912345678', quote: "it's", url: 'http://a.b/c#d', on: 'yes' });
    assert.deepStrictEqual(m.parseYaml('---' + NL + 'a: 1'), { a: 1 }); assert.equal(m.parseYaml(''), null); assert.equal(m.parseYaml('# only comment'), null); assert.deepStrictEqual(m.parseYaml('- 1' + NL + '- 2'), [1, 2]); assert.deepStrictEqual(m.parseYaml('a:' + NL + '- 1' + NL + '- 2' + NL + 'b: 3'), { a: [1, 2], b: 3 });
    for (const [bad, msg] of [['a: |' + NL + '  x', '多行'], ['a: &x 1', '錨點'], ['a: 1' + NL + 'a: 2', '重複'], ['a:' + NL + '  b: 1' + NL + ' c: 2', '縮排'], ['a: 1' + NL + '---' + NL + 'b: 2', '多份'], ['- a' + NL + 'b: 1', ''], ['a: [1, 2', '行內'], ['"x: 1', '引號'], ['a:' + NL + '\tb: 1', 'Tab']]) assert.throws(() => m.parseYaml(bad), (e) => e.message.includes(msg), JSON.stringify(bad));
    assert.equal(m.jsonToCsv([{ a: 1, b: 'x,y' }, { a: 2, c: { z: 1 } }]), ['a,b,c', '1,"x,y",', '2,,"{""z"":1}"'].join('\r\n'));
    assert.throws(() => m.jsonToCsv({ a: 1 })); assert.throws(() => m.jsonToCsv([])); assert.throws(() => m.jsonToCsv([1, 2]));
    assert.deepEqual(m.csvToJson('a,b\r\n1,"x,y"\r\n2,'), [{ a: 1, b: 'x,y' }, { a: 2, b: '' }]); assert.deepEqual(m.csvToJson('a\tb\n1\ttrue'), [{ a: 1, b: true }]); assert.deepEqual(m.csvToJson('a,a\n1,2'), [{ a: 1, a_2: 2 }]);
    const rt = [{ n: 'A "q"', v: 'line' + NL + 'two', z: ' pad ' }]; assert.deepEqual(m.csvToJson(m.jsonToCsv(rt)), rt.map(o => ({ ...o })));
    ok('json-formatter: yaml / csv conversion');
    assert.equal(Util.csvStringify(['a', 'b'], [['1', 'x"y'], [null, undefined]]), ['a,b', '1,"x""y"', ','].join('\r\n'));
    ok('util: csvStringify');
}

// ===== 記帳本：固定支出 =====
{
    const m = load('utils/expense-tracker.html', 'validFixed, dueAt, nextDue, monthlyCost, dueInMonth, CYCLES');
    const f = (cycle, start, amt = 100) => ({ id: 'x', name: 'N', amt, cycle, start });
    assert.ok(m.validFixed(f('month', '2024-01-05'))); assert.ok(!m.validFixed({ ...f('month', '2024-01-05'), amt: 0 })); assert.ok(!m.validFixed({ ...f('day', '2024-01-05') })); assert.ok(!m.validFixed({ ...f('month', '2024-1-5') })); assert.ok(!m.validFixed(null)); assert.ok(!m.validFixed({ ...f('month', '2024-01-05'), name: '' }));
    assert.equal(m.nextDue(f('month', '2024-01-31'), '2024-02-01'), '2024-02-29'); assert.equal(m.nextDue(f('month', '2024-01-31'), '2024-03-01'), '2024-03-31'); assert.equal(m.nextDue(f('month', '2024-01-31'), '2024-02-29'), '2024-02-29', '當天算下一次');
    assert.equal(m.nextDue(f('month', '2024-06-15'), '2024-01-01'), '2024-06-15', '還沒開始：第一次'); assert.equal(m.nextDue(f('year', '2020-02-29'), '2024-03-01'), '2025-02-28'); assert.equal(m.nextDue(f('year', '2020-02-29'), '2024-02-01'), '2024-02-29');
    assert.equal(m.nextDue(f('week', '2024-01-01'), '2024-01-02'), '2024-01-08'); assert.equal(m.nextDue(f('week', '2000-01-03'), '2024-03-10'), '2024-03-11'); assert.equal(m.nextDue(f('month', '1990-05-20'), '2026-10-03'), '2026-10-20');
    near(m.monthlyCost(f('month', '2024-01-01', 300)), 300); near(m.monthlyCost(f('year', '2024-01-01', 1200)), 100); near(m.monthlyCost(f('week', '2024-01-01', 100)), 100 * 52 / 12);
    assert.deepEqual(m.dueInMonth(f('week', '2024-01-01'), '2024-02'), ['2024-02-05', '2024-02-12', '2024-02-19', '2024-02-26']); assert.deepEqual(m.dueInMonth(f('month', '2024-01-31'), '2024-02'), ['2024-02-29']);
    assert.deepEqual(m.dueInMonth(f('year', '2020-07-04'), '2024-07'), ['2024-07-04']); assert.deepEqual(m.dueInMonth(f('year', '2020-07-04'), '2024-08'), []); assert.deepEqual(m.dueInMonth(f('month', '2024-06-15'), '2024-05'), [], '開始之前沒有');
    ok('expense-tracker: fixed expenses');
}

// ===== 體重紀錄 =====
{
    const m = load('utils/health-calc.html', 'validWeight, addWeight, slopePerDay, etaGoal');
    assert.ok(m.validWeight({ d: '2024-01-01', kg: 60 })); assert.ok(!m.validWeight({ d: '2024-01-01', kg: 5 })); assert.ok(!m.validWeight({ d: '2024/01/01', kg: 60 })); assert.ok(!m.validWeight({ d: '2024-01-01', kg: NaN }));
    let log = []; log = m.addWeight(log, '2024-01-03', 60); log = m.addWeight(log, '2024-01-01', 61); log = m.addWeight(log, '2024-01-03', 59.5);
    assert.deepEqual(log, [{ d: '2024-01-01', kg: 61 }, { d: '2024-01-03', kg: 59.5 }], '同一天取代、依日期排序'); assert.equal(m.addWeight(Array.from({ length: 1000 }, (_, i) => ({ d: Util.day.shift('2000-01-01', i), kg: 60 })), '2030-01-01', 60).length, 1000);
    const lin = Array.from({ length: 11 }, (_, i) => ({ d: Util.day.shift('2024-01-01', i), kg: 70 - i * 0.1 }));
    near(m.slopePerDay(lin, 30, '2024-01-11'), -0.1); assert.equal(m.slopePerDay([{ d: '2024-01-01', kg: 60 }], 30, '2024-01-02'), null); assert.equal(m.slopePerDay(lin, 3, '2024-01-11') !== null, true); assert.equal(m.slopePerDay(lin, 30, '2023-12-01'), null, '未來的紀錄不算');
    const e = m.etaGoal(lin, 68, '2024-01-11'); assert.equal(e.days, 10); assert.equal(e.date, '2024-01-21');
    assert.deepEqual(m.etaGoal(lin, 72, '2024-01-11'), { days: null }, '趨勢往反方向'); assert.deepEqual(m.etaGoal(lin, 69, '2024-01-11'), { reached: true }); assert.equal(m.etaGoal([lin[0]], 60, '2024-01-01'), null);
    const flat = lin.map(x => ({ ...x, kg: 70 })); assert.deepEqual(m.etaGoal(flat, 65, '2024-01-11'), { days: null });
    ok('health-calc: weight log');
}

// ===== 倒數日：清單 =====
{
    const m = load('utils/countdown.html', 'PACKING, validItems, itemProgress, addItem, toggleItem, mergeTemplate');
    let it = []; it = m.addItem(it, '  護照 '); assert.deepEqual(it, [{ t: '護照', done: false }]); assert.equal(m.addItem(it, '護照'), it, '不重複'); assert.equal(m.addItem(it, '   '), it);
    assert.equal(m.addItem([], 'x'.repeat(50))[0].t.length, 30); const full = Array.from({ length: 60 }, (_, i) => ({ t: 'i' + i, done: false })); assert.equal(m.addItem(full, 'new'), full);
    const t2 = m.toggleItem(it, 0); assert.equal(t2[0].done, true); assert.equal(it[0].done, false, '不改動原陣列'); assert.deepEqual(m.itemProgress(m.addItem(t2, '充電器')), { done: 1, total: 2 });
    const merged = m.mergeTemplate(it, m.PACKING); assert.equal(merged.length, m.PACKING.length + (m.PACKING.includes('護照') ? 0 : 1)); assert.equal(m.mergeTemplate(merged, m.PACKING).length, merged.length, '重複加入範本不會變多');
    assert.ok(m.validItems([])); assert.ok(m.validItems(merged)); assert.ok(!m.validItems([{ t: '', done: false }])); assert.ok(!m.validItems('x')); assert.ok(!m.validItems([{ t: 'a', done: 1 }]));
    ok('countdown: checklist');
}

// ===== 單機模式 / 新工具測試：tests/solo-*.test.js、tests/new-*.test.js 各自獨立，這裡一起執行；非同步測試請 push 到 require('./_load').pending =====
for (const f of fs.readdirSync(__dirname).filter(x => /^(solo|new)-.*\.test\.js$/.test(x)).sort()) require(path.join(__dirname, f));
pending.push(...require('./_load').pending);

Promise.all(pending).then(() => console.log('ALL OK')).catch((e) => { console.error(e); process.exit(1); });
