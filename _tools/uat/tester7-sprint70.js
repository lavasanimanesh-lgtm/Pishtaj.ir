/* TESTER-7 — اسپرینت ۷۰: جریان برنده/پرونده خودکار، قفل فاکتور، TO→CO یکبار،
   T&C قفل‌شونده، کالای خودکار، جستجوی زنده، گزارشات، حذف inqs */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');

/* ---- محیط شبیه‌سازی ---- */
var els = {};
function mkEl(id) {
  return els[id] = els[id] || {
    id: id, style: {}, innerHTML: '', textContent: '', value: '', options: [], selectedIndex: 0, files: [],
    insertAdjacentHTML: function (p, h) { this.innerHTML += h; },
    appendChild: function () {}, classList: { add: function () {}, remove: function () {} },
    setAttribute: function () {}, getAttribute: function () { return null; }
  };
}
global.document = {
  getElementById: function (id) { return mkEl(id); },
  querySelectorAll: function () { return []; },
  querySelector: function () { return mkEl('_q'); },
  createElement: function () { return mkEl('_c' + Math.random()); },
  addEventListener: function () {}, head: { appendChild: function () {} }, body: { appendChild: function () {} }
};
global.window = global;
global.ptfSetOffState = function (v) { global._offState = v; return v; };
global.confirm = function (m) { global._lastConfirm = m; return global._confirmAns !== false; };
global.alert = function (m) { global._lastAlert = m; };
global.prompt = function () { return 'x'; };
global.addLog = function () {};
global.hideModal = function () {};
global.audit = function (m, a, r) { var l = getData('ptf_crm_audit'); l.unshift({ t: faDateTime(), user: curSession().name, role: 'ادمین', m: m, a: a, ref: r }); setData('ptf_crm_audit', l); };
global.notify = function (o) { global._notifs = global._notifs || []; global._notifs.push(o); return 'N1'; };
global.curSession = function () { return { user: global._curUser || 'admin', name: global._curName || 'ادمین سیستم' }; };
global.curRole = function () { return global._curRole || 'admin'; };
global.roleDef = function () { return { panels: '*', users: true, finance: true, lb: 'ادمین' }; };
global.isSenior = function () { return true; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.goPanel = function () {};
global.showCrm = null;
global.URL = { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} };
global.Blob = function () {};
global.localStorage.clear();

/* ---- بارگذاری ماژول‌ها به ترتیب واقعی ---- */
var offCode = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var prjCode = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var rbacCode = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var repCode = fs.readFileSync(path.join(BASE, 'reports.js'), 'utf-8');
var idxCode = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var shellCode = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var bridgeCode = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');

// از offers.js: توابع کلیدی
function ext(code, name) {
  var re = new RegExp('function ' + name + '\\s*\\(([\\s\\S]*?)\\n\\}', 'm');
  var m = code.match(re);
  if (!m) throw new Error(name + ' not found');
  eval.call(global, m[0].replace('function ' + name, 'global.' + name + ' = function'));
}
['offerSetSt', 'autoCreateProjectFromCO', 'offerToCo', 'offerSerial', 'myEnName',
 'offTcUsed', 'offAddTermLib', 'offDelTerm', 'offRenderTerms', 'offSyncTcLib', 'offAddTerm',
 'prodSrchRender', 'prodSrchPick', 'offAddItem', 'offRenderItems', 'offRenderTotals', 'offerForm', 'offerPickBuyer'].forEach(function (n) { ext(offCode, n); });
eval.call(global, offCode.match(/var TC_LIBRARY = \[[\s\S]*?\];/)[0]);
eval.call(global, offCode.match(/var PRODUCT_EN_UNITS = \[[\s\S]*?\];/)[0]);
eval.call(global, 'global._offState = {};');
['prjSerial'].forEach(function (n) { ext(prjCode, n); });
['refToInvoice'].forEach(function (n) { ext(rbacCode, n); });
// از index.html: توابع کالا
function extHtml(name) {
  var re = new RegExp('function ' + name + '\\s*\\(([\\s\\S]*?)\\n\\}', 'm');
  var m = idxCode.match(re);
  if (!m) throw new Error(name + ' not in index.html');
  eval.call(global, m[0].replace('function ' + name, 'global.' + name + ' = function'));
}
eval.call(global, idxCode.match(/var PROD_UNITS = \[[\s\S]*?\];/)[0].replace('var PROD_UNITS', 'global.PROD_UNITS'));
eval.call(global, idxCode.match(/var PROD_UNITS_EN = \[[\s\S]*?\];/)[0].replace('var PROD_UNITS_EN', 'global.PROD_UNITS_EN'));
['prodAutoCode', 'prodIsEnglish', 'saveProd'].forEach(extHtml);
global.renderProducts = function () {};
global.renderOffers = function () {};
global.renderDeals = function () {};
global.fmtTel = function (t) { return t && t.n; };
global.primaryPerson = function () { return null; };

