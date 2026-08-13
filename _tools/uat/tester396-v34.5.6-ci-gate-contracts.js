'use strict';
/* قرارداد گیت CI: اعلان اقدام‌محور + سینک با توکن + نوشتن مالی از گارد واحد. بدون پین نسخهٔ مرده. */
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var root = path.resolve(__dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

var idx = read('crm/index.html');
var rb = read('crm/rbac.js');
var br = read('crm/bridge.js');
var md = read('crm/myday.js');
var sy = read('crm/sync.js');
var api = read('api/crm.php');
var guard = read('crm/finance-write-guard.js');
var fiscal = read('crm/fiscal.js');
var opex = read('crm/opex.js');
var petty = read('crm/petty.js');
var sf = read('crm/supplier-finance.js');

assert.ok(idx.indexOf('finance-write-guard.js?v=') > -1, 'گارد مالی در index لود شود');
assert.ok(guard.indexOf('window.ptfFinanceAssertWritable') > -1, 'ptfFinanceAssertWritable تعریف شده');
assert.ok(guard.indexOf('window.ptfInvoiceLinkStatus') > -1, 'وضعیت لینک فاکتور تعریف شده');
assert.ok(fiscal.indexOf('window.ptfFiscalYearLocked') > -1, 'قفل سال مالی تعریف شده');
assert.ok(opex.indexOf('ptfFinanceAssertWritable') > -1, 'opex از گارد می‌نویسد');
assert.ok(petty.indexOf('isFiscalLocked') > -1 && petty.indexOf('سال مالی') > -1, 'تنخواه قفل سال دارد');
assert.ok(sf.indexOf('سال مالی قفل') > -1 || sf.indexOf('ptfFiscalYearLocked') > -1, 'فاکتور تامین قفل سال دارد');

assert.ok(sy.indexOf('function authHeaders') > -1 && sy.indexOf('X-CRM-Token') > -1, 'سینک توکن می‌فرستد');
assert.ok(sy.indexOf('headers: authHeaders(true)') > -1, 'پوش از همان هلپر توکن استفاده می‌کند');
assert.ok(api.indexOf('function ptf_echo_json') > -1, 'خروجی JSON فشردهٔ API');
assert.ok(sy.indexOf('if (startupMerged !== newStr) state.dirty[k] = true') > -1, 'استارت‌آپ فقط اختلاف واقعی را dirty می‌کند');
assert.ok(sy.indexOf('window.ptfSyncTrackRecordSave') > -1 && sy.indexOf('در انتظار تأیید سرور') > -1, 'رسید فرم باید ثبت محلی را از تأیید سرور جدا کند');
assert.ok(read('crm/offers.js').indexOf("ptfSyncTrackRecordSave({ key: 'ptf_crm_offers'") > -1, 'پیشنهاد رسید تأیید سرور دارد');
assert.ok(read('crm/bridge.js').indexOf("ptfSyncTrackRecordSave({ key: 'ptf_crm_rfqs'") > -1, 'درخواست رسید تأیید سرور دارد');
assert.ok(petty.indexOf("ptfConfirmCloudSave({ key: PETTY_KEY") > -1, 'هزینه تنخواه رسید تأیید سرور دارد');
assert.ok(sf.indexOf("ptfSyncTrackRecordSave({ key: KEY, id: inv.cd") > -1 && sf.indexOf("ptfSyncTrackRecordSave({ key: KEY, id: rec.cd") > -1, 'فاکتور و پرداخت تأمین رسید تأیید سرور دارند');
assert.ok(read('crm/cheque-module.js').indexOf("ptfSyncTrackRecordSave({ key: key, id: rec.cd") > -1, 'چک رسید تأیید سرور دارد');
assert.ok(api.indexOf("'savedKeys' => array_values(array_unique($saved_keys))") > -1, 'سرور باید ACK کلیدهای واقعاً ذخیره‌شده را برگرداند');
assert.ok(sy.indexOf('var savedKeys = Array.isArray(d.savedKeys) ? d.savedKeys : []') > -1 && sy.indexOf('savedKeys.forEach') > -1, 'کلاینت فقط کلیدهای ACKشده را از صف dirty حذف می‌کند');
assert.ok(sy.indexOf('window.ptfSyncCanWriteKey') > -1 && sy.indexOf("noteWriteFailure(k, 'نقش فعلی اجازه") > -1, 'نوشتن کلید Sync با نقش نامجاز پیش از ذخیره محلی مسدود می‌شود');
assert.ok(sy.indexOf('writeFailures: {}') > -1 && sy.indexOf("writefail: ['🔴'") > -1, 'شکست حافظه/صف باید banner قرمز پایدار داشته باشد');
assert.ok(api.indexOf("'ptf_crm_treasury_calls'") > -1, 'کلید خزانه در allowlist سرور نیز وجود دارد');

assert.ok(typeof rb === 'string' && rb.indexOf('function ntfNeedsAction') > -1, 'گیت اقدام کارتابل');
assert.ok(rb.indexOf('🔴 اقدام لازم') > -1, 'عنوان کارتابل اقدام‌محور است');
assert.ok(rb.indexOf('🔵 اطلاع‌رسانی') === -1, 'بخش اطلاع‌رسانی کارتابل حذف شده');
assert.ok(md.indexOf('ntfNeedsAction') > -1, 'روز من همان گیت کارتابل را دارد');
assert.ok(br.indexOf("kind: 'offer_wait'") === -1, 'اعلان انتظار پیشنهاد ساخته نمی‌شود');
assert.ok(br.indexOf("kind: 'co_expiry'") === -1, 'انقضای CO کارتابل را پر نمی‌کند');
assert.ok(br.indexOf("toRoles: assignee.length ? [] : ['admin', 'chairman', 'ceo', 'commercial']") > -1,
  'مهلت بدون مسئول فقط به ارشد می‌رود');

console.log('PASS tester396 ci-gate-contracts');
