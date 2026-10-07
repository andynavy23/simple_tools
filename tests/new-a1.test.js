// 批次 a1：timestamp 的 ObjectId 分頁、MongoDB 指令產生器
const { load, ok } = require('./_load');
const assert = require('assert');
const vm = require('vm');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const U = require('../shared/js/util.js');

// ===== timestamp：ObjectId =====
{
    const m = load('utils/timestamp.html', 'splitOids, oidReason, oidRows, oidTableText, oidRangeQuery, oidInstant, rangeFor, parseInZone, fmtInZone');
    // 分割：空白 / 換行 / 逗號 / 全形，最多 200
    assert.deepStrictEqual(m.splitOids(' a b,c\nd，e;f ').list, ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.deepStrictEqual(m.splitOids('').list, []); assert.deepStrictEqual(m.splitOids(null).list, []);
    const many = Array.from({ length: 205 }, (_, i) => i.toString(16).padStart(24, '0')).join(' ');
    const sp = m.splitOids(many); assert.equal(sp.list.length, 200); assert.equal(sp.over, 5);
    // 原因
    assert.ok(m.oidReason('abc').includes('長度為 3'));
    assert.ok(m.oidReason('g'.repeat(24)).includes('16 進位'));
    // 解析
    const NOW = Date.UTC(2012, 9, 18, 21, 13, 27);
    const rows = m.oidRows(['507F1F77BCF86CD799439011', 'xyz', 'z'.repeat(24)], 'Asia/Taipei', NOW);
    assert.equal(rows[0].ok, true); assert.equal(rows[0].id, '507f1f77bcf86cd799439011');
    assert.equal(rows[0].utc, '2012-10-17 21:13:27'); assert.equal(rows[0].local, '2012-10-18 05:13:27（UTC+08:00）');
    assert.equal(rows[0].iso, '2012-10-17T21:13:27.000Z'); assert.equal(rows[0].random, 'bcf86cd799'); assert.equal(rows[0].counter, 4427793);
    assert.equal(rows[0].rel, '1 天前');
    assert.equal(rows[1].ok, false); assert.ok(rows[1].reason.includes('長度')); assert.ok(rows[2].reason.includes('16 進位'));
    const tsv = m.oidTableText(rows, 'Asia/Taipei').split('\n');
    assert.equal(tsv.length, 4); assert.equal(tsv[0].split('\t').length, 6); assert.equal(tsv[1].split('\t')[0], '507f1f77bcf86cd799439011'); assert.ok(tsv[2].includes('無效：'));
    // 邊界：全 0 / 全 f
    const edge = m.oidRows(['0'.repeat(24), 'f'.repeat(24)], 'UTC', NOW);
    assert.equal(edge[0].iso, '1970-01-01T00:00:00.000Z'); assert.equal(edge[1].iso, '2106-02-07T06:28:15.000Z'); assert.equal(edge[1].counter, 0xffffff);
    // 時間 → ObjectId
    const q = m.oidInstant(Date.UTC(2023, 10, 14, 22, 13, 20, 999));
    assert.equal(q.min, '6553f100' + '0'.repeat(16)); assert.equal(q.max, '6553f100' + 'f'.repeat(16));
    assert.equal(q.query, `{ _id: { $gte: ObjectId("6553f100${'0'.repeat(16)}"), $lt: ObjectId("6553f101${'0'.repeat(16)}") } }`);
    assert.equal(U.oid.parse(q.min).ms, 1700000000000);
    const r = m.oidRangeQuery(0, 86400000); assert.equal(r.min, '0'.repeat(24)); assert.equal(r.max, '0001517f' + 'f'.repeat(16)); assert.ok(r.query.includes('$lt: ObjectId("00015180'));
    assert.throws(() => m.oidRangeQuery(-1000, 0)); assert.throws(() => m.oidInstant(2 ** 32 * 1000));
    // 快捷範圍（臺北；現在 = 2026-03-31 23:30 臺北）
    const now = m.parseInZone('2026-03-31 23:30:00', 'Asia/Taipei'), f = (t) => m.fmtInZone(t, 'Asia/Taipei');
    const rg = (k) => m.rangeFor(k, now, 'Asia/Taipei').map(f);
    assert.deepStrictEqual(rg('today'), ['2026-03-31 00:00:00', '2026-04-01 00:00:00']);
    assert.deepStrictEqual(rg('yesterday'), ['2026-03-30 00:00:00', '2026-03-31 00:00:00']);
    assert.deepStrictEqual(rg('week'), ['2026-03-25 00:00:00', '2026-04-01 00:00:00']);
    assert.deepStrictEqual(rg('month'), ['2026-03-01 00:00:00', '2026-04-01 00:00:00']);
    // 跨年、跨月、時區不同日界線
    const ny = m.parseInZone('2026-01-01 00:10:00', 'Asia/Taipei');
    assert.deepStrictEqual(m.rangeFor('yesterday', ny, 'Asia/Taipei').map(f), ['2025-12-31 00:00:00', '2026-01-01 00:00:00']);
    assert.deepStrictEqual(m.rangeFor('week', ny, 'Asia/Taipei').map(f), ['2025-12-26 00:00:00', '2026-01-02 00:00:00']);
    assert.deepStrictEqual(m.rangeFor('month', m.parseInZone('2026-12-15 10:00:00', 'UTC'), 'UTC').map(t => m.fmtInZone(t, 'UTC')), ['2026-12-01 00:00:00', '2027-01-01 00:00:00']);
    assert.equal(m.rangeFor('today', ny, 'UTC')[0], Date.UTC(2025, 11, 31)); // 臺北已是 1/1，UTC 還是 12/31
    ok('timestamp: ObjectId rows / range query / quick ranges');
}

// ===== MongoDB 指令產生器 =====
const q = load('utils/mongo-query.html', 'OPS, FMTS, WRITE_OPS, LIM, defaultState, newRow, newGroup, newUpd, newStage, loadOpts, validColl, validField, parseDate, coerce, condRow, combine, compileGroup, compileProj, compileKeys, compileUpdate, compileStages, buildCommand, render, strLit, ser, template, TEMPLATES, Tag, M, escapeRe');
const { newRow, newGroup, newUpd, newStage, buildCommand, render } = q;
const base = (o = {}) => ({ ...q.defaultState(), coll: 'users', ...o });
const rowsState = (rows, mode = 'and', o = {}) => base({ filter: newGroup(mode, rows.map(r => newRow(r))), ...o });
const out = (S, lang) => { const r = buildCommand(S); assert.ok(r.ok, JSON.stringify(r.errs)); return render(r.cmd, lang).map(p => p.text).join('\n'); };

// 集合名稱
for (const n of ['users', 'a-b', 'a.b', '中文', 'x'.repeat(120)]) assert.equal(q.validColl(n), '', n);
for (const n of ['', '  ', 'a$b', '$x', 'a\0b', 'system.users', 'system.', 'x'.repeat(121)]) assert.notEqual(q.validColl(n), '', JSON.stringify(n));
assert.equal(q.validField('a.b.c'), ''); for (const f of ['', '$x', 'a..b', '.a', 'a.', 'a\0']) assert.notEqual(q.validField(f), '', f);
// 日期
assert.equal(q.parseDate('2024-02-29'), '2024-02-29T00:00:00.000Z'); assert.equal(q.parseDate('2024-02-30'), null); assert.equal(q.parseDate('2023-02-29'), null);
assert.equal(q.parseDate('2024-01-01T08:00:00+08:00'), '2024-01-01T00:00:00.000Z'); assert.equal(q.parseDate('2024-01-01 10:20'), '2024-01-01T10:20:00.000Z');
assert.equal(q.parseDate('2024-01-01T10:20:30.5Z'), '2024-01-01T10:20:30.500Z'); assert.equal(q.parseDate('2024-13-01'), null); assert.equal(q.parseDate('2024-01-01T24:00'), null);
assert.equal(q.parseDate('abc'), null); assert.equal(q.parseDate('0050-01-01'), null); assert.equal(q.parseDate(''), null); assert.equal(q.parseDate('2024-01-01T10:00:00+25:00'), null);
// 值型別
assert.deepStrictEqual(q.coerce('abc', 'string'), { v: 'abc' }); assert.equal(q.coerce(' 12.5 ', 'number').v, 12.5); assert.ok(q.coerce('', 'number').err); assert.ok(q.coerce('1e999', 'number').err); assert.ok(q.coerce('x', 'number').err);
assert.equal(q.coerce('TRUE', 'bool').v, true); assert.ok(q.coerce('yes', 'bool').err); assert.equal(q.coerce('anything', 'null').v, null);
assert.equal(q.coerce(' 507F1F77BCF86CD799439011 ', 'oid').v.a, '507f1f77bcf86cd799439011'); assert.ok(q.coerce('123', 'oid').err);
assert.equal(q.coerce('2024-01-01', 'date').v.a, '2024-01-01T00:00:00.000Z'); assert.ok(q.coerce('x', 'date').err);
assert.ok(q.coerce('{"a":1}', 'array').err); assert.ok(q.coerce('[1]', 'object').err); assert.ok(q.coerce('{', 'object').err); assert.ok(q.coerce('null', 'object').err); assert.ok(q.coerce('5', 'array').err);
assert.ok(q.coerce('{"a":{"$oid":"507f1f77bcf86cd799439011"},"b":[{"$date":"2024-01-01T00:00:00Z"}]}', 'object').v.get('a') instanceof q.Tag);
assert.equal(q.coerce('x', 'zzz').err, '未知的值型別');

// ---- 精確輸出（四種格式）----
{
    const S = rowsState([{ field: 'age', op: 'gte', type: 'number', value: '18' }]);
    assert.equal(out(S, 'mongosh'), 'db.users.find({ age: { $gte: 18 } })');
    assert.equal(out(S, 'node'), 'const result = await db.collection("users").find({ age: { $gte: 18 } }).toArray();');
    assert.equal(out(S, 'python'), 'result = list(db["users"].find({"age": {"$gte": 18}}))');
    assert.deepStrictEqual(render(buildCommand(S).cmd, 'compass'), [{ label: 'Filter', text: '{"age": {"$gte": 18}}', json: true }]);
    // 空條件
    assert.equal(out(base(), 'mongosh'), 'db.users.find({})');
    // 投影 / 排序 / skip / limit
    const S2 = rowsState([{ field: 'a.b', op: 'eq', value: 'x' }], 'and', { proj: { mode: 'include', fields: 'name, a.b', noId: true }, sort: [{ field: 'age', dir: '-1' }, { field: 'name', dir: '1' }], skip: '5', limit: '10' });
    assert.equal(out(S2, 'mongosh'), 'db.users.find({ "a.b": "x" }, { name: 1, "a.b": 1, _id: 0 }).sort({ age: -1, name: 1 }).skip(5).limit(10)');
    assert.equal(out(S2, 'node'), 'const result = await db.collection("users").find({ "a.b": "x" }, { projection: { name: 1, "a.b": 1, _id: 0 } }).sort({ age: -1, name: 1 }).skip(5).limit(10).toArray();');
    assert.equal(out(S2, 'python'), 'result = list(db["users"].find({"a.b": "x"}, {"name": 1, "a.b": 1, "_id": 0}).sort([("age", -1), ("name", 1)]).skip(5).limit(10))');
    assert.deepStrictEqual(render(buildCommand(S2).cmd, 'compass').map(p => p.label + '=' + p.text), ['Filter={"a.b": "x"}', 'Project={"name": 1, "a.b": 1, "_id": 0}', 'Sort={"age": -1, "name": 1}', 'Skip=5', 'Limit=10']);
    // 型別
    const S3 = rowsState([{ field: '_id', op: 'eq', type: 'oid', value: '507f1f77bcf86cd799439011' }, { field: 'at', op: 'gte', type: 'date', value: '2024-01-02T03:04:05.006Z' }]);
    assert.equal(out(S3, 'mongosh'), ['db.users.find(', '  {', '    _id: ObjectId("507f1f77bcf86cd799439011"),', '    at: { $gte: ISODate("2024-01-02T03:04:05.006Z") }', '  }', ')'].join('\n'));
    assert.equal(out(rowsState([{ field: '_id', op: 'eq', type: 'oid', value: '507f1f77bcf86cd799439011' }]), 'mongosh'), 'db.users.find({ _id: ObjectId("507f1f77bcf86cd799439011") })');
    assert.ok(out(S3, 'node').startsWith("// const { ObjectId } = require('mongodb');\n") && out(S3, 'node').includes('new ObjectId("507f') && out(S3, 'node').includes('new Date("2024-01-02T03:04:05.006Z")'));
    assert.ok(out(S3, 'python').startsWith('from bson import ObjectId\nfrom datetime import datetime, timezone\n') && out(S3, 'python').includes('datetime(2024, 1, 2, 3, 4, 5, 6000, tzinfo=timezone.utc)'));
    assert.deepStrictEqual(JSON.parse(out(S3, 'compass')), { _id: { $oid: '507f1f77bcf86cd799439011' }, at: { $gte: { $date: '2024-01-02T03:04:05.006Z' } } });
    assert.equal(out(rowsState([{ field: 'at', op: 'gte', type: 'date', value: '2024-01-02' }]), 'compass'), '{"at": {"$gte": {"$date": "2024-01-02T00:00:00.000Z"}}}');
    // 集合名稱需要 getCollection
    assert.ok(out(base({ coll: 'a-b' }), 'mongosh').startsWith('db.getCollection("a-b").find'));
    assert.ok(out(base({ coll: 'stats' }), 'mongosh').startsWith('db.getCollection("stats")'));
    assert.ok(out(base({ coll: 'a.b' }), 'mongosh').startsWith('db.getCollection("a.b")'));
    assert.ok(out(base({ coll: 'a"b' }), 'node').includes('db.collection("a\\"b")'));
}

// ---- 運算子 ----
const cond = (r) => { const c = q.condRow(newRow(r)); assert.ok(!c.err, c.err); return out(rowsState([{ field: 'f', ...r }]), 'compass'); };
assert.equal(cond({ op: 'eq', type: 'string', value: 'x' }), '{"f": "x"}');
assert.equal(cond({ op: 'ne', type: 'number', value: '1' }), '{"f": {"$ne": 1}}');
assert.equal(cond({ op: 'gt', type: 'number', value: '1' }), '{"f": {"$gt": 1}}');
assert.equal(cond({ op: 'lt', type: 'number', value: '-1.5' }), '{"f": {"$lt": -1.5}}');
assert.equal(cond({ op: 'lte', type: 'bool', value: 'true' }), '{"f": {"$lte": true}}');
assert.equal(cond({ op: 'in', type: 'string', value: 'a, b\nc，d' }), '{"f": {"$in": ["a", "b", "c", "d"]}}');
assert.equal(cond({ op: 'nin', type: 'number', value: '1,2' }), '{"f": {"$nin": [1, 2]}}');
assert.equal(cond({ op: 'in', type: 'array', value: '[1,"a"]' }), '{"f": {"$in": [1, "a"]}}');
assert.equal(cond({ op: 'in', type: 'null' }), '{"f": {"$in": [null]}}');
assert.equal(cond({ op: 'exists', value: 'false' }), '{"f": {"$exists": false}}'); assert.equal(cond({ op: 'exists', value: '' }), '{"f": {"$exists": true}}');
assert.equal(cond({ op: 'type', value: 'string' }), '{"f": {"$type": "string"}}'); assert.equal(cond({ op: 'type', value: '2' }), '{"f": {"$type": 2}}');
assert.equal(cond({ op: 'regex', value: '^a.*b$', opt: 'i m' }), '{"f": {"$regex": "^a.*b$", "$options": "im"}}');
assert.equal(cond({ op: 'regex', value: 'x', opt: '' }), '{"f": {"$regex": "x"}}');
{
    const raw = 'a.b*(c)[d]{e}|$^+?\\';
    assert.deepStrictEqual(JSON.parse(cond({ op: 'contains', value: raw, opt: 'i' })), { f: { $regex: q.escapeRe(raw), $options: 'i' } });
    assert.equal(q.escapeRe(raw), 'a\\.b\\*\\(c\\)\\[d\\]\\{e\\}\\|\\$\\^\\+\\?\\\\');
}
assert.equal(cond({ op: 'elemMatch', type: 'object', value: '{"score":{"$gt":5}}' }), '{"f": {"$elemMatch": {"score": {"$gt": 5}}}}');
assert.equal(cond({ op: 'elemMatch', type: 'number', value: '5' }), '{"f": {"$elemMatch": {"$eq": 5}}}');
assert.equal(cond({ op: 'size', value: '3' }), '{"f": {"$size": 3}}');
assert.equal(cond({ op: 'mod', value: '5, 1' }), '{"f": {"$mod": [5, 1]}}');
assert.equal(cond({ op: 'eq', type: 'array', value: '[1,2]' }), '{"f": [1, 2]}');
assert.equal(cond({ op: 'eq', type: 'object', value: '{"a":null}' }), '{"f": {"a": null}}');
assert.equal(cond({ op: 'eq', type: 'null' }), '{"f": null}');
// 運算子錯誤
for (const [r, frag] of [[{ op: 'gt', type: 'number', value: 'x' }, '數字'], [{ op: 'in', value: '' }, '至少一個'], [{ op: 'exists', value: 'maybe' }, '存在'], [{ op: 'type', value: 'nope' }, '型別'], [{ op: 'regex', value: '' }, '正規'], [{ op: 'regex', value: 'a', opt: 'g' }, '選項'], [{ op: 'contains', value: '' }, '字串'], [{ op: 'size', value: '-1' }, '陣列大小'], [{ op: 'size', value: '1.5' }, '陣列大小'], [{ op: 'mod', value: '0, 1' }, '取模'], [{ op: 'mod', value: '5' }, '取模'], [{ op: 'eq', type: 'oid', value: 'zz' }, 'ObjectId'], [{ op: 'in', type: 'number', value: '1,x' }, '數字'], [{ op: 'bogus' }, '未知']]) {
    const c = q.condRow(newRow(r)); assert.ok(c.err && c.err.includes(frag), JSON.stringify(r) + ' ' + c.err);
}
// 欄位錯誤擋住輸出，含列號
{
    const r = buildCommand(rowsState([{ field: 'a', op: 'eq', value: '1' }, { field: '$bad', op: 'eq', value: 'x' }, { field: '', value: 'orphan' }]));
    assert.ok(!r.ok); assert.ok(r.errs.some(e => e.startsWith('條件 2：')) && r.errs.some(e => e.startsWith('條件 3：')));
    assert.ok(buildCommand(base({ coll: 'system.x' })).errs.length);
    assert.ok(buildCommand(rowsState([{ field: '', value: '' }])).ok, '空白列略過');
    assert.equal(buildCommand(rowsState([{ field: 'null', op: 'eq', type: 'null' }])).ok, true);
}

// ---- 組合 and / or / 巢狀 ----
{
    const c = (S) => out(S, 'compass');
    // and 合併同欄位的不同運算子
    assert.equal(c(rowsState([{ field: 'age', op: 'gte', type: 'number', value: '18' }, { field: 'age', op: 'lt', type: 'number', value: '65' }, { field: 'n', op: 'eq', value: 'x' }])), '{"age": {"$gte": 18, "$lt": 65}, "n": "x"}');
    // 同欄位同運算子 / eq 與運算子 → $and
    assert.equal(c(rowsState([{ field: 'a', op: 'gt', type: 'number', value: '1' }, { field: 'a', op: 'gt', type: 'number', value: '2' }])), '{"$and": [{"a": {"$gt": 1}}, {"a": {"$gt": 2}}]}');
    assert.equal(c(rowsState([{ field: 'a', op: 'eq', value: 'x' }, { field: 'a', op: 'ne', value: 'y' }])), '{"$and": [{"a": "x"}, {"a": {"$ne": "y"}}]}');
    // or
    assert.equal(c(rowsState([{ field: 'a', op: 'eq', value: '1' }, { field: 'b', op: 'eq', value: '2' }], 'or')), '{"$or": [{"a": "1"}, {"b": "2"}]}');
    // 單一條件的 or 不加 $or
    assert.equal(c(rowsState([{ field: 'a', op: 'eq', value: '1' }], 'or')), '{"a": "1"}');
    // 巢狀：and( a, or(b, c) )
    const nest = base({ filter: newGroup('and', [newRow({ field: 'a', value: '1' }), newGroup('or', [newRow({ field: 'b', value: '2' }), newRow({ field: 'c', value: '3' })])]) });
    assert.equal(c(nest), '{"a": "1", "$or": [{"b": "2"}, {"c": "3"}]}');
    // or( and(a,b), c )
    const nest2 = base({ filter: newGroup('or', [newGroup('and', [newRow({ field: 'a', value: '1' }), newRow({ field: 'b', value: '2' })]), newRow({ field: 'c', value: '3' })]) });
    assert.equal(c(nest2), '{"$or": [{"a": "1", "b": "2"}, {"c": "3"}]}');
    // 兩個 or 群組 → $and
    const two = base({ filter: newGroup('and', [newGroup('or', [newRow({ field: 'a', value: '1' }), newRow({ field: 'b', value: '2' })]), newGroup('or', [newRow({ field: 'c', value: '3' }), newRow({ field: 'd', value: '4' })])]) });
    assert.equal(c(two), '{"$and": [{"$or": [{"a": "1"}, {"b": "2"}]}, {"$or": [{"c": "3"}, {"d": "4"}]}]}');
    // 空群組被忽略；群組只有一條件 → 直接展開
    assert.equal(c(base({ filter: newGroup('and', [newGroup('or', []), newRow({ field: 'a', value: '1' })]) })), '{"a": "1"}');
    // 超過一層巢狀 → 錯誤
    assert.ok(q.compileGroup(newGroup('and', [newGroup('and', [newGroup('and', [newRow({ field: 'a', value: '1' })])])])).errs.some(e => e.includes('一層')));
    // 列數上限
    assert.ok(q.compileGroup(newGroup('and', Array.from({ length: 31 }, () => newRow({ field: 'a', value: '1' })))).errs.length);
    assert.ok(q.compileGroup(newGroup('and', Array.from({ length: 11 }, () => newGroup('and', [])))).errs.some(e => e.includes('群組最多')));
    // 壞資料不炸
    assert.deepStrictEqual(q.compileGroup(null), { v: null, errs: [] }); assert.deepStrictEqual(q.compileGroup({ items: [null, 5, {}] }).errs.length, 0);
    assert.ok(buildCommand(null).errs.length); assert.ok(buildCommand({ op: 'nope', coll: 'x' }).ok);
}

// ---- 各操作 ----
const ops = {
    findOne: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'findOne', proj: { mode: 'exclude', fields: 'secret', noId: false } }),
    countDocuments: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'countDocuments' }),
    distinct: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'distinct', distinctField: 'city' }),
    distinctNoFilter: base({ op: 'distinct', distinctField: 'city' }),
    aggregate: base({ op: 'aggregate', stages: [{ ...newStage('match'), grp: newGroup('and', [newRow({ field: 's', value: 'ok' })]) }, { ...newStage('group'), id: 'city, a.b', accs: [{ name: 'n', op: 'count', field: '' }, { name: 'total', op: 'sum', field: 'amt' }, { name: 'avg', op: 'avg', field: 'amt' }, { name: 'lo', op: 'min', field: 'amt' }, { name: 'hi', op: 'max', field: 'amt' }, { name: 'names', op: 'push', field: 'name' }, { name: 'set', op: 'addToSet', field: 'tag' }, { name: 'first', op: 'first', field: '$ROOT' }, { name: 'cnt1', op: 'sum', field: '' }] }, { ...newStage('sort'), sort: [{ field: 'n', dir: '-1' }] }, { ...newStage('project'), proj: { mode: 'include', fields: 'n, total', noId: true } }, { ...newStage('limit'), n: '10' }, { ...newStage('skip'), n: '2' }, { ...newStage('unwind'), field: 'tags', preserve: true }, { ...newStage('unwind'), field: 'tags' }, { ...newStage('lookup'), from: 'orders', localField: '_id', foreignField: 'uid', as: 'orders' }, { ...newStage('count'), name: 'total' }, { ...newStage('addFields'), rows: [{ name: 'x', value: '1', type: 'number' }, { name: 'y', value: 'amt', type: 'ref' }, { name: 'z', value: '$cash', type: 'string' }] }] }),
    insertOne: base({ op: 'insertOne', doc: '{"name":"a\\"b","n":1,"id":{"$oid":"507f1f77bcf86cd799439011"},"at":{"$date":"2024-01-01T00:00:00Z"},"tags":["x",null,true]}' }),
    insertMany: base({ op: 'insertMany', doc: '[{"a":1},{"b":"2"}]' }),
    updateOne: rowsState([{ field: '_id', type: 'oid', value: '507f1f77bcf86cd799439011' }], 'and', { op: 'updateOne', upd: { rows: [newUpd({ op: '$set', field: 'a.b', value: 'v' }), newUpd({ op: '$unset', field: 'old' }), newUpd({ op: '$inc', field: 'n', value: '2' }), newUpd({ op: '$mul', field: 'm', value: '3' }), newUpd({ op: '$min', field: 'lo', type: 'number', value: '1' }), newUpd({ op: '$max', field: 'hi', type: 'date', value: '2024-01-01' }), newUpd({ op: '$push', field: 'arr', value: 'p' }), newUpd({ op: '$pull', field: 'arr2', type: 'object', value: '{"a":1}' }), newUpd({ op: '$addToSet', field: 'set', value: 's' }), newUpd({ op: '$pop', field: 'arr3', value: '-1' }), newUpd({ op: '$rename', field: 'from', value: 'to' }), newUpd({ op: '$currentDate', field: 'updatedAt' })], upsert: true, arrayFilters: '' } }),
    updateMany: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'updateMany', upd: { rows: [newUpd({ field: 'items.$[e].s', type: 'number', value: '1' })], upsert: false, arrayFilters: '[{"e.score":{"$gte":8}}]' } }),
    replaceOne: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'replaceOne', doc: '{"a":"y"}', upd: { rows: [], upsert: true, arrayFilters: '' } }),
    deleteOne: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'deleteOne' }),
    deleteMany: rowsState([{ field: 'a', value: 'x' }], 'and', { op: 'deleteMany' }),
    createIndex: base({ op: 'createIndex', idx: { keys: [{ field: 'email', dir: '1' }, { field: 'a.b', dir: '-1' }], unique: true, ttl: '', usePartial: true, partial: newGroup('and', [newRow({ field: 'age', op: 'gt', type: 'number', value: '18' })]) } }),
    createIndexTtl: base({ op: 'createIndex', idx: { keys: [{ field: 'createdAt', dir: '1' }], unique: false, ttl: '3600', usePartial: false, partial: newGroup() } }),
    createIndexText: base({ op: 'createIndex', idx: { keys: [{ field: 'title', dir: 'text' }, { field: 'loc', dir: '2dsphere' }], unique: false, ttl: '', usePartial: false, partial: newGroup() } }),
};
// 精確：幾個代表性輸出
assert.equal(out(ops.countDocuments, 'mongosh'), 'db.users.countDocuments({ a: "x" })');
assert.equal(out(ops.countDocuments, 'python'), 'result = db["users"].count_documents({"a": "x"})');
assert.equal(out(ops.distinct, 'mongosh'), 'db.users.distinct("city", { a: "x" })'); assert.equal(out(ops.distinctNoFilter, 'node'), 'const result = await db.collection("users").distinct("city");');
assert.equal(out(ops.findOne, 'node'), 'const result = await db.collection("users").findOne({ a: "x" }, { projection: { secret: 0 } });');
assert.equal(out(ops.deleteMany, 'python'), 'result = db["users"].delete_many({"a": "x"})');
assert.equal(out(ops.deleteOne, 'node'), 'const result = await db.collection("users").deleteOne({ a: "x" });');
assert.equal(out(ops.updateMany, 'python'), ['result = db["users"].update_many(', '  {"a": "x"},', '  {"$set": {"items.$[e].s": 1}},', '  array_filters=[{"e.score": {"$gte": 8}}]', ')'].join('\n'));
assert.equal(out(ops.updateMany, 'mongosh'), ['db.users.updateMany(', '  { a: "x" },', '  { $set: { "items.$[e].s": 1 } },', '  { arrayFilters: [{ "e.score": { $gte: 8 } }] }', ')'].join('\n'));
assert.ok(out(ops.updateOne, 'node').includes('{ upsert: true }'));
assert.equal(out(ops.replaceOne, 'python'), 'result = db["users"].replace_one({"a": "x"}, {"a": "y"}, upsert=True)');
assert.equal(out(ops.createIndexTtl, 'mongosh'), 'db.users.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })');
assert.equal(out(ops.createIndexTtl, 'python'), 'result = db["users"].create_index([("createdAt", 1)], expireAfterSeconds=3600)');
assert.equal(out(ops.createIndexText, 'compass'), '{"title": "text", "loc": "2dsphere"}');
assert.ok(out(ops.createIndex, 'node').includes('partialFilterExpression: { age: { $gt: 18 } }') && out(ops.createIndex, 'node').includes('unique: true'));
assert.ok(out(ops.createIndex, 'python').includes('unique=True') && out(ops.createIndex, 'python').includes('partialFilterExpression={"age": {"$gt": 18}}'));
assert.ok(out(ops.insertOne, 'python').includes('"name": "a\\"b"') && out(ops.insertOne, 'python').includes('True'));
assert.deepStrictEqual(JSON.parse(out(ops.aggregate, 'compass'))[1].$group._id, { city: '$city', a_b: '$a.b' });
assert.ok(out(ops.aggregate, 'mongosh').includes('$literal: "$cash"') && out(ops.aggregate, 'mongosh').includes('y: "$amt"') && out(ops.aggregate, 'mongosh').includes('first: { $first: "$$ROOT" }') && out(ops.aggregate, 'mongosh').includes('cnt1: { $sum: 1 }'));
assert.ok(out(ops.aggregate, 'mongosh').includes('{ $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } }') && out(ops.aggregate, 'mongosh').includes('{ $unwind: "$tags" }') && out(ops.aggregate, 'mongosh').includes('{ $count: "total" }'));
assert.ok(out(ops.aggregate, 'python').startsWith('result = list(db["users"].aggregate(\n  [\n'));
assert.equal(out(base({ op: 'aggregate', stages: [{ ...newStage('group') }] }), 'mongosh'), 'db.users.aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])');

