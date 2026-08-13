/* tester113 — v19.7 (اسپرینت ۱ از R14: BUG-031 حذف آبشاری درخواست + US-440ف۱ توالی رویدادها) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.7+', (function () { var m = idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.7; })());
T('کش sw >= v19.7', (function () { var m = sw.match(/var RELEASE = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.7; })());
T('cache-bust bridge/salesfiles >= 19.7', (function () { var a = idx.match(/bridge\.js\?v=([0-9.]+)/), b = idx.match(/salesfiles\.js\?v=([0-9.]+)/); return a && b && parseFloat(a[1]) >= 19.7 && parseFloat(b[1]) >= 19.7; })());

SECTION('BUG-031 — ساختار: حذف آبشاری');
T('اسکنر وابسته‌ها ptfRfqCascadeScan با دو شناسه (US-386)', br.indexOf('window.ptfRfqCascadeScan') > -1 && br.indexOf('rfq.inqNo && als.indexOf(rfq.inqNo) < 0') > -1);
T('پوشش ۸ خانواده داده: پیشنهاد/فاکتور/استعلام/خرید/بستانکاری/پرونده/اقلام/بایگانی', ['ptf_crm_offers', 'ptf_crm_invoices', 'ptf_crm_rfqsmart', 'ptf_crm_buycmp', 'ptf_crm_payables', 'ptf_crm_deals', 'ptf_crm_inqitems', 'ptf_crm_projects'].every(function (k) { return br.split('window.ptfRfqCascadeScan')[1].split('window.ptfRfqCascadeDelete')[0].indexOf(k) > -1; }));
T('هسته حذف قابل تست ptfRfqCascadeDelete با {ok,why}', br.indexOf('window.ptfRfqCascadeDelete') > -1 && br.indexOf("why: 'archived'") > -1 && br.indexOf("why: 'senior'") > -1);
T('سد برنامه‌ای نه فقط UI (درس US-371): commit خودش سدها را چک می‌کند', br.split('window.ptfRfqCascadeDelete')[1].indexOf('sc.archived.length') > -1);
T('بایگانی مختومه = حذف مسدود برای همه (سند نهایی)', br.indexOf('سند نهایی شرکت است و حذف آن نقض توالی رویدادهاست') > -1);
T('برنده/فاکتوردار = فقط ارشد + تایید دوم', br.indexOf('حذف فقط توسط مدیران ارشد ممکن است') > -1 && br.indexOf('تایید دوم مدیر ارشد') > -1);
T('مودال شفاف: فهرست دقیق وابسته‌ها قبل از تایید', br.indexOf('همه موارد وابسته زیر هم برای همیشه پاک می‌شوند') > -1);
T('audit ریز با شمارش همه خانواده‌ها', br.indexOf('حذف آبشاری درخواست') > -1 && br.indexOf('بستانکاری،') > -1);
T('پیام قدیمی «حذف آزادانه» حذف شد', br.indexOf('حذف آزادانه') === -1 && br.indexOf('قفل حذف برداشته شده') === -1);

SECTION('US-440ف۱ — ساختار: توالی رویدادها');
T('چک توالی زمانی sfShipSeqCheck: تحویل >= بارنامه، بارنامه >= پکینگ', sf.indexOf('window.sfShipSeqCheck') > -1 && sf.indexOf('نمی‌تواند قبل از تاریخ ارسال/بارنامه') > -1 && sf.indexOf('نمی‌تواند قبل از تاریخ پکینگ لیست') > -1);
T('سد برنامه‌ای در commit (نه فقط UI)', sf.indexOf('var seq = sfShipSeqCheck(r, typeId') > -1 && sf.indexOf('if (seq && !seq.ok) return seq;') > -1);
T('UI پیام نقض توالی', sf.indexOf('نقض توالی رویدادها (US-440)') > -1);
T('پکینگ فیلد تاریخ گرفت (مبنای چک)', sf.indexOf("id: 'dateISO', label: 'تاریخ پکینگ (میلادی)'") > -1);
T('عطف به ماسبق ممنوع: خرید واقعی از اقلام CO برنده (اولویت) نه درخواست', bc.indexOf("o.st === 'won'; })[0]") > -1 && bc.indexOf('نبود → اقلام درخواست') > -1);

SECTION('رفتاری — BUG-031: cascade و سدها');
global.window = global;
global.curSession = function () { return { user: 'lavasani', name: 'حامد لاوسانی' }; };
global.curRole = function () { return 'chairman'; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.isSenior = function () { return SENIOR_ROLES.indexOf(curRole()) > -1; };
global.audit = function (m, a, r) { global._aud = a; };
(function () {
  var mS = br.match(/window\.ptfRfqCascadeScan = function \(cd\) \{[\s\S]*?\n  \};/);
  var mD = br.match(/window\.ptfRfqCascadeDelete = function \(cd\) \{[\s\S]*?\n  \};/);
  T('استخراج scan/delete', !!mS && !!mD);
  if (!mS || !mD) return;
  eval(mS[0]); eval(mD[0]);

  function seed() {
    setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', inqNo: 'INQ-777', co: 'فولاد' }, { cd: 'RFQ-2', co: 'دیگری' }]);
    setData('ptf_crm_offers', [
      { no: 'TO-1', kind: 'TO', inqNo: 'RFQ-1' },
      { no: 'CO-1', kind: 'CO', inqNo: 'INQ-777', st: 'sent' }, /* با شناسه دوم — US-386 */
      { no: 'CO-9', kind: 'CO', inqNo: 'OTHER', st: 'won' }
    ]);
    setData('ptf_crm_invoices', []);
    setData('ptf_crm_rfqsmart', [{ no: 'RQS-1', srcRfq: 'RFQ-1' }, { no: 'RQS-2', srcRfq: 'ELSE' }]);
    setData('ptf_crm_buycmp', [{ id: 'CMP-1', inqNo: 'RFQ-1' }]);
    setData('ptf_crm_payables', [{ cd: 'P-1', inqNo: 'RFQ-1', sup: 'WIKA' }]);
    setData('ptf_crm_deals', [{ cd: 'D-1', inqNo: 'INQ-777' }]);
    setData('ptf_crm_inqitems', [{ inqNo: 'RFQ-1', nm: 'Valve' }, { inqNo: 'INQ-777', nm: 'Gauge' }, { inqNo: 'ELSE', nm: 'x' }]);
    setData('ptf_crm_projects', []);
  }
  seed();
  var sc = ptfRfqCascadeScan('RFQ-1');
  T('اسکن دو-شناسه‌ای: ۲ پیشنهاد + ۱ استعلام + ۱ خرید + ۱ بستانکاری + ۱ پرونده + ۲ قلم', sc.offers.length === 2 && sc.rfqsmart.length === 1 && sc.buycmp.length === 1 && sc.payables.length === 1 && sc.deals.length === 1 && sc.inqitems === 2 && !sc.hasWon);
  var res = ptfRfqCascadeDelete('RFQ-1');
  T('حذف آبشاری موفق — هیچ یتیمی نماند', res.ok &&
    getData('ptf_crm_rfqs').length === 1 &&
    getData('ptf_crm_offers').length === 1 && getData('ptf_crm_offers')[0].no === 'CO-9' &&
    getData('ptf_crm_rfqsmart').length === 1 && getData('ptf_crm_buycmp').length === 0 &&
    getData('ptf_crm_payables').length === 0 && getData('ptf_crm_deals').length === 0 &&
    getData('ptf_crm_inqitems').length === 1);
  T('audit ریز ثبت شد', String(global._aud).indexOf('حذف آبشاری') > -1);

  /* سد ۱: برنده/فاکتوردار + نقش غیرارشد */
  seed();
  var offs = getData('ptf_crm_offers'); offs[1].st = 'won'; setData('ptf_crm_offers', offs);
  global.curRole = function () { return 'sales'; };
  T('غیرارشد + برنده → رد senior', ptfRfqCascadeDelete('RFQ-1').why === 'senior' && getData('ptf_crm_deals').length === 1);
  global.curRole = function () { return 'chairman'; };
  T('ارشد + برنده → مجاز (تایید دوم در UI)', ptfRfqCascadeDelete('RFQ-1').ok === true);

  /* سد ۲: بایگانی مختومه — مسدود مطلق */
  seed();
  setData('ptf_crm_projects', [{ no: 'ARC-1', inqNo: 'INQ-777', state: 'archived' }]);
  T('بایگانی مختومه → مسدود حتی برای chairman', ptfRfqCascadeDelete('RFQ-1').why === 'archived' && getData('ptf_crm_rfqs').length === 2);
})();

