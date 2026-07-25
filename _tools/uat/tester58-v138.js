/* tester58 — v13.8 (US-339/340): پوشش کامل اعلانات بات + ارسال پیام دلخواه + لوگوی بات */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');
var ms = fs.readFileSync(path.join(BASE, 'messengers.js'), 'utf-8');

SECTION('US-339: همه اعلانات مهم + ارجاعات به بات');
T('ارجاعات (referral) اضافه شد', ms.indexOf("'referral'") > -1);
T('پوشش کامل: چک/سیستم/ادمین/ارجاع/پرداخت/خرید/وضعیت/یادآور', ["'cheque'", "'system'", "'admin'", "'referral'", "'payment'", "'buyq'", "'status'", "'reminder'"].every(function (k) { return ms.indexOf(k) > -1; }));
T('آیکون متمایز per نوع اعلان', ms.indexOf('KIND_ICON') > -1 && ms.indexOf("referral: '📨'") > -1);
T('سوییچ فعال‌سازی همچنان حاکم است', ms.indexOf("localStorage.getItem('ptf_bot_enabled') === '1'") > -1);

SECTION('US-340: ارسال پیام دلخواه از طریق بات');
T('دکمه «نوشتن پیام به گروه» در تنظیمات', ms.indexOf('ptfBotCompose()') > -1 && ms.indexOf('نوشتن پیام به گروه') > -1);
T('مودال نوشتن پیام', ms.indexOf('botMsgTxt') > -1 && ms.indexOf('ارسال پیام به گروه شرکت') > -1);
T('پیام با نام فرستنده ارسال می‌شود', ms.indexOf("'💬 پیام از ' + me + ':") > -1);
T('حالت در حال ارسال + خطای شفاف', ms.indexOf('در حال ارسال') > -1 && ms.indexOf('کانفیگ بات را بررسی کنید') > -1);
T('ثبت در audit', ms.indexOf('ارسال پیام دستی به گروه بات') > -1);
T('دکمه دسترسی سریع در کارتابل', ms.indexOf('botCartBtn') > -1 && ms.indexOf('پیام به گروه شرکت') > -1);

SECTION('لوگوی بات');
T('فایل لوگو در بسته (اصلی + 640)', fs.existsSync(path.join(ROOT, 'assets/images/bot-logo.png')) && fs.existsSync(path.join(ROOT, 'assets/images/bot-logo-640.png')));
DONE('tester58-v138');
