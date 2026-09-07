#!/usr/bin/env node
'use strict';
/* =============================================================================
   tester612-v34.38.5-shareholder-salary-official.js
   گزارش کارفرما: «تب کیفیت داده حقوق سهامدار را بدون نوع رسمی/غیررسمی نشان می‌دهد،
   ولی ویرایش سهامدار گزینه‌ای برای تعیین رسمی/غیررسمی ندارد.»

   ریشه: ردیف‌های هزینهٔ حقوق سهامدار (shareholderSalary) سرور isOfficial را اصلاً
   نمی‌نوشتند (دومین منبع OPEX ناقص در کنار ptfOpexApplyTpl) → در کیفیت داده
   «هزینه جاری بدون تعیین نوع رسمی/غیررسمی» می‌ماند؛ و ویرایش سهامدار هم فیلدی
   برای تعیین نوع سند نداشت.

   قرارداد قفل‌شده در v34.38.6:
     ① ویرایش/ثبت سهامدار فیلد «نوع سند حقوق» (رسمی/غیررسمی/تعیین‌نشده → salaryOfficial).
     ② سرور register_shareholder_salary و reconcile_shareholder_salaries نوع سند را
        به ردیف هزینهٔ حقوق (isOfficial) انتشار می‌دهند — فقط وقتی صریح باشد.
     ③ راهنمای کیفیت داده برای ردیف‌های حقوق سهامدار، تب سهامداران را هم می‌گوید.
   ============================================================================= */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function head(s) { console.log('\n── ' + s + ' ──'); }

var shares = read('crm/shareholders.js');
var php = read('api/sales-domain.php');
var dq = read('crm/data-quality.js');
var idx = read('crm/index.html');
var gate = read('_tools/uat/run-ci-gate.js');

/* ───────────────────── ۱) سهامداران: فیلد نوع سند حقوق ───────────────────── */
head('۱. ویرایش سهامدار — فیلد نوع سند حقوق');
var editFn = shares.indexOf('window.ptfShareEdit = function');
T('۱.۰ ptfShareEdit پیدا شد', editFn > -1);
T('۱.۱ فیلد salaryOfficial با برچسب «نوع سند حقوق» در فرم هست',
  /id: 'salaryOfficial', label: 'نوع سند حقوق'/.test(shares));
T('۱.۲ سه گزینه تعیین‌نشده/رسمی/غیررسمی',
  shares.indexOf("v: '', lb: 'تعیین نشده'") > -1 &&
  shares.indexOf("v: 'yes', lb: 'رسمی / قابل قبول ممیز'") > -1 &&
  shares.indexOf("v: 'no', lb: 'غیررسمی'") > -1);
T('۱.۳ نگاشت روی رکورد: رسمی→true، غیررسمی→false، تعیین‌نشده→حذف کلید',
  /var salaryOfficial = v\.salaryOfficial === 'yes' \? true : \(v\.salaryOfficial === 'no' \? false : undefined\);/.test(shares) &&
  /if \(salaryOfficial === undefined\) delete rec\.salaryOfficial; else rec\.salaryOfficial = salaryOfficial;/.test(shares));
T('۱.۴ audit تغییر نوع سند را هم ثبت می‌کند', shares.indexOf('نوع سند حقوق: ') > -1);

/* ───────────────────── ۲) سرور: انتشار isOfficial به هزینه حقوق ───────────────────── */
head('۲. سرور — isOfficial روی ردیف هزینهٔ حقوق');
T('۲.۰ register_shareholder_salary نوع سند را از پروفایل سهامدار می‌خواند',
  php.indexOf("array_key_exists('salaryOfficial',$shareholder)") > -1);
T('۲.۱ reconcile_shareholder_salaries نوع سند را از پروفایل می‌خواند',
  php.indexOf("array_key_exists('salaryOfficial',$sh)") > -1);
T('۲.۲ ردیف تازهٔ هزینهٔ حقوق (register) فقط در حالت صریح isOfficial می‌گیرد',
  (function () {
    var i = php.indexOf("$opexSalaryRow=['cd'=>$oxCd,'_opexRowId'=>$rowId,'cat'=>'حقوق و دستمزد'");
    var j = php.indexOf('$projectionRows=[$opex[count($opex)-1]]', i);
    var seg = i > -1 && j > i ? php.slice(i, j) : '';
    return seg.indexOf("if($salaryOfficialVal!==null)$opexSalaryRow['isOfficial']=$salaryOfficialVal;") > -1 &&
      seg.indexOf('$opex[]=$opexSalaryRow;') > -1;
  })());
