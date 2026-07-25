/* tester84 — v16.6 (US-400/401: نظام امتیازدهی مصوب + بستانکاری تامین‌کننده — ابلاغ تکمیلی کارفرما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sc = fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var sy = fs.readFileSync(path.join(BASE, 'sync.js'), 'utf-8');
var bk = fs.readFileSync(path.join(BASE, 'backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v16.6+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=16.6;})());
T('کش sw >= v16.6 + scoring در SHELL', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=16.6;})() && sw.indexOf("'./scoring.js'") > -1);
T('scoring.js در index.html (>= 16.6)', (function(){var m=idx.match(/scoring\.js\?v=([0-9.]+)/);return m&&parseFloat(m[1])>=16.6;})());
T('ptf_crm_payables در سینک و بک‌آپ', sy.indexOf("'ptf_crm_payables'") > -1 && bk.indexOf("'ptf_crm_payables'") > -1);
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust فایل‌های تغییریافته >= 16.6', ['buycompare.js', 'rfqsmart.js', 'sync.js', 'backup.js'].every(function (f) { return vOf(f) >= 16.6; }));
})();

SECTION('مصوبات کارفرما (کد)');
T('② رویداد تحویل: یک کلیک اختیاری (ok/issue) در بستانکاری', sc.indexOf('window.ptfPayableDlv') > -1 && sc.indexOf("p.dlv === 'ok'") > -1 && sc.indexOf('اختیاری و یک‌کلیکی') > -1);
T('③ هشدار بدحسابی هنگام CO: hook روی ptfRenderCreditBox موجود (US-352)', sc.indexOf('window.ptfRenderCreditBox = function (custCd)') > -1 && sc.indexOf('هشدار سابقه وصول') > -1 && sc.indexOf('r.payRatio < 0.6') > -1);
T('④ سطح‌بندی مصوب: 🥇🥈🥉⚠️ و 💎🌟🔵⚪', sc.indexOf("'ممتاز'") > -1 && sc.indexOf("'تاییدشده'") > -1 && sc.indexOf("'کلیدی'") > -1 && sc.indexOf("'راکد/جدید'") > -1);
T('⑤ گزارش فقط درخواستی مدیر (نه دائمی)', sc.indexOf('window.ptfScoreReport') > -1 && sc.indexOf('فقط با درخواست مدیر') > -1);
T('① وزن‌های مصوب پیش‌فرض (sup: 20/20/20/15/15/10 — cust: 30/25/20/15/10)', sc.indexOf('resp: 20, price: 20, hist: 20, spec: 15, dlv: 15, reg: 10') > -1 && sc.indexOf('pay: 30, vol: 25, conv: 20, loyal: 15, inter: 10') > -1);
T('وزن‌ها در تنظیمات: نمایش همه، ویرایش فقط ارشد + audit', sc.indexOf('ptfScoreWeightsSave') > -1 && sc.indexOf("audit('امتیازدهی', 'تغییر وزن‌های") > -1);
T('تعدیل دستی ±۱۵ فقط ارشد با دلیل + audit', sc.indexOf('Math.max(-15, Math.min(15') > -1 && sc.indexOf('تعدیل دستی فقط توسط مدیران ارشد') > -1);
T('داده ناکافی ≠ امتیاز صفر (برچسب جدا)', sc.indexOf("'داده ناکافی'") > -1 && sc.indexOf('dataOk') > -1);
T('RBAC: تامین‌کننده=buyPrice/ارشد، مشتری=finance', sc.indexOf('function canSeeSup()') > -1 && sc.indexOf('(roleDef() || {}).finance') > -1);

SECTION('ابلاغ تکمیلی: بستانکاری تامین‌کننده (کد)');
T('cmpBuy: فیلد نحوه پرداخت نقدی/غیرنقدی (تامین‌کننده per آیتم از قبل مشخص است)', bc.indexOf("id: 'pay', label: 'نحوه پرداخت به تامین‌کننده'") > -1 && bc.indexOf('نقدی (همین لحظه تسویه') > -1);
T('ثبت خرید → ptfPayableUpsert با مبلغ×تعداد و ارز/نرخ', bc.indexOf('ptfPayableUpsert === ') > -1 && bc.indexOf('amount: buyPrice * (+(c2.items[idx] || {}).qty || 1)') > -1);
T('purchases: فیلد pay پابرجا (v17.2: price=IRR قطعی + srcCur/priceFx)', bc.indexOf("pay: v.pay || 'cash'") > -1 && bc.indexOf("cur: 'IRR', srcCur:") > -1);
T('نقدی = تسویه همان لحظه (paid خودکار + settled)', sc.indexOf("note: 'تسویه نقدی هنگام خرید', auto: true") > -1);
T('غیرنقدی = پرداخت مرحله‌ای (ptfPayablePay + paid[])', sc.indexOf('window.ptfPayablePay') > -1 && sc.indexOf('p2.paid.push({ amt: amt') > -1);
T('رویت لحظه‌ای مدیران: باکس بدهی بالای ماژول تامین‌کنندگان', sc.indexOf('بدهی غیرنقدی به تامین‌کنندگان') > -1 && sc.indexOf('window.buildSuppliers = function () { return payablesBoxHtml()') > -1);
T('بدهی غیرنقدی = امتیاز/ضریب بالاتر (creditBonus + بونوس تامین‌یاب)', sc.indexOf('ضریب اعتباردهی (خرید غیرنقدی)') > -1 && sc.indexOf('window.ptfSupScoreBonus') > -1);
T('rfqsmart: بونوس امتیاز وندور در پیشنهادگر', rq.indexOf('ptfSupScoreBonus(s)') > -1 && rq.indexOf('sb.bonus') > -1);
T('اعلان بستانکاری غیرنقدی به مدیران ارشد', sc.indexOf("kind: 'payable'") > -1);
T('ارزی بی‌نرخ در بدهی شفاف (بی‌نرخ جدا نمایش)', sc.indexOf('(بی‌نرخ)') > -1 && sc.indexOf('function remainIrr(p)') > -1);

SECTION('رفتاری: چرخه بستانکاری نقدی/غیرنقدی');
global.window = global;
loadFns('dedup.js', ['dedupNorm']);
global.curSession = function () { return { user: 'admin', name: 'مدیر' }; };
global.genCode = function (p) { return p + '-' + (++global._sq2 || (global._sq2 = 1)); };
global.audit = function () {};
global._notifs = [];
global.notify = function (n) { global._notifs.push(n); };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
(function () {
  function ex(name, re) {
    var m = sc.match(re);
    if (!m) { T(name + ' استخراج شد', false); return false; }
    var code = m[0];
    if (name.indexOf('window.') === 0) {
      code = code.replace(name, 'global.' + name.replace('window.', ''));
    } else {
      /* «function xxx» → global.xxx = function */
      var fn = name.replace('function ', '');
      code = code.replace('function ' + fn, 'global.' + fn + ' = function');
    }
    eval(code);
    return true;
  }
  var ok = true;
  ok = ex('function norm', /function norm\(s\) \{[\s\S]*?\n  \}/) && ok;
  ok = ex('function fmtT', /function fmtT\(v\) \{[\s\S]*?\n  \}/) && ok;
  global.pAll = function () { return getData('ptf_crm_payables'); };
  global.pSave = function (l) { setData('ptf_crm_payables', l); };
  ok = ex('window.ptfPayableRemain', /window\.ptfPayableRemain = function[\s\S]*?\n  \};/) && ok;
  ok = ex('function remainIrr', /function remainIrr\(p\) \{[\s\S]*?\n  \}/) && ok;
  ok = ex('window.ptfPayableUpsert', /window\.ptfPayableUpsert = function[\s\S]*?\n    return rec;\n  \};/) && ok;
  ok = ex('window.ptfSupplierDebts', /window\.ptfSupplierDebts = function[\s\S]*?\n  \};/) && ok;
  T('توابع بستانکاری استخراج شدند', ok);
  if (!ok) return;
  setData('ptf_crm_payables', []);
  /* خرید نقدی → صفر همان لحظه */
  var r1 = ptfPayableUpsert({ inqNo: 'INQ-1', idx: 0, item: 'ولو', sup: 'پارس ولو', amount: 5000000, cur: 'IRR', rate: 0, pay: 'cash' });
  T('نقدی: settled=true و paid=کل مبلغ', r1.settled === true && ptfPayableRemain(r1) === 0);
  T('نقدی: در بدهی مدیران نمی‌آید', ptfSupplierDebts().length === 0);
  /* خرید غیرنقدی → بدهی باز */
  var r2 = ptfPayableUpsert({ inqNo: 'INQ-1', idx: 1, item: 'ترانسمیتر', sup: 'آریا کنترل', amount: 20000000, cur: 'IRR', rate: 0, pay: 'credit' });
  T('غیرنقدی: باز با مانده کامل', r2.settled === false && ptfPayableRemain(r2) === 20000000);
  T('اعلان به مدیران ارشد رفت', global._notifs.length === 1 && global._notifs[0].kind === 'payable');
  var d = ptfSupplierDebts();
  T('نمای مدیران: بدهی آریا کنترل ۲۰م', d.length === 1 && d[0].sup === 'آریا کنترل' && d[0].irr === 20000000);
  /* پرداخت مرحله‌ای */
  var list = pAll();
  var p2 = list.filter(function (x) { return x.cd === r2.cd; })[0];
  p2.paid.push({ amt: 8000000, t: '1405/04/20', by: 'مدیر' });
  p2.settled = ptfPayableRemain(p2) <= 0;
  pSave(list);
  d = ptfSupplierDebts();
  T('پرداخت مرحله ۱: مانده ۱۲م', d[0].irr === 12000000 && p2.settled === false);
  p2 = pAll().filter(function (x) { return x.cd === r2.cd; })[0];
  p2.paid.push({ amt: 12000000, t: '1405/04/25', by: 'مدیر' });
  p2.settled = ptfPayableRemain(p2) <= 0;
  pSave(pAll().map(function (x) { return x.cd === p2.cd ? p2 : x; }));
  T('تسویه کامل: از بدهی مدیران خارج شد', ptfSupplierDebts().length === 0 && p2.settled === true);
  /* ارزی بی‌نرخ */
  ptfPayableUpsert({ inqNo: 'INQ-2', idx: 0, item: 'پمپ', sup: 'یورو تجهیز', amount: 3000, cur: 'EUR', rate: 0, pay: 'credit' });
  d = ptfSupplierDebts();
  T('ارزی بی‌نرخ: در fx جدا (نه ریال کاذب)', d.length === 1 && d[0].irr === 0 && d[0].fx.EUR === 3000);
  /* ثبت مجدد خرید همان قلم = جایگزینی (پرداخت‌ها حفظ) */
  var r4 = ptfPayableUpsert({ inqNo: 'INQ-1', idx: 1, item: 'ترانسمیتر', sup: 'آریا کنترل', amount: 22000000, cur: 'IRR', rate: 0, pay: 'credit' });
  T('ثبت مجدد قلم: cd قبلی + پرداخت‌های قبلی حفظ + مبلغ جدید', r4.cd === r2.cd && r4.paid.length === 2 && r4.amount === 22000000 && ptfPayableRemain(r4) === 2000000);
})();

