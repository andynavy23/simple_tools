/* 頁面外框：套用使用者選的「風格 / 明暗」，並在右上角提供「說明」與「外觀」按鈕
 *
 * 使用：放在 <head>、theme.css 之後（要在畫面繪製前執行，才不會閃一下預設外觀）：
 *   <script src="../shared/js/chrome.js"></script>
 * 說明內容：頁面裡放一個 <template id="help">…</template>，內容用 <h3> 分段（這是什麼 / 什麼時候用 / 怎麼用 / 範例 / 小提醒），
 *   可用 <ul> <ol> <p> <kbd> 與 <div class="eg">（範例框）。有這個 template 才會出現「？」按鈕；第一次進入該頁會自動彈出一次。
 * 設定存在 localStorage：st_style（apple / neon / paper / forest / pixel）、st_mode（auto / light / dark）、st_help_seen。
 * 資料備份：頁面若有寫入 localStorage，必須在 <head> 宣告 <meta name="st-keys" content="鍵1,鍵2,前綴_*">（動態鍵用 * 結尾的前綴；
 *   首頁用 content="*" 代表全站）。有宣告就會出現「💾」按鈕，可匯出 / 載入 JSON 備份（換瀏覽器、清除網站資料前先匯出）。
 *   載入時只會寫入符合宣告的鍵（首頁的全站備份例外），並會先讓使用者確認。
 * 沒有 JS 時退回蘋果風格並跟隨系統明暗（見 theme.css）。
 */
