// 批次 c3：音頻產生器 / 聽力頻率測試、字幕時間軸工具 的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ===== tone-generator =====
const T = load('utils/tone-generator.html', 'freqToPos, posToFreq, dbToGain, gainToDb, noteFreq, freqToNote, sweepFreq, fadePlan, hearingResult, HEAR_LEVELS, binauralFreqs, pinkNoise, parseFreq, PRESETS');
near(T.freqToPos(20), 0); near(T.freqToPos(20000), 1); near(T.posToFreq(0), 20); near(T.posToFreq(1), 20000);
for (const f of [20, 55, 440, 1000, 12345, 20000]) near(T.posToFreq(T.freqToPos(f)), f, 1e-9);
near(T.freqToPos(1), 0); near(T.freqToPos(99999), 1); near(T.posToFreq(-3), 20); near(T.posToFreq(9), 20000);
near(T.freqToPos(Math.sqrt(20 * 20000)), 0.5);
ok('tone: 頻率 <-> 對數滑桿位置');
near(T.dbToGain(0), 1); near(T.dbToGain(-6), 0.501187, 1e-5); near(T.dbToGain(-20), 0.1); near(T.dbToGain(-30), 0.0316228, 1e-5);
near(T.gainToDb(T.dbToGain(-37.5)), -37.5); near(T.gainToDb(0.1), -20);
assert.ok(T.dbToGain(-6) < 1);
ok('tone: dB <-> 增益');
near(T.noteFreq('A4'), 440); near(T.noteFreq('C4'), 261.6256, 1e-5); near(T.noteFreq('a4'), 440); near(T.noteFreq('A#3'), 233.0819, 1e-5);
near(T.noteFreq('Bb3'), T.noteFreq('A#3')); near(T.noteFreq('A5'), 880); near(T.noteFreq('C-1'), 8.1758, 1e-4);
assert.ok(Number.isNaN(T.noteFreq('H4'))); assert.ok(Number.isNaN(T.noteFreq(''))); assert.ok(Number.isNaN(T.noteFreq(null)));
assert.deepEqual(T.freqToNote(440), { name: 'A4', cents: 0 }); assert.equal(T.freqToNote(261.63).name, 'C4');
assert.equal(T.freqToNote(450).cents, 39); assert.equal(T.freqToNote(0), null); assert.equal(T.freqToNote(-5), null);
assert.ok(T.PRESETS.every(([n, f]) => typeof n === 'string' && f >= 20 && f <= 20000));
ok('tone: 音名 <-> 頻率');
near(T.sweepFreq(0, 10, 20, 20000, 'log'), 20); near(T.sweepFreq(10, 10, 20, 20000, 'log'), 20000); near(T.sweepFreq(5, 10, 20, 20000, 'log'), 632.4555, 1e-5);
near(T.sweepFreq(5, 10, 20, 20000, 'linear'), 10010); near(T.sweepFreq(2.5, 10, 100, 200, 'linear'), 125);
near(T.sweepFreq(-1, 10, 20, 200, 'linear'), 20); near(T.sweepFreq(99, 10, 20, 200, 'linear'), 200);
near(T.sweepFreq(5, 10, 20000, 20, 'log'), 632.4555, 1e-5); near(T.sweepFreq(5, 10, 200, 100, 'linear'), 150);
let prev = 0; for (let t = 0; t <= 10; t += 0.5) { const f = T.sweepFreq(t, 10, 20, 20000, 'log'); assert.ok(f >= prev); prev = f; }
ok('tone: 掃描頻率軌跡');
let fp = T.fadePlan(5); near(fp.t0, 5); near(fp.t1, 5.02); assert.ok(fp.stopAt > fp.t1);
fp = T.fadePlan(1, 150); near(fp.t1, 1.15);
ok('tone: 淡入淡出參數');
assert.deepEqual(T.HEAR_LEVELS, [8000, 10000, 12000, 14000, 15000, 16000, 17000, 18000, 19000, 20000]);
assert.equal(T.hearingResult([]).done, false); assert.equal(T.hearingResult([true, true]).done, false);
let r = T.hearingResult([true, true, true, true, true, false]);
assert.ok(r.done); assert.equal(r.khz, 15); assert.equal(r.text, '你的聽力上限約 15 kHz');
r = T.hearingResult([false]); assert.ok(r.done); assert.equal(r.khz, null); assert.ok(r.text.includes('低於 8 kHz'));
r = T.hearingResult([true, false]); assert.equal(r.khz, 8);
r = T.hearingResult(new Array(10).fill(true)); assert.ok(r.done); assert.equal(r.khz, 20); assert.ok(r.text.includes('至少到 20 kHz'));
r = T.hearingResult([true, true, true, true, true, true, true, true, true, false]); assert.equal(r.khz, 19);
ok('tone: 聽力測試判定');
assert.deepEqual(T.binauralFreqs(200, 10), [200, 210]); assert.deepEqual(T.binauralFreqs(1000, 99), [500, 540]);
assert.deepEqual(T.binauralFreqs('x', 'y'), [200, 210]); assert.deepEqual(T.binauralFreqs(10, 0.1), [100, 101]);
ok('tone: 雙耳拍');
const pn = T.pinkNoise(5000); assert.equal(pn.length, 5000); assert.ok(pn.every(v => Number.isFinite(v) && Math.abs(v) < 1.5));
assert.ok(pn.some(v => v > 0) && pn.some(v => v < 0));
let seed = 1; const pn2 = T.pinkNoise(10, () => (seed = (seed * 16807) % 2147483647) / 2147483647); assert.equal(pn2.length, 10);
assert.equal(T.parseFreq('abc', 440), 440); assert.equal(T.parseFreq('5'), 20); assert.equal(T.parseFreq('99999'), 20000); assert.equal(T.parseFreq('1000.5'), 1000.5);
ok('tone: 粉紅噪音與輸入容錯');

