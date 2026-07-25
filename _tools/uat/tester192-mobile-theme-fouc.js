/* tester192 — v31.7.17 (BUG-FOUC-001 + US-MNV-DELIGHT)
 * ۱) رفع فلش تم قدیمی: CSS بحرانی پوسته باید در head باشد نه فقط انتهای body
 * ۲) انیمیشن تب‌های پایین موبایل (مرجع بصری کارفرما) + FAB pulse + هپتیک + panel-in
 * ۳) قیدهای QA پنل: فقط transform/opacity، بدون setInterval، prefers-reduced-motion */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var mn = fs.readFileSync(path.join(ROOT, 'crm/mobilenav.js'), 'utf-8');

SECTION('BUG-FOUC-001: CSS بحرانی در head');
var headEnd = idx.indexOf('</head>');
var critStart = idx.indexOf('id="ptfCriticalTheme"');
T('بلاک بحرانی قبل از پایان head است', critStart > -1 && critStart < headEnd);
var crit = idx.slice(critStart, idx.indexOf('</style>', critStart));
T('فونت وزیرمتن در CSS بحرانی (فلش فونت سیستم حذف)', crit.indexOf("font-family:'Vazirmatn'") > -1 && crit.indexOf('font-display:swap') > -1);
T('استایل سایدبار/act در CSS بحرانی (فلش پوسته خام حذف)', crit.indexOf('.sb-i.act') > -1 && crit.indexOf('scrollbar-gutter:stable') > -1);
T('موبایل: سایدبار از فریم اول مخفی + جای نوار پایین رزرو', /@media\(max-width:768px\)\{[\s\S]{0,300}\.sb\{display:none!important\}/.test(crit) && crit.indexOf('padding-bottom:calc(76px') > -1);
T('تم تاریک همچنان قبل از body اعمال می‌شود (BUG-003 قبلی سالم)', idx.indexOf('FOUC Elimination') > -1 && idx.indexOf("localStorage.getItem('ptf_theme')") < headEnd);

SECTION('US-MNV-DELIGHT: گرافیک تب‌های پایین (الگوی مرجع کارفرما)');
T('تب فعال: آیکون بالا می‌آید و در pill گرادیانی می‌نشیند', /\.mnv-tab\.act \.mnv-ic\{transform:translateY\(-4px\);background:linear-gradient/.test(mn));
T('لیبل تب فعال bold + حرکت', /\.mnv-tab\.act \.mnv-lb\{font-weight:900/.test(mn));
T('نقطه نشانگر زیر تب فعال (و نه زیر FAB)', /\.mnv-tab\.act::after\{content:""/.test(mn) && /\.mnv-fabwrap\.act::after\{display:none\}/.test(mn));
T('فشردن لمسی تب و FAB (scale)', /\.mnv-tab:active \.mnv-ic\{transform:scale\(\.88\)\}/.test(mn) && /\.mnv-fabwrap:active \.mnv-fab\{transform:translateX\(-50%\) scale\(\.9\)\}/.test(mn));
T('پالس ملایم FAB', mn.indexOf('@keyframes mnvFabPulse') > -1 && /animation:mnvFabPulse 3\.2s/.test(mn));
T('هپتیک ظریف در تعویض تب — گارد شده', /navigator\.vibrate\) navigator\.vibrate\(8\)/.test(mn) && /try \{ if \(navigator\.vibrate/.test(mn));
T('ورود نرم پنل (A5) فقط opacity/transform', mn.indexOf('@keyframes mnvPanelIn') > -1 && /mnvPanelIn\{from\{opacity:\.35;transform:translateY\(10px\)\}/.test(mn));

SECTION('قیدهای QA پنل متخصصان');
T('prefers-reduced-motion همه انیمیشن‌ها را خاموش می‌کند', (mn.match(/prefers-reduced-motion:reduce/g) || []).length >= 2);
T('هیچ setInterval جدیدی اضافه نشده (فقط ۱ boot-poller قدیمی v123.0)', (mn.match(/setInterval\(/g) || []).length === 1);
T('spring انیمیشن‌ها cubic-bezier سبک است (بدون کتابخانه خارجی)', /cubic-bezier\(\.34,1\.56,\.64,1\)/.test(mn) && mn.indexOf('lottie') === -1 && mn.indexOf('cdn') === -1);
T('صورت‌جلسه پنل متخصصان موجود و آیتم‌های ردشده مستند است', fs.existsSync(path.join(ROOT, 'EXPERT-PANEL-MOBILE-UX-v31.7.17.md')) && fs.readFileSync(path.join(ROOT, 'EXPERT-PANEL-MOBILE-UX-v31.7.17.md'), 'utf-8').indexOf('رد قطعی') > -1);
T('ساختار TABS/goPanel/RBAC دست‌نخورده', mn.indexOf('var TABS = [') > -1 && mn.indexOf('buildMoreSheet') > -1 && /goPanel\(id\)/.test(mn));

DONE('tester192-mobile-theme-fouc');
