// 批次 g7：text-tools（Unicode 資訊 / 換行 / 千分位 / SQL IN / 陣列 / 路徑 / emoji）、encode-decode（Base32 / Base58 / Base58Check / URL 批次 / 實體 / 雜湊辨識）、encoding-fixer（位元組並排）
const { load, ok } = require('./_load');
const assert = require('assert');
const eq = assert.deepStrictEqual;

{ // ---------- text-tools ----------
    const m = load('utils/text-tools.html', 'uniBlock, uniName, uniInfo, parseUniQuery, uniRange, eolInfo, eolConvert, roundDigits, numParts, numFormat, numLocales, sqlIn, arrayLiteral, parsePath, convertPath, UNI_BLOCKS');
    const row = (i, k) => i.rows.find(r => r[0] === k)[1];

    // Unicode 資訊
    eq(m.uniBlock(0x41), 'Basic Latin'); eq(m.uniBlock(0x4E2D), 'CJK Unified Ideographs'); eq(m.uniBlock(0x1F600), 'Emoticons'); eq(m.uniBlock(0x378), 'Greek and Coptic'); eq(m.uniBlock(0x1FFFF), null);
    for (let i = 1; i < m.UNI_BLOCKS.length; i++) assert.ok(m.UNI_BLOCKS[i][0] > m.UNI_BLOCKS[i - 1][1], '區塊要由小到大且不重疊：' + m.UNI_BLOCKS[i][2]);
    eq(m.uniName(0x41), 'LATIN CAPITAL LETTER A'); eq(m.uniName(0x7A), 'LATIN SMALL LETTER Z'); eq(m.uniName(0x35), 'DIGIT FIVE'); eq(m.uniName(0x20), 'SPACE');
    eq(m.uniName(0xE9), 'LATIN SMALL LETTER E WITH ACUTE'); eq(m.uniName(0xC4), 'LATIN CAPITAL LETTER A WITH DIAERESIS'); eq(m.uniName(0xDF), 'LATIN SMALL LETTER SHARP S'); eq(m.uniName(0xFF), 'LATIN SMALL LETTER Y WITH DIAERESIS');
    eq(m.uniName(0xD7), 'MULTIPLICATION SIGN'); eq(m.uniName(0xF7), 'DIVISION SIGN'); eq(m.uniName(0xFD), 'LATIN SMALL LETTER Y WITH ACUTE'); eq(m.uniName(0xDE), 'LATIN CAPITAL LETTER THORN');
    eq(m.uniName(0x3A9), 'GREEK CAPITAL LETTER OMEGA'); eq(m.uniName(0x3C0), 'GREEK SMALL LETTER PI'); eq(m.uniName(0x3BB), 'GREEK SMALL LETTER LAMDA'); eq(m.uniName(0x3C2), 'GREEK SMALL LETTER FINAL SIGMA'); eq(m.uniName(0x3A2), null);
    eq(m.uniName(0x4E2D), 'CJK UNIFIED IDEOGRAPH-4E2D'); eq(m.uniName(0x20000), 'CJK UNIFIED IDEOGRAPH-20000'); eq(m.uniName(0x1F600), 'GRINNING FACE'); eq(m.uniName(0x20AC), 'EURO SIGN'); eq(m.uniName(0x0A), 'LINE FEED');
    eq(m.uniName(0x10FFF0), null); assert.ok(m.uniName(0xE000).includes('私用')); assert.ok(m.uniName(0xD800).includes('代理'));
    let i = m.uniInfo(0x4E2D);
    eq(row(i, '碼位'), 'U+4E2D'); eq(row(i, 'UTF-8'), 'E4 B8 AD'); eq(row(i, 'UTF-16 BE'), '4E2D'); eq(row(i, 'UTF-16 LE（位元組）'), '2D 4E'); eq(row(i, 'UTF-32'), '00004E2D');
    eq(row(i, 'HTML 實體'), '&#20013; 　 &#x4E2D;'); eq(row(i, 'JavaScript'), '\\u4E2D'); eq(row(i, 'Python / Go / C'), '\\u4E2D'); eq(row(i, 'URL 百分比編碼'), '%E4%B8%AD'); eq(row(i, '分類'), 'Lo（其他字母（含漢字））'); eq(row(i, '區塊'), 'CJK Unified Ideographs');
    i = m.uniInfo(0x1F600);
    eq(row(i, 'UTF-8'), 'F0 9F 98 80'); eq(row(i, 'UTF-16 BE'), 'D83D DE00'); eq(row(i, 'UTF-16 LE（位元組）'), '3D D8 00 DE'); eq(row(i, 'JavaScript'), '\\u{1F600}'); eq(row(i, 'JSON / Java / C#'), '\\uD83D\\uDE00');
    eq(row(i, 'Python / Go / C'), '\\U0001F600'); eq(row(i, 'Rust / Swift'), '\\u{1F600}'); eq(row(i, 'CSS'), '\\1F600 '); eq(row(i, 'URL 百分比編碼'), '%F0%9F%98%80'); eq(row(i, 'UTF-32'), '0001F600'); eq(i.name, 'GRINNING FACE');
    eq(row(m.uniInfo(0xA9), 'HTML 實體'), '&#169; 　 &#xA9; 　 &copy;'); eq(row(m.uniInfo(0x41), 'UTF-8'), '41');
    i = m.uniInfo(0x378); eq(i.name, null); assert.ok(row(i, '名稱').includes('未收錄')); eq(i.cat, 'Cn');
    i = m.uniInfo(0xD800); eq(i.ch, ''); eq(row(i, 'UTF-8'), '—'); eq(i.cat, 'Cs');
    eq(m.uniInfo(0x0A).cat, 'Cc'); eq(m.uniInfo(0x20).cat, 'Zs'); eq(m.uniInfo(0x24).cat, 'Sc'); eq(m.uniInfo(0x10FFFF).block, 'Supplementary Private Use Area-B');
    for (const bad of [-1, 0x110000, 1.5, NaN]) assert.throws(() => m.uniInfo(bad));
    // 解析輸入
    eq(m.parseUniQuery('中').cps, [0x4E2D]); eq(m.parseUniQuery('中文').cps, [0x4E2D, 0x6587]); eq(m.parseUniQuery('😀').cps, [0x1F600]); eq(m.parseUniQuery('U+4E2D').mode, 'code');
    eq(m.parseUniQuery('U+4E2D U+1F600').cps, [0x4E2D, 0x1F600]); eq(m.parseUniQuery('u+41, 0x42; \\u0043 \\u{1F600} &#x44; &#69;').cps, [0x41, 0x42, 0x43, 0x1F600, 0x44, 69]);
    eq(m.parseUniQuery('A').mode, 'char'); eq(m.parseUniQuery('A').cps, [65]);        // 沒有前綴的 A 是字母，不是碼位
    eq(m.parseUniQuery('U+41 x').mode, 'char'); eq(m.parseUniQuery(' ').cps, [32]); eq(m.parseUniQuery('').cps, []);
    assert.throws(() => m.parseUniQuery('U+110000'), /超出範圍/);
    const many = m.parseUniQuery('a'.repeat(80)); eq(many.cps.length, 50); eq(many.truncated, true);
    // 反查
    let r = m.uniRange('U+0041-U+005A'); eq(r.chars.length, 26); eq(r.chars[0].ch, 'A'); eq(r.block, 'Basic Latin');
    eq(m.uniRange('41-43').chars.map(x => x.ch).join(''), 'ABC'); eq(m.uniRange('U+43-U+41').chars.map(x => x.ch).join(''), 'ABC'); eq(m.uniRange('U+41').chars.length, 1);
    r = m.uniRange('arrows'); eq(r.block, 'Arrows'); eq(r.from, 0x2190); eq(r.chars[0].ch, '←'); r = m.uniRange('Hiragana'); eq(r.block, 'Hiragana'); assert.ok(r.chars.some(x => x.ch === 'あ'));
    r = m.uniRange('U+0000-U+0040'); assert.ok(r.chars.every(x => x.cp >= 0x20), '略過控制字元');
    r = m.uniRange('cjk unified ideographs'); eq(r.truncated, true); eq(r.chars.length, 256);
    assert.throws(() => m.uniRange('U+4E00-U+9FFF'), /範圍太大/); assert.throws(() => m.uniRange('zzzqq'), /找不到/); assert.throws(() => m.uniRange('U+0-U+FFFFFF'), /超出範圍/);
    eq(m.uniRange('').chars.length, 0); r = m.uniRange('U+D800-U+D810'); eq(r.chars.length, 0);
    ok('g7 text-tools: unicode info');

    // 換行
    eq(m.eolInfo('a\r\nb\r\nc'), { crlf: 2, lf: 0, cr: 0, other: 0, mixed: false, dominant: 'crlf', odd: [], endsWithEol: false, lines: 3 });
    let e = m.eolInfo('a\nb\r\nc\rd\n'); eq([e.crlf, e.lf, e.cr, e.mixed, e.dominant, e.endsWithEol, e.lines], [1, 2, 1, true, 'lf', true, 4]); eq(e.odd, [2, 3]);
    e = m.eolInfo(''); eq([e.lines, e.mixed, e.dominant], [0, false, null]); e = m.eolInfo('abc'); eq([e.lines, e.dominant, e.endsWithEol], [1, null, false]);
    e = m.eolInfo('a\n'); eq([e.lines, e.endsWithEol], [1, true]); e = m.eolInfo('a\u2028b\nc'); eq([e.other, e.lf, e.mixed], [1, 1, false]);
    e = m.eolInfo('x\n'.repeat(5) + 'y\r\n'.repeat(15)); eq(e.dominant, 'crlf'); eq(e.odd, [1, 2, 3, 4, 5]); e = m.eolInfo('x\r\n'.repeat(3) + 'y\n'.repeat(30)); eq(e.odd.length, 3);
    eq(m.eolConvert('a\r\nb\nc\rd', 'LF'), 'a\nb\nc\nd'); eq(m.eolConvert('a\r\nb\nc\rd', 'CRLF'), 'a\r\nb\r\nc\r\nd'); eq(m.eolConvert('a\r\nb\nc', 'CR'), 'a\rb\rc'); eq(m.eolConvert('', 'LF'), '');
    eq(m.eolInfo(m.eolConvert('a\nb\r\nc\r', 'CRLF')).mixed, false); eq(m.eolConvert('a\u2028b', 'LF'), 'a\u2028b'); assert.throws(() => m.eolConvert('a', 'XX'));
    ok('g7 text-tools: eol');

    // 千分位
    eq(m.roundDigits('1234', '5678', 2), ['1234', '57']); eq(m.roundDigits('9', '995', 2), ['10', '00']); eq(m.roundDigits('0', '5', 0), ['1', '']); eq(m.roundDigits('0', '4', 0), ['0', '']); eq(m.roundDigits('12', '3', 3), ['12', '300']); eq(m.roundDigits('99', '99', 1), ['100', '0']);
    eq(m.numParts('1,234,567.89'), { sign: '', int: '1234567', frac: '89' }); eq(m.numParts('-1 234'), { sign: '-', int: '1234', frac: '' }); eq(m.numParts('1.234.567,89', true), { sign: '', int: '1234567', frac: '89' }); eq(m.numParts("1'234"), { sign: '', int: '1234', frac: '' });
    for (const bad of ['abc', '1.2.3', '', '12a', '.5', '--1']) eq(m.numParts(bad), null);
    const nf = (t, o) => m.numFormat(t, o).text;
    eq(nf('1234567.891'), '1,234,567.891'); eq(nf('999'), '999'); eq(nf('1000'), '1,000'); eq(nf('-1234'), '-1,234'); eq(nf('0'), '0'); eq(nf('1234567', { sep: ' ' }), '1 234 567'); eq(nf('1234567.5', { sep: '.', dec: ',' }), '1.234.567,5');
    eq(nf('1,234,567.891', { mode: 'strip' }), '1234567.891'); eq(nf('1.234.567,89', { mode: 'strip', euro: true }), '1234567.89'); eq(nf('1 234', { mode: 'strip' }), '1234');
    eq(nf('1234.5678', { decimals: 2 }), '1,234.57'); eq(nf('1234.5', { decimals: 3 }), '1,234.500'); eq(nf('1234.5', { decimals: 0 }), '1,235'); eq(nf('999.999', { decimals: 2 }), '1,000.00'); eq(nf('-0.001', { decimals: 2 }), '0.00'); eq(nf('-1.005', { decimals: 2 }), '-1.01');
    eq(nf('12345678901234567890.12'), '12,345,678,901,234,567,890.12');           // 不經浮點數，不失精度
    eq(nf('1234\nabc\n\n5678'), '1,234\nabc\n\n5,678'); eq(m.numFormat('1\nx\ny').bad, 2); eq(nf('007'), '007'); eq(nf('+1234'), '+1,234'); eq(nf('1234\r\n5678'), '1,234\n5,678');
    eq(m.numFormat('1\n'.repeat(5001)).truncated, true); eq(m.numFormat('1\n'.repeat(5001)).text.split('\n').length, 5000);
    const loc = Object.fromEntries(m.numLocales('1234567.891')); eq(loc['美國 en-US'], '1,234,567.891'); eq(loc['德國 de-DE'], '1.234.567,891'); eq(loc['印度 en-IN'], '12,34,567.891'); assert.ok(/1\D234\D567,891/.test(loc['法國 fr-FR'])); eq(m.numLocales('abc'), []);
    ok('g7 text-tools: number format');

    // SQL IN
    eq(m.sqlIn('1\n2\n3').sql, 'IN (1, 2, 3)'); eq(m.sqlIn('a\nb', { col: 'name' }).sql, "name IN ('a', 'b')"); eq(m.sqlIn("O'Brien").sql, "IN ('O''Brien')"); eq(m.sqlIn('007\n1.5\n-3\n1e5').sql, "IN ('007', 1.5, -3, '1e5')");
    eq(m.sqlIn('1\n2', { quote: 'always' }).sql, "IN ('1', '2')"); eq(m.sqlIn('a\nb', { quote: 'never' }).sql, 'IN (a, b)');
    e = m.sqlIn('a\nb\na\n\n  \nb\nc'); eq([e.sql, e.count, e.dup], ["IN ('a', 'b', 'c')", 3, 2]); eq(m.sqlIn('a\na', { dedupe: false }).sql, "IN ('a', 'a')");
    eq(m.sqlIn('1\n2', { col: 'id', not: true }).sql, 'id NOT IN (1, 2)'); eq(m.sqlIn('1\n2', { col: 'id', brk: true }).sql, 'id IN (\n  1,\n  2\n)');
    eq(m.sqlIn('1\n2\n3\n4\n5', { col: 'id', chunk: 2 }).sql, '(id IN (1, 2)\n OR id IN (3, 4)\n OR id IN (5))'); eq(m.sqlIn('1\n2\n3', { col: 'id', chunk: 2, not: true }).sql, '(id NOT IN (1, 2)\n AND id NOT IN (3))'); eq(m.sqlIn('1\n2\n3', { col: 'id', chunk: 5 }).groups, 1);
    eq(m.sqlIn('1\r\n2\r\n').sql, 'IN (1, 2)'); assert.throws(() => m.sqlIn(''), /沒有可用的值/); assert.throws(() => m.sqlIn('\n \n'));
    eq(m.sqlIn('x\ny', { col: '  t.c  ' }).sql, "t.c IN ('x', 'y')"); eq(m.sqlIn('x', { chunk: -3 }).groups, 1); eq(m.sqlIn('a\nb', { chunk: 1 }).groups, 2);
    assert.throws(() => m.sqlIn(Array.from({ length: 100001 }, (_, k) => k).join('\n')), /最多/);
    ok('g7 text-tools: sql in');

    // 陣列字面值
    const al = m.arrayLiteral;
    eq(al('a\nb\n42', 'js'), '["a", "b", 42]'); eq(al('a\nb\n42', 'js', { num: false }), '["a", "b", "42"]'); eq(al('a"b\\c', 'js'), '["a\\"b\\\\c"]'); eq(al('1\n2.5', 'py'), '[1, 2.5]'); eq(al('x\n\ny', 'py'), '["x", "y"]');
    eq(al('1\n2\n3', 'go'), '[]int{1, 2, 3}'); eq(al('1\n2.5', 'go'), '[]float64{1, 2.5}'); eq(al('1\nx', 'go'), '[]string{"1", "x"}'); eq(al('1\n2', 'go', { num: false }), '[]string{"1", "2"}');
    eq(al('1\n2', 'java'), 'new int[]{1, 2}'); eq(al('1.5', 'java'), 'new double[]{1.5}'); eq(al('a\nb', 'java'), 'new String[]{"a", "b"}');
    eq(al("a\nO'B\n3", 'sql'), "VALUES ('a'), ('O''B'), (3)"); eq(al('a\nb', 'sql', { brk: true }), "VALUES\n  ('a'),\n  ('b')");
    eq(al('a\nb', 'js', { brk: true }), '[\n  "a",\n  "b"\n]'); eq(al('a\nb', 'go', { brk: true }), '[]string{\n  "a",\n  "b",\n}'); eq(al('a\nb\na', 'js', { dedupe: true }), '["a", "b"]');
    eq(al('12345678901234567890', 'js'), '["12345678901234567890"]'); eq(al('007', 'js'), '["007"]'); eq(al('-5', 'js'), '[-5]');
    assert.throws(() => al('', 'js')); assert.throws(() => al('a', 'ruby'));
    ok('g7 text-tools: array literal');

    // 路徑
    const cp = m.convertPath;
    eq(cp('C:\\Users\\me\\a.txt', 'wsl'), '/mnt/c/Users/me/a.txt'); eq(cp('C:\\Users\\me\\a.txt', 'gitbash'), '/c/Users/me/a.txt'); eq(cp('C:\\Users\\me\\a.txt', 'winfwd'), 'C:/Users/me/a.txt'); eq(cp('C:\\Users\\me', 'posix'), '/c/Users/me');
    eq(cp('c:/users/me', 'win'), 'C:\\users\\me'); eq(cp('/mnt/d/project/src', 'win'), 'D:\\project\\src'); eq(cp('/d/project', 'win'), 'D:\\project'); eq(cp('/mnt/c', 'win'), 'C:\\'); eq(cp('C:\\', 'wsl'), '/mnt/c'); eq(cp('C:', 'win'), 'C:\\');
    eq(cp('C:\\Users\\me\\', 'wsl'), '/mnt/c/Users/me/'); eq(cp('/mnt/c/Users/me/', 'win'), 'C:\\Users\\me\\'); eq(cp('"C:\\Program Files\\App"', 'wsl'), '/mnt/c/Program Files/App'); eq(cp("'C:\\a b'", 'gitbash'), '/c/a b');
    eq(cp('/home/me/x', 'win'), '\\\\wsl$\\Ubuntu\\home\\me\\x'); eq(cp('/home/me/x', 'win', 'Debian'), '\\\\wsl$\\Debian\\home\\me\\x'); eq(cp('/home/me', 'winfwd'), '//wsl$/Ubuntu/home/me'); eq(cp('/home/me', 'wsl'), '/home/me');
    eq(cp('\\\\wsl$\\Ubuntu\\home\\me', 'wsl'), '/home/me'); eq(cp('\\\\wsl.localhost\\Ubuntu\\home\\me', 'posix'), '/home/me'); eq(cp('\\\\wsl$\\Ubuntu\\home\\me', 'win'), '\\\\wsl$\\Ubuntu\\home\\me');
    eq(cp('\\\\server\\share\\dir\\f.txt', 'wsl'), '//server/share/dir/f.txt'); eq(cp('//server/share/dir', 'win'), '\\\\server\\share\\dir'); eq(cp('\\\\server\\share', 'win'), '\\\\server\\share');
    eq(cp('src\\app\\main.js', 'posix'), 'src/app/main.js'); eq(cp('src/app', 'win'), 'src\\app'); eq(cp('C:\\a\\\\b//c', 'wsl'), '/mnt/c/a/b/c'); eq(cp('', 'win'), ''); eq(cp('  ', 'wsl'), '');
    eq(cp('/', 'wsl'), '/'); eq(cp('/home', 'posix'), '/home'); eq(m.parsePath('D:\\x').drive, 'd');
    assert.throws(() => cp('C:\\a', 'dos'));
    ok('g7 text-tools: paths');
}

