#!/usr/bin/env node
'use strict';
/* v34.8.27 — مبنای ریالی ارجاع فاکتور به حسابدار.
   تصمیم کارفرما: سندی که به حسابدار می‌رسد باید ریالی باشد.
   • پیشنهاد ارزیِ دارای نسخهٔ ریالی → حسابدار فقط نسخهٔ ریالی را می‌بیند.
   • پیشنهاد ارزیِ بدون نسخهٔ ریالی → هنگام ارجاع، نرخ تسعیر از کاربر پرسیده می‌شود،
     نسخهٔ ریالی ساخته شده و سپس ارجاع انجام می‌شود. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sf = read('crm/salesfiles.js');
var inv = read('crm/official-invoice-v2.js');
var api = read('api/sales-domain.php');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.27', ver.crm_version === 'v34.8.27', ver.crm_version);
T('salesfiles.js cache-bust 34.8.27', /salesfiles\.js\?v=34\.8\.27/.test(idx));
T('official-invoice-v2.js cache-bust 34.8.27', /official-invoice-v2\.js\?v=34\.8\.27/.test(idx));

/* ① هستهٔ ارجاع — مبنای ریالی */
T('why=need_rial برای ارزی بدون نسخهٔ ریالی', sf.indexOf("why: 'need_rial'") > -1);
T('invRef فیلد rialBasis دارد', sf.indexOf('rialBasis: rialBasis') > -1);
T('invRef فیلد fxNo/fxCurrency دارد', sf.indexOf('fxNo: isFx ? o.no') > -1);
T('گارد نقش ارشد حفظ شد', sf.indexOf("!isSenior()) return { ok: false, why: 'role' }") > -1);
T('گارد پرونده برنده حفظ شد', sf.indexOf("!r || !r.wonOffer) return { ok: false, why: 'nofile' }") > -1);
T('گارد ارجاع تکراری حفظ شد', sf.indexOf("if (o.invRef) return { ok: false, why: 'already' }") > -1);
T('timeline به مبنای ریالی اشاره می‌کند', sf.indexOf("' — مبنای ریالی ' + comp.no") > -1);

/* ② ارجاع ارزیِ بدون نسخهٔ ریالی → پرسش نرخ و ساخت نسخهٔ ریالی */
T('sfInvoiceRefFinish تعریف شد', /window\.sfInvoiceRefFinish = function \(cd\)\s*\{/.test(sf));
T('sfInvoiceRefRialPrompt تعریف شد', /window\.sfInvoiceRefRialPrompt = function \(cd, offerNo, currency, totalFx\)\s*\{/.test(sf));
T('sfInvoiceRefRialDo تعریف شد', /window\.sfInvoiceRefRialDo = function \(cd, offerNo\)\s*\{/.test(sf));
T('رفتن به prompt در why=need_rial', sf.indexOf("if (res.why === 'need_rial')") > -1);
T('فراخوانی ptfOfferRialConvertCommit در مسیر ارجاع', sf.indexOf('window.ptfOfferRialConvertCommit(offerNo, rate, dateISO, function (res)') > -1);
T('ادامهٔ ارجاع پس از ساخت ریالی (sfInvoiceRefCommit(cd,res.no))', sf.indexOf('sfInvoiceRefCommit(cd, res.no)') > -1);

/* ③ پنل حسابدار — فقط نسخهٔ ریالی */
T('تشخیص نسخهٔ ریالی (ptfRialCompanionOf/rialBasis)', inv.indexOf('ptfRialCompanionOf(o.no)') > -1);
T('دکمهٔ «💱 مبنای ریالی (PDF)»', inv.indexOf('💱 مبنای ریالی (PDF)') > -1);
T('چاپ نسخهٔ ریالی با offerPrint(comp.no)', inv.indexOf('offerPrint(') > -1 && inv.indexOf('arg(comp.no)') > -1);
T('ctx دارای rialBasisNo', inv.indexOf('rialBasisNo:comp?comp.no') > -1);
T('پیش‌فرض مبلغ پایه از جمع ریالی', inv.indexOf("esc(inv?inv.base:(rialTotal||''))") > -1);
T('کادر «مبنای ریالی» در فرم ثبت', inv.indexOf('مبنای ریالی:') > -1);
T('payload ثبت فاکتور دارای rialBasisNo', inv.indexOf('rialBasisNo:x.rialBasisNo') > -1);

/* ④ سرور */
T('فیلد rialBasisNo در رکورد register_invoice', api.indexOf("'rialBasisNo'=>sd_text(\$body['rialBasisNo']") > -1);
T('فیلد rialBasisRate در رکورد', api.indexOf("'rialBasisRate'=>sd_num(\$body['rialBasisRate']") > -1);
T('فیلد rialBasisTotal در رکورد', api.indexOf("'rialBasisTotal'=>(int)round(sd_num(\$body['rialBasisTotal']") > -1);

T('tester478 در گیت CI', gate.indexOf('tester478-v34.7.76-invoice-rial-basis.js') > -1);

console.log('\n— tester478 (v34.8.27: مبنای ریالی ارجاع فاکتور به حسابدار) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
