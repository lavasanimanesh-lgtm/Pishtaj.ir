/* tester655 — v34.38.20 (INDEX-TRACKER-REQUEST-LINK):
   گزارش کارفرما: «در ردیابِ ایندکسِ افزایشی در سرچ کنسول، برای هر ردیفی که ایندکس نشده
   باید دکمهٔ مستقیمِ «درخواست ایندکس» وجود داشته باشد.»
   پیش از این، جدولِ pending_list فقط «صفحه / وضعیت / گوگل می‌گوید» را نشان می‌داد و هیچ
   عملِ مستقیمی روی ردیف نبود؛ کاربر باید URL را دستی کپی می‌کرد. حالا:
   - سرور برای هر ردیفِ pending، پیوندِ بازرسیِ سرچ کنسولِ همان نشانی (inspectLink) را از
     gsc_inspect_link برمی‌گرداند؛
   - کلاینت ستون «عملیات» با دکمهٔ «🔎 بررسی» (بازرسیِ زنده) و پیوندِ مستقیمِ
     «درخواست ایندکس ↗» (باز شدن صفحهٔ بازرسیِ گوگل برای همان URL — چون Indexing API
     عمومی برای این صفحات وجود ندارد) اضافه می‌کند. */
'use strict';
var fs = require('fs');
var assert = require('assert');
var php = fs.readFileSync('api/gsc.php', 'utf8');
var gsc = fs.readFileSync('crm/gsc.js', 'utf8');

console.log('── درخواست ایندکسِ مستقیم برای ردیف‌های ایندکس‌نشدهٔ ردیاب (v34.38.20) ──');

/* ── قرارداد استاتیک — سرور ── */
assert.ok(php.indexOf("case 'index_tracker':") > -1, 'اکشن index_tracker موجود است');
assert.ok(/pendingEntries\[\] = array\([\s\S]*?'inspectLink'\s*=>\s*gsc_inspect_link\(\(string\)\$cfg\['site_url'\],\s*\$url\)/.test(php),
  'هر ردیفِ pending پیوندِ بازرسیِ سرچ کنسولِ همان نشانی را برمی‌گرداند');
assert.ok(php.indexOf("function gsc_inspect_link($propSite, $url)") > -1, 'تابع ساخت پیوند بازرسی موجود است');
assert.ok(php.indexOf('search-console/inspect?resource_id=') > -1, 'پیوند به صفحهٔ بازرسیِ رسمی سرچ کنسول اشاره می‌کند');
console.log('  ✔ استاتیک: سرور برای هر ردیف inspectLink برمی‌گرداند');

/* ── قرارداد استاتیک — کلاینت ── */
var trackerFn = gsc.slice(gsc.indexOf('window.gscIndexTrackerRender'), gsc.indexOf('window.gscIndexTrackerLoad'));
assert.ok(trackerFn.indexOf('<th>عملیات</th>') > -1, 'جدول ردیاب ستون «عملیات» دارد');
assert.ok(trackerFn.indexOf('درخواست ایندکس ↗') > -1, 'دکمهٔ «درخواست ایندکس» برای هر ردیف رندر می‌شود');
assert.ok(/href="' \+ escP\(r\.inspectLink\) \+ '"/.test(trackerFn), 'پیوند مستقیم از inspectLinkِ همان ردیف ساخته می‌شود');
assert.ok(trackerFn.indexOf('gscInspect') > -1 && trackerFn.indexOf("escP(r.url).replace(/'/g, '')") > -1, 'دکمهٔ «بررسی» بازرسیِ زندهٔ همان ردیف را باز می‌کند');
assert.ok(trackerFn.indexOf("if (r.inspectLink)") > -1, 'پیوند فقط وقتی inspectLink موجود است رندر می‌شود (بدون پیوند شکسته)');
console.log('  ✔ استاتیک: ستون عملیات با دکمهٔ مستقیم «درخواست ایندکس» در جدول ردیاب');

/* ── مدل رفتاری مستقل — رندرِ ردیفِ ایندکس‌نشده با دکمهٔ مستقیم ── */
function renderActions(r) {
  var a = '<button onclick="gscInspect(\'' + String(r.url).replace(/'/g, '') + '\')">🔎 بررسی</button> ';
  if (r.inspectLink) a += '<a href="' + r.inspectLink + '">درخواست ایندکس ↗</a>';
  return a;
}
var pendingRow = { url: 'https://pishtaj.ir/blog/x.html', state: 'pending', coverage: 'Discovered — currently not indexed', inspectLink: 'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Apishtaj.ir&id=https%3A%2F%2Fpishtaj.ir%2Fblog%2Fx.html' };
var a1 = renderActions(pendingRow);
assert.ok(a1.indexOf('درخواست ایندکس ↗') > -1, 'ردیفِ ایندکس‌نشده پیوند درخواست ایندکس دارد');
assert.ok(a1.indexOf(pendingRow.inspectLink) > -1, 'پیوند به صفحهٔ بازرسیِ همان URL اشاره می‌کند');
assert.ok(a1.indexOf("gscInspect('https://pishtaj.ir/blog/x.html')") > -1, 'دکمهٔ بررسی، بازرسیِ همان ردیف را صدا می‌زند');
var a2 = renderActions({ url: 'https://pishtaj.ir/blog/y.html', state: 'new', inspectLink: '' });
assert.ok(a2.indexOf('درخواست ایندکس') === -1, 'بدون inspectLink هیچ پیوندِ شکسته‌ای رندر نمی‌شود');
console.log('  ✔ رفتاری: ردیفِ ایندکس‌نشده دکمهٔ مستقیم دارد و ردیفِ بدون پیوند، پیوند شکسته نمی‌سازد');

/* ── سازگاری با قرارداد قبلی ردیاب (tester637) ── */
assert.ok(gsc.indexOf('gscIndexTrackerLoad(25)') > -1 && gsc.indexOf('gscIndexTrackerRunAll()') > -1 && gsc.indexOf('gscIndexTrackerReset()') > -1,
  'دکمه‌های قبلی ردیاب (بررسی دسته / اجرا تا اتمام / شروع مجدد) دست‌نخورده‌اند');
assert.ok(php.indexOf("if (($st['state'] ?? '') === 'indexed') continue;") > -1, 'منطق افزایشی (skip ایندکس‌شده) دست‌نخورده است');
console.log('  ✔ سازگاری: قرارداد قبلی ردیاب و منطق افزایشی دست‌نخورده');

console.log('PASS tester655 v34.38.20 index-tracker per-row request-indexing link');
