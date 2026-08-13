#!/usr/bin/env node
/* PTF CRM — Sprint 265 / v26.7 — supplier ledger/report export regression */
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(R,p),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('  ✓ PASS: '+t)}else{f++;console.log('  ✘ FAIL: '+t)}}
const sf=read('crm/supplier-finance.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');
ok(sf.includes('function slEventRows') && sf.includes('slLedgerTable'),'supplier events and running balance are derived');
ok(sf.includes('slFfrom') && sf.includes('slFto') && sf.includes('slFcur') && sf.includes('slFstatus') && sf.includes('slFref'),'ledger supports date/currency/status/reference filters');
ok(sf.includes('window.slLedgerCsv') && sf.includes('window.slLedgerPrint') && sf.includes('supplier-ledger-'),'CSV and print/PDF output actions exist');
ok(sf.includes('چک ثالث منتقل‌شده') && sf.includes('چک شرکت'),'ledger identifies linked cheque payment type');
ok(sf.includes('legacyOpen') && sf.includes('تعهد خرید legacy'),'ledger preserves legacy obligations in report');
ok(/window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx) && /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw),'Sprint version is v26.7');
console.log('=== tester146-v265-ledger-export: '+p+' PASS / '+f+' FAIL ===');process.exit(f?1:0);
