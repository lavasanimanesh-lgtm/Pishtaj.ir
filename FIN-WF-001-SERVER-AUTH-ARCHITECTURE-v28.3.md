# Architecture Design Document — FIN-WF-001
## احراز هویت و مجوزدهی سمت سرور برای عملیات مالی

**وضعیت:** طراحی پیشنهادی؛ بدون پیاده‌سازی، migration یا deploy  
**پیش‌نیاز اجرا:** تصویب Stage 0 و Evidence PoC روی staging  
**هدف:** تبدیل نقش مالی از یک مقدار قابل‌تغییر در مرورگر به هویت و مجوز معتبر سمت سرور

---

## ۱. مسئلهٔ معماری فعلی

### وضعیت موجود

1. login در `crm/index.html` انجام می‌شود.
2. پس از تطبیق رمز، session شامل `user`, `name`, `roleId` در `localStorage.ptf_crm_session` نوشته می‌شود.
3. `rbac.js` نقش را از همان localStorage می‌خواند.
4. `sync.js` نقش را در header `X-CRM-Role` به سرور ارسال می‌کند.
5. `api/crm.php` همان header را به `$client_role` تبدیل می‌کند.
6. `data_push` برای کلیدهای مالی، ACL per-key server-authoritative ندارد.

### نتیجه
UI می‌تواند دسترسی را پنهان کند، اما **مرورگر منبع معتبر هویت یا نقش نیست**. راهکار باید هویت را در session سمت سرور نگه دارد و نقش را از session معتبر بازیابی کند.

---

## ۲. اصول طراحی پیشنهادی

1. **Server is the authority:** نقش و شناسهٔ کاربر فقط از session سرور قابل اعتماد است.
2. **No password-equivalent exposure:** endpoint عمومی نباید `passhash` یا credential-equivalent برگرداند.
3. **No trust in role header:** `X-CRM-Role` از مسیر authorization حذف می‌شود؛ در صورت باقی‌ماندن فقط diagnostic است.
4. **Least privilege:** mutation مالی بر اساس action و key server-side مجاز/رد می‌شود.
5. **No silent fallback:** نبود session یا CSRF معتبر باید `401/403` برگرداند، نه پذیرش آرام request.
6. **Offline is explicit:** offline mode نباید به معنی امکان post کردن نامحدود رویداد مالی حساس باشد.
7. **Rollback without data revert:** enforcement با feature flag سروری مرحله‌ای روشن/خاموش می‌شود؛ rollback نباید دادهٔ مالی را برگرداند.

---

## ۳. ساختار Session سمت سرور

### ۳.۱ محل نگهداری

**گزینهٔ پیشنهادی:** PHP server-side sessions با محل ذخیره‌سازی خارج از webroot یا در directory محافظت‌شدهٔ اختصاصی سرور.

```text
<outside-public_html>/ptf-sessions/
    sess_<random-id>
```

اگر هاست محل session اختصاصی امن ندارد، از PHP session handler پیش‌فرض فقط در صورتی استفاده شود که محل واقعی آن خارج از webroot و قابل مشاهده از HTTP نباشد.

### ۳.۲ نام و مشخصات Cookie

| ویژگی | مقدار پیشنهادی |
|---|---|
| نام | `PTFCRMSESSID` |
| `HttpOnly` | `true` |
| `Secure` | `true` در HTTPS production |
| `SameSite` | `Lax`؛ در صورت نیاز iframe/cross-site فقط با تحلیل جداگانه |
| Path | `/` یا `/crm/` مطابق ساختار نهایی |
| Domain | دامنهٔ production، بدون wildcard غیرضروری |
| session.use_strict_mode | `1` |

### ۳.۳ محتوای session سمت سرور

```json
{
  "uid": "username",
  "displayName": "نام کاربر",
  "roleId": "chairman",
  "authVersion": 4,
  "issuedAt": "2026-07-14T...Z",
  "lastSeenAt": "2026-07-14T...Z",
  "absoluteExpiresAt": "2026-07-14T...Z",
  "csrf": "random-256-bit-token",
  "sessionIdVersion": 1
}
```

