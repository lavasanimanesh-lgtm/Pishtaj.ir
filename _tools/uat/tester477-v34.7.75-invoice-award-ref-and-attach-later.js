#!/usr/bin/env node
'use strict';
/* v34.27.0 — ارجاع سند برد به حسابدار + افزودن سند فاکتور/مودیان پس از ثبت.
   درخواست: ① هنگام ارجاع فاکتور از پرونده، سند برد هم در دسترس حسابدار باشد تا بر
   اساس آن فاکتور بزند. ② پس از ثبت فاکتور، امکان افزودن سند فاکتور حسابداری یا سند
   سامانه مودیان وجود داشته باشد.
   رفع: ① دکمهٔ «🏆 سند برد (PDF)» در پنل فاکتورها (official-invoice-v2.js) که
   sfAwardPrint(o.invRef.fromFile, o.no) را صدا می‌زند. ② تابع ptfOfficialAttachmentAdd +
   فرمان سروری invoice_attachment_add (append به files + آینهٔ fin_attachments). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var inv = read('crm/official-invoice-v2.js');
var sf = read('crm/salesfiles.js');
var api = read('api/sales-domain.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.27.0', ver.crm_version === 'v34.27.0', ver.crm_version);
T('official-invoice-v2.js cache-bust 34.27.0', /official-invoice-v2\.js\?v=34\.27.0/.test(idx));

/* ① ارجاع سند برد به حسابدار */
T('دکمهٔ سند برد در پنل فاکتورها', inv.indexOf('🏆 سند برد (PDF)') > -1);
T('فراخوانی sfAwardPrint با fromFile', /sfAwardPrint\(\\.?['\"]\+arg\(o\.invRef\.fromFile\)\+\\?.?['\"]/.test(inv) || inv.indexOf('sfAwardPrint(\'' ) > -1 && inv.indexOf('o.invRef.fromFile') > -1);
T('شرط o.invRef.fromFile', inv.indexOf('o.invRef&&o.invRef.fromFile') > -1);
T('متن اعلان ارجاع به مبنای ریالی اشاره می‌کند', sf.indexOf('مبنای ریالی در پنل فاکتورها قابل مشاهده است') > -1);

/* ② افزودن سند پس از ثبت */
T('تابع ptfOfficialAttachmentAdd تعریف شد', /window\.ptfOfficialAttachmentAdd=function\(invId\)\s*\{/.test(inv));
T('گارد نقش در افزودن سند', inv.indexOf('نقش فعلی مجاز به افزودن سند فاکتور رسمی نیست') > -1);
T('گارد فاکتور غیرفعال', inv.indexOf('فاکتور ابطال‌شده قابل تغییر نیست') > -1);
T('انتخاب نوع سند (حسابداری/مودیان/پشتیبان)', inv.indexOf('ofiAddCat') > -1 && inv.indexOf('modian_tax_invoice') > -1);
T('فرمان invoice_attachment_add صدا زده می‌شود', inv.indexOf("command('invoice_attachment_add'") > -1);
T('دکمهٔ افزودن در دیالوگ اسناد', inv.indexOf('➕ افزودن سند جدید (فاکتور/مودیان)') > -1);

/* ③ فرمان سروری */
T('اکشن invoice_attachment_add در sales-domain.php', api.indexOf("elseif ($action === 'invoice_attachment_add')") > -1);
T('گارد نقش SD_FIN_ROLES', /invoice_attachment_add[\s\S]*?sd_require_role\(SD_FIN_ROLES\)/.test(api));
T('اعتبارسنجی فایل (sd_file_ok)', /invoice_attachment_add[\s\S]*?sd_file_ok\(\$file\)/.test(api));
T('allowlist دستهٔ سند', api.indexOf("['accounting_official_invoice', 'modian_tax_invoice', 'supporting_document']") > -1);
T('گارد دوره مالی قفل', /invoice_attachment_add[\s\S]*?sd_is_locked\(\$snaps/.test(api));
T('append به files فاکتور', /invoice_attachment_add[\s\S]*?\$invoices\[\$ii\]\['files'\]\[\] = \$file/.test(api));
T('آینهٔ fin_attachments', /invoice_attachment_add[\s\S]*?ownerType'\s*=>\s*'official_invoice'/.test(api));
T('correction برای رد ممیزی', /invoice_attachment_add[\s\S]*?kind'\s*=>\s*'add'/.test(api));

T('tester477 در گیت CI', gate.indexOf('tester477-v34.7.75-invoice-award-ref-and-attach-later.js') > -1);

console.log('\n— tester477 (v34.27.0: ارجاع سند برد + افزودن سند فاکتور/مودیان پس از ثبت) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
