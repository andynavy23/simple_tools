// i9 批次：packing-list / pet-log / health-log / geo-calc 的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- geo-calc ----------
{
    const G = load('utils/geo-calc.html', 'parseCoord,fmtDMS,fmtDM,fmtDeg,splitDMS,haversine,bearing,midpoint,dir16,googleUrl,osmUrl,sunEvents,hhmm,moonInfo,jdOfMs,msOfJd,termsOfYear,nextTerm,twDateTime,lunarText,normOpts,validLL,TERMS');
    const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, `${a} !~ ${b} (±${e})`);
    // 座標解析
    const pc = (s) => G.parseCoord(s);
    for (const s of ['25.0330, 121.5654', '25.0330,121.5654', '25.0330N 121.5654E', '25°01′58.8″N 121°33′55.4″E', '25°1\'58.8"N, 121°33\'55.4"E', 'N 25°1.98′ E 121°33.9′', '121.5654E 25.0330N', '(25.0330, 121.5654)', '25.0330 121.5654', '@25.0330,121.5654']) {
        const r = pc(s); assert.ok(r, s); near(r.lat, 25.033, 1e-3); near(r.lng, 121.5654, 1e-3);
    }
    assert.deepStrictEqual(pc('-33.8688, 151.2093'), { lat: -33.8688, lng: 151.2093 });
    assert.deepStrictEqual(pc('33.8688S, 151.2093E'), { lat: -33.8688, lng: 151.2093 });
    assert.deepStrictEqual(pc('40.7128N 74.006W'), { lat: 40.7128, lng: -74.006 });
    for (const bad of ['', 'abc', '25.03', '91, 10', '10, 181', '25 N', 'N25 N121', '25N 121S', '25°61′N 121E', '25, 121, 5', null, undefined, 'x'.repeat(200)]) assert.strictEqual(pc(bad), null, String(bad));
    // 格式輸出與進位
    assert.strictEqual(G.fmtDMS(25.033, true), '25°01′58.80″ N');
    assert.strictEqual(G.fmtDMS(-121.5654, false), '121°33′55.44″ W');
    assert.deepStrictEqual(G.splitDMS(10.99999999), { sign: 1, d: 11, m: 0, s: 0 });
    assert.strictEqual(G.fmtDM(25.033, true), '25°1.9800′ N');
    assert.strictEqual(G.fmtDeg(25.0330000004), '25.033');
    // DMS → 十進位 → DMS 來回
    for (const v of [0, 0.5, 25.033, -33.8688, 179.99999, -0.0001]) { const { sign, d, m, s } = G.splitDMS(v); near(sign * (d + m / 60 + s / 3600), v, 3e-6); }
    // 距離 / 方位 / 中點
    const T = { lat: 25.033, lng: 121.5654 }, K = { lat: 35.6762, lng: 139.6503 };
    const km = G.haversine(T, K); assert.ok(km > 2050 && km < 2150, '台北–東京 ' + km);
    assert.strictEqual(G.haversine(T, T), 0);
    near(G.haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.195, 0.01);          // 赤道 1 度經度
    near(G.haversine({ lat: 90, lng: 0 }, { lat: -90, lng: 0 }), Math.PI * 6371.0088, 0.01);
    near(G.haversine({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }), 343.5, 3);   // 倫敦–巴黎約 344 km
    const b = G.bearing(T, K); assert.ok(b > 45 && b < 65, '方位 ' + b);
    near(G.bearing({ lat: 0, lng: 0 }, { lat: 10, lng: 0 }), 0, 1e-9); near(G.bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 10 }), 90, 1e-9);
    near(G.bearing({ lat: 0, lng: 0 }, { lat: -10, lng: 0 }), 180, 1e-9); near(G.bearing({ lat: 0, lng: 0 }, { lat: 0, lng: -10 }), 270, 1e-9);
    const mid = G.midpoint(T, K); near(G.haversine(T, mid), G.haversine(mid, K), 0.5); near(G.haversine(T, mid) * 2, km, 0.5);
    const m180 = G.midpoint({ lat: 0, lng: 170 }, { lat: 0, lng: -170 }); near(Math.abs(m180.lng), 180, 1e-6);
    assert.strictEqual(G.dir16(0), '北'); assert.strictEqual(G.dir16(90), '東'); assert.strictEqual(G.dir16(55), '東北'); assert.strictEqual(G.dir16(359), '北'); assert.strictEqual(G.dir16(247.5), '西南西');
    assert.strictEqual(G.googleUrl(T), 'https://www.google.com/maps?q=25.033,121.5654');
    assert.ok(G.osmUrl(T).includes('mlat=25.033&mlon=121.5654'));
    assert.ok(G.validLL(90, 180) && !G.validLL(90.1, 0) && !G.validLL(NaN, 0));

    // 日出日落（NOAA 公式，容許 ±3 分鐘；對照中央氣象署 / timeanddate 的已知值）
    const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    let e = G.sunEvents(2026, 6, 21, 25.033, 121.5654, 8);
    near(e.sunrise, mins('05:04'), 3); near(e.sunset, mins('18:48'), 3); near(e.noon, mins('11:55'), 3);
    e = G.sunEvents(2026, 12, 21, 25.033, 121.5654, 8);
    near(e.sunrise, mins('06:34'), 3); near(e.sunset, mins('17:08'), 3);
    e = G.sunEvents(2026, 6, 21, 51.5074, -0.1278, 0);                 // 倫敦夏至（UTC）：日出約 03:43、日落約 20:21
    near(e.sunrise, mins('03:43'), 3); near(e.sunset, mins('20:21'), 3); assert.ok(e.civilStart < e.sunrise && e.civilEnd > e.sunset);
    assert.ok(e.goldenAmStart < e.goldenAmEnd && e.goldenAmEnd > e.sunrise && e.goldenPmStart < e.sunset);
    e = G.sunEvents(2026, 3, 20, 0, 0, 0); near(e.dayLen, 720, 12);       // 春分、赤道：白晝約 12 小時（折射使日長略大）
    assert.strictEqual(G.sunEvents(2026, 6, 21, 80, 0, 0).polar, 'day'); assert.strictEqual(G.sunEvents(2026, 12, 21, 80, 0, 0).polar, 'night');
    assert.strictEqual(G.sunEvents(2026, 6, 21, 80, 0, 0).sunrise, null);
    e = G.sunEvents(2026, 6, 21, -41.29, 174.78, 12); near(e.sunrise, mins('07:47'), 4);   // 威靈頓冬至
    near(G.sunEvents(2026, 6, 21, 25.033, 121.5654, 8).maxAlt, 88.4, 0.3);
    // 時區與日界線
    e = G.sunEvents(2026, 6, 21, -170, 0, 13); assert.ok(Number.isFinite(e.noon));
    assert.strictEqual(G.hhmm(65), '01:05'); assert.strictEqual(G.hhmm(null), '—'); assert.strictEqual(G.hhmm(1450), '00:10（+1 天）');

    // 月相：已知新月 / 滿月（UTC）：2024-01-11 11:57、2024-01-25 17:54、2025-01-13 22:27、2025-01-29 12:36；容許 ±3 小時（遠小於「±1 天」的要求）
    const U = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi);
    let mi = G.moonInfo(G.jdOfMs(U(2024, 1, 1, 0, 0)));
    near(G.msOfJd(mi.nextNew), U(2024, 1, 11, 11, 57), 3 * 36e5); near(G.msOfJd(mi.nextFull), U(2024, 1, 25, 17, 54), 3 * 36e5);
    mi = G.moonInfo(G.jdOfMs(U(2025, 1, 1, 0, 0)));
    near(G.msOfJd(mi.nextNew), U(2025, 1, 29, 12, 36), 3 * 36e5); near(G.msOfJd(mi.nextFull), U(2025, 1, 13, 22, 27), 3 * 36e5);
    mi = G.moonInfo(G.jdOfMs(U(2024, 1, 11, 12, 0)));             // 新月當下
    assert.strictEqual(mi.name, '新月'); assert.ok(mi.illum < 0.01 && mi.age < 0.1);
    mi = G.moonInfo(G.jdOfMs(U(2024, 1, 25, 18, 0)));
    assert.strictEqual(mi.name, '滿月'); assert.ok(mi.illum > 0.99);
    mi = G.moonInfo(G.jdOfMs(U(2024, 1, 18, 3, 52)));             // 上弦約 2024-01-18 03:53 UTC
    assert.strictEqual(mi.name, '上弦月'); near(mi.illum, 0.5, 0.12);   // 以週期比例推算，弦月時刻本來就不剛好在週期 1/4
    for (let i = 0; i < 400; i++) { const m = G.moonInfo(G.jdOfMs(U(2020, 1, 1, 0, 0) + i * 86400e3 * 3.7)); assert.ok(m.age >= 0 && m.age < 30 && m.illum >= 0 && m.illum <= 1 && m.nextFull > G.jdOfMs(U(2020, 1, 1, 0, 0)) && m.name); }

    // 節氣：對照已知（UTC+8）：2024 冬至 12/21 17:21、2024 立春 2/4 16:27、2025 春分 3/20 17:01、2025 夏至 6/21 10:42、2026 冬至 12/22 04:50；容許 ±1 小時（遠小於「±1 天」）
    const TW = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h - 8, mi);
    const term = (y, n) => G.termsOfYear(y).find(x => x.name === n).ms;
    near(term(2024, '冬至'), TW(2024, 12, 21, 17, 21), 36e5); near(term(2024, '立春'), TW(2024, 2, 4, 16, 27), 36e5);
    near(term(2025, '春分'), TW(2025, 3, 20, 17, 1), 36e5); near(term(2025, '夏至'), TW(2025, 6, 21, 10, 42), 36e5);
    near(term(2026, '冬至'), TW(2026, 12, 22, 4, 50), 36e5);
    const ts = G.termsOfYear(2026); assert.strictEqual(ts.length, 24);
    assert.ok(ts.every((x, i) => i === 0 || x.ms > ts[i - 1].ms)); assert.strictEqual(ts[0].name, '小寒'); assert.strictEqual(ts[23].name, '冬至');
    assert.ok(ts.every(x => new Date(x.ms + 8 * 36e5).getUTCFullYear() === 2026));
    for (let i = 1; i < 24; i++) { const gap = (ts[i].ms - ts[i - 1].ms) / 864e5; assert.ok(gap > 14 && gap < 16.5, '節氣間隔 ' + gap); }
    for (const y of [1950, 2000, 2050, 2099]) assert.strictEqual(G.termsOfYear(y).length, 24);
    let nt = G.nextTerm(TW(2024, 12, 21, 18, 0)); assert.strictEqual(nt.name, '小寒');    // 跨年
    assert.strictEqual(G.nextTerm(TW(2026, 10, 22, 12, 0)).name, '霜降'); nt = G.nextTerm(TW(2026, 10, 24, 12, 0)); assert.strictEqual(nt.name, '立冬');         // 2026-11-07 前後
    assert.strictEqual(G.twDateTime(nt.ms).slice(0, 7), '2026-11');
    // 農曆（Node 有完整 ICU 才驗；沒有則回傳空字串）
    const ln = G.lunarText('2025-01-29'); if (ln) { assert.ok(ln.includes('乙巳年') && ln.includes('正月') && ln.includes('初一'), ln); assert.ok(G.lunarText('2025-07-25').includes('閏六月')); }
    // 設定驗證
    assert.deepStrictEqual(G.normOpts(null), { tab: 'coord', lat: 25.033, lng: 121.5654, tz: 8 });
    assert.deepStrictEqual(G.normOpts({ tab: 'moon', lat: 22.6, lng: 120.3, tz: 9 }), { tab: 'moon', lat: 22.6, lng: 120.3, tz: 9 });
    assert.deepStrictEqual(G.normOpts({ tab: 'x', lat: 999, lng: 'a', tz: 99 }), { tab: 'coord', lat: 25.033, lng: 121.5654, tz: 8 });
    assert.strictEqual(G.normOpts([]).tab, 'coord'); assert.strictEqual(G.normOpts({ lat: null, tz: null }).lat, 25.033);
    ok('geo-calc');
}

