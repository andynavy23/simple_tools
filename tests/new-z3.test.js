// 批次 z3：timezone 會議時間尋找、todo 月曆、expense-tracker 外幣、sketchpad 簽名裁切
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- timezone ----------
    const m = load('utils/timezone.html', 'zonedToMs, parts, normMeet, cityWindows, intersect, meetPlan, slotText, hhmm, dayTag, MAX_MEET, MAX_ZONES, toMin');
    const H = 3600e3;
    const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
    const std = { s: '09:00', e: '18:00', l: false };

    // 基本：台北 09–18 = UTC 01–10；前後一天都有算進來（跨日）
    const tp = m.cityWindows('2026-10-03', 'Asia/Taipei', std);
    assert.deepStrictEqual(tp.map(([a, b]) => iso(a) + '~' + iso(b)), ['2026-10-02T01:00~2026-10-02T10:00', '2026-10-03T01:00~2026-10-03T10:00', '2026-10-04T01:00~2026-10-04T10:00']);
    // 午休：切成兩段
    const lunch = m.cityWindows('2026-10-03', 'Asia/Taipei', { ...std, l: true }).slice(2, 4);
    assert.deepStrictEqual(lunch.map(([a, b]) => iso(a) + '~' + iso(b)), ['2026-10-03T01:00~2026-10-03T04:00', '2026-10-03T05:00~2026-10-03T10:00']);
    // 上班時段完全在午休內 / 之後都不會產生壞區間
    assert.deepStrictEqual(m.cityWindows('2026-10-03', 'UTC', { s: '12:10', e: '12:50', l: true }), []);
    assert.equal(m.cityWindows('2026-10-03', 'UTC', { s: '14:00', e: '16:00', l: true }).length, 3);

    // 台北 + 紐約（夏令 UTC-4）：沒有共同上班時間；推薦最少人加班
    const tpny = [{ z: 'Asia/Taipei', ...std }, { z: 'America/New_York', ...std }];
    let p = m.meetPlan('2026-10-03', tpny, 60);
    assert.equal(p.overlap.length, 0);
    assert.equal(p.slots.length, 3);
    assert.ok(p.slots.every(s => s.night === 0 && s.ot >= 1), '推薦的時段沒有半夜');
    assert.ok(p.slots[0].score <= p.slots[1].score && p.slots[1].score <= p.slots[2].score);
    // 同分（各 1 人加班）取較早：台北 09:00 = 紐約前一天 21:00；其次台北 21:00 = 紐約 09:00
    assert.equal(p.slots[0].score, 2, '兩個 30 分鐘格各 1 分'); assert.equal(p.slots[1].score, 2);
    assert.equal(m.slotText(p.slots[0], tpny, ['Taipei', 'New York']), 'Taipei 09:00–10:00\nNew York 21:00–22:00（前一天）');
    assert.equal(m.slotText(p.slots[1], tpny, ['Taipei', 'New York']), 'Taipei 21:00–22:00\nNew York 09:00–10:00');
    // 紐約排前面：軸改成紐約當天，台北在隔天（後一天）
    p = m.meetPlan('2026-10-03', [tpny[1], tpny[0]], 60);
    assert.equal(m.slotText(p.slots[0], [tpny[1], tpny[0]], ['New York', 'Taipei']), 'New York 09:00–10:00\nTaipei 21:00–22:00');
    assert.equal(m.slotText(p.slots[1], [tpny[1], tpny[0]], ['New York', 'Taipei']), 'New York 21:00–22:00\nTaipei 09:00–10:00（後一天）');

    // 有重疊：台北 + 東京 + 雪梨（10/3 雪梨還是 UTC+10，10/4 才進夏令）→ 台北 09–18 ∩ 東京 09–18(=台北 08–17) ∩ 雪梨 09–18(=台北 07–16)
    const three = [{ z: 'Asia/Taipei', ...std }, { z: 'Asia/Tokyo', ...std }, { z: 'Australia/Sydney', ...std }];
    p = m.meetPlan('2026-10-03', three, 60);
    assert.equal(p.overlap.length, 1);
    assert.equal(m.hhmm(p.overlap[0][0], 'Asia/Taipei') + '-' + m.hhmm(p.overlap[0][1], 'Asia/Taipei'), '09:00-16:00');
    assert.equal(p.slots[0].score, 0); assert.equal(p.slots[0].ot + p.slots[0].night, 0);
    assert.equal(m.hhmm(p.slots[0].start, 'Asia/Taipei'), '09:00');
    assert.equal(p.slots.length, 3); assert.ok(p.slots.every(s => s.score === 0));
    // 午休：雪梨 12–13（台北 10–11 )被扣掉 → 重疊 09–10、11–15
    three[2].l = true; three[1].l = false; three[0].l = false;
    p = m.meetPlan('2026-10-03', three, 60);
    assert.deepStrictEqual(p.overlap.map(([a, b]) => m.hhmm(a, 'Asia/Taipei') + '-' + m.hhmm(b, 'Asia/Taipei')), ['09:00-10:00', '11:00-16:00']);

    // 夏令轉換日：美國 2026-03-08（紐約 23 小時的一天），倫敦還是冬令
    const nyl = [{ z: 'America/New_York', ...std }, { z: 'Europe/London', ...std }];
    p = m.meetPlan('2026-03-08', nyl, 60);
    assert.equal((p.t1 - p.t0) / H, 23, '紐約這天只有 23 小時');
    assert.equal(p.overlap.length, 1);
    assert.equal(iso(p.overlap[0][0]) + '~' + iso(p.overlap[0][1]), '2026-03-08T13:00~2026-03-08T18:00', 'EDT = UTC-4：紐約 09:00 = UTC 13:00，倫敦 18:00 = UTC 18:00');
    p = m.meetPlan('2026-03-07', nyl, 60);                                  // 前一天還是 EST（UTC-5）
    assert.equal((p.t1 - p.t0) / H, 24);
    assert.equal(iso(p.overlap[0][0]) + '~' + iso(p.overlap[0][1]), '2026-03-07T14:00~2026-03-07T18:00');
    // 倫敦自己的夏令轉換日（2026-03-29）：London 24h-1，上班時間仍是當地 09–18
    const ln = [{ z: 'Europe/London', ...std }, { z: 'Asia/Taipei', ...std }];
    p = m.meetPlan('2026-03-29', ln, 60);
    assert.equal((p.t1 - p.t0) / H, 23);
    assert.equal(m.hhmm(p.wins[0][0][0], 'Europe/London'), '09:00'); assert.equal(iso(p.wins[0][0][0]), '2026-03-29T08:00');   // BST = UTC+1
    // 雪梨夏令結束（2026-04-05，25 小時）
    p = m.meetPlan('2026-04-05', [{ z: 'Australia/Sydney', ...std }, { z: 'Asia/Taipei', ...std }], 60);
    assert.equal((p.t1 - p.t0) / H, 25);
    assert.equal(iso(p.wins[0][0][0]), '2026-04-04T23:00', 'AEST = UTC+10');
    // 軸上的上班區間都在軸內
    assert.ok(p.wins.every(w => w.every(([a, b]) => a >= p.t0 && b <= p.t1 && b > a)));
    // 半夜判斷：只剩半夜選項時 night > 0
    const far = [{ z: 'Asia/Taipei', s: '09:00', e: '10:00', l: false }, { z: 'America/New_York', s: '09:00', e: '10:00', l: false }];
    p = m.meetPlan('2026-10-03', far, 60);
    assert.equal(p.overlap.length, 0); assert.ok(p.slots.length >= 1);
    // 長度 120 分鐘：重疊 09–15 可放；只有 1 小時重疊時 score > 0
    p = m.meetPlan('2026-10-03', [{ z: 'Asia/Taipei', s: '09:00', e: '10:00', l: false }, { z: 'Asia/Tokyo', s: '09:00', e: '18:00', l: false }], 120);
    assert.equal(p.overlap.length, 1); assert.ok(p.slots[0].score > 0, '重疊不足 120 分鐘');
    // 6 個城市也能算
    const six = ['Asia/Taipei', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'].map(z => ({ z, ...std }));
    p = m.meetPlan('2026-10-03', six, 60); assert.equal(p.slots.length, 3);

    // intersect / 零長度
    assert.deepStrictEqual(m.intersect([[0, 5]], [[5, 9]]), []);
    assert.deepStrictEqual(m.intersect([[0, 5], [8, 12]], [[3, 9]]), [[3, 5], [8, 9]]);
    // 壞資料容錯
    const isZ = (z) => z === 'Asia/Taipei' || z === 'America/New_York' || z === 'Europe/London';
    for (const bad of [null, undefined, 5, 'x', {}, { cities: 5 }, { cities: [null, 1, {}, { z: 5 }, { z: 'Mars/Base' }] }]) assert.deepStrictEqual(m.normMeet(bad, isZ), { cities: [] });
    const n = m.normMeet({ cities: [{ z: 'Asia/Taipei', s: '10:00', e: '19:00', l: true }, { z: 'Asia/Taipei' }, { z: 'Europe/London', s: '18:00', e: '09:00' }, { z: 'America/New_York', s: 'xx', e: '25:00', l: 'yes' }] }, isZ);
    assert.deepStrictEqual(n.cities, [{ z: 'Asia/Taipei', s: '10:00', e: '19:00', l: true }, { z: 'Europe/London', s: '09:00', e: '18:00', l: false }, { z: 'America/New_York', s: '09:00', e: '18:00', l: false }]);
    const many = { cities: Array.from({ length: 20 }, (_, i) => ({ z: 'Z' + i })) };
    assert.equal(m.normMeet(many, () => true).cities.length, m.MAX_MEET); assert.equal(m.MAX_MEET, 6); assert.ok(m.MAX_ZONES >= 20);
    assert.equal(m.toMin('09:30'), 570); assert.equal(m.toMin('24:00'), null); assert.equal(m.toMin('9:30'), null);
    ok('timezone: 會議時間尋找（跨日 / 重疊 / 午休 / DST / 推薦 / 壞資料）');
}

