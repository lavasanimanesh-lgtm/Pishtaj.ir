# یادداشت‌های انتشار — v34.8.41 (R3/T3-4)

**موضوع:** نازک‌سازی کلاینت — خروج کامل دستهٔ CACHE از localStorage از طریق لایهٔ کش read-through با TTL روی IndexedDB.
**تاریخ:** ۲۰۲۶-۰۸-۲۹ · **تستر قفل‌کننده:** `tester542-v34.8.41-r3-cache-ttl-idb.js` (۳۵ سنجه · سبز) · **گیت:** run-ci-gate + arch-guard + node --check

## چه چیزی عوض شد

### ۱) لایهٔ `ptfCache` (crm/storage-quota.js)
- API: `ptfCacheWrite(key, value, ttlSec)` / `ptfCacheRead` / `ptfCacheReadSync` / `ptfCacheReadStale` / `ptfCacheReadRec` / `ptfCacheDrop` / `ptfCacheHydrate(keys)` / `ptfCacheSweep`.
- کش در ردیف `cache:<key>` در همان IDB موجود (`ptf-crm-storage-v1`) با پوشنهٔ `{v, at, ttl}`؛ **پس از ثبت موفق IDB، کپی LS حذف می‌شود** → کلیدهای CACHE از حساب سهمیهٔ LS خارج و قابل‌تخلیهٔ خودکار می‌شوند.
- بدون IDB → همان پوشنه در LS نوشته می‌شود (رفتار امروز حفظ می‌شود).
- `ReadStale` تا ۷ روز پس از انقضا سرو می‌شود (fallback خطای شبکه/سرور).
- sweep بوت: ردیف‌های منقضی >۷ روز حذف؛ ردیف‌های معتبر به حافظه آورده می‌شوند.
- legacy خام LS (بدون پوشنه) → rec با at=0 → **کش دستگاه‌های موجود بدون از دست رفتن معتبر است** (کلیدهای بی-TTL همان لحظه معتبر).

### ۲) مصرف‌کنندگان مهاجرت‌یافته (صفر نوشتنِ جدید LS)
| کلید | فایل | TTL | نکته |
|---|---|---|---|
| `ptf_site_suppliers/_total/rfqs` | bridge.js (siteCacheGet/Set) | ۸۶۴۰۰s (۲۴س) | تازگی واقعی همچنان با since-signature؛ TTL فقط شبکهٔ امنیتی است |
| `ptf_site_inbox_sig` | bridge.js | ۰ (بی-TTL) | cursor است؛ نباید بی‌اعتبار شود |
| `ptf_fx_live_cache` | fx.js | ۲۱۶۰۰s (۶س) | sessionStorage سطح ۱ دست‌نخورده؛ آب‌رسانی تیکر از `ReadStale` |
| `ptf_cloud_usage` | storage.js | ۶۰۰s | `ReadStale` جای `ptf_cloud_usage_backup` را گرفت (دیگر backup نوشته نمی‌شود) |
| دو خوانندهٔ buycompare | buycompare.js | — | `ptfCacheReadSync` + fallback legacy |
| ۴ ابطال کش ابری | archive.js | — | `ptfCacheDrop` + legacy |

- مهاجرت بوت: `ptfCacheHydrate` برای ۴ کلید سایت + `ptf_cloud_usage` (legacy LS → IDB، سپس حذف LS).
- key-registry: دستهٔ CACHE → `store: 'ptfCache-idb-read-through-ttl'`.

## تصمیم دامنه
- **T3-5 (بوت صفحه‌ای دستگاه جدید) به پنجرهٔ R4 موکول شد** — پروتکل pull مرکزی است و بدون تست روی دستگاه واقعی ریسکی؛ پایهٔ hydration کلید-به-کلید از این نسخه موجود است (client-server.js:150-190).

## تست دستی پیشنهادی روی استیجینگ
1. رفرش سادهٔ پنل → لیست تأمین‌کنندگان/استعلام‌ها و تیکر ارز فوراً از کش (بدون فلش خالی).
2. DevTools → Application → IndexedDB → `ptf-crm-storage-v1` → ردیف‌های `cache:ptf_site_*` و `cache:ptf_cloud_usage` ظاهر می‌شوند؛ در Local Storage کلیدهای `ptf_site_*` پس از اولین fetch موفق حذف می‌شوند.
3. حالت آفلاین/قطع سرور (تب offline شبیه‌سازی) → پنل‌ها و تیکر از نسخهٔ کش (🟡) سرو می‌شوند.

## گیت‌ها
- `run-ci-gate`: ۱۵۷ تستر (tester542 جدید) — همه سبز.
- `arch-guard`: تخلف‌های جدید = fallbackهای عمدی IDB-less → پس از تأیید کاهش بدهی کل، baseline A10 رتچت شد.
- تغییرناپذیرها: sync.js pushDirty/pullCheck (R4)، ۴ ابزار ریکاوری HTML (R6)، backup.js.
