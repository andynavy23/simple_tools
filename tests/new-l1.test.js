// 批次 l1：外語速查擴充（新主題資料完整性）
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- lang-ref ----------
    const m = load('utils/lang-ref.html', 'TOPICS, CATS, searchTopics, checkData, parseRow, rowLang');
    assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
    for (const c of ['其他語言', '中文與公文']) assert.ok(m.CATS.includes(c) && m.TOPICS.some(t => t.cat === c), c);
    for (const id of ['ja-greet', 'ja-particles', 'ja-patterns', 'ja-ime', 'ko-particles', 'ko-greet', 'en-patterns', 'en-numbers', 'en-datetime', 'en-selfintro', 'en-interview', 'en-call', 'en-email', 'en-resume', 'en-academic', 'en-taiglish', 'en-phonics', 'fr-greet', 'vi-basic', 'id-basic', 'nan-basic', 'hak-basic', 'zh-punct', 'zh-official', 'x-intro-name'])
        assert.ok(m.TOPICS.some(t => t.id === id), id);
    // 新增檢查會抓到：缺關鍵字、langs 長度不符、空字串列
    const base = { id: 'a', cat: '日文', title: 'x', kw: 'k', rows: ['y ~~ z'] };
    assert.deepEqual(m.checkData([base], m.CATS), []);
    assert.equal(m.checkData([{ ...base, kw: '' }], m.CATS).length, 1);
    assert.equal(m.checkData([{ ...base, langs: ['en-US', 'ja-JP'] }], m.CATS).length, 1);
    assert.equal(m.checkData([{ ...base, rows: [' ~~ z'] }], m.CATS).length, 1);
    // 逐列語言
    assert.equal(m.rowLang({ lang: 'ja-JP' }, 3), 'ja-JP');
    assert.equal(m.rowLang({ lang: 'ja-JP', langs: ['en-US'] }, 0), 'en-US');
    assert.equal(m.rowLang({}, 0), '');
    const x = m.TOPICS.find(t => t.id === 'x-intro-name'); assert.equal(x.langs.length, x.rows.length);
    // 搜尋
    assert.ok(m.searchTopics(m.TOPICS, 'STAR').some(r => r.t.id === 'en-interview'));
    assert.ok(m.searchTopics(m.TOPICS, '公文').some(r => r.t.id === 'zh-official'));
    assert.ok(m.searchTopics(m.TOPICS, '廁所').length >= 4);
    // 英文與旅行新卡每列都有說明
    assert.ok(m.TOPICS.filter(t => /^(en-|trip-en-)/.test(t.id)).every(t => t.rows.every(r => m.parseRow(r).desc)));
    ok('lang-ref l1: new topics integrity');
}
