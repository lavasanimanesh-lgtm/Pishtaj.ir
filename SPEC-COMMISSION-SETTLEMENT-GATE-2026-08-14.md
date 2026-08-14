# مشخصات نهایی — پورسانت فقط پس از تسویه کامل کل پرونده

تاریخ: ۱۴۰۵/۰۵/۲۳ (۲۰۲۶-۰۸-۱۴)
وضعیت: **پیاده‌سازی شده — v34.5.35**
منبع قاعده: ابلاغ کارفرما — «پورسانت فقط در زمان تسویه کامل محاسبه و قابل پرداخت است»

---

## تصمیم‌های قطعی (تصویب کارفرما)

1. **حذف کامل مبنای «CO برنده» (won).** فقط یک مبنا می‌ماند: «وصولی واقعی» که پشت تسویه کامل قفل شده است.
2. **سطح تسویه = کل پرونده فروش** (نه هر فاکتور جدا). تا وقتی همه فاکتورهای یک پرونده کاملاً تسویه نشده باشند، پورسانت آن پرونده آزاد نمی‌شود.
3. **مبلغ مبنا = مبلغ کل/خالص فاکتورهای پرونده** (جمع همه فاکتورهای همان پرونده).
4. **ماه انتساب = ماهِ ثبت آخرین وصولی‌ای که تسویه را کامل کرد** (ماه تسویه کامل پرونده).

---

## ۱) وضعیت فعلی (crm/commission.js → `ptfCommissionCalc`)

مبنای «وصولی واقعی» اکنون هر وصولی جزئی را فوراً وارد مبنا می‌کند:

```js
(inv.payments || []).concat(inv.pays || [])
  .filter(activePayment)              // فقط void/reversal/voided حذف می‌شود
  .forEach(function (p) {
    r.base += num(p.amountIrr || p.amt || p.amount);   // هر قسط فوراً مبنا می‌شود
  });
```

و مبنای «CO برنده» هم روی برنده‌شدن پیشنهاد، مستقل از پرداخت محاسبه می‌شود.

### مغایرت با قاعده
- پورسانت روی وصولی ناقص (و حتی برنده‌شدن بدون پرداخت) محاسبه و قابل پرداخت می‌شود.

---

## ۲) تعریف فنی «تسویه کامل پرونده»

منطق مشابه `sfStageOf` / `sfCloseAudit` (crm/salesfiles.js) که منبع واحد «تسویه کامل» است:

```js
// پروژه‌ها = ptf_crm_deals (هر کدام: cd, inqNo, wonOffer)
// فاکتور → پیشنهاد → پروژه:
//   offer = offers[inv.offerNo]
//   deal  = deals.filter(d => d.inqNo === offer.inqNo || d.wonOffer === offer.no || d.offerNo === offer.no)[0]
//   (fallback: inv.inqNo / inv.dealCd / inv.dealRef / inv.projectCd === deal.cd)

paid(inv) = sum( active payments of inv )          // بدون void/reversal/voided
settled(project) =
    project.invoices.length > 0
    && project.invoices.every(inv => inv.amount - paid(inv) <= 0.5)
```

---

## ۳) الگوریتم پیشنهادی `ptfCommissionCalc` (پس از تغییر)

