// h8 批次：random-data（JSON Schema 產生）/ encode-decode（校驗碼）/ csv-tool（清理、JOIN、樞紐、HTML 表格）/ chart-maker（直方圖、盒鬚圖、趨勢線）的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ---------- random-data：JSON Schema ----------
{
    const R = load('utils/random-data.html', 'patString, patParse, schemaUnsupported, schemaValidate, schemaInfer, schemaFromText, genFromSchema, JS_MAX');
    const sd = Util.seeded;
    // pattern 產生的字串一定符合同一個 pattern
    for (const p of ['^[A-Z]{2}-\\d{4}$', '[a-f0-9]{8}', '(foo|bar)+x?', '\\w{3,6}@\\d+', '[^abc]{4}', 'a.b', '\\s\\D{2}', '(?:ab){2}', '[\\d.]{3}-[a-z]']) {
        const re = new RegExp('^(?:' + p.replace(/^\^|\$$/g, '') + ')$');
        for (let i = 0; i < 50; i++) assert.ok(re.test(R.patString(p, sd(p + i).int)), p);
    }
    for (const p of ['(?=a)b', '(a', 'a)', '\\1', '\\b', '[a-', '*a', 'a{3,1}', '[z-a]', '(?<n>a)']) assert.throws(() => R.patParse(p), /pattern 不支援/, p);

    const schema = { type: 'object', required: ['id', 'name', 'email', 'age', 'tags'], properties: {
        id: { type: 'string', format: 'uuid' }, name: { type: 'string', minLength: 2, maxLength: 8 }, email: { type: 'string', format: 'email' },
        age: { type: 'integer', minimum: 18, maximum: 65 }, score: { type: 'number', minimum: 0.5, maximum: 1.5 }, role: { enum: ['a', 'b', 'c'] },
        code: { type: 'string', pattern: '^[A-Z]{2}-\\d{4}$' }, at: { type: 'string', format: 'date-time' }, day: { type: 'string', format: 'date' }, url: { type: 'string', format: 'uri' },
        ok: { type: 'boolean' }, nul: { type: ['string', 'null'] }, k: { const: 7 },
        tags: { type: 'array', items: { type: 'string', maxLength: 5 }, minItems: 1, maxItems: 3 }, nested: { type: 'object', required: ['x'], properties: { x: { type: 'integer', minimum: -5, maximum: -1 } } } } };
    const g = R.genFromSchema(schema, 300, 'seed1');
    assert.strictEqual(g.rows.length, 300); assert.strictEqual(g.bad, 0, g.first);
    for (const row of g.rows) { assert.deepStrictEqual(R.schemaValidate(schema, row), []); assert.ok(row.age >= 18 && row.age <= 65 && Number.isInteger(row.age)); assert.ok(row.tags.length >= 1 && row.tags.length <= 3); assert.ok(row.k === undefined || row.k === 7); }
    assert.ok(g.rows.some(r => !('role' in r)) && g.rows.some(r => 'role' in r));   // 非必要欄位有時出現有時不出現
    // 種子可重現；不同種子不同
    assert.deepStrictEqual(R.genFromSchema(schema, 20, 'seed1').rows, R.genFromSchema(schema, 20, 'seed1').rows);
    assert.notDeepStrictEqual(R.genFromSchema(schema, 20, 'seed1').rows, R.genFromSchema(schema, 20, 'seed2').rows);
    assert.strictEqual(R.genFromSchema(schema, 3).rows.length, 3);   // 無種子也行
    // 上限
    assert.throws(() => R.genFromSchema(schema, 5001), /5000/); assert.throws(() => R.genFromSchema(schema, 0), /5000/);
    assert.strictEqual(R.genFromSchema({ type: 'integer' }, 5000, 'x').rows.length, 5000);
    // 衝突條件報錯而不是亂產
    assert.throws(() => R.genFromSchema({ type: 'integer', minimum: 5, maximum: 1 }, 1), /minimum/);
    assert.throws(() => R.genFromSchema({ type: 'integer', minimum: 1.2, maximum: 1.8 }, 1), /整數/);
    assert.throws(() => R.genFromSchema({ type: 'string', minLength: 5, maxLength: 2 }, 1), /minLength/);
    assert.throws(() => R.genFromSchema({ type: 'array', minItems: 5, maxItems: 2 }, 1), /minItems/);
    assert.throws(() => R.genFromSchema({ enum: [] }, 1), /enum/);
    assert.throws(() => R.genFromSchema({ type: 'blob' }, 1), /不支援的型別/);
    assert.throws(() => R.genFromSchema({ type: 'string', pattern: '(?=a)' }, 1), /pattern/);
    // 節點與巢狀上限
    assert.throws(() => R.genFromSchema({ type: 'array', minItems: 100, maxItems: 100, items: { type: 'array', minItems: 100, maxItems: 100, items: { type: 'array', minItems: 100, maxItems: 100, items: { type: 'string' } } } }, 1), /太大/);
    let deep = { type: 'string' }; for (let i = 0; i < 12; i++) deep = { type: 'object', required: ['a'], properties: { a: deep } };
    assert.throws(() => R.genFromSchema(deep, 1), /巢狀/);
    // 不支援的關鍵字會被列出
    const un = R.schemaUnsupported({ type: 'object', anyOf: [], properties: { a: { type: 'string', format: 'hostname', multipleOf: 2 }, b: { $ref: '#/x' }, c: { type: 'weird' } }, additionalProperties: false });
    assert.deepStrictEqual(un.sort(), ['$.anyOf', '$.a.format=hostname', '$.a.multipleOf', '$.b.$ref', '$.c.type=weird'].sort());
    assert.deepStrictEqual(R.schemaUnsupported(schema), []);
    assert.ok(R.schemaUnsupported({ items: [{}] })[0].includes('items'));
    // 驗證器：挑出錯的
    const v = (s, x) => R.schemaValidate(s, x).length;
    assert.strictEqual(v({ type: 'integer' }, 1.5), 1); assert.strictEqual(v({ type: 'number' }, 3), 0); assert.strictEqual(v({ type: 'string' }, null), 1);
    assert.strictEqual(v({ minimum: 3 }, 2), 1); assert.strictEqual(v({ maximum: 3 }, 4), 1); assert.strictEqual(v({ minLength: 3 }, 'ab'), 1); assert.strictEqual(v({ maxLength: 1 }, 'ab'), 1);
    assert.strictEqual(v({ pattern: '^a+$' }, 'ab'), 1); assert.strictEqual(v({ pattern: '^a+$' }, 'aa'), 0);
    assert.strictEqual(v({ enum: [1, 'a'] }, 'b'), 1); assert.strictEqual(v({ const: { a: 1 } }, { a: 1 }), 0);
    assert.strictEqual(v({ format: 'email' }, 'nope'), 1); assert.strictEqual(v({ format: 'uuid' }, 'x'), 1); assert.strictEqual(v({ format: 'date' }, '2020-13-45'), 1); assert.strictEqual(v({ format: 'date-time' }, '2020-01-01T00:00:00Z'), 0); assert.strictEqual(v({ format: 'uri' }, 'abc'), 1);
    assert.strictEqual(v({ required: ['a'] }, {}), 1); assert.strictEqual(v({ items: { type: 'integer' }, minItems: 2 }, [1]), 1); assert.strictEqual(v({ maxItems: 1 }, [1, 2]), 1);
    assert.strictEqual(v({ properties: { a: { type: 'string' } } }, { a: 1 }), 1);
    // 範例 JSON 推論
    const f = R.schemaFromText('{"id":"3f2b8c1e-9a4d-4e7b-8c21-5d0a6b7e1f90","mail":"a@b.co","n":3,"p":1.5,"ok":true,"d":"2024-01-02","tags":["x","y"],"o":{"z":null}}');
    assert.ok(f.inferred); assert.strictEqual(f.schema.properties.id.format, 'uuid'); assert.strictEqual(f.schema.properties.mail.format, 'email'); assert.strictEqual(f.schema.properties.n.type, 'integer'); assert.strictEqual(f.schema.properties.p.type, 'number');
    assert.strictEqual(f.schema.properties.d.format, 'date'); assert.strictEqual(f.schema.properties.tags.items.type, 'string'); assert.strictEqual(f.schema.properties.o.properties.z.type, 'null');
    assert.strictEqual(R.genFromSchema(f.schema, 50, 'q').bad, 0);
    assert.ok(!R.schemaFromText('{"type":"object","properties":{}}').inferred); assert.ok(!R.schemaFromText('{"type":["string","null"]}').inferred);
    assert.ok(R.schemaFromText('{"type":"user","name":"a"}').inferred); assert.ok(R.schemaFromText('[1,2,3]').inferred);
    assert.throws(() => R.schemaFromText('{bad'), /JSON/); assert.throws(() => R.schemaFromText('{"a":"' + 'x'.repeat(200001) + '"}'), /太大/);
    ok('random-data JSON Schema');
}
// ---------- encode-decode：校驗碼 ----------
{
    const E = load('utils/encode-decode.html', 'ckAll, ckNew, ckFeed, ckDone, ckSwap16, luhnValid, luhnCheckDigit, gtinCheckDigit, gtinValid, isbn10Check, isbn10Valid, isbn13Valid, isbn10to13, isbn13to10, checkDigits, CK_FILE_MAX');
    const te = new TextEncoder(), by = (n, r) => Object.fromEntries(r.map(x => [x.name, x.hex]))[n];
    let r = E.ckAll(te.encode('123456789'));
    assert.strictEqual(by('CRC-32', r), 'CBF43926'); assert.strictEqual(by('CRC-16/CCITT-FALSE', r), '29B1'); assert.strictEqual(by('CRC-16/MODBUS', r), '4B37');
    assert.strictEqual(by('Adler-32', E.ckAll(te.encode('Wikipedia'))), '11E60398');
    r = E.ckAll(new Uint8Array(0)); assert.strictEqual(by('CRC-32', r), '00000000'); assert.strictEqual(by('CRC-16/CCITT-FALSE', r), 'FFFF'); assert.strictEqual(by('Adler-32', r), '00000001');
    assert.strictEqual(r[0].dec, 0);
    // Modbus 報文：01 03 00 00 00 0A → CRC 低位在前 C5 CD
    const m = E.ckAll(Uint8Array.from([1, 3, 0, 0, 0, 10])); assert.strictEqual(E.ckSwap16(by('CRC-16/MODBUS', m)), 'C5CD');
    assert.strictEqual(by('CRC-32', E.ckAll(te.encode('The quick brown fox jumps over the lazy dog'))), '414FA339');
    // 分塊餵入結果與一次算完相同（含跨 Adler 5552 邊界與大量資料）
    const big = Uint8Array.from({ length: 200000 }, (_, i) => (i * 31 + (i >> 3)) & 255), one = E.ckAll(big), st = E.ckNew();
    for (let o = 0; o < big.length; o += 7777) E.ckFeed(st, big.subarray(o, o + 7777));
    assert.deepStrictEqual(E.ckDone(st), one);
    assert.strictEqual(by('Adler-32', E.ckAll(new Uint8Array(100000).fill(255))).length, 8);
    assert.strictEqual(E.CK_FILE_MAX, 200 * 1024 * 1024);
    // Luhn
    assert.ok(E.luhnValid('4111111111111111')); assert.ok(E.luhnValid('79927398713')); assert.ok(!E.luhnValid('79927398710')); assert.ok(!E.luhnValid('1')); assert.ok(!E.luhnValid('12a4'));
    assert.strictEqual(E.luhnCheckDigit('7992739871'), 3); assert.strictEqual(E.luhnCheckDigit('411111111111111'), 1);
    for (let i = 0; i < 100; i++) { const b = String(1000000 + i * 7919); assert.ok(E.luhnValid(b + E.luhnCheckDigit(b))); }
    assert.throws(() => E.luhnCheckDigit('12x'), /數字/);
    // EAN / UPC
    assert.ok(E.gtinValid('4006381333931')); assert.ok(E.gtinValid('036000291452')); assert.ok(E.gtinValid('96385074')); assert.ok(E.gtinValid('00012345678905')); assert.ok(!E.gtinValid('4006381333932')); assert.ok(!E.gtinValid('12345'));
    assert.strictEqual(E.gtinCheckDigit('400638133393'), 1); assert.strictEqual(E.gtinCheckDigit('03600029145'), 2); assert.strictEqual(E.gtinCheckDigit('9638507'), 4);
    // ISBN
    assert.ok(E.isbn10Valid('0306406152')); assert.ok(E.isbn10Valid('080442957X')); assert.ok(E.isbn10Valid('080442957x')); assert.ok(!E.isbn10Valid('0306406153'));
    assert.strictEqual(E.isbn10Check('030640615'), '2'); assert.strictEqual(E.isbn10Check('080442957'), 'X');
    assert.ok(E.isbn13Valid('9780306406157')); assert.ok(!E.isbn13Valid('9780306406158')); assert.ok(!E.isbn13Valid('4006381333931'));   // 非 978/979 開頭不是 ISBN
    assert.strictEqual(E.isbn10to13('0306406152'), '9780306406157'); assert.strictEqual(E.isbn13to10('9780306406157'), '0306406152'); assert.strictEqual(E.isbn10to13('080442957X'), '9780804429573');
    assert.throws(() => E.isbn13to10('9791090636071'), /979/); assert.throws(() => E.isbn10to13('0306406153'), /ISBN-10/);
    for (const s of ['0306406152', '080442957X', '0198526636']) assert.strictEqual(E.isbn13to10(E.isbn10to13(s)), s);
    // 統一入口
    const c = E.checkDigits;
    assert.ok(c('luhn', '4111 1111-1111 1111', 'verify').ok); assert.ok(!c('luhn', '4111111111111112', 'verify').ok); assert.ok(c('luhn', '4111111111111112', 'verify').lines[0].includes('應該是 1'));
    assert.deepStrictEqual(c('luhn', '7992739871', 'calc').lines, ['檢查碼：3', '完整號碼：79927398713']); assert.ok(!c('luhn', 'abc', 'verify').ok); assert.ok(!c('luhn', '', 'verify').ok); assert.ok(!c('luhn', '1', 'verify').ok);
    assert.ok(!c('luhn', '1'.repeat(65), 'verify').ok);
    assert.ok(c('isbn', '978-0-306-40615-7', 'verify').ok); assert.ok(c('isbn', '0-306-40615-2', 'verify').lines[0].includes('9780306406157')); assert.ok(!c('isbn', '0306406153', 'verify').ok);
    assert.ok(c('isbn', '080442957x', 'verify').ok); assert.ok(!c('isbn', '12345', 'verify').ok); assert.ok(!c('isbn', '4006381333931', 'verify').ok);
    assert.deepStrictEqual(c('isbn', '030640615', 'calc').lines, ['ISBN-10 檢查碼：2', '完整號碼：0306406152']); assert.deepStrictEqual(c('isbn', '978030640615', 'calc').lines, ['ISBN-13 檢查碼：7', '完整號碼：9780306406157']); assert.ok(!c('isbn', '12345', 'calc').ok);
    assert.deepStrictEqual(c('isbn', '0306406152', 'convert').lines, ['ISBN-13：9780306406157']); assert.deepStrictEqual(c('isbn', '9780306406157', 'convert').lines, ['ISBN-10：0306406152']); assert.ok(!c('isbn', '9791090636071', 'convert').ok); assert.ok(!c('isbn', '123', 'convert').ok);
    assert.ok(c('gtin', '4006381333931', 'verify').lines[0].startsWith('EAN-13')); assert.ok(c('gtin', '036000291452', 'verify').lines[0].startsWith('UPC-A')); assert.ok(!c('gtin', '4006381333932', 'verify').ok); assert.ok(!c('gtin', '123456789', 'verify').ok);
    assert.deepStrictEqual(c('gtin', '400638133393', 'calc').lines, ['檢查碼：1', '完整號碼：4006381333931（EAN-13）']); assert.ok(c('gtin', '03600029145', 'calc').lines[1].includes('UPC-A')); assert.ok(c('gtin', '9638507', 'calc').lines[1].includes('EAN-8')); assert.ok(!c('gtin', '12345', 'calc').ok);
    assert.ok(!c('nope', '1', 'verify').ok);
    ok('encode-decode 校驗碼');
}
// ---------- csv-tool：資料清理 / JOIN / 樞紐 ----------
{
    const C = load('utils/csv-tool.html', 'normNumber, normDate, cleanOp, joinTables, pivotTable, ADV_MAX_COLS, ADV_MAX_ROWS');
    // 數字
    assert.strictEqual(C.normNumber('1,234.50'), '1234.50'); assert.strictEqual(C.normNumber('NT$ 1,000'), '1000'); assert.strictEqual(C.normNumber('＄12'), '12');
    assert.strictEqual(C.normNumber('１２３'), '123'); assert.strictEqual(C.normNumber('(45)'), '-45'); assert.strictEqual(C.normNumber('+7'), '7'); assert.strictEqual(C.normNumber(' -3.5 '), '-3.5');
    assert.strictEqual(C.normNumber('1,234.567', 2), '1234.57'); assert.strictEqual(C.normNumber('2', 2), '2.00'); assert.strictEqual(C.normNumber('abc'), null); assert.strictEqual(C.normNumber('12%'), null); assert.strictEqual(C.normNumber('1.2.3'), null); assert.strictEqual(C.normNumber(''), null);
    // 日期
    const D = C.normDate;
    assert.strictEqual(D('2024-1-2'), '2024-01-02'); assert.strictEqual(D('2024/01/02'), '2024-01-02'); assert.strictEqual(D('2024.1.2'), '2024-01-02'); assert.strictEqual(D('2024年1月2日'), '2024-01-02'); assert.strictEqual(D('20240102'), '2024-01-02');
    assert.strictEqual(D('113/5/2'), '2024-05-02'); assert.strictEqual(D('民國99年12月31日'), '2010-12-31'); assert.strictEqual(D('99/12/31'), null);   // 2 位數年沒有「民國」不猜
    assert.strictEqual(D('12/31/2024'), '2024-12-31'); assert.strictEqual(D('31/12/2024', '-', 'dmy'), '2024-12-31'); assert.strictEqual(D('05/06/2024', '/', 'dmy'), '2024/06/05'); assert.strictEqual(D('05/06/2024', '/', 'mdy'), '2024/05/06');
    assert.strictEqual(D('２０２４／１／２'), '2024-01-02'); assert.strictEqual(D('2023-02-29'), null); assert.strictEqual(D('2024-13-01'), null); assert.strictEqual(D('2024-02-29'), '2024-02-29'); assert.strictEqual(D('hello'), null); assert.strictEqual(D('2024-01-02 10:00'), null);
    const H = ['name', 'dept', 'amt', 'date'];
    const T = [[' Ann ', 'A', '1,000', '2024/1/2'], ['Bob', '', 'x', '113/5/2'], ['Bob', '', 'x', '113/5/2'], ['', 'B', '', '']];
    const clone = JSON.stringify(T);
    let r = C.cleanOp(H, T, 'trim'); assert.strictEqual(r.changed, 1); assert.strictEqual(r.rows[0][0], 'Ann'); assert.strictEqual(JSON.stringify(T), clone);   // 不改動輸入
    r = C.cleanOp(H, T, 'trim', [1]); assert.strictEqual(r.changed, 0);
    r = C.cleanOp(H, T, 'dedupe'); assert.strictEqual(r.changed, 1); assert.strictEqual(r.rows.length, 3); assert.strictEqual(r.unit, '列');
    r = C.cleanOp(H, T, 'dedupe', [0]); assert.strictEqual(r.rows.length, 3); r = C.cleanOp(H, T, 'dedupe', [1]); assert.strictEqual(r.rows.length, 3);   // dept: A,'',B
    assert.strictEqual(C.cleanOp(H, [['a', 'x'], ['a', 'y'], ['b', 'x']].map(x => [...x, '', '']), 'dedupe', [0]).rows.length, 2);
    // 補空值
    r = C.cleanOp(H, T, 'fill', [1], { mode: 'fixed', text: 'N/A' }); assert.strictEqual(r.changed, 2); assert.deepStrictEqual(r.rows.map(x => x[1]), ['A', 'N/A', 'N/A', 'B']);
    assert.throws(() => C.cleanOp(H, T, 'fill', [1], { mode: 'fixed', text: '' }), /固定值/);
    r = C.cleanOp(H, T, 'fill', [1], { mode: 'prev' }); assert.deepStrictEqual(r.rows.map(x => x[1]), ['A', 'A', 'A', 'B']); assert.strictEqual(r.changed, 2);
    r = C.cleanOp(['v'], [['1'], [''], ['3'], [' ']], 'fill', [0], { mode: 'mean' }); assert.deepStrictEqual(r.rows.map(x => x[0]), ['1', '2', '3', '2']);
    assert.throws(() => C.cleanOp(['v'], [['a'], ['']], 'fill', [0], { mode: 'mean' }), /沒有數字/);
    r = C.cleanOp(['v'], [['a'], ['b'], ['b'], ['']], 'fill', [0], { mode: 'mode' }); assert.strictEqual(r.rows[3][0], 'b');
    r = C.cleanOp(['v'], [[''], ['a']], 'fill', [], { mode: 'prev' }); assert.strictEqual(r.changed, 0);   // 開頭沒有上一列可補
    assert.throws(() => C.cleanOp(['v'], [['']], 'fill', [0], { mode: 'zzz' }), /補值/);
    // 拆分 / 合併
    r = C.cleanOp(['n', 'tags'], [['1', 'a,b,c'], ['2', 'd'], ['3', '']], 'split', [1], { text: ',' });
    assert.deepStrictEqual(r.header, ['n', 'tags_1', 'tags_2', 'tags_3']); assert.deepStrictEqual(r.rows, [['1', 'a', 'b', 'c'], ['2', 'd', '', ''], ['3', '', '', '']]); assert.strictEqual(r.changed, 1);
    r = C.cleanOp(['n', 'tags'], [['1', 'a,b']], 'split', [1], { text: ',', keep: true }); assert.deepStrictEqual(r.header, ['n', 'tags', 'tags_1', 'tags_2']); assert.deepStrictEqual(r.rows[0], ['1', 'a,b', 'a', 'b']);
    assert.throws(() => C.cleanOp(['a', 'b'], [['x', 'y']], 'split', [0, 1], { text: ',' }), /一欄/); assert.throws(() => C.cleanOp(['a'], [['x']], 'split', [0], { text: '' }), /分隔/);
    assert.throws(() => C.cleanOp(['a'], [['1,2,3,4,5,6,7,8,9,10,11']], 'split', [0], { text: ',' }), /10/);
    r = C.cleanOp(['f', 'l', 'x'], [['A', 'B', '1'], ['C', '', '2']], 'merge', [0, 1], { text: ' ' }); assert.deepStrictEqual(r.header, ['x', 'f_l']); assert.deepStrictEqual(r.rows, [['1', 'A B'], ['2', 'C ']]);
    r = C.cleanOp(['f', 'l'], [['A', 'B']], 'merge', [1, 0], { text: '-', keep: true }); assert.deepStrictEqual(r.header, ['f', 'l', 'f_l']); assert.strictEqual(r.rows[0][2], 'A-B');
    assert.throws(() => C.cleanOp(['f'], [['A']], 'merge', [0], { text: ' ' }), /兩欄/);
    // 欄數上限
    const wideH = Array.from({ length: 498 }, (_, i) => 'c' + i); assert.throws(() => C.cleanOp([...wideH, 't'], [[...wideH.map(() => ''), 'a,b,c']], 'split', [498], { text: ',' }), /500/);
    // 數字 / 日期欄
    r = C.cleanOp(H, T, 'number', [2], { mode: '2' }); assert.deepStrictEqual(r.rows.map(x => x[2]), ['1000.00', 'x', 'x', '']); assert.strictEqual(r.changed, 1); assert.ok(r.note.includes('2 格'));
    r = C.cleanOp(H, T, 'number', [2], { mode: 'keep' }); assert.strictEqual(r.rows[0][2], '1000');
    r = C.cleanOp(H, T, 'date', [3], { mode: '-', mode2: 'mdy' }); assert.deepStrictEqual(r.rows.map(x => x[3]), ['2024-01-02', '2024-05-02', '2024-05-02', '']); assert.strictEqual(r.changed, 3);
    r = C.cleanOp(H, T, 'date', [3], { mode: '/' }); assert.strictEqual(r.rows[0][3], '2024/01/02');
    assert.throws(() => C.cleanOp(H, T, 'number', [], {}), /勾選/); assert.throws(() => C.cleanOp(H, T, 'nope'), /未知/);
    // 不動輸入的錯誤欄索引會被忽略
    assert.strictEqual(C.cleanOp(H, T, 'trim', [99, -1, 1.5]).changed, 1);

    // JOIN
    const H1 = ['id', 'name'], R1 = [['1', 'A'], ['2', 'B'], ['3', 'C'], ['', 'E']], H2 = ['id', 'name', 'city'], R2 = [['1', 'X', 'TPE'], ['3', 'Y', 'KHH'], ['3', 'Z', 'TNN'], ['', 'Q', 'ZZZ']];
    let j = C.joinTables(H1, R1, H2, R2, 0, 0, 'inner');
    assert.deepStrictEqual(j.header, ['id', 'name', 'name_2', 'city']); assert.deepStrictEqual(j.rows, [['1', 'A', 'X', 'TPE'], ['3', 'C', 'Y', 'KHH'], ['3', 'C', 'Z', 'TNN']]); assert.strictEqual(j.matched, 2); assert.strictEqual(j.unmatched, 2);
    j = C.joinTables(H1, R1, H2, R2, 0, 0, 'left', 'drop'); assert.deepStrictEqual(j.header, ['id', 'name', 'city']); assert.strictEqual(j.rows.length, 5); assert.deepStrictEqual(j.rows[1], ['2', 'B', '']); assert.deepStrictEqual(j.rows[4], ['', 'E', '']); assert.strictEqual(j.dropped, 1);
    j = C.joinTables(['id', 'name', 'name_2'], [['1', 'a', 'b']], H2, R2, 0, 0, 'inner'); assert.deepStrictEqual(j.header, ['id', 'name', 'name_2', 'name_3', 'city']);   // 後綴也會避開既有欄名
    j = C.joinTables(['k'], [[' 1 ']], ['key', 'v'], [['1', 'ok']], 0, 0); assert.deepStrictEqual(j.rows, [[' 1 ', 'ok']]);   // 鍵比對會去前後空白
    assert.throws(() => C.joinTables(H1, R1, H2, R2, 9, 0), /左表/); assert.throws(() => C.joinTables(H1, R1, H2, R2, 0, -1), /右表/);
    const manyL = Array.from({ length: 400 }, () => ['k']), manyR = Array.from({ length: 400 }, (_, i) => ['k', String(i)]);
    assert.throws(() => C.joinTables(['a'], manyL, ['a', 'b'], manyR, 0, 0), /100000/);   // 16 萬列 > 上限，拒絕而不是截斷
    // 樞紐
    const PH = ['dept', 'q', 'amt'], PR = [['A', 'Q1', '10'], ['A', 'Q1', '20'], ['A', 'Q2', '5'], ['B', 'Q1', '7'], ['B', 'Q2', 'n/a'], ['B', 'Q2', ''], ['', 'Q2', '3']];
    let p = C.pivotTable(PH, PR, { row: 0, col: 1, val: 2, agg: 'sum' });
    assert.deepStrictEqual(p.header, ['dept', 'Q1', 'Q2', '總計']); assert.strictEqual(p.skipped, 1);
    assert.deepStrictEqual(p.rows, [['A', '30', '5', '35'], ['B', '7', '0', '7'], ['（空白）', '0', '3', '3'], ['總計', '37', '8', '45']]);
    p = C.pivotTable(PH, PR, { row: 0, col: 1, val: 2, agg: 'avg' }); assert.deepStrictEqual(p.rows[0], ['A', '15', '5', '11.666667']); assert.deepStrictEqual(p.rows[1], ['B', '7', '', '7']); assert.strictEqual(p.rows[3][3], '9');
    p = C.pivotTable(PH, PR, { row: 0, col: 1, val: 2, agg: 'max' }); assert.deepStrictEqual(p.rows[0], ['A', '20', '5', '20']); assert.strictEqual(p.rows[3][3], '20');
    p = C.pivotTable(PH, PR, { row: 0, col: 1, val: 2, agg: 'min' }); assert.deepStrictEqual(p.rows[0], ['A', '10', '5', '5']);
    p = C.pivotTable(PH, PR, { row: 0, col: 1, agg: 'count' }); assert.deepStrictEqual(p.rows, [['A', '2', '1', '3'], ['B', '1', '2', '3'], ['（空白）', '0', '1', '1'], ['總計', '3', '4', '7']]);
    p = C.pivotTable(PH, PR, { row: 0, col: 1, val: 2, agg: 'count' }); assert.strictEqual(p.rows[3][3], '6');   // 選了值欄：只算值欄非空白的列（n/a 也是非空白）
    p = C.pivotTable(PH, PR, { row: 0, agg: 'count' }); assert.deepStrictEqual(p.header, ['dept', '計數']); assert.deepStrictEqual(p.rows, [['A', '3'], ['B', '3'], ['（空白）', '1'], ['總計', '7']]);
    p = C.pivotTable(PH, PR, { row: 0, val: 2, agg: 'sum' }); assert.deepStrictEqual(p.header, ['dept', '加總（amt）']); assert.strictEqual(p.rows.at(-1)[1], '45');
    p = C.pivotTable(['k', 'v'], [['b', '2'], ['a', '10'], ['a', '1']], { row: 0, val: 1, agg: 'sum' }); assert.deepStrictEqual(p.rows.map(x => x[0]), ['a', 'b', '總計']);
    p = C.pivotTable(['n', 'v'], [['10', '1'], ['9', '1'], ['100', '1']], { row: 0, val: 1, agg: 'sum' }); assert.deepStrictEqual(p.rows.map(x => x[0]), ['9', '10', '100', '總計']);   // 數字依數值排序
    p = C.pivotTable(['k', 'v'], [['a', '0.1'], ['a', '0.2']], { row: 0, val: 1, agg: 'sum' }); assert.strictEqual(p.rows[0][1], '0.3');   // 浮點誤差已修
    p = C.pivotTable(['k', 'v'], [], { row: 0, val: 1, agg: 'sum' }); assert.deepStrictEqual(p.rows, [['總計', '0']]);
    assert.throws(() => C.pivotTable(PH, PR, { row: -1 }), /列欄位/); assert.throws(() => C.pivotTable(PH, PR, { row: 0, agg: 'sum' }), /值欄位/); assert.throws(() => C.pivotTable(PH, PR, { row: 0, agg: 'zzz' }), /未知/); assert.throws(() => C.pivotTable(PH, PR, { row: 0, col: 9 }), /欄欄位/);
    const bigRows = Array.from({ length: 10001 }, (_, i) => [String(i)]); assert.throws(() => C.pivotTable(['id'], bigRows, { row: 0 }), /10000/);
    assert.throws(() => C.pivotTable(['a', 'b'], Array.from({ length: 201 }, (_, i) => ['x', String(i)]), { row: 0, col: 1 }), /200/);
    assert.strictEqual(C.pivotTable(['id'], bigRows.slice(0, 10000), { row: 0 }).rows.length, 10001);
    ok('csv-tool 清理 / JOIN / 樞紐');
}
// ---------- chart-maker：直方圖 / 盒鬚圖 / 趨勢線 ----------
{
    const K = load('utils/chart-maker.html', 'quantile, suggestBinWidth, histogram, boxStats, linReg, movingAvg, trendModel, trendItems, normOpts, TYPES, TYPE_NAMES, HIST_MAX_BINS');
    // 分位數（線性內插，同 Excel QUARTILE.INC）
    const q = K.quantile; assert.strictEqual(q([1, 2, 3, 4, 5], 0.25), 2); assert.strictEqual(q([1, 2, 3, 4, 5], 0.5), 3); assert.strictEqual(q([1, 2, 3, 4], 0.25), 1.75); assert.strictEqual(q([1, 2, 3, 4], 0.75), 3.25); assert.strictEqual(q([7], 0.9), 7); assert.ok(Number.isNaN(q([], 0.5))); assert.strictEqual(q([1, 2], 0), 1); assert.strictEqual(q([1, 2], 1), 2);
    // 組距建議
    assert.strictEqual(K.suggestBinWidth(Array.from({ length: 100 }, (_, i) => i + 1)), 20); assert.strictEqual(K.suggestBinWidth([5, 5, 5]), 1); assert.strictEqual(K.suggestBinWidth([]), 1);
    assert.ok(K.suggestBinWidth([1, 1, 1, 1, 1, 1, 1, 1, 1, 50]) > 0);   // IQR = 0 改用 Sturges
    const wide = Array.from({ length: 1000 }, (_, i) => i * 1000); assert.ok((Math.max(...wide) - 0) / K.suggestBinWidth(wide) <= K.HIST_MAX_BINS);
    // 直方圖
    let h = K.histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5); assert.deepStrictEqual([h.start, h.nb, h.counts], [0, 2, [5, 5]]);
    h = K.histogram([0, 5, 10], 5); assert.deepStrictEqual(h.counts, [1, 2]);   // 最大值落在邊界時算在最後一組
    h = K.histogram([-7, -1], 5); assert.deepStrictEqual([h.start, h.counts], [-10, [1, 1]]);
    h = K.histogram([3, 3, 3]); assert.deepStrictEqual([h.width, h.nb, h.counts], [1, 1, [3]]);
    h = K.histogram([1, 2, 3], ''); assert.strictEqual(h.width, h.suggested); h = K.histogram([1, 2, 3], 0); assert.strictEqual(h.width, h.suggested); h = K.histogram([1, 2, 3], '0.5'); assert.strictEqual(h.width, 0.5);
    h = K.histogram([0.1, 0.2, 0.3], 0.1); assert.strictEqual(h.counts.reduce((a, b) => a + b, 0), 3);
    assert.throws(() => K.histogram([], 1), /沒有/); assert.throws(() => K.histogram([1, 2], -1), /組距/); assert.throws(() => K.histogram([1, 2], 'abc'), /組距/); assert.throws(() => K.histogram([0, 1000], 1), /200/); assert.strictEqual(K.histogram([0, 199], 1).nb, 199);
    assert.strictEqual(K.histogram([NaN, 1, 2, Infinity], 1).n, 2);
    for (let t = 0; t < 40; t++) {   // 隨機資料：總數不變、每個值落在自己那一組
        const r = Util.seeded('h' + t), v = Array.from({ length: 1 + r.int(300) }, () => Math.round((r() * 200 - 80) * 100) / 100), w = [undefined, 2, 3, 7, 25][t % 5];
        const x = K.histogram(v, w); assert.strictEqual(x.counts.reduce((a, b) => a + b, 0), v.length);
        const exp = new Array(x.nb).fill(0); for (const a of v) { let i = Math.floor((a - x.start) / x.width + 1e-9); exp[Math.min(x.nb - 1, Math.max(0, i))]++; assert.ok(a >= x.start - 1e-9 && a <= x.start + x.nb * x.width + 1e-9); }
        assert.deepStrictEqual(x.counts, exp);
    }
    // 盒鬚圖
    let b = K.boxStats([1, 2, 3, 4, 100]); assert.deepStrictEqual([b.n, b.min, b.max, b.q1, b.median, b.q3, b.iqr, b.lo, b.hi], [5, 1, 100, 2, 3, 4, 2, 1, 4]); assert.deepStrictEqual(b.outliers, [100]);
    b = K.boxStats([-50, 10, 11, 12, 13, 14, 15]); assert.deepStrictEqual(b.outliers, [-50]); assert.strictEqual(b.lo, 10); assert.strictEqual(b.hi, 15);
    b = K.boxStats([9, 3, 5, 1, 7]); assert.deepStrictEqual([b.q1, b.median, b.q3, b.outliers.length], [3, 5, 7, 0]);   // 不要求輸入已排序
    b = K.boxStats([5]); assert.deepStrictEqual([b.q1, b.median, b.q3, b.lo, b.hi], [5, 5, 5, 5, 5]);
    b = K.boxStats([4, 4, 4, 4, 40]); assert.deepStrictEqual(b.outliers, [40]); assert.strictEqual(b.hi, 4);   // IQR = 0 時偏離的都是離群值
    assert.strictEqual(K.boxStats([]), null); assert.strictEqual(K.boxStats([NaN]), null);
    const inp = [3, 1, 2]; K.boxStats(inp); assert.deepStrictEqual(inp, [3, 1, 2]);   // 不改動輸入
    // 迴歸
    let g = K.linReg([1, 2, 3, 4], [3, 5, 7, 9]); assert.ok(Math.abs(g.slope - 2) < 1e-12 && Math.abs(g.intercept - 1) < 1e-12 && g.r2 === 1 && g.n === 4);
    g = K.linReg([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]); near(g.slope, 0.6); near(g.intercept, 2.2); near(g.r2, 0.6);   // 教科書範例
    g = K.linReg([1, 2, 3], [5, 5, 5]); assert.deepStrictEqual([g.slope, g.r2], [0, 1]);
    assert.strictEqual(K.linReg([1], [1]), null); assert.strictEqual(K.linReg([2, 2, 2], [1, 2, 3]), null); assert.strictEqual(K.linReg([], []), null);
    g = K.linReg([1, 2, 3, 4], [1, NaN, 3, 4]); assert.strictEqual(g.n, 3);   // 略過空值
    g = K.linReg([1, 2, 3, 4, 5, 6], [1, 5, 2, 8, 3, 9]); assert.ok(g.r2 >= 0 && g.r2 <= 1);
    // 移動平均
    assert.deepStrictEqual(K.movingAvg([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]); assert.deepStrictEqual(K.movingAvg([1, 2, 3, 4], 1), [1, 2, 3, 4]); assert.deepStrictEqual(K.movingAvg([1, null, 3, 4], 2), [null, null, null, 3.5]); assert.deepStrictEqual(K.movingAvg([1, 2], 5), [null, null]);
    assert.deepStrictEqual(K.movingAvg([2, 4, 6], 3), [null, null, 4]);
    // 趨勢模型與預測
    let tm = K.trendModel([3, 5, 7, 9], 2, 3);
    assert.deepStrictEqual(tm.fc.map(f => [f.i, Math.round(f.v * 1e9) / 1e9]), [[4, 11], [5, 13], [6, 15]]); assert.deepStrictEqual(tm.avg, [null, 4, 6, 8]); assert.strictEqual(tm.fit.length, 4); near(tm.fit[3], 9); assert.strictEqual(tm.reg.r2, 1);
    tm = K.trendModel([1, 2, 3], 99, 999); assert.strictEqual(tm.ma, 3); assert.strictEqual(tm.ahead, 100); assert.strictEqual(tm.fc.length, 100);   // 夾在上限內
    tm = K.trendModel([1, 2, 3], -2, -5); assert.strictEqual(tm.ma, 0); assert.strictEqual(tm.avg, null); assert.deepStrictEqual(tm.fc, []);
    tm = K.trendModel([1, 2, 3], NaN, NaN); assert.strictEqual(tm.ma, 0); assert.strictEqual(tm.ahead, 0);
    tm = K.trendModel([5], 3, 3); assert.strictEqual(tm.reg, null); assert.strictEqual(tm.fit, null); assert.deepStrictEqual(tm.fc, []); assert.strictEqual(tm.ma, 1);
    tm = K.trendModel([1, null, 3, 4], 0, 1); assert.strictEqual(tm.fit.length, 4); assert.strictEqual(tm.fc[0].i, 4);   // 空值位置仍佔一期
    tm = K.trendModel([], 3, 3); assert.strictEqual(tm.reg, null);
    const items = K.trendItems({ series: [{ name: '營收', vals: [3, 5, 7, 9] }] }, { ma: 2, fc: 1 }); assert.deepStrictEqual(items, ['營收', '趨勢線（R² = 1.000）', '2 期移動平均']);
    assert.deepStrictEqual(K.trendItems({ series: [{ name: 'a', vals: [1] }] }, { ma: 0, fc: 0 }), ['a', '趨勢線（資料點不足）']);
    // 型別與記住的選項
    for (const t of ['hist', 'box', 'trend']) { assert.ok(K.TYPES.includes(t)); assert.ok(K.TYPE_NAMES[t]); assert.strictEqual(K.normOpts({ type: t }).type, t); }
    assert.ok(K.TYPES.every(t => K.TYPE_NAMES[t])); assert.strictEqual(K.normOpts({ type: 'zzz' }).type, 'bar');
    ok('chart-maker 直方圖 / 盒鬚圖 / 趨勢線');
}
//__MORE__
