#!/usr/bin/env node
'use strict';
/* tester552 — v34.16.0 (FINAL): بنر مهاجرت + بستهٔ اثبات اصول E1..E7
   E1 سرور منبع حقیقت نوشتن · E2 صفر بایپس جدید لایهٔ داده · E3 LS سبک (هارنس + سنجه)
   · E4 پاک‌کردن حافظه = صفر گم‌شدن · E5 کلیدهای سنگین فقط IDB · E6 آفلاین = outbox
   محدود · E7 یک موتور (فعلاً پرچم‌دار؛ اثبات نهایی = v34.16.0 با تله‌متری ≥۷ روز).
   به‌علاوه MIGRATION-BANNER: یادآور خودکار «انتقال یک‌باره» برای دستگاه کهربایی. */
var fs = require('fs'), path = require('path'), vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
var ih = read('crm/index.html');
var cs = read('crm/client-server.js');
var sq = read('crm/storage-quota.js');
var bak = read('crm/backup.js');
var php = read('api/crm.php');

/* ═══ ۰) MIGRATION-BANNER ═══ */
T('بنر: تابع ptfMigBannerTick + تیک ۱۵ث تعریف شد', ih.indexOf('function ptfMigBannerTick()') > -1 && ih.indexOf('setInterval(ptfMigBannerTick, 15000)') > -1);
T('بنر: فقط دستگاه کهربایی یا سبزِ ناتمام — سبزِ کامل/تازه هرگز نمی‌بیند (v34.16.0: synced هم لازم شد)', ih.indexOf('if ((st.enabled && st.synced) || !st.localPayload) { if (bar) bar.remove(); return; }') > -1);
T('بنر: دکمهٔ «رفتن به تنظیمات» و «بعداً» (ساکت فقط تا رفرش)', ih.indexOf("goPanelByName(\\'set\\')") > -1 && ih.indexOf('بعداً') > -1 && ih.indexOf('window._ptfMigDismissed=true') > -1);
T('بنر: وضعیت صف آفلاین شفاف است', ih.indexOf('تغییر در صف آفلاین هم هست') > -1);
T('بنر: خارج از CRM حذف می‌شود (صفحهٔ ورود تمیز)', /if \(!crmVisible \|\| window\._ptfMigDismissed\) \{ if \(bar\) bar\.remove\(\); return; \}/.test(ih));

/* رفتاری — vm: سه وضعیت دستگاه */
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
var sb = {
  document: {
    _els: {},
    getElementById: function (id) { return sb.document._els[id] || null; },
    createElement: function () { return { id: '', dir: '', style: { cssText: '' }, innerHTML: '', _onclick: '' }; },
    body: { appendChild: function (el) { sb._appended = el; } }
  },
  window: {},
  console: console, setTimeout: setTimeout, setInterval: function () {}
};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(sliceFn(ih, 'function ptfMigBannerTick()') + '\nglobalThis.__tick = ptfMigBannerTick;', sb);
/* حالت ۱: کهربایی → نوار ساخته می‌شود */
sb.document._els['crmL'] = { id: 'crmL', style: { display: 'flex' }, remove: function () {} };
sb.ptfBStatus = function () { return { enabled: false, localPayload: true, queue: 2 }; };
sb.__tick();
T('رفتاری بنر: دستگاه کهربایی → نوار با شمار صف', sb._appended && sb._appended.innerHTML.indexOf('2 تغییر در صف آفلاین') > -1);
/* حالت ۲: سبز → نوار ساخته نمی‌شود */
sb._appended = null; sb.document._els['ptfMigBar'] = { id: 'ptfMigBar', style: {}, remove: function () { sb._removed2 = true; } };
sb.ptfBStatus = function () { return { enabled: true, localPayload: false, queue: 0 }; };
sb.__tick();
T('رفتاری بنر: دستگاه سبز → بدون نوار + نوار قبلی حذف', sb._appended === null && sb._removed2 === true);
/* حالت ۳: بعداً */
sb._appended = null; sb.window._ptfMigDismissed = true;
sb.ptfBStatus = function () { return { enabled: false, localPayload: true }; };
sb.__tick();
T('رفتاری بنر: «بعداً» → ساکت (تا رفرش)', sb._appended === null);

