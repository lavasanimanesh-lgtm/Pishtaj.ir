#!/usr/bin/env node
/* =============================================================================
   tester603-v34.37.6-invoice-panel-clip.js
   گزارش کارفرما (ظاهر پنل فاکتورها): «اعداد و نوشته‌ها و سرستون‌ها در هم
   می‌روند؛ شماره سند مبنا با اسم مشتری همپوشان شده؛ سرستون مبلغ/نام مشتری/
   اقدام بالای مقادیر نیست؛ مبلغ فاکتور با مطالبات باز درهم فرو رفته‌اند.»

   ریشه‌ها (crm/official-invoice-v2.js — همان قرارداد INV_COLS نسخه ۳۴.۳۷.۳):
     ① ستون‌های ثابت flex:0 0 — در پنلِ باریک کوتاه‌نشدنی، سرریز به بیرون؛
     ② محتوای بلندتر از عرض ستون هیچ clip نداشت و در RTL سرریز «روی» ستون
        بعدی نوشته می‌شد (سندِ بلند→مشتری، مبلغِ ۱۰ رقمی→مطالبه باز، دکمۀ
        ≈۱۷۰px اقدام→سمت چپ خودش)؛
     ③ جعبۀ سربرگ border نداشت ولی ردیف‌ها کارتِ ۱px لبه‌دار بودند.
   اصلاحِ تثبیت‌شده اینجا: clip (overflow:hidden + ellipsis + title) در خودِ
   قالبِ مشترک، shrink مجاز با کفِ min-width، عرض‌های واقعیِ بزرگ‌تر،
   tabular-nums برای مبالغ، text-align مشترکِ سربرگ/مقدار، و لبه‌ همسان.

   روش: برشِ خودکفای پنل (قرارداد tester598..600) + رندر در vm با دادهٔ
   «بدترین حالت» (نام بلند، مبلغ ۱۱ رقمی، شمارهٔ سند بلند) و سه آزمون جهش.
   ============================================================================= */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const CRM = path.join(__dirname, '..', '..', 'crm');
const SRC = fs.readFileSync(process.env.PTF_PANEL_SRC || path.join(CRM, 'official-invoice-v2.js'), 'utf8');
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

/* ── قالب‌خوانی INV_COLS از خودِ منبع (تک‌مبدأ) ─────────────────── */
const COLS_M = /var INV_COLS = \[([\s\S]*?)\];/.exec(PANEL);
const COLS = COLS_M ? COLS_M[1].match(/\{ id: '([a-z]+)',\s*style: '([^']*)' \}/g) || [] : [];
const COL = COLS.map(function (x) { const m = /\{ id: '([a-z]+)',\s*style: '([^']*)' \}/.exec(x); return { id: m[1], style: m[2] }; });
function col(id) { const c = COL.filter(function (x) { return x.id === id; })[0]; return c ? c.style : ''; }

/* ── هارنس رندر (قرارداد tester600) ─────────────────────────────── */
function worstCase() {
  const REF = { t: '۱۴۰۵/۰۶/۱۴', by: 'lavasan', rialBasis: '' };
  return {
    offers: [
      { no: 'CO-1403/22-الف-ت', buyerCo: 'شرکت مهندسی کنترل صنعت پارس هگمتانه با نامی بسیار بلند برای آزمونِ سرریز', buyerCd: 'CUST-1', inqNo: 'INQ-1', kind: 'CO', caseId: 'D-1', invRef: Object.assign({}, REF) },
    ],
    deals: [{ _id: 'D-1', cd: 'DF-1', status: 'active' }],
    invoices: [
      { id: 'INV-1', no: 'INV-۹۸۷۶۵', offerNo: 'CO-1403/22-الف-ت', caseId: 'D-1', status: 'active', amount: 123456789012, openAmountIRR: 98765432109, base: 100, vat: 10, invDate: '۱۴۰۵/۰۶/۰۱', taxUid: 'UID-1', documents: [] },
    ],
  };
}
function renderWithSrc(src, st) {
  st = st || {};
  const offers = st.offers || [], invoices = st.invoices || [], deals = st.deals || [];
  const wrap = { innerHTML: '' };
  const ctx = {
    console,
    data: (k) => (k === 'ptf_crm_offers' ? offers : k === 'ptf_crm_invoices' ? invoices : k === 'ptf_crm_deals' ? deals : []),
    can: () => true,
    role: () => st.role || 'manager',
    num: (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.eE+-]/g, '')); return isFinite(n) ? n : 0; },
    esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    money: (v) => String(Math.round(Number(v) || 0)),
    faNum: (v) => String(v), fmtDate: (v) => String(v || ''), relTime: (v) => String(v || ''), days: () => 3,
    active: (i) => !!i && !i.voided && i.status !== 'void',
    voided: (i) => !!(i && (i.voided || i.status === 'void')),
    iid: (i) => (i ? (i.id || i._id || i.no) : ''),
    arg: (v) => String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    filesHtml: () => '',
    findInvoice: (no) => invoices.filter((i) => i && (i.id === no || i.no === no))[0] || null,
    findOffer: (no) => offers.filter((o) => o && String(o.no) === String(no))[0] || null,
    findCaseForOffer: (o) => (o ? deals.filter((c) => c && (c._id === o.caseId || c.cd === o.caseId || c.id === o.caseId))[0] || null : null),
    ptfCustNamePair: (cd, co) => ({ fa: co || '', en: '' }),
    ptfRialCompanionOf: () => null,
    ptfSalesFileHasUnofficialInvoice: () => false,
    ptfActiveInvoiceOfOffer: () => null,
    ptfCanRepairOfferWin: () => true,
    ptfRevokeInvoiceRef: () => {}, ptfOfficialInvoiceFilesUi: () => {}, ptfInvoiceVoid: () => {},
    showInvModal: () => {}, ptfGoSalesFile: () => {}, showDealCase: () => {},
    ptfInvRowToggle: () => {}, ptfInvRowsToggleAll: () => {},
    ptfRegisterSortable: () => {}, ptfSorted: (k, arr) => arr,
    document: { getElementById: (id) => (id === 'invWrap' ? wrap : null), documentElement: { innerHTML: '' }, querySelectorAll: () => [] },
    window: {}, alert: () => {}, setTimeout: () => 1,
    _ptfInvOpenRows: {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src + '\n', ctx, { filename: 'panel603.js' });
  ctx.renderInvoices();
  return wrap.innerHTML;
}

