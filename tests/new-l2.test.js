// 批次 l2：語言練習（mini-games/lang-drill.html）純邏輯與題庫完整性
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('mini-games/lang-drill.html', 'TOPICS, TOPIC_BY_ID, ITEMS, ITEM_BY_KEY, pickChoices, norm, accepts, buildQ, cleanStats, recordAnswer, weightOf, pickWeighted, pickRandom, scoreFor, weakest, bySub, totals, subsOf, cleanOpts, conj, adjForms, STAT_MAX, regular');
const { TOPICS, ITEMS, ITEM_BY_KEY } = m;
const seeded = (s) => Util.seeded(s);
const items = (t) => ITEMS.filter(i => i.topic === t);
const find = (t, id) => { const x = items(t).find(i => i.id === id); assert.ok(x, '找不到 ' + t + ' ' + id); return x; };

{ // ---------- 資料完整性 ----------
    assert.strictEqual(new Set(ITEMS.map(i => i.key)).size, ITEMS.length, '題目 key 不可重複');
    for (const t of TOPICS) assert.ok(items(t.id).length > 0, t.id + ' 沒有題目');
    for (const i of ITEMS) {
        const w = `${i.topic} ${i.sub} ${i.id}`;
        assert.ok(m.TOPIC_BY_ID[i.topic], w + ' 主題不存在');
        assert.ok(i.sub && i.q && i.ask && i.exp, w + ' 缺子分類 / 題幹 / 提示 / 解說');
        assert.ok(i.a.length && i.a.every(x => typeof x === 'string' && x.trim()), w + ' 答案為空');
        assert.ok(!/\|/.test(i.sub + i.id), w + ' 含有分隔字元');
        assert.ok(ITEM_BY_KEY[i.key] === i);
        if (i.strict) { assert.ok(i.bad.length >= (i.topic === 'typo' ? 1 : 2), w + ' 固定錯誤選項不足'); assert.ok(new Set(i.bad).size === i.bad.length, w + ' 錯誤選項重複'); assert.ok(i.bad.every(x => !i.a.includes(x)), w + ' 錯誤選項含正確答案'); }
    }
    ok('lang: bank integrity');
}

{ // ---------- 題庫規模與分類 ----------
    const subs = (t) => m.subsOf(t);
    assert.strictEqual(subs('tense').length, 12); for (const s of subs('tense')) assert.ok(items('tense').filter(i => i.sub === s).length >= 5, s);
    assert.ok(items('prep').length >= 45 && subs('prep').length === 4);
    assert.deepStrictEqual(subs('art').length, 3);
    const verbs = new Set(items('irv').map(i => i.id.split('.')[0])); assert.ok(verbs.size >= 110, '不規則動詞 ' + verbs.size);
    assert.ok(items('jpart').length >= 30);
    assert.strictEqual(subs('jadj').length, 8); assert.strictEqual(subs('jverb').length, 3);
    assert.ok(items('kanji').length >= 100);
    assert.strictEqual(new Set(items('es').map(i => i.id.split('.')[0])).size, 22);
    assert.ok(new Set(items('de').map(i => i.id.split('.')[0])).size >= 100);
    assert.ok(items('poyin').length >= 60 && items('typo').length >= 60);
    assert.ok(items('ko').length >= 100 && ITEMS.length < m.STAT_MAX, '題庫總數要小於統計上限');
    ok('lang: bank size');
}

{ // ---------- 選項：一個正確、不重複、正確答案在內、錯誤選項不含任何接受的寫法 ----------
    for (const i of ITEMS) for (const seed of ['a', 'b', 'c']) {
        const ch = m.pickChoices(i, seeded(seed + i.key));
        const w = i.key + ' ' + seed;
        assert.strictEqual(ch.filter(c => c.ok).length, 1, w + ' 正確選項數');
        assert.strictEqual(ch.find(c => c.ok).label, i.a[0], w + ' 正確選項標籤');
        assert.strictEqual(new Set(ch.map(c => c.label)).size, ch.length, w + ' 選項重複');
        assert.ok(ch.length >= (i.topic === 'typo' ? 2 : 3) && ch.length <= 4, w + ' 選項數 ' + ch.length);
        assert.ok(ch.filter(c => !c.ok).every(c => !i.a.includes(c.label)), w + ' 錯誤選項含正確答案');
        assert.ok(ch.every(c => c.label.trim()), w + ' 空選項');
    }
    const a = m.pickChoices(items('irv')[0], seeded('x')), b = m.pickChoices(items('irv')[0], seeded('x'));
    assert.deepStrictEqual(a, b, '同種子要可重現');
    assert.ok(Array.from({ length: 30 }, (_, k) => m.pickChoices(items('tense')[0], seeded('s' + k)).findIndex(c => c.ok)).some(x => x !== 0), '正確選項位置要會變');
    ok('lang: choices');
}

