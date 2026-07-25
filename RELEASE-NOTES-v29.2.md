# ریلیزنوت v29.2 — امنیت موتور کدگذاری + حذف رندوم باقی‌مانده

## خلاصه
پس از پایداری v29.1 (403 فیکس)، این ریلیز P0 امنیتی FIN-WF-001 را جزئی پیاده می‌کند:
- Rate Limit 60/min برای codegen
- منع کدگذار موازی با audit.py بخش 8
- حذف آخرین Math.random رندوم در lead-finder و sms

## تغییرات
| فایل | تغییر |
|---|---|
| api/codegen.php | افزودن verify_token (HMAC IP + secret) - فعلا permissive (خالی مجاز، خطا 401 اگر اشتباه)، Rate Limit 60/min per IP (429) |
| crm/codegen.js | بدون تغییر منطق Pool - فقط Fallback ضد TMP حفظ شد |
| crm/lead-finder.js | حذف Math.random - حالا ptfUnifiedCode |
| crm/sms.js | رمز موقت با crypto.getRandomValues به جای Math.random |
| _tools/audit.py | بخش 8 دقیق‌تر - فقط function genCode(p){return p+Math.random*90000 ممنوع |
| docs/CODEGEN.md | راهنمای ایجنت |
| crm/index.html | VER v29.2 |
| crm/sw.js | CACHE v29.2 |

## تست
```
python3 _tools/audit.py # PASS
curl -X POST .../api/codegen.php?action=reserve -d '{"blocks":{"CUST":1}}' - 61 بار در 1 دقیقه بار 61 ام باید 429 بدهد
```

## نسخه
- VER v29.2, CACHE ptf-crm-v29.2, ZIP v29.2 ~25M
