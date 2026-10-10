// 批次 d2：中文數字與金額大寫、Docker / .env 小幫手、年度綜合所得稅概算（純邏輯）
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- 中文數字 ----------
    const m = load('utils/cn-number.html', 'parseArabic, intToCn, numToCn, moneyCn, parseCn, convert, parseDate, dateForms, rocYear, withCommas, numStr, digitsCn');
    const A = (s) => m.parseArabic(s);
    const low = (s, omit = false) => m.numToCn(A(s), 'lower', omit), up = (s, omit = false) => m.numToCn(A(s), 'upper', omit);
    const cases = [['0', '零'], ['1', '一'], ['9', '九'], ['10', '一十'], ['11', '一十一'], ['20', '二十'], ['100', '一百'], ['101', '一百零一'], ['110', '一百一十'], ['1000', '一千'], ['1001', '一千零一'], ['1010', '一千零一十'], ['1100', '一千一百'],
        ['10000', '一萬'], ['10001', '一萬零一'], ['10100', '一萬零一百'], ['11000', '一萬一千'], ['100000', '一十萬'], ['100000000', '一億'], ['100010000', '一億零一萬'], ['100000001', '一億零一'],
        ['10001000', '一千萬一千'], ['10000001', '一千萬零一'], ['1000000000000', '一兆'], ['1000000000001', '一兆零一'], ['9999999999999999', '九千九百九十九兆九千九百九十九億九千九百九十九萬九千九百九十九'],
        ['123456789', '一億二千三百四十五萬六千七百八十九'], ['20050', '二萬零五十'], ['1000000', '一百萬'], ['1001000', '一百萬一千']];
    for (const [n, cn] of cases) assert.strictEqual(low(n), cn, n);
    assert.strictEqual(low('10', true), '十'); assert.strictEqual(low('15', true), '十五'); assert.strictEqual(low('115', true), '一百一十五'); assert.strictEqual(low('100000', true), '十萬');
    assert.strictEqual(up('12345'), '壹萬貳仟參佰肆拾伍'); assert.strictEqual(up('10', true), '拾'); assert.strictEqual(up('10'), '壹拾'); assert.strictEqual(up('3'), '參');
    assert.strictEqual(up('-5'), '負伍'); assert.strictEqual(low('-0'), '零'); assert.strictEqual(low('3.14'), '三點一四'); assert.strictEqual(low('0.05'), '零點零五'); assert.strictEqual(low('.5'), '零點五');
    assert.strictEqual(low('1,234'), '一千二百三十四'); assert.strictEqual(low('007'), '七');
    ok('cn-number: 整數 / 小數 / 負數 轉中文（零的規則、萬億兆）');

    // 往返：整數轉中文再轉回
    const rt = (s) => { const c = m.numToCn(A(s), 'lower'), r = m.parseCn(c); assert.ok(r.ok, s + ' ' + c); assert.strictEqual(m.numStr(r), m.numStr(A(s)), s + ' ' + c); const u = m.numToCn(A(s), 'upper'), r2 = m.parseCn(u); assert.ok(r2.ok, u); assert.strictEqual(m.numStr(r2), m.numStr(A(s)), u); };
    for (const [n] of cases) rt(n);
    for (let i = 0; i <= 3000; i++) rt(String(i));
    for (let i = 0; i < 3000; i++) { let s = String(1 + Math.floor(Math.random() * 9)); const len = Math.floor(Math.random() * 15); for (let k = 0; k < len; k++) s += Math.random() < 0.4 ? '0' : String(Math.floor(Math.random() * 10)); rt(s); }
    for (const n of ['-12.5', '3.14', '0.001', '-0.5', '100.0100']) rt(n);
    for (const t of ['十萬', '十', '十一', '一十一', '一百十', '兩千', '两千零五', '三万五千', '二〇二四', '〇', '零', '三點一四', '點五', '負三', '一億零一萬', '一萬零一', '二十', '3萬5千', '壹佰貳拾參']) assert.ok(m.parseCn(t).ok, t);
    assert.strictEqual(m.numStr(m.parseCn('十萬')), '100000'); assert.strictEqual(m.numStr(m.parseCn('兩千零五')), '2005'); assert.strictEqual(m.numStr(m.parseCn('3萬5千')), '35000');
    assert.strictEqual(m.numStr(m.parseCn('二〇二四')), '2024'); assert.strictEqual(m.numStr(m.parseCn('負三點一四')), '-3.14'); assert.strictEqual(m.numStr(m.parseCn('點五')), '0.5'); assert.strictEqual(m.numStr(m.parseCn('一百十')), '110');
    for (const t of ['一千一', '一萬一萬', '萬', '三點', '三點五十', '三點一點二', '一百萬百', '千', '一二三四五六七八九〇一二三四五六七', 'abc', '一兆一兆', '十億萬']) assert.ok(!m.parseCn(t).ok, '應拒絕：' + t);
    ok('cn-number: 中文 → 數字（往返一致、簡體 / 大寫 / 逐字 / 非法輸入）');

    // 金額
    const money = (s) => m.moneyCn(A(s)).text;
    assert.strictEqual(money('0'), '新臺幣零元整'); assert.strictEqual(money('10'), '新臺幣壹拾元整'); assert.strictEqual(money('100'), '新臺幣壹佰元整'); assert.strictEqual(money('10001'), '新臺幣壹萬零壹元整'); assert.strictEqual(money('100000000'), '新臺幣壹億元整');
    assert.strictEqual(money('12345.67'), '新臺幣壹萬貳仟參佰肆拾伍元陸角柒分'); assert.strictEqual(money('12.3'), '新臺幣壹拾貳元參角整'); assert.strictEqual(money('12.30'), '新臺幣壹拾貳元參角整'); assert.strictEqual(money('12.05'), '新臺幣壹拾貳元零伍分');
    assert.strictEqual(money('0.5'), '新臺幣伍角整'); assert.strictEqual(money('0.05'), '新臺幣伍分'); assert.strictEqual(money('1.01'), '新臺幣壹元零壹分'); assert.strictEqual(money('-100'), '負新臺幣壹佰元整'); assert.strictEqual(money('100.00'), '新臺幣壹佰元整');
    assert.strictEqual(m.moneyCn(A('1.234')).ok, false); assert.strictEqual(m.moneyCn(A('1.230')).ok, true);
    const trim = (p) => m.numStr(p).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    for (const s of ['0', '10', '12.34', '12.3', '12.05', '0.5', '0.05', '100000000', '10001', '999999999999', '1.01', '-7.2']) { const r = m.parseCn(money(s)); assert.ok(r.ok, s + ' ' + money(s)); assert.strictEqual(m.numStr(r), trim(A(s)), s + ' → ' + money(s)); }
    for (const [t, v] of [['壹萬元整', '10000'], ['新台幣參佰元伍角', '300.5'], ['伍分', '0.05'], ['壹元零伍分', '1.05'], ['NT$壹仟元整', '1000']]) assert.strictEqual(m.numStr(m.parseCn(t)), v, t);
    ok('cn-number: 金額大寫（角分、零、整、往返）');

    // 輸入驗證與上限
    assert.ok(!A('12345678901234567').ok); assert.ok(A('1234567890123456').ok); assert.ok(!A('1.' + '1'.repeat(21)).ok);
    for (const s of ['', ' ', '--1', '1.2.3', '1e5', '.', '-', '1 2x']) assert.ok(!m.convert(s).ok, s);
    assert.ok(m.convert('').empty); assert.strictEqual(m.convert('12').from, 'arabic'); assert.strictEqual(m.convert('十二').from, 'cn'); assert.ok(!m.convert('x'.repeat(300)).ok);
    assert.strictEqual(m.withCommas(A('-1234567.5')), '-1,234,567.5'); assert.strictEqual(m.convert('-0').p.neg, false);
    ok('cn-number: 輸入驗證與上限');

    // 日期
    const D = (s) => m.parseDate(s);
    for (const [s, y, mo, d] of [['2024-03-05', 2024, 3, 5], ['113/3/5', 2024, 3, 5], ['民國113年3月5日', 2024, 3, 5], ['民國一一三年三月五日', 2024, 3, 5], ['西元2024年3月5日', 2024, 3, 5], ['1/1/1', 1912, 1, 1], ['民前1年12月31日', 1911, 12, 31], ['民國一百一十三年十二月三十一日', 2024, 12, 31], ['2024.02.29', 2024, 2, 29], ['西元 800-1-1', 800, 1, 1]]) {
        const r = D(s); assert.ok(r.ok, s); assert.deepStrictEqual([r.y, r.m, r.d], [y, mo, d], s);
    }
    for (const s of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '2024-03', 'abc', '', '99999-1-1', '2024-3-5-1']) assert.ok(!D(s).ok, '應拒絕：' + s);
    assert.ok(D('2000-02-29').ok); assert.ok(!D('1900-02-29').ok); assert.ok(D('2100-02-28').ok && !D('2100-02-29').ok);
    const f = Object.fromEntries(m.dateForms(D('2024-03-05')));
    assert.strictEqual(f['民國'], '民國113年3月5日'); assert.strictEqual(f['民國（中文）'], '民國一百一十三年三月五日'); assert.strictEqual(f['民國（逐字）'], '民國一一三年三月五日'); assert.strictEqual(f['西元（逐字）'], '二〇二四年三月五日'); assert.strictEqual(f['支票大寫'], '民國壹佰壹拾參年零參月零伍日'); assert.strictEqual(f['西元'], '2024-03-05');
    const g = Object.fromEntries(m.dateForms(D('2024-12-20'))); assert.strictEqual(g['支票大寫'], '民國壹佰壹拾參年壹拾貳月零貳拾日'); assert.strictEqual(g['民國（中文）'], '民國一百一十三年十二月二十日');
    const h = Object.fromEntries(m.dateForms(D('2024-10-11'))); assert.strictEqual(h['支票大寫'], '民國壹佰壹拾參年零壹拾月壹拾壹日');
    assert.deepStrictEqual(m.rocYear(1912), { before: false, n: 1 }); assert.deepStrictEqual(m.rocYear(1911), { before: true, n: 1 }); assert.strictEqual(Object.fromEntries(m.dateForms(D('1911-12-31')))['民國'], '民國前1年12月31日');
    for (let y = 1912; y < 2100; y += 7) { const r = D(`民國${y - 1911}年2月3日`), ff = Object.fromEntries(m.dateForms(r)); assert.strictEqual(r.y, y); assert.strictEqual(D(ff['民國（逐字）']).y, y); assert.strictEqual(D(ff['支票大寫']).y, y); assert.strictEqual(D(ff['民國（中文）']).y, y); }
    ok('cn-number: 日期 / 民國年互轉與驗證');
}

