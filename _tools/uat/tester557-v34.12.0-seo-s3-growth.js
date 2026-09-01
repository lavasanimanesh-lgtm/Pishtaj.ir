#!/usr/bin/env node
'use strict';
/* tester557 — v34.29.2: فیکس ثبت نقشه + فاز S3 (رشد داده‌محور)
   ۱) sitemap_submit: تشخیص خودکار پراپرتی + گیت سطح Full + خطای فارسی دقیق
   ۲) اسنپ‌شات روزانهٔ lazy گلوال + اکشن snaps (سری + دلتا)
   ۳) خوشه‌بندی کلمه→محتوا (seo_clusters) + UI برنامهٔ محتوا
   ۴) KPI روند اسنپ‌شات‌ها در پنل GSC */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var gscPhp = read('api/gsc.php');
var llmPhp = read('api/llm.php');
var gscJs = read('crm/gsc.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var SUB = blk(gscPhp, "case 'sitemap_submit'", "case 'sitemaps'");
var OVR = blk(gscPhp, "case 'overview'", "case 'snaps'");

/* ═══ ۱) فیکس ثبت نقشه ═══ */
T('FIX: هلپر gsc_resolve_site (تشخیص پراپرتی از sites.list)', gscPhp.indexOf('function gsc_resolve_site') > -1 && gscPhp.indexOf("webmasters/v3/sites'") > -1);
T('FIX: اولویت تطبیق = دقیق → sc-domain → prefix', /sc-domain:' \. \$host/.test(gscPhp) || gscPhp.indexOf("'sc-domain:' . $host") > -1);
T('FIX: پراپرتی گموشده = خطای فارسی با ایمیل سرویس‌اکانت', gscPhp.indexOf('property_not_found') > -1 && gscPhp.indexOf('Users and permissions') > -1);
T('FIX: سطح Restricted/Unverified = خطای صریح Full', gscPhp.indexOf('permission_') > -1 && gscPhp.indexOf('فقط با سطح Full مجاز است') > -1);
T('FIX: sitemap_submit از resolve استفاده می‌کند (نه site_url خام)', SUB.indexOf('gsc_resolve_site($cfg)') > -1 && SUB.indexOf("$cfg['site_url']") === -1);
T('FIX: sitemaps لیست با resolve بدون گیت نوشتاری', /case 'sitemaps'[\s\S]{0,300}gsc_resolve_site\(\$cfg, false\)/.test(gscPhp));
T('FIX: پاسخ submit شامل site انتخاب‌شده', SUB.indexOf("'site'      => $site") > -1);
T('FIX: کلاینت خطای فارسی سرور را کامل نشان می‌دهد (راهنما فقط برای خام)', /ثبت ناموفق/.test(gscJs) && gscJs.indexOf('permission_|property_not_found') > -1);

/* ═══ ۲) اسنپ‌شات روزانه ═══ */
T('S3: gsc_snap_maybe با گپ ۲۰ ساعت + سقف ۱۸۰ روز', gscPhp.indexOf('function gsc_snap_maybe') > -1 && gscPhp.indexOf('20 * 3600') > -1 && gscPhp.indexOf('> 180') > -1);
T('S3: اسنپ‌شات = جمع + ۳۰ کوئری + ۳۰ صفحه', /gsc_snap_maybe[\s\S]{0,1300}'topQueries'[\s\S]{0,300}'topPages'/.test(gscPhp));
T('S3: overview بعد از summarize اسنپ می‌گیرد', OVR.indexOf('gsc_snap_maybe($GSC_SNAP_DIR') > -1);
T('S3: case snaps سری ۶۰ نقطه + دلتای درصدی دو نقطهٔ آخر', /case 'snaps'[\s\S]{0,1100}array_slice\(\$series, -60\)[\s\S]{0,80}'delta'/.test(gscPhp));
T('S3: اسنپ‌شات‌ها در crm/data/gsc-snaps', gscPhp.indexOf("gsc-snaps") > -1);

/* ═══ ۳) خوشه‌بندی AI ═══ */
T('AI: case seo_clusters زیر گیت نقش سئو', /case 'seo_clusters':[\s\S]{0,260}\$llmRole, \['admin', 'chairman', 'ceo', 'commercial'\]/.test(llmPhp));
T('AI: سقف ۶۰ کوئری/صفحه + ورودی اجباری', llmPhp.indexOf('count($queries) > 60') > -1 && llmPhp.indexOf('فهرست کلمات لازم است') > -1);
T('AI: تصمیم new|optimize بر اساس جایگاه موجود', llmPhp.indexOf('action":"new|optimize"') > -1 && llmPhp.indexOf('position<=5') > -1);
T('AI: خروجی JSON خوشه‌ها با target', llmPhp.indexOf('"clusters":[{"topic":"...","action":"new|optimize"') > -1);

/* ═══ ۴) UI پنل GSC ═══ */
T('UI: gscLLM helper با همان authHeaders', gscJs.indexOf('function gscLLM') > -1 && /gscLLM[\s\S]{0,300}authHeaders\(\)/.test(gscJs));
T('UI: نوار روند اسنپ‌شات‌ها (sparkline + دلتا رنگی)', gscJs.indexOf('window.gscTrendLoad') > -1 && gscJs.indexOf('gscTrend') > -1 && gscJs.indexOf("dl.clicks >= 0 ? '#059669'") > -1);
T('UI: دکمهٔ 🧠 برنامهٔ محتوا', gscJs.indexOf('gscContentPlan') > -1 && gscJs.indexOf('🧠 برنامهٔ محتوا') > -1);
T('UI: ورودی خوشه‌بندی = quickwins + no_click (فیلد درست)', /gscContentPlan[\s\S]{0,500}_data\.quickwins[\s\S]{0,200}_data\.no_click/.test(gscJs));
T('UI: کارت خوشه با برچسب صفحهٔ جدید/بهینه‌سازی', gscJs.indexOf('صفحهٔ جدید') > -1 && gscJs.indexOf('بهینه‌سازی صفحهٔ موجود') > -1);
T('UI: پرش «📝 ساخت مقاله» به فرم KC با prefetch موضوع', gscJs.indexOf('window.gscClusterNew') > -1 && /gscClusterNew[\s\S]{0,700}cmsKcNew\(\)/.test(gscJs));
T('UI: پرش بهینه‌سازی از مسیر موجود gscOptimize', gscJs.indexOf("gscOptimize(\\'' + ptfOnClickArg") > -1);
T('UI: روند پس از رندر لود می‌شود', gscJs.indexOf('gscTrendLoad(); /* v') > -1); /* انکر بدون نسخه — مقاوم به جاروی bump */

/* ═══ بهداشت ═══ */
T('HYG: gsc.js بدون LS مستقیم (A10)', /localStorage\s*\./.test(gscJs) === false);
T('HYG: بدون متن غیرفارسی جاافتاده', [gscPhp, gscJs, llmPhp].every(function (t) { return !/[а-яА-Я]{3}/.test(t); }));

console.log('=== tester557: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
