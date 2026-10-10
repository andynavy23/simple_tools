// 批次 c1：SQL 指令產生器（utils/sql-query.html）、JSON 整理器「產生型別」
const { load, ok } = require('./_load');
const assert = require('assert');
const { spawnSync } = require('child_process');

{ // ---------- sql-query ----------
    const m = load('utils/sql-query.html', 'compile, generate, defaultState, newRow, newGroup, newCol, newCt, template, toCountCheck, loadOpts, ident, identOne, val, finalize, strLit, parseDate, TEMPLATES, OPS');
    const { newRow: R, newGroup: G, newCol: C, newCt: CT } = m;
    const st = (o = {}) => ({ ...m.defaultState(), table: 'users', ...o });
    const sel = (o) => ({ ...m.defaultState().sel, ...o });
    const D4 = ['mysql', 'pg', 'sqlite', 'mssql'];
    const sql = (S, f = 'sql') => { const r = m.generate(S, f); assert.ok(r.ok, JSON.stringify(r.errs)); return r.parts[0].text; };
    const errs = (S) => m.generate(S, 'sql').errs;
    const w1 = (...rows) => G('and', rows.map(r => R(r)));

    // --- 識別字 ---
    assert.equal(m.ident('users', 'mysql').v, '`users`');
    assert.equal(m.ident('users', 'pg').v, '"users"');
    assert.equal(m.ident('users', 'mssql').v, '[users]');
    assert.equal(m.ident('public.users', 'pg').v, '"public"."users"');
    assert.equal(m.ident('dbo.users', 'mssql').v, '[dbo].[users]');
    assert.equal(m.ident('a b', 'pg').v, '"a b"');
    assert.equal(m.ident('a"b', 'pg').v, '"a""b"', '引號字元加倍');
    assert.equal(m.ident('a`b', 'mysql').v, '`a``b`');
    assert.equal(m.ident('a]b', 'mssql').v, '[a]]b]');
    assert.equal(m.ident('a.b.c', 'pg').v, '"a.b.c"', '三段不是 schema.table → 整段一個識別字');
    assert.equal(m.ident('x"; DROP TABLE y; --', 'pg').v, '"x""; DROP TABLE y; --"');
    assert.equal(m.ident('中文表', 'sqlite').v, '"中文表"');
    assert.ok(m.ident('', 'pg').err); assert.ok(m.ident('   ', 'pg').err);
    assert.ok(m.ident('a\0b', 'pg').err, 'NUL'); assert.ok(m.ident('a\nb', 'pg').err); assert.ok(m.ident('a'.repeat(129), 'pg').err);
    ok('sql-query: identifiers');

    // --- 字面值跳脫 ---
    assert.equal(m.strLit("O'Reilly", 'pg').v, "'O''Reilly'");
    assert.equal(m.strLit("a\\b", 'mysql').v, "'a\\\\b'", 'MySQL 反斜線加倍');
    assert.equal(m.strLit("a\\b", 'pg').v, "'a\\b'");
    assert.equal(m.strLit("a\\'b", 'mysql').v, "'a\\\\''b'");
    assert.equal(m.strLit('x', 'mssql').v, "N'x'");
    assert.ok(m.strLit('a\0b', 'sqlite').err);
    assert.equal(m.strLit('', 'pg').v, "''");
    assert.equal(m.strLit("';DROP TABLE x;--", 'sqlite').v, "''';DROP TABLE x;--'");
    D4.forEach(d => assert.ok(errs(st({ d, where: w1({ field: 'a', value: 'x\0y' }) })).length, 'NUL 值拒絕 ' + d));
    // 值型別
    const lit = (d, type, text) => m.val(type, text, { d, mode: 'lit', params: [] });
    assert.equal(lit('mysql', 'bool', 'true').sql, 'TRUE'); assert.equal(lit('pg', 'bool', 'FALSE').sql, 'FALSE');
    assert.equal(lit('sqlite', 'bool', 'true').sql, '1'); assert.equal(lit('mssql', 'bool', 'false').sql, '0');
    assert.ok(lit('pg', 'bool', 'yes').err);
    assert.equal(lit('pg', 'number', ' -12.5e3 ').sql, '-12.5e3'); assert.equal(lit('pg', 'number', '123456789012345678901234567890').sql, '123456789012345678901234567890');
    ['', 'abc', '1,2', '1; DROP', '0x10', '+1', '1e', '.5', 'NaN', "1' OR '1"].forEach(t => assert.ok(lit('pg', 'number', t).err, 'number ' + t));
    assert.equal(lit('pg', 'null', 'x').sql, 'NULL');
    assert.equal(lit('pg', 'date', '2024-02-29').sql, "'2024-02-29'"); assert.equal(lit('mssql', 'date', '2024-02-29').sql, "'20240229'");
    assert.equal(lit('mysql', 'date', '2024-02-29 10:05').sql, "'2024-02-29 10:05:00'"); assert.equal(lit('mssql', 'date', '2024-02-29T10:05:07').sql, "'2024-02-29T10:05:07'");
    ['2023-02-29', '2024-13-01', '2024-1-1', '2024-01-01 25:00', 'x'].forEach(t => assert.ok(lit('pg', 'date', t).err, 'date ' + t));
    assert.equal(lit('mysql', 'now').sql, 'NOW()'); assert.equal(lit('sqlite', 'now').sql, "datetime('now')"); assert.equal(lit('mssql', 'now').sql, 'GETDATE()');
    assert.equal(lit('mysql', 'daysago', '7').sql, 'NOW() - INTERVAL 7 DAY'); assert.equal(lit('pg', 'daysago', '7').sql, "NOW() - INTERVAL '7 days'");
    assert.equal(lit('sqlite', 'daysago', '7').sql, "datetime('now', '-7 days')"); assert.equal(lit('mssql', 'daysago', '7').sql, 'DATEADD(day, -7, GETDATE())');
    assert.ok(lit('pg', 'daysago', '7; DROP').err); assert.ok(lit('pg', 'daysago', '-1').err);
    assert.equal(lit('mysql', 'ref', 'o.user_id').sql, '`o`.`user_id`');
    assert.ok(lit('pg', 'param', 'a b').err); assert.ok(lit('pg', 'what', 'x').err);
    ok('sql-query: literals and value types');

    // --- 佔位符 / finalize ---
    {
        const r = m.compile(st({ where: w1({ field: 'a', value: 'x' }, { field: 'b', op: 'between', type: 'number', value: '1', value2: '5' }) }), 'param');
        for (const [ph, exp] of [['?', 'a` = ? AND `b` BETWEEN ? AND ?'], ['$', '$1 AND `b` BETWEEN $2 AND $3'], ['@p', '@p1 AND `b` BETWEEN @p2 AND @p3'], ['%s', '%s AND `b` BETWEEN %s AND %s']]) {
            const f = m.finalize(r.sql, r.params, ph); assert.ok(f.sql.includes(exp), ph + ' ' + f.sql); assert.equal(f.params.length, 3);
        }
        const Z = String.fromCharCode(0); assert.deepEqual(m.finalize('a ' + Z + '1' + Z + ' b ' + Z + '0' + Z, [{ v: 'x' }, { v: 'y' }], '$'), { sql: 'a $1 b $2', params: [{ v: 'y' }, { v: 'x' }] }, '依出現順序重排');
        assert.equal(m.finalize("LIKE '%x' " + Z + '0' + Z, [{}], '%s').sql, "LIKE '%%x' %s", 'pyformat 要把 % 加倍');
        assert.equal(m.finalize("LIKE '%x' " + Z + 'nope', [], '?').sql, "LIKE '%x' " + Z + 'nope');
    }
    ok('sql-query: placeholders');

    // --- SELECT 基本 / 方言差異 ---
    assert.equal(sql(st()), 'SELECT *\nFROM `users`;');
    assert.equal(sql(st({ d: 'pg' })), 'SELECT *\nFROM "users";');
    assert.equal(sql(st({ d: 'mssql' })), 'SELECT *\nFROM [users];');
    const paged = (d, lim, off, order = [{ field: 'id', dir: 'asc' }]) => sql(st({ d, sel: sel({ limit: lim, offset: off, orderBy: order }) }));
    assert.equal(paged('mysql', '10', '20'), 'SELECT *\nFROM `users`\nORDER BY `id` ASC\nLIMIT 10 OFFSET 20;');
    assert.equal(paged('sqlite', '10', '20'), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nLIMIT 10 OFFSET 20;');
    assert.equal(paged('pg', '10', '20'), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nLIMIT 10\nOFFSET 20;');
    assert.equal(paged('mssql', '10', '20'), 'SELECT *\nFROM [users]\nORDER BY [id] ASC\nOFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;');
    assert.equal(paged('mssql', '10', ''), 'SELECT TOP 10 *\nFROM [users]\nORDER BY [id] ASC;');
    assert.equal(paged('mssql', '10', '', []), 'SELECT TOP 10 *\nFROM [users];');
    assert.ok(errs(st({ d: 'mssql', sel: sel({ limit: '10', offset: '5' }) })).some(e => e.includes('ORDER BY')), 'mssql OFFSET 需要 ORDER BY');
    assert.equal(paged('mysql', '', '5'), 'SELECT *\nFROM `users`\nORDER BY `id` ASC\nLIMIT 18446744073709551615 OFFSET 5;');
    assert.equal(paged('sqlite', '', '5'), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nLIMIT -1 OFFSET 5;');
    assert.equal(paged('pg', '', '5'), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nOFFSET 5;');
    assert.equal(paged('mssql', '', '5'), 'SELECT *\nFROM [users]\nORDER BY [id] ASC\nOFFSET 5 ROWS;');
    assert.equal(paged('mysql', '10', '0', []), 'SELECT *\nFROM `users`\nLIMIT 10;');
    assert.ok(m.generate(st({ sel: sel({ limit: '10' }) }), 'sql').warns.some(w => w.text.includes('ORDER BY')), '分頁沒排序的提醒');
    ['0', '-1', '1.5', 'abc', '1e3'].forEach(v => assert.ok(errs(st({ sel: sel({ limit: v }) })).length, 'limit ' + v));
    assert.ok(errs(st({ sel: sel({ offset: '-1' }) })).length);
    // 欄位 / 別名 / 聚合 / DISTINCT / FROM 別名
    assert.equal(sql(st({ d: 'pg', sel: sel({ distinct: true, alias: 'u', cols: [C({ field: 'u.name', alias: 'n' }), C({ field: 'u.*' })] }) })).split('\n')[0], 'SELECT DISTINCT "u"."name" AS "n", "u".*');
    assert.equal(sql(st({ d: 'pg', sel: sel({ alias: 'u' }) })), 'SELECT *\nFROM "users" AS "u";');
    assert.equal(sql(st({ d: 'mssql', sel: sel({ distinct: true, limit: '3', cols: [C({ field: 'a' })] }) })).split('\n')[0], 'SELECT DISTINCT TOP 3 [a]');
    assert.equal(sql(st({ sel: sel({ cols: [C({ agg: 'COUNT' }), C({ agg: 'COUNT', field: '*', alias: 'c2' }), C({ agg: 'COUNTD', field: 'u', alias: 'du' }), C({ agg: 'SUM', field: 'p' }), C({ agg: 'AVG', field: 'p' }), C({ agg: 'MIN', field: 'p' }), C({ agg: 'MAX', field: 'p' })] }) })).split('\n')[0],
        'SELECT COUNT(*), COUNT(*) AS `c2`, COUNT(DISTINCT `u`) AS `du`, SUM(`p`), AVG(`p`), MIN(`p`), MAX(`p`)');
    assert.ok(errs(st({ sel: sel({ cols: [C({ agg: 'SUM' })] }) })).length, 'SUM 需欄位'); assert.ok(errs(st({ sel: sel({ cols: [C({ agg: 'SUM', field: '*' })] }) })).length);
    assert.ok(errs(st({ sel: sel({ cols: [C({ agg: 'BAD', field: 'a' })] }) })).length);
    assert.ok(errs(st({ sel: sel({ cols: [C({ field: 'a', alias: 'x' }), C({ field: 'b', alias: 'X' })] }) })).some(e => e.includes('重複')));
    assert.ok(errs(st({ sel: sel({ cols: [C({ field: '*', alias: 'x' })] }) })).length);
    assert.ok(errs(st({ sel: sel({ cols: [C({ field: 'a\nb' })] }) })).length);
    // 串接
    assert.equal(sql(st({ sel: sel({ cols: [C({ agg: 'CONCAT', field: "first, ' ', last", alias: 'full' })] }) })).split('\n')[0], "SELECT CONCAT(`first`, ' ', `last`) AS `full`");
    assert.equal(sql(st({ d: 'sqlite', sel: sel({ cols: [C({ agg: 'CONCAT', field: "first, ' ', last" })] }) })).split('\n')[0], `SELECT "first" || ' ' || "last"`);
    assert.equal(sql(st({ d: 'mssql', sel: sel({ cols: [C({ agg: 'CONCAT', field: "a,'x'" })] }) })).split('\n')[0], "SELECT CONCAT([a], N'x')");
    assert.ok(errs(st({ sel: sel({ cols: [C({ agg: 'CONCAT', field: 'a' })] }) })).length);
    // 無聚合警告
    assert.ok(m.generate(st({ sel: sel({ cols: [C({ field: 'a' }), C({ agg: 'COUNT' })] }) }), 'sql').warns.some(w => w.text.includes('GROUP BY')));
    assert.ok(!m.generate(st({ sel: sel({ cols: [C({ field: 'a' }), C({ agg: 'COUNT' })], groupBy: 'a' }) }), 'sql').warns.some(w => w.text.includes('GROUP BY')));
    // GROUP BY / HAVING / ORDER BY
    assert.equal(sql(st({ d: 'pg', sel: sel({ cols: [C({ field: 'city' }), C({ agg: 'COUNT', alias: 'n' })], groupBy: 'city, status', having: G('and', [R({ agg: 'COUNT', field: '*', op: 'gt', type: 'number', value: '1' })]), orderBy: [{ field: 'n', dir: 'desc' }, { field: 'city', dir: 'asc' }] }) })),
        'SELECT "city", COUNT(*) AS "n"\nFROM "users"\nGROUP BY "city", "status"\nHAVING COUNT(*) > 1\nORDER BY "n" DESC, "city" ASC;');
    assert.ok(errs(st({ where: w1({ agg: 'COUNT', field: '*', value: '1', type: 'number', op: 'gt' }) })).some(e => e.includes('HAVING')), 'WHERE 不能放聚合');
    assert.ok(errs(st({ sel: sel({ orderBy: [{ field: 'a', dir: 'up' }] }) })).length);
    ok('sql-query: select, pagination, aggregates');

    // --- JOIN ---
    const on = (l, r) => G('and', [R({ field: l, op: 'eq', type: 'ref', value: r })]);
    const j = (type, t, a, o) => ({ type, table: t, alias: a, on: o });
    assert.equal(sql(st({ d: 'pg', sel: sel({ alias: 'u', cols: [C({ field: 'u.name' }), C({ field: 'o.total' })], joins: [j('inner', 'orders', 'o', on('u.id', 'o.user_id')), j('left', 'public.items', 'i', on('o.id', 'i.order_id'))] }) })),
        'SELECT "u"."name", "o"."total"\nFROM "users" AS "u"\nINNER JOIN "orders" AS "o" ON "u"."id" = "o"."user_id"\nLEFT JOIN "public"."items" AS "i" ON "o"."id" = "i"."order_id";');
    assert.ok(sql(st({ d: 'pg', sel: sel({ joins: [j('right', 'b', '', on('a', 'b'))] }) })).includes('RIGHT JOIN "b" ON "a" = "b"'));
    assert.ok(sql(st({ d: 'mssql', sel: sel({ joins: [j('full', 'b', '', on('a.x', 'b.x'))] }) })).includes('FULL JOIN [b] ON [a].[x] = [b].[x]'));
    assert.ok(errs(st({ d: 'mysql', sel: sel({ joins: [j('full', 'b', '', on('a', 'b'))] }) })).some(e => e.includes('FULL')), 'MySQL 不支援 FULL JOIN');
    assert.ok(m.generate(st({ d: 'sqlite', sel: sel({ joins: [j('full', 'b', '', on('a', 'b'))] }) }), 'sql').warns.some(w => w.text.includes('3.39')));
    assert.ok(errs(st({ sel: sel({ joins: [j('inner', 'b', '', G('and', []))] }) })).some(e => e.includes('ON')), 'ON 不能空');
    assert.ok(errs(st({ sel: sel({ joins: [j('cross', 'b', '', on('a', 'b'))] }) })).length);
    assert.ok(errs(st({ sel: sel({ joins: [j('inner', '', '', on('a', 'b'))] }) })).length);
    assert.ok(errs(st({ sel: sel({ joins: Array.from({ length: 5 }, () => j('inner', 'b', '', on('a', 'b'))) }) })).some(e => e.includes('最多')), 'JOIN 最多 4 個');
    assert.ok(!errs(st({ sel: sel({ joins: Array.from({ length: 4 }, () => j('inner', 'b', '', on('a', 'b'))) }) })).length);
    ok('sql-query: joins');

    // --- WHERE：各運算子 / 型別 / 群組 ---
    const wh = (d, ...rows) => sql(st({ d, where: w1(...rows) })).split('\n')[2].replace(/;$/, '');
    assert.equal(wh('pg', { field: 'a', op: 'eq', type: 'string', value: 'x' }), `WHERE "a" = 'x'`);
    assert.equal(wh('pg', { field: 'a', op: 'ne', type: 'number', value: '1' }), 'WHERE "a" <> 1');
    assert.equal(wh('pg', { field: 'a', op: 'gt', type: 'number', value: '1' }), 'WHERE "a" > 1');
    assert.equal(wh('pg', { field: 'a', op: 'gte', type: 'number', value: '1' }), 'WHERE "a" >= 1');
    assert.equal(wh('pg', { field: 'a', op: 'lt', type: 'number', value: '1' }), 'WHERE "a" < 1');
    assert.equal(wh('pg', { field: 'a', op: 'lte', type: 'number', value: '1' }), 'WHERE "a" <= 1');
    assert.equal(wh('pg', { field: 'a', op: 'eq', type: 'null' }), 'WHERE "a" IS NULL');
    assert.equal(wh('pg', { field: 'a', op: 'ne', type: 'null' }), 'WHERE "a" IS NOT NULL');
    assert.equal(wh('pg', { field: 'a', op: 'null' }), 'WHERE "a" IS NULL'); assert.equal(wh('pg', { field: 'a', op: 'notnull' }), 'WHERE "a" IS NOT NULL');
    assert.equal(wh('mysql', { field: 'a', op: 'eq', type: 'bool', value: 'true' }), 'WHERE `a` = TRUE'); assert.equal(wh('sqlite', { field: 'a', op: 'eq', type: 'bool', value: 'true' }), 'WHERE "a" = 1');
    assert.equal(wh('pg', { field: 'a', op: 'like', value: 'A%_B' }), `WHERE "a" LIKE 'A%_B'`, '自己寫的 LIKE 不跳脫');
    assert.equal(wh('pg', { field: 'a', op: 'notlike', value: 'A%' }), `WHERE "a" NOT LIKE 'A%'`);
    assert.equal(wh('pg', { field: 'a', op: 'contains', value: 'abc' }), `WHERE "a" LIKE '%abc%'`, '沒有特殊字元就不加 ESCAPE');
    assert.equal(wh('pg', { field: 'a', op: 'contains', value: '50%_!' }), `WHERE "a" LIKE '%50!%!_!!%' ESCAPE '!'`);
    assert.equal(wh('pg', { field: 'a', op: 'startsWith', value: 'a_' }), `WHERE "a" LIKE 'a!_%' ESCAPE '!'`);
    assert.equal(wh('pg', { field: 'a', op: 'endsWith', value: '%x' }), `WHERE "a" LIKE '%!%x' ESCAPE '!'`);
    assert.equal(wh('pg', { field: 'a', op: 'notContains', value: 'x' }), `WHERE "a" NOT LIKE '%x%'`);
    assert.equal(wh('mssql', { field: 'a', op: 'contains', value: '[x]' }), `WHERE [a] LIKE N'%![x]%' ESCAPE '!'`, 'SQL Server 的 [ 要跳脫');
    assert.equal(wh('mysql', { field: 'a', op: 'contains', value: "it's\\" }), "WHERE `a` LIKE '%it''s\\\\%'");
    assert.equal(wh('pg', { field: 'a', op: 'in', type: 'number', value: '1, 2\n3' }), 'WHERE "a" IN (1, 2, 3)');
    assert.equal(wh('pg', { field: 'a', op: 'nin', type: 'string', value: "x,O'R" }), `WHERE "a" NOT IN ('x', 'O''R')`);
    assert.equal(wh('pg', { field: 'a', op: 'between', type: 'number', value: '1', value2: '5' }), 'WHERE "a" BETWEEN 1 AND 5');
    assert.equal(wh('pg', { field: 'a', op: 'between', type: 'date', value: '2024-01-01', value2: '2024-12-31' }), `WHERE "a" BETWEEN '2024-01-01' AND '2024-12-31'`);
    assert.equal(wh('pg', { field: 'a', op: 'eq', type: 'ref', value: 'b' }), 'WHERE "a" = "b"');
    assert.equal(wh('pg', { field: 'a', op: 'gte', type: 'daysago', value: '3' }), `WHERE "a" >= NOW() - INTERVAL '3 days'`);
    assert.equal(wh('mssql', { field: 'a', op: 'lt', type: 'now' }), 'WHERE [a] < GETDATE()');
    assert.equal(wh('pg', { field: 'a', op: 'eq', type: 'param', value: 'minAge' }), 'WHERE "a" = $1');
    assert.equal(wh('mssql', { field: 'a', op: 'eq', type: 'param' }), 'WHERE [a] = @p1');
    // 注入字串
    assert.equal(wh('pg', { field: 'a', op: 'eq', value: "x' OR '1'='1" }), `WHERE "a" = 'x'' OR ''1''=''1'`);
    assert.equal(wh('mysql', { field: 'a', op: 'eq', value: "\\' OR 1=1 -- " }), "WHERE `a` = '\\\\'' OR 1=1 -- '");
    // 錯誤
    const bad = (...rows) => errs(st({ where: w1(...rows) })).length > 0;
    assert.ok(bad({ field: '', value: 'x' }), '有值沒欄位'); assert.ok(bad({ field: 'a', op: 'gt', type: 'null' })); assert.ok(bad({ field: 'a', op: 'in', value: '' }));
    assert.ok(bad({ field: 'a', op: 'in', type: 'null', value: 'x' })); assert.ok(bad({ field: 'a', op: 'in', type: 'number', value: '1,x' }));
    assert.ok(bad({ field: 'a', op: 'between', type: 'number', value: '1', value2: '' })); assert.ok(bad({ field: 'a', op: 'between', type: 'bool', value: 'true', value2: 'false' }));
    assert.ok(bad({ field: 'a', op: 'contains', value: '' })); assert.ok(bad({ field: 'a', op: 'eq', type: 'number', value: '' })); assert.ok(bad({ field: 'a', op: 'zzz' })); assert.ok(bad({ field: 'a', type: 'zzz' }));
    assert.ok(bad({ field: 'a', op: 'in', type: 'number', value: Array.from({ length: 501 }, (_, i) => i).join(',') }), '清單上限');
    // 全空列略過
    assert.equal(sql(st({ where: w1({ field: '', value: '' }) })), 'SELECT *\nFROM `users`;');
    // AND / OR / 群組
    const g = (mode, items) => ({ k: 'grp', mode, items });
    const A = R({ field: 'a', type: 'number', value: '1' }), B = R({ field: 'b', type: 'number', value: '2' }), Cc = R({ field: 'c', type: 'number', value: '3' });
    assert.equal(sql(st({ d: 'pg', where: g('or', [A, B]) })).split('\n')[2].replace(/;$/, ''), 'WHERE "a" = 1 OR "b" = 2');
    assert.equal(sql(st({ d: 'pg', where: g('and', [A, g('or', [B, Cc])]) })).split('\n')[2].replace(/;$/, ''), 'WHERE "a" = 1 AND ("b" = 2 OR "c" = 3)');
    assert.equal(sql(st({ d: 'pg', where: g('or', [A, g('and', [B, Cc])]) })).split('\n')[2].replace(/;$/, ''), 'WHERE "a" = 1 OR ("b" = 2 AND "c" = 3)');
    assert.equal(sql(st({ d: 'pg', where: g('and', [A, g('or', [B])]) })).split('\n')[2].replace(/;$/, ''), 'WHERE "a" = 1 AND "b" = 2', '單一條件的群組不加括號');
    assert.equal(sql(st({ d: 'pg', where: g('and', [A, g('or', [])]) })).split('\n')[2].replace(/;$/, ''), 'WHERE "a" = 1', '空群組略過');
    assert.ok(errs(st({ where: g('and', [A, g('or', [g('and', [B])])]) })).some(e => e.includes('一層')), '最多一層巢狀');
    assert.ok(errs(st({ where: g('and', Array.from({ length: 31 }, () => A)) })).some(e => e.includes('最多')));
    assert.ok(errs(st({ where: { k: 'grp', mode: 'and', items: 'oops' } })).length === 0, '壞資料不炸');
    ok('sql-query: where operators, types, groups');

    // --- 參數化 ---
    {
        const S = st({ d: 'pg', where: w1({ field: 'age', op: 'gte', type: 'number', value: '18' }, { field: 'name', op: 'eq', value: "O'R" }, { field: 'x', op: 'in', type: 'string', value: 'a,b' }, { field: 'y', op: 'eq', type: 'null' }, { field: 'z', op: 'eq', type: 'bool', value: 'true' }, { field: 'd', op: 'gte', type: 'date', value: '2024-01-01' }, { field: 't', op: 'gte', type: 'daysago', value: '7' }, { field: 'u', op: 'eq', type: 'param', value: 'userId' }) });
        const r = m.generate(S, 'param');
        assert.equal(r.parts[0].text, `SELECT *\nFROM "users"\nWHERE "age" >= $1 AND "name" = $2 AND "x" IN ($3, $4) AND "y" IS NULL AND "z" = $5 AND "d" >= $6 AND "t" >= NOW() - INTERVAL '7 days' AND "u" = $7;`);
        assert.equal(r.parts[1].text, '[18, "O\'R", "a", "b", true, "2024-01-01", userId]');
        assert.ok(!r.parts[0].text.includes("O'R"), '參數化版本不含字面值');
        const py = m.generate({ ...S, d: 'mysql' }, 'python').parts[0].text;
        assert.ok(py.includes('%s') && py.includes('params = [18, "O\'R", "a", "b", True, "2024-01-01", userId]') && py.includes('# 請先定義變數：userId'), py);
        const nd = m.generate({ ...S, d: 'mssql' }, 'node').parts[0].text;
        assert.ok(nd.includes("request.input('p1', 18);") && nd.includes("request.input('p7', userId);") && nd.includes('@p7'), nd);
        // 字面值版本的佔位符
        assert.ok(sql(S).includes('"u" = $1') && sql(S).includes("'O''R'"));
        // 特殊字元在參數中原樣保留
        const sp = m.generate(st({ d: 'sqlite', where: w1({ field: 'n', value: "a'b\\c\n\"" }) }), 'param');
        assert.equal(sp.parts[0].text, 'SELECT *\nFROM "users"\nWHERE "n" = ?;'); assert.equal(sp.parts[1].text, '[' + JSON.stringify("a'b\\c\n\"") + ']');
        assert.ok(m.generate(st({ d: 'sqlite', where: w1({ field: 'n', value: "a'b\\c\n\"" }) }), 'python').parts[0].text.includes('params = ["a\'b\\\\c\\n\\""]'));
        // contains 在參數化中仍帶 ESCAPE
        const pc = m.generate(st({ d: 'pg', where: w1({ field: 'n', op: 'contains', value: '5%' }) }), 'param');
        assert.ok(pc.parts[0].text.includes("LIKE $1 ESCAPE '!'") && pc.parts[1].text === '["%5!%%"]');
        // pyformat：識別字含 % 要加倍
        const pf = m.generate(st({ d: 'mysql', table: '100%', where: w1({ field: 'a', value: 'x' }) }), 'python').parts[0].text;
        assert.ok(pf.includes('`100%%`') && pf.includes('`a` = %s'), pf);
        // DDL 的參數化提示
        const dd = m.generate(st({ op: 'createIndex', ix: { name: '', cols: 'a', unique: false, ifNot: false } }), 'param');
        assert.equal(dd.parts.length, 1); assert.ok(dd.warns.some(w => w.text.includes('DDL')));
        // 字面值版本提醒
        assert.ok(m.generate(st(), 'sql').parts[0].note.includes('參數化'));
    }
    ok('sql-query: parameterized output');

    // --- INSERT ---
    const ins = (cols, rows, o = {}) => ({ cols, rows, upsert: false, keys: '', ...o });
    assert.equal(sql(st({ op: 'insert', d: 'pg', ins: ins([{ name: 'id', type: 'number' }, { name: 'name', type: 'string' }], [['1', 'A']]) })), 'INSERT INTO "users" ("id", "name")\nVALUES (1, \'A\');');
    assert.equal(sql(st({ op: 'insert', d: 'pg', ins: ins([{ name: 'id', type: 'number' }], [['1'], ['2']]) })), 'INSERT INTO "users" ("id")\nVALUES\n  (1),\n  (2);');
    assert.equal(sql(st({ op: 'insert', d: 'pg', ins: ins([{ name: 'a', type: 'string' }, { name: 'b', type: 'number' }, { name: 'c', type: 'bool' }, { name: 'd', type: 'date' }], [['', '', '', '']]) })), `INSERT INTO "users" ("a", "b", "c", "d")\nVALUES ('', NULL, NULL, NULL);`, '空白：字串 = 空字串、其他 = NULL');
    assert.equal(sql(st({ op: 'insert', d: 'pg', ins: ins([{ name: 'a', type: 'null' }, { name: 'b', type: 'now' }], [['x', 'x']]) })), 'INSERT INTO "users" ("a", "b")\nVALUES (NULL, NOW());');
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'a', type: 'number' }], [['x']]) })).some(e => e.includes('第 1 列')));
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: '', type: 'string' }], [['x']]) })).length, '沒有欄位');
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'a', type: 'string' }], []) })).length, '沒有資料');
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'a', type: 'string' }, { name: 'A', type: 'string' }], [['1', '2']]) })).some(e => e.includes('重複')));
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'a', type: 'ref' }], [['x']]) })).length);
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'a', type: 'string' }], Array.from({ length: 201 }, () => ['x'])) })).some(e => e.includes('最多')));
    // upsert 四方言
    const up = (d) => sql(st({ op: 'insert', d, ins: ins([{ name: 'id', type: 'number' }, { name: 'name', type: 'string' }], [['1', 'A']], { upsert: true, keys: 'id' }) }));
    assert.equal(up('mysql'), "INSERT INTO `users` (`id`, `name`)\nVALUES (1, 'A')\nON DUPLICATE KEY UPDATE `name` = VALUES(`name`);");
    assert.equal(up('pg'), 'INSERT INTO "users" ("id", "name")\nVALUES (1, \'A\')\nON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";');
    assert.equal(up('sqlite'), up('pg'));
    assert.equal(up('mssql'), "MERGE INTO [users] AS [target]\nUSING (VALUES (1, N'A')) AS [source] ([id], [name])\nON [target].[id] = [source].[id]\nWHEN MATCHED THEN UPDATE SET [target].[name] = [source].[name]\nWHEN NOT MATCHED THEN INSERT ([id], [name]) VALUES ([source].[id], [source].[name]);");
    const upOnly = (d) => sql(st({ op: 'insert', d, ins: ins([{ name: 'id', type: 'number' }], [['1']], { upsert: true, keys: 'id' }) }));
    assert.ok(upOnly('pg').endsWith('DO NOTHING;')); assert.ok(upOnly('mysql').endsWith('`id` = `id`;')); assert.ok(!upOnly('mssql').includes('WHEN MATCHED'));
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'id', type: 'number' }], [['1']], { upsert: true, keys: '' }) })).length);
    assert.ok(errs(st({ op: 'insert', ins: ins([{ name: 'id', type: 'number' }], [['1']], { upsert: true, keys: 'zzz' }) })).some(e => e.includes('zzz')));
    const insP = m.generate(st({ op: 'insert', d: 'pg', ins: ins([{ name: 'id', type: 'number' }, { name: 'n', type: 'string' }], [['1', 'a'], ['2', "b'"]]) }), 'param');
    assert.equal(insP.parts[0].text, 'INSERT INTO "users" ("id", "n")\nVALUES\n  ($1, $2),\n  ($3, $4);'); assert.equal(insP.parts[1].text, '[1, "a", 2, "b\'"]');
    ok('sql-query: insert and upsert');

    // --- UPDATE / DELETE ---
    const up1 = (d, where) => sql(st({ op: 'update', d, upd: [{ field: 'a', type: 'number', value: '1' }, { field: 'b', type: 'string', value: "x'y" }], where: where || w1({ field: 'id', type: 'number', value: '5' }) }));
    assert.equal(up1('pg'), `UPDATE "users"\nSET "a" = 1, "b" = 'x''y'\nWHERE "id" = 5;`);
    assert.equal(up1('mssql'), `UPDATE [users]\nSET [a] = 1, [b] = N'x''y'\nWHERE [id] = 5;`);
    assert.equal(sql(st({ op: 'delete', d: 'mysql', where: w1({ field: 'id', type: 'number', value: '5' }) })), 'DELETE FROM `users`\nWHERE `id` = 5;');
    assert.ok(errs(st({ op: 'update', upd: [{ field: 'a', type: 'number', value: 'x' }] })).length);
    assert.ok(errs(st({ op: 'update', upd: [{ field: '', type: 'string', value: '' }] })).length, '至少一個 SET');
    assert.ok(errs(st({ op: 'update', upd: [{ field: 'a', type: 'string', value: '1' }, { field: 'A', type: 'string', value: '2' }] })).some(e => e.includes('重複')));
    assert.equal(sql(st({ op: 'update', d: 'pg', upd: [{ field: 'a', type: 'ref', value: 'b' }, { field: 'c', type: 'null' }, { field: 'd', type: 'now' }], where: w1({ field: 'id', type: 'number', value: '1' }) })).split('\n')[1], 'SET "a" = "b", "c" = NULL, "d" = NOW()');
    // 警告
    const wr = (S) => m.generate(S, 'sql').warns;
    assert.ok(wr(st({ op: 'delete', where: G('and', [R()]) })).some(w => w.level === 'danger' && w.text.includes('整張表')), '空條件 delete');
    assert.ok(wr(st({ op: 'update', upd: [{ field: 'a', type: 'number', value: '1' }], where: G('and', []) })).some(w => w.level === 'danger'));
    assert.ok(!wr(st({ op: 'delete', where: w1({ field: 'id', type: 'number', value: '1' }) })).some(w => w.level === 'danger'));
    assert.ok(wr(st({ op: 'delete', where: w1({ field: 'id', type: 'number', value: '1' }) })).some(w => w.text.includes('COUNT(*)')));
    assert.ok(!wr(st({ op: 'select' })).some(w => w.level === 'danger'));
    assert.equal(m.generate(st({ op: 'delete', where: G('and', []) }), 'sql').ok, true, '警告但仍產生');
    // 條件有錯時不當成「空條件」
    assert.ok(!wr(st({ op: 'delete', where: w1({ field: 'id', type: 'number', value: 'x' }) })).some(w => w.level === 'danger'));
    assert.equal(m.generate(st({ op: 'delete', where: w1({ field: 'id', type: 'number', value: 'x' }) }), 'sql').parts.length, 0, '條件錯誤時完全不產生指令');
    // 先用 COUNT 確認
    {
        const S = st({ op: 'delete', d: 'pg', where: w1({ field: 'id', type: 'number', value: '5' }) }), c = m.toCountCheck(S);
        assert.equal(sql(c), 'SELECT COUNT(*)\nFROM "users"\nWHERE "id" = 5;');
        assert.equal(m.toCountCheck(st({ op: 'update', where: G('and', []) })).op, 'select'); assert.equal(sql(m.toCountCheck(st({ op: 'update', where: G('and', []) }))), 'SELECT COUNT(*)\nFROM `users`;');
    }
    ok('sql-query: update, delete, danger warnings');

    // --- CREATE TABLE ---
    const ct = (d, cols, o = {}) => sql(st({ op: 'createTable', d, ct: { ifNot: false, cols, ...o } }));
    const full = [CT({ name: 'id', pk: true, ai: true }), CT({ name: 'email', type: 'varchar', len: '100', nn: true, uq: true }), CT({ name: 'bio', type: 'text' }), CT({ name: 'active', type: 'boolean', defType: 'bool', def: 'true' }), CT({ name: 'price', type: 'decimal', len: '8,2', defType: 'number', def: '0' }), CT({ name: 'created', type: 'datetime', defType: 'now' }), CT({ name: 'org_id', type: 'bigint', fk: 'orgs.id' })];
    assert.equal(ct('mysql', full), 'CREATE TABLE `users` (\n  `id` INT AUTO_INCREMENT PRIMARY KEY,\n  `email` VARCHAR(100) NOT NULL UNIQUE,\n  `bio` TEXT,\n  `active` BOOLEAN DEFAULT TRUE,\n  `price` DECIMAL(8,2) DEFAULT 0,\n  `created` DATETIME DEFAULT CURRENT_TIMESTAMP,\n  `org_id` BIGINT,\n  FOREIGN KEY (`org_id`) REFERENCES `orgs` (`id`)\n);');
    assert.equal(ct('pg', full), 'CREATE TABLE "users" (\n  "id" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  "email" VARCHAR(100) NOT NULL UNIQUE,\n  "bio" TEXT,\n  "active" BOOLEAN DEFAULT TRUE,\n  "price" NUMERIC(8,2) DEFAULT 0,\n  "created" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  "org_id" BIGINT,\n  FOREIGN KEY ("org_id") REFERENCES "orgs" ("id")\n);');
    assert.equal(ct('sqlite', full), 'CREATE TABLE "users" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n  "email" TEXT NOT NULL UNIQUE,\n  "bio" TEXT,\n  "active" INTEGER DEFAULT 1,\n  "price" NUMERIC DEFAULT 0,\n  "created" TEXT DEFAULT CURRENT_TIMESTAMP,\n  "org_id" INTEGER,\n  FOREIGN KEY ("org_id") REFERENCES "orgs" ("id")\n);');
    assert.equal(ct('mssql', full), 'CREATE TABLE [users] (\n  [id] INT IDENTITY(1,1) PRIMARY KEY,\n  [email] NVARCHAR(100) NOT NULL UNIQUE,\n  [bio] NVARCHAR(MAX),\n  [active] BIT DEFAULT 1,\n  [price] DECIMAL(8,2) DEFAULT 0,\n  [created] DATETIME2 DEFAULT GETDATE(),\n  [org_id] BIGINT,\n  FOREIGN KEY ([org_id]) REFERENCES [orgs] ([id])\n);');
    assert.ok(ct('pg', [CT({ name: 'a', pk: true }), CT({ name: 'b', pk: true })]).includes('PRIMARY KEY ("a", "b")'), '複合主鍵');
    assert.ok(!ct('pg', [CT({ name: 'a', pk: true }), CT({ name: 'b', pk: true })]).includes('"a" INTEGER PRIMARY KEY'));
    assert.ok(ct('mssql', [CT({ name: 'a', type: 'varchar', len: '5000' })]).includes('NVARCHAR(MAX)'));
    assert.ok(ct('pg', [CT({ name: 'a', type: 'uuid' }), CT({ name: 'b', type: 'json' }), CT({ name: 'c', type: 'double' }), CT({ name: 'd', type: 'blob' })]).includes('"a" UUID,\n  "b" JSONB,\n  "c" DOUBLE PRECISION,\n  "d" BYTEA'));
    assert.ok(ct('mysql', [CT({ name: 'a', type: 'uuid' }), CT({ name: 'b', type: 'smallint' }), CT({ name: 'c', type: 'date' })]).includes('`a` CHAR(36),\n  `b` SMALLINT,\n  `c` DATE'));
    assert.ok(ct('pg', [CT({ name: 'a', defType: 'string', def: "it's" })], { ifNot: true }).startsWith('CREATE TABLE IF NOT EXISTS "users"') && ct('pg', [CT({ name: 'a', defType: 'string', def: "it's" })]).includes("DEFAULT 'it''s'"));
    assert.ok(ct('mssql', [CT({ name: 'a' })], { ifNot: true }).startsWith("IF OBJECT_ID(N'[users]', N'U') IS NULL\nCREATE TABLE [users]"));
    assert.ok(ct('mysql', [CT({ name: 'a', defType: 'null' })]).includes('DEFAULT NULL'));
    const cte = (cols, d = 'mysql') => errs(st({ op: 'createTable', d, ct: { ifNot: false, cols } }));
    assert.ok(cte([]).length, '至少一個欄位'); assert.ok(cte([CT({ name: 'a' }), CT({ name: 'A' })]).some(e => e.includes('重複')));
    assert.ok(cte([CT({ name: 'a', ai: true })]).some(e => e.includes('主鍵')), '自增必須主鍵'); assert.ok(cte([CT({ name: 'a', type: 'text', ai: true, pk: true })]).some(e => e.includes('整數')));
    assert.ok(cte([CT({ name: 'a', ai: true, pk: true }), CT({ name: 'b', ai: true, pk: true })]).length); assert.ok(cte([CT({ name: 'a', ai: true, pk: true }), CT({ name: 'b', pk: true })]).length);
    assert.ok(cte([CT({ name: 'a', ai: true, pk: true, defType: 'number', def: '1' })]).length, '自增不能有預設值');
    assert.ok(cte([CT({ name: 'a', type: 'varchar', len: '0' })]).length); assert.ok(cte([CT({ name: 'a', type: 'varchar', len: 'x' })]).length); assert.ok(cte([CT({ name: 'a', type: 'varchar', len: '65536' })]).length);
    assert.ok(cte([CT({ name: 'a', type: 'decimal', len: '5,6' })]).length); assert.ok(cte([CT({ name: 'a', type: 'decimal', len: '39' })]).length);
    assert.ok(cte([CT({ name: 'a', type: 'weird' })]).length); assert.ok(cte([CT({ name: 'a', defType: 'number', def: 'x' })]).length); assert.ok(cte([CT({ name: 'a', defType: 'wat' })]).length);
    assert.ok(cte([CT({ name: 'a', fk: 'orgs' })]).length); assert.ok(cte([CT({ name: 'a', fk: 'orgs.' })]).length);
    assert.ok(cte([CT({ name: 'a', fk: 'public.orgs.id' })], 'pg').length === 0, 'schema.table.col');
    assert.ok(ct('pg', [CT({ name: 'a', fk: 'public.orgs.id' })]).includes('REFERENCES "public"."orgs" ("id")'));
    ok('sql-query: create table (4 dialects)');

    // --- CREATE INDEX / ALTER ---
    const ix = (d, o) => sql(st({ op: 'createIndex', d, ix: { name: '', cols: 'email', unique: false, ifNot: false, ...o } }));
    assert.equal(ix('pg', {}), 'CREATE INDEX "idx_users_email" ON "users" ("email");');
    assert.equal(ix('mysql', { unique: true, cols: 'a, b DESC', name: 'my_idx' }), 'CREATE UNIQUE INDEX `my_idx` ON `users` (`a`, `b` DESC);');
    assert.equal(ix('sqlite', { ifNot: true }), 'CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");');
    assert.equal(ix('mssql', { ifNot: true }), 'CREATE INDEX [idx_users_email] ON [users] ([email]);');
    assert.ok(m.generate(st({ op: 'createIndex', d: 'mysql', ix: { name: '', cols: 'a', unique: false, ifNot: true } }), 'sql').warns.some(w => w.text.includes('IF NOT EXISTS')));
    assert.equal(sql(st({ op: 'createIndex', d: 'pg', table: 'public.users', ix: { name: '', cols: 'first name', unique: false, ifNot: false } })), 'CREATE INDEX "idx_users_first_name" ON "public"."users" ("first name");', '自動名稱消毒');
    assert.ok(ix('pg', { name: 'a"b' }).includes('"a""b"'));
    assert.ok(errs(st({ op: 'createIndex', ix: { name: '', cols: '', unique: false, ifNot: false } })).length);
    assert.ok(errs(st({ op: 'createIndex', ix: { name: '', cols: 'a\u0001b', unique: false, ifNot: false } })).length);
    const al = (d, a) => sql(st({ op: 'alterTable', d, alt: { action: 'add', col: CT(), from: '', to: '', name: '', ...a } }));
    assert.equal(al('pg', { col: CT({ name: 'age', nn: true, defType: 'number', def: '0' }) }), 'ALTER TABLE "users" ADD COLUMN "age" INTEGER NOT NULL DEFAULT 0;');
    assert.equal(al('mssql', { col: CT({ name: 'age' }) }), 'ALTER TABLE [users] ADD [age] INT;');
    assert.equal(al('mysql', { action: 'rename', from: 'a', to: 'b' }), 'ALTER TABLE `users` RENAME COLUMN `a` TO `b`;');
    assert.equal(al('mssql', { action: 'rename', from: 'a', to: "b'c" }), "EXEC sp_rename N'[users].[a]', N'b''c', N'COLUMN';");
    assert.equal(al('sqlite', { action: 'drop', name: 'x' }), 'ALTER TABLE "users" DROP COLUMN "x";');
    assert.ok(m.generate(st({ op: 'alterTable', alt: { action: 'drop', name: 'x' } }), 'sql').warns.some(w => w.level === 'danger'));
    assert.ok(errs(st({ op: 'alterTable', alt: { action: 'rename', from: 'a', to: 'a', col: CT(), name: '' } })).length);
    assert.ok(errs(st({ op: 'alterTable', alt: { action: 'add', col: CT({ name: '' }), from: '', to: '', name: '' } })).length);
    assert.ok(errs(st({ op: 'alterTable', alt: { action: 'nope', col: CT(), from: '', to: '', name: '' } })).length);
    assert.ok(errs(st({ d: 'sqlite', op: 'alterTable', alt: { action: 'add', col: CT({ name: 'a', uq: true }), from: '', to: '', name: '' } })).length, 'SQLite ADD COLUMN 不能 UNIQUE');
    assert.ok(errs(st({ d: 'sqlite', op: 'alterTable', alt: { action: 'add', col: CT({ name: 'a', nn: true }), from: '', to: '', name: '' } })).length, 'SQLite NOT NULL 需預設值');
    assert.ok(!errs(st({ d: 'sqlite', op: 'alterTable', alt: { action: 'add', col: CT({ name: 'a', nn: true, defType: 'number', def: '0' }), from: '', to: '', name: '' } })).length);
    assert.ok(m.generate(st({ op: 'alterTable', alt: { action: 'add', col: CT({ name: 'a', nn: true }), from: '', to: '', name: '' } }), 'sql').warns.some(w => w.text.includes('NOT NULL')));
    assert.equal(al('pg', { col: CT({ name: 'a', pk: true, ai: true, fk: 'x.y' }) }), 'ALTER TABLE "users" ADD COLUMN "a" INTEGER;', 'ADD COLUMN 忽略主鍵 / 自增 / 外鍵');
    ok('sql-query: index and alter');

    // --- 每組最新一筆 / 範本 ---
    const lat = (d, o = {}) => sql(st({ op: 'latest', d, where: o.where || G('and', []), lat: { group: 'user_id, kind', order: 'created_at', dir: 'desc' } }));
    assert.equal(lat('pg'), 'SELECT *\nFROM (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY "user_id", "kind" ORDER BY "created_at" DESC) AS "_rn"\n  FROM "users"\n) AS "ranked"\nWHERE "_rn" = 1;');
    assert.ok(lat('mssql').includes('[_rn]')); assert.ok(lat('mysql').includes('`ranked`'));
    assert.ok(lat('pg', { where: w1({ field: 'a', type: 'number', value: '1' }) }).includes('  WHERE "a" = 1\n)'));
    assert.ok(m.generate(st({ op: 'latest', d: 'mysql', lat: { group: 'a', order: 'b', dir: 'asc' } }), 'sql').warns.some(w => w.text.includes('5.7')));
    assert.ok(m.generate(st({ op: 'latest', d: 'sqlite', lat: { group: 'a', order: 'b', dir: 'asc' } }), 'sql').warns.some(w => w.text.includes('3.25')));
    assert.ok(!m.generate(st({ op: 'latest', d: 'pg', lat: { group: 'a', order: 'b', dir: 'asc' } }), 'sql').warns.length);
    assert.ok(errs(st({ op: 'latest', lat: { group: '', order: 'b', dir: 'asc' } })).length); assert.ok(errs(st({ op: 'latest', lat: { group: 'a', order: '', dir: 'asc' } })).length); assert.ok(errs(st({ op: 'latest', lat: { group: 'a', order: 'b', dir: 'x' } })).length);
    for (const [name] of m.TEMPLATES) {
        for (const d of D4) {
            const S = { ...m.defaultState(), ...m.template(name, { n: '14', page: '3' }), table: 'users', d };
            const r = m.generate(S, 'sql'); assert.ok(r.ok, `${name}/${d}: ${r.errs}`);
        }
    }
    const T = (name, p) => ({ ...m.defaultState(), table: 'users', d: 'pg', ...m.template(name, p) });
    assert.equal(sql(T('paging', { n: '20', page: '3' })), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nLIMIT 20\nOFFSET 40;');
    assert.equal(sql(T('paging', { n: 'x', page: '-4' })), 'SELECT *\nFROM "users"\nORDER BY "id" ASC\nLIMIT 20;', '壞參數回預設');
    assert.equal(sql(T('dupes')), 'SELECT "email", COUNT(*) AS "cnt"\nFROM "users"\nGROUP BY "email"\nHAVING COUNT(*) > 1\nORDER BY "cnt" DESC;');
    assert.equal(sql(T('recent', { n: '30' })), `SELECT *\nFROM "users"\nWHERE "created_at" >= NOW() - INTERVAL '30 days'\nORDER BY "created_at" DESC;`);
    assert.equal(sql(T('missing')), `SELECT *\nFROM "users"\nWHERE "phone" IS NULL OR "phone" = '';`);
    assert.equal(sql(T('fuzzy')), `SELECT *\nFROM "users"\nWHERE "name" LIKE '%關鍵字%';`);
    assert.ok(sql(T('upsert')).includes('ON CONFLICT ("id") DO UPDATE SET'));
    assert.equal(sql(T('latest')).split('\n')[2].replace(/;$/, '').includes('PARTITION BY "user_id"'), true);
    assert.deepEqual(m.template('nope', {}), {});
    ok('sql-query: latest-per-group and templates');

    // --- 狀態容錯 / opts ---
    assert.deepEqual(m.loadOpts(null), { op: 'select', d: 'mysql', fmt: 'sql' });
    assert.deepEqual(m.loadOpts([1]), { op: 'select', d: 'mysql', fmt: 'sql' }); assert.deepEqual(m.loadOpts('x'), { op: 'select', d: 'mysql', fmt: 'sql' });
    assert.deepEqual(m.loadOpts({ op: 'delete', d: 'pg', fmt: 'python' }), { op: 'delete', d: 'pg', fmt: 'python' });
    assert.deepEqual(m.loadOpts({ op: 'drop', d: 'oracle', fmt: 5 }), { op: 'select', d: 'mysql', fmt: 'sql' });
    for (const bad of [null, undefined, 5, 'x', [], {}, { op: 'insert', ins: null, sel: 5, where: 3 }, { op: 'select', sel: { cols: 'x', joins: [null, 5], orderBy: [null], having: 7 }, where: { items: [null, 3, { k: 'row' }] } }, { op: 'createTable', ct: { cols: [null, 5, {}] } }, { op: 'alterTable', alt: null }, { op: 'latest', lat: 3 }, { op: 'update', upd: [null, 5] }, { op: 'createIndex', ix: 1 }, { op: 'insert', ins: { cols: [null], rows: [null, 5, ['x']] } }]) {
        for (const f of ['sql', 'param', 'node', 'python']) assert.doesNotThrow(() => m.generate(bad, f), JSON.stringify(bad));
    }
    assert.equal(m.generate(null, 'sql').ok, false);
    assert.equal(m.generate(st(), 'zzz').parts[0].label, '純 SQL', '未知格式回到純 SQL');
    assert.equal(m.OPS.length, 8);
    ok('sql-query: bad state tolerance');

    // --- 實際用 Python sqlite3 執行 ---
    const py = spawnSync('python', ['-I', '-c', 'import sqlite3,sys;print(sqlite3.sqlite_version)'], { encoding: 'utf8' });
    if (py.status !== 0) console.log('skip  sql-query: 沒有 python，略過 sqlite 實際執行');
    else {
        const PYCODE = `
import sqlite3, json, sys
steps = json.loads(sys.stdin.buffer.read().decode("utf-8"))
conn = sqlite3.connect(":memory:")
cur = conn.cursor()
out = []
for s in steps:
    try:
        if s.get("script"):
            cur.executescript(s["sql"]); out.append(None)
        else:
            cur.execute(s["sql"], s.get("params", []))
            out.append(cur.fetchall() if cur.description else cur.rowcount)
    except Exception as e:
        out.append({"error": str(e)})
print(json.dumps(out))
`;
        const runPy = (steps) => {
            const r = spawnSync('python', ['-I', '-c', PYCODE], { input: JSON.stringify(steps), encoding: 'utf8' });
            assert.equal(r.status, 0, r.stderr); const o = JSON.parse(r.stdout);
            o.forEach((x, i) => assert.ok(!(x && x.error), `step ${i}: ${x && x.error}\n${steps[i].sql}`)); return o;
        };
        const sq = (o) => ({ ...m.defaultState(), table: 'users', d: 'sqlite', ...o });
        const lits = (S) => ({ sql: sql(S) });
        const pars = (S) => { const r = m.generate(S, 'param'), ps = m.finalize(m.compile(S, 'param').sql, m.compile(S, 'param').params, '?').params; return { sql: r.parts[0].text, params: ps.map(p => p.t === 'b' ? (p.v ? 1 : 0) : p.t === 'n' ? Number(p.v) : p.v) }; };
        const NAMES = ["O'Reilly", 'a\\b', '50%_off', '日本語 😀', 'line1\nline2', '"dq"', "';DROP TABLE users;--", '%', '_', '', ' lead ', "x'' y", '\\', '\\\\n', 'ab!c', '[br]'];
        const create = sq({ op: 'createTable', ct: { ifNot: false, cols: [CT({ name: 'id', pk: true, ai: true }), CT({ name: 'name', type: 'varchar', len: '100', nn: true, defType: 'string', def: "d'f" }), CT({ name: 'grp', type: 'varchar', len: '10' }), CT({ name: 'n', type: 'int' }), CT({ name: 'ok', type: 'boolean', defType: 'bool', def: 'true' }), CT({ name: 'created', type: 'datetime', defType: 'now' })] } });
        const steps = [lits(create)];
        // 一列一列新增（字面值）＋ 一列用參數化新增
        NAMES.forEach((nm, i) => steps.push(lits(sq({ op: 'insert', ins: { cols: [{ name: 'name', type: 'string' }, { name: 'grp', type: 'string' }, { name: 'n', type: 'number' }], rows: [[nm, 'g' + (i % 3), String(i)]], upsert: false, keys: '' } }))));
        NAMES.forEach((nm, i) => steps.push(pars(sq({ op: 'insert', ins: { cols: [{ name: 'name', type: 'string' }, { name: 'grp', type: 'string' }, { name: 'n', type: 'number' }], rows: [[nm, 'p' + (i % 3), String(100 + i)]], upsert: false, keys: '' } }))));
        // 多筆
        steps.push(lits(sq({ op: 'insert', ins: { cols: [{ name: 'name', type: 'string' }, { name: 'n', type: 'number' }, { name: 'ok', type: 'bool' }], rows: [['multi1', '1', 'false'], ['multi2', '', 'true']], upsert: false, keys: '' } })));
        const base = steps.length;
        const eqSel = (nm, mode) => (mode === 'p' ? pars : lits)(sq({ sel: sel({ cols: [C({ field: 'name' })] }), where: w1({ field: 'name', op: 'eq', value: nm }) }));
        NAMES.forEach(nm => { steps.push(eqSel(nm, 'l')); steps.push(eqSel(nm, 'p')); });
        const qIdx = base;
        // LIKE 快捷：% _ ! [ 要當一般字元
        const likeSel = (op, v, mode = 'l') => (mode === 'p' ? pars : lits)(sq({ sel: sel({ cols: [C({ field: 'name' })], orderBy: [{ field: 'id', dir: 'asc' }] }), where: w1({ field: 'name', op, value: v }) }));
        const likeCases = [['contains', '%'], ['contains', '_'], ['contains', '50%_'], ['startsWith', '50'], ['endsWith', '_off'], ['contains', '!'], ['contains', '['], ['notContains', '%'], ['contains', "'"], ['contains', '\\']];
        const likeStart = steps.length;
        likeCases.forEach(([op, v]) => { steps.push(likeSel(op, v)); steps.push(likeSel(op, v, 'p')); });
        // 其他運算子
        const aStart = steps.length;
        const csel = (where, o = {}) => lits(sq({ sel: sel({ cols: [C({ field: 'n' })], orderBy: [{ field: 'n', dir: 'asc' }], ...o }), where }));
        steps.push(csel(w1({ field: 'n', op: 'between', type: 'number', value: '2', value2: '4' })));
        steps.push(csel(w1({ field: 'n', op: 'in', type: 'number', value: '1,3,5' })));
        steps.push(csel(w1({ field: 'n', op: 'nin', type: 'number', value: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15' })));
        steps.push(csel({ k: 'grp', mode: 'or', items: [R({ field: 'n', op: 'lt', type: 'number', value: '1' }), { k: 'grp', mode: 'and', items: [R({ field: 'n', op: 'gte', type: 'number', value: '3' }), R({ field: 'n', op: 'lte', type: 'number', value: '4' })] }] }));
        steps.push(csel(w1({ field: 'n', op: 'null' }))); steps.push(csel(w1({ field: 'n', op: 'eq', type: 'null' })));
        steps.push(csel(w1({ field: 'ok', op: 'eq', type: 'bool', value: 'false' }), { cols: [C({ field: 'name' })] }));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'n' }), C({ agg: 'COUNT', alias: 'c' })], groupBy: 'n', having: G('and', [R({ agg: 'COUNT', field: '*', op: 'gte', type: 'number', value: '1' })]), orderBy: [{ field: 'n', dir: 'desc' }], limit: '2', offset: '1' }), where: w1({ field: 'n', op: 'between', type: 'number', value: '0', value2: '5' }) })));
        steps.push(lits(sq({ sel: sel({ distinct: true, cols: [C({ field: 'grp' })], orderBy: [{ field: 'grp', dir: 'asc' }] }), where: w1({ field: 'grp', op: 'null' , } ) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ agg: 'CONCAT', field: "name, '-', grp", alias: 'x' })], orderBy: [{ field: 'x', dir: 'asc' }] }), where: w1({ field: 'name', op: 'startsWith', value: 'multi' }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ agg: 'SUM', field: 'n', alias: 's' }), C({ agg: 'MIN', field: 'n', alias: 'mn' }), C({ agg: 'MAX', field: 'n', alias: 'mx' }), C({ agg: 'COUNTD', field: 'grp', alias: 'dg' })] }), where: w1({ field: 'n', op: 'lt', type: 'number', value: '100' }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'name' })] }), where: w1({ field: 'created', op: 'gte', type: 'daysago', value: '1' }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'name' })] }), where: w1({ field: 'created', op: 'gte', type: 'date', value: '2000-01-01 00:00:00' }, { field: 'created', op: 'lte', type: 'now' }) })));
        // JOIN
        steps.push(lits(sq({ op: 'createTable', table: 'tags', ct: { ifNot: false, cols: [CT({ name: 'user_id', type: 'int', nn: true, fk: 'users.id' }), CT({ name: 'tag', type: 'text' })] } })));
        steps.push(lits(sq({ op: 'insert', table: 'tags', ins: { cols: [{ name: 'user_id', type: 'number' }, { name: 'tag', type: 'string' }], rows: [['1', 'a'], ['1', 'b'], ['2', 'c']], upsert: false, keys: '' } })));
        const jStart = steps.length;
        steps.push(lits(sq({ sel: sel({ alias: 'u', cols: [C({ field: 'u.id' }), C({ field: 't.tag' })], joins: [{ type: 'inner', table: 'tags', alias: 't', on: on('u.id', 't.user_id') }], orderBy: [{ field: 't.tag', dir: 'asc' }] }) })));
        steps.push(lits(sq({ sel: sel({ alias: 'u', cols: [C({ field: 'u.id' }), C({ agg: 'COUNT', field: 't.tag', alias: 'c' })], joins: [{ type: 'left', table: 'tags', alias: 't', on: on('u.id', 't.user_id') }], groupBy: 'u.id', orderBy: [{ field: 'u.id', dir: 'asc' }], limit: '3' }) })));
        // 更新 / 刪除
        const uStart = steps.length;
        steps.push(lits(sq({ op: 'update', upd: [{ field: 'name', type: 'string', value: "new'\\name\n%" }, { field: 'n', type: 'number', value: '-7' }], where: w1({ field: 'name', value: 'multi1' }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'name' }), C({ field: 'n' })] }), where: w1({ field: 'n', op: 'eq', type: 'number', value: '-7' }) })));
        steps.push(pars(sq({ op: 'update', upd: [{ field: 'n', type: 'number', value: '77' }], where: w1({ field: 'name', value: "new'\\name\n%" }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'n' })] }), where: w1({ field: 'name', value: "new'\\name\n%" }) })));
        steps.push(lits(sq({ op: 'delete', where: w1({ field: 'name', value: "new'\\name\n%" }) })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ agg: 'COUNT', alias: 'c' })] }), where: w1({ field: 'n', op: 'eq', type: 'number', value: '77' }) })));
        steps.push(pars(sq({ op: 'delete', where: w1({ field: 'name', op: 'contains', value: '%' }) })));
        steps.push(lits(m.toCountCheck(sq({ op: 'delete', where: G('and', []) }))));
        // upsert
        const upStart = steps.length;
        steps.push(lits(sq({ op: 'createTable', table: 'kv', ct: { ifNot: false, cols: [CT({ name: 'k', type: 'varchar', len: '20', pk: true }), CT({ name: 'v', type: 'text' })] } })));
        const upsertS = (v) => sq({ op: 'insert', table: 'kv', ins: { cols: [{ name: 'k', type: 'string' }, { name: 'v', type: 'string' }], rows: [['a', v]], upsert: true, keys: 'k' } });
        steps.push(lits(upsertS("v1'")), pars(upsertS('v2 \\ %')), lits(sq({ sel: sel({ cols: [C({ field: 'k' }), C({ field: 'v' })] }), table: 'kv' })));
        // 每組最新一筆
        steps.push(lits(sq({ op: 'createTable', table: 'ev', ct: { ifNot: false, cols: [CT({ name: 'u', type: 'int' }), CT({ name: 't', type: 'int' }), CT({ name: 'msg', type: 'text' })] } })));
        steps.push(lits(sq({ op: 'insert', table: 'ev', ins: { cols: [{ name: 'u', type: 'number' }, { name: 't', type: 'number' }, { name: 'msg', type: 'string' }], rows: [['1', '1', 'a'], ['1', '3', 'b'], ['1', '2', 'c'], ['2', '5', 'd'], ['2', '4', 'e']], upsert: false, keys: '' } })));
        const latIdx = steps.length;
        steps.push(lits(sq({ op: 'latest', table: 'ev', lat: { group: 'u', order: 't', dir: 'desc' }, where: G('and', []) })));
        steps.push(lits(sq({ op: 'latest', table: 'ev', lat: { group: 'u', order: 't', dir: 'asc' }, where: G('and', []) })));
        // 重複資料範本
        steps.push(lits({ ...sq(m.template('dupes')), table: 'ev', sel: { ...m.template('dupes').sel, cols: [C({ field: 'u' }), C({ agg: 'COUNT', alias: 'cnt' })], groupBy: 'u' } }));
        // 奇怪的識別字
        const weird = 'we"ird `na]me`';
        steps.push(lits(sq({ op: 'createTable', table: weird, ct: { ifNot: false, cols: [CT({ name: 'col"x', type: 'int' }), CT({ name: 'select', type: 'text' })] } })));
        steps.push(lits(sq({ op: 'insert', table: weird, ins: { cols: [{ name: 'col"x', type: 'number' }, { name: 'select', type: 'string' }], rows: [['1', 'ok']], upsert: false, keys: '' } })));
        steps.push(lits(sq({ table: weird, sel: sel({ cols: [C({ field: 'select' })] }), where: w1({ field: 'col"x', type: 'number', value: '1' }) })));
        // 索引 / alter
        steps.push(lits(sq({ op: 'createIndex', ix: { name: '', cols: 'name, n DESC', unique: false, ifNot: true } })));
        steps.push(lits(sq({ op: 'createIndex', table: 'kv', ix: { name: 'kv_v', cols: 'v', unique: true, ifNot: false } })));
        steps.push(lits(sq({ op: 'alterTable', alt: { action: 'add', col: CT({ name: 'extra', type: 'int', nn: true, defType: 'number', def: '9' }), from: '', to: '', name: '' } })));
        steps.push(lits(sq({ op: 'alterTable', alt: { action: 'rename', col: CT(), from: 'extra', to: 'extra2', name: '' } })));
        steps.push(lits(sq({ sel: sel({ cols: [C({ field: 'extra2' })], limit: '1' }) })));
        steps.push(lits(sq({ op: 'alterTable', alt: { action: 'drop', col: CT(), from: '', to: '', name: 'extra2' } })));
        steps.push({ sql: "SELECT group_concat(name) FROM pragma_table_info('users')" });
        const res = runPy(steps);
        assert.ok(!res[res.length - 1][0][0].includes('extra'), '刪欄後欄位已不在');

        // 驗證：每個名稱用字面值與參數化都剛好找到 2 列（一列字面值、一列參數化新增），且往返字串完全相同
        for (let i = 0; i < NAMES.length; i++) {
            for (const k of [0, 1]) {
                const rows = res[qIdx + i * 2 + k];
                assert.equal(rows.length, 2, `名稱 ${JSON.stringify(NAMES[i])} 應找到 2 列（${k ? '參數化' : '字面值'}），得到 ${rows.length}`);
                assert.ok(rows.every(r => r[0] === NAMES[i]), '往返字串不同：' + JSON.stringify(NAMES[i]));
            }
        }
        // 表裡的注入字串沒有讓 users 消失（後面查詢都還能成功）
        // LIKE 快捷
        const likeNames = (i, k) => res[likeStart + i * 2 + k].map(r => r[0]);
        const expectLike = (op, v) => { const all = [...NAMES, ...NAMES, 'multi1', 'multi2']; const f = (s) => op === 'contains' ? s.includes(v) : op === 'notContains' ? !s.includes(v) : op === 'startsWith' ? s.startsWith(v) : s.endsWith(v); return all.filter(f); };
        likeCases.forEach(([op, v], i) => {
            // SQLite 的 LIKE 預設不分大小寫（僅 ASCII），測資沒有大小寫干擾；NOT 包含時 name 沒有 NULL
            const exp = expectLike(op, v).sort(), a = likeNames(i, 0).sort(), b = likeNames(i, 1).sort();
            assert.deepEqual(a, exp, `LIKE ${op} ${v}（字面值）`);
            assert.deepEqual(b, exp, `LIKE ${op} ${v}（參數化）`);
        });
        // 數值 / 運算子（資料：字面值列 n = 0..15、參數化列 n = 100..115、multi1 n = 1、multi2 n = NULL）
        const col0 = (k) => res[aStart + k].map(r => r[0]);
        const range = (a, b) => Array.from({ length: b - a + 1 }, (_, x) => a + x);
        assert.deepEqual(col0(0), [2, 3, 4], 'BETWEEN');
        assert.deepEqual(col0(1), [1, 1, 3, 5], 'IN');
        assert.deepEqual(col0(2), range(100, 115), 'NOT IN（NULL 不會被列入）');
        assert.deepEqual(col0(3), [0, 3, 4], 'OR + 巢狀 AND');
        assert.deepEqual(res[aStart + 4], [[null]], 'IS NULL'); assert.deepEqual(res[aStart + 5], [[null]], '= NULL 型別轉 IS NULL');
        assert.deepEqual(res[aStart + 6].map(r => r[0]), ['multi1'], '布林 false');
        assert.deepEqual(res[aStart + 7], [[4, 1], [3, 1]], 'GROUP BY / HAVING / ORDER BY / LIMIT / OFFSET');
        assert.deepEqual(res[aStart + 8], [[null]], 'DISTINCT + IS NULL');
        assert.deepEqual(res[aStart + 9], [[null], [null]], 'CONCAT（有 NULL 時結果為 NULL）');
        assert.deepEqual(res[aStart + 10], [[121, 0, 15, 3]], 'SUM / MIN / MAX / COUNT DISTINCT');
        assert.equal(res[aStart + 11].length, 34, '最近 1 天'); assert.equal(res[aStart + 12].length, 34, '日期區間');
        // JOIN
        assert.deepEqual(res[jStart], [[1, 'a'], [1, 'b'], [2, 'c']], 'INNER JOIN');
        assert.deepEqual(res[jStart + 1], [[1, 2], [2, 1], [3, 0]], 'LEFT JOIN + GROUP BY');
        // 更新 / 刪除
        assert.equal(res[uStart], 1); assert.deepEqual(res[uStart + 1], [["new'\\name\n%", -7]], '更新後特殊字元往返');
        assert.equal(res[uStart + 2], 1); assert.deepEqual(res[uStart + 3], [[77]]);
        assert.equal(res[uStart + 4], 1); assert.deepEqual(res[uStart + 5], [[0]]);
        assert.equal(res[uStart + 6], 4, '參數化刪除：名稱含 % 的 4 列'); assert.deepEqual(res[uStart + 7], [[29]], 'COUNT(*) 確認');
        // upsert、每組最新一筆、重複、奇怪的識別字
        assert.deepEqual(res[upStart + 3], [['a', 'v2 \\ %']], 'upsert 兩次只剩一列');
        const msgs = (k) => res[latIdx + k].map(r => r[2]).sort();
        assert.deepEqual(msgs(0), ['b', 'd'], '每組最新'); assert.deepEqual(msgs(1), ['a', 'e'], '每組最舊');
        assert.deepEqual(res[latIdx + 2], [[1, 3], [2, 2]], '找重複 / 分組計數');
        assert.deepEqual(res[latIdx + 5], [['ok']], '含引號與保留字的識別字');
    }
    ok('sql-query: executed against real SQLite (python sqlite3)');
}

