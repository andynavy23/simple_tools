const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/config-gen.html', 'toYaml, nginxMatch, TPL, render, defaults, sanitize, sanitizeState, explain, shq, DANGER');
const { toYaml, nginxMatch, TPL, render, defaults, sanitize, sanitizeState } = m;
const gen = (id, over = {}) => { const t = TPL.find(x => x.id === id); return render(t, { ...defaults(t), ...over }); };

// YAML 輸出器
assert.equal(toYaml({ a: 'no', b: '0755', c: 1, d: true, e: 'x y', f: [], g: {}, h: ['a', { k: 'v', z: 2 }], i: 'a: b', j: '' }),
    'a: "no"\nb: "0755"\nc: 1\nd: true\ne: "x y"\nf: []\ng: {}\nh:\n  - a\n  - k: v\n    z: 2\ni: "a: b"\nj: ""');
assert.equal(toYaml([{ nm: 'x', t: [{ a: 1 }] }]), '- nm: x\n  t:\n    - a: 1');
ok('config-gen: yaml');

// nginx location 匹配
const R = 'location = / {\nlocation / {\nlocation /api/ {\nlocation ^~ /static/ {\nlocation ~* \\.(png|jpg)$ {\nlocation ~ ^/api/v\\d+/ {';
const w = (p, r = R) => { const x = nginxMatch(r, p); return x.winner < 0 ? null : x.rules[x.winner].text; };
assert.equal(w('/'), '= /');
assert.equal(w('/static/a.png'), '^~ /static/');
assert.equal(w('/img/a.PNG'), '~* \\.(png|jpg)$');
assert.equal(w('/api/v2/x'), '~ ^/api/v\\d+/');
assert.equal(w('/api/users'), '/api/');
assert.equal(w('/other?x=1'), '/');
assert.equal(w('//api//users'), '/api/');
assert.equal(w('/x', '= /a'), null);
assert.equal(w('/a/b', 'location /a { }\nlocation /a/b { }\nlocation ~ /b$ { }'), '~ /b$');
assert.equal(w('/a/b', 'location ^~ /a { }\nlocation ~ /b$ { }'), '^~ /a');
assert.equal(w('/a/b', 'location ~ /b$ {\nlocation ~ /a/ {'), '~ /b$');
assert.equal(nginxMatch('location ~ ( {\nlocation @named {', '/').notes.length, 2);
assert.equal(w('/ab12', 'location ~ \\d{2}$ {'), '~ \\d{2}$');
ok('config-gen: nginx location');

// 各範本預設值可產生且無例外；YAML 類型別
for (const t of TPL) { const r = render(t, defaults(t)); assert.ok(r.text.length > 0, t.id); }
const k = gen('k8s', { kind: 'deploy', env: 'A=1\nB=x y' });
assert.ok(k.text.includes('apiVersion: apps/v1') && k.text.includes('image: "nginx:1.27"'), k.text);
assert.ok(k.text.includes('value: "1"') && k.text.includes('value: "x y"'), k.text);
assert.ok(gen('k8s', { name: 'Bad_Name' }).warns.some(x => x.includes('小寫')));
assert.ok(gen('k8s', { kind: 'cron', sched: '* *' }).warns.some(x => x.includes('5 欄')));
assert.ok(gen('k8s', { kind: 'ingress', tls: 'sec' }).text.includes('secretName: sec'));
assert.ok(gen('k8s', { kind: 'cron', cmd: 'echo "hi"' }).text.includes('- sh'));
assert.ok(gen('ansible').text.includes('mode: "0755"'));
ok('config-gen: k8s / ansible');

// 危險標示
const f = gen('shell', { kind: 'find', fact: 'delete' });
assert.ok(f.text.endsWith('-delete') && f.ex.some(e => e[0] === '-delete' && e[2]) && f.warns.length);
assert.ok(gen('shell', { kind: 'find', fact: 'delete', ftype: '', fname: '', mtime: '' }).warns.some(x => x.includes('全部內容')));
assert.ok(gen('shell', { kind: 'rsync', rdel: true, rn: false }).ex.some(e => e[0] === '--delete' && e[2]));
const rm = gen('shell', { kind: 'rm', rr: true, rf: true, rpath: '/' });
assert.equal(rm.text, 'rm -rf /'); assert.ok(rm.ex.some(e => e[2]) && rm.warns.length > 1);
assert.equal(gen('shell', { kind: 'find' }).text, "find /var/log -type f -name '*.log' -mtime +30");
assert.equal(gen('shell', { kind: 'tar' }).text, 'tar -czf backup.tar.gz data config');
assert.equal(gen('shell', { kind: 'grep' }).text, "grep -r -n --include='*.log' -e error .");
assert.ok(gen('shell', { kind: 'scp', skey: '~/.ssh/k', sport: '2222' }).text.includes('-P 2222 -i ~/.ssh/k'));
assert.ok(gen('shell', { kind: 'ssh', sjump: 'u@b', slocal: '8080:localhost:80' }).text.includes('-J u@b -L 8080:localhost:80'));
ok('config-gen: shell / danger');

