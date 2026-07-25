# ریلیزنوت v29.6 — احراز هویت سروری JWT برای موتور کدگذاری و مالی (FIN-WF-001)

## مشکل
- نقش کاربر از هدر X-CRM-Role می‌آمد و قابل جعل بود → هر sales می‌توانست finance بخواند
- codegen بدون Rate Limit و بدون Token بود
- lead-finder و sms هنوز Math.random داشتند

## راه‌حل
| فایل | تغییر |
|---|---|
| api/auth.php **جدید** | تولید توکن HMAC با secret خارج webroot، ذخیره در tokens.json با exp 7 روز، verify، cleanup |
| api/crm.php | include auth.php, افزودن action auth_login (username+passhash → token+role), برای data_push/pull و actions مالی چک توکن اگر فرستاده شود وگرنه هشدار (transition)، override role از token |
| api/codegen.php | include auth.php, verify token (401 اگر اشتباه)، Rate Limit 60/min (429) |
| crm/index.html | showCrm() بعد از لاگین fetch auth_login و ذخیره ptf_crm_token در localStorage |
| crm/codegen.js + sync.js | ارسال X-CRM-Token از localStorage در هر reserve و data_push |
| crm/lead-finder.js + sms.js | حذف Math.random باقی‌مانده |
| _tools/audit.py | بخش 8 موتور کدگذاری دقیق‌تر |

## تست
1. لاگین با admin → localStorage ptf_crm_token باید پر باشد
2. Network → data_push و codegen reserve باید هدر X-CRM-Token داشته باشد
3. curl بدون توکن: باید با Rate Limit کار کند، با توکن اشتباه 401
4. curl 61 بار در 1 دقیقه: آخری 429
5. audit.py PASS

## نسخه
- VER v29.6, CACHE ptf-crm-v29.6, ZIP v29.6 ~25M
