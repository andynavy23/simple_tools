// 批次 o3：art-studio（像素填色 / 鏡像 / 對稱 / 詞頻 / 碰撞排版 / 種子決定性 / GIF LZW）
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('fun/art-studio.html', 'PAL, encGrid, decGrid, floodFill, mirrorPts, lineCells, symPts, normPixel, normFlip, lzwEncode, gifEncode, wordFreq, layoutCloud, genArt, MAX_PIX, MAX_FLIP, MAX_FRAMES');

{ // 填色
    const g = new Uint8Array(16); // 4x4，中間一道牆 x=2
    for (let y = 0; y < 4; y++) g[y * 4 + 2] = 1;
    assert.equal(m.floodFill(g, 4, 4, 0, 0, 5), 8);
    assert.equal(g[3], 0); assert.equal(g[0], 5); assert.equal(g[2], 1);
    assert.equal(m.floodFill(g, 4, 4, 0, 0, 5), 0);
    assert.equal(m.floodFill(g, 4, 4, 9, 9, 5), 0);
    const s = m.encGrid(g); assert.deepEqual([...m.decGrid(s, 4, 4)], [...g]);
    assert.equal(m.decGrid('zz', 1, 2), null); assert.equal(m.decGrid('00', 2, 2), null);
}
{ // 鏡像 / 線 / 對稱
    assert.deepEqual(m.mirrorPts(1, 2, 8, 8, 'none'), [[1, 2]]);
    assert.deepEqual(m.mirrorPts(1, 2, 8, 8, 'h'), [[1, 2], [6, 2]]);
    assert.deepEqual(m.mirrorPts(1, 2, 8, 8, 'both'), [[1, 2], [6, 2], [1, 5], [6, 5]]);
    assert.equal(m.mirrorPts(3, 3, 7, 7, 'both').length, 1);
    assert.deepEqual(m.lineCells(0, 0, 3, 1), [[0, 0], [1, 0], [2, 1], [3, 1]]);
    assert.deepEqual(m.lineCells(2, 2, 2, 2), [[2, 2]]);
    const p = m.symPts(10, 0, 0, 0, 4, false);
    [[10, 0], [0, 10], [-10, 0], [0, -10]].forEach((e, i) => { assert.ok(Math.abs(p[i][0] - e[0]) < 1e-9 && Math.abs(p[i][1] - e[1]) < 1e-9); });
    const q = m.symPts(10, 5, 0, 0, 3, true); assert.equal(q.length, 6); assert.ok(Math.abs(q[1][0] + 10) < 1e-9 && Math.abs(q[1][1] - 5) < 1e-9);
    assert.deepEqual(m.symPts(1, 1, 1, 1, 6, false).map(a => a.map(Math.round)), Array(6).fill([1, 1]));
}
{ // 讀取驗證
    assert.deepEqual(m.normPixel(null), []); assert.deepEqual(m.normPixel({ items: 5 }), []);
    const good = { id: 'a', name: 'x', w: 8, h: 8, d: '0'.repeat(64) };
    const r = m.normPixel({ items: [null, 3, { w: 8, h: 8, d: 'x' }, { w: 7, h: 7, d: '0'.repeat(49) }, good] }); assert.equal(r.length, 1);
    assert.equal(m.normPixel({ items: Array(50).fill(good) }).length, m.MAX_PIX);
    const fg = { id: 'f', w: 16, h: 16, fps: 99, frames: Array(80).fill('0'.repeat(256)).concat(['bad']) };
    const f = m.normFlip({ items: [fg, { w: 16, h: 16, frames: [] }, { w: 16, h: 16, frames: 'x' }, null] });
    assert.equal(f.length, 1); assert.equal(f[0].frames.length, m.MAX_FRAMES); assert.equal(f[0].fps, 24);
    assert.equal(m.normFlip({ items: Array(20).fill(fg) }).length, m.MAX_FLIP);
}
// GIF：LZW 已知向量（GIF89a 規格說明常用 10x10 範例，最小碼長 2）
const rowA = [1,1,1,1,1,2,2,2,2,2], rowB = [1,1,1,0,0,0,0,2,2,2], rowC = [2,2,2,0,0,0,0,1,1,1], rowD = [2,2,2,2,2,1,1,1,1,1];
const img = [...rowA, ...rowA, ...rowA, ...rowB, ...rowB, ...rowC, ...rowC, ...rowD, ...rowD, ...rowD];
assert.deepEqual(m.lzwEncode(img, 2), [0x8C,0x2D,0x99,0x87,0x2A,0x1C,0xDC,0x33,0xA0,0x02,0x75,0xEC,0x95,0xFA,0xA8,0xDE,0x60,0x8C,0x04,0x91,0x4C,0x01]);
{ // 回環：自寫解碼器，含超過 4096 項的清表
    const dec = (bytes, min) => {
        const clear = 1 << min, eoi = clear + 1; let pos = 0, buf = 0, nb = 0, size = min + 1, tab, prev = null; const out = [];
        const reset = () => { tab = []; for (let i = 0; i < clear; i++) tab.push([i]); tab.push(null, null); size = min + 1; prev = null; };
        reset();
        for (; ;) {
            while (nb < size) { if (pos >= bytes.length) throw new Error('eof'); buf |= bytes[pos++] << nb; nb += 8; }
            const c = buf & ((1 << size) - 1); buf >>>= size; nb -= size;
            if (c === clear) { reset(); continue; } if (c === eoi) return out;
            let e; if (c < tab.length) e = tab[c]; else if (prev) e = prev.concat(prev[0]); else throw new Error('bad');
            out.push(...e);
            if (prev && tab.length < 4096) { tab.push(prev.concat(e[0])); }
            prev = e;
            if (tab.length === (1 << size) && size < 12) size++;
        }
    };
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const big = Array.from({ length: 30000 }, () => Math.floor(rnd() * 16));
    assert.deepEqual(dec(m.lzwEncode(big, 4), 4), big);
    const flat = new Array(5000).fill(3); assert.deepEqual(dec(m.lzwEncode(flat, 4), 4), flat);
    assert.deepEqual(dec(m.lzwEncode([7], 4), 4), [7]);
    const gif = m.gifEncode([Uint8Array.from(img), Uint8Array.from(img)], 10, 10, m.PAL, 10);
    assert.equal(String.fromCharCode(...gif.slice(0, 6)), 'GIF89a'); assert.equal(gif[gif.length - 1], 0x3b);
    assert.equal(gif[6], 10); assert.equal(gif[8], 10);
}
{ // 詞頻
    const f = m.wordFreq('The cat and the dog. Cat cat!', {});
    assert.deepEqual(f, [['cat', 3], ['dog', 1]]);
    const c = m.wordFreq('我愛程式我愛畫畫', { cjk: 1, stop: true }); assert.deepEqual(c[0], ['愛', 2]); assert.ok(!c.some(x => x[0] === '我'));
    const b = m.wordFreq('程式設計好玩，程式設計很好', { cjk: 2 }); assert.ok(b.some(x => x[0] === '程式' && x[1] === 2)); assert.ok(b.every(x => x[1] > 1));
    assert.deepEqual(m.wordFreq('', {}), []); assert.deepEqual(m.wordFreq('123 !!!', {}), []);
    assert.equal(m.wordFreq('a1 b2 cc dd ee ff', { top: 2 }).length, 2);
}
{ // 碰撞排版
    const words = Array.from({ length: 40 }, (_, i) => ['w' + 'x'.repeat(i % 6) + i, 40 - i]);
    const measure = (w, s) => w.length * s * 0.6;
    const { placed, skipped } = m.layoutCloud(words, 800, 600, measure);
    assert.ok(placed.length > 20); assert.equal(placed.length + skipped.length, 40);
    for (const p of placed) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.bw <= 800 && p.y + p.bh <= 600);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        assert.ok(a.x + a.bw <= b.x || b.x + b.bw <= a.x || a.y + a.bh <= b.y || b.y + b.bh <= a.y, 'overlap ' + a.w + ' ' + b.w);
    }
    assert.ok(placed[0].s >= placed[placed.length - 1].s);
    assert.deepEqual(m.layoutCloud(words, 800, 600, measure), { placed, skipped });
    const tiny = m.layoutCloud([['超長超長超長超長', 5]], 20, 20, measure); assert.equal(tiny.skipped.length, 1);
    assert.deepEqual(m.layoutCloud([], 100, 100, measure), { placed: [], skipped: [] });
}
{ // 種子決定性
    for (const k of ['circles', 'tri', 'noise', 'rings']) {
        const a = m.genArt('abc', k), b = m.genArt('abc', k), c = m.genArt('abd', k);
        assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.ok(a.items.length > 0);
    }
    const n = m.genArt('s', 'noise').items[0]; assert.equal(n.d.length, 64 * 64); assert.ok(n.d.every(v => v >= 0 && v <= 7));
}
ok('art-studio 純邏輯');
