# وضعیت بک‌لاگ v25.5

## Priority 2 (مالی/FX) — وضعیت کد
| ID | وضعیت |
|----|--------|
| BUG-126-01 advancePaid FX defaults | ✅ Fixed (v24.8+) |
| BUG-126-02 saveInv received | ✅ Fixed (v24.5+) |
| BUG-126-03 CNY/havale | ✅ Fixed (v24.8+) + TGJU-first (v25.0+) |
| BUG-126-04 ptfFxDiag | ✅ Fixed (v24.8+) |

## Priority 3 — وضعیت کد
| ID | وضعیت |
|----|--------|
| BUG-127-01 senior filter | ✅ Fixed |
| BUG-127-02 chUpsertReminder export | ✅ Present |
| BUG-127-03 chSaveNew alias | ✅ Present |
| BUG-127-04 ptfDocxCommit args | ✅ Present |
| BUG-127-05 packing/QC labels | ✅ Present |

## این اسپرینت (v25.5)
| ID | موضوع |
|----|--------|
| BUG-PRINT-UNIT-FA | واحد «عدد» فارسی روی سند انگلیسی → `ptfOfferUnitEn` |

## باز / مانیتور عملیاتی
- نرخ سنا زنده: وابسته outbound هاست (ice/tgju) — کد مسیر دارد
- کالیبره چاپ چک: وابسته بانک کاربر
- باگ‌های روزمره جدید با steps از کارفرما

## سیاست
بدون ماژول جدید؛ فقط باگ/گردش‌کار.
