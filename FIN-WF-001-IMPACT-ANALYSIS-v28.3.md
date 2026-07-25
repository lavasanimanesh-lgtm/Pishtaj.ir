# Impact Analysis — FIN-WF-001
## احراز هویت و RBAC مالی سمت سرور

**وضعیت:** تحلیل پیش از اجرا؛ هیچ کد یا endpoint در این سند تغییر نکرده است.  
**وابستگی:** `FIN-WF-001-SERVER-AUTH-ARCHITECTURE-v28.3.md` و Evidence PoC staging.  
**هدف:** شناسایی دقیق اثرات، ریسک‌های regression، تست‌های قبل/بعد و روش rollback پیش از شروع Sprint اجرایی.

---

## ۱. مرز تغییر FIN-WF-001

### داخل دامنه
- هویت کاربر و session server-side
- جایگزینی authorization مبتنی بر `X-CRM-Role`
- ACL سمت سرور برای data sync و عملیات مدیریتی/مالی حساس
- CSRF برای mutationهای authenticated
- حذف بازگشت credential-equivalent از endpoint کاربران
- تغییر رفتار sync هنگام نبود/انقضای session
- کنترل backup/restore بر اساس هویت سروری

### خارج از دامنه این Sprint
- تغییر مدل invoice/payment/receipt
- migration چک شخصی
- workflow تایید چک شرکت
- fiscal guard سراسری
- merge supplier finance
- بانک/صندوق
- تغییر public RFQ/contact/supplier workflow، مگر تضمین عدم regression endpointهای عمومی

---

## ۲. فایل‌های مورد انتظار برای تغییر

> فهرست نهایی بعد از تصویب Architecture و PoC تثبیت می‌شود. در حال حاضر این فهرست، Impact سطح طراحی است نه دستور تغییر.

| فایل | تغییر مورد انتظار | ریسک Regression |
|---|---|---|
| `api/auth.php` **(جدید)** | login/logout/me/session lifecycle | بالا: ورود همه کاربران |
| `api/auth-lib.php` **(جدید یا معادل)** | session cookie، CSRF، user lookup، authVersion | بالا: هستهٔ authorization |
| `api/crm.php` | استفاده از middleware auth، حذف اعتماد به header نقش، ACL data_push/pull/users/backup | بحرانی: sync و backup |
| `crm/index.html` | جایگزینی `doLogin()` client-side با login server؛ logout/session expiry UI | بالا: login/PWA |
| `crm/rbac.js` | `curSession/curRole` به cache نمایش تبدیل می‌شود؛ authority سمت سرور است | متوسط: نمایش پنل‌ها |
| `crm/sync.js` | cookie session، CSRF، bootstrap auth، handling 401/403/denied keys | بحرانی: داده چندکاربره |
| `crm/backup.js` | server-auth restore/backup، step-up و error handling | بالا: recovery |
| `crm/storage.js` | فقط در صورت session کردن presign داخلی؛ public upload مسیر جدا دارد | متوسط: ضمیمه‌های CRM |
| `api/storage.php` | در صورت تصمیم Stage 0، session guard برای presign_get/put داخلی | متوسط: مشاهده/آپلود فایل |
| `crm/sw.js` | اطمینان از عدم cache پاسخ‌های auth/API و fallback صحیح offline | متوسط: PWA |
| `INSTALL-GUIDE.md` | تنظیم session security، HTTPS، مسیر امن session، rollout/rollback | پایین، ولی ضروری |
| `PTF-MASTER-HANDOVER.md` و release notes | معماری، feature flags، known limitations و rollback | پایین |
| test fixtures جدید | auth/ACL/sync/backup test harness | ضروری برای evidence |

### فایل‌هایی که در Sprint 2 نباید برای منطق مالی تغییر کنند

- `crm/supplier-finance.js`
- `crm/cheques.js`
- `crm/fiscal.js`
- `crm/working-capital.js`
- `crm/customer-finance.js`
- `crm/petty.js`
- `crm/opex.js`
- `crm/shareholders.js`