T('۲.۳ ردیف تازهٔ هزینهٔ حقوق (reconcile create) isOfficial صریح می‌گیرد',
  (function () {
    var i = php.indexOf("$opexSalaryRow=['cd'=>$oxCd,'_opexRowId'=>$rowId,'cat'=>'حقوق و دستمزد','amt'=>$salary,'month'=>$month,'desc'=>'حقوق موظف سهامدار: '.(string)($sh['name']??$shCd)");
    var j = php.indexOf('$oxIndex=count($opex)-1;$created++;', i);
    var seg = i > -1 && j > i ? php.slice(i, j + 40) : '';
    return seg.indexOf("if($salaryOfficialVal!==null)$opexSalaryRow['isOfficial']=$salaryOfficialVal;") > -1;
  })());
T('۲.۴ ردیف موجود هزینهٔ حقوق (reconcile update) isOfficial را به‌روز می‌کند',
  php.indexOf("if($salaryOfficialVal!==null)$opex[$oxIndex]['isOfficial']=$salaryOfficialVal;if($restoreOx){") > -1);
T('۲.۵ الگوی «تعیین‌نشده = ننوشتن isOfficial» در هر دو مسیر',
  /if\(array_key_exists\('salaryOfficial',\$shareholder\)&&\$shareholder\['salaryOfficial'\]!==null&&\$shareholder\['salaryOfficial'\]!==''\)\{\$salaryOfficialVal=!empty\(\$shareholder\['salaryOfficial'\]\);\}/.test(php) &&
  /if\(array_key_exists\('salaryOfficial',\$sh\)&&\$sh\['salaryOfficial'\]!==null&&\$sh\['salaryOfficial'\]!==''\)\{\$salaryOfficialVal=!empty\(\$sh\['salaryOfficial'\]\);\}/.test(php));

/* ───────────────────── ۳) کیفیت داده: راهنمای حقوق سهامدار ───────────────────── */
head('۳. کیفیت داده — ردیف حقوق سهامدار راهنمای درست دارد');
T('۳.۰ ردیف حقوق سهامدار جدا علامت‌خورده است',
  dq.indexOf("shareholderSalary: !!(o.shareholderSalary || String(o.recurringKey || '').indexOf('salary:') === 0)") > -1);
T('۳.۱ راهنما هر دو مسیر اصلاح (تب سهامداران + فرم هزینه) را می‌گوید',
  dq.indexOf("این هزینه «حقوق موظف سهامدار» است") > -1 &&
  dq.indexOf('تب سهامداران (ویرایش سهامدار → نوع سند حقوق)') > -1);

/* ───────────────────── ۴) رفتاری: onOk سهامدار ───────────────────── */
head('۴. رفتاری — onOk نوع سند حقوق را درست ذخیره می‌کند');
var reg = shares.indexOf('window.ptfShareRegisterSalary = function');
var editSrc = shares.slice(editFn, reg);
T('۴.۰ برش ptfShareEdit تا ptfShareRegisterSalary', editFn > -1 && reg > editFn);

