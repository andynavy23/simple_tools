// l5 批次：utils/math-sci-calc.html 數理計算的純邏輯
const { load, ok, near, read } = require('./_load');
const assert = require('assert');
const M = load('utils/math-sci-calc.html', 'fmt, bigStr, parseNum, big, gcd, lcm, gcdAll, lcmAll, mod, euclidLines, egcd, modpow, modinv, isPrime, factorize, phiOf, tauOf, sigmaOf, nextPrime, prevPrime, parseNums, describe, erfc, normCdf, normInv, parseProb, fact, perm, comb, combRep, permRep, arrangements, binomStats, expectation, GEO, geoCalc, pythag, solveTri, coord, compileExpr, analyze, MASS, parseFormula, molarMass, composition, balance, molarity, dilution, CONSTANTS, FORMULAS, freeFall, projectile, pendulum');
const f = (s, x = 0) => { const r = M.compileExpr(s); assert.ok(r.fn, s + ' ' + r.error); return r.fn(x); };
const bad = (s) => assert.ok(M.compileExpr(s).error, '應該報錯：' + s);
let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

// ---- 數論 ----
{
    const ngcd = (a, b) => { for (let d = Math.min(a, b); d >= 1; d--) if (a % d === 0 && b % d === 0) return d; return 1; };
    for (let i = 0; i < 300; i++) {
        const a = 1 + rnd(5000), b = 1 + rnd(5000), g = ngcd(a, b);
        assert.strictEqual(M.gcd(BigInt(a), BigInt(b)), BigInt(g));
        assert.strictEqual(M.lcm(BigInt(a), BigInt(b)), BigInt(a * b / g));
        const e = M.egcd(BigInt(a), BigInt(b));
        assert.strictEqual(BigInt(a) * e.x + BigInt(b) * e.y, e.g);
    }
    assert.strictEqual(M.gcdAll([48n, 180n, 36n]), 12n); assert.strictEqual(M.lcmAll([4n, 6n, 10n]), 60n);
    assert.strictEqual(M.gcd(0n, 0n), 0n); assert.strictEqual(M.gcd(-12n, 18n), 6n); assert.strictEqual(M.lcm(0n, 5n), 0n);
    const e2 = M.egcd(-240n, 46n); assert.strictEqual(-240n * e2.x + 46n * e2.y, e2.g); assert.strictEqual(e2.g, 2n);
    assert.strictEqual(M.euclidLines(240n, 46n)[0], '240 = 5 × 46 + 10');
    assert.strictEqual(M.modpow(3n, 200n, 13n), 3n ** 200n % 13n);
    assert.strictEqual(M.modpow(5n, 0n, 1n), 0n);
    assert.strictEqual(M.modinv(3n, 11n), 4n); assert.strictEqual(M.modinv(6n, 9n), null); assert.strictEqual(M.modinv(-3n, 11n), 7n);
    for (let i = 0; i < 100; i++) { const m = BigInt(2 + rnd(1000)), a = BigInt(rnd(5000)), v = M.modinv(a, m); if (v !== null) assert.strictEqual(a * v % m, 1n); else assert.ok(M.gcd(a, m) !== 1n); }
    // 質數
    const sieve = (n) => { const s = new Array(n + 1).fill(true); s[0] = s[1] = false; for (let i = 2; i * i <= n; i++) if (s[i]) for (let j = i * i; j <= n; j += i) s[j] = false; return s; }, sv = sieve(20000);
    for (let n = 0; n <= 20000; n++) assert.strictEqual(M.isPrime(BigInt(n)), sv[n], 'prime ' + n);
    assert.ok(M.isPrime(2n ** 61n - 1n)); assert.ok(M.isPrime(2n ** 89n - 1n)); assert.ok(M.isPrime(18446744073709551557n));
    assert.ok(!M.isPrime(2n ** 67n - 1n));              // 梅森合數
    assert.ok(!M.isPrime(3215031751n));                 // 強偽質數（底 2、3、5、7）
    assert.ok(!M.isPrime(561n)); assert.ok(!M.isPrime(2n ** 64n)); assert.ok(!M.isPrime(-7n));
    assert.strictEqual(M.nextPrime(100n), 101n); assert.strictEqual(M.prevPrime(100n), 97n); assert.strictEqual(M.prevPrime(2n), null);
    // 質因數分解 vs 暴力
    const nfac = (n) => { const r = []; for (let p = 2; p * p <= n; p++) { let e = 0; while (n % p === 0) { n /= p; e++; } if (e) r.push([BigInt(p), e]); } if (n > 1) r.push([BigInt(n), 1]); return r; };
    for (let i = 0; i < 300; i++) { const n = 2 + rnd(2000000); assert.deepStrictEqual(M.factorize(BigInt(n)), nfac(n), 'factor ' + n); }
    assert.deepStrictEqual(M.factorize(360n), [[2n, 3], [3n, 2], [5n, 1]]);
    assert.deepStrictEqual(M.factorize(600851475143n).map(x => x[0]), [71n, 839n, 1471n, 6857n]);
    assert.deepStrictEqual(M.factorize(4294967291n * 4294967279n), [[4294967279n, 1], [4294967291n, 1]]);
    assert.deepStrictEqual(M.factorize(2n ** 64n), [[2n, 64]]);
    assert.deepStrictEqual(M.factorize(1000003n ** 2n), [[1000003n, 2]]);
    assert.throws(() => M.factorize(2n ** 64n + 1n)); assert.throws(() => M.factorize(1n));
    // φ、τ、σ
    for (let n = 2; n <= 300; n++) {
        let c = 0, t = 0, s = 0;
        for (let k = 1; k <= n; k++) { if (ngcd(k, n) === 1) c++; if (n % k === 0) { t++; s += k; } }
        const fs = M.factorize(BigInt(n));
        assert.strictEqual(M.phiOf(fs), BigInt(c)); assert.strictEqual(M.tauOf(fs), BigInt(t)); assert.strictEqual(M.sigmaOf(fs), BigInt(s));
    }
    assert.strictEqual(M.big('12_345'), 12345n); assert.strictEqual(M.big('1.5'), null); assert.strictEqual(M.big('1'.repeat(41)), null);
    assert.ok(M.bigStr(10n ** 200n).includes('共 201 位')); assert.strictEqual(M.bigStr(-5n), '-5');
    ok('l5 數論');
}