{ // ---------- 輸入題判定 ----------
    assert.strictEqual(m.norm("Isn't", 'tense'), 'is not'); assert.strictEqual(m.norm("won't", 'tense'), 'will not'); assert.strictEqual(m.norm("I’m", 'tense'), 'i am'); assert.strictEqual(m.norm('Ｗent ', 'irv'), 'went');
    assert.ok(m.accepts({ topic: 'tense', a: ['is not'] }, "isn't")); assert.ok(m.accepts({ topic: 'tense', a: ['is not'] }, ' IS  NOT '));
    assert.ok(!m.accepts({ topic: 'tense', a: ['is not'] }, 'is'));
    const go = find('irv', 'go.past'); assert.ok(m.accepts(go, 'went') && m.accepts(go, ' Went ') && !m.accepts(go, 'goed') && !m.accepts(go, 'gone') && !m.accepts(go, ''));
    assert.ok(m.accepts(find('irv', 'burn.past'), 'burnt') && m.accepts(find('irv', 'burn.past'), 'burned'));
    assert.ok(m.accepts(find('irv', 'be.past'), 'were') && m.accepts(find('irv', 'be.past'), 'was'));
    assert.ok(m.accepts(find('irv', 'get.pp'), 'gotten') && m.accepts(find('irv', 'get.pp'), 'got'));
    const nomu = find('jverb', '飲む.te'); assert.ok(m.accepts(nomu, '飲んで') && m.accepts(nomu, 'のんで') && m.accepts(nomu, 'ノンデ') && m.accepts(nomu, 'のんで ') && !m.accepts(nomu, '飲って'));
    assert.ok(m.accepts(find('kanji', '明日'), 'あす') && m.accepts(find('kanji', '明日'), 'あした'));
    const es = find('es', 'hablar.pt.2'); assert.ok(m.accepts(es, 'habló') && m.accepts(es, 'HABLÓ') && !m.accepts(es, 'hablo'), '西班牙語要檢查重音');
    assert.ok(m.accepts(find('jadj', '静か.neg'), '静かじゃない') && m.accepts(find('jadj', '静か.neg'), '静かではない') && m.accepts(find('jadj', '静か.neg'), 'しずかじゃない'));
    ok('lang: answer matching');
}

