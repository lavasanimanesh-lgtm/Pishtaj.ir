/* tester258 — v31.7.97 (ADV-CV-SEO-FOUNDATION-001)
 * SEO foundation for Control Valve sizing keywords on /tools/.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var tools = fs.readFileSync(path.join(ROOT, 'tools/index.html'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');

SECTION('Control Valve SEO content');
T('بخش SEO سایزینگ کنترل ولو در /tools/ وجود دارد', tools.indexOf('id="control-valve-sizing-seo"') > -1 && tools.indexOf('سایزینگ کنترل ولو و محاسبه Cv / Kv') > -1);
T('کلمات کلیدی اصلی فارسی و انگلیسی در متن آمده‌اند', ['سایزینگ کنترل ولو','محاسبه Cv کنترل ولو','انتخاب کنترل ولو','control valve sizing','Cv calculation','کنترل ولو بخار','کنترل ولو گاز','کاویتاسیون کنترل ولو'].every(function(x){ return tools.indexOf(x) > -1; }));
T('محتوای SEO به Liquid/Gas/Steam و گزارش انگلیسی اشاره دارد', ['Liquid','Gas','Steam','گزارش انگلیسی HTML','Engineering Validation Matrix','Vendor Data Validation Matrix'].every(function(x){ return tools.indexOf(x) > -1; }));
T('FAQ فارسی درباره PDF/vendor/staff دارد', ['آیا این ابزار PDF نهایی می‌دهد؟','آیا نتیجه vendor-certified است؟','آیا پرسنل داخلی می‌توانند رایگان استفاده کنند؟'].every(function(x){ return tools.indexOf(x) > -1; }));
T('وضعیت ابزار در public page دیگر final report را غیرفعال اعلام نمی‌کند', tools.indexOf('draft، final gate، گزارش نهایی HTML انگلیسی') > -1 && tools.indexOf('پرداخت آنلاین هنوز فاز بعدی') > -1);

SECTION('Structured data');
T('JSON-LD جدید SoftwareApplication/FAQPage/TechArticle دارد', tools.indexOf('ADV-CV-SEO-FAQ-v1') > -1 && tools.indexOf('SoftwareApplication') > -1 && tools.indexOf('FAQPage') > -1 && tools.indexOf('TechArticle') > -1);
T('canonical /tools حفظ شده است', tools.indexOf('<link rel="canonical" href="https://pishtaj.ir/tools/">') > -1);
T('آیکون emoji جدید در CTAهای SEO اضافه نشده است', tools.indexOf('cv-seo-block') > -1 && tools.indexOf('🚀') === -1 && tools.indexOf('💰') === -1);
T('CRM/SW نسخه v33.4.1 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester258-control-valve-seo-foundation');
