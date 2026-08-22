#!/usr/bin/env node
'use strict';
/* v34.7.92 — نمایش آگهی از API، شرح هوش مصنوعی، حذف CTA تکراری بنر، محتوای پروفایل/پروژه */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var php = read('api/careers.php');
var js = read('crm/careers.js');
var llm = read('api/llm.php');
var disc = read('assets/js/ptf-discover.js');
var list = read('careers/index.html');
var en = read('en/careers.html');
var view = exists('careers/view.php') ? read('careers/view.php') : '';
var ht = read('.htaccess');
var home = read('index.html');
var profile = read('about/company-profile/index.html');
var projects = read('projects/index.html');
var gate = read('_tools/uat/run-ci-gate.js');
var surplus = read('crm/surplus.js');

T('VERSION.json = v34.7.92', ver.crm_version === 'v34.7.92', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.7.92', /window\.PTF_CRM_RELEASE = 'v34\.7\.92'/.test(idx));
T('sw RELEASE = v34.7.92', sw.indexOf("RELEASE = 'v34.7.92'") > -1);
T('careers.js?v=34.7.92', /careers\.js\?v=34\.7\.92/.test(idx));

T('منوی پویا از API published با fallback status.json', disc.indexOf('api/careers.php?action=published') > -1 && disc.indexOf('careers/status.json') > -1 && disc.indexOf('nav-careers') > -1);
T('فهرست FA از API published', list.indexOf("api/careers.php?action=published") > -1 && list.indexOf('status.json') > -1);
T('فهرست EN از API published', en.indexOf("api/careers.php?action=published") > -1);
T('view.php رندر از jobs.json', view.indexOf('PTF_CAREERS_LIB') > -1 && view.indexOf('careers_job_html') > -1 && view.indexOf('careers_find') > -1);
T('include guard در careers.php', php.indexOf("defined('PTF_CAREERS_LIB')") > -1 && php.indexOf('careers_slug_from_title') > -1);
T('save_job با شکست نوشتن HTML باز هم ok می‌ماند', php.indexOf("$warn[] = $w") > -1 && php.indexOf("'warnings' => $warn") > -1);
T('rewrite صفحه آگهی به view.php', /careers\/view\.php\?slug=/.test(ht));
T('htaccess careers status.json مجاز', exists('careers/.htaccess') && read('careers/.htaccess').indexOf('status.json') > -1);

T('عنوان‌های استاندارد + سایر', js.indexOf('کارشناس فروش') > -1 && js.indexOf('مدیر فروش') > -1 && js.indexOf('حسابدار') > -1 && js.indexOf('مدیر مالی') > -1 && js.indexOf('کارشناس مهندسی') > -1 && js.indexOf('TITLE_PRESETS') > -1);
T('دکمه شرح هوش مصنوعی و تأیید انسانی', js.indexOf('jobsAiDraft') > -1 && js.indexOf('llm.php?action=jobdesc') > -1 && js.indexOf('بازبینی کنید') > -1);
T('llm jobdesc فقط ارشد', llm.indexOf("case 'jobdesc'") > -1 && /jobdesc[\s\S]{0,400}admin',\s*'chairman',\s*'ceo'/.test(llm));
T('slug خودکار از عنوان انگلیسی', php.indexOf('careers_slug_from_title') > -1 && js.indexOf('jobsSlugFromEn') > -1);

T('CTA تکراری بنر حذف شد', home.indexOf('href="suppliers/">تامین‌کننده تجهیزات صنعتی</a>') < 0 && home.indexOf('href="rfq/"') > -1 && home.indexOf('تامین‌کننده تجهیزات صنعتی') > -1);
T('پروفایل شرکت درباره سئو حرف نمی‌زند', profile.indexOf('سئو') < 0 && profile.indexOf('SEO') < 0 && profile.indexOf('موتور جستجو') < 0 && profile.indexOf('شناسه ملی') > -1);
T('صفحه پروژه‌ها درباره سئو حرف نمی‌زند', projects.indexOf('سئو') < 0 && projects.indexOf('SEO') < 0 && projects.indexOf('مدارک') > -1);
T('tester453 در گیت CI', gate.indexOf('tester453-v34.7.51-careers-publish-ai-content.js') > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1 && surplus.indexOf('function hookOfferNew') > -1);
T('نقش CRM careers سخت‌گیرانه مانده', php.indexOf("['admin', 'chairman', 'ceo']") > -1 && js.indexOf("var JOB_ROLES = ['admin', 'chairman', 'ceo']") > -1);

console.log('\n— tester453 (v34.7.92: انتشار آگهی + شرح AI + محتوای سایت) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
