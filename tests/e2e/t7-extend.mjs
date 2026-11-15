// t7：date-calc 家人生日、countdown 節慶、pet-log 體重提示、reading-list 稍後閱讀（畫面行為）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const noOverflow = async (page, name) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth) <= 1, name + ' 橫向溢出');
try {
    // ---- date-calc ----
    {
        const { page, errors } = await openPage(browser, 'utils/date-calc.html');
        await page.evaluate(() => { window.confirm = () => true; });
        await page.evaluate(() => document.querySelector('[data-t=zodiac]').click());
        await page.evaluate(() => {
            const set = (id, v) => { const e = document.getElementById(id); e.value = v; };
            set('pn', '媽媽'); set('pd', '1970-03-04'); document.getElementById('padd').click();
            set('pn', '爸爸'); set('pc', 'l'); document.getElementById('pc').dispatchEvent(new Event('change')); set('ply', '1968'); set('plm', '8'); set('pld', '15'); document.getElementById('padd').click();
        });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('datecalc_people')).length), 2);
        assert.equal(await page.evaluate(() => document.querySelectorAll('#plist > div').length), 2);
        assert.ok((await page.evaluate(() => document.getElementById('plist').textContent)).includes('農曆 1968 年八月15日'));
        await page.evaluate(() => [...document.querySelectorAll('#plist button')].find(b => b.textContent === '刪除').click());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('datecalc_people')).length), 1);
        await page.evaluate(() => document.getElementById('pclear').click());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('datecalc_people')).length), 0);
        await noOverflow(page, 'date-calc'); assert.deepEqual(errors, []); await page.close();
    }
    // ---- countdown ----
    {
        const { page, errors } = await openPage(browser, 'utils/countdown.html');
        const n = await page.evaluate(() => document.querySelectorAll('#festList button').length);
        assert.ok(n >= 12, '節慶列數 ' + n);
        await page.evaluate(() => document.querySelector('#festList button').click());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('countdown_events')).length), 1);
        assert.ok(await page.evaluate(() => document.querySelector('#festList button').disabled), '已加入要停用');
        await noOverflow(page, 'countdown'); assert.deepEqual(errors, []); await page.close();
    }
    // ---- reading-list ----
    {
        const { page, errors } = await openPage(browser, 'fun/reading-list.html');
        await page.evaluate(() => { window.confirm = () => true; });
        await page.evaluate(() => document.querySelector('[data-v=later]').click());
        await page.evaluate(() => { document.getElementById('lu').value = 'javascript:alert(1)'; document.getElementById('ladd').click(); });
        assert.ok((await page.evaluate(() => document.getElementById('lmsg').textContent)).includes('http'));
        await page.evaluate(() => { document.getElementById('lu').value = 'https://example.com/a'; document.getElementById('lt').value = '範例'; document.getElementById('ladd').click(); });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('readinglist_later')).length), 1);
        await page.evaluate(() => [...document.querySelectorAll('#llist button')].find(b => b.textContent === '標為已讀').click());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('readinglist_later'))[0].read), true);
        await page.evaluate(() => document.getElementById('lclear').click());
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('readinglist_later')).length), 0);
        await noOverflow(page, 'reading-list'); assert.deepEqual(errors, []); await page.close();
    }
    // ---- pet-log：體重提示 ----
    {
        const { page, errors } = await openPage(browser, 'fun/pet-log.html');
        const d = (o) => new Date(Date.now() - o * 864e5).toLocaleDateString('sv');
        await page.evaluate((a, b) => {
            localStorage.setItem('pet_log', JSON.stringify({ pets: [{ id: 'p1', name: '咪', sp: '貓', size: '', birth: '', note: '' }], events: [{ id: 'e1', pid: 'p1', date: a, type: '體重', name: '', val: 4, note: '' }, { id: 'e2', pid: 'p1', date: b, type: '體重', name: '', val: 3.4, note: '' }] }));
        }, d(10), d(1));
        await page.reload({ waitUntil: 'load' });
        const msg = await page.evaluate(() => document.getElementById('wMsg').textContent);
        assert.ok(msg.includes('建議諮詢獸醫'), msg);
        await noOverflow(page, 'pet-log'); assert.deepEqual(errors, []); await page.close();
    }
} finally { await browser.close(); }
console.log('ok  t7-extend');
