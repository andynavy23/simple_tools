/* 頁面外框：套用使用者選的「風格 / 明暗」，並在右上角提供「說明」與「外觀」按鈕
 *
 * 使用：放在 <head>、theme.css 之後（要在畫面繪製前執行，才不會閃一下預設外觀）：
 *   <script src="../shared/js/chrome.js"></script>
 * 說明內容：頁面裡放一個 <template id="help">…</template>，內容用 <h3> 分段（這是什麼 / 什麼時候用 / 怎麼用 / 範例 / 小提醒），
 *   可用 <ul> <ol> <p> <kbd> 與 <div class="eg">（範例框）。有這個 template 才會出現「？」按鈕；第一次進入該頁會自動彈出一次。
 * 設定存在 localStorage：st_style（apple / neon / paper / forest / pixel）、st_mode（auto / light / dark）、st_help_seen。
 * 沒有 JS 時退回蘋果風格並跟隨系統明暗（見 theme.css）。
 */
(function () {
    'use strict';
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

    function init() {
        const s = document.createElement('style'); s.textContent = CSS; document.head.append(s);
        const themed = !!getComputedStyle(root).getPropertyValue('--card').trim();      // 沒用 theme.css 的頁面（楓之谷風格等）只提供說明按鈕
        if (!themed) s.textContent += '.st-bar,.st-panel,.st-help{--card:#fff;--text:#1d1d1f;--muted:#6e6e73;--fill:rgba(118,118,128,.14);--line:rgba(0,0,0,.12);--blue:#0071e3;--on-blue:#fff;--bg:#f5f5f7;--radius:16px;--radius-sm:10px;--btn-radius:980px;--font:system-ui,sans-serif;--head-font:system-ui,sans-serif;--head-weight:700}.st-help .primary{background:var(--blue);color:#fff}';
        bar = el('div', { class: 'st-bar' });
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

    window.Chrome = { STYLES, MODES, openHelp, get style() { return style; }, get mode() { return mode; }, setStyle(v) { style = v; set('st_style', v); apply(); }, setMode(v) { mode = v; set('st_mode', v); apply(); } };
})();
