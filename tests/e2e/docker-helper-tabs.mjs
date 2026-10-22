// docker-helper 新分頁（範本庫 / Dockerfile / 命名檢查）與舊分頁、記住分頁
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
{
    const { page, errors } = await openPage(browser, 'utils/docker-helper.html');
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const vis = (s) => page.evaluate((s) => !document.querySelector(s).hidden, s);
    const tab = (t) => page.evaluate((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), t);
    assert.ok((await text('#outRun')).includes('docker run'));
    await tab('tpl');
    assert.ok(await vis('#pgTpl') && !(await vis('#pgRun')));
    assert.ok((await text('#outTpl')).includes('image: "redis:7"'));
    await page.evaluate(() => { const s = document.querySelector('#tplSel'); s.value = 'postgres'; s.dispatchEvent(new Event('change')); });
    assert.ok((await text('#outTpl')).includes('POSTGRES_PASSWORD') && (await text('#outTplEnv')).includes('change_me'));
    await tab('df');
    assert.ok(await vis('#pgDf') && (await text('#outDf')).startsWith('FROM node:22-alpine AS deps'));
    await page.evaluate(() => { const s = document.querySelector('#dfLang'); s.value = 'go'; s.dispatchEvent(new Event('change')); });
    assert.ok((await text('#outDf')).includes('distroless') && (await text('#outDi')).includes('.env'));
    await tab('env');
    await page.evaluate(() => { const t = document.querySelector('#envIn'); t.value = 'db_host=a\nDATABASE_PORT=1\nVITE_X_SECRET=abc'; t.dispatchEvent(new Event('input')); });
    const nm = await text('#naming');
    assert.ok(nm.includes('大寫') && nm.includes('混用') && nm.includes('前端公開'), nm);
    // 記住分頁、舊分頁仍可用
    await page.reload({ waitUntil: 'load' });
    assert.ok(await vis('#pgEnv'));
    await tab('run');
    assert.ok(await vis('#pgRun'));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('docker-helper-tabs OK');
