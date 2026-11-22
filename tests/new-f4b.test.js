const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/banner-board.html', 'normOpts, DEFAULTS, fitFont, fmtClock, fmtDate, fmtCountdown, cdEnd, marqueeSpec, charUnit, PRESETS');
const { normOpts, DEFAULTS, fitFont, fmtClock, fmtDate, fmtCountdown, cdEnd, marqueeSpec, charUnit, PRESETS } = m;

// 倒數格式
assert.equal(fmtCountdown(0), '00:00:00'); assert.equal(fmtCountdown(-5), '00:00:00'); assert.equal(fmtCountdown(NaN), '00:00:00');
assert.equal(fmtCountdown(1), '00:00:01'); assert.equal(fmtCountdown(999), '00:00:01'); assert.equal(fmtCountdown(1000), '00:00:01'); assert.equal(fmtCountdown(1001), '00:00:02');
assert.equal(fmtCountdown(5 * 60000), '00:05:00'); assert.equal(fmtCountdown(3661000), '01:01:01');
assert.equal(fmtCountdown(86399000), '23:59:59'); assert.equal(fmtCountdown(86400000), '1天 00:00:00'); assert.equal(fmtCountdown(90061000), '1天 01:01:01');
assert.ok(fmtCountdown(1e15).includes('天'));
ok('banner: fmtCountdown');

// 時鐘
const d = (h, mi, s) => new Date(2025, 2, 4, h, mi, s);
assert.equal(fmtClock(d(0, 5, 9)), '00:05:09'); assert.equal(fmtClock(d(23, 59, 59), true, false), '23:59');
assert.equal(fmtClock(d(0, 5, 9), false), '上午 12:05:09'); assert.equal(fmtClock(d(12, 0, 0), false, false), '下午 12:00'); assert.equal(fmtClock(d(15, 3, 4), false), '下午 3:03:04');
assert.equal(fmtDate(d(1, 1, 1)), '2025年3月4日 星期二'); assert.equal(fmtDate(new Date(2025, 2, 2)), '2025年3月2日 星期日');
ok('banner: clock / date');

// 字級
const f = fitFont(390, 220, ['12:34:56']); assert.ok(f > 40 && f < 390 / (8 * 0.3));
assert.ok(fitFont(800, 400, 'A') > fitFont(800, 400, 'AAAAAAAAAA'));
assert.ok(fitFont(800, 400, ['a', 'b', 'c', 'd']) <= 400 * 0.88 / (4 * 1.15) + 0.1);       // 高度限制
assert.ok(fitFont(756, 352, ['12:34:56']) > fitFont(390, 220, ['12:34:56']));
assert.ok(fitFont(1000, 1000, 'x', { extra: 0.35 }) <= fitFont(1000, 1000, 'x'));
assert.equal(fitFont(0, 0, 'x'), 10); assert.equal(fitFont(NaN, 100, 'x'), 10); assert.equal(fitFont(100, 100, ''), fitFont(100, 100, [''])); assert.ok(fitFont(1e9, 1e9, 'x') <= 2000);
assert.ok(fitFont(390, 220, '歡迎光臨') * 4 * 0.88 <= 390 + 1);                              // 中文一字一 em，不溢出
assert.equal(charUnit('中'), 1); assert.ok(charUnit('1') < 1);
ok('banner: fitFont');

// 倒數結束時間
assert.equal(cdEnd({ cdKind: 'min', cdMin: 5 }, 1000), 301000);
assert.equal(cdEnd({ cdKind: 'at', cdAt: '2025-03-04T10:30' }, 0), new Date(2025, 2, 4, 10, 30).getTime());
assert.equal(cdEnd({ cdKind: 'at', cdAt: '' }, 0), null); assert.equal(cdEnd({ cdKind: 'at', cdAt: 'abc' }, 0), null);
ok('banner: cdEnd');