// 錯誤 / 驗證
const bad = (S, frag) => { const r = buildCommand(S); assert.ok(!r.ok && r.errs.some(e => e.includes(frag)), frag + ' <- ' + JSON.stringify(r.errs)); };
bad(base({ op: 'distinct', distinctField: '' }), '欄位'); bad(base({ op: 'aggregate', stages: [] }), '至少加入'); bad(base({ op: 'insertOne', doc: '' }), '請輸入'); bad(base({ op: 'insertOne', doc: '[1]' }), '物件');
bad(base({ op: 'insertMany', doc: '[]' }), '非空'); bad(base({ op: 'insertMany', doc: '[1,2]' }), '物件陣列'); bad(base({ op: 'insertMany', doc: '{"a":1}' }), '陣列');
bad(base({ op: 'find', limit: '-1' }), 'limit'); bad(base({ op: 'find', limit: 'x' }), 'limit'); bad(base({ op: 'find', skip: '1.5' }), 'skip');
bad(base({ op: 'find', sort: [{ field: 'a', dir: '1' }, { field: 'a', dir: '-1' }] }), '重複'); bad(base({ op: 'find', sort: [{ field: 'a', dir: '2' }] }), '方向');
bad(base({ op: 'find', proj: { mode: 'include', fields: '_id', noId: true } }), '衝突'); bad(base({ op: 'find', proj: { mode: 'include', fields: '$x', noId: false } }), '投影');
bad(base({ op: 'updateOne', upd: { rows: [], upsert: false, arrayFilters: '' } }), '至少設定'); bad(base({ op: 'updateOne', upd: { rows: [newUpd({ field: 'a', value: 'x' }), newUpd({ op: '$inc', field: 'a', value: '1' })], upsert: false, arrayFilters: '' } }), '衝突');
bad(base({ op: 'updateOne', upd: { rows: [newUpd({ field: 'a', value: 'x' }), newUpd({ op: '$unset', field: 'a.b' })], upsert: false, arrayFilters: '' } }), '衝突');
bad(base({ op: 'updateOne', upd: { rows: [newUpd({ op: '$inc', field: 'a', value: 'x' })], upsert: false, arrayFilters: '' } }), '數字'); bad(base({ op: 'updateOne', upd: { rows: [newUpd({ op: '$pop', field: 'a', value: '2' })], upsert: false, arrayFilters: '' } }), '$pop');
bad(base({ op: 'updateOne', upd: { rows: [newUpd({ op: '$rename', field: 'a', value: 'a' })], upsert: false, arrayFilters: '' } }), '相同'); bad(base({ op: 'updateOne', upd: { rows: [newUpd({ op: '$rename', field: 'a', value: '' })], upsert: false, arrayFilters: '' } }), '新欄位');
bad(base({ op: 'updateOne', upd: { rows: [newUpd({ field: 'a', value: 'x' })], upsert: false, arrayFilters: '{"a":1}' } }), 'arrayFilters');
bad(base({ op: 'createIndex', idx: { keys: [], unique: false, ttl: '', usePartial: false, partial: newGroup() } }), '至少');
bad(base({ op: 'createIndex', idx: { keys: [{ field: 'a', dir: '1' }, { field: 'b', dir: '1' }], unique: false, ttl: '10', usePartial: false, partial: newGroup() } }), 'TTL');
bad(base({ op: 'createIndex', idx: { keys: [{ field: 'a', dir: 'text' }], unique: false, ttl: '10', usePartial: false, partial: newGroup() } }), 'TTL');
bad(base({ op: 'createIndex', idx: { keys: [{ field: 'a', dir: '1' }], unique: false, ttl: '-5', usePartial: false, partial: newGroup() } }), 'expireAfterSeconds');
bad(base({ op: 'createIndex', idx: { keys: [{ field: 'a', dir: '1' }], unique: false, ttl: '', usePartial: true, partial: newGroup('and', [newRow()]) } }), '部分索引');
for (const [stage, o, frag] of [['limit', { n: '0' }, 'limit'], ['limit', { n: '' }, '請輸入'], ['skip', { n: '-1' }, 'skip'], ['sort', { sort: [] }, '排序'], ['project', { proj: { mode: 'include', fields: '', noId: false } }, '欄位'], ['unwind', { field: '' }, '空白'], ['lookup', { from: 'system.x', localField: 'a', foreignField: 'b', as: 'c' }, 'system'], ['lookup', { from: 'x', localField: '', foreignField: 'b', as: 'c' }, 'localField'], ['count', { name: '$x' }, '名稱'], ['count', { name: '' }, '名稱'], ['addFields', { rows: [{ name: '', value: '', type: 'string' }] }, '至少'], ['addFields', { rows: [{ name: 'a', value: 'x', type: 'number' }] }, '數字'], ['group', { id: '$x' }, '分組'], ['group', { id: 'a', accs: [{ name: 'a.b', op: 'sum', field: 'x' }] }, '名稱'], ['group', { id: 'a', accs: [{ name: '_id', op: 'sum', field: 'x' }] }, '保留'], ['group', { id: 'a', accs: [{ name: 'n', op: 'avg', field: '' }] }, '空白'], ['group', { id: 'a', accs: [{ name: 'n', op: 'zzz', field: 'x' }] }, '未知'], ['group', { id: 'a, a', accs: [] }, '重複']]) {
    bad(base({ op: 'aggregate', stages: [{ ...newStage(stage), ...o }] }), frag);
}
assert.ok(q.compileStages(Array.from({ length: 31 }, () => newStage('count'))).errs.some(e => e.includes('最多')));

