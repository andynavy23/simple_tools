// my-lists：書籤新增 / 重複 / 搜尋 / 單筆刪除 / 匯出、帳號盤點密碼擋下與風險標示、清除全部、無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const fill = (page, sel, v) => ev(page, (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const text = (page, sel) => ev(page, (s) => document.querySelector(s).textContent, sel);

{
    const { page, errors } = await openPage(browser, 'utils/my-lists.html');
    page.removeAllListeners('dialog'); let confirms = [];
    page.on('dialog', d => { confirms.push(d.message()); d.accept(); });
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');

    await fill(page, '#b_url', 'javascript:alert(1)'); await click(page, '#b_save');
    assert.ok((await text(page, '#b_msg')).includes('網址'));
    await fill(page, '#b_url', 'example.com/a'); await fill(page, '#b_tags', '工作'); await click(page, '#b_save');
    await fill(page, '#b_url', 'https://www.example.com/a/'); await fill(page, '#b_tags', '教學'); await click(page, '#b_save');   // 重複 → confirm → 合併
    assert.ok(confirms.some(m => m.includes('已存在')));
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('mylists_bookmarks')).length), 1);
    assert.deepEqual(await ev(page, () => JSON.parse(localStorage.getItem('mylists_bookmarks'))[0].tags), ['工作', '教學']);
    await fill(page, '#b_url', 'b.org'); await fill(page, '#b_name', 'Beta'); await click(page, '#b_save');
    await fill(page, '#b_q', 'beta');
    assert.equal(await ev(page, () => document.querySelectorAll('#b_list .item').length), 1);
    await fill(page, '#b_q', '');
    await click(page, '#b_list .item .btns button:nth-child(2)');   // 單筆刪除
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('mylists_bookmarks')).length), 1);

    // 匯入（用 DataTransfer 塞檔案）
    await ev(page, async () => {
        const html = '<DL><DT><H3>資料夾</H3><DL><DT><A HREF="https://imp.com/" ADD_DATE="1700000000">Imp</A></DL></DL>';
        const dt = new DataTransfer(); dt.items.add(new File([html], 'b.html', { type: 'text/html' }));
        const f = document.querySelector('#b_file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction(() => document.querySelector('#b_dmsg').textContent.includes('新增 1'), { timeout: 5000 });
    assert.ok(await ev(page, () => JSON.parse(localStorage.getItem('mylists_bookmarks')).some(b => b.tags.includes('資料夾'))));

    // 帳號盤點
    await click(page, '[data-t=ac]');
    await fill(page, '#a_name', '銀行'); await fill(page, '#a_acct', 'my password 1'); await click(page, '#a_save');
    assert.ok((await text(page, '#a_msg')).includes('密碼'));
    assert.equal(await ev(page, () => localStorage.getItem('mylists_accounts')), null);
    await fill(page, '#a_acct', 'me@bank.com'); await ev(page, () => { document.querySelector('#a_cat').value = '金融'; }); await click(page, '#a_save');
    assert.ok(await ev(page, () => document.querySelector('#a_list .item.bad .badge.bad')), '金融沒開 2FA 應標紅');
    await click(page, '#a_list .item .btns button:nth-child(2)');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('mylists_accounts')).length), 0);

    await click(page, '[data-t=bm]'); await click(page, '#b_clear');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('mylists_bookmarks')).length), 0);
    assert.deepEqual(errors, []);
}
await browser.close();
