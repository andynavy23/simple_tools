// 批次 e3：計時器間歇訓練、寶寶作息記錄、色盲模擬、五十音練習
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ---------------- 1. 計時器：間歇訓練 ----------------
{
    const m = load('fun/timers.html', 'fmtMs, cleanIv, ivTotalMs, ivTimeline, ivEnd, ivLocate, ivSkipTo, ivCue, ivSpeech, ivSummary, cleanIvList, addIv, delIv, cleanIvOpt, IV_PRESETS, IV_MAX, IV_MAX_MS');
    const T = m.IV_PRESETS.tabata;
    // 時間軸展開
    let tl = m.ivTimeline(T);
    assert.deepStrictEqual(tl.map(p => p.type).join(), 'prep,work,rest,work,rest,work,rest,work,rest,work,rest,work,rest,work,rest,work');
    assert.strictEqual(tl.length, 16); // 預備 + 8 工作 + 7 休息（最後一回合不休息）
    assert.strictEqual(m.ivEnd(tl), (10 + 8 * 20 + 7 * 10) * 1000);
    assert.strictEqual(m.ivTotalMs(m.cleanIv(T)), m.ivEnd(tl));
    assert.ok(tl.every((p, i) => i === 0 ? p.at === 0 : p.at === tl[i - 1].at + tl[i - 1].ms), '階段首尾相接');
    assert.deepStrictEqual([tl[1].round, tl[1].set, tl[15].round], [1, 1, 8]);
    ok('timers iv: tabata timeline = 10+160+70 s, last rest dropped');

    // EMOM：休息 0 秒略過
    tl = m.ivTimeline(m.IV_PRESETS.emom);
    assert.strictEqual(tl.length, 11); assert.ok(tl.slice(1).every(p => p.type === 'work' && p.ms === 60000));
    assert.strictEqual(m.ivEnd(tl), 10 * 60000 + 10000);
    // 預備 0 秒略過
    tl = m.ivTimeline({ prep: 0, work: 5, rest: 0, rounds: 1, sets: 1, setRest: 0 }); assert.strictEqual(tl.length, 1);
    ok('timers iv: zero-length phases skipped');

    // 多組 + 組間休息：組間用 setrest、不重複插入一般休息
    const c2 = { prep: 5, work: 30, rest: 10, rounds: 3, sets: 2, setRest: 60 };
    tl = m.ivTimeline(c2);
    assert.deepStrictEqual(tl.map(p => p.type).join(), 'prep,work,rest,work,rest,work,setrest,work,rest,work,rest,work');
    assert.strictEqual(m.ivEnd(tl), m.ivTotalMs(m.cleanIv(c2)));
    assert.strictEqual(m.ivEnd(tl), (5 + 2 * (3 * 30 + 2 * 10) + 60) * 1000);
    assert.deepStrictEqual([tl[6].round, tl[6].set, tl[7].round, tl[7].set], [3, 1, 1, 2]);
    ok('timers iv: multi sets with set rest');

    // 隨機設定：closed form 與展開一致
    for (let i = 0; i < 200; i++) {
        const c = { prep: i % 7, work: 1 + i % 13, rest: i % 5, rounds: 1 + i % 9, sets: 1 + i % 4, setRest: i % 6 };
        assert.strictEqual(m.ivEnd(m.ivTimeline(c)), m.ivTotalMs(c), JSON.stringify(c));
    }
    ok('timers iv: total closed-form equals expanded timeline (200 configs)');

    // 依經過時間找階段
    tl = m.ivTimeline(T);
    let l = m.ivLocate(tl, 0); assert.deepStrictEqual([l.index, l.into, l.left, l.done], [0, 0, 10000, false]);
    l = m.ivLocate(tl, 9999); assert.strictEqual(l.index, 0);
    l = m.ivLocate(tl, 10000); assert.deepStrictEqual([l.index, l.phase.type, l.into, l.left], [1, 'work', 0, 20000]);
    l = m.ivLocate(tl, 29999); assert.strictEqual(l.index, 1);
    l = m.ivLocate(tl, 30000); assert.deepStrictEqual([l.index, l.phase.type, l.left], [2, 'rest', 10000]);
    l = m.ivLocate(tl, 5 * 60000); assert.strictEqual(l.done, true); assert.strictEqual(l.index, tl.length);
    const end = m.ivEnd(tl); assert.strictEqual(m.ivLocate(tl, end - 1).done, false); assert.strictEqual(m.ivLocate(tl, end).done, true);
    assert.strictEqual(m.ivLocate(tl, -50).index, 0); assert.strictEqual(m.ivLocate(tl, NaN).done, true); assert.strictEqual(m.ivLocate([], 0).done, true);
    // 逐毫秒掃過：階段單調遞增、into + left = ms
    let prev = 0; for (let t = 0; t < end; t += 137) { const x = m.ivLocate(tl, t); assert.ok(x.index >= prev); prev = x.index; assert.strictEqual(x.into + x.left, x.phase.ms); }
    ok('timers iv: locate by elapsed (boundaries, binary search, done)');

    // 跳過
    assert.strictEqual(m.ivSkipTo(tl, 0), 10000); assert.strictEqual(m.ivSkipTo(tl, 12000), 30000); assert.strictEqual(m.ivSkipTo(tl, end - 1), end); assert.strictEqual(m.ivSkipTo(tl, end + 5), end);
    ok('timers iv: skip target');

    // 提示音：換階段一次、最後 3 秒每秒一次、背景回來不連響
    let last = null, cues = [];
    for (let t = 0; t <= end; t += 100) { const c = m.ivCue(last, m.ivLocate(tl, t)); last = c.next; if (c.cue) cues.push([t, c.cue]); }
    assert.strictEqual(cues.filter(c => c[1] === 'phase').length, 16); assert.strictEqual(cues.filter(c => c[1] === 'done').length, 1);
    assert.deepStrictEqual(cues[cues.length - 1], [end, 'done']);
    // 20 秒工作階段（10000–30000）：剩 3、2、1 秒（27000、28000、29000）
    assert.deepStrictEqual(cues.filter(c => c[1] === 'tick' && c[0] > 10000 && c[0] < 30000).map(c => c[0]), [27000, 28000, 29000]);
    ok('timers iv: cue sequence');
    // 背景回來：從階段 1 直接跳到階段 9，只有一次 phase
    let a = m.ivCue(null, m.ivLocate(tl, 10500)); let b = m.ivCue(a.next, m.ivLocate(tl, 150000)); assert.strictEqual(b.cue, 'phase');
    assert.strictEqual(m.ivCue(b.next, m.ivLocate(tl, 150000)).cue, null);
    // 同一秒內重複呼叫不重複響
    const x1 = m.ivCue({ index: 1, sec: 0 }, m.ivLocate(tl, 27500)); assert.strictEqual(x1.cue, 'tick'); assert.strictEqual(m.ivCue(x1.next, m.ivLocate(tl, 27900)).cue, null);
    ok('timers iv: cue after background, no repeats');

    // 清理：範圍、型別、缺欄位
    assert.deepStrictEqual(m.cleanIv(null), { name: '', prep: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 0 });
    assert.deepStrictEqual(m.cleanIv({ prep: -5, work: 0, rest: 99999, rounds: 500, sets: 'x', setRest: '12.9', name: '  ' + 'a'.repeat(50) }), { name: 'a'.repeat(20), prep: 0, work: 1, rest: 3600, rounds: 99, sets: 1, setRest: 12 });
    assert.strictEqual(m.cleanIv({ work: Infinity }).work, 20); assert.strictEqual(m.cleanIv({ name: 123 }).name, '');
    assert.ok(m.ivTotalMs(m.cleanIv({ work: 3600, rounds: 99, sets: 99 })) > m.IV_MAX_MS, '上限判斷可擋下超長設定');
    assert.ok(m.ivTotalMs(m.cleanIv(T)) <= m.IV_MAX_MS);
    ok('timers iv: cleanIv clamps and fills defaults');

    // 常用組合：上限、拒絕、id 刪除、壞資料
    let list = []; for (let i = 0; i < m.IV_MAX; i++) { list = m.addIv(list, { name: 'n' + i }, 'id' + i); assert.ok(list); }
    assert.strictEqual(list.length, 30); assert.strictEqual(m.addIv(list, {}, 'x'), null, '滿了拒絕新增');
    list = m.delIv(list, 'id5'); assert.strictEqual(list.length, 29); assert.ok(!list.some(x => x.id === 'id5')); assert.strictEqual(list[5].id, 'id6');
    assert.strictEqual(m.delIv(list, 'nope').length, 29);
    assert.deepStrictEqual(m.cleanIvList(null), []); assert.deepStrictEqual(m.cleanIvList('x'), []); assert.deepStrictEqual(m.cleanIvList({}), []);
    const dirty = m.cleanIvList([null, 5, 'a', { id: 'a', name: 'A', work: 30 }, { id: 'a', name: 'dup' }, { name: 'noid', work: -1 }, [], { id: '!!bad id', rounds: 3 }]);
    assert.strictEqual(dirty.length, 5); assert.strictEqual(new Set(dirty.map(x => x.id)).size, 5, 'id 不重複'); assert.strictEqual(dirty[0].work, 30); assert.strictEqual(dirty[2].work, 1);
    assert.ok(dirty.every(x => /^[\w-]{1,40}$/.test(x.id)));
    assert.strictEqual(m.cleanIvList(Array.from({ length: 100 }, (_, i) => ({ id: 'k' + i }))).length, 30, '還原備份超量截斷');
    assert.deepStrictEqual(m.cleanIvOpt(null), { beep: true, voice: true }); assert.deepStrictEqual(m.cleanIvOpt({ beep: false, voice: 0 }), { beep: false, voice: true }); assert.deepStrictEqual(m.cleanIvOpt([]), { beep: true, voice: true });
    ok('timers iv: saved list cap/reject/delete by id/validation');

    // 語音與摘要
    const cc = m.cleanIv(T);
    assert.strictEqual(m.ivSpeech({ type: 'work', round: 3 }, cc), '第 3 回合'); assert.strictEqual(m.ivSpeech({ type: 'work', round: 8 }, cc), '最後一回合');
    assert.strictEqual(m.ivSpeech({ type: 'work', round: 1 }, m.cleanIv({ rounds: 1 })), '第 1 回合'); assert.strictEqual(m.ivSpeech({ type: 'rest' }, cc), '休息'); assert.strictEqual(m.ivSpeech(null, cc), '完成');
    assert.strictEqual(m.ivSummary(cc), '預備 10 秒，20 秒工作 / 10 秒休息 × 8 回合，共 04:00');
    assert.ok(m.ivSummary(m.cleanIv({ sets: 3, setRest: 60 })).includes('3 組（組間休息 60 秒）'));
    ok('timers iv: speech and summary');
}

