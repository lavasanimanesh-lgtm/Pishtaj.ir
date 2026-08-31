#!/usr/bin/env node
'use strict';
/* tester534 — v34.15.0 (T3-1 مصرف عملیاتی): ماژول کالا از خواندن سرور-محور
   (collection_query، صفحهٔ ۱۰۰تایی + جستجو/مرتب سروری) با fallback کامل محلی.
   پیش‌فرض روشن؛ کلید بازگشت: ptfProdServerToggle(false) در settings. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var idx = read('crm/index.html');
T('renderProductsServer تعریف شد', /function renderProductsServer\(\)/.test(idx));
T('renderProducts: مسیر سروری با fallback محلی', /if \(prodServerReadOn\(\)\) \{ try \{ renderProductsServer\(\); return; \} catch \(eSrv\) \{ prodServerReadOn\._offOnce = true; \} \}/.test(idx));
T('کوئری سروری: صفحه ۱۰۰ + مرتب + جستجو', /pageSize: 100/.test(idx) && /sortBy: sort\.key === 'pr' \? 'pr'/.test(idx));
T('شکست شبکه → toast + fallback محلی', /خواندن سروری ناموفق بود — نمایش محلی/.test(idx));
T('ناوبری صفحه‌بندی سروری', /ptfProdServerGoto\(/.test(idx));
T('کلید بازگشت فوری (ptfProdServerToggle)', /window\.ptfProdServerToggle = function \(on\)/.test(idx));
T('پیش‌فرض: سروری روشن (prodServerRead !== false)', /st\.prodServerRead !== false/.test(idx));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.15.0', ver.crm_version === 'v34.15.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.15.0', /window\.PTF_CRM_RELEASE = 'v34\.15.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.15.0'/.test(read('crm/sw.js')));

console.log('\n— tester534 (v34.15.0: products server-side reads) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
