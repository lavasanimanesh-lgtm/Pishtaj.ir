/* tester109 — v19.3 (اسپرینت ۴ از R12: US-435 قفل ارجاع فاکتور تا تحویل کارفرما + US-436 صدور فاکتور رسمی حسابدار) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.3+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.3; })());
T('کش sw >= v19.3', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.3; })());
T('cache-bust salesfiles/rbac >= 19.3', (function () { var a = idx.match(/salesfiles\.js\?v=([0-9.]+)/), b = idx.match(/rbac\.js\?v=([0-9.]+)/); return a && b && parseFloat(a[1]) >= 19.3 && parseFloat(b[1]) >= 19.3; })());

SECTION('US-435 — ساختار کد: قفل ارجاع فاکتور');
T('هسته قابل تست sfInvoiceRefCommit با خروجی {ok, why}', sf.indexOf('window.sfInvoiceRefCommit') > -1 && sf.indexOf("return { ok: false, why: 'stage'") > -1);
T('قفل سه‌لایه: نقش ارشد + پرونده برنده + مرحله >= ۷', sf.indexOf('!isSenior()') > -1 && sf.indexOf('if (stg < 7)') > -1 && sf.indexOf("why: 'nofile'") > -1);
T('ضد تکرار: ارجاع مجدد رد می‌شود', sf.indexOf("if (o.invRef) return { ok: false, why: 'already' };") > -1);
T('AC3: سند ضمیمه = snapshot قطعی برد (sfAwardEnsure + awardDoc در invRef)', sf.indexOf('sfAwardEnsure === \'function\') sfAwardEnsure(r);') > -1 && sf.indexOf('fromFile: r.cd, awardDoc: r.wonOffer') > -1);
T('notify فقط حسابدار + پیامک اختیاری (الگوی US-150)', sf.indexOf("toRoles: ['accountant']") > -1 && sf.indexOf('پیامک اطلاع‌رسانی هم برای حسابدار ارسال شود؟') > -1);
T('timeline + audit ارجاع در پرونده', sf.indexOf('ارجاع فاکتور رسمی به حسابدار (پس از تحویل کارفرما — US-435)') > -1);
T('دکمه در کشو: باز پس از مرحله ۷، قفل 🔒 قبل از آن، بج پس از ارجاع', sf.indexOf('🧾 ارجاع فاکتور به حسابدار</button>') > -1 && sf.indexOf('🧾 ارجاع فاکتور 🔒') > -1 && sf.indexOf('🧾 ارجاع شد — در حال صدور فاکتور') > -1);
T('پیام قفل شفاف با مرحله فعلی', sf.indexOf('تا قبل از ثبت «🤝 تحویل کارفرما» در همین پرونده') > -1);

SECTION('US-436 — ساختار کد: صدور فاکتور رسمی حسابدار');
T('مودال کامل: شماره + تاریخ + مبلغ + ارزش افزوده + PDF (AC2)', rb.indexOf("id=\"nInvVat\"") > -1 && rb.indexOf("id=\"nInvDate\"") > -1 && rb.indexOf('فایل فاکتور (PDF/عکس)') > -1);
T('محاسبه زنده جمع با ارزش افزوده (پیش‌فرض ۱۰٪ قابل اصلاح)', rb.indexOf('function invVatCalc') > -1 && rb.indexOf('Math.round(amt * 0.1)') > -1);
T('مبلغ ثبتی = جمع کل + تفکیک base/vat/invDate روی رکورد', rb.indexOf('var grand = amt + vat;') > -1 && rb.indexOf('base: amt, vat: vat, invDate: invDate') > -1);
T('AC3: PDF فاکتور مستقیم در docs پرونده فروش + timeline', rb.indexOf("note: 'صادره حسابدار (US-436)'") > -1 && rb.indexOf('فاکتور رسمی ' + "' + no + '" + ' صادر شد') > -1);
T('AC5/AC6: پیش‌پرداخت — نقدی/کامل=تسویه فوری، وصول‌شده=کسر خودکار از مطالبات', rb.indexOf('_a.cashFull ? grand') > -1 && rb.indexOf('received') > -1 && rb.indexOf('fromAdvance: true') > -1);
T('راهنمای پیش‌پرداخت در مودال حسابدار', rb.indexOf('پرداخت کامل/نقدی: فاکتور تسویه‌شده ثبت می‌شود (US-436)') > -1);
T('کارتابل: دکمه «سند قطعی برد» وقتی ارجاع از پرونده است (US-432)', rb.indexOf('🏆 سند قطعی برد (PDF)') > -1 && rb.indexOf('o.invRef.fromFile && typeof sfAwardPrint') > -1);
T('مسیر قدیمی refToInvoice همچنان مسدود (US-431ف۱ v18.9)', rb.indexOf('ارجاع فاکتور رسمی باید فقط از داخل پرونده فروش و پس از تحویل به کارفرما انجام شود') > -1);

SECTION('رفتاری — US-435: قفل و ارجاع');
global.window = global;
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.curRole = function () { return 'chairman'; };
global.roleDef = function () { return { lb: 'رییس هیات مدیره' }; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.isSenior = function () { return SENIOR_ROLES.indexOf(curRole()) > -1; };
global.faDate = function () { return '1405/04/21'; };
global.faDateTime = function () { return '1405/04/21 12:00'; };
global._ntfs = [];
global.notify = function (o) { global._ntfs.push(o); return 'NTF-1'; };
(function () {
  global.sfAll = function () { return getData('ptf_crm_deals'); };
  global.sfSave = function (l) { setData('ptf_crm_deals', l); };
  global.sfAwardEnsure = function (r) { global._awardEnsured = r.cd; return r.awardDocs || []; };
  /* موتور مراحل واقعی از v19.2 */
  global.sfDocsOf = function (r) { return { offers: [], letters: [], misc: [], invoices: getData('ptf_crm_invoices').filter(function (i) { return i.offerNo === 'CO-9'; }), supply: [] }; };
  eval(sf.match(/window\.PTF_SF_STAGES = \[[\s\S]*?\];/)[0]);
  eval(sf.match(/window\.sfStageOf = function \(r\) \{[\s\S]*?\n  \};/)[0].replace(/var d = sfDocsOf\(/, 'var d = global.sfDocsOf('));
  eval(sf.match(/window\.sfStageLabel = function \(r\) \{[\s\S]*?\n  \};/)[0]);
  var mC = sf.match(/window\.sfInvoiceRefCommit = function \(cd\) \{[\s\S]*?\n  \};/);
  T('استخراج sfInvoiceRefCommit', !!mC);
  if (!mC) return;
  eval(mC[0].replace(/sfAll\(\)/g, 'global.sfAll()').replace(/sfSave\(list\)/g, 'global.sfSave(list)'));

  setData('ptf_crm_invoices', []);
  setData('ptf_crm_rfqs', [{ cd: 'INQ-9', st: 'st8' }]);
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', inqNo: 'INQ-9' }]);
  setData('ptf_crm_deals', [{ cd: 'D9', inqNo: 'INQ-9', wonOffer: 'CO-9', docs: [] }]);

  var r1 = sfInvoiceRefCommit('D9');
  T('قبل از تحویل کارفرما (مرحله ۳) → قفل stage', !r1.ok && r1.why === 'stage');
  T('پیشنهاد دست نخورد (invRef ثبت نشد)', !getData('ptf_crm_offers')[0].invRef);

  /* تحویل کارفرما → مرحله ۷ → ارجاع باز می‌شود */
  var deals = getData('ptf_crm_deals');
  deals[0].shipEvents = [{ cd: 'S1', type: 'delivered', receiver: 'مهندس رضایی', t: faDateTime(), by: 'x' }];
  setData('ptf_crm_deals', deals);
  global._ntfs = [];
  var r2 = sfInvoiceRefCommit('D9');
  var o9 = getData('ptf_crm_offers')[0];
  T('پس از تحویل (مرحله ۷) → ارجاع موفق', r2.ok === true);
  T('invRef با مبدا پرونده + سند قطعی برد', o9.invRef && o9.invRef.fromFile === 'D9' && o9.invRef.awardDoc === 'CO-9' && global._awardEnsured === 'D9');
  T('notify فقط حسابدار', global._ntfs.length === 1 && global._ntfs[0].toRoles.length === 1 && global._ntfs[0].toRoles[0] === 'accountant');
  T('مرحله پرونده خودکار ۸ (در حال صدور فاکتور)', sfStageOf(getData('ptf_crm_deals')[0]) === 8);
  T('ارجاع مجدد رد می‌شود (already)', sfInvoiceRefCommit('D9').why === 'already');

  /* نقش غیرارشد */
  global.curRole = function () { return 'sales'; };
  var offs = getData('ptf_crm_offers'); delete offs[0].invRef; setData('ptf_crm_offers', offs);
  T('نقش sales → قفل role', sfInvoiceRefCommit('D9').why === 'role');
  global.curRole = function () { return 'chairman'; };
  T('پرونده ناموجود → nofile', sfInvoiceRefCommit('NOPE').why === 'nofile');
})();

