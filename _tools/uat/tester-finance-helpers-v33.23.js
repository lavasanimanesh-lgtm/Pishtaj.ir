/* =====================================================================
   تست واحد Finance Helpers — v33.23.0
   بدون نیاز به setup — فقط Node.js + jsdom-minimal mock
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// شبیه‌سازی محیط مرورگر (حداقل)
const sandbox = {
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, addEventListener: () => {} },
  console: console,
  ptfJToISO: function(jalali) {
    // mock ساده: تبدیل ۱۴۰۵/۰۵/۱۲ → ۲۰۲۶-۰۸-۰۳
    if (typeof jalali !== 'string') return '';
    var m = jalali.match(/([\u06F0-\u06F90-9]{4})[\s\/-]([\u06F0-\u06F90-9]{1,2})[\s\/-]([\u06F0-\u06F90-9]{1,2})/);
    if (!m) return '';
    var y = +m[1].replace(/[\u06F0-\u06F9]/g, function(d){ return '0123456789'.indexOf(d); });
    var mo = +m[2].replace(/[\u06F0-\u06F9]/g, function(d){ return '0123456789'.indexOf(d); });
    var d = +m[3].replace(/[\u06F0-\u06F9]/g, function(d){ return '0123456789'.indexOf(d); });
    // mock: فقط ۱۴۰۵/۰۵/۱۲ = ۲۰۲۶-۰۸-۰۳ پشتیبانی می‌شود
    if (y === 1405 && mo === 5 && d === 12) return '2026-08-03';
    if (y === 1405 && mo === 5 && d === 11) return '2026-08-02';
    if (y === 1405 && mo === 4 && d === 22) return '2026-07-14';
    return '20' + String(y).slice(-2) + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// بارگذاری helpers
const helperSrc = fs.readFileSync(
  path.join('/home/user/Pishtaj.ir/crm/finance-helpers.js'),
  'utf-8'
);
vm.runInContext(helperSrc, sandbox);
const P = sandbox.window.PTF;

let pass = 0, fail = 0;
function t(name, expected, actual) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (ok) { pass++; console.log('  ✔ ' + name); }
  else {
    fail++;
    console.log('  ✘ ' + name);
    console.log('    Expected:', JSON.stringify(expected));
    console.log('    Actual:  ', JSON.stringify(actual));
  }
}
function section(name) { console.log('\n── ' + name + ' ──'); }

// ============================================================================
section('toFaEnNum — تبدیل ارقام فارسی/عربی به لاتین');
t('فارسی ساده', 1234567, P.toFaEnNum('۱۲۳۴۵۶۷'));
t('عربی ساده', 1234567, P.toFaEnNum('١٢٣٤٥٦٧'));
t('مخلوط فارسی/عربی/لاتین', 1234567, P.toFaEnNum('1۲۳٤٥٦7'));
t('با جداکننده کاما', 1234567, P.toFaEnNum('1,234,567'));
t('با جداکننده فارسی', 1234567, P.toFaEnNum('۱،۲۳۴،۵۶۷'));
// / جداکننده ارقام است نه اعشار (طبق رفتار ۱۷ فایل موجود) — حذف می‌شود
t('با / جداکننده', 123456, P.toFaEnNum('۱۲۳۴/۵۶'));
t('اعشاری فارسی با .', 1234.56, P.toFaEnNum('۱۲۳۴.۵۶'));
t('مقدار خالی', 0, P.toFaEnNum(''));
t('null', 0, P.toFaEnNum(null));
t('عدد منفی', -500, P.toFaEnNum('-500'));
t('فقط متن', 0, P.toFaEnNum('abc'));

// ============================================================================
section('invPaidSum — جمع پرداخت‌ها (الگوی اصلی ۲۰+ فایل)');
const inv1 = {
  payments: [
    { amt: 1000000 }, { amt: 500000 }, { amt: 200000, status: 'void' }, // void
  ],
  pays: [
    { amt: 300000 },
  ]
};
// جمع همه (active + void) = 1M + 500K + 200K + 300K = 2M
// فقط active = 1M + 500K + 300K = 1.8M (void=200K فیلتر می‌شود)
t('همه شامل شوند (غیرفعال هم)', 2000000, P.invPaidSum(inv1, { activeOnly: false }));
t('void/reversal فیلتر می‌شود (پیش‌فرض)', 1800000, P.invPaidSum(inv1, { activeOnly: true }));

// ============================================================================
section('invPaidSum — edge cases');
t('inv خالی/null', 0, P.invPaidSum(null));
t('inv بدون payments و pays', 0, P.invPaidSum({}));
t('inv با voided=true', 0, P.invPaidSum({ payments: [{ amt: 100, voided: true }] }));
t('inv با reversalCd', 0, P.invPaidSum({ payments: [{ amt: 100, reversalCd: 'RV-1' }] }));
t('inv با status=reversal', 0, P.invPaidSum({ payments: [{ amt: 100, status: 'reversal' }] }));
t('خلیط status=void (void) و amt معتبر', 200, P.invPaidSum({ payments: [{ amt: 200 }, { amt: 100, status: 'void' }] }));

// ============================================================================
section('invPaidSum — useAmountIrr (الگوی working-capital)');
const inv2 = {
  payments: [
    { amt: 100, amountIrr: 1500000 },  // فاکتور ارزی — amountIrr = 1.5M ریال
    { amt: 500000, amountIrr: 750000 }, // اختلاف — استفاده از amountIrr
  ],
  pays: [{ amt: 100000, amount: 120000 }]
};
t('پیش‌فرض: amt', 600100, P.invPaidSum(inv2));
t('useAmountIrr=true: اولویت amountIrr > amt', 2350000, P.invPaidSum(inv2, { useAmountIrr: true }));

// ============================================================================
section('invRemain — مانده فاکتور (overpay visible)');
t('فاکتور ساده: 100 - 30 = 70', 70000, P.invRemain({ amount: 100000, payments: [{ amt: 30000 }] }));
t('overpay: منفی (نه صفر!)', -50000, P.invRemain({ amount: 100000, payments: [{ amt: 150000 }] }));
t('دقیقاً تسویه', 0, P.invRemain({ amount: 100000, payments: [{ amt: 100000 }] }));
t('null = 0', 0, P.invRemain(null));
t('بدون payment = کل مبلغ', 100000, P.invRemain({ amount: 100000 }));

// ============================================================================
section('isInvPaid — بررسی تسویه');
t('هنوز مانده دارد', false, P.isInvPaid({ amount: 100000, payments: [{ amt: 30000 }] }));
t('تسویه کامل', true, P.isInvPaid({ amount: 100000, payments: [{ amt: 100000 }] }));
t('overpay = تسویه', true, P.isInvPaid({ amount: 100000, payments: [{ amt: 150000 }] }));
t('خالی = false', false, P.isInvPaid(null));

// ============================================================================
section('dealTotalCosts — P0-3 (جمع نه max)');
t('deal.costEvents + project.costEvents', 150000, P.dealTotalCosts({
  costEvents: [{ amt: 100000 }, { amt: 50000 }]
}));
t('پرونده بایگانی (costEvents + projectCosts + postArchiveCosts)', 180000, P.dealTotalCosts({
  origin: 'salesfile',
  costEvents: [{ amt: 100000 }],
  projectCosts: [{ amt: 50000 }],
  postArchiveCosts: [{ amt: 30000 }]
}));
t('خالی', 0, P.dealTotalCosts({}));
t('null', 0, P.dealTotalCosts(null));
t('مقایسه با رفتار قبلی (max — باگ): 100+50=150 نه max=100', 150000, P.dealTotalCosts({ costEvents: [{ amt: 100000 }], projectCosts: [{ amt: 50000 }] }));

// ============================================================================
section('matchBySupplierCd — P0-2 (cd نه نام)');
t('cd یکسان = match', true, P.matchBySupplierCd({ cd: 'SUP-1', co: 'پتروشیمی' }, { supplierCd: 'SUP-1' }));
t('cd متفاوت = no match', false, P.matchBySupplierCd({ cd: 'SUP-1' }, { supplierCd: 'SUP-2' }));
t('fallback نام (legacy data)', true, P.matchBySupplierCd({ cd: 'SUP-1', co: 'پتروشیمی' }, { sup: 'پتروشیمی' }));
t('fallback نام متفاوت', false, P.matchBySupplierCd({ cd: 'SUP-1', co: 'پتروشیمی' }, { sup: 'پالایشگاه' }));
t('null = false', false, P.matchBySupplierCd(null, {}));
t('cd خالی + نام خالی = false', false, P.matchBySupplierCd({ cd: '', co: '' }, { sup: '' }));

// ============================================================================
section('cashIsoOf + isInDateRange — تاریخ و بازه');
const today = new Date().toISOString().slice(0, 10);
t('تاریخ ISO ساده', today, P.cashIsoOf({ t: today }));
t('تاریخ شمسی → ISO', '2026-08-03', P.cashIsoOf({ t: '1405/05/12 10:00' }));  // نیاز به ptfJToISO دارد
t('خالی = خالی', '', P.cashIsoOf({}));
t('null', '', P.cashIsoOf(null));
t('isInDateRange — داخل بازه', true, P.isInDateRange('2026-08-15', '2026-08-01', '2026-08-31'));
t('isInDateRange — خارج', false, P.isInDateRange('2026-07-15', '2026-08-01', '2026-08-31'));

// ============================================================================
console.log('\n========================================');
console.log('=== Finance Helpers: ' + pass + ' PASS / ' + fail + ' FAIL ===');
console.log('========================================');
if (fail > 0) process.exit(1);
