#!/usr/bin/env node
'use strict';
/* tester566 — v34.29.5: دستیار هوش مصنوعی خارجی
   ایدهٔ مالک: برای مطلب بلند، پرامپت آمادهٔ همان موضوع ساخته شود تا از AI خارجی
   (ChatGPT/Claude/Gemini) تولید شود — و خروجی با نشانگرهای استاندارد خودکار در
   فرم توزیع گردد (بدون هیچ وابستگی به مدل سروری/JSON). */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var RULES = blk(cms, 'function cmsExtRules', 'function cmsExtModal');
var MODAL = blk(cms, 'function cmsExtModal', "window.cmsExtCopy");
var COPY = blk(cms, "window.cmsExtCopy", "window.cmsExtParse");
var PARSE = blk(cms, "window.cmsExtParse = function", 'function cmsExtFill');
var FILL = blk(cms, 'function cmsExtFill', 'window.cmsPgExtPrompt');
var PGP = blk(cms, 'window.cmsPgExtPrompt', 'window.cmsPgExtApply');
var PGA = blk(cms, 'window.cmsPgExtApply', 'window.cmsProdExtPrompt');
var PRP = blk(cms, 'window.cmsProdExtPrompt', 'window.cmsProdExtApply');
var PRA = blk(cms, 'window.cmsProdExtApply', 'window.cmsPageAi = function');

/* ═══ پرامپت ═══ */
T('PRM: قواعد مشترک — یگانه/عدم اختراع قیمت/فارسی+لاتین/تگ‌های مجاز', ['یگانه','هیچ قیمت، موجودی','لاتین بمانند','h2 h3 h4 p ul ol li'].every(function (k) { return RULES.indexOf(k) > -1; }));
T('PRM: صفحه — موضوع از فرم + بخش + مخاطب + گیت موضوع خالی', PGP.indexOf("g('pgTopic') || g('cmsPgTitle')") > -1 && PGP.indexOf('folderLb') > -1 && PGP.indexOf('مخاطب: ') > -1 && PGP.indexOf('ابتدا «موضوع برای AI»') > -1);
T('PRM: صفحه — حداقل ۱۲۰۰ کلمه + ساختار مهندسی + جدول مقایسه', PGP.indexOf('۱۲۰۰ کلمه') > -1 && PGP.indexOf('چک‌لیست خریدار') > -1 && PGP.indexOf('جدول یا لیست مقایسه‌ای') > -1);
T('PRM: نشانگرهای استاندارد با بازه‌ها در قالب خروجی', ['TITLE:', 'H1:', 'DESCRIPTION:', 'SLUG:', 'BODY:'].every(function (k) { return PGP.indexOf(k) > -1; }) && PGP.indexOf('۳۰ تا ۶۵') > -1 && PGP.indexOf('۷۰ تا ۱۶۰') > -1);
T('PRM: محصول — داده‌های واقعی کالا به‌عنوان تنها منبع + SPECS/FAQ', PRP.indexOf('تنها منبع مجاز') > -1 && PRP.indexOf('SPECS:') > -1 && PRP.indexOf('FAQ:') > -1 && PRP.indexOf('سؤال | پاسخ') > -1);
T('PRM: محصول — قالب «کلید = مقدار» برای مشخصات (هم‌شکل فرم)', PRP.indexOf('کلید = مقدار') > -1);

/* ═══ مودال/کپی ═══ */
T('UI: سه لینک ChatGPT/Claude/Gemini با rel=noopener', ['chatgpt.com', 'claude.ai', 'gemini.google.com'].every(function (k) { return MODAL.indexOf(k) > -1; }) && (MODAL.match(/rel="noopener"/g) || []).length === 3);
T('UI: راهنمای سه‌مرحله‌ای + کادر چسباندن + دکمهٔ اعمال', MODAL.indexOf('① پرامپت را کپی کن') > -1 && MODAL.indexOf('ptExtPaste') > -1 && MODAL.indexOf('اعمال در فرم') > -1);
T('UI: کپی با clipboard API + fallback انتخابی', COPY.indexOf('navigator.clipboard.writeText') > -1 && COPY.indexOf("execCommand('copy')") > -1 && COPY.indexOf('کپی خودکار نشد') > -1);
T('UI: باز و بسته شدن امن (id یکتا + حذف نمونهٔ قدیمی)', MODAL.indexOf("getElementById('ptExtModal'); if (old) old.remove();") > -1);