// ---- 統計 ----
{
    const d = M.describe([2, 4, 4, 4, 5, 5, 7, 9]);
    near(d.mean, 5); near(d.median, 4.5); assert.deepStrictEqual(d.modes, [4]); near(d.popVar, 4); near(d.popStd, 2); near(d.sampVar, 32 / 7); near(d.range, 7);
    near(d.q1, 4); near(d.q3, 6); near(d.iqr, 2);
    near(M.describe([1, 2, 3]).skew + 1, 1); near(M.describe([1, 2, 3]).kurt, -1.5);
    assert.ok(M.describe([1, 2, 3, 4, 100]).skew > 1);
    const one = M.describe([5]); assert.strictEqual(one.sampVar, null); assert.strictEqual(one.skew, null); assert.deepStrictEqual(one.modes, []);
    assert.deepStrictEqual(M.describe([1, 2, 3, 3, 2]).modes, [2, 3]);
    near(M.describe([1, 2, 3, 4, 5]).q1x, 2); near(M.describe([1, 2, 3, 4, 5]).q1, 1.5);
    assert.strictEqual(M.parseNums('1, 2\n3').xs.length, 3); assert.ok(M.parseNums('1 a').error); assert.ok(M.parseNums('').error); assert.strictEqual(M.parseNums('1e3 -2.5').xs[0], 1000);
    near(M.normCdf(0), 0.5); near(M.normCdf(1), 0.8413447460685429, 1e-12); near(M.normCdf(1.96), 0.9750021048517795, 1e-12); near(M.normCdf(-3), 0.0013498980316301, 1e-12);
    near(M.normCdf(-6), 9.865876450376946e-10, 1e-9); near(M.normCdf(2), 0.9772498680518208, 1e-12); near(M.normCdf(-2), 0.022750131948179195, 1e-12);
    for (let z = -5; z <= 5; z += 0.25) near(M.normCdf(z) + M.normCdf(-z), 1, 1e-13);
    near(M.normInv(0.975), 1.959963984540054, 1e-12); near(M.normInv(0.5) + 1, 1, 1e-12); near(M.normInv(0.9), 1.2815515655446004, 1e-12);
    for (const p of [1e-8, 0.001, 0.02, 0.1, 0.3, 0.5, 0.77, 0.97, 0.999]) near(M.normCdf(M.normInv(p)), p, 1e-11);
    assert.ok(Number.isNaN(M.normInv(2))); assert.strictEqual(M.normInv(0), -Infinity);
    near(M.parseProb('97.5%'), 0.975); near(M.parseProb('0.5'), 0.5); assert.strictEqual(M.parseProb(' '), null); assert.ok(Number.isNaN(M.parseProb('x')));
    assert.strictEqual(M.fmt(0.1 + 0.2), '0.3'); assert.strictEqual(M.fmt(1e15), '1e+15'); assert.strictEqual(M.fmt(NaN), '—'); assert.strictEqual(M.fmt(1.5e-9), '1.5e-9');
    ok('l5 統計');
}

