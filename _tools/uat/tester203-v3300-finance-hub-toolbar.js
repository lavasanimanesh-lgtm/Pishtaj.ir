/* S3a — UR-2026-08-01-01: تولبار تنخواه فقط در تب تنخواه هاب مالی دیده می‌شود */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var petty = fs.readFileSync(path.join(BASE, 'petty.js'), 'utf-8');
var fh = fs.readFileSync(path.join(BASE, 'financehub.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

SECTION('ساختار');
T('تولبار تنخواه id دارد', petty.indexOf('id="ptToolbar"') > -1);
T('تولبار در فهرست «فقط تب تنخواه» هاب مالی است', /\[\s*'ptToolbar'/.test(fh) && fh.indexOf("'ptToolbar'") < fh.indexOf("'ptWrap'"));
T('دکمه‌های پرداخت مستقیم/شارژ/ارجاع دوره داخل همان تولبار هستند', (function () {
  /* 2026-08-13: اکشن‌ها اکنون با pettyToolbarAction در متغیر actions ساخته و به تولبار تزریق می‌شوند */
  return petty.indexOf('id="ptToolbar"') > -1 && petty.indexOf("pettyToolbarAction('direct'") > -1 &&
    petty.indexOf("pettyToolbarAction('charge'") > -1 && petty.indexOf("pettyToolbarAction('refer'") > -1;
})());
T('financehub.js لود شده', idx.indexOf('financehub.js?v=') > -1);

DONE('tester203-v3300-finance-hub-toolbar');
