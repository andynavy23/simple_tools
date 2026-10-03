// y2 批次：心情日記 / 書單追蹤 / 圖片浮水印拼貼 的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');
const zlib = require('zlib');

{ // 心情日記
    const m = load('fun/mood-journal.html', 'isDate, cleanTags, normEntry, cleanEntries, saveEntry, removeEntry, monthGrid, monthStats, tagImpact, streak, lastDays, search, exportText, MAX_ENTRIES');
    assert.ok(m.isDate('2024-02-29') && !m.isDate('2023-02-29') && !m.isDate('2024-13-01') && !m.isDate('2024-2-1') && !m.isDate(20240101));
    assert.deepStrictEqual(m.cleanTags([' 工作 ', '工作', '', 5, 'x'.repeat(13), '運動']), ['工作', '運動']);
    assert.strictEqual(m.cleanTags(Array.from({ length: 15 }, (_, i) => 't' + i)).length, 10);
    assert.strictEqual(m.normEntry({ date: '2024-01-01', mood: 6 }), null);
    assert.strictEqual(m.normEntry({ date: '2024-02-30', mood: 3 }), null);
    assert.deepStrictEqual(m.normEntry({ date: '2024-01-01', mood: '4', tags: 'bad' }), { date: '2024-01-01', mood: 4, tags: [], text: '' });
    ok('mood: 驗證');
    const e = (date, mood, tags = [], text = '') => ({ date, mood, tags, text });
    let l = m.cleanEntries([e('2024-03-02', 3), null, 'x', e('2024-03-01', 5), e('2024-03-02', 1), { date: 'bad', mood: 3 }]);
    assert.deepStrictEqual(l.map(x => x.date + ':' + x.mood), ['2024-03-01:5', '2024-03-02:1']);
    assert.deepStrictEqual(m.cleanEntries('壞'), []);
    // 上限：留最新
    const big = Array.from({ length: 3700 }, (_, i) => e(new Date(Date.UTC(2010, 0, 1) + i * 864e5).toISOString().slice(0, 10), 3));
    const cl = m.cleanEntries(big);
    assert.strictEqual(cl.length, m.MAX_ENTRIES); assert.strictEqual(cl[cl.length - 1].date, big[3699].date);
    ok('mood: 清單整理與上限');
    // 覆蓋 / 追加
    l = m.saveEntry([], e('2024-03-01', 4, ['工作'], 'a'));
    const rep = m.saveEntry(l, e('2024-03-01', 2, ['家人'], 'b'), false);
    assert.deepStrictEqual(rep, [e('2024-03-01', 2, ['家人'], 'b')]);
    const app = m.saveEntry(l, e('2024-03-01', 2, ['家人', '工作'], 'b'), true);
    assert.deepStrictEqual(app, [e('2024-03-01', 2, ['工作', '家人'], 'a\nb')]);
    assert.strictEqual(m.saveEntry(l, { date: 'x', mood: 3 }), null);
    assert.strictEqual(m.removeEntry(app, '2024-03-01').length, 0);
    ok('mood: 覆蓋與追加');
    // 月曆：2024-02 從週四開始、29 天
    const g = m.monthGrid(2024, 2);
    assert.strictEqual(g.length % 7, 0); assert.strictEqual(g.indexOf('2024-02-01'), 4); assert.strictEqual(g.filter(Boolean).length, 29); assert.strictEqual(m.monthGrid(2026, 2).length, 28);
    ok('mood: 月曆');
    // 統計（範例：4,3,5）
    const s = [e('2026-10-01', 4, ['運動']), e('2026-10-02', 3, ['工作']), e('2026-10-03', 5, ['運動']), e('2026-09-30', 1)];
    const ms = m.monthStats(s, 2026, 10); assert.strictEqual(ms.n, 3); near(ms.avg, 4);
    assert.strictEqual(m.monthStats(s, 2025, 1).avg, null);
    const ti = m.tagImpact(s), run = ti.find(t => t.tag === '運動');
    near(run.avg, 4.5); near(run.delta, 4.5 - (3 + 1) / 2); assert.strictEqual(ti[0].tag, '運動');
    assert.strictEqual(m.tagImpact([e('2026-10-01', 4, ['a'])])[0].delta, null);
    assert.strictEqual(m.streak(s, '2026-10-03'), 4); assert.strictEqual(m.streak(s, '2026-10-04'), 4); assert.strictEqual(m.streak(s, '2026-10-06'), 0);
    assert.strictEqual(m.streak(s.filter(x => x.date !== '2026-10-02'), '2026-10-03'), 1);
    const ld = m.lastDays(s, '2026-10-03'); assert.strictEqual(ld.length, 30); assert.strictEqual(ld[29].mood, 5); assert.strictEqual(ld[0].date, '2026-09-04'); assert.strictEqual(ld[26].mood, 1);
    ok('mood: 統計 / 連續 / 近 30 天');
    const sr = m.search([e('2026-10-01', 4, ['運動'], 'Hello 世界'), e('2026-10-02', 3, [], 'bye')], 'hello');
    assert.strictEqual(sr.length, 1); assert.strictEqual(m.search(s, '運動').length, 2); assert.strictEqual(m.search(s, '  ').length, 0);
    assert.strictEqual(m.search([e('2026-10-02', 3, [], 'x'), e('2026-10-05', 3, [], 'x')], 'x')[0].date, '2026-10-05');
    const txt = m.exportText([e('2026-10-01', 4, ['運動', '工作'], '好')], false), md = m.exportText([e('2026-10-01', 4, ['運動'], '好')], true);
    assert.ok(txt.includes('2026-10-01  🙂 4/5  [運動、工作]\n好')); assert.ok(md.startsWith('## 2026-10-01') && md.includes('- 標籤：運動') && md.includes('好'));
    ok('mood: 搜尋與匯出');
}

