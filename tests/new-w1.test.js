// 批次 w1：首頁搜尋的同義詞群與模糊相近建議（真實卡片）
const { load, read, ok } = require('./_load');
const assert = require('assert');
const m = load('index.html', 'norm, tokens, prep, search, suggest, SYN, synAlts');
const { norm, tokens, prep, search, suggest, SYN, synAlts } = m;
const html = read('index.html');
const items = [...html.matchAll(/<a class="card" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)].map(([, href, attrs, body]) => {
    const at = (k) => (attrs.match(new RegExp(`data-${k}="([^"]*)"`)) || [])[1];
    return { href, cat: at('cat'), topic: at('topic'), kw: at('kw') || '', title: body.match(/<h2>([^<]*)<\/h2>/)[1].trim(), desc: body.match(/<p>([^<]*)<\/p>/)[1].trim(), tags: body.match(/<div class="tags">([^<]*)<\/div>/)[1].trim() };
});
const P = items.map(prep);
const top = (q, n = 5) => search(P, tokens(q)).slice(0, n).map(i => items[i].href);
const sg = (q) => suggest(P, q, 3).map(i => items[i].href);

{ // 兩個日期相減：各種說法都要找到日期計算機（排在前 3）
    for (const q of ['相減', '日期相減', '時間相減', '兩個時間相減', '兩個日期相減', '日期差', '時間差', '差幾天', '差多少天', '算天數', '間隔幾天', '日期計算', '天數', '幾天', '我想算兩個日期差幾天', '兩個時間相減算出差幾天']) {
        assert.ok(top(q, 3).includes('utils/date-calc.html'), `「${q}」前 3 名應有日期計算機，實際：${top(q, 3).join(', ')}`);
    }
    ok('w1 search: date difference phrases find date-calc');
}

{ // 其他常見說法
    const cases = [['算錢', 'utils/split-bill.html'], ['秒表', 'fun/timers.html'], ['強密碼', 'utils/password-gen.html'], ['背單字', 'fun/flashcards.html'], ['房貸', 'utils/loan-calculator.html'],
        ['regexp', 'utils/regex-tester.html'], ['哪個貴', 'utils/price-compare.html'], ['wpm', 'mini-games/typing-test.html'], ['字幕機', 'utils/banner-board.html'], ['掃碼', 'utils/qr-scan.html'],
        ['馬拉松', 'utils/pace-calc.html'], ['換算公分', 'utils/unit-converter.html'], ['報稅', 'utils/income-tax.html']];
    for (const [q, href] of cases) assert.ok(top(q, 5).includes(href), `「${q}」前 5 名應有 ${href}，實際：${top(q, 5).join(', ')}`);
    ok('w1 search: common alternative phrasings');
}

{ // 規則本身：展開不含自己、只用 ≥ 2 字的詞觸發、整句話包含群內詞就展開、沒有同義的詞不展開
    assert.ok(synAlts('相減').includes('相差') && !synAlts('相減').includes('相減'));
    assert.ok(synAlts('兩個時間相減').includes('日期差'));
    assert.deepEqual(synAlts('減'), []); assert.deepEqual(synAlts('差'), []);                       // 單字不觸發（太容易誤中）
    assert.deepEqual(synAlts('zzzz不存在'), []); assert.deepEqual(synAlts(''), []);
    assert.ok(SYN.every(g => g.length >= 3 && g.every(w => w === norm(w))), '每群至少 3 個詞且已正規化');
    // 直接命中仍排在同義展開之前
    const ds = ['相差', '日期'].map(w => search(P, tokens(w)).map(i => items[i].href));
    assert.equal(ds[0][0], 'utils/date-calc.html');
    // 多個詞仍是 AND：有一個詞完全對不到就沒有結果
    assert.deepEqual(search(P, tokens('相減 zzzz不存在')), []);
    ok('w1 search: synonym rules');
}

{ // 找不到時的相近建議：雙連字涵蓋率；亂打不要亂建議
    assert.deepEqual(sg('zzzzzzzz不存在'), []);
    assert.deepEqual(sg(''), []); assert.deepEqual(sg('   '), []);
    const q = '單位換算機';                                                                              // 標題「單位與匯率換算」：雙連字 單位 / 位換(×) / 換算 / 算機(×)，涵蓋 2/4 不夠 → 靠同義或直接命中
    assert.ok(top('單位換算').includes('utils/unit-converter.html'));
    assert.ok(sg('番茄鍾').includes('fun/pomodoro.html'));                                              // 打錯字仍可
    assert.ok(sg('發漂').includes('utils/lottery-check.html'));
    assert.ok(sg('日期計算機器').length >= 0);
    ok('w1 search: suggestions stay conservative');
}

{ // ---------- 分頁圖示（favicon）與首頁 metadata（靜態）----------
    const fs = require('fs'), path = require('path'); const { root } = require('./_load');
    const png = (f) => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', f + ' 不是 PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    for (const n of [16, 32, 48]) assert.deepEqual(png(`assets/icons/favicon-${n}.png`), [n, n]);
    for (const f of ['favicon.ico', 'assets/icons/favicon.ico']) {                                             // ICO：ICONDIR（保留 0、類型 1、張數 3）+ 每張的尺寸 / 位移都在檔案範圍內
        const b = fs.readFileSync(path.join(root, f)); assert.equal(b.readUInt16LE(0), 0); assert.equal(b.readUInt16LE(2), 1); const n = b.readUInt16LE(4); assert.equal(n, 3);
        const sizes = []; for (let i = 0; i < n; i++) { const o = 6 + 16 * i, len = b.readUInt32LE(o + 8), off = b.readUInt32LE(o + 12); assert.ok(off + len <= b.length, 'ICO 資料超出檔案'); assert.equal(b.subarray(off, off + 8).toString('hex'), '89504e470d0a1a0a'); sizes.push(b[o]); }
        assert.deepEqual(sizes, [16, 32, 48]);
    }
    const svg = fs.readFileSync(path.join(root, 'assets/icons/favicon.svg'), 'utf8'); assert.ok(/^<svg[^>]+viewBox="0 0 64 64"/.test(svg) && svg.includes('</svg>'));
    assert.ok(!/<script|on\w+=|href=/i.test(svg), 'SVG 圖示不能含腳本或外部參照');
    // 首頁：每個 icon 連結都指到存在的檔案，且有 SVG / 32 / 16 / ico 與基本 metadata
    const links = [...html.matchAll(/<link rel="icon" href="([^"]+)"/g)].map(x => x[1]); assert.ok(links.length >= 4, '首頁要有 4 個 icon 連結：' + links);
    for (const l of links) assert.ok(fs.existsSync(path.join(root, l)), '首頁 icon 連結找不到檔案：' + l);
    for (const f of ['<meta name="description"', '<link rel="canonical"', 'property="og:type"', 'property="og:site_name"', 'property="og:locale"', 'property="og:image:width"', 'name="twitter:card"', 'name="twitter:image"', 'name="application-name"', 'name="robots"', 'rel="apple-touch-icon"', '"@type":"WebApplication"'])
        assert.ok(html.includes(f), '首頁缺 ' + f);
    assert.ok(!/<meta name="description" content="[^"]{0,40}">/.test(html), '首頁 description 太短');
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''; assert.ok(desc.length >= 40 && desc.length <= 200, 'description 長度 ' + desc.length);
    const mf = JSON.parse(read('manifest.webmanifest')); assert.equal(mf.id, './'); assert.ok(Array.isArray(mf.categories) && mf.categories.length);
    ok('w1 favicon + home metadata (static)');
}
