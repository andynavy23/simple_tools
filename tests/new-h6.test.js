// 批次 h6：utils/log-viewer.html（日誌 / JSON Lines / Stack trace）與 utils/db-query.html（Redis / Elasticsearch）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ================= log-viewer =================
    const L = load('utils/log-viewer.html', 'LIM, splitLines, normLevel, parseTime, parseLog, detectFormat, filterEntries, foldRepeats, stats, highlight, parseJsonLines, filterRows, sortRows, parseStack, compactStack, rootIndex, detectLang');
    const T = (s) => Date.UTC(...s);

    assert.equal(L.normLevel('WARNING'), 'WARN'); assert.equal(L.normLevel('severe'), 'ERROR'); assert.equal(L.normLevel('trace'), 'DEBUG'); assert.equal(L.normLevel(50), 'ERROR'); assert.equal(L.normLevel('30'), 'INFO'); assert.equal(L.normLevel('x'), '');
    assert.equal(L.parseTime('2024-05-01 10:00:01,123'), T([2024, 4, 1, 10, 0, 1, 123]));
    assert.equal(L.parseTime('2024-05-01T10:00:01+08:00'), T([2024, 4, 1, 10, 0, 1]));
    assert.equal(L.parseTime('10/Oct/2000:13:55:36 -0700'), T([2000, 9, 10, 13, 55, 36]));
    assert.equal(L.parseTime('May  1 10:00:01', 2024), T([2024, 4, 1, 10, 0, 1]));
    assert.equal(L.parseTime(1714557601), 1714557601000); assert.equal(L.parseTime('1714557601000'), 1714557601000);
    assert.equal(L.parseTime('2024-13-01'), null); assert.equal(L.parseTime('hello'), null); assert.equal(L.parseTime(null), null);
    assert.equal(L.parseTime('2024-05-01 10:00'), T([2024, 4, 1, 10, 0, 0]));

    // 各格式真實樣本
    const nginx = [
        '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://x/" "Mozilla/4.08"',
        '10.0.0.2 - - [10/Oct/2000:13:56:01 -0700] "POST /login HTTP/1.1" 404 12 "-" "curl/7"',
        '10.0.0.2 - - [10/Oct/2000:13:56:02 -0700] "GET /boom HTTP/1.1" 502 0 "-" "curl/7"'].join('\n');
    let r = L.parseLog(nginx); assert.equal(r.fmt, 'combined'); assert.equal(r.entries.length, 3);
    assert.deepEqual(r.entries.map(e => e.level), ['INFO', 'WARN', 'ERROR']); assert.ok(r.entries[0].msg.includes('GET /apache_pb.gif'));

    const sys = ['May  1 10:00:01 host1 sshd[123]: Accepted password for bob', 'May  1 10:00:05 host1 kernel: disk failure on sda', '<34>May  1 10:00:09 host1 cron[9]: (root) CMD (run)'].join('\n');
    r = L.parseLog(sys, { year: 2024 }); assert.equal(r.fmt, 'syslog'); assert.equal(r.entries[0].time, T([2024, 4, 1, 10, 0, 1])); assert.deepEqual(r.entries.map(e => e.level), ['INFO', 'ERROR', 'INFO']);

    const java = ['2024-05-01 10:00:01,123 INFO  [main] com.a.App - started', '2024-05-01 10:00:02.456 [http-1] ERROR c.a.Svc - failed', 'java.lang.IllegalStateException: bad', '\tat com.a.Svc.run(Svc.java:10)', 'Caused by: java.io.IOException: io', '\t... 3 more', '2024-05-01 10:00:03,000 WARN c.a.X - slow', '2024-05-01T10:00:04Z [DEBUG] y'].join('\n');
    r = L.parseLog(java); assert.equal(r.fmt, 'java'); assert.equal(r.entries.length, 4, '堆疊併入上一筆');
    assert.deepEqual(r.entries.map(e => e.level), ['INFO', 'ERROR', 'WARN', 'DEBUG']); assert.ok(r.entries[1].raw.includes('Caused by') && r.entries[1].raw.split('\n').length === 5); assert.equal(r.entries[1].n, 2);

    const py = ['2024-05-01 10:00:01,123 - app.db - WARNING - slow query', '2024-05-01 10:00:02,000 - app - ERROR - boom', 'Traceback (most recent call last):', '  File "a.py", line 1, in <module>', 'ValueError: x'].join('\n');
    r = L.parseLog(py); assert.equal(r.fmt, 'python'); assert.equal(r.entries.length, 2); assert.equal(r.entries[1].raw.split('\n').length, 4);
    r = L.parseLog('WARNING:root:careful\nERROR:app.x:bad thing\nINFO:root:ok'); assert.equal(r.fmt, 'python'); assert.deepEqual(r.entries.map(e => e.level), ['WARN', 'ERROR', 'INFO']);

    const js = ['{"time":"2024-05-01T10:00:01.5Z","level":"info","msg":"hi","a":1}', '{"ts":1714557602,"severity":"ERROR","message":"bad","code":500}', 'not json', '{"level":30,"msg":"pino"}', '[1,2]'].join('\n');
    r = L.parseLog(js); assert.equal(r.fmt, 'json'); assert.equal(r.entries.length, 5);
    assert.deepEqual(r.entries.map(e => e.level), ['INFO', 'ERROR', '', 'INFO', '']); assert.equal(r.entries[2].bad, true); assert.equal(r.entries[4].bad, true); assert.equal(r.entries[1].time, 1714557602000);

    r = L.parseLog('hello world\nsomething failed here\n\n  indented'); assert.equal(r.fmt, 'plain'); assert.equal(r.entries.length, 3); assert.equal(r.entries[1].level, 'ERROR');
    assert.equal(L.parseLog('').entries.length, 0); assert.equal(L.parseLog(null).fmt, 'plain');
    assert.equal(L.parseLog(java, { fmt: 'plain' }).fmt, 'plain');   // 手動指定
    assert.equal(L.parseLog('a\r\nb\r\n').entries.length, 2);

    // 行數上限
    assert.deepEqual(L.splitLines('a\nb\nc', 2), { lines: ['a', 'b'], truncated: true });
    assert.deepEqual(L.splitLines('a\nb\n', 2), { lines: ['a', 'b'], truncated: false });
    r = L.parseLog('x\n'.repeat(10), { max: 4 }); assert.equal(r.truncated, true); assert.equal(r.entries.length, 4);

    // 篩選
    const E = L.parseLog(java).entries;
    assert.deepEqual(L.filterEntries(E, { levels: ['ERROR'] }).idx, [1]);
    assert.deepEqual(L.filterEntries(E, { levels: ['ERROR', 'WARN'] }).idx, [1, 2]);
    assert.deepEqual(L.filterEntries(E, { from: T([2024, 4, 1, 10, 0, 2]), to: T([2024, 4, 1, 10, 0, 3]) }).idx, [1, 2]);
    assert.deepEqual(L.filterEntries(E, { q: 'ioexception' }).idx, [1], '關鍵字不分大小寫並搜尋整個多行內容');
    assert.deepEqual(L.filterEntries(E, { q: 'sl(o|a)w', isRe: true }).idx, [2]);
    assert.ok(L.filterEntries(E, { q: '(', isRe: true }).err);
    assert.deepEqual(L.filterEntries(E, { levels: ['?'] }).idx, []);

    // 折疊
    const F = L.parseLog('2024-05-01 10:00:01 INFO a\n2024-05-01 10:00:02 INFO a\n2024-05-01 10:00:03 INFO a\n2024-05-01 10:00:04 WARN a\n2024-05-01 10:00:05 INFO a').entries;
    assert.deepEqual(L.foldRepeats(F, [0, 1, 2, 3, 4]), [{ i: 0, count: 3 }, { i: 3, count: 1 }, { i: 4, count: 1 }]);
    assert.deepEqual(L.foldRepeats(F, []), []);

    // 統計
    let st = L.stats(E); assert.deepEqual([st.levels.ERROR, st.levels.WARN, st.levels.INFO, st.levels.DEBUG], [1, 1, 1, 1]);
    assert.equal(st.timeline.bucket, 60000); assert.equal(st.timeline.counts.reduce((a, b) => a + b, 0), 4); assert.equal(st.timeline.errs.reduce((a, b) => a + b, 0), 1);
    assert.equal(L.stats(L.parseLog('a\nb').entries).timeline, null);
    const span = L.parseLog('2024-01-01 00:00:00 INFO a\n2024-03-01 00:00:00 ERROR b').entries; st = L.stats(span);
    assert.ok(st.timeline.bucket > 60000 && st.timeline.counts.length <= 121 && st.timeline.errs.reduce((a, b) => a + b) === 1);

    // 高亮
    assert.deepEqual(L.highlight('Hello hello', 'hel', false), [{ t: 'Hel', m: true }, { t: 'lo ', m: false }, { t: 'hel', m: true }, { t: 'lo', m: false }]);
    assert.deepEqual(L.highlight('a.b', '.', false), [{ t: 'a', m: false }, { t: '.', m: true }, { t: 'b', m: false }]);
    assert.deepEqual(L.highlight('abc', '', false), [{ t: 'abc', m: false }]); assert.deepEqual(L.highlight('abc', '(', true), [{ t: 'abc', m: false }]);
    assert.ok(L.highlight('abc', 'x*', true).length >= 1, '空匹配不會無窮迴圈');

    // JSON Lines
    const jl = L.parseJsonLines('{"a":1,"b":"x"}\n\n{"a":3,"c":{"d":1}}\nbroken {\n[1]\n{"a":2,"b":"y"}');
    assert.equal(jl.rows.length, 3); assert.deepEqual(jl.cols, ['a', 'b', 'c']); assert.deepEqual(jl.bad.map(b => b.n), [4, 5]); assert.deepEqual(jl.rows.map(x => x.n), [1, 3, 6]);
    assert.deepEqual(L.filterRows(jl.rows, 'b', 'eq', 'x').map(x => x.n), [1]);
    assert.deepEqual(L.filterRows(jl.rows, 'a', 'gt', '1').map(x => x.n), [3, 6]);
    assert.deepEqual(L.filterRows(jl.rows, 'b', 'exists', '').map(x => x.n), [1, 6]);
    assert.deepEqual(L.filterRows(jl.rows, 'b', 'contains', 'Y').map(x => x.n), [6]);
    assert.deepEqual(L.filterRows(jl.rows, 'c', 'contains', '"d"').map(x => x.n), [3]);
    assert.equal(L.filterRows(jl.rows, 'a', 'regex', '('), null); assert.equal(L.filterRows(jl.rows, 'a', 'eq', '').length, 3);
    assert.deepEqual(L.sortRows(jl.rows, 'a', 1).map(x => x.n), [1, 6, 3]); assert.deepEqual(L.sortRows(jl.rows, 'a', -1).map(x => x.n), [3, 6, 1]);
    assert.deepEqual(L.sortRows(jl.rows, 'b', -1).map(x => x.n), [6, 1, 3], '缺欄位永遠在最後');
    const wide = L.parseJsonLines(JSON.stringify(Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['k' + i, i])))); assert.equal(wide.cols.length, L.LIM.cols); assert.equal(wide.colsCut, true);

    // Stack trace
    const JAVA = `Exception in thread "main" java.lang.RuntimeException: wrapper
\tat com.mycorp.App.main(App.java:10)
\tat java.base/java.util.ArrayList.forEach(ArrayList.java:1511)
\tat org.springframework.web.Servlet.service(Servlet.java:5)
\tat org.springframework.web.Servlet.doIt(Servlet.java:9)
Caused by: java.io.IOException: disk
\tat com.mycorp.Dao.read(Dao.java:77)
\tat sun.nio.ch.Foo.bar(Foo.java:1)
\t... 5 more`;
    let s = L.parseStack(JAVA, ['com.mycorp']); assert.equal(s.lang, 'java'); assert.equal(s.blocks.length, 2); assert.equal(s.blocks[1].role, 'cause');
    assert.deepEqual(s.blocks[0].frames.map(f => f.kind), ['mine', 'lib', 'lib', 'lib']); assert.deepEqual(s.blocks[1].frames.map(f => f.kind), ['mine', 'lib']);
    assert.equal(s.counts.mine, 2); assert.equal(L.rootIndex(s), 1); assert.equal(s.blocks[1].extra.length, 1);
    const c = L.compactStack(s); assert.ok(c.includes('Caused by: java.io.IOException: disk') && c.includes('com.mycorp.Dao.read') && !c.includes('Servlet') && c.includes('3 個框架庫呼叫'));
    assert.ok(L.compactStack(s, { keepLib: true }).includes('Servlet.service'));
    s = L.parseStack(JAVA, ''); assert.equal(s.counts.mine, 0); assert.equal(s.blocks[0].frames[0].kind, 'app');

    const PY = `Traceback (most recent call last):
  File "/app/src/main.py", line 10, in <module>
    run()
  File "/usr/lib/python3.11/site-packages/requests/api.py", line 5, in get
    return x
KeyError: 'a'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/app/src/main.py", line 20, in handler
    raise ValueError("bad")
ValueError: bad`;
    s = L.parseStack(PY, ['/app/src/']); assert.equal(s.lang, 'python'); assert.equal(s.blocks.length, 2); assert.equal(s.blocks[1].role, 'context'); assert.equal(s.blocks[0].tail, "KeyError: 'a'"); assert.equal(s.blocks[1].tail, 'ValueError: bad');
    assert.deepEqual(s.blocks[0].frames.map(f => f.kind), ['mine', 'lib']); assert.equal(s.blocks[0].frames[0].lines.length, 2); assert.equal(L.rootIndex(s), 0);
    assert.ok(L.compactStack(s).includes('During handling') && L.compactStack(s).includes('run()') && !L.compactStack(s).includes('requests'));

    const NODE = `TypeError: Cannot read properties of undefined (reading 'x')
    at foo (/app/src/a.js:10:5)
    at Object.<anonymous> (/app/node_modules/express/lib/router.js:20:3)
    at Module._compile (node:internal/modules/cjs/loader:1256:14)
    at /app/src/b.js:3:1`;
    s = L.parseStack(NODE, '/app/src/'); assert.equal(s.lang, 'js'); assert.deepEqual(s.blocks[0].frames.map(f => f.kind), ['mine', 'lib', 'lib', 'mine']);
    const FF = `boom@https://x.com/app.js:10:5\nrender@https://x.com/app.js:20:1\n@https://x.com/lib.js:1:1`;
    s = L.parseStack(FF); assert.equal(s.lang, 'js'); assert.equal(s.blocks[0].frames.length, 3);

    const NET = `System.InvalidOperationException: outer ---> System.IO.IOException: inner
   at System.IO.File.Open(String path)
   at MyApp.Service.Load(String id) in C:\\src\\Service.cs:line 42
   --- End of inner exception stack trace ---
   at MyApp.Program.Main(String[] args) in C:\\src\\Program.cs:line 10`;
    s = L.parseStack(NET, ['MyApp']); assert.equal(s.lang, 'dotnet'); assert.equal(s.blocks.length, 2); assert.equal(s.blocks[1].role, 'cause'); assert.equal(s.blocks[0].head, 'System.InvalidOperationException: outer');
    assert.deepEqual(s.blocks[1].frames.map(f => f.kind), ['lib', 'mine', 'mine']); assert.equal(L.rootIndex(s), 1);

    const GO = `panic: runtime error: index out of range [5] with length 3

goroutine 1 [running]:
main.process(0xc000012345, 0x5)
\t/app/main.go:25 +0x1d
runtime/debug.Stack()
\t/usr/local/go/src/runtime/debug/stack.go:24 +0x5e
main.main()
\t/app/main.go:10 +0x2f
exit status 2`;
    s = L.parseStack(GO, ['/app/']); assert.equal(s.lang, 'go'); assert.equal(s.blocks.length, 2); assert.equal(s.blocks[0].head.startsWith('panic:'), true);
    assert.deepEqual(s.blocks[1].frames.map(f => f.kind), ['mine', 'lib', 'mine']); assert.ok(s.blocks[1].frames[0].text.includes('main.go:25')); assert.equal(s.blocks[1].extra.length, 1);
    assert.ok(!L.compactStack(s).includes('debug.Stack'));

    // 壞輸入不會丟錯
    for (const bad of ['', '   \n  ', 'just text', null, undefined, '\tat\n at (', 'Traceback (most recent call last):', 'goroutine 1 [x]:']) { const x = L.parseStack(bad); assert.ok(Array.isArray(x.blocks)); L.compactStack(x); }
    assert.equal(L.parseStack('hello').lang, 'unknown');
    ok('h6 log-viewer: formats / filters / stats / jsonl / stack traces');

    // 效能：10 萬行 < 1 秒
    const big = Array.from({ length: 100000 }, (_, i) => `2024-05-01 10:${String(i % 60).padStart(2, '0')}:00,000 ${['INFO', 'WARN', 'ERROR', 'DEBUG'][i % 4]} [t] c.A - message number ${i}`).join('\n');
    let t0 = Date.now(); r = L.parseLog(big); const f = L.filterEntries(r.entries, { levels: ['ERROR'], q: 'number 9' }); L.stats(r.entries); L.foldRepeats(r.entries, f.idx);
    assert.equal(r.entries.length, 100000); assert.ok(Date.now() - t0 < 1000, '10 萬行 parse + 篩選 + 統計 < 1 秒：' + (Date.now() - t0));
    const bigJson = Array.from({ length: 100000 }, (_, i) => JSON.stringify({ time: 1714557600 + i, level: 'info', msg: 'm' + i, n: i })).join('\n');
    t0 = Date.now(); r = L.parseLog(bigJson); const jj = L.parseJsonLines(bigJson); L.sortRows(jj.rows, 'n', -1); assert.ok(r.entries.length === 100000 && jj.rows.length === 100000 && Date.now() - t0 < 1500, 'json 10 萬行：' + (Date.now() - t0));
    r = L.parseLog('x\n'.repeat(250000)); assert.equal(r.entries.length, L.LIM.lines); assert.equal(r.truncated, true);
    ok('h6 log-viewer: 10 萬行效能與 20 萬行上限');
}

