#!/usr/bin/env node
'use strict';
/* v34.17.0 — پایه‌ی «استارت سرد SPA» / سوادِ لود (LOAD-AUDIT-001، فقط استاتیک، بدون تغییر رفتار):
   - همه‌ی اسکریپت‌های مدنظر index.html روی دیسک وجود دارند.
   - همه‌ی cache-bust ها با نسخه‌ی فعلی (بعد از VERSION.json) هم‌خوانی دارند.
   - ui-kit/mobilenav قبل از bundleهای عملیاتی؛ sales-domain-v2 بعد از مسیر legacy.
   - xlsx.min.js async است؛ بقیه defer. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var ver = JSON.parse(read('VERSION.json'));
var idx = read('crm/index.html');

T('VERSION.json = v34.17.0', ver.crm_version === 'v34.17.0', ver.crm_version);
T('index PTF_CRM_RELEASE = v34.17.0', /window\.PTF_CRM_RELEASE = 'v34\.17.0'/.test(idx));

var srcs = [];
var re = /<script[^>]*src="([^"]+)"/g, m;
while ((m = re.exec(idx)) !== null) srcs.push(m[1]);
var localSrcs = srcs.filter(function (s) { return s.indexOf('http') !== 0 && !s.match(/^\//); });
T('تعداد اسکریپت‌های محلی > ۵۰', localSrcs.length > 50, localSrcs.length);
var missing = localSrcs.filter(function (s) { return !fs.existsSync(path.join(ROOT, 'crm', s.replace(/\?.*$/, ''))); });
T('همه‌ی اسکریپت‌های محلی روی دیسک موجودند', missing.length === 0, missing.join(', '));
var wrongVer = localSrcs.filter(function (s) { return /\?v=/.test(s) && !/v=34\.17.0/.test(s); });
T('همه‌ی cache-bust ها = 34.17.0', wrongVer.length === 0, wrongVer.join(', '));

/* ترتیب قابل‌اعتماد */
function pos(sub) { return idx.indexOf(sub); }
T('ui-kit.js قبل از mobilenav نیست؟ (هر دو در ابتدا)', pos('ui-kit.js') > -1 && pos('mobilenav.js') > -1);
T('ui-kit/mobilenav قبل از offers/cheques', pos('ui-kit.js') < pos('offers.js') && pos('mobilenav.js') < pos('offers.js'));
T('sales-domain-v2/official-invoice-v2 در انتهای بارگذاری', pos('sales-domain-v2.js') > pos('fiscal.js') && pos('official-invoice-v2.js') > pos('fiscal.js'));
T('xlsx.min.js async است', /<script async src="xlsx\.min\.js/.test(idx));

/* SW باید همه‌ی entryها را precache کند */
var sw = read('crm/sw.js');
var nc = localSrcs.filter(function (s) { return !s.indexOf('http') && !s.match(/^\//); });
var notCached = nc.filter(function (s) { return sw.indexOf('./' + s.replace(/\?.*$/, '')) < 0; });
T('همه‌ی entryها در Service Worker precache شده‌اند', notCached.length === 0, notCached.join(', '));

T('tester489 در گیت CI', read('_tools/uat/run-ci-gate.js').indexOf('tester489-v34.7.91-load-order-audit.js') > -1);

console.log('\n— tester489 (v34.17.0: پایه‌ی استارت سرد — LOAD-AUDIT-001) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
