// 批次 d1：JWT 解碼 / HTTP 速查 / SemVer
const { load, ok } = require('./_load');
const assert = require('assert');

(async () => {
    // ---------- SemVer ----------
    {
        const m = load('utils/semver.html', 'parseVer, cmpVer, fmtVer, diffVer, sortVers, splitList, parseRange, fmtRange, satisfies');
        const { parseVer, cmpVer, fmtVer, diffVer, sortVers, parseRange, fmtRange, satisfies } = m;
        const P = (s) => { const v = parseVer(s); assert.ok(!v.error, s + ' ' + v.error); return v; };
        // 解析
        const v = P('1.2.3-beta.1+build.5');
        assert.deepStrictEqual([v.major, v.minor, v.patch, v.pre, v.build], [1, 2, 3, ['beta', '1'], ['build', '5']]);
        assert.strictEqual(fmtVer(v), '1.2.3-beta.1+build.5');
        assert.strictEqual(fmtVer(P(' v1.2.3 ')), '1.2.3');
        assert.strictEqual(fmtVer(P('=1.2.3')), '1.2.3');
        assert.ok(P('1.0.0-0').pre[0] === '0');
        assert.ok(P('1.0.0-x-y-z.--').pre.length === 2);
        for (const bad of ['', '1', '1.2', '1.2.3.4', '01.2.3', '1.02.3', '1.2.03', '1.2.3-', '1.2.3-01', '1.2.3-a..b', '1.2.3-a$', '1.2.3+', '1.2.3+a..b', 'a.b.c', '-1.2.3', '1.2.3 4', '99999999999999999999.0.0', null, undefined]) assert.ok(parseVer(bad).error, 'should be invalid: ' + bad);
        assert.ok(parseVer(' 1.2.3', false).error, 'strict 不容忍空白');
        ok('semver: parse');
        // 規範的優先序範例
        const order = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0', '10.0.0'];
        for (let i = 0; i < order.length; i++) for (let j = 0; j < order.length; j++) assert.strictEqual(cmpVer(P(order[i]), P(order[j])), Math.sign(i - j), order[i] + ' vs ' + order[j]);
        assert.strictEqual(cmpVer(P('1.0.0+a'), P('1.0.0+b')), 0, 'build 不參與');
        assert.strictEqual(cmpVer(P('1.0.0-1'), P('1.0.0-a')), -1, '數字 < 文字');
        assert.strictEqual(cmpVer(P('1.0.0-99999999999999999999'), P('1.0.0-100000000000000000000')), -1, '超大數字識別字');
        assert.strictEqual(cmpVer(P('1.0.0-a-b'), P('1.0.0-a.b')), 1);
        ok('semver: precedence');
        // 排序
        const s = sortVers(['1.0.0', '1.0.0-rc.1', 'x', 'v0.3.1', '1.0.0-beta.11', '1.0.0-beta.2'], false);
        assert.deepStrictEqual(s.ok.map(x => x.s), ['v0.3.1', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0']);
        assert.deepStrictEqual(s.bad.map(x => x.s), ['x']);
        assert.deepStrictEqual(sortVers(['1.0.0', '2.0.0', '1.5.0'], true).ok.map(x => x.s), ['2.0.0', '1.5.0', '1.0.0']);
        assert.deepStrictEqual(sortVers([]).ok, []);
        assert.deepStrictEqual(m.splitList('1.0.0, 2.0.0\n3.0.0  ;'), ['1.0.0', '2.0.0', '3.0.0']);
        ok('semver: sort');
        // 升級類型
        const D = (a, b) => diffVer(P(a), P(b));
        assert.strictEqual(D('1.4.2', '2.0.0'), 'major');
        assert.strictEqual(D('2.0.0', '1.4.2'), 'major');
        assert.strictEqual(D('1.4.2', '1.5.0'), 'minor');
        assert.strictEqual(D('1.4.2', '1.4.3'), 'patch');
        assert.strictEqual(D('1.4.2', '1.4.2'), null);
        assert.strictEqual(D('1.4.2+a', '1.4.2+b'), null);
        assert.strictEqual(D('1.4.2-beta.1', '1.4.2-beta.2'), 'prerelease');
        assert.strictEqual(D('1.4.2-beta.1', '1.4.2'), 'prerelease');
        assert.strictEqual(D('1.4.2', '2.0.0-rc.1'), 'premajor');
        assert.strictEqual(D('1.4.2', '1.5.0-rc.1'), 'preminor');
        assert.strictEqual(D('1.4.2', '1.4.3-rc.1'), 'prepatch');
        ok('semver: diff');
        // 範圍展開（對照 node-semver 文件；顯示時隱藏 -0）
        const X = (r) => { const p = parseRange(r); assert.ok(p, 'invalid ' + r); return fmtRange(p); };
        const exp = {
            '^1.2.3': '>=1.2.3 <2.0.0', '^0.2.3': '>=0.2.3 <0.3.0', '^0.0.3': '>=0.0.3 <0.0.4', '^1.2.x': '>=1.2.0 <2.0.0', '^0.0.x': '>=0.0.0 <0.1.0',
            '^0.0': '>=0.0.0 <0.1.0', '^1.x': '>=1.0.0 <2.0.0', '^0.x': '>=0.0.0 <1.0.0', '^0': '>=0.0.0 <1.0.0', '^1.2': '>=1.2.0 <2.0.0', '^0.2': '>=0.2.0 <0.3.0',
            '^1.2.3-beta.2': '>=1.2.3-beta.2 <2.0.0', '^0.0.3-beta': '>=0.0.3-beta <0.0.4', '^0.0.0': '>=0.0.0 <0.0.1',
            '~1.2.3': '>=1.2.3 <1.3.0', '~1.2': '>=1.2.0 <1.3.0', '~1': '>=1.0.0 <2.0.0', '~0.2.3': '>=0.2.3 <0.3.0', '~0': '>=0.0.0 <1.0.0', '~> 1.2.3': '>=1.2.3 <1.3.0', '~1.2.3-beta.2': '>=1.2.3-beta.2 <1.3.0',
            '1.2.3 - 2.3.4': '>=1.2.3 <=2.3.4', '1.2 - 2.3.4': '>=1.2.0 <=2.3.4', '1.2.3 - 2.3': '>=1.2.3 <2.4.0', '1.2.3 - 2': '>=1.2.3 <3.0.0',
            '1.2.x': '>=1.2.0 <1.3.0', '1.x': '>=1.0.0 <2.0.0', '1': '>=1.0.0 <2.0.0', '1.2': '>=1.2.0 <1.3.0', '1.2.3': '=1.2.3'.slice(1), '=1.2.3': '1.2.3',
            '*': '>=0.0.0', 'x': '>=0.0.0', '': '>=0.0.0', '   ': '>=0.0.0', '>=*': '>=0.0.0', '<=*': '>=0.0.0',
            '>1.2': '>=1.3.0', '>1': '>=2.0.0', '>1.2.3': '>1.2.3', '>=1.2': '>=1.2.0', '<1.2': '<1.2.0', '<1': '<1.0.0', '<=1.2': '<1.3.0', '<=1': '<2.0.0', '<=1.2.3': '<=1.2.3', '<1.2.3': '<1.2.3',
            '>= 1.2.3': '>=1.2.3', '>=1.2.3 <2.0.0': '>=1.2.3 <2.0.0', '^1.0.0 || ^2.0.0': '>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0', '1.2.3 || ': '1.2.3 || >=0.0.0',
        };
        for (const [r, e] of Object.entries(exp)) assert.strictEqual(X(r), e, JSON.stringify(r));
        assert.strictEqual(X('>*'), '<0.0.0'); assert.strictEqual(X('<*'), '<0.0.0');
        for (const bad of ['^', '~foo', '1.2.3 -', 'abc', '>=1.2.3 foo', '1.2.3-', '01.2.3', '1.2.3 || nope', '>=', '^1.x.3-beta', '1.2-beta', '1.2.3.4']) assert.strictEqual(parseRange(bad), null, 'invalid range: ' + bad);
        ok('semver: range expand');
        // 範圍比對
        const T = (v, r) => satisfies(P(v), parseRange(r));
        assert.ok(T('1.2.3', '^1.2.3') && T('1.9.9', '^1.2.3') && !T('2.0.0', '^1.2.3') && !T('1.2.2', '^1.2.3'));
        assert.ok(T('0.2.9', '^0.2.3') && !T('0.3.0', '^0.2.3'));
        assert.ok(T('0.0.3', '^0.0.3') && !T('0.0.4', '^0.0.3') && !T('0.0.2', '^0.0.3'));
        assert.ok(T('1.2.9', '~1.2.3') && !T('1.3.0', '~1.2.3'));
        assert.ok(T('2.3.9', '1.2.3 - 2.3') && !T('2.4.0', '1.2.3 - 2.3') && T('1.2.3', '1.2.3 - 2.3') && !T('1.2.2', '1.2.3 - 2.3'));
        assert.ok(T('3.0.0', '^1 || >=3') && T('1.5.0', '^1 || >=3') && !T('2.0.0', '^1 || >=3'));
        assert.ok(T('1.2.5', '1.2.x') && !T('1.3.0', '1.2.x') && T('9.9.9', '*') && T('9.9.9', ''));
        assert.ok(T('2.0.0', '>=1.0.0 <3.0.0') && !T('3.0.0', '>=1.0.0 <3.0.0'));
        assert.ok(!T('1.0.0', '>*') && !T('0.0.0', '<*'));
        assert.ok(T('1.2.3', '1.2.3') && !T('1.2.4', '1.2.3') && T('1.2.3+build', '1.2.3'));
        // 預發行規則
        assert.ok(!T('2.0.0-beta.1', '>=1.0.0') && !T('1.5.0-rc.1', '^1.0.0') && !T('2.0.0-beta.1', '^1.0.0') && !T('1.0.0-rc.1', '*'));
        assert.ok(T('1.2.3-beta.2', '^1.2.3-beta.1') && !T('1.2.3-beta.0', '^1.2.3-beta.1') && T('1.2.3', '^1.2.3-beta.1') && T('1.5.0', '^1.2.3-beta.1'));
        assert.ok(!T('1.2.4-beta.2', '^1.2.3-beta.1'), '預發行只對同一組 major.minor.patch 開放');
        assert.ok(!T('2.0.0-alpha', '^1.2.3-beta.1'), '下一個主版本的預發行不在 ^ 內');
        assert.ok(T('1.2.3-rc.1', '1.2.3-rc.1') && !T('1.2.3-rc.2', '1.2.3-rc.1'));
        assert.ok(T('1.2.3-rc.1', '>=1.2.3-rc.0 <1.2.3'));
        assert.ok(T('1.2.3-beta.5', '~1.2.3-beta.2') && !T('1.3.0-beta.1', '~1.2.3-beta.2'));
        ok('semver: satisfies / prerelease rules');
    }

    // ---------- HTTP 速查 ----------
    {
        const m = load('utils/http-ref.html', 'ITEMS, searchItems, CATS, kindOf');
        const { ITEMS, searchItems, CATS } = m;
        const st = ITEMS.filter(x => x.kind === 'status');
        const codes = st.map(x => x.key);
        assert.strictEqual(new Set(codes).size, codes.length, '狀態碼不重複');
        const must = [100, 101, 102, 103, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 307, 308, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451, 500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511];
        for (const c of must) assert.ok(codes.includes(String(c)), '缺 ' + c);
        assert.strictEqual(codes.length, must.length, '沒有多餘的狀態碼');
        for (const x of ITEMS) {
            for (const f of ['key', 'title', 'cat', 'desc', 'when']) assert.ok(typeof x[f] === 'string' && x[f].trim(), `${x.kind} ${x.key} 缺 ${f}`);
            assert.ok(['status', 'header', 'mime'].includes(x.kind));
            assert.ok(CATS[x.kind].includes(x.cat), `${x.key} 分類 ${x.cat} 不在清單`);
            if (x.kind === 'status') { assert.strictEqual(x.cat, x.key[0] + 'xx', x.key); assert.ok(x.fix && x.fix.trim(), x.key + ' 缺排查'); }
            assert.ok(x.example === undefined || typeof x.example === 'string');
        }
        const hk = ITEMS.filter(x => x.kind === 'header').map(x => x.key.toLowerCase()); assert.strictEqual(new Set(hk).size, hk.length, 'header 不重複');
        for (const h of ['content-type', 'cache-control', 'authorization', 'access-control-allow-origin', 'etag', 'if-none-match', 'set-cookie', 'location', 'strict-transport-security', 'content-security-policy', 'vary', 'user-agent', 'accept', 'retry-after', 'origin']) assert.ok(hk.includes(h), '缺 header ' + h);
        const mk = ITEMS.filter(x => x.kind === 'mime').map(x => x.key); assert.strictEqual(new Set(mk).size, mk.length, 'MIME 不重複');
        for (const t of ['application/json', 'text/html', 'image/png', 'application/octet-stream', 'multipart/form-data', 'application/x-www-form-urlencoded', 'text/event-stream']) assert.ok(mk.includes(t), '缺 MIME ' + t);
        ok('http-ref: data integrity (' + ITEMS.length + ' items)');
        // 搜尋
        const S = (q, o) => searchItems(ITEMS, q, o).map(x => x.key);
        assert.strictEqual(S('404')[0], '404');
        assert.strictEqual(S('  404  ')[0], '404');
        assert.ok(S('40').slice(0, 5).every(k => k.startsWith('40')), '數字前綴優先');
        assert.strictEqual(S('not found')[0], '404');
        assert.strictEqual(S('NOT FOUND')[0], '404');
        assert.strictEqual(S('cache-control')[0], 'Cache-Control');
        assert.strictEqual(S('etag')[0], 'ETag');
        assert.ok(S('cors').length > 2 && S('cors').some(k => /access-control/i.test(k)));
        assert.strictEqual(S('application/json')[0], 'application/json');
        assert.strictEqual(S('json')[0] !== undefined, true);
        assert.deepStrictEqual(S('zzzzqqqq'), []);
        assert.strictEqual(S('').length, ITEMS.length, '空查詢 = 全部');
        assert.deepStrictEqual(S('', { kind: 'status', cat: '4xx' }).every(k => k[0] === '4'), true);
        assert.ok(S('', { kind: 'status' }).length === must.length);
        assert.deepStrictEqual(S('', { kind: 'status' }), codes.slice().sort(), '無查詢時狀態碼由小到大');
        assert.ok(S('', { kind: 'header', cat: 'CORS' }).length >= 4);
        assert.ok(S('', { kind: 'mime' }).length === mk.length);
        assert.deepStrictEqual(S('404', { kind: 'header' }).every(k => !/^\d+$/.test(k)), true);
        assert.ok(S('.*+?[(') !== null, '特殊字元不會丟錯');
        assert.strictEqual(S('418')[0], '418');
        ok('http-ref: search / filter');
    }

    // ---------- JWT ----------
    {
        const m = load('utils/encode-decode.html', 'b64uDecode, b64uEncode, parseJwt, timeClaims, fmtDur, riskList, verifyHS, signHS, buildJwt');
        const { b64uDecode, b64uEncode, parseJwt, timeClaims, fmtDur, riskList, verifyHS, signHS, buildJwt } = m;
        const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const td = (b) => new TextDecoder().decode(b);
        // base64url
        assert.strictEqual(td(b64uDecode('eyJhIjoxfQ')), '{"a":1}');
        assert.strictEqual(td(b64uDecode('eyJhIjoxfQ==')), '{"a":1}', '容忍 padding');
        assert.strictEqual(td(b64uDecode('eyJh\nIjox fQ')), '{"a":1}', '容忍空白');
        assert.deepStrictEqual([...b64uDecode('-_8')], [251, 255]);
        assert.deepStrictEqual([...b64uDecode('+/8=')], [251, 255], '容忍標準 base64');
        assert.strictEqual(td(b64uDecode(b64uEncode(new TextEncoder().encode('中文😀')))), '中文😀');
        assert.strictEqual(b64uEncode(new Uint8Array([251, 255])), '-_8');
        assert.strictEqual(b64uEncode(new Uint8Array(0)), '');
        assert.throws(() => b64uDecode('a'), /長度|無效/);
        assert.throws(() => b64uDecode('a$b'), /字元|無效/);
        ok('jwt: base64url');
        // parse
        const p = parseJwt(SAMPLE);
        assert.ok(p.ok);
        assert.deepStrictEqual(p.header, { alg: 'HS256', typ: 'JWT' });
        assert.deepStrictEqual(p.payload, { sub: '1234567890', name: 'John Doe', iat: 1516239022 });
        assert.strictEqual(p.signingInput, SAMPLE.split('.').slice(0, 2).join('.'));
        assert.strictEqual(p.sig, SAMPLE.split('.')[2]);
        assert.ok(parseJwt('Bearer ' + SAMPLE + '\n').ok, 'Bearer 與換行');
        assert.ok(parseJwt('"' + SAMPLE + '"').ok, '引號');
        assert.ok(parseJwt(SAMPLE.replace(/\./g, '. ')).ok, '空白');
        for (const bad of ['', 'abc', 'a.b.c.d', '!!!.eyJ9.x', 'eyJhIjoxfQ.!!!.x', null, undefined, 'bm90anNvbg.eyJhIjoxfQ.x', 'W10.eyJhIjoxfQ.x']) { const r = parseJwt(bad); assert.ok(!r.ok && r.error, 'should fail: ' + bad); }
        const nosig = parseJwt('eyJhbGciOiJub25lIn0.eyJhIjoxfQ.');
        assert.ok(nosig.ok && nosig.sig === '');
        const two = parseJwt('eyJhbGciOiJub25lIn0.eyJhIjoxfQ');
        assert.ok(two.ok && two.sig === '');
        const arr = parseJwt('eyJhbGciOiJIUzI1NiJ9.WzEsMl0.x');
        assert.ok(arr.ok && Array.isArray(arr.payload), 'payload 可為非物件');
        ok('jwt: parse');
        // 時間
        assert.strictEqual(fmtDur(0), '不到 1 秒');
        assert.strictEqual(fmtDur(61 * 1000), '1 分鐘 1 秒');
        assert.strictEqual(fmtDur((2 * 86400 + 3 * 3600) * 1000), '2 天 3 小時');
        assert.strictEqual(fmtDur(3600 * 1000), '1 小時');
        assert.strictEqual(fmtDur(400 * 86400 * 1000), '1 年 35 天');
        const now = 1700000000000;
        const tc = timeClaims({ exp: 1700003600, iat: 1699990000, nbf: 1700000600 }, now);
        const by = Object.fromEntries(tc.map(x => [x.name, x]));
        assert.ok(by.exp.status === 'valid' && by.exp.text.includes('1 小時'));
        assert.ok(by.nbf.status === 'notyet');
        assert.ok(by.iat.status === 'ok');
        assert.strictEqual(timeClaims({ exp: 1699999999 }, now)[0].status, 'expired');
        assert.strictEqual(timeClaims({ exp: 1700000000 }, now)[0].status, 'expired', 'exp 當下即過期');
        assert.strictEqual(timeClaims({ iat: 1700009999 }, now)[0].status, 'future');
        assert.deepStrictEqual(timeClaims({ exp: 'abc', nbf: null, iat: NaN }, now).map(x => x.status), ['invalid', 'invalid', 'invalid']);
        assert.deepStrictEqual(timeClaims({}, now), []);
        assert.deepStrictEqual(timeClaims(null, now), []);
        assert.deepStrictEqual(timeClaims([1], now), []);
        assert.strictEqual(timeClaims({ exp: 1e20 }, now)[0].status, 'invalid', '超出日期範圍');
        assert.strictEqual(timeClaims({ exp: 1700003600.5 }, now)[0].status, 'valid');
        ok('jwt: time claims');
        // 風險
        const R = (h, pl, sig = 'x', n = now) => riskList(h, pl, sig, n);
        const has = (r, lv, re) => r.some(x => x.level === lv && re.test(x.title + x.text));
        assert.ok(has(R({ alg: 'none' }, {}), 'bad', /none/));
        assert.ok(has(R({ alg: 'NoNe' }, {}), 'bad', /none/), '大小寫');
        assert.ok(has(R({ alg: 'HS256' }, {}, ''), 'bad', /沒有簽章/));
        assert.ok(has(R({ alg: 'HS256' }, { exp: 1 }), 'warn', /過期/));
        assert.ok(!has(R({ alg: 'HS256' }, { exp: 1700009999 }), 'warn', /過期/));
        assert.ok(has(R({ alg: 'HS256' }, {}), 'info', /HS/));
        assert.ok(has(R({ alg: 'RS256' }, {}), 'info', /公鑰|非對稱/));
        assert.ok(has(R({ alg: 'HS256' }, {}), 'info', /exp/), '沒有 exp');
        assert.ok(has(R({ alg: 'HS256', jku: 'http://x' }, {}), 'warn', /jku/));
        assert.ok(has(R({ alg: 'HS256', jwk: {} }, {}), 'warn', /jwk/));
        assert.ok(has(R({ alg: 'HS256', kid: '../../x' }, {}), 'warn', /kid/));
        assert.ok(has(R({}, {}), 'warn', /alg/));
        assert.ok(has(R({ alg: 'HS256' }, { nbf: 1700009999 }), 'warn', /生效/));
        assert.ok(R({ alg: 'HS256' }, [1]).length > 0, '非物件 payload 不會丟錯');
        ok('jwt: risks');
        // 簽章（Web Crypto）
        if (globalThis.crypto && crypto.subtle) {
            assert.strictEqual((await verifyHS('HS256', 'your-256-bit-secret', p.signingInput, p.sig)).ok, true);
            assert.strictEqual((await verifyHS('HS256', 'wrong', p.signingInput, p.sig)).ok, false);
            assert.strictEqual((await verifyHS('HS256', 'your-256-bit-secret', p.signingInput + 'x', p.sig)).ok, false);
            assert.strictEqual((await verifyHS('HS256', 'your-256-bit-secret', p.signingInput, '')).ok, false);
            assert.strictEqual((await verifyHS('HS256', 'your-256-bit-secret', p.signingInput, '!!!')).ok, false);
            assert.strictEqual((await verifyHS('HS384', 'your-256-bit-secret', p.signingInput, p.sig)).ok, false);
            assert.strictEqual((await verifyHS('RS256', 'k', 'a.b', 'c')).ok, false);
            assert.ok((await verifyHS('RS256', 'k', 'a.b', 'c')).error);
            assert.strictEqual((await verifyHS('HS256', '', p.signingInput, p.sig)).ok, false, '空密鑰');
            // 產生
            const g = await buildJwt('HS256', '{"alg":"none","typ":"JWT"}', '{"sub":"1234567890","name":"John Doe","iat":1516239022}', 'your-256-bit-secret');
            assert.ok(g.ok, g.error);
            assert.strictEqual(g.token, SAMPLE, '與 jwt.io 範例相同（alg 被強制覆蓋為 HS256）');
            for (const alg of ['HS256', 'HS384', 'HS512']) {
                const t = await buildJwt(alg, '{"typ":"JWT"}', '{"a":"中文"}', '密鑰');
                const q = parseJwt(t.token);
                assert.strictEqual(q.header.alg, alg); assert.strictEqual(q.payload.a, '中文');
                assert.ok((await verifyHS(alg, '密鑰', q.signingInput, q.sig)).ok, alg + ' 往返');
            }
            assert.ok(!(await buildJwt('HS256', '{bad', '{}', 'k')).ok);
            assert.ok(!(await buildJwt('HS256', '[]', '{}', 'k')).ok, 'header 必須是物件');
            assert.ok(!(await buildJwt('HS256', '{}', '{bad', 'k')).ok);
            assert.ok(!(await buildJwt('HS256', '{}', '{}', '')).ok, '需要密鑰');
            assert.ok(!(await buildJwt('RS256', '{}', '{}', 'k')).ok);
            ok('jwt: HMAC verify / generate');
        } else console.log('skip jwt crypto (no webcrypto)');
    }
    console.log('new-d1 OK');
})().catch(e => { console.error(e); process.exit(1); });
