/* tester45 — v12.5 (BUG-007 + US-304..308): کد یکتا، جریان کامل دستیار، تاریخ پیش‌فرض، ویرایش نامه دستیار */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var lt = fs.readFileSync(path.join(BASE, 'letters.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');

SECTION('BUG-007/US-304: کد یکتای کالا در ثبت گروهی');
T('ریشه باگ (طول آرایه) حذف شد', idx.indexOf("return 'P-' + (1001 + prods.length);") === -1);
T('بیشینه شماره موجود + شمارنده نشست', idx.indexOf('_ptfCodeSeq') > -1 && idx.indexOf('Math.max(max + 1') > -1);
T('regex استخراج شماره از کدهای موجود', idx.indexOf('function extractNum(code, pattern)') > -1 && idx.indexOf("new RegExp('^' + pattern") > -1);
T('TC هم در کدینگ یکتا', idx.indexOf("'TC':['ptf_crm_offers'") > -1);
// قرارداد فعلی: موتور واحد در index.html تعریف و برای همهٔ مسیرها export می‌شود.
T('ptfUnifiedCode به‌صورت global تعریف شده', idx.indexOf('window.ptfUnifiedCode = function (prefix)') > -1 && idx.indexOf("function genCode(p) { return window.ptfUnifiedCode(p); }") > -1);
T('کدگذاری بر اساس بیشینه و sequence انجام می‌شود', idx.indexOf('Math.max(max + 1') > -1 && idx.indexOf('window._ptfCodeSeq') > -1);
T('fallback قدیمی طول آرایه در مسیر اصلی نیست', idx.indexOf("return 'P-' + (1001 + prods.length)") === -1);

SECTION('US-306: تشخیص کارفرما از سربرگ (دستیار)');
/* v14.4 (US-362): اسکیمای OCR گسترش یافت (coEn/buyer بین co و inqno) — چک شکل‌آزاد شد */
T('پرامپت OCR: co و inqno از سربرگ', llm.indexOf('letterhead/header/stamp') > -1 && llm.indexOf('"co":""') > -1 && llm.indexOf('"inqno":""') > -1);
T('نگهداری تشخیص در کلاینت', ai.indexOf('_aiWB_detected') > -1);
T('مشتری ثبت‌شده → انتخاب خودکار', ai.indexOf('به‌طور خودکار انتخاب شد') > -1);
T('مشتری جدید → چک‌باکس ثبت خودکار', ai.indexOf('aiTP_newCust') > -1 && ai.indexOf('تاکنون ثبت نشده') > -1);
T('ثبت مشتری با dedupStamp و audit', ai.indexOf('ثبت خودکار مشتری از سربرگ') > -1 && ai.indexOf('dedupStamp(newC)') > -1);

SECTION('US-305: ثبت درخواست جدید از دستیار');
T('چک‌باکس ④ ثبت درخواست جدید', ai.indexOf('aiTP_rfq') > -1 && ai.indexOf('درخواست (استعلام) جدید') > -1);
T('درخواست با اقلام کامل ساخته می‌شود', ai.indexOf('items:rows.map(function(r){return {nm:r.nm') > -1);
T('اقلام به بانک inqitems هم می‌رود (اتصال به «از درخواست»)', ai.indexOf("getData('ptf_crm_inqitems')") > -1 && ai.indexOf('inqNo:rCd') > -1);
T('wfRefresh بعد از ثبت (وضعیت یتیم نماند)', ai.indexOf('wfRefresh(rCd)') > -1);
T('کد درخواست با genCode یکتا', ai.indexOf("genCode('RFQ')") > -1);
T('گزارش نتیجه شامل مشتری و درخواست جدید', ai.indexOf('مشتری جدید ثبت شد') > -1 && ai.indexOf('درخواست جدید ثبت شد') > -1);

SECTION('US-307: تاریخ پیش‌فرض پیشنهاد = امروز');
T('فیلد تاریخ با پیش‌فرض امروز', of.indexOf('ofDateJ') > -1 && of.indexOf("new Date().toISOString().slice(0, 10)") > -1);
T('استایل خراب دوگانه فیلد اصلاح شد', of.indexOf('direction:ltrcolor') === -1);
T('ذخیره: خالی → امروز (هر دو مسیر)', (of.match(/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/g) || []).length >= 3);
T('قالب چاپ: fallback تاریخ', op.indexOf("o.dateEn || new Date().toISOString().slice(0, 10)") > -1);

SECTION('US-308: ویرایش نامه پیش‌نویس دستیار');
T('نامه دستیار: kind/author/lang کامل', ai.indexOf("kind:'OUT', lang:'fa', author:curSession().user") > -1);
T('فیلدهای فرم مکاتبات (subject/att/bsm)', ai.indexOf("att:'ندارد', bsm:true") > -1);
T('مکاتبات: پیش‌نویس‌های قدیمی دستیار هم ✏️ می‌گیرند', lt.indexOf("l.src === 'ai-workbench'") > -1);
DONE('tester45-v125');