### ۳.۴ عمر session

| نوع | پیشنهاد اولیه | علت |
|---|---:|---|
| Idle timeout | ۳۰ دقیقه | محدودکردن نشست رهاشده روی سیستم مالی |
| Absolute timeout | ۸ ساعت | هم‌سو با یک شیفت کاری |
| Step-up برای عملیات بسیار حساس | در Stage 0 تعیین شود | بازگردانی backup، تغییر role، unlock سال و company-cheque finalization |

### ۳.۵ ابطال session

session باید در این رخدادها invalidate شود:
- logout؛
- تغییر رمز؛
- تغییر role؛
- غیرفعال‌شدن کاربر؛
- restore کاربران/roleها؛
- درخواست صریح «خروج از همه دستگاه‌ها» توسط admin/chairman.

`authVersion` کاربر نیز در هر request حساس با session مقایسه می‌شود تا sessionهای قدیمی پس از تغییر role/password بی‌اثر شوند.

---

## ۴. نحوهٔ Login پیشنهادی

### ۴.۱ Endpoint جدید

```text
POST /api/auth.php?action=login
Content-Type: application/json
Body: { "username": "...", "password": "..." }
```

### ۴.۲ جریان اعتبارسنجی

1. Browser از طریق HTTPS، username/password را فقط به endpoint login می‌فرستد.
2. Server کاربر را از source سروری `crm_users` می‌خواند.
3. Server credential را verify می‌کند.
4. Server `session_regenerate_id(true)` انجام می‌دهد.
5. Server session را ایجاد و cookie HttpOnly ارسال می‌کند.
6. Response فقط اطلاعات کم‌خطر UI را برمی‌گرداند:

```json
{
  "ok": true,
  "user": { "username": "...", "name": "...", "roleId": "buyer" },
  "csrf": "...",
  "expiresAt": "..."
}
```

7. Browser فقط برای نمایش UI می‌تواند یک cache بدون authority در `sessionStorage` نگه دارد؛ role معتبر در هر request از server session می‌آید.

### ۴.۳ گذار password فعلی

وضعیت فعلی `passhash` مبتنی بر SHA-256 سمت client است. این مقدار نباید در `users_get` برگردد، زیرا password-equivalent محسوب می‌شود.

**طرح گذار پیشنهادی، مشروط به تایید:**

| مرحله | رفتار |
|---|---|
| ۱. Inventory | گزارش تعداد کاربر server-side با hash legacy، بدون افشای hash |
| ۲. Login سازگار | server رمز خام TLS را می‌گیرد، SHA-256 legacy را فقط برای verify محاسبه می‌کند |
| ۳. Upgrade هنگام login موفق | server یک `password_hash()` مدرن (Argon2id در صورت پشتیبانی، در غیر این صورت bcrypt) ذخیره می‌کند |
| ۴. پایان دوره گذار | `passhash` legacy از response و سپس از storage عملیاتی حذف/archived می‌شود |

**ممنوع:** ارسال hash فعلی کاربران به مرورگر جدید، یا استفاده از secret ثابت داخل JavaScript برای ساخت session.

### ۴.۴ Bootstrap admin

چون admin فعلی بخشی از login client-side است، bootstrap باید جداگانه طراحی شود:

- اگر `crm_users` سروری قبلاً admin معتبر دارد: همان user با migration کنترل‌شده به auth hash ارتقا یابد.
- اگر server user معتبر ندارد: یک bootstrap one-time فقط با config خارج از webroot و اقدام دستی chairman/admin ایجاد شود.
- bootstrap پس از اولین login موفق غیرفعال و audit شود.

---

## ۵. جریان Authentication و Authorization

### ۵.۱ دیاگرام Login

