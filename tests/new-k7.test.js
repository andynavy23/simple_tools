// 批次 k7：中國象棋純邏輯（走法、將死、記譜、搜尋、驗證）
const assert = require('assert');
const { load, ok } = require('./_load');
const X = load('mini-games/xiangqi.html', 'START_FEN, fromFen, toFen, newPos, legalMoves, perft, doMove, undoMove, status, replay, undoCount, moveName, cpuMove, evaluate, cleanStats, cleanOpts, cleanGame, cleanState, inCheck, fmtClock, logText, cpuAcceptsDraw');
const P = (fen) => X.newPos(fen);
const sq = (r, c) => r * 9 + c, mv = (a, b) => a * 90 + b;
const from = (fen, r, c) => X.legalMoves(P(fen)).filter(m => ((m / 90) | 0) === sq(r, c)).map(m => m % 90).sort((a, b) => a - b);

// FEN 來回與壞資料
assert.strictEqual(X.toFen(P()), X.START_FEN);
for (const bad of [null, '', 'x', '9/9/9 w', X.START_FEN.replace('K', 'Q'), X.START_FEN.replace(' w', ' z')]) assert.strictEqual(X.fromFen(bad), null);

// perft：開局 44 / 1920 / 79666
assert.strictEqual(X.legalMoves(P()).length, 44);
assert.strictEqual(X.perft(P(), 2), 1920);
assert.strictEqual(X.perft(P(), 3), 79666);
ok('k7 perft 44/1920/79666');

// 走法規則
assert.ok(from('4k4/9/9/9/9/9/9/9/4R4/4K4 w', 8, 4).every(t => t % 9 === 4), '將帥之間的車只能沿縱線動（否則照面）');
let t = from('4k4/9/9/9/9/9/4p4/4N4/9/3K5 w', 7, 4);
assert.ok(!t.includes(sq(5, 3)) && !t.includes(sq(5, 5)) && t.includes(sq(6, 2)) && t.includes(sq(8, 6)), '蹩馬腿');
assert.deepStrictEqual(from('4k4/9/9/9/9/9/9/2B6/9/3K5 w', 7, 2), [sq(5, 0), sq(5, 4), sq(9, 0), sq(9, 4)]);
t = from('4k4/9/9/9/9/9/1p7/2B6/9/3K5 w', 7, 2);
assert.ok(!t.includes(sq(5, 0)) && t.includes(sq(5, 4)), '塞象眼');
assert.ok(from('4k4/9/9/9/9/4B4/9/9/9/3K5 w', 5, 4).every(x => x >= 45), '象不能過河');
t = from('3k5/4p4/9/9/4p4/9/9/9/4C4/5K3 w', 8, 4);
assert.ok(!t.includes(sq(4, 4)) && t.includes(sq(1, 4)) && t.includes(sq(5, 4)), '炮：隔一子吃遠處，不能吃第一子');
assert.ok(!from('3k5/9/9/9/4p4/9/9/9/4C4/5K3 w', 8, 4).includes(sq(4, 4)), '無炮架不能吃');
assert.deepStrictEqual(from('3k5/9/9/9/9/4P4/9/9/9/5K3 w', 5, 4), [sq(4, 4)]);
assert.deepStrictEqual(from('3k5/9/9/9/4P4/9/9/9/9/5K3 w', 4, 4), [sq(3, 4), sq(4, 3), sq(4, 5)]);
assert.deepStrictEqual(from('5k3/9/9/9/9/9/9/9/9/3K5 w', 9, 3), [sq(8, 3), sq(9, 4)]);
assert.deepStrictEqual(from('4k4/9/9/9/9/9/9/9/9/3K5 w', 9, 3), [sq(8, 3)], '帥不能走到與將照面的縱線');
assert.ok(from('3k5/9/9/9/9/9/9/9/9/3K5 w', 9, 3).length >= 0);
ok('k7 走法規則');

// 將死 / 困斃 / 將軍
let pos = P('R2k5/R8/9/9/9/9/9/9/9/4K4 b');
let st = X.status(pos);
assert.ok(X.inCheck(pos.b, -1) && st.over && st.winner === 1 && st.why === 'mate', '雙車殺');
pos = P('3k5/R8/9/9/9/4R4/9/9/9/4K4 b');
st = X.status(pos);
assert.ok(!X.inCheck(pos.b, -1) && st.over && st.winner === 1 && st.why === 'stalemate', '困斃判負');
pos = P('3k5/R8/9/9/9/8R/9/9/9/4K4 w');
assert.ok(!X.status(pos).over);
ok('k7 將死 / 困斃');

