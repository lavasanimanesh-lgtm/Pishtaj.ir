/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / خزانه)
   دلیل: فازهای P5–P8 ورک‌فلو مالی (گارد «منبع چهارم»، ورود اکسل/CSV/PDF
   صورتحساب بانک، تطبیق یکتا، پیش‌نمایش commit) با بازنویسی «خزانهٔ نقدی»
   (v34.4.83+) عمداً بازنشسته شدند — قرارداد بازنشستگی توسط tester377
   (treasury-clean-cache — سبز) پاس می‌شود و خزانهٔ فعلی توسط tester379-384
   (سبز) پوشش دارد.
   ===================================================================== */
/* tester351 — v34.4.57 finance workflow P5 derived treasury */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var tr = read('crm/treasury.js');
  var hub = read('crm/financehub.js');
  var idx = read('crm/index.html');
  var sync = read('crm/sync.js');
  var api = read('api/crm.php');
  var ver = JSON.parse(read('VERSION.json'));
  ok(/^v34\.(?:4\.((5[7-9]|[6-9]\d))|[5-9]\.\d+|\d{2,}\.\d+\.\d+)/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = '") > -1, 'index release');
  ok(idx.indexOf('treasury.js') > -1, 'treasury script');
  ok(idx.indexOf('data-fin-hub-active="treasury"') > -1, 'hub css');
  ok(tr.indexOf('window.ptfTreasuryDerivedCash') > -1, 'derived cash');
  ok(tr.indexOf('ptf_crm_bank_recon') > -1, 'recon notes');
  ok(tr.indexOf('منبع چهارم') > -1 || tr.indexOf('منبع چهارم نیست') > -1 || tr.indexOf('موجودی بانک منبع چهارم نیست') > -1, 'no fourth ledger');
  ok(hub.indexOf("btn('treasury'") > -1, 'hub tab');
  ok(hub.indexOf('treasuryBox') > -1, 'hub box');
  ok(sync.indexOf("'ptf_crm_bank_recon'") > -1, 'sync key');
  ok(sync.indexOf("key === 'ptf_crm_bank_recon'") > -1, 'union recon');
  ok(api.indexOf('ptf_crm_bank_recon') > -1, 'api allowlist');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester351 finance-workflow-p5');
})();
