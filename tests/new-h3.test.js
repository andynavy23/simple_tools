// h3 批次：ics-gen / todo 匯出 / reading-list 摘錄 / mood-journal 年度回顧 / markdown-preview 匯出與目錄 的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const { day } = Util;

// ---------- ics-gen ----------
{
    const I = load('utils/ics-gen.html', 'fold, icsEsc, toUtc, buildCalendar, validateEvent, cleanOpts, trigger, isTz');
    // 簡易解析器（往返驗證）：unfold → 拆行 → 反跳脫
    const parse = (ics) => {
        assert.ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), '必須 CRLF');
        const lines = ics.slice(0, -2).split('\r\n').reduce((a, l) => { if (l.startsWith(' ')) a[a.length - 1] += l.slice(1); else a.push(l); return a; }, []);
        const unesc = (s) => s.replace(/\\([nN\\;,])/g, (_, c) => c === 'n' || c === 'N' ? '\n' : c);
        return { lines, unesc };
    };
    const bytes = (s) => Buffer.byteLength(s, 'utf8');
    // 折行：每行 ≤ 75 octets，不拆 UTF-8 多位元組字元（含 4 位元組表情），還原後相同
    for (const text of ['a'.repeat(200), '中文標題'.repeat(40), '😀'.repeat(50), 'x' + '中'.repeat(30) + '😀' + 'y'.repeat(70)]) {
        const f = I.fold('SUMMARY:' + text);
        for (const l of f.split('\r\n')) { assert.ok(bytes(l) <= 75, '行太長 ' + bytes(l)); assert.ok(!l.includes('�')); }
        assert.strictEqual(f.split('\r\n').map((l, i) => i ? l.slice(1) : l).join(''), 'SUMMARY:' + text);
        assert.ok(Buffer.from(f, 'utf8').toString('utf8') === f);
    }
    assert.strictEqual(I.fold('short'), 'short');
    assert.strictEqual(I.fold('a'.repeat(75)).includes('\r\n'), false);
    assert.strictEqual(I.fold('a'.repeat(76)).split('\r\n').length, 2);
    // 跳脫
    assert.strictEqual(I.icsEsc('a,b;c\\d\ne\r\nf\rg'), 'a\\,b\\;c\\\\d\\ne\\nf\\ng');
    assert.strictEqual(I.icsEsc('x\x00\x07y'), 'xy');
    // UTC 轉換（Asia/Taipei = +8，America/New_York 冬 -5 夏 -4）
    assert.strictEqual(I.toUtc('2026-03-01', '09:30', 'Asia/Taipei'), '20260301T013000Z');
    assert.strictEqual(I.toUtc('2026-01-15', '09:00', 'America/New_York'), '20260115T140000Z');
    assert.strictEqual(I.toUtc('2026-07-15', '09:00', 'America/New_York'), '20260715T130000Z');
    assert.strictEqual(I.toUtc('2026-03-01', '23:59:59', 'Asia/Taipei'), '20260301T155959Z');
    assert.ok(I.isTz('Asia/Taipei') && !I.isTz('Not/AZone') && !I.isTz('a b') && !I.isTz(5));

    const now = new Date('2026-05-01T00:00:00Z'), uid = (i) => `u${i}@t`;
    const base = { title: '週會', loc: '', desc: '', url: '', allDay: false, sd: '2026-03-02', st: '10:00', ed: '2026-03-02', et: '11:00', alarms: [], rep: null };
    const tzid = { mode: 'tzid', tz: 'Asia/Taipei' };
    let { lines } = parse(I.buildCalendar([base], tzid, now, uid));
    assert.deepStrictEqual(lines, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//simple_tools//ICS Generator//ZH-TW', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:u0@t', 'DTSTAMP:20260501T000000Z',
        'DTSTART;TZID=Asia/Taipei:20260302T100000', 'DTEND;TZID=Asia/Taipei:20260302T110000', 'SUMMARY:週會', 'END:VEVENT', 'END:VCALENDAR']);
    // UTC / 浮動
    lines = parse(I.buildCalendar([base], { mode: 'utc', tz: 'Asia/Taipei' }, now, uid)).lines;
    assert.ok(lines.includes('DTSTART:20260302T020000Z') && lines.includes('DTEND:20260302T030000Z'));
    lines = parse(I.buildCalendar([base], { mode: 'float', tz: 'x' }, now, uid)).lines;
    assert.ok(lines.includes('DTSTART:20260302T100000'));
    // 全天：DTEND 為隔日（含跨月、跨年、閏日）
    const ad = (sd, ed) => parse(I.buildCalendar([{ ...base, allDay: true, sd, ed }], tzid, now, uid)).lines.filter(l => /^DT(START|END)/.test(l));
    assert.deepStrictEqual(ad('2026-03-02', '2026-03-02'), ['DTSTART;VALUE=DATE:20260302', 'DTEND;VALUE=DATE:20260303']);
    assert.deepStrictEqual(ad('2026-12-31', '2026-12-31'), ['DTSTART;VALUE=DATE:20261231', 'DTEND;VALUE=DATE:20270101']);
    assert.deepStrictEqual(ad('2028-02-28', '2028-02-29'), ['DTSTART;VALUE=DATE:20280228', 'DTEND;VALUE=DATE:20280301']);
    // 文字欄位往返（含特殊字元、長中文說明、URL 不跳脫）
    const desc = '第一行,有逗號;分號\\反斜線\n第二行😀' + '很長的說明'.repeat(30);
    const p = parse(I.buildCalendar([{ ...base, title: 'A,B;C', loc: '台北, 101', desc, url: 'https://x.com/a?b=1,2;3' }], tzid, now, uid));
    const get = (k) => p.lines.find(l => l.startsWith(k + ':')).slice(k.length + 1);
    assert.strictEqual(p.unesc(get('SUMMARY')), 'A,B;C');
    assert.strictEqual(p.unesc(get('LOCATION')), '台北, 101');
    assert.strictEqual(p.unesc(get('DESCRIPTION')), desc);
    assert.strictEqual(get('URL'), 'https://x.com/a?b=1,2;3');
    // RRULE 組合
    const rr = (rep, extra = {}, o = tzid) => parse(I.buildCalendar([{ ...base, rep, ...extra }], o, now, uid)).lines.find(l => l.startsWith('RRULE'));
    const R = (freq, o = {}) => ({ freq, interval: 1, byday: [], end: 'never', count: 10, until: '2026-12-31', ...o });
    assert.strictEqual(rr(null), undefined);
    assert.strictEqual(rr(R('DAILY')), 'RRULE:FREQ=DAILY');
    assert.strictEqual(rr(R('DAILY', { interval: 3, end: 'count', count: 5 })), 'RRULE:FREQ=DAILY;INTERVAL=3;COUNT=5');
    assert.strictEqual(rr(R('WEEKLY', { byday: ['WE', 'MO'], end: 'count', count: 12 })), 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12');   // 星期依週一起排序
    assert.strictEqual(rr(R('WEEKLY')), 'RRULE:FREQ=WEEKLY;BYDAY=MO');                       // 2026-03-02 是週一
    assert.strictEqual(rr(R('WEEKLY'), { sd: '2026-03-08', ed: '2026-03-08' }), 'RRULE:FREQ=WEEKLY;BYDAY=SU');
    assert.strictEqual(rr(R('MONTHLY')), 'RRULE:FREQ=MONTHLY');
    assert.strictEqual(rr(R('YEARLY', { end: 'until' })), 'RRULE:FREQ=YEARLY;UNTIL=20261231T155959Z');   // 台北當日 23:59:59 → UTC
    assert.strictEqual(rr(R('YEARLY', { end: 'until' }), {}, { mode: 'float' }), 'RRULE:FREQ=YEARLY;UNTIL=20261231T235959');
    assert.strictEqual(rr(R('WEEKLY', { end: 'until', byday: ['FR'] }), { allDay: true }), 'RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231');   // 全天用 DATE
    // 提醒
    assert.deepStrictEqual([0, 15, 60, 120, 1440, 2880, 90].map(I.trigger), ['PT0S', '-PT15M', '-PT1H', '-PT2H', '-P1D', '-P2D', '-PT90M']);
    lines = parse(I.buildCalendar([{ ...base, alarms: [15, 1440] }], tzid, now, uid)).lines;
    assert.strictEqual(lines.filter(l => l === 'BEGIN:VALARM').length, 2);
    assert.ok(lines.includes('TRIGGER:-PT15M') && lines.includes('TRIGGER:-P1D') && lines.includes('ACTION:DISPLAY') && lines.filter(l => l === 'DESCRIPTION:週會').length === 2);
    // 多個活動、UID 不重複、BEGIN/END 成對
    lines = parse(I.buildCalendar([base, { ...base, title: 'b' }, { ...base, title: 'c' }], tzid, now, uid)).lines;
    assert.deepStrictEqual(lines.filter(l => l.startsWith('UID:')), ['UID:u0@t', 'UID:u1@t', 'UID:u2@t']);
    assert.strictEqual(lines.filter(l => l === 'BEGIN:VEVENT').length, 3);
    // 若本機有 python icalendar，用它再驗一次
    try {
        const cp = require('child_process'), ics = I.buildCalendar([{ ...base, title: '中,文;標題', desc, alarms: [10], rep: R('WEEKLY', { byday: ['MO'], end: 'count' }) }, { ...base, allDay: true }], tzid, now, uid);
        const r = cp.spawnSync('python', ['-I', '-c', 'import sys,icalendar\nc=icalendar.Calendar.from_ical(sys.stdin.buffer.read())\nprint([str(e.get("SUMMARY")) for e in c.walk("VEVENT")])'], { input: ics, encoding: 'utf8' });
        if (r.status === 0) assert.ok(r.stdout.includes('中,文;標題'));
    } catch { /* 沒有 python：略過 */ }
    // 驗證
    const v = (o) => I.validateEvent({ ...base, ...o });
    assert.strictEqual(v({}), '');
    assert.ok(v({ title: '  ' }));
    assert.ok(v({ ed: '2026-03-01' }) && v({ et: '09:00' }));
    assert.strictEqual(v({ allDay: true, st: '', et: '' }), '');
    assert.ok(v({ sd: '2026-02-30' }));
    assert.ok(v({ url: 'javascript' }) && v({ url: 'ht tp://x' }) && v({ url: 'https://a.com' }) === '');
    assert.ok(v({ rep: R('DAILY', { interval: 0 }) }) && v({ rep: R('DAILY', { end: 'count', count: 1000 }) }) && v({ rep: R('DAILY', { end: 'until', until: '2026-01-01' }) }) && v({ rep: R('HOURLY') }));
    assert.ok(v({ alarms: [1, 2, 3, 4, 5, 6] }));
    // 選項驗證容錯
    assert.deepStrictEqual(I.cleanOpts(null, 'UTC'), { mode: 'tzid', tz: 'UTC', alarms: [], allDay: false });
    assert.deepStrictEqual(I.cleanOpts({ mode: 'x', tz: 'bad zone', alarms: [5, 5, -1, 'a', 1.5, 1, 2, 3, 4, 6, 7], allDay: 1 }, 'Asia/Taipei'), { mode: 'tzid', tz: 'Asia/Taipei', alarms: [5, 1, 2, 3, 4], allDay: false });
    assert.deepStrictEqual(I.cleanOpts([1], 'UTC').alarms, []);
    ok('h3 ics-gen');
}

