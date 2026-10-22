// 批次 h7：text-diff「套用 patch」、json-formatter「JSON 展平與還原 / XML ⇄ JSON」、sql-query「DDL 工具」
const { load, ok } = require('./_load');
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');

{ // ---------- text-diff：套用 patch ----------
    const { applyPatch, parsePatch, splitKeepEol } = load('utils/text-diff.html', 'applyPatch, parsePatch, splitKeepEol');
    const ap = (a, p, o) => applyPatch(a, p, o);
    const orig = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n';

    // 基本：單一 hunk
    const p1 = '--- a/x\n+++ b/x\n@@ -2,3 +2,3 @@\n b\n-c\n+C\n d\n';
    let r = ap(orig, p1);
    assert.ok(r.ok && r.failed === 0 && r.text === 'a\nb\nC\nd\ne\nf\ng\nh\ni\nj\n', JSON.stringify(r));
    // 沒有檔頭、只有 hunk 也行
    assert.equal(ap(orig, '@@ -2,3 +2,3 @@\n b\n-c\n+C\n d\n').text, r.text);
    // 多 hunk，後面的 hunk 因前面增減行而位移
    const p2 = '@@ -1,2 +1,4 @@\n a\n+a1\n+a2\n b\n@@ -8,3 +10,2 @@\n h\n-i\n j\n';
    r = ap(orig, p2);
    assert.equal(r.text, 'a\na1\na2\nb\nc\nd\ne\nf\ng\nh\nj\n'); assert.equal(r.applied, 2);
    // 行號偏移容錯：原文開頭多了 3 行
    r = ap('x\ny\nz\n' + orig, p1);
    assert.ok(r.ok && r.failed === 0 && r.results[0].offset === 3 && r.text === 'x\ny\nz\na\nb\nC\nd\ne\nf\ng\nh\ni\nj\n', JSON.stringify(r));
    // fuzz：外圍前後文被改過（最多 2 行）
    const p3 = '@@ -2,7 +2,7 @@\n b\n c\n d\n-e\n+E\n f\n g\n h\n';
    r = ap('a\nb2\nc\nd\ne\nf\ng\nh2\ni\nj\n', p3);
    assert.ok(r.failed === 0 && r.results[0].fuzz === 1 && r.text === 'a\nb2\nc\nd\nE\nf\ng\nh2\ni\nj\n', JSON.stringify(r));
    r = ap('a\nb2\nc2\nd\ne\nf\ng2\nh2\ni\nj\n', p3);
    assert.ok(r.failed === 0 && r.results[0].fuzz === 2, JSON.stringify(r));
    r = ap('a\nb2\nc2\nd2\ne\nf\ng2\nh2\ni\nj\n', p3);        // 3 行都不同 → 套不上
    assert.ok(r.failed === 1 && r.text === 'a\nb2\nc2\nd2\ne\nf\ng2\nh2\ni\nj\n' && /前後文對不上/.test(r.results[0].reason), JSON.stringify(r));
    assert.equal(ap('a\nb2\nc2\nd\ne\nf\ng2\nh2\ni\nj\n', p3, { fuzz: 1 }).failed, 1);
    // 刪除的行不能被 fuzz 略過
    assert.equal(ap('a\nb\nc\nd\nX\nf\ng\nh\ni\nj\n', p3).failed, 1);
    // 部分 hunk 失敗，其餘仍套用，並標示位置
    const p4 = '@@ -1,2 +1,2 @@\n-a\n+A\n b\n@@ -9,2 +9,2 @@\n i\n-JJ\n+J\n';
    r = ap(orig, p4);
    assert.ok(r.applied === 1 && r.failed === 1 && r.text.startsWith('A\nb\nc') && r.results[1].line === 9 && /預期第 10 行是「JJ」，但原文是「j」/.test(r.results[1].reason), JSON.stringify(r));
    // 套用兩次 → 提示已套用過
    r = ap(ap(orig, p1).text, p1);
    assert.ok(r.failed === 1 && /已經套用過/.test(r.results[0].reason), JSON.stringify(r));
    // 純新增（-0,0）與在檔尾新增
    assert.equal(ap('', '@@ -0,0 +1,2 @@\n+x\n+y\n').text, 'x\ny\n');
    assert.equal(ap('a\nb\n', '@@ -2 +2,2 @@\n b\n+c\n').text, 'a\nb\nc\n');
    // 刪除到空
    assert.equal(ap('a\nb\n', '@@ -1,2 +0,0 @@\n-a\n-b\n').text, '');
    // 檔尾沒有換行
    r = ap('a\nb', '@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+B\n\\ No newline at end of file\n');
    assert.equal(r.text, 'a\nB');
    r = ap('a\nb', '@@ -1,2 +1,3 @@\n a\n-b\n\\ No newline at end of file\n+b\n+c\n');
    assert.equal(r.text, 'a\nb\nc\n');
    r = ap('a\nb\n', '@@ -1,2 +1,2 @@\n a\n-b\n+B\n\\ No newline at end of file\n');
    assert.equal(r.text, 'a\nB');
    r = ap('a\nb', '@@ -1,2 +1,3 @@\n a\n b\n\\ No newline at end of file\n+c\n\\ No newline at end of file\n');
    assert.equal(r.text, 'a\nb\nc');
    // CRLF：原文 CRLF、patch LF（或 patch 也是 CRLF）；混用保留各行
    const crlf = 'a\r\nb\r\nc\r\nd\r\n';
    assert.equal(ap(crlf, '@@ -2,2 +2,3 @@\n b\n-c\n+C\n+C2\n').text, 'a\r\nb\r\nC\r\nC2\r\nd\r\n');
    assert.equal(ap(crlf, '@@ -2,2 +2,3 @@\r\n b\r\n-c\r\n+C\r\n+C2\r\n').text, 'a\r\nb\r\nC\r\nC2\r\nd\r\n');
    assert.equal(ap('a\nb\r\nc\nd\r\n', '@@ -1,4 +1,5 @@\n a\n b\n+X\n c\n d\n').text, 'a\nb\r\nX\r\nc\nd\r\n');
    assert.equal(ap('a\nb\n', '@@ -1,2 +1,2 @@\n a\n-b\n+B\n').text, 'a\nB\n');
    // 空白行的前後文被編輯器吃掉空格也能解析
    assert.equal(ap('a\n\nb\n', '@@ -1,3 +1,3 @@\n a\n\n-b\n+B\n').text, 'a\n\nB\n');
    // 標頭後面的函式名稱、* 之類不影響
    assert.equal(ap(orig, '@@ -2,3 +2,3 @@ function foo() {\n b\n-c\n+C\n d\n').applied, 1);
    // 不支援與錯誤
    assert.ok(/新增檔案/.test(ap('', 'diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n').error));
    assert.ok(/新增檔案/.test(ap('', '--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n').error));
    assert.ok(/刪除檔案/.test(ap('x\n', 'diff --git a/n b/n\ndeleted file mode 100644\n--- a/n\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n').error));
    assert.ok(/二進位/.test(ap('x', 'diff --git a/n b/n\nBinary files a/n and b/n differ\n').error));
    assert.ok(/2 個檔案/.test(ap('x', 'diff --git a/n b/n\n--- a/n\n+++ b/n\n@@ -1 +1 @@\n-x\n+y\ndiff --git a/m b/m\n--- a/m\n+++ b/m\n@@ -1 +1 @@\n-x\n+y\n').error));
    assert.ok(/沒有 hunk/.test(ap('x', 'diff --git a/n b/n\nsimilarity index 100%\nrename from n\nrename to m\n--- a/n\n+++ b/m\n').error), ap('x', 'diff --git a/n b/n\nsimilarity index 100%\nrename from n\nrename to m\n').error);
    assert.ok(/空的/.test(ap('x', '  \n').error) && /找不到 hunk/.test(ap('x', 'hello').error));
    // 截斷的 patch
    r = ap(orig, '@@ -2,3 +2,3 @@\n b\n-c\n');
    assert.ok(r.failed === 1 && /行數/.test(r.results[0].reason));
    // 同一行內容重複：依預期位置選最近的
    assert.equal(ap('x\nx\nx\nx\nx\n', '@@ -4,2 +4,2 @@\n x\n-x\n+y\n').text, 'x\nx\nx\nx\ny\n');
    // splitKeepEol
    assert.deepEqual(splitKeepEol('a\r\nb\nc'), [{ t: 'a', e: '\r\n' }, { t: 'b', e: '\n' }, { t: 'c', e: '' }]);
    assert.equal(parsePatch(p2)[0].hunks.length, 2);
    ok('text-diff: applyPatch');

    // ---- 真實 git diff：與 git apply 比對 ----
    const git = (cwd, args, input) => { const x = spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', input, maxBuffer: 1 << 26 }); return x; };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-h7-'));
    try {
        const g = (...a) => { const x = git(tmp, a); assert.equal(x.status, 0, a.join(' ') + x.stderr); return x.stdout; };
        g('init', '-q');
        const nl = (n, f = (i) => 'line ' + i) => Array.from({ length: n }, (_, i) => f(i + 1));
        const cases = [
            ['多處修改', nl(60).join('\n') + '\n', (L) => { L[3] = 'CHANGED 4'; L.splice(20, 2); L.splice(40, 0, 'ins A', 'ins B'); L[L.length - 2] = 'last-ish'; return L; }],
            ['CRLF', nl(30).join('\r\n') + '\r\n', (L) => { L[5] = 'six'; L.splice(15, 0, 'new'); return L; }],
            ['檔尾無換行', nl(20).join('\n'), (L) => { L[19] = 'end!'; L.push('more'); return L; }],
            ['含 -- / ++ / @@ 內容', ['-- sql comment', '++x', '@@ not a hunk @@', ...nl(25), '--- dash'].join('\n') + '\n', (L) => { L[0] = '-- changed'; L[2] = '@@ changed @@'; L[L.length - 1] = '--- dash2'; return L; }],
            ['中文與空行', ['標題', '', '段落一', '', ...nl(20, (i) => '項目 ' + i), '', '結尾'].join('\n') + '\n', (L) => { L[2] = '段落一（改）'; L.splice(8, 3); return L; }],
            ['整段換掉', nl(12).join('\n') + '\n', () => ['only'].map(x => x)],
        ];
        for (const [name, text, mod] of cases) {
            const eol = text.includes('\r\n') ? '\r\n' : '\n', endNl = text.endsWith('\n');
            const lines = text.split(eol); if (endNl) lines.pop();
            const mt = mod(lines.slice()).join(eol) + (endNl ? eol : '');
            fs.writeFileSync(path.join(tmp, 'f.txt'), text); g('add', 'f.txt'); g('commit', '-q', '-m', 'c' + name);
            fs.writeFileSync(path.join(tmp, 'f.txt'), mt);
            const patch = g('diff', '--no-color', '-U3', 'f.txt');
            const mine = applyPatch(text, patch);
            assert.ok(mine.ok && mine.failed === 0, name + JSON.stringify(mine));
            assert.equal(mine.text, mt, name + '：套用結果應等於修改後的檔案');
            // 與 git apply 一致
            fs.writeFileSync(path.join(tmp, 'f.txt'), text);
            const pf = path.join(tmp, 'p.patch'); fs.writeFileSync(pf, patch);
            const x = git(tmp, ['apply', 'p.patch']); assert.equal(x.status, 0, name + x.stderr);
            assert.equal(fs.readFileSync(path.join(tmp, 'f.txt'), 'utf8'), mine.text, name + '：與 git apply 不一致');
            // 不同的 context 行數（-U0 / -U1 / -U5），再與「前面插入 7 行」的偏移原文比較
            for (const U of ['-U0', '-U1', '-U5']) {
                fs.writeFileSync(path.join(tmp, 'f.txt'), text);
                fs.writeFileSync(path.join(tmp, 'f.txt'), mt);
                const pu = g('diff', '--no-color', U, 'f.txt');
                const m2 = applyPatch(text, pu); assert.ok(m2.failed === 0 && m2.text === mt, name + U);
                const shifted = nl(7, (i) => 'pre ' + i).join(eol) + eol + text;
                const m3 = applyPatch(shifted, pu), want = nl(7, (i) => 'pre ' + i).join(eol) + eol + mt;
                if (U !== '-U0') { assert.ok(m3.failed === 0 && m3.text === want, name + U + ' 偏移'); fs.writeFileSync(path.join(tmp, 'f.txt'), shifted); fs.writeFileSync(pf, pu); const y = git(tmp, ['apply', 'p.patch']); if (y.status === 0) assert.equal(fs.readFileSync(path.join(tmp, 'f.txt'), 'utf8'), m3.text, name + U + '：偏移時與 git apply 不一致'); }
            }
            fs.writeFileSync(path.join(tmp, 'f.txt'), mt); g('add', 'f.txt'); g('commit', '-q', '-m', 'n' + name, '--allow-empty');
        }
        // 新增 / 刪除檔案的 git diff 要被擋下
        fs.writeFileSync(path.join(tmp, 'n.txt'), 'x\n'); g('add', 'n.txt');
        assert.ok(/新增檔案/.test(applyPatch('', g('diff', '--cached', '--no-color', 'n.txt')).error));
        g('commit', '-q', '-m', 'add n'); fs.rmSync(path.join(tmp, 'n.txt'));
        assert.ok(/刪除檔案/.test(applyPatch('x\n', g('diff', '--no-color', '--', 'n.txt')).error));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    ok('text-diff: applyPatch vs git apply');
}

