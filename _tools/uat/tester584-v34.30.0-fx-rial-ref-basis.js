#!/usr/bin/env node
'use strict';
/* tester584 — v34.37.3 (FX-RIAL-REF): «پرونده‌ای که پیشنهاد برنده‌اش ارزی است و یک
 * پیشنهاد ریالی هم قبلاً برایش ثبت شده، هنگام ارجاع برای فاکتور باید همان نسخهٔ
 * ریالیِ ثبت‌شده را به بخش فاکتورها بفرستد تا حسابدار فاکتور ریالی را با نرخ
 * تسعیر درست بزند.»
 *
 * ریشه (RCA): تا پیش از این، تشخیص نسخهٔ ریالی در sfInvoiceRefCommit فقط دو راه
 * داشت: شمارهٔ صریح (ریال‌بِیزیس‌نُو — که فقط مسیر «ساخت ریالی» می‌دهد) یا لینک
 * ریال‌اُف (فقط ابزار تبدیل 💱 می‌سازد). پیشنهاد ریالی مستقلی که کاربر عادی
 * برای همان درخواست ثبت کرده هیچ‌کدام را ندارد → پیدا نمی‌شد → سامانه ارجاع را
 * به دیالوگ «ساخت نسخهٔ ریالی تازه» می‌فرستاد؛ نتیجه: نسخهٔ ریالی واقعیِ
 * داده‌شده به کارفرما نادیده گرفته می‌شد و حسابدار مبنای غلط/تکراری می‌گرفت.
 *
 * راه‌حل: هستهٔ خالص sfInvoiceRialResolve (صریح ← همراه ← ثبت‌شدهٔ مستقل؛
 * تک‌نماینده خودکار، چندنامزد → انتخاب کاربر) + نرخ تسعیر با فال‌بک برگرفته از
 * جمع دو سند (sfInvoiceRialRateOf) + ذخیرهٔ ریال‌بِیزیس‌کایند/ریال‌ریت‌دِرایود در
 * اینو‌ریف + نمایش مبنای ریالی در هر دو پنل فاکتورها (آربی‌ای‌سی و اُفیشال).
 *
 * رفتاری: برش واقعی تابع‌ها از crm/salesfiles.js در vm با استاب‌ها (الگوی
 * تستر583) — سنجه‌های مسیر کامل ارجاع (sfInvoiceRefCommit) برای پنج حالت +
 * فیلترهای نامزدی + نرخ. قرارداد ایستا: سیم‌کشی پنل‌ها و دیالوگ انتخاب. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

var salesSrc = fs.readFileSync(path.join(ROOT, 'crm/salesfiles.js'), 'utf8');

/* ── برش هستهٔ تشخیص + نرخ (از تعریف تا نشانگر پایان) ── */
var i0 = salesSrc.indexOf('window.sfInvoiceRialResolve');
var i1 = salesSrc.indexOf('/*--SF-FXRIALREF-END--*/');
T('SRC: هستهٔ تشخیص (sfInvoiceRialResolve + sfInvoiceRialRateOf) در salesfiles.js وجود دارد', i0 > -1 && i1 > i0);
var resolveSlice = salesSrc.slice(i0, i1 + '/*--SF-FXRIALREF-END--*/'.length);

/* ── برش خود تابع ارجاع (از تعریف تا کامیتِ موفقیتِ مسیر عادی) ──
   v34.37.3 (INV-REF-CONFIRM): منطق حل‌وفصل به sfInvoiceRefPlan منتقل شد و
   sfInvoiceRefCommit آن را صدا می‌زند؛ برش از همان‌جا شروع می‌شود تا هر دو داخل
   هارنس باشند. رفتار و خروجی commit عیناً همان است. */
var c0 = salesSrc.indexOf('window.sfInvoiceRefPlan');
var c1 = salesSrc.indexOf('/* v34.7.76 (INV-RIAL-BASIS): موفقیت ارجاع');
T('SRC: برش sfInvoiceRefCommit پیدا شد', c0 > -1 && c1 > c0);
var commitSlice = salesSrc.slice(c0, c1);

