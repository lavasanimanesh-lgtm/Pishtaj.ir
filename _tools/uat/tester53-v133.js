/* tester53 — v13.3 (US-323..326): مجوز اسناد بایگانی + تسویه هنگام مختومه + پیوست‌ها و اقلام استعلام */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pj = fs.readFileSync(path.join(BASE, 'projects.js'), 'utf-8');
var ar = fs.readFileSync(path.join(BASE, 'archive.js'), 'utf-8');
var sf = fs.readFileSync(path.join(BASE, 'salesfiles.js'), 'utf-8');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');

SECTION('US-323: مجوز اسناد پرونده بایگانی‌شده');
T('چهار نقش مجاز: ادمین/رییس/مدیربازرگانی/مدیرعامل', pj.indexOf("['admin', 'chairman', 'commercial', 'ceo'].indexOf(r) > -1") > -1);
T('آپلود در بایگانی‌شده برای غیرمجاز قفل', pj.indexOf('_prjArchived && !ptfArcDocAllowed()') > -1 && pj.indexOf('🔒 این پرونده بایگانی شده') > -1);
T('حذف سند بایگانی‌شده برای غیرمجاز قفل', ar.indexOf("p.state === 'archived' && !(typeof ptfArcDocAllowed === 'function'") > -1);
T('رد تغییر افزودن (کاربر + سند + تاریخ)', pj.indexOf("changeLog.push({ t: faDateTime(), by: curSession().name, user: curSession().user, act: 'add'") > -1);
T('رد تغییر حذف', ar.indexOf("act: 'del', doc: d.name") > -1);
T('نمایش رد تغییر در مودال پرونده بایگانی', pj.indexOf('رد تغییر اسناد (پس از بایگانی)') > -1 && pj.indexOf('chlogHtml') > -1);

SECTION('US-324: مختومه با فاکتور → تسویه مطالبات');
T('تشخیص فاکتورهای با مانده باز', sf.indexOf('i.amount - paid > 0.5') > -1);
/* v19.4 (US-437): UI از confirm به چک‌باکس مودال کنترل ارتقا یافت — معنا حفظ شد: پیش‌فرض تیک=تسویه، برداشتن تیک=باز ماندن (و مختومه قفل) */
T('پیش‌فرض: تسویه‌شده تلقی می‌شود (v19.4: چک‌باکس پیش‌فرض تیک‌خورده)', sf.indexOf('id="sfClsSettle" checked') > -1 && sf.indexOf('تسویه‌شده» ثبت شود') > -1);
T('نظر دیگر کاربر: مانده باز می‌ماند (v19.4: بدون تیک، مطالبات باز و مختومه قفل)', sf.indexOf('بدون تیک: مطالبات باز می‌ماند') > -1 && sf.indexOf('با مطالبات باز نمی‌توان مختومه کرد (US-437)') > -1);
T('پرداخت تسویه با نشان autoSettle + ثبت‌کننده', sf.indexOf("how: 'تسویه هنگام مختومه شدن پرونده'") > -1 && sf.indexOf('autoSettle: true') > -1);
T('audit تسویه خودکار', sf.indexOf('تسویه خودکار') > -1);

SECTION('US-325: پیوست‌های زمان ثبت استعلام قابل مشاهده');
T('ریشه رفع شد: دسته‌ها با کلیدهای فرم ثبت (img/oth) یکسان شد', iq.indexOf("renderFileList('img', '🖼 عکس کالا')") > -1 && iq.indexOf("renderFileList('oth', '📎 سایر مدارک')") > -1);
T('دسته cat قدیمی فقط اگر داده دارد', iq.indexOf("(r.files['cat'] || []).length ? renderFileList('cat'") > -1);
T('مشاهده/دانلود/حذف هر پیوست موجود بود و ماند', iq.indexOf('ptfDelInqAtt') > -1 && iq.indexOf('ptfDownloadStoredFile') > -1);

SECTION('US-326: اقلام درخواست — اختیاری + تایید ورود به کالاها');
T('پس از ثبت استعلام: پیشنهاد ورود اقلام (نه اجبار)', br.indexOf('الزامی نیست — بعدا هم از دکمه') > -1 && br.indexOf('ptfOpenFullInqEditor(cd)') > -1);
T('ویرایشگر اقلام سه‌مسیره موجود (دستی/اکسل/دستیار)', iq.indexOf('افزودن ردیف') > -1 && iq.indexOf('inqEdXlsInp') > -1);
T('ورود به فهرست کالاها فقط با تایید کاربر', iq.indexOf('آیا کالاهای این درخواست به «فهرست کالا') > -1 && iq.indexOf('confirm(') > -1);
T('پیام: کد یکتا + رد کالای مشابه', iq.indexOf('کد یکتای خود را می‌گیرد') > -1 && iq.indexOf('تکرار نمی‌شوند') > -1);
T('ضدتکرار کالا در ptfAutoRegisterSummaryProducts پابرجا', fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8').indexOf('var dup = prods.some(function(p) { return p.nm === desc') > -1);
T('گزارش تعداد کالای جدید ثبت‌شده', iq.indexOf('کالای جدید با کد یکتا در فهرست کالا') > -1);
DONE('tester53-v133');
