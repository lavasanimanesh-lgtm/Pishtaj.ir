/* tester267 — v31.7.97 (ADV-CV-TRIPLE-SEO-ARTICLE-001)
 * Publishes three 1500+ word SEO articles for the Control Valve cluster: Steam, Gas, Actuator.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var pages = [
  ['steam', 'knowledge-center/steam-control-valve-sizing-guide.html', ['سایزینگ کنترل ولو بخار','Steam control valve sizing','choked flow','low-noise trim','Xt']],
  ['gas', 'knowledge-center/gas-control-valve-sizing-guide.html', ['سایزینگ کنترل ولو گاز','Gas control valve sizing','Nm3/h','pressure ratio','Xt']],
  ['actuator', 'knowledge-center/control-valve-actuator-selection-guide.html', ['انتخاب اکچویتور کنترل ولو','Control valve actuator','Fail Close','Fail Open','shutoff pressure']]
];
var sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf-8');
var kc = fs.readFileSync(path.join(ROOT, 'knowledge-center/index.html'), 'utf-8');
var landing = fs.readFileSync(path.join(ROOT, 'tools/control-valve-sizing/index.html'), 'utf-8');
var api = fs.readFileSync(path.join(ROOT, 'api/tools.php'), 'utf-8');
var adv = fs.readFileSync(path.join(ROOT, 'tools/advanced-tools-ui.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');
function wordCount(html) { return html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length; }

SECTION('Triple SEO article files and minimum word count');
pages.forEach(function (p) {
  var html = fs.readFileSync(path.join(ROOT, p[1]), 'utf-8');
  T('مقاله ' + p[0] + ' وجود دارد', fs.existsSync(path.join(ROOT, p[1])));
  T('مقاله ' + p[0] + ' حداقل ۱۵۰۰ کلمه دارد', wordCount(html) >= 1500, 'wordCount=' + wordCount(html));
  T('مقاله ' + p[0] + ' title/meta/canonical دارد', html.indexOf('<title>') > -1 && html.indexOf('meta name="description"') > -1 && html.indexOf('rel="canonical"') > -1);
  T('مقاله ' + p[0] + ' کلمات کلیدی هدف را دارد', p[2].every(function (x) { return html.indexOf(x) > -1; }));
  T('مقاله ' + p[0] + ' به ابزار/نمونه گزارش/feedback لینک دارد', html.indexOf('../tools/control-valve-sizing/') > -1 && html.indexOf('ptfAdvCvOpenSampleFinalReport') > -1 && html.indexOf('ptfAdvCvOpenFeedbackForm') > -1);
  T('مقاله ' + p[0] + ' JSON-LD و assets دارد', html.indexOf('Article') > -1 && html.indexOf('FAQPage') > -1 && html.indexOf('BreadcrumbList') > -1 && html.indexOf('ptf-metrics.js') > -1 && html.indexOf('favicon-32.png') > -1);
});

SECTION('Cluster links and sitemap');
T('sitemap هر سه مقاله جدید را دارد', ['steam-control-valve-sizing-guide.html','gas-control-valve-sizing-guide.html','control-valve-actuator-selection-guide.html'].every(function (x) { return sitemap.indexOf(x) > -1; }));
T('knowledge-center index هر سه مقاله جدید را لینک می‌دهد', ['steam-control-valve-sizing-guide.html','gas-control-valve-sizing-guide.html','control-valve-actuator-selection-guide.html'].every(function (x) { return kc.indexOf(x) > -1; }));
T('landing کنترل ولو هر سه مقاله جدید را لینک می‌دهد', ['steam-control-valve-sizing-guide.html','gas-control-valve-sizing-guide.html','control-valve-actuator-selection-guide.html'].every(function (x) { return landing.indexOf(x) > -1; }));
T('نسخه ADV-CV-TRIPLE-SEO-ARTICLE-001 ثبت شده است', api.indexOf('ADV-CV-TRIPLE-SEO-ARTICLE-001') > -1 && adv.indexOf('ADV-CV-TRIPLE-SEO-ARTICLE-001') > -1);
T('CRM/SW نسخه v33.4.3 است', /window\.VER = 'v3[0-9.]+'/.test(idx) && /ptf-crm-v3[0-9.]+/.test(sw));

DONE('tester267-control-valve-triple-seo-articles');
