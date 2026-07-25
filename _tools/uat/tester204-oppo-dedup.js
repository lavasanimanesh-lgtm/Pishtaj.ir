/* tester204 — v31.7.29 (BUG-OPPO-DUP-001: تکرار پیشنهاد/درخواست در فرصت‌های فعال پرونده‌های فروش)
 * اسکرین‌شات کارفرما: PTF-CO-1405-0441 دو بار (sent و draft) زیر یک مشتری؛ شمارنده «۷ پیشنهاد»
 * درحالی‌که اسناد یکتا کمتر بودند. ریشه: رکوردهای هم‌شماره میراث BUG-CODE-DUP-003 در ptf_crm_offers.
 * رفع: dedup نمایشی بر اساس شماره سند در هر دو نمای oppo (مشتری/درخواست) — نماینده = پیشرفته‌ترین
 * وضعیت (sent بر draft) سپس جدیدترین تاریخ + هشدار پاکسازی ریشه‌ای با فهرست شماره‌های آلوده. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var op = fs.readFileSync(path.join(ROOT, 'crm/oppo.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('dedup در نمای مشتری (US-435) با رتبه وضعیت', op.indexOf('BUG-OPPO-DUP-001') > -1 && /ST_RANK = \{ won: 6, lost: 5, sent: 4/.test(op));
T('dedup در نمای درخواست هم', /ST_RANK2 = \{ won: 6/.test(op) && /var offers2 = Object\.keys\(byNo2\)/.test(op));
T('نماینده: وضعیت پیشرفته‌تر، سپس تاریخ جدیدتر', /if \(ra !== rb\) return ra > rb \? a : b;\s*return dateKey\(a\) >= dateKey\(b\) \? a : b;/.test(op));
T('هشدار پاکسازی با فهرست شماره‌های آلوده', op.indexOf('_oppoDupNos') > -1 && op.indexOf('بررسی کدهای تکراری') > -1);

SECTION('رفتاری: بازتولید دقیق اسکرین‌شات');
global.window = global;
// داده آلوده مطابق اسکرین‌شات: 0441 دو بار (sent+draft) + 0446 و 0447 و 0140 و 0185 و 0284 تک
setData('ptf_crm_customers', [{ cd: 'CUST-1242', co: 'Foulad Mashiz Bardsir Co.' }]);
setData('ptf_crm_deals', []);
var offers = [
  { no: 'PTF-CO-1405-0441', kind: 'CO', st: 'sent',  buyerCd: 'CUST-1242', buyerCo: 'Foulad', inqNo: 'RFQ-1242', dateEn: '2026-07-19', items: [] },
  { no: 'PTF-CO-1405-0441', kind: 'CO', st: 'draft', buyerCd: 'CUST-1242', buyerCo: 'Foulad', inqNo: 'RFQ-1242', dateEn: '2026-07-19', items: [] }, // هم‌شماره!
  { no: 'PTF-CO-1405-0446', kind: 'CO', st: 'sent',  buyerCd: 'CUST-1242', buyerCo: 'Foulad', inqNo: 'RFQ-1242', dateEn: '2026-07-20', items: [] },
  { no: 'PTF-CO-1405-0447', kind: 'CO', st: 'draft', buyerCd: 'CUST-1242', buyerCo: 'Foulad', inqNo: 'RFQ-1242', dateEn: '2026-07-20', items: [] }
];
setData('ptf_crm_offers', offers);
eval(op.match(/window\.ptfOppoListByCustomer = function\(\)\{[\s\S]*?\n  \};/)[0]);
var groups = window.ptfOppoListByCustomer();
T('یک گروه مشتری', groups.length === 1);
var nos = groups[0].offers.map(function (o) { return o.no; });
T('0441 فقط یک بار (پایان تکرار اسکرین‌شات)', nos.filter(function (n) { return n === 'PTF-CO-1405-0441'; }).length === 1);
T('نماینده 0441 نسخه sent است نه draft (وضعیت پیشرفته‌تر)', groups[0].offers.filter(function (o) { return o.no === 'PTF-CO-1405-0441'; })[0].st === 'sent');
T('شمارنده گروه واقعی: ۳ پیشنهاد یکتا نه ۴ رکورد', groups[0].offers.length === 3);
T('شماره‌های آلوده برای هشدار ثبت شدند', (window._oppoDupNos || []).indexOf('PTF-CO-1405-0441') > -1 && window._oppoDupNos.length === 1);

SECTION('رفتاری: نمای بر اساس درخواست هم');
global.ptfOppoArchivedInqSet = function () { return {}; };
global.aliasesOf = function (r) { return [r.cd, r.inqNo].filter(Boolean); };
global.ptfRfqDueState = function () { return null; };
global.ptfSfDueState = function () { return null; };
setData('ptf_crm_rfqs', [{ cd: 'RFQ-1242', co: 'Foulad' }]);
eval(op.match(/window\.ptfOppoList = function \(\) \{[\s\S]*?\n  \};/)[0]);
var inqGroups = window.ptfOppoList();
var g1242 = inqGroups.filter(function (g) { return g.inqNo === 'RFQ-1242'; })[0];
T('نمای درخواست: 0441 یک بار', g1242 && g1242.offers.filter(function (o) { return o.no === 'PTF-CO-1405-0441'; }).length === 1);

SECTION('رگرسیون: پیشنهادهای متمایز دست‌نخورده');
setData('ptf_crm_offers', [
  { no: 'CO-A', kind: 'CO', st: 'sent', buyerCd: 'CUST-1242', inqNo: 'RFQ-1242', dateEn: '2026-07-01', items: [] },
  { no: 'CO-B', kind: 'CO', st: 'draft', buyerCd: 'CUST-1242', inqNo: 'RFQ-1242', dateEn: '2026-07-02', items: [] }
]);
T('دو پیشنهاد واقعاً متفاوت (گزینه‌های موازی US-OFF-ALT) هر دو می‌مانند', window.ptfOppoListByCustomer()[0].offers.length === 2);
T('بدون آلودگی: فهرست هشدار خالی', (window._oppoDupNos || []).length === 0);

DONE('tester204-oppo-dedup');
