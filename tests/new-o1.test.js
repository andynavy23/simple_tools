// 批次 o1：圖片特效工坊（像素運算、ASCII、EXIF 日期、漸層）與色彩工具的 k-means 主色
const { load, ok, near } = require('./_load');
const assert = require('assert');

const m = load('utils/image-fx.html', 'sizeOk, fit, gray, posterize, KERNELS, convolve, blurPasses, adjust, FILMS, film, sobelMag, sketch, RAMPS, asciiArt, exifDate, parseDate, fmtStamp, gradLine, hslHex, randomGradient, addNoise, gradSizeOk, coverRect');
const px = (r, g, b, n = 1) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([r, g, b, 255], i * 4); return a; };

// 像素上限 / 縮放
assert.ok(m.sizeOk(5000, 10000)); assert.ok(!m.sizeOk(5001, 10000)); assert.ok(!m.sizeOk(0, 5));
assert.deepEqual(m.fit(4000, 2000, 2000), { w: 2000, h: 1000 }); assert.deepEqual(m.fit(100, 50, 2000), { w: 100, h: 50 });

// 灰階公式（Rec.601）
near(m.gray(255, 0, 0), 76.245); near(m.gray(0, 255, 0), 149.685); near(m.gray(0, 0, 255), 29.07); near(m.gray(255, 255, 255), 255);

// Posterize：2 階只剩 0 / 255；4 階 = 0 / 85 / 170 / 255；已量化的值不變
let d = new Uint8ClampedArray([100, 200, 127, 255, 128, 0, 255, 77]); m.posterize(d, 2);
assert.deepEqual([...d], [0, 255, 0, 255, 255, 0, 255, 77]);
d = new Uint8ClampedArray([100, 200, 255, 255, 30, 130, 215, 255]); m.posterize(d, 4);
assert.deepEqual([...d], [85, 170, 255, 255, 0, 170, 255, 255]);
const lv = new Set(); d = new Uint8ClampedArray(256 * 4); for (let i = 0; i < 256; i++) d.set([i, i, i, 255], i * 4); m.posterize(d, 8);
for (let i = 0; i < 256; i++) lv.add(d[i * 4]); assert.equal(lv.size, 8);

// 卷積核：單位核不變；平坦區域經模糊 / 銳化不變；邊緣核在平坦區為 0；銳化會放大階梯邊緣
const w = 5, h = 1, step = new Uint8ClampedArray(w * 4);
[0, 0, 0, 255, 255].forEach((v, i) => step.set([v, v, v, 255], i * 4));
assert.deepEqual([...m.convolve(step, w, h, m.KERNELS.id)], [...step]);
const flat = px(100, 100, 100, 9);
for (const k of ['blur', 'sharpen']) assert.deepEqual([...m.convolve(flat, 3, 3, m.KERNELS[k])], [...flat]);
assert.equal(m.convolve(flat, 3, 3, m.KERNELS.edge)[16], 0);
near(m.KERNELS.blur.reduce((a, b) => a + b), 1); assert.equal(m.KERNELS.sharpen.reduce((a, b) => a + b), 1);
const sh = m.convolve(step, w, 1, m.KERNELS.sharpen); assert.equal(sh[2 * 4], 0); assert.equal(sh[3 * 4], 255);   // 1 列圖：上下取最近像素，等於水平 [-1,3,-1]
assert.equal(m.convolve(step, w, 1, m.KERNELS.blur)[2 * 4], Math.round(0 * 0.25 + 0 * 0.5 + 255 * 0.25));
// 模糊：平坦不變、階梯變平滑
d = px(50, 60, 70, 16); m.blurPasses(d, 4, 4, 3); assert.deepEqual([...d.slice(0, 4)], [50, 60, 70, 255]);
d = new Uint8ClampedArray(w * 4); step.forEach((v, i) => d[i] = v); m.blurPasses(d, w, 1, 1); assert.ok(d[2 * 4] > 0 && d[2 * 4] < 255);

// 濾鏡調整
d = new Uint8ClampedArray([10, 120, 240, 255, 200, 50, 90, 255]); const orig = [...d];
m.adjust(d, 2, 1, {}); assert.deepEqual([...d], orig);                         // 預設值 = 原圖（色相矩陣 0° = 單位矩陣）
d = px(255, 0, 0); m.adjust(d, 1, 1, { gray: 100 }); assert.equal(d[0], 76); assert.equal(d[0], d[1]); assert.equal(d[1], d[2]);
d = px(100, 100, 100); m.adjust(d, 1, 1, { bri: 100 }); assert.equal(d[0], 255);
d = px(100, 100, 100); m.adjust(d, 1, 1, { bri: -100 }); assert.equal(d[0], 0);
d = px(200, 100, 50); m.adjust(d, 1, 1, { sat: -100 }); assert.equal(d[0], d[1]); assert.equal(d[1], d[2]);
d = px(255, 0, 0); m.adjust(d, 1, 1, { hue: 120 }); assert.ok(d[1] > d[0] && d[1] > d[2], '紅色轉 120° 應偏綠');
d = px(100, 100, 100); m.adjust(d, 1, 1, { con: 100 }); assert.ok(d[0] < 100); d = px(160, 160, 160); m.adjust(d, 1, 1, { con: 100 }); assert.ok(d[0] > 160);

