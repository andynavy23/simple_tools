// 批次 g9：code-minify（SVG 優化、CSS ⇄ SCSS）、image-resize（圖示包 / zip / ico）、qr-code（Code 39、SVG）、css-gen（版面）、csv-tool（XLSX）
const assert = require('assert');
const zlib = require('zlib');
const { load, ok } = require('./_load.js');

// 獨立於頁面實作的 CRC32（逐位元）
const crcRef = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; };
// 獨立的 zip 讀取（只看本機檔頭，不經過頁面的中央目錄解析），回傳 [{ name, method, crc, data }]；同時檢查中央目錄與 EOCD 一致
function zipWalk(u8) {
    const b = Buffer.from(u8), out = []; let o = 0;
    while (b.readUInt32LE(o) === 0x04034b50) {
        const method = b.readUInt16LE(o + 8), crc = b.readUInt32LE(o + 14), cs = b.readUInt32LE(o + 18), us = b.readUInt32LE(o + 22), nl = b.readUInt16LE(o + 26), xl = b.readUInt16LE(o + 28);
        const name = b.toString('utf8', o + 30, o + 30 + nl), data = b.subarray(o + 30 + nl + xl, o + 30 + nl + xl + cs);
        assert.equal(cs, us); assert.equal(crcRef(data), crc, name + ' CRC'); out.push({ name, method, crc, data, off: o }); o += 30 + nl + xl + cs;
    }
    const cdStart = o; let n = 0;
    while (b.readUInt32LE(o) === 0x02014b50) { const nl = b.readUInt16LE(o + 28); assert.equal(b.readUInt32LE(o + 42), out[n].off, '中央目錄位移'); assert.equal(b.readUInt32LE(o + 16), out[n].crc); assert.equal(b.toString('utf8', o + 46, o + 46 + nl), out[n].name); o += 46 + nl; n++; }
    assert.equal(n, out.length); assert.equal(b.readUInt32LE(o), 0x06054b50); assert.equal(b.readUInt16LE(o + 10), out.length); assert.equal(b.readUInt32LE(o + 12), o - cdStart); assert.equal(b.readUInt32LE(o + 16), cdStart); assert.equal(o + 22, b.length);
    return out;
}