{ // ---------- 日文動詞變化 ----------
    const c = (k, g, w, f) => m.conj({ w, k, g }, f);
    assert.deepStrictEqual(c('のむ', 1, '飲む', 'te'), ['飲んで', 'のんで']); assert.deepStrictEqual(c('のむ', 1, '飲む', 'masu'), ['飲みます', 'のみます']);
    assert.strictEqual(c('いく', 1, '行く', 'te')[0], '行って'); assert.strictEqual(c('いく', 1, '行く', 'ta')[0], '行った'); assert.strictEqual(c('いく', 1, '行く', 'nai')[0], '行かない'); assert.strictEqual(c('いく', 1, '行く', 'masu')[0], '行きます');
    assert.strictEqual(c('かえる', 1, '帰る', 'nai')[0], '帰らない'); assert.strictEqual(c('かえる', 1, '帰る', 'te')[0], '帰って'); assert.strictEqual(c('たべる', 2, '食べる', 'ta')[0], '食べた'); assert.strictEqual(c('たべる', 2, '食べる', 'nai')[0], '食べない');
    assert.deepStrictEqual(c('くる', 3, '来る', 'nai'), ['来ない', 'こない']); assert.deepStrictEqual(c('くる', 3, '来る', 'masu'), ['来ます', 'きます']); assert.deepStrictEqual(c('くる', 3, '来る', 'ta'), ['来た', 'きた']);
    assert.deepStrictEqual(c('ある', 1, 'ある', 'nai'), ['ない']); assert.strictEqual(c('する', 3, 'する', 'masu')[0], 'します');
    assert.strictEqual(c('べんきょうする', 3, '勉強する', 'masu')[0], '勉強します'); assert.strictEqual(c('べんきょうする', 3, '勉強する', 'ta')[1], 'べんきょうした');
    assert.strictEqual(c('かう', 1, '買う', 'nai')[0], '買わない'); assert.strictEqual(c('かう', 1, '買う', 'te')[0], '買って'); assert.strictEqual(c('まつ', 1, '待つ', 'nai')[0], '待たない'); assert.strictEqual(c('はなす', 1, '話す', 'te')[0], '話して');
    assert.strictEqual(c('かく', 1, '書く', 'ta')[0], '書いた'); assert.strictEqual(c('およぐ', 1, '泳ぐ', 'te')[0], '泳いで'); assert.strictEqual(c('しぬ', 1, '死ぬ', 'ta')[0], '死んだ'); assert.strictEqual(c('あそぶ', 1, '遊ぶ', 'nai')[0], '遊ばない'); assert.strictEqual(c('よむ', 1, '読む', 'ta')[0], '読んだ');
    assert.strictEqual(c('きる', 2, '着る', 'te')[1], 'きて'); assert.strictEqual(c('きる', 1, '切る', 'te')[1], 'きって');
    // 錯誤選項不含任何正確寫法，且有「結尾る卻當二類」的典型錯誤
    assert.ok(find('jverb', '帰る.masu').bad.includes('帰ます') && find('jverb', '食べる.te').bad.includes('食べって'));
    ok('lang: japanese verbs');
}

{ // ---------- 日文形容詞變化 ----------
    const f = m.adjForms;
    assert.deepStrictEqual(f('高い', 'i'), { neg: ['高くない'], past: ['高かった'], pastneg: ['高くなかった'], adv: ['高く'] });
    assert.strictEqual(f('いい', 'i').past[0], 'よかった'); assert.strictEqual(f('いい', 'i').neg[0], 'よくない'); assert.strictEqual(f('かっこいい', 'i').adv[0], 'かっこよく');
    assert.strictEqual(f('きれい', 'na').adv[0], 'きれいに'); assert.deepStrictEqual(f('好き', 'na').pastneg, ['好きじゃなかった', '好きではなかった']); assert.strictEqual(f('静か', 'na').past[0], '静かだった');
    assert.deepStrictEqual(find('jadj', '高い.neg').a, ['高くない', 'たかくない']); assert.strictEqual(find('jadj', 'いい.adv').a[0], 'よく');
    assert.strictEqual(find('jadj', '大きい.past').sub, 'い形容詞・過去'); assert.strictEqual(find('jadj', 'きれい.neg').sub, 'な形容詞・否定');
    ok('lang: japanese adjectives');
}

{ // ---------- 韓文、西班牙語、德語 ----------
    const ko = (id) => find('ko', id).a[0];
    assert.strictEqual(ko('가'), 'ga'); assert.strictEqual(ko('한'), 'han'); assert.strictEqual(ko('책'), 'chaek'); assert.strictEqual(ko('ㄱ'), 'g'); assert.strictEqual(ko('ㅋ'), 'k'); assert.strictEqual(ko('ㅇ'), '不發音'); assert.strictEqual(ko('ㅓ'), 'eo'); assert.strictEqual(ko('으'), 'eu'); assert.strictEqual(ko('시'), 'si'); assert.strictEqual(ko('강'), 'gang'); assert.strictEqual(ko('닫'), 'dat'); assert.strictEqual(ko('물'), 'mul');
    assert.strictEqual(find('es', 'tener.pr.0').a[0], 'tengo'); assert.strictEqual(find('es', 'ir.pt.3').a[0], 'fuimos'); assert.strictEqual(find('es', 'hacer.pt.2').a[0], 'hizo'); assert.strictEqual(find('es', 'pedir.pt.4').a[0], 'pidieron'); assert.strictEqual(find('es', 'salir.pt.0').sub, '簡單過去式・規則'); assert.strictEqual(find('es', 'salir.pr.0').sub, '現在式・不規則');
    assert.ok(find('es', 'hablar.pt.2').bad.includes('hablo') && find('es', 'hablar.pr.1').bad.includes('hablaste'));
    assert.strictEqual(find('de', 'Tisch.nom').a[0], 'der'); assert.strictEqual(find('de', 'Frau.nom').a[0], 'die'); assert.strictEqual(find('de', 'Kind.nom').a[0], 'das');
    assert.strictEqual(find('de', 'Mann.akk').a[0], 'den'); assert.strictEqual(find('de', 'Frau.akk').a[0], 'die'); assert.strictEqual(find('de', 'Buch.akk').a[0], 'das');
    assert.strictEqual(find('de', 'Mann.dat').a[0], 'dem'); assert.strictEqual(find('de', 'Frau.dat').a[0], 'der'); assert.strictEqual(find('de', 'Buch.dat').a[0], 'dem');
    ok('lang: korean / spanish / german');
}

