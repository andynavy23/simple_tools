// 測試用：程式生成含 EXIF 的 JPEG / PNG / WebP 位元組（new-z4.test.js 與 E2E 共用）
// 值格式：type 2 字串；type 1/3/4/6/8/9 數字或陣列；type 5/10 為 [[n,d],…]；type 7 為位元組陣列
const TS = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

function buildTiff({ le = true, ifd0 = [], exif = [], gps = [], thumb = null } = {}) {
    const w16 = (v) => le ? [v & 255, v >> 8 & 255] : [v >> 8 & 255, v & 255];
    const w32 = (v) => le ? [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24] : [v >>> 24, v >> 16 & 255, v >> 8 & 255, v & 255];
    const vbytes = (type, v) => {
        if (type === 2) { const a = [...Buffer.from(v, 'utf8'), 0]; return { cnt: a.length, bytes: a }; }
        const arr = Array.isArray(v) ? v : [v], out = [];
        for (const x of arr) {
            if (type === 5 || type === 10) out.push(...w32(x[0]), ...w32(x[1]));
            else if (type === 3 || type === 8) out.push(...w16(x & 0xFFFF));
            else if (type === 4 || type === 9) out.push(...w32(x >>> 0));
            else out.push(x & 255);
        }
        return { cnt: arr.length, bytes: out };
    };
    const ifds = [{ k: 'ifd0', e: ifd0.slice() }];
    if (exif.length) { ifds.push({ k: 'exif', e: exif.slice() }); ifd0.length; ifds[0].e.push([0x8769, 4, 'PTR:exif']); }
    if (gps.length) { ifds.push({ k: 'gps', e: gps.slice() }); ifds[0].e.push([0x8825, 4, 'PTR:gps']); }
    if (thumb) ifds.push({ k: 'ifd1', e: [[0x201, 4, 'THUMB'], [0x202, 4, thumb.length]] });
    const offs = {}; let pos = 8;
    for (const f of ifds) { f.e.sort((a, b) => a[0] - b[0]); offs[f.k] = pos; pos += 2 + 12 * f.e.length + 4; }
    const data = []; const dataStart = pos;
    const alloc = (bytes) => { const o = dataStart + data.length; data.push(...bytes); if (bytes.length & 1) data.push(0); return o; };
    const head = [le ? 0x49 : 0x4D, le ? 0x49 : 0x4D, ...w16(42), ...w32(8)], body = [];
    for (const f of ifds) {
        body.push(...w16(f.e.length));
        for (const [tag, type, v] of f.e) {
            let cnt, bytes;
            if (typeof v === 'string' && v.startsWith('PTR:')) { cnt = 1; bytes = w32(offs[v.slice(4)]); }
            else if (v === 'THUMB') { cnt = 1; bytes = null; }
            else ({ cnt, bytes } = vbytes(type, v));
            let val;
            if (bytes === null) val = w32(alloc(Array.from(thumb)));
            else if (cnt * TS[type] <= 4) val = [...bytes, 0, 0, 0, 0].slice(0, 4);
            else val = w32(alloc(bytes));
            body.push(...w16(tag), ...w16(type), ...w32(cnt), ...val);
        }
        body.push(...w32(f.k === 'ifd0' && thumb ? offs.ifd1 : 0));
    }
    return Uint8Array.from([...head, ...body, ...data]);
}

const seg = (marker, payload) => Uint8Array.from([0xFF, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]);
const str = (s) => [...Buffer.from(s, 'latin1')];
const exifSeg = (tiff) => seg(0xE1, [...str('Exif\0\0'), ...tiff]);
const cat = (...p) => { const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };

