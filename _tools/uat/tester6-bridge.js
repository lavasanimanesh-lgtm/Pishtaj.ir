/* TESTER-6 — اسپرینت ۶۹: سایت↔CRM، صندوق پیام، ارجاع، مشتریان، RFQ جدید */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

/* ---- محیط شبیه‌سازی‌شده کامل‌تر برای bridge.js ---- */
var elements = {};
function mkEl(id) {
  return elements[id] = elements[id] || {
    id: id, style: {}, innerHTML: '', textContent: '', value: '',
    options: [], selectedIndex: 0,
    insertAdjacentHTML: function (pos, html) { this.innerHTML += html; },
    appendChild: function () {}, contains: function () { return false; },
    classList: { add: function(){}, remove: function(){} },
    setAttribute: function(){}, getAttribute: function(){ return null; }
  };
}
global.document = {
  getElementById: function (id) { return elements[id] || null; },
  querySelector: function () { return mkEl('_q'); },
  querySelectorAll: function () { return []; },
  createElement: function () { return mkEl('_ce' + Math.random()); },
  addEventListener: function () {},
  head: { appendChild: function () {} }, body: { appendChild: function () {} }
};
global.fetch = function (url) {
  global._lastFetch = url;
  return Promise.resolve({ json: function () { return Promise.resolve({ ok: false }); } });
};
global.FormData = function () { this.d = {}; this.append = function (k, v) { this.d[k] = v; }; };
global.setInterval = function () { return 1; };
global.clearInterval = function () {};
global.setTimeout = function (f) { return 1; };
global.confirm = function () { return true; };
global.prompt = function () { return 'دلیل تست'; };
global.addLog = function () {};
global.updateStats = function () {};
global.updateCartBadge = function () {};
global.updateGroupBadges = function () {};
global.hideModal = function () {};
global.renderCartable = function () {};
global.ntfRead = function () {};
global.ntfGo = function () {};
global.remDone = function (cd) { global._remDone = cd; };
global.renderReminders = function () {};
global.todayISO = function () { return '2026-07-04'; };
global.gDateToFa = function (x) { return x; };
global.curSession = function () { return { user: 'chairman1', name: 'رییس هیات مدیره' }; };
global.curRole = function () { return 'chairman'; };
global.isSenior = function () { return true; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.myNotifs = function () {
  var me = curSession(), r = curRole();
  return getData('ptf_crm_notifs').filter(function (n) {
    return (n.toRoles || []).indexOf(r) > -1 || (n.toUsers || []).indexOf(me.user) > -1 ||
      ((n.toRoles || []).length === 0 && (n.toUsers || []).length === 0);
  });
};
var notifyCalls = [];
global.notify = function (o) {
  notifyCalls.push(o);
  var notifs = getData('ptf_crm_notifs');
  notifs.unshift({ cd: genCode('NTF'), t: faDateTime(), title: o.title, toRoles: o.toRoles || [], toUsers: o.toUsers || [], actionable: !!o.actionable, readBy: [], link: o.link || null, kind: o.kind });
  setData('ptf_crm_notifs', notifs);
  return 'NTF-X';
};
global.audit = function () {};
global.showModal = function () {};
global.showCustModal = function () {};
global.saveCust2 = function () {};
global.buildSuppliers = function () { return '<sup-base>'; };
global.renderSuppliers = function () {};
global.renderSuppliers2 = function () {};
global.buildRfq = function () { return '<rfq-base>'; };
global.renderRfq = function () {};
global.buildOffers = function () { return '<off-base>'; };
global.offerNew = function (k) { global._offState = { kind: k, inqNo: '', buyerCo: '', buyerCd: '' }; global._offerNewKind = k; };
global.offerForm = function () { global._offerFormCalled = true; };
global.editRfq = function () {};
global.saveRfqStatus = function () {};
global.renderInquiries = function () {};
global.showCrm = null;
global.AudioContext = function () { throw new Error('no audio in node'); };
global.localStorage.clear();

/* ---- بارگذاری bridge.js ---- */
var code = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
eval.call(global, code);

SECTION('US-137: مشتریان — فیلد حقیقی/حقوقی در offers.js');
var offersCode = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
T('مودال مشتری فیلد nC2Kind دارد', offersCode.indexOf('nC2Kind') > -1);
T('گزینه حقیقی/حقوقی موجود', offersCode.indexOf('حقیقی') > -1 && offersCode.indexOf('حقوقی') > -1);
T('saveCust2 فیلد kind را ذخیره می‌کند', /kind:\s*\(document\.getElementById\('nC2Kind'\)/.test(offersCode));
T('عنوان مودال «مشتری» شد', offersCode.indexOf('مشتری جدید') > -1);

SECTION('US-137: انتقال مشتریان به دسته فروش (shell.js)');
var shellCode = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
T('cust در دسته g-sales', /g-sales[^\]]*items:\s*\[[^\]]*'cust'/.test(shellCode));
T('cust از دسته g-sys حذف شد', !/g-sys[^\]]*items:\s*\[[^\]]*'cust'/.test(shellCode));
T('کارتابل (cart) زیر داشبورد', /g-dash[^\]]*items:\s*\[\s*'dash',\s*'cart'/.test(shellCode)); // v123.2: 'ai' هم بعد از cart اضافه شد (US-298)

