// 批次 g4：web-meta（OG / JSON-LD / robots / sitemap / 搜尋預覽 / slug / UTM 純邏輯）
const { load, ok } = require('./_load');
const assert = require('assert');

{
    const m = load('utils/web-meta.html', 'loadOpts, escAttr, isAbsUrl, textWidth, truncateByWidth, serpCrumb, serpCheck, buildMeta, parseFaq, buildJsonLd, ldScript, buildRobots, parseRobots, robotsAllows, buildSitemap, parseSitemap, slugify, slugBatch, buildUtm, buildUtmBatch');
    const lv = (arr, level, re) => arr.some(x => x.level === level && re.test(x.msg));
    assert.deepEqual(m.loadOpts(null), { tab: 'social' }); assert.deepEqual(m.loadOpts({ tab: 'utm' }), { tab: 'utm' }); assert.deepEqual(m.loadOpts({ tab: 'zzz' }), { tab: 'social' });
    assert.equal(m.escAttr('a"b<c>&'), 'a&quot;b&lt;c&gt;&amp;');
    assert.ok(m.isAbsUrl('https://a.com/x') && !m.isAbsUrl('/x') && !m.isAbsUrl('javascript:alert(1)') && !m.isAbsUrl('ftp://a.com'));
    // 寬度
    assert.equal(m.textWidth('你好abc'), 7); assert.equal(m.textWidth('ＡＢ'), 4); assert.equal(m.textWidth('、。「」'), 8); assert.equal(m.textWidth(''), 0); assert.equal(m.textWidth(null), 0);
    assert.deepEqual(m.truncateByWidth('你好世界', 5), { text: '你好…', cut: true, width: 8 }); assert.deepEqual(m.truncateByWidth('abc', 5), { text: 'abc', cut: false, width: 3 });
    assert.equal(m.truncateByWidth('a'.repeat(100), 60).text.length, 60); assert.ok(m.truncateByWidth('你'.repeat(40), 60).width === 80 && m.truncateByWidth('你'.repeat(40), 60).text === '你'.repeat(29) + '…');
    assert.equal(m.serpCrumb('https://a.com/blog/我的文章'), 'a.com › blog › 我的文章'); assert.equal(m.serpCrumb('https://a.com'), 'a.com');
    assert.ok(lv(m.serpCheck('你'.repeat(40), 'x'), 'warn', /標題寬度/)); assert.ok(lv(m.serpCheck('', 'x'), 'bad', /標題/)); assert.ok(lv(m.serpCheck('t'.repeat(40), ''), 'warn', /沒有描述/));
    assert.ok(lv(m.serpCheck('t'.repeat(40), 'd'.repeat(170)), 'warn', /描述寬度/)); assert.ok(lv(m.serpCheck('t'.repeat(40), 'd'.repeat(130)), 'info', /手機/));
    // OG
    let r = m.buildMeta({ title: '我的 "網站"', desc: '說明', url: 'https://a.com/', image: 'https://a.com/c.jpg', imageAlt: '封面', site: 'S', type: '', card: '', twSite: 'me', locale: 'zh_TW', basic: true });
    assert.deepEqual(r.errors, []); assert.deepEqual(r.warns, []);
    for (const s of ['<title>我的 &quot;網站&quot;</title>', '<meta name="description" content="說明">', '<meta property="og:type" content="website">', '<meta property="og:image:alt" content="封面">', '<meta name="twitter:card" content="summary_large_image">', '<meta name="twitter:site" content="@me">', '<meta property="og:site_name" content="S">']) assert.ok(r.html.includes(s), s);
    r = m.buildMeta({ title: '', url: 'a.com', image: '/c.jpg' }); assert.equal(r.errors.length, 3);
    r = m.buildMeta({ title: 't', url: 'https://a.com', image: 'http://a.com/c.jpg', card: 'summary' }); assert.ok(r.warns.some(x => /https/.test(x)) && r.html.includes('content="summary"') && !r.html.includes('<title>'));
    assert.ok(m.buildMeta({ title: 't', url: 'https://a.com' }).warns.some(x => /沒有圖片/.test(x)));
    // JSON-LD
    assert.ok(m.buildJsonLd('Article', {}).errors.length >= 4);
    r = m.buildJsonLd('Article', { headline: 'H', author: 'A', datePublished: '2026-10-22', image: 'https://a.com/1.jpg\nhttps://a.com/2.jpg', publisher: 'P', url: 'https://a.com/p', dateModified: '2026-10-23T09:00:00+08:00' });
    assert.deepEqual(r.errors, []); assert.deepEqual(r.data.author, { '@type': 'Person', name: 'A' }); assert.equal(r.data.image.length, 2); assert.equal(r.data.mainEntityOfPage['@id'], 'https://a.com/p'); assert.equal(r.data['@context'], 'https://schema.org');
    assert.ok(m.buildJsonLd('Article', { headline: 'H', author: 'A', datePublished: '2026/10/22', image: '/x.jpg' }).errors.length === 2);
    assert.ok(m.buildJsonLd('Article', { headline: 'H', author: 'A', datePublished: '2026-10-22', dateModified: '2026-10-01', image: 'https://a.com/1.jpg' }).warns.some(x => /早於/.test(x)));
    const xss = m.ldScript(m.buildJsonLd('Article', { headline: '</script><script>alert(1)</script>', author: 'A', datePublished: '2026-10-22', image: 'https://a.com/1.jpg' }).data);
    assert.ok(!xss.slice(30, -9).includes('</script>') && xss.includes('\\u003c/script>') && xss.startsWith('<script type="application/ld+json">') && xss.endsWith('</script>'));
    assert.equal(JSON.parse(xss.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')).headline, '</script><script>alert(1)</script>');   // 往返
    r = m.buildJsonLd('Product', { name: 'N', image: 'https://a.com/1.jpg', price: '19.90', currency: 'TWD', availability: 'PreOrder', brand: 'B', ratingValue: '4.5', reviewCount: '12' });
    assert.deepEqual(r.errors, []); assert.deepEqual(r.data.offers, { '@type': 'Offer', price: '19.90', priceCurrency: 'TWD', availability: 'https://schema.org/PreOrder' }); assert.equal(r.data.aggregateRating.reviewCount, '12');
    assert.equal(m.buildJsonLd('Product', { name: 'N', image: 'https://a.com/1.jpg', price: 'NT$1,299', currency: 'twd' }).errors.length, 2);
    assert.ok(m.buildJsonLd('Product', { name: 'N', image: 'https://a.com/1.jpg', price: '1', currency: 'USD', ratingValue: '6', reviewCount: '0' }).errors.length === 2);
    assert.ok(m.buildJsonLd('Product', { name: 'N', image: 'https://a.com/1.jpg', price: '1', currency: 'USD', ratingValue: '5' }).errors.length === 1);
    assert.deepEqual(m.parseFaq('Q: 一？\nA: 甲\n乙\n\n\n二？\n丙'), [{ q: '一？', a: '甲\n乙' }, { q: '二？', a: '丙' }]);
    r = m.buildJsonLd('FAQ', { faq: '問1\n答1\n\n問2' }); assert.equal(r.errors.length, 1); assert.equal(r.data.mainEntity.length, 1); assert.equal(r.data.mainEntity[0].acceptedAnswer.text, '答1'); assert.equal(m.buildJsonLd('FAQ', { faq: '' }).errors.length, 1);
    r = m.buildJsonLd('LocalBusiness', { subtype: 'Restaurant', name: 'N', street: 'S', city: 'C', country: 'TW', tel: '+886-2-1234-5678', hours: 'Mo-Fr 09:00-18:00\nSa,Su 10:00-16:00', lat: '25.03', lng: '121.56', priceRange: '$$' });
    assert.deepEqual(r.errors, []); assert.equal(r.data['@type'], 'Restaurant'); assert.deepEqual(r.data.openingHours, ['Mo-Fr 09:00-18:00', 'Sa,Su 10:00-16:00']); assert.deepEqual(r.data.geo, { '@type': 'GeoCoordinates', latitude: 25.03, longitude: 121.56 });
    assert.equal(m.buildJsonLd('LocalBusiness', { name: 'N', street: 'S', city: 'C', country: 'Taiwan', tel: 'abc', hours: '週一 9-6', lat: '91' }).errors.length, 4);
    assert.ok(m.buildJsonLd('LocalBusiness', { subtype: 'x y', name: 'N', street: 'S', city: 'C', country: 'TW' }).data['@type'] === 'LocalBusiness'); assert.ok(m.buildJsonLd('Nope', {}).errors.length);
    // robots 產生
    r = m.buildRobots({ policy: 'custom', disallow: '/admin/\ncart\n/*?sid=', allow: '/admin/public/', sitemaps: 'https://a.com/sitemap.xml\nbad', crawlDelay: '5', blockAi: ['GPTBot', 'Evil'] });
    assert.equal(r.text, 'User-agent: *\nAllow: /admin/public/\nDisallow: /admin/\nDisallow: /cart\nDisallow: /*?sid=\nCrawl-delay: 5\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://a.com/sitemap.xml\n'); assert.equal(r.errors.length, 1);
    assert.equal(m.buildRobots({}).text, 'User-agent: *\nDisallow:\n'); assert.equal(m.buildRobots({ policy: 'block' }).text, 'User-agent: *\nDisallow: /\n'); assert.equal(m.buildRobots({ crawlDelay: 'x' }).errors.length, 1);
    // robots 解析 / 判斷
    const rb = 'User-agent: *\nDisallow: /admin/ # 後台\nAllow: /admin/public/\nDisallow: /*.pdf$\n\nUser-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /g\nSitemap: https://a.com/s.xml\n';
    let pr = m.parseRobots(rb); assert.equal(pr.groups.length, 2); assert.deepEqual(pr.groups[1].agents, ['Googlebot', 'Bingbot']); assert.equal(pr.groups[0].rules.length, 3); assert.deepEqual(pr.sitemaps, ['https://a.com/s.xml']); assert.equal(pr.issues[0].level, 'ok');
    const al = (ua, p) => m.robotsAllows(rb, ua, p).allowed;
    assert.ok(!al('Mozilla', '/admin/x') && al('Mozilla', '/admin/public/x') && al('Mozilla', '/') && !al('Mozilla', '/a.pdf') && al('Mozilla', '/a.pdf?x=1'));
    assert.ok(al('Googlebot', '/admin/x') && !al('Googlebot', '/g/1') && !al('Bingbot', '/g') && al('Googlebot-Image', '/admin/x') === true && !al('Googlebot-Image', '/g'));
    assert.equal(m.robotsAllows(rb, 'x', '/admin/x').rule.path, '/admin/'); assert.equal(m.robotsAllows('User-agent: *\nAllow: /a\nDisallow: /a', 'x', '/a').allowed, true);
    assert.equal(m.robotsAllows('', 'x', '/a').allowed, true); assert.equal(m.robotsAllows('User-agent: *\nDisallow:', 'x', '/a').allowed, true);
    pr = m.parseRobots('Disallow: /x\nUser-agent: *\nDisallow: admin\nNoindex: /n\nSitemap: /rel\nFoo: bar\ngarbage\nCrawl-delay: 3\nDisallow: /\nUser-agent: *\nHost: x');
    for (const [l, re] of [['bad', /User-agent 之前/], ['warn', /以 \//], ['warn', /Noindex/], ['bad', /Sitemap/], ['warn', /未知指令/], ['bad', /格式不對/], ['info', /Crawl-delay/], ['warn', /整個網站/], ['warn', /多個群組/], ['info', /Host/], ['info', /沒有 Sitemap/]]) assert.ok(lv(pr.issues, l, re), String(re));
    assert.ok(lv(m.parseRobots('').issues, 'warn', /沒有任何/)); assert.ok(lv(m.parseRobots('\ufeffUser-agent: *\nDisallow:').issues, 'info', /BOM/));
    // 往返：產生的 robots 檢查不該有錯誤
    assert.ok(!m.parseRobots(m.buildRobots({ policy: 'custom', disallow: '/a\n/b', sitemaps: 'https://a.com/s.xml', blockAi: ['CCBot'] }).text).issues.some(x => x.level === 'bad' || x.level === 'warn'));
    // sitemap
    let sm = m.buildSitemap('https://a.com/?a=1&b=2\nhttps://a.com/x 2026-01-02\nhttps://a.com/x\nhttps://a.com/中文\nhttps://b.com/\nnope', { lastmod: '2026-10-22', changefreq: 'weekly', priority: '0.8' });
    assert.equal(sm.count, 4); assert.equal(sm.errors.length, 1); assert.ok(sm.warns.some(x => /重複/.test(x)) && sm.warns.some(x => /主機/.test(x)));
    assert.ok(sm.xml.includes('<loc>https://a.com/?a=1&amp;b=2</loc>') && sm.xml.includes('<lastmod>2026-01-02</lastmod>') && sm.xml.includes('%E4%B8%AD%E6%96%87') && sm.xml.includes('<changefreq>weekly</changefreq>') && sm.xml.includes('<priority>0.8</priority>') && sm.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    sm = m.buildSitemap('https://a.com/?a=1&b=2\nhttps://a.com/p', {});
    let ps = m.parseSitemap(sm.xml); assert.equal(ps.kind, 'urlset'); assert.deepEqual(ps.urls.map(u => u.loc), ['https://a.com/?a=1&b=2', 'https://a.com/p']); assert.equal(ps.issues[0].level, 'ok');   // 往返
    assert.ok(m.buildSitemap('', {}).errors.length); assert.ok(m.buildSitemap('https://a.com', { lastmod: '2026/1/1' }).errors.length); assert.ok(m.buildSitemap('https://a.com', { priority: '2' }).errors.length); assert.ok(m.buildSitemap('https://a.com x', {}).errors.length);
    assert.ok(m.buildSitemap(new Array(50001).fill('https://a.com/x').join('\n'), {}).errors[0].includes('50000'));
    ps = m.parseSitemap('<urlset><url><loc>https://a.com/?a=1&b=2</loc><lastmod>bad</lastmod><changefreq>often</changefreq><priority>3</priority></url><url><loc>/rel</loc></url><url><lastmod>2026-01-01</lastmod></url><url><loc>https://a.com/?a=1&amp;b=2</loc></url><url><loc>https://a.com/?a=1&amp;b=2</loc></url></urlset>');
    for (const [l, re] of [['warn', /命名空間/], ['info', /宣告/], ['bad', /未跳脫的 &/], ['bad', /lastmod/], ['bad', /changefreq/], ['bad', /priority/], ['bad', /不是完整網址/], ['bad', /沒有 <loc>/], ['warn', /重複/]]) assert.ok(lv(ps.issues, l, re), String(re));
    assert.ok(lv(m.parseSitemap('<html></html>').issues, 'bad', /不是有效/)); assert.equal(m.parseSitemap('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>').kind, 'index');
    // slug
    assert.equal(m.slugify('Hello World & 你好！'), 'hello-world-and-你好'); assert.equal(m.slugify('Hello World & 你好！', { keepCjk: false }), 'hello-world-and');
    assert.equal(m.slugify('Café Münster'), 'cafe-munster'); assert.equal(m.slugify('ＡＢＣ　１２３'), 'abc-123'); assert.equal(m.slugify('  --A__B--  '), 'a-b'); assert.equal(m.slugify('A_B', { sep: '_' }), 'a_b');
    assert.equal(m.slugify('alpha beta gamma', { max: 10 }), 'alpha-beta'); assert.equal(m.slugify('alpha beta gamma', { max: 9 }), 'alpha'); assert.equal(m.slugify('abcdef', { max: 3 }), 'abc'); assert.equal(m.slugify('alpha beta', { max: 0 }), 'alpha-beta');
    assert.equal(m.slugify('Hello', { lower: false }), 'Hello'); assert.equal(m.slugify('!!!'), ''); assert.equal(m.slugify(''), ''); assert.equal(m.slugify(null), ''); assert.equal(m.slugify('你好', { keepCjk: false }), ''); assert.equal(m.slugify('日本語のタイトル'), '日本語のタイトル');
    assert.equal(m.slugify('a<script>"x"'), 'a-script-x'); assert.equal(m.slugify('a/b?c=d#e'), 'a-b-c-d-e');
    const sb = m.slugBatch('Same\nsame\nSame!\n!!!', {}); assert.deepEqual(sb.map(x => x.slug), ['same', 'same-2', 'same-3', '']); assert.ok(sb[3].warn);
    assert.equal(m.slugBatch('你好', {})[0].enc, 18);
    // UTM
    r = m.buildUtm('https://a.com/p?id=1#top', { source: 'LINE', medium: 'social', campaign: 'Spring Sale' });
    assert.equal(r.url, 'https://a.com/p?id=1&utm_source=line&utm_medium=social&utm_campaign=spring%20sale#top'); assert.ok(r.notes.some(x => /空白/.test(x))); assert.deepEqual(r.warns, []);
    assert.equal(m.buildUtm('https://a.com/p?x=1&UTM_Source=old&y=2', { source: 'new', medium: 'm' }).url, 'https://a.com/p?x=1&y=2&utm_source=new&utm_medium=m');
    r = m.buildUtm('https://a.com/p?utm_source=old&y=2', { source: 'new', medium: 'm' }, { overwrite: false }); assert.equal(r.url, 'https://a.com/p?utm_source=old&y=2&utm_medium=m'); assert.ok(r.notes[0].includes('保留'));
    assert.equal(m.buildUtm('https://a.com', { source: 'A B', medium: '' }, { lower: false }).url, 'https://a.com?utm_source=A%20B'); assert.ok(m.buildUtm('https://a.com', { source: 'a' }).warns.length === 2);
    assert.equal(m.buildUtm('https://a.com/?q=%E4%BD%A0%E5%A5%BD&a=1', { source: '你好', medium: 'x' }).url, 'https://a.com/?q=%E4%BD%A0%E5%A5%BD&a=1&utm_source=%E4%BD%A0%E5%A5%BD&utm_medium=x');
    assert.ok(m.buildUtm('a.com', { source: 'a' }).error); assert.ok(m.buildUtm('https://a.com', {}).error); assert.ok(m.buildUtm('javascript:alert(1)', { source: 'a' }).error);
    const ub = m.buildUtmBatch('https://a.com/1\nbad\n\nhttps://a.com/2#x', { source: 's', medium: 'm', campaign: 'c' }, {});
    assert.equal(ub.rows.length, 3); assert.equal(ub.rows[1].error.length > 0, true); assert.equal(ub.rows[1].line, 2); assert.equal(ub.rows[2].url, 'https://a.com/2?utm_source=s&utm_medium=m&utm_campaign=c#x');
    assert.ok(m.buildUtmBatch(new Array(501).fill('https://a.com').join('\n'), { source: 's' }, {}).error); assert.equal(m.buildUtmBatch(new Array(500).fill('https://a.com').join('\n'), { source: 's' }, {}).rows.length, 500);
    assert.deepEqual(m.buildUtmBatch('', { source: 's' }, {}).rows, []);
    ok('web-meta: og / json-ld / robots / sitemap / serp / slug / utm');
}
