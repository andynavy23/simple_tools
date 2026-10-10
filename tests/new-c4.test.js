// 批次 c4：螢幕錄影（screen-share）、相機 / 麥克風（screen-test）、跨裝置傳檔（file-drop）純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');

// ---------- screen-share：錄影 ----------
{
    const m = load('utils/screen-share.html', 'REC_MIMES, MAX_REC_BYTES, MAX_REC_MS, pickRecMime, recFileName, fmtDur, fmtBytes, recLimit');
    assert.strictEqual(m.pickRecMime(() => true), 'video/webm;codecs=vp9,opus');
    assert.strictEqual(m.pickRecMime((t) => t === 'video/mp4'), 'video/mp4');
    assert.strictEqual(m.pickRecMime((t) => t === 'video/webm'), 'video/webm');
    assert.strictEqual(m.pickRecMime(() => false), '');
    assert.strictEqual(m.pickRecMime(() => { throw new Error('x'); }), '');
    assert.strictEqual(m.pickRecMime((t) => { if (t.includes('vp9')) throw new Error('x'); return t.includes('vp8'); }), 'video/webm;codecs=vp8,opus');
    assert.strictEqual(m.recFileName(new Date(2026, 0, 2, 3, 4, 5), 'video/webm;codecs=vp9,opus'), 'screen-rec-20260102-030405.webm');
    assert.strictEqual(m.recFileName(new Date(2026, 11, 31, 23, 59, 59), 'video/mp4'), 'screen-rec-20261231-235959.mp4');
    assert.strictEqual(m.recFileName(new Date(2026, 0, 1), ''), 'screen-rec-20260101-000000.webm');
    assert.strictEqual(m.recFileName(new Date(2026, 0, 1), undefined), 'screen-rec-20260101-000000.webm');
    assert.strictEqual(m.fmtDur(0), '00:00'); assert.strictEqual(m.fmtDur(59999), '00:59'); assert.strictEqual(m.fmtDur(61000), '01:01');
    assert.strictEqual(m.fmtDur(3600000), '1:00:00'); assert.strictEqual(m.fmtDur(3723000), '1:02:03');
    assert.strictEqual(m.fmtDur(-5), '00:00'); assert.strictEqual(m.fmtDur(NaN), '00:00'); assert.strictEqual(m.fmtDur(undefined), '00:00');
    assert.strictEqual(m.fmtBytes(0), '0 B'); assert.strictEqual(m.fmtBytes(1023), '1023 B'); assert.strictEqual(m.fmtBytes(1024), '1.0 KB');
    assert.strictEqual(m.fmtBytes(1536 * 1024), '1.5 MB'); assert.strictEqual(m.fmtBytes(1024 ** 3), '1.00 GB'); assert.strictEqual(m.fmtBytes(-1), '0 B'); assert.strictEqual(m.fmtBytes('x'), '0 B');
    assert.strictEqual(m.recLimit(0, 0), ''); assert.strictEqual(m.recLimit(m.MAX_REC_BYTES - 1, m.MAX_REC_MS - 1), '');
    assert.strictEqual(m.recLimit(m.MAX_REC_BYTES, 0), 'size'); assert.strictEqual(m.recLimit(0, m.MAX_REC_MS), 'time');
    assert.strictEqual(m.recLimit(m.MAX_REC_BYTES, m.MAX_REC_MS), 'size');
    assert.strictEqual(m.MAX_REC_BYTES, 1073741824); assert.strictEqual(m.MAX_REC_MS, 3600000);
    ok('screen-share rec: mime pick / file name / duration & size format / limits');
}

