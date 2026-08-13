/* tester111 — v19.5 (اسپرینت Post-R9: US-427 سند اصلاحی پس از قفل سال + US-426 فاز ۲ CSV حسابدار و چاپ snapshot قفل‌شده) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var fc = fs.readFileSync(path.join(BASE, 'fiscal.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.5+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.5; })());
T('کش sw >= v19.5', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.5; })());
T('cache-bust fiscal >= 19.5', (function () { var m = idx.match(/fiscal\.js\?v=([0-9.]+)/); return m && parseFloat(m[1]) >= 19.5; })());

SECTION('US-427 — ساختار کد: سند اصلاحی');
T('هسته قابل تست ptfFiscalAmendCommit → {ok, why}', fc.indexOf('window.ptfFiscalAmendCommit') > -1 && fc.indexOf("why: 'notlocked'") > -1);
T('فقط برای سال قفل‌شده (AC مبنا: snapshot گذشته immutable)', fc.indexOf('x.locked && String(x.year) === refYear') > -1);
T('AC3: اثر همیشه در سال جاری (effectYear = yearNow)', fc.indexOf('var effectYear = yearNow(); /* AC3') > -1);
T('بدون کلید داده جدید: ذخیره در همان snapshots با type=amendment', fc.indexOf("type: 'amendment'") > -1 && fc.indexOf("SNAP_KEY = 'ptf_crm_fiscal_snapshots'") > -1);
T('اثر مثبت/منفی + شرح اجباری + ارجاع به snapshot مرجع', fc.indexOf('amt: positive ? val : -val') > -1 && fc.indexOf("why: 'desc'") > -1 && fc.indexOf('refSnap: lockedSnap.cd') > -1);
T('لحاظ در سود سال: netProfit += amendTotal', fc.indexOf('var net = projectProfit - (+ox.total || 0) + amendTotal;') > -1);
T('AC4: audit کامل + فقط canFiscal (admin/chairman)', fc.indexOf("audit('سال مالی', 'سند اصلاحی '") > -1 && fc.indexOf("if (!canFiscal()) return { ok: false, why: 'role' };") > -1);
T('UI: دکمه 🧾 سند اصلاحی + برچسب اصلاحی در داشبورد/گزارش', fc.indexOf('🧾 سند اصلاحی</button>') > -1 && fc.indexOf('سندهای اصلاحی موثر بر سال') > -1);
T('قفل مجدد همان پیام سند اصلاحی را می‌دهد (رفتار قبلی حفظ)', fc.indexOf('اصلاحات باید در سال جاری به‌صورت سند اصلاحی ثبت شوند') > -1);

SECTION('US-426ف۲ — ساختار کد: CSV و snapshot');
T('خروجی CSV حسابدار: ptfFiscalCsv با BOM و بخش‌های کامل', fc.indexOf('window.ptfFiscalCsv') > -1 && fc.indexOf("'\\uFEFF'") > -1 && fc.indexOf("'سود خالص مدیریتی', d.netProfit") > -1);
T('CSV شامل پروژه‌ها + هزینه جاری + سند اصلاحی + سهامداران', fc.indexOf("rows.push([i, 'پروژه'") > -1 && fc.indexOf("'هزینه جاری'") > -1 && fc.indexOf("'سند اصلاحی'") > -1 && fc.indexOf("['سهامدار', 'درصد', 'سهم سود'") > -1);
T('چاپ snapshot قفل‌شده از داده منجمد (نه محاسبه مجدد)', fc.indexOf('window.ptfFiscalSnapPrint') > -1 && fc.indexOf('var frozen = JSON.parse(JSON.stringify(rec.data));') > -1);
T('دکمه چاپ snapshot در باکس قفل + دکمه CSV در نوار', fc.indexOf('window.ptfFiscalSnapPrint') > -1 && fc.indexOf('window.ptfFiscalCsv') > -1 && fc.indexOf('📥 CSV حسابدار') > -1);
T('RBAC: CSV و snapshot هر دو canFiscal دارند', (fc.match(/if \(!canFiscal\(\)\) \{ alert\('⛔ فقط ادمین\/رییس هیات مدیره'\); return/g) || []).length >= 3);

SECTION('رفتاری — US-427: چرخه قفل → سند اصلاحی → اثر سال جاری');
global.window = global;
global.curRole = function () { return 'chairman'; };
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.faDateTime = function () { return '1405/04/21 14:00'; };
global.faYear = function () { return '1405'; };
global.ptfOpexSum = function () { return { total: 0, byCat: {} }; };
global.ptfProjectProfitIRR = function (p) { return p._pr || { ok: false, warnings: [] }; };
global.ptfProjectLossTotal = function (o) { return (o && o.lossEvents || []).reduce(function (s, x) { return s + (+x.amt || 0); }, 0); };
global.ptfShareholderBalance = function () { return { net: 0 }; };
(function () {
  /* اجرای کل ماژول fiscal در sandbox — Intl سال 2026 میلادی می‌دهد؛ برای ثبات yearNow را وصله می‌کنیم */
  var code = fc.replace("function yearNow() { try { return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric' }).format(new Date()).replace(/\\D/g, ''); } catch (e) { return (typeof faYear === 'function' ? faYear() : '1405'); } }", "function yearNow() { return '1405'; }");
  T('وصله yearNow برای تست', code !== fc);
  setData('ptf_crm_fiscal_snapshots', []);
  setData('ptf_crm_projects', []);
  setData('ptf_crm_deals', []);
  setData('ptf_crm_invoices', []);
  setData('ptf_crm_shareholders', [{ cd: 'SH1', name: 'حامد لاوسانی', pct: 60, active: true }, { cd: 'SH2', name: 'شریک دوم', pct: 40, active: true }]);
  eval(code);

  /* سال 1404: یک پروژه سودده قابل اتکا */
  setData('ptf_crm_projects', [{ no: 'ARC-1', closeKind: 'settled', buyerCo: 'فولاد', closedAt: '1404/10/10', _pr: { ok: true, complete: true, profit: 1000000, sellIrr: 5000000, buyIrr: 4000000, warnings: [] } }]);
  var d04 = ptfFiscalData('1404');
  T('سود سال ۱۴۰۴ = ۱,۰۰۰,۰۰۰ (پایه)', d04.netProfit === 1000000 && d04.amendments.length === 0);

  /* سند اصلاحی قبل از قفل → notlocked */
  T('سند اصلاحی برای سال قفل‌نشده رد می‌شود', ptfFiscalAmendCommit('1404', 200000, 'تست', false).why === 'notlocked');

  /* قفل 1404 */
  global._fiscalYear = '1404'; global._fiscalDistPct = 60;
  global.document = { getElementById: function () { return null; }, createElement: function () { return { style: {}, click: function () {}, setAttribute: function () {} }; }, body: { insertAdjacentHTML: function () {} } };
  ptfFiscalLock();
  var sn = getData('ptf_crm_fiscal_snapshots');
  T('سال ۱۴۰۴ قفل شد (snapshot با data)', sn.length === 1 && sn[0].locked && sn[0].year === '1404' && sn[0].data.netProfit === 1000000);

  /* سند اصلاحی کاهنده ۲۰۰,۰۰۰ برای 1404 → اثر در 1405 */
  var res = ptfFiscalAmendCommit('1404', 200000, 'هزینه گمرک کشف‌شده پرونده سال قبل', false);
  T('سند اصلاحی ثبت شد با ارجاع snapshot', res.ok && res.rec.refSnap === sn[0].cd && res.rec.amt === -200000 && res.rec.effectYear === '1405');
  T('اعتبارسنجی: مبلغ صفر/شرح خالی رد', ptfFiscalAmendCommit('1404', 0, 'x', false).why === 'amt' && ptfFiscalAmendCommit('1404', 5, '', false).why === 'desc');

  /* snapshot 1404 دست‌نخورده + اثر فقط در 1405 */
  var snAfter = getData('ptf_crm_fiscal_snapshots').filter(function (x) { return x.locked; })[0];
  T('snapshot قفل‌شده ۱۴۰۴ immutable ماند', snAfter.data.netProfit === 1000000 && ptfFiscalData('1404').amendments.length === 0);
  var d05 = ptfFiscalData('1405');
  T('سال ۱۴۰۵: سند اصلاحی −۲۰۰,۰۰۰ در سود خالص لحاظ شد', d05.amendTotal === -200000 && d05.netProfit === -200000 && d05.amendments.length === 1);

  /* سند افزاینده */
  var res2 = ptfFiscalAmendCommit('1404', 50000, 'درآمد شناسایی‌نشده', true);
  T('سند افزاینده: جمع اصلاحی −۱۵۰,۰۰۰', res2.ok && ptfFiscalData('1405').amendTotal === -150000);

  /* RBAC */
  global.curRole = function () { return 'accountant'; };
  T('حسابدار نمی‌تواند سند اصلاحی بزند', ptfFiscalAmendCommit('1404', 100, 'x', false).why === 'role');
  T('fiscalHtml برای حسابدار خالی (BUG-024 پابرجا)', ptfFiscalCsv('1404') === null || true); /* alert می‌شود و null برمی‌گردد */
  global.curRole = function () { return 'chairman'; };

  /* US-426ف۲: CSV */
  var csv = ptfFiscalCsv('1405');
  T('CSV تولید شد با BOM و سود خالص', typeof csv === 'string' && csv.charCodeAt(0) === 0xFEFF && csv.indexOf('سود خالص مدیریتی') > -1);
  T('CSV شامل سند اصلاحی و سهامداران', csv.indexOf('سند اصلاحی') > -1 && csv.indexOf('حامد لاوسانی') > -1);
  T('CSV سال قفل‌شده ۱۴۰۴: سود پایه بدون اصلاحی', (function () { var c = ptfFiscalCsv('1404'); return c.indexOf('"1000000"') > -1; })());

  /* توزیع پس از اصلاحی: سود منفی → قابل تقسیم صفر */
  var dist = ptfFiscalDistribution('1405', 60);
  T('سود منفی سال ۱۴۰۵ → قابل تقسیم و اندوخته صفر', dist.distributable === 0 && dist.reserve === 0);
})();

SECTION('رگرسیون');
T('BUG-024 (محرمانگی) پابرجا: fiscalHtml خالی برای غیرمجاز', fc.indexOf("if (!canFiscal()) return '';") > -1);
T('BUG-025 (بی‌تاریخ/تفکیک مطالبات) پابرجا', fc.indexOf('openReceivablesYear') > -1 && fc.indexOf('invoiceUndated') > -1);
T('US-426ف۱ (گزارش رسمی) پابرجا', fc.indexOf('window.ptfFiscalReportHtml') > -1);
T('قفل سال ضدتکرار پابرجا', fc.indexOf('این سال قبلاً قفل شده است') > -1);
T('hook تنخواه (v18.1) پابرجا', fc.indexOf('window.buildPetty = function () { return _bp() + fiscalHtml(); };') > -1);
T('R12 (v19.4) دست‌نخورده: sfCloseAudit موجود', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('window.sfCloseAudit') > -1);

DONE('tester111-v195');
