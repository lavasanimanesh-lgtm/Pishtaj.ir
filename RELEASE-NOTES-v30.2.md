# ریلیزنوت v30.2 — جلوگیری از دوباره‌شماری opex لینک‌دار (FIN-WF-008)

## مشکل
- هزینه جاری با dealRef هم در ptf_crm_opex بود هم در deals.costEvents
- fiscal: projectProfit شامل costEvents (شامل opex لینک‌دار) و opexTotal هم شامل همان opex → 2 بار از سود کم می‌شد

## فیکس
| فایل | تغییر |
|---|---|
| crm/opex.js | ptfOpexSum حالا totalLinked/totalUnlinked جدا می‌دهد + ptfOpexSumFiscal که فقط unlinked را برمی‌گرداند |
| crm/fiscal.js | ox = ptfOpexSumFiscal(year) → فقط هزینه‌های مستقل از پرونده در سود سال |

## تست
1. یک هزینه جاری با لینک به پرونده فروش ثبت کن 10M
2. داشبورد سال مالی → opexTotal باید 10M کمتر از قبل نشان دهد؟ نه، باید فقط unlinked را نشان دهد
3. سود پروژه شامل آن 10M باشد ولی سود سال دوباره کم نکند - یعنی سود خالص درست شود

## نسخه
- VER v30.2
