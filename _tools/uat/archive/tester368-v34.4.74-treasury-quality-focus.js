/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / گروه مالی)
   دلیل: ptfTreasuryOpenFromQuality با بازنویسی خزانهٔ نقدی (v34.4.83+)
   حذف شد؛ کیفیت دادهٔ خزانهٔ فعلی توسط tester377/379-384 پاس می‌شود.
   ===================================================================== */
#!/usr/bin/env node
var fs=require('fs');var path=require('path');
var root=path.join(__dirname,'../..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function fail(m){console.log('FAIL '+m);process.exit(1);}
var ver=JSON.parse(read('VERSION.json'));
var vm4 = String(ver.crm_version).match(/^v(\d+)\.(\d+)\.(\d+)$/);
if (!vm4 || +vm4[1] < 34 || (+vm4[1] === 34 && +vm4[2] < 4) || (+vm4[1] === 34 && +vm4[2] === 4 && +vm4[3] < 74)) fail('VERSION ' + ver.crm_version);
var tr=read('crm/treasury.js');
var dq=read('crm/data-quality.js');
if(tr.indexOf('ptfTreasuryOpenFromQuality')<0) fail('open from quality');
if(tr.indexOf('ptfTreasuryMatchMove')<0) fail('match move');
if(tr.indexOf('ptfTreasuryLink')<0) fail('link');
if(tr.indexOf('treasuryFocus')<0) fail('focus box');
if(tr.indexOf('trMove-')<0) fail('move row id');
if(dq.indexOf('ptfTreasuryOpenFromQuality')<0) fail('quality button');
if(dq.indexOf("kind: 'crm'")<0) fail('crm kind');
if(dq.indexOf("kind: 'bank'")<0) fail('bank kind');
console.log('PASS tester368 treasury-quality-focus');
