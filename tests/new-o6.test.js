// 批次 o6：作曲與音響小工坊（和弦 / 旋律 / ABC / MIDI / 簡譜 / 延遲 / 房間 / 喇叭）與錄音機 EQ、變速不變調、節拍器複節奏、頻譜峰值
const { load, ok, near } = require('./_load');
const assert = require('assert');

const m = load('utils/music-lab.html', 'parseRoman, chordProg, PROGS, genMelody, SCALES, scaleMidi, parseKey, parseABC, notesToEvents, jianpuNote, parseJianpu, staffPos, parseMidi, tickSec, midiEvents, delayTable, msToHz, soundSpeed, roomModes, zSeries, zParallel, parseZs, ampPower, voltFromPower, powerFromVolt, splEstimate, loadOpts');

// 和弦
assert.deepEqual(m.chordProg(0, 'pop').map(c => c.name), ['C', 'G', 'Am', 'F']);
assert.deepEqual(m.chordProg(7, 'pop').map(c => c.name), ['G', 'D', 'Em', 'C']);
assert.deepEqual(m.chordProg(9, 'minpop').map(c => c.name), ['Am', 'F', 'C', 'G']);
assert.deepEqual(m.chordProg(0, 'jazz').map(c => c.name), ['Dm7', 'G7', 'Cmaj7', 'Am7']);
assert.equal(m.chordProg(0, 'blues').length, 12);
assert.deepEqual(m.chordProg(0, 'pop')[0].notes, [60, 64, 67]);
assert.equal(m.parseRoman('bVII').root, 10); assert.equal(m.parseRoman('Imaj7').q, 'maj7');
assert.equal(m.parseRoman('imaj7'), null); assert.equal(m.parseRoman('X'), null);
for (const p of m.PROGS) p.rom.split(' ').forEach(r => assert.ok(m.parseRoman(r), r));
ok('music-lab: chords');

// 旋律：可重現、拍數、音階內、結尾主音
for (const sc of Object.keys(m.SCALES)) for (const rh of ['quarter', 'eighth', 'synco', 'dotted', 'mixed']) {
    const a = m.genMelody('abc', 2, sc, rh, 4), b = m.genMelody('abc', 2, sc, rh, 4);
    assert.deepEqual(a, b);
    near(a.reduce((s, n) => s + n.beats, 0), 16);
    const pcs = m.SCALES[sc][1].map(x => (x + 2) % 12);
    a.forEach(n => n.midi === null || assert.ok(pcs.includes(n.midi % 12)));
    assert.equal(a[a.length - 1].midi % 12, 2);
}
assert.notDeepEqual(m.genMelody('a', 0, 'major', 'mixed', 8), m.genMelody('b', 0, 'major', 'mixed', 8));
assert.equal(m.genMelody('x', 0, 'major', 'quarter', 99).length, 64);
ok('music-lab: melody');

// ABC
let r = m.parseABC('X:1\nT:t\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC D E F | G2 A/2 B/2 c2 |]');
assert.deepEqual(r.errors, []);
const ns = r.notes.filter(n => !n.bar);
assert.deepEqual(ns.map(n => n.midi), [60, 62, 64, 65, 67, 69, 71, 72]);
assert.deepEqual(ns.map(n => n.beats), [1, 1, 1, 1, 2, 0.5, 0.5, 2]);
assert.equal(r.qpm, 120); assert.equal(r.title, 't');
// 預設 L：4/4 → 1/8；調號 G：F 自動升；小節內升降延續，小節線後還原；八度；休止
r = m.parseABC("M:4/4\nK:G\nF G ^F F | F z2 c' C,");
assert.deepEqual(r.errors, []);
assert.deepEqual(r.notes.filter(n => !n.bar).map(n => n.midi), [66, 67, 66, 66, 66, null, 84, 48]);
assert.equal(r.notes.find(n => !n.bar).beats, 0.5);
assert.equal(m.parseABC('K:C\n=F').notes[0].midi, 65);
assert.equal(m.parseABC('K:F\nB').notes[0].midi, 70);
assert.equal(m.parseABC('L:1/4\nK:Am\nA >B').notes.filter(n => !n.bar).map(n => n.beats).join(), '1.5,0.5');
assert.equal(m.parseABC('L:1/4\nK:C\nC-C D').notes.filter(n => !n.bar)[0].beats, 2);
// 錯誤要帶行號
r = m.parseABC('X:1\nK:C\nC D E\nC ? D\nL:abc\n');
assert.ok(r.errors.some(e => e.line === 4 && /\?/.test(e.msg)));
assert.ok(r.errors.some(e => e.line === 5));
assert.ok(m.parseABC('K:C\n[CEG]').errors.some(e => e.line === 2));
assert.ok(m.parseABC('K:Hm\nC').errors.some(e => e.line === 1));
assert.ok(m.parseABC('M:4/4\nC D').errors.some(e => e.line === 2));
assert.ok(m.parseABC('K:C\n').errors.length === 1);
assert.deepEqual(m.parseKey('Em').acc, { F: 1 }); assert.equal(m.parseKey('Em').rel, 7);
assert.deepEqual(m.parseKey('Bb').acc, { B: -1, E: -1 }); assert.equal(m.parseKey('Ador').rel, 7);
assert.equal(m.parseKey('xyz'), null);
// 簡譜顯示
assert.equal(m.jianpuNote(60, 0, 1), '1'); assert.equal(m.jianpuNote(67, 0, 0.5), '5_');
assert.equal(m.jianpuNote(72, 0, 2), '1̇ -'); assert.equal(m.jianpuNote(59, 0, 1.5), '7̣·'); assert.equal(m.jianpuNote(null, 0, 1), '0');
near(m.notesToEvents(m.parseABC('L:1/4\nK:C\nC D').notes, 120)[1].t, 0.5);
ok('music-lab: abc');