function runEdit(oldRec, values) {
  var captured = { fields: null, saved: null, reconcile: null, audited: [] };
  var list = oldRec ? [JSON.parse(JSON.stringify(oldRec))] : [];
  var ctx = {
    window: {},
    canShare: function () { return true; },
    alert: function () {},
    shAll: function () { return list; },
    ptfDialog: function (opt) {
      captured.fields = opt.fields;
      opt.onOk(values);
    },
    n: function (v) { return parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0; },
    pctSum: function () { return 0; },
    normMonth: function () { return '1405/06'; },
    faMonthNow: function () { return '1405/06'; },
    shareYearLocked: function () { return false; },
    genCode: function () { return 'SHR-1'; },
    nm: function () { return 'کاربر'; },
    faDateTime: function () { return '1405/06/16'; },
    shSave: function (a) { captured.saved = JSON.parse(JSON.stringify(a)); list = a; },
    audit: function (m, a, ref) { captured.audited.push({ m: m, a: a, ref: ref }); },
    ptfShareRender: function () {},
    reconcileSalaryOnServer: function (month, opts) { captured.reconcile = { month: month, opts: opts }; return { then: function (cb) { if (cb) cb({ state: 'acked' }); return { then: function () {} }; } }; },
    ptfToast: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(editSrc + '\nwindow.ptfShareEdit(typeof cdArg === "undefined" ? null : cdArg);', ctx, { filename: 'sh612.js' });
  var savedRec = captured.saved ? captured.saved.filter(function (x) { return x.cd === 'SHR-1'; })[0] : null;
  return { ctx: ctx, captured: captured, rec: savedRec };
}

(function () {
  var r = runEdit(null, { name: 'فلانی', pct: '25', duty: 'yes', salary: '200000000', salaryOfficial: 'yes', active: 'yes' });
  T('۴.۱ رسمی → salaryOfficial:true روی رکورد تازه', r.rec && r.rec.salaryOfficial === true, JSON.stringify(r.rec));
  T('۴.۲ تطبیق سرور با scopeShareholder صدا خورده', r.captured.reconcile && r.captured.reconcile.opts.scopeShareholder === 'SHR-1', JSON.stringify(r.captured.reconcile));
})();
(function () {
  var r = runEdit(null, { name: 'فلانی', pct: '25', duty: 'yes', salary: '200000000', salaryOfficial: 'no', active: 'yes' });
  T('۴.۳ غیررسمی → salaryOfficial:false روی رکورد تازه', r.rec && r.rec.salaryOfficial === false, JSON.stringify(r.rec));
})();
(function () {
  var r = runEdit(null, { name: 'فلانی', pct: '25', duty: 'yes', salary: '200000000', salaryOfficial: '', active: 'yes' });
  T('۴.۴ تعیین‌نشده → کلید salaryOfficial نوشته نمی‌شود',
    r.rec && !Object.prototype.hasOwnProperty.call(r.rec, 'salaryOfficial'), JSON.stringify(r.rec));
})();
(function () {
  var oldRec = { cd: 'SHR-1', name: 'قدیم', pct: 25, duty: true, salary: 1000000, active: true, salaryOfficial: true };
  var r = runEdit(oldRec, { name: 'قدیم', pct: '25', duty: 'yes', salary: '200000000', salaryOfficial: '', active: 'yes' });
  T('۴.۵ ویرایش به تعیین‌نشده → isOfficial قبلی حذف می‌شود',
    r.rec && !Object.prototype.hasOwnProperty.call(r.rec, 'salaryOfficial'), JSON.stringify(r.rec));
})();
(function () {
  var r = runEdit(null, { name: 'فلانی', pct: '25', duty: 'yes', salary: '200000000', salaryOfficial: 'yes', active: 'yes' });
  T('۴.۶ audit نوع سند حقوق را هم می‌نویسد',
    r.captured.audited.length === 1 && r.captured.audited[0].a.indexOf('نوع سند حقوق: رسمی') > -1,
    JSON.stringify(r.captured.audited));
})();

/* ───────────────────── ۵) گیت / نسخه ───────────────────── */
head('۵. گیت و نسخه');
var ver = JSON.parse(read('VERSION.json'));
T('۵.۱ VERSION.json = v34.38.6', ver.crm_version === 'v34.38.6', ver.crm_version);
T('۵.۲ tester612 در run-ci-gate.js ثبت است', gate.indexOf('tester612-v34.38.5-shareholder-salary-official.js') > -1);
T('۵.۳ قرارداد UI/sw = 34.38.6',
  /window\.PTF_CRM_RELEASE = 'v34\.38\.6'/.test(idx) &&
  /CACHE = 'ptf-crm-v34\.38\.6'/.test(read('crm/sw.js')));
T('۵.۴ SD_SERVICE_VERSION = 34.38.6', /SD_SERVICE_VERSION = '34\.38\.6'/.test(php));

console.log('\n— tester612 (DATA-QUALITY SH-SALARY: نوع سند حقوق سهامدار از تب سهامداران تعیین و به هزینه انتشار می‌یابد) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
