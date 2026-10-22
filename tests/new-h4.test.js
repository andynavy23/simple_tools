// h4 批次：text-tools（社群字數 / Hashtag / 名單比對 / 資料脫敏）與 writing-desk（寫作工作台）的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- text-tools ----------
{
    const T = load('utils/text-tools.html', 'SOCIAL, socialMeasure, extractHashtags, compareLists, maskData');
    const { socialMeasure: sm, extractHashtags: ht, compareLists: cl, maskData: md } = T;

    // 社群字數
    assert.deepStrictEqual(['threads', 'x', 'ig', 'fb', 'line'].map(k => T.SOCIAL[k].max), [500, 280, 2200, 63206, 5000]);
    assert.strictEqual(sm('你好abc', 'threads').used, 5);
    assert.strictEqual(sm('你好abc', 'x').used, 7);                        // 中文 2 + 英文 1
    assert.strictEqual(sm('hi https://example.com/very/long/path?x=1', 'x').used, 3 + 23);
    assert.strictEqual(sm('hi https://example.com/very/long/path?x=1', 'threads').used, 'hi https://example.com/very/long/path?x=1'.length);
    assert.strictEqual(sm('😀', 'x').used, 2);
    assert.strictEqual(sm('😀', 'threads').used, 1);                       // 碼位，不是 UTF-16 長度
    let r = sm('a'.repeat(300), 'x'); assert.strictEqual(r.over, 20); assert.strictEqual(r.keep.length, 280); assert.strictEqual(r.rest.length, 20);
    r = sm('中'.repeat(150), 'x'); assert.strictEqual(r.keep.length, 140); assert.strictEqual(r.over, 20);   // 140 個中文剛好 280
    r = sm('中'.repeat(140), 'x'); assert.strictEqual(r.over, 0); assert.strictEqual(r.rest, '');
    r = sm('😀'.repeat(501), 'threads'); assert.strictEqual(Array.from(r.keep).length, 500); assert.strictEqual(r.over, 1);
    assert.strictEqual(sm('', 'ig').used, 0);
    assert.strictEqual(sm('#a #b #c', 'ig').tags, 3);
    assert.throws(() => sm('x', 'nope'));
    // 網址 23 的邊界：網址放在最後，超過就整段被截掉
    r = sm('a'.repeat(260) + ' https://example.com', 'x'); assert.strictEqual(r.keep, 'a'.repeat(260) + ' '); assert.ok(r.over > 0);

    // Hashtag
    assert.deepStrictEqual(ht('今天 #旅行 好玩 #Travel #travel #旅行 #123 C#語言 a#b').map(x => x.tag + x.count), ['旅行2', 'Travel2']);
    assert.deepStrictEqual(ht('#b #a #b #c #c #c', 'alpha').map(x => x.tag), ['a', 'b', 'c']);
    assert.deepStrictEqual(ht('#b #a #b #c #c #c', 'count').map(x => x.tag), ['c', 'b', 'a']);
    assert.deepStrictEqual(ht('#b #a #b #c #c #c', 'first').map(x => x.tag), ['b', 'a', 'c']);
    assert.deepStrictEqual(ht('＃全形 #a_b-c'), [{ tag: '全形', count: 1 }, { tag: 'a_b', count: 1 }]);
    assert.deepStrictEqual(ht(''), []);
    assert.deepStrictEqual(ht('no tags here'), []);
    assert.deepStrictEqual(ht('http://x.com/#top'), []);            // 網址裡的 # 錨點不算
}

