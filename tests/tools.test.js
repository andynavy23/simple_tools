// 各工具「純邏輯」的測試：node tests/tools.test.js
// 做法：從各 HTML 取出 `// --- pure ---` 到 `// --- /pure ---` 之間的程式碼來執行，不需要瀏覽器或任何套件。
// （連線相關見 tests/shared.test.js；畫面互動需另外在瀏覽器測。）
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const root = path.join(__dirname, '..');
global.Util = require(path.join(root, 'shared/js/util.js'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// 頁面外層用 const { ... } = Util 取得共用函式，這裡提供同樣的名稱
const PRELUDE = 'const { rnd, shuffle, store, copyText, esc, day, statRow } = Util;\n';
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
    const m = load('fun/random-groups.html', 'parseNames, split');
    assert.deepEqual(m.parseNames('小明\n小華, 小美，阿強、 \n\n'), ['小明', '小華', '小美', '阿強']);
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

console.log('ALL OK');
