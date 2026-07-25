/* tester63 — v14.3 (اسپرینت ب «جریان فروش و تامین روان»: US-367/373/365/374 + ثبت US-380) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var wf = fs.readFileSync(path.join(BASE, 'workflow.js'), 'utf-8');
var rs = fs.readFileSync(path.join(BASE, 'rfqsmart.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var procurementLink = fs.readFileSync(path.join(BASE, 'procurement-link.js'), 'utf-8');
try { eval(procurementLink); } catch (eProc) { console.error(eProc); }

SECTION('US-367: پیشنهاد فنی ۶ وضعیتی (نسخه نهایی کارفرما)');
T('نگاشت ST_TO با ۶ وضعیت', of.indexOf("var ST_TO = { draft:") > -1 && of.indexOf("registered: '📋 ثبت‌شده'") > -1 && of.indexOf("approved: '✅ تاییدشده'") > -1 && of.indexOf("rejected: '⛔ عدم تایید'") > -1 && of.indexOf("revise: '✏️ درخواست اصلاح'") > -1);
T('TO هرگز برنده/قفل نیست', of.indexOf("var isWon = !isTO && o.st === 'won'") > -1);
T('مهاجرت نرم won→approved / lost→rejected', of.indexOf('function toStMigrate(o)') > -1 && of.indexOf("if (o.st === 'won') return 'approved'") > -1 && of.indexOf("if (o.st === 'lost') return 'rejected'") > -1);
T('ذخیره TO: پیش‌نویس → ثبت‌شده', of.indexOf("if (o.kind === 'TO' && (!o.st || o.st === 'draft')) o.st = 'registered';") > -1);
T('عدم تایید = confirm بستن مسیر مالی (بدون قفل)', of.indexOf("st === 'rejected' && !confirm") > -1 && of.indexOf('به مرحله پیشنهاد مالی نمی‌رسد') > -1);
T('offerToCo: سد فقط برای عدم تایید', of.indexOf("o.kind === 'TO' && (o.st === 'rejected' || (o.st === 'lost'))") > -1);
T('تبدیل →CO در هر وضعیت دیگر آزاد', of.indexOf('در هر مرحله‌ای مجاز (US-367)') > -1);
T('بج ⛔ روی TO عدم تایید', of.indexOf("toStMigrate(o) === 'rejected'") > -1 && of.indexOf('→CO ⛔') > -1);
T('سینک tst برای گردش کار', of.indexOf("o.tst = st === 'approved' ? 'approved'") > -1);
T('wfToResponse: st شش‌وضعیتی سینک می‌شود', wf.indexOf("if (v.resp === 'approved') o2.st = 'approved';") > -1 && wf.indexOf("else if (v.resp === 'rejected') o2.st = 'rejected';") > -1);
T('wfCompute هر دو st/tst را می‌فهمد', wf.indexOf("lastTo.tst === 'rejected' || lastTo.st === 'rejected'") > -1);
T('wfRefresh بعد از تغییر وضعیت TO', of.indexOf("wfRefresh(o.inqNo, 'وضعیت TO: ' + st)") > -1);
T('قفل برنده CO/TC پابرجا (رگرسیون US-141)', of.indexOf('وضعیت برنده قفل است و قابل بازگشت نیست') > -1);

SECTION('US-367: رفتار اجرایی با داده واقعی');
global.ptfSetOffState = function (v) { global._offState = v; return v; };
loadFns('offers.js', ['offerToCo']);
global._lastAlert = '';
global.alert = function (m) { global._lastAlert = String(m); };
global.offerSerial = function (k) { return 'PTF-' + k + '-1405-777'; };
global.offerForm = function () { global._formOpened = true; };
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
setData('ptf_crm_offers', [{ no: 'PTF-TO-1405-201', kind: 'TO', st: 'rejected', items: [{ qty: 1 }], terms: [] }]);
offerToCo('PTF-TO-1405-201');
T('TO عدم تایید → تبدیل مسدود با پیام', String(global._lastAlert).indexOf('عدم تایید') > -1);
global._lastAlert = ''; global._formOpened = false;
setData('ptf_crm_offers', [{ no: 'PTF-TO-1405-202', kind: 'TO', st: 'registered', items: [{ qty: 1 }], terms: [] }]);
offerToCo('PTF-TO-1405-202');
T('TO ثبت‌شده (قبل از ارسال) → تبدیل آزاد', global._formOpened === true && !global._lastAlert);
global._formOpened = false;
setData('ptf_crm_offers', [{ no: 'PTF-TO-1405-203', kind: 'TO', st: 'draft', items: [{ qty: 1 }], terms: [] }]);
offerToCo('PTF-TO-1405-203');
T('TO حتی پیش‌نویس → تبدیل آزاد (هر مرحله)', global._formOpened === true && !global._lastAlert);

SECTION('US-373: جدول مقایسه قیمت خرید');
/* v15.6: چک به «بدنه خود تابع» محدود شد — درج توابع جدید بین بلوک‌ها آن را نمی‌شکند */
T('oninput دیگر rerender نمی‌کند (پرش فوکوس رفع)', (function () {
  var m = rs.match(/rfqsUpdatePriceCompare = function\(no, idx, supCd, val\) \{[\s\S]*?\n  \};/);
  return m && m[0].indexOf('_rfqsCmpDirty = no;') > -1 && m[0].indexOf('rfqsRenderAccordion(') === -1;
})());
T('رنگ‌بندی به blur موکول شد', rs.indexOf('window.rfqsPriceBlur = function(no)') > -1 && rs.indexOf('onblur="rfqsPriceBlur(') > -1);
T('blur هوشمند: فوکوس داخل جدول → رندر نمی‌کند', rs.indexOf("getAttribute('data-rqsprice') === no") > -1);
T('دکمه «💾 ثبت قیمت‌ها» زیر جدول', rs.indexOf('rfqsCommitPrices(') > -1 && rs.indexOf('💾 ثبت قیمت‌ها') > -1);
T('ثبت → قیمت مرجع کالا per-item (میانگین)', rs.indexOf('window.rfqsCommitPrices = function(no)') > -1 && rs.indexOf("refPriceSrc = 'جدول مقایسه '") > -1);
T('مهر زمان/شخص ثبت', rs.indexOf('pricesCommittedAt') > -1 && rs.indexOf('pricesCommittedBy') > -1);
T('ذخیره لحظه‌ای حین تایپ (ضد از دست رفتن با رفرش)', rs.indexOf('داده لحظه‌ای ذخیره') > -1);
T('مسیر قدیمی ptfUpdateRefPrices (پاسخ کلی) پابرجا', rs.indexOf('try { ptfUpdateRefPrices(r); } catch (e) {}') > -1);

