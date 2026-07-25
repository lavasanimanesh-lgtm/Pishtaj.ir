/* tester91 — v17.3 (US-413 — کیس R8: وضعیت‌های تامین st8/st9 + رنگ سبز/قرمز برد/باخت) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var sc = fs.readFileSync(path.join(BASE, 'scoring.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v17.3+', (function(){var m=idx.match(/var VER = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=17.3;})());
T('کش sw >= v17.3', (function(){var m=sw.match(/var CACHE = 'ptf-crm-v([0-9.]+)';/);return m&&parseFloat(m[1])>=17.3;})());
(function () {
  function vOf(f) { var m = idx.match(new RegExp(f.replace('.', '\\.') + '\\?v=([0-9.]+)')); return m ? parseFloat(m[1]) : 0; }
  T('cache-bust bridge/scoring >= 17.3', ['bridge.js', 'scoring.js'].every(function (f) { return vOf(f) >= 17.3; }));
})();

SECTION('US-413 (کد): وضعیت‌های جدید از منبع واحد');
T('st8/st9 در RFQ_STATUSES (بین st5 و st6)', br.indexOf("{ v: 'st8', t: '🏭 در حال تامین توسط تامین‌کننده' }") > -1 && br.indexOf("{ v: 'st9', t: '📦 تحویل تامین‌کننده' }") > -1 && br.indexOf('st8') < br.indexOf("{ v: 'st6'"));
T('مودال ویرایش درخواست هم از منبع واحد می‌خواند (فهرست دستی حذف شد)', br.indexOf('window.PTF_RFQ_STATUSES || []).filter(function (x) { return x.v !== ') > -1 && br.indexOf("{id:'st5', lb:'🔵 ابلاغ سفارش'}, {id:'st6'") === -1);
T('ptfRfqDueState: st8/st9 = پاسخ‌داده (بج مهلت خاموش)', br.indexOf("['st4', 'st5', 'st8', 'st9', 'st6', 'st7', 'stX']") > -1);
T('CSS بج b-st8/b-st9', idx.indexOf('.b-st8{background:#fde68a') > -1 && idx.indexOf('.b-st9{background:#bbf7d0') > -1);
T('گذار خودکار st8 با اولین خرید واقعی (پیش‌اتصال/تضمین فعال)', bc.indexOf('ptfRealBuyEnsureStatus') > -1 && bc.indexOf("ptfRfqSetStatus(r.cd, 'st8'") > -1);
T('گذار st9 با تایید کاربر پس از تکمیل خرید+تحویل ok همه اقلام', sc.indexOf("ptfRfqSetStatus(rfqRec.cd, 'st9', '📦 تحویل تامین‌کننده')") > -1 && sc.indexOf('allBought && allDlv') > -1 && sc.indexOf('confirm(') > -1);
T('گذار st9 فقط از رویداد تحویل ok (نه issue)', sc.indexOf("if (v === 'ok' && p.inqNo") > -1);

SECTION('US-413 (کد): رنگ برد/باخت فهرست درخواست‌ها');
T('سبز = CO/TC برنده، قرمز = بایگانی lost', br.indexOf("_wonInqs[o2.inqNo] = 1") > -1 && br.indexOf("p2.closeKind === 'lost'") > -1);
T('تطبیق با هر دو شناسه (cd/inqNo)', br.indexOf('var keys = [r2.cd, r2.inqNo].filter(Boolean);') > -1);
T('اولویت رنگ: برد/باخت > مهلت (US-348)', br.indexOf("var rowBg = wl === 'won' ? '#ecfdf5' : wl === 'lost' ? '#fef2f2' : (due && due.bg ? due.bg : '')") > -1);
T('بج 🏆 برنده / ❌ بازنده روی ردیف', br.indexOf('🏆 برنده</span>') > -1 && br.indexOf('❌ بازنده</span>') > -1);

SECTION('رفتاری: چرخه st8/st9 و رنگ‌ها');
global.window = global;
(function () {
  /* منطق _wl بازسازی از bridge (استخراج تابع داخلی renderRfq سخت است — منطق عین متن) */
  var mWl = br.match(/function _wl\(r2\) \{[\s\S]*?\n    \}/);
  T('_wl استخراج شد', !!mWl);
  if (mWl) {
    global._wonInqs = { 'INQ-77': 1 };
    global._lostInqs = { 'RFQ-2': 1 };
    eval(mWl[0].replace('function _wl', 'global._wl = function'));
    T('درخواست با inqNo برنده → سبز', _wl({ cd: 'RFQ-1', inqNo: 'INQ-77' }) === 'won');
    T('درخواست بازنده → قرمز', _wl({ cd: 'RFQ-2' }) === 'lost');
    T('درخواست عادی → بدون رنگ', _wl({ cd: 'RFQ-3' }) === '');
  }

  /* st9 پیشنهادی: منطق allBought/allDlv از scoring */
  var mDlv = sc.match(/window\.ptfPayableDlv = function \(cd, v\) \{[\s\S]*?\n  \};/);
  T('ptfPayableDlv استخراج شد', !!mDlv);
  if (!mDlv) return;
  global.pAll = function () { return getData('ptf_crm_payables'); };
  global.pSave = function (l) { setData('ptf_crm_payables', l); };
  global.audit = function () {};
  global.ptfToast = function () {};
  global.curSession = function () { return { user: 'admin', name: 'م' }; };
  global.document = { querySelector: function () { return null; }, querySelectorAll: function () { return []; }, getElementById: function () { return null; } };
  global.ptfPayablesOpen = function () {};
  global._confirms = [];
  global.confirm = function (m) { global._confirms.push(String(m)); return true; };
  global._stSet = null;
  global.ptfRfqSetStatus = function (cd, st) { global._stSet = st; return true; };
  global.PTF_RFQ_STATUSES = [{ v: 'st8' }, { v: 'st9' }];
  eval(mDlv[0].replace('window.ptfPayableDlv', 'global.ptfPayableDlv'));

  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', st: 'st8' }]);
  setData('ptf_crm_buycmp', [{ inqNo: 'RFQ-1', items: [{ nm: 'a' }, { nm: 'b' }], purchases: [{ idx: 0 }, { idx: 1 }] }]);
  setData('ptf_crm_payables', [
    { cd: 'P1', inqNo: 'RFQ-1', sup: 's1', item: 'a', amount: 1, paid: [], pay: 'cash' },
    { cd: 'P2', inqNo: 'RFQ-1', sup: 's2', item: 'b', amount: 1, paid: [], pay: 'cash' }
  ]);
  /* تحویل اول: هنوز همه ok نیستند → بدون پیشنهاد */
  ptfPayableDlv('P1', 'ok');
  T('تحویل قلم ۱ از ۲: هنوز گذار پیشنهاد نمی‌شود', global._stSet === null);
  /* تحویل دوم: همه ok → confirm → st9 */
  ptfPayableDlv('P2', 'ok');
  T('تحویل همه اقلام: confirm گذار + st9', global._confirms.some(function (c) { return c.indexOf('تحویل تامین‌کننده') > -1; }) && global._stSet === 'st9');
  /* تحویل با مشکل → هرگز پیشنهاد نمی‌دهد */
  global._stSet = null;
  setData('ptf_crm_payables', [{ cd: 'P3', inqNo: 'RFQ-1', sup: 's1', item: 'a', amount: 1, paid: [], pay: 'cash' }]);
  ptfPayableDlv('P3', 'issue');
  T('تحویل با مشکل: بدون گذار', global._stSet === null);
})();