/* چک‌کننده‌های رفتار — روی خروجیِ رندر؛ همان‌ها که آزمون جهش قرمزشان می‌کند */
const HEAD_RE = /<div style="display:flex;align-items:center;gap:9px;padding:4px 11px;font-size:11px[^"]*">([\s\S]*?)<\/div>/;
function headerCells(html) {
  const m = HEAD_RE.exec(html);
  return m ? (m[1].match(/<span style="([^"]*)"/g) || []).map((x) => /^<span style="(.*)"$/s.exec(x)[1]) : null;
}
function headerDivStyle(html) { const m = /<div style="([^"]*)">(<span style="width:30px)/.exec(html); return m ? m[1] : ''; }
function rowCells(html) {
  return html.split('data-inv-row=').slice(1).map(function (b) {
    const line = b.split('<div id="invD_')[0];
    return (line.match(/<span style="([^"]*)"/g) || []).map((x) => /^<span style="(.*)"$/s.exec(x)[1]).slice(0, 7);
  });
}
/* همهٔ سلول‌های متنی (ستون‌های ۱..۶ در سربرگ و ردیف‌ها) باید clip داشته باشند */
function clipOk(html) {
  const hc = headerCells(html); if (!hc || hc.length !== 7) return false;
  for (let i = 1; i < 7; i++) if (hc[i].indexOf('overflow:hidden') === -1) return false;
  const rows = rowCells(html); if (!rows.length) return false;
  for (const cells of rows) {
    if (cells.length < 7) return false;
    for (let i = 1; i < 7; i++) if (cells[i].indexOf('overflow:hidden') === -1) return false;
  }
  return true;
}
/* سربرگ و کارتِ ردیف باید هندسۀ افقی همسان داشته باشند: همان لبه ۱px */
function geomOk(html) {
  const hs = headerDivStyle(html);
  return hs.indexOf('border:1px solid var(--brd)') > -1 && /data-inv-row="[^"]*" style="[^"]*border:1px solid var\(--brd\)/.test(html);
}
/* تراز محتوا: دو ستون پولی باید text-align:left و ارقام هم‌عرض داشته باشند —
   در سربرگ و ردیف «با هم»، وگرنه برچسب بالای مقدار نمی‌نشیند */
function alignOk(html) {
  const hc = headerCells(html) || [], rows = rowCells(html) || [];
  const want = ['text-align:left', 'tabular-nums'];
  const ok = (s) => want.every((w) => s.indexOf(w) > -1);
  if (!ok(hc[4]) || !ok(hc[5])) return false;
  return rows.every((cells) => ok(cells[4]) && ok(cells[5]));
}
/* قالب ثابت‌ها باید کوتاه‌شدنی باشد (شکن ≥ ۱) — وگرنه در پنل باریک بیرون می‌زند */
function shrinkOk(cols) {
  return cols.every((c) => c.id === 'arrow' || c.id === 'cust' ? true : /flex:0 1 \d+px/.test(c.style)) &&
    /flex:1 1 auto/.test(cols.filter((c) => c.id === 'cust')[0] ? cols.filter((c) => c.id === 'cust')[0].style : '');
}

