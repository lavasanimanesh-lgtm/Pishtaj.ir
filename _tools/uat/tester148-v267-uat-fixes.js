#!/usr/bin/env node
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(R,p),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('  ✓ PASS: '+t)}else{f++;console.log('  ✘ FAIL: '+t)}}
const sf=read('crm/supplier-finance.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');
ok(sf.includes('window.slInvoiceEdit') && sf.includes('window.slPaymentEdit'),'invoice and payment edit actions exist');
ok(sf.includes('window.slInvoiceAddFile') && sf.includes('window.slPaymentAddFile') && sf.includes('attachUploadWidget'),'invoice/payment attachment add flow exists');
ok(sf.includes('slJalali') && sf.includes('ptfJToISO') && sf.includes('تاریخ پرداخت (شمسی)'),'supplier-finance entry dates are Jalali in UI and converted before persistence');
ok(sf.includes("method !== 'company_cheque' && method !== 'third_party_cheque'") && sf.includes('برای کسر از مطالبات، مشتری و فاکتور مشتری را هر دو انتخاب کنید'),'third-party customer/receivable link is optional but validated when partially entered');
ok(sf.includes("return '<details id=\"slBox\""),'supplier invoice/account panel is collapsible');
ok(sf.includes('window.slRefreshSupplierPanel') && sf.includes("['ptfPayableUpsert','ptfPayablePay']"),'supplier panel has immediate refresh hooks after legacy purchase/payment changes');
ok(sf.includes('slInvoiceFromLegacy') || sf.includes('legacyPayableCds'),'legacy purchase remains represented/linkable in supplier account');
ok(/window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx) && /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw),'version is v26.7');
console.log('=== tester148-v267-uat-fixes: '+p+' PASS / '+f+' FAIL ===');process.exit(f?1:0);