// ---- 排列組合與機率 ----
{
    assert.strictEqual(M.comb(52, 5), 2598960n); assert.strictEqual(M.comb(49, 6), 13983816n); assert.strictEqual(M.perm(5, 2), 20n); assert.strictEqual(M.fact(20), 2432902008176640000n);
    assert.strictEqual(M.fact(0), 1n); assert.strictEqual(M.comb(5, 0), 1n); assert.strictEqual(M.comb(5, 5), 1n);
    assert.strictEqual(M.combRep(3, 2), 6n); assert.strictEqual(M.permRep(3, 4), 81n); assert.strictEqual(M.permRep(2, 0), 1n);
    for (let n = 0; n <= 30; n++) {
        let s = 0n;
        for (let k = 0; k <= n; k++) { s += M.comb(n, k); assert.strictEqual(M.comb(n, k), M.comb(n, n - k)); if (n && k) assert.strictEqual(M.comb(n, k), M.comb(n - 1, k - 1) + M.comb(n - 1, k)); }
        assert.strictEqual(s, 2n ** BigInt(n));
    }
    assert.strictEqual(M.fact(3000).toString().length, 9131);
    const w = M.arrangements('MISSISSIPPI'); assert.strictEqual(w.value, 34650n); assert.strictEqual(w.n, 11); assert.ok(M.arrangements('').error);
    assert.strictEqual(M.arrangements('A B').value, 2n);
    for (const [n, p] of [[10, 0.5], [50, 0.3], [200, 0.01], [1, 0.9], [30, 0], [30, 1]]) { const s = M.binomStats(n, p, 0); near(s.pm.reduce((a, b) => a + b, 0), 1, 1e-12); near(s.mean, n * p); }
    const b = M.binomStats(10, 0.5, 5); near(b.eq, 252 / 1024); near(b.le, 638 / 1024); near(b.lt + b.eq, b.le); near(b.ge + b.lt, 1); near(b.gt + b.le, 1); near(b.variance, 2.5);
    near(M.binomStats(10000, 0.5, 5000).eq, 0.00797864768, 1e-6);
    const e = M.expectation('1 1/6\n2 1/6\n3 1/6\n4 1/6\n5 1/6\n6 1/6'); near(e.mean, 3.5); near(e.variance, 35 / 12);
    assert.ok(M.expectation('1 0.5').error); assert.ok(M.expectation('a 1').error); assert.ok(M.expectation('1 2 3').error); assert.ok(M.expectation('1 1.5\n2 -0.5').error);
    ok('l5 排列組合');
}

