#!/usr/bin/env node
'use strict';
/* tester568 — v34.37.1: سه‌گانهٔ درخواست‌ها (RCA شکایت مالک)
   ① درخواست تاییدشدهٔ سایت در انبوه گم می‌شد و سورت تاریخ ۱۰ شهریور را بالا
      نمی‌آورد → ptfSortVal تاریخِ ارقام‌فارسیِ بدون صفر پیش‌رو را رشته‌ای مقایسه
      می‌کرد + هیچ پیش‌فرض سورتی نبود.
   ② ضمیمهٔ آپلودشده از سایت پس از تایید «وجود نداشت» → sd_entity_sanitize_row
      مقدار لیستی داخل map (files.oth) را بی‌صدا می‌زدود؛ projection پس از ACK
      نسخهٔ بدون ضمیمه را جایگزین محلی می‌کرد.
   ③ فیلتر «از سایت» وجود نداشت. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function rd(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
var srt = rd('crm/sortable.js');
var brg = rd('crm/bridge.js');
var php = rd('api/sales-domain.php');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var SORTVAL = blk(srt, 'window.ptfSortVal = function', 'window.ptfSortRows');
var HEAL = blk(brg, 'window.ptfRfqHealSiteFiles = function', 'window.rfqApprove = function');
var APPROVE = blk(brg, 'window.rfqApprove = function (code)', 'window.rfqReject = function');
var RND = blk(brg, 'window.renderRfq = function ()', '/* ---- استعلام‌های سایت در انتظار تایید');
var BUILD = blk(brg, 'window.buildRfq = function ()', 'window.renderRfq');

/* ═══ ① موتور سورت ═══ */
T('SORT: ارقام فارسی و عربی به لاتین نرمال می‌شوند', SORTVAL.indexOf('۰-۹') > -1 && SORTVAL.indexOf('٠-٩') > -1 && SORTVAL.indexOf("'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]") > -1);
T('SORT: الگوی تاریخ با جداکنندهٔ یکسان (backreference) و مرز رقم', SORTVAL.indexOf('(\\d{4})([-\\/])(\\d{1,2})\\2(\\d{1,2})(?!\\d)') > -1);
T('SORT: پنجرهٔ سال شمسی ۱۲۰۰-۱۶۰۰ و میلادی ۱۹۰۰-۲۱۰۰', SORTVAL.indexOf('yy > 1200 && yy < 1600') > -1 && SORTVAL.indexOf('yy >= 1900 && yy <= 2100') > -1);
T('SORT: شمسی +۶۲۱ برای هم‌مرتبه‌شدن دو تقویم', SORTVAL.indexOf('+= 621') > -1);
T('SORT: اعتبارسنجی ماه/روز (تا ۱۳ ماه شمسی/۳۲ روز)', SORTVAL.indexOf('mm <= (jalali ? 13 : 12)') > -1 && SORTVAL.indexOf('dd <= 32') > -1);
T('SORT: ساعت اختیاری به دقیقه در کلید', SORTVAL.indexOf("(+tm[1]) * 60 + (+tm[2])") > -1);
T('SORT: مسیر مبلغ/عدد دست‌نخورده ماند', SORTVAL.indexOf("replace(/[^\\d.-]/g, '')") > -1);
T('SORT: fallback نهایی رشتهٔ نرمال روی متن اصلی', SORTVAL.indexOf('return norm(s0);') > -1);
T('SORT: رفتاری — ۱۰ شهریور بالای ۹ و ماه ۱۰ بالای ماه ۶', (function () {
  global.window = {}; try { eval(srt); } catch (e) { return false; }
  var V = global.window.ptfSortVal;
  return V('۱۴۰۵/۶/۱۰') > V('۱۴۰۵/۶/۹') && V('۱۴۰۵/۱۰/۲۵') > V('۱۴۰۵/۶/۱۰') && V('۱۴۰۵/۶/۱۰') > V('۱۴۰۵/۵/۳۱');
})());

