#!/usr/bin/env node
'use strict';
/* v34.26.0 — اسکیمای کامل JobPosting برای رفع خطای GSC:
   datePosted (الزامی/قرمز) + validThrough/employmentType/identifier/directApply
   (توصیه‌شده/زرد) + baseSalary اختیاری. publishedAt در save_job/reopen_job نگه‌داری
   می‌شود تا datePosted واقعی و پایدار باشد. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');
var sw = read('crm/sw.js');
var php = read('api/careers.php');
var cj = read('crm/careers.js');
var gate = read('_tools/uat/run-ci-gate.js');
var surplus = read('crm/surplus.js');

/* ---------- نسخه ---------- */
T('VERSION.json = v34.26.0', ver.crm_version === 'v34.26.0', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.26.0', idx.indexOf("window.PTF_CRM_RELEASE = 'v34.26.0'") > -1);
T('sw RELEASE = v34.26.0', sw.indexOf("RELEASE = 'v34.26.0'") > -1);
T('careers.js cache-bust 34.26.0', /careers\.js\?v=34\.26.0/.test(idx));

/* ---------- فیلد الزامی: datePosted ---------- */
T('LD شامل datePosted است', php.indexOf("'datePosted' => date('Y-m-d', $postedTs)") > -1);
T('datePosted از publishedAt با fallback createdAt/updatedAt', php.indexOf("$job['publishedAt'] ?? ''") > -1 && php.indexOf("$posted = (string)($job['createdAt'] ?? '')") > -1);
T('save_job برای آگهی منتشرشده publishedAt می‌نویسد', php.indexOf("if ($published && empty($j['publishedAt'])) $j['publishedAt'] = $now") > -1);
T('آگهی جدید publishedAt دارد', php.indexOf("'publishedAt' => $published ? $now : ''") > -1);
T('reopen_job تاریخ انتشار را تازه می‌کند', php.indexOf("if ($action === 'reopen_job') $j['publishedAt'] = date('c')") > -1);

/* ---------- فیلدهای توصیه‌شده (اخطارهای زرد) ---------- */
T('validThrough = ۹۰ روز بعد از انتشار', php.indexOf("'validThrough' => date('c', $postedTs + 90 * 86400)") > -1);
T('employmentType با whitelist و پیش‌فرض FULL_TIME', php.indexOf("$EMP_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'OTHER']") > -1 && php.split("$empType = 'FULL_TIME'").length >= 3);
T('identifier از نوع PropertyValue', php.indexOf("'identifier' => ['@type' => 'PropertyValue'") > -1);
T('directApply = true (فرم روی همان صفحه)', php.indexOf("'directApply' => true") > -1);
T('لوگوی hiringOrganization', php.indexOf("'logo' => 'https://pishtaj.ir/assets/images/ptf-logo.png'") > -1);
T('description دیگر به ۴۰۰ کاراکتر بریده نمی‌شود', php.indexOf("careers_clean($job['bodyFa'] ?? '', 5000)") > -1 && php.indexOf("careers_clean($job['bodyFa'] ?? '', 400)") === -1);

/* ---------- baseSalary اختیاری (تومان → ریال) ---------- */
T('baseSalary فقط با مقدار واردشده', php.indexOf("if ($salMin > 0 || $salMax > 0)") > -1 && php.indexOf("$ldArr['baseSalary'] = ['@type' => 'MonetaryAmount', 'currency' => 'IRR'") > -1);
T('تبدیل تومان به ریال (×۱۰)', php.indexOf('$salMin * 10') > -1 && php.indexOf('$salMax * 10') > -1);
T('ارقام فارسی در حقوق پذیرفته می‌شود', php.indexOf("careers_digits($job['salaryMinToman']") > -1);

/* ---------- اسکیما فقط برای آگهی باز ---------- */
var ldPos = php.indexOf("'@type' => 'JobPosting'");
var openGuard = php.lastIndexOf('if ($open) {', ldPos);
T('LD فقط داخل گارد $open ساخته می‌شود (آگهی بسته → noindex بدون اسکیمای منقضی)', ldPos > -1 && openGuard > -1 && ldPos - openGuard < 900);

/* ---------- فرم CRM ---------- */
T('فرم CRM: کشویی نوع همکاری (cjEmpType)', cj.indexOf("id=\"cjEmpType\"") > -1 && cj.indexOf("'FULL_TIME'") > -1);
T('فرم CRM: بازه حقوق اختیاری (cjSalMin/cjSalMax)', cj.indexOf('cjSalMin') > -1 && cj.indexOf('cjSalMax') > -1);
T('jobsSave فیلدهای جدید را می‌فرستد', cj.indexOf('employmentType:') > -1 && cj.indexOf('salaryMinToman:') > -1 && cj.indexOf('salaryMaxToman:') > -1);

/* ---------- بهداشت ---------- */
T('توازن braces فایل PHP', (php.match(/\{/g) || []).length === (php.match(/\}/g) || []).length);
T('EMP_TYPES قبل از include guard تعریف می‌شود', php.indexOf('$EMP_TYPES =') < php.indexOf("defined('PTF_CAREERS_LIB')"));
T('tester458 در گیت CI', gate.indexOf('tester458-v34.7.55-jobposting-schema.js') > -1);
T('surplus بدون setInterval (tester171)', surplus.indexOf('setInterval') === -1);

console.log('\n— tester458 (v34.26.0: اسکیمای JobPosting برای GSC) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
