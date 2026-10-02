/* 共用小工具：均勻亂數 / 洗牌 / 複製 / localStorage / HTML 跳脫 / 日期字串 / 統計列 / 提示音 / 語音 / 名單解析 / 下載檔案 / 雜湊與隨機字串
 *
 * 使用：<script src="../shared/js/util.js"></script>，然後 const { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex } = Util;
 * 放進這裡的條件：至少兩個工具在用、且不需要各工具再調整格式。
 */
(function (root) {
    'use strict';

    // HTML 跳脫（& < > " '）：把使用者輸入放進 innerHTML 前使用
    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // 日期字串（YYYY-MM-DD）工具：以 UTC 日數計算，不受夏令時間影響
    const day = {
        today: () => new Date().toLocaleDateString('sv'), // 本機日期
        ymd: (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        parse(s) { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; },
        num(s) { const { y, m, d } = day.parse(s); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); },
        between: (from, to) => day.num(to) - day.num(from),
        shift(s, n) { const t = new Date((day.num(s) + n) * 864e5); return day.ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); },
    };

    // 提示音：共用同一個 AudioContext（瀏覽器限制同時數量）；需在使用者操作後才發得出聲音
    let audioCtx = null;
    function tone(freq, ms = 200, { vol = 0.15, type = 'sine', delay = 0 } = {}) {
        try {
            const AC = root.AudioContext || root.webkitAudioContext;
            if (!AC) return;
            audioCtx = audioCtx || new AC();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const t = audioCtx.currentTime + delay / 1000, o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = type; o.frequency.value = freq;
            o.connect(g); g.connect(audioCtx.destination);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
            o.start(t); o.stop(t + ms / 1000);
        } catch (e) { /* 沒有聲音就算了 */ }
    }

    // 時間到的提醒：連響數聲 + 手機振動
    function beep(times = 3) {
        for (let i = 0; i < times; i++) tone(880, 200, { delay: i * 250 });
        try { if (root.navigator && navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { }
    }

    // 語音提醒（不支援的瀏覽器直接略過）
    function speak(text, { lang = 'zh-TW', rate = 1.2 } = {}) {
        try {
            if (!root.speechSynthesis) return;
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang; u.rate = rate;
            root.speechSynthesis.speak(u);
        } catch (e) { }
    }

    // 名單解析：換行、逗號、頓號分隔，去掉空白與空項
    const parseNames = (text) => String(text).split(/[\n,，、]/).map(s => s.trim()).filter(Boolean);

    // 下載：blob 為 Blob 物件；檔名由呼叫端決定
    function download(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // 雜湊（十六進位字串）：algo 為 SHA-1 / SHA-256 / SHA-384 / SHA-512；需要 crypto.subtle（https 或 localhost）
    async function sha256(text, algo = 'SHA-256') {
        const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 安全隨機的十六進位字串（bytes 個位元組 = 2 倍長度），用來當雜湊承諾的鹽
    const randomHex = (bytes = 16) => [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');

    // 統計列：左邊說明、右邊數值（樣式見 theme.css 的 .li.stat）；cls 加在數值上
    function statRow(label, value, cls) {
        const row = document.createElement('div'), l = document.createElement('span'), v = document.createElement('b');
        row.className = 'li stat';
        l.textContent = label; v.textContent = value;
        if (cls) v.className = cls;
        row.append(l, v);
        return row;
    }

    // 取 [0, n) 的均勻亂數：crypto + 拒絕取樣，避免「取餘數」造成的偏差
    function rnd(n) {
        const lim = Math.floor(2 ** 32 / n) * n;
        let x;
        do { x = crypto.getRandomValues(new Uint32Array(1))[0]; } while (x >= lim);
        return x % n;
    }

    // Fisher-Yates 洗牌，回傳新陣列，不改動原陣列
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = rnd(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // 複製文字，成功回傳 true；失敗（非 https、權限被拒…）回傳 false，由呼叫端決定備案
    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            return false;
        }
    }

    // 複製並在按鈕上短暫顯示結果；失敗時呼叫 onFail（例如選取文字讓使用者自己按 Ctrl+C）
    async function copyWithFeedback(btn, text, onFail) {
        const label = btn.textContent;
        const ok = await copyText(text);
        if (!ok && typeof onFail === 'function') onFail();
        btn.textContent = ok ? '已複製' : '請按 Ctrl+C';
        setTimeout(() => { btn.textContent = label; }, 1500);
        return ok;
    }

    // localStorage 的 JSON 版：無痕模式、被封鎖或資料損壞時都不會丟錯，直接回傳預設值
    const store = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch (e) {
                return fallback;
            }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
        },
    };

    const Util = { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex };
    if (typeof module !== 'undefined' && module.exports) module.exports = Util;
    else root.Util = Util;
})(typeof window !== 'undefined' ? window : globalThis);
