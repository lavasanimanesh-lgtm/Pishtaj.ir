#!/usr/bin/env node
'use strict';
/* v34.8.30 — فرصت شغلی سایت و CRM: PDF ۵MB، OTP+کپچا، منوی پویا، نقش ارشد */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var shell = read('crm/shell.js');
var man = JSON.parse(read('crm/manifest.json'));
var clr = read('crm/clear-cache.html');
var sd = read('api/sales-domain.php');
var php = read('api/careers.php');
var js = read('crm/careers.js');
var apply = read('assets/js/ptf-careers-apply.js');
var disc = read('assets/js/ptf-discover.js');
var guard = read('assets/js/ptf-guard.js');
var list = read('careers/index.html');
var en = read('en/careers.html');
var st = JSON.parse(read('careers/status.json'));
var hta = read('api/.htaccess');
var surplus = read('crm/surplus.js');
var gate = read('_tools/uat/run-ci-gate.js');

T('VERSION.json = v34.8.30', ver.crm_version === 'v34.8.30', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.8.30', /window\.PTF_CRM_RELEASE = 'v34\.8\.30'/.test(idx));
T('sw RELEASE/ASSET/CACHE = 34.8.30', sw.indexOf("RELEASE = 'v34.8.30'") > -1 && sw.indexOf("ASSET_VERSION = '34.8.30'") > -1 && sw.indexOf("CACHE = 'ptf-crm-v34.8.30'") > -1);
T('shell fallback نسخه 34.8.30', shell.indexOf("'v34.8.30'") > -1);
T('manifest.version = 34.8.30', man.version === '34.8.30', man.version);
T('clear-cache VER = v34.8.30', clr.indexOf("window.VER = 'v34.8.30'") > -1 && clr.indexOf('v34.8.30') > -1);
T('sales-domain SD_SERVICE_VERSION = 34.8.30', sd.indexOf("SD_SERVICE_VERSION = '34.8.30'") > -1);
T('tester451 پین v34.7.49 مانده', exists('_tools/uat/tester451-v34.7.49-offer-surplus-compact-hint.js') && read('_tools/uat/tester451-v34.7.49-offer-surplus-compact-hint.js').indexOf('v34.7.49') > -1);

T('api/careers.php موجود است', exists('api/careers.php'));
T('crm/careers.js موجود است', exists('crm/careers.js'));
T('careers/status.json count=0', st.count === 0 && Array.isArray(st.jobs) && st.jobs.length === 0);
T('صفحه فهرست careers/index.html', exists('careers/index.html') && list.indexOf('در حال حاضر فرصت شغلی فعال نیست') > -1);
T('فهرست EN', exists('en/careers.html') && en.indexOf('#en') > -1);
T('فرم عمومی بدون آگهی ساخته نشده', list.indexOf('jobApplyForm') < 0 && list.indexOf('name="resume"') < 0);

T('PDF سقف ۵ مگابایت', php.indexOf('5 * 1048576') > -1 && php.indexOf("%PDF") > -1 && apply.indexOf('5 * 1048576') > -1);
T('کپچا و OTP در apply', php.indexOf('careers_captcha_ok') > -1 && php.indexOf('careers_otp_ok') > -1 && php.indexOf("jerr('otp', 403)") > -1);
T('honeypot website', php.indexOf("$_POST['website']") > -1);
T('آپلود ابری careers-resume', php.indexOf("ptf_storage_put_uploaded_file") > -1 && php.indexOf('careers-resume') > -1);
T('retention ۱۸۰ روز', php.indexOf('$RETENTION_DAYS = 180') > -1 && php.indexOf('careers_purge_apps') > -1);
T('بستن = published false نه حذف', php.indexOf("case 'close_job'") > -1 && php.indexOf("این فرصت شغلی بسته شده است") > -1 && php.indexOf('noindex') > -1);

T('مدرک std5', php.indexOf("'diploma'") > -1 && php.indexOf("'associate'") > -1 && php.indexOf("'bachelor'") > -1 && php.indexOf("'master'") > -1 && php.indexOf("'phd'") > -1);
T('سابقه r5', php.indexOf("'lt1'") > -1 && php.indexOf("'y1_3'") > -1 && php.indexOf("'y3_5'") > -1 && php.indexOf("'y5_10'") > -1 && php.indexOf("'gt10'") > -1);
T('حقوق بازه‌ای + سایر بدون متن آزاد', php.indexOf("'15_20'") > -1 && php.indexOf("'20_25'") > -1 && php.indexOf("'25_30'") > -1 && php.indexOf("'gt30'") > -1 && php.indexOf("'other'") > -1 && php.indexOf('salary_other') < 0);

T('نقش CRM فقط admin/chairman/ceo', php.indexOf("['admin', 'chairman', 'ceo']") > -1 && js.indexOf("var JOB_ROLES = ['admin', 'chairman', 'ceo']") > -1);
T('auth توکن نه X-CRM-Role اجباری سمت سرور', php.indexOf('auth_get_header_token') > -1 && php.indexOf('auth_verify_token') > -1 && php.indexOf('X-CRM-Role') < 0);
T('پنل jobs در سایدبار و GROUPS', idx.indexOf("goPanel('jobs'") > -1 && idx.indexOf('فرصت شغلی') > -1 && shell.indexOf("'jobs'") > -1);
T('careers.js در index و SHELL بعد از cms', /cms\.js\?v=34\.8\.30/.test(idx) && /careers\.js\?v=34\.8\.30/.test(idx) && sw.indexOf("./cms.js") < sw.indexOf("./careers.js"));
T('منوی پویا از status.json', disc.indexOf('careers/status.json') > -1 && disc.indexOf('nav-careers') > -1 && disc.indexOf('ensureCareersLink') > -1);
T('ptf-guard مسیر API بر اساس depth', guard.indexOf('var depth = parts.length') > -1 && guard.indexOf("api/crm.php") > -1);
T('careers در allow-list htaccess', hta.indexOf('|careers)') > -1 || hta.indexOf('|careers\\)') > -1 || /careers/.test(hta));
T('tester452 در گیت CI', gate.indexOf('tester452-v34.7.50-careers-site-crm.js') > -1 && gate.indexOf("'crm/careers.js'") > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1 && surplus.indexOf('function hookOfferNew') > -1);
T('دوزبانه FA+EN روی یک صفحه آگهی', php.indexOf('id="en"') > -1 && php.indexOf('titleEn') > -1 && php.indexOf('bodyEn') > -1);
T('PII جدا از سینک فروش', php.indexOf('ptf_crm_rfqs') < 0 && php.indexOf('data_push') < 0 && js.indexOf('setData(') < 0);

console.log('\n— tester452 (v34.8.30: فرصت شغلی سایت و CRM) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
