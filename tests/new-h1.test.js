// 批次 h1：簡繁轉換（utils/hanzi-convert.html）的資料完整性與轉換邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/hanzi-convert.html', 'convert, convertText, resultText, cleanOpts, S2T_TXT, T2S_TXT, AMB_S, AMB_T, PH_S, PH_T, TW_S, TW_R, MAX, parseChars, parsePairs, TABLE');
const { convert, convertText: cv, resultText, cleanOpts, TABLE, MAX } = m;
const cps = (s) => Array.from(s);
const firstKeys = (txt) => txt.split(' ').map(t => cps(t)[0]);
const pairKeys = (txt) => txt.split(' ').map(t => t.split('>')[0]);
const dups = (a) => a.filter((x, i) => a.indexOf(x) !== i);

{ // ---------- 資料完整性 ----------
    assert.deepStrictEqual(dups(firstKeys(m.S2T_TXT)), [], '簡→繁字表有重複鍵');
    assert.deepStrictEqual(dups(firstKeys(m.T2S_TXT)), [], '繁→簡字表有重複鍵');
    assert.deepStrictEqual(dups(pairKeys(m.PH_S)), [], '簡→繁詞組有重複鍵');
    assert.deepStrictEqual(dups(pairKeys(m.PH_T)), [], '繁→簡詞組有重複鍵');
    assert.deepStrictEqual(dups(pairKeys(m.TW_S)), [], '台灣用詞有重複鍵');
    assert.deepStrictEqual(dups(pairKeys(m.TW_R)), [], '台灣用詞（反向）有重複鍵');
    for (const txt of [m.PH_S, m.PH_T, m.TW_S, m.TW_R]) for (const p of txt.split(' ')) assert.ok(/^[^>\s]+>[^>\s]+$/.test(p), '詞組格式：' + p);
    for (const t of m.PH_S.split(' ').concat(m.PH_T.split(' '))) { const [k, v] = t.split('>'); assert.strictEqual(cps(k).length, cps(v).length, '詞組長度不一致：' + t); assert.ok(cps(k).length >= 2, '詞組至少兩字：' + t); }
    assert.ok(TABLE.s2t.chars.size >= 3000, '簡→繁字表組數：' + TABLE.s2t.chars.size);
    assert.ok(TABLE.t2s.chars.size >= 3000, '繁→簡字表組數：' + TABLE.t2s.chars.size);
    assert.ok(TABLE.s2t.ph.size >= 200, '詞組表太少');
    const tw = TABLE.s2t.tw.size; assert.ok(tw >= 100 && tw <= 400, '台灣用詞條數：' + tw);
    // 標示歧義的字一定有 2 個以上候選
    for (const c of cps(m.AMB_S)) assert.ok((TABLE.s2t.chars.get(c) || []).length > 1, '標示字沒有多個候選：' + c);
    for (const c of cps(m.AMB_T)) assert.ok((TABLE.t2s.chars.get(c) || []).length > 1, '標示字沒有多個候選（繁→簡）：' + c);
    // 每個標示字的每個非預設候選，都至少有一條詞組能選到它（詞組表涵蓋典型例子）
    for (const c of cps(m.AMB_S)) for (const a of TABLE.s2t.chars.get(c).slice(1)) {
        assert.ok([...TABLE.s2t.ph].some(([k, v]) => k.includes(c) && v.includes(a)), `詞組表沒有涵蓋「${c}」→「${a}」`);
    }
    ok('hanzi: 字表無重複鍵、格式與數量、標示字有候選、詞組涵蓋所有非預設候選');
}

{ // ---------- 往返：一簡一繁必須還原 ----------
    let n = 0;
    for (const [k, c] of TABLE.s2t.chars) {
        if (c.length !== 1 || c[0] === k || k === '着') continue;   // 着 → 著：繁 → 簡的「著」保留（著名、著作）
        n++;
        assert.strictEqual(cv(cv(k, 's2t'), 't2s'), k, `一簡一繁往返失敗：${k} → ${c[0]}`);
    }
    assert.ok(n >= 2500, '一簡一繁組數：' + n);
    // 所有繁→簡的單一對應，轉回繁體後的預設字不能是空字或多字
    for (const [k, c] of TABLE.s2t.chars) for (const x of c) assert.strictEqual(cps(x).length, 1, '候選必須是單一字：' + k);
    for (const [k, c] of TABLE.t2s.chars) for (const x of c) assert.strictEqual(cps(x).length, 1, '候選必須是單一字：' + k);
    ok(`hanzi: 簡→繁→簡往返 ${n} 組一簡一繁字全部還原`);
}

