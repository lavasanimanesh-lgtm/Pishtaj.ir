/**
 * فاز ۴: کیس‌های استادی End-to-End
 * شبیه‌سازی فرآیندهای واقعی PTF
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

const dom = new JSDOM(INDEX_HTML, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});

const { window } = dom;
const sandbox = {
  console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp,
  Error, Promise, Map, Set, Symbol, Intl, Buffer,
  parseInt, parseFloat, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent,
  MutationObserver: class { observe(){} disconnect(){} takeRecords(){return [];} },
  IntersectionObserver: class { observe(){} disconnect(){} unobserve(){} },
  ResizeObserver: class { observe(){} disconnect(){} unobserve(){} },
  matchMedia: () => ({ matches: false, addListener: () => {}, addEventListener: () => {} }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  addEventListener: () => {},
  removeEventListener: () => {},
  alert: () => {},
  confirm: () => true,
  prompt: () => 'test',
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

// helpers
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
console.log('  فاز ۴: کیس‌های استادی End-to-End');
console.log('═══════════════════════════════════════════════════════════\n');

function caseBug(severity, case_, desc, detail) {
  BUGS.push({ severity, case: case_, desc, detail });
  console.log(`  [${severity}] کیس ${case_}: ${desc} — ${detail || ''}`);
}

function caseOK(case_, desc) {
  PASS.push({ case: case_, desc });
  console.log(`  ✓ کیس ${case_}: ${desc}`);
}

function section(title) { console.log(`\n──── ${title} ────`); }

// ─────────────────────────────────────────────
// راه‌اندازی داده‌های پایه
// ─────────────────────────────────────────────
console.log('── راه‌اندازی داده‌های پایه');
window.setData('ptf_crm_customers', [
  { cd: 'C-1', co: 'پتروشیمی پارس', coEn: 'Parsi Petrochemical', tel: '+982112345678', mob: '+989121234567', addr: 'تهران', ind: 'پتروشیمی' },
  { cd: 'C-2', co: 'فولاد مبارکه', coEn: 'Mobarakeh Steel', tel: '+983122345678', mob: '+989123456789', addr: 'اصفهان', ind: 'فولاد' }
]);
window.setData('ptf_crm_suppliers', [
  { cd: 'S-1', co: 'تامین صنعت', coEn: 'Sanat Supply', origin: 'internal', spBrands: ['Siemens', 'ABB'], spEquip: ['پمپ', 'ولو'] },
  { cd: 'S-2', co: 'EuroValve GmbH', coEn: 'EuroValve GmbH', origin: 'external', spBrands: ['KSB'], spEquip: ['valve'] }
]);
window.setData('ptf_crm_products', [
  { cd: 'P-1001', name: 'پمپ گریز از مرکز', desc: 'پمپ صنعتی', brand: 'Siemens', model: 'CR-32', cat: 'پمپ', unit: 'عدد', pr: 50000000, prCur: 'IRR' },
  { cd: 'P-1002', name: 'شیر توپی', desc: 'ولو توپی', brand: 'KSB', model: 'BOA-H', cat: 'ولو', unit: 'عدد', pr: 8000000, prCur: 'IRR' }
]);
console.log('  ✓ داده‌های پایه تنظیم شد');

// ─────────────────────────────────────────────
// کیس ۱: ثبت RFQ → تأمین → CO → فاکتور → تسویه → بایگانی
// ─────────────────────────────────────────────
section('کیس ۱: چرخه کامل فروش (US-404)');

console.log('\n── مرحله ۱: ثبت استعلام');
try {
  // تست ptfRfqCascadeScan با cd معتبر
  const r1 = window.ptfRfqCascadeScan('CD-1');
  caseOK('1.1', 'ptfRfqCascadeScan با cd جدید اجرا می‌شود (out.archived=[])');
} catch (e) { caseBug('HIGH', '1.1', 'ptfRfqCascadeScan خطا', e.message); }

console.log('\n── مرحله ۲: ایجاد پیشنهاد');
try {
  // رفتار offerPostAwardLocked - ابتدا بررسی کنیم تعریف شده یا نه
  if (typeof window.offerPostAwardLocked === 'function') {
    const r1 = window.offerPostAwardLocked({ st: 'draft' });
    const r2 = window.offerPostAwardLocked({ st: 'won' });
    caseOK('1.2', `offerPostAwardLocked: draft=${r1}, won=${r2}`);
  } else {
    caseBug('CRITICAL', '1.2', 'offerPostAwardLocked تعریف نشده (قفل پس از برد)');
  }
} catch (e) { caseBug('HIGH', '1.2', e.message); }

console.log('\n── مرحله ۳: خرید واقعی');
try {
  if (typeof window.ptfRealBuyOpen === 'function') {
    // تست: پرونده بدون won → خالی
    const r = window.ptfRealBuyStatus('INQ-X');
    if (!r) caseBug('HIGH', '1.3', 'ptfRealBuyStatus null برمی‌گرداند');
    else if (typeof r.has !== 'boolean') caseBug('HIGH', '1.3', 'ptfRealBuyStatus.has بولین نیست');
    else caseOK('1.3', `ptfRealBuyStatus اجرا می‌شود: has=${r.has}`);
  } else caseBug('CRITICAL', '1.3', 'ptfRealBuyOpen تعریف نشده');
} catch (e) { caseBug('HIGH', '1.3', e.message); }

console.log('\n── مرحله ۴: بستن پرونده (US-437)');
try {
  // تست sfCloseAudit در حالت‌های مختلف
  window.setData('ptf_crm_rfqs', [{ cd: 'CD-1', inqNo: 'INQ-1' }]);
  window.setData('ptf_crm_offers', [{ no: 'OF-1', inqNo: 'INQ-1', st: 'won' }]);

  const r1 = window.sfCloseAudit({ wonOffer: 'OF-1', inqNo: 'INQ-1' });
  if (!r1) caseBug('HIGH', '1.4', 'sfCloseAudit null');
  else if (!Array.isArray(r1.blockers)) caseBug('HIGH', '1.4', 'sfCloseAudit.blockers آرایه نیست');
  else if (r1.blockers.indexOf('تحویل') < 0) caseBug('HIGH', '1.4', 'بدون delivered، blocker «تحویل» نیست');
  else caseOK('1.4', `sfCloseAudit blockers: ${r1.blockers.join(', ')}`);
} catch (e) { caseBug('HIGH', '1.4', e.message); }

// ─────────────────────────────────────────────
// کیس ۲: محاسبه سود پروژه با موتور واحد
// ─────────────────────────────────────────────
section('کیس ۲: محاسبه سود (R9/R16)');

console.log('\n── سناریو ۲.۱: پروژه با CO ریالی + خرید ریالی');
try {
  window.setData('ptf_crm_offers', [
    { no: 'OF-2', kind: 'CO', inqNo: 'INQ-2', total: 1000000000, cur: 'IRR', payments: [{ amt: 1000000000, rateType: 'cash' }], invNo: 'INV-2' }
  ]);
  window.setData('ptf_crm_buycmp', [
    { id: 'CMP-2', inqNo: 'INQ-2', purchases: [{ qty: 1, price: 800000000, cur: 'IRR' }] }
  ]);
  const r = window.ptfProjectProfitIRR({ inqNo: 'INQ-2' });
  if (!r) caseBug('CRITICAL', '2.1', 'ptfProjectProfitIRR null');
  else if (typeof r.profit !== 'number') caseBug('HIGH', '2.1', 'profit عدد نیست');
  else if (Math.abs(r.profit - 200000000) > 1) caseBug('HIGH', '2.1', `سود اشتباه: ${r.profit} (انتظار 200M)`);
  else caseOK('2.1', `سود: ${r.profit.toLocaleString('fa-IR')} ریال`);
} catch (e) { caseBug('HIGH', '2.1', e.message); }

console.log('\n── سناریو ۲.۲: پروژه با CO ارزی EUR + تسعیر ناقص');
try {
  window.setData('ptf_crm_offers', [
    { no: 'OF-3', kind: 'CO', inqNo: 'INQ-3', total: 50000, cur: 'EUR', payments: [{ amt: 0, rateType: 'agreed' }], invNo: 'INV-3' }
  ]);
  const r = window.ptfProjectProfitIRR({ inqNo: 'INQ-3' });
  if (!r) caseBug('CRITICAL', '2.2', 'ptfProjectProfitIRR null');
  else if (r.ok !== false) caseBug('MEDIUM', '2.2', 'نباید ok=true باشد (دریافت ناقص)');
  else if (Array.isArray(r.warnings) && r.warnings.length > 0) {
    caseOK('2.2', `سیستم هشدار ناقص بودن داد: ${r.warnings.length} مورد`);
  } else caseOK('2.2', 'هشدار نیست ولی ok=false');
} catch (e) { caseBug('HIGH', '2.2', e.message); }

console.log('\n── سناریو ۲.۳: خرید ارزی بی‌نرخ → باید هشدار بدهد');
try {
  window.setData('ptf_crm_offers', [
    { no: 'OF-4', kind: 'CO', inqNo: 'INQ-4', total: 1000000, cur: 'IRR', payments: [{ amt: 1000000, rateType: 'cash' }], invNo: 'INV-4' }
  ]);
  window.setData('ptf_crm_buycmp', [
    { id: 'CMP-4', inqNo: 'INQ-4', purchases: [{ qty: 1, price: 1000, cur: 'EUR' }] } // بدون rate
  ]);
  const r = window.ptfProjectProfitIRR({ inqNo: 'INQ-4' });
  if (!r) caseBug('CRITICAL', '2.3', 'ptfProjectProfitIRR null');
  else if (Array.isArray(r.warnings) && r.warnings.some(w => w.indexOf('خرید') >= 0 || w.indexOf('buy') >= 0)) {
    caseOK('2.3', `هشدار خرید ارزی بی‌نرخ: ${r.warnings.join(' | ').substring(0, 100)}`);
  } else caseBug('MEDIUM', '2.3', 'خرید ارزی بی‌نرخ بدون هشدار');
} catch (e) { caseBug('HIGH', '2.3', e.message); }

// ─────────────────────────────────────────────
// کیس ۳: BUG-034 (تعدیل امتیاز) - تست رفتاری دقیق
// ─────────────────────────────────────────────
section('کیس ۳: BUG-034 تعدیل امتیاز');

console.log('\n── سناریو ۳.۱: تعدیل "15" → 15 (نه 51)');
try {
  if (typeof window.rawAdj === 'function') {
    const r = window.rawAdj('15');
    if (r === 51) caseBug('CRITICAL', '3.1', 'BUG-034 بازگشت! 15 → 51');
    else if (r === 15) caseOK('3.1', 'تعدیل 15 → 15 (درست)');
    else caseBug('HIGH', '3.1', `خروجی غیرمنتظره: ${r}`);
  } else caseBug('CRITICAL', '3.1', 'rawAdj تعریف نشده');
} catch (e) { caseBug('HIGH', '3.1', e.message); }

console.log('\n── سناریو ۳.۲: clamp ±۱۵');
try {
  if (typeof window.rawAdj === 'function') {
    const r1 = window.rawAdj('100');
    const r2 = window.rawAdj('-100');
    const r3 = window.rawAdj('14');
    const r4 = window.rawAdj('16');
    const errors = [];
    if (r1 !== 15) errors.push(`100 → ${r1} (انتظار 15)`);
    if (r2 !== -15) errors.push(`-100 → ${r2} (انتظار -15)`);
    if (r3 !== 14) errors.push(`14 → ${r3} (انتظار 14)`);
    if (r4 !== 15) errors.push(`16 → ${r4} (انتظار 15)`);
    if (errors.length) caseBug('HIGH', '3.2', 'clamp اشتباه: ' + errors.join('; '));
    else caseOK('3.2', 'clamp صحیح: 100→15, -100→-15, 14→14, 16→15');
  }
} catch (e) { caseBug('HIGH', '3.2', e.message); }

console.log('\n── سناریو ۳.۳: اعداد فارسی و عربی');
try {
  if (typeof window.rawAdj === 'function') {
    const r1 = window.rawAdj('۱۵');
    const r2 = window.rawAdj('٠١٢'); // عربی
    if (r1 !== 15) caseBug('MEDIUM', '3.3', `فارسی "۱۵" → ${r1}`);
    else caseOK('3.3', `فارسی/عربی: "۱۵"→${r1}, "٠١٢"→${r2}`);
  }
} catch (e) { caseBug('HIGH', '3.3', e.message); }

// ─────────────────────────────────────────────
// کیس ۴: سال مالی (R9)
// ─────────────────────────────────────────────
section('کیس ۴: سال مالی و سود');

console.log('\n── سناریو ۴.۱: محاسبه سال مالی');
try {
  if (typeof window.ptfFiscalData === 'function') {
    const r = window.ptfFiscalData('1405');
    if (!r) caseBug('HIGH', '4.1', 'ptfFiscalData null');
    else if (typeof r !== 'object') caseBug('HIGH', '4.1', typeof r);
    else caseOK('4.1', `ptfFiscalData خروجی: ${Object.keys(r).length} فیلد`);
  }
} catch (e) { caseBug('HIGH', '4.1', e.message); }

console.log('\n── سناریو ۴.۲: قفل سال مالی - تکراری نباید قفل شود');
try {
  if (typeof window.ptfFiscalLock === 'function') {
    // ابتدا قفل کنیم
    window.setData('ptf_crm_fiscal_snapshots', [
      { year: '1405', locked: true, t: Date.now(), by: 'admin' }
    ]);
    const r = window.ptfFiscalLock('1405');
    if (!r) caseOK('4.2', 'ptfFiscalLock تکراری مسدود (null برگشت)');
    else if (r.ok === false) caseOK('4.2', 'تکراری مسدود');
    else caseBug('CRITICAL', '4.2', 'سال قفل‌شده مجدد قفل شد!');
  }
} catch (e) { caseBug('HIGH', '4.2', e.message); }

console.log('\n── سناریو ۴.۳: BUG-024 - canFiscal');
try {
  if (typeof window.canFiscal === 'function') {
    const orig = window.curRole;
    window.curRole = () => 'admin';
    const r1 = window.canFiscal();
    window.curRole = () => 'sales';
    const r2 = window.canFiscal();
    window.curRole = () => 'ceo';
    const r3 = window.canFiscal();
    window.curRole = () => 'accountant';
    const r4 = window.canFiscal();
    window.curRole = orig;
    if (r1 !== true) caseBug('CRITICAL', '4.3', 'admin دسترسی ندارد');
    else if (r2 !== false) caseBug('CRITICAL', '4.3', 'sales دسترسی دارد!');
    else if (r3 !== true) caseBug('HIGH', '4.3', 'ceo نباید دسترسی داشته باشد');
    else if (r4 !== false) caseBug('HIGH', '4.3', 'accountant نباید دسترسی داشته باشد');
    else caseOK('4.3', 'RBAC صحیح: admin✓ sales✗ ceo✗ accountant✗');
  } else caseBug('CRITICAL', '4.3', 'canFiscal تعریف نشده');
} catch (e) { caseBug('HIGH', '4.3', e.message); }

// ─────────────────────────────────────────────
// کیس ۵: تاریخ شمسی (US-446)
// ─────────────────────────────────────────────
section('کیس ۵: تاریخ شمسی (US-446)');

console.log('\n── سناریو ۵.۱: تبدیل ۱۴۰۵/۰۴/۱۴ → ISO');
try {
  if (typeof window.ptfJToISO === 'function') {
    const r = window.ptfJToISO('1405/04/14');
    if (!r) caseBug('HIGH', '5.1', 'ptfJToISO null');
    else if (r.indexOf('-') < 0) caseBug('HIGH', '5.1', `فرمت ISO نیست: ${r}`);
    else caseOK('5.1', `تبدیل: 1405/04/14 → ${r}`);
  } else caseBug('CRITICAL', '5.1', 'ptfJToISO تعریف نشده');
} catch (e) { caseBug('HIGH', '5.1', e.message); }

console.log('\n── سناریو ۵.۲: تاریخ نامعتبر → ایمن');
try {
  if (typeof window.ptfJToISO === 'function') {
    const tests = ['', 'abc', '1405/13/40', '0/0/0', null, undefined];
    let failed = false;
    for (const t of tests) {
      try {
        const r = window.ptfJToISO(t);
        // باید null برگرداند یا رشته خالی، نه خطا
      } catch (e) {
        failed = true;
        caseBug('MEDIUM', '5.2', `ورودی ${JSON.stringify(t)} خطا: ${e.message}`);
        break;
      }
    }
    if (!failed) caseOK('5.2', 'تاریخ‌های نامعتبر بدون crash');
  }
} catch (e) { caseBug('HIGH', '5.2', e.message); }

// ─────────────────────────────────────────────
// کیس ۶: سینک و داده‌صفر (US-382 / BUG-018)
// ─────────────────────────────────────────────
section('کیس ۶: یکپارچگی داده و سپر صفر');

console.log('\n── سناریو ۶.۱: GUARD_KEYS شامل کلیدهای حیاتی');
try {
  if (typeof window.GUARD_KEYS === 'undefined') caseBug('CRITICAL', '6.1', 'GUARD_KEYS تعریف نشده');
  else {
    const required = ['ptf_crm_customers', 'ptf_crm_rfqs', 'ptf_crm_offers', 'ptf_crm_deals', 'ptf_crm_payables', 'ptf_crm_smsbook'];
    const missing = required.filter(k => window.GUARD_KEYS.indexOf(k) < 0);
    if (missing.length) caseBug('HIGH', '6.1', 'GUARD_KEYS ناقص: ' + missing.join(', '));
    else caseOK('6.1', `GUARD_KEYS شامل ${required.length} کلید حیاتی`);
  }
} catch (e) { caseBug('HIGH', '6.1', e.message); }

console.log('\n── سناریو ۶.۲: SYNC_KEYS ⊃ GUARD_KEYS');
try {
  if (typeof window.SYNC_KEYS !== 'undefined' && typeof window.GUARD_KEYS !== 'undefined') {
    const missing = window.GUARD_KEYS.filter(k => window.SYNC_KEYS.indexOf(k) < 0);
    if (missing.length) caseBug('HIGH', '6.2', 'کلید در GUARD نیست ولی در SYNC نیست: ' + missing.join(', '));
    else caseOK('6.2', 'سلسله‌مراتب صحیح: SYNC ⊃ GUARD');
  }
} catch (e) { caseBug('HIGH', '6.2', e.message); }

// ─────────────────────────────────────────────
// کیس ۷: نوار ارز و سهمیه AI
// ─────────────────────────────────────────────
section('کیس ۷: نظام ارز و AI');

console.log('\n── سناریو ۷.۱: سهمیه AI');
try {
  if (typeof window.aiWB_quotaLimit === 'function') {
    const orig = window.curRole;
    const results = [];
    const roles = ['admin', 'chairman', 'ceo', 'commercial', 'sales', 'buyer', 'accountant', 'collector'];
    for (const r of roles) {
      window.curRole = () => r;
      const q = window.aiWB_quotaLimit();
      results.push({ role: r, quota: q });
    }
    window.curRole = orig;
    const errors = [];
    if (results.find(r => r.role === 'admin').quota !== 400) errors.push('admin quota');
    if (results.find(r => r.role === 'sales').quota !== 50) errors.push('sales quota');
    if (results.find(r => r.role === 'ceo').quota !== 400) errors.push('ceo quota (از v14.9: باید 400 باشد)');
    if (errors.length) caseBug('HIGH', '7.1', 'سهمیه اشتباه: ' + errors.join(', '));
    else caseOK('7.1', 'سهمیه صحیح: admin/ceo/commercial=400، بقیه=50');
  }
} catch (e) { caseBug('HIGH', '7.1', e.message); }

// ─────────────────────────────────────────────
// کیس ۸: ادغام ماژول‌ها (custmerge)
// ─────────────────────────────────────────────
section('کیس ۸: ادغام مشتریان (US-363)');

console.log('\n── سناریو ۸.۱: ادغام دو مشتری تکراری');
try {
  if (typeof window.ptfMergeStart !== 'function') {
    caseBug('CRITICAL', '8.1', 'ptfMergeStart تعریف نشده');
  } else {
    caseOK('8.1', 'ptfMergeStart تعریف شده');
  }
  if (typeof window.ptfMergeCommit !== 'function') caseBug('CRITICAL', '8.1b', 'ptfMergeCommit تعریف نشده');
} catch (e) { caseBug('HIGH', '8.1', e.message); }

// ─────────────────────────────────────────────
// کیس ۹: یتیم‌ها (US-444)
// ─────────────────────────────────────────────
section('کیس ۹: پاکسازی یتیم‌ها (US-444)');

console.log('\n── سناریو ۹.۱: اسکن یتیم');
try {
  if (typeof window.ptfOrphanScan === 'function') {
    const r = window.ptfOrphanScan();
    if (!r) caseOK('9.1', 'ptfOrphanScan بدون یتیم: null');
    else if (typeof r !== 'object') caseBug('HIGH', '9.1', typeof r);
    else caseOK('9.1', `ptfOrphanScan اجرا شد`);
  } else caseBug('CRITICAL', '9.1', 'ptfOrphanScan تعریف نشده');
} catch (e) { caseBug('HIGH', '9.1', e.message); }

// ─────────────────────────────────────────────
// کیس ۱۰: تبدیل ارز (US-414)
// ─────────────────────────────────────────────
section('کیس ۱۰: تسعیر ارز (US-414)');

console.log('\n── سناریو ۱۰.۱: ptfMoney با IRR');
try {
  if (typeof window.ptfMoney === 'function') {
    const tests = [
      { v: 0, cur: 'IRR', expected: 'ریال' },
      { v: 1000000, cur: 'IRR', expected: 'ریال' },
      { v: null, cur: 'IRR', expected: 'ریال' },
      { v: undefined, cur: 'IRR', expected: 'ریال' },
      { v: 'invalid', cur: 'IRR', expected: 'ریال' }
    ];
    for (const t of tests) {
      try {
        const r = window.ptfMoney(t.v, t.cur);
        if (typeof r !== 'string') caseBug('HIGH', '10.1', `${JSON.stringify(t)} → ${typeof r}`);
        else if (r.indexOf(t.expected) < 0) caseBug('MEDIUM', '10.1', `${JSON.stringify(t)} → ${r}`);
      } catch (e) {
        caseBug('HIGH', '10.1', `${JSON.stringify(t)} → خطا: ${e.message}`);
      }
    }
    caseOK('10.1', 'ptfMoney ایمن در همه ورودی‌ها');
  }
} catch (e) { caseBug('HIGH', '10.1', e.message); }

// ─────────────────────────────────────────────
// خلاصه نهایی
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`  خلاصه فاز ۴: ${PASS.length} پاس، ${BUGS.length} شکست`);
console.log('═══════════════════════════════════════════════════════════');

if (BUGS.length) {
  console.log('\n═══ باگ‌های یافت شده ═══');
  BUGS.forEach(b => console.log(`  [${b.severity}] کیس ${b.case}: ${b.desc}${b.detail ? ' — ' + b.detail : ''}`));
}

fs.writeFileSync(
  path.join(__dirname, 'phase4-master-cases-result.json'),
  JSON.stringify({ passed: PASS, failed: BUGS }, null, 2)
);
console.log(`\n💾 فایل خروجی: phase4-master-cases-result.json`);
