/* tester75 — v15.6 (US-387: ارز در TO/TC/CO + ارز قیمت خرید + قیمت مرجع ریالی/ارزی به جای تومان) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var rq = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var ol = fs.readFileSync(path.join(BASE, 'offerlock.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نقصان ۱: انتخاب ارز در پیشنهاد مالی و فنی-مالی');
T('شرط تزریق ارز: CO و TC هر دو', op.indexOf("(_offState.kind !== 'CO' && _offState.kind !== 'TC')) return;") > -1);
T('TC بدون ofValid → لنگر جایگزین (ردیف بعد از تاریخ سند)', op.indexOf("var dt = document.getElementById('ofDateJ');") > -1 && op.indexOf("row.insertAdjacentHTML('afterend'") > -1);
T('مسیر CO با ofValid پابرجا', op.indexOf("var anchor = document.getElementById('ofValidJ');") > -1);
T('ارز در ذخیره سند ثبت می‌شود (US-182 پابرجا)', op.indexOf("_offState.currency = v;") > -1 && op.indexOf('id="ofCurrency"') > -1);

SECTION('نقصان ۲: انتخاب ارز قیمت‌های خرید (جدول مقایسه تامین)');
T('کشوی ارز بالای جدول مقایسه', rq.indexOf('💱 ارز قیمت‌ها:') > -1 && rq.indexOf('rfqsSetQuoteCur') > -1);
T('ارز روی رکورد درخواست تامین ذخیره می‌شود (quoteCur)', rq.indexOf('r.quoteCur = cur;') > -1);
T('placeholder فیلد قیمت با ارز انتخابی', rq.indexOf('placeholder="قیمت (') > -1 && rq.indexOf('r.quoteCur || \'IRR\'') > -1);
T('از PTF_CURRENCIES مشترک استفاده می‌کند (IRR/EUR/USD)', rq.indexOf('window.PTF_CURRENCIES ||') > -1);

SECTION('نقصان ۳: قیمت مرجع کالا — ریال/ارز به جای تومان');
T('فرم کالا: انتخاب ارز کنار قیمت مرجع (nPPrCur)', idx.indexOf('id="nPPrCur"') > -1 && idx.indexOf('قیمت مرجع خرید') > -1);
T('برچسب «(تومان)» از فرم کالا حذف شد', idx.indexOf('قیمت مرجع (تومان)') === -1);
T('prCur در رکورد کالا ذخیره می‌شود', idx.indexOf("prCur: (document.getElementById('nPPrCur')||{value:'IRR'}).value") > -1);
T('جدول کالاها: نمایش «ریال» یا کد ارز — نه «ت»', idx.indexOf("(p.prCur&&p.prCur!=='IRR'?p.prCur:'ریال')") > -1 && idx.indexOf(".toLocaleString('fa-IR')+' ت' : '-')") === -1);
T('راهنمای اکسل کالا: «به ریال» شد', idx.indexOf('اختیاری — به ریال؛') > -1);
T('commit جدول مقایسه → prCur روی کالا', rq.indexOf("pd.prCur = r.quoteCur || 'IRR';") > -1);
T('ثبت خودکار کالای جدید هم با prCur + ذکر ارز در منبع', rq.indexOf("prCur: r.quoteCur || 'IRR', refPriceAt") > -1 && rq.indexOf("قیمت (' + (r.quoteCur || 'IRR') + ')'") > -1);
T('مسیر پاسخ کلی US-335 هم prCur', rq.indexOf("p.prCur = r.quoteCur || p.prCur || 'IRR';") > -1);

SECTION('ماتریس سود: آگاهی از ارز مرجع');
T('ارز مرجع کنار عدد نمایش داده می‌شود', ol.indexOf("' ' + escP(refCur) + '</b>'") > -1);
T('ارز مرجع ≠ ارز سند → درصد سود محاسبه نمی‌شود (ضد گمراهی)', ol.indexOf('درصد سود بین دو ارز محاسبه نمی‌شود') > -1 && ol.indexOf('var sameCur = refCur === docCur;') > -1);
T('هشدار سود منفی فقط با ارز یکسان', ol.indexOf('var neg = sameCur && sellP > 0 && sellP < refP;') > -1);

SECTION('رفتار اجرایی');
(function () {
  global.window = global;
  global.escP = function (s) { return String(s == null ? '' : s); };
  /* شبیه‌سازی منطق ماتریس سود با ارزها */
  function refCalc(pRef, itPrice, docCur) {
    var refP = +pRef.pr || 0;
    var refCur = pRef.prCur || 'IRR';
    var sameCur = refCur === docCur;
    var sellP = +itPrice || 0;
    var mPct = (sameCur && sellP > 0) ? Math.round((sellP - refP) * 1000 / refP) / 10 : null;
    return { same: sameCur, pct: mPct, neg: sameCur && sellP > 0 && sellP < refP };
  }
  var r1 = refCalc({ pr: 100, prCur: 'EUR' }, 130, 'EUR');
  T('EUR/EUR → سود 30٪', r1.same && r1.pct === 30 && !r1.neg);
  var r2 = refCalc({ pr: 500000000, prCur: 'IRR' }, 120, 'EUR');
  T('IRR مرجع vs سند EUR → درصد محاسبه نمی‌شود (نه سود منفی کاذب)', !r2.same && r2.pct === null && !r2.neg);
  var r3 = refCalc({ pr: 1000, prCur: 'IRR' }, 900, 'IRR');
  T('IRR/IRR فروش زیر خرید → سود منفی', r3.same && r3.neg === true);
  /* commit با ارز: شبیه‌سازی ذخیره prCur */
  var mSet = rq.match(/window\.rfqsSetQuoteCur = function \(no, cur\) \{[\s\S]*?\n  \};/);
  T('rfqsSetQuoteCur استخراج شد', !!mSet);
  if (mSet) {
    global.ptfToast = function () {};
    global.rfqsRenderAccordion = function () {};
    eval(mSet[0]);
    setData('ptf_crm_rfqsmart', [{ no: 'RQ-1', items: [] }]);
    rfqsSetQuoteCur('RQ-1', 'EUR');
    T('ارز EUR روی رکورد نشست', getData('ptf_crm_rfqsmart')[0].quoteCur === 'EUR');
  }
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=15.6)', ['offers-pro.js', 'rfqsmart.js', 'offerlock.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 6));
}));

DONE('tester75-v156');
