// g10 批次：regex-tester / cron-parser / semver / base-converter / timestamp / chmod-calc / screen-test / excel-formula 的新增純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- regex-tester ----------
{
    const R = load('utils/regex-tester.html', 'explainRegex, toLangStrings, inferRegex, escStr');
    const ex = (s) => R.explainRegex(s);
    let r = ex('(\\w+)@(\\w+)\\.com');
    assert.deepStrictEqual(r.map(x => x.tok), ['(', '\\w', '+', ')', '@', '(', '\\w', '+', ')', '.com']);
    assert.ok(r.every(x => !x.bad));
    assert.strictEqual(r[0].depth, 0); assert.strictEqual(r[1].depth, 1);
    // 量詞只套用在最後一個字元
    r = ex('abc+'); assert.deepStrictEqual(r.map(x => x.tok), ['ab', 'c', '+']);
    r = ex('a{2,5}?'); assert.strictEqual(r[1].tok, '{2,5}?'); assert.ok(r[1].desc.includes('2 到 5') && r[1].desc.includes('非貪婪'));
    assert.ok(ex('a{3}')[1].desc.includes('剛好重複 3'));
    assert.ok(ex('a{3,}')[1].desc.includes('3 次以上'));
    assert.ok(ex('a{x')[0].tok === 'a{x' && !ex('a{x')[0].bad); // 不是量詞的 { 當字面
    // 字元集合
    r = ex('[^a-z0-9_]'); assert.ok(r[0].desc.includes('不是下列') && r[0].desc.includes('a 到 z') && r[0].desc.includes('0 到 9'));
    assert.ok(ex('[\\d.]')[0].desc.includes('數字'));
    assert.ok(ex('[abc')[0].bad);
    // 群組與斷言
    r = ex('(?<y>\\d{4})-(?:a|b)(?=x)(?!y)(?<=p)(?<!q)'); assert.ok(r.every(x => !x.bad), JSON.stringify(r.filter(x => x.bad)));
    assert.ok(r[0].desc.includes('具名群組「y」'));
    assert.ok(r.some(x => x.desc.includes('負向後行')));
    // 錯誤與未解析
    assert.ok(ex('a)')[1].bad); assert.ok(ex('(a').pop().bad);
    assert.ok(ex('*a')[0].bad); assert.ok(ex('a|*')[2].bad); assert.ok(ex('a**')[2].bad);
    assert.ok(ex('(?i)a')[0].bad); assert.ok(ex('\\q')[0].bad); assert.ok(ex('a\\')[1].bad);
    assert.ok(ex('\\u00e9')[0].desc.includes('U+00E9')); assert.ok(ex('\\u12')[0].bad);
    assert.ok(ex('\\x41')[0].desc.includes('0x41')); assert.ok(ex('\\p{L}')[0].desc.includes('Unicode 屬性'));
    assert.ok(ex('(a)\\1')[3].desc.includes('第 1 組')); assert.ok(ex('(?<n>a)\\k<n>')[3].desc.includes('「n」'));
    assert.ok(ex('^a$')[0].desc.includes('開頭') && ex('^a$')[2].desc.includes('結尾'));
    assert.deepStrictEqual(ex(''), []);
    for (let i = 0; i < 500; i++) { const chars = '()[]{}\\|^$.*+?-<>=!:ab1,'; let s = ''; for (let k = 0; k < 12; k++) s += chars[Math.floor(Math.random() * chars.length)]; assert.doesNotThrow(() => ex(s), s); }

    // 各語言輸出
    const L = (src, f) => Object.fromEntries(R.toLangStrings(src, f).map(o => [o.lang, o.code]));
    let o = L('\\d+\\.\\w', 'gi');
    assert.strictEqual(o.JavaScript, '/\\d+\\.\\w/gi\nnew RegExp("\\\\d+\\\\.\\\\w", "gi")');
    assert.strictEqual(o.Python, 're.compile(r"\\d+\\.\\w", re.I)');
    assert.strictEqual(o.Go, 'regexp.MustCompile(`(?i)\\d+\\.\\w`)');
    assert.strictEqual(o.Java, 'Pattern.compile("\\\\d+\\\\.\\\\w", Pattern.CASE_INSENSITIVE)');
    o = L('a/b', ''); assert.ok(o.JavaScript.startsWith('/a\\/b/\n')); assert.ok(o.JavaScript.includes('new RegExp("a/b", "")'));
    o = L('say "hi"', ''); assert.strictEqual(o.Python, 're.compile("say \\"hi\\"")'); assert.strictEqual(o.Java, 'Pattern.compile("say \\"hi\\"")'); assert.strictEqual(o.Go, 'regexp.MustCompile(`say "hi"`)');
    o = L('a\\', ''); assert.strictEqual(o.Python, 're.compile("a\\\\")');
    o = L('a\\\\', ''); assert.strictEqual(o.Python, 're.compile(r"a\\\\")');
    o = L('a`b', ''); assert.strictEqual(o.Go, 'regexp.MustCompile("a`b")');
    o = L('a\nb\t', 'ms'); assert.ok(o.Java.includes('"a\\nb\\t"') && o.Java.includes('Pattern.MULTILINE | Pattern.DOTALL')); assert.ok(o.Python.startsWith('re.compile("a\\nb\\t", re.M | re.S)')); assert.ok(o.Go.startsWith('regexp.MustCompile(`(?ms)'));
    assert.strictEqual(R.escStr('\x01', 'java'), '\\u0001'); assert.strictEqual(R.escStr('\x01', 'py'), '\\x01'); assert.strictEqual(R.escStr('中😀', 'js'), '中😀');
    // JS 兩種輸出都要還原成同一個正則
    for (const src of ['\\d+', 'a"b\\c', '[\\]]+', '(\\w+)@(\\w+)\\.com', 'a/b', '[/]x']) {
        const js = L(src, 'g').JavaScript.split('\n');
        assert.strictEqual(eval(js[0]).source, new RegExp(src).source);
        assert.strictEqual(eval(js[1]).source, new RegExp(src).source);
    }

    // 推測
    const POS = ['A123456789', 'B234567890', 'F198765432'], NEG = ['123456789', 'AB12345678'];
    let inf = R.inferRegex(POS, NEG);
    assert.ok(inf.candidates.length >= 1);
    for (const c of inf.candidates) { const re = new RegExp(c.re); POS.forEach(s => assert.ok(re.test(s))); NEG.forEach(s => assert.ok(!re.test(s))); }
    assert.strictEqual(inf.candidates[0].re, '^[A-Z]\\d{9}$');
    inf = R.inferRegex(['2026-01-05', '1999-12-31'], []); assert.strictEqual(inf.candidates[0].re, '^\\d{4}\\-\\d{2}\\-\\d{2}$');
    inf = R.inferRegex(['a1', 'bcd22'], []); assert.strictEqual(inf.candidates[0].re, '^[a-z]{1,3}\\d{1,2}$'); assert.strictEqual(inf.candidates[1].re, '^[a-z]+\\d+$');
    inf = R.inferRegex(['id-1', 'id-22'], []); assert.strictEqual(inf.candidates[0].re, '^id\\-\\d{1,2}$');
    inf = R.inferRegex(['a.b', 'x.y'], ['a b']); assert.ok(new RegExp(inf.candidates[0].re).test('a.b'));
    inf = R.inferRegex(['12', 'ab'], []); assert.ok(new RegExp(inf.candidates[0].re).test('12') && new RegExp(inf.candidates[0].re).test('ab'));
    assert.ok(R.inferRegex(['abc'], ['abc']).error);
    assert.ok(R.inferRegex([], ['x']).error); assert.ok(R.inferRegex(['', ''], []).error);
    inf = R.inferRegex(['你好', '世界啊'], []); assert.ok(new RegExp(inf.candidates[0].re).test('世界啊'));
    assert.ok(R.inferRegex(Array(201).fill('a'), []).error);
    for (const s of ['a+b', 'a*b', 'a?b', '$1', 'a|b', '[x]', 'a\\b', '{1}', 'a/b', '(x)']) { const r2 = R.inferRegex([s], []); assert.ok(r2.candidates && new RegExp(r2.candidates[0].re).test(s), s); }
    ok('regex-tester: explain / lang strings / infer');
}

