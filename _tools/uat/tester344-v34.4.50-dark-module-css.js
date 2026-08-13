/* tester344 — v34.4.50 dark-mode module CSS */
(function () {
  var fs = require('fs');
  var path = require('path');
  var root = path.resolve(__dirname, '../..');
  var css = fs.readFileSync(path.join(root, 'crm/theme-contrast.js'), 'utf8');
  var idx = fs.readFileSync(path.join(root, 'crm/index.html'), 'utf8');
  var ver = JSON.parse(fs.readFileSync(path.join(root, 'VERSION.json'), 'utf8'));
  var fail = [];
  function ok(c, m) { if (!c) fail.push(m); }
  ok(/^v34\.(?:4\.(?:50|[6-9]\d|\d{3,})|[5-9]\.\d+|\d{2,}\.\d+\.\d+)$/.test(ver.crm_version), 'VERSION ' + ver.crm_version);
  ok(/theme-contrast\.js\?v=\d+\.\d+\.\d+/.test(idx), 'index pin'); /* 2026-08-13: پین لفظی → الگوی نسخه‌ای جاری */
  [
    'body.ptf-dark .aiwb-hero',
    'body.ptf-dark .shareholder-box',
    'body.ptf-dark .sf-tabs',
    'body.ptf-dark .lead-board-column',
    'body.ptf-dark .offer-form-modal .offer-signature-card',
    'body.ptf-dark .sf-post-award-shell',
    'body.ptf-dark #panels .aiwb-triple-pipeline>label'
  ].forEach(function (s) { ok(css.indexOf(s) > -1, 'missing ' + s); });
  ok(css.indexOf("'f8fbff'") > -1 && css.indexOf("'c7d2fe'") > -1, 'hex map extras');
  if (fail.length) {
    console.log('FAIL\n' + fail.join('\n'));
    process.exit(1);
  }
  console.log('PASS tester344 dark-module-css');
})();
