// 批次 n9：travel-calc（旅行計算與速查）
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/travel-calc.html', 'parseHM, clockText, clockOf, dayNum, dayStr, departPlan, tzOffsetMin, localToUtc, jetLagPlan, flightCalc, pickupPlan, driveCalc, esimCalc, parseStays, schengenUsed, schengenMax, parseAmounts, passCalc, rentalCalc, parseSegs, bufferPlan, tipCalc, taxRefund, searchRef, REFS, AIRPORTS, CODES, EMG, cleanOpts, TABS');
const D = m.dayNum;

// 時間格式與倒推
assert.equal(m.parseHM('10:30'), 630); assert.equal(m.parseHM('24:00'), null); assert.equal(m.parseHM('x'), null);
assert.equal(m.clockText(-30), '23:30（前 1 天）'); assert.equal(m.clockText(1500), '01:00（+1 天）'); assert.equal(m.clockText(90), '01:30');
let d = m.departPlan({ t: 630, cutoff: 60, procs: 90, buf: 30, travel: 60 });
assert.deepEqual([d.cutoffAt, d.arrive, d.leave], [570, 510, 450]);
d = m.departPlan({ t: 60, cutoff: 60, procs: 90, buf: 30, travel: 60 });   // 凌晨起飛：前一天出門
assert.equal(m.clockText(d.leave), '22:00（前 1 天）');
assert.equal(m.departPlan({ t: 630, cutoff: -1, procs: 1, buf: 1, travel: 1 }), null);
assert.equal(m.departPlan({ t: null, cutoff: 1, procs: 1, buf: 1, travel: 1 }), null);

// 時區偏移與夏令
assert.equal(m.tzOffsetMin('Asia/Taipei', Date.UTC(2025, 0, 1)), 480);
assert.equal(m.tzOffsetMin('America/New_York', Date.UTC(2025, 0, 1)), -300);
assert.equal(m.tzOffsetMin('America/New_York', Date.UTC(2025, 6, 1)), -240);
assert.equal(m.tzOffsetMin('America/New_York', Date.UTC(2025, 2, 9, 6, 59)), -300);   // 切換前一分
assert.equal(m.tzOffsetMin('America/New_York', Date.UTC(2025, 2, 9, 7, 0)), -240);    // 2025-03-09 02:00 EST 跳 03:00 EDT
assert.equal(m.tzOffsetMin('Europe/London', Date.UTC(2025, 9, 26, 1, 0)), 0);
assert.equal(m.tzOffsetMin('Europe/London', Date.UTC(2025, 9, 26, 0, 59)), 60);

// 航班
let f = m.flightCalc({ dep: '2025-03-08T22:00', depTz: 'America/New_York', arr: '2025-03-09T10:00', arrTz: 'Europe/London' });
assert.equal(f.mins, 420); assert.equal(f.dayDiff, 1);
f = m.flightCalc({ dep: '2025-03-09T00:00', depTz: 'Asia/Taipei', arr: '2025-03-09T03:30', arrTz: 'America/New_York' });   // 抵達在夏令切換日之後
assert.equal(f.mins, 930); assert.equal(f.dayDiff, 0);
f = m.flightCalc({ dep: '2025-07-01T23:50', depTz: 'Asia/Taipei', arr: '2025-07-02T04:00', arrTz: 'Asia/Tokyo' });   // 跨日
assert.equal(f.mins, 190); assert.equal(f.dayDiff, 1);
assert.equal(m.flightCalc({ dep: '2025-07-01T10:00', depTz: 'Asia/Taipei', arr: '2025-07-01T09:00', arrTz: 'Asia/Taipei' }).odd, true);
assert.equal(m.flightCalc({ dep: '2025-07-01T10:00', depTz: 'Nowhere/X', arr: '2025-07-01T09:00', arrTz: 'Asia/Taipei' }), null);
assert.equal(m.flightCalc({ dep: '2025-02-30T10:00', depTz: 'Asia/Taipei', arr: '2025-03-01T09:00', arrTz: 'Asia/Taipei' }), null);
assert.equal(m.localToUtc('2025-03-30T12:00', 'Europe/London'), Date.UTC(2025, 2, 30, 11, 0));

