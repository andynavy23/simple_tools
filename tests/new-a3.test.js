// 批次 a3：audio-recorder 剪輯功能純邏輯（Float32Array）
const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/audio-recorder.html', 'clampRange, effRange, sliceCh, spliceCh, silence, fadeGain, applyFade, dbToGain, gainToDb, clampDb, applyGain, peakOf, normalizeChs, reverseChs, findSilence, remix, resampleLen, resampleCh, resampleChs, speedChs, concatAudio, peaksFor, fmtTime, parseTime, trimHistory, wavBytes, limitMsg, encodeWav, MAX_EDIT_MS, MAX_FILE');
const sine = (n, f = 440, sr = 44100, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr));
const ramp = (n) => Float32Array.from({ length: n }, (_, i) => i / n);
const eq = (a, b) => { assert.equal(a.length, b.length); for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-6, `[${i}] ${a[i]} vs ${b[i]}`); };

{ // 區間
    assert.deepStrictEqual(m.clampRange(10, 20, 100), [10, 20]);
    assert.deepStrictEqual(m.clampRange(20, 10, 100), [10, 20], '反向對調');
    assert.deepStrictEqual(m.clampRange(-5, 500, 100), [0, 100], '超出夾住');
    assert.deepStrictEqual(m.clampRange(5, 5, 100), [5, 5], '空區間');
    assert.deepStrictEqual(m.clampRange(NaN, undefined, 10), [0, 0]);
    assert.deepStrictEqual(m.clampRange(3.6, 7.2, 10), [4, 7]);
    assert.deepStrictEqual(m.clampRange(0, 1, 0), [0, 0], '空資料');
    assert.deepStrictEqual(m.effRange(5, 5, 100), [0, 100], '空選取 = 整段');
    assert.deepStrictEqual(m.effRange(30, 10, 100), [10, 30]);
    ok('audio-edit: 區間夾住 / 反向 / 空 / 超出');
}
{ // 裁剪 / 刪除 / 插入
    const x = sine(44100), chs = [x];
    const c = m.sliceCh(chs, 11025, 22050); assert.equal(c[0].length, 11025); eq(c[0], x.subarray(11025, 22050));
    const d = m.spliceCh(chs, 11025, 22050, m.silence(1, 0)); assert.equal(d[0].length, 44100 - 11025);
    eq(d[0].subarray(0, 11025), x.subarray(0, 11025)); eq(d[0].subarray(11025), x.subarray(22050));
    const ins = m.spliceCh(chs, 100, 100, m.silence(1, 50)); assert.equal(ins[0].length, 44150); assert.ok(ins[0].subarray(100, 150).every(v => v === 0)); eq(ins[0].subarray(150), x.subarray(100));
    assert.equal(chs[0], x, '原資料不變'); assert.equal(x[1], sine(2)[1]);
    assert.equal(m.sliceCh(chs, 5, 5)[0].length, 0, '空區間');
    assert.equal(m.sliceCh(chs, 50000, 99999)[0].length, 0, '起點超出');
    assert.equal(m.sliceCh(chs, 44000, 99999)[0].length, 100, '終點超出夾住');
    assert.equal(m.sliceCh(chs, 30, 10)[0].length, 20, '反向');
    const one = [Float32Array.of(0.5)]; assert.equal(m.sliceCh(one, 0, 1)[0][0], 0.5); assert.equal(m.spliceCh(one, 0, 1, m.silence(1, 0))[0].length, 0);
    assert.equal(m.spliceCh(one, 1, 1, [Float32Array.of(0.25)])[0][1], 0.25, '單樣本尾端插入');
    const st = [sine(100), sine(100, 880)], s2 = m.sliceCh(st, 10, 60); assert.equal(s2.length, 2); eq(s2[1], st[1].subarray(10, 60));
    const d2 = m.spliceCh(st, 20, 40, m.silence(2, 0)); assert.equal(d2[0].length, 80); assert.equal(d2[1].length, 80);
    const p = m.spliceCh([sine(10)], 5, 5, [sine(3), sine(3)]); assert.equal(p.length, 1, '聲道數以原資料為準');
    ok('audio-edit: 裁剪 / 刪除 / 插入（單雙聲道、邊界）');
}
{ // 淡入淡出
    const ones = [new Float32Array(101).fill(1)];
    const fi = m.applyFade(ones, 0, 101, 'in', 'lin')[0]; assert.equal(fi[0], 0); assert.equal(fi[100], 1); near(fi[50], 0.5); assert.equal(ones[0][0], 1, '不改原資料');
    const fo = m.applyFade(ones, 0, 101, 'out', 'lin')[0]; assert.equal(fo[0], 1); assert.equal(fo[100], 0);
    const lg = m.applyFade(ones, 10, 91, 'in', 'log')[0]; assert.equal(lg[10], 0); near(lg[90], 1); assert.equal(lg[9], 1, '範圍外不動'); assert.equal(lg[95], 1); assert.ok(lg[30] > 0.25 && lg[30] > m.applyFade(ones, 10, 91, 'in', 'lin')[0][30], '對數前段較高');
    for (let i = 11; i < 91; i++) assert.ok(lg[i] >= lg[i - 1]);
    near(m.fadeGain(0.5, 'lin'), 0.5); assert.equal(m.fadeGain(0, 'log'), 0); near(m.fadeGain(1, 'log'), 1); assert.equal(m.fadeGain(-3, 'lin'), 0); assert.equal(m.fadeGain(9, 'lin'), 1);
    assert.equal(m.applyFade(ones, 5, 5, 'in', 'lin')[0].length, 101, '空區間不報錯');
    assert.equal(m.applyFade([Float32Array.of(1)], 0, 1, 'in', 'lin')[0][0], 0, '單樣本');
    const sf = m.applyFade([new Float32Array(10).fill(1), new Float32Array(10).fill(1)], 0, 10, 'in', 'lin'); assert.equal(sf[1][0], 0); assert.equal(sf[1][9], 1);
    ok('audio-edit: 淡入淡出端點 / 單調 / 曲線');
}
{ // dB / 增益 / 正規化 / 反轉
    near(m.dbToGain(0), 1); near(m.dbToGain(-6.0206), 0.5, 1e-4); near(m.dbToGain(20), 10); near(m.gainToDb(0.1), -20); assert.equal(m.gainToDb(0), -Infinity);
    assert.equal(m.clampDb(100), 24); assert.equal(m.clampDb(-100), -60); assert.equal(m.clampDb('x'), 0);
    const x = [Float32Array.of(0.4, -0.8, 0.1)];
    const g = m.applyGain(x, 0, 3, 2)[0]; near(g[0], 0.8); assert.equal(g[1], -1, '限幅'); near(g[2], 0.2);
    assert.ok(Math.abs(m.applyGain(x, 0, 3, 2, false)[0][1] + 1.6) < 1e-6, '不限幅');
    assert.equal(m.applyGain(x, 0, 1, 2)[0][1], x[0][1], '範圍外不動');
    assert.equal(m.peakOf(x, 0, 3), Math.fround(0.8)); assert.equal(m.peakOf(x, 2, 3), Math.fround(0.1)); assert.equal(m.peakOf([new Float32Array(0)], 0, 0), 0);
    const n = m.normalizeChs([sine(1000, 440, 44100, 0.2), sine(1000, 440, 44100, 0.1)], 0, 1000); near(m.peakOf(n, 0, 1000), m.dbToGain(-1), 1e-5);
    near(m.peakOf(m.normalizeChs([sine(500, 440, 44100, 0.9)], 0, 500, -6), 0, 500), m.dbToGain(-6), 1e-5, '自訂目標');
    const z = [new Float32Array(10)]; assert.equal(m.normalizeChs(z, 0, 10), z, '全靜音原樣');
    const half = [Float32Array.of(0.1, 0.1, 0.5, 0.1)]; const hn = m.normalizeChs(half, 2, 4)[0]; near(hn[2], m.dbToGain(-1), 1e-5); near(hn[0], 0.1, 1e-6);
    const r = m.reverseChs([Float32Array.of(1, 2, 3, 4, 5)], 1, 4)[0]; assert.deepStrictEqual(Array.from(r), [1, 4, 3, 2, 5]);
    assert.deepStrictEqual(Array.from(m.reverseChs([Float32Array.of(1, 2, 3)], 0, 3)[0]), [3, 2, 1]);
    assert.deepStrictEqual(Array.from(m.reverseChs([Float32Array.of(7)], 0, 1)[0]), [7]);
    ok('audio-edit: dB / 限幅 / 正規化 / 反轉');
}
{ // 靜音偵測
    const a = new Float32Array(1000); for (let i = 300; i < 700; i++) a[i] = 0.5;
    assert.deepStrictEqual(m.findSilence([a], -50), [300, 700]);
    assert.equal(m.findSilence([new Float32Array(50)], -50), null);
    assert.equal(m.findSilence([new Float32Array(0)], -50), null);
    const b = new Float32Array(1000); b[100] = 0.001; assert.deepStrictEqual(m.findSilence([b], -70), [100, 101], '單一取樣');
    assert.equal(m.findSilence([b], -50), null, '低於門檻視為靜音');
    const c = new Float32Array(1000); c[10] = 0.3; const d = new Float32Array(1000); d[900] = 0.3; assert.deepStrictEqual(m.findSilence([c, d], -40), [10, 901], '任一聲道');
    assert.deepStrictEqual(m.findSilence([Float32Array.of(-0.9)], -20), [0, 1]);
    ok('audio-edit: 靜音偵測');
}
{ // 重新取樣 / 聲道 / 調速
    const dc = new Float32Array(1000).fill(0.5);
    const dn = m.resampleCh(dc, 44100, 22050); assert.equal(dn.length, 500); assert.ok(dn.every(v => Math.abs(v - 0.5) < 1e-6), '降取樣保持直流');
    const up = m.resampleCh(dc, 22050, 44100); assert.equal(up.length, 2000); assert.ok(up.every(v => Math.abs(v - 0.5) < 1e-6));
    assert.equal(m.resampleCh(dc, 44100, 44100), dc);
    assert.equal(m.resampleCh(sine(44100), 44100, 16000).length, 16000);
    const s = m.resampleCh(sine(44100, 440, 44100, 0.5), 44100, 22050); near(m.peakOf([s], 0, s.length), 0.5, 0.02); // 440Hz 在 22050 下仍可表示
    const lin = m.resampleLen(Float32Array.of(0, 1), 4); near(lin[0], 0); near(lin[1], 0.5); near(lin[2], 1); near(lin[3], 1);
    assert.equal(m.resampleLen(new Float32Array(0), 5).length, 5); assert.equal(m.resampleLen(Float32Array.of(1), 0).length, 0);
    assert.equal(m.resampleLen(Float32Array.of(0.7), 3)[2], Math.fround(0.7), '單樣本放大');
    // 聲道
    const st = [Float32Array.of(1, 0), Float32Array.of(0, 1)]; const mono = m.remix(st, 1); assert.equal(mono.length, 1); assert.deepStrictEqual(Array.from(mono[0]), [0.5, 0.5]);
    const dbl = m.remix([Float32Array.of(0.3)], 2); assert.equal(dbl.length, 2); assert.equal(dbl[1][0], Math.fround(0.3)); assert.equal(m.remix(st, 2), st);
    // 調速
    const x = [sine(44100)]; const f2 = m.speedChs(x, 0, 0, 2); assert.equal(f2[0].length, 22050, '2 倍速長度減半'); const f05 = m.speedChs(x, 0, 0, 0.5); assert.equal(f05[0].length, 88200);
    assert.equal(m.speedChs(x, 0, 0, 100)[0].length, 22050, '倍率夾住 2'); assert.equal(m.speedChs(x, 0, 0, 0.01)[0].length, 88200); assert.equal(m.speedChs(x, 0, 0, NaN)[0].length, 44100);
    const part = m.speedChs(x, 10000, 20000, 2); assert.equal(part[0].length, 39100); eq(part[0].subarray(0, 10000), x[0].subarray(0, 10000)); eq(part[0].subarray(15000), x[0].subarray(20000));
    assert.equal(m.speedChs([Float32Array.of(1)], 0, 1, 2)[0].length, 1, '單樣本不會變空');
    ok('audio-edit: 重新取樣 / 聲道轉換 / 調速');
}
{ // 串接
    const a = { chs: [sine(1000, 440, 44100)], sr: 44100 }, b = { chs: [sine(500, 440, 44100)], sr: 44100 };
    const r = m.concatAudio([a, b]); assert.equal(r.sr, 44100); assert.equal(r.chs.length, 1); assert.equal(r.chs[0].length, 1500); eq(r.chs[0].subarray(0, 1000), a.chs[0]); eq(r.chs[0].subarray(1000), b.chs[0]);
    const mix = m.concatAudio([{ chs: [sine(100), sine(100)], sr: 44100 }, { chs: [sine(100)], sr: 44100 }]); assert.equal(mix.chs.length, 2); assert.equal(mix.chs[1].length, 200, '單聲道複製成雙聲道');
    const mono = m.concatAudio([{ chs: [sine(100)], sr: 44100 }, { chs: [sine(100), sine(100, 880)], sr: 44100 }]); assert.equal(mono.chs.length, 1); assert.equal(mono.chs[0].length, 200, '以第一段聲道數為準');
    const rs = m.concatAudio([{ chs: [new Float32Array(48000)], sr: 48000 }, { chs: [new Float32Array(22050)], sr: 22050 }, { chs: [new Float32Array(16000)], sr: 16000 }]); assert.equal(rs.sr, 48000); assert.equal(rs.chs[0].length, 48000 + 48000 + 48000, '重新取樣到第一段取樣率');
    assert.equal(m.concatAudio([a]).chs[0].length, 1000); assert.equal(m.concatAudio([]).chs[0].length, 0);
    assert.equal(m.concatAudio([a, { chs: [new Float32Array(0)], sr: 44100 }]).chs[0].length, 1000, '空段');
    ok('audio-edit: 串接（聲道 / 取樣率不同）');
}
{ // 峰值降採樣
    const x = sine(44100, 5, 44100, 0.8); const p = m.peaksFor([x], 0, 44100, 100);
    assert.equal(p.mn.length, 100); near(Math.max(...p.mx), 0.8, 0.01); near(Math.min(...p.mn), -0.8, 0.01);
    const small = Float32Array.of(0.1, -0.2, 0.3, -0.4); const q = m.peaksFor([small], 0, 4, 2); assert.deepStrictEqual([Array.from(q.mn), Array.from(q.mx)].map(a => a.map(v => +v.toFixed(2))), [[-0.2, -0.4], [0.1, 0.3]], '每格 2 個樣本精確');
    const z = m.peaksFor([small], 0, 4, 8); assert.equal(z.mx[0], Math.fround(0.1)); assert.equal(z.mn[7], Math.fround(-0.4), '放大：一格不到一個樣本');
    const out = m.peaksFor([small], 4, 40, 10); assert.ok(Array.from(out.mx).every(v => v === 0), '超出資料為 0');
    const big = new Float32Array(2 ** 24); big[123457] = 1; const t0 = Date.now(); const pk = m.peaksFor([big, big], 0, big.length, 1000); assert.ok(Date.now() - t0 < 100, '大檔降採樣 < 100ms：' + (Date.now() - t0));
    assert.equal(pk.mx.length, 1000);
    const spike = new Float32Array(100); spike[37] = 0.9; assert.equal(m.peaksFor([spike], 0, 100, 1).mx[0], Math.fround(0.9), '小範圍不漏尖峰');
    ok('audio-edit: 峰值降採樣');
}
{ // 時間格式
    assert.equal(m.fmtTime(0), '00:00.000'); assert.equal(m.fmtTime(83456), '01:23.456'); assert.equal(m.fmtTime(3723004), '1:02:03.004'); assert.equal(m.fmtTime(-5), '00:00.000'); assert.equal(m.fmtTime(NaN), '00:00.000'); assert.equal(m.fmtTime(999.6), '00:01.000');
    assert.equal(m.parseTime('83.456'), 83456); assert.equal(m.parseTime('1:23.456'), 83456); assert.equal(m.parseTime('1:02:03.5'), 3723500); assert.equal(m.parseTime(' 5 '), 5000); assert.equal(m.parseTime('0'), 0);
    for (const bad of ['', 'abc', '1:2:3:4', '-1', '1:-2', '1.5:20', '1:', ':5', '1,5', '1e3', '.5']) assert.ok(isNaN(m.parseTime(bad)), JSON.stringify(bad));
    for (const ms of [0, 1, 999, 1000, 59999, 60000, 3599999, 3600000, 7322123]) assert.equal(m.parseTime(m.fmtTime(ms)), ms, '往返 ' + ms);
    ok('audio-edit: 時間格式化 / 解析');
}
{ // 歷史
    const mk = (k) => [new Float32Array(k)];
    const h = Array.from({ length: 30 }, (_, i) => mk(10)); assert.equal(m.trimHistory(h, 21, 1e9).length, 21); assert.equal(m.trimHistory(h, 21, 1e9)[20], h[29], '留最新');
    const shared = [new Float32Array(1000)]; const h2 = [shared, [shared[0], new Float32Array(1000)], mk(1000), mk(1000)];
    assert.equal(m.trimHistory(h2, 21, 1e9).length, 4);
    assert.equal(m.trimHistory(h2, 21, 4 * 4000 - 1).length, 2, '超過記憶體預算丟最舊（第 2 個仍共用第 1 個的聲道，所以要連丟兩個）');
    assert.equal(m.trimHistory([shared, [shared[0]], [shared[0]]], 21, 4000).length, 3, '共用的聲道只算一次');
    assert.equal(m.trimHistory(h2, 21, 1).length, 1, '至少留一個'); assert.equal(m.trimHistory([], 21, 1).length, 0);
    ok('audio-edit: 歷史上限（步數 / 記憶體）');
}
{ // WAV 往返與限制
    const x = sine(2000, 440, 22050, 0.5), y = sine(2000, 880, 22050, 0.25);
    const w = m.encodeWav([x, y], 22050), v = new DataView(w.buffer);
    const s4 = (o) => String.fromCharCode(...w.slice(o, o + 4)); assert.deepStrictEqual([s4(0), s4(8), s4(12), s4(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
    assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(24, true), 22050); assert.equal(v.getUint32(28, true), 22050 * 4); assert.equal(v.getUint16(32, true), 4); assert.equal(v.getUint16(34, true), 16);
    assert.equal(v.getUint32(40, true), 8000); assert.equal(w.length, 44 + 8000); assert.equal(m.wavBytes(2000, 2), w.length);
    for (let i = 0; i < 2000; i += 97) { near(v.getInt16(44 + i * 4, true) / 32768, x[i], 1e-3); near(v.getInt16(46 + i * 4, true) / 32768, y[i], 1e-3); }
    const mono = m.encodeWav([x], 16000); assert.equal(new DataView(mono.buffer).getUint16(22, true), 1); assert.equal(mono.length, 44 + 4000);
    const clip = m.encodeWav([Float32Array.of(2, -2)], 8000), cv = new DataView(clip.buffer); assert.equal(cv.getInt16(44, true), 32767); assert.equal(cv.getInt16(46, true), -32768);
    assert.equal(m.encodeWav([], 8000).length, 44);
    // 匯出前重新取樣長度
    const down = m.resampleChs(m.remix([x, y], 1), 22050, 16000); assert.equal(down.length, 1); assert.equal(down[0].length, Math.round(2000 * 16000 / 22050));
    assert.equal(m.limitMsg(101 * 1048576, 1000).includes('100MB'), true); assert.equal(m.limitMsg(1000, 31 * 60000).includes('30 分鐘'), true); assert.equal(m.limitMsg(100 * 1048576, 30 * 60000), ''); assert.equal(m.limitMsg(0, 0), '');
    ok('audio-edit: WAV 檔頭 / 往返 / 取樣率 / 載入限制');
}
