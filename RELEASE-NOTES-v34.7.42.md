# یادداشت انتشار v34.7.42 — ریشه‌کنی پیام کاذب رد ثبت پیشنهاد

**تاریخ:** 2026-08-19

## گزارش کاربر

پس از ذخیرهٔ هر پیشنهاد، ابتدا پیام «سرور ثبت را نپذیرفت» نمایش داده می‌شد؛ کمی بعد همان پیشنهاد در فهرست دیده می‌شد. این رفتار نشان می‌داد commit سرور انجام شده ولی کلاینت آن را rollback/رد تلقی کرده است.

## ریشهٔ فنی مستقل

زنجیرهٔ Promise ثبت پیشنهاد این ساختار را داشت:

```text
api(register_offer) → then(ACK + side effects + render) → catch(server rejected)
```

`catch` فقط خطای API را نمی‌گرفت؛ هر exception بعد از ACK، از جمله خطای render، toast، sync acknowledgement یا side effect نیز وارد همان catch می‌شد. در نتیجه:

1. سرور offer و RFQ را commit می‌کرد؛
2. یک خطای کلاینتی بعد از ACK رخ می‌داد؛
3. catch، snapshot محلی را rollback و پیام «سرور نپذیرفت» نمایش می‌داد؛
4. pull بعدی projection قطعی سرور را برمی‌گرداند و کاربر پیشنهاد ثبت‌شده را می‌دید.

حالت هم‌خانوادهٔ دوم، گم‌شدن پاسخ شبکه پس از commit بود. کلاینت تفاوت «رد قطعی 4xx» و «نتیجه نامعلوم transport» را نمی‌دانست و برای هر دو یک پیام رد نمایش می‌داد.

## ماشین حالت جدید قطعیت commit

- `rejected`: پاسخ قطعی 4xx؛ rollback محلی و پیام واقعی رد.
- `uncertain`: دو خطای transport/5xx و نبود receipt قابل اثبات؛ RFQ محلی جلو نمی‌رود، operation ID و draft برای reconciliation حفظ می‌شوند و پیام «نتیجه نامشخص» نمایش داده می‌شود.
- `acked`: پاسخ یا replay قطعی سرور؛ projection حفظ می‌شود و هر خطای post-ACK فقط warning است، نه rollback.
- `reconciled`: پاسخ اول گم شده ولی replay همان operation ID یا pull مهر سرور را پیدا کرده است؛ همان ACK اجرا می‌شود و رکورد دوم ساخته نمی‌شود.

## یوزر استوری‌های هم‌خانواده

### US-445-1 — ثبت عادی
وقتی سرور ACK می‌دهد، offer و وضعیت RFQ با هم قطعی می‌شوند و پیام موفقیت نمایش داده می‌شود.

### US-445-2 — خطای UI بعد از ACK
اگر render، toast یا side effect پس از commit خطا دهد، ثبت سرور و WF50 باقی می‌مانند؛ پیام رد نمایش داده نمی‌شود و diagnostic محلی ذخیره می‌شود.

### US-445-3 — پاسخ گم‌شدهٔ موبایل
در خطای transport، همان payload با همان operation ID یک بار خودکار replay می‌شود. journal سرور نتیجهٔ قبلی را برمی‌گرداند و side effectهای قطعی فقط یک‌بار در این کلاینت اجرا می‌شوند.

### US-445-4 — رد واقعی سرور
خطاهای قطعی 4xx retry کور نمی‌شوند؛ offer pending و تغییر RFQ جبران می‌شوند، draft حفظ و دلیل واقعی نمایش داده می‌شود.

### US-445-5 — نتیجه هنوز نامعلوم
اگر replay نیز پاسخ ندهد، کلاینت ادعا نمی‌کند سرور رد کرده است. وضعیت محلی به `uncertain` می‌رود و retry دستی همان operation ID را ادامه می‌دهد.

### US-445-6 — قطع process میان فایل‌ها و journal
سرور روی offer علاوه بر `serverOperationId`، hash درخواست را مهر می‌کند. اگر process پس از انتشار offer ولی پیش از journal قطع شود، replay دقیق همان operation/hash commit offer+RFQ+journal را کامل می‌کند؛ شماره متعلق به فرمان دیگر همچنان 409 است.

### US-445-7 — جلوگیری از reuse نادرست کلید
کلید idempotency به action، payload و کاربر متصل است. استفاده از همان کلید برای payload/action/کاربر متفاوت با 409/403 متوقف می‌شود.

## اصلاحات کد

- مرز ACK و rejection به دو callback مستقل `then(onAck, onReject)` تبدیل شد؛ خطای onAck وارد onReject نمی‌شود.
- تمام مراحل post-ACK با `offerSafeStep` ایزوله و diagnostic آنها در localStorage ثبت می‌شود.
- خطای مبهم یک replay خودکار و سپس pull reconciliation با `serverOperationId` دارد.
- سرور `operation_id_required` را برای `register_offer` اجباری کرد.
- receipt و request hash فقط در سرور تولید می‌شوند و فیلدهای spoof‌شدهٔ کلاینت حذف می‌شوند.
- command journal اکنون action، request hash و owner را ثبت و هنگام replay کنترل می‌کند.
- tester442 با سناریوی exception پس از ACK، replay خودکار، رد 422 و دو خطای transport گسترش یافت.
- regression مستقل `tester445` به گیت کانونی افزوده شد.

## عدم رگرسیون

- ثبت offer و تغییر workflow RFQ همچنان یک command مشترک‌اند.
- آثار «صادر شد»، referral، SMS و پاک‌سازی draft فقط پس از ACK اجرا می‌شوند.
- در رد یا نتیجه نامعلوم، RFQ محلی به‌صورت کاذب WF50 باقی نمی‌ماند.
- operation ID در retry پایدار است و create intent اجازه overwrite شمارهٔ متعلق به رکورد دیگر را نمی‌دهد.