(function () {
    'use strict';

    // ---------- 備份 / 還原（純函式，tests 會在 node 載入）----------
    const KEY_OK = /^[^\u0000-\u001f]{1,200}$/;
    // spec：鍵名清單；'*' = 全部；'前綴*' = 該前綴開頭的所有鍵。回傳 (key) => 是否屬於這個範圍
    function matcher(spec) {
        const exact = new Set(), prefixes = []; let all = false;
        for (const p of spec) { if (p === '*') all = true; else if (p.endsWith('*')) prefixes.push(p.slice(0, -1)); else if (p) exact.add(p); }
        return (k) => typeof k === 'string' && KEY_OK.test(k) && (all || exact.has(k) || prefixes.some(x => k.startsWith(x)));
    }
    function buildBackup(match, storage, scope, now = new Date()) {
        const data = {};
        for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (match(k)) data[k] = storage.getItem(k); }
        return { app: 'simple_tools', v: 1, scope, exportedAt: now.toISOString(), data };
    }
    // 讀備份檔文字：回傳 { ok:true, items:{鍵:字串值}, skipped, scope, exportedAt } 或 { ok:false, error }
    function parseBackup(text, match, maxTotal = 4500000) {
        if (typeof text !== 'string' || !text.trim()) return { ok: false, error: '檔案是空的' };
        if (text.length > 6000000) return { ok: false, error: '檔案太大（超過 6 MB），不像是這個工具箱的備份' };
        let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: '這不是有效的備份檔（不是 JSON）' }; }
        if (!o || typeof o !== 'object' || o.app !== 'simple_tools') return { ok: false, error: '這不是 Simple Tools 的備份檔' };
        if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return { ok: false, error: '備份檔內容格式不對（缺少 data）' };
        const items = {}; let skipped = 0, total = 0;
        for (const [k, v] of Object.entries(o.data)) {
            if (typeof v !== 'string' || v.length > 2000000 || !match(k)) { skipped++; continue; }
            total += k.length + v.length; if (total > maxTotal) return { ok: false, error: '備份內容太大，瀏覽器放不下' };
            items[k] = v;
        }
        return { ok: true, items, skipped, scope: typeof o.scope === 'string' ? o.scope.slice(0, 80) : '', exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt.slice(0, 40) : '' };
    }
    const fmtBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
    if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = { matcher, buildBackup, parseBackup, fmtBytes }; return; }

    const STYLES = [
        ['apple', '簡約', '#0071e3', '#f5f5f7'],
        ['neon', '霓虹', '#00b7ff', '#12142a'],
        ['paper', '紙本', '#b5532b', '#f3ead7'],
        ['forest', '森林', '#2f8f4e', '#e6f0df'],
        ['pixel', '像素', '#e63946', '#f1e5c3'],
    ];
    const MODES = [['auto', '自動'], ['light', '淺色'], ['dark', '深色']];
    const root = document.documentElement;
    const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (e) { return d; } };
    const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕或被封鎖：這次有效就好 */ } };
    const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

    let style = get('st_style', 'apple'); if (!STYLES.some(s => s[0] === style)) style = 'apple';
    let mode = get('st_mode', 'auto'); if (!MODES.some(m => m[0] === mode)) mode = 'auto';

    function apply() {
        const dark = mode === 'dark' || (mode === 'auto' && mq && mq.matches);
        root.setAttribute('data-ui-style', style);
        root.setAttribute('data-ui-mode', dark ? 'dark' : 'light');
        let meta = document.querySelector('meta[name=theme-color]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
        requestAnimationFrame(() => { meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#f5f5f7'; });
    }
    apply();
    if (mq) (mq.addEventListener ? mq.addEventListener('change', () => { if (mode === 'auto') apply(); }) : mq.addListener(() => { if (mode === 'auto') apply(); }));

    const CSS = `
.st-bar{position:fixed;top:max(8px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:60;display:flex;gap:6px}
.st-bar button{width:38px;height:38px;min-height:0;padding:0;display:grid;place-items:center;font-size:17px;line-height:1;border-radius:var(--btn-radius);background:var(--card);color:var(--text);border:var(--btn-border);box-shadow:0 1px 6px rgba(0,0,0,.18),var(--btn-shadow)}
.st-bar button[aria-expanded=true]{background:var(--text);color:var(--bg)}
.st-panel{position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 46px);right:max(10px,env(safe-area-inset-right));z-index:60;width:min(300px,calc(100vw - 20px));padding:14px;background:var(--card);color:var(--text);border:var(--card-border);border-radius:var(--radius);box-shadow:0 8px 30px rgba(0,0,0,.28),var(--card-shadow);font:14px/1.4 var(--font)}
.st-panel h4{margin:0 0 8px;font:var(--head-weight) 13px/1.3 var(--head-font);color:var(--muted)}
.st-panel .st-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px}
.st-panel .st-row.m{grid-template-columns:repeat(3,1fr);margin-bottom:0}
.st-sw{display:grid;gap:4px;justify-items:center;padding:6px 2px;min-height:0;font-size:12px;border-radius:var(--radius-sm);background:var(--fill);color:var(--text);border:2px solid transparent}
.st-sw i{display:block;width:26px;height:26px;border-radius:50%;border:2px solid var(--line);background:linear-gradient(135deg,var(--a) 50%,var(--b) 50%)}
.st-sw[aria-pressed=true]{background:var(--fill);color:var(--text);border-color:var(--blue)}
.st-md{min-height:0;padding:8px 4px;font-size:13px;border-radius:var(--radius-sm)}
.st-help{width:min(600px,94vw);max-height:86vh;padding:0;border:var(--card-border);border-radius:var(--radius);background:var(--card);color:var(--text);box-shadow:0 12px 40px rgba(0,0,0,.4),var(--card-shadow);font:15px/1.65 var(--font)}
.st-help::backdrop{background:rgba(0,0,0,.5)}
.st-help header{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:var(--card);border-bottom:1px solid var(--line)}
.st-help header b{font:var(--head-weight) 17px/1.3 var(--head-font)}
.st-help header button{width:36px;height:36px;min-height:0;padding:0;font-size:16px}
.st-help .st-body{padding:4px 18px 10px;overflow-wrap:anywhere}
.st-help h3{margin:18px 0 6px;font:var(--head-weight) 15px/1.4 var(--head-font);color:var(--blue)}
.st-help p,.st-help ul,.st-help ol{margin:6px 0}
.st-help ul,.st-help ol{padding-left:22px}
.st-help li{margin:3px 0}
.st-help .eg{margin:8px 0;padding:10px 12px;border-radius:var(--radius-sm);background:var(--fill);font-size:14px;white-space:pre-wrap}
.st-help kbd{padding:1px 6px;border-radius:5px;border:1px solid var(--line);background:var(--fill);font:12px ui-monospace,Menlo,Consolas,monospace}
.st-help footer{position:sticky;bottom:0;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;background:var(--card);border-top:1px solid var(--line)}
.st-data p{margin:8px 0}
.st-data .st-btns{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.st-data .st-msg{min-height:1.4em;font-size:14px;margin:8px 0 0}
.st-data .st-msg.bad{color:var(--bad)}
.st-data .st-msg.ok{color:var(--ok)}
.st-help footer label{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)}
@media (max-width:600px){.st-help{width:100vw;max-width:100vw;max-height:92vh;margin:auto auto 0;border-bottom-left-radius:0;border-bottom-right-radius:0}}
`;

    function el(tag, attrs, ...kids) {
        const e = document.createElement(tag);
        for (const k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else if (k.startsWith('on')) e[k] = attrs[k]; else e.setAttribute(k, attrs[k]); }
        e.append(...kids); return e;
    }

    let panel = null, bar = null, dlg = null;
    const tpl = () => document.getElementById('help');

    function renderPanel() {
        panel.replaceChildren(
            el('h4', { text: '風格' }),
            el('div', { class: 'st-row' }, ...STYLES.map(([id, name, a, b]) => {
                const sw = el('button', { class: 'st-sw', type: 'button', 'aria-pressed': String(id === style), style: `--a:${a};--b:${b}` }, el('i'), name);
                sw.onclick = () => { style = id; set('st_style', id); apply(); renderPanel(); };
                return sw;
            })),
            el('h4', { text: '明暗' }),
            el('div', { class: 'st-row m' }, ...MODES.map(([id, name]) => {
                const b = el('button', { class: 'st-md', type: 'button', 'aria-pressed': String(id === mode), text: name });
                b.onclick = () => { mode = id; set('st_mode', id); apply(); renderPanel(); };
                return b;
            })),
        );
    }
    function togglePanel(force) {
        const open = force !== undefined ? force : panel.hidden;
        panel.hidden = !open; bar.querySelector('.st-theme').setAttribute('aria-expanded', String(open));
        if (open) renderPanel();
    }

    function openHelp(auto) {
        const t = tpl(); if (!t) return;
        if (!dlg) {
            dlg = el('dialog', { class: 'st-help', 'aria-labelledby': 'st-help-title' });
            dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });       // 點背景關閉
            document.body.append(dlg);
        }
        const title = (document.querySelector('h1') || document.querySelector('title') || {}).textContent || document.title;
        const close = el('button', { type: 'button', 'aria-label': '關閉說明', text: '✕' }); close.onclick = () => dlg.close();
        const done = el('button', { type: 'button', class: 'primary', text: '知道了' }); done.onclick = () => dlg.close();
        dlg.replaceChildren(
            el('header', null, el('b', { id: 'st-help-title', text: title.trim() + ' 使用說明' }), close),
            el('div', { class: 'st-body' }, t.content.cloneNode(true)),
            el('footer', null, el('span', { class: 'muted', style: 'font-size:13px', text: '右上角「？」可以再次開啟' }), done),
        );
        const seen = get('st_help_seen', {}); seen[location.pathname] = 1; set('st_help_seen', seen);
        if (!dlg.open) dlg.showModal();
        dlg.querySelector('.st-body').scrollTop = 0;
    }

    // ---------- 資料備份 ----------
    const metaKeys = () => { const m = document.querySelector('meta[name="st-keys"]'); return m ? m.content.split(',').map(x => x.trim()).filter(Boolean) : null; };
    let ddlg = null;
    function openData() {
        const spec = metaKeys(); if (!spec) return;
        const match = matcher(spec), all = spec.includes('*'), scope = all ? 'all' : location.pathname.split('/').slice(-2).join('/');
        if (!ddlg) { ddlg = el('dialog', { class: 'st-help st-data', 'aria-labelledby': 'st-data-title' }); ddlg.addEventListener('click', (e) => { if (e.target === ddlg) ddlg.close(); }); document.body.append(ddlg); }
        const title = all ? '全站資料備份' : ((document.querySelector('h1') || {}).textContent || document.title).trim() + ' 的資料';
        const count = () => { const b = buildBackup(match, localStorage, scope); const keys = Object.keys(b.data); return { n: keys.length, bytes: keys.reduce((a, k) => a + k.length + b.data[k].length, 0) }; };
        const msg = el('div', { class: 'st-msg', role: 'status' }), info = el('p');
        const refresh = () => { const c = count(); info.textContent = c.n ? `目前有 ${c.n} 項資料（約 ${fmtBytes(c.bytes)}）存在這個瀏覽器。` : '目前這個瀏覽器裡還沒有資料。'; };
        const say = (t, cls) => { msg.textContent = t; msg.className = 'st-msg ' + (cls || ''); };
        const file = el('input', { type: 'file', accept: '.json,application/json', hidden: '', 'aria-label': '選擇備份檔' });
        const exp = el('button', { type: 'button', class: 'primary', text: '匯出備份' });
        const imp = el('button', { type: 'button', text: '載入備份' });
        exp.onclick = () => {
            const b = buildBackup(match, localStorage, scope);
            if (!Object.keys(b.data).length) { say('目前沒有資料可以匯出。', 'bad'); return; }
            const d = new Date(), stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
            const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' })), download: `simple-tools-${all ? 'all' : scope.replace(/\.html$/, '').replace(/\//g, '-')}-${stamp}.json` });
            document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            say(`已匯出 ${Object.keys(b.data).length} 項資料。請把檔案收好，之後在新的瀏覽器「載入備份」即可還原。`, 'ok');
        };
        imp.onclick = () => file.click();
        file.onchange = async () => {
            const f = file.files[0]; file.value = ''; if (!f) return;
            if (f.size > 6000000) { say('檔案太大，不像是備份檔。', 'bad'); return; }
            const r = parseBackup(await f.text(), match);
            if (!r.ok) { say(r.error, 'bad'); return; }
            const n = Object.keys(r.items).length;
            if (!n) { say('這個備份裡沒有屬於這裡的資料' + (r.skipped ? `（略過 ${r.skipped} 項其他工具的資料）` : '') + '。', 'bad'); return; }
            const when = r.exportedAt ? `（備份時間 ${r.exportedAt.slice(0, 16).replace('T', ' ')}）` : '';
            if (!confirm(`要載入 ${n} 項資料嗎？${when}\n同名的資料會被備份內容覆蓋，無法復原。` + (r.skipped ? `\n（另有 ${r.skipped} 項不屬於這裡，會略過）` : ''))) { say('已取消。'); return; }
            try { for (const [k, v] of Object.entries(r.items)) localStorage.setItem(k, v); }
            catch (e) { say('寫入失敗（瀏覽器儲存空間不足或被封鎖）：' + e.message, 'bad'); return; }
            say(`已還原 ${n} 項資料，即將重新載入…`, 'ok'); setTimeout(() => location.reload(), 900);
        };
        const close = el('button', { type: 'button', 'aria-label': '關閉', text: '✕' }); close.onclick = () => ddlg.close();
        const done = el('button', { type: 'button', class: 'primary', text: '關閉' }); done.onclick = () => ddlg.close();
        refresh();
        ddlg.replaceChildren(
            el('header', null, el('b', { id: 'st-data-title', text: title + '：備份與還原' }), close),
            el('div', { class: 'st-body' },
                el('p', { text: all ? '把所有工具的資料（記帳、待辦、設定、最佳紀錄……）一次存成一個檔案。' : '這個工具的資料只存在這個瀏覽器。換瀏覽器、換手機或清除網站資料之前，請先匯出備份。' }),
                info,
                el('div', { class: 'st-btns' }, exp, imp, file),
                msg,
                el('h3', { text: '怎麼搬到新的瀏覽器？' }),
                el('ol', null, el('li', { text: '在舊的瀏覽器按「匯出備份」，得到一個 .json 檔。' }), el('li', { text: '把檔案傳到新的裝置（雲端硬碟、通訊軟體、隨身碟都可以）。' }), el('li', { text: '在新的瀏覽器開同一個頁面，按「載入備份」選那個檔案。' })),
                el('p', { class: 'muted', style: 'font-size:13px', text: '備份檔是純文字，裡面可能有你的個人紀錄，請自己保管。載入時只會寫入屬於這裡的資料。' })),
            el('footer', null, el('span'), done));
        if (!ddlg.open) ddlg.showModal();
    }

    function init() {
        const s = document.createElement('style'); s.textContent = CSS; document.head.append(s);
        const themed = !!getComputedStyle(root).getPropertyValue('--card').trim();      // 沒用 theme.css 的頁面（楓之谷風格等）只提供說明按鈕
        if (!themed) s.textContent += '.st-bar,.st-panel,.st-help{--card:#fff;--text:#1d1d1f;--muted:#6e6e73;--fill:rgba(118,118,128,.14);--line:rgba(0,0,0,.12);--blue:#0071e3;--on-blue:#fff;--bg:#f5f5f7;--radius:16px;--radius-sm:10px;--btn-radius:980px;--font:system-ui,sans-serif;--head-font:system-ui,sans-serif;--head-weight:700}.st-help .primary{background:var(--blue);color:#fff}';
        bar = el('div', { class: 'st-bar' });
        if (metaKeys()) { const d = el('button', { type: 'button', class: 'st-databtn', 'aria-label': '資料備份與還原', title: '資料備份與還原', text: '💾' }); d.onclick = () => openData(); bar.append(d); }
        if (tpl()) { const h = el('button', { type: 'button', class: 'st-helpbtn', 'aria-label': '使用說明', title: '使用說明', text: '？' }); h.onclick = () => openHelp(false); bar.append(h); }
        const th = el('button', { type: 'button', class: 'st-theme', 'aria-label': '外觀：風格與明暗', title: '外觀', 'aria-expanded': 'false', text: '🎨' }); th.onclick = () => togglePanel();
        if (themed) bar.append(th);
        panel = el('div', { class: 'st-panel', hidden: '' });
        document.body.append(bar, panel);
        document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && !th.contains(e.target)) togglePanel(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) togglePanel(false); });
        // 第一次進入自動彈出一次；自動化測試（webdriver）與帶房號的邀請連結（#...）不彈，以免擋住操作
        if (tpl() && !navigator.webdriver && !location.hash && !get('st_help_seen', {})[location.pathname]) setTimeout(() => openHelp(true), 500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

    window.Chrome = { STYLES, MODES, openHelp, openData, matcher, buildBackup, parseBackup, get style() { return style; }, get mode() { return mode; }, setStyle(v) { style = v; set('st_style', v); apply(); }, setMode(v) { mode = v; set('st_mode', v); apply(); } };
})();