SECTION('رفتاری — US-440ف۱: توالی زمانی ارسال/تحویل');
(function () {
  eval(sf.match(/window\.sfShipSeqCheck = function \(r, typeId, dateISO\) \{[\s\S]*?\n  \};/)[0]);
  var r = { shipEvents: [
    { type: 'packing', dateISO: '2026-07-01' },
    { type: 'shipdoc', dateISO: '2026-07-05' }
  ] };
  T('تحویل قبل از ارسال → رد', (function () { var x = sfShipSeqCheck(r, 'delivered', '2026-07-03'); return x && x.ok === false && x.why === 'seq'; })());
  T('تحویل بعد از ارسال → مجاز', sfShipSeqCheck(r, 'delivered', '2026-07-06') === null);
  T('تحویل همان روز ارسال → مجاز', sfShipSeqCheck(r, 'delivered', '2026-07-05') === null);
  T('بارنامه قبل از پکینگ → رد', (function () { var x = sfShipSeqCheck(r, 'shipdoc', '2026-06-28'); return x && x.ok === false; })());
  T('بدون تاریخ صریح → چک زمانی ندارد (توالی مرحله‌ای پابرجا)', sfShipSeqCheck(r, 'delivered', '') === null);
  T('پرونده بدون سابقه ارسال → تحویل آزاد (ثبت مستقیم مجاز)', sfShipSeqCheck({ shipEvents: [] }, 'delivered', '2026-07-01') === null);
})();

SECTION('رگرسیون');
T('گاردهای عمومی حذف (guards.js) پابرجا', fs.readFileSync(path.join(BASE, 'guards.js'), 'utf-8').indexOf('از این TO ساخته شده') > -1);
T('sfShipCommit: گذار st6/st7 از مسیر واحد پابرجا (v19.2)', sf.indexOf('sfRfqAlign(r.inqNo, tp.rfq, tp.rfqTxt)') > -1);
T('sfCloseAudit (US-437) پابرجا', sf.indexOf('window.sfCloseAudit') > -1);
T('ارجاع فاکتور قفل‌دار (US-435) پابرجا', sf.indexOf('window.sfInvoiceRefCommit') > -1);
T('moneyx (v19.6) پابرجا', fs.existsSync(path.join(BASE, 'moneyx.js')) && idx.indexOf('moneyx.js?v=') > -1);
T('ptfRfqSetStatus منبع واحد پابرجا', br.indexOf('window.ptfRfqSetStatus = function (cd, stVal, stText)') > -1);

DONE('tester113-v197');
