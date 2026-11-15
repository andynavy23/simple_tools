// 批次 u5：心智圖（utils/mind-map.html）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/mind-map.html', 'layout, bbox, canMove, moveNode, swapSibling, subtreeIds, kidsMap, toOutline, parseOutline, hNew, hPush, hUndo, hRedo, cleanNodes, cleanMaps, pngScale, wrapText, nextId, MAX_NODES, MAX_TEXT, MAX_HIST, MAX_MAPS');

// 可重現的隨機樹
let seed = 7; const R = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
const randTree = (n) => {
    const nodes = [{ id: 'n1', t: '根', p: null, col: 0, f: 0 }];
    for (let i = 2; i <= n; i++) nodes.push({ id: 'n' + i, t: ['短', '一段比較長的中文文字節點內容會換行顯示', 'abc def', 'x'][R(4)] + i, p: 'n' + (1 + R(i - 1)), col: R(8), f: 0 });
    return nodes;
};

// 版面：節點不重疊、父節點置中於子節點、折疊隱藏子孫
{
    for (const n of [1, 2, 5, 40, 120]) {
        const nodes = randTree(n), pos = m.layout(nodes, 'n1');
        assert.equal(Object.keys(pos).length, n);
        const ps = Object.values(pos);
        for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j];
            assert.ok(a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6, '節點重疊');
        }
        const kids = m.kidsMap(nodes);
        for (const [p, ks] of kids) if (p !== 'n1') {
            const f = pos[ks[0]], l = pos[ks[ks.length - 1]], c = pos[p];
            assert.ok(Math.abs((c.y + c.h / 2) - ((f.y + f.h / 2) + (l.y + l.h / 2)) / 2) < 1e-6, '父節點未置中');
            for (const k of ks) assert.ok(pos[k].s > 0 ? pos[k].x >= c.x + c.w : pos[k].x + pos[k].w <= c.x, '子節點應在父節點外側');
        }
    }
    const t = randTree(30); t.find(n => n.id === 'n2').f = 1;
    assert.ok(Object.keys(m.layout(t, 'n1')).length < 30);
    // 同深度同側靠對齊的欄
    const b = m.bbox(m.layout(randTree(10), 'n1')); assert.ok(b.w > 0 && b.h > 0);
    assert.deepEqual(m.wrapText('', 200), ['']); assert.ok(m.wrapText('字'.repeat(40), 200).length > 1);
    ok('mind-map layout');
}

// 環檢查與移動、同層排序
{
    const t = [{ id: 'a', t: 'A', p: null }, { id: 'b', t: 'B', p: 'a' }, { id: 'c', t: 'C', p: 'b' }, { id: 'd', t: 'D', p: 'a' }];
    assert.ok(!m.canMove(t, 'a', 'c'), '根不能移');
    assert.ok(!m.canMove(t, 'b', 'c'), '不能移到後代');
    assert.ok(!m.canMove(t, 'b', 'b') && !m.canMove(t, 'b', 'a') && !m.canMove(t, 'b', 'zz'));
    assert.ok(m.canMove(t, 'c', 'd') && m.canMove(t, 'c', 'a') && m.canMove(t, 'd', 'c'));
    assert.ok(m.moveNode(t, 'c', 'd')); assert.equal(t.find(n => n.id === 'c').p, 'd');
    assert.ok(m.moveNode(t, 'b', 'c'));   // c 已移到 d 底下，b 移到 c 底下合法
    assert.ok(!m.moveNode(t, 'd', 'b'));  // b 現在是 d 的後代
}
{
    const t = [{ id: 'a', p: null, t: 'A' }, { id: 'b', p: 'a', t: 'B' }, { id: 'c', p: 'b', t: 'C' }, { id: 'd', p: 'a', t: 'D' }];
    assert.ok(!m.canMove(t, 'b', 'c'));
    assert.ok(m.swapSibling(t, 'd', -1)); assert.deepEqual(m.kidsMap(t).get('a'), ['d', 'b']);
    assert.ok(!m.swapSibling(t, 'd', -1) && !m.swapSibling(t, 'a', 1));
    assert.deepEqual(m.subtreeIds(t, 'b').sort(), ['b', 'c']);
    assert.equal(m.nextId(t), 'n5');
    ok('mind-map move');
}

