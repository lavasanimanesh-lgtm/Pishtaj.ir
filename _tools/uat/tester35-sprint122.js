/* tester35 — اسپرینت ۱۲۲: US-266v2 تسعیر + US-277 TC + US-278 ردیف + فونت */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var wf = fs.readFileSync(path.join(BASE, 'workflow.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

SECTION('US-266v2: تسعیر ارز (طرح تیم متخصص)');
T('دیالوگ دریافت ریالی با نرخ روز', fx.indexOf('ptfFxPayDialog') > -1 && fx.indexOf('نرخ تسعیر روز') > -1);
T('معادل ارزی تراکنش ذخیره می‌شود', fx.indexOf('fxAmt') > -1 && fx.indexOf('amt / rate') > -1);
T('خلاصه فاکتور: مانده ارزی + میانگین نرخ', fx.indexOf('ptfFxInvoiceSummary') > -1 && fx.indexOf('remainFx') > -1 && fx.indexOf('avgRate') > -1);
T('هوک پرداخت فاکتور ارزی', fx.indexOf('patchInvPay') > -1);
T('جدول اسناد ارزی در مطالبات', fx.indexOf('fxSummary') > -1);
T('بدون کلید جدید (روی pays[].fx)', fx.indexOf("localStorage.setItem('ptf_crm_fx") === -1);
/* v16.0 (US-390): مسیر سود به موتور واحد fx.js منتقل شد — همان اصول US-266v2 در موتور جدید */
var fx160 = require('fs').readFileSync(require('path').resolve(__dirname, '../../crm/fx.js'), 'utf-8');
T('سود خالص: فروش = دریافت ریالی واقعی', (idx.indexOf('دریافت‌های ریالی واقعی') > -1 || idx.indexOf('فروش ریالی واقعی') > -1) && fx160.indexOf('res.sellIrr = paidIrr;') > -1);
T('مانده وصول‌نشده در سود لحاظ نمی‌شود', fx160.indexOf('سود فعلی فقط بر مبنای وصولی‌های واقعی') > -1);
// تست رفتاری
global.curSession = () => ({ user: 'admin', name: 'ادمین' });
eval(fx.match(/window\.ptfFxCurOf = function[\s\S]*?\n  \};/)[0].replace('window.ptfFxCurOf =', 'global.ptfFxCurOf ='));
eval(fx.match(/window\.ptfFxInvoiceSummary = function[\s\S]*?\n  \};/)[0].replace('window.ptfFxInvoiceSummary =', 'global.ptfFxInvoiceSummary ='));
setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', currency: 'EUR', items: [{ qty: 10, price: 100 }] }]);
var inv = { offerNo: 'CO-9', pays: [{ amt: 60000000, fx: { rate: 100000, fxAmt: 600 } }] };
var s = ptfFxInvoiceSummary(inv);
T('سند €1000، دریافت 60م با نرخ 100هزار → 600€ وصول', s.paidFx === 600 && s.totalFx === 1000);
T('مانده 400€', s.remainFx === 400);
T('میانگین نرخ 100هزار', s.avgRate === 100000);

SECTION('US-277: TC واقعی');
T('US-442 (v20.1): دکمه TC حذف — قالب چاپ فنی-مالی داخل CO', off.indexOf("offerNew(\\'TC\\')") === -1 && off.indexOf('ofPrintAs') > -1);
T('باگ رفع: فرم TC = مالی با قیمت', ol.indexOf("kind === 'CO' || _offState.kind === 'TC'") > -1 && op.indexOf("kind === 'CO' || _offState.kind === 'TC'") > -1);
T('برند در TC اختیاری', ol.indexOf("k === 'brand' && st.kind === 'TC'") > -1 && ol.indexOf('continue;') > -1);
T('US-261: TC در ماشین وضعیت', wf.indexOf("o.kind === 'CO' || o.kind === 'TC'") > -1);
T('قالب چاپ TC', op.indexOf('TECHNO-COMMERCIAL OFFER') > -1);

SECTION('US-278: ردیف پیش‌فرض + دکمه ＋');
T('دکمه «ردیف دستی» حذف شد', off.indexOf('+ ردیف دستی') === -1);
T('ردیف پیش‌فرض در offerNew', off.indexOf("items: [{ name: '', desc: ''") > -1);
T('دکمه ＋ کنار ردیف اول', ol.indexOf("i === 0 ? '<button type=\"button\" onclick=\"offAddItem()\"") > -1);

SECTION('برگرداندن فونت‌ها');
T('monospace اجباری حذف شد (فرم‌ها)', off.indexOf('monospace,sans-serif!important') === -1);
T('monospace اجباری حذف شد (قالب‌ها)', op.indexOf('monospace,sans-serif!important') === -1);

SECTION('نسخه');
T('VER >= v12.2 + fx.js', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=12.2;})() && idx.indexOf('fx.js?v=') > -1);
DONE('tester35-sprint122');
