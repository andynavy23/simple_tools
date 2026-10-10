const { load, ok } = require('./_load'); const assert = require('assert');
{
    const m = load('mini-games/blackjack.html', 'slideDelta, dealSchedule');
    assert.deepStrictEqual(m.slideDelta({ left: 300, top: 10 }, { left: 20, top: 50 }), { dx: 280, dy: -40 });
    // 開局：2 位玩家 + 莊家，各 2 張：玩家1、玩家2、莊家 輪第 1 張，再輪第 2 張，間隔 70ms
    const s = m.dealSchedule([0, 0], 0, [2, 2], 2, 70);
    assert.deepStrictEqual(s.map(x => `${x.seat}:${x.idx}:${x.delay}`), ['0:0:0', '1:0:70', '-1:0:140', '0:1:210', '1:1:280', '-1:1:350']);
    // 要牌：只有新增的那一張、不延遲；莊家補牌同理；沒有新牌就沒有動畫
    assert.deepStrictEqual(m.dealSchedule([2, 2], 2, [3, 2], 2, 70), [{ seat: 0, idx: 2, delay: 0 }]);
    assert.deepStrictEqual(m.dealSchedule([2, 2], 2, [2, 2], 3, 70), [{ seat: -1, idx: 2, delay: 0 }]);
    assert.deepStrictEqual(m.dealSchedule([2, 2], 2, [2, 2], 2, 70), []);
    assert.deepStrictEqual(m.dealSchedule([], 0, [0, 2], 2, 70).map(x => x.seat), [1, -1, 1, -1]);   // 沒下注的座位不發牌
    ok('c6 blackjack: slideDelta / dealSchedule');
}
{
    const m = load('mini-games/uno.html', 'flipDelta, handDiff, diffCounts, stagger');
    assert.deepStrictEqual(m.flipDelta({ left: 100, top: 400 }, { left: 150, top: 200 }), { dx: -50, dy: 200 });
    assert.deepStrictEqual(m.handDiff(['R1', 'G2', 'B3'], ['R1', 'B3']), { removed: 1, added: [] });
    assert.deepStrictEqual(m.handDiff(['R1', 'G2'], ['R1']), { removed: 1, added: [] });
    assert.deepStrictEqual(m.handDiff(['R1'], []), { removed: 0, added: [] });
    assert.deepStrictEqual(m.handDiff(['R1'], ['R1', 'G2', 'B3']), { removed: -1, added: [1, 2] });
    assert.deepStrictEqual(m.handDiff(['R1'], ['R1']), { removed: -1, added: [] });
    assert.deepStrictEqual(m.diffCounts([7, 7, 7], [6, 9, 7]), { played: 0, drawn: [{ seat: 1, n: 2 }] });   // 0 號出牌，1 號被 +2
    assert.deepStrictEqual(m.diffCounts([7, 7], [7, 8]), { played: -1, drawn: [{ seat: 1, n: 1 }] });
    assert.deepStrictEqual(m.stagger(3, 60), [0, 60, 120]);
    ok('c6 uno: flipDelta / handDiff / diffCounts / stagger');
}
