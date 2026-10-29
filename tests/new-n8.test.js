// 批次 n8：孩子成長記錄（child-growth）、寶寶作息的成長 / 副食品記錄（baby-log）、寵物記錄的健檢 / 貓砂 / 海報（pet-log）
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- child-growth ----------
    const m = load('fun/child-growth.html', 'L, validDate, ageOf, ageText, normKids, normMiles, normBooks, normSitter, normState, addKid, removeKid, addVax, removeVax, vaxPending, refSchedule, MILES, MILE_IDS, milesGroup, setMile, mileProgress, addBook, removeBook, bookStats, STORIES, pickStory, secsText, cardText, SITTER, checkVax');
    const { L, ageOf, ageText } = m, T = '2026-10-28';
    // 月齡跨月底
    assert.deepStrictEqual([ageOf('2026-01-31', '2026-02-28').months, ageOf('2026-01-31', '2026-02-28').d], [1, 0]);   // 月底：1/31 → 2/28 算滿 1 個月
    assert.deepStrictEqual([ageOf('2026-01-31', '2026-02-27').months, ageOf('2026-01-31', '2026-02-27').d], [0, 27]);
    assert.strictEqual(ageOf('2026-01-31', '2026-03-31').months, 2);
    assert.strictEqual(ageOf('2026-01-31', '2026-03-01').months, 1);
    assert.strictEqual(ageOf('2024-02-29', '2025-02-27').months, 11); assert.strictEqual(ageOf('2024-02-29', '2025-02-28').months, 12);        // 閏日：2/29 → 隔年 2/28 算滿週年
    assert.strictEqual(ageOf('2024-02-29', '2025-03-01').months, 12);
    assert.strictEqual(ageOf('2025-10-28', T).months, 12); assert.strictEqual(ageOf('2025-10-29', T).months, 11);
    assert.strictEqual(ageOf('2027-01-01', T), null); assert.strictEqual(ageOf('bad', T), null); assert.strictEqual(ageOf('2026-02-30', T), null);
    assert.strictEqual(ageText(ageOf('2024-08-15', T)), '2 歲 2 個月 13 天'); assert.strictEqual(ageText(ageOf(T, T)), '今天出生'); assert.strictEqual(ageText(ageOf('2026-10-20', T)), '出生第 8 天');
    // 紀念卡文字
    assert.deepStrictEqual(m.cardText('2026-01-31', '2026-02-27'), { big: '27', unit: '天' }); assert.deepStrictEqual(m.cardText('2026-01-31', '2026-02-28'), { big: '1', unit: '個月' });
    assert.deepStrictEqual(m.cardText('2025-10-28', T), { big: '12', unit: '個月' });
    assert.deepStrictEqual(m.cardText('2024-10-28', T), { big: '2 歲', unit: '' });
    assert.deepStrictEqual(m.cardText('2024-08-28', T), { big: '2 歲', unit: '2 個月' });
    assert.strictEqual(m.cardText('2027-01-01', T), null);
    // 孩子上限與驗證
    let st = m.normState(null); assert.deepStrictEqual(st.kids, []); assert.deepStrictEqual(st.sitter, m.normSitter(null));
    assert.ok(m.addKid(st, { name: '', birth: '2025-01-01' }, T).err); assert.ok(m.addKid(st, { name: 'A', birth: '2027-01-01' }, T).err); assert.ok(m.addKid(st, { name: 'A', birth: '2025-02-30' }, T).err);
    const ids = [];
    for (let i = 0; i < L.KIDS; i++) { const r = m.addKid(st, { name: 'K' + i, birth: '2025-01-01' }, T); assert.ok(!r.err); st = r.st; ids.push(r.id); }
    assert.ok(/最多 6 位/.test(m.addKid(st, { name: 'X', birth: '2025-01-01' }, T).err)); assert.strictEqual(st.kids.length, 6);
    // 疫苗：驗證、上限、刪除
    assert.ok(m.addVax(st, ids[0], { name: '', date: '2026-01-01' }).err); assert.ok(m.addVax(st, ids[0], { name: 'x' }).err);
    assert.ok(m.addVax(st, ids[0], { name: 'x', date: '2026-02-01', next: '2026-01-01' }).err); assert.ok(m.addVax(st, 'nope', { name: 'x', date: '2026-02-01' }).err);
    assert.ok(m.addVax(st, ids[0], { name: 'x'.repeat(31), date: '2026-02-01' }).err);
    let r = m.addVax(st, ids[0], { name: '五合一', dose: '第1劑', date: '2026-04-10', next: '2026-06-10' }); assert.ok(!r.err); st = r.st; const v1 = r.id;
    r = m.addVax(st, ids[0], { name: 'B肝', date: '2026-03-01' }); st = r.st;
    assert.strictEqual(st.kids[0].vax.length, 2); assert.strictEqual(st.kids[1].vax.length, 0);
    st = m.removeVax(st, ids[0], v1); assert.strictEqual(st.kids[0].vax.length, 1);
    let big = st; for (let i = 0; i < 99; i++) big = m.addVax(big, ids[0], { name: 'v' + i, date: '2026-01-01' }).st;
    assert.strictEqual(big.kids[0].vax.length, 100); assert.ok(/100/.test(m.addVax(big, ids[0], { name: 'z', date: '2026-01-01' }).err));
    // 提醒：同名只看最新一筆；日期狀態
    const kd = { vax: [{ id: 'a', name: 'P', dose: '1', date: '2026-04-01', next: '2026-06-01', note: '' }, { id: 'b', name: 'P', dose: '2', date: '2026-06-01', next: '', note: '' }, { id: 'c', name: 'Q', dose: '', date: '2026-10-01', next: '2026-11-05', note: '' }, { id: 'd', name: 'R', dose: '', date: '', next: '2026-10-20', note: '' }, { id: 'e', name: 'S', dose: '', date: '2026-09-01', next: '2026-12-31', note: '' }] };
    const pend = m.vaxPending(kd, T);
    assert.deepStrictEqual(pend.map(x => [x.name, x.days, x.state]), [['R', -8, 'over'], ['Q', 8, 'soon'], ['S', 64, 'ok']]);
    assert.strictEqual(m.vaxPending(kd, '2026-11-05').find(x => x.name === 'Q').days, 0);
    // 建議對照
    const ref = m.refSchedule('2026-01-31', T); assert.strictEqual(ref[0].due, '2026-01-31'); assert.strictEqual(ref[1].due, '2026-02-28'); assert.strictEqual(ref[5].due, '2027-01-31'); assert.deepStrictEqual(m.refSchedule('bad', T), []);
    // 里程碑
    assert.ok(m.MILES.length >= 10 && m.MILES.every(g => g.items.length >= 3 && g.items.every(i => i.id && i.text && i.dom)));
    assert.strictEqual(m.MILE_IDS.size, m.MILES.reduce((s, g) => s + g.items.length, 0));
    assert.strictEqual(m.milesGroup(0).m, 2); assert.strictEqual(m.milesGroup(7).m, 6); assert.strictEqual(m.milesGroup(12).m, 12); assert.strictEqual(m.milesGroup(500).m, 60);
    let mi = m.setMile({}, 'k', '12-1', '2026-10-01'); assert.deepStrictEqual(mi, { k: { '12-1': '2026-10-01' } });
    assert.deepStrictEqual(m.setMile(mi, 'k', '99-9', '2026-10-01'), mi); assert.deepStrictEqual(m.setMile(mi, 'k', '12-1', ''), {}); assert.deepStrictEqual(m.setMile(mi, 'k', '12-1', 'bad'), {});
    assert.deepStrictEqual(m.mileProgress(mi, 'k', m.MILES.find(g => g.m === 12)), { done: 1, total: 4 });
    assert.deepStrictEqual(m.normMiles({ [ids[0]]: { '12-1': '2026-10-01', zz: '2026-10-01', '12-2': 'bad' }, ghost: { '12-1': '2026-10-01' }, [ids[1]]: [1] }, st.kids), { [ids[0]]: { '12-1': '2026-10-01' } });
    assert.deepStrictEqual(m.normMiles(null, st.kids), {}); assert.deepStrictEqual(m.normMiles([], st.kids), {});
    // 閱讀：驗證、上限、統計
    const bk = { title: '好餓的毛毛蟲', date: '2026-10-27', min: '15', note: '喜歡', kid: ids[0] };
    assert.ok(m.addBook(st, { ...bk, kid: 'nope' }).err); assert.ok(m.addBook(st, { ...bk, title: ' ' }).err); assert.ok(m.addBook(st, { ...bk, min: '0' }).err); assert.ok(m.addBook(st, { ...bk, min: '601' }).err); assert.ok(m.addBook(st, { ...bk, min: '1.5' }).err); assert.ok(m.addBook(st, { ...bk, date: '2026-13-01' }).err);
    r = m.addBook(st, bk); st = r.st; const b1 = r.id; st = m.addBook(st, { ...bk, title: '好餓的毛毛蟲', date: '2026-10-01', min: 20 }).st; st = m.addBook(st, { ...bk, title: '晚安月亮', date: '2026-09-15', min: 5 }).st;
    assert.deepStrictEqual(st.books.map(b => b.date), ['2026-09-15', '2026-10-01', '2026-10-27']);
    assert.deepStrictEqual(m.bookStats(st.books, ids[0], T), { count: 3, minutes: 40, titles: 2, monthCount: 2, monthMin: 35, recentCount: 2, recentMin: 35 });
    assert.deepStrictEqual(m.bookStats(st.books, ids[1], T).count, 0);
    st = m.removeBook(st, b1); assert.strictEqual(st.books.length, 2);
    let bigB = []; for (let i = 0; i < 1005; i++) bigB.push({ id: 'b' + i, kid: ids[0], title: 'T' + i, date: '2026-01-01', min: 1 });
    assert.strictEqual(m.normBooks(bigB, st.kids).length, 1000);
    let full = { ...st, books: m.normBooks(bigB.slice(0, 1000), st.kids) }; assert.ok(/1000/.test(m.addBook(full, bk).err));
    // 刪孩子連帶
    st = { ...st, miles: { [ids[0]]: { '12-1': '2026-10-01' }, [ids[1]]: { '12-1': '2026-10-01' } }, books: [...st.books, ...m.normBooks([{ id: 'zz', kid: ids[1], title: 'B', date: '2026-10-01', min: 3 }], st.kids)] };
    const rm = m.removeKid(st, ids[0]);
    assert.strictEqual(rm.kids.length, 5); assert.ok(!rm.miles[ids[0]] && rm.miles[ids[1]]); assert.ok(rm.books.every(b => b.kid !== ids[0])); assert.strictEqual(rm.books.length, 1); assert.deepStrictEqual(rm.sitter, st.sitter);
    // 載入容錯
    const junk = m.normState({ kids: [null, 5, { name: '', birth: '2025-01-01' }, { name: 'ok', birth: 'bad' }, { id: 'a', name: 'A', birth: '2025-01-01', vax: [null, { name: 'v', date: 'x' }, { name: 'v', date: '2025-02-01' }, { id: 'dup', name: 'v1', date: '2025-02-01' }, { id: 'dup', name: 'v2', date: '2025-02-01' }] }, { id: 'a', name: 'B', birth: '2025-02-01' }], miles: 7, books: 'x', sitter: [] });
    assert.strictEqual(junk.kids.length, 2); assert.notStrictEqual(junk.kids[0].id, junk.kids[1].id); assert.strictEqual(junk.kids[0].vax.length, 3); assert.strictEqual(new Set(junk.kids[0].vax.map(v => v.id)).size, 3);
    assert.deepStrictEqual(m.normState('x').kids, []); assert.deepStrictEqual(m.normState({ kids: { a: 1 } }).kids, []);
    const manyKids = m.normKids(Array.from({ length: 9 }, (_, i) => ({ id: 'k' + i, name: 'N' + i, birth: '2025-01-01', vax: Array.from({ length: 150 }, (_, j) => ({ name: 'v' + j, date: '2025-02-01' })) })));
    assert.strictEqual(manyKids.length, 6); assert.strictEqual(manyKids[0].vax.length, 100);
    const sit = m.normSitter({ child: 'x'.repeat(99), sleep: 'y'.repeat(999), c1: 5, bogus: 'q' }); assert.strictEqual(sit.child.length, 30); assert.strictEqual(sit.sleep.length, 300); assert.strictEqual(sit.c1, ''); assert.ok(!('bogus' in sit));
    assert.deepStrictEqual(Object.keys(sit), m.SITTER.map(s => s[0]));
    // 故事
    assert.ok(m.STORIES.length >= 20 && m.STORIES.every(s => s.title && s.text.length > 60 && s.secs > 0));
    assert.strictEqual(new Set(m.STORIES.map(s => s.title)).size, m.STORIES.length);
    assert.ok(m.STORIES.some(s => s.secs <= 30) && m.STORIES.some(s => s.secs > 30)); assert.ok(m.STORIES.every(s => s.secs <= 120));
    for (const max of [0, 30, 60, 120]) for (const x of [0, 0.5, 0.999999]) { const i = m.pickStory(max, x); assert.ok(i >= 0 && (!max || m.STORIES[i].secs <= max)); }
    assert.strictEqual(m.pickStory(1, 0.5), -1);
    assert.ok(/秒/.test(m.secsText(25)) && /分鐘/.test(m.secsText(90)));
    ok('child-growth: 月齡跨月底、疫苗提醒 / 上限、里程碑、閱讀統計、刪孩子連帶、載入容錯、故事');
}