```text
┌───────────┐       HTTPS POST login        ┌───────────────────────┐
│ Browser   │ ────────────────────────────► │ api/auth.php          │
│ Login UI  │  username + password          │ server-side verifier  │
└───────────┘                                └──────────┬────────────┘
                                                         │
                                                         ▼
                                             ┌───────────────────────┐
                                             │ crm_users (server)    │
                                             │ role + auth hash      │
                                             └──────────┬────────────┘
                                                         │ verify
                                                         ▼
                                             ┌───────────────────────┐
                                             │ Session store          │
                                             │ uid/role/csrf/expiry   │
                                             └──────────┬────────────┘
                                                         │ Set-Cookie HttpOnly
                                                         ▼
┌───────────┐  cookie + csrf + UI profile   ┌───────────────────────┐
│ Browser   │ ◄──────────────────────────── │ login response        │
└───────────┘                                └───────────────────────┘
```

### ۵.۲ دیاگرام Mutation مالی

```text
┌──────────────┐  POST /api/crm.php?action=data_push
│ Browser      │  Cookie: PTFCRMSESSID
│ sync.js      │  X-CSRF-Token: <session token>
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Server auth middleware                                │
│ 1) cookie/session exists?           → 401 if no       │
│ 2) csrf valid for mutation?         → 403 if no       │
│ 3) user active/authVersion valid?   → 401 if no       │
│ 4) derive role from server session                    │
│ 5) ACL action + allowed data keys                      │
└──────┬───────────────────────────────────────────────┘
       │ allowed
       ▼
┌──────────────────────────────────────────────────────┐
│ Domain guard                                          │
│ fiscal period / ownership / workflow constraints      │
└──────┬───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ Save + server audit event + per-key revision          │
└──────────────────────────────────────────────────────┘
```

### ۵.۳ دیاگرام درخواست غیرمجاز

```text
Browser with forged X-CRM-Role: chairman
        │
        ▼
Server ignores header for authorization
        │
        ▼
Session role = sales
        │
        ▼
ACL denies financial mutation → HTTP 403 + security audit
        │
        ▼
No sync JSON write / no revision increase / no data change
```

---

## ۶. تاثیر بر Offline Mode

### ۶.۱ اصل پیشنهادی

**ورود جدید در حالت offline مجاز نیست.** Browser بدون session معتبر سرور نباید نقش مالی بسازد یا از localStorage نقش را معتبر تلقی کند.

### ۶.۲ رفتار پیشنهادی

| وضعیت | عملیات غیرمالی | عملیات مالی حساس |
|---|---|---|
| session معتبر و online | مجاز | مجاز، با ACL و domain guard |
| session معتبر، شبکه قطع، در بازهٔ offline lease | draftهای غیرمالی و queue فعلی مطابق policy | `post payment/receipt`, company cheque, unlock/lock, fiscal config, restore و destructive actions ممنوع/blocked |
| session منقضی یا browser جدید offline | فقط صفحه login/offline message | هیچ mutation مجاز نیست |
| reconnect | re-auth اگر لازم؛ سپس sync conflict flow | فقط پس از server authorization ادامه |

### ۶.۳ دلیل محدودیت مالی offline

پرداخت، receipt، cheque و fiscal state به همزمانی و مجوز server-side نیاز دارند. queue کردن آن‌ها بدون ACL معتبر و بدون conflict resolution، با FIN-WF-004 و FIN-WF-005 ناسازگار است.

### ۶.۴ تصمیم لازم در Stage 0
کارفرما باید مشخص کند آیا سازمان واقعاً به ثبت مالی offline نیاز دارد یا خیر. اگر پاسخ مثبت باشد، این قابلیت یک پروژهٔ جدا با signed offline commands، device registration و manual approval است؛ در Sprint FIN-WF-001 نباید ضمنی اضافه شود.

---

## ۷. تاثیر بر Sync

### تغییرات مورد انتظار