{ // ---------- todo ----------
    const m = load('fun/todo.html', 'calMonth, shiftYm, MAX_ITEMS');
    const I = (id, due, done = false) => ({ id, t: id, due, done });
    const items = [I('a', '2026-10-03'), I('b', '2026-10-03', true), I('c', '2026-10-01'), I('d', '2026-10-31'), I('e', '2026-11-02'), I('f', ''), I('g', '2026-10-15', true), null, { due: 5 }];
    const c = m.calMonth(items, '2026-10', '2026-10-03');
    assert.equal(c.lead, 4, '2026-10-01 是週四');
    assert.equal(c.days.length, 31);
    assert.deepStrictEqual(c.days[0], { d: '2026-10-01', n: 1, done: 0, late: true });
    assert.deepStrictEqual(c.days[2], { d: '2026-10-03', n: 1, done: 1, late: false });
    assert.deepStrictEqual(c.days[14], { d: '2026-10-15', n: 0, done: 1, late: false });
    assert.equal(c.days[30].n, 1); assert.equal(c.days[30].late, false);
    assert.equal(c.days[5].n, 0);
    // 逾期只看「未完成且早於今天」
    const c2 = m.calMonth(items, '2026-10', '2026-12-01');
    assert.equal(c2.days[0].late, true); assert.equal(c2.days[14].late, false); assert.equal(c2.days[2].late, true);
    // 閏年二月、年底、非陣列
    assert.equal(m.calMonth([], '2024-02', '2024-02-10').days.length, 29);
    assert.equal(m.calMonth([], '2026-02', '2026-02-10').lead, 0);
    assert.equal(m.calMonth(null, '2026-12', '2026-12-10').days.length, 31);
    assert.equal(m.shiftYm('2026-12', 1), '2027-01'); assert.equal(m.shiftYm('2026-01', -1), '2025-12'); assert.equal(m.shiftYm('2026-10', 0), '2026-10');
    ok('todo: calMonth / shiftYm');
}