{ // ---------- json-formatter：展平 / 還原、XML ----------
    const m = load('utils/json-formatter.html', 'jsonFlatten, jsonUnflatten, jsonFlatText, flatParsePath, flatTableParse, jsonToXml, xmlParse, xmlDocToJson, xmlInfer');
    const flat = (v) => Object.fromEntries(m.jsonFlatten(v));
    const back = (o) => JSON.parse(JSON.stringify(m.jsonUnflatten(o).value));
    const rt = (v) => { const t = m.jsonFlatText(v, 'json'); assert.deepEqual(back(JSON.parse(t)), v, t); const tb = m.jsonFlatText(v, 'table'); assert.deepEqual(back(m.flatTableParse(tb)), v, tb); return t; };

    assert.deepEqual(flat({ a: { b: [1, { c: 2 }] }, d: 'x' }), { 'a.b[0]': 1, 'a.b[1].c': 2, d: 'x' });
    assert.deepEqual(flat([{ a: 1 }, [2, 3]]), { '[0].a': 1, '[1][0]': 2, '[1][1]': 3 });
    // 含點號、括號、空字串、引號、數字鍵的鍵
    assert.deepEqual(flat({ 'a.b': 1, 'x[0]': 2, '': 3, 'q"q': 4, 0: 5, '  sp ': 6, 'tab\t': 7, a: { 'b.c': { '[': 1 } } }),
        { '["a.b"]': 1, '["x[0]"]': 2, '[""]': 3, 'q"q': 4, '0': 5, '  sp ': 6, '["tab\\t"]': 7, 'a["b.c"]["["]': 1 });
    // 空容器是葉節點；null、布林、數字
    assert.deepEqual(flat({ e: {}, f: [], n: null, t: true, z: 0, s: '' }), { e: {}, f: [], n: null, t: true, z: 0, s: '' });
    // 往返（含各種怪鍵）
    rt({ a: { b: [1, { c: 2 }, [3, [4]]] }, d: 'x', 'a.b': 1, '': { '': 2 }, 'k]': [], 'k[': {}, '0': { '1': 'o' }, 'x"y': { '\\': '\n' }, '中文.鍵': [null, true, 1.5, -2e21] });
    rt([{ id: 1, tags: ['a', 'b'] }, { id: 2, tags: [] }]);
    rt(JSON.parse('{"__proto__":{"x":1},"a":1}'));
    rt({ s: 'tab\there\nnew\\line\r', t: '\\n', u: ' lead' });
    // 路徑解析
    assert.deepEqual(m.flatParsePath('a.b[0]["c.d"][12].e'), [{ key: 'a' }, { key: 'b' }, { idx: 0 }, { key: 'c.d' }, { idx: 12 }, { key: 'e' }]);
    assert.deepEqual(m.flatParsePath('["a\\"b"]'), [{ key: 'a"b' }]);
    assert.deepEqual(m.flatParsePath('0.1'), [{ key: '0' }, { key: '1' }]);
    for (const bad of ['', 'a.', '.a', 'a..b', 'a[', 'a[x]', 'a[-1]', 'a[0', 'a]b', '["a', '["a"', '["a\\q"]', 'a[0]b', 'a.[0]', '[999999999]']) assert.throws(() => m.flatParsePath(bad), undefined, bad);
    // 還原的錯誤與提醒
    assert.throws(() => m.jsonUnflatten({ a: 1, 'a.b': 2 }), /衝突/);
    assert.throws(() => m.jsonUnflatten({ 'a.b': 2, a: 1 }), /衝突/);
    assert.throws(() => m.jsonUnflatten({ 'a[0]': 1, 'a.b': 2 }), /衝突.*陣列/);
    assert.throws(() => m.jsonUnflatten({ a: { x: 1 } }), /單層/);
    assert.throws(() => m.jsonUnflatten({ 'a..b': 1 }), /鍵「a\.\.b」/);
    assert.throws(() => m.jsonUnflatten([1]), /單層物件/);
    assert.throws(() => m.jsonUnflatten({ '[0]': 1, a: 2 }), /衝突/);
    const u = m.jsonUnflatten({ 'a[0]': 1, 'a[3]': 2 });
    assert.deepEqual(JSON.parse(JSON.stringify(u.value)), { a: [1, null, null, 2] }); assert.ok(/補上了 2 個 null/.test(u.warnings[0]));
    assert.deepEqual(JSON.parse(JSON.stringify(m.jsonUnflatten({ '[1]': 'b', '[0]': 'a' }).value)), ['a', 'b']);
    assert.deepEqual(JSON.parse(JSON.stringify(m.jsonUnflatten({}).value)), {});
    assert.deepEqual(JSON.parse(JSON.stringify(m.jsonUnflatten({ e: {}, f: [] }).value)), { e: {}, f: [] });
    assert.throws(() => m.jsonFlatten(1), /根節點/);
    assert.equal(m.jsonFlatText({}, 'json'), '{}');
    // 原型污染不會發生
    m.jsonUnflatten({ '__proto__.polluted': 1, 'constructor.prototype.x': 2 }); assert.equal({}.polluted, undefined); assert.equal({}.x, undefined);
    // 文字輸出
    assert.equal(m.jsonFlatText({ a: { b: [1, 'x'] } }, 'json'), '{\n  "a.b[0]": 1,\n  "a.b[1]": "x"\n}');
    assert.equal(m.jsonFlatText({ a: 'x\ty', b: {}, c: null }, 'table'), '鍵\t型別\t值\na\tstring\tx\\ty\nb\t{}\t\nc\tnull\tnull');
    assert.throws(() => m.flatTableParse('a\tnumber\tx'), /數字/);
    assert.throws(() => m.flatTableParse('a\tfoo\tx'), /型別/);
    assert.throws(() => m.flatTableParse('a\tstring\tx\na\tstring\ty'), /重複/);
    assert.throws(() => m.flatTableParse('abc'), /第 1 行/);
    // 大型：1 萬個葉節點往返
    const big = { list: Array.from({ length: 10000 }, (_, i) => ({ i, s: 's' + i })) };
    assert.deepEqual(back(JSON.parse(m.jsonFlatText(big, 'json'))), big);
    ok('json-formatter: flatten / unflatten');

    // ---- JSON → XML ----
    const x = (v, o) => m.jsonToXml(v, { indent: '  ', ...o });
    assert.equal(x({ root: { '@id': '1', a: 'text', b: [1, 2], c: null, d: { '@x': 'y', '#text': 'hi' }, e: '' } }).text,
        '<root id="1">\n  <a>text</a>\n  <b>1</b>\n  <b>2</b>\n  <c/>\n  <d x="y">hi</d>\n  <e/>\n</root>');
    assert.equal(x({ a: 1 }, { decl: true, indent: '' }).text, '<?xml version="1.0" encoding="UTF-8"?><a>1</a>');
    assert.equal(x({ a: 1 }, { decl: true }).text, '<?xml version="1.0" encoding="UTF-8"?>\n<a>1</a>');
    assert.equal(x({ 'ns:a': { '@xmlns:ns': 'urn:x', 'ns:b': 'v' } }).text, '<ns:a xmlns:ns="urn:x">\n  <ns:b>v</ns:b>\n</ns:a>');
    assert.equal(x({ a: 'x < y & z > w' }).text, '<a>x &lt; y &amp; z &gt; w</a>');
    assert.equal(x({ a: 'x < y ]]> &' }, { cdata: true }).text, '<a><![CDATA[x < y ]]]]><![CDATA[> &]]></a>');
    assert.equal(x({ a: { '@q': 'say "hi"\n<&>' } }).text, '<a q="say &quot;hi&quot;&#10;&lt;&amp;&gt;"/>');
    assert.equal(x({ a: { '#text': ['t1', 't2'], b: 1 } }).text, '<a>\n  t1\n  t2\n  <b>1</b>\n</a>');
    assert.equal(x({ a: { '#text': 't', '@k': null } }).text, '<a k="">t</a>');
    assert.equal(x({ a: true }).text, '<a>true</a>');
    // 需要包根元素
    const w = x({ a: 1, b: 2 }); assert.equal(w.text, '<root>\n  <a>1</a>\n  <b>2</b>\n</root>'); assert.ok(w.warnings.length);
    assert.equal(x([1, 2]).text, '<root>\n  <item>1</item>\n  <item>2</item>\n</root>');
    assert.equal(x({ a: [1, 2] }).text, '<root>\n  <a>1</a>\n  <a>2</a>\n</root>');
    assert.equal(x('hi', { root: 'r' }).text, '<r>hi</r>');
    assert.equal(x({ '@a': 1 }).text, '<root a="1"/>');
    // 錯誤
    assert.throws(() => x({ '1a': 1 }), /不是合法的 XML 名稱/);
    assert.throws(() => x({ a: { 'b c': 1 } }), /b c/);
    assert.throws(() => x({ a: { '@1x': 1 } }), /屬性名稱/);
    assert.throws(() => x({ a: { '@k': { z: 1 } } }), /屬性的值/);
    assert.throws(() => x({ a: [[1]] }), /陣列裡直接放陣列/);
    assert.throws(() => x({ a: 'x\u0001' }), /控制字元/);
    assert.throws(() => x({ a: { '#text': { z: 1 } } }), /#text/);
    assert.equal(x({ '中文': 2 }).text, '<中文>2</中文>');
    assert.equal(m.xmlInfer('42'), 42); assert.equal(m.xmlInfer('007'), '007'); assert.equal(m.xmlInfer('1.0'), '1.0'); assert.equal(m.xmlInfer('true'), true); assert.equal(m.xmlInfer('-1.5e3'), -1500); assert.equal(m.xmlInfer(''), '');

    // ---- XML → JSON：用最小的假 DOM 驗證轉換規則（真實 DOMParser 在 e2e 測）----
    const el = (tag, attrs = {}, kids = []) => ({ nodeType: 1, tagName: tag, attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })), childNodes: kids });
    const tx = (v) => ({ nodeType: 3, nodeValue: v }), cd = (v) => ({ nodeType: 4, nodeValue: v });
    const conv = (root, o) => { const r = m.xmlDocToJson({ documentElement: root }, o); return { v: JSON.parse(JSON.stringify(r.value)), w: r.warnings }; };
    assert.deepEqual(conv(el('a', {}, [tx('hi')])).v, { a: 'hi' });
    assert.deepEqual(conv(el('a')).v, { a: null });
    assert.deepEqual(conv(el('a', {}, [tx('\n  ')])).v, { a: null });
    assert.deepEqual(conv(el('a', { id: '1', 'xmlns:n': 'u' })).v, { a: { '@id': '1', '@xmlns:n': 'u' } });
    assert.deepEqual(conv(el('a', { id: '1' }, [tx('t')])).v, { a: { '@id': '1', '#text': 't' } });
    assert.deepEqual(conv(el('a', {}, [tx('\n'), el('b', {}, [tx('1')]), tx('\n'), el('b', {}, [tx('2')]), el('c')])).v, { a: { b: ['1', '2'], c: null } });
    assert.deepEqual(conv(el('n:a', {}, [el('n:b', {}, [tx('v')])])).v, { 'n:a': { 'n:b': 'v' } });
    assert.deepEqual(conv(el('a', {}, [tx('x '), cd('<raw> & '), tx('y')])).v, { a: 'x <raw> & y' });
    const c = conv(el('p', {}, [tx('hello '), el('b', {}, [tx('bold')]), tx(' world')]));
    assert.deepEqual(c.v, { p: { '#text': ['hello', 'world'], b: 'bold' } }); assert.ok(/混合內容/.test(c.w[0]));
    assert.deepEqual(conv(el('a', { n: '5' }, [el('b', {}, [tx('true')]), el('c', {}, [tx('007')])]), { infer: true }).v, { a: { '@n': 5, b: true, c: '007' } });
    // xmlParse 的錯誤位置（假 parser 模擬 Chrome / Firefox 的訊息）
    const fake = (msg, ns = 'http://www.w3.org/1999/xhtml') => function () { this.parseFromString = () => ({ getElementsByTagName: () => [{ namespaceURI: ns, textContent: msg }] }); };
    assert.throws(() => m.xmlParse('<a>\n<b></a>', fake('This page contains the following errors:error on line 2 at column 7: Opening and ending tag mismatch: b line 2 and a\nBelow is a rendering of the page up to the first error.')),
        (e) => e.line === 2 && e.col === 7 && /mismatch/.test(e.message) && /第 2 行、第 7 欄/.test(e.message) && e.extra.includes('<b></a>') && e.extra.endsWith('^'));
    assert.throws(() => m.xmlParse('<a', fake('XML Parsing Error: unclosed token\nLocation: file:///x\nLine Number 1, Column 3:<a')), (e) => e.line === 1 && e.col === 3 && /unclosed token/.test(e.message) && !/Location/.test(e.message));
    assert.throws(() => m.xmlParse('<a', fake('weird')), (e) => /不是有效的 XML：weird/.test(e.message) && e.line === undefined);
    // 沒有 parsererror（或使用者自己的 <parsererror> 元素、沒有命名空間）就是正常文件
    const okDoc = { ok: 1 };
    assert.equal(m.xmlParse('<a/>', function () { this.parseFromString = () => Object.assign(okDoc, { getElementsByTagName: () => [{ namespaceURI: null, textContent: 'x' }] }); }), okDoc);
    ok('json-formatter: XML');
}

