// 批次 z6：字元檢視（encode-decode）、飲食記錄（health-calc）、QR 範本（qr-code）
const assert = require('assert');
const { load, ok } = require('./_load');

// ---------- encode-decode：字元檢視 ----------
{
    const { analyze, stripInvisible, normalizeText } = load('utils/encode-decode.html', 'analyze, stripInvisible, normalizeText');
    // emoji 組合序列：1 個字素、5 個 code point
    let r = analyze('👨‍👩‍👧');
    assert.strictEqual(r.graphemes, 1); assert.strictEqual(r.codePoints, 5); assert.strictEqual(r.suspicious, 0);
    assert.strictEqual(r.utf8Bytes, 18); assert.strictEqual(r.utf16Bytes, 16);
    assert.strictEqual(r.rows[0].cps, 'U+1F468 U+200D U+1F469 U+200D U+1F467');
    // 旗幟：2 個區域指示符，1 個字素
    r = analyze('🇹🇼'); assert.strictEqual(r.graphemes, 1); assert.strictEqual(r.codePoints, 2); assert.strictEqual(r.rows[0].cps, 'U+1F1F9 U+1F1FC');
    // 帶音標組合字元：e + U+0301 為 1 個字素 2 個 code point
    r = analyze('é'); assert.strictEqual(r.graphemes, 1); assert.strictEqual(r.codePoints, 2); assert.strictEqual(r.rows[0].script, 'Latin');
    // 增補平面字：𠮷 U+20BB7，UTF-8 4 位元組、UTF-16 兩個單元
    r = analyze('𠮷'); assert.strictEqual(r.rows[0].cps, 'U+20BB7'); assert.strictEqual(r.rows[0].utf8, 'F0 A0 AE B7'); assert.strictEqual(r.rows[0].utf16, 'D842 DFB7');
    assert.strictEqual(r.rows[0].script, 'Han'); assert.strictEqual(r.rows[0].cat, '字母');
    // 一般字元類別與腳本
    r = analyze('A1,+あカ가 α');
    assert.deepStrictEqual(r.rows.map(x => x.cat), ['字母', '數字', '標點', '符號', '字母', '字母', '字母', '空白', '字母']);
    assert.deepStrictEqual(r.rows.map(x => x.script).filter((_, i) => [4, 5, 6, 8].includes(i)), ['Hiragana', 'Katakana', 'Hangul', 'Greek']);
    assert.strictEqual(r.suspicious, 0);        // 一般空白與正常字元都不可疑
    // BOM、零寬、NBSP、全形空白、軟連字號
    r = analyze('﻿a​b‌c d　e­f‍');
    assert.strictEqual(r.suspicious, 7);
    assert.ok(r.rows[0].flag.includes('BOM')); assert.ok(r.rows[0].shown === '·');
    // 雙向控制（Trojan Source）
    r = analyze('a‮b⁦c⁩'); assert.strictEqual(r.suspicious, 3); assert.ok(r.rows[1].flag.includes('Trojan'));
    // 特殊空白與控制字元；Tab / 換行不算可疑
    r = analyze('  \u0007\t\n'); assert.deepStrictEqual(r.rows.map(x => !!x.flag), [true, true, true, false, false]);
    // 同形異義：西里爾 а 與拉丁 a
    r = analyze('аa'); assert.ok(r.rows[0].flag.includes('拉丁字母 a') && r.rows[0].flag.includes('Cyrillic')); assert.strictEqual(r.rows[1].flag, null);
    r = analyze('Ηello'); assert.ok(r.rows[0].flag, '希臘 Η');
    // 空字串
    r = analyze(''); assert.strictEqual(r.graphemes, 0); assert.strictEqual(r.utf8Bytes, 0);
    // 移除零寬與方向控制，但保留 emoji 序列內的 ZWJ
    let s = stripInvisible('﻿a​b‮c⁦d‏');
    assert.strictEqual(s.out, 'abcd'); assert.strictEqual(s.removed, 5);
    s = stripInvisible('👨‍👩‍👧 x‍'); assert.strictEqual(s.out, '👨‍👩‍👧 x'); assert.strictEqual(s.removed, 1);
    s = stripInvisible('👩🏽‍💻​'); assert.strictEqual(s.out, '👩🏽‍💻'); assert.strictEqual(s.removed, 1);
    assert.strictEqual(stripInvisible('plain').removed, 0);
    // 正規化
    let n = normalizeText('é', 'NFD'); assert.strictEqual(n.out, 'é'); assert.deepStrictEqual([n.before, n.after, n.diff], [1, 2, 1]);
    n = normalizeText('é', 'NFC'); assert.deepStrictEqual([n.after, n.diff], [1, -1]);
    n = normalizeText('ﬁＡ①', 'NFKC'); assert.strictEqual(n.out, 'fiA1'); assert.strictEqual(n.diff, 1);
    assert.strictEqual(normalizeText('ﬁ', 'NFC').diff, 0);
    assert.throws(() => normalizeText('a', 'NFX'));
    ok('encode-decode: 字元檢視');
}

