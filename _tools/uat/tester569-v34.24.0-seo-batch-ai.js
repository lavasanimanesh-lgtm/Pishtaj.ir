#!/usr/bin/env node
'use strict';
/* tester569 — v34.38.0: اصلاح هوشمند گروهی سئو
   درخواست مالک: در قسمت سئو صفحات ایرادهای هر صفحه زیرش نمایش داده می‌شود؛ باید با
   یک کلیک، هوش مصنوعی کامل آنالیز و در چهارچوب قوانین سئو و سرچ کنسول گوگل اصلاح کند.
   ساختار: ویزارد گروهی = آنالیز متوالی seo_fix + اعتبارسنجی طول + بازبینی تجمیعی
   یک‌کلیکی + اعمال groupi page_meta_save (canonical/robots دست‌نخورده). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function rd(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
var cms = rd('crm/cms.js');
var llm = rd('api/llm.php');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var CORE = blk(cms, 'SEO-BATCH-FIX', 'window.cmsAiMeta = function');
var RUN = blk(cms, 'window.cmsSeoAiBatchRun = function', 'window.cmsSeoAiBatchApply = function');
var APPLY = blk(cms, 'window.cmsSeoAiBatchApply = function', 'window.cmsAiMeta = function');

/* ═══ دامنه و ورود ═══ */
T('BTN: دکمهٔ 🤖 اصلاح هوشمند گروهی در نوار ابزار سئو', cms.indexOf('onclick="cmsSeoAiBatch()"') > -1 && cms.indexOf('🤖 اصلاح هوشمند گروهی') > -1);
T('SCOPE: فقط ایرادهای متایی قابل اصلاح خودکار (۹ نوع)', CORE.indexOf("['no-desc', 'desc-long', 'desc-short', 'no-title', 'title-long', 'title-short', 'no-h1', 'h1-long', 'h1-short']") > -1);
T('SCOPE: صفحات بدون ایراد قابل‌اصلاح با پیام راهنما رد می‌شوند', CORE.indexOf('ابزار گروهی خودشان را دارند') > -1);
T('SCOPE: سقف هر اجرا = ۳۰ صفحه با هشدار ادامه', CORE.indexOf('targets.length > 30') > -1 && CORE.indexOf('هر اجرا حداکثر ۳۰ صفحه') > -1);

/* ═══ آنالیز ═══ */
T('AI: خواندن متن واقعی صفحه پیش از تحلیل (cmsPageText)', RUN.indexOf('cmsPageText(r.p.path') > -1);
T('AI: فراخوانی seo_fix با ایرادهای همان صفحه + متن', RUN.indexOf("cmsLLM('seo_fix', { issues: r.is.join('، '), content: txt }") > -1);
T('AI: آنالیز متوالی با فاصلهٔ بین فراخوانی‌ها (rate-limit)', RUN.indexOf('setTimeout(next, 120)') > -1);
T('AI: دکمهٔ ✖ توقف و پرچم cancel', CORE.indexOf('window._seoBatch.cancel=true') > -1 && RUN.indexOf('B.cancel') > -1);
T('VAL: اعتبارسنجی طول پیشنهاد (عنوان ۳۰–۶۵ / توضیح ۷۰–۱۶۵ / H1 غیرخالی)', RUN.indexOf('tl < 30 || tl > 65') > -1 && RUN.indexOf('dl < 70 || dl > 165') > -1 && RUN.indexOf('!hl') > -1);
T('VAL: پیشنهاد خارج از چهارچوب رد و برای ویرایش دستی علامت می‌خورد', RUN.indexOf('دستی ویرایش کنید') > -1);
T('PROG: نوار وضعیت صفحه‌به‌صفحه (n از m) + رندر زنده', RUN.indexOf('صفحهٔ ') > -1 && RUN.indexOf('(k + 1) + \' از \' + rows.length') > -1);

/* ═══ بازبینی و اعمال ═══ */
T('REV: جدول مقایسهٔ «اکنون» در برابر «پیشنهاد» با شمار کاراکتر رنگی', CORE.indexOf('اکنون (') > -1 && CORE.indexOf('پیشنهاد (') > -1);
T('REV: چک‌باکس حذف صفحه از دسته + تیره‌شدن ردیف', CORE.indexOf('cmsSeoAiBatchRow(') > -1 && CORE.indexOf('opacity:.55') > -1);
T('REV: دکمهٔ اعمال فقط پس از حداقل یک پیشنهاد آماده ظاهر می‌شود', RUN.indexOf("r.on && r.st === 'done'; })") > -1 && RUN.indexOf("ap.style.display = ''") > -1);
T('APPLY: تأیید یک‌بارهٔ انسانی پیش از نوشتن روی فایل‌های سایت', APPLY.indexOf('confirm(') > -1 && APPLY.indexOf('نسخهٔ پشتیبان') > -1);
T('APPLY: page_meta_save با حفظ canonical و robots صفحه (بدون تغییر)', APPLY.indexOf("canonical: r.p.canonical || ''") > -1 && APPLY.indexOf("robots: r.p.robots || ''") > -1);
T('APPLY: نتیجهٔ هر صفحه جدا گزارش می‌شود (applied/fail)', APPLY.indexOf("r.st = 'applied'") > -1 && APPLY.indexOf("r.st = 'fail'") > -1);
T('APPLY: audit یکجای اصلاح گروهی + اسکن دوبارهٔ فهرست', APPLY.indexOf('اصلاح هوشمند گروهی سئو') > -1 && APPLY.indexOf('cmsSeoRefresh();') > -1);
T('APPLY: یادآوری Request Indexing سرچ کنسول پس از اعمال', APPLY.indexOf('Request Indexing') > -1);

/* ═══ سرور — چهارچوب گوگل ═══ */
T('SRV: SEO_RULES + چارچوب Google Search Central (یکتایی/تطابق/بدون فریب)', llm.indexOf('GOOGLE SEARCH CENTRAL FRAMEWORK') > -1 && llm.indexOf('must be UNIQUE to that page') > -1 && llm.indexOf('clickbait') > -1 && llm.indexOf('no misleading') > -1);
T('SRV: خروجی اصلاحی کامل و آمادهٔ ذخیره، نه دستورالعمل', llm.indexOf('ready to save, not an instruction') > -1);
T('SRV: قوانین طول قبلی حفظ شده (۳۰–۶۵ / ۷۰–۱۶۵ / ۲۰–۷۰)', llm.indexOf('title 30-65, description 70-165, h1 20-70') > -1);

/* ═══ بهداشت ═══ */
T('HYG: بدون localStorage در بلوک جدید', CORE.indexOf('localStorage') === -1 && APPLY.indexOf('localStorage') === -1);
T('HYG: مسیر/متن پیشنهادها escP می‌شوند', CORE.indexOf("escP(r.p.path)") > -1 && CORE.indexOf('escP(pro ||') > -1);
T('HYG: مقادیر ai دست‌نخورده — دروازهٔ بازبینی انسانی فقط یک‌بار تجمیعی', APPLY.indexOf('_cmsAiTouched') === -1 && CORE.indexOf('cmsAiApplyFix') === -1);

console.log('=== tester569: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
