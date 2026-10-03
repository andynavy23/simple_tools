// 批次 k2：exif-viewer 的 XMP / MakerNote、audio-recorder 的 pickMime / extFor
const assert = require('assert');
const { load, ok } = require('./_load');

{ // ---------- exif-viewer：XMP 與 MakerNote ----------
    const m = load('utils/exif-viewer.html', 'findXmp, parseXmp, makerInfo, analyze, stripMeta, MAX_XMP');
    const G = require('./_exifgen');
    const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" xmp:CreatorTool="Adobe Lightroom 13" xmp:CreateDate="2024-05-06T14:30:15" photoshop:City="Taipei" photoshop:Country='Taiwan' exif:GPSLatitude="25,1.5N" exif:GPSLongitude="121,33.6E">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">我的 &amp; 照片</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>Alice</rdf:li></rdf:Seq></dc:creator>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">(c) Alice</rdf:li></rdf:Alt></dc:rights>
<dc:subject><rdf:Bag><rdf:li>cat</rdf:li><rdf:li>貓</rdf:li></rdf:Bag></dc:subject>
<lr:hierarchicalSubject><rdf:Bag><rdf:li>動物|貓</rdf:li></rdf:Bag></lr:hierarchicalSubject>
</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    const rowsOf = (r) => Object.fromEntries(r.rows.map(x => [x[0], x[1]]));

    // parseXmp：欄位、屬性 / 元素兩種寫法、實體、隱私與位置旗標
    let r = m.parseXmp(XMP), o = rowsOf(r);
    assert.ok(r.ok); assert.strictEqual(o['標題'], '我的 & 照片'); assert.strictEqual(o['作者'], 'Alice'); assert.strictEqual(o['版權'], '(c) Alice');
    assert.strictEqual(o['建立工具'], 'Adobe Lightroom 13'); assert.strictEqual(o['城市'], 'Taipei'); assert.strictEqual(o['國家'], 'Taiwan');
    assert.strictEqual(o['GPS 緯度'], '25,1.5N'); assert.strictEqual(o['關鍵字'], 'cat、貓'); assert.strictEqual(o['階層關鍵字'], '動物|貓');
    assert.ok(r.loc && r.sens); assert.strictEqual(r.rows.find(x => x[0] === '作者')[2], true); assert.strictEqual(r.rows.find(x => x[0] === '標題')[2], false);
    r = m.parseXmp('<x:xmpmeta><rdf:RDF><rdf:Description xmp:CreatorTool="GIMP"/></rdf:RDF></x:xmpmeta>');
    assert.ok(r.ok && !r.loc && !r.sens && r.rows.length === 1);
    // 壞資料 / 空 / DOCTYPE / 超大
    assert.ok(!m.parseXmp('hello').ok && m.parseXmp('hello').warnings.length);
    assert.ok(!m.parseXmp('').ok); assert.ok(!m.parseXmp(null).ok);
    r = m.parseXmp('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x:xmpmeta><rdf:RDF><dc:creator><rdf:Seq><rdf:li>&a;</rdf:li></rdf:Seq></dc:creator></rdf:RDF></x:xmpmeta>');
    assert.ok(r.ok && r.warnings.some(w => w.includes('DOCTYPE')) && !JSON.stringify(r.rows).includes('passwd'));
    assert.ok(!m.parseXmp('<x:xmpmeta>' + 'a'.repeat(m.MAX_XMP)).ok);
    assert.doesNotThrow(() => m.parseXmp('<x:xmpmeta><rdf:RDF><dc:title><rdf:Alt><rdf:li>&#99999999999;</rdf:li></rdf:Alt></dc:title></rdf:RDF></x:xmpmeta>'));

    // findXmp：三種格式
    const tiff = G.samplePhotoTiff(true);
    const jpg = G.buildJpeg({ tiff, xmp: XMP }), png = G.buildPng({ xmp: XMP }), webp = G.buildWebp({ xmp: XMP });
    for (const [nm, f] of [['jpeg', jpg], ['png', png], ['webp', webp]]) {
        const x = m.findXmp(f); assert.ok(x && x.text.includes('Adobe Lightroom 13'), nm);
        const a = m.analyze(f); assert.strictEqual(a.format, nm); assert.ok(a.xmp && a.xmp.loc && a.xmp.rows.length >= 8, nm);
    }
    assert.strictEqual(m.findXmp(G.buildJpeg({ tiff, xmp: false })), null);
    assert.strictEqual(m.findXmp(Uint8Array.of(1, 2, 3)), null);
    // PNG 壓縮旗標 → 不解析
    const comp = G.buildPng({ xmp: 'x' }); const ix = Buffer.from(comp).indexOf('XML:com.adobe.xmp'); comp[ix + 18] = 1;
    // （CRC 不影響 pngChunks 解析）
    const cx = m.findXmp(comp); assert.ok(cx && cx.text === '' && cx.warnings.length);
    // 超過 1MB
    const big = G.buildWebp({ xmp: '<x:xmpmeta>' + 'a'.repeat(m.MAX_XMP + 10) }); const bx = m.findXmp(big);
    assert.ok(bx.text === '' && bx.warnings[0].includes('1MB'));
    assert.ok(m.analyze(big).xmp.rows.length === 0);
    // 截斷的 JPEG 不丟例外
    assert.doesNotThrow(() => m.analyze(jpg.subarray(0, 40)));

    // makerInfo
    const hdr = (s, n = 30) => [...Buffer.from(s, 'latin1'), ...Array(n).fill(1)];
    assert.strictEqual(m.makerInfo(hdr('Nikon\0\x02'), 'NIKON CORPORATION').brand, 'Nikon');
    assert.strictEqual(m.makerInfo(hdr('Apple iOS\0\x01'), 'Apple').brand, 'Apple（iOS）');
    assert.strictEqual(m.makerInfo(hdr('OLYMPUS\0II'), 'OLYMPUS').brand, 'Olympus');
    assert.strictEqual(m.makerInfo(hdr('SONY DSC \0\0\0'), 'SONY').brand, 'Sony');
    assert.ok(m.makerInfo(hdr('\x05\0'), 'Canon').brand.startsWith('Canon'));
    assert.ok(m.makerInfo(hdr('\x05\0'), 'Foo').brand.includes('Foo'));
    assert.strictEqual(m.makerInfo(hdr('\x05\0'), undefined).brand, '未知廠商');
    assert.strictEqual(m.makerInfo([], 'Canon'), null); assert.strictEqual(m.makerInfo(null, 'Canon'), null);
    assert.strictEqual(m.makerInfo(hdr('Nikon\0', 10)).size, 16);

    // analyze：MakerNote 與清除後驗證
    const mkTiff = G.samplePhotoTiff(true, { exif: [[0x927C, 7, hdr('Apple iOS\0', 40)]], ifd0: [] });
    const withMn = G.buildJpeg({ tiff: mkTiff, xmp: XMP });
    const a = m.analyze(withMn);
    assert.ok(a.maker, 'MakerNote 被辨識'); assert.strictEqual(a.maker.size, 50); assert.ok(a.maker.brand.startsWith('Apple'));
    assert.ok(a.rows.some(x => x[0] === 'MakerNote' && x[1].includes('不解碼')));
    assert.ok(a.xmp && a.xmp.rows.length);
    for (const [nm, f] of [['jpeg', withMn], ['png', G.buildPng({ tiff: mkTiff, xmp: XMP })], ['webp', G.buildWebp({ tiff: mkTiff, xmp: XMP })]]) {
        for (const keepOrientation of [false, true]) {
            const c = m.stripMeta(f, { keepOrientation }), b = m.analyze(c.bytes);
            assert.ok(!b.xmp, nm + ' 清除後無 XMP'); assert.ok(!b.maker, nm + ' 清除後無 MakerNote'); assert.ok(!b.gps, nm + ' 清除後無 GPS');
            assert.ok(!b.sections.some(s => s.kind === 'xmp' || s.kind === 'makernote'));
        }
    }
    ok('exif-viewer: XMP / MakerNote');
}

