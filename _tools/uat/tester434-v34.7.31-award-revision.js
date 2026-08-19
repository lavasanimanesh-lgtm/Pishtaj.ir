#!/usr/bin/env node
'use strict';
/* v34.7.31 — بستهٔ P4–P6 (سناریوی واقعی کارفرما):
     P4 بازرسی قلم‌به‌قلم + سرنوشت اقلام مردود (انبار / عودت به فروشنده / دوباره‌کاری / اسقاط)
        — عودت به فروشنده اثر مالی فوری دارد (تصمیم کارفرما ۱۴۰۵/۰۵/۲۶)
     P5 فرمان سروری revise_award: سند برد جایگزین، بایگانی سند قبلی، مبلغ مؤثر، correction
        — کاهش مبلغ پس از صدور فاکتور رسمی مسدود است (تصمیم کارفرما)
     P6 گزارش «بازنگری سند برد و سرنوشت اقلام» (نمایش + CSV)
   مرجع: ASSESSMENT-AWARD-REVISION-AND-REF-PRICE-2026-08-17.md */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* ---------- sandbox رفتاری ---------- */
function client(db, opts) {
  opts = opts || {};
  var log = { alerts: [], toasts: [], audits: [], api: [], surplus: [] };
  var store = {};
  var sb = {
    console: console, JSON: JSON, Math: Math, Date: Date, String: String, Number: Number, Array: Array, Object: Object, Promise: Promise,
    setTimeout: function () { return 0; },
    document: { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, body: {} },
    localStorage: {
      getItem: function (k) { return store[k] == null ? null : store[k]; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    getData: function (k) { if (k === 'ptf_crm_supplier_finance') { try { return JSON.parse(store[k] || '{}'); } catch (e) { return {}; } } return db[k] === undefined ? [] : db[k]; },
    setData: function (k, v) { if (k === 'ptf_crm_supplier_finance') { store[k] = JSON.stringify(v); return true; } db[k] = v; return true; },
    escP: function (v) { return String(v == null ? '' : v); },
    ptfOnClickArg: function (v) { return String(v == null ? '' : v); },
    faDateTime: function () { return '1405/05/26 11:00'; }, faDate: function () { return '1405/05/26'; },
    ptfJToISO: function () { return '2026-08-17'; },
    genCode: function (x) { return x + '-T' + (++genCode._n); },
    curSession: function () { return { name: 'مدیر آزمون' }; },
    curRole: function () { return opts.role || 'commercial'; },
    isSenior: function () { return opts.senior !== false; },
    alert: function (m) { log.alerts.push(String(m)); },
    confirm: function () { return opts.confirm !== false; },
    ptfToast: function (m) { log.toasts.push(String(m)); },
    audit: function (a, b) { log.audits.push(a + '|' + b); },
    ptfSurplusAdd: function (pcode, qty, loc, dealCd, note) { log.surplus.push({ pcode: pcode, qty: qty, dealCd: dealCd, note: note }); return { cd: 'SURP-T', prodCd: pcode, qty: qty }; },
    ptfSalesDomainApi: function (a, payload) { log.api.push({ action: a, payload: payload }); return Promise.resolve({ ok: true, result: { revisionOfferNo: 'X-R1', newAmount: 1 } }); },
    ptfSalesDomainCommand: function (a, payload, h) { log.api.push({ action: a, payload: payload }); var d={ok:true,result:{revisionOfferNo:'X-R1',newAmount:1}}; return Promise.resolve().then(function(){if(h&&h.onAck)h.onAck(d);return{state:'acked',response:d};}); },
    renderDeals: function () {}, renderOffers: function () {},
    window: null
  };
  function genCode() {} genCode._n = 0;
  sb.genCode = function (x) { return x + '-T' + (++genCode._n); };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read('crm/finance-helpers.js'), sb, { filename: 'finance-helpers.js' });
  vm.runInContext(read('crm/procurement-link.js'), sb, { filename: 'procurement-link.js' });
  vm.runInContext(read('crm/case-revision.js'), sb, { filename: 'case-revision.js' });
  sb._log = log; sb._store = store;
  return sb;
}

function baseDb() {
  return {
    ptf_crm_deals: [{ _id: 'CASE-1', cd: 'D-1', inqNo: 'RFQ-77', buyerCd: 'CU-1', buyerCo: 'شرکت الف', wonOffer: 'PTF-CO-500', contractAmount: 22000000 }],
    ptf_crm_offers: [{ _id: 'OF-500', no: 'PTF-CO-500', kind: 'CO', st: 'won', currency: 'IRR', inqNo: 'RFQ-77', buyerCd: 'CU-1',
      items: [{ name: 'شیر توپی', pcode: 'P1', unit: 'عدد', qty: 4, price: 5000000 }, { name: 'فلنج', pcode: 'P2', unit: 'عدد', qty: 4, price: 500000 }] }],
    ptf_crm_suppliers: [{ cd: 'SUP-1', co: 'تامین الف' }],
    ptf_crm_products: [{ cd: 'P1', nm: 'شیر توپی' }],
    ptf_crm_invoices: [], ptf_crm_purchase_returns: [], ptf_crm_surplus: [], ptf_crm_case_receipts: []
  };
}

/* ---------- P4: ثبت بازرسی و سرنوشت اقلام ---------- */
(function inspection() {
  var db = baseDb(), s = client(db);
  var c = db.ptf_crm_deals[0];
  var rec = {
    cd: 'INSP-1', no: 'IR-1', at: '1405/05/26', by: 'مدیر آزمون', supplierCd: 'SUP-1',
    lines: [
      { name: 'شیر توپی', pcode: 'P1', qtyOffered: 4, qtyRejected: 1, qtyAccepted: 3, disposition: 'stock', dispositionQty: 1, unitCost: 5000000 },
      { name: 'فلنج', pcode: 'P2', qtyOffered: 4, qtyRejected: 2, qtyAccepted: 2, disposition: 'supplier_return', dispositionQty: 2, unitCost: 500000 }
    ]
  };
  var eff = s.ptfInspectionApplyDispositions(rec, c);
  T('P4 قلم «ورود به انبار» رکورد موجودی می‌سازد', eff.stock === 1 && s._log.surplus.length === 1 && s._log.surplus[0].qty === 1, JSON.stringify(s._log.surplus));
  T('P4 قلم «عودت به فروشنده» سند مرجوعی خرید می‌سازد', eff.supplierReturn === 1 && db.ptf_crm_purchase_returns.length === 1, JSON.stringify(db.ptf_crm_purchase_returns.length));
  var pr = db.ptf_crm_purchase_returns[0];
  T('P4 مرجوعی خرید به پرونده/تأمین‌کننده/بازرسی لینک است',
    pr.caseId === 'CASE-1' && pr.supplierCd === 'SUP-1' && pr.inspectionCd === 'INSP-1', JSON.stringify(pr));
  T('P4 ارزش مرجوعی درست محاسبه می‌شود (۲ × ۵۰۰٬۰۰۰)', pr.amount === 1000000, pr.amount);

  var sf = JSON.parse(s._store['ptf_crm_supplier_finance'] || '{}');
  var pay = (sf.payments || [])[0];
  T('P4 اثر مالی فوری: پرداخت تهاتری در حساب تأمین‌کننده ثبت می‌شود (تصمیم کارفرما + P7)',
    !!pay && pay.supplierCd === 'SUP-1' && pay.method === 'purchase_return', JSON.stringify(pay));
  T('P4 مبلغ تهاتر برابر ارزش مرجوعی است', pay && pay.amount === 1000000, pay && pay.amount);
  T('P4 پرداخت به سند مرجوعی و پرونده لینک است', pay && pay.sourceReturnCd === pr.cd && pay.caseId === 'CASE-1');
  T('P4 بدون فاکتور خرید باز، کل مبلغ اعتبار تخصیص‌نیافته می‌ماند', pay && pay.unallocated === 1000000 && (pay.allocations || []).length === 0);
  T('P4 رویداد حسابرسی برای حساب تامین ثبت می‌شود', s._log.audits.some(function (x) { return x.indexOf('حساب تامین') === 0; }), JSON.stringify(s._log.audits));

  /* دوباره‌کاری/اسقاط هیچ اثر مالی/انباری ندارند */
  var db2 = baseDb(), s2 = client(db2);
  var eff2 = s2.ptfInspectionApplyDispositions({ cd: 'I2', lines: [{ name: 'x', qtyRejected: 1, disposition: 'scrap', dispositionQty: 1, unitCost: 100 }] }, db2.ptf_crm_deals[0]);
  T('عدم رگرسیون: اسقاط نه انبار می‌سازد نه سند مالی',
    eff2.stock === 0 && eff2.supplierReturn === 0 && db2.ptf_crm_purchase_returns.length === 0 && s2._log.surplus.length === 0);

  /* عودت بدون تأمین‌کننده هیچ سندی نمی‌سازد */
  var db3 = baseDb(), s3 = client(db3);
  var eff3 = s3.ptfInspectionApplyDispositions({ cd: 'I3', supplierCd: '', lines: [{ name: 'x', disposition: 'supplier_return', dispositionQty: 1, unitCost: 100 }] }, db3.ptf_crm_deals[0]);
  T('عدم رگرسیون: عودت بدون تأمین‌کننده سند مالی نمی‌سازد', eff3.supplierReturn === 0 && db3.ptf_crm_purchase_returns.length === 0);
})();

/* ---------- P5: قرارداد فرمان سروری در کلاینت ---------- */
(function reviseClient() {
  var db = baseDb(), s = client(db);
  var aw = s.ptfCaseAwardLines(db.ptf_crm_deals[0]);
  T('P5 اقلام سند برد از پرونده خوانده می‌شوند', aw.items.length === 2 && aw.offer.no === 'PTF-CO-500');
  T('P5 گارد نقش برای بازنگری وجود دارد', /canRevise\(\)/.test(read('crm/case-revision.js')));
  var src = read('crm/case-revision.js');
  T('P5 بازنگری فقط از مسیر سرور انجام می‌شود', /ptfSalesDomainCommand\('revise_award'/.test(src) && src.indexOf('فقط از مسیر سرور انجام می‌شود') > -1);
  T('P5 دلیل بازنگری اجباری است', /دلیل بازنگری الزامی است/.test(src));
  T('P5 پیام مسدودی فاکتور رسمی برای کاربر ترجمه شده', src.indexOf('official_invoice_blocks_decrease') > -1 && src.indexOf('کاهش مبلغ سند برد مسدود است') > -1);
})();

/* ---------- P5: قرارداد سمت سرور ---------- */
(function reviseServer() {
  var php = read('api/sales-domain.php');
  T('P5 فرمان revise_award در سرور تعریف شده', /elseif \(\$action === 'revise_award'\)/.test(php));
  T('P5 نقش‌محور + دلیل اجباری', /revise_award[\s\S]{0,900}sd_require_role\(SD_WIN_ROLES\)[\s\S]{0,400}reason_required/.test(php));
  T('P5 رویژن همان شماره را نگه می‌دارد (sameOffer)', /'sameOffer'=>true/.test(php) && /\$parent\['rev'\] = \$seq/.test(php));
  T('P5 تاریخچه revisionHistory روی همان سند نوشته می‌شود', /revisionHistory/.test(php));
  T('P5 مبلغ مؤثر قرارداد به‌روز می‌شود', /effectiveContractAmount/.test(php) && /awardRevisions/.test(php));
  T('P5 گارد فاکتور رسمی برای کاهش (تصمیم کارفرما)', /official_invoice_blocks_decrease/.test(php));
  T('P5 ابطال فاکتور اختیاری در همان فرمان', /voidInvoices/.test(php) && /voidedInvoiceIds/.test(php));
  T('P5 correction ثبت و تخصیص‌ها بازسازی می‌شوند',
    /'kind'=>'revise_award'/.test(php) && /revise_award[\s\S]{0,8000}sd_rebuild_allocations/.test(php));
  T('P5 awardDocs جاری بازنویسی می‌شود', /\$case\['awardDocs'\] = \$keptTech/.test(php));
})();

/* ---------- P6: گزارش ---------- */
(function report() {
  var db = baseDb(), s = client(db);
  var c = db.ptf_crm_deals[0];
  c.awardRevisions = [{ seq: 1, fromOfferNo: 'PTF-CO-500', toOfferNo: 'PTF-CO-500-R1', oldAmount: 22000000, newAmount: 17000000, delta: -5000000, reason: 'رد ۱ عدد شیر و ۲ فلنج', at: '1405/05/26', by: 'مدیر' }];
  c.inspections = [{ cd: 'INSP-1', no: 'IR-1', at: '1405/05/26', lines: [
    { name: 'شیر توپی', qtyOffered: 4, qtyAccepted: 3, qtyRejected: 1, disposition: 'stock', dispositionQty: 1, unitCost: 5000000 },
    { name: 'فلنج', qtyOffered: 4, qtyAccepted: 2, qtyRejected: 2, disposition: 'supplier_return', dispositionQty: 2, unitCost: 500000 }
  ] }];
  c.effectiveContractAmount = 17000000;
  db.ptf_crm_purchase_returns = [{ cd: 'PRET-1', caseId: 'CASE-1', amount: 1000000 }];
  var d = s.ptfAwardRevisionReportData('CASE-1');
  T('P6 گزارش مبلغ اولیه/مؤثر/دلتا را می‌دهد',
    d.firstAmount === 22000000 && d.effectiveAmount === 17000000 && d.delta === -5000000, JSON.stringify({ a: d.firstAmount, b: d.effectiveAmount, c: d.delta }));
  T('P6 تفکیک سرنوشت اقلام محاسبه می‌شود',
    d.dispositions.stock.qty === 1 && d.dispositions.supplier_return.qty === 2 &&
    d.dispositions.supplier_return.value === 1000000, JSON.stringify(d.dispositions));
  T('P6 اسناد مرجوعی خرید همان پرونده دیده می‌شوند', d.purchaseReturns.length === 1);
  T('P6 گزارش با شناسهٔ دوم پرونده (cd) هم کار می‌کند', !!s.ptfAwardRevisionReportData('D-1'), 'alias');
  T('P6 خروجی CSV در دسترس است', typeof s.ptfAwardRevisionReportCsv === 'function');
  var empty = client(baseDb()).ptfAwardRevisionReportData('CASE-1');
  T('عدم رگرسیون: پروندهٔ بدون بازنگری، گزارش خالی می‌دهد (بدون خطا)', empty.revisions.length === 0 && empty.inspections.length === 0);
})();

/* ---------- اتصال UI ---------- */
(function wiring() {
  var sf = read('crm/salesfiles.js'), idx = read('crm/index.html');
  T('UI سه کاشی جدید در کشوی پرونده هست',
    sf.indexOf("'inspection-items'") > -1 && sf.indexOf("'award-revise'") > -1 && sf.indexOf("'award-report'") > -1);
  T('UI کاشی‌ها با شناسهٔ متعارف پرونده صدا زده می‌شوند (قرارداد v34.7.28)',
    /ptfCaseInspectionOpen\(\\'' \+ ptfOnClickArg\(r\._id \|\| r\.cd\)/.test(sf) && /ptfAwardReviseOpen\(\\'' \+ ptfOnClickArg\(r\._id \|\| r\.cd\)/.test(sf));
  T('UI کاشی گزارش فقط با وجود بازنگری/بازرسی نمایش داده می‌شود',
    /\(r\.awardRevisions \|\| \[\]\)\.length \|\| \(r\.inspections \|\| \[\]\)\.length/.test(sf));
  T('ماژول در index.html بارگذاری می‌شود', /case-revision\.js\?v=/.test(idx));
})();

console.log('\n— tester434 (P4–P6: بازرسی قلم‌به‌قلم، بازنگری سند برد، گزارش) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
