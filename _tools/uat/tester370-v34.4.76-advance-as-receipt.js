#!/usr/bin/env node
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function fail(m) { console.log('FAIL ' + m); process.exit(1); }
var ver = JSON.parse(read('VERSION.json'));
if (ver.crm_version !== 'v34.4.76') fail('VERSION ' + ver.crm_version);
var sf = read('crm/salesfiles.js');
var bc = read('crm/buycompare.js');
if (sf.indexOf('پیش‌دریافت مشتری (وصولی)') < 0) fail('salesfile label');
if (sf.indexOf('وصولی ') < 0) fail('received as receipt');
if (bc.indexOf('پیش‌دریافت') < 0) fail('buycompare label');
if (bc.indexOf('پیش‌دریافت وصولی') < 0) fail('buycompare status');
console.log('PASS tester370 advance-as-receipt');
