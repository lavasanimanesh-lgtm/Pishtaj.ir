#!/usr/bin/env node
'use strict';
/* tester558 — v34.30.0: S2-id مولد صفحهٔ عمومی + فیکس‌های توسعه‌ای سئو + زیرمنوی مدیریت سایت
   ۱) page_create عمومی (services/industries/comparisons + اسکیمای Service/Article)
   ۲) باگ‌فیکس: event صریح در cmsSeoLinkSuggest (نه global ضمنی)
   ۳) زیرمنو: ماندگاری وضعیت (ptfDevKv/A10) + هایلایت والد + بازشدن خودکار + CSS
   ۴) تب «📄 صفحهٔ جدید» با AI + بازبینی انسانی + پیش‌نویس ماندگار */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var cmsPhp = read('api/cms.php');
var cmsJs = read('crm/cms.js');
var ih = read('crm/index.html');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
/* v34.30.0: رندر به cms_render_public_page منتقل شد (مشترک با زمان‌بند S4) — پنجرهٔ انکر هم‌مسیر شد */
var PG = blk(cmsPhp, 'function cms_page_folders', 'function cms_sched_file');

/* ═══ ۱) مولد صفحهٔ عمومی — سرور ═══ */
T('GEN: سه پوشهٔ مجاز با لیبل و اسکیما', PG.indexOf("'services'") > -1 && PG.indexOf("'industries'") > -1 && PG.indexOf("'comparisons'") > -1);
T('GEN: services → Service schema با provider/areaServed', PG.indexOf("'@type' => 'Service'") > -1 && PG.indexOf("'areaServed' => 'IR'") > -1);
T('GEN: بقیه → Article', /else \{\s*\$graph\[\] = \['@type' => 'Article'/m.test(PG));
T('GEN: Breadcrumb با والدِ بخش (folderUrl)', PG.indexOf('$folderUrl') > -1 && PG.indexOf("'name' => $meta['lb'], 'item' => \$folderUrl") > -1);
T('GEN: sanitize همان لیست سفید + حداقل ۲۰۰ حرف', PG.indexOf("strip_tags($body, '<h2><h3><h4><p><ul><ol><li>") > -1 && PG.indexOf('حداقل ۲۰۰ کاراکتر لازم دارد') > -1);
T('GEN: بک‌آپ پیش از بازنویسی + sitemap_add (نگاشت خودکار زیرنقشه)', blk(cmsPhp, "case 'page_create'", 'break;').indexOf("cms_backup($DATA, $ROOT, $r['rel'])") > -1 && blk(cmsPhp, "case 'page_create'", 'break;').indexOf("sitemap_add($r['url'])") > -1);
T('GEN: پوشهٔ نامعتبر رد می‌شود', PG.indexOf('پوشهٔ مقصد نامعتبر است') > -1);
T('GEN: قالب از اسکلت مرکز دانش', PG.indexOf('knowledge-center/astm-a105.html') > -1);

/* ═══ ۲) باگ‌فیکس event ═══ */
T('FIX: cmsSeoLinkSuggest امضایش event صریح دارد', cmsJs.indexOf('window.cmsSeoLinkSuggest = function (i, ev)') > -1);
T('FIX: onclick رویداد را پاس می‌دهد', /cmsSeoLinkSuggest\(' \+ i \+ ',event\)"/.test(cmsJs));
T('FIX: fallback window.event بدون global ضمنی', cmsJs.indexOf("(typeof window.event === 'object'") > -1);

/* ═══ ۳) زیرمنوی مدیریت سایت ═══ */
T('MENU: وضعیت باز/بسته از ptfDevKv ماندگار می‌شود (A10)', cmsJs.indexOf("ptfDevKv.get('cms.sitemod.open'") > -1 && /toggleSiteMod = function[\s\S]{0,700}ptfDevKv\.set\('cms\.sitemod\.open'/.test(cmsJs));
T('MENU: هایلایت والد وقتی فرزند فعال است', cmsJs.indexOf('window.syncSiteModActive') > -1 && cmsJs.indexOf("lab.classList.add('act')") > -1);
T('MENU: بازشدن خودکار یک‌باره با فرزند فعال', /syncSiteModActive[\s\S]{0,300}if \(!siteModOpen\) toggleSiteMod\(true\)/.test(cmsJs));
T('MENU: sync سفارشی (کلاس act فقط روی فرزندِ زیرمنو)', cmsJs.indexOf("document.querySelectorAll('#smBody .sb-i')") > -1);
T('MENU: CSS والدِ فعال', ih.indexOf('.sb-n .nl.sm-h.act{color:#ffb033}') > -1);
T('MENU: زیرمنو در HTML با سه فرزند cms/gsc/jobs', ih.indexOf('id="smLabel"') > -1 && ih.indexOf("goPanel('cms',this)") > -1 && ih.indexOf("goPanel('gsc',this)") > -1 && ih.indexOf("goPanel('jobs',this)") > -1);
T('MENU: موبایل همیشه باز (CSS مهم)', /@media\(max-width:900px\)[\s\S]{0,300}#smBody\{display:block!important\}/.test(ih));
T('MENU: کلیک روی فرزند → sync از طریق delegation (بدون interval)', /document\.addEventListener\('click'[\s\S]{0,200}#smBody \.sb-i'[\s\S]{0,80}syncSiteModLabel/.test(cmsJs));
T('MENU: مقاوم در برابر matchMedia نبودن', cmsJs.indexOf('window.matchMedia &&') > -1);

/* ═══ ۴) UI تب صفحهٔ جدید ═══ */
T('UI: تب 📄 صفحهٔ جدید', cmsJs.indexOf("tb('page', '📄 صفحهٔ جدید')") > -1 && cmsJs.indexOf("renderCmsPageNew(el)") > -1);
T('UI: فرم با بخش/موضوع/مخاطب + تولید AI (seo_article)', cmsJs.indexOf('id="pgTopic"') > -1 && /cmsPageAi[\s\S]{0,600}cmsLLM\('seo_article'/.test(cmsJs));
T('UI: دروازهٔ بازبینی انسانی', cmsJs.indexOf('id="pgReviewed"') > -1 && /cmsPagePublish[\s\S]{0,600}بازبینیِ انسانی زده شود/.test(cmsJs));
T('UI: انتشار page_create + overwrite + نقشهٔ خودکار', /cmsPagePublish[\s\S]{0,900}api\('page_create'[\s\S]{0,900}payload\.overwrite = 1[\s\S]{0,500}cmsSitemapAfterPublish\(\)/.test(cmsJs));
T('UI: پیش‌نویس ماندگار فرم صفحه', cmsJs.indexOf("cmsDraftRestore(PAGE_FIELDS, 'pgAiSt'); cmsDraftBind(PAGE_FIELDS);") > -1);
T('UI: AI فقط فیلدهای خالی را پر می‌کند', /cmsPageAi[\s\S]{0,800}if \(v\.title && !g\('cmsPgTitle'\)\.value\)/.test(cmsJs));

/* ═══ بهداشت ═══ */
T('HYG: بدون LS مستقیم (A10)', /localStorage\s*\./.test(cmsJs) === false);
T('HYG: بدون متن غیرفارسی جاافتاده', [cmsPhp, cmsJs, ih].every(function (t) { return !/[а-яА-Я]{3}/.test(t); }));

console.log('=== tester558: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
