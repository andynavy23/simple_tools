const { load, ok } = require('./_load'); const assert = require('assert');

// ---- party ----
const p = load('game-assist/party.html', 'LOOT_CATS, expAdd, expReset, expSetTarget, expPercent, expReached, expRank, lootAdd, lootResetSelf, lootCounts, lootTotal, dropMember, survivalSec, survivalStart, survivalExpire, survivalAck, survivalPos');
const newExp = (target = 100) => ({ target, current: 0, contributions: {}, finished: false });

{
    const e = newExp(20);
    assert.ok(p.expAdd(e, 'a', 5) && p.expAdd(e, 'a', 5) && p.expAdd(e, 'b', 1));
    assert.strictEqual(e.current, 11);
    assert.deepStrictEqual(e.contributions, { a: 10, b: 1 });
    assert.strictEqual(Math.round(p.expPercent(e)), 55);
    assert.ok(!p.expReached(e));
    // 封頂在目標，但貢獻照記
    p.expAdd(e, 'a', 5); p.expAdd(e, 'a', 5);
    assert.strictEqual(e.current, 20);
    assert.strictEqual(e.contributions.a, 20);
    assert.ok(p.expReached(e));
    e.finished = true;
    assert.ok(!p.expReached(e), '已慶祝過不再觸發');
    // 非法步長被拒、狀態不變
    const before = JSON.stringify(e);
    assert.ok(!p.expAdd(e, 'a', 9999) && !p.expAdd(e, 'a', -1) && !p.expAdd(e, 'a', '5') && !p.expAdd(e, 'a'));
    assert.strictEqual(JSON.stringify(e), before);
    p.expReset(e);
    assert.deepStrictEqual([e.current, e.finished, e.contributions.a], [0, false, 20]);
    ok('party: exp add / cap / reached / reset');
}
{
    const e = newExp(); e.current = 40; e.contributions.a = 40; e.finished = true;
    for (const bad of [0, -5, 1.5, '10', null, NaN, undefined]) assert.ok(!p.expSetTarget(e, bad), String(bad));
    assert.strictEqual(e.target, 100);
    assert.ok(p.expSetTarget(e, 1));
    assert.deepStrictEqual([e.target, e.current, e.finished, e.contributions], [1, 0, false, {}]);
    p.expAdd(e, 'x', 1);
    assert.ok(p.expReached(e));
    assert.deepStrictEqual(p.expRank({ a: 5, b: 20, c: 5, d: 0 }).map(x => x[0]).slice(0, 2), ['b', 'a']);
    assert.deepStrictEqual(p.expRank({}), []);
    ok('party: target validation, rank');
}
{
    const loot = { items: [], playerStats: {} };
    assert.ok(p.lootAdd(loot, 'a', 'Amy', '武器') && p.lootAdd(loot, 'a', 'Amy', '武器') && p.lootAdd(loot, 'b', 'Bob', '捲軸(貴)'));
    assert.ok(!p.lootAdd(loot, 'a', 'Amy', '<img src=x>') && !p.lootAdd(loot, 'a', 'Amy', undefined));
    assert.strictEqual(loot.items.length, 3);
    assert.deepStrictEqual(p.lootCounts(loot.items), { '武器': 2, '捲軸(貴)': 1 });
    assert.deepStrictEqual(p.lootCounts([]), {});
    assert.strictEqual(p.lootTotal(loot.playerStats.a), 2);
    assert.strictEqual(p.lootTotal({}), 0);
    assert.ok(p.LOOT_CATS.length === 6 && new Set(p.LOOT_CATS).size === 6);
    p.lootResetSelf(loot, 'a', 'Amy');
    assert.ok(!loot.playerStats.a && loot.items.length === 1 && loot.items[0].player === 'Bob');
    p.lootResetSelf(loot, 'zz', 'Nobody'); // 不存在也不炸
    assert.strictEqual(loot.items.length, 1);
    ok('party: loot add / counts / reset');
}
{
    const mk = () => ({
        room: { captain: 'cap', members: [{ id: 'cap', name: 'Cap' }, { id: 'm1', name: 'M1' }, { id: 'm2', name: 'M2' }] },
        exp: { target: 100, current: 12, contributions: { cap: 2, m1: 7, m2: 3 }, finished: false },
        loot: { items: [{ type: '武器', player: 'M1' }, { type: '防具', player: 'Cap' }], playerStats: { m1: { '武器': 1 }, cap: { '防具': 1 } } },
    });
    const st = mk();
    p.dropMember(st, 'm1');
    assert.deepStrictEqual(st.room.members.map(m => m.id), ['cap', 'm2']);
    assert.strictEqual(st.exp.contributions.cap, 9, '經驗移交隊長');
    assert.ok(!('m1' in st.exp.contributions) && !st.loot.playerStats.m1);
    assert.deepStrictEqual(st.loot.items.map(i => i.player), ['Cap']);
    assert.strictEqual(st.exp.current, 12, '總進度不變');
    const st2 = mk(); p.dropMember(st2, 'ghost'); // 未知成員：不改動資料
    assert.deepStrictEqual(st2.exp.contributions, { cap: 2, m1: 7, m2: 3 });
    const st3 = mk(); p.dropMember(st3, 'cap'); // 隊長自己離開不會自己移交給自己
    assert.ok(!('cap' in st3.exp.contributions));
    assert.strictEqual(st3.exp.contributions.m1, 7);
    ok('party: dropMember hands exp to captain, cleans loot');
}
{
    assert.strictEqual(p.survivalSec('15'), 15);
    assert.strictEqual(p.survivalSec(''), 10);
    assert.strictEqual(p.survivalSec('abc'), 10);
    assert.strictEqual(p.survivalSec('0'), 10);
    assert.strictEqual(p.survivalSec(undefined), 10);
    const ms = [{ id: 'a', status: '連線中' }, { id: 'b', status: '連線中' }, { id: 'c', status: '連線中' }];
    p.survivalStart(ms);
    assert.ok(ms.every(m => m.status === 'Idle'));
    assert.ok(p.survivalAck(ms, 'b') && !p.survivalAck(ms, 'nobody'));
    p.survivalExpire(ms);
    assert.deepStrictEqual(ms.map(m => m.status), ['DEAD', '連線中', 'DEAD']);
    p.survivalExpire(ms); // 再次到期不會把已回應的人標死
    assert.strictEqual(ms[1].status, '連線中');
    for (const [r1, r2] of [[0, 0], [1, 1], [0.5, 0.5], [0.999, 0.001]]) {
        const pos = p.survivalPos(r1, r2, 390, 844);
        assert.ok(pos.left >= 0 && pos.left <= 390 - 120 && pos.top >= 100 && pos.top <= 844 - 200, JSON.stringify(pos));
    }
    ok('party: survival test statuses / duration / target position');
}

