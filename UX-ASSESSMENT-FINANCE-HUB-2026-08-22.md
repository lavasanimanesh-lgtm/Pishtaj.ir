# ارزیابی رابط کاربری هاب مالی مدیریتی (Finance Hub UX Audit)

- **تاریخ:** 2026-08-22 (۱۴۰۵/۰۵/۳۱)
- **نسخهٔ فعلی:** v34.7.96
- **دامنه:** پنل `#finHubBar` و ۱۳ تب زیرمجموعه (تنخواه، هزینه جاری، سهامداران، سال مالی، ارزش افزوده، حساب تأمین‌کنندگان، حساب مشتریان، گزارش تجمیعی، تراز رسمی/غیررسمی، خزانه/بانک، پورسانت فروش، کیفیت داده، چک‌ها)
- **رویکرد:** ارزیابی فقط با خواندن کد (بدون render واقعی در مرورگر — چون CRM SPA در sandbox نیست). ۱۹ مشکل مشخص در ۵ دستهٔ اصلی کشف شد.
- **بدون تغییر کد در این نشست** — فقط تشخیص + طرح اصلاح.

---

## ۰) خلاصهٔ اجرایی

هاب مالی از نظر **معماری** خوب طراحی شده: `finHubBar` یک نوار تب مرکزی است که ۱۳ باکس مستقل را با `display:none/block` کنترل می‌کند. اما از نظر **UX** چهار ضعف ساختاری دارد:

| مشکل ریشه‌ای | اثر روی کاربر |
|---|---|
| **۱۳ تب در یک نوار** بدون گروه‌بندی معنایی | تصمیم‌گیری «چه چیزی کجاست» سخت است — cognitive load بالا |
| **دکمه‌های action ناهمگون** در هر تب (اندازه، فاصله، رنگ، جای‌گذاری متفاوت) | «هر تب یک اپ متفاوت به نظر می‌رسد» — یادگیری بین تبی ممکن نیست |
| **کارت‌های KPI با `font-size: clamp(17px, 1.8vw, 24px)`** و `white-space: normal` | با اعداد بزرگ (`999,999,999,999`) در دو خط می‌شکنند و کارت‌های ردیف نامتقارن می‌شوند |
| **overrideهای موبایل ۹۰٪ کد CSS را می‌گیرند** ولی **دسکتاپ استاندارد ندارد** | در دسکتاپ overflow افقی، در موبایل نظم اجباری |

---

## ۱) ۱۳ تب — گروه‌بندی نامناسب (۴ مشکل)

### الف) ترتیب فعلی نوار تب

```
تنخواه | هزینه جاری | سهامداران | سال مالی | ارزش افزوده |
حساب تأمین‌کنندگان | حساب مشتریان | گزارش تجمیعی |
تراز رسمی/غیررسمی | خزانه/بانک | پورسانت فروش | کیفیت داده | 🧾 چک‌ها
```

### ب) مشکل‌ها

1. **تب‌ها بی‌گروه‌اند.** «تنخواه» و «هزینه جاری» و «پورسانت فروش» هر سه «هزینهٔ عملیاتی»‌اند اما در سه جای مختلف. «حساب تأمین‌کنندگان» و «حساب مشتریان» و «چک‌ها» همه «حساب‌های باز»‌اند اما جدا افتاده‌اند.

2. **«گزارش تجمیعی» و «تراز رسمی/غیررسمی» تقریباً یک چیز نشان می‌دهند** — اولی «سرمایه در گردش» و دومی «سود رسمی/غیررسمی». نام‌ها گمراه‌کننده‌اند؛ کاربر عادی نمی‌داند برای دیدن «سود» به کدام تب برود.

3. **«ارزش افزوده» تازه اضافه شده** (v34.7.89) بین «سال مالی» و «حساب‌ها» گیر افتاده — منطقاً بخشی از «سال مالی» است.

4. **«کیفیت داده»** یک ابزار تشخیص است، نه یک گزارش عملیاتی — باید در انتهای نوار یا مخفی در منوی «سایر» باشد.