// ---------- reading-list 摘錄 ----------
{
    const B = load('fun/reading-list.html', 'cleanBook, cleanBooks, addQuote, delQuote, filterBooks, exportMd, MAX_QUOTES');
    // 舊資料沒有 quotes → 空陣列；壞摘錄略過、截斷、重複 id 修正
    assert.deepStrictEqual(B.cleanBook({ title: 'A' }).quotes, []);
    assert.deepStrictEqual(B.cleanBook({ title: 'A', quotes: 'x' }).quotes, []);
    let q = B.cleanBook({ title: 'A', quotes: [null, 5, { text: '' }, { text: '  ok  ', page: '12.6', note: 7, id: 'q1' }, { text: 'dup', id: 'q1', page: -3 }, { text: 'x'.repeat(3000), page: 1e9 }] }).quotes;
    assert.strictEqual(q.length, 3);
    assert.deepStrictEqual(q[0], { id: 'q1', page: 13, text: 'ok', note: '' });
    assert.notStrictEqual(q[1].id, 'q1'); assert.strictEqual(q[1].page, 0);
    assert.strictEqual(q[2].text.length, 2000); assert.strictEqual(q[2].page, 99999);
    assert.strictEqual(B.cleanBook({ title: 'A', quotes: Array.from({ length: 300 }, (_, i) => ({ text: 't' + i })) }).quotes.length, 200);
    // 新增 / 刪除
    let books = B.cleanBooks([{ id: 'b1', title: '一' }, { id: 'b2', title: '二' }]);
    let r = B.addQuote(books, 'b1', { page: '5', text: ' 好句 ', note: '備' });
    assert.strictEqual(r.err, ''); books = r.books;
    assert.strictEqual(books[0].quotes.length, 1); assert.strictEqual(books[0].quotes[0].page, 5); assert.strictEqual(books[1].quotes.length, 0);
    assert.ok(B.addQuote(books, 'b1', { text: '  ' }).err && B.addQuote(books, 'zz', { text: 'a' }).err);
    assert.ok(B.addQuote(books, 'b1', { text: 'x'.repeat(2001) }).err && B.addQuote(books, 'b1', { text: 'a', note: 'x'.repeat(2001) }).err);
    assert.ok(B.addQuote(books, 'b1', { text: 'x'.repeat(2000) }).err === '');
    // 上限：200 筆拒絕
    let full = books; for (let i = 0; i < 199; i++) full = B.addQuote(full, 'b1', { text: 'q' + i }).books;
    assert.strictEqual(full[0].quotes.length, 200);
    assert.ok(B.addQuote(full, 'b1', { text: 'more' }).err.includes('200') && B.addQuote(full, 'b1', { text: 'more' }).books === full);
    // 整體大小上限：塞到接近 2MB 後拒絕
    let big = B.cleanBooks(Array.from({ length: 12 }, (_, i) => ({ id: 'k' + i, title: 'k' + i })));
    let hit = '';
    for (let i = 0; i < 12 && !hit; i++) for (let j = 0; j < 200 && !hit; j++) { const x = B.addQuote(big, 'k' + i, { text: 'z'.repeat(2000), note: 'n'.repeat(2000) }); if (x.err) hit = x.err; else big = x.books; }
    assert.ok(hit.includes('太大'));
    // 單筆刪除用 id；刪書連帶（摘錄在書內）
    const qid = books[0].quotes[0].id;
    assert.strictEqual(B.delQuote(books, 'b1', qid)[0].quotes.length, 0);
    assert.strictEqual(B.delQuote(books, 'b2', qid)[0].quotes.length, 1);
    assert.strictEqual(books.filter(b => b.id !== 'b1').some(b => b.quotes.length), false);
    // 搜尋含摘錄與備註；匯出含摘錄
    assert.strictEqual(B.filterBooks(books, 'all', '好句').length, 1);
    assert.strictEqual(B.filterBooks(books, 'all', '備').length, 1);
    assert.strictEqual(B.filterBooks(books, 'all', '不存在').length, 0);
    const md = B.exportMd(B.addQuote(books, 'b1', { text: '第一行\n第二行', page: 0 }).books);
    assert.ok(md.includes('  - p.5\n    > 好句\n    備註：備') && md.includes('  - 摘錄\n    > 第一行\n    > 第二行'));
    ok('h3 reading-list quotes');
}

