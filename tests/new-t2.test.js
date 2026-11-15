// 批次 t2：寫作小幫手（地址英譯 / 引用格式 / 文字片段）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/writing-helper.html', 'CITIES, addrParse, py, cnNum, cleanRefs, refFormat, refInText, refSort, parseName, cleanSnips, snipFilter, snipImport, snipExport, MAX_REFS, MAX_SNIPS');

// 地址
const A = (s) => m.addrParse(s);
assert.equal(A('台北市信義區市府路1號3樓').en, '3F., No. 1, Shifu Rd., Xinyi Dist., Taipei City 110, Taiwan (R.O.C.)');
assert.equal(A('臺北市大安區忠孝東路四段100巷5弄2號之3').en, "No. 2-3, Aly. 5, Ln. 100, Sec. 4, Zhongxiao E. Rd., Da'an Dist., Taipei City 106, Taiwan (R.O.C.)");
assert.equal(A('台中市西屯區台灣大道三段99號').en, 'No. 99, Sec. 3, Taiwan Blvd., Xitun Dist., Taichung City 407, Taiwan (R.O.C.)');
assert.equal(A('高雄市前金區中正四路一百二十號5樓之2').en, '5F.-2, No. 120, Zhongzheng 4th Rd., Qianjin Dist., Kaohsiung City 801, Taiwan (R.O.C.)');
assert.equal(A('台北市中山區中山北路二段45號').en, 'No. 45, Sec. 2, Zhongshan N. Rd., Zhongshan Dist., Taipei City 104, Taiwan (R.O.C.)');
assert.ok(A('台中市大里區大里路10號').en.startsWith('No. 10, Dali Rd.'), '大里路不被當成里');
assert.ok(A('台北市中正區某某里3鄰重慶南路一段122號').warns.some((w) => w.includes('略過')));
assert.ok(A('台北市中正區重慶南路一段122號').en.includes('Chongqing S. Rd.'));
assert.ok(A('台北市大安區復興南路一段1號地下一樓').en.startsWith('B1F., No. 1'));
// 未收錄：區名與郵遞區號提示
const u = A('新竹縣竹北市光明六路10號');
assert.ok(u.ok && u.en.includes('Zhubei City') && u.en.includes('Hsinchu County') && u.warns.some((w) => w.includes('中華郵政')));
assert.ok(A('台北市信義區饕餮路1號').warns.some((w) => w.includes('自行核對')), '未知字提示');
assert.equal(A('隨便寫').ok, false);
assert.equal(A('   '), null);
assert.equal(A('１０６台北市大安區復興南路一段1號').zip, '106');
// 資料表：每個區名都能完整拼音、縣市 22 個、區數正確
assert.equal(Object.keys(m.CITIES).length, 22);
let nd = 0;
for (const [c, o] of Object.entries(m.CITIES)) for (const [d, z] of Object.entries(o.d)) {
    nd++; assert.ok(/^\d{3}$/.test(z) && d.endsWith('區'), c + d);
    if (!['中區', '東區', '西區', '南區', '北區', '中西區'].includes(d)) assert.equal(m.py(d.slice(0, -1)).miss.length, 0, `${c}${d} 缺拼音`);
}
assert.equal(Object.keys(m.CITIES['台北市'].d).length, 12);
assert.equal(Object.keys(m.CITIES['新北市'].d).length, 29);
assert.equal(Object.keys(m.CITIES['台中市'].d).length, 29);
assert.equal(Object.keys(m.CITIES['桃園市'].d).length, 13);
assert.ok(nd === 115);
assert.equal(m.cnNum('一百零五'), 105); assert.equal(m.cnNum('十一'), 11); assert.equal(m.cnNum('二十三'), 23);
ok('addr');

