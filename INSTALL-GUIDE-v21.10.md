# 📋 دستورالعمل نصب تمیز — pishtaj-release-v21.10.zip

**نسخه:** v21.10 (اسپرینت اصلاحی)  
**تاریخ:** ۱۴۰۵/۰۴/۲۱ (۲۰۲۶-۰۷-۱۱)  
**هدف:** نصب تمیز و ایمن CRM v21.10 روی هاست (cPanel / DirectAdmin / FTP)

---

## ⚠️ مهم قبل از شروع

### ❌ هرگز این کارها را نکنید
- **حذف پوشه `crm/data/`** — داده‌های کاربران در اینجاست!
- **حذف پوشه `api/` بدون extract-overwrite** — فایل‌های PHP سروری پاک می‌شوند
- **نصب روی نسخه قدیمی بدون رفرش کش** — SW cache باعث mismatch می‌شود

### ✅ حتماً این کارها را بکنید
- **بک‌آپ از داده** قبل از هر تغییر
- **extract-overwrite** (جایگزینی فایل‌ها) نه حذف و ساخت مجدد
- **Ctrl+F5** در مرورگر پس از نصب

---

## 🔧 روش ۱: نصب از طریق File Manager هاست (توصیه‌شده)

### مرحله ۱: بک‌آپ گیری (۵ دقیقه)

```
۱. وارد cPanel / DirectAdmin شوید
۲. File Manager → public_html → crm → data
۳. روی ptf_crm_data.json راست‌کلیک → Copy
۴. نام کپی: ptf_crm_data.json.backup-20260711
۵. همین کار را برای api/ انجام دهید (فایل‌های PHP)
```

### مرحله ۲: آپلود بسته (۵ دقیقه)

```
۱. File Manager → public_html
۲. Upload → pishtaj-release-v21.10.zip را انتخاب کنید
۳. پس از آپلود کامل، راست‌کلیک روی zip → Extract
۴. مسیر Extract: public_html/ (ریشه)
۵. گزینه Overwrite files را تیک بزنید
۶. Extract را بزنید
```

### مرحله ۳: بررسی پرمیشن‌ها (۲ دقیقه)

| مسیر | پرمیشن | توضیح |
|:---|:---:|:---|
| `crm/data/` | ۷۵۵ | خواندن/نوشتن داده |
| `crm/data/.htaccess` | ۶۴۴ | محافظت از دسترسی مستقیم |
| `api/` | ۷۵۵ | اجرای PHP |
| `api/.htaccess` | ۶۴۴ | محدودسازی اکشن‌ها |

```
در File Manager:
- روی پوشه crm/data راست‌کلیک → Change Permissions → 755
- روی فایل .htaccess راست‌کلیک → 644
```

### مرحله ۴: رفرش کش مرورگر (۱ دقیقه)

```
۱. سایت را باز کنید: https://pishtaj.ir/crm/
۲. Ctrl + F5 (ویندوز) یا Cmd + Shift + R (مک)
۳. وارد شوید و بررسی کنید:
   - نسخه پایین صفحه: باید v21.10 باشد
   - Service Worker: DevTools → Application → Service Workers → ptf-crm-v21.10
```

---

## 🔧 روش ۲: نصب از طریق FTP/SFTP

### مرحله ۱: بک‌آپ

```bash
# با FTP client (FileZilla):
# ۱. دانلود پوشه crm/data/ به کامپیوتر
# ۲. دانلود پوشه api/ به کامپیوتر
```

### مرحله ۲: اکسترکت محلی و آپلود

```bash
# در کامپیوتر:
unzip pishtaj-release-v21.10.zip -d ./pishtaj-new/

# با FTP client:
# ۱. وارد public_html شوید
# ۲. فایل‌های داخل pishtaj-new/crm/ را به crm/ آپلود کنید (Overwrite)
# ۳. فایل‌های داخل pishtaj-new/api/ را به api/ آپلود کنید (Overwrite)
# ⚠️ دقت: فقط فایل‌ها را جایگزین کنید، پوشه data را حذف نکنید!
```

---

## 🔧 روش ۳: نصب از طریق SSH (برای کاربران حرفه‌ای)

```bash
# ۱. وارد سرور شوید
ssh user@pishtaj.ir

# ۲. به ریشه وب بروید
cd ~/public_html

# ۳. بک‌آپ (اجباری)
cp -r crm/data crm/data.backup-$(date +%Y%m%d-%H%M%S)
cp -r api api.backup-$(date +%Y%m%d-%H%M%S)

# ۴. آپلود بسته (با scp از کامپیوتر)
# scp pishtaj-release-v21.10.zip user@pishtaj.ir:~/public_html/

# ۵. اکسترکت با overwrite
unzip -o pishtaj-release-v21.10.zip

# ۶. پرمیشن‌ها
chmod 755 crm/data
chmod 644 crm/data/.htaccess
chmod 755 api
chmod 644 api/.htaccess

# ۷. بررسی نسخه
grep -o 'ptf-crm-v21.10' crm/sw.js | head -1
grep -o "VER = 'v21.10" crm/index.html | head -1

# ۸. پاکسازی zip (اختیاری)
rm pishtaj-release-v21.10.zip
```

---

## ✅ چک‌لیست تأیید نصب

پس از نصب، این موارد را بررسی کنید:

| # | بررسی | روش | نتیجه مورد انتظار |
|:---:|:---|:---|:---|
| ۱ | نسخه CRM | پایین صفحه login | `v21.10` |
| ۲ | Service Worker | DevTools → Application → SW | `ptf-crm-v21.10` |
| ۳ | داده سرور | وارد شوید → مشتریان | رکوردها حفظ شده |
| ۴ | API سروری | تنظیمات → تست بات | پاسخ JSON سالم |
| ۵ | ماژول‌های جدید | پیشنهاد → فیلتر مشتری | US-450 کار می‌کند |
| ۶ | دفترچه پیامکی | پیامک → سینک | BUG-038 رفع شده |

---

## 🆘 عیب‌یابی

### مشکل ۱: صفحه سفید / لود نمی‌شود
```
علت: cache مرورگر قدیمی
رفع: Ctrl+F5 → اگر نشد: DevTools → Application → Service Workers → Unregister → رفرش
```

### مشکل ۲: داده‌ها خالی / رکوردها نیستند
```
علت: احتمالاً crm/data/ حذف یا overwrite شده
رفع: از بک‌آپ restore کنید:
cp crm/data.backup-XXXX/ptf_crm_data.json crm/data/
```

### مشکل ۳: API خطای ۵۰۳/۵۰۰
```
علت: پرمیشن PHP یا .htaccess خراب
رفع:
chmod 755 api
chmod 644 api/.htaccess
# بررسی error_log در cPanel
```

### مشکل ۴: SW cache نسخه قدیمی
```
علت: مرورگر SW قدیمی را نگه داشته
رفع:
DevTools → Application → Service Workers → Unregister
DevTools → Application → Cache Storage → Delete all
Ctrl+F5
```

### مشکل ۵: فایل‌های zip قبلی در هاست مانده
```
علت: zip قدیمی فضا اشغال کرده
رفع:
rm -f ~/public_html/pishtaj-release-v*.zip
```

---

## 📞 پشتیبانی

در صورت بروز هر مشکل:
1. ابتدا بک‌آپ را برگردانید
2. گزارش خطا را از DevTools → Console کپی کنید
3. با تیم فنی تماس بگیرید

---

*این دستورالعمل توسط ایجنت Arena.ai برای نسخه v21.10 تولید شده است.*
