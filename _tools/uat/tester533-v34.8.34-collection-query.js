#!/usr/bin/env node
'use strict';
/* tester533 — v34.31.0 (T3-1): خواندن سرور-محور — collection_query.
   فیلتر eq، جستجوی آزاد، مرتب‌سازی، صفحه‌بندی، پروجکشن؛ role-guard؛ سقف صفحهٔ ۱۰۰.
   مدل PHP با ورودی‌های واقعی در برابر انتظارها آزمون می‌شود + قراردادهای کلاینت. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

var php = read('api/crm.php');
T('endpoint collection_query تعریف شد', /case 'collection_query':/.test(php));
T('role-guard با sync_allowed_keys_for_role', /collection_forbidden/.test(php) && /sync_allowed_keys_for_role\(\$client_role\)/.test(php));
T('سقف pageSize = ۱۰۰', /min\(100, max\(1, \(int\)\(\$_REQUEST\['pageSize'\] \?\? 50\)\)\)/.test(php));
T('جستجوی آزاد سقف اسکن ۳۰۰۰', /array_slice\(\$cq_rows, 0, 3000\)/.test(php));
T('پروجکشن CSV اختیاری', /\$cq_want = array_filter\(array_map\('trim', explode\(',', \$cq_fields\)\)\)/.test(php));
T('rev کلید در پاسخ (برای کش هوشمند کلاینت)', /'rev' => \$cq_metaEntry\['rev'\] \?\? 0/.test(php));
T('بدون وابستگی به sd_text در بلوک collection_query', !(php.match(/case 'collection_query':[\s\S]*?case 'data_rev':/) || ['']).join('').includes('sd_text('));

/* ---------- مدل PHP: فیلتر+مرتب+صفحه ---------- */
function modelQuery(rows, opts) {
  var r = rows.slice();
  Object.keys(opts.eq || {}).forEach(function (fk) {
    r = r.filter(function (x) { return x[fk] === opts.eq[fk]; });
  });
  if (opts.q) {
    var q = opts.q.toLowerCase();
    r = r.filter(function (x) { return Object.keys(x).some(function (k) { return typeof x[k] === 'string' && x[k].toLowerCase().indexOf(q) > -1; }); });
  }
  var sb = opts.sortBy || 'cd', dir = opts.sortDir === 'desc' ? -1 : 1;
  r.sort(function (a, b) { return strcmp(String(a[sb] || ''), String(b[sb] || '')) * dir; });
  var ps = Math.min(100, Math.max(1, opts.pageSize || 50));
  var page = Math.max(1, opts.page || 1);
  var pageRows = r.slice((page - 1) * ps, page * ps);
  return { total: r.length, page: page, pages: Math.ceil(r.length / ps), rows: pageRows };
}
function strcmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/* سناریوها */
var rows = [];
for (var i = 0; i < 250; i++) rows.push({ cd: 'P' + (1000 + i), co: (i % 2 ? 'شرکت آریا ' : 'company beta ') + i, st: i % 3 === 0 ? 'active' : 'draft' });

var m1 = modelQuery(rows, { eq: { st: 'active' }, sortBy: 'cd', sortDir: 'desc', page: 2, pageSize: 10 });
T('فیلتر eq+مرتب desc+صفحهٔ ۲: تعداد کل درست', m1.total === Math.ceil(250 / 3), m1.total);
T('صفحهٔ ۲ با سایز ۱۰: ۱۰ ردیف', m1.rows.length === 10);
T('مرتب نزولی cd', m1.rows[0].cd > m1.rows[9].cd);

var m2 = modelQuery(rows, { q: 'آریا', pageSize: 100 });
T('جستجوی آزاد فارسی: نیمی از رکوردها', m2.total === 125, m2.total);

var m3 = modelQuery(rows, { pageSize: 100 });
T('بدون فیلتر: کل ۲۵۰', m3.total === 250);
T('pages = ۳ (سایز ۱۰۰)', m3.pages === 3);

/* ---------- قراردادهای کلاینت ---------- */
var sync = read('crm/sync.js');
T('ptfCollectionQuery تعریف شد', /window\.ptfCollectionQuery = function \(collection, opts, cb\)/.test(sync));
T('متد GET با X-CRM-Token', /action: 'collection_query', collection: collection/.test(sync) && /X-CRM-Token/.test(sync));
T('صرفاً خواندنی — نوشتن از این مسیر عبور نمی‌کند', !/setData/.test((sync.match(/window\.ptfCollectionQuery = function[\s\S]*?\n  \};/) || [''])[0]));

var ver = JSON.parse(read('VERSION.json'));
T('VERSION.json = v34.31.0', ver.crm_version === 'v34.31.0', ver.crm_version);
T('قرارداد نسخهٔ UI/sw = 34.31.0', /window\.PTF_CRM_RELEASE = 'v34\.31.0'/.test(read('crm/index.html')) && /CACHE = 'ptf-crm-v34\.31.0'/.test(read('crm/sw.js')));

console.log('\n— tester533 (v34.31.0: T3-1 collection_query) —');
console.log('PASS: ' + p + ' | FAIL: ' + f);
process.exit(f ? 1 : 0);
