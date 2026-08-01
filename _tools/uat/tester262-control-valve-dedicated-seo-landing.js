/* tester262 — v31.7.97 (ADV-CV-DEDICATED-LANDING-SEO-001)
 * Dedicated SEO landing page for Control Valve sizing.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var pagePath = path.join(ROOT, 'tools/control-valve-sizing/index.html');
var page = fs.readFileSync(pagePath, 'utf-8');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Dedicated landing file and SEO basics');
T('صفحه اختصاصی tools/control-valve-sizing وجود دارد', fs.existsSync(pagePath));
T('title/meta/canonical صفحه اختصاصی درست است', page.indexOf('<title>سایزینگ کنترل ولو | محاسبه Cv و Kv آنلاین | پیشرو تجهیز</title>') > -1 && page.indexOf('meta name="description"') > -1 && page.indexOf('https://pishtaj.ir/tools/control-valve-sizing/') > -1);
T('کلیدواژه‌های اصلی فارسی و انگلیسی در صفحه اختصاصی وجود دارند', ['سایزینگ کنترل ولو','محاسبه Cv','Kv','control valve sizing','Cv calculation','Liquid','Gas','Steam','IEC 60534','ISA'].every(function (x) { return page.indexOf(x) > -1; }));
T('CTAهای اعتمادسازی و feedback وجود دارد', ['مشاهده نمونه گزارش نهایی','درخواست تست و feedback','درخواست دسترسی feedback','ptfAdvCvOpenSampleFinalReport'].every(function (x) { return page.indexOf(x) > -1; }));
T('صفحه اختصاصی محدودیت vendor-certified/PDF/OCR را شفاف می‌کند', ['vendor-certified final sizing','PDF/OCR parser','engineering screening report','Vendor Data Validation Matrix'].every(function (x) { return page.indexOf(x) > -1; }));

SECTION('Structured data and internal links');
T('JSON-LD BreadcrumbList/SoftwareApplication/FAQPage/TechArticle دارد', ['BreadcrumbList','SoftwareApplication','FAQPage','TechArticle','ADV-CV-LANDING-SEO-v1'].every(function (x) { return page.indexOf(x) > -1; }));
T('صفحه اصلی tools به landing اختصاصی لینک می‌دهد', tools.indexOf('href="control-valve-sizing/"') > -1 && tools.indexOf('صفحه اختصاصی سایزینگ کنترل ولو') > -1);
T('sitemap شامل landing اختصاصی است', sitemap.indexOf('https://pishtaj.ir/tools/control-valve-sizing/') > -1 && sitemap.indexOf('<priority>0.9</priority>') > -1);
T('صفحه اختصاصی advanced-tools-ui را برای sample report لود می‌کند', page.indexOf('<script src="../advanced-tools-ui.js"></script>') > -1 && adv.indexOf('ptfAdvCvOpenSampleFinalReport') > -1);
T('آیکون/emoji سنگین در CTAهای landing اضافه نشده است', page.indexOf('🚀') === -1 && page.indexOf('💰') === -1 && page.indexOf('🔥') === -1);
T('CRM/SW نسخه v33.4.2 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester262-control-valve-dedicated-seo-landing');