// ---------- cron-parser：排程語法轉換 ----------
{
    const C = load('utils/cron-parser.html', 'cronToSystemd, systemdToCron, cronToGha, detectSchedule, convertSchedule, parseCron, nextRuns');
    const sd = (e) => C.cronToSystemd(e);
    assert.strictEqual(sd('0 9 * * 1-5').text, 'Mon..Fri *-*-* 09:00:00');
    assert.strictEqual(sd('*/15 9-17 * * 1-5').text, 'Mon..Fri *-*-* 09..17:00/15:00');
    assert.strictEqual(sd('* * * * *').text, '*-*-* *:*:00');
    assert.strictEqual(sd('30 8 * * MON').text, 'Mon *-*-* 08:30:00');
    assert.strictEqual(sd('0 0 1 * *').text, '*-*-01 00:00:00');
    assert.strictEqual(sd('0 0 1,15 * *').text, '*-*-01,15 00:00:00');
    assert.strictEqual(sd('0 0 1 1 *').text, '*-01-01 00:00:00');
    assert.strictEqual(sd('0,30 12 * * 0').text, 'Sun *-*-* 12:00,30:00');
    assert.strictEqual(sd('0 0,12 * * 6,0').text, 'Sun,Sat *-*-* 00,12:00:00');
    assert.strictEqual(sd('0 0 */2 * *').text, '*-*-01/2 00:00:00');
    assert.strictEqual(sd('@daily').text, '*-*-* 00:00:00');
    assert.strictEqual(sd('0 0 * * 7').text, 'Sun *-*-* 00:00:00');
    assert.ok(sd('0 0 1 * 1').error.includes('無法精確對應'));   // 日 + 週同時指定
    assert.ok(sd('0 0 0 * *').error);                              // 壞 cron
    // systemd → cron
    const sc = (s) => C.systemdToCron(s);
    assert.strictEqual(sc('Mon..Fri *-*-* 09:00:00').cron, '0 9 * * 1-5');
    assert.strictEqual(sc('OnCalendar=*-*-* 09:30').cron, '30 9 * * *');
    assert.strictEqual(sc('daily').cron, '0 0 * * *');
    assert.strictEqual(sc('weekly').cron, '0 0 * * 1');
    assert.strictEqual(sc('*-*-* *:00/15:00').cron, '0/15 * * * *');
    assert.strictEqual(sc('*-*-01,15 00:00:00').cron, '0 0 1,15 * *');
    assert.strictEqual(sc('Sat,Sun 10:00').cron, '0 10 * * 6,0');
    assert.strictEqual(sc('*-12-25 08:00').cron, '0 8 25 12 *');
    assert.strictEqual(sc('12-25 08:00').cron, '0 8 25 12 *');
    assert.strictEqual(sc('*-*-* 09..17:00/30:00').cron, '0/30 9-17 * * *');
    assert.strictEqual(sc('Monday 09:00').cron, '0 9 * * 1');
    assert.strictEqual(sc('*-*-*').cron, '0 0 * * *');
    for (const bad of ['2026-01-01 00:00', '*-*-* 00:00:30', '*-*-~01 00:00', 'Mon *-*-01 00:00', 'Fri..Mon 09:00', '*-*-* 09:00 Asia/Taipei', '*-*-* 09:00 UTC', 'quarterly', 'foo', '', '*-*-* 25:00', '*-13-* 00:00', 'Mon,Foo 09:00'])
        assert.ok(sc(bad).error, '應失敗：' + bad);
    // 往返：能轉的 cron 轉 systemd 再轉回來要相同語意（用未來執行時間比對）
    const from = new Date(2026, 5, 1, 0, 0), same = (a, b) => JSON.stringify(C.nextRuns(C.parseCron(a), from, 40)) === JSON.stringify(C.nextRuns(C.parseCron(b), from, 40));
    for (const e of ['0 9 * * 1-5', '*/15 9-17 * * 1-5', '*/5 * * * *', '30 8 * * MON', '0 0 1 * *', '0 0 1,15 * *', '0 0 1 1 *', '0,30 12 * * 0', '0 0,12 * * 6,0', '0 0 */2 * *', '5 4 * 6-8 *', '0 */6 * * *', '10-40/10 * * * *', '* * * * *', '0 0 * * 7', '15 3 * * 1,3,5']) {
        const t = sd(e); assert.ok(t.text, e);
        const back = sc(t.text); assert.ok(back.cron, e + ' → ' + t.text + ' ' + back.error);
        assert.ok(same(e, back.cron), `${e} → ${t.text} → ${back.cron}`);
    }
    // GitHub Actions
    const g = C.cronToGha('30 8 * * MON');
    assert.strictEqual(g.cron, '30 8 * * 1'); assert.strictEqual(g.yaml, "on:\n  schedule:\n    - cron: '30 8 * * 1'"); assert.ok(g.warns[0].includes('UTC'));
    assert.ok(C.cronToGha('*/2 * * * *').warns.some(w => w.includes('5 分鐘')));
    assert.ok(!C.cronToGha('*/5 * * * *').warns.some(w => w.includes('最短間隔')));
    assert.ok(!C.cronToGha('0 * * * *').warns.some(w => w.includes('最短間隔')));
    assert.strictEqual(C.cronToGha('0 0 ? JAN *').cron, '0 0 * 1 *');
    assert.strictEqual(C.cronToGha('@weekly').cron, '0 0 * * 0');
    assert.ok(C.cronToGha('x').error);
    // 偵測
    assert.strictEqual(C.detectSchedule("on:\n  schedule:\n    - cron: '0 1 * * *'").cron, '0 1 * * *');
    assert.strictEqual(C.detectSchedule('- cron: "5 4 * * *" # 每天').cron, '5 4 * * *');
    assert.strictEqual(C.detectSchedule('cron: 5 4 * * *').source, 'gha');
    assert.strictEqual(C.detectSchedule('  0   9 * * 1 ').source, 'cron');
    assert.strictEqual(C.detectSchedule('@daily').source, 'cron');
    assert.strictEqual(C.detectSchedule('Mon 09:00').source, 'systemd');
    assert.ok(C.detectSchedule('').error);
    let all = C.convertSchedule('0 9 * * 1-5'); assert.strictEqual(all.systemd.text, 'Mon..Fri *-*-* 09:00:00'); assert.ok(all.gha.yaml.includes('0 9 * * 1-5'));
    all = C.convertSchedule('OnCalendar=Mon..Fri *-*-* 09:00:00'); assert.strictEqual(all.cron, '0 9 * * 1-5'); assert.strictEqual(all.systemd.text, 'Mon..Fri *-*-* 09:00:00');
    all = C.convertSchedule("cron: '0 0 1 * 1'"); assert.ok(all.systemd.error && all.gha.yaml);
    assert.ok(C.convertSchedule('1 2 3').error); assert.ok(C.convertSchedule('61 * * * *').error); assert.strictEqual(C.convertSchedule('2026-01-01 00:00').source, 'systemd');
    ok('cron-parser: schedule conversion');
}

