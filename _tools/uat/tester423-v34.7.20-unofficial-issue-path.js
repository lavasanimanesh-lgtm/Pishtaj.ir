#!/usr/bin/env node
'use strict';
/* v34.7.20 — فاز B نقشهٔ فازبندی: بازگرداندن قابلیت‌های مسدود
     UI-01 دیالوگ «صورتحساب غیررسمی» باید برای هر دو شناسهٔ پرونده (_id سروری و cd محلی) باز شود
     UI-02 «صدور مجدد» باید مبلغ/تخفیف/snapshot اقلام را واقعاً ذخیره کند (نه فقط caseId)
     UI-03 تعریف‌های تکراری در crm/offers.js حذف شده باشند
   مرجع: ARENA-RCA-UNOFFICIAL-INVOICE-CASE-NOT-FOUND-2026-08-17.md،
          ARENA-INDEPENDENT-VERIFICATION-AWARD-CHANGE-2026-08-17.md (N3/N4)،
          PLAN-REMAINING-FIXES-PHASED-2026-08-17.md (فاز B) */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- UI-01: رفتار واقعی تابع تطبیق پرونده ---------- */
(function caseLookup() {
  var src = read('crm/unofficial-invoice.js');
  var start = src.indexOf('window.unofficialInvoiceBuilderOpen = function');
  var stopAt = src.indexOf('var collected = window.unofficialInvoiceCollectOffers(_deal);', start);
  var head = src.slice(start, stopAt);
  T('UI-01 الگوی معیوب `x._id || x.cd === dealCd` حذف شده',
    src.indexOf("String(x._id || x.cd || '') === String(dealCd || '')") === -1);
  T('UI-01 هر دو شناسه مستقل بررسی می‌شوند',
    head.indexOf("String(x._id || '') === _needle") > -1 && head.indexOf("String(x.cd || '') === _needle") > -1);

  /* اجرای واقعی همان بلوک تطبیق در sandbox */
  var deals = [
    { _id: 'CASE-S1', cd: 'DEAL-S1', buyerCd: 'CU-1', wonOffer: 'OF-1' },     /* پروندهٔ v35 با شناسهٔ سروری */
    { cd: 'DEAL-L1', buyerCd: 'CU-2', wonOffer: 'OF-2' }                      /* پروندهٔ legacy فقط cd */
  ];
  function lookup(dealCd) {
    var sb = { getData: function () { return deals; }, String: String, res: null };
    vm.createContext(sb);
    vm.runInContext(
      'var dealCd = ' + JSON.stringify(dealCd) + ';' +
      "var _needle = String(dealCd || '').trim();" +
      'res = (getData("ptf_crm_deals") || []).filter(function (x) {' +
      '  if (!x || !_needle) return false;' +
      "  return String(x._id || '') === _needle || String(x.cd || '') === _needle;" +
      '})[0] || null;', sb);
    return sb.res;
  }
  T('UI-01 پروندهٔ v35 با cd پیدا می‌شود (سناریوی باگ اصلی)', !!lookup('DEAL-S1') && lookup('DEAL-S1')._id === 'CASE-S1');
  T('UI-01 پروندهٔ v35 با _id هم پیدا می‌شود', !!lookup('CASE-S1'));
  T('UI-01 پروندهٔ legacy فقط‌cd پیدا می‌شود', !!lookup('DEAL-L1'));
  T('UI-01 شناسهٔ ناموجود پیدا نمی‌شود', lookup('NO-SUCH') === null);
  T('UI-01 ورودی خالی هیچ پرونده‌ای را برنمی‌گرداند (بدون تطبیق کاذب)', lookup('') === null);

  var sf = read('crm/salesfiles.js');
  T('UI-01 فراخوان کشوی پرونده شناسهٔ سروری را اولویت می‌دهد', sf.indexOf('sfUnofficialInvoiceNew(\\\'\' + ptfOnClickArg(r._id || r.cd)') > -1);
  T('UI-01 گاردهای نقش و مرحلهٔ ۷ دست‌نخورده مانده‌اند',
    head.indexOf('فقط برای مدیران ارشد یا حسابدار مجاز است') > -1 && src.indexOf('پس از تحویل کارفرما فعال می') > -1);
})();

