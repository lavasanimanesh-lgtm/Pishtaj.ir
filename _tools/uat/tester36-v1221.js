/* tester36 — v122.1: چپ‌چین متادیتا + آیکون‌های خطی نوار بالا + دکمه‌های مک مودال (US-279) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');
var th = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');
var mx = fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('چپ‌چین متادیتای قالب‌ها');
T('همه ۵ قالب text-align:left', (op.match(/\.hd \.meta\{[^}]*text-align:left/g) || []).length >= 5);
T('راست‌چین باقی نمانده', op.indexOf('.meta{font-size:8.5pt;line-height:1.9;text-align:right') === -1);

SECTION('آیکون‌های خطی نوار بالا');
T('SVG خطی استروک 1.7', th.indexOf('stroke-width="1.7"') > -1);
T('ماه/خورشید/ابر/پوشه/زنگ/جستجو', ['IC_MOON','IC_SUN','IC_CLOUD','IC_FOLDER','IC_BELL','IC_SEARCH'].every(function(k){ return th.indexOf(k) > -1; }));
T('ایموجی‌های قدیمی حذف شدند', th.indexOf('>☁️</button>') === -1 && th.indexOf('>📁</button>') === -1);
T('toggle تم آیکون SVG عوض می‌کند', th.indexOf('_ptfThemeIcons') > -1);

SECTION('US-279: دکمه‌های مک مودال');
T('سه دایره r/y/g', mx.indexOf('mx-dot r') > -1 && mx.indexOf('mx-dot y') > -1 && mx.indexOf('mx-dot g') > -1);
T('رنگ‌های مک', mx.indexOf('#e5655c') > -1 && mx.indexOf('#f0b429') > -1 && mx.indexOf('#61c454') > -1);
T('زرد: مینیمایز با حفظ DOM (اطلاعات)', mx.indexOf("mdb.style.display = 'none'") > -1 && mx.indexOf('اطلاعات حفظ') > -1);
T('داک دیسک مینیمال پایین صفحه', mx.indexOf('mxDock') > -1 && mx.indexOf('mx-disk') > -1);
T('برگشت با کلیک روی دیسک', mx.indexOf("mdb.style.display = 'grid'") > -1);
T('سبز: تمام‌صفحه toggle', mx.indexOf('mx-full') > -1 && mx.indexOf('classList.toggle') > -1);
T('MutationObserver (نه polling سنگین)', mx.indexOf('MutationObserver') > -1 && mx.indexOf('setInterval') === -1);
T('حالت شب سازگار', mx.indexOf('ptf-dark .mx-disk') > -1);

SECTION('نسخه');
T('VER v12x + modalx', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx) && idx.indexOf('modalx.js') > -1 && sw.indexOf('modalx.js') > -1);
DONE('tester36-v1221');