{ // ---------- expense-tracker ----------
    const m = load('utils/expense-tracker.html', 'CURRENCIES, validEntry, cleanFx, fxRate, validRate, toTwd, fmtFx, toCSV, MAX_AGE');
    const now = 1_800_000_000_000;
    const cache = { rates: { TWD: 1, USD: 0.032, JPY: 4.6147, KRW: 43.5 }, time: 'x', fetched: now - 3600e3 };
    // 匯率 = 1 外幣 = 多少台幣
    assert.ok(Math.abs(m.fxRate(cache, 'JPY', now) - 1 / 4.6147) < 1e-9);
    assert.equal(m.fxRate(cache, 'TWD', now), 1);
    assert.equal(m.fxRate(cache, 'EUR', now), null, '快取沒有這個幣別');
    assert.equal(m.fxRate(cache, 'XXX', now), null, '不在白名單');
    assert.equal(m.fxRate(cache, 'JPY', now + m.MAX_AGE + 1), null, '太舊');
    for (const bad of [null, {}, { rates: null, fetched: now }, { rates: { JPY: 'a' }, fetched: now }, { rates: { JPY: 0 }, fetched: now }, { rates: { JPY: 5 }, fetched: 'x' }, { rates: { JPY: 5 }, fetched: now + 3600e3 * 48 }, 5, 'x']) assert.equal(m.fxRate(bad, 'JPY', now), null);
    for (const c of ['USD', 'JPY', 'EUR', 'KRW', 'CNY', 'HKD', 'GBP', 'AUD', 'THB', 'SGD', 'TWD']) assert.ok(c in m.CURRENCIES, c);
    assert.ok(m.validRate(0.2167) && m.validRate(32.5) && !m.validRate(0) && !m.validRate(-1) && !m.validRate(NaN) && !m.validRate('3') && !m.validRate(1e7) && !m.validRate(1e-9));
    assert.equal(m.toTwd(1200, 0.2167), 260.04); assert.equal(m.toTwd(10, 32.123456), 321.23); assert.equal(m.toTwd(0, 1), null); assert.equal(m.toTwd(-5, 1), null); assert.equal(m.toTwd(NaN, 1), null); assert.equal(m.toTwd(1, 0), null); assert.equal(m.toTwd(0.001, 0.001), null, '換算後不到 0.01');
    // 舊資料（沒有外幣欄位）完全相容
    const old = { id: 'a', d: '2024-01-01', type: 'out', cat: '餐飲', amt: 120, note: '' };
    assert.ok(m.validEntry(old)); assert.deepStrictEqual(m.cleanFx(old), old);
    const fx = { ...old, amt: 260.04, cur: 'JPY', fx: 1200, rate: 0.2167 };
    assert.ok(m.validEntry(fx)); assert.deepStrictEqual(m.cleanFx(fx), fx);
    assert.deepStrictEqual(m.cleanFx({ ...old, cur: 'TWD' }), old, 'TWD 不留外幣欄位');
    // 壞的外幣欄位：保留台幣金額，丟掉外幣資訊（不弄丟帳）
    for (const bad of [{ cur: 'XXX', fx: 1, rate: 1 }, { cur: 'JPY', fx: 'a', rate: 0.2 }, { cur: 'JPY', fx: 100, rate: 0 }, { cur: 'JPY', fx: -1, rate: 0.2 }, { cur: 5, fx: 1, rate: 1 }, { cur: 'JPY' }, { fx: 3 }, { cur: 'JPY', fx: 100, rate: 1e9 }])
        assert.deepStrictEqual(m.cleanFx({ ...old, ...bad }), old);
    assert.equal(m.fmtFx(fx), '¥1,200 ≈ NT$260（匯率 0.2167）');
    assert.equal(m.fmtFx({ ...old, amt: 321.5, cur: 'USD', fx: 10, rate: 32.15 }), 'US$10 ≈ NT$321.5（匯率 32.15）');
    assert.equal(m.fmtFx(old), '');
    const csv = m.toCSV([old, fx], true).split('\r\n');
    assert.equal(csv[0], '日期,收支,分類,金額,備註,幣別,外幣金額,匯率');
    assert.equal(csv[1], '2024-01-01,支出,餐飲,120,,TWD,,');
    assert.equal(csv[2], '2024-01-01,支出,餐飲,260.04,,JPY,1200,0.2167');
    ok('expense-tracker: 外幣（匯率 / 驗證 / 相容 / CSV）');
}