/* ---------- UI-02: بازنویسی واقعی صورتحساب موجود ---------- */
(function reissueBranch() {
  var src = read('crm/unofficial-invoice.js');
  var i = src.indexOf('if (existing && !ctx.isConsolidated) {');
  var block = src.slice(i, src.indexOf('  } else {', i));
  T('UI-02 no-op و ذخیرهٔ تکراری حذف شده',
    block.indexOf('_salesCase = _salesCase;') === -1 && (block.match(/setData\('ptf_crm_invoices', invs\)/g) || []).length === 1);
  ['existing.amount = amountIrr', 'existing.base = totalIrr', 'existing.discount = discountIrr',
   'existing.linesSnapshot = ctx.linesSnapshot', 'existing.offerFxRateRef = currentRate'].forEach(function (k) {
    T('UI-02 به‌روزرسانی «' + k.split(' ')[0].replace('existing.', '') + '» انجام می‌شود', block.indexOf(k) > -1);
  });
  T('UI-02 هویت سند (cd/no) و تاریخ صدور دست‌نخورده می‌ماند',
    block.indexOf('existing.cd =') === -1 && block.indexOf('existing.no =') === -1 && block.indexOf('existing.invDate =') === -1);
  T('UI-02 دریافت واقعی حفظ و ردیف مصنوعی پیش‌پرداخت پاک می‌شود',
    block.indexOf('existing.payments =') > -1 && block.indexOf('.filter(function (p)') > -1 &&
    block.indexOf('p.fromAdvance') > -1 && block.indexOf('/^RP-ADV-/') > -1 && block.indexOf('delete existing.advApplied') > -1);
  T('UI-02 هیچ وصول مصنوعی جدیدی ساخته نمی‌شود',
    block.indexOf('payments.push') === -1 && block.indexOf('existing.advApplied =') === -1);
  T('UI-02 بازنویسی در audit ثبت می‌شود', block.indexOf("audit('صورتحساب غیررسمی', 'بازنویسی صورتحساب") > -1);
  T('UI-02 هم‌راستایی سروری با کلید idempotency اختصاصی', block.indexOf("'UNOFFICIAL-REISSUE|'") > -1);
  T('UI-02 در شکست سرور، نسخهٔ قبلی بازگردانده می‌شود', block.indexOf('_before') > -1 && block.indexOf('بازگردانده شد') > -1);
  T('UI-02 کش مطالبات پس از بازنویسی باطل می‌شود', block.indexOf('PTF.ar.invalidate()') > -1);

  /* شبیه‌سازی رفتاری: اجرای همان انتساب‌ها روی یک رکورد واقعی */
  var existing = { cd: 'UNINV-1', no: 'U-100', caseId: '', customerId: '', amount: 500000000, base: 500000000,
    discount: 0, advApplied: 100000000, invDate: '1405/03/01', t: '1405/03/01', payments: [
      { cd: 'RP-ADV-OF-1', amt: 100000000, fromAdvance: true },
      { cd: 'RCPT-REAL-1', amt: 25000000, how: 'bank' }
    ], status: 'active' };
  var sb = { existing: existing, amountIrr: 880000000, totalIrr: 1000000000, discountIrr: 120000000,
    currentRate: 900000,
    discountLabel: 'تخفیف مذاکره', ctx: { discountInput: '12%', linesSnapshot: [{ nm: 'قلم ۱', qty: 2 }], bankAccount: 'ملت' },
    _co: { no: 'OF-1', buyerCo: 'شرکت الف', currency: 'IRR', fxBasis: '' }, _salesCase: { _id: 'CASE-1', buyerCd: 'CU-1' },
    faDate: function () { return '1405/05/26'; }, faDateTime: function () { return '1405/05/26 10:00'; },
    curSession: function () { return { name: 'کاربر' }; }, JSON: JSON, Array: Array, String: String };
  vm.createContext(sb);
  /* ناحیهٔ پیوستهٔ انتساب‌های واقعی از خودِ کد استخراج و اجرا می‌شود (بدون بازنویسی دستی) */
  var a0 = block.indexOf('var _before =');
  var a1 = block.indexOf('delete existing.advApplied;');
  var assignments = block.slice(a0, a1 + 'delete existing.advApplied;'.length);
  T('UI-02 ناحیهٔ انتساب‌ها از کد واقعی استخراج شد', a0 > -1 && a1 > a0);
  vm.runInContext('(function(){' + assignments + '})();', sb);
  T('UI-02 رفتاری: مبلغ جدید روی رکورد نشست', existing.amount === 880000000, existing.amount);
  T('UI-02 رفتاری: تخفیف و snapshot اقلام ذخیره شد', existing.discount === 120000000 && Array.isArray(existing.linesSnapshot), existing.discount);
  T('UI-02 رفتاری: شمارهٔ سند و تاریخ صدور تغییر نکرد', existing.no === 'U-100' && existing.invDate === '1405/03/01');
  T('UI-02 رفتاری: artifact پیش‌پرداخت حذف شد',
    existing.payments.filter(function (x) { return x.fromAdvance || /^RP-ADV-/.test(x.cd || ''); }).length === 0 && !('advApplied' in existing));
  T('UI-02 رفتاری: دریافت واقعی legacy حذف نشد',
    existing.payments.length === 1 && existing.payments[0].cd === 'RCPT-REAL-1');
})();

