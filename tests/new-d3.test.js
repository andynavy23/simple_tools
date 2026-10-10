// 批次 d3：json-formatter 的 TOML、markdown-preview 的表格輔助、text-tools 的統計
const { load, ok } = require('./_load');
const assert = require('assert');
const J = (v) => JSON.stringify(v);
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---------- TOML ----------
{
    const { parseToml, jsonToToml, jsonToYaml, parseYaml } = load('utils/json-formatter.html', 'parseToml, jsonToToml, jsonToYaml, parseYaml');
    const P = (t) => plain(parseToml(t));
    const err = (t, re) => assert.throws(() => parseToml(t), re || /第 \d+ 行/, t);

    // 規範範例（節錄自 toml.io）
    const spec = `# This is a TOML document
title = "TOML Example"

[owner]
name = "Tom Preston-Werner"
dob = 1979-05-27T07:32:00-08:00

[database]
enabled = true
ports = [ 8000, 8001, 8002 ]
data = [ ["delta", "phi"], [3.14] ]
temp_targets = { cpu = 79.5, case = 72.0 }

[servers]

[servers.alpha]
ip = "10.0.0.1"
role = "frontend"

[servers.beta]
ip = "10.0.0.2"
role = "backend"
`;
    const r = P(spec);
    assert.strictEqual(r.title, 'TOML Example');
    assert.strictEqual(r.owner.dob, '1979-05-27T07:32:00-08:00');
    assert.deepStrictEqual(r.database.ports, [8000, 8001, 8002]);
    assert.deepStrictEqual(r.database.data, [['delta', 'phi'], [3.14]]);
    assert.deepStrictEqual(r.database.temp_targets, { cpu: 79.5, case: 72 });
    assert.strictEqual(r.servers.beta.role, 'backend');
    ok('toml: 規範範例');

    // 字串
    assert.strictEqual(P('a = "I\'m a string. \\"You can quote me\\". Name\\tJos\\u00E9\\nLocation\\tSF."').a, 'I\'m a string. "You can quote me". Name\tJosé\nLocation\tSF.');
    assert.strictEqual(P('a = \'C:\\Users\\nodejs\\templates\'').a, 'C:\\Users\\nodejs\\templates');
    assert.strictEqual(P('a = """\nRoses are red\nViolets are blue"""').a, 'Roses are red\nViolets are blue');
    assert.strictEqual(P('a = """\nThe quick brown \\\n\n   fox jumps over \\\n the lazy dog."""').a, 'The quick brown fox jumps over the lazy dog.');
    assert.strictEqual(P("a = '''\nfirst\n  second'''").a, 'first\n  second');
    assert.strictEqual(P('a = """Here are two quotation marks: "". Simple enough."""').a, 'Here are two quotation marks: "". Simple enough.');
    assert.strictEqual(P('a = """Here are three: ""\\"."""').a, 'Here are three: """.');
    assert.strictEqual(P('a = """"This," she said, "is just a pointless statement.""""').a, '"This," she said, "is just a pointless statement."');
    assert.strictEqual(P("a = ''''That,' she said.'''").a, "'That,' she said.");
    assert.strictEqual(P('a = "\\U0001F600"').a, '😀');
    assert.strictEqual(P('a = ""').a, '');
    assert.strictEqual(P('a = "x" # c').a, 'x');
    assert.strictEqual(P('a = "# not comment"').a, '# not comment');
    ok('toml: 字串（基本/字面/多行/跳脫）');

    // 數值 / 布林 / 日期
    const nums = P('i1 = +99\ni2 = 42\ni3 = 0\ni4 = -17\ni5 = 1_000\nh = 0xDEAD_beef\no = 0o755\nb = 0b1101\nf1 = +1.0\nf2 = 3.1415\nf3 = -0.01\nf4 = 5e+22\nf5 = 1e06\nf6 = -2E-2\nf7 = 6.626e-34\nf8 = 224_617.445_991\nt = true\nf = false');
    assert.deepStrictEqual(nums, { i1: 99, i2: 42, i3: 0, i4: -17, i5: 1000, h: 0xDEADBEEF, o: 493, b: 13, f1: 1, f2: 3.1415, f3: -0.01, f4: 5e22, f5: 1e6, f6: -0.02, f7: 6.626e-34, f8: 224617.445991, t: true, f: false });
    const dt = P('a = 1979-05-27T07:32:00Z\nb = 1979-05-27 07:32:00.999999+09:30\nc = 1979-05-27T07:32:00\nd = 1979-05-27\ne = 07:32:00\nf = 00:32:00.5');
    assert.deepStrictEqual(dt, { a: '1979-05-27T07:32:00Z', b: '1979-05-27 07:32:00.999999+09:30', c: '1979-05-27T07:32:00', d: '1979-05-27', e: '07:32:00', f: '00:32:00.5' });
    ok('toml: 數值/布林/日期時間');

    // 表格
    assert.deepStrictEqual(P('[a.b.c]\nx = 1\n[a]\ny = 2'), { a: { b: { c: { x: 1 } }, y: 2 } });
    assert.deepStrictEqual(P('[ a . b ]\nx = 1'), { a: { b: { x: 1 } } });
    assert.deepStrictEqual(P('[x]\n[x.y]\nz = 1'), { x: { y: { z: 1 } } });
    assert.deepStrictEqual(P('fruit.apple.color = "red"\nfruit.apple.taste.sweet = true\nfruit.orange = 2'), { fruit: { apple: { color: 'red', taste: { sweet: true } }, orange: 2 } });
    assert.deepStrictEqual(P('"a b"."c" = 1\n\'d\' = 2\n"" = 3'), { 'a b': { c: 1 }, d: 2, '': 3 });
    assert.deepStrictEqual(P('1234 = "v"\nbare_key-1 = 1'), { 1234: 'v', 'bare_key-1': 1 });
    // 陣列表格
    const aot = P('[[products]]\nname = "Hammer"\nsku = 738594937\n\n[[products]]\n\n[[products]]\nname = "Nail"\ncolor = "gray"');
    assert.deepStrictEqual(aot, { products: [{ name: 'Hammer', sku: 738594937 }, {}, { name: 'Nail', color: 'gray' }] });
    const nested = P('[[fruits]]\nname = "apple"\n[fruits.physical]\ncolor = "red"\n[[fruits.varieties]]\nname = "red delicious"\n[[fruits.varieties]]\nname = "granny smith"\n[[fruits]]\nname = "banana"\n[[fruits.varieties]]\nname = "plantain"');
    assert.deepStrictEqual(nested, { fruits: [{ name: 'apple', physical: { color: 'red' }, varieties: [{ name: 'red delicious' }, { name: 'granny smith' }] }, { name: 'banana', varieties: [{ name: 'plantain' }] }] });
    // 行內表格 / 陣列
    assert.deepStrictEqual(P('p = { x = 1, y = 2 }\nq = { a.b = 1, "c d" = [1, 2] }\ne = {}'), { p: { x: 1, y: 2 }, q: { a: { b: 1 }, 'c d': [1, 2] }, e: {} });
    assert.deepStrictEqual(P('a = [\n  1, # one\n  2,\n  # c\n]\nb = []\nc = [ "x", 1, [true], { k = 1 } ]'), { a: [1, 2], b: [], c: ['x', 1, [true], { k: 1 }] });
    assert.deepStrictEqual(P('contributors = [\n  "Foo Bar <foo@example.com>",\n  { name = "Baz Qux", email = "bazqux@example.com", url = "https://example.com/bazqux" }\n]').contributors[1].name, 'Baz Qux');
    // 註解 / 空白 / CRLF / BOM / 空文件
    assert.deepStrictEqual(P('\uFEFF# c\r\n\r\na = 1 # x\r\n  b   =   2\r\n'), { a: 1, b: 2 });
    assert.deepStrictEqual(P(''), {});
    assert.deepStrictEqual(P('# only comment'), {});
    // __proto__ 安全
    const pr = parseToml('__proto__ = 1\n[a]\n__proto__ = 2');
    assert.strictEqual({}.polluted, undefined); assert.strictEqual(Object.getPrototypeOf(pr), null);
    assert.strictEqual(pr.a['__proto__'], 2);
    ok('toml: 表格/陣列表格/行內表格/點號鍵/註解/CRLF/BOM');

    // 錯誤輸入（要明確報錯，且帶行號）
    err('a = 1\na = 2', /第 2 行：鍵重複/);
    err('[a]\nx = 1\n[a]\ny = 2', /第 3 行：表格 \[a\] 重複/);
    err('a = 1\n[a]', /重複定義或與既有鍵衝突/);
    err('a = [1,2]\n[[a]]', /不能當陣列表格/);
    err('[[a]]\n[a]', /重複定義或與既有鍵衝突/);
    err('a.b = 1\n[a]', /重複定義或與既有鍵衝突/);
    err('[a.b]\n[a]\nb.c = 1');
    err('a = { x = 1 }\n[a.y]', /已被定義/);
    err('a = { x = 1 }\na.y = 2', /不能再用點號展開/);
    err('a = 1\na.b = 2', /不能再用點號展開/);
    err('a = [1]\n[a.b]', /一般陣列/);
    err('a =', /缺少值/);
    err('a = \nb = 1', /缺少值/);
    err('a = hello', /無法辨識的值/);
    err('a 1', /缺少 等號/);
    err('= 1', /缺少鍵名/);
    err('a = 1 b = 2', /多餘內容/);
    err('a = "abc', /沒有結束|不能換行/);
    err('a = "ab\ncd"', /不能換行/);
    err('a = """abc', /沒有結束/);
    err('a = "\\q"', /不合法的跳脫/);
    err('a = "\\u12"', /十六進位/);
    err('a = "\\uD800"', /Unicode/);
    err('a = "\\U00110000"', /Unicode/);
    err('a = "x\u0001y"', /控制字元/);
    err('a = """x\\ y"""', /不合法的跳脫/);
    err('a = 01', /無法辨識/);
    err('a = 1__0', /無法辨識/);
    err('a = _1', /無法辨識/);
    err('a = 1_', /無法辨識/);
    err('a = 1.', /無法辨識/);
    err('a = .5', /無法辨識/);
    err('a = 1e', /無法辨識/);
    err('a = +0x1F', /無法辨識/);
    err('a = 0xZ', /無法辨識/);
    err('a = inf', /inf \/ nan/);
    err('a = -nan', /inf \/ nan/);
    err('a = 9007199254740993', /±2\^53/);
    err('a = 0xFFFFFFFFFFFFFFFF', /±2\^53/);
    err('a = TRUE', /無法辨識/);
    err('a = 1979-02-30', /日期不存在/);
    err('a = 1979-13-01', /日期不存在/);
    err('a = 1979-05-27T25:00:00Z', /時間不合法/);
    err('a = 1979-05-27T07:32:00+25:00', /時區/);
    err('a = [1, 2', /陣列/);
    err('a = [1 2]', /陣列缺少逗號/);
    err('a = { x = 1,}', /結尾逗號/);
    err('a = { x = 1\n}', /行內表格缺少/);
    err('a = { x = 1 y = 2 }', /行內表格缺少/);
    err('[a', /缺少 \]/);
    err('[[a]', /缺少 \]\]/);
    err('[]', /缺少鍵名/);
    err('[a..b]', /缺少鍵名/);
    err('"""a""" = 1', /多行字串/);
    err('a = 1\n\n\nb = ???', /第 4 行/);
    err('a = "x" "y"', /多餘內容/);
    err('a = """abcdefg""""""', /引號太多/);
    ok('toml: 錯誤輸入明確報錯（' + 52 + ' 種）');

    // JSON → TOML 輸出
    assert.strictEqual(jsonToToml({}), '');
    assert.strictEqual(jsonToToml({ a: 1, b: 'x', c: true, d: 1.5, e: [1, 2], f: [] }), 'a = 1\nb = "x"\nc = true\nd = 1.5\ne = [1, 2]\nf = []\n');
    assert.strictEqual(jsonToToml({ a: { b: { c: 1 } }, x: 1 }), 'x = 1\n\n[a]\n\n[a.b]\nc = 1\n');
    assert.strictEqual(jsonToToml({ p: [{ n: 1 }, { n: 2 }] }), '[[p]]\nn = 1\n\n[[p]]\nn = 2\n');
    assert.strictEqual(jsonToToml({ m: [1, { a: 1 }] }), 'm = [1, { a = 1 }]\n');
    assert.strictEqual(jsonToToml({ 'a b': 1, 'ok-key_1': 2, '': 3, '中文': 4 }), '"a b" = 1\nok-key_1 = 2\n"" = 3\n"中文" = 4\n');
    assert.strictEqual(jsonToToml({ s: 'a"b\\c\nd\t\u007f' }), 's = "a\\"b\\\\c\\nd\\t\\u007f"\n');
    assert.strictEqual(jsonToToml({ big: 1e21, neg: -3, tiny: 1e-7 }), 'big = 1e+21\nneg = -3\ntiny = 1e-7\n');
    assert.strictEqual(jsonToToml({ t: { sub: [{ x: 1 }] }, a: 1 }), 'a = 1\n\n[t]\n\n[[t.sub]]\nx = 1\n');
    assert.throws(() => jsonToToml([1]), /最上層必須是物件/);
    assert.throws(() => jsonToToml(5), /最上層/);
    assert.throws(() => jsonToToml(null), /最上層/);
    assert.throws(() => jsonToToml({ a: null }), /null.*a/);
    assert.throws(() => jsonToToml({ a: { b: [1, null] } }), /a\.b\[1\]/);
    ok('toml: JSON → TOML 輸出與錯誤');

    // 往返：JSON → TOML → JSON 相等（含特殊鍵名、巢狀、陣列表格、混合陣列、空值容器）
    const rt = [
        {}, { a: 1 }, { a: { b: { c: [1, 2, 3] } }, z: 'x' },
        { list: [{ a: 1, b: { c: 2 } }, { a: 3, b: { c: 4 } }], name: '中文 "引號" \\ \n 換行 😀' },
        { 'a.b': 1, 'x y': { 'k k': [{ 'q-r': true }] }, '': { '': 1 } },
        { mixed: [1, 'a', [1, [2]], { k: 1 }, true, 1.5], empty: [], eo: {}, ee: [[]], eaot: [{}, {}] },
        { n: [0, -0.5, 1e-9, 12345678901, 2 ** 52, -(2 ** 52), 1.7976931348623157e308] },
        { s: '', t: ' ', u: '#', v: '[x]', w: "it's", x: '\u0000\u001f' },
        { deep: { a: { b: { c: { d: { e: { f: 1 } } } } } } },
    ];
    for (const v of rt) {
        const t = jsonToToml(v);
        // 鍵順序可能改變，用排序後比較
        const norm = (x) => Array.isArray(x) ? x.map(norm) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, norm(x[k])])) : x;
        assert.strictEqual(J(norm(plain(parseToml(t)))), J(norm(v)), t);
    }
    ok('toml: JSON → TOML → JSON 往返');

    // TOML → JSON → TOML 往返（語意相等）
    const tt = [spec, '[[a]]\nx = 1\n[a.b]\ny = 2\n[[a]]\nx = 3', 'a.b.c = 1\na.b.d = "x"\n[z]\nq = [1, 2]', 'x = """\nl1\nl2"""\ny = \'lit\\eral\''];
    for (const t of tt) { const v = plain(parseToml(t)); assert.deepStrictEqual(plain(parseToml(jsonToToml(v))), v); }
    ok('toml: TOML → JSON → TOML 往返');

    // 與 YAML 互轉
    assert.deepStrictEqual(plain(parseToml('a = 1\n[b]\nc = "x"')), plain(parseYaml('a: 1\nb:\n  c: x')));
    assert.strictEqual(jsonToYaml(plain(parseToml('a = 1\n[b]\nc = [1, 2]'))), 'a: 1\nb:\n  c:\n    - 1\n    - 2');
    assert.strictEqual(jsonToToml(plain(parseYaml('a: 1\nb:\n  - x: 1\n  - x: 2'))), 'a = 1\n\n[[b]]\nx = 1\n\n[[b]]\nx = 2\n');
    ok('toml: 與 YAML 互轉');

    // 效能：5000 張表格
    const big = Array.from({ length: 5000 }, (_, k) => `[[r]]\nid = ${k}\nname = "n${k}"\ntags = ["a", "b"]`).join('\n');
    const t0 = Date.now(); assert.strictEqual(parseToml(big).r.length, 5000); assert.ok(Date.now() - t0 < 2000);
    ok('toml: 大文件效能');
}

