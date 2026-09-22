/* =====================================================================
   CHQ-OPEX-EDIT-LINK — v34.39.24 — tester679
   گزارش کارفرما: «در ثبت چک صادره و یا ویرایش چک صادره برای ارتباط آن با ماه
   گزینه‌ای در پنجره وجود ندارد که بتوان این موضوع را اصلاح کرد.»

   زمینه (دوباره‌شماری اجارهٔ چک‌محور — ARENA-RENT-BIMONTHLY-CHEQUE-DOUBLE-COUNT):
   - چک صادرهٔ اجاره در سررسید یک‌بار از خزانه کم می‌شود (chqout در treasury.js).
   - ردیف اجارهٔ «بدون چک» نیز جدا از چک از خزانه کم می‌شود (دستی همان لحظه،
     قالبی با تسویه). اگر چک به ردیف‌ها وصل نشده باشد ⇒ یک پول، دو خروج.
   - تا امروز تنها محل اتصال، فرم «ثبت چک» بود و آن هم با سه شرط پنهان می‌شد
     (ذی‌نفع=تامین‌کننده / نوع=ضمانت / نبود ردیفِ بدون چک)؛ «ویرایش چک» هیچ
     راهی برای اتصال نداشت و ثبت مجدد چک با همان صیادی هم به قفل دائمی صیاد
     می‌خورد ⇒ گپ واقعی UI.

   رفع (همین نسخه):
   - crm/opex.js: ptfOpexRowsForChequeLink (فهرست read-only) + ptfOpexChequeLinkRows
     (همگام‌سازی دوطرفه با یک نوشتن؛ ردیف چک دیگر ربوده نمی‌شود — skip + گزارش).
   - crm/cheque-panel.js: بخش «بابت کدام ماه‌های هزینه جاری؟» داخل مودال «ویرایش چک»
     برای چک صادرهٔ غیرضمانت/غیرشخصی + در فرم ثبت، حالت «تامین‌کننده» و «خالی» دیگر
     بی‌توضیح پنهان نمی‌شوند (راهنمای درجا).

   این تستر با vm همان دو ماژول واقعی را بار می‌کند و رفتار را می‌سنجد.
   ===================================================================== */
'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var ROOT = require('path').resolve(__dirname, '../..');

function readStore(s) { try { return JSON.parse(s.ptf_crm_opex || '[]'); } catch (e) { return []; } }

function makeContext(seed) {
  var store = {};
  Object.keys(seed).forEach(function (k) { store[k] = seed[k]; });
  var els = {};
  function el(id) {
    if (!els[id]) els[id] = { id: id, innerHTML: '', style: {}, value: (seed.__ui && seed.__ui[id] && seed.__ui[id].value) || '' };
    return els[id];
  }
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number,
    Date: Date, Promise: Promise, RegExp: RegExp, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN,
    alert: function (m) { (ctx.__alerts = ctx.__alerts || []).push(String(m)); },
    confirm: function () { return true; },
    prompt: function () { return 'دلیل تست'; },
    setTimeout: function (fn) { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    getData: function (k) { try { return JSON.parse(store[k] || 'null'); } catch (e) { return null; } },
    setData: function (k, v) { store[k] = JSON.stringify(v); },
    roleDef: function () { return { finance: true }; },
    curSession: function () { return { user: 'acc', name: 'حسابدار' }; },
    curRole: function () { return 'accountant'; },
    audit: function () {}, ptfToast: function () {}, genCode: function (p) { return p + '-T1'; },
    faDate: function () { return '1405/07/01'; }, faDateTime: function () { return '1405/07/01 10:00'; },
    ptfTodayISO: function () { return '2026-09-23'; },
    document: {
      getElementById: el,
      querySelectorAll: function () { return []; },
      addEventListener: function () {},
      createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; },
      body: { insertAdjacentHTML: function () {}, appendChild: function () {} },
      hidden: false, activeElement: null
    }
  };
  ctx.window = ctx;
  ctx.__store = store;
  ctx.__els = els;
  vm.createContext(ctx);
  return ctx;
}