// 底片：強度 0 不變；固定種子可重現；暈邊四角比中心暗；黑白預設三色版相等
const mk = () => { const a = px(128, 128, 128, 25 * 25); return a; };
d = mk(); m.film(d, 25, 25, m.FILMS.warm, { amt: 0 }); assert.deepEqual([...d], [...mk()]);
const f1 = mk(), f2 = mk(); m.film(f1, 25, 25, m.FILMS.warm, { seed: 7 }); m.film(f2, 25, 25, m.FILMS.warm, { seed: 7 }); assert.deepEqual([...f1], [...f2]);
const v = mk(); m.film(v, 25, 25, m.FILMS.faded, { grain: 0, vig: 100 }); assert.ok(v[0] > v[(0) * 4] - 1 && v[12 * 25 * 4 + 12 * 4] > v[0] + 20, '中心應比角落亮');
const bw = mk(); m.film(bw, 25, 25, m.FILMS.bw, {}); for (let i = 0; i < bw.length; i += 4) assert.ok(bw[i] === bw[i + 1] && bw[i + 1] === bw[i + 2]);
assert.ok(Object.keys(m.FILMS).length >= 5);

// 素描：平坦區 = 白紙；階梯邊緣出現深線
const SW = 12, SH = 12, big = new Uint8ClampedArray(SW * SH * 4);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) big.set(x < 6 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * SW + x) * 4);
m.sketch(big, SW, SH, { gain: 200, soft: 2 });
assert.equal(big[0], 255); assert.equal(big[(6 * SW + 11) * 4], 255);
let min = 255; for (let y = 0; y < SH; y++) for (let x = 4; x < 8; x++) min = Math.min(min, big[(y * SW + x) * 4]); assert.ok(min < 200, '邊緣應有線條');
const g2 = px(90, 90, 90, 16); m.sketch(g2, 4, 4, {}); assert.ok([...g2].every((x, i) => i % 4 === 3 ? x === 255 : x === 255));
const mag = m.sobelMag(Float32Array.from([0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255]), 4, 3); assert.equal(mag[0], 0); assert.ok(mag[1] > 0 && mag[2] > 0);

// ASCII：全白 = 空白、全黑 = 最深字元；反相相反；列數依字元高寬比 2:1；方塊字元集
let a = m.asciiArt(px(255, 255, 255, 400), 20, 20, 10, m.RAMPS.simple);
assert.equal(a, (' '.repeat(10) + '\n').repeat(5));
a = m.asciiArt(px(0, 0, 0, 400), 20, 20, 10, m.RAMPS.simple); assert.equal(a, ('@'.repeat(10) + '\n').repeat(5));
assert.equal(m.asciiArt(px(0, 0, 0, 400), 20, 20, 10, m.RAMPS.simple, true), (' '.repeat(10) + '\n').repeat(5));
assert.ok(m.asciiArt(px(0, 0, 0, 400), 20, 20, 4, m.RAMPS.block).startsWith('████\n'));
const half = new Uint8ClampedArray(20 * 20 * 4); for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) half.set(x < 10 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * 20 + x) * 4);
assert.equal(m.asciiArt(half, 20, 20, 2, m.RAMPS.simple).split('\n')[0], '@ ');

// EXIF 日期：自行組一個最小 JPEG（IFD0 → ExifIFD → 0x9003）
const str = '2024:05:03 14:22:10\0', tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x69, 0x87, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0x03, 0x90, 2, 0, 20, 0, 0, 0, 44, 0, 0, 0, 0, 0, 0, 0, ...Buffer.from(str, 'latin1')];
const app1 = [...Buffer.from('Exif\0\0', 'latin1'), ...tiff], len = app1.length + 2;
const jpg = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, len >> 8, len & 255, ...app1, 0xFF, 0xD9]);
assert.equal(m.exifDate(jpg), '2024:05:03 14:22:10');
assert.equal(m.exifDate(jpg.slice(0, 40)), '');                                  // 截斷：不丟例外
assert.equal(m.exifDate(Uint8Array.from([1, 2, 3])), ''); assert.equal(m.exifDate(new Uint8Array(0)), '');
const bad = jpg.slice(); bad[bad.length - 22] = 0x30; bad.fill(0x30, bad.length - 22, bad.length - 12);   // 日期壞掉（0000...）
assert.equal(m.exifDate(bad), '');
assert.deepEqual(m.parseDate('2024:05:03 14:22:10'), { y: 2024, m: 5, d: 3 });
assert.deepEqual(m.parseDate('2024-5-3'), { y: 2024, m: 5, d: 3 });
assert.deepEqual(m.parseDate('2024/02/29'), { y: 2024, m: 2, d: 29 });
for (const s of ['2023/02/29', '0000:00:00 00:00:00', '2024-13-01', 'abc', '', null, '1800-01-01']) assert.equal(m.parseDate(s), null, String(s));
const D = { y: 2024, m: 5, d: 3 };
assert.equal(m.fmtStamp(D, 'dot'), '2024.05.03'); assert.equal(m.fmtStamp(D, 'slash'), '2024/05/03'); assert.equal(m.fmtStamp(D, 'short'), "'24 05 03"); assert.equal(m.fmtStamp(D, 'cn'), '2024年5月3日');