/* ── ۱) قرارداد در منبع ─────────────────────────────────────────── */
head('۱. قرارداد clip/shrink در INV_COLS');
T('۱.۰ هفت ستون تعریف شده', COL.length === 7, String(COL.length));
T('۱.۱ هر شش ستونِ متنیِ قالب، clip کامل دارد (hidden + ellipsis + nowrap)',
  ['doc', 'cust', 'status', 'amt', 'open', 'act'].every((id) => col(id).indexOf('overflow:hidden;text-overflow:ellipsis;white-space:nowrap') > -1),
  COL.map((c) => c.id).join(','));
T('۱.۲ هیچ ستون ثابتی flex:0 0 نشده (جز فلش) — پنلِ باریک = جمع‌شدنِ همسان، نه سرریز',
  shrinkOk(COL), COL.map((c) => c.id + ':' + (/flex:(\d) (\d)/.exec(c.style) || [])[0]).join(' '));
T('۱.۳ هر ستونِ shrink‌شدنی کفِ min-width دارد (خوانایی تضمینی در کوچک‌ترین حالت)',
  ['doc', 'cust', 'status', 'amt', 'open', 'act'].every((id) => /min-width:(\d+)px/.test(col(id))));
T('۱.۴ عرضِ پایه از کفش کمتر نیست (flex-basis ≥ min-width — وگرنه همیشه بریده)',
  COL.every((c) => { const mw = /min-width:(\d+)px/.exec(c.style), fx = /flex:[01] 1 (\d+)px/.exec(c.style); return !mw || !fx || +fx[1] >= +mw[1]; }),
  COL.map((c) => c.id).filter((id) => { const mw = /min-width:(\d+)px/.exec(col(id)), fx = /flex:[01] 1 (\d+)px/.exec(col(id)); return mw && fx && +fx[1] < +mw[1]; }).join(','));
T('۱.۵ قراردادِ clip فقط یک‌جا نوشته شده — ردیف‌ها دیگر nowrap یدک نمی‌چسبانند',
  PANEL.indexOf("invCol('doc') + ';white-space:nowrap'") === -1 &&
  PANEL.indexOf("invCol('amt') + ';white-space:nowrap'") === -1 &&
  PANEL.indexOf("invCol('open') + ';white-space:nowrap'") === -1);
T('۱.۶ مقادیرِ قدیمیِ مولدِ همپوشانی (۱۱۲/۱۱۶/۱۲۶/۱۳۸ با flex:0 0) حذف شده‌اند',
  PANEL.indexOf('flex:0 0 112px') === -1 && PANEL.indexOf('flex:0 0 116px') === -1 &&
  PANEL.indexOf('flex:0 0 126px') === -1 && PANEL.indexOf('flex:0 0 138px') === -1);
T('۱.۷ ارقامِ هم‌عرض + چپ‌ترازی در خودِ قالبِ مبلغ/مطالبه (سربرگ هم ارث می‌برد)',
  col('amt').indexOf('text-align:left') > -1 && col('amt').indexOf('tabular-nums') > -1 &&
  col('open').indexOf('text-align:left') > -1 && col('open').indexOf('tabular-nums') > -1);
T('۱.۸ ستون اقدام هم‌اندازۀ واقعیِ دکمه شده (≥۱۷۰px) تا دکمه بیرون نزند',
  (() => { const fx = /flex:0 1 (\d+)px/.exec(col('act')); return !!fx && +fx[1] >= 170; })(), col('act'));