{ // ---------- text-tools：emoji 擴充 ----------
    const m = load('utils/text-tools.html', 'SYMBOLS, SYM_DATA, SYM_CATS, searchSymbols, normRecent', '// 每個操作', 'const $ =');
    const emojiCats = ['臉部', '手與人', '動物自然', '食物飲料', '活動物品', '交通地點', '標誌符號'];
    for (const g of emojiCats) assert.ok(m.SYM_CATS.includes(g), '缺分類 ' + g);
    const total = emojiCats.reduce((n, g) => n + m.SYM_DATA[g].length, 0);
    assert.ok(total >= 300 && total <= 800, '新增 emoji 數量 ' + total);
    for (const g of emojiCats) for (const [c, n] of m.SYM_DATA[g]) { assert.equal([...c].length, 1, g + ' 單一碼位：' + c); assert.ok(n.endsWith(' emoji') && n.length > 6, '缺關鍵字 ' + c); }
    const seen = new Set(); for (const x of m.SYMBOLS) { assert.ok(!seen.has(x.c), '重複 ' + x.c); seen.add(x.c); }
    const has = (q, c) => m.searchSymbols(q).some(x => x.c === c);
    assert.ok(has('貓', '🐈') && has('cat', '🐈') && has('生日', '🎂') && has('birthday cake', '🎂') && has('火箭', '🚀') && has('emoji', '🚀') && has('咖啡', '☕') && has('打勾', '✅') && has('pizza', '🍕') && has('獎盃', '🏆'));
    assert.deepEqual(m.normRecent(['🐈', '🚀', 'zz']), ['🐈', '🚀']);
    ok('g7 text-tools: emoji data');
}

