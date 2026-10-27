// 真實瀏覽器測試共用：啟動 Edge（獨立暫存設定檔 + 下載導到暫存資料夾）、結束時整個暫存目錄刪除。
// 不要直接用 puppeteer.launch：預設會把測試下載的檔案丟進使用者的「下載」資料夾，而且留下殘留的 Edge 視窗。
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const repo = path.resolve(import.meta.dirname, '..', '..');
export const pageUrl = (rel) => 'file:///' + repo.replace(/\\/g, '/') + '/' + rel;
const EDGES = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'];

export async function launchEdge(extraArgs = []) {
    const executablePath = EDGES.find(p => fs.existsSync(p));
    if (!executablePath) throw new Error('找不到 Edge');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-e2e-'));
    // Edge 的啟動程序會立刻結束（puppeteer.launch 會誤判失敗），所以自己啟動再用除錯埠連線
    const port = 9300 + Math.floor(Math.random() * 600);
    spawn(executablePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(tmp, 'profile')}`, '--disable-extensions', '--no-first-run', '--enable-automation', '--force-prefers-no-reduced-motion', ...extraArgs, 'about:blank'], { stdio: 'ignore', detached: true }).unref();
    let browser;
    for (let i = 0; i < 50 && !browser; i++) {
        try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null }); } catch { await new Promise(r => setTimeout(r, 200)); }
    }
    if (!browser) throw new Error('連不上 Edge');
    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(tmp, 'dl') });
    let closed = false;
    const cleanup = () => { try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* 暫存而已 */ } };
    // 測試中途失敗（斷言丟例外）時沒機會走 browser.close()：行程結束前強制關掉這個暫存設定檔對應的 Edge，免得留下殘留視窗
    process.once('exit', () => {
        if (!closed) {
            try { execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(tmp)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', timeout: 15000 }); } catch { /* 盡力而為 */ }
        }
        cleanup();
    });
    browser.close = async () => {                         // 送 Browser.close 讓 Edge 正常結束，否則會留下殘留視窗
        if (closed) return; closed = true;
        try { await cdp.send('Browser.close'); } catch { /* 已經關了 */ }
        await new Promise(r => setTimeout(r, 400)); cleanup();
    };
    browser.downloadDir = path.join(tmp, 'dl');
    return browser;
}

// 取得頁面（手機 390×844 + 觸控），收集未捕捉的例外與本機資源 404
export async function openPage(browser, rel, { mobile = true } = {}) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('例外：' + String(e.message).slice(0, 120)));
    page.on('requestfailed', r => { if (r.url().startsWith('file:') && !r.url().endsWith('.webmanifest')) errors.push('資源載入失敗：' + r.url().split('/').pop()); });
    page.on('dialog', d => d.dismiss().catch(() => { }));
    if (mobile) await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(pageUrl(rel) + '#a', { waitUntil: 'load' });       // #a：不自動彈出說明
    return { page, errors };
}
