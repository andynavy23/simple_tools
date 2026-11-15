// 批次 u2：旅行行程（trip-kit）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/trip-kit.html', 'hav, parsePts, solveRoute, tspHeur, tspExact, pathLen, icsEsc, icsBuild, budget, parkFee, cleanTrips, cleanPark, parseLatLng, tripText, dayList, okPhoto, MAX_ITEMS');
{
    const d = m.hav({ lat: 25.0478, lng: 121.5170 }, { lat: 24.1369, lng: 120.6850 });
    assert.ok(d > 130 && d < 140, 'taipei-taichung ' + d);
    assert.equal(m.hav({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);
    ok('trip-kit haversine');
}
{
    const { pts, bad } = m.parsePts('台北,25,121\n  \nbad,x,y\n高雄，22.6，120.3\n名,有,逗號,24,120\nlat,91,0');
    assert.equal(pts.length, 3); assert.equal(bad.length, 2); assert.equal(pts[2].name, '名,有,逗號');
    assert.equal(m.parsePts(Array.from({ length: 20 }, (_, i) => `p${i},${i},${i}`).join('\n')).pts.length, 15);
    ok('trip-kit parsePts');
}
{
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let worst = 1, sum = 0, cnt = 0;
    for (let k = 0; k < 40; k++) for (const back of [false, true]) {
        const n = 5 + (k % 4), pts = Array.from({ length: n }, () => ({ lat: 22 + rnd() * 3, lng: 120 + rnd() * 2 }));
        const D = pts.map(a => pts.map(b => m.hav(a, b)));
        const e = m.pathLen(m.tspExact(D, back), D, back), h = m.pathLen(m.tspHeur(D, back), D, back);
        assert.ok(h >= e - 1e-9); worst = Math.max(worst, h / e); sum += h / e; cnt++;
    }
    assert.ok(worst < 1.4 && sum / cnt < 1.06, `worst ${worst} avg ${sum / cnt}`);
    const r = m.solveRoute(Array.from({ length: 12 }, (_, i) => ({ lat: 23 + (i % 4) * 0.3, lng: 120 + Math.floor(i / 4) * 0.3 })), false);
    assert.equal(r.exact, false); assert.equal(new Set(r.order).size, 12); assert.equal(r.order[0], 0);
    assert.ok(m.solveRoute([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 2 }], false).exact);
    // 直線上的點：起點在一端，最佳順序即排序
    const line = [0, 3, 1, 2].map(x => ({ lat: 0, lng: x })), L = m.solveRoute(line, false);
    assert.deepEqual(L.order.map(i => line[i].lng), [0, 1, 2, 3]);
    ok('trip-kit tsp');
}
{
    assert.equal(m.icsEsc('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
    const trip = { cur: 'NT$', items: [{ id: 'x1', date: '2026-12-01', time: '09:30', place: '一,二;三', note: '行1\n行2', mode: '步行', cost: 100 }, { id: 'x2', date: '2026-12-01', time: '', place: '全天', note: '', mode: '', cost: 0 }] };
    const ics = m.icsBuild(trip, 8, Date.UTC(2026, 0, 1));
    assert.ok(ics.includes('DTSTART:20261201T013000Z') && ics.includes('DTEND:20261201T023000Z') && ics.includes('SUMMARY:一\\,二\\;三') && ics.includes('DESCRIPTION:步行\\nNT$100\\n行1\\n行2'));
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20261201') && ics.includes('DTEND;VALUE=DATE:20261202') && ics.endsWith('END:VCALENDAR\r\n'));
    ok('trip-kit ics');
}
{
    const t = m.cleanTrips([{ id: 'a', name: 'x'.repeat(99), start: '2026-12-01', end: '2026-12-03', cur: 'NT$', items: [
        { id: 'i1', date: '2026-12-01', time: '10:00', place: 'A', cost: 50 }, { id: 'i2', date: '2026-12-01', time: '08:00', place: 'B', cost: '30' },
        { date: '2026-12-02', place: 'C', cost: -5 }, { date: 'bad', place: 'D' }, null, { date: '2026-12-02', place: '' }] },
        { start: '2026-12-05', end: '2026-12-01' }, null, { start: '2026-01-01', end: '2026-12-31' }]);
    assert.equal(t.length, 1); assert.equal(t[0].name.length, 40); assert.equal(t[0].items.length, 3);
    const b = m.budget(t[0]); assert.equal(b.total, 80); assert.equal(b.byDay['2026-12-01'], 80);
    assert.ok(m.tripText(t[0]).indexOf('08:00') < m.tripText(t[0]).indexOf('10:00'));
    for (const bad of [null, 5, 'x', {}, [null]]) assert.deepEqual(m.cleanTrips(bad), []);
    const many = Array.from({ length: 30 }, () => ({ start: '2026-12-01', end: '2026-12-02', items: Array.from({ length: 400 }, () => ({ date: '2026-12-01', place: 'p' })) }));
    const c = m.cleanTrips(many); assert.equal(c.length, 20); assert.equal(c[0].items.length, m.MAX_ITEMS);
    assert.equal(m.dayList('2026-12-01', '2026-12-03').length, 3); assert.equal(m.dayList('2026-02-30', '2026-03-03').length, 0);
    ok('trip-kit trips');
}
{
    const c = { rate: 30, cap: 200, free: 15 };
    assert.equal(m.parkFee(10, c), 0); assert.equal(m.parkFee(15, c), 0); assert.equal(m.parkFee(16, c), 30);
    assert.equal(m.parkFee(61, c), 60); assert.equal(m.parkFee(600, c), 200); assert.equal(m.parkFee(1440 + 30, c), 230);
    assert.equal(m.parkFee(1500, { rate: 10, cap: 0, free: 0 }), 240 + 10);
    assert.equal(m.parkFee(-5, c), 0);
    const jpg = 'data:image/jpeg;base64,AAAA';
    assert.ok(m.okPhoto(jpg) && !m.okPhoto('data:image/png;base64,AAA') && !m.okPhoto(jpg + 'A'.repeat(60000)) && !m.okPhoto(5));
    const p = m.cleanPark({ cur: { t: 5, floor: 'B2', lat: 25, lng: 'x', photo: 'javascript:1' }, hist: Array.from({ length: 15 }, (_, i) => ({ id: 'h' + i, t: 100 + i, end: 50, fee: 'a' })).concat([null, { t: 'x' }]), cfg: { rate: -1, cap: 'z', free: 9999 } });
    assert.equal(p.cur.lat, null); assert.equal(p.cur.photo, ''); assert.equal(p.hist.length, 10); assert.equal(p.hist[0].end, 100); assert.equal(p.hist[0].fee, 0);
    assert.deepEqual(p.cfg, { rate: 30, cap: 0, free: 0 });
    for (const bad of [null, 3, 'x', []]) { const q = m.cleanPark(bad); assert.ok(q.cur === null && q.hist.length === 0); }
    assert.deepEqual(m.parseLatLng('25.0478, 121.5170'), { lat: 25.0478, lng: 121.517 }); assert.equal(m.parseLatLng('95,0'), null); assert.equal(m.parseLatLng('abc'), null);
    ok('trip-kit parking');
}
