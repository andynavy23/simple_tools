// 批次 g8（續）：SQL 指令產生器頁面（utils/db-query.html）的「SQL 格式化」
const assert = require('assert');
const { load, ok } = require('./_load');

{ // ---------- sql-query：SQL 格式化 ----------
    const m = load('utils/db-query.html', 'sqlFormat, sqlTokens, sqlSig, sqlSame', '// --- pure:sql ---', '// --- /pure:sql ---');
    const F = (s, o) => m.sqlFormat(s, o);
    // 版面
    assert.equal(F('select a,b from t where x=1 and y=2 order by a desc limit 5;'), 'SELECT\n    a,\n    b\nFROM t\nWHERE x = 1\n    AND y = 2\nORDER BY a DESC\nLIMIT 5;\n');
    assert.equal(F('select a,b from t', { comma: 'first', indent: 2 }), 'SELECT\n  a\n  , b\nFROM t\n');
    assert.equal(F('SELECT a FROM t', { kw: 'lower' }), 'select\n    a\nfrom t\n');
    assert.equal(F('select A from T', { kw: 'keep' }), 'select\n    A\nfrom T\n');
    assert.equal(F('select a from t', { indent: 'tab' }), 'SELECT\n\ta\nFROM t\n');
    assert.equal(F("select case when a=1 then 'x' else 'y' end c from t"), "SELECT\n    CASE\n        WHEN a = 1 THEN 'x'\n        ELSE 'y'\n    END c\nFROM t\n");
    assert.equal(F('select * from (select a from t) q where a in (select 1)'), 'SELECT\n    *\nFROM (\n    SELECT\n        a\n    FROM t\n) q\nWHERE a IN (\n    SELECT\n        1\n)\n');
    assert.equal(F('select a from t where x between 1 and 2 and y=3'), 'SELECT\n    a\nFROM t\nWHERE x BETWEEN 1 AND 2\n    AND y = 3\n');
    assert.equal(F('select count(*), f(a,b), x::int, -1, a - -b from t'), 'SELECT\n    COUNT(*),\n    f(a, b),\n    x::int,\n    -1,\n    a - -b\nFROM t\n');
    assert.equal(F('select distinct top 5 a from t'), 'SELECT DISTINCT TOP 5\n    a\nFROM t\n');
    assert.equal(F('select a from t; select b from u'), 'SELECT\n    a\nFROM t;\n\nSELECT\n    b\nFROM u\n');
    assert.equal(F('insert into t(a) values (1)'), 'INSERT INTO t (a)\nVALUES\n    (1)\n');
    assert.equal(F('select a from t join u on t.id=u.id and u.x=1 left join v using (id)'), 'SELECT\n    a\nFROM t\nJOIN u ON t.id = u.id\n    AND u.x = 1\nLEFT JOIN v USING (id)\n');
    assert.equal(F('update t set a=1,b=2 where id=3'), 'UPDATE t\nSET\n    a = 1,\n    b = 2\nWHERE id = 3\n');
    assert.equal(F('create table t (id int, n text)'), 'CREATE TABLE t (\n    id int,\n    n text\n)\n');
    assert.equal(F('select a -- c\nfrom t'), 'SELECT\n    a -- c\nFROM t\n');
    assert.equal(F('-- head\nselect 1'), '-- head\nSELECT\n    1\n');
    assert.equal(F(''), ''); assert.equal(F('  \n '), ''); assert.equal(F(';'), ';\n');
    // 字串、註解、引號識別字原封不動（含看起來像關鍵字或註解的內容）
    const lit = "select 'select from -- /* where', \"from\" , `order by`, [group by] from t /* and or\n  keep */ where a = 'it''s'";
    const out = F(lit);
    for (const frag of ["'select from -- /* where'", '"from"', '`order by`', '[group by]', '/* and or\n  keep */', "'it''s'"]) assert.ok(out.includes(frag), frag + '\n' + out);
    // 識別字的大小寫不動；關鍵字才轉
    assert.ok(F('select Name, "Mixed" from MyTable').includes('Name,') && F('select Name from MyTable').includes('MyTable'));
    assert.ok(F('select t.order, t.from from t').includes('t.order') && !/\bORDER\b/.test(F('select t.order from t')));
    // 語意不變：語料逐一比對 token 序列（忽略空白與大小寫），並且重複格式化結果不變
    const corpus = [
        "select a,b,c from t where x=1 and y in (1,2,3) or z between 1 and 5 order by a desc limit 10;",
        "SELECT u.id, COUNT(*) AS n, CASE WHEN u.age > 18 THEN 'adult' WHEN u.age IS NULL THEN 'n/a' ELSE 'minor' END AS grp FROM users u LEFT JOIN orders o ON o.uid = u.id AND o.deleted = 0 WHERE u.id IN (SELECT uid FROM banned WHERE reason = 'it''s -- not a comment') GROUP BY u.id HAVING COUNT(*) > 1 ORDER BY n DESC",
        "with a as (select 1 x), b as (select 2 y) select * from a, b union all select 3, 4",
        "insert into t (a,b) values (1,'x'),(2,'y') on conflict (a) do update set b = excluded.b;",
        "update t set a=1, b=b+1 where id=3; delete from t where id=3; -- done",
        "create table if not exists t (id int primary key, name varchar(10) not null, price decimal(10,2) default 0, check (price >= 0));",
        "select -1, - -1, a-b, a - -b, x::int, y->>'k', z #> '{a}', @v, :p, $1, ?, [col name], \"Quoted \"\"id\"\"\", `bq`, e'a\\'b', $$dollar 'x' $$, $tag$ a $tag$ from t",
        "select /* c1 */ a, -- line\n b /* c2 */ from t -- end", "select 1 -- trailing", "-- header\nselect 1;\n\n\n/* b */ select 2",
        "select distinct top 5 a from t", "select top (10) percent a from t", "select distinct on (a) a, b from t",
        "select count(*), sum(x) over (partition by a order by b), left(a,1), replace(x,'a','b') from t",
        "select * from t for update", "select a from t where x is distinct from y", "select ((a+b)*c) from ((select 1) union (select 2)) q",
        "select case when a then case when b then 1 else 2 end else 3 end from t", "select a from t where (x = 1 or y = 2) and (z = 3 or (w = 4 and v = 5))",
        "insert into t select * from s", "select * from t1 cross join t2 natural left outer join t3 cross apply f(x)",
        "select 1abc, 1e5, 0xFF, .5, 1.5e-3 from t", "select arr[1], array[1,2], m[1:2] from t",
        "select ,", "select a,,b", ";;;", "select x from", "select ) from (", "((( select", "select a from t where",
        "SELECT 'a' || 'b', a<>b, a!=b, a<=b, a>=b, a=-1 FROM t WHERE a=-1 AND b= +2", "select * from \"My Table\" t join `x y` using (id)",
        "select 中文 as 名稱 from 表 where 欄='值' and x like '%測試%'", "merge into t using s on t.id = s.id when matched then update set a = 1 when not matched then insert (a) values (1);",
        "select a from t where x in (select y from z where w in (select v from u where q = 1))", "select\n\n\n a\n\n from\n t", "select a b, c d from t e",
        "SELECT * FROM t WHERE a = 1 -- c1\nAND b = 2", "insert into t values (1,2) returning id", "alter table t add column c int; drop table t; create index i on t(a, b desc)",
        "select a from t order by 1 limit 5 offset 10 fetch next 5 rows only", "select 1--1\n,2", "select a/*x*/b", "select 'a' 'b'", "select a from t where b = - -1",
        "select x'ff', n'x', b'01' from t", "select \"a\"\"b\", 'a\\\\' from t","select $1, $2 from t where a = $1", "select a from t /* unterminated-not */",
    ];
    for (const s of corpus) for (const o of [{}, { kw: 'lower', comma: 'first', indent: 2 }, { kw: 'keep', indent: 'tab' }, { bsEscape: true }]) {
        const f = F(s, o);
        assert.ok(m.sqlSame(s, f, o), 'token 不一致：' + JSON.stringify(s) + '\n' + f);
        assert.equal(F(f, o), f, '重複格式化結果不同：' + JSON.stringify(s) + '\n' + f);
    }
    // 隨機組合（固定種子）：任意 token 拼接也不能丟例外、語意不變
    let seed = 12345; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    const V = ['select', 'from', 'where', 'and', 'or', 'not', 'a', 'b.c', '1', '2.5', "'s'", '"q"', '(', ')', ',', ';', '=', '<>', '-', '+', '*', '/', '||', '::', '--c\n', '/*c*/', 'case', 'when', 'then', 'else', 'end', 'join', 'left', 'on', 'group', 'by', 'order', 'insert', 'into', 'values', 'update', 'set', 'with', 'as', 'between', 'in', 'is', 'null', '[x]', '`y`', '$1', ':p', '?', '.', '[', ']', '\n', 'union', 'all', 'top', 'distinct', 'create', 'table'];
    for (let k = 0; k < 400; k++) {
        const n = 1 + rnd(30); let s = '';
        for (let j = 0; j < n; j++) s += V[rnd(V.length)] + (rnd(3) ? ' ' : '');
        let f; try { f = F(s); } catch (e) { assert.ok(/沒有結尾/.test(e.message), '非預期錯誤：' + e.message + ' ← ' + JSON.stringify(s)); continue; }
        assert.ok(m.sqlSame(s, f), '隨機輸入 token 不一致：' + JSON.stringify(s) + '\n' + f);
        assert.equal(F(f), f, '隨機輸入重複格式化不同：' + JSON.stringify(s) + '\n' + f);
    }
    // 壞輸入
    for (const bad of ["select 'abc", 'select "abc', 'select `abc', 'select /* abc', 'select $$abc', 'select $t$ abc $x$']) assert.throws(() => F(bad), /沒有結尾/, bad);
    assert.throws(() => F('x'.repeat(300001)), /太長/);
    assert.doesNotThrow(() => F('('.repeat(5000) + ')'.repeat(5000)));
    assert.doesNotThrow(() => F('select ' + '('.repeat(2000) + '1' + ')'.repeat(2000)));
    assert.doesNotThrow(() => F('select ' + 'case when a then '.repeat(500) + '1' + ' end'.repeat(500)));
    assert.doesNotThrow(() => F('select * from ' + '(select * from '.repeat(300) + 't' + ') x'.repeat(300)));
    assert.ok(F('select a from t where b = ' + "'" + 'x'.repeat(100000) + "'").length > 100000);
    // 反斜線跳脫只在 bsEscape（MySQL）時生效；E'' 字串永遠生效
    assert.equal(m.sqlTokens("select 'a\\' b'", { bsEscape: true }).length, 2); assert.throws(() => m.sqlTokens("select 'a\\' b'", {}), /沒有結尾/);
    assert.equal(m.sqlTokens("select 'a\\' from t", {}).length, 4, '標準 SQL：反斜線不是跳脫字元');
    assert.equal(m.sqlTokens("select e'a\\' b'").length, 2);
    // # 後面要空白才是註解（MySQL 風格）；否則是運算子（PG 的 #>）
    assert.equal(m.sqlTokens('select 1 # note')[2].type, 'lcom'); assert.equal(m.sqlTokens("select a #> 'x'")[2].type, 'op');
    // 註解保留
    const cm = F('select 1 /* a */, 2 -- b\nfrom t -- c');
    assert.ok(cm.includes('/* a */') && cm.includes('-- b') && cm.includes('-- c'));
    ok('sql-query: formatter');
}
