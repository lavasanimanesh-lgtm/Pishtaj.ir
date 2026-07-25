/* tester37 — v122.2 (US-280): ادغام زنگوله + حذف دکمه‌های بستن قدیمی + درگاه اکسل کامل + پرامپت AI */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var th = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('AC1: ادغام زنگوله — یک زنگوله مینیمال، صفر ایموجی');
T('زنگوله ایموجی 🔔 از bridge حذف شد', br.indexOf('>🔔') === -1);
T('دکمه tbBellBtn در theme.js', th.indexOf('tbBellBtn') > -1);
T('زنگوله مینیمال صندوق پیام را باز می‌کند', th.indexOf('toggleInbox') > -1);
T('fallback به کارتابل اگر صندوق آماده نبود', th.indexOf("goPanel(\\'cart\\')") > -1);
T('بج قرمز روی زنگوله مینیمال سوار می‌شود', br.indexOf('ibBadge') > -1 && br.indexOf('tbBellBtn') > -1);
T('پنل صندوق پیام حفظ شد', br.indexOf('inboxPanel') > -1 && br.indexOf('inboxList') > -1);
T('دکمه inboxBtn قدیمی ساخته نمی‌شود', br.indexOf("id=\"inboxBtn\"") === -1);

SECTION('AC2: حذف دکمه‌های بستن قدیمی مودال (فقط دکمه‌های مک)');
T('setInterval تزریق دکمه قدیمی حذف شد', sh.indexOf('setInterval(window.ptfEnsureStickyModalControls') === -1);
T('ptfEnsureStickyModalControls به پاک‌کننده تبدیل شد', sh.indexOf("querySelectorAll('.md .md-ctrls')") > -1);
T('CSS: کنترل‌های قدیمی display:none', /\.md \.md-ctrls[^{]*\{\s*display:\s*none\s*!important/.test(idx.replace(/\n/g, ' ')));
T('استایل شناور sticky قدیمی حذف شد', idx.indexOf('position: sticky !important;\n  top: 10px !important; float: left !important') === -1);

SECTION('AC3: درگاه اکسل کامل مشتریان');
T('راهنمای CUST ستون‌های F تا M دارد', idx.indexOf('تلفن ثابت رابط') > -1 && idx.indexOf("'ستون M'") > -1);
T('موبایل از تلفن ثابت جدا شد', idx.indexOf('ptfXlsPhones') > -1 && idx.indexOf('ptfXlsPerson') > -1);
T('چند شماره با / پشتیبانی می‌شود', idx.indexOf('split(/[\\/,،;؛|]+/)') > -1);
T('داخلی بعد از خط تیره', idx.indexOf('02188xxxxxx-124') > -1 || idx.indexOf("match(/^(.*?)[\\s]*-[\\s]*(\\d{1,5})$/)") > -1);
T('چند رابط: ردیف تکراری با همان نام شرکت ادغام می‌شود', idx.indexOf('byName[co]') > -1 && idx.indexOf('rec.people.push(person)') > -1);
T('نگاشت وضعیت وندور فارسی/انگلیسی', idx.indexOf('ptfXlsVenSt') > -1 && idx.indexOf("indexOf('تایید')") > -1);
T('فیلدهای اختیاری آدرس/شناسه ملی/وب/وندور خوانده می‌شوند', idx.indexOf('coAddr: String(R[8]') > -1 && idx.indexOf('natId: String(R[9]') > -1);
T('کد یکتا با genCode (نه شمارش شکننده length)', idx.indexOf("genCode('CUST') : 'CUST-'") > -1);
T('ضدتکرار dedupStamp روی رکورد جدید', idx.indexOf('dedupStamp(rec)') > -1);
T('خطای خواندن اکسل به کاربر اعلام می‌شود (نه catch خالی)', idx.indexOf('خطا در خواندن فایل اکسل') > -1);

SECTION('AC4: درگاه اکسل کامل تأمین‌کنندگان و سرنخ‌ها');
T('SUP: راهنما تا ستون J', idx.indexOf("'ستون J', n: 'شناسه ملی (حقوقی)'") > -1);
T('SUP: ادغام رابط‌ها در رکورد موجود', idx.indexOf("getData('ptf_crm_suppliers')") > -1 && idx.split('rec.people.push(person)').length >= 3);
T('LEADS: تلفن ثابت + ایمیل + صنعت + ارزش', idx.indexOf("email: String(R[7]") > -1 && idx.indexOf('val: val') > -1);
T('LEADS: چند موبایل با / در نمایش', idx.indexOf("mobs.map(function(m){return m.n;}).join(' / ')") > -1);
T('سازگاری عقب‌رو: ۵ ستون اول قدیمی سر جای خود', idx.indexOf("String(R[0]||'').trim()") > -1 && idx.indexOf("String(R[3]||'اکسل وارداتی')") > -1);

SECTION('AC5: پرامپت آماده هوش مصنوعی در راهنما');
T('جعبه پرامپت AI (details)', idx.indexOf('ptfAiPromptTa') > -1 && idx.indexOf('پرامپت آماده هوش مصنوعی') > -1);
T('پرامپت از ساختار ستون‌های همان ماژول ساخته می‌شود', idx.indexOf("aiPrompt += '- ' + item.c + ': ' + item.n") > -1);
T('قاعده تفکیک موبایل/ثابت داخل پرامپت', idx.indexOf('موبایل با 09 شروع می‌شود') > -1);
T('قاعده چند رابط = چند ردیف داخل پرامپت', idx.indexOf('برای هر رابط یک ردیف جداگانه') > -1);
T('دکمه کپی با navigator.clipboard', idx.indexOf('navigator.clipboard.writeText') > -1);
T('میان‌بر به دستیار هوشمند سامانه', idx.indexOf("goPanel(\\'ai\\')") > -1);

SECTION('نسخه');
T('VER v12x', /var VER = 'v\d/.test(idx));
T('sw.js cache v12x', /ptf-crm-v\d/.test(sw));
DONE('tester37-v1222');
