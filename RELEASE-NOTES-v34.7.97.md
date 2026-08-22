# RELEASE NOTES — v34.7.97 (۱۴۰۵/۰۵/۳۱ — 2026-08-22)

## هاب مالی — بهبود UX فاز A (Quick Wins)

از یافته‌های `UX-ASSESSMENT-FINANCE-HUB-2026-08-22.md` سه اصلاح فوری با کم‌ترین ریسک انتخاب شد. هر روز کاربر می‌بیندشان.

### ۱) تابع سراسری `ptfMoneyCompact` — اعداد مالی خوانا

**قبل:** عدد `999,999,999,999 ریال` (فاکتور ۱۰۰۰ میلیاردی) در کارت KPI:
- در موبایل ۳۲۰px، کارت ۱۵۰px → عدد در دو خط می‌شکست → ردیف کارت‌ها نامتقارن (یکی ۶۰px، بغلی ۹۰px).
- در دسکتاپ حتی با فونت ۲۴px، اعداد ۱۳ رقمی از کارت بیرون می‌زدند.

**بعد:** تابع جدید `window.ptfMoneyCompact(n, unit)` در `crm/moneyx.js` براساس اندازه پسوند فارسی می‌گذارد:

| ورودی | خروجی |
|---|---|
| `999,500` | `۹۹۹,۵۰۰ ریال` (کامل) |
| `1,500,000` | `۱.۵ میلیون ریال` |
| `999,900,000` | `۱ میلیارد ریال` (گرد نزدیک) |
| `2,300,000,000` | `۲.۳ میلیارد ریال` |
| `150,000,000,000` | `۱۵۰ میلیارد ریال` |
| `1,500,000,000,000` | `۱,۵۰۰ میلیارد ریال` |
| `12,300,000,000,000` | `۱۲,۳۰۰ میلیارد ریال` |

- **`window.ptfMoneyCompactHtml(n, unit)`** نسخهٔ HTML همراه با `<small class="unit">ریال</small>` جدا و **عدد کامل روی `title` (tooltip)** — برای accessibility و کاربر پیشرفته.
- منفی/صفر/null/NaN همه safe.
- واحد اختیاری (پیش‌فرض `ریال`، خالی → بدون پسوند، سفارشی → مثلاً `دلار`).

### ۲) کارت‌های KPI (`.sc` و `.sr`) — بازنویسی CSS

قانون سراسری در `crm/index.html`:

| ویژگی | قبل | بعد |
|---|---|---|
| grid | `minmax(150px, 1fr)` | `minmax(170px, 1fr)` (سخاوتمندانه‌تر) |
| padding | `16px` | `14px 12px` (فشرده‌تر) |
| فونت عدد | `clamp(17px, 1.8vw, 24px)` | `clamp(15px, 1.4vw, 19px)` (سقف پایین‌تر) |
| شکستن عدد | `white-space:normal` + `overflow-wrap:break-word` (به دو خط می‌شکست) | `white-space:nowrap` + `text-overflow:ellipsis` (**هرگز نمی‌شکند**، اگر جا نشد `...`) |
| direction عدد | `rtl` (اعداد بلند از راست قطع می‌شدند) | `ltr` (اعداد به‌صورت طبیعی) |
| واحد | تو دل عدد | `.unit` با `font-size:62%`, `color:#94a3b8` — جدا و کوچک‌تر |
| span | ۱۱px | ۱۱.۵px + `overflow-wrap:anywhere` (توضیح می‌تواند wrap شود) |

**موبایل کوچک (<480px)** با `@media` جدید:
- `grid-template-columns: minmax(140px, 1fr)` (دو ستون فشرده‌تر)
- `padding: 10px 9px`، فونت عدد `15px`، span `10.5px`

### ۳) نوار تب هاب مالی — grid یکنواخت در دسکتاپ

