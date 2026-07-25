# ریلیزنوت v30.1 — توکن اجباری برای مالی (FIN-WF-001 کامل)

## مشکل
- تا v29.6.1 توکن اگر نفرستی هم اجازه می‌داد (transition)
- X-CRM-Role قابل جعل بود

## فیکس
| فایل | تغییر |
|---|---|
| api/crm.php | data_push/pull و تمام مالی بدون توکن → 401 token required |
| api/codegen.php | reserve/reconcile بدون توکن → 401 |
| api/auth.php | همان |
| crm/index.html | VER v30.1 |
| crm/sw.js | CACHE v30.1 |

## تست
1. لاگین → localStorage token باید پر باشد
2. curl بدون توکن: curl -X POST .../crm.php?action=data_push → باید 401
3. با توکن: باید 200
4. کار روزمره: درخواست، کالا P-1160، چک شرکتی CEO

## نسخه
- VER v30.1
