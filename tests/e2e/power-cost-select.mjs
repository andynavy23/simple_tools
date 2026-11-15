// 用電度數與電費試算：5 風格 × 淺 / 深色，select 與 option 的文字對比 >= 4.5:1（option 以彈出選單實際底色計）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/power-cost.html');
    const bad = [];
    for (const style of ['apple', 'neon', 'paper', 'forest', 'pixel']) for (const mode of ['light', 'dark']) {
        await page.evaluate((s, m) => { Chrome.setStyle(s); Chrome.setMode(m); }, style, mode);
        await new Promise(r => setTimeout(r, 450));
        const res = await page.evaluate(() => {
            const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
            const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
            const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
            const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
            // 從元素往上疊底色，直到不透明
            const bg = (el) => { const st = []; for (let e = el; e; e = e.parentElement) st.push(parse(getComputedStyle(e).backgroundColor)); let c = { r: 255, g: 255, b: 255, a: 1 }; for (const x of st.reverse()) c = over(x, c); return c; };
            const out = []; document.querySelectorAll('details').forEach(d => { d.open = true; });
            for (const s of document.querySelectorAll("select")) { if (!s.getClientRects().length) continue;
                const sc = parse(getComputedStyle(s).color); out.push(['select#' + s.id, cr(sc, bg(s))]);
                const o = s.options[0], oc = parse(getComputedStyle(o).color);
                out.push(['option@' + s.id, parse(getComputedStyle(o).backgroundColor).a === 1 ? cr(oc, bg(o)) : 0]);   // 選項本身要有不透明底色（彈出選單不看 select 的半透明底）
            }
            return out;
        });
        for (const [n, c] of res) if (c < 4.5) bad.push(`${style}/${mode} ${n} ${c.toFixed(2)}`);
    }
    assert.deepEqual(bad, [], '對比不足：' + bad.join('；'));
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
console.log('ok power-cost-select');
