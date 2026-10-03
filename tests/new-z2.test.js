// z2 批次：utils/batch-rename.html（批次重新命名）、utils/id-validator.html（號碼驗證與測試資料）、utils/level-compass.html（水平儀 / 指南針）
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ================= batch-rename =================
{
    const B = load('utils/batch-rename.html', 'naturalCompare, parseNameList, splitExt, newRule, moveRule, applyRule, applyRules, checkName, planRename, psQuote, bashQuote, cmdQuote, genScript, validYmd');
    const R = (type, o) => ({ ...B.newRule(type), ...o });
    const run = (names, rules, today = '2025-01-31') => B.applyRules(names, rules, today).out;

    assert.deepStrictEqual(['a10', 'a2', 'A1', 'a1b'].sort(B.naturalCompare), ['A1', 'a1b', 'a2', 'a10']);
    assert.ok(B.naturalCompare('第2章', '第10章') < 0);
    assert.ok(B.naturalCompare('File 2.txt', 'file 10.txt') < 0);
    ok('batch-rename: 自然排序');

    assert.deepStrictEqual(B.parseNameList('a.txt\r\n\r\n  \n"C:\\x y.txt"\nb c.txt '), ['a.txt', 'C:\\x y.txt', 'b c.txt ']);
    assert.deepStrictEqual(B.splitExt('a.tar.gz'), { base: 'a.tar', ext: '.gz' });
    assert.deepStrictEqual(B.splitExt('.gitignore'), { base: '.gitignore', ext: '' });
    assert.deepStrictEqual(B.splitExt('x.'), { base: 'x.', ext: '' });
    assert.deepStrictEqual(B.splitExt('noext'), { base: 'noext', ext: '' });
    ok('batch-rename: 解析清單 / 拆副檔名');

    assert.deepStrictEqual(run(['a.txt'], [R('prefix', { text: 'x_' }), R('suffix', { text: '_y' })]), ['x_a_y.txt']);
    // 取代：純文字、含特殊字元不當正規表示式、忽略大小寫、$ 不被展開
    assert.deepStrictEqual(run(['a.b(1).txt', 'A.B(1).txt'], [R('replace', { find: '.b(1)', to: '$&' })]), ['a$&.txt', 'A.B(1).txt']);
    assert.deepStrictEqual(run(['A.B(1).txt'], [R('replace', { find: '.b(1)', to: '', icase: true })]), ['A.txt']);
    assert.deepStrictEqual(run(['IMG_2024_x.jpg'], [R('replace', { find: '^IMG_(\\d+)_', to: 'photo-$1-', regex: true })]), ['photo-2024-x.jpg']);
    assert.deepStrictEqual(run(['AbC.txt'], [R('replace', { find: 'abc', to: 'z', regex: true, icase: true })]), ['z.txt']);
    assert.deepStrictEqual(run(['a.txt'], [R('replace', { find: '', to: 'x' })]), ['a.txt']);
    const bad = B.applyRules(['a.txt'], [R('replace', { find: '(', to: '', regex: true })], '');
    assert.deepStrictEqual(bad.out, ['a.txt']); assert.equal(bad.errors.length, 1); assert.equal(bad.errors[0].index, 0);
    // 副檔名不被規則動到
    assert.deepStrictEqual(run(['a b.txt'], [R('remove', { chars: ' t' })]), ['ab.txt']);
    assert.deepStrictEqual(run(['My File.TXT'], [R('case', { mode: 'upper' })]), ['MY FILE.TXT']);
    assert.deepStrictEqual(run(['My File.TXT'], [R('case', { mode: 'lower' })]), ['my file.TXT']);
    assert.deepStrictEqual(run(['hello wORLD_x-y.md'], [R('case', { mode: 'title' })]), ['Hello World_X-Y.md']);
    assert.deepStrictEqual(run(['a.JPG', 'b.Png'], [R('ext', { mode: 'lower' })]), ['a.jpg', 'b.png']);
    assert.deepStrictEqual(run(['a.jpg', 'b'], [R('ext', { mode: 'upper' })]), ['a.JPG', 'b']);
    assert.deepStrictEqual(run(['a.jpg', 'b'], [R('ext', { mode: 'set', value: '..png' })]), ['a.png', 'b.png']);
    assert.deepStrictEqual(run(['a.jpg'], [R('ext', { mode: 'remove' })]), ['a']);
    assert.deepStrictEqual(run(['a.jpg'], [R('ext', { mode: 'set', value: '' })]), ['a']);
    ok('batch-rename: 加前後綴 / 取代 / 移除 / 大小寫 / 副檔名');

    // 編號：起始、位數、前後、步進、分隔
    assert.deepStrictEqual(run(['a.txt', 'b.txt', 'c.txt'], [R('number', { start: 5, digits: 3, step: 5, pos: 'after', sep: '_' })]), ['a_005.txt', 'b_010.txt', 'c_015.txt']);
    assert.deepStrictEqual(run(['a.txt', 'b.txt'], [R('number', { start: 1, digits: 2, pos: 'before', sep: '-' })]), ['01-a.txt', '02-b.txt']);
    assert.deepStrictEqual(run(['a.txt'], [R('number', { start: 1, digits: 0, sep: '' })]), ['a1.txt']);
    assert.deepStrictEqual(run(['a.txt'], [R('number', { start: 'abc', digits: 'x', step: -3 })]), ['a_1.txt']);
    assert.deepStrictEqual(run(['.txt'], [R('number', { start: 1, digits: 2, pos: 'after', sep: '_' })]), ['.txt_01']); // 開頭的點不算副檔名
    ok('batch-rename: 編號');
}
{
    const B = load('utils/batch-rename.html', 'newRule, moveRule, applyRules, checkName, planRename, psQuote, bashQuote, cmdQuote, genScript, validYmd');
    const R = (type, o) => ({ ...B.newRule(type), ...o });
    const run = (names, rules, today = '2025-01-31') => B.applyRules(names, rules, today).out;
    assert.deepStrictEqual(run(['a.txt'], [R('date', {})], '2025-01-31'), ['20250131_a.txt']);
    assert.deepStrictEqual(run(['a.txt'], [R('date', { date: '2024-02-29', fmt: 'YYYY-MM-DD', pos: 'after', sep: ' ' })]), ['a 2024-02-29.txt']);
    const e = B.applyRules(['a.txt'], [R('date', { date: '2023-02-29' })], '');
    assert.equal(e.errors.length, 1); assert.deepStrictEqual(e.out, ['a.txt']);
    assert.ok(B.validYmd('2024-02-29') && !B.validYmd('2023-02-29') && !B.validYmd('2023-13-01') && !B.validYmd('20230101'));
    // 規則順序有影響
    assert.deepStrictEqual(run(['a.txt'], [R('prefix', { text: 'X' }), R('case', { mode: 'lower' })]), ['xa.txt']);
    assert.deepStrictEqual(run(['a.txt'], [R('case', { mode: 'lower' }), R('prefix', { text: 'X' })]), ['Xa.txt']);
    const m = [1, 2, 3];
    assert.deepStrictEqual(B.moveRule(m, 0, 1), [2, 1, 3]); assert.deepStrictEqual(B.moveRule(m, 0, -1), [1, 2, 3]); assert.deepStrictEqual(B.moveRule(m, 2, 1), [1, 2, 3]); assert.deepStrictEqual(m, [1, 2, 3]);
    ok('batch-rename: 日期 / 規則順序 / 上下移');

    // 檢查名稱
    assert.deepStrictEqual(B.checkName('ok.txt'), []);
    assert.deepStrictEqual(B.checkName(''), ['empty']);
    assert.deepStrictEqual(B.checkName('  '), ['empty']);
    for (const ch of '\\/:*?"<>|') assert.ok(B.checkName(`a${ch}b`).includes('illegal'), ch);
    assert.ok(B.checkName('a\u0001b').includes('illegal'));
    assert.ok(B.checkName('a ').includes('trail')); assert.ok(B.checkName('a.').includes('trail')); assert.ok(B.checkName('..').includes('trail'));
    for (const r of ['CON', 'con.txt', 'Prn', 'AUX.tar.gz', 'NUL', 'COM1', 'com9.log', 'LPT1', 'lpt9.x']) assert.ok(B.checkName(r).includes('reserved'), r);
    for (const r of ['COM10', 'console.txt', 'LPT0', 'COM', 'aux1', 'xcon']) assert.ok(!B.checkName(r).includes('reserved'), r);
    assert.ok(!B.checkName('a'.repeat(255)).includes('long')); assert.ok(B.checkName('a'.repeat(256)).includes('long'));
    ok('batch-rename: 檔名合法性');

    // 衝突規劃
    let p = B.planRename(['a.txt', 'b.txt'], [R('replace', { find: /./.source, to: 'x', regex: true })]);
    assert.ok(p.blocked && p.rows.every(r => r.problems.includes('dup')), '兩個都改成 x.txt');
    p = B.planRename(['a.txt', 'A.txt'], [R('case', { mode: 'lower' })]);
    assert.ok(p.rows[1].problems.includes('dup'), '不分大小寫重複');
    p = B.planRename(['a.txt', 'b.txt'], [R('prefix', { text: 'x' })]);
    assert.equal(p.blocked, false); assert.equal(p.changed, 2); assert.equal(p.conflicts, 0);
    p = B.planRename(['a.txt', 'xa.txt'], [R('prefix', { text: 'x' })]); // a→xa 與既有 xa.txt（也要改成 xxa）：順序會覆蓋
    assert.ok(p.rows[0].problems.includes('chain') && p.blocked);
    p = B.planRename(['a.txt', 'xa.txt'], [R('replace', { find: 'a', to: 'xa' })]); // a→xxa? 'a.txt' → 'xa.txt'; 'xa.txt' → 'xxa.txt'
    assert.ok(p.rows[0].problems.includes('chain'));
    p = B.planRename(['a.txt', 'b.txt'], [R('prefix', { text: 'b' })].slice(0, 0)); // 無規則
    assert.equal(p.changed, 0); assert.equal(p.blocked, false);
    p = B.planRename(['a.txt', 'a.txt'], []); assert.ok(p.rows[0].problems.includes('dupOld'));
    p = B.planRename(['d/a.txt'], []); assert.ok(p.rows[0].problems.includes('path'));
    p = B.planRename(['a.txt'], [R('replace', { find: 'a', to: ':' })]); assert.ok(p.rows[0].problems.includes('illegal'));
    p = B.planRename(['a.txt'], [R('replace', { find: 'a', to: 'CON' })]); assert.ok(p.rows[0].problems.includes('reserved'));
    p = B.planRename(['a.txt'], [R('suffix', { text: ' ' }), R('ext', { mode: 'remove' })]); assert.ok(p.rows[0].problems.includes('trail'));
    p = B.planRename(['a.txt'], [R('remove', { chars: 'a' }), R('ext', { mode: 'remove' })]); assert.ok(p.rows[0].problems.includes('empty'));
    p = B.planRename(['a.txt'], [R('replace', { find: '(', regex: true })]); assert.ok(p.blocked && p.errors.length === 1);
    p = B.planRename(['a.txt'], [R('case', { mode: 'upper' }), R('ext', { mode: 'upper' })]); assert.equal(p.rows[0].new, 'A.TXT'); assert.equal(p.blocked, false);
    // 只改大小寫（a.txt → A.txt）不算與自己衝突
    p = B.planRename(['a.txt'], [R('case', { mode: 'upper' })]); assert.deepStrictEqual(p.rows[0].problems, []);
    // 自然排序 + 編號
    p = B.planRename(['f10.txt', 'f2.txt', 'f1.txt'], [R('number', { start: 1, digits: 2, pos: 'before', sep: '_' })], { sort: true });
    assert.deepStrictEqual(p.rows.map(r => r.new), ['01_f1.txt', '02_f2.txt', '03_f10.txt']);
    p = B.planRename(['f10.txt', 'f2.txt', 'f1.txt'], [R('number', { start: 1, digits: 2, pos: 'before', sep: '_' })]);
    assert.deepStrictEqual(p.rows.map(r => r.new), ['01_f10.txt', '02_f2.txt', '03_f1.txt']);
    ok('batch-rename: 衝突偵測 / 排序編號');

    // ---- 跳脫 ----
    assert.equal(B.psQuote("it's"), "'it''s'");
    assert.equal(B.psQuote('a\u2019b\u2018c'), "'a\u2019\u2019b\u2018\u2018c'");
    assert.equal(B.psQuote('$HOME `x` "q" $(rm) [1]'), "'$HOME `x` \"q\" $(rm) [1]'");
    assert.equal(B.psQuote('中文 檔名.txt'), "'中文 檔名.txt'");
    assert.equal(B.bashQuote("it's"), "'it'\\''s'");
    assert.equal(B.bashQuote("''"), "''\\'''\\'''");
    assert.equal(B.bashQuote('$HOME `id` "x" \\n !a *'), "'$HOME `id` \"x\" \\n !a *'");
    assert.equal(B.bashQuote('中文 空白.txt'), "'中文 空白.txt'");
    assert.equal(B.cmdQuote('50% off ^ & !.txt'), '"50%% off ^ & !.txt"');
    // 用真的 shell 規則反向驗證 bash 引號：解析單引號串應還原原字串
    const unbash = (q) => { let out = '', i = 0; while (i < q.length) { if (q[i] === "'") { const j = q.indexOf("'", i + 1); out += q.slice(i + 1, j); i = j + 1; } else if (q[i] === '\\') { out += q[i + 1]; i += 2; } else throw new Error('bad ' + q); } return out; };
    for (const s of ["a'b", "'", "''", "a b$c`d\"e\\f", '中文\'檔 名', '$(touch x)', "'; rm -rf / #"]) assert.equal(unbash(B.bashQuote(s)), s);
    // PowerShell：單引號串內只有 '' 轉義；反向解析
    const unps = (q) => q.slice(1, -1).replace(/(['\u2018\u2019\u201A\u201B])\1/g, '$1');
    for (const s of ["a'b", "'", '‘x’', "$x `y` \"z\" [a]", '中文 檔']) assert.equal(unps(B.psQuote(s)), s);
    assert.ok(!/[^'\u2018\u2019\u201A\u201B]['\u2018\u2019\u201A\u201B][^'\u2018\u2019\u201A\u201B]/.test(B.psQuote("a'b").slice(1, -1)), '內部單引號都成對');

    const rows = [{ old: "it's $a `b`.txt", new: '我的 檔案.txt', changed: true }, { old: 'same.txt', new: 'same.txt', changed: false }, { old: '50%.txt', new: 'x y.txt', changed: true }];
    assert.equal(B.genScript('ps', rows), "Rename-Item -LiteralPath 'it''s $a `b`.txt' -NewName '我的 檔案.txt'\nRename-Item -LiteralPath '50%.txt' -NewName 'x y.txt'");
    assert.equal(B.genScript('ps', rows, 'C:\\My Dir\\'), "Rename-Item -LiteralPath 'C:\\My Dir\\it''s $a `b`.txt' -NewName '我的 檔案.txt'\nRename-Item -LiteralPath 'C:\\My Dir\\50%.txt' -NewName 'x y.txt'");
    assert.equal(B.genScript('cmd', rows), '@echo off\r\nchcp 65001 >nul\r\nren "it\'s $a `b`.txt" "我的 檔案.txt"\r\nren "50%%.txt" "x y.txt"');
    assert.equal(B.genScript('bash', rows, '/home/me/my pics/'), "mv -n -- '/home/me/my pics/it'\\''s $a `b`.txt' '/home/me/my pics/我的 檔案.txt'\nmv -n -- '/home/me/my pics/50%.txt' '/home/me/my pics/x y.txt'");
    assert.equal(B.genScript('bash', rows).split('\n')[0], "mv -n -- 'it'\\''s $a `b`.txt' '我的 檔案.txt'");
    assert.equal(B.genScript('csv', rows), '舊名稱,新名稱\r\n"it\'s $a `b`.txt",我的 檔案.txt\r\n50%.txt,x y.txt'.replace('"it\'s $a `b`.txt"', "it's $a `b`.txt"));
    assert.equal(B.genScript('csv', [{ old: 'a,b.txt', new: 'c"d.txt', changed: true }]), '舊名稱,新名稱\r\n"a,b.txt","c""d.txt"');
    assert.equal(B.genScript('ps', []), '');
    ok('batch-rename: PowerShell / CMD / bash 跳脫與腳本');
}

// ================= id-validator =================
{
    const V = load('utils/id-validator.html', 'twIdCheck, twIdGen, ubnCheck, ubnGen, luhnCheck, cardNetwork, cardCheck, cardGen, twPhoneCheck, normalizePhone, TW_CITY');
    const lcg = (() => { let s = 7; return (n) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return Math.floor(s / 4294967296 * n); }; })();
    const secure = (n) => require('crypto').randomInt(n);

    // 身分證：已知樣本（手算：A=10 → 1 + 0*9；12345678 權重 8..1 = 120；檢查碼 9 → 1+120+9 = 130）
    let r = V.twIdCheck('A123456789');
    assert.ok(r.valid && r.kind === 'citizen' && r.gender === 'M' && r.city === '臺北市');
    assert.ok(V.twIdCheck(' a123456789 ').valid);
    r = V.twIdCheck('A123456788'); assert.ok(!r.valid && r.reason === 'checksum' && r.expected === 9);
    r = V.twIdCheck('A223456781'); assert.ok(r.valid && r.gender === 'F');
    r = V.twIdCheck('F131104093'); assert.ok(r.valid && r.city === '新北市');
    for (const bad of ['', 'A12345678', 'A1234567890', '1234567890', 'AA23456789', 'A323456789', 'A023456789', 'A12345678X', 'Ａ123456789', null, undefined, 123, 'A 123456789'])
        assert.equal(V.twIdCheck(bad).valid, false, String(bad));
    assert.equal(V.twIdCheck('A12345678X').reason, 'format');
    // 獨立實作（字母轉兩位數字、權重 1,9,8,7,6,5,4,3,2,1,1）交叉驗證
    const L = 'ABCDEFGHJKLMNPQRSTUVXYWZIO', code = (c) => 10 + L.indexOf(c);
    const ref = (id) => { const n = String(code(id[0])), ds = [n[0], n[1], ...[...id.slice(1)].map(c => /\d/.test(c) ? c : String(code(c) % 10))].map(Number); return ds.reduce((s, d, i) => s + d * [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1][i], 0) % 10 === 0; };
    assert.ok(ref('A123456789') && ref('F131104093') && !ref('A123456788'));
    for (const kind of ['citizen', 'resident-new', 'resident-old']) for (const gender of ['M', 'F', 'any']) for (let i = 0; i < 300; i++) {
        const id = V.twIdGen({ kind, gender, city: i % 3 ? '' : 'H' }, i % 2 ? lcg : secure), c = V.twIdCheck(id);
        assert.ok(c.valid && c.kind === kind, id); assert.ok(ref(id), id);
        if (gender !== 'any') assert.equal(c.gender, gender, id);
        if (i % 3 === 0) assert.equal(id[0], 'H');
    }
    assert.ok(/^[A-Z][AC]\d{8}$/.test(V.twIdGen({ kind: 'resident-old', gender: 'M' }, lcg)));
    assert.ok(/^[A-Z][BD]\d{8}$/.test(V.twIdGen({ kind: 'resident-old', gender: 'F' }, lcg)));
    assert.ok(/^[A-Z]8\d{8}$/.test(V.twIdGen({ kind: 'resident-new', gender: 'M' }, lcg)));
    assert.ok(/^[A-Z]9\d{8}$/.test(V.twIdGen({ kind: 'resident-new', gender: 'F' }, lcg)));
    // 居留證：第 2 碼字母取代碼個位數（A→0, B→1, C→2, D→3），手算 AA00000005？由 ref 交叉驗證即可
    for (const id of ['AA00000000', 'AB12345678', 'ZD99999999']) assert.equal(V.twIdCheck(id).valid, ref(id), id);
    ok('id-validator: 身分證 / 居留證');

    // 統編：04595257 手算：0*1,4*2=8,5*1=5,9*2=18→9,5*1=5,2*2=4,5*4=20→2,7*1=7 → 40
    r = V.ubnCheck('04595257'); assert.ok(r.valid && r.sum === 40 && r.oldOk && r.newOk && !r.special);
    assert.ok(!V.ubnCheck('04595258').valid); assert.equal(V.ubnCheck('04595258').reason, 'checksum');
    for (const bad of ['', '1234567', '123456789', 'abcdefgh', '0459525 7', null]) assert.equal(V.ubnCheck(bad).valid, false);
    assert.equal(V.ubnCheck('1234567').reason, 'format');
    // 第 7 碼為 7 的特例：0000007 + 檢查碼 9 → 總和 19，19 + 1 能被 10 整除
    r = V.ubnCheck('00000079'); assert.ok(r.special && r.sum === 19 && r.oldOk && r.newOk);
    assert.ok(!V.ubnCheck('00000068').newOk, '第 7 碼不是 7 就沒有特例');
    // 新規則：總和 % 5 == 0 但 % 10 != 0 → 僅新規則合法（00000005 總和 5）
    r = V.ubnCheck('00000005'); assert.ok(r.valid && r.newOk && !r.oldOk && r.sum === 5);
    assert.equal(V.ubnCheck('00000000').valid, true);
    const refUbn = (s, div) => { const w = [1, 2, 1, 2, 1, 2, 4, 1]; let t = 0; for (let i = 0; i < 8; i++) { const p = +s[i] * w[i]; t += (p / 10 | 0) + p % 10; } return t % div === 0 || (s[6] === '7' && (t + 1) % div === 0); };
    for (let i = 0; i < 3000; i++) { let s = ''; for (let k = 0; k < 8; k++) s += lcg(10); const c = V.ubnCheck(s); assert.equal(c.newOk, refUbn(s, 5), s); assert.equal(c.oldOk, refUbn(s, 10), s); }
    for (let i = 0; i < 500; i++) {
        const a = V.ubnGen({ mode: 'both' }, i % 2 ? lcg : secure), b = V.ubnGen({ mode: 'new' }, i % 2 ? lcg : secure);
        assert.ok(/^\d{8}$/.test(a) && V.ubnCheck(a).oldOk && V.ubnCheck(a).newOk, a);
        assert.ok(/^\d{8}$/.test(b) && V.ubnCheck(b).newOk && !V.ubnCheck(b).oldOk, b);
    }
    ok('id-validator: 統一編號（新舊規則 / 第 7 碼特例）');

    // Luhn / 信用卡
    assert.ok(V.luhnCheck('79927398713') && !V.luhnCheck('79927398710'));
    r = V.cardCheck('4111 1111 1111 1111'); assert.ok(r.valid && r.network.name === 'Visa');
    r = V.cardCheck('5555-5555-5555-4444'); assert.ok(r.valid && r.network.name === 'MasterCard');
    r = V.cardCheck('2223003122003222'); assert.ok(r.valid && r.network.name === 'MasterCard');
    r = V.cardCheck('3530111333300000'); assert.ok(r.valid && r.network.name === 'JCB');
    r = V.cardCheck('378282246310005'); assert.ok(r.valid && r.network.name === 'American Express');
    r = V.cardCheck('4111111111111112'); assert.ok(!r.valid && r.reason === 'luhn');
    r = V.cardCheck('6011111111111117'); assert.ok(r.valid && r.network === null); // 只做 Luhn，無法辨識的組織
    assert.ok(!V.cardCheck('37828224631000').valid); // 14 位數的 AE：長度或校驗碼不符
    for (const bad of ['', 'abcd', '4111-1111-1111-111a', '123', '12345678901234567890', null]) assert.equal(V.cardCheck(bad).valid, false, String(bad));
    assert.equal(V.cardCheck('4111x').reason, 'format'); assert.equal(V.cardCheck('123').reason, 'length');
    assert.equal(V.cardNetwork('2720').name, 'MasterCard'); assert.equal(V.cardNetwork('2221').name, 'MasterCard');
    assert.equal(V.cardNetwork('2220'), null); assert.equal(V.cardNetwork('2721'), null); assert.equal(V.cardNetwork('56'), null);
    assert.equal(V.cardNetwork('3527'), null); assert.equal(V.cardNetwork('3589').name, 'JCB'); assert.equal(V.cardNetwork('3590'), null);
    for (const net of ['visa', 'master', 'jcb', 'amex', 'custom']) for (let i = 0; i < 300; i++) {
        const d = V.cardGen({ network: net, prefix: net === 'custom' ? '9' + (i % 10) : '', length: i % 5 === 0 && net !== 'amex' ? 19 : 0 }, i % 2 ? lcg : secure);
        const c = V.cardCheck(d);
        assert.ok(/^\d{12,19}$/.test(d) && V.luhnCheck(d), d);
        if (net !== 'custom') assert.equal(c.network && c.network.key, net, d + net);
    }
    assert.equal(V.cardGen({ network: 'amex' }, lcg).length, 15); assert.equal(V.cardGen({ network: 'visa' }, lcg).length, 16);
    assert.ok(V.cardGen({ network: 'visa', prefix: '4539' }, lcg).startsWith('4539'));
    assert.ok(/^\d{12}$/.test(V.cardGen({ network: 'custom', prefix: '1', length: 12 }, lcg)));
    for (const bad of [{ prefix: 'ab' }, { prefix: '1234567890123' }, { length: 11 }, { length: 20 }, { prefix: '123456789012', length: 12 }]) assert.throws(() => V.cardGen({ network: 'custom', ...bad }, lcg), JSON.stringify(bad));
    ok('id-validator: 信用卡 / Luhn');

    // 電話
    r = V.twPhoneCheck('0912-345-678'); assert.ok(r.valid && r.kind === 'mobile' && r.formatted === '0912-345-678');
    assert.equal(V.twPhoneCheck('+886 912 345 678').formatted, '0912-345-678');
    assert.equal(V.twPhoneCheck('+886-(0)912345678').formatted, '0912-345-678');
    assert.ok(!V.twPhoneCheck('0912345').valid);
    r = V.twPhoneCheck('09123456789'); assert.ok(!r.valid && r.reason === 'length');
    r = V.twPhoneCheck('(02) 2345-6789'); assert.ok(r.valid && r.kind === 'landline' && r.formatted === '02-23456789' && r.area === '02');
    r = V.twPhoneCheck('02-2345-678'); assert.ok(!r.valid && r.reason === 'length');
    assert.ok(V.twPhoneCheck('04-2345-6789').valid && V.twPhoneCheck('042345678').valid && V.twPhoneCheck('037234567').valid);
    assert.equal(V.twPhoneCheck('037234567').area, '037'); assert.equal(V.twPhoneCheck('0492345678').area, '049');
    assert.ok(V.twPhoneCheck('082123456').valid && V.twPhoneCheck('083612345').valid && V.twPhoneCheck('089123456').valid);
    assert.equal(V.twPhoneCheck('0800-123-456').kind, 'tollfree'); assert.ok(!V.twPhoneCheck('0800-123-45').valid);
    assert.equal(V.twPhoneCheck('0123456789').reason, 'area');
    for (const bad of ['', 'abc', '12-3456', '09ab345678', null, '0912-345-67x']) assert.equal(V.twPhoneCheck(bad).valid, false, String(bad));
    assert.equal(V.normalizePhone('+886 2 2345 6789'), '0223456789'); assert.equal(V.normalizePhone('00886912345678'), '0912345678'); assert.equal(V.normalizePhone('886-0912-345-678'), '0912345678');
    ok('id-validator: 臺灣電話');
}
// ================= level-compass =================
{
    const C = load('utils/level-compass.html', 'normAngle, angDiff, lowPass, lowPassAngle, lowPassVec, upVector, gravityVector, levelAngles, totalFromXY, applyOffset, calibrate, isLevel, toScreen, bubblePos, compassHeading, headingName, slopeInfo');
    const nearD = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

    assert.equal(C.normAngle(-10), 350); assert.equal(C.normAngle(360), 0); assert.equal(C.normAngle(725), 5);
    assert.equal(C.angDiff(10, 350), 20); assert.equal(C.angDiff(350, 10), -20); assert.equal(C.angDiff(180, 0), 180); assert.equal(C.angDiff(0, 180), 180); assert.equal(C.angDiff(90, 90), 0);
    // 低通濾波
    assert.equal(C.lowPass(null, 5, .5), 5); assert.equal(C.lowPass(0, 10, .25), 2.5); assert.equal(C.lowPass(NaN, 4, .5), 4);
    nearD(C.lowPassAngle(350, 10, .5), 0); nearD(C.lowPassAngle(null, -90, .5), 270);
    let h = 350; for (let i = 0; i < 60; i++) h = C.lowPassAngle(h, 10, .25); nearD(h, 10, 1e-3);
    h = 10; for (let i = 0; i < 60; i++) h = C.lowPassAngle(h, 350, .25); nearD(h, 350, 1e-3); // 繞過 0 度而不是繞遠路
    let v = null; for (let i = 0; i < 80; i++) v = C.lowPassVec(v, { x: 1, y: 2, z: 3 }, .25); nearD(v.x, 1, 1e-6); nearD(v.z, 3, 1e-6);
    ok('level-compass: 角度與低通濾波');

    // 平放：u = (-cosβ sinγ, sinβ, cosβ cosγ)
    let u = C.upVector(0, 0); nearD(u.x, 0); nearD(u.y, 0); nearD(u.z, 1);
    let a = C.levelAngles(C.upVector(0, 0), 'flat'); nearD(a.x, 0); nearD(a.y, 0); nearD(a.total, 0);
    a = C.levelAngles(C.upVector(10, 0), 'flat'); nearD(a.x, 0); nearD(a.y, 10); nearD(a.total, 10);
    a = C.levelAngles(C.upVector(0, 10), 'flat'); nearD(a.x, 10); nearD(a.y, 0); nearD(a.total, 10);
    a = C.levelAngles(C.upVector(-7, -3), 'flat'); assert.ok(a.x < 0 && a.y < 0);
    for (let i = 0; i < 500; i++) { // 隨機：x 恆等於 gamma；total 與兩軸還原一致
        const b = (Math.random() - .5) * 160, g = (Math.random() - .5) * 160, r = C.levelAngles(C.upVector(b, g), 'flat');
        nearD(r.x, g, 1e-6); nearD(C.totalFromXY(r.x, r.y), r.total, 1e-6);
        nearD(r.total, Math.acos(Math.cos(b * Math.PI / 180) * Math.cos(g * Math.PI / 180)) * 180 / Math.PI, 1e-6);
    }
    assert.equal(C.totalFromXY(90, 0), 90); nearD(C.totalFromXY(30, 0), 30);
    // 立起：β=90 γ=0 為正立；順時針 10° → β=80, γ=90（萬向鎖附近的等價表示）
    a = C.levelAngles(C.upVector(90, 0), 'upright'); nearD(a.x, 0, 1e-6); nearD(a.y, 0, 1e-6);
    a = C.levelAngles(C.upVector(80, 90), 'upright'); nearD(a.x, 10, 1e-6); nearD(a.y, 0, 1e-6); nearD(a.total, 10, 1e-6);
    a = C.levelAngles(C.upVector(80, 0), 'upright'); nearD(a.x, 0, 1e-6); nearD(a.y, 10, 1e-6); // 後仰 10°
    a = C.levelAngles({ x: 1, y: 0, z: 0 }, 'upright'); nearD(a.x, 0, 1e-6); // 橫握（向左橫放）也算水平
    ok('level-compass: 水平儀角度');

    // 校正偏移
    let off = { flat: { x: 0, y: 0 }, upright: { x: 0, y: 0 } };
    off = C.calibrate(off, 'flat', { x: 1.5, y: -0.5, total: 2 });
    assert.deepStrictEqual(off, { flat: { x: 1.5, y: -0.5 }, upright: { x: 0, y: 0 } });
    assert.deepStrictEqual(C.applyOffset({ x: 1.5, y: -0.5 }, off.flat), { x: 0, y: 0 });
    assert.ok(C.isLevel(0.4, -0.5) && !C.isLevel(0.6, 0) && C.isLevel(1, 1, 1));
    ok('level-compass: 歸零校正');

    // 螢幕旋轉與氣泡
    const s90 = C.toScreen(1, 0, 90); nearD(s90.x, 0); nearD(s90.y, 1);
    const s180 = C.toScreen(1, 2, 180); nearD(s180.x, -1); nearD(s180.y, -2);
    const s0 = C.toScreen(1, 2, 0); nearD(s0.x, 1); nearD(s0.y, 2);
    let p = C.bubblePos('flat', 0, 0); nearD(p.x, 0); nearD(p.y, 0);
    p = C.bubblePos('flat', 5, 0, 15, 0); nearD(p.x, -1 / 3); nearD(p.y, 0); // 右側低 → 氣泡往左（高的一側）
    p = C.bubblePos('flat', 0, 5, 15, 0); nearD(p.x, 0); nearD(p.y, 1 / 3); // 上緣高 → 氣泡往上
    p = C.bubblePos('flat', 5, 0, 15, 90); nearD(p.x, 0); nearD(p.y, -1 / 3); // 螢幕轉 90°
    p = C.bubblePos('flat', 90, 90, 15, 0); nearD(Math.hypot(p.x, p.y), 1); // 超出範圍被限制在圓內
    p = C.bubblePos('upright', 5, 99, 15); nearD(p.x, -1 / 3); assert.equal(p.y, 0);
    p = C.bubblePos('upright', -90, 0, 15); assert.equal(p.x, 1);
    ok('level-compass: 氣泡與螢幕方向');

    // 方位角
    nearD(C.compassHeading(0, 0, 0), 0); nearD(C.compassHeading(90, 0, 0), 270); nearD(C.compassHeading(270, 0, 0), 90); nearD(C.compassHeading(180, 0, 0), 180);
    nearD(C.compassHeading(45, 10, 5), 315 + 0, 6); // 輕微傾斜仍約 315
    nearD(C.compassHeading(0, 90, 0), 0); nearD(C.compassHeading(90, 90, 0), 270); nearD(C.compassHeading(200, 90, 0), 160);
    for (const al of [0, 30, 100, 250, 359]) { const t = C.normAngle(-al); nearD(C.angDiff(C.compassHeading(al, 44, 0), t), 0, 1e-6); nearD(C.angDiff(C.compassHeading(al, 46, 0), t), 0, 1e-6); } // 平放 / 立起切換處連續
    ok('level-compass: 方位角');
    assert.deepStrictEqual(C.headingName(0), { zh: '北', en: 'N' }); assert.equal(C.headingName(44).en, 'NE'); assert.equal(C.headingName(22).en, 'N'); assert.equal(C.headingName(23).en, 'NE');
    assert.equal(C.headingName(90).zh, '東'); assert.equal(C.headingName(135).en, 'SE'); assert.equal(C.headingName(180).en, 'S'); assert.equal(C.headingName(225).zh, '西南');
    assert.equal(C.headingName(270).en, 'W'); assert.equal(C.headingName(337).en, 'NW'); assert.equal(C.headingName(338).en, 'N'); assert.equal(C.headingName(360).en, 'N'); assert.equal(C.headingName(-10).en, 'N');
    ok('level-compass: 方位文字');

    // 坡度與重力向量
    let s = C.slopeInfo(5); nearD(s.percent, 8.7488663525924, 1e-9); nearD(s.ratio, 11.430052302761, 1e-9);
    s = C.slopeInfo(45); nearD(s.percent, 100, 1e-9); nearD(s.ratio, 1, 1e-9);
    s = C.slopeInfo(0); assert.equal(s.percent, 0); assert.equal(s.ratio, Infinity);
    s = C.slopeInfo(90); assert.equal(s.percent, Infinity); assert.equal(s.ratio, 0);
    nearD(C.slopeInfo(-5).percent, C.slopeInfo(5).percent); assert.equal(C.slopeInfo(120).deg, 90);
    let g = C.gravityVector(0, 0, 9.8); nearD(g.z, 1); nearD(g.x, 0);
    g = C.gravityVector(0, 9.8 * Math.sin(Math.PI / 6), 9.8 * Math.cos(Math.PI / 6)); nearD(C.levelAngles(g, 'flat').total, 30, 1e-6);
    assert.equal(C.gravityVector(0, 0, 0.5), null); assert.equal(C.gravityVector(NaN, 0, 9), null); assert.equal(C.gravityVector(null, null, null), null);
    ok('level-compass: 坡度與重力向量');
}
