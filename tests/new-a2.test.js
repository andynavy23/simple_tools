// a2：utils/tts.html 語言辨識（detectSegments）與選聲音（pickVoice）
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/tts.html', 'detectSegments, detectLatin, pickVoice, accentOptions, cleanAuto, chunks');
const { detectSegments: seg, pickVoice, accentOptions, cleanAuto } = m;
const langs = (t) => seg(t).map(s => s.lang);
const one = (t, l) => { const r = seg(t); assert.deepStrictEqual(r.map(x => x.lang), [l], `${t} → ${JSON.stringify(r)}`); };

// 基本 / 邊界
assert.deepStrictEqual(seg(''), []); assert.deepStrictEqual(seg(null), []); assert.deepStrictEqual(seg(undefined), []);
assert.deepStrictEqual(seg('123 !!!'), [{ text: '123 !!!', lang: 'und' }]);
ok('a2 detect: empty / digits only');

// 各書寫系統
one('今天天氣很好，我們去公園散步吧。', 'zh');
one('今日はいい天気ですね。散歩に行きましょう。', 'ja');           // 漢字 + 假名 → 整句日文
one('カタカナのテスト', 'ja');
one('오늘 날씨가 정말 좋네요', 'ko');
one('สวัสดีครับ วันนี้อากาศดีมาก', 'th');
one('مرحبا كيف حالك اليوم', 'ar');
one('سلام، حال شما چطور است؟ گچپژ', 'fa');
one('یہ ٹھیک ہے اور ڑ ں', 'ur');
one('שלום מה שלומך היום', 'he');
one('नमस्ते आप कैसे हैं', 'hi');
one('Привет, как дела сегодня?', 'ru');
one('Привіт, як справи? Їжак єдиний', 'uk');
one('Γειά σου, τι κάνεις σήμερα;', 'el');
ok('a2 detect: scripts (zh ja ko th ar fa ur he hi ru uk el)');

// 拉丁語言
const latin = {
    en: 'The weather is very good today and we are going to the park.',
    es: '¿Cómo estás? Hoy hace muy buen tiempo y vamos al parque.',
    fr: 'Bonjour, je suis très content de vous voir ici aujourd’hui.',
    de: 'Ich bin heute sehr müde, aber das Wetter ist schön und wir gehen spazieren.',
    pt: 'Eu não sei o que fazer, mas você está muito calmo hoje.',
    it: 'Buongiorno, come stai? Io sono molto felice di vederti oggi.',
    nl: 'Ik ben een student en ik woon in Amsterdam met mijn familie.',
    pl: 'Dzień dobry, jak się masz? Jestem bardzo zadowolony z pogody.',
    tr: 'Bugün hava çok güzel ve ben parka gidiyorum.',
    vi: 'Xin chào, tôi là người Việt Nam và tôi rất vui được gặp bạn.',
    id: 'Saya tidak tahu apa yang harus dilakukan dengan ini hari ini.',
};
for (const [l, t] of Object.entries(latin)) one(t, l);
one('Mañana vamos a la playa', 'es'); one('Ich möchte ein Bier, bitte', 'de'); one('Straße', 'de'); one('São Paulo é uma cidade grande', 'pt'); one('Çok teşekkürler', 'tr'); one('Łódź jest miastem', 'pl');
ok('a2 detect: latin languages (en es fr de pt it nl pl tr vi id)');

// 辨識不出 → und；不確定時退回 ar
assert.deepStrictEqual(langs('Xyzzy qwerty'), ['und']); assert.deepStrictEqual(langs('Python'), ['und']);
ok('a2 detect: low score → und');

