#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
let pass = 0, fail = 0, bugs = [];
function section(s) { console.log('\n── ' + s + ' ──'); }
function ok(cond, msg, detail) {
  if (cond) { pass++; console.log('  ✔ ' + msg); }
  else { fail++; bugs.push(msg + (detail ? ' — ' + detail : '')); console.log('  ✘ FAIL: ' + msg + (detail ? ' — ' + detail : '')); }
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function arHarness(seed) {
  const data = clone(seed || {});
  const context = {
    console, Date, Math, Intl, JSON, Object, Array, String, Number, Boolean,
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    getData: k => data[k] || [], setData: (k, v) => { data[k] = v; },
    window: null, globalThis: null, document: { getElementById: () => null }
  };
  context.window = context; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'crm/ar-reconcile.js'), 'utf8'), context, { filename: 'ar-reconcile.js' });
  return { ar: context.PTF.ar, data, context };
}
function base(overrides) {
  return Object.assign({
    ptf_crm_customers: [{ cd: 'C1', co: 'آلفا' }, { cd: 'C2', co: 'بتا' }],
    ptf_crm_offers: [], ptf_crm_deals: [], ptf_crm_invoices: [],
    ptf_crm_case_receipts: [], ptf_crm_receipt_allocations: [], ptf_crm_sales_returns: []
  }, overrides || {});
}

section('AR ownership: پرونده legacy، Offer و Receipt قطعی');
{
  const h = arHarness(base({
    ptf_crm_offers: [{ _id: 'O1', no: 'OF-1', buyerCd: 'C1', buyerCo: 'آلفا' }],
    ptf_crm_deals: [{ _id: 'D1', cd: 'CASE-1', rootOfferId: 'O1', wonOffer: 'OF-1' }],
    ptf_crm_invoices: [{ _id: 'I1', cd: 'INV-1', caseId: 'D1', amount: 100, base: 100, vat: 0, status: 'active' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'CASE-1', amountIRR: 150, status: 'posted' }]
  }));
  const owner = h.ar.resolveCaseCustomer(h.data.ptf_crm_deals[0], { cases: h.data.ptf_crm_deals, offers: h.data.ptf_crm_offers, invoices: h.data.ptf_crm_invoices, receipts: h.data.ptf_crm_case_receipts, customers: h.data.ptf_crm_customers });
  const pos = h.ar.customerPosition('C1');
  ok(owner.status === 'resolved' && owner.customerId === 'C1' && owner.bound === 'offer', 'Offer یکتا مالک پروندهٔ فاقد buyerCd را تعیین می‌کند', JSON.stringify(owner));
  ok(pos.received === 150 && pos.allocated === 100 && pos.freeReceiptCredit === 50 && pos.credit === 50, 'Receipt پروندهٔ legacy در اعتبار همان مشتری می‌نشیند', JSON.stringify(pos));
  ok(h.ar.customerPosition('C2').received === 0, 'Receipt به مشتری دیگر leak نمی‌شود');
}

