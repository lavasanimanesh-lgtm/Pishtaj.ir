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
var commission = read('crm/commission.js');
var financeHub = read('crm/financehub.js');
assert.ok(commission.indexOf('دوره شمسی') > -1 && commission.indexOf('ptfJToISO') > -1, 'پورسانت دوره شمسی و تبدیل یکپارچه دارد');
assert.ok(financeHub.indexOf("btn('commission', 'پورسانت فروش'") > -1 && financeHub.indexOf("show('commissionBox', t === 'commission')") > -1, 'پورسانت تب واقعی هاب مالی است، نه دکمهٔ شناور');
assert.ok(commission.indexOf('function commissionSettingsHtml()') > -1 && commission.indexOf('cmSetPct_') > -1 && commission.indexOf('تنظیم درصد تمام کاربران فقط در این بخش') > -1, 'درصد تمام کاربران فقط در تنظیمات قابل تغییر است');
assert.ok(commission.indexOf("'<details id=\"cmConfig\"") === -1, 'تنظیم درصد داخل تب پورسانت نمایش داده نمی‌شود');
var treasury = read('crm/treasury.js'), workcap = read('crm/working-capital.js');
assert.ok(commission.indexOf("var REC_KEY = 'ptf_crm_commission_records'") > -1 && commission.indexOf('ptfCommissionApproveCycle') > -1 && commission.indexOf('ptfCommissionPay') > -1, 'چرخه تصویب و پرداخت پورسانت دفتر مستقل دارد');
assert.ok(commission.indexOf("cat: 'پورسانت فروش کارکنان'") > -1 && commission.indexOf('commissionApprovalCd') > -1, 'تصویب پورسانت هزینه غیررسمی قابل ردیابی می‌سازد');
assert.ok(treasury.indexOf("src: 'پرداخت پورسانت فروش'") > -1 && workcap.indexOf('commissionLiability') > -1, 'پرداخت پورسانت خروج بانک و بدهی آن در تراز منعکس می‌شود');

