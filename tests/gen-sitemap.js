// 產生 sitemap.xml：首頁 + index.html 所有卡片連到的工具頁（有 noindex meta 的頁面不列）。
//   node tests/gen-sitemap.js     重新產生（新增 / 刪除 / 改名頁面後要跑）
// 網址取自 index.html 的 canonical。tests/new-sitemap.test.js 會檢查 sitemap.xml 與此輸出一致。
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function build() {
    const html = rd('index.html');
    const base = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const hrefs = [...html.matchAll(/<a class="card" href="([^"]+)"/g)].map(m => m[1])
        .filter(h => !/<meta name="robots" content="[^"]*noindex/.test(rd(h)));
    const urls = [base, ...hrefs.map(h => base + h)];
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + urls.map(u => `  <url><loc>${u}</loc></url>\n`).join('') + '</urlset>\n';
}

module.exports = { build };
if (require.main === module) {
    fs.writeFileSync(path.join(root, 'sitemap.xml'), build());
    const base = rd('index.html').match(/<link rel="canonical" href="([^"]+)"/)[1];
    fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`);
    console.log('已寫入 sitemap.xml、robots.txt');
}
