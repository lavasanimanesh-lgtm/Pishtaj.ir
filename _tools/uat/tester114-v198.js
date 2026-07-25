/* tester114 — v19.8 (اسپرینت ۱ از ۵ پیاپی: US-444 پاکسازی زنجیره‌های یتیم — ابلاغ کارفرما) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v19.8+', (function () { var m = idx.match(/var VER = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 19.8; })());
T('کش sw >= v19.8', (function () { var m = sw.match(/ptf-crm-v([0-9.]+)/); return m && parseFloat(m[1]) >= 19.8; })());

SECTION('US-444 — ساختار');
T('اسکنر یتیم‌ها ptfOrphanScan: purgeable/protected', br.indexOf('window.ptfOrphanScan') > -1 && br.indexOf('purgeable:') > -1 && br.indexOf('protectedChains:') > -1);
T('کلید یتیم = اشاره به درخواست ناموجود (هر دو شناسه rfq در rfqKeys)', br.indexOf('rfqKeys[r.cd] = 1; if (r.inqNo) rfqKeys[r.inqNo] = 1;') > -1);
T('استثنای مصوب: زنجیره با بایگانی مختومه محفوظ', br.indexOf('archived: !!archivedKeys[key]') > -1 && br.indexOf('محفوظ (بایگانی مختومه دارد') > -1);
T('پاکسازی ptfOrphanPurge: preview + ۷ خانواده + فاکتورهای پیشنهادهای یتیم', br.indexOf('window.ptfOrphanPreview') > -1 && ['ptf_crm_offers', 'ptf_crm_invoices', 'ptf_crm_rfqsmart', 'ptf_crm_buycmp', 'ptf_crm_payables', 'ptf_crm_deals', 'ptf_crm_inqitems'].every(function (k) { return br.split('window.ptfOrphanPurge')[1].split('window.ptfOrphanReview')[0].indexOf(k) > -1; }));
T('فقط ارشد (سد برنامه‌ای در هسته)', br.indexOf("if (typeof isSenior === 'function' && !isSenior()) return { ok: false, why: 'senior' };") > -1);
T('UI: دکمه 🧹 یتیم‌ها فقط ارشد + preview امن', br.indexOf('🧹 یتیم‌ها</button>') > -1 && br.indexOf('window.ptfOrphanReview') > -1 && br.indexOf('پیش‌نمایش تایید شد') > -1);
T('audit با فهرست کلیدها', br.indexOf('پاکسازی یتیم‌ها (US-444)') > -1);

SECTION('رفتاری');
global.window = global;
global.curRole = function () { return 'chairman'; };
global.SENIOR_ROLES = ['admin', 'chairman', 'ceo', 'commercial'];
global.isSenior = function () { return SENIOR_ROLES.indexOf(curRole()) > -1; };
global.audit = function (m, a) { global._aud = a; };
global.curSession = function () { return { user: 'chair', name: 'Chairman' }; };
global.faDateTime = function () { return '1405/04/20 10:00'; };
(function () {
  eval(br.match(/window\.ptfOrphanScan = function \(\) \{[\s\S]*?\n  \};/)[0]);
  eval(br.match(/function orphanFingerprint\(sc\) \{[\s\S]*?\n  \}/)[0]);
  eval(br.match(/window\.ptfOrphanPreview = function \(\) \{[\s\S]*?\n  \};/)[0]);
  eval(br.match(/window\.ptfOrphanPurge = function \(preview\) \{[\s\S]*?\n  \};/)[0]);
  /* داده: RFQ-1 زنده؛ INQ-GONE یتیم؛ INQ-ARC یتیم ولی بایگانی مختومه دارد */
  setData('ptf_crm_rfqs', [{ cd: 'RFQ-1', inqNo: 'INQ-1' }]);
  setData('ptf_crm_offers', [
    { no: 'CO-A', kind: 'CO', inqNo: 'INQ-1', st: 'sent' },       /* سالم */
    { no: 'CO-B', kind: 'CO', inqNo: 'INQ-GONE', st: 'won' },     /* یتیم */
    { no: 'CO-C', kind: 'CO', inqNo: 'INQ-ARC', st: 'won' }       /* یتیم محفوظ */
  ]);
  setData('ptf_crm_invoices', [{ cd: 'I1', offerNo: 'CO-B', amount: 100 }, { cd: 'I2', offerNo: 'CO-A', amount: 50 }]);
  setData('ptf_crm_rfqsmart', [{ no: 'RQ1', srcRfq: 'INQ-GONE' }, { no: 'RQ2', srcRfq: 'RFQ-1' }]);
  setData('ptf_crm_buycmp', [{ id: 'C1', inqNo: 'INQ-GONE' }]);
  setData('ptf_crm_payables', [{ cd: 'P1', inqNo: 'INQ-GONE' }, { cd: 'P2', inqNo: 'INQ-1' }]);
  setData('ptf_crm_deals', [{ cd: 'D1', inqNo: 'INQ-GONE', wonOffer: 'CO-B' }, { cd: 'D2', inqNo: 'INQ-ARC', wonOffer: 'CO-C' }]);
  setData('ptf_crm_inqitems', [{ inqNo: 'INQ-GONE', nm: 'x' }, { inqNo: 'INQ-1', nm: 'y' }]);
  setData('ptf_crm_projects', [{ no: 'ARC-9', inqNo: 'INQ-ARC', state: 'archived' }]);

  var sc = ptfOrphanScan();
  T('اسکن: ۱ زنجیره قابل پاکسازی + ۱ محفوظ', sc.purgeable.length === 1 && sc.purgeable[0].key === 'INQ-GONE' && sc.protectedChains.length === 1 && sc.protectedChains[0].key === 'INQ-ARC');
  T('زنجیره یتیم شامل پیشنهاد/فاکتور/استعلام/خرید/بستانکاری/پرونده/قلم', (function () { var c = sc.purgeable[0]; return c.offers === 1 && c.invoices === 1 && c.rfqsmart === 1 && c.buycmp === 1 && c.payables === 1 && c.deals === 1 && c.inqitems === 1; })());
  global.curRole = function () { return 'sales'; };
  T('غیرارشد → رد', ptfOrphanPurge().why === 'senior');
  global.curRole = function () { return 'chairman'; };
  var preview = ptfOrphanPreview();
  T('پیش‌نمایش fingerprint دارد', preview && preview.fingerprint && preview.scan && preview.scan.purgeable.length === 1);
  var res = ptfOrphanPurge(preview);
  T('پاکسازی امن: ۵ رکورد عملیاتی + ۲ سند مالی قرنطینه', res.ok && res.chains === 1 && res.purged === 5 && res.quarantined === 2);
  T('داده سالم دست‌نخورده و سند مالی یتیم حفظ شد', getData('ptf_crm_offers').length === 2 && getData('ptf_crm_invoices').length === 2 && getData('ptf_crm_invoices').some(function (x) { return x.cd === 'I1' && x.orphaned; }) && getData('ptf_crm_payables').length === 2);
  T('زنجیره محفوظ (بایگانی) پاک نشد', getData('ptf_crm_deals').some(function (d) { return d.inqNo === 'INQ-ARC'; }) && getData('ptf_crm_offers').some(function (o) { return o.no === 'CO-C'; }));
  T('اجرای مجدد: صفر یتیم قابل پاکسازی', ptfOrphanPurge(ptfOrphanPreview()).purged === 0);
  T('audit ثبت شد', String(global._aud).indexOf('US-444') > -1);
})();

SECTION('رگرسیون');
T('BUG-031 cascade پابرجا', br.indexOf('window.ptfRfqCascadeScan') > -1 && br.indexOf('window.ptfRfqCascadeDelete') > -1);
T('US-440ف۱ توالی پابرجا', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('window.sfShipSeqCheck') > -1);

DONE('tester114-v198');