// ---- 幾何 ----
{
    const g = (k, key, ...v) => { const r = M.geoCalc(k, key, v); assert.ok(r.rows, r.error); return Object.fromEntries(r.rows); };
    near(g('solid', 'sphere', 1)['體積 4πr³/3'], 4.1887902047863905); near(g('solid', 'cone', 3, 4)['斜高'], 5); near(g('solid', 'cone', 3, 4)['表面積'], 24 * Math.PI);
    near(g('solid', 'cyl', 1, 2)['體積 πr²h'], 2 * Math.PI); near(g('solid', 'cube', 2)['體積'], 8); near(g('solid', 'pyr', 2, 3)['體積 a²h/3'], 4);
    near(g('plane', 'circle', 2)['面積 πr²'], 4 * Math.PI); near(g('plane', 'tri3', 3, 4, 5)['面積'], 6); near(g('plane', 'tri3', 3, 4, 5)['外接圓半徑'], 2.5); near(g('plane', 'tri3', 3, 4, 5)['內切圓半徑'], 1);
    near(g('plane', 'poly', 4, 2)['面積'], 4); near(g('plane', 'poly', 6, 1)['面積'], 3 * Math.sqrt(3) / 2); near(g('plane', 'ellipse', 5, 5)['周長（Ramanujan 近似）'], 10 * Math.PI);
    near(g('plane', 'sector', 2, 90)['弧長'], Math.PI); near(g('plane', 'trap', 2, 4, 3)['面積 (a+b)h/2'], 9); near(g('plane', 'rhombus', 6, 8)['邊長'], 5);
    assert.ok(M.geoCalc('plane', 'tri3', [1, 2, 3]).error); assert.ok(M.geoCalc('plane', 'circle', [-1]).error); assert.ok(M.geoCalc('plane', 'circle', [NaN]).error); assert.ok(M.geoCalc('plane', 'poly', [2, 1]).error); assert.ok(M.geoCalc('plane', 'sector', [1, 400]).error);
    near(M.pythag(3, 4, null).c, 5); near(M.pythag(5, null, 13).b, 12); near(M.pythag(null, 4, 5).a, 3); assert.ok(M.pythag(3, 4, 5).error); assert.ok(M.pythag(null, 4, 3).error); assert.ok(M.pythag(0, 4, null).error);
    // 三角形
    const t = M.solveTri([3, 4, 5], [null, null, null]); near(t.sols[0].t[2], 90); near(t.sols[0].t[0], 36.86989764584402); near(t.sols[0].t[1], 53.13010235415598);
    const sas = M.solveTri([3, 4, null], [null, null, 90]); near(sas.sols[0].s[2], 5); near(sas.sols[0].t[0], 36.86989764584402);
    const asa = M.solveTri([null, null, 10], [30, 60, null]); near(asa.sols[0].s[0], 5); near(asa.sols[0].s[1], 5 * Math.sqrt(3)); near(asa.sols[0].t[2], 90);
    const aas = M.solveTri([10, null, null], [30, 60, null]); near(aas.sols[0].s[2], 20); near(aas.sols[0].s[1], 10 * Math.sqrt(3));
    const two = M.solveTri([6, 10, null], [30, null, null]); assert.strictEqual(two.sols.length, 2);
    near(two.sols[0].t[1], 56.44269023, 1e-7); near(two.sols[1].t[1], 123.55730977, 1e-7);
    assert.strictEqual(M.solveTri([5, 10, null], [30, null, null]).sols.length, 1); near(M.solveTri([5, 10, null], [30, null, null]).sols[0].t[1], 90);
    assert.strictEqual(M.solveTri([4, 10, null], [30, null, null]).sols.length, 0);
    assert.strictEqual(M.solveTri([12, 10, null], [30, null, null]).sols.length, 1);
    assert.ok(M.solveTri([3, 4, null], [null, null, null]).error); assert.ok(M.solveTri([1, 2, 10], [null, null, null]).error); assert.ok(M.solveTri([null, null, 5], [100, 80, null]).error); assert.ok(M.solveTri([null, null, 5], [0, 80, null]).error);
    // 隨機三角形：反推其他類型要回到同一個三角形，且正弦定理、內角和成立
    for (let i = 0; i < 100; i++) {
        let a, b, c; do { a = 1 + rnd(90) / 7; b = 1 + rnd(90) / 7; c = 1 + rnd(90) / 7; } while (a + b <= c || a + c <= b || b + c <= a);
        const r = M.solveTri([a, b, c], [null, null, null]).sols[0], [A, B, C] = r.t;
        near(A + B + C, 180, 1e-9); near(a / Math.sin(A * Math.PI / 180), b / Math.sin(B * Math.PI / 180), 1e-9);
        const x = M.solveTri([a, b, null], [null, null, C]).sols[0]; near(x.s[2], c, 1e-9); near(x.t[0], A, 1e-7);
        const y = M.solveTri([null, null, c], [A, B, null]).sols[0]; near(y.s[0], a, 1e-9); near(y.s[1], b, 1e-9);
        const z = M.solveTri([a, b, null], [A, null, null]).sols; assert.ok(z.some(s => Math.abs(s.s[2] - c) < 1e-6 * c), 'SSA 應包含原三角形');
    }
    const c = M.coord(1, 2, 4, 6); near(c.dist, 5); assert.deepStrictEqual(c.mid, [2.5, 4]); near(c.slope, 4 / 3); assert.ok(c.line.startsWith('y = 1.333333333x + 0.666666'));
    assert.strictEqual(M.coord(2, 1, 2, 5).slope, null); assert.strictEqual(M.coord(2, 1, 2, 5).line, 'x = 2'); assert.strictEqual(M.coord(1, 1, 1, 1).line, '兩點重合');
    ok('l5 幾何');
}