SECTION('رفتاری: موتور امتیاز تامین‌کننده (وزن‌های مصوب)');
(function () {
  global.localStorage.setItem('ptf_crm_settings', '{}');
  global.roleDef = function () { return { buyPrice: true, finance: true }; };
  global.isSenior = function () { return true; };
  var mW = sc.match(/var DEF_W = \{[\s\S]*?\n  \};/);
  var mWf = sc.match(/function weights\(\) \{[\s\S]*?\n  \}/);
  var mAdj = sc.match(/function adjOf\(kind, cd\) \{[\s\S]*?\n  \}/);
  var mS = sc.match(/window\.ptfSupplierScore = function[\s\S]*?creditBonus: creditBonus \};\n  \};/);
  T('موتور تامین‌کننده استخراج شد', !!mW && !!mWf && !!mAdj && !!mS);
  if (!(mW && mWf && mAdj && mS)) return;
  eval(mW[0].replace('var DEF_W', 'global.DEF_W'));
  eval(mWf[0].replace('function weights', 'global.weights = function'));
  eval(mAdj[0].replace('function adjOf', 'global.adjOf = function'));
  eval(mS[0].replace('window.ptfSupplierScore', 'global.ptfSupplierScore'));
  /* داده: استعلام‌ها + جدول مقایسه + بستانکاری */
  setData('ptf_crm_rfqsmart', [
    { no: 'R1', targets: [{ cd: 'SUP-1', co: 'آریا کنترل', st: 'replied' }, { cd: 'SUP-2', co: 'کند پاسخ', st: 'pending' }] },
    { no: 'R2', targets: [{ cd: 'SUP-1', co: 'آریا کنترل', st: 'replied' }] }
  ]);
  setData('ptf_crm_buycmp', [{
    id: 'C1', inqNo: 'INQ-1', items: [{ nm: 'ولو', qty: 1 }],
    quotes: [{ sup: 'آریا کنترل', idx: 0, price: 100, round: 1 }, { sup: 'کند پاسخ', idx: 0, price: 150, round: 1 }],
    purchases: [{ idx: 0, sup: 'آریا کنترل', price: 100, cur: 'IRR', rate: 0, pay: 'credit' }]
  }]);
  setData('ptf_crm_payables', [{ cd: 'PAY-9', sup: 'آریا کنترل', inqNo: 'INQ-1', idx: 0, item: 'ولو', amount: 100, cur: 'IRR', pay: 'credit', paid: [], dlv: 'ok' }]);
  var sup = { cd: 'SUP-1', co: 'آریا کنترل', spBrands: ['Siemens', 'WIKA'], spEquip: ['ولو'], natId: '14010', ph: '0912', coWeb: 'x.com', origin: 'داخلی' };
  var r = ptfSupplierScore(sup);
  T('امتیاز ساخته شد با دلیل ۶ معیاره + ضریب اعتباردهی', r.dataOk === true && r.parts.length >= 5 && r.parts.some(function (p) { return p.k === 'ضریب اعتباردهی (خرید غیرنقدی)'; }));
  T('پاسخگویی ۱۰۰٪ = وزن کامل ۲۰', r.parts.filter(function (p) { return p.k === 'پاسخگویی استعلام'; })[0].v === 20);
  T('ارزان‌ترین در مقایسه = رقابت کامل ۲۰', r.parts.filter(function (p) { return p.k === 'رقابتی بودن قیمت'; })[0].v === 20);
  T('تحویل ok = کیفیت کامل ۱۵', r.parts.filter(function (p) { return p.k === 'کیفیت تحویل'; })[0].v === 15);
  T('امتیاز بالا → سطح ممتاز/تاییدشده', r.score >= 60 && (r.icon === '🥇' || r.icon === '🥈'));
  var rEmpty = ptfSupplierScore({ cd: 'SUP-X', co: 'تازه' });
  T('تامین‌کننده بدون تراکنش = «داده ناکافی» نه صفر', rEmpty.dataOk === false && rEmpty.lb === 'داده ناکافی');
  /* تعدیل دستی از settings */
  global.localStorage.setItem('ptf_crm_settings', JSON.stringify({ scoreAdj: { sup: { 'SUP-1': { adj: -10, why: 'تست', by: 'مدیر', t: 'x' } } } }));
  var rAdj = ptfSupplierScore(sup);
  T('تعدیل دستی −۱۰ اعمال و علامت‌گذاری شد', rAdj.score === Math.max(0, r.score - 10) && !!rAdj.adj);
  global.localStorage.setItem('ptf_crm_settings', '{}');
  /* بونوس تامین‌یاب */
  var mB = sc.match(/window\.ptfSupScoreBonus = function[\s\S]*?\n  \};/);
  if (mB) {
    eval(mB[0].replace('window.ptfSupScoreBonus', 'global.ptfSupScoreBonus'));
    var b = ptfSupScoreBonus(sup);
    T('بونوس تامین‌یاب برای وندور خوش‌امتیاز + اعتباردهنده', b.bonus > 0 && b.why.indexOf('امتیاز وندور') > -1);
    T('وندور بی‌داده بونوس نمی‌گیرد', ptfSupScoreBonus({ cd: 'SUP-X', co: 'تازه' }).bonus === 0);
  }
})();

