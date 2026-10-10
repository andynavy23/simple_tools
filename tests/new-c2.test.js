// 批次 c2：timestamp 的 ID 分頁（自動判斷 ObjectId / UUID / ULID / KSUID / Snowflake）、random-data 的 UUID v7 / ULID（單調遞增）
const { load, ok } = require('./_load');
const assert = require('assert');
const U = require('../shared/js/util.js');

// ===== timestamp：ID 分頁 =====
{
    const m = load('utils/timestamp.html', 'classifyId, snowflakeEpoch, idRows, idTableText, idRangeInfo, splitOids');
    const NOW = Date.UTC(2026, 0, 1), TZ = 'Asia/Taipei';
    const type = (s, e) => { const c = m.classifyId(s, e); return c.ok ? c.type : 'bad'; };
    // 每種類型的真實樣本
    assert.equal(type('507f1f77bcf86cd799439011'), 'objectid');
    assert.equal(type('017F22E2-79B0-7CC3-98C4-DC0C0C07398F'), 'uuid');
    assert.equal(type('3f2504e04f8941d39a0c0305e82c3301'), 'uuid');            // 32 位無連字號、合乎 v4 / RFC variant
    assert.equal(type('{3F2504E0-4F89-41D3-9A0C-0305E82C3301}'), 'uuid');
    assert.equal(type('urn:uuid:017f22e2-79b0-7cc3-98c4-dc0c0c07398f'), 'uuid');
    assert.equal(type('01ARZ3NDEKTSV4RRFFQ69G5FAV'), 'ulid');
    assert.equal(type('01arz3ndektsv4rrffq69g5fav'), 'ulid');
    assert.equal(type('0ujsswThIGTUYm2K8FjOOfXtY1K'), 'ksuid');
    assert.equal(type('175928847299117063'), 'snowflake');                       // Discord 範例
    // 歧義：32 位 16 進位無連字號
    const c32 = m.classifyId('3f2504e04f8941d39a0c0305e82c3301'); assert.deepEqual(c32.alts, ['MD5 等 128 位元雜湊']);
    assert.equal(m.classifyId('d41d8cd98f00b204e9800998ecf8427e').ok, false);   // MD5("") 版本位元是 0 → 不是 UUID
    assert.ok(m.classifyId('d41d8cd98f00b204e9800998ecf8427e').reason.includes('MD5'));
    assert.equal(type('00000000-0000-0000-0000-000000000000'), 'uuid');          // Nil UUID：有連字號就當 UUID
    assert.equal(m.classifyId('175928847299117063').alts.length, 1);
    // 無效與邊界
    assert.ok(m.classifyId('abc').reason.includes('長度為 3'));
    assert.ok(m.classifyId('z'.repeat(24)).reason.includes('16 進位'));
    assert.ok(m.classifyId('').reason.includes('長度為 0'));
    assert.ok(m.classifyId('1700000000').reason.includes('時間戳')); assert.ok(m.classifyId('1700000000000').reason.includes('時間戳'));
    assert.ok(m.classifyId('12345').reason.includes('長度為 5'));
    assert.ok(m.classifyId('9'.repeat(20)).reason.includes('64'));               // >= 2^64
    assert.ok(m.classifyId('81ARZ3NDEKTSV4RRFFQ69G5FAV').reason.includes('7'));    // ULID 首字元 > 7
    assert.ok(m.classifyId('01ARZ3NDEKTSV4RRFFQ69G5FAI').reason.includes('ULID')); // 含 I
    assert.ok(m.classifyId('A'.repeat(27)).ok);                                  // 27 位 base62 → KSUID
    assert.ok(m.classifyId('z'.repeat(27)).reason.includes('20'));               // 超出 20 位元組
    assert.ok(m.classifyId('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').reason.includes('UUID'));
    assert.ok(!m.classifyId(null).ok && !m.classifyId(undefined).ok);
    assert.ok(m.classifyId('17592884729911706', NaN).reason.includes('自訂起算'));
    // Snowflake epoch
    assert.equal(m.snowflakeEpoch('discord'), 1420070400000); assert.equal(m.snowflakeEpoch('twitter'), 1288834974657);
    assert.equal(m.snowflakeEpoch('custom', '1000'), 1000); assert.equal(m.snowflakeEpoch('custom', '0'), 0);
    for (const bad of ['', 'abc', '-1', '1.5', '1'.repeat(17)]) assert.ok(Number.isNaN(m.snowflakeEpoch('custom', bad)), bad);
    assert.ok(Number.isNaN(m.snowflakeEpoch('nope')));
    // Snowflake 各 epoch：1288834974657 + (id >> 22)
    const sid = String((BigInt(1700000000000 - 1288834974657) << 22n) | (3n << 17n) | (5n << 12n) | 77n);
    for (const [k, e] of [['twitter', 1288834974657], ['discord', 1420070400000], ['unix', 0]]) {
        const r = m.idRows([sid], 'UTC', NOW, m.snowflakeEpoch(k))[0]; assert.equal(r.ok, true);
        assert.equal(r.ms, 1700000000000 - 1288834974657 + e); assert.deepEqual(r.fields.slice(0, 3), [['Worker', '3'], ['Process', '5'], ['Sequence', '77']]);
    }
    assert.equal(m.idRows([sid], 'UTC', NOW, m.snowflakeEpoch('twitter'))[0].iso, '2023-11-14T22:13:20.000Z');
    const big = 175928847299117063n >> 22n;
    assert.equal(m.idRows(['175928847299117063'], 'UTC', NOW, m.snowflakeEpoch('twitter'))[0].ms, 1288834974657 + Number(big));
    assert.equal(m.idRows(['175928847299117063'], 'UTC', NOW)[0].ms, 1420070400000 + Number(big));
    // 混合清單
    const rows = m.idRows(['507F1F77BCF86CD799439011', '017f22e2-79b0-7cc3-98c4-dc0c0c07398f', '3F2504E0-4F89-41D3-9A0C-0305E82C3301', 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6', '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'nope'], TZ, NOW);
    assert.deepEqual(rows.map(r => r.ok && r.label), ['ObjectId', 'UUID v7', 'UUID v4', 'UUID v1', 'ULID', false]);
    assert.equal(rows[0].id, '507f1f77bcf86cd799439011'); assert.equal(rows[0].local, '2012-10-18 05:13:27（UTC+08:00）'); assert.deepEqual(rows[0].fields, [['隨機值（5 位元組）', 'bcf86cd799'], ['計數器', '4427793']]);
    assert.equal(rows[1].iso, '2022-02-22T19:22:22.000Z'); assert.equal(rows[1].utc, '2022-02-22 19:22:22'); assert.equal(rows[1].local, '2022-02-23 03:22:22（UTC+08:00）');
    assert.ok(rows[1].fields[0][1].startsWith('v7')); assert.equal(rows[1].fields[1][0], 'Variant');
    assert.equal(rows[2].ms, null); assert.equal(rows[2].note, '此版本不含時間'); assert.equal(rows[2].iso, undefined);
    assert.equal(rows[3].iso.slice(0, 10), '1997-02-03'); assert.ok(rows[3].fields.some(f => f[0] === 'Node' && f[1] === '00a0c91e6bf6'));
    assert.equal(rows[4].id, '01ARZ3NDEKTSV4RRFFQ69G5FAV'); assert.equal(rows[4].utc, '2016-07-30 23:54:10'); assert.deepEqual(rows[4].fields, [['隨機部分（80 位元）', 'TSV4RRFFQ69G5FAV']]);
    assert.equal(rows[5].ok, false);
    // KSUID
    const ks = m.idRows(['0ujsswThIGTUYm2K8FjOOfXtY1K'], 'UTC', NOW)[0]; assert.equal(ks.label, 'KSUID'); assert.equal(ks.fields[0][1].length, 32); assert.ok(ks.iso);
    // 表格
    const tsv = m.idTableText(rows, TZ).split('\n');
    assert.equal(tsv.length, 7); assert.equal(tsv[0].split('\t').length, 6); assert.equal(tsv[1].split('\t')[1], 'ObjectId'); assert.ok(tsv[3].split('\t')[2] === '此版本不含時間'); assert.ok(tsv[6].includes('無效：'));
    // 200 個上限沿用
    assert.equal(m.splitOids(Array.from({ length: 250 }, (_, i) => i).join(' ')).list.length, 200);
    // 時間 → UUID v7 / ULID 範圍
    const ri = m.idRangeInfo(1700000000000, 1700000001000);
    assert.match(ri.v7min, /^018bcfe5-6800-7000-8000-000000000000$/); assert.match(ri.v7max, /^018bcfe5-6be7-7fff-bfff-ffffffffffff$/);
    assert.match(ri.ulidMin, /^[0-7][0-9A-Z]{9}0{16}$/); assert.match(ri.ulidMax, /^[0-7][0-9A-Z]{9}Z{16}$/);
    assert.equal(U.ids.parseUuid(ri.v7min).ms, 1700000000000); assert.equal(U.ids.parseUuid(ri.v7max).ms, 1700000000999); assert.equal(U.ids.parseUlid(ri.ulidMax).ms, 1700000000999);
    assert.ok(ri.v7min < ri.v7max && ri.ulidMin < ri.ulidMax);
    const one = m.idRangeInfo(5, 6); assert.equal(U.ids.parseUlid(one.ulidMax).ms, 5);            // 單一毫秒
    assert.throws(() => m.idRangeInfo(-1, 0)); assert.throws(() => m.idRangeInfo(2 ** 48, 2 ** 48 + 1));
    ok('timestamp: ID tab classify / rows / table / v7+ULID range');
}