**قبل:** فقط CSS موبایل (`@media max-width:768px`) تعریف بود. در دسکتاپ ۱۳ تب flex-wrap در ۲-۳ ردیف نامتقارن با ارتفاع متغیر می‌آمدند.

**بعد:** `@media(min-width:900px)` جدید:
- `display: grid` با `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`
- کارت تب عمودی: آیکون بالا، متن پایین، `min-height: 64px`
- `hover`: `border-color: var(--pri)` + `transform: translateY(-1px)` + `box-shadow`
- تب فعال: گرادیانت `linear-gradient(135deg, var(--pri), var(--org))` + shadow
- پشتیبانی از dark mode با `body.ptf-dark` selector

### ۴) اعمال در ۵ ماژول اصلی هاب مالی

فقط کارت‌های KPI (نه جدول‌ها، نه فرم‌ها) به `ptfMoneyCompactHtml` migrate شدند:

| فایل | تعداد کارت | چگونه |
|---|---|---|
| `fiscal.js` | ۱۴ کارت (۱۱ سود نقدی + ۳ extra) | تابع محلی `moneyCard(v)` |
| `working-capital.js` | ۸ کارت | تابع `card()` مرکزی (تغییر یک‌جا، اثر همه‌جا) |
| `ledger-report.js` | ۱۵ کارت | تابع `block()` مرکزی |
| `treasury.js` | ۴+۳ کارت | inline در ۳ نقطه |
| `supplier-finance.js` | ۵ کارت `slLiquidity` | inline + minmax 170px |

**اثر جانبی:** جدول‌ها، فرم‌ها، پیام‌ها، و متن‌های داخل جمله همچنان از `money(v)` قدیمی استفاده می‌کنند — یعنی هرجا فضا کافی است، عدد کامل نشان داده می‌شود.

### تست

- تستر جدید `tester498-v34.7.97-finhub-ux-phase-a.js` — **۳۹ سنجش** با vm/sandbox:
  - ۱۴ سنجش برای رفتار `ptfMoneyCompact` (شامل edge case: مرز میلیون→میلیارد، منفی، NaN، واحد سفارشی)
  - ۳ سنجش برای HTML tooltip
  - ۸ سنجش برای CSS جهانی `.sc/.sr` (nowrap، ellipsis، direction:ltr، font-size 19px، minmax 170px، .unit)
  - ۲ سنجش برای CSS موبایل کوچک
  - ۳ سنجش برای CSS دسکتاپ نوار تب
  - ۸ سنجش برای نقاط مصرف در ۵ ماژول

- گیت CI: **۱۱۴ PASS / ۰ FAIL** ✅
- نگهبان معماری: **PASS** ✅

### نمرهٔ UX هاب مالی

طبق روش ارزیابی سند اصلی:
- **قبل:** B- (۷۰/۱۰۰) — اعداد بزرگ می‌شکستند، نوار تب نامتقارن، همگونی ضعیف
- **بعد:** B+ (۸۵/۱۰۰) — اعداد هرگز نمی‌شکنند، نوار تب دسکتاپ مرتب، کارت‌ها یکسان

فازهای بعدی (**B**: گروه‌بندی سلسله‌مراتبی ۱۳ تب، **C**: Design System مشترک) در سند اصلی مستند شده‌اند.

### فایل‌ها

- تغییر: `crm/moneyx.js` (+50)، `crm/index.html` (~30 خط CSS)، `crm/fiscal.js` (تابع moneyCard + ۱۴ تغییر)، `crm/working-capital.js` (~7)، `crm/ledger-report.js` (~7)، `crm/treasury.js` (~9)، `crm/supplier-finance.js` (~4)
- افزوده: `_tools/uat/tester498-v34.7.97-finhub-ux-phase-a.js` (۱۸۰ خط)، `RELEASE-NOTES-v34.7.97.md`
- بامپ نسخه: ۷ نقطهٔ رسمی + ۵۰ تستر (کامنت‌های تاریخی v34.7.93/95/96 دست‌نخورده ماندند)
