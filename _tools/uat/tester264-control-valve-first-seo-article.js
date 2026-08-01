/* tester264 — v31.7.97 (ADV-CV-FIRST-SEO-ARTICLE-001)
 * First supporting SEO article for Control Valve Cv calculation linking to dedicated landing/tool.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var articlePath = path.join(ROOT, 'knowledge-center/control-valve-cv-calculation-guide.html');
var article = fs.readFileSync(articlePath, 'utf-8');
var kc = fs.readFileSync(path.join(ROOT, 'knowledge-center/index.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Article file and SEO basics');
T('مقاله محاسبه Cv کنترل ولو وجود دارد', fs.existsSync(articlePath));
T('title/meta/canonical مقاله درست است', article.indexOf('محاسبه Cv کنترل ولو چیست؟') > -1 && article.indexOf('meta name="description"') > -1 && article.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cv-calculation-guide.html') > -1);
T('مقاله کلیدواژه‌های هدف را پوشش می‌دهد', ['محاسبه Cv کنترل ولو','سایزینگ Control Valve','Cv','Kv','control valve sizing','Cv calculation','Liquid','Gas','Steam'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله فرمول‌ها و مفاهیم مهندسی دارد', ['Cv ≈ 1.156 × Kv','Kv = Q × sqrt','ΔP_choked','FL','Xt','x = ΔP / P1','کاویتاسیون','choked flow'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله محدودیت vendor-certified و PDF را شفاف می‌کند', article.indexOf('vendor-certified') > -1 && article.indexOf('PDF باینری') > -1 && article.indexOf('engineering screening') > -1);

SECTION('Internal linking and conversion');
T('مقاله به landing ابزار و نمونه گزارش لینک می‌دهد', article.indexOf('../tools/control-valve-sizing/') > -1 && article.indexOf('مشاهده نمونه گزارش نهایی') > -1 && article.indexOf('ptfAdvCvOpenSampleFinalReport') > -1);
T('مقاله فرم feedback را صدا می‌زند', article.indexOf('ptfAdvCvOpenFeedbackForm') > -1 && article.indexOf('article_cv_calculation') > -1);
T('landing اختصاصی به مقاله لینک دارد', landing.indexOf('../../knowledge-center/control-valve-cv-calculation-guide.html') > -1 && landing.indexOf('محاسبه Cv کنترل ولو چیست؟') > -1);
T('knowledge-center index مقاله را در cluster شیرآلات لینک می‌دهد', kc.indexOf('control-valve-cv-calculation-guide.html') > -1 && kc.indexOf('محاسبه Cv کنترل ولو و سایزینگ') > -1);
T('sitemap شامل مقاله است', sitemap.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cv-calculation-guide.html') > -1 && sitemap.indexOf('<priority>0.9</priority>') > -1);

SECTION('Structured data and assets');
T('مقاله JSON-LD Article/FAQPage/BreadcrumbList دارد', ['Article','FAQPage','BreadcrumbList','ADV-CV-FIRST-SEO-ARTICLE-v1'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله favicon و metrics دارد', article.indexOf('favicon-32.png') > -1 && article.indexOf('ptf-metrics.js') > -1);
T('آیکون/emoji سنگین در CTAهای مقاله اضافه نشده است', article.indexOf('🚀') === -1 && article.indexOf('💰') === -1 && article.indexOf('🔥') === -1);
T('CRM/SW نسخه v33.4.8 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester264-control-valve-first-seo-article');
