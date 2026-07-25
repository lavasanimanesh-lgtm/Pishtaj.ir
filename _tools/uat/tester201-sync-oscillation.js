/* tester201 — v31.7.26 (BUG-SYNC-OSC-001: رشد و کاهش خودکار تامین‌کنندگان/مشتریان/دفتر تلفن)
 * گزارش کارفرما: رکوردها خودکار زیاد می‌شوند (تکراری) و بعد خودکار کم می‌شوند — نوسان دائمی.
 * دو ریشه (هر دو با شبیه‌سازی merge واقعی اثبات شد):
 *  ❶ دفترچه تلفن: smsBookSyncAll در هر rebuild برای رکوردهای auto با genCode('PB') کد تصادفی
 *    جدید می‌ساخت → دو دستگاه برای «همان مخاطب» دو cd متفاوت → merge با کلید cd هر دو را
 *    نگه می‌داشت (رشد/تکرار) و rebuild بعدی dedup می‌کرد (کاهش) → نوسان.
 *  ❷ merge عمومی: رکورد بدون فیلد شناسه (legacy) بی‌صدا حذف می‌شد (کاهش) و چون دستگاه دیگر
 *    هنوز داشت و push می‌کرد دوباره برمی‌گشت (رشد) → نوسان تامین‌کننده/مشتری.
 * رفع: merge دفترچه با کلید هویت واقعی (mob) + cd پایدار PB-{mob} + حفظ رکوردهای بدون id با امضای یکتا. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var sy = fs.readFileSync(path.join(ROOT, 'crm/sync.js'), 'utf-8');
var sm = fs.readFileSync(path.join(ROOT, 'crm/sms.js'), 'utf-8');

SECTION('وجود اصلاحات در source');
T('merge اختصاصی دفترچه با کلید mob', sy.indexOf('BUG-SYNC-OSC-001') > -1 && /key === 'ptf_crm_smsbook'/.test(sy));
T('اولویت merge دفترچه: دستی بر auto، سپس جدیدتر', /rManual && !exManual/.test(sy));
T('cd پایدار مشتق از موبایل در rebuild خودکار (دستی/اکسل مجازند genCode داشته باشند — یک‌باره‌اند)', sm.indexOf("'PB-' + mob") > -1 && !/src: 'auto'[^}]*genCode\('PB'\)/.test(sm) && !/genCode\('PB'\)[^}]*src: 'auto'/.test(sm));
T('merge عمومی: رکورد بدون id با امضای یکتا حفظ می‌شود', /noIdSig\[g\]/.test(sy) && /Object\.values\(map\)\.concat\(noId\)/.test(sy));
T('گاردهای قبلی rebuild دفترچه سالم (BUG-018)', sm.indexOf('_ptfSyncBootstrapped === false') > -1 && sm.indexOf('اگر هر دو فهرست منبع خالی') > -1);

SECTION('رفتاری: بازتولید نوسان و اثبات رفع');
global.window = global;
eval('var ptfMergeNoCollapse=function(){};' + sy.match(/window\.ptfSmartMerge = function[\s\S]*?\n  \};/)[0]);
function mg(key, a, b) { return JSON.parse(window.ptfSmartMerge(key, JSON.stringify(a), JSON.stringify(b))); }

// ❶ دفترچه: همان مخاطب با cd های متفاوت دو دستگاه (وضعیت آلوده فعلی)
var m1 = mg('ptf_crm_smsbook',
  [{ cd: 'PB-71001', mob: '09121112233', nm: 'علی', src: 'auto', t: '1405/04/28' }],
  [{ cd: 'PB-84500', mob: '09121112233', nm: 'علی', src: 'auto', t: '1405/04/29' }]);
T('❶ یک مخاطب = یک رکورد پس از merge (پایان تکرار دفترچه)', m1.length === 1 && m1[0].mob === '09121112233');
// مخاطب دستی هرگز قربانی auto نمی‌شود
var m2 = mg('ptf_crm_smsbook',
  [{ cd: 'x', mob: '09120000001', nm: 'اصلاح دستی', src: 'manual', t: '1' }],
  [{ cd: 'y', mob: '09120000001', nm: 'auto', src: 'auto', t: '9' }]);
T('❶ب مخاطب دستی بر auto مقدم است', m2.length === 1 && m2[0].nm === 'اصلاح دستی');
// دو مخاطب متفاوت هر دو می‌مانند
var m3 = mg('ptf_crm_smsbook',
  [{ cd: 'a', mob: '09121111111', nm: 'ا', src: 'auto' }],
  [{ cd: 'b', mob: '09122222222', nm: 'ب', src: 'auto' }]);
T('❶ج مخاطبین متفاوت حفظ می‌شوند', m3.length === 2);
// idempotent: merge دوباره همان نتیجه
T('❶د merge تکراری idempotent است (نوسان قطع)', mg('ptf_crm_smsbook', m1, m1).length === 1);

// ❷ تامین‌کننده legacy بدون cd
var sups = [{ cd: 'SUP-1001', co: 'الف' }, { id2: undefined, co: 'قدیمی بدون هیچ id', ph: '021' }];
var m4 = mg('ptf_crm_suppliers', sups, sups);
T('❷ رکورد بدون فیلد شناسه دیگر حذف نمی‌شود (پایان کاهش خودکار)', m4.length === 2);
T('❷ب و متورم هم نمی‌شود (امضای یکتا)', mg('ptf_crm_suppliers', m4, m4).length === 2);
// رکوردهای cd دار عادی سالم
var m5 = mg('ptf_crm_suppliers',
  [{ cd: 'SUP-1', co: 'x', ts: '2' }],
  [{ cd: 'SUP-1', co: 'y', ts: '1' }, { cd: 'SUP-2', co: 'z' }]);
T('❷ج مسیر عادی cd دار: newer-wins + union سالم', m5.length === 2 && m5.filter(function (s) { return s.cd === 'SUP-1'; })[0].co === 'x');

SECTION('رفتاری: rebuild دفترچه با cd پایدار');
global.curSession = function () { return { user: 'u1', name: 'ک' }; };
global.faDate = function () { return '1405/04/29'; };
global.genCode = function (p) { return p + '-' + Math.floor(Math.random() * 99999); };
global._ptfSyncBootstrapped = true;
setData('ptf_crm_customers', [{ co: 'شرکت مشتری', people: [{ nm: 'رضا', mobs: [{ n: '09123334455' }] }] }]);
setData('ptf_crm_suppliers', []);
setData('ptf_crm_smsbook', []);
global.book = function () { return getData('ptf_crm_smsbook'); };
global.saveBook = function (b) { setData('ptf_crm_smsbook', b); };
eval(sm.match(/function normMob\(m\) \{[\s\S]*?\n  \}/)[0].replace('function normMob', 'global.normMob = function'));
eval(sm.match(/window\.smsBookSyncAll = function[\s\S]*?\n  \};/)[0]);
window.smsBookSyncAll();
var b1 = getData('ptf_crm_smsbook');
window.smsBookSyncAll(); // rebuild دوم — دقیقاً سناریوی نوسان
var b2 = getData('ptf_crm_smsbook');
T('rebuild دوم همان cd را می‌سازد (PB-{mob} پایدار)', b1.length === 1 && b2.length === 1 && b1[0].cd === b2[0].cd && b1[0].cd === 'PB-09123334455');

DONE('tester201-sync-oscillation');
