#!/usr/bin/env node
'use strict';
/* tester559 — v34.30.0: S4 «کیفیت و مقیاس»
   ۱) انتشار زمان‌بندی‌شده (موتور lazy + جریان دومرحله‌ای نویسنده/منتشرکننده)
   ۲) diff/rollback UI روی بک‌آپ‌های موجود
   ۳) داشبورد هزینهٔ AI (شمارنده روی llm.php)
   ۴) PageSpeed برای ۱۰ صفحهٔ پول‌ساز (۶ساعت throttle)
   ۵) hreflang خودکار با en/ (فقط اگر نسخهٔ انگلیسی هم‌مسیر موجود باشد) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var llmPhp = read('api/llm.php');
var cmsJs = read('crm/cms.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var RENDER = blk(cmsPhp, 'function cms_render_public_page', 'function cms_sched_file');
var SCHED = blk(cmsPhp, 'function cms_sched_file', 'function cms_backups_list');
var BK = blk(cmsPhp, 'function cms_backups_list', 'function cms_psi_cfg_file');
var PSI = blk(cmsPhp, 'function cms_psi_cfg_file', 'switch ($action)');
var SC = blk(cmsPhp, "case 'sched_add'", "case 'backup_list'");
var BKC = blk(cmsPhp, "case 'backup_list'", "case 'psi_config_get'");
var PSIC = blk(cmsPhp, "case 'psi_config_get'", "case 'page_create'");
var USAGE = blk(llmPhp, 'function llm_price', 'function llm_data_dir');
var STATS = blk(llmPhp, "if ($action === 'usage_stats')", '/* ---------- فراخوانی ارائه‌دهنده');

/* ═══ ۱) زمان‌بندی + دومرحله‌ای ═══ */
T('SCHED: موتور lazy پیش از switch روی هر اکشن', /cms_sched_due\(\$ROOT, \$DATA\);\s*\nswitch \(\$action\)/.test(cmsPhp));
T('SCHED: انتشار در موعد = بک‌آپ + نقشه + لاگ', SCHED.indexOf("cms_backup(\$DATA, \$ROOT, \$rel)") > -1 && SCHED.indexOf('sitemap_add((string)$it[\'url\'])') > -1 && SCHED.indexOf("cms_log('sched_publish'") > -1);
T('SCHED: نگهداری ۱۵ انتشار آخر', SCHED.indexOf('count($done) > 15') > -1);
T('SCHED: صفحه رندر می‌شود و html نهایی در صف ذخیره می‌شود', SC.indexOf('cms_render_public_page($ROOT, (string)($_POST[\'folder\']') > -1 && SC.indexOf("'html' => \$r['html']") > -1);
T('SCHED: بازهٔ معتبر ۵دقیقه تا ۶۰روز', SC.indexOf('time() + 300') > -1 && SC.indexOf('60 * 86400') > -1);
T('SCHED: commercial معلق — admin/chairman/ceo تأییدشده', SC.indexOf("in_array($ROLE, ['admin', 'chairman', 'ceo'], true)") > -1 && SC.indexOf("'st' => \$senior ? 'approved' : 'pending'") > -1);
T('SCHED: تأیید فقط مدیر ارشد', /case 'sched_approve':\s*\n\s*if \(!in_array\(\$ROLE, \['admin', 'chairman', 'ceo'\], true\)\) jerr\('تأیید انتشار فقط برای مدیر ارشد مجاز است'\)/.test(cmsPhp));
T('SCHED: لغو = سازنده یا مدیر ارشد؛ انتشار فوری فقط ارشد', cmsPhp.indexOf('فقط سازندهٔ آیتم یا مدیر ارشد') > -1 && cmsPhp.indexOf('انتشار فوری فقط برای مدیر ارشد') > -1);
T('SCHED: سقف ۲۰ آیتم معلق', SC.indexOf('count($pend) >= 20') > -1);
T('SCHED: sched_list بدنهٔ html را به کلاینت نمی‌فرستد', cmsPhp.indexOf("unset($it['html'])") > -1);
T('SCHED: UI فرم صفحه datetime + دکمهٔ زمان‌بندی', cmsJs.indexOf('id="pgWhen"') > -1 && cmsJs.indexOf('cmsPageSchedule()') > -1);
T('SCHED: UI تیک بازبینی برای زمان‌بندی هم الزامی', /cmsPageSchedule[\s\S]{0,900}بازبینیِ انسانی زده شود/.test(cmsJs));
T('SCHED: UI صف با تأیید/لغو/هم‌اکنون', cmsJs.indexOf('cmsSchedAct(\\\'approve\\\'') > -1 && cmsJs.indexOf('cmsSchedAct(\\\'now\\\'') > -1 && cmsJs.indexOf('cmsSchedAct(\\\'cancel\\\'') > -1);
T('SCHED: UI موتور lazy را توضیح می‌دهد', cmsJs.indexOf('بدون cron هاست') > -1);

