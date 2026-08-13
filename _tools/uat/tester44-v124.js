/* tester44 — v12.4 (US-301..303): بازشماری نسخه + داشبورد لانچر با درگ + کارآمدسازی «از درخواست» */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var lc = fs.readFileSync(path.join(BASE, 'launcher.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-301: بازشماری نسخه (تقسیم بر ۱۰، یک رقم اعشار)');
T('VER v1x اعشاری', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('یادداشت نگاشت نسخه جاری', /window\.PTF_CRM_RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(idx));
T('sw cache v1x', /var RELEASE\s*=\s*'v\d+(?:\.\d+)+'/.test(sw));
T('سایدبار ورژن واقعی را نشان می‌دهد (US-297 پابرجا)', idx.indexOf("getElementById('sbVer').textContent = 'CRM ' + VER") > -1);

SECTION('US-302: داشبورد = لانچر گرافیکی با درگ');
T('launcher.js ثبت شده', idx.indexOf('launcher.js') > -1 && sw.indexOf('./launcher.js') > -1);
T('کاشی‌های مربع (aspect-ratio 1/1)', lc.indexOf('aspect-ratio:1/1') > -1);
T('کاشی‌ها از سایدبار واقعی (RBAC خودکار)', lc.indexOf(".style.display === 'none') return; // RBAC") > -1);
T('درگ با Pointer Events (v12.9: موتور ghost)', lc.indexOf('onpointerdown') > -1 && lc.indexOf('lch-ghost') > -1 && lc.indexOf('touch-action:none') > -1);
T('آستانه حرکت: کلیک ساده = ورود به ماژول', lc.indexOf('moved < 6') > -1 && lc.indexOf("goPanel(id)") > -1);
T('درج RTL-aware هنگام درگ', lc.indexOf('r2.left + r2.width / 2') > -1);
T('ترتیب per-user در settings سینک‌شونده', lc.indexOf('st.dashOrder[myUser()] = ids') > -1 && lc.indexOf("ptf_crm_settings") > -1);
T('داشبورد قدیم در details حفظ شد (updateStats نمی‌شکند)', lc.indexOf('داشبورد قدیم') > -1 && lc.indexOf('_orig()') > -1);
T('حالت شب + موبایل', lc.indexOf('body.ptf-dark .lch-tile') > -1 && lc.indexOf('@media(max-width:768px)') > -1);
T('لود قبل از leads.js (ویجت یادآورها بیرون details می‌ماند)', idx.indexOf('launcher.js') < idx.indexOf('leads.js?v='));

SECTION('US-303: کارآمدسازی «بارگذاری از درخواست»');
T('ثبت استعلام → ویرایشگر اقلام خودکار باز می‌شود', idx.indexOf('ptfOpenFullInqEditor(cd); }, 250)') > -1);
T('اطلاع‌رسانی در مودال ثبت استعلام', idx.indexOf('ورود اقلام درخواست</b> باز می‌شود') > -1);
T('ویرایشگر اقلام: دستی + اکسل موجود', (function () { var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8'); return iq.indexOf('افزودن ردیف') > -1 && iq.indexOf('inqEdXlsInp') > -1; })());
T('prompt متنی حذف شد → دیالوگ انتخابی', of.indexOf("prompt('شماره درخواست") === -1 && of.indexOf('offInqPick') > -1);
T('دیالوگ: تعداد قلم هر درخواست', of.indexOf("groups[k] + ' قلم</span>") > -1);
T('پیام راهنمای سه‌مسیره وقتی اقلام نیست', of.indexOf('دستیار → خواندن فایل استعلام') > -1);
T('offLoadInqItems پارامتر pickedInq', of.indexOf('function offLoadInqItems(pickedInq)') > -1);
T('سه منبع اقلام (inqitems/inqreads/rfqs.items) پابرجا', of.indexOf("getData('ptf_crm_inqitems').filter") > -1 && of.indexOf("getData('ptf_crm_inqreads').filter") > -1 && of.indexOf('rfq.items') > -1);
DONE('tester44-v124');
