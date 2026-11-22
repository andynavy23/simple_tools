// sitemap.xml / robots.txt 與 index.html 卡片一致（不一致時跑 node tests/gen-sitemap.js）
const { ok, read } = require('./_load');
const assert = require('assert');
const { build } = require('./gen-sitemap');
assert.equal(read('sitemap.xml').replace(/\r\n/g, '\n'), build(), 'sitemap.xml 過期：請執行 node tests/gen-sitemap.js');
assert.ok(!read('sitemap.xml').includes('stealth-reader'), 'noindex 頁不該在 sitemap');
assert.match(read('robots.txt'), /Allow: \/\n[\s\S]*Sitemap: https:\/\/andynavy23\.github\.io\/simple_tools\/sitemap\.xml/);
ok('sitemap.xml / robots.txt 與首頁卡片一致');
