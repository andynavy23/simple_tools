// 安靜的測試執行器：通過只印一行，失敗才印最後幾行輸出（測試是固定腳本，不需要把全部輸出讀一遍）。
//   node tests/run.mjs                 共用模組 + 工具單元測試（shared.test.js、tools.test.js 主體 + solo-* / new-* 分成數個並行工作）
//   node tests/run.mjs 頁名片段…        只跑「內容提到該片段」的單元測試與 e2e（例如 markdown-preview）
//   node tests/run.mjs --e2e           e2e 全部（tests/e2e/*.mjs，不含 lib / ios_audit / smoke / visual_audit（後者是找離群頁的稽核，手動跑））
//   node tests/run.mjs --ios [片段…]   iPhone 版面稽核（WebKit，有快取）
//   node tests/run.mjs --smoke [片段…] 全站煙霧測試（Edge）
//   node tests/run.mjs --all           全部（單元 + 強制全站 iPhone 稽核 + 煙霧 + 全部 e2e），通過時只印一行總結，失敗才印內容
// 單元測試與 e2e 都用有限並行（單元 SHARDS 個、e2e E2E_JOBS 個；每個 e2e 自己開獨立的 Edge），加 --serial 可改成一個一個跑（除錯時用）。
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
const dir = import.meta.dirname, e2eDir = path.join(dir, 'e2e');
const args = process.argv.slice(2), flags = args.filter(a => a.startsWith('--')), frags = args.filter(a => !a.startsWith('--'));
const TAIL = 14, QUIET = flags.includes('--all') || flags.includes('--quiet'), SERIAL = flags.includes('--serial');
const CPUS = os.cpus().length, SHARDS = SERIAL ? 1 : Math.max(2, Math.min(6, CPUS >> 1)), E2E_JOBS = SERIAL ? 1 : Math.max(1, Math.min(4, CPUS >> 2));

function run(file, extra = [], env = {}, retry = false) {
    return new Promise((resolve) => {
        const t0 = Date.now(), name = path.relative(dir, file) + (extra.length ? ' ' + extra.join(' ') : '');
        let out = '', done = false;
        const p = spawn(process.execPath, [file, ...extra], { cwd: path.resolve(dir, '..'), env: { ...process.env, ...env } });
        const timer = setTimeout(() => { out += '\n逾時（10 分鐘）'; p.kill(); }, 600000);
        for (const s of [p.stdout, p.stderr]) s.on('data', (d) => { out += d; if (out.length > 4e6) out = out.slice(-2e6); });
        const finish = (code) => {
            if (done) return; done = true; clearTimeout(timer);
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            if (code === 0) { if (!QUIET) console.log(`ok   ${name} (${secs}s)`); return resolve(true); }
            if (retry) { console.log(`RETRY ${name}（並行時失敗，單獨重跑一次）`); return resolve(run(file, extra, env, false).then((ok2) => { if (ok2) console.log(`FLAKY ${name}：重跑通過，並行負載下可能計時不穩`); return ok2; })); }
            console.log(`FAIL ${name} (${secs}s)\n  ` + out.trim().split('\n').filter(l => !/^ok /.test(l)).slice(-TAIL).join('\n  '));
            resolve(false);
        };
        p.on('close', finish); p.on('error', (e) => { out += String(e); finish(1); });
    });
}
// 同時最多 n 個，回傳全部結果
async function pool(tasks, n) {
    const res = new Array(tasks.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { for (let k; (k = i++) < tasks.length;) res[k] = await tasks[k](); }));
    return res;
}
const list = (d, re) => fs.readdirSync(d).filter(f => re.test(f)).map(f => path.join(d, f));
const E2E_SKIP = /^(lib|ios_audit|smoke|visual_audit|storage_fuzz)\.mjs$/;
const e2eFiles = () => list(e2eDir, /\.mjs$/).filter(f => !E2E_SKIP.test(path.basename(f)));
// 單元：shared、tools.test.js 主體（ST_NO_SOLO=1 跳過 solo-* / new-*）、以及 solo-* / new-* 分成 SHARDS 份並行
const unitTasks = () => [
    () => run(path.join(dir, 'shared.test.js')),
    () => run(path.join(dir, 'tools.test.js'), [], { ST_NO_SOLO: '1' }),
    ...Array.from({ length: SHARDS }, (_, k) => () => run(path.join(dir, '_unit_shard.js'), [String(k), String(SHARDS)])),
];
let results = [];

if (flags.includes('--all')) {
    // 單元（CPU 密集）先並行跑完，再跑需要瀏覽器的稽核與 e2e，避免互相搶 CPU 造成計時型測試不穩
    results.push(...await pool(unitTasks(), SHARDS + 2));
    results.push(await run(path.join(e2eDir, 'ios_audit.mjs'), ['--all']));
    results.push(await run(path.join(e2eDir, 'smoke.mjs')));
    results.push(...await pool(e2eFiles().map(f => () => run(f, [], {}, !SERIAL)), E2E_JOBS));
} else if (flags.includes('--ios')) results.push(await run(path.join(e2eDir, 'ios_audit.mjs'), frags));
else if (flags.includes('--smoke')) results.push(await run(path.join(e2eDir, 'smoke.mjs'), frags));
else if (flags.includes('--e2e') && !frags.length) results.push(...await pool(e2eFiles().map(f => () => run(f, [], {}, !SERIAL)), E2E_JOBS));
else if (frags.length) {
    const mentions = (f) => { const s = fs.readFileSync(f, 'utf8'); return frags.some(x => s.includes(x)); };
    const files = [...list(dir, /\.test\.js$/).filter(f => !/tools\.test\.js$/.test(f)), ...e2eFiles()].filter(mentions);
    if (!files.length) console.log('沒有測試檔提到：' + frags.join('、') + '（可用 --ios / --smoke 做版面與載入檢查）');
    results.push(...await pool(files.map(f => () => run(f, [], {}, !SERIAL)), E2E_JOBS));
} else results.push(...await pool(unitTasks(), SHARDS + 2));

const bad = results.filter(r => !r).length;
console.log(results.length ? `${results.length - bad}/${results.length} 通過` : '');
process.exit(bad ? 1 : 0);