// ---------- semver：版本號升級建議 ----------
{
    const S = load('utils/semver.html', 'parseCommits, commitLevel, nextVersion');
    const lv = (t) => S.commitLevel(S.parseCommits(t).entries);
    assert.strictEqual(lv('fix: a'), 'patch'); assert.strictEqual(lv('perf(core): a'), 'patch');
    assert.strictEqual(lv('fix: a\nfeat: b'), 'minor'); assert.strictEqual(lv('feat!: b\nfix: x'), 'major');
    assert.strictEqual(lv('refactor(api)!: x'), 'major');
    assert.strictEqual(lv('fix: a\nBREAKING CHANGE: foo'), 'major'); assert.strictEqual(lv('feat: a\nBREAKING-CHANGE: foo'), 'major');
    assert.strictEqual(lv('docs: a\nchore: b\nstyle: c\ntest: d\nci: e\nbuild: f\nrefactor: g'), null);
    assert.strictEqual(lv(''), null); assert.strictEqual(lv(null), null); assert.strictEqual(lv('隨便寫的 commit'), null);
    assert.strictEqual(lv('- feat: a'), 'minor'); assert.strictEqual(lv('* a1b2c3d fix: a'), 'patch'); assert.strictEqual(lv('FEAT: x'), 'minor');
    assert.strictEqual(lv('BREAKING CHANGE: 沒有前一則'), null);
    let p = S.parseCommits('feat(ui): 新增\n\n很亂的一行\r\nfix:無空白');
    assert.deepStrictEqual(p.entries.map(e => [e.type, e.scope, e.subject]), [['feat', 'ui', '新增'], ['fix', '', '無空白']]); assert.deepStrictEqual(p.ignored, ['很亂的一行']);
    assert.strictEqual(S.parseCommits('BREAKING CHANGE: x').ignored.length, 1);
    const nv = (c, l, o) => S.nextVersion(c, l, o);
    assert.strictEqual(nv('1.4.2', 'patch').version, '1.4.3'); assert.strictEqual(nv('1.4.2', 'minor').version, '1.5.0'); assert.strictEqual(nv('1.4.2', 'major').version, '2.0.0');
    assert.strictEqual(nv('v1.4.2+build.5', 'minor').version, '1.5.0');
    assert.strictEqual(nv('1.4.2', null).version, null);
    // 0.x
    assert.strictEqual(nv('0.2.3', 'major').version, '0.3.0'); assert.strictEqual(nv('0.2.3', 'minor').version, '0.2.4'); assert.strictEqual(nv('0.2.3', 'patch').version, '0.2.4');
    assert.strictEqual(nv('0.2.3', 'major', { zero: 'strict' }).version, '1.0.0'); assert.strictEqual(nv('0.2.3', 'minor', { zero: 'strict' }).version, '0.3.0');
    assert.strictEqual(nv('1.0.0', 'major', { zero: 'conv' }).version, '2.0.0');
    // 預發行
    assert.strictEqual(nv('1.4.2', 'minor', { preid: 'beta' }).version, '1.5.0-beta.0');
    assert.strictEqual(nv('1.4.2', 'major', { preid: 'rc' }).version, '2.0.0-rc.0');
    assert.strictEqual(nv('1.5.0-beta.0', 'minor', { preid: 'beta' }).version, '1.5.0-beta.1');
    assert.strictEqual(nv('1.5.0-beta.9', 'fix', { preid: 'beta' }).version, '1.5.0-beta.10');
    assert.strictEqual(nv('1.5.0-beta.3', 'patch', { preid: 'rc' }).version, '1.5.0-rc.0');
    assert.strictEqual(nv('1.5.0-beta', 'patch', { preid: 'beta' }).version, '1.5.0-beta.0');
    assert.strictEqual(nv('1.5.0-beta.3', 'patch', {}).version, '1.5.0');
    assert.strictEqual(nv('1.5.0-beta.3', null, { preid: 'beta' }).version, null);
    assert.strictEqual(nv('0.2.0', 'major', { preid: 'alpha' }).version, '0.3.0-alpha.0');
    assert.ok(nv('1.0.0', 'minor', { preid: '1' }).error); assert.ok(nv('1.0.0', 'minor', { preid: 'a b' }).error);
    assert.ok(nv('abc', 'minor').error); assert.ok(nv('1.2', 'minor').error); assert.ok(nv('', 'minor').error);
    ok('semver: commit-based bump');
}

