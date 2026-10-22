// 批次 i10：HTTP 請求頁的 GraphQL（排版 / 檢查 / 請求模型）、首頁本機儲存空間的純函式
const { load, ok } = require('./_load');
const assert = require('assert');
const H = load('utils/http-request.html', 'gqlTokens, gqlFormat, gqlCheck, gqlCompose, gqlModel');
const { gqlTokens, gqlFormat, gqlCheck, gqlCompose, gqlModel } = H;
const sig = (s) => gqlTokens(s).toks.filter(t => t.v !== ',').map(t => t.t + ':' + t.v);   // 逗號在 GraphQL 無意義

{ // 排版不改語意：token 序列（略過逗號）不變，且排版是冪等的
    const Q = [
        'query GetUser($id: ID!, $n: Int = 10) @cached { user(id: $id, filter: {a: [1,2,"x, y"], b: ENUM}) { id, name # 名字\n posts(first: $n) { ...PostBits ... on Post { title } } } }\nfragment PostBits on Post { id body(format: "a#b") }',
        '{ a b c(x: 1) { d } }',
        '# 開頭註解\nmutation { like(id: "1") { ok } }',
        'query Q($aaaaaaaaaaaa: String!, $bbbbbbbbbbbbbb: String!, $cccccccccccccc: String!, $dddddddddddd: String!) { f(a: $aaaaaaaaaaaa, b: $bbbbbbbbbbbbbb, c: $cccccccccccccc, d: $dddddddddddd) }',
        'query { s(t: """block "quote" \n here""") @include(if: true) @skip(if: false) x: y }',
    ];
    for (const q of Q) {
        const f = gqlFormat(q);
        assert.deepEqual(sig(f), sig(q), '語意不變：' + q.slice(0, 30));
        assert.equal(gqlFormat(f), f, '冪等：' + q.slice(0, 30));
    }
    assert.equal(gqlFormat('query A{u{id name}}'), 'query A {\n  u {\n    id\n    name\n  }\n}');
    assert.equal(gqlFormat('query($a:Int=1){f(x:$a,y:[1,2])}'), 'query($a: Int = 1) {\n  f(x: $a, y: [1, 2])\n}');
    assert.equal(gqlFormat('{ a ...F ... on T { b } }'), '{\n  a\n  ...F\n  ... on T {\n    b\n  }\n}');
    assert.equal(gqlFormat('{ a # c\n b }'), '{\n  a  # c\n  b\n}');
    assert.ok(gqlFormat('{ a(x: "# not comment") }').includes('"# not comment"'));
    assert.equal(gqlFormat(''), '');
    assert.equal(gqlFormat('query A { a }\nquery B { b }'), 'query A {\n  a\n}\n\nquery B {\n  b\n}');
    const wrapped = gqlFormat(Q[3]); assert.ok(wrapped.split('\n').some(l => l.startsWith('    b: ')), '過長的引數一行一個');
    ok('i10 gql: tokenizer / format');
}

{ // 檢查
    const c = (q, v, o) => gqlCheck(q, v, o);
    assert.deepEqual(c('query Q($id: ID!) { u(id: $id) { n } }', '{"id":"1"}'), { errors: [], warns: [], ops: ['Q'] });
    assert.ok(c('query Q { u { n }', '').errors.some(e => e.includes('沒有結尾')));
    assert.ok(c('query Q { u } }', '').errors.some(e => e.includes('多出的')));
    assert.ok(c('query Q { u(a: 1] }', '').errors.some(e => e.includes('不成對')));
    assert.ok(c('query Q { u(id: $id) }', '').errors.some(e => e.includes('$id') && e.includes('沒有')), '未定義變數');
    assert.ok(c('query Q($id: ID) { u }', '').warns.some(w => w.includes('$id') && w.includes('沒有用到')), '宣告未使用');
    assert.ok(c('query { u }', '').warns.some(w => w.includes('沒有操作名稱')));
    assert.ok(c('{ u }', '').warns.some(w => w.includes('沒有操作名稱')));
    assert.ok(c('query A { a } query { b }', '').errors.some(e => e.includes('多個操作')));
    assert.ok(c('query A { a } query A { b }', '').errors.some(e => e.includes('重複')));
    assert.ok(c('query A { a } query B { b }', '').warns.some(w => w.includes('operationName')));
    assert.deepEqual(c('query A { a } query B { b }', '', 'B').errors, []);
    assert.ok(c('query A { a } query B { b }', '', 'Z').errors.some(e => e.includes('找不到')));
    assert.ok(c('query Q($id: ID!) { u(id: $id) }', '{}').warns.some(w => w.includes('必填')));
    assert.deepEqual(c('query Q($id: ID! = "1") { u(id: $id) }', '{}').warns, [], '有預設值不算缺');
    assert.ok(c('query Q($id: ID!) { u(id: $id) }', '{"id":1,"zz":2}').warns.some(w => w.includes('zz')));
    assert.ok(c('query Q { u }', '{bad').errors.some(e => e.includes('JSON')));
    assert.ok(c('query Q { u }', '[1]').errors.some(e => e.includes('物件')));
    assert.ok(c('query Q { u(a: "x) }', '').errors.some(e => e.includes('字串')));
    assert.deepEqual(c('', '').errors, ['查詢是空的']);
    assert.deepEqual(c('query Q($l: [Int!]! , $s: String) { f(a: $l, b: $s) }', '{"l":[1]}').warns, [], '串列型別與可為空變數');
    assert.deepEqual(c('fragment F on T { a(x: $v) } query Q($v: Int) { ...F }', '').warns.filter(w => w.includes('沒有用到')).length, 1, 'fragment 內的變數不檢查宣告');
    ok('i10 gql: check');
}

