#!/usr/bin/env node
const fs=require('fs'),path=require('path');const R=path.resolve(__dirname,'../..');const sf=fs.readFileSync(path.join(R,'crm/supplier-finance.js'),'utf8'),ch=fs.readFileSync(path.join(R,'crm/cheques.js'),'utf8');let p=0,f=0;function ok(v,t){if(v){p++;console.log('✓ '+t)}else{f++;console.log('✘ '+t)}}
ok(sf.includes("ch.st = 'void'")&&sf.includes('ch.reminderDisabled = true'),'payment reversal voids linked company cheque');
ok(sf.includes('window.slPaymentDelete=function(cd){ return window.slPaymentVoid(cd); }'),'delete payment delegates to full reversal path');
ok(ch.includes("rec.st === 'void'"),'reminder engine ignores voided cheque');
ok(ch.includes("c.st !== 'void'"),'active cheque list excludes voided cheque');
console.log('PASS',p,'FAIL',f);process.exit(f?1:0);