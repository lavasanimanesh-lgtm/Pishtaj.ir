/* tester43 — v123.2 (US-297..300): ورژن واقعی سایدبار + انتقال تغییر رمز + «دستیار» زیر کارتابل + دسترسی از مودال‌ها */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sh = fs.readFileSync(path.join(BASE, 'shell.js'), 'utf-8');
var iq = fs.readFileSync(path.join(BASE, 'inqreader.js'), 'utf-8');
var mx = fs.readFileSync(path.join(BASE, 'modalx.js'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');

SECTION('US-297: ورژن واقعی در سایدبار');
T('CRM v6.0 هاردکد حذف شد', idx.indexOf('CRM v6.0') === -1);
T('sbVer از window.VER پر می‌شود', idx.indexOf('id="sbVer"') > -1 && idx.indexOf("getElementById('sbVer').textContent = 'CRM ' + VER") > -1);

SECTION('US-299: تغییر رمز → منوی تنظیمات');
T('تزریق دکمه به .sb-f (پایین سایدبار) حذف شد', iq.indexOf("querySelector('.sb-f')") === -1 && iq.indexOf('chPassBtn') === -1);
T('باکس امنیت حساب به buildSettings هوک شد', iq.indexOf('امنیت حساب') > -1 && iq.indexOf('window.buildSettings = function () { return _bs()') > -1);
T('دکمه تغییر رمز در باکس تنظیمات', iq.indexOf('onclick="ptfChangePassDialog()"') > -1);
T('منطق تغییر رمز (ادمین+کاربر) دست‌نخورده', iq.indexOf('st.adminHash = newH') > -1 && iq.indexOf('u.passhash = newH') > -1);

SECTION('US-298: «دستیار» زیر کارتابل');
T('برچسب سایدبار «دستیار» با آیکون ربات', idx.indexOf('<span class="ic">🤖</span><span class="lb">دستیار</span>') > -1 && idx.indexOf('ابزار هوش مصنوعی</span>') === -1);
T('عنوان پنل «دستیار»', idx.indexOf("ai:'🤖 دستیار'") > -1);
T('در گروه داشبورد بعد از کارتابل (زیر کارتابل)', sh.indexOf("items: ['dash', 'cart', 'ai'], single: true") > -1);

SECTION('US-300: دسترسی سریع دستیار از مودال‌های مرتبط');
T('دسترسی دستیار در مودال (v20.0 BUG-033: نقطه چهارم mx-dot.a به‌جای بیضی)', mx.indexOf('mx-dot a') > -1 && mx.indexOf('<span>🤖</span>') > -1);
T('فقط مودال‌های مرتبط (کالا/پیشنهاد/استعلام/نامه/قرارداد/فاکتور)', mx.indexOf('/کالا|پیشنهاد|استعلام|نامه|قرارداد|فاکتور|TO|CO|TC|RFQ/i') > -1);
T('کلیک = مینیمایز با حفظ اطلاعات + goPanel(ai)', mx.indexOf('mxMinimize();') > -1 && mx.indexOf("goPanel('ai')") > -1);
T('بقای مودال: انتقال به body قبل از ناوبری (panels.innerHTML آن را نمی‌کشد)', mx.indexOf('document.body.appendChild(mdb)') > -1);
T('دکمه زرد از همان تابع مشترک استفاده می‌کند', mx.indexOf('_mxMinimize = mxMinimize') > -1);
T('استایل نقطه بنفش دستیار (v20.0)', mx.indexOf('.mx-dot.a{background:#8b5cf6') > -1);

SECTION('راستی‌آزمایی v123.1 (درخواست تکراری کارفرما)');
var ld = fs.readFileSync(path.join(BASE, 'leads.js'), 'utf-8');
var lt = fs.readFileSync(path.join(BASE, 'letters.js'), 'utf-8');
T('«سرنخ‌ها» برقرار', ld.indexOf('سرنخ‌ها (Leads)') > -1 && idx.indexOf('<span class="lb">سرنخ‌ها</span>') > -1);
T('فیلد سمت گیرنده نامه برقرار', lt.indexOf('id="ltToRole"') > -1 && lt.indexOf('class="torl"') > -1);

SECTION('نسخه');
T('VER >= v12.3', (function(){var m=idx.match(/window.PTF_CRM_RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=12.3;})());
T('sw cache >= v12.3', (function(){var m=sw.match(/var RELEASE = 'v([0-9.]+)'/);return m&&parseFloat(m[1])>=12.3;})());
DONE('tester43-v1232');
