/* tester81 — v16.3 (اسپرینت «ز»: US-392 خرید واقعی + US-393 روز من + اصلاح نوار ارز) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var md = fs.readFileSync(path.join(BASE, 'myday.js'), 'utf-8');
var fx = fs.readFileSync(path.join(BASE, 'fx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('اصلاح کوچک: نوار ارز');
T('نوار ارز بالاترین نقطه داشبورد', fx.indexOf('return w + h; /* v16.3') > -1);
T('فقط دلار/یورو آزاد در نوار', fx.indexOf('دلار آزاد 🇺🇸') > -1 && fx.indexOf('یورو آزاد 🇪🇺') > -1 && fx.indexOf("fxCell('دلار سنا") === -1);
T('نرخ‌های سنا برای راهنمای تسعیر حفظ شد', fx.indexOf('R.usd_sana_buy') > -1 && fx.indexOf('سنا خرید ') > -1);

SECTION('US-392 (کد): جریان خرید واقعی پس از برد');
T('لحظه برد CO → confirm هدایت به ثبت خرید واقعی', of.indexOf('قیمت خرید واقعی» اقلام این پروژه') > -1 && of.indexOf('ptfRealBuyOpen(o.inqNo || o.no)') > -1);
T('ptfRealBuyOpen: جدول موجود یا ساخت خودکار', bc.indexOf('window.ptfRealBuyOpen = function (inqNo)') > -1 && bc.indexOf("src: 'auto-realbuy'") > -1);
T('اولویت ساخت: اقلام CO برنده → CO دیگر → اقلام درخواست', bc.indexOf("o.inqNo === inqNo && o.st === 'won'") > -1 && bc.indexOf("getData('ptf_crm_inqitems').forEach") > -1);
T('بن‌بست ندارد: بدون اقلام → پیام راهنما', bc.indexOf('نه CO دارای اقلام هست و نه اقلام درخواست') > -1);
T('ptfRealBuyStatus: شمار ثبت‌شده + خرید ارزی بی‌نرخ', bc.indexOf('window.ptfRealBuyStatus = function (inqNo)') > -1 && bc.indexOf('pendingFx++') > -1);
T('بخش خرید واقعی روی پرونده فروش (hook renderDeals — بدون دست‌کاری salesfiles)', bc.indexOf('_rbDealsHooked') > -1 && bc.indexOf('🛒 <b>خرید واقعی اقلام</b>') > -1);
T('فقط پرونده‌های دارای CO برنده (wonOffer)', bc.indexOf('!deal.wonOffer) return;') > -1);
T('واژگان شفاف: استعلامی vs خرید واقعی (AC3)', bc.indexOf('استعلامی (کشف قیمت)') > -1 && bc.indexOf('مبنای سود پروژه است (US-392)') > -1);
T('اتصال به موتور سود پابرجا (v17.2: price همیشه IRR قطعی + رهگیری priceFx/rate)', bc.indexOf("cur: 'IRR', srcCur:") > -1 && bc.indexOf('rate: buyCur !== ') > -1);

SECTION('US-392 (رفتاری): ساخت خودکار و وضعیت');
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.curRole = function () { return 'admin'; };
global.audit = function () {}; global.notify = function () {};
global.alert = function (m) { global._lastAlert = String(m); };
global.window = global;
global.faDate = function () { return '1405/04/19'; };
global.genCode = function (p) { return p + '-' + (++global._sq || (global._sq = 1)); };
(function () {
  var mOpen = bc.match(/window\.ptfRealBuyOpen = function \(inqNo\) \{[\s\S]*?\n  \};/);
  var mStat = bc.match(/window\.ptfRealBuyStatus = function \(inqNo\) \{[\s\S]*?\n  \};/);
  T('توابع استخراج شدند', !!mOpen && !!mStat);
  if (!mOpen || !mStat) return;
  global.cmpAll = function () { return getData('ptf_crm_buycmp'); };
  global.cmpSave = function (l) { setData('ptf_crm_buycmp', l); };
  global.cmpOpen = function (id) { global._openedCmp = id; };
  eval(mOpen[0].replace('window.ptfRealBuyOpen', 'global.ptfRealBuyOpen'));
  eval(mStat[0].replace('window.ptfRealBuyStatus', 'global.ptfRealBuyStatus'));
  /* سناریو: CO برنده با ۲ قلم — جدول مقایسه وجود ندارد */
  setData('ptf_crm_buycmp', []);
  setData('ptf_crm_inqitems', []);
  setData('ptf_crm_offers', [{ no: 'CO-9', kind: 'CO', inqNo: 'INQ-500', st: 'won', items: [{ name: 'ولو کنترلی', qty: 2, unit: 'NO' }, { name: 'ترانسمیتر', qty: 1, unit: 'NO' }] }]);
  ptfRealBuyOpen('INQ-500');
  var c = getData('ptf_crm_buycmp')[0];
  T('جدول خودکار از اقلام CO برنده ساخته شد (۲ قلم)', c && c.inqNo === 'INQ-500' && c.items.length === 2 && global._openedCmp === c.id);
  /* وضعیت: یک خرید ریالی + یک ارزی بی‌نرخ */
  c.purchases = [{ idx: 0, sup: 'S1', price: 1000, cur: 'IRR' }, { idx: 1, sup: 'S2', price: 50, cur: 'EUR', rate: 0 }];
  setData('ptf_crm_buycmp', [c]);
  var st = ptfRealBuyStatus('INQ-500');
  T('وضعیت: ۲/۲ ثبت، ۱ ارزی بی‌نرخ', st.done === 2 && st.total === 2 && st.pendingFx === 1);
  /* دوباره باز کردن → جدول تکراری نمی‌سازد */
  ptfRealBuyOpen('INQ-500');
  T('باز کردن مجدد = همان جدول (بدون تکرار)', getData('ptf_crm_buycmp').length === 1);
})();

