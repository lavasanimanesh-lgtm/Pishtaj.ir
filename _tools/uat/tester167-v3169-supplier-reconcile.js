/* FIN-WF-012 — supplier opening/official reconciliation is read-only and visible */
'use strict';
require('./harness');
var fs=require('fs'),path=require('path');
var BASE=path.resolve(__dirname,'../../crm');
var sf=fs.readFileSync(path.join(BASE,'supplier-finance.js'),'utf8');
var idx=fs.readFileSync(path.join(BASE,'index.html'),'utf8');
var sw=fs.readFileSync(path.join(BASE,'sw.js'),'utf8');
SECTION('ساختار');
T('نسخه v31.6+', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=31.6;})());
T('reconcile فقط‌خواندنی و بدون migration', sf.indexOf('window.slReconcileOpen')>-1 && sf.indexOf('migration یا اصلاح خودکار انجام نمی‌شود')>-1 && sf.indexOf('هیچ مبلغی در این مسیر تغییر نمی‌کند')>-1);
T('فاکتور رسمی و خرید legacy لینک‌شده مقایسه می‌شوند', sf.indexOf('officialIrr')>-1 && sf.indexOf('linkedIrr')>-1 && sf.indexOf('legacyPayableCds')>-1);
T('افتتاحیه/adjustment در گزارش هست', sf.indexOf('openingIrr')>-1 && sf.indexOf("a.kind === 'opening'")>-1);
T('legacy بدون لینک جدا گزارش می‌شود', sf.indexOf('unlinkedIrr')>-1 && sf.indexOf('legacy بدون لینک')>-1);
T('مسیر UI تطبیق حفظ است', sf.indexOf('slReconBtn')>-1 && sf.indexOf('slReconcileOpen')>-1);
T('schema و setData در reconcile تغییر نمی‌کند', sf.substring(sf.indexOf('window.slReconcileOpen'), sf.indexOf('var _slOpenLedger265')).indexOf('setData(')===-1);
DONE('tester167-v3169-supplier-reconcile');
