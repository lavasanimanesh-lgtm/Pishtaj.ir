# ریلیزنوت v31.2 — خانواده 1 امنیت کامل (FIN-WF-001)

## فیکس
- api/crm.php: برای تمام data_push/pull و مالی، توکن الزامی و role فقط از توکن - X-CRM-Role هدر نادیده گرفته می‌شود - جلوگیری از جعل نقش
- قبلاً فقط برای مالی 401 می‌داد، الان برای data_push/pull هم 401 بدون توکن

## تست
1. لاگین → token باید پر باشد
2. curl بدون توکن: curl -X POST .../crm.php?action=data_push → باید 401 token required
3. با توکن اشتباه → 401 invalid token
4. با توکن درست → 200

## نسخه
- VER v31.2