// 時差調整
let j = m.jetLagPlan({ home: 'Asia/Taipei', dest: 'Europe/London', date: '2025-07-01', bed: '23:00', wake: '07:00', rate: 60, maxDays: 3 });
assert.equal(j.diff, -420); assert.equal(j.east, false); assert.equal(j.rows.length, 3);   // 7 小時、往西延後
assert.deepEqual(j.rows.map(r => r.bed), ['00:00', '01:00', '02:00']); assert.deepEqual(j.rows.map(r => r.before), [3, 2, 1]);
j = m.jetLagPlan({ home: 'Asia/Taipei', dest: 'Europe/London', date: '2025-01-15', bed: '23:00', wake: '07:00', rate: 60, maxDays: 3 });
assert.equal(j.diff, -480);   // 冬令英國 UTC+0
j = m.jetLagPlan({ home: 'Asia/Taipei', dest: 'Pacific/Auckland', date: '2025-01-15', bed: '23:00', wake: '07:00', rate: 60, maxDays: 2 });
assert.equal(j.diff, 300); assert.equal(j.east, true); assert.equal(j.rows[0].bed, '22:00'); assert.equal(j.rows.length, 2); assert.equal(j.remain, 180);
j = m.jetLagPlan({ home: 'Asia/Taipei', dest: 'Asia/Tokyo', date: '2025-01-15', bed: '23:00', wake: '07:00', rate: 60, maxDays: 3 });
assert.equal(j.rows.length, 0);
assert.equal(m.jetLagPlan({ home: 'Asia/Taipei', dest: 'bad', date: '2025-01-15', bed: '23:00', wake: '07:00', rate: 60, maxDays: 3 }), null);
j = m.jetLagPlan({ home: 'Asia/Taipei', dest: 'America/Los_Angeles', date: '2025-07-01', bed: '23:00', wake: '07:00', rate: 60, maxDays: 3 });
assert.equal(j.diff, 540);   // -15 小時取較短方向 +9

// 接送
let p = m.pickupPlan({ land: 23 * 60 + 30, immig: 45, bag: 30, exit: 15, travel: 50 });
assert.equal(m.clockText(p.out), '01:00（+1 天）'); assert.equal(m.clockText(p.hotel), '01:50（+1 天）');
assert.equal(m.pickupPlan({ land: null, immig: 1, bag: 1, exit: 1, travel: 1 }), null);

// 開車
let dr = m.driveCalc({ km: 350, speed: 80, every: 120, rest: 15, start: 480, fuel: 450 });
assert.equal(dr.n, 2); assert.equal(Math.round(dr.drive), 263); assert.equal(dr.stops[0].km, 160); assert.equal(dr.stops[0].at, 600);
assert.equal(dr.stops[1].at, 735); assert.equal(dr.fuels, 0);
assert.equal(m.driveCalc({ km: 160, speed: 80, every: 60, rest: 15, start: 0, fuel: 0 }).n, 1);   // 剛好兩個 60 分：終點不用再休息
assert.equal(m.driveCalc({ km: 80, speed: 80, every: 60, rest: 15, start: 0, fuel: 0 }).n, 0);
assert.equal(m.driveCalc({ km: 900, speed: 90, every: 120, rest: 15, start: 0, fuel: 450 }).fuels, 1);
assert.equal(m.driveCalc({ km: 0, speed: 80, every: 120, rest: 15, start: 0, fuel: 0 }), null);

// eSIM
let e = m.esimCalc({ days: 5, use: [[1, 15], [2, 100], [0.5, 600], [1, 20]], margin: 20 });
assert.equal(Math.round(e.perDay), Math.round((15 + 200 + 300 + 20) * 1.2)); assert.equal(e.tier, 5);
assert.equal(m.esimCalc({ days: 100, use: [[24, 5000]], margin: 0 }).tier, null);
assert.equal(m.esimCalc({ days: 0, use: [], margin: 0 }), null);