// ---- 運算式解析器 ----
{
    assert.strictEqual(f('-2^2'), -4); assert.strictEqual(f('2^3^2'), 512); assert.strictEqual(f('(-2)^2'), 4); assert.strictEqual(f('2^-2'), 0.25);
    assert.strictEqual(f('2+3*4'), 14); assert.strictEqual(f('(2+3)*4'), 20); assert.strictEqual(f('10-4-3'), 3); assert.strictEqual(f('100/10/5'), 2); assert.strictEqual(f('2*-3'), -6); assert.strictEqual(f('--3'), 3);
    assert.strictEqual(f('2x', 5), 10); assert.strictEqual(f('x(x+1)', 3), 12); assert.strictEqual(f('(x+1)(x-1)', 3), 8); assert.strictEqual(f('2 x^2', 3), 18); near(f('2pi'), 2 * Math.PI); near(f('3sin(x)', Math.PI / 2), 3);
    near(f('sin(pi/6)'), 0.5); near(f('cos(0)'), 1); near(f('atan(1)'), Math.PI / 4); near(f('ln(e)'), 1); near(f('log(1000)'), 3); near(f('exp(1)'), Math.E); assert.strictEqual(f('sqrt(16)'), 4); assert.strictEqual(f('abs(-3)'), 3);
    assert.strictEqual(f('floor(2.7)'), 2); assert.strictEqual(f('ceil(2.1)'), 3); assert.strictEqual(f('pow(2,10)'), 1024); assert.strictEqual(f('pow(x, 2)', 4), 16);
    assert.strictEqual(f('y = x + 1', 1), 2); assert.strictEqual(f('f(x)=x*2', 4), 8); assert.strictEqual(f('X+1', 1), 2); assert.strictEqual(f('1e3'), 1000); assert.strictEqual(f('.5+.5'), 1); assert.strictEqual(f('π', 0), Math.PI);
    assert.strictEqual(f('1/0'), Infinity); assert.ok(Number.isNaN(f('sqrt(-1)')));
    for (const s of ['alert(1)', 'constructor', 'x.constructor', 'x.y', '__proto__', 'toString', 'this', 'window', 'process', 'eval("1")', 'Function("return 1")()', '1;2', '[1]', '{}', '`a`', 'x=1', '"a"', "'a'", 'sin', 'sin(', 'sin()', 'sin(1,2)', 'pow(1)', '2+', '*2', '()', '(1', '1)', '1 2', '', '   ', 'a b', 'sinx', '2^', '1,2', 'hasOwnProperty(1)', 'valueOf'])
        bad(s);
    assert.ok(M.compileExpr('x'.repeat(301)).error); assert.ok(M.compileExpr('('.repeat(150) + '1' + ')'.repeat(150)).error);
    // 零點與極值
    let r = M.analyze((x) => Math.sin(x), -7, 7);
    assert.strictEqual(r.roots.length, 5); [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI].forEach((e, i) => near(r.roots[i] + 1, e + 1, 1e-9));
    assert.strictEqual(r.ext.length, 4); const mx = r.ext.filter(e => e.type === '極大'); assert.strictEqual(mx.length, 2); near(mx[0].y, 1, 1e-9); near(mx[0].x, -3 * Math.PI / 2, 1e-5);
    r = M.analyze((x) => x * x - 4, -5.123, 5.321); assert.strictEqual(r.roots.length, 2); near(r.roots[0], -2, 1e-9); near(r.roots[1], 2, 1e-9); assert.strictEqual(r.ext.length, 1); assert.strictEqual(r.ext[0].type, '極小'); near(r.ext[0].y, -4, 1e-9);
    r = M.analyze((x) => x * x, -1.234, 2.345); assert.strictEqual(r.roots.length, 1); near(r.roots[0] + 1, 1, 1e-6);       // 重根
    r = M.analyze((x) => Math.tan(x), -1.4, 1.4); assert.deepStrictEqual([r.roots.length, r.ext.length], [1, 0]);
    r = M.analyze((x) => Math.tan(x), -3, 3); assert.deepStrictEqual([r.roots.length, r.ext.length], [1, 0]);               // 極點 ±π/2 不是零點
    r = M.analyze((x) => 1 / x, -5.03, 5.01); assert.deepStrictEqual([r.roots.length, r.ext.length], [0, 0]);
    r = M.analyze((x) => 1 / (x * x), -5.03, 5.01); assert.deepStrictEqual([r.roots.length, r.ext.length], [0, 0]);
    r = M.analyze((x) => x ** 3 - 3 * x, -3, 3); assert.strictEqual(r.roots.length, 3); assert.strictEqual(r.ext.length, 2);
    ok('l5 運算式解析器');
}

