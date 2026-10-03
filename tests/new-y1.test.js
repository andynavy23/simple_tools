// y1 批次：utils/qr-scan.html（QR 解碼器 / 結果分類 / 歷史）與 utils/voice-memo.html（備忘清單 / 搜尋 / 匯出 / 辨識結果合併）
const { load, ok } = require('./_load');
const assert = require('assert');

const { encode } = load('utils/qr-code.html', 'encode');
const S = load('utils/qr-scan.html', 'decodeQR, decodeMatrix, rsCorrect, qrParseData, parseWifi, classify, cleanHistory, addHistory, cameraErrorMsg, pickFormats, binarize');
const V = load('utils/voice-memo.html', 'cleanMemos, addMemo, searchMemos, memosToText, mergeResults, recognitionError, cleanLang, MEMO_MAX');

// ---------- 測試影像：把 QR 矩陣渲染成 RGBA ----------
let seed = 12345;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
// scale：每格像素；quiet：邊界格數；angleDeg：旋轉；noise：灰階雜訊幅度；invert：白碼黑底
function render(qr, { scale = 4, quiet = 4, angleDeg = 0, noise = 0, invert = false, pad = 0 } = {}) {
    const n = qr.size + quiet * 2, side = Math.ceil(n * scale * (angleDeg ? 1.5 : 1)) + pad * 2;
    const data = new Uint8ClampedArray(side * side * 4), c = side / 2, a = angleDeg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const dx = x - c, dy = y - c, sx = (dx * cos + dy * sin) / scale + n / 2, sy = (-dx * sin + dy * cos) / scale + n / 2;
        const mx = Math.floor(sx) - quiet, my = Math.floor(sy) - quiet;
        let dark = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
        if (invert) dark = !dark;
        let v = dark ? 20 : 240;
        if (noise) v = Math.max(0, Math.min(255, v + (rand() - 0.5) * 2 * noise));
        const i = (y * side + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    return { data, w: side, h: side };
}
const roundtrip = (text, ecc, opt) => { const im = render(encode(text, ecc), opt); return S.decodeQR(im.data, im.w, im.h); };

// ---------- RS 糾錯 ----------
{
    const full = [32, 65, 205, 69, 41, 220, 46, 128, 236, 42, 159, 74, 221, 244, 169, 239, 150, 138, 70, 237, 85, 224, 96, 74, 219, 61]; // ISO 1-H 範例（01234567）：9 資料 + 17 糾錯碼字
    assert.deepStrictEqual(S.rsCorrect(full, 17), full);
    const bad = full.slice(); bad[0] ^= 0x55; bad[7] ^= 0x13; bad[20] ^= 0xFF; bad[25] ^= 1; bad[12] ^= 0x80;
    assert.deepStrictEqual(S.rsCorrect(bad, 17), full, '5 個錯誤可修');
    const worse = full.slice(); for (let i = 0; i < 6; i++) worse[i * 3] ^= 0x21;
    assert.doesNotThrow(() => S.rsCorrect(worse.map((v, i) => i < 17 ? v ^ (i * 7 + 1) : v), 17)); // 超出能力：不得丟錯
    ok('qr-scan: Reed-Solomon corrects up to ne/2 errors, no throw beyond');
}

// ---------- 資料模式解析（手工位元流） ----------
{
    const pack = (parts) => { const bits = []; for (const [v, n] of parts) for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); while (bits.length % 8) bits.push(0); const o = []; for (let i = 0; i < bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8).join(''), 2)); return o; };
    // 數字 "01234567" 版本 1：0001, count 8 (10b), 012=12(10b), 345=345(10b), 67=67(7b)
    assert.strictEqual(S.qrParseData(pack([[1, 4], [8, 10], [12, 10], [345, 10], [67, 7], [0, 4]]), 1), '01234567');
    // 數字剩 1 位："12345" → 123, 45(7b)  ; "1234" → 123, 4(4b)
    assert.strictEqual(S.qrParseData(pack([[1, 4], [4, 10], [123, 10], [4, 4], [0, 4]]), 1), '1234');
    // 英數 "AC-42"：AC=10*45+12=462, -4=41*45+4=1849, 2=2(6b)
    assert.strictEqual(S.qrParseData(pack([[2, 4], [5, 9], [462, 11], [1849, 11], [2, 6], [0, 4]]), 1), 'AC-42');
    // 位元組 UTF-8「你好」= E4 BD A0 E5 A5 BD
    assert.strictEqual(S.qrParseData(pack([[4, 4], [6, 8], [0xE4, 8], [0xBD, 8], [0xA0, 8], [0xE5, 8], [0xA5, 8], [0xBD, 8], [0, 4]]), 5), '你好');
    // 版本 10 的計數位元較長：數字 12 位、位元組 16 位
    assert.strictEqual(S.qrParseData(pack([[1, 4], [3, 12], [999, 10], [0, 4]]), 10), '999');
    assert.strictEqual(S.qrParseData(pack([[4, 4], [2, 16], [72, 8], [105, 8], [0, 4]]), 10), 'Hi');
    // 多段混合
    assert.strictEqual(S.qrParseData(pack([[1, 4], [3, 10], [123, 10], [2, 4], [2, 9], [462, 11], [0, 4]]), 1), '123AC');
    // 壞資料：數字 >999、漢字模式、位元不足
    assert.throws(() => S.qrParseData(pack([[1, 4], [3, 10], [1000, 10]]), 1));
    assert.throws(() => S.qrParseData(pack([[8, 4], [1, 8], [0, 13]]), 1));
    assert.throws(() => S.qrParseData(pack([[4, 4], [200, 8]]), 1));
    ok('qr-scan: numeric / alphanumeric / byte(UTF-8) / mixed segments, v10 count bits, bad data throws');
}

