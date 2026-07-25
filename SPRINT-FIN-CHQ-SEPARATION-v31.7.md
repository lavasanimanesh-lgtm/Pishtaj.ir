# Sprint Plan — تفکیک چک شخصی و چک شرکتی

**شناسه Sprint:** `FIN-CHQ-SEPARATION-v31.7`  
**خانواده:** `FIN-WF-002` + `FIN-WF-003`  
**مبنای source:** `v31.6.22`  
**وضعیت:** `Designed / Partially Ready / Blocked for Production implementation`

## User Story 1 — US-FIN-CHQ-LOCAL-ONLY

### شرح
به‌عنوان کاربر، می‌خواهم چک شخصی را در فضای شخصی خودم ثبت کنم تا در sync عمومی، گزارش مالی شرکت و رقم شرکت وارد نشود و اعلان آن فقط برای خودم ارسال شود.

### Acceptance Criteria

- [ ] داده در `ptf_personal_cheques_<user>` باقی بماند؛
- [ ] کلید شخصی در `SYNC_KEYS` عمومی نباشد؛
- [ ] چک شخصی وارد `fiscal.js` و رقم شرکت نشود؛
- [ ] اعلان با `toUsers` مالک و بدون `toRoles` ارسال شود؛
- [ ] کاربر دیگر چک شخصی مالک را نبیند؛
- [ ] recovery چنددستگاهی و private sync ادعا نشود؛
- [ ] migration جدید بدون backup و approval انجام نشود.

### وضعیت source

بخش عمدهٔ این معیارها در `crm/cheques.js`, `crm/myday.js`, `crm/fiscal.js` و `crm/messengers.js` موجود است. hardening و UAT مالکیت/اعلان هنوز باید انجام شود.

## User Story 2 — US-FIN-CHQ-COMPANY-HUB

### شرح
به‌عنوان مدیر مجاز، می‌خواهم چک‌های شرکتی را در یک تب مستقل هاب مالی ببینم و مدیریت کنم تا از چک شخصی جدا باشند و در گزارش مالی شرکت اثر صحیح داشته باشند.

### Acceptance Criteria

- [ ] تب مستقل «چک‌های شرکتی» در هاب مالی؛
- [ ] منبع فقط `ptf_crm_cheques` با `ownership === 'company'`؛
- [ ] چک شخصی در company hub نمایش داده نشود؛
- [ ] مبلغ/سررسید/ذی‌نفع/بانک/وضعیت و ارتباط پرداخت نمایش داده شود؛
- [ ] گزارش fiscal فقط company را محاسبه کند؛
- [ ] نقش‌های مجاز در matrix رسمی ثبت شوند؛
- [ ] guard هسته و server-side authorization از spoof نقش جلوگیری کند؛
- [ ] کلید دادهٔ جدید ساخته نشود؛
- [ ] UAT دو کاربر و fixture مستقل اجرا شود.

### وضعیت source

کلید مشترک company و predicate fiscal موجود است، اما company hub مستقل و server-side ownership enforcement کامل نیست.

## ترتیب اجرا

1. ثبت policy `local-only` در policy record؛ **انجام شد**.
2. hardening و UAT مسیر personal-only؛ قابل انجام بدون private sync.
3. طراحی تب company hub و role matrix؛ **آمادهٔ طراحی**.
4. اجرای company hub و mutationهای مالی؛ **Blocked تا staging مستقل و FIN-WF-001**.
5. تست sync/backup/restore و spoof role روی staging.

## ممنوع تا رفع گیت

- تغییر auth/session/CSRF روی Production؛
- اجرای PoC mutation روی Production؛
- migration کلیدهای شخصی؛
- ساخت کلید جدید برای company cheque بدون design approval؛
- ادعای server-side RBAC بر اساس guard صرفاً client-side.

## خروج Sprint

- policy record به‌روز؛
- backlog با دو User Story جدید؛
- source gap matrix؛
- test plan و acceptance matrix؛
- بعد از staging: implementation + regression + UAT + ZIP.