// ===== random-data：UUID v7 / ULID 單調遞增 =====
{
    const m = load('utils/random-data.html', 'monotonic, isAscending, baseMs, uuid4, validUuid4');
    const T = 1645557742000, V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, UL = /^[0-9A-HJKMNP-TV-Z]{26}$/;
    for (const kind of ['uuid7', 'ulid']) {
        // 同一毫秒 1000 筆：嚴格遞增、時間一致、格式正確、不重複
        const a = m.monotonic(kind, 1000, () => T);
        assert.equal(a.length, 1000); assert.ok(m.isAscending(a), kind); assert.equal(new Set(a).size, 1000);
        a.forEach(s => { assert.match(s, kind === 'uuid7' ? V7 : UL); assert.equal(kind === 'uuid7' ? U.ids.parseUuid(s).ms : U.ids.parseUlid(s).ms, T); });
        // 亂數固定為全 0：同毫秒內逐筆 +1（最後一個位元組 0,1,2…）
        const z = m.monotonic(kind, 3, () => T, () => 0);
        assert.deepEqual(z.map(s => s.slice(-2)), ['00', '01', '02']);
        assert.ok(z[1] > z[0] && z[2] > z[1]);
        // 溢位：亂數全 255 → 同毫秒下一筆溢位，時間 +1ms 且仍遞增
        const o = m.monotonic(kind, 3, () => T, () => 255);
        assert.ok(m.isAscending(o)); const ms = (s) => kind === 'uuid7' ? U.ids.parseUuid(s).ms : U.ids.parseUlid(s).ms;
        assert.deepEqual(o.map(ms), [T, T + 1, T + 2]);
        // 時間推進：每筆時間不同、遞增；時間倒退時沿用上一個時間（仍嚴格遞增）
        let t = T; const b = m.monotonic(kind, 50, () => (t += 3)); assert.ok(m.isAscending(b)); assert.deepEqual(b.map(ms), Array.from({ length: 50 }, (_, i) => T + 3 * (i + 1)));
        const back = [T + 10, T + 5, T + 5, T + 20]; let i = 0; const c = m.monotonic(kind, 4, () => back[i++]);
        assert.ok(m.isAscending(c)); assert.deepEqual(c.map(ms), [T + 10, T + 10, T + 10, T + 20]);
        // 現在：整批遞增，時間在呼叫前後之間
        const before = Date.now(), d = m.monotonic(kind, 1000, Date.now), after = Date.now(); assert.ok(m.isAscending(d));
        d.forEach(s => { assert.ok(ms(s) >= before && ms(s) <= after + 1); });
        assert.deepEqual(m.monotonic(kind, 0, () => T), []);
        assert.throws(() => m.monotonic(kind, 1, () => -1)); assert.throws(() => m.monotonic(kind, 1, () => 2 ** 48));
    }
    // 大寫 / 去連字號後字典序仍等於時間序（頁面的選項只是字串轉換）
    const u = m.monotonic('uuid7', 200, () => T); assert.ok(m.isAscending(u.map(s => s.toUpperCase()))); assert.ok(m.isAscending(u.map(s => s.replace(/-/g, ''))));
    // 跨毫秒排序：不同時間的字串排序 = 時間排序
    const mix = [T + 1000, T, T + 5].map(x => m.monotonic('ulid', 1, () => x)[0]); assert.deepEqual([...mix].sort(), [mix[1], mix[2], mix[0]]);
    assert.equal(m.isAscending([]), true); assert.equal(m.isAscending(['a', 'a']), false); assert.equal(m.isAscending(['a', 'b']), true);
    // 指定時間
    assert.equal(m.baseMs('2022-02-22T19:22:22'), new Date('2022-02-22T19:22:22').getTime());
    for (const bad of ['', 'abc', undefined]) assert.throws(() => m.baseMs(bad), /指定時間/);
    // 既有 UUID v4 不受影響
    for (let i = 0; i < 100; i++) assert.ok(m.validUuid4(m.uuid4()));
    ok('random-data: uuid7 / ulid monotonic');
}
