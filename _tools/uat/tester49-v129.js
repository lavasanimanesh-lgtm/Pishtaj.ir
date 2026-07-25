/* tester49 — v12.9 (US-316v2): موتور درگ لانچر — ghost + FLIP + long-press لمسی */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var lc = fs.readFileSync(path.join(BASE, 'launcher.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('موتور درگ v2 — الگوی آیکون‌های موبایل');
T('شبح (ghost) دنبال اشاره‌گر', lc.indexOf('lch-ghost') > -1 && lc.indexOf('tile.cloneNode(true)') > -1 && lc.indexOf("ghost.style.left = (ev.clientX - ghost._dx)") > -1);
T('کاشی اصلی → جای‌نمای کم‌رنگ (lch-ph)', lc.indexOf("tile.classList.add('lch-ph')") > -1 && lc.indexOf('.lch-tile.lch-ph{opacity:.3') > -1);
T('انیمیشن FLIP: کاشی‌ها فوری جا باز می‌کنند', lc.indexOf('function flip(') > -1 && lc.indexOf('getBoundingClientRect()') > -1 && lc.indexOf("transition = 'transform .18s ease'") > -1);
T('ماوس: کشیدن مستقیم (آستانه 6px)', lc.indexOf('if (moved < 6) return;') > -1);
T('لمس: نگه‌داشتن ۳۰۰ms سپس درگ + ویبره', lc.indexOf('}, 300)') > -1 && lc.indexOf('navigator.vibrate') > -1);
T('لمس: حرکت قبل از نگه‌داشتن = اسکرول (درگ لغو)', lc.indexOf('if (moved > 12) cleanup()') > -1);
T('شنونده‌ها روی document (نه کاشی — مقاوم به insertBefore حین درگ)', lc.indexOf("document.addEventListener('pointermove', mv, { passive: false })") > -1);
T('شبح pointer-events:none (elementFromPoint کور نمی‌شود)', lc.indexOf('pointer-events:none;margin:0') > -1);
T('درج RTL-aware (نیمه راست = قبل)', lc.indexOf('ev.clientX > r2.left + r2.width / 2; // RTL') > -1);
T('پاکسازی کامل (ghost/جای‌نما/userSelect/شنونده‌ها)', lc.indexOf('function cleanup()') > -1 && lc.indexOf("document.body.style.userSelect = ''") > -1);
T('تپ/کلیک ساده = ورود به ماژول', lc.indexOf('goPanel(id)') > -1);
T('ذخیره ترتیب پس از درگ', lc.indexOf('saveOrder(ids)') > -1);
T('iOS: منوی نگه‌داشتن غیرفعال', lc.indexOf('-webkit-touch-callout:none') > -1);
T('فیلتر pointerId (چند-لمسی امن)', lc.indexOf('ev.pointerId !== e.pointerId') > -1);

SECTION('نسخه');
T('VER v1x اعشاری', /var VER = 'v\d+\.\d/.test(idx));
T('sw cache v1x', /ptf-crm-v\d/.test(sw));
DONE('tester49-v129');
