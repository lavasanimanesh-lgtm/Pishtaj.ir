#!/usr/bin/env node
'use strict';
/* tester570 — v34.37.1: استودیو صفحهٔ محصول + تصویر از بیرون
   درخواست مالک: ① عکس از بیرون به صفحهٔ AI-ساخته بدهیم و در صفحه جای‌گذاری شود
   ② پیش از انتشار پیش‌نمایش نمایش داده شود تا اصلاحات انجام شود ③ ثبت موقت
   تغییرات قبل از انتشار. (به‌علاوهٔ همان آپلود/ذخیرهٔ موقت برای فرم صفحهٔ جدید) */
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var p = 0, f = 0;
function T(n, c, d) { if (c) { p++; console.log('PASS', n); } else { f++; console.error('FAIL', n, d === undefined ? '' : d); } }
function rd(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
var cms = rd('crm/cms.js');
var php = rd('api/cms.php');
function blk(src, a, b) { var i = src.indexOf(a); var j = src.indexOf(b, i); return i > -1 && j > i ? src.slice(i, j) : ''; }
var PICK = blk(cms, 'window.cmsImgPick = function', 'window.cmsDraftBtn = function');
var THUMB = blk(cms, 'window.cmsImgThumb = function', 'window.cmsImgPick = function');
var DRAFT = blk(cms, 'window.cmsDraftBtn = function', 'window.cmsPrPreview = function');
var PREV = blk(cms, 'window.cmsPrPreview = function', 'window.cmsPgPreview = function');
var SRV = blk(php, "case 'image_upload':", 'break;', php.indexOf("case 'image_upload'"));

/* ═══ ① آپلود تصویر از بیرون ═══ */
T('UPL: دکمهٔ 📂 در هر دو فرم (محصول + صفحه)', cms.split("cmsImgPick(\\'prImg\\',\\'prBody\\',\\'prSlug\\')").length > 1 && cms.split("cmsImgPick(\\'pgImg\\',\\'pgBody\\',\\'pgSlug\\')").length > 1);
T('UPL: انتخاب فایل با accept تصویری + گیت حجم ۸MB کلاینت', PICK.indexOf('accept=') === -1 && PICK.indexOf("accept = 'image/jpeg,image/png,image/webp,image/gif'") > -1 && PICK.indexOf('8 * 1048576') > -1);
T('UPL: ارسال با api(image_upload) شامل نامک تمیز از فرم', PICK.indexOf("api('image_upload', { file: f, name:") > -1 && PICK.indexOf("replace(/[^a-z0-9\\-]/g, '-')") > -1);
T('UPL: مسیر برگشتی در فیلد تصویر می‌نشیند + dispatchEvent برای پیش‌نویس/شمارنده', PICK.indexOf('host.value = d.path;') > -1 && PICK.indexOf("dispatchEvent(new Event('input'))") > -1);
T('UPL: پیشنهاد درج در متن در محل نشانگر با alt از H1 + escape', PICK.indexOf('درج شود؟') > -1 && PICK.indexOf('selectionStart') > -1 && PICK.indexOf('replace(/"/g, \'\')') > -1);
T('UPL: بندانگشتی زندهٔ تصویر در فرم (oninput + پس از بازیابی پیش‌نویس)', THUMB.indexOf("fieldId + 'Prev'") > -1 && cms.split("cmsImgThumb('prImg')").length > 1 && cms.split("cmsImgThumb('pgImg')").length > 1);

/* ═══ ② پیش‌نمایش قبل از انتشار ═══ */
T('PRV: دکمهٔ 👁 پیش‌نمایش در فرم محصول', cms.indexOf('onclick="cmsPrPreview()"') > -1);
T('PRV: هم‌شکل خروجی نهایی — هیرِ تیره + بج «محصولات» + برند', PREV.indexOf('linear-gradient') > -1 && PREV.indexOf('محصولات') > -1 && PREV.indexOf('واحد تامین پیشرو تجهیز فرتاک') > -1);
T('PRV: بدنه + جدول مشخصات از خطوط «کلید = مقدار»', PREV.indexOf('مشخصات فنی') > -1 && PREV.indexOf("indexOf('=')") > -1);
T('PRV: سوالات متداول به شکل details بازشدنی', PREV.indexOf('سوالات متداول') > -1 && PREV.indexOf('<details') > -1);
T('PRV: تصویر og + جعبهٔ قیمت/موجودی + CTA استعلام', PREV.indexOf('og:image') > -1 && PREV.indexOf('قیمت اعلامی') > -1 && PREV.indexOf('ثبت استعلام هوشمند') > -1);
T('PRV: نوار متا با طول title/desc و نامک نهایی', PREV.indexOf('products/') > -1 && PREV.indexOf('title.length') > -1 && PREV.indexOf('desc.length') > -1);
T('PRV: پیش‌نمایش از مقادیر زندهٔ فرم (اصلاحات قبل از انتشار دیده می‌شود)', PREV.indexOf("document.getElementById(id) || {}).value") > -1);

/* ═══ ③ ثبت موقت قبل از انتشار ═══ */
T('DFT: دکمهٔ 💾 ذخیرهٔ موقت در هر دو فرم', cms.indexOf('cmsDraftBtn(PAGE_FIELDS') > -1 && cms.indexOf('cmsDraftBtn(PROD_FIELDS') > -1);
T('DFT: ذخیره از همان موتور پیش‌نویس ماندگار (cmsDraftSave)', DRAFT.indexOf('cmsDraftSave(fields)') > -1);
T('DFT: پیام روشن «تا پیش از انتشار محفوظ است»', DRAFT.indexOf('تا پیش از انتشار محفوظ است') > -1);
T('DFT: متغیرهای فیلد سراسری شدند (onclick بدون ReferenceError)', cms.indexOf('window.PAGE_FIELDS = PAGE_FIELDS;') > -1 && cms.indexOf('window.PROD_FIELDS = PROD_FIELDS;') > -1);
T('DFT: پیش‌نویس خودکار هنگام آپلود/درج تصویر هم نو می‌شود (dispatchEvent)', PICK.indexOf("ta.dispatchEvent(new Event('input'))") > -1);

/* ═══ ④ سرور — image_upload ═══ */
T('SRV: اعتبارسنجی حجم (حداکثر ۸MB) و فرمت (JPG/PNG/WebP/GIF)', SRV.indexOf('8 * 1048576') > -1 && SRV.indexOf("'webp' => 'image/webp'") > -1);
T('SRV: سلامت واقعی تصویر با getimagesize + تطابق MIME', SRV.indexOf('getimagesize') > -1 && SRV.indexOf("!== $imimes[$iext]") > -1);
T('SRV: نام فایل کنترل‌شده (نرمال‌سازی نامک + زمان + تصادفی) — بدون پیمایش مسیر', SRV.indexOf("preg_replace('/[^a-z0-9\\-]+/', '-'") > -1 && SRV.indexOf('Ymd-His') > -1);
T('SRV: ذخیره در assets/images با mkdir و chmod و لاگ CMS', SRV.indexOf("'/assets/images'") > -1 && SRV.indexOf('move_uploaded_file') > -1 && SRV.indexOf("cms_log('image_upload'") > -1);
T('SRV: پاسخ ساخت‌یافته {path,url,w,h}', SRV.indexOf("'path' => 'assets/images/'") > -1 && SRV.indexOf("'w' =>") > -1);

/* ═══ بهداشت ═══ */
T('HYG: نقشهٔ guards موجود دست‌نخورده (cms_backup/product_create)', php.indexOf('function cms_backup') > -1 && php.indexOf("case 'product_create'") > -1);
T('HYG: بدون localStorage جدید (پیش‌نویس همان devkv)', PICK.indexOf('localStorage') === -1 && DRAFT.indexOf('localStorage') === -1 && PREV.indexOf('localStorage') === -1);

console.log('=== tester570: ' + p + ' PASS / ' + f + ' FAIL ===');
process.exit(f ? 1 : 0);
