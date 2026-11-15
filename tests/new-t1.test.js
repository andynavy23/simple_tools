// 批次 t1：程式碼截圖 tokenizer / 偵測 / 折行 / ASCII 字型排版
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/text-art.html', 'LANG_DEFS, tokenize, detectLang, splitLines, wrapLine, fitScale, BMS, FONTS, glyph, asciiLayout');
const types = (code, lang) => m.tokenize(code, lang).filter((t) => t[0] !== 'id').map((t) => t[0] + ':' + t[1]);

// ---- tokenizer：串回去等於原文，且各語言抓得到關鍵字 / 字串 / 註解 / 數字 ----
const samples = {
    js: 'const a = `x${1}` + "s"; // hi\n/* b\nc */ foo(42)',
    python: 'def f(x):\n    """doc\nmore"""\n    return x # c',
    sql: "SELECT id FROM t WHERE a = 'x' -- c",
    css: '@media (a) { .b { color: #fff; margin: 10px } }',
    html: '<!-- c --><div class="a">hi</div>',
    json: '{"a": [1, true, "s"]}',
    bash: 'echo "$HOME" # c',
    c: '#include <stdio.h>\nint main() { return 0; }',
    java: 'public class A { String s = "x"; }',
    ts: 'interface A { x: string }',
    text: 'plain'
};
for (const [lang, code] of Object.entries(samples)) {
    assert.equal(m.tokenize(code, lang).map((t) => t[1]).join(''), code, lang + ' 還原');
}
assert.deepEqual(types('const a = 1; // hi', 'js'), ['kw:const', 'num:1', 'com:// hi']);
assert.deepEqual(types('foo("a\\"b")', 'js'), ['fn:foo', 'str:"a\\"b"']);
assert.deepEqual(types('x = `a${b}c`', 'js'), ['str:`a${b}c`']);
assert.deepEqual(types('def f(): return None # c', 'python'), ['kw:def', 'fn:f', 'kw:return', 'kw:None', 'com:# c']);
assert.deepEqual(types('s = """a\nb"""', 'python'), ['str:"""a\nb"""']);
assert.deepEqual(types("select 1 from t where x='y'", 'sql'), ['kw:select', 'num:1', 'kw:from', 'kw:where', 'str:\'y\'']);
assert.deepEqual(types('a { color: #fff; }', 'css'), ['num:#fff']);
assert.deepEqual(types('@media x', 'css'), ['kw:@media']);
assert.deepEqual(types('{"a": true, "b": "c"}', 'json'), ['fn:"a"', 'kw:true', 'fn:"b"', 'str:"c"']);
assert.deepEqual(types('<a href="x">', 'html'), ['kw:<a', 'str:"x"']);
assert.deepEqual(types('echo $HOME # x', 'bash'), ['kw:echo', 'fn:$HOME', 'com:# x']);
assert.deepEqual(types('#include <a>\nint x; /* c */', 'c'), ['kw:#include', 'kw:int', 'com:/* c */']);
assert.deepEqual(types('/* 沒結尾', 'c'), ['com:/* 沒結尾']);
assert.deepEqual(m.tokenize('', 'js'), []);
assert.deepEqual(m.tokenize('a b', 'nope'), [['id', 'a b']]);
// 壞輸入不卡死
m.tokenize('"\'`/*\\'.repeat(2000), 'js');
ok('tokenize');

// ---- 語言偵測 ----
const det = {
    '{"a":1}': 'json', '<div>hi</div>': 'html', '#!/bin/bash\necho hi': 'bash', 'SELECT * FROM users': 'sql',
    'def f():\n  pass': 'python', '#include <stdio.h>\nint main(){}': 'c', 'public class A {}': 'java',
    '.a { color: red; }': 'css', 'interface A { x: number }': 'ts', 'const x = () => 1': 'js', '': 'text'
};
for (const [code, l] of Object.entries(det)) assert.equal(m.detectLang(code), l, code);
ok('detectLang');

