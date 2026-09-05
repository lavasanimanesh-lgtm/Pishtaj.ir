#!/usr/bin/env node
/* =============================================================================
   tester600-v34.37.3-invoice-panel-undo-immediate.js
   تثبیت دو خواستۀ کارفرما روی پنل فاکتورهای رسمی (v34.37.6):
     ① «وقتی برای یک فاکتور لغو ارجاع می‌زنیم باید بلافاصله از ردیف‌های
        فاکتورهای ثبت‌شده/ارجاع‌شده حذف شود» — نه بعد از رفرش، نه بعد از pull.
     ② «بهم‌ریختگی چینش ستون‌ها در این قسمت» — سربرگ و ردیف باید از یک قالب
        ستونی مشترک بخوانند، وگرنه هر ویرایشِ یکی، تراز را می‌شکند.

   روش: مثل tester599 — برشِ خودکفای crm/official-invoice-v2.js در vm اجرا
   می‌شود و رفتار روی رشتهٔ innerHTMLِ #invWrap سنجیده می‌شود؛ قرارداد
   ptfRevokeInvoiceRef در crm/sales-domain-v2.js با الگوی متنی سنجیده می‌شود
   (آن تابع شبکه‌محور است و در harns بی‌fetch قابل اجرا نیست).
   ============================================================================= */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const CRM = path.join(__dirname, '..', '..', 'crm');
const SRC = fs.readFileSync(process.env.PTF_PANEL_SRC || path.join(CRM, 'official-invoice-v2.js'), 'utf8');
const SD = fs.readFileSync(path.join(CRM, 'sales-domain-v2.js'), 'utf8');
const BEGIN = '  function rowKey(no)';
const END = '  window.showInvModal=function(offerNo,editId){';
const i0 = SRC.indexOf(BEGIN), i1 = SRC.indexOf(END);
if (i0 < 0 || i1 < 0) { console.log('FATAL: برش پنل پیدا نشد — ساختار فایل عوض شده است'); process.exit(1); }
const PANEL = SRC.slice(i0, i1);

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' → ' + extra : '')); }
}
function head(s) { console.log('\n── ' + s + ' ──'); }

/* ── هارنس (قرارداد tester599) ─────────────────────────────── */
function mk(st) {
  st = st || {};
  const offers = st.offers || [], invoices = st.invoices || [], deals = st.deals || [];
  const wrap = { innerHTML: '' }, alerts = [], calls = [];
  const inputs = st.inputs || {};
  const ctx = {
    console,
    data: (k) => (k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : k === 'ptf_crm_deals' ? deals : []),
    can: () => (st.can === undefined ? true : !!st.can),
    role: () => st.role || 'manager',
    num: (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.eE+-]/g, '')); return isFinite(n) ? n : 0; },
    esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    money: (v) => String(Math.round(Number(v) || 0)),
    faNum: (v) => String(v), fmtDate: (v) => String(v || ''), relTime: (v) => String(v || ''), days: () => 3,
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
    ptfSalesFileHasUnofficialInvoice: () => !!st.hasUnofficial,
    ptfActiveInvoiceOfOffer: () => null,
    ptfCanRepairOfferWin: () => true,
    ptfRevokeInvoiceRef: (no) => calls.push('revoke:' + no),
    ptfOfficialInvoiceFilesUi: (id) => calls.push('files:' + id),
    ptfInvoiceVoid: (id) => calls.push('void:' + id),
    showInvModal: (no, edit) => calls.push('modal:' + no + (edit ? '|' + edit : '')),
    ptfGoSalesFile: (cd) => calls.push('deal:' + cd),
    showDealCase: (id) => calls.push('case:' + id),
    ptfInvRowToggle: (k) => calls.push('toggle:' + k),
    ptfInvRowsToggleAll: (v) => calls.push('all:' + v),
    ptfRegisterSortable: () => {}, ptfSorted: (k, arr) => arr,
    document: { getElementById: (id) => (id === 'invWrap' ? wrap : inputs[id]), documentElement: { innerHTML: '' }, querySelectorAll: () => [] },
    window: {},
  };
  ctx.window = ctx;
  ctx.alert = (m) => alerts.push(m);
  ctx.setTimeout = () => 1;
  ctx._ptfInvOpenRows = st.openRows || {};
  if (st.pending) ctx._ptfInvRefPendingRevoke = st.pending;
  vm.createContext(ctx);
  vm.runInContext(PANEL + '\n', ctx, { filename: 'panel600.js' });
  return { ctx, wrap, alerts, calls, render: () => { ctx.renderInvoices(); return wrap.innerHTML; } };
}
const REF = { t: '۱۴۰۵/۰۶/۱۴', by: 'lavasan', rialBasis: 'TO-9' };
const TWO = () => ({
  offers: [
    { no: 'TO-101', buyerCo: 'شرکت آریا کنترل صنعت', buyerCd: 'CUST-1', inqNo: 'INQ-1', kind: 'TO', caseId: 'D-1', invRef: Object.assign({}, REF) },
    { no: 'TO-102', buyerCo: 'شرکت بیستون توسعه با نامی نسبتاً بلند برای آزمون', buyerCd: 'CUST-2', inqNo: 'INQ-2', kind: 'TO', caseId: 'D-2', invRef: Object.assign({}, REF) },
  ],
  deals: [{ _id: 'D-1', cd: 'DF-1', status: 'active' }, { _id: 'D-2', cd: 'DF-2', status: 'active' }],
  invoices: [],
});

