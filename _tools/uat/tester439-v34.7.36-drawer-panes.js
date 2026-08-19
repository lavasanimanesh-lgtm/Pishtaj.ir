#!/usr/bin/env node
'use strict';
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var sf = read('crm/salesfiles.js');
var dx = read('crm/docsx.js');
T('sfDrawerSetPane تعریف شده', /window\.sfDrawerSetPane = function/.test(sf));
T('سه زبانه خلاصه/اسناد/عملیات', /paneBtn\('sum'/.test(sf) && /paneBtn\('docs'/.test(sf) && /paneBtn\('ops'/.test(sf));
T('میزبان docsx در زبانه اسناد', /dxHost_/.test(sf));
T('هوک docsx میزبان زبانه را ترجیح می‌دهد', /getElementById\('dxHost_'/.test(dx));
T('کاشی رویژن و مختومه هنوز در کشو هستند', /award-revise/.test(sf) && /sfClose\(/.test(sf));
T('هوک خرید واقعی هنوز sfUp را می‌جوید', /sfUp_/.test(read('crm/buycompare.js')));
console.log('\n— tester439 (کشوی سه‌زبانه) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