// ---------- packing-list ----------
{
    const P = load('utils/packing-list.html', 'PK,TYPES,SEASONS,defaultItems,normLists,addList,removeList,renameList,toggleItem,resetChecks,removeItem,moveItem,addItem,copyList,progress,toText');
    const find = (arr, re) => arr.find(x => re.test(x.t));
    for (const t of P.TYPES) for (const s of Object.keys(P.SEASONS)) for (const d of [1, 2, 5, 14, 60]) {
        const a = P.defaultItems(t, d, s); assert.ok(a.length > 10 && a.length < 80 && a.every(x => x.t && x.t.length <= 60 && x.g), `${t}${s}${d}`);
    }
    assert.ok(find(P.defaultItems('出國', 4, 'mild'), /^內衣褲 × 5$/));                 // 天數 + 1
    assert.ok(find(P.defaultItems('國內旅遊', 2, 'mild'), /^內衣褲 × 3$/) && find(P.defaultItems('國內旅遊', 2, 'mild'), /^襪子 × 3$/));
    assert.ok(find(P.defaultItems('國內旅遊', 30, 'mild'), /^內衣褲 × 14$/) && find(P.defaultItems('國內旅遊', 30, 'mild'), /洗衣/));
    assert.ok(!find(P.defaultItems('國內旅遊', 1, 'mild'), /內衣褲/));
    assert.ok(find(P.defaultItems('出國', 3, 'mild'), /護照/) && !find(P.defaultItems('國內旅遊', 3, 'mild'), /護照/));
    assert.ok(find(P.defaultItems('露營', 2, 'mild'), /帳篷/) && find(P.defaultItems('出差', 2, 'mild'), /筆電/) && find(P.defaultItems('運動賽事', 1, 'mild'), /號碼布/));
    assert.ok(find(P.defaultItems('出國', 3, 'cold'), /厚外套/) && !find(P.defaultItems('出國', 3, 'hot'), /厚外套/) && find(P.defaultItems('出國', 3, 'hot'), /防曬乳/));
    assert.ok(P.defaultItems('出國', NaN, 'x').length > 5 && P.defaultItems('不存在', 3, 'mild').length > 5);
    // 建立、上限
    const L = [];
    let r = P.addList(L, { name: ' 東京 ', type: '出國', days: 5, season: 'cold' });
    assert.ok(!r.err && r.lists.length === 1 && r.lists[0].name === '東京' && r.lists[0].items.every(i => !i.c && i.id));
    assert.strictEqual(new Set(r.lists[0].items.map(i => i.id)).size, r.lists[0].items.length);
    for (const bad of [{ name: '', type: '出國', days: 5, season: 'cold' }, { name: 'x'.repeat(31), type: '出國', days: 5, season: 'cold' }, { name: 'a', type: '火星', days: 5, season: 'cold' }, { name: 'a', type: '出國', days: 0, season: 'cold' }, { name: 'a', type: '出國', days: 61, season: 'cold' }, { name: 'a', type: '出國', days: 2.5, season: 'cold' }, { name: 'a', type: '出國', days: NaN, season: 'cold' }, { name: 'a', type: '出國', days: 5, season: 'x' }]) assert.ok(P.addList(L, bad).err, JSON.stringify(bad));
    let full = []; for (let i = 0; i < 30; i++) full = P.addList(full, { name: 'n' + i, type: '露營', days: 2, season: 'mild' }).lists;
    assert.strictEqual(full.length, 30); r = P.addList(full, { name: 'z', type: '露營', days: 2, season: 'mild' }); assert.ok(r.err.includes('30') && r.lists === full);
    assert.ok(P.copyList(full, full[0].id).err);
    // 勾選 / 重置 / 刪除 / 移動（用 id）
    const id = full[0].id, l0 = full[0], i0 = l0.items[0].id, i1 = l0.items[1].id;
    let s = P.toggleItem(full, id, i0); assert.strictEqual(s[0].items[0].c, true); assert.strictEqual(P.progress(s[0]).done, 1);
    assert.ok(P.toText(s[0]).includes('☑ ' + l0.items[0].t) && P.toText(s[0]).includes('☐ ' + l0.items[1].t) && P.toText(s[0]).startsWith(l0.name));
    s = P.resetChecks(s, id); assert.strictEqual(P.progress(s[0]).done, 0);
    s = P.moveItem(full, id, i0, 1); assert.strictEqual(s[0].items[1].id, i0); assert.strictEqual(s[0].items[0].id, i1);
    assert.strictEqual(P.moveItem(full, id, i0, -1)[0].items[0].id, i0); assert.strictEqual(P.moveItem(full, id, 'nope', 1)[0].items[0].id, i0);
    const last = l0.items[l0.items.length - 1].id; assert.strictEqual(P.moveItem(full, id, last, 1)[0].items.at(-1).id, last);
    s = P.removeItem(full, id, i0); assert.strictEqual(s[0].items.length, l0.items.length - 1); assert.ok(!s[0].items.some(i => i.id === i0)); assert.strictEqual(s[1].items.length, full[1].items.length);
    s = P.removeList(full, id); assert.strictEqual(s.length, 29); assert.ok(!s.some(l => l.id === id));
    assert.strictEqual(P.renameList(full, id, ' 新名 ')[0].name, '新名'); assert.strictEqual(P.renameList(full, id, '   ')[0].name, l0.name);
    // 新增項目
    s = P.addItem(full, id, ' 充電線 '); assert.ok(!s.err && s.lists[0].items.at(-1).t === '充電線');
    assert.ok(P.addItem(full, id, '  ').err && P.addItem(full, id, 'x'.repeat(61)).err && P.addItem(full, 'nope', 'a').err);
    let big = full; for (let i = 0; big[0].items.length < 200; i++) big = P.addItem(big, id, 'i' + i).lists;
    assert.strictEqual(big[0].items.length, 200); assert.ok(P.addItem(big, id, 'one more').err.includes('200'));
    // 複製：勾選清空、新 id
    const c0 = P.toggleItem([full[0]], id, i0), cp = P.copyList(c0, id);
    assert.ok(!cp.err && cp.lists.length === 2 && cp.lists[1].id !== id && cp.lists[1].items.every(i => !i.c) && cp.lists[1].name.endsWith('（複製）') && cp.lists[1].items[0].id !== i0 && cp.lists[0].items[0].c);
    assert.ok(P.copyList([{ ...full[0], name: 'x'.repeat(30) }], id).lists[1].name.length <= 30);
    // 載入驗證
    for (const bad of [null, 'x', 5, {}, [null, 1, 'a', [], { items: 'x' }]]) assert.ok(Array.isArray(P.normLists(bad)));
    let n = P.normLists([{ id: 'a', name: 5, type: 'zz', days: -3, season: 9, items: [null, { t: '' }, { id: 'x', t: ' 護照 ', c: 'yes' }, { id: 'x', t: '重複' }, { t: 'y'.repeat(100), g: 'g'.repeat(50) }] }, { id: 'a', name: 'dup' }]);
    assert.strictEqual(n.length, 1); assert.deepStrictEqual([n[0].name, n[0].type, n[0].days, n[0].season], ['未命名清單', '國內旅遊', 1, 'mild']);
    assert.strictEqual(n[0].items.length, 2); assert.strictEqual(n[0].items[0].c, false); assert.strictEqual(n[0].items[1].t.length, 60); assert.strictEqual(n[0].items[1].g.length, 12);
    const many = Array.from({ length: 40 }, (_, i) => ({ id: 'l' + i, name: 'n', items: Array.from({ length: 250 }, (_, j) => ({ id: 'i' + j, t: 'a' })) }));
    n = P.normLists(many); assert.strictEqual(n.length, 30); assert.strictEqual(n[0].items.length, 200);
    ok('packing-list');
}