(async () => {
    // ---------- qr-code：Code 39 與 SVG ----------
    {
        const m = load('utils/qr-code.html', 'C39, code39Modules, barcodeSvg');
        // 表結構：44 個字元；40 個是「2 寬條 + 1 寬空」，4 個（$ / + %）是 3 寬空；全部不同
        const keys = Object.keys(m.C39); assert.equal(keys.length, 44); assert.equal(new Set(Object.values(m.C39)).size, 44);
        // 依標準規則重新產生一遍比對：四組（寬空位置 3 / 5 / 7 / 1），組內依序是 10 種「兩個寬條」的位置
        const PAIRS = [[0, 8], [2, 8], [0, 2], [4, 8], [0, 4], [2, 4], [6, 8], [0, 6], [2, 6], [4, 6]];
        const groups = [['1234567890', 3], ['ABCDEFGHIJ', 5], ['KLMNOPQRST', 7], ['UVWXYZ-. *', 1]];
        for (const [chars, sp] of groups) [...chars].forEach((ch, i) => { const w = new Set([sp, ...PAIRS[i]]); assert.equal(m.C39[ch], [...Array(9).keys()].map(k => (w.has(k) ? 'w' : 'n')).join(''), ch); });
        [['$', [1, 3, 5]], ['/', [1, 3, 7]], ['+', [1, 5, 7]], ['%', [3, 5, 7]]].forEach(([ch, w]) => assert.equal(m.C39[ch], [...Array(9).keys()].map(k => (w.includes(k) ? 'w' : 'n')).join(''), ch));
        const STAR = '100010111011101', A = '111010100010111';
        assert.equal(m.code39Modules('A'), STAR + '0' + A + '0' + STAR); assert.equal(m.code39Modules('abc'), m.code39Modules('ABC'));
        for (const t of ['HELLO 123', 'A-B.C$D/E+F%', '0123456789']) { const mod = m.code39Modules(t); assert.ok(mod.startsWith(STAR + '0') && mod.endsWith('0' + STAR)); assert.ok(/^[01]+$/.test(mod)); }
        // 每個字元 = 6 窄 + 3 寬 = 15 個模組，字元之間 1 個窄空：長度 = 15n + (n - 1)
        for (const t of ['A', 'AB', 'HELLO 123', 'X-Y.Z']) assert.equal(m.code39Modules(t).length, 15 * (t.length + 2) + (t.length + 1), t);
        for (const bad of ['', '你好', 'a*b', 'é', 'a_b', 'a\tb']) assert.throws(() => m.code39Modules(bad), Error, JSON.stringify(bad));
        const mod = m.code39Modules('AB12'), svg = m.barcodeSvg(mod, { unit: 2, height: 80, label: 'A<B>&"' });
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')); assert.ok(svg.includes('A&lt;B&gt;&amp;&quot;') && !svg.includes('A<B'));
        const w = (mod.length + 20) * 2; assert.ok(svg.includes(`width="${w}"`) && svg.includes('height="' + (80 + 20 + 14 + 12) + '"'));
        // path 中所有條的寬度總和 = 模組字串中 '1' 的個數 × unit
        const d = /<path d="([^"]*)"/.exec(svg)[1]; let sum = 0, bars = 0; for (const mm of d.matchAll(/h(\d+)v80h-\d+z/g)) { sum += +mm[1]; bars++; }
        assert.equal(sum, [...mod].filter(c => c === '1').length * 2); assert.equal(bars, mod.split('0').filter(Boolean).length);
        assert.ok(!m.barcodeSvg(mod, { label: '' }).includes('<text'));
        assert.ok(m.barcodeSvg('10101', { unit: 1, quiet: 0, height: 5 }).includes('M0 10h1v5h-1zM2 10h1v5h-1zM4 10h1v5h-1z'));
        ok('g9 qr-code: Code 39 + barcode SVG');
    }

    // ---------- css-gen：版面 ----------
    {
        const m = load('utils/css-gen.html', 'ITEM_DEF, layoutNorm, layoutRules, layoutCss');
        const d = m.layoutNorm(null); assert.equal(d.mode, 'flex'); assert.equal(d.n, 5); assert.equal(d.cols, 'repeat(3, 1fr)'); assert.deepEqual(d.items, {});
        for (const junk of [undefined, 5, 'x', [], { n: 'abc', mode: 'bad', gap: -5, sel: 99, dir: 'sideways', items: 'x' }]) { const L = m.layoutNorm(junk); assert.ok(['flex', 'grid'].includes(L.mode) && L.n >= 1 && L.n <= 12 && L.gap >= 0 && L.sel <= L.n); }
        assert.equal(m.layoutNorm({ n: 99 }).n, 12); assert.equal(m.layoutNorm({ n: 0 }).n, 1); assert.equal(m.layoutNorm({ gap: 999 }).gap, 60); assert.equal(m.layoutNorm({ n: 3, sel: 9 }).sel, 3);
        // 注入：不合法的欄 / 列值退回預設
        for (const bad of ['1fr; background:red', '1fr } body { x', 'url(x)', 'a:b', '', '1fr\n;', 'x'.repeat(100)]) assert.equal(m.layoutNorm({ cols: bad }).cols, bad === 'url(x)' ? 'url(x)' : 'repeat(3, 1fr)', bad);
        assert.equal(m.layoutNorm({ cols: '1fr 2fr' }).cols, '1fr 2fr'); assert.equal(m.layoutNorm({ rows: 'minmax(40px, auto) 1fr' }).rows, 'minmax(40px, auto) 1fr');
        // 子項目：只留非預設、限制範圍
        const L = m.layoutNorm({ n: 4, items: { 1: { grow: 2, self: 'center' }, 2: { grow: 0, self: 'auto', order: 0 }, 3: { grow: 99, order: -99, cs: 99, rs: 0 }, 4: 'x', 13: { grow: 1 } } });
        assert.deepEqual(L.items, { 1: { grow: 2, self: 'center' }, 3: { grow: 5, order: -5, cs: 6 } });
        const f = m.layoutRules({ mode: 'flex', n: 3, dir: 'column', wrap: 'wrap', jc: 'space-between', ai: 'center', gap: 12, items: { 2: { grow: 1, order: 2 }, 3: { cs: 2 }, 9: { grow: 1 } } });
        assert.deepEqual(f.container, ['display: flex;', 'flex-direction: column;', 'flex-wrap: wrap;', 'justify-content: space-between;', 'align-items: center;', 'align-content: stretch;', 'gap: 12px;']);
        assert.deepEqual(f.items, { 2: ['flex-grow: 1;', 'order: 2;'] });                      // 3 是 grid 屬性、9 超過項目數
        assert.ok(!m.layoutRules({ mode: 'flex' }).container.some(x => x.startsWith('align-content')));
        const g = m.layoutRules({ mode: 'grid', n: 4, cols: '1fr 2fr', rows: 'auto', gap: 4, gji: 'center', items: { 1: { cs: 2, rs: 3 } } });
        assert.deepEqual(g.container, ['display: grid;', 'grid-template-columns: 1fr 2fr;', 'justify-items: center;', 'align-items: stretch;', 'gap: 4px;']);
        assert.deepEqual(g.items, { 1: ['grid-column: span 2;', 'grid-row: span 3;'] });
        assert.equal(m.layoutCss({ mode: 'grid', n: 3, items: { 1: { cs: 2 } } }), '.container {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  justify-items: stretch;\n  align-items: stretch;\n  gap: 8px;\n}\n.item:nth-child(1) {\n  grid-column: span 2;\n}');
        assert.ok(!m.layoutCss({}).includes('.item'));
        assert.deepEqual(m.layoutNorm(JSON.parse(JSON.stringify(L))), L);                       // 冪等（存進 localStorage 再讀回）
        ok('g9 css-gen: layout');
    }

    // ---------- image-resize：圖示包 ----------
    {
        const m = load('utils/image-resize.html', 'ICON_PLAN, MASKABLE_SCALE, iconRect, crc32, zipStore, icoBuild, manifestIcons, headSnippet');
        assert.deepEqual(m.ICON_PLAN.filter(i => !i.maskable).map(i => i.size), [16, 32, 48, 180, 192, 512]); assert.deepEqual(m.ICON_PLAN.filter(i => i.maskable).map(i => i.size), [192, 512]);
        assert.equal(new Set(m.ICON_PLAN.map(i => i.name)).size, m.ICON_PLAN.length);
        const r1 = m.iconRect(200, 100, 100, 'contain'); assert.deepEqual(r1, { dx: 0, dy: 25, dw: 100, dh: 50 });
        const r2 = m.iconRect(200, 100, 100, 'cover'); assert.deepEqual(r2, { dx: -50, dy: 0, dw: 200, dh: 100 });
        const r3 = m.iconRect(100, 100, 512, 'contain', m.MASKABLE_SCALE); assert.ok(Math.abs(r3.dw - 512 * m.MASKABLE_SCALE) < 1e-9 && Math.abs(r3.dx - 512 * (1 - m.MASKABLE_SCALE) / 2) < 1e-9);
        // 最大內容必須落在 maskable 安全圓（直徑 80%）之內：方形對角半長 ≤ 0.4 倍邊長
        assert.ok(Math.hypot(r3.dw / 2, r3.dh / 2) <= 512 * 0.4 + 1e-9);
        assert.equal(m.crc32(new TextEncoder().encode('123456789')), 0xCBF43926); assert.equal(m.crc32(new Uint8Array(0)), 0);
        const files = [{ name: 'a.txt', data: new TextEncoder().encode('hello') }, { name: '中文.bin', data: Uint8Array.from({ length: 1000 }, (_, i) => i * 7 % 256) }, { name: 'empty', data: new Uint8Array(0) }];
        const z = m.zipStore(files), w = zipWalk(z);
        assert.deepEqual(w.map(x => x.name), ['a.txt', '中文.bin', 'empty']); w.forEach((x, i) => { assert.equal(x.method, 0); assert.deepEqual([...x.data], [...files[i].data]); });
        assert.deepEqual(zipWalk(m.zipStore([])), []);
        // ICO
        const p1 = new Uint8Array([1, 2, 3]), p2 = new Uint8Array([9, 8, 7, 6, 5]), ico = Buffer.from(m.icoBuild([{ size: 16, data: p1 }, { size: 256, data: p2 }]));
        assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 2);
        assert.equal(ico[6], 16); assert.equal(ico[7], 16); assert.equal(ico.readUInt16LE(12), 32); assert.equal(ico.readUInt32LE(14), 3); assert.equal(ico.readUInt32LE(18), 38);
        assert.equal(ico[22], 0); assert.equal(ico.readUInt32LE(30), 5); assert.equal(ico.readUInt32LE(34), 41); assert.deepEqual([...ico.subarray(38, 41)], [1, 2, 3]); assert.deepEqual([...ico.subarray(41)], [9, 8, 7, 6, 5]);
        const man = JSON.parse(m.manifestIcons()); assert.deepEqual(man.icons.map(i => i.src + '|' + i.sizes + '|' + (i.purpose || '')), ['/icon-192.png|192x192|', '/icon-512.png|512x512|', '/icon-maskable-192.png|192x192|maskable', '/icon-maskable-512.png|512x512|maskable']);
        assert.ok(m.headSnippet().includes('apple-touch-icon') && m.headSnippet().includes('manifest'));
        ok('g9 image-resize: icon pack / zip / ico');
    }

    // ---------- csv-tool：XLSX ----------
    {
        const m = load('utils/csv-tool.html', 'crc32, zipStore, zipEntries, xlsxWrite, xlsxRead, xlsxIsNum, colName, colIndex, xmlEsc, xmlUnesc, XLSX_MAX_BYTES, XLSX_MAX_ROWS, XLSX_MAX_COLS, XLSX_MAX_UNZIP');
        const inflate = async (d) => new Uint8Array(zlib.inflateRawSync(Buffer.from(d)));
        assert.equal(m.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
        for (const [i, s] of [[0, 'A'], [25, 'Z'], [26, 'AA'], [51, 'AZ'], [52, 'BA'], [701, 'ZZ'], [702, 'AAA']]) { assert.equal(m.colName(i), s); assert.equal(m.colIndex(s), i); }
        assert.equal(m.xmlUnesc('&lt;a&gt; &amp; &quot;&apos; &#65;&#x42; &bad;'), '<a> & "\' AB &bad;'); assert.equal(m.xmlEsc('a<b>&"\u0001\u000b'), 'a&lt;b&gt;&amp;&quot;');
        for (const s of ['0', '12', '-3.5', '100.25']) assert.ok(m.xlsxIsNum(s), s);
        for (const s of ['007', '1e5', '', '1.', '.5', '+1', '1234567890123456', '0x1', '1,000', ' 1']) assert.ok(!m.xlsxIsNum(s), s);

        // 寫出 → 結構：用獨立的 zip 讀取 + zlib 驗證
        const rows = [['姓名', '年資', '備註'], ['小明', '3', 'a<b> & "q"'], ['王, 小華', '5.5', 'line1\nline2'], ['007', '1234567890123456', ''], ['', '', '尾端'], ['emoji 😀', '-0.5', "it's"]];
        const x = m.xlsxWrite(rows), w = zipWalk(x);
        assert.deepEqual(w.map(f => f.name), ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml']);
        const sheet = w[4].data.toString('utf8'); assert.ok(sheet.includes('<c r="B2"><v>3</v></c>') && sheet.includes('<c r="B3"><v>5.5</v></c>') && sheet.includes('<c r="A4" t="inlineStr"><is><t xml:space="preserve">007</t></is></c>'));
        assert.ok(sheet.includes('a&lt;b&gt; &amp; &quot;q&quot;') && !sheet.includes('r="A5"') && !sheet.includes('r="C4"') && sheet.includes('r="C5"'));
        assert.deepEqual(await m.xlsxRead(x, inflate), (() => { const wd = 3; return rows.map(r => Object.assign(new Array(wd).fill(''), r)); })());
        // 把 zip 改成 deflate（method 8）版本再讀：驗證讀取端的解壓路徑與 zlib 相容
        const deflated = (files) => {
            const parts = [], cd = []; let off = 0;
            for (const f of files) {
                const comp = zlib.deflateRawSync(Buffer.from(f.data)), name = Buffer.from(f.name), h = Buffer.alloc(30), c = Buffer.alloc(46), crc = crcRef(f.data);
                h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(name.length, 26);
                c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(f.data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
                parts.push(h, name, comp); cd.push(c, name); off += 30 + name.length + comp.length;
            }
            const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
            return new Uint8Array(Buffer.concat([...parts, cdb, e]));
        };
        const F = (name, s) => ({ name, data: Buffer.from(s) });
        const wbX = '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="2" r:id="rId7"/><sheet name="Other" sheetId="3" r:id="rId8"/></sheets></workbook>';
        const relX = '<Relationships><Relationship Id="rId7" Type="x" Target="worksheets/sheet2.xml"/><Relationship Id="rId8" Target="/xl/worksheets/sheet1.xml" Type="y"/></Relationships>';
        const sstX = '<sst><si><t>Hello</t></si><si><r><t>Rich </t></r><r><rPr/><t xml:space="preserve">text</t></r></si><si><t>A &amp; B</t></si><si><t>x</t><rPh sb="0" eb="1"><t>ignored</t></rPh></si></sst>';
        const shX = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>in</t><t>line</t></is></c></row><row r="3"><c r="B3"><v>42</v></c><c r="C3" t="b"><v>1</v></c><c r="D3" t="b"><v>0</v></c><c r="E3" t="str"><v>f&lt;x&gt;</v></c><c r="F3" t="s"><v>2</v></c><c r="G3" t="s"><v>3</v></c><c r="H3" t="e"><v>#DIV/0!</v></c><c r="I3"/></row><row><c><v>1.5E-3</v></c><c><v>2</v></c></row></sheetData></worksheet>';
        const exp = [['Hello', '', 'Rich text', 'inline', '', '', '', '', ''], ['', '', '', '', '', '', '', '', ''], ['', '42', 'TRUE', 'FALSE', 'f<x>', 'A & B', 'x', '#DIV/0!', ''], ['1.5E-3', '2', '', '', '', '', '', '', '']];
        const hand = deflated([F('[Content_Types].xml', '<Types/>'), F('xl/workbook.xml', wbX), F('xl/_rels/workbook.xml.rels', relX), F('xl/sharedStrings.xml', sstX), F('xl/worksheets/sheet2.xml', shX), F('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1"><v>WRONG</v></c></row></sheetData></worksheet>')]);
        assert.deepEqual(await m.xlsxRead(hand, inflate), exp);
        // 沒有 workbook / rels：退回第一個工作表檔
        assert.deepEqual(await m.xlsxRead(deflated([F('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="2"><c r="B2" t="inlineStr"><is><t>z</t></is></c></row></sheetData></worksheet>')]), inflate), [['', ''], ['', 'z']]);
        assert.deepEqual(await m.xlsxRead(deflated([F('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>')]), inflate), []);
        // 往返：隨機資料（不含純數字以外的歧義）
        for (let t = 0; t < 30; t++) {
            const R = 1 + (Math.random() * 20 | 0), C = 1 + (Math.random() * 8 | 0), pool = ['a', '中文', '1', '-2.5', '007', 'x<y&z', '"q"', ' lead', 'tail ', 'l1\nl2', '', '', '😀', '3.14159', '99999999999999999'];
            const g = Array.from({ length: R }, () => Array.from({ length: C }, () => pool[Math.random() * pool.length | 0]));
            while (g.length && g[g.length - 1].every(c => c === '')) g.pop();
            if (!g.length) continue;
            const back = await m.xlsxRead(m.xlsxWrite(g), inflate), width = Math.max(...back.map(r => r.length));
            const expect = g.map(r => Object.assign(new Array(width).fill(''), r));
            assert.deepEqual(back.map(r => r.slice(0, C)), expect.map(r => r.slice(0, C)));
        }
        // 上限與壞檔
        assert.throws(() => m.xlsxWrite(Array.from({ length: m.XLSX_MAX_ROWS + 1 }, () => ['a'])), /列數太多/);
        assert.throws(() => m.xlsxWrite([Array.from({ length: m.XLSX_MAX_COLS + 1 }, () => 'a')]), /欄數太多/);
        assert.equal(m.xlsxWrite(Array.from({ length: m.XLSX_MAX_ROWS }, () => ['a'])).length > 0, true);
        await assert.rejects(() => m.xlsxRead(new Uint8Array(m.XLSX_MAX_BYTES + 1), inflate), /太大/);
        await assert.rejects(() => m.xlsxRead(new Uint8Array(10), inflate), /ZIP|XLSX/); await assert.rejects(() => m.xlsxRead(new TextEncoder().encode('這不是 zip，只是一段很長的文字。'.repeat(5)), inflate), /ZIP|XLSX/);
        for (let cut = 1; cut < x.length; cut += Math.max(1, x.length / 25 | 0)) await assert.rejects(() => m.xlsxRead(x.subarray(0, cut), inflate), Error);   // 截斷
        const bomb = Buffer.from(deflated([F('xl/worksheets/sheet1.xml', '<worksheet/>')])); bomb.writeUInt32LE(m.XLSX_MAX_UNZIP + 1, 46 - 46 + bomb.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 24);
        await assert.rejects(() => m.xlsxRead(new Uint8Array(bomb), inflate), /太大/);
        const colBomb = deflated([F('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="ZZZ1"><v>1</v></c></row></sheetData></worksheet>')]); await assert.rejects(() => m.xlsxRead(colBomb, inflate), /欄數/);
        const rowBomb = deflated([F('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="9999999"><c r="A9999999"><v>1</v></c></row></sheetData></worksheet>')]); await assert.rejects(() => m.xlsxRead(rowBomb, inflate), /列數/);
        // 加密旗標
        const enc = Buffer.from(deflated([F('xl/worksheets/sheet1.xml', '<worksheet/>')])); enc.writeUInt16LE(1, enc.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 8); await assert.rejects(() => m.xlsxRead(new Uint8Array(enc), inflate), /加密/);
        ok('g9 csv-tool: XLSX read/write + zip');
    }

    // ---------- code-minify：SVG 與 SCSS ----------
    {
        const m = load('utils/code-minify.html', 'svgPath, svgFmt, optimizeSvg, beautifySvg, svgShapes, svgDataUri, splitTop, parseNested, flattenNodes, scssToCss, cssToScss, declBag, run, verify, guessLang, byteLen');
        // 路徑
        assert.equal(m.svgPath('M 10.123456 20.5 L 30 -40.000', 2), 'M10.12 20.5L30-40');
        assert.equal(m.svgPath('M0,0 L.5,.5 L 0.25 0.25', 3), 'M0 0L.5.5L.25.25'); assert.equal(m.svgPath('m1 2 3 4 5 6', 3), 'm1 2 3 4 5 6');
        assert.equal(m.svgPath('M0 0a5 5 0 011.5 .5', 3), 'M0 0a5 5 0 0 1 1.5.5'); assert.equal(m.svgPath('M0 0 A 5,5 0 1,0 10,10z', 3), 'M0 0A5 5 0 1 0 10 10z');
        assert.equal(m.svgPath('M10 10h-5v-5H1V1z', 1), 'M10 10h-5v-5H1V1z'); assert.equal(m.svgPath('M1e-7 2.0005', 3), 'M0 2.001'); assert.equal(m.svgPath('M-0.0001 0', 3), 'M0 0');
        assert.equal(m.svgPath('M 1 2 L', 3), null); assert.equal(m.svgPath('M 1 2 X 3', 3), null); assert.equal(m.svgPath('1 2', 3), null); assert.equal(m.svgPath('', 3), '');
        // 數字精度不改變圖形座標：所有數字相差不超過 0.5 × 10^-p
        const nums = (s) => [...s.matchAll(/-?(?:\d+\.?\d*|\.\d+)/g)].map(x => +x[0]);
        { const d = 'M12.34567 8.76543C1.11111 2.22222 3.33333 4.44444 5.55555 6.66666'; const a = nums(d), b = nums(m.svgPath(d, 2)); assert.equal(a.length, b.length); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= 0.005 + 1e-9)); }
        const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="x" width="24" height="24" viewBox="0 0 24 24" version="1.1" x="0px" y="0" id="svg1" enable-background="new 0 0 24 24">
  <title>Icon</title>
  <metadata><rdf:RDF><cc:Work/></rdf:RDF></metadata>
  <sodipodi:namedview id="nv" inkscape:zoom="1"/>
  <defs></defs>
  <g id="layer1" inkscape:label="L" fill-rule="nonzero">
    <path id="p1" d="M 10.123456 20.5 L 30 -40.000 Z" fill="#ffffff" stroke="#aabbcc" opacity="1" stroke-width="1.00" style=""/>
    <circle id="c" cx="12.000" cy="12.0001" r="5.55555" fill='#000000'/>
    <rect x="0" y="0" width="5" height="5" fill="url(#grad)"/>
  </g>
  <g></g>
  <linearGradient id="grad"><stop offset="0.500000" stop-color="#ff0000"/></linearGradient>
</svg>`;
        const out = m.optimizeSvg(SVG, { precision: 2 });
        assert.ok(!/<\?xml|DOCTYPE|<!--|metadata|sodipodi|inkscape|enable-background|version=|xmlns:xlink|<defs|<g><\/g>/.test(out), out);
        assert.ok(out.includes('<title>Icon</title>') && out.includes('xmlns="http://www.w3.org/2000/svg"') && out.includes('viewBox="0 0 24 24"') && out.includes('width="24"'));
        assert.ok(out.includes('d="M10.12 20.5L30-40Z"') && out.includes('fill="#fff"') && out.includes('stroke="#abc"') && out.includes("fill='#000'"));
        assert.ok(out.includes('cx="12"') && out.includes('cy="12"') && out.includes('r="5.56"') && out.includes('offset=".5"'));
        assert.ok(!out.includes('opacity="1"') && !out.includes('fill-rule') && !out.includes('stroke-width') && !/ id="(svg1|layer1|p1|c)"/.test(out) && out.includes('id="grad"') && !out.includes('style=""'));
        assert.ok(!/<rect[^>]* x="0"/.test(out) && !/<svg[^>]* [xy]="0/.test(out));
        assert.equal(m.svgShapes(out), m.svgShapes(SVG)); assert.equal(m.svgShapes(SVG), 3);
        assert.equal(m.optimizeSvg(out, { precision: 2 }), out);                                    // 冪等
        assert.ok(m.byteLen(out) < m.byteLen(SVG) * 0.7);
        // 繼承屬性：別處有非預設值時，預設值不能刪（否則會繼承到父層）
        assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><g stroke-width="3"><path d="M0 0L1 1" stroke="red" stroke-width="1"/></g></svg>').includes('stroke-width="1"'));
        assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>path{opacity:.5}</style><path d="M0 0L1 1" opacity="1" id="a"/></svg>').includes('opacity="1"') && m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><style>#a{fill:red}</style><path d="M0 0" id="a"/></svg>').includes('id="a"'));
        assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/><path id="a" d="M0 0"/></svg>').includes('xmlns:xlink') );
        assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="5" xml:space="preserve">a  <tspan>b</tspan>\n</text></svg>').includes('xml:space="preserve"'));
        assert.ok(m.optimizeSvg('<!--! license --><svg xmlns="http://www.w3.org/2000/svg"><!-- x --><path d="M0 0"/></svg>').startsWith('<!--! license -->') && !m.optimizeSvg('<!--! license --><svg xmlns="http://www.w3.org/2000/svg"/>', { keep: false }).includes('license'));
        assert.equal(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="bad path" /></svg>'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="bad path"/></svg>');  // 解析不了就不動
        assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><text>He said "hi"</text><a title=\'say "x"\'/></svg>').includes("title='say \"x\"'"));
        assert.equal(m.optimizeSvg(''), ''); assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.23456 1" /></svg>', { precision: 0 }).includes('d="M1 1"')); assert.ok(m.optimizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.23456 1" /></svg>', { precision: 99 }).includes('d="M1.23456 1"'));
        // data URI：解碼後等於原文（含補 xmlns）；不能含 < > # 與雙引號
        for (const s of [out, '<svg viewBox="0 0 1 1"><path d="M0 0h1"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><text>中文 & "q" #1 100%</text></svg>']) {
            const u = m.svgDataUri(s); assert.ok(u.startsWith('data:image/svg+xml,')); assert.ok(!/[<>#"]/.test(u.slice(19)), u);
            const back = decodeURIComponent(u.slice(19)); assert.ok(back.includes('xmlns="http://www.w3.org/2000/svg"')); assert.equal(back.replace(' xmlns="http://www.w3.org/2000/svg"', ''), s.replace(' xmlns="http://www.w3.org/2000/svg"', ''));
        }
        // 美化 / run / verify / guessLang
        assert.equal(m.beautifySvg('<svg a="1"><g><text>hi</text><path d="M0 0"/><!-- c --></g></svg>'), '<svg a="1">\n  <g>\n    <text>hi</text>\n    <path d="M0 0"/>\n    <!-- c -->\n  </g>\n</svg>');
        assert.equal(m.svgShapes(m.beautifySvg(out)), m.svgShapes(out)); assert.equal(m.optimizeSvg(m.beautifySvg(out), { precision: 2 }), out);   // 美化後再優化會回到同一份
        const r = m.run('svg', 'minify', SVG, { precision: 2 }); assert.equal(r.out, out); assert.ok(m.verify('svg', SVG, r.out).ok); assert.ok(!m.verify('svg', SVG, '<svg/>').ok);
        assert.ok(m.run('svg', 'beautify', out).out.includes('\n'));
        assert.equal(m.guessLang(SVG), 'svg'); assert.equal(m.guessLang('<svg width="1"></svg>'), 'svg'); assert.equal(m.guessLang('<div><svg></svg></div>'), 'html'); assert.equal(m.guessLang('<svgx></svgx>'), 'html');
        assert.equal(m.guessLang('.a { &:hover { color: red } }'), 'scss'); assert.equal(m.guessLang('$c: red;\n.a { color: $c }'), 'scss'); assert.equal(m.guessLang('@mixin f { a: b }'), 'scss'); assert.equal(m.guessLang('a { color: red; }'), 'css'); assert.equal(m.guessLang('a && b'), 'js');

        // ---- SCSS ----
        assert.deepEqual(m.splitTop('a, b:not(.c, .d), [x="1,2"], "y,z"'), ['a', 'b:not(.c, .d)', '[x="1,2"]', '"y,z"']);
        const S = '$c: red;\n// 行註解\n.nav { color: red; ul { margin: 0; li { display: inline; &:hover { color: blue } } } &-item { padding: 1px } .dark & { x: y } @media (min-width: 600px) { color: green; a { x: y } } @include foo; }\n@media print { .x, .y { a: b } }\n@keyframes k { from { a: 1 } to { a: 2 } }';
        const flat = m.scssToCss(S);
        assert.equal(flat, `$c: red;

.nav {
  color: red;
  @include foo;
}

.nav ul {
  margin: 0;
}

.nav ul li {
  display: inline;
}

.nav ul li:hover {
  color: blue;
}

.nav-item {
  padding: 1px;
}

.dark .nav {
  x: y;
}

@media (min-width: 600px) {
  .nav {
    color: green;
  }
  .nav a {
    x: y;
  }
}

@media print {
  .x,
  .y {
    a: b;
  }
}

@keyframes k {
  from {
    a: 1;
  }
  to {
    a: 2;
  }
}`);
        assert.equal(m.scssToCss('.a, .b { .c, .d { x: y } &:hover, &.on { z: 1 } }'), '.a .c,\n.a .d,\n.b .c,\n.b .d {\n  x: y;\n}\n\n.a:hover,\n.a.on,\n.b:hover,\n.b.on {\n  z: 1;\n}');
        assert.equal(m.scssToCss('.a { @media (a) { @media (b) { c: d } } }'), '@media (a) {\n  @media (b) {\n    .a {\n      c: d;\n    }\n  }\n}');
        assert.equal(m.scssToCss('.a { width: calc(100% - #{$x}); b { c: url(//x.com/a.png) "//not comment"; } } // end'), '.a {\n  width: calc(100% - #{$x});\n}\n\n.a b {\n  c: url(//x.com/a.png) "//not comment";\n}');
        assert.equal(m.scssToCss('/* a */ .x { y: z } /* b */ .w { v: u }'), '/* a */\n\n.x {\n  y: z;\n}\n\n/* b */\n\n.w {\n  v: u;\n}');
        assert.equal(m.scssToCss(''), ''); assert.equal(m.scssToCss('.a {}'), ''); assert.equal(m.scssToCss('.a { .b { } }'), '');   // 空規則和 Sass 一樣不輸出
        assert.throws(() => m.scssToCss('.a { b: c '), /大括號/); assert.throws(() => m.scssToCss('.a { b: c } }'), /多餘/);
        // 巢狀化
        const CSS = '.a { color: red; }\n.a:hover { color: blue; }\n.a .b { margin: 0; }\n.a .b:hover { margin: 1px; }\n.a > p { x: y; }\n.c { d: e; }\n@media (max-width: 1px) { .a { z: 1; } .a .b { z: 2; } }';
        const nested = m.cssToScss(CSS);
        assert.equal(nested, `.a {
  color: red;
  &:hover {
    color: blue;
  }
  .b {
    margin: 0;
    &:hover {
      margin: 1px;
    }
  }
  > p {
    x: y;
  }
}

.c {
  d: e;
}

@media (max-width: 1px) {
  .a {
    z: 1;
    .b {
      z: 2;
    }
  }
}`);
        assert.equal(m.scssToCss(nested), m.scssToCss(CSS));                                           // 往返
        assert.equal(m.cssToScss('.a { x: 1 }\n.b { y: 2 }'), '.a {\n  x: 1;\n}\n\n.b {\n  y: 2;\n}');   // 沒得收就不動
        assert.equal(m.cssToScss('.a { x: 1 }\n.a .b { y: 2 }\n.a { z: 3 }\n.a .c { w: 4 }'), '.a {\n  x: 1;\n  .b {\n    y: 2;\n  }\n}\n\n.a {\n  z: 3;\n  .c {\n    w: 4;\n  }\n}');   // 順序不變：子規則之後的同名規則另起一組
        assert.equal(m.scssToCss(m.cssToScss('.a { x: 1 }\n.a .b { y: 2 }\n.a { z: 3 }\n.a .c { w: 4 }')), m.scssToCss('.a { x: 1 }\n.a .b { y: 2 }\n.a { z: 3 }\n.a .c { w: 4 }'));
        assert.equal(m.cssToScss('a, b { x: 1 }\na:hover { y: 2 }\n:root { --c: red }\n::selection { z: 1 }'), 'a,\nb {\n  x: 1;\n}\n\na:hover {\n  y: 2;\n}\n\n:root {\n  --c: red;\n}\n\n::selection {\n  z: 1;\n}');
        assert.equal(m.cssToScss('.x .y .z { a: 1 }\n.x .y .w { b: 2 }'), '.x {\n  .y {\n    .z {\n      a: 1;\n    }\n    .w {\n      b: 2;\n    }\n  }\n}');
        // 驗證：宣告不增不減
        for (const [mode, src] of [['flatten', S], ['nest', CSS]]) { const o = m.run('scss', mode, src).out; assert.ok(!m.run('scss', mode, src).error); assert.ok(m.verify('scss', src, o).ok, mode); }
        assert.ok(!m.verify('scss', CSS, '.a { color: red; }').ok);
        assert.ok(m.run('scss', 'flatten', '.a { b: c ').error); assert.equal(m.run('scss', 'nest', '').out, '');
        ok('g9 code-minify: SVG optimize + CSS/SCSS');
    }
})().catch(e => { console.error(e); process.exit(1); });
