// 批次 g5（續）：檔案檢視器（file-inspector）純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');

(async () => {
    const zlib = require('zlib');
    const m = load('utils/file-inspector.html', 'hexdump, hexToBytes, parseOffset, findBytes, MAGIC, detectType, checkExt, crc32, parseZip, zipData, inflateLimited, zipExtract, imageInfo, bitPlane, lsbExtract, printableRatio, lsbOnes, dosTime');
    const B = (s) => Uint8Array.from(Buffer.from(s, 'latin1'));
    const cat = (...a) => new Uint8Array(Buffer.concat(a.map(x => Buffer.from(x))));
    // hexdump
    assert.strictEqual(m.hexdump(B('Hello, World!\n\x00\xff'), 0), '00000000  48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21 0a 00 ff  |Hello, World!...|');
    assert.strictEqual(m.hexdump(B('ABC'), 16, 8), '00000010  41 42 43                 |ABC|');
    assert.strictEqual(m.hexdump(B('0123456789'), 0, 8).split('\n').length, 2); assert.strictEqual(m.hexdump(new Uint8Array(0), 0), '');
    assert.deepStrictEqual(Array.from(m.hexToBytes('50 4B 0x03,04')), [0x50, 0x4b, 3, 4]); assert.strictEqual(m.hexToBytes('5'), null); assert.strictEqual(m.hexToBytes('zz'), null); assert.strictEqual(m.hexToBytes(''), null);
    assert.strictEqual(m.parseOffset('0x10', 100), 16); assert.strictEqual(m.parseOffset('500', 100), 99); assert.strictEqual(m.parseOffset('abc', 100), null); assert.strictEqual(m.parseOffset('-1', 100), null);
    assert.strictEqual(m.findBytes(B('abcabcabd'), B('abd')), 6); assert.strictEqual(m.findBytes(B('abc'), B('abcd')), -1); assert.strictEqual(m.findBytes(B('aab'), B('ab')), 1); assert.strictEqual(m.findBytes(B('abab'), B('ab'), 1), 2); assert.strictEqual(m.findBytes(B('abc'), B('')), -1);
    // 類型偵測：每個內建格式至少一個樣本
    assert.ok(m.MAGIC.length >= 30);
    const pad = (s, n = 64) => cat(B(s), new Uint8Array(Math.max(0, n - s.length)));
    const S = {
        'PNG': '\x89PNG\r\n\x1a\n', 'JPEG': '\xff\xd8\xff\xe0', 'GIF 圖片': 'GIF89a', 'WebP': 'RIFF\0\0\0\0WEBPVP8 ', 'AVIF': '\0\0\0\x1cftypavif', 'HEIC': '\0\0\0\x18ftypheic', 'ICO': '\0\0\x01\0\x01\0', 'TIFF': 'II*\0', 'Photoshop': '8BPS',
        'BMP': 'BM\x36\0\0\0\0\0\0\0', 'PDF': '%PDF-1.7', 'ZIP': 'PK\x03\x04', 'RAR': 'Rar!\x1a\x07\0', '7-Zip': '7z\xbc\xaf\x27\x1c', 'GZIP': '\x1f\x8b\x08\0', 'BZip2': 'BZh9', 'XZ': '\xfd7zXZ\0', 'Zstandard': '\x28\xb5\x2f\xfd', 'CAB': 'MSCF',
        'MP3': 'ID3\x03', 'WAV': 'RIFF\0\0\0\0WAVEfmt ', 'AVI': 'RIFF\0\0\0\0AVI LIST', 'OGG': 'OggS', 'FLAC': 'fLaC', 'MIDI': 'MThd', 'M4A': '\0\0\0\x20ftypM4A ', 'QuickTime': '\0\0\0\x14ftypqt  ', '3GP': '\0\0\0\x14ftyp3gp4', 'MP4': '\0\0\0\x18ftypisom',
        'Matroska': '\x1a\x45\xdf\xa3', 'FLV': 'FLV\x01', 'Windows 可執行檔': 'MZ\x90\0', 'ELF': '\x7fELF', 'Mach-O': '\xcf\xfa\xed\xfe', 'Java class': '\xca\xfe\xba\xbe', 'WebAssembly': '\0asm', 'LNK': 'L\0\0\0\x01\x14\x02\0', 'SQLite': 'SQLite format 3\0',
        'OLE2': '\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1', 'RTF': '{\\rtf1', 'WOFF 字型': 'wOFF', 'WOFF2': 'wOF2', 'TrueType': '\0\x01\0\0', 'OpenType': 'OTTO', 'pcap': '\xd4\xc3\xb2\xa1', 'plist': 'bplist00', 'PEM': '-----BEGIN CERTIFICATE-----', 'SVG': '<svg xmlns="http://www.w3.org/2000/svg">',
        'XML': '\xef\xbb\xbf <?xml version="1.0"?><a/>', 'HTML': '<!DOCTYPE html><html>',
    };
    for (const [k, v] of Object.entries(S)) { const d = m.detectType(pad(v)); assert.ok(d && d.name.includes(k), `${k} → ${d && d.name}`); }
    assert.ok(m.detectType(pad('<?xml version="1.0"?><svg/>')).name.includes('SVG'));
    const tar = new Uint8Array(512); tar.set(B('ustar'), 257); assert.ok(m.detectType(tar).name.includes('TAR'));
    const iso = new Uint8Array(33000); iso.set(B('CD001'), 0x8001); assert.ok(m.detectType(iso).name.includes('ISO'));
    assert.ok(m.MAGIC.every(g => /\S/.test(g.name) && g.exts.length));
    // 文字 / 未知 / 空
    assert.ok(m.detectType(B('hello world\nsecond line')).text); assert.ok(m.detectType(Buffer.from('哈囉，世界', 'utf8')).name.includes('UTF-8'));
    assert.strictEqual(m.detectType(Uint8Array.from([1, 2, 3, 0, 255, 254, 9, 0])), null); assert.strictEqual(m.detectType(new Uint8Array(0)), null);
    assert.ok(m.detectType(Uint8Array.from([0xb3, 0x6e, 0xa5, 0x58, 0x20, 0x61, 0x62, 0x63])).name.includes('非 UTF-8'));
    // 副檔名比對
    const png = m.detectType(pad(S.PNG)), exe = m.detectType(pad(S['Windows 可執行檔'])), txt = m.detectType(B('plain text'));
    assert.strictEqual(m.checkExt(png, 'a.PNG').status, 'ok'); assert.strictEqual(m.checkExt(png, 'a.jpg').status, 'mismatch'); assert.strictEqual(m.checkExt(png, 'a').status, 'noext');
    assert.strictEqual(m.checkExt(exe, 'photo.jpg').status, 'mismatch'); assert.ok(exe.exec); assert.strictEqual(m.checkExt(m.detectType(pad(S.ZIP)), 'x.docx').status, 'ok');
    assert.strictEqual(m.checkExt(txt, 'a.txt').status, 'ok'); assert.strictEqual(m.checkExt(txt, 'a.exe').status, 'mismatch'); assert.strictEqual(m.checkExt(txt, 'a.js').status, 'ok'); assert.strictEqual(m.checkExt(null, 'a.xyz').status, 'unknown');
    assert.strictEqual(m.checkExt(png, 'archive.tar.png').ext, 'png');
    // crc32
    assert.strictEqual(m.crc32(B('123456789')), 0xcbf43926); assert.strictEqual(m.crc32(new Uint8Array(0)), 0);
    // ZIP（用 zlib 建樣本）
    function buildZip(files) {
        const loc = [], cd = []; let off = 0;
        for (const f of files) {
            const nameB = Buffer.from(f.name, 'utf8'), raw = Buffer.from(f.data || ''), method = f.method ?? 8;
            const data = f.rawData || (method === 8 ? zlib.deflateRawSync(raw) : raw), crc = m.crc32(raw), flags = (f.flags || 0) | 0x800;
            const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0x6000, 10); lh.writeUInt16LE((2024 - 1980) << 9 | 3 << 5 | 15, 12);
            lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(f.usize ?? raw.length, 22); lh.writeUInt16LE(nameB.length, 26); lh.writeUInt16LE(0, 28);
            loc.push(lh, nameB, data);
            const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10); ch.writeUInt16LE(0x6000, 12); ch.writeUInt16LE((2024 - 1980) << 9 | 3 << 5 | 15, 14);
            ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(f.usize ?? raw.length, 24); ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(off, 42);
            cd.push(ch, nameB); off += 30 + nameB.length + data.length;
        }
        const cdb = Buffer.concat(cd), eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(files.length, 8); eo.writeUInt16LE(files.length, 10); eo.writeUInt32LE(cdb.length, 12); eo.writeUInt32LE(off, 16);
        return new Uint8Array(Buffer.concat([...loc, cdb, eo]));
    }
    const text = '你好 zip\n'.repeat(50);
    const z = buildZip([{ name: 'a.txt', data: text }, { name: 'dir/', data: '', method: 0 }, { name: '中文/檔案.md', data: '# hi', method: 0 }, { name: '../evil.txt', data: 'x' }, { name: 'enc.bin', data: 'secret', flags: 1 }, { name: 'aes.bin', data: 'x', method: 99, rawData: Buffer.from('abc') }, { name: 'bz.bin', data: 'x', method: 12, rawData: Buffer.from('abc') }]);
    const pz = m.parseZip(z);
    assert.strictEqual(pz.entries.length, 7); assert.ok(!pz.warn);
    assert.deepStrictEqual(pz.entries.map(e => e.name), ['a.txt', 'dir/', '中文/檔案.md', '../evil.txt', 'enc.bin', 'aes.bin', 'bz.bin']);
    assert.ok(pz.entries[1].isDir); assert.ok(pz.entries[3].unsafe); assert.ok(!pz.entries[0].unsafe); assert.ok(pz.entries[4].enc); assert.strictEqual(pz.entries[0].mtime, '2024-03-15 12:00'); assert.strictEqual(pz.entries[0].usize, Buffer.byteLength(text));
    let r = await m.zipExtract(z, pz.entries[0]); assert.strictEqual(Buffer.from(r.data).toString('utf8'), text); assert.ok(r.crcOk);
    r = await m.zipExtract(z, pz.entries[2]); assert.strictEqual(Buffer.from(r.data).toString(), '# hi'); assert.ok(r.crcOk);
    assert.ok((await m.zipExtract(z, pz.entries[4])).error.includes('加密')); assert.ok((await m.zipExtract(z, pz.entries[5])).error.includes('加密'));
    assert.ok((await m.zipExtract(z, pz.entries[6])).error.includes('BZip2'));
    // zip bomb：標示很小、實際解出 6MB
    const bomb = buildZip([{ name: 'bomb.bin', rawData: zlib.deflateRawSync(Buffer.alloc(6 * 1024 * 1024)), data: '', usize: 10 }]);
    r = await m.zipExtract(bomb, m.parseZip(bomb).entries[0]); assert.ok(r.error && r.error.includes('zip bomb'), JSON.stringify(r.error));
    const bomb2 = buildZip([{ name: 'b.bin', data: Buffer.alloc(6 * 1024 * 1024) }]); r = await m.zipExtract(bomb2, m.parseZip(bomb2).entries[0]); assert.ok(r.error.includes('上限'));   // 標示大小就超過
    r = await m.zipExtract(bomb2, m.parseZip(bomb2).entries[0], 7 * 1024 * 1024); assert.strictEqual(r.data.length, 6 * 1024 * 1024);
    const bad = buildZip([{ name: 'x.txt', rawData: Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff]), data: 'abc' }]); r = await m.zipExtract(bad, m.parseZip(bad).entries[0]); assert.ok(r.error);
    // CRC 不符
    const z2 = Uint8Array.from(buildZip([{ name: 's.txt', data: 'abc', method: 0 }])); z2[30 + 5] ^= 1; r = await m.zipExtract(z2, m.parseZip(z2).entries[0]); assert.strictEqual(r.crcOk, false);
    // 損壞 / 非 ZIP
    assert.ok(m.parseZip(B('not a zip file at all, just text.')).error); assert.ok(m.parseZip(new Uint8Array(5)).error);
    const trunc = z.subarray(0, z.length - 30); assert.ok(m.parseZip(trunc).error || m.parseZip(trunc).warn);
    const zc = Uint8Array.from(z); new DataView(zc.buffer).setUint32(zc.length - 22 + 16, 5, true); assert.ok(m.parseZip(zc).warn);   // 中央目錄偏移錯誤
    assert.strictEqual(m.parseZip(buildZip([])).entries.length, 0);
    assert.strictEqual(m.dosTime(0, 0), '—');
    // 圖片結構
    const chunk = (t, body) => { const b = Buffer.alloc(12 + body.length); b.writeUInt32BE(body.length, 0); b.write(t, 4, 'latin1'); Buffer.from(body).copy(b, 8); return b; };
    const pngB = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Comment\0secret note')), chunk('IDAT', Buffer.alloc(5)), chunk('IEND', Buffer.alloc(0))]);
    let info = m.imageInfo(new Uint8Array(pngB)); assert.strictEqual(info.kind, 'PNG'); assert.strictEqual(info.end, pngB.length); assert.ok(info.complete); assert.deepStrictEqual(info.chunks, ['IHDR', 'tEXt', 'IDAT', 'IEND']); assert.deepStrictEqual(info.texts, ['Comment = secret note']);
    info = m.imageInfo(new Uint8Array(Buffer.concat([pngB, z]))); assert.strictEqual(info.end, pngB.length);
    info = m.imageInfo(new Uint8Array(pngB.subarray(0, pngB.length - 20))); assert.ok(!info.complete);
    const seg = (mk, body) => Buffer.concat([Buffer.from([0xff, mk, (body.length + 2) >> 8, (body.length + 2) & 255]), Buffer.from(body)]);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0'), seg(0xfe, 'hidden comment'), seg(0xe1, 'Exif\0\0II*\0'), seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xd9])]);
    info = m.imageInfo(new Uint8Array(jpg)); assert.strictEqual(info.end, jpg.length); assert.ok(info.complete); assert.deepStrictEqual(info.chunks, ['APP0', 'COM', 'APP1（EXIF）', 'SOS']); assert.deepStrictEqual(info.texts, ['hidden comment']);
    info = m.imageInfo(new Uint8Array(Buffer.concat([jpg, Buffer.from('TRAILING')]))); assert.strictEqual(info.end, jpg.length);
    const gifB = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([1, 0, 1, 0, 0x80, 0, 0]), Buffer.from([0, 0, 0, 255, 255, 255]), Buffer.from([0x21, 0xfe, 3]), Buffer.from('hey'), Buffer.from([0]), Buffer.from([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0]), Buffer.from([0x3b])]);
    info = m.imageInfo(new Uint8Array(gifB)); assert.strictEqual(info.kind, 'GIF'); assert.strictEqual(info.end, gifB.length); assert.ok(info.complete); assert.deepStrictEqual(info.texts, ['hey']);
    info = m.imageInfo(new Uint8Array(Buffer.concat([gifB, Buffer.from('PKxx')]))); assert.strictEqual(info.end, gifB.length);
    const bmpB = Buffer.alloc(100); bmpB.write('BM'); bmpB.writeUInt32LE(60, 2); assert.strictEqual(m.imageInfo(new Uint8Array(bmpB)).end, 60);
    assert.strictEqual(m.imageInfo(B('plain text')), null);
    // 位元平面 / LSB
    const rgba = Uint8ClampedArray.from([1, 2, 3, 255, 254, 255, 0, 128]);
    assert.deepStrictEqual(Array.from(m.bitPlane(rgba, 0, 0)), [255, 255, 255, 255, 0, 0, 0, 255]); assert.deepStrictEqual(Array.from(m.bitPlane(rgba, 4, 0)), [255, 0, 255, 255, 0, 255, 0, 255]);
    assert.deepStrictEqual(Array.from(m.bitPlane(rgba, 3, 7)), [255, 255, 255, 255, 255, 255, 255, 255]);
    const msg = B('Hi!'), bits = []; for (const b of msg) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    const px = new Uint8ClampedArray(4 * 10).fill(200); let bi = 0; for (let p = 0; p < 10 && bi < bits.length; p++) for (let c = 0; c < 3 && bi < bits.length; c++) px[p * 4 + c] = 200 + bits[bi++];
    assert.strictEqual(Buffer.from(m.lsbExtract(px, 3)).toString(), 'Hi!');
    assert.strictEqual(m.printableRatio(B('abc\x00')), 0.75); assert.strictEqual(m.printableRatio(new Uint8Array(0)), 0);
    assert.strictEqual(m.lsbOnes(Uint8ClampedArray.from([1, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0]), 0), 0.5);
    ok('file-inspector: 純邏輯');
})();
