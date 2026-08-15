/* =====================================================================
   Repro harness (Node) — تصمیم‌یار مدیریت / تحلیلگر
   هدف: بازتولید عددی ایرادهای منطقی گزارش‌شده توسط کارفرما
   (۱۱ پیشنهاد، ۱ برد → نرخ برد ۱۰۰٪) بدون نیاز به مرورگر.
   اجرا:  node _tools/audit/repro-decision-support-winrate.js
   این فایل فقط ابزار ممیزی است و در بارگذاری CRM نقشی ندارد.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');

/* ---------- دادهٔ نمونه: دقیقاً سناریوی گزارش‌شده ---------- */
const DB = {
  ptf_crm_customers: [{ cd: 'CU-1', co: 'شرکت الف' }],
  /* ۱۱ پیشنهاد مالی برای همین مشتری: ۱ برد، ۱ باخت ثبت‌شده، ۹ باز (sent/draft) */
  ptf_crm_offers: (() => {
    const arr = [];
    arr.push({ no: 'CO-001', kind: 'CO', inqNo: 'RFQ-1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', st: 'won', currency: 'IRR',
      items: [{ name: 'شیر کنترل', qty: 2, price: 500000000 }] });
    /* SCENARIO=A → دقیقاً سناریوی کارفرما: هیچ باختی ثبت نشده است */
    arr.push({ no: 'CO-002', kind: 'CO', inqNo: 'RFQ-2', buyerCd: 'CU-1', buyerCo: 'شرکت الف',
      st: process.env.SCENARIO === 'A' ? 'sent' : 'lost', lostWhy: '', currency: 'IRR',
      items: [{ name: 'شیر کنترل', qty: 1, price: 400000000 }] });
    for (let i = 3; i <= 11; i++) {
      arr.push({ no: 'CO-0' + String(i).padStart(2, '0'), kind: 'CO', inqNo: 'RFQ-' + i, buyerCd: 'CU-1', buyerCo: 'شرکت الف',
        st: i % 2 ? 'sent' : 'draft', currency: 'IRR', items: [{ name: 'شیر کنترل', qty: 1, price: 300000000 }] });
    }
    /* یک پیشنهاد ارزی برنده — برای آزمون اختلاط ارز (در سناریوی A حذف می‌شود) */
    if (process.env.SCENARIO !== 'A') arr.push({ no: 'CO-100', kind: 'CO', inqNo: 'RFQ-100', buyerCd: 'CU-1', buyerCo: 'شرکت الف', st: 'won', currency: 'EUR',
      items: [{ name: 'پوزیشنر', qty: 10, price: 1200 }] });
    return arr;
  })(),
  /* درخواست‌ها: مسیر قدیمی/دستیار هوشمند custCd ندارد → کلید = نام شرکت */
  ptf_crm_rfqs: [
    { cd: 'RFQ-1', co: 'شرکت الف', custCd: 'CU-1', st: 'st4' },
    { cd: 'RFQ-2', co: 'شرکت الف', st: 'st4' },
    { cd: 'RFQ-3', co: 'شرکت الف', st: 'st2' },
    { cd: 'RFQ-4', co: 'شرکت الف', st: 'st2' }
  ],
  ptf_crm_invoices: [
    /* فاکتور ابطال‌شده باید از «فاکتورشده» خارج شود */
    { cd: 'INV-1', no: '1', buyerCd: 'CU-1', buyerCo: 'شرکت الف', amount: 1000000000, status: 'void', payments: [] },
    /* پرداخت مهاجرت‌شده به Receipt (v35) نباید دوباره شمرده شود؛ allocatedBase باید دیده شود */
    { cd: 'INV-2', no: '2', buyerCd: 'CU-1', buyerCo: 'شرکت الف', amount: 1100000000,
      allocatedBase: 400000000, allocatedVat: 0,
      payments: [{ cd: 'P1', amt: 400000000, migratedToReceiptId: 'RCP-1' }, { cd: 'P2', amt: 100000000, status: 'void' }] }
  ],
  ptf_crm_buyquotes: [{ sup: 'تامین‌کننده ۱', price: 250000000, note: 'خرید واقعی طبق فاکتور' }],
  ptf_crm_rfqsmart: [{ targets: [{ co: 'تامین‌کننده ۱', st: 'replied' }, { co: 'تامین‌کننده ۲', st: 'sent' }] }],
  ptf_crm_deals: [{ cd: 'SF-1', inqNo: 'RFQ-1', buyerCo: 'شرکت الف', wonOffer: 'CO-001', st: 'open' },
                  { cd: 'SF-2', inqNo: 'RFQ-3', buyerCo: 'شرکت الف', st: 'open' }],
  ptf_crm_leads: [], ptf_crm_reminders: [], ptf_crm_projects: [], ptf_crm_letters: [], ptf_crm_inqitems: [],
  ptf_crm_management_actions: [], ptf_crm_management_reports: [], ptf_crm_users: [], ptf_crm_settings: {}
};

