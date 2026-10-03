// 共用模組測試：node tests/shared.test.js
// P2PRoom 用「記憶體內的假 PeerJS」驗證整個連線協定，不需要網路。
const assert = require('assert');
const path = require('path');

// ---------- 假 PeerJS ----------
class Emitter {
    constructor() { this.h = {}; }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; }
    emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); }
}
const registry = new Map();
let seq = 0;
class Conn extends Emitter {
    constructor(remoteId) { super(); this.peer = remoteId; this.open = false; this.pair = null; }
    send(d) {
        if (!this.open) throw new Error('connection closed');
        const m = JSON.parse(JSON.stringify(d));
        setTimeout(() => { if (this.pair && this.pair.open) this.pair.emit('data', m); }, 0);
    }
    close() {
        if (!this.open) return;
        this.open = false;
        setTimeout(() => this.emit('close'), 0);
        const p = this.pair;
        if (p && p.open) { p.open = false; setTimeout(() => p.emit('close'), 0); }
    }
}
class FakePeer extends Emitter {
    constructor() {
        super();
        this.id = 'peer' + (++seq);
        registry.set(this.id, this);
        this.conns = [];
        setTimeout(() => this.emit('open', this.id), 0);
    }
    connect(id) {
        const target = registry.get(id), c = new Conn(id);
        if (!target) { setTimeout(() => this.emit('error', { type: 'peer-unavailable' }), 0); return c; }
        const r = new Conn(this.id);
        c.pair = r; r.pair = c;
        this.conns.push(c); target.conns.push(r);
        setTimeout(() => { target.emit('connection', r); r.open = true; c.open = true; c.emit('open'); r.emit('open'); }, 0);
        return c;
    }
    destroy() { registry.delete(this.id); this.conns.forEach(c => c.close()); }
}
global.Peer = FakePeer;
global.location = { origin: 'https://x.io', pathname: '/game-assist/rjpq.html', hash: '#abc123' };

const P2PRoom = require(path.join(__dirname, '../shared/js/p2p-room.js'));
const Util = require(path.join(__dirname, '../shared/js/util.js'));
const wait = (ms = 150) => new Promise(r => setTimeout(r, ms));

// 建立房主並等到就緒
async function makeHost(extra = {}) {
    const ev = { joins: [], leaves: [], msgs: [], errors: [] };
    const room = P2PRoom.host({
        nick: '房主', maxPlayers: 3,
        onJoin: (p, info) => ev.joins.push({ nick: p.nick, index: p.index, rejoined: info.rejoined, data: p.data }),
        onLeave: (p) => ev.leaves.push({ nick: p.nick, index: p.index }),
        onMessage: (p, d) => ev.msgs.push({ from: p.nick, d }),
        onError: (e, m) => ev.errors.push({ e, m }),
        ...extra,
    });
    await wait();
    return { room, ev };
}

function makeGuest(id, nick, extra = {}) {
    const ev = { joined: 0, roster: [], msgs: [], rejected: null, closed: null, errors: [] };
    const room = P2PRoom.join(id, {
        nick, timeoutMs: 1500,
        onJoined: () => ev.joined++,
        onRoster: (players, me) => ev.roster.push({ nicks: players.map(p => p.nick + (p.connected ? '' : '(x)')), me }),
        onMessage: (d) => ev.msgs.push(d),
        onRejected: (r) => { ev.rejected = r; },
        onClose: (c) => { ev.closed = c; },
        onError: (e, m) => ev.errors.push({ e, m }),
        ...extra,
    });
    return { room, ev };
}

const ok = (name) => console.log('ok  ' + name);

