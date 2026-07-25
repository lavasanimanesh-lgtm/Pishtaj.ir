/* tester118 — v20.2 (اسپرینت ۵ از ۵: US-443 اسناد قالب شرکت — PL/نوت بازرسی/اینباند/MOM) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var dx = fs.readFileSync(path.join(BASE, 'docsx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v20.2+', (function () { var m = idx.match(/var VER = 'v([0-9.]+)'/); return m && parseFloat(m[1]) >= 20.2; })());
T('کش sw >= v20.2', (function () { var m = sw.match(/ptf-crm-v([0-9.]+)/); return m && parseFloat(m[1]) >= 20.2; })());
T('docsx.js در index (بعد از salesfiles — hook کشو) + sw', idx.indexOf('docsx.js?v=') > idx.indexOf('salesfiles.js?v=') && sw.indexOf("'./docsx.js'") > -1);

SECTION('US-443 — ساختار: موتور واحد اسناد رسمی');
T('۴ نوع سند مصوب: PL/IN/IB/MOM با عنوان EN', ['PACKING LIST', 'INSPECTION NOTICE', 'INBOUND RECEIPT', 'MINUTES OF MEETING'].every(function (t) { return dx.indexOf(t) > -1; }));
T('schema-driven: افزودن نوع جدید = فقط یک آیتم PTF_DOCX_TYPES', dx.indexOf('window.PTF_DOCX_TYPES = [') > -1 && dx.indexOf('fields:') > -1 && dx.indexOf('items:') > -1);
T('بدون کلید داده جدید: ذخیره روی r.docsx در ptf_crm_deals', dx.indexOf("d.docsx = d.docsx || []; d.docsx.unshift(rec);") > -1 && dx.indexOf('ptf_crm_docsx') === -1);
T('هسته قابل تست ptfDocxCommit + اعتبارسنجی فیلد الزامی', dx.indexOf('window.ptfDocxCommit') > -1 && dx.indexOf("return { ok: false, why: 'req', field: f.lb };") > -1);
T('شماره‌گذاری رسمی PTF-XX-سال-###', dx.indexOf("'PTF-' + tp.serial + '-' + y + '-'") > -1);
T('توالی رویدادها: PL رسمی → sfShipCommit packing (US-433/440)', dx.indexOf("typeId === 'PL' && typeof sfShipCommit === 'function'") > -1);
T('پیش‌بارگذاری اقلام از CO برنده (عطف به رویداد ملاک — US-440)', dx.indexOf('اقلام CO برنده پیش‌بارگذاری شد') > -1 && dx.indexOf('d.wonOffer') > -1);
T('چاپ با سربرگ رسمی (نوار گرادیان + خطوط مورب هم‌خانواده letters)', dx.indexOf('linear-gradient(90deg,#e87200') > -1 && dx.indexOf('skewX(-35deg)') > -1 && dx.indexOf('window.ptfDocxPrint') > -1);
T('بلوک امضا سه‌گانه + راهنمای چاپ PDF', dx.indexOf('Prepared by') > -1 && dx.indexOf('Stamp & Signature') > -1 && dx.indexOf('Save as PDF') > -1);
T('hook کشوی پرونده: باکس اسناد رسمی + دکمه‌های صدور ۴گانه', dx.indexOf('📄 اسناد رسمی قالب شرکت (US-443)') > -1 && dx.indexOf('_dxDealsHooked') > -1);
T('timeline + audit صدور', dx.indexOf('صادر شد (US-443)') > -1 && dx.indexOf("audit('پرونده‌های فروش', 'صدور '") > -1);

SECTION('رفتاری — ptfDocxCommit');
global.window = global;
global.curSession = function () { return { user: 'karimi', name: 'شیوا کریمی' }; };
global.faYear = function () { return '1405'; };
global.faDateTime = function () { return '1405/04/22 10:00'; };
global.audit = function (m, a) { global._aud = a; };
global._ship = null;
global.sfShipCommit = function (cd, t, v) { global._ship = { cd: cd, t: t, no: v.no }; return { cd: 'SHP-X' }; };
(function () {
  eval(dx.match(/window\.PTF_DOCX_TYPES = \[[\s\S]*?\n  \];/)[0]);
  /* توابع تک‌خطی با regex غیرحریص می‌شکنند — از regex تا انتهای خط استفاده می‌کنیم */
  eval(dx.match(/function typeOf\(t\) \{[^\n]+\}/)[0]);
  eval(dx.match(/function dealsAll\(\) \{[^\n]+\}/)[0]);
  eval(dx.match(/function serialFor\(tp\) \{[\s\S]*?\n  \}/)[0]);
  eval(dx.match(/window\.ptfDocxCommit = function \(dealCd, typeId, vals, items\) \{[\s\S]*?\n  \};/)[0]);

  setData('ptf_crm_deals', [{ cd: 'D1', inqNo: 'INQ-5', wonOffer: 'CO-5', docs: [] }]);
  setData('ptf_crm_offers', [{ no: 'CO-5', kind: 'CO', items: [{ name: 'Valve', qty: 3, unit: 'NO' }] }]);

  T('فیلد الزامی خالی → رد req', (function () { var r = ptfDocxCommit('D1', 'PL', { consignee: '' }, []); return r && r.ok === false && r.why === 'req'; })());
  var rec = ptfDocxCommit('D1', 'PL', { consignee: 'فولاد مبارکه', dateISO: '2026-07-10', packCount: '3' }, [['Valve', '3', 'NO', '120', '135', '80x60x40'], ['', '', '', '', '', '']]);
  T('صدور PL: شماره PTF-PL-1405-001', rec && rec.no === 'PTF-PL-1405-001');
  T('ردیف خالی جدول حذف شد', rec.items.length === 1);
  var d = getData('ptf_crm_deals')[0];
  T('در پرونده نشست + timeline', d.docsx.length === 1 && d.timeline.length >= 1 && d.timeline.some(function (x) { return x.tx.indexOf('PTF-PL-1405-001') > -1; }));
  T('PL → رویداد packing با همان شماره (توالی US-433)', global._ship && global._ship.t === 'packing' && global._ship.no === 'PTF-PL-1405-001' && global._ship.cd === 'D1');
  var rec2 = ptfDocxCommit('D1', 'MOM', { subject: 'جلسه کیک‌آف', attendees: 'لاوسانی، کریمی', note: 'مصوبات...' }, [['ارسال پیش‌نویس قرارداد', 'کریمی', '2026-07-15']]);
  T('MOM: شماره مستقل PTF-MOM-1405-001 و بدون رویداد ارسال', rec2 && rec2.no === 'PTF-MOM-1405-001' && global._ship.t === 'packing');
  var rec3 = ptfDocxCommit('D1', 'PL', { consignee: 'ذوب آهن' }, []);
  T('سریال افزایشی: PL دوم = 002', rec3 && rec3.no === 'PTF-PL-1405-002');
  T('پرونده ناموجود → null', ptfDocxCommit('NOPE', 'PL', { consignee: 'x' }, []) === null);
  T('audit ثبت شد', String(global._aud).indexOf('US-443') > -1 || String(global._aud).indexOf('صدور') > -1);
})();

SECTION('رگرسیون');
T('US-442 (v20.1) پابرجا', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf('id="ofPrintAs"') > -1);
T('BUG-033 (v20.0) پابرجا', fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8').indexOf('.mx-dot.a{background:#8b5cf6') > -1);
T('US-441 (v19.9) پابرجا', fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8').indexOf('window.cmpBulkBuyCommit') > -1);
T('US-444 (v19.8) پابرجا', fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8').indexOf('window.ptfOrphanScan') > -1);
T('sfShipSeqCheck (v19.7) پابرجا', fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8').indexOf('window.sfShipSeqCheck') > -1);

DONE('tester118-v202');