/* ---------- محیط شبیه‌سازی مرورگر ---------- */
const sandbox = {
  console,
  setTimeout: () => 0,
  document: { getElementById: () => null, querySelectorAll: () => [], body: { insertAdjacentHTML: () => {} } },
  fetch: () => Promise.reject(new Error('no network in repro')),
  getData: (k) => (DB[k] === undefined ? [] : DB[k]),
  setData: (k, v) => { DB[k] = v; return true; },
  escP: (v) => String(v == null ? '' : v),
  faDate: () => '1405/05/24',
  faDateTime: () => '1405/05/24 10:00',
  curSession: () => ({ user: 'audit', name: 'ممیز' }),
  roleDef: () => ({ finance: true }),
  isSenior: () => true,
  genCode: (p) => p + '-X',
  audit: () => {},
  addLog: () => {},
  notify: () => {},
  alert: () => {},
  PTF: {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel }); }
load('crm/metrics-shared.js');
load('crm/management-intelligence.js');
load('crm/analyzer.js');

/* ---------- خروجی‌ها ---------- */
const mi = sandbox.ptfManagementIntelligence();
const funnel = sandbox.anlOfferFunnel();
const forecast = sandbox.anlForecast();

const line = (s) => console.log(s);
line('=== تحلیلگر — قیف پیشنهادها (anlOfferFunnel) ===');
line(JSON.stringify(funnel, null, 1));
line('');
line('=== تحلیلگر — پیش‌بینی (anlForecast) ===');
line(JSON.stringify(forecast, null, 1));
line('');
line('=== تصمیم‌یار مدیریت — سطرهای مشتری ===');
mi.customers.forEach((c) => line(JSON.stringify({
  key: c.key, name: c.name, rfqs: c.rfqs, offers: c.offers, won: c.won, lost: c.lost,
  winRate: c.winRate, billed: c.billed, paid: c.paid, collectionRate: c.collectionRate,
  healthScore: c.healthScore, healthLabel: c.healthLabel, wonValue: c.wonValue, control: c.control
})));
line('');
line('=== کیفیت داده ===');
line(JSON.stringify(mi.dataQuality));
line('=== پرونده‌های «نیازمند بررسی» ===');
line(JSON.stringify(mi.risks));
line('');
line('=== خلاصه سنجه‌های مورد اعتراض ===');
const c1 = mi.customers[0];
line('نرخ برد اصلی (از کل پیشنهادها): ' + c1.winRate + '٪  (برد=' + c1.won + ' | باخت=' + c1.lost +
     ' | کل پیشنهاد=' + c1.offers + ' | باز=' + (c1.offers - c1.won - c1.lost) + ')');
line('نرخ برد کمکی (فقط نتایج ثبت‌شده): ' + c1.winRateDecided + '٪ | پوشش: ' + c1.coverage + '٪');
line('ارزش برد (ریال نرمال‌شده): ' + c1.wonValue.toLocaleString('en-US') + ' | اسناد ارزی بدون نرخ مرجع: ' + c1.fxGaps);
line('پرتفوی: ' + JSON.stringify(mi.portfolio));