// ---------- text-tools：名單比對 / 資料脫敏 ----------
{
    const { compareLists: cl, maskData: md } = load('utils/text-tools.html', 'compareLists, maskData');
    let r = cl('a\nb\nc\nb', 'B\nc\nd');
    assert.deepStrictEqual([r.inter, r.onlyA, r.onlyB, r.union], [['c'], ['a', 'b'], ['B', 'd'], ['a', 'b', 'c', 'B', 'd']]);
    assert.deepStrictEqual(r.dupA, ['b ×2']); assert.deepStrictEqual(r.dupB, []);
    r = cl('a\nb\nc\nb', 'B\nc\nd', { ci: true });
    assert.deepStrictEqual([r.inter, r.onlyA, r.onlyB, r.union], [['b', 'c'], ['a'], ['d'], ['a', 'b', 'c', 'd']]);
    r = cl('王 小明\n李華\n', '王小明\n 李華 ', { ws: 'all' }); assert.deepStrictEqual(r.inter, ['王 小明', '李華']);
    r = cl('  a  b \nc', 'a b\nc ', { ws: true }); assert.deepStrictEqual(r.inter, ['a  b', 'c']);   // 去頭尾，中間空白視為一個
    r = cl('x', 'x', {}); assert.deepStrictEqual(r.inter, ['x']);
    r = cl(' x', 'x'); assert.deepStrictEqual(r.inter, []);          // 沒開忽略空白就嚴格比
    r = cl('', ''); assert.deepStrictEqual([r.inter, r.union, r.countA], [[], [], 0]);
    r = cl('a\r\nb', 'b\r\nc'); assert.deepStrictEqual(r.inter, ['b']);
    r = cl('\n\n a\n', 'a', { ws: true }); assert.strictEqual(r.countA, 1);   // 空行略過

    const all = { phone: 1, email: 1, id: 1, addr: 1, name: 1 };
    const m = (t, rules = all) => md(t, rules).text;
    assert.strictEqual(m('0912-345-678'), '0912-***-678');
    assert.strictEqual(m('0912345678'), '0912***678');
    assert.strictEqual(m('+886 912 345 678'), '+886 912 *** 678');
    assert.strictEqual(m('02-2345-6789'), '02-****-**89');
    assert.strictEqual(m('(02)23456789'), '(02)******89');
    assert.strictEqual(m('訂單 20240101123 不是電話'), '訂單 20240101123 不是電話');
    assert.strictEqual(m('mail: andy.fu@example.com.tw ok'), 'mail: a******@example.com.tw ok');
    assert.strictEqual(m('a@b.co'), 'a*@b.co');
    assert.strictEqual(m('A123456789'), 'A12*****89');
    assert.strictEqual(m('身分證 f223456789。'), '身分證 f22*****89。');
    assert.strictEqual(m('A323456789'), 'A323456789');                 // 第二碼不是 1/2/8/9
    assert.strictEqual(m('台北市信義區松仁路100號5樓'), '台北市信義區***');
    assert.strictEqual(m('地址：新北市板橋區文化路一段188巷3弄26號之1，請送達'), '地址：新北市板橋區***，請送達');
    assert.strictEqual(m('住在高雄市前鎮區中山二路5號'), '住在高雄市前鎮區***');
    assert.strictEqual(m('我在台北市工作'), '我在台北市工作');
    assert.strictEqual(m('姓名：王小明'), '姓名：王○明');
    assert.strictEqual(m('聯絡人 陳大'), '聯絡人 陳○');
    assert.strictEqual(m('收件人：張三豐'), '收件人：張○豐');
    assert.strictEqual(m('請找李小華小姐'), '請找李○華小姐');
    assert.strictEqual(m('王小明\n今天天氣很好\n林志玲'), '王○明\n今天天氣很好\n林○玲');
    assert.strictEqual(m('他說李先生來了'), '他說李先生來了');
    // 規則可單獨勾選
    assert.strictEqual(m('0912345678 a@b.com', { email: 1 }), '0912345678 a*@b.com');
    assert.strictEqual(m('0912345678 a@b.com', {}), '0912345678 a@b.com');
    // 計數與前後對照
    const d = md('a@b.com, c@d.com, 0912345678', all);
    assert.deepStrictEqual(d.counts, { email: 2, phone: 1 });
    assert.deepStrictEqual(d.changes[2], { rule: 'phone', before: '0912345678', after: '0912***678' });
    // 已經遮蔽過的再跑一次不變（冪等）
    assert.strictEqual(m(d.text), d.text);
    assert.deepStrictEqual(md('', all), { text: '', counts: {}, changes: [] });
    ok('h4 text-tools');
}

