/* =====================================================================
   PTF CRM — ابزار تشخیص «چرا مهر/امضا روی نامه نمی‌افتد»  (فقط خواندن)
   نسخه: v34.39.58-letdiag · تاریخ: ۲۰۲۶-۱۰-۲۴ (پس از رفع LETTER-SIG-ASSET)
   ---------------------------------------------------------------------
   نحوهٔ استفاده (بدون تغییر داده):
     ۱) در CRM وارد بخش «✉️ مکاتبات» شوید.
     ۲) کنسول مرورگر را باز کنید (F12 → Console).
     ۳) کل این فایل را انتخاب و Paste کنید و Enter بزنید.
     ۴) جدول خروجی را برای تیم فنی بفرستید (هیچ داده‌ای تغییر نمی‌کند،
        فقط اندازهٔ تصاویر و وضعیت‌های نامه گزارش می‌شود).
   ---------------------------------------------------------------------
   ستون‌ها:
     st        = وضعیت نامه (draft/pending/signed/registered/rejected)
     snapSig   = آیا تصویر امضا در سندِ ذخیره‌شده (snapshot) هست؟
     snapStamp = آیا تصویر مهر در snapshot هست؟
     sigAsset  = ارجاع کوتاه دارایی در سند (v34.39.58) و اینکه تصویرش بازیابی می‌شود؟
     profSig   = آیا پروفایل امضای امضاکننده تصویر امضا دارد؟
     profStamp = آیا آن پروفایل تصویر مهر دارد؟
     printable = خروجی «با امضای دیجیتال» چه تصویری نشان می‌دهد؟
   ===================================================================== */
