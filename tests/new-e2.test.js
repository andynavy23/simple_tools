const { load, ok, near } = require('./_load');
const assert = require('assert');

// ---------- Git 指令速查 ----------
{
    const m = load('utils/git-helper.html', 'RISK_RANK, riskOfCommand, maxRisk, SCENARIOS, searchScenarios, checkScenarios, q, validRef, validRev, buildCommit, buildBranch, buildLog, buildReset, buildRevert, buildTag, FORMS');
    assert.deepStrictEqual(m.checkScenarios(m.SCENARIOS), []);
    assert.ok(m.SCENARIOS.length >= 25);
    ok('git-helper: scenario data is complete (every one has risk, desc, check, git commands, not under-rated)');
    // 危險寫法一律紅
    for (const c of ['git push --force', 'git push -f origin main', 'git push --force-with-lease', 'git reset --hard HEAD~1', 'git clean -fd', 'git clean -fdx', 'git branch -D x', 'git push origin --delete x', 'git push origin :x', 'git rebase main', 'git rebase -i HEAD~3', 'git checkout -- .', 'git restore a.txt', 'git stash drop', 'git stash clear', 'git filter-branch x'])
        assert.strictEqual(m.riskOfCommand(c), 'danger', c);
    // 引號裡的 -f 不算旗標
    assert.strictEqual(m.riskOfCommand('git commit -m "fix -f flag"'), 'safe');
    assert.strictEqual(m.riskOfCommand('git restore --staged a.txt'), 'safe');
    for (const c of ['git status', 'git log --oneline', 'git diff', 'git blame a.js', 'git revert HEAD', 'git switch main']) assert.strictEqual(m.riskOfCommand(c), 'safe', c);
    for (const c of ['git commit --amend', 'git reset --soft HEAD~1', 'git reset HEAD~1', 'git stash pop', 'git cherry-pick abc', 'git branch -d x', 'git tag -d v1', 'git merge x', 'git push origin main']) assert.strictEqual(m.riskOfCommand(c), 'undo', c);
    assert.strictEqual(m.maxRisk(['safe', 'danger', 'undo']), 'danger');
    assert.strictEqual(m.maxRisk([]), 'safe');
    ok('git-helper: riskOfCommand flags --force/--hard/clean -f/branch -D/rebase/remote delete as danger');
    // 資料完整性檢查本身能抓到壞資料
    const bad = [{ id: 'a', title: 't', desc: 'd', check: 'c', risk: 'safe', tags: '', cmds: [['git push --force', 'x']] }, { id: 'a', title: '', desc: '', check: '', risk: 'zzz', tags: '', cmds: [] }, { id: 'b', title: 't', desc: 'd', check: 'c', risk: 'safe', tags: '', cmds: [['rm -rf /', 'x']] }];
    const r = m.checkScenarios(bad).join('|');
    assert.ok(/風險標示過低/.test(r) && /重複/.test(r) && /缺風險/.test(r) && /沒有指令/.test(r) && /不是 git 開頭/.test(r));
    ok('git-helper: checkScenarios catches under-rated / duplicate / empty / non-git entries');
    // 搜尋
    const s = m.SCENARIOS;
    assert.strictEqual(m.searchScenarios(s, '', 'all').length, s.length);
    assert.ok(m.searchScenarios(s, 'amend').some(x => x.id === 'amend-msg'));
    assert.ok(m.searchScenarios(s, 'STASH').length >= 1);
    assert.ok(m.searchScenarios(s, 'rebase 互動').length >= 1);
    assert.strictEqual(m.searchScenarios(s, 'zzzzqq').length, 0);
    assert.ok(m.searchScenarios(s, '', 'danger').every(x => x.risk === 'danger') && m.searchScenarios(s, '', 'danger').length > 3);
    assert.strictEqual(m.searchScenarios(s, '   ').length, s.length);
    assert.strictEqual(m.searchScenarios(s, null).length, s.length);
    for (const key of ['cherry-pick', 'revert', 'blame', 'clean', 'remote', 'reflog']) assert.ok(m.searchScenarios(s, key).length >= 1, key);
    ok('git-helper: search (multi keyword, case-insensitive, risk filter)');
    // 引號、ref 驗證
    assert.strictEqual(m.q('abc-1.2'), 'abc-1.2'); assert.strictEqual(m.q('a b'), "'a b'"); assert.strictEqual(m.q("it's"), "'it'\\''s'"); assert.strictEqual(m.q('$(x)'), "'$(x)'");
    for (const g of ['main', 'feature/x', 'v1.0.0', 'fix_1']) assert.ok(m.validRef(g), g);
    for (const b of ['', 'a b', '-x', 'a..b', 'a.lock', 'a/', '/a', 'a//b', 'a~1', 'a^', 'a:b', 'a?', 'a*', 'a[', 'a\\b', '@', 'a@{1}', '.a', 'a.']) assert.ok(!m.validRef(b), JSON.stringify(b));
    for (const g of ['HEAD~2', 'abc123', 'origin/main', 'HEAD@{1}', 'v1.0']) assert.ok(m.validRev(g), g);
    for (const b of ['', '-x', 'a..b', 'a b', 'a;b', '$(x)']) assert.ok(!m.validRev(b), b);
    ok('git-helper: quoting and ref validation');
    // 組裝
    assert.strictEqual(m.buildCommit({ msg: 'fix bug' }).cmd, "git commit -m 'fix bug'");
    assert.strictEqual(m.buildCommit({ msg: 'x' }).cmd, 'git commit -m x');
    assert.strictEqual(m.buildCommit({ msg: 'x', all: true }).cmd, 'git commit -a -m x');
    assert.strictEqual(m.buildCommit({ msg: 'x', amend: true }).risk, 'undo');
    assert.strictEqual(m.buildCommit({ amend: true, noedit: true }).cmd, 'git commit --amend --no-edit');
    assert.ok(m.buildCommit({ msg: '  ' }).err);
    assert.strictEqual(m.buildCommit({ msg: "it's", all: true }).cmd, "git commit -a -m 'it'\\''s'");
    assert.strictEqual(m.buildCommit({ msg: 'x', empty: true }).cmd, 'git commit -m x --allow-empty');
    assert.strictEqual(m.buildBranch({ action: 'create', name: 'feat/a' }).cmd, 'git switch -c feat/a');
    assert.strictEqual(m.buildBranch({ action: 'create', name: 'a', from: 'main' }).cmd, 'git switch -c a main');
    assert.ok(m.buildBranch({ action: 'create', name: 'a b' }).err); assert.ok(m.buildBranch({ action: 'create', name: 'a', from: '-x' }).err);
    assert.strictEqual(m.buildBranch({ action: 'switch', name: 'main' }).cmd, 'git switch main');
    assert.strictEqual(m.buildBranch({ action: 'rename', name: 'a', newName: 'b' }).cmd, 'git branch -m a b');
    assert.ok(m.buildBranch({ action: 'rename', name: 'a', newName: '' }).err);
    assert.strictEqual(m.buildBranch({ action: 'delete', name: 'a' }).risk, 'undo');
    assert.strictEqual(m.buildBranch({ action: 'forceDelete', name: 'a' }).risk, 'danger');
    assert.strictEqual(m.buildBranch({ action: 'deleteRemote', name: 'a' }).risk, 'danger');
    assert.strictEqual(m.buildBranch({ action: 'list', all: true }).cmd, 'git branch -vv -a');
    assert.strictEqual(m.buildBranch({ action: 'list' }).risk, 'safe');
    assert.ok(m.buildBranch({ action: 'nope', name: 'a' }).err);
    assert.strictEqual(m.buildLog({}).cmd, 'git log --oneline');
    assert.strictEqual(m.buildLog({ fmt: 'graph', n: '10' }).cmd, 'git log --oneline --graph --decorate --all -n 10');
    assert.ok(m.buildLog({ n: '0' }).err && m.buildLog({ n: '1.5' }).err && m.buildLog({ n: '10000' }).err && m.buildLog({ n: 'x' }).err);
    assert.ok(m.buildLog({ author: 'Amy', path: 'a b.js', since: '2 weeks ago', grep: 'fix' }).cmd.includes('--author=Amy'));
    assert.ok(m.buildLog({ since: '2 weeks ago' }).cmd.includes("--since='2 weeks ago'"));
    assert.ok(m.buildLog({ path: 'a b.js' }).cmd.endsWith("-- 'a b.js'"));
    assert.ok(m.buildLog({ fmt: 'pretty' }).cmd.includes('--pretty=format:'));
    assert.strictEqual(m.buildReset({ mode: 'hard' }).cmd, 'git reset --hard HEAD~1');
    assert.strictEqual(m.buildReset({ mode: 'hard' }).risk, 'danger');
    assert.strictEqual(m.buildReset({ mode: 'soft', target: 'abc123' }).risk, 'undo');
    assert.strictEqual(m.buildReset({}).cmd, 'git reset --mixed HEAD~1');
    assert.ok(m.buildReset({ mode: 'x' }).err && m.buildReset({ target: 'a b' }).err && m.buildReset({ target: '-x' }).err);
    assert.strictEqual(m.buildRevert({ target: 'HEAD' }).cmd, 'git revert HEAD');
    assert.strictEqual(m.buildRevert({ target: 'abc', mainline: '1', noEdit: true }).cmd, 'git revert -m 1 --no-edit abc');
    assert.strictEqual(m.buildRevert({ target: 'abc', noCommit: true }).cmd, 'git revert --no-commit abc');
    assert.ok(m.buildRevert({}).err && m.buildRevert({ target: '-x' }).err);
    assert.strictEqual(m.buildTag({ name: 'v1.0.0' }).cmd, 'git tag v1.0.0');
    assert.strictEqual(m.buildTag({ name: 'v1.0.0', msg: 'release 1' }).cmd, "git tag -a v1.0.0 -m 'release 1'");
    assert.strictEqual(m.buildTag({ name: 'v1', target: 'abc' }).cmd, 'git tag v1 abc');
    assert.strictEqual(m.buildTag({ action: 'push', name: 'v1' }).cmd, 'git push origin v1');
    assert.strictEqual(m.buildTag({ action: 'delete', name: 'v1' }).cmd, 'git tag -d v1');
    assert.strictEqual(m.buildTag({ action: 'deleteRemote', name: 'v1' }).risk, 'danger');
    assert.ok(m.buildTag({ name: 'a b' }).err && m.buildTag({ action: 'zz', name: 'a' }).err);
    ok('git-helper: builders assemble commands, reject bad input, mark risk');
    // 每個表單用預設值與每個選項都不會丟例外；risk 與 riskOfCommand 一致
    for (const [k, f] of Object.entries(m.FORMS)) {
        const st = {}; for (const x of f.fields) st[x.k] = x.t === 'check' ? false : (x.d || (x.t === 'select' ? x.o[0][0] : ''));
        const r = f.build(st); assert.ok(r.err || (r.cmd && r.flags.length && r.risk === m.riskOfCommand(r.cmd)), k);
        for (const x of f.fields.filter(x => x.t === 'select')) for (const [v] of x.o) {
            const r2 = f.build(Object.assign({ name: 'a', newName: 'b', msg: 'm', target: 'HEAD' }, st, { [x.k]: v }));
            assert.ok(r2.err || r2.cmd, k + v); if (r2.cmd) assert.strictEqual(r2.risk, m.riskOfCommand(r2.cmd), r2.cmd);
        }
    }
    ok('git-helper: every form builds with default values; risk consistent');
}

