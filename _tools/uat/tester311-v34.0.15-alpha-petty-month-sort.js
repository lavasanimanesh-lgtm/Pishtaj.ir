/* tester311 — v34.0.15-alpha (فاز ۱۲: رفع باگ نمایش هزینه‌های ماه + تأیید سورتینگ زمانی تنخواه)
   پوشش:
     ۱) هزینهٔ ماهی که فقط `month` دارد (بدون تاریخ دقیق) در بازهٔ ناقص (بدون انتخاب روز اول)
        باید نمایش داده شود — fallback ماهانه
     ۲) مرتب‌سازی زمانی صحیح (شمسی/میلادی/فقط-ماه) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var petty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v[0-9.]+-alpha$/.test(vjson.crm_version));

SECTION('کد: تفکیک «تاریخ دقیق» از «فقط ماه» در inRange');
T('inRange فقط با تاریخ دقیقِ واقعی مقایسهٔ روز می‌کند', petty.indexOf('var hasExact = !!(x.t || x.date || x.dateISO || x.iso || x.dateFa);') > -1);
T('فقط‌ماه با fallback ماهانه (ماه در بازه) نگه داشته می‌شود', petty.indexOf('return !!(m && m >= mFrom && m <= mTo);') > -1 && petty.indexOf('hasExact && d') > -1);

SECTION('رفتار: هزینهٔ فقط‌ماه در بازهٔ ناقص');
(function () {
  global.window = global;
  global.curRole = function () { return 'admin'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.faMonthNow = function () { return '1405/06'; };
  global.ptfJToISO = function (j) { return { '1405/05/20': '2026-08-09', '1405/06/01': '2026-08-21', '1405/05/01': '2026-07-21' }[j] || ''; };
  global.ptfISOToJ = function (iso) { return { '2026-08-09': '1405/05/20', '2026-08-21': '1405/06/01', '2026-07-21': '1405/05/01' }[iso] || ''; };
  global.ptfPettyBalance = function () { return { cash: 0, out: 0, advance: 0 }; };
  global.ptfPettyPendingByUser = function () { return {}; };
  setData('ptf_crm_petty', [
    { cd: 'P1', amt: 100, cat: 'اداری', t: '1405/05/20', st: 'open', by: 'الف', month: '1405/05', iso: '2026-08-09' },
    { cd: 'P2', amt: 200, cat: 'حمل', st: 'open', by: 'ب', month: '1405/05' },  // فقط ماه
    { cd: 'P3', amt: 300, cat: 'تلفن', t: '1405/06/01', st: 'open', by: 'ج', month: '1405/06', iso: '2026-08-21' }
  ]);
  setData('ptf_crm_petty_tx', []);
  eval.call(global, petty);
  var ev = window.ptfPettyPeriodEvents('1405/05/15', '1405/06/10');
  var cds = ev.map(function (e) { return e.cd; });
  T('هزینهٔ فقط‌ماه (P2) در بازهٔ بدون روز اول نمایش داده شد', cds.indexOf('P2') > -1);
  T('P1 (تاریخ دقیق 05/20) در بازه است', cds.indexOf('P1') > -1);
  T('P3 (تاریخ 06/01) در بازه است', cds.indexOf('P3') > -1);
  /* سورت: P2(ماه 05→آغاز) قبل از P1(05/20) و P3(06/01) */
  T('سورت زمانی صعودی (P2 قبل از P1 قبل از P3)', cds.indexOf('P2') < cds.indexOf('P1') && cds.indexOf('P1') < cds.indexOf('P3'));
})();

SECTION('رفتار: سورتینگ ناهمگن (شمسی/میلادی/فقط‌ماه)');
(function () {
  global.window = global;
  global.curRole = function () { return 'admin'; };
  global.faDate = function () { return '1405/06/15'; };
  global.faDateTime = function () { return '1405/06/15 10:00'; };
  global.faYear = function () { return '1405'; };
  global.faMonthNow = function () { return '1405/06'; };
  global.ptfJToISO = function (j) { return { '1405/05/10': '2026-07-30', '1405/05/20': '2026-08-09', '1405/06/01': '2026-08-21', '1405/05/01': '2026-07-21' }[j] || ''; };
  global.ptfISOToJ = function (iso) { return { '2026-07-30': '1405/05/10', '2026-08-09': '1405/05/20', '2026-08-21': '1405/06/01', '2026-07-21': '1405/05/01' }[iso] || ''; };
  global.ptfPettyBalance = function () { return { cash: 0, out: 0, advance: 0 }; };
  global.ptfPettyPendingByUser = function () { return {}; };
  setData('ptf_crm_petty', [
    { cd: 'A', amt: 1, cat: 'x', t: '1405/05/20', st: 'open', by: 'a', month: '1405/05', iso: '2026-08-09' },
    { cd: 'B', amt: 2, cat: 'y', t: '2026-07-30', st: 'open', by: 'b', month: '1405/05', iso: '2026-07-30' },
    { cd: 'C', amt: 3, cat: 'z', st: 'open', by: 'c', month: '1405/05' },
    { cd: 'D', amt: 4, cat: 'w', t: '1405/06/01', st: 'open', by: 'd', month: '1405/06', iso: '2026-08-21' }
  ]);
  setData('ptf_crm_petty_tx', []);
  eval.call(global, petty);
  var ev = window.ptfPettyPeriodEvents('1405/05/01', '1405/06/30');
  var order = ev.map(function (e) { return e.cd; });
  T('همهٔ ۴ رکورد حاضرند', ev.length === 4);
  T('سورت: C(آغاز ماه) < B(05/10) < A(05/20) < D(06/01)', order.indexOf('C') < order.indexOf('B') && order.indexOf('B') < order.indexOf('A') && order.indexOf('A') < order.indexOf('D'));
})();

DONE('tester311-v34.0.15-alpha');
