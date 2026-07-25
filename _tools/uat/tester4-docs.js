/* ============================================================
   دستیار تست ۴ — «اسناد و خروجی‌ها» (نگاه مدیر اسناد)
   TO/CO/PL/نامه/قرارداد/گزارش: ساختار HTML چاپ، فیلدها، دوزبانگی
   ============================================================ */
require('./harness');
console.log('📄 TESTER-4: اسناد PDF و خروجی‌ها');

var fs = require('fs');
var path = require('path');
var BASE_CRM = path.join(__dirname, '../../crm');
var offersCode = fs.readFileSync(path.join(BASE_CRM, 'offers.js'), 'utf-8');
var lettersCode = fs.readFileSync(path.join(BASE_CRM, 'letters.js'), 'utf-8');
var projectsCode = fs.readFileSync(path.join(BASE_CRM, 'projects.js'), 'utf-8');
var contractsCode = fs.readFileSync(path.join(BASE_CRM, 'contracts.js'), 'utf-8');

// mock window.open برای گرفتن HTML چاپ
var captured = '';
global.window.open = function () { return { document: { write: function (h) { captured += h; }, close: function () {} } }; };
global.location = { origin: 'https://pishtaj.ir' };

SECTION('۱. سند CO: ساختار و فیلدهای الزامی');
eval(offersCode.split('/* ---------- بازنویسی مودال‌ها')[0]);
setData('ptf_crm_offers', []);
var co = { no:'PTF-CO-1405-777', kind:'CO', rev:2, dateEn:'2026-07-03', buyerCo:'Test Buyer Co.', buyerContact:'Mr. Test', buyerTel:'+98 21', inqNo:'INQ-9', sellerContact:'Ms. Karimi',
  items:[{name:'Valve', desc:'Gate 6"', model:'V6', qty:3, unit:'NO', brand:'Neway', price:250000000}], terms:['Term one.','Term two.'], extraCols:['COO'] };
co.items[0].extra = { COO: 'Italy' };
captured = '';
offerPrintObj(co);
T('عنوان COMMERCIAL OFFER', captured.indexOf('Commercial Offer') > -1);
T('شماره با Rev دو رقمی', captured.indexOf('(Rev.02)') > -1);
T('Vendor: National ID', captured.indexOf('14010077558') > -1);
T('Client: Inquiry No', captured.indexOf('INQ-9') > -1);
T('ستون داینامیک COO در هدر و سلول', captured.indexOf('<th>COO</th>') > -1 && captured.indexOf('<td>Italy</td>') > -1);
T('Grand Total = 750,000,000', captured.indexOf('750,000,000') > -1);
T('مبلغ به حروف', captured.indexOf('Seven Hundred Fifty Million') > -1);
T('لنداسکیپ A4', captured.indexOf('A4 landscape') > -1);
T('فونت پلکانی (1 ستون اضافه → 9.5px)', captured.indexOf('font-size:9.5px') > -1);
T('فوتر آدرس شرکت', captured.indexOf('Tooba') > -1);

SECTION('۲. سند TO: ستون Description و بدون قیمت');
var to = { no:'PTF-TO-1405-333', kind:'TO', rev:0, dateEn:'2026-07-03', buyerCo:'B', items:[{name:'Pump', desc:'Spec A; Spec B', qty:1, unit:'NO', brand:'KSB', model:'M1', price:0}], terms:[], extraCols:[] };
captured = '';
offerPrintObj(to);
T('عنوان TECHNICAL OFFER', captured.indexOf('Technical Offer') > -1);
T('Description چندخطی (؛ → br)', captured.indexOf('Spec A<br>Spec B') > -1);
T('بدون ستون قیمت', captured.indexOf('Unit Price') === -1);

SECTION('۳. پکینگ لیست');
eval(projectsCode.match(/function plPrint[\s\S]*?\n\}/)[0].replace('function plPrint', 'global.plPrint = function'));
setData('ptf_crm_packinglists', [{ no:'PTF-PL-1405-005', offerNo:'PTF-CO-1405-777', buyerCo:'Test Buyer', buyerContact:'Mr. T', dateEn:'2026-07-03', by:'user1',
  lines:[{name:'Valve', model:'V6', brand:'Neway', qty:2, unit:'NO', pkg:'Wooden Case', pkgN:2, wt:'120'}], remarks:'Handle with care' }]);
captured = '';
plPrint('PTF-PL-1405-005');
T('عنوان Packing List', captured.indexOf('Packing List') > -1);
T('Shipper/Consignee', captured.indexOf('Shipper') > -1 && captured.indexOf('Consignee') > -1);
T('ستون Package و تعداد بسته', captured.indexOf('Wooden Case') > -1 && captured.indexOf('No. of Pkgs') > -1);
T('TOTAL PACKAGES = 2', captured.indexOf('TOTAL PACKAGES') > -1);
T('Remarks', captured.indexOf('Handle with care') > -1);
T('امضای دوطرفه', captured.indexOf('Prepared by') > -1 && captured.indexOf('Received by') > -1);

