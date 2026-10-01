/* 共用小工具：均勻亂數 / 洗牌 / 複製 / localStorage / HTML 跳脫 / 日期字串 / 統計列
 *
 * 使用：<script src="../shared/js/util.js"></script>，然後 const { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow } = Util;
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

    const Util = { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow };
    if (typeof module !== 'undefined' && module.exports) module.exports = Util;
    else root.Util = Util;
})(typeof window !== 'undefined' ? window : globalThis);
