/* tester18 — اسپرینت ۸۱: US-174 + US-175 — بازساخت فشرده */
require('./harness');
global.curSession = () => ({ user: 'admin', name: 'ادمین' });
loadFns('dedup.js', ['dedupNorm', 'dedupNormPhone', 'dedupPhones', 'dedupWho', 'dedupConflict',
  'dedupEntityConflicts', 'ptfCheckDup', 'dedupMsg', 'ptfDupBlock', 'dedupStamp',
  'ptfKnownInqList', 'ptfInqNoOptions', 'ptfInqNoValid']);
SECTION('US-174');
T('ی/ک عربی', dedupNorm('شركت پيشرو') === dedupNorm('شرکت پیشرو'));
T('ارقام فارسی', dedupNorm('۱۴۰۱۰۰۷۷۵۵۸') === '14010077558');
T('تلفن +98', dedupNormPhone('+989125551234') === '09125551234');
setData('ptf_crm_customers', [{ cd: 'CUST-1', co: 'پتروشیمی پارس', natId: '14005556667',
  coTels: [{ n: '021-88000000' }], people: [{ nm: 'رضایی', mobs: [{ n: '09121112233' }], tels: [] }],
  crAt: '1405/01/10 09:00', crBy: 'sales1' }]);
T('نام تکراری', ptfCheckDup('customer', { co: 'پتروشيمى پارس' }, null).length > 0);
T('شناسه ملی تکراری', ptfCheckDup('customer', { co: 'x', natId: '۱۴۰۰۵۵۵۶۶۶۷' }, null).length > 0);
T('موبایل رابط تکراری', ptfCheckDup('customer', { co: 'y', phones: [{ k: 'mob', n: '+98 912 111 2233' }] }, null).length > 0);
T('ویرایش خودش آزاد', ptfCheckDup('customer', { co: 'پتروشیمی پارس', natId: '14005556667' }, 'CUST-1').length === 0);
var msg = dedupMsg(ptfCheckDup('customer', { co: 'پتروشیمی پارس' }, null));
T('پیام: رکورد/تاریخ/کاربر', msg.indexOf('CUST-1') > -1 && msg.indexOf('1405/01/10') > -1 && msg.indexOf('sales1') > -1);
setData('ptf_crm_products', [{ cd: 'PTF-P-0001', nm: 'زانو ۹۰ درجه', en: 'Elbow 90 LR' }]);
T('کالا تکراری', ptfCheckDup('product', { nm: 'زانو 90 درجه' }, null).length > 0);
setData('ptf_crm_rfqs', [{ cd: 'RFQ-100', custCd: 'CUST-1', subj: 'لوله A106', inqNo: 'INQ-777' }]);
T('inqNo تکراری', ptfCheckDup('rfq', { inqNo: 'inq-777' }, null).length > 0);
SECTION('US-175');
T('v31.7.27: یک گزینه per درخواست — مقدار RFQ-100، شماره کارفرما در لیبل', ptfKnownInqList().some(o => o.v === 'RFQ-100' && o.lb.indexOf('INQ-777') > -1) && !ptfKnownInqList().some(o => o.v === 'INQ-777'));
T('شماره کارفرمای اسناد قدیمی همچنان معتبر (بدون rfq استاب تکراری)', ptfInqNoValid('INQ-777') === true);
T('ثبت‌نشده نامعتبر', ptfInqNoValid('INQ-999') === false);
T('سند قدیمی معتبر', ptfInqNoValid('OLD-55', 'OLD-55') === true);
SECTION('یکپارچگی');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var off = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
T('offerSave گارد US-175', off.indexOf('ptfInqNoValid') > -1);
T('گاردهای دیداپ', off.split('ptfDupBlock(').length >= 3);
var brd = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
T('saveRfq2: nR2Inq + دیداپ', brd.indexOf('nR2Inq') > -1 && brd.indexOf("ptfDupBlock('rfq'") > -1);
DONE('tester18-sprint81');