SECTION('US-393 (کد): روز من');
T('ماژول myday.js در index/sw ثبت شد', /myday\.js\?v=[0-9.]+/.test(idx) && sw.indexOf("'./myday.js'") > -1);
T('۶ منبع: یادآور/مهلت درخواست/تحویل تعهدی/چک/انقضای CO/سرنخ بی‌پیگیری', ['ptf_crm_reminders', 'ptfRfqDueState', 'ptfSfDueState', 'ptf_crm_cheques', 'validUntil', "l.stage !== 'new'"].every(function (k) { return md.indexOf(k) > -1; }));
T('روز من سند کسب‌وکاری را تغییر نمی‌دهد؛ فقط تنظیمات dismiss را sync می‌کند', md.indexOf("setData('ptf_crm_settings'") > -1 && !/setData\('ptf_crm_(rfqs|offers|deals|cheques|leads|reminders)'/.test(md));
T('هر آیتم کلیک → پرش به پنل', md.indexOf("goPanelByName(\\'' + it.panel + '\\')") > -1);
T('قرمزها اول + سقف ۳۰', md.indexOf("a.cl === '#dc2626' ? 0") > -1 && md.indexOf('.slice(0, 30)') > -1);
T('درج بعد از نوار ارز (زنجیره fx → myday)', md.indexOf("var mk = 'id=\"fxTicker\"';") > -1);
T('حالت خالی: پیام مثبت', md.indexOf('همه‌چیز مرتب است') > -1);

SECTION('US-393 (رفتاری): جمع‌آوری آیتم‌ها');
(function () {
  var m = md.match(/window\.ptfMyDayItems = function \(\) \{[\s\S]*?\n  \};/);
  T('ptfMyDayItems استخراج شد', !!m);
  if (!m) return;
  global.ptfRfqDueState = function (r) { return r.dueISO === '2020-01-01' ? { cl: '#dc2626', bg: '#fef2f2', lb: 'x', over: true } : null; };
  global.ptfSfDueState = function (r) { return r.dueISO === '2020-01-02' ? 'red' : null; };
  /* توابع کمکی محلی ماژول (خارج از تابع استخراج‌شده) */
  global.todayISO2 = function () { return new Date().toISOString().slice(0, 10); };
  global.plusDays = function (n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  eval(m[0].replace('window.ptfMyDayItems', 'global.ptfMyDayItems'));
  var today = new Date().toISOString().slice(0, 10);
  setData('ptf_crm_reminders', [{ cd: 'R1', st: 'open', dueISO: today, title: 'تماس با کارفرما', by: 'Admin' }, { cd: 'R2', st: 'done', dueISO: today, title: 'انجام‌شده' }]);
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', co: 'الف', dueISO: '2020-01-01', st: 'st1' }]);
  setData('ptf_crm_deals', [{ cd: 'D1', inqNo: 'INQ-1', buyerCo: 'ب', dueISO: '2020-01-02', st: 'open' }]);
  setData('ptf_crm_cheques', [{ cd: 'CH1', dueISO: today, amt: 5000, toWhom: 'فروشنده', st: 'open' }]);
  setData('ptf_crm_offers', [{ no: 'CO-1', kind: 'CO', validUntil: '2020-01-03', st: 'sent', buyerCo: 'ج' }]);
  setData('ptf_crm_leads', [{ co: 'سرنخ قدیمی', stage: 'new', hist: [], createdISO: '2020-01-01' }]);
  var items = ptfMyDayItems();
  T('هر ۶ نوع آیتم جمع شد', items.length === 6);
  T('یادآور done نیامد', !items.some(function (x) { return x.tx.indexOf('انجام‌شده') > -1; }));
  T('قرمزها اول مرتب شدند', items[0].cl === '#dc2626');
  T('آیتم‌ها پنل مقصد دارند', items.every(function (x) { return x.panel; }));
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
T('cache-bust فایل‌های اسپرینت (>=16.3)', ['fx.js', 'offers.js', 'buycompare.js', 'myday.js'].every(function (f) {
  var m2 = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m2 && (+m2[1] > 16 || (+m2[1] === 16 && +m2[2] >= 3));
}));

DONE('tester81-v163');
