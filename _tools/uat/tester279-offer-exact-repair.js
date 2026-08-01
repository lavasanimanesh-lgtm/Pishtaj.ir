/* tester279 — v33.3.2 exact-only offer repair */
require('./harness'); var fs=require('fs'),path=require('path'); var s=fs.readFileSync(path.resolve(__dirname,'../../crm/offers.js'),'utf8');
SECTION('Exact-only offer repair');
T('preview دقیق بدون sync خودکار وجود دارد', s.indexOf('function offExactDuplicatePreview')>-1 && s.indexOf('window.ptfOfferIntegrityPreview')>-1);
T('repair فقط duplicate JSON کاملاً برابر را حذف می‌کند', s.indexOf('sig = JSON.stringify(it || {})')>-1 && s.indexOf('duplicates.push')>-1);
T('repair قبل از اعمال confirmation دارد', s.indexOf("if (!confirm('⚠️ تعمیر پیشنهاد '")>-1);
T('repair audit و timestamp ثبت می‌کند', s.indexOf('target._integrityRepair')>-1 && s.indexOf("audit('پیشنهادها'")>-1);
DONE('tester279-offer-exact-repair');
