// party：隊員斷線 / 被拒 / 被踢改頁內橫幅（不 alert、不重載），可沿用房號與暱稱重新加入；複製邀請無 dialog
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'game-assist/party.html');
    let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    await page.evaluate(() => {
        window.__joins = []; window.__nav = 0;
        P2PRoom.join = (id, o) => { window.__joins.push({ id, o }); return { destroy() { } }; };
        document.getElementById('nickname').value = 'Tester'; confirmNickname();
        document.getElementById('joinIdInput').value = 'ROOM42'; joinRoom();
    });
    assert.equal(await page.evaluate(() => __joins.length), 1);
    const shown = () => page.$eval('#netBanner', e => !e.classList.contains('d-none'));
    await page.evaluate(() => __joins[0].o.onClose({ kicked: false }));
    assert.ok(await shown(), '斷線橫幅出現');
    assert.ok(await page.$eval('#netMsg', e => e.textContent.includes('中斷')));
    await page.evaluate(() => { window.__marker = 1; document.getElementById('netRejoin').click(); });
    assert.equal(await page.evaluate(() => __joins.length), 2, '按重新加入會再呼叫 join');
    assert.equal(await page.evaluate(() => __joins[1].id), 'ROOM42');
    assert.ok(!(await shown()));
    // 被拒：可再試；被踢：不可重新加入
    await page.evaluate(() => __joins[1].o.onRejected('房間已滿'));
    assert.ok(await shown()); assert.ok(await page.$eval('#netMsg', e => e.textContent === '房間已滿'));
    await page.evaluate(() => document.getElementById('netRejoin').click());
    await page.evaluate(() => __joins[2].o.onClose({ kicked: true, reason: 'x' }));
    assert.ok(await page.$eval('#netRejoin', e => e.classList.contains('d-none')), '被踢不顯示重新加入');
    assert.equal(await page.evaluate(() => window.__marker), 1, '頁面沒有重載');
    assert.equal(dialogs, 0, '不應出現 alert / confirm');
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