{ // ---------- baby-log 成長 / 副食品 ----------
    const m = load('fun/baby-log.html', 'XL, cleanGrowth, cleanFood, cleanExtra, addX, removeX, growthSeries, foodHint, validDay');
    assert.strictEqual(m.validDay('2026-02-29'), false); assert.strictEqual(m.validDay('2028-02-29'), true);
    assert.strictEqual(m.cleanGrowth({ d: '2026-10-01' }), null); assert.strictEqual(m.cleanGrowth({ d: '2026-10-01', h: 5 }), null); assert.strictEqual(m.cleanGrowth({ d: '2026-10-01', h: '', w: '', c: '' }), null);
    assert.deepStrictEqual(m.cleanGrowth({ d: '2026-10-01', h: '65.5', w: 7.123, c: 99, note: ' hi ' }), { id: '', d: '2026-10-01', h: 65.5, w: 7.12, c: null, note: 'hi' });
    assert.strictEqual(m.cleanFood({ d: '2026-10-01', name: ' ' }), null); assert.strictEqual(m.cleanFood({ d: 'x', name: 'a' }), null);
    assert.deepStrictEqual(m.cleanFood({ d: '2026-10-01', name: 'a'.repeat(30), react: 'zzz' }), { id: '', d: '2026-10-01', name: 'a'.repeat(20), react: 'ok', note: '' });
    let ex = m.cleanExtra(null); assert.deepStrictEqual(ex, { g: [], f: [] }); assert.deepStrictEqual(m.cleanExtra([1, 2]), { g: [], f: [] });
    let r = m.addX(ex, 'g', { d: '2026-10-05', h: 70 }); ex = r.ex; ex = m.addX(ex, 'g', { d: '2026-09-05', h: 66, w: 7.5 }).ex; ex = m.addX(ex, 'g', { d: '2026-10-20', w: 8 }).ex;
    assert.deepStrictEqual(ex.g.map(x => x.d), ['2026-09-05', '2026-10-05', '2026-10-20']);
    assert.deepStrictEqual(m.growthSeries(ex.g, 'h').map(p => [p.d, p.v]), [['2026-09-05', 66], ['2026-10-05', 70]]); assert.deepStrictEqual(m.growthSeries(ex.g, 'c'), []);
    assert.ok(m.addX(ex, 'g', { d: '2026-10-05' }).err); assert.ok(m.addX(ex, 'f', { d: '2026-10-05', name: '' }).err);
    ex = m.removeX(ex, 'g', r.entry.id); assert.strictEqual(ex.g.length, 2); assert.strictEqual(ex.g.every(x => x.id !== r.entry.id), true);
    // 上限：拒絕新增，不偷刪舊的
    const many = Array.from({ length: 510 }, (_, i) => ({ id: 'g' + i, d: '2026-10-01', h: 60 + (i % 10) })); const capped = m.cleanExtra({ g: many, f: [] }); assert.strictEqual(capped.g.length, 500);
    const rej = m.addX(capped, 'g', { d: '2026-10-02', h: 60 }); assert.ok(/500/.test(rej.err)); assert.strictEqual(rej.ex, capped);
    // 副食品提示
    let fx = { g: [], f: [] }; fx = m.addX(fx, 'f', { d: '2026-10-01', name: '米糊' }).ex; fx = m.addX(fx, 'f', { d: '2026-10-10', name: '南瓜' }).ex;
    assert.deepStrictEqual(m.foodHint(fx.f, '胡蘿蔔', '2026-10-20'), []);
    assert.deepStrictEqual(m.foodHint(fx.f, '胡蘿蔔', '2026-10-12'), ['距離上一個食材「南瓜」（2026-10-10）只有 2 天，一般建議一次一種、觀察數天']);
    assert.deepStrictEqual(m.foodHint(fx.f, '米糊', '2026-10-20'), ['「米糊」19 天前（2026-10-01）已導入過']);
    assert.strictEqual(m.foodHint(fx.f, '米糊', '2026-10-11').length, 2); assert.deepStrictEqual(m.foodHint(fx.f, '', '2026-10-11'), []); assert.deepStrictEqual(m.foodHint(fx.f, 'x', 'bad'), []);
    ok('baby-log: 成長記錄 / 副食品導入的驗證、排序、上限、刪除、提示');
}