// ---------- base-converter：文字 ⇄ 位元組 ----------
{
    const B = load('utils/base-converter.html', 'textToBytes, bytesToText, formatBytes, parseBytes');
    assert.deepStrictEqual(B.textToBytes('A', 'utf8'), [65]);
    assert.deepStrictEqual(B.textToBytes('你', 'utf8'), [0xE4, 0xBD, 0xA0]);
    assert.deepStrictEqual(B.textToBytes('😀', 'utf8'), [0xF0, 0x9F, 0x98, 0x80]);
    assert.deepStrictEqual(B.textToBytes('你', 'utf16be'), [0x4F, 0x60]); assert.deepStrictEqual(B.textToBytes('你', 'utf16le'), [0x60, 0x4F]);
    assert.deepStrictEqual(B.textToBytes('😀', 'utf16be'), [0xD8, 0x3D, 0xDE, 0x00]);
    assert.deepStrictEqual(B.textToBytes('', 'utf8'), []);
    assert.strictEqual(B.formatBytes([72, 105], 2), '01001000 01101001'); assert.strictEqual(B.formatBytes([72, 105, 255, 0], 16), '48 69 FF 00');
    assert.strictEqual(B.formatBytes([72, 255, 0], 8), '110 377 000'); assert.strictEqual(B.formatBytes([72, 255, 0], 10, ','), '72,255,0');
    for (const enc of ['utf8', 'utf16be', 'utf16le']) for (const t of ['Hello 你好 😀', '', 'a\nb\t', 'é', '𠀀']) {
        const bytes = B.textToBytes(t, enc);
        for (const base of [2, 8, 10, 16]) {
            const pb = B.parseBytes(B.formatBytes(bytes, base), base);
            assert.deepStrictEqual(pb.bytes || [], bytes, `${enc} ${base} ${t}`);
        }
        assert.strictEqual(B.bytesToText(bytes, enc).text, t);
    }
    assert.deepStrictEqual(B.parseBytes('48656c6c6f', 16).bytes, [72, 101, 108, 108, 111]);
    assert.deepStrictEqual(B.parseBytes('0x48 0x0B 0xff', 16).bytes, [72, 11, 255]);
    assert.deepStrictEqual(B.parseBytes('\\x48\\x69', 16).bytes, [72, 105]);
    assert.deepStrictEqual(B.parseBytes('0b01001000, 0b01101001', 2).bytes, [72, 105]);
    assert.deepStrictEqual(B.parseBytes('0100100001101001', 2).bytes, [72, 105]);
    assert.deepStrictEqual(B.parseBytes('72,105;33', 10).bytes, [72, 105, 33]);
    assert.ok(B.parseBytes('123', 16).error); assert.ok(B.parseBytes('1FF', 16).error === undefined ? false : true);
    assert.ok(B.parseBytes('256', 10).error); assert.ok(B.parseBytes('zz', 16).error); assert.ok(B.parseBytes('389', 8).error); assert.ok(B.parseBytes('1021', 2).error);
    assert.deepStrictEqual(B.parseBytes('', 16).bytes, []);
    assert.ok(B.bytesToText([0xFF, 0xFE], 'utf8').error); assert.ok(B.bytesToText([0xE4, 0xBD], 'utf8').error);
    assert.ok(B.bytesToText([0x4F], 'utf16be').error); assert.ok(B.bytesToText([0xD8, 0x3D], 'utf16be').error); assert.ok(B.bytesToText([0xDE, 0x00], 'utf16be').error);
    assert.strictEqual(B.bytesToText([], 'utf8').text, '');
    ok('base-converter: text <-> bytes');
}