// ---------- 正立清晰影像來回測試：版本 × 容錯 ----------
{
    const lens = [5, 20, 30, 60, 100, 140, 180, 220]; // 約對應版本 1..10（H 級會升版本）
    const seen = new Set();
    for (const ecc of ['L', 'M', 'Q', 'H']) for (const n of lens) {
        const text = Array.from({ length: n }, (_, i) => String.fromCharCode(33 + ((i * 7 + n) % 90))).join('');
        const qr = encode(text, ecc);
        if (qr.version > 10) continue;
        seen.add(qr.version);
        assert.strictEqual(roundtrip(text, ecc, { scale: 5 }), text, `v${qr.version} ${ecc}`);
    }
    for (let v = 1; v <= 10; v++) assert.ok(seen.has(v), '版本 ' + v + ' 有測到');
    ok('qr-scan: decodes versions 1-10 x ECC L/M/Q/H (' + [...seen].sort((a, b) => a - b).join(',') + ')');
}

// ---------- 縮放、邊界、雜訊 ----------
{
    const text = 'https://example.com/a?b=1&c=你好';
    for (const scale of [2, 3, 4, 7, 12]) assert.strictEqual(roundtrip(text, 'M', { scale }), text, 'scale ' + scale);
    for (const quiet of [1, 2, 4, 10]) assert.strictEqual(roundtrip(text, 'M', { scale: 4, quiet }), text, 'quiet ' + quiet);
    assert.strictEqual(roundtrip(text, 'M', { scale: 4, pad: 30 }), text, '大片留白');
    for (const noise of [30, 60]) assert.strictEqual(roundtrip(text, 'M', { scale: 5, noise }), text, 'noise ' + noise);
    // 純數字、單字元
    assert.strictEqual(roundtrip('1234567890123', 'L', { scale: 4 }), '1234567890123');
    assert.strictEqual(roundtrip('A', 'H', { scale: 6 }), 'A');
    ok('qr-scan: scale 2-12x, quiet zone 1-10, padding, noise');
}

// ---------- 輕微旋轉、反相 ----------
{
    const text = 'WIFI:T:WPA;S:Home;P:12345678;;';
    for (const angle of [-8, -3, 3, 6, 10]) assert.strictEqual(roundtrip(text, 'M', { scale: 6, angleDeg: angle }), text, 'angle ' + angle);
    assert.strictEqual(roundtrip(text, 'M', { scale: 5, invert: true }), text, '反相');
    // 長一點的 v8 + 旋轉
    const long = 'x'.repeat(120) + '終';
    assert.strictEqual(roundtrip(long, 'M', { scale: 6, angleDeg: 4 }), long, 'v8 旋轉');
    ok('qr-scan: slight rotation (-8..10 deg) and inverted colours');
}

