// 批次 z4：exif-viewer、audio-recorder、encoding-fixer、chmod-calc 純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- chmod-calc ----------
    const m = load('utils/chmod-calc.html', 'parseOctal, toOctal, toSym, fromSym, toLs, toSymbolic, risks, fromUmask, parseAny, applySym, cmds, PRESETS');
    // 與 ls -l 對照
    const table = [[0o755, 'rwxr-xr-x'], [0o644, 'rw-r--r--'], [0o600, 'rw-------'], [0o777, 'rwxrwxrwx'], [0, '---------'], [0o4755, 'rwsr-xr-x'], [0o4644, 'rwSr--r--'],
        [0o2775, 'rwxrwsr-x'], [0o2755, 'rwxr-sr-x'], [0o2745, 'rwxr-Sr-x'], [0o1777, 'rwxrwxrwt'], [0o1776, 'rwxrwxrwT'], [0o7777, 'rwsrwsrwt'], [0o7000, '--S--S--T']];
    for (const [n, s] of table) { assert.equal(m.toSym(n), s, s); assert.equal(m.fromSym(s), n, s); }
    assert.equal(m.toLs(0o755, true), 'drwxr-xr-x'); assert.equal(m.toLs(0o644, false), '-rw-r--r--');
    assert.equal(m.fromSym('drwxr-xr-x'), 0o755); assert.equal(m.fromSym('-rw-r--r--'), 0o644);
    // 位元全空間往返（符號 / 數字 / 符號模式）
    for (let n = 0; n <= 0o7777; n++) {
        assert.equal(m.fromSym(m.toSym(n)), n);
        assert.equal(m.parseOctal(m.toOctal(n)), n);
        assert.equal(m.applySym(0, m.toSymbolic(n)), n, m.toSymbolic(n));
    }
    // 數字格式
    assert.equal(m.toOctal(0o755), '755'); assert.equal(m.toOctal(0o4755), '4755'); assert.equal(m.toOctal(0o7), '007');
    for (const bad of ['', '75', '75555', '758', '7x5', 'abc', '-755', '7 5', '0x1ff']) assert.equal(m.parseOctal(bad), null, bad);
    assert.equal(m.parseOctal(' 0644 '), 0o644);
    // 不合法符號
    for (const bad of ['rwxr-xr-', 'rwxr-xr-xx', 'rwxrwxrwz', 'RWXR-XR-X', 'rwtr-xr-x', 'rwxr-xr-s', 'xwrxwrxwr', '']) assert.equal(m.fromSym(bad), null, bad);
    // 符號模式字串
    assert.equal(m.toSymbolic(0o755), 'u=rwx,go=rx');
    assert.equal(m.toSymbolic(0o777), 'a=rwx'); assert.equal(m.toSymbolic(0), 'a=');
    assert.equal(m.toSymbolic(0o4755), 'u=rwxs,go=rx'); assert.equal(m.toSymbolic(0o1777), 'ug=rwx,o=rwxt');

    // 符號模式套用
    const A = m.applySym;
    assert.equal(A(0o644, 'u+x,g-w'), 0o744);
    assert.equal(A(0o755, 'go-rx'), 0o700);
    assert.equal(A(0o644, 'a+x'), 0o755);
    assert.equal(A(0o644, 'a=rx'), 0o555);
    assert.equal(A(0o777, 'u=rw'), 0o677);
    assert.equal(A(0o777, 'go='), 0o700);
    assert.equal(A(0o640, 'g=u'), 0o660);
    assert.equal(A(0o740, 'o=g'), 0o744);
    assert.equal(A(0o644, 'u+x-r'), 0o344, '同一子句多個運算');
    assert.equal(A(0o600, 'u+x,g+r,o+r'), 0o744);
    assert.equal(A(0o644, 'chmod u+x'), 0o744, '容許開頭的 chmod');
    // 沒寫 who：依 umask 022 排除 g/o 的寫入
    assert.equal(A(0o644, '+w'), 0o644 | 0o200); assert.equal(A(0o644, '+w', false, 0), 0o666);
    assert.equal(A(0o644, '+x'), 0o755); assert.equal(A(0o644, '+x', false, 0o077), 0o744);
    assert.equal(A(0o666, '-w'), 0o466, '-w 沒寫 who 且 umask 022：只移除 u 的寫入');
    // X
    assert.equal(A(0o644, 'a+X'), 0o644, '檔案沒有任何執行位元 → X 不加');
    assert.equal(A(0o744, 'a+X'), 0o755, '檔案已有執行位元 → X 加到全部');
    assert.equal(A(0o644, 'a+X', true), 0o755, '目錄 → X 加執行');
    assert.equal(A(0o600, 'u=rwX', true), 0o700); assert.equal(A(0o600, 'u=rwX', false), 0o600);
    assert.equal(A(0o640, 'go+rX', true), 0o655, '目錄 go+rX');
    // 特殊位元
    assert.equal(A(0o755, 'u+s'), 0o4755); assert.equal(A(0o755, 'g+s'), 0o2755);
    assert.equal(A(0o755, 'a+s'), 0o6755, 'a+s 同時 setuid + setgid');
    assert.equal(A(0o755, 'o+t'), 0o1755); assert.equal(A(0o755, '+t'), 0o1755);
    assert.equal(A(0o755, 'u+t'), 0o755, 'u+t 沒有作用');
    assert.equal(A(0o755, 'o+s'), 0o755, 'o+s 沒有作用');
    assert.equal(A(0o4755, 'u-s'), 0o755); assert.equal(A(0o7777, 'a-st'), 0o0777);
    assert.equal(A(0o4755, 'u=rwx'), 0o755, '= 會清掉該類別的 setuid');
    assert.equal(A(0o6755, 'g=rx'), 0o4755, 'g= 清掉 setgid、保留 setuid');
    assert.equal(A(0o1777, 'a=rwx'), 0o777);
    assert.equal(A(0o755, 'u+rwxs,g+rxs'), 0o6755);
    // 非法輸入
    for (const bad of ['', '  ', 'u', 'u+', 'x', 'z+x', 'u+q', 'u+x,', ',u+x', 'u++x2', '755', 'u+x g-w', 'U+x', 'chmod'])
        if (bad !== 'u+') assert.equal(A(0o644, bad), null, JSON.stringify(bad));
    assert.equal(A(0o644, 'u+'), 0o644, 'u+ 後面沒有權限字母：合法、無作用');
    assert.equal(A(0o644, 'u='), 0o044, 'u= 清空擁有者');

    // umask
    let u = m.fromUmask('022'); assert.deepStrictEqual([u.file, u.dir], [0o644, 0o755]);
    u = m.fromUmask('002'); assert.deepStrictEqual([u.file, u.dir], [0o664, 0o775]);
    u = m.fromUmask('077'); assert.deepStrictEqual([u.file, u.dir], [0o600, 0o700]);
    u = m.fromUmask('000'); assert.deepStrictEqual([u.file, u.dir], [0o666, 0o777]);
    u = m.fromUmask('027'); assert.deepStrictEqual([u.file, u.dir], [0o640, 0o750]);
    u = m.fromUmask('0022'); assert.deepStrictEqual([u.file, u.dir], [0o644, 0o755]);
    u = m.fromUmask('777'); assert.deepStrictEqual([u.file, u.dir], [0, 0]);
    for (const bad of ['', '22', '088', '12345', 'abc']) assert.equal(m.fromUmask(bad), null, bad);

    // parseAny / 指令 / 提醒 / 速查
    assert.equal(m.parseAny('755'), 0o755); assert.equal(m.parseAny('rwxr-xr-x'), 0o755); assert.equal(m.parseAny('99'), null);
    const c = m.cmds(0o755).map(x => x[1]);
    assert.ok(c.includes('chmod 755 file') && c.includes('chmod -R 755 dir/') && c.includes('chmod u=rwx,go=rx file') && c.includes('find . -type f -exec chmod 755 {} +'));
    assert.ok(m.risks(0o777, false).length >= 1 && m.risks(0o644, false).length === 0);
    assert.ok(m.risks(0o4777, false).some(t => t.includes('風險很高')));
    assert.ok(m.risks(0o1777, true).some(t => t.includes('sticky')));
    assert.ok(m.risks(0o4644, false).some(t => t.includes('大寫 S')));
    assert.ok(m.risks(0, false).some(t => t.includes('沒有任何人')));
    for (const [n, , note] of m.PRESETS) assert.ok(note && n <= 0o7777);
    ok('chmod-calc: ls 對照 / 全空間往返 / 符號模式（X、s、t、= 清除）/ umask / 非法輸入');
}

