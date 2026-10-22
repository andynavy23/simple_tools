// 批次 h5：外語速查資料與搜尋、摩斯 / 點字 / 古典密碼 / NATO 純函式
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- lang-ref ----------
    const m = load('utils/lang-ref.html', 'TOPICS, CATS, searchTopics, checkData, parseRow, speakText');
    assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
    assert.ok(m.TOPICS.length >= 15);
    const affix = m.TOPICS.filter(t => t.id.startsWith('en-')).reduce((a, t) => a + t.rows.length, 0);
    assert.ok(affix >= 80, 'affix ' + affix);
    assert.ok(m.TOPICS.filter(t => t.id.startsWith('trip-') || t.id.startsWith('en-')).every(t => t.rows.every(r => m.parseRow(r).desc)));
    assert.ok(m.checkData([{ id: 'a', cat: '日文', title: 'x', rows: ['y'] }, { id: 'a', cat: 'zz', title: '', rows: [] }], m.CATS).length >= 4);
    assert.deepEqual(m.parseRow('abc ~~ def ~~ g'), { text: 'abc', desc: 'def ~~ g' });
    assert.equal(m.speakText('いっぽん・にほん'), 'いっぽん');
    assert.equal(m.searchTopics(m.TOPICS, '').length, m.TOPICS.length);
    assert.equal(m.searchTopics(m.TOPICS, '', '韓文').length, m.TOPICS.filter(t => t.cat === '韓文').length);
    assert.equal(m.searchTopics(m.TOPICS, 'zzzqqq').length, 0);
    const r1 = m.searchTopics(m.TOPICS, '召し上がる'); assert.ok(r1.length >= 1 && r1[0].t.id === 'ja-keigo-verbs');
    const r2 = m.searchTopics(m.TOPICS, 'pre-'); assert.ok(r2.some(x => x.t.id === 'en-prefix' && x.rows.some(r => r.text.startsWith('pre-'))));
    const r3 = m.searchTopics(m.TOPICS, '敬語'); assert.ok(r3.some(x => x.t.id === 'ja-keigo-verbs' && !x.byRows));
    assert.ok(m.searchTopics(m.TOPICS, '廁所').length >= 4);                 // 四語旅行會話各一
    ok('lang-ref: data integrity, search');
}

