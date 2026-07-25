/* tester216 — v31.7.39 (UI-MIN-ICON-001)
 * New/strategic website CTA icons should be minimal, not emoji-heavy.
 */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
var ui = fs.readFileSync(path.join(ROOT, 'tools/tools-ui.js'), 'utf-8');
var myday = fs.readFileSync(path.join(ROOT, 'crm/myday.js'), 'utf-8');

SECTION('Home journey icons minimal');
var m = idx.match(/<section class="section" id="journey"[\s\S]*?<\/section>/);
var seg = m ? m[0] : '';
T('سکشن journey وجود دارد', !!seg);
T('emojiهای بزرگ مسیر سریع حذف شده‌اند', ['🧾','⚙️','🔎','🏭'].every(function (x) { return seg.indexOf(x) === -1; }));
T('به جای emoji/badge عددی، چهار آیکون خطی semantic وجود دارد', (seg.match(/class="ptf-line-icon"/g) || []).length === 4 && ['>01<','>02<','>03<','>04<'].every(function (x) { return seg.indexOf(x) === -1; }) && seg.indexOf('<svg viewBox="0 0 24 24"') > -1);
T('رویدادهای journey حفظ شده‌اند', ['journey_buyer_rfq','journey_engineer_tools','journey_customer_tracking','journey_supplier_signup'].every(function (x) { return seg.indexOf(x) > -1; }));

SECTION('Tools/MyDay added UI minimalized');
T('دکمه PDF ابزارها بدون emoji lock است', ui.indexOf('گزارش PDF کامل (فعال‌سازی)') > -1 && ui.indexOf('گزارش PDF کامل 🔒') === -1);
T('پیام‌های فعال‌سازی ابزارها بدون emoji check/error جدید هستند', ui.indexOf('✅ فعال‌سازی') === -1 && ui.indexOf('⛔ فعال‌سازی') === -1);
T('دکمه پاکسازی تکراری‌ها در MyDay بدون emoji broom است', myday.indexOf('🧹 پاکسازی تکراری‌ها') === -1 && myday.indexOf('پاکسازی تکراری‌ها') > -1);
T('حذف MyDay با × مینیمال باقی مانده است', myday.indexOf('>×</button>') > -1);

DONE('tester216-minimal-icons-policy');
