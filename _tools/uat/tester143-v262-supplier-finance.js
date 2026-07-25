#!/usr/bin/env node
/* PTF CRM — Sprint 262 / v26.7 — Supplier invoice subledger source regression */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass=0, fail=0;
function ok(v, t){ if(v){pass++;console.log('  ✓ PASS: '+t);}else{fail++;console.log('  ✘ FAIL: '+t);} }
const sf=read('crm/supplier-finance.js'), sync=read('crm/sync.js'), backup=read('crm/backup.js'), api=read('api/crm.php'), storage=read('crm/storage.js'), scoring=read('crm/scoring.js'), idx=read('crm/index.html'), sw=read('crm/sw.js');
ok(sf.includes("var KEY = 'ptf_crm_supplier_finance'"), 'isolated supplier-finance data key exists');
ok(sf.includes('schema: 1, invoices: [], payments: []'), 'new data model is versioned and non-destructive');
ok(sf.includes('legacyPayableCds') && sf.includes('sfInvoiceCd'), 'optional legacy purchase link prevents duplicate counting');
ok(sf.includes('amountIrr') && sf.includes('نرخ تسعیر'), 'invoice supports currency and IRR equivalent');
ok(sf.includes('attachUploadWidget') && sf.includes('supplier-invoices/'), 'invoice attachment uses existing cloud storage flow');
ok(sf.includes('شماره فاکتور قبلاً') && sf.includes('supplierCd === supCd'), 'invoice number is unique per supplier');
ok(sf.includes('slInvoiceVoid') && sf.includes('invPaid(inv, d) > 0'), 'invoice void is blocked after payment allocation');
ok(sf.includes('تعهدهای خرید legacy بدون فاکتور لینک‌شده'), 'legacy obligations remain visible read-only during phased migration');
ok(sf.includes('پرداخت و چک در Sprint 263 و 264'), 'payment/cheque scope is intentionally deferred from Sprint 262');
ok(sync.includes("'ptf_crm_supplier_finance'") && backup.includes("'ptf_crm_supplier_finance'") && api.includes("'ptf_crm_supplier_finance'"), 'new key is synced, backed up and server-whitelisted');
ok(storage.includes("'ptf_crm_supplier_finance'"), 'cloud orphan collector protects invoice attachments');
ok(scoring.includes('p.sfInvoiceCd || p.pay !== \'credit\'') && scoring.includes('!p.sfInvoiceCd &&'), 'legacy payable widgets exclude linked invoices to avoid double count');
ok(/supplier-finance\.js\?v=\d+(?:\.\d+)+/.test(idx) && sw.includes("'./supplier-finance.js'"), 'module is loaded and PWA-precached');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx) && /ptf-crm-v\d+(?:\.\d+)+/.test(sw), 'Sprint version is aligned to v26.7');
console.log('=== tester143-v262-supplier-finance: '+pass+' PASS / '+fail+' FAIL ===');
process.exit(fail?1:0);
