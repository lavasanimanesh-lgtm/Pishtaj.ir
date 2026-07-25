# ریلیزنوت `v29.0` — پاکسازی TMP و گارد موتور واحد

## خلاصه
پس از دپلوی موفق `v28.9` در پروداکشن و مشاهده یک مورد `TMP-RFQ-...` (Pool خالی در 2.5 ثانیه اول)، این ریلیز شامل:
1. Fallback سینک `legacyMaxNext()` تا حتی اگر سرور در دسترس نباشد `RFQ-1051` بدهد نه `TMP`
2. ابزار Reconcile `TMP-*` → کد واقعی سروری
3. گارد `audit.py` منع کدگذار موازی + مستند `docs/CODEGEN.md`

## تغییرات
| فایل | تغییر |
|---|---|
| `crm/codegen.js` | افزودن `legacyMaxNext()` + `ptfScanTmpCodes()` + `ptfReconcileTmpCodes()` + Boot فوری |
| `api/codegen.php` | بدون تغییر منطق 0100/0001 - همان v28.9.1 |
| `_tools/audit.py` | بخش 8: چک منع `Math.random()*90000` و وجود `codegen.php/js` |
| `docs/CODEGEN.md` | **جدید** - راهنمای ایجنت‌ها |
| `crm/index.html` | VER `v29.0`, `?v=29.0` |
| `crm/sw.js` | CACHE `v29.0` |

## تست سریع v29.0
```js
// 1. اسکن TMPهای موجود
ptfScanTmpCodes() // → ["TMP-RFQ-..."] یا []

// 2. تبدیل به واقعی
ptfReconcileTmpCodes(function(r){ console.log(r) })
// باید ببینی: {ok:true, replaced:3, maps:[{tmp:"TMP-RFQ-...", real:"RFQ-1052"}]}

// 3. چک Pool
localStorage.getItem('ptf_code_pool') // باید پر باشد

// 4. درخواست جدید - دیگر نباید TMP بدهد
ptfUnifiedCode('RFQ') // → RFQ-1053
ptfUnifiedCode('TO')  // → PTF-TO-1405-0100 (امسال از 0100)
ptfUnifiedCode('CO')  // → PTF-CO-1405-0100
```

## فرمت امسال و سال بعد (تغییر کوچک قبلی حفظ شد)
- امسال 1405: `PTF-TO-1405-0100`, `PTF-CO-1405-0101`
- سال بعد 1406: `PTF-TO-1406-0001`

## دستور Deploy
```bash
unzip -o pishtaj-release-v29.0.zip -d public_html
# بعد در Console مرورگر ادمین:
ptfReconcileTmpCodes()
```

## نسخه‌گذاری
- VER `v29.0`, CACHE `ptf-crm-v29.0`, ZIP `pishtaj-release-v29.0.zip` ~25M
# v29.1 hotfix 403