// ---------- health-calc：飲食記錄 ----------
{
    const m = load('utils/health-calc.html', 'FOODS, MEALS, validLog, validCustom, sanitizeLog, sanitizeCustom, searchFoods, addFoodLog, addCustomFood, removeById, removeDay, removeOlderThanYear, dayStats, last7, budget, FOOD_LOG_MAX, FOOD_CUSTOM_MAX');
    const { FOODS } = m;
    assert.ok(FOODS.length >= 140 && FOODS.length <= 180, 'FOODS 約 170 種：' + FOODS.length);
    assert.strictEqual(new Set(FOODS.map(f => f.name)).size, FOODS.length, 'FOODS 名稱無重複');
    for (const f of FOODS) { assert.ok(f.name && f.portion && f.cat, f.name); assert.ok(Number.isFinite(f.kcal) && f.kcal > 0 && f.kcal < 3000, f.name + ' 熱量不合理'); }
    // 搜尋：名稱與別名
    const names = (q) => m.searchFoods(FOODS, q).map(f => f.name);
    assert.ok(names('雞排').includes('雞排（大）')); assert.ok(names('珍奶').length === 3); assert.ok(names('蛋餅').length >= 2);
    assert.strictEqual(names('  ').length, FOODS.length); assert.deepStrictEqual(names('不存在的東西'), []);
    assert.ok(names('MCDONALD').length === 0 && names('麥當勞').length >= 4);
    // 驗證
    const e = (o) => ({ id: 'a', d: '2026-10-03', meal: 'l', name: '白飯', kcal: 280, n: 1, ...o });
    assert.ok(m.validLog(e())); assert.ok(m.validLog(e({ n: 0.5 }))); assert.ok(m.validLog(e({ n: 2.5 })));
    for (const bad of [null, e({ n: 0.3 }), e({ n: 0 }), e({ n: 21 }), e({ n: '1' }), e({ kcal: 0 }), e({ kcal: -5 }), e({ kcal: NaN }), e({ meal: 'x' }), e({ d: '2026/10/03' }), e({ name: '' }), e({ id: '' }), e({ id: 5 })]) assert.ok(!m.validLog(bad), JSON.stringify(bad));
    const dirty = [null, 7, e({ id: 'a' }), e({ id: 'a', name: '重複' }), e({ id: 'b', n: 9 }), e({ id: 'c', kcal: 'x' })];
    assert.deepStrictEqual(m.sanitizeLog(dirty).map(x => x.id), ['a', 'b']);
    assert.deepStrictEqual(m.sanitizeLog(null), []); assert.deepStrictEqual(m.sanitizeLog({}), []); assert.deepStrictEqual(m.sanitizeLog('x'), []);
    const big = Array.from({ length: 5200 }, (_, i) => e({ id: 'i' + i })); assert.strictEqual(m.sanitizeLog(big).length, 5000);
    assert.deepStrictEqual(m.sanitizeCustom([null, { id: 'x', name: '甲', kcal: 100 }, { id: 'y', name: '', kcal: 100 }, { id: 'z', name: '乙', kcal: 0 }, { id: 'x', name: '重', kcal: 5 }]), [{ id: 'x', name: '甲', kcal: 100 }]);
    assert.strictEqual(m.sanitizeCustom(Array.from({ length: 60 }, (_, i) => ({ id: 'c' + i, name: 'n', kcal: 10 }))).length, 50);
    // 新增與上限
    let log = []; log = m.addFoodLog(log, e({ id: 'x1' })); assert.strictEqual(log.length, 1);
    assert.strictEqual(m.addFoodLog(log, e({ id: 'x2', n: 0.7 })), null);
    assert.strictEqual(m.addFoodLog(big.slice(0, 5000), e({ id: 'new' })), null);          // 滿了拒絕新增
    assert.strictEqual(m.addFoodLog(big.slice(0, 4999), e({ id: 'new' })).length, 5000);
    let c = m.addCustomFood([], ' 媽媽的滷肉 ', '320.4', 'k1'); assert.deepStrictEqual(c.list, [{ id: 'k1', name: '媽媽的滷肉', kcal: 320 }]);
    for (const [n, k] of [['', 100], ['x'.repeat(31), 100], ['a', 0], ['a', 'abc'], ['a', 5001]]) assert.ok(m.addCustomFood([], n, k, 'z').err);
    assert.ok(m.addCustomFood(Array.from({ length: 50 }, (_, i) => ({ id: 'c' + i, name: 'n', kcal: 1 })), 'a', 10, 'z').err);
    // 刪除
    const L = [e({ id: '1', d: '2026-10-03' }), e({ id: '2', d: '2026-10-02' }), e({ id: '3', d: '2025-10-02' }), e({ id: '4', d: '2025-10-03' })];
    assert.deepStrictEqual(m.removeById(L, '2').map(x => x.id), ['1', '3', '4']);
    assert.deepStrictEqual(m.removeDay(L, '2026-10-03').map(x => x.id), ['2', '3', '4']);
    assert.deepStrictEqual(m.removeOlderThanYear(L, '2026-10-03').map(x => x.id), ['1', '2', '4']);        // 剛好滿一年（2025-10-03）保留
    const logSnap = [e({ id: 's', name: '自訂麵', kcal: 400 })], cust = [{ id: 'k', name: '自訂麵', kcal: 400 }];
    assert.deepStrictEqual(m.removeById(cust, 'k'), []); assert.strictEqual(logSnap[0].name, '自訂麵');       // 紀錄自帶快照
    // 當日統計
    const day = [e({ id: 'a', meal: 'b', kcal: 250, n: 1 }), e({ id: 'b', meal: 'l', kcal: 800, n: 0.5 }), e({ id: 'c', meal: 'l', kcal: 100, n: 2 }), e({ id: 'd', meal: 's', kcal: 55, n: 1.5 }), e({ id: 'e', d: '2026-10-02', kcal: 999 })];
    const st = m.dayStats(day, '2026-10-03'); assert.deepStrictEqual(st.byMeal, { b: 250, l: 600, d: 0, s: 83 }); assert.strictEqual(st.total, 933); assert.strictEqual(st.count, 4);
    assert.strictEqual(m.dayStats([], '2026-10-03').total, 0);
    const w = m.last7(day, '2026-10-03'); assert.strictEqual(w.days.length, 7); assert.strictEqual(w.days[6].d, '2026-10-03'); assert.strictEqual(w.days[0].d, '2026-09-27');
    assert.strictEqual(w.days[5].total, 999); assert.strictEqual(w.recorded, 2); assert.strictEqual(w.avg, Math.round((933 + 999) / 2));
    assert.deepStrictEqual([m.last7([], '2026-10-03').avg, m.last7([], '2026-10-03').recorded], [0, 0]);
    // 與 TDEE 對照
    assert.deepStrictEqual(m.budget(1500, 2000), { remain: 500, over: false, pct: 75 });
    assert.deepStrictEqual(m.budget(2500, 2000), { remain: -500, over: true, pct: 100 });
    assert.strictEqual(m.budget(100, 0), null); assert.strictEqual(m.budget(100, NaN), null);
    ok('health-calc: 飲食記錄');
}

