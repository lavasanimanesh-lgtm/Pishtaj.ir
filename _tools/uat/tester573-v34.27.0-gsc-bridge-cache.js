#!/usr/bin/env node
'use strict';
/* tester573 — v34.29.7: کش‌سنجی + گارد مسیر + پل سرچ کنسول
   گزارش‌ها: «تب صفحهٔ جدید و کیفیت خالی‌اند» (با وجود گاردهای 26.1 → احتمال کش
   سرویس‌ورکر) + درخواست: ثبت سایت‌مپ در سرچ کنسول و درخواست ایندکس یک‌کلیکی. */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
var cms = fs.readFileSync(path.join(ROOT, 'crm/cms.js'), 'utf8');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var STALE = cms.slice(cms.indexOf('STALE-CACHE')); /* تا انتهای فایل */
var GSC = blk(cms, 'GSC-BRIDGE', 'window.cmsSeoIssue = function');
var PANEL = blk(cms, "var _go = window.goPanel;", '})();')

/* ═══ A) کش‌سنجی ═══ */
T('CACHE: نشانگر نسخهٔ فایل (PTF_CMS_JS_VER) در بارگذاری ثبت می‌شود', cms.indexOf("window.PTF_CMS_JS_VER = 'v34.29.7';") > -1);
T('CACHE: ناهماهنگی VER پوسته با نسخهٔ فایل → بنر قرمز مرئی با نسخهٔ هر دو', STALE.indexOf('window.VER !== window.PTF_CMS_JS_VER') > -1 && STALE.indexOf('فایل برنامهٔ مدیریت سایت در مرورگر شما قدیمی است') > -1);
T('CACHE: دکمهٔ پاک‌سازی = حذف ثبت SW + حذف caches + ریلود', STALE.indexOf('getRegistrations') > -1 && STALE.indexOf('r.unregister()') > -1 && STALE.indexOf('caches.delete(k)') > -1 && STALE.indexOf('location.reload(true)') > -1);

/* ═══ B) گارد مسیر CMS ═══ */
T('GUARD: ساخت پنل CMS (buildCms+renderCms) در try/catch با پیام مرئی', PANEL.indexOf('catch (eCmsBuild)') > -1 && PANEL.indexOf('خطای ساخت پنل مدیریت سایت') > -1);
T('GUARD: گاردهای قبلی 26.1 سرجای‌اند (TAB-GUARD + پوستهٔ صفحه)', cms.indexOf('TAB-GUARD') > -1 && cms.indexOf('renderCmsPageNewFull') > -1);

/* ═══ C) سایت‌مپ + سرچ کنسول ═══ */
T('SM: دکمهٔ 📤 سایت‌مپ + سرچ کنسول در نوار ابزار سئو', cms.indexOf('onclick="cmsSeoSitemapPush()"') > -1);
T('SM: ثبت sitemap-index از طریق اکشن موجود sitemap_submit (gsc.php)', GSC.indexOf("cmsGsc('sitemap_submit', { feed: 'https://pishtaj.ir/sitemap-index.xml' }") > -1);
T('SM: نتیجه با وضعیت/خطا/آخرین دانلود گوگل گزارش می‌شود', GSC.indexOf('d.state') > -1 && GSC.indexOf('d.lastDownload') > -1);
T('SM: ثبت خودکار پس از انتشار (cmsSitemapAfterPublish) در مسیر صفحه و محصول موجود است', cms.indexOf('cmsSitemapAfterPublish();') > -1 && cms.indexOf('function cmsSitemapAfterPublish') > -1);

/* ═══ D) ایندکس‌یاب ═══ */
T('IDX: دکمهٔ 🚀 ایندکس‌یاب در نوار ابزار سئو', cms.indexOf('onclick="cmsIndexWizard()"') > -1);
T('IDX: ویزارد فهرست صفحات را از اسکن سئو می‌گیرد (seoLoad اگر خالی)', GSC.indexOf('seoLoad(fill)') > -1 && GSC.indexOf('_cmsPages') > -1);
T('IDX: بررسی متوالی با اکشن inspect موجود + سقف ۲۵ صفحه و فاصله', GSC.indexOf("cmsGsc('inspect', { url: 'https://pishtaj.ir/' + p, log: '1' }") > -1 && GSC.indexOf('paths.length > 25') > -1 && GSC.indexOf('setTimeout(next, 250)') > -1);
T('IDX: دسته‌بندی INDEXED/غیرآن با verdی و coverage از API رسمی', GSC.indexOf("d.verdict === 'INDEXED'") > -1 && GSC.indexOf('d.coverage') > -1);
T('IDX: برای ایندکس‌نشده‌ها پیوند «درخواست ایندکس ↗» از inspectLink خود گوگل', GSC.indexOf('d.inspectLink') > -1 && GSC.indexOf('درخواست ایندکس ↗') > -1);
T('IDX: صداقت دربارهٔ محدودیت API گوگل در متن ویزارد', GSC.indexOf('Request Indexing API عمومی ندارد') > -1);
T('IDX: بازارسال سایت‌مپ داخل ویزارد هم هست', GSC.indexOf('📤 بازارسال سایت‌مپ') > -1);
T('IDX: ثبت در تاریخچهٔ بازرسی سرور (log=1) برای پایش', GSC.indexOf("log: '1'") > -1);

/* ═══ بهداشت ═══ */
T('HYG: پل cmsGsc همان هدرهای احراز CMS را می‌فرستد (cmsAuthHeaders)', GSC.indexOf('headers: cmsAuthHeaders()') > -1);
T('HYG: بدون localStorage جدید', STALE.indexOf('localStorage') === -1 && GSC.indexOf('localStorage') === -1);

console.log('=== tester573: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
