// 批次 g5：網路與容量計算（net-calc）、檔案檢視器（file-inspector）
const assert = require('assert');
const { load, ok, near } = require('./_load');

// ---------- net-calc ----------
{
    const m = load('utils/net-calc.html', 'parseIPv4, ipv4Str, parseIPv4Any, parseIPv6, ipv6Str, parseCidr, cidrInfo, ipInCidr, splitCidr, prefixForHosts, classifyV4, classifyV6, ptr6, parseMac, macFormats, macInfo, calcDownload, fmtDuration, fmtBytes, downtime, parsePctList, seriesAvail, parallelAvail, calcCapacity, big');
    assert.strictEqual(m.parseIPv4('192.168.1.1'), 3232235777);
    assert.strictEqual(m.parseIPv4('256.1.1.1'), null); assert.strictEqual(m.parseIPv4('1.2.3'), null); assert.strictEqual(m.parseIPv4('1.2.3.4.5'), null);
    assert.strictEqual(m.ipv4Str(3232235777), '192.168.1.1'); assert.strictEqual(m.ipv4Str(0xffffffff), '255.255.255.255');
    assert.strictEqual(m.parseIPv4Any('0xC0A80101'), 3232235777); assert.strictEqual(m.parseIPv4Any('3232235777'), 3232235777);
    assert.strictEqual(m.parseIPv4Any('11000000101010000000000100000001'), 3232235777); assert.strictEqual(m.parseIPv4Any('4294967296'), null);
    assert.strictEqual(m.parseIPv4Any('0b1'), 1);
    // IPv6
    assert.strictEqual(m.parseIPv6('::'), 0n); assert.strictEqual(m.parseIPv6('::1'), 1n);
    assert.strictEqual(m.ipv6Str(m.parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')), '2001:db8::1');
    assert.strictEqual(m.ipv6Str(m.parseIPv6('2001:db8::1'), true), '2001:0db8:0000:0000:0000:0000:0000:0001');
    assert.strictEqual(m.ipv6Str(m.parseIPv6('::ffff:192.0.2.1')), '::ffff:c000:201');
    assert.strictEqual(m.ipv6Str(m.parseIPv6('1:0:0:2:0:0:0:3')), '1:0:0:2::3');           // 取最長的零段
    assert.strictEqual(m.ipv6Str(m.parseIPv6('1:0:2:0:3:0:4:5')), '1:0:2:0:3:0:4:5');      // 單一零不縮
    assert.strictEqual(m.ipv6Str(m.parseIPv6('fe80::1%eth0')), 'fe80::1');
    for (const bad of ['1::2::3', ':1:2:3:4:5:6:7', '1:2:3:4:5:6:7', '12345::1', 'g::1', '1:2:3:4:5:6:7:8:9', ':::', '1.2.3.4', '::1.2.3.256']) assert.strictEqual(m.parseIPv6(bad), null, bad);
    assert.ok(m.parseIPv6('1:2:3:4:5:6:7::') !== null);
    assert.strictEqual(m.ipv6Str(m.parseIPv6('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')), 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    assert.strictEqual(m.ptr6(m.parseIPv6('2001:db8::1')), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
    // CIDR
    let c = m.parseCidr('192.168.1.10/24'), i = m.cidrInfo(c);
    assert.strictEqual(m.ipv4Str(Number(i.net)), '192.168.1.0'); assert.strictEqual(m.ipv4Str(Number(i.last)), '192.168.1.255');
    assert.strictEqual(i.hosts, 254n); assert.strictEqual(m.ipv4Str(Number(i.first)), '192.168.1.1'); assert.strictEqual(m.ipv4Str(Number(i.lastH)), '192.168.1.254');
    assert.strictEqual(m.ipv4Str(Number(i.mask)), '255.255.255.0');
    assert.strictEqual(m.parseCidr('10.0.0.5/255.255.255.0').prefix, 24); assert.strictEqual(m.parseCidr('10.0.0.5/255.255.254.0').prefix, 23);
    assert.strictEqual(m.parseCidr('10.0.0.5/255.0.255.0'), null); assert.strictEqual(m.parseCidr('10.0.0.5/33'), null); assert.strictEqual(m.parseCidr('10.0.0.5/0.0.0.0').prefix, 0);
    assert.strictEqual(m.parseCidr('1.2.3.4').prefix, 32); assert.strictEqual(m.parseCidr('1.2.3.4/24/1'), null); assert.strictEqual(m.parseCidr('x/24'), null);
    assert.strictEqual(m.cidrInfo(m.parseCidr('10.0.0.0/31')).hosts, 2n); assert.strictEqual(m.cidrInfo(m.parseCidr('10.0.0.1/32')).hosts, 1n);
    assert.strictEqual(m.cidrInfo(m.parseCidr('0.0.0.0/0')).size, 2n ** 32n);
    assert.strictEqual(m.cidrInfo(m.parseCidr('10.0.0.0/30')).hosts, 2n);
    c = m.parseCidr('2001:db8::/32'); i = m.cidrInfo(c);
    assert.strictEqual(m.ipv6Str(i.last), '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff'); assert.strictEqual(i.size, 2n ** 96n);
    assert.strictEqual(m.cidrInfo(m.parseCidr('::/0')).size, 2n ** 128n);
    // 屬於判斷
    c = m.parseCidr('192.168.1.0/24');
    assert.ok(m.ipInCidr('192.168.1.200', c)); assert.ok(!m.ipInCidr('192.168.2.1', c)); assert.ok(!m.ipInCidr('::1', c)); assert.ok(!m.ipInCidr('zz', c));
    assert.ok(m.ipInCidr('2001:db8:1::5', m.parseCidr('2001:db8::/32'))); assert.ok(!m.ipInCidr('2001:db9::1', m.parseCidr('2001:db8::/32')));
    // 切子網
    let s = m.splitCidr(m.parseCidr('192.168.1.0/24'), 26);
    assert.strictEqual(s.count, 4n); assert.deepStrictEqual(s.list.map(n => m.ipv4Str(Number(n))), ['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192']);
    assert.strictEqual(m.splitCidr(m.parseCidr('192.168.1.0/24'), 24), null); assert.strictEqual(m.splitCidr(m.parseCidr('192.168.1.0/24'), 33), null);
    s = m.splitCidr(m.parseCidr('2001:db8::/32'), 64); assert.strictEqual(s.count, 2n ** 32n); assert.strictEqual(s.list.length, 256);
    assert.strictEqual(m.ipv6Str(s.list[1]), '2001:db8:0:1::');
    // 主機數 → 前綴
    assert.strictEqual(m.prefixForHosts(254), 24); assert.strictEqual(m.prefixForHosts(255), 23); assert.strictEqual(m.prefixForHosts(500), 23); assert.strictEqual(m.prefixForHosts(2), 30); assert.strictEqual(m.prefixForHosts(1), 32);
    assert.strictEqual(m.prefixForHosts(0), null); assert.strictEqual(m.prefixForHosts(2 ** 32), null);
    // 類型
    for (const [ip, w] of [['10.1.2.3', '私有'], ['172.16.0.1', '私有'], ['172.32.0.1', '公網'], ['192.168.0.1', '私有'], ['127.0.0.1', '環回'], ['169.254.1.1', 'link-local'], ['100.64.0.1', 'CGNAT'], ['224.0.0.1', '群播'], ['8.8.8.8', '公網'], ['255.255.255.255', '廣播'], ['240.0.0.1', '保留'], ['0.1.2.3', '本網路']]) assert.ok(m.classifyV4(m.parseIPv4(ip)).includes(w), ip);
    for (const [ip, w] of [['::', '未指定'], ['::1', '環回'], ['fe80::1', 'link-local'], ['fd12::1', 'ULA'], ['ff02::1', '群播'], ['2001:db8::1', '文件'], ['2606:4700::1', 'global unicast'], ['::ffff:1.2.3.4', 'IPv4 對映'], ['2002::1', '6to4'], ['64:ff9b::1', 'NAT64']]) assert.ok(m.classifyV6(m.parseIPv6(ip)).includes(w), ip);
    // MAC
    const b = m.parseMac('00-0c-29:4F.8a 01'); assert.deepStrictEqual(b, [0, 12, 41, 79, 138, 1]);
    assert.strictEqual(m.parseMac('000c294f8a01').length, 6); assert.strictEqual(m.parseMac('000c.294f.8a01').length, 6); assert.strictEqual(m.parseMac('00:0c:29'), null); assert.strictEqual(m.parseMac('zz0c294f8a01'), null);
    const f = Object.fromEntries(m.macFormats(b));
    assert.strictEqual(f['冒號（Linux / 一般）'], '00:0c:29:4f:8a:01'); assert.strictEqual(f['連字號（Windows）'], '00-0C-29-4F-8A-01'); assert.strictEqual(f['點分（Cisco）'], '000c.294f.8a01');
    let mi = m.macInfo(b); assert.deepStrictEqual([mi.multicast, mi.local, mi.oui], [false, false, 'VMware']);
    mi = m.macInfo(m.parseMac('01:00:5e:00:00:01')); assert.ok(mi.multicast && !mi.local && !mi.oui);
    mi = m.macInfo(m.parseMac('02:42:ac:11:00:02')); assert.ok(mi.local && !mi.multicast && mi.oui.includes('Docker'));
    assert.ok(m.macInfo(m.parseMac('ff:ff:ff:ff:ff:ff')).broadcast);
    // 下載
    let d = m.calcDownload(100, 'MB', 8, 'Mbps', 100); near(d.idealSec, 100); near(d.ideal, 1e6);
    d = m.calcDownload(1, 'GiB', 1, 'GB/s', 50); near(d.bytes, 1073741824); near(d.realSec, 1073741824 / 5e8);
    d = m.calcDownload(4.7, 'GB', 100, 'Mbps', 90); near(d.realSec, 4.7e9 / (12.5e6 * 0.9));
    assert.strictEqual(m.calcDownload(0, 'MB', 1, 'Mbps', 90), null); assert.strictEqual(m.calcDownload(1, 'MB', 1, 'Mbps', 0), null); assert.strictEqual(m.calcDownload(1, 'MB', 1, 'Mbps', 101), null); assert.strictEqual(m.calcDownload(1, 'XB', 1, 'Mbps', 90), null);
    assert.strictEqual(m.fmtDuration(0.5), '500.0 毫秒'); assert.strictEqual(m.fmtDuration(45), '45.0 秒'); assert.strictEqual(m.fmtDuration(3725), '1 小時 2 分 5 秒'); assert.strictEqual(m.fmtDuration(90061), '1 天 1 小時 1 分 1 秒'); assert.strictEqual(m.fmtDuration(120), '2 分 0 秒');
    assert.strictEqual(m.fmtBytes(1536, true), '1.5 KiB'); assert.strictEqual(m.fmtBytes(1500), '1.5 KB'); assert.strictEqual(m.fmtBytes(12), '12 B');
    // SLA
    near(m.downtime(99.9).year, 31536); assert.strictEqual(m.fmtDuration(m.downtime(99.9).year), '8 小時 45 分 36 秒');
    near(m.downtime(99.99).day, 8.64); near(m.downtime(100).year, 0); assert.strictEqual(m.downtime(101), null); assert.strictEqual(m.downtime(NaN), null);
    assert.deepStrictEqual(m.parsePctList('99.9, 99.95，99'), [99.9, 99.95, 99]); assert.strictEqual(m.parsePctList('abc'), null); assert.strictEqual(m.parsePctList('101'), null); assert.strictEqual(m.parsePctList(''), null);
    near(m.seriesAvail([99.9, 99.9]), 99.8001); near(m.parallelAvail([99, 99]), 99.99); near(m.seriesAvail([100]), 100);
    // 容量
    const cap = m.calcCapacity({ qps: 500, lat: 120, peak: 3, cap: 200, resp: 50, rec: 1e6, bytes: 1024, days: 365, rep: 3 });
    near(cap.avgConc, 60); near(cap.peakConc, 180); assert.strictEqual(cap.servers, 1); near(cap.mbps, 600); near(cap.perDay, 3 * 1024e6); near(cap.total, 3 * 1024e6 * 365); near(cap.reqDay, 43200000);
    assert.strictEqual(m.calcCapacity({ qps: 1, lat: 1, peak: 1, cap: 0, resp: 0, rec: 0, bytes: 0, days: 0, rep: 1 }).servers, null);
    assert.strictEqual(m.calcCapacity({ qps: -1, lat: 1, peak: 1, cap: 0, resp: 0, rec: 0, bytes: 0, days: 0, rep: 1 }), null); assert.strictEqual(m.calcCapacity({ qps: NaN, lat: 1, peak: 1, cap: 0, resp: 0, rec: 0, bytes: 0, days: 0, rep: 1 }), null);
    assert.strictEqual(m.big(1234567n), '1,234,567');
    ok('net-calc: 純邏輯');
}