// 混合
let r = seg('iPhone 15 很好用 OK');
assert.deepStrictEqual(r, [{ text: 'iPhone 15 很好用 OK', lang: 'zh' }], JSON.stringify(r));   // 短英文詞不切開
r = seg('我今天要去開會。The weather is very good today and we are going to the park. 然後回家。');
assert.deepStrictEqual(r.map(x => x.lang), ['zh', 'en', 'zh'], JSON.stringify(r));
r = seg('你好。こんにちは、元気ですか。');
assert.deepStrictEqual(r.map(x => x.lang), ['zh', 'ja'], JSON.stringify(r));
r = seg('Hello everyone, how are you today? Bonjour tout le monde, je suis très content.');
assert.deepStrictEqual(r.map(x => x.lang), ['en', 'fr'], JSON.stringify(r));
r = seg('你好 Hello, nice to meet you and welcome to the show');
assert.deepStrictEqual(r.map(x => x.lang), ['zh', 'en'], JSON.stringify(r));       // 2 個漢字不被併進英文
r = seg('안녕하세요。你好。Привет, как дела сегодня?');
assert.deepStrictEqual(r.map(x => x.lang), ['ko', 'zh', 'ru'], JSON.stringify(r));
r = seg('1234, 5678 你好');
assert.deepStrictEqual(r, [{ text: '1234, 5678 你好', lang: 'zh' }]);
ok('a2 detect: mixed text (zh+en, ja+zh, en+fr, ko+zh+ru, digits)');

// 片段串起來等於原文
for (const t of ['iPhone 15 很好用 OK', '  \n你好\n\nHello world, this is a test.  ', '😀 emoji 😀 你好 😀', '(123) — “quote” 你好', ...Object.values(latin)])
    assert.strictEqual(seg(t).map(x => x.text).join(''), t, t);
ok('a2 detect: segments join back to the original');

// 效能：一萬字 < 100ms
const big = ('今天天氣很好。The weather is very good today and we are going. 今日はいい天気ですね。Привет, как дела? ').repeat(125);
const t0 = Date.now(); const rb = seg(big); const dt = Date.now() - t0;
assert.ok(big.length >= 9000 && dt < 100, `perf ${big.length} chars ${dt}ms`); assert.ok(rb.length > 100);
const t1 = Date.now(); seg('a'.repeat(10000)); seg('你'.repeat(10000)); seg(' '.repeat(10000) + 'x'); assert.ok(Date.now() - t1 < 200, 'degenerate input');
ok('a2 detect: perf ' + dt + 'ms / 10k chars');

