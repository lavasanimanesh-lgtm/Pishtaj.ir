# tester5-site.js — وضعیت LEGACY

**دلیل prebroken:** به `/home/user/pishtaj/assets/js/ptf-chat.js` و `/home/user/pishtaj/assets/js/ptf-advisor.js` ارجاع دارد که خارج از بسته فعلی است.

**تاریخ علامت‌گذاری:** v21.10

**اقدام:** تستر به `_tools/uat/legacy/` منتقل شد. این تستر مربوط به **وب‌سایت عمومی** (چت، مشاور متریال، PWA) است نه CRM.

**نکته:** تست وب‌سایت در scope CRM نیست. در صورت نیاز تست سایت، باید در بسته جداگانه سایت اجرا شود.
