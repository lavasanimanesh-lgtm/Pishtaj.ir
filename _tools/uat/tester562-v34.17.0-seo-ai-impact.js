#!/usr/bin/env node
'use strict';
/* tester562 — v34.29.2: صفحات AI-لمس‌شده در برابر بقیه (تکمیل داشبورد KPI سئو)
   ۱) رجیستری ai-touched (۷ نقطهٔ لمس + بذر از cms_log + سقف ۱۰۰۰)
   ۲) ai_pages در gsc.php: مقایسهٔ صادقانه در محدودهٔ ۳۰ صفحهٔ برترِ اسنپ‌شات‌ها
   ۳) کارت UI: سهم کلیک/روند سهم/میانگین جایگاه/فهرست صفحات */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var gscPhp = read('api/gsc.php');
var gscJs = read('crm/gsc.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var REG = blk(cmsPhp, 'function cms_ai_file', 'function cms_psi_http') + blk(cmsPhp, 'function cms_ai_file', '/* v34.14.0 (S4/SCHED): قلاب lazy');
var SEED = blk(cmsPhp, 'function cms_ai_seed_from_log', '/* v34.14.0 (S4/SCHED): قلاب lazy');
var AIL = blk(cmsPhp, "case 'ai_list'", "case 'page_create'");
var AIP = blk(gscPhp, "case 'ai_pages'", "case 'watch_list'"); /* anker version-free */

/* ═══ ۱) رجیستری ═══ */
T('REG: ذخیره در crm/data/ai-touched.json با ساختار paths/k', REG.indexOf('ai-touched.json') > -1 && REG.indexOf("'paths' => [], 'seeded' => 0") > -1);
T('REG: ضد path-traversal و سقف ۱۰۰۰ مسیر', REG.indexOf("strpos($rel, '..') !== false") > -1 && REG.indexOf('> 1000') > -1);
T('REG: لمس در هر ۷ مسیر محتوا', ['page', "'blog/' . $slug", "'knowledge-center/' . $slug", "'products/' . $slug", "'meta'", "'alt'"].every(function (k) { return cmsPhp.indexOf("cms_ai_touch(") > -1 && cmsPhp.indexOf(k) > -1; }) && (cmsPhp.match(/cms_ai_touch\(/g) || []).length >= 7);
T('REG: page_create و sched_publish هر دو kind=page', /cms_ai_touch\(\$DATA, \$r\['rel'\], 'page'\)/.test(cmsPhp) && /cms_ai_touch\(\$DATA, \$rel, 'page'\)/.test(cmsPhp));
T('REG: alt_apply همهٔ صفحه‌های لمس‌شده را ثبت می‌کند', /foreach \(\$touched as \$relAlt\) cms_ai_touch\(\$DATA, \$relAlt, 'alt'\)/.test(cmsPhp));
T('SEED: نقشهٔ اکشن→kind شش‌تایی و فقط یک‌بار (فلگ seeded)', SEED.indexOf("'page_create' => 'page'") > -1 && SEED.indexOf("'seo_queue_apply' => 'meta'") > -1 && SEED.indexOf("empty($j['seeded'])") > -1);
T('SEED: نگاشت slug→پوشهٔ درست (blog/kc/products)', SEED.indexOf("'blog/' . $rel . '.html'") > -1 && SEED.indexOf("'knowledge-center/' . $rel . '.html'") > -1 && SEED.indexOf("'products/' . $rel . '.html'") > -1);
T('SEED: فقط refهای .html بدون ..', SEED.indexOf("substr($rel, -5) !== '.html'") > -1);
T('LIST: ai_list بذر می‌پاشد + وضعیت live هر مسیر', AIL.indexOf('cms_ai_seed_from_log($ROOT, $DATA)') > -1 && AIL.indexOf("'live' => is_file(") > -1 && AIL.indexOf('array_slice($paths, 0, 200)') > -1);

/* ═══ ۲) مقایسه (gsc.php) ═══ */
T('CMP: نرمال‌ساز مسیر (دامنه حذف + اسلش انتهایی + ریشه)', gscPhp.indexOf('function gsc_page_norm') > -1 && gscPhp.indexOf("substr(\$p, -1) === '/')") > -1);
T('CMP: کلید رجیستری هم نرمال می‌شود', AIP.indexOf('$aiSet[gsc_page_norm($rel)] = $m;') > -1);
T('CMP: تفکیک AI/بقیه در topPages هر اسنپ‌شات', AIP.indexOf('isset($aiSet[$k])') > -1);
T('CMP: جایگاه میانگین وزن‌دار با نمایش', AIP.indexOf('$aW += $po * max($im, 1)') > -1 && AIP.indexOf("round($aW / $aI, 1)") > -1);
T('CMP: خروجی روزانه aC/aI/aP و rC/rI/rP با سقف ۶۰', AIP.indexOf("'aP' => \$aI > 0") > -1 && AIP.indexOf('array_slice($days, -60)') > -1);
T('CMP: سهم کلیک AI + سهم اولین/آخرین روز', AIP.indexOf("'share' => \$all > 0") > -1 && AIP.indexOf("'shareFirst'") > -1 && AIP.indexOf("'shareLast'") > -1);
T('CMP: صفحات AI آخرین اسنپ‌شات (سقف ۱۵)', AIP.indexOf('array_slice($lastPages, 0, 15)') > -1);
T('CMP: یادداشت صادقانهٔ دامنهٔ ۳۰تایی', AIP.indexOf('۳۰ صفحهٔ برترِ هر روز') > -1);
T('CMP: بدون نوشتن — فقط خواندن اسنپ‌شات و رجیستری', AIP.indexOf('file_put_contents') === -1);

/* ═══ ۳) UI ═══ */
T('UI: ظرف gscAi کنار واچ‌لیست + بارگذاری', gscJs.indexOf('id="gscAi"') > -1 && gscJs.indexOf('gscAiLoad();') > -1);
T('UI: حالت خالی با پیام راهنما', gscJs.indexOf('پس از اولین انتشارِ صفحهٔ هوشمند') > -1);
T('UI: میله‌های سهم کلیک AI با tooltip دوبعدی', gscJs.indexOf('x.aC / (x.aC + x.rC)') > -1 && gscJs.indexOf('AI: ') > -1 && gscJs.indexOf('بقیه: ') > -1);
T('UI: روند سهم ▲/▼ با مقدار عددی', gscJs.indexOf('▲ ') > -1 && gscJs.indexOf(' shareFirst') === -1 && gscJs.indexOf('(از ') > -1);
T('UI: مقایسهٔ جایگاه رنگی AI در برابر بقیه', gscJs.indexOf('میانگین جایگاه (آخرین روز)') > -1);
T('UI: جدول صفحات هوشمند آخرین اسنپ‌شات', gscJs.indexOf('صفحهٔ هوشمند (در آخرین اسنپ‌شات)') > -1);
T('UI: یادداشت دامنه + منبع رجیستری', gscJs.indexOf('منبع: رجیستری صفحات لمس‌شده') > -1);

/* ═══ بهداشت ═══ */
T('HYG: بدون LS مستقیم (A10)', /localStorage\s*\./.test(gscJs) === false);
T('HYG: انکرهای رجیستری موجود (بدون قفل نسخه)', /v3[0-9.]+ \(S3-id\/AI-IMPACT\)/.test(cmsPhp)); /* انکر خودش هم بدون نسخه — مقاوم به جاروی bump */

console.log('=== tester562: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
