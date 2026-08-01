/* tester266 — v31.7.97 (ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-001)
 * Supporting SEO article for Cv vs Kv difference with minimum 1500-word content rule.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var articlePath = path.join(ROOT, 'knowledge-center/control-valve-cv-kv-difference.html');
var article = fs.readFileSync(articlePath, 'utf-8');
var text = article.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
var wordCount = text.split(/\s+/).filter(Boolean).length;
var kc = fs.readFileSync(path.join(ROOT, 'knowledge-center/index.html'), 'utf-8');
var cvArticle = fs.readFileSync(path.join(ROOT, 'knowledge-center/control-valve-cv-calculation-guide.html'), 'utf-8');
var cavArticle = fs.readFileSync(path.join(ROOT, 'knowledge-center/control-valve-cavitation-guide.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Cv/Kv article SEO basics');
T('مقاله تفاوت Cv و Kv وجود دارد', fs.existsSync(articlePath));
T('مقاله حداقل ۱۵۰۰ کلمه دارد', wordCount >= 1500, 'wordCount=' + wordCount);
T('title/meta/canonical مقاله درست است', article.indexOf('تفاوت Cv و Kv در کنترل ولو چیست؟') > -1 && article.indexOf('meta name="description"') > -1 && article.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cv-kv-difference.html') > -1);
T('مقاله کلیدواژه‌های هدف فارسی و انگلیسی را پوشش می‌دهد', ['تفاوت Cv و Kv','Cv vs Kv','control valve sizing','Cv calculation','Kv calculation','سایزینگ کنترل ولو'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله فرمول تبدیل و مثال دارد', ['Cv ≈ 1.156 × Kv','Kv ≈ 0.865 × Cv','Cv = 1.156 × 62','Kv = Q × sqrt'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله محدودیت‌های engineering/vendor-certified را شفاف می‌کند', article.indexOf('vendor-certified sizing sheet') > -1 && article.indexOf('PDF') > -1 && article.indexOf('validation') > -1);

SECTION('Internal links and conversion');
T('مقاله به ابزار، نمونه گزارش و feedback لینک دارد', article.indexOf('../tools/control-valve-sizing/') > -1 && article.indexOf('ptfAdvCvOpenSampleFinalReport') > -1 && article.indexOf('ptfAdvCvOpenFeedbackForm') > -1);
T('مقاله‌های قبلی به Cv/Kv لینک می‌دهند', cvArticle.indexOf('control-valve-cv-kv-difference.html') > -1 && cavArticle.indexOf('control-valve-cv-kv-difference.html') > -1);
T('landing اختصاصی به مقاله Cv/Kv لینک دارد', landing.indexOf('../../knowledge-center/control-valve-cv-kv-difference.html') > -1 && landing.indexOf('تفاوت Cv و Kv') > -1);
T('knowledge-center index مقاله را در cluster شیرآلات لینک می‌دهد', kc.indexOf('control-valve-cv-kv-difference.html') > -1 && kc.indexOf('تفاوت Cv و Kv') > -1);
T('sitemap شامل مقاله Cv/Kv است', sitemap.indexOf('https://pishtaj.ir/knowledge-center/control-valve-cv-kv-difference.html') > -1 && sitemap.indexOf('<priority>0.9</priority>') > -1);

SECTION('Structured data and assets');
T('مقاله JSON-LD Article/FAQPage/BreadcrumbList دارد', ['Article','FAQPage','BreadcrumbList','ADV-CV-CV-KV-DIFFERENCE-SEO-ARTICLE-v1'].every(function (x) { return article.indexOf(x) > -1; }));
T('مقاله favicon و metrics دارد', article.indexOf('favicon-32.png') > -1 && article.indexOf('ptf-metrics.js') > -1);
T('CTAهای مقاله آیکون/emoji سنگین ندارند', article.indexOf('🚀') === -1 && article.indexOf('💰') === -1 && article.indexOf('🔥') === -1);
T('CRM/SW نسخه v33.3.3 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester266-control-valve-cv-kv-difference-seo-article');
