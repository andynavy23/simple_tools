/* 房主制 P2P 房間（PeerJS）
 *
 * 模型：一位房主 + 數位成員。成員只和房主連線；遊戲狀態與規則由各工具自己在房主端處理。
 * 本模組負責「連線層」：建房、加入、暱稱驗證、拒絕、名單、斷線、踢人、只信任房主、逾時、錯誤說明。
 * 工具之間傳的訊息（任意可序列化資料）原樣轉送，不做任何格式規定。
 *
 * 使用：<script src="../shared/js/p2p-room.js"></script>（PeerJS 會由本檔自動從 CDN 載入）
 *
 * // 房主
 * const room = P2PRoom.host({
 *     nick, maxPlayers: 4, keepSlots: false,
 *     onReady(room) {},                  // 房間建立完成，room.id 即房號
 *     canJoin(nick, data) { return '遊戲已開始'; },  // 可選：回傳字串 = 拒絕理由
 *     onJoin(player, info) {},           // info.rejoined：同暱稱的離線者回到原槽位
 *     onLeave(player) {},
 *     onMessage(player, data) {},        // 成員送來的訊息（已確認是名單內的人）
 *     onError(err, message) {},
 * });
 * room.broadcast(data); room.sendTo(index, data); room.kick(index, reason); room.prune(); room.destroy();
 *
 * // 成員
 * const room = P2PRoom.join(roomId, {
 *     nick, data,                         // data：加入時附帶給房主的資料（例如偏好顏色）
 *     onJoined(room) {}, onRoster(players, myIndex) {}, onMessage(data) {},
 *     onRejected(reason) {}, onClose({ kicked, reason }) {}, onError(err, message) {},
 * });
 * room.send(data); room.destroy();
 *
 * room.peerId：自己的 peer id（成員端用來在名單 / 狀態中辨識自己）。
 * players：[{ index, nick, connected, peerId, data }]，index 0 永遠是房主。
 * keepSlots=false：成員離開就從名單移除（後面的人 index 會前移）；
 * keepSlots=true ：只標記 connected=false，槽位保留給同暱稱者或下一位加入者（index 不變）。
 */
