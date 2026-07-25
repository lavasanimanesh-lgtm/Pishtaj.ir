/* tester59 — v13.9 (US-341..346): یادآورها، hover مک، تور معرفی، حذف سفارشات، قراردادها v2 */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var mx = fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8');
var tr = fs.readFileSync(path.join(BASE, 'tour.js'), 'utf-8');
var ct = fs.readFileSync(path.join(BASE, 'contracts.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var llm = fs.readFileSync(path.resolve(__dirname, '../../api/llm.php'), 'utf-8');

SECTION('US-341: یادآورهای مهم فرآیندی');
T('موضوعات جدید: چک/اعتبار CO/تامین/وندور/ضمانت‌نامه/حمل/تحویل', ['سررسید چک صادره', 'اعتبار پیشنهاد مالی', 'پیگیری پاسخ درخواست تامین', 'پیگیری وندور لیست', 'تمدید ضمانت‌نامه بانکی', 'ترخیص و حمل کالا', 'تحویل به کارفرما'].every(function (k) { return ld.indexOf(k) > -1; }));
T('موضوعات قدیمی حفظ شد', ld.indexOf('پیگیری لید') > -1 && ld.indexOf('وصول مطالبات') > -1);

SECTION('US-342: راهنمای hover دکمه‌های مک');
T('نمادها: ✕ / − / ⤢', mx.indexOf("'<span>✕</span>'") > -1 && mx.indexOf("'<span>−</span>'") > -1 && mx.indexOf("'<span>⤢</span>'") > -1);
T('نماد فقط با hover ظاهر می‌شود (مثل مک)', mx.indexOf('.mx-dots:hover .mx-dot span{display:block}') > -1);
T('نماد وسط دایره (absolute inset)', mx.indexOf('position:absolute;inset:0') > -1);

SECTION('US-343: تور معرفی گرافیکی');
T('ماژول tour ثبت شده', idx.indexOf('tour.js') > -1 && sw.indexOf('./tour.js') > -1);
T('spotlight: ناحیه روشن + بقیه تیره', tr.indexOf('box-shadow:0 0 0 9999px rgba(15,23,42,.78)') > -1);
T('متن نمونه خواسته کارفرما (ثبت پیشنهادات)', tr.indexOf('پیشنهادهای فنی، مالی و فنی-مالی خود را ثبت') > -1);
T('فقط ماژول‌های مجاز کاربر (RBAC)', tr.indexOf("el.style.display !== 'none'") > -1 || tr.indexOf("b.style.display === 'none'") > -1); /* v16.4: بازنویسی تور US-361 — چک RBAC معادل */
T('اجرای خودکار یک‌باره per کاربر', tr.indexOf('ptf_tour_done_') > -1);
T('اجرای مجدد از تنظیمات', tr.indexOf('اجرای مجدد معرفی ماژول‌ها') > -1);
T('ناوبری قبلی/بعدی/رد کردن', tr.indexOf('ptfTourNav') > -1 && tr.indexOf('رد کردن') > -1);

SECTION('US-344: حذف «سفارشات و سود» (مصوبه تیم)');
T('از سایدبار حذف شد', idx.indexOf('<span class="lb">سفارشات و سود</span>') === -1);
T('از گروه مالی حذف شد (v14.0: fin هم رفت)', sh.indexOf("'orders'") === -1 && sh.indexOf("['inv', 'recv', 'petty', 'anl']") > -1);
T('توابع legacy محفوظ (لینک قدیمی نمی‌شکند)', idx.indexOf('function buildOrders()') > -1);

SECTION('US-345: قراردادها v2');
T('نام «قراردادها» در سایدبار و پنل', idx.indexOf('<span class="lb">قراردادها</span>') > -1 && ct.indexOf('<h3>📜 قراردادها</h3>') > -1);
T('نوع خرید → مبنا = درخواست تامین (نه CO)', ct.indexOf('ctBaseBuy') > -1 && ct.indexOf("getData('ptf_crm_rfqsmart')") > -1 && ct.indexOf('ctKindSwitch') > -1);
T('تولید قرارداد خرید با لینک rfqsNo', ct.indexOf('function ctGenerateBuy(rq, supName)') > -1 && ct.indexOf('rfqsNo: rq.no') > -1);
T('نمایش مبنا در فهرست (rfqsNo یا coNo)', ct.indexOf('c.rfqsNo || c.coNo') > -1);
T('بررسی متن با AI: فیلد + دکمه', ct.indexOf('ctAiTxt') > -1 && ct.indexOf('بررسی و پیشنهاد متن نهایی') > -1);
T('اکشن سروری contract (ریسک‌ها + متن نهایی)', llm.indexOf("case 'contract':") > -1 && llm.indexOf('"risks":["..."],"final"') > -1);
T('نتیجه AI: ریسک‌ها + متن نهایی + دکمه استفاده', ct.indexOf('ریسک‌ها و بندهای مبهم') > -1 && ct.indexOf('استفاده از این متن') > -1);
T('CO/TC هر دو مبنای فروش', ct.indexOf("o.kind === 'CO' || o.kind === 'TC'") > -1);

SECTION('US-346: راهنمای کامل نرم‌افزار — ثبت یوزر استوری');
T('در بک‌لاگ هندآور ثبت شده', fs.readFileSync(path.resolve(__dirname, '../../PTF-MASTER-HANDOVER.md'), 'utf-8').indexOf('US-346') > -1);
DONE('tester59-v139');