// 申根
assert.equal(D('2025-02-29'), null); assert.equal(m.dayStr(D('2025-06-29')), '2025-06-29');
const st = (t) => m.parseStays(t).stays;
const full = st('2025-01-01 2025-03-31');   // 90 天
assert.equal(m.schengenUsed(full, D('2025-03-31')), 90);
assert.equal(m.schengenUsed(full, D('2025-06-29')), 90);
assert.equal(m.schengenUsed(full, D('2025-06-30')), 89);
assert.equal(m.schengenUsed(full, D('2025-12-31')), 0);
assert.equal(m.schengenMax(full, D('2025-06-29')), 0);
assert.equal(m.schengenMax(full, D('2025-06-30')), 90);
assert.equal(m.schengenMax([], D('2025-06-30')), 90);
const three = st('2025-01-01 2025-01-30\n2025-03-01 2025-03-30\n2025-05-01 2025-05-30');
assert.equal(m.schengenUsed(three, D('2025-05-30')), 90); assert.equal(m.schengenUsed(three, D('2025-06-29')), 90); assert.equal(m.schengenUsed(three, D('2025-06-30')), 89);
assert.equal(m.schengenMax(three, D('2025-06-29')), 0);
assert.equal(m.schengenUsed(st('2025-03-01 2025-03-01'), D('2025-03-01')), 1);   // 當天進出算 1 天
assert.equal(m.schengenUsed(st('2025-03-01 2025-03-10\n2025-03-05 2025-03-12'), D('2025-03-31')), 12);   // 重疊不重複計
assert.equal(m.schengenUsed(st('2025-03-01 2025-03-10'), D('2025-08-27')), 10);   // 視窗起點 3/1 仍含
assert.equal(m.schengenUsed(st('2025-03-01 2025-03-10'), D('2025-08-28')), 9);
assert.equal(m.schengenMax(st('2025-01-01 2025-01-30'), D('2025-02-01')), 60);
assert.ok(m.parseStays('2025-03-10 2025-03-01').err.includes('早於')); assert.ok(m.parseStays('abc').err); assert.ok(m.parseStays('2025-02-30 2025-03-01').err);
assert.ok(m.parseStays(Array(101).fill('2025-01-01 2025-01-02').join('\n')).err);
assert.deepEqual(m.parseStays('2025/1/1 2025.1.5').stays, [[D('2025-01-01'), D('2025-01-05')]]);
assert.deepEqual(m.parseStays('').stays, []);

// 周遊券
let a = m.parseAmounts('成田,3070\n580\n京都，14000');
assert.equal(a.rows.length, 3); assert.equal(m.passCalc(a.rows, 10000).worth, true); assert.equal(m.passCalc(a.rows, 20000).save, -2350);
assert.ok(m.parseAmounts('abc').err); assert.ok(m.parseAmounts('x,-5').err);
assert.equal(m.passCalc([], -1), null);

// 租車
let r = m.rentalCalc({ daily: 1800, days: 3, ins: 300, fixed: 500, km: 400, free: 100, extra: 5, kmpl: 10, fuelPrice: 30, shortL: 5, shortMult: 2 });
assert.equal(r.base, 5400); assert.equal(r.insurance, 900); assert.equal(r.over, 100); assert.equal(r.mile, 500); assert.equal(r.fuel, 1200); assert.equal(r.short, 300); assert.equal(r.total, 8800);
assert.equal(m.rentalCalc({ daily: 1800, days: 3, ins: 0, fixed: 0, km: 400, free: 0, extra: 5, kmpl: 10, fuelPrice: 30, shortL: 0, shortMult: 1 }).mile, 0);
assert.equal(m.rentalCalc({ daily: -1, days: 3, ins: 0, fixed: 0, km: 400, free: 0, extra: 5, kmpl: 10, fuelPrice: 30, shortL: 0, shortMult: 1 }), null);

// 緩衝
let sg = m.parseSegs('a,40\nb，90\nc,0');
assert.equal(sg.segs.length, 3); assert.ok(m.parseSegs('').err); assert.ok(m.parseSegs('x').err);
let bp = m.bufferPlan(sg.segs, 540, 1080, 20, 5);
assert.equal(bp.rows[0].buf, 8); assert.equal(bp.rows[1].buf, 18); assert.equal(bp.rows[2].buf, 5); assert.equal(bp.total, 40 + 8 + 90 + 18 + 5);
assert.equal(bp.avail, 540); assert.equal(bp.over, false);
assert.equal(m.bufferPlan([{ name: 'x', min: 600 }], 540, 1080, 20, 5).over, true);
assert.equal(m.bufferPlan([{ name: 'x', min: 100 }], 1320, 120, 0, 0).avail, 240);   // 跨午夜
assert.equal(m.bufferPlan([], null, 1, 1, 1), null);