// 簡譜
r = m.parseJianpu("1 2 3 | 5_ 6. 7' 1, - 0 b3 #4", 0);
assert.deepEqual(r.errors, []);
assert.deepEqual(r.notes.map(n => n.midi), [60, 62, 64, 67, 69, 83, 48, null, 63, 66]);
assert.deepEqual(r.notes.map(n => n.beats), [1, 1, 1, 0.5, 1.5, 1, 2, 1, 1, 1]);
assert.equal(m.parseJianpu('1', 7).notes[0].midi, 67);
r = m.parseJianpu('1 8 x\n- 3', 0);
assert.ok(r.errors.some(e => e.line === 1) && r.errors.length >= 2);
assert.ok(m.parseJianpu('- 1', 0).errors.length === 1);
// 五線譜位置：E4 第 1 線、G4 第 2 線、F4 第 1 間、F5 第 5 線、中央 C 下加 1 線、A5 上加 1 線
assert.equal(m.staffPos(64).pos, '第 1 線'); assert.equal(m.staffPos(67).pos, '第 2 線'); assert.equal(m.staffPos(65).pos, '第 1 間');
assert.equal(m.staffPos(77).pos, '第 5 線'); assert.equal(m.staffPos(60).pos, '下加 1 線'); assert.equal(m.staffPos(81).pos, '上加 1 線');
assert.equal(m.staffPos(62).pos, '第 1 線下方的間'); assert.equal(m.staffPos(79).pos, '第 5 線上方的間');
assert.equal(m.staffPos(60).name, 'C4'); assert.match(m.staffPos(61).pos, /升記號/); assert.equal(m.staffPos(61).step, m.staffPos(60).step);
ok('music-lab: jianpu/staff');

// MIDI（測試自建 SMF）
const vlq = (v) => { const o = [v & 127]; while ((v >>= 7)) o.unshift((v & 127) | 128); return o; };
const trk = (bytes) => [0x4d, 0x54, 0x72, 0x6b, 0, 0, (bytes.length >> 8) & 255, bytes.length & 255, ...bytes];
const hdr = (fmt, n, div) => [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, fmt, 0, n, (div >> 8) & 255, div & 255];
const t0 = trk([0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0, 0xff, 0x58, 4, 3, 2, 24, 8, 0, 0xff, 0x03, 4, 0x6d, 0x65, 0x6c, 0x30, 0, 0xff, 0x2f, 0]); // 500000us = 120BPM, 3/4
const t1 = trk([0, 0x90, 60, 100, ...vlq(480), 0x80, 60, 0, 0, 0x90, 64, 90, ...vlq(480), 0x90, 64, 0, 0, 0x99, 36, 100, 10, 0x89, 36, 0, 0, 0xff, 0x2f, 0]);
let mm = m.parseMidi(new Uint8Array([...hdr(1, 2, 480), ...t0, ...t1]));
assert.ok(!mm.error); assert.equal(mm.format, 1); assert.equal(mm.division, 480); assert.equal(mm.tracks.length, 2);
assert.deepEqual(mm.sig, [3, 4]); assert.equal(mm.tracks[0].name, 'mel0'); assert.equal(mm.tempos[0].us, 500000);
assert.deepEqual(mm.tracks[1].notes.filter(n => n.ch === 0).map(n => [n.tick, n.dur, n.note]), [[0, 480, 60], [480, 480, 64]]);
near(m.tickSec(mm.tempos, 480, 480), 0.5);
const ev = m.midiEvents(mm); assert.equal(ev.events.length, 2); near(ev.events[1].t, 0.5); near(ev.events[1].dur, 0.5); near(ev.seconds, 1.0, 0.05);
// 變速：480 tick 之後 tempo 變慢一倍
near(m.tickSec([{ tick: 0, us: 500000 }, { tick: 480, us: 1000000 }], 480, 960), 1.5);
// 壞檔
assert.match(m.parseMidi(new Uint8Array([1, 2, 3])).error, /MIDI/);
assert.match(m.parseMidi(new Uint8Array([...hdr(0, 1, 0x8000 | 25)])).error, /SMPTE/);
assert.match(m.parseMidi(new Uint8Array([...hdr(0, 1, 480)])).error, /音軌/);
const trunc = m.parseMidi(new Uint8Array([...hdr(0, 1, 480), ...t1.slice(0, 14)]));
assert.ok(trunc.error || trunc.errors.length > 0);
assert.ok(m.parseMidi(new Uint8Array([...hdr(0, 1, 480), ...trk([0, 0x40, 1])])).errors.length === 1);
ok('music-lab: midi');