SECTION('US-373: رفتار اجرایی ثبت قیمت‌ها');
// اجرای دستی rfqsCommitPrices از سورس
var mAll = rs.match(/window\.rfqsCommitPrices = function\(no\) \{[\s\S]*?\n  \};/);
T('تابع rfqsCommitPrices استخراج شد', !!mAll);
if (mAll) {
  global.faDate = function () { return '1405/04/16'; };
  global.faDateTime = function () { return '1405/04/16 12:00'; };
  global.ptfToast = function () {};
  global.rfqsRenderAccordion = function () {};
  global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
  eval(mAll[0]);
  setData('ptf_crm_products', [{ cd: 'PTF-P-1', nm: 'Soft Starter 250KW', pr: 0 }]);
  setData('ptf_crm_rfqsmart', [{ no: 'SQ-9', items: [{ name: 'Soft Starter 250KW', qty: 2, quotes: { S1: 1000, S2: 2000 } }], targets: [] }]);
  rfqsCommitPrices('SQ-9');
  var pAfter = getData('ptf_crm_products')[0];
  T('قیمت مرجع = میانگین قیمت‌های جدول (1500)', pAfter.pr === 1500);
  T('تاریخ و منبع مرجع ثبت شد', pAfter.refPriceAt === '1405/04/16' && String(pAfter.refPriceSrc).indexOf('جدول مقایسه') > -1);
  T('مهر ثبت روی رکورد استعلام', getData('ptf_crm_rfqsmart')[0].pricesCommittedAt === '1405/04/16 12:00');
}

SECTION('US-365: تغییرنام ثبت درخواست');
T('دکمه فهرست: «+ ثبت درخواست جدید»', br.indexOf('+ ثبت درخواست جدید') > -1 && br.indexOf('+ ثبت RFQ جدید') === -1);
T('هدر مودال اصلاح شد', br.indexOf('➕ ثبت درخواست جدید') > -1 && br.indexOf('➕ ثبت RFQ جدید') === -1);
T('audit هماهنگ شد', br.indexOf("'ثبت درخواست جدید برای '") > -1);

SECTION('US-374: انتخاب نوع پیش‌نویس دستیار');
T('انتخاب‌گر aiTP_kind با ۳ نوع', ai.indexOf('id="aiTP_kind"') > -1 && ai.indexOf('🔧 فنی (TO)') > -1 && ai.indexOf('🤝 فنی-مالی (TC)') > -1 && ai.indexOf('💰 مالی (CO)') > -1);
T('RBAC: بدون sellPrice فقط TO', ai.indexOf("!(roleDef()||{}).sellPrice) qKind='TO'") > -1 && ai.indexOf("(roleDef()||{}).sellPrice) ? '<option value=\"TC\"") > -1);
T('شماره سند با kind انتخابی و generator مرکزی', ai.indexOf("var qNo=(typeof offerSerial === 'function' ? offerSerial(qKind) : genCode(qKind));") > -1);
T('kind روی رکورد پیشنهاد', ai.indexOf('kind:qKind') > -1);
T('پیام نتیجه نوع سند را می‌گوید', ai.indexOf("out.quoteKind==='CO'?'پیشنهاد مالی (CO)'") > -1);
T('پیش‌فرض TO (مسیر قبلی نمی‌شکند)', ai.indexOf(".value||'TO'") > -1);

SECTION('نسخه و کش');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
/* قاعده تسترها: قفل نکردن نسخه دقیق — فقط «همان یا جدیدتر از 14.3» */
T('cache-bust فایل‌های اسپرینت ب (>=14.3)', ['rfqsmart.js', 'workflow.js', 'ai-workbench.js', 'bridge.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 14 || (+m[1] === 14 && +m[2] >= 3));
}));

DONE('tester63-v143');
