#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   tester591 — v34.37.8 — پنل‌های تاشوِ بالای فهرست (کارفرما ۲۰۲۶-۰۹-۰۴)

   خواستهٔ کارفرما:
     «در قسمت تامین‌کنندگان پنجرهٔ بالای فهرست یعنی حساب تامین‌کنندگان به‌صورت
      پیش‌فرض باز است؛ باید پیش‌فرض بسته باشد و قابلیت جستجو داشته باشد. مشابه
      همین پنجره در قسمت مشتریان یعنی حساب مشتریان ایجاد شود.»
   تصمیم‌های تأییدشدهٔ کارفرما (پرسشِ مستقیم):
     • پنلِ «حساب مشتریان» بالای فهرست مشتریان **ساخته شود** (بسته + جستجو)؛
     • جعبهٔ «💳 بدهی غیرنقدی تأمین‌کنندگان» هم **بسته** شود؛
     • وضعیتِ باز/بسته **ذخیره نشود** — همیشه بسته شروع شود.

   سه لایه:
     ۱) pinهای منبعی (نبودِ `open`، ontoggle، کادر جستجو، عدمِ برخوردِ id با تابع)
     ۲) رفتارِ واقعی در vm با DOM ساختگی (lazy فقط هنگام بازکردن، جستجو فقط tbody،
        سقفِ ردیف، RBAC)
     ۳) سازگاری/بازگشت (pinهای قدیمیِ lazy، منبعِ واحدِ عددها، handlerهای موجود)
   ═══════════════════════════════════════════════════════════════════════════ */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var VER = 'v34.37.8'; /* ابزار fix-version-drift این خط را خراب کرده بود (به‌سبب قاعدهٔ R-H که «var VER = 'v» را بدون نگاه‌داشتن به زمینهٔ regex بازنویسی می‌کرد) — در این فایل VER یک مقدار لفظیِ عامد است و window هم در Node وجود ندارد. */
var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var slf = read('crm/supplier-finance.js');
var sc = read('crm/scoring.js');
var cf = read('crm/customer-finance.js');
var tc = read('crm/theme-contrast.js');
var gate = read('_tools/uat/run-ci-gate.js');
/* v34.37.8: شکلِ escape‌شدهٔ نسخهٔ جاری برای پین‌هایی که با new RegExp('…') ساخته می‌شوند
   (در متنِ فایل به‌صورت 34\\.37\\.2 دیده می‌شود). از VER مشتق می‌شود، نه لفظیِ دستی —
   تا با هر bump خودبه‌خود به‌روز بماند و «نسخهٔ مخلوط» را همچنان بگیرد
   (کش‌باسترِ index.html باید با نسخهٔ رسمیِ VERSION.json یکی باشد). */
var CUR_ESC2 = VER.replace(/^v/, '').split('.').join('\\.');

/* ═══════════ ۰) نسخه و ثبت در گیت ═══════════ */
T('۰.۱ VERSION.json = ' + VER, ver.crm_version === VER, ver.crm_version);
T('۰.۲ cache-bust هر سه فایل در index.html', ['supplier-finance.js', 'scoring.js', 'customer-finance.js'].every(function (m) {
  /* v34.37.8: این پین به‌صورت رشتهٔ new RegExp('…') نوشته شده، پس escape آن «دوبل» است
     (34\\.37\\.2) و ابزارِ bump-version-pins پیش‌تر فقط شکلِ تک‌escape را می‌دید — یکی از
     دو نقطهٔ کوری که در v34.37.8 در خودِ ابزار رفع شد. */
  return new RegExp(m.replace('.', '\\.') + '\\?v=' + CUR_ESC2).test(idx);
}));
/* v34.37.8: نامِ *فایلِ* این تستر یک «هویتِ تاریخی» است، نه پینِ نسخه — ابزارِ bump
   پیش‌تر آن را هم عوض می‌کرد و ارجاع به فایلِ واقعی می‌شکست (این پین قرمز می‌شد).
   هویت‌ها حالا در خودِ ابزار محافظت می‌شوند (IDENTITY_RE). */
T('۰.۳ این تستر در گیت CI ثبت شده است', gate.indexOf('tester591-v34.36.3-collapsible-account-panels.js') > -1);