{ // ---------- 英文不規則動詞 ----------
    const p = (v, t) => find('irv', v + '.' + t).a;
    assert.deepStrictEqual(p('go', 'past'), ['went']); assert.deepStrictEqual(p('go', 'pp'), ['gone']); assert.deepStrictEqual(p('be', 'past'), ['was', 'were']); assert.deepStrictEqual(p('lie', 'past'), ['lay']); assert.deepStrictEqual(p('lie', 'pp'), ['lain']); assert.deepStrictEqual(p('lay', 'past'), ['laid']);
    assert.ok(!items('irv').some(i => i.id === 'cut.pp'), '過去式 = 過去分詞的不重複出題'); assert.strictEqual(find('irv', 'cut.past').sub, 'AAA 三態同形'); assert.strictEqual(find('irv', 'come.pp').sub, 'ABA 原形＝過去分詞'); assert.strictEqual(find('irv', 'buy.past').sub, 'ABB 過去式＝過去分詞'); assert.strictEqual(find('irv', 'write.pp').sub, 'ABC 三態不同');
    assert.ok(find('irv', 'go.past').bad.includes('goed') && find('irv', 'go.past').bad.includes('gone') && find('irv', 'fly.past').bad.includes('flied'));
    assert.strictEqual(m.regular('love'), 'loved'); assert.strictEqual(m.regular('try'), 'tried'); assert.strictEqual(m.regular('play'), 'played');
    ok('lang: irregular verbs');
}

{ // ---------- 統計：驗證、記錄、上限 ----------
    const k1 = items('tense')[0].key, k2 = items('typo')[0].key;
    for (const bad of [null, undefined, 5, 'x', [], { s: 1 }, { s: [] }, { s: { [k1]: 'x' } }, { s: { [k1]: null } }]) assert.deepStrictEqual(m.cleanStats(bad), { s: {}, best: {} });
    const dirty = m.cleanStats({ s: { [k1]: [3, 1.9], [k2]: [-5, 'a'], '不存在|x|y': [1, 1], __proto__: [1, 1], constructor: [1, 1] }, best: { tense: 120.7, ghost: 5, typo: -3, irv: 'x' } });
    assert.deepStrictEqual(dirty.s, { [k1]: [3, 1] }); assert.deepStrictEqual(dirty.best, { tense: 120 });
    assert.deepStrictEqual(m.cleanStats({ s: { [k1]: [1e12, 1] } }).s[k1], [100000, 1]);
    let s = m.cleanStats(null); s = m.recordAnswer(s, k1, true); s = m.recordAnswer(s, k1, false); s = m.recordAnswer(s, k1, false); assert.deepStrictEqual(s.s[k1], [1, 2]);
    assert.strictEqual(m.recordAnswer(s, '不存在', true), s); assert.strictEqual(m.recordAnswer(s, '__proto__', true), s);
    const snap = JSON.stringify(s); m.recordAnswer(s, k2, true); assert.strictEqual(JSON.stringify(s), snap, '不可就地修改');
    // 上限：用假的題庫鍵塞滿
    const full = { s: {}, best: {} }; ITEMS.slice(0, 50).forEach(i => full.s[i.key] = [1, 0]);
    assert.ok(m.STAT_MAX === 3000);
    assert.deepStrictEqual(m.totals({ s: { a: [2, 3], b: [1, 0] } }), [3, 3]);
    ok('lang: stats validation');
}