{ // ================= nosql-query =================
    const N = load('utils/db-query.html', 'CMDS, GROUPS, LIM, loadOpts, buildRedis, cliQuote, renderRedis, argTokens, buildEs, renderEs, defaultEs, validIndex', '// --- pure:nosql ---', '// --- /pure:nosql ---');
    const R = (cmd, vals) => N.buildRedis(cmd, vals), cli = (cmd, vals) => { const r = R(cmd, vals); assert.ok(r.ok, cmd + ' ' + r.errs.join()); return N.renderRedis(r.argv, 'cli'); };

    // 跳脫
    assert.equal(N.cliQuote('abc:1'), 'abc:1'); assert.equal(N.cliQuote(''), '""'); assert.equal(N.cliQuote('a b'), '"a b"');
    assert.equal(N.cliQuote('he said "hi"'), '"he said \\"hi\\""'); assert.equal(N.cliQuote('a\nb\t\\'), '"a\\nb\\t\\\\"'); assert.equal(N.cliQuote('\x01'), '"\\x01"'); assert.equal(N.cliQuote("it's"), '"it\'s"'); assert.equal(N.cliQuote('中文'), '"中文"');
    assert.equal(cli('SET', { key: 'session:1', value: 'abc', ex: '60' }), 'SET session:1 abc EX 60');
    assert.equal(cli('SET', { key: 'k', value: 'a b', cond: 'NX', ex: '10' }), 'SET k "a b" NX EX 10');
    assert.equal(cli('GET', { key: 'user:1' }), 'GET user:1');
    assert.equal(cli('HSET', { key: 'h', pairs: 'name=Bob\nnote=a=b' }), 'HSET h name Bob note a=b');
    assert.equal(cli('ZADD', { key: 'z', cond: 'NX', ch: 'true', pairs: '1.5=alice\n-inf=bob' }), 'ZADD z NX CH 1.5 alice -inf bob');
    assert.equal(cli('LRANGE', { key: 'l' }), 'LRANGE l 0 -1');
    assert.equal(cli('ZRANGE', { key: 'z', byscore: 'true', rev: 'true', withscores: 'true' }), 'ZRANGE z 0 -1 BYSCORE REV WITHSCORES');
    assert.equal(cli('XADD', { key: 's', maxlen: '1000', pairs: 'a=1\nb=2' }), 'XADD s MAXLEN ~ 1000 * a 1 b 2');
    assert.equal(cli('XREAD', { count: '10', block: '5000', key: 's' }), 'XREAD COUNT 10 BLOCK 5000 STREAMS s $');
    assert.equal(cli('XREADGROUP', { group: 'g', consumer: 'c1', key: 's' }), 'XREADGROUP GROUP g c1 STREAMS s >');
    assert.equal(cli('XGROUP CREATE', { key: 's', group: 'g', mk: 'true' }), 'XGROUP CREATE s g $ MKSTREAM');
    assert.equal(cli('XTRIM', { key: 's', approx: 'true', n: '100' }), 'XTRIM s MAXLEN ~ 100');
    assert.equal(cli('SCAN', { match: 'user:*', count: '100', type: 'hash' }), 'SCAN 0 MATCH user:* COUNT 100 TYPE hash');
    assert.equal(cli('EXPIRE', { key: 'k', seconds: '60', cond: 'NX' }), 'EXPIRE k 60 NX');
    assert.equal(cli('MSET', { pairs: 'a=1\nb=2' }), 'MSET a 1 b 2'); assert.equal(cli('DEL', { keys: 'a\nb' }), 'DEL a b');
    assert.equal(cli('OBJECT ENCODING', { key: 'k' }), 'OBJECT ENCODING k'); assert.equal(cli('FLUSHDB', {}), 'FLUSHDB'); assert.equal(cli('LPOP', { key: 'l' }), 'LPOP l');
    assert.equal(cli('BLPOP', { key: 'q', timeout: '0.5' }), 'BLPOP q 0.5'); assert.equal(cli('ZCOUNT', { key: 'z', min: '(1' }), 'ZCOUNT z (1 +inf');
    // 其他語言：數字保持數字、字串跳脫
    let r = R('SET', { key: 'k"1', value: 'line1\nline2', ex: '5' });
    assert.equal(N.renderRedis(r.argv, 'node'), `const Redis = require('ioredis');\nconst redis = new Redis(); // 預設 127.0.0.1:6379\n\nconst result = await redis.set("k\\"1", "line1\\nline2", "EX", 5);`);
    assert.equal(N.renderRedis(r.argv, 'python').split('\n').pop(), 'result = r.execute_command("SET", "k\\"1", "line1\\nline2", "EX", 5)');
    r = R('XGROUP CREATE', { key: 's', group: 'g' }); assert.ok(N.renderRedis(r.argv, 'node').endsWith('redis.xgroup("CREATE", "s", "g", "$");'));
    // 驗證
    assert.ok(!R('GET', {}).ok); assert.ok(!R('GET', { key: '  ' }).ok); assert.ok(!R('INCRBY', { key: 'k', n: '1.5' }).ok); assert.ok(!R('INCRBY', { key: 'k', n: '99999999999999999999' }).ok);
    assert.ok(!R('HSET', { key: 'h', pairs: 'noequal' }).ok); assert.ok(!R('ZADD', { key: 'z', pairs: 'x=member' }).ok); assert.ok(!R('ZADD', { key: 'z', pairs: '1=' }).ok);
    assert.ok(!R('SET', { key: 'k', value: 'v', ex: '0' }).ok); assert.ok(!R('SET', { key: 'k', value: 'v', cond: 'ZZ' }).ok); assert.ok(!R('ZCOUNT', { key: 'z', min: 'abc' }).ok);
    assert.ok(!R('SADD', { key: 's', members: Array.from({ length: 501 }, (_, i) => 'm' + i).join('\n') }).ok);
    assert.ok(!R('NOPE', {}).ok); assert.ok(!R('__proto__', {}).ok); assert.ok(!R('GET', null).ok);
    assert.ok(R('SET', { key: 'k', value: '' }).ok, '空字串值允許');
    // 警告
    const lv = (cmd, v) => R(cmd, v).warns.map(w => w.level);
    assert.deepEqual(lv('KEYS', { pattern: '*' }), ['danger']); assert.deepEqual(lv('FLUSHDB', {}), ['danger']); assert.ok(lv('DEL', { keys: 'a' }).includes('info') && R('DEL', { keys: 'a' }).warns[0].text.includes('UNLINK'));
    assert.ok(lv('LRANGE', { key: 'l' }).includes('warn') && !lv('LRANGE', { key: 'l', stop: '9' }).includes('warn')); assert.ok(lv('SET', { key: 'k', value: 'v', cond: 'NX' }).includes('warn')); assert.deepEqual(lv('SET', { key: 'k', value: 'v', cond: 'NX', ex: '5' }), []);
    assert.ok(lv('XADD', { key: 's', pairs: 'a=1' }).includes('info')); assert.ok(lv('HGETALL', { key: 'h' }).includes('warn'));
    // 資料表完整性：每個指令都有時間複雜度、群組存在
    const gs = N.GROUPS.map(g => g[0]);
    for (const [name, m] of Object.entries(N.CMDS)) { assert.ok(m.cx, name + ' 缺時間複雜度'); assert.ok(gs.includes(m.g), name); assert.ok(Array.isArray(m.args)); if (m.sev === 'danger' || m.sev === 'warn') assert.ok(m.note, name + ' 需有說明'); }
    for (const g of gs) assert.ok(Object.values(N.CMDS).some(m => m.g === g), g);
    assert.deepEqual(N.loadOpts(null), { tab: 'redis', cmd: 'GET', fmt: 'cli', efmt: 'dsl' }); assert.deepEqual(N.loadOpts([1]), N.loadOpts(undefined));
    assert.equal(N.loadOpts({ tab: 'es', cmd: 'KEYS', fmt: 'python', efmt: 'curl' }).cmd, 'KEYS'); assert.equal(N.loadOpts({ cmd: 'constructor', fmt: 'x' }).cmd, 'GET'); assert.equal(N.loadOpts({ fmt: 'x', tab: 5 }).fmt, 'cli');
    ok('h6 nosql-query: redis commands / quoting / warnings');

    // ---------- Elasticsearch ----------
    const S = (o = {}) => ({ ...N.defaultEs(), ...o });
    const cond = (field, op, value, extra = {}) => ({ field, op, type: 'string', value, occ: 'must', ...extra });
    const B = (o) => { const x = N.buildEs(S(o)); assert.ok(x.ok, x.errs.join()); return x; };
    let e = B({ conds: [cond('title', 'match', 'quick fox')] });
    assert.deepEqual(e.body, { query: { match: { title: 'quick fox' } }, size: 10 }); assert.equal(e.path, '/_search');
    assert.deepEqual(B({ conds: [cond('', 'match', '')] }).body.query, { match_all: {} });
    e = B({ index: 'logs-*', conds: [cond('status', 'term', '200', { type: 'number', occ: 'filter' }), cond('msg', 'match_phrase', 'time out', { occ: 'must' }), cond('lvl', 'terms', 'a, b\nc', { occ: 'should' }), cond('x', 'exists', '', { occ: 'must_not' }), cond('d', 'gte', '2024-01-01'), cond('d', 'lt', '2024-02-01')], msm: '1' });
    assert.equal(e.path, '/logs-*/_search');
    assert.deepEqual(e.body.query, { bool: { must: [{ match_phrase: { msg: 'time out' } }, { range: { d: { gte: '2024-01-01', lt: '2024-02-01' } } }], filter: [{ term: { status: 200 } }], should: [{ terms: { lvl: ['a', 'b', 'c'] } }], must_not: [{ exists: { field: 'x' } }], minimum_should_match: 1 } });
    assert.deepEqual(B({ conds: [cond('s', 'term', 'x', { occ: 'filter' })] }).body.query, { bool: { filter: [{ term: { s: 'x' } }] } }, '單一 filter 保持 bool.filter');
    assert.deepEqual(B({ conds: [cond('a', 'prefix', 'ab'), cond('b', 'wildcard', 'a*c')] }).body.query.bool.must, [{ prefix: { a: 'ab' } }, { wildcard: { b: 'a*c' } }]);
    assert.deepEqual(B({ conds: [cond('ok', 'term', 'true', { type: 'bool' })] }).body.query, { term: { ok: true } });
    // 排序 / 分頁 / _source / aggs
    e = B({ sort: [{ field: '@timestamp', dir: 'desc' }, { field: '_id', dir: 'asc' }], from: '20', size: '5', srcMode: 'sel', inc: 'a, b.c', exc: '', track: true });
    assert.deepEqual([e.body.sort, e.body.from, e.body.size, e.body._source, e.body.track_total_hits], [[{ '@timestamp': { order: 'desc' } }, { _id: { order: 'asc' } }], 20, 5, ['a', 'b.c'], true]);
    assert.deepEqual(B({ srcMode: 'sel', inc: 'a', exc: 'b' }).body._source, { includes: ['a'], excludes: ['b'] }); assert.equal(B({ srcMode: 'none' }).body._source, false);
    e = B({ sort: [{ field: 'ts', dir: 'asc' }, { field: '_id', dir: 'asc' }], after: '[1700000000000, "a"]' }); assert.deepEqual(e.body.search_after, [1700000000000, 'a']); assert.ok(e.warns.some(w => w.text.includes('唯一')));
    e = B({ size: '0', aggs: [{ name: 'by_status', type: 'terms', field: 'status.keyword', size: '5' }, { name: 'per_day', type: 'date_histogram', field: 'ts', interval: 'day' }, { name: 'avg_t', type: 'avg', field: 'took' }, { name: 'u', type: 'cardinality', field: 'user' }] });
    assert.deepEqual(e.body.aggs, { by_status: { terms: { field: 'status.keyword', size: 5 } }, per_day: { date_histogram: { field: 'ts', calendar_interval: 'day' } }, avg_t: { avg: { field: 'took' } }, u: { cardinality: { field: 'user' } } }); assert.equal(e.body.size, 0);
    assert.ok(B({ aggs: [{ name: 'g', type: 'terms', field: 'city' }] }).warns.some(w => w.text.includes('.keyword')));
    assert.ok(B({ from: '9995', size: '10' }).warns.some(w => w.level === 'danger'));
    // 錯誤
    const bad = (o) => { const x = N.buildEs(S(o)); assert.ok(!x.ok && x.errs.length, JSON.stringify(o)); };
    bad({ index: 'Logs' }); bad({ index: '_x' }); bad({ index: 'a b' }); bad({ conds: [cond('', 'match', 'x')] }); bad({ conds: [cond('a', 'term', 'x', { type: 'number' })] }); bad({ conds: [cond('a', 'match', '')] });
    bad({ conds: [cond('a', 'gte', '1'), cond('a', 'gte', '2')] }); bad({ conds: [cond('a', 'zzz', '1')] }); bad({ conds: [cond('__proto__', 'match', '1')] }); bad({ conds: [cond('a', 'terms', ' , ')] });
    bad({ conds: [cond('a', 'match', 'x', { occ: 'must' })], msm: '1' }); bad({ conds: [cond('a', 'match', 'x', { occ: 'should' })], msm: 'abc' });
    bad({ from: '-1' }); bad({ size: '1.5' }); bad({ after: '[1]' }); bad({ after: 'x', sort: [{ field: 'a', dir: 'asc' }] }); bad({ after: '[1,2]', sort: [{ field: 'a', dir: 'asc' }] }); bad({ after: '[1]', from: '5', sort: [{ field: 'a', dir: 'asc' }] });
    bad({ sort: [{ field: 'a', dir: 'asc' }, { field: 'a', dir: 'desc' }] }); bad({ aggs: [{ name: '', type: 'avg', field: 'x' }] }); bad({ aggs: [{ name: 'a', type: 'avg', field: 'x' }, { name: 'a', type: 'sum', field: 'x' }] }); bad({ aggs: [{ name: 'd', type: 'date_histogram', field: 'x', interval: '' }] });
    bad({ aggs: [{ name: 'a>b', type: 'avg', field: 'x' }] }); bad({ conds: Array.from({ length: 31 }, () => cond('a', 'match', 'x')) });
    assert.ok(!N.buildEs(null).errs.length, 'null → 預設');
    // 輸出：DSL 必須可 JSON.parse
    e = B({ index: 'idx', conds: [cond('name', 'match', "it's \"q\"\n新增")], aggs: [{ name: 'a', type: 'avg', field: 'x' }] });
    assert.deepEqual(JSON.parse(N.renderEs(e, 'dsl')), e.body);
    const kb = N.renderEs(e, 'kibana'); assert.ok(kb.startsWith('GET /idx/_search\n{')); assert.deepEqual(JSON.parse(kb.slice(kb.indexOf('\n') + 1)), e.body);
    const cu = N.renderEs(e, 'curl'); assert.ok(cu.startsWith("curl -X POST 'http://localhost:9200/idx/_search?pretty' \\\n  -H 'Content-Type: application/json' \\\n  -d '") && cu.includes("it'\\''s"));
    const inner = cu.slice(cu.indexOf("-d '") + 4, -1).replace(/'\\''/g, "'"); assert.deepEqual(JSON.parse(inner), e.body);
    assert.equal(N.validIndex('a,b-*,c.d'), ''); assert.ok(N.validIndex('a,'));
    ok('h6 nosql-query: elasticsearch DSL / errors / output');
}
