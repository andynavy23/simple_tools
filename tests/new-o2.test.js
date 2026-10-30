// o2 批次：image-edit 純邏輯（CRC32 / ZIP / 切格 / 4×6 排版 / 貼圖檢查 / 簽名外框）與 image-resize HEIC 偵測
const { load } = require('./_load');
const assert = require('assert');
{
    const E = load('utils/image-edit.html', 'crc32, zipStore, gridCells, squareRect, coverRect, sheetLayout, mmToPx, checkSticker, inkBounds, fitSize');
    assert.strictEqual(E.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
    assert.strictEqual(E.crc32(new Uint8Array(0)), 0);
    const z = Buffer.from(E.zipStore([{ name: '圖.png', data: new Uint8Array([1, 2, 3]) }, { name: 'b.txt', data: new TextEncoder().encode('hello') }]));
    assert.strictEqual(z.readUInt32LE(0), 0x04034b50); assert.strictEqual(z.readUInt16LE(8), 0);
    assert.strictEqual(z.readUInt32LE(14), E.crc32(new Uint8Array([1, 2, 3])));
    assert.strictEqual(z.readUInt16LE(z.length - 22 + 10), 2); assert.strictEqual(z.readUInt32LE(z.length - 22), 0x06054b50);
    // 切格：鋪滿、無縫、編號
    let g = E.gridCells(100, 100, 3, 3); assert.strictEqual(g.length, 9);
    assert.strictEqual(g.reduce((s, c) => s + c.w * c.h, 0), 10000);
    assert.deepStrictEqual([g[0].n, g[8].n, g[4].x, g[4].y], [1, 9, 33, 33]);
    assert.strictEqual(E.gridCells(10, 5, 1, 1)[0].w, 10);
    assert.deepStrictEqual({ ...E.squareRect(300, 200) }, { x: 50, y: 0, w: 200, h: 200 });
    const c = E.coverRect(400, 200, 100, 100); assert.deepStrictEqual([c.sx, c.sy, c.sw, c.sh], [100, 0, 200, 200]);
    assert.strictEqual(E.coverRect(400, 200, 100, 100, 2).sw, 100);
    assert.strictEqual(E.coverRect(400, 200, 100, 100, 1, -1).sx, 0);
    // 4×6：2 吋 35×45 間距 2 邊界 3 → 旋轉 8 張；1 吋 28×35 → 12 張
    let L = E.sheetLayout(35, 45, 2, 3); assert.deepStrictEqual([L.count, L.cols, L.rows, L.rot], [8, 2, 4, true]);
    L = E.sheetLayout(28, 35, 2, 3); assert.deepStrictEqual([L.count, L.rot], [12, false]);
    assert.strictEqual(E.sheetLayout(200, 200, 0, 0).count, 0);
    assert.strictEqual(E.mmToPx(101.6), 1200); assert.strictEqual(E.mmToPx(152.4), 1800);
    // 貼圖檢查
    const spec = { maxW: 370, maxH: 320, maxKB: 1024, even: true, png: true, alpha: true };
    assert.ok(E.checkSticker({ w: 370, h: 320, type: 'image/png', bytes: 5000, alpha: true }, spec).every(r => r.ok));
    const bad = E.checkSticker({ w: 371, h: 321, type: 'image/jpeg', bytes: 2e6, alpha: false }, spec);
    assert.strictEqual(bad.filter(r => !r.ok).length, 5);
    assert.strictEqual(E.checkSticker({ w: 10, h: 10, type: 'image/png', bytes: 1024 * 1024, alpha: true }, spec).every(r => r.ok), true);
    assert.strictEqual(E.checkSticker({ w: 10, h: 10, type: 'image/png', bytes: 1024 * 1024 + 1, alpha: true }, spec)[2].ok, false);
    // 簽名外框
    assert.strictEqual(E.inkBounds([], 5, 100, 100), null);
    assert.deepStrictEqual({ ...E.inkBounds([{ x: 10, y: 20 }, { x: 30, y: 40 }], 5, 100, 100) }, { x: 5, y: 15, w: 30, h: 30 });
    assert.deepStrictEqual({ ...E.inkBounds([{ x: 1, y: 1 }], 50, 100, 80) }, { x: 0, y: 0, w: 51, h: 51 });
    assert.deepStrictEqual({ ...E.fitSize(8000, 4000) }, { w: 4000, h: 2000 });
}
{
    const R = load('utils/image-resize.html', 'isHeic');
    assert.ok(R.isHeic({ type: 'image/heic', name: 'a' })); assert.ok(R.isHeic({ type: '', name: 'IMG_1.HEIC' })); assert.ok(R.isHeic({ name: 'x.heif' }));
    assert.ok(!R.isHeic({ type: 'image/jpeg', name: 'a.jpg' }));
}