// ---- 換行 / 折行 / 倍率 ----
{
    const L = m.splitLines([['com', '/*a\nb*/'], ['id', ' x\ny']]);
    assert.deepEqual(L, [[['com', '/*a']], [['com', 'b*/'], ['id', ' x']], [['id', 'y']]]);
    const w = m.wrapLine([['kw', 'abcde'], ['id', 'fg']], 3);
    assert.deepEqual(w, [[['kw', 'abc']], [['kw', 'de'], ['id', 'f']], [['id', 'g']]]);
    assert.deepEqual(m.wrapLine([], 5), [[]]);
    assert.equal(m.fitScale(800, 600), 2);
    assert.equal(m.fitScale(4500, 1000), 1);
    assert.equal(m.fitScale(9000, 100), 0);
    assert.equal(m.fitScale(5000, 5000), 0);
}
ok('wrap / fitScale');

// ---- ASCII 字型：每個字型的每個字元各列等寬、列數一致 ----
for (const f of Object.keys(m.FONTS)) {
    const h = m.glyph(f, '?').length;
    for (const ch of Object.keys(m.BMS[m.FONTS[f].src])) {
        const g = m.glyph(f, ch);
        assert.equal(g.length, h, `${f} ${ch} 行數`);
        assert.ok(g.every((r) => r.length === g[0].length), `${f} ${ch} 列寬不一致`);
    }
    assert.equal(m.glyph(f, '中').join(), m.glyph(f, '?').join(), '未收錄字元退成 ?');
}
assert.deepEqual(Object.keys(m.FONTS).map((f) => m.glyph(f, 'A').length), [7, 7, 5, 4, 3]);
for (const [src, w, h] of [['57', 5, 7], ['35', 3, 5]]) {
    for (const [ch, rows] of Object.entries(m.BMS[src])) {
        assert.equal(rows.length, h, src + ch);
        assert.ok(rows.every((r) => r.length === w && /^[.#]+$/.test(r)), src + ' ' + ch + ' 列寬 / 字元');
    }
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?.,:;-+=_/()\'*#@') assert.ok(m.BMS[src][ch], src + ' 缺 ' + ch);
}
for (const ch of '"\\&%<>$[]|~^') assert.ok(m.BMS['57'][ch], '57 缺 ' + ch);
ok('fonts consistent');

// ---- 排版 ----
{
    const a = m.asciiLayout('I', 'banner', {});
    assert.equal(a, ' ###\n  #\n  #\n  #\n  #\n  #\n ###');
    const two = m.asciiLayout('ab', 'small', { spacing: 2 });
    const one = m.asciiLayout('ab', 'small', { spacing: 0 });
    assert.equal(two.split('\n').length, 3);
    assert.equal(m.asciiLayout('a\nb', 'banner', {}).split('\n').length, 14);
    // 對齊：置中 / 靠右相對於最寬行
    const lines = m.asciiLayout('ab\nA', 'small', { align: 'right', spacing: 1 }).split('\n');
    const w = Math.max(...lines.map((l) => l.length));
    assert.ok(lines.slice(0, 3).every((l) => l.length <= w));
    assert.ok(lines.slice(3).some((l) => l.length === w), '靠右的第二行貼齊右邊');
    const c = m.asciiLayout('ab\nA', 'small', { align: 'center' }).split('\n');
    assert.ok(/^ /.test(c[3] + c[4] + c[5]) || c.slice(3).some((l) => /^ /.test(l)), '置中有縮排');
    // 換行寬度：每行不超過寬度（單字元寬度以內）
    const wrapped = m.asciiLayout('abc def ghi', 'small', { spacing: 1, width: 16 });
    assert.ok(wrapped.split('\n').every((l) => l.length <= 16), '換行寬度');
    assert.equal(wrapped.split('\n').length % 3, 0);
    assert.ok(wrapped.split('\n').length >= 6, '有換行');
    // 超長單字拆開，不死迴圈
    const longw = m.asciiLayout('abcdefghij', 'banner', { width: 14 });
    assert.ok(longw.split('\n').every((l) => l.length <= 14));
    assert.equal(m.asciiLayout('', 'small', {}), '\n\n');
}
ok('asciiLayout');
