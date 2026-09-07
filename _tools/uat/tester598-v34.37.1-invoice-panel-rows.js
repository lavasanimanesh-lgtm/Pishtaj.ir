#!/usr/bin/env node
'use strict';
/* ═══ tester598 — v34.38.0 (INV-PANEL-ROWS) ═══
   خواستهٔ کارفرما:
   ① «فاکتورها به صورت ردیف نمایش داده شوند و اطلاعات دیگر به صورت کشویی در صورت
      زدن روی فلش باز شوند و دیده شوند.»
   ② «اگر فاکتوری ثبت شد دیگر دکمهٔ ثبت فاکتور به عبارت «فاکتور ثبت شده است» تغییر
      کند و نباید با زدن روی ثبت فاکتور پنجرهٔ مودال ثبت فاکتور دوباره باز شود.»

   نکتهٔ معماری که این تستر هم قفل می‌کند: پنلِ زندهٔ فاکتورها
   `crm/official-invoice-v2.js` است و `crm/rbac.js` بازنویسی می‌شود. در v34.38.0
   دکمهٔ «لغو ارجاع» اشتباهاً در همان کد مرده گذاشته شده بود و هرگز دیده نمی‌شد.

   این تستر رفتاری است: خودِ renderInvoices را در vm اجرا می‌کند و HTML خروجی و
   رفتار toggle و قفلِ showInvModal را می‌سنجد. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var src = read('crm/official-invoice-v2.js');

/* ── برش پنل: از قرارداد ردیف‌ها تا ابتدای مودال ── */
/* نشانگر برش نسخه‌آگنوستیک — bump-version-pins نباید بتواند تستر را بشکند */
var a = src.indexOf('  window._ptfInvOpenRows = window._ptfInvOpenRows || {};');
var b = src.indexOf('  /* فاکتور فعالِ ثبت‌شده روی یک پیشنهاد');
T('۰.۱ برش پنل ردیفی پیدا شد', a > -1 && b > a);
T('۰.۲ قرارداد INV-PANEL-ROWS در سورس مستند است', src.indexOf('(INV-PANEL-ROWS)') > -1);
var panelSrc = src.slice(a, b);

/* استاب‌های داخلیِ ماژول که در برش نیستند (هم‌نام و وفادار به اصل) */
var helpers = [
  'function esc(v){return String(v==null?"":v);}',
  'function arg(v){return String(v==null?"":v);}',
  'function money(v){return (+v||0).toLocaleString("fa-IR")+" ریال";}',
  'function active(x){var s=String((x&&(x.status||x.st))||"").toLowerCase();return !!x&&["void","voided","deleted","superseded","replaced"].indexOf(s)<0&&!x.voided;}',
  'function iid(i){return String((i&&(i._id||i.cd))||"");}',
  'function cid(c){return String((c&&(c._id||c.cd))||"");}',
  'function findOffer(no){return data("ptf_crm_offers").filter(function(o){return o&&o.no===no;})[0]||null;}',
  'function findCaseForOffer(o){if(!o)return null;return data("ptf_crm_deals").filter(function(c){return c&&active(c)&&(c.wonOffer===o.no||c.offerNo===o.no);})[0]||null;}',
  'function filesHtml(){return "FILES";}'
].join('\n');

function boot(offers, invoices, cases, opts) {
  opts = opts || {};
  var wrap = { id: 'invWrap', innerHTML: '', style: {}, querySelectorAll: function () { return []; } };
  var nodes = { invWrap: wrap };
  var ctx = {
    console: console, JSON: JSON, Math: Math, String: String, Number: Number, Array: Array, Object: Object, Date: Date,
    window: { ptfCanRepairOfferWin: function () { return opts.canUndo !== false; } },
    document: { getElementById: function (id) { return nodes[id] || null; } },
    getData: function (k) {
      return k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : k === 'ptf_crm_deals' ? (cases || []) : [];
    },
    data: function (k) { var v = ctx.getData(k); return Array.isArray(v) ? v : []; },
    role: function () { return opts.role || 'accountant'; },
    can: function () { return opts.can !== false; },
    ptfCustNamePair: function (cd, co) { return { fa: co || '', en: opts.en || '' }; },
    sfAwardPrint: function () {}
  };
  vm.createContext(ctx);
  vm.runInContext(helpers + '\n' + panelSrc, ctx, { filename: 'invpanel-slice.js' });
  ctx.window.renderInvoices();
  return { html: wrap.innerHTML, wrap: wrap, ctx: ctx, nodes: nodes };
}

