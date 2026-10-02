/* 共用小工具：均勻亂數 / 洗牌 / 複製 / localStorage / HTML 跳脫 / 日期字串 / 統計列 / 提示音 / 語音 / 名單解析 / 下載檔案 / 雜湊與隨機字串 / 可播種亂數
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
        daysInMonth: (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(),
        // 加減月份：日數超過當月就取月底（1/31 + 1 個月 = 2/28 或 2/29）
        addMonths(s, n) {
            const { y, m, d } = day.parse(s), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = t % 12 + 1;
            return day.ymd(ny, nm, Math.min(d, day.daysInMonth(ny, nm)));
        },
        // a ≤ b：相差幾年幾個月幾天（先找出「加上幾個月不超過 b」的最大月數，剩下的是天數；1/31 → 3/1 是 1 個月 1 天）
        diffYMD(a, b) {
            const p = day.parse(a), q = day.parse(b);
            let months = (q.y - p.y) * 12 + (q.m - p.m);
            if (day.num(day.addMonths(a, months)) > day.num(b)) months--;
            return { y: Math.floor(months / 12), m: months % 12, d: day.between(day.addMonths(a, months), b) };
        },
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

    // 可播種的亂數（mulberry32，種子字串先雜湊成 32 位元）：同一個種子永遠產生同一串數字，用在「每日挑戰」。
    // 回傳函式 rand01()，傳回 [0,1) 小數；rand01.int(n) 傳回 [0,n) 整數。非密碼學用途
    function seeded(seed) {
        let h = 1779033703 ^ String(seed).length;
        for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
        let a = Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
        const rand01 = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        rand01.int = (n) => Math.floor(rand01() * n);
        return rand01;
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

    const Util = { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex, seeded };
    if (typeof module !== 'undefined' && module.exports) module.exports = Util;
    else root.Util = Util;
})(typeof window !== 'undefined' ? window : globalThis);