/* ── هارنس: بوت هر دو برش در یک زمینه با استاب‌های حداقلی ── */
function boot(deal, offers) {
  var saved = { offers: null, files: null }, notes = [];
  var ctx = {
    console: console, JSON: JSON, Math: Math, Array: Array, Object: Object, String: String, Number: Number, Date: Date,
    sfAll: function () { return [deal]; },
    isSenior: function () { return true; },
    getData: function (k) { return k === 'ptf_crm_offers' ? offers : []; },
    setData: function (k, v) { if (k === 'ptf_crm_offers') saved.offers = v; },
    curSession: function () { return { user: 't', name: 'تستر' }; },
    roleDef: function () { return { lb: 'مدیر' }; },
    faDate: function () { return '۱۴۰۵/۰۶/۱۱'; },
    faDateTime: function () { return '۱۴۰۵/۰۶/۱۱ ۱۰:۰۰'; },
    sfAwardEnsure: function () { return []; },
    sfSave: function (list) { saved.files = list; },
    audit: function (a, b) { notes.push(b); },
    notify: function (n) { notes.push('NOTIFY:' + (n.title || '') + '|' + (n.body || '')); },
    alert: function () {}, confirm: function () { return false; },
    window: {}
  };
  ctx.window = ctx;
  ctx.ptfEntitySaveCollection = function (k, v) { if (k === 'ptf_crm_offers') saved.offers = v; };
  /* نمای پرونده: همهٔ پیشنهادهای همان درخواست (هم‌خوان با رفتار واقعی) */
  ctx.ptfSalesFileOffers = function (r) { return offers.filter(function (o) { return o && r && o.inqNo === r.inqNo; }); };
  vm.createContext(ctx);
  vm.runInContext(resolveSlice, ctx, { filename: 'fxrial-resolve.js' });
  vm.runInContext(commitSlice, ctx, { filename: 'fxrial-commit.js' });
  return { ctx: ctx, saved: saved, notes: notes };
}

/* ═══ ① اثبات ریشه: منطق قدیمی پیشنهاد ریالی مستقل را پیدا نمی‌کرد ═══ */
(function () {
  var wonFx = { no: 'CO-100', kind: 'CO', currency: 'EUR', inqNo: 'INQ-1', st: 'won', items: [{ qty: 2, price: 1000 }] };
  var rialReg = { no: 'CO-101', kind: 'CO', currency: 'IRR', inqNo: 'INQ-1', st: 'sent', items: [{ qty: 2, price: 1120000000 }] };
  var offers = [wonFx, rialReg];
  var oldFind = offers.filter(function (x) { return x && (x.no === undefined || x.rialOf === wonFx.no); })[0] || null;
  T('ROOT: منطق قدیمی (صریح/ریال‌اُف) پیشنهاد ریالی ثبت‌شده را نمی‌دید → ارجاع به ساخت نسخهٔ تازه می‌رفت', oldFind === null);
})();