section('AR ownership: fallback نام فقط یکتا و conflict همیشه block');
{
  const unique = arHarness(base({
    ptf_crm_deals: [{ _id: 'D1', buyerCo: '  آلفا  ' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', amountIRR: 70, status: 'posted' }]
  }));
  ok(unique.ar.customerPosition('C1').credit === 70, 'نام normalize‌شدهٔ یکتا Receipt را به Customer درست متصل می‌کند');

  const aliases = arHarness(base({
    ptf_crm_customers: [{ _id: 'CUS-1', cd: 'C1', co: 'آلفا' }, { _id: 'CUS-2', cd: 'C2', co: 'بتا' }],
    ptf_crm_offers: [{ _id: 'O1', buyerCd: 'CUS-1' }],
    ptf_crm_deals: [{ _id: 'D1', rootOfferId: 'O1', buyerCd: 'C1' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', customerId: 'CUS-1', amountIRR: 60, status: 'posted' }]
  }));
  const aliasOwner = aliases.ar.resolveCaseCustomer(aliases.data.ptf_crm_deals[0]);
  ok(aliasOwner.status === 'resolved' && aliasOwner.customerId === 'CUS-1' && aliasOwner.candidates.length === 1,
    'cd legacy و _id سروری یک Customer به conflict کاذب تبدیل نمی‌شوند', JSON.stringify(aliasOwner));
  ok(aliases.ar.customerPosition('C1').credit === 60 && aliases.ar.customerPosition('CUS-1').credit === 60,
    'اعتبار canonical از هر دو alias همان Customer قابل مشاهده است');

  const sharedAlias = arHarness(base({
    ptf_crm_customers: [{ _id: 'CUS-A', cd: 'SHARED', co: 'آلفا' }, { _id: 'CUS-B', cd: 'SHARED', co: 'بتا' }],
    ptf_crm_deals: [{ _id: 'D1', buyerCd: 'CUS-A' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', customerId: 'CUS-A', amountIRR: 55, status: 'posted' }]
  }));
  ok(sharedAlias.ar.customerPosition('CUS-A').credit === 55 && sharedAlias.ar.customerPosition('CUS-B').credit === 0 && sharedAlias.ar.customerPosition('SHARED').credit === 0,
    'alias مشترک دو Customer مبهم می‌ماند و دفترهای آن‌ها را ادغام نمی‌کند');

  const duplicate = arHarness(base({
    ptf_crm_customers: [{ cd: 'C1', co: 'شرکت آلفا' }, { cd: 'C9', co: 'شرکت آلفا' }],
    ptf_crm_deals: [{ _id: 'D1', buyerCo: 'شرکت آلفا' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', amountIRR: 70, status: 'posted' }]
  }));
  const amb = duplicate.ar.resolveCaseCustomer(duplicate.data.ptf_crm_deals[0], { cases: duplicate.data.ptf_crm_deals, offers: [], invoices: [], receipts: duplicate.data.ptf_crm_case_receipts, customers: duplicate.data.ptf_crm_customers });
  ok(amb.status === 'ambiguous' && duplicate.ar.customerPosition('C1').credit === 0 && duplicate.ar.customerPosition('C9').credit === 0,
    'نام مشترک بین دو Customer هیچ اعتباری را حدس نمی‌زند', JSON.stringify(amb));

  const conflict = arHarness(base({
    ptf_crm_deals: [{ _id: 'D1', buyerCd: 'C1' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', customerId: 'C2', amountIRR: 90, status: 'posted' }]
  }));
  const own = conflict.ar.resolveCaseCustomer(conflict.data.ptf_crm_deals[0], { cases: conflict.data.ptf_crm_deals, offers: [], invoices: [], receipts: conflict.data.ptf_crm_case_receipts, customers: conflict.data.ptf_crm_customers });
  ok(own.status === 'ambiguous' && own.candidates.join(',') === 'C1,C2', 'تعارض شناسهٔ case/receipt با candidates شفاف block می‌شود', JSON.stringify(own));
  ok(conflict.ar.customerPosition('C1').received === 0 && conflict.ar.customerPosition('C2').received === 0, 'تعارض شناسه به هیچ حساب مشتری leak نمی‌کند');
}

section('AR ownership: Invoice ورودی و cache invalidation');
{
  const h = arHarness(base({
    ptf_crm_deals: [{ _id: 'D1', buyerCd: 'C1' }, { _id: 'D2', buyerCd: 'C2' }],
    ptf_crm_invoices: [{ _id: 'I1', caseId: 'D1', amount: 100, base: 100, vat: 0 }, { _id: 'I2', caseId: 'D2', amount: 900, base: 900, vat: 0 }]
  }));
  const scoped = h.ar.customerPosition('C1', { invoices: h.data.ptf_crm_invoices });
  ok(scoped.grossBilled === 100 && scoped.invoices === 1, 'opts.invoices نیز دوباره ownership را validate می‌کند', JSON.stringify(scoped));

  const cache = arHarness(base({
    ptf_crm_offers: [{ _id: 'O1', no: 'OF', buyerCd: 'C1' }],
    ptf_crm_deals: [{ _id: 'D1', rootOfferId: 'O1' }],
    ptf_crm_case_receipts: [{ _id: 'R1', caseId: 'D1', amountIRR: 33, status: 'posted' }]
  }));
  ok(cache.ar.customerPosition('C1').credit === 33, 'snapshot اولیه مالک Offer را می‌خواند');
  cache.data.ptf_crm_offers = [{ _id: 'O1', no: 'OF', buyerCd: 'C2' }];
  ok(cache.ar.customerPosition('C1').credit === 0 && cache.ar.customerPosition('C2').credit === 33, 'تغییر Offers کش ownership را invalidate می‌کند');
  cache.data.ptf_crm_deals = [{ _id: 'D1', buyerCo: 'نام تازه' }];
  cache.data.ptf_crm_offers = [];
  cache.data.ptf_crm_customers = [{ cd: 'C7', co: 'نام تازه' }];
  ok(cache.ar.customerPosition('C7').credit === 33, 'تغییر Customers نیز کش fallback نام را invalidate می‌کند');
}

section('AR ownership: offerNo مبهم و Receipt بدون case');
{
  const unique = arHarness(base({
    ptf_crm_offers: [{ _id: 'O1', no: 'OF-X', buyerCd: 'C1' }],
    ptf_crm_deals: [{ _id: 'D1', wonOffer: 'OF-X' }],
    ptf_crm_invoices: [{ _id: 'I1', offerNo: 'OF-X', amount: 20, base: 20, vat: 0 }]
  }));
  ok(unique.ar.customerInvoices('C1').length === 1, 'Invoice فاقد case فقط از Offer متصل به پروندهٔ یکتا bind می‌شود');
  unique.data.ptf_crm_offers.push({ _id: 'O2', no: 'OF-X', buyerCd: 'C2' });
  ok(unique.ar.customerInvoices('C1').length === 0 && unique.ar.customerInvoices('C2').length === 0,
    'offerNo مشترک بین دو Offer با مالک متفاوت برای Invoice حدس زده نمی‌شود');

  const orphanConflict = arHarness(base({
    ptf_crm_case_receipts: [{ _id: 'R1', customerId: 'C1', buyerCd: 'C2', amountIRR: 44, status: 'posted' }]
  }));
  ok(orphanConflict.ar.customerPosition('C1').credit === 0 && orphanConflict.ar.customerPosition('C2').credit === 0,
    'Receipt بدون case با دو شناسهٔ متعارض نیز block می‌شود');
}

section('Salary server command: قرارداد اتمیک، ماه تهران و projection role-safe');
{
  const php = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');
  const opex = fs.readFileSync(path.join(ROOT, 'crm/opex.js'), 'utf8');
  ok(php.includes("$action === 'reconcile_shareholder_salaries'") && php.includes("sd_current_jalali_month()") && php.includes("new DateTimeZone('Asia/Tehran')"), 'سرور فقط ماه جاری جلالی تهران را می‌پذیرد');
  ok(php.includes("$changes=['ptf_crm_sharetx'=>$sharetx,'ptf_crm_opex'=>$opex]") && php.includes("$responseChanges=['ptf_crm_opex'=>[]]"), 'sharetx و OPEX یک commit اتمیک دارند');
  ok(php.includes("const SD_SHAREHOLDER_VIEW_ROLES = ['admin', 'chairman', 'ceo', 'commercial']") &&
    php.includes("$data['ptf_crm_sharetx']=sd_read('ptf_crm_sharetx')") &&
    (php.match(/sd_recurring_projection_data\(\$action,/g) || []).length >= 2,
    'پاسخ تازه و replay، sharetx را مستقیم فقط برای مدیران ارشد و بدون افشا به accountant برمی‌گردانند');
  ok(php.includes("sd_stable_recurring_code('SHT-SAL',$key)") && php.includes("sd_stable_recurring_code('OPX-SAL',$key)"), 'شناسه‌های transaction و OPEX روی سرور قطعی‌اند');
  ok(php.includes('sd_customer_candidates_for_id($value,$customers)') && php.includes("$case['buyerCd']=$resolvedCustomerId"), 'سرور aliasهای Customer را canonical و پروندهٔ legacy را heal می‌کند');
  ok(opex.includes("ptfSalesDomainCommand('reconcile_recurring_opex'") && opex.includes("'OPEX-REC|' + runKey"), 'پس از Sync فرمان روزانهٔ server-authoritative فراخوانی می‌شود');
  ok(!/ptfShareEnsureSalary\(s, m\)/.test(opex), 'startup دیگر حقوق را از snapshot محلی سهامداران تولید نمی‌کند');
}

console.log(`\n=== tester499-v34.8.31-server-salary-case-owner: ${pass} PASS / ${fail} FAIL ===`);
if (bugs.length) { console.log('BUGS:'); bugs.forEach(b => console.log(' • ' + b)); process.exitCode = 1; }