// ---------- timestamp：批次轉換 ----------
{
    const T = load('utils/timestamp.html', 'parseTimeLine, batchRows, batchTsv');
    const TPE = 'Asia/Taipei', pl = (s, tz = TPE) => T.parseTimeLine(s, tz);
    assert.strictEqual(pl('1700000000').ms, 1700000000000); assert.strictEqual(pl('1700000000').kind, '秒時間戳');
    assert.strictEqual(pl('1700000000123').ms, 1700000000123); assert.strictEqual(pl('1700000000123').kind, '毫秒時間戳');
    assert.strictEqual(pl('1700000000.5').ms, 1700000000500); assert.strictEqual(pl('-86400').ms, -86400000);
    assert.strictEqual(pl('99999999999999999999').ok, false);
    // 日期：沒時區用顯示時區
    assert.strictEqual(pl('2023-11-15 06:13:20').ms, 1700000000000);
    assert.strictEqual(pl('2023-11-15 06:13:20', 'UTC').ms, 1700000000000 + 8 * 3600e3);
    assert.strictEqual(pl('2023-11-15T06:13:20').ms, 1700000000000);
    assert.strictEqual(pl('2023/11/15 06:13:20').ms, 1700000000000); assert.strictEqual(pl('2023.11.15 06:13').ms, 1700000000000 - 20000);
    assert.strictEqual(pl('2023-11-15').ms, Date.UTC(2023, 10, 14, 16)); assert.strictEqual(pl('2023-1-5').ms, Date.UTC(2023, 0, 4, 16));
    assert.strictEqual(pl('2023-11-14T22:13:20Z').ms, 1700000000000); assert.strictEqual(pl('2023-11-14T22:13:20z', TPE).ms, 1700000000000);
    assert.strictEqual(pl('2023-11-15T06:13:20+08:00', 'UTC').ms, 1700000000000); assert.strictEqual(pl('2023-11-15T06:13:20+0800').ms, 1700000000000);
    assert.strictEqual(pl('2023-11-14T17:13:20-05:00').ms, 1700000000000);
    assert.strictEqual(pl('2023-11-14T22:13:20.123Z').ms, 1700000000123); assert.strictEqual(pl('2023-11-14T22:13:20.5Z').ms, 1700000000500);
    assert.strictEqual(pl('2023-11-14 22:13:20 Z').ms, 1700000000000);
    for (const bad of ['', '   ', 'abc', '2023-02-30', '2023-13-01', '2023-11-15 24:00:00', '2023-11-15 10:60', '2023-11-15T10:00+25:00', '2023-11-15 06:13:20 PST', '12/25/2023', '1e9', '0x10']) assert.strictEqual(pl(bad).ok, false, bad);
    assert.strictEqual(pl('2024-02-29').ok, true); assert.strictEqual(pl('2023-02-29').ok, false);
    // 夏令時間時區
    assert.strictEqual(pl('2023-07-01 12:00:00', 'America/New_York').ms, Date.UTC(2023, 6, 1, 16));
    // 批次
    let b = T.batchRows('1700000000\n\n  2023-11-15 06:13:20  \nxyz\n1700000000000\tB欄\t', TPE);
    assert.strictEqual(b.rows.length, 4); assert.deepStrictEqual(b.rows.map(r => r.ok), [true, true, false, true]); assert.strictEqual(b.over, 0);
    assert.strictEqual(b.rows[0].local, '2023-11-15 06:13:20（UTC+08:00）'); assert.strictEqual(b.rows[0].utc, '2023-11-14 22:13:20'); assert.strictEqual(b.rows[0].iso, '2023-11-14T22:13:20.000Z');
    assert.strictEqual(b.rows[0].sec, '1700000000'); assert.strictEqual(b.rows[0].msText, '1700000000000'); assert.strictEqual(b.rows[1].sec, '1700000000');
    assert.strictEqual(b.rows[2].src, 'xyz'); assert.ok(b.rows[2].reason);
    const tsv = T.batchTsv(b.rows, TPE).split('\n');
    assert.strictEqual(tsv.length, 5); assert.strictEqual(tsv[0], '輸入\t判斷\t秒\t毫秒\tAsia/Taipei\tUTC\tISO 8601');
    assert.ok(tsv[3].startsWith('xyz\t無法辨識：')); assert.strictEqual(tsv[1].split('\t').length, 7);
    assert.strictEqual(T.batchRows('', TPE).rows.length, 0); assert.strictEqual(T.batchRows(null, TPE).rows.length, 0);
    const many = T.batchRows(Array.from({ length: 2005 }, (_, i) => String(1700000000 + i)).join('\n'), TPE); assert.strictEqual(many.rows.length, 2000); assert.strictEqual(many.over, 5);
    assert.strictEqual(T.batchRows('負\t號\n', TPE).rows[0].src, '負');
    // 含 Tab 的原文不會破壞 TSV
    assert.strictEqual(T.batchTsv([{ src: 'a\tb', ok: false, reason: 'x\ny' }], TPE).split('\n')[1], 'a b\t無法辨識：x y');
    ok('timestamp: batch convert');
}

