/* tester41 — v123.0: بسته ناوبری موبایل مصوب کارفرما (US-286/287/290) */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var mn = fs.readFileSync(path.join(BASE, 'mobilenav.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-286: نوار ناوبری پایین');
T('فایل mobilenav.js ثبت شده', idx.indexOf('mobilenav.js') > -1 && sw.indexOf('./mobilenav.js') > -1);
T('۵ تب (v13.0: داشبورد/کارتابل/پیشنهاد/دستیار/سایر)', ["'dash'", "'cart'", "'off'", "'ai'", "'_more'"].every(function (k) { return mn.indexOf("id: " + k) > -1; }));
T('سایدبار در موبایل مخفی + عرض کامل آزاد', mn.indexOf('.sb{display:none!important}') > -1 && mn.indexOf('.mn{margin-right:0!important;width:100%!important') > -1);
T('نوار پایین fixed با safe-area', mn.indexOf('#mnvBar{position:fixed;bottom:0') > -1 && mn.indexOf('env(safe-area-inset-bottom') > -1);
T('فضای پایین محتوا رزرو شد (زیر نوار نمی‌رود)', mn.indexOf('.ca{padding-bottom:calc(76px') > -1);
T('بج کارتابل با MutationObserver از ctBadge سینک می‌شود', mn.indexOf("getElementById('ctBadge')") > -1 && mn.indexOf('new MutationObserver(syncBadge)') > -1);
T('هایلایت تب براساس نگاشت پنل→تب', mn.indexOf('TAB_OF') > -1 && mn.indexOf("off: 'off', ai: 'ai'") > -1);
T('هوک goPanel برای هایلایت (بدون بازنویسی مخرب)', mn.indexOf('_go(id, btn)') > -1 && mn.indexOf('_mnvHooked') > -1);
T('کشوی «بیشتر» از سایدبار واقعی می‌خواند (RBAC محفوظ)', mn.indexOf(".style.display === 'none') return; // RBAC") > -1);
T('کشو: Bottom Sheet با انیمیشن و دستگیره', mn.indexOf('mnv-sheet') > -1 && mn.indexOf('mnv-grip') > -1 && mn.indexOf('translateY(100%)') > -1);
T('دکمه خروج در کشو', mn.indexOf('doLogout') > -1);
T('حالت شب کامل (نوار/کشو/تب فعال)', mn.indexOf('body.ptf-dark #mnvBar') > -1 && mn.indexOf('body.ptf-dark .mnv-sheet') > -1);
T('آیکون‌ها SVG خطی 1.7 (نه ایموجی)', mn.indexOf('stroke-width="1.7"') > -1);
T('SVGهای iconx داخل کشو زنده', mn.indexOf('.mnv-mic span[data-ix]{display:inline-flex!important}') > -1);

SECTION('US-287: هدر تک‌ردیفه موبایل');
T('ساعت و health-pill در موبایل مخفی', mn.indexOf('#clockD,#liveHealthPill{display:none!important}') > -1);
T('هدر فشرده بدون شکست ردیف (v31.7.19: مهار سرریز با min-width/ellipsis نه clip)', mn.indexOf('.tb{padding:8px 12px!important;flex-wrap:nowrap!important}') > -1 && mn.indexOf('max-width:96px;overflow:hidden;text-overflow:ellipsis') > -1);
T('عنوان پنل ellipsis (سرریز ممنوع)', mn.indexOf('.tb h2{font-size:15px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis') > -1);

SECTION('US-290: جستجوی موبایل');
T('دکمه هدر در موبایل فقط آیکون (متن+Ctrl+K مخفی)', mn.indexOf('ptfOpenCommandPalette"] span{display:none!important}') > -1);
T('SVG جستجوی iconx در دکمه هدر زنده', mn.indexOf('ptfOpenCommandPalette"] span[data-ix]{display:inline-flex!important}') > -1);
T('جستجوی سرتاسری در کشوی بیشتر (دسترس شست)', mn.indexOf('mnv-srch') > -1 && mn.indexOf('ptfOpenCommandPalette') > -1);

SECTION('معماری و نسخه');
T('دسکتاپ دست‌نخورده (همه قواعد داخل @media)', mn.indexOf("'@media(max-width:' + BP + 'px){'") > -1 && mn.indexOf('#mnvBar{display:none}') > -1);
T('بوت با تلاش محدود + هوک showCrm (نه polling دائمی)', mn.indexOf('tries > 60') > -1 && mn.indexOf('window.showCrm') > -1);
T('VER v12x', /var VER = 'v\d/.test(idx));
T('sw cache v12x', /ptf-crm-v\d/.test(sw));
DONE('tester41-v1230');