```js
function ptfCommissionCalc(opts) {
  // فقط یک مبنا: collected (گیت تسویه کامل پرونده) — won حذف می‌شود
  var offers = indexByNo(ptf_crm_offers);
  var deals  = ptf_crm_deals;

  // ۱) گروه‌بندی فاکتورهای فعال به پرونده
  var groups = {};   // key = deal.cd  → { deal, invoices: [], owner, settledAt }
  ptf_crm_invoices.forEach(function (inv) {
    if (!inv || inv.status === 'void') return;
    var o = offers[inv.offerNo] || {};
    var deal = findDealByOffer(o, deals) || findDealByInvRefs(inv, deals);
    if (!deal) return;                       // فاکتور بدون پرونده = خارج از محاسبه
    var g = groups[deal.cd] || (groups[deal.cd] = { deal: deal, invoices: [], owner: ownerOf(o), settledAt: '' });
    g.invoices.push(inv);
  });

  // ۲) فقط پرونده‌های کاملاً تسویه‌شده
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    var activeInvs = g.invoices;
    if (!activeInvs.length) return;

    var allPaid = true, lastWhen = '';
    var base = 0;
    activeInvs.forEach(function (inv) {
      var pays = (inv.payments || []).concat(inv.pays || []).filter(activePayment);
      var paid = pays.reduce(sumAmt, 0);
      if (inv.amount - paid > 0.5) { allPaid = false; return; }
      base += inv.amount;                                   // مبلغ کل فاکتور
      pays.forEach(function (p) {
        var w = dateOf(p, inv);
        if (w > lastWhen) lastWhen = w;                     // آخرین وصولی = ماه تسویه
      });
    });
    if (!allPaid || base <= 0) return;                      // ← هنوز تسویه کامل نیست

    if (!inBounds(lastWhen, b)) return;                     // ماه تسویه باید در دوره باشد
    var r = row(g.owner);
    r.base += base;
    r.lines.push({ type: 'settled', ref: g.deal.inqNo || g.deal.cd || '',
                   buyer: g.deal.buyerCo || '', amount: base, date: lastWhen });
  });
}
```

### نکات پیاده‌سازی
- `ownerOf` همان تابع فعلی است (مالک از مشتری/پیشنهاد)؛ مالک کل پرونده از پیشنهاد برنده یا مشتری خوانده می‌شود.
- **دوباره‌شماری ندارد:** هر پرونده فقط یک‌بار (وقتی کامل شد) وارد مبنا می‌شود.
- **پیش‌پرداخت نشسته روی فاکتور (`fromAdvance`)** جزو `paid` محسوب می‌شود (چون `activePayment` آن را حذف نمی‌کند) → پرونده‌هایی که با پیش‌پرداخت ۱۰۰٪ تسویه شده‌اند درست «تسویه کامل» شناخته می‌شوند.
- `type: 'settled'` به‌جای `receipt` برای شفافیت گزارش چاپی.

---

## ۴) تغییرات UI

- حذف سلکتور «مبنا» و حالت `won` از `ptfCommissionHtml` و `commissionSettingsHtml` و `cfg()`.
- متن کمکی پنل به «مبنای شفاف: وصولی واقعی — فقط پس از تسویه کامل پرونده».
- `ptfCommissionApproveCycle` بدون پارامتر basis (فقط collected).
- `cfg()` فقط `defaultPct` و `byUser` را نگه می‌دارد (فیلد `basis` منسوخ؛ مقدار قدیمی در settings به‌صورت بی‌اثر باقی می‌ماند).

---

## ۵) فایل‌های درگیر (در صورت اجرا)

- `crm/commission.js` — بازنویسی `ptfCommissionCalc` + حذف won + برچسب گزارش + تنظیمات.
- bump نسخه (`v34.5.34` → `v34.5.35`) در `sw.js`، `shell.js`، `manifest.json`،
  `clear-cache.html`، `index.html` (`?v=` + `PTF_CRM_RELEASE`)، `VERSION.json`.
- بدون لمس داده‌های موجود؛ فقط منطق محاسبه.

---

## ۶) ریسک/تأثیر

- تغییر سیاست محاسبه‌ی پورسانت است و روی مبلغ قابل پرداخت اثر مستقیم دارد.
- دوره‌های **از قبل تصویب‌شده** (`ptf_crm_commission_records` با status approved) دست‌نخورده می‌مانند.
- پس از deploy، مبنای دوره‌های جاری کمتر نشان داده می‌شود (وصولی‌های ناقص و پرونده‌های ناتسویه حذف می‌شوند) — اطلاع به کارفرما لازم است.
- فاکتورهایی که به هیچ پرونده‌ای لینک نیستند (بدون wonOffer/inqNo) از محاسبه خارج می‌شوند — باید بررسی شود که آیا داده واقعی چنین مواردی دارد یا خیر.

---

## ۷) تصمیم نهایی فاکتور یتیم

- **حذف از محاسبه** (تصویب کارفرما ۱۴۰۵/۰۵/۲۳): فاکتور بدون پرونده (بدون wonOffer/inqNo/dealCd) وارد مبنای پورسانت نمی‌شود و هشداری هم نمی‌گیرد.
