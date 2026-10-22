// 測試用：極簡 PDF 結構檢查（xref 偏移、物件數、頁面 MediaBox、串流長度）。不依賴任何函式庫。
const assert = require('assert');
function parsePdf(buf) {
    const b = Buffer.from(buf), t = b.toString('latin1');
    assert.ok(t.startsWith('%PDF-1.'), '沒有 PDF 檔頭'); assert.ok(t.trimEnd().endsWith('%%EOF'), '沒有 %%EOF');
    const sx = /startxref\n(\d+)\n%%EOF\n?$/.exec(t); assert.ok(sx, '沒有 startxref');
    const xo = +sx[1]; assert.equal(t.slice(xo, xo + 5), 'xref\n', 'startxref 沒有指到 xref');
    const m = /^xref\n0 (\d+)\n/.exec(t.slice(xo)); assert.ok(m); const size = +m[1];
    let p = xo + m[0].length; const entries = [];
    for (let i = 0; i < size; i++) { const e = t.slice(p, p + 20); assert.match(e, /^\d{10} \d{5} [nf] \n$/, 'xref 條目格式錯誤'); entries.push({ off: +e.slice(0, 10), gen: +e.slice(11, 16), type: e[17] }); p += 20; }
    assert.equal(entries[0].type, 'f'); assert.ok(t.slice(p).startsWith('trailer\n'));
    assert.equal(+/\/Size (\d+)/.exec(t.slice(p))[1], size); assert.equal(+/\/Root (\d+) 0 R/.exec(t.slice(p))[1], 1);
    const objs = {};
    for (let n = 1; n < size; n++) {
        const o = entries[n]; assert.equal(o.type, 'n'); assert.equal(t.slice(o.off, o.off + (n + ' 0 obj\n').length), n + ' 0 obj\n', `xref 偏移錯誤：物件 ${n}`);
        const end = t.indexOf('endobj\n', o.off); assert.ok(end > o.off); objs[n] = t.slice(o.off, end);
    }
    const pagesObj = objs[2], count = +/\/Count (\d+)/.exec(pagesObj)[1], kids = [...pagesObj.matchAll(/(\d+) 0 R/g)].map(x => +x[1]);
    assert.equal(kids.length, count); assert.ok(/\/Type \/Catalog \/Pages 2 0 R/.test(objs[1]));
    const pages = kids.map(k => {
        const o = objs[k]; assert.ok(/\/Type \/Page /.test(o)); assert.ok(/\/Parent 2 0 R/.test(o));
        const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(o), cn = +/\/Contents (\d+) 0 R/.exec(o)[1], im = +/\/Im0 (\d+) 0 R/.exec(o)[1];
        const c = objs[cn], cl = +/\/Length (\d+)/.exec(c)[1], cs = c.slice(c.indexOf('stream\n') + 7, c.indexOf('endstream')); assert.equal(cs.length, cl, '內容串流長度不符');
        const io = entries[im].off, head = t.slice(io, t.indexOf('stream\n', io)), il = +/\/Length (\d+)/.exec(head)[1], ds = t.indexOf('stream\n', io) + 7;
        assert.equal(t.slice(ds + il, ds + il + 18), '\nendstream\nendobj\n', '圖片串流長度不符');
        assert.ok(/\/Filter \/DCTDecode/.test(head));
        const cm = /^q ([\d.-]+) 0 0 ([\d.-]+) ([\d.-]+) ([\d.-]+) cm\n\/Im0 Do\nQ\n$/.exec(cs); assert.ok(cm, '內容串流格式錯誤');
        return { w: +mb[1], h: +mb[2], iw: +/\/Width (\d+)/.exec(head)[1], ih: +/\/Height (\d+)/.exec(head)[1], place: { w: +cm[1], h: +cm[2], x: +cm[3], y: +cm[4] }, jpeg: b.subarray(ds, ds + il) };
    });
    return { size, objCount: size - 1, pages };
}
module.exports = { parsePdf };