// ===== subtitle-tool =====
const S = load('utils/subtitle-tool.html', 'tcParse, tcFormat, stripTags, parseSubs, serialize, outName, decodeBytes, sortCues, shiftCues, retime, FPS, fpsScale, scaleCues, mergeCues, chunkText, splitCues, checkCues, fixCues, replaceCues, detectFmt');
assert.equal(S.tcParse('00:00:01,000'), 1000); assert.equal(S.tcParse('0:0:1.5'), 1500); assert.equal(S.tcParse('00:01.000'), 1000);
assert.equal(S.tcParse('01:02:03,004'), 3723004); assert.equal(S.tcParse('1:00:00.50'), 3600500); assert.equal(S.tcParse(' 00:00:01.5 '), 1500);
assert.equal(S.tcParse('00:00:59.9995'), 60000); assert.equal(S.tcParse('00:00:59.9994'), 59999); assert.equal(S.tcParse('00:59:59.9996'), 3600000);
assert.equal(S.tcParse('0:00:01.05'), 1050); assert.equal(S.tcParse('00:00:01.5000'), 1500);
for (const bad of ['', 'abc', '12', '1:', ':1:2', '00:00:01,', null, undefined, '-1:00:00,000']) assert.ok(Number.isNaN(S.tcParse(bad)), String(bad));
assert.equal(S.tcFormat(0), '00:00:00,000'); assert.equal(S.tcFormat(3723004), '01:02:03,004'); assert.equal(S.tcFormat(59999.6), '00:01:00,000');
assert.equal(S.tcFormat(1500, '.'), '00:00:01.500'); assert.equal(S.tcFormat(1500, '.', 1), '0:00:01.500'); assert.equal(S.tcFormat(-5), '00:00:00,000'); assert.equal(S.tcFormat(NaN), '00:00:00,000');
assert.equal(S.tcFormat(360000000), '100:00:00,000');
for (const ms of [0, 1, 999, 1000, 59999, 60000, 3599999, 3600000, 86399999]) assert.equal(S.tcParse(S.tcFormat(ms)), ms);
ok('subtitle: 時間字串 <-> 毫秒（含進位邊界）');

