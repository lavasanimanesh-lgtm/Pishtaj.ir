#!/usr/bin/env node
'use strict';
/* tester634 — v34.38.19 (GSC-SITEENTRY-FIX): قفلِ قراردادِ فیلدِ پاسخِ sites.list.
   ریشهٔ «آزمون اتصال GSC همیشه خالی است با وجودِ تنظیمات درست»: پاسخِ
   webmasters/v3/sites فهرست را زیر کلیدِ «siteEntry» برمی‌گرداند (مطابق
   SitesListResponse: SiteEntry []*WmxSite `json:"siteEntry,omitempty"`)،
   ولی کد از v34.12.0 تا v34.38.18 «$list['site']» را می‌خواند که هرگز وجود
   ندارد ⇒ فهرست همیشه [] ⇒ verdict همیشه no_match (property_not_found کاذب).
   این تستر اگر کسی دوباره به «site» برگردد FAIL می‌شود. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

var php = fs.readFileSync(path.join(ROOT, 'api/gsc.php'), 'utf8');

/* ── فیکس: خواندنِ کلیدِ صحیحِ پاسخ گوگل ── */
T('API: gsc_pick_site پاسخ sites.list را زیر کلید «siteEntry» می‌خواند', php.indexOf("$list['siteEntry'] ?? []") > -1);

/* ── ضدِ رگرسیون: کلیدِ نادرستِ قدیمی نباید تنها منبع فهرست باشد ── */
T('API: دیگر «$list[\'site\'] ?? []» خوانده نمی‌شود (باگِ فهرستِ همیشه‌خالی)', php.indexOf("$list['site'] ?? []") === -1);

/* ── قراردادِ پیرامونی دست‌نخورده ── */
T('API: gsc_pick_site همچنان ساختاریافته (ok/no_match/low_perm/api_error) برمی‌گرداند',
  php.indexOf('function gsc_pick_site($cfg, $needWrite = true, $silent = false)') > -1 &&
  php.indexOf("$out['verdict'] = 'no_match'") > -1 &&
  php.indexOf("$out['verdict'] = 'low_perm'") > -1);
T('API: نرمال‌سازی خروجی به {siteUrl, permissionLevel} حفظ شده (قرارداد کلاینت cms.js)',
  php.indexOf("return ['siteUrl' => (string)($st['siteUrl'] ?? '')") > -1 &&
  php.indexOf("'permissionLevel' => (string)($st['permissionLevel'] ?? '')") > -1);
T('API: اکشن selftest همچنان فهرست را به کلاینت می‌فرستد', php.indexOf("case 'selftest'") > -1 && php.indexOf("'sites'      => $d['sites']") > -1);

console.log('=== tester634: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
