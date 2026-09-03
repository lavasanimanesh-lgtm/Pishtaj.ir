#!/usr/bin/env node
'use strict';
/* tester571 — v34.35.0: ریشه‌کنی پنج علامت جریان محصول (بازخورد پروداکشن پس از دیپلوی)
   ① تصویر آپلودی در پیش‌نمایش بود ولی در صفحهٔ منتشرشده نه → تصویر مرئی در رندر
   ② پیش‌نمایش خوب اما صفحهٔ منتشرشده ظاهر متفاوت → پیش‌نمایش سروری (همان رندر)
   ③ عبارات اضافی بالای صفحه → حذف پاراگراف نخستِ تکراری H1/عنوان + قاعدهٔ پرامپت
   ④ تکرار جدول مشخصات/FAQ (دوباره‌گویی متن AI + قالب) → DEDUP + کپ مقدار خام ۱۶۰
   ⑤ محصول در صفحهٔ محصولات ساخته نمی‌شد (پوشه بدون index) → بازسازی فهرست
   ⑥ محتوای RFQ-مانند → قواعد راهنمای فنی + پاکسازی ارجاع‌های داخلی. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function rd(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
var cms = rd('crm/cms.js');
var php = rd('api/cms.php');
var llm = rd('api/llm.php');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var SEG = blk(php, "case 'product_create':", 'GENERIC-PAGE');
var IDXFN = blk(php, 'function cms_products_index_rebuild', '$action = $_REQUEST');
var PRVFN = blk(cms, 'window.cmsPrPreview = function', 'window.cmsPrPreviewLocal = function');
var EXTP = blk(cms, 'window.cmsProdExtPrompt = function', 'window.cmsProdExtApply = function');

/* ═══ ① تصویر مرئی در صفحه ═══ */
T('IMG: تصویر در صفحهٔ محصول — کارت هیرو (و بالای متن در حالت بازگشت)', SEG.indexOf('IMG-VIS') > -1 && SEG.indexOf('$imgHero = $imgTag0;') > -1 && SEG.indexOf("'<p style=\"text-align:center;margin:4px 0 18px\">' . $imgTag0") > -1); /* v34.35.0 (CMS-FIX R2) */
T('R2: قالب محصولات از صفحهٔ مرجع بخش (هیروی تیره + سایدبار + بردکرامب)', SEG.indexOf('cms_product_skeleton($ROOT)') > -1 && SEG.indexOf('ptf-product-hero') > -1 && SEG.indexOf('<aside class="ptf-side">') > -1 && SEG.indexOf('ptf-breadcrumb') > -1);
T('IMG: alt از H1 + max-width واکنش‌گرا', SEG.indexOf('alt="\' . $hEsc') > -1 && SEG.indexOf('max-width:560px;width:100%') > -1);

/* ═══ ② پیش‌نمایش سروری ═══ */
T('PRV: اکشن product_preview همان case را با پرچم preview می‌راند (بدون نوشتن)', SEG.indexOf("case 'product_preview':") > -1 && SEG.indexOf("$preview = ($action === 'product_preview');") > -1);
T('PRV: خروجی html کامل + url — بدون backup/sitemap/write', SEG.indexOf("jok(['html' => $html, 'url' => 'products/'") > -1 && SEG.indexOf('if ($preview) jok') > -1);
T('PRV: کلاینت iframe srcdoc با base href (استایل واقعی سایت)', PRVFN.indexOf("api('product_preview'") > -1 && PRVFN.indexOf('<base href="/">') > -1 && PRVFN.indexOf('srcdoc') > -1);
T('PRV: دکمه‌های 📱 موبایل / 🖥 دسکتاپ', PRVFN.indexOf('📱 موبایل') > -1 && PRVFN.indexOf('🖥 دسکتاپ') > -1);
T('PRV: جایگزین محلی در صورت خطای سرور (cmsPrPreviewLocal)', PRVFN.indexOf('cmsPrPreviewLocal(); return;') > -1 && cms.indexOf('window.cmsPrPreviewLocal = function') > -1);
T('PRV: escape کامل srcdoc (نقل‌قول)', PRVFN.indexOf("escP(html).replace(/\"/g, '&quot;')") > -1);

/* ═══ ③ عبارات اضافی بالای صفحه ═══ */
T('TIDY: پاراگراف/تیتر نخستِ برابر H1 یا عنوان حذف می‌شود', SEG.indexOf('PROD-TIDY') > -1 && SEG.indexOf('$tP === $h1 || $tP === $title') > -1);
T('TIDY: قاعدهٔ پرامپت — شروع بدون خط تکراری نام محصول', llm.indexOf('Do NOT open the body with a standalone line repeating the product name') > -1);