// ---------- writing-desk ----------
{
    const W = load('fun/writing-desk.html', 'MAX_DRAFT, MAX_NOTES, MAX_BODY, NOTE_TYPES, PROMPTS, CHAR_FIELDS, QUOTES, QUOTE_CATS, FORMULAS, countText, normDraft, normOpts, pickPrompt, genCharacter, pickQuote, quoteOfDay, quoteText, genSlogans, parseTags, normNote, normNotes, addNote, removeNote, filterNotes, parseScript, scriptStats, scriptPlain');
    const S = require('../shared/js/util.js').seeded;

    // 字數：中英混合
    assert.deepStrictEqual(W.countText("你好 world, it's 3.5 ok"), { cjk: 2, words: 5, total: 7, chars: 17 });
    assert.strictEqual(W.countText('').total, 0);
    assert.strictEqual(W.countText('今天天氣很好。').total, 6);
    assert.strictEqual(W.countText('  \n\t ').chars, 0);

    // 草稿 / 設定驗證
    assert.deepStrictEqual(W.normDraft(null), { text: '', script: '', at: 0 });
    assert.deepStrictEqual(W.normDraft('舊版純字串'), { text: '舊版純字串', script: '', at: 0 });
    assert.deepStrictEqual(W.normDraft({ text: 5, script: [], at: 'x' }), { text: '', script: '', at: 0 });
    assert.strictEqual(W.normDraft({ text: 'a'.repeat(W.MAX_DRAFT + 10) }).text.length, W.MAX_DRAFT);
    assert.strictEqual(W.normDraft([1, 2]).text, '');
    assert.deepStrictEqual(W.normOpts(null), { noBack: false, goal: 500, mins: 0, tab: 'write' });
    assert.deepStrictEqual(W.normOpts({ noBack: 'yes', goal: -5, mins: 99999, tab: 'zzz' }), { noBack: false, goal: 0, mins: 600, tab: 'write' });
    assert.deepStrictEqual(W.normOpts({ noBack: true, goal: '1200', mins: 25.4, tab: 'script' }), { noBack: true, goal: 1200, mins: 25, tab: 'script' });
    assert.strictEqual(W.normOpts({ goal: 'abc' }).goal, 500);

    // 題目：種子可重現，分類正確
    for (const c of Object.keys(W.PROMPTS)) assert.ok(W.PROMPTS[c].length >= 8, c);
    assert.deepStrictEqual(W.pickPrompt('', S('x')), W.pickPrompt('', S('x')));
    assert.strictEqual(W.pickPrompt('衝突', S('x')).cat, '衝突');
    assert.ok(W.PROMPTS['衝突'].includes(W.pickPrompt('衝突').text));
    assert.ok(W.pickPrompt('不存在的分類', S('y')).text);          // 未知分類退回全部
    const seen = new Set(); for (let i = 0; i < 200; i++) seen.add(W.pickPrompt('', S('s' + i)).text); assert.ok(seen.size > 20);

    // 角色：鎖定保留、未鎖定盡量換
    const c1 = W.genCharacter(S('c'));
    assert.deepStrictEqual(Object.keys(c1), ['背景', '個性', '動機', '缺點']);
    for (const f of Object.keys(c1)) assert.ok(W.CHAR_FIELDS[f].includes(c1[f]));
    for (let i = 0; i < 30; i++) {
        const c2 = W.genCharacter(S('r' + i), c1, { 背景: true, 動機: true });
        assert.strictEqual(c2['背景'], c1['背景']); assert.strictEqual(c2['動機'], c1['動機']);
        assert.notStrictEqual(c2['個性'], c1['個性']); assert.notStrictEqual(c2['缺點'], c1['缺點']);
    }
    assert.strictEqual(W.genCharacter(S('z'), { 背景: '自訂背景' }, { 背景: true })['背景'], '自訂背景');
    assert.ok(W.genCharacter(S('z'), {}, { 背景: true })['背景']);          // 鎖定但沒有值 → 照樣抽

    // 名言：約 100 句、不重複、欄位齊全、每日一句固定
    assert.ok(W.QUOTES.length >= 100, '名言數量 ' + W.QUOTES.length);
    assert.strictEqual(new Set(W.QUOTES.map(q => q.text)).size, W.QUOTES.length, '名言重複');
    for (const q of W.QUOTES) assert.ok(q.cat && q.by && q.text.length >= 3 && W.QUOTE_CATS.includes(q.cat));
    assert.deepStrictEqual([...W.QUOTE_CATS].sort(), ['人生', '勵志', '學習', '寫作', '智慧'].sort());
    assert.strictEqual(W.quoteOfDay('2026-01-01'), W.quoteOfDay('2026-01-01'));
    assert.ok(new Set(Array.from({ length: 40 }, (_, i) => W.quoteOfDay('2026-02-' + String(i + 1).padStart(2, '0')).text)).size > 15);
    assert.strictEqual(W.pickQuote('寫作', S('q')).cat, '寫作');
    assert.strictEqual(W.quoteText({ text: '甲', by: '乙' }), '「甲」—— 乙');

    // 標語
    let sl = W.genSlogans('咖啡', '', S('k'));
    assert.strictEqual(sl.length, 5); assert.strictEqual(new Set(sl).size, 5); assert.ok(sl.every(s => s.includes('咖啡') && !s.includes('{kw}')));
    sl = W.genSlogans(' 茶 ', '疑問', S('k'), 3); assert.strictEqual(sl.length, 3); assert.ok(sl.every(s => s.includes('茶')));
    assert.deepStrictEqual(W.genSlogans('茶', '疑問', S('k')), W.genSlogans('茶', '疑問', S('k')));
    assert.deepStrictEqual(W.genSlogans('   ', ''), []);
    assert.ok(W.genSlogans('x'.repeat(50), '').every(s => s.includes('x'.repeat(20)) && !s.includes('x'.repeat(21))));
    assert.strictEqual(W.genSlogans('茶', '不存在').length, 5);
    for (const t of Object.values(W.FORMULAS).flat()) assert.ok(t.includes('{kw}'));

    // 筆記：標籤、驗證、上限、刪除、搜尋
    assert.deepStrictEqual(W.parseTags('a, #b，c　d、a ;e'), ['a', 'b', 'c', 'd', 'e']);
    assert.strictEqual(W.parseTags('x'.repeat(50))[0].length, 20);
    assert.strictEqual(W.parseTags(Array.from({ length: 30 }, (_, i) => 't' + i).join(' ')).length, 10);
    assert.strictEqual(W.normNote(null), null); assert.strictEqual(W.normNote({ title: 'x' }), null); assert.strictEqual(W.normNote({ id: '' }), null);
    assert.deepStrictEqual(W.normNote({ id: 'a', type: '怪', title: 5, body: null, tags: 'x', done: 'y', at: NaN }), { id: 'a', type: '人物', title: '', body: '', tags: [], done: false, at: 0 });
    assert.strictEqual(W.normNote({ id: 'a', body: 'b'.repeat(W.MAX_BODY + 5) }).body.length, W.MAX_BODY);
    assert.deepStrictEqual(W.normNote({ id: 'a', tags: ['x', 5, 'y'], done: true, type: '伏筆', at: 3 }), { id: 'a', type: '伏筆', title: '', body: '', tags: ['x', 'y'], done: true, at: 3 });
    assert.deepStrictEqual(W.normNotes('壞掉'), []); assert.deepStrictEqual(W.normNotes(null), []);
    assert.deepStrictEqual(W.normNotes([{ id: 'a' }, null, { id: 'a' }, 5, { id: 'b' }]).map(n => n.id), ['a', 'b']);
    const big = Array.from({ length: 600 }, (_, i) => ({ id: 'n' + i })); assert.strictEqual(W.normNotes(big).length, W.MAX_NOTES);
    let list = [];
    let r = W.addNote(list, { id: 'x1', type: '地點', title: '舊港', body: '霧很大的港口', tags: ['海'], at: 5 }); assert.ok(r.ok); list = r.list; assert.strictEqual(list[0].title, '舊港');
    r = W.addNote(list, { id: 'x2', type: '人物', title: '', body: '  ' }); assert.ok(!r.ok); assert.strictEqual(r.list, list);
    r = W.addNote(list, { id: 'x3', title: '長', body: 'z'.repeat(W.MAX_BODY + 1) }); assert.ok(!r.ok);
    r = W.addNote(list, { title: '沒有 id' }); assert.ok(!r.ok);
    const full = W.normNotes(big); r = W.addNote(full, { id: 'new', title: 't' }); assert.ok(!r.ok); assert.ok(/500/.test(r.error)); assert.strictEqual(full.length, 500);
    list = W.addNote(list, { id: 'x4', type: '伏筆', title: '鑰匙', body: '第三章出現的黃銅鑰匙', tags: ['道具', '海'], at: 9 }).list;
    assert.deepStrictEqual(W.filterNotes(list, {}).map(n => n.id), ['x4', 'x1']);                     // 新的在前
    assert.deepStrictEqual(W.filterNotes(list, { q: '黃銅' }).map(n => n.id), ['x4']);
    assert.deepStrictEqual(W.filterNotes(list, { q: '  霧 ' }).map(n => n.id), ['x1']);
    assert.deepStrictEqual(W.filterNotes(list, { tag: '海' }).map(n => n.id), ['x4', 'x1']);
    assert.deepStrictEqual(W.filterNotes(list, { tag: '道具', type: '伏筆' }).map(n => n.id), ['x4']);
    assert.deepStrictEqual(W.filterNotes(list, { type: '人物' }), []);
    assert.deepStrictEqual(W.filterNotes(list, { q: '道具' }).map(n => n.id), ['x4']);                // 標籤也可搜尋
    assert.deepStrictEqual(W.removeNote(list, 'x1').map(n => n.id), ['x4']);
    assert.strictEqual(W.removeNote(list, 'nope').length, 2);

    // 劇本
    const P = W.parseScript;
    assert.deepStrictEqual(P(''), []);
    assert.deepStrictEqual(P('# 內 咖啡店 - 夜\n小明坐著。\n他看手機。\n\n@小明\n（低聲）\n她還沒回。\n不要走。\n\n> 切至：'), [
        { type: 'scene', text: '內 咖啡店 - 夜' }, { type: 'action', text: '小明坐著。\n他看手機。' },
        { type: 'character', text: '小明' }, { type: 'paren', text: '（低聲）' }, { type: 'dialogue', text: '她還沒回。\n不要走。' },
        { type: 'transition', text: '切至：' }]);
    assert.deepStrictEqual(P('@阿華: 你好\n再見\n\n他走了。'), [{ type: 'character', text: '阿華' }, { type: 'dialogue', text: '你好\n再見' }, { type: 'action', text: '他走了。' }]);
    assert.deepStrictEqual(P('@阿華：(笑)好啊'), [{ type: 'character', text: '阿華' }, { type: 'dialogue', text: '(笑)好啊' }]);   // 同一行：整句不是純括號 → 對白
    assert.deepStrictEqual(P('@阿華：(笑)'), [{ type: 'character', text: '阿華' }, { type: 'paren', text: '(笑)' }]);
    assert.deepStrictEqual(P('@\n普通'), [{ type: 'action', text: '@\n普通' }]);
    assert.deepStrictEqual(P('@小明\n\n接著是動作'), [{ type: 'character', text: '小明' }, { type: 'action', text: '接著是動作' }]);   // 空行結束對白
    assert.deepStrictEqual(P('# 場景一\n# 場景二').map(t => t.type), ['scene', 'scene']);
    assert.deepStrictEqual(P('\r\n# A\r\n動作\r\n').map(t => t.text), ['A', '動作']);
    assert.deepStrictEqual(P('  >  淡出  '), [{ type: 'transition', text: '淡出' }]);
    const st = W.scriptStats(P('# A\n# B\n@甲\n你好\n\n@乙\n嗨\n\n@甲\n再見\n\n@甲\n（嘆氣）'));
    assert.deepStrictEqual([st.scenes, st.dialogues, st.characters], [2, 3, ['甲', '乙']]);
    assert.deepStrictEqual(W.scriptStats([]), { scenes: 0, dialogues: 0, characters: [], words: 0 });
    const plain = W.scriptPlain(P('# int cafe\n動作。\n\n@小明\n（低聲）\n嗯。\n你好。\n\n> cut to:'));
    assert.strictEqual(plain, ['INT CAFE', '動作。', ' '.repeat(20) + '小明', ' '.repeat(15) + '（低聲）', ' '.repeat(10) + '嗯。\n' + ' '.repeat(10) + '你好。', ' '.repeat(40) + 'CUT TO:'].join('\n\n'));
    ok('h4 writing-desk');
}
