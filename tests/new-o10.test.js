// 批次 o10：EPUB 閱讀器（ZIP / OPF / 目錄）、卡片盒筆記（連結 / 反向連結 / 改名 / 刪除）、RSVP 分段
const { load, ok } = require('./_load');
const assert = require('assert');
const { buildEpub } = require('./_epubgen');

const e = load('reading/epub-reader.html', 'zipEntries, zipRead, rootfilePath, parseOpf, parseNcx, parseNav, resolvePath, buildToc, validProg, pruneProg');
const text = async (z, en, n) => new TextDecoder().decode(await e.zipRead(z, en.find(x => x.name === n)));
const epub = (async () => {
    const z = new Uint8Array(buildEpub({ chapters: 3 })), en = e.zipEntries(z);
    assert.equal(en.find(x => x.name === 'mimetype').method, 0);
    assert.equal(en.find(x => x.name === 'OEBPS/content.opf').method, 8);
    assert.equal(await text(z, en, 'mimetype'), 'application/epub+zip');
    const opfPath = e.rootfilePath(await text(z, en, 'META-INF/container.xml'));
    assert.equal(opfPath, 'OEBPS/content.opf');
    const opf = e.parseOpf(await text(z, en, opfPath));
    assert.equal(opf.title, '測試書'); assert.deepEqual(opf.spine, ['c1', 'c2', 'c3']); assert.equal(opf.ncxId, 'ncx');
    const spine = opf.spine.map(id => e.resolvePath(opfPath, opf.manifest[id].href));
    assert.deepEqual(spine, ['OEBPS/text/c1.xhtml', 'OEBPS/text/c2.xhtml', 'OEBPS/text/c3.xhtml']);
    const ncx = e.parseNcx(await text(z, en, 'OEBPS/toc.ncx'));
    assert.deepEqual(ncx.map(x => x.label), ['目錄1', '目錄2', '目錄3']);
    assert.deepEqual(e.buildToc(spine, ncx, 'OEBPS/toc.ncx').map(x => x.idx), [0, 1, 2]);
    // EPUB3 nav
    const z3 = new Uint8Array(buildEpub({ nav: 'nav' })), en3 = e.zipEntries(z3);
    assert.equal(e.parseOpf(await text(z3, en3, 'OEBPS/content.opf')).navId, 'nav');
    const nv = e.parseNav(await text(z3, en3, 'OEBPS/nav.xhtml'));
    assert.deepEqual(nv.map(x => x.label), ['導覽1', '導覽2', '導覽3']);
    assert.deepEqual(e.buildToc(spine, nv, 'OEBPS/nav.xhtml').map(x => x.idx), [0, 1, 2]);
    // 無目錄 → 第 n 節
    assert.deepEqual(e.buildToc(spine, [], '').map(x => x.label), ['第 1 節', '第 2 節', '第 3 節']);
    assert.equal(e.resolvePath('OEBPS/toc.ncx', '../x/a%20b.html#f'), 'x/a b.html');
    // 壞檔
    assert.throws(() => e.zipEntries(new Uint8Array(10)), /不是有效/);
    assert.throws(() => e.zipEntries(new Uint8Array(100)), /找不到 ZIP/);
    await assert.rejects(e.zipRead(z, { ...en[0], flag: 1 }), /加密/);
    await assert.rejects(e.zipRead(z, { ...en[0], usize: 32e6 }), /太大/);
    await assert.rejects(e.zipRead(z, { ...en[0], off: 99999 }), /損壞/);
    // 進度驗證 / 修剪
    assert.deepEqual(e.validProg({ name: 'x', ch: 99, pos: 5, at: 1 }, 3), { name: 'x', ch: 0, pos: 1, at: 1 });
    assert.equal(e.validProg(null), null); assert.equal(e.validProg({ ch: 'a', pos: 'b' }).pos, 0);
    const many = Array.from({ length: 53 }, (_, i) => ({ key: 'k' + i, at: i }));
    assert.deepEqual(e.pruneProg(many).sort(), ['k0', 'k1', 'k2']); assert.deepEqual(e.pruneProg(many.slice(0, 50)), []);
    ok('epub-reader: zip / opf / toc / progress');
})();
require('./_load').pending.push(epub);