// ---- rjpq ----
const r = load('game-assist/rjpq.html', 'validState, applyMarker, doorInfo, summarizeFloors, routeString, hslToHex, hexToRgb');
const slot = (index, extra = {}) => ({ index, nick: 'P' + index, color: 'hsl(210, 80%, 45%)', peerId: 'id' + index, isHost: index === 0, connected: true, passMarkers: [], deadEndMarkers: [], ...extra });
const slots8 = (n) => Array.from({ length: 8 }, (_, i) => (i < n ? slot(i) : null));

{
    const S = slots8(3);
    const mk = (f, d, mType) => ({ type: 'CMD_MARKER', f, d, mType });
    assert.ok(r.applyMarker(S, S[1], mk(2, 1, 'pass')));
    // 同門已被他人佔用
    assert.ok(!r.applyMarker(S, S[2], mk(2, 1, 'pass')));
    assert.deepStrictEqual(S[2].passMarkers, []);
    // 同層換門：舊的被取代
    assert.ok(r.applyMarker(S, S[1], mk(2, 3, 'pass')));
    assert.deepStrictEqual(S[1].passMarkers, [{ f: 2, d: 3 }]);
    // 原本被佔的門現在可被他人使用
    assert.ok(r.applyMarker(S, S[2], mk(2, 1, 'pass')));
    // 離線者的標記不阻擋
    S[2].connected = false;
    assert.ok(r.applyMarker(S, S[0], mk(2, 1, 'pass')));
    // 死路：不重複、且會移除自己在該格的通路
    assert.ok(r.applyMarker(S, S[0], mk(2, 1, 'dead')) && r.applyMarker(S, S[0], mk(2, 1, 'dead')));
    assert.deepStrictEqual(S[0].deadEndMarkers, [{ f: 2, d: 1 }]);
    assert.deepStrictEqual(S[0].passMarkers, []);
    assert.ok(r.applyMarker(S, S[0], mk(2, 1, 'clear_dead')));
    assert.deepStrictEqual(S[0].deadEndMarkers, []);
    // 取消通路：成員只能取消自己的，房主可取消任何人的
    assert.ok(r.applyMarker(S, S[0], mk(2, 3, 'clear_pass')) && S[1].passMarkers.length === 0, '房主可取消他人');
    r.applyMarker(S, S[1], mk(5, 0, 'pass'));
    r.applyMarker(S, S[2], mk(5, 0, 'clear_pass')); // 成員 2 取消 (5,0)：不是自己的 → 無效果
    assert.deepStrictEqual(S[1].passMarkers, [{ f: 5, d: 0 }]);
    // 非法輸入
    for (const bad of [mk(-1, 0, 'pass'), mk(10, 0, 'pass'), mk(0, 4, 'pass'), mk(0, -1, 'pass'), mk(1.5, 0, 'pass'), mk('1', 0, 'pass'), mk(0, 0, 'hack'), mk(0, 0, undefined)]) {
        assert.ok(!r.applyMarker(S, S[1], bad), JSON.stringify(bad));
    }
    ok('rjpq: applyMarker occupancy / replace / dead / clear / invalid');
}
{
    const S = slots8(4);
    const a = r.doorInfo(S, 0, 0);
    assert.strictEqual(a.passSlot, undefined); assert.deepStrictEqual(a.deadSlots, []);
    S[1].deadEndMarkers.push({ f: 0, d: 0 }); S[2].deadEndMarkers.push({ f: 0, d: 0 });
    S[3].passMarkers.push({ f: 0, d: 0 });
    const b = r.doorInfo(S, 0, 0);
    assert.strictEqual(b.passSlot.index, 3); assert.deepStrictEqual(b.deadSlots.map(x => x.index), [1, 2]);
    S[3].connected = false; S[2].connected = false;
    const c = r.doorInfo(S, 0, 0);
    assert.strictEqual(c.passSlot, undefined); assert.deepStrictEqual(c.deadSlots.map(x => x.index), [1]);
    ok('rjpq: doorInfo ignores disconnected slots');
}
{
    // 四人同層：三人標通路，第四人自動推得剩下的門
    let S = slots8(4).slice(0, 4);
    S[0].passMarkers.push({ f: 9, d: 0 }); S[1].passMarkers.push({ f: 9, d: 1 }); S[2].passMarkers.push({ f: 9, d: 2 });
    let fs = r.summarizeFloors(S);
    assert.deepStrictEqual(fs[9], { 0: 1, 1: 2, 2: 3, 3: 4 });
    assert.strictEqual(r.routeString(fs, 3), '4-0-0-0-0-0-0-0-0-0'); // L10 在最前
    assert.strictEqual(r.routeString(fs, 0), '1-0-0-0-0-0-0-0-0-0');
    // Rule C：某人標了 3 個死路 → 剩下那門是他的
    S = slots8(4).slice(0, 4);
    [0, 1, 2].forEach(d => S[0].deadEndMarkers.push({ f: 4, d }));
    fs = r.summarizeFloors(S);
    assert.strictEqual(fs[4][0], 4);
    assert.strictEqual(fs[4][1], undefined, '其他人無法判斷');
    // Rule A：某門有 3 人標死路且無通路 → 沒標它的那人是通路（只有 3 位死路者以外的第 4 人）
    S = slots8(4).slice(0, 4);
    [0, 1, 2].forEach(i => S[i].deadEndMarkers.push({ f: 0, d: 2 }));
    fs = r.summarizeFloors(S);
    assert.strictEqual(fs[0][3], 3);
    // 無資訊：全 0；單人
    fs = r.summarizeFloors(slots8(2).slice(0, 2));
    assert.strictEqual(r.routeString(fs, 0), '0-0-0-0-0-0-0-0-0-0');
    fs = r.summarizeFloors([]);
    assert.strictEqual(fs.length, 10);
    // 明確標記優先，不被推論覆蓋
    S = slots8(4).slice(0, 4);
    S[0].passMarkers.push({ f: 1, d: 3 });
    [0, 1, 2].forEach(d => S[0].deadEndMarkers.push({ f: 1, d }));
    assert.strictEqual(r.summarizeFloors(S)[1][0], 4);
    ok('rjpq: summarizeFloors deduction rules + routeString');
}
{
    const good = { slots: slots8(2), clearCount: 0 };
    assert.ok(r.validState(good));
    assert.ok(!r.validState(null) && !r.validState({}) && !r.validState({ slots: slots8(2).slice(0, 7) }));
    assert.ok(!r.validState({ slots: [...slots8(1).slice(0, 7), { nick: 1, color: 'x', passMarkers: [], deadEndMarkers: [] }] }));
    assert.ok(!r.validState({ slots: [...slots8(1).slice(0, 7), { nick: 'a', color: 'x', passMarkers: 'no', deadEndMarkers: [] }] }));
    assert.strictEqual(r.hslToHex('hsl(0, 100%, 50%)'), '#ff0000');
    assert.strictEqual(r.hslToHex('hsl(120, 100%, 50%)'), '#00ff00');
    assert.strictEqual(r.hslToHex('garbage'), '#4285f4');
    assert.strictEqual(r.hexToRgb('#ff8000'), '255, 128, 0');
    assert.strictEqual(r.hexToRgb('nope'), null);
    ok('rjpq: validState, color conversion');
}
