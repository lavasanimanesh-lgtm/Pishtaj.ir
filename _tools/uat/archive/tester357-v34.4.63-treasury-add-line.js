/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / گروه مالی)
   دلیل: «ردیف صورتحساب بانک» و دیالوگ آن با بازنویسی خزانهٔ نقدی (v34.4.83+)
   حذف شد؛ قرارداد حذف توسط tester377 (سبز) و خزانهٔ فعلی توسط tester379-384
   پاس می‌شود.
   ===================================================================== */
#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var t=read('crm/treasury.js');
var ver=JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 68)) fail('VERSION ' + ver.crm_version);
if(t.indexOf("title: 'ردیف صورتحساب بانک'")<0) fail('dialog');
if(t.indexOf('parseAmt(v.amt)')<0) fail('fa digits');
if(t.indexOf('ptfConfirmCloudSave')<0) fail('toast');
console.log('PASS tester357 treasury-add-line');