/* ── ۰) قرارداد ساختاری: قالب ستون مشترک ───────────────────────── */
head('۰. قالب ستون مشترک (INV-PANEL-COLS)');
const COLS_M = /var INV_COLS = \[([\s\S]*?)\];/.exec(PANEL);
const COL_IDS = COLS_M ? (COLS_M[1].match(/id: '[a-z]+'/g) || []).map((x) => /'([a-z]+)'/.exec(x)[1]) : [];
T('۰.۱ INV_COLS با هفت ستون تعریف شده', COL_IDS.length === 7, COL_IDS.join(','));
T('۰.۲ ترتیب ستون‌ها: فلش، سند مبنا، مشتری، وضعیت، مبلغ، مطالبه باز، اقدام',
  COL_IDS.join('>') === 'arrow>doc>cust>status>amt>open>act', COL_IDS.join('>'));
T('۰.۳ سربرگ از همان قالب ساخته می‌شود (invHeaderHtml) — نه عرض دستی',
  /function invHeaderHtml\(\)/.test(PANEL) && /invHeaderHtml\(\) \+ '<\/div>' \+ rows/.test(PANEL));
T('۰.۴ هیچ عرض دستیِ تکراری در سربرگ/ردیف نمانده (min-width:118px/120px حذف شده)',
  PANEL.indexOf('min-width:118px') === -1 && PANEL.indexOf('min-width:120px') === -1);