{ // ---------- 詞組與最長匹配 ----------
    const S = (s, tw) => cv(s, 's2t', tw), T = (s, tw) => cv(s, 't2s', tw);
    const cases = [
        ['头发', '頭髮'], ['发展', '發展'], ['干净', '乾淨'], ['干部', '幹部'], ['面条', '麵條'], ['表面', '表面'], ['皇后', '皇后'], ['以后', '以後'],
        ['这里', '這裡'], ['公里', '公里'], ['里面', '裡面'], ['干涉', '干涉'], ['饼干', '餅乾'], ['复杂', '複雜'], ['恢复', '恢復'], ['答复', '答覆'], ['反复', '反覆'],
        ['台湾', '台灣'], ['平台', '平臺'], ['台风', '颱風'], ['柜台', '櫃檯'], ['周末', '週末'], ['周围', '周圍'], ['一周', '一週'], ['制度', '制度'], ['制造', '製造'],
        ['杂志', '雜誌'], ['标志', '標誌'], ['日历', '日曆'], ['历史', '歷史'], ['放松', '放鬆'], ['松树', '松樹'], ['后天', '後天'], ['发现', '發現'], ['理发', '理髮'],
        ['面包', '麵包'], ['方便面', '方便麵'], ['书签', '書簽'], ['胡子', '鬍子'], ['胡说', '胡說'], ['了解', '了解'], ['一只猫', '一隻貓'], ['只有', '只有'], ['游泳', '游泳'], ['旅游', '旅遊'],
        ['手表', '手錶'], ['表示', '表示'], ['心脏', '心臟'], ['脏话', '髒話'], ['余额', '餘額'], ['其余', '其餘'], ['占卜', '占卜'], ['占领', '佔領'], ['凶手', '兇手'], ['吉凶', '吉凶'],
        ['着手', '著手'], ['为什么', '為什麼'], ['汉字', '漢字'], ['软件', '軟件'], ['网络', '網絡'],
    ];
    for (const [a, b] of cases) assert.strictEqual(S(a), b, a);
    // 最長匹配：長詞組蓋過短詞組
    assert.strictEqual(S('千钧一发'), '千鈞一髮'); assert.strictEqual(S('发'), '發'); assert.strictEqual(S('白发三千丈'), '白髮三千丈');
    assert.strictEqual(S('万里长城'), '萬里長城'); assert.strictEqual(S('万里'), '萬里'); assert.strictEqual(S('里'), '裡');
    // 每條詞組放在中性字（ASCII）之間仍原樣轉換
    for (const [k, v] of TABLE.s2t.ph) assert.strictEqual(S('x' + k + 'x'), 'x' + v + 'x', k);
    for (const [k, v] of TABLE.t2s.ph) assert.strictEqual(T('x' + k + 'x'), 'x' + v + 'x', k);
    // 繁 → 簡
    for (const [a, b] of [['頭髮', '头发'], ['乾坤', '乾坤'], ['乾淨', '干净'], ['後面', '后面'], ['裡面', '里面'], ['麵條', '面条'], ['答覆', '答复'], ['憑藉', '凭借'], ['著名', '著名'], ['幹部', '干部'], ['發展', '发展'], ['臺灣', '台湾'], ['什麼', '什么'], ['瞭望', '瞭望'], ['瞭解', '了解'], ['乾隆', '乾隆']]) assert.strictEqual(T(a), b, a);
    ok(`hanzi: ${cases.length} 組語境例子、最長匹配、每條詞組（簡→繁 ${TABLE.s2t.ph.size}、繁→簡 ${TABLE.t2s.ph.size}）行為正確`);
}