// ---------------- 2. 寶寶作息記錄 ----------------
{
    const m = load('fun/baby-log.html', 'twDay, twHM, twLocal, twParse, cleanEntry, cleanLog, addEntry, updateEntry, deleteEntry, stopEntry, effEnd, splitByDay, dayStats, lastFeed, rangeStats, metricOf, fmtDur, describe, timeRange, toCsv, MAX_LOG, MAX_NOTE, MAX_ML');
    const H = 3600000, MIN = 60000, D0 = Date.UTC(2025, 0, 10) - 8 * H;     // 台灣 2025-01-10 00:00
    const at = (h, mi = 0, d = 0) => D0 + d * 86400000 + h * H + mi * MIN;
    // 台灣時間
    assert.strictEqual(m.twDay(D0), '2025-01-10'); assert.strictEqual(m.twDay(D0 - 1), '2025-01-09'); assert.strictEqual(m.twHM(at(13, 5)), '13:05');
    assert.strictEqual(m.twLocal(at(23, 59)), '2025-01-10T23:59'); assert.strictEqual(m.twParse('2025-01-10T13:05'), at(13, 5)); assert.strictEqual(m.twParse('2025-01-10 13:05'), at(13, 5));
    for (const bad of ['', 'x', '2025-02-30T10:00', '2025-01-10T25:00', null, undefined, '2025-1-1T1:1']) assert.ok(Number.isNaN(m.twParse(bad)), String(bad));
    ok('baby: Taiwan time helpers');

    // 驗證
    assert.strictEqual(m.cleanEntry(null), null); assert.strictEqual(m.cleanEntry('x'), null); assert.strictEqual(m.cleanEntry({ k: 'zzz', t: at(1) }), null); assert.strictEqual(m.cleanEntry({ k: 'pee', t: 'abc' }), null);
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: 5 }), null, '早於 2000 年');
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: Date.UTC(2200, 0, 1) }), null);
    assert.strictEqual(m.cleanEntry({ k: 'constructor', t: at(1) }), null, '原型鍵不算類型');
    assert.strictEqual(m.cleanEntry({ k: 'bottle', t: at(1), ml: 0 }), null); assert.strictEqual(m.cleanEntry({ k: 'bottle', t: at(1), ml: 9999 }), null); assert.strictEqual(m.cleanEntry({ k: 'bottle', t: at(1) }), null);
    assert.strictEqual(m.cleanEntry({ k: 'bottle', t: at(1), ml: '120.4' }).ml, 120);
    assert.strictEqual(m.cleanEntry({ k: 'note', t: at(1), note: '   ' }), null, '備註不能空白');
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: at(1), note: 'a'.repeat(500) }).note.length, m.MAX_NOTE);
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: at(1), note: 123 }).note, undefined);
    assert.strictEqual(m.cleanEntry({ k: 'sleep', t: at(1), e: at(0) }), null, '結束早於開始');
    assert.strictEqual(m.cleanEntry({ k: 'sleep', t: at(1), e: at(1) + 25 * H }), null, '超過 24 小時');
    assert.strictEqual(m.cleanEntry({ k: 'sleep', t: at(1) }).e, null); assert.strictEqual(m.cleanEntry({ k: 'sleep', t: at(1), e: at(2) }).e, at(2));
    assert.strictEqual(m.cleanEntry({ k: 'breast', t: at(1), side: 'zz' }).side, 'L'); assert.strictEqual(m.cleanEntry({ k: 'breast', t: at(1), side: 'R', e: at(1, 15) }).side, 'R');
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: at(1), e: at(2) }).e, undefined, '尿布沒有結束時間');
    assert.strictEqual(m.cleanEntry({ k: 'pee', t: at(1), id: '!!bad' }).id, '');
    ok('baby: cleanEntry validation');

    // cleanLog：壞資料、id 補齊去重、排序、截斷
    assert.deepStrictEqual(m.cleanLog(null), []); assert.deepStrictEqual(m.cleanLog({}), []); assert.deepStrictEqual(m.cleanLog('x'), []);
    let l = m.cleanLog([null, 3, { k: 'pee', t: at(5), id: 'a' }, { k: 'poo', t: at(2), id: 'a' }, { k: 'zzz', t: at(1) }, { k: 'pee', t: at(1) }]);
    assert.strictEqual(l.length, 3); assert.deepStrictEqual(l.map(x => x.t), [at(1), at(2), at(5)]); assert.strictEqual(new Set(l.map(x => x.id)).size, 3); assert.ok(l.every(x => /^[\w-]{1,40}$/.test(x.id)));
    const many = Array.from({ length: m.MAX_LOG + 50 }, (_, i) => ({ k: 'pee', t: at(0) + i * MIN, id: 'i' + i }));
    l = m.cleanLog(many); assert.strictEqual(l.length, m.MAX_LOG); assert.strictEqual(l[l.length - 1].id, 'i' + (m.MAX_LOG + 49), '超量只留最新');
    ok('baby: cleanLog tolerant, sorted, capped');

    // 新增 / 上限 / 進行中唯一 / 編輯 / 刪除 / 結束
    let log = [], r;
    r = m.addEntry(log, { k: 'bottle', t: at(8), ml: 120 }); assert.ok(r.log && r.entry.id); log = r.log;
    r = m.addEntry(log, { k: 'bottle', t: at(9), ml: 0 }); assert.ok(r.err);
    r = m.addEntry(log, { k: 'sleep', t: at(22), e: null }); log = r.log; const sid = r.entry.id;
    r = m.addEntry(log, { k: 'sleep', t: at(23), e: null }); assert.ok(/進行中/.test(r.err), '同類型只能一筆進行中');
    r = m.addEntry(log, { k: 'breast', t: at(23), e: null, side: 'L' }); assert.ok(r.log, '不同類型可同時進行'); log = r.log;
    r = m.stopEntry(log, sid, at(22) + 8 * H); assert.strictEqual(r.entry.e, at(22) + 8 * H); log = r.log;
    assert.ok(m.stopEntry(log, sid, at(5)).err, '已結束'); assert.ok(m.stopEntry(log, 'nope', 1).err);
    const bid = log.find(x => x.k === 'breast').id;
    assert.strictEqual(m.stopEntry(log, bid, at(1)).entry.e, at(23), '結束時間不早於開始');
    assert.strictEqual(m.stopEntry(log, bid, at(23) + 99 * H).entry.e, at(23) + 24 * H, '最長 24 小時');
    // 編輯：改時間後仍排序；找不到 id；壞資料
    const bt = log.find(x => x.k === 'bottle'); r = m.updateEntry(log, bt.id, { k: 'bottle', t: at(23, 30), ml: 90 }); assert.strictEqual(r.log[r.log.length - 1].id, bt.id); assert.strictEqual(r.entry.ml, 90);
    assert.ok(m.updateEntry(log, 'nope', { k: 'pee', t: at(1) }).err); assert.ok(m.updateEntry(log, bt.id, { k: 'bottle', t: at(1), ml: -5 }).err);
    assert.ok(m.updateEntry(log, sid, { k: 'sleep', t: at(22), e: null, id: sid }).log, '同一筆改回進行中可（沒有其他進行中睡眠）');
    // 刪除用 id
    const n0 = log.length; log = m.deleteEntry(log, bt.id); assert.strictEqual(log.length, n0 - 1); assert.ok(!log.some(x => x.id === bt.id)); assert.strictEqual(m.deleteEntry(log, 'nope').length, log.length);
    // 上限
    const full = m.cleanLog(many); r = m.addEntry(full, { k: 'pee', t: at(1) }); assert.ok(/3000/.test(r.err) && !r.log, '滿了拒絕新增'); assert.strictEqual(full.length, m.MAX_LOG);
    r = m.addEntry(m.deleteEntry(full, 'i50'), { k: 'pee', t: at(1) }); assert.ok(r.log, '刪一筆後可新增');
    ok('baby: add/update/delete/stop, cap rejects');

    // 跨午夜切割
    assert.deepStrictEqual(m.splitByDay(at(22), at(30)), [{ day: '2025-01-10', ms: 2 * H }, { day: '2025-01-11', ms: 6 * H }]);
    assert.deepStrictEqual(m.splitByDay(at(10), at(11)), [{ day: '2025-01-10', ms: H }]); assert.deepStrictEqual(m.splitByDay(at(10), at(10)), []);
    assert.deepStrictEqual(m.splitByDay(at(0), at(24)), [{ day: '2025-01-10', ms: 24 * H }]);
    const sp3 = m.splitByDay(at(23), at(23, 0, 2)); assert.strictEqual(sp3.length, 3); assert.strictEqual(sp3.reduce((a, b) => a + b.ms, 0), 48 * H);
    ok('baby: split by Taiwan midnight');

    // 統計
    const now = at(15);
    const L = m.cleanLog([
        { k: 'breast', t: at(7), e: at(7, 20), side: 'L', id: '1' }, { k: 'bottle', t: at(10), ml: 120, id: '2' }, { k: 'bottle', t: at(13), ml: 150, id: '3' }, { k: 'solid', t: at(12), id: '4', note: '米糊' },
        { k: 'sleep', t: at(-2), e: at(6), id: '5' },                      // 前一晚 22:00 → 06:00
        { k: 'sleep', t: at(13), e: at(14, 30), id: '6' }, { k: 'pee', t: at(8), id: '7' }, { k: 'poo', t: at(9), id: '8' }, { k: 'pee', t: at(11), id: '9' },
        { k: 'sleep', t: at(14), e: null, id: '10' }, { k: 'note', t: at(9), note: '疫苗', id: '11' }, { k: 'bottle', t: at(8, 0, 1), ml: 60, id: '12' }]);
    const s = m.dayStats(L, '2025-01-10', now);
    assert.deepStrictEqual([s.feeds, s.breast, s.bottle, s.solid, s.ml], [4, 1, 2, 1, 270]); assert.strictEqual(s.breastMs, 20 * MIN);
    assert.deepStrictEqual([s.pee, s.poo, s.diapers, s.notes], [2, 1, 3, 1]);
    assert.strictEqual(s.sleepMs, 6 * H + 90 * MIN + 1 * H, '跨午夜睡眠切入 6h + 90 分 + 進行中睡眠到現在 1h（14:00 → 15:00）');
    assert.strictEqual(s.lastFeed, at(13)); assert.strictEqual(s.avgGap, (at(13) - at(7)) / 3);
    const s2 = m.dayStats(L, '2025-01-09', now); assert.strictEqual(s2.sleepMs, 2 * H, '前一天只算 22:00-24:00'); assert.strictEqual(s2.feeds, 0); assert.strictEqual(s2.avgGap, null);
    assert.strictEqual(m.dayStats([], '2025-01-10', now).feeds, 0);
    // 進行中睡眠最多算 24 小時
    assert.strictEqual(m.effEnd({ k: 'sleep', t: at(0), e: null }, at(0) + 100 * H), at(0) + 24 * H); assert.strictEqual(m.effEnd({ k: 'sleep', t: at(5), e: null }, at(1)), at(5), '現在早於開始不為負');
    // 距離上次餵奶
    const lf = m.lastFeed(L, now); assert.strictEqual(lf.k, 'bottle'); assert.strictEqual(lf.since, 2 * H); assert.strictEqual(m.lastFeed([], now), null);
    assert.strictEqual(m.lastFeed(m.cleanLog([{ k: 'pee', t: at(1) }]), now), null, '尿布不算餵奶');
    assert.ok(m.lastFeed(L, at(9)).t <= at(9), '不算未來的');
    // 區間
    const rs = m.rangeStats(L, '2025-01-11', 7, now); assert.strictEqual(rs.length, 7); assert.strictEqual(rs[6].day, '2025-01-11'); assert.strictEqual(rs[0].day, '2025-01-05'); assert.strictEqual(rs[5].feeds, 4); assert.strictEqual(rs[6].ml, 60);
    assert.strictEqual(m.rangeStats(L, '2025-01-11', 14, now).length, 14);
    assert.strictEqual(m.metricOf(s, 'ml'), 270); assert.strictEqual(m.metricOf(s, 'diapers'), 3); assert.strictEqual(m.metricOf(s, 'feeds'), 4); assert.strictEqual(m.metricOf({ sleepMs: 7.5 * H }, 'sleep'), 7.5);
    ok('baby: day stats incl. overnight sleep, last feed, range');

    // 文字
    assert.strictEqual(m.fmtDur(0), '0 分'); assert.strictEqual(m.fmtDur(90 * MIN), '1 小時 30 分'); assert.strictEqual(m.fmtDur(2 * H), '2 小時'); assert.strictEqual(m.fmtDur(-5), '0 分');
    assert.strictEqual(m.timeRange({ k: 'sleep', t: at(22), e: at(30) }), '22:00 → 06:00（隔日）'); assert.strictEqual(m.timeRange({ k: 'sleep', t: at(13), e: at(14) }), '13:00 → 14:00'); assert.strictEqual(m.timeRange({ k: 'pee', t: at(9, 5) }), '09:05');
    assert.strictEqual(m.describe({ k: 'bottle', t: at(1), ml: 100 }, now), '瓶餵 100 ml'); assert.ok(m.describe({ k: 'sleep', t: at(14), e: null }, now).includes('進行中 1 小時'));
    assert.ok(m.describe({ k: 'breast', t: at(1), e: at(1, 15), side: 'R' }, now).startsWith('母乳 右 15 分'));
    ok('baby: formatting');

    // CSV
    const csv = m.toCsv(m.cleanLog([{ k: 'bottle', t: at(8), ml: 120, note: '=SUM(A1)' }, { k: 'sleep', t: at(22), e: at(30), id: 's' }, { k: 'pee', t: at(9), note: 'a,"b"' }]));
    const lines = csv.trim().split(/\r?\n/); assert.strictEqual(lines[0], '日期,開始,結束,類型,左右,奶量(ml),分鐘,備註'); assert.strictEqual(lines.length, 4);
    assert.ok(csv.includes("'=SUM(A1)") && csv.includes(',120,'), csv);
    assert.ok(csv.includes('2025-01-11 06:00') && csv.includes(',480,'), '睡眠結束與分鐘'); assert.ok(csv.includes('"a,""b"""'), '逗號與引號跳脫');
    assert.strictEqual(m.toCsv([]).trim(), '日期,開始,結束,類型,左右,奶量(ml),分鐘,備註');
    ok('baby: csv export (escaped, formula-safe)');
}