// 其他產生器
assert.ok(gen('nginx', { kind: 'redirect' }).text.includes('return 301 https://$host$request_uri;'));
assert.ok(gen('nginx', { kind: 'proxy', ws: true, ssl: true }).text.includes('Upgrade $http_upgrade'));
assert.ok(gen('nginx', { kind: 'cors', origin: '*' }).warns.length);
assert.ok(gen('apache', { kind: 'blockip' }).text.includes('Require not ip 198.51.100.0/24'));
assert.ok(gen('apache', { kind: 'blockip', ips: 'abc' }).warns.some(x => x.includes('IP')));
assert.ok(gen('systemd', { exec: 'node x.js' }).warns.some(x => x.includes('絕對路徑')));
assert.ok(gen('systemd', { kind: 'timer' }).text.includes('OnCalendar=*-*-* 03:00:00'));
assert.ok(gen('ssh').text.includes('ProxyJump web') && gen('ssh').text.includes('Host *'));
assert.ok(gen('ssh', { hosts: 'a h u 99999 - -' }).warns.some(x => x.includes('埠')));
assert.ok(gen('logrotate').text.includes('rotate 14'));
const p = gen('prom', { kind: 'all' });
assert.ok(p.text.includes('HighCpuUsage') && p.text.includes('expr: "100 - (avg by (instance)') && p.ex.length > 6);
assert.ok(gen('prom', { th: '150' }).warns.length);
const b = gen('backup', { target: 'local' });
assert.ok(b.text.includes('-mtime +14 -delete') && b.text.includes('30 2 * * * /usr/local/bin/backup.sh'));
assert.ok(gen('backup', { target: 'ssh', dest: 'u@h:/b' }).text.includes('HOST=u@h'));
assert.ok(gen('backup', { keep: '0' }).warns.length && gen('backup', { time: '25:00' }).warns.length);
assert.ok(gen('caddy', { kind: 'redirect' }).text.includes('redir https://example.com{uri} permanent'));
assert.ok(gen('tf', { kind: 's3' }).text.includes('block_public_acls'));
ok('config-gen: generators');

// 狀態驗證
const t0 = TPL[0];
assert.deepEqual(sanitize(t0, null), defaults(t0));
assert.equal(sanitize(t0, { kind: 'bogus' }).kind, 'proxy');
assert.equal(sanitize(t0, { domain: 'x'.repeat(5000) }).domain.length, 2000);
assert.equal(sanitize(t0, { ws: 'yes' }).ws, false);
assert.equal(sanitizeState(null).tpl, 'nginx'); assert.equal(sanitizeState({ tpl: 'zzz', vals: 5 }).tpl, 'nginx');
assert.equal(sanitizeState({ tpl: 'ssh', vals: { ssh: { hosts: 5 } } }).vals.ssh.hosts, defaults(TPL.find(x => x.id === 'ssh')).hosts);
ok('config-gen: state');

// docker-helper 擴充：範本庫 / Dockerfile / 命名檢查
{
    const d = load('utils/docker-helper.html', 'SVC_TPL, buildSvcTemplate, buildDockerfile, lintEnvNames, parseEnv');
    for (const id of Object.keys(d.SVC_TPL)) { const r = d.buildSvcTemplate(id, { local: true }); assert.ok(r.yaml.startsWith('services:\n  ' + id + ':') && r.yaml.includes('healthcheck:') && r.yaml.includes('"127.0.0.1:'), id); }
    const pg = d.buildSvcTemplate('postgres', { port: '15432', local: false });
    assert.ok(pg.yaml.includes('"15432:5432"') && pg.yaml.includes('POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?') && pg.yaml.includes('$${POSTGRES_USER}'), pg.yaml);
    assert.ok(pg.env.includes('POSTGRES_PASSWORD=change_me') && pg.warnings.length >= 2);
    assert.ok(d.buildSvcTemplate('postgres', { port: '99999' }).warnings.some(x => x.includes('1–65535')));
    assert.ok(d.buildSvcTemplate('rabbitmq', { local: true, port: '5673' }).yaml.includes('"127.0.0.1:5673:5672"') && d.buildSvcTemplate('rabbitmq', {}).yaml.includes('"15672:15672"'));
    assert.equal(d.buildSvcTemplate('nope').yaml, '');
    for (const lang of ['node', 'python', 'go', 'java', 'static']) { const r = d.buildDockerfile({ lang }); assert.ok(r.dockerfile.startsWith('FROM ') && r.dockerfile.includes('EXPOSE ') && r.ignore.includes('.env'), lang); }
    const nd = d.buildDockerfile({ lang: 'node', ver: '20', port: '4000', cmd: 'node "my app.js"' });
    assert.ok(nd.dockerfile.includes('FROM node:20-alpine AS deps') && nd.dockerfile.includes('EXPOSE 4000') && nd.dockerfile.includes('CMD ["node", "my app.js"]'), nd.dockerfile);
    assert.ok(d.buildDockerfile({ lang: 'go' }).dockerfile.includes('distroless'));
    assert.ok(d.buildDockerfile({ lang: 'bogus' }).dockerfile.includes('node:22'));
    const bad = d.buildDockerfile({ lang: 'python', ver: 'x;rm', port: '0', cmd: 'a "b' });
    assert.ok(bad.dockerfile.includes('python:3.12-slim') && bad.dockerfile.includes('EXPOSE 8000') && bad.warnings.length >= 3);
    const lint = (t) => d.lintEnvNames(d.parseEnv(t).entries).map(x => x.code);
    assert.deepEqual(lint('DB_HOST=a\nDB_PORT=1'), []);
    assert.ok(lint('db_host=a').includes('naming-case'));
    assert.ok(lint('DB_HOST=a\nDATABASE_PORT=1').includes('naming-mix'));
    assert.ok(lint('DB_PASSWORD=a\nSMTP_PASSWD=b').includes('naming-mix'));
    assert.ok(lint('VITE_API_SECRET=abc123').includes('public-secret'));
    assert.deepEqual(lint('VITE_API_SECRET=change_me'), []);
    assert.ok(lint('SOMETHING=AKIAABCDEFGHIJKLMNOP').includes('secret-value'));
    assert.ok(lint('A__B=1').includes('naming-underscore'));
    assert.deepEqual(lint('A=1\nA=2'), []);
    ok('docker-helper: templates / dockerfile / env naming');
}