// 大綱往返與容錯
{
    for (const n of [1, 3, 25, 80]) {
        const nodes = randTree(n), o = m.toOutline(nodes, 'n1'), r = m.parseOutline(o);
        assert.equal(m.toOutline(r.nodes, r.root), o, '往返不一致');
        assert.equal(r.nodes.length, n);
    }
    const a = m.parseOutline('- 旅行\n  - 交通\n    - 高鐵\n  - 住宿');
    assert.equal(a.nodes.length, 4); assert.equal(a.nodes[0].p, null); assert.equal(a.nodes[2].p, a.nodes[1].id); assert.equal(a.nodes[3].p, 'n1');
    // 多個最上層 → 補根
    const b = m.parseOutline('甲\n乙\n  丙', '我的圖'); assert.equal(b.nodes[0].t, '我的圖'); assert.equal(b.nodes.length, 4); assert.equal(b.nodes[3].p, b.nodes[2].id);
    // 標題 + 清單、Tab、編號、跳級
    const c = m.parseOutline('# 主題\n## 子A\n- x\n\t- y\n## 子B\n1. z');
    assert.equal(c.nodes.length, 6); assert.equal(c.nodes.find(n => n.t === 'y').p, c.nodes.find(n => n.t === 'x').id); assert.equal(c.nodes.find(n => n.t === 'z').p, c.nodes.find(n => n.t === '子B').id);
    const d = m.parseOutline('- a\n        - 跳很深'); assert.equal(d.nodes[1].p, 'n1');
    assert.equal(m.parseOutline(''), null); assert.equal(m.parseOutline('\n  \n'), null); assert.equal(m.parseOutline(null), null);
    // 上限
    const big = '# r\n' + Array.from({ length: 700 }, (_, i) => '- k' + i).join('\n'), e = m.parseOutline(big);
    assert.equal(e.nodes.length, m.MAX_NODES); assert.ok(e.truncated);
    assert.ok(m.parseOutline('- ' + 'x'.repeat(500)).nodes[0].t.length <= m.MAX_TEXT);
    ok('mind-map outline');
}

// 撤銷堆疊
{
    const h = m.hNew(); assert.equal(m.hUndo(h, 'x'), null); assert.equal(m.hRedo(h, 'x'), null);
    for (let i = 0; i < 60; i++) m.hPush(h, 's' + i);
    assert.equal(h.u.length, m.MAX_HIST); assert.ok(m.MAX_HIST >= 30);
    assert.equal(m.hUndo(h, 'cur'), 's59'); assert.equal(m.hRedo(h, 's59x'), 'cur');
    m.hUndo(h, 'c2'); m.hPush(h, 'new'); assert.equal(h.r.length, 0);
    ok('mind-map history');
}

// 載入驗證
{
    assert.equal(m.cleanNodes(null), null); assert.equal(m.cleanNodes([]), null); assert.equal(m.cleanNodes([null, 1, {}]), null);
    const a = m.cleanNodes([{ id: 'r', t: 5, p: 'zz', col: 99, f: 1 }, { id: 'x', t: 'x', p: 'y' }, { id: 'y', t: 'y', p: 'x' }, { id: 'r', t: 'dup' }, { id: 'o', t: 'o', p: 'nope' }]);
    assert.equal(a.length, 4); assert.equal(a[0].p, null); assert.equal(a[0].t, ''); assert.equal(a[0].col, 0);
    for (const n of a.slice(1)) assert.ok(['r', 'x', 'y'].includes(n.p) || n.p === 'r');
    for (const n of a) { let c = n, i = 0; while (c.p != null && i++ < 10) c = a.find(z => z.id === c.p); assert.equal(c.id, 'r', '環沒有接回根'); }
    const many = m.cleanNodes(Array.from({ length: 900 }, (_, i) => ({ id: 'n' + i, t: 'x'.repeat(300), p: i ? 'n0' : null })));
    assert.equal(many.length, m.MAX_NODES); assert.equal(many[1].t.length, m.MAX_TEXT);
    const mp = m.cleanMaps([{ id: 'a', name: '', nodes: [{ id: 'r', t: 'r', p: null }] }, { id: 'a', nodes: [{ id: 'r' }] }, { id: 'b', nodes: 'x' }, null, 5]);
    assert.equal(mp.length, 1); assert.equal(mp[0].name, '心智圖');
    assert.equal(m.cleanMaps('x').length, 0);
    assert.equal(m.cleanMaps(Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, name: 'n', nodes: [{ id: 'r', t: 'r', p: null }] }))).length, m.MAX_MAPS);
    // PNG 尺寸
    assert.equal(m.pngScale(800, 600), 2); assert.equal(m.pngScale(5000, 3000), 1); assert.equal(m.pngScale(9000, 100), 0); assert.equal(m.pngScale(20000, 20000), 0);
    ok('mind-map validate');
}
