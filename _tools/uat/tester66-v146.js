/* tester66 — v14.6 (اسپرینت «سود و مهلت‌ها» از نقشه راه مصوب: US-347/348/352) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-347: حاشیه سود در فرم CO (قیمت خرید مرجع)');
T('کش کاتالوگ فقط برای نقش‌های buyPrice', ol.indexOf('(roleDef() || {}).buyPrice) _prodsRef = getData(\'ptf_crm_products\')') > -1);
/* v15.2 (US-385): تطبیق exact به «pcode → exact → نرمال‌شده» ارتقا یافت */
T('تطبیق کالا با resolver یکتا (کد/نام/مدل/مشخصات)', ol.indexOf('ptfResolveProcurementLine(it, _prodsRef)') > -1 && ol.indexOf('مرجع خرید مبهم است؛ انتخاب خودکار نشد') > -1);
T('نمایش قیمت مرجع + تاریخ US-335', ol.indexOf('مرجع خرید:') > -1 && ol.indexOf('pRef.refPriceAt') > -1);
T('محاسبه درصد سود ردیف', ol.indexOf('Math.round((sellP - refP) * 1000 / refP) / 10') > -1);
T('هشدار سود منفی', ol.indexOf('⚠️ <b>سود منفی!</b>') > -1);
T('بدون قیمت فروش → دعوت به ورود', ol.indexOf('قیمت فروش را وارد کنید') > -1);
T('نقش بدون buyPrice هیچ قیمت خریدی نمی‌بیند (شرط دور کش)', /if \(isCO && typeof roleDef === 'function' && \(roleDef\(\) \|\| \{\}\)\.buyPrice\)/.test(ol));

SECTION('US-348: مهلت پاسخ درخواست');
T('فیلد مهلت در فرم ثبت درخواست', (br.indexOf('id="nR2Due"') > -1 || br.indexOf('id="nR2DueJ"') > -1) && br.indexOf('مهلت پاسخ به کارفرما') > -1);
T('dueISO روی رکورد ذخیره می‌شود', br.indexOf("dueISO: (typeof ptfJToISO") > -1 || br.indexOf("dueISO: ((document.getElementById('nR2Due')") > -1);
T('فیلد مهلت در ویرایش درخواست', (br.indexOf('id="er_due"') > -1 || br.indexOf('id="er_due_j"') > -1));
T('تغییر مهلت → ریست ضدتکرار اعلان', br.indexOf('rfqs[i].dueNotified = \'\'') > -1);
T('تابع وضعیت مهلت ptfRfqDueState', br.indexOf('window.ptfRfqDueState = function (r)') > -1);
T('درخواست بسته/پاسخ‌داده مشمول هشدار نیست (v17.3: + st8/st9)', br.indexOf("['st4', 'st5', 'st8', 'st9', 'st6', 'st7', 'stX'].indexOf(r.st || '') > -1") > -1);
T('پنجره هشدار ۲ روز قبل', br.indexOf('2 * 86400000') > -1);
T('ردیف فهرست: بج + پس‌زمینه (v17.3: rowBg با اولویت برد/باخت — مهلت حفظ)', br.indexOf('dueBadge') > -1 && br.indexOf("due && due.bg ? due.bg : ''") > -1);
T('یادآور خودکار checkRfqDue در polling', br.indexOf('function checkRfqDue()') > -1 && br.indexOf('if (checkRfqDue()) newMsg = true;') > -1);
T('ضدتکرار روزانه per درخواست', br.indexOf('r.dueNotified === today') > -1);
T('اعلان به مسئول رسیدگی؛ بدون مسئول → نقش‌های فروش', br.indexOf('r.assignee && r.assignee.user ? [r.assignee.user] : []') > -1);

SECTION('US-348: رفتار اجرایی ptfRfqDueState');
var mDue = br.match(/window\.ptfRfqDueState = function[\s\S]*?\n  \};/);
T('تابع استخراج شد', !!mDue);
if (mDue) {
  global.todayISO = function () { return '2026-07-08'; };
  eval(mDue[0]);
  T('مهلت گذشته → قرمز over', (function(){ var d = ptfRfqDueState({ dueISO: '2026-07-01', st: 'st1' }); return d && d.over === true && d.cl === '#dc2626'; })());
  T('مهلت امروز → قرمز', (function(){ var d = ptfRfqDueState({ dueISO: '2026-07-08', st: 'st1' }); return d && d.cl === '#dc2626' && !d.over; })());
  T('۲ روز مانده → نارنجی', (function(){ var d = ptfRfqDueState({ dueISO: '2026-07-09', st: 'st1' }); return d && d.cl === '#d97706'; })());
  T('مهلت دور → خنثی (بدون bg)', (function(){ var d = ptfRfqDueState({ dueISO: '2026-08-01', st: 'st1' }); return d && !d.bg; })());
  T('درخواست تحویل‌شده → null', ptfRfqDueState({ dueISO: '2026-07-01', st: 'st7' }) === null);
  T('بدون مهلت → null', ptfRfqDueState({ st: 'st1' }) === null);
}