// ---------- chmod-calc：umask 反推 / 常見值 ----------
{
    const M = load('utils/chmod-calc.html', 'umaskFor, fromUmask, UMASK_COMMON');
    const o = (x) => x.toString(8).padStart(3, '0');
    let r = M.umaskFor('755', 'dir'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['022', '644', '755']);
    r = M.umaskFor('775', 'dir'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['002', '664', '775']);
    r = M.umaskFor('700', 'dir'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['077', '600', '700']);
    r = M.umaskFor('644', 'file'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['022', '644', '755']);
    r = M.umaskFor('664', 'file'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['002', '664', '775']);
    r = M.umaskFor('600', 'file'); assert.deepStrictEqual([o(r.umask), o(r.file), o(r.dir)], ['066', '600', '711']);
    r = M.umaskFor('0644', 'file'); assert.strictEqual(o(r.umask), '022');
    assert.ok(M.umaskFor('755', 'file').error); assert.ok(M.umaskFor('abc', 'dir').error); assert.ok(M.umaskFor('', 'dir').error); assert.ok(M.umaskFor('889', 'dir').error);
    // 反推的 umask 再正推，必須得到想要的權限
    for (const want of ['755', '750', '700', '775', '711', '555']) assert.strictEqual(o(M.fromUmask(o(M.umaskFor(want, 'dir').umask)).dir), want);
    for (const want of ['644', '640', '600', '664', '444']) assert.strictEqual(o(M.fromUmask(o(M.umaskFor(want, 'file').umask)).file), want);
    // 常見值說明與計算相符
    for (const [k, txt] of M.UMASK_COMMON) { const u = M.fromUmask(k); assert.ok(txt.includes(o(u.file)) && txt.includes(o(u.dir)), k + ' ' + txt); }
    assert.deepStrictEqual(M.UMASK_COMMON.map(x => x[0]).slice(0, 3), ['022', '002', '077']);
    ok('chmod-calc: umask reverse / common values');
}