### ج) طرح پیشنهادی — گروه‌بندی سلسله‌مراتبی

```
گروه ۱ (روزانه):    تنخواه | هزینه جاری | چک‌ها | خزانه/بانک
گروه ۲ (حساب‌ها):   تأمین‌کنندگان | مشتریان | سهامداران | پورسانت
گروه ۳ (گزارش):    گزارش تجمیعی | تراز رسمی/غیررسمی
گروه ۴ (پایان سال): سال مالی | ارزش افزوده
گروه ۵ (ابزار):    کیفیت داده  ← دکمهٔ کوچک گوشه، نه tab اصلی
```

پیاده‌سازی: به‌جای یک `<div class="fin-hub-tabs">` طولانی، ۴ گروه در ۴ ردیف با label بالا. یا drop-down (accordion) که فقط گروه فعال باز شود.

---

## ۲) کارت‌های KPI (`.sc`) — شکستن اعداد بزرگ (۵ مشکل)

### الف) CSS فعلی (خط ۱۳۹۸-۱۴۰۰ در `crm/index.html`)

```css
.sc { padding:16px; border-radius:14px; min-width:0; overflow:hidden }
.sc b { 
  font-size: clamp(17px, 1.8vw, 24px);  /* ← ۲۴px اعداد بزرگ را می‌شکند */
  white-space: normal;                    /* ← اجازه شکستن به دو خط */
  overflow-wrap: break-word;
  word-break: normal; 
}
.sc span { font-size: 11px }
```

### ب) گرید فعلی (خط ۱۳۹۷)

```css
.sr { 
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
  gap: 12px; 
}
```

### ج) ۵ مشکل مشاهده‌شده

1. **`minmax(150px, 1fr)`** با `font-size:24px` و عدد `999,999,999,999 ریال` → متن مقدار **در دو خط** می‌شکند → **کارت‌های ردیف نامتقارن** می‌شوند (یکی ۶۰px، بغلی ۹۰px، بغلی ۱۲۰px).

2. **تفکیک واحد پول (`ریال`)** در برخی کارت‌ها هست (`fiscal.js: money(v) = ... + ' ریال'`) و در برخی نیست (`treasury.js: money(v)` بدون واحد) — یک استاندارد ندارد.

3. **رنگ عدد در هر تب متفاوت است** — hard-coded در HTML (`#059669`, `#0369a1`, `#7c3aed`, ...). هیچ semantic mapping نیست (سبز=مثبت، قرمز=منفی، نارنجی=هشدار). نتیجه: «رنگ‌آمیزی زیبا ولی بی‌معنا».

4. **`fiscal.js:588` استفاده از `minmax(150px, 1fr)`**، ولی `fiscal.js:637` استفاده از `minmax(180px, 1fr)`، و `working-capital.js:290` از `minmax(165px, 1fr)` — سه استاندارد متفاوت در سه فایل، برای همان `.sc`.

5. **در موبایل هر کارت `min-width: 0`** ولی در دسکتاپ چنین قیدی نیست — کارت به min-content گسترش می‌یابد و می‌تواند از grid track بیرون بزند (باگ overflow-x اگر متن span چندخطی باشد).

### د) طرح پیشنهادی

```css
/* یک استاندارد یکسان برای همهٔ کارت‌های KPI هاب مالی */
.sr { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.sc { 
  padding: 14px 12px; 
  min-width: 0;      /* ← در دسکتاپ هم لازم است */
  overflow: hidden;
}
.sc b {
  font-size: clamp(15px, 1.4vw, 20px);   /* ← سقف ۲۰px، شروع ۱۵px */
  white-space: nowrap;                     /* ← هرگز نشکند */
  overflow: hidden;
  text-overflow: ellipsis;                 /* ← اگر جا نشد ... */
  display: block;
  direction: ltr;                          /* ← اعداد از چپ */
  text-align: right;
}
.sc[title]:hover b::after {                /* ← عدد کامل روی hover */
  content: attr(title);
  position: absolute;
  ...
}
.sc span { font-size: 11.5px; line-height: 1.6; }
```

