/* tester303 — v33.22.2 (ساده‌سازی بخش تنظیمات بک‌آپ/حافظه — به درخواست مستقیم کارفرما)
 * چرا: کارفرما گفت «اگر دکمه‌ای نیاز نیست یا توضیحات اضافه‌ای هست حذف شود که باعث سردرگمی
 * کاربران نشود». بخش بک‌آپ ۸ دکمه داشت (از جمله «بررسی اتصال سرور» و «پاک‌سازی زباله‌های ابری»)
 * و بخش حافظه ۶ دکمه (از جمله «بک‌آپ سروری» = دقیقاً همان «بک‌آپ فوری») + توضیحات فنی طولانی
 * (Browser storage estimate، سقف محافظه‌کارانه، اشاره به DB-MIG-001 که دیگر تمام‌شده است).
 * قواعد:
 *  ۱) دکمه‌های حذف‌شده دیگر به‌صورت onclick در UI نیستند
 *  ۲) توابع/موتورشان دست‌نخورده می‌ماند (تسترهای قدیمی فانکشن را pin کرده‌اند)
 *  ۳) دکمه‌های ضروری (بک‌آپ فوری، دانلود فایل، دانلود ماهانه، بازگردانی، بک‌آپ‌های سرور،
 *     بررسی کدهای تکراری، پاک‌سازی امن فوری + هر ۴ دکمهٔ فاز B) باقی‌اند
 *  ۴) ارجاعات کهنه در متن‌ها (DB-MIG-001 به‌عنوان «برنامهٔ آینده») به وضعیت فعلی اصلاح شده
 *  ۵) بامپ نسخه همگام (خوانده‌شده از index.html)
 */
'use strict';
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var bak = fs.readFileSync(path.join(ROOT, 'crm/backup.js'), 'utf-8');
var idx = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(ROOT, 'crm/sw.js'), 'utf-8');
var cc = fs.readFileSync(path.join(ROOT, 'crm/clear-cache.html'), 'utf-8');

SECTION('دکمه‌های حذف‌شده (onclick در UI نیست — سردرگمی صفر)');
T('«بررسی اتصال سرور» و «پاک‌سازی زباله‌های ابری» از باکس بک‌آپ حذف شدند',
  bak.indexOf('onclick="ptfBackupServerCheck()"') === -1 && bak.indexOf('onclick="ptfPurgeCloudOrphans()"') === -1);
T('دکمه‌های مضاعف حافظه حذف شدند (بک‌آپ سروری تکراری / مهاجرت جدا / نمایش کلیدها / آرشیو / Persistent)',
  bak.indexOf('onclick="ptfBackupNow()">بک‌آپ سروری') === -1 &&
  bak.indexOf('onclick="ptfStorageMigrateToIdb()"') === -1 &&
  bak.indexOf('onclick="if(window.ptfStorageShowLargeKeys)ptfStorageShowLargeKeys()"') === -1 &&
  bak.indexOf('onclick="if(window.ptfStorageShowArchiveIndex)ptfStorageShowArchiveIndex()"') === -1 &&
  bak.indexOf('onclick="if(window.ptfStorageRequestPersistent)ptfStorageRequestPersistent()"') === -1);

SECTION('دکمه‌های ضروری دست‌نخورده');
T('۵ دکمهٔ اصلی بک‌آپ + بررسی کدهای تکراری باقی‌اند',
  bak.indexOf('onclick="ptfBackupNow()">🗄 بک‌آپ فوری') > -1 &&
  bak.indexOf('onclick="ptfBackupDownload()"') > -1 &&
  bak.indexOf('onclick="ptfDownloadMonthly()"') > -1 &&
  bak.indexOf('onclick="ptfRestorePick()"') > -1 &&
  bak.indexOf('onclick="ptfServerBackups()"') > -1 &&
  bak.indexOf('onclick="ptfDuplicateRepairOpen()"') > -1);
T('تک‌دکمهٔ حافظه: «پاک‌سازی امن فوری» (خودش ابتدا مهاجرت IDB را هم صدا می‌زند)',
  bak.indexOf('onclick="ptfStorageCleanup()">پاک‌سازی امن فوری') > -1 &&
  bak.indexOf('ptfStorageMigrateVolatileToIdb({ source: \'manual-cleanup\'') > -1);
T('جعبهٔ وضعیت دستگاه (v34.21.0): انتقال یک‌باره + پاک‌سازی کش — بدون دکمهٔ خاموش/روشن قدیمی',
  bak.indexOf('onclick="ptfBConfirmFlush()"') > -1 &&
  bak.indexOf('ptfBClearLocalCache()') > -1 &&
  bak.indexOf('onclick="ptfBEnable()"') === -1 &&
  bak.indexOf('onclick="ptfBDisable()"') === -1);

SECTION('توابع موتورهای حذف‌شده از UI دست‌نخورده‌اند');
T('ptfBackupServerCheck/Status و ptfPurgeCloudOrphans و ptfStorageMigrateToIdb موجوداند',
  bak.indexOf('window.ptfBackupServerCheck = function') > -1 &&
  bak.indexOf('window.ptfBackupServerStatus = function') > -1 &&
  fs.readFileSync(path.join(ROOT, 'crm/storage.js'), 'utf-8').indexOf('window.ptfPurgeCloudOrphans = function') > -1 &&
  bak.indexOf('window.ptfStorageMigrateToIdb = function') > -1);

SECTION('توضیحات کهنه/فنی اصلاح شد');
T('متن حافظه کاربرمحور شد (کش مرورگر + دادهٔ اصلی روی سرور) و جزئیات فنی حذف شد',
  bak.indexOf('فقط کش دستگاه شما پر شده') > -1 &&
  bak.indexOf('Browser storage estimate') === -1 &&
  bak.indexOf('برنامهٔ DB-MIG-001') === -1);
T('عنوان وضعیت دستگاه با نشان 🖥 و دو حالت روشن/در انتظار (v34.21.0)', bak.indexOf('🖥 وضعیت دستگاه: سرور-محور فعال') > -1 && bak.indexOf('🖥 وضعیت دستگاه: در انتظار انتقال یک‌باره') > -1);
T('راهنمای اعلان پاک‌سازی به جعبهٔ وضعیت دستگاه ارجاع می‌دهد (v34.21.0)',
  bak.indexOf('وضعیت دستگاه') > -1 &&
  bak.indexOf('بزرگ‌ترین کلیدها (اگر از نوع دادهٔ اصلی‌اند') > -1 /* چک tester294 پابرجا */);

SECTION('نسخه‌گذاری');
var vm = idx.match(/window\.PTF_CRM_RELEASE = '(v[\d.]+)'/);
/* v33.22.3: خواندن VER از index (مقاوم به بامپ‌های بعدی — دیگر رشتهٔ ثابت نسخه pin نمی‌شود) */
T('بامپ نسخه همگام (index + sw + clear-cache)', !!vm && /^v\d+\.\d+\.\d+$/.test(vm[1]) && sw.indexOf("var RELEASE = '" + vm[1] + "'") > -1 && cc.indexOf(vm[1]) > -1);

DONE('tester303-settings-backup-simplify');
