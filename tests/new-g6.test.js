// 批次 g6：password-gen（TOTP、強度評估）、aes-crypt（金鑰對 / X.509 / PEM）、ai-helper
const assert = require('assert');
const { load, ok } = require('./_load');

(async () => {
    // ---------- password-gen：TOTP（RFC 6238 附錄 B 標準測試向量，8 位數）----------
    {
        const m = load('utils/password-gen.html', 'base32Decode, hotp, totp, parseSecretInput, findRoots, assess, crackSeconds, HASHES');
        const enc = (s) => new TextEncoder().encode(s);
        const K = { SHA1: enc('12345678901234567890'), SHA256: enc('12345678901234567890123456789012'), SHA512: enc('1234567890123456789012345678901234567890123456789012345678901234') };
        const V = [
            [59, '94287082', '46119246', '90693936'], [1111111109, '07081804', '68084774', '25091201'], [1111111111, '14050471', '67062674', '99943326'],
            [1234567890, '89005924', '91819424', '93441116'], [2000000000, '69279037', '90698825', '38618901'], [20000000000, '65353130', '77737706', '47863826'],
        ];
        for (const [t, a1, a256, a512] of V) {
            assert.strictEqual(await m.totp(K.SHA1, t, { digits: 8, algo: 'SHA1' }), a1, 'SHA1 ' + t);
            assert.strictEqual(await m.totp(K.SHA256, t, { digits: 8, algo: 'SHA256' }), a256, 'SHA256 ' + t);
            assert.strictEqual(await m.totp(K.SHA512, t, { digits: 8, algo: 'SHA512' }), a512, 'SHA512 ' + t);
        }
        // RFC 4226 附錄 D：HOTP 6 位數
        const H = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
        for (let i = 0; i < 10; i++) assert.strictEqual(await m.hotp(K.SHA1, i), H[i]);
        // 6 位 = 8 位的末 6 碼
        assert.strictEqual(await m.totp(K.SHA1, 59, { digits: 6 }), '287082');
        // Base32
        assert.deepStrictEqual([...m.base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')], [...K.SHA1]);
        assert.deepStrictEqual([...m.base32Decode('gezd gnbv-gy3t qojq gezd gnbv gy3t qojq====')], [...K.SHA1]);
        assert.deepStrictEqual([...m.base32Decode('MZXW6===')], [...enc('foo')]);
        assert.throws(() => m.base32Decode('abc1')); assert.throws(() => m.base32Decode('  '));
        // otpauth
        let p = m.parseSecretInput('otpauth://totp/Ex:alice?secret=JBSWY3DPEHPK3PXP&issuer=Ex&algorithm=SHA256&digits=8&period=60');
        assert.deepStrictEqual(p, { secret: 'JBSWY3DPEHPK3PXP', algo: 'SHA256', digits: 8, period: 60 });
        assert.deepStrictEqual(m.parseSecretInput(' ABC '), { secret: 'ABC' });
        assert.strictEqual(m.parseSecretInput('otpauth://totp/x').secret, '');
        // 強度評估：字根、雜湊速度
        assert.deepStrictEqual(m.findRoots('MyPassword99'), ['password']); assert.deepStrictEqual(m.findRoots('kT9#vL2$mQ8@'), []);
        assert.ok(m.assess('MyPassword99xyz').issues.some(i => i.includes('常見字根')));
        const bits = 50, fast = m.crackSeconds(bits), slow = m.crackSeconds(bits, m.HASHES.find(h => h.id === 'argon2').rate);
        assert.ok(slow / fast > 1e6); assert.strictEqual(m.crackSeconds(bits), Math.pow(2, 50) / 2 / 1e10);
        assert.ok(m.HASHES.every(h => h.rate > 0 && h.name && h.note));
        ok('g6 password-gen: TOTP RFC 6238 + 強度評估');
    }

    // ---------- aes-crypt：金鑰對 / PEM / X.509 ----------
    {
        const nc = require('crypto'), { execFileSync } = require('child_process');
        const m = load('utils/aes-crypt.html', 'toPem, decodeAny, identify, derToTree, parseCert, generateKeyPair, toHex, fromHex, toB64, fromB64, oidName');
        // PEM 往返
        const rnd = nc.randomBytes(100), pem = m.toPem('TEST DATA', rnd);
        assert.ok(pem.startsWith('-----BEGIN TEST DATA-----\n') && pem.endsWith('-----END TEST DATA-----'));
        assert.ok(pem.split('\n').slice(1, -1).every(l => l.length <= 64));
        let d = m.decodeAny(pem); assert.strictEqual(d.label, 'TEST DATA'); assert.deepStrictEqual([...d.bytes], [...rnd]);
        d = m.decodeAny(rnd.toString('base64')); assert.strictEqual(d.label, ''); assert.deepStrictEqual([...d.bytes], [...rnd]);
        d = m.decodeAny(rnd.toString('hex').replace(/(..)/g, '$1 ')); assert.deepStrictEqual([...d.bytes], [...rnd]);
        d = m.decodeAny(rnd.toString('hex').replace(/(..)/g, '$1:').slice(0, -1)); assert.deepStrictEqual([...d.bytes], [...rnd]);
        assert.throws(() => m.decodeAny('')); assert.throws(() => m.decodeAny('-----BEGIN X-----\n!!!!\n-----END X-----'));

        // 金鑰對：用 node 驗證 PEM 可載入、公私鑰相符、JWK 可匯入
        for (const kind of ['rsa-oaep', 'rsa-pss', 'ecdsa']) {
            const k = await m.generateKeyPair(kind, 2048);
            assert.ok(k.privPem.includes('BEGIN PRIVATE KEY') && k.pubPem.includes('BEGIN PUBLIC KEY'));
            const priv = nc.createPrivateKey(k.privPem), pub = nc.createPublicKey(k.pubPem);
            assert.strictEqual(nc.createPublicKey(priv).export({ type: 'spki', format: 'pem' }).trim(), k.pubPem.trim());
            assert.strictEqual(priv.asymmetricKeyType, kind === 'ecdsa' ? 'ec' : 'rsa');
            if (kind !== 'ecdsa') assert.strictEqual(priv.asymmetricKeyDetails.modulusLength, 2048);
            else assert.strictEqual(priv.asymmetricKeyDetails.namedCurve, 'prime256v1');
            const jp = JSON.parse(k.privJwk), jb = JSON.parse(k.pubJwk);
            assert.strictEqual(nc.createPrivateKey({ key: jp, format: 'jwk' }).export({ type: 'pkcs8', format: 'pem' }).trim(), k.privPem.trim());
            assert.ok(!('d' in jb) && 'd' in jp);
            assert.strictEqual(m.identify(m.decodeAny(k.privPem).bytes, 'PRIVATE KEY').type, '私鑰');
            assert.strictEqual(m.identify(m.decodeAny(k.pubPem).bytes, '').type, '公鑰');     // 無標籤時用結構判斷
            assert.strictEqual(m.identify(m.decodeAny(k.privPem).bytes, '').type, '私鑰');
        }
        // 標籤辨識
        for (const [l, t] of [['CERTIFICATE', '憑證'], ['CERTIFICATE REQUEST', 'CSR'], ['NEW CERTIFICATE REQUEST', 'CSR'], ['RSA PRIVATE KEY', '私鑰'], ['EC PRIVATE KEY', '私鑰'], ['ENCRYPTED PRIVATE KEY', '私鑰'], ['PUBLIC KEY', '公鑰'], ['RSA PUBLIC KEY', '公鑰']]) assert.strictEqual(m.identify(new Uint8Array(1), l).type, t, l);
        assert.strictEqual(m.identify(new Uint8Array([1, 2, 3]), '').type, '未知');

        // ASN.1：手刻 DER 對照
        const t = m.derToTree(Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x05, 0x04, 0x01, 0xff]));
        assert.strictEqual(t.tag, 0x30); assert.strictEqual(t.children.length, 2); assert.strictEqual(t.children[1].tag, 4);
        assert.throws(() => m.derToTree(Uint8Array.from([0x30, 0x05, 0x02, 0x01]))); // 長度超出
        assert.throws(() => m.derToTree(Uint8Array.from([0x30, 0x80, 0, 0])));         // 不定長度
        assert.strictEqual(m.oidName('1.2.840.113549.1.1.11'), 'sha256WithRSAEncryption'); assert.strictEqual(m.oidName('9.9.9'), '9.9.9');

        // X.509：用 openssl 產生含 SAN 的自簽憑證，與 node X509Certificate 對照
        let certPem = null;
        try {
            const fs = require('fs'), os = require('os'), path = require('path'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g6-'));
            try {
                execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '90', '-subj', '/C=TW/O=Test Org/CN=example.test', '-addext', 'subjectAltName=DNS:example.test,DNS:*.example.test,IP:10.1.2.3,email:a@b.test,URI:https://x.test/'], { stdio: 'ignore' });
                certPem = fs.readFileSync(path.join(dir, 'c.pem'), 'utf8');
            } finally { fs.rmSync(dir, { recursive: true, force: true }); }
        } catch (e) { certPem = null; }
        if (certPem) {
            const x = new nc.X509Certificate(certPem), c = await m.parseCert(m.decodeAny(certPem).bytes);
            assert.strictEqual(c.fingerprint.replace(/:/g, '').toLowerCase(), x.fingerprint256.replace(/:/g, '').toLowerCase());
            assert.strictEqual(c.serial.replace(/:/g, '').toLowerCase().replace(/^0+/, ''), x.serialNumber.toLowerCase().replace(/^0+/, ''));
            assert.strictEqual(new Date(c.notBefore).getTime(), new Date(x.validFrom).getTime()); assert.strictEqual(new Date(c.notAfter).getTime(), new Date(x.validTo).getTime());
            assert.ok(c.subject.includes('CN=example.test') && c.subject.includes('O=Test Org') && c.subject.includes('C=TW'));
            assert.strictEqual(c.issuer, c.subject);
            assert.ok(/sha256WithRSAEncryption/.test(c.sigAlg)); assert.ok(/RSA/.test(c.pubKey) && c.pubKey.includes('2048'));
            for (const s of ['example.test', '*.example.test', '10.1.2.3', 'a@b.test', 'https://x.test/']) assert.ok(c.san.some(v => v.includes(s)), s);
            assert.strictEqual(m.identify(m.decodeAny(certPem).bytes, '').type, '憑證');
            ok('g6 aes-crypt: X.509 vs openssl/node');
        } else console.log('skip g6 X.509 openssl 對照（找不到 openssl）');
        // 沒有 openssl 時也能用 node 對 EC 樣本做 CSR / 公鑰結構檢查：此處以 node 產生的 DER 公鑰驗證 ASN.1 樹
        const { publicKey } = nc.generateKeyPairSync('ec', { namedCurve: 'P-256' }), der = publicKey.export({ type: 'spki', format: 'der' });
        const tree = m.derToTree(new Uint8Array(der)); assert.strictEqual(tree.children.length, 2); assert.strictEqual(tree.children[1].tag, 3);
        await assert.rejects(m.parseCert(Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x01])));
        ok('g6 aes-crypt: PEM/金鑰對/ASN.1');
    }

    // ---------- ai-helper ----------
    {
        const m = load('utils/ai-helper.html', 'estimateTokens, calcCost, buildSchema, extractVars, fillVars, batchFill, checkStructure, normalizePrompts, normalizeOpts, parseVector, vectorStats, PROMPT_MAX, BODY_MAX, STARTERS');
        // Token 估算
        let e = m.estimateTokens(''); assert.deepStrictEqual([e.chars, e.low, e.mid, e.high], [0, 0, 0, 0]);
        e = m.estimateTokens('a'.repeat(400)); assert.ok(e.mid >= 95 && e.mid <= 105 && e.low < e.mid && e.mid < e.high);
        e = m.estimateTokens('你好世界'.repeat(100)); assert.strictEqual(e.cjk, 400); assert.ok(e.mid > 250 && e.mid < 400);
        assert.ok(m.estimateTokens('你'.repeat(100)).mid > m.estimateTokens('a'.repeat(100)).mid, '中文每字元 token 較多');
        assert.strictEqual(m.estimateTokens('Hello world 你好').cjk, 2);
        // 費用
        let c = m.calcCost({ inTok: 1000, outTok: 500, pIn: 3, pOut: 15, calls: 100 });
        assert.ok(Math.abs(c.perCall - (1000 * 3 + 500 * 15) / 1e6) < 1e-12); assert.ok(Math.abs(c.month - c.perCall * 100) < 1e-12);
        assert.ok(Math.abs(m.calcCost({ inTok: '2000', outTok: '', pIn: '1.5', pOut: '', calls: '' }).perCall - 0.003) < 1e-12);
        assert.strictEqual(m.calcCost({ inTok: -5, outTok: 'x', pIn: 1, pOut: 1, calls: 3 }).perCall, 0);
        // Schema
        const sc = m.buildSchema({ name: 'get_weather', desc: '查天氣', params: [{ name: 'city', type: 'string', desc: '城市', required: true, enumText: '台北, 高雄' }, { name: 'days', type: 'integer', desc: '', required: false, enumText: '' }, { name: 'tags', type: 'array:string', desc: '', required: true, enumText: '' }, { name: 'n', type: 'number', desc: '', required: false, enumText: '1, 2.5' }], style: 'openai' });
        const o = JSON.parse(sc.json);
        assert.strictEqual(o.type, 'function'); assert.strictEqual(o.function.name, 'get_weather');
        assert.deepStrictEqual(o.function.parameters.required, ['city', 'tags']); assert.deepStrictEqual(o.function.parameters.properties.city.enum, ['台北', '高雄']);
        assert.deepStrictEqual(o.function.parameters.properties.tags, { type: 'array', items: { type: 'string' } }); assert.deepStrictEqual(o.function.parameters.properties.n.enum, [1, 2.5]);
        assert.strictEqual(o.function.parameters.properties.days.type, 'integer'); assert.strictEqual(o.function.parameters.type, 'object');
        const an = JSON.parse(m.buildSchema({ name: 'f', desc: 'd', params: [], style: 'anthropic' }).json); assert.deepStrictEqual(an, { name: 'f', description: 'd', input_schema: { type: 'object', properties: {} } });
        const raw = JSON.parse(m.buildSchema({ name: 'f', desc: '', params: [{ name: 'a', type: 'boolean', required: true }], style: 'schema' }).json); assert.deepStrictEqual(raw, { type: 'object', properties: { a: { type: 'boolean' } }, required: ['a'] });
        assert.ok(m.buildSchema({ name: 'bad name!', desc: '', params: [], style: 'openai' }).errors.length);
        assert.ok(m.buildSchema({ name: 'f', desc: '', params: [{ name: 'a', type: 'string' }, { name: 'a', type: 'string' }], style: 'openai' }).errors.some(x => x.includes('重複')));
        assert.ok(m.buildSchema({ name: 'f', desc: '', params: [{ name: 'a', type: 'integer', enumText: '1, x' }], style: 'openai' }).errors.length);
        // 變數
        assert.deepStrictEqual(m.extractVars('嗨 {{name}}，{{ topic }} 與 {{name}} {{ bad name }}'), ['name', 'topic']);
        assert.strictEqual(m.fillVars('嗨 {{name}} {{x}}', { name: 'Ann' }), '嗨 Ann {{x}}');
        assert.strictEqual(m.fillVars('{{a}}', { a: '$& {{a}}' }), '$& {{a}}', '取代值不被當成樣式');
        const bf = m.batchFill('Hi {{name}} from {{city}}', 'name,city\nAnn,"Taipei, TW"\nBob,\n');
        assert.deepStrictEqual(bf.outputs, ['Hi Ann from Taipei, TW', 'Hi Bob from ']); assert.deepStrictEqual(bf.missing, []);
        assert.deepStrictEqual(m.batchFill('{{a}} {{b}}', 'a\n1').missing, ['b']);
        assert.throws(() => m.batchFill('x', 'a\n"1'));
        assert.strictEqual(m.batchFill('{{a}}', 'a\n' + '1\n'.repeat(500)).outputs.length, 200);
        // 結構檢查
        let s = m.checkStructure('你是資深工程師。任務：審查程式碼。限制：不要改變行為。輸出格式：JSON。'); assert.ok(s.every(x => x.ok));
        s = m.checkStructure('幫我寫一首詩'); assert.deepStrictEqual(s.map(x => x.ok), [false, true, false, false]);
        s = m.checkStructure('You are a translator. Translate the text. You must keep names. Output as a table.'); assert.ok(s.every(x => x.ok));
        assert.ok(m.checkStructure('').every(x => !x.ok));
        // 範本載入驗證
        const n = m.normalizePrompts([{ id: 'a', title: 't', cat: 'c', body: 'b', ts: 1 }, null, 5, { title: 'x'.repeat(500), body: 'y'.repeat(30000) }, { id: 'a', title: 'dup' }, { body: 123 }]);
        assert.ok(n.length >= 2 && new Set(n.map(p => p.id)).size === n.length); assert.ok(n.every(p => p.title.length <= 100 && p.body.length <= m.BODY_MAX && typeof p.id === 'string' && typeof p.cat === 'string'));
        assert.deepStrictEqual(m.normalizePrompts(null), []); assert.deepStrictEqual(m.normalizePrompts({}), []);
        assert.strictEqual(m.normalizePrompts(Array.from({ length: 300 }, (_, i) => ({ id: 'i' + i, title: 't', body: 'b' }))).length, m.PROMPT_MAX); assert.strictEqual(m.PROMPT_MAX, 200); assert.strictEqual(m.BODY_MAX, 20000);
        const op = m.normalizeOpts({ tab: 'nope', cost: { inTok: 5, pIn: 'abc', unit: 'x'.repeat(100) }, ctx: [{ name: 'a', ctx: '1000', out: '', note: 'n' }, 7, { name: 'b'.repeat(500) }].concat(Array.from({ length: 100 }, () => ({}))) });
        assert.strictEqual(op.tab, 'tok'); assert.ok(op.ctx.length <= 50 && op.ctx[0].name === 'a' && op.cost.unit.length <= 12 && typeof op.cost.pIn === 'string');
        assert.strictEqual(m.normalizeOpts(null).tab, 'tok'); assert.strictEqual(m.normalizeOpts('x').ctx.length, 0);
        assert.ok(m.STARTERS.length >= 3 && m.STARTERS.every(p => p.title && p.body && m.checkStructure(p.body).every(x => x.ok)), '內建範本結構完整');
        // 向量
        assert.deepStrictEqual(m.parseVector('[1, 2.5; -3]\n4e1'), [1, 2.5, -3, 40]); assert.throws(() => m.parseVector('1, a')); assert.throws(() => m.parseVector('')); assert.throws(() => m.parseVector('1,Infinity'));
        let v = m.vectorStats([1, 0], [0, 1]); assert.strictEqual(v.cosine, 0); assert.strictEqual(v.dot, 0); assert.ok(Math.abs(v.euclid - Math.SQRT2) < 1e-12);
        v = m.vectorStats([1, 2, 3], [2, 4, 6]); assert.ok(Math.abs(v.cosine - 1) < 1e-12); assert.strictEqual(v.dot, 28); assert.ok(Math.abs(v.cosDistance) < 1e-12);
        v = m.vectorStats([1, 2], [-1, -2]); assert.ok(Math.abs(v.cosine + 1) < 1e-12);
        assert.throws(() => m.vectorStats([1, 2], [1, 2, 3]), /維度/); assert.strictEqual(m.vectorStats([0, 0], [1, 1]).cosine, null);
        ok('g6 ai-helper: pure');
    }
})().catch(e => { console.error(e); process.exit(1); });
