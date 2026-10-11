// Simple Tools service worker：預快取首頁與共用檔，其餘同源 GET 用 stale-while-revalidate（先給快取、背景更新，下次載入就是新版）。
// 不處理跨來源請求（PeerJS CDN 等）與非 GET。改動快取行為時請調高 CACHE_VERSION（首頁 index.html 裡的 SW_CACHE 要同步）。
const CACHE_VERSION = 'v1';
const CACHE = 'st-' + CACHE_VERSION;
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'shared/css/theme.css', 'shared/css/maple.css', 'shared/js/chrome.js', 'shared/js/util.js', 'shared/js/p2p-room.js', 'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('st-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 內容是否變了：比 ETag / Last-Modified / Content-Length（沒有任何標頭就當作沒變，不打擾）
const sig = (r) => r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '';
const changed = (a, b) => { const x = sig(a), y = sig(b); return !!x && !!y && x !== y; };

self.addEventListener('fetch', (e) => {
    const r = e.request, u = new URL(r.url);
    if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
    e.respondWith(swr(e, r, u));
});

async function swr(e, r, u) {
    const cache = await caches.open(CACHE);
    let key = r.url;
    if (r.mode === 'navigate') { u.search = ''; key = u.href; }      // 頁面的 ?room=… 之類參數不另存一份
    const hit = await cache.match(key);
    const net = fetch(r.url, { cache: 'no-cache' }).then(async (resp) => {
        if (resp.ok && resp.status === 200) {
            await cache.put(key, resp.clone());
            // 稍等一下再通知：剛重新載入的頁面還要一點時間才算「已建立的 client」，太早送會漏掉
            if (hit && changed(hit, resp)) e.waitUntil(new Promise(ok => setTimeout(ok, 1200)).then(() => self.clients.matchAll({ type: 'window' })).then(cs => cs.forEach(c => c.postMessage({ type: 'st-updated', url: r.url }))));
        }
        return resp;
    });
    if (hit) { e.waitUntil(net.catch(() => { })); return hit; }
    try { return await net; } catch (err) {
        // 沒下載過的頁面：給一個說明頁（不能直接回首頁，相對路徑會對不上）
        if (r.mode === 'navigate') return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>離線中</title><body style="font:16px/1.6 system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 20px;text-align:center"><h1>離線中</h1><p>這個頁面還沒有存進離線快取，需要網路才能開啟。</p><p><a href="${self.registration.scope}">回首頁</a>（首頁可以按「下載全部工具供離線使用」）</p>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        throw err;
    }
}
