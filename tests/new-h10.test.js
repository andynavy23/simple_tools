// h10 批次：screen-test（剪貼簿 / 通知 / 色域 / 觸控 / 輪詢率 / 裝置速查 / 修飾鍵）與 timestamp（民國年、中文日期、Intl 預覽）的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- screen-test ----------
{
    const S = load('utils/screen-test.html', 'clipInfo, fmtBytes, notifyInfo, gamutInfo, fmtPoints, rateStats, DEVICES, matchDevices, deviceQuery, modKeys, validTab, TABS');
    // clipInfo
    const dt = { types: ['text/plain', 'text/html', 'Files'], getData: (t) => ({ 'text/plain': 'hi', 'text/html': '<script>alert(1)</script><b>x</b>' }[t] || ''), files: [{ name: 'a.png', type: 'image/png', size: 2048 }, { name: '', type: '', size: 0 }] };
    let r = S.clipInfo(dt);
    assert.deepStrictEqual(r.types, ['text/plain', 'text/html', 'Files']);
    assert.strictEqual(r.texts.length, 2);                                   // Files 不當文字
    assert.strictEqual(r.texts[1].text, '<script>alert(1)</script><b>x</b>'); // HTML 原樣當文字
    assert.strictEqual(r.files[0].size, 2048); assert.strictEqual(r.files[1].name, '（未命名）'); assert.strictEqual(r.files[1].type, '（未知類型）');
    r = S.clipInfo({ types: ['text/plain'], getData: () => 'x'.repeat(30), files: [] }, 10);
    assert.strictEqual(r.texts[0].text.length, 10); assert.ok(r.texts[0].cut); assert.strictEqual(r.texts[0].len, 30);
    assert.deepStrictEqual(S.clipInfo(null), { types: [], texts: [], files: [] });
    assert.strictEqual(S.clipInfo({ types: ['x'], getData: () => { throw new Error('no'); } }).texts[0].len, 0);   // getData 丟例外也不壞
    assert.strictEqual(S.fmtBytes(512), '512 B'); assert.strictEqual(S.fmtBytes(2048), '2.0 KB'); assert.strictEqual(S.fmtBytes(3 * 1048576), '3.00 MB');

    // notifyInfo
    const IPH = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
    let n = S.notifyInfo({ ua: IPH, isSecureContext: true });
    assert.ok(!n.supported && n.ios && n.needHome && n.tips[0].includes('加入主畫面') && n.permission === 'unsupported');
    n = S.notifyInfo({ Notification: { permission: 'default' }, ua: IPH, isSecureContext: true, standalone: false });
    assert.ok(n.supported && n.needHome && n.tips.some(t => t.includes('加入主畫面')));
    n = S.notifyInfo({ Notification: { permission: 'granted' }, ua: IPH, isSecureContext: true, standalone: true });
    assert.ok(!n.needHome && n.tips.length === 0 && n.rows.find(x => x[0] === '權限狀態')[1] === '已允許');
    n = S.notifyInfo({ ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', Notification: undefined });
    assert.ok(!n.supported && !n.ios && n.tips[0].includes('沒有 Notification API'));
    n = S.notifyInfo({ Notification: { permission: 'denied' }, ua: 'x', isSecureContext: false });
    assert.ok(n.tips.some(t => t.includes('https')) && n.tips.some(t => t.includes('封鎖')));
    assert.ok(S.notifyInfo({ ua: 'x', platform: 'MacIntel', maxTouchPoints: 5 }).ios);   // iPadOS 偽裝成 Mac
    assert.ok(!S.notifyInfo({ ua: 'x', platform: 'MacIntel', maxTouchPoints: 0 }).ios);
    assert.ok(S.notifyInfo({ Notification: { permission: 'default' }, ua: 'Android 14 Chrome', isSecureContext: true }).tips.some(t => t.includes('Service Worker')));
    assert.doesNotThrow(() => S.notifyInfo(undefined));

    // gamutInfo
    const mqOf = (set) => (q) => set.has(q);
    let g = S.gamutInfo(mqOf(new Set(['(color-gamut: srgb)'])));
    assert.strictEqual(g.gamut, 'sRGB（標準）'); assert.strictEqual(g.hdr, false);
    g = S.gamutInfo(mqOf(new Set(['(color-gamut: srgb)', '(color-gamut: p3)', '(dynamic-range: high)'])));
    assert.ok(g.gamut.startsWith('Display P3')); assert.ok(g.hdr);
    g = S.gamutInfo(mqOf(new Set(['(color-gamut: srgb)', '(color-gamut: p3)', '(color-gamut: rec2020)'])));
    assert.ok(g.gamut.startsWith('Rec.2020'));
    assert.strictEqual(S.gamutInfo(() => undefined).gamut, '無法判斷');
    assert.ok(S.gamutInfo(() => undefined).rows.every(x => x[1] === '（不支援查詢）' || x[0] === '最廣支援色域'));
    assert.ok(S.gamutInfo(() => { throw new Error('x'); }).rows.length >= 8);
    assert.strictEqual(S.gamutInfo(mqOf(new Set(['(prefers-color-scheme: dark)']))).rows.find(x => x[0].startsWith('prefers-color-scheme'))[1], '是');

    // fmtPoints
    const pts = new Map([[3, { x: 10.4, y: 20.6, pressure: 0.5, w: 30, h: 28, type: 'touch' }], [7, { x: 0, y: 0, pressure: 0, w: 1, h: 1, type: 'mouse' }]]);
    const lines = S.fmtPoints(pts);
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0], '#1（touch id 3）x 10, y 21　壓力 0.50　接觸 30×28');
    assert.strictEqual(lines[1], '#2（mouse id 7）x 0, y 0');
    assert.deepStrictEqual(S.fmtPoints(new Map()), []);

    // rateStats
    const seq = (dt, n) => Array.from({ length: n }, (_, i) => i * dt);
    let st = S.rateStats(seq(1, 100)); assert.strictEqual(st.medianHz, 1000); assert.strictEqual(st.nearest, 1000);
    st = S.rateStats(seq(8, 100)); assert.strictEqual(st.medianHz, 125); assert.strictEqual(st.nearest, 125);
    st = S.rateStats(seq(16.67, 50)); assert.ok(Math.abs(st.medianHz - 60) <= 1); assert.strictEqual(st.nearest, 60);
    assert.strictEqual(S.rateStats(seq(1, 5)), null);          // 資料不足
    assert.strictEqual(S.rateStats([]), null); assert.strictEqual(S.rateStats([5, 5, 5, 5, 5, 5, 5]), null);   // 全是 0 間隔
    assert.strictEqual(S.rateStats(seq(200, 20)), null);       // 間隔太大視為停頓
    st = S.rateStats([...seq(2, 50), 5000, 5002, 5004, 5006, 5008, 5010, 5012]); assert.strictEqual(st.medianHz, 500);   // 停頓不計
    assert.strictEqual(S.rateStats(seq(3, 100)).nearest, null);   // 333 Hz 不接近常見值

    // 裝置清單
    for (const d of S.DEVICES) {
        assert.ok(d.length === 6 && d[2] > 0 && d[3] > 0 && d[4] >= 1, d[1]);
        assert.ok(d[3] > d[2] || d[0] === '筆電 / 桌機' || d[1].includes('iPad'), d[1] + ' 應為直向');
    }
    const names = S.DEVICES.map(d => d[1]); assert.strictEqual(new Set(names).size, names.length);
    assert.deepStrictEqual(S.matchDevices(S.DEVICES, 390, 844, 3).map(i => S.DEVICES[i][2]), [390]);
    assert.deepStrictEqual(S.matchDevices(S.DEVICES, 844, 390, 3).length, 1);          // 橫向也符合
    assert.strictEqual(S.matchDevices(S.DEVICES, 390, 844, 2).length, 0);              // 像素比不同
    assert.strictEqual(S.matchDevices(S.DEVICES, 412, 915, 2.625).length, 1);
    assert.strictEqual(S.matchDevices(S.DEVICES, 1920, 1080, 1).length, 1);
    assert.strictEqual(S.matchDevices(S.DEVICES, 1, 1, 1).length, 0);
    const d390 = S.DEVICES.find(d => d[2] === 390);
    assert.strictEqual(S.deviceQuery(d390, 'max'), '@media (max-width: 390px) { }');
    assert.strictEqual(S.deviceQuery(d390, 'device'), '@media (device-width: 390px) and (device-height: 844px) and (resolution: 3dppx) { }');
    assert.ok(S.deviceQuery(S.DEVICES.find(d => d[4] === 2.625), 'device').includes('2.625dppx'));

    // 修飾鍵
    assert.strictEqual(S.modKeys({}), '無');
    assert.strictEqual(S.modKeys({ ctrlKey: true, shiftKey: true }), 'Ctrl+Shift');
    assert.strictEqual(S.modKeys({ ctrlKey: true, shiftKey: true, altKey: true, metaKey: true }), 'Ctrl+Shift+Alt+Meta');

    // 分頁白名單向下相容
    for (const t of ['screen', 'kb', 'mouse', 'ppi', 'cam', 'mic', 'env']) assert.strictEqual(S.validTab(t), t);
    for (const t of ['clip', 'notify', 'gamut', 'touch', 'rate', 'dev']) assert.strictEqual(S.validTab(t), t);
    for (const t of ['bogus', null, undefined, 5, {}]) assert.strictEqual(S.validTab(t), 'screen');
    ok('screen-test h10');
}

