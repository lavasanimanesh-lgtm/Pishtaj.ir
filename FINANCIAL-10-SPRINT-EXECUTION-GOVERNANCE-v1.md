# منشور اجرای ۱۰ Sprint مالی و استقرار عملیاتی

**وضعیت:** مصوب کارفرما برای اجرا، مشروط به گیت هر Sprint  
**قاعده:** هیچ Sprint بعدی بدون گزارش، ممیزی داخلی PASS و تایید مرحله‌ای کارفرما آغاز نمی‌شود.

---

## ۱. هدف پروژه

هدف تنها رفع کد نیست. خروجی باید سامانه‌ای باشد که کاربران مالی و اجراییِ غیرمتخصص بتوانند با آن:
- سند درست ثبت کنند؛
- خطای خود را بدون backup کامل اصلاح کنند؛
- نقش و مسئولیت خود را بفهمند؛
- گزارش قابل اعتماد بگیرند؛
- و بدون لطمه به دادهٔ دیگر کاربران کار کنند.

---

## ۲. قرارداد خروجی انتهای هر Sprint

هر Sprint باید پیش از درخواست ورود به Sprint بعدی، دقیقاً این پنج خروجی را داشته باشد:

1. **گزارش تغییرات:** فایل‌ها، توابع، داده‌های تحت اثر، رفتار قبل/بعد.
2. **ریسک باقیمانده:** موارد باز، محدودیت‌ها و تصمیم‌های معلق.
3. **شواهد تست:** baseline، fixture، PASS/FAIL، UAT مرورگر و نتایج staging در صورت وجود.
4. **ممیزی داخلی:** وضعیت PASS / FAIL / BLOCKED با معیارهای خروج همان Sprint.
5. **تصمیم کارفرما:** مواردی که بدون تایید آن‌ها ادامه مجاز نیست.

فرمت وضعیت هر Sprint:

```text
Sprint Status: PASS | FAIL | BLOCKED
Production deploy: Not requested | Approved | Rejected
Migration: None | Dry-run only | Approved execution
Open decisions: [ ... ]
```

---

## ۳. Roadmap اجرایی ۱۰ Sprint

> **ثبت تغییر برنامه:** hotfixهای اضطراری CO Margin، pagination چاپ، rollback آن و ایمنی نگاشت اقلام با تایید مستقیم کارفرما، نسخه‌های رسمی `v28.4` تا `v28.7` را مصرف می‌کنند و خارج از دامنهٔ P0 مالی است. بنابراین شمارهٔ نسخه‌های پیشنهادی Sprintهای امنیتی پس از آن یک گام جابه‌جا می‌شوند؛ ترتیب و گیت‌های ده‌گانه تغییری نمی‌کنند.

| مرحله | دامنه | خروجی عملیاتی برای کاربر غیر فنی | گیت خروج |
|---|---|---|---|
| Stage 0 | مدل مرجع، role policy، fixture و rollback | واژه‌نامه سادهٔ سندهای مالی و نقش‌ها | طراحی + تصمیم‌های policy تایید |
| Sprint 1 | PoC امنیتی FIN-WF-001 روی staging | ندارد؛ فقط evidence فنی | PoC staging و حکم production-risk |
| Sprint 2 | FIN-WF-001 observe-mode auth/RBAC | پیام‌های ورود/انقضای session قابل فهم | login/sync/backup regression PASS |
| Sprint 3 | FIN-WF-001 enforcement + FIN-WF-002 inventory | گزارش وضعیت چک‌های شخصی قدیمی | ACL PASS، inventory تایید |
| Sprint 4 | FIN-WF-002 personal cheque privacy | راهنمای کوتاه «چک شخصی من» | دوکاربر/دودستگاه PASS |
| Sprint 5 | FIN-WF-003 company cheque workflow | راهنمای «درخواست/تایید/صدور چک شرکت» | role matrix PASS |
| Sprint 6 | FIN-WF-004 guard سال در observe mode | پیام‌های هشدار سال مالی واضح | همه mutationها inventory/log شده |
| Sprint 7 | FIN-WF-004 enforce + FIN-WF-005 merge | راهنمای اصلاح سند و conflict | locked-year و two-device PASS |
| Sprint 8 | reversal receipt + opex/petty integrity | راهنمای «اصلاح اشتباه بدون backup» | customer/supplier/opex/petty E2E PASS |
| Sprint 9 | reconciliation، حذف امن، تاریخ canonical | کارتابل کیفیت داده مالی | reconciliation PASS |
| Sprint 10 | آمادگی bank/cash و ممیزی readiness | راهنمای پایلوت بانک/صندوق | Go / No-Go تایید کارفرما |