(async () => {
    // ---------- 暱稱規則 ----------
    assert.ok(P2PRoom.validNick('小明123') && P2PRoom.validNick('abc'));
    assert.ok(!P2PRoom.validNick('<b>') && !P2PRoom.validNick('') && !P2PRoom.validNick('a'.repeat(11)) && !P2PRoom.validNick(null) && !P2PRoom.validNick(5));
    assert.ok(P2PRoom.validNick('a'.repeat(30), 30));
    assert.equal(P2PRoom.roomFromUrl(), 'abc123');
    assert.equal(P2PRoom.inviteLink('zzz'), 'https://x.io/game-assist/rjpq.html#zzz');
    ok('nick / url helpers');

    // ---------- 建房、加入、名單 ----------
    {
        const { room: host, ev: hev } = await makeHost();
        assert.ok(host.id && host.players.length === 1 && host.players[0].nick === '房主');
        const g1 = makeGuest(host.id, '小明', { data: { color: 'red' } });
        await wait();
        assert.equal(g1.ev.joined, 1);
        assert.equal(g1.room.myIndex, 1);
        assert.deepEqual(hev.joins, [{ nick: '小明', index: 1, rejoined: false, data: { color: 'red' } }]);
        const g2 = makeGuest(host.id, '小華');
        await wait();
        assert.deepEqual(g1.ev.roster.at(-1), { nicks: ['房主', '小明', '小華'], me: 1 });   // 舊成員也收到新名單
        assert.deepEqual(g2.ev.roster.at(-1), { nicks: ['房主', '小明', '小華'], me: 2 });
        ok('host / join / roster');

        // ---------- 訊息 ----------
        g1.room.send({ type: 'FLIP', i: 3 });
        await wait();
        assert.deepEqual(hev.msgs, [{ from: '小明', d: { type: 'FLIP', i: 3 } }]);
        host.broadcast({ hello: 1 });
        host.sendTo(2, { only: 'g2' });
        host.broadcast({ skip: 1 }, 1);
        await wait();
        assert.deepEqual(g1.ev.msgs, [{ hello: 1 }]);
        assert.deepEqual(g2.ev.msgs, [{ hello: 1 }, { only: 'g2' }, { skip: 1 }]);
        ok('messages: send / broadcast / sendTo / except');

        // ---------- 拒絕 ----------
        const dup = makeGuest(host.id, '小明'); await wait();
        assert.equal(dup.ev.rejected, '暱稱已有人使用');
        const full = makeGuest(host.id, '阿強'); await wait();           // maxPlayers 3：房主+2 人已滿
        assert.equal(full.ev.rejected, '房間已滿');
        const bad = makeGuest(host.id, 'x'); bad.room.destroy();         // 暱稱合法但已銷毀 → 不會有任何回呼
        const badNick = makeGuest(host.id, '<b>'); await wait();
        assert.equal(badNick.ev.errors[0].e.type, 'bad-nick');
        assert.equal(host.players.length, 3);
        ok('reject: duplicate / full / bad nick');

        // ---------- 未加入者不能送訊息；忽略偽造的協定訊息 ----------
        const stranger = new FakePeer();
        const sc = stranger.connect(host.id);
        await wait();
        sc.send({ _r: 'APP', d: 'evil' });
        sc.send({ _r: 'WELCOME', index: 0, players: [] });
        sc.send({ _r: 'ROSTER', players: [], index: 0 });
        await wait();
        assert.equal(hev.msgs.length, 1);                                 // 沒有新增
        assert.equal(host.players.length, 3);
        ok('stranger messages ignored');

        // ---------- 離開（keepSlots=false）：移除並前移 ----------
        g1.room.destroy();
        await wait();
        assert.deepEqual(hev.leaves, [{ nick: '小明', index: 1 }]);
        assert.deepEqual(host.players.map(p => [p.index, p.nick]), [[0, '房主'], [1, '小華']]);
        assert.deepEqual(g2.ev.roster.at(-1), { nicks: ['房主', '小華'], me: 1 });
        ok('leave (remove & reindex)');

        // ---------- 踢人 ----------
        host.kick(1, '違規');
        await wait(500);
        assert.deepEqual(g2.ev.closed, { kicked: true, reason: '違規' });
        assert.equal(host.players.length, 1);
        host.kick(0); host.kick(9);                                       // 踢自己 / 不存在：無事發生
        ok('kick');

        // ---------- 房主關閉 → 成員收到 close ----------
        const g3 = makeGuest(host.id, '阿美'); await wait();
        host.destroy();
        await wait();
        assert.deepEqual(g3.ev.closed, { kicked: false, reason: '' });
        ok('host destroy → guest onClose');
    }

    // ---------- canJoin 拒絕 ----------
    {
        let started = false;
        const { room: host } = await makeHost({ canJoin: () => (started ? '遊戲已開始' : null) });
        const a = makeGuest(host.id, '甲'); await wait();
        assert.equal(a.ev.joined, 1);
        started = true;
        const b = makeGuest(host.id, '乙'); await wait();
        assert.equal(b.ev.rejected, '遊戲已開始');
        assert.equal(host.players.length, 2);
        host.destroy();
        ok('canJoin veto');
    }

    // ---------- keepSlots：槽位保留與回到原位 ----------
    {
        const { room: host, ev } = await makeHost({ keepSlots: true, maxPlayers: 3 });
        const a = makeGuest(host.id, '甲'); await wait();
        const b = makeGuest(host.id, '乙'); await wait();
        a.room.destroy(); await wait();
        assert.deepEqual(host.players.map(p => [p.index, p.nick, p.connected]), [[0, '房主', true], [1, '甲', false], [2, '乙', true]]);
        assert.deepEqual(b.ev.roster.at(-1).nicks, ['房主', '甲(x)', '乙']);
        // 同暱稱回來 → 原槽位
        const a2 = makeGuest(host.id, '甲'); await wait();
        assert.equal(a2.room.myIndex, 1);
        assert.equal(ev.joins.at(-1).rejoined, true);
        // 滿員後：離線槽位可給新人；沒有離線槽位則已滿
        b.room.destroy(); await wait();
        const c = makeGuest(host.id, '丙'); await wait();
        assert.equal(c.room.myIndex, 2);                                  // 接手乙的槽位
        const d = makeGuest(host.id, '丁'); await wait();
        assert.equal(d.ev.rejected, '房間已滿');
        // prune：移除離線槽位並重新編號，成員收到新名單
        c.room.destroy(); await wait();
        assert.deepEqual(host.players.map(p => [p.index, p.nick, p.connected]), [[0, '房主', true], [1, '甲', true], [2, '丙', false]]);
        host.prune(); await wait();
        assert.deepEqual(host.players.map(p => [p.index, p.nick]), [[0, '房主'], [1, '甲']]);
        assert.deepEqual(a2.ev.roster.at(-1), { nicks: ['房主', '甲'], me: 1 });
        host.destroy();
        ok('keepSlots: keep / rejoin / reuse / full / prune');
    }

    // ---------- 重複 JOIN ----------
    {
        const { room: host, ev } = await makeHost();
        const p = new FakePeer(), c = p.connect(host.id);
        await wait();
        c.send({ _r: 'JOIN', nick: '甲' }); c.send({ _r: 'JOIN', nick: '乙' });
        await wait();
        assert.equal(ev.joins.length, 1);
        assert.equal(host.players.length, 2);
        host.destroy();
        ok('duplicate JOIN ignored');
    }

    // ---------- 錯誤與逾時 ----------
    {
        const g = makeGuest('no-such-room', '甲'); await wait();
        assert.equal(g.ev.errors[0].e.type, 'peer-unavailable');
        assert.equal(g.ev.errors[0].m, '找不到這個房號，請確認後再試');
        const none = makeGuest('', '甲'); await wait();
        assert.equal(none.ev.errors[0].e.type, 'peer-unavailable');
        // 對方存在但永遠不回應 → 逾時
        const mute = new FakePeer();
        mute.on('connection', () => { });
        const t = makeGuest(mute.id, '甲', { timeoutMs: 300 }); await wait(900);
        assert.equal(t.ev.errors[0].e.type, 'timeout');
        assert.equal(P2PRoom.explain({ type: 'network' }), '無法連上連線伺服器，請檢查網路');
        assert.ok(P2PRoom.explain({ type: 'weird' }).includes('weird'));
        const badHost = P2PRoom.host({ nick: '<x>', onError: (e) => { badHost.err = e.type; } }); await wait();
        assert.equal(badHost.err, 'bad-nick');
        ok('errors: unavailable / timeout / bad-nick');
    }

    // ---------- 房主端被壞訊息攻擊不會崩潰 ----------
    {
        const { room: host, ev } = await makeHost();
        const g = makeGuest(host.id, '甲'); await wait();
        const raw = registry.get(g.room && host.players[1].peerId);
        const conn = raw.conns[0];
        [null, 5, 'str', [], { _r: 'JOIN', nick: 5 }, { _r: 'APP' }, { _r: 'NOPE' }].forEach(m => conn.send(m));
        await wait();
        assert.equal(host.players.length, 2);
        host.destroy();
        ok('malformed messages');
    }

    // ---------- Util ----------
    {
        const { rnd, shuffle, copyText, store } = Util;
        const cnt = Array(6).fill(0);
        for (let i = 0; i < 60000; i++) { const r = rnd(6); assert.ok(r >= 0 && r < 6 && Number.isInteger(r)); cnt[r]++; }
        cnt.forEach(c => assert.ok(c > 9000 && c < 11000, cnt.join()));
        assert.equal(rnd(1), 0);
        const src = [1, 2, 3, 4, 5], out = shuffle(src);
        assert.deepEqual(src, [1, 2, 3, 4, 5]);                           // 不改動原陣列
        assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
        const first = {};
        for (let i = 0; i < 30000; i++) { const k = shuffle(['a', 'b', 'c'])[0]; first[k] = (first[k] || 0) + 1; }
        Object.values(first).forEach(c => assert.ok(c > 9000 && c < 11000, JSON.stringify(first)));

        global.navigator = { clipboard: { writeText: async () => { } } };
        assert.equal(await copyText('x'), true);
        global.navigator = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
        assert.equal(await copyText('x'), false);
        global.navigator = {};
        assert.equal(await copyText('x'), false);

        const mem = {};
        global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
        assert.equal(store.get('a', 7), 7);
        assert.equal(store.set('a', { x: [1, 2] }), true);
        assert.deepEqual(store.get('a', null), { x: [1, 2] });
        mem.broken = '{not json';
        assert.equal(store.get('broken', 'dflt'), 'dflt');                // 資料損壞 → 預設值
        global.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
        assert.equal(store.get('a', 1), 1);
        assert.equal(store.set('a', 1), false);                           // 被封鎖 → 不丟錯
        // 寫入失敗時自動呼叫 Chrome.storageFailed()（quiet 時不呼叫）；沒有 Chrome 時也不丟錯
        let failed = 0; global.Chrome = { storageFailed() { failed++; } };
        assert.equal(store.set('a', 1), false); assert.equal(failed, 1);
        assert.equal(store.set('a', 1, true), false); assert.equal(failed, 1, 'quiet 不提示');
        delete global.Chrome; assert.equal(store.set('a', 1), false);
        global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } }; failed = 0; global.Chrome = { storageFailed() { failed++; } };
        assert.equal(store.set('ok', 1), true); assert.equal(failed, 0, '成功時不提示'); delete global.Chrome;
        // esc / day / statRow
        assert.equal(Util.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
        assert.equal(Util.esc(5), '5');
        const D = Util.day;
        assert.match(D.today(), /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(D.ymd(2026, 3, 5), '2026-03-05');
        assert.deepEqual(D.parse('2026-03-05'), { y: 2026, m: 3, d: 5 });
        assert.equal(D.between('2026-01-01', '2026-12-31'), 364);
        assert.equal(D.between('2024-02-28', '2024-03-01'), 2);              // 閏年
        assert.equal(D.between('2026-03-28', '2026-03-30'), 2);              // 夏令時間
        assert.equal(D.shift('2024-03-01', -1), '2024-02-29');
        assert.equal(D.shift('2026-12-31', 1), '2027-01-01');
        for (let n = -400; n <= 400; n += 37) assert.equal(D.between('2026-06-15', D.shift('2026-06-15', n)), n);
        const mk = (tag) => ({ tag, className: '', textContent: '', kids: [], append(...k) { this.kids.push(...k); } });
        global.document = { createElement: mk };
        const row = Util.statRow('標籤', '123', 'big');
        assert.equal(row.className, 'li stat');
        assert.deepEqual(row.kids.map(k => [k.tag, k.textContent, k.className]), [['span', '標籤', ''], ['b', '123', 'big']]);
        // tone / beep / speak：沒有 Web Audio / 語音時必須安靜略過；有的話要正確呼叫
        Util.tone(440); Util.beep(); Util.speak('x');                          // 無 AudioContext：不丟錯
        const log = [];
        class FakeCtx {
            constructor() { this.currentTime = 1; this.state = 'suspended'; this.destination = {}; log.push('new'); }
            resume() { this.state = 'running'; log.push('resume'); }
            createOscillator() { const o = { frequency: {}, connect() { }, start(t) { log.push(['start', t]); }, stop() { } }; return o; }
            createGain() { return { gain: { setValueAtTime() { }, exponentialRampToValueAtTime() { } }, connect() { } }; }
        }
        global.AudioContext = FakeCtx;
        global.navigator = { vibrate: (p) => log.push(['vibrate', p]) };
        Util.tone(440, 100, { delay: 500 });
        assert.deepEqual(log.slice(0, 2), ['new', 'resume']);
        assert.deepEqual(log[2], ['start', 1.5]);                              // currentTime + delay
        log.length = 0; Util.beep(3);
        assert.equal(log.filter(x => Array.isArray(x) && x[0] === 'start').length, 3);
        assert.ok(!log.includes('new'));                                       // 重複使用同一個 AudioContext
        assert.ok(log.some(x => Array.isArray(x) && x[0] === 'vibrate'));
        const said = [];
        global.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
        global.speechSynthesis = { speak: (u) => said.push([u.text, u.lang, u.rate]) };
        Util.speak('冷卻好了'); Util.speak('hi', { lang: 'en-US', rate: 1 });
        assert.deepEqual(said, [['冷卻好了', 'zh-TW', 1.2], ['hi', 'en-US', 1]]);
        delete global.AudioContext; delete global.speechSynthesis; delete global.SpeechSynthesisUtterance;
        ok('util: rnd / shuffle / copyText / store / esc / day / statRow / tone / beep / speak');
    }
    console.log('ALL OK');
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
