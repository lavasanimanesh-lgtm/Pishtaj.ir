# tester2-rbac.js — وضعیت LEGACY

**دلیل prebroken:** این تستر به مسیر `/home/user/pishtaj/crm/index.html` و `/home/user/pishtaj/api/crm.php` ارجاع دارد که خارج از بسته deploy فعلی (`project_v21_9/`) است.

**تاریخ علامت‌گذاری:** v21.10 (اسپرینت اصلاحی)

**اقدام:** تستر به `_tools/uat/legacy/` منتقل شد. معادل جدید: tester130-v214 (RBAC + US-383) و tester106-v190 (ممیزی ادغام).

**نکته:** محتوای تست (ماتریس ۸ نقش، XSS، گارد سروری) توسط تسترهای جدید‌تر پوشش داده شده است.
