#!/usr/bin/env node
/* PTF CRM — Sprint 264 / v26.7 — company/third-party cheque supplier payment regression */
const fs=require('fs'),path=require('path');const ROOT=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');let pass=0,fail=0;function ok(v,t){if(v){pass++;console.log('  ✓ PASS: '+t)}else{fail++;console.log('  ✘ FAIL: '+t)}}
const sf=read('crm/supplier-finance.js'),ch=read('crm/cheques.js'),day=read('crm/myday.js'),idx=read('crm/index.html'),sw=read('crm/sw.js');
ok(sf.includes('company_cheque') && sf.includes('third_party_cheque'),'supplier payment supports own and third-party cheque methods');
ok(sf.includes('function slChequeCreate') && sf.includes("cd: genCode('CHQ')"),'payment creates a linked cheque record in central cheque key');
ok(sf.includes("ownership: method === 'company_cheque' ? 'company' : 'third_party'") && sf.includes("rec.st = 'transferred'"),'third-party cheque is explicitly marked transferred/out of company ownership');
ok(sf.includes('reminderDisabled = true') && sf.includes('sourceCustomerCd') && sf.includes('sourceInvoiceCd'),'third-party cheque stores no-reminder and customer-account references');
ok(sf.includes('چک منتقل‌شده خارج از ید شرکت است') && sf.includes('فاکتور انتخاب‌شده متعلق به مشتری انتخاب‌شده نیست'),'customer invoice allocation is explicit and validated');
ok(sf.includes('supplierPaymentCd') && sf.includes("x.supplierPaymentCd !== cd"),'payment reversal removes linked third-party customer receipt');
ok(ch.includes("rec.reminderDisabled || rec.ownership === 'third_party' || rec.st === 'transferred'"),'cheque reminder engine skips transferred third-party cheques');
/* v33.6.0 CHQ-PRINT (مصوب کارفرما): فیلتر «لیست فعال» متعلق به باکس چک پنل شخصی بود که حذف شد؛
   گارد انتقال/ثالث همچنان در موتور یادآور (پایین) و نقدینگی تامین‌کننده (پایین) زنده است. */
ok(ch.includes("rec.ownership === 'third_party' || rec.st === 'transferred'") && ch.indexOf('chBoxHtml') === -1,'transferred cheque excluded from reminders; active-list filter moved out with removed personal box');
ok(day.includes("c.ownership === 'third_party' || c.reminderDisabled || c.st === 'transferred'"),'daily dashboard excludes transferred cheque reminders');
ok(sf.includes("c.st === 'transferred' || c.ownership === 'third_party'"),'finance liquidity excludes third-party transferred cheques');
ok(/window\.VER = 'v\d+(?:\.\d+)+'; var VER = 'v\d+(?:\.\d+)+'/.test(idx) && /ptf-crm-v\d+(?:\.\d+)+/.test(sw),'Sprint version is aligned to v26.7');
console.log('=== tester145-v264-cheque-transfer: '+pass+' PASS / '+fail+' FAIL ===');process.exit(fail?1:0);