// 常用的「手機照片」EXIF：相機、方向 6、拍攝時間、曝光、GPS（台北 101 附近）、縮圖
function samplePhotoTiff(le = true, over = {}) {
    return buildTiff({
        le,
        ifd0: [[0x10F, 2, 'Canon'], [0x110, 2, 'Canon EOS R5'], [0x112, 3, 6], [0x131, 2, 'Firmware 1.2'], [0x13B, 2, 'Alice'], ...(over.ifd0 || [])],
        exif: [[0x829A, 5, [[1, 250]]], [0x829D, 5, [[28, 10]]], [0x8827, 3, 400], [0x9003, 2, '2024:05:06 14:30:15'], [0x920A, 5, [[85, 1]]], [0xA405, 3, 85], [0xA431, 2, 'SN12345'], [0xA434, 2, 'RF85mm F1.2L'], ...(over.exif || [])],
        gps: over.gps || [[1, 2, 'N'], [2, 5, [[25, 1], [1, 1], [4800, 100]]], [3, 2, 'E'], [4, 5, [[121, 1], [33, 1], [3600, 100]]], [5, 1, 0], [6, 5, [[100, 1]]]],
        thumb: over.thumb === undefined ? Uint8Array.from([0xFF, 0xD8, ...Array(60).fill(7), 0xFF, 0xD9]) : over.thumb,
    });
}
const SCAN = Uint8Array.from([0xFF, 0xDA, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0, 0x12, 0x34, 0xFF, 0x00, 0x56, 0xFF, 0xD9]); // 假的 SOS + 資料 + EOI
function buildJpeg({ tiff, xmp = true, icc = true, iptc = true, comment = true, jfif = true, extraApp = true } = {}) {
    const parts = [Uint8Array.of(0xFF, 0xD8)];
    if (jfif) parts.push(seg(0xE0, [...str('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]));
    if (tiff) parts.push(exifSeg(tiff));
    if (xmp) parts.push(seg(0xE1, [...str('http://ns.adobe.com/xap/1.0/\0'), ...Buffer.from(typeof xmp === 'string' ? xmp : '<x:xmpmeta/>', 'utf8')]));
    if (icc) parts.push(seg(0xE2, [...str('ICC_PROFILE\0'), 1, 1, ...Array(20).fill(9)]));
    if (iptc) parts.push(seg(0xED, [...str('Photoshop 3.0\0'), ...str('8BIM'), 4, 4, 0, 0, 0, 0, 0, 4, 1, 2, 3, 4]));
    if (extraApp) parts.push(seg(0xEB, str('JUMBF-ish')));
    if (comment) parts.push(seg(0xFE, str('shot by someone')));
    parts.push(seg(0xDB, [0, ...Array(64).fill(8)]), SCAN);
    return cat(...parts);
}

const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const pngChunk = (type, data) => { const t = Uint8Array.from(str(type)), d = Uint8Array.from(data), len = d.length, c = crc32(cat(t, d)); return cat(Uint8Array.of(len >>> 24, len >> 16 & 255, len >> 8 & 255, len & 255), t, d, Uint8Array.of(c >>> 24, c >> 16 & 255, c >> 8 & 255, c & 255)); };
function buildPng({ tiff, text = true, xmp } = {}) {
    const parts = [Uint8Array.of(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A), pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])];
    if (tiff) parts.push(pngChunk('eXIf', tiff));
    if (text) parts.push(pngChunk('tEXt', [...str('Software\0GIMP 2.10')]), pngChunk('iTXt', [...str('XML:com.adobe.xmp\0'), 0, 0, 0, 0, ...Buffer.from(typeof xmp === 'string' ? xmp : '<xmp/>', 'utf8')]), pngChunk('tIME', [7, 232, 5, 6, 14, 30, 15]));
    parts.push(pngChunk('IDAT', [0x78, 1, 1, 4, 0, 0xFB, 0xFF, 0, 1, 2, 3, 0, 0x0D, 0, 0x4C]), pngChunk('IEND', []));
    return cat(...parts);
}

const riff = (id, data) => { const d = Uint8Array.from(data), n = d.length; return cat(Uint8Array.from([...str(id), n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24]), d, n & 1 ? Uint8Array.of(0) : new Uint8Array(0)); };
function buildWebp({ tiff, exifPrefix = false, xmp = true, icc = false } = {}) {
    const flags = (tiff ? 0x08 : 0) | (xmp ? 0x04 : 0) | (icc ? 0x20 : 0);
    const chunks = [riff('VP8X', [flags, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]), ...(icc ? [riff('ICCP', Array(10).fill(3))] : []), riff('VP8 ', Array(20).fill(5))];
    if (tiff) chunks.push(riff('EXIF', exifPrefix ? [...str('Exif\0\0'), ...tiff] : [...tiff]));
    if (xmp) chunks.push(riff('XMP ', typeof xmp === 'string' ? [...Buffer.from(xmp, 'utf8')] : str('<x:xmpmeta/>!')));
    const body = cat(Uint8Array.from(str('WEBP')), ...chunks), n = body.length;
    return cat(Uint8Array.from([...str('RIFF'), n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24]), body);
}

module.exports = { pngChunk, buildTiff, samplePhotoTiff, buildJpeg, buildPng, buildWebp, exifSeg, seg, cat, str, SCAN };
