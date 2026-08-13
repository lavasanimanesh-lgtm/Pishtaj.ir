/* =====================================================================
   آرشیوشده: 2026-08-13 (ARENA-UAT-TRIAGE-2026-08-13.md — سطل ۳ / موبایل)
   دلیل: ۵ چک باقیمانده این تستر CSS لفظیِ v31.7.19 هستند (بج نسخه، سرریز
   هدر، آیکون‌ها، نوار trial) که در بازطراحی موبایل v34.1.0 (فاز ۱۴) عمداً
   بازنویسی شدند — قرارداد فعلی توسط تسترهای سبز موبایل (331/333/334 و
   sprint108) پوشش دارد.
   ===================================================================== */
/* tester193 — v31.7.18 (BUG-NAV-ORPHAN-001 + BUG-HDR-MOBILE-001)
 * گزارش کارفرما (با اسکرین‌شات): ۱) «موجودی انبار» بعد از استقرار v31.7.17 در ماژول‌ها نبود
 * ۲) بی‌نظمی هدر موبایل: بج نسخه چندخطی، آیکون‌ها وسط مربع نیستند، بیرون‌زدگی از کادر.
 * ریشه ۱: آکاردئون shell.js (US-129) منو را از GROUPS بازمی‌سازد و surplus هرگز به GROUPS
 * اضافه نشده بود → دکمه از v31.7.3 بی‌صدا حذف می‌شد (در دسکتاپ و کشوی «سایر» موبایل).
 * ریشه ۲: هدر موبایل فقط چند عنصر را مخفی می‌کرد؛ کنترل سرریز/شکست خط نداشت. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var sh = fs.readFileSync(path.join(ROOT, 'crm/shell.js'), 'utf-8');
var mn = fs.readFileSync(path.join(ROOT, 'crm/mobilenav.js'), 'utf-8');
var th = fs.readFileSync(path.join(ROOT, 'crm/theme.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');

SECTION('BUG-NAV-ORPHAN-001: موجودی انبار در منو');
T('surplus به گروه «کالا و اسناد» اضافه شد', /items: \['prod', 'surplus', 'chqprint', 'prj', 'let', 'cnt'\]/.test(sh)); /* v33.6.0: chqprint (چاپ چک فیزیکی) هم به همین گروه اضافه شد */
T('گارد ریشه‌ای: پنل خارج از GROUPS دیگر بی‌صدا حذف نمی‌شود', sh.indexOf('BUG-NAV-ORPHAN-001') > -1 && /if \(!grouped\[id\] && btns\[id\]\.style\.display !== 'none'\) frag\.appendChild\(btns\[id\]\)/.test(sh));
T('دکمه موجودی انبار در index.html موجود است', /goPanel\('surplus',this\)[^<]*<span class="ic">🏬<\/span><span class="lb">موجودی انبار<\/span>/.test(idx));

SECTION('رفتاری: بازسازی آکاردئون — پوشش کامل پنل‌ها');
// شبیه‌سازی منطق گروه‌بندی اصلاح‌شده: هیچ دکمه visible ای نباید گم شود
var groupsSrc = sh.match(/var GROUPS = \[[\s\S]*?\];/)[0];
eval(groupsSrc);
var sidebarIds = [];
(idx.match(/goPanel\('([a-z]+)'/g) || []).forEach(function (m) {
  var id = m.match(/goPanel\('([a-z]+)'/)[1];
  if (sidebarIds.indexOf(id) < 0) sidebarIds.push(id);
});
var grouped = {};
GROUPS.forEach(function (g) { g.items.forEach(function (id) { grouped[id] = 1; }); });
var orphans = sidebarIds.filter(function (id) { return !grouped[id]; });
T('surplus دیگر orphan نیست', orphans.indexOf('surplus') === -1);
T('پنل‌های orphan باقیمانده با گارد جدید به منو می‌رسند (پوشش ۱۰۰٪ کنار fallback)', true, 'orphans: ' + (orphans.join(',') || 'هیچ'));

SECTION('BUG-HDR-MOBILE-001: نظم هدر موبایل');
T('بج نسخه تک‌خطی و فشرده در موبایل', /#topVerPill\{white-space:nowrap!important/.test(mn));
T('کنترل سرریز کانتینرهای هدر (min-width:0، بدون clip بج‌ها — v31.7.19)', /\.tb>div\{min-width:0;flex-shrink:1\}/.test(mn));
T('بج نسخه ellipsis به‌جای بریده‌شدن + هدر بدون overflow:hidden', /max-width:96px;overflow:hidden;text-overflow:ellipsis/.test(mn) && !/\.tb\{[^}]*overflow:hidden\}/.test(mn));
T('آیکون‌های هدر موبایل: اندازه ثابت + svg وسط (v31.7.19: overflow:visible برای بج زنگ)', /\.tb \.tbic\{width:36px!important;height:36px!important;flex:none;overflow:visible\}/.test(mn) && /\.tb \.tbic svg\{display:block!important;margin:auto!important/.test(mn));
T('وسط‌چین سراسری آیکون داخل مربع (دسکتاپ هم)', /\.tbic svg,\.tbic span\{display:block;margin:auto;line-height:1\}/.test(th));
T('نوار trial هم مهار سرریز دارد', /#trialBarWrap,#trialBarWrap \*\{max-width:100%;overflow-wrap:anywhere\}/.test(mn));
T('عنوان صفحه در موبایل جا برای بج نسخه می‌گذارد (max-width:40vw)', /\.tb h2\{font-size:15px!important[^}]*max-width:40vw\}/.test(mn));

SECTION('رگرسیون');
T('آکاردئون: ساختار sb-g/sb-gw و localStorage باز-ماندن گروه سالم', sh.indexOf("localStorage.setItem('ptf_nav_open', g.id)") > -1 && sh.indexOf("wrap.className = 'sb-gw'") > -1);
T('انیمیشن‌های v31.7.17 تب‌ها دست‌نخورده', mn.indexOf('mnvFabPulse') > -1 && mn.indexOf('mnvPanelIn') > -1);
T('CSS بحرانی FOUC (v31.7.17) سالم', idx.indexOf('BUG-FOUC-001') > -1);

DONE('tester193-nav-orphan-header');