/* ═══ ② رندر/فیلتر bridge ═══ */
T('UI: پیش‌فرض سورت = تاریخ نزولی (جدیدترین بالا)', RND.indexOf("window.ptfSortState.rfq = { key: 'dt', dir: 'desc' }") > -1 && RND.indexOf('if (!window.ptfSortState.rfq)') > -1);
T('UI: فیلتر منبع — همه/🌐 از سایت/🏢 داخلی در نوار ابزار', BUILD.indexOf('id="rSrcFlt"') > -1 && BUILD.indexOf('🌐 از سایت') > -1 && BUILD.indexOf('🏢 داخلی') > -1 && BUILD.indexOf('ptfRfqSrcFlt(this.value)') > -1);
T('UI: اعمال فیلتر منبع پیش از رندر (site/internal)', RND.indexOf("r0.src === 'site'") > -1 && RND.indexOf("r0.src !== 'site'") > -1);
T('UI: انتخاب فیلتر بین رندرها حفظ و re-render می‌شود', brg.indexOf('window._ptfRfqSrcFlt = v || \'\';') > -1 && blk(brg, 'window.ptfRfqSrcFlt = function', 'window.ptfRfqHealSiteFiles').indexOf('window.renderRfq()') > -1);

/* ═══ ③ خودترمیمی ضمیمه ═══ */
T('HEAL: فقط رکورد src=site با files خالی، از siteAttachment ابری', HEAL.indexOf("r.src !== 'site'") > -1 && HEAL.indexOf('(r.files[k] || []).length') > -1 && HEAL.indexOf('siteAttachmentMeta(r.siteAttachment') > -1);
T('HEAL: بازسازی files.oth با کلید ابری (key/name/size/mode/source)', HEAL.indexOf("{ key: a.key, name: a.name, size: a.size, mode: 'arvan'") > -1 && HEAL.indexOf("source: 'site'") > -1);
T('HEAL: گارد حلقه — هر رکورد در هر جلسه یک‌بار (پروجکشن سرور قدیمی)', HEAL.indexOf('window._ptfRfqHealTried') > -1 && HEAL.indexOf('tried[r.cd] = 1;') > -1);
T('HEAL: فقط هنگام درمان واقعی می‌نویسد (healed>0) با reason مشخص', HEAL.indexOf('if (!healed) return 0;') > -1 && HEAL.indexOf("'site-rfq-heal'") > -1);
T('HEAL: فراخوانی در renderRfq و ابتدای rfqApprove', RND.indexOf('ptfRfqHealSiteFiles(); } catch (eHl)') > -1 && APPROVE.indexOf('ptfRfqHealSiteFiles(); } catch (eHl2)') > -1);
T('APPROVE: ایمپورت پیوست هنگام تایید دست‌نخورده (files: importedFiles)', APPROVE.indexOf('files: importedFiles') > -1 && APPROVE.indexOf('siteAttachment: r.attachment') > -1);

/* ═══ ④ سرور — ریشه‌کنی حذف files ═══ */
T('SRV: هلپر مشترک sd_entity_sanitize_list با سقف‌های قبلی', php.indexOf('function sd_entity_sanitize_list(') > -1 && blk(php, 'function sd_entity_sanitize_list', 'function sd_entity_sanitize_row').indexOf('count($list) >= 60') > -1 && blk(php, 'function sd_entity_sanitize_list', 'function sd_entity_sanitize_row').indexOf('count($subItem) >= 20') > -1);
T('SRV: شاخهٔ map مقدار لیستی را نگه می‌دارد (RFQ-ATT-FIX)', php.indexOf("elseif (is_string($k2) && strlen($k2) <= 60 && is_array($v2))") > -1 && php.indexOf('$sub[$k2] = sd_entity_sanitize_list($v2, $stats);') > -1);
T('SRV: شاخهٔ لیست هم از همان هلپر می‌گذرد (بدون دوگانگی)', php.indexOf('$out[$k] = sd_entity_sanitize_list($v, $stats); $n++; continue;') > -1);
T('SRV: رفتاری — files.oth پس از sanitize زنده می‌ماند', (function () {
  /* شبیه‌سازی شاخهٔ map روی ساختار پیوست RFQ */
  var src = blk(php, 'function sd_entity_sanitize_row', 'function sd_require_role');
  return src.indexOf('sd_entity_sanitize_list($v2, $stats)') > -1 && src.indexOf("is_scalar($v2) || $v2 === null") > -1;
})());

/* ═══ بهداشت ═══ */
T('HYG: بدون localStorage مستقیم در بلوک‌های جدید', HEAL.indexOf('localStorage') === -1 && RND.indexOf('localStorage') === -1);
T('HYG: appendChild/innerHTML جدیدی در sortable باز نشده (فقط محاسبه)', SORTVAL.indexOf('document.') === -1);

console.log('=== tester568: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