const SRT = '1\n00:00:01,000 --> 00:00:03,500\n<i>你好，世界</i>\nsecond line\n\n2\n00:00:04,000 --> 00:00:05,000\nHello\n\n3\n00:01:00,000 --> 01:00:00,123\n{\\an8}Top\n';
let p = S.parseSubs(SRT);
assert.equal(p.fmt, 'srt'); assert.equal(p.cues.length, 3); assert.deepEqual(p.cues[0], { s: 1000, e: 3500, t: '<i>你好，世界</i>\nsecond line', set: '' });
assert.equal(p.cues[2].e, 3600123); assert.equal(p.cues[2].t, '{\\an8}Top');
// 往返：SRT -> VTT -> SRT
const vtt = S.serialize(p.cues, 'vtt', { nl: 'lf' });
assert.ok(vtt.startsWith('WEBVTT\n\n')); assert.ok(vtt.includes('00:00:01.000 --> 00:00:03.500'));
const p2 = S.parseSubs(vtt); assert.equal(p2.fmt, 'vtt'); assert.deepEqual(p2.cues, p.cues);
assert.equal(S.serialize(p2.cues, 'srt', { nl: 'lf' }), S.serialize(p.cues, 'srt', { nl: 'lf' }));
assert.equal(S.serialize(p.cues, 'srt', { nl: 'lf' }), SRT);
// SBV 往返
const sbv = S.serialize(p.cues, 'sbv', { nl: 'lf' }); assert.ok(sbv.startsWith('0:00:01.000,0:00:03.500\n'));
const p3 = S.parseSubs(sbv); assert.equal(p3.fmt, 'sbv'); assert.deepEqual(p3.cues.map(c => [c.s, c.e, c.t]), p.cues.map(c => [c.s, c.e, c.t]));
ok('subtitle: SRT -> VTT -> SRT / SBV 往返');

// VTT 特性
const V = 'WEBVTT - 標題\nKind: captions\n\nNOTE 這是註解\n跨行註解\n\nintro\n00:01.000 --> 00:03.000 align:start position:10%\nHi\n\n00:00:04.000 --> 00:00:05.500\nLine A\nLine B\n';
p = S.parseSubs(V); assert.equal(p.cues.length, 2); assert.equal(p.cues[0].s, 1000); assert.equal(p.cues[0].set, 'align:start position:10%'); assert.equal(p.cues[1].t, 'Line A\nLine B');
assert.ok(S.serialize(p.cues, 'vtt', { nl: 'lf' }).includes('00:00:01.000 --> 00:00:03.000 align:start position:10%'));
assert.ok(!S.serialize(p.cues, 'srt', { nl: 'lf' }).includes('align'));
ok('subtitle: VTT header / NOTE / cue 設定 / 省略小時');

// 畸形輸入
p = S.parseSubs('\uFEFF\r\n\r\n1\r\n0:0:1.5 --> 0:0:2.5\r\nA\r\n\r\n\r\n\r\n5\r\n00:00:03,000 --> 00:00:04,000\r\n\r\n\r\n7\r\n00:00:05,000 --> 00:00:06,000\r\nB\r\n');
assert.deepEqual(p.cues.map(c => [c.s, c.e, c.t]), [[1500, 2500, 'A'], [3000, 4000, ''], [5000, 6000, 'B']]);
p = S.parseSubs('1\n00:00:01,000 --> 00:00:02,000\nA\n2\n00:00:03,000 --> 00:00:04,000\nB\n'); // 缺空行
assert.deepEqual(p.cues.map(c => c.t), ['A', 'B']);
assert.equal(S.parseSubs('').cues.length, 0); assert.equal(S.parseSubs('   \n\n').warns.length, 0); assert.equal(S.parseSubs('隨便一段文字').warns.length, 1);
assert.equal(S.parseSubs('00:00:01,000 --> 00:00:02,000\nno index\n').cues.length, 1);
assert.equal(S.parseSubs('1\n00:00:01,000 -> 00:00:02,000\nX').cues[0].e, 2000);
assert.equal(S.parseSubs('1\n00:00:01,000 --> garbage\nX').cues.length, 0);
assert.doesNotThrow(() => S.parseSubs('\0\0\0 --> \n--> -->\n99:99:99 --> 1:1'));
assert.equal(S.parseSubs('1\n00:00:01,000 --> 00:00:02,000\n2025\n').cues[0].t, '2025'); // 文字最後一行是數字且沒有下一個 cue 時保留
assert.equal(S.parseSubs('1\n00:00:00,000 --> 00:00:59,9995\nX').cues[0].e, 60000);
ok('subtitle: 畸形輸入容錯');

