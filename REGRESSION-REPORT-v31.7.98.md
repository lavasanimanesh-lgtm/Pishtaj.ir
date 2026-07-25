# گزارش رگرسیون کامل — v31.7.98

**تاریخ:** 2026-07-23  
**نسخه:** `v31.7.98`  
**دامنه:** Semantic Minimal Icons + Fiscal Dark Mode

## نتیجه نهایی

| شاخص | نتیجه |
|---|---:|
| تعداد Testerها | **254** |
| فایل PASS | **254** |
| فایل FAIL | **0** |
| مجموع Check PASS | **5,094** |
| مجموع Check FAIL | **0** |
| `audit.py` | **PASS — بدون Warning/Error** |
| JavaScript syntax | **PASS** |
| PHP 8.4 syntax | **PASS** |

```json
{
  "version": "v31.7.98",
  "testers_total": 254,
  "files_pass": 254,
  "files_fail": 0,
  "checks_pass": 5094,
  "checks_fail": 0,
  "prebroken": [],
  "failed": [],
  "hung": [],
  "soft": []
}
```

## تست‌های اختصاصی

| تست | نتیجه | پوشش |
|---|---:|---|
| tester216 | **8 PASS / 0 FAIL** | Home Journey، حذف Emoji/Badge عددی و حفظ Eventها |
| tester272 | **15 PASS / 0 FAIL** | Settings Accordion semantic icons + Offer Duplicate Regression |
| tester275 | **16 PASS / 0 FAIL** | Fiscal Profit Runtime، Icons و Dark Contract |
| tester276 | **25 PASS / 0 FAIL** | Website/Knowledge/Settings/Finance Hub SVG + Contrast Ratios |
| tester119 | **18 PASS / 0 FAIL** | Finance Hub tabs و دسترسی نقش |
| tester122 | **16 PASS / 0 FAIL** | Finance Hub naming/access + سایر رگرسیون‌ها |
| tester168 | **6 PASS / 0 FAIL** | Data Quality tab در Finance Hub |
| tester99 | **24 PASS / 0 FAIL** | Fiscal distribution/lock/snapshot |
| tester101 | **17 PASS / 0 FAIL** | Fiscal privacy/year filtering/report |

## کنترل آیکون‌ها

- Trust Strip: چهار SVG معنایی، بدون 01..04.
- Home Journey: چهار SVG معنایی، بدون 01..04.
- Footer Quick Access: پنج SVG، بدون 01..05.
- CRM Entry: Lock SVG، بدون badge متنی `CRM`.
- Knowledge Hero: Book SVG، بدون `KC`.
- Knowledge Clusters: ۱۶ کلید معنایی، بدون iconهای 01..16.
- Settings Accordion: Icon بر اساس Title، بدون counter ترتیبی.
- Finance Hub: هشت SVG معنایی، بدون Labelهای 01..08.

اعداد واقعی آمار مانند ۵۰+ مقاله عمداً حفظ شده‌اند.

## کنترل Dark Mode سال مالی

نسبت‌های محاسبه‌شده:

| سطح | پس‌زمینه | متن | حد پذیرش |
|---|---|---|---:|
| Shell | `#101b2b` | `#f8fafc` | ≥ 7 |
| KPI label | `#1d2a3d` | `#d5dfed` | ≥ 4.5 |
| Danger | `#451a1a` | `#fecaca` | ≥ 4.5 |
| Success | `#064e3b` | `#d1fae5` | ≥ 4.5 |
| Lock | `#2e1065` | `#e9d5ff` | ≥ 4.5 |
| Warning | `#451a03` | `#fde68a` | ≥ 4.5 |

همچنین در KPIهای سال مالی این قواعد با `!important` اعمال می‌شوند:

```css
background-image: none;
-webkit-text-fill-color: currentColor;
```

بنابراین Gradient Text شفاف CSS قدیمی دیگر اعداد را در حالت شب محو نمی‌کند.

## رگرسیون منطق مالی

- هزینه مستقیم پروژه، OPEX و تنخواه مستقل v31.7.97 حفظ شدند.
- Fiscal Distribution، Lock، Snapshot و Privacy تست شدند.
- هیچ Data Key، Sync Contract، Auth/RBAC یا Migration تغییر نکرد.

## Syntax/Audit

- تمام JavaScriptهای مستقل با `node --check`: PASS.
- تمام فایل‌های PHP با PHP 8.4.23: PASS.
- `python3 _tools/audit.py`: PASS بدون Warning/Error.
- نسخه `crm/index.html`, `crm/sw.js`, `crm/clear-cache.html`: همگی v31.7.98.

## گیت انسانی معوق

بررسی بصری روی Staging لازم است:

1. Homepage Desktop/Mobile؛
2. Knowledge Center Grid؛
3. Settings Accordion با بخش‌های مختلف؛
4. هر هشت Tab هاب مالی؛
5. Fiscal Year در حالت شب، شامل Alert، KPI، Input و Table.

**وضعیت:** گیت فنی سبز؛ گیت بصری Staging معوق.
