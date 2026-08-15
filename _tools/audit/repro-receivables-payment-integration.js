/* =====================================================================
   Repro harness (Node) — یکپارچگی «ثبت وصولی» بین مطالبات / حساب مشتری / پرونده
   هدف: بازتولید عددی گزارش کارفرما («مشتری پرداخت کرده، رقم دیده می‌شود اما از
   مطالبات باز کسر نشده») بدون نیاز به مرورگر و بدون PHP.

   روش: تابع تخصیص FIFO سرور (sd_rebuild_allocations در api/sales-domain.php)
   خط‌به‌خط به JS پورت شده و خواننده‌های واقعی کلاینت
   (PTF.invPaidSum از crm/finance-helpers.js و cf* از crm/customer-finance.js)
   روی همان داده اجرا می‌شوند تا اختلاف سه نما نشان داده شود.

   اجرا: node _tools/audit/repro-receivables-payment-integration.js
   این فایل فقط ابزار ممیزی است و در بارگذاری CRM نقشی ندارد.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');

/* ---------- پورت وفادار تخصیص FIFO سرور (api/sales-domain.php:179-244) ---------- */
function sdActive(x) {
  const st = String((x && (x.status || x.st)) || '').toLowerCase();
  return !!x && ['void', 'voided', 'deleted', 'cancelled', 'replaced', 'superseded'].indexOf(st) < 0 && !x.voided && !x.deleted;
}
function num(v) { return +v || 0; }
function sdRebuildAllocations(caseId, receipts, invoices, allocations) {
  allocations.length = 0;
  const invoiceIdx = [];
  invoices.forEach((inv, i) => {
    if (String(inv.caseId || '') !== caseId || !sdActive(inv)) return;
    inv.allocatedBase = 0; inv.allocatedVat = 0;
    invoiceIdx.push(i);
  });
  const receiptIdx = [];
  receipts.forEach((r, i) => {
    if (String(r.caseId || '') !== caseId || !sdActive(r) || r.status !== 'posted') return;
    r.allocatedIRR = 0; r.creditRemainIRR = Math.round(num(r.amountIRR || r.amt));
    receiptIdx.push(i);
  });
  receiptIdx.forEach((ri) => {
    let available = Math.round(num(receipts[ri].amountIRR));
    /* ← قاعدهٔ حساس: VAT فقط وقتی تخصیص می‌گیرد که timing برابر post_invoice باشد */
    const allowVat = String(receipts[ri].timing || 'pre_invoice') === 'post_invoice';
    invoiceIdx.forEach((ii) => {
      if (available <= 0) return;
      const base = Math.round(num(invoices[ii].base || invoices[ii].baseAmountIRR));
      const baseRoom = Math.max(0, base - num(invoices[ii].allocatedBase));
      if (baseRoom > 0) {
        const take = Math.min(available, baseRoom);
        allocations.push({ caseId, receiptId: receipts[ri]._id, invoiceId: invoices[ii]._id, component: 'base', amountIRR: take, status: 'active' });
        invoices[ii].allocatedBase += take; receipts[ri].allocatedIRR += take; available -= take;
      }
      if (available > 0 && allowVat) {
        const vat = Math.round(num(invoices[ii].vat || invoices[ii].vatAmountIRR));
        const vatRoom = Math.max(0, vat - num(invoices[ii].allocatedVat));
        if (vatRoom > 0) {
          const take = Math.min(available, vatRoom);
          allocations.push({ caseId, receiptId: receipts[ri]._id, invoiceId: invoices[ii]._id, component: 'vat', amountIRR: take, status: 'active' });
          invoices[ii].allocatedVat += take; receipts[ri].allocatedIRR += take; available -= take;
        }
      }
    });
    receipts[ri].creditRemainIRR = available;
  });
  invoiceIdx.forEach((ii) => {
    const base = Math.round(num(invoices[ii].base));
    const vat = Math.round(num(invoices[ii].vat));
    invoices[ii].openBaseIRR = Math.max(0, base - num(invoices[ii].allocatedBase));
    invoices[ii].openVatIRR = Math.max(0, vat - num(invoices[ii].allocatedVat));
    invoices[ii].openAmountIRR = invoices[ii].openBaseIRR + invoices[ii].openVatIRR;
  });
}

