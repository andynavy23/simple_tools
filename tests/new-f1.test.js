// 批次 f1：首頁改版（搜尋、篩選、新標籤、最近新增、主題展開）與 PWA 檔案的靜態檢查
const { load, read, ok, root } = require('./_load');
const assert = require('assert'), fs = require('fs'), path = require('path');
const m = load('index.html', 'NEW_DAYS, norm, tokens, prep, search, lev, suggest, dayNum, isNew, recentAdded, FILTERS, passFilter, pickOpen');
const { norm, tokens, prep, search, lev, suggest, isNew, recentAdded, passFilter, pickOpen } = m;

// ---------- 從 index.html 解析出卡片（和頁面內的做法一致） ----------
const html = read('index.html');
const items = [...html.matchAll(/<a class="card" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)].map(([, href, attrs, body]) => {
    const at = (k) => (attrs.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
    return { href, cat: at('cat'), topic: at('topic'), kw: at('kw') || '', added: at('added') || '', store: at('store') === '1', title: body.match(/<h2>([^<]*)<\/h2>/)[1].trim(), desc: body.match(/<p>([^<]*)<\/p>/)[1].trim(), tags: body.match(/<div class="tags">([^<]*)</)[1].trim() };
});
const P = items.map(prep);
const top = (q, n = 3) => search(P, tokens(q)).slice(0, n).map(i => items[i].href);

{ // ---------- 正規化與分詞 ----------
    assert.equal(norm('ＱＲ Code'), 'qrcode');                       // 全形、大小寫、空白
    assert.equal(norm('Base-64_x'), 'base64x'); assert.equal(norm('Ａ－Ｂ'), 'ab');   // 連字號（含全形）與底線
    assert.equal(norm(null), ''); assert.equal(norm(undefined), ''); assert.equal(norm(123), '123');
    assert.deepEqual(tokens('  發票　對獎 '), ['發票', '對獎']); assert.deepEqual(tokens(''), []); assert.deepEqual(tokens(' - _ '), []);
    assert.deepEqual(tokens('ＡＢ cd'), ['ab', 'cd']);
    ok('f1 home: norm / tokens');
}

{ // ---------- 搜尋排序 ----------
    const mk = (title, kw, desc, tags = '', cat = '工具', topic = '其他') => ({ title, kw, desc, tags, cat, topic });
    const L = [mk('其他', '', '提到計時的說明'), mk('計時器', '', ''), mk('碼表', '計時 秒表', ''), mk('標籤', '', '', '工具 · 計時')];
    const PL = L.map(prep);
    assert.deepEqual(search(PL, tokens('計時')), [1, 2, 0, 3], '標題 > 同義詞 > 說明 > 其他');
    assert.deepEqual(search(PL, tokens('計時 器')), [1], '多詞 AND：每個詞都要命中');
    assert.deepEqual(search(PL, tokens('計時 zzz')), []);
    assert.deepEqual(search(PL, []), [], '空查詢沒有結果');
    // 完全符合的同義詞 > 只包含
    const L2 = [mk('甲', '發票號碼', ''), mk('乙', '發票', '')]; assert.deepEqual(search(L2.map(prep), tokens('發票')), [1, 0]);
    // 標題開頭符合 > 標題中間符合
    const L3 = [mk('我的qr', '', ''), mk('qr工具', '', '')]; assert.deepEqual(search(L3.map(prep), tokens('QR')), [1, 0]);
    // 同分維持原順序
    const L4 = [mk('a1', '', ''), mk('a2', '', '')]; assert.deepEqual(search(L4.map(prep), tokens('a')), [0, 1]);
    // 忽略空白、連字號、全半形
    assert.deepEqual(search([mk('QR Code 產生器', '', '')].map(prep), tokens('ＱＲ-code')), [0]);
    assert.deepEqual(search([mk('QR Code 產生器', '', '')].map(prep), tokens('qrcode')), [0]);
    // kw 只在「單字」內比對，不會跨字誤判
    assert.deepEqual(search([mk('甲', '發票 對獎', '')].map(prep), tokens('票對')), []);
    // 分類與主題也可搜
    assert.deepEqual(search([mk('甲', '', '', '', '小遊戲', '棋類')].map(prep), tokens('棋類')), [0]);
    // 壞資料不會丟例外
    assert.doesNotThrow(() => prep({ title: null, kw: undefined, desc: 5, tags: '', cat: undefined, topic: null }));
    ok('f1 home: search ranking / AND / normalisation');
}

{ // ---------- 真實卡片：同義詞命中 ----------
    assert.ok(items.length >= 131, '卡片數');
    assert.equal(top('發票')[0], 'utils/lottery-check.html');
    assert.ok(top('統一發票').includes('utils/lottery-check.html'));
    for (const [q, href] of [['彩券', 'utils/lottery-check.html'], ['中獎', 'utils/lottery-check.html'], ['wordle', 'mini-games/word-guess.html'], ['hiragana', 'mini-games/kana-quiz.html'],
        ['uuid', 'utils/random-data.html'], ['crontab', 'utils/cron-parser.html'], ['小費', 'utils/split-bill.html'], ['薪水', 'utils/salary-calc.html'], ['擲筊', 'fun/divination.html'],
        ['bmi', 'utils/health-calc.html'], ['翻譯', null]]) {
        if (href) assert.ok(search(P, tokens(q)).map(i => items[i].href).includes(href), `「${q}」應找到 ${href}`);
    }
    assert.ok(top('QR code').includes('utils/qr-code.html')); assert.ok(top('ＱＲ　ＣＯＤＥ').includes('utils/qr-code.html'), '全形');
    assert.equal(top('錄音機')[0], 'utils/audio-recorder.html');
    assert.ok(search(P, tokens('計時')).length >= 5);
    assert.equal(search(P, tokens('zzzz不存在')).length, 0);
    ok('f1 home: synonym search on real cards');
}

{ // ---------- 編輯距離與「你可能想找」 ----------
    assert.equal(lev('kitten', 'sitting'), 3); assert.equal(lev('', 'abc'), 3); assert.equal(lev('abc', ''), 3); assert.equal(lev('abc', 'abc'), 0);
    assert.equal(lev('abc', 'xxabcxx', true), 0, '子字串距離'); assert.equal(lev('abd', 'xxabcxx', true), 1); assert.equal(lev('', 'abc', true), 0);
    const sg = (q) => suggest(P, q).map(i => items[i].href);
    assert.ok(sg('發漂').includes('utils/lottery-check.html'), '打錯字也找得到發票：' + sg('發漂'));
    assert.ok(sg('番茄鍾').includes('fun/pomodoro.html'));
    assert.ok(sg('regexx').includes('utils/regex-tester.html') || sg('regexx').length > 0);
    assert.ok(suggest(P, 'zzzzzzzz不存在').length === 0, '差太多就不建議');
    assert.deepEqual(suggest(P, ''), []); assert.deepEqual(suggest(P, '   '), []);
    assert.ok(suggest(P, '發漂').length <= 3); assert.ok(suggest(P, '發漂', 1).length <= 1);
    ok('f1 home: lev / suggest');
}

{ // ---------- 新標籤與最近新增 ----------
    assert.equal(isNew('2026-10-12', '2026-10-12'), true); assert.equal(isNew('2026-09-13', '2026-10-12'), true, '29 天前');
    assert.equal(isNew('2026-09-12', '2026-10-12'), false, '30 天前（不含）'); assert.equal(isNew('2026-09-12', '2026-10-11'), true);
    assert.equal(isNew('2026-10-13', '2026-10-12'), false, '未來日期不算'); assert.equal(isNew('', '2026-10-12'), false); assert.equal(isNew('壞日期', '2026-10-12'), false); assert.equal(isNew(undefined, '2026-10-12'), false);
    assert.equal(isNew('2026-12-25', '2027-01-10'), true, '跨年'); assert.equal(isNew('2026-12-25', '2027-02-10'), false);
    assert.equal(isNew('2026-10-01', '2026-10-12', 5), false); assert.equal(isNew('2026-10-10', '2026-10-12', 5), true);
    assert.equal(isNew('2026-10-12', 'bad'), false);
    const L = [{ title: 'b', added: '2026-10-01' }, { title: 'a', added: '2026-10-01' }, { title: 'c', added: '2026-10-05' }, { title: 'x', added: '' }, { title: 'y', added: '2026-13-45x' }];
    assert.deepEqual(recentAdded(L, 8).map(i => i.title), ['c', 'a', 'b'], '新到舊、同日依標題、無效日期不列');
    assert.deepEqual(recentAdded(L, 2).map(i => i.title), ['c', 'a']); assert.deepEqual(recentAdded([], 8), []);
    const ra = recentAdded(items, 8); assert.equal(ra.length, 8);
    for (let i = 1; i < ra.length; i++) assert.ok(m.dayNum(ra[i - 1].added) >= m.dayNum(ra[i].added));
    ok('f1 home: isNew / recentAdded');
}

{ // ---------- 篩選 ----------
    const t = (tags, desc = '', store = false) => ({ tags, desc, store });
    assert.equal(passFilter(t('工具 · 離線'), 'all'), true); assert.equal(passFilter(t('x'), 'zzz'), true, '未知值視為全部');
    assert.equal(passFilter(t('小遊戲 · 多人連線'), 'net'), true); assert.equal(passFilter(t('小遊戲 · 雙人連線'), 'net'), true); assert.equal(passFilter(t('工具 · 離線'), 'net'), false);
    assert.equal(passFilter(t('小遊戲 · 單機'), 'solo'), true); assert.equal(passFilter(t('小遊戲 · 多人連線', '… 單機：單機對電腦'), 'solo'), true, '連線遊戲的單機模式'); assert.equal(passFilter(t('工具'), 'solo'), false);
    assert.equal(passFilter(t('工具', '', true), 'store'), true); assert.equal(passFilter(t('工具'), 'store'), false);
    const n = (f) => items.filter(i => passFilter(i, f)).length;
    assert.ok(n('net') >= 10 && n('net') < 60, '連線 ' + n('net')); assert.ok(n('solo') >= 10); assert.ok(n('store') >= 40); assert.ok(n('all') >= 131);
    ok('f1 home: filters');
}

{ // ---------- 主題預設展開 ----------
    const mk = (topic, href) => ({ topic, href }), small = [mk('A', 'a1'), mk('B', 'b1')];
    assert.deepEqual([...pickOpen(['A', 'B'], small, [])], ['A', 'B'], '≤ 12 個全部展開');
    const big = [...Array(7).fill(0).map((_, i) => mk('A', 'a' + i)), ...Array(6).fill(0).map((_, i) => mk('B', 'b' + i))];
    assert.deepEqual([...pickOpen(['A', 'B'], big, [])], ['A'], '> 12 個只開第一個');
    assert.deepEqual([...pickOpen(['A', 'B'], big, ['zzz', 'b3', 'a1'])], ['B'], '最近用過的主題優先（取最近一筆有效的）');
    assert.deepEqual([...pickOpen(['A', 'B'], big, ['nope'])], ['A']);
    assert.equal(pickOpen(['A'], Array(12).fill(mk('A', 'x')), []).size, 1);
    ok('f1 home: pickOpen');
}

{ // ---------- 卡片屬性規範 ----------
    const toolsMd = read('TOOLS.md'), hasKeys = {};
    for (const line of toolsMd.split(/\r?\n/)) { const r = line.match(/^\|\s*\[[^\]]*\]\(([^)]+)\)\s*\|(.*)$/); if (r) { const k = (r[2].split('|')[1] || '').trim(); hasKeys[r[1]] = k !== '' && k !== '—'; } }
    const hrefs = new Set();
    for (const it of items) {
        const w = it.kw.trim().split(/\s+/).filter(Boolean);
        assert.ok(w.length >= 4 && w.length <= 10, `${it.href} data-kw 要 4–10 個詞（現在 ${w.length}）`);
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(it.added) && !isNaN(m.dayNum(it.added)), `${it.href} data-added 格式`);
        assert.equal(it.store, !!hasKeys[it.href], `${it.href} data-store 要和 TOOLS.md 的本機資料欄一致`);
        assert.ok(!hrefs.has(it.href), '重複的 href ' + it.href); hrefs.add(it.href);
    }
    ok('f1 home: every card has data-kw / data-added / data-store');
}