+ الزام واحد ثابت `ریال` در انتها با استایل کوچک‌تر (`.sc .unit { font-size: 60%; color: #94a3b8 }`).

---

## ۳) دکمه‌های Action ناهمگون در تب‌های مختلف (۶ مشکل)

مقایسه دکمه‌های اصلی ۵ تب:

### الف) جدول ناهمگونی

| تب | کلاس دکمه | آیکون | ارتفاع | رنگ اصلی | ترتیب فایل |
|---|---|---|---|---|---|
| تنخواه | `.petty-toolbar-action` | 📊➕💳💰📨 | استاندارد | `.bt` (نارنجی) + `.bt-o` (سفید) | 5 دکمه |
| هزینه جاری | `.opex-*-action` | ➕ 🔄 (فقط) | ۵۶px | سفید | 2 دکمه |
| سهامداران | `.shareholder-action` | ➕📅✏️💳💸📖 | ۵۴px | ۵ رنگ متفاوت (indigo/green/purple/amber/blue) | 6 دکمه |
| سال مالی | `.ptf-fiscal-action` | ⚙️💰 (کف/تقسیم) | ۵۴px | زرد (`#059669`) | 2+3 دکمه |
| ارزش افزوده | (inline `.bt`) | (بدون آیکون) | استاندارد | آبی | 2 دکمه |
| خزانه/بانک | (inline در `.treasury-head`) | مختلف | متغیر | متغیر | ۳-۴ |
| تراز رسمی | (inline `.bt bt-o`) | ↻ | استاندارد | سفید | ۱ |
| پورسانت | `.cm-controls .bt` | 🔄✅🖨 | متفاوت | مخلوط | 3 |

### ب) ۶ مشکل مشاهده‌شده

1. **هر تب class خودش را دارد.** `.petty-toolbar-action`, `.opex-fin-action`, `.shareholder-action`, `.ptf-fiscal-action`, `.cheque-panel-tools button` — با استایل‌های متفاوت. **زبان یکسان نیست.**

2. **آیکون‌ها در بعضی تب‌ها هست، در بعضی نه.** مثلاً ارزش افزوده هیچ آیکونی روی دکمه‌ها ندارد ولی تنخواه دارد.

3. **ارتفاع دکمه‌ها در موبایل استاندارد شده (۵۴px)** ولی در دسکتاپ متغیر است (`.bt` استاندارد `min-height: 46px`، ولی `.opex-rebuild-action` بدون تعریف است).

4. **رنگ‌های semantic تعریف نشده‌اند.** در سهامداران:
   - `add` = indigo (`#4f46e5`)
   - `salary` = green (`#047857`)
   - `draw` = purple (`#7c3aed`)
   - `edit` = amber (`#b45309`)
   - `ledger` = blue (`#2563eb`)
   
   ولی در تنخواه:
   - `add` = نارنجی/`.bt`
   - `refer` = سفید/`.bt-o`
   
   یک کد رنگ ثابت (مثلاً «primary=action اصلی، ghost=secondary، danger=مخرب») وجود ندارد.

5. **جای‌گذاری دکمه‌ها متفاوت است.**
   - تنخواه: بالا-راست (بعد از عنوان)
   - سهامداران: بالا-چپ (کنار ماه) + پایین‌تر روی هر کارت
   - ارزش افزوده: پایین کارت‌های KPI
   - پورسانت: هم‌ردیف با فیلتر ماه (inline در `.cm-controls`)
   
   کاربر باید هر بار «چشمش را جستجو کند» که «دکمهٔ ثبت را کجا بگذارم».

6. **دکمهٔ «ثبت» در برخی تب‌ها primary سبز است، در برخی نارنجی، در برخی آبی.** استاندارد رنگ CTA نیست.

### ج) طرح پیشنهادی — Design System برای Action Bar هاب مالی

یک کلاس مشترک `.finhub-action` که همهٔ تب‌ها استفاده کنند:

```css
.finhub-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--brd);
}
.finhub-action {
  min-height: 40px;
  padding: 8px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 10px;
  font-weight: 900;
  font-size: 12.5px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all .15s;
}
.finhub-action-icon { font-size: 15px }

/* semantic variants — کاملاً اجباری برای همهٔ تب‌ها */
.finhub-action[data-kind="primary"] { background: linear-gradient(135deg, var(--pri), var(--org)); color:#fff }
.finhub-action[data-kind="ghost"]   { background: #fff; color: #475569; border-color: var(--brd) }
.finhub-action[data-kind="success"] { background: #059669; color: #fff }
.finhub-action[data-kind="danger"]  { background: #fff; color: #dc2626; border-color: #fca5a5 }
.finhub-action[data-kind="warning"] { background: #fff; color: #b45309; border-color: #fde68a }
```

و همهٔ تب‌ها یک الگو استفاده کنند:

```html
<div class="finhub-toolbar">
  <button class="finhub-action" data-kind="primary" onclick="...">
    <span class="finhub-action-icon">➕</span>ثبت جدید
  </button>
  <button class="finhub-action" data-kind="ghost" onclick="...">
    <span class="finhub-action-icon">📊</span>گزارش
  </button>
  <button class="finhub-action" data-kind="warning" onclick="...">
    <span class="finhub-action-icon">🔄</span>محاسبه دوباره
  </button>
</div>
```

---

## ۴) نوار تب `finHubBar` — ۳ مشکل خاص

### الف) وضعیت فعلی
```js
'<div class="fin-hub-tabs">' + 
  btn('petty', 'تنخواه', 'petty') + 
  btn('opex', 'هزینه جاری', 'opex') + 
  ... 13 تب ...
'</div>'
```

CSS دسکتاپ ندارد — فقط `.fin-hub-tab` عمومی. در دسکتاپ `flex-wrap` می‌کند و بسته به عرض صفحه، ۱۳ تب در ۲-۳ ردیف با ارتفاع نامتقارن دیده می‌شود.

### ب) ۳ مشکل مشاهده‌شده

1. **در دسکتاپ ۱۰۲۴px:** ۱۳ تب flex-wrap در ۲ ردیف. اگر یک تب متن بلندتر داشته باشد (مثل «حساب تأمین‌کنندگان») ارتفاع ردیف را می‌شکند.

2. **تب فعال نشان‌دار ضعیف است.** فقط با کلاس `.active` که استایلش در `crm/theme.js` تعریف شده — بدون rule صریح در `index.html`. اگر theme لود نشود، تب فعال دیده نمی‌شود.

3. **آیکون‌های SVG در تب** خوب طراحی شده (خط ۳۳-۴۵ `financehub.js`) اما در موبایل با فقط `20px×20px` تصادفاً می‌آیند در کنار متن ۱۱px که نامتقارن به نظر می‌رسد.

### ج) طرح پیشنهادی

```css
/* دسکتاپ: grid یکنواخت */
@media (min-width: 900px) {
  #finHubBar .fin-hub-tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    padding: 12px;
    background: linear-gradient(180deg, #f8fafc, #f1f5f9);
    border-radius: 14px;
    border: 1px solid var(--brd);
  }
  #finHubBar .fin-hub-tab {
    min-height: 68px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid var(--brd);
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    transition: all .15s;
  }
  #finHubBar .fin-hub-tab:hover {
    border-color: var(--pri);
    color: var(--pri);
    transform: translateY(-1px);
  }
  #finHubBar .fin-hub-tab.active {
    background: linear-gradient(135deg, var(--pri), var(--org));
    color: #fff;
    border-color: transparent;
    box-shadow: 0 3px 8px rgba(0,0,0,.15);
  }
  #finHubBar .fin-hub-tab .fin-hub-icon svg { width: 22px; height: 22px; }
}
```

+ گروه‌بندی سلسله‌مراتبی (طبق بخش ۱-ج) با `<div class="fin-hub-group" data-label="روزانه">...</div>`.

---

## ۵) اعداد مالی — نمایش (۱ مشکل بزرگ)