// ---------- 糾錯實戰與失敗不爆 ----------
{
    const text = 'error correction works: 0123456789';
    const qr = encode(text, 'Q');
    const m2 = qr.modules.map(r => r.slice());
    // 在資料區（避開功能圖樣）毀掉一小塊
    for (let y = qr.size - 9; y < qr.size - 5; y++) for (let x = qr.size - 5; x < qr.size - 1; x++) m2[y][x] = !m2[y][x];
    assert.strictEqual(S.decodeMatrix(m2, qr.size, qr.version), text);
    // 毀太多 → null
    const m3 = qr.modules.map((r, y) => r.map((v, x) => (x > 8 && y > 8 && (x + y) % 2 === 0) ? !v : v));
    assert.strictEqual(S.decodeMatrix(m3, qr.size, qr.version), null);
    // 空白 / 隨機雜訊 / 太小的影像
    const blank = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    assert.strictEqual(S.decodeQR(blank, 100, 100), null);
    const noiseImg = new Uint8ClampedArray(120 * 120 * 4); for (let i = 0; i < noiseImg.length; i++) noiseImg[i] = i % 4 === 3 ? 255 : rand() * 255;
    assert.strictEqual(S.decodeQR(noiseImg, 120, 120), null);
    assert.strictEqual(S.decodeQR(new Uint8ClampedArray(16), 2, 2), null);
    assert.strictEqual(S.decodeMatrix([], 0, 0), null);
    ok('qr-scan: corrects damaged modules, returns null (no throw) for blank / noise / too-damaged');
}

// ---------- 分類 / Wi-Fi / 歷史 / 錯誤訊息 / 格式 ----------
{
    assert.deepStrictEqual(S.parseWifi('WIFI:T:WPA;S:Home;P:12345678;;'), { ssid: 'Home', pass: '12345678', type: 'WPA', hidden: false });
    assert.deepStrictEqual(S.parseWifi('WIFI:S:a\\;b;P:p\\:q;H:true;;'), { ssid: 'a;b', pass: 'p:q', type: 'nopass', hidden: true });
    assert.strictEqual(S.parseWifi('hello'), null);
    assert.strictEqual(S.parseWifi('WIFI:T:WPA;P:x;;'), null);
    const t = (x, f) => S.classify(x, f).type;
    assert.strictEqual(t('https://example.com/x'), 'url');
    assert.strictEqual(S.classify('http://a.b/c').host, 'a.b');
    assert.strictEqual(t('WIFI:T:WPA;S:Home;P:1;;'), 'wifi');
    assert.strictEqual(t('tel:+886912345678'), 'phone');
    assert.strictEqual(t('mailto:a@b.com'), 'email');
    assert.strictEqual(t('a@b.com'), 'email');
    assert.strictEqual(t('SMSTO:0912:hi'), 'sms');
    assert.strictEqual(t('geo:25.03,121.56'), 'geo');
    assert.strictEqual(t('BEGIN:VCARD\nVERSION:3.0'), 'vcard');
    assert.strictEqual(t('4710088430016', 'ean_13'), 'product');
    assert.strictEqual(t('ftp://x/y'), 'link');
    assert.strictEqual(t('javascript:alert(1)'), 'text', 'javascript: 不當作可開啟的連結');
    assert.strictEqual(t('hello world'), 'text');
    ok('qr-scan: classify / parseWifi (escapes, hidden, missing SSID)');

    assert.deepStrictEqual(S.cleanHistory('x'), []);
    assert.deepStrictEqual(S.cleanHistory([null, { text: '', t: 1 }, { text: 'a', t: 'x' }, { text: 'ok', t: 5 }]), [{ t: 5, text: 'ok', format: 'qr_code' }]);
    let h = [];
    for (let i = 0; i < 60; i++) h = S.addHistory(h, { t: i, text: 't' + i, format: 'qr_code' });
    assert.strictEqual(h.length, 50); assert.strictEqual(h[0].text, 't59');
    h = S.addHistory(h, { t: 99, text: 't30' }); assert.strictEqual(h.length, 50); assert.strictEqual(h[0].text, 't30'); assert.strictEqual(h.filter(r => r.text === 't30').length, 1);
    assert.strictEqual(S.addHistory(h, { t: 1, text: '' }), h);
    assert.strictEqual(S.cleanHistory(Array.from({ length: 80 }, (_, i) => ({ t: i, text: 'a' + i }))).length, 50);
    ok('qr-scan: history cap 50, dedupe, bad data tolerated');

    assert.ok(S.cameraErrorMsg('NotAllowedError').includes('權限'));
    assert.ok(S.cameraErrorMsg('NotFoundError').includes('找不到相機'));
    assert.ok(S.cameraErrorMsg('NotReadableError').includes('占用'));
    assert.ok(S.cameraErrorMsg(null, false, false).includes('HTTPS'));
    assert.ok(S.cameraErrorMsg(null, false, true).includes('不支援'));
    assert.ok(S.cameraErrorMsg('Whatever').includes('選擇圖片'));
    assert.deepStrictEqual(S.pickFormats(['code_128', 'foo', 'qr_code', 'ean_13']), ['qr_code', 'ean_13', 'code_128']);
    assert.deepStrictEqual(S.pickFormats(undefined), []);
    ok('qr-scan: camera error messages / format picking');
}