SECTION('رفتاری: موتور امتیاز مشتری + هشدار بدحسابی');
(function () {
  var mC = sc.match(/window\.ptfCustomerScore = function[\s\S]*?payRatio: payPart \? payPart\.ratio : null \};\n  \};/);
  T('موتور مشتری استخراج شد', !!mC);
  if (!mC) return;
  eval(mC[0].replace('window.ptfCustomerScore', 'global.ptfCustomerScore'));
  setData('ptf_crm_customers', [
    { cd: 'CU-1', co: 'فولاد مبارکه', ind: 'فولاد', people: [{ nm: 'x' }, { nm: 'y' }], natId: '10101' },
    { cd: 'CU-2', co: 'بدحساب', people: [{ nm: 'z' }] }
  ]);
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', co: 'فولاد مبارکه' }, { cd: 'RFQ-2', co: 'فولاد مبارکه' }, { cd: 'RFQ-3', co: 'بدحساب' }]);
  setData('ptf_crm_offers', [
    { no: 'CO-1', kind: 'CO', buyerCd: 'CU-1', buyerCo: 'فولاد مبارکه', st: 'won', dateEn: '2026-06-01', items: [{ qty: 2, price: 50000000 }] },
    { no: 'CO-2', kind: 'CO', buyerCd: 'CU-2', buyerCo: 'بدحساب', st: 'won', dateEn: '2026-05-01', items: [{ qty: 1, price: 80000000 }] }
  ]);
  setData('ptf_crm_invoices', [
    { cd: 'INV-1', offerNo: 'CO-1', amount: 100000000, payments: [{ amt: 100000000 }] },
    { cd: 'INV-2', offerNo: 'CO-2', amount: 80000000, payments: [{ amt: 10000000 }] }
  ]);
  var g = ptfCustomerScore(getData('ptf_crm_customers')[0]);
  var b = ptfCustomerScore(getData('ptf_crm_customers')[1]);
  T('مشتری خوش‌حساب: وصول ۱۰۰٪ = وزن کامل ۳۰', g.parts.filter(function (p) { return p.k === 'خوش‌حسابی'; })[0].v === 30 && g.payRatio === 1);
  T('مشتری بدحساب: payRatio=0.125 → زیر آستانه هشدار 0.6', Math.abs(b.payRatio - 0.125) < 0.001 && b.payRatio < 0.6);
  T('امتیاز خوش‌حساب > بدحساب', g.score > b.score);
  T('سطح‌بندی مصوب اعمال شد', ['💎', '🌟', '🔵', '⚪'].indexOf(g.icon) > -1);
  var rNew = ptfCustomerScore({ cd: 'CU-9', co: 'جدید', people: [] });
  T('مشتری بدون تراکنش = «راکد/جدید»', rNew.dataOk === false && rNew.lb === 'راکد/جدید');
})();

