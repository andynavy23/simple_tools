// 批次 g4：http-ref 的安全標頭（CORS / CSP 產生與檢查）與 Cookie 解析
const { load, ok } = require('./_load');
const assert = require('assert');

{
    const m = load('utils/http-ref.html', 'buildCors, buildCsp, cspSource, parseHeaderBlock, parseCsp, checkCsp, checkHeaders, parseSetCookie, parseCookieInput, checkCookie, searchItems, ITEMS');
    const lv = (arr, level, re) => arr.some(x => x.level === level && re.test(x.msg));
    // CORS 產生
    let c = m.buildCors({ origin: 'https://app.example.com', methods: ['GET', 'POST'], headers: 'Content-Type, Authorization', credentials: true, maxAge: '600', expose: 'X-Total-Count' });
    assert.deepEqual(c.lines, ['Access-Control-Allow-Origin: https://app.example.com', 'Vary: Origin', 'Access-Control-Allow-Methods: GET, POST', 'Access-Control-Allow-Headers: Content-Type, Authorization', 'Access-Control-Allow-Credentials: true', 'Access-Control-Max-Age: 600', 'Access-Control-Expose-Headers: X-Total-Count']);
    assert.equal(c.warns.length, 0);
    c = m.buildCors({ origin: '*', credentials: true }); assert.ok(c.warns.length && !c.lines.includes('Vary: Origin'));
    assert.ok(m.buildCors({ origin: 'https://a.com/' }).warns.length); assert.ok(m.buildCors({ origin: '' }).warns.length && !m.buildCors({ origin: '' }).lines.length);
    assert.ok(m.buildCors({ origin: '*', maxAge: 'abc' }).warns.length); assert.ok(m.buildCors({ origin: 'null' }).warns.length);
    // CSP 產生：關鍵字自動加引號
    assert.equal(m.cspSource('self'), "'self'"); assert.equal(m.cspSource('nonce-abc'), "'nonce-abc'"); assert.equal(m.cspSource('https://cdn.x.com'), 'https://cdn.x.com'); assert.equal(m.cspSource('data:'), 'data:');
    assert.equal(m.buildCsp({ 'default-src': "self", 'img-src': 'self data: https://i.x.com', 'object-src': 'none' }, { upgrade: true }), "default-src 'self'; img-src 'self' data: https://i.x.com; object-src 'none'; upgrade-insecure-requests");
    assert.equal(m.buildCsp({}), '');
    // 往返：產生的 CSP 檢查時不該有「沒加引號」
    assert.ok(!m.checkCsp(m.buildCsp({ 'default-src': 'self', 'script-src': 'self unsafe-inline' })).some(x => /單引號/.test(x.msg)));
    // 檢查 CSP
    let r = m.checkCsp("default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' data: * https: http:");
    for (const re of [/unsafe-inline/, /unsafe-eval/, /data:/, /\*/, /https:/, /http:/]) assert.ok(r.some(x => (x.level === 'bad' || x.level === 'warn') && re.test(x.msg)), String(re));
    assert.ok(lv(m.checkCsp("script-src 'nonce-abc' 'unsafe-inline' 'strict-dynamic'"), 'info', /被忽略/));
    assert.ok(lv(m.checkCsp("default-src self"), 'bad', /單引號/));
    assert.ok(lv(m.checkCsp("img-src 'self'"), 'warn', /script-src/));
    assert.ok(lv(m.checkCsp("defualt-src 'self'"), 'warn', /未知/));
    assert.ok(lv(m.checkCsp("default-src 'self'; default-src 'none'"), 'info', /重複/));
    assert.ok(lv(m.checkCsp("default-src 'self'"), 'info', /frame-ancestors/));
    assert.ok(!lv(m.checkCsp("default-src 'none'; frame-ancestors 'self'; base-uri 'self'"), 'info', /object-src|base-uri|frame-ancestors/));
    // 檢查 header 區塊
    assert.deepEqual(m.parseHeaderBlock('HTTP/1.1 200 OK\nA: b: c\n\nbad line\nX Y: z\nCookie:'), [{ name: 'A', value: 'b: c' }, { name: 'Cookie', value: '' }]);
    r = m.checkHeaders('Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true');
    assert.ok(lv(r, 'bad', /\* 搭配/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Origin: https://a.com, https://b.com'), 'bad', /多個來源/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Origin: https://a.com/'), 'bad', /格式/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Origin: https://a.com'), 'warn', /Vary/));
    assert.ok(!lv(m.checkHeaders('Access-Control-Allow-Origin: https://a.com\nVary: Origin'), 'warn', /Vary/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Credentials: True'), 'bad', /小寫 true/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Origin: https://a.com\nVary: Origin\nAccess-Control-Allow-Credentials: true\nAccess-Control-Allow-Headers: *'), 'warn', /字面/));
    assert.ok(lv(m.checkHeaders('Access-Control-Allow-Origin: *\nAccess-Control-Allow-Origin: https://a.com'), 'bad', /多次/));
    assert.ok(lv(m.checkHeaders('Strict-Transport-Security: includeSubDomains'), 'bad', /max-age/));
    assert.ok(lv(m.checkHeaders('Strict-Transport-Security: max-age=3600'), 'warn', /偏短/));
    assert.ok(lv(m.checkHeaders('X-Content-Type-Options: sniff'), 'bad', /nosniff/));
    assert.ok(lv(m.checkHeaders('X-Frame-Options: ALLOW-FROM https://a'), 'warn', /淘汰/)); assert.ok(lv(m.checkHeaders('X-Frame-Options: DENIED'), 'bad', /DENY/));
    assert.ok(lv(m.checkHeaders('Referrer-Policy: unsafe-url'), 'warn', /完整網址/)); assert.ok(lv(m.checkHeaders('Referrer-Policy: nope'), 'bad', /不是合法/));
    assert.ok(lv(m.checkHeaders("Content-Security-Policy: script-src 'unsafe-inline'"), 'bad', /unsafe-inline/));
    assert.ok(lv(m.checkHeaders('Set-Cookie: sid=1; SameSite=None'), 'bad', /Secure/));
    const good = m.checkHeaders("Content-Security-Policy: default-src 'none'; base-uri 'self'; frame-ancestors 'self'\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin");
    assert.equal(good[0].level, 'ok'); assert.ok(!good.some(x => x.level === 'bad' || x.level === 'warn'));
    assert.equal(m.checkHeaders('')[0].level, 'info');
    assert.ok(m.checkHeaders('Foo: bar').some(x => /未設定/.test(x.msg)));
    // Cookie 解析
    let sc = m.parseSetCookie('Set-Cookie: sid=a=b=c; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Expires=Wed, 21 Oct 2035 07:28:00 GMT; Domain=.x.com; Priority=High; Foo=1; Path=/ignored');
    assert.equal(sc.name, 'sid'); assert.equal(sc.value, 'a=b=c');
    assert.deepEqual(sc.attrs, { Path: '/', HttpOnly: true, Secure: true, SameSite: 'Lax', 'Max-Age': '3600', Expires: 'Wed, 21 Oct 2035 07:28:00 GMT', Domain: '.x.com', Priority: 'High' }); assert.deepEqual(sc.unknown, ['Foo=1']);
    assert.equal(m.parseSetCookie('novalue; Secure').name, ''); assert.equal(m.parseSetCookie('a=; path=/').value, ''); assert.ok('Path' in m.parseSetCookie('a=1; path=/').attrs);
    const pin = m.parseCookieInput('Set-Cookie: a=1; Secure\nb=2; Path=/\nCookie: x=1; y=%E4%BD%A0; z\n\nplain=1; other=2');
    assert.deepEqual(pin.map(x => x.type), ['set', 'set', 'cookie', 'cookie']);
    assert.deepEqual(pin[2].items, [{ name: 'x', value: '1' }, { name: 'y', value: '%E4%BD%A0' }, { name: '', value: 'z' }]); assert.equal(pin[3].items.length, 2);
    // Cookie 檢查
    const now = Date.parse('2026-10-01T00:00:00Z');
    const ck = (s) => m.checkCookie(m.parseSetCookie(s), now);
    assert.ok(lv(ck('a=1; SameSite=None'), 'bad', /Secure/)); assert.ok(lv(ck('a=1; SameSite=Bogus; Secure'), 'bad', /不是合法/));
    assert.ok(lv(ck('__Secure-a=1; Path=/'), 'bad', /__Secure-/)); assert.ok(lv(ck('__Host-a=1; Secure; Path=/; Domain=x.com'), 'bad', /__Host-/)); assert.ok(!lv(ck('__Host-a=1; Secure; Path=/; HttpOnly'), 'bad', /__Host-/));
    assert.ok(lv(ck('a=1; Partitioned'), 'bad', /Partitioned/)); assert.ok(lv(ck('a=1; Path=/'), 'warn', /沒有 Secure/));
    assert.ok(lv(ck('sessionid=1; Secure; Path=/'), 'warn', /HttpOnly/)); assert.ok(lv(ck('theme=1; Secure; Path=/'), 'info', /HttpOnly/));
    assert.ok(lv(ck('a=1; Secure; HttpOnly; Path=/; Expires=Foo'), 'bad', /Expires 不是合法/)); assert.ok(lv(ck('a=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT'), 'info', /刪除/));
    assert.ok(lv(ck('a=1; Max-Age=x'), 'bad', /整數/)); assert.ok(lv(ck('a=1; Max-Age=0'), 'info', /刪除/)); assert.ok(lv(ck('a=1; Max-Age=99999999'), 'info', /400/));
    assert.ok(lv(ck('a=1; Max-Age=5; Expires=Wed, 21 Oct 2035 07:28:00 GMT'), 'info', /Max-Age 為準/)); assert.ok(lv(ck('a=1'), 'info', /工作階段/));
    assert.ok(lv(ck('a=1; Path=x'), 'warn', /以 \//)); assert.ok(lv(ck('a=1; Foo'), 'warn', /不認得/)); assert.ok(lv(ck('a=1; Domain=.x.com'), 'info', /點會被忽略/));
    assert.ok(lv(ck('a=' + 'x'.repeat(4100)), 'bad', /4096/));
    const fine = ck('sid=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600'); assert.equal(fine[0].level, 'ok'); assert.ok(!fine.some(x => x.level === 'bad' || x.level === 'warn'));
    // 既有速查不受影響
    assert.ok(m.ITEMS.length > 100); assert.equal(m.searchItems(m.ITEMS, '429')[0].key, '429');
    ok('http-ref: CORS/CSP generate + check, headers check, cookie parse + check');
}