// pickVoice
const V = (name, lang, o = {}) => ({ name, lang, voiceURI: name, ...o });
const vs = [V('Xiaoxiao', 'zh-CN'), V('Meijia', 'zh-TW'), V('Sinji', 'zh-HK'), V('Cantonese', 'yue-HK'), V('Mandarin', 'cmn-Hans-CN'),
V('Daniel', 'en-GB'), V('Samantha', 'en-US', { default: true }), V('Karen', 'en_AU'), V('Rishi', 'en-IN'), V('Monica', 'es-ES'), V('Paulina', 'es-MX'), V('Luciana', 'pt-BR'), V('Joana', 'pt-PT'), V('Amelie', 'fr-CA'), V('Thomas', 'fr-FR')];
const nm = (v) => v && v.name;
assert.strictEqual(nm(pickVoice(vs, 'zh', 'zh-TW')), 'Meijia');
assert.strictEqual(nm(pickVoice(vs, 'zh', 'zh-CN')), 'Xiaoxiao');
assert.strictEqual(nm(pickVoice(vs, 'zh', 'zh-HK')), 'Sinji');                 // zh-HK 優先於 yue-HK
assert.strictEqual(nm(pickVoice(vs.filter(v => v.name !== 'Sinji'), 'zh', 'zh-HK')), 'Cantonese');   // 沒有 zh-HK 時 yue-HK 仍是 HK 口音
assert.strictEqual(nm(pickVoice(vs, 'zh', '')), 'Xiaoxiao');                   // 沒偏好：同層級取先出現的
assert.strictEqual(nm(pickVoice(vs.filter(v => !/^zh/.test(v.lang)), 'zh', 'zh-TW')), 'Mandarin');   // cmn-* 也算中文
assert.strictEqual(nm(pickVoice(vs.filter(v => /yue|en/.test(v.lang)), 'zh', '')), 'Cantonese');     // 只有粵語時才用粵語
assert.strictEqual(nm(pickVoice(vs, 'yue', '')), 'Cantonese'); assert.strictEqual(nm(pickVoice(vs.filter(v => v.lang !== 'yue-HK'), 'yue', '')), 'Sinji');
assert.strictEqual(nm(pickVoice(vs, 'en', 'en-GB')), 'Daniel'); assert.strictEqual(nm(pickVoice(vs, 'en', 'en-AU')), 'Karen'); assert.strictEqual(nm(pickVoice(vs, 'en', 'en-IN')), 'Rishi'); assert.strictEqual(nm(pickVoice(vs, 'en', 'en-US')), 'Samantha');
assert.strictEqual(nm(pickVoice(vs, 'en', 'GB')), 'Daniel');                   // 只給地區碼也行
assert.strictEqual(nm(pickVoice(vs, 'en', 'en-ZA')), 'Samantha');              // 沒有該口音 → 退回同語言（系統預設）
assert.strictEqual(nm(pickVoice(vs, 'en', '')), 'Samantha');
assert.strictEqual(nm(pickVoice(vs, 'es', 'es-MX')), 'Paulina'); assert.strictEqual(nm(pickVoice(vs, 'es', 'es-ES')), 'Monica');
assert.strictEqual(nm(pickVoice(vs, 'pt', 'pt-PT')), 'Joana'); assert.strictEqual(nm(pickVoice(vs, 'pt', 'pt-BR')), 'Luciana'); assert.strictEqual(nm(pickVoice(vs, 'fr', 'fr-CA')), 'Amelie');
assert.strictEqual(pickVoice(vs, 'ja', 'ja-JP'), null); assert.strictEqual(pickVoice([], 'en', ''), null); assert.strictEqual(pickVoice(null, 'en', ''), null);
assert.strictEqual(nm(pickVoice([V('a', 'en-US'), V('b', 'en-US', { localService: true })], 'en', '')), 'b');   // 同分取本機聲音
assert.strictEqual(nm(pickVoice([V('he', 'iw-IL'), V('id', 'in-ID')], 'he', '')), 'he'); assert.strictEqual(nm(pickVoice([V('he', 'iw-IL'), V('id', 'in-ID')], 'id', '')), 'id');
assert.strictEqual(pickVoice([null, { lang: 5 }, {}], 'en', ''), null);        // 壞資料不當掉
ok('a2 pickVoice: accent priority / fallback / null / cmn / yue / alias');

// accentOptions
const ao = accentOptions(vs, 'en'); assert.deepStrictEqual(ao.map(o => o.code).sort(), ['en-AU', 'en-GB', 'en-IN', 'en-US']);
assert.deepStrictEqual(accentOptions(vs, 'zh').map(o => o.code).sort(), ['zh-CN', 'zh-HK', 'zh-TW']);   // CN 有 2 個聲音（含 cmn-Hans-CN）、HK 有 2 個（含 yue）
assert.strictEqual(accentOptions(vs, 'zh').find(o => o.code === 'zh-CN').n, 2);
assert.deepStrictEqual(accentOptions(vs, 'ja'), []); assert.deepStrictEqual(accentOptions(null, 'en'), []);
ok('a2 accentOptions');

// cleanAuto
assert.deepStrictEqual(cleanAuto(null), { on: true, def: 'zh', accents: {} });
for (const bad of [undefined, 5, 'x', [], [1], true]) assert.deepStrictEqual(cleanAuto(bad), { on: true, def: 'zh', accents: {} });
assert.deepStrictEqual(cleanAuto({ on: false, def: 'ja', accents: { en: 'en-GB', zh: '', xx: 'xx-YY', es: 'drop table', fr: 5 } }), { on: false, def: 'ja', accents: { en: 'en-GB', zh: '' } });
assert.deepStrictEqual(cleanAuto({ on: 'yes', def: 'und', accents: [1] }), { on: true, def: 'zh', accents: {} });
assert.deepStrictEqual(cleanAuto({ accents: { en: 'en-GB' } }).accents, { en: 'en-GB' });
ok('a2 cleanAuto: validation / defaults');

// 既有行為
assert.deepStrictEqual(m.chunks('第一句。第二句！第三句？'), ['第一句。', '第二句！', '第三句？']);
ok('a2 chunks unchanged');