/* ═══ ② ارجاع با پیشنهاد ریالی ثبت‌شدهٔ تک‌نماینده — خودکار همان مبنا می‌شود ═══ */
(function () {
  var deal = { cd: 'D-1', inqNo: 'INQ-1', wonOffer: 'CO-100', buyerCo: 'کارفرما', timeline: [] };
  var wonFx = { no: 'CO-100', kind: 'CO', currency: 'EUR', inqNo: 'INQ-1', st: 'won', items: [{ qty: 2, price: 1000 }] };
  var rialReg = { no: 'CO-101', kind: 'CO', currency: 'IRR', inqNo: 'INQ-1', st: 'sent', items: [{ qty: 2, price: 1120000000 }] };
  var h = boot(deal, [wonFx, rialReg]);
  var res = h.ctx.sfInvoiceRefCommit('D-1');
  T('REG: ارجاع موفق — بدون دیالوگ ساخت ریالی', res && res.ok === true, JSON.stringify(res));
  var wo = h.saved.offers.filter(function (x) { return x.no === 'CO-100'; })[0];
  T('REG: اینو‌ریف روی پیشنهاد ارزی با مبنای ریالیِ ثبت‌شده نوشته شد', wo && wo.invRef && wo.invRef.rialBasis === 'CO-101', JSON.stringify(wo && wo.invRef));
  T('REG: نوع مبنا «ثبت‌شده» است (برای برچسب پنل‌ها)', wo && wo.invRef && wo.invRef.rialBasisKind === 'registered');
  T('REG: نرخ تسعیر برگرفته از جمع دو سند = ۱٬۱۲۰٬۰۰۰ ریال', wo && wo.invRef && Math.abs(+wo.invRef.rialRate - 1120000) < 0.001, String(wo && wo.invRef && wo.invRef.rialRate));
  T('REG: برچسب «برگرفته» ست شده (نمایش صادقانه به حسابدار)', wo && wo.invRef && wo.invRef.rialRateDerived === true);
  T('REG: جمع ریالی مبنا = جمع اقلام سند ریالی', wo && wo.invRef && wo.invRef.rialTotal === 2240000000);
  var tl = (h.saved.files && h.saved.files[0] || {}).timeline || [];
  T('REG: تایم‌لاین پرونده مبنا و برچسب پیشنهاد ثبت‌شده را ثبت کرد', tl.some(function (e) { return e.tx.indexOf('CO-101') > -1 && e.tx.indexOf('پیشنهاد ریالی ثبت‌شده') > -1; }), JSON.stringify(tl));
  T('REG: اعلان حسابدار نرخ تسعیر برگرفته را دارد', h.notes.some(function (n) { return n.indexOf('NOTIFY:') === 0 && n.indexOf('نرخ تسعیر') > -1 && n.indexOf('برگرفته از جمع سند ریالی') > -1; }), JSON.stringify(h.notes));
})();

/* ═══ ③ اولویت‌ها: همراه(ریال‌اُف) بر ثبت‌شده، صریح بر همه ═══ */
(function () {
  var deal = { cd: 'D-2', inqNo: 'INQ-2', wonOffer: 'CO-200', buyerCo: 'ک', timeline: [] };
  var wonFx = { no: 'CO-200', kind: 'CO', currency: 'USD', inqNo: 'INQ-2', st: 'won', items: [{ qty: 1, price: 1000 }] };
  var comp = { no: 'CO-201', kind: 'CO', currency: 'IRR', rialOf: 'CO-200', inqNo: 'INQ-2', items: [{ qty: 1, price: 900000000 }], fxConvert: { rate: 900000 } };
  var rialReg = { no: 'CO-202', kind: 'CO', currency: 'IRR', inqNo: 'INQ-2', st: 'sent', items: [{ qty: 1, price: 950000000 }] };
  var r = boot(deal, [wonFx, comp, rialReg]).ctx.sfInvoiceRialResolve(deal, [wonFx, comp, rialReg], wonFx);
  T('PRIO: نسخهٔ همراه (ریال‌اُف) بر پیشنهاد ریالی مستقل مقدم است', r.comp && r.comp.no === 'CO-201' && r.kind === 'companion');
  var r2 = boot(deal, [wonFx, comp, rialReg]).ctx.sfInvoiceRialResolve(deal, [wonFx, comp, rialReg], wonFx, 'CO-202');
  T('PRIO: شمارهٔ صریح (انتخاب کاربر/مسیر ساخت) بر همه مقدم است', r2.comp && r2.comp.no === 'CO-202' && r2.kind === 'explicit');
  /* نرخ صریح ابزار تبدیل بر نرخ برگرفته مقدم است */
  var rate = boot(deal, []).ctx.sfInvoiceRialRateOf(comp, 1000, 900000000);
  T('PRIO: نرخ صریح اف‌ایکس‌کانورت استفاده می‌شود (نه برگرفته)', rate.rate === 900000 && rate.derived === false);
})();