(function (root) {
    'use strict';

    const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
    const JOIN_TIMEOUT_MS = 10000;
    const NICK_RE = /^[a-zA-Z0-9一-龥]+$/;

    const validNick = (n, max = 10) => typeof n === 'string' && n.length >= 1 && n.length <= max && NICK_RE.test(n);

    let peerLoader = null;
    function loadPeer() {
        if (root.Peer) return Promise.resolve(root.Peer);
        if (!peerLoader) {
            peerLoader = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = PEERJS_URL;
                s.onload = () => resolve(root.Peer);
                s.onerror = () => { peerLoader = null; reject({ type: 'load-failed' }); };
                document.head.append(s);
            });
        }
        return peerLoader;
    }

    function explain(err) {
        switch (err && err.type) {
            case 'peer-unavailable': return '找不到這個房號，請確認後再試';
            case 'timeout': return '連線逾時，請確認房號與網路後再試';
            case 'load-failed': return '無法載入連線元件（PeerJS），請確認網路後重新整理';
            case 'bad-nick': return '暱稱格式錯誤';
            case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
                return '無法連上連線伺服器，請檢查網路';
            default: return `連線失敗（${(err && err.type) || 'unknown'}），請再試一次`;
        }
    }

    // 頁面離開時主動關閉連線，對方才能立刻偵測到斷線（否則要等 WebRTC 逾時，約數十秒）
    function closeOnLeave(getPeer) {
        if (typeof root.addEventListener !== 'function') return;
        root.addEventListener('pagehide', () => { try { const p = getPeer(); if (p) p.destroy(); } catch (e) { } });
    }

    const call = (fn, ...args) => { if (typeof fn === 'function') fn(...args); };
    const trySend = (conn, msg) => { try { if (conn && conn.open !== false) conn.send(msg); } catch (e) { /* 對方已斷線 */ } };
    const roster = (players) => players.map(p => ({ index: p.index, nick: p.nick, connected: p.connected }));

    // 網址 #房號 → 房號；沒有則回傳空字串
    function roomFromUrl() {
        return (root.location && root.location.hash || '').replace(/^#/, '');
    }
    function inviteLink(id) {
        const l = root.location;
        return `${l.origin}${l.pathname}#${id}`;
    }

    // ---------------- 房主 ----------------
    function host(opts) {
        const o = { maxPlayers: 8, maxNick: 10, keepSlots: false, ...opts };
        const players = [];
        const conns = new Map(); // peerId -> DataConnection
        let peer = null, destroyed = false;
        const byPeer = (id) => players.find(p => p.peerId === id);
        const reindex = () => players.forEach((p, i) => { p.index = i; });

        const room = {
            id: null, peerId: null, isHost: true, myIndex: 0, players, keepSlots: o.keepSlots,
            broadcast(data, except = -1) {
                players.forEach(p => { if (p.index !== 0 && p.connected && p.index !== except) trySend(conns.get(p.peerId), { _r: 'APP', d: data }); });
            },
            sendTo(index, data) {
                const p = players[index];
                if (p && index !== 0 && p.connected) trySend(conns.get(p.peerId), { _r: 'APP', d: data });
            },
            kick(index, reason = '你已被房主移出房間') {
                const p = players[index];
                if (!p || index === 0 || !p.connected) return;
                const c = conns.get(p.peerId);
                trySend(c, { _r: 'KICK', reason });
                setTimeout(() => { try { c.close(); } catch (e) { } }, 200);
            },
            // 移除已離線的成員並重新編號（keepSlots=true 時離線槽位會一直保留，需要時呼叫，例如重賽前）
            prune() {
                for (let i = players.length - 1; i > 0; i--) if (!players[i].connected) players.splice(i, 1);
                reindex();
                pushRoster();
            },
            destroy() { destroyed = true; if (peer) peer.destroy(); },
        };

        const pushRoster = () => {
            const r = roster(players);
            players.forEach(p => { if (p.index !== 0 && p.connected) trySend(conns.get(p.peerId), { _r: 'ROSTER', players: r, index: p.index }); });
        };

        function handleJoin(conn, msg) {
            if (byPeer(conn.peer) && byPeer(conn.peer).connected) return;
            const reject = (reason) => { trySend(conn, { _r: 'REJECT', reason }); setTimeout(() => { try { conn.close(); } catch (e) { } }, 300); };
            if (!validNick(msg.nick, o.maxNick)) return reject('暱稱格式錯誤');
            if (players.some(p => p.connected && p.nick === msg.nick)) return reject('暱稱已有人使用');

            // 同暱稱的離線者優先回到原槽位；其次（keepSlots）任何離線槽位；否則新增
            let slot = players.find(p => !p.connected && p.nick === msg.nick);
            const rejoined = !!slot;
            if (!slot && room.keepSlots) slot = players.find(p => !p.connected && p.index !== 0);
            if (!slot && players.length >= o.maxPlayers) return reject('房間已滿');
            const why = o.canJoin && o.canJoin(msg.nick, msg.data);
            if (typeof why === 'string' && why) return reject(why);

            if (slot) { slot.nick = msg.nick; slot.peerId = conn.peer; slot.connected = true; slot.data = msg.data; }
            else { slot = { index: players.length, nick: msg.nick, peerId: conn.peer, connected: true, data: msg.data }; players.push(slot); }
            conns.set(conn.peer, conn);
            trySend(conn, { _r: 'WELCOME', index: slot.index, players: roster(players) });
            call(o.onJoin, slot, { rejoined });
            pushRoster();
        }

        function handleClose(conn) {
            const p = byPeer(conn.peer);
            if (!p || !p.connected || conns.get(conn.peer) !== conn) return;
            conns.delete(conn.peer);
            if (room.keepSlots) p.connected = false;
            else { players.splice(p.index, 1); reindex(); p.connected = false; }
            call(o.onLeave, p);
            pushRoster();
        }

        const fail = (err) => { if (!destroyed) call(o.onError, err, explain(err)); };

        if (!validNick(o.nick, o.maxNick)) { setTimeout(() => fail({ type: 'bad-nick' }), 0); return room; }
        loadPeer().then((Peer) => {
            if (destroyed) return;
            peer = new Peer({ debug: 1, config: { iceServers: ICE } });
            closeOnLeave(() => peer);
            peer.on('open', (id) => {
                room.id = id; room.peerId = id;
                players.push({ index: 0, nick: o.nick, peerId: id, connected: true, data: o.data });
                call(o.onReady, room);
            });
            peer.on('connection', (conn) => {
                conn.on('data', (msg) => {
                    if (!msg || typeof msg !== 'object') return;
                    if (msg._r === 'JOIN') return handleJoin(conn, msg);
                    const p = byPeer(conn.peer);
                    if (!p || !p.connected || conns.get(conn.peer) !== conn) return; // 未加入者不可送任何訊息
                    if (msg._r === 'APP') call(o.onMessage, p, msg.d);
                });
                conn.on('close', () => handleClose(conn));
            });
            peer.on('error', fail);
        }).catch(fail);
        return room;
    }

    // ---------------- 成員 ----------------
    function join(id, opts) {
        const o = { maxNick: 10, timeoutMs: JOIN_TIMEOUT_MS, ...opts };
        let peer = null, conn = null, timer = null, destroyed = false, kicked = null;
        const room = {
            id, isHost: false, myIndex: -1, players: [], joined: false, peerId: null,
            send(data) { if (room.joined) trySend(conn, { _r: 'APP', d: data }); },
            destroy() { destroyed = true; clearTimeout(timer); if (peer) peer.destroy(); },
        };
        const fail = (err) => {
            if (destroyed || room.joined) return;
            clearTimeout(timer);
            room.destroy();
            call(o.onError, err, explain(err));
        };

        if (!validNick(o.nick, o.maxNick)) { setTimeout(() => fail({ type: 'bad-nick' }), 0); return room; }
        if (!id) { setTimeout(() => fail({ type: 'peer-unavailable' }), 0); return room; }

        loadPeer().then((Peer) => {
            if (destroyed) return;
            peer = new Peer({ debug: 1, config: { iceServers: ICE } });
            closeOnLeave(() => peer);
            peer.on('error', fail);
            peer.on('open', () => {
                room.peerId = peer.id;
                conn = peer.connect(id, { reliable: true });
                conn.on('open', () => trySend(conn, { _r: 'JOIN', nick: o.nick, data: o.data }));
                conn.on('data', (msg) => {
                    // 只信任房主那條連線
                    if (conn.peer !== id || !msg || typeof msg !== 'object') return;
                    if (msg._r === 'WELCOME') {
                        if (room.joined) return;
                        clearTimeout(timer);
                        room.joined = true; room.myIndex = msg.index; room.players = msg.players;
                        call(o.onJoined, room);
                        call(o.onRoster, room.players, room.myIndex);
                    } else if (!room.joined) {
                        if (msg._r === 'REJECT') { clearTimeout(timer); destroyed = true; if (peer) peer.destroy(); call(o.onRejected, String(msg.reason || '無法加入').slice(0, 60)); }
                    } else if (msg._r === 'ROSTER') {
                        room.players = msg.players; room.myIndex = msg.index;
                        call(o.onRoster, room.players, room.myIndex);
                    } else if (msg._r === 'APP') {
                        call(o.onMessage, msg.d);
                    } else if (msg._r === 'KICK') {
                        kicked = String(msg.reason || '').slice(0, 60);
                    }
                });
                conn.on('close', () => {
                    if (destroyed && !room.joined) return;
                    if (room.joined && !destroyed) { destroyed = true; call(o.onClose, { kicked: kicked !== null, reason: kicked || '' }); }
                });
                timer = setTimeout(() => fail({ type: 'timeout' }), o.timeoutMs);
            });
        }).catch(fail);
        return room;
    }

    const P2PRoom = { host, join, validNick, NICK_RE, roomFromUrl, inviteLink, explain, ICE };
    if (typeof module !== 'undefined' && module.exports) module.exports = P2PRoom;
    else root.P2PRoom = P2PRoom;
})(typeof window !== 'undefined' ? window : globalThis);
