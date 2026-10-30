// 批次 o8：攝影與影片計算（utils/photo-calc.html）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/photo-calc.html', 'parseNum, parseTime, parseShutter, fmtShutter, fmtDur, tlCalc, slowCalc, sizeCalc, rateCalc, fmtBytes, streamBw, kelvinInfo, KELVIN, ndCalc, starCalc, expCalc, dofCalc, TABS, DEF, loadOpts, loadShots, addShot, delShot, nextNo, shotsText, SHOT_MAX, loadLight, addLight, delLight, pickLight, moveLight, LIGHT_MAX');

// 縮時
let r = m.tlCalc('out', 5, 24, 10); assert.deepStrictEqual([r.frames, r.shootSec, r.outSec], [240, 1200, 10]);
r = m.tlCalc('shoot', 5, 24, 20); assert.deepStrictEqual([r.frames, r.outSec], [240, 10]);
r = m.tlCalc('frames', 2, 30, 900); assert.deepStrictEqual([r.outSec, r.shootSec], [30, 1800]);
assert.ok(m.tlCalc('out', 0, 24, 10).err); assert.ok(m.tlCalc('out', 5, 24, 0).err); assert.ok(m.tlCalc('x', 5, 24, 1).err); assert.ok(m.tlCalc('out', 5, NaN, 1).err);
assert.ok(m.tlCalc('shoot', 600, 24, 1).err); // 拍 1 分鐘、間隔 600 秒 → 0 張
// 慢動作
r = m.slowCalc('speed', 24, 120); assert.equal(r.factor, 5); near(r.shutter, 1 / 240);
r = m.slowCalc('need', 24, 4); assert.equal(r.shoot, 96);
assert.ok(m.slowCalc('speed', 0, 120).err); assert.ok(m.slowCalc('z', 24, 1).err);
// 檔案大小
assert.equal(m.sizeCalc(8, 0, 60).bytes, 60e6); near(m.sizeCalc(8, 128, 60).bytes, 60e6 + 128e3 * 60 / 8);
assert.ok(m.sizeCalc(0, 0, 60).err); assert.ok(m.sizeCalc(8, 0, 0).err);
near(m.rateCalc(60, 0, 60).vMbps, 8); near(m.rateCalc(500, 128, 600).vMbps, 500 * 8 / 600 - .128);
assert.ok(m.rateCalc(1, 128, 6000).err);
assert.equal(m.fmtBytes(60e6), '60 MB'); assert.equal(m.fmtBytes(1.5e9), '1.5 GB');
// 直播
r = m.streamBw(1920, 1080, 30); assert.equal(r.video, 5000); near(r.uploadMbps, 7.74);
assert.equal(m.streamBw(1920, 1080, 60).video, 8000); assert.equal(m.streamBw(1280, 720, 30).video, 3000);
assert.equal(m.streamBw(1920, 1080, 45).video, 6500); assert.equal(m.streamBw(1080, 1920, 30).tier, 1080);
assert.equal(m.streamBw(3840, 2160, 30).tier, 2160); assert.ok(m.streamBw(7680, 4320, 30).err); assert.ok(m.streamBw(0, 0, 30).err);
// 色溫
r = m.kelvinInfo(5600); assert.equal(r.near[0], 5600); near(r.mired, 178.571, 1e-4); assert.equal(r.tone, '接近中性');
assert.equal(m.kelvinInfo(2900).near[0], 2700); assert.equal(m.kelvinInfo(2900).tone, '偏暖（橘）');
assert.equal(m.kelvinInfo(9000).tone, '偏冷（藍）'); assert.ok(m.kelvinInfo(10).err);
// ND
near(m.ndCalc('nd', 8, 1 / 125).stops, 3); near(m.ndCalc('nd', 1000, 1 / 125).stops, 9.9657843, 1e-6);
near(m.ndCalc('nd', 1000, 1 / 125).sec, 8); near(m.ndCalc('stop', 10, 1).nd, 1024); near(m.ndCalc('nd', 8, 1).dens, .9, 1e-2);
near(m.ndCalc('dens', 0.9, 1).stops, 2.99, 1e-2); near(m.ndCalc('nd', 64, 1 / 60).stops, 6);
assert.ok(m.ndCalc('nd', .5, 1).err); assert.ok(m.ndCalc('stop', 50, 1).err); assert.ok(m.ndCalc('nd', 8, 0).err); assert.ok(m.ndCalc('q', 8, 1).err);
// 星軌
r = m.starCalc(24, 1, 2.8, 4.3); near(r.r500, 500 / 24); near(r.npf, (35 * 2.8 + 30 * 4.3) / 24);
near(m.starCalc(20, 1.5, 2.8, 4).r500, 500 / 30); near(m.starCalc(50, 1, 2, 5).r500, 10);
assert.ok(m.starCalc(0, 1, 2.8, 4).err); assert.ok(m.starCalc(24, 0.5, 2.8, 4).err);
// 曝光
near(m.expCalc(16, 1 / 100, 100, 16, 100).ev1, Math.log2(25600)); assert.ok(Math.abs(m.expCalc(16, 1 / 100, 100, 16, 100).ev - 14.64) < .01);
near(m.expCalc(8, 1 / 125, 100, 8, 100).ev, Math.log2(8000));
r = m.expCalc(8, 1 / 125, 100, 5.6, 100); near(r.t2, (1 / 125) * 31.36 / 64); assert.equal(m.fmtShutter(r.t2), '1/255'); near(r.stops, -1, .05);
near(m.expCalc(8, 1 / 125, 100, 8, 400).t2, 1 / 500); near(m.expCalc(8, 1 / 125, 100, 4, 100).t2, 1 / 500);
near(m.expCalc(8, 1 / 125, 400, 8, 100).t2, 4 / 125);
assert.ok(m.expCalc(0, 1, 100, 8, 100).err); assert.ok(m.expCalc(8, NaN, 100, 8, 100).err);
// 景深
r = m.dofCalc(50, 8, 3, .03); near(r.H, 10.46667, 1e-5); near(r.near, 2.33789, 1e-4); near(r.far, 4.18527, 1e-3); near(r.hyperNear, 5.2333, 1e-3);
r = m.dofCalc(50, 8, 20, .03); assert.equal(r.far, Infinity); assert.equal(r.depth, Infinity);
r = m.dofCalc(35, 2, 10, .02); near(r.H, 35 * 35 / (2 * .02) / 1000 + .035, 1e-9);
assert.ok(m.dofCalc(50, 8, 0.04, .03).err); assert.ok(m.dofCalc(50, 8, 3, 0).err); assert.ok(m.dofCalc(50, 0, 3, .03).err);
// 快門與時間格式
near(m.parseShutter('1/125'), .008); near(m.parseShutter('0.5'), .5); near(m.parseShutter('2"'), 2); near(m.parseShutter(' 1 / 60 '), 1 / 60);
['', 'abc', '1/0', '-1', '0'].forEach(x => assert.ok(Number.isNaN(m.parseShutter(x)), x));
assert.equal(m.fmtShutter(.008), '1/125'); assert.equal(m.fmtShutter(8), '8 秒'); assert.equal(m.fmtShutter(90), '1 分 30 秒'); assert.equal(m.fmtShutter(NaN), '—');
assert.equal(m.parseTime('10:00'), 600); assert.equal(m.parseTime('1:02:03'), 3723); assert.ok(Number.isNaN(m.parseTime('1:70')));
assert.equal(m.fmtDur(1200), '20 分'); assert.equal(m.fmtDur(3725), '1 小時 2 分 5 秒'); assert.equal(m.fmtDur(0), '0 秒');
// loadOpts
assert.deepStrictEqual(m.loadOpts(null), m.DEF); assert.deepStrictEqual(m.loadOpts([1]), m.DEF); assert.deepStrictEqual(m.loadOpts('x'), m.DEF);
const o = m.loadOpts({ tab: 'nd', v: { nd_v: '64', nd_mode: 'bogus', tl_val: 5, nd_base: 'x'.repeat(50), zzz: '1' } });
assert.equal(o.tab, 'nd'); assert.equal(o.v.nd_v, '64'); assert.equal(o.v.nd_mode, 'nd'); assert.equal(o.v.tl_val, '10'); assert.equal(o.v.nd_base, '1/125'); assert.ok(!('zzz' in o.v));
assert.equal(m.loadOpts({ tab: 'nope' }).tab, 'tl'); assert.equal(m.loadOpts({ tab: 'light', v: null }).tab, 'light');
// 分鏡表
let s = []; r = m.addShot(s, '1', '全景', '固定', '開場'); s = r.list; assert.equal(s.length, 1); assert.equal(s[0].id, 1);
s = m.addShot(s, '2', '特寫', '推', 'a\nb'.padEnd(300, 'x')).list; assert.equal(s[1].note.length, 100); assert.ok(!s[1].note.includes('\n'));
assert.equal(m.nextNo(s), '3'); assert.equal(m.nextNo([{ no: 'S01' }]), 'S02'); assert.equal(m.nextNo([{ no: 'abc' }]), '2'); assert.equal(m.nextNo([]), '1');
s = m.delShot(s, 1); assert.deepStrictEqual(s.map(x => x.id), [2]); assert.equal(m.addShot(s, 'x', '', '', '').list[1].id, 3);
assert.ok(m.shotsText(s).startsWith('鏡號\t景別\t運鏡\t備註\n2\t'));
let big = []; for (let i = 0; i < m.SHOT_MAX; i++) big = m.addShot(big, String(i), '', '', '').list;
assert.equal(big.length, 200); r = m.addShot(big, 'z', '', '', ''); assert.ok(r.err && !r.list); assert.equal(big.length, 200);
assert.deepStrictEqual(m.loadShots(null), []); assert.deepStrictEqual(m.loadShots({}), []);
assert.equal(m.loadShots(Array.from({ length: 300 }, (_, i) => ({ id: i + 1, no: 'a' }))).length, 200);
assert.deepStrictEqual(m.loadShots([null, 1, { id: 'x' }, { id: 0 }, { id: 1, no: 5, size: 'x'.repeat(30) }, { id: 1, no: 'dup' }]).map(x => [x.id, x.no, x.size.length]), [[1, '', 8]]);
// 燈位圖
let L = []; r = m.addLight(L, 'subject'); L = r.list; assert.deepStrictEqual([L[0].x, L[0].y], [.5, .5]);
L = m.addLight(L, 'key').list; L = m.addLight(L, 'key').list; assert.ok(L[2].x > L[1].x); assert.ok(m.addLight(L, 'zz').err);
assert.equal(m.pickLight(L, .5, .5), 1); assert.equal(m.pickLight(L, .9, .1), 0); assert.equal(m.pickLight(L, L[2].x, L[2].y), 3);
L = m.moveLight(L, 1, 2, -1); assert.deepStrictEqual([L[0].x, L[0].y], [.97, .03]); assert.equal(L[1].id, 2);
L = m.delLight(L, 2); assert.deepStrictEqual(L.map(x => x.id), [1, 3]); assert.equal(m.addLight(L, 'fill').list[2].id, 4);
let bl = []; for (let i = 0; i < m.LIGHT_MAX; i++) bl = m.addLight(bl, 'fill').list;
assert.equal(bl.length, 20); r = m.addLight(bl, 'fill'); assert.ok(r.err && !r.list);
assert.equal(m.loadLight(Array.from({ length: 50 }, (_, i) => ({ id: i + 1, t: 'key', x: .5, y: .5 }))).length, 20);
assert.deepStrictEqual(m.loadLight([{ id: 1, t: 'bad', x: .5, y: .5 }, { id: 2, t: 'key', x: 'a', y: 1 }, { id: 3, t: 'cam', x: 5, y: -5 }, null, { id: 3, t: 'cam', x: .5, y: .5 }]), [{ id: 3, t: 'cam', x: .97, y: .03 }]);
assert.deepStrictEqual(m.loadLight('x'), []); assert.deepStrictEqual(m.loadLight(null), []);
ok('photo-calc');
