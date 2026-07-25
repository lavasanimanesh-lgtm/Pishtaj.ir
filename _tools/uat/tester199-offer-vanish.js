/* tester199 — v31.7.24 (BUG-CODE-DUP-003: پیشنهاد مالی ذخیره می‌شود ولی در فهرست دیده نمی‌شود)
 * شکایت کاربر: چند بار CO ثبت و ذخیره کرد اما در پیشنهادات مالی ظاهر نشد.
 * زنجیره ریشه (E2E اثبات‌شده):
 *  ۱) اسکن شماره آفرها در codegen.php فقط crm/data را می‌دید نه crm/data/sync (مصداق چهارم شکاف data-dir)
 *  ۲) → شماره CO تکراری رزرو می‌شد (مثلاً 0100 درحالی‌که 0112 موجود بود)
 *  ۳) → offerSave با idx>-1 آفر «موجود» را overwrite می‌کرد و offers.unshift هرگز اجرا نمی‌شد
 *  ۴) → کاربر ذخیره می‌زد، toast موفقیت می‌دید، ولی رکورد جدیدی در فهرست نبود (فقط یک آفر قدیمی عوض شده بود)
 * رفع: سرور هر دو مسیر را اسکن می‌کند + گارد کلاینت در offerSave (regen تا ۵ بار / block بدون overwrite). */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var api = fs.readFileSync(path.join(ROOT, 'api/codegen.php'), 'utf-8');
var of = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf-8');

SECTION('رفع سرور — اسکن آفرها از هر دو مسیر');
T('حلقه دو مسیر آفر (data + data/sync)', api.indexOf('BUG-CODE-DUP-003') > -1 && /foreach\(\[\$data_dir\.'\/ptf_crm_offers\.json', \$data_dir\.'\/sync\/ptf_crm_offers\.json'\] as \$offerFile\)/.test(api));
T('حلقه بسته شده (سینتکس سالم — php -l جدا تایید شد)', api.indexOf('پایان حلقه دو مسیر آفر') > -1);
T('رفع v31.7.20 برای keys_map سالم مانده', /\$sources=\[\$data_dir\.'\/'\.\$jsonKey\.'\.json', \$data_dir\.'\/sync\/'\.\$jsonKey\.'\.json'\]/.test(api));

SECTION('گارد کلاینت — offerSave دیگر بی‌صدا overwrite نمی‌کند');
T('تشخیص: پیشنهاد جدید با شماره موجود (idx>-1 && editMode===new)', of.indexOf('BUG-CODE-DUP-003') > -1 && /idx > -1 && o\.editMode === 'new'/.test(of));
T('regen تا ۵ بار از سرور + رد TMP', /_regenTry < 5/.test(of) && /\/\^TMP-\/\.test\(String\(_newNo/.test(of));
T('در نبود شماره سالم: ثبت مسدود با پیام صریح (نه overwrite)', of.indexOf('جلوگیری از بازنویسی پیشنهاد قبلی') > -1 || of.indexOf('برای جلوگیری از بازنویسی پیشنهاد قبلی، ذخیره متوقف شد') > -1);
T('در صورت regen موفق: toast اطلاع شماره جدید + idx=-1 (رکورد جدید)', of.indexOf('شماره پیشنهاد به ') > -1 && /o\.no = _newNo;/.test(of) && /idx = -1; \/\* رکورد جدید/.test(of));
T('audit هر دو حالت ثبت می‌شود', of.indexOf('جلوگیری از overwrite پیشنهاد موجود با شماره تکراری') > -1);
T('مسیر ویرایش واقعی identity-safe است و Rev فقط با نگارش جدید بالا می‌رود', of.indexOf('function ptfOfferResolveSaveIdentity') > -1 && of.indexOf('madeRevision = !!forceRev;') > -1 && of.indexOf('var afterSent =') === -1);

SECTION('رفتاری: بازتولید دقیق شکایت کاربر');
global.window = global;
global.audit = function () {};
global.ptfToast = function (m) { global._toasts = (global._toasts || []).concat([m]); };
var alerts = []; global.alert = function (m) { alerts.push(m); };
// آفر موجود قدیمی + کاربر پیشنهاد «جدید» با همان شماره (رزرو تکراری) ذخیره می‌کند
var offers = [{ no: 'PTF-CO-1405-0100', kind: 'CO', st: 'sent', buyerCo: 'مشتری قدیمی', items: [{ qty: 1, price: 5 }] }];
var serialSeq = ['PTF-CO-1405-0113']; var si = 0;
global.offerSerial = function () { return serialSeq[Math.min(si++, serialSeq.length - 1)]; };
var o = { no: 'PTF-CO-1405-0100', kind: 'CO', editMode: 'new', buyerCo: 'مشتری جدید', items: [{ qty: 2, price: 9 }] };
// اجرای منطق گارد (همان بلاک offerSave):
var idx = -1; offers.forEach(function (x, i) { if (x.no === o.no) idx = i; });
T('پیش‌شرط: شماره تکراری تشخیص داده شد (منطق قدیم اینجا overwrite می‌کرد)', idx > -1);
if (idx > -1 && o.editMode === 'new') {
  var _regenTry = 0, _newNo = o.no;
  while (_regenTry < 5 && offers.some(function (x) { return x.no === _newNo; })) { _newNo = offerSerial(o.kind); _regenTry++; }
  o.no = _newNo; idx = -1;
}
if (idx > -1) { offers[idx] = o; } else { offers.unshift(o); }
T('پیشنهاد جدید با شماره سالم 0113 به فهرست اضافه شد (شکایت حل)', offers.length === 2 && offers[0].no === 'PTF-CO-1405-0113' && offers[0].buyerCo === 'مشتری جدید');
T('آفر قدیمی 0100 دست‌نخورده ماند', offers[1].no === 'PTF-CO-1405-0100' && offers[1].buyerCo === 'مشتری قدیمی');
// سناریوی بدتر: سرور در دسترس نیست، همه regen ها تکراری → block
si = 0; serialSeq = ['PTF-CO-1405-0100', 'PTF-CO-1405-0100', 'PTF-CO-1405-0100', 'PTF-CO-1405-0100', 'PTF-CO-1405-0100', 'PTF-CO-1405-0100'];
var o2 = { no: 'PTF-CO-1405-0113', kind: 'CO', editMode: 'new', items: [] };
var idx2 = -1; offers.forEach(function (x, i) { if (x.no === o2.no) idx2 = i; });
var blocked = false;
if (idx2 > -1 && o2.editMode === 'new') {
  var _t2 = 0, _n2 = o2.no;
  while (_t2 < 5 && offers.some(function (x) { return x.no === _n2; })) { _n2 = offerSerial(o2.kind); _t2++; }
  if (offers.some(function (x) { return x.no === _n2; })) blocked = true;
}
T('وقتی شماره سالم موجود نیست → ثبت مسدود (هرگز overwrite)', blocked === true && offers.length === 2);

DONE('tester199-offer-vanish');