ممکن است فقط تست دسترسی یا پیام `401/403` آن‌ها تحت اثر قرار گیرد؛ تغییر workflow مالی آن‌ها متعلق به Sprintهای جداگانه است.

---

## ۳. Endpointهای تحت اثر

### ۳.۱ Endpointهای جدید پیشنهادی

| Endpoint | روش | مجوز | اثر |
|---|---|---|---|
| `auth.php?action=login` | POST | عمومی با rate-limit | ایجاد session امن |
| `auth.php?action=logout` | POST | session + CSRF | ابطال session جاری |
| `auth.php?action=me` | GET | session | bootstrap UI/sync |
| `auth.php?action=refresh` | POST | session + CSRF، در صورت نیاز | تمدید کنترل‌شده session |

### ۳.۲ Endpointهای موجود که باید تغییر کنند

| Endpoint | رفتار فعلی | رفتار مورد انتظار پس از FIN-WF-001 |
|---|---|---|
| `crm.php?action=data_push` | `verify_request` + role header client | session + CSRF + ACL per key + audit server-side |
| `crm.php?action=data_pull` | قابل فراخوانی بدون session قابل اتکا | session required؛ فقط داده مجاز کاربر |
| `crm.php?action=data_rev` | rev بدون session قابل اتکا | session required |
| `crm.php?action=users_get` | برای login کاربران و passhash برمی‌گرداند | deprecate برای login؛ حذف credential fields |
| `crm.php?action=users_sync` | role header client | role server-side admin/chairman + CSRF |
| `crm.php?action=save_backup` | request verification ناکافی | session/ACL/CSRF و metadata actor |
| `crm.php?action=list_backups/get_backup` | role header client | session/ACL؛ restore step-up |
| `storage.php?action=presign_get/put` | بررسی محدود/بدون session برای برخی actions | طبقه‌بندی internal/public؛ internal session-bound |

### ۳.۳ Endpointهای عمومی که نباید بشکنند

این endpointها باید جداگانه regression-test شوند و session مالی نباید مانع آن‌ها شود:

- `crm.php?action=captcha_new`
- `crm.php?action=add_rfq_site`
- `crm.php?action=add_supplier`
- `crm.php?action=track`
- `contact.php`
- endpointهای OTP عمومی با سیاست فعلی خودشان

---

## ۴. ماژول‌های در معرض Regression

| ماژول/جریان | ریسک | دلیل |
|---|---:|---|
| Login و logout | بحرانی | مدل login از local-only به server session تغییر می‌کند |
| کاربران چنددستگاهی | بحرانی | session هر دستگاه، تغییر role و logout global |
| Sync اولیه | بحرانی | bootstrap پیش از pull/push تغییر می‌کند |
| Sync آفلاین | زیاد | session expiry و ممنوعیت mutation مالی offline باید صریح باشد |
| Backup/restore | زیاد | restore ممکن است session/roleها را invalidate کند |
| PWA/service worker | زیاد | پاسخ‌های auth/API نباید cache نادرست شوند |
| Financial UI visibility | زیاد | UI role cache باید با `auth_me` هماهنگ بماند |
| Supplier/cheque/fiscal operations | زیاد | منطق تغییر نمی‌کند، ولی درخواست sync آن‌ها ممکن است 401/403 بگیرد |
| User management | زیاد | `users_get/users_sync` و گذار hash legacy |
| Storage attachment | متوسط | presign داخلی ممکن است session بخواهد |
| Public RFQ/contact | متوسط | نباید session مالی مطالبه کند |
| AI/LLM endpoints | متوسط | باید جدا از session مالی یا با policy صریح بررسی شوند |
| Browser compatibility | متوسط | Cookie Secure/SameSite و Safari/iOS/PWA |

---

## ۵. تست‌های اثبات عدم Regression

### ۵.۱ تست‌های قبل از تغییر (Baseline)

