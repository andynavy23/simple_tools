// voice-memo：滿 200 筆拒絕新增（批次 h1）
const assert = require('assert');
const { load, ok } = require('./_load');
{
    const m = load('utils/voice-memo.html', 'memoFull, MEMO_MAX');
    assert.equal(m.memoFull(Array(m.MEMO_MAX - 1).fill({})), false);
    assert.equal(m.memoFull(Array(m.MEMO_MAX).fill({})), true);
    assert.equal(m.memoFull([]), false);
    ok('voice-memo: memoFull');
}
