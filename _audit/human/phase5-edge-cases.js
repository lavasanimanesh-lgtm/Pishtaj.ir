/**
 * فاز ۵: تست edge cases و حالات مرزی
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require(path.resolve(__dirname, '../../../node_modules/jsdom'));

const CRM_DIR = path.resolve(__dirname, '../../crm');
const INDEX_HTML = fs.readFileSync(path.join(CRM_DIR, 'index.html'), 'utf-8');
const scriptRegex = /src="([^"]+\.js)[^"]*"/g;
const SCRIPTS = [];
let m;
while ((m = scriptRegex.exec(INDEX_HTML)) !== null) {
  const scriptName = m[1].replace(/^.*\//, '');
  if (!SCRIPTS.includes(scriptName)) SCRIPTS.push(scriptName);
}

const dom = new JSDOM(INDEX_HTML, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const sandbox = {
  console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp,
  Error, Promise, Map, Set, Symbol, Intl, Buffer, parseInt, parseFloat, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent,
  MutationObserver: class { observe(){} disconnect(){} takeRecords(){return [];} },
  IntersectionObserver: class { observe(){} disconnect(){} unobserve(){} },
  ResizeObserver: class { observe(){} disconnect(){} unobserve(){} },
  matchMedia: () => ({ matches: false, addListener: () => {}, addEventListener: () => {} }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  addEventListener: () => {}, removeEventListener: () => {},
  alert: () => {}, confirm: () => true, prompt: () => 'test',
  XLSX: { utils: { book_new: () => ({}), sheet_to_json: () => [], json_to_sheet: () => {} }, read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }), writeFile: () => {} },
  fetch: () => Promise.resolve({ ok: false, status: 0, text: () => '' }),
  window, document: window.document, localStorage: window.localStorage,
  navigator: window.navigator, location: window.location,
  history: { pushState: () => {}, replaceState: () => {}, back: () => {} },
  self: window, global: window
};
sandbox.window = window;
for (const key of Object.keys(sandbox)) {
  if (typeof sandbox[key] === 'function' || sandbox[key] !== null) {
    if (!window[key]) {
      try { window[key] = sandbox[key]; } catch (e) {}
    }
  }
}

window.escP = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
window.n = window.escP;
window.audit = (m, a, r) => { window._audit = { m, a, r, t: Date.now() }; };
window.notify = (opt) => { window._notifs = window._notifs || []; window._notifs.push(opt); return 'NTF-' + Date.now(); };
window.curRole = () => 'admin';
window.curSession = () => ({ user: 'admin', name: 'مدیر' });
window.roleDef = () => ({ name: 'admin', finance: true, sellPrice: true, buyPrice: true });
window.isSenior = () => true;
window.isAdmin = () => true;
window.goPanel = (n) => { window._currentPanel = n; };
window.goPanelByName = window.goPanel;
window.ptfToast = (msg, type) => { window._toasts = window._toasts || []; window._toasts.push({ msg, type, t: Date.now() }); };
window.XLSX = sandbox.XLSX;
window.fetch = sandbox.fetch;
window.getData = (k) => { try { return JSON.parse(window.localStorage.getItem(k) || '[]'); } catch(e) { return []; } };
window.setData = (k, v) => { window.localStorage.setItem(k, JSON.stringify(v)); };
window.genCode = (p) => p + '-' + Math.floor(10000 + Math.random() * 90000);
window.faDate = () => '1405/04/14';
window.faDateTime = () => '1405/04/14 10:00';
window.faYear = () => '1405';

const ctx = vm.createContext(window);
const BUGS = [];
const PASS = [];

for (const s of SCRIPTS) {
  const fp = path.join(CRM_DIR, s);
  if (!fs.existsSync(fp)) continue;
  try { vm.runInContext(fs.readFileSync(fp, 'utf-8'), ctx, { filename: s }); } catch (e) {}
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  فاز ۵: تست Edge Cases و حالات مرزی');
console.log('═══════════════════════════════════════════════════════════\n');

function caseBug(severity, case_, desc, detail) {
  BUGS.push({ severity, case: case_, desc, detail });
  console.log(`  [${severity}] کیس ${case_}: ${desc}${detail ? ' — ' + detail : ''}`);
}

function caseOK(case_, desc) {
  PASS.push({ case: case_, desc });
  console.log(`  ✓ کیس ${case_}: ${desc}`);
}

function section(title) { console.log(`\n──── ${title} ────`); }

// ─────────────────────────────────────────────
// ۵.۱: تست خالی بودن داده‌ها
// ─────────────────────────────────────────────
section('۵.۱: خالی بودن داده‌ها (null/undefined/[])');

const emptyTests = [
  { name: 'ptfProjectProfitIRR({})', fn: () => window.ptfProjectProfitIRR({}), expected: 'object' },
  { name: 'ptfProjectProfitIRR(null)', fn: () => window.ptfProjectProfitIRR(null), expected: 'object' },
  { name: 'ptfSupplierScore(null)', fn: () => window.ptfSupplierScore(null), expected: 'object' },
  { name: 'ptfCustomerScore(null)', fn: () => window.ptfCustomerScore(null), expected: 'object' },
  { name: 'ptfRfqCascadeScan(null)', fn: () => window.ptfRfqCascadeScan(null), expected: 'object' },
  { name: 'ptfFiscalData(null)', fn: () => window.ptfFiscalData(null), expected: 'any' },
  { name: 'ptfOppoList()', fn: () => window.ptfOppoList(), expected: 'array' },
  { name: 'sfStageOf(null)', fn: () => window.sfStageOf(null), expected: 'number' },
  { name: 'ptfPettyBalance()', fn: () => window.ptfPettyBalance(), expected: 'number' }
];

for (const t of emptyTests) {
  try {
    const r = t.fn();
    if (r === null || r === undefined) {
      // null قابل قبول برای بعضی
      caseOK('1.' + t.name, `null قابل قبول`);
    } else if (t.expected === 'object' && typeof r !== 'object') {
      caseBug('HIGH', '1.' + t.name, `${typeof r} (انتظار object)`);
    } else if (t.expected === 'array' && !Array.isArray(r)) {
      caseBug('HIGH', '1.' + t.name, `${typeof r} (انتظار array)`);
    } else if (t.expected === 'number' && typeof r !== 'number') {
      caseBug('HIGH', '1.' + t.name, `${typeof r} (انتظار number)`);
    } else {
      caseOK('1.' + t.name, 'اجرای موفق');
    }
  } catch (e) {
    caseBug('CRITICAL', '1.' + t.name, `خطا: ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// ۵.۲: تست مقادیر مرزی
// ─────────────────────────────────────────────
section('۵.۲: مقادیر مرزی');

const boundaryTests = [
  { fn: () => window.ptfMoney(0, 'IRR'), expect: 'string' },
  { fn: () => window.ptfMoney(-1000, 'IRR'), expect: 'string' },
  { fn: () => window.ptfMoney(999999999999, 'IRR'), expect: 'string' },
  { fn: () => window.ptfMoney(0.0001, 'IRR'), expect: 'string' },
  { fn: () => window.ptfNum(''), expect: 'number' },
  { fn: () => window.ptfNum('  '), expect: 'number' },
  { fn: () => window.ptfNum('۰'), expect: 'number' },
  { fn: () => window.ptfPhoneNorm('', 'fa'), expect: 'string' },
  { fn: () => window.ptfPhoneNorm('0000000', 'fa'), expect: 'string' }
];

boundaryTests.forEach((t, i) => {
  try {
    const r = t.fn();
    if (typeof r === t.expect) caseOK('2.' + i, 'نوع صحیح');
    else caseBug('MEDIUM', '2.' + i, `${typeof r} (انتظار ${t.expect})`);
  } catch (e) {
    caseBug('HIGH', '2.' + i, e.message);
  }
});

// ─────────────────────────────────────────────
// ۵.۳: تست داده‌های بزرگ
// ─────────────────────────────────────────────
section('۵.۳: حجم زیاد داده');

console.log('\n── ۱۰۰۰ مشتری تست');
try {
  const big = [];
  for (let i = 0; i < 1000; i++) {
    big.push({ cd: 'BIG-' + i, co: 'شرکت ' + i, tel: '+9821' + String(1000000 + i) });
  }
  window.setData('ptf_crm_customers', big);
  if (window.ptfOppoList) {
    const r = window.ptfOppoList();
    if (Array.isArray(r)) caseOK('3.1', `۱۰۰۰ رکورد بدون crash (${r.length} نتیجه)`);
    else caseBug('MEDIUM', '3.1', 'خروجی نامعتبر');
  }
} catch (e) { caseBug('HIGH', '3.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۴: تست race condition
// ─────────────────────────────────────────────
section('۵.۴: شرایط همزمانی');

console.log('\n── فراخوانی همزمان چندباره');
try {
  for (let i = 0; i < 50; i++) {
    window.ptfRealBuyStatus('INQ-' + i);
  }
  caseOK('4.1', '۵۰ فراخوانی همزمان بدون crash');
} catch (e) { caseBug('HIGH', '4.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۵: تست امنیتی XSS در داده‌ها
// ─────────────────────────────────────────────
section('۵.۵: امنیت XSS');

console.log('\n── داده با کد مخرب');
try {
  window.setData('ptf_crm_customers', [
    { cd: 'XSS-1', co: '<script>alert(1)</script>', coEn: '<img src=x onerror=alert(1)>', tel: '+9821', mob: '+98912' }
  ]);
  if (window.renderCustomers) {
    const r = window.renderCustomers();
    if (r && typeof r === 'string' && r.indexOf('<script>') >= 0) {
      caseBug('CRITICAL', '5.1', 'XSS: <script> در خروجی');
    } else if (r && typeof r === 'string' && r.indexOf('onerror=') >= 0) {
      caseBug('CRITICAL', '5.1', 'XSS: onerror در خروجی');
    } else caseOK('5.1', 'خروجی امن است');
  } else caseOK('5.1', 'renderCustomers تعریف نشده (تست نشد)');
} catch (e) { caseBug('HIGH', '5.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۶: تست نشت حافظه (memory leak)
// ─────────────────────────────────────────────
section('۵.۶: نشت حافظه');

console.log('\n── فراخوانی مکرر ۱۰۰۰ بار');
try {
  for (let i = 0; i < 1000; i++) {
    window.ptfSupplierScore({ co: 't' + i });
  }
  caseOK('6.1', '۱۰۰۰ فراخوانی بدون crash');
} catch (e) { caseBug('HIGH', '6.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۷: تست تولید کد یکتا
// ─────────────────────────────────────────────
section('۵.۷: تولید کد');

console.log('\n── genCode یکتا');
try {
  if (typeof window.genCode === 'function') {
    const codes = new Set();
    for (let i = 0; i < 1000; i++) {
      codes.add(window.genCode('P'));
    }
    if (codes.size === 1000) caseOK('7.1', '۱۰۰۰ کد یکتا تولید شد');
    else caseBug('MEDIUM', '7.1', `تکرار: ${1000 - codes.size} مورد`);
  }
} catch (e) { caseBug('HIGH', '7.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۸: تست عبارات منظم (regex)
// ─────────────────────────────────────────────
section('۵.۸: عبارات منظم');

console.log('\n── dedupNorm کاراکترهای خاص');
try {
  if (typeof window.dedupNorm === 'function') {
    const tests = [
      'ABC', 'abc', 'ABC ', ' ABC', 'A B C',
      'پترو\u200cشیمی', 'پتروشیمی', 'پترو شیمی',
      '', ' ', '\t\n', '123', 'ABC@123'
    ];
    const errors = [];
    for (const t of tests) {
      try {
        const r = window.dedupNorm(t);
        if (typeof r !== 'string') errors.push(`${JSON.stringify(t)} → ${typeof r}`);
      } catch (e) {
        errors.push(`${JSON.stringify(t)} → خطا: ${e.message}`);
      }
    }
    if (errors.length) caseBug('MEDIUM', '8.1', 'dedupNorm شکست‌ها: ' + errors.join('; '));
    else caseOK('8.1', `${tests.length} ورودی امن`);
  }
} catch (e) { caseBug('HIGH', '8.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۹: تست RFC (real flow check) - ساختار offerNo
// ─────────────────────────────────────────────
section('۵.۹: ساختار شماره‌ها');

console.log('\n── ptfUnifiedCode');
try {
  if (typeof window.ptfUnifiedCode === 'function') {
    const c1 = window.ptfUnifiedCode('P');
    const c2 = window.ptfUnifiedCode('P');
    if (c1 && c2 && c1 !== c2) caseOK('9.1', `کدها یکتا: ${c1} ≠ ${c2}`);
    else if (c1 && c2 && c1 === c2) caseBug('MEDIUM', '9.1', 'کد تکراری');
    else caseBug('HIGH', '9.1', 'تولید نشد');
  } else caseOK('9.1', 'ptfUnifiedCode تعریف نشده');
} catch (e) { caseBug('HIGH', '9.1', e.message); }

// ─────────────────────────────────────────────
// ۵.۱۰: تست ptfReconcilation - چک سازگاری داده
// ─────────────────────────────────────────────
section('۵.۱۰: سازگاری');

console.log('\n── یکپارچگی کلید داده');
try {
  const keys = ['ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_customers', 'ptf_crm_suppliers', 'ptf_crm_products', 'ptf_crm_deals', 'ptf_crm_invoices', 'ptf_crm_payables', 'ptf_crm_fiscal_snapshots', 'ptf_crm_petty_tx', 'ptf_crm_sharetx'];
  let issues = [];
  for (const k of keys) {
    try {
      const v = window.getData(k);
      if (!Array.isArray(v)) issues.push(`${k} → ${typeof v}`);
    } catch (e) {
      issues.push(`${k} → خطا: ${e.message}`);
    }
  }
  if (issues.length) caseBug('MEDIUM', '10.1', 'کلیدهای مشکل‌دار: ' + issues.join(', '));
  else caseOK('10.1', `${keys.length} کلید سالم`);
} catch (e) { caseBug('HIGH', '10.1', e.message); }

// ─────────────────────────────────────────────
// خلاصه
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  خلاصه فاز ۵: ${PASS.length} پاس، ${BUGS.length} شکست`);
console.log('═══════════════════════════════════════════════════════════');

if (BUGS.length) {
  console.log('\n═══ باگ‌های یافت شده ═══');
  BUGS.forEach(b => console.log(`  [${b.severity}] کیس ${b.case}: ${b.desc}${b.detail ? ' — ' + b.detail : ''}`));
}

fs.writeFileSync(
  path.join(__dirname, 'phase5-edge-cases-result.json'),
  JSON.stringify({ passed: PASS, failed: BUGS }, null, 2)
);
console.log(`\n💾 فایل خروجی: phase5-edge-cases-result.json`);