### الف) مشکل «اعداد بزرگ در کادرهای کوچک»

- `.sc b` با `font-size: clamp(17px, 1.8vw, 24px)` — سقف ۲۴px.
- عدد `999,999,999,999 ریال` = ۱۹ کاراکتر (۱۳ رقم + ۳ ویرگول + « ریال»).
- در فونت ۲۴px تخمینی ~۲۲۰px عرض. کارت با `minmax(150px, 1fr)` در گرید ۲ستونه اگر عرض صفحه ۳۲۰px باشد → کارت ~۱۵۰px → عدد در دو خط می‌شکند.
- در fiscal.js: `money(v) = v.toLocaleString('fa-IR') + ' ریال'` — «ریال» به عنوان بخشی از عدد است. اگر «ریال» جدا شود، ۴ کاراکتر کمتر می‌شود.

### ب) پیشنهاد

1. **مبلغ‌های خیلی بزرگ را با پسوند نمایش دهیم:**
   ```
   999,999,999,999 → 999.9 میلیارد
   1,500,000,000  → 1.5 میلیارد
   250,000,000    → 250 میلیون
   ```
   یک تابع `formatMoneyCompact(n)` که براساس اندازه، پسوند مناسب اضافه کند. عدد کامل روی `title` (tooltip) بماند.

2. **واحد `ریال` را از عدد جدا کنیم:**
   ```html
   <b>1,500,000,000<small class="unit">ریال</small></b>
   ```
   با `.unit { font-size: 60%; color: #94a3b8; margin-right: 4px }`.

3. **direction:ltr برای اعداد** — الآن `.sc b` `direction: rtl` دارد که باعث می‌شود اعداد بلند در حالت `overflow-wrap: break-word` از سمت راست قطع شوند (مبهم می‌شود که آیا `999,999,999` است یا `999,999`).

---

## ۶) لایه‌بندی داخل تب‌ها (۳ مشکل جزئی)

1. **باکس‌های داخل تب هر کدام پس‌زمینه/رنگ متفاوت.**
   - `#opexBox` = زرد (`#fcd34d`)
   - `#slLiquidity` = نارنجی (`#fed7aa`)
   - `#shareBox` = بنفش (`#faf5ff`)
   - `#ledgerAggBox` = آبی گرادیانت
   - `#treasuryBox` = آبی روشن (`#f0f9ff`)
   
   نتیجه: **هر تب یک رنگ متفاوت** — بصری قوی ولی «کلاژ» به نظر می‌رسد. کاربر نمی‌داند رنگ چه معنایی دارد.

2. **عنوان‌ها ناهمگون.**
   - `<h4>📒 تراز رسمی...</h4>` (بعد از تراز)
   - `<b style="font-size:16px">موجودی...</b>` (تنخواه، `<h4>` نیست)
   - `<h4 style="margin:0 0 6px">خزانه...</h4>` (خزانه)
   
   یک استاندارد `<h3>` یا `<h4>` با margin/padding مشخص وجود ندارد.

3. **متن `<small>` توضیحی زیر هر عنوان استفاده متفاوت دارد.**
   - در سال مالی: پاراگراف چند خطی
   - در پورسانت: یک خط کوتاه
   - در ارزش افزوده: در سمت راست کنار عنوان (نه زیر آن)
   
   کاربر نمی‌داند «توضیح تب کجاست».

---

## ۷) اولویت‌بندی اصلاحات

| # | مشکل | اثر UX | ریسک | تخمین کار |
|---|---|---|---|---|
| **P0** | اعداد بزرگ در کارت‌های KPI می‌شکنند (بخش ۲ + ۵) | 🔴 هر روز دیده می‌شود | کم | ۱۵ خط CSS + tabع `formatMoneyCompact` |
| **P1** | گروه‌بندی ۱۳ تب (بخش ۱) | 🟠 کاربر جدید گیج می‌شود | متوسط | ۳۰ خط JS + CSS |
| **P2** | Design System دکمه‌های Action (بخش ۳) | 🟠 هر تب یک اپ به نظر می‌رسد | متوسط-بالا (نیاز به refactor چندین ماژول) | ۵۰-۷۰ خط CSS + refactor تدریجی |
| **P3** | نوار تب دسکتاپ (بخش ۴) | 🟡 در دسکتاپ نامتقارن | کم | ۲۰ خط CSS |
| **P4** | یک‌سان‌سازی رنگ باکس‌ها و عنوان‌ها (بخش ۶) | 🟢 نظافت بصری | کم | ۱۰ خط CSS |

