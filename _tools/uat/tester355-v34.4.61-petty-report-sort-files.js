/* tester355 — v34.4.62 petty period sort + combined attachments */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  var petty = read('crm/petty.js');
  var idx = read('crm/index.html');
  var ver = JSON.parse(read('VERSION.json'));
  ok(ver.crm_version === 'v34.4.62', 'VERSION ' + ver.crm_version);
  ok(idx.indexOf("PTF_CRM_RELEASE = 'v34.4.62'") > -1, 'index release');
  ok(petty.indexOf('recSortStamp') > -1, 'time-aware sort');
  ok(petty.indexOf('فروردین|اردیبهشت') > -1, 'named jalali months');
  ok(petty.indexOf('window.ptfPettyFindPeriodRec') > -1, 'find period rec');
  ok(petty.indexOf('seen[k]') > -1, 'dedupe files');
  ok(petty.indexOf('(pr.pettyIds || []).forEach(addId)') > -1, 'union saved ids');
  ok(petty.indexOf('ptfPettyPeriodCombinedPdf:') > -1, 'combined catch');
  ok(petty.indexOf('recDateCmp(d0, beforeDate)') > -1, 'balance cmp numeric');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester355 petty-report-sort-files');
})();
