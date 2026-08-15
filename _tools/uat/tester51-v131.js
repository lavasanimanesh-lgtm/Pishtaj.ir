/* tester51 — v13.1 (US-320/321 + BUG-011): سهمیه نقش‌محور AI، اعلان موبایل، امضای نیابتی رییس */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ai = fs.readFileSync(path.join(BASE, 'ai-workbench.js'), 'utf-8');
var br = fs.readFileSync(path.join(BASE, 'bridge.js'), 'utf-8');
var of = fs.readFileSync(path.join(BASE, 'offers.js'), 'utf-8');
var op = fs.readFileSync(path.join(BASE, 'offers-pro.js'), 'utf-8');

SECTION('US-320: سهمیه AI نقش‌محور (۴۰۰ اصلی / ۵۰ بقیه)');
/* v14.9 (US-383): commercial هم ۴۰۰ شد */
T('سه نقش اصلی = ۴۰۰', ai.indexOf("(r === 'admin' || r === 'chairman' || r === 'ceo' || r === 'commercial') ? 400 : 50") > -1);
T('عدد ۳۰ هاردکد قدیمی حذف شد', ai.indexOf("'+(30-q.n)+' / 30") === -1);
T('شمارنده per-user (نه مشترک بین کاربران)', ai.indexOf("'ptf_ai_quota_' + (curSession().user") > -1);
T('اجرای واقعی سهمیه در llmPost (قبلا فقط نمایشی بود)', ai.indexOf('if (q.n >= lim)') > -1 && ai.indexOf('سهمیه امروز شما (') > -1);
T('status/test سهمیه مصرف نمی‌کنند', ai.indexOf("action !== 'status' && action !== 'test'") > -1);
T('نمایش پیل با سقف داینامیک', ai.indexOf("Math.max(0, lim-q.n)+' / '+lim") > -1);
T('عنوان پنل «دستیار» یکدست شد', ai.indexOf('<h3>🤖 دستیار</h3>') > -1);

SECTION('BUG-011: اعلان موبایل کامل دیده نمی‌شد');
T('پنل صندوق در موبایل fixed تمام‌عرض', br.indexOf('#inboxPanel{position:fixed!important') > -1 && br.indexOf('left:8px!important;right:8px!important') > -1);
T('ارتفاع محدود به صفحه (بالای نوار پایین)', br.indexOf('max-height:calc(100vh - 150px)!important') > -1);
T('z-index بالاتر از نوار موبایل', br.indexOf('z-index:1550!important') > -1);
T('دسکتاپ دست‌نخورده (داخل @media)', br.indexOf('@media(max-width:768px){#inboxPanel') > -1);

SECTION('US-321: امضای نیابتی رییس هیات مدیره');
T('فقط chairman و admin', of.indexOf("r === 'chairman' || r === 'admin'") > -1);
T('گزینه‌های نیابت: یوسفی و کریمی', of.indexOf("{ u: 'yousefi', lb: 'عباس یوسفی' }") > -1 && of.indexOf("{ u: 'karimi', lb: 'شیوا کریمی' }") > -1);
T('کشوی انتخاب امضا در فرم پیشنهاد', of.indexOf('id="ofSignAs"') > -1 && of.indexOf('ptfSignAsOptions(o.signAs)') > -1);
T('ذخیره signAs در هر دو مسیر', (of.match(/o\.signAs = _sa\.value/g) || []).length >= 2);
T('قالب داخلی از signAs و accessor پایدار امضا می‌خواند', of.indexOf('o.signAs || o.issuedBy') > -1 && of.indexOf('ptfSigProfileFor') > -1);
T('قالب‌های چاپ ۵گانه از signAs می‌خوانند', op.indexOf('o.signAs || o.issuedBy') > -1);
T('برای سایر نقش‌ها کشو ظاهر نمی‌شود', of.indexOf("ptfCanDelegateSig() ? '<select id=\"ofSignAs\"") > -1);
DONE('tester51-v131');