// ---- 化學 ----
{
    const mm = (s) => { const r = M.parseFormula(s); assert.ok(r.atoms, s + ' ' + r.error); return M.molarMass(r.atoms); };
    near(mm('H2O'), 18.015, 1e-9); near(mm('CO2'), 44.009, 1e-9); near(mm('NaCl'), 58.44, 1e-4); near(mm('C6H12O6'), 180.156, 1e-4);
    assert.ok(Math.abs(mm('CuSO4·5H2O') - 249.685) < 0.02);            // 簡約原子量與教科書 249.685 差 0.01 內
    near(mm('CuSO4·5H2O'), mm('CuSO4') + 5 * mm('H2O'), 1e-12); near(mm('CuSO4.5H2O'), mm('CuSO4·5H2O'), 1e-12); near(mm('CuSO4*5H2O'), mm('CuSO4·5H2O'), 1e-12);
    near(mm('Ca(OH)2'), 74.092, 1e-4); near(mm('Al2(SO4)3'), 342.147, 1e-4); near(mm('Fe4[Fe(CN)6]3'), 4 * 55.845 + 3 * (55.845 + 6 * 12.011 + 6 * 14.007), 1e-12);
    near(mm('Mg(NO3)2'), 24.305 + 2 * 14.007 + 6 * 15.999, 1e-12); near(mm('H₂O'), 18.015, 1e-9); near(mm('CO'), 28.01, 1e-9); near(mm('Co'), 58.933, 1e-9);
    assert.strictEqual(M.parseFormula('H2O').atoms.get('H'), 2); assert.strictEqual(M.parseFormula('Ca(OH)2').atoms.get('O'), 2); assert.strictEqual(M.parseFormula('CuSO4·5H2O').atoms.get('O'), 9);
    const pct = M.composition(M.parseFormula('H2O').atoms); near(pct.reduce((a, c) => a + c.pct, 0), 100, 1e-9); near(pct[0].pct, 11.19, 1e-3);
    for (const s of ['', 'Xx', 'h2o', 'H2O)', '(H2O', 'H0', 'H10000', '2H2O', 'H2O+', 'SO4^2-', 'Na+', 'H2O·', 'Qq2', '()', 'a']) assert.ok(M.parseFormula(s).error, '應報錯：' + s);
    assert.ok(M.parseFormula('H'.repeat(201)).error);
    // 與週期表頁一致
    const pt = read('utils/periodic-table.html'), E = new Function(pt.slice(pt.indexOf('const E = ['), pt.indexOf('const CATS')) + '; return E;')();
    assert.strictEqual(Object.keys(M.MASS).length, 118);
    for (const [sym, , , mass] of E) assert.strictEqual(M.MASS[sym], mass, sym);
    // 配平
    const bal = (s) => { const r = M.balance(s); assert.ok(r.ok, s + ' ' + r.msg); return r.coef; };
    assert.deepStrictEqual(bal('Fe + O2 -> Fe2O3'), [4, 3, 2]); assert.deepStrictEqual(bal('C3H8 + O2 -> CO2 + H2O'), [1, 5, 3, 4]);
    assert.deepStrictEqual(bal('H2 + O2 = H2O'), [2, 1, 2]); assert.deepStrictEqual(bal('Al + HCl → AlCl3 + H2'), [2, 6, 2, 3]);
    assert.deepStrictEqual(bal('KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O'), [2, 16, 2, 2, 5, 8]); assert.deepStrictEqual(bal('Ca(OH)2 + H3PO4 -> Ca3(PO4)2 + H2O'), [3, 2, 1, 6]);
    assert.deepStrictEqual(bal('C6H12O6 + O2 -> CO2 + H2O'), [1, 6, 6, 6]); assert.deepStrictEqual(bal('CuSO4·5H2O -> CuSO4 + H2O'), [1, 1, 5]); assert.deepStrictEqual(bal('N2 + H2 -> NH3'), [1, 3, 2]);
    assert.strictEqual(M.balance('Fe + O2 -> Fe2O3').eq, '4 Fe + 3 O2 → 2 Fe2O3'); assert.ok(M.balance('Fe + O2 -> Fe2O3').steps.length >= 4);
    // 任何配平結果左右原子數必須相等
    for (const s of ['C3H8 + O2 -> CO2 + H2O', 'KMnO4 + HCl -> KCl + MnCl2 + Cl2 + H2O', 'Fe2(SO4)3 + KOH -> K2SO4 + Fe(OH)3', 'C2H5OH + O2 -> CO2 + H2O']) {
        const r = M.balance(s); assert.ok(r.ok, s); const tot = [0, 0], nl = s.split(/->/)[0].split('+').length;
        r.species.forEach((nm, i) => { const side = i < nl ? 0 : 1, a = M.parseFormula(nm).atoms; let n = 0; a.forEach(v => n += v); tot[side] += n * r.coef[i]; });
        assert.strictEqual(tot[0], tot[1]);
    }
    const nos = M.balance('H2 + O2 -> H2O + H2O2'); assert.ok(!nos.ok && nos.msg.includes('2 組')); assert.ok(nos.steps.length);
    assert.ok(!M.balance('H2 -> O2').ok); assert.ok(!M.balance('H2O').ok); assert.ok(!M.balance('H2 + O2 -> H2O -> X').ok); assert.ok(!M.balance('H2 + -> H2O').ok); assert.ok(!M.balance('H2 + Xx -> H2O').ok);
    assert.ok(!M.balance('H2O -> H2O2').ok);                                                                    // 不守恆
    // 濃度與稀釋
    near(M.molarity(58.44, 5.844, 1, null).conc, 0.1); near(M.molarity(58.44, null, 0.5, 0.1).mass, 2.922); near(M.molarity(58.44, 5.844, null, 0.2).volL, 0.5);
    assert.ok(M.molarity(58.44, 1, 1, 1).error); assert.ok(M.molarity(58.44, null, null, 1).error); assert.ok(M.molarity(58.44, -1, 1, null).error);
    near(M.dilution(12, null, 1, 500).v1, 41.666666666667, 1e-9); near(M.dilution(12, 10, null, 120).c2, 1); near(M.dilution(null, 5, 2, 10).c1, 4); near(M.dilution(10, 5, 2, null).v2, 25);
    assert.ok(M.dilution(1, 1, 1, 1).error); assert.ok(M.dilution(0, 1, null, 1).error);
    ok('l5 化學');
}