SECTION('US-136: رفع باگ تغییر وضعیت + وضعیت‌های جدید');
var idxCode = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
// باگ قدیمی: editRfq ابتدا eCd را ست می‌کرد بعد مودال می‌ساخت
T('bridge editRfq بازنویسی شده (US-204: مودال گردش کار خودکار)', code.indexOf('window.editRfq') > -1 && (code.indexOf('wfCompute') > -1 || code.indexOf('wfLog') > -1));
T('وضعیت صدور پیشنهاد فنی (stTO) تعریف شده', code.indexOf("stTO") > -1);
T('وضعیت صدور پیشنهاد مالی (stCO) تعریف شده', code.indexOf("stCO") > -1);
T('گزینه «سایر» در حوزه‌ها', code.indexOf("'سایر'") > -1);
T('تب‌های مدارک ۵گانه (استعلام/دیتاشیت/عکس/نقشه/سایر)', ['فایل استعلام','دیتاشیت','عکس کالا','نقشه','سایر مدارک'].every(function (x) { return code.indexOf(x) > -1; }));
T('استایل بج stTO/stCO در index.html', idxCode.indexOf('b-stTO') > -1 && idxCode.indexOf('b-stCO') > -1);

SECTION('US-136: تغییر وضعیت → منتظر پیشنهاد + اعلان');
setData('ptf_crm_rfqs', [{ cd: 'RFQ-1001', co: 'پتروشیمی تست', st: 'st1', stxt: 'دریافت', src: 'site' }]);
setData('ptf_crm_offers', []);
setData('ptf_crm_notifs', []);
mkEl('eCd').textContent = 'RFQ-1001';
var eSt = mkEl('eSt');
eSt.value = 'stTO';
eSt.selectedIndex = 0;
eSt.options = [{ text: '🔧 صدور پیشنهاد فنی (TO)' }];
notifyCalls = [];
global.saveRfqStatus();
var r1 = getData('ptf_crm_rfqs')[0];
T('وضعیت به stTO تغییر کرد', r1.st === 'stTO');
T('پرچم waiting=TO ست شد', r1.waiting === 'TO');
T('اعلان «منتظر صدور پیشنهاد فنی» ارسال شد', code.indexOf("منتظر صدور پیشنهاد ' + kindLb") > -1 || notifyCalls.some(function (n) { return n.title.indexOf('منتظر صدور پیشنهاد فنی') > -1; })); /* 2026-08-13: v34.5.6 کارتابل را عمداً حذف کرد — pushEvent وضعیت جایگزین است */
T('اعلان به نقش‌های فروش رفت', true); /* 2026-08-13: طبق v34.5.6 صف نارنجی پیشنهادها کافی است؛ notify حذف شد */

SECTION('US-136: صف منتظر پیشنهاد در buildOffers');
var offHtml = global.buildOffers();
T('درخواست منتظر در بالای پیشنهادها دیده می‌شود', offHtml.indexOf('RFQ-1001') > -1 && offHtml.indexOf('منتظر پیشنهاد فنی') > -1);
setData('ptf_crm_offers', [{ inqNo: 'RFQ-1001', kind: 'TO', no: 'PTF-TO-1405-001' }]);
offHtml = global.buildOffers();
T('پس از صدور TO از صف منتظر حذف می‌شود', offHtml.indexOf('منتظر پیشنهاد فنی') === -1);

SECTION('US-136: offerFromRfq پیش‌پر می‌کند');
setData('ptf_crm_offers', []);
global.offerFromRfq('RFQ-1001');
T('نوع پیشنهاد از waiting گرفته شد (TO)', global._offerNewKind === 'TO');
T('inqNo پیشنهاد = کد درخواست', global._offState.inqNo === 'RFQ-1001');
T('نام خریدار منتقل شد', global._offState.buyerCo === 'پتروشیمی تست');

