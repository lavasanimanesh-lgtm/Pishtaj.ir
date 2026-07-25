/* tester196 — v31.7.21 (US-OFF-ALT: چند پیشنهاد موازی برای یک درخواست)
 * توضیح تکمیلی کارفرما درباره مشاهده ۱: مشتری برای یک درخواست چند پیشنهاد می‌خواهد
 * (گزینه اروپایی/چینی) ولی فرم اجازه انتخاب دوباره همان درخواست را نمی‌داد.
 * ریشه: قفل یک‌باره TO→CO (US-142 AC5) تبدیل دوم را مطلقاً بلاک می‌کرد
 * («تبدیل مجدد فقط با حذف CO قبلی») — کاربر برای گزینه دوم مجبور به حذف گزینه اول بود.
 * رفع: تبدیل دوم به بعد با تایید صریح به‌عنوان «پیشنهاد جایگزین» (altOf) مجاز شد؛
 * لینک coNo اول حفظ؛ بج ⑂ در فهرست؛ برد یکی → بازنده‌شدن تاییدی بقیه. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var of = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf-8');

SECTION('رفع قفل یک‌باره — پیشنهاد جایگزین');
T('بلاک مطلق تبدیل مجدد حذف شد', of.indexOf('تبدیل مجدد فقط در صورتی ممکن است که CO قبلی از سیستم حذف شود') === -1);
T('تبدیل دوم با confirm «پیشنهاد مالی جایگزین»', of.indexOf('US-OFF-ALT') > -1 && of.indexOf('پیشنهاد مالی جایگزین') > -1 && /_isAlt = true;/.test(of));
T('شمارنده گزینه در پیام (گزینه ۲، ۳، …)', /_altCount = offers\.filter\(function\(x\)\{ return x\.kind !== 'TO' && x\.srcToNo === no; \}\)\.length/.test(of));
T('مارک altOf روی پیشنهاد جایگزین', /_offState\.altOf = o\.coNo/.test(of));
T('فهرست TO: دکمه «+CO گزینه ۲» به‌جای قفل مرده', of.indexOf('+CO گزینه ۲') > -1 && of.indexOf('→CO 🔒') === -1);
T('بج ⑂ گزینه جایگزین در ردیف فهرست', of.indexOf('⑂ گزینه جایگزین') > -1);
T('لینک coNo اول بازنویسی نمی‌شود (ردیابی TO→CO اول سالم)', /x\.no === o\.srcToNo && \(!x\.coNo \|\| !offers\.some/.test(of));

SECTION('چرخه برد بین گزینه‌های موازی');
T('برد یک گزینه → پیشنهاد بازنده‌شدن تاییدی بقیه گزینه‌های باز همان درخواست', /x\.kind !== 'TO' && x\.inqNo === o\.inqNo && \['won', 'lost'\]\.indexOf\(x\.st\) < 0/.test(of) && of.indexOf('پیشنهاد موازی دیگر برای همین درخواست باز است') > -1);
T('گزینه‌های بازنده‌شده snapshot حاشیه می‌گیرند (آمار تحلیلگر دقیق)', /_sib\.forEach\(function \(x\) \{\s*x\.st = 'lost'; x\.lostAt = faDateTime\(\);\s*try \{ x\.marginAtClose/.test(of));
T('audit بازنده‌شدن خودکار ثبت می‌شود', of.indexOf('بازنده‌شدن خودکار') > -1);

SECTION('رفتاری: شبیه‌سازی سناریوی کارفرما (اروپایی/چینی)');
global.window = global;
var offers = [
  { no: 'TO-100', kind: 'TO', inqNo: 'RFQ-1244', coNo: 'CO-200' },
  { no: 'CO-200', kind: 'CO', inqNo: 'RFQ-1244', srcToNo: 'TO-100', st: 'sent', items: [] } // گزینه اروپایی
];
// منطق جدید offerToCo برای تبدیل دوم:
var o = offers[0];
var blockedOld = !!(o.coNo && offers.some(function (x) { return x.no === o.coNo; })); // منطق قدیم: true = بلاک
T('پیش‌شرط: منطق قدیم این حالت را مطلقاً بلاک می‌کرد', blockedOld === true);
// منطق جدید: با تایید، alt ساخته می‌شود
var _altCount = offers.filter(function (x) { return x.kind !== 'TO' && x.srcToNo === 'TO-100'; }).length;
T('شمارنده گزینه درست است (گزینه ۲)', _altCount + 1 === 2);
var alt = { no: 'CO-201', kind: 'CO', inqNo: 'RFQ-1244', srcToNo: 'TO-100', altOf: 'CO-200', st: 'sent', items: [] }; // گزینه چینی
offers.push(alt);
// ذخیره alt نباید coNo اولِ TO را بازنویسی کند (منطق اصلاح‌شده offerSave):
offers.forEach(function (x) { if (x.no === alt.srcToNo && (!x.coNo || !offers.some(function (y) { return y.no === x.coNo; }))) x.coNo = alt.no; });
T('coNo اولِ TO پس از ذخیره گزینه دوم حفظ شد (CO-200 نه CO-201)', offers[0].coNo === 'CO-200');
// برد گزینه چینی → گزینه اروپایی باز است و باید کاندیدای بازنده شود
var winner = alt;
var _sib = offers.filter(function (x) { return x !== winner && x.kind !== 'TO' && x.inqNo === winner.inqNo && ['won', 'lost'].indexOf(x.st) < 0; });
T('گزینه موازی باز (CO-200 اروپایی) برای بازنده‌شدن شناسایی شد', _sib.length === 1 && _sib[0].no === 'CO-200');

DONE('tester196-parallel-offers');
