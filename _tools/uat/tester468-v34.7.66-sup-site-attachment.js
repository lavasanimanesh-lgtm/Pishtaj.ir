#!/usr/bin/env node
'use strict';
/* v34.28.0 — تب جداگانهٔ «درخواست‌های سایت» + نمایش فایل پیوست ثبت‌نام تامین‌کننده.
   قرارداد: پنل تامین‌کنندگان تب «درخواست‌های سایت» دارد؛ فهرست کامل ثبت‌نام‌های سایت با
   ستون ضمیمه و دکمهٔ جزئیات؛ مودال supSiteDetail فایل ابری را نمایش می‌دهد؛ supApprove
   فایل و متن درخواست را روی رکورد تاییدشده حفظ می‌کند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var bridge = read('crm/bridge.js');
var cheques = read('crm/cheques.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.28.0', ver.crm_version === 'v34.28.0', ver.crm_version);
T('bridge.js cache-bust 34.28.0', /bridge\.js\?v=34\.28.0/.test(idx));
T('cheques.js cache-bust 34.28.0', /cheques\.js\?v=34\.28.0/.test(idx));

/* تب جداگانه */
T('تب «درخواست‌های سایت» در پنل تامین‌کنندگان', cheques.indexOf('id="supTabSite"') > -1 && cheques.indexOf('ptfSupTab(') > -1);
T('ptfSupTab بخش سایت را toggle می‌کند', cheques.indexOf("var showSite = (t === 'site')") > -1 && cheques.indexOf('supPendWrap') > -1);
T('سربرگ تاییدشده با id برای toggle', bridge.indexOf('id="supApprovedH4"') > -1);

/* فهرست کامل سایت + ضمیمه */
T('renderSupPending همهٔ وضعیت‌ها را نشان می‌دهد', bridge.indexOf("s.status === 'pending'") > -1);
T('ستون ضمیمه با نام فایل', bridge.indexOf('escP(meta.name)') > -1);
T('دکمهٔ جزئیات در هر ردیف', (bridge.match(/supSiteDetail\(/g) || []).length >= 2);
T('شمارندهٔ تب (supTabSite) به‌روز می‌شود', bridge.indexOf("supTabSite')") > -1 && bridge.indexOf('innerHTML = \'🌐 درخواست‌های سایت\'') > -1);

/* مودال جزئیات */
T('مودال supSiteDetail تعریف شده', bridge.indexOf('window.supSiteDetail = function') > -1);
T('مودال فایل پیوست ابری را نمایش می‌دهد', bridge.indexOf('siteAttachmentHtml(s.attachment)') > -1);
T('مودال فیلدهای کامل (ایمیل/برند/شرح) را دارد', bridge.indexOf("row('📧 ایمیل'") > -1 && bridge.indexOf("row('🏭 برندها'") > -1 && bridge.indexOf('📝 شرح درخواست') > -1);

/* حفظ فایل پس از تایید */
T('supApprove پیوست را به files.oth منتقل می‌کند', bridge.indexOf("importedFiles.oth = [{ key: siteAtt.key") > -1);
T('supApprove متن درخواست را حفظ می‌کند', bridge.indexOf('message: s.message || \'\'') > -1);

T('tester468 در گیت CI', gate.indexOf('tester468-v34.7.66-sup-site-attachment.js') > -1);

console.log('\n— tester468 (v34.28.0: تب درخواست‌های سایت + فایل پیوست تامین‌کننده) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