SECTION('۴. نامه صادره: تایپوگرافی مصوب');
global.sigProfiles = function(){ return { u1: { nm:'حامد لواسانی', role:'رئیس هیات مدیره', sig:'data:image/png;base64,SIG', stamp:'data:image/png;base64,STMP' } }; };
global.curSession = function(){ return { user:'u1', name:'حامد' }; };
eval(lettersCode.match(/var LETTER_FONT_FA[\s\S]*?;/)[0]);
eval(lettersCode.match(/var LETTER_FONT_EN[\s\S]*?;/)[0]);
eval(lettersCode.match(/function letAutoSize[\s\S]*?\n\}/)[0].replace('function letAutoSize','global.letAutoSize = function'));
eval(lettersCode.match(/function letFaDigits[\s\S]*?\n\}/)[0].replace('function letFaDigits','global.letFaDigits = function'));
eval(lettersCode.match(/function letRoleEn[\s\S]*?\n\}/)[0].replace('function letRoleEn','global.letRoleEn = function'));
eval(lettersCode.match(/function letSignerEn[\s\S]*?\n\}/)[0].replace('function letSignerEn','global.letSignerEn = function'));
eval(lettersCode.match(/function letPrintObj[\s\S]*?\n\}/)[0].replace('function letPrintObj','global.letPrintObj = function'));
var faLetter = { no:'PTF-OUT-1405-0009', kind:'OUT', lang:'fa', st:'signed', signer:'u1', signerNm:'حامد لواسانی', signerRole:'رئیس هیات مدیره',
  to:'مدیریت محترم', subject:'تست', body:'متن نامه.', att:'دارد', t:'1405/04/14', bsm:true, style:{} };
captured = '';
letPrintObj(faLetter, false);
T('فونت یاقوت', captured.indexOf('Yaghut') > -1);
T('متن 14pt (پیش‌فرض)', captured.indexOf('font-size:14pt') > -1);
T('موضوع بولد +۱ (15pt)', captured.indexOf('font-size:15pt') > -1);
T('بسمه تعالی', captured.indexOf('بسمه تعالی') > -1);
T('امضا + مهر درج شد', captured.indexOf('SIG') > -1 && captured.indexOf('STMP') > -1);
T('نوار گرادیان سربرگ', captured.indexOf('e87200') > -1);
T('تاریخ/شماره/پیوست', captured.indexOf('پیوست') > -1 && captured.indexOf('PTF-OUT-1405-0009') > -1);

SECTION('۵. نامه EN: چپ‌چین');
var enLetter = { no:'PTF-OUT-1405-0010', kind:'OUT', lang:'en', st:'signed', signer:'u1', to:'Dear Sir', subject:'Test', body:'Body text.', t:'1405/04/14', style:{} };
captured = '';
letPrintObj(enLetter, false);
T('dir=ltr', captured.indexOf('dir="ltr"') > -1);
T('text-align:left', captured.indexOf('text-align:left') > -1);
T('Subject: پیشوند EN', captured.indexOf('Subject: Test') > -1);
T('بدون بسمه تعالی در EN', captured.indexOf('بسمه تعالی') === -1);

SECTION('۶. پیش‌نمایش: واترمارک');
captured = '';
letPrintObj(faLetter, true);
T('واترمارک PREVIEW', captured.indexOf('PREVIEW') > -1);

SECTION('۷. قرارداد: سربرگ و امضا');
global.isSenior = function(){ return true; };
eval(contractsCode.match(/function ctSigBlock[\s\S]*?\n\}/)[0].replace('function ctSigBlock','global.ctSigBlock = function'));
eval(contractsCode.match(/function ctPrint[\s\S]*?\n\}/)[0].replace('function ctPrint','global.ctPrint = function'));
setData('ptf_crm_contracts', [{ no:'PTF-CNT-1405-001', kind:'sale', lang:'fa', body:'ماده ۱ ...', t:'1405/04/14', rev:2, buyerCo:'X' }]);
captured = '';
ctPrint('PTF-CNT-1405-001');
T('عنوان قرارداد فروش', captured.indexOf('قرارداد فروش') > -1);
T('نسخه (rev)', captured.indexOf('نسخه: 2') > -1);
T('سلب مسئولیت حقوقی', captured.indexOf('بازبینی حقوقی') > -1);
T('امضای طرفین', captured.indexOf('فروشنده') > -1 && captured.indexOf('خریدار') > -1);
DONE('TESTER-4 (Documents)');