// ---------- screen-test：瀏覽器環境資訊 ----------
{
    const E = load('utils/screen-test.html', 'TABS, validTab, envInfo, envReport');
    assert.ok(E.TABS.includes('env')); assert.strictEqual(E.validTab('env'), 'env');
    for (const old of ['screen', 'kb', 'mouse', 'ppi', 'cam', 'mic']) assert.strictEqual(E.validTab(old), old);   // 舊版儲存值仍有效
    assert.strictEqual(E.validTab('nope'), 'screen'); assert.strictEqual(E.validTab(null), 'screen');
    const full = {
        nav: { userAgent: 'UA/1.0', platform: 'Win32', language: 'zh-TW', languages: ['zh-TW', 'en'], onLine: true, maxTouchPoints: 5, cookieEnabled: true, hardwareConcurrency: 8, deviceMemory: 8, connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false }, userAgentData: { brands: [{ brand: 'Edge', version: '120' }], platform: 'Windows', mobile: false }, clipboard: { writeText() { } }, mediaDevices: { getUserMedia() { } }, serviceWorker: {}, geolocation: {}, share() { }, vibrate() { }, gpu: {} },
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, orientation: { type: 'landscape-primary' } },
        win: { innerWidth: 390, innerHeight: 844, outerWidth: 400, outerHeight: 900, devicePixelRatio: 2, isSecureContext: true, AudioContext() { }, RTCPeerConnection() { }, WebAssembly: {}, Notification() { }, WebSocket() { }, indexedDB: {}, ResizeObserver() { }, visualViewport: { scale: 1 }, document: { fullscreenEnabled: true } },
        mq: (q) => ({ matches: /dark|coarse/.test(q) }), tz: 'Asia/Taipei', probe: { webgl: () => ({ version: 'WebGL 2', vendor: 'V', renderer: 'R' }), storage: () => true }
    };
    const rows = E.envInfo(full), get = (label) => (rows.find(r => r[1] === label) || [])[2];
    assert.strictEqual(get('User-Agent'), 'UA/1.0'); assert.strictEqual(get('螢幕解析度'), '1920 × 1080'); assert.strictEqual(get('視窗內容大小'), '390 × 844'); assert.strictEqual(get('像素比（devicePixelRatio）'), '2');
    assert.strictEqual(get('語言偏好清單'), 'zh-TW、en'); assert.strictEqual(get('時區'), 'Asia/Taipei'); assert.strictEqual(get('連線狀態'), '線上'); assert.strictEqual(get('觸控點數（maxTouchPoints）'), '5');
    assert.strictEqual(get('色彩深度'), '24 位元'); assert.strictEqual(get('深色模式'), '是'); assert.strictEqual(get('減少動態效果'), '否'); assert.strictEqual(get('記憶體估計（deviceMemory）'), '≥ 8 GB');
    assert.strictEqual(get('WebGL'), '支援（WebGL 2）'); assert.strictEqual(get('GPU（WebGL renderer）'), 'R（V）'); assert.strictEqual(get('Web Audio'), '支援'); assert.strictEqual(get('Clipboard 寫入'), '支援'); assert.strictEqual(get('WebRTC'), '支援');
    assert.strictEqual(get('品牌（UA-CH）'), 'Edge 120'); assert.strictEqual(get('下行頻寬估計'), '10 Mbps'); assert.strictEqual(get('方向'), 'landscape-primary'); assert.strictEqual(get('縮放比例（visualViewport）'), '1');
    assert.strictEqual(get('localStorage 可存取'), '支援'); assert.strictEqual(get('Fullscreen'), '支援');
    for (const r of rows) assert.ok(r.length === 3 && r.every(x => typeof x === 'string' && x !== 'undefined'), JSON.stringify(r));
    // 全部缺的最小環境：不丟例外、不出現 undefined / NaN
    for (const bare of [{}, { nav: {}, screen: {}, win: {}, mq: () => { throw new Error('x'); }, probe: { webgl: () => { throw new Error('x'); }, storage: () => { throw new Error('blocked'); } } }, { nav: { onLine: false, languages: null } }]) {
        const r2 = E.envInfo(bare); assert.ok(r2.length > 20);
        assert.ok(r2.every(r => !/undefined|NaN|null/.test(r.join('|'))), JSON.stringify(r2.filter(r => /undefined|NaN|null/.test(r.join('|')))));
    }
    const bare = E.envInfo({ nav: {}, win: {}, probe: { webgl: () => null, storage: () => { throw new Error('b'); } } }), g2 = (l) => bare.find(r => r[1] === l)[2];
    assert.strictEqual(g2('WebGL'), '不支援'); assert.strictEqual(g2('localStorage 可存取'), '不支援'); assert.strictEqual(g2('User-Agent'), '（未提供）'); assert.ok(!bare.some(r => r[1] === 'GPU（WebGL renderer）'));
    assert.strictEqual(E.envInfo({ nav: { onLine: false } }).find(r => r[1] === '連線狀態')[2], '離線');
    // 回報文字
    const txt = E.envReport(rows, '2026-10-22 10:00');
    assert.ok(txt.startsWith('瀏覽器環境資訊（2026-10-22 10:00）\n\n【瀏覽器】\nUser-Agent：UA/1.0')); assert.ok(txt.includes('【功能支援】') && txt.includes('WebGL：支援（WebGL 2）')); assert.ok(!txt.includes('undefined'));
    assert.strictEqual(E.envReport([['A', 'k', 'v']]), '瀏覽器環境資訊\n\n【A】\nk：v');
    // 靜態檢查：頁面不得送出任何網路請求
    const src = require('./_load').read('utils/screen-test.html');
    for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /new\s+WebSocket/, /new\s+RTCPeerConnection/, /new\s+Image\s*\(/, /EventSource/]) assert.ok(!bad.test(src), '不應出現 ' + bad);
    ok('screen-test: browser env info');
}