// 延遲：120 BPM 四分 500ms；附點八分 375；三連四分 333.33；Hz
const dt = m.delayTable(120), q = dt.find(x => x.name.startsWith('1/4')), e8 = dt.find(x => x.name.startsWith('1/8'));
near(q.straight, 500); near(e8.dotted, 375); near(q.triplet, 1000 / 3); near(m.msToHz(q.straight), 2); near(dt[0].straight, 2000);
near(m.delayTable(60)[2].straight, 1000);
// 房間共振：5m → 34.3 Hz；4m → 42.875；可調聲速；氣溫 20°C 約 343.4
const rm = m.roomModes(5, 4, 2.6, 343, 2);
near(rm[0].f, 34.3 * 1.0, 1e-9); assert.equal(rm[0].dim, '長'); near(rm.find(x => x.dim === '寬' && x.n === 1).f, 42.875); near(rm.find(x => x.dim === '高' && x.n === 2).f, 343 / 2.6);
near(m.roomModes(5, 4, 3, 340, 1)[0].f, 34); assert.equal(rm.length, 6);
assert.ok(rm.every((x, i) => !i || rm[i - 1].f <= x.f));
near(m.soundSpeed(20), 343.42, 1e-4);
// 喇叭
near(m.zSeries([8, 8]), 16); near(m.zParallel([8, 8]), 4); near(m.zParallel([4, 8]), 8 / 3); near(m.zParallel([8]), 8);
near(m.powerFromVolt(2.83, 8), 1.0011, 1e-3); near(m.voltFromPower(100, 8), Math.sqrt(800));
near(m.ampPower(100, 8, 4), 200); near(m.ampPower(100, 8, 16), 50);
near(m.splEstimate(90, 1, 1), 90); near(m.splEstimate(90, 100, 1), 110); near(m.splEstimate(90, 100, 2), 110 - 6.0206, 1e-4); near(m.splEstimate(90, 2, 1), 93.0103, 1e-4);
assert.deepEqual(m.parseZs('8, 4  8'), [8, 4, 8]); assert.equal(m.parseZs('8,0'), null); assert.equal(m.parseZs('a'), null); assert.equal(m.parseZs(''), null);
ok('music-lab: audio calcs');

// 記住的輸入：壞資料容錯
assert.equal(m.loadOpts(null).tab, 'chord'); assert.equal(m.loadOpts('x').tab, 'chord'); assert.equal(m.loadOpts({ tab: 'zzz' }).tab, 'chord');
const bad = { tab: 'abc', v: { abc: 'K:C', sZ: 5, evil: 'x', jText: 'y'.repeat(20001) } };
assert.equal(m.loadOpts(bad).tab, 'abc');
assert.deepEqual(m.loadOpts(bad).v, { abc: 'K:C' });
assert.deepEqual(m.loadOpts({ tab: 'abc', v: [1] }).v, {});
ok('music-lab: opts');