SECTION('رگرسیون');
T('cmpBuy: مسیر ارزی — v17.2/US-412: تسعیر الزامی جایگزین confirm', bc.indexOf('بدون «نرخ تسعیر» ثبت نمی‌شود (US-412)') > -1);
T('ptfRealBuyOpen/Status (v16.3) دست‌نخورده', bc.indexOf('window.ptfRealBuyOpen = function (inqNo)') > -1 && bc.indexOf('window.ptfRealBuyStatus = function (inqNo)') > -1);
T('buyquotes قدیمی همچنان پر می‌شود (گزارش‌های موجود)', bc.indexOf("bq.unshift({ cd: genCode('BQ')") > -1);
T('امتیاز تخصصی US-399 در rfqsmart پابرجا', rq.indexOf('ptfSupSpecScore(s, items)') > -1);
T('زنجیره hook buildSuppliers (bridge سایت → scoring باکس بدهی)', sc.indexOf('_bSup()') > -1);
T('ptfRenderCreditBox اصلی (US-352 سقف اعتبار) صدا زده می‌شود', sc.indexOf('_cb(custCd);') > -1);
T('scoring بعد از supspec لود می‌شود (وابستگی بونوس)', idx.indexOf('scoring.js') > idx.indexOf('supspec.js'));
T('گارد سینک GUARD_KEYS دست‌نخورده', sy.indexOf("var GUARD_KEYS = ['ptf_crm_customers'") > -1);

DONE('tester84-v166');