| شناسه | تست | Evidence لازم |
|---|---|---|
| PRE-01 | export backup staging و hash کلیدهای sync | فایل backup + SHA-256 |
| PRE-02 | inventory کاربران/roleها بدون نمایش hash در گزارش | count و role matrix |
| PRE-03 | login تمامی نقش‌های fixture در نسخه baseline | screenshot/log |
| PRE-04 | sync clean boot دو دستگاه fixture | rev/key counts |
| PRE-05 | عملیات نمونه مالی fixture (invoice, receipt, supplier invoice, payment, cheque, fiscal read) | before-state JSON + expected result |
| PRE-06 | public RFQ/contact smoke | response status + no sensitive response |
| PRE-07 | backup/restore sandbox | backup id + recovery report |

### ۵.۲ تست‌های Auth و Session پس از تغییر

| شناسه | سناریو | نتیجهٔ PASS |
|---|---|---|
| AUTH-01 | login صحیح admin/chairman/buyer/accountant/sales | cookie HttpOnly می‌رسد؛ `auth_me` role درست برمی‌گرداند |
| AUTH-02 | login غلط و rate limit | پیام کنترل‌شده؛ session ایجاد نشود |
| AUTH-03 | logout | cookie/session باطل؛ data_pull برابر 401/403 |
| AUTH-04 | idle expiry | mutation مالی رد و login مجدد لازم شود |
| AUTH-05 | role change | sessionهای قبلی invalid شوند یا authVersion mismatch رخ دهد |
| AUTH-06 | response users | passhash/authHash/CSRF خصوصی در endpoint عمومی برنگردد |
| AUTH-07 | cookie attributes | Secure/HttpOnly/SameSite صحیح در production HTTPS |

### ۵.۳ تست‌های Authorization و جعل Role Header

| شناسه | سناریو | نتیجهٔ PASS |
|---|---|---|
| ACL-01 | sales با `X-CRM-Role: chairman`، mutation مالی | 403؛ hash/revision تغییری نکند |
| ACL-02 | buyer با key خارج از scope | 403 با reason per-key |
| ACL-03 | chairman معتبر | mutation مجاز با audit server-side |
| ACL-04 | بدون session | 401/403 |
| ACL-05 | CSRF حذف/غلط | 403 |
| ACL-06 | endpoint عمومی RFQ/contact | بدون session مالی کار کند |

### ۵.۴ تست‌های Sync و Offline

| شناسه | سناریو | نتیجهٔ PASS |
|---|---|---|
| SYNC-01 | دو browser، login جدا، initial pull | داده و rev برابر |
| SYNC-02 | push مجاز | accepted keys و rev درست |
| SYNC-03 | key denied | داده server تغییر نکند؛ client loop retry بی‌نهایت نداشته باشد |
| SYNC-04 | network قطع، draft غیرمالی | policy مصوب رعایت شود |
| SYNC-05 | network قطع، payment/cheque/fiscal mutation | blocked با پیام روشن |
| SYNC-06 | reconnect بعد از expiry | re-auth، سپس sync بدون overwrite خاموش |
| SYNC-07 | service worker cache | پاسخ auth/API قدیمی از cache تحویل نشود |

### ۵.۵ تست‌های Financial No-Regression

این‌ها منطق مالی را تغییر نمی‌دهند، اما باید ثابت کنند auth مانع workflow مجاز نشده است:

- chairman: مشاهده fiscal/report، unlock test sandbox، مشاهده حساب‌ها؛
- buyer: مشاهده supplier طبق policy فعلی، بدون escalation role؛
- accountant/collector: invoice/receipt panel مطابق policy فعلی؛
- sales: دسترسی نداشتن به financial hub؛
- supplier invoice/payment fixture با session مجاز؛
- receipt fixture با session مجاز؛
- cheque read-only visibility طبق policy فعلی تا Sprint FIN-WF-002/003؛
- backup/restore sandbox با actor مجاز.

### ۵.۶ تست‌های PHP و استقرار

- `php -l` برای تمام endpointهای تغییرکرده در CI/staging؛
- integration test با cookie jar واقعی؛
- بررسی logهای PHP/session permission؛
- تست HTTPS و Secure cookie؛
- تست Safari/iOS، Chrome، Firefox و PWA installed/non-installed؛
- `node --check` تمام JSهای `crm/index.html`؛
- `python3 _tools/audit.py`؛
- اجرای testerهای 154 تا 156 به‌علاوه testerهای جدید auth/ACL.