// 記譜
pos = P();
assert.strictEqual(X.moveName(pos, mv(sq(7, 7), sq(7, 4))), '炮二平五');
assert.ok(X.doMove(pos, mv(sq(7, 7), sq(7, 4))));
assert.strictEqual(X.moveName(pos, mv(sq(0, 1), sq(2, 2))), '馬２進３');
assert.ok(X.doMove(pos, mv(sq(0, 1), sq(2, 2))));
assert.deepStrictEqual(pos.nm, ['炮二平五', '馬２進３']);
assert.ok(!X.doMove(pos, mv(sq(9, 4), sq(7, 4))), '不能把帥走進非法位置 / 非自己的步');
assert.ok(!X.doMove(pos, 1.5) && !X.doMove(pos, -1) && !X.doMove(pos, 99999));
assert.strictEqual(X.logText(pos, 'H'), 'H\n1. 炮二平五  馬２進３');
pos = P('4k4/9/9/9/9/4R4/9/9/4R4/3K5 w');
assert.strictEqual(X.moveName(pos, mv(sq(5, 4), sq(4, 4))), '前車進一');
assert.strictEqual(X.moveName(pos, mv(sq(8, 4), sq(8, 0))), '後車平九');
// 悔棋
pos = P();
const k0 = pos.keys[0];
assert.strictEqual(X.undoCount(pos, 1), 0);
X.doMove(pos, mv(sq(7, 7), sq(0, 7)));
assert.strictEqual(pos.noCap, 0); assert.ok(pos.rec[0].cap !== 0);
X.undoMove(pos);
assert.strictEqual(X.toFen(pos), k0); assert.strictEqual(pos.mv.length, 0);
X.doMove(pos, X.legalMoves(pos)[0]);
assert.strictEqual(X.undoCount(pos, 1), 1); assert.strictEqual(X.undoCount(pos, -1), 0);
X.doMove(pos, X.legalMoves(pos)[0]);
assert.strictEqual(X.undoCount(pos, 1), 2); assert.strictEqual(X.undoCount(pos, -1), 1);
ok('k7 記譜 / 悔棋');

// 重複局面：和棋；長將：違規方負
pos = P('4k4/9/9/9/9/9/9/9/9/R2K5 w');
let seq = [mv(sq(9, 0), sq(8, 0)), mv(sq(0, 4), sq(0, 5)), mv(sq(8, 0), sq(9, 0)), mv(sq(0, 5), sq(0, 4))], over = null;
for (let i = 0; i < 12 && !over; i++) { assert.ok(X.doMove(pos, seq[i % 4])); const s = X.status(pos); if (s.over) over = s; }
assert.ok(over && over.winner === 0 && over.why === 'repeat');
pos = P('4k4/9/9/9/9/R8/9/9/9/3K5 w');
const cyc = [mv(sq(0, 4), sq(1, 4)), mv(sq(0, 0), sq(1, 0)), mv(sq(1, 4), sq(0, 4)), mv(sq(1, 0), sq(0, 0))];
assert.ok(X.doMove(pos, mv(sq(5, 0), sq(0, 0))));
over = null;
for (let i = 0; i < 12 && !over; i++) { assert.ok(X.doMove(pos, cyc[i % 4]), 'cycle ' + i); const s = X.status(pos); if (s.over) over = s; }
assert.ok(over && over.why === 'perpetual' && over.winner === -1, '長將判負 ' + JSON.stringify(over));
// 60 步無吃子
pos = P('4k4/9/9/9/9/9/9/9/9/R2K5 w'); pos.noCap = 120;
assert.deepStrictEqual([X.status(pos).why, X.status(pos).winner], ['60', 0]);
ok('k7 重複 / 長將');