SECTION('US-140: حذف ماژول درخواست‌ها');
T('دکمه inqs از سایدبار حذف شد', idxCode.indexOf("goPanel('inqs'") === -1);
T('inqs از منوی آکاردئونی حذف شد', !/items:\s*\[[^\]]*'inqs'/.test(shellCode));
T('بارگذاری اقلام درخواست (offLoadInqItems) حفظ شد', offCode.indexOf('offLoadInqItems') > -1);
T('داده ptf_crm_inqitems همچنان استفاده می‌شود', offCode.indexOf('ptf_crm_inqitems') > -1);

SECTION('US-141: جریان برنده شدن CO');
setData('ptf_crm_offers', [{ no: 'PTF-CO-1405-050', kind: 'CO', st: 'sent', buyerCo: 'Pars Co', buyerCd: 'CUST-1', inqNo: 'RFQ-88', dateFa: '1405/04/10', items: [{ qty: 2, price: 100 }], terms: [] }]);
setData('ptf_crm_projects', []);
setData('ptf_crm_rfqs', [{ cd: 'RFQ-88', co: 'Pars Co', subj: 'لوله', files: { inq: [{ name: 'req.pdf', key: 'k1' }] } }]);
global._notifs = [];
// رد تایید → تغییری نکند
/* شبیه‌سازی ptfSF_ensure (از salesfiles.js — در محیط تست لود نمی‌شود) */
global.ptfSF_ensure = global.ptfSF_ensure || function (inqNo, co) {
  var l = getData('ptf_crm_deals');
  var r = l.filter(function (x) { return x.inqNo === inqNo; })[0];
  if (!r) { r = { cd: 'DEAL-T1', inqNo: inqNo, buyerCo: co || '', docs: [] }; l.unshift(r); setData('ptf_crm_deals', l); }
  return r;
};
global._confirmAns = false;
offerSetSt('PTF-CO-1405-050', 'won', mkEl('selTest'));
T('بدون تایید، وضعیت تغییر نمی‌کند', getData('ptf_crm_offers')[0].st === 'sent');
T('هشدار غیرقابل بازگشت در دیالوگ', String(global._lastConfirm).indexOf('امکان بازگشت به مرحله قبل وجود ندارد') > -1);
// با تایید
global._confirmAns = true;
offerSetSt('PTF-CO-1405-050', 'won', mkEl('selTest'));
var o1 = getData('ptf_crm_offers')[0];
T('با تایید، وضعیت برنده شد', o1.st === 'won');
T('ثبت‌کننده و زمان برنده شدن ذخیره شد', !!o1.wonBy && !!o1.wonAt);
/* v13.6 (US-322 تکمیلی): CO برنده دیگر در بایگانی (projects) پرونده نمی‌سازد —
   مدارک به «پرونده فروش» (deals) منضم می‌شود؛ بایگانی فقط مقصد مختومه‌سازی است */
