#!/usr/bin/env node
'use strict';
/* v34.7.10 — mobile تامین + حساب مشتری + false duplicate */
var fs=require('fs'),path=require('path'),vm=require('vm');var ROOT=path.resolve(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
var idx=read('crm/index.html'),rfqs=read('crm/rfqsmart.js'),cf=read('crm/customer-finance.js'),core=read('crm/sales-domain-v2.js'),api=read('api/sales-domain.php'),fiscal=read('crm/fiscal.js');
var p=0,f=0;function T(n,c,d){if(c){p++;console.log('PASS',n);}else{f++;console.error('FAIL',n,d||'');}}

T('toolbar تامین کلاس mobile-safe دارد',rfqs.indexOf('class="rfqs-list-toolbar"')>-1&&rfqs.indexOf('class="rfqs-list-actions"')>-1);
T('عملیات accordion/price/step/import تامین کلاس مستقل دارند',['rfqs-accordion-actions','rfqs-price-actions','rfqs-step-actions','rfqs-step-footer','rfqs-import-row'].every(function(x){return rfqs.indexOf(x)>-1;}));
T('CSS تامین همه containerها را داخل viewport نگه می‌دارد',idx.indexOf('MOBILE-SUPPLY-CUSTOMER')>-1&&idx.indexOf('#panels #rfqsWrap')>-1&&idx.indexOf('max-width:100%!important')>-1);
T('دکمه‌های تامین در موبایل تک‌ستونه و wrap هستند',/\.rfqs-list-actions \{[^}]*grid-template-columns:minmax\(0,1fr\)/.test(idx)&&idx.indexOf('white-space:normal!important')>-1&&idx.indexOf('overflow-wrap:anywhere!important')>-1);
T('جدول‌های تامین فقط داخل wrapper خود scroll افقی دارند',idx.indexOf('#panels #rfqsWrap [style*="overflow-x:auto"]')>-1&&idx.indexOf('-webkit-overflow-scrolling:touch')>-1);

T('دکمه‌های اصلی حساب مشتری همگی icon دارند',['🔎 اعمال فیلتر','🖨 PDF/چاپ','📥 CSV','💵 ثبت وصولی','✕ بستن'].every(function(x){return cf.indexOf(x)>-1;}));
T('ابطال وصولی و دریافت قطعی icon صریح دارند',cf.indexOf('⛔ ابطال</button>')>-1&&cf.indexOf('cfCaseReceiptVoid')>-1);
T('دریافت قطعی از داخل گردش قابل ابطال و برای admin قابل حذف است',cf.indexOf("ptfSalesDomainCommand('void_receipt'")>-1&&cf.indexOf("ptfAdminHardDelete('receipt'")>-1);
T('toolbar حساب مشتری در موبایل grid و بدون overflow است',idx.indexOf('#cfAccountDlg .cf-ledger-toolbar')>-1&&idx.indexOf('#cfAccountDlg .tb2')>-1);
T('حساب باز شامل مطالبه یا اعتبار است',cf.indexOf('function accountIsOpen')>-1&&cf.indexOf('Math.abs(+r.credit||0)')>-1);
T('بعد از sort نیز گروه حساب باز دوباره در بالا تثبیت می‌شود',cf.indexOf('rows = rows.filter(accountIsOpen).concat')>-1);

T('payment مهاجرت‌شده در paid و ledger هر دو یکسان حذف می‌شود',cf.indexOf('function isMigratedLegacyPayment')>-1&&cf.indexOf("p.status === 'void' || isMigratedLegacyPayment(p)")>-1);
T('ردیف canonical منبع وصولی مهاجرت را توضیح می‌دهد',cf.indexOf('دریافت قطعی پرونده (مهاجرت‌شده)')>-1&&cf.indexOf('برای جلوگیری از دوباره‌شماری نمایش داده نمی‌شود')>-1);
T('پنل تطبیق تعداد pairهای مهاجرت را شفاف می‌کند',cf.indexOf('cfMigratedReceiptPairs')>-1&&cf.indexOf('تطبیق مهاجرت وصولی')>-1);

T('client تطبیق پرونده را با root ID و fallback هویت تجاری امن انجام می‌دهد',core.indexOf('function caseBelongsToOffer')>-1&&core.indexOf('if(oid===root)return true')>-1&&core.indexOf("var pairs=[['inqNo','inqNo'],['buyerCd','buyerCd'],['currency','currency']]")>-1);
T('client تعارض inq/customer/currency را duplicate نمی‌داند',core.indexOf("var pairs=[['inqNo','inqNo'],['buyerCd','buyerCd'],['currency','currency']]")>-1);
T('server همان قرارداد identity-safe را دارد',api.indexOf('function sd_case_offer_linked')>-1&&api.indexOf("foreach(['inqNo','buyerCd','currency']")>-1&&api.indexOf('hash_equals($oid,$root)')>-1);
T('گزارش سال مالی نیز helper identity-safe دارد',fiscal.indexOf('function fiscalCaseMatchesOffer')>-1&&fiscal.indexOf('ptfCaseBelongsToOffer')>-1);

/* Runtime customer ledger: migrated legacy + canonical receipt = one credit only. */
(function(){var store={ptf_crm_customers:[{cd:'C1',co:'باز'},{cd:'C2',co:'بسته'}],ptf_crm_offers:[{no:'CO1',buyerCd:'C1'}],ptf_crm_invoices:[{cd:'I1',no:'I1',offerNo:'CO1',amount:100,allocatedBase:100,payments:[{cd:'LP1',amt:100,migratedToReceiptId:'R1',financialProjectionDisabled:true}]}],ptf_crm_deals:[{_id:'D1',cd:'D1',buyerCd:'C1',wonOffer:'CO1'}],ptf_crm_case_receipts:[{_id:'R1',cd:'R1',caseId:'D1',customerId:'C1',amountIRR:100,status:'posted',legacyPaymentRef:'LP1'}],ptf_crm_sales_returns:[]};var c={window:null,console:console,Math:Math,Date:Date,JSON:JSON,getData:function(k){return store[k]||[];},setData:function(k,v){store[k]=v;},localStorage:{getItem:function(){return null;},setItem:function(){}},document:{querySelectorAll:function(){return[];},getElementById:function(){return null;}},curRole:function(){return'admin';}};c.window=c;vm.createContext(c);vm.runInContext(cf,c);var rows=c.cfLedgerRows('C1',{}),credits=rows.filter(function(r){return r.credit>0;});T('رفتاری: وصولی مهاجرتی فقط یک credit در گردش دارد',credits.length===1&&credits[0].credit===100&&rows[rows.length-1].balance===0,JSON.stringify(rows));var accounts=c.cfAccountRows('');T('رفتاری: حساب دارای وضعیت مالی پیش از حساب بسته است',accounts[0].cd==='C1');})();

/* Runtime false duplicate: conflicting root/identity must not be reported. */
(function(){var store={ptf_crm_offers:[{_id:'O1',no:'CO-X',st:'won',inqNo:'RFQ-A',buyerCd:'C-A',currency:'IRR'}],ptf_crm_deals:[{_id:'D1',rootOfferId:'O1',wonOffer:'CO-X',inqNo:'RFQ-A',buyerCd:'C-A',currency:'IRR'},{_id:'D2',rootOfferId:'OTHER',wonOffer:'CO-X',inqNo:'RFQ-B',buyerCd:'C-B',currency:'IRR'}],ptf_crm_invoices:[],ptf_crm_case_receipts:[],ptf_crm_receipt_allocations:[]};var c={window:null,console:console,Math:Math,Date:Date,JSON:JSON,Promise:Promise,getData:function(k){return store[k]||[];},setData:function(){},localStorage:{getItem:function(){return null;},setItem:function(){}},curRole:function(){return'admin';},setInterval:function(){return 0;},clearInterval:function(){},fetch:function(){return Promise.reject(new Error('offline'));},document:{getElementById:function(){return null;},querySelectorAll:function(){return[];}}};c.window=c;vm.createContext(c);vm.runInContext(core,c);T('رفتاری: پرونده نامرتبط با شماره مشابه false duplicate نمی‌سازد',!c.ptfSalesIntegrityScan().some(function(x){return x.type==='duplicate_case';}));store.ptf_crm_deals.push({_id:'D3',rootOfferId:'O1',wonOffer:'CO-X',inqNo:'RFQ-A',buyerCd:'C-A',currency:'IRR'});T('رفتاری: duplicate واقعی با root یکسان همچنان کشف می‌شود',c.ptfSalesIntegrityScan().some(function(x){return x.type==='duplicate_case';}));})();

console.log('\n'+p+' PASS / '+f+' FAIL');process.exit(f?1:0);
