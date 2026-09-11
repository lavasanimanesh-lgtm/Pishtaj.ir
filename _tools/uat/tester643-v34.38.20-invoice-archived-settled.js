#!/usr/bin/env node
'use strict';
/* ═══ tester643 — v34.38.20 (INV-ARCHIVED-SETTLED) ═══
   گزارش کارفرما: فاکتور تسویه‌شده‌ای که پروندهٔ فروش مرتبطش مختومه/بایگانی شده،
   در پنل فاکتورها به‌صورت «⛔ پرونده فروش یافت نشد» نمایش داده می‌شد — در حالی که
   پرونده پیدا شده و فقط بایگانی است (salesfiles.js در sfArchive پرونده را از
   ptf_crm_deals حذف و به ptf_crm_projects با state:'archived' / origin:'salesfile'
   منتقل می‌کند).

   رفتارِ مطلوب (قفل‌شده در این تستر):
     ① فاکتورِ تسویه‌شده با پروندهٔ مختومه به بخشِ جداگانهٔ «فاکتورهای تسویه‌شده با
       پروندهٔ مختومه» منتقل می‌شود (نه بخشِ ردیف‌های فعال، نه بخش یتیم‌ها).
     ② ردیف می‌گوید «📁 پرونده مختومه شده است» — نه «⛔ پرونده فروش یافت نشد».
     ③ پروندهٔ مختومهٔ غیرِ تسویه‌شده (مانده باز دارد) از «یافت نشد» نجات می‌یابد ولی
       سرِ جایش در ردیف‌های فعال می‌ماند.
     ④ وقتی هیچ پرونده‌ای (فعال یا بایگانی) نیست، پیام قبلی «یافت نشد» حفظ می‌شود.
     ⑤ پروندهٔ فعال دست‌نخورده می‌ماند و به بخشِ مختومه راه پیدا نمی‌کند.

   این تستر رفتاری است: برشِ خودکفای renderInvoices را در vm اجرا می‌کند (قرارداد
   tester599) و خروجیِ #invWrap را می‌سنجد. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'crm', 'official-invoice-v2.js'), 'utf8');
const BEGIN = '  function rowKey(no)';
const END = '  window.showInvModal=function(offerNo,editId){';
const i0 = SRC.indexOf(BEGIN), i1 = SRC.indexOf(END);
if (i0 < 0 || i1 < 0) { console.log('FATAL: برش پنل پیدا نشد'); process.exit(1); }
const PANEL = SRC.slice(i0, i1);

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' → ' + extra : '')); }
}
function head(s) { console.log('\n── ' + s + ' ──'); }
function count(hay, needle) { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) > -1) { n++; i += needle.length; } return n; }

/* ── هارنس (قرارداد tester599 + پشتیبانی ptf_crm_projects و PTF.ar) ── */
function mk(st) {
  st = st || {};
  const offers = st.offers || [], invoices = st.invoices || [], deals = st.deals || [], projects = st.projects || [];
  const wrap = { innerHTML: '' }, calls = [], timers = [];
  const inputs = st.inputs || {};
  const ctx = {
    console,
    data: (k) => (k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : k === 'ptf_crm_deals' ? deals : k === 'ptf_crm_projects' ? projects : []),
    can: () => (st.can === undefined ? true : !!st.can),
    role: () => st.role || 'accountant',
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
    ptfRialCompanionOf: () => null,
    ptfSalesFileHasUnofficialInvoice: () => false,
    ptfCanRepairOfferWin: () => true,
    ptfOfficialInvoiceFilesUi: (id) => calls.push('files:' + id),
    ptfInvoiceVoid: (id) => calls.push('void:' + id),
    showInvModal: (no, edit) => calls.push('modal:' + no + (edit ? '|' + edit : '')),
    ptfGoSalesFile: (cd) => calls.push('deal:' + cd),
    ptfInvRowToggle: (k) => calls.push('toggle:' + k),
    ptfInvRowsToggleAll: (v) => calls.push('all:' + v),
    document: { getElementById: (id) => (id === 'invWrap' ? wrap : inputs[id]), documentElement: { innerHTML: '' }, querySelectorAll: () => [] },
    window: {},
  };
  ctx.window = ctx;
  if (st.PTF) ctx.PTF = st.PTF;
  ctx.alert = () => {};
  ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  ctx._ptfInvOpenRows = st.openRows || {};
  vm.createContext(ctx);
  vm.runInContext(PANEL + '\n', ctx, { filename: 'panel643.js' });
  return { ctx, wrap, calls, timers, render: () => { ctx.renderInvoices(); return wrap.innerHTML; } };
}

