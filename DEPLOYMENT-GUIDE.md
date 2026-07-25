# راهنمای استقرار نسخه v31.7.4

## 📦 محتویات این بسته

این ZIP شامل سورس کامل CRM با تمام اصلاحات امنیتی و عملکردی نسخه v31.7.4 است.

**تاریخ:** 2026-07-18  
**نسخه:** v31.7.4  
**حجم:** ~24MB  
**تعداد فایل:** 1339

---

## 🔴 اصلاحات انجام شده

### باگ‌های P0 (بحرانی) - ۵ مورد ✅
1. **BUG-AUDIT-001** - ذخیره رمز عبور Plaintext → رفع شد
2. **BUG-AUDIT-002** - Overwrite تنظیمات admin → رفع شد
3. **BUG-AUDIT-003** - غیرفعال بودن verify_request → رفع شد
4. **BUG-AUDIT-004** - نشت passhash کاربران → رفع شد
5. **BUG-AUDIT-005** - Secrets هاردکد شده → رفع شد

### باگ‌های P1 (مهم) - ۷ مورد ✅
6. **BUG-AUDIT-006** - SSL Verification خاموش → فعال شد
7. **BUG-AUDIT-007** - نشت چک شخصی به گزارش شرکت → رفع شد
8. **BUG-AUDIT-008** - Auto-Settle بدون Reversal → رفع شد
9. **BUG-AUDIT-009** - verify_request تکراری → حذف شد
10. **BUG-AUDIT-010** - Stacking در Polling → رفع شد
11. **BUG-AUDIT-011** - Device ID ضعیف → UUID-like شد
12. **BUG-AUDIT-012** - Role Guard برای Settings → اضافه شد

### اصلاحات Sync و Codegen (v31.7.3) - ۴ مورد ✅
- Race condition در data_push → flock اضافه شد
- Financial entity codegen → فقط server pool
- TMP save block → چک/فاکتور/پرداخت
- ptfMergeNoCollapse ordering → نرمال‌سازی کلیدها

### بهبودهای اضافی - ۲ مورد ✅
- Sync timing → 500ms برای کلیدهای مالی
- Contract test → تست تطابق ۴۸ کلید sync

---

## 🚀 مراحل استقرار

### 1. استخراج فایل

```bash
# استخراج در public_html
cd /home/user/public_html
unzip -o ptf-crm-v31.7.4.zip -d .
mv ptf-crm-v31.7.4/* .
rmdir ptf-crm-v31.7.4
```

### 2. ایجاد فایل secrets

```bash
# کپی template به location خارج از webroot
cp api/ptf-secrets.sample.php /home/user/ptf-secrets.php

# ویرایش با secrets واقعی
nano /home/user/ptf-secrets.php
```

**محتوای `ptf-secrets.php`:**
```php
<?php
return [
    'hmac_key' => 'your-secure-hmac-key-min-32-chars',
    'sensitive_action_key' => 'your-secure-sensitive-action-key',
    'captcha_key' => 'your-secure-captcha-key',
    'default_admin_hash' => 'f83b331362471ae55eeb42e54a2d46584dd9a1809dfc821fb2244c5b1b3ddabd',
    'auth_key' => 'your-secure-auth-key-min-32-chars',
];
```

### 3. تنظیم permissions

```bash
chmod 600 /home/user/ptf-secrets.php
chown www-data:www-data /home/user/ptf-secrets.php
chmod 755 api/
chmod 644 api/*.php
```

### 4. بررسی syntax

```bash
for f in api/*.php; do php -l "$f"; done
```

---

## ✅ چک‌لیست پس از استقرار

### تست‌های امنیتی
- [ ] تمام endpointها authentication می‌خواهند (به جز whitelist)
- [ ] `users_get` مقدار `passhash` را برنمی‌گرداند
- [ ] بارگذاری secrets از `/home/user/ptf-secrets.php` کار می‌کند
- [ ] SSL verification در عملیات S3 فعال است
- [ ] admin نمی‌تواند از طریق settings save قفل شود

