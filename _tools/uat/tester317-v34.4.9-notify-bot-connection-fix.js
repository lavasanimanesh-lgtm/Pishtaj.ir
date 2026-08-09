/* tester317 — v34.4.9 (رفع باگ عدم اتصال بات تلگرام/بله در حضور فایل کانفیگ سالم)
   پوشش:
     - رفع بلاک شدن مسیر api/notify-bot.php در api/.htaccess
     - حفظ سازگاری با تسترهای قبلی (tester55 و tester61 و tester300)
     - ارتقای پایداری و امنیت سرور notify-bot.php (پشتیبانی از پورت غیرستاندارد در گارد Origin،
       نرمال‌سازی ارقام فارسی/عربی و حذف فاصله‌های اضافی توکن و chat_id، و گزارش دقیق خطاهای cURL) */
require('./harness');
var fs = require('fs'), path = require('path');
var ROOT = path.resolve(__dirname, '../..');
var API = path.join(ROOT, 'api');
var CRM = path.join(ROOT, 'crm');

function read(p) { return fs.readFileSync(p, 'utf-8'); }
var hta = read(path.join(API, '.htaccess'));
var bot = read(path.join(API, 'notify-bot.php'));
var ms = read(path.join(CRM, 'messengers.js'));

SECTION('تایید بازگشایی مسیر بات در htaccess');
T('مسیر notify-bot از RewriteRule بلاک حذف شده است',
  !/notify-bot\|tech-proposal-docx\|tools/.test(hta) && /tech-proposal-docx\|tools/.test(hta));
T('مسیر notify-bot در allow-list FilesMatch قرار دارد',
  /crm\|contact\|codegen\|fx-rates\|storage\|cms\|auth\|llm\|attachment-thumb\|attachment-read\|chat-llm\|notify-bot/.test(hta));
T('سازگاری کامل با الگوی بررسی تستر ۵۵ (storage|crm|...|notify-bot)',
  /storage\|crm\|[^"]*notify-bot/.test(hta));

SECTION('ارتقای پایداری و امنیت اتصال بات در notify-bot.php');
T('پشتیبانی از جستجوی bot-config.php در داخل پوشه api و ریشه‌ها',
  bot.indexOf("dirname(__DIR__, 2)") > -1 && bot.indexOf("__DIR__ . '/bot-config.php'") > -1);
T('نرمال‌سازی ارقام فارسی/عربی و حذف فاصله‌های اضافی در توکن‌ها و شناسه چت',
  bot.indexOf('str_replace($fa, $en') > -1 && bot.indexOf("trim(str_replace($fa, $en, \$c[\$k]))") > -1);
T('گارد Origin با پشتیبانی پورت‌های غیرستاندارد (محیط‌های استیجینگ/پیش‌نمایش)',
  bot.indexOf("preg_replace('/:\\d+\$/', '', \$host)") > -1 && bot.indexOf('strcasecmp') > -1);
T('تنظیم timeout اتصال cURL و گزارش دقیق متن خطا در پاسخ سرور',
  bot.indexOf('CURLOPT_CONNECTTIMEOUT => 6') > -1 && bot.indexOf('curl_error($ch)') > -1);

SECTION('سازگاری با اکشن‌ها و کلاینت پیام‌رسان‌ها (tester55 / tester61)');
T('پشتیبانی از هر سه اکشن status، send و pair',
  bot.indexOf("case 'status'") > -1 && bot.indexOf("case 'send'") > -1 && bot.indexOf("case 'pair'") > -1);
T('پشتیبانی از API رسمی تلگرام و بله (tapi.bale.ai)',
  bot.indexOf('https://api.telegram.org/bot') > -1 && bot.indexOf('https://tapi.bale.ai/bot') > -1);
T('کلاینت CRM مسیر تست اتصال بات را به درستی فراخوانی می‌کند',
  ms.indexOf("fetch('../api/notify-bot.php?action=status')") > -1 && ms.indexOf('ptfBotStatus') > -1);

DONE('tester317-v34.4.9');