// ---- 物理 ----
{
    const C = Object.fromEntries(M.CONSTANTS.map(c => [c[0], Number(c[3])]));
    assert.strictEqual(C.c, 299792458); assert.strictEqual(C.h, 6.62607015e-34); assert.strictEqual(C.e, 1.602176634e-19); assert.strictEqual(C.NA, 6.02214076e23); assert.strictEqual(C.kB, 1.380649e-23);
    near(C.hbar, C.h / (2 * Math.PI), 1e-11); near(C.R, C.NA * C.kB, 1e-12); near(C.F, C.e * C.NA, 1e-12); near(C.eV, C.e, 1e-15);
    near(C.sigma, 2 * Math.PI ** 5 * C.kB ** 4 / (15 * C.h ** 3 * C.c ** 2), 1e-10); near(C.Vm, C.R * 273.15 / 101325, 1e-10);
    near(C.eps0 * C.mu0 * C.c ** 2, 1, 2e-9); near(C.ke, 1 / (4 * Math.PI * C.eps0), 2e-9);
    near(C.alpha, C.e ** 2 / (4 * Math.PI * C.eps0 * C.hbar * C.c), 2e-9); near(C.Rinf, C.alpha ** 2 * C.me * C.c / (2 * C.h), 2e-9);
    near(C.mpme, C.mp / C.me, 1e-9); near(C.u * C.NA * 1000, 1, 1e-9); near(C.a0, C.hbar / (C.me * C.c * C.alpha), 2e-9); near(C.muB, C.e * C.hbar / (2 * C.me), 2e-9);
    near(C.lamC, C.h / (C.me * C.c), 2e-9); near(C.re, C.alpha * C.hbar / (C.me * C.c), 2e-9); near(C.b, C.h * C.c / (C.kB * 4.965114231744276), 1e-9);
    for (const [k, name, sym, v, unit, unc] of M.CONSTANTS) { assert.ok(k && name && sym && unit, k); assert.ok(Number.isFinite(Number(v)) && Number(v) > 0, k); assert.ok(unc >= 0 && unc / Number(v) < 1e-3, k); }
    assert.strictEqual(new Set(M.CONSTANTS.map(c => c[0])).size, M.CONSTANTS.length);
    assert.ok(M.FORMULAS.every(x => x.length === 4 && x[0] && x[1] && x[2]));
    const ff = M.freeFall(80, null, 9.80665); near(ff.t, Math.sqrt(160 / 9.80665)); near(ff.v, 9.80665 * ff.t); near(M.freeFall(null, 2, 10).h, 20); assert.ok(M.freeFall(1, 1, 10).error); assert.ok(M.freeFall(null, null, 10).error); assert.ok(M.freeFall(-1, null, 10).error);
    const pj = M.projectile(20, 45, 0, 9.80665); near(pj.range, 400 / 9.80665); near(pj.T, 2 * 20 * Math.sin(Math.PI / 4) / 9.80665); near(pj.hmax, 100 / 9.80665); near(pj.vImpact, 20);
    near(M.projectile(10, 90, 0, 10).hmax, 5); near(M.projectile(0.001, 0, 20, 10).T, 2, 1e-3); near(M.projectile(10, 0, 5, 10).range, 10); assert.ok(M.projectile(-1, 45, 0, 10).error); assert.ok(M.projectile(5, 100, 0, 10).error);
    near(M.pendulum(1, null, 9.80665).T, 2.0064092925890407); near(M.pendulum(null, 2, 9.80665).L, 9.80665 * 4 / (4 * Math.PI ** 2)); near(M.pendulum(1, null, 9.8).f, 1 / M.pendulum(1, null, 9.8).T); assert.ok(M.pendulum(1, 1, 9.8).error); assert.ok(M.pendulum(0, null, 9.8).error);
    ok('l5 物理');
}