(function ptfLettersSignatureDiagnose() {
  function bytes(s) { s = String(s || ''); return s ? Math.round(s.length / 1024) + 'KB' : '—'; }
  function ok(v) { return v ? '✔' : '✘'; }
  var has = typeof getData === 'function';
  if (!has) { console.warn('این ابزار باید داخل پنل CRM اجرا شود.'); return; }
  var letters = [];
  try { letters = getData('ptf_crm_letters') || []; } catch (eL) { letters = []; }
  var profMap = {};
  try { profMap = getData('ptf_crm_sigprofiles') || {}; } catch (eP) { profMap = {}; }
  if (Array.isArray(profMap)) profMap = {}; /* ثبت خراب/آرایه‌ای = پروفایل دیده نمی‌شود */
  var me = (typeof curSession === 'function' ? (curSession() || {}).user : '') || '';
  var myProf = {};
  try { myProf = (typeof window.ptfSigProfileFor === 'function' ? window.ptfSigProfileFor(me) : profMap[me]) || {}; } catch (eM) { myProf = {}; }

  var rows = [], stat = { signedNoImage: 0, signed: 0, physical: 0, pending: 0, draft: 0 };
  letters.forEach(function (l) {
    if (!l || l.cd === undefined) return;
    var snap = l.signatureSnapshot || {};
    var signer = l.signer || (l.signerMode === 'other' ? '' : me);
    var p = {};
    try {
      p = (typeof window.ptfSigProfileFor === 'function' ? window.ptfSigProfileFor(signer) : profMap[signer])
        || (typeof letResolveSignerProfile === 'function' ? letResolveSignerProfile(l) : {})
        || {};
    } catch (eS) { p = {}; }
    /* v34.39.58: همان زنجیرهٔ چاپ — دارایی سند ← تصویر سالم داخل سند ← پروفایل فعلی */
    function assetUrl(id) {
      try { return (id && typeof letAssetGet === 'function') ? (letAssetGet(id) || '') : ''; } catch (eA) { return ''; }
    }
    var aSig = assetUrl(snap.sigAsset), aStp = assetUrl(snap.stampAsset);
    var sigOk = !!aSig || !!(typeof letImgDataUrlOk === 'function' ? letImgDataUrlOk(snap.sig, true) : snap.sig);
    var stpOk = !!aStp || !!(typeof letImgDataUrlOk === 'function' ? letImgDataUrlOk(snap.stamp, true) : snap.stamp);
    var liveSig = typeof letImgDataUrlOk === 'function' ? letImgDataUrlOk(p.sig, true) : !!p.sig;
    var liveStp = typeof letImgDataUrlOk === 'function' ? letImgDataUrlOk(p.stamp, true) : !!p.stamp;
    var willPrint = '';
    if (l.st === 'signed') {
      if (sigOk || stpOk) willPrint = 'مهر/امضای سند';
      else if (liveSig || liveStp) willPrint = 'مهر/امضای فعلی پروفایل (ترمیم خودکار)';
      else willPrint = 'بدون تصویر (فالبک پیدا نشد)';
      stat.signed++;
      if (!sigOk && !stpOk && !liveSig && !liveStp) stat.signedNoImage++;
    } else if (l.st === 'pending') { willPrint = 'در انتظار امضا (بدون تصویر)'; stat.pending++; }
    else if (l.st === 'registered') { willPrint = 'فیزیکی/ثبت‌شده (بدون تصویر دیجیتال)'; stat.physical++; }
    else { willPrint = 'پیش‌نویس (بدون تصویر)'; stat.draft++; }
    rows.push({
      'کد': l.cd,
      'شماره': l.no || '—',
      'st': l.st || '—',
      'امضاکننده': l.signerNm || l.signer || '—',
      'snapSig': ok(snap.sig) + ' ' + bytes(snap.sig),
      'snapStamp': ok(snap.stamp) + ' ' + bytes(snap.stamp),
      'sigAsset': (snap.sigAsset || snap.stampAsset || '—') + ' ' + (aSig || aStp ? '✔' : ''),
      'profSig': ok(p.sig) + ' ' + bytes(p.sig),
      'profStamp': ok(p.stamp) + ' ' + bytes(p.stamp),
      'خروجی «با امضا»': willPrint,
      'snapshot.at': snap.at || '—'
    });
  });

  console.log('%c✉️ تشخیص مهر/امضا — مکاتبات', 'font-weight:700;font-size:13px;color:#0e7490');
  console.log('کاربر جاری: ' + me +
    ' | پروفایل من: امضا ' + ok(myProf.sig) + ' ' + bytes(myProf.sig) +
    ' / مهر ' + ok(myProf.stamp) + ' ' + bytes(myProf.stamp) +
    ' | نگارش پروفایل: ' + (myProf.updatedAtISO || '—'));
  console.log('تعداد نامه‌ها: ' + letters.length + ' | امضاشده: ' + stat.signed +
    ' (بدون تصویر در سند: ' + stat.signedNoImage + ') | در انتظار امضا: ' + stat.pending +
    ' | فیزیکی/ثبت‌شده: ' + stat.physical + ' | پیش‌نویس: ' + stat.draft);
  if (typeof console.table === 'function') console.table(rows.slice(0, 60)); else console.log(rows);

  var lines = [];
  var assetIds = Object.keys(profMap).filter(function (k) { return k.indexOf('_asset_') === 0; });
  var assetBytes = assetIds.reduce(function (n, k) { return n + String((profMap[k] || {}).src || '').length; }, 0);
  console.log('فضای دارایی: ' + assetIds.length + ' تصویر (' + bytes(String('x').repeat(assetBytes)) + ') در کلید ptf_crm_sigprofiles');
  if (assetBytes > 3 * 1024 * 1024) lines.push('⚠️ حجم دارایی‌ها بیش از بودجهٔ ۳MB است؛ دارایی‌های بی‌ارجاع به‌صورت خودکار پیرایش می‌شوند.');
  if (!myProf.sig && !myProf.stamp) lines.push('⚠️ پروفایل امضای شما هیچ تصویری ندارد؛ ابتدا «✍️ امضای من» را تکمیل کنید.');
  if (stat.signedNoImage) lines.push('⚠️ ' + stat.signedNoImage + ' نامهٔ امضاشده هیچ تصویری (نه در سند، نه در پروفایل) ندارد؛ با نقش ارشد «🩺 ترمیم تصویر امضا» را بزنید یا نامه را بازچاپ/امضای مجدد کنید.');
  if (stat.physical) lines.push('ℹ️ ' + stat.physical + ' نامه در وضعیت «ثبت‌شده/فیزیکی» است — این وضعیت عمداً تصویر دیجیتال درج نمی‌کند (برای مهر و امضای دستی).');
  if (!lines.length) lines.push('✅ همهٔ نامه‌های امضاشده تصویر دارند یا با ترمیم خودکار از پروفایل چاپ می‌شوند؛ برای خروجی با مهر و امضا از دکمهٔ «🖨 با امضای دیجیتال» استفاده کنید («🖨 بدون امضا / چاپ فیزیکی» عمداً تصویر درج نمی‌کند).');
  lines.forEach(function (x) { console.log(x); });
  return { rows: rows, stat: stat, me: me, assets: { count: assetIds.length, bytes: assetBytes },
    myProfile: { hasSig: !!myProf.sig, hasStamp: !!myProf.stamp } };
})();
