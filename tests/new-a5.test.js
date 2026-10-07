// 批次 a5：螢幕分享（screen-share）純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('utils/screen-share.html', 'MAX_VIEWERS, makeCode, parseRoom, peerIdOf, qualityPlan, viewerList, parseStats, kbpsBetween, fmtStats, diagnose');

// 房號產生與解析
{
    const c = m.makeCode((n) => n - 1); assert.strictEqual(c.length, 6); assert.ok(m.parseRoom(c));
    let seed = 7; const r = (n) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
    for (let i = 0; i < 50; i++) assert.ok(m.parseRoom(m.makeCode(r)));
    assert.strictEqual(m.parseRoom(' abc234 '), 'ABC234');
    assert.strictEqual(m.parseRoom('https://x.github.io/simple_tools/utils/screen-share.html#K7M2QX'), 'K7M2QX');
    assert.strictEqual(m.parseRoom('#k7m2qx'), 'K7M2QX');
    assert.strictEqual(m.parseRoom('stsh-K7M2QX'), 'K7M2QX');
    assert.strictEqual(m.parseRoom('K7M-2QX'), 'K7M2QX');
    for (const bad of ['', null, undefined, 'a', 'ABC23', 'ABC2345', 'ABC0O1', '#a', 123456, {}]) assert.strictEqual(m.parseRoom(bad), '');
    assert.strictEqual(m.peerIdOf('ABC234'), 'stsh-ABC234');
    ok('screen-share: room code make / parse');
}
// 畫質
{
    let q = m.qualityPlan(30, 1920, 2560);
    assert.deepStrictEqual(q.constraints, { frameRate: { ideal: 30, max: 30 }, width: { max: 1920 } });
    assert.strictEqual(q.maxBitrate, Math.round(1920 * 1080 * 30 * 0.08));
    q = m.qualityPlan(15, 1280, 1920); assert.strictEqual(q.maxBitrate, Math.round(1280 * 720 * 15 * 0.08)); assert.strictEqual(q.maxFramerate, 15);
    q = m.qualityPlan(30, 0, 3840); assert.strictEqual(q.constraints.width, undefined); assert.strictEqual(q.maxBitrate, 8000000);   // 上限 8 Mbps
    q = m.qualityPlan(15, 1280, 100); assert.strictEqual(q.maxBitrate, 300000);                                                     // 下限
    q = m.qualityPlan('x', 999, 0); assert.strictEqual(q.maxFramerate, 30); assert.strictEqual(q.constraints.width, undefined); assert.ok(q.maxBitrate >= 300000 && q.maxBitrate <= 8000000);
    ok('screen-share: qualityPlan');
}
// 觀看者名單
{
    const v = m.viewerList(4);
    assert.strictEqual(m.MAX_VIEWERS, 4);
    for (const id of ['a', 'b', 'c', 'd']) assert.ok(v.add(id).ok);
    assert.deepStrictEqual(v.add('e'), { ok: false, reason: 'full' });
    assert.deepStrictEqual(v.add('a'), { ok: false, reason: 'dup' });
    assert.ok(v.list().every(x => x.state === 'connecting')); assert.strictEqual(v.liveCount(), 0);
    assert.ok(v.set('a', 'live')); assert.ok(v.set('b', 'live')); assert.ok(v.set('b', 'lost'));
    assert.strictEqual(v.set('zz', 'live'), false); assert.strictEqual(v.set('a', 'bogus'), false);
    assert.strictEqual(v.liveCount(), 1);
    assert.ok(v.remove('c')); assert.strictEqual(v.remove('c'), false);
    assert.ok(v.add('e').ok);                                                         // 離開後空出名額
    assert.ok(v.kick('d')); assert.strictEqual(v.kick('d'), false);
    assert.deepStrictEqual(v.add('d'), { ok: false, reason: 'kicked' });              // 被踢的不能再加入
    assert.deepStrictEqual(v.list().map(x => x.n), [1, 2, 5]);
    ok('screen-share: viewerList join / leave / kick / cap');
}
// getStats
{
    const s = m.parseStats([
        { type: 'inbound-rtp', kind: 'video', bytesReceived: 250000, frameWidth: 1280, frameHeight: 720, framesPerSecond: 29.6, jitterBufferDelay: 3, jitterBufferEmittedCount: 100 },
        { type: 'inbound-rtp', kind: 'audio', bytesReceived: 999 },
        { type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.04 }, null, { type: 'transport' }]);
    assert.deepStrictEqual([s.bytes, s.w, s.h, s.fps, s.rtt], [250000, 1280, 720, 30, 40]); assert.ok(Math.abs(s.jb - 30) < 1e-9);
    assert.strictEqual(m.kbpsBetween(0, 0, 250000, 1000), 2000); assert.strictEqual(m.kbpsBetween(5, 100, 3, 200), 0); assert.strictEqual(m.kbpsBetween(0, 5, 9, 5), 0);
    assert.strictEqual(m.fmtStats(s, 2100), '1280×720 · 30 fps · 2.1 Mbps · 延遲約 50 ms');
    assert.strictEqual(m.fmtStats(m.parseStats([]), 640), '640 kbps · 延遲 —'); assert.deepStrictEqual(m.parseStats(null).w, 0);
    ok('screen-share: stats parsing / formatting');
}
// 診斷
{
    assert.ok(m.diagnose('ice-failed').includes('TURN')); assert.ok(m.diagnose('no-stream').includes('TURN'));
    assert.ok(m.diagnose('peer-unavailable').includes('房號')); assert.ok(m.diagnose('whatever').length > 0); assert.ok(m.diagnose().length > 0);
    ok('screen-share: diagnose');
}
