// rjpq：錯誤 / 成功改頁內提示（無 dialog）；複製邀請連結後按鈕變「已複製」；被踢出留下可見提示
import assert from 'assert';
import fs from 'fs';
import { launchEdge, openPage, repo } from './lib.mjs';
assert.ok(!/\balert\(/.test(fs.readFileSync(repo + '/game-assist/rjpq.html', 'utf8')), 'rjpq.html 不應再有 alert(');
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'game-assist/rjpq.html');
    let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    await page.evaluate(() => { fullMyId = 'abc123'; copyInvite(); });
    await page.waitForFunction(() => document.getElementById('btn-copy').textContent.includes('已複製'), { timeout: 4000 });
    await page.evaluate(() => { P2PRoom.join = (id, o) => { window.__o = o; return { destroy() { } }; }; document.getElementById('join-id').value = 'X1'; startJoin(); __o.onClose({ kicked: true }); });
    assert.ok(await page.$eval('.st-toast', e => !e.hidden && e.textContent.includes('踢出') && !!e.querySelector('button')));
    assert.equal(dialogs, 0, '不應出現 dialog');
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
