/* tester346 — opex month is a dropdown */
(function () {
  var fs = require('fs');
  var path = require('path');
  var src = fs.readFileSync(path.resolve(__dirname, '../../crm/opex.js'), 'utf8');
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  ok(src.indexOf('function opexMonthOptions') > -1, 'helper');
  ok(src.indexOf("type: 'select', optionsHtml: opexMonthOptions(pre.month") > -1, 'add dialog');
  ok(src.indexOf("type: 'select', optionsHtml: opexMonthOptions(rec.month") > -1, 'edit dialog');
  ok(src.indexOf('<select class="opex-month"') > -1, 'filter select');
  ok(src.indexOf('<input class="opex-month" type="text"') < 0, 'no text filter');
  ok(src.indexOf('همه ماه‌ها') > -1, 'all-months option');
  if (fail.length) { console.log('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PASS tester346 opex-month-select');
})();