{ // ---------- 統計：最弱、權重、各子分類 ----------
    const [a, b, c] = items('tense'); let s = m.cleanStats(null);
    assert.deepStrictEqual(m.weakest(s), []);
    for (let i = 0; i < 5; i++) s = m.recordAnswer(s, a.key, false);
    s = m.recordAnswer(s, b.key, false); for (let i = 0; i < 9; i++) s = m.recordAnswer(s, b.key, true); s = m.recordAnswer(s, c.key, true);
    const w = m.weakest(s); assert.deepStrictEqual(w.map(x => x.key), [a.key, b.key], '只列答錯過的，錯誤率高的在前');
    assert.strictEqual(m.weakest(Object.assign({}, s, { s: Object.fromEntries(items('kanji').slice(0, 30).map(i => [i.key, [0, 1]])) })).length, 10);
    assert.ok(m.weightOf([0, 5]) > m.weightOf([5, 0]) && m.weightOf(undefined) > m.weightOf([5, 0]));
    const rows = m.bySub(s); const r = rows.find(x => x.topic === 'tense' && x.sub === a.sub); assert.ok(r.w >= 6);
    assert.ok(rows.every(x => x.c + x.w > 0));
    ok('lang: weakest / weights / by sub');
}

{ // ---------- 錯題加強：答錯的出現機率較高 ----------
    const pool = items('prep').slice(0, 10); let s = m.cleanStats(null);
    for (let i = 0; i < 6; i++) s = m.recordAnswer(s, pool[0].key, false);
    for (const p of pool.slice(1)) for (let i = 0; i < 6; i++) s = m.recordAnswer(s, p.key, true);
    const rand = seeded('w'); let hit = 0; for (let i = 0; i < 2000; i++) if (m.pickWeighted(pool, s, rand, null).key === pool[0].key) hit++;
    assert.ok(hit / 2000 > 0.3, '常答錯的比例 ' + hit / 2000);
    for (let i = 0; i < 300; i++) assert.notStrictEqual(m.pickWeighted(pool, s, rand, pool[0].key).key, pool[0].key, '不連續重複');
    assert.strictEqual(m.pickWeighted([], s, rand, null), null); assert.strictEqual(m.pickWeighted([pool[0]], s, rand, pool[0].key).key, pool[0].key);
    assert.strictEqual(m.pickRandom([], rand, null), null);
    ok('lang: weighted picking');
}

{ // ---------- 出題、計分、選項設定 ----------
    const q1 = m.buildQ(find('irv', 'go.past'), seeded('q'), true); assert.ok(q1.typed && q1.choices === null);
    const q2 = m.buildQ(find('irv', 'go.past'), seeded('q'), false); assert.ok(!q2.typed && q2.choices.length === 4);
    const q3 = m.buildQ(find('tense', items('tense')[0].id), seeded('q'), true); assert.ok(!q3.typed && q3.choices, '不支援輸入的主題仍是選擇題');
    assert.strictEqual(m.scoreFor(0), 11); assert.strictEqual(m.scoreFor(5), 15); assert.strictEqual(m.scoreFor(99), 20);
    assert.deepStrictEqual(m.cleanOpts(null), { topic: 'tense', subs: {}, typ: false, mode: 'seq', count: 20 });
    for (const bad of [5, 'x', [], { topic: 'constructor' }, { topic: '__proto__', mode: 'toString', count: 7, typ: 'yes', subs: [] }]) assert.deepStrictEqual(m.cleanOpts(bad), { topic: 'tense', subs: {}, typ: false, mode: 'seq', count: 20 });
    const o = m.cleanOpts({ topic: 'jverb', mode: 'timed', count: 50, typ: true, subs: { jverb: ['一類（五段）', '不存在'], irv: ['x'], ghost: ['y'], tense: 'z' } });
    assert.deepStrictEqual(o, { topic: 'jverb', subs: { jverb: ['一類（五段）'] }, typ: true, mode: 'timed', count: 50 });
    // 模擬一整局：每題的正確選項都能判對、錯誤選項判錯
    let s = m.cleanStats(null), rand = seeded('sim');
    for (let i = 0; i < 300; i++) { const it = m.pickWeighted(items('typo'), s, rand, null), q = m.buildQ(it, rand, false); s = m.recordAnswer(s, it.key, q.choices.find(c => c.ok).label === it.a[0]); }
    assert.strictEqual(m.totals(s)[1], 0); assert.ok(m.totals(s)[0] === 300);
    ok('lang: questions, scoring, options');
}