{ // ---------- 台灣用詞 ----------
    for (const [k, v] of TABLE.s2t.tw) assert.strictEqual(cv('x' + k + 'x', 's2t', true), 'x' + v + 'x', k);
    for (const [k, v] of TABLE.t2s.tw) assert.strictEqual(cv('x' + k + 'x', 't2s', true), 'x' + v + 'x', k);
    for (const [a, b] of [['软件', '軟體'], ['内存', '記憶體'], ['鼠标', '滑鼠'], ['网络', '網路'], ['硬盘', '硬碟'], ['信息', '資訊'], ['程序员', '程式設計師'], ['服务器', '伺服器'], ['出租车', '計程車'], ['塑料', '塑膠'], ['激光', '雷射'], ['线程', '執行緒'], ['数据库', '資料庫']]) assert.strictEqual(cv(a, 's2t', true), b, a);
    assert.strictEqual(cv('软件', 's2t', false), '軟件');                     // 沒勾時只轉字
    for (const [a, b] of [['軟體', '软件'], ['記憶體', '内存'], ['滑鼠', '鼠标'], ['網路', '网络'], ['計程車', '出租车'], ['伺服器', '服务器']]) assert.strictEqual(cv(a, 't2s', true), b, a);
    assert.strictEqual(cv('軟體', 't2s', false), '软体');
    // 不勾台灣用詞時，繁 → 簡不碰詞彙；勾了的反向詞組不能有爭議詞
    for (const bad of ['資料', '檔案', '文件', '電腦', '資訊', '行程', '執行', '設定']) assert.ok(!TABLE.t2s.tw.has(bad), '反向詞組不應收：' + bad);
    // 台灣用詞來回：簡體說法 → 台灣說法 → 簡體說法
    for (const [trad, simp] of TABLE.t2s.tw) { assert.strictEqual(cv(simp, 's2t', true), trad, simp); assert.strictEqual(cv(trad, 't2s', true), simp, trad); }
    ok(`hanzi: 台灣用詞 ${TABLE.s2t.tw.size} 條正向、${TABLE.t2s.tw.size} 條反向，且互相來回一致`);
}

{ // ---------- 歧義標示、保留非中文、上限、選項驗證 ----------
    let r = convert('台', 's2t', false);
    assert.deepStrictEqual(r.out, ['台']); assert.deepStrictEqual([...r.amb.keys()], [0]); assert.deepStrictEqual(r.amb.get(0), ['台', '臺', '檯', '颱']);
    r = convert('这里的发', 's2t', false);
    assert.strictEqual(resultText(r), '這裡的發'); assert.strictEqual(r.amb.size, 2);
    assert.strictEqual(resultText(r, new Map([[1, 1]])), '這里的發', '候選序號');   // 里 的第 2 個候選
    r = convert('头发干净', 's2t', false); assert.strictEqual(r.amb.size, 0, '詞組判斷得出來就不標歧義');
    assert.ok(convert('干', 's2t', false).amb.size === 1);
    // 保留非中文字元、標點、換行與空白
    const keep = 'abc 123\r\n\t，。！？「」…  😀 ΑΒΓ ひらがな\n\n';
    assert.strictEqual(cv(keep, 's2t'), keep); assert.strictEqual(cv(keep, 't2s'), keep);
    assert.strictEqual(cv('😀头发😀\n后', 's2t'), '😀頭髮😀\n後');
    assert.strictEqual(cv('', 's2t'), '');
    // 字數與統計
    r = convert('头发abc发展', 's2t', false); assert.strictEqual(r.total, 7); assert.strictEqual(r.words, 1); assert.strictEqual(r.changed, 3);
    // 上限
    r = convert('头'.repeat(MAX + 50), 's2t'); assert.strictEqual(r.cut, true); assert.strictEqual(r.total, MAX); assert.strictEqual(r.out.length, MAX);
    r = convert('头'.repeat(MAX), 's2t'); assert.strictEqual(r.cut, false);
    // 200,000 字的效能（含詞組、歧義）
    const big = '我的头发很长，发展很快。干净的面条、干部、皇后以后会发布软件。里面'.repeat(Math.ceil(MAX / 33));
    const t0 = Date.now(); r = convert(big, 's2t', true); const ms = Date.now() - t0;
    assert.strictEqual(r.total, MAX); assert.ok(ms < 4000, '200,000 字轉換太慢：' + ms + 'ms');
    // 選項驗證容錯
    assert.deepStrictEqual(cleanOpts(null), { dir: 's2t', tw: false });
    assert.deepStrictEqual(cleanOpts([1]), { dir: 's2t', tw: false });
    assert.deepStrictEqual(cleanOpts('x'), { dir: 's2t', tw: false });
    assert.deepStrictEqual(cleanOpts({ dir: 'zz', tw: 'yes' }), { dir: 's2t', tw: false });
    assert.deepStrictEqual(cleanOpts({ dir: 't2s', tw: true }), { dir: 't2s', tw: true });
    assert.deepStrictEqual(cleanOpts({ dir: 't2s', extra: 1 }), { dir: 't2s', tw: false });
    ok(`hanzi: 歧義標示、保留非中文、200,000 字上限（耗時 ${ms}ms）、選項驗證容錯`);
}