SECTION('US-352: سقف اعتبار و مانده باز مشتری');
T('فیلد سقف اعتبار در فرم مشتری (فقط sellPrice)', of.indexOf('id="nC2Credit"') > -1 && of.indexOf("(roleDef() || {}).sellPrice) ? '<div class=\"fr\"><div class=\"fld\"><label>💳") > -1);
T('creditLimit ذخیره می‌شود (v19.6: با ptfNum کامادار)', of.indexOf("creditLimit: (typeof ptfNum === 'function' ? ptfNum((document.getElementById('nC2Credit')") > -1);
T('ویرایش بدون فیلد → مقدار قبلی حفظ', of.indexOf('if (!document.getElementById(\'nC2Credit\')) rec.creditLimit = items[i].creditLimit || 0;') > -1);
T('تابع مانده باز ptfCustOpenBalance', of.indexOf('window.ptfCustOpenBalance = function (custCd)') > -1);
T('مانده = فاکتور − وصولی روی COهای مشتری', of.indexOf('Math.max(0, (+inv.amount || 0) - paid)') > -1);
T('باکس مانده/سقف زیر انتخاب کارفرما', of.indexOf('id="ofCreditBox"') > -1 && of.indexOf('window.ptfRenderCreditBox = function (custCd)') > -1);
T('باکس در offerPickBuyer صدا زده می‌شود', of.indexOf('try { ptfRenderCreditBox(cd); } catch (eCB) {}') > -1);
T('فقط CO/TC و نقش sellPrice', of.indexOf("(_offState.kind !== 'CO' && _offState.kind !== 'TC')) { box.innerHTML = ''; return; }") > -1);
T('هشدار عبور از سقف هنگام ذخیره (مانده + مبلغ جدید)', of.indexOf('_bal.open + _newTotal > +c.creditLimit') > -1 && of.indexOf('هشدار سقف اعتبار مشتری (US-352)') > -1);
T('عبور با تایید → ثبت در audit', of.indexOf('با عبور از سقف اعتبار مشتری') > -1);

SECTION('US-352: رفتار اجرایی مانده باز');
var mBal = of.match(/window\.ptfCustOpenBalance = function[\s\S]*?\n\};/);
T('تابع استخراج شد', !!mBal);
if (mBal) {
  eval(mBal[0]);
  setData('ptf_crm_offers', [
    { no: 'CO-1', kind: 'CO', buyerCd: 'CUST-1' },
    { no: 'CO-2', kind: 'CO', buyerCd: 'CUST-1' },
    { no: 'CO-9', kind: 'CO', buyerCd: 'CUST-2' }
  ]);
  setData('ptf_crm_invoices', [
    { offerNo: 'CO-1', amount: 1000, payments: [{ amt: 400 }] },  /* مانده 600 */
    { offerNo: 'CO-2', amount: 500, payments: [] },               /* مانده 500 */
    { offerNo: 'CO-9', amount: 900, payments: [{ amt: 900 }] }    /* تسویه — مشتری دیگر */
  ]);
  var b1 = ptfCustOpenBalance('CUST-1');
  T('مانده CUST-1 = 1100 از ۲ فاکتور', b1.open === 1100 && b1.cnt === 2);
  var b2 = ptfCustOpenBalance('CUST-2');
  T('فاکتور تسویه‌شده → مانده صفر', b2.open === 0 && b2.cnt === 0);
  T('مشتری بدون سابقه → صفر', ptfCustOpenBalance('CUST-X').open === 0);
}

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — فقط «همان یا جدیدتر از 14.6» */
T('cache-bust فایل‌های اسپرینت (>=14.6)', ['offers.js', 'bridge.js', 'offerlock.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 6));
}));

DONE('tester66-v146');