head('۲. سربرگ: برچسب صریح + هندسۀ همسان ردیف');
{
  const hf = /function invHeaderHtml\(\) \{([\s\S]*?)\n  \}/.exec(PANEL);
  const body = hf ? hf[1] : '';
  T('۲.۱ بدنهٔ invHeaderHtml پیدا شد', body.length > 100, String(body.length));
  T('۲.۲ برچسب‌ها با واحد/مفهوم کامل: «شماره سند مبنا» «مبلغ فاکتور (ریال)» «مطالبه باز (ریال)»',
    body.indexOf('شماره سند مبنا') > -1 && body.indexOf('مبلغ فاکتور (ریال)') > -1 && body.indexOf('مطالبه باز (ریال)') > -1);
  T('۲.۳ هر سلولِ سربرگ از همان invCol() می‌خواند (بدون عرض دستی)',
    (body.match(/invCol\('[a-z]+'\)/g) || []).length === 7);
  T('۲.۴ جعبۀ سربرگ لبه/گِردی همسان کارتِ ردیف گرفته (تراز ۱–۲px افست رفع شد)',
    /padding:4px 11px;font-size:11px[^"]*border:1px solid var\(--brd\);border-radius:12px/.test(PANEL));
}
T('۲.۵ سلولِ شمارۀ سند، title با شمارۀ کامل دارد (سه‌نقطه هیچ‌وقت بی‌معنی نمی‌شود)',
  /invCol\('doc'\) \+ '" title="'/.test(PANEL));

/* ── ۳) رفتار روی رندرِ «بدترین حالت» ──────────────────────────── */
head('۳. رفتار رندر (نام بلند + مبلغ ۱۱ رقمی + شماره سند بلند)');
{
  const html = renderWithSrc(PANEL, worstCase());
  T('۳.۰ یک ردیف رندر شد (پایهٔ سنجه‌های بعد)', /data-inv-row=/.test(html));
  T('۳.۱ همهٔ سلول‌های متنیِ سربرگ و ردیف clip دارند — هیچ سرریزی روی همسایه نمی‌نویسد', clipOk(html));
  T('۳.۲ هندسۀ سربرگ == کارتِ ردیف (لبهٔ ۱px در هر دو)', geomOk(html));
  T('۳.۳ ستون‌های پولی: چپ‌ترازی و ارقام هم‌عرض در سربرگ و ردیف با هم', alignOk(html));
  const cells = rowCells(html)[0] || [];
  const hc0 = headerCells(html) || [];
  T('۳.۴ سبکِ هر سلولِ ردیف دقیقاً از همان قالبِ سربرگ شروع می‌شود (تضمینِ تراز)',
    (() => { let ok = hc0.length === 7 && cells.length === 7; for (let i = 0; ok && i < 7; i++) ok = cells[i] === hc0[i] || cells[i].indexOf(hc0[i]) === 0; return ok; })(),
    JSON.stringify({ h: hc0.length, r: cells.length }));
  T('۳.۵ مقدارِ کامل هرگز از DOM حذف نمی‌شود — clip فقط بصری است، number در markup هست',
    html.indexOf('123456789012') > -1 && html.indexOf('98765432109') > -1 &&
    html.indexOf('CO-1403/22-الف-ت') > -1);
  T('۳.۶ برچسب «مبلغ فاکتور (ریال)» بالای مقدار نشست — ترتیبِ DOM: سربرگ، بعد ردیف',
    html.indexOf('مبلغ فاکتور (ریال)') > -1 && html.indexOf('مبلغ فاکتور (ریال)') < html.indexOf('data-inv-row='));
}

/* ── ۴) آزمون جهش — اگر اصلاح‌ها برداشته شوند، سنجه‌های بالا باید بشکنند ── */
head('۴. آزمون جهش');
{
  const MUT_CLIP = PANEL.replace(/overflow:hidden;text-overflow:ellipsis;/g, '');
  T('۴.۱ با حذف clip از قالب، رندرِ سالمِ ۳.۱ قرمز می‌شود ⇒ سنجه بارِ تشخیص دارد',
    MUT_CLIP !== PANEL && !clipOk(renderWithSrc(MUT_CLIP, worstCase())));
  const MUT_GEOM = PANEL.replace('background:#f1f5f9;border:1px solid var(--brd);border-radius:12px;margin:0 0 3px', 'margin:0 0 3px');
  T('۴.۲ با برداشتن لبهٔ سربرگ، ۳.۲ قرمز می‌شود', MUT_GEOM !== PANEL && !geomOk(renderWithSrc(MUT_GEOM, worstCase())));
  const MUT_FLEX = PANEL.replace(/flex:0 1 (\d+)px/g, 'flex:0 0 $1px');
  T('۴.۳ با بازگشت flex:0 0، ۱.۲ قرمز می‌شود', MUT_FLEX !== PANEL && !shrinkOk((() => { const m = /var INV_COLS = \[([\s\S]*?)\];/.exec(MUT_FLEX)[1].match(/\{ id: '([a-z]+)',\s*style: '([^']*)' \}/g) || []; return m.map((x) => { const g = /\{ id: '([a-z]+)',\s*style: '([^']*)' \}/.exec(x); return { id: g[1], style: g[2] }; }); })()));
}

console.log('\n— tester603 (clip/ترازِ ستون‌های پنل فاکتورهای رسمی) —');
console.log('PASS: ' + pass + ' | FAIL: ' + fail);
process.exit(fail ? 1 : 0);