// 錄音機：變速不變調、變調、EQ
const ar = load('utils/audio-recorder.html', 'stretchCh, pitchCh, pitchRatio, biquadCoef, biquadRun, eqCh, resampleLen');
const SR = 44100, sine = (f, n, a = 0.5) => Float32Array.from({ length: n }, (_, i) => a * Math.sin(2 * Math.PI * f * i / SR));
const zc = (c) => { let k = 0; for (let i = 1; i < c.length; i++) if (c[i - 1] < 0 && c[i] >= 0) k++; return k; };
const freqOf = (c) => zc(c.subarray(4096, c.length - 4096)) / ((c.length - 8192) / SR);
const rms = (c) => Math.sqrt(c.reduce((s, x) => s + x * x, 0) / c.length);
const s440 = sine(440, SR * 2);
let st = ar.stretchCh(s440, 1.5);
assert.ok(Math.abs(st.length - Math.round(s440.length / 1.5)) <= 1); assert.ok(Math.abs(freqOf(st) - 440) < 8, 'stretch keeps pitch ' + freqOf(st));
st = ar.stretchCh(s440, 0.5); assert.equal(st.length, s440.length * 2); assert.ok(Math.abs(freqOf(st) - 440) < 8);
assert.ok(rms(st.subarray(8192, st.length - 8192)) > 0.3);
let pt = ar.pitchCh(s440, 12); assert.ok(Math.abs(pt.length - s440.length) < 8); assert.ok(Math.abs(freqOf(pt) - 880) < 16, 'pitch ' + freqOf(pt));
pt = ar.pitchCh(s440, -12); assert.ok(Math.abs(freqOf(pt) - 220) < 8);
assert.equal(ar.pitchCh(s440, 0), s440); near(ar.pitchRatio(99), 2); near(ar.pitchRatio(7), Math.pow(2, 7 / 12));
assert.equal(ar.stretchCh(sine(440, 1000), 2).length, 500); // 太短退回重取樣
// EQ：低切 1k 對 100Hz 衰減很多、對 8kHz 幾乎不變；低通相反；高頻擱架 +6dB、低頻擱架 -6dB、peak 中心增益
const gain = (bands, f) => { const x = sine(f, SR), y = ar.eqCh(x, bands, SR); return rms(y.subarray(8192)) / rms(x.subarray(8192)); };
assert.ok(gain([{ type: 'hp', f: 1000 }], 100) < 0.05); assert.ok(Math.abs(gain([{ type: 'hp', f: 1000 }], 8000) - 1) < 0.05);
assert.ok(gain([{ type: 'lp', f: 1000 }], 8000) < 0.05); assert.ok(Math.abs(gain([{ type: 'lp', f: 1000 }], 100) - 1) < 0.05);
assert.ok(Math.abs(gain([{ type: 'high', f: 6000, g: 6 }], 15000) - 2) < 0.1);
assert.ok(Math.abs(gain([{ type: 'low', f: 120, g: -6 }], 30) - 0.5) < 0.05);
assert.ok(Math.abs(gain([{ type: 'peak', f: 1000, g: 6, q: 1 }], 1000) - 2) < 0.05); assert.ok(Math.abs(gain([{ type: 'peak', f: 1000, g: 6, q: 1 }], 100) - 1) < 0.05);
assert.ok(ar.eqCh(sine(100, 1000, 1), [{ type: 'low', f: 120, g: 12 }], SR).every(x => Math.abs(x) <= 1));
ok('audio-recorder: stretch / pitch / eq');

// 節拍器複節奏 / 頻譜峰值
const mt = load('fun/metronome.html', 'polyHits');
const h = mt.polyHits(3, 4, 4, 1);
assert.deepEqual(h.filter(x => x.v === 'A').map(x => x.t), [0, 4 / 3, 8 / 3]); assert.deepEqual(h.filter(x => x.v === 'B').map(x => x.t), [0, 1, 2, 3]);
assert.equal(h[0].v, 'A'); assert.equal(h.length, 7); assert.equal(mt.polyHits(5, 4, 2, 3).length, 27); near(mt.polyHits(5, 4, 2, 2).pop().t, 2 + 2 * 4 / 5);
assert.ok(mt.polyHits(5, 4, 4, 2).every((x, i, a) => !i || a[i - 1].t <= x.t));
const tg = load('utils/tone-generator.html', 'peakFreq');
const db = new Float32Array(2048).fill(-100); db[100] = -20; db[300] = -10;
near(tg.peakFreq(db, 44100), 300 * 44100 / 2 / 2048); assert.equal(tg.peakFreq(db, 44100, 20, -5), -1); assert.equal(tg.peakFreq(new Float32Array(16).fill(-120), 44100), -1);
ok('metronome polyHits / tone peakFreq');