/* ═══ ④ چند نامزد ریالی → انتخاب کاربر (پیک‌ریال) و سپس ارجاع با انتخاب ═══ */
(function () {
  var deal = { cd: 'D-3', inqNo: 'INQ-3', wonOffer: 'CO-300', buyerCo: 'ک', timeline: [] };
  var wonFx = { no: 'CO-300', kind: 'CO', currency: 'EUR', inqNo: 'INQ-3', st: 'won', items: [{ qty: 1, price: 2000 }] };
  var c1 = { no: 'CO-301', kind: 'CO', currency: 'IRR', inqNo: 'INQ-3', st: 'sent', items: [{ qty: 1, price: 2100000000 }], t: '۱۴۰۵/۰۵/۰۱' };
  var c2 = { no: 'CO-302', kind: 'TC', inqNo: 'INQ-3', st: 'draft', items: [{ qty: 1, price: 2200000000 }] }; /* TC بدون ارز = ریالی */
  var h = boot(deal, [wonFx, c1, c2]);
  var res = h.ctx.sfInvoiceRefCommit('D-3');
  T('PICK: دو نامزد → ارجاع متوقف و فهرست نامزدها برمی‌گردد', res && res.ok === false && res.why === 'pick_rial' && res.candidates.length === 2, JSON.stringify(res));
  T('PICK: جمع هر نامزد برای نمایش در دیالوگ محاسبه شده', res.candidates[0].total === 2100000000 && res.candidates[1].total === 2200000000);
  var res2 = h.ctx.sfInvoiceRefCommit('D-3', 'CO-302');
  var wo = h.saved.offers.filter(function (x) { return x.no === 'CO-300'; })[0];
  T('PICK: ارجاع با شمارهٔ انتخابی کاربر موفق است', res2 && res2.ok === true);
  T('PICK: مبنای ریالی همان سند انتخابی + نوع صریح است', wo && wo.invRef && wo.invRef.rialBasis === 'CO-302' && wo.invRef.rialBasisKind === 'explicit');
})();

/* ═══ ⑤ فیلترهای نامزدی: باخت/ریال‌اُفِ دیگری/فنی/ارزی کنار می‌روند ═══ */
(function () {
  var deal = { cd: 'D-4', inqNo: 'INQ-4', wonOffer: 'CO-400', buyerCo: 'ک', timeline: [] };
  var wonFx = { no: 'CO-400', kind: 'CO', currency: 'EUR', inqNo: 'INQ-4', st: 'won', items: [{ qty: 1, price: 100 }] };
  var lostRial = { no: 'CO-401', kind: 'CO', currency: 'IRR', inqNo: 'INQ-4', st: 'lost', items: [{ qty: 1, price: 1 }] };
  var otherComp = { no: 'CO-402', kind: 'CO', currency: 'IRR', rialOf: 'CO-999', inqNo: 'INQ-4', items: [{ qty: 1, price: 2 }] };
  var tech = { no: 'TO-403', kind: 'TO', inqNo: 'INQ-4', items: [] };
  var fxOther = { no: 'CO-404', kind: 'CO', currency: 'USD', inqNo: 'INQ-4', st: 'sent', items: [{ qty: 1, price: 50 }] };
  var onlyRial = { no: 'CO-405', kind: 'CO', currency: 'IRR', inqNo: 'INQ-4', st: 'sent', items: [{ qty: 1, price: 100000000 }] };
  var all = [wonFx, lostRial, otherComp, tech, fxOther, onlyRial];
  var r = boot(deal, all).ctx.sfInvoiceRialResolve(deal, all, wonFx);
  T('FILTER: فقط سند ریالی سالم نامزد است (باخت/همراه دیگری/فنی/ارزی رد شدند)', r.comp && r.comp.no === 'CO-405' && r.kind === 'registered', JSON.stringify(r));
  /* بدون هیچ نامزدی → مسیر قبلی ساخت نسخهٔ ریالی (نید‌ریال) */
  var h = boot(deal, [wonFx, lostRial, otherComp, tech, fxOther]);
  var res = h.ctx.sfInvoiceRefCommit('D-4');
  T('FALLBACK: بدون نسخهٔ ریالی → همان مسیر نرخ‌گیری و ساخت ریالی (بدون تغییر)', res && res.ok === false && res.why === 'need_rial', JSON.stringify(res));
})();

