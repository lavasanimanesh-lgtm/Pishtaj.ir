/* tester40 — v122.5 (US-285): رفع فوری‌های هیئت موبایل M1..M6 */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('M1: آیکون‌های زیرشاخه سایدبار موبایل');
T('سلکتور فقط فرزند مستقیم (index.html)', idx.indexOf('.sb-i > span:not(.ic)') > -1);
T('سلکتور فقط فرزند مستقیم (shell.js)', sh.indexOf('.sb-i > span:not(.ic)') > -1);
T('قاعده کور قدیمی حذف شد', idx.indexOf('.sb-i span:not(.ic), .nl, .sb-g .ar') === -1 && sh.indexOf(".sb-i .lb,.sb-i span:not(.ic),.nl") === -1);
T('SVGهای iconx داخل .ic صریحاً زنده', sh.indexOf('.sb-i .ic span[data-ix]{display:inline-flex!important}') > -1);

SECTION('M2: سرریز متن سرگروه‌ها');
T('مارک‌آپ سرگروه تفکیک شد (gi/gt)', sh.indexOf("'<span class=\"gi\">'") > -1 && sh.indexOf("'</span><span class=\"gt\">'") > -1);
T('متن سرگروه: 9px + ellipsis + سقف 46px (index)', idx.indexOf('.sb-g .gt') > -1 && idx.indexOf('text-overflow: ellipsis !important; max-width: 46px') > -1);
T('متن سرگروه: ellipsis (shell)', sh.indexOf('.sb-g .gt{display:block!important;font-size:9px') > -1 && sh.indexOf('text-overflow:ellipsis!important;max-width:46px') > -1);
T('دسکتاپ: gi/gt inline (بدون تغییر بصری)', sh.indexOf('.sb-g .gi,.sb-g .gt{display:inline-block}') > -1);

SECTION('M3: حالت شب موبایل — کارت‌ها');
T('پس‌زمینه body متغیر تم شد', idx.indexOf('background: var(--bg, #f1f5f9) !important') > -1 && idx.indexOf('background: #f1f5f9 !important; }') === -1);
T('کارت‌های tb2 متغیر تم شدند (هر دو بلوک)', (idx.match(/background: var\(--crd, #fff\) !important/g) || []).length >= 2);
T('خط جداکننده سلول‌ها متغیر شد', (idx.match(/1px dashed var\(--brd, #e2e8f0\) !important/g) || []).length >= 2);
T('سرگروه موبایل هم متغیر تم', idx.indexOf('background: var(--crd, #f1f5f9) !important') > -1 && sh.indexOf('background:var(--crd,#f1f5f9)!important') > -1);
T('رنگ متن سرگروه متغیر', idx.indexOf('color: var(--tx, #334155) !important') > -1);

SECTION('M4/M5: iOS');
T('فیلدهای ورودی موبایل 16px (ضد زوم خودکار iOS)', (idx.match(/font-size: 16px !important;/g) || []).length >= 2 && idx.indexOf('زوم خودکار iOS') > -1);
T('دکمه‌ها 14px ماندند', idx.indexOf('.btn, .bt, .bt-o, .btn-l, button {') > -1);
T('viewport-fit=cover', idx.indexOf('viewport-fit=cover') > -1);
T('safe-area-inset-bottom', idx.indexOf('env(safe-area-inset-bottom') > -1);

SECTION('سند هیئت و نسخه');
T('سند ASSESSMENT-MOBILE-UX-v122.md', fs.existsSync(path.resolve(__dirname, '../../ASSESSMENT-MOBILE-UX-v122.md')));
T('سند شامل بک‌لاگ US-286..294', (function () { var d = fs.readFileSync(path.resolve(__dirname, '../../ASSESSMENT-MOBILE-UX-v122.md'), 'utf-8'); return d.indexOf('US-286') > -1 && d.indexOf('US-294') > -1 && d.indexOf('Bottom Tab Bar') > -1; })());
T('VER v12x', /var VER = 'v\d/.test(idx));
T('sw.js cache v12x', /ptf-crm-v\d/.test(sw));
DONE('tester40-v1225');
