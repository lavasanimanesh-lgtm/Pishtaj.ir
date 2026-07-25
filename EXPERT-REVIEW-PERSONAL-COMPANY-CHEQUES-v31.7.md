# گزارش جلسهٔ تیم متخصصان ارشد — تفکیک چک شخصی و چک شرکتی

**تاریخ بررسی:** 2026-07-17  
**دامنه:** ارزیابی امکان‌پذیری، بدون تغییر کد Production

## ۱) پیشنهاد بررسی‌شده

### چک شخصی

- در ماژول شخصی همان کاربر ثبت شود؛
- وارد رقم، گزارش و sync عمومی شرکت نشود؛
- اعلان فقط به خود کاربر برسد.

### چک شرکتی

- در هاب مالی نمایش داده شود؛
- ماژول/تب جداگانهٔ چک شرکتی داشته باشد؛
- در گزارش‌های مالی شرکت اثر داشته باشد؛
- برای نقش‌های مجاز قابل مشاهده و مدیریت باشد.

## ۲) شواهد source فعلی

| موضوع | وضعیت فعلی در source | نتیجه |
|---|---|---|
| کلید شخصی | `ptf_personal_cheques_<user>` در `crm/cheques.js` | جداسازی per-user موجود است |
| sync شخصی | کلیدهای `ptf_personal_cheques_*` در `SYNC_KEYS` نیستند | وارد sync عمومی نمی‌شود |
| backup شخصی | در `DATA_KEYS` backup عمومی نیست | recovery چنددستگاهی محدود است |
| اعلان شخصی | `chDailyNotify()` با `toUsers: [c.by]` و `toRoles: []` | مسیر اعلان شخصی موجود است |
| چک شرکتی | در `ptf_crm_cheques` با `ownership: 'company'` | shared data موجود است |
| اثر گزارش مالی | `fiscal.js` فقط `ownership === 'company'` را جمع می‌کند | چک شخصی وارد رقم شرکت نمی‌شود |
| UI فعلی چک شرکتی | عمدتاً داخل باکس چک‌های پنل یادآورها | هاب مالی مستقل هنوز کامل نیست |
| visibility فعلی | `chMine()` رکوردها را با `c.by === currentUser` فیلتر می‌کند | برای company hub کافی نیست |
| guard نقش | guard کلاینتی برای chairman/ceo/commercial وجود دارد | server-side item-level enforcement کامل نیست |

## ۳) نظر پنل متخصصان

### معماری داده

طرح با کمترین ریسک قابل اجراست و به کلید جدید نیاز ندارد:

- شخصی: `ptf_personal_cheques_<user>` و local-only؛
- شرکتی: `ptf_crm_cheques` با `ownership: 'company'`؛
- گزارش مالی فقط از رکوردهای company استفاده کند.

ایجاد کلید جداگانهٔ `ptf_crm_company_cheques` در این مرحله توصیه نمی‌شود، چون باعث دو منبع حقیقت و پیچیدگی migration می‌شود.

### کنترل مالی

طرح از نظر تفکیک رقم شرکت صحیح است، به شرط آنکه هیچ تابع مالی از `chAll()` بدون فیلتر ownership استفاده نکند. مسیرهای گزارش رسمی باید فقط company را بخوانند.

### حریم خصوصی

local-only برای چک شخصی با پیشنهاد فعلی هم‌راستا است. مزیت آن این است که چک شخصی وارد sync عمومی، backup عمومی و گزارش مالی شرکت نمی‌شود. عیب آن recovery محدود در صورت تعویض یا از دست‌رفتن دستگاه است.

### UX

اضافه‌کردن تب «چک‌های شرکتی» به هاب مالی شدنی است. چک شخصی می‌تواند در ماژول فعلی شخصی باقی بماند و به همان کاربر اعلان بدهد.

### امنیت و RBAC

از نظر client-side شدنی است، اما امنیت نهایی company hub به server-side session/RBAC/CSRF وابسته است. این بخش همان gap ثبت‌شدهٔ FIN-WF-001 است و بدون staging نباید روی Production ادعا یا پیاده‌سازی امنیتی جدید شود.

## ۴) حکم امکان‌پذیری

```text
Feasibility: YES — با ریسک معماری پایین

Personal local-only: قابل اجرا و بخش زیادی از آن در source موجود است
Company cheque hub: قابل اجرا با یک view/module جدید روی کلید موجود
Server-side financial authorization: فعلاً blocked تا Stage 0/FIN-WF-001
```

برآورد فنی این طراحی، پس از عبور از گیت امنیتی، حدود یک اسپرینت سبک برای UI/فیلترها/گزارش و یک اسپرینت برای hardening/UAT خواهد بود. این برآورد، اجرای server-side auth و CSRF را شامل نمی‌شود.

## ۵) طراحی پیشنهادی اجرایی

### ماژول شخصی

- نمایش فقط `ptf_personal_cheques_<currentUser>`؛
- اعلان فقط `toUsers: [owner]`؛
- عدم ورود به `SYNC_KEYS`، backup عمومی و fiscal report؛
- پیام شفاف دربارهٔ محدودیت recovery؛
- عدم migration جدید بدون approval و backup مستقل.

### ماژول چک شرکتی در هاب مالی

- تب جدید در `financehub.js` / پنل هاب مالی؛
- منبع داده: `ptf_crm_cheques` با predicate `ownership === 'company'`؛
- نمایش مبلغ، ذی‌نفع، سررسید، وضعیت، بانک، ارتباط با supplier payment یا salesfile؛
- استفاده از همان void/reminder موجود؛
- role matrix نهایی قبل از server-side enforcement ثبت شود.

### نقش‌های فعلی source

Source فعلی برای ایجاد company cheque به `chairman`, `ceo`, `commercial` اشاره می‌کند؛ اما پیام‌های موجود دربارهٔ commercial هنوز «در آینده» نوشته شده‌اند. بنابراین role نهایی باید در `FIN-WF-014` به‌صورت رسمی تثبیت شود و از حدس‌زدن جلوگیری شود.

## ۶) ریسک‌ها و شروط پذیرش

1. چک شخصی نباید با `chAll()` وارد هیچ رقم مالی شرکت شود.
2. company hub نباید با `chMine()` محدود به creator شود.
3. تغییر ownership از personal به company باید در core guard کنترل شود.
4. company cheque نباید با spoof کردن `X-CRM-Role` قابل ثبت یا ویرایش شود.
5. اعلان شخصی نباید به `toRoles` یا گروه ارسال شود.
6. backup/restore شخصی تا زمان policy recovery ادعا نشود.
7. تست دو کاربر و دو دستگاه روی staging برای company و personal انجام شود.

## ۷) نتیجه و تصمیم پیشنهادی

پیشنهاد کارفرما **از نظر فنی شدنی و از نظر معماری توصیه‌شده است**. بهترین مسیر این است:

1. policy چک شخصی روی `local-only` ثبت شود؛
2. company cheque به‌صورت یک تب مستقل در هاب مالی پیاده شود؛
3. کلیدهای موجود حفظ شوند و کلید جدید ساخته نشود؛
4. پیاده‌سازی UI/filter/report غیرحساس می‌تواند در Release بعدی انجام شود؛
5. server-side authorization، CSRF و کنترل spoof فقط بعد از Stage 0 مجاز است.

این سند **گزارش امکان‌سنجی است، نه approval اجرای کد مالی Production**.