function seedData(withRows) {
  return {
    ptf_crm_opex: JSON.stringify(withRows === false ? [] : [
      { cd: 'OPX-1', _opexRowId: 'R-A', cat: 'اجاره‌بها', amt: 50000000, month: '1405/05', desc: 'اجاره مرداد' },
      { cd: 'OPX-2', _opexRowId: 'R-B', cat: 'اجاره‌بها', amt: 50000000, month: '1405/06', tplId: 'TPL-1', chequeCd: 'CHQ-9', payHow: 'cheque' },
      { cd: 'OPX-3', _opexRowId: 'R-C', cat: 'سایر', amt: 1000, month: '1405/05', st: 'void' },
      { cd: 'OPX-4', _opexRowId: 'R-D', cat: 'حقوق و دستمزد', amt: 30000000, month: '1405/05', recurringKey: 'salary:SH1:1405/05' },
      { cd: 'OPX-5', _opexRowId: 'R-E', cat: 'کارمزد فاکتورساز', amt: 2000, month: '1405/05', fromCoverInvoice: true, coverInvoiceCd: 'INV-C' },
      { cd: 'OPX-6', _opexRowId: 'R-F', cat: 'اجاره‌بها', amt: 4000, month: '1404/01', st: 'void', chequeCd: 'CHQ-1' }
    ]),
    ptf_crm_settings: JSON.stringify({ opexTpl: [{ id: 'TPL-1', cat: 'اجاره‌بها', amt: 50000000, desc: 'اجاره‌بها' }] })
  };
}