{ // ---------- json-formatter：產生型別 ----------
    const m = load('utils/json-formatter.html', 'generateTypes, inferT, pascal, singular, goName, strFmt, formatJSON');
    const gen = (v, lang, o) => m.generateTypes(v, lang, o);
    const fs = require('fs'), os = require('os'), path = require('path');
    const names = (s, kw = 'interface') => (s.match(new RegExp(kw + ' (\\w+)', 'g')) || []).map(x => x.split(' ')[1]).join(',');

    // --- 命名 ---
    const P = { user_name: 'UserName', userName: 'UserName', 'user-profile': 'UserProfile', URL: 'URL', 'a b c': 'ABC', '123abc': 'T123abc', '': 'Item', '$$$': 'Item', '中文鍵': '中文鍵', items: 'Items' };
    for (const [k, v] of Object.entries(P)) assert.equal(m.pascal(k), v, 'pascal ' + k);
    const S = { Categories: 'Category', Boxes: 'Box', Classes: 'Class', People: 'Person', Items: 'Item', Status: 'StatusItem', Data: 'DataItem', Women: 'Woman', Movies: 'Movie', Databases: 'Database', Addresses: 'Address', Cases: 'Case', Tags: 'Tag', Watches: 'Watch', UserItems: 'UserItem', Children: 'Child', Series: 'SeriesItem', News: 'NewsItem', Foo: 'FooItem', Analysis: 'AnalysisItem' };
    for (const [k, v] of Object.entries(S)) assert.equal(m.singular(k), v, 'singular ' + k);
    const G = { id: 'ID', user_id: 'UserID', userId: 'UserID', imageUrl: 'ImageURL', image_url: 'ImageURL', httpStatus: 'HTTPStatus', 'first-name': 'FirstName', API_KEY: 'APIKey', URL: 'URL', userID2: 'UserID2', name: 'Name', '': 'Field', '123': 'X123', '中文': 'X中文', jsonData: 'JSONData', ip: 'IP', uuid: 'UUID', createdAt: 'CreatedAt', 'a.b': 'AB' };
    for (const [k, v] of Object.entries(G)) assert.equal(m.goName(k), v, 'goName ' + k);
    ok('json types: naming (pascal, singular, Go initialisms)');

    // --- 格式偵測 ---
    const F = { '2024-01-01T10:00:00Z': 'date-time', '2024-01-01T10:00:00.123+08:00': 'date-time', '2024-01-01': 'date', '2024-02-30': '', '2024-13-01': '', '2024-01-01T10:00:00': '', 'a@b.co': 'email', 'a@b': '', 'http://x.com/a?b=1': 'uri', 'https://x.com': 'uri', 'x.com': '', '123e4567-e89b-12d3-a456-426614174000': 'uuid', '123E4567-E89B-12D3-A456-426614174000': 'uuid', '': '', 'hello': '' };
    for (const [k, v] of Object.entries(F)) assert.equal(m.strFmt(k), v, 'fmt ' + JSON.stringify(k));

    // --- 簡易 JSON Schema 驗證器 ---
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const FMT = { 'date-time': /^\d{4}-\d\d-\d\dT[\d:.]+(Z|[+-]\d\d:\d\d)$/, date: /^\d{4}-\d\d-\d\d$/, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, uri: /^[a-z][a-z0-9+.-]*:\/\/\S+$/i, uuid: /^[0-9a-f-]{36}$/i };
    const typeOk = (t, v) => ({ string: typeof v === 'string', number: typeof v === 'number' && isFinite(v), integer: Number.isInteger(v), boolean: typeof v === 'boolean', null: v === null, object: !!v && typeof v === 'object' && !Array.isArray(v), array: Array.isArray(v) })[t];
    function valid(s, v) {
        if (s.type !== undefined && ![].concat(s.type).some(t => typeOk(t, v))) return false;
        if (typeOk('object', v)) { for (const k of s.required || []) if (!own(v, k)) return false; for (const [k, sub] of Object.entries(s.properties || {})) if (own(v, k) && !valid(sub, v[k])) return false; }
        if (Array.isArray(v) && s.items) for (const x of v) if (!valid(s.items, x)) return false;
        if (typeof v === 'string' && s.format && !FMT[s.format].test(v)) return false;
        return true;
    }
    const SAMPLE = { id: 1, user_id: 5, name: 'A', imageUrl: 'http://x.com/a', email: 'a@b.co', created_at: '2024-01-01T10:00:00Z', _id: '507f1f77bcf86cd799439011', price: 1.5, ok: true, nothing: null, tags: ['a', 'b'], 'first-name': 'x', class: 1, address: { street: 's', zip: null }, items: [{ sku: 'a', qty: 1 }, { sku: 'b', qty: 2, note: 'hi' }], categories: [{ n: 1 }], matrix: [[1, 2], [3]], mixed: [1, 'a'], empty: [], u: '123e4567-e89b-12d3-a456-426614174000', d: '2024-02-29' };
    const DOCS = [
        SAMPLE, [], [1, 2, 3], 'str', 42, null, true, {}, [{}], [{ a: 1 }, { a: 'x', b: [] }, { b: [null, 1.5] }], [[1, [2, [3]]], []], [[{ x: 1 }], [{ x: 'a', y: null }]],
        { a: { b: { c: { d: { e: [{ f: 1 }] } } } } }, { a: null }, { a: [null] }, { a: [[], [1], ['x']] }, { big: 12345678901234567890, neg: -5, f: 1.5, i: 2 },
        { '': 1, 'a b': 2, 'a.b': 3, '$x': 4, '123': 5, 'class': 6, 'a"b': 7, 'a`b': 8, 'a,b': 9, '中文': 10, 'é': 11 }, JSON.parse('{"__proto__": {"a": 1}, "x": 1}'),
        [{ id: 1, tags: ['a'], owner: { name: 'x' } }, { id: 2, owner: { name: 'y', age: 3 } }, { id: 3, tags: [], owner: null }],
        { field: 1, int: 'a', str: null, list: [1], Address: 1, address: { x: 1 }, dataclass: true, Optional: 2 },
        { users: [{ name: 'a', address: { city: 'x', zip: '1' } }, { name: 'b', address: { city: 'y' } }], address: { city: 'z', zip: 5 } },
    ];
    for (const d of DOCS) {
        const text = gen(d, 'schema', { fmt: true });
        const sch = JSON.parse(text);   // 可被 JSON.parse
        assert.equal(sch.$schema, 'https://json-schema.org/draft/2020-12/schema');
        assert.ok(valid(sch, d), '範例要符合自己產生的 schema：' + JSON.stringify(d).slice(0, 80) + '\n' + text);
        assert.ok(valid(JSON.parse(gen(d, 'schema', { fmt: false })), d));
    }
    // 驗證器本身要能擋
    {
        const sch = JSON.parse(gen({ a: 1, b: 'x', c: null, d: [1], e: { f: true } }, 'schema'));
        assert.ok(valid(sch, { a: 5, b: 'y', c: null, d: [], e: { f: false } }));
        assert.ok(!valid(sch, { a: 1.5, b: 'x', c: null, d: [1], e: { f: true } }), 'integer 擋小數');
        assert.ok(!valid(sch, { b: 'x', c: null, d: [1], e: { f: true } }), '缺必填');
        assert.ok(!valid(sch, { a: 1, b: 2, c: null, d: [1], e: { f: true } }));
        assert.ok(!valid(sch, { a: 1, b: 'x', c: null, d: ['x'], e: { f: true } }));
        assert.ok(!valid(sch, { a: 1, b: 'x', c: 1, d: [1], e: { f: true } }));
        assert.ok(!valid(sch, { a: 1, b: 'x', c: null, d: [1], e: { f: 1 } }));
    }
    // Schema 細節
    {
        const s = JSON.parse(gen([{ id: 1, n: null, tag: 'a' }, { id: 2.5, n: 'x', extra: 1 }], 'schema', { name: 'my items' }));
        assert.equal(s.title, 'MyItems'); assert.equal(s.type, 'array');
        assert.deepEqual(s.items.properties.id, { type: 'number' }, '整數 + 小數 → number');
        assert.deepEqual(s.items.properties.n, { type: ['string', 'null'] }, 'nullable → type 陣列');
        assert.deepEqual(s.items.required, ['id', 'n'], '只有每一筆都有的欄位才 required（tag / extra 不是）');
        assert.deepEqual(s.items.properties.extra, { type: 'integer' });
        const f = JSON.parse(gen({ a: 'a@b.co', b: ['a@b.co', 'x'], c: 'a@b.co', d: 1 }, 'schema', { fmt: true })).properties;
        assert.equal(f.a.format, 'email'); assert.equal(f.b.items.format, undefined, '不是全部都符合 → 不加 format');
        assert.ok(!('format' in JSON.parse(gen({ a: 'a@b.co' }, 'schema', { fmt: false })).properties.a), '關閉偵測');
        assert.deepEqual(JSON.parse(gen({ a: ['a@b.co'] }, 'schema', { fmt: true })).properties.a.items, { type: 'string', format: 'email' });
        assert.deepEqual(JSON.parse(gen({ e: [] }, 'schema')).properties.e, { type: 'array', items: {} });
        assert.deepEqual(JSON.parse(gen({ x: 12345678901234567890, y: 1e400 }, 'schema')).properties, { x: { type: 'number' }, y: { type: 'number' } }, '極大數字 → number');
        assert.deepEqual(JSON.parse(gen({ a: 'x' }, 'schema', {})).required, ['a']);
        assert.equal(JSON.parse(gen({}, 'schema')).required, undefined, '空物件沒有 required');
        assert.deepEqual(Object.keys(JSON.parse(gen(JSON.parse('{"__proto__": {"a": 1}}'), 'schema')).properties), ['__proto__']);
        assert.equal(({}).a, undefined, '沒有原型污染');
        assert.deepEqual(JSON.parse(gen([[1, 'a'], [2]], 'schema')).items, { type: 'array', items: { type: ['string', 'integer'] } });
    }
    ok('json types: JSON Schema (parse + validate samples)');

    // --- TypeScript ---
    assert.equal(gen({ id: 1, name: 'a', tags: ['x'], ok: true, n: null }, 'ts'), 'interface Root {\n  id: number;\n  name: string;\n  tags: string[];\n  ok: boolean;\n  n: null;\n}\n');
    assert.equal(gen({ id: 1 }, 'ts', { kind: 'type', exp: true, name: 'user_info' }), 'export type UserInfo = {\n  id: number;\n};\n');
    assert.equal(gen({ id: 1 }, 'ts', { exp: true }), 'export interface Root {\n  id: number;\n}\n');
    assert.equal(gen({}, 'ts'), 'interface Root {}\n'); assert.equal(gen({}, 'ts', { kind: 'type' }), 'type Root = {};\n');
    assert.equal(gen([], 'ts'), 'type Root = unknown[];\n'); assert.equal(gen(null, 'ts'), 'type Root = null;\n'); assert.equal(gen('x', 'ts', { exp: true }), 'export type Root = string;\n'); assert.equal(gen(1.5, 'ts'), 'type Root = number;\n');
    assert.equal(gen([1, 'a', null], 'ts'), 'type Root = (string | number | null)[];\n');
    assert.equal(gen([[1, 2], [3]], 'ts'), 'type Root = number[][];\n');
    assert.equal(gen([[1], ['a']], 'ts'), 'type Root = (string | number)[][];\n');
    assert.equal(gen({ a: [] }, 'ts'), 'interface Root {\n  a: unknown[];\n}\n');
    // 陣列元素合併、可選、union、null
    assert.equal(gen([{ a: 1 }, { a: 'x', b: [] }, { b: [null, 1.5] }], 'ts'), 'type Root = RootItem[];\n\ninterface RootItem {\n  a?: string | number;\n  b?: (number | null)[];\n}\n');
    assert.equal(gen([{ id: 1, o: { x: 1 } }, { id: 2, o: null }], 'ts'), 'type Root = RootItem[];\n\ninterface RootItem {\n  id: number;\n  o: O | null;\n}\n\ninterface O {\n  x: number;\n}\n');
    assert.equal(gen({ items: [{ sku: 'a' }, { sku: 'b', note: 'x' }] }, 'ts'), 'interface Root {\n  items: Item[];\n}\n\ninterface Item {\n  sku: string;\n  note?: string;\n}\n');
    assert.equal(names(gen({ people: [{ n: 1 }], categories: [{ n: 1 }], status: [{ n: 1 }] }, 'ts')), 'Root,Person,Category,StatusItem');
    // 命名衝突
    assert.equal(names(gen({ a: { item: { x: 1 } }, b: { item: { y: 1 } } }, 'ts')), 'Root,A,Item,B,Item2');
    assert.equal(names(gen({ root: { x: 1 } }, 'ts')), 'Root,Root2', '子型別與根同名');
    assert.equal(gen([{ x: 1 }], 'ts', { name: 'users' }), 'type Users = User[];\n\ninterface User {\n  x: number;\n}\n');
    assert.ok(gen({ date: { x: 1 } }, 'ts').includes('interface DateType'), '與全域 Date 衝突 → 加 Type 後綴');
    assert.ok(gen({ x: 1 }, 'ts', { name: 'Date' }).includes('interface DateType'));
    // 特殊鍵名
    assert.equal(gen({ 'a-b': 1, 'a b': 2, '1x': 3, '': 4, class: 5, $x: 6, _y: 7, 'a"b': 8, '中文': 9 }, 'ts'), 'interface Root {\n  "a-b": number;\n  "a b": number;\n  "1x": number;\n  "": number;\n  class: number;\n  $x: number;\n  _y: number;\n  "a\\"b": number;\n  "中文": number;\n}\n');
    // 深層
    assert.equal(names(gen({ a: { b: { c: { d: 1 } } } }, 'ts')), 'Root,A,B,C');
    assert.equal(gen([{ m: [[{ k: 1 }]] }], 'ts'), 'type Root = RootItem[];\n\ninterface RootItem {\n  m: MItem[][];\n}\n\ninterface MItem {\n  k: number;\n}\n');
    assert.equal(gen({ big: 12345678901234567890, huge: 1e400 }, 'ts'), 'interface Root {\n  big: number;\n  huge: number;\n}\n');
    // 巢狀太深
    { let d = 1; for (let i = 0; i < 150; i++) d = { a: d }; assert.throws(() => gen(d, 'ts'), /巢狀/); let ok100 = 1; for (let i = 0; i < 99; i++) ok100 = { a: ok100 }; assert.doesNotThrow(() => gen(ok100, 'ts')); }
    assert.throws(() => gen({}, 'java'), /未知/);
    // 用 tsc 檢查（有安裝才做）：每份輸出包在 namespace 裡，避免不同範例的型別名稱互撞
    {
        const cp = require('child_process'), tsc = cp.spawnSync('tsc', ['-v'], { shell: true, encoding: 'utf8' });
        if (tsc.status === 0) {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tychk-')), file = path.join(dir, 'a.ts');
            fs.writeFileSync(file, DOCS.flatMap((d, i) => [false, true].map(k => `namespace N${i}${k ? 't' : 'i'} {\n${gen(d, 'ts', { kind: k ? 'type' : 'interface' })}}\n`)).join('\n'));
            const r = cp.spawnSync('tsc', ['--noEmit', '--skipLibCheck', '--target', 'es2019', '"' + file + '"'], { shell: true, encoding: 'utf8' });
            assert.equal(r.status, 0, 'TS 編譯錯誤：\n' + r.stdout.slice(0, 1000));
            fs.rmSync(dir, { recursive: true, force: true });
        } else console.log('skip  json types: 沒有 tsc，略過 TypeScript 編譯檢查');
    }
    ok('json types: TypeScript');

    // --- Mongoose ---
    assert.equal(gen({ name: 'a', age: 1, ok: true, at: '2024-01-01T10:00:00Z', owner: '507f1f77bcf86cd799439011', meta: { x: 1 }, tags: ['a'], mix: [1, 'a'], nothing: null, subs: [{ a: 1 }], empty: [] }, 'mongoose', { name: 'user' }),
        `const mongoose = require('mongoose');\nconst { Schema } = mongoose;\n\nconst SubSchema = new Schema({\n  a: { type: Number, required: true },\n});\n\nconst MetaSchema = new Schema({\n  x: { type: Number, required: true },\n});\n\nconst UserSchema = new Schema({\n  name: { type: String, required: true },\n  age: { type: Number, required: true },\n  ok: { type: Boolean, required: true },\n  at: { type: Date, required: true },\n  owner: { type: Schema.Types.ObjectId, required: true },\n  meta: { type: MetaSchema, required: true },\n  tags: [String],\n  mix: [Schema.Types.Mixed],\n  nothing: Schema.Types.Mixed,\n  subs: [SubSchema],\n  empty: [Schema.Types.Mixed],\n});\n\nmodule.exports = mongoose.model("User", UserSchema);\n`);
    assert.ok(gen({ a: 1 }, 'mongoose', { timestamps: true }).includes('}, { timestamps: true });'));
    assert.ok(!gen({ a: 1, createdAt: '2024-01-01T00:00:00Z' }, 'mongoose', { timestamps: true }).includes('createdAt'), 'timestamps 時略過 createdAt');
    assert.ok(gen({ a: 1, createdAt: '2024-01-01T00:00:00Z' }, 'mongoose', {}).includes('createdAt: { type: Date, required: true }'));
    assert.ok(!gen({ a: 1 }, 'mongoose', {}).includes('timestamps'));
    { const g = gen([{ a: 1 }, { b: 2 }], 'mongoose', { name: 'users' }); assert.ok(g.includes('  a: Number,\n  b: Number,') && g.includes('mongoose.model("User", UserSchema)'), '物件陣列 → 取元素；可選欄位不加 required'); }
    assert.ok(gen({ z: ['507f1f77bcf86cd799439011', 'x'] }, 'mongoose').includes('z: { type: [String]') === false && gen({ z: ['507f1f77bcf86cd799439011', 'x'] }, 'mongoose').includes('z: [String]'), '不是全部 24 位 16 進位 → String');
    assert.ok(gen({ z: ['507f1f77bcf86cd799439011'] }, 'mongoose').includes('z: [Schema.Types.ObjectId]'));
    assert.ok(gen({ '_id': '507f1f77bcf86cd799439011', 'a-b': 1 }, 'mongoose').includes('"a-b": { type: Number, required: true }'));
    assert.ok(gen({ a: [[1]] }, 'mongoose').includes('a: [[Number]]'));
    assert.ok(gen([1, 2], 'mongoose').startsWith('// 根節點不是物件')); assert.ok(gen('x', 'mongoose').startsWith('//')); assert.ok(gen([[{ a: 1 }]], 'mongoose').startsWith('//'));
    assert.ok(gen([{ a: 1 }, { a: 'x' }], 'mongoose').includes('a: { type: Schema.Types.Mixed, required: true }'));
    ok('json types: Mongoose');

    // --- Go ---
    {
        const g = gen({ id: 1, user_id: 2, name: 'a', imageUrl: 'x', price: 1.5, ok: true, tags: ['a'], m: [[1]], o: null, e: [], addr: { city: 'x' }, list: [{ a: 1 }, { b: 2 }], mixed: [1, 'a'], n: [null, 'a'] }, 'go');
        const lines = g.split('\n');
        const has = (name, type, tag) => assert.ok(lines.some(l => { const p = l.match(/^\t(\S+) +(\S+) +`json:"([^"]*)"`$/); return p && p[1] === name && p[2] === type && p[3] === tag; }), `${name} ${type} ${tag}\n${g}`);
        has('ID', 'int', 'id'); has('UserID', 'int', 'user_id'); has('Name', 'string', 'name'); has('ImageURL', 'string', 'imageUrl'); has('Price', 'float64', 'price'); has('Ok', 'bool', 'ok');
        has('Tags', '[]string', 'tags'); has('M', '[][]int', 'm'); has('O', 'interface{}', 'o'); has('E', '[]interface{}', 'e'); has('Addr', 'Addr', 'addr'); has('List', '[]ListItem', 'list'); has('Mixed', '[]interface{}', 'mixed'); has('N', '[]*string', 'n');
        assert.ok(/type ListItem struct \{\n\tA +\*int +`json:"a,omitempty"`\n\tB +\*int +`json:"b,omitempty"`\n\}/.test(g), '可選欄位 → 指標 + omitempty\n' + g);
        assert.ok(lines.every(l => !l.startsWith(' ')), 'gofmt 風格：tab 縮排');
        assert.ok(lines.filter(l => l.startsWith('\t')).every(l => /^\t[A-Z]/.test(l)), '欄位名稱大寫開頭');
    }
    assert.equal(gen({ a: { x: null }, b: { x: 1 } }, 'go'), 'type Root struct {\n\tA A `json:"a"`\n\tB B `json:"b"`\n}\n\ntype A struct {\n\tX interface{} `json:"x"`\n}\n\ntype B struct {\n\tX int `json:"x"`\n}\n');
    assert.equal(gen([{ a: 1 }], 'go', { name: 'items' }), 'type Items []Item\n\ntype Item struct {\n\tA int `json:"a"`\n}\n');
    assert.equal(gen([1, 2], 'go'), 'type Root []int\n'); assert.equal(gen('x', 'go'), 'type Root string\n'); assert.equal(gen(null, 'go'), 'type Root interface{}\n'); assert.equal(gen({}, 'go'), 'type Root struct {}\n');
    assert.ok(gen([{ o: { x: 1 } }, { o: null }], 'go').includes('O *O `json:"o"`'), 'null 物件 → 指標');
    // 特殊鍵名
    {
        const g = gen({ 'a-b': 1, 'a b': 2, '1x': 3, class: 4, 'a"b': 5, 'a`b': 6, 'a,b': 7, '': 8, '中文': 9, userID: 1, user_id: 2, UserId: 3 }, 'go');
        assert.ok(g.includes('`json:"a-b"`') && g.includes('X1X'), g);
        assert.ok(g.includes('`json:"a\\"b"`'), '引號跳脫'); assert.ok(g.includes('"json:\\"a`b\\""'), '含反引號改用一般字串');
        assert.ok(/\/\/ 鍵名無法寫進 json tag/.test(g), '逗號 / 空鍵名加註解');
        const ns = g.split('\n').filter(l => l.startsWith('\t')).map(l => l.trim().split(/\s+/)[0]);
        assert.equal(new Set(ns).size, ns.length, '欄位名稱不重複：' + ns);
    }
    ok('json types: Go');

    // --- Python ---
    assert.equal(gen({ id: 1, name: 'a', tags: ['x'], o: { a: 1 } }, 'python', { name: 'user' }),
        'from dataclasses import dataclass\n\n\n@dataclass\nclass O:\n    a: int\n\n\n@dataclass\nclass User:\n    id: int\n    name: str\n    tags: list[str]\n    o: O\n');
    assert.equal(gen([{ a: 1, b: null }, { a: 2.5, c: 'x' }], 'python'), 'from dataclasses import dataclass\nfrom typing import Optional\n\n\n@dataclass\nclass RootItem:\n    a: float\n    b: None = None\n    c: Optional[str] = None\n\n\nRoot = list[RootItem]\n');
    assert.equal(gen({ a: [] }, 'python'), 'from dataclasses import dataclass\nfrom typing import Any\n\n\n@dataclass\nclass Root:\n    a: list[Any]\n');
    assert.ok(gen({ a: [1, 'x'], b: 'x', c: null }, 'python').includes('a: list[Union[str, int]]'));
    assert.ok(!gen({ a: 'x' }, 'python').includes('Optional'));
    assert.ok(gen([{ a: 'x' }, { a: null }], 'python').includes('a: Optional[str]\n'), 'null → Optional，不重複加預設');
    { const g = gen([{ a: 1, b: 2 }, { b: 3 }], 'python'); assert.ok(g.indexOf('b: int') < g.indexOf('a: Optional[int] = None'), '必填欄位排在有預設值的欄位前面'); }
    assert.equal(gen('x', 'python'), 'from dataclasses import dataclass\n\n\nRoot = str\n'); assert.equal(gen([], 'python'), 'from dataclasses import dataclass\nfrom typing import Any\n\n\nRoot = list[Any]\n'); assert.equal(gen({}, 'python'), 'from dataclasses import dataclass\n\n\n@dataclass\nclass Root:\n    pass\n');
    {
        const g = gen({ 'first-name': 1, class: 2, '1x': 3, 'a b': 4, '': 5, 'a_b': 6, 'é': 7 }, 'python');
        assert.ok(g.includes('first_name: int = field(metadata={"json": "first-name"})') && g.includes('class_: int = field(metadata={"json": "class"})') && g.includes('_1x: int = field(metadata={"json": "1x"})'), g);
        assert.ok(g.includes('a_b: int = field(metadata={"json": "a b"})') && g.includes('a_b_2: int'), '名稱撞名加序號');
        assert.ok(g.includes('from dataclasses import dataclass, field'));
        assert.ok(gen([{ 'a-b': 1 }, {}], 'python').includes('a_b: Optional[int] = field(default=None, metadata={"json": "a-b"})'));
    }
    assert.ok(gen({ field: 1, int: 2 }, 'python').includes('field_: int = field(metadata={"json": "field"})'), '欄位名稱不能蓋掉 field / int');
    assert.ok(gen({ optional: { x: 1 } }, 'python').includes('class OptionalType:'), '類別名稱與 typing 名稱衝突時加 Type');
    // 實際用 Python 載入
    {
        const cp = require('child_process'), py = cp.spawnSync('python', ['-I', '-c', 'import sys;print(sys.version_info[:2] >= (3, 9))'], { encoding: 'utf8' });
        if (py.status !== 0 || !py.stdout.includes('True')) console.log('skip  json types: 沒有 python 3.9+，略過 dataclass 實際載入');
        else {
            const PYCODE = `
import ast, json, sys, dataclasses, typing
payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
NoneType = type(None)
def build(tp, v):
    org, args = typing.get_origin(tp), typing.get_args(tp)
    if tp is typing.Any: return v
    if tp is NoneType or tp is None:
        assert v is None, ("expected None", v); return None
    if org is typing.Union:
        for a in args:
            try: return build(a, v)
            except Exception: pass
        raise AssertionError(("no union member fits", args, v))
    if org is list:
        assert isinstance(v, list), ("expected list", v); return [build(args[0], x) for x in v]
    if dataclasses.is_dataclass(tp):
        assert isinstance(v, dict), ("expected object", v)
        hints, kw = typing.get_type_hints(tp), {}
        for f in dataclasses.fields(tp):
            key = f.metadata.get("json", f.name)
            if key in v: kw[f.name] = build(hints[f.name], v[key])
        return tp(**kw)
    if tp is float: assert isinstance(v, (int, float)) and not isinstance(v, bool), ("float", v); return v
    if tp is int: assert isinstance(v, int) and not isinstance(v, bool), ("int", v); return v
    assert isinstance(v, tp), ("type", tp, v); return v
def dump(o):
    if dataclasses.is_dataclass(o):
        return {f.metadata.get("json", f.name): dump(getattr(o, f.name)) for f in dataclasses.fields(o) if getattr(o, f.name) is not None}
    if isinstance(o, list): return [dump(x) for x in o]
    return o
def strip(v):
    if isinstance(v, dict): return {k: strip(x) for k, x in v.items() if x is not None}
    if isinstance(v, list): return [strip(x) for x in v]
    return v
out = []
for case in payload:
    ast.parse(case["src"])
    ns = {}
    exec(case["src"], ns)
    obj = build(ns[case["root"]], case["data"])
    out.append(strip(dump(obj)) == strip(case["data"]))
print(json.dumps(out))
`;
            const cases = DOCS.map(d => ({ src: gen(d, 'python', { name: 'Root' }), root: 'Root', data: d }));
            const r = cp.spawnSync('python', ['-I', '-c', PYCODE], { input: JSON.stringify(cases), encoding: 'utf8' });
            assert.equal(r.status, 0, r.stderr.slice(-1500));
            assert.deepEqual(JSON.parse(r.stdout), cases.map(() => true), 'dataclass 載入後內容與範例相同');
        }
    }
    ok('json types: Python dataclass');

    // --- 其他 ---
    for (const l of ['ts', 'schema', 'mongoose', 'python', 'go']) for (const d of DOCS) assert.doesNotThrow(() => gen(d, l, { name: '', kind: 'x', exp: 1 }), l);
    { const big = Array.from({ length: 20000 }, (_, i) => ({ id: i, name: 'n' + i, tags: ['a'], o: i % 2 ? { x: i } : null })); const t0 = Date.now(); const out = gen(big, 'ts'); assert.ok(Date.now() - t0 < 3000 && out.includes('o: O | null;')); }
    ok('json types: robustness (names, huge arrays)');
}