/* ---------- خواننده‌های واقعی کلاینت ---------- */
function clientViews(db) {
  const sandbox = {
    console, JSON, Math, Date, setTimeout: () => 0,
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    getData: (k) => (db[k] === undefined ? [] : db[k]),
    setData: (k, v) => { db[k] = v; return true; },
    escP: (v) => String(v == null ? '' : v),
    faDate: () => '1405/05/25', faDateTime: () => '1405/05/25 10:00',
    curSession: () => ({ user: 'u', name: 'کاربر' }),
    curRole: () => 'admin',
    ptfCanSeeLedger: () => true,
    audit: () => {}, alert: () => {}, ptfToast: () => {},
    PTF_SALES_DOMAIN_V2: true,
    PTF: {}
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['crm/finance-helpers.js', 'crm/customer-finance.js'].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  });
  return sandbox;
}

function report(title, db, custCd, caseId) {
  const s = clientViews(db);
  const invoices = db.ptf_crm_invoices;
  const receipts = db.ptf_crm_case_receipts;

  /* نمای ۱ — پنل «مطالبات» (crm/rbac.js:renderReceivables) */
  let recvOpen = 0, recvPaid = 0, recvBilled = 0;
  invoices.filter((i) => i.status !== 'void' && i.status !== 'superseded').forEach((i) => {
    const paid = s.PTF.invPaidSum(i);
    recvBilled += num(i.amount); recvPaid += paid;
    recvOpen += Math.max(0, num(i.amount) - paid);
  });

  /* نمای ۲ — «حساب مشتریان» (crm/customer-finance.js) */
  const row = (s.cfAccountRows('') || []).filter((r) => r.cd === custCd)[0] || {};
  const audit = s.cfCreditAudit(custCd);

  /* نمای ۳ — «پرونده» (crm/sales-domain-v2.js: caseTotals) */
  const rs = receipts.filter((r) => r.caseId === caseId && sdActive(r) && r.status === 'posted');
  const ins = invoices.filter((i) => i.caseId === caseId && sdActive(i));
  const caseView = {
    received: rs.reduce((a, r) => a + num(r.amountIRR || r.amt), 0),
    allocated: rs.reduce((a, r) => a + num(r.allocatedIRR), 0),
    credit: rs.reduce((a, r) => a + num(r.creditRemainIRR), 0),
    open: ins.reduce((a, i) => a + (i.openAmountIRR != null ? num(i.openAmountIRR) : Math.max(0, num(i.amount) - num(i.allocatedBase) - num(i.allocatedVat))), 0)
  };

  /* نمای ۲ب — گردش حساب مشتری (cfLedgerRows): مدل «نقدی» — فاکتور بدهکار، رسید بستانکار */
  const ledger = s.cfLedgerRows(custCd, {}) || [];
  const ledgerBalance = ledger.length ? ledger[ledger.length - 1].balance : 0;

  const fa = (v) => Math.round(v).toLocaleString('en-US');
  console.log('\n════ ' + title + ' ════');
  console.log('پول واقعی دریافت‌شده از مشتری          : ' + fa(caseView.received));
  console.log('نمای ۱ — مطالبات   : فاکتور ' + fa(recvBilled) + ' | وصولی ' + fa(recvPaid) + ' | مانده ' + fa(recvOpen));
  console.log('نمای ۲ — حساب مشتری: بدهی ' + fa(row.balance || 0) + ' | اعتبار ' + fa(row.credit || 0) + ' | خالص ' + fa(row.net || 0));
  console.log('نمای ۲ب— گردش حساب: ماندهٔ پایانی ردیف‌ها ' + fa(ledgerBalance) + '  (' + ledger.length + ' ردیف)');
  console.log('نمای ۳ — پرونده    : دریافت ' + fa(caseView.received) + ' | تخصیص ' + fa(caseView.allocated) + ' | بستانکاری ' + fa(caseView.credit) + ' | مطالبات باز ' + fa(caseView.open));
  console.log('جزئیات فاکتور      : ' + invoices.map((i) => (i.no || i.cd) + ' amount=' + fa(i.amount) + ' base=' + fa(i.base) + ' vat=' + fa(i.vat) +
    ' allocBase=' + fa(i.allocatedBase || 0) + ' allocVat=' + fa(i.allocatedVat || 0) + ' openSrv=' + (i.openAmountIRR == null ? '—' : fa(i.openAmountIRR)) + ' caseId=' + (i.caseId || '∅')).join('\n                     '));
  const cash = caseView.received;
  const truth = Math.max(0, recvBilled - cash); /* حقیقت اقتصادی: فاکتور فعال منهای پول واقعی دریافت‌شده */
  const consistent = Math.abs(recvOpen - caseView.open) < 1 && Math.abs((row.balance || 0) - recvOpen) < 1 && Math.abs(ledgerBalance - recvOpen) < 1;
  console.log('مانده صحیح اقتصادی (فاکتور − پول دریافتی): ' + fa(truth));
  console.log(consistent ? (Math.abs(truth - recvOpen) < 1 ? '✅ همهٔ نماها درست و هم‌خوان‌اند' : '❌ همهٔ نماها هم‌خوان ولی همگی نادرست (پول دیده نمی‌شود)')
                         : '❌ ناسازگاری بین نماها');
  return { recvOpen, recvPaid, caseView, row, audit };
}