// 引用
const book = { type: 'book', au: 'John A. Smith', yr: '2020', ti: 'Deep learning', ed: '2', pb: 'MIT Press' };
assert.equal(m.refFormat(book, 'apa'), 'Smith, J. A. (2020). *Deep learning* (2nd ed.). MIT Press.');
assert.equal(m.refFormat(book, 'mla'), 'Smith, John A. *Deep learning*. 2nd ed., MIT Press, 2020.');
assert.equal(m.refFormat(book, 'chicago'), 'Smith, John A. *Deep learning*. 2nd ed. MIT Press, 2020.');
const art = { type: 'article', au: 'Smith, Jane\nLi-Ming Wang', yr: '2019', ti: 'On things', ct: 'Journal of Stuff', vo: '5', is: '2', pg: '12-30', ur: '10.1000/xyz' };
assert.equal(m.refFormat(art, 'apa'), 'Smith, J., & Wang, L.-M. (2019). On things. *Journal of Stuff*, *5*(2), 12–30. https://doi.org/10.1000/xyz');
assert.equal(m.refFormat(art, 'mla'), 'Smith, Jane, and Li-Ming Wang. "On things." *Journal of Stuff*, vol. 5, no. 2, 2019, pp. 12–30. https://doi.org/10.1000/xyz.');
assert.equal(m.refFormat(art, 'chicago'), 'Smith, Jane, and Li-Ming Wang. "On things." *Journal of Stuff* 5, no. 2 (2019): 12–30. https://doi.org/10.1000/xyz.');
const cj = { type: 'book', au: '王小明\n李大華', yr: '2021', ti: '寫作入門', pb: '遠流' };
assert.equal(m.refFormat(cj, 'apa'), '王小明、李大華. (2021). *寫作入門*. 遠流.');
assert.equal(m.refFormat(cj, 'chicago'), '王小明、李大華. *寫作入門*. 遠流, 2021.');
assert.equal(m.refInText(cj, 'apa'), '(王小明、李大華, 2021)');
assert.equal(m.refInText(art, 'apa'), '(Smith & Wang, 2019)');
assert.equal(m.refInText({ ...art, au: 'A B\nC D\nE F' }, 'mla'), '(B et al.)');
const web = { type: 'web', au: '', yr: '', ti: 'Page', ct: 'Site', ur: 'https://x.com', ac: '5 Mar. 2024' };
assert.equal(m.refFormat(web, 'apa'), '*Page*. (n.d.). Site. https://x.com');
assert.ok(m.refFormat(web, 'mla').endsWith('Accessed 5 Mar. 2024.'));
const th = { type: 'thesis', au: 'Wei Chen', yr: '2018', ti: 'A study', pb: 'NTU', dg: 'Doctoral dissertation' };
assert.equal(m.refFormat(th, 'apa'), 'Chen, W. (2018). *A study* [Doctoral dissertation, NTU].');
assert.ok(m.refFormat({ type: 'video', au: 'Lee', yr: '2020', ti: 'Clip', ct: 'YouTube', ur: 'u' }, 'chicago').includes('YouTube video, 2020.'));
// 清單：排序、壞資料、上限
const rs = m.cleanRefs([{ ...book, id: 'a' }, { ...cj, id: 'b' }, { ...art, id: 'c' }, null, 5, { type: 'zzz', ti: 'T', id: 'a' }, { au: 'x' }]);
assert.deepEqual(rs.map((r) => r.id), ['a', 'b', 'c']);
assert.deepEqual(m.refSort(rs, 'author').map((r) => r.id), ['c', 'a', 'b']);
assert.deepEqual(m.refSort(rs, 'year').map((r) => r.id), ['c', 'a', 'b']);
assert.deepEqual(m.cleanRefs('bad'), []);
assert.equal(m.cleanRefs(Array.from({ length: 500 }, (_, i) => ({ ti: 't' + i }))).length, m.MAX_REFS);
assert.ok(!m.cleanRefs([{ ti: 'a*b*', id: 'z' }])[0].ti.includes('*'));
ok('cite');

// 片段
const sn = m.cleanSnips([{ title: '地址', content: '台北市…', tags: ['家', '家', ' 工作 '], id: 's1' }, { content: '簽名檔 Andy', id: 's2' }, { title: 'x', content: '  ' }, null, { content: 'a'.repeat(6000) }]);
assert.equal(sn.length, 3);
assert.deepEqual(sn[0].tags, ['家', '工作']);
assert.equal(sn[1].title, '簽名檔 Andy');
assert.equal(sn[2].content.length, 5000);
assert.deepEqual(m.snipFilter(sn, '簽名', '').map((s) => s.id), ['s2']);
assert.deepEqual(m.snipFilter(sn, '', '家').map((s) => s.id), ['s1']);
assert.equal(m.snipFilter(sn, '工作', '家').length, 1);
const ex = m.snipExport(sn), im = m.snipImport([], ex);
assert.equal(im.added, 3);
assert.equal(m.snipImport(im.list, ex).added, 0);
assert.equal(m.snipImport([], 'oops'), null);
assert.equal(m.snipImport([], '{"a":1}'), null);
const big = m.snipImport([], JSON.stringify(Array.from({ length: 400 }, (_, i) => ({ content: 'c' + i }))));
assert.equal(big.list.length, m.MAX_SNIPS); assert.equal(big.skipped, 100);
ok('snippets');
