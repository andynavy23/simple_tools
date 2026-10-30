// 批次 o7：media-kit（WAV 編碼 / 章節檢查 / 時間戳 / 字幕 / 規格表）
const { load, ok } = require('./_load');
const assert = require('assert');
{
    const m = load('utils/media-kit.html', 'wavEncode, mixMono, parseTs, fmtTs, parseChapters, checkChapters, chaptersText, parseCues, activeCue, ratioOf, sizeMB, SPECS, decodeEstimate');
    // WAV 標頭
    const buf = m.wavEncode([new Float32Array([0, 1, -1, 2]), new Float32Array([0.5, 0, 0, -2])], 44100), v = new DataView(buf);
    const s4 = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    assert.equal(buf.byteLength, 44 + 4 * 2 * 2);
    assert.deepEqual([s4(0), s4(8), s4(12), s4(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
    assert.equal(v.getUint32(4, true), 36 + 16); assert.equal(v.getUint16(20, true), 1); assert.equal(v.getUint16(22, true), 2);
    assert.equal(v.getUint32(24, true), 44100); assert.equal(v.getUint32(28, true), 176400); assert.equal(v.getUint16(32, true), 4); assert.equal(v.getUint16(34, true), 16); assert.equal(v.getUint32(40, true), 16);
    assert.deepEqual([0, 1, 2, 3].map(i => v.getInt16(44 + i * 4, true)), [0, 32767, -32768, 32767]);   // 左聲道，超過 ±1 夾住
    assert.equal(v.getInt16(46, true), 16383);   // 0.5*32767 = 16383.5 → setInt16 截斷
    assert.equal(m.wavEncode([new Float32Array(3)], 8000).byteLength, 44 + 6);               // 單聲道
    assert.equal(m.wavEncode([new Float32Array(1), new Float32Array(1), new Float32Array(1)], 8000).byteLength, 44 + 4); // 最多兩軌
    assert.deepEqual(Array.from(m.mixMono([new Float32Array([1, 0]), new Float32Array([0, 1])])[0]), [0.5, 0.5]);
    assert.equal(m.decodeEstimate(60, 44100, 2).decodeBytes, 60 * 44100 * 2 * 4);
    // 時間戳
    assert.equal(m.parseTs('0:00'), 0); assert.equal(m.parseTs('1:23'), 83); assert.equal(m.parseTs('1:02:03'), 3723);
    for (const b of ['abc', '1:60', '1:2', '1:61:00', '', '5']) assert.ok(Number.isNaN(m.parseTs(b)), b);
    assert.equal(m.fmtTs(83), '01:23'); assert.equal(m.fmtTs(3723), '01:02:03'); assert.equal(m.fmtTs(5, true), '00:00:05');
    // 章節
    let p = m.parseChapters('0:00 開場\n- 0:45 第一章\n\n3:10 第二章\n壞行');
    assert.equal(p.list.length, 3); assert.deepEqual(p.bad, ['壞行']); assert.deepEqual(m.checkChapters(p.list), []);
    assert.equal(m.chaptersText(p.list), '00:00 開場\n00:45 第一章\n03:10 第二章');
    assert.equal(m.chaptersText(m.parseChapters('0:00 a\n30:00 b\n1:00:00 c').list), '00:00:00 a\n00:30:00 b\n01:00:00 c');
    p = m.parseChapters('0:05 a\n0:10 b');
    const es = m.checkChapters(p.list); assert.ok(es.some(e => /00:00/.test(e)) && es.some(e => /3 個/.test(e)) && es.some(e => /10 秒/.test(e)));
    assert.ok(m.checkChapters(m.parseChapters('0:00 a\n0:10 b\n0:20 c').list).length === 0);            // 剛好 10 秒
    assert.ok(m.checkChapters(m.parseChapters('0:00 a\n0:09 b\n0:30 c').list).length === 1);
    assert.ok(m.checkChapters(m.parseChapters('0:00 a\n0:30 b\n0:20 c').list).length >= 1);             // 非遞增
    assert.ok(m.checkChapters(m.parseChapters('0:00 a\n0:30 b\n1:00 c').list, 65).length === 1);        // 最後一章 5 秒
    assert.ok(m.checkChapters(m.parseChapters('0:00 a\n0:30 b\n1:00 c').list, 120).length === 0);
    // 字幕
    const cs = m.parseCues('﻿1\r\n00:00:01,000 --> 00:00:02,500\r\n哈<i>囉</i>\r\n\r\nWEBVTT-like\n01:00.5 --> 01:02.000\nB\n');
    assert.equal(cs.length, 2); assert.deepEqual([cs[0].s, cs[0].e, cs[0].t], [1, 2.5, '哈囉']); assert.equal(cs[1].s, 60.5);
    assert.equal(m.activeCue(cs, 2), '哈囉'); assert.equal(m.activeCue(cs, 2.5), ''); assert.equal(m.activeCue([], 1), '');
    // 比例 / 大小 / 規格表
    assert.equal(m.ratioOf(1920, 1080), '16:9'); assert.equal(m.ratioOf(0, 5), '');
    assert.ok(Math.abs(m.sizeMB(8000, 60) - 57.22) < 0.01);
    assert.ok(m.SPECS.length >= 10);
    for (const s of m.SPECS) {
        assert.ok(s.name && s.r && s.br && s.w > 0 && s.h > 0, s.name);
        assert.equal(m.ratioOf(s.w, s.h), s.r, s.name + ' 比例與解析度不符');
    }
    assert.equal(new Set(m.SPECS.map(s => s.name)).size, m.SPECS.length);
    ok('media-kit');
}