/* ═══════════ ۱) pinهای منبعی — پنلِ حساب تامین‌کنندگان ═══════════ */
T('۱.۱ slBox دیگر `open` نیست (پیش‌فرض بسته)', /<details id="slBox"(?![^>]*\bopen\b)/.test(slf) && slf.indexOf('<details id="slBox" open') === -1);
T('۱.۲ slBox کلیدِ ontoggle دارد (بارگذاری هنگام بازکردن)', slf.indexOf('ontoggle="ptfSlBoxToggle(this)"') > -1 && slf.indexOf('window.ptfSlBoxToggle = function (el) { if (el && el.open) window.ptfSlBoxLazy(true); };') > -1);
T('۱.۳ کادر جستجو در slBox وجود دارد', slf.indexOf('id="slBoxQ"') > -1 && slf.indexOf('oninput="slBoxSearch(this.value)"') > -1 && slf.indexOf('window.slBoxSearch = function (v)') > -1);
T('۱.۴ id کادر جستجو با نامِ تابع برخورد نمی‌کند (کلاسِ باگِ pgTitle)', slf.indexOf('id="slBoxSearch"') === -1 && slf.indexOf("id='slBoxSearch'") === -1);
T('۱.۵ جست‌وجو فقط tbody را به‌روز می‌کند (حفظِ فوکوس)', /window\.slBoxSearch = function \(v\) \{[\s\S]{0,400}getElementById\('slBoxBody'\)/.test(slf));
T('۱.۶ وضعیتِ باز/بسته ذخیره نمی‌شود (بدونِ localStorage برای slBox)', !/localStorage[^;]{0,80}slBox/i.test(slf));
T('۱.۷ pinهای قدیمیِ lazy دست‌نخورده (tester487/tester494)', slf.indexOf('function slBoxRows(') > -1 && /window\.ptfSlBoxLazy = function/.test(slf) && slf.indexOf('id="slBoxBody"') > -1 && /_slBoxLazyTries < 8/.test(slf) && slf.indexOf('balanceHtmlFrom(b, s.cd)') > -1);
T('۱.۸ سقفِ ردیف + راهنمای «و N حساب دیگر»', slf.indexOf('var SL_BOX_MAX = 60;') > -1 && slf.indexOf('rows.slice(0, SL_BOX_MAX)') > -1 && slf.indexOf('حساب دیگر — نام یا کد تأمین‌کننده را در کادر جست‌وجو بنویسید') > -1);
T('۱.۹ ترتیب: حسابِ باز ابتدا، سپس بیشترین مانده', /rows\.sort\(function \(a, c\) \{\s*if \(a\.open !== c\.open\) return a\.open \? -1 : 1;/.test(slf));

/* ═══════════ ۲) pinهای منبعی — جعبهٔ بدهی غیرنقدی ═══════════ */
T('۲.۱ payablesBox به <details> تبدیل شد و پیش‌فرض بسته است', sc.indexOf("'<details id=\"payablesBox\"' + (keepOpen ? ' open' : '')") > -1);
T('۲.۲ رندرِ اولیه هیچ‌وقت open نمی‌دهد (فقط رفرشِ برنامه‌ای وضعیت را حفظ می‌کند)', /window\.buildSuppliers = function \(\) \{ return payablesBoxHtml\(\) \+ _bSup\(\); \};/.test(sc) && /box\.outerHTML = payablesBoxHtml\(!!box\.open\)/.test(sc));
T('۲.۳ کادر جستجو دارد و id با تابع برخورد نمی‌کند', sc.indexOf('id="payablesQ"') > -1 && sc.indexOf('oninput="ptfPayablesSearch(this.value)"') > -1 && sc.indexOf('window.ptfPayablesSearch = function (v)') > -1 && sc.indexOf('id="payablesSearch"') === -1);
T('۲.۴ جمع و شمارِ بدهی روی summary است (بدونِ بازکردن دیده می‌شود)', /<summary class="payables-toggle"[\s\S]{0,300}summaryState/.test(sc));
T('۲.۵ کلاس‌های CSS و handlerهای قدیمی دست‌نخورده', ['payables-head', 'payables-summary', 'payables-actions', 'payable-debt-row', 'payable-debt-info', 'payables-empty', 'ptfPayablesOpen()', 'ptfScoreReport()'].every(function (k) { return sc.indexOf(k) > -1; }));
T('۲.۶ نمای شب: summary و کادر جست‌وجو رنگِ خوانا دارند', tc.indexOf('#payablesBox>summary.payables-toggle{color:#fde68a') > -1 && tc.indexOf('#payablesBox #payablesQ{background:#162235') > -1);

/* ═══════════ ۳) pinهای منبعی — جعبهٔ جدیدِ حساب مشتریان ═══════════ */
T('۳.۱ cfBox ساخته شد و پیش‌فرض بسته است', /<details id="cfBox"(?![^>]*\bopen\b)/.test(cf) && cf.indexOf('id="cfBoxBody"') > -1);
T('۳.۲ به buildCustomers hook شد (پیش از فهرست مشتریان)', /window\.buildCustomers = function \(\) \{ return cfBox\(\) \+ _bc\(\); \};/.test(cf) && cf.indexOf('function hookCustBox()') > -1);
/* تلاشِ مجدد با گاردِ typeof: این ماژول در harnessهای vm (بدون تایمر) هم بارگذاری
   می‌شود — بدونِ گارد، ReferenceError کلِ پنلِ مشتریان را می‌انداخت (tester415/421/429/504). */
T('۳.۳ hook با تلاشِ مجددِ گاردشده است (ترتیبِ defer تضمین نیست + harness بدون تایمر نمی‌شکند)', /if \(!hookCustBox\(\) && typeof setInterval === 'function'\) \{/.test(cf) && cf.indexOf('_cfBoxTries > 60') > -1 && cf.indexOf('catch (eCfBoxHook)') > -1);
T('۳.۴ کادر جستجو دارد و با cfSearch هاب مالی تداخل ندارد', cf.indexOf('id="cfBoxQ"') > -1 && cf.indexOf('oninput="cfBoxSearch(this.value)"') > -1 && cf.indexOf('window.cfBoxSearch = function (v)') > -1 && cf.indexOf('_cfBoxSearch') > -1 && cf.indexOf('id="cfBoxSearch"') === -1);
T('۳.۵ lazy تا نخستین بازکردن', cf.indexOf('window.ptfCfBoxLazy = function (force)') > -1 && cf.indexOf("if (det && !det.open && force !== true) { window._cfBoxLazyPending = true; return; }") > -1 && cf.indexOf('window.ptfCfBoxToggle = function (el)') > -1);
T('۳.۶ منبعِ عددها همانِ هاب مالی است (cfAccountRows/accountIsOpen — دو فرمولِ خصوصی ممنوع)', /function cfBoxRows\(query\) \{[\s\S]{0,400}window\.cfAccountRows\(q\)/.test(cf) && cf.indexOf('rows.filter(accountIsOpen)') > -1);
T('۳.۷ RBAC: نقشِ ارشد یا ledgerScope غیرِ none', /function canSeeCust\(\) \{[\s\S]{0,220}isSenior\(\)[\s\S]{0,120}ptfCanSeeLedger\('official'\)/.test(cf));
T('۳.۸ جعبهٔ هاب مالی (cfFinanceHubBox/cfSearch/cfFinanceSearch) دست‌نخورده', cf.indexOf('id="cfFinanceHubBox"') > -1 && cf.indexOf('id="cfSearch"') > -1 && cf.indexOf('window.cfFinanceSearch = function (v)') > -1);
T('۳.۹ دکمهٔ «نمای کامل در هاب مالی» با گاردِ نقش', cf.indexOf('window.cfBoxOpenHub = function ()') > -1 && cf.indexOf("goPanel('petty')") > -1 && cf.indexOf("window.finHubSet('custacc')") > -1 && cf.indexOf("['admin', 'chairman', 'ceo', 'commercial'].indexOf(curRole()) === -1") > -1);

/* ═══════════ ۴) رفتارِ واقعی — supplier-finance.js در vm ═══════════ */
function makeDoc() {
  var els = {};
  return {
    els: els,
    getElementById: function (id) { return Object.prototype.hasOwnProperty.call(els, id) ? els[id] : null; },
    querySelectorAll: function () { return []; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
    head: { appendChild: function () {} }
  };
}
function supStore(n) {
  var sups = [], invs = [];
  for (var i = 1; i <= n; i++) {
    sups.push({ cd: 'S' + i, co: 'تامین‌کنندهٔ ' + i });
    invs.push({ cd: 'INV' + i, supplierCd: 'S' + i, no: 'FA-' + i, dateISO: '1405-03-01', dateFa: '۱۴۰۵/۰۳/۰۱', amount: 1000000 * i, amountIrr: 1000000 * i, cur: 'IRR', status: 'open', isOfficial: false });
  }
  return {
    ptf_crm_suppliers: sups,
    ptf_crm_supplier_finance: { invoices: invs, payments: [], adjustments: [] },
    ptf_crm_payables: []
  };
}
function loadSup(store, role, doc) {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; return true; },
    curRole: function () { return role; }, isSenior: function () { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1; },
    roleDef: function () { return { buyPrice: ['admin', 'chairman', 'ceo', 'commercial', 'buyer'].indexOf(role) > -1 }; },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: doc || makeDoc(),
    setInterval: function () { return 0; }, clearInterval: function () {}, setTimeout: function () { return 0; },
    faDateTime: function () { return 'x'; }, genCode: function () { return 'X'; },
    escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
    ptfISOToJ: function (v) { return v || ''; }, ptfJToISO: function (v) { return v || ''; },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v).replace(/'/g, "\\'"); },
    /* پایهٔ پنل — hook باید این را حفظ کند */
    buildSuppliers: function () { return '<div id="supBase">BASE</div>'; }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(slf, sb, { filename: 'supplier-finance.js' });
  return sb;
}

(function () {
  var store = supStore(3);
  var doc = makeDoc();
  var sb = loadSup(store, 'admin', doc);
  var html = sb.buildSuppliers();

  T('۴.۱ پنلِ بسته ساخته می‌شود و `<details ... open>` ندارد', html.indexOf('<details id="slBox"') > -1 && !/<details id="slBox"[^>]*\bopen\b/.test(html));
  T('۴.۲ پایهٔ پنلِ تامین‌کنندگان حفظ شد (hook زنجیره‌ای)', html.indexOf('<div id="supBase">BASE</div>') > -1 && html.indexOf('<details id="slBox"') < html.indexOf('supBase'));
  T('۴.۳ کادر جستجو و ontoggle در HTML هست', html.indexOf('id="slBoxQ"') > -1 && html.indexOf('ontoggle="ptfSlBoxToggle(this)"') > -1 && html.indexOf('id="slBoxBody"') > -1);

  /* بسته ⇒ محاسبه نمی‌شود (فقط نشانِ «در انتظار») */
  doc.els.slBox = { open: false };
  doc.els.slBoxBody = { innerHTML: 'PLACEHOLDER' };
  sb.ptfSlBoxLazy();
  T('۴.۴ تا بسته است محاسبه نمی‌شود (بدونِ پیمایشِ بی‌مورد همهٔ تامین‌کنندگان)', doc.els.slBoxBody.innerHTML === 'PLACEHOLDER' && sb._slBoxLazyPending === true && sb._slBoxLazyDone === undefined, doc.els.slBoxBody.innerHTML);

  /* بازکردن ⇒ محاسبه */
  doc.els.slBox.open = true;
  sb.ptfSlBoxToggle(doc.els.slBox);
  var body = doc.els.slBoxBody.innerHTML;
  T('۴.۵ نخستین بازکردن ردیف‌ها را محاسبه می‌کند', sb._slBoxLazyDone === true && body.indexOf('تامین‌کنندهٔ ۱') === -1 && body.indexOf('تامین‌کنندهٔ 1') > -1 && body.indexOf('slOpenLedger(') > -1, body.slice(0, 160));
  T('۴.۶ هر سه تامین‌کنندهٔ دارای گردش در فهرست‌اند', ['تامین‌کنندهٔ 1', 'تامین‌کنندهٔ 2', 'تامین‌کنندهٔ 3'].every(function (n) { return body.indexOf(n) > -1; }));
  T('۴.۷ مانده با رقمِ فارسی و کدِ ارز نمایش داده می‌شود', /[۰-۹]/.test(body) && body.indexOf('IRR') > -1, body.slice(0, 200));

  /* بستن ⇒ ontoggle کاری نمی‌کند */
  doc.els.slBox.open = false;
  doc.els.slBoxBody.innerHTML = '';
  sb.ptfSlBoxToggle(doc.els.slBox);
  T('۴.۸ بستنِ پنل محاسبه‌ای انجام نمی‌دهد', doc.els.slBoxBody.innerHTML === '');

  /* جست‌وجو */
  doc.els.slBox.open = true;
  sb.slBoxSearch('تامین‌کنندهٔ 2');
  var b2 = doc.els.slBoxBody.innerHTML;
  T('۴.۹ جست‌وجوی نام فقط همان ردیف را نگه می‌دارد', b2.indexOf('تامین‌کنندهٔ 2') > -1 && b2.indexOf('تامین‌کنندهٔ 3') === -1 && b2.indexOf('تامین‌کنندهٔ 1') === -1, b2.slice(0, 200));
  sb.slBoxSearch('S3');
  T('۴.۱۰ جست‌وجوی کد هم کار می‌کند', doc.els.slBoxBody.innerHTML.indexOf('تامین‌کنندهٔ 3') > -1 && doc.els.slBoxBody.innerHTML.indexOf('تامین‌کنندهٔ 2') === -1);
  sb.slBoxSearch('چیزی‌که‌نیست');
  T('۴.۱۱ جست‌وجوی بی‌نتیجه پیامِ صریح می‌دهد', doc.els.slBoxBody.innerHTML.indexOf('موردی مطابق این جست‌وجو نیست') > -1);
  sb.slBoxSearch('');
  T('۴.۱۲ پاک‌کردن جست‌وجو فهرست کامل را برمی‌گرداند', ['تامین‌کنندهٔ 1', 'تامین‌کنندهٔ 3'].every(function (n) { return doc.els.slBoxBody.innerHTML.indexOf(n) > -1; }));
})();

/* سقفِ ردیف + راهنما */
(function () {
  var store = supStore(65);
  var doc = makeDoc();
  var sb = loadSup(store, 'admin', doc);
  doc.els.slBox = { open: true };
  doc.els.slBoxBody = { innerHTML: '' };
  sb.ptfSlBoxToggle(doc.els.slBox);
  var body = doc.els.slBoxBody.innerHTML;
  var trCount = (body.match(/<tr/g) || []).length;
  T('۴.۱۳ با ۶۵ حساب، فقط ۶۰ ردیف + ردیفِ راهنما رندر می‌شود', trCount === 61, 'tr=' + trCount);
  T('۴.۱۴ راهنمای «و ۵ حساب دیگر» با رقمِ فارسی', body.indexOf('حساب دیگر') > -1 && body.indexOf('۵') > -1);
  sb.slBoxSearch('تامین‌کنندهٔ 65');
  T('۴.۱۴b جست‌وجو ردیفِ خارج از سقف را پیدا می‌کند', doc.els.slBoxBody.innerHTML.indexOf('تامین‌کنندهٔ 65') > -1);
})();

/* RBAC */
(function () {
  var store = supStore(2);
  var sb = loadSup(store, 'sales', makeDoc());
  var html = sb.buildSuppliers();
  T('۴.۱۵ نقشِ بدونِ دسترسی (sales) جعبه را نمی‌بیند', html.indexOf('slBox') === -1 && html.indexOf('supBase') > -1, html.slice(0, 80));
})();

/* ═══════════ ۵) رفتارِ واقعی — scoring.js (بدهی غیرنقدی) ═══════════ */
function loadScoring(store, role, doc) {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; return true; },
    curRole: function () { return role; }, isSenior: function () { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1; },
    roleDef: function () { return { buyPrice: ['admin', 'chairman', 'ceo', 'commercial', 'buyer'].indexOf(role) > -1, finance: ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1 }; },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: doc || makeDoc(),
    /* scoring.js هوکِ buildSuppliers را از یک حلقهٔ setInterval می‌زند (هم‌الگوی
       تلاشِ مجدد)؛ stub باید همان نخستین tick را اجرا کند تا هوک برقرار شود. */
    setInterval: function (fn) { try { fn(); } catch (eI) { console.error('INTERVAL FAIL', eI.message); } return 0; },
    clearInterval: function () {}, setTimeout: function () { return 0; },
    alert: function () {}, faDateTime: function () { return 'x'; }, genCode: function () { return 'X'; },
    escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
    ptfISOToJ: function (v) { return v || ''; }, ptfJToISO: function (v) { return v || ''; },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v).replace(/'/g, "\\'"); },
    ptfToast: function () {}, audit: function () {}, curSession: function () { return { name: 'tester' }; },
    buildSuppliers: function () { return '<div id="supBase">BASE</div>'; },
    renderSuppliers: function () {}, renderCustomers: function () {}
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(sc, sb, { filename: 'scoring.js' });
  return sb;
}
(function () {
  var store = {
    ptf_crm_payables: [
      { cd: 'P1', sup: 'فولاد مبارکه', amount: 5000000, cur: 'IRR', pay: 'credit', settled: false, paid: [] },
      { cd: 'P2', sup: 'سپاهان لوله', amount: 2000000, cur: 'IRR', pay: 'credit', settled: false, paid: [] },
      { cd: 'P3', sup: 'نقدی تسویه', amount: 900000, cur: 'IRR', pay: 'cash', settled: true, paid: [] }
    ],
    ptf_crm_suppliers: [{ cd: 'S1', co: 'فولاد مبارکه' }, { cd: 'S2', co: 'سپاهان لوله' }]
  };
  var doc = makeDoc();
  var sb = loadScoring(store, 'admin', doc);
  var html = sb.buildSuppliers();
  T('۵.۱ جعبهٔ بدهی <details> و پیش‌فرض بسته است', html.indexOf('<details id="payablesBox">') > -1 && !/<details id="payablesBox"[^>]*\bopen\b/.test(html));
  T('۵.۲ summary جمع و شمار را بدونِ بازکردن نشان می‌دهد', /<summary class="payables-toggle"[^>]*>💳 بدهی غیرنقدی تأمین‌کنندگان — <span class="payables-total"[^>]*>۲ تأمین‌کننده · [۰-۹٬]+ ریال باز<\/span>/.test(html), html.slice(0, 400));
  T('۵.۳ کادر جستجو در جعبه هست', html.indexOf('id="payablesQ"') > -1 && html.indexOf('oninput="ptfPayablesSearch(this.value)"') > -1);
  T('۵.۴ ردیف‌ها در ناحیهٔ جدا (payablesRows) رندر می‌شوند', html.indexOf('<div id="payablesRows">') > -1 && html.indexOf('فولاد مبارکه') > -1 && html.indexOf('سپاهان لوله') > -1);
  T('۵.۵ قلمِ تسویه‌شدهٔ نقدی در فهرست نیست', html.indexOf('نقدی تسویه') === -1);

  /* جست‌وجو */
  doc.els.payablesRows = { innerHTML: '' };
  sb.ptfPayablesSearch('سپاهان');
  T('۵.۶ جست‌وجو فقط ناحیهٔ ردیف‌ها را به‌روز می‌کند', doc.els.payablesRows.innerHTML.indexOf('سپاهان لوله') > -1 && doc.els.payablesRows.innerHTML.indexOf('فولاد مبارکه') === -1);
  sb.ptfPayablesSearch('');
  T('۵.۷ پاک‌کردن جست‌وجو هر دو ردیف را برمی‌گرداند', doc.els.payablesRows.innerHTML.indexOf('فولاد مبارکه') > -1 && doc.els.payablesRows.innerHTML.indexOf('سپاهان لوله') > -1);
  sb.ptfPayablesSearch('zzz');
  T('۵.۸ جست‌وجوی بی‌نتیجه پیامِ صریح می‌دهد', doc.els.payablesRows.innerHTML.indexOf('بدهی غیرنقدی مطابق این جست‌وجو نیست') > -1);

  /* سقف ۸ ردیف + راهنما */
  var many = { ptf_crm_payables: [], ptf_crm_suppliers: [] };
  for (var i = 1; i <= 12; i++) many.ptf_crm_payables.push({ cd: 'P' + i, sup: 'تامین‌کنندهٔ ' + i, amount: 1000000, cur: 'IRR', pay: 'credit', settled: false, paid: [] });
  var doc2 = makeDoc();
  doc2.els.payablesRows = { innerHTML: '' };
  var sb2 = loadScoring(many, 'admin', doc2);
  sb2.buildSuppliers();
  sb2.ptfPayablesSearch('');
  var rowsHtml = doc2.els.payablesRows.innerHTML;
  T('۵.۹ سقف ۸ ردیف + راهنمای «و ۴ تأمین‌کنندهٔ دیگر»', (rowsHtml.match(/payable-debt-row/g) || []).length === 8 && rowsHtml.indexOf('تأمین‌کنندهٔ دیگر') > -1 && rowsHtml.indexOf('۴') > -1);

  /* RBAC */
  var sb3 = loadScoring(store, 'sales', makeDoc());
  T('۵.۱۰ نقشِ بدونِ دسترسی جعبهٔ بدهی را نمی‌بیند', sb3.buildSuppliers().indexOf('payablesBox') === -1);
})();

/* ═══════════ ۶) رفتارِ واقعی — customer-finance.js (جعبهٔ جدید) ═══════════ */
function custStore(n, withOpen) {
  var custs = [], invs = [];
  for (var i = 1; i <= n; i++) {
    custs.push({ cd: 'C' + i, co: 'مشتری ' + i });
    /* مشتری زوج = مطالباتِ باز؛ فرد = بدونِ فاکتور (ماندهٔ صفر) */
    if (!withOpen || i % 2 === 0) invs.push({ cd: 'CIN' + i, customerId: 'C' + i, no: 'SI-' + i, amount: 3000000 * i, status: 'open', isOfficial: true, payments: [] });
  }
  return { ptf_crm_customers: custs, ptf_crm_invoices: invs, ptf_crm_offers: [], ptf_crm_sales_returns: [], ptf_crm_case_receipts: [] };
}
function loadCust(store, role, doc) {
  var sb = {
    console: console, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    getData: function (k) { return store[k] || []; }, setData: function (k, v) { store[k] = v; return true; },
    curRole: function () { return role; }, isSenior: function () { return ['admin', 'chairman', 'ceo', 'commercial'].indexOf(role) > -1; },
    roleDef: function () { return { sellPrice: true, ledgerScope: (['admin', 'chairman', 'ceo', 'commercial', 'collector'].indexOf(role) > -1 ? 'all' : (role === 'accountant' ? 'official' : 'none')) }; },
    ptfCanSeeLedger: function (kind) {
      var scope = sb.roleDef().ledgerScope || 'all';
      if (scope === 'all') return true;
      if (scope === 'none') return false;
      return kind !== 'unofficial';
    },
    localStorage: { getItem: function () { return null; }, setItem: function () {} },
    document: doc || makeDoc(),
    setInterval: function () { return 0; }, clearInterval: function () {}, setTimeout: function () { return 0; },
    alert: function () {}, faDateTime: function () { return 'x'; }, genCode: function () { return 'X'; },
    escP: function (v) { return String(v == null ? '' : v); }, ptfNum: function (v) { return +v || 0; },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v).replace(/'/g, "\\'"); },
    goPanel: function () {}, finHubSet: function () {},
    buildCustomers: function () { return '<div id="custBase">BASE</div>'; },
    buildPetty: function () { return '<petty/>'; }
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(cf, sb, { filename: 'customer-finance.js' });
  return sb;
}
(function () {
  var store = custStore(4, false);
  var doc = makeDoc();
  var sb = loadCust(store, 'admin', doc);
  var html = sb.buildCustomers();

  T('۶.۱ جعبهٔ «حساب مشتریان» بالای فهرست ساخته می‌شود', html.indexOf('<details id="cfBox"') > -1 && html.indexOf('<div id="custBase">BASE</div>') > -1 && html.indexOf('<details id="cfBox"') < html.indexOf('custBase'));
  T('۶.۲ پیش‌فرض بسته است', !/<details id="cfBox"[^>]*\bopen\b/.test(html));
  T('۶.۳ کادر جستجو + ontoggle + tbody دارد', html.indexOf('id="cfBoxQ"') > -1 && html.indexOf('oninput="cfBoxSearch(this.value)"') > -1 && html.indexOf('ontoggle="ptfCfBoxToggle(this)"') > -1 && html.indexOf('id="cfBoxBody"') > -1);
  T('۶.۴ ستون‌ها: مشتری / مطالبات باز / اعتبار / عملیات', ['<th>مشتری</th>', '<th>مطالبات باز</th>', '<th>اعتبار نزد مشتری</th>'].every(function (h) { return html.indexOf(h) > -1; }));

  doc.els.cfBox = { open: false };
  doc.els.cfBoxBody = { innerHTML: 'PLACEHOLDER' };
  sb.ptfCfBoxLazy();
  T('۶.۵ تا بسته است محاسبه نمی‌شود', doc.els.cfBoxBody.innerHTML === 'PLACEHOLDER' && sb._cfBoxLazyPending === true);

  doc.els.cfBox.open = true;
  sb.ptfCfBoxToggle(doc.els.cfBox);
  var body = doc.els.cfBoxBody.innerHTML;
  T('۶.۶ نخستین بازکردن حساب‌ها را محاسبه می‌کند', sb._cfBoxLazyDone === true && body.indexOf('مشتری 1') > -1 && body.indexOf('cfOpen(') > -1, body.slice(0, 200));
  T('۶.۷ مطالباتِ باز به ریالِ فارسی نمایش داده می‌شود', body.indexOf('ریال') > -1 && /[۰-۹]/.test(body));

  sb.cfBoxSearch('مشتری 3');
  var b3 = doc.els.cfBoxBody.innerHTML;
  T('۶.۸ جست‌وجو فقط همان مشتری را نگه می‌دارد', b3.indexOf('مشتری 3') > -1 && b3.indexOf('مشتری 4') === -1 && b3.indexOf('مشتری 1') === -1, b3.slice(0, 200));
  sb.cfBoxSearch('C2');
  T('۶.۹ جست‌وجوی کد هم کار می‌کند', doc.els.cfBoxBody.innerHTML.indexOf('مشتری 2') > -1 && doc.els.cfBoxBody.innerHTML.indexOf('مشتری 4') === -1);
  sb.cfBoxSearch('zzz');
  T('۶.۱۰ جست‌وجوی بی‌نتیجه پیامِ صریح می‌دهد', doc.els.cfBoxBody.innerHTML.indexOf('موردی مطابق این جست‌وجو نیست') > -1);

  /* بدونِ جست‌وجو: فقط حساب‌های دارای مانده/اعتبار + راهنمای ماندهٔ صفر */
  var store2 = custStore(6, true);   /* فقط زوج‌ها فاکتور دارند ⇒ ۳ حساب باز، ۳ صفر */
  var doc2 = makeDoc();
  var sb2 = loadCust(store2, 'admin', doc2);
  sb2.buildCustomers();
  doc2.els.cfBox = { open: true };
  doc2.els.cfBoxBody = { innerHTML: '' };
  sb2.ptfCfBoxToggle(doc2.els.cfBox);
  var b = doc2.els.cfBoxBody.innerHTML;
  T('۶.۱۱ حساب‌های با ماندهٔ صفر در نمای اولیه ردیف نمی‌گیرند ولی شمارشان گفته می‌شود', b.indexOf('حساب با ماندهٔ صفر') > -1 && b.indexOf('مشتری 2') > -1 && !/<tr[^>]*><td><b>مشتری 1<\/b>/.test(b), b.slice(0, 240));
  sb2.cfBoxSearch('مشتری 1');
  T('۶.۱۲ با جست‌وجو همان حسابِ صفر هم پیدا می‌شود', doc2.els.cfBoxBody.innerHTML.indexOf('مشتری 1') > -1);

  /* سقف ردیف */
  var store3 = custStore(70, false);
  var doc3 = makeDoc();
  var sb3 = loadCust(store3, 'admin', doc3);
  sb3.buildCustomers();
  doc3.els.cfBox = { open: true };
  doc3.els.cfBoxBody = { innerHTML: '' };
  sb3.ptfCfBoxToggle(doc3.els.cfBox);
  var b3x = doc3.els.cfBoxBody.innerHTML;
  T('۶.۱۳ سقف ۶۰ ردیف + راهنمای «و ۱۰ حساب دیگر»', (b3x.match(/<tr/g) || []).length === 61 && b3x.indexOf('حساب دیگر') > -1 && b3x.indexOf('۱۰') > -1, 'tr=' + (b3x.match(/<tr/g) || []).length);

  /* RBAC */
  var sb4 = loadCust(custStore(2, false), 'sales', makeDoc());
  T('۶.۱۴ کارشناسِ فروش (ledgerScope=none) جعبه را نمی‌بیند', sb4.buildCustomers().indexOf('cfBox') === -1 && sb4.buildCustomers().indexOf('custBase') > -1);
  var sb5 = loadCust(custStore(2, false), 'accountant', makeDoc());
  T('۶.۱۵ حسابدار (ledgerScope=official) جعبه را می‌بیند', sb5.buildCustomers().indexOf('<details id="cfBox"') > -1);

  /* تداخل نداشتن با جعبهٔ هاب مالی */
  T('۶.۱۶ جعبهٔ هاب مالی همچنان در buildPetty است و id هایش جداست', sb.buildPetty().indexOf('cfFinanceHubBox') > -1 && sb.buildPetty().indexOf('id="cfSearch"') > -1 && html.indexOf('id="cfSearch"') === -1);
})();

console.log('\n— tester591 (' + VER + ': پنل‌های تاشو + جستجو — SUP/CUST-ACCOUNTS-BOX) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