{ // ---------- audio-recorder：pickMime / extFor ----------
    const { pickMime, extFor } = load('utils/audio-recorder.html', 'pickMime, extFor');
    const only = (...ok) => (t) => ok.includes(t);
    assert.strictEqual(pickMime(only('audio/webm;codecs=opus', 'audio/webm')), 'audio/webm;codecs=opus');   // Chrome / Edge
    assert.strictEqual(pickMime(only('audio/webm')), 'audio/webm');
    assert.strictEqual(pickMime(only('audio/mp4')), 'audio/mp4');                                            // iOS Safari：只有不帶 codecs 的為 true
    assert.strictEqual(pickMime(t => t.startsWith('audio/mp4')), 'audio/mp4');
    assert.strictEqual(pickMime(only('audio/ogg;codecs=opus', 'audio/ogg')), 'audio/ogg;codecs=opus');
    assert.strictEqual(pickMime(only('audio/ogg')), 'audio/ogg');
    assert.strictEqual(pickMime(only('audio/mpeg')), 'audio/mpeg');
    assert.strictEqual(pickMime(only('audio/webm', 'audio/ogg')), 'audio/webm');                              // Firefox：webm 優先
    assert.strictEqual(pickMime(() => false), '');
    assert.strictEqual(pickMime(undefined), ''); assert.strictEqual(pickMime(null), ''); assert.strictEqual(pickMime('x'), '');
    assert.strictEqual(pickMime(() => { throw new Error('x'); }), '');
    assert.strictEqual(pickMime(only('audio/mp4')), 'audio/mp4'); assert.strictEqual(pickMime(() => 1), 'audio/webm;codecs=opus');
    for (const [t, e] of [['audio/mp4', 'm4a'], ['audio/mp4;codecs=mp4a.40.2', 'm4a'], ['audio/x-m4a', 'm4a'], ['audio/aac', 'm4a'], ['audio/ogg', 'ogg'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/webm', 'webm'], ['audio/webm;codecs=opus', 'webm'], ['audio/mpeg', 'mp3'], ['audio/wav', 'wav'], ['AUDIO/MP4', 'm4a'], ['', 'webm'], [undefined, 'webm'], ['video/webm', 'webm']]) assert.strictEqual(extFor(t), e, t);
    ok('audio-recorder: pickMime / extFor');
}