// 漸層
let L = m.gradLine(100, 50, 90); near(L.x0, 0); near(L.x1, 100); near(L.y0, 25); near(L.y1, 25);
L = m.gradLine(100, 50, 180); near(L.y0, 0); near(L.y1, 50); near(L.x0, 50);
L = m.gradLine(100, 100, 135); near(L.x0, 0, 1e-9); near(L.y0, 0, 1e-9); near(L.x1, 100); near(L.y1, 100);
assert.equal(m.hslHex(0, 100, 50), '#ff0000'); assert.equal(m.hslHex(120, 100, 50), '#00ff00'); assert.equal(m.hslHex(240, 100, 50), '#0000ff'); assert.equal(m.hslHex(0, 0, 100), '#ffffff'); assert.equal(m.hslHex(-120, 100, 50), '#0000ff');
const rg = m.randomGradient(5); assert.deepEqual(rg, m.randomGradient(5)); assert.notDeepEqual(rg, m.randomGradient(6));
for (const k of ['c1', 'c2', 'c3']) assert.ok(/^#[0-9a-f]{6}$/.test(rg[k]));
assert.ok(rg.angle >= 0 && rg.angle < 360);
d = px(100, 100, 100, 50); m.addNoise(d, 0); assert.deepEqual([...d], [...px(100, 100, 100, 50)]);
const n1 = px(100, 100, 100, 50), n2 = px(100, 100, 100, 50); m.addNoise(n1, 20, 3); m.addNoise(n2, 20, 3); assert.deepEqual([...n1], [...n2]); assert.notDeepEqual([...n1], [...px(100, 100, 100, 50)]);
assert.ok(m.gradSizeOk(1170, 2532)); assert.ok(m.gradSizeOk(3840, 2160)); assert.ok(!m.gradSizeOk(8000, 8000)); assert.ok(!m.gradSizeOk(10, 500)); assert.ok(!m.gradSizeOk(1.5, 500)); assert.ok(!m.gradSizeOk(NaN, 500));
assert.deepEqual(m.coverRect(200, 100, 100, 100), { sx: 50, sy: 0, sw: 100, sh: 100 });
assert.deepEqual(m.coverRect(100, 200, 50, 50), { sx: 0, sy: 50, sw: 100, sh: 100 });
ok('image-fx: pixel ops, ascii, exif date, gradient');

// 色彩工具：k-means 主色
const k = load('utils/color-tools.html', 'kmeans, toHex');
const img = new Uint8ClampedArray(100 * 4);
for (let i = 0; i < 100; i++) img.set(i < 75 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
const c2 = k.kmeans(img, 2, 1);
assert.deepEqual(c2.map(c => k.toHex(c)), ['#ff0000', '#0000ff']); near(c2[0].share, 0.75); near(c2[1].share, 0.25);
assert.deepEqual(k.kmeans(img, 2, 1), c2);                                       // 固定種子：可重現
const tri = new Uint8ClampedArray(90 * 4);
for (let i = 0; i < 90; i++) tri.set(i < 40 ? [250, 10, 10, 255] : i < 70 ? [10, 250, 10, 255] : [10, 10, 250, 255], i * 4);
const c3 = k.kmeans(tri, 3, 42); assert.equal(c3.length, 3); assert.deepEqual(c3.map(c => k.toHex(c)), ['#fa0a0a', '#0afa0a', '#0a0afa']);
for (const seed of [1, 2, 3, 99]) assert.deepEqual(k.kmeans(tri, 3, seed).map(c => k.toHex(c)).sort(), ['#0a0afa', '#0afa0a', '#fa0a0a']);
assert.equal(k.kmeans(img, 5, 1).length <= 2, true);                              // 只有 2 種顏色：不會產生空群
const one = k.kmeans(new Uint8ClampedArray([9, 9, 9, 255, 9, 9, 9, 255]), 4, 1); assert.equal(one.length, 1); near(one[0].share, 1);
assert.deepEqual(k.kmeans(new Uint8ClampedArray(0), 3, 1), []);
assert.deepEqual(k.kmeans(new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 10]), 3, 1), []);   // 透明像素略過
near(c3.reduce((s, c) => s + c.share, 0), 1);
ok('color-tools: kmeans dominant colors');