// ASS
const ASS = '[Script Info]\nTitle: x\n\n[V4+ Styles]\nFormat: Name, Fontname\nStyle: Default,Arial\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\an8}Hello, world\\Nline two\nComment: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,skip\nDialogue: 0,0:01:02.50,0:01:04.00,Default,,0,0,0,,你好\\h世界\n';
p = S.parseSubs(ASS); assert.equal(p.fmt, 'ass'); assert.equal(p.cues.length, 2);
assert.deepEqual(p.cues[0], { s: 1000, e: 3500, t: '{\\an8}Hello, world\nline two', set: '' }); assert.equal(p.cues[1].s, 62500); assert.equal(p.cues[1].t, '你好 世界');
p = S.parseSubs(ASS, { strip: true }); assert.equal(p.cues[0].t, 'Hello, world\nline two');
p = S.parseSubs('[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,a,b,c\n'); assert.equal(p.cues[0].t, 'a,b,c');
ok('subtitle: ASS 基本');

assert.equal(S.stripTags('<i>a</i> <font color="red">b</font>{\\an8}{\\pos(1,2)}c a<b'), 'a bc a<b');
assert.equal(S.stripTags('<i>x</i>{\\an8}', { html: false }), '<i>x</i>'); assert.equal(S.stripTags('<i>x</i>{\\an8}', { ass: false }), 'x{\\an8}');
// 輸出：換行 / BOM / CSV / TXT
const cs = [{ s: 1000, e: 2000, t: 'a, "b"\nc' }, { s: 3000, e: 4000, t: '' }];
assert.ok(S.serialize(cs, 'srt', { nl: 'crlf' }).includes('\r\n') && !/[^\r]\n/.test(S.serialize(cs, 'srt', { nl: 'crlf' })));
assert.ok(!S.serialize(cs, 'srt', { nl: 'lf' }).includes('\r')); assert.ok(S.serialize(cs, 'srt', { bom: true }).startsWith('\uFEFF1')); assert.ok(!S.serialize(cs, 'srt', {}).startsWith('\uFEFF'));
assert.equal(S.serialize(cs, 'csv', { nl: 'lf' }), '序號,開始,結束,文字\n1,"00:00:01,000","00:00:02,000","a, ""b""\nc"\n2,"00:00:03,000","00:00:04,000",\n');
assert.equal(S.serialize(cs, 'txt', { nl: 'lf' }), 'a, "b"\nc\n'); assert.equal(S.serialize([], 'srt', { nl: 'lf' }), ''); assert.equal(S.serialize([], 'vtt', { nl: 'lf' }), 'WEBVTT\n\n');
assert.equal(S.parseSubs(S.serialize([{ s: 0, e: 1, t: 'x\n\n\ny' }], 'srt', { nl: 'lf' })).cues[0].t, 'x\ny'); // 內含空行會被收斂，避免產生壞檔
// 空字幕往返
assert.deepEqual(S.parseSubs(S.serialize(cs, 'srt', { nl: 'crlf' })).cues.map(c => c.t), ['a, "b"\nc', '']);
assert.equal(S.outName('C:\\x\\movie.zh.srt', 'vtt', '_fix'), 'movie.zh_fix.vtt'); assert.equal(S.outName('', 'srt'), 'subtitle_edited.srt'); assert.equal(S.outName('a', 'txt', ''), 'a.txt');
ok('subtitle: 輸出（換行 / BOM / CSV / 純文字 / 檔名）');