1. `sync.js` قبل از bootstrap، `auth_me` را کنترل می‌کند.
2. `X-CRM-Role` برای authorization حذف می‌شود.
3. تمام mutation POSTها cookie session و `X-CSRF-Token` می‌فرستند.
4. server برای هر key نتیجه برمی‌گرداند:

```json
{
  "ok": true,
  "accepted": ["ptf_crm_offers"],
  "denied": [{"key":"ptf_crm_cheques", "reason":"role"}],
  "conflicts": [],
  "krevs": {}
}
```

5. key denied نباید بی‌نهایت retry شود؛ UI باید نیاز به مجوز/refresh session را نشان دهد.
6. per-key revision و smart merge باقی می‌مانند؛ FIN-WF-005 merge نوع‌دار را جدا اصلاح می‌کند.

### ریسک sync در گذار
- دستگاه قدیمی فاقد CSRF ممکن است 403 بگیرد.
- requestهای queued پیش از migration باید سیاست مشخص داشته باشند: discard با report یا manual replay پس از login.
- cache service worker نباید پاسخ auth/API را cache کند. API در SW باید network-first/no-store بماند.

---

## ۸. تاثیر بر Backup و Restore

### Backup
- backup مالی همچنان ممکن است، اما `save_backup` باید هویت session سروری را بررسی کند.
- backup عادی نباید credential/hash کاربران را به client یا export عمومی اضافه کند؛ کاربران و credentials یک scope جدا هستند.
- backup metadata باید `createdByUid`, `createdByRole`, `authEventId` داشته باشد.

### Restore

| کنترل | طراحی پیشنهادی |
|---|---|
| مجوز | admin/chairman طبق policy نهایی، از session سرور |
| Step-up | re-auth یا تایید دومرحله‌ای session برای restore |
| Scope | data restore و user/auth restore جداگانه |
| Session behavior | پس از restore role/user، sessionهای قدیمی invalidate شوند |
| Audit | server audit با backup id، hash، actor و reason |
| Rollback | pre-restore backup سروری + گزارش key-by-key |

### نکتهٔ مهم
Restore نباید برای حل یک قفل یا یک receipt اشتباه استفاده شود. پس از FIN-WF-004 و FIN-WF-006، unlock/reversal مسیرهای عملیاتی استاندارد هستند.

---

## ۹. Endpointهای پیشنهادی مرتبط با Auth

| Endpoint | روش | وضعیت پیشنهادی |
|---|---|---|
| `/api/auth.php?action=login` | POST | جدید؛ public with rate limit |
| `/api/auth.php?action=logout` | POST | جدید؛ session required + CSRF |
| `/api/auth.php?action=me` | GET | جدید؛ session required |
| `/api/auth.php?action=refresh` | POST | اختیاری؛ session + CSRF |
| `/api/crm.php?action=data_push` | POST | تغییر: session + CSRF + per-key ACL |
| `/api/crm.php?action=data_pull` | GET/POST | تغییر: session required |
| `/api/crm.php?action=data_rev` | GET | تغییر: session required |
| `/api/crm.php?action=users_get` | GET | deprecated برای login؛ هرگز passhash برنگرداند |
| `/api/crm.php?action=users_sync` | POST | تغییر: server role admin/chairman + CSRF |
| backup endpoints | mixed | تغییر: session/server ACL/step-up |
| public RFQ/contact/supplier endpoints | existing | نباید session مالی بخواهند؛ policy عمومی جدا دارند |

---

## ۱۰. معیار تایید Architecture FIN-WF-001

1. کارفرما policy offline مالی را تایید کرده باشد.
2. policy bootstrap admin و گذار hash legacy تایید شده باشد.
3. سرور محل امن session را فراهم کند.
4. امکان فعال‌سازی feature flag observe/enforce روی production وجود داشته باشد.
5. PoC staging، بدون تغییر production، Evidence قابل بررسی تولید کند.
6. Impact Analysis و test plan تایید شده باشد.
