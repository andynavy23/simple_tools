// 測試共用工具：從頁面的 `// --- pure ---` 區塊取出純邏輯來執行（給 tests/solo-*.test.js 用；tools.test.js 內有同樣的一份）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.Util = global.Util || require(path.join(root, 'shared/js/util.js'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const PRELUDE = 'const { rnd, shuffle, store, copyText, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex, seeded, parseCSV, toObjects, isNum, csvStringify } = Util;\n';
const load = (file, names, from = '// --- pure ---', to = '// --- /pure ---') => {
    const h = read(file);
    return new Function(PRELUDE + h.slice(h.indexOf(from), h.indexOf(to)) + `; return { ${names} };`)();
};
const ok = (name) => console.log('ok  ' + name);
const near = (a, b, eps = 1e-6) => require('assert').ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} !~ ${b}`);
module.exports = { load, read, ok, near, root, pending: [] };