T('v13.6: بایگانی دست نمی‌خورد (پرونده جدید ساخته نمی‌شود)', getData('ptf_crm_projects').length === 0);
var deals70 = getData('ptf_crm_deals');
T('v13.6: پرونده فروش با CO برنده غنی شد', deals70.length >= 1 && deals70[0].wonOffer === 'PTF-CO-1405-050');
T('v13.6: ضمائم درخواست به پرونده فروش منضم شد', (deals70[0].docs || []).some(function (x) { return x.name === 'req.pdf'; }));
// برنده دوباره → رکورد تکراری نسازد
offerSetSt('PTF-CO-1405-050', 'won', mkEl('selTest'));
T('برنده مجدد → پرونده فروش تکراری ساخته نمی‌شود', getData('ptf_crm_deals').length === deals70.length);
T('رندر: وضعیت برنده = بج قفل (بدون select)', offCode.indexOf('برنده 🔒') > -1);
T('رندر: دکمه حذف برای برنده مخفی', /isWon \? '' : '.*offerDel/.test(offCode.replace(/\n/g, '')));

SECTION('US-141 AC5: قفل ارجاع فاکتور');
setData('ptf_crm_offers', [{ no: 'PTF-CO-1405-051', kind: 'CO', st: 'sent', buyerCo: 'X', items: [] }]);
global._lastAlert = '';
refToInvoice('PTF-CO-1405-051');
T('CO غیربرنده قابل ارجاع نیست', !getData('ptf_crm_offers')[0].invRef && String(global._lastAlert).indexOf('برنده') > -1);
getData('ptf_crm_offers')[0].st = 'won';
setData('ptf_crm_offers', getData('ptf_crm_offers'));
var offs = getData('ptf_crm_offers'); offs[0].st = 'won'; setData('ptf_crm_offers', offs);
refToInvoice('PTF-CO-1405-051');
T('CO برنده از ماژول پیشنهادها ارجاع نمی‌شود و به پرونده فروش هدایت می‌شود (v18.9)', !getData('ptf_crm_offers')[0].invRef);
T('UI: دکمه فاکتور برای غیربرنده قفل', offCode.indexOf('فاکتور 🔒') > -1);

SECTION('US-142 AC5 → v31.7.21 US-OFF-ALT: تبدیل TO→CO — قفل تاییدی (نه مطلق)');
setData('ptf_crm_offers', [
  { no: 'PTF-TO-1405-001', kind: 'TO', st: 'sent', items: [{ qty: 1 }], terms: [], coNo: 'PTF-CO-1405-099' },
  { no: 'PTF-CO-1405-099', kind: 'CO', st: 'draft', items: [], terms: [] }
]);
global.offerForm = function () { global._formOpened = true; };
/* v31.7.21: با CO موجود، confirm پیشنهاد جایگزین می‌آید — انصراف = هیچ اتفاقی */
global._formOpened = false;
var _oldConfirm = global.confirm; global.confirm = function () { return false; };
offerToCo('PTF-TO-1405-001');
T('TO با CO موجود + انصراف کاربر → تبدیل انجام نمی‌شود (قفل ضدسهو حفظ)', global._formOpened === false);
/* تایید کاربر → پیشنهاد جایگزین با مارک altOf */
global.confirm = function () { return true; };
offerToCo('PTF-TO-1405-001');
T('TO با CO موجود + تایید → گزینه جایگزین ساخته می‌شود (US-OFF-ALT)', global._formOpened === true && _offState.altOf === 'PTF-CO-1405-099');
global.confirm = _oldConfirm;
// حذف CO → تبدیل عادی بدون دیالوگ گزینه
setData('ptf_crm_offers', [{ no: 'PTF-TO-1405-001', kind: 'TO', st: 'sent', items: [{ qty: 1 }], terms: [], coNo: 'PTF-CO-1405-099' }]);
global._lastAlert = ''; global._formOpened = false;
offerToCo('PTF-TO-1405-001');
T('پس از حذف CO قبلی، تبدیل دوباره فعال', global._formOpened === true && !global._lastAlert);
T('srcToNo برای قفل بعدی ست شد', _offState.srcToNo === 'PTF-TO-1405-001');
T('ذخیره CO لینک coNo روی TO می‌گذارد (فقط اولین‌بار — alt بازنویسی نمی‌کند)', /x\.no === o\.srcToNo && \(!x\.coNo \|\| !offers\.some/.test(offCode));

SECTION('US-142 AC6: قفل بندهای T&C');
_offState = { terms: [], tcUsed: [], termLib: {}, kind: 'CO', items: [] };
mkEl('offTcLib').value = '0';
mkEl('offTcLib').options = TC_LIBRARY.map(function (t, i) { return { value: String(i), text: t.slice(0, 80), disabled: false }; });
offAddTermLib();
T('بند اول اضافه شد', _offState.terms.length === 1);
global._lastAlert = '';
offAddTermLib();
T('انتخاب مجدد همان بند → قفل', _offState.terms.length === 1 && String(global._lastAlert).indexOf('🔒') > -1);
offDelTerm(0);
T('حذف بند → آزادسازی', _offState.tcUsed.length === 0);
offAddTermLib();
T('پس از حذف، دوباره قابل انتخاب', _offState.terms.length === 1);

SECTION('US-142 AC1/AC2: جستجو با Inquiry No + تب‌های جدا');
T('جستجو شامل inqNo', /\(o\.inqNo\|\|''\)/.test(offCode));
T('تب TO/CO/همه تعریف شده', offCode.indexOf('offSetTab') > -1 && offCode.indexOf('پیشنهادهای فنی (TO)') > -1);
T('ستون شماره درخواست در جدول', offCode.indexOf('<th>شماره درخواست</th>') > -1);

SECTION('US-142 AC3: Contact Person قفل');
setData('ptf_crm_users', [{ username: 'sales1', name: 'کارشناس', nameEn: 'Mr. Karimi', roleId: 'sales' }]);
global._curUser = 'sales1'; global._curName = 'کارشناس';
T('myEnName اختصاری کاربر را برمی‌گرداند', myEnName() === 'Mr. Karimi');
global._curUser = 'admin'; global._curName = 'ادمین سیستم';
T('فیلد ofSeller قفل (readonly)', offCode.indexOf('id="ofSeller"') > -1 && /ofSeller[^>]*readonly/.test(offCode));
T('فیلد اختصاری EN در فرم کاربر', rbacCode.indexOf('nU2En') > -1 && rbacCode.indexOf('اختصاری انگلیسی الزامی') > -1);
T('ذخیره nameEn در رکورد کاربر', rbacCode.indexOf('nameEn: nmEn') > -1);

SECTION('US-142 AC4: حذف Model از TO + سقف ۴ ستون');
T('هدر سند TO بدون Model (v84+: چاپ به offers-pro/docCols منتقل شد)', require('fs').readFileSync(require('path').resolve(__dirname,'../../crm/offers-pro.js'),'utf-8').indexOf('BASE_COLS_TO') > -1);
T('فرم TO بدون ستون Model', offCode.indexOf(": '<tr><th>#</th><th>نام کالا (English Item Name)</th><th>شرح تکمیلی</th><th>تعداد</th><th>واحد</th><th>برند</th>'") > -1);
T('CO همچنان Model دارد', offCode.indexOf('<th style="width:9%">Model</th>') > -1);
T('MAX_EXTRA_COLS تعریف شده (US-183)', /MAX_EXTRA_COLS = \d+/.test(offCode));

SECTION('US-142 AC7: مهر و امضا روی CO');
T('پروفایل امضا در PDF خوانده می‌شود', offCode.indexOf('ptf_crm_sigprofiles') > -1 && offCode.indexOf('sp.stamp') > -1);
T('issuedBy هنگام ذخیره ثبت می‌شود', offCode.indexOf('o.issuedBy = curSession().user') > -1);

SECTION('US-143: ماژول کالاها');
setData('ptf_crm_products', []);
T('کد خودکار اولین کالا (US-116: کدینگ واحد P-)', /^P-\d+$/.test(prodAutoCode()));
setData('ptf_crm_products', [{ cd: 'P-1007', nm: 'x' }]);
T('کد خودکار ادامه شماره (فرمت واحد)', /^P-\d+$/.test(prodAutoCode()));
T('فیلد کد در فرم قفل', idxCode.indexOf('خودکار — قفل 🔒') > -1);
T('تشخیص شرح انگلیسی', prodIsEnglish('Elbow 90 LR') === true && prodIsEnglish('زانو ۹۰') === false);
// شرح EN + واحد فارسی → خطا
setData('ptf_crm_products', []);
mkEl('nPCd').value = ''; mkEl('nPNm').value = 'Gate Valve 6IN'; mkEl('nPUn').value = 'عدد';
mkEl('nPEn').value = ''; mkEl('nPCa').value = 'شیرآلات'; mkEl('nPSt').value = ''; mkEl('nPBr').value = ''; mkEl('nPPr').value = ''; mkEl('nPDs').value = '';
global._lastAlert = '';
saveProd(false);
T('شرح EN + واحد فارسی → رد شد', getData('ptf_crm_products').length === 0 && String(global._lastAlert).indexOf('انگلیسی') > -1);
mkEl('nPUn').value = 'PCS';
saveProd(false);
T('شرح EN + واحد EN → ثبت شد', getData('ptf_crm_products').length === 1);
T('کد خودکار روی رکورد (فرمت واحد)', /^P-\d+$/.test(getData('ptf_crm_products')[0].cd));
mkEl('nPNm').value = ''; global._lastAlert = '';
saveProd(false);
T('بدون شرح → رد (اجباری)', getData('ptf_crm_products').length === 1 && String(global._lastAlert).indexOf('الزامی') > -1);

SECTION('US-143 AC4: جستجوی زنده کالا در پیشنهاد');
setData('ptf_crm_products', [
  { cd: 'PTF-P-0001', nm: 'زانو ۹۰ درجه مانیسمان', en: 'Elbow 90 LR', un: 'عدد', st: 'A234' },
  { cd: 'PTF-P-0002', nm: 'زانو ۴۵ درجه', en: 'Elbow 45', un: 'عدد' },
  { cd: 'PTF-P-0003', nm: 'فلنج کلاس ۱۵۰', en: 'Flange 150', un: 'عدد' }
]);
_offState = { items: [], kind: 'TO', extraCols: [] };
mkEl('prodSrchInp').value = 'زانو';
mkEl('prodSrchList');
prodSrchRender();
var listHtml = els['prodSrchList'].innerHTML;
T('جستجوی «زانو» → ۲ نتیجه', (listHtml.match(/prodSrchPick/g) || []).length === 2 && listHtml.indexOf('فلنج') === -1);
global.document.querySelectorAll = function () { return []; };
prodSrchPick('PTF-P-0001');
T('کلیک روی نتیجه → ردیف اضافه شد', _offState.items.length === 1 && _offState.items[0].name === 'Elbow 90 LR');
T('جستجوی کالا (v88: offerlock جایگزین مودال قدیمی)', require('fs').readFileSync(require('path').resolve(__dirname,'../../crm/offerlock.js'),'utf-8').indexOf('prodSearch') > -1 || (offCode.indexOf('prodSrchInp') > -1));

SECTION('US-144: ماژول گزارشات');
T('فایل reports.js موجود و در index لود می‌شود', idxCode.indexOf('reports.js') > -1);
/* v14.9 (US-383): گزارشات برای چهار نقش مدیران ارشد */
T('فقط مدیران ارشد', repCode.indexOf("['admin', 'chairman', 'ceo', 'commercial']") > -1);
T('گارد ورود برای سایر نقش‌ها', repCode.indexOf('فقط برای مدیران ارشد') > -1);
T('مخفی‌سازی دکمه (AC4)', repCode.indexOf('hideRepBtn') > -1);
T('بازه‌های زمانی چندگانه', repCode.indexOf('۷ روز اخیر') > -1 && repCode.indexOf('۹۰ روز اخیر') > -1);
T('شاخص‌های TO/CO/برنده/تامین‌کننده/لید/فاکتور/نامه', ['TO فنی', 'CO مالی', 'CO برنده', 'تامین‌کننده', 'لید', 'فاکتور', 'نامه', 'کل اقدامات'].every(function (x) { return repCode.indexOf(x) > -1; }));
T('رصد تحرکات (audit trail) با فیلتر', repCode.indexOf('ptf_crm_audit') > -1 && repCode.indexOf('repMod') > -1);
T('دکمه گزارشات در سایدبار', idxCode.indexOf("goPanel('rep'") > -1);
T('rep در دسته سیستم منو', /g-sys[^\]]*'rep'/.test(shellCode));

SECTION('رگرسیون: انجماد پرونده‌ها');
T('prjSetState با پرونده بدون timeline کرش نمی‌کند', prjCode.indexOf('p.timeline = p.timeline || []') > -1);
T('پوشه «اصل درخواست و ضمائم» اضافه شد', prjCode.indexOf('اصل درخواست و ضمائم') > -1);
T('مدارک سیستمی در پوشه با PDF سیستمی باز می‌شوند', prjCode.indexOf('sysOffer') > -1);
T('فاکتور خودکار به پوشه مالی پرونده می‌رود', rbacCode.indexOf('ثبت خودکار از ماژول فاکتورها') > -1);

DONE('TESTER-7 (Sprint70)');
process.exit(RESULTS.fail ? 1 : 0);
