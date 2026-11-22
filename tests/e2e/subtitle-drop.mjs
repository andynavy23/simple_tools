// subtitle-tool：整頁拖放字幕檔（與選檔共用載入函式）、非字幕副檔名顯示錯誤
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/subtitle-tool.html');
    const drop = (name, text) => page.evaluate((name, text) => {
        const dt = new DataTransfer(); dt.items.add(new File([text], name));
        document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, name, text);
    const wait = (ms = 400) => new Promise(r => setTimeout(r, ms));
    await drop('a.srt', '1\n00:00:01,000 --> 00:00:03,000\nhi\n\n2\n00:00:04,000 --> 00:00:05,000\nyo\n'); await wait();
    assert.equal(await page.$$eval('#tb tr', l => l.length), 2);
    await drop('a.png', 'x'); await wait();
    assert.ok(await page.$eval('#msg', e => e.className === 'bad' && e.textContent.includes('不支援')));
    assert.equal(await page.$$eval('#tb tr', l => l.length), 2, '錯誤檔案不應覆蓋已載入字幕');
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
