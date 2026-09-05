#!/usr/bin/env node
'use strict';
/* ═══ tester596 — v34.37.1 (INV-REF-CONFIRM + INV-REF-UNDO) ═══
   گزارش کارفرما: «در زمان ارجاع فاکتور از پرونده فروش تایید کاربر اخذ نمی‌شود و با
   زدن دکمهٔ ارجاع سریعاً به قسمت فاکتورها می‌رود و در صورت اشتباه امکان بازگرداندن
   از قسمت فاکتورها هم وجود ندارد.»

   ریشه‌ها:
   R1 sfInvoiceRef مستقیم commit می‌کرد؛ تنها دیالوگِ مسیر، پرسشِ «پیامک؟» بود که
      *بعد* از ثبتِ قطعی می‌آمد و کاربر آن را تاییدِ ارجاع می‌فهمید.
   R2 invRef فقط نوشته می‌شد و هیچ‌جای CRM پاکش نمی‌کرد.
   R3 تنها فرمانِ سروریِ توانا به پاک کردنش (revoke_orphan_delete) با وجود پروندهٔ
      فعال همیشه ۴۰۹ می‌داد — و ارجاع اصلاً فقط از داخل پرونده ممکن است ⇒ در بسته.

   این تستر رفتاری است: برشِ واقعیِ توابع از crm/salesfiles.js در vm اجرا می‌شود و
   «آیا بدون تایید چیزی نوشته شد؟» واقعاً سنجیده می‌شود. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var sfSrc = read('crm/salesfiles.js');
var sdClient = read('crm/sales-domain-v2.js');
var sdServer = read('api/sales-domain.php');
var rbacSrc = read('crm/rbac.js');
var invPanel = read('crm/official-invoice-v2.js'); /* پنلِ زندهٔ فاکتورها */

/* ── برش زنجیرهٔ ارجاع: plan → confirm → do → commit → finish ── */
var i0 = sfSrc.indexOf('window.sfInvoiceRefPlan');
var i1 = sfSrc.indexOf('/* v34.31.0 (FX-RIAL-REF): چند پیشنهاد ریالی ثبت‌شده');
T('۰.۱ برش زنجیرهٔ ارجاع پیدا شد', i0 > -1 && i1 > i0);
var refSlice = sfSrc.slice(i0, i1);

