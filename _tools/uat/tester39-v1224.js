/* tester39 — v122.4 (US-284): موتور سراسری آیکون‌های مینیمال iconx.js */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ix = fs.readFileSync(path.join(BASE, 'iconx.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-284: موتور جایگزینی ایموجی → SVG خطی');
T('فایل iconx.js موجود و ثبت‌شده', idx.indexOf('iconx.js') > -1 && sw.indexOf('./iconx.js') > -1);
T('استروک یکنواخت 1.7 و currentColor', ix.indexOf('stroke-width="1.7"') > -1 && ix.indexOf('currentColor') > -1);
T('پوشش آیکون‌های اسکرین‌شات کارفرما (حذف/ویرایش/مشاهده)', ["'🗑'", "'✏'", "'👁'"].every(function (k) { return ix.indexOf(k) > -1; }));
T('پوشش آیکون‌های پرتکرار (چک ۲۰ کلید)', ["'✅'", "'❌'", "'⚠'", "'⛔'", "'🤖'", "'💰'", "'📦'", "'📎'", "'📋'", "'🔒'", "'📄'", "'📊'", "'🗄'", "'🧾'", "'📤'", "'📥'", "'🖨'", "'🎯'", "'🏆'", "'🔍'"].every(function (k) { return ix.indexOf(k) > -1; }));
T('دایره‌های وضعیت رنگی (🟢🟡🔴...)', ix.indexOf("'🟢': dot('#22c55e')") > -1 && ix.indexOf("'🔴': dot('#ef4444')") > -1);
T('وضعیت‌ها رنگ معنادار ثابت دارند', ix.indexOf("{ c: '#22c55e' }") > -1 && ix.indexOf("{ c: '#ef4444' }") > -1 && ix.indexOf("{ c: '#f59e0b' }") > -1);

SECTION('ایمنی جایگزینی');
T('فقط TextNode (innerHTML بازنویسی نمی‌شود → هندلرها سالم)', ix.indexOf('SHOW_TEXT') > -1 && ix.indexOf('replaceChild(frag, tn)') > -1);
T('TEXTAREA/SCRIPT/STYLE/PRE/CODE استثنا', ['TEXTAREA', 'SCRIPT', 'STYLE', 'PRE', 'CODE'].every(function (t) { return ix.indexOf(t + ':') > -1 || ix.indexOf(t + ': 1') > -1; }));
T('داخل option فقط حذف ایموجی (SVG رندر نمی‌شود)', ix.indexOf("el.tagName === 'OPTION'") > -1);
T('گریز data-noix برای موارد استثنا', ix.indexOf('data-noix') > -1);
T('گره‌های جایگزین‌شده دوباره پردازش نمی‌شوند (data-ix)', ix.indexOf("getAttribute('data-ix')") > -1);
T('Variation Selector (FE0F) پوشش داده شده', ix.indexOf('\\uFE0F') > -1);

SECTION('معماری بدون polling');
T('MutationObserver + rAF debounce', ix.indexOf('MutationObserver') > -1 && ix.indexOf('requestAnimationFrame') > -1);
T('setInterval ندارد (TECHDEBT-004)', ix.indexOf('setInterval(') === -1);
T('قطع observer حین جایگزینی (ضد حلقه بازخورد)', ix.indexOf('mo.disconnect()') > -1);
T('بوت idempotent (گارد _ptfIconxBooted)', ix.indexOf('_ptfIconxBooted') > -1);
T('API دستی ptfIconxSweep برای پنل‌های خاص', ix.indexOf('window.ptfIconxSweep') > -1);

SECTION('نسخه');
T('VER v12x', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('sw.js cache v12x', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
DONE('tester39-v1224');
