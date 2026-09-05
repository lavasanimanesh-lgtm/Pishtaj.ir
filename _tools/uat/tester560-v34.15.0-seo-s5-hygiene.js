#!/usr/bin/env node
'use strict';
/* tester560 — v34.37.4: سئوی بین‌المللی + بهداشت گروهی
   ۱) hreflang دوطرفهٔ fa ↔ en/ (idempotent + stub مستثنا + بک‌آپ)
   ۲) خود-کانونیکال‌سازی گروهی (فقط mismatch/no-canonical؛ stub مستثنا)
   ۳) alt تصویر گروهی: اسکن → بینایی AI (چندتصویری) → بازبینی → اعمال */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var llmPhp = read('api/llm.php');
var cmsJs = read('crm/cms.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var HLF = blk(cmsPhp, 'function cms_hreflang_url', 'function cms_alt_rows');
var ALTF = blk(cmsPhp, 'function cms_alt_rows', 'cms_sched_due($ROOT, $DATA)');
var HLC = blk(cmsPhp, "case 'hreflang_sync'", "case 'canonical_bulk'");
var CBC = blk(cmsPhp, "case 'canonical_bulk'", "case 'alt_scan'");
var AAC = blk(cmsPhp, "case 'alt_scan'", "case 'page_create'");
var ALTLLM = blk(llmPhp, "if ($action === 'seo_alt')", "if ($action === 'seo_meta'");
var ONCE = blk(llmPhp, 'function llm_call_once', 'function llm_call(');

/* ═══ ۱) hreflang دوطرفه ═══ */
T('HL: index.html به آدرس پوشه‌ای نگاشت می‌شود', HLF.indexOf("substr($rel, -10) === 'index.html'") > -1 && HLF.indexOf("substr($rel, 0, -10)") > -1);
T('HL: سه‌گانهٔ fa-IR + en + x-default=فارسی', HLF.indexOf('hreflang="fa-IR"') > -1 && HLF.indexOf('hreflang="en"') > -1 && /href="' \. \$faUrl \. '" \/>/.test(HLF));
T('HL: hreflangهای قبلی (هر دو ترتیب صفت) حذف می‌شوند — ضد تکرار', HLF.indexOf('حذف hreflangهای موجود') > -1 && (HLF.match(/preg_replace\(/g) || []).length >= 2 && HLF.indexOf('alternate') > -1);
T('HL: درج بعد از canonical و در نبودش قبل از </head>', HLF.indexOf("preg_match('#<link[^>]*rel=[\"\\']canonical[\"\\'][^>]*>\\s*#isu', $n, $mC, PREG_OFFSET_CAPTURE)") > -1 && HLF.indexOf("preg_replace('#</head>#isu'") > -1);
T('HL: stub ریدایرکت دست نمی‌خورد', HLF.indexOf("stripos($t, 'ptf-redirect') !== false") > -1);
T('HL: idempotent — بدون تغییر، بدون نوشتن', HLF.indexOf('trim($n) === trim($t)') > -1 && HLF.indexOf('strlen($n) > strlen($t) * 1.2 + 5000') > -1);
T('HL: بک‌آپ پیش از نوشتن', HLF.indexOf('cms_backup($DATA, $ROOT, $rel);') > -1);
T('HL: فقط جفت‌های موجود؛ شمارش en-only', HLC.indexOf("strpos($en, 'en/') !== 0") > -1 && HLC.indexOf('$enOnly++;') > -1 && HLC.indexOf("'pairs' => $pairs") > -1);
T('HL: هر دو طرف هم‌روز می‌شوند و کش سئو نو می‌شود', HLC.indexOf('cms_hreflang_apply_file($ROOT, $DATA, $fa,') > -1 && HLC.indexOf('cms_hreflang_apply_file($ROOT, $DATA, $en,') > -1 && HLC.indexOf("unlink($DATA . '/cms-seo-scan.json')") > -1);
T('HL: لاگ فقط وقتی تغییر واقعی است', HLC.indexOf("cms_log('hreflang_sync'") > -1 && HLC.indexOf("if ($changed)") > -1);
T('HL: UI کارت + دکمهٔ همگام‌سازی', cmsJs.indexOf('hreflang دوطرفه (fa ↔ en)') > -1 && cmsJs.indexOf('cmsHlSync()') > -1);

/* ═══ ۲) canonical گروهی ═══ */
T('CAN: فقط صفحات با mismatch/no-canonical هدف می‌شوند', CBC.indexOf("in_array('canonical-mismatch', $issues, true)") > -1 && CBC.indexOf("in_array('no-canonical', $issues, true)") > -1);
T('CAN: stub ریدایرکت (canonical عمدی) مستثنا', CBC.indexOf("stripos($t, 'ptf-redirect') !== false") > -1 && CBC.indexOf('$skipped++; continue;') > -1);
T('CAN: آدرس خودی + حالت پوشه‌ای index.html', CBC.indexOf("substr($rel, -10) === 'index.html'") > -1);
T('CAN: جایگزینی canonical موجود یا درج پس از </title>', CBC.indexOf("preg_replace('#<link[^>]*rel=[\"\\']canonical[\"\\'][^>]*>#isu', $new, $t, 1)") > -1 && CBC.indexOf("'</title>' . \"\\n\" . $new") > -1);
T('CAN: بک‌آپ + سقف ۶۰ + بی‌اعتبارسازی کش + لاگ', CBC.indexOf('cms_backup($DATA, $ROOT, $rel);') > -1 && CBC.indexOf('count($fixed) >= 60') > -1 && CBC.indexOf("cms_log('canonical_bulk'") > -1);
T('CAN: UI دکمهٔ گروهی در تولبار سئو', cmsJs.indexOf('cmsCanonBulk()') > -1 && cmsJs.indexOf('canonical گروهی') > -1);
T('CAN: UI تأیید دو مرحله‌ای قبل از اجرا', /cmsCanonBulk[\s\S]{0,400}confirm\(/.test(cmsJs));

/* ═══ ۳) alt گروهی ═══ */
T('ALT: اسکن فقط نبودِ صفتِ alt (alt خالی تزئینی درست است)', ALTF.indexOf("preg_match('#\\\\balt\\\\s*=#isu', $tag)") > -1 || ALTF.indexOf("preg_match('#\\balt\\s*=#isu', $tag)") > -1);
T('ALT: data:/javascript: رد می‌شوند', ALTF.indexOf("strpos($src, 'data:') === 0") > -1 && ALTF.toLowerCase().indexOf('javascript:') > -1);
T('ALT: نرمال‌سازی قطعه‌ای مسیر (array_pop برای ..)', ALTF.indexOf("if ($seg === '..') { array_pop($segs); continue; }") > -1);
T('ALT: گیت حجم/پسوند ≤ 3MB روی دیسک', ALTF.indexOf('3 * 1048576') > -1 && ALTF.indexOf('(jpe?g|png|webp|gif)') > -1);
T('ALT: سقف ۶۰ ردیف اسکن', ALTF.indexOf('$cap = 60') > -1);
T('ALT: اعمال — سقف ۴۰ + پاکسازی متن (بدون نقل‌قول/تگ، ۱۶۰ حرف)', AAC.indexOf('count($items) > 40') > -1 && AAC.indexOf('str_replace([\'"\', \'<\', \'>\', "\\n", "\\r"]') > -1 && AAC.indexOf('0, 160, \'UTF-8\'') > -1);
T('ALT: مسیر صفحه با seo_queue_valid_path گیت می‌شود', AAC.indexOf('seo_queue_valid_path($ROOT, $page)') > -1);
T('ALT: افزودن/تصحیح alt روی اولین تگِ همان src + بک‌آپ یک‌بارهٔ هر صفحه', AAC.indexOf('preg_replace_callback') > -1 && AAC.indexOf('in_array($okp, $touched, true)') > -1 && AAC.indexOf("cms_log('alt_apply'") > -1);
T('ALT/LLM: seo_alt حداکثر ۸ تصویر + realpath زیر ریشهٔ سایت', ALTLLM.indexOf('count($imgs) > 8') > -1 && ALTLLM.indexOf('strpos($rp, realpath($ROOTL)) !== 0') > -1);
T('ALT/LLM: mime-map چهارگانه + خواندن از دیسک سرور', ALTLLM.indexOf('image/webp') > -1 && ALTLLM.indexOf('image/gif') > -1 && ALTLLM.indexOf('file_get_contents($rp)') > -1);
T('ALT/LLM: پاسخ JSON با همان ترتیب srcها', ALTLLM.indexOf('SAME order as given') > -1 && ALTLLM.indexOf('implode(\' | \', $srcs)') > -1);
/* v34.37.4 (AI-JSON-REPAIR): همان قراردادِ چندتصویر (opts.images/$pack) پابرجاست، ولی
   اکشن از llm_call تک‌ضربه به llm_call_json (salvage+retry) رفت و سقف توکن از ۹۰۰ به
   ۱۸۰۰ بالا رفت — ۹۰۰ توکن برای ۸ متن جایگزین فارسی عملاً همیشه پاسخ را می‌برید و
   خطای «خروجی AI ساختار JSON معتبر ندارد» می‌ساخت. */
T('ALT/LLM: فراخوانی با چندتصویر (opts.images) و مسیر مقاوم JSON (سقف ۱۸۰۰)', ALTLLM.indexOf("llm_call_json($cfg, $sys, $user, null, null, 1800, ['images' => $pack])") > -1);
T('IMG-LLM: gemini چند تصویر می‌پذیرد', ONCE.indexOf("foreach ((array)($opts['images'] ?? []) as $imI)") > -1 && ONCE.indexOf("['inline_data' => ['mime_type' => $imI[1] ?? 'image/jpeg'") > -1);
T('IMG-LLM: openai هم چند image_url می‌سازد', ONCE.indexOf("'type' => 'image_url'") > -1 && ONCE.indexOf('data:\' . ($imI[1] ?? \'image/jpeg\')') > -1);
T('IMG-LLM: تصاویر در کلید کش می‌آیند (ضد تصادم پاسخ‌ها)', ONCE.indexOf("hash('sha256', json_encode($opts['images']))") > -1);
T('ALT/UI: اسکن → جدول با چک‌باکس → دسته‌های ۸تایی → تیک بازبینی → اعمال', cmsJs.indexOf('cmsAltScan()') > -1 && cmsJs.indexOf('i += 8') > -1 && cmsJs.indexOf('id="altRv"') > -1 && cmsJs.indexOf('cmsAltApply()') > -1);
T('ALT/UI: AI فیلد پرشده را بازنویسی نمی‌کند', cmsJs.indexOf('if (inp && !inp.value)') > -1);

/* ═══ بهداشت ═══ */
T('HYG: توابع جدید پیش از قلاب lazyاند (قلاب بلافاصله پیش از switch)', /function cms_hreflang_url[\s\S]{0,9000}cms_sched_due\(\$ROOT, \$DATA\);\s*\n\s*switch \(\$action\)/.test(cmsPhp));
T('HYG: بدون LS مستقیم (A10)', /localStorage\s*\./.test(cmsJs) === false);
T('HYG: بدون متن غیرفارسی جاافتاده', [cmsPhp, llmPhp, cmsJs].every(function (t) { return !/[а-яА-Я]{3}/.test(t) && t.indexOf('usable') === -1; }));

console.log('=== tester560: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