/* ================= Part 1: opex.js — ptfOpexRowsForChequeLink + ptfOpexChequeLinkRows ================= */
(function () {
  var ctx = makeContext(seedData());
  vm.runInContext(fs.readFileSync(ROOT + '/crm/opex.js', 'utf8'), ctx, { filename: 'opex.js' });

  assert.strictEqual(typeof ctx.ptfOpexRowsForChequeLink, 'function', 'P1: ptfOpexRowsForChequeLink باید تعریف شده باشد');
  assert.strictEqual(typeof ctx.ptfOpexChequeLinkRows, 'function', 'P1: ptfOpexChequeLinkRows باید تعریف شده باشد');

  /* ۱) فهرست read-only: فقط ردیف دستیِ بدون چک «available» است؛ حقوق سهامدار،
        کارمزد پوششی، ردیف void و ردیف متصل به چک دیگر همه بیرون می‌مانند. */
  var r0 = ctx.ptfOpexRowsForChequeLink('CHQ-1');
  assert.deepStrictEqual(r0.available.map(function (x) { return x.cd; }), ['OPX-1'],
    'P1: available فقط ردیف دستی بدون چک باید باشد (حقوق/پوششی/void/چک‌دیگر حذف)');
  assert.strictEqual(r0.linked.length, 0, 'P1: CHQ-1 ابتدا هیچ ردیف متصلی ندارد');

  /* ۲) اتصال: ردیف A به CHQ-1 وصل می‌شود و پایدار ذخیره می‌شود */
  var r1 = ctx.ptfOpexChequeLinkRows('CHQ-1', ['R-A']);
  assert.ok(r1.ok && r1.linked === 1 && r1.unlinked === 0, 'P1: اتصال A به CHQ-1 باید ۱ وصل باشد');
  var after1 = readStore(ctx.__store).filter(function (x) { return x._opexRowId === 'R-A'; })[0];
  assert.strictEqual(after1.chequeCd, 'CHQ-1', 'P1: chequeCd روی ردیف باید بنشیند');
  assert.strictEqual(after1.payHow, 'cheque', 'P1: payHow=cheque روی ردیف باید بنشیند');

  /* ۳) ردیف متصل به چک دیگر هرگز ربوده نمی‌شود — skip + گزارش */
  var r2 = ctx.ptfOpexChequeLinkRows('CHQ-1', ['R-A', 'R-B']);
  assert.ok(r2.ok && r2.skipped.indexOf('OPX-2') > -1, 'P1: تلاش برای ربودن R-B (چک CHQ-9) باید skip و گزارش شود');
  var b = readStore(ctx.__store).filter(function (x) { return x._opexRowId === 'R-B'; })[0];
  assert.strictEqual(b.chequeCd, 'CHQ-9', 'P1: R-B باید همچنان متصل به CHQ-9 بماند');

  /* ۴) تکرار همان اتصال = هیچ (idempotent) */
  var r3 = ctx.ptfOpexChequeLinkRows('CHQ-1', ['R-A']);
  assert.ok(r3.ok && r3.linked === 0 && r3.unlinked === 0, 'P1: اتصال تکراری باید بدون نوشتن باشد');

  /* ۵) جدا کردن: فهرست خالی ⇒ همهٔ وصل‌های همین چک جدا می‌شوند */
  var r4 = ctx.ptfOpexChequeLinkRows('CHQ-1', []);
  assert.ok(r4.ok && r4.unlinked === 1, 'P1: جدا کردن باید یک ردیف را برگرداند');
  var after4 = readStore(ctx.__store).filter(function (x) { return x._opexRowId === 'R-A'; })[0];
  assert.strictEqual(after4.chequeCd, undefined, 'P1: بعد از جدا کردن، chequeCd باید حذف شده باشد');
  assert.strictEqual(after4.payHow, undefined, 'P1: بعد از جدا کردن، payHow=cheque باید حذف شده باشد');

  /* ۶) ردیف void (حتی با chequeCd قدیمی) هرگز دست نمی‌خورد */
  var f = readStore(ctx.__store).filter(function (x) { return x._opexRowId === 'R-F'; })[0];
  assert.strictEqual(f.chequeCd, 'CHQ-1', 'P1: ردیف void باید دست‌نخورده بماند');

  /* ۷) فراخوانی بی‌chequeCd رد می‌شود (اکشن بی‌صدا شکست نمی‌خورد) */
  var r5 = ctx.ptfOpexChequeLinkRows('', ['R-A']);
  assert.strictEqual(r5.ok, false, 'P1: بدون chequeCd باید ok=false برگردد');

  /* ۸) linked list چک دیگر درست برمی‌گردد */
  var r6 = ctx.ptfOpexRowsForChequeLink('CHQ-9');
  assert.deepStrictEqual(r6.linked.map(function (x) { return x.cd; }), ['OPX-2'], 'P1: linked CHQ-9 باید R-B باشد');

  console.log('PASS tester679 Part 1: opex.js link/unlink contract (۸ سنجه)');
  return Promise.resolve();
})()

