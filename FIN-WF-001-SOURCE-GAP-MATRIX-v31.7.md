# FIN-WF-001 Source Gap Matrix — v31.7

| حوزه | شواهد source فعلی | نتیجهٔ فعلی | Evidence لازم |
|---|---|---|---|
| token برای data push/pull | `api/crm.php` token را برای data push/pull الزام می‌کند | partial implemented | curl بدون/با token در staging |
| role authority | در مسیر حساس role از token override می‌شود | partial implemented | جعل `X-CRM-Role` در staging |
| initial login | `auth_login` token صادر می‌کند | implemented in hotfix | login response و token expiry |
| session server-side | session اصلی هنوز به localStorage وابستگی دارد | open design gap | Architecture/PoC staging |
| CSRF | middleware کامل session/CSRF در source فعلی وجود ندارد | open | PoC mutation staging |
| users_get | مسیر login و user data هنوز legacy است | open review | response sanitization audit |
| backup auth | برخی مسیرها legacy role header دارند | open review | endpoint matrix staging |
| storage auth | طبقه‌بندی internal/public باید با config بررسی شود | open review | presign test staging |
| company cheque hub | `ptf_crm_cheques` و predicate `ownership=company` موجود؛ تب مستقل هاب مالی نیست | open design/implementation gap | role matrix + staging UAT |
| offline financial mutation | policy چک شخصی روی `local-only` ثبت شده؛ private sync اجرا نمی‌شود | policy closed / implementation gate remains | verify no personal key enters public sync; staging for financial mutation |
| Production config | config واقعی هاست مشاهده نشده | unknown | مسئول سرور + evidence |

## حکم

از source می‌توان ریسک‌ها و کنترل‌های موجود را فهرست کرد، اما exploitable بودن واقعی Production بدون config review و PoC مجاز staging قابل اعلام نیست.