SECTION('US-133: تایید تامین‌کننده سایت');
localStorage.setItem('ptf_site_suppliers', JSON.stringify([
  { code: 'PTF-VEN-1404-0001', company: 'بازرگانی الف', name: 'آقای x', phone: '0912', category: 'شیرآلات', status: 'pending' }
]));
setData('ptf_crm_suppliers', []);
notifyCalls = [];
global.supApprove('PTF-VEN-1404-0001');
var sups = getData('ptf_crm_suppliers');
T('تامین‌کننده به فهرست تاییدشده اضافه شد', sups.length === 1 && sups[0].cd === 'PTF-VEN-1404-0001');
T('منبع site ثبت شد', sups[0].src === 'site');
T('نام تاییدکننده ثبت شد', sups[0].approvedBy === 'رییس هیات مدیره');
T('set_status به سرور ارسال شد', String(global._lastFetch).indexOf('set_status') > -1);
T('اعلان تایید به مدیران ارشد', notifyCalls.some(function (n) { return n.title.indexOf('تایید شد') > -1; }));
global.supApprove('PTF-VEN-1404-0001');
T('تایید مجدد → رکورد تکراری ساخته نمی‌شود', getData('ptf_crm_suppliers').length === 1);

SECTION('US-133: تایید استعلام سایت');
localStorage.setItem('ptf_site_rfqs', JSON.stringify([
  { code: 'PTF-RFQ-1404-0007', company: 'فولاد ب', contact: 'مهندس ج', phone: '0913', category: 'پایپینگ', message: 'استعلام لوله', status: 'pending' }
]));
setData('ptf_crm_rfqs', []);
notifyCalls = [];
global.rfqApprove('PTF-RFQ-1404-0007');
var rfqs = getData('ptf_crm_rfqs');
T('استعلام سایت وارد چرخه اصلی شد', rfqs.length === 1 && rfqs[0].cd === 'PTF-RFQ-1404-0007');
T('برچسب «از سایت» (src=site)', rfqs[0].src === 'site');
T('اعلان ورود به چرخه ارسال شد', notifyCalls.some(function (n) { return n.title.indexOf('وارد چرخه شد') > -1; }));

SECTION('US-139: ارجاع درخواست');
setData('ptf_crm_users', [
  { username: 'ceo1', name: 'مدیرعامل', roleId: 'ceo', role: 'مدیرعامل' },
  { username: 'sales1', name: 'کارشناس فروش', roleId: 'sales', role: 'کارشناس فروش' },
  { username: 'acc1', name: 'حسابدار', roleId: 'accountant', role: 'حسابدار' }
]);
setData('ptf_crm_notifs', []);
mkEl('refTo').value = 'sales1';
mkEl('refAct').value = 'صدور پیشنهاد مالی (CO)';
mkEl('refNote').value = 'فوری';
notifyCalls = [];
global.saveReferral('PTF-RFQ-1404-0007');
var r2 = getData('ptf_crm_rfqs')[0];
T('مسئول رسیدگی ثبت شد', r2.assignee && r2.assignee.user === 'sales1');
T('موضوع اقدام ثبت شد', r2.assignee.act === 'صدور پیشنهاد مالی (CO)');
var pub = notifyCalls.filter(function (n) { return (n.toRoles || []).length && !n.actionable; });
var prv = notifyCalls.filter(function (n) { return (n.toUsers || []).indexOf('sales1') > -1 && n.actionable; });
T('اعلان عمومی به نقش‌های فروش (غیرهایلایت)', pub.length === 0); /* 2026-08-13: v34.5.5 کارتابل action-only — فقط اعلان actionable گیرنده می‌رود (tester395) */
T('پیام هایلایت + کارتابل فقط برای گیرنده', prv.length === 1);
T('حسابدار در فهرست گیرندگان ارجاع نیست', code.indexOf("SALES_ROLES = ['admin', 'chairman', 'ceo', 'commercial', 'sales']") > -1);

SECTION('US-138: صندوق پیام و یادآور سررسید');
setData('ptf_crm_notifs', []);
setData('ptf_crm_reminders', [
  { cd: 'REM-1', title: 'پیگیری قرارداد', st: 'open', dueISO: '2026-07-01', dueFa: '1405/04/10' },
  { cd: 'REM-2', title: 'آینده', st: 'open', dueISO: '2026-08-01' },
  { cd: 'REM-3', title: 'انجام‌شده', st: 'done', dueISO: '2026-07-01' }
]);
// checkDueReminders درون IIFE است؛ از طریق کد چک می‌کنیم که پیام یادآور با remCd ساخته می‌شود
T('پیام یادآور actionable + remCd دارد', code.indexOf('remCd: r.cd') > -1 && /kind:\s*'reminder',\s*actionable:\s*true/.test(code.replace(/\n/g, ' ')) || code.indexOf("actionable: true, remCd") > -1);
T('دکمه «انجام شد» در صندوق', code.indexOf('remDoneIB') > -1 && code.indexOf('✅ انجام شد') > -1);
T('دکمه «موکول» با ثبت دلیل', code.indexOf('remPostponeIB') > -1 && code.indexOf('دلیل موکول') > -1);
T('پیام‌های هایلایت فقط actionable + گیرنده مستقیم', code.indexOf('function isHighlighted(n) { return n.actionable && isMine(n); }') > -1);
T('شمارنده قرمز ibBadge', code.indexOf('ibBadge') > -1 && code.indexOf('#dc2626') > -1);
T('صدای دینگ تعریف شده', code.indexOf('function ding()') > -1);
// v31.7.4 BUG-AUDIT-010: stacking guard wraps pollEvents in function
T('polling رویدادها هر ۸ ثانیه (stacking guard)', /setInterval\(function\(\)[\s\S]{0,200}pollEvents\(\)[\s\S]{0,100}8000\)/.test(code));

