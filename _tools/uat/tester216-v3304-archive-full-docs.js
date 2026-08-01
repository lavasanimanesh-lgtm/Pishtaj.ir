/* BUG-ARCHIVE — بایگانی پرونده باید «تمام اسناد» (پیشنهاد اصلی+متمم+فاکتورها+نامه‌ها) را شامل شود */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var prj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');

global.curSession = function () { return { user: 'u1', name: 'علی رضایی' }; };
global.faDateTime = function () { return '1405/05/10 12:00'; };
global.faDate = function () { return '1405/05/10'; };
global.genCode = function (p) { return p + '-X'; };
global.audit = function () {}; global.notify = function () {};
global._archived = null;
global.sfArchive = function (r, kind, full) { global._archived = { cd: r.cd, kind: kind, rec: null }; };
global.sfAll = function () { return getData('ptf_crm_deals'); };
global.sfSave = function (l) { setData('ptf_crm_deals', l); };
global.sfFindArchivedProject = function () { return null; };
global.sfMarkLostRelated = function () {};
global.renderDeals = function () {};
global.ptfToast = function () {};

/* داده: پرونده با پیشنهاد اصلی (TO+CO) + پیشنهاد مالی متمم + فاکتور */
setData('ptf_crm_deals', [{ cd: 'D1', inqNo: 'INQ-1', wonOffer: 'CO-M', buyerCo: 'مشتری الف', shipEvents: [], qcEvents: [], costEvents: [], docs: [{ name: 'متفرقه1', key: 'k1' }], awardDocs: [{ kind: 'CO', no: 'CO-M' }] }]);
setData('ptf_crm_offers', [
  { no: 'TO-1', kind: 'TO', inqNo: 'INQ-1', st: 'sent' },
  { no: 'CO-1', kind: 'CO', inqNo: 'INQ-1', st: 'accepted', srcToNo: 'TO-1' },
  { no: 'CO-M', kind: 'CO', inqNo: 'INQ-1', st: 'won', altOf: 'CO-1' } /* متمم */
]);
setData('ptf_crm_invoices', [{ cd: 'INV-1', no: 'INV-100', offerNo: 'CO-1', amount: 500000 }]);
setData('ptf_crm_letters', [{ no: 'L-1', prjNo: 'SF:INQ-1', subject: 'نامه ابلاغ' }]);
setData('ptf_crm_rfqsmart', []);
setData('ptf_crm_rfqs', []);

/* استخراج ptfSalesFileOffers و sfDocsOf */
eval.call(global, sf.match(/window\.ptfSalesFileOffers = function \(r\) \{[\s\S]*?\n  \};/)[0].replace('window.ptfSalesFileOffers', 'window.ptfSalesFileOffers'));
eval.call(global, sf.match(/function sfDocsOf\(r\) \{[\s\S]*?\n  \}/)[0]);

SECTION('ریشه: ptfSalesFileOffers همهٔ اسناد پرونده را برمی‌گرداند');
var offerList = ptfSalesFileOffers({ inqNo: 'INQ-1', wonOffer: 'CO-M' });
T('همهٔ ۳ پیشنهاد (TO اصلی + CO اصلی + متمم) برگشت', offerList.length === 3 && offerList.some(function (o) { return o.no === 'TO-1'; }) && offerList.some(function (o) { return o.no === 'CO-1'; }) && offerList.some(function (o) { return o.no === 'CO-M'; }));

SECTION('sfDocsOf — فاکتور و نامه هم شامل می‌شوند');
var d = sfDocsOf({ inqNo: 'INQ-1', wonOffer: 'CO-M', docs: [{ name: 'x', key: 'k' }] });
T('فاکتور CO-1 در اسناد پرونده است', d.invoices.some(function (i) { return i.no === 'INV-100'; }));
T('نامهٔ ابلاغ در اسناد پرونده است', d.letters.some(function (l) { return l.no === 'L-1'; }));
T('متمم در offers هست', d.offers.some(function (o) { return o.no === 'CO-M'; }));

SECTION('بایگانی — docSnap همهٔ اسناد را ذخیره می‌کند');
var mA = sf.match(/function sfArchive\(r, closeKind, keepDocs, why, reasonId\) \{[\s\S]*?\n  \}/);
eval.call(global, mA[0]);
var prjs = [];
setData('ptf_crm_projects', prjs);
global.sfSave = function (l) { setData('ptf_crm_deals', l); };
global.sfFindArchivedProject = function () { return null; };
sfArchive({ cd: 'D1', inqNo: 'INQ-1', wonOffer: 'CO-M', docs: [{ name: 'متفرقه1', key: 'k1' }], shipEvents: [], qcEvents: [], costEvents: [], awardDocs: [] }, 'settled', true);
var arc = getData('ptf_crm_projects')[0];
T('رکورد بایگانی docSnap دارد', !!arc && !!arc.docSnap);
T('docSnap شامل هر ۳ پیشنهاد است', arc.docSnap.offers.length === 3);
T('docSnap شامل فاکتور است', arc.docSnap.invoices.some(function (i) { return i.no === 'INV-100'; }));
T('docSnap شامل نامه و متفرقه است', arc.docSnap.letters.some(function (l) { return l.no === 'L-1'; }) && arc.docSnap.misc.some(function (m) { return m.name === 'متفرقه1'; }));
T('offerNos هر ۳ را دارد', (arc.offerNos || []).length === 3);

SECTION('نمایش بایگانی — prjArchivedDocsHtml همهٔ اسناد را نشان می‌دهد');
T('projects.js تابع نمایش اسناد کامل بایگانی دارد', prj.indexOf('prjArchivedDocsHtml') > -1 && prj.indexOf("p.origin === 'salesfile' && p.docSnap") > -1 && prj.indexOf('اسناد کامل پرونده (بایگانی)') > -1);

DONE('tester216-v3304-archive-full-docs');