// 驗證
assert.strictEqual(X.replay([1]), null);
assert.strictEqual(X.replay('x'), null);
assert.strictEqual(X.replay(new Array(601).fill(1)), null);
assert.strictEqual(X.replay([mv(sq(7, 7), sq(7, 4)), mv(sq(7, 7), sq(7, 4))]), null);
assert.ok(X.replay([mv(sq(7, 7), sq(7, 4))]));
assert.strictEqual(X.cleanGame({ mode: 'cpu', moves: [5] }), null);
assert.strictEqual(X.cleanGame(null), null);
assert.strictEqual(X.cleanGame({ mode: 'x', moves: [] }), null);
const g = X.cleanGame({ mode: 'cpu', level: 'zzz', me: -1, moves: [mv(sq(7, 7), sq(7, 4))] });
assert.ok(g && g.level === 'normal' && g.me === -1 && g.moves.length === 1);
assert.deepStrictEqual(X.cleanStats(null).net, [0, 0, 0]);
assert.deepStrictEqual(X.cleanStats({ easy: [1, 'x', -3], hard: null, net: [1e9, 2, 3.5] }).easy, [1, 0, 0]);
assert.deepStrictEqual(X.cleanStats({ net: [1e9, 2, 3.5] }).net, [99999, 2, 0]);
assert.deepStrictEqual(X.cleanOpts({ level: 'x', side: 1, clock: 7, nick: '壞 暱稱' }), { level: 'normal', side: 'red', clock: 0, nick: '' });
assert.strictEqual(X.cleanOpts({ clock: 10, nick: '小明' }).clock, 10);
const good = { t: 'STATE', moves: [mv(sq(7, 7), sq(7, 4))], end: null, hs: 1, names: ['a', 'b'], clk: { ms: [1000, 2000], run: true }, ask: { kind: 'draw', from: -1 }, online: true, note: 'x' };
assert.ok(X.cleanState(good));
for (const mut of [{ moves: [1] }, { hs: 0 }, { names: ['a'] }, { end: { w: 1, why: 'x' } }, { clk: { ms: ['a', 1], run: 1 } }, { ask: { kind: 'z', from: 1 } }, { t: 'X' }]) assert.strictEqual(X.cleanState({ ...good, ...mut }), null);
assert.strictEqual(X.cleanState(null), null);
assert.strictEqual(X.fmtClock(65000), '1:05');
ok('k7 驗證');

// 搜尋：一步殺、吃子
pos = P('3k5/R8/9/9/9/8R/9/9/9/4K4 w');
let m = X.cpuMove(pos, 'hard', { ms: 3000, d: 3 });
assert.ok(m >= 0 && X.doMove(pos, m));
assert.ok(X.status(pos).over && X.status(pos).why === 'mate', '找到一步殺');
pos = P('4k4/9/9/9/9/9/4r4/9/4R4/3K5 w');
assert.strictEqual(X.cpuMove(pos, 'normal', { rand: () => 0.5 }) % 90, sq(6, 4));
assert.strictEqual(X.cpuMove(P('3k5/R8/9/9/9/4R4/9/9/9/4K4 b'), 'hard'), -1, '無合法步回傳 -1');
const t0 = Date.now(); X.cpuMove(P(), 'hard'); assert.ok(Date.now() - t0 < 1500, '困難開局思考時間在預算內');
ok('k7 搜尋');

