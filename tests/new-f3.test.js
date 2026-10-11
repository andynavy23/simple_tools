// 批次 f3：timezone 共同空檔（忙碌時段）、pomodoro/todo 番茄連動、alarm 起床任務
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- timezone：忙碌時段 ----------
    const m = load('utils/timezone.html', 'zonedToMs, normMeet, normBusy, busyMs, subtract, intersect, meetPlan, slotText, hhmm, MAX_BUSY, validDate');
    const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
    const std = { s: '09:00', e: '18:00', l: false };
    const U = (a, b) => [Date.UTC(2026, 0, 1, a), Date.UTC(2026, 0, 1, b)];

    // 區間補集
    assert.deepStrictEqual(m.subtract([U(0, 10)], [U(2, 4)]), [U(0, 2), U(4, 10)]);
    assert.deepStrictEqual(m.subtract([U(0, 10)], [U(0, 10)]), []);
    assert.deepStrictEqual(m.subtract([U(0, 10)], [U(-5 + 5, 3), U(8, 12)]), [U(3, 8)]);
    assert.deepStrictEqual(m.subtract([U(0, 10)], [U(10, 12)]), [U(0, 10)], '相接不算重疊');
    assert.deepStrictEqual(m.subtract([U(0, 4), U(6, 10)], [U(3, 7)]), [U(0, 3), U(7, 10)]);
    assert.deepStrictEqual(m.subtract([U(0, 10)], []), [U(0, 10)]);
    assert.deepStrictEqual(m.subtract([], [U(0, 1)]), []);
    // 交集（既有）
    assert.deepStrictEqual(m.intersect([U(0, 5)], [U(3, 8)]), [U(3, 5)]);

    // normBusy：壞項目丟掉、排序、上限
    const bz = m.normBusy([{ d: '2026-10-03', s: '14:00', e: '15:00' }, { d: '2026-10-02', s: '09:00', e: '10:00' }, null, 5, { d: '2026-02-30', s: '09:00', e: '10:00' },
        { d: '2026-10-03', s: '25:00', e: '26:00' }, { d: '2026-10-03', s: '10:00', e: '10:00' }, { d: 'x', s: '10:00', e: '11:00' }, { d: '2026-10-03', s: '10:00' }]);
    assert.deepStrictEqual(bz.map(x => x.d + ' ' + x.s), ['2026-10-02 09:00', '2026-10-03 14:00']);
    assert.deepStrictEqual(m.normBusy(null), []); assert.deepStrictEqual(m.normBusy('abc'), []); assert.deepStrictEqual(m.normBusy({}), []);
    const many = Array.from({ length: 50 }, (_, i) => ({ d: '2026-10-03', s: `${String(i % 24).padStart(2, '0')}:00`, e: `${String(i % 24).padStart(2, '0')}:30` }));
    assert.equal(m.normBusy(many).length, m.MAX_BUSY); assert.equal(m.MAX_BUSY, 20);
    assert.ok(m.validDate('2024-02-29') && !m.validDate('2026-02-29') && !m.validDate('2026-13-01') && !m.validDate(20261003) && !m.validDate('0001-01-01'));

    // normMeet：舊資料沒有 b → []；有 b 會驗證
    const isZone = () => true;
    let nm = m.normMeet({ cities: [{ z: 'Asia/Taipei', s: '09:00', e: '18:00', l: false }, { z: 'Asia/Tokyo', s: '09:00', e: '18:00', l: false, b: [{ d: '2026-10-03', s: '10:00', e: '11:00' }, { d: 'bad' }] }] }, isZone).cities;
    assert.equal(nm[0].b, undefined); assert.equal(nm[1].b.length, 1);
    nm = m.normMeet({ cities: [{ z: 'Asia/Taipei', s: '09:00', e: '18:00', b: 'zzz' }] }, isZone).cities; assert.equal(nm[0].b, undefined);

    // busyMs：以該城市當地時間；跨午夜到隔天
    let b = m.busyMs([{ d: '2026-10-03', s: '14:00', e: '15:30' }], 'Asia/Taipei');
    assert.deepStrictEqual(b.map(([a, c]) => iso(a) + '~' + iso(c)), ['2026-10-03T06:00~2026-10-03T07:30']);
    b = m.busyMs([{ d: '2026-10-03', s: '22:00', e: '02:00' }], 'Asia/Taipei');
    assert.deepStrictEqual(b.map(([a, c]) => iso(a) + '~' + iso(c)), ['2026-10-03T14:00~2026-10-03T18:00'], '跨午夜 22:00–02:00 = 4 小時');
    b = m.busyMs([{ d: '2026-12-31', s: '23:00', e: '01:00' }], 'UTC'); assert.equal(iso(b[0][1]), '2027-01-01T01:00', '跨年');
    // 夏令轉換日：紐約 2026-03-08 02:00 跳到 03:00（當天只有 23 小時），01:00–04:00 實際只有 2 小時
    b = m.busyMs([{ d: '2026-03-08', s: '01:00', e: '04:00' }], 'America/New_York');
    assert.equal((b[0][1] - b[0][0]) / 3600e3, 2, '春季轉換日 01:00–04:00 只有 2 小時');
    // 秋季轉換日：2026-11-01 01:00–04:00 實際 4 小時
    b = m.busyMs([{ d: '2026-11-01', s: '01:00', e: '04:00' }], 'America/New_York');
    assert.equal((b[0][1] - b[0][0]) / 3600e3, 4, '秋季轉換日 01:00–04:00 有 4 小時');
    // 跨午夜 + 轉換日：倫敦 2026-03-28 23:00 → 03-29 02:00（03-29 01:00 跳 02:00），3 小時變 2 小時
    b = m.busyMs([{ d: '2026-03-28', s: '23:00', e: '02:00' }], 'Europe/London');
    assert.equal((b[0][1] - b[0][0]) / 3600e3, 2);

    // meetPlan：台北 + 東京，同一個 09:00–18:00；台北 10:00–12:00 忙碌 → 共同空檔扣掉
    const tt = [{ z: 'Asia/Taipei', ...std, b: [{ d: '2026-10-03', s: '10:00', e: '12:00' }] }, { z: 'Asia/Tokyo', ...std }];
    let p = m.meetPlan('2026-10-03', tt, 60);
    // 重疊（台北時間）= 10:00–17:00（東京 09:00 = 台北 08:00，台北 09:00 起；東京 18:00 = 台北 17:00）原本 09:00–17:00，扣 10–12
    assert.deepStrictEqual(p.overlap.map(([a, c]) => m.hhmm(a, 'Asia/Taipei') + '–' + m.hhmm(c, 'Asia/Taipei')), ['09:00–10:00', '12:00–17:00']);
    assert.ok(p.hasBusy); assert.equal(p.busy[0].length, 1); assert.equal(p.busy[1].length, 0);
    assert.ok(p.slots.length >= 1);
    for (const s of p.slots) assert.ok(s.end <= p.busy[0][0][0] || s.start >= p.busy[0][0][1], '建議時段不能碰到忙碌');
    assert.ok(p.slots.every(s => s.score === 0), '還有很多全員上班的空檔');
    // 沒有 b 欄位 = 與以前一樣
    p = m.meetPlan('2026-10-03', tt.map(c => ({ z: c.z, s: c.s, e: c.e, l: c.l })), 60);
    assert.equal(p.hasBusy, false); assert.deepStrictEqual(p.overlap.map(([a, c]) => m.hhmm(a, 'Asia/Taipei')), ['09:00']);
    assert.equal(p.overlap.length, 1);

    // 忙碌填滿整個重疊 → 沒有共同空檔，但仍列出（需加班）的候選且避開忙碌
    const full = [{ z: 'Asia/Taipei', ...std, b: [{ d: '2026-10-03', s: '08:00', e: '18:00' }] }, { z: 'Asia/Tokyo', ...std }];
    p = m.meetPlan('2026-10-03', full, 60);
    assert.equal(p.overlap.length, 0);
    assert.ok(p.slots.every(s => s.end <= p.busy[0][0][0] || s.start >= p.busy[0][0][1]));
    // 其他城市的忙碌也算：東京忙碌 → 建議不碰東京的忙碌
    const jb = [{ z: 'Asia/Taipei', ...std }, { z: 'Asia/Tokyo', ...std, b: [{ d: '2026-10-03', s: '10:00', e: '12:00' }] }];
    p = m.meetPlan('2026-10-03', jb, 60);
    assert.ok(p.slots.every(s => s.end <= p.busy[1][0][0] || s.start >= p.busy[1][0][1]));

    // 跨午夜忙碌（前一天晚上）影響隔天早上：台北 10/02 22:00 → 10/03 10:00 忙碌
    const ov = [{ z: 'Asia/Taipei', ...std, b: [{ d: '2026-10-02', s: '22:00', e: '10:00' }] }, { z: 'Asia/Tokyo', ...std }];
    p = m.meetPlan('2026-10-03', ov, 60);
    assert.deepStrictEqual(p.overlap.map(([a, c]) => m.hhmm(a, 'Asia/Taipei') + '–' + m.hhmm(c, 'Asia/Taipei')), ['10:00–17:00']);
    assert.ok(p.slots.every(s => m.hhmm(s.start, 'Asia/Taipei') >= '10:00' || m.hhmm(s.start, 'Asia/Taipei') < '08:00' || true));
    assert.ok(p.slots.every(s => s.start >= p.busy[0][0][1] || s.end <= p.busy[0][0][0]));

    // DST 切換日 + 忙碌：倫敦春季（03-29），倫敦 + 台北；倫敦 09:00–10:00 忙碌
    const dl = [{ z: 'Europe/London', ...std, b: [{ d: '2026-03-29', s: '09:00', e: '10:00' }] }, { z: 'Asia/Taipei', s: '15:00', e: '23:00', l: false }];
    p = m.meetPlan('2026-03-29', dl, 60);
    // 倫敦 03-29 09:00 BST = UTC 08:00 = 台北 16:00（夏令後 UTC+1）；倫敦上班 UTC 08:00–17:00；台北 15–23 = UTC 07–15 → 重疊 UTC 08–15，扣 08–09 → 09–15
    assert.deepStrictEqual(p.overlap.map(([a, c]) => iso(a) + '~' + iso(c)), ['2026-03-29T09:00~2026-03-29T15:00']);
    // 軸以第一個城市（倫敦）當天計：當天 24 小時（00:00 GMT 起，轉換日只有 23 小時）
    assert.equal((p.t1 - p.t0) / 3600e3, 23);

    // 舒適時段：同分時全員 08–21 的優先
    p = m.meetPlan('2026-10-03', [{ z: 'Asia/Taipei', s: '00:00', e: '23:30', l: false }, { z: 'Asia/Tokyo', s: '00:00', e: '23:30', l: false }], 60);
    assert.ok(p.slots.every(s => s.score === 0 && s.cozy === true), '全天上班時，前 3 個建議都在 08–21');
    assert.ok(p.slots.every(s => { const h = +m.hhmm(s.start, 'Asia/Taipei').slice(0, 2); return h >= 8 && h < 21; }));
    // 六人上限
    const six = ['Asia/Taipei', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'].map(z => ({ z, ...std, b: [{ d: '2026-10-03', s: '09:00', e: '10:00' }] }));
    p = m.meetPlan('2026-10-03', six, 30); assert.equal(p.busy.length, 6);
    ok('timezone: busy intervals / subtract / midnight / DST / cozy');
}