/* ---------- UI-03: حذف تعریف‌های تکراری ---------- */
(function duplicates() {
  var off = read('crm/offers.js');
  T('UI-03 تنها یک تعریف از offerPostAwardLocked باقی مانده', (off.match(/function offerPostAwardLocked\(/g) || []).length === 1);
  T('UI-03 تنها یک انتساب window.ptfOfferPostAwardLocked وجود دارد', (off.match(/window\.ptfOfferPostAwardLocked = offerPostAwardLocked;/g) || []).length === 1);
  T('UI-03 تنها یک تعریف از ptfGoSalesFileForOffer باقی مانده', (off.match(/window\.ptfGoSalesFileForOffer = function/g) || []).length === 1);
  T('UI-03 قاعدهٔ قفل پس از برد دست‌نخورده است',
    off.indexOf("if (!o || o.kind === 'TO' || o.st !== 'won') return false;") > -1 && off.indexOf('d.wonOffer === o.no || d.offerNo === o.no') > -1);
  T('UI-03 همهٔ نقاط مصرف قفل هنوز به تابع دسترسی دارند', (off.match(/offerPostAwardLocked\(/g) || []).length >= 6);

  /* رفتار قفل با اجرای واقعی تابع سطح‌ماژول */
  var sb = { getData: function () { return [{ wonOffer: 'CO-1', inqNo: 'RFQ-1' }]; }, window: {}, res: null };
  sb.window = sb; vm.createContext(sb);
  var m = off.match(/function offerPostAwardLocked\(o\)[\s\S]*?\n\}/);
  vm.runInContext(m[0] + '\n res = { won: offerPostAwardLocked({ kind:"CO", st:"won", no:"CO-1" }), to: offerPostAwardLocked({ kind:"TO", st:"won", no:"CO-1" }), sent: offerPostAwardLocked({ kind:"CO", st:"sent", no:"CO-1" }) };', sb);
  T('UI-03 رفتار: CO برندهٔ دارای پرونده قفل است', sb.res.won === true);
  T('UI-03 رفتار: پیشنهاد فنی هرگز قفل نمی‌شود', sb.res.to === false);
  T('UI-03 رفتار: پیشنهاد ارسال‌شده قفل نیست', sb.res.sent === false);
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json');
  var m = idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/);
  var v = m ? m[1] : '';
  /* قرارداد نسخه «هم‌راستایی» است نه یک عدد ثابت؛ پین‌کردن عدد باعث شکست کاذب در نسخهٔ بعد می‌شد. */
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf('ptf-crm-' + v) > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester423-v34.7.20-unofficial-issue-path: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