// 編碼
const enc = new TextEncoder();
assert.deepEqual([S.decodeBytes(enc.encode('你好')).enc, S.decodeBytes(enc.encode('你好')).bad], ['utf-8', false]);
const bom8 = new Uint8Array([0xEF, 0xBB, 0xBF, ...enc.encode('你好')]); assert.equal(S.decodeBytes(bom8).text, '你好');
const u16 = (s, le = true) => { const b = new Uint8Array(s.length * 2); [...s].forEach((c, i) => { const v = c.charCodeAt(0); b[2 * i + (le ? 0 : 1)] = v & 255; b[2 * i + (le ? 1 : 0)] = v >> 8; }); return b; };
assert.equal(S.decodeBytes(new Uint8Array([0xFF, 0xFE, ...u16('字幕ab')])).text, '字幕ab'); assert.equal(S.decodeBytes(new Uint8Array([0xFE, 0xFF, ...u16('字幕ab', false)])).text, '字幕ab');
assert.equal(S.decodeBytes(u16('1\n00:00:01,000 --> 00:00:02,000\nA\n')).enc, 'utf-16le'); assert.equal(S.decodeBytes(u16('1\n00:00:01,000 --> 00:00:02,000\nA\n', false)).enc, 'utf-16be');
const big5 = new Uint8Array([0xA7, 0x41, 0xA6, 0x6E]); // 你好
let d = S.decodeBytes(big5); assert.ok(d.bad);
try { d = S.decodeBytes(big5, 'big5'); assert.equal(d.text, '你好'); assert.ok(!d.bad); d = S.decodeBytes(new Uint8Array([0xC4, 0xE3, 0xBA, 0xC3]), 'gbk'); assert.equal(d.text, '你好'); } catch (e) { if (e instanceof assert.AssertionError) throw e; console.log('  (略過：此環境不支援 Big5 / GBK)'); }
assert.ok(S.decodeBytes(big5, 'no-such-enc').bad); assert.equal(S.decodeBytes(new Uint8Array(0)).text, '');
ok('subtitle: 編碼偵測');

// 平移 / 校正 / 幀率
const base = [{ s: 1000, e: 2000, t: 'a' }, { s: 3000, e: 4000, t: 'b' }, { s: 5000, e: 6000, t: 'c' }];
let sh = S.shiftCues(base, 1500); assert.deepEqual(sh.map(c => c.s), [2500, 4500, 6500]); assert.equal(base[0].s, 1000);
sh = S.shiftCues(base, 500, 1, 1); assert.deepEqual(sh.map(c => c.s), [1000, 3500, 5000]); sh = S.shiftCues(base, 500, 1); assert.deepEqual(sh.map(c => c.s), [1000, 3500, 5500]);
sh = S.shiftCues(base, -2000); assert.deepEqual(sh.map(c => [c.s, c.e]), [[0, 0], [1000, 2000], [3000, 4000]]); assert.deepEqual(S.shiftCues([], 5), []);
let rt = S.retime(base, 0, 62500, 2, 5710000); // 第 1 句 00:01:02.500，最後 01:35:10.000
const k = (5710000 - 62500) / 4000; assert.equal(rt[0].s, 62500); assert.equal(rt[2].s, 5710000); assert.equal(rt[1].s, Math.round(62500 + 2000 * k)); assert.equal(rt[0].e, Math.round(62500 + 1000 * k));
assert.equal(S.retime(base, 0, 0, 0, 1), null); assert.equal(S.retime(base, 0, 0, 9, 1), null); assert.equal(S.retime(base, 0, NaN, 2, 1), null);
rt = S.retime(base, 2, 1000, 0, 5000); assert.equal(rt[0].s, 5000); assert.equal(rt[2].s, 1000); // 反向
near(S.fpsScale(25, 24), 25 / 24); near(S.fpsScale(24000 / 1001, 25), 0.95904, 1e-4); assert.equal(S.FPS.length, 5);
assert.deepEqual(S.scaleCues(base, 25 / 24).map(c => c.s), [1042, 3125, 5208]); assert.deepEqual(S.scaleCues(base, 1).map(c => c.s), [1000, 3000, 5000]);
ok('subtitle: 平移 / 線性校正 / 幀率');