{ // ---------- pet-log 健檢 / 貓砂 / 海報 ----------
    const m = load('fun/pet-log.html', 'ETYPES, CYC_TYPES, DEFAULT_CYC, LITTER, normData, addPet, updatePet, removePet, addEvent, dueList, normLit, checkLit, setLitter, clearLitter, litterPlan, checkPoster');
    const T = '2026-10-28';
    assert.ok(m.ETYPES.includes('年度健檢') && m.ETYPES.includes('牙齒保健') && m.ETYPES.includes('看診')); assert.deepStrictEqual(m.DEFAULT_CYC, { 年度健檢: 12, 牙齒保健: 12 });
    let d = m.normData(null); let r = m.addPet(d, { name: '小花', sp: '貓', size: '', birth: '' }); d = r.d; const pid = r.id;
    // 年度健檢週期事件：月底與提醒
    d = m.addEvent(d, pid, { type: '年度健檢', date: '2025-10-31', name: '', val: '', cyc: '12', cu: 'm', note: '' }).d;
    d = m.addEvent(d, pid, { type: '牙齒保健', date: '2026-08-31', name: '洗牙', val: '', cyc: '6', cu: 'm', note: '' }).d;
    const dl = m.dueList(d, T, pid); assert.deepStrictEqual(dl.map(x => [x.type, x.due, x.state]), [['年度健檢', '2026-10-31', 'soon'], ['牙齒保健', '2027-02-28', 'ok']]);
    assert.ok(m.addEvent(d, pid, { type: '牙齒保健', date: '2026-08-31', cyc: '999', cu: 'm' }).err);
    // 舊資料沒有 lit → null；壞 lit → null；更新寵物保留 lit
    const old = m.normData({ pets: [{ id: 'p1', name: 'A', sp: '貓' }, { id: 'p2', name: 'B', sp: '貓', lit: 5 }, { id: 'p3', name: 'C', lit: { cats: 0, kind: '礦砂', bag: 5, box: 3, g: 100, cycle: 20 } }], events: [] });
    assert.deepStrictEqual(old.pets.map(p => p.lit), [null, null, null]);
    const lit = { cats: 2, kind: '豆腐砂', bag: 6, box: 4, g: 120, cycle: 14, buy: '2026-10-20', chg: '2026-10-25' };
    assert.ok(m.checkLit({ ...lit, cats: 0 })); assert.ok(m.checkLit({ ...lit, kind: '沙' })); assert.ok(m.checkLit({ ...lit, bag: '' })); assert.ok(m.checkLit({ ...lit, buy: '2026-02-30' })); assert.strictEqual(m.checkLit(lit), '');
    assert.ok(m.checkLit({ ...lit, g: 5 })); assert.ok(m.checkLit({ ...lit, box: 31 }));
    let s = m.setLitter(d, pid, lit); assert.ok(!s.err); d = s.d; const p = d.pets.find(x => x.id === pid); assert.strictEqual(p.lit.cats, 2); assert.strictEqual(p.lit.kind, '豆腐砂');
    assert.ok(m.setLitter(d, 'nope', lit).err);
    d = m.updatePet(d, pid, { name: '小花2', sp: '貓', size: '', birth: '' }).d; assert.strictEqual(d.pets[0].lit.cats, 2);
    // 計算：每日 = 2×120g + 4/14 kg；一包 6kg
    const pl = m.litterPlan(d.pets[0].lit, T);
    assert.strictEqual(pl.daily, Math.round((0.24 + 4 / 14) * 1000) / 1000); assert.strictEqual(pl.bagDays, Math.floor(6 / (0.24 + 4 / 14)));
    assert.strictEqual(pl.runOut, Util.day.shift('2026-10-20', pl.bagDays)); assert.strictEqual(pl.runOutIn, Util.day.between(T, pl.runOut));
    assert.strictEqual(pl.nextChange, '2026-11-08'); assert.strictEqual(pl.changeIn, 11);
    assert.strictEqual(m.litterPlan(null, T), null);
    const nodate = m.litterPlan({ ...lit, buy: '', chg: '' }, T); assert.strictEqual(nodate.runOut, ''); assert.strictEqual(nodate.runOutIn, null); assert.strictEqual(nodate.nextChange, '');
    d = m.clearLitter(d, pid); assert.strictEqual(d.pets[0].lit, null);
    // 刪寵物連帶刪貓砂與事件
    d = m.setLitter(d, pid, lit).d; const rm = m.removePet(d, pid); assert.strictEqual(rm.pets.length, 0); assert.strictEqual(rm.events.length, 0);
    // 海報驗證
    assert.ok(m.checkPoster({ name: '', tel: '0912345678' }).err); assert.ok(m.checkPoster({ name: 'A', tel: '123' }).err); assert.ok(m.checkPoster({ name: 'A', tel: '0912345678', date: '2026-02-30' }).err);
    const pr = m.checkPoster({ name: 'A'.repeat(30), tel: '0912-345-678', feat: 'f'.repeat(99), date: '2026-10-01' }); assert.ok(!pr.err); assert.strictEqual(pr.v.name.length, 20); assert.strictEqual(pr.v.feat.length, 60); assert.strictEqual(pr.v.who, '');
    ok('pet-log: 年度健檢 / 牙齒保健週期、貓砂設定與計算、舊資料相容、刪除連帶、海報驗證');
}