// ---------- pet-log ----------
{
    const P = load('fun/pet-log.html', 'PL,SIZES,validDate,dueOf,normData,addPet,updatePet,removePet,addEvent,updateEvent,removeEvent,dueList,weightSeries,ageOf,humanAge,toCsv,csvGuard,checkEvent');
    let d = { pets: [], events: [] };
    let r = P.addPet(d, { name: ' 小黑 ', sp: '狗', size: P.SIZES[1], birth: '2023-05-01', note: '' }); assert.ok(!r.err); d = r.d; const pid = r.id;
    assert.strictEqual(d.pets[0].name, '小黑');
    for (const bad of [{ name: '' }, { name: 'x'.repeat(21) }, { name: 'a', birth: '2999-01-01' }, { name: 'a', birth: '2023-02-30' }, { name: 'a', note: 'n'.repeat(201) }]) assert.ok(P.addPet(d, bad).err, JSON.stringify(bad));
    r = P.addPet(d, { name: '咪咪', sp: '貓', birth: '' }); const cid = r.id; d = r.d;
    assert.ok(!P.updatePet(d, pid, { name: '小白', sp: '狗', size: P.SIZES[0], birth: '' }).err && P.updatePet(d, pid, { name: '小白' }).d.pets[0].name === '小白' && P.updatePet(d, 'nope', { name: 'a' }).err && P.updatePet(d, pid, { name: '' }).err);
    let full = d; for (let i = 0; full.pets.length < 20; i++) full = P.addPet(full, { name: 'p' + i }).d;
    assert.ok(P.addPet(full, { name: 'z' }).err.includes('20'));
    // 事件
    const ev = (o) => ({ type: '疫苗', date: '2026-03-01', name: '狂犬病', val: '', cyc: '12', cu: 'm', note: '', ...o });
    r = P.addEvent(d, pid, ev({})); assert.ok(!r.err); d = r.d; assert.strictEqual(d.events[0].cyc, 12); assert.strictEqual(P.dueOf(d.events[0]), '2027-03-01');
    assert.strictEqual(P.dueOf({ type: '驅蟲', date: '2026-01-31', cyc: 1, cu: 'm' }), '2026-02-28'); assert.strictEqual(P.dueOf({ type: '驅蟲', date: '2026-03-01', cyc: 30, cu: 'd' }), '2026-03-31');
    assert.strictEqual(P.dueOf({ type: '餵食', date: '2026-03-01', cyc: 5, cu: 'd' }), ''); assert.strictEqual(P.dueOf({ type: '疫苗', date: '2026-03-01', cyc: 0, cu: 'd' }), '');
    for (const bad of [ev({ type: 'x' }), ev({ date: '2026-13-01' }), ev({ date: '' }), ev({ val: '-1' }), ev({ val: 'abc' }), ev({ cyc: '1.5' }), ev({ cyc: '121' }), ev({ cyc: '4000', cu: 'd' }), ev({ cyc: '-1' }), ev({ name: 'n'.repeat(31) }), ev({ note: 'n'.repeat(201) }), ev({ type: '體重', val: '' }), ev({ type: '體重', val: '0' }), ev({ type: '體重', val: '201' })]) assert.ok(P.addEvent(d, pid, bad).err, JSON.stringify(bad));
    assert.ok(P.addEvent(d, 'nope', ev({})).err);
    assert.ok(!P.addEvent(d, pid, ev({ type: '餵食', val: '', cyc: '9', name: '' })).err);
    // 體重 / 數值四捨五入；餵食不留間隔
    d = P.addEvent(d, pid, ev({ type: '體重', date: '2026-03-05', val: '4.256', cyc: '' })).d; d = P.addEvent(d, pid, ev({ type: '體重', date: '2026-02-01', val: '4', cyc: '' })).d; d = P.addEvent(d, cid, ev({ type: '體重', val: '3', cyc: '' })).d;
    assert.deepStrictEqual(P.weightSeries(d, pid), [{ date: '2026-02-01', kg: 4 }, { date: '2026-03-05', kg: 4.26 }]);
    d = P.addEvent(d, pid, ev({ type: '餵食', val: '50', cyc: '9' })).d; assert.strictEqual(d.events.at(-1).cyc, 0);
    // 到期提醒：同寵物+類型+項目只看最新一筆；排序；狀態
    d = P.addEvent(d, pid, ev({ date: '2025-03-01', name: '狂犬病' })).d;      // 舊的不應出現
    d = P.addEvent(d, pid, ev({ type: '驅蟲', date: '2026-10-01', name: '體內', cyc: '1', cu: 'm' })).d;
    d = P.addEvent(d, pid, ev({ type: '疫苗', date: '2026-04-01', name: '綜合', cyc: '6' })).d;
    const dl = P.dueList(d, '2026-10-22', pid);
    assert.deepStrictEqual(dl.map(x => x.type + x.name), ['疫苗綜合', '驅蟲體內', '疫苗狂犬病']);
    assert.deepStrictEqual(dl.map(x => x.due), ['2026-10-01', '2026-11-01', '2027-03-01']); assert.deepStrictEqual(dl.map(x => x.state), ['over', 'soon', 'ok']);
    assert.strictEqual(dl[0].days, -21); assert.strictEqual(P.dueList(d, '2026-10-22', cid).length, 0); assert.strictEqual(P.dueList(d, '2026-10-22').length, 3);
    assert.strictEqual(P.dueList(d, '2026-10-20', pid)[1].state, 'soon'); assert.strictEqual(P.dueList(d, '2026-11-01', pid)[1].days, 0); assert.strictEqual(P.dueList(d, '2026-11-01', pid)[1].state, 'soon');
    // 編輯 / 刪除（用 id）
    const eid = d.events[0].id, u = P.updateEvent(d, eid, ev({ date: '2026-04-10', cyc: '3' }));
    assert.ok(!u.err && u.d.events[0].date === '2026-04-10' && u.d.events[0].pid === pid && u.d.events[0].id === eid && u.d.events.length === d.events.length);
    assert.ok(P.updateEvent(d, eid, ev({ cyc: 'x' })).err && P.updateEvent(d, 'nope', ev({})).err);
    assert.strictEqual(P.removeEvent(d, eid).events.length, d.events.length - 1);
    // 刪寵物連帶刪事件
    const rm = P.removePet(d, pid); assert.ok(rm.events.every(e => e.pid === cid) && rm.events.length === 1 && rm.pets.length === 1);
    // 事件上限 3000
    const big = { pets: d.pets, events: Array.from({ length: 3000 }, (_, i) => ({ id: 'e' + i, pid, type: '其他', date: '2026-01-01', name: '', val: null, cyc: 0, cu: 'm', note: '' })) };
    assert.ok(P.addEvent(big, pid, ev({ type: '其他', cyc: '' })).err.includes('3000'));
    // 年齡與換算
    assert.deepStrictEqual(P.ageOf('2023-05-01', '2026-10-22'), { y: 3, m: 5, d: 21 }); assert.strictEqual(P.ageOf('', '2026-10-22'), null); assert.strictEqual(P.ageOf('2030-01-01', '2026-10-22'), null);
    const S = P.SIZES;
    assert.strictEqual(P.humanAge('狗', S[0], '2025-10-22', '2026-10-22'), 15); assert.strictEqual(P.humanAge('狗', S[0], '2024-10-22', '2026-10-22'), 24);
    assert.strictEqual(P.humanAge('狗', S[0], '2021-10-22', '2026-10-22'), 24 + 3 * 4); assert.strictEqual(P.humanAge('狗', S[1], '2021-10-22', '2026-10-22'), 24 + 3 * 5); assert.strictEqual(P.humanAge('狗', S[2], '2021-10-22', '2026-10-22'), 24 + 3 * 6);
    assert.strictEqual(P.humanAge('貓', S[2], '2021-10-22', '2026-10-22'), 24 + 3 * 4); assert.strictEqual(P.humanAge('其他', S[0], '2021-10-22', '2026-10-22'), null); assert.strictEqual(P.humanAge('狗', S[0], '', '2026-10-22'), null);
    assert.ok(P.humanAge('貓', S[0], '2026-04-22', '2026-10-22') > 5 && P.humanAge('貓', S[0], '2026-04-22', '2026-10-22') < 9);
    // 載入驗證
    for (const bad of [null, 'x', 5, [], { pets: 'x', events: 3 }, { pets: [null, 1], events: [null] }]) { const n = P.normData(bad); assert.ok(Array.isArray(n.pets) && Array.isArray(n.events)); }
    let n = P.normData({ pets: [{ id: 'a', name: 'A', sp: 'x', size: 'y', birth: '2999' }, { id: 'a', name: 'dup' }, { name: '' }], events: [{ id: 'e1', pid: 'a', type: '體重', date: '2026-01-01', val: 5 }, { id: 'e2', pid: 'zz', type: '其他', date: '2026-01-01' }, { id: 'e3', pid: 'a', type: '體重', date: '2026-01-01', val: 'x' }, { id: 'e4', pid: 'a', type: '疫苗', date: '2026-01-01', cyc: 'abc', val: -4, note: 5 }, { id: 'e1', pid: 'a', type: '其他', date: '2026-01-02' }, { pid: 'a', type: '壞', date: '2026-01-01' }] });
    assert.strictEqual(n.pets.length, 1); assert.deepStrictEqual([n.pets[0].sp, n.pets[0].size, n.pets[0].birth], ['其他', S[0], '']);
    assert.deepStrictEqual(n.events.map(e => e.id), ['e1', 'e4']); assert.strictEqual(n.events[1].cyc, 0); assert.strictEqual(n.events[1].val, null);
    n = P.normData({ pets: Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i, name: 'n' })), events: Array.from({ length: 3100 }, (_, i) => ({ id: 'e' + i, pid: 'p0', type: '其他', date: '2026-01-01' })) });
    assert.strictEqual(n.pets.length, 20); assert.strictEqual(n.events.length, 3000);
    // CSV 防公式注入
    assert.strictEqual(P.csvGuard('=SUM(A1)'), "'=SUM(A1)"); assert.strictEqual(P.csvGuard('+1'), "'+1"); assert.strictEqual(P.csvGuard('@x'), "'@x"); assert.strictEqual(P.csvGuard('-1'), "'-1"); assert.strictEqual(P.csvGuard('正常'), '正常');
    const evil = P.addPet({ pets: [], events: [] }, { name: '=cmd' }), e2 = P.addEvent(evil.d, evil.id, ev({ name: '@evil', note: '+1,"x"', val: '' }));
    const csv = P.toCsv(e2.d); assert.ok(csv.startsWith('寵物,日期,類型,項目,數值,單位,下次間隔,到期日,備註') && csv.includes("'=cmd") && csv.includes("'@evil") && csv.includes('"\'+1,""x"""') && csv.includes('2027-03-01') && csv.includes('12 個月'), csv);
    ok('pet-log');
}

