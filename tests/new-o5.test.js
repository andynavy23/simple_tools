// 批次 o5：樂感訓練（mini-games/ear-training.html）
const assert = require('assert');
const { load, ok, near } = require('./_load');
{
    const m = load('mini-games/ear-training.html', 'midiFreq, freqMidi, noteLabel, intervalSemis, INTERVALS, IV_LEVELS, pickWeighted, weakWeight, detectPitch, foldCents, centsOff, fretMidi, fretPositions, diaIndex, staffPos, isWhite, cleanStats, spell, kindNotes, keySig, CIRCLE');
    // 音名 ↔ 頻率（A4 = 440）
    near(m.midiFreq(69), 440); near(m.midiFreq(60), 261.6256, 1e-5); near(m.midiFreq(69, 442), 442); near(m.freqMidi(880), 81); near(m.freqMidi(261.6256), 60, 1e-5);
    assert.deepStrictEqual([60, 61, 69, 40, 71].map(m.noteLabel), ['C4', 'C♯4', 'A4', 'E2', 'B4']);
    // 音程
    assert.strictEqual(m.intervalSemis(60, 67), 7); assert.strictEqual(m.intervalSemis(72, 60), 12); assert.strictEqual(m.INTERVALS[7], '純五度 P5'); assert.strictEqual(m.INTERVALS[4], '大三度 M3');
    assert.deepStrictEqual([1, 2, 3].map(l => m.IV_LEVELS[l].length), [5, 8, 12]);
    assert.strictEqual(m.pickWeighted(['a', 'b', 'c'], [1, 1, 2], 0), 'a'); assert.strictEqual(m.pickWeighted(['a', 'b', 'c'], [1, 1, 2], 0.3), 'b'); assert.strictEqual(m.pickWeighted(['a', 'b', 'c'], [1, 1, 2], 0.99), 'c');
    assert.ok(m.weakWeight([2, 10]) > m.weakWeight([10, 10]) && m.weakWeight([10, 10]) === 1 && m.weakWeight(undefined) === 3);
    // 音高偵測：合成正弦波誤差 ≤ 5 音分
    const sine = (f, sr, n = 4096) => Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(2 * Math.PI * f * i / sr));
    for (const sr of [44100, 48000]) for (const f of [82.41, 130.81, 220, 261.63, 440, 523.25, 880]) { const d = m.detectPitch(sine(f, sr), sr, 70, 1100); assert.ok(d > 0 && Math.abs(1200 * Math.log2(d / f)) <= 5, `${f}@${sr} → ${d}`); }
    assert.strictEqual(m.detectPitch(new Float32Array(4096), 44100), -1);
    // 視唱音分：差一個八度折回 0；差 +30
    near(m.foldCents(1200), 0, 1e-9); near(m.foldCents(-1190), 10, 1e-9); near(m.foldCents(630), -570, 1e-9);
    near(m.centsOff(440, 69), 0, 1e-9); near(m.centsOff(880, 69), 1200, 1e-9); assert.ok(Math.abs(m.foldCents(m.centsOff(m.midiFreq(69.3), 69)) - 30) < 1e-6);
    // 指板（標準調音）
    assert.strictEqual(m.fretMidi(6, 0), 40); assert.strictEqual(m.fretMidi(1, 0), 64); assert.strictEqual(m.fretMidi(6, 5), 45); assert.strictEqual(m.fretMidi(2, 1), 60); assert.strictEqual(m.fretMidi(1, 12), 76);
    assert.deepStrictEqual(m.fretPositions(0, 12).map(p => p.str + ':' + p.fret), ['1:8', '2:1', '3:5', '4:10', '5:3', '6:8']);
    assert.deepStrictEqual(m.fretPositions(4, 12).map(p => p.str + ':' + p.fret), ['1:0', '1:12', '2:5', '3:9', '4:2', '5:7', '6:0', '6:12']);
    // 五線譜位置（0 = 最下線）
    assert.strictEqual(m.staffPos(64, 'treble'), 0); assert.strictEqual(m.staffPos(77, 'treble'), 8); assert.strictEqual(m.staffPos(60, 'treble'), -2); assert.strictEqual(m.staffPos(67, 'treble'), 2);
    assert.strictEqual(m.staffPos(43, 'bass'), 0); assert.strictEqual(m.staffPos(57, 'bass'), 8); assert.strictEqual(m.staffPos(60, 'bass'), 10); assert.strictEqual(m.staffPos(59, 'bass'), 9);
    assert.strictEqual(m.staffPos(61, 'treble'), m.staffPos(60, 'treble')); assert.ok(m.isWhite(60) && !m.isWhite(61));
    // 統計驗證
    let s = m.cleanStats(null); assert.strictEqual(Object.keys(s.iv).length, 12); assert.deepStrictEqual(s.sing, [0, 0]);
    s = m.cleanStats({ iv: { 3: [5, 3], 4: 'x', 5: [2, 9] }, sing: [1, 'a'], fret: null, key: [-1, 4], fretBest: 1e12 });
    assert.deepStrictEqual(s.iv[3], [3, 3]); assert.deepStrictEqual(s.iv[4], [0, 0]); assert.deepStrictEqual(s.iv[5], [2, 9]); assert.deepStrictEqual(s.sing, [0, 0]); assert.deepStrictEqual(s.key, [0, 4]); assert.strictEqual(s.fretBest, 99999);
    assert.deepStrictEqual(m.cleanStats([1, 2]).fret, [0, 0]);
    // 樂理拼音
    assert.strictEqual(m.kindNotes('C', 'maj').join(' '), 'C D E F G A B'); assert.strictEqual(m.kindNotes('F♯', 'maj').join(' '), 'F♯ G♯ A♯ B C♯ D♯ E♯');
    assert.strictEqual(m.kindNotes('B♭', 'maj').join(' '), 'B♭ C D E♭ F G A'); assert.strictEqual(m.kindNotes('A', 'min').join(' '), 'A B C D E F G'); assert.strictEqual(m.kindNotes('E♭', 'tri').join(' '), 'E♭ G B♭');
    assert.strictEqual(m.kindNotes('C', 'dom7').join(' '), 'C E G B♭'); assert.strictEqual(m.kindNotes('C', 'dim7').join(' '), 'C E♭ G♭ B♭♭'); assert.strictEqual(m.kindNotes('A', 'pmin').join(' '), 'A C D E G'); assert.strictEqual(m.kindNotes('E', 'blues').join(' '), 'E G A B♭ B D');
    assert.strictEqual(m.kindNotes('D', 'maj7').join(' '), 'D F♯ A C♯'); assert.strictEqual(m.kindNotes('C', 'aug').join(' '), 'C E G♯');
    // 五度圈
    assert.deepStrictEqual(m.keySig(0), { k: 0, accs: [] }); assert.deepStrictEqual(m.keySig(2).accs, ['F♯', 'C♯']); assert.deepStrictEqual(m.keySig(9), { k: -3, accs: ['B♭', 'E♭', 'A♭'] }); assert.strictEqual(m.keySig(11).accs.join(), 'B♭'); assert.strictEqual(m.keySig(6).k, 6);
    // 每一格的大調音階與調號升降個數一致、關係小調相同調號
    m.CIRCLE.forEach(([maj, min], i) => { const notes = m.kindNotes(maj, 'maj'), n = Math.abs(m.keySig(i).k); const acc = notes.filter(x => /[♯♭]/.test(x)).length; assert.strictEqual(acc, n, maj); assert.deepStrictEqual(m.kindNotes(min, 'min').slice().sort(), notes.slice().sort(), min + 'm'); });
    ok('ear-training: freq/interval/pitch detect/fretboard/staff/stats/theory');
}
