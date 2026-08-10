# راه‌اندازی گزارش PDF خودکار و پیامک مدیریتی

## ۱. بررسی سرور لینوکس

از SSH یا ترمینال هاست اجرا کنید:

```bash
php -v
which chromium
which chromium-browser
which google-chrome
php -m | grep -E 'curl|mbstring'
crontab -l
```

اگر یکی از مسیرهای Chromium نمایش داده شد، موتور PDF آماده است.

## ۲. نصب Chromium در Ubuntu/Debian با دسترسی sudo

```bash
sudo apt update
sudo apt install -y chromium fonts-vazirmatn fonts-dejavu-core
```

اگر پکیج اول پیدا نشد:

```bash
sudo apt install -y chromium-browser
```

Chromium و فونت‌ها متن‌باز و بدون هزینه لایسنس هستند. هزینه احتمالی فقط منابع CPU/RAM هنگام تولید PDF است.

## ۳. تنظیمات امن

فایل زیر را خارج از public_html بسازید:

```bash
cp /PATH/TO/public_html/api/management-report-config.sample.php \
  /home/USERNAME/management-report-config.php
chmod 600 /home/USERNAME/management-report-config.php
```

در آن مسیر Chromium و آدرس CRM را تنظیم کنید:

```php
'crm_url' => 'https://pishtaj.ir/crm/#anl',
'chromium_bin' => '/usr/bin/chromium',
```

## ۴. تست

```bash
cd /PATH/TO/public_html/api
php management-report-cron.php --diagnose
php management-report-cron.php --period=weekly --dry-run
php management-report-cron.php --period=weekly
```

اگر Chromium نصب نباشد، سیستم snapshot و گزارش HTML fallback ایجاد می‌کند، آن را در تاریخچه CRM نگه می‌دارد و لینک CRM را با پیامک برای گیرندگان مجاز می‌فرستد. مدیر پس از ورود به CRM گزارش را باز می‌کند و از مرورگر PDF می‌گیرد. این همان گزینه A بدون هزینه است؛ PDF خودکار پس از فعال‌سازی Chromium بدون تغییر نرم‌افزار فعال می‌شود.

## ۵. Cron

```bash
# هفتگی، شنبه 08:00
0 8 * * 6 /usr/bin/php /PATH/TO/public_html/api/management-report-cron.php --period=weekly >> /home/USERNAME/logs/management-report.log 2>&1

# ماهانه، روز اول هر ماه میلادی 08:00
0 8 1 * * /usr/bin/php /PATH/TO/public_html/api/management-report-cron.php --period=monthly >> /home/USERNAME/logs/management-report.log 2>&1

# فصلی
0 9 1 1,4,7,10 * /usr/bin/php /PATH/TO/public_html/api/management-report-cron.php --period=quarterly >> /home/USERNAME/logs/management-report.log 2>&1

# سالانه
0 10 1 1 * /usr/bin/php /PATH/TO/public_html/api/management-report-cron.php --period=annual >> /home/USERNAME/logs/management-report.log 2>&1
```

## امنیت

- Cron فقط CLI است و از وب قابل اجرا نیست.
- گزارش در storage خصوصی ذخیره می‌شود.
- پیامک فقط لینک CRM ارسال می‌کند؛ گزارش پس از ورود و کنترل نقش باز می‌شود.
- گیرندگان نقش‌محور یا شماره‌های مشخص در فایل تنظیمات تعیین می‌شوند.
- هر تولید در history و audit CRM ثبت می‌شود.
