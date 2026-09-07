#!/usr/bin/env node
'use strict';
/* tester576 — v34.38.0: آزمون اتصال GSC — علتِ دقیق «ثبت نقشه ناموفق / property_not_found» */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var php = fs.readFileSync(path.join(ROOT, 'api/gsc.php'), 'utf8');
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
var sample = fs.readFileSync(path.join(ROOT, 'api/gsc-config.sample.php'), 'utf8');
var doc = fs.readFileSync(path.join(ROOT, 'GSC-PANEL-SETUP-FA.md'), 'utf8');

/* ── سرور ── */
T('API: اکشن selftest برمی‌گردد: ایمیل + فهرست sites + verdict + steps', php.indexOf("case 'selftest'") > -1 && php.indexOf("'sites'      => $d['sites']") > -1);
T('API: gsc_token/gsc_api حالت silent دارند (خودتشخیص بدون توقف)', php.indexOf('function gsc_token($cfg, $silent = false)') > -1 && php.indexOf("function gsc_api($cfg, $path, $payload = null, $method = 'GET', $silent = false)") > -1 && php.indexOf("['__error' => 'token_failed']") > -1);
T('API: gsc_pick_site ساختاریافته (ok/no_match/low_perm/api_error)', php.indexOf("function gsc_pick_site($cfg, $needWrite = true, $silent = false)") > -1 && php.indexOf("$out['verdict'] = 'no_match'") > -1 && php.indexOf("$out['verdict'] = 'low_perm'") > -1);
T('API: پیام property_not_found علت‌های رایج را صریح می‌گوید (IAM ≠ GSC، کپی ایمیل، پراپرتی اشتباه، Owner-vs-User)', php.indexOf('Google Cloud/IAM') > -1 && php.indexOf('Users and permissions') > -1 && php.indexOf('عیناً این ایمیل') > -1 && php.indexOf('Owners/Verification') > -1);
T('API: مسیر قدیمی resolve برای همهٔ اکشن‌های دیگر حفظ شده (تابع گسترده نه حذف)', php.indexOf('function gsc_resolve_site($cfg, $needWrite = true)') > -1 && php.indexOf("gsc_resolve_site(\$cfg") > -1);

/* ── کلاینت ── */
T('UI: دکمهٔ «🧪 آزمون اتصال GSC» در تب سئو کنار 📤 است', cms.indexOf('🧪 آزمون اتصال GSC') > -1 && cms.indexOf('📤 سایت‌مپ + سرچ کنسول') > -1);
T('UI: پنل خودتشخیص ایمیل + کپی + فهرست پراپرتی‌ها + رنگ سطح را می‌سازد', cms.indexOf('window.cmsGscSelfTestHtml = function') > -1 && cms.indexOf('cmsGscCopyEmail') > -1 && cms.indexOf('پراپرتی‌های قابل‌دسترسی در سرچ کنسول') > -1);
T('UI: جعبهٔ خطای ثبت نقشه دکمهٔ آزمون را پیشنهاد می‌دهد', cms.indexOf('علت دقیق + راهنمای رفع') > -1);

/* ── رفتاری: رندر پنل با سه سناریو ── */
T('BEHAV: رندر ok / no_match(خالی) / low_perm', (function () {
  var slice = cms.slice(cms.indexOf('window.cmsGscSelfTestHtml = function'), cms.indexOf('window.cmsGscCopyEmail = function'));
  global.window = {};
  global.escP = function (x) { return String(x == null ? '' : x); };
  try { eval(slice); } catch (e) { return false; }
  var H = window.cmsGscSelfTestHtml;
  var ok = H({ verdict: 'ok', email: 'pishtaj-ir-gsc@applied-pipe-507120.iam.gserviceaccount.com', site: 'sc-domain:pishtaj.ir', sites: [{ siteUrl: 'sc-domain:pishtaj.ir', permissionLevel: 'siteFullUser' }] });
  var okOk = ok.indexOf('✅') > -1 && ok.indexOf('sc-domain:pishtaj.ir') > -1 && ok.indexOf('#059669') > -1 && ok.indexOf('کپی ایمیل') > -1;
  var nm = H({ verdict: 'no_match', email: 'a@b.iam.gserviceaccount.com', sites: [], steps: ['در Search Console پراپرتی pishtaj.ir را انتخاب کنید.', 'Settings ← Users and permissions ← Add user.'] });
  var nmOk = nm.indexOf('— خالی —') > -1 && nm.indexOf('⛔') > -1 && nm.indexOf('<ol') > -1 && nm.indexOf('Users and permissions') > -1;
  var lp = H({ verdict: 'low_perm', email: 'a@b.iam.gserviceaccount.com', sites: [{ siteUrl: 'https://pishtaj.ir/', permissionLevel: 'siteRestrictedUser' }], steps: ['به Full ارتقا دهید.'] });
  var lpOk = lp.indexOf('⚠️') > -1 && lp.indexOf('#b45309') > -1;
  return okOk && nmOk && lpOk;
})());

/* ── مستندات ── */
T('DOC: راهنمای ۴ علت رایجِ «Full دادم ولی خالی» مستند شد (IAM/تایپو/پراپرتی اشتباه/Owner-User)', doc.indexOf('۴ علت رایج') > -1 && doc.indexOf('Google Cloud / IAM') > -1 && doc.indexOf('Owners/Verification') > -1);
T('DOC: نمونهٔ کانفیگ هشدار IAM و کپیِ دقیق ایمیل را دارد', sample.indexOf('Google Cloud/IAM') > -1 && sample.indexOf('iam.gserviceaccount.com') > -1);

console.log('=== tester576: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