{ // 書單追蹤
    const m = load('fun/reading-list.html', 'cleanBook, cleanBooks, settle, applyProgress, progressPct, filterBooks, sortBooks, bookStats, exportMd, exportCsv, STATUS');
    const T = '2026-10-03';
    const b = (o) => m.cleanBook({ id: 'x', title: 'T', ...o });
    assert.strictEqual(m.cleanBook({ title: '  ' }), null); assert.strictEqual(m.cleanBook(null), null);
    let x = b({ total: 100, page: 500, status: 'zzz', rating: 9, start: '2026-02-30' });
    assert.deepStrictEqual([x.page, x.status, x.rating, x.start], [100, 'want', 5, '']);
    x = b({ total: '-5', page: 'abc' }); assert.deepStrictEqual([x.total, x.page], [0, 0]);
    const ids = m.cleanBooks([{ title: 'a', id: 'k' }, { title: 'b', id: 'k' }, { title: 'c' }, 7]);
    assert.strictEqual(ids.length, 3); assert.strictEqual(new Set(ids.map(i => i.id)).size, 3); assert.ok(ids.every(i => i.id));
    assert.deepStrictEqual(m.cleanBooks({}), []);
    ok('books: 驗證');
    // 狀態連動
    let r = m.applyProgress(b({ total: 120, page: 30, status: 'reading', start: '2026-01-01' }), 120, T);
    assert.deepStrictEqual([r.status, r.page, r.finish, r.start], ['done', 120, T, '2026-01-01']);
    r = m.applyProgress(b({ total: 120 }), 10, T); assert.deepStrictEqual([r.status, r.start, r.finish], ['reading', T, '']);
    r = m.applyProgress(b({ total: 120, page: 120, status: 'done', finish: '2026-05-05', start: '2026-05-01' }), 50, T); assert.deepStrictEqual([r.status, r.finish], ['reading', '']);
    r = m.applyProgress(b({ total: 0 }), 50, T); assert.deepStrictEqual([r.status, r.page], ['reading', 50]);
    r = m.applyProgress(b({ total: 100, status: 'paused' }), 100, T); assert.strictEqual(r.status, 'paused');
    r = m.applyProgress(b({ total: 100 }), 999, T); assert.deepStrictEqual([r.page, r.status], [100, 'done']);
    r = m.settle(b({ total: 50, page: 3, status: 'done' }), T); assert.deepStrictEqual([r.page, r.finish], [50, T]);
    ok('books: 進度連動');
    near(m.progressPct(b({ total: 120, page: 30 })), 25); assert.strictEqual(m.progressPct(b({ total: 0, status: 'done' })), 100); assert.strictEqual(m.progressPct(b({ total: 0, page: 5 })), 0);
    const books = [b({ id: 'a', title: 'Alpha', author: 'Zed', total: 100, page: 100, status: 'done', rating: 4, finish: '2026-03-01' }), b({ id: 'b', title: 'Beta', total: 200, page: 100, status: 'reading', review: '很棒' }),
    b({ id: 'c', title: 'Gamma', status: 'done', rating: 5, finish: '2025-12-31', total: 10, page: 10 }), b({ id: 'd', title: 'Delta' })];
    assert.deepStrictEqual(m.filterBooks(books, 'done', '').map(i => i.id), ['a', 'c']);
    assert.deepStrictEqual(m.filterBooks(books, 'all', 'zed').map(i => i.id), ['a']); assert.deepStrictEqual(m.filterBooks(books, 'all', '很棒').map(i => i.id), ['b']);
    assert.deepStrictEqual(m.sortBooks(books, 'added').map(i => i.id), ['d', 'c', 'b', 'a']);
    assert.deepStrictEqual(m.sortBooks(books, 'title').map(i => i.id), ['a', 'b', 'd', 'c']);
    assert.deepStrictEqual(m.sortBooks(books, 'rating').map(i => i.id), ['c', 'a', 'd', 'b']);
    assert.deepStrictEqual(m.sortBooks(books, 'progress').map(i => i.id), ['c', 'a', 'b', 'd']);
    assert.deepStrictEqual(m.sortBooks(books, 'finish').map(i => i.id).slice(0, 2), ['a', 'c']);
    ok('books: 篩選 / 排序');
    const st = m.bookStats(books, '2026'); assert.strictEqual(st.doneYear, 1); assert.strictEqual(st.done, 2); near(st.avgRating, 4.5); assert.strictEqual(st.rated, 2); assert.strictEqual(st.pages, 210);
    assert.strictEqual(m.bookStats([], '2026').avgRating, null);
    const md = m.exportMd(books); assert.ok(md.includes('## 在讀（1）') && md.includes('**Alpha** — Zed（100/100 頁，100%） ★★★★☆') && md.includes('> 很棒'));
    const csv = m.exportCsv([b({ title: 'A,"B"', review: '多行\n文字' })]);
    assert.ok(csv.startsWith('書名,作者,總頁數,目前頁數,狀態,評分,開始日期,完成日期,心得\r\n"A,""B""",')); assert.ok(csv.includes('"多行\n文字"'));
    ok('books: 統計與匯出');
}

