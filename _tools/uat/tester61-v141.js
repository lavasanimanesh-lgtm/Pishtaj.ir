/* tester61 — v14.1 (US-354/355): حالت خودکار روز/شب + اعلان شخصی بات */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var pm = fs.readFileSync(path.join(BASE, 'perms.js'), 'utf-8');
var th = fs.readFileSync(path.join(BASE, 'theme.js'), 'utf-8');
var ms = fs.readFileSync(path.join(BASE, 'messengers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var bot = fs.readFileSync(path.resolve(__dirname, '../../api/notify-bot.php'), 'utf-8');

SECTION('US-354: حالت خودکار روز/شب');
T('گزینه سوم «خودکار» در تنظیمات', pm.indexOf("ptfSetTheme(\\'auto\\')") > -1 && pm.indexOf('خودکار (هماهنگ با سیستم)') > -1);
T('تشخیص تم سیستم (prefers-color-scheme)', pm.indexOf("matchMedia('(prefers-color-scheme: dark)')") > -1);
T('گوش دادن زنده به تغییر تم سیستم (غروب/طلوع OS)', pm.indexOf("addEventListener('change'") > -1);
T('بلوک ضد FOUC هد auto را می‌شناسد', idx.indexOf("if (mode === 'auto')") > -1);
T('متغیرهای ریشه در برگشت به روز پاک می‌شوند', pm.indexOf("removeProperty(v)") > -1);
T('نوار بالا: چرخه سه‌حالته روز→شب→خودکار', th.indexOf("cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light'") > -1);
T('موبایل هم پوشش دارد (منطق مشترک — نه جدا)', pm.indexOf('ptfThemeEffective') > -1);

SECTION('US-355: اعلان شخصی بات (پاسخ سوال کارفرما)');
T('سرور: اکشن pair (جفت‌سازی با کد)', bot.indexOf("case 'pair':") > -1 && bot.indexOf('getUpdates') > -1);
T('pair فقط چت خصوصی را می‌پذیرد', bot.indexOf("($msg['chat']['type'] ?? '') === 'private'") > -1);
T('سرور: send با مقصد شخصی (chat_id + app)', bot.indexOf("$pChat = preg_replace") > -1 && bot.indexOf("'telegram-personal'") > -1);
T('کلاینت: اعلان شخصی (toUsers بدون toRoles) → فقط چت خود کاربر', ms.indexOf('personalOnly') > -1 && ms.indexOf("(opt.toUsers || []).length > 0 && (opt.toRoles || []).length === 0") > -1);
T('اعلان شخصی هرگز به گروه نمی‌رود', ms.indexOf('ptfBotSendPersonal(txt, pr)') > -1);
T('اعلان نقشی/مدیریتی → گروه (مثل قبل)', ms.indexOf('} else {') > -1 && ms.indexOf('ptfBotSend(txt);') > -1);
T('UI جفت‌سازی: کد یکتا + بررسی', ms.indexOf('ptfBotPairStart') > -1 && ms.indexOf("'PTF-' + me.toUpperCase()") > -1 && ms.indexOf('ptfBotPairCheck') > -1);
T('ذخیره جفت‌ها + سینک بین دستگاه‌ها (settings)', ms.indexOf('ptf_bot_pairs') > -1 && ms.indexOf('st.botPairs = p2') > -1);
T('پیام تایید اتصال به خود کاربر', ms.indexOf('اتصال چت شخصی شما به CRM') > -1);
T('وضعیت اتصال در باکس تنظیمات', ms.indexOf('چت شخصی شما متصل است') > -1);
DONE('tester61-v141');