// ---------- mood-journal 年度回顧 ----------
{
    const M = load('fun/mood-journal.html', 'cleanEntries, yearReview, yearsOf');
    const list = M.cleanEntries([
        { date: '2025-12-31', mood: 5, tags: ['舊'], text: '' }, { date: '2026-01-01', mood: 4, tags: ['運動', '工作'], text: '' }, { date: '2026-01-02', mood: 2, tags: ['工作'], text: '' },
        { date: '2026-03-05', mood: 4, tags: ['運動'], text: '' }, { date: '2026-03-06', mood: 5, tags: [], text: '' }, { date: 'bad', mood: 3 }, null,
    ]);
    const r = M.yearReview(list, 2026);
    assert.strictEqual(r.n, 4); assert.strictEqual(r.avg, 3.75);
    assert.deepStrictEqual(r.dist, [0, 1, 0, 2, 1]);
    assert.deepStrictEqual(r.tags, [{ tag: '工作', n: 2 }, { tag: '運動', n: 2 }]);              // 次數相同依字串排序
    assert.deepStrictEqual(r.months.map(m => m.n), [2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.strictEqual(r.months[0].avg, 3); assert.strictEqual(r.months[1].avg, null);
    assert.strictEqual(M.yearReview(list, 2025).n, 1); assert.strictEqual(M.yearReview([], 2026).avg, null);
    assert.strictEqual(M.yearReview(list, 2030).tags.length, 0);
    const many = M.cleanEntries(Array.from({ length: 30 }, (_, i) => ({ date: `2026-02-${String(i % 28 + 1).padStart(2, '0')}`, mood: 3, tags: ['t' + i % 15] })));
    assert.strictEqual(M.yearReview(many, 2026).tags.length, 10);                                  // 最多 10 個
    assert.deepStrictEqual(M.yearsOf(list, '2027-01-01'), ['2027', '2026', '2025']);
    assert.deepStrictEqual(M.yearsOf([], '2026-05-05'), ['2026']);
    ok('h3 mood year review');
}

// ---------- markdown-preview 目錄與獨立 HTML ----------
{
    const P = load('utils/markdown-preview.html', 'mdToHtml, slugBase, headingsOf, tocMd, standaloneHtml');
    assert.strictEqual(P.mdToHtml('# 標題'), '<h1>標題</h1>');                         // 沒給 used 就不加 id（相容舊行為）
    assert.strictEqual(P.mdToHtml('# 標題', new Set()), '<h1 id="標題">標題</h1>');
    assert.strictEqual(P.slugBase('Hello, World!'), 'hello-world');
    assert.strictEqual(P.slugBase('第 1 章：開始 & 結束'), '第-1-章開始-結束');
    assert.strictEqual(P.slugBase('**粗** [連結](http://x) `code`'), '粗-連結-code');
    assert.strictEqual(P.slugBase('！！！'), 'section');
    assert.strictEqual(P.slugBase('a_b-c'), 'a_b-c');
    const doc = ['# 簡介', '', '## 安裝', '', '```', '# 不是標題', '```', '', '## 安裝', '', '### 細節 <b>x</b>', '', '## 安裝', '', '#### 深', '', '> # 引用內的標題', '', '- # 清單內不算', '', '###### 最深'].join('\n');
    const hs = P.headingsOf(doc);
    assert.deepStrictEqual(hs.map(h => h.id), ['簡介', '安裝', '安裝-1', '細節-bxb', '安裝-2', '深', '最深']);
    assert.deepStrictEqual(hs.map(h => h.level), [1, 2, 2, 3, 2, 4, 6]);
    // 錨點與渲染出來的 id 一致
    const html = P.mdToHtml(doc, new Set());
    for (const h of hs) assert.ok(html.includes(`<h${h.level} id="${h.id}">`), h.id);
    assert.ok(!html.includes('id="引用內的標題"'));
    assert.strictEqual(P.tocMd(doc, 3), ['- [簡介](#簡介)', '  - [安裝](#安裝)', '  - [安裝](#安裝-1)', '    - [細節 <b>x</b>](#細節-bxb)', '  - [安裝](#安裝-2)'].join('\n'));
    assert.strictEqual(P.tocMd('### a\n#### b\n## c', 6), ['- [a](#a)', '  - [b](#b)', '- [c](#c)'].join('\n'));       // 跳層只縮排一層
    assert.strictEqual(P.tocMd('沒有標題'), '');
    assert.strictEqual(P.tocMd('# ！！！\n# ！！！', 3), '- [！！！](#section)\n- [！！！](#section-1)');
    // 目錄連結經過本頁的渲染後可用
    assert.ok(P.mdToHtml(P.tocMd(doc, 2)).includes('<a href="#安裝-1" target="_blank"'));
    // 獨立 HTML：結構、標題、CSP、安全
    const out = P.standaloneHtml('# 我的 <文件>\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) [目錄](#我的-文件) ![i](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
    assert.ok(out.startsWith('<!DOCTYPE html>') && out.includes('<meta charset="UTF-8">') && out.includes('<title>我的 &lt;文件&gt;</title>') && out.includes('<style>') && out.includes('Content-Security-Policy') && out.includes("default-src 'none'"));
    assert.ok(out.includes('<a href="#我的-文件">目錄</a>') && out.includes('<h1 id="我的-文件">'));
    const body = out.slice(out.indexOf('<article>'));
    const tags = body.match(/<[^>]+>/g);
    const allowed = /^<\/?(article|body|html|p|h[1-6]|strong|em|del|code|pre|a|img|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|hr|br)(\s[^>]*)?>$/;
    for (const t of tags) { assert.ok(allowed.test(t), '非白名單標籤 ' + t); assert.ok(!/\son[a-z]+\s*=/i.test(t.replace(/"[^"]*"/g, '""'))); assert.ok(!/(href|src)="\s*(javascript|data|vbscript):/i.test(t)); }
    assert.ok(body.includes('&lt;script&gt;') && body.includes('<table>'));
    assert.strictEqual(P.standaloneHtml('只有段落').includes('<title>Markdown 文件</title>'), true);
    assert.ok(P.standaloneHtml('x').endsWith('</html>\n'));
    ok('h3 markdown toc / standalone');
}

// ---------- 其他項目的測試段落依序加在下方 ----------

// ---------- todo 匯出 ----------
{
    const T = load('fun/todo.html', 'todoMd, todoIcs, icsFold');
    const items = [
        { id: 'a1', t: '繳電費, 水費;', due: '2026-03-10', done: false },
        { id: 'b2', t: '買菜', due: '', done: false },
        { id: 'c3', t: '已完成的', due: '2026-03-01', done: true },
        { id: 'd4', t: '😀'.repeat(60), due: '2026-12-31', done: false },
    ];
    const md = T.todoMd(items, '2026-03-05', day.between);
    assert.ok(md.startsWith('# 待辦清單\n') && md.includes('## 之後') && md.includes('- [ ] 繳電費, 水費;（2026-03-10）') && md.includes('- [ ] 買菜\n') && md.includes('- [x] 已完成的（2026-03-01）'));
    assert.ok(md.indexOf('## 之後') < md.indexOf('## 沒有日期') && md.indexOf('## 沒有日期') < md.indexOf('## 已完成'));
    const ics = T.todoIcs(items, new Date('2026-05-01T00:00:00Z'));
    assert.ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics));
    for (const l of ics.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75);
    const un = ics.replace(/\r\n /g, '');
    assert.strictEqual((un.match(/BEGIN:VEVENT/g) || []).length, 2);          // 只有「有到期日且未完成」
    assert.ok(un.includes('SUMMARY:繳電費\\, 水費\\;') && un.includes('UID:a1@simple-tools-todo') && !un.includes('買菜') && !un.includes('已完成的'));
    assert.ok(un.includes('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101'));     // 全天，結束為隔日
    assert.ok(un.indexOf('20260310') < un.indexOf('20261231'));
    assert.ok(un.includes('😀'.repeat(60)));
    ok('h3 todo export');
}
