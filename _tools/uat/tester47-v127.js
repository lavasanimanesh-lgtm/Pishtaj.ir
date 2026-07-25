/* tester47 — v12.7 (US-313..315): حذف خلاصه AI + اقلام در ویرایش استعلام + نام «پیشنهاد» */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');

SECTION('US-313: حذف کامل «خلاصه AI» (توکن‌سوز)');
T('هوک خودکار بعد از ثبت درخواست حذف شد', iq.indexOf('patchSaveRfq2') === -1);
T('polling تزریق دکمه‌ها (setInterval 1500ms) حذف شد', iq.indexOf('injectSumBtns') === -1);
T('فراخوانی خودکار summarize حذف شد', iq.indexOf("LLM_API + '?action=summarize'") === -1 && iq.indexOf('rfqSumText') === -1);
T('استاب سازگاری: کلیک قدیمی → پیام راهنما', iq.indexOf('این قابلیت حذف شد') > -1);
T('خلاصه‌های قدیمی ذخیره‌شده قابل مشاهده‌اند (آرشیو)', iq.indexOf('خلاصه قدیمی (آرشیو)') > -1);
T('موتور دستیار (aiWB) دست‌نخورده', fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8').indexOf('aiWB_ocrGo') > -1);

SECTION('US-314: اقلام در مودال ویرایش استعلام');
T('باکس اقلام در editRfq', br.indexOf('📋 اقلام استعلام (') > -1);
T('نمایش تا ۸ قلم + شمار مازاد', br.indexOf('its.slice(0, 8)') > -1 && br.indexOf('قلم دیگر (در ویرایش اقلام)') > -1);
T('سه منبع: inqitems سپس r.items', br.indexOf("x.inqNo === cd || x.cd === cd") > -1 && br.indexOf('r.items && r.items.length') > -1);
T('دکمه ورود/ویرایش → ویرایشگر کامل (دستی/اکسل/دستیار)', br.indexOf('ptfOpenFullInqEditor') > -1 && br.indexOf('+ ورود اقلام (دستی / اکسل / دستیار)') > -1);
T('پیام راهنما وقتی قلمی نیست', br.indexOf('قلمی ثبت نشده') > -1);

SECTION('US-315: نام ماژول «پیشنهاد»');
T('سایدبار: «پیشنهاد»', idx.indexOf('<span class="lb">پیشنهاد</span>') > -1 && idx.indexOf('پیشنهادهای فنی و مالی (TO / CO)</span>') === -1);
T('عنوان پنل goPanel', idx.indexOf("off:'📄 پیشنهاد'") > -1);
T('سربرگ صفحه پنل', of.indexOf('<h3>📄 پیشنهاد</h3>') > -1);
T('دکمه‌های صدور پابرجا (v20.1 US-442: TC در CO ادغام شد)', of.indexOf("offerNew(\\'TO\\')") > -1 && of.indexOf("offerNew(\\'CO\\')") > -1 && of.indexOf('ofPrintAs') > -1);
DONE('tester47-v127');