> نسخه‌های رسمی release فقط در Sprintهایی صادر می‌شوند که تغییر کد تاییدشده دارند. Sprint 1 PoC و Stage 0 لزوماً release Production ندارند.

---

## ۴. ممیزی نهایی End-to-End پس از Sprint 10

ممیزی نهایی باید همهٔ موارد زیر را پوشش دهد:

- Workflow مالی مشتری از invoice تا receipt/reversal؛
- Workflow تأمین از invoice تا payment/allocation/void؛
- چک personal/company/third-party؛
- role access در UI، function و API؛
- sync دو دستگاه و conflict؛
- backup/restore sandbox؛
- fiscal lock/unlock/amendment؛
- reporting و reconciliation؛
- PWA/offline behavior؛
- امنیت endpointهای مالی.

**خروجی ممیزی نهایی:**
1. یافته‌ها؛
2. موارد اصلاح‌شده با evidence؛
3. موارد باز و ریسک پذیرفته‌شده؛
4. پیشنهادهای توسعه آتی؛
5. تصمیم Go/No-Go برای مرحلهٔ بانک/صندوق یا بهره‌برداری گسترده.

---

## ۵. راهنمای جامع کاربری و بهره‌برداری در انتهای پروژه

راهنما فقط پس از تثبیت UI نهایی و UAT تهیه می‌شود تا با محیط واقعی هم‌خوان باشد.

### خروجی‌های تحویلی
- PDF قابل چاپ برای آموزش؛
- Word قابل ویرایش (`.docx`) برای به‌روزرسانی داخلی؛
- نسخهٔ Markdown/منبع کنترل‌شده؛
- تصاویر واقعی از محیط UAT تاییدشده، بدون دادهٔ محرمانه.

### فصل‌های الزامی
1. معرفی سامانه، واژه‌نامه و نقش‌ها؛
2. سطوح دسترسی و مسئولیت هر نقش؛
3. ثبت و پیگیری درخواست‌ها؛
4. ثبت فاکتور، دریافت، پرداخت و اصلاح/reversal؛
5. چک شخصی، شرکتی و ثالث؛
6. سال مالی، قفل، amendment و بازگشایی کنترل‌شده؛
7. حساب مشتری/تأمین‌کننده و گزارش‌ها؛
8. Backup/Restore و ممنوعیت استفاده از restore برای اصلاح سند؛
9. خطاهای متداول و رفع مرحله‌ای؛
10. سناریوهای روزمره گام‌به‌گام همراه تصویر؛
11. چک‌لیست پایان روز/هفته/ماه کاربران مالی و اجرایی؛
12. مسیر اعلام خطا و escalation.

### اصول نگارش
- زبان غیر فنی و فارسی روشن؛
- یک هدف عملیاتی در هر صفحه/سناریو؛
- هشدارهای قرمز برای عملیات غیرقابل برگشت؛
- تصویر فقط از محیط تاییدشده؛
- هر سناریو شامل «چه کسی»، «چه زمانی»، «چه چیزی ثبت می‌شود»، «چه گزارشی باید تغییر کند» و «اگر خطا شد چه کنیم» باشد.
