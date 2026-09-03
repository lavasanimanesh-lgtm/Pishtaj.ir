#!/usr/bin/env node
'use strict';
/* tester582 — v34.35.0: «رفتار درخواست‌های سایت را با موازین CRM برای ثبت مشتری و
 * تامین‌کننده یکسان کن» — نمونهٔ گزارشی: شماره تلفن مشتریِ درخواست‌دهندهٔ سایت ثبت
 * نمی‌شد و با «ویرایش مشتری» هم ثبت نمی‌شد.
 *
 * ریشه (دو لایه):
 * ① سرور: sd_entity_sanitize_list مقدار لیستی داخل mapِ داخل لیست
 *   (people[].tels/mobs/mails) را بی‌صدا حذف می‌کرد (رفع v34.23.0 فقط سطح ردیف
 *   بود) → شمارهٔ تماس شخص رابط پس از اولین entity_upsert از مشتری/تامین‌کننده
 *   پاک می‌شد و ویرایش بعدی ph را هم خالی بازنویسی می‌کرد.
 * ② کلاینت: رکورد سایت کاملاً استاندارد نبود (تلفن همیشه mobs؛ تامین‌کنندهٔ سایت
 *   اصلاً people نداشت) و ویرایش فرم‌محور، فیلدهای خارج از فرم (src/srcSite/files…)
 *   را می‌پاکید.
 *
 * تأیید رفتاری: بوت jsdom + سرور جعلی با ترجمهٔ وفادار پاک‌ساز PHP —
 * حالت قدیم ۷/۰ (ریشه اثبات) · حالت جدید ۱۱/۱۱. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var php = fs.readFileSync(path.join(ROOT, 'api/sales-domain.php'), 'utf8');
var bridge = fs.readFileSync(path.join(ROOT, 'crm/bridge.js'), 'utf8');
var offers = fs.readFileSync(path.join(ROOT, 'crm/offers.js'), 'utf8');

/* ── ① سرور: کانال‌های تماس داخل people زنده می‌مانند ── */
T('SRV: sd_entity_sanitize_list پارامتر عمق دارد (int $depth = 2)', /function sd_entity_sanitize_list\(array \$v, array &\$stats = null, int \$depth = 2\): array/.test(php));
T('SRV: مقدار آرایه‌ای داخل mapِ داخل لیست بازگشتی سانیتایز می‌شود (نه حذف)', php.indexOf('sd_entity_sanitize_list($v3, $stats, $depth - 1)') > -1);
T('SRV: شاخهٔ حفظ لیست داخل map سطح ردیف (v34.23.0 — files.oth) دست‌نخورده ماند', /elseif \(is_string\(\$k2\) && strlen\(\$k2\) <= 60 && is_array\(\$v2\)\)/.test(php));
T('SRV: سقف‌های قبلی (۶۰ قلم / ۲۰ فیلد) در جای خود هستند', /count\(\$list\) >= 60/.test(php) && /count\(\$subItem\) >= 20/.test(php));

/* ── ② کلاینت: مشتری سایت با موازین CRM ── */
T('CUST: طبقه‌بندی استاندارد تلفن فرم سایت (chOf: ^09→mobs، sonst tels با ext)', (function () {
  var i = bridge.indexOf('function rfqSiteEnsureCustomer');
  var seg = bridge.slice(i, i + 2600);
  return /var chOf = function \(phRaw\)/.test(seg) && /\^09\\d\{9\}\$/.test(seg) && /tels: \[\{ n: String\(phRaw\)\.trim\(\), ext: ''/.test(seg);
})());
T('CUST: person جدید مشتری سایت با کانال طبقه‌بندی‌شده + primary + src ساخته می‌شود', /var chN = chOf\(r\.phone\); return \[\{ nm: r\.contact[^\n]*tels: chN\.tels, mobs: chN\.mobs[^\n]*primary: true, src: 'site'/.test(bridge));
T('CUST: مسیر «رابط جدید روی مشتری موجود» هم همان طبقه‌بندی را می‌گیرد (chF)', /var chF = chOf\(r\.phone\);[\s\S]{0,200}found\.people\.push\(\{ nm: r\.contact[^\n]*tels: chF\.tels, mobs: chF\.mobs/.test(bridge));

/* ── ③ کلاینت: تامین‌کنندهٔ سایت با موازین CRM ── */
T('SUP: تایید ثبت‌نام سایت → people استاندارد (رابط با tels/mobs طبقه‌بندی‌شده + primary)', (function () {
  var i = bridge.indexOf('window.supApproveCommit = function');
  var seg = bridge.slice(i, i + 3000);
  return seg.indexOf('people: (s.name || s.phone || s.email) ?') > -1 && seg.indexOf("role: 'رابط (فرم سایت)'") > -1 && seg.indexOf('tels: supCh.tels, mobs: supCh.mobs') > -1 && seg.indexOf('primary: true') > -1;
})());
T('SUP: رکورد سایت kind=حقوقی می‌گیرد (فرم استاندارد تامین‌کننده)', /var recSup = \{ cd: code, co: s\.company, kind: 'حقوقی', nm: s\.name, ph: s\.phone/.test(bridge));

/* ── ④ ویرایش فرم دیگر داده نمی‌پاکد ── */
T('EDIT: saveCust2 فیلدهای خارج از فرم را از رکورد قبلی حفظ می‌کند (merge مثل سرور)', (function () {
  var i = offers.indexOf('function saveCust2');
  var seg = offers.slice(i, i + 4200);
  return seg.indexOf('var oldC2 = items[i];') > -1 && /for \(var ok2 in oldC2\)[\s\S]{0,140}hasOwnProperty[\s\S]{0,80}!\(ok2 in rec\)/.test(seg);
})());
T('EDIT: saveCust2 نگهبان ph/con برای رکورد قدیمی بدون people', /if \(!rec\.ph && !\(rec\.coTels \|\| \[\]\)\.length && !primaryPerson\(rec\) && oldC2\.ph\) rec\.ph = oldC2\.ph;/.test(offers) && /if \(!rec\.con && !primaryPerson\(rec\) && oldC2\.con\) rec\.con = oldC2\.con;/.test(offers));
T('EDIT: saveSup2 هم فیلدهای خارج از فرم (files/payTerms/src…) را حفظ می‌کند + نگهبان nm/ph', (function () {
  var i = offers.indexOf('function saveSup2');
  var seg = offers.slice(i, i + 4200);
  return seg.indexOf('var oldS2 = items[i];') > -1 && /!\(okS2 in rec\)/.test(seg) && /if \(!rec\.nm && oldS2\.nm\) rec\.nm = oldS2\.nm;/.test(seg) && /if \(!rec\.ph && !\(rec\.coTels \|\| \[\]\)\.length && !primaryPerson\(rec\) && oldS2\.ph\) rec\.ph = oldS2\.ph;/.test(seg);
})());

/* ── رگرسیون ── */
T('REG: cbInit همچنان کپی عمیق people می‌گیرد (ویرایشگر state جدا)', /_cbState = \{ people: JSON\.parse\(JSON\.stringify\(people \|\| \[\]\)\) \};/.test(offers));
T('REG: هوک phonefmt (ارقام فارسی مشتری) دست‌نخورده است', fs.readFileSync(path.join(ROOT, 'crm/phonefmt.js'), 'utf8').indexOf("ptfNormalizeEntityPhones(rec, 'fa')") > -1);
T('REG: rd تبدیل ارقام در chOf فقط با نرمال‌سازی رقم‌ها انجام می‌شود (normP موجود)', bridge.indexOf('var normP = function (s)') > -1);

console.log('=== tester582: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
