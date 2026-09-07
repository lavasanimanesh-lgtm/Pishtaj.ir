#!/usr/bin/env node
/* =============================================================================
   tester599-v34.37.2-invoice-panel-visibility.js
   تثبیت رفتار: «پنل فاکتورهای رسمی باید فاکتورهای ثبت‌شده/ارجاع‌شده را نشان دهد»
   (ARENA-CRM-INVOICE-PANEL-ASSESSMENT-2026-09-05.md — یافته‌های F1 · F3 · F5 · F6)

   چرا جدا از tester598؟
     tester598 → پنل ردیف‌محورِ مبتنی‌بر ارجاع (کشو، فلش، قفل ثبت دوباره).
     tester599 → همان رندر از سمت «دادهٔ موجود»: هیچ فاکتور رسمیِ فعالی نباید بی‌صدا
                 غیب شود، حتی اگر ارجاعش پاک شده (revise_award) یا کج (فاصله/ارقام
                 فارسی/نسخهٔ ریالی) یا بی‌offerNo (فاکتور مهاجرت‌شده) باشد.
   هر دو تستر برشِ خودکفای crm/official-invoice-v2.js را در vm اجرا می‌کنند — DOM و
   سرور لازم نیست؛ رندر روی رشتهٔ innerHTMLِ #invWrap سنجیده می‌شود.
   ============================================================================= */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

/* PTF_PANEL_SRC برای «آزمونِ جهش» (mutation check) گذاشته شده: با یک نسخهٔ دست‌کاری‌شده
   از فایل می‌سنجیم که آیا این تستر واقعاً باگ را می‌گیرد. در اجرای عادی استفاده نمی‌شود. */
const SRC = fs.readFileSync(process.env.PTF_PANEL_SRC || path.join(__dirname, '..', '..', 'crm', 'official-invoice-v2.js'), 'utf8');
const BEGIN = '  function rowKey(no)';
const END = '  window.showInvModal=function(offerNo,editId){';
const i0 = SRC.indexOf(BEGIN), i1 = SRC.indexOf(END);
if (i0 < 0 || i1 < 0) { console.log('FATAL: برش پنل پیدا نشد — ساختار فایل عوض شده است'); process.exit(1); }
const PANEL = SRC.slice(i0, i1);
const GUARD = SRC.slice(SRC.indexOf('window.ptfActiveInvoiceOfOffer'), SRC.indexOf('var already=window.ptfActiveInvoiceOfOffer') > -1 ? SRC.indexOf('    var o=findOffer(offerNo),c=findCaseForOffer(o)') : i1);

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' → ' + extra : '')); }
}
function head(s) { console.log('\n── ' + s + ' ──'); }
function count(hay, needle) { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) > -1) { n++; i += needle.length; } return n; }

/* ── هارنس ─────────────────────────────────────────────────────────────────── */
function mk(st) {
  st = st || {};
  const offers = st.offers || [], invoices = st.invoices || [], deals = st.deals || [];
  const wrap = { innerHTML: '' }, alerts = [], calls = [], timers = [];
  const inputs = st.inputs || {};
  const ctx = {
    console,
    data: (k) => (k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : k === 'ptf_crm_deals' ? deals : []),
    can: () => (st.can === undefined ? true : !!st.can),
    role: () => st.role || 'manager',
    num: (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.eE+-]/g, '')); return isFinite(n) ? n : 0; },
    esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    money: (v) => String(Math.round(Number(v) || 0)),
    faNum: (v) => String(v),
    fmtDate: (v) => String(v || ''),
    relTime: (v) => String(v || ''),
    days: () => 3,
    active: (i) => !!i && !i.voided && i.status !== 'void',
    voided: (i) => !!(i && (i.voided || i.status === 'void')),
    iid: (i) => (i ? (i.id || i._id || i.no) : ''),
    arg: (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    filesHtml: (i) => 'DOC[' + ((i && i.documents) || []).length + ']',
    findInvoice: (no) => invoices.filter((i) => i && (i.id === no || i.no === no))[0] || null,
    findOffer: (no) => offers.filter((o) => o && String(o.no) === String(no))[0] || null,
    findCaseForOffer: (o) => (o ? deals.filter((c) => c && (c._id === o.caseId || c.cd === o.caseId || c.id === o.caseId))[0] || null : null),
    ptfCustNamePair: (cd, co) => ({ fa: co || '', en: '' }),
    ptfRialCompanionOf: (no) => null,
    ptfSalesFileHasUnofficialInvoice: () => !!st.hasUnofficial,
    ptfOfficialInvoiceFilesUi: (id) => calls.push('files:' + id),
    ptfInvoiceVoid: (id) => calls.push('void:' + id),
    showInvModal: (no, edit) => calls.push('modal:' + no + (edit ? '|' + edit : '')),
    ptfGoSalesFile: (cd) => calls.push('deal:' + cd),
    showDealCase: (id) => calls.push('case:' + id),
    ptfInvRowToggle: (k) => calls.push('toggle:' + k),
    ptfInvRowsToggleAll: (v) => calls.push('all:' + v),
    document: {
      getElementById: (id) => (id === 'invWrap' ? wrap : inputs[id]),
      documentElement: { innerHTML: '' },
      querySelectorAll: () => [],
    },
    window: {},
  };
  ctx.window = ctx;
  ctx.alert = (m) => alerts.push(m);
  ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  ctx._ptfInvOpenRows = st.openRows || {};
  vm.createContext(ctx);
  vm.runInContext(PANEL + '\n', ctx, { filename: 'panel599.js' });
  return {
    ctx, wrap, alerts, calls, timers, offers, invoices,
    render: () => { ctx.renderInvoices(); return wrap.innerHTML; },
  };
}

