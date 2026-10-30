// tests/solo-*.test.js、tests/new-*.test.js 的分片執行器：node tests/_unit_shard.js <第幾份> <共幾份>
// 檔案依名稱排序後，第 k 份跑 index % n === k 的檔案（與 tools.test.js 末段載入它們的方式相同，非同步測試等 _load.pending）。
const fs = require('fs'), path = require('path');
const [k, n] = [Number(process.argv[2]) || 0, Number(process.argv[3]) || 1];
const files = fs.readdirSync(__dirname).filter(x => /^(solo|new)-.*\.test\.js$/.test(x)).sort().filter((_, i) => i % n === k);
for (const f of files) require(path.join(__dirname, f));
Promise.all(require('./_load').pending).then(() => console.log(`SHARD ${k}/${n} OK（${files.length} 檔）`)).catch((e) => { console.error(e); process.exit(1); });