SECTION('رفتاری — US-436: صدور فاکتور با ارزش افزوده و کسر پیش‌پرداخت');
(function () {
  var mS = rb.match(/function saveInv\(offerNo\) \{[\s\S]*?\n  setData\('ptf_crm_invoices', invs\);[\s\S]*?\} catch \(eD\) \{\}/);
  T('استخراج saveInv (بخش هسته)', !!mS);
  if (!mS) return;
  global.ptfNum = function (v) { return +String(v == null ? '' : v).replace(/[^\d.-]/g, '') || 0; }; /* v19.6 moneyx در saveInv */
  var vals = { nInvNo: 'F-1001', nInvAmt: '1000000', nInvVat: '100000', nInvDate: '1405/04/21' };
  global.document = { getElementById: function (id) { return vals[id] != null ? { value: vals[id] } : null; } };
  global.genCode = function (p) { return p + '-TEST1'; };
  global.ptfAdvanceNormalize = function (o) { return o._adv || null; };
  global.window._invFiles = [{ name: 'invoice.pdf', key: 'K-INV-1', size: 1000 }];
  var core = mS[0] + '\n}';
  /* حالت ۱: پیش‌پرداخت ۳۰٪ وصول‌شده (کیس R8: 58.5م از 195م) */
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', _adv: { mode: 'pct', pct: 30, amt: 330000, paid: true, cashFull: false } }]);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_deals', [{ cd: 'D9', wonOffer: 'CO-9', docs: [], timeline: [] }]);
  eval('(' + core.replace('function saveInv(offerNo)', 'function (offerNo)') + ')("CO-9")');
  var inv = getData('ptf_crm_invoices')[0];
  T('مبلغ فاکتور = جمع با ارزش افزوده (۱,۱۰۰,۰۰۰)', inv && inv.amount === 1100000 && inv.base === 1000000 && inv.vat === 100000);
  T('کسر خودکار پیش‌پرداخت وصول‌شده (۳۳۰,۰۰۰) از مطالبات', inv.payments.length === 1 && inv.payments[0].amt === 330000 && inv.payments[0].fromAdvance === true && inv.advApplied === 330000);
  T('مانده مطالبات = ۷۷۰,۰۰۰ (در حال تسویه — AC6)', inv.amount - inv.payments[0].amt === 770000);
  var d = getData('ptf_crm_deals')[0];
  T('PDF فاکتور در docs پرونده + timeline (AC3)', d.docs.length === 1 && d.docs[0].key === 'K-INV-1' && d.timeline.length === 1 && d.timeline[0].tx.indexOf('F-1001') > -1);
  /* حالت ۲: پرداخت کامل/نقدی → تسویه فوری (AC5) */
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', _adv: { mode: 'full', pct: 100, amt: 900000, paid: true, cashFull: true } }]);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_deals', [{ cd: 'D9', wonOffer: 'CO-9', docs: [], timeline: [] }]);
  eval('(' + core.replace('function saveInv(offerNo)', 'function (offerNo)') + ')("CO-9")');
  var inv2 = getData('ptf_crm_invoices')[0];
  T('نقدی/کامل: فاکتور تسویه‌شده کامل ثبت می‌شود (مانده صفر — AC5)', inv2.payments.length === 1 && inv2.payments[0].amt === inv2.amount && inv2.amount - inv2.payments[0].amt === 0);
  /* حالت ۳: بدون پیش‌پرداخت → کل مبلغ به مطالبات */
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO' }]);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_deals', [{ cd: 'D9', wonOffer: 'CO-9', docs: [], timeline: [] }]);
  eval('(' + core.replace('function saveInv(offerNo)', 'function (offerNo)') + ')("CO-9")');
  var inv3 = getData('ptf_crm_invoices')[0];
  T('بدون پیش‌پرداخت: کل مبلغ به مطالبات (بدون payment خودکار)', inv3.payments.length === 0 && inv3.amount === 1100000);
})();

SECTION('رگرسیون');
T('US-433 موتور مراحل (v19.2) پابرجا', sf.indexOf('window.sfStageOf') > -1 && sf.indexOf('window.sfRfqAlign') > -1);
T('US-434ف۲ ارسال/تحویل (v19.2) پابرجا', sf.indexOf('window.sfShipCommit') > -1 && sf.indexOf('🤝 تحویل کارفرما</button>') > -1);
T('US-432 اسناد قطعی برد (v19.1) پابرجا', sf.indexOf('window.sfAwardPrint') > -1);
T('renderReceivables/savePay مطالبات دست‌نخورده', rb.indexOf('function renderReceivables()') > -1 && rb.indexOf('function savePay(invCd)') > -1);
T('سقف وصولی از مانده فاکتور (قدیمی) پابرجا', rb.indexOf('مبلغ از مانده فاکتور بیشتر است') > -1);
T('پیامک صدور فاکتور به ارجاع‌دهنده (US-150) پابرجا', rb.indexOf('پیامک اطلاع «فاکتور صادر شد» برای ارجاع‌دهنده') > -1);

DONE('tester109-v193');
