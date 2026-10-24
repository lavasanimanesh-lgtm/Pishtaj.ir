# پروب‌های دقت پیام بات — ۲۰۲۶-۱۰-۲۴

این پوشه **هیچ کدی از محصول را تغییر نمی‌دهد**؛ فقط اسکریپت‌های بازتولید یافته‌های
`ARENA-BOT-MESSAGE-ACCURACY-ASSESSMENT-2026-10-24.md` است.

همهٔ پروب‌ها کد واقعی ریپو را اجرا می‌کنند: `api/rfq-notify-lib.php`, `api/crm.php`,
`api/sales-domain.php` در php-wasm (PHP 8.4) با curl شبیه‌سازی‌شده؛ هیچ تابع کسب‌وکاری
mock نشده است.

## پیش‌نیاز (بیرون از ریپو)

```bash
mkdir -p /tmp/phpwasm && cd /tmp/phpwasm
npm i php-wasm@0.2.0
```

## اجرا

```bash
cd <repo>
# ۱) ساخت پایهٔ مشترک از هارنس موجود e2e (همان زیرساخت request/state/curl مصنوعی)
mkdir -p /tmp/probe
ln=$(grep -n "^async function main()" _tools/uat/e2e-rfq-notify-phantom-v34.39.55.js | cut -d: -f1)
head -n $((ln-1)) _tools/uat/e2e-rfq-notify-phantom-v34.39.55.js > /tmp/probe/base.js
cp _tools/uat/probe-bot-accuracy-2026-10-24/*.js /tmp/probe/

# ۲) اجرا
export NODE_PATH=/tmp/phpwasm/node_modules
for f in probe1 probe2 probe3 probe4 probe5 probe6 probe7 probe8 probe9; do
  echo "===== $f ====="; node /tmp/probe/$f.js; done
```

| فایل | موضوع |
|---|---|
| `probe1.js` | مسیر `set_status` (کانبان/دراپ‌داون روی ردیف سایت): منبع، نام انجام‌دهنده، برچسب متن‌آزاد، شناسهٔ تکراری، «مشتری: نامشخص» |
| `probe2.js` | صف خروجی: ۵۰۲/timeout/۴۰۰/۴۰۳/۴۲۹، نرخ ۱ پیام در ۳ ثانیه، پیام کهنه، پیکربندی chat_id |
| `probe3.js` | واحد تولید متن: اثر انگشت رویداد، `waiting`، تغییر هم‌زمان `wf`+`st`، طول پیام، UTF-8، خط «رویداد» از wfLog |
| `probe4.js` | `data_push` قدیمی بدون base: حذف پیشنهاد/درخواست و اعلان کاذب |
| `probe5.js` | `data_push` فقط-پیشنهادها: بازخوانی گردش‌کار (WF91) و «وضعیت قبلی» پیام بعدی |
| `probe6.js` | تایید/رد از صف روی ردیف دارای `st` (بی‌صدا) |
| `probe7.js` | **یک اقدام، دو پیام** (entity_upsert + set_status) در هر دو ترتیب |
| `probe8.js` | `notify-bot.php?action=send` و نادیده‌گرفتن `ok:false` تلگرام |
| `probe9.js` | متن آزاد فرم سایت داخل پیام گروه |

> `probe2.js` و `probe3.js` مستقل‌اند (فقط به `php-wasm` نیاز دارند)؛ بقیه از
> `/tmp/probe/base.js` استفاده می‌کنند.