/* ═══ تجزیه‌گر ═══ */
T('PARSE: تک‌خطی‌ها (TITLE/H1/DESCRIPTION/SLUG) با تحمل فاصله/حالت', PARSE.indexOf('TITLE|H1|DESCRIPTION|SLUG') > -1 && PARSE.indexOf('/i') > -1);
T('PARSE: بلوکی‌ها (BODY/SPECS/FAQ) تا نشانگر بعدی یا پایان', PARSE.indexOf('BODY|SPECS|FAQ') > -1 && PARSE.indexOf('flush()') > -1);
T('PARSE: محتوای هم‌خطِ بعد از دونقطه هم پذیرفته می‌شود', PARSE.indexOf('if (rest) buf.push(rest)') > -1);
T('APPLY: گیت خروجی بی‌نشانگر با پیام فارسی', PGA.indexOf('نشانگرها پیدا نشد') > -1 && cms.indexOf('window.cmsExtErr = function') > -1); /* v34.29.5: پیام درون‌مودال به‌جای alert */
T('APPLY: slug سمت کلاینت تمیز می‌شود', PGA.indexOf("replace(/[^a-z0-9\\-]/g, '-')") > -1);
T('APPLY: فقط فیلد خالی — بازنویسی با تأیید یک‌باره', FILL.indexOf('hasFilled ? confirm(') > -1 && FILL.indexOf('فقط فیلدهای خالی پر شوند') > -1);
T('APPLY: گزارش تعداد فیلد + پیام بازبینی انسانی', FILL.indexOf('فیلد از خروجی هوش مصنوعی خارجی پر شد') > -1 && PGA.indexOf('بازبینی انسانی الزامی است') > -1 && PRA.indexOf('بازبینی انسانی الزامی است') > -1);
T('APPLY: صفحه — پیش‌نویس و شمارنده بعد از اعمال نو می‌شوند', PGA.indexOf('cmsDraftBind(PAGE_FIELDS); cmsPgCount();') > -1);
T('APPLY: محصول — هر هفت فیلد از جمله specs/faq + پیش‌نویس', PRA.indexOf("id: 'prSpecs', val: v.specs") > -1 && PRA.indexOf("id: 'prFaq', val: v.faq") > -1 && PRA.indexOf('cmsDraftBind(PROD_FIELDS);') > -1);
T('APPLY: مودال فقط پس از اعمال موفق بسته می‌شود', PGA.indexOf('if (n)') > -1 && PRA.indexOf('if (n)') > -1);
T('BTN: دکمهٔ 🌐 در فرم صفحه و مودال محصول', cms.indexOf('onclick="cmsPgExtPrompt()">🌐 هوش مصنوعی خارجی') > -1 && cms.indexOf('cmsProdExtPrompt(') > -1);

/* ═══ بهداشت ═══ */
T('HYG: بدون فراخوانی سرور (مسیر کاملاً آفلاین/بدون API)', [PGP, PGA, PRP, PRA].every(function (b) { return b.indexOf('cmsLLM(') === -1; }) && MODAL.indexOf('fetch(') === -1);
T('HYG: بدون LS مستقیم در بلوک‌های جدید', (function () { var i = 0; while ((i = cms.indexOf('cmsExt', i + 1)) > -1) { if (/localStorage\s*\./.test(cms.slice(i, i + 400))) return false; } return true; })());
T('HYG: آرگومان cd با ptfOnClickArg امن', PRP.indexOf("ptfOnClickArg(cd)") > -1);

console.log('=== tester566: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