// ---------- excel-formula：快捷鍵 ----------
{
    const X = load('utils/excel-formula.html', 'KEYS, KEY_CATS, GS_DIFF, searchKeys');
    assert.ok(X.KEYS.length >= 40);
    const seen = new Set();
    for (const k of X.KEYS) {
        assert.ok(X.KEY_CATS[k.cat], k.desc); assert.ok(k.desc && k.win && typeof k.mac === 'string', k.desc);
        assert.ok(!seen.has(k.desc), '重複：' + k.desc); seen.add(k.desc);
        assert.ok(!/undefined|null/.test(JSON.stringify(k)));
    }
    for (const c of Object.keys(X.KEY_CATS)) assert.ok(X.KEYS.some(k => k.cat === c), '分類沒有項目：' + c);
    assert.ok(X.GS_DIFF.length >= 4);
    const names = (q, c) => X.searchKeys(q, c).map(k => k.desc);
    assert.strictEqual(X.searchKeys('').length, X.KEYS.length); assert.strictEqual(X.searchKeys(null).length, X.KEYS.length); assert.strictEqual(X.searchKeys('   ').length, X.KEYS.length);
    assert.ok(names('填滿').some(n => n.includes('向下填滿')) && names('填滿').some(n => n.includes('向右填滿')));
    assert.ok(names('ctrl+d').includes('向下填滿（複製上方儲存格 / 公式到選取範圍）')); assert.ok(names('CTRL+D').length === names('ctrl+d').length);
    assert.ok(names('只貼值').some(n => n.includes('選擇性貼上')));
    assert.ok(names('選取 整欄').length >= 1 && names('選取 整欄').every(n => /選取/.test(n)));
    assert.ok(names('cmd').length >= 10); assert.deepStrictEqual(names('command'), names('cmd')); assert.deepStrictEqual(names('⌘'), names('cmd'));
    assert.strictEqual(X.searchKeys('zzzzzz').length, 0);
    assert.ok(X.searchKeys('', 'select').every(k => k.cat === 'select') && X.searchKeys('', 'select').length > 3);
    assert.strictEqual(X.searchKeys('填滿', 'fmt').length, 0);
    assert.ok(names('f4').some(n => n.includes('絕對參照')));
    // 常用必備項目都要在
    for (const must of ['Ctrl+Space', 'Shift+Space', 'F4', 'Ctrl+Z', 'Ctrl+1', 'F2', 'Alt+Enter']) assert.ok(X.KEYS.some(k => k.win.includes(must)), must);
    // 頁面在 Excel 函式部分沒被改壞：頁面仍能載入原本的函式表
    const F = load('utils/excel-formula.html', 'XL, searchFns'); assert.ok(F.XL.length >= 79); assert.ok(F.searchFns('vlookup', '').length >= 1);
    ok('excel-formula: shortcuts');
}