// 小費與退稅
let t = m.tipCalc({ bill: 100, pct: 18, people: 3 });
assert.equal(t.tip, 18); assert.ok(Math.abs(t.per - 118 / 3) < 1e-9);
assert.equal(m.tipCalc({ bill: 100, pct: 18, people: 0 }), null); assert.equal(m.tipCalc({ bill: 100, pct: 18, people: 1.5 }), null);
let x = m.taxRefund({ amt: 11000, rate: 10, threshold: 5000, pct: 80 });
assert.equal(x.vat, 1000); assert.equal(x.refund, 800); assert.equal(x.ok, true);
x = m.taxRefund({ amt: 4000, rate: 10, threshold: 5000, pct: 80 }); assert.equal(x.ok, false); assert.equal(x.refund, 0); assert.equal(x.short, 1000);

// 速查資料與搜尋
const ap = m.REFS.filter(r => r.c === '機場代碼'), codes = ap.map(r => r.t.slice(0, 3));
assert.ok(ap.length >= 140 && ap.length <= 200, '機場數 ' + ap.length);
assert.ok(codes.every(c => /^[A-Z]{3}$/.test(c))); assert.equal(new Set(codes).size, codes.length);
for (const c of ['TPE', 'TSA', 'KHH', 'NRT', 'HND', 'KIX', 'ICN', 'HKG', 'SIN', 'BKK', 'LHR', 'CDG', 'JFK', 'LAX', 'SYD']) assert.ok(codes.includes(c), c);
assert.ok(m.REFS.every(r => r.c && r.t && r.d));
const cc = m.CODES.map(r => /\+(\d+)$/.exec(r.t)[1]); assert.equal(new Set(cc).size, cc.length);
assert.equal(m.CODES.find(r => r.t.startsWith('台灣')).t.endsWith('+886'), true); assert.equal(m.CODES.find(r => r.t.startsWith('日本')).t.endsWith('+81'), true);
assert.equal(new Set(m.EMG.map(r => r.t)).size, m.EMG.length); assert.ok(m.EMG.length >= 30);
assert.ok(m.EMG.every(r => /插座：.+電壓頻率：.+\d/.test(r.d)));
assert.equal(m.searchRef(m.REFS, 'narita').length, 1); assert.equal(m.searchRef(m.REFS, 'NRT')[0].t.slice(0, 3), 'NRT');
assert.ok(m.searchRef(m.REFS, '日本').length >= 25); assert.ok(m.searchRef(m.REFS, '日本 插座').some(r => r.t === '日本'));
assert.equal(m.searchRef(m.REFS, 'zzzqq').length, 0); assert.ok(m.searchRef(m.REFS, '', '國碼撥號').length > m.CODES.length);
assert.ok(m.searchRef(m.REFS, '東京 機場', '機場代碼').length >= 2);

// 設定驗證
assert.equal(m.cleanOpts(null).tab, 'go'); assert.equal(m.cleanOpts([1]).tab, 'go'); assert.equal(m.cleanOpts({ tab: 'ref' }).tab, 'ref'); assert.equal(m.cleanOpts({ tab: 'x' }).tab, 'go');
let o = m.cleanOpts({ tab: 'sch', v: { dep_t: '10:00', 'BAD KEY': 'x', n: 5, long: 'x'.repeat(2001) }, lug: 'a\n'.repeat(40) });
assert.deepEqual(o.v, { dep_t: '10:00' }); assert.equal(o.lug.split('\n').length, 30);
const many = {}; for (let i = 0; i < 300; i++) many['k' + i] = '1';
assert.equal(Object.keys(m.cleanOpts({ v: many }).v).length, 200);
assert.equal(m.cleanOpts({ lug: 5 }).lug.includes('範例'), true); assert.equal(Object.keys(m.cleanOpts({ v: 'x' }).v).length, 0);
assert.equal(m.cleanOpts({ lug: 'x'.repeat(200) }).lug.length, 80);
ok('travel-calc');
