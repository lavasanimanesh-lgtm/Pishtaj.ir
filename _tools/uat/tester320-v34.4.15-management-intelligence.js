/* tester320 — فاز ۱ تصمیم‌یار مدیریت: تحلیل قطعی مشتری/کالا/تامین */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mi = fs.readFileSync(path.join(BASE, 'management-intelligence.js'), 'utf8');
var an = fs.readFileSync(path.join(BASE, 'analyzer.js'), 'utf8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf8');

SECTION('ساختار و دسترسی');
T('موتور تحلیل مدیریت export شده', mi.indexOf('window.ptfManagementIntelligence = function') > -1);
T('پنجره گزارش و خروجی PDF وجود دارد', mi.indexOf('window.ptfManagementInsightsOpen') > -1 && mi.indexOf('window.ptfManagementInsightsPdf') > -1 && mi.indexOf('ptfPreviewPrintableDoc') > -1);
T('AI فقط snapshot کمینه دریافت می‌کند و خروجی قابل‌مشاهده تولید می‌شود', mi.indexOf('window.ptfManagementAiSnapshot') > -1 && mi.indexOf('management_insight') > -1 && mi.indexOf('window.ptfManagementAiInterpret') > -1);
T('endpoint AI فقط برای نقش‌های ارشد و با guard حجم snapshot فعال است', llm.indexOf("case 'management_insight':") > -1 && llm.indexOf("['admin','chairman','ceo','commercial']") > -1 && llm.indexOf('snapshot بیش از حد بزرگ است') > -1);
T('دکمه تصمیم‌یار در تحلیلگر قرار دارد', an.indexOf('ptfManagementInsightsOpen()') > -1);
T('ماژول در index و service worker لود می‌شود', idx.indexOf('management-intelligence.js?v=') > -1 && sw.indexOf("'./management-intelligence.js'") > -1);

SECTION('رفتاری: داده مشتری، کالا و تامین‌کننده');
global.window = global;
['list','n','offerTotal','keyOf','labelOf'].forEach(function (name) {
  var m = mi.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'));
  if (!m) throw new Error(name + ' not found');
  eval.call(global, m[0].replace('function ' + name, 'global.' + name + ' = function'));
});
eval(mi.match(/window\.ptfManagementIntelligence = function \(\) \{[\s\S]*?\n  \};/)[0]);
setData('ptf_crm_offers', [
 {kind:'CO',buyerCd:'C1',buyerCo:'مشتری راهبردی',st:'won',items:[{name:'Valve',qty:2,price:100}]},
 {kind:'CO',buyerCd:'C2',buyerCo:'مشتری نیازمند کنترل',st:'lost',items:[{name:'Gasket',qty:4,price:20}]},
 {kind:'CO',buyerCd:'C2',buyerCo:'مشتری نیازمند کنترل',st:'lost',items:[{name:'Gasket',qty:2,price:20}]}
]);
setData('ptf_crm_rfqs', [{custCd:'C2',co:'مشتری نیازمند کنترل'},{custCd:'C2',co:'مشتری نیازمند کنترل'},{custCd:'C2',co:'مشتری نیازمند کنترل'}]);
setData('ptf_crm_invoices', [{buyerCd:'C1',buyerCo:'مشتری راهبردی',amount:200,payments:[{amt:150}]}]);
setData('ptf_crm_buyquotes', [{sup:'تامین‌کننده الف',price:50,note:'خرید واقعی'},{sup:'تامین‌کننده الف',price:60,note:''}]);
setData('ptf_crm_deals', []);
var d = ptfManagementIntelligence();
var c1 = d.customers.filter(function(x){return x.key==='C1';})[0], c2 = d.customers.filter(function(x){return x.key==='C2';})[0];
T('مشتری راهبردی: برد، وصول و کارت سلامت صحیح محاسبه می‌شود', c1 && c1.won === 1 && c1.wonValue === 200 && c1.collectionRate === 75 && c1.healthScore >= 50);
T('مشتری پرتقاضا/بدون برد به عنوان نیازمند کنترل مشخص می‌شود', c2 && c2.rfqs === 3 && c2.won === 0 && c2.control === true && c2.healthLabel === 'نیازمند کنترل');
T('کالای برنده و تامین‌کننده فعال استخراج می‌شوند', d.products[0].name === 'Valve' && d.suppliers[0].name === 'تامین‌کننده الف' && d.suppliers[0].purchases === 1);
T('گزارش کیفیت داده شامل باخت بدون دلیل و RFQ بدون مسئول است', d.dataQuality && d.dataQuality.lostWithoutReason >= 0 && d.dataQuality.rfqWithoutOwner >= 0);
T('بینش اجرایی از داده‌ها ساخته می‌شود', d.insights.length > 0 && d.insights.some(function(i){return /کنترل هزینه فروش|ارزش ثبت/.test(i.title); }));

DONE('tester320-v34.4.15-management-intelligence');