SECTION('رگرسیون');
T('ptfRfqSetStatus (هسته v16.4) دست‌نخورده — گذار از همان مسیر با notify/سینک', br.indexOf('window.ptfRfqSetStatus = function (cd, stVal, stText)') > -1);
T('کانبان از منبع واحد می‌خواند (st8/st9 خودکار ستون می‌شوند)', fs.readFileSync(path.join(BASE, 'kanban.js'), 'utf-8').indexOf('window.PTF_RFQ_STATUSES || []') > -1);
T('saveRfqStatus مودال (wrapper) پابرجا', br.indexOf('window.saveRfqStatus = function () {') > -1);
T('بج مهلت US-348 پابرجا (فقط اولویت رنگ تغییر کرد)', br.indexOf('ptfRfqDueState === ') > -1 && br.indexOf('dueBadge') > -1);
T('stTO/stCO (منتظر صدور) پابرجا', br.indexOf("{ v: 'stTO'") > -1 && br.indexOf("{ v: 'stCO'") > -1);
T('تسعیر الزامی v17.2 پابرجا', bc.indexOf('بدون «نرخ تسعیر» ثبت نمی‌شود (US-412)') > -1);
T('ماژول‌های داشبورد قدیمی با st5/st6/st7 نمی‌شکنند (index دست‌نخورده در آن نقاط)', idx.indexOf("i.st==='st5'||i.st==='st6'||i.st==='st7'") > -1);

DONE('tester91-v173');
