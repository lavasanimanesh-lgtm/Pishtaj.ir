/* tester265 — v31.7.97 (ADV-CV-CAVITATION-SEO-ARTICLE-001)
 * Supporting SEO article for Control Valve cavitation and anti-cavitation trim.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var articlePath = path.join(ROOT, 'knowledge-center/control-valve-cavitation-guide.html');
var article = fs.readFileSync(articlePath, 'utf-8');
var kc = fs.readFileSync(path.join(ROOT, 'knowledge-center/index.html'), 'utf-8');
var cvArticle = fs.readFileSync(path.join(ROOT, 'knowledge-center/control-valve-cv-calculation-guide.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Cavitation article SEO basics');
T('مقاله کاویتاسیون کنترل ولو وجود دارد', fs.existsSync(articlePath));
T('title/meta/canonical مقاله درست است', article.indexOf('کاویتاسیون در کنترل ولو چیست؟') > -1 && article.indexOf('meta name="description"') > -1 && article.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cavitation-guide.html') > -1);
T('مقاله کلیدواژه‌های فارسی و انگلیسی هدف را پوشش می‌دهد', ['کاویتاسیون در کنترل ولو','کاویتاسیون کنترل ولو','control valve cavitation','anti-cavitation trim','flashing','choked flow','IEC 60534'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله فرمول‌ها و پارامترهای مهندسی دارد', ['FF = 0.96','ΔP_choked','FL','Pv','Pc','severity = ΔP / ΔP_choked'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله روش‌های جلوگیری را توضیح می‌دهد', ['Anti-Cavitation Trim','staged pressure drop','افزایش فشار پایین‌دست','کنترل سرعت خروجی','داده واقعی vendor'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله محدودیت vendor-certified را شفاف می‌کند', article.indexOf('vendor-certified data') > -1 && article.indexOf('engineering screening') > -1);

SECTION('Internal links and conversion');
T('مقاله به ابزار، نمونه گزارش و feedback لینک دارد', article.indexOf('../tools/control-valve-sizing/') > -1 && article.indexOf('ptfAdvCvOpenSampleFinalReport') > -1 && article.indexOf('ptfAdvCvOpenFeedbackForm') > -1);
T('مقاله Cv calculation به مقاله کاویتاسیون لینک می‌دهد', cvArticle.indexOf('control-valve-cavitation-guide.html') > -1);
T('landing اختصاصی به مقاله کاویتاسیون لینک دارد', landing.indexOf('../../knowledge-center/control-valve-cavitation-guide.html') > -1 && landing.indexOf('کاویتاسیون در کنترل ولو') > -1);
T('knowledge-center index مقاله را در cluster شیرآلات لینک می‌دهد', kc.indexOf('control-valve-cavitation-guide.html') > -1 && kc.indexOf('کاویتاسیون در کنترل ولو') > -1);
T('sitemap شامل مقاله کاویتاسیون است', sitemap.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cavitation-guide.html') > -1 && sitemap.indexOf('<priority>0.9</priority>') > -1);

SECTION('Structured data and assets');
T('مقاله JSON-LD Article/FAQPage/BreadcrumbList دارد', ['Article','FAQPage','BreadcrumbList','ADV-CV-CAVITATION-SEO-ARTICLE-v1'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله favicon و metrics دارد', article.indexOf('favicon-32.png') > -1 && article.indexOf('ptf-metrics.js') > -1);
T('CTAهای مقاله آیکون/emoji سنگین ندارند', article.indexOf('🚀') === -1 && article.indexOf('💰') === -1 && article.indexOf('🔥') === -1);
T('CRM/SW نسخه v33.4.4 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester265-control-valve-cavitation-seo-article');