// 隨機自對弈 500 局：每步合法、能終局；並用獨立的暴力走法生成器（座標規則）對照
function brute(b, side) {
    const at = (r, c) => (r < 0 || r > 9 || c < 0 || c > 8 ? 99 : b[r * 9 + c]);
    const own = (v, sd) => v !== 0 && v !== 99 && (v > 0) === (sd > 0);
    const reach = (bd, fr, fc, tr, tc, sd) => {            // 位於 (fr,fc) 的 sd 方棋子能否走到 (tr,tc)（不管自家將軍）
        const A = (r, c) => (r < 0 || r > 9 || c < 0 || c > 8 ? 99 : bd[r * 9 + c]);
        const v = A(fr, fc), tt = Math.abs(v), tv = A(tr, tc), dr = tr - fr, dc = tc - fc, adr = Math.abs(dr), adc = Math.abs(dc);
        if (tv === 99 || own(tv, sd) || (!dr && !dc)) return false;
        const between = () => { let k = 0; const sr = Math.sign(dr), sc = Math.sign(dc); for (let r = fr + sr, c = fc + sc; r !== tr || c !== tc; r += sr, c += sc) if (A(r, c)) k++; return k; };
        const pal = tc >= 3 && tc <= 5 && (sd > 0 ? tr >= 7 : tr <= 2);
        switch (tt) {
            case 1: return adr + adc === 1 && pal;
            case 2: return adr === 1 && adc === 1 && pal;
            case 3: return adr === 2 && adc === 2 && !A(fr + dr / 2, fc + dc / 2) && (sd > 0 ? tr >= 5 : tr <= 4);
            case 4: return (adr === 2 && adc === 1 && !A(fr + dr / 2, fc)) || (adr === 1 && adc === 2 && !A(fr, fc + dc / 2));
            case 5: return (!dr || !dc) && between() === 0;
            case 6: return (!dr || !dc) && between() === (tv ? 1 : 0);
            case 7: { const f = sd > 0 ? -1 : 1, crossed = sd > 0 ? fr <= 4 : fr >= 5; return (dr === f && !dc) || (crossed && !dr && adc === 1); }
        }
        return false;
    };
    const out = [];
    for (let s = 0; s < 90; s++) {
        if (!own(b[s], side)) continue;
        for (let tq = 0; tq < 90; tq++) {
            if (!reach(b, (s / 9) | 0, s % 9, (tq / 9) | 0, tq % 9, side)) continue;
            const c = Int8Array.from(b); c[tq] = c[s]; c[s] = 0;
            const ks = c.indexOf(side), es = c.indexOf(-side);
            let bad = false;
            if (ks % 9 === es % 9) { let k = 0; for (let r = Math.min((ks / 9) | 0, (es / 9) | 0) + 1; r < Math.max((ks / 9) | 0, (es / 9) | 0); r++) if (c[r * 9 + ks % 9]) k++; if (!k) bad = true; }
            for (let e = 0; e < 90 && !bad; e++) if (c[e] && !own(c[e], side) && reach(c, (e / 9) | 0, e % 9, (ks / 9) | 0, ks % 9, -side)) bad = true;
            if (!bad) out.push(s * 90 + tq);
        }
    }
    return out.sort((a, b) => a - b);
}
let seed = 12345; const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
let ended = 0, plies = 0, checked = 0; const reasons = {};
for (let gi = 0; gi < 500; gi++) {
    const p = P();
    for (let i = 0; i < 700; i++) {
        const lm = X.legalMoves(p), s = X.status(p, lm);
        if (s.over) { ended++; reasons[s.why] = (reasons[s.why] || 0) + 1; break; }
        if (gi < 40 && i % 4 === 0) { checked++; assert.deepStrictEqual(lm.slice().sort((a, b) => a - b), brute(p.b, p.turn), '暴力生成器對照 ' + X.toFen(p)); }
        const cp = lm.filter(x => p.b[x % 90]);
        assert.ok(X.doMove(p, cp.length && rng() < 0.5 ? cp[(rng() * cp.length) | 0] : lm[(rng() * lm.length) | 0])); plies++;
    }
}
assert.strictEqual(ended, 500, '500 局都能終局');
ok(`k7 自對弈 500 局（平均 ${(plies / 500) | 0} 步，暴力對照 ${checked} 局面，結果 ${JSON.stringify(reasons)}）`);

// 困難 vs 簡單 30 局（輪流執紅黑）；160 步未分勝負以子力評分裁定
let hardW = 0, easyW = 0, dr = 0;
for (let gi = 0; gi < 30; gi++) {
    const hs = gi % 2 ? -1 : 1, p = P();
    let res = null;
    for (let i = 0; i < 160 && res === null; i++) {
        const s = X.status(p);
        if (s.over) { res = s.winner; break; }
        X.doMove(p, p.turn === hs ? X.cpuMove(p, 'hard', { d: 3, ms: 5000 }) : X.cpuMove(p, 'easy'));
    }
    if (res === null) { const e = X.evaluate(p.b, hs); res = e > 300 ? hs : e < -300 ? -hs : 0; }
    if (res === 0) dr++; else if (res === hs) hardW++; else easyW++;
}
console.log(`k7 困難 vs 簡單 30 局：困難勝 ${hardW}、簡單勝 ${easyW}、和 ${dr}`);
assert.ok(hardW >= 20 && easyW <= 3, `困難勝率不夠高 ${hardW}/${easyW}/${dr}`);
ok('k7 困難明顯強於簡單');
