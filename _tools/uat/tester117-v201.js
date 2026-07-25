/* tester117 — v20.1 (اسپرینت ۴ از ۵: US-442 ادغام TC در CO — قالب چاپ مجزا) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.1+', (function () { var m = idx.match(/var VER = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 20.1; })());
T('کش sw >= v20.1', (function () { var m = sw.match(/ptf-crm-v([0-9.]+)/); return m && parseFloat(m[1]) >= 20.1; })());
T('cache-bust offers/offers-pro >= 20.1', (function () { var a = idx.match(/offers\.js\?v=([0-9.]+)/), b = idx.match(/offers-pro\.js\?v=([0-9.]+)/); return a && b && parseFloat(a[1]) >= 20.1 && parseFloat(b[1]) >= 20.1; })());

SECTION('US-442 — ساختار: ادغام TC در CO');
T('دکمه «+ پیشنهاد فنی-مالی» حذف شد', of.indexOf("offerNew(\\'TC\\')") === -1 && of.indexOf('+ پیشنهاد فنی-مالی</button>') === -1);
T('سوییچ «قالب چاپ سند» در فرم CO (مالی/فنی-مالی)', of.indexOf('id="ofPrintAs"') > -1 && of.indexOf('Techno-Commercial Offer (فنی-مالی)') > -1);
T('printAs در offerSave ذخیره می‌شود (TC قدیمی پیش‌فرض TC)', of.indexOf("o.printAs = ((document.getElementById('ofPrintAs') || {}).value) || o.printAs || (o.kind === 'TC' ? 'TC' : 'CO')") > -1);
T('مهاجرت نرم: TC قدیمی زیر تب مالی دیده می‌شود', of.indexOf("!(tab === 'CO' && o.kind === 'TC')") > -1);
T('عنوان چاپ قدیمی از printAs', of.indexOf("var title = _pAs === 'TC' ? 'Techno-Commercial Offer'") > -1);
T('قالب‌های ۵گانه (offers-pro): عنوان و پیشوند از printAs', op.indexOf("var title = _pAs === 'TC' ? 'TECHNO-COMMERCIAL OFFER'") > -1 && op.indexOf("var docPrefix = o.kind === 'TO' ? 'TO' : (_pAs === 'TC' ? 'TC' : 'CO')") > -1);
T('پرامپت بدون-TO: دیگر kind را عوض نمی‌کند — فقط printAs', of.indexOf("_offState.printAs = 'TC';") > -1 && of.indexOf("_offState.kind = 'TC';") === -1);
T('ماهیت مالی حفظ: totals/RBAC/پیش‌پرداخت هنوز TC را می‌فهمند (سازگاری عقب‌رو)', of.indexOf("o.kind === 'CO' || o.kind === 'TC'") > -1);

SECTION('رفتاری — عنوان چاپ از printAs');
(function () {
  /* اجرای همان منطق استخراج‌شده از کد (بدون بازنویسی مستقل) */
  var m = of.match(/var _pAs = \(o\.kind !== 'TO'\)[^\n]+\n  var title = [^\n]+;/);
  T('عبارت عنوان printAs در کد موجود', !!m);
  function titleOf(o) { var _pAs, title; eval(m[0]); return title; }
  T('CO بدون printAs → Commercial Offer', titleOf({ kind: 'CO' }) === 'Commercial Offer');
  T('CO با printAs=TC → Techno-Commercial Offer', titleOf({ kind: 'CO', printAs: 'TC' }) === 'Techno-Commercial Offer');
  T('TC قدیمی بدون printAs → Techno-Commercial (مهاجرت نرم)', titleOf({ kind: 'TC' }) === 'Techno-Commercial Offer');
  T('TC قدیمی با printAs=CO → Commercial (کاربر عوض کرده)', titleOf({ kind: 'TC', printAs: 'CO' }) === 'Commercial Offer');
  T('TO → Technical Offer (بی‌تاثیر)', titleOf({ kind: 'TO' }) === 'Technical Offer');
})();

SECTION('رگرسیون');
T('US-367: چرخه TO دست‌نخورده', of.indexOf("ST_TO = { draft:") > -1);
T('US-431ف۱: قفل برنده پابرجا', of.indexOf('offerPostAwardLocked') > -1);
T('US-432: awardDocs snapshot پابرجا', of.indexOf('rec.awardDocs = [{ kind: o.kind') > -1);
T('US-439: مرجع/حاشیه پابرجا', of.indexOf('window.offSetRefPrice') > -1);
T('BUG-033 (v20.0) پابرجا', fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8').indexOf('.mx-dot.a{background:#8b5cf6') > -1);
T('tester35 هم‌راستا شد (قاعده BUG-026)', fs.readFileSync(path.join(__dirname, 'tester35-sprint122.js'), 'utf-8').indexOf('US-442 (v20.1)') > -1);

DONE('tester117-v201');