// ---------------- 3. 色彩工具：色盲模擬 ----------------
{
    const m = load('utils/color-tools.html', 'parseColor, toHex, simulate, simulateSev, mixMatrix, srgbLin, linSrgb, simulateImage, fitSize, rgbToLab, deltaE, parsePalette, diagnose, CVD, CVD_KINDS, ANOMALY, MAX_PAL');
    // 伽瑪
    for (let v = 0; v <= 255; v++) near(m.linSrgb(m.srgbLin(v)), v, 1e-9);
    near(m.srgbLin(255), 1); near(m.srgbLin(0), 0); near(m.srgbLin(128), 0.2158605, 1e-6); near(m.linSrgb(0.5), 187.51603, 1e-6);
    // 白 / 黑 / 灰在所有色盲下不變（每列矩陣和 = 1；容許四捨五入差 1）
    for (const [k, name, mx] of m.CVD_KINDS) {
        for (const g of [0, 17, 64, 128, 200, 255]) { const o = m.simulate({ r: g, g, b: g }, mx); for (const ch of [o.r, o.g, o.b]) assert.ok(Math.abs(ch - g) <= 1, `${name} gray ${g} -> ${ch}`); }
        for (const row of mx) near(row.reduce((a, b) => a + b, 0), 1, 1e-4);
    }
    assert.deepStrictEqual(m.simulate({ r: 255, g: 255, b: 255 }, m.CVD['紅色盲 Protanopia']), { r: 255, g: 255, b: 255 });
    assert.deepStrictEqual(m.simulate({ r: 0, g: 0, b: 0 }, m.CVD['藍黃色盲 Tritanopia']), { r: 0, g: 0, b: 0 });
    ok('cvd: white/black/gray unchanged');
    // 已知值（Machado 2009 嚴重度 1.0 矩陣，線性 RGB）：純紅 → 紅色盲 = 第一欄 [0.152286, 0.114503, -0.003882] 夾 0..1 後轉 sRGB
    const exp = (col) => ({ r: Math.round(m.linSrgb(col[0])), g: Math.round(m.linSrgb(col[1])), b: Math.round(m.linSrgb(col[2])) });
    assert.deepStrictEqual(m.simulate({ r: 255, g: 0, b: 0 }, m.CVD['紅色盲 Protanopia']), exp([0.152286, 0.114503, -0.003882]));
    assert.deepStrictEqual(m.simulate({ r: 255, g: 0, b: 0 }, m.CVD['綠色盲 Deuteranopia']), exp([0.367322, 0.280085, -0.011820]));
    assert.deepStrictEqual(m.simulate({ r: 0, g: 0, b: 255 }, m.CVD['藍黃色盲 Tritanopia']), exp([-0.178779, 0.147602, 0.303900]));
    const g7 = Math.round(m.linSrgb(0.7152)); assert.deepStrictEqual(m.simulate({ r: 0, g: 255, b: 0 }, m.CVD['全色盲 Achromatopsia']), { r: g7, g: g7, b: g7 });
    const pr = m.simulate({ r: 255, g: 0, b: 0 }, m.CVD['紅色盲 Protanopia']);
    assert.ok(pr.r < 140 && pr.b === 0, '純紅在紅色盲下變暗'); ok('cvd: known Machado values');
    // 嚴重度
    const red = { r: 220, g: 30, b: 40 }, P = m.CVD['紅色盲 Protanopia'];
    assert.deepStrictEqual(m.simulateSev(red, P, 0), red, '嚴重度 0 = 原色');
    assert.deepStrictEqual(m.simulateSev(red, P, 1), m.simulate(red, P));
    assert.deepStrictEqual(m.simulateSev(red, P, 5), m.simulateSev(red, P, 1), '超過夾到 1'); assert.deepStrictEqual(m.simulateSev(red, P, -1), red);
    let prev = -1; for (let s = 0; s <= 10; s++) { const d = m.deltaE(red, m.simulateSev(red, P, s / 10)); assert.ok(d >= prev - 1e-9, '嚴重度越高偏離越多'); prev = d; }
    near(m.mixMatrix(m.CVD['綠色盲 Deuteranopia'], 0.5)[0][0], (1 + 0.367322) / 2); assert.deepStrictEqual(m.mixMatrix(m.CVD['綠色盲 Deuteranopia'], 0), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    assert.deepStrictEqual(Object.keys(m.ANOMALY), ['protan', 'deutan', 'tritan']);
    ok('cvd: anomaly severity interpolation');
    // 圖片：與逐色計算一致、alpha 不動、分塊 = 一次
    const rnd = Util.seeded(7); const px = 500, data = new Uint8ClampedArray(px * 4); for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
    for (const [, , mx] of m.CVD_KINDS) {
        const a = m.simulateImage(new Uint8ClampedArray(data), mx), b = new Uint8ClampedArray(data); for (let f = 0; f < px; f += 64) m.simulateImage(b, mx, f, Math.min(px, f + 64));
        assert.deepStrictEqual([...a], [...b], '分塊結果相同');
        for (let p = 0; p < px; p += 37) { const o = m.simulate({ r: data[p * 4], g: data[p * 4 + 1], b: data[p * 4 + 2] }, mx); for (const [i, v] of [[0, o.r], [1, o.g], [2, o.b]]) assert.ok(Math.abs(a[p * 4 + i] - v) <= 1, 'LUT 與逐色一致'); assert.strictEqual(a[p * 4 + 3], data[p * 4 + 3]); }
    }
    assert.deepStrictEqual(m.fitSize(4000, 2000), { w: 1024, h: 512 }); assert.deepStrictEqual(m.fitSize(500, 300), { w: 500, h: 300 }); assert.deepStrictEqual(m.fitSize(1000, 3000), { w: 341, h: 1024 }); assert.deepStrictEqual(m.fitSize(0, 0), { w: 1, h: 1 });
    ok('cvd: image data conversion, chunking, resize');
    // Lab / ΔE
    const wl = m.rgbToLab({ r: 255, g: 255, b: 255 }); near(wl.L, 100, 1e-3); assert.ok(Math.abs(wl.a) < 0.01 && Math.abs(wl.b) < 0.01); near(m.rgbToLab({ r: 0, g: 0, b: 0 }).L, 0, 1e-6);
    const rl = m.rgbToLab({ r: 255, g: 0, b: 0 }); near(rl.L, 53.24, 2e-3); near(rl.a, 80.09, 5e-3); near(rl.b, 67.20, 5e-3);
    near(m.deltaE({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 100, 1e-3); assert.strictEqual(m.deltaE(red, red), 0); near(m.deltaE(red, { r: 0, g: 0, b: 255 }), m.deltaE({ r: 0, g: 0, b: 255 }, red));
    ok('cvd: Lab and delta E');
    // 色票解析
    assert.deepStrictEqual(m.parsePalette('#e53935, #43A047\nrgb(30,136,229) hsl(0, 100%, 50%) #xyz #12 #e53935').colors, ['#e53935', '#43a047', '#1e88e5', '#ff0000']);
    assert.deepStrictEqual(m.parsePalette('').colors, []); assert.deepStrictEqual(m.parsePalette(null).colors, []); assert.deepStrictEqual(m.parsePalette('#fff #ffffff').colors, ['#ffffff']);
    const manyHex = Array.from({ length: 20 }, (_, i) => '#' + (i * 11 + 16).toString(16).padStart(2, '0').repeat(3)).join(' '); const pp = m.parsePalette(manyHex); assert.strictEqual(pp.colors.length, m.MAX_PAL); assert.ok(pp.over);
    ok('cvd: palette parsing');
    // 診斷
    const d = m.diagnose(['#e53935', '#43a047', '#1e88e5']);
    assert.strictEqual(d.length, 3); assert.ok(d.every((x, i) => i === 0 || d[i - 1].min <= x.min), '依最小 ΔE 排序');
    assert.strictEqual(m.diagnose(['#000000', '#ffffff'])[0].flag, false, '黑白永遠分得開'); assert.ok(m.diagnose(['#000000', '#ffffff'])[0].min > 90);
    const same = m.diagnose(['#336699', '#336698'])[0]; assert.ok(same.flag && same.already, '本來就接近');
    const rg = m.diagnose(['#ff0000', '#00aa00'])[0]; assert.ok(rg.flag && !rg.already, '色盲才難分辨：正常 ΔE ' + rg.orig + ' / 最小 ' + rg.min);
    assert.strictEqual(m.diagnose(['#fff']).length, 0); assert.strictEqual(m.diagnose([]).length, 0); assert.strictEqual(m.diagnose(['#ffffff', 'bad']).length, 0);
    assert.strictEqual(m.diagnose(Array.from({ length: 12 }, (_, i) => '#' + (i * 20).toString(16).padStart(2, '0') + '0000')).length, 66);
    assert.strictEqual(m.diagnose(['#ff0000', '#00aa00'], 0)[0].flag, false, '門檻 0 不標');
    ok('cvd: palette diagnosis');
}

// ---------------- 4. 五十音練習 ----------------
{
    const m = load('mini-games/kana-quiz.html', 'KANA, KANA_BY_ID, GROUPS, toKata, show, normInput, accepts, poolOf, cleanStats, recordAnswer, errRate, weightOf, pickWeighted, pickChoices, makeQuestion, scoreFor, weakest, totals, STAT_CAP');
    const by = (g) => m.KANA.filter(e => e.g === g);
    assert.strictEqual(by('seion').length, 46); assert.strictEqual(by('daku').length, 20); assert.strictEqual(by('handaku').length, 5); assert.strictEqual(by('yoon').length, 33); assert.strictEqual(m.KANA.length, 104);
    assert.strictEqual(new Set(m.KANA.map(e => e.h)).size, 104, '假名不重複');
    assert.strictEqual(by('seion').map(e => e.h).join(''), 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん');
    assert.ok(m.KANA.every(e => e.r.length >= 1 && e.r.every(r => /^[a-z']+$/.test(r))));
    assert.strictEqual(m.poolOf(new Set(['濁音'])).length, 20); assert.strictEqual(m.poolOf(new Set(m.GROUPS)).length, 104); assert.strictEqual(m.poolOf(new Set()).length, 0); assert.strictEqual(m.poolOf(new Set(['あ行'])).length, 5);
    assert.strictEqual(m.GROUPS.length, 13);
    ok('kana: table completeness 46/20/5/33');
    // 片假名
    assert.strictEqual(m.toKata('あいうえお'), 'アイウエオ'); assert.strictEqual(m.toKata('きゃ'), 'キャ'); assert.strictEqual(m.toKata('ぱ'), 'パ'); assert.strictEqual(m.toKata('を'), 'ヲ'); assert.strictEqual(m.toKata('ん'), 'ン'); assert.strictEqual(m.toKata('ぢょ'), 'ヂョ');
    assert.ok(m.KANA.every(e => /^[ァ-ヺ]+$/.test(m.toKata(e.h)))); assert.strictEqual(m.show(m.KANA_BY_ID['か'], 'kata'), 'カ'); assert.strictEqual(m.show(m.KANA_BY_ID['か'], 'hira'), 'か');
    ok('kana: katakana conversion');
    // 羅馬拼音多寫法
    const acc = (h, s) => m.accepts(m.KANA_BY_ID[h], s);
    for (const [h, list] of [['し', ['shi', 'si', 'SHI', ' Shi ', 'ｓｈｉ']], ['ち', ['chi', 'ti']], ['つ', ['tsu', 'tu']], ['ふ', ['fu', 'hu']], ['じ', ['ji', 'zi']], ['ぢ', ['ji', 'di', 'zi']], ['づ', ['zu', 'du', 'dzu']], ['を', ['wo', 'o']], ['ん', ['n', 'nn', "n'", 'n’']],
        ['しゃ', ['sha', 'sya']], ['ちゃ', ['cha', 'tya', 'cya']], ['じゃ', ['ja', 'jya', 'zya']], ['じょ', ['jo', 'jyo', 'zyo']], ['きゃ', ['kya']], ['あ', ['a']]])
        for (const s of list) assert.ok(acc(h, s), h + ' ' + s);
    for (const [h, no] of [['し', ['sh', 'shii', 'ci', '', 'shi!']], ['あ', ['i', 'aa']], ['じ', ['di']], ['か', ['ka ki']], ['ん', ['m']]]) for (const s of no) assert.ok(!acc(h, s), h + ' x ' + s);
    assert.strictEqual(m.normInput(' S H I '), 'shi');
    ok('kana: romaji alternates (shi/si, chi/ti, tsu/tu, fu/hu, ji/zi)');
    // 統計驗證容錯
    assert.deepStrictEqual(m.cleanStats(null), { s: {}, best: 0 }); assert.deepStrictEqual(m.cleanStats([]), { s: {}, best: 0 }); assert.deepStrictEqual(m.cleanStats('x'), { s: {}, best: 0 }); assert.deepStrictEqual(m.cleanStats({ s: [] }), { s: {}, best: 0 });
    const cs = m.cleanStats({ s: { あ: [3, 1], い: [-5, 'x'], う: 'bad', え: [1e12, 2.9], zzz: [1, 1], か: null, き: [0, 0] }, best: 'abc' });
    assert.deepStrictEqual(cs.s, { あ: [3, 1], え: [m.STAT_CAP, 2] }); assert.strictEqual(cs.best, 0); assert.strictEqual(m.cleanStats({ best: 123.9 }).best, 123);
    const huge = {}; for (let i = 0; i < 5000; i++) huge['k' + i] = [1, 1]; m.KANA.forEach(e => { huge[e.h] = [1, 1]; }); assert.strictEqual(Object.keys(m.cleanStats({ s: huge }).s).length, 104, '最多 104 筆');
    // 紀錄
    let st = { s: {}, best: 5 }; st = m.recordAnswer(st, 'あ', true); st = m.recordAnswer(st, 'あ', false); st = m.recordAnswer(st, 'あ', false); assert.deepStrictEqual(st.s['あ'], [1, 2]); assert.strictEqual(st.best, 5);
    const before = JSON.stringify(st); assert.strictEqual(m.recordAnswer(st, 'zzz', true), st); assert.strictEqual(JSON.stringify(st), before, '未知假名不收、不改原物件');
    const t = m.recordAnswer({ s: { あ: [m.STAT_CAP, 0] }, best: 0 }, 'あ', true); assert.strictEqual(t.s['あ'][0], m.STAT_CAP);
    assert.deepStrictEqual(m.totals(st), [1, 2]); assert.deepStrictEqual(m.totals({ s: {}, best: 0 }), [0, 0]);
    ok('kana: stats validation, record, cap');
    // 權重與出題
    assert.strictEqual(m.weightOf(undefined), 2); assert.ok(m.weightOf([30, 0]) < 1.2); assert.ok(m.weightOf([0, 5]) > 6); assert.ok(m.weightOf([5, 5]) > m.weightOf([5, 1])); assert.ok(m.weightOf([0, 1]) > m.weightOf([10, 1]), '次數多的錯率較低');
    assert.ok(m.errRate([0, 0]) === 0.5 && m.errRate(null) === 0);
    const pool = m.poolOf(new Set(['あ行'])), rnd = Util.seeded(42);
    const stw = { s: { あ: [0, 6], い: [20, 0], う: [20, 0], え: [20, 0], お: [20, 0] }, best: 0 }; const hit = {}; for (let i = 0; i < 4000; i++) { const e = m.pickWeighted(pool, stw, rnd, null); hit[e.h] = (hit[e.h] || 0) + 1; }
    assert.ok(hit['あ'] > 4000 * 0.5, 'あ 占比 ' + hit['あ'] / 4000); assert.ok(['い', 'う', 'え', 'お'].every(k => hit[k] > 50), '其他仍會出現');
    const base = { s: {}, best: 0 }; const h2 = {}; for (let i = 0; i < 4000; i++) { const e = m.pickWeighted(pool, base, rnd, null); h2[e.h] = (h2[e.h] || 0) + 1; } assert.ok(Object.values(h2).every(v => v > 650 && v < 950), '沒紀錄時大致均勻');
    let last = null; for (let i = 0; i < 300; i++) { const e = m.pickWeighted(pool, stw, rnd, last); assert.notStrictEqual(e.h, last); last = e.h; }
    assert.strictEqual(m.pickWeighted([m.KANA[0]], base, rnd, 'あ').h, 'あ'); assert.strictEqual(m.pickWeighted([], base, rnd, null), null);
    ok('kana: weighted selection favors mistakes');
    // 選項
    for (const dir of ['k2r', 'r2k']) for (const script of ['hira', 'kata']) for (const poolSel of [new Set(['あ行']), new Set(['や行']), new Set(m.GROUPS), new Set(['拗音']), new Set(['濁音'])]) {
        const p = m.poolOf(poolSel);
        for (const e of p) {
            const ch = m.pickChoices(e, p, rnd, script, dir); assert.strictEqual(ch.length, 4); assert.strictEqual(ch.filter(c => c.ok).length, 1); assert.strictEqual(new Set(ch.map(c => c.label)).size, 4, '選項不重複');
            const okLabel = dir === 'r2k' ? m.show(e, script) : e.r[0]; assert.strictEqual(ch.find(c => c.ok).label, okLabel);
            for (const c of ch.filter(x => !x.ok)) { const x = dir === 'r2k' ? m.KANA.find(k => m.show(k, script) === c.label) : m.KANA.find(k => k.r[0] === c.label); assert.ok(x && !x.r.some(r => e.r.includes(r)), `${e.h}: 干擾 ${c.label} 與答案共用拼音`); }
        }
    }
    ok('kana: choices unique, one correct, no ambiguous distractors');
    for (const dir of ['k2r', 'r2k', 'type']) {
        const q = m.makeQuestion({ pool, stats: base, rand: rnd, lastId: null, scripts: ['hira', 'kata'], dir });
        assert.ok(q.e && q.id === q.e.h); assert.ok(['hira', 'kata'].includes(q.script)); assert.strictEqual(q.text, dir === 'r2k' ? q.e.r[0] : m.show(q.e, q.script)); assert.strictEqual(!!q.choices, dir !== 'type');
    }
    assert.strictEqual(m.makeQuestion({ pool: [], stats: base, rand: rnd, lastId: null, scripts: ['hira'], dir: 'k2r' }), null);
    const seen = new Set(); for (let i = 0; i < 100; i++) seen.add(m.makeQuestion({ pool, stats: base, rand: rnd, lastId: null, scripts: ['hira', 'kata'], dir: 'k2r' }).script); assert.strictEqual(seen.size, 2, '混合會出兩種文字');
    for (let i = 0; i < 20; i++) assert.strictEqual(m.makeQuestion({ pool, stats: base, rand: rnd, lastId: null, scripts: ['kata'], dir: 'k2r' }).script, 'kata');
    let g = { s: {}, best: 0 }, lastId = null; for (let i = 0; i < 200; i++) { const q = m.makeQuestion({ pool: m.poolOf(new Set(m.GROUPS)), stats: g, rand: rnd, lastId, scripts: ['hira'], dir: 'type' }); lastId = q.id; g = m.recordAnswer(g, q.id, rnd() < 0.7); }
    assert.strictEqual(m.totals(g)[0] + m.totals(g)[1], 200); assert.deepStrictEqual(m.cleanStats(JSON.parse(JSON.stringify(g))), g, '存取往返一致');
    ok('kana: question generation and simulated session');
    // 計分
    assert.deepStrictEqual([1, 2, 5, 10, 11, 50].map(m.scoreFor), [11, 12, 15, 20, 20, 20]); assert.strictEqual(m.scoreFor(0), 11);
    // 最弱
    const ws = m.weakest({ s: { あ: [0, 3], い: [10, 1], う: [1, 1], え: [5, 0], お: [0, 1] }, best: 0 }); assert.deepStrictEqual(ws.map(x => x.id), ['あ', 'お', 'う', 'い'], '答對的不列入；錯誤率高在前');
    near(ws[0].rate, 1); near(ws[2].rate, 0.5);
    const lots = { s: {}, best: 0 }; m.KANA.slice(0, 30).forEach((e, i) => { lots.s[e.h] = [i, 1 + (i % 5)]; }); const w10 = m.weakest(lots); assert.strictEqual(w10.length, 10); assert.ok(w10.every((x, i) => i === 0 || w10[i - 1].er >= x.er));
    assert.deepStrictEqual(m.weakest({ s: {}, best: 0 }), []); assert.strictEqual(m.weakest(lots, 3).length, 3);
    ok('kana: score and weakest 10');
}

console.log('new-e3: all OK');