T('۰.۵ ستون انعطاف‌پذیر (مشتری) خودش ellipsis می‌شود تا بقیه را جابه‌جا نکند',
  /id: 'cust',\s*style: '[^']*text-overflow:ellipsis[^']*white-space:nowrap/.test(PANEL));
T('۰.۶ ردیف دیگر flex-wrap ندارد (علتِ جابه‌جایی ستون‌ها بین ردیف‌ها)',
  /onclick="ptfInvRowToggle\(\\'' \+ key/.test(PANEL) &&
  !/padding:9px 11px;cursor:pointer;flex-wrap:wrap/.test(PANEL));
T('۰.۷ قالب برای تست بیرونی expose شده', /window\.ptfInvPanelColStyles = function/.test(PANEL));
T('۰.۸ برش، localStorage مستقیم نمی‌نویسد (قرارداد A10)', !/localStorage\./.test(PANEL));

/* ── ۱) ترازِ واقعیِ سربرگ با ردیف‌ها روی خروجی رندر ─────────── */
head('۱. تراز ستون‌ها روی خروجی رندر');
{
  const h = mk(TWO());
  const html = h.render();
  const styles = (html.match(/style="([^"]*)"/g) || []).map((x) => x.slice(7, -1));
  const headM = /<div style="display:flex;align-items:center;gap:9px;padding:4px 11px;font-size:11px[^"]*">([\s\S]*?)<\/div>/.exec(html);
  const headCells = headM ? (headM[1].match(/style="([^"]*)"/g) || []).map((x) => x.slice(7, -1)) : [];
  /* v34.37.6 (INV-PANEL-COL-CLIP): قالب ستون‌ها تکامل یافت — clip و shrink در
     خودِ قالب نشست و عرض‌ها واقعاً بزرگ‌تر شد؛ EXPECT همیشه «بازتابِ INV_COLS»
     است نه صفتِ جدا — همین تازگیِ آن، تست ۱.۲ را زنده نگه می‌دارد. */
  const COLS_SRC = /var INV_COLS = \[([\s\S]*?)\];/.exec(PANEL)[1];
  const EXPECT = COLS_SRC.match(/style: '([^']*)'/g).map((x) => /style: '(.*)'/.exec(x)[1]);
  T('۱.۱ سربرگ دقیقاً هفت سلول با همان قالب دارد', headCells.length === 7, JSON.stringify(headCells));
  T('۱.۲ سربرگ == INV_COLS (حرف‌به‌حرف)', JSON.stringify(headCells) === JSON.stringify(EXPECT), JSON.stringify(headCells));
  /* هر ردیف: هفت سلولِ اولش باید با پیشوند همان قالب شروع شوند */
  const rowBlocks = html.split('data-inv-row=').slice(1);
  T('۱.۳ دو ردیف رندر شد', rowBlocks.length === 2, String(rowBlocks.length));
  let aligned = true, detail = '';
  rowBlocks.forEach((b, ix) => {
    const line = b.split('<div id="invD_')[0];
    const cells = (line.match(/<span style="[^"]*"/g) || []).map((x) => x.slice(13, -1)); /* «<span style="» = 13 کاراکتر */
    /* سلول اولِ هر ردیف همان spanِ داخل دکمهٔ فلش است؛ بقیه ستون‌ها */
    const mine = cells.slice(0, 7);
    if (mine.length < 7) { aligned = false; detail = 'ردیف ' + ix + ' فقط ' + mine.length + ' سلول دارد'; return; }
    mine.forEach((c, i) => {
      const want = EXPECT[i];
      if (c !== want && c.indexOf(want) !== 0) { aligned = false; detail = 'ردیف ' + ix + ' ستون ' + i + ': ' + c + ' ≠ ' + want; }
    });
  });
  T('۱.۴ هر ردیف، همان هفت عرض را به همان ترتیب دارد (تراز تضمین‌شده)', aligned, detail);
  T('۱.۵ با نام مشتریِ بلند هم تراز نمی‌شکند (no wrap در ردیف)', html.indexOf('flex-wrap:wrap" onclick="ptfInvRowToggle') === -1 && styles.length > 0);
}

/* ── ۲) «بلافاصله پاک شود» — رفتار view با پرچم لغو ارجاع ───────── */
head('۲. حذف فوری ردیف پس از «لغو ارجاع»');
{
  const base = TWO();
  const h1 = mk(base);
  const html1 = h1.render();
  T('۲.۱ پیش از لغو، هر دو ردیف و هر دو کنتور دیده می‌شوند',
    html1.indexOf('TO-101') > -1 && html1.indexOf('TO-102') > -1 && /📤 ارجاع‌شده: <b>2/.test(html1), html1.slice(0, 60));
  const h2 = mk(Object.assign({}, base, { pending: { 'TO-101': 1 } }));
  const html2 = h2.render();
  T('۲.۲ با لغو ارجاعِ TO-101 آن ردیف نمی‌ماند (بدون رفرش/pull)',
    html2.indexOf('data-inv-row="TO_101"') === -1 && html2.indexOf('TO_101') === -1, 'ردیف هنوز در خروجی است');
  T('۲.۳ ردیف دیگر دست‌نخورده می‌ماند', html2.indexOf('TO-102') > -1);
  T('۲.۴ کنتور «ارجاع‌شده» هم همان لحظه کم می‌شود', /📤 ارجاع‌شده: <b>1/.test(html2), (/[📤]{1} ارجاع‌شده: <b>\d/.exec(html2) || ['—'])[0]);
  T('۲.۵ «ثبت‌شده» هم زیاد نمی‌شود/کاهش می‌یابد (ردیف از هر دو گروه می‌رود)', /✅ ثبت‌شده: <b>0/.test(html2));
  T('۲.۶ ردیفِ لغو‌شده به بخش «بدون ردیف ارجاع» (یتیم‌ها) هم نشت نمی‌کند',
    html2.indexOf('بدون ردیف ارجاع') === -1 || html2.indexOf('TO-101') === -1);
  /* پرچم نشست‌محور است و با پاک‌شدن، ردیف برمی‌گردد (neither sticky nor persisted) */
  const h3 = mk(TWO());
  T('۲.۷ پرچم فقط همین نشست است؛ بدون آن ردیف بازمی‌گردد', h3.render().indexOf('TO-101') > -1);
}

