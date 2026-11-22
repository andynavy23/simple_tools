/* 台灣國定假日資料與推算（tw-holidays、date-calc 共用）：內建 2025–2027（已對人事行政總處公告）
 * 使用：<script src="../shared/js/util.js"></script> 之後 <script src="../shared/js/tw-holiday-data.js"></script>，
 *       const { buildMap, isRest, inRange } = TwHol;   buildMap(years, custom) → Map 日期 → { kind: 'off' | 'work', name }
 * 只放資料與純函式；頁面專屬（自訂假日、連假區段、請假最佳化…）留在各頁。
 */
(function (root) {
    'use strict';
    const day = (typeof module !== 'undefined' && module.exports ? require('./util.js') : root.Util).day;
    const YEARS = [2025, 2026, 2027];
// 補班：依行政院人事行政總處「政府行政機關辦公日曆表」（114 年 6/27/2024 公告、查詢日 2026-11-22）：2025 春節 1/27 調整放假、2/8 補班。
// 2027 已於 2026-11-22 對 116 年辦公日曆表核對（總放假 121 日、端午 6/9、中秋 9/15、補假 2/9–10、3/1、4/6、4/30、10/11、12/24、12/31 皆符）。
// 114 年 6 月修正後刪除「調整放假補行上班」，115（2026）、116（2027）年辦公日曆表皆無補班日（除夕前一日已列入春節放假），故只剩這一筆。
const TW_ADJ = [
    { d: '2025-02-08', kind: 'work', name: '補班（補 1/27）' },
];
const dow = (ds) => (day.num(ds) + 4) % 7;     // 0=日
const LF = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
// 西曆日期 → 農曆 { m, d, leap }
// Intl（ICU）在新月落在 UTC+8 午夜前後幾分鐘時會差一天（2027 春節 ICU 算 2/7，實為 2/6）；下列區間以天文新月（UTC+8）校正：[起, 迄, 農曆年, 月, 起日的農曆日]
const LUNAR_FIX = [['2027-02-06', '2027-03-07', 2027, 1, 1], ['2030-02-02', '2030-02-02', 2029, 12, 30], ['2030-02-03', '2030-03-03', 2030, 1, 1]];
function lunarOf(ds) {
    const e = LUNAR_FIX.find(x => ds >= x[0] && ds <= x[1]); if (e) return { m: e[3], d: e[4] + day.between(e[0], ds), leap: false };
    const { y, m, d } = day.parse(ds), p = LF.formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    const mo = p.find(x => x.type === 'month').value;
    return { m: parseInt(mo, 10), d: +p.find(x => x.type === 'day').value, leap: /\D/.test(mo) };
}
// 清明（4 月幾日，21 世紀公式；2025–2027 正確）
function qingming(y) { const t = y % 100; return Math.floor(t * 0.2422 + 4.81) - Math.floor((t - 1) / 4); }
// 該西曆年的春節初一、端午（農曆 5/5）、中秋（8/15）
const _lc = {};
function lunarEvents(y) {
    if (_lc[y]) return _lc[y];
    const r = {};
    for (let ds = y + '-01-15'; ds <= y + '-10-15'; ds = day.shift(ds, 1)) {
        const l = lunarOf(ds); if (l.leap) continue;
        if (l.m === 1 && l.d === 1 && !r.ny) r.ny = ds;
        else if (l.m === 5 && l.d === 5) r.dw = ds;
        else if (l.m === 8 && l.d === 15) r.mf = ds;
    }
    return (_lc[y] = r);
}
// 依法定規則推算某年的放假日（含補假）：[{ d, name }]
function autoHolidays(y) {
    const L = lunarEvents(y), q = qingming(y), p2 = (n) => String(n).padStart(2, '0'), res = [];
    const add = (d, name, spring) => res.push({ d, name, spring: !!spring });
    add(y + '-01-01', '元旦');
    add(day.shift(L.ny, -2), '除夕前一日', 1); add(day.shift(L.ny, -1), '除夕', 1); add(L.ny, '春節初一', 1); add(day.shift(L.ny, 1), '春節初二', 1); add(day.shift(L.ny, 2), '春節初三', 1);
    add(y + '-02-28', '和平紀念日');
    add(y + '-04-' + p2(q === 4 ? 3 : 4), '兒童節'); add(y + '-04-' + p2(q), '清明節');
    add(y + '-05-01', '勞動節'); add(L.dw, '端午節'); add(y + '-09-28', '教師節'); add(L.mf, '中秋節');
    add(y + '-10-10', '國慶日'); add(y + '-10-25', '光復節'); add(y + '-12-25', '行憲紀念日');
    if (dow((y + 1) + '-01-01') === 6) add(y + '-12-31', '元旦補假');   // 隔年元旦逢週六，補假在本年 12/31
    res.sort((a, b) => a.d.localeCompare(b.d));
    // 補假：週六提前一天、週日延後一天；春節落在週末者順延到春節後的上班日
    const taken = new Set(res.map(x => x.d)), extra = [];
    const free = (d) => !taken.has(d) && dow(d) !== 0 && dow(d) !== 6;
    const springEnd = day.shift(L.ny, 2);
    res.forEach(h => {
        const w = dow(h.d); if (w !== 0 && w !== 6) return;
        let t = h.spring ? springEnd : h.d, step = h.spring || w === 0 ? 1 : -1;
        do { t = day.shift(t, step); } while (!free(t));
        taken.add(t); extra.push({ d: t, name: h.name + '補假' });
    });
    return res.concat(extra).map(x => ({ d: x.d, name: x.name }));
}
// 日曆：Map 日期 → { kind: 'off' | 'work', name }；順序：法定 → 內建調整 → 自訂
function buildMap(years, custom) {
    const m = new Map();
    years.forEach(y => autoHolidays(y).forEach(h => m.set(h.d, { kind: 'off', name: h.name })));
    TW_ADJ.forEach(a => m.set(a.d, { kind: a.kind, name: a.name }));
    (custom || []).forEach(a => m.set(a.d, { kind: a.kind, name: a.name }));
    return m;
}
const isRest = (map, ds) => { const e = map.get(ds); return e ? e.kind === 'off' : dow(ds) === 0 || dow(ds) === 6; };
    // 該日是否在內建資料年份內
    const inRange = (ds) => YEARS.includes(+ds.slice(0, 4));
    const TwHol = { YEARS, TW_ADJ, LUNAR_FIX, dow, lunarOf, qingming, lunarEvents, autoHolidays, buildMap, isRest, inRange };
    if (typeof module !== 'undefined' && module.exports) module.exports = TwHol;
    else root.TwHol = TwHol;
})(typeof window !== 'undefined' ? window : globalThis);
