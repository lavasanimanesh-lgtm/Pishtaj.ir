#!/usr/bin/env node
'use strict';
/* tester551 — v34.8.51 (PRE-PROD): تنظیمات متناسب با وضعیت فعلی + آمادگی پروداکشن
   (۱) جعبهٔ «حالت سرور-محور» قدیمی (۴ دکمهٔ فعال/غیرفعال/همگرایی/پاک‌سازی) به جعبهٔ
   «وضعیت دستگاه» status-aware تبدیل شد: دستگاه منتقل‌نشده → CTA «انتقال یک‌باره»
   (= همان مسیر مهاجرت هر دستگاهِ پروداکشن پس از دیپلوی)؛ دستگاه منتقل‌شده →
   وضعیت سبز + صف آفلاین. دکمه‌های خاموش/روشن از UI حذف (بازگشت به legacy با
   حذف موتور در v34.14.0 ناسازگار بود).
   (۲) ptfBStatus(): خوانندهٔ واحد وضعیت (enabled/synced/queue/localPayload).
   (۳) هستهٔ آمادگی پروداکشن: زنجیرهٔ ورود مقاوم (47/48/50) + پیش‌فرض 2FA خاموش
   (49) + صف آفلاین IDB پایدار + مرورگرهای قدیمی prod (fallback نشست LS). */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var bak = read('crm/backup.js');
var cs = read('crm/client-server.js');
var rb = read('crm/rbac.js');
var ih = read('crm/index.html');
var php = read('api/crm.php');

/* ═══ ۱) جعبهٔ وضعیت دستگاه ═══ */
T('backup.js: جعبهٔ وضعیت device-status با ptfBStatus', bak.indexOf('(typeof window.ptfBStatus === \'function\')') > -1 && bak.indexOf('window.ptfBStatus()') > -1);
T('backup.js: دو حالت سبز/کهربایی بر اساس enabled', bak.indexOf('🖥 وضعیت دستگاه: سرور-محور فعال') > -1 && bak.indexOf('🖥 وضعیت دستگاه: در انتظار انتقال یک‌باره') > -1);
T('backup.js: پاک‌سازی کش فقط در سبزِ کامل؛ حالت ناتمام/منتقل‌نشده دکمهٔ انتقال دارند (v34.14.0 سه‌حالته)', (function () { var i = bak.indexOf('انتقال یک‌بارهٔ داده‌های این دستگاه'); var j = bak.indexOf('ptfBClearLocalCache()'); var g = bak.indexOf('var green = on && synced;'); var fin = bak.indexOf("'تکمیل انتقال یک‌باره'"); return i > -1 && j > -1 && g > -1 && fin > -1 && /\(green\s*\?\s*'[^']*ptfBClearLocalCache[^']*'\s*:\s*'[^']*ptfBConfirmFlush/.test(bak.slice(g - 100, g + 2400)); })());
T('backup.js: صف آفلاین در وضعیت سبز شفاف است', bak.indexOf('تغییر در صف آفلاین است و با اتصال پایدار خودکار ارسال می‌شود') > -1);
T('backup.js: دکمهٔ پاک‌سازی کش محلی موجود (گارد سرور: فقط دستگاه منتقل‌شده)', bak.indexOf('ptfBClearLocalCache()') > -1);
T('backup.js: هیچ دکمهٔ فعال/غیرفعال‌سازی دستی در UI نیست', bak.indexOf('onclick="ptfBEnable()"') === -1 && bak.indexOf('onclick="ptfBDisable()"') === -1);
T('متن قدیمی «راه‌حل دائمی پر شدن حافظه» حذف شد', bak.indexOf('راه‌حل دائمی پر شدن حافظه') === -1);