{ // ---------- PWA 檔案 ----------
    const sw = read('sw.js'), ver = sw.match(/const CACHE_VERSION = '([^']+)'/)[1];
    assert.ok(html.includes(`const SW_CACHE = 'st-${ver}'`), 'index.html 的 SW_CACHE 要和 sw.js 的 CACHE_VERSION 一致');
    const mf = JSON.parse(read('manifest.webmanifest'));
    assert.equal(mf.name, 'Simple Tools'); assert.equal(mf.start_url, './'); assert.equal(mf.display, 'standalone');
    assert.ok(mf.icons.some(i => i.sizes === '192x192') && mf.icons.some(i => i.sizes === '512x512') && mf.icons.some(i => i.purpose === 'maskable'));
    for (const i of mf.icons) assert.ok(fs.existsSync(path.join(root, i.src)), '缺圖示 ' + i.src);
    assert.ok(fs.existsSync(path.join(root, 'assets/icons/apple-touch-icon.png')));
    for (const f of ['<link rel="manifest" href="manifest.webmanifest">', 'rel="apple-touch-icon"', 'apple-mobile-web-app-capable']) assert.ok(html.includes(f), f);
    // sw 預快取的檔案都存在；不處理跨來源與非 GET
    const core = JSON.parse(sw.match(/const CORE = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    for (const f of core) if (f !== './') assert.ok(fs.existsSync(path.join(root, f)), 'sw 預快取不存在的檔案 ' + f);
    assert.ok(/r\.method !== 'GET' \|\| u\.origin !== location\.origin/.test(sw));
    assert.ok(/<template id="help">/.test(html) && html.includes('加入主畫面'));
    assert.match(html, /<meta name="st-keys" content="\*">/);
    ok('f1 home: PWA files (manifest / sw / icons / help)');
}