/* ── ۰) قرارداد ساختاری برش ────────────────────────────────────────────────── */
head('۰. قرارداد ساختاری');
T('۰.۱ بلوک پنل (rowKey … renderInvoices … گارد) کامل بریده شد', /window\.renderInvoices = function \(\)/.test(PANEL) && /window\.ptfActiveInvoiceOfOffer=/.test(PANEL));
T('۰.۲ یتیم‌ها از خودِ آرایهٔ فاکتورها گرفته می‌شوند (نه از ارجاع‌ها)',
  /var orphans = orphan\.filter\(function \(i\) \{ return i && active\(i\) && !i\.isUnofficial; \}\);/.test(PANEL));
T('۰.۳ نرمال‌سازی شمارهٔ ارجاع یک تابع است و در هر دو سو به کار می‌رود',
  /function normRef\(v\)/.test(PANEL) && /normRef\(i\.offerNo\)/.test(PANEL) && /aliasRow\[k\]/.test(PANEL));
T('۰.۴ جست‌جوی پنل زنده وصل است (#invSrch → renderInvoices)',
  /id="invSrch"[\s\S]{0,400}oninput="renderInvoices\(\)"/.test(SRC) && /getElementById\('invSrch'\)/.test(PANEL));
T('۰.۵ سربرگ تشخیصی هر چهار کنتور را دارد', /📤 ارجاع‌شده/.test(PANEL) && /✅ ثبت‌شده/.test(PANEL) && /⚠️ بدون ردیف ارجاع/.test(PANEL) && /💰 مطالبه باز/.test(PANEL));
T('۰.۶ «↻ بازخوانی از سرور» هم در سربرگ و هم به‌صورت تابع هست', /window\.ptfInvoicesRefresh = function/.test(PANEL) && /onclick="ptfInvoicesRefresh\(\)"/.test(PANEL));
T('۰.۷ بلوک‌های جدید نوشتنِ مستقیم localStorage ندارند (قرارداد A10)', !/localStorage\./.test(PANEL));
T('۰.۸ گاردِ ثبتِ دوباره خودکفاست: بیرونِ برش را صدا نمی‌زند (harmsِ tester598)',
  !/findOffer\(|offerAliasKeys\(|normRef\(/.test(GUARD.split('window.ptfActiveInvoiceOfOffer')[1] || '') && /nrm=function/.test(GUARD));

/* ── ۱) فاکتور ثبت‌شدهٔ بی‌ارجاع باید دیده شود (F1 — باگ اصلی) ──────────────── */
head('۱. فاکتور ثبت‌شده بدون ردیف ارجاع');
{
  const h = mk({
    deals: [{ _id: 'D-7', cd: 'INQ-9', inqNo: 'INQ-9', title: 'پروندهٔ شهرداری نمونه', status: 'active' }],
    offers: [{ no: 'CO-7', caseId: 'D-7', buyerCo: 'شرکت الف', inqNo: 'INQ-9', date: '2026-05-01', awardResult: 'won', isWinner: true }],
    invoices: [
      { id: 'INV1', no: 'INV-1404-0077', invDate: '2026-06-01', caseId: 'D-7', offerNo: 'CO-7', base: 8000000000, amount: 9600000000, taxUid: '۱۲۳۴۵۶۷۸۹۰', documents: [1, 2] },
      { id: 'INV2', no: 'INV-1404-0078', invDate: '2026-06-20', caseId: 'D-7', offerNo: 'CO-7', base: 1200000000, amount: 1450000000, documents: [] },
    ],
  });
  const html = h.render();
  T('۱.۱ تیتر بخش یتیم‌ها با شمارش درست', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع (2)') > -1, html.slice(0, 160));
  T('۱.۲ شمارهٔ هر دو فاکتور روی صفحه است', html.indexOf('INV-1404-0077') > -1 && html.indexOf('INV-1404-0078') > -1);
  T('۱.۳ سند مبدأ و پروندهٔ مبدأ چاپ می‌شود', html.indexOf('سند مبدأ: CO-7') > -1 && html.indexOf('INQ-9') > -1);
  T('۱.۴ پایه/کل/ماندهٔ هر سند دیده می‌شود', html.indexOf('پایه: 8000000000') > -1 && html.indexOf('کل: 9600000000') > -1 && html.indexOf('مطالبه باز: 9600000000') > -1);
  T('۱.۵ برچسب هشدار روی کارت هست', html.indexOf('⚠️ بدون ردیف ارجاع') > -1);
  T('۱.۶ «حذف قطعی»/«🗑 حذف» برای سند یتیم پیشنهاد نمی‌شود (رگریشنِ قبلی)', html.indexOf('🗑 حذف') === -1);
  T('۱.۷ دکمهٔ «+ ثبت فاکتور رسمی» در این بخش نیست (سند دوم لازم نیست)', html.indexOf('+ ثبت فاکتور رسمی صادرشده') === -1);
  T('۱.۸ ابطال از همین‌جا ممکن است (id-محور، بی‌نیاز از پیشنهاد)', /onclick="ptfInvoiceVoid\(&#39;INV1&#39;\)|ptfInvoiceVoid\('INV1'\)/.test(html));
  T('۱.۹ 📎 اسناد از همین‌جا باز می‌شود و شمارش پیوست‌ها می‌آید', /onclick="ptfOfficialInvoiceFilesUi\('INV1'\)"/.test(html) && html.indexOf('DOC[2]') > -1);
  T('۱.۹ب «🔗 پرونده» کاربر را به پروندهٔ مبدأ می‌برد (مسیر درست‌کردنِ پیوند)', /onclick="ptfGoSalesFile\('INQ-9'\)"/.test(html) && html.indexOf('🔗 پرونده') > -1);
  T('۱.۱۰ «اصلاح اطلاعات» فقط چون پیشنهادش پیداست نمایش داده می‌شود', /showInvModal\('CO-7','INV1'\)/.test(html));
  T('۱.۱۱ راهنمای عملیاتی («چطور وصلش کنم») هست', html.indexOf('برای بازگشتنِ ردیف: «🔗 پرونده» را بزنید و از پروندهٔ فروش دوباره ارجاع دهید') > -1);
  T('۱.۱۲ کنتورِ سربرگ با شمارشِ بخش یکی است', html.indexOf('⚠️ بدون ردیف ارجاع: <b>2</b>') > -1);
  T('۱.۱۳ کنتور دادهٔ این دستگاه چاپ می‌شود', html.indexOf('دادهٔ این دستگاه: 2 فاکتور · 1 پیشنهاد') > -1);
  T('۱.۱۴ ردیف ارجاع رندر نشده (نه ردیفِ شبح)', html.indexOf('data-inv-row=') === -1);
}
{
  /* پیشنهادِ بی‌invRef و بی‌پرونده: فاکتور باید دیده شود، حتی اگر کارت نیمه‌پر باشد */
  const h = mk({ invoices: [{ id: 'LOST', no: 'INV-LOST', invDate: '2026-06-01', offerNo: 'CO-X', amount: 5, base: 5 }] });
  const html = h.render();
  T('۱.۱۵ بدون پروندهٔ فروش هم سند نامرئی نمی‌ماند', html.indexOf('INV-LOST') > -1 && html.indexOf('سند مبدأ: CO-X') > -1);
  T('۱.۱۶ «اصلاح اطلاعات» وقتی پیشنهاد نیست داده نمی‌شود', html.indexOf('اصلاح اطلاعات') === -1);
}

/* ── ۲) ردیف معمولی دست‌نخورده؛ یتیم فقط «افزوده» می‌شود ───────────────────── */
head('۲. ردیف معمولی + بخش یتیم');
{
  const h = mk({
    deals: [{ _id: 'D-1', cd: 'T-A', status: 'active' }],
    offers: [{ no: 'CO-A', caseId: 'D-1', buyerCo: 'مشتری الف', inqNo: 'T-A', date: '2026-04-02', invRef: { rialBasis: '', price: 500, t: '2026-04-10', by: 'ارشد' } }],
    invoices: [{ id: 'IA', no: 'INV-A-1', invDate: '2026-05-05', caseId: 'D-1', offerNo: 'CO-A', base: 500, amount: 500 }],
  });
  const html = h.render();
  T('۲.۱ ردیف ارجاع‌شده رندر می‌شود', /data-inv-row="CO_A"/.test(html));
  T('۲.۲ وضعیت ردیف «✅ فاکتور INV-A-1» است', html.indexOf('✅ فاکتور INV-A-1') > -1);
  T('۲.۳ دکمهٔ ثبت جایش را به نشانگرِ غیرقابل‌کلیک داده', html.indexOf('✅ فاکتور ثبت شده است') > -1 && html.indexOf('data-inv-registered="1"') > -1 && html.indexOf('+ ثبت فاکتور رسمی صادرشده') === -1);
  T('۲.۴ برای همین فاکتور کارت یتیم ساخته نمی‌شود', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1);
  T('۲.۵ کنتور سربرگ: ارجاع‌شده ۱ / ثبت‌شده ۱', html.indexOf('📤 ارجاع‌شده: <b>1</b>') > -1 && html.indexOf('✅ ثبت‌شده: <b>1</b>') > -1);
}
{
  /* دو فاکتور روی یک ارجاع (چند صورت‌وضعیت) — هیچ‌کدام نباید غیب شود */
  const h = mk({
    deals: [{ _id: 'D-2', cd: 'T-B', status: 'active' }],
    offers: [{ no: 'CO-B', caseId: 'D-2', buyerCo: 'مشتری ب', invRef: { price: 100 } }],
    invoices: [
      { id: 'B1', no: 'INV-B-1', invDate: '2026-05-05', offerNo: 'CO-B', amount: 60, base: 60 },
      { id: 'B2', no: 'INV-B-2', invDate: '2026-06-05', offerNo: 'CO-B', amount: 40, base: 40 },
      { id: 'B3', no: 'INV-B-3', invDate: '2026-07-05', offerNo: 'CO-B', amount: 10, base: 10, voided: true },
    ],
  });
  const html = h.render();
  T('۲.۶ هر سه فاکتور (از جمله ابطال‌شده) در کشوی ردیف‌اند', html.indexOf('INV-B-1') > -1 && html.indexOf('INV-B-2') > -1 && html.indexOf('INV-B-3') > -1);
  T('۲.۷ جمع مطالبه بازِ ردیف فقط فاکتورهای فعال است (۱۰۰ نه ۱۱۰)', html.indexOf('title="ماندۀ وصولی‌نشده (ریال)">100<') > -1 && html.indexOf('مطالبه باز: 110') === -1); /* v34.38.0: برچسبِ title به «ماندۀ وصولی‌نشده (ریال)» تغییر کرد — لنگرِ همین سنجه هم هم‌نام شد */
  T('۲.۷ب فاکتور ابطال‌شده مبلغی به مطالبه اضافه نمی‌کند', html.indexOf('مطالبه باز: 0') > -1);
  T('۲.۸ فاکتور ابطال‌شده «ابطال‌شده» علامت می‌خورد', html.indexOf('ابطال‌شده') > -1);
}

/* ── ۳) تطبیق نرمال‌شده: فاصله، بزرگی/کوچکی، رقم فارسی (F6) ────────────────── */
head('۳. نرمال‌سازی شمارهٔ ارجاع');
{
  const h = mk({
    deals: [{ _id: 'D-3', cd: 'T-C', status: 'active' }],
    offers: [{ no: 'CO-C', caseId: 'D-3', buyerCo: 'مشتری پ', invRef: { price: 1 } }],
    invoices: [{ id: 'IC', no: 'INV-C-1', invDate: '2026-05-06', offerNo: '  co-c ', amount: 100, base: 100 }],
  });
  const html = h.render();
  T('۳.۱ offerNo با فاصله/حروف کوچک به ردیف وصل می‌شود', html.indexOf('✅ فاکتور INV-C-1') > -1);
  T('۳.۲ و در بخش یتیم نمی‌افتد', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1);
}
{
  const h = mk({
    deals: [{ _id: 'D-4', cd: 'T-D', status: 'active' }],
    offers: [{ no: '۱۲۳', caseId: 'D-4', buyerCo: 'مشتری ث', invRef: { price: 1 } }],
    invoices: [{ id: 'ID', no: 'INV-D-1', invDate: '2026-05-07', offerNo: '123', amount: 10, base: 10 }],
  });
  const html = h.render();
  T('۳.۳ رقم فارسی و لاتین یکی شمرده می‌شود (۱۲۳ == 123)', html.indexOf('✅ فاکتور INV-D-1') > -1);
}
{
  const h = mk({
    deals: [{ _id: 'D-5', cd: 'T-E', status: 'active' }],
    offers: [{ no: 'CO-E', caseId: 'D-5', buyerCo: 'مشتری ج', invRef: { price: 1 } }],
    invoices: [{ id: 'IE', no: 'INV-E-1', invDate: '2026-05-08', offerNo: '۴۵۶', amount: 10, base: 10 }],
  });
  const html = h.render();
  T('۳.۴ شمارهٔ بی‌ربط به زور وصل نمی‌شود؛ سند یتیم می‌شود (نه ناپدید)', /🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع \(1\)/.test(html) && html.indexOf('INV-E-1') > -1);
}

/* ── ۴) نسخهٔ ریالی/مبنای ریالی = همان سند تجاری ──────────────────────────── */
head('۴. نام‌های مستعار');
{
  const h = mk({
    deals: [{ _id: 'D-6', cd: 'T-F', status: 'active' }],
    offers: [
      { no: 'CO-AR', caseId: 'D-6', currency: 'EUR', buyerCo: 'مشتری چ', invRef: { rialBasis: 'CO-RL', price: 700, t: '2026-04-20' } },
      { no: 'CO-RL', caseId: 'D-6', rialBasis: 7000000, rialOf: 'CO-AR', status: 'active', items: [{ qty: 1, price: 7000000 }], fxConvert: { rate: 1000000 } },
    ],
    invoices: [{ id: 'IR', no: 'INV-RL-1', invDate: '2026-05-09', offerNo: 'CO-RL', amount: 7000000, base: 7000000 }],
  });
  const html = h.render();
  T('۴.۱ فاکتورِ روی نسخهٔ ریالی، ردیف ارزی را «ثبت‌شده» می‌کند', html.indexOf('✅ فاکتور INV-RL-1') > -1);
  T('۴.۲ بخش یتیم خالی می‌ماند', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1);
  T('۴.۳ متای مبنای ریالی همچنان روی همان ردیف است', html.indexOf('💱 مبنای ریالی از پیشنهاد ارزی') > -1);
  T('۴.۴ فقط یک ردیف رندر می‌شود (نسخهٔ ریالی ردیف جدا ندارد)', count(html, 'data-inv-row=') === 1);
}
{
  const h = mk({
    deals: [{ _id: 'D-8', cd: 'T-H', status: 'active' }],
    offers: [{ no: 'CO-Q', caseId: 'D-8', buyerCo: 'مشتری ق', rialBasis: 9000000, invRef: { rialBasis: 'CO-Q', price: 9 } }],
    invoices: [{ id: 'IQ', no: 'INV-Q-1', invDate: '2026-05-10', offerNo: 'CO-Q', amount: 9000000, base: 9000000 }],
  });
  const html = h.render();
  T('۴.۵ ارجاع ریالیِ ساده (rialBasis == خودِ پیشنهاد) ردیف را می‌شناسد', html.indexOf('✅ فاکتور INV-Q-1') > -1);
  T('۴.۶ و خط «مبنای ریالی از پیشنهاد ارزی …  نرخ ۰ ریال» ساختگی چاپ نمی‌شود', html.indexOf('💱 مبنای ریالی از پیشنهاد ارزی') === -1);
}

/* ── ۵) فاکتور بی‌offerNo: نجات از پروندهٔ مبدأ ────────────────────────────── */
head('۵. نجات از پروندهٔ فروش');
{
  const h = mk({
    deals: [{ _id: 'D-9', cd: 'T-I', status: 'active' }],
    offers: [{ no: 'CO-S', caseId: 'D-9', buyerCo: 'مشتری س', invRef: { price: 1 } }],
    invoices: [{ id: 'IS', no: 'INV-S-1', invDate: '2026-05-11', caseId: 'D-9', offerNo: '', amount: 42, base: 42 }],
  });
  const html = h.render();
  T('۵.۱ با یک ردیف روی پرونده، فاکتور به همان ردیف وصل می‌شود', html.indexOf('✅ فاکتور INV-S-1') > -1);
  T('۵.۲ بج «🧭 وصل‌شده از پرونده» دیده می‌شود', html.indexOf('🧭 وصل‌شده از پرونده') > -1);
  T('۵.۳ بخش یتیم خالی می‌ماند', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1);
}
{
  const h = mk({
    deals: [{ _id: 'D-10', cd: 'T-J', status: 'active' }],
    offers: [{ no: 'O-10', caseId: 'D-10', invRef: { price: 1 } }, { no: 'O-10b', caseId: 'D-10', invRef: { price: 1 } }],
    invoices: [{ id: 'I10', no: 'INV-10', invDate: '2026-05-12', caseId: 'D-10', offerNo: '', amount: 1, base: 1 }],
  });
  const html = h.render();
  T('۵.۴ با چند ردیف روی یک پرونده حدس نمی‌زنیم — در بخش یتیم می‌نشیند',
    /🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع \(1\)/.test(html) && html.indexOf('INV-10') > -1);
}

/* ── ۶) ترتیب، سقف، و فیلترِ ابطال‌شده‌ها ─────────────────────────────────── */
head('۶. ترتیب و سقف');
{
  const h = mk({ invoices: [{ id: 'V', no: 'INV-V', invDate: '2026-06-01', caseId: 'D-Z', offerNo: 'GONE', voided: true }] });
  const html = h.render();
  T('۶.۱ فاکتور ابطال‌شده در بخش یتیم نمی‌آید', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1);
  T('۶.۲ ولی پنل خالی، دلیلِ «داده هست ولی ارجاع نیست» را می‌گوید', html.indexOf('هیچ پیشنهادی «ارجاع فعال» (invRef) ندارد') > -1 && html.indexOf('دادهٔ این دستگاه: 1 فاکتور') > -1);
}
{
  const invs = [];
  for (let i = 0; i < 45; i++) invs.push({ id: 'X' + i, no: 'INV-X-' + (100 + i), invDate: '2026-0' + (1 + (i % 8)) + '-15', offerNo: 'GONE-' + i, amount: i, base: i });
  const h = mk({ invoices: invs });
  const html = h.render();
  T('۶.۳ شمارش کل یتیم‌ها چاپ می‌شود', /🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع \(45\)/.test(html));
  T('۶.۴ رندر سقف‌دار است (۴۰ کارت) تا صفحه سنگین نشود', count(html, '📎 اسناد') === 40, 'cnt=' + count(html, '📎 اسناد'));
  T('۶.۵ پیام «… و ۵ مورد دیگر» هست', html.indexOf('… و 5 مورد دیگر') > -1);
}
{
  const h = mk({
    invoices: [
      { id: 'OLD', no: 'INV-OLD', invDate: '2026-01-01', offerNo: 'G1', amount: 1, base: 1 },
      { id: 'NEW', no: 'INV-NEW', invDate: '2026-07-01', offerNo: 'G2', amount: 1, base: 1 },
      { id: 'MID', no: 'INV-MID', invDate: '2026-04-01', offerNo: 'G3', amount: 1, base: 1 },
    ],
  });
  const html = h.render();
  T('۶.۶ تازه‌ترها اول می‌آیند (ترتیب کاهشیِ تاریخ)', html.indexOf('INV-NEW') < html.indexOf('INV-MID') && html.indexOf('INV-MID') < html.indexOf('INV-OLD'));
}

/* ── ۷) فاکتور ناظیر به این بخش راه ندارد ──────────────────────────────────── */
head('۷. فاکتور ناظیر');
{
  const h = mk({
    deals: [{ _id: 'D-U', cd: 'T-U', status: 'active' }],
    invoices: [
      { id: 'UN', no: 'INV-UN', invDate: '2026-06-01', caseId: 'D-U', offerNo: 'NOPE', isUnofficial: 1, amount: 5, base: 5 },
      { id: 'OF', no: 'INV-OF', invDate: '2026-06-02', caseId: 'D-U', offerNo: 'NOPE', amount: 6, base: 6 },
    ],
  });
  const html = h.render();
  T('۷.۱ فاکتور رسمیِ یتیم نمایش داده می‌شود', html.indexOf('INV-OF') > -1);
  T('۷.۲ فاکتور ناظیر اینجا رندر نمی‌شود (دفتر خودش فیلتر مجزا دارد)', html.indexOf('INV-UN') === -1);
  T('۷.۳ شمارش یتیم هم ناظیر را نمی‌شمارد', /🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع \(1\)/.test(html));
}

/* ── ۸) جست‌جو روی هر دو بخش (F5) ──────────────────────────────────────────── */
head('۸. جست‌جو');
{
  const inputs = { invSrch: { value: 'آژاها' } };
  const h = mk({
    inputs,
    deals: [{ _id: 'D-G', cd: 'TR-777', status: 'active' }],
    offers: [
      { no: 'G-1', caseId: 'D-G', buyerCo: 'آژاها', inqNo: 'TR-777', invRef: { price: 1 } },
      { no: 'G-2', caseId: 'D-G', buyerCo: 'دیگران', inqNo: 'TR-000', invRef: { price: 1 } },
    ],
    invoices: [{ id: 'G9', no: 'INV-G9', invDate: '2026-06-03', caseId: 'D-G', offerNo: 'GHOST', amount: 1, base: 1 }],
  });
  const html = h.render();
  T('۸.۱ ردیف‌ها با جست‌جو فیلتر می‌شوند', html.indexOf('data-inv-row="G_1"') > -1 && html.indexOf('data-inv-row="G_2"') === -1, html.slice(0, 200));
  T('۸.۲ فاکتور یتیم هم فیلتر می‌شود (اینجا نباید باشد)', html.indexOf('INV-G9') === -1);
  inputs.invSrch.value = 'INV-G9';
  const html2 = h.render();
  T('۸.۳ جست‌جو در شمارهٔ فاکتور، همان کارت یتیم را می‌آورد', html2.indexOf('INV-G9') > -1 && html2.indexOf('data-inv-row="G_1"') === -1);
  inputs.invSrch.value = 'zzz-چیزی-نیست';
  const html3 = h.render();
  T('۸.۴ جست‌جوی بی‌نتیجه پیامِ خودش را دارد (نه پیام «هیچ ارجاعی نیست»)', html3.indexOf('پیدا نشد') > -1 && html3.indexOf('هیچ ردیفی با جستجوی') > -1);
  inputs.invSrch.value = '';
  const html4 = h.render();
  T('۸.۵ با پاک شدن جست‌جو همه‌چیز برمی‌گردد', html4.indexOf('data-inv-row="G_2"') > -1 && html4.indexOf('INV-G9') > -1);
}

/* ── ۹) بازخوانی خودکار روی دادهٔ کهنه (F3/F4) ────────────────────────────── */
head('۹. بازخوانی خودکار');
{
  const h = mk({});
  let pulled = 0;
  h.ctx.ptfSyncPullNow = function (cb) {
    pulled++;
    h.invoices.push({ id: 'FROMSRV', no: 'INV-SRV', invDate: '2026-06-06', caseId: 'D-S', offerNo: '', amount: 9, base: 9 });
    cb(null, 'ok');
  };
  const html0 = h.render();
  T('۹.۱ پنلِ خالی یک تاخیرِ امن می‌چیند (نه حلقهٔ بی‌پایان)', h.timers.length === 1 && !!h.timers[0] && h.timers[0].ms === 120, JSON.stringify(h.timers.map((t) => t.ms)));
  T('۹.۲ در همان حالت، پیامِ «همگام‌سازی کامل نشده» هست', html0.indexOf('احتمالاً همگام‌سازی کامل نشده') > -1);
  if (h.timers[0]) h.timers[0].fn();
  T('۹.۳ پاشدنِ تاخیر، ptfSyncPullNow را صدا می‌زند', pulled === 1);
  T('۹.۴ فاکتورِ رسیده از سرور بی‌درنگ در پنل می‌نشیند', h.wrap.innerHTML.indexOf('INV-SRV') > -1);
  T('۹.۵ پس از رسیدن داده، تاخیرِ دیگری صف نمی‌شود', h.timers.length === 1);
}
{
  const h = mk({ invoices: [{ id: 'V2', no: 'INV-V2', offerNo: 'GONE', voided: true }] });
  let pulled = 0;
  h.ctx.ptfSyncPullNow = function (cb) { pulled++; cb(null, 'ok'); };   /* هیچ داده‌ای نمی‌رسد */
  h.render();
  if (h.timers[0]) h.timers[0].fn();
  const t1 = h.timers.length;
  h.render(); h.render();
  T('۹.۶ نگهبانِ یک‌بارمصرف: پنلِ همچنان‌خالی، pull دوم نمی‌سازد (حلقهٔ کشیدن نداریم)',
    pulled === 1 && t1 === 1 && h.timers.length === 1, JSON.stringify([pulled, t1, h.timers.length]));
}
{
  const h = mk({ offers: [{ no: 'P-1', caseId: 'D-P', buyerCo: 'ک', invRef: { price: 1 } }] });
  let pulled = 0;
  h.ctx.ptfSyncPullNow = function (cb) { pulled++; cb(null, 'ok'); };
  const html = h.render();
  T('۹.۷ وقتی ردیفی هست، بازخوانیِ خودکار لازم نیست', pulled === 0 && h.timers.length === 0 && /data-inv-row="P_1"/.test(html));
}
{
  const h = mk({});   /* دستگاهِ بدون ptfSyncPullNow (حالت تست‌های قدیمی) */
  let ok = true;
  try { h.render(); } catch (e) { ok = false; }
  T('۹.۸ نبودِ ptfSyncPullNow پنل را نمی‌شکند و تاخیری نمی‌چیند', ok && h.timers.length === 0);
}

/* ── ۱۰) گاردِ ثبتِ دوباره با دادهٔ کج هم کار می‌کند ───────────────────────── */
head('۱۰. گارد ptfActiveInvoiceOfOffer');
{
  const h = mk({
    offers: [
      { no: 'K-AR', caseId: 'D-K', invRef: { rialBasis: 'K-RL' } },
      { no: 'K-RL', caseId: 'D-K', rialBasis: 100, rialOf: 'K-AR' },
    ],
    invoices: [{ id: 'KK', no: 'INV-K', offerNo: 'K-RL', amount: 100, base: 100 }],
  });
  T('۱۰.۱ ثبت روی نسخهٔ ریالی قفل است', !!h.ctx.ptfActiveInvoiceOfOffer('K-RL'));
  T('۱۰.۲ ثبت روی نسخهٔ ارزیِ همان پرونده هم قفل است (نام مستعار)', !!h.ctx.ptfActiveInvoiceOfOffer('K-AR'));
  T('۱۰.۳ شمارهٔ ناشناخته قفل نیست', !h.ctx.ptfActiveInvoiceOfOffer('K-ZZZ'));
  T('۱۰.۴ ورودی تهی/فضا قفل نیست و نمی‌شکند', !h.ctx.ptfActiveInvoiceOfOffer('   ') && !h.ctx.ptfActiveInvoiceOfOffer(null) && !h.ctx.ptfActiveInvoiceOfOffer(undefined));
  T('۱۰.۵ تطبیق با فاصله/ارقام فارسی هم قفل می‌کند', !!h.ctx.ptfActiveInvoiceOfOffer('k-rl') && !!h.ctx.ptfActiveInvoiceOfOffer(' ۱۲۳ ') === false);
  const h2 = mk({ offers: [{ no: 'K-A', caseId: 'D-K' }], invoices: [{ id: 'KV', no: 'INV-KV', offerNo: 'K-A', voided: true }] });
  T('۱۰.۶ فاکتور ابطال‌شده قفل نمی‌سازد (ابطالِ نادرست قابل جبران می‌ماند)', !h2.ctx.ptfActiveInvoiceOfOffer('K-A'));
  const h3 = mk({ offers: [{ no: 'K-U', caseId: 'D-K' }], invoices: [{ id: 'KU', no: 'INV-KU', offerNo: 'K-U', isUnofficial: 1 }] });
  T('۱۰.۷ فاکتور ناظیر جلوی ثبت فاکتور رسمی را نمی‌گیرد', !h3.ctx.ptfActiveInvoiceOfOffer('K-U'));
}

/* ── ۱۱) درز اطلاعات/اسکیو ─────────────────────────────────────────────────── */
head('۱۱. درز اطلاعات');
{
  const h = mk({
    deals: [{ _id: 'D-X', cd: 'T-X', status: 'active' }],
    invoices: [{ id: 'X1', no: '<img src=x onerror=pwn()>INV-X', invDate: '2026-06-07', caseId: 'D-X', offerNo: '<script>pwn2()</script>', taxUid: '">ƒ', amount: 1, base: 1 }],
  });
  const html = h.render();
  T('۱۱.۱ دادهٔ کاربر در بخش یتیم خنثی می‌شود (no XSS)', html.indexOf('<img src=x') === -1 && html.indexOf('&lt;img') > -1 && html.indexOf('<script>pwn2') === -1);
  T('۱۱.۲ و با این حال سند دیده می‌شود (escape مانع نمایش نشده)', html.indexOf('&lt;img src=x onerror=pwn()&gt;') > -1);
  T('۱۱.۳ شناسهٔ داخلی در onclick به‌درستی quote شده (arg/esc)', html.indexOf('ptfInvoiceVoid(&#39;X1&#39;)') === -1 && /ptfInvoiceVoid\('X1'\)/.test(html));
}

console.log('\n— tester599 (v34.38.0: دیده‌شدن فاکتورهای ثبت‌شده/ارجاع‌شده) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