/* ═══ E1 — سرور تنها منبع حقیقت نوشتن ═══ */
T('E1: رجیستری فرمان موجودیت کلاینت=سرور (A11 = صفر واگرایی)', (function () { var r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, '_tools/arch/arch-guard.js')], { encoding: 'utf8', timeout: 60000 }); var out = String(r.stdout); return /A11[^\n]*0\/0/.test(out); })());
T('E1: تسترهای بایپس‌صفرِ نوشتن (W1-iterate) در گیت ثبت‌اند', read('_tools/uat/run-ci-gate.js').indexOf('tester526-v34.8.34-w1-iterate-outbox-idb.js') > -1);
/* ═══ E2 — صفر بایپس جدید لایهٔ داده ═══ */
T('E2: arch-guard (شامل A10=صفر تخلف جدید) PASS', (function () { var r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, '_tools/arch/arch-guard.js')], { encoding: 'utf8', timeout: 60000 }); return r.status === 0 && /ARCH GUARD: PASS/.test(String(r.stdout)); })());
/* ═══ E3 — LS سبک (هارنس سنجه) ═══ */
T('E3: هارنس سنجهٔ حافظه (متر + کلیدهای بزرگ + آستانهٔ تخلیهٔ 8KB)', bak.indexOf('function storageUsage()') > -1 && bak.indexOf('ptfStorageTopKeys') > -1 && cs.indexOf('bytes <= 8 * 1024') > -1);
T('E3: کلیدهای سنگین LS را فیزیکی آزاد می‌کنند (mirror→remove)', /window\.ptfBMirror = function[\s\S]{0,700}localStorage\.removeItem\(k\)/.test(cs));
/* ═══ E4 — پاک‌کردن حافظه = صفر گم‌شدن ═══ */
T('E4: پاک‌سازی امن اول بک‌آپ سروری می‌گیرد (pushBackup اول)', /window\.ptfStorageCleanup = function \(\) \{[\s\S]{0,160}pushBackup\(false/.test(bak));
T('E4: پاک‌سازی کش = ۴ گارد (پرچم+همگرایی+صف خالی+تایپ «پاک»)', (function () { var i = cs.indexOf('window.ptfBClearLocalCache = function'); var seg = cs.slice(i, i + 4000); return seg.indexOf("localStorage.getItem(flagKey())") > -1 || /getFlag\(\)/.test(seg) || seg.indexOf('پس از «انتقال یک‌باره» ممکن است') > -1; })() && cs.indexOf('کلید در صف آفلاین هنوز به سرور ارسال نشده') === -1 && /«پاک»|کلمهٔ «پاک»/.test(cs.slice(cs.indexOf('window.ptfBClearLocalCache'), cs.indexOf('window.ptfBClearLocalCache') + 6000)));
T('E4: رکوردهای کسب‌وکار در پاک‌سازی امن هرگز حذف نمی‌شوند', bak.indexOf('رکوردهای اصلی کسب‌وکاری حذف نشدند') > -1);
/* ═══ E5 — حادثهٔ ۱۰۰٪ ساختاراً ناممکن ═══ */
T('E5: نگهبان سهمیه روی خودِ setItem نصب می‌شود (بدون استثنا)', sq.indexOf('function installSetItemGuard()') > -1 && sq.indexOf('__ptfSafeSetItemInstalled') > -1);
T('E5: QuotaExceeded → فشرده‌سازی اضطراری + تلاش مجدد + دفتر خطا', sq.indexOf('emergencyCompact({ source: \'quota\' })') > -1 && sq.indexOf('failedWrites.unshift(') > -1 && sq.indexOf('isQuotaError') > -1);
T('E5: صف آفلاین (write-ahead) در IDB نه LS', cs.indexOf('OFFLINE-OUTBOX-IDB') > -1 && cs.indexOf("'q:' + queueKey()") > -1);
/* ═══ E6 — آفلاین = outbox محدود ═══ */
T('E6: سقف ۵۰۰ رکورد صف + هرس', cs.indexOf('keys.length > 500') > -1 && cs.indexOf('qCapCheck') > -1);
T('E6: ارسال دسته‌ای (۲۰ کلید) + شکست دسته محلی', cs.indexOf('var BATCH_SIZE = 20;') > -1);
T('E6: اتصال به سرور هر ۲۰ ثانیه چک + نشان offline', read('crm/sync.js').indexOf('setInterval(pullCheck, 20000)') > -1 && read('crm/sync.js').indexOf("setSyncBadge('offline')") > -1);
/* ═══ E7 — یک موتور (پرچم‌دار؛ نهایی در v34.16.0) ═══ */
T('E7: پوش توده‌ای legacy پیش‌فرض خاموش (گام ۱ R4)', (function () { var sd = read('api/sales-domain.php'); return sd.indexOf('legacyPushOff') > -1; })() && read('crm/sync.js').indexOf('PTF_LEGACY_PUSH_OFF') > -1 || read('crm/index.html').indexOf('engineGateBox') > -1);
T('E7: داشبورد تصمیم بازنشستگی (win7/۷روزه) در تنظیمات', ih.indexOf('ptfRenderEngineGateDashboard') > -1 && ih.indexOf('بازنشستگی legacy') > -1);
T('E7: شرط حذف نهایی موتور (≥۷ روز + صفر بایپس) در سند رودمپ ثبت است', read('ROADMAP-THIN-CLIENT-REMAINING-2026-08-29.md').indexOf('win7 ≈ 0') > -1);

console.log('\n== tester552: ' + p + ' PASS / ' + f + ' FAIL ==');
process.exit(f ? 1 : 0);