// ---------- 跑步配速 ----------
{
    const m = load('utils/pace-calc.html', 'KM_PER_MI, PRESETS, parseTime, fmtTime, fmtPace, fmtNum, parseNum, calc, rateToSecPerKm, toKm, fromKm, riegel, RIEGEL_DISTS, splits, OPT_DEFAULT, loadOpts');
    const nan = (v) => assert.ok(Number.isNaN(v), String(v));
    assert.strictEqual(m.parseTime('25:30'), 1530); assert.strictEqual(m.parseTime('1:45:00'), 6300); assert.strictEqual(m.parseTime('90:00'), 5400);
    assert.strictEqual(m.parseTime('25.5'), 1530); assert.strictEqual(m.parseTime('25'), 1500); assert.strictEqual(m.parseTime('0:59.5'), 59.5);
    assert.strictEqual(m.parseTime('25：30'), 1530); assert.strictEqual(m.parseTime(' 5:00 '), 300); assert.strictEqual(m.parseTime('0'), 0);
    for (const b of ['', null, undefined, 'abc', '1:2:3:4', '1:60', '1:75:00', '-5', '1.5:30', ':30', '5:', '1e3', '5:-1', '.5']) nan(m.parseTime(b));
    ok('pace: parseTime accepts h:mm:ss / mm:ss / decimal minutes, rejects junk');
    assert.strictEqual(m.fmtTime(59.5), '1:00'); assert.strictEqual(m.fmtTime(59.4), '0:59'); assert.strictEqual(m.fmtTime(3599.5), '1:00:00'); assert.strictEqual(m.fmtTime(3600), '1:00:00');
    assert.strictEqual(m.fmtTime(0), '0:00'); assert.strictEqual(m.fmtTime(7325), '2:02:05'); assert.strictEqual(m.fmtTime(-1), '—'); assert.strictEqual(m.fmtTime(NaN), '—'); assert.strictEqual(m.fmtTime(Infinity), '—');
    assert.strictEqual(m.fmtPace(330), '5:30'); assert.strictEqual(m.fmtPace(4500), '75:00'); assert.strictEqual(m.fmtPace(299.5), '5:00'); assert.strictEqual(m.fmtPace(NaN), '—');
    for (let s = 0; s < 20000; s += 7.3) { assert.ok(!/:6\d/.test(m.fmtTime(s)), String(s)); assert.ok(!/:6\d$/.test(m.fmtPace(s)), String(s)); }
    ok('pace: formatting rounds seconds first (59.5 s -> 1:00, never 0:60)');
    assert.strictEqual(m.parseNum('5'), 5); assert.strictEqual(m.parseNum('5.5'), 5.5); assert.strictEqual(m.parseNum('.5'), .5); nan(m.parseNum('')); nan(m.parseNum('-1')); nan(m.parseNum('1e3')); nan(m.parseNum('a')); nan(m.parseNum(null));
    // 三者算第四者
    let r = m.calc('pace', { distKm: 5, timeSec: 1500 }); assert.strictEqual(r.secPerKm, 300); near(r.kmh, 12);
    r = m.calc('time', { distKm: 10, secPerKm: 330 }); assert.strictEqual(r.timeSec, 3300);
    r = m.calc('dist', { timeSec: 1800, secPerKm: 360 }); assert.strictEqual(r.distKm, 5);
    near(m.calc('pace', { distKm: 42.195, timeSec: 7200 }).secPerKm, 170.6, 1e-3);
    for (const mode of ['pace', 'time', 'dist']) for (const bad of [0, -1, NaN, Infinity, undefined]) assert.ok(m.calc(mode, { distKm: bad, timeSec: bad, secPerKm: bad }).err, mode);
    assert.ok(m.calc('pace', { distKm: 0, timeSec: 100 }).err); assert.ok(m.calc('pace', { distKm: 5, timeSec: 0 }).err);
    assert.ok(m.calc('x', {}).err);
    assert.ok(m.calc('pace', { distKm: 1e9, timeSec: 100 }).err, 'huge dist'); assert.ok(m.calc('time', { distKm: 5000, secPerKm: 36000 }).err, 'huge time');
    assert.ok(m.calc('pace', { distKm: 10000, timeSec: 1 }).err, 'absurdly fast'); assert.ok(m.calc('dist', { timeSec: 1e8, secPerKm: 1 }).err);
    assert.ok(!m.calc('pace', { distKm: 0.001, timeSec: 1 }).err);
    for (let i = 0; i < 300; i++) {
        const d = 0.5 + i * 0.7, p = 150 + (i * 13) % 500, t = d * p;
        near(m.calc('pace', { distKm: d, timeSec: t }).secPerKm, p); near(m.calc('time', { distKm: d, secPerKm: p }).timeSec, t); near(m.calc('dist', { timeSec: t, secPerKm: p }).distKm, d);
    }
    ok('pace: calc any-of-three round trips; 0 / negative / NaN / huge are rejected');
    near(m.rateToSecPerKm('5:00', 'pkm'), 300); near(m.rateToSecPerKm('8:02.8032', 'pmi'), 300, 1e-4); near(m.rateToSecPerKm('12', 'kmh'), 300); near(m.rateToSecPerKm('7.46', 'mph'), 3600 / (7.46 * 1.609344));
    for (const [t, u] of [['', 'pkm'], ['0', 'kmh'], ['abc', 'mph'], ['0:00', 'pmi'], ['-3', 'kmh']]) nan(m.rateToSecPerKm(t, u));
    near(m.toKm(1, 'mi'), 1.609344); near(m.fromKm(m.toKm(13.1, 'mi'), 'mi'), 13.1); assert.strictEqual(m.toKm(5, 'km'), 5);
    ok('pace: min/km, min/mile, km/h, mph conversions');
    near(m.riegel(1500, 5, 10), 1500 * Math.pow(2, 1.06)); near(m.riegel(1500, 5, 5), 1500); near(m.riegel(1500, 5, 10, 1), 3000);
    near(m.riegel(1200, 5, 42.195, 1.06), 1200 * Math.pow(42.195 / 5, 1.06));
    for (const a of [[0, 5, 10], [100, 0, 10], [100, 5, 0], [100, 5, 10, 0.9], [100, 5, 10, 1.3], [NaN, 5, 10], [-1, 5, 10]]) nan(m.riegel(...a));
    let prev = 0; for (const [, d] of m.RIEGEL_DISTS.slice().sort((a, b) => a[1] - b[1])) { const t = m.riegel(1500, 5, d); assert.ok(t > prev); prev = t; }
    ok('pace: Riegel formula, exponent range, monotonic in distance');
    let sp = m.splits(5, 1500, 'km', 0); assert.strictEqual(sp.length, 5); sp.forEach(s => { assert.strictEqual(s.len, 1); near(s.segTime, 300); }); assert.strictEqual(sp[4].cumTime, 1500);
    sp = m.splits(10, 3000, 'km', 5); assert.strictEqual(sp.length, 10); near(sp[0].pace, 315); near(sp[9].pace, 285); assert.strictEqual(sp[9].cumTime, 3000);
    near(sp.reduce((a, s) => a + s.segTime, 0), 3000); for (let i = 1; i < sp.length; i++) assert.ok(sp[i].pace <= sp[i - 1].pace + 1e-9);
    sp = m.splits(21.0975, 6000, 'km', 3); assert.strictEqual(sp.length, 22); near(sp[21].len, 0.0975); assert.strictEqual(sp[21].cumTime, 6000); near(sp.reduce((a, s) => a + s.segTime, 0), 6000);
    sp = m.splits(5, 1500, 'km', 4); near(sp.reduce((a, s) => a + s.segTime, 0), 1500); near(sp[2].pace, 300, 1e-9);
    sp = m.splits(0.5, 150, 'km', 10); assert.strictEqual(sp.length, 1); near(sp[0].len, 0.5); assert.strictEqual(sp[0].cumTime, 150);
    sp = m.splits(10, 3000, 'mi', 0); assert.strictEqual(sp.length, 7); near(sp[0].segTime, 3000 / (10 / 1.609344), 1e-9); assert.strictEqual(sp[6].cumTime, 3000);
    sp = m.splits(42.195, 10800, 'km', 5); assert.strictEqual(sp.length, 43); near(sp.reduce((a, s) => a + s.segTime, 0), 10800);
    for (const a of [[0, 100], [5, 0], [5, 100, 'km', -1], [5, 100, 'km', 100], [NaN, 100], [5, NaN]]) assert.deepStrictEqual(m.splits(...a), []);
    ok('pace: splits are consistent (sum = total, last partial split, negative split ordering, miles)');
    assert.deepStrictEqual(m.loadOpts(null), m.OPT_DEFAULT); assert.deepStrictEqual(m.loadOpts([]), m.OPT_DEFAULT); assert.deepStrictEqual(m.loadOpts('x'), m.OPT_DEFAULT); assert.deepStrictEqual(m.loadOpts(5), m.OPT_DEFAULT);
    const o = m.loadOpts({ mode: 'time', distU: 'mi', time: '30:00', k: 5, neg: 'x'.repeat(100), preset: 'zzz', rateU: 'mph', evil: 1 });
    assert.strictEqual(o.mode, 'time'); assert.strictEqual(o.distU, 'mi'); assert.strictEqual(o.time, '30:00'); assert.strictEqual(o.k, '1.06'); assert.strictEqual(o.neg, '0'); assert.strictEqual(o.preset, '5k'); assert.strictEqual(o.rateU, 'mph'); assert.ok(!('evil' in o));
    ok('pace: loadOpts validates and falls back to defaults on bad data');
}
// ---------- 面額點算與找零 ----------
{
    const m = load('utils/cash-count.html', 'CURRENCIES, activeDenoms, parseCount, parseAmount, fmtMoney, denomLabel, total, change, minPieces, consolidate, breakInto, makeChange, quickPaid, countPieces, MAX_COUNT');
    const nan = (v) => assert.ok(Number.isNaN(v), String(v));
    // 面額表
    assert.deepStrictEqual(m.activeDenoms('twd', false).map(d => d.v), [1000, 500, 200, 100, 50, 10, 5, 1]);
    assert.deepStrictEqual(m.activeDenoms('twd', true).map(d => d.v), [2000, 1000, 500, 200, 100, 50, 20, 10, 5, 1]);
    for (const [k, c] of Object.entries(m.CURRENCIES)) {
        const vs = c.denoms.map(d => d.v);
        assert.ok(vs.every(Number.isInteger) && new Set(vs).size === vs.length && vs.every((v, i) => !i || v < vs[i - 1]), k + ' denoms sorted unique ints');
        assert.strictEqual(vs[vs.length - 1], 1, k + ' has smallest unit 1');
    }
    ok('cash: currency tables (sorted, unique, integer minor units, TWD optional notes)');
    // 貪心 = DP 最佳（所有幣別、含 / 不含紀念面額；0..6000 逐一驗證）
    for (const cur of Object.keys(m.CURRENCIES)) for (const opt of [false, true]) {
        const vs = m.activeDenoms(cur, opt).map(d => d.v);
        for (let a = 0; a <= 6000; a++) {
            const g = m.change(a, vs); assert.ok(g, `${cur} ${a}`);
            assert.strictEqual(m.countPieces(g), m.minPieces(a, vs), `${cur} opt=${opt} amount=${a}`);
            assert.strictEqual(Object.entries(g).reduce((s, [v, n]) => s + v * n, 0), a);
        }
    }
    ok('cash: greedy change equals DP optimum for every amount 0..6000, every currency set (with/without 2000 & 20)');
    // 較大金額抽樣（種子可重現）
    {
        const R = Util.seeded('cash-big');
        for (const cur of Object.keys(m.CURRENCIES)) {
            const vs = m.activeDenoms(cur, true).map(d => d.v);
            for (let i = 0; i < 120; i++) { const a = R.int(30000) + 6000; assert.strictEqual(m.countPieces(m.change(a, vs)), m.minPieces(a, vs), `${cur} ${a}`); }
        }
    }
    ok('cash: greedy = DP on random larger amounts');
    assert.deepStrictEqual(m.change(113, [100, 10, 1]), { 100: 1, 10: 1, 1: 3 });
    assert.deepStrictEqual(m.change(0, [100, 1]), {});
    assert.strictEqual(m.change(5, [10]), null); assert.strictEqual(m.change(-1, [1]), null); assert.strictEqual(m.change(1.5, [1]), null); assert.strictEqual(m.change(NaN, [1]), null);
    assert.deepStrictEqual(m.change(30, [1, 20, 10]), { 20: 1, 10: 1 }); // 不要求輸入已排序
    // 證明：非標準面額組貪心會失敗，DP 能抓到（確認核對方法有鑑別力）
    assert.ok(m.countPieces(m.change(6, [4, 3, 1])) > m.minPieces(6, [4, 3, 1]));
    ok('cash: change basics and the DP check can detect a non-canonical set');
    // 解析
    assert.strictEqual(m.parseCount(''), 0); assert.strictEqual(m.parseCount(' 12 '), 12); assert.strictEqual(m.parseCount(null), 0); assert.strictEqual(m.parseCount('1000000'), 1000000);
    for (const b of ['-1', '1.5', 'a', '1e3', '1000001', '0x10', '１２']) nan(m.parseCount(b));
    assert.strictEqual(m.parseAmount('387', 0), 387); assert.strictEqual(m.parseAmount('1,234', 0), 1234); assert.strictEqual(m.parseAmount('12.34', 2), 1234); assert.strictEqual(m.parseAmount('12.3', 2), 1230);
    assert.strictEqual(m.parseAmount('12', 2), 1200); assert.strictEqual(m.parseAmount('0.05', 2), 5); assert.strictEqual(m.parseAmount('2.5', 1), 25); assert.strictEqual(m.parseAmount('12.', 2), 1200); assert.strictEqual(m.parseAmount('0', 0), 0);
    for (const [b, sc] of [['', 0], ['12.5', 0], ['12.345', 2], ['-1', 0], ['abc', 0], ['1e3', 0], ['.5', 1], ['9999999999999', 0], [null, 0]]) nan(m.parseAmount(b, sc));
    ok('cash: parseCount / parseAmount (no float error, rejects negative / too many decimals / huge)');
    // 顯示
    assert.strictEqual(m.fmtMoney(2975, 'twd'), 'NT$2,975'); assert.strictEqual(m.fmtMoney(0, 'twd'), 'NT$0'); assert.strictEqual(m.fmtMoney(1234567, 'jpy'), '¥1,234,567');
    assert.strictEqual(m.fmtMoney(1234, 'usd'), '$12.34'); assert.strictEqual(m.fmtMoney(5, 'usd'), '$0.05'); assert.strictEqual(m.fmtMoney(25, 'cny'), '¥2.5'); assert.strictEqual(m.fmtMoney(-100, 'twd'), '-NT$100'); assert.strictEqual(m.fmtMoney(NaN, 'twd'), '—');
    assert.strictEqual(m.denomLabel(1000, 'twd'), '1,000'); assert.strictEqual(m.denomLabel(25, 'usd'), '0.25'); assert.strictEqual(m.denomLabel(10000, 'usd'), '100'); assert.strictEqual(m.denomLabel(5, 'cny'), '0.5');
    ok('cash: money formatting');
    // 點算
    const c1 = { 1000: 2, 500: 1, 100: 3, 50: 2, 10: 7, 1: 5 };
    assert.deepStrictEqual(m.total(c1), { sum: 2975, pieces: 20 });
    assert.deepStrictEqual(m.total({}), { sum: 0, pieces: 0 }); assert.deepStrictEqual(m.total(null), { sum: 0, pieces: 0 });
    assert.deepStrictEqual(m.total({ 100: -3, 50: 1.5, 10: NaN, 5: 2 }), { sum: 10, pieces: 2 });
    const v8 = [1000, 500, 200, 100, 50, 10, 5, 1];
    const cs = m.consolidate(c1, v8);
    assert.strictEqual(cs.sum, 2975); assert.strictEqual(cs.from, 20); assert.strictEqual(cs.to, 9); assert.deepStrictEqual(cs.best, { 1000: 2, 500: 1, 200: 2, 50: 1, 10: 2, 5: 1 });
    assert.ok(cs.moves.length > 0 && cs.moves.every(x => x.from !== x.to));
    // 套用建議後總額不變、張數不增
    {
        const R = Util.seeded('cash-con');
        for (let i = 0; i < 300; i++) {
            const c = {}; for (const v of v8) if (R.int(2)) c[v] = R.int(40);
            const r = m.consolidate(c, v8); assert.strictEqual(m.total(r.best).sum, m.total(c).sum); assert.ok(r.to <= r.from);
            const applied = Object.assign({}, c); for (const x of r.moves) applied[x.v] = x.to; assert.deepStrictEqual(Object.fromEntries(Object.entries(applied).filter(([, n]) => n)), r.best);
        }
    }
    assert.strictEqual(m.consolidate({}, v8).moves.length, 0); assert.strictEqual(m.consolidate({ 1000: 1 }, v8).moves.length, 0);
    ok('cash: total and consolidation (sum preserved, never more pieces, moves reproduce best)');
    // 大額換小額
    let b = m.breakInto(1000, v8);
    assert.deepStrictEqual(b.map(x => x.cap), [500, 200, 100, 50, 10, 5, 1]);
    assert.deepStrictEqual(b[0].combo, { 500: 2 }); assert.deepStrictEqual(b[1].combo, { 200: 5 }); assert.deepStrictEqual(b[6].combo, { 1: 1000 });
    for (const x of b) { assert.strictEqual(m.total(x.combo).sum, 1000); assert.ok(Object.keys(x.combo).every(v => +v <= x.cap)); }
    assert.deepStrictEqual(m.breakInto(1, v8), []);
    assert.deepStrictEqual(m.breakInto(100, [100, 50, 20, 10, 5, 1])[1].combo, { 20: 5 });
    ok('cash: breaking a large note into smaller denominations');
    // 找零
    assert.deepStrictEqual(m.makeChange(387, 500, v8), { change: 113, combo: { 100: 1, 10: 1, 1: 3 } });
    assert.deepStrictEqual(m.makeChange(500, 500, v8), { change: 0, combo: {} });
    assert.deepStrictEqual(m.makeChange(500, 387, v8), { short: 113 });
    assert.ok(m.makeChange(-1, 5, v8).err && m.makeChange(NaN, 5, v8).err && m.makeChange(1, 1.5, v8).err);
    assert.strictEqual(m.makeChange(0, 0, v8).change, 0);
    {
        const R = Util.seeded('cash-ch');
        for (let i = 0; i < 500; i++) {
            const due = R.int(5000), paid = due + R.int(3000), r = m.makeChange(due, paid, v8);
            assert.strictEqual(r.change, paid - due); assert.strictEqual(m.total(r.combo).sum, paid - due); assert.strictEqual(m.countPieces(r.combo), m.minPieces(paid - due, v8));
        }
    }
    ok('cash: makeChange (exact / short / invalid; change sums correctly and is minimal)');
    assert.deepStrictEqual(m.quickPaid(387, v8), [387, 390, 400, 500]);
    assert.deepStrictEqual(m.quickPaid(0, v8), []); assert.deepStrictEqual(m.quickPaid(NaN, v8), []); assert.ok(m.quickPaid(1, v8).length <= 4);
    assert.ok(m.quickPaid(387, v8).every(x => x >= 387));
    ok('cash: quick paid suggestions');
}
// ---------- 德州撲克勝率 ----------
{
    const m = load('utils/poker-odds.html', 'RANKS, SUITS, CATS, cardStr, cardOf, handOf, evalHand, catOf, handName, validateSetup, makeSim, margin');
    const H = (s) => m.handOf(s), E = (s) => m.evalHand(H(s)), cat = (s) => m.catOf(E(s));
    // 牌編號與字串
    assert.strictEqual(m.cardOf('2s'), 0); assert.strictEqual(m.cardOf('As'), 12); assert.strictEqual(m.cardOf('2h'), 13); assert.strictEqual(m.cardOf('Ac'), 51); assert.strictEqual(m.cardOf('ah'), 25);
    for (const b of ['', 'A', 'Axs', '1s', 'Ax', 'Zs', null]) assert.strictEqual(m.cardOf(b), -1, String(b));
    assert.strictEqual(m.cardStr(8), '10♠'); assert.strictEqual(m.cardStr(12), 'A♠'); assert.strictEqual(m.cardStr(13), '2♥');
    for (let c = 0; c < 52; c++) assert.strictEqual(m.cardOf(m.RANKS[c % 13] + 'shdc'[(c / 13) | 0]), c);
    ok('poker: card encoding');
    // 各牌型與已知樣本
    assert.strictEqual(cat('Ah Kh Qh Jh Th 2c 3d'), 8); assert.strictEqual(m.handName(E('Ah Kh Qh Jh Th 2c 3d')), '皇家同花順');
    assert.strictEqual(m.handName(E('9h 8h 7h 6h 5h 2c 3d')), '同花順');
    assert.strictEqual(cat('4s 4h 4d 4c Ks 2c 3d'), 7); assert.strictEqual(cat('Ks Kh Kd 9c 9s 2c 3d'), 6); assert.strictEqual(cat('As 9s 5s 3s 2s Kd Qc'), 5);
    assert.strictEqual(cat('9s 8h 7d 6c 5s 2c Kd'), 4); assert.strictEqual(cat('Qs Qh Qd 9c 5s 2c 3d'), 3); assert.strictEqual(cat('Qs Qh 9d 9c 5s 2c 3d'), 2);
    assert.strictEqual(cat('Qs Qh 8d 9c 5s 2c 3d'), 1); assert.strictEqual(cat('As Qh 8d 9c 5s 2c 3d'), 0);
    // A-5 順子是最小的順子；A-K-Q-J-T 最大；環繞不算
    assert.ok(E('As 2h 3d 4c 5s') < E('2s 3h 4d 5c 6s')); assert.strictEqual(cat('As 2h 3d 4c 5s'), 4); assert.ok(E('Ts Jh Qd Kc As') > E('9s Th Jd Qc Ks'));
    assert.strictEqual(cat('Qs Kh Ad 2c 3s'), 0); assert.strictEqual(cat('Js Qh Kd Ac 2s'), 0);
    assert.strictEqual(cat('As 2s 3s 4s 5s'), 8); assert.ok(E('As 2s 3s 4s 5s') < E('2s 3s 4s 5s 6s'));
    assert.ok(E('As 2s 3s 4s 5s') > E('9d 9h 9c 9s 2s'));
    // 7 張特殊情形
    assert.strictEqual(E('As 2h 3d 4c 5s 6h 7d'), E('3d 4c 5s 6h 7d 2h 9c')); // 7 高順子
    assert.strictEqual(m.handName(E('As 2h 3d 4c 5s Kd Kc')), '順子');
    assert.ok(E('5s 6h 7d 8c 9s 2h 3d') > E('As 2h 3d 4c 5s 9h Kd'));
    assert.strictEqual(E('Ks Kh Kd 9c 9s 9h 2c'), E('Ks Kh Kd 9c 9s 5h 2c'), 'two trips: pair = lower trips');
    assert.strictEqual(E('Ks Kh Kd Qc Qs 9h 9c'), E('Ks Kh Kd Qc Qs 2h 3c')); // 三條 + 兩對：葫蘆用較大的對子
    assert.strictEqual(cat('As Ah Ks Kh Qs Qh Jd'), 2); assert.strictEqual(E('As Ah Ks Kh Qs Qh Jd'), E('As Ah Ks Kh Qs 2h Jd'), 'three pairs: third pair can be the kicker');
    assert.ok(E('As Ah Ks Kh Qs Qh 2d') > E('As Ah Ks Kh Jd Tc 2d'));
    assert.strictEqual(E('4s 4h 4d 4c 3s 3h 3d'), E('4s 4h 4d 4c 3c 2h 2d')); // 四條 + 三條：踢腳取 3
    assert.ok(E('4s 4h 4d 4c As 2h 3d') > E('4s 4h 4d 4c Ks 2h 3d'));
    assert.strictEqual(m.handName(E('2s 3s 4s 5s 7s 8s 9s')), '同花');
    assert.strictEqual(E('2s 3s 4s 5s 7s 8s Ks'), E('3s 4s 5s 7s 8s Ks 2s'));
    assert.ok(E('Ks 3s 4s 5s 7s 8s 2s') > E('Qs 3s 4s 5s 7s 8s 2s')); // 同花比最高的五張
    assert.strictEqual(m.handName(E('5s 6s 7s 8s 9s Ah Kh')), '同花順');
    assert.strictEqual(m.handName(E('5s 6s 7s 8s 9h Ah Ad')), '順子'); // 同花順要同一花色
    assert.strictEqual(m.handName(E('5s 6s 7s 8s 9h 2s 3s')), '同花');
    assert.ok(E('Ah 5h 6h 7h 8h 9s 9d') < E('4h 5h 6h 7h 8h 9h 9d')); // 同花順優先於同花
    // 比較：踢腳、平分
    assert.ok(E('As Ah Ks Qd Jc 3h 2d') > E('Ad Ac Ks Qd Tc 3h 2d'));
    assert.strictEqual(E('As Ah Ks Qd Jc 3h 2d'), E('Ad Ac Kc Qs Jh 3d 2s'));
    assert.ok(E('As Ah 2d 3c 9s 8d Kh') > E('Ks Kh Ad 3c 9s 8d 2h'));
    assert.ok(E('Ks Kh Qd Qc 2s 3d 4h') > E('Ks Kh Jd Jc Ad 3d 4h'));
    assert.ok(E('Ks Kh Qd Qc As 3d 4h') > E('Ks Kh Qd Qc Js 3d 4h'));
    assert.ok(E('2s 2h 2d As Ks 9c 8h') > E('As Ah 9d Ks Qc Jh 8d'));
    assert.ok(E('3s 3h 3d 3c 2s 7c 8h') > E('2s 2h 2d 2c As 7c 8h'));
    assert.ok(E('Ks Kh Kd 2c 2s 3c 4d') > E('Qs Qh Qd Ac As 3c 4d'));
    assert.ok(E('As Kh 9d 5c 3s 2c 8h') > E('Ks Qh Jd Tc 8s 2c 3h'));
    ok('poker: every category, wheel, kickers, special 7-card situations');
    // 5 張全部 C(52,5) = 2,598,960 手牌：各牌型張數 + 不同強度值 7462 個
    {
        const exp = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
        const cnt = new Array(9).fill(0), seen = new Set(), seenCat = new Array(9).fill(0), tmp = [0, 0, 0, 0, 0]; let total = 0, royal = 0;
        for (let a = 0; a < 48; a++) for (let b = a + 1; b < 49; b++) for (let c = b + 1; c < 50; c++) for (let d = c + 1; d < 51; d++) for (let e = d + 1; e < 52; e++) {
            tmp[0] = a; tmp[1] = b; tmp[2] = c; tmp[3] = d; tmp[4] = e;
            const s = m.evalHand(tmp), k = m.catOf(s); cnt[k]++; total++;
            if (!seen.has(s)) { seen.add(s); seenCat[k]++; }
            if (s === 8 * 13 ** 5 + 12 * 13 ** 4) royal++;
        }
        assert.strictEqual(total, 2598960);
        assert.deepStrictEqual(cnt, exp);
        assert.strictEqual(royal, 4);
        assert.strictEqual(seen.size, 7462);
        assert.deepStrictEqual(seenCat, [1277, 2860, 858, 858, 10, 1277, 156, 156, 10]);
    }
    ok('poker: all 2,598,960 five-card hands match known counts (1302540/1098240/123552/54912/10200/5108/3744/624/40) and 7462 distinct strengths');
    // 7 張 = 21 個五張子集的最大值（種子隨機 20000 手）；順便核對 7 張牌型機率的理論值
    {
        const R = Util.seeded('poker7'), cats7 = new Array(9).fill(0);
        for (let i = 0; i < 20000; i++) {
            const deck = Array.from({ length: 52 }, (_, k) => k); for (let j = 0; j < 7; j++) { const k = j + R.int(52 - j); [deck[j], deck[k]] = [deck[k], deck[j]]; }
            const h = deck.slice(0, 7); let best = -1;
            for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) best = Math.max(best, m.evalHand(h.filter((_, x) => x !== a && x !== b)));
            assert.strictEqual(m.evalHand(h), best, h.map(m.cardStr).join(' '));
            assert.strictEqual(m.evalHand(h), m.evalHand(h.slice().reverse()));
        }
        for (let i = 0; i < 3000; i++) {
            const deck = Array.from({ length: 52 }, (_, k) => k); for (let j = 0; j < 6; j++) { const k = j + R.int(52 - j); [deck[j], deck[k]] = [deck[k], deck[j]]; }
            const h = deck.slice(0, 6); let best = -1; for (let a = 0; a < 6; a++) best = Math.max(best, m.evalHand(h.filter((_, x) => x !== a)));
            assert.strictEqual(m.evalHand(h), best);
        }
        const N = 60000;
        for (let i = 0; i < N; i++) {
            const deck = Array.from({ length: 52 }, (_, k) => k); for (let j = 0; j < 7; j++) { const k = j + R.int(52 - j); [deck[j], deck[k]] = [deck[k], deck[j]]; }
            cats7[m.catOf(m.evalHand(deck.slice(0, 7)))]++;
        }
        // 7 張牌型理論機率：高牌 17.41%、一對 43.80%、兩對 23.50%、三條 4.83%、順子 4.62%、同花 3.03%、葫蘆 2.60%
        [[0, .1741], [1, .4380], [2, .2350], [3, .0483], [4, .0462], [5, .0303], [6, .0260]].forEach(([k, p]) => assert.ok(Math.abs(cats7[k] / N - p) < Math.max(0.004, p * 0.12), `cat ${k}: ${cats7[k] / N} vs ${p}`));
    }
    ok('poker: 7-card (and 6-card) evaluation equals best of all 5-card subsets on 23000 seeded hands; 7-card category rates match theory');
    // 設定驗證
    assert.strictEqual(m.validateSetup({ hole: [0, 1], board: [], opps: [null] }), null);
    assert.strictEqual(m.validateSetup({ hole: [0, 1], board: [2, 3, 4, 5, 6], opps: [null, [7, 8]] }), null);
    for (const bad of [null, {}, { hole: [0], board: [], opps: [null] }, { hole: [0, 1], board: [2, 3, 4, 5, 6, 7], opps: [null] }, { hole: [0, 1], board: [], opps: [] },
    { hole: [0, 1], board: [], opps: new Array(9).fill(null) }, { hole: [0, 1], board: [], opps: [[5]] }, { hole: [0, 0], board: [], opps: [null] }, { hole: [0, 1], board: [1], opps: [null] },
    { hole: [0, 1], board: [], opps: [[1, 2]] }, { hole: [0, 52], board: [], opps: [null] }, { hole: [0, -1], board: [], opps: [null] }, { hole: [0, 1.5], board: [], opps: [null] }, { hole: [0, 1], board: [], opps: [[2, 2]] }])
        assert.ok(m.validateSetup(bad), JSON.stringify(bad));
    assert.strictEqual(m.validateSetup({ hole: [0, 1], board: [2, 3, 4], opps: new Array(8).fill(null) }), null);
    ok('poker: setup validation (card count, duplicates, range, opponent count)');
    // 模擬
    const sim = (cfg, n, seed = 'p') => { const s = m.makeSim(cfg); s.run(n, Util.seeded(seed)); return s.acc; };
    let a = sim({ hole: H('Ah Kh'), board: H('Qh Jh Th'), opps: [null, null] }, 3000);
    assert.strictEqual(a.cats[8], 3000); assert.strictEqual(a.win, 3000); // 皇家同花順不可能被打敗或平分
    a = sim({ hole: H('As Ad'), board: H('Ks Kd 2c 7h 9s'), opps: [H('Kh Kc')] }, 10); assert.strictEqual(a.lose, 10);
    a = sim({ hole: H('As Ad'), board: H('Ac Kd 2c 7h 9s'), opps: [H('Kh Kc')] }, 10); assert.strictEqual(a.win, 10);
    a = sim({ hole: H('As Kd'), board: H('2c 3d 4h 9s Jd'), opps: [H('Ah Kc')] }, 10); assert.strictEqual(a.tie, 10); assert.strictEqual(a.equity, 5);
    a = sim({ hole: H('As Kd'), board: H('2c 3d 4h 9s Jd'), opps: [H('Ah Kc'), H('Ac Ks')] }, 10); assert.strictEqual(a.tie, 10); near(a.equity, 10 / 3);
    {
        const cfg = { hole: H('Ah Kh'), board: H('Qh Jh 2c 3d'), opps: [H('9c 9d')] };
        let w = 0, t = 0, l = 0; const used = new Set([...cfg.hole, ...cfg.board, ...cfg.opps[0]]);
        for (let c = 0; c < 52; c++) if (!used.has(c)) { const s1 = m.evalHand(cfg.hole.concat(cfg.board, c)), s2 = m.evalHand(cfg.opps[0].concat(cfg.board, c)); s1 > s2 ? w++ : s1 === s2 ? t++ : l++; }
        assert.strictEqual(w + t + l, 44);
        const r = sim(cfg, 40000, 'river'); near(r.win / r.n, w / 44, 0.02); near(r.lose / r.n, l / 44, 0.02);
    }
    ok('poker: forced boards give exact results (including multi-way ties); one-card-to-come matches full enumeration');
    // 已知翻牌前勝率（對照公開的標準值，容許隨機誤差）
    a = sim({ hole: H('As Ah'), board: [], opps: [H('Kd Kc')] }, 40000, 'aa-kk'); near(a.win / a.n, 0.82, 0.02); assert.ok(a.tie / a.n < 0.02);
    a = sim({ hole: H('As Ah'), board: [], opps: [null] }, 40000, 'aa-rand'); near(a.win / a.n, 0.852, 0.02);
    a = sim({ hole: H('7s 2h'), board: [], opps: [null] }, 40000, '72'); assert.ok(a.equity / a.n > 0.30 && a.equity / a.n < 0.40, String(a.equity / a.n));
    a = sim({ hole: H('As Ks'), board: [], opps: [H('Qh Qd')] }, 40000, 'aks-qq'); near(a.win / a.n, 0.46, 0.04);
    const eqs = [1, 2, 4, 8].map(k => { const r = sim({ hole: H('As Ah'), board: [], opps: new Array(k).fill(null) }, 6000, 'many' + k); return r.win / r.n; });
    for (let i = 1; i < eqs.length; i++) assert.ok(eqs[i] < eqs[i - 1], eqs.join());
    assert.ok(eqs[3] > 0.25 && eqs[3] < 0.45, 'AA vs 8 opponents: ' + eqs[3]);
    ok('poker: pre-flop equities match published values (AA vs KK ~82%, AA vs random ~85%, AKs vs QQ ~46%) and fall with more opponents');
    // 累計、分批、可重現
    {
        const cfg = { hole: H('Js Th'), board: H('9c 8d'), opps: [null, H('Ac Ad')] };
        const s1 = m.makeSim(cfg), r1 = Util.seeded('same'); s1.run(700, r1); s1.run(800, r1);
        a = s1.acc; assert.strictEqual(a.n, 1500); assert.strictEqual(a.win + a.tie + a.lose, 1500); assert.strictEqual(a.cats.reduce((x, y) => x + y, 0), 1500);
        assert.ok(a.equity >= a.win && a.equity <= a.win + a.tie);
        const s2 = m.makeSim(cfg), r2 = Util.seeded('same'); s2.run(700, r2); s2.run(800, r2);
        assert.deepStrictEqual(s2.acc, a);
        const s3 = m.makeSim(cfg); s3.run(1500, Util.seeded('other')); assert.notDeepStrictEqual(s3.acc, a);
    }
    ok('poker: batches accumulate and seeded runs reproduce');
    near(m.margin(0.5, 20000), 0.69, 0.02); assert.strictEqual(m.margin(0.5, 0), 0); assert.strictEqual(m.margin(1, 100), 0);
    ok('poker: margin of error');
}
