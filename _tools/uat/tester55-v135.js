/* tester55 — v13.5 (US-332/333/334 — مصوب کارفرما): پیام‌رسان‌ها + بات اعلان + بسته APK */
require('./harness');
var fs = require('fs'), path = require('path');
var BASE = path.resolve(__dirname, '../../crm');
var ROOT = path.resolve(__dirname, '../..');
var ms = fs.readFileSync(path.join(BASE, 'messengers.js'), 'utf-8');
var idx = fs.readFileSync(path.join(BASE, 'index.html'), 'utf-8');
var sw = fs.readFileSync(path.join(BASE, 'sw.js'), 'utf-8');
var bot = fs.readFileSync(path.join(ROOT, 'api/notify-bot.php'), 'utf-8');
var ht = fs.readFileSync(path.join(ROOT, 'api/.htaccess'), 'utf-8');

SECTION('US-332: دکمه‌های پیام‌رسان deep-link');
T('ماژول ثبت شده', idx.indexOf('messengers.js') > -1 && sw.indexOf('./messengers.js') > -1);
T('۵ پیام‌رسان: واتساپ/تلگرام/بله/ایتا/روبیکا', ['wa.me', 't.me', 'ble.ir', 'eitaa.com', 'rubika.ir'].every(function (d) { return ms.indexOf(d) > -1; }));
T('واتساپ با متن آماده (?text=)', ms.indexOf("'?text=' + encodeURIComponent(c.txt)") > -1);
T('نرمال‌سازی شماره ایران و ارقام فارسی (09→98)', ms.indexOf("FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'") > -1 && ms.indexOf("d = '98' + d.slice(1)") > -1);
T('متن آماده {نام} از US-330 وصل است', ms.indexOf('ptfMsgTpls') > -1 && ms.indexOf('ptfTplRender') > -1);
T('شناسه‌های پیام‌رسان روی رکورد مخاطب (msgIds)', ms.indexOf('c.msgIds = {') > -1);
T('دکمه 💬 روی ردیف مشتری و تامین‌کننده (MutationObserver)', ms.indexOf("['cTb', 'sTb']") > -1 && ms.indexOf('MutationObserver') > -1);
T('پیام‌رسان بدون text-param: کپی خودکار متن', ms.indexOf("appId !== 'wa' && txt") > -1);

SECTION('US-333: بات اعلان تلگرام/بله');
T('سرور notify-bot.php: status و send', bot.indexOf("case 'status'") > -1 && bot.indexOf("case 'send'") > -1);
T('کانفیگ خارج از webroot (الگوی sms-config)', bot.indexOf("'/bot-config.php'") > -1 && bot.indexOf('dirname(__DIR__, 2)') > -1);
T('تلگرام Bot API رسمی', bot.indexOf('https://api.telegram.org/bot') > -1);
T('بله Bot API (tapi.bale.ai)', bot.indexOf('https://tapi.bale.ai/bot') > -1);
T('گارد same-origin + rate limit ۳۰/ساعت', bot.indexOf('Cross-origin blocked') > -1 && bot.indexOf("> 30") > -1);
T('htaccess: notify-bot مجاز', /storage\|crm\|[^"]*notify-bot/.test(ht));
T('کلاینت: هوک notify اعلان‌های مهم (v13.8: گسترش به ارجاع/پرداخت/...)', ms.indexOf("'cheque', 'system', 'admin', 'referral'") > -1 && ms.indexOf('ptf_bot_enabled') > -1);
T('باکس تنظیمات: تست اتصال + پیام آزمایشی + کلید فعال‌سازی', ms.indexOf('تست اتصال بات') > -1 && ms.indexOf('ارسال پیام آزمایشی') > -1);
T('راهنمای گام‌به‌گام کارفرما موجود', fs.existsSync(path.join(ROOT, 'BOT-SETUP-GUIDE.md')));
T('راهنما: هشدار عدم ارسال توکن در چت', fs.readFileSync(path.join(ROOT, 'BOT-SETUP-GUIDE.md'), 'utf-8').indexOf('هرگز در چت') > -1);

SECTION('US-334: بسته APK (TWA)');
T('assetlinks.json در .well-known', fs.existsSync(path.join(ROOT, '.well-known/assetlinks.json')));
T('پکیج ir.pishtaj.crm', fs.readFileSync(path.join(ROOT, '.well-known/assetlinks.json'), 'utf-8').indexOf('ir.pishtaj.crm') > -1);
T('کانفیگ twa-manifest کامل', (function () { var t = fs.readFileSync(path.join(ROOT, '_tools/apk/twa-manifest.json'), 'utf-8'); return t.indexOf('pishtaj.ir') > -1 && t.indexOf('/crm/index.html') > -1 && t.indexOf('#ef4b1a') > -1; })());
T('راهنمای ساخت APK موجود', fs.existsSync(path.join(ROOT, '_tools/apk/APK-BUILD-GUIDE.md')));
T('راهنما: bubblewrap + keystore + assetlinks', (function () { var g = fs.readFileSync(path.join(ROOT, '_tools/apk/APK-BUILD-GUIDE.md'), 'utf-8'); return g.indexOf('bubblewrap build') > -1 && g.indexOf('keytool') > -1 && g.indexOf('assetlinks.json') > -1; })());
DONE('tester55-v135');
