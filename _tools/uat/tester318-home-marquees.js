/* tester318 — Homepage: accessible light client and brand marquees */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
var js = fs.readFileSync(path.join(ROOT, 'assets/js/main.js'), 'utf8');
SECTION('اسلایدر صنایع/کارفرمایان هدف');
T('عنوان شفاف و بدون ادعای مشتری بودن', home.indexOf('صنایع و کارفرمایان هدف') > -1 && home.indexOf('به‌معنای ادعای همکاری') > -1);
T('فهرست منتخب صنایع نفت، گاز، پتروشیمی و EPC موجود است', ['NIOC','NIGC','NPC','پتروپارس','مپنا (MAPNA)','پتروشیمی بندر امام','آریاساسول'].every(function (x) { return home.indexOf(x) > -1; }));
T('marquee برای کارفرمایان وجود دارد', home.indexOf('clientMarqueeTrack') > -1 && js.indexOf("duplicate(document.getElementById('clientMarqueeTrack'))") > -1);
SECTION('اسلایدر برندها');
T('container اسلایدر برند وجود دارد', home.indexOf('brandMarqueeTrack') > -1);
T('لوگوهای اسلایدر از برندهای فعلی سایت تولید می‌شوند', js.indexOf("document.querySelectorAll('.brand-panel a')") > -1 && js.indexOf('brandTrack.appendChild(link)') > -1);
SECTION('خوانایی و دسترس‌پذیری');
T('زمینه روشن و متن تیره برای کارت‌ها تعریف شده است', css.indexOf('.marquee-track span{display:inline-flex') > -1 && css.indexOf('background:#fff') > -1 && css.indexOf('color:#1e3a5f') > -1);
T('حرکت با hover/focus متوقف و reduced motion پشتیبانی می‌شود', css.indexOf('animation-play-state:paused') > -1 && css.indexOf('prefers-reduced-motion:reduce') > -1);
DONE('tester318-home-marquees');
