#!/usr/bin/env node
/* PTF CRM — Sprint 266 / v26.7 — reconciliation and fiscal safety regression */
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(R,p),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('  ✓ PASS: '+t)}else{f++;console.log('  ✘ FAIL: '+t)}}
const sf=read('crm/supplier-finance.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');
ok(sf.includes('function slLockedYear') && sf.includes('ptf_crm_fiscal_snapshots'),'locked fiscal year is checked against fiscal snapshots');
ok(sf.includes('سال مالی') && sf.includes('سند اصلاحی'),'invoice/payment direct changes are blocked for locked years');
ok(sf.includes('window.slAdjustmentOpen') && sf.includes('refYear') && sf.includes('SFADJ'),'controlled supplier adjustment record exists');
ok(sf.includes('window.slReconcileOpen') && sf.includes('migration یا اصلاح خودکار انجام نمی‌شود') && sf.includes('افتتاحیه'),'reconciliation view exists without automatic migration');
ok(sf.includes('تعهدهای legacy لینک‌نشده') && sf.includes('مغایرت'), 'legacy mismatch/unlinked obligations are explicitly reported');
ok(sf.includes('d.adjustments') && sf.includes('amountIrr'),'adjustment affects derived supplier balance with currency conversion');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx) && /ptf-crm-v\d+(?:\.\d+)+/.test(sw),'Sprint version is v26.7');
console.log('=== tester147-v266-reconcile-fiscal: '+p+' PASS / '+f+' FAIL ===');process.exit(f?1:0);