/* ═══ ④ تکرار سکشن‌ها + دامپ خام ═══ */
T('DEDUP: جدول مشخصات قالب فقط وقتی متن خودش جدول ندارد', SEG.indexOf('$hasSpecsInBody') > -1 && SEG.indexOf('!$hasSpecsInBody && is_array($specs)') > -1);
T('DEDUP: FAQ قالب و اسکیمای FAQPage فقط وقتی متن FAQ ندارد', SEG.indexOf('$hasFaqInBody') > -1 && SEG.indexOf('!$hasFaqInBody && is_array($faq)') > -1);
T('DEDUP: مقدار خام مشخصه به ۱۶۰ نویسه کپ می‌شود', SEG.indexOf('0, 160); /* v34.26.0') > -1);
T('DEDUP: فرم کلاینت سطر استاندارد بلند (>۱۲۰) را پیش‌پر نمی‌کند', cms.indexOf("!(x[0] === 'استاندارد' && String(x[1]).length > 120)") > -1);

/* ═══ ⑤ فهرست محصولات ═══ */
T('IDX: بازسازی products/index.html با کارت از متای هر صفحهٔ محصول', IDXFN.indexOf('ptf-product') > -1 && IDXFN.indexOf('og:image') > -1 && IDXFN.indexOf('محصولات و راهنمای فنی کالاها') > -1);
T('IDX: جدیدترین اول (usort بر filemtime) + grid کارت واکنش‌گرا', IDXFN.indexOf("return $b['m'] <=> $a['m'];") > -1 && IDXFN.indexOf('repeat(auto-fill,minmax(230px,1fr))') > -1);
T('IDX: فراخوانی پس از هر انتشار + لاگ', SEG.indexOf('cms_products_index_rebuild($ROOT, $DATA, $header, $cta, $footer, $skStyle)') > -1 && IDXFN.indexOf("cms_log('products_index'") > -1); /* v34.35.0: پارامتر ششم = استایل درون‌خطی اسکلت */
T('IDX: هدر/CTA/فوتر همان قالب سایت + canonical و robots', IDXFN.indexOf('$header') > -1 && IDXFN.indexOf('$cta') > -1 && IDXFN.indexOf('https://pishtaj.ir/products/') > -1);

/* ═══ ⑥ محتوای راهنمای فنی (نه RFQ) ═══ */
T('AI: قاب «TECHNICAL PRODUCT GUIDE» نه قلم کالای داخلی', llm.indexOf('TECHNICAL PRODUCT GUIDE') > -1 && llm.indexOf('NOT a listing page for an internal stock item') > -1);
T('AI: حذف صریح RFQ/کد پیگیری/سفارش از محتوا', llm.indexOf('IGNORE and NEVER mention RFQ numbers') > -1);
T('AI: پاکسازی دادهٔ خام سرور (st/md کپ ۱۶۰، ds کپ ۴۰۰)', llm.indexOf("($k === 'ds') ? 400 : 160") > -1 && llm.indexOf("RFQ|ION|PTRN|PTF") > -1);
T('AI: پرامپت خارجی هم ارجاع داخلی را ممنوع می‌کند', EXTP.indexOf('متعلق به محتوا نیست') > -1 && EXTP.indexOf('RFQ، کد پیگیری') > -1);
T('AI: ساختار راهنمای فنی در پرامپت خارجی (۸۰۰ کلمه/معیار انتخاب/نگهداری/مدارک)', EXTP.indexOf('راهنمای فنی محصول') > -1 && EXTP.indexOf('حداقل ۸۰۰ کلمه') > -1 && EXTP.indexOf('چک‌لیست مدارک') > -1);
T('AI: پاک‌ساز دادهٔ کلاینت cmsProdClean (RFQ/بلندی)', cms.indexOf('function cmsProdClean(') > -1 && cms.indexOf("cmsProdClean(r.st, 160)") > -1 && cms.indexOf('cmsProdClean(r.ds, 400)') > -1);

/* ═══ بهداشت ═══ */
T('HYG: مسیر انتشار دست‌نخورده (backup/sitemap/cms_ai_touch/audit)', SEG.indexOf('cms_backup($DATA, $ROOT') > -1 && SEG.indexOf('sitemap_add($url)') > -1 && SEG.indexOf('cms_ai_touch') > -1);
T('HYG: گیت بازبینی انسانی انتشار سرجاست (prReviewed)', cms.indexOf("document.getElementById('prReviewed')") > -1);

console.log('=== tester571: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