---

## ۶. Fixture پیشنهادی FIN-WF-001

```text
Users:
  chair_demo     → chairman
  admin_demo     → admin
  buyer_demo     → buyer
  accountant_demo→ accountant
  sales_demo     → sales

Data:
  CUST-DEMO-1, SUP-DEMO-1
  INV-DEMO-1, SFINV-DEMO-1, SFPAY-DEMO-1
  CHQ-DEMO-1, FSY-DEMO-1405
  petty/opex/shareholder minimal fixtures

Environment:
  isolated staging hostname
  separate S3 prefix: poc-finance-auth/
  no production credentials, customer data or attachment keys
```

Fixture باید reset script و hash manifest داشته باشد تا هر PoC قابل تکرار باشد.

---

## ۷. Rollback Plan تفصیلی FIN-WF-001

### Rollback سطح ۱ — پیش از enforce
- feature flag در حالت observe-only است؛ فقط log تولید می‌شود.
- هیچ رفتار client تغییر نمی‌کند؛ rollback صرفاً حذف flag/route usage است.

### Rollback سطح ۲ — پس از enforce محدود
- `PTF_SERVER_AUTH_ENFORCE=false` فقط بعد از تایید incident owner.
- session server-side invalid نمی‌شود مگر نیاز عملیاتی.
- دادهٔ sync شده revert نمی‌شود؛ فقط authorization mode تغییر می‌کند.
- درخواست‌های denied و role mismatch برای تحلیل نگه‌داری می‌شوند.

### Rollback سطح ۳ — incident login
- endpoint health check و admin bootstrap خارج از webroot.
- break-glass procedure با یک account کنترل‌شده، audit و expiry کوتاه.
- بازگردانی ZIP فقط برای خرابی فایل، نه برای دادهٔ مالی.

### معیار rollback قابل قبول
Rollback باید در staging یک بار آزمایش شود: enforce روشن → user مجاز login/sync → flag خاموش → user legacy path طبق سیاست مرحله‌ای، بدون از دست رفتن داده.

---

## ۸. گیت Evidence پیش از Sprint 2

Sprint 2 مجاز نیست مگر همهٔ موارد زیر با مدرک ثبت شده باشند:

1. **Production configuration review:** وضعیت واقعی `PTF_ENFORCE_HMAC`، reverse proxy/auth gateway و HTTPS بدون افشای secret ثبت شود.
2. **Staging PoC-A/B:** evidence آسیب‌پذیری یا عدم آسیب‌پذیری header spoof با fixture و hash قبل/بعد.
3. **Passive Production Check:** فقط با مجوز کارفرما، بررسی غیرمخرب وضعیت response/auth؛ هیچ mutation PoC در production انجام نشود.
4. **Session Architecture Approval:** cookie/session store/bootstrap/legacy hash plan تایید شده باشد.
5. **Impact Approval:** این سند و test matrix تایید شده باشد.
6. **Rollback Drill:** حداقل یک rollback observe/enforce روی staging موفق باشد.

### حکم صریح دربارهٔ وضعیت Production فعلی
از روی سورس می‌توان گفت **ریسک معماری معتبر و جدی است**. اما بدون مشاهدهٔ config واقعی production و Evidence PoC مجاز روی staging، نباید ادعا کرد که production در همین لحظه قابل سوءاستفاده است. نتیجهٔ نهایی باید یکی از این سه حالت باشد:

| نتیجه | معنی | اقدام |
|---|---|---|
| Confirmed exploitable | staging PoC و config production نشان می‌دهد هیچ کنترل بیرونی موثر نیست | FIN-WF-001 با اولویت فوری اجرا شود |
| Mitigated externally | gateway/HMAC واقعی جلوی درخواست را می‌گیرد، ولی سورس همچنان ضعیف است | hardening برنامه‌ریزی‌شده، نه emergency deploy |
| Inconclusive | config/Evidence کافی نیست | Sprint 2 متوقف؛ فقط Evidence collection ادامه یابد |