// ---- 警告 ----
{
    const w = (S) => buildCommand(S).warns;
    assert.equal(w(base({ op: 'deleteMany' }))[0].level, 'danger'); assert.ok(w(base({ op: 'deleteMany' }))[0].text.includes('條件為空會影響整個集合'));
    assert.equal(w(base({ op: 'updateMany', upd: { rows: [newUpd({ field: 'a', value: 'x' })], upsert: false, arrayFilters: '' } }))[0].level, 'danger');
    assert.equal(w(base({ op: 'deleteOne' }))[0].level, 'danger'); assert.equal(w(base({ op: 'replaceOne', doc: '{}' }))[0].level, 'danger');
    assert.equal(w(ops.deleteMany)[0].level, 'info'); assert.ok(w(ops.deleteMany)[0].text.includes('countDocuments'));
    assert.equal(w(ops.updateMany)[0].level, 'info'); assert.equal(w(ops.deleteOne).length, 0); assert.equal(w(base()).length, 0); assert.equal(w(ops.updateOne).length, 0);
    // 只剩空白列也算空條件
    assert.equal(w(base({ op: 'deleteMany', filter: newGroup('and', [newRow()]) }))[0].level, 'danger');
}

// ---- 跳脫：字串在四種格式 ----
const NASTY = ['He said "hi" \\ back', 'line1\nline2\r\nline3\ttab', "it's `tpl` ${x}", '中文 é 😀 \u2028\u2029 end', 'ctrl \u0001\u001f\u007f nul\u0000 x', 'lone \ud800 high', '', ' lead / slash \\/ ', '\\n literal backslash-n', '$notop', '</script>'];
const hasPy = (() => { try { return spawnSync('python', ['-I', '-c', 'import ast, json'], { encoding: 'utf8' }).status === 0; } catch { return false; } })();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-'));
const HARNESS = `import json, sys
from datetime import datetime, timezone
sys.stdout.reconfigure(encoding='utf-8')
class ObjectId:
    def __init__(s, h): s.h = h
log = []
class Chain:
    def __getattr__(s, m):
        def f(*a, **k):
            log.append([m, list(a), k]); return Chain()
        return f
    def __iter__(s): return iter([])
class DB:
    def __getitem__(s, n): return Chain()
db = DB()
def enc(o):
    if isinstance(o, ObjectId): return {"$oid": o.h}
    if isinstance(o, datetime): return {"$date": o.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (o.microsecond // 1000)}
    raise TypeError(repr(o))
src = open(sys.argv[1], encoding='utf-8').read()
src = "\\n".join(l for l in src.split("\\n") if not l.startswith("from bson"))
exec(compile(src, 'gen', 'exec'), globals())
print(json.dumps(log, default=enc))
`;
fs.writeFileSync(path.join(tmp, 'h.py'), HARNESS);
let pyN = 0;
const runPy = (code) => {
    const f = path.join(tmp, 'c.py'); fs.writeFileSync(f, code, 'utf8');
    const r = spawnSync('python', ['-I', path.join(tmp, 'h.py'), f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr + '\n' + code); pyN++;
    return JSON.parse(r.stdout);
};
// 正規化：把各語言執行後的值轉成 Extended JSON 樣子
const norm = (v) => {
    if (Object.prototype.toString.call(v) === "[object RegExp]") return v.flags ? { $regex: v.source, $options: v.flags } : { $regex: v.source };
    if (Object.prototype.toString.call(v) === "[object Date]") return { $date: v.toISOString() };
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
    return v;
};
const recorder = () => {
    const log = [];
    const chain = new Proxy(function () { }, { get: (_, p) => p === 'then' ? undefined : (...a) => { log.push([p, a.map(norm)]); return chain; } });
    const db = new Proxy({}, { get: (_, p) => p === 'getCollection' ? () => chain : p === 'collection' ? () => chain : chain });
    return { log, db };
};
function evalMongosh(code) {
    const { log, db } = recorder();
    const sb = vm.createContext({ db, ObjectId: (h) => ({ $oid: h }), ISODate: (s) => ({ $date: s }), NumberLong: (x) => x });
    new vm.Script(code); // 語法
    vm.runInContext(code, sb);
    return log;
}
async function evalNode(code) {
    const { log, db } = recorder();
    function ObjectId(h) { this.$oid = h; }
    const sb = vm.createContext({ db, ObjectId });
    // Date 在另一個 realm，instanceof 不同；改用 duck-typing 前先把 Date 換成簽名物件
    sb.Date = function (s) { return { $date: new global.Date(s).toISOString() }; };
    const res = vm.runInContext(`(async () => { ${code} })()`, sb); await res;
    return log;
}
const looseNorm = (l) => JSON.parse(JSON.stringify(l));
// 對每個案例：mongosh / node / python 的第一個引數相同，並和 Compass 的 JSON 一致（regex 含 / 或換行者另外測）
async function crossCheck(name, S, argIdx = [0]) {
    const r = buildCommand(S); assert.ok(r.ok, name + JSON.stringify(r.errs));
    const sh = evalMongosh(render(r.cmd, 'mongosh')[0].text);
    const nd = await evalNode(render(r.cmd, 'node')[0].text);
    const key = (log) => log[0][1];
    for (const i of argIdx) assert.deepStrictEqual(looseNorm(key(nd)[i]), looseNorm(key(sh)[i]), name + ' node vs mongosh');
    if (hasPy) { const py = runPy(render(r.cmd, 'python')[0].text); for (const i of argIdx) assert.deepStrictEqual(looseNorm(py[0][1][i]), looseNorm(key(sh)[i]), name + " python vs mongosh " + JSON.stringify([py[0][1][i], key(sh)[i]])); }
    const cp = render(r.cmd, 'compass');
    for (const p of cp.filter(x => x.json)) JSON.parse(p.text);
    if (r.cmd.filter !== undefined && r.cmd.op !== 'distinct') assert.deepStrictEqual(JSON.parse(cp[0].text), looseNorm(sh[0][1][0]), name + ' compass vs mongosh');
    return sh;
}
(async () => {
    // 1) 各種字串當作值，經 eq / in / contains / 欄位名 / insert 文件
    for (const s of NASTY) {
        const nm = JSON.stringify(s);
        await crossCheck('eq ' + nm, rowsState([{ field: 'f', op: 'eq', value: s }]));
        await crossCheck('field ' + nm, rowsState([{ field: 'k' + s.replace(/[.$\0]/g, '_'), op: 'eq', value: 'v' }]));
        await crossCheck('doc ' + nm, base({ op: 'insertOne', doc: JSON.stringify({ [s || 'e']: s, nested: [s, { [s || 'e']: s }] }) }));
        const sh = await crossCheck('ne ' + nm, rowsState([{ field: 'f', op: 'ne', value: s }]));
        assert.deepStrictEqual(sh[0][1][0].f.$ne, s);
    }
    // 還原確認：mongosh 執行後的字串與原字串完全相同（非只是彼此一致）
    for (const s of NASTY) { const r = buildCommand(rowsState([{ field: 'f', value: s }])); const log = evalMongosh(render(r.cmd, 'mongosh')[0].text); assert.strictEqual(log[0][1][0].f, s, JSON.stringify(s)); }
    ok('mongo-query: string escapes match across mongosh / node / python / compass');

    // 2) 值型別 / 運算子的跨語言一致
    const T = [
        { field: '_id', op: 'eq', type: 'oid', value: '507f1f77bcf86cd799439011' }, { field: 'at', op: 'gte', type: 'date', value: '2024-05-06T07:08:09.123Z' }, { field: 'at', op: 'lt', type: 'date', value: '2024-05-07' },
        { field: 'n', op: 'in', type: 'number', value: '1, 2.5, -3' }, { field: 'names', op: 'nin', type: 'string', value: 'a, b' }, { field: 'ids', op: 'in', type: 'oid', value: '507f1f77bcf86cd799439011, 507f1f77bcf86cd799439012' },
        { field: 'e', op: 'exists', value: 'false' }, { field: 't', op: 'type', value: 'string' }, { field: 'r', op: 'regex', value: '^a.*b$', opt: 'im' }, { field: 'c', op: 'contains', value: 'a.b (c) "q" \\ x', opt: 'i' },
        { field: 'arr', op: 'elemMatch', type: 'object', value: '{"s":{"$gt":5},"d":{"$date":"2024-01-01T00:00:00Z"}}' }, { field: 'sz', op: 'size', value: '2' }, { field: 'md', op: 'mod', value: '4, 1' },
        { field: 'b', op: 'eq', type: 'bool', value: 'true' }, { field: 'nu', op: 'eq', type: 'null' }, { field: 'j', op: 'eq', type: 'object', value: '{"a":[1,{"b":null}],"c":"d"}' }, { field: 'x.y.z', op: 'gte', type: 'number', value: '1e21' },
    ];
    for (const r of T) await crossCheck('row ' + r.op + r.type, rowsState([r]));
    await crossCheck('all rows and', rowsState(T.map((r, i) => ({ ...r, field: 'f' + i }))));
    await crossCheck('all rows or', rowsState(T.map(r => r), 'or'));
    await crossCheck('nested', base({ filter: newGroup('and', [newGroup('or', T.slice(0, 4).map(r => newRow(r))), newRow({ field: 'z', value: '1' }), newGroup('or', T.slice(4, 8).map(r => newRow(r)))]) }));
    ok('mongo-query: all types / operators / nesting evaluate identically in every format');

    // 3) 全部操作：語法可解析、第一（二）引數一致
    const twoArg = new Set(['updateOne', 'updateMany', 'replaceOne']);
    for (const [name, S] of Object.entries(ops)) {
        const r = buildCommand(S); assert.ok(r.ok, name + JSON.stringify(r.errs));
        if (name.startsWith('createIndex')) { evalMongosh(render(r.cmd, 'mongosh')[0].text); await evalNode(render(r.cmd, 'node')[0].text); if (hasPy) runPy(render(r.cmd, 'python')[0].text); continue; }
        await crossCheck(name, S, twoArg.has(S.op) ? [0, 1] : [0]);
    }
    // 長輸出（會換行）也要能解析
    const longS = base({ op: 'aggregate', stages: Array.from({ length: 10 }, (_, i) => ({ ...newStage('group'), id: 'field' + i, accs: [{ name: 'someLongAccumulatorName' + i, op: 'sum', field: 'amount.value' + i }] })) });
    const lg = render(buildCommand(longS).cmd, 'mongosh')[0].text; assert.ok(lg.includes('\n  '), '長輸出應該換行');
    await crossCheck('long', longS);
    ok('mongo-query: every operation parses and agrees (' + (hasPy ? 'python ran ' + pyN + ' snippets' : 'python missing: ast check skipped') + ')');

    // 4) 正規表示式含 / 與換行：字面值要能解析且行為正確
    for (const [pat, flags, yes, no] of [['a/b', 'i', 'A/B', 'ab'], ['a\\/b', '', 'a/b', 'ab'], ['line\nbreak', 'm', 'line\nbreak', 'linebreak'], ['x\\\nbreak', '', 'x\nbreak', 'xbreak'], ['[/]+', '', '//', 'a'], ['tab\there', '', 'tab\there', 'x']]) {
        const r = buildCommand(rowsState([{ field: 'f', op: 'regex', value: pat, opt: flags }]));
        assert.ok(r.ok, pat);
        const code = render(r.cmd, 'mongosh')[0].text;
        const sb = vm.createContext({ db: new Proxy({}, { get: () => ({ find: (f) => f }) }) });
        const re = vm.runInContext(code, sb).f;
        assert.ok(re.test(yes), pat + ' => ' + code); if (no !== null) assert.ok(!re.test(no), pat);
        assert.ok(render(r.cmd, 'node')[0].text.includes(code.slice(code.indexOf('/'), code.lastIndexOf('/') + 1 + flags.length)), 'node 與 mongosh 相同的字面值');
    }
    // $regex 字串形式保留原樣
    assert.equal(out(rowsState([{ field: 'f', op: 'regex', value: 'a/b\nc' }]), 'compass'), '{"f": {"$regex": "a/b\\nc"}}');
    ok('mongo-query: regex literals with slash / newline');

    // 5) 範本
    const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);
    for (const [name] of q.TEMPLATES) {
        const S = { ...q.defaultState(), ...q.template(name, { n: '7', page: '3' }, NOW), coll: 'c' };
        const r = buildCommand(S); assert.ok(r.ok, name + JSON.stringify(r.errs));
        await crossCheck('tpl ' + name, S);
    }
    const tp = (n, p) => ({ ...q.defaultState(), ...q.template(n, p, NOW), coll: 'c' });
    assert.equal(out(tp('recentDays', { n: 3 }), 'compass').split('\n')[0], '{"createdAt": {"$gte": {"$date": "2026-10-05T12:00:00.000Z"}}}');
    const ro = out(tp('recentOid', { n: 1 }), 'mongosh'); assert.ok(ro.includes('_id: { $gte: ObjectId("' + U.oid.fromDate(NOW - 86400000, '00') + '") }'));
    assert.equal(out(tp('missing'), 'compass'), '{"$or": [{"field": {"$exists": false}}, {"field": null}, {"field": ""}]}');
    assert.equal(out(tp('paging', { n: 20, page: 3 }), 'mongosh'), 'db.c.find({}).sort({ _id: 1 }).skip(40).limit(20)');
    assert.equal(out(tp('paging', { n: 'x', page: 0 }), 'mongosh'), 'db.c.find({}).sort({ _id: 1 }).skip(0).limit(20)');
    assert.ok(out(tp('dupes'), 'mongosh').includes('{ $match: { count: { $gt: 1 } } }') && out(tp('dupes'), 'mongosh').includes('ids: { $push: "$_id" }'));
    assert.ok(out(tp('latest'), 'mongosh').includes('latest: { $first: "$$ROOT" }'));
    assert.ok(out(tp('fuzzy'), 'mongosh').includes('name: /關鍵字/i'));
    assert.ok(out(tp('groupCount'), 'mongosh').includes('{ $sort: { count: -1 } }'));
    assert.doesNotThrow(() => q.template('recentOid', { n: 1e9 }, NOW)); assert.deepStrictEqual(q.template('nope', {}, NOW), {});
    // 範本不會帶入使用者輸入（集合名稱由頁面保留，不在範本內）
    assert.equal(q.template('fuzzy', {}, NOW).coll, undefined);
    ok('mongo-query: templates');

    // 6) 偏好
    assert.deepStrictEqual(q.loadOpts(null), { op: 'find', fmt: 'mongosh' }); assert.deepStrictEqual(q.loadOpts('x'), { op: 'find', fmt: 'mongosh' }); assert.deepStrictEqual(q.loadOpts([1]), { op: 'find', fmt: 'mongosh' });
    assert.deepStrictEqual(q.loadOpts({ op: 'deleteMany', fmt: 'python' }), { op: 'deleteMany', fmt: 'python' }); assert.deepStrictEqual(q.loadOpts({ op: 'rm -rf', fmt: 5 }), { op: 'find', fmt: 'mongosh' });
    assert.deepStrictEqual(q.loadOpts({ op: 'createIndex', extra: 'coll' }), { op: 'createIndex', fmt: 'mongosh' }, '不帶出其他欄位');
    ok('mongo-query: opts validation');
})().then(() => fs.rmSync(tmp, { recursive: true, force: true })).catch((e) => { console.error(e); process.exit(1); });
