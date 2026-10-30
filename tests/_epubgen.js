// 測試用：在記憶體建出最小 EPUB（mimetype 用 STORE，其餘 DEFLATE；不放二進位檔進 repo）
const zlib = require('zlib');
function buildZip(files) {          // files: [{name, data(string|Buffer), store?}]
    const loc = [], cen = []; let off = 0;
    for (const f of files) {
        const name = Buffer.from(f.name), raw = Buffer.from(f.data), body = f.store ? raw : zlib.deflateRawSync(raw);
        const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(f.store ? 0 : 8, 8);
        h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
        const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(f.store ? 0 : 8, 10);
        c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
        loc.push(h, name, body); cen.push(c, name); off += 30 + name.length + body.length;
    }
    const cd = Buffer.concat(cen), e = Buffer.alloc(22);
    e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
    return Buffer.concat([...loc, cd, e]);
}
function buildEpub({ title = '測試書', chapters = 3, nav = 'ncx' } = {}) {
    const ch = (i) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c${i}</title><script>window.hacked=1</script><link rel="stylesheet" href="http://x/y.css"/></head><body onload="window.hacked=1"><h1>第${i}章標題</h1><p>內文 ${i}</p><img src="http://evil/x.png"/><a href="http://evil">連結</a>${"<p>長段落</p>".repeat(80)}</body></html>`;
    const n = Array.from({ length: chapters }, (_, i) => i + 1);
    const files = [
        { name: 'mimetype', data: 'application/epub+zip', store: true },
        { name: 'META-INF/container.xml', data: '<container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
        { name: 'OEBPS/content.opf', data: `<package><metadata><dc:title>${title}</dc:title></metadata><manifest>${nav === 'ncx' ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '<item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>'}${n.map(i => `<item id="c${i}" href="text/c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine${nav === 'ncx' ? ' toc="ncx"' : ''}>${n.map(i => `<itemref idref="c${i}"/>`).join('')}</spine></package>` },
        nav === 'ncx'
            ? { name: 'OEBPS/toc.ncx', data: `<ncx><navMap>${n.map(i => `<navPoint id="n${i}"><navLabel><text>目錄${i}</text></navLabel><content src="text/c${i}.xhtml"/></navPoint>`).join('')}</navMap></ncx>` }
            : { name: 'OEBPS/nav.xhtml', data: `<html><body><nav epub:type="toc"><ol>${n.map(i => `<li><a href="text/c${i}.xhtml#x">導覽${i}</a></li>`).join('')}</ol></nav></body></html>` },
        ...n.map(i => ({ name: `OEBPS/text/c${i}.xhtml`, data: ch(i) })),
    ];
    return buildZip(files);
}
module.exports = { buildZip, buildEpub };