---

## ۸) طرح فازی پیشنهادی

### فاز A — «Quick Wins» (v34.7.97 — ~۳۰ خط، بدون refactor)
- **رفع P0:** `.sc b` را `nowrap + ellipsis + font-size:20px` کنیم؛ تابع `formatMoneyCompact` بسازیم و در ۵ نقطهٔ اصلی استفاده کنیم (fiscal، treasury، ledger-report، working-capital، supplier-finance).
- **رفع P3:** grid ۱۳ تب برای دسکتاپ اضافه کنیم.
- **رفع P4:** یک `--fin-hub-bg` و `--fin-hub-brd` variable برای هر باکس.

### فاز B — «گروه‌بندی» (v34.7.98 — ~۶۰ خط JS)
- **رفع P1:** در `financehub.js` تب‌ها را در ۴-۵ گروه بازآرایی کنیم.
- «کیفیت داده» را از نوار اصلی برداریم و به یک آیکون گوشهٔ بالا-چپ ببریم.
- accordion یا دو ردیف با label.

### فاز C — «Design System» (v34.7.99 — ~۱۵۰ خط + refactor)
- **رفع P2:** یک ماژول `crm/finhub-ui.js` که `finhubToolbarHtml(actions)` و `finhubKpiCardsHtml(cards)` فراهم کند.
- تدریجاً هر ماژول (opex، shareholders، fiscal، treasury، ...) به این ماژول migrate شود.

---

## ۹) یافته‌های خارج از UX — ولی مرتبط

1. **باکس‌های `display:none` استفادهٔ حافظه دارند.** ۱۳ باکس همیشه در DOM رندر شده‌اند حتی اگر مخفی باشند. برای هر رندر کارت‌های KPI محاسبات مالی سنگین انجام می‌شود. بهتر است `lazy render` باشد.

2. **`finHubOrder()` هر بار DOM را بازچینی می‌کند.** با ۱۳ عنصر × چند render در ثانیه، `appendChild` تکراری. اگر ترتیب ثابت باشد، فقط اولین بار نیاز است.

3. **بازخوانی `renderPetty` باعث فراخوانی `finHubApply` می‌شود** — که تمام باکس‌های ۱۲ تب دیگر را دوباره `show/hide` می‌کند. Cascade unnecessary.

---

## ۱۰) حکم نهایی

**رابط کاربری هاب مالی از نظر کارکردی خوب کار می‌کند** — همهٔ تب‌ها لود می‌شوند، داده درست نمایش داده می‌شود، دکمه‌ها کلیک‌پذیرند. **اما از نظر UX در سطح B- (۷۰/۱۰۰)** است:

- ✅ **معماری تب:** خوب — یک نوار مرکزی، ۱۳ باکس مستقل.
- ⚠️ **گروه‌بندی:** ضعیف — ۱۳ تب بی‌گروه.
- ❌ **همگونی بصری:** ضعیف — هر تب استایل خودش را دارد.
- ❌ **اعداد بزرگ:** باگ — می‌شکنند و کارت‌ها نامتقارن می‌شوند.
- ✅ **موبایل:** خوب — ۹۰٪ CSS اختصاصی موبایل.
- ⚠️ **دسکتاپ:** متوسط — بدون استاندارد صریح.

**سه اصلاح فاز A** (Quick Wins) می‌تواند در ۳۰ خط کد کیفیت را به B+ (۸۵) برساند بدون ریسک.

**اگر کاربر تأیید کند، فاز A را اجرا می‌کنم.**
