// 批次 g8：JSON 整理器（查詢 / 設定檔轉換 / 正規化 / 欄位選取 / 型別輸出 / i18n）、文字差異（JSON 結構）、SQL 格式化
const assert = require('assert');
const { load, ok } = require('./_load');

{ // ---------- json-formatter ----------
    const m = load('utils/json-formatter.html', 'queryJSON, queryText, parseConfig, toConfig, cfgInfer, normalizeJSON, unsafeNumbers, listFields, pickFields, caseKey, generateTypes, i18nParse, i18nSerialize, i18nCompare, i18nFlatten, formatJSON');
    const Q = (v, e) => { const r = m.queryJSON(v, e); assert.ok(r.ok, e + ' -> ' + r.error); return r.values; };
    const QE = (v, e) => { const r = m.queryJSON(v, e); assert.ok(!r.ok, '應該失敗：' + e); return r.error; };
    const J = (x) => JSON.stringify(x);
    const store = { book: [{ t: 'A', p: 8, tags: ['x'] }, { t: 'B', p: 12, tags: [] }, { t: 'C', p: 15.5 }], bike: { color: 'red', p: 20 }, 'we ird': 1 };

    // JSONPath
    assert.equal(J(Q({ a: { b: [1, 2, 3] } }, '$.a.b[0]')), '[1]');
    assert.equal(J(Q({ a: { b: [1, 2, 3] } }, '$.a.b[-1]')), '[3]');
    assert.equal(J(Q({ a: [1, 2, 3] }, '$.a[*]')), '[1,2,3]');
    assert.equal(J(Q({ a: [1, 2, 3] }, '$.a[0,2]')), '[1,3]');
    assert.equal(J(Q({ a: [1, 2, 3, 4, 5] }, '$.a[1:3]')), '[2,3]');
    assert.equal(J(Q({ a: [1, 2, 3, 4, 5] }, '$.a[::2]')), '[1,3,5]');
    assert.equal(J(Q({ a: [1, 2, 3, 4, 5] }, '$.a[-2:]')), '[4,5]');
    assert.equal(J(Q(store, '$.book[*].t')), '["A","B","C"]');
    assert.equal(J(Q(store, '$..p')), '[8,12,15.5,20]');
    assert.equal(J(Q(store, "$['we ird']")), '[1]');
    assert.equal(J(Q(store, '$["bike"]["color"]')), '["red"]');
    assert.equal(J(Q(store, "$.bike['color','p']")), '["red",20]');
    assert.equal(J(Q(store, '$.book[?(@.p>10)].t')), '["B","C"]');
    assert.equal(J(Q(store, '$.book[?(@.p>10 && @.p<15)].t')), '["B"]');
    assert.equal(J(Q(store, "$.book[?(@.p<9 || @.t=='C')].t")), '["A","C"]');
    assert.equal(J(Q(store, '$.book[?(@.tags)].t')), '["A","B"]');
    assert.equal(J(Q(store, '$.book[?(!@.tags)].t')), '["C"]');
    assert.equal(J(Q(store, '$.book[?@.t=="A"].p')), '[8]');
    assert.equal(J(Q(store, '$.book[?(@.p>"x")].t')), '[]', '型別不同不比較');
    assert.ok(Q(store, '$..*').length > 10);
    assert.equal(J(Q(store, '$')), J([store]));
    assert.equal(J(Q(store, '$.nope.deep')), '[]');
    assert.equal(J(Q([1, [2, [3]]], '$..[0]')), '[1,2,3]');
    assert.equal(J(Q(JSON.parse('{"a":{"__proto__":5}}'), '$.a.__proto__')), '[5]');
    assert.equal(J(Q({}, '$.__proto__')), '[]', '不讀原型鏈');
    assert.equal(J(Q({}, '$.constructor')), '[]');
    // jq
    const D = { a: { b: [10, 20, 30] }, users: [{ n: 'x', age: 20, tags: ['a', 'b'] }, { n: 'y', age: 15, tags: [] }, { n: 'z', age: 31, tags: ['c'] }], s: 'héllo', nul: null };
    assert.equal(J(Q(D, '.a.b')), '[[10,20,30]]');
    assert.equal(J(Q(D, '.a.b[1]')), '[20]');
    assert.equal(J(Q(D, '.a.b[-1]')), '[30]');
    assert.equal(J(Q(D, '.a.b[]')), '[10,20,30]');
    assert.equal(J(Q(D, '.a.b[1:]')), '[[20,30]]');
    assert.equal(J(Q(D, '.')), J([D]));
    assert.equal(J(Q(D, '.users[].n')), '["x","y","z"]');
    assert.equal(J(Q(D, '.users | map(.n)')), '[["x","y","z"]]');
    assert.equal(J(Q(D, '.users | map(select(.age > 18)) | map(.n)')), '[["x","z"]]');
    assert.equal(J(Q(D, '.users[] | select(.age >= 20 and .age < 30) | .n')), '["x"]');
    assert.equal(J(Q(D, '.users[] | select(.tags | length > 0) | .n')), '["x","z"]');
    assert.equal(J(Q(D, '.users | length')), '[3]');
    assert.equal(J(Q(D, '.s | length')), '[5]');
    assert.equal(J(Q(D, '.nul | length')), '[0]');
    assert.equal(J(Q(D, '.a | keys')), '[["b"]]');
    assert.equal(J(Q(D, '.a.b | keys')), '[[0,1,2]]');
    assert.equal(J(Q(D, '.users | map(.age) | add')), '[66]');
    assert.equal(J(Q(D, '.users | map(.age) | sort | reverse')), '[[31,20,15]]');
    assert.equal(J(Q(D, '.users | sort_by(.age) | map(.n)')), '[["y","x","z"]]');
    assert.equal(J(Q(D, '.users | map(.n) | join("-")')), '["x-y-z"]');
    assert.equal(J(Q(D, '.users | first | .n')), '["x"]');
    assert.equal(J(Q(D, '.users | last | .n')), '["z"]');
    assert.equal(J(Q(D, '.users | map(.age) | min')), '[15]');
    assert.equal(J(Q(D, '.users | map(.age) | max')), '[31]');
    assert.equal(J(Q(D, '[.users[].tags[]]')), '[["a","b","c"]]');
    assert.equal(J(Q(D, '[.users[].tags[]] | unique')), '[["a","b","c"]]');
    assert.equal(J(Q(D, '.users | map(.tags) | flatten')), '[["a","b","c"]]');
    assert.equal(J(Q(D, '.a | has("b")')), '[true]');
    assert.equal(J(Q(D, '.a | has("zz")')), '[false]');
    assert.equal(J(Q(D, '.nope')), '[null]');
    assert.equal(J(Q(D, '.nope.deeper')), '[null]');
    assert.equal(J(Q(D, '.["a"].b[0]')), '[10]');
    assert.equal(J(Q(D, '."a"."b"')), '[[10,20,30]]');
    assert.equal(J(Q(D, '.users[0].tags[0]?')), '["a"]');
    assert.equal(J(Q(D, '.s[]?')), '[]');
    assert.equal(J(Q(D, '.a | type')), '["object"]');
    assert.equal(J(Q(D, '.a.b[0] | tostring')), '["10"]');
    assert.equal(J(Q({ x: '12' }, '.x | tonumber')), '[12]');
    assert.equal(J(Q(D, '.users[] | select(.n == "y") | .age | not')), '[false]');
    assert.equal(J(Q(D, '.users | map(.nope) | length')), '[3]');
    assert.equal(Q(D, '[..] | length')[0] > 10, true);
    assert.equal(J(Q(null, '.a')), '[null]');
    assert.equal(J(Q([], '.[]')), '[]');
    assert.equal(J(Q(D, '.a.b | .[0] == 10')), '[true]');
    assert.equal(J(Q(D, 'true')), '[true]');
    assert.equal(J(Q(D, '"hi"')), '["hi"]');
    assert.equal(J(Q(D, '.users[] | select(.n | . == "x") | .age')), '[20]');
    // 錯誤
    for (const e of ['', '   ', '.a +', '.a | foo', '{a: 1}', '.a, .b', '.[', '.a[', '.[x]', '.a == ', 'select(', '.a | select', '$.', '$[', '$.a[?(', "$.a['x", '$.a[abc]', '$.a[::0]', '$.a[?(@.x =~ 1)]', '.x =~ "a"', '"abc', '$.a)', '.a)', '|', '. |', '.users | map(', '$.a[?()]', '@', '.a @', 'if . then 1 else 2 end', '.a | sort_by', 'limit(1; .[])', '.. ..'])
        QE(D, e);
    assert.ok(/不支援/.test(QE(D, '.a | foo')), '明確報不支援');
    assert.ok(/不支援/.test(QE(D, '{a: 1}')));
    assert.ok(/無法用鍵/.test(QE(D, '.s | .a')));
    QE({ a: 5 }, '.a.b'); QE({ a: 5 }, '.a[]'); QE({ a: 5 }, '.a[0]');
    assert.equal(m.queryJSON(D, 'x'.repeat(2001)).ok, false);
    // 結果上限、深層巢狀
    const big = m.queryJSON(Array.from({ length: 20000 }, (_, i) => i), '.[]');
    assert.ok(big.ok && big.values.length === 10000 && big.cut);
    let deep = 0; for (let i = 0; i < 400; i++) deep = [deep];
    assert.equal(Q(deep, '..').length, 401);
    let deep2 = 0; for (let i = 0; i < 3000; i++) deep2 = [deep2];
    assert.equal(m.queryJSON(deep2, '$..*').ok, false);
    assert.equal(m.queryText({ mode: 'jq', values: [1, { a: 2 }] }), '1\n{\n  "a": 2\n}');
    assert.equal(m.queryText({ mode: 'jq', values: [] }), '（沒有輸出）');
    assert.equal(m.queryText({ mode: 'jsonpath', values: [] }), '[]');
    ok('json query: JSONPath + jq subset');

    // ---- 設定檔 ----
    const P = (t, k, o) => m.parseConfig(t, k, o);
    let r = P('; c\nname = app\n[db]\nhost=localhost  ; inline\nport = 5432\npass = "a;b # c"\nempty =\n[db.x]\nk: v\n', 'ini');
    assert.equal(J(r.value), '{"name":"app","db":{"host":"localhost","port":"5432","pass":"a;b # c","empty":""},"db.x":{"k":"v"}}');
    r = P('a=1\nb=true\nc=1.5\nd=007\ne="1"\nf=-0\ng=99999999999999999999\nh=null\n', 'ini', { infer: true });
    assert.equal(J(r.value), '{"a":1,"b":true,"c":1.5,"d":"007","e":"1","f":"-0","g":"99999999999999999999","h":"null"}');
    r = P('[a.b]\nc.d = 1\n', 'ini', { nest: true });
    assert.equal(J(r.value), '{"a":{"b":{"c":{"d":"1"}}}}');
    r = P('a = 1\n[s]\nb = 2\n[s]\nc = 3\n', 'ini');
    assert.equal(J(r.value), '{"a":"1","s":{"b":"2","c":"3"}}');
    r = P('x = 1\nx = 2\ngarbage line\n[]\n=novalue\n[ok]\n', 'ini');
    assert.equal(J(r.value), '{"x":"2","ok":{}}'); assert.equal(r.warnings.length, 4);
    r = P('k = "unterminated\nk2 = "a" tail\n', 'ini'); assert.equal(r.warnings.length, 2);
    r = P('\uFEFFa=1\r\nb=2\r\n', 'ini'); assert.equal(J(r.value), '{"a":"1","b":"2"}');
    r = P('# c\n! c2\na=b\nc : d\ne f\ng\\ h=i\nlong=a\\\n   b\\\n   c\nuni=\\u4e2d\\n\\t.\nsp =  keep \nh#=1\n', 'properties');
    assert.equal(J(r.value), '{"a":"b","c":"d","e":"f","g h":"i","long":"abc","uni":"中\\n\\t.","sp":"keep ","h#":"1"}');
    r = P('a=1\\\\\nb=2\n', 'properties'); assert.equal(J(r.value), '{"a":"1\\\\","b":"2"}', '偶數個反斜線不續行');
    r = P('a.b=1\na.c=2\nd=3\n', 'properties', { nest: true, infer: true }); assert.equal(J(r.value), '{"a":{"b":1,"c":2},"d":3}');
    r = P('a=1\na.b=2\n', 'properties', { nest: true }); assert.equal(J(r.value), '{"a":"1"}'); assert.equal(r.warnings.length, 1);
    r = P('a.b=1\na=2\n', 'properties', { nest: true }); assert.equal(J(r.value), '{"a":{"b":"1"}}'); assert.equal(r.warnings.length, 1);
    r = P('a..b=1\n.c=2\n', 'properties', { nest: true }); assert.equal(J(r.value), '{"a..b":"1",".c":"2"}');
    r = P('# c\nA=1\nexport B="x y\\nz"\nC=\'lit $X\'\nD=plain # note\nE=${A}/x\n1BAD=1\nNOEQ\nF = spaced\n', 'env');
    assert.equal(J(r.value), '{"A":"1","B":"x y\\nz","C":"lit $X","D":"plain","E":"${A}/x","F":"spaced"}');
    assert.ok(r.warnings.some(w => /變數參照/.test(w)) && r.warnings.length === 3);
    r = P('__proto__=1\nconstructor=2\n[__proto__]\nx=1\n', 'ini'); assert.equal(Object.keys(r.value).length, 2); assert.equal(({}).polluted, undefined); assert.equal(Object.prototype.x, undefined);
    assert.equal(J(P('', 'ini').value), '{}');
    assert.throws(() => P('a', 'toml'), /未知/);
    // 反向
    let t = m.toConfig({ name: 'app', n: 1, on: true, nil: null, db: { host: 'h', 'p ort': 5, deep: { x: 1 } }, tags: ['a', 'b'], s: ' pad ', q: 'say "hi"' }, 'ini');
    assert.ok(/^name = app\nn = 1\non = true\nnil = \n/.test(t.text), t.text);
    assert.ok(/\[db\]\nhost = h\np ort = 5\ndeep\.x = 1\n/.test(t.text));
    assert.ok(t.text.includes('[tags]') && t.text.includes('0 = a'));
    assert.ok(t.text.includes('s = " pad "') && t.text.includes('q = "say \\"hi\\""'));
    assert.ok(t.warnings.length >= 3);
    const rt = P(t.text, 'ini'); assert.equal(rt.value.db.host, 'h'); assert.equal(rt.value.s, ' pad '); assert.equal(rt.value.q, 'say "hi"');
    t = m.toConfig({ a: 'x y', b: 'c=d', 'k e': '#v', n: '\n1', u: '中' }, 'properties');
    assert.equal(t.text, 'a=x y\nb=c=d\nk\\ e=#v\nn=\\n1\nu=中\n');
    const rp = P(t.text, 'properties'); assert.equal(J(rp.value), J({ a: 'x y', b: 'c=d', 'k e': '#v', n: '\n1', u: '中' }));
    t = m.toConfig({ db: { host: 'h', pw: 'a b', multi: 'a\nb', q: "it's\nx" } }, 'env');
    assert.equal(t.text, "DB_HOST=h\nDB_PW='a b'\nDB_MULTI=\"a\\nb\"\nDB_Q=\"it's\\nx\"\n");
    assert.ok(t.warnings.length >= 1);
    for (const bad of [[], 'x', null, 5]) assert.throws(() => m.toConfig(bad, 'ini'), /最上層/);
    assert.equal(m.toConfig({}, 'env').text, '');
    assert.equal(m.toConfig({ a: {}, b: [] }, 'ini').warnings.length, 2);
    ok('json config: ini / properties / env both ways');

    // ---- 正規化 ----
    const n = m.normalizeJSON({ b: 1.0, a: { z: null, y: [null, 2], x: '', w: {}, v: [] }, c: 1.23456 }, { sort: true, dropNull: true, dropEmpty: true, decimals: 2 });
    assert.equal(J(n.value), '{"a":{"y":[null,2]},"b":1,"c":1.23}'); assert.deepEqual(n.stats, { nulls: 1, empties: 3, rounded: 1 });
    assert.equal(J(m.normalizeJSON({ b: 1, a: 2 }, {}).value), '{"b":1,"a":2}');
    assert.equal(J(m.normalizeJSON({ b: 1, a: 2 }, { sort: true }).value), '{"a":2,"b":1}');
    assert.equal(J(m.normalizeJSON(JSON.parse('{"a":1.0,"b":1e2,"c":1.50}'), {}).value), '{"a":1,"b":100,"c":1.5}');
    assert.equal(J(m.normalizeJSON(5, { sort: true }).value), '5');
    assert.equal(J(m.normalizeJSON([{ b: 1, a: null }], { sort: true, dropNull: true }).value), '[{"b":1}]');
    assert.equal(J(m.normalizeJSON({ a: 1.5 }, { decimals: 0 }).value), '{"a":2}');
    assert.equal(J(m.normalizeJSON({ a: 1.5 }, { decimals: '' }).value), '{"a":1.5}');
    assert.throws(() => m.normalizeJSON({ a: 1.5 }, { decimals: 'x' }), /小數位數/);
    assert.equal(J(m.normalizeJSON(JSON.parse('{"__proto__":{"x":1},"a":null}'), { sort: true, dropNull: true }).value), '{"__proto__":{"x":1}}');
    assert.equal(({}).x, undefined);
    let d2 = 0; for (let i = 0; i < 1500; i++) d2 = [d2]; assert.throws(() => m.normalizeJSON(d2, {}), /1000/);
    assert.deepEqual(m.unsafeNumbers('{"a":12345678901234567890,"b":"99999999999999999999","c":12,"d":1.5e30}'), ['12345678901234567890']);
    assert.deepEqual(m.unsafeNumbers('{"a":"x\\"123456789012345678901"}'), []);
    ok('json normalize');

    // ---- 欄位選取與改名 ----
    assert.deepEqual(m.listFields({ a: 1, b: 2 }), ['a', 'b']);
    assert.deepEqual(m.listFields([{ a: 1 }, { b: 2, a: 3 }]), ['a', 'b']);
    assert.equal(m.listFields([1, 2]), null); assert.equal(m.listFields([]), null); assert.equal(m.listFields('x'), null); assert.equal(m.listFields(null), null);
    assert.equal(J(m.pickFields([{ a: 1, b: 2, c: 3 }, { a: 4, c: 5 }], [{ key: 'a', keep: true, to: 'x' }, { key: 'c', keep: true, to: '' }, { key: 'b', keep: false }])), '[{"x":1,"c":3},{"x":4,"c":5}]');
    assert.equal(J(m.pickFields({ userName: 1, 'last-name': 2 }, [{ key: 'userName', keep: true }, { key: 'last-name', keep: true }], 'snake')), '{"user_name":1,"last_name":2}');
    assert.equal(J(m.pickFields({ user_name: 1 }, [{ key: 'user_name', keep: true, to: 'Keep_Me' }], 'camel')), '{"Keep_Me":1}', '手動改名優先');
    assert.throws(() => m.pickFields({ a: 1, b: 2 }, [{ key: 'a', keep: true, to: 'b' }, { key: 'b', keep: true }]), /重複/);
    assert.throws(() => m.pickFields({ a: 1 }, [{ key: 'a', keep: false }]), /至少/);
    assert.throws(() => m.pickFields([1], [{ key: 'a', keep: true }]), /物件/);
    assert.equal(J(m.pickFields({ a: 1 }, [{ key: 'a', keep: true, to: '__proto__' }])), '{"__proto__":1}');
    assert.equal(({}).a, undefined);
    const C = { 'user_name': ['userName', 'user_name', 'user-name', 'UserName'], 'HTTPServer': ['httpserver', 'httpserver', 'httpserver', 'Httpserver'], 'a b': ['aB', 'a_b', 'a-b', 'AB'] };
    for (const [k, [c, s, kb, p]] of Object.entries(C)) { assert.equal(m.caseKey(k, 'camel'), c); assert.equal(m.caseKey(k, 'snake'), s); assert.equal(m.caseKey(k, 'kebab'), kb); assert.equal(m.caseKey(k, 'pascal'), p); }
    assert.equal(m.caseKey('___', 'snake'), '___'); assert.equal(m.caseKey('x', ''), 'x');
    ok('json pick/rename');

    // ---- 型別輸出 ----
    const G = (v, l, o) => m.generateTypes(v, l, o);
    let g = G([{ id: 1, user_name: 'a', score: 1, big: 5000000000, ok: true, tags: ['x'], addr: { city: 'T', zip: null }, mix: [1, 'a'], none: null }, { id: 2, user_name: 'b', score: 1.5, big: 1, ok: false, tags: [], addr: { city: 'U', zip: '1' }, extra: 1 }], 'graphql', { name: 'Users' });
    assert.ok(g.includes('type User {') && g.includes('type Addr {'), g);
    assert.ok(/id: ID! # 欄位名稱是 id → ID/.test(g), g);
    assert.ok(/score: Float! # 整數與小數並存/.test(g));
    assert.ok(/big: Float! # GraphQL 的 Int 只有 32 位元/.test(g));
    assert.ok(/tags: \[String!\]!/.test(g));
    assert.ok(/zip: String #/.test(g) && /extra: Int # 不是每筆都有/.test(g));
    assert.ok(/mix: \[JSON!\] #/.test(g)); assert.ok(g.startsWith('scalar JSON'));
    assert.ok(/none: JSON #/.test(g));
    assert.ok(/user_name: String!/.test(g));
    g = G({ 'a-b': 1, '9x': 2, __y: 3, '': 4, a_b: 5 }, 'graphql');
    assert.ok(/a_b: Int! # 原鍵名 "a-b"/.test(g) && /f9x: Int!/.test(g) && /_y: Int!/.test(g) && /f: Int!/.test(g) && /a_b_2: Int!/.test(g), g);
    assert.ok(/_empty/.test(G({}, 'graphql')));
    assert.ok(/無法產生/.test(G([1, 2], 'graphql')) && /無法產生/.test(G('x', 'graphql')) && /無法產生/.test(G(null, 'graphql')));
    g = G({ query: { Query: 1, String: { a: 1 } } }, 'graphql'); assert.ok(/type Query\w+ \{|type Query2/.test(g), g);
    // protobuf
    let p = G([{ id: 1, userName: 'a', n: 1.5, big: 3000000000, flag: true, tags: ['a'], pts: [[1]], any: [], e: { x: 1 } }, { id: 2, userName: 'b', n: 2, big: 1, flag: null }], 'proto', { name: 'Item' });
    assert.ok(p.startsWith('syntax = "proto3";') && p.includes('import "google/protobuf/struct.proto";'), p);
    assert.ok(/int32 id = 1;/.test(p) && /string user_name = 2;/.test(p) && !/user_name = 2 \[json_name/.test(p), p);
    assert.ok(/double n = 3; \/\/ 整數與小數並存/.test(p) && /int64 big = 4; \/\/ 數值超出 32 位元/.test(p), p);
    assert.ok(/optional bool flag = 5;/.test(p), p);
    assert.ok(/repeated string tags = 6; \/\/ 陣列 → repeated/.test(p) && /repeated google\.protobuf\.Value pts = 7; \/\/ protobuf 不支援陣列的陣列/.test(p) && /repeated google\.protobuf\.Value any = 8; \/\/ 空陣列/.test(p), p);
    assert.ok(/optional E e = 9;/.test(p) && /message E \{/.test(p), p);
    p = G({ 'a-b': 1, 'A b': 2, X: 3, '': 4, '1x': 5 }, 'proto');
    assert.ok(/int32 a_b = 1 \[json_name = "a-b"\];/.test(p) && /int32 a_b_2 = 2 \[json_name = "A b"\];/.test(p) && /int32 x = 3 \[json_name = "X"\];/.test(p) && /int32 f = 4 \[json_name = ""\];/.test(p) && /int32 f1x = 5 \[json_name = "1x"\];/.test(p), p);
    assert.ok(!/import/.test(G({ a: 1 }, 'proto')));
    assert.ok(/無法產生/.test(G(5, 'proto')));
    p = G({ a: 1, b: null }, 'proto'); assert.ok(/google\.protobuf\.Value b = 2; \/\/ 只有 null/.test(p), p);
    // SQL
    const rows = [{ id: 1, name: 'a', price: 1.5, qty: 2, ts: '2024-01-01T10:00:00Z', d: '2024-01-01', u: '123e4567-e89b-12d3-a456-426614174000', ok: true, meta: { a: 1 }, tags: ['x'], n: null, big: 9000000000 }, { id: 2, name: 'b', price: 2, qty: 3, ts: '2024-01-02T10:00:00Z', d: '2024-01-02', u: '123e4567-e89b-12d3-a456-426614174001', ok: false, meta: {}, tags: [], n: 'x', big: 1, opt: 1 }];
    let s = G(rows, 'sql', { name: 'myOrders', dialect: 'pg' });
    assert.ok(s.includes('CREATE TABLE "my_orders" ('), s);
    for (const re of [/"id" INTEGER NOT NULL PRIMARY KEY, -- id → PRIMARY KEY/, /"name" TEXT NOT NULL/, /"price" DOUBLE PRECISION NOT NULL/, /"ts" TIMESTAMPTZ NOT NULL/, /"d" DATE NOT NULL/, /"u" UUID NOT NULL/, /"ok" BOOLEAN NOT NULL/, /"meta" JSONB NOT NULL/, /"n" TEXT,/, /"big" BIGINT NOT NULL/, /"opt" INTEGER -- 不是每筆都有/]) assert.ok(re.test(s), String(re) + '\n' + s);
    assert.ok(/\n\);\n$/.test(s) && !/,[^\n]*\n\);/.test(s), '最後一欄後面不能有逗號');
    s = G(rows, 'sql', { name: 'T', dialect: 'mysql' });
    assert.ok(s.includes('`id` INT NOT NULL PRIMARY KEY') && s.includes('`ts` DATETIME') && s.includes('`u` CHAR(36)') && s.includes('`meta` JSON') && s.includes('`price` DOUBLE'), s);
    s = G(rows, 'sql', { name: 'T', dialect: 'sqlite' });
    assert.ok(s.includes('"ok" INTEGER NOT NULL, -- SQLite 用 0 / 1') && s.includes('"meta" TEXT') && s.includes('"price" REAL') && s.includes('"d" TEXT'), s);
    assert.ok(G({ id: 'abc' }, 'sql', { dialect: 'mysql' }).includes('`id` VARCHAR(255) NOT NULL PRIMARY KEY'));
    s = G({ 'we"ird': 1, 'b`t': 2, '': 3 }, 'sql', { dialect: 'pg' }); assert.ok(s.includes('"we""ird"') && s.includes('"column" INTEGER'), s);
    s = G({ 'b`t': 2 }, 'sql', { dialect: 'mysql' }); assert.ok(s.includes('`b``t`'));
    s = G({ a: 1 }, 'sql', {}); assert.ok(s.includes('"my_table"'));
    s = G({ a: 1 }, 'sql', { dialect: 'bogus' }); assert.ok(s.includes('"my_table"'));
    assert.ok(/無法產生/.test(G([1], 'sql')) && /空物件/.test(G({}, 'sql')));
    assert.ok(G({ id: 1.5, x: 1 }, 'sql').includes('"id" DOUBLE PRECISION NOT NULL') && !/PRIMARY KEY/.test(G({ id: null }, 'sql')));
    assert.ok(/interface Root/.test(G({ a: 5000000000 }, 'ts')), '既有輸出不受 big 旗標影響');
    ok('json types: graphql / protobuf / sql');

    // ---- i18n ----
    const I = (t, f) => m.i18nParse(t, f);
    let a = I('{"nav":{"home":"首頁","about":"關於"},"ok":"好","n":5,"z":null}', 'json');
    assert.deepEqual([...a.map], [['nav.home', '首頁'], ['nav.about', '關於'], ['ok', '好'], ['n', '5'], ['z', '']]); assert.equal(a.warnings.length, 2);
    assert.throws(() => I('{bad', 'json'), /JSON/); assert.throws(() => I('[1]', 'json'), /最上層/); assert.throws(() => I('5', 'json'), /最上層/); assert.throws(() => I('null', 'json'), /最上層/);
    let po = m.i18nSerialize(a.map, 'po').text;
    assert.ok(po.includes('msgid "nav.home"\nmsgstr "首頁"') && po.startsWith('msgid ""\nmsgstr ""'));
    assert.deepEqual([...I(po, 'po').map], [...a.map]);
    const tricky = new Map([['k1', 'line1\nline2 "q" \\ back\ttab'], ['k "2"', ''], ['k.3', '中文 ✓']]);
    for (const f of ['po', 'csv', 'json']) { const s2 = m.i18nSerialize(tricky, f).text; assert.deepEqual([...I(s2, f).map], [...tricky], f + ' 往返'); }
    assert.equal(m.i18nSerialize(new Map([['a', 'x,y'], ['b', 'say "hi"']]), 'csv').text, 'key,value\r\na,"x,y"\r\nb,"say ""hi"""\r\n');
    assert.deepEqual([...I('key,value\na,1\nb,2,3\n,4\n', 'csv').map], [['a', '1'], ['b', '2']]); assert.equal(I('key,value\na,1\nb,2,3\n,4\n', 'csv').warnings.length, 2);
    assert.deepEqual([...I('a,1\nb\n', 'csv').map], [['a', '1'], ['b', '']]);
    assert.throws(() => I('a,"1', 'csv'));
    po = '# c\n#, fuzzy\nmsgid "a"\nmsgstr "x"\n"y"\n\nmsgctxt "c"\nmsgid "b"\nmsgstr "z"\n\nmsgid "n"\nmsgid_plural "ns"\nmsgstr[0] "one"\nmsgstr[1] "many"\n\nmsgid "lo"\n"ng"\nmsgstr ""\n"A"\n"B"\n\nmsgid "last"\nmsgstr "L"';
    a = I(po, 'po'); assert.deepEqual([...a.map], [['a', 'xy'], ['long', 'AB'], ['last', 'L']]); assert.equal(a.warnings.length, 2);
    assert.equal(I('', 'po').map.size, 0); assert.equal(I('garbage\n', 'po').warnings.length, 1);
    const u = m.i18nSerialize(new Map([['a.b', '1'], ['a', '2'], ['c.d.e', '3'], ['c.d', '4']]), 'json'); assert.ok(u.warnings.length >= 1);
    assert.equal(JSON.parse(u.text)['c.d'], '4'); assert.equal(JSON.parse(u.text).c.d.e, '3');
    assert.equal(J(JSON.parse(m.i18nSerialize(new Map([['__proto__.x', '1']]), 'json').text)), '{"__proto__":{"x":"1"}}'); assert.equal(({}).x, undefined);
    assert.throws(() => m.i18nSerialize(new Map(), 'xliff'), /未知/); assert.throws(() => I('', 'xliff'), /未知/);
    assert.deepEqual(m.i18nCompare(new Map([['a', '1'], ['b', '2'], ['c', '3']]), new Map([['a', '1'], ['b', ' '], ['x', 'y']])), { missing: ['c'], extra: ['x'], empty: ['b'] });
    ok('json i18n');
}

{ // ---------- text-diff：JSON 結構 diff ----------
    const m = load('utils/text-diff.html', 'diffJSON, diffJSONText');
    const D = (a, b, o) => m.diffJSON(a, b, o), J = JSON.stringify;
    assert.deepEqual(D({ a: 1 }, { a: 1 }), []);
    assert.deepEqual(D({ a: 1, b: 2 }, { b: 2, a: 1 }), [], '鍵順序不影響');
    assert.deepEqual(D({ a: 1 }, { a: 2 }), [{ t: 'chg', path: '$.a', before: 1, after: 2 }]);
    assert.deepEqual(D({ a: 1 }, { b: 1 }), [{ t: 'del', path: '$.a', before: 1 }, { t: 'add', path: '$.b', after: 1 }]);
    assert.deepEqual(D({ a: { b: [1, 2] } }, { a: { b: [1, 3, 4] } }), [{ t: 'chg', path: '$.a.b[1]', before: 2, after: 3 }, { t: 'add', path: '$.a.b[2]', after: 4 }]);
    assert.deepEqual(D([1, 2, 3], [1]), [{ t: 'del', path: '$[1]', before: 2 }, { t: 'del', path: '$[2]', before: 3 }]);
    assert.deepEqual(D(1, '1'), [{ t: 'chg', path: '$', before: 1, after: '1' }], '型別變更');
    assert.deepEqual(D({ a: null }, { a: 0 }), [{ t: 'chg', path: '$.a', before: null, after: 0 }]);
    assert.deepEqual(D({ a: [] }, { a: {} }), [{ t: 'chg', path: '$.a', before: [], after: {} }], '陣列對物件');
    assert.deepEqual(D({ 'a b': 1, 'x.y': 2 }, { 'a b': 2, 'x.y': 3 }).map(d => d.path), ['$["a b"]', '$["x.y"]']);
    assert.deepEqual(D(JSON.parse('{"__proto__":1}'), JSON.parse('{"__proto__":2}')).map(d => d.path), ['$.__proto__']);
    assert.deepEqual(D({}, JSON.parse('{"constructor":1}')).map(d => d.t), ['add'], '原型鏈上的鍵不算存在');
    assert.deepEqual(D({ a: undefined }, {}), [{ t: 'del', path: '$.a', before: undefined }]);
    // 依鍵比對
    const A = { items: [{ id: 1, p: 5 }, { id: 2, p: 6 }, { id: 3, p: 7 }] }, B = { items: [{ id: 3, p: 7 }, { id: 2, p: 9 }, { id: 4, p: 1 }] };
    assert.deepEqual(D(A, B, { arrayKey: 'id' }), [{ t: 'del', path: '$.items[id=1]', before: { id: 1, p: 5 } }, { t: 'chg', path: '$.items[id=2].p', before: 6, after: 9 }, { t: 'add', path: '$.items[id=4]', after: { id: 4, p: 1 } }]);
    assert.ok(D(A, B).length > 3, '依索引會看到更多差異');
    assert.deepEqual(D([{ id: 1 }], [{ id: '1' }], { arrayKey: 'id' }).map(d => d.t), ['del', 'add'], '1 與 "1" 不同鍵');
    assert.deepEqual(D([{ id: 1, x: 1 }, { id: 1, x: 2 }], [{ id: 1, x: 1 }, { id: 1, x: 3 }], { arrayKey: 'id' }), [{ t: 'chg', path: '$[id=1#2].x', before: 2, after: 3 }], '重複鍵依順序');
    assert.deepEqual(D([{ a: 1 }, 5, { a: 2 }], [{ a: 1 }, 6, { a: 2 }], { arrayKey: 'id' }), [{ t: 'chg', path: '$[?1]', before: 5, after: 6 }]);
    assert.deepEqual(D([{ a: 1 }, 5], [{ a: 2 }, 5], { arrayKey: 'id' }), [{ t: 'chg', path: '$[?0].a', before: 1, after: 2 }], '沒有該鍵的依序配對');
    assert.deepEqual(D([[1], [2]], [[1], [3]], { arrayKey: 'id' }).map(d => d.path), ['$[?1][?0]']);
    assert.deepEqual(D({ l: [{ k: 'a', v: 1 }] }, { l: [{ k: 'a', v: 2 }] }, { arrayKey: 'k' }).map(d => d.path), ['$.l[k=a].v']);
    // 上限與深度
    assert.throws(() => D(Array.from({ length: 10 }, (_, i) => i), [], { max: 5 }), /超過 5 筆/);
    assert.equal(D(Array.from({ length: 5000 }, (_, i) => i), []).length, 5000);
    assert.throws(() => D(Array.from({ length: 5001 }, (_, i) => i), []), /5000/);
    let x = 0, y = 1; for (let i = 0; i < 600; i++) { x = [x]; y = [y]; }
    assert.throws(() => D(x, y), /500/);
    // 文字版
    assert.equal(m.diffJSONText('{"a":1}', '{"a":1}').diffs.length, 0);
    assert.ok(/原始文字不是有效的 JSON/.test(m.diffJSONText('{a', '{}').error));
    assert.ok(/修改後文字不是有效的 JSON/.test(m.diffJSONText('{}', '[').error));
    assert.ok(/原始文字是空的/.test(m.diffJSONText('  ', '{}').error) && /修改後文字是空的/.test(m.diffJSONText('{}', '').error));
    assert.equal(m.diffJSONText('[1]', '[2]').diffs[0].t, 'chg');
    ok('text-diff: JSON structure diff');
}