/* دادهٔ نمونه — پروندهٔ بایگانی‌شدهٔ salesfile (شکل دقیق sfArchive) */
function archRec(over) {
  return Object.assign({
    cd: 'ARC-INQ-9', no: 'ARC-INQ-9', dealCd: 'INQ-9', buyerCo: 'شرکت آلفا',
    offerNo: 'CO-9', wonOffer: 'CO-9', inqNo: 'INQ-9',
    state: 'archived', origin: 'salesfile', closeKind: 'settled',
    offerNos: ['CO-9'],
  }, over || {});
}
function offer(over) {
  return Object.assign({ no: 'CO-9', caseId: 'INQ-9', inqNo: 'INQ-9', buyerCo: 'شرکت آلفا', invRef: { t: '1405/06/10', by: 'ارشد' } }, over || {});
}
function inv(over) {
  return Object.assign({ id: 'INV-9', no: 'INV-1405-0009', invDate: '1405/06/12', caseId: 'INQ-9', offerNo: 'CO-9', base: 100000000, amount: 110000000, openAmountIRR: 0, documents: [] }, over || {});
}

/* ── ۱) فاکتور تسویه‌شده + پروندهٔ مختومه → بخشِ جداگانه ── */
head('۱. تسویه‌شده با پروندهٔ مختومه');
{
  const h = mk({ offers: [offer()], invoices: [inv()], deals: [], projects: [archRec()] });
  const html = h.render();
  T('۱.۱ به بخش «فاکتورهای تسویه‌شده با پروندهٔ مختومه» منتقل می‌شود', html.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه (1)') > -1, html.slice(0, 200));
  T('۱.۲ شمارهٔ فاکتور تسویه‌شده دیده می‌شود', html.indexOf('INV-1405-0009') > -1);
  T('۱.۳ ردیف همچنان یک ردیف واقعی است (data-inv-row) و فقط یک ردیف است', /data-inv-row="CO_9"/.test(html) && count(html, 'data-inv-row=') === 1);
  T('۱.۴ برچسب «📁 پرونده مختومه شده است» روی ردیف است', html.indexOf('📁 پرونده مختومه شده است') > -1);
  T('۱.۵ پیام نادرست «⛔ پرونده فروش یافت نشد» کاملاً غایب است', html.indexOf('⛔ پرونده فروش یافت نشد') === -1);
  T('۱.۶ به بخش یتیم‌ها (بدون ردیف ارجاع) راه پیدا نمی‌کند', html.indexOf('🧾 فاکتورهای ثبت‌شده بدون ردیف ارجاع') === -1 && html.indexOf('⚠️ بدون ردیف ارجاع') === -1);
  T('۱.۷ دکمهٔ «+ ثبت فاکتور رسمی صادرشده» برای پروندهٔ مختومه پیشنهاد نمی‌شود', html.indexOf('+ ثبت فاکتور رسمی صادرشده') === -1);
  T('۱.۸ کنتور سربرگ «🗂 مختومه» با شمارش یکسان است', html.indexOf('🗂 مختومه: <b>1</b>') > -1);
  T('۱.۹ راهنمای بخش می‌گوید پرونده بایگانی و مطالبه تسویه است', html.indexOf('فقط برای سوابق نمایش داده می‌شوند') > -1);
}

/* ── ۲) مسیر کانُنیکال: PTF.ar.invoiceState تسویه را تعیین می‌کند ── */
head('۲. منبع واحد تسویه (invoiceState)');
{
  /* openAmountIRR کهنه/غیرصفر ولی invoiceState می‌گوید تسویه است → مختومه */
  const h = mk({
    offers: [offer()],
    invoices: [inv({ openAmountIRR: 999999999 })],
    deals: [],
    projects: [archRec()],
    PTF: { ar: { invoiceState: () => ({ open: 0 }) } },
  });
  const html = h.render();
  T('۲.۱ تسویه از منبع واحد (invoiceState) گرفته می‌شود و ردیف به بخش مختومه می‌رود', html.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه (1)') > -1);
  T('۲.۲ ماندهٔ کهنهٔ openAmountIRR نادیده گرفته می‌شود', html.indexOf('⛔ پرونده فروش یافت نشد') === -1);
}

/* ── ۳) پروندهٔ مختومه ولی هنوز مانده باز دارد → ردیف فعال می‌ماند ── */
head('۳. مختومهٔ غیرِ تسویه‌شده');
{
  const h = mk({ offers: [offer()], invoices: [inv({ openAmountIRR: 55000000 })], deals: [], projects: [archRec()] });
  const html = h.render();
  T('۳.۱ «یافت نشد» نشان داده نمی‌شود (پرونده پیدا شده، فقط بایگانی است)', html.indexOf('⛔ پرونده فروش یافت نشد') === -1);
  T('۳.۲ برچسب «📁 پرونده مختومه شده است» جایگزین می‌شود', html.indexOf('📁 پرونده مختومه شده است') > -1);
  T('۳.۳ به بخش تسویه‌شده‌ها منتقل نمی‌شود (مانده باز دارد)', html.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه') === -1);
  T('۳.۴ ردیف در بخش اصلی می‌ماند', /data-inv-row="CO_9"/.test(html) && count(html, 'data-inv-row=') === 1);
}

/* ── ۴) هیچ پرونده‌ای (فعال یا بایگانی) نیست → پیام قبلی حفظ می‌شود ── */
head('۴. بدون پرونده (رگرسیون)');
{
  const h = mk({ offers: [offer()], invoices: [inv({ openAmountIRR: 0 })], deals: [], projects: [] });
  const html = h.render();
  T('۴.۱ پیام «⛔ پرونده فروش یافت نشد» دست‌نخورده است', html.indexOf('⛔ پرونده فروش یافت نشد') > -1);
  T('۴.۲ بخش مختومه ساخته نمی‌شود', html.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه') === -1);
  T('۴.۳ برچسب مختومه ساخته نمی‌شود', html.indexOf('📁 پرونده مختومه شده است') === -1);
}

/* ── ۵) پروندهٔ فعال (غیربایگانی) → رفتار قبلی دست‌نخورده ── */
head('۵. پروندهٔ فعال (رگرسیون)');
{
  const h = mk({
    offers: [offer()],
    invoices: [inv({ openAmountIRR: 0 })],
    deals: [{ _id: 'D-9', cd: 'INQ-9', status: 'active' }],
    projects: [],
  });
  const html = h.render();
  T('۵.۱ ردیف فعال «✅ فاکتور ثبت شده است» نشان می‌دهد', html.indexOf('✅ فاکتور ثبت شده است') > -1);
  T('۵.۲ به بخش مختومه نمی‌رود', html.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه') === -1);
  T('۵.۳ برچسب مختومه و «یافت نشد» هر دو غایب‌اند', html.indexOf('📁 پرونده مختومه شده است') === -1 && html.indexOf('⛔ پرونده فروش یافت نشد') === -1);
}

/* ── ۶) نگهبان‌های تطبیق پروندهٔ بایگانی ── */
head('۶. تطبیق بایگانی');
{
  /* origin غیر salesfile (بایگانی پروژه) → رکورد salesfile محسوب نمی‌شود */
  const h1 = mk({ offers: [offer()], invoices: [inv({ openAmountIRR: 0 })], deals: [], projects: [archRec({ origin: 'project' })] });
  const html1 = h1.render();
  T('۶.۱ بایگانی با origin غیر salesfile، «یافت نشد» را سرکوب نمی‌کند', html1.indexOf('⛔ پرونده فروش یافت نشد') > -1);

  /* state غیر archived → بایگانی‌شده محسوب نمی‌شود */
  const h2 = mk({ offers: [offer()], invoices: [inv({ openAmountIRR: 0 })], deals: [], projects: [archRec({ state: 'active' })] });
  const html2 = h2.render();
  T('۶.۲ رکورد پروژهٔ غیربایگانی (state!=archived) ردیف را مختومه نمی‌کند', html2.indexOf('⛔ پرونده فروش یافت نشد') > -1 && html2.indexOf('📁 پرونده مختومه شده است') === -1);

  /* تطبیق از طریق offerNos (نه wonOffer) */
  const h3 = mk({ offers: [offer()], invoices: [inv({ openAmountIRR: 0 })], deals: [], projects: [archRec({ wonOffer: '', offerNo: '', offerNos: ['CO-9'] })] });
  const html3 = h3.render();
  T('۶.۳ پیوند از فهرست offerNos هم پیدا می‌شود', html3.indexOf('🧾 فاکتورهای تسویه‌شده با پروندهٔ مختومه (1)') > -1 && html3.indexOf('⛔ پرونده فروش یافت نشد') === -1);

  /* هویت ناسازگار (inqNo متفاوت) → تطبیق نادرست رد می‌شود */
  const h4 = mk({ offers: [offer({ inqNo: 'INQ-OTHER' })], invoices: [inv({ openAmountIRR: 0 })], deals: [], projects: [archRec()] });
  const html4 = h4.render();
  T('۶.۴ شمارهٔ پیشنهاد یکسان ولی هویت (inqNo) ناسازگار، اشتباهاً وصل نمی‌شود', html4.indexOf('⛔ پرونده فروش یافت نشد') > -1 && html4.indexOf('📁 پرونده مختومه شده است') === -1);
}

/* ── ۷) helper خالی/تهی نمی‌شکند ── */
head('۷. ورودی‌های تهی');
{
  let ok = true;
  const h = mk({ offers: [offer()], invoices: [], deals: [], projects: [] });
  try { h.render(); } catch (e) { ok = false; }
  T('۷.۱ بدون فاکتور، بدون پرونده → پنل بدون خطا رندر می‌شود', ok);
  const h2 = mk({ offers: [offer({ no: '' })], invoices: [], deals: [], projects: [archRec()] });
  let ok2 = true;
  try { h2.render(); } catch (e) { ok2 = false; }
  T('۷.۲ پیشنهاد بدون شماره → پنل بدون خطا رندر می‌شود', ok2);
}

console.log('\n— tester643 (v34.38.20: فاکتور تسویه‌شده با پروندهٔ مختومه) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