{ // ---------- classic-ciphers ----------
    const m = load('utils/classic-ciphers.html', 'MORSE, toMorse, fromMorse, morseUnits, unitSec, normAns, toBraille, fromBraille, caesar, rot13, caesarBrute, vigenere, railEncrypt, railDecrypt, letterFreq, indexOfCoincidence, keyLengthScores, bestKeyLength, guessKey, NATO, natoSpell');
    // 摩斯
    assert.equal(m.toMorse('SOS').code, '... --- ...');
    assert.equal(m.toMorse('Hello World').code, '.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
    assert.equal(m.fromMorse('.... . .-.. .-.. --- / .-- --- .-. .-.. -..'), 'HELLO WORLD');
    assert.equal(m.fromMorse('··· −−− ···'), 'SOS');
    assert.equal(m.fromMorse('.-.-.-.-.-.-.-'), '?');
    const all = Object.keys(m.MORSE).join('');
    assert.equal(m.fromMorse(m.toMorse(all).code), all);
    assert.equal(new Set(Object.values(m.MORSE)).size, Object.keys(m.MORSE).length);
    assert.deepEqual(m.toMorse('A~B ^'), { code: '.- -...', skipped: ['~', '^'] });
    assert.equal(m.toMorse('').code, '');
    assert.deepEqual(m.morseUnits('.'), [[1, 1]]);
    assert.deepEqual(m.morseUnits('.-'), [[1, 1], [0, 1], [1, 3]]);
    assert.deepEqual(m.morseUnits('. .'), [[1, 1], [0, 3], [1, 1]]);
    assert.deepEqual(m.morseUnits('. / .'), [[1, 1], [0, 7], [1, 1]]);
    const total = (c) => m.morseUnits(c).reduce((a, [, n]) => a + n, 0);
    assert.equal(total(m.toMorse('PARIS').code), 43);                       // PARIS 標準 50 單位，扣掉字尾單字間隔 7
    assert.ok(Math.abs(m.unitSec(12) - 0.1) < 1e-9);
    assert.equal(m.normAns(' s o s '), 'SOS');
    // 點字
    const br = (t) => m.toBraille(t).cells.map(c => c.ch).join('');
    assert.equal(br('abc'), '⠁⠃⠉');
    assert.equal(br('hello'), '⠓⠑⠇⠇⠕');
    assert.equal(br('123'), '⠼⠁⠃⠉');
    assert.equal(br('0'), '⠼⠚');
    assert.equal(br('Hi'), '⠠⠓⠊');
    assert.equal(br('1a'), '⠼⠁⠰⠁');
    assert.equal(br('a b'), '⠁⠀⠃');
    assert.equal(br('?'), '⠦');
    assert.deepEqual(m.toBraille('a~').skipped, ['~']);
    assert.equal(m.fromBraille('⠼⠁⠃⠉'), '123');
    assert.equal(m.fromBraille('⠠⠓⠊'), 'Hi');
    for (const t of ['Hello World', 'abcdefghijklmnopqrstuvwxyz', 'Room 101, floor 3a!', 'Is it 5? Yes: 10; no-way.', "It's 2024 b9"]) assert.equal(m.fromBraille(br(t)), t, t);
    assert.equal(m.fromBraille('⠿'), '?');
    // 凱薩 / ROT13
    assert.equal(m.caesar('Hello, World!', 3), 'Khoor, Zruog!');
    assert.equal(m.caesar('Khoor, Zruog!', -3), 'Hello, World!');
    assert.equal(m.caesar('xyz XYZ', 3), 'abc ABC');
    assert.equal(m.caesar('abc', 26), 'abc'); assert.equal(m.caesar('abc', -27), 'zab');
    assert.equal(m.rot13('Hello'), 'Uryyb'); assert.equal(m.rot13(m.rot13('Why did the chicken?')), 'Why did the chicken?');
    const br25 = m.caesarBrute('Khoor'); assert.equal(br25.length, 25); assert.equal(br25[2].text, 'Hello'); assert.equal(br25[2].shift, 3);
    for (let s = 1; s < 26; s++) assert.equal(m.caesar(m.caesar('Round Trip', s), -s), 'Round Trip');
    // 維吉尼亞
    assert.equal(m.vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
    assert.equal(m.vigenere('LXFOPVEFRNHR', 'LEMON', true), 'ATTACKATDAWN');
    assert.equal(m.vigenere('Attack at dawn!', 'lemon'), 'Lxfopv ef rnhr!');
    assert.equal(m.vigenere('Lxfopv ef rnhr!', 'lemon', true), 'Attack at dawn!');
    assert.equal(m.vigenere('abc', ''), 'abc'); assert.equal(m.vigenere('abc', '123'), 'abc');
    assert.equal(m.vigenere('abc', 'A'), 'abc');
    // 柵欄
    assert.equal(m.railEncrypt('WEAREDISCOVEREDFLEEATONCE', 3), 'WECRLTEERDSOEEFEAOCAIVDEN');
    assert.equal(m.railDecrypt('WECRLTEERDSOEEFEAOCAIVDEN', 3), 'WEAREDISCOVEREDFLEEATONCE');
    assert.equal(m.railEncrypt('HELLOWORLD', 2), 'HLOOLELWRD');
    for (const [t, r] of [['hello world, this is a test!', 4], ['a', 3], ['ab', 5], ['', 3], ['長度測試字串一二三', 3]]) assert.equal(m.railDecrypt(m.railEncrypt(t, r), r), t, t + r);
    // 頻率分析
    const plain = 'the quick brown fox jumps over the lazy dog and then runs through the forest while the sun is setting behind the distant mountains and every creature of the woods prepares for the long cold night that is coming soon after the last light fades from the western sky the old farmer closes his gate and walks slowly back to his small house where a warm fire is burning in the hearth and supper waits upon the table for the whole family to share together in peace and quiet gratitude for another good day';
    const ct = m.vigenere(plain, 'LEMON');
    assert.equal(m.letterFreq('Hello!').total, 5); assert.equal(m.letterFreq('Hello!').counts[11], 2);
    const ic = m.indexOfCoincidence(plain); assert.ok(ic > 0.055 && ic < 0.085, 'ic ' + ic);
    assert.ok(m.indexOfCoincidence(ct) < ic);
    const sc = m.keyLengthScores(ct, 12); assert.equal(sc.length, 12);
    assert.equal(m.bestKeyLength(sc), 5);
    assert.equal(m.guessKey(ct, 5), 'LEMON');
    assert.equal(m.indexOfCoincidence('a'), 0);
    // NATO
    assert.deepEqual(m.natoSpell('A1-b').map(x => x.word), ['Alfa', 'Wun', 'Bravo']);
    assert.equal(m.natoSpell('Ne9').map(x => x.word).join(' '), 'November Echo Niner');
    assert.equal(Object.keys(m.NATO).length, 36);
    ok('classic-ciphers: morse, braille, caesar, vigenere, rail fence, frequency, nato');
}
