# Stage 0 Staging Setup Checklist — v31.7

## مدل پیشنهادی

```text
crm-staging.pishtaj.ir
```

با webroot، data directory، secret، token store و storage prefix کاملاً جدا از Production.

## زیرساخت لازم

- [ ] subdomain مستقل؛
- [ ] webroot مستقل؛
- [ ] HTTPS معتبر؛
- [ ] PHP و extensionهای موردنیاز؛
- [ ] backup مستقل؛
- [ ] S3 bucket یا prefix جدا، مثلاً `poc-finance-auth/`؛
- [ ] token/auth secret مستقل؛
- [ ] عدم استفاده از credentialهای Production؛
- [ ] Basic Auth یا IP allowlist؛
- [ ] Service Worker با origin مستقل؛
- [ ] SMS/بات/LLM واقعی خاموش یا mock؛
- [ ] log دسترسی‌پذیر برای تحلیل، بدون secret.

## استقرار staging

1. ZIP flat-root را در webroot staging extract کنید.
2. `crm/data` را از Production کپی نکنید.
3. fixture مصنوعی را نصب کنید.
4. SHA-256 baseline را ثبت کنید.
5. endpointهای auth، CRM و storage را با دامنه staging بررسی کنید.
6. backup fixture را تهیه و hash کنید.
7. reset script را قبل از PoC آزمایش کنید.

## ممنوع

- اتصال staging به `ptf_crm_data.json` واقعی؛
- استفاده از bucket یا prefix attachment Production؛
- ارسال SMS واقعی؛
- اجرای PoC mutation روی Production؛
- استفاده از password/token واقعی در fixture؛
- فعال‌کردن staging روی subdirectory مشترک با Production.

## معیار آماده‌بودن

```text
Staging Ready = HTTPS + isolated webroot + isolated data + fixture + backup + reset + access granted
```