// ---------- qr-code：範本 ----------
{
    const m = load('utils/qr-code.html', 'QR_TPL, wifiString, vcardString, telString, smsString, mailString, geoString, urlString, eventString, icsTime, utf8Len, encode');
    // Wi-Fi
    assert.strictEqual(m.wifiString({ ssid: 'Home', pass: 'pass1234', type: 'WPA', hidden: true }), 'WIFI:T:WPA;S:Home;P:pass1234;H:true;;');
    assert.strictEqual(m.wifiString({ ssid: 'Home', pass: 'pw', type: 'WEP' }), 'WIFI:T:WEP;S:Home;P:pw;;');
    assert.strictEqual(m.wifiString({ ssid: 'Shop', type: 'nopass' }), 'WIFI:T:nopass;S:Shop;;');
    // 特殊字元逐項跳脫：\ ; , : "
    assert.strictEqual(m.wifiString({ ssid: 'a\\b', pass: 'p;q' }), 'WIFI:T:WPA;S:a\\\\b;P:p\\;q;;');
    assert.strictEqual(m.wifiString({ ssid: 'a,b', pass: 'c:d' }), 'WIFI:T:WPA;S:a\\,b;P:c\\:d;;');
    assert.strictEqual(m.wifiString({ ssid: 'say"hi"', pass: 'x' }), 'WIFI:T:WPA;S:say\\"hi\\";P:x;;');
    assert.strictEqual(m.wifiString({ ssid: '咖啡 店', pass: 'x' }), 'WIFI:T:WPA;S:咖啡 店;P:x;;');
    assert.strictEqual(m.wifiString({ ssid: 'abc123', pass: '12345678' }), 'WIFI:T:WPA;S:"abc123";P:"12345678";;');   // 純十六進位要加引號
    assert.throws(() => m.wifiString({ ssid: '', pass: 'x' }), /名稱/); assert.throws(() => m.wifiString({ ssid: 'a', pass: '' }), /密碼/);
    assert.throws(() => m.wifiString({ ssid: 'a', pass: 'x', type: 'WPA3' }));
    // vCard 3.0
    const v = m.vcardString({ name: '王小明', org: 'A;B, Inc.', title: '工程師', tel: '0912-345-678', email: 'a@b.co', url: 'https://x.tw/?a=1,2', adr: '台北市\n信義路1號' });
    assert.strictEqual(v, ['BEGIN:VCARD', 'VERSION:3.0', 'N:王小明;;;;', 'FN:王小明', 'ORG:A\\;B\\, Inc.', 'TITLE:工程師', 'TEL;TYPE=CELL:0912-345-678', 'EMAIL:a@b.co', 'URL:https://x.tw/?a=1\\,2', 'ADR;TYPE=WORK:;;台北市\\n信義路1號;;;;', 'END:VCARD'].join('\r\n'));
    assert.ok(v.includes('\r\n') && !/[^\r]\n/.test(v), '行尾 CRLF');
    assert.strictEqual(m.vcardString({ name: 'x\\y' }), 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:x\\\\y;;;;\r\nFN:x\\\\y\r\nEND:VCARD');
    assert.throws(() => m.vcardString({ name: ' ' }), /姓名/);
    // 電話 / 簡訊 / Email
    assert.strictEqual(m.telString({ tel: '02 2345-6789' }), 'tel:0223456789'); assert.strictEqual(m.telString({ tel: '+886 912 345 678' }), 'tel:+886912345678');
    assert.throws(() => m.telString({ tel: '' }));
    assert.strictEqual(m.smsString({ tel: '0912-345-678', body: '你好: 開會 ok' }), 'SMSTO:0912345678:你好: 開會 ok'); assert.strictEqual(m.smsString({ tel: '1' }), 'SMSTO:1:');
    assert.strictEqual(m.mailString({ to: 'a@b.co', subject: '報告 & 會議', body: '第一行\n第二行?' }), 'mailto:a@b.co?subject=' + encodeURIComponent('報告 & 會議') + '&body=' + encodeURIComponent('第一行\n第二行?'));
    assert.strictEqual(m.mailString({ to: 'a@b.co' }), 'mailto:a@b.co'); assert.strictEqual(m.mailString({ to: 'a@b.co', body: 'x y' }), 'mailto:a@b.co?body=x%20y');
    assert.throws(() => m.mailString({ to: '' }));
    // 地理位置
    assert.strictEqual(m.geoString({ lat: '25.0330', lon: '121.5654' }), 'geo:25.033,121.5654'); assert.strictEqual(m.geoString({ lat: -90, lon: 180 }), 'geo:-90,180');
    for (const [a, o] of [['91', '0'], ['0', '181'], ['', '1'], ['x', '1'], ['1', ' ']]) assert.throws(() => m.geoString({ lat: a, lon: o }), a + ',' + o);
    // 網址
    assert.strictEqual(m.urlString({ url: 'example.com/a' }), 'https://example.com/a'); assert.strictEqual(m.urlString({ url: ' http://x.tw ' }), 'http://x.tw'); assert.strictEqual(m.urlString({ url: 'HTTPS://X.TW' }), 'HTTPS://X.TW');
    assert.throws(() => m.urlString({ url: '' }));
    // 行事曆
    assert.strictEqual(m.icsTime('2026-10-03T14:05', false), '20261003T140500');
    assert.ok(/^\d{8}T\d{6}Z$/.test(m.icsTime('2026-10-03T14:05', true)));
    assert.strictEqual(m.icsTime('2026-10-03T14:05', true), new Date(2026, 9, 3, 14, 5).toISOString().replace(/[-:]|\.\d+/g, ''));
    assert.throws(() => m.icsTime('', false)); assert.throws(() => m.icsTime('2026-10-03', false));
    const now = new Date('2026-10-01T00:00:00Z');
    const ev = m.eventString({ title: '週會; 季度, 檢討', start: '2026-10-05T09:00', end: '2026-10-05T10:30', place: '會議室\\A', desc: '帶筆電\n準時' }, now);
    assert.strictEqual(ev, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//simple_tools//QR//EN', 'BEGIN:VEVENT', 'UID:20261005T090000-20261005T103000@simple-tools', 'DTSTAMP:20261001T000000Z', 'SUMMARY:週會\\; 季度\\, 檢討', 'DTSTART:20261005T090000', 'DTEND:20261005T103000', 'LOCATION:會議室\\\\A', 'DESCRIPTION:帶筆電\\n準時', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    assert.ok(m.eventString({ title: 't', start: '2026-10-05T09:00', end: '2026-10-05T10:00', utc: true }, now).includes('DTSTART:' + m.icsTime('2026-10-05T09:00', true)));
    assert.throws(() => m.eventString({ title: 't', start: '2026-10-05T10:00', end: '2026-10-05T09:00' }, now), /晚於/);
    assert.throws(() => m.eventString({ title: 't', start: '2026-10-05T10:00', end: '2026-10-05T10:00' }, now), /晚於/);
    assert.throws(() => m.eventString({ title: '', start: '2026-10-05T09:00', end: '2026-10-05T10:00' }, now), /標題/);
    // 分派表與長度、容量
    assert.deepStrictEqual(Object.keys(m.QR_TPL).sort(), ['event', 'geo', 'mail', 'sms', 'tel', 'url', 'vcard', 'wifi']);
    assert.strictEqual(m.utf8Len('王a'), 4);
    const q = m.encode(m.wifiString({ ssid: 'Home', pass: 'pass1234' }), 'M'); assert.ok(q.version >= 1 && q.size === q.version * 4 + 17);
    assert.throws(() => m.encode(m.vcardString({ name: 'x', adr: 'a'.repeat(3000) }), 'M'), /太長/);
    ok('qr-code: 範本字串');
}
