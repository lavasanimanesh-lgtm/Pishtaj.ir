/* tester203 — v31.7.28 (BUG-MYDAY-DUP-001: تکرار انبوه اعلانات «روز من»)
 * اسکرین‌شات کارفرما: RFQ-1242 پنج بار، RFQ-1241 چهار بار، RFQ-1361 چهار بار در «روز من».
 * دو علت: ① رکوردهای هم‌کد به‌جامانده از دوران BUG-CODE-DUP-002/003 (قبل از رفع)
 * ② خود فهرست «روز من» هیچ dedup ای نداشت — هر رکورد منبع یک ردیف می‌ساخت.
 * رفع: ادغام بر اساس امضای panel+متن؛ رویداد واقعاً چندرکوردی با «×N رکورد هم‌کد» اطلاع‌رسانی می‌شود. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var md = fs.readFileSync(path.join(ROOT, 'crm/myday.js'), 'utf-8');

SECTION('وجود اصلاح در source');
T('بلاک dedup با امضای panel+tx', md.indexOf('BUG-MYDAY-DUP-001') > -1 && /var k = it\.panel \+ '\|' \+ it\.tx;/.test(md));
T('شمارنده ×N برای رویدادهای چندرکوردی (اطلاع بدون شلوغی)', md.indexOf('×') > -1 && md.indexOf('رکورد هم‌کد') > -1);
T('dedup قبل از sort و سقف ۳۰تایی اعمال می‌شود', md.indexOf('out = deduped;') < md.indexOf('out.sort(function (a, b)') && md.indexOf('out.slice(0, 30)') > -1);
T('قدیمی‌ترین تاریخ (sub) نگه داشته می‌شود', /String\(it\.sub \|\| ''\) < String\(ex\.sub \|\| ''\)/.test(md));

SECTION('رفتاری: بازتولید دقیق اسکرین‌شات');
global.window = global;
global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
// شبیه‌سازی داده آلوده: RFQ-1242 پنج رکورد هم‌کد، RFQ-1241 چهار تا، RFQ-1244 یکی
setData('ptf_crm_reminders', []);
setData('ptf_crm_deals', []);
setData('ptf_crm_cheques', []);
setData('ptf_crm_offers', []);
setData('ptf_crm_leads', []);
var rfqs = [];
for (var i = 0; i < 5; i++) rfqs.push({ cd: 'RFQ-1242', co: 'فولاد مشیز بردسیر', dueISO: '2026-07-18' });
for (var j = 0; j < 4; j++) rfqs.push({ cd: 'RFQ-1241', co: 'دانیال پترو', dueISO: '2026-07-18' });
rfqs.push({ cd: 'RFQ-1244', co: 'فولاد مشیز بردسیر', dueISO: '2026-07-20' });
setData('ptf_crm_rfqs', rfqs);
global.ptfRfqDueState = function (r) { return { bg: '#fee', cl: '#dc2626', over: true }; };
global.todayISO2 = function () { return new Date().toISOString().slice(0, 10); };
eval(md.match(/window\.ptfMyDayItems = function \(\) \{[\s\S]*?\n  \};/)[0].replace(/todayISO2\(\)/g, 'global.todayISO2()'));
var items = window.ptfMyDayItems();
var tx1242 = items.filter(function (x) { return x.tx.indexOf('RFQ-1242') > -1; });
var tx1241 = items.filter(function (x) { return x.tx.indexOf('RFQ-1241') > -1; });
var tx1244 = items.filter(function (x) { return x.tx.indexOf('RFQ-1244') > -1; });
T('RFQ-1242: از ۵ ردیف به ۱ ردیف (پایان شلوغی)', tx1242.length === 1);
T('شمارنده صادقانه: «×۵ رکورد هم‌کد» — کاربر از مشکل داده باخبر می‌ماند', tx1242[0].tx.indexOf('(×5 رکورد هم‌کد)') > -1);
T('RFQ-1241: از ۴ به ۱ با ×4', tx1241.length === 1 && tx1241[0].tx.indexOf('×4') > -1);
T('رویداد تک‌رکوردی بدون شمارنده اضافه', tx1244.length === 1 && tx1244[0].tx.indexOf('×') === -1);
T('جمع کل: ۳ ردیف به‌جای ۱۰ (اسکرین‌شات تمیز شد)', items.length === 3);
// idempotent
T('فراخوانی دوباره همان نتیجه (بدون side-effect روی داده)', window.ptfMyDayItems().length === 3 && getData('ptf_crm_rfqs').length === 10);

DONE('tester203-myday-dedup');
