/* FIN-WF-015 — read-only financial data quality dashboard */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var dq=fs.readFileSync(path.join(BASE,'data-quality.js'),'utf8');
var fh=fs.readFileSync(path.join(BASE,'financehub.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var sw=fs.readFileSync(path.join(BASE,'sw.js'),'utf8');
SECTION('ساختار');
T('ماژول کیفیت داده load و pre-cache شده', idx.indexOf('data-quality.js?v=')>-1 && sw.indexOf('./data-quality.js')>-1);
T('داشبورد read-only است', (function () {
  /* دامنهٔ ادعا فقط خودِ ptfDataQualityData است — این فایل از v33.4.6 به بعد
     شامل گردش‌کار نوشتنی «هویت کاتالوگ» (صف بررسی/اتصال/ادغام) هم هست که
     عمداً می‌نویسد؛ این تست نباید کل فایل را read-only فرض کند. */
  var body = dq.split('window.ptfDataQualityData =')[1] || '';
  body = body.split('window.ptfDataQualityHtml =')[0] || '';
  return dq.indexOf('window.ptfDataQualityData') > -1 && dq.indexOf('هیچ رکوردی را اصلاح نمی‌کند') > -1 && body.indexOf('setData(') === -1;
})());
T('فاکتور بی‌تاریخ/بدون لینک', dq.indexOf('invoice-undated')>-1 && dq.indexOf('invoice-unlinked')>-1);
T('تعهد ارزی بدون نرخ و چک بی‌مالکیت', dq.indexOf('payable-fx-rate')>-1 && dq.indexOf('cheque-ownerless')>-1);
T('تطبیق خرید مبهم', dq.indexOf('procurement-ambiguous')>-1 && dq.indexOf('ptfProcurementLinkAuditAll')>-1);
T('تب کیفیت در هاب مالی', fh.indexOf("btn('quality', '🧪 کیفیت داده')")>-1 && fh.indexOf("show('qualityBox', t === 'quality')")>-1);
DONE('tester168-v3170-data-quality');
