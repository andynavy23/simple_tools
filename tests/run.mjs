// 安靜的測試執行器：通過只印一行，失敗才印最後幾行輸出（測試是固定腳本，不需要把全部輸出讀一遍）。
//   node tests/run.mjs                 共用模組 + 工具單元測試（shared.test.js、tools.test.js；後者已含 solo-* / new-*）
//   node tests/run.mjs 頁名片段…        只跑「內容提到該片段」的單元測試與 e2e（例如 markdown-preview）
//   node tests/run.mjs --e2e           e2e 全部（tests/e2e/*.mjs，不含 lib / ios_audit / smoke）
//   node tests/run.mjs --ios [片段…]   iPhone 版面稽核（WebKit，有快取）
//   node tests/run.mjs --smoke [片段…] 全站煙霧測試（Edge）
//   node tests/run.mjs --all           全部（單元 + 強制全站 iPhone 稽核 + 煙霧 + 全部 e2e），通過時只印一行總結，失敗才印內容
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
const dir = import.meta.dirname, e2eDir = path.join(dir, 'e2e');
const args = process.argv.slice(2), flags = args.filter(a => a.startsWith('--')), frags = args.filter(a => !a.startsWith('--'));
const TAIL = 14, QUIET = flags.includes('--all') || flags.includes('--quiet');

function run(file, extra = []) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [file, ...extra], { encoding: 'utf8', cwd: path.resolve(dir, '..'), maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
    const secs = ((Date.now() - t0) / 1000).toFixed(1), name = path.relative(dir, file);
    if (r.status === 0) { if (!QUIET) console.log(`ok   ${name} (${secs}s)`); return true; }
    const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter(l => !/^ok /.test(l));
    console.log(`FAIL ${name} (${secs}s)\n  ` + out.slice(-TAIL).join('\n  '));
    return false;
}
const list = (d, re) => fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
const E2E_SKIP = /^(lib|ios_audit|smoke)\.mjs$/;
let results = [];

if (flags.includes('--all')) {
    for (const f of ['shared.test.js', 'tools.test.js']) results.push(run(path.join(dir, f)));
    results.push(run(path.join(e2eDir, 'ios_audit.mjs'), ['--all']));
    results.push(run(path.join(e2eDir, 'smoke.mjs')));
    for (const f of list(e2eDir, /\.mjs$/).filter(f => !E2E_SKIP.test(path.basename(f)))) results.push(run(f));
} else if (flags.includes('--ios')) results.push(run(path.join(e2eDir, 'ios_audit.mjs'), frags));
else if (flags.includes('--smoke')) results.push(run(path.join(e2eDir, 'smoke.mjs'), frags));
else if (flags.includes('--e2e') && !frags.length) for (const f of list(e2eDir, /\.mjs$/).filter(f => !E2E_SKIP.test(path.basename(f)))) results.push(run(f));
else if (frags.length) {
    const mentions = (f) => { const s = fs.readFileSync(f, 'utf8'); return frags.some(x => s.includes(x)); };
    const files = [...list(dir, /\.test\.js$/).filter(f => !/tools\.test\.js$/.test(f)), ...list(e2eDir, /\.mjs$/).filter(f => !E2E_SKIP.test(path.basename(f)))].filter(mentions);
    if (!files.length) console.log('沒有測試檔提到：' + frags.join('、') + '（可用 --ios / --smoke 做版面與載入檢查）');
    for (const f of files) results.push(run(f));
} else for (const f of ['shared.test.js', 'tools.test.js']) results.push(run(path.join(dir, f)));

const bad = results.filter(r => !r).length;
console.log(results.length ? `${results.length - bad}/${results.length} 通過` : '');
process.exit(bad ? 1 : 0);