// ---------- screen-test：相機 / 麥克風 ----------
{
    const m = load('utils/screen-test.html', 'TABS, validTab, CAM_RES, camConstraints, micConstraints, deviceList, mediaErrMsg, camInfoText, levelDb, holdPeak, dbPct, fmtDb, pickAudioMime, shotName');
    // 分頁白名單（向下相容）
    for (const t of ['screen', 'kb', 'mouse', 'ppi', 'cam', 'mic']) assert.strictEqual(m.validTab(t), t);
    for (const bad of [null, undefined, '', 'x', 1, {}, [], '__proto__', 'toString']) assert.strictEqual(m.validTab(bad), 'screen');
    // constraints
    assert.deepStrictEqual(m.camConstraints({ deviceId: 'abc', w: 1280, h: 720 }), { video: { deviceId: { exact: 'abc' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    assert.deepStrictEqual(m.camConstraints({ facing: 'environment', w: 640, h: 480 }).video.facingMode, { ideal: 'environment' });
    assert.strictEqual(m.camConstraints({ deviceId: 'abc', facing: 'user' }).video.facingMode, undefined);
    assert.deepStrictEqual(m.camConstraints({ facing: 'bogus' }), { video: {}, audio: false });
    assert.deepStrictEqual(m.camConstraints(), { video: {}, audio: false });
    assert.deepStrictEqual(m.micConstraints({ deviceId: 'm1', echo: true, noise: false, agc: 1 }), { audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, deviceId: { exact: 'm1' } }, video: false });
    assert.deepStrictEqual(m.micConstraints(), { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    assert.strictEqual(m.CAM_RES[0][1], 320); assert.deepStrictEqual(m.CAM_RES[m.CAM_RES.length - 1].slice(1), [3840, 2160]);
    // 裝置清單
    const devs = [
        { kind: 'videoinput', deviceId: 'v1', label: 'HD Webcam ' }, { kind: 'videoinput', deviceId: 'v2', label: '' }, { kind: 'videoinput', deviceId: 'v1', label: 'dup' },
        { kind: 'audioinput', deviceId: 'a1', label: 'Mic' }, { kind: 'audiooutput', deviceId: 'o1', label: 'Spk' }, { kind: 'videoinput', deviceId: '', label: 'noid' },
        null, 'x', { kind: 'videoinput', deviceId: 5, label: 'bad' },
    ];
    assert.deepStrictEqual(m.deviceList(devs, 'videoinput', '相機'), [{ id: 'v1', label: 'HD Webcam', named: true }, { id: 'v2', label: '相機 2', named: false }]);
    assert.deepStrictEqual(m.deviceList(devs, 'audioinput', '麥克風'), [{ id: 'a1', label: 'Mic', named: true }]);
    assert.deepStrictEqual(m.deviceList(null, 'videoinput', 'x'), []); assert.deepStrictEqual(m.deviceList(undefined, 'audioinput', 'x'), []);
    // 錯誤訊息
    assert.ok(m.mediaErrMsg('NotAllowedError', 'cam').includes('權限被拒')); assert.ok(m.mediaErrMsg('NotAllowedError', 'mic').includes('麥克風'));
    assert.ok(m.mediaErrMsg('NotFoundError', 'cam').includes('找不到相機')); assert.ok(m.mediaErrMsg('NotReadableError', 'mic').includes('占用'));
    assert.ok(m.mediaErrMsg('OverconstrainedError', 'cam').includes('不支援')); assert.ok(m.mediaErrMsg('Insecure', 'cam').includes('https'));
    assert.ok(m.mediaErrMsg('Weird', 'cam').includes('Weird')); assert.ok(m.mediaErrMsg(undefined, 'mic').includes('未知'));
    // 相機資訊
    assert.strictEqual(m.camInfoText({ width: 1280, height: 720, frameRate: 29.97, facingMode: 'user' }), '1280×720 · 30 fps · 前鏡頭');
    assert.strictEqual(m.camInfoText({ facingMode: 'environment' }, 640, 480), '640×480 · 幀率未知 · 後鏡頭');
    assert.strictEqual(m.camInfoText(null), '解析度未知 · 幀率未知');
    // 音量
    assert.deepStrictEqual(m.levelDb([]), { rms: -100, peak: -100 }); assert.deepStrictEqual(m.levelDb(null), { rms: -100, peak: -100 });
    assert.deepStrictEqual(m.levelDb(new Float32Array(64)), { rms: -100, peak: -100 });
    const full = m.levelDb(new Float32Array(100).fill(1)); assert.strictEqual(full.rms, 0); assert.strictEqual(full.peak, 0);
    const half = new Float32Array(100).fill(0.5); assert.ok(Math.abs(m.levelDb(half).rms - -6.0206) < 1e-3);
    const sine = Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i / 4800 * 2 * Math.PI * 100)); const ls = m.levelDb(sine);
    assert.ok(Math.abs(ls.rms - -3.0103) < 0.01, String(ls.rms)); assert.ok(ls.peak > -0.01);
    assert.strictEqual(m.levelDb([NaN, 'a', undefined]).rms, -100); assert.strictEqual(m.levelDb([2]).peak, 0); assert.strictEqual(m.levelDb([1e-9]).rms, -100);
    // 峰值保持
    let h = m.holdPeak(null, -30, 0); assert.deepStrictEqual(h, { db: -30, t: 0 });
    h = m.holdPeak(h, -40, 500); assert.deepStrictEqual(h, { db: -30, t: 0 });          // 較小：保持
    h = m.holdPeak(h, -20, 600); assert.deepStrictEqual(h, { db: -20, t: 600 });         // 更大：更新
    h = m.holdPeak(h, -50, 600 + 1501); assert.deepStrictEqual(h, { db: -50, t: 2101 });  // 過期：落到目前值
    assert.strictEqual(m.dbPct(-60), 0); assert.strictEqual(m.dbPct(0), 100); assert.strictEqual(m.dbPct(-30), 50); assert.strictEqual(m.dbPct(-100), 0); assert.strictEqual(m.dbPct(5), 100);
    assert.strictEqual(m.fmtDb(-100), '-∞ dBFS'); assert.strictEqual(m.fmtDb(-12.345), '-12.3 dBFS');
    assert.strictEqual(m.pickAudioMime(() => true), 'audio/webm;codecs=opus'); assert.strictEqual(m.pickAudioMime((t) => t === 'audio/mp4'), 'audio/mp4'); assert.strictEqual(m.pickAudioMime(() => false), '');
    assert.strictEqual(m.shotName(new Date(2026, 4, 6, 7, 8, 9)), 'camera-20260506-070809.png');
    ok('screen-test cam/mic: tab whitelist / constraints / device list / error text / dBFS / peak hold');
}

// ---------- file-drop ----------
{
    const m = load('utils/file-drop.html', 'CHUNK, HIGH_WATER, LOW_WATER, MAX_FILE, MAX_TEXT, MAX_NAME, MAX_ACTIVE_RX, makeCode, parseRoom, peerIdOf, crc32, chunkCount, chunkLen, splitChunks, validateMsg, rxNew, rxChunk, rxDone, safeName, rateTick, etaSec, fmtBytes, fmtSpeed, fmtEta, needDrain, txNext, txLive, canAcceptOffer, diagnose');
    const bytes = (n, seed = 1) => { const u = new Uint8Array(n); let s = seed; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; u[i] = s >> 16; } return u; };
    // 房號
    let seed = 3; const r = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    for (let i = 0; i < 30; i++) assert.ok(m.parseRoom(m.makeCode(r)));
    assert.strictEqual(m.parseRoom('https://x.io/simple_tools/utils/file-drop.html#k7m2qx'), 'K7M2QX'); assert.strictEqual(m.parseRoom('stfd-K7M2QX'), 'K7M2QX');
    for (const b of ['', null, 'ABC', 'ABC0O1', 'stsh-K7M2QX x', 5, {}]) assert.strictEqual(m.parseRoom(b), '');
    assert.strictEqual(m.peerIdOf('ABC234'), 'stfd-ABC234');
    assert.strictEqual(m.CHUNK, 16384); assert.strictEqual(m.HIGH_WATER, 1048576); assert.strictEqual(m.LOW_WATER, 262144); assert.strictEqual(m.MAX_FILE, 500 * 1048576);

    // CRC32
    const enc = (s) => new TextEncoder().encode(s);
    assert.strictEqual(m.crc32(enc('123456789')), 0xCBF43926); assert.strictEqual(m.crc32(new Uint8Array(0)), 0); assert.strictEqual(m.crc32(enc('a')), 0xE8B7BE43);
    const big = bytes(100000, 7); let acc = 0; for (const p of m.splitChunks(big)) acc = m.crc32(p, acc);
    assert.strictEqual(acc, m.crc32(big));                                          // 逐塊累積 = 一次算完
    let acc2 = 0; for (const p of m.splitChunks(big, 777)) acc2 = m.crc32(p, acc2); assert.strictEqual(acc2, m.crc32(big));
    assert.notStrictEqual(m.crc32(bytes(100, 1)), m.crc32(bytes(100, 2)));
    const flip = big.slice(); flip[5000] ^= 1; assert.notStrictEqual(m.crc32(flip), m.crc32(big));

    // 分塊
    const C = m.CHUNK;
    assert.strictEqual(m.chunkCount(0), 0); assert.strictEqual(m.chunkCount(1), 1); assert.strictEqual(m.chunkCount(C), 1); assert.strictEqual(m.chunkCount(C + 1), 2); assert.strictEqual(m.chunkCount(3 * C), 3);
    assert.strictEqual(m.chunkCount(500 * 1048576), 32000); assert.strictEqual(m.chunkCount(2 * 1024 ** 3), 131072); assert.strictEqual(m.chunkCount(-1), 0); assert.strictEqual(m.chunkCount(1.5), 0); assert.strictEqual(m.chunkCount(NaN), 0);
    assert.strictEqual(m.chunkLen(0, 0), 0); assert.strictEqual(m.chunkLen(0, 5), 5); assert.strictEqual(m.chunkLen(0, C), C); assert.strictEqual(m.chunkLen(1, C), 0); assert.strictEqual(m.chunkLen(1, C + 1), 1); assert.strictEqual(m.chunkLen(-1, 10), 0); assert.strictEqual(m.chunkLen(0.5, 10), 0);
    for (const size of [0, 1, C - 1, C, C + 1, 5 * C, 5 * C + 3]) {
        const u = bytes(size, size + 1), parts = m.splitChunks(u); assert.strictEqual(parts.length, m.chunkCount(size));
        assert.strictEqual(parts.reduce((a, p) => a + p.length, 0), size); parts.forEach((p, i) => assert.strictEqual(p.length, m.chunkLen(i, size)));
    }

    // 訊息驗證
    const id = 'abc123def456';
    const okMsgs = [{ t: 'hi', v: 1 }, { t: 'full' }, { t: 'text', id, s: 'hello' }, { t: 'offer', id, name: 'a.txt', size: 0 }, { t: 'offer', id, name: 'a.txt', size: 2 ** 40 }, { t: 'accept', id }, { t: 'cancel', id }, { t: 'reject', id, why: 'busy' }, { t: 'reject', id, why: 'zzz' },
    { t: 'chunk', id, seq: 0, c: 1, d: new ArrayBuffer(10) }, { t: 'chunk', id, seq: 5, c: 0xFFFFFFFF, d: new Uint8Array(C) }, { t: 'done', id, n: 3, crc: 7 }, { t: 'result', id, ok: false }];
    for (const x of okMsgs) assert.ok(m.validateMsg(x), JSON.stringify(x));
    assert.strictEqual(m.validateMsg({ t: 'reject', id, why: 'zzz' }).why, 'other');
    assert.deepStrictEqual(m.validateMsg({ t: 'accept', id, evil: 'x', __proto__: { y: 1 } }), { t: 'accept', id });       // 只留已知欄位
    const c0 = m.validateMsg({ t: 'chunk', id, seq: 0, c: 1, d: new Uint8Array([1, 2, 3, 4]).subarray(1, 3) }); assert.deepStrictEqual([...c0.d], [2, 3]);
    const badMsgs = [null, undefined, 0, 'x', [], {}, { t: 5 }, { t: 'nope' }, { t: '__proto__' }, new ArrayBuffer(4), new Uint8Array(4),
    { t: 'hi' }, { t: 'hi', v: 0 }, { t: 'hi', v: '1' },
    { t: 'text', id, s: '' }, { t: 'text', id, s: 'x'.repeat(50001) }, { t: 'text', id: 'a', s: 'x' }, { t: 'text', id, s: 5 }, { t: 'text', s: 'x' }, { t: 'text', id: 'x'.repeat(30), s: 'x' }, { t: 'text', id: 'ab cd!', s: 'x' },
    { t: 'offer', id, name: '', size: 1 }, { t: 'offer', id, name: 'a', size: -1 }, { t: 'offer', id, name: 'a', size: 1.5 }, { t: 'offer', id, name: 'a', size: '5' }, { t: 'offer', id, name: 'a', size: Infinity }, { t: 'offer', id, name: 'a', size: 2 ** 60 }, { t: 'offer', id, name: 'x'.repeat(1001), size: 1 }, { t: 'offer', id, name: 5, size: 1 },
    { t: 'accept' }, { t: 'cancel', id: 5 },
    { t: 'chunk', id, seq: -1, c: 0, d: new ArrayBuffer(1) }, { t: 'chunk', id, seq: 1.5, c: 0, d: new ArrayBuffer(1) }, { t: 'chunk', id, seq: 0, c: -1, d: new ArrayBuffer(1) }, { t: 'chunk', id, seq: 0, c: 2 ** 32, d: new ArrayBuffer(1) },
    { t: 'chunk', id, seq: 0, c: 0, d: new ArrayBuffer(0) }, { t: 'chunk', id, seq: 0, c: 0, d: new ArrayBuffer(C + 1) }, { t: 'chunk', id, seq: 0, c: 0, d: 'string' }, { t: 'chunk', id, seq: 0, c: 0, d: [1, 2, 3] }, { t: 'chunk', id, seq: 0, c: 0 },
    { t: 'done', id, n: -1, crc: 0 }, { t: 'done', id, n: 1, crc: 2 ** 32 }, { t: 'done', id, n: 1 }, { t: 'result', id, ok: 'yes' }, { t: 'result', id }];
    for (const x of badMsgs) assert.strictEqual(m.validateMsg(x), null, JSON.stringify(x));

    // 接收端重組：正常 / 空檔案 / 剛好整塊
    const feed = (size, tweak) => {
        const u = bytes(size, size + 9), parts = m.splitChunks(u), st = m.rxNew(size); let crc = 0; const res = [];
        parts.forEach((p, i) => { const msg = { seq: i, c: m.crc32(p), d: p }; crc = m.crc32(p, crc); if (tweak) tweak(msg, i); res.push(m.rxChunk(st, msg)); });
        return { u, st, res, crc, n: parts.length };
    };
    for (const size of [0, 1, C - 1, C, C + 1, 3 * C, 3 * C + 5]) {
        const f = feed(size); assert.ok(f.res.every(x => x === ''), String(size)); assert.strictEqual(m.rxDone(f.st, { n: f.n, crc: f.crc }), '');
        const joined = new Uint8Array(f.st.got); let o = 0; for (const p of f.st.parts) { joined.set(p, o); o += p.length; } assert.deepStrictEqual(joined, f.u);
    }
    { const f = feed(3 * C); assert.strictEqual(m.rxChunk(f.st, { seq: 1, c: 0, d: new Uint8Array(C) }), 'dup'); assert.strictEqual(f.st.next, 3); }        // 重複
    { const st = m.rxNew(3 * C); assert.strictEqual(m.rxChunk(st, { seq: 1, c: 0, d: new Uint8Array(C) }), 'gap'); assert.strictEqual(st.next, 0); }          // 亂序 / 缺塊
    { const f = feed(2 * C); assert.strictEqual(m.rxChunk(f.st, { seq: 2, c: 0, d: new Uint8Array(1) }), 'size'); }                                         // 超量（多出的塊）
    { const f = feed(2 * C + 10, (msg, i) => { if (i === 2) msg.d = msg.d.slice(0, 5); }); assert.deepStrictEqual(f.res, ['', '', 'size']); }               // 偽造大小：最後一塊太短
    { const f = feed(2 * C, (msg, i) => { if (i === 0) msg.d = msg.d.slice(0, C - 1); }); assert.strictEqual(f.res[0], 'size'); }                          // 中間塊短
    { const st = m.rxNew(5); assert.strictEqual(m.rxChunk(st, { seq: 0, c: 0, d: new Uint8Array(6) }), 'size'); }                                           // 宣告 5 位元組卻送 6
    { const st = m.rxNew(0); assert.strictEqual(m.rxChunk(st, { seq: 0, c: 0, d: new Uint8Array(1) }), 'size'); }                                           // 空檔案卻收到資料
    { const f = feed(C, (msg) => { msg.d = msg.d.slice(); msg.d[0] ^= 1; }); assert.strictEqual(f.res[0], 'crc'); }                                         // 資料被改
    { const f = feed(2 * C); assert.strictEqual(m.rxDone(f.st, { n: 2, crc: f.crc ^ 1 }), 'crc'); }
    { const f = feed(2 * C); assert.strictEqual(m.rxDone(f.st, { n: 3, crc: f.crc }), 'incomplete'); }
    { const st = m.rxNew(2 * C); m.rxChunk(st, { seq: 0, c: m.crc32(bytes(C, 1)), d: bytes(C, 1) }); assert.strictEqual(m.rxDone(st, { n: 2, crc: 0 }), 'incomplete'); }
    { const f = feed(10); assert.strictEqual(m.rxDone(f.st, { n: f.n, crc: f.crc }), ''); assert.strictEqual(m.rxDone(f.st, { n: f.n, crc: f.crc }), 'state'); assert.strictEqual(m.rxChunk(f.st, { seq: 1, c: 0, d: new Uint8Array(1) }), 'state'); }
    assert.strictEqual(m.rxNew(500 * 1048576).n, 32000);

    // 檔名
    const S = m.safeName;
    assert.strictEqual(S('photo.jpg'), 'photo.jpg'); assert.strictEqual(S('報告 final.pdf'), '報告 final.pdf');
    assert.strictEqual(S('../../etc/passwd'), '.._.._etc_passwd'.replace(/^\.+/, '')); assert.strictEqual(S('a/b\\c.txt'), 'a_b_c.txt');
    assert.strictEqual(S('C:\\Windows\\x.exe'), 'C__Windows_x.exe'); assert.strictEqual(S('a\u0000b\u001fc\u007fd.txt'), 'abcd.txt');
    assert.strictEqual(S('a<b>c:d"e|f?g*h.txt'), 'a_b_c_d_e_f_g_h.txt'); assert.strictEqual(S('  name.txt  '), 'name.txt'); assert.strictEqual(S('name.txt...'), 'name.txt'); assert.strictEqual(S('..'), 'file'); assert.strictEqual(S('.'), 'file');
    assert.strictEqual(S(''), 'file'); assert.strictEqual(S(null), 'file'); assert.strictEqual(S(123), 'file'); assert.strictEqual(S('///'), '___'); assert.strictEqual(S('\u0000\u0001'), 'file'); assert.strictEqual(S('', 'x'), 'x');
    assert.strictEqual(S('con'), '_con'); assert.strictEqual(S('CON.txt'), '_CON.txt'); assert.strictEqual(S('nul.tar.gz'), '_nul.tar.gz'); assert.strictEqual(S('LPT1'), '_LPT1'); assert.strictEqual(S('com9.log'), '_com9.log'); assert.strictEqual(S('console.txt'), 'console.txt'); assert.strictEqual(S('com10.txt'), 'com10.txt');
    assert.strictEqual(S('abc\u202Egpj.exe'), 'abcgpj.exe');                                     // 雙向文字控制字元
    const long = S('x'.repeat(500) + '.png'); assert.strictEqual(Array.from(long).length, m.MAX_NAME); assert.ok(long.endsWith('.png'));
    assert.strictEqual(Array.from(S('字'.repeat(300))).length, m.MAX_NAME); assert.strictEqual(S('😀'.repeat(300)), '😀'.repeat(m.MAX_NAME));
    assert.ok(Array.from(S('a'.repeat(200) + '.' + 'e'.repeat(50))).length <= m.MAX_NAME);       // 超長副檔名
    assert.strictEqual(S('.bashrc'), 'bashrc'); assert.strictEqual(S('a.b.c'), 'a.b.c');
    for (const nm of ['x'.repeat(500), 'a'.repeat(119) + ' .txt', '/', '\\', 'a/', '\u0000/']) { const o = S(nm); assert.ok(o.length > 0 && !/[\\/:*?"<>|\u0000-\u001f]/.test(o) && Array.from(o).length <= m.MAX_NAME, nm); }

    // 速度與剩餘時間
    let rt = m.rateTick(null, 0, 1000); assert.deepStrictEqual(rt, { t: 1000, b: 0, rate: 0 });
    assert.strictEqual(m.rateTick(rt, 100, 1200), rt);                                           // 不到 500 ms：不更新
    rt = m.rateTick(rt, 1000000, 2000); assert.strictEqual(rt.rate, 1000000);
    rt = m.rateTick(rt, 3000000, 3000); assert.ok(Math.abs(rt.rate - (1000000 * 0.7 + 2000000 * 0.3)) < 1e-6);
    assert.strictEqual(m.rateTick({ t: 0, b: 500, rate: 0 }, 100, 1000).rate, 0);             // 倒退不產生負數
    assert.strictEqual(m.etaSec(1000, 100), 10); assert.strictEqual(m.etaSec(1001, 100), 11); assert.strictEqual(m.etaSec(0, 100), 0); assert.strictEqual(m.etaSec(5, 0), Infinity); assert.strictEqual(m.etaSec(-1, 5), Infinity);
    assert.strictEqual(m.fmtEta(Infinity), '—'); assert.strictEqual(m.fmtEta(5), '5 秒'); assert.strictEqual(m.fmtEta(75), '1 分 15 秒'); assert.strictEqual(m.fmtEta(3700), '1 小時 1 分'); assert.strictEqual(m.fmtEta(-1), '—');
    assert.strictEqual(m.fmtSpeed(0), '—'); assert.strictEqual(m.fmtSpeed(2.5 * 1048576), '2.5 MB/s'); assert.strictEqual(m.fmtBytes(500 * 1048576), '500.0 MB');
    // 背壓
    assert.strictEqual(m.needDrain(0), false); assert.strictEqual(m.needDrain(m.HIGH_WATER - 1), false); assert.strictEqual(m.needDrain(m.HIGH_WATER), true); assert.strictEqual(m.needDrain(10, 5), true);

    // 狀態機
    const T = m.txNext;
    assert.strictEqual(T('offered', 'accept'), 'active'); assert.strictEqual(T('offered', 'reject'), 'rejected'); assert.strictEqual(T('offered', 'cancel'), 'cancelled'); assert.strictEqual(T('offered', 'error'), 'failed');
    assert.strictEqual(T('active', 'finish'), 'verifying'); assert.strictEqual(T('active', 'ok'), 'done'); assert.strictEqual(T('active', 'bad'), 'failed'); assert.strictEqual(T('active', 'cancel'), 'cancelled');
    assert.strictEqual(T('verifying', 'ok'), 'done'); assert.strictEqual(T('verifying', 'bad'), 'failed'); assert.strictEqual(T('verifying', 'error'), 'failed');
    for (const term of ['done', 'failed', 'cancelled', 'rejected']) for (const ev of ['accept', 'reject', 'cancel', 'finish', 'ok', 'bad', 'error']) assert.strictEqual(T(term, ev), term);   // 終點不再變
    assert.strictEqual(T('offered', 'finish'), 'offered'); assert.strictEqual(T('offered', 'ok'), 'offered'); assert.strictEqual(T('active', 'accept'), 'active'); assert.strictEqual(T('nonsense', 'accept'), 'nonsense'); assert.strictEqual(T('offered', 'constructor'), 'offered'); assert.strictEqual(T('__proto__', 'x'), '__proto__');
    assert.ok(m.txLive('offered') && m.txLive('active') && m.txLive('verifying')); assert.ok(!m.txLive('done') && !m.txLive('failed') && !m.txLive('constructor'));

    // 接收上限
    const st0 = { active: 0, files: 0, total: 0 };
    assert.strictEqual(m.canAcceptOffer(st0, 0), ''); assert.strictEqual(m.canAcceptOffer(st0, m.MAX_FILE), ''); assert.strictEqual(m.canAcceptOffer(st0, m.MAX_FILE + 1), 'too-big');
    assert.strictEqual(m.canAcceptOffer({ active: m.MAX_ACTIVE_RX, files: 0, total: 0 }, 1), 'busy'); assert.strictEqual(m.canAcceptOffer({ active: 0, files: 30, total: 0 }, 1), 'full'); assert.strictEqual(m.canAcceptOffer({ active: 0, files: 0, total: 1024 ** 3 - 10 }, 11), 'full'); assert.strictEqual(m.canAcceptOffer({ active: 0, files: 0, total: 1024 ** 3 - 10 }, 10), '');
    assert.ok(m.diagnose('full').includes('1 對 1')); assert.ok(m.diagnose('host').includes('房主')); assert.ok(m.diagnose('zzz').length > 0);
    ok('file-drop: room code / CRC32 / chunking / message validation / reassembly (dup, gap, over, forged size, crc) / safe name / rate / state machine / limits');
}