/* ═══ ⑥ حالت‌های مرزی: برندهٔ ریالی، ارجاع تکراری، نرخ صفر ═══ */
(function () {
  var deal = { cd: 'D-5', inqNo: 'INQ-5', wonOffer: 'CO-500', buyerCo: 'ک', timeline: [] };
  var wonRial = { no: 'CO-500', kind: 'CO', currency: 'IRR', inqNo: 'INQ-5', st: 'won', items: [{ qty: 3, price: 1000000 }] };
  var h = boot(deal, [wonRial]);
  var res = h.ctx.sfInvoiceRefCommit('D-5');
  var wo = h.saved.offers.filter(function (x) { return x.no === 'CO-500'; })[0];
  T('IRR: پیشنهاد برندهٔ ریالی → خود سند مبنا است، بدون نرخ/برچسب', res.ok === true && wo.invRef.rialBasis === 'CO-500' && wo.invRef.rialRate === 0 && wo.invRef.rialRateDerived === false);
  var res2 = h.ctx.sfInvoiceRefCommit('D-5');
  T('GUARD: ارجاع تکراری همچنان بسته است', res2.ok === false && res2.why === 'already');
  var zero = h.ctx.sfInvoiceRialRateOf(null, 0, 0);
  T('RATE: بدون مبنا/جمع صفر → نرخ صفر', zero.rate === 0 && zero.derived === false);
})();

/* ═══ ⑦ قراردادهای ایستا: سیم‌کشی مسیر ارجاع و پنل‌ها ═══ */
(function () {
  T('WIRE: sfInvoiceRef مسیر پیک‌ریال را به دیالوگ انتخاب می‌فرستد', /if \(res\.why === 'pick_rial'\) \{\s*sfInvoiceRefPickRial\(cd, res\);/.test(salesSrc));
  T('WIRE: دیالوگ انتخاب نامزد + تأیید (sfInvoiceRefPickRial/Do) تعریف شده', salesSrc.indexOf('window.sfInvoiceRefPickRial = function') > -1 && salesSrc.indexOf('window.sfInvoiceRefPickRialDo = function') > -1);
  /* v34.37.3: انتخاب سند ریالی «تاییدِ ارجاع» نیست — مودال تایید با همان شماره باز
   می‌شود و نوشتن فقط پس از تایید صریح کاربر انجام می‌گیرد. */
T('WIRE: تأیید دیالوگ انتخاب، مودال تایید را با شمارهٔ انتخابی باز می‌کند', /sfInvoiceRefPickRialDo[\s\S]{0,900}sfInvoiceRefConfirm\(cd, no\)/.test(salesSrc));
  T('WIRE: اینو‌ریف فیلدهای ریال‌بِیزیس‌کایند و ریال‌ریت‌دِرایود را ذخیره می‌کند', salesSrc.indexOf('rialRateDerived: rialRateDerived, rialBasisKind: compKind') > -1);
  T('WIRE: برچسب نوع «پیشنهاد ریالی ثبت‌شدهٔ پرونده» در تایم‌لاین/اعلان ساخته می‌شود', salesSrc.indexOf("compKind === 'registered' ? ' (پیشنهاد ریالی ثبت‌شدهٔ پرونده)'") > -1);
  var rbac = fs.readFileSync(path.join(ROOT, 'crm/rbac.js'), 'utf8');
  T('PANEL: پنل فاکتورها (آربی‌ای‌سی) کادر مبنای ریالی را رندر می‌کند', rbac.indexOf('مبنای ریالی صدور فاکتور') > -1 && rbac.indexOf('rialBasisHtml') > -1);
  T('PANEL: نرخ با فال‌بک به اینو‌ریف.ریال‌ریت + لینک PDF نسخه ریالی', /rbRate = \(compO && compO\.fxConvert && \+compO\.fxConvert\.rate > 0\) \? \+compO\.fxConvert\.rate : \(\+o\.invRef\.rialRate \|\| 0\)/.test(rbac) && /offerPrint\(\\'' \+ ptfOnClickArg\(compO\.no\)/.test(rbac));
  var ofi = fs.readFileSync(path.join(ROOT, 'crm/official-invoice-v2.js'), 'utf8');
  T('PANEL: پنل رسمی — فال‌بک نرخ (آربی‌ریت‌شون) + برچسب برگرفته', ofi.indexOf('rbRateShown') > -1 && ofi.indexOf('rbDerived') > -1 && ofi.indexOf('(برگرفته از جمع سند ریالی)') > -1);
})();

console.log('=== tester584: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
