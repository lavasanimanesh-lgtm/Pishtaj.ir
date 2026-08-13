/* tester95 — v17.7 (US-418 — کیس R9 فاز ۱: هزینه‌های جاری شرکت + تکرارشونده ماهانه) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ox = fs.readFileSync(path.join(BASE, 'opex.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.7+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.7;})());
T('کش sw >= v17.7 + opex در SHELL', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.7;})() && sw.indexOf("'./opex.js'") > -1);
T('opex.js در index بعد از petty', idx.indexOf('opex.js?v=') > idx.indexOf('petty.js?v='));
T('ptf_crm_opex در سینک + سپر داده‌صفر + بک‌آپ', sy.indexOf("'ptf_crm_opex'") > -1 && sy.indexOf("'ptf_crm_payables'") > -1 && bk.indexOf("'ptf_crm_opex'") > -1);

SECTION('US-418 (کد)');
T('دسته‌های مصوب پنل R9 (۸ دسته شامل اجاره/حقوق/بیمه/مالیات/پورسانت بیرونی)', ox.indexOf("'اجاره‌بها', 'حقوق و دستمزد', 'بیمه', 'مالیات', 'پذیرایی و اداری', 'پورسانت بیرونی'") > -1);
T('RBAC: فقط finance', ox.indexOf('(roleDef() || {}).finance') > -1 && ox.indexOf('فقط برای نقش‌های مالی') > -1);
T('ماه شمسی + نرمال‌سازی ارقام فارسی', ox.indexOf('function normMonth(m)') > -1 && ox.indexOf('۰۱۲۳۴۵۶۷۸۹') > -1);
T('تکرارشونده: قالب در settings.opexTpl + پیشنهاد ماهانه با confirm (بدون ثبت خودکار)', ox.indexOf('st.opexTpl = list;') > -1 && ox.indexOf('window.ptfOpexPendingTpls') > -1 && ox.indexOf('ptfOpexApplyTpl') > -1 && ox.indexOf('if (!confirm(') > -1);
T('جمع per ماه/سال/دسته (مصرف US-420 آینده)', ox.indexOf('window.ptfOpexSum = function (monthOrYear)') > -1 && ox.indexOf('out.byCat[x.cat]') > -1);
T('hook پنل تنخواه (تنخواه = زیرمجموعه هزینه‌ها) — بدون شکستن petty', ox.indexOf('window._opexHooked') > -1 && ox.indexOf('return box + _bp();') > -1);
T('audit روی ثبت/حذف/قالب', (ox.match(/audit\('هزینه جاری'/g) || []).length >= 4);

SECTION('رفتاری: ثبت، جمع‌ها، تکرارشونده');
global.window = global;
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.roleDef = function () { return { finance: true }; };
global.genCode = function (p) { return p + '-' + (++global._sq8 || (global._sq8 = 1)); };
global.faDate = function () { return '1405/04/27'; };
global.audit = function () {};
global.ptfToast = function () {};
(function () {
  function ex(name, re) {
    var m = ox.match(re);
    if (!m) return false;
    var code = m[0];
    if (name.indexOf('window.') === 0) code = code.replace(name, 'global.' + name.replace('window.', ''));
    else { var fn = name.replace('function ', ''); code = code.replace('function ' + fn, 'global.' + fn + ' = function'); }
    eval(code);
    return true;
  }
  var ok = true;
  global.oAll = function () { return getData('ptf_crm_opex'); };
  global.oSave = function (l) { setData('ptf_crm_opex', l); };
  global.canFin = function () { return true; };
  global.fmtT = function (v) { return (+v || 0).toLocaleString('fa-IR'); };
  ok = ex('window.ptfFaMonthNow', /window\.ptfFaMonthNow = function[\s\S]*?\n  \};/) && ok;
  ok = ex('function normMonth', /function normMonth\(m\) \{[\s\S]*?\n  \}/) && ok;
  ok = ex('window.ptfOpexSum', /window\.ptfOpexSum = function[\s\S]*?\n    return out;\n  \};/) && ok;
  ok = ex('function tpls', /function tpls\(\) \{[\s\S]*?\n  \}/) && ok;
  ok = ex('function saveTpls', /function saveTpls\(list\) \{[\s\S]*?\n  \}/) && ok;
  ok = ex('window.ptfOpexPendingTpls', /window\.ptfOpexPendingTpls = function[\s\S]*?\n  \};/) && ok;
  ok = ex('window.ptfOpexApplyTpl', /window\.ptfOpexApplyTpl = function[\s\S]*?\n  \};/) && ok;
  T('توابع استخراج شدند', ok);
  if (!ok) return;

  T('normMonth: 1405/4 → 1405/04 + ارقام فارسی', normMonth('1405/4') === '1405/04' && normMonth('۱۴۰۵/۰۴') === '1405/04' && normMonth('bad') === '');

  setData('ptf_crm_opex', []);
  global.localStorage.setItem('ptf_crm_settings', '{}');
  /* ثبت مستقیم دو هزینه دو ماه */
  oSave([
    { cd: 'OPX-a', cat: 'اجاره‌بها', amt: 50000000, month: '1405/04', t: 'x', by: 'م' },
    { cd: 'OPX-b', cat: 'پذیرایی و اداری', amt: 3000000, month: '1405/04', t: 'x', by: 'م' },
    { cd: 'OPX-c', cat: 'اجاره‌بها', amt: 50000000, month: '1405/03', t: 'x', by: 'م' }
  ]);
  var sm = ptfOpexSum('1405/04');
  T('جمع ماه: ۵۳م (دو قلم)', sm.total === 53000000 && sm.byCat['اجاره‌بها'] === 50000000);
  var syr = ptfOpexSum('1405');
  T('جمع سال: ۱۰۳م (سه قلم)', syr.total === 103000000);
  T('جمع بدون فیلتر = کل', ptfOpexSum('').total === 103000000);

  /* قالب تکرارشونده: pending فقط وقتی ماه جاری ثبت نشده */
  saveTpls([{ id: 'TPL-1', cat: 'اجاره‌بها', amt: 50000000, desc: 'دفتر مرکزی' }]);
  var nowM = ptfFaMonthNow();
  var pend = ptfOpexPendingTpls(nowM);
  T('قالب بدون ثبت ماه جاری → pending', pend.length === 1 && pend[0].id === 'TPL-1');
  /* اعمال قالب با confirm=true */
  global.confirm = function () { return true; };
  global.ptfOpexRender = function () {};
  ptfOpexApplyTpl('TPL-1');
  var all = getData('ptf_crm_opex');
  T('اعمال قالب: هزینه ماه جاری با tplId ثبت شد', all.some(function (x) { return x.tplId === 'TPL-1' && x.month === nowM; }));
  T('پس از ثبت، دیگر pending نیست', ptfOpexPendingTpls(nowM).length === 0);
  /* template قدیمی: Cancel = غیررسمی و انتخاب در خود template ماندگار می‌شود */
  saveTpls(tpls().concat([{ id: 'TPL-2', cat: 'بیمه', amt: 9000000 }]));
  var confirmCalls = 0;
  global.confirm = function () { return ++confirmCalls === 1; };
  var before = getData('ptf_crm_opex').length;
  ptfOpexApplyTpl('TPL-2');
  var after = getData('ptf_crm_opex');
  var legacyTpl = tpls().filter(function (x) { return x.id === 'TPL-2'; })[0];
  T('قالب قدیمی: Cancel آن را غیررسمی ثبت و ذخیره می‌کند', after.length === before + 1 && after[0].isOfficial === false && legacyTpl.isOfficial === false);
})();

SECTION('رگرسیون');
T('petty.js دست‌نخورده (تنخواه US-171)', fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8').indexOf('window.buildPetty = function') > -1);
T('opex فقط باکس بالای تنخواه اضافه می‌کند (box + _bp())', ox.indexOf("'<div id=\"opexBox\"") > -1);
T('GUARD_KEYS قبلی سر جایشان', ['ptf_crm_smsbook','ptf_crm_payables','ptf_crm_opex'].every(function(k){ return sy.indexOf("'" + k + "'") > -1; }));
T('کلیدهای بک‌آپ قبلی حفظ', ['ptf_crm_payables','ptf_crm_opex','ptf_crm_cheques'].every(function(k){ return bk.indexOf("'" + k + "'") > -1; }));

DONE('tester95-v177');