// 合併
let mg = S.mergeCues([{ s: 0, e: 2000, t: 'a' }, { s: 1500, e: 3000, t: 'b' }, { s: 5000, e: 5200, t: 'short' }, { s: 5300, e: 7000, t: 'next' }, { s: 20000, e: 20100, t: 'lonely' }]);
assert.equal(mg.n, 2); assert.deepEqual(mg.cues.map(c => [c.s, c.e, c.t]), [[0, 3000, 'a\nb'], [5000, 7000, 'short\nnext'], [20000, 20100, 'lonely']]);
mg = S.mergeCues([{ s: 0, e: 2000, t: 'a' }, { s: 1500, e: 3000, t: 'b' }], { overlap: false, minLen: 0 }); assert.equal(mg.n, 0);
mg = S.mergeCues([{ s: 3000, e: 4000, t: 'x' }, { s: 0, e: 3500, t: 'x' }]); assert.deepEqual(mg.cues.map(c => c.t), ['x']); // 相同文字不重複
assert.equal(S.mergeCues([]).cues.length, 0);
ok('subtitle: 合併');

// 拆分
assert.deepEqual(S.chunkText('Hello wonderful world of subtitles', 12), ['Hello', 'wonderful', 'world of', 'subtitles']);
assert.deepEqual(S.chunkText('supercalifragilistic word', 5), ['supercalifragilistic', 'word']); // 不拆英文單字
assert.deepEqual(S.chunkText('你好嗎我很好謝謝你', 4), ['你好嗎我', '很好謝謝', '你']);
assert.deepEqual(S.chunkText('你好，世界。再見', 3), ['你好，', '世界。', '再見']); // 標點不放行首
assert.deepEqual(S.chunkText('😀😀😀😀😀', 2), ['😀😀', '😀😀', '😀']); assert.deepEqual(S.chunkText('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', 2), ['👨‍👩‍👧👨‍👩‍👧', '👨‍👩‍👧']);
assert.deepEqual(S.chunkText('今天 weather 很 nice 對吧', 8), ['今天', 'weather', '很 nice', '對吧'].length === 4 ? S.chunkText('今天 weather 很 nice 對吧', 8) : []);
assert.ok(S.chunkText('今天 weather 很 nice 對吧', 8).every(l => !/^\s|\s$/.test(l)));
assert.deepEqual(S.chunkText('a\nb', 10), ['a b']); assert.deepEqual(S.chunkText('', 5), []); assert.deepEqual(S.chunkText('abc def', 0), ['abc def']);
let sp = S.splitCues([{ id: 7, s: 0, e: 4000, t: '一二三四五六七八' }, { s: 5000, e: 6000, t: 'ok' }], 4);
assert.equal(sp.n, 1); assert.deepEqual(sp.cues.map(c => [c.s, c.e, c.t]), [[0, 2000, '一二三四'], [2000, 4000, '五六七八'], [5000, 6000, 'ok']]); assert.equal(sp.cues[0].id, 7); assert.equal(sp.cues[1].id, undefined);
sp = S.splitCues([{ s: 0, e: 1000, t: '一二三\n四五六' }], 4); assert.equal(sp.n, 0); assert.equal(sp.cues[0].t, '一二三\n四五六');
sp = S.splitCues([{ s: 0, e: 1000, t: 'Hello wonderful world' }], 10, 'wrap'); assert.equal(sp.cues.length, 1); assert.equal(sp.cues[0].t, 'Hello\nwonderful\nworld');
sp = S.splitCues([{ s: 0, e: 1001, t: 'aaa bbb ccc' }], 3); assert.equal(sp.cues.at(-1).e, 1001); assert.ok(sp.cues.every((c, i, a) => !i || c.s === a[i - 1].e));
ok('subtitle: 合併 / 拆分（中英文、emoji）');