/* ===================== سناریو ۱ — پیش‌پرداخت پیش از صدور فاکتور ===================== */
(function scenarioPreInvoiceVat() {
  const caseId = 'CASE-1';
  const receipts = [{ _id: 'RCPT-1', caseId, customerId: 'CU-1', amountIRR: 1090000000, amt: 1090000000,
    receivedAt: '2026-05-01', method: 'bank_transfer', status: 'posted', timing: 'pre_invoice' /* هنگام دریافت هنوز فاکتوری نبود */ }];
  const invoices = [{ _id: 'INV-1', cd: 'INV-1', no: '1001', caseId, customerId: 'CU-1', buyerCo: 'شرکت الف',
    base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active', payments: [] }];
  const allocations = [];
  sdRebuildAllocations(caseId, receipts, invoices, allocations);
  report('سناریو ۱ — مشتری کل فاکتور (۱٬۰۹۰م) را پیش از صدور فاکتور پرداخت کرده', {
    ptf_crm_invoices: invoices, ptf_crm_case_receipts: receipts, ptf_crm_receipt_allocations: allocations,
    ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }], ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-1', buyerCo: 'شرکت الف' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: []
  }, 'CU-1', caseId);
})();

/* ===================== سناریو ۲ — فاکتور بدون caseId ===================== */
(function scenarioOrphanInvoice() {
  const caseId = 'CASE-2';
  const receipts = [{ _id: 'RCPT-2', caseId, customerId: 'CU-2', amountIRR: 500000000, amt: 500000000,
    receivedAt: '2026-06-10', method: 'bank_transfer', status: 'posted', timing: 'post_invoice' }];
  /* فاکتور غیررسمی که هنگام صدور، پرونده‌اش پیدا نشده و caseId خالی مانده است */
  const invoices = [{ _id: 'INV-2', cd: 'INV-2', no: '2002', caseId: '', customerId: 'CU-2', buyerCd: 'CU-2', buyerCo: 'شرکت ب',
    base: 1200000000, vat: 0, amount: 1200000000, invDate: '2026-06-01', status: 'active', isUnofficial: true, payments: [] }];
  const allocations = [];
  sdRebuildAllocations(caseId, receipts, invoices, allocations);
  report('سناریو ۲ — دریافت روی پرونده ثبت شده ولی فاکتور caseId ندارد', {
    ptf_crm_invoices: invoices, ptf_crm_case_receipts: receipts, ptf_crm_receipt_allocations: allocations,
    ptf_crm_customers: [{ cd: 'CU-2', co: 'شرکت ب' }], ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-2', buyerCo: 'شرکت ب' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: []
  }, 'CU-2', caseId);
})();

