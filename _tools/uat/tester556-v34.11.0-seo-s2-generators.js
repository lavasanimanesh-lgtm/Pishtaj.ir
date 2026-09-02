#!/usr/bin/env node
'use strict';
/* tester556 — v34.29.5 (فاز S2 سئو): مولد صفحات
   ۱) مولد صفحهٔ محصول از دیتای CRM (اسکیمای Product/Offer/FAQ/Breadcrumb + سایت‌مپ اختصاصی)
   ۲) ادیتور ریدایرکت (stub امن + بک‌آپ + بازگردانی)
   ۳) ثبت خودکار زیرنقشهٔ جدید در sitemap-index */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var llmPhp = read('api/llm.php');
var cmsJs = read('crm/cms.js');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var PC = blk(cmsPhp, "case 'product_create'", "case 'product_list'");
var PRD = blk(cmsPhp, "case 'page_redirect'", "case 'redirect_list'");
var RM = blk(cmsPhp, "case 'redirect_remove'", "case 'seo_queue_add'");
var UIPUB = blk(cmsJs, 'window.cmsProdPublish', 'S2/REDIRECT): ادیتور ریدایرکت'); /* انکر بدون نسخه - مصون از bump */

/* ═══ ۱) مولد صفحهٔ محصول — سرور ═══ */
T('S2: نگاشت محصولات به سایت‌مپ اختصاصی', cmsPhp.indexOf("'products'         => 'sitemap-products.xml'") > -1);
T('S2: زیرنقشهٔ جدید در sitemap-index ثبت می‌شود (sitemap_index_ensure)', cmsPhp.indexOf('function sitemap_index_ensure') > -1 && /function sitemap_add[\s\S]{0,900}sitemap_index_ensure/.test(cmsPhp));
T('S2: case product_create با اعتبارسنجی (عنوان/نامک/۲۰۰ حرف)', PC.indexOf('عنوان و نامک (slug) الزامی است') > -1 && PC.indexOf('متن صفحه حداقل ۲۰۰ کاراکتر') > -1);
T('S2: پاکسازی بدنه همان لیست سفید kc (حذف on* و javascript:)', PC.indexOf("strip_tags($body, '<h2><h3><h4><p><ul><ol><li>") > -1 && /javascript\s*:/i.test(PC) === false && /on\\w+\\s*=/.test(PC) === false);
T('S2: قالب از اسکلت مرکز دانش (هدر/فوتر هم‌شکل)', /case 'product_create'[\s\S]{0,2600}knowledge-center\/astm-a105\.html/.test(cmsPhp));
T('S2: اسکیمای Product + Offer فقط با قیمت مثبت', /case 'product_create'[\s\S]{0,9000}'@type' => 'Product'[\s\S]{0,500}if \(\$price > 0\)[\s\S]{0,200}'offers'/.test(cmsPhp));
T('S2: FAQPage فقط با faq غیرخالی', /if \(\$faqGraph\) \$graph\[\] = \['@type' => 'FAQPage'/.test(cmsPhp));
T('S2: BreadcrumbList سه‌سطحی (خانه/محصولات/عنوان)', PC.indexOf("'name' => 'محصولات', 'item' => 'https://pishtaj.ir/products/'") > -1);
T('S2: نشانهٔ cd محصول در متا (برای اتصال دوطرفه)', cmsPhp.indexOf('ptf-product-cd') > -1);
T('S2: بک‌آپ پیش از بازنویسی + sitemap_add در انتشار محصول', PC.indexOf("cms_backup($DATA, $ROOT, 'products/' . $slug . '.html')") > -1 && PC.indexOf('sitemap_add($url)') > -1);
T('S2: case product_list (تجزیهٔ cd + title + mtime)', /case 'product_list'[\s\S]{0,500}ptf-product-cd[\s\S]{0,300}mtime/.test(cmsPhp));
T('S2: og:type product', cmsPhp.indexOf('content="product"') > -1);

/* ═══ ۲) ادیتور ریدایرکت — سرور ═══ */
T('RD: case page_redirect با نشانه و stub امن', /case 'page_redirect'[\s\S]{0,900}ptf-redirect[\s\S]{0,400}noindex/.test(cmsPhp));
T('RD: ریدایرکت = بک‌آپ + حذف از نقشه + ثبت در رجیستری', PRD.indexOf('cms_backup($DATA, $ROOT, $from)') > -1 && PRD.indexOf("sitemap_remove('https://pishtaj.ir/' . $from)") > -1 && PRD.indexOf('cms-redirects.json') > -1);
T('RD: فقط مقصد داخلی مجاز', /case 'page_redirect'[\s\S]{0,600}فقط مقصد داخلی pishtaj\.ir مجاز است/.test(cmsPhp));
T('RD: redirect_list رکوردهای کهنه را می‌اندازد (بررسی نشانه در فایل)', /case 'redirect_list'[\s\S]{0,700}strpos\(\$c, 'ptf-redirect'\) === false/.test(cmsPhp));
T('RD: redirect_remove از بک‌آپ بازیابی + بازگشت به نقشه', RM.indexOf('cms-backups') > -1 && RM.indexOf("sitemap_add('https://pishtaj.ir/' . $from)") > -1);
T('RD: مبدأ مسیرهای حساس (404/crm) رد می‌شود', /case 'page_redirect'[\s\S]{0,400}=== '404\.html'[\s\S]{0,80}strpos\(\$from, 'crm\/'\) === 0/.test(cmsPhp));

/* ═══ ۳) llm.php — seo_product ═══ */
T('AI: case seo_product زیر گیت نقش سئو', /case 'seo_intlinks':\s*\n\s*case 'seo_product':[\s\S]{0,220}\$llmRole, \['admin', 'chairman', 'ceo', 'commercial'\]/.test(llmPhp));
T('AI: ورودی نام کالا اجباری + دیتای CRM', /seo_product'[\s\S]{0,600}\$prod\['nm'[\s\S]{0,200}نام کالا لازم است/.test(llmPhp));
T('AI: قانون «عدم اختراع قیمت/موجودی/ابعاد»', /seo_product'[\s\S]{0,3000}never invent prices, stock, dimensions/.test(llmPhp));
T('AI: خروجی JSON با intro/features/applications/faq', llmPhp.indexOf('"intro":"...","features":') > -1 && llmPhp.indexOf('{"q":"...","a":"..."}') > -1);

/* ═══ ۴) کلاینت — تب محصولات ═══ */
T('UI: تب 🛒 محصولات در نوار CMS', cmsJs.indexOf("tb('prod', '🛒 محصولات')") > -1 && cmsJs.indexOf("renderCmsProducts(el)") > -1);
T('UI: فهرست کالاها با وضعیت انتشار (اتصال با cd)', /renderCmsProducts[\s\S]{0,700}_prodSite\[w\.cd\][\s\S]{0,900}ptf_crm_products/.test(cmsJs));
T('UI: مودال مولد با فیلدهای کامل + پیش‌پرشدگی مشخصات از رکورد', cmsJs.indexOf('id="prSpecs"') > -1 && cmsJs.indexOf("['برند', r.br || '']") > -1);
T('UI: دروازهٔ بازبینی انسانی (prReviewed) الزامی', cmsJs.indexOf('id="prReviewed"') > -1 && /cmsProdPublish[\s\S]{0,600}بازبینیِ انسانی زده شود/.test(cmsJs));
T('UI: تولید AI فقط فیلدهای خالی را پر می‌کند (حفظ ویرایش دستی)', /cmsProdAi[\s\S]{0,900}function set\(id, val\)[\s\S]{0,120}if \(e && !e\.value\)/.test(cmsJs));
T('UI: تجزیهٔ مشخصات (=) و سوالات (|) در انتشار', cmsJs.indexOf("ln.indexOf('=')") > -1 && cmsJs.indexOf("ln.indexOf('|')") > -1);
T('UI: overwrite flow مثل KC', UIPUB.indexOf("d.error === 'exists'") > -1 && UIPUB.indexOf('payload.overwrite = 1') > -1);
T('UI: نشانهٔ انتشار روی رکورد CRM (siteSlug از مسیر entity)', UIPUB.indexOf('it.siteSlug = slug;') > -1 && UIPUB.indexOf("ptfEntitySaveCollection('ptf_crm_products'") > -1);
T('UI: ثبت خودکار نقشه پس از انتشار محصول', /cmsProdPublish[\s\S]{0,2200}cmsSitemapAfterPublish\(\)/.test(cmsJs));
T('UI: پیش‌نویس ماندگار فرم محصول', cmsJs.indexOf("cmsDraftRestore(PROD_FIELDS, 'prAiSt'); cmsDraftBind(PROD_FIELDS);") > -1);
T('UI: جعبهٔ ریدایرکت در تب سئو + بارگذاری خودکار', cmsJs.indexOf('cmsRedirectBox() +') > -1 && /renderCmsSeo[\s\S]{0,2200}cmsRedirectLoad\(\)/.test(cmsJs));
T('UI: افزودن/بازگردانی ریدایرکت با confirm', /cmsRedirectAdd[\s\S]{0,500}confirm\(/.test(cmsJs) && /cmsRedirectRemove[\s\S]{0,400}confirm\(/.test(cmsJs));

/* ═══ بهداشت ═══ */
T('HYG: بدون localStorage مستقیم (A10)', /localStorage\s*\./.test(cmsJs) === false);
T('HYG: بدون متن غیرفارسی جاافتاده', [cmsPhp, cmsJs, llmPhp].every(function (t) { return !/[а-яА-Я]{3}/.test(t); }));

console.log('=== tester556: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
