// 批次 v3：個人清單（書籤 + 帳號盤點）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/my-lists.html', 'ML, normUrl, dupKey, findDup, parseTags, normBM, normBMList, addBM, updateBM, mergeBM, removeBM, filterBM, sortBM, tagCounts, parseBookmarksHtml, toBookmarksHtml, importBM, looksLikePassword, normAccList, addAcc, updateAcc, removeAcc, riskOf, filterAcc, sortAcc, statsAcc');
const { ML, normUrl, dupKey, findDup, normBM, normBMList, addBM, updateBM, mergeBM, removeBM, filterBM, sortBM, parseBookmarksHtml, toBookmarksHtml, importBM, looksLikePassword, normAccList, addAcc, updateAcc, removeAcc, riskOf, filterAcc, sortAcc, statsAcc } = m;

{ // 網址
    assert.equal(normUrl('example.com/a'), 'https://example.com/a');
    assert.equal(normUrl('  http://a.com '), 'http://a.com/');
    assert.equal(normUrl('localhost:3000/x'), 'https://localhost:3000/x');
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.c', 'ftp://a.com', 'file:///c:/x', '//evil.com', '', 'a b.com', 'http://u:p@a.com']) assert.equal(normUrl(bad), null, bad);
    assert.equal(dupKey('http://www.Example.com/a/?utm_source=x&b=2&a=1#h'), dupKey('https://example.com/a?a=1&b=2'));
    assert.notEqual(dupKey('https://example.com/a'), dupKey('https://example.com/b'));
    assert.equal(dupKey('javascript:x'), '');
    ok('v3 lists: url');
}
{ // 書籤增刪改、重複、上限
    let r = addBM([], { url: 'a.com', title: '', tags: '工作, 工作, 教學', note: '' }, 'i1', '2026-01-01');
    assert.equal(r.err, ''); assert.equal(r.list[0].title, 'a.com'); assert.deepEqual(r.list[0].tags, ['工作', '教學']);
    const d = addBM(r.list, { url: 'https://www.a.com/', title: 'x', tags: '新', note: 'n' }, 'i2');
    assert.equal(d.dup.id, 'i1');
    const mg = mergeBM(r.list, 'i1', { tags: '新', note: 'n' });
    assert.deepEqual(mg[0].tags, ['工作', '教學', '新']); assert.equal(mg[0].note, 'n');
    assert.ok(addBM([], { url: 'javascript:alert(1)' }).err);
    assert.ok(addBM([], { url: 'a.com', title: 'x'.repeat(201) }).err);
    let l = addBM(r.list, { url: 'b.com', title: 'B' }, 'i3', '2026-02-01').list;
    assert.equal(updateBM(l, 'i3', { url: 'a.com' }).err.length > 0, true);
    assert.equal(updateBM(l, 'i3', { url: 'b.com/2', title: 'B2' }).list[1].added, '2026-02-01');
    assert.deepEqual(removeBM(l, 'i1').map(x => x.id), ['i3']);
    const full = Array.from({ length: ML.BM_MAX }, (_, i) => ({ id: 'k' + i, url: `https://x${i}.com/`, title: 't', tags: [], note: '', added: '2026-01-01' }));
    assert.ok(addBM(full, { url: 'new.com' }).err);
    assert.equal(normBMList(null).length, 0);
    assert.equal(normBMList([null, 5, { url: 'javascript:alert(1)' }, { id: 'a', url: 'a.com', tags: 5 }, { id: 'a', url: 'b.com' }]).length, 1);
    assert.equal(normBMList(full.concat(full.map(x => ({ ...x, id: x.id + 'z' })))).length, ML.BM_MAX);
    ok('v3 lists: bookmarks crud');
}
{ // 搜尋與排序
    const L = [normBM({ id: 'a', url: 'a.com', title: 'Alpha', tags: ['x'], note: '好用', added: '2026-01-01' }), normBM({ id: 'b', url: 'b.com', title: 'Beta', tags: ['y'], added: '2026-03-01' })];
    assert.deepEqual(filterBM(L, 'alpha', '').map(x => x.id), ['a']);
    assert.deepEqual(filterBM(L, '好用 a.com', '').map(x => x.id), ['a']);
    assert.deepEqual(filterBM(L, 'b.com', 'y').map(x => x.id), ['b']);
    assert.deepEqual(filterBM(L, '', 'y').map(x => x.id), ['b']);
    assert.deepEqual(sortBM(L, 'date').map(x => x.id), ['b', 'a']);
    assert.deepEqual(sortBM(L, 'title').map(x => x.id), ['a', 'b']);
    ok('v3 lists: search sort');
}
{ // 書籤 HTML：往返、資料夾、容錯、截斷
    const L = [normBM({ id: 'a', url: 'https://a.com/?q=1&r=2', title: 'A <b> & "q"', tags: ['工作', 't2'], added: '2026-05-06' }), normBM({ id: 'b', url: 'b.com', title: 'B', added: '2026-05-07' })];
    const p = parseBookmarksHtml(toBookmarksHtml(L));
    assert.equal(p.items.length, 2); assert.equal(p.items[0].title, 'A <b> & "q"'); assert.equal(p.items[0].url, L[0].url);
    assert.deepEqual(p.items[0].tags, ['工作', 't2']); assert.equal(p.items[0].added, '2026-05-06');
    const chrome = `<DL><p><DT><H3 ADD_DATE="1">書籤列</H3><DL><p><DT><H3>新聞</H3><DL><p><DT><A HREF="https://n.com/" ADD_DATE="1700000000">N&amp;N</A></DL><p><DT><A HREF="javascript:alert(1)">bad</A><DT><A HREF='http://z.com' TAGS="a,b">Z<script>alert(1)</script></A></DL><p><DT><A HREF="https://root.com">R</A></DL>`;
    const c = parseBookmarksHtml(chrome);
    assert.equal(c.items.length, 3); assert.equal(c.skipped, 1);
    assert.deepEqual(c.items[0].tags, ['書籤列', '新聞']); assert.equal(c.items[0].title, 'N&N');
    assert.deepEqual(c.items[1].tags, ['書籤列', 'a', 'b']); assert.deepEqual(c.items[2].tags, []);
    assert.equal(c.items[0].added, '2023-11-15');
    assert.equal(parseBookmarksHtml('<A HREF="https://x.com"').items.length, 0);
    assert.equal(parseBookmarksHtml(null).items.length, 0);
    const big = Array.from({ length: 2005 }, (_, i) => `<DT><A HREF="https://s${i}.com/">t</A>`).join('');
    const bp = parseBookmarksHtml(big); assert.equal(bp.items.length, 2000); assert.equal(bp.truncated, true);
    const im = importBM(L, p); assert.equal(im.added, 0); assert.equal(im.merged, 2);
    const im2 = importBM([], c); assert.equal(im2.added, 3);
    ok('v3 lists: bookmark html');
}
{ // 密碼偵測
    for (const s of ['my password is 123', '密碼：abc', '備援碼 1234', 'Recovery Code', 'aB3dE5gH7jK9mN2pQ', '1234-5678-9012', 'abcd efgh ijkl 1234']) assert.ok(looksLikePassword(s), s);
    for (const s of ['', 'me@example.com', 'averyveryveryverylongname@example.com', 'andy.navy', '我的主要信箱', 'Google', 'abcdefghijklmnopqrstu']) assert.ok(!looksLikePassword(s), s);
    ok('v3 lists: password guard');
}
{ // 帳號：風險、篩選、增刪
    const T = '2026-11-16';
    const mk = (o) => ({ id: o.name, tfa: 'none', backup: 'na', cat: '其他', checked: '2026-11-01', acct: '', note: '', ...o });
    const A = normAccList([mk({ name: 'bank', cat: '金融' }), mk({ name: 'old', tfa: 'app', backup: 'no', checked: '2026-01-01' }), mk({ name: 'fine', tfa: 'key', backup: 'yes' }), mk({ name: 'nodate', checked: '' }), mk({ name: 'edge', tfa: 'sms', checked: '2026-05-20' })]);
    assert.equal(riskOf(A[0], T).level, 'bad');
    assert.equal(riskOf(A[1], T).level, 'warn'); assert.ok(riskOf(A[1], T).noBackup);
    assert.equal(riskOf(A[2], T).level, 'ok');
    assert.equal(riskOf(A[3], T).level, 'warn');
    assert.equal(riskOf(A[4], T).level, 'ok');   // 180 天整不算超過
    assert.deepEqual(sortAcc(A, T).map(x => x.name), ['bank', 'nodate', 'old', 'edge', 'fine']);
    assert.deepEqual(statsAcc(A, T), { count: 5, noTfa: 2 + 0, finNo: 1, stale: 2, noBackup: 1 });
    assert.deepEqual(filterAcc(A, '', '金融', '', T).map(x => x.name), ['bank']);
    assert.deepEqual(filterAcc(A, '', '', 'warn', T).map(x => x.name).sort(), ['nodate', 'old']);
    assert.deepEqual(filterAcc(A, 'FINE', '', '', T).map(x => x.name), ['fine']);
    assert.ok(addAcc([], { name: 'x', acct: 'my password' }).err);
    assert.ok(addAcc([], { name: '' }).err);
    assert.ok(addAcc([], { name: 'x', checked: '2026-13-40' }).err);
    let r = addAcc([], { name: 'G', acct: 'me@g.com', cat: '雲端', tfa: 'app', backup: 'yes', checked: T }, 'g1'); assert.equal(r.err, '');
    assert.equal(updateAcc(r.list, 'g1', { name: 'G2', tfa: 'bogus' }).list[0].tfa, 'none');
    assert.ok(updateAcc(r.list, 'zz', { name: 'G2' }).err);
    assert.deepEqual(removeAcc(r.list, 'g1'), []);
    const full = Array.from({ length: ML.AC_MAX }, (_, i) => ({ id: 'a' + i, name: 'n' + i }));
    assert.ok(addAcc(normAccList(full), { name: 'more' }).err);
    assert.equal(normAccList('x').length, 0); assert.equal(normAccList([null, 3, { name: '' }, { name: 'ok', cat: 'zz', tfa: null }])[0].cat, '其他');
    ok('v3 lists: accounts');
}
