// 批次 e1：text-tools 命名風格轉換、chart-maker 圖表純函式、code-minify 壓縮 / 美化
const { load, ok, near } = require('./_load');
const assert = require('assert');

{ // ---------- text-tools：命名風格 ----------
    const m = load('utils/text-tools.html', 'splitWords, convertCase, convertCaseLines, CASE_STYLES, CASE_NAMES', '// ===== 命名風格轉換', 'const $ =');
    const c = m.convertCase;
    const all = (s, k = false) => Object.fromEntries(m.CASE_STYLES.map(x => [x, c(s, x, k)]));
    assert.deepStrictEqual(all('user_name'), { camel: 'userName', pascal: 'UserName', snake: 'user_name', kebab: 'user-name', constant: 'USER_NAME', dot: 'user.name', title: 'User Name', sentence: 'User name' });
    // 縮寫切詞
    assert.equal(c('HTTPServer', 'snake'), 'http_server');
    assert.equal(c('getHTTPResponseCode', 'snake'), 'get_http_response_code');
    assert.equal(c('XMLHttpRequest', 'kebab'), 'xml-http-request');
    assert.equal(c('parseXML2Json', 'snake'), 'parse_xml2_json');
    assert.equal(c('ABCdef', 'snake'), 'ab_cdef');
    // 數字
    assert.equal(c('version2Beta', 'snake'), 'version2_beta');
    assert.equal(c('utf8', 'pascal'), 'Utf8');
    assert.equal(c('http2', 'constant'), 'HTTP2');
    assert.equal(c('2nd place', 'camel'), '2ndPlace');
    assert.equal(c('item_10_name', 'camel'), 'item10Name');
    // 混用分隔與空白符號
    assert.equal(c('  --foo__bar-baz qux.quux  ', 'camel'), 'fooBarBazQuxQuux');
    assert.equal(c('hello, world! (foo)', 'snake'), 'hello_world_foo');
    assert.equal(c('MAX_VALUE', 'camel'), 'maxValue');
    assert.equal(c('MAX_VALUE', 'pascal', true), 'MaxValue', '整行大寫不視為縮寫');
    assert.equal(c('HTTP', 'pascal', true), 'Http');
    assert.equal(c("don't stop", 'camel'), 'dontStop');
    assert.equal(c('it’s ok', 'snake'), 'its_ok');
    // 中英混合
    assert.equal(c('用戶name', 'snake'), '用戶_name');
    assert.equal(c('用戶name', 'camel'), '用戶Name');
    assert.equal(c('get用戶Id', 'kebab'), 'get-用戶-id');
    assert.equal(c('user 名稱', 'constant'), 'USER_名稱');
    // 保留縮寫
    assert.equal(c('parseHTTPResponse', 'pascal', true), 'ParseHTTPResponse');
    assert.equal(c('parseHTTPResponse', 'pascal', false), 'ParseHttpResponse');
    assert.equal(c('parseHTTPResponse', 'camel', true), 'parseHTTPResponse');
    assert.equal(c('HTTPServer', 'camel', true), 'httpServer', 'camel 第一個字一律小寫');
    assert.equal(c('user ID card', 'title', true), 'User ID Card');
    assert.equal(c('user ID card', 'title', false), 'User Id Card');
    assert.equal(c('userID', 'sentence', true), 'User ID');
    assert.equal(c('userID', 'sentence', false), 'User id');
    assert.equal(c('XMLHttpRequest', 'snake', true), 'xml_http_request', '小寫風格不受影響');
    assert.equal(c('parseXML2Json', 'pascal', true), 'ParseXML2Json');
    // Title / Sentence
    assert.equal(c('getUserById', 'title'), 'Get User By Id');
    assert.equal(c('getUserById', 'sentence'), 'Get user by id');
    assert.equal(c('GET_USER_BY_ID', 'sentence'), 'Get user by id');
    // 互轉可往返
    for (const s of ['userAccountId', 'userAccountId2Name']) {
        const snake = c(s, 'snake');
        assert.equal(c(snake, 'camel'), s); assert.equal(c(c(snake, 'kebab'), 'camel'), s); assert.equal(c(c(snake, 'constant'), 'camel'), s); assert.equal(c(c(snake, 'pascal'), 'snake'), snake); assert.equal(c(c(snake, 'dot'), 'snake'), snake);
    }
    // 空 / 只有符號
    assert.equal(c('', 'camel'), ''); assert.equal(c('___', 'snake'), ''); assert.equal(c('---', 'title'), '');
    assert.throws(() => c('a', 'nope'));
    // 非字串 / 表情符號不丟錯
    assert.equal(c(123, 'snake'), '123'); assert.equal(c('a😀b', 'snake'), 'a_b');
    // 多行
    let r = m.convertCaseLines('user_name\n\nHTTPServer\r\nget-user-by-id\n', 'camel');
    assert.equal(r.text, 'userName\n\nhttpServer\ngetUserById\n'); assert.equal(r.truncated, false);
    r = m.convertCaseLines('a_b\n   \nc_d', 'pascal'); assert.equal(r.text, 'AB\n\nCD');
    r = m.convertCaseLines('x_y\n'.repeat(6000), 'camel', false, 5000); assert.equal(r.truncated, true); assert.equal(r.text.split('\n').length, 5000);
    assert.equal(m.convertCaseLines('', 'snake').text, '');
    assert.ok(m.CASE_STYLES.every(k => m.CASE_NAMES[k]) && m.CASE_STYLES.length === 8);
    // 大量輸入不卡死
    const t0 = Date.now(); m.convertCaseLines('someVeryLongVariableNameHTTPServer_x\n'.repeat(5000), 'snake'); assert.ok(Date.now() - t0 < 3000);
    ok('e1 text-tools: naming case (split / acronym / digits / cjk / lines)');
}

