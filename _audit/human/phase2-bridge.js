/**
 * فاز ۲: تست رفتاری جامع CRM با jsdom
 * اجرای واقعی تمام ماژول‌ها در یک DOM واقعی
 * + سناریوهای استادی هر ماژول + تست متقابل
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.resolve(__dirname, '../../../node_modules/jsdom'));

const CRM_DIR = path.resolve(__dirname, '../../crm');
const INDEX_HTML = fs.readFileSync(path.join(CRM_DIR, 'index.html'), 'utf-8');

// ─────────────────────────────────────────────
// ساخت DOM واقعی
// ─────────────────────────────────────────────
const dom = new JSDOM(INDEX_HTML, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  resources: 'usable'
});

const { window } = dom;
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.navigator = window.navigator;
global.MutationObserver = window.MutationObserver;
global.IntersectionObserver = window.IntersectionObserver;
global.ResizeObserver = window.ResizeObserver;
global.matchMedia = window.matchMedia || (() => ({ matches: false, addListener: () => {} }));
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// helpers
window.getData = function(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) { return []; } };
window.setData = function(k, v) { localStorage.setItem(k, JSON.stringify(v)); };
window.genCode = function(p) { return p + '-' + Math.floor(10000 + Math.random() * 90000); };
window.faDate = () => '1405/04/14';
window.faDateTime = () => '1405/04/14 10:00';
window.faYear = () => '1405';
window.escP = function(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
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
window.confirm = () => true;
window.alert = () => {};
window.prompt = () => 'test';

// XLSX
window.XLSX = {
  utils: {
    book_new: () => ({}),
    aoa_to_sheet: () => ({}),
    sheet_to_json: () => [],
    json_to_sheet: () => ({}),
    book_append_sheet: () => {}
  },
  read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }),
  writeFile: () => {}
};
window.fetch = window.fetch || (() => Promise.resolve({ ok: false, status: 0, text: () => '' }));

// ─────────────────────────────────────────────
// لود تمام ماژول‌ها
// ─────────────────────────────────────────────
const MODULES = [
  'perms.js', 'rbac.js', 'theme.js', 'shell.js', 'iconx.js', 'icons.js', 'tables.js',
  'dedup.js', 'phonefmt.js', 'moneyx.js', 'datex.js', 'modalx.js', 'dialogx.js',
  'ui-kit.js', 'storage.js', 'sync.js', 'backup.js', 'golive.js', 'guards.js',
  'sms.js', 'messengers.js', 'workflow.js', 'mobilenav.js', 'kanban.js', 'launcher.js',
  'tour.js', 'myday.js', 'insights.js', 'fx.js', 'opex.js', 'shareholders.js',
  'lossguard.js', 'fiscal.js', 'petty.js', 'financehub.js', 'cheques.js',
  'oppo.js', 'salesfiles.js', 'scoring.js', 'supspec.js', 'listclean.js',
  'custmerge.js', 'docsx.js', 'contracts.js', 'letters.js', 'inqreader.js',
  'bridge.js', 'ai-workbench.js', 'reports.js', 'analyzer.js', 'cms.js',
  'archive.js', 'projects.js', 'rfqsmart.js', 'buycompare.js', 'offerlock.js',
  'offers-pro.js', 'offers.js', 'leads.js', 'listtools.js', 'recover.html'
];

// فایل‌هایی که نباید مستقیم اجرا شوند (HTML یا SW)
const SKIP_EXEC = new Set(['recover.html', 'sw.js']);

const loadResults = { loaded: [], failed: [] };
console.log('═══════════════════════════════════════════════');
console.log('  فاز ۲: تست رفتاری — لود ماژول‌ها');
console.log('═══════════════════════════════════════════════\n');

for (const m of MODULES) {
  const fp = path.join(CRM_DIR, m);
  if (!fs.existsSync(fp)) { loadResults.failed.push({ mod: m, err: 'NOT FOUND' }); continue; }
  if (SKIP_EXEC.has(m)) { loadResults.loaded.push({ mod: m, skipped: true }); continue; }
  try {
    const code = fs.readFileSync(fp, 'utf-8');
    // اجرا در context پنجره
    const fn = new window.Function(code);
    fn();
    loadResults.loaded.push({ mod: m });
  } catch (e) {
    loadResults.failed.push({ mod: m, err: e.message });
  }
}

console.log(`✓ Loaded: ${loadResults.loaded.length}`);
console.log(`✗ Failed: ${loadResults.failed.length}\n`);
if (loadResults.failed.length) {
  console.log('═══ خطاها ═══');
  loadResults.failed.forEach(f => console.log(`  ❌ ${f.mod}: ${f.err}`));
}

// شمارش توابع تعریف‌شده روی window
const defined = Object.keys(window).filter(k =>
  typeof window[k] === 'function' &&
  !k.startsWith('on') &&
  !['print', 'close', 'open', 'focus', 'blur', 'fetch'].includes(k) &&
  k.length > 2
);
console.log(`\n📊 window functions defined: ${defined.length}`);

// ─────────────────────────────────────────────
// ۲.۱: تست رفتاری BRIDGE - ماژول مرکزی
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۱: تست رفتاری BRIDGE.JS');
console.log('═══════════════════════════════════════════════\n');

const BUGS = [];
function bug(severity, module, desc, sample) {
  BUGS.push({ severity, module, desc, sample });
  console.log(`  [${severity}] ${module}: ${desc}`);
}

// سناریو ۱: ثبت استعلام جدید با اقلام
console.log('\n── سناریو ۱: ثبت استعلام با اقلام (saveRfq2)');
try {
  // تنظیم mock برای تست
  const initialRfqCount = (window.getData('ptf_crm_rfqs') || []).length;

  // بررسی وجود تابع
  if (typeof window.saveRfq2 !== 'function' && typeof window.saveRfq !== 'function') {
    bug('HIGH', 'bridge', 'saveRfq2/saveRfq تعریف نشده');
  } else {
    console.log('  ✓ تابع saveRfq2 موجود');
  }
} catch (e) {
  bug('CRITICAL', 'bridge', 'خطا در saveRfq2: ' + e.message);
}

// سناریو ۲: رندر لیست درخواست‌ها
console.log('\n── سناریو ۲: رندر فهرست درخواست‌ها (renderRfq)');
try {
  // اضافه کردن داده تست
  setData('ptf_crm_rfqs', [
    { cd: 'RFQ-TEST-001', custCd: 'C1', inqNo: 'PTF-RFQ-1405-001', subj: 'تست', items: [{name:'شیر',qty:2,unit:'عدد'}], st: 'st1', t: Date.now() }
  ]);
  setData('ptf_crm_customers', [{ cd: 'C1', co: 'مشتری تست' }]);
  if (typeof window.renderRfq === 'function') {
    const html = window.renderRfq() || '';
    console.log(`  ✓ renderRfq اجرا شد (${html.length} کاراکتر)`);
    if (html.length === 0) bug('LOW', 'bridge', 'renderRfq خروجی خالی داد');
  } else {
    bug('HIGH', 'bridge', 'renderRfq تعریف نشده');
  }
} catch (e) {
  bug('HIGH', 'bridge', 'renderRfq خطا: ' + e.message);
}

// سناریو ۳: وضعیت‌های مختلف درخواست
console.log('\n── سناریو ۳: وضعیت‌های مختلف درخواست');
try {
  if (window.PTF_RFQ_STATUSES) {
    console.log(`  ✓ PTF_RFQ_STATUSES: ${Object.keys(window.PTF_RFQ_STATUSES).length} وضعیت`);
  } else {
    bug('MEDIUM', 'bridge', 'PTF_RFQ_STATUSES تعریف نشده');
  }
  if (typeof window.ptfRfqSetStatus === 'function') {
    console.log('  ✓ ptfRfqSetStatus موجود');
  } else {
    bug('HIGH', 'bridge', 'ptfRfqSetStatus تعریف نشده (از US-367)');
  }
  if (typeof window.ptfRfqCascadeDelete === 'function') {
    console.log('  ✓ ptfRfqCascadeDelete موجود');
  } else {
    bug('HIGH', 'bridge', 'ptfRfqCascadeDelete تعریف نشده (از US-440)');
  }
} catch (e) {
  bug('HIGH', 'bridge', 'خطا: ' + e.message);
}

// ─────────────────────────────────────────────
// ۲.۲: تست رفتاری SALESFILES
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۲: تست رفتاری SALESFILES.JS');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: تشکیل پرونده فروش');
try {
  if (typeof window.ptfSF_ensure === 'function') {
    console.log('  ✓ ptfSF_ensure موجود');
    // تست واقعی
    setData('ptf_crm_rfqs', [{ cd: 'RFQ-T-1', inqNo: 'PTF-T-001' }]);
    setData('ptf_crm_offers', [{ no: 'OF-T-1', inqNo: 'PTF-T-001', st: 'won' }]);
    try {
      const result = window.ptfSF_ensure('PTF-T-001');
      console.log(`  ✓ ptfSF_ensure اجرا شد:`, result ? 'OK' : 'undefined');
    } catch(e) { bug('HIGH', 'salesfiles', 'ptfSF_ensure خطا: ' + e.message); }
  } else bug('CRITICAL', 'salesfiles', 'ptfSF_ensure تعریف نشده');
} catch (e) { bug('HIGH', 'salesfiles', e.message); }

console.log('\n── سناریو ۲: مراحل پرونده (sfStageOf)');
try {
  if (typeof window.sfStageOf === 'function') {
    console.log('  ✓ sfStageOf موجود');
    const noOffer = window.sfStageOf({});
    const won = window.sfStageOf({ wonOffer: 'OF-1' });
    const arch = window.sfStageOf({ archived: true, closeKind: 'settled' });
    console.log(`  ✓ مرحله بدون پیشنهاد: ${noOffer} (انتظار: 0)`);
    console.log(`  ✓ مرحله با پیشنهاد برنده: ${won} (انتظار: 1)`);
    console.log(`  ✓ مرحله بایگانی: ${arch} (انتظار: 12)`);
    if (noOffer !== 0) bug('MEDIUM', 'salesfiles', 'sfStageOf مرحله 0 را برنمی‌گرداند');
    if (won !== 1) bug('MEDIUM', 'salesfiles', 'sfStageOf مرحله 1 را برنمی‌گرداند');
    if (arch !== 12) bug('MEDIUM', 'salesfiles', 'sfStageOf مرحله 12 را برنمی‌گرداند');
  } else bug('CRITICAL', 'salesfiles', 'sfStageOf تعریف نشده (از US-433)');
} catch (e) { bug('HIGH', 'salesfiles', e.message); }

console.log('\n── سناریو ۳: توالی رویدادها (sfShipSeqCheck)');
try {
  if (typeof window.sfShipSeqCheck === 'function') {
    console.log('  ✓ sfShipSeqCheck موجود (از US-440)');
    // تست: delivery قبل از packing → باید رد شود
    const r1 = window.sfShipSeqCheck({ shipEvents: [{type:'packing',dateISO:'2026-01-01'}] }, 'delivered', '2025-12-01');
    if (r1.ok !== false) bug('HIGH', 'salesfiles', 'sfShipSeqCheck اجازه delivery قبل از packing می‌دهد!');
    else console.log('  ✓ delivery قبل از packing: رد شد');
    // تست صحیح
    const r2 = window.sfShipSeqCheck({ shipEvents: [{type:'packing',dateISO:'2026-01-01'}] }, 'delivered', '2026-01-15');
    if (r2.ok !== true) bug('HIGH', 'salesfiles', 'sfShipSeqCheck delivery بعد از packing را هم رد می‌کند!');
    else console.log('  ✓ delivery بعد از packing: قبول شد');
  } else bug('HIGH', 'salesfiles', 'sfShipSeqCheck تعریف نشده (از US-440)');
} catch (e) { bug('HIGH', 'salesfiles', e.message); }

// ─────────────────────────────────────────────
// ۲.۳: تست OFFERS
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۳: تست رفتاری OFFERS.JS');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: ساختار وضعیت‌های TO (6 وضعیتی)');
try {
  if (window.ST_TO) {
    const sts = Object.keys(window.ST_TO);
    console.log(`  ✓ ST_TO: ${sts.join(', ')}`);
    const expected = ['draft', 'registered', 'sent', 'approved', 'rejected', 'revise'];
    const missing = expected.filter(s => !sts.includes(s));
    if (missing.length) bug('CRITICAL', 'offers', 'ST_TO ناقص: ' + missing.join(','));
  } else bug('CRITICAL', 'offers', 'ST_TO تعریف نشده');
} catch (e) { bug('HIGH', 'offers', e.message); }

console.log('\n── سناریو ۲: انتقال عینی TO→CO (ptfInqAliases)');
try {
  if (typeof window.ptfInqAliases === 'function') {
    console.log('  ✓ ptfInqAliases موجود (از US-386)');
    setData('ptf_crm_rfqs', [
      { cd: 'CD-1', inqNo: 'INQ-1' },
      { cd: 'CD-2', inqNo: 'INQ-1' }, // همان شماره، cd متفاوت
    ]);
    const als = window.ptfInqAliases('INQ-1');
    console.log(`  ✓ aliases برای INQ-1: ${als.length} (انتظار: 2)`);
    if (als.length !== 2) bug('HIGH', 'offers', 'ptfInqAliases همه شناسه‌ها را نمی‌دهد');
  } else bug('CRITICAL', 'offers', 'ptfInqAliases تعریف نشده (از US-386)');
} catch (e) { bug('HIGH', 'offers', e.message); }

console.log('\n── سناریو ۳: قفل معماری پس از برد (offerPostAwardLocked)');
try {
  if (typeof window.offerPostAwardLocked === 'function') {
    console.log('  ✓ offerPostAwardLocked موجود (از US-431)');
    const won = window.offerPostAwardLocked({ st: 'won', wonAt: '2026-01-01' });
    const lost = window.offerPostAwardLocked({ st: 'lost' });
    const draft = window.offerPostAwardLocked({ st: 'draft' });
    console.log(`  ✓ won: ${won} (انتظار: true)`);
    console.log(`  ✓ lost: ${lost} (انتظار: false — می‌توان ویرایش کرد)`);
    console.log(`  ✓ draft: ${draft} (انتظار: false)`);
    if (won !== true) bug('CRITICAL', 'offers', 'offerPostAwardLocked برنده را قفل نمی‌کند');
  } else bug('CRITICAL', 'offers', 'offerPostAwardLocked تعریف نشده (از US-431)');
} catch (e) { bug('HIGH', 'offers', e.message); }

// ─────────────────────────────────────────────
// ۲.۴: تست SCORING
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۴: تست رفتاری SCORING.JS');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: محاسبه امتیاز تامین‌کننده');
try {
  if (typeof window.ptfSupplierScore === 'function') {
    console.log('  ✓ ptfSupplierScore موجود (از US-400)');
    const result = window.ptfSupplierScore({ co: 'تامین‌کننده تست', spBrands: ['Siemens'], spEquip: ['پمپ'] });
    if (!result || typeof result.score !== 'number') bug('HIGH', 'scoring', 'ptfSupplierScore خروجی نامعتبر');
    else console.log(`  ✓ امتیاز: ${result.score} (${result.lb || '-'})`);
  } else bug('CRITICAL', 'scoring', 'ptfSupplierScore تعریف نشده');
} catch (e) { bug('HIGH', 'scoring', e.message); }

console.log('\n── سناریو ۲: محاسبه امتیاز مشتری');
try {
  if (typeof window.ptfCustomerScore === 'function') {
    console.log('  ✓ ptfCustomerScore موجود');
    const result = window.ptfCustomerScore({ co: 'مشتری تست' });
    if (!result || typeof result.score !== 'number') bug('HIGH', 'scoring', 'ptfCustomerScore خروجی نامعتبر');
    else console.log(`  ✓ امتیاز: ${result.score}`);
  } else bug('CRITICAL', 'scoring', 'ptfCustomerScore تعریف نشده');
} catch (e) { bug('HIGH', 'scoring', e.message); }

console.log('\n── سناریو ۳: BUG-034 — تعدیل امتیاز (rawAdj)');
try {
  if (typeof window.rawAdj === 'function') {
    console.log('  ✓ rawAdj موجود (از v20.7)');
    // سناریوی بحرانی: 15 → نباید 51 شود
    const t1 = window.rawAdj('15');
    if (t1 === 51) bug('CRITICAL', 'scoring', 'BUG-034 بازگشت! rawAdj("15")=51 می‌دهد');
    else if (t1 === 15) console.log(`  ✓ rawAdj("15")=${t1} (درست)`);
    else console.log(`  ⚠ rawAdj("15")=${t1} (غیرمنتظره ولی نه 51)`);
    // اعداد فارسی
    const t2 = window.rawAdj('۱۵');
    console.log(`  ✓ rawAdj("۱۵")=${t2} (اعداد فارسی)`);
  } else bug('HIGH', 'scoring', 'rawAdj تعریف نشده');
} catch (e) { bug('HIGH', 'scoring', e.message); }

// ─────────────────────────────────────────────
// ۲.۵: تست FISCAL + R9
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۵: تست رفتاری FISCAL.JS (R9)');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: محرمانگی داشبورد سال مالی (BUG-024)');
try {
  if (typeof window.canFiscal === 'function') {
    console.log('  ✓ canFiscal موجود');
    // تست admin
    window.curRole = () => 'admin';
    if (!window.canFiscal()) bug('CRITICAL', 'fiscal', 'BUG-024! admin دسترسی ندارد');
    // تست sales
    window.curRole = () => 'sales';
    if (window.canFiscal()) bug('CRITICAL', 'fiscal', 'BUG-024! sales دسترسی دارد');
    else console.log('  ✓ sales دسترسی ندارد (درست)');
    // بازگردانی
    window.curRole = () => 'admin';
  } else bug('CRITICAL', 'fiscal', 'canFiscal تعریف نشده');
} catch (e) { bug('HIGH', 'fiscal', e.message); }

console.log('\n── سناریو ۲: محاسبه سود پروژه (ptfProjectProfitIRR)');
try {
  if (typeof window.ptfProjectProfitIRR === 'function') {
    console.log('  ✓ ptfProjectProfitIRR موجود (موتور سود واحد)');
    // تست
    const r = window.ptfProjectProfitIRR({ inqNo: 'INQ-1' });
    console.log('  ✓ اجرا موفق، خروجی:', r ? Object.keys(r).join(',') : 'null');
  } else bug('CRITICAL', 'fiscal', 'ptfProjectProfitIRR تعریف نشده — موتور سود ناقص!');
} catch (e) { bug('HIGH', 'fiscal', e.message); }

// ─────────────────────────────────────────────
// ۲.۶: تست PETTY + SHAREHOLDERS
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۶: تست رفتاری PETTY + SHAREHOLDERS');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: حساب تنخواه (ptfPettyBalance)');
try {
  if (typeof window.ptfPettyBalance === 'function') {
    console.log('  ✓ ptfPettyBalance موجود');
    const bal = window.ptfPettyBalance();
    console.log(`  ✓ موجودی: ${bal} (عددی)`);
  } else bug('CRITICAL', 'petty', 'ptfPettyBalance تعریف نشده');
} catch (e) { bug('HIGH', 'petty', e.message); }

console.log('\n── سناریو ۲: سهامداران (ptfShareholderBalance)');
try {
  if (typeof window.ptfShareholderBalance === 'function') {
    console.log('  ✓ ptfShareholderBalance موجود');
    const bal = window.ptfShareholderBalance('S1');
    console.log(`  ✓ موجودی سهامدار S1: ${bal}`);
  } else bug('CRITICAL', 'shareholders', 'ptfShareholderBalance تعریف نشده');
} catch (e) { bug('HIGH', 'shareholders', e.message); }

// ─────────────────────────────────────────────
// ۲.۷: تست FX
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log('  ۲.۷: تست رفتاری FX.JS');
console.log('═══════════════════════════════════════════════\n');

console.log('── سناریو ۱: نمایش پول (ptfMoney)');
try {
  if (typeof window.ptfMoney === 'function') {
    console.log('  ✓ ptfMoney موجود');
    const t1 = window.ptfMoney(1000000, 'IRR');
    console.log(`  ✓ ptfMoney(1000000, IRR) = ${t1}`);
    const t2 = window.ptfMoney(1000, 'EUR');
    console.log(`  ✓ ptfMoney(1000, EUR) = ${t2}`);
  } else bug('CRITICAL', 'fx', 'ptfMoney تعریف نشده');
} catch (e) { bug('HIGH', 'fx', e.message); }

// ─────────────────────────────────────────────
// ذخیره نتایج
// ─────────────────────────────────────────────
fs.writeFileSync(
  path.join(__dirname, 'phase2-bugs.json'),
  JSON.stringify({ bugs: BUGS, loaded: loadResults, windowFunctions: defined }, null, 2)
);

console.log('\n═══════════════════════════════════════════════');
console.log(`  فاز ۲ پایان: ${BUGS.length} مورد مشکوک یافت شد`);
console.log('═══════════════════════════════════════════════');
