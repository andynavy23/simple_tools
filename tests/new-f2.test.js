// f2 批次：假資料表格（random-data）、浮點數視覺化（base-converter）、網址解析（url-parser）、Excel 公式速查（excel-formula）
const { load, ok } = require('./_load');
const assert = require('assert');

// ===== 1. random-data 假資料表格 =====
{
    const m = load('utils/random-data.html', 'TBL_TYPES, TBL_MAX_COLS, genValue, genTable, cleanCols, toCSV, toJSON, toJSONL, toMD, toSQL, formatTable, twIdSum, fakeTwId, fakeUbn, uuid4, validUuid4');
    const idv = load('utils/id-validator.html', 'twIdCheck, ubnCheck');
    const mk = (type, extra = {}) => ({ name: type, type, a: '', b: '', c: '', ...extra });
    const allTypes = Object.keys(m.TBL_TYPES);
    assert.equal(allTypes.length, 18);

    // 每種型別都能產生、型別正確
    const cols = allTypes.map(t => mk(t, t === 'date' ? { a: '2024-01-01', b: '2024-12-31' } : t === 'int' ? { a: '5', b: '9' } : t === 'float' ? { a: '1', b: '2', c: '3' } : t === 'enum' ? { a: 'x, y ,z' } : {}));
    const t = m.genTable(cols, 300, '');
    assert.equal(t.rows.length, 300); assert.equal(t.header.length, 18);
    const ix = Object.fromEntries(allTypes.map((k, i) => [k, i]));
    for (const row of t.rows) {
        assert.ok(m.validUuid4(row[ix.uuid]));
        assert.match(row[ix.name], /^[一-鿿]{2,3}$/);
        assert.match(row[ix.ename], /^[A-Z][a-z]+ [A-Z][a-z]+$/);
        assert.match(row[ix.mobile], /^09\d{8}$/);
        assert.match(row[ix.tel], /^0[2-7]-[2-9]\d{6,7}$/);
        assert.match(row[ix.email], /^[a-z][a-z0-9]{3,9}@example\.com$/);
        assert.match(row[ix.addr], /^(臺北市|新北市|桃園市|臺中市|臺南市|高雄市|新竹市|彰化縣)[一-鿿]+?(區|市|鎮)[一-鿿]+路([一二三四五]段)?\d+號(\d+樓)?$/, row[ix.addr]);
        assert.match(row[ix.twid], /^[A-Z][12]\d{8}$/);
        assert.match(row[ix.ubn], /^\d{8}$/);
        assert.match(row[ix.date], /^2024-\d{2}-\d{2}$/); assert.ok(row[ix.date] >= '2024-01-01' && row[ix.date] <= '2024-12-31');
        assert.ok(Number.isInteger(row[ix.int]) && row[ix.int] >= 5 && row[ix.int] <= 9);
        assert.ok(typeof row[ix.float] === 'number' && row[ix.float] >= 1 && row[ix.float] <= 2 && (String(row[ix.float]).split('.')[1] || '').length <= 3);
        assert.equal(typeof row[ix.bool], 'boolean');
        assert.ok(['x', 'y', 'z'].includes(row[ix.enum]));
        assert.match(row[ix.ip], /^(\d{1,3}\.){3}\d{1,3}$/); assert.ok(row[ix.ip].split('.').every(n => +n <= 255));
        assert.match(row[ix.color], /^#[0-9a-f]{6}$/);
        assert.match(row[ix.text], /^[一-鿿]+。$/);
    }
    assert.deepEqual(t.rows.map(r => r[ix.serial]), Array.from({ length: 300 }, (_, i) => i + 1));
    assert.match(m.genValue(mk('text', { a: 'en' }), Math.floor.bind(null, 0) && ((n) => 0), 0), /^[A-Z][a-z ]+\.$/);
    assert.deepEqual(m.genTable([mk('serial', { a: '100' })], 3).rows, [[100], [101], [102]]);
    assert.deepEqual(m.genTable([mk('serial', { a: 'abc' })], 2).rows, [[1], [2]], '壞起始值回預設');

    // 身分證 checksum 與 id-validator 同一演算法、統編也通過
    for (let i = 0; i < 2000; i++) {
        const id = m.fakeTwId(), r = idv.twIdCheck(id);
        assert.ok(r.valid && r.kind === 'citizen', id); assert.ok(m.twIdSum(id) % 10 === 0);
        const u = m.fakeUbn(), ur = idv.ubnCheck(u); assert.ok(ur.valid && ur.oldOk, u);
    }
    assert.ok(!idv.twIdCheck('A123456788').valid); assert.equal(m.twIdSum('A123456789'), 130, 'A123456789 是公認範例');

    // 同種子同輸出；不同種子不同；無種子每次不同
    const c5 = cols.slice(0, 6);
    assert.deepEqual(m.genTable(cols, 50, 'demo'), m.genTable(cols, 50, 'demo'));
    assert.notDeepEqual(m.genTable(cols, 50, 'demo'), m.genTable(cols, 50, 'demo2'));
    assert.notDeepEqual(m.genTable(c5, 20, ''), m.genTable(c5, 20, ''));
    assert.deepEqual(m.genTable(c5, 5, ' demo '), m.genTable(c5, 5, 'demo'), '種子會去空白');
    assert.deepEqual(m.genTable([mk('int', { a: '-1000000000', b: '1000000000' })], 20, 's'), m.genTable([mk('int', { a: '-1000000000', b: '1000000000' })], 20, 's'));

    // 錯誤處理
    assert.throws(() => m.genTable([], 5), /至少/);
    assert.throws(() => m.genTable(cols, 0), /列數/); assert.throws(() => m.genTable(cols, 10001), /列數/); assert.throws(() => m.genTable(cols, 'x'), /列數/);
    assert.equal(m.genTable([mk('bool')], 10000).rows.length, 10000);
    assert.throws(() => m.genTable([mk('date', { a: '2024-02-30', b: '2024-03-01' })], 1), /日期/);
    assert.throws(() => m.genTable([mk('date', { a: '2024-05-02', b: '2024-05-01' })], 1), /起日/);
    assert.throws(() => m.genTable([mk('date', { a: '', b: '' })], 1), /日期/);
    assert.throws(() => m.genTable([mk('int', { a: '9', b: '1' })], 1), /最小值/); assert.throws(() => m.genTable([mk('float', { a: '9', b: '1' })], 1), /最小值/);
    assert.equal(m.genTable([mk('date', { a: '2024-02-29', b: '2024-02-29' })], 1).rows[0][0], '2024-02-29');
    assert.ok(m.genTable([mk('int', { a: '', b: '' })], 50).rows.every(r => r[0] >= 1 && r[0] <= 100), '空值用預設 1–100');
    assert.ok(m.genTable([mk('int', { a: '1e12', b: '9e12' })], 5).rows.every(r => r[0] === 1e9), '超大範圍被夾到 ±1e9');
    assert.ok(['A', 'B', 'C'].includes(m.genTable([mk('enum', { a: ' , ,' })], 1).rows[0][0]), '空列舉預設 A,B,C');
    assert.ok(new Set(m.genTable([mk('enum', { a: '甲，乙\n丙' })], 200).rows.map(r => r[0])).size === 3, '全形逗號與換行也能分隔');
    assert.ok(m.genTable([mk('float', { a: '0', b: '0.999', c: '1' })], 500).rows.every(r => r[0] >= 0 && r[0] <= 0.999));
    assert.ok(m.genTable([mk('float', { a: '5', b: '5', c: '2' })], 3).rows.every(r => r[0] === 5));
    assert.throws(() => m.genValue({ name: 'x', type: 'nope' }, () => 0, 0), /型別/);

    // cleanCols：容錯、上限、重名
    assert.equal(m.cleanCols(null), null); assert.equal(m.cleanCols({}), null); assert.equal(m.cleanCols('x'), null);
    assert.deepEqual(m.cleanCols([]), []);
    const dirty = m.cleanCols([null, 5, { name: '  a  ', type: 'int', a: 3 }, { name: 'a', type: 'bogus' }, { type: 'bool' }, { name: 'a' }, { name: 'x'.repeat(100), type: 'uuid', a: 'y'.repeat(999) }]);
    assert.deepEqual(dirty.map(c => c.name), ['a', 'a_2', 'col3', 'a_3', 'x'.repeat(40)]);
    assert.equal(dirty[0].a, '3'); assert.equal(dirty[1].type, 'text'); assert.equal(dirty[4].a.length, 300);
    assert.equal(m.cleanCols(Array.from({ length: 80 }, () => ({ name: 'c', type: 'int' }))).length, m.TBL_MAX_COLS);
    assert.equal(m.TBL_MAX_COLS, 30);
    assert.equal(new Set(m.cleanCols(Array.from({ length: 30 }, () => ({ name: 'c' }))).map(c => c.name)).size, 30);

    // CSV 跳脫
    const T = { header: ['a,b', 'q"x', 'n'], rows: [['1,2', 'He said "hi"', 'line1\nline2'], [true, 3.5, ' pad ']] };
    assert.equal(m.toCSV(T), '"a,b","q""x",n\r\n"1,2","He said ""hi""","line1\nline2"\r\ntrue,3.5," pad "');
    // JSON / JSONL
    const j = JSON.parse(m.toJSON(T)); assert.deepEqual(j[1], { 'a,b': true, 'q"x': 3.5, n: ' pad ' });
    assert.equal(m.toJSONL(T).split('\n').length, 2); assert.deepEqual(JSON.parse(m.toJSONL(T).split('\n')[0]), j[0]);
    assert.equal(m.toJSON({ header: ['a'], rows: [] }), '[]'); assert.equal(m.toJSONL({ header: ['a'], rows: [] }), '');
    // Markdown
    assert.equal(m.toMD({ header: ['a|b', 'c'], rows: [['x|y', 'l1\nl2'], ['p\\q', 1]] }), '| a\\|b | c |\n| --- | --- |\n| x\\|y | l1<br>l2 |\n| p\\\\q | 1 |');
    // SQL 跳脫
    const S = { header: ['id', 'na`me', 'o"k', 'flag'], rows: [[1, "O'Brien \\ x", 'a', true], [2, 'b\nc', 'd', false]] };
    assert.equal(m.toSQL(S, 'users', 'mysql'), "INSERT INTO `users` (`id`, `na``me`, `o\"k`, `flag`) VALUES\n  (1, 'O''Brien \\\\ x', 'a', TRUE),\n  (2, 'b\nc', 'd', FALSE);");
    assert.equal(m.toSQL(S, 'my"t', 'pg'), "INSERT INTO \"my\"\"t\" (\"id\", \"na`me\", \"o\"\"k\", \"flag\") VALUES\n  (1, 'O''Brien \\ x', 'a', TRUE),\n  (2, 'b\nc', 'd', FALSE);");
    assert.ok(m.toSQL(S, 'u', 'sqlite').includes("'a', 1)") && m.toSQL(S, 'u', 'sqlite').includes("'d', 0)"));
    assert.ok(m.toSQL(S, '  ', 'pg').startsWith('INSERT INTO "data"'), '空表名預設 data');
    assert.equal(m.toSQL({ header: ['a'], rows: Array.from({ length: 250 }, (_, i) => [i]) }, 't').split('INSERT INTO').length - 1, 3, '每 100 列一個 INSERT');
    assert.equal(m.toSQL({ header: ['a'], rows: [] }, 't'), '');
    // formatTable 分派
    assert.equal(m.formatTable(T, 'csv'), m.toCSV(T)); assert.equal(m.formatTable(T, 'md'), m.toMD(T)); assert.equal(m.formatTable(T, 'sql', { table: 'z', dialect: 'pg' }), m.toSQL(T, 'z', 'pg')); assert.equal(m.formatTable(T, '???'), m.toCSV(T));
    // 端到端：預設欄位 + 種子 → SQL 可重現
    const d = [mk('serial'), mk('name'), mk('mobile'), mk('email')], a = m.formatTable(m.genTable(d, 3, 'demo'), 'sql', { table: 'users', dialect: 'mysql' });
    assert.equal(a, m.formatTable(m.genTable(d, 3, 'demo'), 'sql', { table: 'users', dialect: 'mysql' }));
    assert.ok(a.startsWith('INSERT INTO `users` (`serial`, `name`, `mobile`, `email`) VALUES'));
    ok('random-data 假資料表格');
}

// ===== 2. base-converter 浮點數視覺化 =====
{
    const m = load('utils/base-converter.html', 'floatParts, fpValue, fpDecode, flipBit, ratOfBits, ratOfDec, ratAdd, ratSub, ratStr, fpExact, fpError, fpParse, fpBoth, fpDemo, parseFloatText');
    const cases = [0, -0, 0.1, -0.1, 0.5, 1, -1, 3, 0.3, 1e-320, 5e-324, 2.2250738585072014e-308, 1.7976931348623157e308, 1e-40, 1.4e-45, 3.4028235e38, 1e39, 123456.789, Infinity, -Infinity, NaN, Math.PI, 2 ** 53, 2 ** -1074];
    for (const x of cases) for (const kind of [32, 64]) {
        const p = m.floatParts(x, kind), d = m.fpDecode(p.bits, kind);
        assert.equal(d.hex, p.hex, `${x} hex`); assert.ok(Object.is(d.value, p.back) || (Number.isNaN(d.value) && Number.isNaN(p.back)), `${x}/${kind} value`);
        assert.equal(d.expBits, p.exp); assert.equal(d.mantBits, p.mant); assert.equal(d.sign, +p.sign);
        // 精確展開：重新解析成 Number（四捨五入到最近）必須得到同一個值
        const ex = m.fpExact(p.bits, kind);
        if (Number.isFinite(p.back)) {
            if (kind === 64) assert.ok(Object.is(Number(ex), p.back), `${x} exact ${ex.slice(0, 30)}`);
            else assert.ok(Object.is(Math.fround(Number(ex)), p.back), `${x} f32 exact`);
        }
    }
    // 分類
    const cls = (x, k = 64) => m.fpDecode(m.floatParts(x, k).bits, k).cls;
    assert.equal(cls(1), 'normal'); assert.equal(cls(0), 'zero'); assert.equal(cls(-0), 'zero'); assert.equal(cls(5e-324), 'subnormal'); assert.equal(cls(2.2250738585072014e-308), 'normal'); assert.equal(cls(Infinity), 'inf'); assert.equal(cls(NaN), 'nan');
    assert.equal(cls(1e-40, 32), 'subnormal'); assert.equal(cls(1e-40, 64), 'normal'); assert.equal(cls(1e39, 32), 'inf');
    assert.equal(m.fpDecode(m.floatParts(1, 64).bits, 64).unbiased, 0); assert.equal(m.fpDecode(m.floatParts(8, 32).bits, 32).unbiased, 3); assert.equal(m.fpDecode(m.floatParts(5e-324, 64).bits, 64).unbiased, -1022); assert.equal(m.fpDecode(m.floatParts(0, 64).bits, 64).unbiased, null);
    assert.throws(() => m.fpDecode('101', 32), /位元數/); assert.throws(() => m.fpDecode('x'.repeat(32), 32)); assert.throws(() => m.fpDecode('0'.repeat(32), 16));
    // 隨機位元樣式與 DataView 一致（含 NaN payload）
    for (let i = 0; i < 2000; i++) {
        const kind = i % 2 ? 32 : 64, bits = Array.from({ length: kind }, () => Math.random() < 0.5 ? '1' : '0').join(''), d = m.fpDecode(bits, kind), dv = new DataView(new ArrayBuffer(8));
        if (kind === 32) dv.setUint32(0, parseInt(bits, 2)); else dv.setBigUint64(0, BigInt('0b' + bits));
        const v = kind === 32 ? dv.getFloat32(0) : dv.getFloat64(0);
        assert.ok(Object.is(v, d.value) || (Number.isNaN(v) && Number.isNaN(d.value)));
        if (Number.isFinite(v) && v !== 0) { const ex = m.fpExact(bits, kind); assert.ok(Object.is(kind === 32 ? Math.fround(Number(ex)) : Number(ex), v), ex); }
    }
    // 精確十進位展開（已知值）
    assert.equal(m.fpExact(m.floatParts(0.1, 64).bits, 64), '0.1000000000000000055511151231257827021181583404541015625');
    assert.equal(m.fpExact(m.floatParts(0.1, 32).bits, 32), '0.100000001490116119384765625');
    assert.equal(m.fpExact(m.floatParts(0.5, 64).bits, 64), '0.5'); assert.equal(m.fpExact(m.floatParts(-3, 32).bits, 32), '-3'); assert.equal(m.fpExact(m.floatParts(2 ** 70, 64).bits, 64), '1180591620717411303424');
    assert.equal(m.fpExact(m.floatParts(-0, 64).bits, 64), '-0'); assert.equal(m.fpExact(m.floatParts(0, 32).bits, 32), '0'); assert.equal(m.fpExact(m.floatParts(NaN, 64).bits, 64), 'NaN'); assert.equal(m.fpExact(m.floatParts(-Infinity, 32).bits, 32), '-Infinity');
    assert.equal(m.fpExact(m.floatParts(0.3, 64).bits, 64), '0.299999999999999988897769753748434595763683319091796875');
    assert.equal(m.fpExact(m.floatParts(1.401298464324817e-45, 32).bits, 32).length, 2 + 149, 'float32 最小次正規數 2^-149 有 149 位小數');
    assert.equal(m.fpExact(m.floatParts(5e-324, 64).bits, 64).length, 2 + 1074, 'float64 最小次正規數 2^-1074 有 1074 位小數');
    assert.ok(m.fpExact(m.floatParts(5e-324, 64).bits, 64).startsWith('0.000000000000000000000000000000000000000000000000000000000000'));
    // 翻轉位元
    const b1 = m.floatParts(1, 64).bits;
    assert.equal(m.fpDecode(m.flipBit(b1, 0), 64).value, -1); assert.equal(m.fpDecode(m.flipBit(b1, 63), 64).value, 1 + 2 ** -52); assert.equal(m.fpDecode(m.flipBit(b1, 1), 64).cls, 'inf');
    assert.equal(m.flipBit(m.flipBit(b1, 17), 17), b1);
    assert.equal(m.fpDecode(m.flipBit(m.floatParts(1, 32).bits, 1), 32).cls, 'inf', '1.0 的指數最高位翻成 1 → 指數全 1');
    assert.equal(m.fpDecode('0' + '1'.repeat(8) + '0'.repeat(23), 32).cls, 'inf'); assert.equal(m.fpDecode(m.flipBit('0' + '1'.repeat(8) + '0'.repeat(23), 31), 32).cls, 'nan');
    assert.throws(() => m.flipBit('0101', 4)); assert.throws(() => m.flipBit('0101', -1)); assert.throws(() => m.flipBit('0101', 1.5));
    // 有理數
    assert.equal(m.ratStr(m.ratOfDec('0.1')), '0.1'); assert.equal(m.ratStr(m.ratOfDec('-3.50e1')), '-35'); assert.equal(m.ratStr(m.ratOfDec('1e3')), '1000'); assert.equal(m.ratStr(m.ratOfDec('.5')), '0.5'); assert.equal(m.ratStr(m.ratOfDec('5.')), '5'); assert.equal(m.ratStr(m.ratOfDec('-0')), '0');
    assert.equal(m.ratStr(m.ratOfDec('1e-3')), '0.001');
    for (const bad of ['', '.', 'abc', '1e', '1e99999', '--1', '0x1', '1 2']) assert.equal(m.ratOfDec(bad), null, bad);
    assert.equal(m.ratStr(m.ratAdd(m.ratOfDec('0.1'), m.ratOfDec('0.25'))), '0.35'); assert.equal(m.ratStr(m.ratSub(m.ratOfDec('0.1'), m.ratOfDec('0.1'))), '0'); assert.equal(m.ratStr(m.ratSub(m.ratOfDec('1'), m.ratOfDec('1.5'))), '-0.5');
    assert.equal(m.ratOfBits(m.floatParts(Infinity, 64).bits, 64), null); assert.equal(m.ratOfBits(m.floatParts(NaN, 32).bits, 32), null);
    // 誤差
    assert.equal(m.fpError('0.5', m.floatParts(0.5, 64).bits, 64), '0'); assert.equal(m.fpError('0.1', m.floatParts(0.1, 64).bits, 64), '0.0000000000000000055511151231257827021181583404541015625');
    assert.equal(m.fpError('0.1', m.floatParts(0.1, 32).bits, 32), '0.000000001490116119384765625'); assert.ok(m.fpError('0.3', m.floatParts(0.3, 64).bits, 64).startsWith('-0.0000000000000000111'));
    assert.equal(m.fpError('NaN', m.floatParts(NaN, 64).bits, 64), null); assert.equal(m.fpError('1e400', m.floatParts(1e400, 64).bits, 64), null);
    // 輸入解析
    assert.ok(Object.is(m.fpParse('-0').x, -0) && m.fpParse('-0').kind === null); assert.ok(Number.isNaN(m.fpParse('NaN').x)); assert.equal(m.fpParse('-inf').x, -Infinity); assert.equal(m.fpParse('1e-3').x, 0.001);
    assert.equal(m.fpParse('0x3fb999999999999a').kind, 64); assert.equal(m.fpParse('0x3fb999999999999a').x, 0.1); assert.equal(m.fpParse('0x3dcccccd').kind, 32); assert.equal(m.fpParse('0x3dcccccd').x, Math.fround(0.1));
    assert.equal(m.fpParse('0x1').kind, 32); assert.equal(m.fpParse('0x1').bits, '0'.repeat(31) + '1'); assert.equal(m.fpParse('0x1FFFFFFFF').kind, 64); assert.equal(m.fpParse('0x7FF0000000000000').x, Infinity);
    for (const bad of ['', 'abc', '0x', '0xg', '0x12345678901234567', '1.2.3', '1,5']) assert.equal(m.fpParse(bad), null, bad);
    // fpBoth：另一精度由數值轉換
    const bo = m.fpBoth(m.fpParse('0x3dcccccd')); assert.equal(bo[32], m.floatParts(Math.fround(0.1), 32).bits); assert.equal(bo[64], m.floatParts(Math.fround(0.1), 64).bits);
    const b2 = m.fpBoth(m.fpParse('0.1')); assert.equal(b2[32], m.floatParts(0.1, 32).bits); assert.equal(b2[64], m.floatParts(0.1, 64).bits);
    const nanPayload = '0x7ff0000000000001'; assert.equal(m.fpBoth(m.fpParse(nanPayload))[64], '0' + '1'.repeat(11) + '0'.repeat(51) + '1', 'NaN payload 保留');
    // 0.1 + 0.2
    const dm = m.fpDemo(0.1, 0.2, 0.3);
    assert.equal(dm.exactSum, '0.3000000000000000166533453693773481063544750213623046875'); assert.equal(dm.sumShort, '0.30000000000000004'); assert.equal(dm.equal, false);
    assert.equal(dm.hexSum, '0x3fd3333333333334'); assert.equal(dm.hexZ, '0x3fd3333333333333'); assert.equal(dm.gap, '0.000000000000000055511151231257827021181583404541015625'); assert.equal(dm.roundErr, '0.0000000000000000277555756156289135105907917022705078125');
    assert.equal(m.fpDemo(0.5, 0.25, 0.75).equal, true); assert.equal(m.fpDemo(0.5, 0.25, 0.75).roundErr, '0'); assert.equal(m.fpDemo(1e308, 1e308, 1), null);
    for (let i = 0; i < 300; i++) { const x = Math.random() * 100, y = Math.random() * 100, r = m.fpDemo(x, y, x + y); assert.equal(r.equal, true); assert.equal(r.gap, '0'); assert.equal(Number(r.sum), x + y); }
    ok('base-converter 浮點數視覺化');
}

// ===== 3. url-parser =====
{
    const m = load('utils/encode-decode.html', 'decodeSafe, decodeOk, isTracking, doubleEncoded, parseQuery, hashQuery, pathSegments, parseUrl, asciiHost, punyDecode, unicodeHost, hostInfo, buildUrl, stripTracking, countTracking, checkUrl, extractParam');
    const rt = (u, o) => m.buildUrl(m.parseUrl(u), o);
    // 往返（沒改任何東西：原樣）
    for (const u of [
        'https://example.com/', 'https://example.com', 'http://a.com/p/q?x=1&y=2#top', 'https://u:p@host.com:8080/a%20b/c?x=%E4%BD%A0&y=a+b&z=#h',
        'https://a.com/?a=1&a=2&b=3&a=0', 'https://a.com/?flag&k=&k2=v', 'https://[::1]:3000/x?y=1', 'https://[2001:db8::1]/', 'ftp://files.example.org/pub/file.tar.gz',
        'mailto:foo@bar.com?subject=Hello%20World', '/rel/path?x=1#f', '?only=query', '#frag', '../up/one?q=1', '//cdn.example.com/lib.js?v=3', 'https://a.com/a;b=c/d?e=f&g=h#i=j&k=l',
        'https://例子.測試/路徑?名=值', 'https://a.com/?q=%2520x&r=%zz', 'https://a.com:80', 'file:///C:/dir/f.txt', 'https://a.com/?a=b=c&d==',
    ]) assert.equal(rt(u), u, u);
    // 整理掉的東西
    assert.equal(rt('https://a.com/?'), 'https://a.com/'); assert.equal(rt('https://a.com/#'), 'https://a.com/'); assert.equal(rt('https://a.com/?a=1&&b=2&'), 'https://a.com/?a=1&b=2');
    assert.equal(rt('  https://a.com/x  '), 'https://a.com/x', '前後空白');

    // 拆解
    let p = m.parseUrl('https://user:p%40ss@Example.COM:8080/a%20b/c/?q=%E4%BD%A0%E5%A5%BD&q=2&t=a+b&e=&f#sec=2&x=1');
    assert.equal(p.scheme, 'https'); assert.equal(p.user, 'user'); assert.equal(p.pass, 'p%40ss'); assert.equal(p.host, 'Example.COM'); assert.equal(p.port, '8080'); assert.equal(p.path, '/a%20b/c/'); assert.equal(p.hash, 'sec=2&x=1');
    assert.deepEqual(p.query.map(x => [x.k, x.v, x.eq]), [['q', '你好', true], ['q', '2', true], ['t', 'a b', true], ['e', '', true], ['f', '', false]]);
    assert.equal(p.assumed, false); assert.equal(p.relative, false); assert.deepEqual(p.warns, []);
    assert.equal(m.parseUrl('https://a.com/').query, null); assert.equal(m.parseUrl('https://a.com/').hash, null);
    p = m.parseUrl('https://u@h.com/'); assert.equal(p.user, 'u'); assert.equal(p.pass, '');
    p = m.parseUrl('https://a@b@c.com/'); assert.equal(p.user, 'a@b'); assert.equal(p.host, 'c.com');
    assert.equal(m.parseUrl(''), null); assert.equal(m.parseUrl('   '), null); assert.equal(m.parseUrl(null), null); assert.equal(m.parseUrl(undefined), null);
    // 無協定 / 相對 / host:port
    p = m.parseUrl('example.com/a?b=1'); assert.ok(p.assumed); assert.equal(p.scheme, 'https'); assert.equal(p.host, 'example.com'); assert.equal(p.path, '/a');
    p = m.parseUrl('localhost:3000/x'); assert.ok(p.assumed); assert.equal(p.host, 'localhost'); assert.equal(p.port, '3000');
    p = m.parseUrl('192.168.1.1:8080'); assert.ok(p.assumed); assert.equal(p.host, '192.168.1.1'); assert.equal(p.port, '8080');
    p = m.parseUrl('[::1]:8080/x'); assert.ok(p.assumed); assert.equal(p.host, '[::1]'); assert.equal(p.port, '8080');
    p = m.parseUrl('user@example.com/x'); assert.ok(p.assumed); assert.equal(p.user, 'user');
    for (const r of ['/a/b?c=1', './x', '../x', '?q=1', '#h']) { p = m.parseUrl(r); assert.ok(p.relative, r); assert.equal(p.scheme, ''); assert.equal(p.assumed, false); assert.equal(p.hasAuth, false); }
    assert.equal(m.parseUrl('/a/b?c=1').path, '/a/b'); assert.equal(m.parseUrl('?q=1').path, ''); assert.equal(m.parseUrl('#h').hash, 'h');
    p = m.parseUrl('//cdn.x.com/a'); assert.ok(!p.relative); assert.equal(p.scheme, ''); assert.equal(p.host, 'cdn.x.com');
    p = m.parseUrl('mailto:a@b.com?subject=hi'); assert.equal(p.scheme, 'mailto'); assert.equal(p.hasAuth, false); assert.equal(p.path, 'a@b.com'); assert.equal(p.query[0].v, 'hi');
    // 警告
    assert.ok(m.parseUrl('https://a.com:99999/').warns[0].includes('埠')); assert.ok(m.parseUrl('https://a.com:abc/').warns[0].includes('埠')); assert.ok(m.parseUrl('https:///x').warns.some(w => w.includes('主機')));
    assert.ok(m.parseUrl('https://a.com/a b').warns.some(w => w.includes('空白'))); assert.deepEqual(m.parseUrl('https://a.com:65535/').warns, []); assert.deepEqual(m.parseUrl('https://a.com:/').warns, []);
    // IPv6
    p = m.parseUrl('http://[2001:db8::1]:8080/p?x=1'); assert.equal(p.host, '[2001:db8::1]'); assert.equal(p.port, '8080'); assert.equal(m.hostInfo(p.host).kind, 'ipv6'); assert.equal(m.hostInfo('[::1]').ascii, '[::1]');
    assert.equal(m.hostInfo('1.2.3.4').kind, 'ipv4'); assert.equal(m.hostInfo('a.com').kind, 'domain'); assert.equal(m.hostInfo('').kind, 'empty'); assert.equal(m.hostInfo('a.com').idn, false);
    // 中文網域 / punycode，與 URL 物件一致
    for (const h of ['中文.tw', '台灣.tw', 'bücher.de', '例え.jp', '測試.example.com', 'münchen.de']) {
        const ascii = new URL('http://' + h).hostname, info = m.hostInfo(h);
        assert.ok(ascii.includes('xn--'), h); assert.equal(info.ascii, ascii); assert.equal(info.unicode, h.toLowerCase()); assert.ok(info.idn); assert.equal(m.unicodeHost(ascii), h.toLowerCase());
    }
    assert.equal(m.hostInfo('中文.tw').ascii, 'xn--fiq228c.tw'); assert.equal(m.hostInfo('xn--fiq228c.tw').unicode, '中文.tw');
    assert.equal(m.unicodeHost('xn--@@.com'), 'xn--@@.com', '壞 punycode 原樣');
    assert.equal(m.buildUrl(m.parseUrl('https://中文.tw/a'), { puny: true }), 'https://xn--fiq228c.tw/a'); assert.equal(m.buildUrl(m.parseUrl('https://[::1]/a'), { puny: true }), 'https://[::1]/a');
    // 路徑逐段
    assert.deepEqual(m.pathSegments('/a%20b/c/%E4%BD%A0'), [{ raw: 'a%20b', dec: 'a b' }, { raw: 'c', dec: 'c' }, { raw: '%E4%BD%A0', dec: '你' }]); assert.deepEqual(m.pathSegments('/'), [{ raw: '', dec: '' }]); assert.deepEqual(m.pathSegments(''), [{ raw: '', dec: '' }]); assert.equal(m.pathSegments('rel/x').length, 2);
    assert.equal(m.pathSegments('/%E4%BD')[0].dec, '%E4%BD', '壞編碼保留原文'); assert.equal(m.pathSegments('/a+b')[0].dec, 'a+b', '路徑的 + 不是空白');
    // query：重複鍵順序、特殊字元
    assert.deepEqual(m.parseQuery('a=1&b=2&a=3').map(x => x.k + x.v), ['a1', 'b2', 'a3']);
    assert.deepEqual(m.parseQuery('a=%26%3D%23%3F&b=%2B&c=1+2').map(x => x.v), ['&=#?', '+', '1 2']); assert.deepEqual(m.parseQuery('a=1+2', false).map(x => x.v), ['1+2']);
    assert.deepEqual(m.parseQuery('k=v=w').map(x => [x.k, x.v]), [['k', 'v=w']]); assert.deepEqual(m.parseQuery('=v').map(x => [x.k, x.v]), [['', 'v']]); assert.deepEqual(m.parseQuery(''), []); assert.deepEqual(m.parseQuery(null), []);
    assert.deepEqual(m.parseQuery('a=%E4%BD%A0%E5%A5%BD&%E9%8D%B5=%F0%9F%98%80').map(x => [x.k, x.v]), [['a', '你好'], ['鍵', '😀']]);
    assert.deepEqual(m.parseQuery('a=%zz&b=%E4').map(x => x.v), ['%zz', '%E4'], '壞 % 序列保留原文');
    assert.equal(m.decodeOk('%zz'), false); assert.equal(m.decodeOk('%41'), true); assert.equal(m.decodeSafe('%41+%42'), 'A B'); assert.equal(m.decodeSafe('%41+%42', false), 'A+B');
    // 編輯後重組：改過的才重新編碼
    p = m.parseUrl('https://a.com/?keep=a%20b&edit=1&plus=a+b'); p.query[1].v = '你 好&='; delete p.query[1].rv;
    assert.equal(m.buildUrl(p), 'https://a.com/?keep=a%20b&edit=%E4%BD%A0%20%E5%A5%BD%26%3D&plus=a+b');
    assert.equal(m.buildUrl(p, { enc: 'component' }), 'https://a.com/?keep=a%20b&edit=%E4%BD%A0%20%E5%A5%BD%26%3D&plus=a%20b');
    assert.equal(m.buildUrl(p, { enc: 'form' }), 'https://a.com/?keep=a+b&edit=%E4%BD%A0+%E5%A5%BD%26%3D&plus=a+b');
    p = m.parseUrl('https://a.com/?q=a+b%2Bc'); assert.equal(p.query[0].v, 'a b+c'); assert.equal(m.buildUrl(p, { enc: 'form' }), 'https://a.com/?q=a+b%2Bc'); assert.equal(m.buildUrl(p, { enc: 'component' }), 'https://a.com/?q=a%20b%2Bc');
    // 解碼後再編碼的往返：任意字串
    for (const s of ['', 'a b', '你好', '&=#?%+/', "it's (ok)!*~", '😀', 'a\nb', '%41', '100%']) for (const enc of ['component', 'form']) {
        const u = m.buildUrl({ scheme: 'https', hasAuth: true, user: '', pass: '', host: 'a.com', port: '', path: '/', query: [{ k: s + 'k', v: s, eq: true }], hash: null }, { enc });
        const back = m.parseUrl(u).query[0]; assert.equal(back.v, s, `${JSON.stringify(s)} ${enc}`); assert.equal(back.k, s + 'k'); assert.ok(new URL(u).searchParams.get(s + 'k') === s, 'URLSearchParams 也讀得回來');
    }
    // 新增 / 刪除 / 空值
    p = m.parseUrl('https://a.com/?a=1&b=&c&d=4');
    assert.equal(m.buildUrl(p), 'https://a.com/?a=1&b=&c&d=4'); assert.equal(m.buildUrl(p, { empty: 'drop' }), 'https://a.com/?a=1&d=4'); assert.equal(m.buildUrl(p, { empty: 'bare' }), 'https://a.com/?a=1&b&c&d=4');
    assert.equal(m.buildUrl(p, { enc: 'component', empty: 'keep' }), 'https://a.com/?a=1&b=&c&d=4');
    p.query.push({ k: 'new key', v: 'x y', eq: true }); assert.equal(m.buildUrl(p, { enc: 'component' }), 'https://a.com/?a=1&b=&c&d=4&new%20key=x%20y'); p.query.splice(0, 3); assert.equal(m.buildUrl(p), 'https://a.com/?d=4&new%20key=x%20y');
    p.query = []; assert.equal(m.buildUrl(p), 'https://a.com/');
    // 排序：穩定，重複鍵維持相對順序
    p = m.parseUrl('https://a.com/?b=2&a=3&b=1&a=1&c=0'); assert.equal(m.buildUrl(p, { sort: true }), 'https://a.com/?a=3&a=1&b=2&b=1&c=0'); assert.equal(m.buildUrl(p), 'https://a.com/?b=2&a=3&b=1&a=1&c=0', '不排序時順序不變');
    assert.equal(m.buildUrl(m.parseUrl('https://a.com/?B=1&a=2'), { sort: true }), 'https://a.com/?B=1&a=2', '依字元碼排序，大寫在前');
    // 追蹤參數
    for (const k of ['utm_source', 'UTM_Medium', 'utm_', 'fbclid', 'gclid', 'msclkid', 'igshid', 'mc_cid', '_ga', 'ttclid']) assert.ok(m.isTracking(k), k);
    for (const k of ['id', 'q', 'utm', 'xutm_source', 'ref', 'page', 'fbclid2', '']) assert.ok(!m.isTracking(k), k);
    p = m.parseUrl('https://a.com/p?utm_source=x&id=7&fbclid=abc&utm_campaign=y&q=%E4%BD%A0#h'); assert.equal(m.countTracking(p), 3);
    assert.equal(m.buildUrl(m.stripTracking(p)), 'https://a.com/p?id=7&q=%E4%BD%A0#h'); assert.equal(m.buildUrl(p), 'https://a.com/p?utm_source=x&id=7&fbclid=abc&utm_campaign=y&q=%E4%BD%A0#h', '不改動原物件');
    assert.equal(m.countTracking(m.parseUrl('https://a.com/')), 0); assert.equal(m.buildUrl(m.stripTracking(m.parseUrl('https://a.com/?utm_a=1'))), 'https://a.com/');
    // 雙重編碼
    assert.ok(m.doubleEncoded('%2520')); assert.ok(m.doubleEncoded('a%252Fb')); assert.ok(!m.doubleEncoded('%20')); assert.ok(!m.doubleEncoded('100%25'));
    p = m.parseUrl('https://a.com/?q=%2520x'); assert.equal(p.query[0].v, '%20x'); assert.equal(m.decodeSafe(p.query[0].v, false), ' x');
    // hash
    assert.deepEqual(m.hashQuery('a=1&b=2').pairs.map(x => x.k + x.v), ['a1', 'b2']); assert.equal(m.hashQuery('/home?tab=2').route, '/home'); assert.equal(m.hashQuery('/home?tab=2').pairs[0].v, '2'); assert.equal(m.hashQuery('!/x?y=1').route, '!/x');
    assert.equal(m.hashQuery('top'), null); assert.equal(m.hashQuery('/home'), null); assert.equal(m.hashQuery(''), null); assert.equal(m.hashQuery(null), null); assert.equal(m.hashQuery('=x'), null);
    assert.equal(m.hashQuery('access_token=abc&token_type=bearer').pairs[1].v, 'bearer');
    // checkUrl
    assert.ok(m.checkUrl('https://a.com/x').ok); assert.ok(!m.checkUrl('https://').ok); assert.ok(!m.checkUrl('http://[::1').ok); assert.ok(!m.checkUrl('https://a.com:99999/').ok); assert.ok(m.checkUrl('/rel?x=1', true).ok); assert.ok(!m.checkUrl('/rel', false).ok); assert.ok(m.checkUrl('//h.com/x', true).ok);
    assert.equal(m.checkUrl('HTTPS://A.com').href, 'https://a.com/');
    // 非法 / 怪輸入不丟例外
    for (const bad of ['http://', 'https://:80', ':::', '%%%', 'http://[', '\u0000', 'a'.repeat(5000), 'https://a.com/?' + '&'.repeat(1000), '://x', 'javascript:alert(1)', 'data:text/plain,hi']) { const q = m.parseUrl(bad); if (q) { m.buildUrl(q); m.checkUrl(m.buildUrl(q), q.relative); m.hostInfo(q.host); m.pathSegments(q.path); } }
    assert.equal(m.parseUrl('javascript:alert(1)').scheme, 'javascript');
    // 批次抽取
    const rows = m.extractParam('https://a.com/?id=1&x=2\nhttps://b.com/?id=3&id=4 https://c.com/?y=1\n/rel?id=%E4%BD%A0#id=5&z=1\nhttps://d.com/#section', 'id');
    assert.deepEqual(rows.map(r => r.values), [['1'], ['3', '4'], [], ['你', '5'], []]); assert.equal(rows[1].url, 'https://b.com/?id=3&id=4');
    assert.deepEqual(m.extractParam('', 'id'), []); assert.deepEqual(m.extractParam('https://a.com/?ID=1', 'id')[0].values, [], '鍵名區分大小寫'); assert.deepEqual(m.extractParam('a.com/?id=9', 'id')[0].values, ['9'], '沒有協定也能抽');
    ok('url-parser');
}

// ===== 4. excel-formula =====
{
    const m = load('utils/excel-formula.html', 'XL, XL_CATS, XL_BY_ID, evalFormula, showVal, XlErr, searchFns, GUIDE, guideFor, exShow, ymdOf, serialOf, fmtText, parse, tokenize, T_SALES, T_PROD, T_SCORE');
    const ev = (f, t) => m.showVal(m.evalFormula(f, t));
    const iso = (s) => { const d = m.ymdOf(s); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; };

    // 資料完整性：≥ 60 個、id 不重複、每筆都有語法 / 說明 / 範例 / 錯誤 / Google / 版本
    assert.ok(m.XL.length >= 60, `收錄 ${m.XL.length} 個`);
    assert.equal(new Set(m.XL.map(x => x.id)).size, m.XL.length, 'id 不重複');
    for (const x of m.XL) {
        assert.match(x.id, /^[A-Z]+$/, x.id); assert.ok(m.XL_CATS[x.cat], x.id + ' cat');
        assert.ok(x.syn && x.syn.includes('('), x.id + ' 語法'); assert.ok(x.desc && x.desc.length >= 6, x.id + ' 說明'); assert.ok(x.gs && x.gs.length > 4, x.id + ' gs'); assert.ok(x.ver && x.ver.length > 3, x.id + ' ver'); assert.ok(x.kw && x.kw.length > 2, x.id + ' kw');
        assert.ok(x.ex.f.startsWith('='), x.id + ' 範例公式'); assert.ok(x.ex.r !== undefined && x.ex.r !== '', x.id + ' 範例結果');
        assert.ok(Array.isArray(x.errs) && x.errs.length >= 1 && x.errs.every(e => e.length === 2 && e[0] && e[1]), x.id + ' 常見錯誤');
        if (x.ex.tbl) assert.ok(Array.isArray(x.ex.tbl) && x.ex.tbl.length >= 2 && x.ex.tbl.every(Array.isArray), x.id + ' tbl');
        if (x.id !== 'INDEXMATCH') assert.ok(x.syn.toUpperCase().startsWith(x.id + '('), x.id + ' 語法開頭');
        assert.ok(x.ex.f.toUpperCase().includes(x.id === 'INDEXMATCH' ? 'MATCH(' : x.id + '('), x.id + ' 範例要用到自己');
    }
    for (const c of Object.keys(m.XL_CATS)) assert.ok(m.XL.filter(x => x.cat === c).length >= 5, c + ' 每類至少 5 個');
    for (const id of ['VLOOKUP', 'XLOOKUP', 'INDEXMATCH', 'SUMIFS', 'COUNTIFS', 'IF', 'IFS', 'IFERROR', 'TEXT', 'TEXTJOIN', 'FILTER', 'UNIQUE', 'SORT', 'LET', 'DATEDIF', 'EOMONTH', 'NETWORKDAYS', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'LEFT', 'MID', 'RIGHT', 'SUBSTITUTE', 'TRIM', 'CONCAT']) assert.ok(m.XL_BY_ID[id], '缺 ' + id);
    assert.ok(/365|2021/.test(m.XL_BY_ID.XLOOKUP.ver), 'XLOOKUP 需 365 / 2021'); assert.ok(/2019/.test(m.XL_BY_ID.IFS.ver)); assert.ok(/兩個/.test(m.XL_BY_ID.CONCAT.gs), 'Google CONCAT 差異');

    // 每個範例的結果都要和求值器算出來的一致（TODAY / NOW 每天不同，另外檢查）
    let checked = 0;
    for (const x of m.XL) {
        if (x.id === 'TODAY' || x.id === 'NOW') continue;
        const got = m.evalFormula(x.ex.f, x.ex.tbl); assert.ok(!(got instanceof m.XlErr) || String(x.ex.r).startsWith('#'), `${x.id} 範例算出錯誤 ${got.code}`);
        const want = m.exShow(x.ex.r), have = x.ex.fmt === 'date' ? iso(got) : m.showVal(got);
        assert.deepEqual(have, want, `${x.id} ${x.ex.f}`); checked++;
    }
    assert.equal(checked, m.XL.length - 2);
    assert.equal(ev('=TODAY()-TODAY()'), '0'); assert.ok(Math.abs(m.evalFormula('=TODAY()') - m.serialOf(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())) <= 1); assert.ok(m.evalFormula('=NOW()') >= m.evalFormula('=TODAY()'));

    // 求值器本身：運算子優先順序與型別
    for (const [f, r] of [['=1+2*3', '7'], ['=(1+2)*3', '9'], ['=2^3^2', '64'], ['=-2^2', '4'], ['=10-4-3', '3'], ['=10/4', '2.5'], ['=50%', '0.5'], ['=200*10%', '20'], ['="a"&"b"&1', 'ab1'], ['=1&2', '12'], ['=1+1=2', 'TRUE'], ['="a"="A"', 'TRUE'], ['=1<2', 'TRUE'], ['=2<=1', 'FALSE'], ['="a"<>"b"', 'TRUE'], ['="10"+5', '15'], ['=TRUE+1', '2'], ['=0.1+0.2', '0.3'], ['=0.1+0.2=0.3', 'TRUE'], ['="abc"<"abd"', 'TRUE'], ['=1<"a"', 'TRUE'], ['="""q"""', '"q"'], ['=  1 +  2 ', '3'], ['=1E3', '1000'], ['=.5+.5', '1']]) assert.equal(ev(f), r, f);
    for (const [f, r] of [['=1/0', '#DIV/0!'], ['="a"+1', '#VALUE!'], ['=NOPE(1)', '#NAME?'], ['=x+1', '#NAME?'], ['=VLOOKUP(1,A1:A2,5,FALSE)', '#REF!'], ['=MOD(5,0)', '#DIV/0!'], ['=SMALL(A1:A2,9)', '#NUM!'], ['=MID("abc",0,1)', '#VALUE!'], ['=FIND("z","abc")', '#VALUE!'], ['=AVERAGE(A1:A2)', '#DIV/0!']]) assert.equal(ev(f, [[null], [null]]), r, f);
    for (const bad of ['1+2', '=1+', '=(1', '=SUM(1', '=1 2', '="abc', '=#', '=1+)']) assert.throws(() => m.evalFormula(bad), bad);
    // 邏輯函式只算用到的分支（IF 不會因為沒選到的分支出錯）
    assert.equal(ev('=IF(TRUE,1,1/0)'), '1'); assert.equal(ev('=IF(FALSE,1/0,2)'), '2'); assert.equal(ev('=IF(FALSE,1)'), 'FALSE'); assert.equal(ev('=IFERROR(1/0,"x")'), 'x'); assert.equal(ev('=IFERROR(5,"x")'), '5'); assert.equal(ev('=IFNA(1/0,"x")'), '#DIV/0!'); assert.equal(ev('=IFNA(NA_(),"x")'), '#NAME?');
    assert.equal(ev('=IFS(FALSE,1,TRUE,2)'), '2'); assert.equal(ev('=IFS(FALSE,1)'), '#N/A'); assert.equal(ev('=SWITCH(3,1,"a",2,"b","other")'), 'other'); assert.equal(ev('=SWITCH(3,1,"a")'), '#N/A'); assert.equal(ev('=SWITCH("X","x","hit")'), 'hit');
    assert.equal(ev('=AND(TRUE,FALSE)'), 'FALSE'); assert.equal(ev('=OR(FALSE,FALSE,TRUE)'), 'TRUE'); assert.equal(ev('=NOT(FALSE)'), 'TRUE'); assert.equal(ev('=AND(A1:A3)', [[true], [true], [false]]), 'FALSE'); assert.equal(ev('=OR(A1:A3)', [[0], [0], ['x']]), 'FALSE', '範圍內的文字被略過');
    assert.equal(ev('=ISNUMBER("1")'), 'FALSE'); assert.equal(ev('=ISNUMBER(1)'), 'TRUE'); assert.equal(ev('=ISBLANK(A1)', [[null]]), 'TRUE'); assert.equal(ev('=ISBLANK(A1)', [['']]), 'FALSE');
    // 條件加總：運算子、萬用字元、空白
    const S = m.T_SALES;
    for (const [f, r] of [['=SUMIF(D2:D6,">=200")', '750'], ['=SUMIF(D2:D6,">200")', '550'], ['=SUMIF(D2:D6,"<=150")', '250'], ['=SUMIF(A2:A6,"小*",D2:D6)', '1000'], ['=SUMIF(A2:A6,"小?",D2:D6)', '1000'], ['=SUMIF(A2:A6,"<>小明",D2:D6)', '750'], ['=SUMIF(C2:C6,"a",D2:D6)', '400'], ['=SUMIF(D2:D6,150)', '150'], ['=COUNTIF(B2:B6,"北")', '3'], ['=COUNTIF(D2:D6,"<>100")', '4'], ['=COUNTIFS(A2:A6,"小華",B2:B6,"北")', '1'], ['=COUNTIF(B2:B6,"*")', '5'], ['=COUNTIF(B2:B6,"西")', '0'], ['=SUMIFS(D2:D6,C2:C6,"B",D2:D6,">150")', '450'], ['=AVERAGEIF(B2:B6,"西",D2:D6)', '#DIV/0!'], ['=MAXIFS(D2:D6,B2:B6,"西")', '0'], ['=SUMPRODUCT((B2:B6="北")*(D2:D6))', '650'], ['=SUMPRODUCT((B2:B6="北")*(C2:C6="A")*(D2:D6))', '400'], ['=SUMPRODUCT(D2:D6)', '1000'], ['=SUMPRODUCT(D2:D6,D2:D4)', '#VALUE!'], ['=COUNTIFS(B2:B6,"北",D2:D5,">0")', '#VALUE!']]) assert.equal(ev(f, S), r, f);
    assert.equal(ev('=COUNTIF(A1:A5,"")', [[1], [null], [''], [2], [null]]), '3', '"" 條件數空白'); assert.equal(ev('=COUNTIF(A1:A3,"=")', [[1], [null], [2]]), '1'); assert.equal(ev('=COUNTIF(A1:A3,">1")', [['5'], [2], [null]]), '1', '文字 "5" 不算數字');
    // 統計與數學
    const N = [[85], [92], [78], [92], [60]];
    for (const [f, r] of [['=COUNT(A1:A5)', '5'], ['=COUNT(1,"2")', '2'], ['=MAX(A1:A5)', '92'], ['=MIN(A1:A5)', '60'], ['=LARGE(A1:A5,1)', '92'], ['=LARGE(A1:A5,5)', '60'], ['=LARGE(A1:A5,6)', '#NUM!'], ['=SMALL(A1:A5,1)', '60'], ['=RANK(92,A1:A5)', '1'], ['=RANK(60,A1:A5)', '5'], ['=RANK(60,A1:A5,1)', '1'], ['=RANK(99,A1:A5)', '#N/A'], ['=MEDIAN(A1:A4)', '88.5'], ['=MEDIAN(5)', '5'], ['=MAX()', '0']]) assert.equal(ev(f, N), r, f);
    for (const [f, r] of [['=ROUND(2.5,0)', '3'], ['=ROUND(-2.5,0)', '-3'], ['=ROUND(1.005,2)', '1.01'], ['=ROUND(1234.5678,-2)', '1200'], ['=ROUND(1250,-2)', '1300'], ['=ROUND(0.5,0)', '1'], ['=ROUNDUP(-3.141,2)', '-3.15'], ['=ROUNDUP(3,2)', '3'], ['=ROUNDUP(1234,-2)', '1300'], ['=ROUNDDOWN(-3.999,2)', '-3.99'], ['=ROUNDDOWN(1999,-3)', '1000'], ['=INT(3.9)', '3'], ['=INT(-0.1)', '-1'], ['=MOD(-1,3)', '2'], ['=MOD(5,-3)', '-1'], ['=MOD(5.5,2)', '1.5'], ['=ABS(-0)', '0'], ['=ABS("-3")', '3']]) assert.equal(ev(f), r, f);
    // 查表
    const P = m.T_PROD;
    for (const [f, r] of [['=VLOOKUP("b03",A2:C5,2,FALSE)', '訂書機'], ['=VLOOKUP("B*",A2:C5,2,FALSE)', '筆記本'], ['=VLOOKUP("B9",A2:C5,2,FALSE)', '#N/A'], ['=VLOOKUP("B03",A2:C5,4,FALSE)', '#REF!'], ['=VLOOKUP("B03",A2:C5,0,FALSE)', '#VALUE!'], ['=VLOOKUP("B03",A2:C5,1)', 'B03'], ['=VLOOKUP("B025",A2:C5,1)', 'B02'], ['=VLOOKUP("A",A2:C5,1)', '#N/A'], ['=VLOOKUP(1,A2:C5,1,FALSE)', '#N/A'], ['=VLOOKUP(120,C2:C5,1,FALSE)', '120'],
        ['=MATCH("B04",A2:A5,0)', '4'], ['=MATCH("b04",A2:A5,0)', '4'], ['=MATCH("B9",A2:A5,0)', '#N/A'], ['=INDEX(A2:C5,2,3)', '15'], ['=INDEX(A2:C5,5,1)', '#REF!'], 
        ['=XLOOKUP("B02",A2:A5,C2:C5)', '15'], ['=XLOOKUP("B9",A2:A5,C2:C5)', '#N/A'], ['=XLOOKUP("B9",A2:A5,C2:C5,"無")', '無'], ['=XLOOKUP(100,C2:C5,B2:B5,"無",-1)', '膠帶'], ['=XLOOKUP("B*",A2:A5,B2:B5,"無",2)', '筆記本'], ['=XLOOKUP("B*",A2:A5,B2:B5,"無")', '無'], ['=XLOOKUP("B0",A2:A5,B2:B5,"無",0,-1)', '無'], ['=XLOOKUP(2,A1:A3,B1:B3)', '#N/A'], ['=CHOOSE(2,"a","b")', 'b'], ['=CHOOSE(3,"a","b")', '#VALUE!']]) assert.equal(String(ev(f, P)), String(r), f);
    assert.equal(ev('=XLOOKUP(120,C2:C5,B2:B5,"無",-1)', P), '筆記本'); assert.equal(ev('=XLOOKUP(130,C2:C5,B2:B5,"無",-1)', P), '筆記本'); assert.equal(ev('=XLOOKUP(130,C2:C5,B2:B5,"無",1)', P), '訂書機'); assert.equal(ev('=XLOOKUP(100,C2:C5,B2:B5,"無",1)', P), '筆記本'); assert.equal(ev('=XLOOKUP(1000,C2:C5,B2:B5,"無",1)', P), '無');
    assert.deepEqual(ev('=XLOOKUP("B03",A2:A5,B2:C5)', P), [['訂書機', '350']]); assert.equal(ev('=XLOOKUP("二月",B1:D1,B2:D2)', [['', '一月', '二月', '三月'], ['', 1, 2, 3]]), '2', '橫向查表');
    assert.equal(ev('=XLOOKUP("a",A1:A3,B1:B3,,0,-1)', [['a', 1], ['b', 2], ['a', 3]]), '3', '由後往前找');
    assert.equal(ev('=HLOOKUP("二月",A1:D3,2,FALSE)', [['x', '一月', '二月', '三月'], ['營收', 120, 150, 180], ['成本', 80, 90, 100]]), '150'); assert.equal(ev('=INDEX(A1:D1,3)', [[1, 2, 3, 4]]), '3', '單列的 INDEX 第二參數是欄');
    const up = [[15], [35], [120], [350]], down = [[350], [120], [35], [15]];
    assert.equal(ev('=MATCH(100,A1:A4,1)', up), '2'); assert.equal(ev('=MATCH(120,A1:A4,1)', up), '3'); assert.equal(ev('=MATCH(10,A1:A4,1)', up), '#N/A'); assert.equal(ev('=MATCH(999,A1:A4)', up), '4'); assert.equal(ev('=MATCH(100,A1:A4,-1)', down), '2'); assert.equal(ev('=MATCH(400,A1:A4,-1)', down), '#N/A');
    assert.equal(ev('=VLOOKUP(100,A1:A4,1)', up), '35'); assert.equal(ev('=VLOOKUP(120,A1:A4,1,TRUE)', up), '120');
    assert.equal(ev('=INDEX(A2:A5,0)', P).length, 4); assert.deepEqual(ev('=INDEX(A2:C5,2)', P), [['B02', '原子筆', '15']]);
    assert.equal(ev('=INDEX(C2:C5,MATCH("B02",A2:A5,0))', P), '15'); assert.equal(ev('=INDEX(A2:A5,MATCH(35,C2:C5,0))', P), 'B04');
    // 文字
    for (const [f, r] of [['=LEFT("abcdef")', 'a'], ['=LEFT("abc",10)', 'abc'], ['=LEFT("abc",0)', ''], ['=RIGHT("abc",0)', ''], ['=RIGHT("abc",10)', 'abc'], ['=MID("abcdef",3,2)', 'cd'], ['=MID("abc",5,2)', ''], ['=MID("abcdef",4,99)', 'def'], ['=LEN("你好 a")', '4'], ['=LEN(12345)', '5'], ['=FIND("b","abcabc",3)', '5'], ['=FIND("B","abc")', '#VALUE!'], ['=FIND("","abc")', '1'], ['=SEARCH("B","abc")', '2'], ['=SEARCH("b?d","abcd")', '2'], ['=SEARCH("a*c","xxabbc")', '3'], ['=SUBSTITUTE("a-b-c-d","-","+",2)', 'a-b+c-d'], ['=SUBSTITUTE("a-b","-","")', 'ab'], ['=SUBSTITUTE("abc","","x")', 'abc'], ['=SUBSTITUTE("aaa","a","b",5)', 'aaa'], ['=REPLACE("abcdef",2,3,"X")', 'aXef'], ['=REPLACE("abc",10,1,"X")', 'abcX'], ['=TRIM("  a   b  c ")', 'a b c'], ['=UPPER("aB1")', 'AB1'], ['=LOWER("AbC")', 'abc'], ['=PROPER("hELLO wORLD-foo bar")', 'Hello World-Foo Bar'], ['=CONCAT("a",1,TRUE)', 'a1TRUE'], ['=TEXTJOIN(",",FALSE,"a","","b")', 'a,,b'], ['=TEXTJOIN(",",TRUE,"a","","b")', 'a,b'], ['=REPT("ab",0)', ''], ['=REPT("ab",-1)', '#VALUE!'], ['=EXACT("a","a")', 'TRUE'], ['=EXACT(1,"1")', 'TRUE'], ['=VALUE("1,234.5")', '1234.5'], ['=VALUE("abc")', '#VALUE!'], ['=VALUE("")', '#VALUE!']]) assert.equal(ev(f), r, f);
    for (const [f, r] of [['=TEXT(1234.5,"#,##0")', '1,235'], ['=TEXT(1234.5,"#,##0.00")', '1,234.50'], ['=TEXT(0.5,"0%")', '50%'], ['=TEXT(0.256,"0.0%")', '25.6%'], ['=TEXT(5,"000")', '005'], ['=TEXT(1234567,"#,##0")', '1,234,567'], ['=TEXT(-3.14159,"0.00")', '-3.14'], ['=TEXT(0,"0.00")', '0.00'], ['=TEXT(7,"0.0")', '7.0'], ['=TEXT(0.5,"#.00")', '.50'], ['=TEXT(DATE(2024,3,5),"yyyy/mm/dd")', '2024/03/05'], ['=TEXT(DATE(2024,3,5),"yyyy-m-d")', '2024-3-5'], ['=TEXT(DATE(2024,3,15),"aaa")', '週五'], ['=TEXT(DATE(2024,3,15),"aaaa")', '星期五'], ['=TEXT(DATE(2024,3,15),"dddd")', 'Friday'], ['=TEXT(DATE(2024,3,15),"mmm d, yyyy")', 'Mar 15, 2024'], ['=TEXT(DATE(2024,3,15),"yy")', '24'], ['=TEXT(1,"qrs")', '#VALUE!']]) assert.equal(ev(f), r, f);
    // 日期
    assert.equal(m.serialOf(1900, 3, 1), 61, 'Excel 序號：1900-03-01 = 61'); assert.equal(m.serialOf(2024, 3, 15), 45366); assert.equal(m.serialOf(1970, 1, 1), 25569); assert.equal(iso(45366), '2024-03-15'); assert.equal(iso(m.serialOf(2000, 2, 29)), '2000-02-29');
    for (const [f, r] of [['=YEAR(DATE(2024,12,31))', '2024'], ['=MONTH(DATE(2024,13,1))', '1'], ['=YEAR(DATE(2024,13,1))', '2025'], ['=DAY(DATE(2024,3,0))', '29'], ['=DAY(DATE(2023,3,0))', '28'], ['=WEEKDAY(DATE(2024,3,17))', '1'], ['=WEEKDAY(DATE(2024,3,17),2)', '7'], ['=WEEKDAY(DATE(2024,3,17),3)', '6'], ['=WEEKDAY(DATE(2024,3,18),3)', '0'], ['=WEEKDAY(DATE(2024,3,18),9)', '#NUM!'], ['=DAYS(DATE(2024,3,1),DATE(2024,2,1))', '29'], ['=DAYS(DATE(2024,1,1),DATE(2024,3,1))', '-60'],
        ['=DATEDIF(DATE(2024,1,31),DATE(2024,3,1),"M")', '1'], ['=DATEDIF(DATE(2000,2,29),DATE(2024,2,28),"Y")', '23'], ['=DATEDIF(DATE(2000,2,29),DATE(2024,2,29),"Y")', '24'], ['=DATEDIF(DATE(2020,5,20),DATE(2024,3,15),"M")', '45'], ['=DATEDIF(DATE(2020,5,20),DATE(2024,3,15),"YM")', '9'], ['=DATEDIF(DATE(2020,5,20),DATE(2024,3,15),"D")', '1395'], ['=DATEDIF(DATE(2020,5,20),DATE(2024,3,15),"YD")', '300'], ['=DATEDIF(DATE(2024,3,15),DATE(2020,5,20),"Y")', '#NUM!'], ['=DATEDIF(DATE(2024,1,1),DATE(2024,1,2),"Q")', '#NUM!'], ['=DATEDIF(DATE(2024,1,15),DATE(2024,3,10),"MD")', '24'],
        ['=NETWORKDAYS(DATE(2024,3,16),DATE(2024,3,17))', '0'], ['=NETWORKDAYS(DATE(2024,3,15),DATE(2024,3,15))', '1'], ['=NETWORKDAYS(DATE(2024,3,15),DATE(2024,3,1))', '-11'], ['=NETWORKDAYS(DATE(2024,3,1),DATE(2024,3,15),A1:A2)', '10'], ['=WORKDAY(DATE(2024,3,15),0)', '45366'], ['=WORKDAY(DATE(2024,3,15),-1)', String(m.serialOf(2024, 3, 14))], ['=WORKDAY(DATE(2024,3,16),1)', String(m.serialOf(2024, 3, 18))], ['=WORKDAY(DATE(2024,3,15),1,A1)', String(m.serialOf(2024, 3, 19))]]) assert.equal(ev(f, [[m.serialOf(2024, 3, 18)], [m.serialOf(2024, 3, 5)]]), r, f);
    for (const [f, d] of [['=EOMONTH(DATE(2024,1,31),1)', '2024-02-29'], ['=EOMONTH(DATE(2023,12,15),2)', '2024-02-29'], ['=EOMONTH(DATE(2024,3,15),-1)', '2024-02-29'], ['=EOMONTH(DATE(2024,1,15),-1)', '2023-12-31'], ['=EOMONTH(DATE(2023,1,31),1)', '2023-02-28'], ['=EDATE(DATE(2024,3,31),-1)', '2024-02-29'], ['=EDATE(DATE(2024,11,30),3)', '2025-02-28'], ['=EDATE(DATE(2024,5,15),12)', '2025-05-15'], ['=DATE(2024,1,32)', '2024-02-01'], ['=DATE(2024,14,1)', '2025-02-01']]) assert.equal(iso(m.evalFormula(f)), d, f);
    // 陣列函式
    assert.deepEqual(ev('=FILTER(A2:D6,D2:D6>=250)', S), [['小美', '北', 'A', '300'], ['小華', '北', 'B', '250']]); assert.equal(ev('=FILTER(A2:D6,D2:D6>999)', S), '#CALC!'); assert.equal(ev('=FILTER(A2:D6,D2:D6>999,"無")', S), '無'); assert.equal(ev('=FILTER(A2:D6,D2:D5>1)', S), '#VALUE!');
    assert.deepEqual(ev('=FILTER(A2:A6,(B2:B6="北")*(D2:D6>=250))', S), [['小美'], ['小華']]); assert.deepEqual(ev('=UNIQUE(B2:B6)', S), [['北'], ['南']]); assert.deepEqual(ev('=UNIQUE(A1:A4)', [['a'], ['A'], ['b'], ['a']]), [['a'], ['b']], 'UNIQUE 不分大小寫');
    assert.equal(ev('=COUNTA(UNIQUE(A2:A6))', S), '3'); assert.deepEqual(ev('=SORT(A2:A6)', S).map(r => r[0]).slice(0, 2), ['小明', '小明']); assert.deepEqual(ev('=SORT(D2:D6)', S), [['100'], ['150'], ['200'], ['250'], ['300']]); assert.deepEqual(ev('=SORT(D2:D6,1,-1)', S), [['300'], ['250'], ['200'], ['150'], ['100']]); assert.equal(ev('=SORT(D2:D6,2)', S), '#VALUE!');
    assert.deepEqual(ev('=SORT(A1:A5)', [[10], ['b'], [2], ['A'], [true]]), [['2'], ['10'], ['A'], ['b'], ['TRUE']], '數字 < 文字 < 布林');
    assert.deepEqual(ev('=SORTBY(A2:A6,D2:D6)', S), [['小明'], ['小明'], ['小華'], ['小華'], ['小美']]); assert.deepEqual(ev('=SORTBY(A2:A6,B2:B6,1,D2:D6,-1)', S), [['小美'], ['小華'], ['小明'], ['小華'], ['小明']]); assert.equal(ev('=SORTBY(A2:A6,D2:D5)', S), '#VALUE!');
    assert.deepEqual(ev('=SEQUENCE(2,3)'), [['1', '2', '3'], ['4', '5', '6']]); assert.deepEqual(ev('=SEQUENCE(3,1,10,5)'), [['10'], ['15'], ['20']]); assert.equal(ev('=SEQUENCE(1)'), '1'); assert.equal(ev('=SEQUENCE(0)'), '#CALC!'); assert.equal(ev('=SUM(SEQUENCE(10))'), '55');
    assert.equal(ev('=LET(a,2,b,3,a*b)'), '6'); assert.equal(ev('=LET(x,2,x,x+1,x*10)'), '30', '後面的名稱可覆蓋'); assert.equal(ev('=LET(x,1)'), '#VALUE!'); assert.equal(ev('=LET(1,2,3)'), '#NAME?'); assert.equal(ev('=LET(x,1,y,x+1,y*2)+x'), '#NAME?', 'LET 的名稱只在 LET 內有效');
    assert.equal(ev('=SUM(A1:A3,10,"5")', [[1], [2], ['x']]), '18'); assert.equal(ev('=SUM(A1:B2)', [[1, 2], [3, 4]]), '10'); assert.equal(ev('=SUM($A$1:$A$2)', [[1], [2]]), '3'); assert.equal(ev('=sum(a1:a2)', [[1], [2]]), '3', '函式與位址不分大小寫');
    assert.equal(ev('=COUNTA(A1:A3,B1)', [['x', null, 1], ['y']]), '2'); assert.equal(ev('=COUNTBLANK(A1:A4)', [[''], [null], [0], ['x']]), '2'); assert.equal(ev('=AVERAGE(A1:A3)', [[1], ['x'], [3]]), '2');

    // 搜尋
    const ids = (q, c) => m.searchFns(q, c).map(x => x.id);
    assert.equal(ids('vlookup')[0], 'VLOOKUP'); assert.equal(ids('VLOOKUP')[0], 'VLOOKUP'); assert.equal(ids('  vlookup  ')[0], 'VLOOKUP'); assert.equal(ids('sum')[0], 'SUM', '名稱完全相同排最前'); assert.ok(ids('sum').slice(0, 6).every(i => /SUM/.test(i)), '名稱開頭的優先');
    assert.ok(ids('去空格').includes('TRIM')); assert.ok(ids('月底').includes('EOMONTH')); assert.ok(ids('排名').includes('RANK')); assert.ok(ids('去重複').includes('UNIQUE')); assert.ok(ids('年齡').includes('DATEDIF')); assert.ok(ids('補零').includes('TEXT')); assert.ok(ids('查表').includes('VLOOKUP') && ids('查表').includes('XLOOKUP')); assert.ok(ids('篩選').includes('FILTER'));
    assert.ok(ids('left').includes('LEFT')); assert.ok(ids('if').includes('IF') && ids('if').includes('IFERROR')); assert.equal(ids('if')[0], 'IF');
    assert.equal(ids('').length, m.XL.length, '空白 = 全部'); assert.equal(ids('   ').length, m.XL.length); assert.deepEqual(ids('zzzzqq'), []); assert.deepEqual(ids('vlookup 多條件 sumifs'), []);
    assert.ok(ids('條件 加總').includes('SUMIFS')); assert.ok(ids('', 'text').length >= 15 && ids('', 'text').every(i => m.XL_BY_ID[i].cat === 'text')); assert.deepEqual(ids('vlookup', 'text'), []); assert.deepEqual(ids('', 'nope'), []);
    assert.equal(ids('', 'date').length, m.XL.filter(x => x.cat === 'date').length); assert.deepEqual(ids(null), ids('')); assert.deepEqual(ids(undefined), ids(''));
    assert.ok(ids('indexmatch').includes('INDEXMATCH') && ids('index match').includes('INDEXMATCH'));
    for (const x of m.XL) assert.ok(ids(x.id).includes(x.id), x.id + ' 可用名稱搜到');

    // 需求導引
    assert.ok(m.GUIDE.length >= 6);
    for (const g of m.GUIDE) { assert.ok(g.id && g.label && g.q && g.opts.length >= 3, g.id); g.opts.forEach((o, i) => { assert.ok(o.label && o.tip && o.fns.length >= 1, g.id + i); const r = m.guideFor(g.id, i); assert.deepEqual(r.fns.map(f => f.id), o.fns); assert.ok(r.fns.every(f => f && f.ex), g.id + i + ' 公式都存在'); }); }
    assert.equal(m.guideFor('nope', 0), null); assert.equal(m.guideFor('lookup', 99), null); assert.equal(m.guideFor('lookup', -1), null);
    assert.deepEqual(m.guideFor('lookup', 0).fns.map(f => f.id), ['VLOOKUP', 'XLOOKUP']); assert.ok(m.guideFor('error', 1).fns.some(f => f.id === 'IFNA'));
    const goalCats = { lookup: 'lookup', sum: 'sumcount', text: 'text', date: 'date', array: 'array', error: 'logic' };
    for (const g of m.GUIDE) for (const o of g.opts) assert.ok(o.fns.some(id => m.XL_BY_ID[id].cat === goalCats[g.id]) || g.id === 'lookup', g.id + ' ' + o.label + ' 至少一個同類公式');
    ok('excel-formula');
}