{ // ---------- encoding-fixer ----------
    const m = load('utils/encoding-fixer.html', 'supportedEncs, bomOf, scoreText, decodeBytes, detectEncoding, finalText, previewLines, encodeWith, repairs, countBad');
    // 自製 iconv 風格對照：用 TextDecoder 掃描所有雙位元組組合產生編碼表（與頁面獨立實作一份，互相驗證）
    const tables = {};
    const enc = (label, s) => {
        if (label === 'utf-8') return Buffer.from(s, 'utf8');
        if (label === 'utf-16le') return Buffer.from(s, 'utf16le');
        if (label === 'utf-16be') return Buffer.from(s, 'utf16le').swap16();
        if (!tables[label]) {
            const d = new TextDecoder(label), t = new Map();
            for (let b = 0; b < 128; b++) t.set(String.fromCharCode(b), [b]);
            for (let a = 0x81; a <= 0xFE; a++) for (let c = 0x40; c <= 0xFE; c++) { const x = d.decode(Uint8Array.of(a, c)); if (x.length === 1 && x !== '�' && !t.has(x)) t.set(x, [a, c]); }
            tables[label] = t;
        }
        const out = []; for (const ch of s) { const b = tables[label].get(ch); assert.ok(b, `${label} 無法編碼 ${ch}`); out.push(...b); } return Buffer.from(out);
    };
    const u8 = (b) => new Uint8Array(b);

    assert.ok(m.supportedEncs().includes('utf-8') && m.supportedEncs().includes('big5'));
    assert.deepStrictEqual(m.supportedEncs(['utf-8', 'no-such-enc']), ['utf-8']);
    // BOM
    assert.deepStrictEqual(m.bomOf(u8([0xEF, 0xBB, 0xBF, 0x41])), { enc: 'utf-8', len: 3 });
    assert.deepStrictEqual(m.bomOf(u8([0xFF, 0xFE, 0x41, 0])), { enc: 'utf-16le', len: 2 });
    assert.deepStrictEqual(m.bomOf(u8([0xFE, 0xFF, 0, 0x41])), { enc: 'utf-16be', len: 2 });
    assert.equal(m.bomOf(u8([0x41, 0x42])), null); assert.equal(m.bomOf(u8([])), null);
    assert.equal(m.decodeBytes(u8([0xEF, 0xBB, 0xBF, 0x41]), 'utf-8').text, 'A', '去掉 BOM');
    assert.equal(m.decodeBytes(u8([0xFF, 0xFE, 0x41, 0]), 'utf-16le').text, 'A');
    // 評分
    assert.ok(m.scoreText('這是一段中文文字') > m.scoreText('é¸­æ–‡') && m.scoreText('這是中文') > m.scoreText('��中'));
    assert.equal(m.scoreText(''), 0);

    // 偵測
    const zh = '這是一段繁體中文的測試文字，用來確認偵測是否正確。我們今天要去看電影，然後一起吃飯。';
    const cn = '这是一段简体中文的测试文字，用来确认检测是否正确。我们今天要去看电影，然后一起吃饭。';
    const jp = 'これは日本語のテストです。漢字とひらがなとカタカナが混ざっています。今日は天気がいいですね。';
    const kr = '이것은 한국어 테스트입니다. 오늘은 날씨가 좋네요. 우리 같이 밥 먹으러 가요.';
    const det = (b) => m.detectEncoding(u8(b));
    assert.equal(det(enc('big5', zh)).enc, 'big5');
    assert.equal(det(enc('gbk', cn)).enc, 'gbk');
    assert.equal(det(enc('shift_jis', jp)).enc, 'shift_jis');
    assert.equal(det(enc('euc-kr', kr)).enc, 'euc-kr');
    assert.equal(det(enc('utf-8', zh)).enc, 'utf-8'); assert.ok(det(enc('utf-8', zh)).confidence >= 0.9);
    assert.equal(det(Buffer.from('café au lait, déjà vu', 'latin1')).enc, 'windows-1252');
    assert.equal(det(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), enc('utf-8', zh)])).confidence, 1);
    assert.equal(det(Buffer.concat([Buffer.from([0xFF, 0xFE]), enc('utf-16le', zh)])).enc, 'utf-16le');
    assert.equal(det(enc('utf-16le', 'Hello 世界 UTF-16 text without bom, mostly ascii')).enc, 'utf-16le');
    assert.equal(det(enc('utf-16be', 'Hello 世界 UTF-16 text without bom, mostly ascii')).enc, 'utf-16be');
    assert.deepStrictEqual([det(Buffer.from('plain ascii\n')).enc, det(Buffer.from('plain ascii\n')).confidence], ['utf-8', 1]);
    assert.equal(det([]).enc, 'utf-8');
    assert.ok(det(enc('big5', zh)).ranked.length >= 3 && det(enc('big5', zh)).reason.includes('big5'));
    // 垃圾位元組不丟例外
    det(Buffer.from(Array.from({ length: 500 }, (_, i) => (i * 37 + 11) & 255)));
    // 大檔案：只取樣評分，仍正確
    assert.equal(det(enc('big5', zh.repeat(2000))).enc, 'big5');

    // 輸出
    assert.equal(m.finalText('a\r\nb\nc\r', { eol: 'LF' }), 'a\nb\nc\n');
    assert.equal(m.finalText('a\r\nb\nc\r', { eol: 'CRLF' }), 'a\r\nb\r\nc\r\n');
    assert.equal(m.finalText('a\r\nb', {}), 'a\r\nb'); assert.equal(m.finalText('x', { bom: true }), '﻿x'); assert.equal(m.finalText('﻿x', {}), 'x'); assert.equal(m.finalText('﻿x', { bom: true }), '﻿x');
    assert.equal(m.previewLines('1\n2\r\n3\n4', 2), '1\n2\n…（共 4 行）'); assert.equal(m.previewLines('1\n2', 5), '1\n2');
    assert.equal(m.decodeBytes(u8([0xE4, 0xB8]), 'utf-8').bad, 1, '截斷的 UTF-8 → 1 個 �');

    // encodeWith 與自製對照一致
    for (const l of ['big5', 'gbk', 'shift_jis', 'euc-kr']) { const s = { big5: zh, gbk: cn, shift_jis: jp, 'euc-kr': kr }[l]; assert.deepStrictEqual([...m.encodeWith(s, l)], [...enc(l, s)], l); }
    assert.deepStrictEqual([...m.encodeWith('ä¸­æ–‡', 'windows-1252')], [0xE4, 0xB8, 0xAD, 0xE6, 0x96, 0x87]);
    assert.equal(m.encodeWith('€', 'iso-8859-1'), null); assert.equal(m.encodeWith('中', 'windows-1252'), null); assert.equal(m.encodeWith('☃', 'big5'), null);

    // 亂碼逆向：用 X 編碼 → 以 Y 解讀 → 修復應還原
    const garble = (text, x, y) => new TextDecoder(y).decode(enc(x, text));
    assert.equal(garble('中文', 'utf-8', 'windows-1252'), 'ä¸­æ–‡', '與規格範例一致（含軟連字號）');
    let r = m.repairs('ä¸­æ–‡'); assert.equal(r.best.text, '中文'); assert.deepStrictEqual([r.best.wrong, r.best.right], ['windows-1252', 'utf-8']);
    r = m.repairs(garble('這是一段測試', 'utf-8', 'windows-1252')); assert.equal(r.best.text, '這是一段測試');
    r = m.repairs('Ã¤ Ã¶ Ã¼ cafÃ©'); assert.equal(r.best.text, 'ä ö ü café', '德法文 UTF-8 被當成 Latin-1 / 1252');
    const cases = [
        ['utf-8', 'windows-1252', '這是一段中文測試，今天天氣很好。'], ['utf-8', 'iso-8859-1', 'café résumé naïve'],
        ['utf-8', 'big5', '這是一段中文測試，今天天氣很好。'], ['utf-8', 'gbk', '这是一段中文测试，今天天气很好。'],
        ['utf-8', 'shift_jis', '今日は天気がいいですね、日本語のテストです。'], ['utf-8', 'euc-kr', '이것은 한국어 테스트입니다. 오늘은 날씨가 좋네요.'],
        ['big5', 'gbk', '這是一段繁體中文的測試文字，我們今天要去看電影。'], ['gbk', 'big5', '这是一段简体中文的测试文字，我们今天要去看电影。'],
        ['big5', 'windows-1252', '這是一段繁體中文的測試文字，我們今天要去看電影。'], ['gbk', 'windows-1252', '这是一段简体中文的测试文字，我们今天要去看电影。'],
        ['shift_jis', 'windows-1252', 'これは日本語のテストです。今日は天気がいいですね。'], ['shift_jis', 'gbk', 'これは日本語のテストです。今日は天気がいいですね。'],
    ];
    for (const [x, y, text] of cases) {
        const g = garble(text, x, y);
        if (g.includes('�')) { assert.equal(m.repairs(g).lossy, true, `${x}→${y} 含 � 應標示 lossy`); continue; }
        r = m.repairs(g);
        assert.ok(r.cands.some(c => c.text === text && c.right === x && (c.wrong === y || (y === 'iso-8859-1' && c.wrong === 'windows-1252'))), `${x} 被當 ${y}：候選中要有原文（${g}）`);
        const top = r.cands[0]; if (top.text !== text) console.log(`  (註) ${x} 被當 ${y}：最佳為 ${top.right}/${top.wrong} 而非原文；原文排名 ${r.cands.findIndex(c => c.text === text) + 1}`);
    }
    // 常見組合最佳必須正確
    for (const [x, y, text] of [['utf-8', 'windows-1252', '這是一段中文測試，今天天氣很好。'], ['utf-8', 'gbk', '这是一段中文测试，今天天气很好。'], ['utf-8', 'big5', '這是一段中文測試'], ['big5', 'gbk', '這是一段繁體中文的測試文字，我們今天要去看電影。'], ['utf-8', 'shift_jis', '今日は天気がいいですね、日本語のテストです。']]) {
        const g = garble(text, x, y); if (g.includes('�')) continue;
        assert.equal(m.repairs(g).best && m.repairs(g).best.text, text, `${x}/${y}`);
    }
    // 正常文字不亂修；空字串；無法編碼的字元；含 � / 锟斤拷
    assert.equal(m.repairs('這是一段正常的繁體中文。').best, null);
    assert.equal(m.repairs('Hello world').best, null);
    assert.deepStrictEqual(m.repairs('').cands, []);
    assert.equal(m.repairs('🙂 emoji 😀').best, null);
    assert.equal(m.repairs('锟斤拷锟斤拷').lossy, true); assert.equal(m.repairs('ab�cd').lossy, true);
    ok('encoding-fixer: BOM / 偵測（Big5 GBK SJIS EUC-KR UTF-16）/ 轉出 / 亂碼逆向（UTF-8、Big5、GBK、SJIS 互錯）/ lossy');
}

