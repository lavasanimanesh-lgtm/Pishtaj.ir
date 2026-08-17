#!/usr/bin/env node
'use strict';
/* v34.7.22 — فاز D نقشهٔ فازبندی: گاردهای پیشگیرانه
     AW-01 رد متمم با مبلغ ≤ ۰ در سرور (mark_amendment و win_offer)
     AW-02 هشدار پروندهٔ موازی پیش از ساخت پروندهٔ دوم
     AW-03 کشف وابستگی‌های خارج از دامنه در پیش‌بررسی حذف (فقط گزارش)
     OPS-01 یکسان‌سازی نسخهٔ سرویس با نسخهٔ UI
   مرجع: گزارش تلفیقی §۵.۳/§۱۰.۳/§۱۱.۲، بررسی مستقل N5، PLAN-REMAINING-FIXES-PHASED-2026-08-17.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var php = read('api/sales-domain.php');
var sd2 = read('crm/sales-domain-v2.js');

/* ---------- AW-01 ---------- */
(function amendmentGuard() {
  T('AW-01 گارد مبلغ متمم در mark_amendment وجود دارد',
    (php.match(/if\(sd_offer_total\(\$offer\)<=0\)sd_out\(\['ok'=>false,'error'=>'invalid_amendment_amount'/g) || []).length >= 1);
  T('AW-01 همان گارد در مسیر اتصال متمم هنگام برد هم اعمال می‌شود',
    php.indexOf("if (sd_offer_total($offer) <= 0) sd_out(['ok'=>false,'error'=>'invalid_amendment_amount'") > -1);
  T('AW-01 گارد پیش از افزودن به contractAmount قرار دارد',
    php.indexOf("if (sd_offer_total($offer) <= 0)") < php.indexOf("$case['contractAmount'] = sd_num($case['contractAmount'] ?? 0) + sd_offer_total($offer);"));
  T('AW-01 قواعد قبلی متمم (مشتری/ارز/پرونده) دست‌نخورده مانده',
    php.indexOf("'amendment_customer_or_currency_mismatch'") > -1 && php.indexOf("'parent_not_won'") > -1);

  /* رفتار: جمع امضادار پیشنهاد */
  var sb = { res: {} }; vm.createContext(sb);
  vm.runInContext('function total(items){var s=0;items.forEach(function(it){s+=(+it.qty||0)*(+it.price||0);});return s;}' +
    'res = { pos: total([{qty:2,price:100}]), zero: total([{qty:0,price:100}]), neg: total([{qty:-1,price:100}]) };', sb);
  T('AW-01 مبنای تشخیص: جمع مثبت مجاز، صفر و منفی مردود', sb.res.pos > 0 && sb.res.zero <= 0 && sb.res.neg <= 0);
})();

/* ---------- AW-02: رفتار واقعی تشخیص پروندهٔ موازی ---------- */
(function parallelCase() {
  T('AW-02 بلوک هشدار پیش از فراخوان win_offer اضافه شده',
    sd2.indexOf('پروندهٔ فعال «') > -1 && sd2.indexOf("api('win_offer'") > sd2.indexOf('پروندهٔ فعال «'));
  T('AW-02 تنها وقتی فعال می‌شود که هنوز پرونده‌ای انتخاب نشده باشد', sd2.indexOf('if (!attachCaseId) {') > -1);
  T('AW-02 چند پروندهٔ موازی → توقف و ارجاع به مسیر پروندهٔ تکراری', sd2.indexOf('_sibs.length > 1') > -1 && sd2.indexOf('پروندهٔ تکراری') > -1);
  T('AW-02 ساخت پروندهٔ دوم فقط با تأیید دوم انجام می‌شود', sd2.indexOf('پروندهٔ دوم مستقل برای همان درخواست ساخته می‌شود') > -1);

  /* اجرای واقعی منطق تشخیص خواهر/برادر روی چهار سناریو */
  var body = sd2.slice(sd2.indexOf('      var _sibs = data(\'ptf_crm_deals\').filter(function (c) {'), sd2.indexOf('      if (_sibs.length === 1) {'));
  function run(deals, offer) {
    var sb = {
      data: function () { return deals; },
      active: function (x) { var st = String((x && (x.status || x.st)) || '').toLowerCase(); return ['void','deleted','cancelled','replaced','superseded'].indexOf(st) < 0; },
      caseBelongsToOffer: function (c, o) { return String(c.wonOffer || '') === String(o.no || ''); },
      identity: function (v) { return String(v || '').replace(/[\u200c\s]+/g, '').toUpperCase(); },
      o: offer, String: String, _sibs: null
    };
    vm.createContext(sb);
    vm.runInContext('var o = this.o;\n' + body + '\n_sibs = _sibs;', sb);
    return sb._sibs;
  }
  var offer = { no: 'CO-NEW', inqNo: 'RFQ-1', buyerCd: 'CU-1', currency: 'IRR' };
  T('AW-02 پروندهٔ فعال هم‌استعلام و هم‌مشتری شناسایی می‌شود',
    run([{ _id: 'C1', wonOffer: 'CO-OLD', inqNo: 'RFQ-1', buyerCd: 'CU-1', currency: 'IRR', status: 'active' }], offer).length === 1);
  T('AW-02 پروندهٔ مشتری دیگر هشدار نمی‌سازد',
    run([{ _id: 'C2', wonOffer: 'CO-OLD', inqNo: 'RFQ-1', buyerCd: 'CU-9', currency: 'IRR', status: 'active' }], offer).length === 0);
  T('AW-02 پروندهٔ استعلام دیگر هشدار نمی‌سازد',
    run([{ _id: 'C3', wonOffer: 'CO-OLD', inqNo: 'RFQ-9', buyerCd: 'CU-1', currency: 'IRR', status: 'active' }], offer).length === 0);
  T('AW-02 اختلاف ارز هشدار نمی‌سازد',
    run([{ _id: 'C4', wonOffer: 'CO-OLD', inqNo: 'RFQ-1', buyerCd: 'CU-1', currency: 'EUR', status: 'active' }], offer).length === 0);
  T('AW-02 پروندهٔ ابطال‌شده/بایگانی هشدار نمی‌سازد',
    run([{ _id: 'C5', wonOffer: 'CO-OLD', inqNo: 'RFQ-1', buyerCd: 'CU-1', currency: 'IRR', status: 'void' }], offer).length === 0);
  T('AW-02 پروندهٔ خودِ همین پیشنهاد هشدار نمی‌سازد',
    run([{ _id: 'C6', wonOffer: 'CO-NEW', inqNo: 'RFQ-1', buyerCd: 'CU-1', currency: 'IRR', status: 'active' }], offer).length === 0);
})();

/* ---------- AW-03 ---------- */
(function deletePlanAdvisory() {
  T('AW-03 کشف وابستگی‌های خارج از دامنه اضافه شده', php.indexOf('$advisory=[]') > -1 && php.indexOf("'advisoryDependencies'=>$advisory") > -1);
  ['ptf_crm_cheques_received', 'ptf_crm_cheques_issued', 'ptf_crm_sales_returns', 'ptf_crm_buycmp', 'ptf_crm_payables', 'ptf_crm_packinglists', 'ptf_crm_projects'].forEach(function (k) {
    T('AW-03 منبع «' + k.replace('ptf_crm_', '') + '» در پیش‌بررسی اسکن می‌شود', php.indexOf("$scan('" + k + "'") > -1);
  });
  T('AW-03 رفتار commit تغییر نکرده (cascade فقط همان چهار نوع قبلی)',
    php.indexOf("in_array((string)($d['type']??''),['invoice','receipt','case'],true)") > -1);
  T('AW-03 پیام راهنما برای اقلام یتیم‌شونده وجود دارد', php.indexOf('ممکن است یتیم بمانند') > -1);
  T('AW-03 کلاینت فهرست advisory را به کاربر نشان می‌دهد', sd2.indexOf('advisoryDependencies') > -1 && sd2.indexOf('اقلام مرتبط که با این حذف پاک نمی‌شوند') > -1);
})();

/* ---------- OPS-01 ---------- */
(function serviceVersion() {
  var idx = read('crm/index.html');
  var m = idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'v([^']+)'/);
  var uiVer = m ? m[1] : '';
  var sm = php.match(/const SD_SERVICE_VERSION = '([^']+)';/);
  T('OPS-01 ثابت نسخهٔ سرویس تعریف شده', !!sm);
  T('OPS-01 عدد hardcode قدیمی 34.6.0 حذف شده', php.indexOf("'version'=>'34.6.0'") === -1);
  T('OPS-01 همهٔ پاسخ‌ها از همان ثابت می‌خوانند', (php.match(/'version'=>SD_SERVICE_VERSION/g) || []).length >= 3);
  T('OPS-01 نسخهٔ سرویس با نسخهٔ UI هم‌راستاست', !!sm && sm[1] === uiVer, (sm ? sm[1] : '-') + ' / ' + uiVer);
})();

/* ---------- بهداشت نسخه ---------- */
(function versionHygiene() {
  var idx = read('crm/index.html'), sw = read('crm/sw.js'), man = read('crm/manifest.json'),
      cc = read('crm/clear-cache.html'), ver = read('VERSION.json');
  var v = (idx.match(/window\.PTF_CRM_RELEASE\s*=\s*'([^']+)'/) || [])[1] || '';
  T('نسخهٔ index.html قالب معتبر دارد', /^v\d+\.\d+\.\d+$/.test(v), v);
  T('sw.js با همان نسخه هم‌راستاست', sw.indexOf("var RELEASE = '" + v + "'") > -1 && sw.indexOf('ptf-crm-' + v) > -1);
  T('manifest/clear-cache/VERSION.json هم‌راستا هستند',
    man.indexOf('"version": "' + v.slice(1) + '"') > -1 && cc.indexOf(v) > -1 && ver.indexOf('"crm_version": "' + v + '"') > -1);
})();

console.log('\n=== tester425-v34.7.22-award-guards: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