assert.ok(sy.indexOf('function authHeaders') > -1 && sy.indexOf('X-CRM-Token') > -1, 'سینک توکن می‌فرستد');
assert.ok(sy.indexOf('headers: authHeaders(true)') > -1, 'پوش از همان هلپر توکن استفاده می‌کند');
assert.ok(api.indexOf('function ptf_echo_json') > -1, 'خروجی JSON فشردهٔ API');
assert.ok(sy.indexOf('if (startupMerged !== newStr) state.dirty[k] = true') > -1, 'استارت‌آپ فقط اختلاف واقعی را dirty می‌کند');
assert.ok(sy.indexOf('window.ptfSyncTrackRecordSave') > -1 && sy.indexOf('در انتظار تأیید سرور') > -1, 'رسید فرم باید ثبت محلی را از تأیید سرور جدا کند');
assert.ok(read('crm/offers.js').indexOf("ptfSyncTrackRecordSave({ key: 'ptf_crm_offers'") > -1, 'پیشنهاد رسید تأیید سرور دارد');
assert.ok(read('crm/bridge.js').indexOf("ptfSyncTrackRecordSave({ key: 'ptf_crm_rfqs'") > -1, 'درخواست رسید تأیید سرور دارد');
var offersUi = read('crm/offers.js');
assert.ok(offersUi.indexOf('کارشناس مسئول / مالک پورسانت') > -1 && offersUi.indexOf('مدیر انتخاب می‌کند آیا این مشتری') > -1, 'مالک مشتری/پورسانت در فرم مشتری با فهرست همه کاربران قابل انتخاب است');
assert.ok(petty.indexOf("ptfConfirmCloudSave({ key: PETTY_KEY") > -1, 'هزینه تنخواه رسید تأیید سرور دارد');
assert.ok(sf.indexOf("ptfSyncTrackRecordSave({ key: KEY, id: inv.cd") > -1 && sf.indexOf("ptfSyncTrackRecordSave({ key: KEY, id: rec.cd") > -1, 'فاکتور و پرداخت تأمین رسید تأیید سرور دارند');
assert.ok(read('crm/cheque-module.js').indexOf("ptfSyncTrackRecordSave({ key: key, id: rec.cd") > -1, 'چک رسید تأیید سرور دارد');
assert.ok(api.indexOf("'savedKeys' => array_values(array_unique($saved_keys))") > -1, 'سرور باید ACK کلیدهای واقعاً ذخیره‌شده را برگرداند');
assert.ok(sy.indexOf('var savedKeys = Array.isArray(d.savedKeys) ? d.savedKeys : []') > -1 && sy.indexOf('savedKeys.forEach') > -1, 'کلاینت فقط کلیدهای ACKشده را از صف dirty حذف می‌کند');
assert.ok(sy.indexOf('window.ptfSyncCanWriteKey') > -1 && sy.indexOf("noteWriteFailure(k, 'نقش فعلی اجازه") > -1, 'نوشتن کلید Sync با نقش نامجاز پیش از ذخیره محلی مسدود می‌شود');
assert.ok(sy.indexOf('writeFailures: {}') > -1 && sy.indexOf("writefail: ['🔴'") > -1, 'شکست حافظه/صف باید banner قرمز پایدار داشته باشد');
assert.ok(api.indexOf("'ptf_crm_treasury_calls'") > -1, 'کلید خزانه در allowlist سرور نیز وجود دارد');
var cs = read('crm/client-server.js');
var quota = read('crm/storage-quota.js');
assert.ok(cs.indexOf('window.ptfBAutoBootstrap') > -1 && cs.indexOf("reason: 'existing_local_data'") > -1, 'فاز B فقط برای دستگاه تازه خودکار فعال شود و دادهٔ محلی مبهم را overwrite نکند');
assert.ok(cs.indexOf("window.ptfBFinalize({ auto: true })") > -1 && cs.indexOf("reason: 'local_data_requires_review'") > -1, 'هم‌گرایی خودکار نباید payload موجود را بدون بررسی push کند');
assert.ok(quota.indexOf('window.ptfStorageRequestPersistentAuto') > -1 && quota.indexOf('requestPersistent(true)') > -1, 'Persistent Storage بدون ورود کاربر به تنظیمات درخواست شود');

assert.ok(typeof rb === 'string' && rb.indexOf('function ntfNeedsAction') > -1, 'گیت اقدام کارتابل');
assert.ok(rb.indexOf('🔴 اقدام لازم') > -1, 'عنوان کارتابل اقدام‌محور است');
assert.ok(rb.indexOf('🔵 اطلاع‌رسانی') === -1, 'بخش اطلاع‌رسانی کارتابل حذف شده');
assert.ok(md.indexOf('ntfNeedsAction') > -1, 'روز من همان گیت کارتابل را دارد');
assert.ok(br.indexOf("kind: 'offer_wait'") === -1, 'اعلان انتظار پیشنهاد ساخته نمی‌شود');
assert.ok(br.indexOf("kind: 'co_expiry'") === -1, 'انقضای CO کارتابل را پر نمی‌کند');
assert.ok(br.indexOf("toRoles: assignee.length ? [] : ['admin', 'chairman', 'ceo', 'commercial']") > -1,
  'مهلت بدون مسئول فقط به ارشد می‌رود');
assert.ok(br.indexOf('var stableKey = opt.dkey') > -1 && br.indexOf('n.dkey === stableKey && !n.done') > -1, 'event-poll ارجاع با dkey پایدار کارت تازه نمی‌سازد');
assert.ok(rb.indexOf('var persistentTask') > -1 && rb.indexOf('readBy را دور بزند') > -1, 'ارجاع خوانده‌شده با event تکراری تاریخ امروز نمی‌گیرد');
assert.ok(sy.indexOf('var byTask = {}, nDedup = []') > -1 && sy.indexOf('referral با dkey یکسان باید یک کار بماند') > -1, 'merge سینک ارجاع‌های تکراری قدیمی را یکی می‌کند');

console.log('PASS tester396 ci-gate-contracts');
