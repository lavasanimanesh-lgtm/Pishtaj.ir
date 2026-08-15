#!/usr/bin/env node
'use strict';
/* v34.7.5 — کدهای رهگیری عمومی تصادفی، غیرقابل‌حدس و سازگار با کدهای قدیمی */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function section(src, from, to) {
  var start = src.indexOf(from), end = src.indexOf(to, start + from.length);
  return start < 0 ? '' : src.slice(start, end < 0 ? src.length : end);
}
var api = read('api/crm.php');
var supplier = read('supplier/index.html');
var rfq = read('rfq/index.html');
var tracking = read('tracking/index.html');
var petty = read('crm/petty.js');
var addSite = section(api, "case 'add_rfq_site':", "case 'add_rfq':");
var addLegacy = section(api, "case 'add_rfq':", "case 'update_rfq':");
var addSupplier = section(api, "case 'add_supplier':", "case 'track':");
var track = section(api, "case 'track':", "case 'get_inbox':");
var p = 0, f = 0;
function T(name, cond, detail) {
  if (cond) { p++; console.log('PASS', name); }
  else { f++; console.error('FAIL', name, detail || ''); }
}

T('عنوان پورتال تامین‌کنندگان کاملاً فارسی و بدون عنوان/نسخه انگلیسی است',
  supplier.indexOf('سامانه ثبت‌نام تامین‌کنندگان و انبارداران صنعتی</h1>') > -1 && supplier.indexOf('Vendor Portal') === -1);

T('مولد مشترک فقط پیشوندهای RFQ و VEN را می‌پذیرد',
  /function public_tracking_code\(\$kind\)/.test(api) && /in_array\(\$kind, \['RFQ', 'VEN'\], true\)/.test(api));
T('توکن ده‌نویسه‌ای با random_int و بدون 0/O/1/I ساخته می‌شود',
  api.indexOf("$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';") > -1 &&
  api.indexOf('for ($i = 0; $i < 10; $i++)') > -1 &&
  api.indexOf('random_int(0, $max)') > -1);
T('قالب خروجی دو گروه پنج‌نویسه‌ای و فاقد سال/sequence است',
  api.indexOf("'PTF-' . $kind . '-' . substr($token, 0, 5) . '-' . substr($token, 5, 5)") > -1 &&
  api.indexOf('function next_seq') === -1 && !/'PTF-(?:RFQ|VEN)-'\s*\.\s*fa_year/.test(api));
T('collision در هر دو مجموعه استعلام و تامین‌کننده بررسی و تلاش محدود است',
  api.indexOf("array_merge(load_data('rfqs'), load_data('suppliers'))") > -1 &&
  api.indexOf('if (!isset($used[$code])) return $code;') > -1 &&
  api.indexOf('$attempt < 20') > -1);

T('add_rfq_site فقط از مولد امن سرور استفاده و code را پاسخ می‌دهد',
  addSite.indexOf("public_tracking_code('RFQ')") > -1 &&
  addSite.indexOf("'code' => $code") > -1 && addSite.indexOf("$_POST['code']") === -1);
T('add_rfq قدیمی دیگر code کاربر یا rand را نمی‌پذیرد',
  addLegacy.indexOf("public_tracking_code('RFQ')") > -1 &&
  addLegacy.indexOf("$_POST['code']") === -1 && !/\brand\s*\(/.test(addLegacy));
T('add_supplier فقط از مولد امن VEN استفاده و code را پاسخ می‌دهد',
  addSupplier.indexOf("public_tracking_code('VEN')") > -1 &&
  addSupplier.indexOf("'code' => $code") > -1);
T('شکست تولید کد در هر سه مسیر fail-closed و با 503 پاسخ داده می‌شود',
  [addSite, addLegacy, addSupplier].every(function (s) {
    return s.indexOf("'tracking_code_unavailable'") > -1 && s.indexOf('http_response_code(503)') > -1;
  }));

T('رهگیری همچنان تطبیق دقیق code دارد و قالب جدید را اجبار نمی‌کند',
  track.indexOf("($r['code'] ?? '') === $code") > -1 &&
  track.indexOf("($s['code'] ?? '') === $code") > -1 &&
  track.indexOf('preg_match') === -1);
T('fixtureهای کد ترتیبی قدیمی برای پوشش سازگاری عقب‌رو حفظ شده‌اند',
  read('_tools/uat/tester6-bridge.js').indexOf('PTF-RFQ-1404-0007') > -1 &&
  read('_tools/uat/tester6-bridge.js').indexOf('PTF-VEN-1404-0001') > -1);

var rfqSample = 'PTF-RFQ-7K3MW-P9X2R', venSample = 'PTF-VEN-H8Q4N-Z6T3K';
T('نمونه‌های نمایشی استعلام با قالب تصادفی جدید هم‌ترازند',
  rfq.indexOf(rfqSample) > -1 && tracking.indexOf(rfqSample) > -1 && petty.indexOf(rfqSample) > -1);
T('نمونه‌های نمایشی تامین‌کننده با قالب تصادفی جدید هم‌ترازند',
  supplier.indexOf(venSample) > -1 && tracking.indexOf(venSample) > -1);
T('همه نمونه‌ها فقط از الفبای مجاز و قالب ۵+۵ استفاده می‌کنند',
  /^PTF-RFQ-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(rfqSample) &&
  /^PTF-VEN-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(venSample));

console.log('\n' + p + ' PASS / ' + f + ' FAIL');
process.exit(f ? 1 : 0);
