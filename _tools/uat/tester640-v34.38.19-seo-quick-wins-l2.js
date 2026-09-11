#!/usr/bin/env node
'use strict';
/* tester640 — v34.38.19 (SEO-QUICK-WINS-L2): قفلِ بردهای سطح ۲ سئو بر پایهٔ دادهٔ GSC.
   هشت کوئریِ غیربرندی با نمایش ولی جایگاه ۵۴–۹۸. اقدامات:
   ۱) عنوان/H1 با کوئریِ واقعی تطبیق یافت:
      - «لوله x42» → عنوان/H1 «لوله X42 (API 5L X42)» (لاتین X42، نه فقط «ایکس۴۲»)
      - «قیمت لوله a106» → کانونیکالِ a106-gr-b یعنی kc-astm-a106-gr «قیمت لوله A106 Gr.B»
      - «نمایندگی روزمونت» → emerson-rosemount با «نمایندگی روزمونت در ایران» شروع می‌شود
      - «زنجیره تامین قطعات یدکی» → pumps-procurement-guide «زنجیره تامین پمپ صنعتی و قطعات یدکی»
   ۲) لینک داخلی: صفحاتِ کم‌لینک (انبار قطعات یدکی/پمپ/فلنج اراک/روزمونت) از صفحاتِ هم‌بافت لینک گرفتند. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function has(rel, s) { return read(rel).indexOf(s) > -1; }

/* ── ۱) تطبیق عنوان/H1 با کوئری ── */
var x42 = read('knowledge-center/api-5l-x42.html');
T('SEO: x42 — title «لوله X42» با X42 لاتین دارد', /<title>[^<]*لوله X42[^<]*<\/title>/.test(x42));
T('SEO: x42 — H1 هم «X42» لاتین دارد', /<h1[^>]*>[^<]*X42[^<]*<\/h1>/.test(x42));

var a106 = read('knowledge-center/kc-astm-a106-gr.html');
T('SEO: a106 — title «قیمت لوله A106» دارد (کوئری «قیمت لوله a106»)', /<title>قیمت لوله A106 Gr\.B/.test(a106));
T('SEO: a106 — H1 «قیمت لوله A106» دارد', /<h1[^>]*>قیمت لوله A106 Gr\.B/.test(a106));

var em = read('brands/emerson-rosemount.html');
T('SEO: روزمونت — title با «نمایندگی روزمونت» شروع می‌شود (کوئری «نمایندگی روزمونت»)',
  /<title>نمایندگی روزمونت/.test(em));
T('SEO: روزمونت — H1 «نمایندگی روزمونت» دارد', /<h1[^>]*>نمایندگی روزمونت/.test(em));

var pumps = read('blog/pumps-procurement-guide/index.html');
T('SEO: پمپ — title «زنجیره تامین» و «قطعات یدکی» دارد (کوئری «زنجیره تامین قطعات یدکی»)',
  /<title>[^<]*زنجیره تامین[^<]*قطعات یدکی[^<]*<\/title>/.test(pumps));
T('SEO: پمپ — H1 «زنجیره تامین پمپ صنعتی و قطعات یدکی» است', /<h1[^>]*>زنجیره تامین پمپ صنعتی و قطعات یدکی<\/h1>/.test(pumps));

/* ── ۲) لینک داخلی ── */
T('SEO: صفحهٔ انبار قطعات یدکی به «حمل تجهیزات صنعتی» لینک می‌دهد',
  has('knowledge-center/kc-spare-parts-warehousing-inventory.html', 'href="kc-industrial-material-handling-transport.html"'));
T('SEO: صفحهٔ انبار قطعات یدکی به «زنجیره تامین پمپ و قطعات یدکی» لینک می‌دهد',
  has('knowledge-center/kc-spare-parts-warehousing-inventory.html', 'href="../blog/pumps-procurement-guide/"'));
T('SEO: صفحهٔ حمل تجهیزات صنعتی به «مدیریت انبار قطعات یدکی» لینک می‌دهد',
  has('knowledge-center/kc-industrial-material-handling-transport.html', 'href="kc-spare-parts-warehousing-inventory.html"'));
T('SEO: صفحهٔ پمپ به «مدیریت انبار قطعات یدکی» لینک می‌دهد',
  has('blog/pumps-procurement-guide/index.html', 'href="../../knowledge-center/kc-spare-parts-warehousing-inventory.html"'));
T('SEO: صفحهٔ تامین‌کننده فلنج به «فلنج اراک» لینک می‌دهد',
  has('suppliers/flange-supplier.html', 'href="../knowledge-center/flange-arak-guide.html"'));
T('SEO: صفحهٔ ابزار دقیق به «نمایندگی روزمونت» لینک می‌دهد',
  has('services/instrumentation-supply.html', 'href="../brands/emerson-rosemount.html"'));

/* ── ۳) سالم‌ماندنِ قراردادهای قبلی ── */
T('CONTRACT: روزمونت JSON-LD همچنان parse می‌شود', (function () {
  var m = em.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try { JSON.parse(m[1]); return true; } catch (e) { return false; }
})());
T('CONTRACT: پمپ JSON-LD (Breadcrumb+Article) parse می‌شود', (function () {
  var re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, m, ok = true;
  while ((m = re.exec(pumps)) !== null) { try { JSON.parse(m[1]); } catch (e) { ok = false; } }
  return ok;
})());
T('CONTRACT: صفحهٔ انبار قطعات یدکی اسکیمای معتبر دارد (BreadcrumbList)', /"@type":"BreadcrumbList"/.test(read('knowledge-center/kc-spare-parts-warehousing-inventory.html')));

console.log('=== tester640: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