{ // ---------- 綜所稅 ----------
    const m = load('utils/income-tax.html', 'TAX, sanitize, toNum, bracketTax, computeTax, DEFAULTS');
    const T = m.TAX, C = (o) => m.computeTax(o);
    // 級距邊界
    assert.deepStrictEqual(m.bracketTax(0), { tax: 0, rate: 0 });
    assert.deepStrictEqual(m.bracketTax(1), { tax: 0, rate: 0.05 });
    assert.deepStrictEqual(m.bracketTax(590000), { tax: 29500, rate: 0.05 });
    assert.deepStrictEqual(m.bracketTax(590001), { tax: 29500, rate: 0.12 });
    assert.strictEqual(m.bracketTax(1330000).tax, 29500 + 88800); assert.strictEqual(m.bracketTax(1330000).rate, 0.12);
    assert.strictEqual(m.bracketTax(1330001).rate, 0.2);
    assert.strictEqual(m.bracketTax(2660000).tax, 29500 + 88800 + 266000); assert.strictEqual(m.bracketTax(2660001).rate, 0.3);
    assert.strictEqual(m.bracketTax(4980000).tax, 29500 + 88800 + 266000 + 696000); assert.strictEqual(m.bracketTax(4980001).rate, 0.4);
    assert.strictEqual(m.bracketTax(10000000).tax, 29500 + 88800 + 266000 + 696000 + 0.4 * 5020000);
    // 與「淨所得 × 稅率 − 累進差額」公式一致
    const diff = [[590000, 0.05, 0], [1330000, 0.12, 41300], [2660000, 0.2, 147700], [4980000, 0.3, 413700], [1e9, 0.4, 911700]];
    for (const n of [1, 1000, 589999, 590000, 600000, 1330000, 1500000, 2660000, 3000000, 4980000, 6000000, 123456789]) { const [, r, d] = diff.find(([lim]) => n <= lim); assert.ok(Math.abs(m.bracketTax(n).tax - Math.round(n * r - d)) <= 1, n); }
    // 單調不減
    let last = 0; for (let n = 0; n <= 6e6; n += 12345) { const t = m.bracketTax(n).tax; assert.ok(t >= last); last = t; }
    ok('income-tax: 累進級距邊界');

    // 零所得
    const z = C({}); assert.strictEqual(z.tax, 0); assert.strictEqual(z.net, 0); assert.strictEqual(z.effective, 0); assert.strictEqual(z.income, 0);
    // 範例：單身薪資 900,000
    const a = C({ salary: 900000 });
    assert.strictEqual(a.exemptions, 97000); assert.strictEqual(a.general, 131000); assert.strictEqual(a.salaryDed, 218000); assert.strictEqual(a.basicGap, 0); assert.strictEqual(a.net, 454000); assert.strictEqual(a.tax, 22700); assert.strictEqual(a.marginal, 0.05);
    assert.ok(Math.abs(a.effective - 22700 / 900000) < 1e-12);
    // 薪資特別扣除不超過薪資
    assert.strictEqual(C({ salary: 100000 }).salaryDed, 100000); assert.strictEqual(C({ salary: 100000 }).net, 0);
    assert.strictEqual(C({ salary: 500000 }).salaryDed, 218000);
    // 有配偶：標準扣除加倍、配偶薪資各自扣除、免稅額
    const b = C({ salary: 1000000, married: true, spouseSalary: 100000 });
    assert.strictEqual(b.general, 262000); assert.strictEqual(b.exemptions, 194000); assert.strictEqual(b.salaryDed, 218000 + 100000); assert.strictEqual(b.net, 1100000 - 194000 - 262000 - 318000);
    // 配偶資料在未勾選有配偶時被忽略
    assert.deepStrictEqual(C({ salary: 1000000, married: false, spouseSalary: 999999, spouse70: true }), C({ salary: 1000000 }));
    // 70 歲加成與扶養
    const c = C({ salary: 2000000, self70: true, married: true, spouse70: true, dep: 2, dep70: 1 });
    assert.strictEqual(c.exemptions, 145500 * 2 + 97000 * 2 + 145500); assert.strictEqual(c.persons, 5);
    // 列舉扣除
    const d = C({ salary: 1000000, dedMode: 'item', item: 300000 }); assert.strictEqual(d.general, 300000); assert.strictEqual(d.itemAmount, 300000); assert.strictEqual(d.stdAmount, 131000);
    assert.strictEqual(C({ salary: 1000000, dedMode: 'std', item: 300000 }).general, 131000);
    // 儲蓄投資特別扣除上限
    assert.strictEqual(C({ salary: 1000000, interest: 100000 }).savingsDed, 100000); assert.strictEqual(C({ salary: 1000000, interest: 500000 }).savingsDed, 270000);
    // 身心障礙、學費
    assert.strictEqual(C({ salary: 3000000, disabled: 2 }).disabilityDed, 436000);
    assert.strictEqual(C({ salary: 3000000, tuitionN: 2, tuitionFee: 100000 }).tuitionDed, 50000); assert.strictEqual(C({ salary: 3000000, tuitionN: 2, tuitionFee: 10000 }).tuitionDed, 20000);
    // 基本生活費差額：多人、低扣除 → 有差額；差額使淨所得再降低
    const e = C({ salary: 300000, dep: 4, dedMode: 'item', item: 0 });
    assert.strictEqual(e.persons, 5); assert.strictEqual(e.basicTotal, 213000 * 5); assert.strictEqual(e.basicGap, Math.max(0, 213000 * 5 - (e.exemptions + e.general + e.special)));
    assert.ok(e.basicGap > 0); assert.strictEqual(e.net, Math.max(0, e.income - e.exemptions - e.general - e.special - e.basicGap));
    assert.strictEqual(C({ salary: 100000000 }).basicGap, 0);
    // 極大值：有上限、不會 NaN / Infinity
    const big = C({ salary: 1e30, other: 1e30 }); assert.ok(Number.isFinite(big.tax) && big.income === 2e10); assert.strictEqual(big.marginal, 0.4);
    // 有效稅率隨所得上升
    let eff = -1; for (const s of [300000, 600000, 1000000, 2000000, 5000000, 20000000]) { const x = C({ salary: s }).effective; assert.ok(x >= eff); eff = x; }
    ok('income-tax: 各項扣除、基本生活費差額、配偶、70 歲、列舉、極大值');

    // 驗證容錯
    for (const bad of [null, undefined, 5, 'x', [], [1], { salary: 'abc', dep: -3, tuitionN: NaN, dedMode: 'weird', married: 'yes', item: null, interest: Infinity }]) { const s = m.sanitize(bad); assert.deepStrictEqual(Object.keys(s).sort(), Object.keys(m.DEFAULTS).sort()); assert.strictEqual(typeof C(bad).tax, 'number'); assert.ok(Number.isFinite(C(bad).tax)); }
    assert.strictEqual(m.sanitize({ dep: 999 }).dep, 30); assert.strictEqual(m.sanitize({ salary: 5e12 }).salary, 1e10); assert.strictEqual(m.sanitize({ salary: '123456' }).salary, 123456); assert.strictEqual(m.sanitize({ dep: 2.9 }).dep, 2);
    assert.strictEqual(m.sanitize({ dedMode: 'item' }).dedMode, 'item'); assert.strictEqual(m.sanitize({ married: true }).married, true); assert.strictEqual(m.sanitize({ spouseSalary: 5 }).spouseSalary, 0);
    assert.strictEqual(m.toNum('1,234,567'), 1234567); assert.strictEqual(m.toNum('-5'), 0); assert.strictEqual(m.toNum('abc'), 0); assert.strictEqual(m.toNum(''), 0);
    // 稅制表自洽
    assert.strictEqual(T.exemption70, T.exemption * 1.5); assert.strictEqual(T.stdMarried, T.std * 2); assert.strictEqual(T.brackets.length, 5); assert.strictEqual(T.brackets[4][0], Infinity);
    for (let k = 1; k < 5; k++) { assert.ok(T.brackets[k][0] > T.brackets[k - 1][0]); assert.ok(T.brackets[k][1] > T.brackets[k - 1][1]); }
    ok('income-tax: 驗證容錯與稅制表自洽');
}