{ // 圖片浮水印 / 拼貼
    const m = load('utils/image-mark.html', 'crc32, zipStore, uniqNames, fitSize, rotBox, anchorCenter, tileCenters, autoGrid, collageLayout, placeImage, contrast, cleanOpts');
    const enc = (s) => new TextEncoder().encode(s);
    assert.strictEqual(m.crc32(enc('123456789')), 0xCBF43926); assert.strictEqual(m.crc32(new Uint8Array(0)), 0); assert.strictEqual(m.crc32(enc('a')), 0xE8B7BE43);
    assert.strictEqual(m.crc32(enc('The quick brown fox jumps over the lazy dog')), 0x414FA339);
    if (zlib.crc32) { const d = Buffer.from('壞掉的資料\0\xff'.repeat(50)); assert.strictEqual(m.crc32(new Uint8Array(d)), zlib.crc32(d)); }
    ok('zip: crc32 已知值');
    // ZIP 結構：解析 local header / central directory / EOCD
    const files = [{ name: 'a.txt', data: enc('hello') }, { name: '中文.png', data: new Uint8Array([1, 2, 3, 250, 0, 9]) }, { name: 'empty', data: new Uint8Array(0) }];
    const z = m.zipStore(files, new Date(2024, 4, 6, 7, 8, 10)), dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
    const eo = z.length - 22; assert.strictEqual(dv.getUint32(eo, true), 0x06054b50); assert.strictEqual(dv.getUint16(eo + 10, true), 3);
    let cd = dv.getUint32(eo + 16, true), off = 0;
    assert.strictEqual(cd + dv.getUint32(eo + 12, true), eo);
    for (const f of files) {
        assert.strictEqual(dv.getUint32(off, true), 0x04034b50); assert.strictEqual(dv.getUint16(off + 6, true), 0x0800); assert.strictEqual(dv.getUint16(off + 8, true), 0);
        assert.strictEqual(dv.getUint16(off + 10, true), (7 << 11) | (8 << 5) | 5); assert.strictEqual(dv.getUint16(off + 12, true), (44 << 9) | (5 << 5) | 6);
        const crc = dv.getUint32(off + 14, true), cs = dv.getUint32(off + 18, true), us = dv.getUint32(off + 22, true), nl = dv.getUint16(off + 26, true);
        assert.strictEqual(cs, f.data.length); assert.strictEqual(us, f.data.length); assert.strictEqual(crc, m.crc32(f.data));
        assert.strictEqual(Buffer.from(z.subarray(off + 30, off + 30 + nl)).toString('utf8'), f.name);
        assert.deepStrictEqual([...z.subarray(off + 30 + nl, off + 30 + nl + cs)], [...f.data]);
        // central directory 對應項目
        assert.strictEqual(dv.getUint32(cd, true), 0x02014b50); assert.strictEqual(dv.getUint32(cd + 16, true), crc); assert.strictEqual(dv.getUint32(cd + 42, true), off);
        assert.strictEqual(dv.getUint16(cd + 28, true), nl);
        cd += 46 + nl; off += 30 + nl + cs;
    }
    assert.strictEqual(cd, eo);
    ok('zip: 檔頭 / 中央目錄 / EOCD 結構');
    // 用系統 python 的 zipfile 當外部驗證（沒有 python 就略過）
    try {
        const cp = require('child_process'), os = require('os'), fs = require('fs'), p = require('path').join(os.tmpdir(), 'y2-test.zip');
        fs.writeFileSync(p, z);
        const r = cp.spawnSync('python', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(ascii(z.namelist()));print(z.read("a.txt").decode())', p], { encoding: 'utf8', timeout: 8000 });
        fs.unlinkSync(p);
        if (!r.error && r.status === 0) { const [bad, names, a] = r.stdout.trim().split(/\r?\n/); assert.strictEqual(bad, 'None'); assert.strictEqual(names, String.raw`['a.txt', '\u4e2d\u6587.png', 'empty']`); assert.strictEqual(a, 'hello'); ok('zip: python zipfile 可讀取'); }
    } catch (e) { if (e.code === 'ERR_ASSERTION') throw e; }
    assert.deepStrictEqual(m.uniqNames(['a.png', 'a.png', 'b.png', 'a.png', 'x']), ['a.png', 'a-2.png', 'b.png', 'a-3.png', 'x']);
    assert.strictEqual(m.zipStore([]).length, 22);
    // 尺寸 / 位置
    assert.deepStrictEqual(m.fitSize(8000, 4000, 4096), { w: 4096, h: 2048 }); assert.deepStrictEqual(m.fitSize(800, 600, 4096), { w: 800, h: 600 }); assert.deepStrictEqual(m.fitSize(1, 10000, 100), { w: 1, h: 100 });
    const rb = m.rotBox(100, 20, 90); near(rb.w, 20); near(rb.h, 100); near(m.rotBox(100, 20, 0).w, 100); near(m.rotBox(100, 100, 45).w, 141.4213562, 1e-6);
    assert.deepStrictEqual(m.anchorCenter(0, 1000, 500, 100, 50, 10), { x: 60, y: 35 }); assert.deepStrictEqual(m.anchorCenter(4, 1000, 500, 100, 50, 10), { x: 500, y: 250 });
    assert.deepStrictEqual(m.anchorCenter(8, 1000, 500, 100, 50, 10), { x: 940, y: 465 }); assert.deepStrictEqual(m.anchorCenter(2, 1000, 500, 100, 50, 10), { x: 940, y: 35 });
    const tc = m.tileCenters(100, 100, 40, 20, 10); assert.ok(tc.length === 10 && tc.every(p => p.x + 20 > 0 && p.x - 20 < 100 && p.y - 10 < 100)); assert.notStrictEqual(tc[0].x, tc.find(p => p.y > tc[0].y).x);
    assert.ok(m.tileCenters(100000, 100000, 1, 1, 0).length <= 5000);
    ok('image: 尺寸與位置');
    // 拼貼
    assert.deepStrictEqual(m.autoGrid(2), { cols: 2, rows: 1 }); assert.deepStrictEqual(m.autoGrid(5), { cols: 3, rows: 2 }); assert.deepStrictEqual(m.autoGrid(9), { cols: 3, rows: 3 });
    const L = m.collageLayout({ cols: 2, rows: 2, width: 1000, gapPct: 2, max: 4096 });
    assert.strictEqual(L.W, 1000); assert.strictEqual(L.H, 1000); assert.strictEqual(L.cells.length, 4); assert.deepStrictEqual(L.cells[0], { x: 20, y: 20, w: 470, h: 470 }); assert.deepStrictEqual(L.cells[3], { x: 510, y: 510, w: 470, h: 470 });
    const L2 = m.collageLayout({ cols: 1, rows: 3, width: 2000, gapPct: 0, max: 2000 }); assert.strictEqual(L2.H, 2000); assert.strictEqual(L2.W, 667);
    const L3 = m.collageLayout({ cols: 3, rows: 3, width: 4096, gapPct: 10, max: 4096 }); assert.ok(L3.W <= 4096 && L3.H <= 4096); assert.ok(L3.cells.every(c => c.x >= 0 && c.x + c.w <= L3.W && c.y + c.h <= L3.H));
    const cell = { x: 10, y: 20, w: 100, h: 100 };
    const fill = m.placeImage(400, 200, cell, 'fill'); assert.deepStrictEqual([fill.sx, fill.sy, fill.sw, fill.sh, fill.dx, fill.dy, fill.dw, fill.dh], [100, 0, 200, 200, 10, 20, 100, 100]);
    const fit = m.placeImage(400, 200, cell, 'fit'); assert.deepStrictEqual([fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh], [400, 200, 10, 45, 100, 50]);
    ok('image: 拼貼版面');
    assert.strictEqual(m.contrast('#ffffff'), '#000000'); assert.strictEqual(m.contrast('#000000'), '#ffffff');
    const d = m.cleanOpts(null); assert.deepStrictEqual([d.mode, d.size, d.max, d.format, d.tile], ['mark', 8, 2048, 'png', false]);
    const c = m.cleanOpts({ mode: 'collage', size: 999, color: 'red', opacity: '', rotate: '45', cols: 9, max: '4096', tile: 'yes', text: 5, fit: 'fit', format: 'jpeg', quality: 1 });
    assert.deepStrictEqual([c.mode, c.size, c.color, c.opacity, c.rotate, c.cols, c.max, c.tile, c.text, c.fit, c.format, c.quality], ['collage', 30, '#ffffff', 60, 45, 3, 4096, false, '© 我的圖片', 'fit', 'jpeg', 50]);
    assert.strictEqual(m.cleanOpts({ max: 9999 }).max, 2048);
    ok('image: 設定驗證');
}
