#!/usr/bin/env node
'use strict';
/* v34.37.0 — سرعت بخشیدن به ماژول تامین‌کنندگان + ثبت‌نام‌های سایت (SUP-PERF-001).
   بررسی می‌کند که:
   - پاسخ get_inbox گزیپ/فارش (fresh/since) شود تا پول ۴۵ ثانیه‌ای دانلود کامل نداشته باشد.
   - سینک کلاینت since را بفرستد و فقط در تغییر واقعی جدول صفحه ثبت‌نام سایت را بسازد.
   - فهرست ثبت‌نام سایت صفحه‌بندی ۵۰تایی + «نمایش بیشتر» داشته باشد و در تب‌های دیگر ساخته نشود.
   - جدول تامین‌کنندگان تاییدشده بدون innerHTML += ساخته شود (رشتهٔ واحد) + جستجوی کلاینت.
   - کادر مالی تامین‌کنندگان محاسبهٔ دوبارهٔ balance را کاهش دهد (balanceHtmlFrom). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var api = read('api/crm.php');
var brg = read('crm/bridge.js');
var chq = read('crm/cheques.js');
var slf = read('crm/supplier-finance.js');
var gate = read('_tools/uat/run-ci-gate.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.37.0', ver.crm_version === 'v34.37.0', ver.crm_version);
T('index.html PTF_CRM_RELEASE = v34.37.0', /window\.PTF_CRM_RELEASE = 'v34\.37\.0'/.test(idx));
T('sw.js RELEASE = v34.37.0', /RELEASE = 'v34\.37\.0'/.test(sw));
T('cache-bust در index.html = 34.37.0', /bridge\.js\?v=34\.37\.0/.test(idx) && /supplier-finance\.js\?v=34\.37\.0/.test(idx));

/* ---------- سرور: get_inbox ---------- */
T('get_inbox با ptf_echo_json (gzip) ارسال می‌شود', /case 'get_inbox':[\s\S]*?ptf_echo_json\(/.test(api));
T('get_inbox امضای since (mtime+size) دارد', api.indexOf("$sig = (int)(is_file($supFile) ? @filemtime($supFile) : 0)") > -1);
T('get_inbox مسیر fresh دارد', api.indexOf("'fresh' => true") > -1 && api.indexOf("hash_equals($since, $sig)") > -1);
T('get_inbox since را به پاسخ برمی‌گرداند', /'since' => \$sig/.test(api));

/* ---------- کلاینت: سینک صندوق ---------- */
T('syncServerInbox since را می‌فرستد', brg.indexOf("encodeURIComponent(_since)") > -1);
T('syncServerInbox پاسخ fresh را می‌شناسد', brg.indexOf("if (d.fresh) return { ok: true, fresh: true }") > -1);
T('syncServerInbox امضای جدید را ذخیره می‌کند', brg.indexOf("ptf_site_inbox_sig") > -1);

/* ---------- کلاینت: فهرست ثبت‌نام سایت ---------- */
T('renderSupPending صفحه‌بندی ۵۰تایی دارد', /var per = 50;/.test(brg));
T('renderSupPending فقط صفحهٔ فعلی را می‌سازد', brg.indexOf("var shown = all.slice(0, (page + 1) * per);") > -1 && brg.indexOf("shown.forEach(function (s) {") > -1);
T('renderSupPending دکمهٔ «نمایش بیشتر» دارد', brg.indexOf("window.supPendingMore = function () {") > -1 && brg.indexOf("نمایش ' +") > -1);
T('رندر جدول ثبت‌نام سایت فقط در تب سایت', brg.indexOf("window._supTabCur || '') !== 'site'") > -1);
T('تب سایت بعد از انتخاب، صندوق را می‌سازد', chq.indexOf("if (showSite && typeof renderSupPending === 'function') renderSupPending();") > -1);

/* ---------- کلاینت: فهرست تاییدشده ---------- */
T('renderSuppliers رشتهٔ جدول را یک‌باره می‌سازد', idx.indexOf("tb.innerHTML = h || '<tr><td colspan=\"5\"") > -1);
T('renderSuppliers دیگر innerHTML += ندارد', idx.indexOf("tb.innerHTML += '<tr><td><strong>' + items[i].cd") < 0);
T('renderSuppliers جستجوی کلاینت دارد', /var q = \(\(\(document\.getElementById\('sSrch'\)/.test(idx));

/* ---------- مالی تامین‌کنندگان ---------- */
T('تابع balanceHtmlFrom برای جلوگیری از محاسبهٔ دوباره', /function balanceHtmlFrom\(b, supCd\)/.test(slf));
T('box() از balanceHtmlFrom استفاده می‌کند', slf.indexOf("balanceHtmlFrom(b, s.cd)") > -1);

/* ---------- گیت CI ---------- */
T('tester483 در گیت CI', gate.indexOf('tester483-v34.7.81-supplier-perf.js') > -1);

console.log('\n— tester483 (v34.37.0: سرعت ماژول تامین‌کنندگان + ثبت‌نام سایت — SUP-PERF-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