{ // ---------- Docker / .env ----------
    const m = load('utils/docker-helper.html', 'shq, tokenize, parseRun, buildRun, buildCompose, validateOpts, optsFromForm, parseEnv, envVal, tidyEnv, envToCompose, limitEnv, ydq, yval, ykey, dollar, svcName');
    const T = (s) => m.tokenize(s).tokens;
    // 切字
    assert.deepStrictEqual(T('a b  c'), ['a', 'b', 'c']);
    assert.deepStrictEqual(T(`a "b c" 'd e' f\\ g`), ['a', 'b c', 'd e', 'f g']);
    assert.deepStrictEqual(T('a \\\n  b \\\r\n  c'), ['a', 'b', 'c']);
    assert.deepStrictEqual(T('-e "A=\\"x\\" $HOME"'), ['-e', 'A="x" $HOME']);
    assert.deepStrictEqual(T(`-e 'it'\\''s'`), ['-e', "it's"]);
    assert.deepStrictEqual(T('""'), ['']); assert.deepStrictEqual(T("a '' b"), ['a', '', 'b']); assert.deepStrictEqual(T('a"b"c'), ['abc']);
    assert.deepStrictEqual(T('"a\\nb"'), ['a\\nb']);
    assert.strictEqual(m.tokenize('a "b').ok, false); assert.strictEqual(m.tokenize("a 'b").ok, false); assert.deepStrictEqual(T(''), []);
    for (const s of ['', 'abc', 'a b', "it's", 'a"b', '$HOME', 'a\\b', '中文 字', '=x', 'a;b', '*', '~/x', 'a\nb']) assert.deepStrictEqual(T(m.shq(s)), [s], JSON.stringify(s));
    ok('docker: 切字（引號、續行、跳脫）與 shq 往返');

    // 解析
    const P = (s) => m.parseRun(s);
    let r = P('docker run -d --name web -p 8080:80 -p 443:443 -e TZ=Asia/Taipei -e "A=b c" -v ./data:/data --restart unless-stopped --network=host --rm -it -m 512m --cpus 1.5 -w /app -u 1000:1000 nginx:1.27 nginx -g "daemon off;"');
    assert.ok(r.ok); let o = r.opts;
    assert.deepStrictEqual([o.image, o.name, o.ports, o.env, o.volumes, o.restart, o.network, o.rm, o.detach, o.it, o.memory, o.cpus, o.workdir, o.user, o.extra, o.cmd],
        ['nginx:1.27', 'web', ['8080:80', '443:443'], ['TZ=Asia/Taipei', 'A=b c'], ['./data:/data'], 'unless-stopped', 'host', true, true, true, '512m', '1.5', '/app', '1000:1000', [], ['nginx', '-g', 'daemon off;']]);
    r = P('docker run \\\n  -d \\\n  --name=app \\\n  -p8080:80 \\\n  -eFOO=bar \\\n  -v /a:/b:ro \\\n  --cap-add NET_ADMIN --init --label "k=v w" -h box \\\n  img');
    o = r.opts; assert.deepStrictEqual([o.image, o.name, o.ports, o.env, o.volumes, o.detach], ['img', 'app', ['8080:80'], ['FOO=bar'], ['/a:/b:ro'], true]);
    assert.deepStrictEqual(o.extra, ['--cap-add', 'NET_ADMIN', '--init', '--label', 'k=v w', '-h', 'box']); assert.deepStrictEqual(r.unknown, ['--cap-add', '--init', '--label', '-h']);
    o = P('docker run -dit img').opts; assert.ok(o.detach && o.it); o = P('docker run -i img').opts; assert.deepStrictEqual(o.extra, ['-i']); assert.ok(!o.it);
    o = P('sudo docker container run --rm alpine sh -c "echo hi"').opts; assert.deepStrictEqual([o.image, o.rm, o.cmd], ['alpine', true, ['sh', '-c', 'echo hi']]);
    o = P('nginx').opts; assert.strictEqual(o.image, 'nginx'); o = P('docker run -- img -x').opts; assert.deepStrictEqual([o.image, o.cmd], ['img', ['-x']]);
    o = P('docker run img --not-a-flag -p 1:1').opts; assert.deepStrictEqual([o.image, o.cmd, o.ports], ['img', ['--not-a-flag', '-p', '1:1'], []]);
    assert.strictEqual(P('docker run -p').opts.image, ''); assert.ok(P('docker run').notes.length); assert.ok(!P('docker run "x').ok);
    assert.ok(P('docker run --name a --name b img').notes.some(x => x.includes('重複')));
    assert.deepStrictEqual(P('docker run --weird=1 --unk img').unknown, ['--weird=1', '--unk']);
    ok('docker: 解析 docker run（簡寫、續行、未知旗標保留、指令參數）');

    // 產生與往返
    const base = { image: 'nginx', name: '', ports: [], env: [], volumes: [], restart: '', network: '', rm: false, detach: false, it: false, memory: '', cpus: '', workdir: '', user: '', extra: [], cmd: [] };
    const rnd = [
        { ...base },
        { ...base, image: 'nginx:1.27', name: 'web', ports: ['8080:80', '127.0.0.1:53:53/udp'], env: ['TZ=Asia/Taipei', 'GREETING=hello world', 'Q=it\'s "x"', 'EMPTY=', 'PASS', 'D=$HOME'], volumes: ['./data:/data', '/var/run/docker.sock:/var/run/docker.sock:ro', 'my vol:/x'], restart: 'on-failure:3', network: 'mynet', rm: true, detach: true, it: true, memory: '1g', cpus: '0.5', workdir: '/app dir', user: 'node', extra: ['--cap-add', 'NET_ADMIN', '--label', 'a b=c'], cmd: ['sh', '-c', 'echo "hi there" && sleep 1'] },
        { ...base, image: 'ghcr.io/a/b@sha256:abc', cmd: ['--flag', 'x y'], extra: ['--init'] },
        { ...base, image: 'img', env: ['中文=值 空白'], name: 'n-1_a.b' },
    ];
    for (const o of rnd) for (const one of [false, true]) { const back = m.parseRun(m.buildRun(o, one)); assert.ok(back.ok); assert.deepStrictEqual(back.opts, o, m.buildRun(o, one)); }
    assert.strictEqual(m.buildRun({ ...base, image: 'nginx' }), 'docker run \\\n  nginx'); assert.strictEqual(m.buildRun({ ...base, image: 'nginx', detach: true, ports: ['80:80'] }, true), 'docker run -d -p 80:80 nginx');
    assert.ok(m.buildRun({ ...base, image: '' }).includes('<映像>'));
    // 表單 → opts
    const fo = m.optsFromForm({ image: ' nginx ', name: '', ports: '8080:80\n\n  9090:90  \r\n', env: 'A=1', volumes: '', restart: 'always', network: '', rm: 1, detach: 0, it: false, memory: '', cpus: '', workdir: '', user: '', extra: '--cap-add "A B"', cmd: 'sh -c "x y"' });
    assert.deepStrictEqual([fo.opts.image, fo.opts.ports, fo.opts.extra, fo.opts.cmd, fo.opts.rm, fo.opts.detach, fo.warnings], ['nginx', ['8080:80', '9090:90'], ['--cap-add', 'A B'], ['sh', '-c', 'x y'], true, false, []]);
    assert.ok(m.optsFromForm({ image: 'a', extra: '"x', cmd: '' }).warnings.length === 1);
    // 隨機往返
    const words = ['a', 'b c', "it's", 'x"y', '$V', 'k=v', '中', 'a\\b', '1:1', ' lead', ''];
    for (let n = 0; n < 300; n++) {
        const pick = () => words[Math.floor(Math.random() * words.length)], arr = (f) => Array.from({ length: Math.floor(Math.random() * 3) }, f);
        const o = { ...base, image: 'img' + n, name: Math.random() < .5 ? 'c' + n : '', ports: arr(() => '8' + n + ':80'), env: arr(() => 'K' + n + '=' + pick()), volumes: arr(() => pick() + ':/x'), detach: Math.random() < .5, rm: Math.random() < .5, it: Math.random() < .5, extra: Math.random() < .5 ? ['--label', pick()] : [], cmd: arr(pick) };
        assert.deepStrictEqual(m.parseRun(m.buildRun(o, Math.random() < .5)).opts, o, JSON.stringify(o));
    }
    ok('docker: docker run 產生 / 解析往返（含隨機）');

    // compose
    const c = m.buildCompose(rnd[1]);
    assert.ok(c.yaml.startsWith('services:\n  web:\n    image: "nginx:1.27"\n    container_name: "web"\n'), c.yaml); assert.ok(c.yaml.includes('    command: ["sh", "-c", "echo \\"hi there\\" && sleep 1"]'));
    assert.ok(c.yaml.includes('    ports:\n      - "8080:80"\n      - "127.0.0.1:53:53/udp"')); assert.ok(c.yaml.includes('      TZ: Asia/Taipei'));
    assert.ok(c.yaml.includes('      GREETING: "hello world"')); assert.ok(c.yaml.includes('      EMPTY: ""')); assert.ok(c.yaml.includes('\n      PASS:\n')); assert.ok(c.yaml.includes('      D: "$$HOME"')); assert.ok(c.yaml.includes('      Q: "it\'s \\"x\\""'));
    assert.ok(c.yaml.includes('    restart: "on-failure:3"')); assert.ok(c.yaml.includes('    networks:\n      - mynet')); assert.ok(c.yaml.endsWith('\nnetworks:\n  mynet:\n    external: true'));
    assert.ok(c.yaml.includes('    mem_limit: "1g"') && c.yaml.includes('    cpus: 0.5') && c.yaml.includes('    stdin_open: true\n    tty: true') && c.yaml.includes('    working_dir: "/app dir"'));
    assert.ok(c.yaml.includes('# 未轉換的旗標：--cap-add NET_ADMIN --label')); assert.ok(c.warnings.some(w => w.includes('--rm'))); assert.ok(c.warnings.some(w => w.includes('無法自動轉成')));
    const h = m.buildCompose({ ...base, image: 'nginx', network: 'host', restart: 'no' }); assert.ok(h.yaml.includes('network_mode: "host"') && h.yaml.includes('restart: "no"') && !h.yaml.includes('\nnetworks:'));
    assert.ok(m.buildCompose({ ...base, image: '' }).warnings.includes('尚未填寫映像'));
    assert.ok(m.buildCompose({ ...base, image: 'a', env: ['A=1', 'A=2'] }).yaml.includes('      A: "2"')); assert.ok(m.buildCompose({ ...base, image: 'a', env: ['A=1', 'A=2'] }).warnings.some(x => x.includes('重複')));
    assert.strictEqual(m.svcName({ ...base, image: 'ghcr.io/a/My_App:1.0' }), 'my_app'); assert.strictEqual(m.svcName({ ...base, image: 'nginx@sha256:ab' }), 'nginx'); assert.strictEqual(m.svcName({ ...base, name: 'Web Server!' }), 'web-server'); assert.strictEqual(m.svcName({ ...base, image: '' }), 'app');
    // YAML 字串
    for (const [s, e] of [['abc', 'abc'], ['no', '"no"'], ['yes', '"yes"'], ['true', '"true"'], ['null', '"null"'], ['1.10', '"1.10"'], ['22:22', '"22:22"'], ['', '""'], ['a b', '"a b"'], ['a#b', '"a#b"'], ['- x', '"- x"'], ['x: y', '"x: y"'], ['{a}', '"{a}"'], ['~', '"~"'], ['\n', '"\\n"'], ['中文', '"中文"'], ['a/b-c.d', 'a/b-c.d'], ['@x', '"@x"'], ['*a', '"*a"'], ['%x', '"%x"'], ['!x', '"!x"'], ['"q"', '"\\"q\\""']]) assert.strictEqual(m.yval(s), e, s);
    assert.strictEqual(m.ykey('y'), '"y"'); assert.strictEqual(m.ykey('A.b-c'), 'A.b-c'); assert.strictEqual(m.ykey('a b'), '"a b"'); assert.strictEqual(m.dollar('$a$$b'), '$$a$$$$b');
    for (const s of ['a"b', 'a\\b', 'tab\there', 'uni\u2028x', '😀', 'a\u0001b']) assert.strictEqual(JSON.parse(m.ydq(s)), s);
    // 驗證提醒
    const v = m.validateOpts({ ...base, image: '', ports: ['abc', '8080:80', '80', '1-2:3-4/tcp', '[::1]:80:80'], env: ['1A=x', 'OK=1'], memory: 'lots', cpus: 'x', restart: 'sometimes' });
    assert.ok(v.includes('尚未填寫映像') && v.some(x => x.includes('abc')) && !v.some(x => x.includes('：8080:80（')) && v.some(x => x.includes('1A=x')) && v.some(x => x.includes('lots')) && v.some(x => x.includes('CPU')) && v.some(x => x.includes('重啟')));
    assert.deepStrictEqual(m.validateOpts({ ...base, image: 'a', ports: ['80', '1-2:3-4/tcp', '[::1]:80:80'] }), []);
    ok('docker: compose 輸出、YAML 引號、驗證提醒');

    // ---- .env ----
    const E = (s) => m.parseEnv(s); const codes = (r) => r.issues.map(i => `${i.line}:${i.code}`);
    let e = E('# c\nA=1\nB="x y"\nC=\nA=2\n\nexport D=4 # tail\nE = 5\nBAD LINE\n=novalue\n1X=1\nF=hello world\nG="open\nH=\'sq\'');
    assert.deepStrictEqual(e.entries.map(x => [x.key, x.value]), [['A', '1'], ['B', 'x y'], ['C', ''], ['A', '2'], ['D', '4'], ['E', '5'], ['F', 'hello world'], ['G', 'open'], ['H', 'sq']]);
    const cs = codes(e);
    for (const x of ['4:empty', '5:dup', '8:eq-space', '9:format', '10:format', '11:key-invalid', '12:space', '13:quote']) assert.ok(cs.includes(x), x + ' in ' + cs);
    assert.ok(e.issues.find(i => i.code === 'dup').msg.includes('2、5')); assert.strictEqual(e.entries[4].comment, '# tail'); assert.strictEqual(e.entries[1].quote, '"');
    assert.deepStrictEqual(codes(E('A=1\nB=2')), []); assert.deepStrictEqual(E('').entries, []); assert.deepStrictEqual(E('\uFEFFA=1').entries[0].key, 'A'); assert.strictEqual(E('A=1\r\nB=2\r\n').entries.length, 2);
    assert.ok(codes(E('A-B=1')).includes('1:key-style')); assert.ok(codes(E('A="x" y')).includes('1:trailing')); assert.ok(!codes(E('A="x" # ok')).includes('1:trailing')); assert.strictEqual(E('A=b#c').entries[0].value, 'b#c'); assert.strictEqual(E('A=b #c').entries[0].value, 'b');
    assert.strictEqual(E('A="a\\"b\\\\c\\nd"').entries[0].value, 'a"b\\c\nd'); assert.strictEqual(E("A='a\\nb'").entries[0].value, 'a\\nb'); assert.strictEqual(E('A=#x').entries[0].value, '');
    // 疑似密鑰
    for (const [t, want] of [['DB_PASSWORD=s3cret', true], ['API_KEY=abcd', true], ['TOKEN=abc', true], ['AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE', true], ['X=ghp_' + 'a'.repeat(30), true], ['X=sk-' + 'a'.repeat(30), true], ['PASSWORD=changeme', false], ['PASSWORD=', false], ['PASSWORD=${OTHER}', false], ['NAME=bob', false], ['AUTHOR=bob', true], ['PORT=80', false]]) assert.strictEqual(codes(E(t)).some(x => x.endsWith('secret')), want, t);
    assert.strictEqual(E('A=1').issues.length, 0); assert.strictEqual(E('# only comment').entries.length, 0);
    // 整理與輸出
    const ent = E('B=2\nA=1\nB=3\nC=hello world\nD=\nE=it\'s\nF=$HOME\nG=a#b').entries;
    assert.strictEqual(m.tidyEnv(ent), 'A=1\nB=3\nC=\'hello world\'\nD=\nE="it\'s"\nF=\'$HOME\'\nG=\'a#b\'');
    assert.deepStrictEqual(m.tidyEnv(ent, true).split('\n').map(x => x[0]), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    assert.strictEqual(m.tidyEnv(E('B=2\nA=1\nB=3').entries), 'A=1\nB=3');
    assert.strictEqual(m.tidyEnv([]), ''); assert.strictEqual(m.envToCompose([]), '');
    assert.strictEqual(m.envToCompose(E('A=1\nB=hello world\nC=\nD=$X\ny=1').entries), '    environment:\n      A: "1"\n      B: "hello world"\n      C: ""\n      D: "$$X"\n      "y": "1"');
    const tricky = ['', 'plain', 'a b', "it's", 'a"b', 'a\\b', 'x\ny', '$HOME', 'a#b', ' lead', 'q"\'x', '中文 字', '=', 'a=b'];
    for (const v of tricky) { const t = m.tidyEnv([{ key: 'K', value: v }]); const back = E(t); assert.strictEqual(back.entries.length, 1, JSON.stringify(v)); assert.strictEqual(back.entries[0].value, v, JSON.stringify(v) + ' -> ' + t); }
    // 上限
    const lim = m.limitEnv('a\n'.repeat(3000)); assert.ok(lim.cut); assert.ok(lim.text.split('\n').length <= 2000); assert.ok(m.limitEnv('x'.repeat(200000)).text.length === 100000); assert.ok(!m.limitEnv('A=1').cut);
    assert.ok(E('A=1\n'.repeat(5000)).entries.length <= 2000);
    ok('docker: .env 解析 / 檢查 / 整理 / 轉 compose / 上限');
}