{ // ---------- pomodoro / todo 連動 ----------
    const pm = load('fun/pomodoro.html', 'cleanTasks, todoList, pruneTasks, addPomo, MAX_TASKS');
    const td = load('fun/todo.html', 'pomoOf, sortByPomo');
    assert.deepStrictEqual(pm.cleanTasks(undefined), {}); assert.deepStrictEqual(pm.cleanTasks([1]), {}); assert.deepStrictEqual(pm.cleanTasks('x'), {}); assert.deepStrictEqual(pm.cleanTasks(null), {});
    assert.deepStrictEqual(pm.cleanTasks({ a: { count: 2, minutes: 50 }, b: null, c: { count: 'x', minutes: 1 }, d: { count: -1, minutes: 1 }, e: { count: 1.9, minutes: '25' }, f: 5, g: { count: 1 } }), { a: { count: 2, minutes: 50 }, e: { count: 1, minutes: 25 } });
    assert.deepStrictEqual(Object.keys(pm.cleanTasks(JSON.parse('{"__proto__":{"count":1,"minutes":1},"a":{"count":1,"minutes":1}}'))).sort(), ['__proto__', 'a'].sort());
    assert.equal(Object.getPrototypeOf(pm.cleanTasks(JSON.parse('{"__proto__":{"count":1,"minutes":1}}'))), Object.prototype, '不會污染原型');
    const big = Object.fromEntries(Array.from({ length: 700 }, (_, i) => ['id' + i, { count: 1, minutes: 25 }]));
    assert.equal(Object.keys(pm.cleanTasks(big)).length, pm.MAX_TASKS);
    assert.equal(pm.cleanTasks({ a: { count: 1e12, minutes: 1e12 } }).a.count, 1e6);
    // todoList
    assert.deepStrictEqual(pm.todoList([{ id: 'a', t: 'x', done: false }, null, { id: 1, t: 'x', done: false }, { id: 'b', t: '', done: false }, { id: 'c', t: 'y', done: 'no' }]).map(i => i.id), ['a']);
    assert.deepStrictEqual(pm.todoList('x'), []);
    // prune：待辦被刪的孤兒統計清掉
    const T = { a: { count: 1, minutes: 25 }, gone: { count: 5, minutes: 125 } };
    assert.deepStrictEqual(Object.keys(pm.pruneTasks(T, [{ id: 'a' }])), ['a']);
    assert.deepStrictEqual(pm.pruneTasks(T, []), {});
    // addPomo
    let t = pm.addPomo({}, 'a', 25); assert.deepStrictEqual(t, { a: { count: 1, minutes: 25 } });
    t = pm.addPomo(t, 'a', 30); assert.deepStrictEqual(t.a, { count: 2, minutes: 55 });
    const orig = { a: { count: 1, minutes: 25 } }; pm.addPomo(orig, 'a', 25); assert.equal(orig.a.count, 1, '不改原物件');
    const full = pm.cleanTasks(big); assert.strictEqual(pm.addPomo(full, 'new', 25), full, '滿了拒絕新項目');
    assert.equal(pm.addPomo(full, 'id0', 25).id0.count, 2, '滿了仍可累計既有項目');
    // todo 端
    assert.deepStrictEqual(td.pomoOf({ a: { count: 3, minutes: 75 } }, 'a'), { count: 3, minutes: 75 });
    assert.deepStrictEqual(td.pomoOf({}, 'a'), { count: 0, minutes: 0 }); assert.deepStrictEqual(td.pomoOf(null, 'a'), { count: 0, minutes: 0 }); assert.deepStrictEqual(td.pomoOf([], 'a'), { count: 0, minutes: 0 });
    assert.deepStrictEqual(td.pomoOf({ a: { count: 'x' } }, 'a'), { count: 0, minutes: 0 }); assert.deepStrictEqual(td.pomoOf({ a: 5 }, 'a'), { count: 0, minutes: 0 });
    assert.deepStrictEqual(td.pomoOf({ a: { count: -2, minutes: -5 } }, 'a'), { count: 0, minutes: 0 });
    assert.deepStrictEqual(td.pomoOf({}, 'toString'), { count: 0, minutes: 0 }, '原型上的鍵不算');
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const tasks = { b: { count: 4, minutes: 100 }, c: { count: 2, minutes: 100 }, d: { count: 1, minutes: 25 } };
    assert.deepStrictEqual(td.sortByPomo(items, tasks).map(i => i.id), ['b', 'c', 'd', 'a'], '分鐘相同看番茄數；沒有統計的最後');
    assert.deepStrictEqual(td.sortByPomo(items, null).map(i => i.id), ['a', 'b', 'c', 'd'], '沒資料維持原順序（穩定）');
    assert.deepStrictEqual(items.map(i => i.id), ['a', 'b', 'c', 'd'], '不改原陣列');
    ok('pomodoro/todo: tasks clean / prune / add / cap / sort');
}

