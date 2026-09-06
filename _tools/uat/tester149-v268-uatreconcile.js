#!/usr/bin/env node
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const s=fs.readFileSync(path.join(R,'crm/supplier-finance.js'),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('✓ '+t)}else{f++;console.log('✘ '+t)}}
ok(s.includes('data-legacy')&&s.includes('legacyCd: legacyCd'),'payment allocation supports legacy purchase obligations');
ok(s.includes('supplierPaymentCd:payCd')&&s.includes('x.supplierPaymentCd!==cd'),'legacy payment settlement/reversal is linked');
/* v34.37.7: پنل پیش‌فرض بسته شد (تصمیم کارفرما) — همان details/summary، بدون open */
ok(s.includes('<details id="slBox"')&&!s.includes('<details id="slBox" open')&&s.includes('<summary style='),'valid collapsible supplier panel uses direct summary (closed by default)');
ok(s.includes('window.slInvoiceEdit')&&s.includes('window.slPaymentEdit')&&s.includes('window.slInvoiceAddFile')&&s.includes('window.slPaymentAddFile'),'final ledger exposes edit and attachment actions');
ok(s.includes('برای کسر از مطالبات، مشتری و فاکتور مشتری را هر دو انتخاب کنید'),'third party receivable link is optional');
console.log('PASS',p,'FAIL',f);process.exit(f?1:0);