{ // 表單組合與請求模型
    assert.equal(gqlCompose({ type: 'query', name: 'GetUser', decl: '$id: ID!', sel: 'user(id: $id) { name }' }), 'query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n  }\n}');
    assert.equal(gqlCompose({ type: 'mutation', name: '', decl: '', sel: 'a' }), 'mutation {\n  a\n}');
    assert.equal(gqlCompose({ type: 'x', name: '', decl: '($a: Int)', sel: 'a' }), 'query($a: Int) {\n  a\n}');
    assert.equal(gqlCompose({ type: 'query', sel: '{a}' }), '{\n  a\n}', '完整查詢只排版');
    const m = gqlModel({ url: 'api.example.com/graphql', query: 'query Q { a }', variables: '{"x":1}', opName: 'Q', headers: 'Authorization: Bearer t' });
    assert.equal(m.method, 'POST'); assert.equal(m.url, 'http://api.example.com/graphql');
    assert.deepEqual(JSON.parse(m.body), { query: 'query Q { a }', operationName: 'Q', variables: { x: 1 } });
    assert.ok(m.headers.some(([k, v]) => k === 'Content-Type' && v === 'application/json'));
    assert.ok(m.headers.some(([k]) => k === 'Authorization'));
    const m2 = gqlModel({ url: 'https://a/g', query: '{a}', variables: '', opName: '', headers: 'content-type: application/graphql+json' });
    assert.deepEqual(JSON.parse(m2.body), { query: '{a}' }); assert.equal(m2.headers.filter(([k]) => k.toLowerCase() === 'content-type').length, 1);
    assert.ok(gqlModel({ url: '', query: '{a}' }).error); assert.ok(gqlModel({ url: 'https://a', query: ' ' }).error);
    assert.ok(gqlModel({ url: 'https://a', query: '{a}', variables: '{x' }).error); assert.ok(gqlModel({ url: 'https://a', query: '{a}', variables: '[]' }).error);
    ok('i10 gql: compose / model');
}

{ // 首頁：儲存空間
    const S = load('index.html', 'estBytes, fmtSize, stgPct, groupKeys, STG_LIMIT');
    assert.equal(S.estBytes('ab', 'cde'), 10); assert.equal(S.estBytes('k', null), 2);
    assert.equal(S.fmtSize(512), '512 B'); assert.equal(S.fmtSize(1536), '1.5 KB'); assert.equal(S.fmtSize(5 * 1048576), '5.00 MB');
    assert.equal(S.stgPct(S.STG_LIMIT / 2), 50); assert.equal(S.stgPct(0), 0); assert.equal(S.stgPct(52429), 1);
    const g = S.groupKeys([{ key: 'a_1', size: 10 }, { key: 'b_1', size: 500 }, { key: 'zzz', size: 9999 }, { key: 'a_2', size: 30 }, { key: 'b_2', size: 1 }],
        [{ name: 'A 工具', match: k => k.startsWith('a_') }, { name: 'B 工具', match: k => k.startsWith('b_') }]);
    assert.deepEqual(g.map(x => x.name), ['B 工具', 'A 工具', '其他'], '大的在前，其他固定最後');
    assert.deepEqual(g[1].items.map(x => x.key), ['a_2', 'a_1'], '組內依大小排序'); assert.equal(g[0].total, 501);
    assert.deepEqual(S.groupKeys([], []), []);
    assert.equal(S.groupKeys([{ key: 'x', size: 1 }], [])[0].name, '其他');
    ok('i10 home: storage pure');
}