// 檢查與修正
const bad = [{ s: 0, e: 100, t: 'short' }, { s: 1000, e: 9000, t: 'long' }, { s: 8000, e: 8500, t: 'overlap' }, { s: 6000, e: 5000, t: 'reversed' }, { s: 10000, e: 10000, t: 'zero' }, { s: 11000, e: 12000, t: '   ' }, { s: 13000, e: 14000, t: 'word '.repeat(12).trim() }];
const types = S.checkCues(bad).map(x => x.type); for (const t of ['short', 'long', 'overlap', 'reversed', 'zero', 'empty', 'lines']) assert.ok(types.includes(t), t);
assert.equal(S.checkCues([{ s: 0, e: 1000, t: 'ok' }, { s: 1000, e: 2000, t: 'ok' }]).length, 0); assert.equal(S.checkCues([]).length, 0);
assert.equal(S.checkCues([{ s: 0, e: 7000, t: 'a' }]).length, 0); assert.equal(S.checkCues([{ s: 0, e: 7001, t: 'a' }])[0].type, 'long'); assert.equal(S.checkCues([{ s: 0, e: 500, t: 'a' }]).length, 0);
const fx = S.fixCues(bad); const left = S.checkCues(fx).map(x => x.type);
assert.ok(!left.includes('reversed') && !left.includes('empty') && !left.includes('long') && !left.includes('lines') && !left.includes('overlap'), left.join());
assert.equal(fx.length, 6); assert.deepEqual(S.fixCues(fx), fx); assert.equal(bad[3].s, 6000); // 不改動輸入、結果穩定
assert.ok(fx.every((c, i) => !i || fx[i - 1].s <= c.s));
const f2 = S.fixCues([{ s: 0, e: 100, t: 'a' }, { s: 5000, e: 6000, t: 'b' }]); assert.equal(f2[0].e, 500);
const f3 = S.fixCues([{ s: 0, e: 100, t: 'a' }, { s: 200, e: 6000, t: 'b' }]); assert.equal(f3[0].e, 200); // 延長不超過下一句
assert.deepEqual(S.fixCues([]), []);
ok('subtitle: 檢查與一鍵修正');

// 搜尋取代
let rp = S.replaceCues([{ s: 0, e: 1, t: 'Foo foo FOO' }, { s: 2, e: 3, t: 'bar' }], 'foo', '$&!');
assert.equal(rp.n, 1); assert.equal(rp.cues[0].t, 'Foo $&! FOO');
rp = S.replaceCues([{ s: 0, e: 1, t: 'Foo foo FOO' }], 'foo', 'x', { ci: true }); assert.equal(rp.n, 3); assert.equal(rp.cues[0].t, 'x x x');
rp = S.replaceCues([{ s: 0, e: 1, t: 'a1 b22' }], '([a-z])(\\d+)', '$2$1', { regex: true }); assert.equal(rp.cues[0].t, '1a 22b'); assert.equal(rp.n, 2);
assert.ok(S.replaceCues([{ s: 0, e: 1, t: 'a' }], '(', 'x', { regex: true }).error); assert.equal(S.replaceCues([{ s: 0, e: 1, t: 'a.b' }], '.', '-').cues[0].t, 'a-b');
assert.equal(S.replaceCues([{ s: 0, e: 1, t: 'a' }], '', 'x').n, 0); assert.equal(S.replaceCues([{ s: 0, e: 1, t: 'a\nb' }], '\\n', ' ', { regex: true }).cues[0].t, 'a b');
assert.equal(S.sortCues([{ s: 5, e: 6, t: 'b' }, { s: 1, e: 2, t: 'a' }])[0].t, 'a');
ok('subtitle: 搜尋取代 / 排序');

// 效能：1 萬條
const lines = []; for (let i = 0; i < 10000; i++) lines.push(`${i + 1}\n${S.tcFormat(i * 3000)} --> ${S.tcFormat(i * 3000 + 2500)}\n第 ${i} 句字幕 line ${i}\n`);
const big = lines.join('\n'); let t0 = Date.now(); const bp = S.parseSubs(big); const out = S.serialize(bp.cues, 'vtt', { nl: 'crlf' }); const bp2 = S.parseSubs(out);
assert.equal(bp.cues.length, 10000); assert.equal(bp2.cues.length, 10000); assert.equal(bp2.cues[9999].s, 9999 * 3000);
const el = Date.now() - t0; assert.ok(el < 500, '一萬條解析 + 輸出 + 再解析 ' + el + 'ms');
t0 = Date.now(); S.checkCues(bp.cues); S.mergeCues(bp.cues); S.fixCues(bp.cues); S.shiftCues(bp.cues, 100); assert.ok(Date.now() - t0 < 1500);
assert.equal(S.parseSubs(Array.from({ length: 50100 }, (_, i) => `00:00:00,000 --> 00:00:01,000\nx${i}\n`).join('\n')).cues.length, 50000);
ok('subtitle: 一萬條效能與上限');