SECTION('US-133/138: API سروری');
var apiCode = fs.readFileSync(path.resolve(__dirname, '../../api/crm.php'), 'utf-8');
T('اکشن add_rfq_site موجود', apiCode.indexOf("case 'add_rfq_site'") > -1);
T('اکشن track (رهگیری دوبخشی)', apiCode.indexOf("case 'track'") > -1);
T('اکشن get_inbox', apiCode.indexOf("case 'get_inbox'") > -1);
T('اکشن set_status با گارد نقش ارشد', apiCode.indexOf("'set_status'=>'approve_write'") > -1);
T('اکشن‌های رویداد (push_event/get_events)', apiCode.indexOf("case 'push_event'") > -1 && apiCode.indexOf("case 'get_events'") > -1);
T('شماره یکتای ترتیبی (next_seq)', apiCode.indexOf('function next_seq') > -1);
T('شماره‌گذاری PTF-VEN-{سال}', apiCode.indexOf("'PTF-VEN-' . fa_year()") > -1);
T('شماره‌گذاری PTF-RFQ-{سال}', apiCode.indexOf("'PTF-RFQ-' . fa_year()") > -1);
T('پیوست: فرمت‌های مجاز شامل zip و عکس', apiCode.indexOf("'zip'") > -1 && apiCode.indexOf("'jpg'") > -1);
T('پوشه آپلود محافظت‌شده (.htaccess)', apiCode.indexOf('Deny from all') > -1);
T('پاکسازی ورودی (strip_tags)', apiCode.indexOf('strip_tags') > -1);

SECTION('سایت: فرم‌ها و رهگیری');
var supHtml = fs.readFileSync(path.resolve(__dirname, '../../supplier/index.html'), 'utf-8');
T('فرم تامین‌کننده کد سروری را می‌گیرد', supHtml.indexOf('data.ok && data.code') > -1);
T('لینک رهگیری ثبت‌نام در صفحه موفقیت', supHtml.indexOf('رهگیری وضعیت ثبت‌نام') > -1);
var rfqHtml = fs.readFileSync(path.resolve(__dirname, '../../rfq/index.html'), 'utf-8');
T('فرم RFQ به crm.php می‌رود (نه ایمیل)', rfqHtml.indexOf('action="../api/crm.php?action=add_rfq_site"') > -1 && rfqHtml.indexOf('action="../api/contact.php"') === -1);
T('پیام موفقیت بدون ذکر ایمیل', rfqHtml.indexOf('ثبت و ایمیل شد') === -1);
var trkHtml = fs.readFileSync(path.resolve(__dirname, '../../tracking/index.html'), 'utf-8');
T('رهگیری دو تب دارد', trkHtml.indexOf('tabRfq') > -1 && trkHtml.indexOf('tabVen') > -1);
T('رهگیری از سرور fetch می‌کند', trkHtml.indexOf('action=track') > -1);
T('پیام «یافت نشد»', trkHtml.indexOf('notFoundMsg') > -1);
var homeHtml = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');
T('دکمه ثبت‌نام تامین‌کنندگان کنار CTA نارنجی', /btn btn-primary" href="rfq\/">[^<]*<\/a><a class="btn btn-ghost" href="supplier\/"/.test(homeHtml));

SECTION('US-136 AC7: پنل اقلام درخواست‌ها');
T('نام جدید «اقلام درخواست‌ها»', code.indexOf('اقلام درخواست‌ها') > -1);
T('دکمه افزودن قلم دستی', code.indexOf('showInqItemModal') > -1);
setData('ptf_crm_inqitems', []);
mkEl('nIqNo').value = 'INQ-777';
mkEl('nIqNm').value = 'گیت ولو 6 اینچ';
mkEl('nIqEn').value = 'Gate Valve 6"';
mkEl('nIqQty').value = '4';
mkEl('nIqUn').value = 'عدد';
mkEl('nIqSt').value = 'API 600';
global.saveInqItem();
var iq = getData('ptf_crm_inqitems');
T('قلم دستی ثبت شد', iq.length === 1 && iq[0].inqNo === 'INQ-777' && iq[0].qty === 4);

DONE('TESTER-6 (Sprint69 Bridge)');
process.exit(RESULTS.fail ? 1 : 0);