/* ── ۳) قرارداد ptfRevokeInvoiceRef — اعمال محلی، سازگاری، بازگشت ── */
head('۳. ptfRevokeInvoiceRef (crm/sales-domain-v2.js)');
{
  const a = SD.indexOf('window.ptfRevokeInvoiceRef=function');
  const b = SD.indexOf('window.ptfRepairOrphanOffer=function', a);
  const F = a > -1 && b > a ? SD.slice(a, b) : '';
  T('۳.۰ بدنۀ تابع پیدا شد', F.length > 500, String(F.length));
  T('۳.۱ پیش از فرمان، آرایۀ محلی از کانال projection نوشته می‌شود (revoke-only)',
    F.indexOf("applyLocalProjection('ptf_crm_offers', nextArr)") > -1 &&
    F.indexOf("applyLocalProjection('ptf_crm_offers', nextArr)") < F.indexOf("command('revoke_invoice_ref'"));
  T('۳.۲ render بلافاصله پس از اعمال محلی صدا زده می‌شود (نه فقط در onAck)',
    F.indexOf('paintNow();') > -1 && F.indexOf('paintNow();') < F.indexOf("command('revoke_invoice_ref'"));
  T('۳.۳ فقط invRef حذف و مهرِ لغو گذاشته می‌شود (دست به سایر فیلدها نمی‌برد)',
    /c\.invRefRevokedAt = nowIso/.test(F) && /delete c\.invRef;/.test(F) && !/c\.st\b|c\.status/.test(F));
  T('۳.۴ نوشتن از مسیر projection است، نه setData/روتر (هیچ push ساختگی نیست)',
    F.indexOf('setData(') === -1 && F.indexOf('ptfEntitySaveCollection') === -1 && F.indexOf('ptfSilentWrite') === -1);
  T('۳.۵ بدون rev اعمال می‌شود تا گاردِ krevs (sync.js:887) باز آن را نیندازد',
    /function applyLocalProjection\(k,v\)[\s\S]{0,120}ptfSyncApplyServerProjection\(k,v\)/.test(SD));
  T('۳.۶ در ACK، آرایۀ سرور (d.data) مرجع است و پرچم پاک می‌شود',
    /onAck:function\(d\)\{[\s\S]{0,900}d\.data && d\.data\.ptf_crm_offers[\s\S]{0,400}applyLocalProjection\('ptf_crm_offers', srv\)/.test(F));
  T('۳.۷ در رد، تغییر محلی کامل بازگردانده می‌شود (هیچ «نیمه‌ثبت‌شدگی» نمی‌ماند)',
    /onReject:function\(e\)\{[\s\S]{0,400}applyLocalProjection\('ptf_crm_offers', prevArr\)/.test(F));
  T('۳.۸ نتیجهٔ نامشخص هم به حالت قبل برمی‌گردد و صادقانه هشدار می‌دهد',
    /onUncertain:function\(e\)\{[\s\S]{0,600}applyLocalProjection\('ptf_crm_offers', prevArr\)[\s\S]{0,300}نامشخص/.test(F));
  T('۳.۹ پرچم در هر سه مسیر پاک می‌شود (نشت وضعیت نبود)', (F.match(/releasePending\(\);/g) || []).length >= 3, String((F.match(/releasePending\(\);/g) || []).length));
  T('۳.۱۰ پیش‌شرط‌های ایمنی v34.37.0 دست‌نخورده‌اند (دلیل اجباری + تأیید + گارد نقش)',
    /if\(reason===null\|\|!reason\.trim\(\)\)return;/.test(F) && /if\(!confirm\(/.test(F) && /canRepairOfferWin\(\)/.test(F.slice(0, 900)));
  T('۳.۱۱ هیچ فاکتور فعالی در این تابع لغو/ابطال نمی‌شود (فقط ارجاع)',
    F.indexOf('ptfInvoiceVoid') === -1 && F.indexOf("'invoice_void'") === -1 && F.indexOf('entity_delete') === -1);
}

/* ── ۴) آزمون جهش: اگر محافظ‌ها برداشته شوند، همین تست باید بشکند ── */
head('۴. آزمون جهش (تستر واقعاً بارِ تشخیص دارد)');
{
  const MUT1 = PANEL.replace(/return o && o\.invRef && !o\.rialOf && !pendingRevoke\[String\(o\.no \|\| ''\)\];/, 'return o && o.invRef && !o.rialOf;');
  const MUT2 = PANEL.replace(/var INV_COLS = \[[\s\S]*?\];/, "var INV_COLS = [{ id: 'arrow', style: 'width:30px' }];");
  function renderWith(src, pending) {
    const ctx = {
      console, data: (k) => (k === 'ptf_crm_offers' ? TWO().offers : []), can: () => true, role: () => 'manager',
      num: (v) => +v || 0, esc: (v) => String(v == null ? '' : v), money: (v) => String(v), faNum: String, fmtDate: String, relTime: () => '', days: () => 0,
      active: (i) => !!i && !i.voided, voided: (i) => !!(i && i.voided), iid: (i) => (i ? i.id || i.no : ''), arg: String,
      filesHtml: () => '', findInvoice: () => null, findOffer: () => null, findCaseForOffer: () => null,
      ptfCustNamePair: (cd, co) => ({ fa: co || '', en: '' }), ptfRialCompanionOf: () => null, ptfSalesFileHasUnofficialInvoice: () => false,
      ptfActiveInvoiceOfOffer: () => null, ptfCanRepairOfferWin: () => true, ptfRevokeInvoiceRef: () => {}, ptfOfficialInvoiceFilesUi: () => {},
      ptfInvoiceVoid: () => {}, showInvModal: () => {}, ptfGoSalesFile: () => {}, showDealCase: () => {}, ptfInvRowToggle: () => {},
      ptfInvRowsToggleAll: () => {}, ptfRegisterSortable: () => {}, ptfSorted: (k, arr) => arr,
      document: { getElementById: () => null, querySelectorAll: () => [] }, window: {}, alert: () => {}, setTimeout: () => 1,
      _ptfInvRefPendingRevoke: pending || {}, _ptfInvOpenRows: {},
    };
    ctx.window = ctx;
    const wrap = { innerHTML: '' };
    ctx.document.getElementById = (id) => (id === 'invWrap' ? wrap : null);
    vm.createContext(ctx);
    vm.runInContext(src + '\n', ctx, { filename: 'mut.js' });
    ctx.renderInvoices();
    return wrap.innerHTML;
  }
  T('۴.۱ با حذفِ فیلترِ pending، ردیف برمی‌گشت ⇒ تست ۲.۲ بارِ تشخیص دارد',
    MUT1 !== PANEL && renderWith(MUT1, { 'TO-101': 1 }).indexOf('TO-101') > -1);
  T('۴.۲ سالم، همان سناریو ردیف را نشان نمی‌دهد', renderWith(PANEL, { 'TO-101': 1 }).indexOf('TO-101') === -1);
  T('۴.۳ با قالب ستونیِ دست‌کاری‌شده، رندر می‌شکند یا تراز از بین می‌رود ⇒ تست ۱.۲ بارِ تشخیص دارد',
    MUT2 !== PANEL && (() => { try { const h = renderWith(MUT2, {}); return h.indexOf('سند مبنا') === -1 || !/min-width:96px/.test(h); } catch (e) { return true; } })());
}

console.log('\n— tester600 (v34.37.6: حذف فوری ردیف پس از لغو ارجاع + تراز ستون‌های پنل فاکتور) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