// ---------- voice-memo ----------
{
    assert.deepStrictEqual(V.cleanMemos('x'), []);
    const c = V.cleanMemos([null, { text: '  ', t: 1 }, { text: 'a', t: 'x' }, { id: 'k', text: ' hello ', t: 5 }, { text: 'no id', t: 6 }]);
    assert.strictEqual(c.length, 2); assert.strictEqual(c[0].text, 'hello'); assert.strictEqual(c[0].id, 'k'); assert.ok(c[1].id);
    assert.strictEqual(V.cleanMemos(Array.from({ length: 300 }, (_, i) => ({ text: 'm' + i, t: i }))).length, 200);
    let l = [];
    for (let i = 0; i < 205; i++) l = V.addMemo(l, 'm' + i, i);
    assert.strictEqual(l.length, V.MEMO_MAX); assert.strictEqual(l[0].text, 'm204'); assert.strictEqual(l[199].text, 'm5');
    assert.strictEqual(V.addMemo(l, '   ', 1), l);
    assert.strictEqual(new Set(l.map(x => x.id)).size, 200, 'id 不重複');
    ok('voice-memo: clean / add (cap 200, newest first, empty ignored)');

    const items = [{ id: 'a', t: 1, text: 'Buy Milk tomorrow' }, { id: 'b', t: 2, text: '明天開會 九點' }, { id: 'c', t: 3, text: 'call mom' }];
    assert.deepStrictEqual(V.searchMemos(items, 'milk').map(x => x.id), ['a']);
    assert.deepStrictEqual(V.searchMemos(items, '開會').map(x => x.id), ['b']);
    assert.deepStrictEqual(V.searchMemos(items, 'call  MOM').map(x => x.id), ['c']);
    assert.deepStrictEqual(V.searchMemos(items, 'milk mom'), []);
    assert.strictEqual(V.searchMemos(items, '  ').length, 3);
    const t0 = new Date(2024, 0, 2, 3, 4).getTime();
    assert.strictEqual(V.memosToText([{ id: 'x', t: t0, text: '第一行\n第二行' }, { id: 'y', t: t0 + 60000, text: 'B' }]), '[2024-01-02 03:04] 第一行\n第二行\n\n[2024-01-02 03:05] B\n');
    assert.strictEqual(V.memosToText([]), '');
    ok('voice-memo: search (multi-term, case-insensitive) / export text');

    const R = (arr) => arr.map(([isFinal, transcript]) => ({ isFinal, transcript }));
    assert.deepStrictEqual(V.mergeResults(R([[true, '你好'], [true, '世界'], [false, '今天']]), 'zh-TW'), { final: '你好世界', interim: '今天' });
    assert.deepStrictEqual(V.mergeResults(R([[true, 'hello'], [true, ' world'], [false, ' now']]), 'en-US'), { final: 'hello world', interim: 'now' });
    assert.deepStrictEqual(V.mergeResults(R([[true, 'a'], [true, 'b']]), 'en-US'), { final: 'a b', interim: '' });
    assert.deepStrictEqual(V.mergeResults([], 'ja-JP'), { final: '', interim: '' });
    assert.deepStrictEqual(V.mergeResults(null, 'ja-JP'), { final: '', interim: '' });
    assert.strictEqual(V.cleanLang('ja-JP'), 'ja-JP'); assert.strictEqual(V.cleanLang('xx'), 'zh-TW');
    assert.ok(V.recognitionError('not-allowed').includes('麥克風'));
    assert.ok(V.recognitionError('no-speech').includes('沒有聽到'));
    assert.ok(V.recognitionError('network').includes('網路'));
    assert.ok(V.recognitionError('audio-capture').includes('找不到麥克風'));
    assert.strictEqual(V.recognitionError('aborted'), '');
    assert.ok(V.recognitionError('weird').includes('weird'));
    ok('voice-memo: merge recognition results / language / error messages');
}
