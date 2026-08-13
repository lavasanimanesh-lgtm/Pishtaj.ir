#!/usr/bin/env node
/* PTF CRM — Sprint 263 / v26.7 — supplier payment allocation + liquidity source regression */
const fs=require('fs'),path=require('path'); const ROOT=path.resolve(__dirname,'../..'); const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'); let pass=0,fail=0;
function ok(v,t){if(v){pass++;console.log('  ✓ PASS: '+t)}else{fail++;console.log('  ✘ FAIL: '+t)}}
const sf=read('crm/supplier-finance.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');
ok(sf.includes('window.slPaymentStart') && sf.includes('window.slPaymentSave') && sf.includes('window.slPaymentVoid'),'payment create and controlled reversal functions exist');
ok(sf.includes('تخصیص دستی به فاکتورها') && sf.includes('class="slAlloc"'),'manual allocation inputs are present');
ok(sf.includes('total > amount') && sf.includes('a > rem'),'allocation cannot exceed payment or invoice remainder');
ok(sf.includes('unallocated: amount - total') && sf.includes('supplierCredit'),'unallocated payment becomes supplier credit');
ok(sf.includes('cur !== \'IRR\' && rate <= 0') && sf.includes('amountIrr'),'foreign-currency payment requires FX rate and stores IRR equivalent');
ok(sf.includes('status: \'posted\'') && sf.includes('p.status = \'void\''),'payment lifecycle is posted/void rather than destructive delete');
ok(sf.includes('function liquidityHtml') && sf.includes('چک‌های شرکت در راه') && sf.includes('چک سررسید ۷ روز آینده') && sf.includes('چک ثالث منتقل‌شده در این شاخص وارد نمی‌شود'),'finance-hub liquidity metrics include supplier debt and company cheque exposure only');
ok(sf.includes('window.buildPetty = function () { return liquidityHtml() + oldPetty(); }'),'liquidity card is hooked into Finance Hub');
ok(/window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx) && /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw),'Sprint version is aligned to v26.7');
console.log('=== tester144-v263-supplier-payments: '+pass+' PASS / '+fail+' FAIL ==='); process.exit(fail?1:0);
