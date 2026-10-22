// g2：專案樣板產生器（utils/project-templates.html）與 git-helper 新增的 Conventional Commits / CHANGELOG / hooks
const { load, ok } = require('./_load'); const assert = require('assert');
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const P = load('utils/project-templates.html', 'GI, mergeGitignore, LICENSE_FULL, LICENSE_HEAD, recommendLicense, buildLicense, buildReadme, buildEditorconfig, buildPackage, buildTsconfig, buildEslint, buildPrettier, toYaml, buildDeps, buildWorkflow, loadOpts, FORMS, validNpmName, validSemver');
const G = load('utils/git-helper.html', 'buildCC, parseCommits, buildChangelog, buildHook, riskOfCommand, CC_RE');

// 簡易 YAML 檢查：不可有 Tab、縮排為 2 的倍數、每行是 key: / - / 延續行，且縮排不會一次跳超過 2
function checkYaml(t) {
    let prev = 0, block = -1;
    for (const l of t.split('\n')) {
        if (!l.trim()) continue;
        assert.ok(!/\t/.test(l), 'tab: ' + l);
        const ind = l.length - l.trimStart().length;
        if (block >= 0 && ind > block) continue;            // block scalar 內容
        block = -1;
        assert.strictEqual(ind % 2, 0, 'odd indent: ' + l);
        assert.ok(ind - prev <= 2, 'indent jump: ' + l);
        assert.ok(/^\s*(- )?([\w.-]+|"[^"]*"):( |$)/.test(l) || /^\s*- \S/.test(l), 'bad line: ' + l);
        if (/:\s*\|$/.test(l)) block = ind;
        prev = ind;
    }
}

// .gitignore：去重並保留來源註解
{
    const r = P.mergeGitignore(['node', 'python', 'vim', 'linux']);
    const lines = r.text.split('\n'), rules = lines.filter(l => l && !l.startsWith('#'));
    assert.strictEqual(new Set(rules).size, rules.length, 'no duplicate rules');
    assert.ok(r.dups >= 3 && lines.filter(l => l.startsWith('# =====')).length === 4);
    assert.ok(P.mergeGitignore(['rust']).text.includes('# Cargo.lock'));
    assert.strictEqual(P.mergeGitignore(['nope']).text, '');
    assert.ok(P.FORMS.gitignore.build({}).err);
    ok('gitignore merge dedupes rules, keeps source comments');
}
// 授權
{
    for (const id of ['mit', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'unlicense']) {
        const t = P.buildLicense({ year: '2026', holder: 'A & $1 B', closed: 'yes', pick: id }).text;
        assert.ok(!/\{[YH]\}/.test(t) && t.includes(id === 'unlicense' ? 'unlicense.org' : 'A & $1 B'), id);
        assert.ok(t.length > 600 && t.endsWith('\n'));
    }
    const mit = P.buildLicense({ year: '2026', holder: 'X', pick: 'mit' }).text;
    assert.ok(mit.startsWith('MIT License\n\nCopyright (c) 2026 X\n') && mit.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
    assert.ok(P.buildLicense({ year: '2026', holder: 'X', pick: 'bsd-3-clause' }).text.includes('3. Neither the name'));
    assert.ok(!P.buildLicense({ year: '2026', holder: 'X', pick: 'bsd-2-clause' }).text.includes('Neither the name'));
    const ap = P.buildLicense({ year: '2026', holder: 'X', pick: 'apache-2.0' });
    assert.ok(ap.text.includes('Licensed under the Apache License, Version 2.0') && ap.notes.some(n => n[1].includes('apache.org/licenses/LICENSE-2.0.txt')));
    assert.ok(P.buildLicense({ year: '20x', holder: 'X' }).err && P.buildLicense({ year: '2026', holder: '' }).err);
    const rec = (o) => P.recommendLicense(o).id;
    assert.strictEqual(rec({ pd: true }), 'unlicense');
    assert.strictEqual(rec({ closed: 'yes', patent: 'no' }), 'mit');
    assert.strictEqual(rec({ closed: 'yes', patent: 'yes' }), 'apache-2.0');
    assert.strictEqual(rec({ closed: 'no', copyleft: 'strong' }), 'gpl-3.0');
    assert.strictEqual(rec({ closed: 'no', copyleft: 'file' }), 'mpl-2.0');
    ok('license: full texts, headers, recommendation');
}
// README、editorconfig、package、tsconfig、eslint、prettier
{
    const r = P.buildReadme({ repo: 'a/b', name: 'B', bCi: true, wf: 'ci.yml', bLicense: true, bNpm: true, pkg: '@s/b', sInstall: true, sLicense: true, license: 'MIT' }).text;
    assert.ok(r.includes('img.shields.io/github/actions/workflow/status/a/b/ci.yml') && r.includes('npm/v/@s/b') && r.includes('git clone https://github.com/a/b.git'));
    assert.ok(P.buildReadme({ repo: 'ab', name: 'B' }).err && P.buildReadme({ repo: 'a/b', name: 'B', bNpm: true, pkg: 'Bad Name' }).err);
    const ec = P.buildEditorconfig({ style: 'space', size: '2', eol: 'lf', charset: 'utf-8', finalNl: true, trim: true, md: true, make: true }).text;
    assert.ok(ec.startsWith('root = true') && ec.includes('indent_size = 2') && ec.includes('[Makefile]\nindent_style = tab'));
    assert.ok(P.buildEditorconfig({ style: 'space', size: '0' }).err);

    const pk = P.buildPackage({ name: '@me/pkg', version: '1.2.3-beta.1', type: 'module', main: 'src/i.js', sStart: true, sTest: true, license: 'MIT', repo: 'a/b', engines: true, priv: true, desc: '含 "引號"' });
    const j = JSON.parse(pk.text);
    assert.strictEqual(j.name, '@me/pkg'); assert.strictEqual(j.scripts.start, 'node src/i.js'); assert.strictEqual(j.private, true); assert.strictEqual(j.description, '含 "引號"'); assert.ok(j.repository.url.endsWith('a/b.git'));
    for (const bad of [{ name: 'Upper' }, { name: 'a b' }, { name: 'x', version: '1.0' }, { name: 'x', version: '1.0.0', license: 'MIT OR' }, { name: 'x', version: '1.0.0', repo: 'x' }]) assert.ok(P.buildPackage(Object.assign({ name: 'x', version: '1.0.0', type: 'module' }, bad)).err, JSON.stringify(bad));
    assert.ok(P.validNpmName('@a/b-c.d') && !P.validNpmName('.x') && !P.validNpmName('a'.repeat(215)) && P.validSemver('0.0.1') && !P.validSemver('v1.0.0'));

    for (const kind of ['frontend', 'node', 'library']) {
        const t = P.buildTsconfig({ kind, jsx: true, strict: true, extra: true });
        const c = JSON.parse(t.text).compilerOptions;
        assert.strictEqual(c.strict, true);
        for (const k of Object.keys(c)) assert.ok(t.notes.some(n => n[0] === k && n[1]), kind + ' note for ' + k);
        if (kind === 'frontend') assert.ok(c.noEmit && c.jsx === 'react-jsx' && c.moduleResolution === 'bundler');
        if (kind === 'library') assert.ok(c.declaration && c.outDir === 'dist');
        if (kind === 'node') assert.strictEqual(c.module, 'NodeNext');
    }
    assert.ok(!('jsx' in JSON.parse(P.buildTsconfig({ kind: 'frontend' }).text).compilerOptions));
    const es = P.buildEslint({ ts: true, env: 'both', prettier: true });
    assert.ok(es.text.includes('...globals.browser, ...globals.node') && es.text.includes('tseslint') && es.notes[0][1].includes('typescript-eslint'));
    const pr = JSON.parse(P.buildPrettier({ semi: true, single: false, tab: '4', width: '80', comma: 'es5' }).text);
    assert.deepStrictEqual(pr, { semi: true, singleQuote: false, tabWidth: 4, printWidth: 80, trailingComma: 'es5' });
    assert.ok(P.buildPrettier({ tab: '2', width: '10' }).err);
    ok('readme/editorconfig/package/tsconfig/eslint/prettier');
}
// YAML 與 workflow / dependabot / renovate
{
    assert.strictEqual(P.toYaml({ a: '20', b: 'true', c: 'v*', d: '*.js', e: 'x: y', f: 'a # b', g: 20, h: ['a', '1.0'], i: {}, j: '${{ x }}' }),
        'a: "20"\nb: "true"\nc: v*\nd: "*.js"\ne: "x: y"\nf: "a # b"\ng: 20\nh: [a, "1.0"]\ni: {}\nj: "${{ x }}"');
    assert.strictEqual(P.toYaml({ k: { run: 'a\nb\n' }, l: [{ x: 1, y: { z: 2 } }, 'q'] }), 'k:\n  run: |\n    a\n    b\nl:\n  - x: 1\n    y:\n      z: 2\n  - q');
    const base = { name: 'CI', lang: 'node', branch: 'main', tPush: true, tPr: true, cache: true, deploy: 'none', dist: 'dist' };
    for (const lang of ['node', 'python', 'go', 'rust', 'java']) {
        const t = P.buildWorkflow({ ...base, lang, tTag: true, tCron: true, tManual: true }).text;
        checkYaml(t);
        assert.ok(t.startsWith('name: CI\non:\n  push:\n    branches: [main]\n    tags: [v*]\n  pull_request:\n    branches: [main]\n  schedule:\n    - cron: "0 0 * * 1"\n  workflow_dispatch: {}\n'), lang);
        assert.ok(t.includes('uses: actions/checkout@v4'));
    }
    const nd = P.buildWorkflow(base).text;
    assert.ok(nd.includes('node-version: "20"') && nd.includes('cache: npm') && nd.includes('- run: npm ci'));
    const rs = P.buildWorkflow({ ...base, lang: 'rust' }).text;
    assert.ok(rs.includes('path: |\n            ~/.cargo/registry') && rs.includes('key: "${{ runner.os }}-cargo-${{ hashFiles(\'**/Cargo.lock\') }}"')); checkYaml(rs);
    const pg = P.buildWorkflow({ ...base, deploy: 'pages' }).text; checkYaml(pg);
    assert.ok(pg.includes('actions/deploy-pages@v4') && pg.includes('id-token: write') && pg.includes('if: "github.ref == \'refs/heads/main\'"'));
    const np = P.buildWorkflow({ ...base, deploy: 'npm', tTag: true }).text; checkYaml(np);
    assert.ok(np.includes('NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}"') && np.includes('registry-url: "https://registry.npmjs.org"'));
    for (const bad of [{ name: '' }, { branch: 'a b' }, { tPush: false, tPr: false }, { lang: 'python', deploy: 'npm' }, { tPush: false, tPr: true, deploy: 'pages' }, { lang: 'x' }]) assert.ok(P.buildWorkflow({ ...base, ...bad }).err, JSON.stringify(bad));

    const dep = P.buildDeps({ tool: 'dependabot', interval: 'weekly', group: true, e_npm: true, 'e_github-actions': true });
    checkYaml(dep.text);
    assert.ok(dep.text.includes('- package-ecosystem: npm\n    directory: /\n    schedule:\n      interval: weekly\n    groups:\n      minor-and-patch:\n        update-types: [minor, patch]'));
    assert.strictEqual((dep.text.match(/package-ecosystem/g) || []).length, 2);
    const rn = JSON.parse(P.buildDeps({ tool: 'renovate', interval: 'weekly', auto: true, e_npm: true }).text);
    assert.deepStrictEqual(rn.extends, ['config:recommended']); assert.strictEqual(rn.packageRules[0].automerge, true);
    assert.ok(P.buildDeps({ tool: 'dependabot', interval: 'weekly' }).err && P.buildDeps({ tool: 'dependabot', interval: 'x', e_npm: true }).err);
    ok('yaml emitter + workflow/dependabot/renovate');
}
// 每個表單用預設值都能產生（或給出明確錯誤），且上次選項載入會驗證
{
    for (const [k, f] of Object.entries(P.FORMS)) {
        const o = {}; for (const x of f.fields) o[x.k] = x.d;
        o.holder = 'me'; o.name = o.name || 'x'; o.repo = o.repo || 'a/b';
        const r = f.build(o); assert.ok(r.text || r.err, k);
    }
    const d = P.loadOpts(null); assert.strictEqual(d.type, 'gitignore');
    for (const bad of [[], 5, 'x', { type: 'zz', vals: 7 }, { type: 'package', vals: { package: { name: 5, license: { a: 1 }, sTest: 'y' }, evil: {} } }]) { const r = P.loadOpts(bad); assert.ok(r.type in P.FORMS && typeof r.vals === 'object'); }
    const good = P.loadOpts({ type: 'tsconfig', vals: { tsconfig: { kind: 'node', strict: false, junk: 1 }, package: { name: 'x'.repeat(500) } } });
    assert.strictEqual(good.type, 'tsconfig'); assert.deepStrictEqual(good.vals.tsconfig, { kind: 'node', strict: false }); assert.strictEqual(good.vals.package.name.length, 200);
    assert.strictEqual(P.loadOpts({ type: 'tsconfig', vals: { tsconfig: { kind: 'evil' } } }).vals.tsconfig.kind, undefined);
    ok('forms defaults + loadOpts validation');
}
// git-helper：Conventional Commits、CHANGELOG、hooks
{
    const cc = (o) => G.buildCC({ type: 'feat', desc: 'add x', ...o });
    assert.strictEqual(cc({}).cmd, "git commit -m 'feat: add x'");
    assert.strictEqual(cc({ scope: 'ui', breaking: 'API 改了', body: '因為 y' }).cmd, `git commit -m 'feat(ui)!: add x' -m '因為 y' -m 'BREAKING CHANGE: API 改了'`);
    assert.ok(cc({ desc: '' }).err && cc({ scope: 'a b' }).err && cc({ type: 'bogus' }).err && cc({ desc: 'x'.repeat(70) }).err);
    assert.ok(!cc({ desc: 'x'.repeat(60) }).err && cc({ desc: 'x'.repeat(60) }).flags[0][1].includes('建議 ≤ 50'));
    assert.ok(G.CC_RE.test('fix(a.b)!: x') && !G.CC_RE.test('fix:x') && !G.CC_RE.test('Fix: x'));
    assert.strictEqual(G.riskOfCommand(cc({}).cmd), 'safe');

    const log = ['a1b2c3d feat(ui): 新增深色模式', '- fix: 修正崩潰', '* 1234567890abcdef perf(core)!: 加快載入', 'docs: 更新說明', 'chore(deps): bump', 'Merge branch x', 'refactor: 整理', 'revert: 撤回 y', '', 'feat!: 新 API'].join('\r\n');
    const pc = G.parseCommits(log);
    assert.strictEqual(pc.items.length, 6); assert.strictEqual(pc.skipped, 2); assert.strictEqual(pc.unknown, 1);
    const cl = G.buildChangelog({ version: '1.2.0', date: '2026-10-22', commits: log });
    assert.strictEqual(cl.text, '## [1.2.0] - 2026-10-22\n\n### Added\n- **ui:** 新增深色模式\n- **BREAKING** 新 API\n\n### Changed\n- **BREAKING** **core:** 加快載入\n- 整理\n- 撤回 y\n\n### Fixed\n- 修正崩潰\n');
    assert.ok(G.buildChangelog({ version: 'Unreleased', commits: 'fix: a' }).text.startsWith('## [Unreleased]\n'));
    assert.ok(G.buildChangelog({ version: '1.0', date: '2026-01-01', commits: 'fix: a' }).err && G.buildChangelog({ version: '1.0.0', date: '1/1', commits: 'fix: a' }).err && G.buildChangelog({ version: '1.0.0', date: '2026-01-01', commits: 'docs: a' }).err);

    assert.ok(G.buildHook({ hook: 'pre-commit' }).err);
    ok('git-helper: cc / changelog');
    // hooks：真的用 sh 跑一次（找不到 sh 就略過）
    const sh = ['sh', 'C:\\Program Files\\Git\\usr\\bin\\sh.exe'].find(s => { try { return cp.spawnSync(s, ['-c', 'true']).status === 0; } catch { return false; } });
    if (sh) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-')), run = (hook, o, args = [], cwd = dir) => { const f = path.join(dir, hook); fs.writeFileSync(f, G.buildHook({ hook, ...o }).text.replace(/\r/g, '')); return cp.spawnSync(sh, [f, ...args], { cwd, encoding: 'utf8' }); };
        const msg = (t) => { const f = path.join(dir, 'm.txt'); fs.writeFileSync(f, t); return f; };
        assert.strictEqual(run('commit-msg', {}, [msg('feat(ui): ok\n\nbody')]).status, 0);
        assert.strictEqual(run('commit-msg', {}, [msg('Merge branch x')]).status, 0);
        assert.strictEqual(run('commit-msg', {}, [msg('bad message')]).status, 1);
        assert.strictEqual(run('commit-msg', {}, [msg('feat: ' + 'x'.repeat(70))]).status, 1);
        const g = (...a) => cp.spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
        if (g('init', '-q').status === 0) {
            fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\n'); g('add', 'a.txt');
            assert.strictEqual(run('pre-commit', { secrets: true, diffcheck: true }).status, 0);
            fs.writeFileSync(path.join(dir, 'k.txt'), 'aws = AKIAABCDEFGHIJKLMNOP\n'); g('add', 'k.txt');
            assert.strictEqual(run('pre-commit', { secrets: true }).status, 1);
            g('rm', '-q', '--cached', 'k.txt'); fs.writeFileSync(path.join(dir, 'k.txt'), 'password = "hunter2hunter2"\n'); g('add', 'k.txt');
            assert.strictEqual(run('pre-commit', { secrets: true }).status, 1);
        }
        fs.rmSync(dir, { recursive: true, force: true });
        ok('git hooks scripts behave under sh');
    }
}
