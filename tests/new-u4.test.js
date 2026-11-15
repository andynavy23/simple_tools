// 批次 u4：看板與時間區塊（plan-board）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/plan-board.html', 'cleanBoards, newBoard, moveTo, shiftCard, stepCol, moveColumn, removeCol, isOverdue, kanbanMd, toMin, toHM, cellRange, validBlock, overlapWith, putBlock, cleanDay, freeGaps, catTotals, dragBlock, cleanCfg, cleanTpl, icsEscape, icsFold, icsStamp, buildIcs, dayText, pruneKeys, isDate');
const K = (id, col, extra) => ({ id, col, title: 't' + id, note: '', color: -1, due: '', ...extra });

{ // 載入驗證
    assert.deepEqual(m.cleanBoards(null), { boards: [], cur: '' });
    const r = m.cleanBoards({ boards: [null, 5, { name: 'x'.repeat(50), cols: [{ id: 'a', name: '' }, { id: 'a' }], cards: [{ id: 'k', col: 'zz', title: ' hi ', note: 'n'.repeat(2000), color: 9, due: '2025-02-30' }, { title: '' }, null] }], cur: 'nope' });
    assert.strictEqual(r.boards.length, 1);
    const b = r.boards[0];
    assert.strictEqual(b.name.length, 20); assert.strictEqual(b.cols.length, 2); assert.notStrictEqual(b.cols[0].id, b.cols[1].id);
    assert.deepEqual([b.cards.length, b.cards[0].title, b.cards[0].note.length, b.cards[0].color, b.cards[0].due, b.cards[0].col], [1, 'hi', 1000, -1, '', 'a']);
    assert.strictEqual(r.cur, b.id);
    const many = { boards: Array.from({ length: 15 }, () => ({ cols: Array.from({ length: 12 }, () => ({})), cards: Array.from({ length: 400 }, (_, i) => ({ title: 'c' + i })) })) };
    const c = m.cleanBoards(many); assert.strictEqual(c.boards.length, 10); assert.strictEqual(c.boards[0].cols.length, 8); assert.strictEqual(c.boards[0].cards.length, 300);
    assert.strictEqual(m.cleanBoards({ boards: [{ cols: 'x' }] }).boards[0].cols.length, 3);
}
{ // 卡片移動 / 排序
    const cols = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    let cards = [K(1, 'a'), K(2, 'b'), K(3, 'a'), K(4, 'a')];
    cards = m.shiftCard(cards, 3, -1); assert.deepEqual(cards.map(c => c.id), [3, 2, 1, 4]);
    assert.strictEqual(m.shiftCard(cards, 3, -1), cards);   // 已在最上
    cards = m.shiftCard(cards, 1, 1); assert.deepEqual(cards.filter(c => c.col === 'a').map(c => c.id), [3, 4, 1]);
    cards = m.stepCol(cols, cards, 3, 1); assert.strictEqual(cards.find(c => c.id === 3).col, 'b'); assert.strictEqual(cards[cards.length - 1].id, 3);
    assert.strictEqual(m.stepCol(cols, cards, 3, -1).find(c => c.id === 3).col, 'a');
    assert.strictEqual(m.stepCol(cols, m.stepCol(cols, cards, 3, 1), 3, 1).find(c => c.id === 3).col, 'c');
    assert.strictEqual(m.stepCol(cols, cards, 99, 1), cards);
    const mv = m.moveTo(cards, 4, 'b', 2); assert.deepEqual(mv.filter(c => c.col === 'b').map(c => c.id), [4, 2, 3]);
    assert.strictEqual(m.moveTo(cards, 4, 'b', 4), cards);
    assert.deepEqual(m.moveColumn(cols, 'a', 1).map(c => c.id), ['b', 'a', 'c']); assert.strictEqual(m.moveColumn(cols, 'a', -1), cols);
}
{ // 刪欄
    const b = { cols: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], cards: [K(1, 'a'), K(2, 'b')] };
    assert.deepEqual(m.removeCol(b, 'b', 'move').cards.map(c => c.col), ['a', 'a']);
    assert.deepEqual(m.removeCol(b, 'a', 'move').cards.map(c => c.col), ['b', 'b']);
    assert.deepEqual(m.removeCol(b, 'b', 'drop').cards.map(c => c.id), [1]);
    const one = { cols: [{ id: 'a' }], cards: [K(1, 'a')] }; assert.strictEqual(m.removeCol(one, 'a', 'drop'), one);
}
{ // 逾期 / Markdown
    assert.ok(m.isOverdue(K(1, 'a', { due: '2025-01-01' }), 'z', '2025-01-02'));
    assert.ok(!m.isOverdue(K(1, 'z', { due: '2025-01-01' }), 'z', '2025-01-02') && !m.isOverdue(K(1, 'a'), 'z', '2025-01-02') && !m.isOverdue(K(1, 'a', { due: '2025-01-02' }), 'z', '2025-01-02'));
    const md = m.kanbanMd({ name: 'P', cols: [{ id: 'a', name: '待辦' }, { id: 'b', name: '完成' }], cards: [K(1, 'a', { due: '2025-03-01', color: 0, note: 'x\ny' }), K(2, 'b')] });
    assert.ok(md.includes('## 待辦\n- [ ] t1 (到期 2025-03-01) [紅]\n  x\n  y') && md.includes('## 完成\n- [x] t2'));
}
{ // 時間換算
    assert.strictEqual(m.toMin('06:30'), 390); assert.strictEqual(m.toMin('24:00'), 1440); assert.ok(isNaN(m.toMin('24:30')) && isNaN(m.toMin('7')) && isNaN(m.toMin('12:60')));
    assert.strictEqual(m.toHM(0), '00:00'); assert.strictEqual(m.toHM(1440), '24:00'); assert.strictEqual(m.toHM(75), '01:15');
    assert.deepEqual(m.cellRange(360, 30, 2, 4), { s: 420, e: 510 }); assert.deepEqual(m.cellRange(360, 30, 4, 2), { s: 420, e: 510 }); assert.deepEqual(m.cellRange(1380, 60, 0, 3), { s: 1380, e: 1440 });
}
{ // 區塊重疊 / 上限
    const B = (id, s, e) => ({ id, s, e, t: id, c: 0 });
    let r = m.putBlock([], B('a', 540, 600)); assert.ok(r.blocks);
    let bl = r.blocks;
    assert.ok(m.putBlock(bl, B('b', 570, 630)).err.includes('重疊')); assert.ok(m.putBlock(bl, B('b', 500, 545)).err);
    assert.ok(m.putBlock(bl, B('b', 600, 660)).blocks && m.putBlock(bl, B('b', 480, 540)).blocks);   // 相鄰不算重疊
    assert.ok(m.putBlock(bl, B('a', 550, 610)).blocks);  // 更新自己
    assert.ok(m.putBlock(bl, B('b', 601, 660)).err && m.putBlock(bl, B('b', 600, 600)).err && m.putBlock(bl, B('b', 600, 1445)).err && m.putBlock(bl, { ...B('b', 600, 660), c: 7 }).err);
    const full = Array.from({ length: 60 }, (_, i) => B('x' + i, i * 20, i * 20 + 10));
    assert.ok(m.putBlock(full, B('n', 1230, 1240)).err.includes('60'));
    assert.strictEqual(m.cleanDay({ blocks: [B('a', 60, 120), B('b', 90, 150), { id: 'c' }, B('d', 120, 180)] }).length, 2);
    assert.strictEqual(m.cleanDay('x').length, 0);
    assert.strictEqual(m.cleanDay({ blocks: Array.from({ length: 100 }, (_, i) => B('y' + i, (i % 288) * 5, (i % 288) * 5 + 5)) }).length, 60);
}
{ // 空檔 / 統計 / 拖曳
    const B = (s, e, c = 0) => ({ id: 'i' + s, s, e, t: '', c });
    assert.deepEqual(m.freeGaps([], 360, 1440), [[360, 1440]]);
    assert.deepEqual(m.freeGaps([B(480, 540), B(300, 400), B(1400, 1500)], 360, 1440), [[400, 480], [540, 1400]]);
    assert.deepEqual(m.freeGaps([B(360, 1440)], 360, 1440), []);
    assert.deepEqual(m.catTotals([B(0, 60, 0), B(60, 90, 0), B(90, 100, 3)]), [90, 0, 0, 10, 0, 0]);
    assert.deepEqual(m.dragBlock(B(600, 660), 'mv', 30), { s: 630, e: 690 }); assert.deepEqual(m.dragBlock(B(600, 660), 'mv', -9999), { s: 0, e: 60 }); assert.deepEqual(m.dragBlock(B(600, 660), 'mv', 9999), { s: 1380, e: 1440 });
    assert.deepEqual(m.dragBlock(B(600, 660), 'rs', -9999), { s: 600, e: 605 }); assert.deepEqual(m.dragBlock(B(600, 660), 'rs', 30), { s: 600, e: 690 });
    assert.ok(m.dayText('2025-03-01', [B(540, 600, 3)], 360, 1440).includes('09:00–10:00'));
}
{ // 設定 / 範本
    assert.deepEqual(m.cleanCfg(null), { start: 360, end: 1440, step: 30 });
    assert.deepEqual(m.cleanCfg({ start: 420, end: 1200, step: 15 }), { start: 420, end: 1200, step: 15 });
    assert.deepEqual(m.cleanCfg({ start: 500, end: 100, step: 7 }), { start: 360, end: 1440, step: 30 });
    const t = m.cleanTpl({ list: [{ name: '', blocks: [] }, { name: '工作日', blocks: [{ id: 'a', s: 60, e: 120, t: 'x', c: 1 }, { id: 'b', s: 90, e: 130, t: 'y', c: 1 }] }, 3], cfg: 'bad' });
    assert.strictEqual(t.list.length, 1); assert.strictEqual(t.list[0].blocks.length, 1);
    assert.strictEqual(m.cleanTpl({ list: Array.from({ length: 30 }, (_, i) => ({ name: 'n' + i })) }).list.length, 20);
}
{ // ICS
    assert.strictEqual(m.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
    assert.strictEqual(m.icsStamp('2025-03-01', 540), '20250301T010000Z');   // 台灣 09:00 = UTC 01:00
    assert.strictEqual(m.icsStamp('2025-03-01', 60), '20250228T170000Z');    // 跨日
    const ics = m.buildIcs('2025-03-01', [{ id: 'a', s: 540, e: 600, t: '開會,討論', c: 0 }], Date.UTC(2025, 0, 1));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.includes('DTSTART:20250301T010000Z\r\nDTEND:20250301T020000Z') && ics.includes('SUMMARY:開會\\,討論') && ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(m.icsFold('x'.repeat(60)).split('\r\n').every((l, i) => l.length <= 26));
}
{ // 修剪
    const keys = ['planb_blocks_2025-01-01', 'planb_blocks_2025-06-01', 'planb_blocks_2026-01-01', 'planb_blocks_junk', 'other_2000-01-01', 'planb_boards'];
    assert.deepEqual(m.pruneKeys(keys, '2025-06-10', 90), ['planb_blocks_2025-01-01', 'planb_blocks_junk']);
    assert.deepEqual(m.pruneKeys(['planb_blocks_2025-03-12'], '2025-06-10', 90), []);   // 恰 90 天前保留
    assert.deepEqual(m.pruneKeys(['planb_blocks_2025-03-11'], '2025-06-10', 90), ['planb_blocks_2025-03-11']);
}
ok('plan-board');