/* ================= Part 2: opex.js + cheque-panel.js — فرم ویرایش + فرم ثبت ================= */
.then(function () {
  var seed = seedData();
  seed.__ui = { ptfChNKind: { value: 'finance' }, ptfChNParty: { value: 'other' } };
  var ctx = makeContext(seed);
  ctx.window._ptfChNFormDir = 'issued';
  vm.runInContext(fs.readFileSync(ROOT + '/crm/opex.js', 'utf8'), ctx, { filename: 'opex.js' });
  vm.runInContext(fs.readFileSync(ROOT + '/crm/cheque-panel.js', 'utf8'), ctx, { filename: 'cheque-panel.js' });

  assert.strictEqual(typeof ctx.ptfChequeEditOpexReload, 'function', 'P2: ptfChequeEditOpexReload باید تعریف شده باشد');

  /* ۱) ویرایش چکی که ردیف متصل دارد: بخش «متصل» + بخش «بدون چک» هر دو رندر شوند */
  ctx.ptfChequeEditOpexReload('CHQ-9');
  var w = ctx.__els['chE_OpexWrap'];
  assert.ok(w && w.innerHTML.indexOf('متصل به این چک') > -1 && w.innerHTML.indexOf('OPX-2') > -1, 'P2: ردیف متصل R-B باید با تیک در ویرایش CHQ-9 دیده شود');
  assert.ok(w.innerHTML.indexOf('ثبت‌شده و بدون چک') > -1 && w.innerHTML.indexOf('OPX-1') > -1, 'P2: ردیف بدون چک R-A باید به‌عنوان گزینه اتصال دیده شود');
  assert.ok(w.innerHTML.indexOf('ptf-chE-opex') > -1, 'P2: چک‌باکس‌های اتصال باید در مودال ویرایش باشند');

  /* ۲) ویرایش چک در دادهٔ خالی: پیام راهنما، نه پنهان‌شدن (حالت خالی فقط وقتی است
        که هیچ ردیف متصل و هیچ ردیف بدون چکی در کل داده نیست) */
  var seedE = seedData(false);
  var ctxE = makeContext(seedE);
  vm.runInContext(fs.readFileSync(ROOT + '/crm/opex.js', 'utf8'), ctxE, { filename: 'opex.js' });
  vm.runInContext(fs.readFileSync(ROOT + '/crm/cheque-panel.js', 'utf8'), ctxE, { filename: 'cheque-panel.js' });
  ctxE.ptfChequeEditOpexReload('CHQ-9');
  var w2 = ctxE.__els['chE_OpexWrap'];
  assert.ok(w2.innerHTML.indexOf('قابل اتصالی') > -1, 'P2: حالت خالی ویرایش باید پیام راهنما داشته باشد');

  /* ۳) فرم ثبت — ذی‌نفع تامین‌کننده: راهنمای «سایر» به‌جای پنهان‌شدن بی‌توضیح */
  ctx.__els['ptfChNParty'] = { id: 'ptfChNParty', value: 'sup', innerHTML: '', style: {} };
  ctx.ptfChNOpexReload();
  var w3 = ctx.__els['ptfChNOpexWrap'];
  assert.strictEqual(w3.style.display, '', 'P2: بخش opex برای چک تأمین‌کننده نباید کاملاً پنهان شود');
  assert.ok(w3.innerHTML.indexOf('تامین‌کننده دارای مطالبه') > -1 && w3.innerHTML.indexOf('سایر') > -1,
    'P2: راهنمای چک تأمین‌کننده باید مسیر «ذی‌نفع = سایر» را توضیح دهد');

  /* ۴) فرم ثبت — ذی‌نفع «سایر» با داده: فهرست ردیف‌ها + ماه‌های آیندهٔ قالب */
  ctx.__els['ptfChNParty'] = { id: 'ptfChNParty', value: 'other', innerHTML: '', style: {} };
  ctx.ptfChNOpexReload();
  var w4 = ctx.__els['ptfChNOpexWrap'];
  assert.ok(w4.innerHTML.indexOf('بابت کدام ماه‌های هزینه جاری') > -1, 'P2: عنوان بخش اتصال در فرم ثبت باید باشد');
  assert.ok(w4.innerHTML.indexOf('ptf-ch-opex"') > -1, 'P2: ردیف ثبت‌شدهٔ بدون چک باید چک‌باکس داشته باشد');
  assert.ok(w4.innerHTML.indexOf('ptf-ch-opex-future') > -1, 'P2: ماه‌های آیندهٔ قالب تکرارشونده باید پیشنهاد اتصال بیایند');

  /* ۵) فرم ثبت — بدون هیچ ردیف/قالب: پیام راهنما، نه پنهان‌شدن بی‌توضیح (ریشهٔ گزارش کارفرما) */
  var seed2 = seedData(false);
  seed2.ptf_crm_settings = JSON.stringify({}); /* بدون قالب تکرارشونده */
  seed2.__ui = { ptfChNKind: { value: 'finance' }, ptfChNParty: { value: 'other' } };
  var ctx2 = makeContext(seed2);
  ctx2.window._ptfChNFormDir = 'issued';
  vm.runInContext(fs.readFileSync(ROOT + '/crm/opex.js', 'utf8'), ctx2, { filename: 'opex.js' });
  vm.runInContext(fs.readFileSync(ROOT + '/crm/cheque-panel.js', 'utf8'), ctx2, { filename: 'cheque-panel.js' });
  ctx2.ptfChNOpexReload();
  var w5 = ctx2.__els['ptfChNOpexWrap'];
  assert.strictEqual(w5.style.display, '', 'P2: حالت خالی فرم ثبت نباید پنهان شود');
  assert.ok(w5.innerHTML.indexOf('هیچ ردیف هزینه') > -1, 'P2: حالت خالی فرم ثبت باید توضیح دهد چرا چیزی برای اتصال نیست');

  console.log('PASS tester679 Part 2: edit-dialog + new-form rendering (۵ سنجه)');
})
/* ================= Part 3: قراردادهای متنی — سیم‌کشی save + ثبت در گیت ================= */
.then(function () {
  var panel = fs.readFileSync(ROOT + '/crm/cheque-panel.js', 'utf8');
  var opex = fs.readFileSync(ROOT + '/crm/opex.js', 'utf8');
  var gate = fs.readFileSync(ROOT + '/_tools/uat/run-ci-gate.js', 'utf8');

  /* مودال ویرایش: wrap فقط برای صادرهٔ غیرضمانت/غیرشخصی تزریق می‌شود */
  assert.ok(panel.indexOf('id="chE_OpexWrap"') > -1, 'P3: مودال ویرایش باید wrap اتصال داشته باشد');
  assert.ok(panel.indexOf("c.direction === 'issued' && c.kind !== 'guarantee' && ownOfEdit !== 'personal'") > -1,
    'P3: شرط واجد شرایط بودن ویرایش (صادره/غیرضمانت/غیرشخصی) باید صریح باشد');
  /* ذخیره: همگام‌سازی دوطرفه + به‌روزرسانی opexRowIds چک + عدم سکوت در شکست */
  assert.ok(panel.indexOf('window.ptfOpexChequeLinkRows(cd, opexIds)') > -1, 'P3: save ویرایش باید ptfOpexChequeLinkRows را صدا بزند');
  assert.ok(panel.indexOf('patch.opexRowIds = opexIds.slice()') > -1, 'P3: save ویرایش باید opexRowIds چک را ذخیره کند');
  assert.ok(panel.indexOf("ماژول هزینه‌های جاری بارگذاری نشده است") > -1, 'P3: نبود ماژول opex باید با alert گزارش شود (بدون سکوت)');
  assert.ok(panel.indexOf('جمع ماه‌های هزینهٔ انتخاب‌شده') > -1, 'P3: نابرابری جمع تیک‌ها با مبلغ چک باید تأیید بگیرد');
  /* فرم ثبت: دو راهنمای جدید */
  assert.ok(panel.indexOf('تامین‌کننده دارای مطالبه') > -1, 'P3: راهنمای ذی‌نفع تامین‌کننده باید در فرم ثبت باشد');
  assert.ok(panel.indexOf('هیچ ردیف هزینهٔ «ثبت‌شده و بدون چک»') > -1, 'P3: راهنمای حالت خالی باید در فرم ثبت باشد');
  /* opex.js: قراردادهای جدید */
  assert.ok(opex.indexOf('window.ptfOpexRowsForChequeLink') > -1 && opex.indexOf('window.ptfOpexChequeLinkRows') > -1, 'P3: opex.js باید دو API جدید را داشته باشد');
  assert.ok(opex.indexOf("x.chequeCd && x.chequeCd !== chequeCd") > -1, 'P3: گارد «ربودن ردیف چک دیگر ممنوع» باید در opex.js باشد');
  /* ثبت در گیت CI */
  assert.ok(gate.indexOf('tester679-v34.39.24-cheque-opex-edit-link.js') > -1, 'P3: این تستر باید در run-ci-gate ثبت شده باشد');

  console.log('PASS tester679 Part 3: source contracts (۹ سنجه)');
})
.then(function () { console.log('PASS tester679 — CHQ-OPEX-EDIT-LINK همهٔ بخش‌ها سبز'); })
.catch(function (e) { console.error('FAIL tester679:', e && e.message || e); process.exit(1); });
