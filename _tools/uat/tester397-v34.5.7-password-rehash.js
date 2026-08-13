'use strict';
/* v34.5.7: SHA-256 فقط برای ورود قدیمی؛ سینک bcrypt را پاک نمی‌کند؛ کاربر جدید password می‌فرستد. */
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

var api = read('api/crm.php');
var rb = read('crm/rbac.js');
var sec = read('api/ptf-secrets.sample.php');

assert.ok(api.indexOf('function ptf_is_password_hash') > -1, 'هلپر تشخیص bcrypt');
assert.ok(api.indexOf("empty($next['password_hash']) && !empty($prev['password_hash'])") > -1, 'ادغام password_hash بین منابع');
assert.ok(api.indexOf('if ($ph !== \'\') $row[\'passhash\'] = $ph;') > -1, 'users_sync هش قدیمی را نگه می‌دارد');
assert.ok(api.indexOf('if ($pwh !== \'\') $row[\'password_hash\'] = $pwh;') > -1, 'users_sync bcrypt را نگه می‌دارد');
assert.ok(api.indexOf("preg_replace('/[^a-f0-9]/', '', $u['passhash'] ?? '')") > -1 &&
  api.indexOf("'passhash' => preg_replace('/[^a-f0-9]/', '', $u['passhash'] ?? '')") === -1,
  'دیگر bcrypt را با فیلتر هگز خراب نمی‌کند');
assert.ok(api.indexOf("load_ptf_secret('admin_password_hash'") > -1, 'ادمین bcrypt را می‌پذیرد');
assert.ok(api.indexOf('if (strlen($plain) >= 6 && strlen($plain) <= 256) $pwh = password_hash($plain, PASSWORD_DEFAULT);') > -1,
  'add_user رمز خام را bcrypt می‌کند');
assert.ok(api.indexOf('if ($legacy) migrate_legacy_password_hash($found, $password);') > -1, 'ورود بعدی SHA-256 را ارتقا می‌دهد');
assert.ok(rb.indexOf("fd.append('password', p)") > -1 && rb.indexOf("action=add_user") > -1, 'تعریف کاربر رمز را به سرور می‌فرستد');
assert.ok(sec.indexOf('admin_password_hash') > -1, 'نمونه سکرت bcrypt دارد');

console.log('PASS tester397 password-rehash');