{ // ---------- encode-decode ----------
    const m = load('utils/encode-decode.html', 'CODECS, base32Encode, base32Decode, base58Encode, base58Decode, parseHex, toHex, base58CheckEncode, base58CheckDecode, urlBatch, ENT_LIST, entityFind, entToNumeric, entToNamed, identifyHash');
    const T = (s) => new TextEncoder().encode(s), S = (u8) => new TextDecoder().decode(u8);
    // Base32：RFC 4648 測試向量
    for (const [a, b] of [['', ''], ['f', 'MY======'], ['fo', 'MZXQ===='], ['foo', 'MZXW6==='], ['foob', 'MZXW6YQ='], ['fooba', 'MZXW6YTB'], ['foobar', 'MZXW6YTBOI======']]) { eq(m.base32Encode(T(a)), b); eq(S(m.base32Decode(b)), a); }
    eq(S(m.base32Decode('mzxw6ytboi')), 'foobar'); eq(S(m.base32Decode('MZXW 6YTB\nOI======')), 'foobar'); assert.throws(() => m.base32Decode('MZXW1'), /Base32/); assert.throws(() => m.base32Decode('MZ*'));
    eq(m.CODECS['Base32'].dec(m.CODECS['Base32'].enc('你好 🎉')), '你好 🎉'); eq(m.CODECS['Base32'].enc('foobar'), 'MZXW6YTBOI======');
    // Base58：Bitcoin 常用測試向量
    eq(m.base58Encode(T('Hello World!')), '2NEpo7TZRRrLZSi2U'); eq(m.base58Encode(T('The quick brown fox jumps over the lazy dog.')), 'USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z');
    eq(m.base58Encode(m.parseHex('0000287fb4cd')), '11233QC4'); eq(m.base58Encode(m.parseHex('00000000')), '1111'); eq(m.base58Encode(new Uint8Array(0)), ''); eq(m.base58Encode(m.parseHex('61')), '2g'); eq(m.base58Encode(m.parseHex('626262')), 'a3gV'); eq(m.base58Encode(m.parseHex('636363')), 'aPEr');
    eq(m.base58Encode(m.parseHex('516b6fcd0f')), 'ABnLTmg'); eq(m.base58Encode(m.parseHex('bf4f89001e670274dd')), '3SEo3LWLoPntC'); eq(m.base58Encode(m.parseHex('572e4794')), '3EFU7m'); eq(m.base58Encode(m.parseHex('ecac89cad93923c02321')), 'EJDM8drfXA6uyA'); eq(m.base58Encode(m.parseHex('10c8511e')), 'Rt5zm');
    eq(S(m.base58Decode('2NEpo7TZRRrLZSi2U')), 'Hello World!'); eq(m.toHex(m.base58Decode('11233QC4')), '0000287fb4cd'); eq(m.toHex(m.base58Decode('1111')), '00000000'); eq(m.base58Decode('').length, 0);
    for (const bad of ['0', 'O', 'I', 'l', 'ab+c']) assert.throws(() => m.base58Decode(bad), /Base58/);
    assert.throws(() => m.base58Encode(new Uint8Array(4097)), /4096/); eq(m.CODECS['Base58（比特幣字母表）'].dec(m.CODECS['Base58（比特幣字母表）'].enc('你好')), '你好');
    // Base58Check：比特幣位址（wiki 的範例）與 WIF
    (async () => {
        const addr = '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM';
        eq(await m.base58CheckEncode(m.parseHex('00010966776006953D5567439E5E39F86A0D273BEE')), addr);
        eq(m.toHex(await m.base58CheckDecode(addr)), '00010966776006953d5567439e5e39f86a0d273bee');
        eq(await m.base58CheckEncode(m.parseHex('0x00 01 09')), await m.base58CheckEncode(m.parseHex('000109')));
        eq(await m.base58CheckEncode(m.parseHex('800C28FCA386C7A227600B2FE50B7CAE11EC86D3BF1FBE471BE89827E19D72AA1D')), '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ');       // 比特幣 wiki 的 WIF 範例
        eq(m.toHex(await m.base58CheckDecode('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ')), '800c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d');
        await assert.rejects(m.base58CheckDecode('16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvN'), /檢查碼/); await assert.rejects(m.base58CheckDecode('abc'), /太短|檢查碼/); await assert.rejects(m.base58CheckDecode('0OIl'), /Base58/);
        assert.throws(() => m.parseHex('abc')); assert.throws(() => m.parseHex('zz'));
        ok('g7 encode-decode: base58check');
    })().catch(e => { console.error(e); process.exit(1); });
    ok('g7 encode-decode: base32 / base58');

    // URL 批次
    const ub = m.urlBatch;
    eq(ub('a b\n中文&x=1', false, 'enc'), 'a%20b\n%E4%B8%AD%E6%96%87%26x%3D1'); eq(ub('https://x.com/a b?q=中#h', true, 'enc'), 'https://x.com/a%20b?q=%E4%B8%AD#h'); eq(ub('https://x.com/a b?q=1&r=2', false, 'enc'), 'https%3A%2F%2Fx.com%2Fa%20b%3Fq%3D1%26r%3D2');
    eq(ub('a%20b\n%E4%B8%AD%E6%96%87\nc+d', false, 'dec'), 'a b\n中文\nc d'); eq(ub('a%2Fb%3Fc', true, 'dec'), 'a%2Fb%3Fc'); eq(ub('a%2Fb%3Fc', false, 'dec'), 'a/b?c'); eq(ub('c+d', true, 'dec'), 'c+d'); eq(ub('', false, 'enc'), ''); eq(ub('a\n\nb', false, 'enc'), 'a\n\nb');
    assert.throws(() => ub('ok\n%E4%B8\n', false, 'dec'), /第 2 行/); assert.throws(() => ub('\uD800', false, 'enc'), /第 1 行/);
    for (const k of ['URL 編碼批次・每行（component）', 'URL 編碼批次・每行（整串 encodeURI）']) { const c = m.CODECS[k]; for (const s of ['a b\n中文', 'x=1&y=2', '']) eq(c.dec(c.enc(s)), s); }
    // 實體
    assert.ok(m.ENT_LIST.length >= 140); eq(new Set(m.ENT_LIST.map(x => x.name)).size, m.ENT_LIST.length);
    const named = (n) => m.ENT_LIST.find(x => x.name === n);
    eq(named('copy').cp, 169); eq(named('hellip').ch, '…'); eq(named('euro').ch, '€'); eq(named('rarr').ch, '→'); eq(named('Omega').ch, 'Ω'); eq(named('hearts').ch, '♥'); eq(named('eacute').ch, 'é'); eq(named('nbsp').cp, 160);
    const names = (q) => m.entityFind(q).map(x => x.name);
    eq(names('copy'), ['copy']); eq(names('&copy;'), ['copy']); eq(names('©'), ['copy']); eq(names('169'), ['copy']); eq(names('&#169;'), ['copy']); eq(names('U+00A9'), ['copy']); eq(names('&#xA9;'), ['copy']); eq(names('0xa9'), ['copy']);
    assert.ok(names('arr').includes('rarr') && names('ARR').includes('larr')); eq(names('zzzqq'), []); eq(m.entityFind('').length, m.ENT_LIST.length); eq(names('&'), ['amp']);
    eq(m.entToNumeric('&copy; 2024 &amp; &unknown; &#65; &hellip;'), '&#169; 2024 &#38; &unknown; &#65; &#8230;'); eq(m.entToNamed('&#169; &#x20AC; &#65; &#8230; &#38;'), '&copy; &euro; &#65; &hellip; &amp;');
    eq(m.entToNamed(m.entToNumeric('&lt;b&gt; &nbsp;')), '&lt;b&gt; &nbsp;'); eq(m.entToNumeric('no entity'), 'no entity'); eq(m.entToNumeric('&Copy;'), '&Copy;');
    eq(m.CODECS['HTML 實體'].dec('&copy;&hellip;&eacute;&amp;&#65;&#x42;&lt;&bogus;'), '©…é&AB<&bogus;'); eq(m.CODECS['HTML 實體'].dec(m.CODECS['HTML 實體'].enc('<a href="x">&\'</a>')), '<a href="x">&\'</a>');
    // 雜湊辨識
    const idn = (s) => m.identifyHash(s).map(x => x.name);
    eq(idn('5d41402abc4b2a76b9719d911017c592')[0], 'MD5'); assert.ok(idn('5D41402ABC4B2A76B9719D911017C592').includes('NTLM'));
    eq(idn('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d')[0], 'SHA-1'); eq(idn('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')[0], 'SHA-256'); assert.ok(idn('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824').includes('SHA3-256'));
    eq(idn('a'.repeat(56))[0], 'SHA-224'); eq(idn('a'.repeat(96))[0], 'SHA-384'); eq(idn('a'.repeat(128))[0], 'SHA-512'); eq(idn('a'.repeat(8))[0], 'CRC32'); eq(idn('a'.repeat(33)), []); eq(idn('a'.repeat(31)), []);
    eq(idn('$2b$12$' + 'a'.repeat(53)), ['bcrypt']); eq(idn('$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), ['bcrypt']);
    eq(idn('$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG'), ['Argon2']); eq(idn('$6$salt$' + 'a'.repeat(86)), ['sha512crypt']); eq(idn('$5$salt$' + 'a'.repeat(43)), ['sha256crypt']); eq(idn('$1$salt$' + 'a'.repeat(22)), ['md5crypt']);
    eq(idn('*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19'), ['MySQL 5.x（SHA-1 兩次）']); eq(idn('{SHA}W6ph5Mm5Pz8GgiULbPgzG37mj9g='), ['LDAP / htpasswd SHA-1（Base64）']); eq(idn('$y$j9T$abc$def'), ['yescrypt']);
    eq(idn('1B2M2Y8AsgTpgAmY7PhCfg=='), ['MD5']); eq(idn('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='), ['SHA-256']);   // Base64 寫法
    eq(idn(''), []); eq(idn('   '), []); eq(idn('hello world'), []); eq(idn('zzzz'), []); eq(m.identifyHash('5d41402abc4b2a76b9719d911017c592  ')[0].note, '最常見');
    ok('g7 encode-decode: url batch / entities / hash id');
}

{ // ---------- encoding-fixer：位元組並排 ----------
    const m = load('utils/encoding-fixer.html', 'byteRows, mojiHints, supportedEncs, encodeWith, NAME');
    let r = m.byteRows('中');
    eq(r.length, 1); eq(r[0].cp, 'U+4E2D'); eq(r[0].utf8, 'E4 B8 AD'); eq(r[0].utf16le, '2D 4E'); eq(r[0].utf16be, '4E 2D'); eq(r[0].big5, 'A4 A4'); eq(r[0].gbk, 'D6 D0');
    r = m.byteRows('A'); eq([r[0].utf8, r[0].utf16le, r[0].utf16be, r[0].big5, r[0].gbk], ['41', '41 00', '00 41', '41', '41']);
    r = m.byteRows('😀'); eq(r[0].utf8, 'F0 9F 98 80'); eq(r[0].utf16le, '3D D8 00 DE'); eq(r[0].utf16be, 'D8 3D DE 00'); eq(r[0].big5, null); eq(r[0].gbk, null);
    r = m.byteRows('é'); eq(r[0].utf8, 'C3 A9'); eq(r[0].big5, null);
    r = m.byteRows('文字'); eq(r.map(x => x.big5), ['A4 E5', 'A6 72']); eq(r.map(x => x.gbk), ['CE C4', 'D7 D6']);
    r = m.byteRows('国'); eq(r[0].gbk, 'B9 FA'); eq(r[0].big5, null);       // 簡體字 Big5 放不下
    eq(m.byteRows('').length, 0); eq(m.byteRows('x'.repeat(400)).length, 300);
    // 每個 Big5 / GBK 結果都要能被 TextDecoder 解回原字
    for (const [lab, key] of [['big5', 'big5'], ['gbk', 'gbk']]) for (const x of m.byteRows('你好，世界！測試ABC中文')) if (x[key]) eq(new TextDecoder(lab).decode(Uint8Array.from(x[key].split(' '), h => parseInt(h, 16))), x.ch, lab + ' ' + x.ch);
    const h = Object.fromEntries(m.mojiHints('中文').map(x => [x.as, x.text]));
    eq(h['Windows-1252'], 'ä¸\u00ADæ\u2013\u2021'); assert.ok(h['Big5'] && h['GBK'] && h['Shift_JIS']); eq(m.mojiHints('').every(x => x.text === ''), true);
    ok('g7 encoding-fixer: byte rows / moji hints');
}