/* ===================== سناریو ۳ — پرداخت میراثی مهاجرت‌شده بدون تخصیص ===================== */
(function scenarioMigratedWithoutAllocation() {
  const caseId = 'CASE-3';
  /* رسید مهاجرت‌شده ساخته شده اما پروجکشن تخصیص روی این دستگاه اعمال نشده
     (allocatedBase صفر مانده) — دقیقاً حالتی که «ردیف پرداخت هست، کسر نیست». */
  const receipts = [{ _id: 'RCPT-3', caseId, customerId: 'CU-3', amountIRR: 400000000, amt: 400000000,
    receivedAt: '2026-04-01', method: 'legacy_confirmed', status: 'posted', timing: 'post_invoice', legacyPaymentRef: 'RPAY-9' }];
  const invoices = [{ _id: 'INV-3', cd: 'INV-3', no: '3003', caseId, customerId: 'CU-3', buyerCd: 'CU-3', buyerCo: 'شرکت ج',
    base: 1100000000, vat: 0, amount: 1100000000, invDate: '2026-03-01', status: 'active',
    payments: [{ cd: 'RPAY-9', amt: 400000000, how: 'حواله', t: '1405/01/12', migratedToReceiptId: 'RCPT-3', financialProjectionDisabled: true }] }];
  const allocations = [];
  /* عمداً rebuild اجرا نمی‌شود تا وضعیت «پروجکشن نرسیده» بازتولید شود */
  report('سناریو ۳ — پرداخت میراثی مهاجرت‌شده ولی تخصیص روی دستگاه اعمال نشده', {
    ptf_crm_invoices: invoices, ptf_crm_case_receipts: receipts, ptf_crm_receipt_allocations: allocations,
    ptf_crm_customers: [{ cd: 'CU-3', co: 'شرکت ج' }], ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-3', buyerCo: 'شرکت ج' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: []
  }, 'CU-3', caseId);
})();

/* ===================== سناریو ۴ — فاکتور غیررسمی با تخفیف: base ≠ amount ===================== */
(function scenarioUnofficialBaseMismatch() {
  const caseId = 'CASE-4';
  const receipts = [{ _id: 'RCPT-4', caseId, customerId: 'CU-4', amountIRR: 900000000, amt: 900000000,
    receivedAt: '2026-06-20', method: 'bank_transfer', status: 'posted', timing: 'post_invoice' }];
  /* unofficial-invoice.js: amount = پس از تخفیف/پیش‌پرداخت | base = مبلغ ناخالص */
  const invoices = [{ _id: 'INV-4', cd: 'INV-4', no: '4004', caseId, customerId: 'CU-4', buyerCd: 'CU-4', buyerCo: 'شرکت د',
    base: 1000000000, vat: 0, amount: 900000000, discount: 100000000, invDate: '2026-06-01', status: 'active', isUnofficial: true, payments: [] }];
  const allocations = [];
  sdRebuildAllocations(caseId, receipts, invoices, allocations);
  report('سناریو ۴ — فاکتور غیررسمی با تخفیف (base=۱٬۰۰۰م ولی amount=۹۰۰م) و پرداخت کامل', {
    ptf_crm_invoices: invoices, ptf_crm_case_receipts: receipts, ptf_crm_receipt_allocations: allocations,
    ptf_crm_customers: [{ cd: 'CU-4', co: 'شرکت د' }], ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-4', buyerCo: 'شرکت د' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: []
  }, 'CU-4', caseId);
})();

/* ===================== سناریو ۵ — صورتحساب غیررسمیِ جایگزین‌شده (superseded) ===================== */
(function scenarioSupersededDoubleCount() {
  const caseId = 'CASE-5';
  const receipts = [];
  const invoices = [
    { _id: 'INV-5U', cd: 'INV-5U', no: '5005-U', caseId, customerId: 'CU-5', buyerCd: 'CU-5', buyerCo: 'شرکت ه',
      base: 1000000000, vat: 0, amount: 1000000000, invDate: '2026-05-01', status: 'superseded', isUnofficial: true,
      supersededByInvoiceId: 'INV-5O', payments: [] },
    { _id: 'INV-5O', cd: 'INV-5O', no: '5005', caseId, customerId: 'CU-5', buyerCd: 'CU-5', buyerCo: 'شرکت ه',
      base: 1000000000, vat: 90000000, amount: 1090000000, invDate: '2026-06-01', status: 'active', isOfficial: true, payments: [] }
  ];
  const allocations = [];
  sdRebuildAllocations(caseId, receipts, invoices, allocations);
  report('سناریو ۵ — صورتحساب غیررسمی «superseded» هنوز در حساب مشتری بدهی می‌سازد', {
    ptf_crm_invoices: invoices, ptf_crm_case_receipts: receipts, ptf_crm_receipt_allocations: allocations,
    ptf_crm_customers: [{ cd: 'CU-5', co: 'شرکت ه' }], ptf_crm_deals: [{ _id: caseId, cd: caseId, buyerCd: 'CU-5', buyerCo: 'شرکت ه' }],
    ptf_crm_offers: [], ptf_crm_sales_returns: []
  }, 'CU-5', caseId);
})();

console.log('\nراهنما: «نمای ۱» پنل مطالبات، «نمای ۲» حساب مشتریان و «نمای ۳» پنجرهٔ مالی پرونده است.');