{ // ---------- sql-query：DDL 工具 ----------
    const m = load('utils/sql-query.html', 'ddlParse, ddlToCode, ddlDetect, ddlLayout, ddlEdgePts, ddlCategory, ddlWords, ddlCase');
    const P = (s) => m.ddlParse(s);
    const col = (t, n) => t.columns.find(c => c.name === n);

    // ---- MySQL ----
    const my = P(`-- dump
CREATE TABLE \`users\` (
  \`id\` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'it''s pk',
  \`email\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '',
  \`status\` enum('a','b c') DEFAULT 'a',
  \`score\` decimal(10,2) DEFAULT NULL,
  \`flag\` tinyint(1) NOT NULL DEFAULT 0,
  \`updated\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`key\` varchar(50),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_email\` (\`email\`),
  KEY \`idx_u\` (\`updated\`, \`flag\`),
  FULLTEXT KEY \`ft\` (\`email\`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COMMENT='用戶表';
CREATE TABLE \`orders\` (
  \`id\` bigint NOT NULL AUTO_INCREMENT,
  \`user_id\` int(11) unsigned NOT NULL,
  \`note\` text,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_o_u\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE SET NULL
) ENGINE=InnoDB;
INSERT INTO users VALUES (1);
`);
    let u = my.tables[0], o = my.tables[1];
    assert.equal(my.tables.length, 2); assert.equal(u.name, 'users'); assert.equal(u.comment, '用戶表');
    assert.deepEqual(u.columns.map(c => c.name), ['id', 'email', 'status', 'score', 'flag', 'updated', 'key']);
    let c = col(u, 'id'); assert.ok(c.pk && c.auto && !c.nullable && c.unsigned && c.type === 'int' && c.args[0] === '11' && c.comment === "it's pk");
    c = col(u, 'email'); assert.ok(!c.nullable && c.def === "''" && c.unique && c.type === 'varchar');
    assert.deepEqual(col(u, 'status').args, ['a', 'b c']); assert.equal(col(u, 'status').def, "'a'");
    assert.deepEqual(col(u, 'score').args, ['10', '2']); assert.equal(col(u, 'score').def, 'NULL'); assert.ok(col(u, 'score').nullable);
    assert.equal(col(u, 'updated').def, 'CURRENT_TIMESTAMP');
    assert.equal(col(u, 'key').type, 'varchar');                      // 欄位叫 key 不會被當成索引
    assert.deepEqual(u.pk, ['id']); assert.deepEqual(u.uniques, [{ name: 'uk_email', cols: ['email'] }]);
    assert.deepEqual(u.indexes.map(i => [i.name, i.cols, i.kind]), [['idx_u', ['updated', 'flag'], ''], ['ft', ['email'], 'fulltext']]);
    assert.equal(o.fks.length, 1);
    assert.deepEqual([o.fks[0].name, o.fks[0].cols, o.fks[0].ref.name, o.fks[0].refCols, o.fks[0].onDelete, o.fks[0].onUpdate, o.fks[0].found], ['fk_o_u', ['user_id'], 'users', ['id'], 'CASCADE', 'SET NULL', true]);
    assert.ok(my.skipped.some(s => /INSERT/.test(s.text) && s.level === 'warn'));
    assert.ok(my.skipped.some(s => /資料表選項/.test(s.reason) && s.level === 'info'));
    assert.equal(m.ddlDetect(`CREATE TABLE \`a\` (id int AUTO_INCREMENT)`), 'mysql');

    // ---- PostgreSQL ----
    const pg = P(`CREATE TABLE IF NOT EXISTS public.accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uid uuid DEFAULT gen_random_uuid() NOT NULL,
  name character varying(100) NOT NULL DEFAULT 'x'::character varying,
  tags text[] DEFAULT '{}'::text[],
  matrix integer[][],
  created timestamp with time zone DEFAULT now() NOT NULL,
  born timestamp without time zone,
  meta jsonb,
  amount numeric(12, 2) CHECK (amount >= 0),
  ratio double precision,
  seq integer DEFAULT nextval('acct_seq'::regclass),
  gen integer GENERATED ALWAYS AS (seq * 2) STORED
);
CREATE TABLE public.items (id serial, account_id bigint, PRIMARY KEY (id));
ALTER TABLE ONLY public.items ADD CONSTRAINT items_acc_fk FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ONLY public.items ADD CONSTRAINT items_u UNIQUE (account_id);
ALTER TABLE public.items ADD COLUMN extra text NOT NULL DEFAULT 'e';
ALTER TABLE public.items OWNER TO postgres;
ALTER TABLE public.ghost ADD COLUMN x int;
CREATE UNIQUE INDEX CONCURRENTLY idx_items_acc ON public.items USING btree (account_id, lower(extra) DESC) WHERE extra IS NOT NULL;
CREATE INDEX nowhere ON missing (a);
COMMENT ON TABLE public.items IS 'x';
SET search_path = public;
`);
    const ac = pg.tables[0], it = pg.tables[1];
    assert.equal(ac.schema, 'public'); assert.equal(ac.name, 'accounts');
    assert.ok(col(ac, 'id').auto && col(ac, 'id').pk);
    assert.equal(col(ac, 'name').type, 'character varying'); assert.equal(col(ac, 'name').def, "'x'::character varying");
    assert.ok(col(ac, 'tags').array && col(ac, 'tags').type === 'text'); assert.equal(col(ac, 'tags').def, "'{}'::text[]");
    assert.ok(col(ac, 'matrix').array);
    assert.equal(col(ac, 'created').type, 'timestamp with time zone'); assert.equal(col(ac, 'created').def, 'now()'); assert.ok(!col(ac, 'created').nullable);
    assert.equal(col(ac, 'ratio').type, 'double precision'); assert.equal(col(ac, 'seq').def, "nextval('acct_seq'::regclass)");
    assert.ok(col(ac, 'gen').generated && col(ac, 'gen').nullable);
    assert.deepEqual(col(ac, 'amount').args, ['12', '2']);
    assert.ok(pg.skipped.some(s => /amount/.test(s.reason) && s.level === 'info'));
    assert.deepEqual(it.pk, ['id']); assert.ok(col(it, 'id').auto === false && col(it, 'id').type === 'serial');
    assert.equal(it.fks.length, 1); assert.deepEqual([it.fks[0].name, it.fks[0].ref.schema, it.fks[0].refCols, it.fks[0].onDelete], ['items_acc_fk', 'public', ['id'], 'SET NULL']);
    assert.deepEqual(it.uniques, [{ name: 'items_u', cols: ['account_id'] }]); assert.ok(col(it, 'account_id').unique);
    assert.ok(col(it, 'extra') && !col(it, 'extra').nullable && col(it, 'extra').def === "'e'");
    assert.deepEqual(it.indexes.map(i => [i.name, i.unique, i.cols]), [['idx_items_acc', true, ['account_id', 'lower(extra)']]]);
    for (const re of [/OWNER/, /ghost/, /missing/, /COMMENT ON/, /SET search_path/, /INCLUDE \/ WHERE/]) assert.ok(pg.skipped.some(s => re.test(s.reason + s.text)), String(re) + JSON.stringify(pg.skipped));
    assert.equal(m.ddlDetect(`CREATE TABLE a (id bigserial, t text DEFAULT 'x'::text)`), 'pg');

    // ---- SQLite ----
    const sq = P(`CREATE TABLE "notes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE ON CONFLICT REPLACE,
  body,
  score REAL DEFAULT 0,
  done BOOLEAN DEFAULT 0,
  data BLOB,
  ts DATETIME DEFAULT CURRENT_TIMESTAMP,
  parent INTEGER REFERENCES notes(id),
  UNIQUE (title, score)
) WITHOUT ROWID;
CREATE INDEX idx_t ON notes(title COLLATE NOCASE);`);
    const nt = sq.tables[0];
    assert.ok(col(nt, 'id').auto && col(nt, 'id').pk && col(nt, 'id').type === 'integer');
    assert.equal(col(nt, 'body').type, ''); assert.ok(col(nt, 'title').unique && !col(nt, 'title').nullable);
    assert.equal(nt.fks.length, 1); assert.equal(nt.fks[0].ref.name, 'notes'); assert.equal(nt.fks[0].found, true);
    assert.deepEqual(nt.uniques, [{ name: '', cols: ['title', 'score'] }]); assert.deepEqual(nt.indexes[0].cols, ['title']);
    assert.equal(m.ddlDetect('CREATE TABLE a (id INTEGER PRIMARY KEY AUTOINCREMENT)'), 'sqlite');

    // ---- SQL Server ----
    const ms = P(`CREATE TABLE [dbo].[Customers](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [Name] [nvarchar](50) NOT NULL,
    [Bio] [nvarchar](max) NULL,
    [Guid] [uniqueidentifier] NOT NULL DEFAULT (newid()),
    [Created] [datetime2](7) NOT NULL CONSTRAINT [DF_c] DEFAULT (getdate()),
    [Active] [bit] NOT NULL,
    [Ver] [timestamp] NOT NULL,
    CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([Id] ASC) WITH (PAD_INDEX = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
CREATE TABLE dbo.Orders (
    OrderId int NOT NULL PRIMARY KEY,
    CustomerId int NOT NULL,
    CONSTRAINT FK_o_c FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (Id)
)
GO
CREATE NONCLUSTERED INDEX IX_o ON dbo.Orders (CustomerId) INCLUDE (OrderId)
GO`);
    const cu = ms.tables[0];
    assert.equal(cu.schema, 'dbo'); assert.equal(cu.name, 'Customers');
    assert.ok(col(cu, 'Id').auto && col(cu, 'Id').pk && col(cu, 'Id').type === 'int');
    assert.deepEqual(col(cu, 'Name').args, ['50']); assert.deepEqual(col(cu, 'Bio').args, ['max']);
    assert.equal(col(cu, 'Guid').def, '(newid())'); assert.equal(col(cu, 'Created').def, '(getdate())'); assert.equal(col(cu, 'Created').type, 'datetime2');
    assert.deepEqual(cu.pk, ['Id']);
    assert.equal(ms.tables[1].fks[0].ref.name, 'Customers'); assert.equal(ms.tables[1].fks[0].found, true);
    assert.equal(ms.tables[1].indexes[0].name, 'IX_o');
    assert.equal(m.ddlDetect('CREATE TABLE [dbo].[A]([Id] [int] IDENTITY(1,1))'), 'mssql');
    assert.equal(m.ddlDetect('select 1'), 'pg');

    // ---- 解析不了的列出、不丟失；壞輸入不丟非預期例外 ----
    const bad = P('CREATE TABLE t AS SELECT 1; CREATE TABLE a (x int, ,y text, FOO BAR BAZ(1)); CREATE VIEW v AS SELECT 1; DROP TABLE z; CREATE TABLE b (id int CHECK (id>0) WEIRDWORD 12, id int);');
    assert.equal(bad.tables.length, 2);
    for (const re of [/AS \/ LIKE/, /CREATE VIEW|不是 CREATE TABLE/, /DROP TABLE/, /WEIRDWORD/, /重複定義/]) assert.ok(bad.skipped.some(s => re.test(s.reason + s.text)), String(re) + JSON.stringify(bad.skipped));
    assert.deepEqual(P('').tables, []); assert.deepEqual(P('CREATE TABLE x (').tables, []);
    assert.throws(() => P("CREATE TABLE x (a text default 'unterminated"), /切分/);
    assert.throws(() => P('x'.repeat(300001)), /太長/);
    assert.throws(() => P(Array.from({ length: 101 }, (_, i) => `CREATE TABLE t${i} (id int);`).join('')), /超過 100 張/);
    const sample = `CREATE TABLE a (id int PRIMARY KEY, b_id int REFERENCES b(id) ON DELETE CASCADE, n varchar(10) DEFAULT 'x' NOT NULL, CONSTRAINT u UNIQUE (n), KEY k (n)); CREATE TABLE b (id serial, x numeric(3,1)[]); ALTER TABLE b ADD FOREIGN KEY (id) REFERENCES a (id); CREATE INDEX i ON b (id);`;
    for (let n = 0; n <= sample.length; n++) { try { P(sample.slice(0, n)); } catch (e) { assert.ok(/切分|太長/.test(e.message), n + ':' + e.message); } }
    for (let n = 0; n < sample.length; n += 7) { try { P(sample.slice(0, n) + sample.slice(n + 5)); } catch (e) { assert.ok(/切分/.test(e.message), n + ':' + e.message); } }
    // 外鍵參照到不存在的表
    const orphan = P('CREATE TABLE a (id int, b int REFERENCES nowhere(id));');
    assert.equal(orphan.tables[0].fks[0].found, false); assert.ok(orphan.skipped.some(s => /nowhere/.test(s.reason)));
    // 沒寫參照欄位時補上被參照表的主鍵
    assert.deepEqual(P('CREATE TABLE p (k int primary key); CREATE TABLE c (pk int REFERENCES p);').tables[1].fks[0].refCols, ['k']);
    ok('sql-query: ddlParse');

    // ---- 型別分類（依方言）----
    const cat = (type, d, extra = {}) => m.ddlCategory({ type, args: [], unsigned: false, ...extra }, d).cat;
    assert.equal(cat('tinyint', 'mysql', { args: ['1'] }), 'bool'); assert.equal(cat('tinyint', 'mysql', { args: ['4'] }), 'int'); assert.equal(cat('tinyint', 'mssql'), 'int');
    assert.equal(cat('bit', 'mysql'), 'bool'); assert.equal(cat('bit', 'mysql', { args: ['8'] }), 'bytes'); assert.equal(cat('bit', 'mssql'), 'bool'); assert.equal(cat('bit', 'pg', { args: ['3'] }), 'string');
    assert.equal(cat('int', 'mysql', { unsigned: true }), 'bigint'); assert.equal(cat('int', 'mysql'), 'int');
    assert.equal(cat('timestamp', 'mssql'), 'bytes'); assert.equal(cat('timestamp', 'mysql'), 'datetime'); assert.equal(cat('timestamp', 'pg'), 'datetime');
    assert.equal(cat('integer', 'sqlite'), 'bigint'); assert.equal(cat('integer', 'pg'), 'int'); assert.equal(cat('int', 'sqlite'), 'int'); assert.equal(cat('unsigned big int', 'sqlite'), 'bigint');
    assert.equal(cat('', 'sqlite'), 'unknown'); assert.equal(cat('varchar(3)', 'sqlite'), 'string'); assert.equal(cat('nvarchar', 'sqlite'), 'string'); assert.equal(cat('double', 'sqlite'), 'float'); assert.equal(cat('mediumtext', 'sqlite'), 'string');
    assert.equal(cat('serial', 'pg'), 'int'); assert.equal(cat('bigserial', 'pg'), 'bigint'); assert.equal(cat('serial', 'mysql'), 'bigint'); assert.equal(cat('jsonb', 'pg'), 'json'); assert.equal(cat('bytea', 'pg'), 'bytes');
    assert.equal(cat('uniqueidentifier', 'mssql'), 'uuid'); assert.equal(cat('money', 'mssql'), 'decimal'); assert.equal(cat('geometry', 'pg'), 'unknown'); assert.equal(cat('character varying', 'pg'), 'string'); assert.equal(cat('double precision', 'pg'), 'float');
    assert.equal(m.ddlCategory({ type: 'timestamp with time zone', args: [] }, 'pg').tz, true); assert.equal(m.ddlCategory({ type: 'timestamp without time zone', args: [] }, 'pg').tz, false);
    assert.deepEqual(m.ddlWords('userID'), ['user', 'ID']); assert.deepEqual(m.ddlWords('HTTPServer_v2'), ['HTTP', 'Server', 'v', '2']); assert.deepEqual(m.ddlWords('user-name x'), ['user', 'name', 'x']);
    assert.equal(m.ddlCase('created_at', 'camel'), 'createdAt'); assert.equal(m.ddlCase('createdAt', 'snake'), 'created_at'); assert.equal(m.ddlCase('user_id', 'pascal', true), 'UserID'); assert.equal(m.ddlCase('URLPath', 'camel'), 'urlPath');

    // ---- 轉型別 ----
    const sch = P(`CREATE TABLE user_accounts (
      id bigint PRIMARY KEY,
      email varchar(255) NOT NULL, -- c
      nick_name text,
      created_at timestamp with time zone NOT NULL,
      balance numeric(10,2) NOT NULL,
      tags text[],
      meta jsonb,
      "class" int NOT NULL COMMENT 'cls',
      odd geometry,
      "weird col" int NOT NULL,
      "9x" int NOT NULL
    );`);
    const gen = (l, o) => m.ddlToCode(sch, l, { dialect: 'pg', ...o });
    let g = gen('ts');
    assert.equal(g.text, `export interface UserAccounts {
  id: number;
  email: string;
  nickName: string | null;
  createdAt: Date;
  balance: string;
  tags: string[] | null;
  meta: unknown | null;
  /** cls */
  class: number;
  odd: unknown | null;
  weirdCol: number;
  _9X: number;
}
`);
    assert.ok(/geometry/.test(g.warnings[0]));
    g = gen('ts', { nullable: 'optional', naming: 'keep' });
    assert.ok(g.text.includes('  nick_name?: string;') && g.text.includes('  email: string;') && g.text.includes('  weird_col: number;'));
    g = gen('ts', { nullable: 'ignore', naming: 'pascal' });
    assert.ok(g.text.includes('  NickName: string;') && !g.text.includes('null'));
    g = gen('go');
    assert.equal(g.text, 'package model\n\nimport (\n\t"encoding/json"\n\t"time"\n)\n\ntype UserAccounts struct {\n\tID        int64           `json:"id" db:"id"`\n\tEmail     string          `json:"email" db:"email"`\n\tNickName  *string         `json:"nick_name" db:"nick_name"`\n\tCreatedAt time.Time       `json:"created_at" db:"created_at"`\n\tBalance   string          `json:"balance" db:"balance"`\n\tTags      []string        `json:"tags" db:"tags"`\n\tMeta      json.RawMessage `json:"meta" db:"meta"`\n\tClass     int32           `json:"class" db:"class"` // cls\n\tOdd       interface{}     `json:"odd" db:"odd"`\n\tWeirdCol  int32           `json:"weird col" db:"weird col"`\n\t_9X       int32           `json:"9x" db:"9x"`\n}\n');
    g = gen('go', { nullable: 'optional' });
    assert.ok(g.text.includes('`json:"nick_name,omitempty" db:"nick_name"`') && g.text.includes('Tags      []string') && !g.text.includes('Email    *string'));
    g = gen('python');
    assert.equal(g.text, `from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional


@dataclass
class UserAccounts:
    id: int
    email: str
    nick_name: Optional[str]
    created_at: datetime
    balance: Decimal
    tags: Optional[list[str]]
    meta: Optional[Any]
    class_: int  # cls
    odd: Optional[Any]
    weird_col: int
    _9_x: int
`);
    g = gen('python', { nullable: 'optional' });
    assert.ok(/    weird_col: int\n    _9_x: int\n    nick_name: Optional\[str\] = None\n    tags: Optional\[list\[str\]\] = None\n/.test(g.text));
    g = gen('java');
    assert.equal(g.text, `import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record UserAccounts(
        Long id,
        String email,
        String nickName,
        OffsetDateTime createdAt,
        BigDecimal balance,
        List<String> tags,
        String meta,
        /** cls */
        int class_,
        Object odd,
        int weirdCol,
        int _9X
) {}
`.replace('        Long id,', '        long id,'));
    g = gen('java', { nullable: 'optional' });
    assert.ok(g.text.includes('Optional<String> nickName') && g.text.includes('import java.util.Optional;') && g.text.includes('Optional<List<String>> tags'));
    // 方言差異：MySQL tinyint(1) → 布林、timestamp 不帶時區；SQL Server bit → 布林
    const dd = P('CREATE TABLE f (a tinyint(1) NOT NULL, b int unsigned NOT NULL, c timestamp NOT NULL, d bigint NOT NULL);');
    assert.ok(m.ddlToCode(dd, 'ts', { dialect: 'mysql' }).text.includes('a: boolean;'));
    assert.ok(m.ddlToCode(dd, 'go', { dialect: 'mysql' }).text.includes('int64') && m.ddlToCode(dd, 'ts', { dialect: 'pg' }).text.includes('a: number;'));
    assert.ok(m.ddlToCode(dd, 'java', { dialect: 'mysql' }).text.includes('LocalDateTime c') && !m.ddlToCode(dd, 'java', { dialect: 'mysql' }).text.includes('OffsetDateTime'));
    // 多張表、重複的名稱、同名欄位碰撞
    const mt = P('CREATE TABLE a_b (x int NOT NULL, "X" int NOT NULL, "x_" int NOT NULL); CREATE TABLE "a-b" (id int NOT NULL);');
    const mtt = m.ddlToCode(mt, 'ts', { dialect: 'pg' }).text;
    assert.ok(/interface AB \{\n  x: number;\n  x_2: number;\n  x_3: number;\n\}/.test(mtt) && /interface AB_2 \{/.test(mtt), mtt);
    assert.equal(typeof m.ddlToCode({ tables: [] }, 'go', {}).text, 'string');
    assert.throws(() => m.ddlToCode(sch, 'rust'), /不支援/);
    ok('sql-query: ddlToCode');

    // ---- 關聯圖排版 ----
    const lay = (s) => m.ddlLayout(P(s), (t) => t.length * 7);
    const L = lay(`CREATE TABLE users (id int primary key, name text);
      CREATE TABLE posts (id int primary key, user_id int REFERENCES users(id), cat int REFERENCES cats(id));
      CREATE TABLE cats (id int primary key, parent int REFERENCES cats(id));
      CREATE TABLE comments (id int primary key, post_id int REFERENCES posts(id), user_id int REFERENCES users(id));
      CREATE TABLE lonely (x int);`);
    assert.equal(L.boxes.length, 5); assert.equal(L.edges.length, 5);
    const by = (n) => L.boxes.find(b => b.title === n);
    assert.ok(by('users').x < by('posts').x && by('posts').x < by('comments').x && by('cats').x < by('posts').x, '被參照的在左邊');
    for (const b of L.boxes) { assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= L.W && b.y + b.h <= L.H, b.title + ' 超出畫布'); }
    for (const a of L.boxes) for (const b of L.boxes) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.title} 與 ${b.title} 重疊`);
    for (const e of L.edges) { const p = m.ddlEdgePts(L, e); assert.ok(p.slice(0, 2).concat(p.slice(3, 5)).every(Number.isFinite) && Math.abs(p[2]) === 1 && Math.abs(p[5]) === 1); }
    const sr = L.edges.find(e => e.a === e.b); assert.ok(sr, '自我參照'); const sp = m.ddlEdgePts(L, sr); assert.equal(sp[0], sp[3]);
    assert.deepEqual(by('posts').rows.map(r => [r.name, r.badge]), [['id', 'PK'], ['user_id', 'FK'], ['cat', 'FK']]);
    // 同一方向的邊端點在方塊邊緣
    const e0 = L.edges.find(e => L.boxes[e.a].title === 'posts' && L.boxes[e.b].title === 'users'), p0 = m.ddlEdgePts(L, e0);
    assert.equal(p0[0], by('posts').x); assert.equal(p0[3], by('users').x + by('users').w);
    // 欄位很多：主鍵與外鍵一定會畫出來，其餘截到 25 欄
    const wide = lay(`CREATE TABLE p (id int primary key); CREATE TABLE w (${Array.from({ length: 60 }, (_, i) => `c${i} int`).join(', ')}, id int primary key, late int REFERENCES p(id));`);
    const wb = wide.boxes.find(b => b.title === 'w');
    assert.equal(wb.rows.length, 25); assert.equal(wb.more, 37); assert.ok(wb.rows.some(r => r.name === 'late' && r.badge === 'FK') && wb.rows.some(r => r.name === 'id'));
    assert.ok(wide.edges[0].ra >= 0);
    // 沒有外鍵的大量資料表：分成多欄，不會變成一條很長的直線
    const many = lay(Array.from({ length: 40 }, (_, i) => `CREATE TABLE t${i} (${Array.from({ length: 10 }, (_, j) => `c${j} int`).join(',')});`).join('\n'));
    assert.ok(many.H <= 900 + 60 && many.boxes.some(b => b.x > 100), `H=${many.H}`);
    // 循環參照、互相參照不會無限遞迴
    const cyc = lay('CREATE TABLE a (id int primary key, b int REFERENCES b(id)); CREATE TABLE b (id int primary key, a int REFERENCES a(id));');
    assert.equal(cyc.boxes.length, 2); assert.equal(cyc.edges.length, 2);
    assert.equal(lay('CREATE TABLE only1 (id int);').boxes.length, 1);
    ok('sql-query: ddlLayout');
}