{ // ---------- chart-maker：純函式 ----------
    const m = load('utils/chart-maker.html', 'niceNum, niceTicks, fmtNum, toNum, detectDelim, parseTable, guessHeader, columnInfo, defaultSel, buildModel, valueDomain, linear, bandScale, pieSlices, pieAngles, textOn, thinStep, normOpts, PALETTES, TYPES, MAX_ROWS, MAX_COLS');
    // 漂亮刻度
    assert.equal(m.niceNum(6.9, true), 5); assert.equal(m.niceNum(7, true), 10); assert.equal(m.niceNum(7, false), 10); assert.equal(m.niceNum(0.02, true), 0.02); assert.equal(m.niceNum(-1, true), 1); assert.equal(m.niceNum(NaN, true), 1);
    const T = (a, b, n) => m.niceTicks(a, b, n);
    assert.deepStrictEqual(T(0, 100, 5).ticks, [0, 20, 40, 60, 80, 100]);
    assert.deepStrictEqual(T(0, 97, 5).ticks, [0, 20, 40, 60, 80, 100]);
    assert.deepStrictEqual(T(3, 47, 5).ticks, [0, 10, 20, 30, 40, 50]);
    assert.deepStrictEqual(T(0.1, 0.9, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
    assert.deepStrictEqual(T(0, 0.3, 4).ticks, [0, 0.2, 0.4]);
    assert.deepStrictEqual(T(-5, 12, 5).ticks, [-5, 0, 5, 10, 15]);
    assert.deepStrictEqual(T(1000, 5000, 5).ticks, [1000, 2000, 3000, 4000, 5000]);
    assert.deepStrictEqual(T(0, 0).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
    assert.ok(T(5, 5).min <= 5 && T(5, 5).max >= 5 && T(-5, -5).max >= -5);
    assert.deepStrictEqual(T(100, 0, 5).ticks, [0, 20, 40, 60, 80, 100], '顛倒也行');
    assert.ok(T(NaN, Infinity).ticks.length >= 2);
    assert.equal(T(0, 1e9).ticks[0], 0);
    assert.equal(T(0, 0.0001, 5).dec, 5);
    for (let i = 0; i < 300; i++) { // 隨機：涵蓋資料範圍、刻度等距、數量合理
        const a = (Math.random() - 0.3) * Math.pow(10, Math.floor(Math.random() * 8 - 3)), b = a + Math.random() * Math.pow(10, Math.floor(Math.random() * 8 - 3));
        const t = T(a, b, 5);
        assert.ok(t.min <= a + 1e-9 * Math.abs(a) && t.max >= b - 1e-9 * Math.abs(b), `cover ${a} ${b}`);
        assert.ok(t.ticks.length >= 2 && t.ticks.length <= 12, `count ${a} ${b} ${t.ticks.length}`);
        for (let k = 1; k < t.ticks.length; k++) near(t.ticks[k] - t.ticks[k - 1], t.step, 1e-6);
    }
    // fmtNum
    assert.equal(m.fmtNum(1234567.891), '1,234,567.89'); assert.equal(m.fmtNum(0.5), '0.5'); assert.equal(m.fmtNum(-0.001), '0'); assert.equal(m.fmtNum(100), '100'); assert.equal(m.fmtNum(0.2, 1), '0.2'); assert.equal(m.fmtNum(1e16), '1.00e+16'); assert.equal(m.fmtNum(NaN), ''); assert.equal(m.fmtNum(-1234.5), '-1,234.5'); assert.equal(m.fmtNum(0), '0'); assert.equal(m.fmtNum(20, 0), '20');
    // toNum
    for (const [s, v] of [['12', 12], [' 3.5 ', 3.5], ['-4', -4], ['1,234', 1234], ['1,234,567.5', 1234567.5], ['50%', 50], ['$99', 99], ['NT$1,200', 1200], ['¥5', 5], ['1e3', 1000], ['.5', 0.5], ['+7', 7]]) assert.equal(m.toNum(s), v, s);
    for (const s of ['', 'abc', '1,2', '12a', '1.2.3', '--1', '1e999', null, undefined, '%', '1,23,456']) assert.ok(Number.isNaN(m.toNum(s)), String(s));
    // 分隔符號
    assert.equal(m.detectDelim('a\tb\tc'), '\t'); assert.equal(m.detectDelim('a,b,c'), ','); assert.equal(m.detectDelim('a;b;c'), ';'); assert.equal(m.detectDelim('a|b'), '|'); assert.equal(m.detectDelim('abc'), ','); assert.equal(m.detectDelim('"a,b",c;d;e'), ';'); assert.equal(m.detectDelim('\n\na,b'), ',');
    // 解析
    let p = m.parseTable('月份,營收\r\n1月,120\n\n2月,"1,500"\n');
    assert.deepStrictEqual(p.rows, [['月份', '營收'], ['1月', '120'], ['2月', '1,500']]);
    p = m.parseTable('a\tb\tc\n1\t2\n'); assert.deepStrictEqual(p.rows, [['a', 'b', 'c'], ['1', '2', '']], '補齊欄數');
    assert.deepStrictEqual(m.parseTable('').rows, []); assert.deepStrictEqual(m.parseTable(null).rows, []); assert.deepStrictEqual(m.parseTable(' \n \n').rows, []);
    assert.ok(m.parseTable('a,"b\n1,2').error, '引號不成對');
    assert.ok(m.parseTable('x'.repeat(2000001)).error, '太大');
    p = m.parseTable('h\n' + '1\n'.repeat(6000)); assert.equal(p.rows.length, 5001); assert.equal(p.truncRows, true);
    p = m.parseTable('h\n' + '1\n'.repeat(6000), false); assert.equal(p.rows.length, 5000);
    p = m.parseTable('a,b,c,d,e,f,g,h,i,j,k,l,m,n\n1,2,3,4,5,6,7,8,9,10,11,12,13,14'); assert.equal(p.rows[0].length, 12); assert.equal(p.truncCols, true);
    assert.equal(m.parseTable('a,b\n1,2').truncRows, false);
    // 標題猜測與欄位資訊
    assert.equal(m.guessHeader([['月份', '營收'], ['1月', '120']]), true); assert.equal(m.guessHeader([['1', '2'], ['3', '4']]), false); assert.equal(m.guessHeader([['a', 'b']]), false); assert.equal(m.guessHeader([['a', 'b'], ['c', 'd']]), false); assert.equal(m.guessHeader([['', ''], ['1', '2']]), false);
    let rows = [['名稱', '', '值', '值'], ['甲', '1', '10', '5%'], ['乙', '2', 'x', '6%'], ['丙', '', '30', '']];
    let info = m.columnInfo(rows, true);
    assert.deepStrictEqual(info.names, ['名稱', '欄 B', '值', '值_2']); assert.equal(info.rows.length, 3);
    assert.deepStrictEqual(info.cols.map(c => c.isNum), [false, true, true, true]);
    assert.equal(m.columnInfo(rows, false).names[0], '欄 A'); assert.equal(m.columnInfo(rows, false).rows.length, 4);
    assert.deepStrictEqual(m.columnInfo([], true).names, []);
    assert.deepStrictEqual(m.defaultSel(info), { xcol: 0, ycols: [1, 2, 3] });
    assert.deepStrictEqual(m.defaultSel(m.columnInfo([['1', '2'], ['3', '4']], false)), { xcol: 0, ycols: [1] });
    assert.deepStrictEqual(m.defaultSel(m.columnInfo([['1'], ['3']], false)), { xcol: -1, ycols: [0] });
    assert.deepStrictEqual(m.defaultSel(m.columnInfo([], false)), { xcol: -1, ycols: [] });
    // 模型：非數值略過並計數
    let md = m.buildModel(info, { type: 'bar', xcol: 0, ycols: [2, 3, 0, 99, -1, 1.5] });
    assert.deepStrictEqual(md.cats, ['甲', '乙', '丙']); assert.deepStrictEqual(md.series.map(s => s.name), ['值', '值_2']);
    assert.deepStrictEqual(md.series[0].vals, [10, null, 30]); assert.deepStrictEqual(md.series[1].vals, [5, 6, null]);
    assert.deepStrictEqual(md.skipped, [{ name: '值', n: 1 }]);
    md = m.buildModel(info, { type: 'bar', xcol: -1, ycols: [2] }); assert.deepStrictEqual(md.cats, ['1', '2', '3']);
    md = m.buildModel(info, { type: 'bar', xcol: 2, ycols: [2, 3] }); assert.deepStrictEqual(md.series.map(s => s.col), [3], 'X 欄不當 Y');
    md = m.buildModel(info, { type: 'scatter', xcol: 1, ycols: [2] }); assert.deepStrictEqual(md.xs.slice(0, 2), [1, 2]); assert.ok(Number.isNaN(md.xs[2])); assert.equal(md.xFallback, false);
    md = m.buildModel(info, { type: 'scatter', xcol: 0, ycols: [2] }); assert.deepStrictEqual(md.xs, [1, 2, 3]); assert.equal(md.xFallback, true);
    md = m.buildModel(m.columnInfo([], true), { type: 'bar', xcol: -1, ycols: [] }); assert.deepStrictEqual(md.cats, []);
    // 5000 × 12 效能
    const big = ['h' + Array.from({ length: 11 }, (_, i) => ',c' + i).join('')]; for (let i = 0; i < 5000; i++) big.push(Array.from({ length: 12 }, (_, j) => i * j).join(','));
    const t0 = Date.now(); p = m.parseTable(big.join('\n')); info = m.columnInfo(p.rows, true); md = m.buildModel(info, { type: 'line', xcol: 0, ycols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] });
    assert.equal(md.cats.length, 5000); assert.equal(md.series.length, 11); assert.ok(Date.now() - t0 < 3000);
    // 數值範圍
    const mk = (type, ...vals) => ({ cats: vals[0].map((_, i) => 'c' + i), series: vals.map((v, i) => ({ name: 's' + i, vals: v })), type });
    assert.deepStrictEqual(m.valueDomain(mk('bar', [5, 10]), 'bar'), [0, 10]); assert.deepStrictEqual(m.valueDomain(mk('bar', [-5, -2]), 'bar'), [-5, 0]);
    assert.deepStrictEqual(m.valueDomain(mk('line', [5, 10]), 'line'), [5, 10]); assert.deepStrictEqual(m.valueDomain(mk('area', [5, 10]), 'area'), [0, 10]);
    assert.deepStrictEqual(m.valueDomain(mk('stack', [1, 2], [3, 4], [-1, -2]), 'stack'), [-2, 6]);
    assert.deepStrictEqual(m.valueDomain(mk('stack', [null, 2], [3, null]), 'stack'), [0, 3]);
    assert.equal(m.valueDomain(mk('bar', [null, null]), 'bar'), null); assert.equal(m.valueDomain({ cats: [], series: [] }, 'bar'), null);
    // 座標映射
    const f = m.linear(0, 10, 100, 0); assert.equal(f(0), 100); assert.equal(f(10), 0); assert.equal(f(5), 50); assert.equal(f(20), -100);
    assert.equal(m.linear(5, 5, 0, 100)(5), 50);
    const b = m.bandScale(4, 0, 100, 0.2); assert.equal(b.step, 25); assert.equal(b.bw, 20); assert.equal(b.center(0), 12.5); assert.equal(b.start(1), 27.5); assert.equal(m.bandScale(0, 0, 100).step, 0);
    // 圓餅
    let ps = m.pieSlices(['a', 'b', 'c', 'd'], [30, 0, null, 70]); assert.deepStrictEqual(ps.slices, [{ label: 'd', v: 70 }, { label: 'a', v: 30 }]); assert.equal(ps.ignored, 1);
    ps = m.pieSlices(['a'], [-5]); assert.equal(ps.slices.length, 0); assert.equal(ps.ignored, 1);
    ps = m.pieSlices(Array.from({ length: 20 }, (_, i) => 'x' + i), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(ps.slices.length, 12); assert.equal(ps.slices[11].label, '其他'); assert.equal(ps.slices.reduce((a, s) => a + s.v, 0), 210); assert.equal(ps.slices[0].v, 20);
    assert.equal(m.pieSlices([''], [3]).slices[0].label, '1');
    const an = m.pieAngles([{ label: 'a', v: 1 }, { label: 'b', v: 1 }, { label: 'c', v: 2 }]);
    near(an[0].a0, -Math.PI / 2); near(an[0].frac, 0.25); near(an[1].a0, an[0].a1); near(an[2].frac, 0.5); near(an[2].a1, -Math.PI / 2 + 2 * Math.PI); near(an.reduce((s, x) => s + (x.a1 - x.a0), 0), 2 * Math.PI);
    assert.deepStrictEqual(m.pieAngles([]), []); assert.deepStrictEqual(m.pieAngles([{ label: 'a', v: 0 }]), []);
    near(m.pieAngles([{ label: 'a', v: 5 }], 0)[0].a1, 2 * Math.PI);
    // 其他
    assert.equal(m.textOn('#ffffff'), '#111'); assert.equal(m.textOn('#000000'), '#fff'); assert.equal(m.textOn('bad'), '#fff');
    assert.equal(m.thinStep(40, 100), 1); assert.equal(m.thinStep(60, 20), 4); assert.equal(m.thinStep(10, 0), 16);
    // 調色盤：5 組、每組 12 色、格式正確、色盲友善一組存在
    assert.equal(m.PALETTES.length, 5); assert.ok(m.PALETTES.every(x => x.c.length === 12 && x.c.every(c => /^#[0-9a-f]{6}$/i.test(c)))); assert.ok(m.PALETTES.some(x => x.name === '色盲友善'));
    assert.equal(m.PALETTES[3].c[0].toLowerCase(), '#0072b2');
    // 記住的選項：壞資料容錯
    assert.deepStrictEqual(m.normOpts(null), { type: 'bar', palette: 0, legend: true, labels: false });
    assert.deepStrictEqual(m.normOpts({ type: 'pie', palette: 3, legend: false, labels: true }), { type: 'pie', palette: 3, legend: false, labels: true });
    for (const bad of [[], 'x', 5, { type: 'zzz', palette: 99, legend: 'no', labels: 1 }, { palette: -1 }, { palette: 1.5 }, { type: null }]) { const o = m.normOpts(bad); assert.ok(m.TYPES.includes(o.type) && o.palette >= 0 && o.palette < 5 && typeof o.legend === 'boolean' && typeof o.labels === 'boolean'); }
    assert.equal(m.normOpts({ legend: 'no' }).legend, true); assert.equal(m.normOpts({ labels: 1 }).labels, false);
    ok('e1 chart-maker: ticks / parse / model / pie / opts');
}

{ // ---------- code-minify：壓縮 / 美化 / 驗證 ----------
    const fs = require('fs'), path = require('path'), os = require('os');
    const m = load('utils/code-minify.html', 'jsTokens, jsSig, minifyJS, beautifyJS, cssTokens, minifyCSS, beautifyCSS, cssStats, htmlTokens, minifyHTML, beautifyHTML, tagSeq, htmlText, minifyJSON, beautifyJSON, run, verify, guessLang, compiles, byteLen, pctSaved, MAX_BYTES');
    const mj = (s, o) => m.minifyJS(s, o);
    // 單一案例：token 序列不變、輸出可編譯
    const jsOk = (src, expected) => {
        const out = mj(src); assert.equal(m.jsSig(out), m.jsSig(src), 'sig ' + JSON.stringify(src) + ' -> ' + JSON.stringify(out));
        if (m.compiles(src)) assert.ok(m.compiles(out), 'compile ' + out);
        if (expected !== undefined) assert.equal(out, expected, JSON.stringify(src));
        const b = m.beautifyJS(src); assert.equal(m.jsSig(b), m.jsSig(src), 'beautify sig ' + JSON.stringify(src) + ' -> ' + JSON.stringify(b));
        if (m.compiles(src)) assert.ok(m.compiles(b), 'beautify compile ' + b);
        return out;
    };
    // 字串、註解、正規表示式、樣板字串
    jsOk('var a = "//not" ; // real\nvar b = \'/* no */\' /* yes */;', 'var a="//not";var b=\'/* no */\';');
    jsOk('x = /a\\/\\/b/g.test( s ) ; y = /[/]/ . test(s) ; z = /"/ ;', 'x=/a\\/\\/b/g.test(s);y=/[/]/.test(s);z=/"/;');
    jsOk('a = b / c / d ; e = (f) / 2 / g ; h = i[0] / 2 ; j = k++ / 2', 'a=b/c/d;e=(f)/2/g;h=i[0]/2;j=k++/2');
    jsOk('if (x) y = 1 ; else z = /re/ . exec(s)');
    jsOk('return /x/ . test(a) ;'.replace('return', 'function f(){return') + '}');
    jsOk('var t = `a  ${ b + `c  ${ "}" }` }  d` ;', 'var t=`a  ${ b + `c  ${ "}" }` }  d`;');
    jsOk('var q = (s) => `\'${String(s).replace(/\'/g, `\'\\\\\'\'`)}\'` ;', 'var q=(s)=>`\'${String(s).replace(/\'/g, `\'\\\\\'\'`)}\'`;');   // 樣板字串的 ${} 裡有正規表示式與巢狀樣板
    jsOk('var t = `line1\n   line2` ;','var t=`line1\n   line2`;');
    jsOk('var s = "a\\"b" , r = \'c\\\'d\' ;', 'var s="a\\"b",r=\'c\\\'d\';');
    jsOk('var s = "line \\\ncontinued" ;');
    // 空白：必須保留的
    assert.equal(mj('a + +b'), 'a+ +b'); assert.equal(mj('a - -b'), 'a- -b'); assert.equal(mj('a + ++b'), 'a+ ++b'); assert.equal(mj('a++ + b'), 'a+++b'); assert.equal(mj('a - --b'), 'a- --b');
    assert.equal(mj('1 .toString()'), '1 .toString()'); assert.equal(mj('typeof   x'), 'typeof x'); assert.equal(mj('a in b'), 'a in b'); assert.equal(mj('a instanceof B'), 'a instanceof B'); assert.equal(mj('return "x"'), 'return"x"');
    assert.equal(mj('var  x  =  1'), 'var x=1'); assert.equal(mj('a / /re/.source'), 'a/ /re/.source');
    assert.equal(mj('x = a /* c */ b'), 'x=a b'); assert.equal(mj('async function  f ( ) { await  g ( ) }'), 'async function f(){await g()}');
    assert.equal(mj('x = y ? .5 : 1'), 'x=y?.5:1');
    // 換行：ASI 敏感處必須保留
    assert.equal(mj('a = 1\nb = 2'), 'a=1\nb=2'); assert.equal(mj('return\nx'), 'return\nx'); assert.equal(mj('a\n++b'), 'a\n++b'); assert.equal(mj('a = b\n(c)'), 'a=b\n(c)'); assert.equal(mj('a++\nb'), 'a++\nb');
    assert.equal(mj('a /* x\ny */ b'), 'a\nb'); assert.equal(mj('a // c\n\n\n   b'), 'a\nb');
    assert.equal(mj('if (a) {\n  b();\n  c()\n}\n'), 'if(a){b();c()\n}'); assert.equal(mj('f(a,\n  b,\n  c)'), 'f(a,b,c)');
    // 實際執行結果相同（ASI 與 regex 的小程式）
    const progs = [
        'var s = 0\nvar a = [1,2,3]\nfor (var i = 0; i < a.length; i++) {\n  s += a[i]\n}\nreturn s',
        'function f() {\n  return\n  42\n}\nvar x = f()\nreturn String(x)',
        'var i = 1\nvar j = i\n++i\nreturn [i, j].join()',
        'var r = /a b\\/c/g, s = "a b/c a b/c"\nreturn s.replace(r, "-") + (8 / 2 / 2)',
        'var o = { a: 1, // c\n b: 2 /* d */ }\nreturn JSON.stringify(o) + `${ o.a + ` ${ o.b } ` }`',
        'var a = 5, b = 2, c = a - -b, d = a + +b, e = a++ + ++b\nreturn [c, d, e, a, b].join()',
        'var t = typeof /x/ + typeof "s" in {}\nreturn t',
    ];
    for (const p of progs) { const f1 = new Function(p), f2 = new Function(mj(p)); assert.strictEqual(f2(), f1(), p); }
    // 授權註解
    assert.equal(mj('/*! (c) me */\nvar a = 1 // x'), '/*! (c) me */\nvar a=1'); assert.equal(mj('/*! (c) me */\nvar a = 1', { keep: false }), 'var a=1'); assert.ok(mj('/** @license MIT */ a()').startsWith('/** @license MIT */\n'));
    assert.equal(mj('#!/usr/bin/env node\nvar  a = 1'), '#!/usr/bin/env node\nvar a=1');
    assert.equal(mj('a // end'), 'a'); assert.equal(mj('   \n\n '), ''); assert.equal(mj(''), '');
    assert.equal(mj('var 變數 = "中文" ; var $a = _b'), 'var 變數="中文";var $a=_b');
    // 美化的樣子
    assert.equal(m.beautifyJS('function f(a,b){if(a){return b}else{return -1}}'), 'function f(a, b) {\n  if (a) {\n    return b\n  } else {\n    return -1\n  }\n}');
    assert.equal(m.beautifyJS('for(var i=0;i<3;i++){x+=i}'), 'for (var i = 0; i < 3; i++) {\n  x += i\n}');
    assert.equal(m.beautifyJS('var o={a:1,b:[1,2],c:{d:3}}'), 'var o = {\n  a: 1,\n  b: [1, 2],\n  c: {\n    d: 3\n  }\n}');
    assert.equal(m.beautifyJS('x=a?b:c;y=!z;w=-1;v=a-b'), 'x = a ? b : c;\ny = !z;\nw = -1;\nv = a - b');
    assert.equal(m.beautifyJS('a=b+ +c;d=e- -f'), 'a = b + +c;\nd = e - -f');
    assert.equal(m.beautifyJS('f(function(){return 1},2)'), 'f(function () {\n  return 1\n}, 2)');
    assert.equal(m.beautifyJS('switch(x){case 1:a();break;default:b()}'), 'switch (x) {\n  case 1:\n  a();\n  break;\n  default:\n  b()\n}');
    assert.equal(m.beautifyJS('x.foo.bar(1)[0]?.baz'), 'x.foo.bar(1)[0]?.baz'); assert.equal(m.beautifyJS('{}'), '{}'); assert.equal(m.beautifyJS(''), '');
    assert.equal(m.beautifyJS('// a\nvar x=1 // b\n/* c */\nvar y=2'), '// a\nvar x = 1 // b\n/* c */\nvar y = 2');
    // 分詞：任何輸入都能還原、不會卡死（模糊測試）
    const rnd = Util.seeded('e1-minify').int;
    const alpha = ['\'', '"', '`', '/', '*', '\\', '{', '}', '$', ' ', '\n', 'a', '1', '.', '+', '-', '(', ')', '=', '>', '<', '!', '-', '#', '@', 'é', '😀', '\t', '\r\n', '${', '/*', '*/', '//'];
    for (let n = 0; n < 400; n++) {
        let s = ''; const len = 1 + rnd(40); for (let i = 0; i < len; i++) s += alpha[rnd(alpha.length)];
        assert.equal(m.jsTokens(s).map(t => t.v).join(''), s, 'js roundtrip ' + JSON.stringify(s));
        assert.equal(m.cssTokens(s).map(t => t.v).join(''), s, 'css roundtrip ' + JSON.stringify(s));
        assert.equal(m.htmlTokens(s).map(t => t.v).join(''), s, 'html roundtrip ' + JSON.stringify(s));
        assert.equal(typeof mj(s), 'string'); assert.equal(typeof m.beautifyJS(s), 'string'); assert.equal(typeof m.minifyCSS(s), 'string'); assert.equal(typeof m.beautifyCSS(s), 'string'); assert.equal(typeof m.minifyHTML(s), 'string'); assert.equal(typeof m.beautifyHTML(s), 'string');
    }
    // 模糊：隨機 token 湯（不含 /）壓縮 / 美化後 token 序列不變
    const pool = ['a', 'b1', 'return', 'typeof', 'in', 'new', 'if', 'else', '12', '0.5', '"s t"', "'q'", '`t ${x}`', '+', '-', '++', '--', '*', '=', '==', '=>', '(', ')', '{', '}', '[', ']', ';', ',', '.', '?', ':', '!', '<', '>', '&&', '||', '...', '?.', '中'];
    const wsPool = ['', ' ', '  ', '\n', ' \n  ', '/* c */', '// c\n', '/* a\nb */', '\t'];
    for (let n = 0; n < 600; n++) {
        let s = ''; const len = 2 + rnd(25); for (let i = 0; i < len; i++) s += pool[rnd(pool.length)] + (rnd(2) ? wsPool[rnd(wsPool.length)] : ' ');
        const a = m.jsSig(s), o1 = mj(s), o2 = m.beautifyJS(s);
        assert.equal(m.jsSig(o1), a, 'min fuzz ' + JSON.stringify(s) + ' -> ' + JSON.stringify(o1));
        assert.equal(m.jsSig(o2), a, 'beau fuzz ' + JSON.stringify(s) + ' -> ' + JSON.stringify(o2));
        assert.equal(mj(o1), o1, 'idempotent ' + JSON.stringify(o1));
    }
    // CSS
    const cm = (s, o) => m.minifyCSS(s, o);
    assert.equal(cm('a { color : red ; }'), 'a{color:red}'); assert.equal(cm('a{margin:0 auto;}\n\n/* c */\nb{x:y}'), 'a{margin:0 auto}b{x:y}');
    assert.equal(cm('.a   >   .b ~ .c , .d { width : calc( 100%  -  ( 2 * 5px ) ) ; }'), '.a>.b~.c,.d{width:calc(100% - (2 * 5px))}');
    assert.equal(cm('a{width:calc(1px+2px);height:calc(1px + 2px);margin:calc(-1 * var(--x))}'), 'a{width:calc(1px+2px);height:calc(1px + 2px);margin:calc(-1 * var(--x))}', 'calc 內不動運算子空白');
    assert.equal(cm('a{margin:0 +1px 0 -1px}'), 'a{margin:0 +1px 0 -1px}'); assert.equal(cm('a:nth-child( 2n + 1 ) , b { x : y }'), 'a:nth-child(2n + 1),b{x:y}');
    assert.equal(cm('a { background : url( data:image/png;base64,AA==  ) no-repeat , url( "x y;z.png" ) }'), 'a{background:url(data:image/png;base64,AA==) no-repeat,url("x y;z.png")}');
    assert.equal(cm('a { content : ";}{ /* not */" ; font-family : "A  B" , \'C\' }'), 'a{content:";}{ /* not */";font-family:"A  B",\'C\'}');
    assert.equal(cm('a :hover , b:not( .c ) { x : y !important ; }'), 'a :hover,b:not(.c){x:y !important}', '選擇器的空白（後代 + 偽類）要保留');
    assert.equal(cm('@media screen and (min-width : 600px) , print { a { x : y } }'), '@media screen and (min-width:600px),print{a{x:y}}'); assert.equal(cm('@media (width >= 600px) and (width <= 900px){a{x:y}}'), '@media (width >= 600px) and (width <= 900px){a{x:y}}');
    assert.equal(cm('@import url( foo.css ) screen ;\n@charset "utf-8" ;'), '@import url(foo.css) screen;@charset "utf-8";'); assert.equal(cm('.\\31 0 { x : y }'), '.\\31 0{x:y}'); assert.equal(cm('[ data-x = "a b" ] { x : y }'), '[data-x = "a b"]{x:y}');
    assert.equal(cm('/*! keep */ a { x : y } /* drop */'), '/*! keep */\na{x:y}'); assert.equal(cm('/*! keep */ a { x : y }', { keep: false }), 'a{x:y}');
    assert.equal(cm('.a { & :hover { x : y } &:focus { z : w } }'), '.a{& :hover{x:y}&:focus{z:w}}', '巢狀 CSS 選擇器空白保留'); assert.equal(cm(''), ''); assert.equal(cm('  \n '), '');
    assert.equal(cm('a{--x : 1px ; --y:{a:b}}'), 'a{--x:1px;--y:{a:b}}');
    // 規則 / 選擇器 / 宣告計數
    const css1 = '/* c */ a, b > c { x: y; z: w } @media (min-width: 1px) { d { x: y } e, f:not(.a, .b) { z: w; } } @font-face { src: url(a;b.woff); }';
    assert.deepStrictEqual(m.cssStats(css1), { rules: 5, selectors: 5, decls: 5 });
    assert.deepStrictEqual(m.cssStats(cm(css1)), m.cssStats(css1)); assert.deepStrictEqual(m.cssStats(m.beautifyCSS(css1)), m.cssStats(css1));
    assert.deepStrictEqual(m.cssStats('a{b:"{;}"}'), { rules: 1, selectors: 1, decls: 1 });
    // CSS 美化
    assert.equal(m.beautifyCSS('a{color:red;margin:0 auto}b>c,d{x:y}'), 'a {\n  color: red;\n  margin: 0 auto;\n}\n\nb > c,\nd {\n  x: y;\n}');
    assert.equal(m.beautifyCSS('@media (min-width:600px){a{x:y}}'), '@media (min-width: 600px) {\n  a {\n    x: y;\n  }\n}');
    assert.equal(m.beautifyCSS('a{background:url(a;b.png),url("c d")}a:hover::before{content:"a;b"}'), 'a {\n  background: url(a;b.png), url("c d");\n}\n\na:hover::before {\n  content: "a;b";\n}');
    assert.equal(m.beautifyCSS('.a{&:hover{x:y}}'), '.a {\n  &:hover {\n    x: y;\n  }\n}'); assert.equal(m.beautifyCSS('/* c */a{x:y}'), '/* c */\na {\n  x: y;\n}'); assert.equal(m.beautifyCSS(''), '');
    // 模糊：CSS 湯，壓縮後規則數不變、可重複壓縮、美化再壓縮回到同一個結果
    const cpool = ['a', '.b', '#c', ':hover', '::before', '>', '~', '+', ',', '{', '}', ';', ':', '(', ')', '[', ']', '"s;{"', "'q'", 'url(x;y)', 'calc(1px + 2px)', '1px', '-2', '!important', '/* c */', '@media', '@x'];
    for (let n = 0; n < 600; n++) {
        let s = ''; const len = 3 + rnd(25); for (let i = 0; i < len; i++) s += cpool[rnd(cpool.length)] + [' ', '', '\n ', '  '][rnd(4)];
        const o = cm(s); assert.equal(cm(o), o, 'css idempotent ' + JSON.stringify(s) + ' -> ' + JSON.stringify(o));
        assert.deepStrictEqual(m.cssStats(o), m.cssStats(s), 'css stats ' + JSON.stringify(s)); assert.deepStrictEqual(m.cssStats(m.beautifyCSS(s)), m.cssStats(s), 'css beau stats ' + JSON.stringify(s));
    }
    // HTML
    const hm = (s, o) => m.minifyHTML(s, o);
    assert.equal(hm('<div>\n  <p>  Hello,   <b>world</b> !  </p>\n</div>\n'), '<div><p>Hello, <b>world</b> !</p></div>');
    assert.equal(hm('<p>a <b>b</b> <i>c</i></p>'), '<p>a <b>b</b> <i>c</i></p>', '行內元素之間的空白保留成 1 個');
    assert.equal(hm('<pre>  a\n   b  </pre>\n<textarea>  x\n  y </textarea>'), '<pre>  a\n   b  </pre><textarea>  x\n  y </textarea>');
    assert.equal(hm('<div><!-- gone --><span>a</span><!-- gone2 --> <span>b</span></div>'), '<div><span>a</span> <span>b</span></div>');
    assert.equal(hm('<a href="x" title="a  b >  c"   class = "d">x</a>'), '<a href="x" title="a  b >  c" class = "d">x</a>'.replace('class = "d"', 'class = "d"'));
    assert.equal(hm('<style>\n a { color : red ; }\n /* c */\n</style>'), '<style>a{color:red}</style>'); assert.equal(hm('<script>\n var a = 1 ; // c\n var b = `x  y` ;\n</script>'), '<script>var a=1;var b=`x  y`;</script>');
    assert.equal(hm('<script type="application/ld+json">\n { "a" : 1 , "b" : [ 1 , 2 ] }\n</script>'), '<script type="application/ld+json">{"a":1,"b":[1,2]}</script>');
    assert.equal(hm('<script type="text/template">\n  <div>  {{ x }}  </div>\n</script>'), '<script type="text/template">\n  <div>  {{ x }}  </div>\n</script>');
    assert.equal(hm('<script src="a.js"></script>\n<script>x()</script>'), '<script src="a.js"></script><script>x()</script>');
    assert.equal(hm('<!--[if IE]><p>ie</p><![endif]--><p>x</p>'), '<!--[if IE]><p>ie</p><![endif]--><p>x</p>'); assert.equal(hm('<!--[if IE]><p>ie</p><![endif]--><p>x</p>', { keep: false }), '<p>ie</p><![endif]--><p>x</p>'.replace('<p>ie</p><![endif]-->', '') + '');
    assert.equal(hm('<!DOCTYPE html>\n<html>\n<body>\n<br>\n a \n<br/>\n b\n</body>\n</html>'), '<!DOCTYPE html><html><body><br>a<br/>b</body></html>');
    assert.equal(hm('<ul>\n<li>a</li>\n<li>b</li>\n</ul>'), '<ul><li>a</li><li>b</li></ul>'); assert.equal(hm('<button>a</button> <button>b</button>'), '<button>a</button> <button>b</button>');
    assert.equal(hm('<p>a &nbsp; b</p>'), '<p>a &nbsp; b</p>'); assert.equal(hm(''), '');
    assert.equal(hm('<script>if (a < b && c > d) x()</script><p>1 < 2</p>'), '<script>if(a<b&&c>d)x()</script><p>1 < 2</p>');
    assert.equal(m.beautifyHTML('<div><p>a <b>b</b></p><ul><li>x</li><li>y</li></ul></div>'), '<div>\n  <p>a <b>b</b></p>\n  <ul>\n    <li>x</li>\n    <li>y</li>\n  </ul>\n</div>');
    assert.equal(m.beautifyHTML('<html><head><meta charset="utf-8"><title>t</title></head><body>x</body></html>'), '<html>\n  <head>\n    <meta charset="utf-8">\n    <title>t</title>\n  </head>\n  <body>x</body>\n</html>');
    assert.equal(m.beautifyHTML('<div><pre>a\n b</pre><!-- c --></div>'), '<div>\n  <pre>a\n b</pre>\n  <!-- c -->\n</div>');
    assert.equal(m.beautifyHTML('<style>a{x:y}</style><script>f(1)</script>'), '<style>\n  a {\n    x: y;\n  }\n</style>\n<script>\n  f(1)\n</script>');
    assert.equal(m.beautifyHTML(''), '');
    // 驗證函式：真的能抓到壞掉的結果
    assert.equal(m.verify('js', 'a = 1;', 'a=1;').ok, true); assert.equal(m.verify('js', 'a = 1;', 'a=2;').ok, false); assert.equal(m.verify('js', 'a = b', 'a = b )').ok, false);
    assert.equal(m.verify('js', 'import x from "y"; x()', 'import x from"y";x()').ok, true, 'module 語法只比 token');
    assert.equal(m.verify('css', 'a{x:y}b{z:w}', 'a{x:y}').ok, false); assert.equal(m.verify('css', 'a,b{x:y}', 'a{x:y}').ok, false); assert.equal(m.verify('css', 'a{x:y;z:w}', 'a{x:y}').ok, false); assert.equal(m.verify('css', 'a { x : y }', 'a{x:y}').ok, true);
    assert.equal(m.verify('html', '<div class="a"><p>x</p></div>', '<div class="a"><p>x</p></div>').ok, true); assert.equal(m.verify('html', '<div><p>x</p></div>', '<div></div>').ok, false); assert.equal(m.verify('html', '<div a b>x</div>', '<div a>x</div>').ok, false); assert.equal(m.verify('html', '<p>hello</p>', '<p>hell</p>').ok, false);
    assert.equal(m.verify('json', '{"a": 1}', '{"a":1}').ok, true); assert.equal(m.verify('json', '{"a": 1}', '{"a":2}').ok, false); assert.equal(m.verify('json', '{', '{').ok, false);
    // JSON
    assert.equal(m.minifyJSON('{ "a" : [ 1 , 2 ] , "b" : { "c" : null } }'), '{"a":[1,2],"b":{"c":null}}'); assert.equal(m.beautifyJSON('{"a":[1,2],"b":{}}'), '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {}\n}');
    assert.throws(() => m.minifyJSON('{a:1}')); let r = m.run('json', 'minify', '{bad'); assert.ok(r.error && r.error.startsWith('JSON 格式錯誤'));
    // run / 大小 / 猜語言
    assert.equal(m.run('css', 'minify', 'a { x : y }').out, 'a{x:y}'); assert.equal(m.run('js', 'beautify', 'a=1').out, 'a = 1'); assert.equal(m.run('nope', 'minify', 'a').error, '未知的語言：nope'); assert.equal(m.run('css', 'minify', '   ').out, ''); assert.equal(m.run('css', 'minify', null).out, '');
    r = m.run('js', 'minify', 'a'.repeat(m.MAX_BYTES + 1)); assert.ok(r.error && r.error.includes('1MB')); assert.equal(m.run('js', 'minify', 'a'.repeat(m.MAX_BYTES)).error, undefined);
    assert.equal(m.run('js', 'minify', '中'.repeat(400000)).error !== undefined, true, '以位元組計（中文 3 bytes）');
    assert.equal(m.byteLen('a中'), 4); assert.equal(m.pctSaved(100, 40), 60); assert.equal(m.pctSaved(0, 0), 0); assert.equal(m.pctSaved(100, 120), -20);
    assert.equal(m.guessLang('<!DOCTYPE html><html></html>'), 'html'); assert.equal(m.guessLang('<div class="a">x</div>'), 'html'); assert.equal(m.guessLang('{"a":1}'), 'json'); assert.equal(m.guessLang('[1,2]'), 'json');
    assert.equal(m.guessLang('a { color: red; }'), 'css'); assert.equal(m.guessLang('@media (min-width:1px){a{x:y}}'), 'css'); assert.equal(m.guessLang('.box > p { margin: 0 }'), 'css');
    assert.equal(m.guessLang('const a = 1;'), 'js'); assert.equal(m.guessLang('function f() { return 1 }'), 'js'); assert.equal(m.guessLang('x => x + 1'), 'js'); assert.equal(m.guessLang(''), null);
    // 效能：接近 1MB 的大檔不能是 O(n²)
    {
        const tt = Date.now(), bigJs = 'var x = f1( 2 ) ; /* c */\n'.repeat(35000), bigCss = 'a { color : red ; margin : 0 auto }\n'.repeat(27000), bigHtml = '<div class="a">\n  <p>  Hello   <b>x</b> </p>\n</div>\n'.repeat(18000);
        for (const [l, s] of [['js', bigJs], ['css', bigCss], ['html', bigHtml]]) for (const md of ['minify', 'beautify']) { const r = m.run(l, md, s); assert.equal(r.error, undefined, l); assert.ok(m.verify(l, s, r.out).ok, 'big ' + l + md); }
        assert.ok(Date.now() - tt < 8000, 'big files ' + (Date.now() - tt));
    }
    // 真實檔案：repo 內所有頁面的 script / style 與 shared 的 js / css
    const root = path.join(__dirname, '..'), pages = [];
    for (const d of fs.readdirSync(root)) { const p = path.join(root, d); if (fs.statSync(p).isDirectory() && !['node_modules', 'tests', 'assets', '.git'].includes(d)) for (const f of fs.readdirSync(p)) if (f.endsWith('.html')) pages.push(path.join(p, f)); }
    pages.push(path.join(root, 'index.html'));
    let nJs = 0, nCss = 0, nHtml = 0, inB = 0, outB = 0; const t0 = Date.now();
    const chkJs = (s, name) => {
        const o = mj(s); assert.equal(m.jsSig(o), m.jsSig(s), 'sig ' + name); const c0 = m.compiles(s); if (c0) assert.ok(m.compiles(o), 'compile ' + name);
        assert.equal(mj(o), o, 'idempotent ' + name);
        const b = m.beautifyJS(s); assert.equal(m.jsSig(b), m.jsSig(s), 'beautify sig ' + name); if (c0) assert.ok(m.compiles(b), 'beautify compile ' + name);
        assert.equal(m.jsSig(m.beautifyJS(o)), m.jsSig(s)); nJs++; inB += s.length; outB += o.length;
    };
    const chkCss = (s, name) => {
        const o = cm(s); assert.deepStrictEqual(m.cssStats(o), m.cssStats(s), 'css stats ' + name); assert.equal(cm(o), o, 'css idem ' + name);
        const b = m.beautifyCSS(s); assert.deepStrictEqual(m.cssStats(b), m.cssStats(s), 'css beau stats ' + name); assert.equal(cm(b), o, 'css beau->min ' + name); nCss++;
    };
    for (const f of pages) {
        const h = fs.readFileSync(f, 'utf8'), name = path.relative(root, f);
        for (const x of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/type\s*=/.test(x[1]) || /javascript|module/.test(x[1])) chkJs(x[2], name);
        for (const x of h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) chkCss(x[1], name);
        const o = hm(h), v = m.verify('html', h, o); assert.ok(v.ok, 'html verify ' + name + ' ' + v.msg); assert.ok(o.length < h.length);
        const b = m.beautifyHTML(h), vb = m.verify('html', h, b); assert.ok(vb.ok, 'html beautify verify ' + name + ' ' + vb.msg); assert.ok(m.verify('html', h, hm(b)).ok, 'html beau->min ' + name);
        for (const x of o.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) if (!/type\s*=/.test(x[1]) || /javascript|module/.test(x[1])) assert.ok(m.compiles(x[2]) || !m.compiles(h.match(/<script(?![^>]*\bsrc=)(?![^>]*type)[^>]*>([\s\S]*?)<\/script>/i)?.[1] || ''), 'html script compiles ' + name);
        nHtml++;
    }
    for (const f of ['shared/js/util.js', 'shared/js/chrome.js', 'shared/js/p2p-room.js']) chkJs(fs.readFileSync(path.join(root, f), 'utf8'), f);
    for (const f of ['shared/css/theme.css', 'shared/css/maple.css']) chkCss(fs.readFileSync(path.join(root, f), 'utf8'), f);
    // 壓縮後的 util.js 行為一致
    {
        const src = fs.readFileSync(path.join(root, 'shared/js/util.js'), 'utf8'), tmp = path.join(os.tmpdir(), 'util_min_e1.js'); fs.writeFileSync(tmp, mj(src));
        const U2 = require(tmp), U1 = global.Util;
        assert.deepStrictEqual(Object.keys(U2).sort(), Object.keys(U1).sort());
        assert.deepStrictEqual(U2.parseCSV('a,"b,c"\n1,2'), U1.parseCSV('a,"b,c"\n1,2')); assert.equal(U2.esc('<a&"b">'), U1.esc('<a&"b">')); assert.equal(U2.csvStringify(['a'], [['x,y']]), U1.csvStringify(['a'], [['x,y']]));
        assert.equal(U2.seeded('s').int(1000), U1.seeded('s').int(1000)); fs.unlinkSync(tmp);
    }
    assert.ok(nJs > 100 && nCss > 100 && nHtml > 100, `real files ${nJs}/${nCss}/${nHtml}`); assert.ok(outB < inB * 0.8, 'JS 平均至少縮小 20%：' + outB + '/' + inB);
    assert.ok(Date.now() - t0 < 60000, 'real files time ' + (Date.now() - t0));
    ok(`e1 code-minify: js/css/html/json minify + beautify + verify (${nJs} scripts, ${nCss} styles, ${nHtml} pages, JS ${Math.round((1 - outB / inB) * 100)}% smaller, ${Date.now() - t0}ms)`);
}

module.exports = {};
