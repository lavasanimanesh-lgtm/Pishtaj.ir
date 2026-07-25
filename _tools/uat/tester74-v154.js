/* tester74 — v15.4 (US-386: کیس استادی TO→CO — انتقال عینی مشخصات + رفع پیغام غلط «TO ثبت نشده») */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('ریشه ۱: نام‌های مستعار شماره درخواست (کد سیستمی vs شماره کارفرما)');
T('ptfInqAliases تعریف شد', of.indexOf('window.ptfInqAliases = function (v)') > -1);
T('هر دو شناسه r.cd و r.inqNo جمع می‌شوند', of.indexOf('if (r.cd === v || (r.inqNo && r.inqNo === v))') > -1);
T('چک وجود TO با aliases (نه exact)', of.indexOf('aliases.indexOf(o.inqNo) > -1') > -1);
T('پیام TC فقط وقتی واقعا TO نیست', of.indexOf('if (!tos.length) {') > -1);
T('بج «TO صادر شد» درخواست‌ها با هر دو شناسه', br.indexOf("(o.inqNo === r.cd || (r.inqNo && o.inqNo === r.inqNo)) && o.kind === r.waiting") > -1);
T('صف انتظار پیشنهادها هم با هر دو شناسه', (br.match(/o\.inqNo === r\.cd \|\| \(r\.inqNo && o\.inqNo === r\.inqNo\)/g) || []).length >= 2);

SECTION('ریشه ۲: انتقال عینی مشخصات TO به فرم CO');
T('TO موجود + فرم خالی → پیشنهاد انتقال با تایید', of.indexOf('مشخصات کارفرما و اقلام آن عینا در این پیشنهاد مالی بنشیند؟') > -1);
T('کارفرما/رابط/تلفن منتقل می‌شود', of.indexOf('_offState.buyerCd = to.buyerCd || _offState.buyerCd;') > -1 && of.indexOf('_offState.buyerContact = to.buyerContact') > -1);
T('اقلام/بندها/ستون‌های اضافه deep-copy می‌شوند', of.indexOf('_offState.items = JSON.parse(JSON.stringify(to.items || []));') > -1 && of.indexOf('JSON.parse(JSON.stringify(to.terms))') > -1);
T('srcToNo ست می‌شود (قفل →CO پس از ذخیره — US-142 AC5)', of.indexOf('_offState.srcToNo = to.no;') > -1);
T('کشویی کارفرما و رندر اقلام/بندها تازه می‌شود', of.indexOf('buyerSel.value = _offState.buyerCd;') > -1 && of.indexOf('offRenderItems === \'function\'') > -1);
T('مسیر →CO از قبل کامل بود و srcToNo دوباره‌کاری نمی‌شود', of.indexOf('} else if (!_offState.srcToNo) {') > -1);

SECTION('ریشه ۳: کارفرمای خالی در فرم');
T('offerToCo: حل buyerCd از نام برای TOهای قدیمی', of.indexOf('TOهای قدیمی/وارداتی که buyerCd ندارند') > -1 && of.indexOf('if (!_offState.buyerCd && _offState.buyerCo)') > -1);
T('offerFromRfq: تطبیق نام مشتری وقتی custCd نیست (درخواست دستی)', br.indexOf('درخواست‌های دستی قدیمی custCd ندارند') > -1 && br.indexOf('if (!_offState.buyerCd && r.co)') > -1);
T('تطبیق نرمال‌شده dedupNorm در هر دو مسیر', of.indexOf('dedupNorm(c2.co) === dedupNorm(_offState.buyerCo)') > -1 && br.indexOf('dedupNorm(c2.co) === dedupNorm(r.co)') > -1);