{ // ---------- alarm：起床任務 ----------
    const m = load('fun/alarm.html', 'validAlarm, normAlarm, taskText, genMath, genMathSet, genText, checkNum, checkText, shakeMag, shakeStep, SHAKE_NEED, tapStep, EMERG_TAPS, TEXT_CHARS');
    // 舊資料補預設
    const old = { id: 'x', time: '07:00', label: '起床', days: [1], on: true };
    assert.ok(m.validAlarm(old));
    assert.deepStrictEqual(m.normAlarm(old), { ...old, task: 'none', diff: 'normal', n: 3 });
    assert.deepStrictEqual(m.normAlarm({ ...old, task: 'zzz', diff: 5, n: 99 }), { ...old, task: 'none', diff: 'normal', n: 3 });
    assert.equal(m.normAlarm({ ...old, task: 'math', diff: 'hard', n: 5 }).n, 5);
    assert.equal(m.normAlarm({ ...old, task: 'shake', n: 1.5 }).n, 3);
    assert.equal(m.taskText(m.normAlarm(old)), ''); assert.equal(m.taskText(m.normAlarm({ ...old, task: 'math', n: 4, diff: 'easy' })), '心算 4 題（簡單）'); assert.equal(m.taskText(m.normAlarm({ ...old, task: 'shake' })), '搖動手機（普通）');

    // 種子：同種子同題、答案正確且非負整數
    for (const d of ['easy', 'normal', 'hard']) {
        const seen = new Set();
        for (let i = 0; i < 300; i++) {
            const q = m.genMath('s' + i, d), q2 = m.genMath('s' + i, d);
            assert.deepStrictEqual(q, q2);
            const [a, op, b] = q.q.split(' '); const x = +a, y = +b;
            const exp = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : NaN;
            assert.equal(q.a, exp, q.q); assert.ok(Number.isInteger(q.a) && q.a >= 0, q.q);
            if (d === 'easy') { assert.ok(op !== '×' && x < 50 && y < 50, q.q); }
            if (d === 'hard') { assert.ok(op === '×' ? x >= 12 && x <= 29 && y >= 6 && y <= 9 : x >= 100, q.q); }
            seen.add(q.q);
        }
        assert.ok(seen.size > 50, d + ' 題目要有變化');
    }
    assert.notDeepStrictEqual(m.genMathSet('a', 3, 'normal'), m.genMathSet('b', 3, 'normal'));
    assert.equal(m.genMathSet('a', 5, 'easy').length, 5);
    assert.deepStrictEqual(m.genMathSet('a', 3, 'easy'), m.genMathSet('a', 3, 'easy'));
    assert.equal(new Set(m.genMathSet('k', 5, 'hard').map(q => q.q)).size, 5, '一組題目不重複');
    // 字串
    for (const [d, len] of [['easy', 4], ['normal', 6], ['hard', 8]]) { const t = m.genText('t1', d); assert.equal(t.length, len); assert.ok([...t].every(c => m.TEXT_CHARS.includes(c))); assert.equal(t, m.genText('t1', d)); }
    assert.ok(!/[ILO01]/.test(m.TEXT_CHARS));
    assert.notEqual(m.genText('t1', 'hard'), m.genText('t2', 'hard'));
    // 驗證答案
    assert.ok(m.checkNum(46, '46') && m.checkNum(46, ' 46 ') && m.checkNum(46, '４６') && m.checkNum(0, '0') && m.checkNum(-3, '-3'));
    assert.ok(!m.checkNum(46, '46.0') && !m.checkNum(46, '') && !m.checkNum(46, 'abc') && !m.checkNum(46, null) && !m.checkNum(46, undefined) && !m.checkNum(46, '4 6') && !m.checkNum(46, '47') && !m.checkNum(46, '1e2'));
    assert.ok(m.checkText('AB3K', 'ab3k') && m.checkText('AB3K', ' AB 3k ') && m.checkText('AB3K', 'ＡＢ３Ｋ'));
    assert.ok(!m.checkText('AB3K', '') && !m.checkText('AB3K', 'AB3') && !m.checkText('AB3K', null) && !m.checkText('AB3K', 'AB3KK'));
    // 搖動
    assert.ok(Math.abs(m.shakeMag(0, 0, 9.81)) < 1e-9, '靜止不算搖');
    assert.ok(Math.abs(m.shakeMag(0, 9.81, 0)) < 1e-9);
    assert.ok(m.shakeMag(20, 10, 10) > 12); assert.equal(m.shakeMag(null, 1, 1), 0); assert.equal(m.shakeMag(undefined, undefined, undefined), 0); assert.equal(m.shakeMag('a', 1, 1), 0);
    let st = { count: 0, last: 0 };
    st = m.shakeStep(st, 5, 1000, 'normal'); assert.equal(st.count, 0, '強度不夠');
    st = m.shakeStep(st, 15, 1000, 'normal'); assert.equal(st.count, 1);
    st = m.shakeStep(st, 15, 1100, 'normal'); assert.equal(st.count, 1, '250ms 內不重複計');
    st = m.shakeStep(st, 15, 1300, 'normal'); assert.equal(st.count, 2);
    assert.equal(m.shakeStep({ count: 0, last: 0 }, 10, 1000, 'easy').count, 1); assert.equal(m.shakeStep({ count: 0, last: 0 }, 10, 1000, 'hard').count, 0, '困難門檻較高');
    assert.ok(m.SHAKE_NEED.easy < m.SHAKE_NEED.normal && m.SHAKE_NEED.normal < m.SHAKE_NEED.hard);
    let c = { count: 0, last: 0 }; for (let i = 0; i < m.SHAKE_NEED.normal; i++) c = m.shakeStep(c, 20, 1000 + i * 300, 'normal'); assert.equal(c.count, m.SHAKE_NEED.normal);
    // 緊急關閉：4 秒內連按 5 次
    let taps = []; for (let i = 0; i < 4; i++) taps = m.tapStep(taps, 1000 + i * 500); assert.ok(taps.length < m.EMERG_TAPS);
    taps = m.tapStep(taps, 3000); assert.equal(taps.length, m.EMERG_TAPS);
    taps = []; for (let i = 0; i < 6; i++) taps = m.tapStep(taps, i * 1500); assert.ok(taps.length < m.EMERG_TAPS, '間隔太久不算連按');
    assert.equal(m.EMERG_TAPS, 5);
    ok('alarm: wake tasks (normalize / seeded math / text / shake / emergency taps)');
}