// ---------- Markdown 表格輔助 ----------
{
    const m = load('utils/markdown-preview.html', 'strW, mdTableFromRows, tblSplitRow, mdTableParse, tblFromText, mdTableToCsv, tblFindText, tblInsert, mdToHtml');
    const { strW, mdTableFromRows: from, tblSplitRow, mdTableParse, tblFromText, mdTableToCsv, tblFindText, tblInsert, mdToHtml } = m;

    // 寬度
    assert.strictEqual(strW('abc'), 3);
    assert.strictEqual(strW('中文'), 4);
    assert.strictEqual(strW('a中b'), 4);
    assert.strictEqual(strW('ＡＢ'), 4);
    assert.strictEqual(strW('😀'), 2);
    assert.strictEqual(strW('é'), 1);
    assert.strictEqual(strW('é'), 1);
    assert.strictEqual(strW(''), 0);
    assert.strictEqual(strW('한글'), 4);
    ok('md-table: 顯示寬度（全形 2）');

    // 輸出
    assert.strictEqual(from([['a', 'b'], ['1', '2']]), '| a   | b   |\n| --- | --- |\n| 1   | 2   |');
    assert.strictEqual(from([['姓名', '城市'], ['小明', '台北'], ['Amy', 'Tokyo']]), '| 姓名 | 城市  |\n| ---- | ----- |\n| 小明 | 台北  |\n| Amy  | Tokyo |');
    assert.strictEqual(from([['名稱', '數量'], ['蘋果', '5'], ['x', '12345']], { aligns: ['', 'right'] }), '| 名稱 |  數量 |\n| ---- | ----: |\n| 蘋果 |     5 |\n| x    | 12345 |');
    assert.strictEqual(from([['a', 'b'], ['1', '2']], { aligns: ['center', 'right'], pad: false }), '| a | b |\n| :--: | --: |\n| 1 | 2 |');
    assert.strictEqual(from([['abcdef', 'x'], ['1', '2']], { aligns: ['center', ''] }), '| abcdef | x   |\n| :----: | --- |\n|   1    | 2   |');
    // 無標題列：產生空標題
    assert.strictEqual(from([['1', '2']], { header: false }), '|     |     |\n| --- | --- |\n| 1   | 2   |');
    // 只有標題
    assert.strictEqual(from([['a']]), '| a   |\n| --- |');
    // 不齊補空、跳脫
    assert.strictEqual(from([['a', 'b'], ['x']], { pad: false }), '| a | b |\n| --- | --- |\n| x |  |');
    assert.strictEqual(from([['a|b', 'c\nd'], [' e ', '']], { pad: false }), '| a\\|b | c d |\n| --- | --- |\n| e |  |');
    // 每一行的 | 位置對齊（以顯示寬度）
    const al = from([['中文標題', 'English'], ['a', '混合mix'], ['😀', 'z']]).split('\n').map(l => [...l].reduce((a, c) => a + strW(c), 0));
    assert.ok(al.every(x => x === al[0]), al.join());
    assert.throws(() => from([]), /沒有資料/);
    assert.throws(() => from(Array.from({ length: 501 }, () => ['a'])), /太大/);
    assert.throws(() => from([Array(51).fill('a')]), /太大/);
    assert.ok(from(Array.from({ length: 500 }, () => Array(50).fill('x'))).split('\n').length === 501);
    ok('md-table: 輸出（對齊/欄寬/無標題/跳脫/上限）');

    // 輸出的表格能被本頁預覽正確渲染（欄數與對齊）
    const html = mdToHtml(from([['左', '中', '右'], ['a', 'b', 'c']], { aligns: ['', 'center', 'right'] }));
    assert.ok(/<th>左<\/th><th style="text-align:center">中<\/th><th style="text-align:right">右<\/th>/.test(html), html);
    assert.ok(/<td>a<\/td><td style="text-align:center">b<\/td><td style="text-align:right">c<\/td>/.test(html), html);
    ok('md-table: 與預覽渲染一致');

    // 解析
    assert.deepStrictEqual(tblSplitRow('| a | b |'), ['a', 'b']);
    assert.deepStrictEqual(tblSplitRow('a | b'), ['a', 'b']);
    assert.deepStrictEqual(tblSplitRow('|a|b|'), ['a', 'b']);
    assert.deepStrictEqual(tblSplitRow('| a\\|b | c |'), ['a|b', 'c']);
    assert.deepStrictEqual(tblSplitRow('| a | |'), ['a', '']);
    assert.deepStrictEqual(tblSplitRow('| | b |'), ['', 'b']);
    assert.deepStrictEqual(tblSplitRow('|'), []);
    const p = mdTableParse('| 名稱 | 數量 | 備註 |\n| :--- | ---: | :-: |\n| 蘋果 | 5 | a\\|b |\n| 梨 |\n| x | 1 | 2 | 3 |\n');
    assert.deepStrictEqual(p.aligns, ['', 'right', 'center']);
    assert.deepStrictEqual(p.rows, [['名稱', '數量', '備註'], ['蘋果', '5', 'a|b'], ['梨', '', ''], ['x', '1', '2']]);
    assert.deepStrictEqual(mdTableParse('a|b\n--|--\n1|2').rows, [['a', 'b'], ['1', '2']]);
    assert.throws(() => mdTableParse('只是文字'), /找不到/);
    assert.throws(() => mdTableParse('| a | b |'), /找不到/);
    assert.throws(() => mdTableParse('| a | b |\n| x | y |'), /找不到/);
    assert.throws(() => mdTableParse(''), /找不到/);
    // 往返：rows → md → rows（含中文、管線、對齊）
    const rt = { rows: [['姓名', '備註|說明', 'x'], ['小明', 'a|b|c', ''], ['Amy', '😀', '中']], aligns: ['', 'center', 'right'] };
    for (const pad of [true, false]) {
        const back = mdTableParse(from(rt.rows, { aligns: rt.aligns, pad }));
        assert.deepStrictEqual(back.rows, rt.rows); assert.deepStrictEqual(back.aligns, rt.aligns);
    }
    ok('md-table: 解析與往返');

    // CSV / TSV
    assert.deepStrictEqual(tblFromText('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
    assert.deepStrictEqual(tblFromText('a\tb\n1\t2\r\n'), [['a', 'b'], ['1', '2']]);
    assert.deepStrictEqual(tblFromText('a,b,c\n1\n"x,y","he said ""hi""",\n'), [['a', 'b', 'c'], ['1', '', ''], ['x,y', 'he said "hi"', '']]);
    assert.deepStrictEqual(tblFromText('a\tb,c\n1\t2'), [['a\tb', 'c'], ['1\t2', '']]);   // 第一列有逗號就當 CSV
    assert.deepStrictEqual(tblFromText('"a\nb",c'), [['a\nb', 'c']]);
    assert.throws(() => tblFromText(''), /沒有資料/);
    assert.throws(() => tblFromText('"abc'), /引號/);
    assert.throws(() => tblFromText(Array.from({ length: 501 }, () => 'a').join('\n')), /太大/);
    assert.throws(() => tblFromText(Array(51).fill('a').join(',')), /太大/);
    // CSV → 表格（含跳脫與換行）
    assert.strictEqual(from(tblFromText('a,b\n"x|y","l1\nl2"')), '| a    | b     |\n| ---- | ----- |\n| x\\|y | l1 l2 |');
    // 表格 → CSV
    assert.strictEqual(mdTableToCsv('| 姓名 | 城市 |\n| --- | --- |\n| 小明 | 台北, 中正 |\n| Amy | say "hi" |'), '姓名,城市\n小明,"台北, 中正"\nAmy,"say ""hi"""');
    assert.strictEqual(mdTableToCsv('| a | b |\n| --- | --- |\n| 1 | a\\|b |'), 'a,b\n1,a|b');
    assert.strictEqual(mdTableToCsv('| a |\n| --- |'), 'a');
    assert.throws(() => mdTableToCsv('nope'), /找不到/);
    // CSV → md → CSV 往返
    const csv = '名稱,說明\n蘋果,"紅色, 甜"\n梨,';
    assert.strictEqual(mdTableToCsv(from(tblFromText(csv))), csv);
    ok('md-table: CSV/TSV 與表格互轉');

    // 找編輯區的表格
    const doc = '# 標題\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n後面文字 | 有管線\n';
    const t0 = doc.indexOf('| a'), t1 = doc.indexOf('| 1');
    assert.strictEqual(tblFindText(doc, t1 + 3, t1 + 3), '| a | b |\n| --- | --- |\n| 1 | 2 |');   // 游標在表格內
    assert.strictEqual(tblFindText(doc, t0, t0), '| a | b |\n| --- | --- |\n| 1 | 2 |');
    assert.strictEqual(tblFindText(doc, t0 + 2, t1 + 2), '| a | b |\n| --- | --- |\n| 1 | 2 |');   // 選取（延伸到整行）
    assert.strictEqual(tblFindText(doc, t0 + 2, t0 + 3), '| a | b |\n| --- | --- |\n| 1 | 2 |');   // 只選到一小段 → 取整張表
    assert.strictEqual(tblFindText('x\n| a |\n| - |\n| 1 |\n| 2 |\ny', 4, 18), '| a |\n| - |\n| 1 |');   // 選取含標題 + 分隔列就照選取的行
    assert.strictEqual(tblFindText(doc, 0, 0), '');   // 標題行沒有 |
    assert.strictEqual(tblFindText(doc, doc.length - 1, doc.length - 1), '後面文字 | 有管線');
    assert.strictEqual(tblFindText('| a |\n| - |', 0, 0).length > 0, true);
    assert.strictEqual(tblFindText('', 0, 0), '');
    assert.deepStrictEqual(mdTableParse(tblFindText(doc, t1, t1)).rows, [['a', 'b'], ['1', '2']]);
    // 插入
    assert.deepStrictEqual(tblInsert('', 0, 0, 'T'), { value: 'T\n', caret: 2 });
    assert.deepStrictEqual(tblInsert('abc', 3, 3, 'T'), { value: 'abc\n\nT\n', caret: 7 });
    assert.deepStrictEqual(tblInsert('abc\n', 4, 4, 'T'), { value: 'abc\n\nT\n', caret: 7 });
    assert.deepStrictEqual(tblInsert('abc\n\n', 5, 5, 'T'), { value: 'abc\n\nT\n', caret: 7 });
    assert.strictEqual(tblInsert('ab|cd', 2, 3, 'T').value, 'ab\n\nT\n\ncd');   // 取代選取
    assert.strictEqual(tblInsert('a\n\nb', 1, 1, 'T').value, 'a\n\nT\n\nb');
    assert.strictEqual(tblInsert('a\nb', 1, 1, 'T').value, 'a\n\nT\n\nb');
    assert.strictEqual(tblInsert('a\n\n\nb', 1, 1, 'T').value, 'a\n\nT\n\n\nb');
    const ins = tblInsert('x', 1, 1, 'T'); assert.strictEqual(ins.value.slice(ins.caret), '');
    ok('md-table: 編輯區定位與插入');

    // 效能：500×50
    const bigRows = Array.from({ length: 500 }, (_, r) => Array.from({ length: 50 }, (_, c) => '中' + r + '|' + c));
    const t = Date.now(), md = from(bigRows); assert.strictEqual(mdTableParse(md).rows.length, 500); assert.ok(Date.now() - t < 2000);
    ok('md-table: 最大表格效能');
}
// ---------- text-tools 統計 ----------
{
    const { count, fmtRead, normRates, readTimes, wordFreq, RATE_DEF } = load('utils/text-tools.html', 'count, fmtRead, normRates, readTimes, wordFreq, RATE_DEF', '// 每個操作', 'const $ =');
    const F = (t, o) => wordFreq(t, o);
    const flat = (r) => r.list.map(x => x.w + ':' + x.n).join(',');

    // 既有 count（含中英混合、emoji、空字串）
    let c = count('');
    assert.deepStrictEqual([c.chars, c.charsNoSpace, c.cjk, c.words, c.lines, c.paragraphs, c.sentences], [0, 0, 0, 0, 0, 0, 0]);
    c = count('你好 world, 123 test.\n\n第二段！OK?');
    assert.strictEqual(c.cjk, 5); assert.strictEqual(c.words, 4); assert.strictEqual(c.lines, 3); assert.strictEqual(c.paragraphs, 2);
    assert.strictEqual(c.sentences, 3);
    c = count('😀 hi 😀');
    assert.strictEqual(c.chars, 6); assert.strictEqual(c.charsNoSpace, 4); assert.strictEqual(c.words, 1); assert.strictEqual(c.cjk, 0);
    c = count('a b\r\nc');
    assert.strictEqual(c.lines, 2);
    c = count('1,234.5 and 3.14');
    assert.strictEqual(c.words, 3);
    assert.strictEqual(count('   \n  ').words, 0);
    ok('text-stats: count 中英混合/emoji/空字串');

    // 速度驗證與時間
    assert.deepStrictEqual(normRates(), RATE_DEF);
    assert.deepStrictEqual(normRates({ zhRead: '', enRead: 'abc', zhSpeak: -5, enSpeak: 0 }), RATE_DEF);
    assert.deepStrictEqual(normRates({ zhRead: null, enRead: NaN, zhSpeak: Infinity }), RATE_DEF);
    assert.strictEqual(normRates({ zhRead: 1 }).zhRead, 10);
    assert.strictEqual(normRates({ zhRead: 999999 }).zhRead, 5000);
    assert.strictEqual(normRates({ zhRead: '500' }).zhRead, 500);
    assert.deepStrictEqual(RATE_DEF, { zhRead: 400, enRead: 200, zhSpeak: 250, enSpeak: 150 });
    let t = readTimes(400, 200);
    assert.strictEqual(t.read, 2); assert.strictEqual(t.speak, 1.6 + 200 / 150);
    t = readTimes(800, 0, { zhRead: 200, zhSpeak: 400 });
    assert.strictEqual(t.read, 4); assert.strictEqual(t.speak, 2);
    assert.deepStrictEqual(readTimes(0, 0), { read: 0, speak: 0 });
    assert.strictEqual(fmtRead(0), '—'); assert.strictEqual(fmtRead(0.5), '30 秒'); assert.strictEqual(fmtRead(2), '2 分'); assert.strictEqual(fmtRead(2.5), '2 分 30 秒');
    ok('text-stats: 速度驗證與閱讀/朗讀時間');

    // 英文詞頻
    assert.strictEqual(flat(F('the cat and the dog and THE bird', { top: 3 })), 'the:3,and:2,cat:1');
    assert.strictEqual(flat(F('the cat and the dog and THE bird', { top: 3, stop: true })), 'cat:1,dog:1,bird:1');
    assert.strictEqual(flat(F('To be, or not to be, that is the question.', { stop: true })), 'question:1');
    assert.strictEqual(flat(F("don't stop, Don’t-stop, state-of-the-art 2024 3.14", { top: 10 })), "don't:1,stop:1,don’t-stop:1,state-of-the-art:1");
    assert.strictEqual(flat(F('b a b a c', { top: 10 })), 'b:2,a:2,c:1');   // 同次數依首次出現
    assert.strictEqual(F('', {}).total, 0); assert.deepStrictEqual(F('', {}).list, []);
    assert.deepStrictEqual(F('中文 123 !!!', { mode: 'en' }), { list: [], distinct: 0, total: 0 });
    let r = F('x y x z', {}); assert.strictEqual(r.distinct, 3); assert.strictEqual(r.total, 4);
    ok('text-stats: 英文詞頻/停用字/平手順序');

    // 中文單字 / 二字詞
    assert.strictEqual(flat(F('春天來了，春天真美', { mode: 'zh1', top: 2 })), '春:2,天:2');
    assert.strictEqual(flat(F('春天來了，春天真美', { mode: 'zh1', top: 20, stop: true })), '春:2,天:2,來:1,真:1,美:1');
    assert.strictEqual(flat(F('春天來了，春天真美', { mode: 'zh2', top: 3 })), '春天:2,天來:1,來了:1');
    assert.strictEqual(flat(F('春天來了，春天真美', { mode: 'zh2', top: 5, stop: true })), '春天:2,天來:1,天真:1,真美:1');
    assert.strictEqual(flat(F('我愛你。你愛我', { mode: 'zh2', top: 9 })), '我愛:1,愛你:1,你愛:1,愛我:1');   // 標點會斷開相鄰
    assert.strictEqual(flat(F('我愛你。你愛我', { mode: 'zh2', top: 9, stop: true })), '');
    assert.deepStrictEqual(F('a', { mode: 'zh2' }), { list: [], distinct: 0, total: 0 });
    assert.deepStrictEqual(F('字', { mode: 'zh2' }), { list: [], distinct: 0, total: 0 });
    assert.strictEqual(flat(F('中a文', { mode: 'zh2' })), '');   // 英文字母隔開，不跨過
    assert.strictEqual(flat(F('😀😀春春', { mode: 'zh1' })), '春:2');
    assert.strictEqual(flat(F('😀😀春春', { mode: 'zh2' })), '春春:1');
    assert.throws(() => F('x', { mode: 'xx' }), /未知/);
    ok('text-stats: 中文單字/二字詞');

    // top 邊界
    const many = Array.from({ length: 300 }, (_, i) => 'w' + [...String(i)].map(d => 'abcdefghij'[d]).join('')).join(' ');
    assert.strictEqual(F(many, { top: 1000 }).list.length, 100);
    assert.strictEqual(F(many, { top: 0 }).list.length, 10);
    assert.strictEqual(F(many, { top: -3 }).list.length, 10);
    assert.strictEqual(F(many, { top: 'x' }).list.length, 10);
    assert.strictEqual(F(many, { top: 2.9 }).list.length, 2);
    assert.strictEqual(F(many, { top: 5 }).distinct, 300);
    ok('text-stats: top 邊界');

    // 極長文字效能
    const big = ('The quick brown fox 跳過 懶惰的狗。 ').repeat(60000);   // 約 100 萬字
    let t0 = Date.now();
    const cb = count(big); assert.strictEqual(cb.cjk, 60000 * 6);
    for (const mode of ['en', 'zh1', 'zh2']) { const rr = F(big, { mode, top: 10, stop: true }); assert.ok(rr.list.length > 0, mode); }
    assert.ok(Date.now() - t0 < 4000, 'big text ' + (Date.now() - t0) + 'ms');
    const uniq = Array.from({ length: 200000 }, (_, i) => '字詞'.repeat(1) + String.fromCharCode(0x4e00 + (i % 20000)) + String.fromCharCode(0x4e00 + ((i * 7) % 20000))).join('');
    t0 = Date.now(); assert.ok(F(uniq, { mode: 'zh2', top: 100 }).distinct > 1000); assert.ok(Date.now() - t0 < 4000, 'distinct-heavy ' + (Date.now() - t0) + 'ms');
    ok('text-stats: 極長文字效能');
}
