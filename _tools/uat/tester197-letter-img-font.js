/* tester197 — v31.7.22 (US-LTR-IMG + BUG-LTR-FONT-001)
 * گزارش کارفرما: ۱) امکان افزودن تصاویر به متن نامه در مکاتبات؛
 * ۲) متن نامه فونت یاقوت دارد ولی «بسمه تعالی»، عنوان گیرنده و موضوع این فونت را ندارند.
 * ریشه فونت: یاقوت وزن Bold مستقل ندارد؛ عناصر بولد (to/sub با weight:700) در برخی
 * مرورگرها به فونت بولددار دیگری از پشته fallback می‌شدند — نیاز به font-family صریح + font-synthesis. */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var lt = fs.readFileSync(path.join(ROOT, 'crm/letters.js'), 'utf-8');

SECTION('BUG-LTR-FONT-001: فونت یاقوت برای بسمه تعالی/گیرنده/سمت/موضوع');
T('قاعده صریح font-family برای bsm/to/torl/sub', lt.indexOf('BUG-LTR-FONT-001') > -1 && /\.bsm,\.to,\.torl,\.sub\{font-family:' \+ font \+ ';font-synthesis:weight style\}/.test(lt));
T('قاعده قبل از تعریف کلاس‌ها درج شده (cascade درست)', lt.indexOf('.bsm,.to,.torl,.sub{font-family:') < lt.indexOf(".to{font-weight:700"));
T('پشته فونت یاقوت دست‌نخورده (LETTER_FONT_FA)', /LETTER_FONT_FA = "'Geeza Pro','Baghdad','DecoType Naskh','B Yaghut'/.test(lt));

SECTION('US-LTR-IMG: افزودن تصویر به نامه');
T('UI: دکمه افزودن تصویر + thumbs + input فایل', lt.indexOf('ltImgFile') > -1 && lt.indexOf('ltImgThumbs') > -1 && lt.indexOf('📤 افزودن تصویر') > -1);
T('فشرده‌سازی canvas (حداکثر 900px، jpeg 0.82) مثل الگوی آواتار', /MAX = 900/.test(lt) && /toDataURL\('image\/jpeg', 0\.82\)/.test(lt));
T('سقف ۳ تصویر + سقف حجم پس از فشرده‌سازی', lt.indexOf('حداکثر ۳ تصویر برای هر نامه') > -1 && /data\.length > 350000/.test(lt));
T('شرح (caption) اختیاری برای هر تصویر', /placeholder="شرح \(اختیاری\)"/.test(lt) && /_ltImgs\[' \+ i \+ '\]\.cap=this\.value/.test(lt));
T('حذف تک‌تصویر از پیش‌نمایش مودال', /_ltImgs\.splice\(' \+ i \+ ',1\);ptfLtImgRender\(\)/.test(lt));
T('ذخیره در رکورد نامه (l.images تا ۳)', /l\.images = \(window\._ltImgs \|\| \[\]\)\.slice\(0, 3\)/.test(lt));
T('ویرایش نامه موجود: تصاویر قبلی بارگذاری می‌شوند', /window\._ltImgs = \(l && Array\.isArray\(l\.images\)\) \? JSON\.parse/.test(lt));

SECTION('چاپ: تصاویر روی نامه رسمی');
T('بلاک limgs بعد از متن و قبل از امضا رندر می‌شود', lt.indexOf("'<div class=\"body\">'") < lt.indexOf("l.images && l.images.length") && lt.indexOf("l.images && l.images.length") < lt.indexOf("'<div class=\"sig\"><div class=\"sigbox\">'"));
T('CSS چاپ: وسط‌چین + متناسب صفحه + بدون شکستن وسط تصویر', /\.limgs figure\{margin:4mm auto;text-align:center;page-break-inside:avoid\}/.test(lt) && /\.limgs img\{max-width:100%;max-height:110mm/.test(lt));
T('figcaption با فونت کوچکتر', /\.limgs figcaption\{font-size:' \+ \(fs - 2\) \+ 'pt/.test(lt));

SECTION('رفتاری: رندر چاپ با تصاویر');
global.window = global;
global.escP = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
global.curSession = function () { return { user: 'u1', name: 'کاربر' }; };
global.faDate = function () { return '1405/04/29'; };
global.getData = function () { return []; };
global.ptfPreviewPrintableDoc = function (t, html) { global._lastPrintHtml = html; };
// استخراج توابع موردنیاز
eval(lt.match(/var LETTER_FONT_FA = [\s\S]*?;/)[0]);
eval(lt.match(/var LETTER_FONT_EN = [\s\S]*?;/)[0]);
eval('global.letAutoSize = ' + lt.match(/function letAutoSize\(text\) \{[\s\S]*?\n\}/)[0].replace('function letAutoSize', 'function'));
eval('global.letFaDigits = function(s){return s;};');
eval('global.sigProfiles = function(){return {};};');
eval('global.letSignerEn = function(){return "";};');
eval('global.letRoleEn = function(){return "";};');
eval('global.letPrintObj = ' + lt.match(/function letPrintObj\(l, isPreview\) \{[\s\S]*?\n\}/)[0].replace('function letPrintObj', 'function'));
var L = { lang: 'fa', to: 'مدیر محترم', subject: 'آزمون', body: 'متن نامه', bsm: true, st: 'draft',
  images: [{ src: 'data:image/jpeg;base64,AAA', cap: 'نمودار تست' }] };
letPrintObj(L, true);
var html = global._lastPrintHtml || '';
T('تصویر و شرح در خروجی چاپ حاضرند', html.indexOf('data:image/jpeg;base64,AAA') > -1 && html.indexOf('نمودار تست') > -1);
T('قاعده فونت سرصفحه‌ها در خروجی چاپ حاضر است', html.indexOf('.bsm,.to,.torl,.sub{font-family:') > -1);
var L2 = { lang: 'fa', to: 'مدیر', subject: 'بی‌تصویر', body: 'متن', st: 'draft' };
letPrintObj(L2, true);
T('نامه بدون تصویر: بلاک limgs رندر نمی‌شود', (global._lastPrintHtml || '').indexOf('class="limgs"') === -1);

DONE('tester197-letter-img-font');
