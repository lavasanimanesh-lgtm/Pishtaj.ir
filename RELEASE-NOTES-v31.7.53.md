# Release Notes — v31.7.53

**تاریخ:** ۱۴۰۵/۰۴/۳۰ (2026-07-21)  
**نسخه:** `v31.7.53`  
**نوع:** STORAGE-IDB-PUBLIC-CACHE-001 — انتقال cache عمومی سایت به IndexedDB

---

## هدف ریلیز

تکمیل فاز کنترل فشار روی `localStorage` قبل از بازگشت به توسعه‌های وبسایت. پس از انتقال AI Workbench و draftx در v31.7.52، در این نسخه دو منبع عمومی و origin-wide نیز سبک شدند:

```text
Web Metrics queue
Public Chat history
```

از آنجا که `localStorage` برای کل origin مشترک است، داده‌های سایت عمومی هم می‌توانند روی ظرفیت CRM اثر بگذارند. بنابراین این دو cache عمومی نیز به الگوی زیر منتقل شدند:

```text
IndexedDB = نسخه کامل
localStorage = summary سبک
```

---

## RCA / دلیل دقیق

1. مشکل اصلی، محدودیت حدودی ۵MB برای `localStorage` در مرورگر بود.
2. CRM و سایت عمومی هر دو روی یک origin هستند؛ بنابراین keyهای عمومی مثل `ptf_web_events_v2` و `ptf_chat_history` هم در همان سهمیه localStorage اثر می‌گذارند.
3. v31.7.50 و v31.7.51 guard/archive عمومی ساختند.
4. v31.7.52 ماژول‌های داخلی پرمصرف AI/draft را direct IndexedDB کرد.
5. برای اینکه مشکل localStorage واقعاً مهار شود، cacheهای عمومی سایت نیز باید از نوشتن full payload در localStorage خارج شوند.

---

## کارهای انجام‌شده

### 1) Web Metrics با IndexedDB primary

در `assets/js/ptf-metrics.js` صف رویدادهای metrics تغییر کرد:

```text
قبل:
ptf_web_events_v2 در localStorage تا ۵۰۰ رویداد

بعد:
IndexedDB:  ptf_web_events_v2:idb-full  تا ۱۰۰۰ رویداد
localStorage: ptf_web_events_v2 فقط ۸۰ رویداد summary
```

ویژگی‌ها:

- همچنان privacy-first است.
- هیچ `fetch`, `sendBeacon` یا `XMLHttpRequest` اضافه نشده است.
- `dataLayer` همچنان حفظ شده است.
- پنل QA با `?ptf_metrics=1` همچنان کار می‌کند.
- `ptfMetricsSummary()` از full memory/IndexedDB-backed queue استفاده می‌کند.

---

### 2) Public Chat history با IndexedDB primary

در `assets/js/ptf-chat.js` تاریخچه چت تغییر کرد:

```text
قبل:
ptf_chat_history در localStorage تا ۶۰ پیام

بعد:
IndexedDB:  ptf_chat_history:idb-full  تا ۱۲۰ پیام
localStorage: ptf_chat_history فقط ۱۶ پیام summary
```

ویژگی‌ها:

- تجربه کاربر در باز کردن چت حفظ شده است.
- آخرین پیام‌ها سریع از localStorage summary نمایش داده می‌شوند.
- نسخه کامل‌تر در IndexedDB نگهداری می‌شود.
- loader مرکزی metrics از داخل chat حفظ شد.

---

## مواردی که تغییر نکردند

```text
هیچ ارسال شبکه‌ای جدید برای metrics اضافه نشد.
هیچ رکورد اصلی CRM migrate یا حذف نشد.
مسیر RFQ/Tracking/Supplier/Auth/API دست‌نخورده ماند.
منطق پاسخ محلی chat تغییر نکرد.
```

---

## فایل‌های تغییر یافته

```text
assets/js/ptf-metrics.js
assets/js/ptf-chat.js
crm/index.html
crm/sw.js
crm/clear-cache.html
PTF-MASTER-HANDOVER.md
_tools/uat/tester227-storage-quota-foundation.js
_tools/uat/tester228-storage-idb-volatile-migration.js
_tools/uat/tester229-storage-idb-module-primary.js
_tools/uat/tester230-public-cache-idb.js
RELEASE-NOTES-v31.7.53.md
REGRESSION-REPORT-v31.7.53.md
```

---

## تست اضافه‌شده

```text
_tools/uat/tester230-public-cache-idb.js
```

پوشش:

- نسخه `v31.7.53`.
- metrics با `IndexedDB full + localStorage summary`.
- metrics همچنان بدون ارسال شبکه‌ای.
- chat با `IndexedDB full + localStorage summary`.
- loader مرکزی metrics در chat حفظ شده.
- smoke runtime:
  - ۱۴۰ رویداد metrics → localStorage فقط ۸۰، IndexedDB full بزرگ‌تر.
  - ۲۵ پیام chat → localStorage فقط ۱۶، IndexedDB full بزرگ‌تر.

نتیجه مستقیم:

```text
tester230-public-cache-idb: 13 PASS / 0 FAIL
```

---

## تست‌های محافظ مرتبط

```text
tester209-web-metrics-foundation: 9 PASS / 0 FAIL
tester227-storage-quota-foundation: 21 PASS / 0 FAIL
tester228-storage-idb-volatile-migration: 12 PASS / 0 FAIL
tester229-storage-idb-module-primary: 13 PASS / 0 FAIL
tester230-public-cache-idb: 13 PASS / 0 FAIL
```

---

## Impact Analysis

| بخش | اثر | ریسک |
|---|---|---|
| Public metrics | full queue به IndexedDB منتقل شد | کم |
| Public chat | full history به IndexedDB منتقل شد | کم/متوسط |
| localStorage origin-wide | فشار کمتر از سمت سایت عمومی | مثبت |
| Privacy | بدون ارسال شبکه‌ای جدید | کم |
| CRM business data | دست‌نخورده | کم |
| Website UX | بدون تغییر ظاهری عمده | کم |

---

## راستی‌آزمایی کارفرما

1. یک صفحه عمومی سایت را باز کنید.
2. اگر خواستید metrics را ببینید، با `?ptf_metrics=1` باز کنید.
3. چند کلیک روی CTAها انجام دهید.
4. چت سایت را باز کنید و چند پیام بفرستید.
5. وارد CRM > تنظیمات > Storage Health شوید.
6. روی «نمایش کلیدهای بزرگ» بزنید؛ `ptf_web_events_v2` و `ptf_chat_history` باید نسبت به قبل سبک‌تر باشند.
7. روی «آرشیوهای IndexedDB» یا ابزارهای مرورگر/DevTools می‌توانید وجود full payload در IndexedDB را بررسی کنید.

---

## نتیجه

مسیر کنترل localStorage اکنون سه لایه دارد:

```text
v31.7.50: guard + health + cleanup
v31.7.51: archive عمومی volatileها در IndexedDB
v31.7.52: direct IndexedDB برای AI Workbench و draftx
v31.7.53: direct IndexedDB برای public metrics و chat
```

با این گام، فشار cacheهای عمومی سایت روی سهمیه localStorage نیز کاهش یافت. پس از نصب و راستی‌آزمایی، می‌توانیم به سراغ گام‌های وبسایت برگردیم.
