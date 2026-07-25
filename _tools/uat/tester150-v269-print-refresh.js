#!/usr/bin/env node
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const sf=fs.readFileSync(path.join(R,'crm/supplier-finance.js'),'utf8'),sc=fs.readFileSync(path.join(R,'crm/scoring.js'),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('✓ '+t)}else{f++;console.log('✘ '+t)}}
ok(sf.includes('function slPrintRows')&&sf.includes('slCurFa')&&sf.includes('slFaDigits'),'print has standalone localized renderer');
ok(!sf.includes("<tbody>'+slLedgerTable(rows)+'</tbody></table>');"),'print no longer uses interactive action renderer');
ok(sf.includes('گردش حساب تأمین‌کننده')&&sf.includes('ریال'),'print title and currency labels localized');
ok(sc.includes("if (typeof window.slRefreshSupplierPanel === 'function') window.slRefreshSupplierPanel();"),'legacy payable refresh runs after actual payment save');
console.log('PASS',p,'FAIL',f);process.exit(f?1:0);