/* ═══ ۲) تاریخچه/بازگشت ═══ */
T('BK: فهرست گروهی از cms-backups با ۳ نسخه', BK.indexOf('cms-backups/*.html') > -1 && BKC.indexOf("array_slice($vers, 0, 3)") > -1);
T('BK: مسیر بک‌آپ ضد path-traversal (الگوی stamp سخت)', BK.indexOf("preg_match('/^\\d{8}-\\d{6}$/', (string)\$stamp)") > -1);
T('BK: بازیابی = ابتدا بک‌آپ از نسخهٔ فعلی (بازگشتِ بازگشت)', BKC.indexOf('if (is_file($livePath)) cms_backup($DATA, $ROOT, $rel);') > -1);
T('BK: بازیابی نقشه را به‌روز و کش سئو را نامعتبر می‌کند', BKC.indexOf("sitemap_add('https://pishtaj.ir/' . \$rel)") > -1 && BKC.indexOf("unlink(\$DATA . '/cms-seo-scan.json')") > -1);
T('BK: restore همان گیت‌های مسیر seo_queue (cms_skip_dir)', BKC.indexOf('cms_skip_dir($seg)') > -1);
T('BK: UI مقایسه با فیلدهای title/desc/H1 + diff خطی', cmsJs.indexOf('cmsBkCompare') > -1 && cmsJs.indexOf('توضیح (description)') > -1 && cmsJs.indexOf('cmsBkLineDiff') > -1);
T('BK: diff خطی با پیشوند/پسوند مشترک و سقف ۴۰۰ خط', cmsJs.indexOf('A[i] === B[j]') > -1 && cmsJs.indexOf('> 400') > -1);
T('BK: UI بازگردانی با تأیید دو مرحله‌ای', cmsJs.indexOf('cmsBkRestore') > -1 && /cmsBkRestore[\s\S]{0,300}confirm\(/.test(cmsJs));

/* ═══ ۳) هزینهٔ AI ═══ */
T('COST: توکن واقعی از هر دو provider + تخمین حرفی جایگزین', llmPhp.indexOf("$um['promptTokenCount'] ?? 0") > -1 && llmPhp.indexOf("$um['prompt_tokens'] ?? 0") > -1 && llmPhp.indexOf('mb_strlen($system . $userText') > -1);
T('COST: ثبت مصرف فقط در مسیر موفقیت پس از پاسخ provider', llmPhp.indexOf('llm_usage_log($model, $ptTok, $ctTok, (int)round((microtime(true) - $t0) * 1000))') > -1);
T('COST: لاگ روزانه با تفکیک اکشن/مدل + نگهداری ۱۲۰ روز', USAGE.indexOf("'act' => [], 'mod' => []") > -1 && USAGE.indexOf('> 120') > -1);
T('COST: قیمت‌ها قابل بازنویسی از llm-config.php', USAGE.indexOf("isset($p[$model])") > -1 && USAGE.indexOf('flash-lite') > -1 && USAGE.indexOf('[0.30, 2.50]') > -1);
T('COST: usage_stats گیت نقش از توکن تأییدشده (نه هدر خام)', STATS.indexOf('!in_array($llmRole') > -1 && STATS.indexOf('HTTP_X_PTF_ROLE') === -1);
T('COST: خروجی شامل tot/byDay/acts/mods + برچسب تخمینی', STATS.indexOf("'byDay' => \$byDay") > -1 && STATS.indexOf("'tot' => \$tot") > -1 && STATS.indexOf('هزینه تخمینی است') > -1);
T('COST: UI داشبورد فقط ارشد + کارت‌های مجموع + جدول روزانه', cmsJs.indexOf('مشاهدهٔ هزینه فقط برای نقش‌های ارشد') > -1 && cmsJs.indexOf('هزینهٔ تخمینی') > -1 && cmsJs.indexOf('روزبه‌روز') > -1);
T('COST: UI cache-hit را توضیح می‌دهد (هزینه ندارد)', cmsJs.indexOf('کش‌شده هزینه ندارند') > -1);

/* ═══ ۴) PageSpeed ═══ */
T('PSI: GET با cURL + timeout ۲۵ثانیه', PSI.indexOf('CURLOPT_TIMEOUT => 25') > -1);
T('PSI: کلید اختیاری از gsc-config.php (psi_key)', PSIC.indexOf("include \$gc") > -1 && PSIC.indexOf("psi_key") > -1);
T('PSI: throttle ۶ ساعت برای هر مسیر', PSIC.indexOf('< 6 * 3600') > -1 && PSIC.indexOf("jerr('throttled')") > -1);
T('PSI: سقف ۱۰ مسیر + فقط مسیرهای موجود روی دیسک', PSIC.indexOf('count($clean) > 10') > -1 && PSIC.indexOf('is_file($disk)') > -1);
T('PSI: استخراج score/lcp/cls/tbt/seo از Lighthouse', PSIC.indexOf("categories']['performance']['score']") > -1 && PSIC.indexOf('largest-contentful-paint') > -1 && PSIC.indexOf('cumulative-layout-shift') > -1 && PSIC.indexOf("categories']['seo']['score']") > -1);
T('PSI: تاریخچه ۳۰ سنجش آخر هر مسیر', PSIC.indexOf('> 30) $runs = array_slice($runs, -30)') > -1);
T('PSI: UI اندازه‌گیری گروهی ترتیبی با پیشرفت', cmsJs.indexOf('cmsPsiRunAll') > -1 && cmsJs.indexOf('هر سنجش تا ~۳۰ ثانیه') > -1);
T('PSI: UI throttle پیام فارسی', cmsJs.indexOf('در ۶ ساعت گذشته سنجیده شده') > -1);
T('PSI: UI ویرایش فهرست مسیرها', cmsJs.indexOf('cmsPsiSave') > -1 && cmsJs.indexOf('psiUrls') > -1);

/* ═══ ۵) hreflang ═══ */
T('HREF: سه‌گانهٔ hreflang فقط اگر en/ هم‌مسیر روی دیسک هست', RENDER.indexOf("is_file($ROOT . '/en/' . $folder . '/' . \$slug . '.html')") > -1 && RENDER.indexOf('hreflang="x-default"') > -1);
T('HREF: بدون نسخهٔ انگلیسی هیچ لینکی به ۴۰۴ ساخته نمی‌شود', RENDER.indexOf('$hreflang = \'\';') > -1);

/* ═══ ۶) بهداشت ═══ */
T('HYG: page_create همان موتور مشترک را صدا می‌زند', /case 'page_create':\s*\n\s*\/\* v[0-9.]+ \(S4\): رندر به cms_render_public_page منتقل شد \(مشترک با زمان‌بند\) \*\//.test(cmsPhp)); /* انکر بدون نسخه — مقاوم به جاروی bump */
T('HYG: بدون LS مستقیم (A10)', /localStorage\s*\./.test(cmsJs) === false);
T('HYG: بدون متن غیرفارسی جاافتاده', [cmsPhp, llmPhp, cmsJs].every(function (t) { return !/[а-яА-Я]{3}/.test(t); }));

console.log('=== tester559: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