{ // ---------- audio-recorder ----------
    const m = load('utils/audio-recorder.html', 'pickMime, extFor, elapsedMs, fmtDur, fmtSize, cleanName, level, micError, encodeWav, MAX_MS, MAX_ITEMS, MAX_WAV_MS');
    assert.deepStrictEqual([m.MAX_MS, m.MAX_ITEMS, m.MAX_WAV_MS], [3600000, 20, 900000]);
    // 格式挑選
    assert.equal(m.pickMime(() => true), 'audio/webm;codecs=opus');
    assert.equal(m.pickMime(t => t.startsWith('audio/mp4')), 'audio/mp4');
    assert.equal(m.pickMime(t => t === 'audio/ogg'), 'audio/ogg');
    assert.equal(m.pickMime(() => false), '');
    assert.equal(m.pickMime(() => { throw new Error('x'); }), '');
    assert.deepStrictEqual(['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/wav', ''].map(m.extFor), ['webm', 'm4a', 'ogg', 'wav', 'webm']);
    // 計時（時間戳）
    assert.equal(m.elapsedMs(1000, 0, 0, 6000), 5000);
    assert.equal(m.elapsedMs(1000, 2000, 0, 6000), 3000, '扣掉累計暫停');
    assert.equal(m.elapsedMs(1000, 0, 4000, 9000), 3000, '正在暫停：暫停中的時間不算');
    assert.equal(m.elapsedMs(1000, 9999, 0, 2000), 0, '不會是負數');
    // 格式化
    assert.deepStrictEqual([0, 999, 1000, 61000, 3599000, 3600000, 3661000].map(m.fmtDur), ['00:00', '00:00', '00:01', '01:01', '59:59', '01:00:00', '01:01:01']);
    assert.deepStrictEqual([0, 1023, 1024, 1536, 1048576, 5 * 1048576].map(m.fmtSize), ['0 B', '1023 B', '1.0 KB', '1.5 KB', '1.0 MB', '5.0 MB']);
    assert.equal(m.cleanName('  a/b\\c:d*e?f"g<h>i|j '), 'abcdefghij'); assert.equal(m.cleanName('///'), '錄音'); assert.equal(m.cleanName('', 'x'), 'x');
    assert.equal(m.cleanName('長'.repeat(100)).length, 60); assert.equal(m.cleanName('會議 14:05'), '會議 1405');
    // 音量
    assert.equal(m.level(new Uint8Array(0)), 0); assert.equal(m.level(new Uint8Array(100).fill(128)), 0);
    assert.equal(m.level(Uint8Array.from({ length: 100 }, (_, i) => i % 2 ? 255 : 0)), 1, '滿幅限制在 1');
    assert.ok(Math.abs(m.level(Uint8Array.from({ length: 100 }, (_, i) => i % 2 ? 160 : 96)) - 0.5) < 0.01);
    // 錯誤訊息
    assert.ok(m.micError({ name: 'NotAllowedError' }).includes('權限')); assert.ok(m.micError({ name: 'NotFoundError' }).includes('找不到'));
    assert.ok(m.micError({ name: 'NotReadableError' }).includes('占用')); assert.ok(m.micError({ name: 'Weird', message: 'boom' }).includes('boom')); assert.ok(m.micError(null).includes('未知'));

    // WAV 檔頭與資料
    const dv = (u) => new DataView(u.buffer, u.byteOffset, u.byteLength);
    const tag = (u, o) => String.fromCharCode(...u.subarray(o, o + 4));
    let w = m.encodeWav([Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -2])], 44100), v = dv(w);
    assert.equal(w.length, 44 + 14);
    assert.deepStrictEqual([tag(w, 0), tag(w, 8), tag(w, 12), tag(w, 36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
    assert.equal(v.getUint32(4, true), w.length - 8); assert.equal(v.getUint32(16, true), 16); assert.equal(v.getUint16(20, true), 1);
    assert.equal(v.getUint16(22, true), 1); assert.equal(v.getUint32(24, true), 44100); assert.equal(v.getUint32(28, true), 88200);
    assert.equal(v.getUint16(32, true), 2); assert.equal(v.getUint16(34, true), 16); assert.equal(v.getUint32(40, true), 14);
    assert.deepStrictEqual([...Array(7)].map((_, i) => v.getInt16(44 + i * 2, true)), [0, 32767, -32768, 16384, -16384, 32767, -32768], '含削波（超出 ±1）');
    // 雙聲道交錯、48000
    w = m.encodeWav([Float32Array.from([0.25, 0.5]), Float32Array.from([-0.25, -0.5])], 48000); v = dv(w);
    assert.equal(w.length, 44 + 8); assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(28, true), 192000); assert.equal(v.getUint16(32, true), 4); assert.equal(v.getUint32(40, true), 8);
    assert.deepStrictEqual([0, 1, 2, 3].map(i => v.getInt16(44 + i * 2, true)), [8192, -8192, 16384, -16384], 'L R L R');
    // 空資料 / 沒有聲道 / 聲道長度不齊 / NaN 不丟例外
    w = m.encodeWav([new Float32Array(0)], 8000); assert.equal(w.length, 44); assert.equal(dv(w).getUint32(40, true), 0);
    w = m.encodeWav([], 8000); assert.equal(w.length, 44); assert.equal(dv(w).getUint16(22, true), 1);
    w = m.encodeWav([Float32Array.from([0.5, 0.5]), Float32Array.from([0.5])], 8000); assert.equal(w.length, 44 + 8); assert.equal(dv(w).getInt16(44 + 6, true), 0);
    w = m.encodeWav([Float32Array.from([NaN, 0.1])], 8000); assert.equal(dv(w).getInt16(44, true), 0);
    // 一秒 44.1k 單聲道的長度
    assert.equal(m.encodeWav([new Float32Array(44100)], 44100).length, 44 + 88200);
    ok('audio-recorder: 格式挑選 / 計時 / 格式化 / 音量 / 錯誤訊息 / WAV 檔頭與交錯 / 邊界');
}

{ // ---------- exif-viewer ----------
    const m = load('utils/exif-viewer.html', 'parseTiff, gpsInfo, mapUrl, exifRows, jpegScan, pngChunks, riffChunks, analyze, stripMeta, minimalTiff, MAX_IMGS, MAX_BYTES');
    const G = require('./_exifgen');
    const { near } = require('./_load');
    assert.deepStrictEqual([m.MAX_IMGS, m.MAX_BYTES], [20, 30 * 1024 * 1024]);
    const lat = 25 + 1 / 60 + 48 / 3600, lon = 121 + 33 / 60 + 36 / 3600;

    // --- TIFF：小端 / 大端 ---
    for (const le of [true, false]) {
        const t = m.parseTiff(G.samplePhotoTiff(le));
        assert.equal(t.ok, true); assert.equal(t.little, le); assert.deepStrictEqual(t.warnings, []);
        assert.equal(t.ifd0[0x10F], 'Canon'); assert.equal(t.ifd0[0x110], 'Canon EOS R5'); assert.equal(t.ifd0[0x112], 6);
        assert.deepStrictEqual(t.exif[0x829A], { n: 1, d: 250 }); assert.equal(t.exif[0x8827], 400); assert.equal(t.exif[0x9003], '2024:05:06 14:30:15');
        assert.deepStrictEqual(t.gps[2], [{ n: 25, d: 1 }, { n: 1, d: 1 }, { n: 4800, d: 100 }]); assert.equal(t.gps[1], 'N');
        assert.deepStrictEqual(t.thumb, { length: 64 });
        const g = m.gpsInfo(t.gps); near(g.lat, lat); near(g.lon, lon); near(g.alt, 100);
        assert.equal(g.url, `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}`);
        const rows = Object.fromEntries(m.exifRows(t).map(([k, v]) => [k, v]));
        assert.equal(rows['相機'], 'Canon EOS R5'); assert.equal(rows['鏡頭'], 'RF85mm F1.2L'); assert.equal(rows['拍攝時間'], '2024-05-06 14:30:15');
        assert.equal(rows['曝光時間'], '1/250 秒'); assert.equal(rows['光圈'], 'f/2.8'); assert.equal(rows.ISO, '400'); assert.equal(rows['焦距'], '85 mm（35mm 等效 85 mm）');
        assert.equal(rows['方向'], '順時針 90°'); assert.equal(rows['機身序號'], 'SN12345'); assert.ok(rows['內嵌縮圖'].startsWith('有'));
        assert.equal(m.exifRows(t).find(r => r[0] === '機身序號')[2], true, '序號列為敏感');
    }
    // GPS 符號與邊界
    const gp = (o) => m.gpsInfo(Object.fromEntries(Object.entries(o)));
    const D = (d, mi = 0, s = 0) => [{ n: d, d: 1 }, { n: mi, d: 1 }, { n: s, d: 1 }];
    let g = gp({ 1: 'S', 2: D(33, 52, 0), 3: 'W', 4: D(151, 12, 0) }); near(g.lat, -(33 + 52 / 60)); near(g.lon, -(151 + 12 / 60));
    g = gp({ 1: 'N', 2: D(91), 3: 'E', 4: D(10) }); assert.equal(g.lat, null); assert.equal(g.url, null); assert.ok(g.warnings.length);
    g = gp({ 1: 'N', 2: D(0), 3: 'E', 4: D(0) }); assert.equal(g.zero, true); assert.equal(g.url, null);
    g = gp({ 1: 'N', 2: [{ n: 1, d: 0 }, { n: 0, d: 1 }, { n: 0, d: 1 }], 3: 'E', 4: D(10) }); assert.equal(g.lat, null, '分母為 0');
    g = gp({ 2: D(10), 4: D(20) }); assert.equal(g.lat, 10); assert.ok(g.warnings.length, '缺少 N/S 參照仍可用但有警告');
    g = gp({ 7: [{ n: 1, d: 1 }] }); assert.equal(g.lat, null); assert.equal(g.url, null); assert.notEqual(g, null, '只有其他 GPS 欄位也算含 GPS');
    assert.equal(m.gpsInfo({}), null); assert.equal(m.gpsInfo(null), null);
    g = gp({ 1: 'N', 2: D(10), 3: 'E', 4: D(20), 5: 1, 6: { n: 30, d: 1 } }); near(g.alt, -30);
    // 無 GPS 的 EXIF
    const noGps = m.parseTiff(G.buildTiff({ ifd0: [[0x10F, 2, 'Nikon'], [0x110, 2, 'D850']] }));
    assert.equal(m.gpsInfo(noGps.gps), null); assert.equal(noGps.thumb, null); assert.equal(m.exifRows(noGps)[0][1], 'Nikon D850');
    assert.equal(m.exifRows(m.parseTiff(G.buildTiff({ ifd0: [[0x10F, 2, 'Sony'], [0x110, 2, 'Sony A7']] })))[0][1], 'Sony A7', '型號已含廠牌不重複');
    // 曝光時間 > 1 秒、快門 0
    const ex = (n, d) => m.exifRows(m.parseTiff(G.buildTiff({ ifd0: [], exif: [[0x829A, 5, [[n, d]]]] }))).find(r => r[0] === '曝光時間')[1];
    assert.equal(ex(2, 1), '2 秒'); assert.equal(ex(1, 2), '1/2 秒'); assert.equal(ex(5, 10), '1/2 秒');

    // 壞資料：不丟例外、回傳空結果與警告
    const full = G.samplePhotoTiff(true);
    const bad = [new Uint8Array(0), Uint8Array.of(0x49, 0x49), Uint8Array.of(0x58, 0x58, 42, 0, 8, 0, 0, 0), Uint8Array.of(0x49, 0x49, 43, 0, 8, 0, 0, 0), Uint8Array.of(0x49, 0x49, 42, 0, 0xFF, 0xFF, 0, 0),
        Uint8Array.of(0x49, 0x49, 42, 0, 8, 0, 0, 0, 0xFF, 0xFF)];
    for (const b of bad) { const t = m.parseTiff(b); assert.deepStrictEqual([t.ifd0, t.exif, t.gps], [{}, {}, {}]); assert.ok(t.warnings.length, '要有警告'); }
    for (let cut = 0; cut < full.length; cut += 7) { const t = m.parseTiff(full.subarray(0, cut)); assert.ok(typeof t.ok === 'boolean'); } // 任意截斷都不丟例外
    const half = m.parseTiff(full.subarray(0, 120)); assert.ok(half.warnings.length >= 1);
    // 迴圈：IFD0 的下一個 IFD 指回自己 → 不會無限迴圈
    const loop = Uint8Array.from(G.buildTiff({ ifd0: [[0x10F, 2, 'X']] })); loop[8 + 2 + 12] = 8; // next IFD = 8
    assert.equal(m.parseTiff(loop).ifd0[0x10F], 'X');
    // 欄位資料超出範圍：略過並警告，其他欄位照常
    const oob = Uint8Array.from(G.buildTiff({ ifd0: [[0x10F, 2, 'LongerThan4'], [0x112, 3, 1]] })); // 0x10F 的位移改成超大
    oob[8 + 2 + 8] = 0xFF; oob[8 + 2 + 9] = 0xFF;
    let t = m.parseTiff(oob); assert.equal(t.ifd0[0x10F], undefined); assert.equal(t.ifd0[0x112], 1); assert.ok(t.warnings.some(w => w.includes('超出')));
    // 隨機垃圾（固定種子）
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 300; i++) { const b = Uint8Array.from({ length: 30 + (rnd() * 200 | 0) }, () => rnd() * 256 | 0); if (i % 2) { b[0] = b[1] = 0x49; b[2] = 42; b[3] = 0; b[4] = 8; b[5] = b[6] = b[7] = 0; } m.parseTiff(b); m.analyze(b); m.stripMeta(b, {}); }

    // --- JPEG ---
    const jpg = G.buildJpeg({ tiff: G.samplePhotoTiff(true) });
    let s = m.jpegScan(jpg); assert.equal(s.ok, true);
    assert.deepStrictEqual(s.segs.map(x => x.kind), ['jfif', 'exif', 'xmp', 'icc', 'iptc', 'app', 'comment', 'other']);
    assert.equal(s.tail, jpg.length - G.SCAN.length);
    let a = m.analyze(jpg);
    assert.equal(a.format, 'jpeg'); assert.equal(a.ok, true); assert.equal(a.hasMeta, true); assert.equal(a.orientation, 6);
    assert.ok(a.gps && a.gps.lat !== null && a.gps.url); assert.ok(a.thumb);
    assert.deepStrictEqual(a.sections.map(x => x.kind), ['jfif', 'exif', 'xmp', 'icc', 'iptc', 'app', 'comment', 'thumb']);
    assert.ok(a.sections.every(x => x.size > 0 && x.name));
    // 無損移除（不保留方向）
    let r = m.stripMeta(jpg, {});
    assert.ok(r.removed.length === 5 && r.removed.some(n => n.includes('EXIF')) && r.removed.some(n => n.includes('IPTC')));
    assert.equal(r.bytes[0], 0xFF); assert.equal(r.bytes[1], 0xD8); assert.equal(r.bytes[r.bytes.length - 2], 0xFF); assert.equal(r.bytes[r.bytes.length - 1], 0xD9, '仍以 EOI 結尾');
    assert.deepStrictEqual([...r.bytes.subarray(r.bytes.length - G.SCAN.length)], [...G.SCAN], '影像資料原封不動');
    s = m.jpegScan(r.bytes); assert.equal(s.ok, true); assert.deepStrictEqual(s.segs.map(x => x.kind), ['jfif', 'icc', 'other']);
    a = m.analyze(r.bytes); assert.equal(a.exif, null); assert.equal(a.gps, null); assert.equal(a.hasMeta, false); assert.deepStrictEqual(a.rows, []);
    assert.ok(r.bytes.length < jpg.length);
    // 保留方向：只剩 Orientation
    r = m.stripMeta(jpg, { keepOrientation: true }); a = m.analyze(r.bytes);
    assert.equal(r.keptOrientation, 6); assert.equal(a.orientation, 6); assert.equal(a.gps, null); assert.deepStrictEqual(a.rows.map(x => x[0]), ['方向']); assert.equal(a.thumb, null);
    assert.deepStrictEqual(m.jpegScan(r.bytes).segs.map(x => x.kind), ['jfif', 'exif', 'icc', 'other'], '最小 EXIF 緊接在 JFIF 後');
    assert.deepStrictEqual([...r.bytes.subarray(r.bytes.length - G.SCAN.length)], [...G.SCAN]);
    // 方向為 1 或沒有 EXIF：不必留
    const jpg1 = G.buildJpeg({ tiff: G.buildTiff({ ifd0: [[0x112, 3, 1], [0x10F, 2, 'X']] }) });
    assert.equal(m.analyze(m.stripMeta(jpg1, { keepOrientation: true }).bytes).exif, null);
    // 沒有 JFIF 時，最小 EXIF 放在 SOI 後
    const jpgNoJfif = G.buildJpeg({ tiff: G.samplePhotoTiff(false), jfif: false });
    r = m.stripMeta(jpgNoJfif, { keepOrientation: true }); assert.deepStrictEqual(m.jpegScan(r.bytes).segs.map(x => x.kind), ['exif', 'icc', 'other']); assert.equal(m.analyze(r.bytes).orientation, 6);
    // 連 ICC 一起移除
    r = m.stripMeta(jpg, { dropIcc: true }); assert.deepStrictEqual(m.jpegScan(r.bytes).segs.map(x => x.kind), ['jfif', 'other']);
    // 已經乾淨的 JPEG：輸出與輸入相同
    const clean = G.buildJpeg({ xmp: false, icc: false, iptc: false, comment: false, extraApp: false });
    assert.deepStrictEqual([...m.stripMeta(clean, {}).bytes], [...clean]); assert.equal(m.analyze(clean).hasMeta, false);
    // 大端 EXIF 也行；損毀 EXIF 的 JPEG 仍可無損清除
    a = m.analyze(G.buildJpeg({ tiff: G.samplePhotoTiff(false) })); assert.equal(a.gps && a.gps.lat !== null, true); near(a.gps.lat, lat);
    const brokenExif = G.buildJpeg({ tiff: Uint8Array.from([0x49, 0x49, 42, 0, 8, 0, 0, 0, 0xFF, 0xFF]) });
    a = m.analyze(brokenExif); assert.equal(a.exif && a.exif.ok ? 1 : 0, 1, '標頭合法但 IFD 被截斷：部分結果'); assert.ok(a.warnings.length);
    const garbageExif = G.buildJpeg({ tiff: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]) });
    a = m.analyze(garbageExif); assert.equal(a.exif, null); assert.ok(a.warnings.some(w => w.includes('無法解析')));
    assert.equal(m.analyze(m.stripMeta(garbageExif, {}).bytes).hasMeta, false);
    // 截斷 / 損毀的 JPEG
    assert.equal(m.stripMeta(jpg.subarray(0, 60), {}), null); a = m.analyze(jpg.subarray(0, 60)); assert.equal(a.ok, false); assert.ok(a.warnings.length);
    assert.equal(m.jpegScan(Uint8Array.of(0xFF, 0xD8, 0xFF)).ok, false); assert.equal(m.jpegScan(Uint8Array.of(1, 2, 3, 4)).ok, false); assert.equal(m.jpegScan(new Uint8Array(0)).ok, false);
    const badLen = Uint8Array.from(jpg); badLen[2 + 18 + 2] = 0xFF; badLen[2 + 18 + 3] = 0xFF; // JFIF 之後第二個區段的長度壞掉
    assert.equal(m.jpegScan(badLen).ok, false);
    assert.equal(m.stripMeta(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), {}), null);
    assert.equal(m.analyze(Uint8Array.from(Buffer.from('GIF89a......'))).format, null);

    // --- PNG ---
    const png = G.buildPng({ tiff: G.samplePhotoTiff(false) });
    assert.equal(m.pngChunks(png).ok, true); assert.deepStrictEqual(m.pngChunks(png).chunks.map(c => c.type), ['IHDR', 'eXIf', 'tEXt', 'iTXt', 'tIME', 'IDAT', 'IEND']);
    a = m.analyze(png); assert.equal(a.format, 'png'); assert.equal(a.hasMeta, true); near(a.gps.lat, lat);
    assert.ok(a.sections.some(x => x.name.includes('Software')) && a.sections.some(x => x.name.includes('XML:com.adobe.xmp')) && a.sections.some(x => x.kind === 'tIME'));
    r = m.stripMeta(png, {}); assert.deepStrictEqual(r.removed, ['eXIf', 'tEXt', 'iTXt', 'tIME']);
    assert.deepStrictEqual(m.pngChunks(r.bytes).chunks.map(c => c.type), ['IHDR', 'IDAT', 'IEND']); assert.equal(m.pngChunks(r.bytes).ok, true);
    a = m.analyze(r.bytes); assert.equal(a.exif, null); assert.equal(a.gps, null); assert.equal(a.hasMeta, false);
    assert.deepStrictEqual([...r.bytes.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    // CRC 沿用原區塊（逐位元組相同）
    assert.deepStrictEqual([...r.bytes.subarray(8, 8 + 25)], [...png.subarray(8, 8 + 25)]);
    assert.equal(m.stripMeta(png.subarray(0, 40), {}), null); assert.equal(m.pngChunks(png.subarray(0, 40)).ok, false);
    // PNG 已乾淨：不變
    const pc = G.buildPng({ text: false }); assert.deepStrictEqual([...m.stripMeta(pc, {}).bytes], [...pc]);

    // --- WebP ---
    const wp = G.buildWebp({ tiff: G.samplePhotoTiff(true), exifPrefix: false, icc: true });
    const rc = m.riffChunks(wp); assert.equal(rc.ok, true); assert.deepStrictEqual(rc.chunks.map(c => c.id), ['VP8X', 'ICCP', 'VP8 ', 'EXIF', 'XMP ']);
    a = m.analyze(wp); assert.equal(a.format, 'webp'); near(a.gps.lat, lat); assert.ok(a.sections.some(x => x.kind === 'xmp') && a.sections.some(x => x.kind === 'icc'));
    a = m.analyze(G.buildWebp({ tiff: G.samplePhotoTiff(true), exifPrefix: true })); near(a.gps.lat, lat, 1e-6); // 有 Exif\0\0 前綴也能解析
    r = m.stripMeta(wp, {}); const dvr = new DataView(r.bytes.buffer, r.bytes.byteOffset, r.bytes.byteLength);
    assert.equal(dvr.getUint32(4, true), r.bytes.length - 8, 'RIFF 長度已更新'); assert.equal(m.riffChunks(r.bytes).ok, true);
    assert.deepStrictEqual(m.riffChunks(r.bytes).chunks.map(c => c.id), ['VP8X', 'ICCP', 'VP8 ']); assert.equal(r.bytes[12 + 8] & 0x0C, 0, 'VP8X 的 EXIF / XMP 旗標已清除'); assert.equal(r.bytes[12 + 8] & 0x20, 0x20, 'ICC 旗標保留');
    a = m.analyze(r.bytes); assert.equal(a.exif, null); assert.equal(a.hasMeta, false);
    r = m.stripMeta(wp, { keepOrientation: true }); a = m.analyze(r.bytes); assert.equal(a.orientation, 6); assert.equal(a.gps, null); assert.equal(new DataView(r.bytes.buffer, r.bytes.byteOffset).getUint32(4, true), r.bytes.length - 8);
    assert.equal(r.bytes[12 + 8] & 0x08, 0x08);
    assert.equal(m.stripMeta(wp.subarray(0, 45), {}), null);
    // 最小 TIFF 可被解析
    assert.equal(m.parseTiff(m.minimalTiff(8)).ifd0[0x112], 8);
    ok('exif-viewer: TIFF 大小端 / GPS 換算 / 壞資料與截斷不丟例外 / JPEG PNG WebP 區段切割與無損移除（保留方向、仍為有效檔）');
}