// ---------- health-log ----------
{
    const H = load('utils/health-log.html', 'HL,REF,validDate,validTime,checkValues,normItem,normList,addItem,removeItem,judge,inRange,statsOf,toCsv,csvGuard');
    const bp = (o) => ({ date: '2026-10-20', time: '08:30', sys: '120', dia: '80', hr: '70', ctx: '晨起', note: '', ...o });
    let L = [], r = H.addItem(L, 'bp', bp({})); assert.ok(!r.err); L = r.list; assert.deepStrictEqual([L[0].k, L[0].sys, L[0].dia, L[0].hr, L[0].ctx], ['bp', 120, 80, 70, '晨起']);
    r = H.addItem(L, 'bp', bp({ hr: '' })); assert.strictEqual(r.list[1].hr, 0); L = r.list;
    for (const bad of [bp({ sys: '' }), bp({ sys: '49' }), bp({ sys: '301' }), bp({ dia: '29' }), bp({ dia: '201' }), bp({ sys: '80', dia: '90' }), bp({ sys: '80', dia: '80' }), bp({ hr: '19' }), bp({ hr: '251' }), bp({ hr: 'x' }), bp({ sys: 'abc' }), bp({ date: '' }), bp({ date: '2026-02-30' }), bp({ time: '25:00' }), bp({ time: '' }), bp({ note: 'n'.repeat(101) })]) assert.ok(H.addItem(L, 'bp', bad).err, JSON.stringify(bad));
    assert.ok(H.addItem(L, 'xx', bp({})).err);
    // 血糖 / 體重
    const bg = (o) => ({ date: '2026-10-20', time: '07:00', glu: '95', ctx: '空腹', note: '', ...o });
    for (const bad of [bg({ glu: '19' }), bg({ glu: '801' }), bg({ glu: '' }), bg({ glu: 'x' })]) assert.ok(H.addItem(L, 'bg', bad).err);
    const wt = (o) => ({ date: '2026-10-20', time: '07:00', kg: '60.55', ctx: '', note: '', ...o });
    for (const bad of [wt({ kg: '1.9' }), wt({ kg: '501' }), wt({ kg: '' })]) assert.ok(H.addItem(L, 'wt', bad).err);
    assert.strictEqual(H.addItem(L, 'wt', wt({})).list.at(-1).kg, 60.6);
    assert.strictEqual(H.addItem(L, 'bg', bg({ ctx: '亂寫' })).list.at(-1).ctx, '空腹');
    // 判讀（只對照參考範圍）
    const J = (o) => H.judge(H.normItem({ id: 'x', k: 'bp', date: '2026-10-20', time: '08:00', sys: 120, dia: 80, hr: 70, ctx: '一般', ...o }));
    assert.strictEqual(J({}).s, 'ok'); assert.strictEqual(J({ sys: 134, dia: 84 }).s, 'ok'); assert.strictEqual(J({ sys: 135 }).s, 'high'); assert.strictEqual(J({ dia: 85 }).s, 'high'); assert.ok(J({ sys: 142, dia: 92 }).t.includes('血壓偏高'));
    assert.strictEqual(J({ sys: 89, dia: 59 }).s, 'low'); assert.strictEqual(J({ sys: 90, dia: 60 }).s, 'ok'); assert.strictEqual(J({ sys: 100, dia: 59 }).s, 'low');
    assert.strictEqual(J({ hr: 101 }).s, 'high'); assert.strictEqual(J({ hr: 59 }).s, 'low'); assert.strictEqual(J({ hr: 130, ctx: '運動後' }).s, 'ok'); assert.strictEqual(J({ hr: 0 }).s, 'ok');
    const G = (glu, ctx) => H.judge(H.normItem({ id: 'x', k: 'bg', date: '2026-10-20', time: '08:00', glu, ctx }));
    assert.strictEqual(G(99, '空腹').s, 'ok'); assert.strictEqual(G(100, '空腹').s, 'high'); assert.strictEqual(G(69, '空腹').s, 'low'); assert.strictEqual(G(70, '空腹').s, 'ok');
    assert.strictEqual(G(139, '餐後 2 小時').s, 'ok'); assert.strictEqual(G(140, '餐後 2 小時').s, 'high'); assert.strictEqual(G(199, '隨機').s, 'ok'); assert.strictEqual(G(200, '隨機').s, 'high');
    assert.strictEqual(G(180, '餐前').s, 'na'); assert.strictEqual(G(180, '睡前').s, 'na'); assert.strictEqual(G(65, '睡前').s, 'low');
    assert.strictEqual(H.judge({ k: 'wt', kg: 60 }).s, 'na');
    // 範圍與統計
    const mk = (date, time, sys, dia, hr) => H.normItem({ id: date + time, k: 'bp', date, time, sys, dia, hr, ctx: '一般' });
    const items = [mk('2026-10-22', '08:00', 130, 80, 70), mk('2026-10-20', '20:00', 140, 90, 0), mk('2026-10-10', '08:00', 110, 70, 60), mk('2026-09-01', '08:00', 100, 60, 80), H.normItem({ id: 'w', k: 'wt', date: '2026-10-21', time: '07:00', kg: 60 })];
    assert.strictEqual(H.inRange(items, 'bp', 7, '2026-10-22').length, 2); assert.strictEqual(H.inRange(items, 'bp', 30, '2026-10-22').length, 3); assert.strictEqual(H.inRange(items, 'bp', 0, '2026-10-22').length, 4);
    assert.strictEqual(H.inRange(items, 'bp', 7, '2026-10-22')[0].date, '2026-10-20');            // 舊到新
    assert.strictEqual(H.inRange(items, 'bp', 1, '2026-10-22').length, 1);
    let st = H.statsOf(H.inRange(items, 'bp', 30, '2026-10-22'), 'bp');
    assert.deepStrictEqual(st.sys, { avg: 126.7, max: 140, min: 110 }); assert.deepStrictEqual(st.hr, { avg: 65, max: 70, min: 60 }); assert.strictEqual(st.out, 1); assert.strictEqual(st.n, 3);
    assert.strictEqual(H.statsOf([], 'bp').sys, null); assert.strictEqual(H.statsOf([], 'wt').last, null);
    const wts = [60, 59.5, 61].map((kg, i) => H.normItem({ id: 'w' + i, k: 'wt', date: '2026-10-0' + (i + 1), time: '07:00', kg })); st = H.statsOf(wts, 'wt');
    assert.deepStrictEqual([st.last, st.change, st.kg.max, st.kg.min], [61, 1, 61, 59.5]);
    // 刪除、上限
    assert.strictEqual(H.removeItem(items, 'w').length, 4); assert.strictEqual(H.removeItem(items, 'nope').length, 5);
    const big = Array.from({ length: 5000 }, (_, i) => ({ id: 'i' + i })); assert.ok(H.addItem(big, 'bp', bp({})).err.includes('5000'));
    // 載入驗證
    for (const bad of [null, 'x', 5, {}, [null, 1, 'a', {}]]) assert.deepStrictEqual(H.normList(bad), []);
    const n = H.normList([{ id: 'a', k: 'bp', date: '2026-10-20', time: '08:00', sys: 120, dia: 80, hr: 0, ctx: 'zz', note: 7 }, { id: 'a', k: 'bp', date: '2026-10-20', time: '08:00', sys: 120, dia: 80 }, { id: 'b', k: 'bp', date: '2026-10-20', time: '08:00', sys: 80, dia: 120 }, { id: 'c', k: 'bg', date: 'x', time: '08:00', glu: 90 }, { id: 'd', k: 'bg', date: '2026-10-20', time: '8:00', glu: 90 }, { id: 'e', k: 'wt', date: '2026-10-20', time: '08:00', kg: 'x' }]);
    assert.strictEqual(n.length, 1); assert.deepStrictEqual([n[0].hr, n[0].ctx, n[0].note], [0, '一般', '']);
    assert.strictEqual(H.normList(Array.from({ length: 5100 }, (_, i) => ({ id: 'x' + i, k: 'wt', date: '2026-10-20', time: '08:00', kg: 60 }))).length, 5000);
    // 匯出 CSV 防公式注入
    const evil = H.normItem({ id: 'z', k: 'bg', date: '2026-10-20', time: '08:00', glu: 90, ctx: '空腹', note: '=HYPERLINK("x")' });
    const csv = H.toCsv([evil, items[0]]); assert.ok(csv.startsWith('日期,時間,類型') && csv.includes(`"'=HYPERLINK(""x"")"`) && csv.includes('在一般參考範圍') && csv.includes('血壓') && csv.includes('血糖'), csv);
    assert.strictEqual(H.csvGuard('=1'), "'=1"); assert.strictEqual(H.csvGuard('\t1'), "'\t1");
    ok('health-log');
}