// ---------- timestamp ----------
{
    const T = load('utils/timestamp.html', 'normCnDate, rocText, parseTimeLine, batchRows, batchTsv, intlFmt, intlLocaleRows, intlZoneRows, intlMatrix, intlTsv, INTL_LOCALES, INTL_STYLES');
    const TW = 'Asia/Taipei', ms = Date.UTC(2024, 4, 20, 0, 30, 0);   // 2024-05-20 08:30 台北
    // 民國年
    for (const s of ['113/05/20 08:30', '113-5-20 8:30', '113.05.20 08:30:00', '民國113年5月20日 08:30', '民國 113 年 5 月 20 日 08:30', '113年5月20日 08:30', '民國113/5/20 08:30']) {
        const r = T.parseTimeLine(s, TW); assert.ok(r.ok, s + ' ' + r.reason); assert.strictEqual(r.ms, ms, s); assert.strictEqual(r.kind, '民國年日期', s);
    }
    assert.strictEqual(T.parseTimeLine('113/05/20', TW).ms, Date.UTC(2024, 4, 19, 16, 0, 0));          // 沒寫時間 = 當日 00:00（台北）
    assert.strictEqual(T.parseTimeLine('民國1年1月1日', 'UTC').ms, Date.UTC(1912, 0, 1));
    assert.strictEqual(T.parseTimeLine('民國99年12月31日', 'UTC').ms, Date.UTC(2010, 11, 31));
    assert.strictEqual(T.parseTimeLine('99/12/31', 'UTC').ms, Date.UTC(2010, 11, 31));                  // 2 位數年份也視為民國
    // 中文日期（西元）
    for (const s of ['2024年5月20日 08:30', '2024年05月20日 08:30:00', '2024 年 5 月 20 日 8:30']) {
        const r = T.parseTimeLine(s, TW); assert.ok(r.ok, s); assert.strictEqual(r.ms, ms); assert.strictEqual(r.kind, '中文日期');
    }
    // 錯誤
    for (const s of ['民國113年2月30日', '113/13/01', '民國0年1月1日', '民國113年5月20日 25:00']) assert.ok(!T.parseTimeLine(s, TW).ok, s);
    assert.ok(T.parseTimeLine('五月二十日', TW).reason.includes('中文數字'));
    assert.ok(T.parseTimeLine('二〇二四年五月二十日', TW).reason.includes('中文數字'));
    assert.ok(!T.parseTimeLine('5月20日', TW).ok);                      // 缺年份
    assert.ok(!T.parseTimeLine('5/20/113', TW).ok);
    assert.ok(!T.parseTimeLine('民國2024年5月20日', TW).ok);             // 民國 + 4 位數不合理
    assert.ok(!T.parseTimeLine('5/20/24', TW).ok);
    // 原有行為不變
    assert.strictEqual(T.parseTimeLine('1700000000', TW).ms, 1700000000000);
    assert.strictEqual(T.parseTimeLine('113', TW).kind, '秒時間戳');         // 純數字仍是時間戳
    assert.strictEqual(T.parseTimeLine('2024-05-20 08:30', TW).ms, ms);
    assert.strictEqual(T.parseTimeLine('2024/05/20 08:30', TW).kind, '日期（顯示時區）');
    assert.strictEqual(T.parseTimeLine('2024-05-20T00:30:00Z', TW).ms, ms);
    assert.ok(!T.parseTimeLine('hello', TW).ok);
    assert.strictEqual(T.normCnDate('2024-05-20'), null); assert.strictEqual(T.normCnDate('2024/5/20'), null); assert.strictEqual(T.normCnDate('1700000000'), null);
    // 民國年輸出
    assert.strictEqual(T.rocText(ms, TW), '民國113年05月20日 08:30:00');
    assert.strictEqual(T.rocText(Date.UTC(1911, 5, 1), 'UTC'), '民國前1年06月01日 00:00:00');
    assert.strictEqual(T.rocText(Date.UTC(1912, 0, 1), 'UTC'), '民國1年01月01日 00:00:00');
    // 批次
    const b = T.batchRows('113/05/20 08:30\n五月二十日\n2024年5月20日 08:30\n1716165000', TW);
    assert.strictEqual(b.rows.length, 4); assert.deepStrictEqual(b.rows.map(r => r.ok), [true, false, true, true]);
    assert.strictEqual(b.rows[0].roc, '民國113年05月20日 08:30:00'); assert.ok(b.rows[1].reason.includes('中文數字'));
    const tsv = T.batchTsv(b.rows, TW).split('\n'), tsvRoc = T.batchTsv(b.rows, TW, true).split('\n');
    assert.strictEqual(tsv[0].split('\t').length, 7); assert.strictEqual(tsvRoc[0].split('\t').length, 8); assert.ok(tsvRoc[0].endsWith('民國年'));
    assert.strictEqual(tsvRoc[1].split('\t')[7], '民國113年05月20日 08:30:00'); assert.ok(tsvRoc[2].includes('無法辨識'));
    assert.ok(!tsv[1].includes('民國113年05月20日 08:30:00'));

    // Intl
    assert.ok(T.intlFmt(ms, 'zh-TW', TW, 'long', 'medium').includes('2024'));
    assert.strictEqual(T.intlFmt(ms, 'en-US', TW, 'short', 'none'), '5/20/24');
    assert.strictEqual(T.intlFmt(ms, 'en-GB', TW, 'short', 'none'), '20/05/2024');
    assert.strictEqual(T.intlFmt(ms, 'de-DE', TW, 'short', 'none'), '20.05.24');
    assert.ok(T.intlFmt(ms, 'ja-JP', TW, 'long', 'none').includes('2024年5月20日'));
    assert.ok(T.intlFmt(ms, 'en-US', TW, 'none', 'short').includes('8:30'));
    assert.ok(T.intlFmt(ms, 'en-US', 'UTC', 'none', 'short').includes('12:30'));       // 時區生效
    assert.ok(T.intlFmt(ms, 'en-US', TW, 'none', 'none').includes('都選了'));
    assert.ok(T.intlFmt(ms, 'en-US', TW, 'bogus', 'bogus').includes('都選了'));
    assert.ok(T.intlFmt(ms, 'xx-invalid-locale-zzzzzzzzzzzz', TW, 'short', 'none').includes('不支援'));
    assert.ok(T.intlFmt(ms, 'en-US', 'Not/AZone', 'short', 'none').includes('不支援'));
    const lr = T.intlLocaleRows(ms, TW, 'medium', 'short'); assert.strictEqual(lr.length, T.INTL_LOCALES.length); assert.ok(lr.every(x => x[1] && !x[1].includes('不支援')));
    assert.ok(T.INTL_LOCALES.includes('zh-TW') && T.INTL_LOCALES.includes('fr-FR') && T.INTL_LOCALES.includes('ko-KR'));
    const zr = T.intlZoneRows(ms, 'en-US', ['UTC', TW, 'America/New_York'], 'short', 'short');
    assert.ok(zr[0][1].includes('UTC+00:00') && zr[1][1].includes('UTC+08:00') && zr[2][1].includes('UTC-04:00'), JSON.stringify(zr));
    const mx = T.intlMatrix(ms, 'en-US', TW); assert.strictEqual(mx.length, 24); assert.ok(mx.every(x => x[1] && !x[1].includes('不支援')));
    assert.strictEqual(new Set(mx.map(x => x[0])).size, 24);
    assert.strictEqual(T.intlTsv([['a', 'b\tc'], ['d', 'e']]), 'a\tb c\nd\te');
    ok('timestamp h10');
}
