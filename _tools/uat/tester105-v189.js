/* tester105 — v18.9 (BUG-028/029 + US-431 فاز۱: پرونده فروش Source of Truth) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var rb = fs.readFileSync(path.join(BASE, 'rbac.js'), 'utf-8');
var bc = fs.readFileSync(path.join(BASE, 'buycompare.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('نسخه و ثبت');
T('نسخه v18.9+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.9;})());
T('کش sw v18.9+', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=18.9;})());
T('cache-bust offers/rbac/buycompare >= 18.9', ['offers.js','rbac.js','buycompare.js'].every(function(f){var m=idx.match(new RegExp(f.replace('.','\\.')+'\\?v=([0-9.]+)'));return m&&parseFloat(m[1])>=18.9;}));

SECTION('BUG-028 ارز');
T('فهرست پیشنهادها fallback ارزآگاه دارد (ارزی با کد ارز نه ت)', of.indexOf("o.currency && o.currency !== 'IRR' ? total.toLocaleString('en-US') + ' ' + o.currency")>-1);
T('ptfMoney همچنان مسیر اصلی نمایش مبلغ پیشنهاد است', of.indexOf("typeof ptfMoney === 'function' ? ptfMoney(total, o.currency)")>-1);

SECTION('BUG-029 وضعیت خرید واقعی');
T('تابع robust برای گذار به st8 وجود دارد', bc.indexOf('window.ptfRealBuyEnsureStatus')>-1 && bc.indexOf("ptfRfqSetStatus(r.cd, 'st8'")>-1);
T('پس از هر خرید واقعی موفق فراخوانی می‌شود', bc.indexOf('ptfRealBuyEnsureStatus(c2.inqNo)')>-1);
T('عقب‌گرد از وضعیت‌های جلوتر ندارد', bc.indexOf("['st8','st9','st6','st7','stInv','stPay','stX']")>-1);

SECTION('US-431 فاز۱ read-only پس از برد');
T('helper offerPostAwardLocked در سطح top-level تعریف شده', of.indexOf('function offerPostAwardLocked(o)')>-1 && of.indexOf('window.ptfOfferPostAwardLocked')>-1 && of.indexOf('function offerPostAwardLocked(o)') < of.indexOf('function renderOffers()'));
T('رندر پیشنهاد برنده read-only و پرونده فروش نشان می‌دهد', of.indexOf('🔒 read-only')>-1 && of.indexOf('📁 پرونده فروش')>-1);
T('نگارش جدید برای پیشنهاد برنده مخفی/مسدود است', of.indexOf('if (offerPostAwardLocked(o))')>-1 && of.indexOf('نگارش/اصلاح بعدی باید از داخل پرونده فروش')>-1);
T('ویرایش و حذف پیشنهاد برنده guard دارند', of.indexOf('قابل ویرایش نیست')>-1 && of.indexOf('قابل حذف از ماژول پیشنهادها نیست')>-1);
T('تغییر وضعیت مستقیم از پیشنهاد برنده block می‌شود', of.indexOf('وضعیت پیشنهاد برنده قفل است')>-1);
T('ذخیره فرم قدیمی روی پیشنهاد برنده block می‌شود', of.indexOf('قابل ذخیره/ویرایش نیست')>-1);
T('ارجاع فاکتور از ماژول پیشنهادها پس از برد block می‌شود', rb.indexOf('ارجاع فاکتور رسمی باید فقط از داخل پرونده فروش')>-1 && rb.indexOf("if (o.st === 'won')")>-1);
T('دکمه فاکتور در پیشنهاد برنده به پرونده هدایت می‌شود نه refToInvoice', of.indexOf('🧾 فاکتور از پرونده 🔒')>-1 && of.indexOf("else if (isWon) invBtn = ' <button")===-1);

SECTION('رفتاری: ptfRealBuyEnsureStatus');
global.window = global;
global.curSession=function(){return {name:'م'};};
global.audit=function(){};
var m = bc.match(/window\.ptfRealBuyEnsureStatus = function[\s\S]*?\n  \};/);
T('تابع ptfRealBuyEnsureStatus استخراج شد', !!m);
if (m) eval(m[0]);
setData('ptf_crm_rfqs', [{cd:'RFQ-1',st:'stCO'},{cd:'RFQ-2',st:'st9'}]);
global._set=[];
global.ptfRfqSetStatus=function(cd,st,txt){global._set.push({cd:cd,st:st,txt:txt}); var a=getData('ptf_crm_rfqs'); a.forEach(function(r){if(r.cd===cd){r.st=st;r.stxt=txt;}}); setData('ptf_crm_rfqs',a);};
ptfRealBuyEnsureStatus('RFQ-1');
T('RFQ قبل از st8 با خرید واقعی به st8 می‌رود', getData('ptf_crm_rfqs')[0].st==='st8' && global._set[0].st==='st8');
ptfRealBuyEnsureStatus('RFQ-2');
T('RFQ جلوتر از st8 عقب‌گرد نمی‌کند', getData('ptf_crm_rfqs')[1].st==='st9' && global._set.length===1);

DONE('tester105-v189');
