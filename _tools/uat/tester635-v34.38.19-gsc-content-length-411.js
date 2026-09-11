#!/usr/bin/env node
'use strict';
/* tester635 — v34.38.20 (GSC-CONTENT-LENGTH-FIX): قفلِ قراردادِ Content-Length برای
   PUT/DELETEِ بدونِ بدنه. ریشهٔ «ثبت نقشه ناموفق: api_error_411 (Length Required)»:
   curl درخواستِ PUTِ «ثبت نقشه» را (که طبق مستندِ گوگل بدنه نباید داشته باشد) بدونِ
   هدرِ Content-Length می‌فرستاد و گوگل 411 برمی‌گرداند. حالا برای PUT/DELETEِ بدونِ
   payload صریحاً «Content-Length: 0» اعلام می‌شود؛ GET و POST-with-body دست‌نخورده‌اند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }

var php = fs.readFileSync(path.join(ROOT, 'api/gsc.php'), 'utf8');

/* ── فیکس: هدرِ صریح برای بدنهٔ خالی ── */
T('API: هدر «Content-Length: 0» برای درخواستِ بدونِ بدنه اضافه می‌شود', php.indexOf('Content-Length: 0') > -1);
T('API: هدر فقط برای PUT/DELETEِ بدونِ payload اعمال می‌شود (نه GET، نه POST با بدنه)',
  php.indexOf('$payload === null && $method !==') > -1);
T('API: CURLOPT_CUSTOMREQUEST همچنان برای متدهای غیر POST تنظیم می‌شود', php.indexOf('CURLOPT_CUSTOMREQUEST') > -1);

/* ── ضدِ رگرسیون: مسیرهای POST-with-body و GET دست‌نخورده ── */
T('API: مسیر POST با بدنه (searchAnalytics/urlInspection) از CURLOPT_POSTFIELDS استفاده می‌کند',
  php.indexOf('CURLOPT_POSTFIELDS') > -1 && php.indexOf('json_encode($payload') > -1);
T('API: تبدیل GET→POST هنگام داشتن payload حفظ شده', php.indexOf("$method === 'GET'") > -1);

/* ── قراردادِ فراخوانیِ ثبت نقشه دست‌نخورده ── */
T('API: ثبت نقشه همچنان PUTِ بدونِ بدنه است (null, \'PUT\')', php.indexOf("null, 'PUT'") > -1);
T('API: gsc_api امضای پیشین را حفظ کرده (پنج پارامتر)', php.indexOf('function gsc_api($cfg, $path, $payload = null, $method = \'GET\', $silent = false)') > -1);

console.log('=== tester635: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