var OFFER = { no: 'CO-500', kind: 'CO', currency: 'IRR', buyerCd: 'CUST-1001', buyerCo: 'فولاد نمونه', st: 'won', items: [{ qty: 2, price: 5000000 }], invRef: { by: 'مدیر بازرگانی', t: '1405/06/10', rialBasis: 'CO-500', rialTotal: 10000000 } };
var CASE = { _id: 'CASE-1', cd: 'D-1', wonOffer: 'CO-500', status: 'active' };
function inv(o) { return Object.assign({ _id: 'INV-1', no: 'F-1001', offerNo: 'CO-500', invDate: '1405/06/12', taxUid: 'TX-9', base: 10000000, vat: 1000000, vatPercent: 10, amount: 11000000, openAmountIRR: 11000000, files: [] }, o || {}); }

/* ═══ ① نمایش ردیفی + کشو ═══ */
(function () {
  var h = boot([OFFER], [], [CASE]).html;
  T('۱.۱ هر ارجاع یک ردیف است (data-inv-row)', (h.match(/data-inv-row="/g) || []).length === 1, h.slice(0, 120));
  T('۱.۲ سربرگ ستون‌ها وجود دارد', h.indexOf('سند مبنا') > -1 && h.indexOf('مشتری') > -1 && h.indexOf('وضعیت فاکتور') > -1 && h.indexOf('مطالبه باز') > -1);
  T('۱.۳ فلشِ باز/بسته روی ردیف هست', /id="invA_CO_500"/.test(h) && h.indexOf('◀') > -1);
  T('۱.۴ کشوی جزئیات وجود دارد و پیش‌فرض بسته است',
    /id="invD_CO_500" style="display:none/.test(h), (h.match(/id="invD_CO_500"[^>]*/) || [])[0]);
  T('۱.۵ فلش به ptfInvRowToggle وصل است', /ptfInvRowToggle\('CO_500'\)/.test(h));
  T('۱.۶ کل ردیف هم کلیک‌پذیر است (نه فقط فلش)', (h.match(/ptfInvRowToggle\('CO_500'\)/g) || []).length >= 2);
  T('۱.۷ فلش رویدادش را متوقف می‌کند تا دوبار toggle نشود', /event\.stopPropagation\(\);ptfInvRowToggle/.test(h));
  T('۱.۸ اطلاعات تفصیلی داخل کشوست، نه روی ردیف',
    h.indexOf('ارجاع از پرونده') > h.indexOf('id="invD_CO_500"'));
  T('۱.۹ دسترس‌پذیری: aria-expanded روی فلش', /aria-expanded="false"/.test(h));
  T('۱.۱۰ کلیدهای «باز کردن همه/بستن همه» هست', h.indexOf('ptfInvRowsToggleAll(true)') > -1 && h.indexOf('ptfInvRowsToggleAll(false)') > -1);
})();

/* رفتار واقعی toggle */
(function () {
  var h = boot([OFFER], [], [CASE]);
  var drawer = { style: { display: 'none' } }, arrowEl = { textContent: '◀', setAttribute: function (k, v) { this[k] = v; } };
  h.nodes['invD_CO_500'] = drawer; h.nodes['invA_CO_500'] = arrowEl;
  h.ctx.window.ptfInvRowToggle('CO_500');
  T('۲.۱ زدن فلش کشو را باز می‌کند', drawer.style.display === '' && arrowEl.textContent === '▾');
  T('۲.۲ حالت باز در وضعیت ماندگار ثبت می‌شود (با re-render گم نمی‌شود)', h.ctx.window._ptfInvOpenRows['CO_500'] === true);
  h.ctx.window.ptfInvRowToggle('CO_500');
  T('۲.۳ زدن دوباره کشو را می‌بندد', drawer.style.display === 'none' && arrowEl.textContent === '◀');
})();

/* حفظ حالت باز پس از رندر مجدد — هر اقدام داخل کشو renderInvoices را صدا می‌زند؛
   اگر حالت نگه داشته نشود، کشو زیر دست کاربر بسته می‌شود. */
(function () {
  var h1 = boot([OFFER], [], [CASE]);
  T('۲.۴الف پیش‌فرض بسته است', /id="invD_CO_500" style="display:none/.test(h1.wrap.innerHTML));
  h1.ctx.window._ptfInvOpenRows['CO_500'] = true;
  h1.ctx.window.renderInvoices();
  T('۲.۴ پس از رندر مجدد، ردیفِ باز همچنان باز رندر می‌شود',
    /id="invD_CO_500" style="display:;/.test(h1.wrap.innerHTML) && /aria-expanded="true"/.test(h1.wrap.innerHTML),
    (h1.wrap.innerHTML.match(/id="invD_CO_500"[^>]{0,45}/) || [])[0]);
  T('۲.۴ب فلشِ ردیفِ باز رو به پایین است', h1.wrap.innerHTML.indexOf('>▾</button>') > -1);
})();

/* ═══ ③ قفل دکمهٔ ثبت پس از ثبت فاکتور ═══ */
(function () {
  var none = boot([OFFER], [], [CASE]).html;
  T('۳.۱ بدون فاکتور: دکمهٔ ثبت فعال است', none.indexOf('+ ثبت فاکتور رسمی صادرشده') > -1 && /showInvModal\('CO-500'\)/.test(none));
  T('۳.۲ بدون فاکتور: وضعیت «بدون فاکتور»', none.indexOf('⏳ بدون فاکتور') > -1);

  var withInv = boot([OFFER], [inv()], [CASE]).html;
  T('۳.۳ با فاکتور فعال: عبارت «فاکتور ثبت شده است» جای دکمه را می‌گیرد', withInv.indexOf('✅ فاکتور ثبت شده است') > -1);
  T('۳.۴ با فاکتور فعال: دکمهٔ «+ ثبت فاکتور رسمی صادرشده» دیگر نیست', withInv.indexOf('+ ثبت فاکتور رسمی صادرشده') === -1);
  T('۳.۵ با فاکتور فعال: هیچ showInvModal بدون شناسهٔ فاکتور (مسیر ثبت) در HTML نیست',
    !/showInvModal\('CO-500'\)/.test(withInv));
  T('۳.۶ نشانگر ثبت‌شده قابل کلیک نیست (نه دکمه، نه onclick)',
    /data-inv-registered="1"[^>]*cursor:default/.test(withInv) && !/data-inv-registered="1"[^>]*onclick/.test(withInv));
  T('۳.۷ شمارهٔ فاکتور ثبت‌شده روی ردیف دیده می‌شود', withInv.indexOf('✅ فاکتور F-1001') > -1);
  T('۳.۸ اصلاح/ابطال همچنان داخل کشو در دسترس‌اند',
    /showInvModal\('CO-500','INV-1'\)/.test(withInv) && /ptfInvoiceVoid\('INV-1'\)/.test(withInv));

  var voided = boot([OFFER], [inv({ status: 'void' })], [CASE]).html;
  T('۳.۹ فاکتور ابطال‌شده دوباره اجازهٔ ثبت می‌دهد (قفل چسبنده نیست)',
    voided.indexOf('+ ثبت فاکتور رسمی صادرشده') > -1 && voided.indexOf('🚫 ابطال‌شده') > -1);

  var noCase = boot([OFFER], [], []).html;
  T('۳.۱۰ نبود پروندهٔ فروش همچنان پیام خودش را دارد (بدون رگرسیون)', noCase.indexOf('⛔ پرونده فروش یافت نشد') > -1);
  var noRole = boot([OFFER], [], [CASE], { can: false }).html;
  T('۳.۱۱ نقش غیرمجاز دکمهٔ ثبت نمی‌بیند', noRole.indexOf('+ ثبت فاکتور رسمی صادرشده') === -1);
})();

/* ═══ ④ قفلِ در ورودی: showInvModal هم فاکتور دوم نمی‌سازد ═══ */
T('۴.۱ ptfActiveInvoiceOfOffer تعریف شده است', src.indexOf('window.ptfActiveInvoiceOfOffer=function(offerNo)') > -1);
T('۴.۲ showInvModal در مسیر ثبت (بدون editId) وجود فاکتور فعال را بررسی می‌کند',
  /if\(!editId\)\{[\s\S]{0,400}ptfActiveInvoiceOfOffer\(offerNo\)/.test(src));
T('۴.۳ در صورت وجود فاکتور، مودال باز نمی‌شود و پیام راهنما داده می‌شود',
  /از قبل ثبت شده است[\s\S]{0,300}return;/.test(src));
T('۴.۴ مسیر اصلاح (editId) باز می‌ماند — قفل فقط برای ثبتِ جدید است',
  /if\(!editId\)\{/.test(src) && src.indexOf('inv=editId?findInvoice(editId):null') > -1);

/* رفتار واقعی قفلِ در ورودی */
(function () {
  var s0 = src.indexOf('  window.ptfActiveInvoiceOfOffer=function(offerNo){');
  var s1 = src.indexOf('    var o=findOffer(offerNo),c=findCaseForOffer(o),inv=editId?findInvoice(editId):null;');
  T('۴.۵ برش گاردِ showInvModal پیدا شد', s0 > -1 && s1 > s0);
  var guard = src.slice(s0, s1) + '  };\n';
  var invoices = [inv()];
  var alerts = [];
  var ctx = {
    console: console, JSON: JSON, String: String, Array: Array, Object: Object,
    window: {}, alert: function (m) { alerts.push(String(m)); },
    data: function (k) { return k === 'ptf_crm_invoices' ? invoices : []; },
    active: function (x) { var s = String((x && (x.status || x.st)) || '').toLowerCase(); return !!x && ['void', 'voided', 'deleted', 'superseded', 'replaced'].indexOf(s) < 0 && !x.voided; },
    can: function () { return true; },
    findOffer: function () { throw new Error('نباید تا اینجا برسد — گارد باید زودتر برگردد'); },
    findCaseForOffer: function () { return null; },
    findInvoice: function () { return null; }
  };
  vm.createContext(ctx);
  vm.runInContext(guard, ctx, { filename: 'invguard-slice.js' });
  T('۴.۶ فاکتور فعال با شمارهٔ پیشنهاد پیدا می‌شود', !!ctx.window.ptfActiveInvoiceOfOffer('CO-500'));
  T('۴.۷ برای پیشنهاد بی‌فاکتور null برمی‌گرداند', ctx.window.ptfActiveInvoiceOfOffer('CO-999') === null);
  var threw = false;
  try { ctx.window.showInvModal('CO-500'); } catch (e) { threw = true; }
  T('۴.۸ فراخوانی ثبتِ دوباره پیش از باز شدن مودال متوقف می‌شود',
    !threw && alerts.length === 1 && alerts[0].indexOf('از قبل ثبت شده است') > -1, JSON.stringify(alerts));
  invoices = [inv({ status: 'void' })];
  alerts.length = 0;
  ctx.window.showInvModal('CO-500');
  T('۴.۹ اگر فاکتور ابطال شده باشد، گارد جلوی ثبت جدید را نمی‌گیرد (قفل چسبنده نیست)',
    alerts.length === 0, JSON.stringify(alerts));
})();

/* ═══ ⑤ بدون رگرسیون — قراردادهای پنل که تسترهای دیگر به آن‌ها تکیه دارند ═══ */
T('۵.۱ تشخیص نسخهٔ ریالی (ptfRialCompanionOf) حفظ شد', src.indexOf('ptfRialCompanionOf(o.no)') > -1);
T('۵.۲ دکمهٔ «💱 مبنای ریالی (PDF)» حفظ شد', src.indexOf('💱 مبنای ریالی (PDF)') > -1 && src.indexOf('offerPrint(') > -1 && src.indexOf('arg(comp.no)') > -1);
T('۵.۳ «🏆 سند برد (PDF)» برای مسیر غیرارزی حفظ شد', src.indexOf('🏆 سند برد (PDF)') > -1);
T('۵.۴ برچسب «برگرفته از جمع سند ریالی» حفظ شد', src.indexOf('برگرفته از جمع سند ریالی') > -1);
T('۵.۵ «📎 اسناد» و حذف قطعی ادمین حفظ شدند', src.indexOf('📎 اسناد') > -1 && /ptfAdminHardDelete\(\\'invoice\\'/.test(src));
T('۵.۶ پیام فهرست خالی حفظ شد', src.indexOf('ارجاع آماده ثبت فاکتور رسمی وجود ندارد.') > -1);
T('۵.۷ فقط پیشنهادهای ارجاع‌شدهٔ غیرِ ریال‌اُف رندر می‌شوند', /o\.invRef && !o\.rialOf/.test(src));

/* ═══ ⑥ ارجاع ریالیِ ساده نباید «پیشنهاد ارزی با نرخ ۰» نشان دهد ═══
   برای ارجاع IRR، rialBasis برابر خودِ شمارهٔ پیشنهاد است و findOffer همان سند را
   برمی‌گرداند؛ پیش از v34.38.0 پنل برای یک پیشنهاد ریالی هم خط «💱 … ارزی … نرخ ۰»
   چاپ می‌کرد و دکمهٔ اشتباهِ «نسخهٔ ریالی» را به‌جای «سند برد» می‌گذاشت. */
(function () {
  var rialOffer = Object.assign({}, OFFER, { invRef: Object.assign({}, OFFER.invRef, { rialBasis: 'CO-500', fromFile: 'D-1' }) });
  var h = boot([rialOffer], [], [CASE]).html;
  T('۶.۱ ارجاع ریالی خط «پیشنهاد ارزی» نمی‌گیرد', h.indexOf('مبنای ریالی از پیشنهاد ارزی') === -1);
  T('۶.۲ ارجاع ریالی «نرخ ۰ ریال» نمایش نمی‌دهد', h.indexOf('نرخ ۰ ریال') === -1);
  T('۶.۳ برای ارجاع ریالی، «🏆 سند برد (PDF)» درست انتخاب می‌شود',
    h.indexOf('🏆 سند برد (PDF)') > -1 && h.indexOf('💱 مبنای ریالی (PDF)') === -1);

  var fx = { no: 'CO-600', currency: 'EUR', buyerCd: 'C2', buyerCo: 'پتروشیمی جم', items: [{ qty: 1, price: 20000 }], invRef: { by: 'x', t: '1405/06/12', rialBasis: 'CO-601', rialRate: 1120000, rialTotal: 22400000, rialRateDerived: true } };
  var rialDoc = { no: 'CO-601', currency: 'IRR', items: [{ qty: 1, price: 22400000 }] };
  var hf = boot([fx, rialDoc], [], [{ wonOffer: 'CO-600' }]).html;
  T('۶.۴ ارجاع ارزیِ واقعی همچنان خط مبنای ریالی و نرخ را نشان می‌دهد (بدون رگرسیون)',
    hf.indexOf('مبنای ریالی از پیشنهاد ارزی') > -1 && hf.indexOf('💱 مبنای ریالی (PDF)') > -1);
  T('۶.۵ برچسب «برگرفته از جمع سند ریالی» در مسیر ارزی حفظ شد', hf.indexOf('برگرفته از جمع سند ریالی') > -1);
})();

console.log('\n— tester598 (v34.38.0: پنل ردیفی فاکتورها + کشو + قفل ثبت دوباره) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
if (f) process.exit(1);
