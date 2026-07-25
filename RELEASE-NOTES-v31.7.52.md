# Release Notes — v31.7.52

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.52`  
**نوع:** STORAGE-IDB-MODULE-PRIMARY-001 — شروع مهاجرت ماژولی مستقیم به IndexedDB برای AI Workbench و draftx

---

## هدف ریلیز

ادامه مسیر کنترل حافظه پس از v31.7.50 و v31.7.51. در نسخه قبل داده‌های volatile/cache به‌صورت عمومی قبل از compact در IndexedDB آرشیو می‌شدند. در این نسخه، دو ماژول پرمصرف‌تر وارد فاز **direct IndexedDB primary** شدند:

```text
AI Workbench history
draftx global form drafts
```

یعنی این دو ماژول از این مرحله، نسخه کامل داده‌های خود را مستقیماً در IndexedDB ذخیره می‌کنند و در localStorage فقط summary سبک/چند آیتم اخیر می‌ماند.

---

## RCA / دلیل دقیق

1. localStorage مرورگر سقف عملی حدود ۵MB دارد و به محدوده خطر رسیده بود.
2. v31.7.50 جلوی crash و خطای خام quota را گرفت.
3. v31.7.51 برای volatileها archive+compact عمومی اضافه کرد.
4. اما تا زمانی که خود ماژول‌ها همچنان full payload را ابتدا در localStorage بنویسند، localStorage دوباره رشد می‌کند.
5. دو منبع پرریسک اولیه عبارت‌اند از:
   - خروجی‌های AI Workbench، مخصوصاً OCR/summary/letter که ممکن است متن یا جدول بزرگ داشته باشند.
   - پیش‌نویس‌های سراسری فرم‌ها، مخصوصاً فرم‌های متنی طولانی و نامه‌ها.
6. راه کم‌ریسک این است که فقط این cache/draftهای شخصی/volatile به direct IndexedDB منتقل شوند؛ رکوردهای اصلی کسب‌وکاری فعلاً دست‌نخورده بمانند.

---

## کارهای انجام‌شده

### 1) AI Workbench history با IndexedDB primary

در `crm/ai-workbench.js` تاریخچه نتایج AI تغییر کرد:

```text
قبل: full history در ptf_ai_hist_<user> داخل localStorage
بعد: full history در IndexedDB، localStorage فقط summary سبک
```

کلیدها:

```text
localStorage summary: ptf_ai_hist_<user>
IndexedDB full:       ptf_ai_hist_<user>:idb-full
```

قواعد جدید:

- localStorage فقط metadata و داده چند آیتم خیلی سبک/اخیر را نگه می‌دارد.
- اگر payload بزرگ باشد، در localStorage فقط summary می‌ماند.
- full history در IndexedDB ذخیره می‌شود.
- restore اگر در summary داده نداشت، async از IndexedDB می‌خواند.
- copy/delete history هم از full history پشتیبانی می‌کند.

---

### 2) draftx با IndexedDB primary

در `crm/draftx.js` پیش‌نویس‌های فرم‌ها تغییر کردند:

```text
قبل: full drafts در ptf_draft_forms داخل localStorage
بعد: full drafts در IndexedDB، localStorage فقط summary سبک ۸ پیش‌نویس اخیر
```

کلیدها:

```text
localStorage summary: ptf_draft_forms
IndexedDB full:       ptf_draft_forms:idb-full
```

قواعد جدید:

- `MAX_DRAFTS = 15` حفظ شد.
- localStorage فقط ۸ draft اخیر را برای بازیابی سریع نگه می‌دارد.
- نسخه کامل draftها در IndexedDB ذخیره می‌شود.
- اگر draft در summary نبود، restore به‌صورت async از IndexedDB تلاش می‌کند.
- حذف draft هم localStorage و هم IndexedDB را پاک می‌کند.

---

## مواردی که عمداً دست‌نخورده ماندند

این فاز هنوز رکوردهای اصلی CRM را migrate نمی‌کند:

```text
RFQ
Offer
Customers
Suppliers
Products
Finance
Projects
Contracts
```

دلیل: این داده‌ها باید در فاز server-first و با migration دقیق‌تر انجام شوند، نه در گام cache/draft.

---

## فایل‌های تغییر یافته

```text
crm/ai-workbench.js
crm/draftx.js
crm/storage-quota.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
RELEASE-NOTES-v31.7.52.md
REGRESSION-REPORT-v31.7.52.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester229-storage-idb-module-primary.js
```

پوشش:

- نسخه و cache-bust `v31.7.52`.
- وجود کلید full history برای AI در IndexedDB.
- استفاده AI از `ptfStorageIdbSet/Get`.
- سبک شدن summary در localStorage برای payload بزرگ AI.
- restore async از IndexedDB در صورت نبود data در summary.
- وجود full key برای draftx در IndexedDB.
- ذخیره full draft در IndexedDB و summary در localStorage.
- smoke runtime برای AI و draftx.

نتیجه مستقیم:

```text
tester229-storage-idb-module-primary: 13 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester64-v144: 57 PASS / 0 FAIL
tester198-draft-everywhere: 15 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| AI Workbench history | full history از localStorage به IndexedDB منتقل شد | متوسط/کنترل‌شده |
| draftx | full drafts در IndexedDB و summary سبک در localStorage | متوسط/کنترل‌شده |
| localStorage | کاهش رشد مجدد ناشی از AI/draft | مثبت |
| restore | برای داده‌های archived از IndexedDB async می‌خواند | متوسط |
| رکوردهای اصلی CRM | دست‌نخورده | کم |
| Sync/API/Auth/Finance | بدون تغییر backend/API | کم |

---

## راستی‌آزمایی کارفرما

1. CRM را باز کنید.
2. از AI Workbench یک خروجی نسبتاً بزرگ مثل خلاصه/نامه/ترجمه تولید کنید.
3. به تنظیمات > Storage Health بروید.
4. روی «نمایش کلیدهای بزرگ» بزنید؛ `ptf_ai_hist_<user>` باید نسبت به قبل سبک‌تر باشد.
5. روی «آرشیوهای IndexedDB» بزنید؛ باید آرشیوهای AI/draft را ببینید.
6. یک فرم را نیمه‌کاره پر کنید، ببندید و دوباره باز کنید؛ نوار بازیابی پیش‌نویس باید مثل قبل کار کند.
7. تاریخچه AI را باز کنید؛ نتایج اخیر باید همچنان قابل مشاهده/کپی/بازکردن باشند.

---

## نتیجه

این ریلیز اولین گام واقعی module-level migration است: دیگر فقط cleanup نداریم، بلکه AI Workbench و draftx از ابتدا full payload را به IndexedDB می‌فرستند و localStorage را سبک نگه می‌دارند. گام بعدی منطقی می‌تواند انتقال history/cacheهای public chat و metrics یا طراحی server-first برای رکوردهای اصلی باشد.
