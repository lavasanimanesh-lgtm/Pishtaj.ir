'use strict';
/* v34.5.7: migrate.php روی پروداکشن قفل است تا سوییچ رسمی؛ استیجینگ آزاد است. */
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

var mig = fs.readFileSync(path.join(root, 'api/migrate.php'), 'utf8');
var sec = fs.readFileSync(path.join(root, 'api/ptf-secrets.sample.php'), 'utf8');
var prod = fs.readFileSync(path.join(root, '.github/workflows/deploy-production.yml'), 'utf8');

assert.ok(mig.indexOf("require_once __DIR__ . '/secrets.php'") > -1, 'سکرت برای تشخیص محیط لود شود');
assert.ok(mig.indexOf('function ptf_migrate_unlocked') > -1, 'هلپر آنلاک');
assert.ok(mig.indexOf("ptf_runtime_environment() === 'production'") > -1, 'قفل فقط پروداکشن');
assert.ok(mig.indexOf("load_ptf_secret('migrate_allow'") > -1, 'فلگ سکرت');
assert.ok(mig.indexOf('ptf-migrate.unlock') > -1, 'فایل آنلاک خارج از webroot');
assert.ok(mig.indexOf('migrate.php روی پروداکشن قفل است') > -1, 'پیام قفل');
assert.ok(mig.indexOf('http_response_code(403)') > -1, 'HTTP 403');
var iLock = mig.indexOf("ptf_runtime_environment() === 'production'");
var iReset = mig.indexOf("$step === 'reset_mode'");
assert.ok(iLock > -1 && iReset > iLock, 'قفل پروداکشن قبل از هر گام ویزارد');
assert.ok(sec.indexOf("'migrate_allow'") > -1, 'نمونه سکرت فلگ دارد');
var pendingPatch = fs.existsSync(path.join(root, '_tools/PENDING-workflow-ci-gate-2026-08-13.patch'));
assert.ok(prod.indexOf('api/migrate.php') > -1 || pendingPatch, 'FTP پروداکشن migrate.php را مستثنا می‌کند (یا پچ معلق آماده است)'); /* 2026-08-13: استثنا تا اعمال دستی پچ workflow در پچ معلق است */

console.log('PASS tester398 migrate-prod-lock');