### تست‌های عملکردی
- [ ] Sync بین چند device کار می‌کند
- [ ] چک‌های شخصی در گزارش‌های شرکتی دیده نمی‌شوند
- [ ] ایجاد و برگشت auto-settle کار می‌کند
- [ ] Polling تحت بار stack نمی‌شود
- [ ] TMP code blocking برای CHQ/INV/PAY فعال است

### تست‌های Regression
- [ ] اجرای regression suite کامل (۱۶۱ فایل، ۳۸۰۸ چک)
- [ ] audit.py pass می‌شود
- [ ] Contract test برای sync keys (۴۸ کلید مطابقت دارند)

---

## 📁 فایل‌های جدید

| فایل | توضیح |
|------|--------|
| `api/secrets.php` | مدیریت متمرکز secrets |
| `api/ptf-secrets.sample.php` | Template پیکربندی secrets |
| `tester185-v329-sync-keys-contract.js` | Contract test sync keys |

---

## 📁 فایل‌های تغییر یافته

### Backend (PHP)
- `api/crm.php` - رفع‌های امنیتی، مدیریت secrets
- `api/auth.php` - ادغام با secrets management
- `api/attachment-read.php` - SSL verification

### Frontend (JavaScript)
- `crm/sync.js` - sync timing، merge ordering، urgent keys
- `crm/codegen.js` - server-only prefixes، TMP block، device ID
- `crm/cheques.js` - فیلتر ownership، TMP block
- `crm/rbac.js` - TMP block برای invoice
- `crm/supplier-finance.js` - TMP block برای payment
- `crm/salesfiles.js` - برگشت auto-settle
- `crm/bridge.js` - stack guard برای polling
- `crm/index.html` - version bump به v31.7.4

---

## 🔄 Migration Notes

### رمزهای عبور قدیمی

**مشکل:** کاربران ایجاد شده با `add_user` قدیمی رمزهای plaintext دارند

**راه حل:**
- گزینه 1: Force password reset برای همه کاربران
- گزینه 2: استفاده از `users_sync` برای بازسازی با passhash

### پروژه‌های موجود

**مشکل:** پروژه‌های موجود فیلد `autoSettleReceipts` را ندارند

**راه حل:**
- نیازی به migration نیست
- فیلد optional است، پروژه‌های جدید آن را خواهند داشت
- پروژه‌های قدیمی بدون این فیلد کار می‌کنند

---

## 📋 فایل‌های مستندات

| فایل | توضیح |
|------|--------|
| `RELEASE-NOTES-v31.7.4.md` | Release notes کامل (انگلیسی) |
| `COMPLETE-FIX-SUMMARY-v31.7.4.md` | گزارش کامل رفع باگ‌ها (فارسی) |
| `CODEGEN-SYNC-ANALYSIS-v31.7.2.md` | تحلیل سیستم codegen و sync |
| `BUGS-REMAINING-v31.7.2.md` | لیست باگ‌های باقی‌مانده |
| `EXPERT-REVIEW-CODE-AUDIT-v31.7.2.md` | گزارش audit کد |

---

## ⚠️ نکات مهم

1. **Backup:** قبل از استقرار، از نسخه فعلی backup کامل بگیرید
2. **Staging:** ابتدا روی staging تست کنید، سپس production
3. **Secrets:** فایل `ptf-secrets.php` را **هرگز** commit نکنید
4. **Permissions:** فایل secrets باید فقط توسط www-data خوانده شود
5. **Monitoring:** لاگ‌های امنیتی را در ۲۴ ساعت اول به دقت بررسی کنید

---

## 🎯 نسخه بعدی: v31.8

### برنامه‌ریزی شده:
- رفع ۱۰ باگ P2 (setInterval cleanup)
- مهاجرت به event-driven architecture
- Memory leak prevention
- Performance optimization

**تخمین زمان:** ۲-۳ روز کاری

---

## 📞 پشتیبانی

در صورت بروز مشکل:
1. لاگ‌های PHP را بررسی کنید: `tail -f /var/log/apache2/error.log`
2. لاگ‌های CRM را بررسی کنید: `cat crm/data/api_log.txt`
3. Status sync را چک کنید: badge باید 🟢 باشد
4. Network tab مرورگر را بررسی کنید

---

**موفق باشید! 🚀**

*توسعه‌دهنده: PTF Development Team*  
*تاریخ: 2026-07-18*