{ // ---------- sketchpad ----------
    const m = load('fun/sketchpad.html', 'contentBounds, SIG_COLORS');
    const img = (w, h, px) => { const a = new Uint8ClampedArray(w * h * 4); px.forEach(([x, y, al]) => { a[(y * w + x) * 4 + 3] = al === undefined ? 255 : al; }); return a; };
    assert.equal(m.contentBounds(img(10, 10, []), 10, 10), null, '全透明');
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[3, 2], [6, 5]]), 10, 8), { x: 3, y: 2, w: 4, h: 4 });
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[0, 0]]), 10, 8), { x: 0, y: 0, w: 1, h: 1 });
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[9, 7]]), 10, 8), { x: 9, y: 7, w: 1, h: 1 });
    assert.equal(m.contentBounds(img(10, 8, [[4, 4, 0]]), 10, 8), null, 'alpha=0 不算內容');
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[4, 4, 1]]), 10, 8), { x: 4, y: 4, w: 1, h: 1 }, '極淡的筆跡也算');
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[4, 4, 255]]), 10, 8, 2), { x: 2, y: 2, w: 5, h: 5 }, '留邊距');
    assert.deepStrictEqual(m.contentBounds(img(10, 8, [[0, 0], [9, 7]]), 10, 8, 3), { x: 0, y: 0, w: 10, h: 8 }, '邊距不超出畫布');
    assert.equal(m.contentBounds(null, 10, 8), null); assert.equal(m.contentBounds(new Uint8ClampedArray(4), 10, 8), null, '長度不符');
    assert.ok(m.SIG_COLORS.length >= 2);
    ok('sketchpad: contentBounds');
}