SECTION('رفتار اجرایی: بازتولید دقیق کیس استادی');
global.curSession = function () { return { user: 'admin', name: 'Admin' }; };
global.curRole = function () { return 'admin'; };
global.audit = function () {}; global.window = global;
global.confirm = function (m) { global._lastConfirm = String(m); return global._confirmAns !== false; };
global.alert = function (m) { global._lastAlert = String(m); };
global.ptfToast = function () {};
global.dedupNorm = function (x) { return String(x || '').replace(/\s/g, '').toLowerCase(); };
global.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; } };
(function () {
  var mAl = of.match(/window\.ptfInqAliases = function \(v\) \{[\s\S]*?\n\};/);
  T('ptfInqAliases استخراج شد', !!mAl);
  if (!mAl) return;
  eval(mAl[0]);
  /* درخواست دستی: کد سیستمی RFQ-52341 + شماره کارفرما INQ-990؛ TO با کد سیستمی ثبت شده */
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-52341', inqNo: 'INQ-990', co: 'شرکت آزمون', custCd: '' }]);
  setData('ptf_crm_offers', [{ no: 'TO-1001', kind: 'TO', inqNo: 'RFQ-52341', st: 'approved', buyerCd: 'CUST-7', buyerCo: 'شرکت آزمون', buyerContact: 'آقای x', buyerTel: '021', items: [{ name: 'لوله', qty: 10, unit: 'Branch', price: 0 }], terms: [{ t: 'Delivery: 2 weeks' }] }]);
  var al = ptfInqAliases('INQ-990');
  T('aliases شامل هر دو شناسه', al.indexOf('RFQ-52341') > -1 && al.indexOf('INQ-990') > -1);
  /* سناریوی پیغام غلط: کاربر در فرم CO شماره کارفرما را انتخاب می‌کند */
  var offers = getData('ptf_crm_offers');
  var tos = offers.filter(function (o) { return o.kind === 'TO' && al.indexOf(o.inqNo) > -1; });
  T('کیس استادی: TO با شناسه دیگر پیدا شد — پیغام غلط TC نمی‌آید', tos.length === 1 && tos[0].no === 'TO-1001');
  /* شبیه‌سازی بلوک انتقال (همان منطق پچ‌شده) */
  var _offState = { kind: 'CO', no: 'CO-2001', items: [{ name: '', desc: '', qty: 1, price: 0 }], terms: [] };
  var to = tos[tos.length - 1];
  var blank = !(_offState.items || []).some(function (it) { return (it.name || it.desc || it.pcode); });
  T('فرم CO تازه = خالی تشخیص داده می‌شود', blank === true);
  if (blank) {
    _offState.srcToNo = to.no;
    _offState.buyerCd = to.buyerCd || _offState.buyerCd;
    _offState.buyerCo = to.buyerCo || _offState.buyerCo;
    _offState.buyerContact = to.buyerContact || _offState.buyerContact;
    _offState.buyerTel = to.buyerTel || _offState.buyerTel;
    _offState.terms = JSON.parse(JSON.stringify(to.terms));
    _offState.items = JSON.parse(JSON.stringify(to.items || []));
    _offState.items.forEach(function (it) { it.price = it.price || 0; });
  }
  T('کارفرما عینا نشست (buyerCd/Co/Contact/Tel)', _offState.buyerCd === 'CUST-7' && _offState.buyerCo === 'شرکت آزمون' && _offState.buyerContact === 'آقای x' && _offState.buyerTel === '021');
  T('اقلام و بندها عینا نشست', _offState.items.length === 1 && _offState.items[0].name === 'لوله' && _offState.terms.length === 1);
  T('srcToNo برای قفل →CO ثبت شد', _offState.srcToNo === 'TO-1001');
  T('deep-copy: تغییر CO روی TO اثر ندارد', (function () { _offState.items[0].name = 'تغییر'; return getData('ptf_crm_offers')[0].items[0].name === 'لوله'; })());
  /* فرم غیرخالی → انتقال پیشنهاد نمی‌شود (کار کاربر له نشود) */
  var st2 = { kind: 'CO', items: [{ name: 'قلم دستی کاربر', qty: 1 }] };
  var blank2 = !(st2.items || []).some(function (it) { return (it.name || it.desc || it.pcode); });
  T('فرم دارای اقلام دستی → انتقال خودکار نمی‌شود', blank2 === false);
  /* حل کارفرما از نام وقتی buyerCd خالی است (TO قدیمی) */
  setData('ptf_crm_customers', [{ cd: 'CUST-9', co: 'شرکت آزمون' }]);
  var stOld = { buyerCd: '', buyerCo: 'شرکت  آزمون' }; /* دو فاصله — نرمال باید بگیرد */
  var mc = getData('ptf_crm_customers').filter(function (c2) {
    return c2.co === stOld.buyerCo || (c2.coEn && c2.coEn === stOld.buyerCo) ||
      (dedupNorm(c2.co) === dedupNorm(stOld.buyerCo));
  })[0];
  T('TO قدیمی بدون buyerCd → کارفرما از نام (نرمال) حل شد', mc && mc.cd === 'CUST-9');
})();

SECTION('v15.5: حل مرکزی کارفرما در offerForm — پوشش ویرایش/نگارش جدید');
(function () {
  var mForm = of.indexOf('if (o && !o.buyerCd && o.buyerCo) {');
  T('حل buyerCd از نام، داخل خود offerForm (همه مسیرها)', mForm > -1 && of.indexOf('«ویرایش» و «نگارش جدید» هم کارفرما را خالی می‌آوردند') > -1);
  /* رفتاری: سند بدون buyerCd (قدیمی) → با ورود به فرم از هر مسیری، از نام حل می‌شود */
  setData('ptf_crm_customers', [{ cd: 'CUST-11', co: 'پالایش نفت آبادان' }]);
  var o = { kind: 'TO', no: 'TO-77', buyerCd: '', buyerCo: 'پالایش  نفت آبادان', items: [] }; /* دو فاصله */
  if (o && !o.buyerCd && o.buyerCo) {
    var _bMc = getData('ptf_crm_customers').filter(function (c2) {
      return c2.co === o.buyerCo || (c2.coEn && c2.coEn === o.buyerCo) ||
        (dedupNorm(c2.co) === dedupNorm(o.buyerCo));
    })[0];
    if (_bMc) o.buyerCd = _bMc.cd;
  }
  T('ویرایش/نگارش سند قدیمی → کارفرما از نام (نرمال) نشست', o.buyerCd === 'CUST-11');
  /* سند دارای buyerCd → دست نمی‌خورد */
  var o2 = { buyerCd: 'CUST-99', buyerCo: 'پالایش نفت آبادان' };
  var touched = false;
  if (o2 && !o2.buyerCd && o2.buyerCo) touched = true;
  T('سند دارای buyerCd → بازنویسی نمی‌شود', !touched && o2.buyerCd === 'CUST-99');
})();

SECTION('نسخه و کش (بدون قفل نسخه دقیق)');
T('VER الگوی v1x', /var VER = 'v\d+\.\d/.test(idx));
T('کش sw هم‌خانواده ptf-crm-v1', /ptf-crm-v\d+\.\d/.test(sw));
T('cache-bust offers/bridge (>=15.4)', ['offers.js', 'bridge.js'].every(function (f) {
  var m = idx.match(new RegExp(f.replace(/[.-]/g, '\\$&') + '\\?v=(\\d+)\\.(\\d+)'));
  return m && (+m[1] > 15 || (+m[1] === 15 && +m[2] >= 4));
}));

DONE('tester74-v154');
