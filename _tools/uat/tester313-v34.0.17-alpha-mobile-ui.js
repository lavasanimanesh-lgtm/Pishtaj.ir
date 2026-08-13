/* tester313 — v34.0.17-alpha (فاز ۱۴: یکنواخت‌سازی UI موبایل — دکمه‌ها/آیکون‌ها/خوانایی)
   پوشش: دکمه‌ها flex وسط‌چین، متن شکستنی (بدون خروج از صفحه)، «نسخه فعال» خوانا */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var vjson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../VERSION.json'), 'utf-8'));

SECTION('نسخه');
T('lockstep نسخهٔ جاری', /^v\d+(\.\d+){1,2}(-[a-z0-9.]+)?$/.test(vjson.crm_version));

SECTION('دکمه‌ها flex/وسط‌چین (پایه)');
T('.bt display:inline-flex و وسط‌چین', idx.indexOf('display:inline-flex') > -1 && idx.indexOf('justify-content:center') > -1);
T('.ba display:inline-flex و وسط‌چین', idx.indexOf('.ba{background:#f1f5f9') > -1 && idx.indexOf('justify-content:center') > -1);

SECTION('موبایل — یکنواخت‌سازی و جلوگیری از خروج از صفحه');
T('موبایل: دکمه‌ها flex وسط‌چین + شکستن متن', idx.indexOf('word-break: break-word !important') > -1 && idx.indexOf('overflow-wrap: anywhere !important') > -1);
T('موبایل: max-width:100% و min-width:0 (جلوگیری از خروج)', idx.indexOf('max-width: 100% !important') > -1 && idx.indexOf('min-width: 0 !important') > -1);
T('موبایل: دکمه‌های مودال تمام‌عرض و یکنواخت', idx.indexOf('.md .bt, .md .bt-o, .md .btn, .md .ba, .md button { width: 100% !important; }') > -1);

SECTION('نسخه فعال — خوانا');
T('نسخه فعال (topVerPill) فونت/شکستن در موبایل دارد', idx.indexOf('#topVerPill, #liveHealthPill') > -1 && idx.indexOf('white-space: normal !important') > -1);
T('نسخه فعال با VER پر می‌شود', idx.indexOf("getElementById('topVerPill').textContent = 'نسخه فعال: ' + VER") > -1);

DONE('tester313-v34.0.17-alpha');