const z = load('utils/zettel.html', 'MAX_CARDS, MAX_BODY, parseLinks, parseTags, backlinks, addCard, editCard, deleteCard, validCards, exportMd, searchCards');
{
    assert.deepEqual(z.parseLinks('見 [[A]] 與 [[ b ]] 再 [[a]] 和 [[]]'), ['A', 'b']);
    assert.deepEqual(z.parseTags('#x, y  z、x'), ['x', 'y', 'z']);
    let c = [];
    for (const t of ['A', 'B', 'C']) c = z.addCard(c, { title: t, body: '', tags: [] }).cards;
    assert.ok(z.addCard(c, { title: 'a', body: '' }).err, '標題重複（不分大小寫）');
    assert.ok(z.addCard(c, { title: '', body: '' }).err);
    assert.ok(z.addCard(c, { title: 'D', body: 'x'.repeat(z.MAX_BODY + 1) }).err);
    assert.ok(z.addCard(Array.from({ length: z.MAX_CARDS }, (_, i) => ({ id: 'i' + i, title: 't' + i, body: '', tags: [], at: 0 })), { title: 'new', body: '' }).err);
    const [a, b] = c;
    c = z.editCard(c, b.id, { title: 'B', body: '連到 [[A]] 和 [[C]]', tags: ['t'] }).cards;
    c = z.editCard(c, c[2].id, { title: 'C', body: '回 [[a]]', tags: [] }).cards;
    assert.deepEqual(z.backlinks(c, a.id).map(x => x.title), ['B', 'C']);
    assert.deepEqual(z.backlinks(c, b.id), []);
    // 改名連帶更新連結；改成已存在的名稱被拒
    assert.ok(z.editCard(c, a.id, { title: 'b', body: '', tags: [] }).err);
    const r = z.editCard(c, a.id, { title: 'A2', body: '', tags: [] }).cards;
    assert.equal(r.find(x => x.id === b.id).body, '連到 [[A2]] 和 [[C]]');
    assert.equal(r.find(x => x.title === 'C').body, '回 [[A2]]');
    assert.deepEqual(z.backlinks(r, a.id).map(x => x.title), ['B', 'C']);
    // 刪除：連結還原成純文字
    const d = z.deleteCard(r, a.id);
    assert.equal(d.length, 2); assert.equal(d.find(x => x.title === 'B').body, '連到 A2 和 [[C]]');
    assert.equal(d.find(x => x.title === 'C').body, '回 A2');
    // 驗證
    const v = z.validCards([null, { id: 'x', title: 'T', body: 5, tags: 'no', at: 'n' }, { id: 'y', title: 't', body: 'ok' }, { title: '' }, 'str']);
    assert.deepEqual(v.map(x => x.title), ['T', 't (2)']); assert.equal(v[0].body, ''); assert.deepEqual(v[0].tags, []);
    assert.equal(z.validCards('bad').length, 0);
    assert.equal(z.validCards([{ id: 'a', title: 'x', body: 'y'.repeat(z.MAX_BODY + 5) }])[0].body.length, z.MAX_BODY);
    // 搜尋與匯出
    assert.deepEqual(z.searchCards(c, 'a', '').map(x => x.title).sort(), ['A', 'B', 'C']);
    assert.deepEqual(z.searchCards(c, '', 't').map(x => x.title), ['B']);
    const md = z.exportMd(c);
    assert.ok(md.includes('## B') && md.includes('#t') && md.includes('[[A]]') && md.includes('---'));
    ok('zettel: links / backlinks / rename / delete / validate / export');
}

const rv = load('reading/rsvp-reader.html', 'rsvpTokens');
{
    const t = rv.rsvpTokens('Hello world. This, is a test!', 3);
    assert.deepEqual(t.map(x => x.t), ['Hello', 'world.', 'This,', 'is', 'a', 'test!']);
    assert.ok(t[1].p > t[2].p && t[2].p > t[0].p);
    const c = rv.rsvpTokens('今天天氣很好，我們去公園散步。', 3);
    assert.deepEqual(c.map(x => x.t), ['今天天', '氣很好', '我們去', '公園散', '步']);
    assert.ok(c[1].p > 1 && c[4].p > c[1].p, '標點停頓');
    assert.deepEqual(rv.rsvpTokens('中文abc 中文', 2).map(x => x.t), ['中文', 'abc', '中文']);
    assert.deepEqual(rv.rsvpTokens('  \n ', 3), []);
    assert.equal(rv.rsvpTokens('一二三四五', 2).length, 3);
    ok('rsvp: tokens');
}
