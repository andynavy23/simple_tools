// 備份加密（shared/js/chrome.js 的純函式）：往返、密碼錯、檔案被改、格式防呆（非同步，登記到 pending）
const assert = require('assert');
const { ok, pending } = require('./_load');
const { encryptBackup, decryptBackup, isEncryptedBackup } = require('../shared/js/chrome.js');

pending.push((async () => {
    const plain = JSON.stringify({ app: 'simple_tools', v: 1, scope: 'all', data: { todo_items: '[{"t":"中文😀"}]', big: 'x'.repeat(200000) } });
    const enc = await encryptBackup(plain, 'pass1234');
    assert.ok(isEncryptedBackup(enc)); assert.ok(!isEncryptedBackup(plain)); assert.ok(!isEncryptedBackup('not json'));
    assert.ok(!enc.includes('todo_items'), '密文不能含明文');
    assert.equal(await decryptBackup(enc, 'pass1234'), plain);
    assert.notEqual(await encryptBackup(plain, 'pass1234'), enc);                    // 同樣內容每次結果不同（隨機 salt / iv）
    await assert.rejects(() => decryptBackup(enc, 'wrong-pass'), /密碼不對或檔案已損毀/);
    const o = JSON.parse(enc); o.ct = o.ct.slice(0, -4) + (o.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await assert.rejects(() => decryptBackup(JSON.stringify(o), 'pass1234'), /密碼不對或檔案已損毀/);
    await assert.rejects(() => encryptBackup(plain, '123'), /至少 4 個字/);
    await assert.rejects(() => decryptBackup(JSON.stringify({ app: 'simple_tools', enc: { alg: 'ROT13' }, ct: 'x' }), 'p'), /不支援/);
    await assert.rejects(() => decryptBackup(JSON.stringify({ app: 'simple_tools', enc: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: 99999999 }, ct: 'x' }), 'pass1234'), /不支援/);   // 過大的迭代次數不能拿來癱瘓瀏覽器
    ok('backup: AES-GCM encrypt / decrypt roundtrip, wrong password, tamper, hostile header');
})());