// 跑馬燈
// cps = 每秒幾個字（字級 px × cps = 每秒像素）：與看板大小無關，字大字小閱讀速度一樣
let s = marqueeSpec(400, 400, 2, 100); assert.equal(s.from, 400); assert.equal(s.to, -400); assert.equal(s.dur, 800 / (100 * 2));
assert.ok(marqueeSpec(400, 400, 4, 100).dur < marqueeSpec(400, 400, 1, 100).dur); assert.equal(marqueeSpec(400, 400, 99, 100).dur, marqueeSpec(400, 400, 10, 100).dur);   // 上限 10 字/秒
assert.equal(marqueeSpec(400, 400, 0.05, 100).dur, marqueeSpec(400, 400, 0.1, 100).dur);                                                                                   // 下限 0.1 字/秒
assert.ok(marqueeSpec(400, 400, 0.1, 100).dur >= 80);                                                                                                                      // 最慢檔：800px / 10px/s = 80 秒
assert.equal(marqueeSpec(800, 2000, 1, 50).dur, marqueeSpec(800, 2000, 1, 50).dur); assert.ok(marqueeSpec(300, 300, 1, 100).dur === marqueeSpec(300, 300, 1, 100).dur);
// 同樣字數、字級放大 2 倍：每個字走過畫面的時間不變，所以整段時間大約 2 倍（字寬、框寬也跟著變）
assert.equal(marqueeSpec(2 * 400, 2 * 400, 2, 2 * 100).dur, marqueeSpec(400, 400, 2, 100).dur);
assert.ok(Number.isFinite(marqueeSpec(0, 0, 0, 0).dur) && marqueeSpec(0, 0, 0, 0).dur >= 0);
ok('banner: marqueeSpec');

// normOpts
assert.deepEqual(normOpts(null), DEFAULTS); assert.deepEqual(normOpts([]), DEFAULTS); assert.deepEqual(normOpts('x'), DEFAULTS); assert.deepEqual(normOpts({}), DEFAULTS);
let r = normOpts({ mode: 'bad', text: 5, h24: 0, cdKind: 'zz', cdAt: 'x', cdMin: 99999, cps: -3, fs: 5, fg: '#fff', bg: '#000000', blink: 'yes' });
assert.equal(r.mode, 'text'); assert.equal(r.text, DEFAULTS.text); assert.equal(r.h24, true); assert.equal(r.cdKind, 'min'); assert.equal(r.cdAt, ''); assert.equal(r.cdMin, 10080); assert.equal(r.cps, 0.1); assert.equal(r.fs, 30); assert.equal(r.fg, ''); assert.equal(r.bg, ''); assert.equal(r.blink, false);
r = normOpts({ mode: 'marquee', text: 'x'.repeat(500), fg: '#FFD400', bg: '#000000', cdMin: '', cps: '2.46', fs: '75', cdAt: '2025-03-04T10:30', date: true, h24: false });
assert.equal(r.mode, 'marquee'); assert.equal(r.text.length, 200); assert.equal(r.fg, '#ffd400'); assert.equal(r.cdMin, 5); assert.equal(r.cps, 2.5); assert.equal(r.fs, 75); assert.equal(r.cdAt, '2025-03-04T10:30'); assert.equal(r.date, true); assert.equal(r.h24, false);
assert.deepEqual(normOpts(normOpts(r)), normOpts(r));
assert.equal(normOpts({ cdMin: 0 }).cdMin, 1); assert.equal(normOpts({ cps: NaN }).cps, DEFAULTS.cps); assert.equal(normOpts({ cps: 99 }).cps, 10); assert.equal(normOpts({ fs: 999 }).fs, 100);
// 舊版設定（speed 1–10，單位是框寬百分比）換算成每秒字數：5 → 0.9、10 → 1.8、1 → 0.2；有新欄位 cps 時以 cps 為準；壞值回預設
assert.equal(normOpts({ speed: 5 }).cps, 0.9); assert.equal(normOpts({ speed: 10 }).cps, 1.8); assert.equal(normOpts({ speed: 1 }).cps, 0.2); assert.equal(normOpts({ speed: 5, cps: 3 }).cps, 3); assert.equal(normOpts({ speed: 'x' }).cps, DEFAULTS.cps); assert.equal(normOpts({ speed: null }).cps, DEFAULTS.cps);
assert.ok(!('speed' in normOpts({ speed: 5 })), '舊欄位 speed 不再輸出');
for (const p of PRESETS.slice(1)) { assert.ok(/^#[0-9a-f]{6}$/.test(p[1]) && /^#[0-9a-f]{6}$/.test(p[2]) && p[1] !== p[2]); }
ok('banner: normOpts / presets');