/* ═══ ۲) ptfBStatus در client-server.js ═══ */
T('client-server.js: ptfBStatus روی window با ۴ فیلد', (function () { var i = cs.indexOf('window.ptfBStatus = function ()'); var seg = cs.slice(i, cs.indexOf('window.ptfBDisable')); return i > -1 && seg.indexOf('enabled: !!getFlag()') > -1 && seg.indexOf('synced: !!isSynced()') > -1 && seg.indexOf('queue: Object.keys(queueRead()).length') > -1 && seg.indexOf('localPayload: hasLocalBusinessPayload()') > -1; })());
T('client-server.js: ptfBStatus fail-safe (خطا = وضعیت خنثی، نه crash)', /window\.ptfBStatus[\s\S]{0,500}catch \(e\) \{ return \{ enabled: false[\s\S]{0,120}error: ''\+/i.test(cs) || /catch \(e\) \{ return \{ enabled: false/.test(cs.slice(cs.indexOf('window.ptfBStatus'), cs.indexOf('window.ptfBStatus') + 700)));
T('توابع ptfBEnable/ptfBDisable برای سازگاری ابزارها باقی‌اند (خارج از UI)', cs.indexOf('window.ptfBEnable = function') > -1 && cs.indexOf('window.ptfBDisable = function') > -1);

/* ═══ ۳) رفتاری — vm: ptfBStatus در دو وضعیت ═══ */
function sliceFn(src, header) {
  var i = src.indexOf(header); if (i < 0) throw new Error('anchor: ' + header);
  var depth = 0, seen = false;
  for (var j = i; j < Math.min(i + 25000, src.length); j++) {
    var c = src[j];
    if (c === '{') { depth++; seen = true; }
    else if (c === '}') { depth--; if (seen && depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced');
}
/* استخراج وابستگی‌های ptfBStatus: flagKey/syncedKey/getFlag/isSynced/queueRead/hasLocalBusinessPayload —
   برای vm، نسخه‌های سبک درون sandbox تزریق می‌شوند و فقط بدنهٔ ptfBStatus واقعی اجرا می‌شود. */
var stSrc = sliceFn(cs, 'window.ptfBStatus = function ()');
var sb = {
  localStorage: (function () { var m = {}; return { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m }; })(),
  window: {}, console: console
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(stSrc + '\nglobalThis.__st = ptfBStatus;', sb);
sb.getFlag = function () { return sb.localStorage.getItem('ptf_b_phase') === '1'; };
sb.isSynced = function () { return sb.localStorage.getItem('ptf_b_synced') === '1'; };
sb.queueRead = function () { return {}; };
sb.hasLocalBusinessPayload = function () { return true; };
/* حالت ۱: پرچم خاموش + دادهٔ محلی = دستگاه در انتظار انتقال */
var s1 = sb.__st();
T('رفتاری: دستگاه legacy → enabled=false, localPayload=true', s1.enabled === false && s1.localPayload === true);
/* حالت ۲: پرچم روشن + همگرایی‌شده = سبز */
sb.localStorage.setItem('ptf_b_phase', '1');
sb.localStorage.setItem('ptf_b_synced', '1');
var s2 = sb.__st();
T('رفتاری: دستگاه منتقل‌شده → enabled=true, synced=true', s2.enabled === true && s2.synced === true && s2.queue === 0);

/* ═══ ۴) آمادگی پروداکشن — قراردادهای حیاتی دیپلوی ═══ */
T('ورود: 2FA پیامکی پیش‌فرض خاموش (49)', php.indexOf("($s['twofa_enabled'] ?? false) === true") > -1);
T('ورود: auth_login_otp همچنان public (خاموش ولی آماده)', php.indexOf("'auth_login', 'auth_login_otp'") > -1);
T('ورود: زنجیرهٔ مخزن نشست = SS→LS→حافظه + خواندن-باز (50)', rb.indexOf("!== String(token || '')) throw new Error('phantom')") > -1 && rb.indexOf('PTF_SESS_MEM') > -1);
T('ورود: مرورگر قدیمی prod — fallback نشست LS + مسیر reauth روشن', rb.indexOf("JSON.parse(localStorage.getItem('ptf_crm_session'))") > -1 && read('crm/sync.js').indexOf('reauth') > -1);
T('مهاجرت: بوتِ دستگاه دارای دادهٔ محلی خودکار destructive نمی‌شود (fail-closed)', cs.indexOf("if (hasLocalBusinessPayload() || Object.keys(queueRead()).length) return { ok: false, reason: 'existing_local_data' };") > -1);
T('مهاجرت: مسیر خالی (دستگاه تازه) فاز B را خودکار فعال می‌کند', cs.indexOf("مسیر خالی هم (دستگاه بدون دادهٔ محلی) فاز B را فعال می‌کند") > -1 || cs.indexOf("ptfBEnableAfterConvergence(); } catch (eEnableEmpty)") > -1);
T('صف آفلاین: پایدار در IndexedDB (نه LS)', cs.indexOf("OFFLINE-OUTBOX-IDB") > -1);
T('سرور: سقف نرخ فرمان‌های نوشتاری فعال (60/60s)', read('api/sales-domain.php').indexOf('CMD-RATE-LIMIT') > -1);
T('ابزار ریکاوری: چهار صفحه IDB-aware مستقرند', ['clear-cache.html', 'force-restore.html', 'recover.html', 'sync-diagnostics.html'].every(function (x) { return read('crm/' + x).indexOf('ptfIdbStats') > -1; }));

console.log('\n== tester551: ' + p + ' PASS / ' + f + ' FAIL ==');
process.exit(f ? 1 : 0);
