// 批次 g4：http-request（curl 解析 / 各語言輸出 / 請求測試 / WebSocket 純邏輯）
const { load, ok } = require('./_load');
const assert = require('assert');

{
    const m = load('utils/http-request.html', 'shellSplit, parseCurl, fromPostman, toFetch, toAxios, toPython, toGo, toCurl, toHttpFile, fromForm, parseHeaderLines, forbiddenHeaders, checkReqUrl, explainFetchError, checkWsUrl, wsCloseInfo, pushLog, loadOpts');
    // 切詞
    assert.deepEqual(m.shellSplit(`curl 'a b' "c \\"d\\"" e\\ f`), ['curl', 'a b', 'c "d"', 'e f']);
    assert.deepEqual(m.shellSplit("curl -d 'it'\\''s' x"), ['curl', '-d', "it's", 'x']);
    assert.deepEqual(m.shellSplit("curl \\\n  -H 'A: b' \\\r\n  url"), ['curl', '-H', 'A: b', 'url']);
    assert.deepEqual(m.shellSplit("curl $'a\\nb\\u4f60\\x41\\'q'"), ['curl', "a\nb你A'q"]);
    assert.deepEqual(m.shellSplit(`x "" ''`), ['x', '', '']);
    assert.deepEqual(m.shellSplit(`"a"'b'c`), ['abc']);
    // 解析
    let r = m.parseCurl(`curl -X POST 'https://api.example.com/items?lang=zh' \\
  -H 'Content-Type: application/json' -H "Authorization: Bearer t" \\
  --data-raw '{"name":"小工具"}' --compressed -k -L -s -o out.txt --retry 3`);
    assert.equal(r.method, 'POST'); assert.equal(r.url, 'https://api.example.com/items?lang=zh');
    assert.deepEqual(r.headers, [['Content-Type', 'application/json'], ['Authorization', 'Bearer t']]);
    assert.equal(r.body, '{"name":"小工具"}');
    assert.ok(r.flags.compressed && r.flags.insecure && r.flags.location);
    assert.deepEqual(r.ignored, ['-s']); assert.deepEqual(r.unknown, ['-o out.txt', '--retry 3']);
    r = m.parseCurl('curl example.com'); assert.equal(r.url, 'http://example.com'); assert.equal(r.method, 'GET'); assert.equal(r.body, null);
    r = m.parseCurl('curl -d a=1 -d b=2 http://x'); assert.equal(r.body, 'a=1&b=2'); assert.equal(r.method, 'POST');
    r = m.parseCurl('curl -XPUT -sSL -u me:pw:x --url=http://x/a -A UA -b "s=1; t=2" -e http://ref'); assert.equal(r.method, 'PUT');
    assert.deepEqual(r.auth, { user: 'me', pass: 'pw:x' }); assert.equal(r.url, 'http://x/a');
    assert.deepEqual(r.headers, [['User-Agent', 'UA'], ['Cookie', 's=1; t=2'], ['Referer', 'http://ref']]); assert.ok(r.flags.location);
    r = m.parseCurl('curl -G -d q=1 -d p=2 http://x/s'); assert.equal(r.url, 'http://x/s?q=1&p=2'); assert.equal(r.method, 'GET'); assert.equal(r.body, null);
    assert.equal(m.parseCurl('curl -I http://x').method, 'HEAD');
    r = m.parseCurl('curl --data-urlencode "name=a b&c" --data-urlencode "x y" http://x'); assert.equal(r.body, 'name=a%20b%26c&x%20y');
    r = m.parseCurl('curl -F a=1 -F "f=@/tmp/p.png;type=image/png" http://x'); assert.deepEqual(r.form, [{ k: 'a', v: '1', file: false }, { k: 'f', v: '/tmp/p.png', file: true }]); assert.equal(r.method, 'POST'); assert.ok(r.notes.length);
    r = m.parseCurl('curl --json \'{"a":1}\' http://x'); assert.equal(r.body, '{"a":1}'); assert.ok(r.headers.some(h => h[0] === 'Accept'));
    r = m.parseCurl('curl -d @file.json http://x'); assert.equal(r.body, '@file.json'); assert.ok(r.notes.length);
    r = m.parseCurl('curl --weird http://x -Z'); assert.deepEqual(r.unknown, ['--weird', '-Z']);
    assert.ok(m.parseCurl('wget x').error); assert.ok(m.parseCurl('').error); assert.ok(m.parseCurl('curl -s').error);
    assert.equal(m.parseCurl('$ curl http://x').url, 'http://x');
    assert.equal(m.parseCurl("curl 'http://x' -H 'Accept: */*' -H 'X-Empty;'").unknown.length, 1);
    // 輸出
    const base = m.parseCurl(`curl -X POST 'https://a.com/p' -H 'Content-Type: application/json' -H 'X-A: 1' -H 'X-A: 2' -u 'u:p"w' --data-raw '{"k":"v \\"q\\" 你好","n":"line
break"}' -k`);
    const f = m.toFetch(base);
    assert.ok(f.includes('await fetch("https://a.com/p"') && f.includes('method: "POST"') && f.includes('"X-A": "1, 2"') && f.includes('"Authorization": "Basic ' + Buffer.from('u:p"w').toString('base64') + '"'), f);
    assert.ok(f.includes('body: \'{"k":"v \\\\"q\\\\" 你好","n":"line\\nbreak"}\''), f);
    assert.equal(m.toFetch(m.parseCurl('curl http://x/')), 'const res = await fetch("http://x/");\nconsole.log(res.status, await res.text());');
    const ax = m.toAxios(base); assert.ok(ax.includes('method: "post"') && ax.includes('auth: { username: "u", password: \'p"w\' }'), ax);
    const py = m.toPython(base); assert.ok(py.includes('requests.post(') && py.includes('verify=False') && py.includes('.encode("utf-8")') && py.includes('auth=("u", \'p"w\')'), py);
    assert.ok(m.toPython(m.parseCurl('curl -X PROPFIND http://x')).includes('requests.request(\n    "PROPFIND",\n    "http://x"'));
    const go = m.toGo(base); assert.ok(go.includes('"crypto/tls"') && go.includes('strings.NewReader(`{"k"') && go.includes('req.SetBasicAuth("u", `p"w`)') && go.includes('http.NewRequest("POST"'), go);
    assert.ok(m.toGo(m.parseCurl('curl -d "a=1" http://x')).includes('req.Header.Set("Content-Type", "application/x-www-form-urlencoded")'));
    const fm = m.parseCurl('curl -F a=1 -F f=@/tmp/x.png http://x/up');
    assert.ok(m.toFetch(fm).includes('new FormData()') && !m.toFetch(fm).includes('Content-Type'));
    assert.ok(m.toGo(fm).includes('multipart.NewWriter') && m.toGo(fm).includes('os.Open("/tmp/x.png")'));
    assert.ok(m.toPython(fm).includes('files=[') && m.toPython(fm).includes('open("/tmp/x.png", "rb")'));
    const hf = m.toHttpFile(fm); assert.ok(hf.startsWith('POST http://x/up HTTP/1.1\nContent-Type: multipart/form-data; boundary=') && hf.includes('< /tmp/x.png') && hf.includes('name="a"'));
    assert.equal(m.toHttpFile(m.parseCurl("curl -d 'a=1' http://x")), 'POST http://x HTTP/1.1\nContent-Type: application/x-www-form-urlencoded\n\na=1');
    // 往返：curl -> model -> curl -> model 相同
    for (const cmd of [
        `curl -X POST 'https://a.com/p?x=1&y=2' -H 'Content-Type: application/json' --data-raw '{"a":"it'\\''s \\"x\\" $HOME \`z\`"}' --compressed`,
        `curl 'http://x' -u 'me:p@ss word' -H 'A: b: c' -L -k`,
        `curl -X DELETE http://x/1`, `curl -I http://x`, `curl -F 'a=1' -F 'f=@./a b.txt' http://x`,
        `curl http://x -d $'line1\\nline2\\ttab'`, `curl -X PUT http://x -d ''`,
    ]) {
        const a = m.parseCurl(cmd), b = m.parseCurl(m.toCurl(a));
        assert.ok(!a.error, cmd);
        for (const k of ['method', 'url', 'headers', 'body', 'form', 'auth', 'flags']) assert.deepEqual(b[k], a[k], cmd + ' / ' + k);
    }
    // Postman
    const pm = m.fromPostman({ info: {}, item: [{ name: 'f', item: [{ name: 'r', request: { method: 'post', header: [{ key: 'A', value: '1' }, { key: 'B', value: '2', disabled: true }], url: { raw: 'https://x/{{id}}?a=1' }, body: { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } }, auth: { type: 'basic', basic: [{ key: 'username', value: 'u' }, { key: 'password', value: 'p' }] } } }] }] });
    assert.equal(pm.method, 'POST'); assert.equal(pm.url, 'https://x/{{id}}?a=1'); assert.deepEqual(pm.headers, [['A', '1'], ['Content-Type', 'application/json']]); assert.deepEqual(pm.auth, { user: 'u', pass: 'p' }); assert.ok(pm.notes.length);
    assert.ok(m.toCurl(pm).includes("-u 'u:p'"));
    const pu = m.fromPostman(JSON.stringify({ request: { method: 'POST', url: { protocol: 'http', host: ['a', 'com'], path: ['v1', 'x'], query: [{ key: 'q', value: '1' }, { key: 'z', value: '2', disabled: true }] }, body: { mode: 'urlencoded', urlencoded: [{ key: 'a b', value: 'c&d' }] }, auth: { type: 'bearer', bearer: [{ key: 'token', value: 'T' }] } } }));
    assert.equal(pu.url, 'http://a.com/v1/x?q=1'); assert.equal(pu.body, 'a%20b=c%26d'); assert.deepEqual(pu.headers, [['Authorization', 'Bearer T']]);
    const pf = m.fromPostman({ method: 'POST', url: 'http://x', body: { mode: 'formdata', formdata: [{ key: 'a', value: '1', type: 'text' }, { key: 'f', type: 'file', src: '/p.png' }] } });
    assert.deepEqual(pf.form, [{ k: 'a', v: '1', file: false }, { k: 'f', v: '/p.png', file: true }]);
    assert.ok(m.fromPostman('{bad').error); assert.ok(m.fromPostman({ item: [] }).error); assert.ok(m.fromPostman(5).error);
    // 表單
    assert.ok(m.fromForm({ method: 'GET', url: '' }).error);
    const ff = m.fromForm({ method: 'POST', url: 'x.com/a', headers: 'A: 1\nbad line\n# c\nB:2: 3', body: '{"z":1}' });
    assert.equal(ff.url, 'http://x.com/a'); assert.deepEqual(ff.headers, [['A', '1'], ['B', '2: 3']]); assert.equal(ff.notes.length, 1); assert.equal(ff.body, '{"z":1}');
    assert.deepEqual(m.parseHeaderLines('A b: c').bad, ['A b: c']); assert.deepEqual(m.parseHeaderLines(null).headers, []);
    assert.deepEqual(m.forbiddenHeaders([['Cookie', 'a'], ['sec-fetch-mode', 'x'], ['X-OK', 'y'], ['Proxy-Authorization', 'z'], ['host', 'h']]), ['Cookie', 'sec-fetch-mode', 'Proxy-Authorization', 'host']);
    // 請求測試
    assert.ok(!m.checkReqUrl('ftp://x', 'https:').ok); assert.ok(!m.checkReqUrl('abc', 'https:').ok);
    assert.equal(m.checkReqUrl('http://a.com', 'https:').warn.length, 1); assert.equal(m.checkReqUrl('http://localhost:3000', 'https:').warn.length, 0);
    assert.equal(m.checkReqUrl('https://a.com', 'file:').warn.length, 1);
    assert.ok(m.explainFetchError({ name: 'AbortError' }, { reason: 'timeout' })[0].includes('逾時')); assert.ok(m.explainFetchError({ name: 'AbortError' }, { reason: 'cancel' })[0].includes('取消'));
    const ex = m.explainFetchError(new TypeError('Failed to fetch'), { method: 'POST', hasHeaders: true, url: 'http://a', pageProtocol: 'https:', noCors: true }).join('\n');
    assert.ok(ex.includes('CORS') && ex.includes('預檢') && ex.includes('混合內容') && ex.includes('no-cors'));
    assert.ok(!m.explainFetchError(new TypeError('x'), { method: 'GET', url: 'https://a' }).join('').includes('預檢'));
    // WebSocket
    assert.ok(m.checkWsUrl('wss://x.com/a', 'https:').ok); assert.ok(!m.checkWsUrl('http://x', 'file:').ok); assert.ok(!m.checkWsUrl('ws://x.com', 'https:').ok);
    assert.ok(m.checkWsUrl('ws://localhost:8080', 'https:').ok); assert.ok(!m.checkWsUrl('', 'file:').ok);
    assert.ok(m.wsCloseInfo(1006).includes('異常')); assert.ok(m.wsCloseInfo(4001).includes('自訂')); assert.ok(m.wsCloseInfo(1000).includes('正常')); assert.equal(m.wsCloseInfo(7), '未知的關閉碼');
    let lg = [], res;
    for (let i = 0; i < 600; i++) { res = m.pushLog(lg, { i }); lg = res.log; }
    assert.equal(lg.length, 500); assert.equal(lg[0].i, 0); assert.equal(lg[499].i, 499); assert.ok(res.full && !res.added);
    assert.ok(m.pushLog(new Array(499).fill(0), {}).full);
    assert.deepEqual(m.loadOpts(null), { tab: 'a', src: 'curl', lang: 'fetch', method: 'GET' });
    assert.deepEqual(m.loadOpts({ tab: 'x', src: 'form', lang: 'go', method: 'zz' }), { tab: 'a', src: 'form', lang: 'go', method: 'GET' });
    ok('http-request: curl parse / outputs / roundtrip / postman / test helpers / ws');
}
