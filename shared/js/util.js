/* 共用小工具：均勻亂數 / 洗牌 / 複製 / localStorage / HTML 跳脫 / 日期字串 / 統計列 / 提示音 / 語音 / 名單解析 / 下載檔案 / 雜湊與隨機字串 / 可播種亂數 / CSV 解析與輸出
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

    // CSV：parseCSV 解析（RFC 4180）、toObjects 轉成物件陣列（標題重複自動加後綴、數字與 true/false 轉型）、csvStringify 輸出
    // RFC 4180：欄位可用雙引號包起來，裡面可有分隔符號、換行與 ""（代表一個引號）。回傳二維陣列；不成對的引號丟出錯誤
    function parseCSV(text, delim = ',') {
        const rows = []; let row = [], field = '', q = false, i = 0, any = false;
        const s = String(text).replace(/^﻿/, '');
        while (i < s.length) {
            const c = s[i];
            if (q) {
                if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
                field += c; i++; continue;
            }
            if (c === '"' && field === '') { q = true; any = true; i++; continue; }
            if (c === delim) { row.push(field); field = ''; any = true; i++; continue; }
            if (c === '\r' || c === '\n') { if (c === '\r' && s[i + 1] === '\n') i++; if (any || field !== '' || row.length) { row.push(field); rows.push(row); } row = []; field = ''; any = false; i++; continue; }
            field += c; any = true; i++;
        }
        if (q) throw new Error('有引號沒有成對（雙引號開了但沒有關閉）');
        if (any || field !== '' || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    const isNum = (v) => /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(String(v).trim());

    // 轉成 JSON（物件陣列）：標題重複時後面加 _2、_3；數字與 true/false 轉成對應型別
    function toObjects(header, rows) {
        const seen = {}, keys = header.map((h, i) => { let k = String(h).trim() || `col${i + 1}`; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? `${k}_${seen[k]}` : k; });
        const conv = (v) => (isNum(v) ? parseFloat(v) : v === 'true' ? true : v === 'false' ? false : v);
        return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, conv(r[i] ?? '')])));
    }

    // 二維陣列 → CSV 文字：含逗號、引號、換行或前後空白的欄位會加引號（RFC 4180），換行用 \r\n
    function csvStringify(header, rows) {
        const cell = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        return [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
    }

    // MongoDB ObjectId（12 位元組 = 24 位 16 進位）：前 4 位元組是建立時間（Unix 秒，大端序），接著 5 位元組隨機值（每個行程固定），最後 3 位元組計數器。
    // oid.parse 回傳 { ok, ms, sec, random, counter }（ms 是建立時間的毫秒時間戳，只有秒的精度）；格式不對回傳 { ok:false }
    // oid.fromDate(ms, fill)：產生「該秒」的 ObjectId，其餘 8 位元組填 fill（'00' 最小、'ff' 最大），用在 _id 的時間範圍查詢
    const OID_RE = /^[0-9a-fA-F]{24}$/;
    const oid = {
        isValid: (s) => typeof s === 'string' && OID_RE.test(s.trim()),
        parse(s) {
            if (!oid.isValid(s)) return { ok: false };
            const h = s.trim().toLowerCase(), sec = parseInt(h.slice(0, 8), 16);
            return { ok: true, sec, ms: sec * 1000, random: h.slice(8, 18), counter: parseInt(h.slice(18), 16) };
        },
        fromDate(ms, fill = '00') {
            const sec = Math.floor(ms / 1000);
            if (!Number.isFinite(sec) || sec < 0 || sec > 0xffffffff) throw new Error('時間超出 ObjectId 可表示的範圍（1970–2106）');
            const f = fill === 'ff' ? 'ff' : '00';
            return sec.toString(16).padStart(8, '0') + f.repeat(8);
        },
    };

    // 含時間的 ID：解析 UUID v1 / v6 / v7、ULID、KSUID、Snowflake（Twitter / Discord 等）並產生 UUID v7 與 ULID。
    // 解析函式回傳 { ok, type, ms, ... }（ms 是建立時間的毫秒時間戳，格式或版本不對 ok 為 false 並附 reason）；產生函式的 ms 預設為現在
    const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const randBytes = (n) => { const a = new Uint8Array(n); (root.crypto || require('crypto').webcrypto).getRandomValues(a); return a; };
    const hexOf = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    const ids = {
        EPOCHS: { twitter: 1288834974657, discord: 1420070400000, unix: 0 },
        // UUID：v1（Gregorian 100ns）、v6（重排的 v1）、v7（Unix 毫秒）才有時間；v4 等回傳 ok:true 但 ms 為 null
        parseUuid(str) {
            const t = String(str).trim().replace(/^urn:uuid:/i, '').replace(/^\{|\}$/g, '');
            if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(t)) return { ok: false, reason: '不是 UUID 格式（32 位 16 進位，可含連字號）' };
            const h = t.replace(/-/g, '').toLowerCase(), ver = parseInt(h[12], 16), variant = parseInt(h[16], 16);
            const r = { ok: true, type: 'uuid', version: ver, variant: (variant & 0x8) === 0 ? 'NCS' : (variant & 0xc) === 0x8 ? 'RFC 4122 / 9562' : (variant & 0xe) === 0xc ? 'Microsoft' : '保留', ms: null };
            if (ver === 1) { const t100 = (BigInt('0x' + h.slice(13, 16)) << 48n) + (BigInt('0x' + h.slice(8, 12)) << 32n) + BigInt('0x' + h.slice(0, 8)); r.ms = Number((t100 - 122192928000000000n) / 10000n); r.node = h.slice(20); r.clockSeq = parseInt(h.slice(16, 20), 16) & 0x3fff; }
            else if (ver === 6) { const t100 = (BigInt('0x' + h.slice(0, 8)) << 28n) + (BigInt('0x' + h.slice(8, 12)) << 12n) + BigInt('0x' + h.slice(13, 16)); r.ms = Number((t100 - 122192928000000000n) / 10000n); r.node = h.slice(20); }
            else if (ver === 7) r.ms = parseInt(h.slice(0, 12), 16);
            if (r.ms !== null && !(r.ms >= -8.64e15 && r.ms <= 8.64e15)) { r.ms = null; r.reason = '時間超出可表示範圍'; }
            return r;
        },
        // ULID：26 個 Crockford Base32 字元，前 10 個 = 48 位元毫秒時間；第一個字元不可大於 7
        parseUlid(str) {
            const t = String(str).trim().toUpperCase();
            if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(t)) return { ok: false, reason: '不是 ULID 格式（26 個字元，不含 I L O U）' };
            if (t[0] > '7') return { ok: false, reason: 'ULID 第一個字元不可大於 7（會超出 48 位元時間範圍）' };
            let ms = 0; for (const c of t.slice(0, 10)) ms = ms * 32 + B32.indexOf(c);
            return { ok: true, type: 'ulid', ms, random: t.slice(10) };
        },
        // KSUID：27 個 base62 字元 = 20 位元組；前 4 位元組是自 2014-03-05T00:53:20Z（1400000000 秒）起算的秒數，其餘 16 位元組隨機
        parseKsuid(str) {
            const t = String(str).trim();
            if (!/^[0-9A-Za-z]{27}$/.test(t)) return { ok: false, reason: '不是 KSUID 格式（27 個英數字元）' };
            let n = 0n; for (const c of t) n = n * 62n + BigInt(B62.indexOf(c));
            if (n >= (1n << 160n)) return { ok: false, reason: '數值超出 20 位元組' };
            const hex = n.toString(16).padStart(40, '0');
            return { ok: true, type: 'ksuid', ms: (parseInt(hex.slice(0, 8), 16) + 1400000000) * 1000, payload: hex.slice(8) };
        },
        // Snowflake（Twitter / Discord 等）：高位是自 epoch 起算的毫秒（右移 22 位元），其後 5 位 worker、5 位 process（或 datacenter / machine）、12 位序號
        parseSnowflake(str, epochMs = 1420070400000) {
            const t = String(str).trim();
            if (!/^\d{1,20}$/.test(t)) return { ok: false, reason: '不是數字 ID（最多 20 位數字）' };
            const n = BigInt(t); if (n >= (1n << 64n)) return { ok: false, reason: '數值超出 64 位元' };
            return { ok: true, type: 'snowflake', ms: Number(n >> 22n) + epochMs, worker: Number((n >> 17n) & 31n), process: Number((n >> 12n) & 31n), sequence: Number(n & 4095n) };
        },
        // 產生 UUID v7（RFC 9562）：48 位元毫秒 + 版本 7 + 12 位隨機 + 變體 + 62 位隨機
        uuidv7(ms = Date.now(), rand = randBytes) {
            if (!(ms >= 0 && ms < 2 ** 48)) throw new Error('時間超出 UUID v7 可表示的範圍（1970–10889）');
            const b = new Uint8Array(16), r = rand(10); let t = Math.floor(ms);
            for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
            b.set(r, 6); b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
            const h = hexOf(b); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        },
        // 產生 ULID：10 個字元的時間 + 16 個字元的隨機（80 位元）
        ulid(ms = Date.now(), rand = randBytes) {
            if (!(ms >= 0 && ms < 2 ** 48)) throw new Error('時間超出 ULID 可表示的範圍（1970–10889）');
            let t = Math.floor(ms), time = ''; for (let i = 0; i < 10; i++) { time = B32[t % 32] + time; t = Math.floor(t / 32); }
            const r = rand(10); let n = 0n; for (const x of r) n = (n << 8n) | BigInt(x);
            let rnd = ''; for (let i = 0; i < 16; i++) { rnd = B32[Number(n & 31n)] + rnd; n >>= 5n; }
            return time + rnd;
        },
    };

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
        // 寫入失敗（空間滿、被封鎖）回傳 false，並自動顯示 chrome.js 的「儲存失敗」提示；quiet 為 true 時不提示（頁面要自己處理時用）
        set(key, value, quiet = false) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch (e) { if (!quiet && root.Chrome && root.Chrome.storageFailed) root.Chrome.storageFailed(); return false; }
        },
    };

    const Util = { rnd, shuffle, copyText, copyWithFeedback, store, esc, day, statRow, tone, beep, speak, parseNames, download, sha256, randomHex, seeded, parseCSV, toObjects, isNum, csvStringify, oid, ids };
    if (typeof module !== 'undefined' && module.exports) module.exports = Util;
    else root.Util = Util;
})(typeof window !== 'undefined' ? window : globalThis);
