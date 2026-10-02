// 各工具「純邏輯」的測試：node tests/tools.test.js
// 做法：從各 HTML 取出 `// --- pure ---` 到 `// --- /pure ---` 之間的程式碼來執行，不需要瀏覽器或任何套件。
// （連線相關見 tests/shared.test.js；畫面互動需另外在瀏覽器測。）
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const root = path.join(__dirname, '..');
global.Util = require(path.join(root, 'shared/js/util.js'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// 頁面外層用 const { ... } = Util 取得共用函式，這裡提供同樣的名稱
const PRELUDE = 'const { rnd, shuffle, store, copyText, esc, day, statRow, tone, beep, speak, parseNames, download } = Util;\n';
const load = (file, names, from = '// --- pure ---', to = '// --- /pure ---') => {
    const h = read(file);
    return new Function(PRELUDE + h.slice(h.indexOf(from), h.indexOf(to)) + `; return { ${names} };`)();
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);
const ok = (name) => console.log('ok  ' + name);
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
    const m = load('fun/random-groups.html', 'split');
    assert.deepEqual(Util.parseNames('小明\n小華, 小美，阿強、 \n\n'), ['小明', '小華', '小美', '阿強']);
    const names = Array.from({ length: 23 }, (_, i) => 'n' + i);
    for (let t = 0; t < 300; t++) {
        const n = 1 + (t % 9), g = m.split(names, n), sizes = g.map(x => x.length);
        assert.equal(g.length, n);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
        assert.deepEqual(g.flat().sort(), [...names].sort());
    }
    ok('random-groups');
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
    for (const [name, c] of Object.entries(m.CODECS)) for (const s of samples) assert.equal(c.dec(c.enc(s)), s, name);
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
    const m = load('utils/word-count.html', 'count, fmtRead');
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
    ok('word-count');
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
    const m = load('utils/date-calc.html', 'isLeap, daysInMonth, weekday, diffYMD, addMonths, workdaysBetween, addWorkdays, dayOfYear, isoWeek');
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

console.log('ALL OK');