function boot(opts) {
  opts = opts || {};
  var deal = opts.deal || { cd: 'D-1', inqNo: 'INQ-77', wonOffer: 'CO-100', buyerCo: 'پتروشیمی نمونه', timeline: [] };
  var offers = opts.offers || [{ no: 'CO-100', kind: 'CO', currency: 'IRR', inqNo: 'INQ-77', st: 'won', items: [{ qty: 2, price: 5000000 }] }];
  var state = { writes: [], notifies: [], sms: [], alerts: [], toasts: [], html: [], rendered: 0, saved: null };
  var el = {};
  var ctx = {
    console: console, JSON: JSON, Math: Math, Date: Date, Array: Array, Object: Object, String: String, Number: Number,
    window: {},
    document: {
      getElementById: function (id) { return el[id] || null; },
      querySelector: function () { return null; },
      body: { insertAdjacentHTML: function (pos, h) { state.html.push(h); } }
    },
    sfAll: function () { return [deal]; },
    sfSave: function (l) { state.saved = l; state.writes.push('sfSave'); },
    sfAwardEnsure: function () {},
    isSenior: function () { return opts.senior !== false; },
    roleDef: function () { return { lb: 'مدیر بازرگانی' }; },
    curSession: function () { return { name: 'کاربر آزمون', user: 'u1' }; },
    faDate: function () { return '1405/06/14'; },
    faDateTime: function () { return '1405/06/14 10:00'; },
    getData: function (k) { return k === 'ptf_crm_offers' ? offers : (k === 'ptf_crm_users' ? [{ roleId: 'accountant', mobile: '09120000000', name: 'حسابدار' }] : []); },
    setData: function (k, v) { state.writes.push('setData:' + k); if (k === 'ptf_crm_offers') offers = v; },
    audit: function () {},
    addLog: function () {},
    alert: function (m) { state.alerts.push(String(m)); },
    notify: function (o) { state.notifies.push(o); },
    ptfToast: function (m) { state.toasts.push(String(m)); },
    smsSendSingle: function (mob, body, cb) { state.sms.push(mob); if (cb) cb({ ok: true, sent: true }); },
    renderDeals: function () { state.rendered++; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    sfInvoiceRefRialPrompt: function () { state.writes.push('rialPrompt'); },
    sfInvoiceRefPickRial: function () { state.writes.push('pickRial'); }
  };
  ctx.window.ptfEntitySaveCollection = function (k, v) { state.writes.push('save:' + k); if (k === 'ptf_crm_offers') offers = v; };
  vm.createContext(ctx);
  vm.runInContext(refSlice, ctx, { filename: 'invref-slice.js' });
  Object.keys(ctx.window).forEach(function (k) { if (typeof ctx.window[k] === 'function' && !ctx[k]) ctx[k] = ctx.window[k]; });
  return { ctx: ctx, state: state, el: el, offers: function () { return offers; }, deal: deal };
}

/* ═══ ① sfInvoiceRefPlan خالص است — هیچ نوشتنی ندارد ═══ */
(function () {
  var h = boot();
  var plan = h.ctx.window.sfInvoiceRefPlan('D-1');
  T('۱.۱ plan موفق است و خلاصهٔ کامل می‌دهد', plan.ok === true && plan.offerNo === 'CO-100' && plan.rialTotal === 10000000, JSON.stringify(plan));
  T('۱.۲ plan نام پرونده و خریدار را برای نمایش دارد', plan.caseNo === 'INQ-77' && plan.buyerCo === 'پتروشیمی نمونه');
  T('۱.۳ plan هیچ چیزی نمی‌نویسد (تابع خالص)', h.state.writes.length === 0, JSON.stringify(h.state.writes));
  T('۱.۴ plan روی خود پیشنهاد invRef نمی‌گذارد', !h.offers()[0].invRef);
})();

/* ═══ ② باگ اصلی: زدن دکمهٔ ارجاع نباید چیزی ثبت کند ═══ */
(function () {
  var h = boot();
  h.ctx.window.sfInvoiceRef('D-1');
  T('۲.۱ sfInvoiceRef هیچ نوشتنی انجام نمی‌دهد (باگ «تایید اخذ نمی‌شود»)',
    h.state.writes.length === 0, JSON.stringify(h.state.writes));
  T('۲.۲ روی پیشنهاد invRef نوشته نشده است', !h.offers()[0].invRef);
  T('۲.۳ هیچ اعلانی برای حسابدار نرفته است', h.state.notifies.length === 0);
  T('۲.۴ هیچ پیامکی نرفته است', h.state.sms.length === 0);
  T('۲.۵ به‌جای ثبت، مودال تایید باز شده است', h.state.html.length === 1 && h.state.html[0].indexOf('sfInvRefConfirmDlg') > -1);

  var md = h.state.html[0] || '';
  T('۲.۶ مودال شمارهٔ پرونده را نشان می‌دهد', md.indexOf('INQ-77') > -1);
  T('۲.۷ مودال خریدار را نشان می‌دهد', md.indexOf('پتروشیمی نمونه') > -1);
  T('۲.۸ مودال پیشنهاد برنده را نشان می‌دهد', md.indexOf('CO-100') > -1);
  T('۲.۹ مودال جمع ریالی را نشان می‌دهد', md.indexOf('جمع ریالی') > -1);
  T('۲.۱۰ مودال مبنای ریالی صدور فاکتور را نشان می‌دهد', md.indexOf('مبنای ریالی صدور فاکتور') > -1);
  T('۲.۱۱ مودال دربارهٔ بازگشت‌پذیری صریح هشدار می‌دهد', md.indexOf('لغو این ارجاع فقط تا پیش از ثبت فاکتور') > -1);
  T('۲.۱۲ تصمیم پیامک داخل همین مودال است (نه بعد از ثبت)', md.indexOf('id="sfInvRefSms"') > -1 && md.indexOf('type="checkbox"') > -1);
  T('۲.۱۳ دکمهٔ انصراف وجود دارد', md.indexOf('انصراف') > -1);
  T('۲.۱۴ دکمهٔ تایید به sfInvoiceRefDo وصل است', md.indexOf('sfInvoiceRefDo(') > -1);
})();

/* ═══ ③ پس از تایید صریح، ثبت کامل انجام می‌شود ═══ */
(function () {
  var h = boot();
  h.el.sfInvRefConfirmDlg = { remove: function () {} };
  h.el.sfInvRefSms = { checked: false };
  h.ctx.window.sfInvoiceRefDo('D-1', '');
  var o = h.offers()[0];
  T('۳.۱ پس از تایید، invRef نوشته می‌شود', !!o.invRef, JSON.stringify(o.invRef));
  T('۳.۲ invRef مبنای ریالی و پروندهٔ مبدأ را دارد', o.invRef && o.invRef.rialBasis === 'CO-100' && o.invRef.fromFile === 'D-1');
  T('۳.۳ اعلان حسابدار ارسال شد', h.state.notifies.length === 1 && h.state.notifies[0].kind === 'inv_ref');
  T('۳.۴ خط زمانی پرونده ثبت شد', h.state.writes.indexOf('sfSave') > -1);
  T('۳.۵ بدون تیک پیامک، هیچ پیامکی نمی‌رود', h.state.sms.length === 0, JSON.stringify(h.state.sms));
  T('۳.۶ توست موفقیت نمایش داده شد', h.state.toasts.length === 1);
})();

(function () {
  var h = boot();
  h.el.sfInvRefConfirmDlg = { remove: function () {} };
  h.el.sfInvRefSms = { checked: true };
  h.ctx.window.sfInvoiceRefDo('D-1', '');
  T('۳.۷ با تیک پیامک، پیامک به حسابدار می‌رود', h.state.sms.length === 1 && h.state.sms[0] === '09120000000');
})();

/* ═══ ④ گاردهای قبلی دست‌نخورده ═══ */
(function () {
  var h = boot({ senior: false });
  h.ctx.window.sfInvoiceRef('D-1');
  T('۴.۱ نقش غیرارشد: نه مودالی، نه نوشتنی — فقط هشدار',
    h.state.html.length === 0 && h.state.writes.length === 0 && h.state.alerts.length === 1, JSON.stringify(h.state.alerts));

  var already = boot({ offers: [{ no: 'CO-100', kind: 'CO', currency: 'IRR', st: 'won', items: [{ qty: 1, price: 1 }], invRef: { by: 'x' } }] });
  already.ctx.window.sfInvoiceRef('D-1');
  T('۴.۲ ارجاع تکراری: مودال باز نمی‌شود', already.state.html.length === 0 && already.state.alerts.length === 1);

  var fx = boot({ offers: [{ no: 'CO-100', kind: 'CO', currency: 'EUR', st: 'won', items: [{ qty: 1, price: 100 }] }] });
  fx.ctx.window.sfInvoiceRef('D-1');
  T('۴.۳ ارزیِ بدون نسخهٔ ریالی همچنان به پرسش نرخ می‌رود (بدون رگرسیون)',
    fx.state.writes.indexOf('rialPrompt') > -1 && !fx.offers()[0].invRef);
})();

/* ═══ ⑤ مسیرهای ارزی هم از مودال تایید عبور می‌کنند ═══ */
T('۵.۱ انتخاب سند ریالی → مودال تایید (نه commit مستقیم)',
  /sfInvoiceRefPickRialDo[\s\S]{0,900}window\.sfInvoiceRefConfirm\(cd, no\)/.test(sfSrc));
T('۵.۲ ساخت نسخهٔ ریالی → مودال تایید (نه commit مستقیم)',
  /ptfOfferRialConvertCommit\([\s\S]{0,600}window\.sfInvoiceRefConfirm\(cd, res\.no\)/.test(sfSrc));
T('۵.۳ هیچ مسیری دیگر بدون تایید commit نمی‌کند',
  (sfSrc.match(/sfInvoiceRefCommit\(/g) || []).length === 2,
  'تعداد فراخوانی: ' + (sfSrc.match(/sfInvoiceRefCommit\(/g) || []).length);

/* ═══ ⑥ لغو ارجاع — قرارداد سرور ═══ */
T('۶.۱ فرمان revoke_invoice_ref در سرور تعریف شده است', sdServer.indexOf("elseif ($action === 'revoke_invoice_ref')") > -1);
T('۶.۲ فقط ادمین/رئیس هیئت‌مدیره',
  /revoke_invoice_ref'\)[\s\S]{0,900}sd_require_role\(SD_OFFER_REPAIR_ROLES\)/.test(sdServer));
T('۶.۳ دلیل اجباری است',
  /revoke_invoice_ref'\)[\s\S]{0,1400}if \(\$reason === ''\) sd_out\(\['ok'=>false,'error'=>'reason_required'\]/.test(sdServer));
T('۶.۴ وجود هر فاکتور فعال ⇒ ۴۰۹ (fail-closed)',
  /revoke_invoice_ref'\)[\s\S]{0,3000}if \(\$blocking\) sd_out\(\['ok'=>false,'error'=>'invoice_exists','dependencies'=>\$blocking\],409\)/.test(sdServer));
T('۶.۵ صورتحساب غیررسمی هم مسدودکننده است',
  /revoke_invoice_ref'\)[\s\S]{0,3000}isUnofficial/.test(sdServer));
T('۶.۶ snapshot کامل invRef در ptf_crm_corrections ثبت می‌شود',
  /'kind' => 'revoke_invoice_ref', 'beforeSnapshot' => \['no'=>\$no, 'invRef'=>\$prevRef\]/.test(sdServer));
T('۶.۷ invRef واقعاً پاک می‌شود', /revoke_invoice_ref'\)[\s\S]{0,3500}unset\(\$offer\['invRef'\]\)/.test(sdServer));
T('۶.۸ ردپای انسانی روی خط زمانی پرونده ثبت می‌شود',
  /revoke_invoice_ref'\)[\s\S]{0,4200}ارجاع فاکتور رسمی لغو شد/.test(sdServer));
T('۶.۹ به وضعیت «برنده» و خود پرونده دست نمی‌زند (برخلاف revoke_orphan_delete)',
  !/revoke_invoice_ref'\)[\s\S]{0,4200}\$offer\['st'\] = /.test(sdServer));

/* ═══ ⑦ لغو ارجاع — کلاینت و دکمه‌ها ═══ */
T('۷.۱ ptfRevokeInvoiceRef در کلاینت تعریف شده است', sdClient.indexOf('window.ptfRevokeInvoiceRef=function(no)') > -1);
T('۷.۲ گارد نقش سمت کلاینت هم هست', /ptfRevokeInvoiceRef=function\(no\)\{[\s\S]{0,200}canRepairOfferWin\(\)/.test(sdClient));
T('۷.۳ دلیل از کاربر گرفته می‌شود', /ptfRevokeInvoiceRef=function[\s\S]{0,1200}prompt\(/.test(sdClient));
T('۷.۴ خلاصهٔ ارجاعِ در حال لغو به کاربر نشان داده می‌شود',
  /ptfRevokeInvoiceRef=function[\s\S]{0,1200}ref\.rialBasis/.test(sdClient));
T('۷.۵ خطای invoice_exists با نام فاکتورها به کاربر توضیح داده می‌شود',
  /ptfRevokeInvoiceRef=function[\s\S]{0,2600}dependencies[\s\S]{0,400}ابتدا فاکتور را ابطال کنید/.test(sdClient));
/* v34.37.1: پنل زندهٔ فاکتورها official-invoice-v2.js است (rbac.js بازنویسی می‌شود).
   دکمه در v34.37.1 اشتباهاً در کد مردهٔ rbac.js گذاشته شده بود و دیده نمی‌شد. */
T('۷.۶ دکمهٔ «لغو ارجاع» در پنلِ زندهٔ فاکتورها هست (خواستهٔ صریح کارفرما)',
  invPanel.indexOf('ptfRevokeInvoiceRef(') > -1 && invPanel.indexOf('↩️ لغو ارجاع') > -1);
T('۷.۷ دکمهٔ پنل فاکتورها فقط تا پیش از ثبت فاکتورِ فعال دیده می‌شود',
  /var undoBtn = \(!activeInv && canUndo\)/.test(invPanel));
T('۷.۷ب پس از ثبت فاکتور، به‌جای غیب شدن، دلیلِ بسته بودن نوشته می‌شود',
  /activeInv \?[\s\S]{0,200}لغو ارجاع ممکن نیست/.test(invPanel));
T('۷.۷ج پنل مردهٔ rbac.js دیگر نسخهٔ دومِ همین دکمه را ندارد (یک منبع واحد)',
  rbacSrc.indexOf('ptfRevokeInvoiceRef(') === -1);
T('۷.۷د بازنشستگی پنل rbac.js صریحاً مستند شده است',
  rbacSrc.indexOf('INV-PANEL-DEAD-CODE') > -1);
T('۷.۸ دکمهٔ لغو روی کارت پرونده هم هست', sfSrc.indexOf('window.sfInvoiceRefUndoHtml = function') > -1 &&
  sfSrc.indexOf('window.sfInvoiceRefUndoHtml(r)') > -1);

/* رفتار sfInvoiceRefUndoHtml */
(function () {
  var u0 = sfSrc.indexOf('window.sfInvRefActiveInvoice = function');
  var u1 = sfSrc.indexOf('window.sfStageGuidance = function');
  T('۷.۹ برش دکمهٔ لغو پیدا شد', u0 > -1 && u1 > u0);
  function bootUndo(offers, invoices, canRepair) {
    var ctx = {
      console: console, JSON: JSON, String: String, Array: Array, Object: Object,
      window: { ptfCanRepairOfferWin: function () { return canRepair; } },
      getData: function (k) { return k === 'ptf_crm_offers' ? offers : (k === 'ptf_crm_invoices' ? invoices : []); },
      escP: function (v) { return String(v == null ? '' : v); },
      ptfOnClickArg: function (v) { return String(v == null ? '' : v); }
    };
    vm.createContext(ctx);
    vm.runInContext(sfSrc.slice(u0, u1), ctx, { filename: 'undo-slice.js' });
    return ctx.window.sfInvoiceRefUndoHtml;
  }
  var refd = [{ no: 'CO-100', invRef: { by: 'x' } }];
  var r = { cd: 'D-1', wonOffer: 'CO-100' };

  T('۷.۱۰ ارجاع فعال + بدون فاکتور + نقش مجاز ⇒ دکمهٔ لغو دیده می‌شود',
    bootUndo(refd, [], true)(r).indexOf('ptfRevokeInvoiceRef(') > -1);
  T('۷.۱۱ بدون ارجاع ⇒ هیچ دکمه‌ای', bootUndo([{ no: 'CO-100' }], [], true)(r) === '');
  var withInv = bootUndo(refd, [{ offerNo: 'CO-100', no: 'F-9', status: 'active' }], true)(r);
  T('۷.۱۲ با فاکتور فعال ⇒ دکمه نیست، ولی دلیلِ بسته بودن نوشته می‌شود (نه غیب شدن بی‌توضیح)',
    withInv.indexOf('ptfRevokeInvoiceRef(') === -1 && withInv.indexOf('F-9') > -1);
  T('۷.۱۳ فاکتور ابطال‌شده مسدودکننده نیست',
    bootUndo(refd, [{ offerNo: 'CO-100', no: 'F-9', status: 'void' }], true)(r).indexOf('ptfRevokeInvoiceRef(') > -1);
  T('۷.۱۴ نقش غیرمجاز ⇒ راهنمای «چه کسی می‌تواند» به‌جای سکوت',
    bootUndo(refd, [], false)(r).indexOf('ادمین یا رئیس هیئت‌مدیره') > -1);
})();

/* ═══ ⑧ کد مردهٔ refToInvoice پاک شد ═══ */
(function () {
  var a = rbacSrc.indexOf('function refToInvoice(');
  var b = rbacSrc.indexOf('function buildInvoices(');
  var body = rbacSrc.slice(a, b);
  T('۸.۱ refToInvoice دیگر invRef نمی‌نویسد (کد مردهٔ پس از return حذف شد)', body.indexOf('o.invRef =') === -1);
  T('۸.۲ تنها نویسندهٔ invRef در کل CRM، salesfiles.js است',
    (rbacSrc.match(/\.invRef = \{/g) || []).length === 0 && (sfSrc.match(/o\.invRef = \{/g) || []).length === 1);
})();

console.log('\n— tester596 (v34.37.1: تایید پیش از ارجاع فاکتور + لغو ارجاع) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
if (f) process.exit(1);
